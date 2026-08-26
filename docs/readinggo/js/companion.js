/* =========================================================
   ReadingGo — companion.js  (#761 모듈화: nest.js에서 추출)
   재키(Jacky) 한 문장 대화 — CompanionModal + 헬퍼(질문 생성·아카이브·노트 파싱).
   app.js **이전** 로드(app.js가 <CompanionModal> 소비). 순수 이동:
   DataStore·rgTrack·showToast 등 window 전역은 bare 유지(런타임 재할당 반영), lexical 훅만 재선언.
   ========================================================= */

const { useState: _useState, useEffect: _useEffect, useRef: _useRef } = React;

/* ── 재키(Jacky) 대화 헬퍼 (#184 읽기모드/타이머 폐기 #505 — 빠른입력·CompanionModal 공용) ── */
// 재키(Jacky) 대화 (companion.md §4) — Worker /api/companion(solar-pro3) 호출. 실패/키없음 시 목 폴백.
const COMPANION_QS = [
  '왜 이 문장이 마음에 걸렸어요?',
  '이 문장, 지금 내 상황이랑 연결되는 게 있어요?',
  '이 문장에 동의해요, 아니면 고개를 갸웃했어요?',
  '이 문장을 누군가에게 들려준다면 누구일까요?',
  '이 문장에서 어떤 장면이나 기억이 떠올랐어요?',
];
const COMPANION_MAX_TURNS = 10;
function pickCompanionQ(text) {
  const i = (text ? text.length : 0) % COMPANION_QS.length;
  return COMPANION_QS[i];
}
// 실 LLM 호출 (solar-pro3, 서버 프록시). 네트워크/프록시 실패 시 목 질문 폴백 — 데모 무중단.
async function genCompanionQuestion(sentence, bookTitle, author, kind, avoid, record) {
  if (record && record.id && record.bookId && window.RG_personalization && window.RG_personalization.isEnabled()) {
    const proof = await window.RG_personalization.requestQuestion({
      sentence, bookTitle: bookTitle || '', author: author || '', kind: kind || 'quote', avoid: avoid || '',
      current_sentence_id: record.id, book_id: record.bookId, query_text: String(sentence || ''),
      preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : ''),
    }).catch(() => null);
    if (proof) return { personalizationProof: proof };
  }
  try {
    const r = await window.RG_apiFetch('/api/companion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', kind: kind || 'quote', avoid: avoid || '', preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : '') }),
    });
    if (r.ok) { const d = await r.json(); if (d && d.question) return d.question; }
  } catch (e) { /* 폴백 */ }
  return pickCompanionQ(sentence);
}
// 멀티턴 후속 질문 (#327) — 이전 대화(exchanges) 전달 → 한 걸음 더 깊은 되물음. 실패 시 목 폴백. avoid(#372) 재생성용.
async function genCompanionFollowup(sentence, exchanges, bookTitle, author, kind, avoid, record) {
  if (record && record.id && record.bookId && window.RG_personalization && window.RG_personalization.isEnabled()) {
    const last = exchanges && exchanges.length ? exchanges[exchanges.length - 1].a : '';
    const proof = await window.RG_personalization.requestQuestion({
      sentence, bookTitle: bookTitle || '', author: author || '', exchanges, kind: kind || 'quote', avoid: avoid || '',
      current_sentence_id: record.id, book_id: record.bookId, query_text: `${sentence || ''}\n${last || ''}`,
      preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : ''),
    }).catch(() => null);
    if (proof) return { personalizationProof: proof };
  }
  try {
    const r = await window.RG_apiFetch('/api/companion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', exchanges, kind: kind || 'quote', avoid: avoid || '', preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : '') }),
    });
    if (r.ok) { const d = await r.json(); if (d && d.question) return d.question; }
  } catch (e) { /* 폴백 */ }
  return '그 답에서 한 걸음 더 들어가면, 무엇이 떠오르나요?';
}
function commitCompanionQuestion(value, setter, setSources) {
  if (value && value.personalizationProof && window.RG_personalization) {
    return window.RG_personalization.commit(value.personalizationProof, {
      display: (data) => { setter(data.question); if (setSources) setSources(Array.isArray(data.sources) ? data.sources : []); },
      analytics: (data) => { if (window.rgTrack && data.sources && data.sources.length) window.rgTrack('personalized_context_applied', { source_count_bucket: data.sources.length === 1 ? '1' : data.sources.length <= 3 ? '2_3' : '4_5', source_type_set: [...new Set(data.sources.map((s) => s.type))], preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : 'balanced'), outcome: 'applied' }); },
    });
  }
  if (setSources) setSources([]);
  setter(value);
  return true;
}
// 대화 1턴(Q/A)을 서버 아카이브 (#295) — 동의 유저만. 로컬/게스트는 어댑터가 no-op.
function archiveCompanion(bookId, sentenceText, q, a) {
  try {
    if (window.RG_consent && window.RG_consent.get() === 'yes' && DataStore.companionSessions && DataStore.companionSessions.add) {
      Promise.resolve(DataStore.companionSessions.add({ bookId, sentence: sentenceText, question: q, answer: a, lens: 'why' })).catch(() => {});
    }
  } catch (e) {}
}

