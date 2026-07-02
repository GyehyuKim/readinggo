/* =========================================================
   ReadingGo — sentence-collection-modal.js  (#761 모듈화 2차: components.js에서 추출)
   SentenceCollectionModal: 내 한 문장 모아보기(전체/책별/좋아요, #171·#608). SentenceActions(sentence-card)·DataStore(bare) 의존.
   components.js **이후** 로드(공유 컨텍스트·유틸은 window 전역). 순수 이동 — 훅만 재선언.
   ========================================================= */

const { useState, useEffect } = React;

/* ── SentenceCollectionModal: 내 한 문장 모아보기(전체/책별/좋아요) + 읽었음 카운터(#171) ── */
function SentenceCollectionModal({ onClose, initialFilter }) {
  const SentenceActions = window.SentenceActions; // sentence-card.js(이후 로드)에서 추출 (#761)
  const [mine, setMine] = useState(undefined);
  const [saved, setSaved] = useState([]);   // #608/#641: 좋아요한 타인 문장 — '좋아요' 필터 전용(전체/책별엔 미혼입)
  const [favIds, setFavIds] = useState(new Set());
  const [filter, setFilter] = useState(initialFilter || 'all'); // all | book | fav — 좋아요한 문장 진입 시 'fav' (#510)
  const [query, setQuery] = useState('');  // 내 한 문장 키워드 검색 (#1007, profile §5.8.8)
  // 독서 위키 Q&A — "내 문장에게 묻기" (#1007, profile §5.8.8). 같은 mine 데이터에 근거해 LLM 1콜.
  const [mode, setMode] = useState('find');   // find(찾기: 목록+검색) | ask(묻기: LLM Q&A)
  const [ask, setAsk] = useState('');         // 질문 입력
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');   // 받은 답(근거 문장/책 포함)
  const [askErr, setAskErr] = useState('');
  // 작성일자 표기 (#608) — created_at 은 number(localStorage)·ISO(Supabase) 모두 new Date 로 처리. 월/일만.
  const fmtWhen = (t) => { if (!t) return ''; const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); };
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.all([
      Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : []).catch(() => []),
      Promise.resolve((DS.claps && DS.claps.list) ? DS.claps.list() : []).catch(() => []),  // #641: 좋아요한 문장(구 bookmarks.list)
    ]).then(([sents, bms]) => {
      if (!alive) return;
      const mineList = (sents || []).map(s => ({
        id: s.id, text: s.text, page: s.page,
        bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '',
        bookId: (s.user_book && s.user_book.book_id) || s.book_id || '',
        author: (s.user_book && s.user_book.book && s.user_book.book.author) || '',
        note: s.my_note || '',   // 저장된 참새 대화 — 재오픈 시 이어보기(#418)
        kind: s.kind || 'quote',
        isPrivate: !!s.is_private,
        when: fmtWhen(s.created_at),   // #608: 작성일자
      }));
      // 좋아요(❤️)한 타인 문장 — claps 임베드 중 내 문장 목록에 없는 것. (#510→#641)
      // #608: '전체'·'책별'엔 내 문장만 보이도록 별도 보관 → '좋아요' 필터에서만 합친다.
      const mineIds = new Set(mineList.map(s => s.id));
      const savedExtra = (bms || []).filter(b => b && b.sentence && !mineIds.has(b.sentence_id)).map(b => {
        const se = b.sentence || {};
        const ub = se.user_book || {};
        return {
          id: b.sentence_id, text: se.text || '', page: se.page,
          bookTitle: (ub.book && ub.book.title) || se.bookTitle || '',
          bookId: ub.book_id || se.book_id || '',
          author: (ub.book && ub.book.author) || se.author || '',
          note: '', kind: se.kind || 'quote', isPrivate: false, saved: true,
          when: fmtWhen(se.created_at),   // #608: 작성일자
        };
      });
      setMine(mineList);
      setSaved(savedExtra);
      setFavIds(new Set((bms || []).map(b => b.sentence_id)));
    }).catch(() => { if (alive) { setMine([]); setSaved([]); } });
    return () => { alive = false; };
  }, []);
  const list = mine || [];
  // #608/#641: 좋아요 필터 풀 = 내 문장 + 좋아요한 타인 문장. 전체/책별은 내 문장(list)만.
  const favPool = list.concat(saved);
  const favCount = favPool.filter(s => favIds.has(s.id)).length;
  // 키워드 검색(#1007, §5.8.8) — 정규화 substring(소문자·공백정리)으로 문장+감상+책제목+저자 부분일치.
  // 퍼지(Fuse) 대신 substring: 한글에서 예측 가능·오매칭 없음. 규모(유저당 ≤약 100문장)라 클라 즉시.
  // 기존 전체/책별/좋아요 탭과 AND 합성 — 빈 검색어면 현행 동작 그대로.
  const nrm = (s) => (s == null ? '' : String(s)).toLowerCase().replace(/\s+/g, ' ').trim();
  const q = nrm(query);
  const matchQ = (s) => !q || nrm([s.text, s.note, s.bookTitle, s.author].join(' ')).includes(q);
  const base = filter === 'fav' ? favPool.filter(s => favIds.has(s.id)) : list;
  const filtered = q ? base.filter(matchQ) : base;
  const byBook = {};
  if (filter === 'book') filtered.forEach(s => { const k = s.bookTitle || '기타'; (byBook[k] = byBook[k] || []).push(s); });
  const renderLine = (s) => (
    <div key={s.id} onClick={() => { if (window.RG_openCompanion) window.RG_openCompanion({ id: s.id, text: s.text, bookId: s.bookId, bookTitle: s.bookTitle, author: s.author, page: s.page, note: s.note || s.my_note || '', kind: s.kind }); }}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>
        {s.bookTitle ? s.bookTitle + ' · ' : ''}{s.page != null ? s.page + 'p' : ''}{s.when ? ' · ' + s.when : ''}
      </div>
      <div style={{ fontFamily: 'var(--font-quote)', fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
      {/* 한 문장 액션 계약 (#610·#641) — 공용 SentenceActions: 내 문장=공개범위+좋아요+수정/삭제, 타인=좋아요 */}
      <SentenceActions sentence={s} mine={!s.saved} fav={favIds.has(s.id)}
        onRemoved={(rid) => { setMine(m => (m || []).filter(x => x.id !== rid)); setSaved(v => (v || []).filter(x => x.id !== rid)); }} />
    </div>
  );
  // "내 문장에게 묻기" (#1007) — 내 문장 전체(list)를 worker /api/wiki-ask 로. 서버가 그 문장에만 근거해 답.
  // 빈 질문·문장 0개·미설정은 비활성/안내. 환각 가드(근거 인용·"못 찾음")는 워커 프롬프트가 강제.
  const EXAMPLE_QS = ['내가 외로움에 대해 모은 문장은?', '이 문장들을 관통하는 주제는?', '다른 책에서 비슷한 생각을 한 부분이 있어?'];
  const submitAsk = (qOverride) => {
    const text = String(qOverride != null ? qOverride : ask).trim();
    if (!text || asking || !list.length) return;
    if (qOverride != null) setAsk(text);
    setAsking(true); setAnswer(''); setAskErr('');
    if (window.rgTrack) window.rgTrack('wiki_ask', { n: list.length, q_len: text.length });
    Promise.resolve(window.RG_wikiAsk ? window.RG_wikiAsk(text, list) : Promise.reject(new Error('미설정')))
      .then((a) => { setAnswer(a || '모은 문장에서는 못 찾았어요'); })
      .catch(() => { setAskErr('답하기 실패 — 잠시 후 다시'); })
      .finally(() => setAsking(false));
  };
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="내 한 문장 모아보기">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.rgIcon('close', 16)}</button>
        <div style={{ padding: '8px 20px 20px', maxHeight: '74vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>내 한 문장</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              읽었음 {list.length}개 ·
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              좋아요 {favCount}개
            </div>
          </div>
          {/* 찾기(목록·검색) ↔ 묻기(내 문장에게 묻기, #1007) 모드 전환 — 같은 mine 데이터 재사용.
              문장이 있을 때만 '묻기' 노출(문장 0개면 묻기 비활성). 선택=브랜드 솔리드 / 비선택=라인(DESIGN.md 위계). */}
          {mine !== undefined && list.length > 0 && (
            <div role="group" aria-label="찾기·묻기 모드" style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
              {[['find', <>{window.rgIcon('search', 13)} 찾기</>], ['ask', '🤖 내 문장에게 묻기']].map(([id, label]) => {
                const on = mode === id;
                return (
                  <button key={id} onClick={() => setMode(id)} aria-pressed={on}
                    style={{ padding: '6px 14px', borderRadius: 999, border: on ? 'none' : '1px solid var(--line)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}</button>
                );
              })}
            </div>
          )}
          {mode === 'find' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
            {[['all', '전체'], ['book', '책별'], ['fav', '좋아요']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: '6px 14px', borderRadius: 999, border: filter === id ? 'none' : '1px solid var(--line)', background: filter === id ? 'var(--ink)' : 'transparent', color: filter === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          )}
          {/* ── 묻기 모드(#1007): 내 문장 전체에 근거해 LLM 답. 검색이 못 잡는 '관통 주제·책 가로지르기'를 묻는다. ── */}
          {mode === 'ask' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.6, marginBottom: 10, textAlign: 'center' }}>
                내가 모은 {list.length}개의 문장에만 근거해 답해요. 없으면 솔직히 "못 찾았어요".
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                <textarea value={ask} onChange={e => setAsk(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ask.trim()) { e.preventDefault(); submitAsk(); } }}
                  placeholder="내 문장에게 물어보세요" aria-label="내 문장에게 묻기" rows={2}
                  style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none', outline: 'none' }} />
                <button onClick={() => submitAsk()} disabled={!ask.trim() || asking} aria-label="묻기"
                  style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: (ask.trim() && !asking) ? 'var(--brand)' : 'var(--line)', color: '#fff', cursor: (ask.trim() && !asking) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9l14-7-7 14V9H2z" fill="currentColor"/></svg>
                </button>
              </div>
              {/* 예시 질문 칩 — 처음 쓰는 사람에게 무엇을 물을 수 있는지(책 가로지르기 포함, #919). 답·로딩 전에만. */}
              {!answer && !asking && !askErr && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {EXAMPLE_QS.map((ex, i) => (
                    <button key={i} onClick={() => submitAsk(ex)}
                      style={{ padding: '5px 11px', borderRadius: 16, border: 'none', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{ex}</button>
                  ))}
                </div>
              )}
              {asking ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 18, fontSize: 13 }}>문장을 살펴보는 중…</div>
              ) : askErr ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 18, fontSize: 13, lineHeight: 1.6 }}>{askErr}</div>
              ) : answer ? (
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginTop: 6, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{answer}</div>
              ) : null}
            </div>
          )}
          {mode === 'find' && (<>
          {/* 내 한 문장 검색(#1007, §5.8.8) — 쌓인 문장을 키워드로 즉시 좁힌다. 검색할 문장이 있을 때만 노출.
              #1035 P2: 가시 조건을 현재 필터의 검색 스코프(base, line 74)와 일치시킨다. 전체/책별은 내
              문장(list), 좋아요는 좋아요한 문장(favPool→favCount). 안 맞추면 "좋아요만 ≥1·내 문장 0" 유저가
              전체 탭에서 검색창은 보이는데 스코프(list)가 비어 늘 "검색 결과 없음" 막다른 길이 된다. */}
          {mine !== undefined && (filter === 'fav' ? favCount > 0 : list.length > 0) && (
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="내 문장·감상·책 검색" aria-label="내 한 문장 검색"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', marginBottom: 12, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, outline: 'none' }} />
          )}
          {mine === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20, lineHeight: 1.6 }}>
              {q ? '검색 결과가 없어요' : filter === 'fav' ? (
                <>아직 저장한 문장이 없어요 · 소셜 탭에서 마음에 드는 문장에 <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline',verticalAlign:'middle'}}><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>를 눌러보세요</>
              ) : '아직 한 문장이 없어요'}
            </div>
          ) : filter === 'book' ? (
            Object.keys(byBook).map(title => (
              <div key={title} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>{title} <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>({byBook[title].length})</span></div>
                {byBook[title].map(renderLine)}
              </div>
            ))
          ) : (
            filtered.map(renderLine)
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
window.SentenceCollectionModal = SentenceCollectionModal;