/* ── CompanionModal (#326): 한 문장 대화 — 읽기 모드 밖에서 열람·이어가기 ──
   저장된 대화(my_note의 Q/A)를 보여주고, 동의 시 한 걸음 더 이어감(멀티턴). */
function parseNoteToExchanges(note) {
  if (!note) return [];
  const out = [];
  String(note).split(/\n\n+/).forEach((b) => {
    const m = b.match(/^Q\.\s*([\s\S]*?)\nA\.\s*([\s\S]*)$/);
    if (m) out.push({ q: m[1].trim(), a: m[2].trim() });
  });
  return out;
}

/* ── 문장별 "내 감상만" vs "재키와 대화" (#1070) ───────────────────────────────
   하나의 my_note 칸을 두 성찰이 블록으로 나눠 쓴다 — 자유 감상 블록(Q. 로 시작하지 않음)과
   재키 Q/A 블록(`Q. …\nA. …`). 과거(#404)에 자유 감상 편집을 폐지했던 이유가 "둘이 같은
   my_note 를 서로 덮어쓰던 충돌"이었으므로, 저장 시 **상대 영역을 항상 보존**한다:
   재키 턴 저장이 감상을 지우지 않고, 감상 저장이 대화를 지우지 않는다. parseNoteToExchanges 는
   이미 Q/A 블록만 뽑으므로(감상 블록 무시) 재키 화면은 영향 없음. */
function rgSplitNote(note) {
  const free = [], qa = [];
  String(note || '').split(/\n\n+/).forEach((b) => {
    const t = b.trim();
    if (!t) return;
    (/^Q\.\s/.test(t) ? qa : free).push(t);
  });
  return { free: free.join('\n\n'), qa: qa.join('\n\n') };
}
function rgJoinNote(free, qa) {
  return [String(free || '').trim(), String(qa || '').trim()].filter(Boolean).join('\n\n');
}
// 문장이 이미 가진 성찰 종류 — 'jacky'(재키 대화 있음) > 'note'(감상만) > ''(없음). 진입 기본 모드 추정용.
function rgNoteKind(note) {
  const { free, qa } = rgSplitNote(note);
  if (qa) return 'jacky';
  if (free) return 'note';
  return '';
}
// 문장별 성찰 기본 모드 (#1070, 기본=note 확정 #1081). 카드 버튼은 모드를 명시해 열기 때문에,
// 이 기본값은 '모드 미지정 + 빈 문장' 진입(되감기·모아보기 등)에만 적용된다.
//   'note' = 내 감상 우선(계휴 결정) · 'jacky' = 재키 먼저.
const RG_REFLECT_DEFAULT = 'note';
window.rgSplitNote = rgSplitNote;
window.rgJoinNote = rgJoinNote;
window.rgNoteKind = rgNoteKind;

function CompanionModal({ sentence, onClose }) {
  // 성찰 모드 (#1070): 'note'(내 감상만) | 'jacky'(재키와 대화). 카드가 _openMode 로 명시,
  // 미지정이면 그 문장이 이미 가진 성찰(rgNoteKind) → 없으면 기본값(RG_REFLECT_DEFAULT).
  const _startMode = (sentence._openMode === 'note' || sentence._openMode === 'jacky')
    ? sentence._openMode
    : (rgNoteKind(sentence.note) || RG_REFLECT_DEFAULT);
  const [mode, setMode] = _useState(_startMode === 'note' ? 'note' : 'jacky');
  // 내 감상(자유 메모) 초안 — my_note 의 비-Q/A 블록(rgSplitNote.free). 저장 시 재키 Q/A 보존.
  const [noteDraft, setNoteDraft] = _useState(() => rgSplitNote(sentence.note).free);
  const [noteSaving, setNoteSaving] = _useState(false);
  const initialExchanges = parseNoteToExchanges(sentence.note);
  const initiallyAtCap = initialExchanges.length >= COMPANION_MAX_TURNS;
  const [exchanges, setExchanges] = _useState(initialExchanges);
  const [question, setQuestion] = _useState(null);
  const [personalizationSources, setPersonalizationSources] = _useState([]);
  const [loading, setLoading] = _useState(_startMode !== 'note' && !initiallyAtCap);   // 감상 모드·캡 도달 진입 시 스피너 숨김
  const [answer, setAnswer] = _useState('');
  const [done, setDone] = _useState(initiallyAtCap);
  const [rated, setRated] = _useState(null);               // 질문 평가 👍/👎 (#371)
  const [editing, setEditing] = _useState(false);          // 한 문장 본문 편집 (#325)
  const [stext, setStext] = _useState(sentence.text || '');
  const [stextError, setStextError] = _useState('');
  const [skind, setSkind] = _useState(sentence.kind === 'thought' ? 'thought' : 'quote'); // 인용↔내 의견 (#381)
  const _compTailRef = _useRef(null);                      // 대화 말단 anchor (#407 화면 점프 방지)
  const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
  // 재키 질문 결 프리셋 (#375) — 대화 화면에서도 전환 (#935). 설정과 같은 RG_companionPreset(localStorage) 공유.
  // 바꾸면 다음 질문(genCompanionQuestion/Followup)이 현재 프리셋을 읽어 반영. '작가의 시선'(author)도 여기서 즉시.
  const [qPreset, setQPreset] = _useState(window.RG_companionPreset ? window.RG_companionPreset.get() : 'balanced');
  const pickPreset = (k) => { setQPreset(k); if (window.RG_companionPreset) window.RG_companionPreset.set(k); if (consent === 'yes') rgTrack('companion_preset_set', { preset: k, where: 'chat' }); };
  // 질문 결 가로 스크롤 어포던스 (#1116) — 프리셋 7개가 모달 폭(430)을 넘겨 이미 가로 스크롤되지만
  // 넘침을 알 힌트(스크롤바·엣지)가 없어 화면 밖 결(작가의 시선 등)을 못 보던 문제. 스크롤 위치에 따라
  // 좌/우 페이드 마스크를 켜 "더 있음"을 알린다. 새 의존성 없이 CSS mask 만 추가(Stack Lock 준수).
  const _presetScrollRef = _useRef(null);
  const [presetFade, setPresetFade] = _useState({ l: false, r: false });
  const _syncPresetFade = () => {
    const el = _presetScrollRef.current; if (!el) return;
    const l = el.scrollLeft > 4;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setPresetFade((f) => (f.l === l && f.r === r) ? f : { l, r });
  };
  _useEffect(() => { if (mode === 'jacky') _syncPresetFade(); }, [mode]);
  const _presetMask = `linear-gradient(to right, ${presetFade.l ? 'transparent' : '#000'} 0, #000 16px, #000 calc(100% - 16px), ${presetFade.r ? 'transparent' : '#000'} 100%)`;
  const bt = sentence.bookTitle || '', au = sentence.author || '';
  const saveText = async () => {
    const v = stext.trim();
    if (!v) { setEditing(false); return; }
    const wasTruncated = Array.from(v).length > 1000;
    try {
      let savedText = window.RG_validateSentenceText ? window.RG_validateSentenceText(v, sentence.visibility).text : Array.from(v).slice(0, 1000).join('');
      if (DataStore.sentences && DataStore.sentences.updateText) {
        const row = await Promise.resolve(DataStore.sentences.updateText(sentence.id, v));
        if (row && row.text) savedText = row.text;
      }
      // 종류 변경(#381) 제거 — '내 생각'(thought) 폐기 (#596). 텍스트만 수정.
      sentence.text = savedText; setStext(savedText); setStextError(''); setEditing(false);
      showToast(wasTruncated ? '1,000자를 넘어 앞부분만 저장했어요' : '문장 수정됨');
    } catch (e) {
      setStextError('저장하지 못했어요. 입력 내용은 그대로 두었어요.');
    }
  };
  // 재키 질문 생성 — 재키 모드에서만(감상 모드는 LLM 호출 안 함, #1070). 감상→재키 전환으로
  // 처음 재키에 들어올 때 1회 생성. 이미 질문이 있거나 종료(done)면 재생성하지 않는다.
  _useEffect(() => {
    if (mode !== 'jacky' || question || done) return;
    let alive = true;
    setLoading(true);
    const past = parseNoteToExchanges(sentence.note);
    if (past.length >= COMPANION_MAX_TURNS) { setLoading(false); setDone(true); return; }
    // 질문 생성은 사용자가 요청한 핵심 서비스 처리다. 선택 동의는 아래 archiveCompanion과
    // 리플레이·식별 분석만 제어하며, 미동의자도 최소 문장/책/해당 대화만 전송해 같은 추론을 받는다.
    const gen = past.length
      ? genCompanionFollowup(sentence.text, past, bt, au, sentence.kind, '', sentence)
      : genCompanionQuestion(sentence.text, bt, au, sentence.kind, '', sentence);
    gen.then((q) => { if (alive) { commitCompanionQuestion(q, setQuestion, setPersonalizationSources); setLoading(false); } });
    return () => { alive = false; };
  }, [mode]);
  // 새 질문·답변·로딩 변화 시 대화 말단을 view로 — 답변 생성에 의한 화면 점프·오탭 방지 (#407)
  _useEffect(() => {
    try { _compTailRef.current && _compTailRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {}
  }, [question, loading, done, exchanges.length]);
  const persist = (ex) => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.setNote)) return Promise.resolve(false);
    if (!ex || !ex.length) return Promise.resolve(false);   // 빈 대화로 기존 my_note 덮어쓰기 방지 (#404)
    const qa = ex.map((e) => `Q. ${e.q}\nA. ${e.a}`).join('\n\n');
    const note = rgJoinNote(rgSplitNote(sentence.note).free, qa);   // 내 감상 블록 보존 (#1070)
    return Promise.resolve(DataStore.sentences.setNote(sentence.id, note)).then(() => {
      sentence.note = note;
      window.dispatchEvent(new CustomEvent('rg:sentence-note', { detail: { id: sentence.id, note } }));
      return true;
    }).catch(() => false);
  };
  // 내 감상만 저장 (#1070) — 재키 Q/A 는 보존하고 자유 감상 블록만 교체. 빈 감상 저장 = 감상 블록 제거.
  // 재키를 강제하지 않고 이 한 번으로 성찰이 완결된다(데이터=my_note, 양 어댑터 setNote 표면 일치).
  const saveFreeNote = () => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.setNote)) { onClose(); return; }
    const free = noteDraft.trim();
    const note = rgJoinNote(free, rgSplitNote(sentence.note).qa);   // 재키 대화 보존
    setNoteSaving(true);
    Promise.resolve(DataStore.sentences.setNote(sentence.id, note || null)).then(() => {
      sentence.note = note;
      window.dispatchEvent(new CustomEvent('rg:sentence-note', { detail: { id: sentence.id, note } }));
      if (window.rgTrack) window.rgTrack('reflection_note_saved', { book_id: sentence.bookId || '', chars: free.length });
      setNoteSaving(false);
      onClose();
      showToast(free ? '내 감상을 저장했어요' : '감상을 비웠어요');
    }).catch(() => { setNoteSaving(false); showToast('저장 실패 — 잠시 후 다시'); });
  };
  // 한 문장 삭제 (#1) — 둥지 한 문장 상세에도 삭제. 이벤트로 둥지·서재 목록 즉시 반영.
  const delQuote = () => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.remove)) { onClose(); return; }
    if (!window.confirm('이 한 문장을 삭제할까요? 되돌릴 수 없어요.')) return;
    Promise.resolve(DataStore.sentences.remove(sentence.id)).then(() => {
      if (window.rgTrack) window.rgTrack('sentence_deleted', { book_id: sentence.bookId || '' });
      window.dispatchEvent(new CustomEvent('rg:sentence-removed', { detail: { id: sentence.id } }));
      showToast('한 문장을 삭제했어요');
      onClose();
    }).catch(() => showToast('삭제 실패 — 잠시 후 다시'));
  };
  const submit = () => {
    const a = answer.trim();
    if (!a || !question || exchanges.length >= COMPANION_MAX_TURNS) return;
    const ex = [...exchanges, { q: question, a }];
    setExchanges(ex); setAnswer('');
    persist(ex).then((saved) => {
      if (saved && consent === 'yes') rgTrack('answer_saved', { book_id: sentence.bookId || '', lens: 'why', answer_length: a.length });
    });
    archiveCompanion(sentence.bookId, sentence.text, question, a); // 서버 아카이브 (#295)
    // 저장된 Q/A 포함 누적 10턴 도달 시 종료. 선택 동의 여부는 이용 가능 턴 수와 무관하다(#1409).
    if (ex.length >= COMPANION_MAX_TURNS) { setQuestion(null); setDone(true); return; }
    setLoading(true); setQuestion(null); setRated(null);
    genCompanionFollowup(sentence.text, ex, bt, au, sentence.kind, '', sentence).then((q) => { commitCompanionQuestion(q, setQuestion, setPersonalizationSources); setLoading(false); });
  };
  // 질문 재생성 (#372) / 평가 (#371)
  const regen = () => {
    if (loading || !question) return;
    const cur = question;
    if (consent === 'yes') rgTrack('companion_q_regen', { book_id: sentence.bookId || '' });
    setLoading(true); setQuestion(null); setRated(null);
    const gen = exchanges.length ? genCompanionFollowup(sentence.text, exchanges, bt, au, sentence.kind, cur, sentence)
      : genCompanionQuestion(sentence.text, bt, au, sentence.kind, cur, sentence);
    gen.then((q) => { commitCompanionQuestion(q, setQuestion, setPersonalizationSources); setLoading(false); });
  };
  const rate = (val) => { if (consent === 'yes') rgTrack('companion_q_rated', { book_id: sentence.bookId || '', value: val }); setRated(val); };
  const openConversationRecord = () => {
    onClose();
    if (sentence.bookId && window.RG_openBookshelfRecord) window.RG_openBookshelfRecord(sentence.bookId, sentence.id);
  };
  const openPersonalizationSource = (source) => {
    onClose();
    if (source && source.book_id && window.RG_openBookshelfRecord) window.RG_openBookshelfRecord(source.book_id, source.id);
  };
  const excludePersonalizationSource = async (source) => {
    if (!(source && window.RG_personalization)) return;
    try {
      const ok = await window.RG_personalization.setSourceExcluded(source.type, source.id, true);
      if (ok !== true) throw new Error('exclude failed');
      setPersonalizationSources((items) => items.filter((item) => !(item.id === source.id && item.type === source.type)));
      showToast('다음 대화부터 이 기록을 제외해요');
    } catch (e) { showToast('기록 제외 설정을 저장하지 못했어요'); }
  };
  const deletePersonalizationSource = async (source) => {
    if (!(source && source.id && DataStore.sentences && DataStore.sentences.remove)) return;
    if (!window.confirm('이 문장과 연결된 감상·Q/A 기록을 모두 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await Promise.resolve(DataStore.sentences.remove(source.id));
      setPersonalizationSources((items) => items.filter((item) => item.id !== source.id));
      window.dispatchEvent(new CustomEvent('rg:sentence-removed', { detail: { id: source.id } }));
      showToast('기록을 삭제했어요');
    } catch (e) { showToast('기록을 삭제하지 못했어요'); }
  };
  const _JackAvatar = ({ size = 28 }) => (
    <div aria-label="재키, 독서 동반자" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <window.SparrowMark size={size * 0.78} />
    </div>
  );
  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, height: '90vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── 헤더 (모드별, #1070) — 감상 모드면 재키 브랜딩 대신 '내 감상'(재키 없이). ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          {mode === 'note' ? (
            <>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-tint)', color: 'var(--brand-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rgIcon('pen', 19)}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>내 감상</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>재키 없이 내 생각만</div>
              </div>
            </>
          ) : (
            <>
              <_JackAvatar size={38} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>재키</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>독서 동반자</div>
              </div>
            </>
          )}
          <button onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* ── 성찰 모드 토글 (#1070) — 문장별로 '내 감상' ↔ '재키와 대화'. 한 탭으로 전환.
             선택=브랜드 솔리드 / 비선택=라인(프리셋 칩과 동일 패턴, DESIGN.md 위계 일관). ── */}
        <div role="group" aria-label="성찰 방식" style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          {[['note', '내 감상', 'pen'], ['jacky', '재키와 대화', 'chat']].map(([id, label, ico]) => {
            const on = mode === id;
            return (
              <button key={id} onClick={() => setMode(id)} aria-pressed={on}
                style={{ flex: 1, padding: '7px 12px', borderRadius: 999, border: on ? 'none' : '1px solid var(--line)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {rgIcon(ico, 14)} {label}
              </button>
            );
          })}
        </div>

        {/* ── 질문 결 프리셋 전환 (#935, #922 후속) — 설정에만 있던 결 선택을 대화 화면에도.
             대화 맥락에서 '작가의 시선' 등으로 즉시 전환 → 다음 질문부터 반영(RG_companionPreset 공유).
             칩: 선택=브랜드 솔리드 / 비선택=라인(설정 SettingsModal 칩과 동일 패턴 — DESIGN.md 위계 일관). 가로 스크롤.
             #1070: 재키 모드에서만 노출(감상 모드엔 질문 결이 무의미). ── */}
        {mode === 'jacky' && (
        <div ref={_presetScrollRef} onScroll={_syncPresetFade} role="group" aria-label="재키 질문 결 선택" style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maskImage: _presetMask, WebkitMaskImage: _presetMask }}>
          {(window.RG_COMPANION_PRESETS || []).map((p) => {
            const on = qPreset === p.key;
            return (
              <button key={p.key} onClick={() => pickPreset(p.key)} aria-pressed={on} title={p.label}
                style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 16, border: on ? 'none' : '1px solid var(--line)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                {rgIcon(p.icon, 13)} {p.label}
              </button>
            );
          })}
        </div>
        )}

        {/* ── 스크롤 영역 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px' }}>

          {/* 문장 카드 */}
          {editing ? (
            <div style={{ marginBottom: 14 }}>
              {/* 인용↔내 생각 토글 (#381) 제거 — '내 생각'(thought) 폐기 (#596). 텍스트만 편집. */}
              <textarea value={stext} onChange={(e) => { setStext(e.target.value); setStextError(''); }} rows={3}
                aria-invalid={!!stextError}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--brand)', borderRadius: 12, padding: 10, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, fontSize: 11 }}>
                <span style={{ color: 'var(--fire)' }}>{stextError || (Array.from(stext.trim()).length > 1000 ? '저장 시 앞 1,000자만 남아요.' : '')}</span>
                <span style={{ color: Array.from(stext.trim()).length > 1000 ? 'var(--fire)' : 'var(--ink-3)' }}>{Array.from(stext.trim()).length}/1,000자</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {/* 취소 = 3차 텍스트(DESIGN.md #1032: ghost 금지) */}
                <button onClick={() => { setStext(sentence.text || ''); setStextError(''); setSkind(sentence.kind === 'thought' ? 'thought' : 'quote'); setEditing(false); }}
                  style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>취소</button>
                <button onClick={saveText}
                  style={{ flex: 1, padding: '7px 14px', borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', fontFamily: 'var(--font-quote)', fontSize: 14, fontStyle: skind === 'thought' ? 'normal' : 'italic', color: 'var(--ink)', lineHeight: 1.55, padding: '10px 48px 10px 12px', background: 'var(--paper-2)', borderRadius: 12, marginBottom: 14 }}>
              {skind === 'thought' ? (
                <><span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="5.5" rx="5.5" ry="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.2"/><circle cx="4" cy="10.5" r="1" fill="var(--ink-2)"/><circle cx="2" cy="12.5" r="0.6" fill="var(--ink-3)"/></svg>
                </span>{sentence.text}</>
              ) : `"${sentence.text}"`}
              <span style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 4 }}>
                <button onClick={() => { setStext(sentence.text || ''); setStextError(''); setEditing(true); }} title="문장 수정" aria-label="문장 수정"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.55, padding: 3, display: 'flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button onClick={delQuote} title="이 한 문장 삭제" aria-label="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.55, padding: 3, display: 'flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M5 4V2.5h3V4M5.5 6v4M7.5 6v4M3 4l.7 7h5.6L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </span>
            </div>
          )}

          {mode === 'note' ? (
            /* ── 내 감상 모드 (#1070) — 재키 질문 없이 자유롭게 내 생각만. 저장은 하단 '내 감상 저장'. ── */
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.6, marginBottom: 8 }}>
                재키 없이, 이 문장에 대한 내 감상만 남겨요.
              </div>
              <textarea value={noteDraft} onChange={(e) => { if (e.target.value.length <= 2000) setNoteDraft(e.target.value); }}
                placeholder="이 문장에서 떠오른 생각·감정을 자유롭게 적어요…" rows={7} aria-label="내 감상"
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', background: 'var(--paper-2)', color: 'var(--ink)', outline: 'none' }} />
              {rgSplitNote(sentence.note).qa ? (
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                  재키와 나눈 대화는 그대로 보관돼요 — '재키와 대화'에서 볼 수 있어요.
                </div>
              ) : null}
            </div>
          ) : (
          <>
          {/* 말풍선 채팅 UI (#435) — 좌=재키 질문(아바타), 우=내 답 */}
          {exchanges.map((e, ei) => (
            <div key={ei}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
                <_JackAvatar size={28} />
                <div style={{ maxWidth: '78%', background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '9px 13px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.55, color: 'var(--ink)' }}>{e.q}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ maxWidth: '78%', background: 'var(--brand)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.55 }}>{e.a}</div>
              </div>
            </div>
          ))}

          {/* 현재 상태 */}
          {done ? (
            <div style={{ padding: '12px 14px', background: 'rgba(63,209,127,0.08)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <_JackAvatar size={28} />
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>이 문장과 재키의 대화를 10턴까지 나눴어요.</span>
              </div>
              <button onClick={openConversationRecord}
                style={{ width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--brand-soft)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                책장에서 이 문장 대화 기록 보기
              </button>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <_JackAvatar size={28} />
              <div style={{ background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0.8, 0.5, 0.3].map((op, i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', opacity: op, display: 'block' }} />
                  ))}
                </div>
              </div>
            </div>
          ) : question ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <_JackAvatar size={28} />
              <div style={{ maxWidth: '78%', background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '9px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.55 }}>{question}</div>
                  <div style={{ flex: '0 0 auto', display: 'flex', gap: 2 }}>
                    <button onClick={() => rate('up')} title="좋은 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: rated === 'up' ? 1 : 0.4, display: 'flex', color: rated === 'up' ? 'var(--brand-3)' : 'currentColor' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 13V7h2L7 1.5v2.5h4a1 1 0 0 1 1 1l-1 4.5H7V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button onClick={() => rate('down')} title="별로예요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: rated === 'down' ? 1 : 0.4, display: 'flex', color: rated === 'down' ? 'var(--ink-2)' : 'currentColor' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 1v6h-2L7 12.5V10H3a1 1 0 0 1-1-1l1-4.5H7V1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button onClick={regen} title="다른 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: 0.5, display: 'flex' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 1 1-1.5-3.5L12 2v3.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
                {personalizationSources.length > 0 && (
                  <details style={{ marginTop: 8, borderTop: '1px solid var(--brand-soft)', paddingTop: 7 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--brand-3)', fontSize: 11.5, fontWeight: 900 }}>참고한 내 기록 {personalizationSources.length}개</summary>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {personalizationSources.map((source) => (
                        <div key={`${source.type}:${source.id}`} style={{ padding: 8, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)' }}>
                          <div style={{ color: 'var(--ink)', fontSize: 11.5, fontWeight: 800 }}>{source.title || '내 기록'}{source.page != null ? ` · ${source.page}쪽` : ''}</div>
                          <div style={{ marginTop: 3, color: 'var(--ink-2)', fontSize: 11, lineHeight: 1.45 }}>{source.preview || source.text || ''}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            <button onClick={() => openPersonalizationSource(source)} style={{ border: 0, background: 'var(--brand-soft)', color: 'var(--brand-3)', borderRadius: 999, padding: '5px 8px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>기록으로 이동</button>
                            <button onClick={() => excludePersonalizationSource(source)} style={{ border: 0, background: 'transparent', color: 'var(--ink-2)', borderRadius: 999, padding: '5px 8px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>이 기록 제외</button>
                            <button onClick={() => deletePersonalizationSource(source)} style={{ border: 0, background: 'transparent', color: 'var(--danger, #E5484D)', borderRadius: 999, padding: '5px 8px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>기록 삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ) : null}
          </>
          )}

          {/* 말단 anchor (#407) */}
          <div ref={_compTailRef} />
        </div>

        {/* ── 하단 바 (고정, 모드별 #1070) ── */}
        {mode === 'note' ? (
          /* 내 감상 저장 — 이 화면의 단일 1차 액션(솔리드). 재키를 강제하지 않고 한 번에 성찰 완결. */
          <div style={{ padding: '10px 16px 20px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--card)' }}>
            <button onClick={saveFreeNote} disabled={noteSaving}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: noteSaving ? 'default' : 'pointer', opacity: noteSaving ? 0.6 : 1 }}>
              {noteSaving ? '저장 중…' : '내 감상 저장'}
            </button>
          </div>
        ) : (
          /* ── 재키 입력바 ── '마치기' 버튼 제거(#655) — 종료는 모달 이탈(✕/바깥)로만. */
          !done && !loading && question && (
          <div style={{ padding: '10px 16px 20px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--card)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && answer.trim()) { e.preventDefault(); submit(); } }}
                placeholder="떠오르는 대로 답해보세요" rows={2}
                style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 12, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none', background: 'var(--paper-2)', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={submit} disabled={!answer.trim()} aria-label="전송"
                style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: answer.trim() ? 'var(--brand)' : 'var(--line)', color: '#fff', cursor: answer.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9l14-7-7 14V9H2z" fill="currentColor"/></svg>
              </button>
            </div>
          </div>
          )
        )}
      </div>
    </div>, document.body);
}
window.CompanionModal = CompanionModal;
