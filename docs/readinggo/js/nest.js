/* =========================================================
   ReadingGo — nest.js
   둥지 탭(NestView): 책 카드, 체크인 CTA(짹), 내 한 문장, 같은 책 피드 + 책정보 수정(BookEditModal).
   NestTheatre·Ceremony·CompanionModal·OcrCropOverlay는 #761로 별도 모듈 분리, CheckinModal은 #252 폐기 후 제거.
   ========================================================= */
const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo } = React;

// 안전 래퍼 — data.js 전역(nestXpProgress) 미준비/캐시 스큐 시에도 nest 탭 전체 크래시 방지.
// 정상 시 동일 동작, 미정의·예외 시 0(=진행 0%). 근본 원인은 Vite 빌드(해시 자산)로 차단.
function _xpProg(xp) {
  try { return (typeof nestXpProgress === 'function') ? nestXpProgress(xp) : (window.nestXpProgress ? window.nestXpProgress(xp) : 0); }
  catch (e) { return 0; }
}
// 단계 구간 진척 안전 래퍼 (#682) — nestStageProgress 미준비/예외 시 폴백.
function _stageProg(xp) {
  try {
    const fn = (typeof nestStageProgress === 'function') ? nestStageProgress : (window.nestStageProgress || null);
    if (fn) return fn(xp);
  } catch (e) {}
  return { stage: { lv: 1, minXp: 0 }, next: null, intoXp: 0, spanXp: 0, pct: 0, isMax: false };
}
// 현재 주기 누적 XP(0~1599) 안전 래퍼 — nestCycleXp 미준비/예외 시 폴백.
function _cycleXp(xp) {
  try {
    const fn = (typeof nestCycleXp === 'function') ? nestCycleXp : (window.nestCycleXp || null);
    if (fn) return fn(xp);
  } catch (e) {}
  return Math.max(0, (xp || 0)) % 1600;
}
// 절대 기준 진행% (#743) — cycleXp / next.minXp. 표시 숫자(cycleXp / next.minXp)와
// 진행바를 같은 기준으로 일치시킨다(단계-상대 71/500이 아니라 절대 471/900).
function _absPct(xp, sp) {
  if (!sp || sp.isMax || !sp.next || !sp.next.minXp) return 100;
  return Math.max(0, Math.min(100, Math.round(_cycleXp(xp) / sp.next.minXp * 100)));
}
// #871 Vite 회귀 픽스 — ceremony.js·nest-theatre.js 가 cross-file 로 호출(옛 loadBabel 전역). 모듈 스코프라 전역 노출 필요.
window._stageProg = _stageProg; window._cycleXp = _cycleXp; window._absPct = _absPct;

// 마일스톤 회고 선택 (#938, A2) — 이번 체크인이 어떤 마일스톤에 닿았는지 1개만 고른다(절제).
// 우선순위: 완독 > 둥지 성(주기 완료) > 연속 30일 > 연속 7일. value/ubId/bookTitle 은 회고 헤더·타임라인 소스.
// 실제 노출 여부(마일스톤별 1회 + 하루 1회)는 DataStore.milestone.shouldShow 가 결정 — 여기서는 후보 descriptor 만 만든다.
function _pickMilestone({ isComplete, castleGained, newCastles, newStreak, book }) {
  const bk = book || {};
  if (isComplete) return { type: 'complete', ubId: bk.ubId || null, bookId: bk.id || null, bookTitle: bk.title || '', key: 'complete:' + (bk.ubId || bk.id || bk.title || '?') };
  if (castleGained) return { type: 'castle', value: newCastles, key: 'castle:' + newCastles };
  if (newStreak === 30) return { type: 'streak', value: 30, key: 'streak:30' };
  if (newStreak === 7) return { type: 'streak', value: 7, key: 'streak:7' };
  return null;
}

// 한 문장 종류 휴리스틱(estimateSentenceKind, #420) 제거 — '내 생각'(thought) 폐기 (#596). 호출부 없던 죽은 코드.

// 한 문장 초안 임시저장 (#1198) — 미확정(아직 DataStore 미기록) 문장 뭉치를 네비게이션·리로드에도
// 보존해 "부담없이 적어놓고 덮을 때 한번에 기록"을 가능케 한다(양 모드 동일, 로컬 전용).
// 저장소 접근은 DataStore 계약(`drafts` 도메인)에 위임 — 피처 파일은 localStorage 직접 호출 금지.
function _loadDrafts(bookId) {
  try { const d = window.DataStore && window.DataStore.drafts; return d ? d.load(bookId) : ['']; } catch (e) { return ['']; }
}
function _saveDrafts(bookId, arr) {
  try { const d = window.DataStore && window.DataStore.drafts; if (d) d.save(bookId, arr); } catch (e) { /* 초안은 부가 기능 — 실패 무해 */ }
}

/* ── NestView ─────────────────────────────────────────── */

// 책 정보 수정 모달 (#410) — 출판사·총 페이지수 편집. updateBook 후 onSaved(total)로 둥지 진척 즉시 반영.
function BookEditModal({ book, onClose, onSaved }) {
  const [pub, setPub] = _useState((book.pub || book.publisher || '').trim());
  const [total, setTotal] = _useState(String(book.total || 0));
  const save = () => {
    const tp = Math.max(0, parseInt(total, 10) || 0);
    const finish = (ubId) => {
      // 저장 완료 후 서재 목록 갱신 신호(#512) — 데이터층(override 병합)은 정상이나,
      // 다른 책장 변경(app.js)과 달리 이 모달만 'rg:wish-changed'를 안 쏴서 LibraryView 가
      // stale 상태로 남아 출판사·총 페이지 수정이 내 서재에 미반영되던 버그. 신호로 reload 트리거.
      if (ubId && DataStore.myBooks && DataStore.myBooks.updateBook) {
        Promise.resolve(DataStore.myBooks.updateBook(ubId, { publisher: pub.trim(), total_pages: tp }))
          .then(() => { window.dispatchEvent(new CustomEvent('rg:wish-changed')); })
          .catch(() => {});
      } else {
        window.dispatchEvent(new CustomEvent('rg:wish-changed'));
      }
      onSaved && onSaved({ pub: pub.trim(), total: tp });
      showToast('책 정보 수정됨');
      onClose();
    };
    // 활성 책의 user_book id 확보 후 저장.
    Promise.resolve(DataStore.activeBook.get()).then((ub) => finish(ub && ub.id)).catch(() => finish(null));
  };
  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '20px 20px 0 0', padding: '18px 18px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>책 정보 수정</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>출판사</label>
        <input value={pub} onChange={(e) => setPub(e.target.value)} placeholder="출판사"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', margin: '6px 0 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 700 }} />
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>총 페이지수</label>
        <input value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="예: 341"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', margin: '6px 0 16px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 700 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 취소 = 3차 텍스트(DESIGN.md #1032: ghost 투명+보더 금지 → 텍스트만 dismiss) */}
          <button onClick={onClose} style={{ flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>취소</button>
          <button onClick={save} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </div>, document.body);
}

function NestView({ state, onCheckin, onOpenSearch }) {
  const [modalOpen, setModalOpen] = _useState(false);
  // 빠른 입력 (#462) — '읽기 시작' 버튼 없이 홈에서 페이지·한 문장 상시 입력. 타이머는 [⏱시작]으로 선택.
  const [quickPage, setQuickPage] = _useState('');
  // 한 문장 배치 입력 (#1198) — 여러 문장을 초안으로 쌓아 한번에 기록. 초안은 localStorage 임시저장(미확정).
  // drafts[0] = 기존 단일 입력창(OCR·포커스 대상). drafts[1..] = (+)로 추가된 행. 항상 최소 1행.
  const [drafts, setDrafts] = _useState(() => _loadDrafts(state.book.id));
  const [quickSentPage, setQuickSentPage] = _useState('');
  const [sentFlip, setSentFlip] = _useState(false); // 문장 저장 시 일기장 넘기기 효과
  // 빠른입력 OCR (#498) — 책 사진 → quickText 프리필
  const [quickOcrBusy, setQuickOcrBusy] = _useState(false);
  const [quickOcrFile, setQuickOcrFile] = _useState(null);
  const _quickOcrInputRef = _useRef(null);
  const _quickAlbumInputRef = _useRef(null);  // #792 앨범(갤러리) 불러오기 — capture 없는 input
  const _quickSentRef = _useRef(null);        // #1068 빈 상태 CTA → 한 문장 입력창 포커스 타깃
  const [checkedToday, setCheckedToday] = _useState(false); // 오늘 짹 완료 — 읽기모드/체크인 후 중복 CTA 숨김 (#203)
  const [readingBooks, setReadingBooks] = _useState([]);  // 캐러셀용 읽는 중 책 (#185)
  const [bookEditOpen, setBookEditOpen] = _useState(false); // 책 정보 수정 모달 (#410)
  const [ceremony, setCeremony] = _useState(null);
  const [showConfetti, setShowConfetti] = _useState(false);
  // 둥지 단계 = 활성 책 진척률(book.cur/book.total). 체력/days 추적 없음.
  const _pctOf = (bk) => bk && bk.total ? Math.round(bk.cur / bk.total * 100) : 0;
  const [nestState, setNestState] = _useState({
    streak: state.streak,
    xp: state.xp,
    myQuotes: state.myQuotes,
    book: state.book,
    skipStreakRisk: false,   // 데모 '하루 거르기' — 방패 1회 흡수 후 다음 거르기에 스트릭 리셋
  });
  // 직전 진척률 가지 수 — 새 가지 stack 애니메이션 기준.
  const prevTwigsRef = _useRef(twigsForProgress(_xpProg(state.xp)));
  // 마일스톤 회고 대기 (#938, A2) — 세리머니가 닫힌 뒤 띄울 마일스톤(겹침 방지). 게이트(빈도)는 DataStore.milestone.
  const pendingMilestoneRef = _useRef(null);
  // 한 문장 삭제(#1)·종류변경(#381) 이벤트 → 둥지 '내 한 문장' 목록 즉시 반영.
  _useEffect(() => {
    const onRm = (e) => { const id = e && e.detail && e.detail.id; if (!id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).filter((q) => q.id !== id) })); };
    const onKind = (e) => { const d = e && e.detail; if (!d || !d.id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).map((q) => q.id === d.id ? { ...q, kind: d.kind } : q) })); };
    const onNote = (e) => { const d = e && e.detail; if (!d || !d.id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).map((q) => q.id === d.id ? { ...q, note: d.note } : q) })); };
    // 한 문장 본문·페이지 수정 (#683/#731) — '이 책 한 문장' 카드 즉시 반영.
    const onUpd = (e) => { const d = e && e.detail; if (!d || !d.id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).map((q) => q.id === d.id ? { ...q, text: d.text, page: d.page } : q) })); };
    window.addEventListener('rg:sentence-removed', onRm);
    window.addEventListener('rg:sentence-kind', onKind);
    window.addEventListener('rg:sentence-note', onNote);
    window.addEventListener('rg:sentence-updated', onUpd);
    return () => { window.removeEventListener('rg:sentence-removed', onRm); window.removeEventListener('rg:sentence-kind', onKind); window.removeEventListener('rg:sentence-note', onNote); window.removeEventListener('rg:sentence-updated', onUpd); };
  }, []);

  // 활성 책이 바뀌면(또는 마운트) 부모 상태에서 재시드. 둥지(XP 기반)는 유지 — 책과 무관(#313).
  _useEffect(() => {
    prevTwigsRef.current = twigsForProgress(_xpProg(state.xp));
    setNestState({
      streak: state.streak,
      xp: state.xp,
      myQuotes: state.myQuotes,
      book: state.book,
      skipStreakRisk: false,
    });
    setDrafts(_loadDrafts(state.book.id)); // 책 전환 시 그 책의 초안을 복원(#1198)
  }, [state.book.id]);

  // 초안 임시저장 (#1198) — drafts 변경마다 현재 책 키로 영속(리로드·네비게이션 보존).
  _useEffect(() => { _saveDrafts(nestState.book.id, drafts); }, [drafts, nestState.book.id]);
  const _draftCount = drafts.filter((t) => (t || '').trim()).length; // 실내용 있는 초안 수(버튼 라벨·요약)
  const setDraft = (i, v) => setDrafts((d) => d.map((x, j) => (j === i ? v : x)));
  const addDraft = () => setDrafts((d) => [...d, '']);
  const removeDraft = (i) => setDrafts((d) => { const n = d.filter((_, j) => j !== i); return n.length ? n : ['']; });

  // 읽는 중 책 목록 — 활성 책 좌우 리볼빙 전환용 (#185)
  _useEffect(() => {
    if (!(DataStore.myBooks && DataStore.myBooks.list)) return;
    Promise.resolve(DataStore.myBooks.list()).then((rows) => {
      setReadingBooks((rows || []).filter((r) => (r.status || 'reading') === 'reading').map((r) => ({
        id: r.book_id || (r.book && r.book.id) || r.id, ubId: r.id,
        title: (r.book && r.book.title) || r.title || '', author: (r.book && r.book.author) || r.author || '',
        pub: (r.book && r.book.publisher) || '', cur: r.current_page || r.cur || 0,
        total: (r.book && r.book.total_pages) || r.total || 0,   // #1117: 미상은 0(가짜 1p 금지) — 소비처가 total>0 가드
        cover: (r.book && r.book.cover_url) || r.cover || '', fb: ['#9AA7B2', '#C7D0D8'],
      })));
    }).catch(() => {});
  }, [state.book.id]);
  const switchBook = (dir) => {
    if (!readingBooks || readingBooks.length < 2) { showToast('읽는 중인 책이 하나예요'); return; }
    const idx = readingBooks.findIndex((b) => b.id === nestState.book.id);
    const ni = ((idx < 0 ? 0 : idx) + dir + readingBooks.length) % readingBooks.length;
    if (window.RG_activateBook) window.RG_activateBook(readingBooks[ni]);
  };
  // 활성 책 좌우 스와이프 전환 (#1001) — 버튼(switchBook) 외 제스처 추가(대체 아님, 접근성 유지).
  // Pointer Events 통합(터치+데스크탑 드래그). 가로 우세(|dx|>|dy|)일 때만 발동 → 세로 스크롤 통과.
  // 임계 SWIPE_PX 넘으면 switchBook(밀기 방향: ←=다음+1, →=이전-1; 버튼·내용 따라가기와 일치).
  const _cardRef = _useRef(null);
  const _swipe = _useRef({ id: null, x0: 0, y0: 0, dx: 0, locked: null, dragged: false });
  const SWIPE_PX = 45;   // 전환 임계
  const SWIPE_SLOP = 8;  // 방향 판정 시작 전 무시 구간(탭 오발동 방지)
  const _swipeEnabled = readingBooks.length > 1;  // 1권 이하면 제스처 no-op
  const _setCardX = (px, animate) => {
    const el = _cardRef.current; if (!el) return;
    el.style.transition = animate ? 'transform .2s ease-in-out' : 'none';
    el.style.transform = px ? `translateX(${px}px)` : '';
  };
  const _onSwipeDown = (e) => {
    if (!_swipeEnabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = _swipe.current;
    s.id = e.pointerId; s.x0 = e.clientX; s.y0 = e.clientY; s.dx = 0; s.locked = null; s.dragged = false;
  };
  const _onSwipeMove = (e) => {
    const s = _swipe.current; if (s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (s.locked === null) {
      if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';  // 세로 우세면 'y'로 잠가 제스처 포기(스크롤 통과)
      if (s.locked === 'x') { try { _cardRef.current && _cardRef.current.setPointerCapture(e.pointerId); } catch (_) {} }
    }
    if (s.locked !== 'x') return;
    if (e.cancelable) e.preventDefault();  // 가로 제스처 확정 후에만 스크롤 억제
    s.dragged = true; s.dx = dx;
    _setCardX(dx * 0.6, false);  // 저항감(rubber-band) — 카드가 손가락을 따라가되 절제
  };
  const _onSwipeEnd = (e) => {
    const s = _swipe.current; if (s.id !== e.pointerId) return;
    const committed = s.locked === 'x' && Math.abs(s.dx) >= SWIPE_PX;
    const dir = s.dx < 0 ? 1 : -1;  // 왼쪽으로 밀기(dx<0)=다음, 오른쪽=이전
    try { _cardRef.current && _cardRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
    _setCardX(0, true);  // 항상 원위치로 스냅(전환 후 새 책은 transform 0에서 다시 그려짐)
    s.id = null; s.locked = null;
    if (committed) switchBook(dir);  // 끝 책 바운스/순환은 switchBook(모듈러)과 일치
  };
  // 드래그가 실제로 일어났으면 카드 탭(책 상세 열기)을 1회 억제 — 스와이프와 탭 분리.
  const _swallowClickIfDragged = (e) => {
    if (_swipe.current.dragged) { e.preventDefault(); e.stopPropagation(); _swipe.current.dragged = false; return true; }
    return false;
  };
  // 시간차 되감기 (#346, resurface.md) — 둥지 진입 시 백그라운드 체크, 1일 1회, 비침습 카드.
  const [resurfaceCard, setResurfaceCard] = _useState(null);
  _useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!(DataStore.resurface && DataStore.sentences && DataStore.sentences.resurfaceCandidate)) return;
        if (DataStore.resurface.shownToday()) return;
        const cand = await Promise.resolve(DataStore.sentences.resurfaceCandidate());
        if (!alive || !cand) return;
        setResurfaceCard(cand);
        DataStore.resurface.markToday(); // 노출 시점에 1일 1회 마킹 (§2.1)
        rgTrack('resurface_shown', { sentence_id: cand.id, days: cand.daysAgo });
      } catch (e) { /* 넛지 실패는 조용히 */ }
    })();
    return () => { alive = false; };
  }, []);
  const resurfaceTalk = () => {
    if (!resurfaceCard) return;
    rgTrack('resurface_answered', { sentence_id: resurfaceCard.id, days: resurfaceCard.daysAgo });
    try { Promise.resolve(DataStore.sentences.markResurfaced(resurfaceCard.id)).catch(() => {}); } catch (e) {}
    if (window.RG_openCompanion) window.RG_openCompanion({ id: resurfaceCard.id, text: resurfaceCard.text, bookId: resurfaceCard.bookId, bookTitle: resurfaceCard.bookTitle, page: resurfaceCard.page, note: resurfaceCard.note, kind: resurfaceCard.kind });
    setResurfaceCard(null);
  };
  const resurfaceLater = () => {
    if (!resurfaceCard) return;
    rgTrack('resurface_skipped', { sentence_id: resurfaceCard.id });
    setResurfaceCard(null); // 오늘 하루 숨김 — markToday 는 노출 시 이미 기록
  };

  // 스트릭 복구·유예 (#938, A1) — 둥지 진입 시 깨진 스트릭이 복구 가능하면 '하루 만회' 카드를 1회 노출.
  // 좌절 이탈 방지(코어 감정 '고양감' 보호). 점수·미션 추가 아님 — 기존 스트릭 관용. 주 1회 제한은 datastore SSOT(_streakRepairStatus).
  const [repairCard, setRepairCard] = _useState(null); // { lostStreak, brokenDays }
  _useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!(DataStore.streak && DataStore.streak.repairStatus)) return;
        const st = await Promise.resolve(DataStore.streak.repairStatus());
        if (!alive || !st || !st.canRepair) return;
        setRepairCard({ lostStreak: st.lostStreak, brokenDays: st.brokenDays });
        rgTrack('streak_repair_shown', { lost: st.lostStreak, broken_days: st.brokenDays });
      } catch (e) { /* 복구 넛지 실패는 조용히 */ }
    })();
    return () => { alive = false; };
  }, []);
  const doRepairStreak = async () => {
    if (!repairCard) return;
    try {
      const res = await Promise.resolve(DataStore.streak.repair());
      if (res && res.ok) {
        const restored = res.lostStreak || repairCard.lostStreak || 0;
        // 낙관적 표시 갱신 + 상위(app)·캘린더 정합 신호. 오늘 한 줄 기록하면 +1 로 자연스럽게 이어진다.
        setNestState((ns) => ({ ...ns, streak: restored }));
        try { window.dispatchEvent(new CustomEvent('rg:streak-repaired', { detail: { streak: restored } })); } catch (e) {}
        rgTrack('streak_repaired', { restored });
        showToast(`${restored}일 연속을 되살렸어요 — 오늘 한 줄로 이어가요`);
      } else {
        const days = (res && res.cooldownDays) || 0;
        showToast(days > 0 ? `이번 주 만회는 이미 썼어요 — ${days}일 뒤 다시 가능해요` : '지금은 만회할 수 없어요');
      }
    } catch (e) {
      showToast('만회에 실패했어요 — 잠시 후 다시 시도해요');
    }
    setRepairCard(null);
  };
  const dismissRepair = () => {
    if (repairCard) rgTrack('streak_repair_skipped', { lost: repairCard.lostStreak });
    setRepairCard(null); // 이번 진입 동안만 숨김 — 다음 진입 때 아직 복구 가능하면 다시 권유(주 1회는 datastore가 강제)
  };

  const handleCheckin = ({ page, sentence, kind, sentPage, sentences }) => {
    setModalOpen(false);
    setCheckedToday(true); // 오늘의 짹 완료 (#203)
    const ns = { ...nestState };
    const pagesAdded = Math.max(0, page - ns.book.cur);
    // 스트릭은 실제 마지막 기록일 기준으로 계산(#927). 종전 `ns.streak += 1`(맹목 증가)은
    // 며칠 건너뛴 뒤에도 +1 해 세리머니에 부풀린 값을 띄우고, 그 값으로 7/30일 스트릭 XP를
    // 잘못 지급·영속했다. DataStore.streak 규칙(systems.md §6.1, bumpOnCheckIn)과 동일한
    // 순수 함수 _nextStreak 로 같은 값을 미리 계산해 세리머니·XP가 영속값과 일치하게 한다.
    let prevStreak = ns.streak || 0, lastCheckIn = null;
    try {
      const st = (window.DataStore && DataStore.streak && DataStore.streak.get) ? DataStore.streak.get() : null;
      if (st && typeof st.current === 'number') prevStreak = st.current; // get()이 끊긴 스트릭은 0으로 정상화
      if (st && st.last_check_in_date) lastCheckIn = st.last_check_in_date;
    } catch (e) {}
    const today = (window._today ? _today() : new Date().toISOString().slice(0, 10));
    const newStreak = (window._nextStreak ? _nextStreak(prevStreak, lastCheckIn, today) : prevStreak + 1);
    const wasReset = newStreak === 1 && prevStreak !== 0; // 공백으로 1로 떨어진 진짜 리셋(첫 기록 제외)
    const prevPct = _pctOf(ns.book);            // 책 진척(완독 판정용)
    const prevXp = ns.xp;
    const prevLv = getNestStageByXp(prevXp).lv; // 둥지 단계 = 현재 주기 XP (#520)
    const prevCastles = nestCastleCount(prevXp); // 성 개수 = floor(totalXp/1600) (#520/#521)

    ns.book = { ...ns.book, cur: page };
    ns.streak = newStreak;
    ns.skipStreakRisk = false;

    const newPct = _pctOf(ns.book);
    // 완독: 마지막 장 도달 (이번 체크인에 100% 처음 도달).
    const isComplete = newPct >= 100 && prevPct < 100;

    // XP — systems.md §6.3 SSOT. 둥지 단계도 이 XP 누적에 연동(#313). 차감 없음.
    const xpReward = computeCheckinXp({ isNewDay: true, isComplete, newStreak: ns.streak });
    const xpGain = xpReward.total;
    ns.xp += xpGain;

    const newLv = getNestStageByXp(ns.xp).lv;   // XP 증가 후 둥지 단계
    const nestUp = newLv > prevLv;
    const newCastles = nestCastleCount(ns.xp);
    const castleGained = newCastles > prevCastles; // 1,600 XP 경계 통과 → 성 획득(#520/#521)

    // #1202: 흔적은 문장 고유 페이지(sentPage)를 그대로 — 현재 진도(cur)보다 낮아도 입력값 그대로.
    const quotePage = (typeof sentPage === 'number') ? sentPage : page;
    // 배치 초안(#1198) — 여러 문장이면 낙관적으로 모두 흔적 상단에 추가(공유 페이지 각 행에 적용).
    const batch = Array.isArray(sentences) ? sentences.filter((s) => s && s.text && String(s.text).trim()) : null;
    const sentenceCount = (batch && batch.length) ? batch.length : (sentence ? 1 : 0);
    if (batch && batch.length) {
      const rows = batch.map((s) => ({ text: String(s.text).trim(), bookId: ns.book.id, bookTitle: ns.book.title || '', page: (typeof s.page === 'number') ? s.page : quotePage, when: '방금', kind: kind || 'quote' }));   /* #1224: bookTitle 동봉 — 게스트 책은 getBook 미해소라 흔적 카드가 '책' 폴백 */
      ns.myQuotes = [...rows, ...ns.myQuotes];
    } else if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, bookTitle: ns.book.title || '', page: quotePage, when: '방금', kind: kind || 'quote' }, ...ns.myQuotes];
    }

    prevTwigsRef.current = twigsForProgress(_xpProg(prevXp));
    setNestState(ns);
    onCheckin(ns, newLv, xpGain, sentence, kind, quotePage, batch); // batch 있으면 app 이 N개 문장 영속(#1198)
    if (window.rgTrack) window.rgTrack('reading_session_end', { book_id: ns.book.id, pages_logged: pagesAdded, is_complete: isComplete }); // 인게이지먼트/리텐션 (#736)

    // 성 획득(1,600 주기 완료)은 단계 toast보다 우선 — 경계 통과 시 둥지 단계는 Lv4→Lv1로
    // 리셋되어 nestUp=false 이므로, 성 획득은 별도로 안내한다 (#520/#521).
    if (castleGained) {
      showToast(`🏰 전설의 참새 성주! ${newCastles}번째 성을 완성했어요`);
    } else if (nestUp) {
      const copy = getEvolutionCopy(prevLv, newLv);
      if (copy) showToast(`${getNestStageByXp(ns.xp).short} ${copy}`);
    }

    // 마일스톤 회고 (#938, A2) — 완독·연속 7/30일·둥지 성에서만, 절제해서. 세리머니가 닫힌 뒤 1개만 띄운다(겹침 방지).
    // 빈도 게이트(마일스톤별 1회 + 하루 1회)는 DataStore.milestone 이 강제. 점수·미션 아님 — 기존 한 문장 자산으로 서사 증폭.
    pendingMilestoneRef.current = _pickMilestone({ isComplete, castleGained, newCastles, newStreak: ns.streak, book: ns.book });

    // 이 책에서 모은 한 문장 수 (#549) — 세리머니가 거짓 '저장됨' 대신 정직한 누적/독려 표시.
    const bookQuoteCount = (ns.myQuotes || []).filter(q => q.bookId === ns.book.id).length;
    setCeremony({ xpGain, xpParts: xpReward.parts, streak: ns.streak, sentence, sentenceCount, bookQuoteCount, nestUp, castleGained, castleCount: newCastles, prevLv, newLv, prevXp, newXp: ns.xp, pagesAdded, isNewDay: true, wasReset, isComplete });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  };

  // 빠른 기록 (#462) — 홈 상시 입력 폼에서 페이지/한 문장을 한 번에 체크인.
  // handleCheckin 단일 경로 재사용 → 스트릭·XP·세리머니·문장 영속(app onCheckin)·companion(#438) 보존.
  // 빠른입력 OCR (#498) — Upstage OCR + solar-pro3 → quickText 프리필(원하는 부분만 남기고 저장).
  // 공유 헬퍼 window.ocrExtractSentence(data.js) 로 OCR 호출(#939). 토스트·busy·tracking 은 여기서.
  const runOcrQuick = (file) => {
    if (!file || quickOcrBusy) return;
    if (file.size > 8 * 1024 * 1024) { showToast('이미지가 너무 커요(최대 8MB)'); return; }
    setQuickOcrBusy(true); // 스피너 오버레이(#1201)가 진행 피드백 — 시작 토스트 불필요(중복 제거)
    Promise.resolve((window.ocrExtractSentence ? window.ocrExtractSentence(file) : Promise.resolve({ text: '', error: 'unavailable' })))
      .then((d) => {
        if (d && d.text) {
          // OCR 추출문은 첫 초안(drafts[0])에 이어붙인다 — 기존 단일 입력창 동작 보존(#1198).
          setDrafts((arr) => { const copy = arr.slice(); const cur = copy[0] || ''; copy[0] = (cur.trim() ? cur.trim() + '\n' + d.text : d.text).slice(0, 1000); return copy; });
          showToast('추출했어요 — 원하는 부분만 남기고 저장하세요');
          rgTrack('ocr_extracted', { book_id: nestState.book.id, chars: d.text.length });
        } else if (d && d.empty) {
          showToast('글자를 찾지 못했어요 — 더 또렷한 사진으로');
        } else if (d && d.error === 'network') {
          showToast('추출 실패 — 네트워크를 확인해요');
        } else {
          showToast('추출 실패 — 잠시 후 다시 시도해요');
        }
      })
      .finally(() => setQuickOcrBusy(false));
  };

  // 입력 페이지 정규화 (#1203) — 1..total 로만 클램프. 현재 쪽보다 낮아도 허용(재독) — current_page 를 그 값으로 덮어씀.
  const _quickTargetPage = () => {
    const total = nestState.book.total || 0;
    const cur = nestState.book.cur || 0;
    const raw = quickPage === '' ? cur : (parseInt(quickPage, 10) || 0);
    const p = raw < 1 ? 1 : raw;
    return total ? Math.min(total, p) : p;
  };
  // 페이지 섹션 [업데이트] (#497) — 페이지만 독립 저장. 문장 입력(quickText)은 보존.
  const submitPage = () => {
    if (quickPage === '') { showToast('쪽수를 입력해주세요'); return; }
    const p = _quickTargetPage();
    handleCheckin({ page: p, sentence: null, kind: 'quote' });
    setQuickPage(''); // quickText 보존 — 페이지만 업데이트해도 문장 입력창 유지
  };
  // 한 문장 섹션 [저장/한번에 기록] (#497·#1198) — 초안(drafts) 1개면 단일 저장(기존 경로 그대로),
  //   2개 이상이면 배치로 한번에 기록(세리머니·스트릭·XP는 1회, 문장만 N개 영속).
  const submitSentence = () => {
    const texts = drafts.map((t) => (t || '').trim()).filter(Boolean);
    if (!texts.length) { showToast('한 문장을 입력해주세요'); return; }
    // #589/#1202: 한 문장 전용/공유 페이지(quickSentPage = 덮을 때의 쪽). 비우면 현재 진도.
    // 입력한 쪽 그대로 문장에 저장 — 현재 쪽보다 낮아도(앞부분 발췌·재독) 1..total 로만 클램프.
    const cur = nestState.book.cur || 0, total = nestState.book.total || 0;
    let sp = quickSentPage === '' ? cur : (parseInt(quickSentPage, 10) || cur);
    if (sp < 1) sp = 1;
    if (total) sp = Math.min(total, sp);
    // 진도(current_page)는 문장 저장으로 뒤로 밀지 않음 — 문장이 앞쪽이면 현재 유지, 뒤쪽이면 따라 올림.
    const progressPage = Math.max(cur, sp);
    if (texts.length === 1) {
      handleCheckin({ page: progressPage, sentence: texts[0], kind: 'quote', sentPage: sp });
    } else {
      // 배치: 공유 페이지(sp)를 모든 문장에 적용. 세리머니는 1회(§5.4.2).
      handleCheckin({ page: progressPage, sentences: texts.map((t) => ({ text: t, page: sp })), kind: 'quote', sentPage: sp });
    }
    setDrafts(['']); setQuickSentPage(''); // 확정 후 초안·임시저장 비움
  };
  // 쪽수 stepper (#717) — 빈 값이면 현재 쪽 기준 ±delta, [0, total] 클램프.
  // type="number" 네이티브 스피너가 빈 값(=0)에서 증감해 0으로 점프하던 버그 대체.
  const _stepPage = (setter, delta) => {
    const cur = nestState.book.cur || 0, total = nestState.book.total || 0;
    setter(prev => {
      const base = prev === '' ? cur : (parseInt(prev, 10) || cur);
      let n = base + delta;
      if (n < 0) n = 0;
      if (total) n = Math.min(total, n);
      return String(n);
    });
  };
  const _stepBtn = { width: 30, height: 30, flexShrink: 0, borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--paper)', color: 'var(--ink-2)', fontSize: 20, fontWeight: 800, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
  const _stepBtnSm = { width: 24, height: 24, flexShrink: 0, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink-2)', fontSize: 15, fontWeight: 800, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

  // 완독 세리머니에서 받은 별점/소감을 영속 (§5.8.3).
  // 활성 책의 user_book 을 status='completed' + rating/review_text 로 마감.
  const handleComplete = ({ rating, review_text }) => {
    // 양 어댑터 정규화(activeBook.get/books.complete 동기/비동기 공통).
    (async () => {
      try {
        const ub = await Promise.resolve(DataStore.activeBook.get());
        if (ub && ub.id) await Promise.resolve(DataStore.books.complete(ub.id, { rating, review_text }));
      } catch (e) {
        console.warn('[nest] 완독 기록 저장 실패:', (e && e.message) || e);
      }
    })();
    showToast('🏰 성 컬렉션에 기록이 남았어요!');
  };

  // 세리머니 닫힘 → 대기 중 마일스톤 회고를 게이트 통과 시 1개 띄움 (#938, A2).
  // 세리머니와 겹치지 않게 닫은 뒤 약간의 텀을 두고 연다. 게이트(마일스톤별 1회·하루 1회)는 DataStore.milestone.
  const closeCeremony = () => {
    setCeremony(null);
    const m = pendingMilestoneRef.current;
    pendingMilestoneRef.current = null;
    if (!m || !m.key) return;
    try {
      const gate = window.DataStore && DataStore.milestone;
      if (!gate || !gate.shouldShow || !gate.shouldShow(m.key)) return; // 빈도 절제 — 이미 봤거나 오늘 이미 1회
      gate.markShown(m.key);
      rgTrack('milestone_recap_shown', { type: m.type, value: m.value || 0 });
      setTimeout(() => { if (window.RG_openMilestoneRecap) window.RG_openMilestoneRecap(m); }, 280);
    } catch (e) { /* 회고는 부가 연출 — 실패해도 본 흐름 무중단 */ }
  };

  // 이 책 한 문장 (#499) — 현재 책의 전체 기간 최신순(오늘만 아님). 오늘 작성분은 '오늘' 라벨.
  const bookQuotes = (nestState.myQuotes || [])
    .filter((q) => q.bookId === nestState.book.id)   // 현재 선택한 책만
    .slice()
    .sort((a, b) => {
      // 페이지 내림차순(#737) — 미상(null)은 맨 아래, 동일 페이지는 최신순.
      // 파생값이라 수정으로 page 변경 시 자동 재정렬(순서 꼬임 방지).
      const pa = (typeof a.page === 'number') ? a.page : -Infinity;
      const pb = (typeof b.page === 'number') ? b.page : -Infinity;
      if (pb !== pa) return pb - pa;
      const rank = (q) => (q.when === '방금' ? 'ZZZZ-99' : String(q.createdAt || q.when || ''));
      return rank(b).localeCompare(rank(a));  // 동일 페이지는 최신순
    });
  // #1068 빈 상태(이 책 0문장) CTA — 위 '한 문장' 입력창으로 스크롤 + 포커스해 '짹'(문장 남기기) 진입을 단순화.
  const focusSentenceInput = () => {
    const el = _quickSentRef.current;
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    setTimeout(() => { try { el.focus(); } catch (e) { /* 포커스 실패 무해 */ } }, 320);
  };
  // 좋아요(❤️ = claps) 상태 — claps.list 로 favIds 로드 (#499→#641: 자기 문장 좋아요=저장 단일화)
  const [favIds, setFavIds] = _useState(() => new Set());
  _useEffect(() => {
    let alive = true;
    Promise.resolve((DataStore.claps && DataStore.claps.list) ? DataStore.claps.list() : [])
      .then((rows) => { if (alive) setFavIds(new Set((rows || []).map((b) => b.sentence_id))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [nestState.book.id, (nestState.myQuotes || []).length]);
  // #610: 자체 좋아요/삭제 핸들러 폐기 → 공용 SentenceActions 가 담당(아래 '이 책 한 문장' 카드).
  //   favIds 는 SentenceActions fav 초기값 시드용으로만 유지(claps.list 로 로드).

  // 이 책의 다른 한 문장 (#926, 콜드스타트 사회적 증거) — 내 문장 < 3개일 때만 타인 공개 문장을
  //   좋아요순으로 노출(읽기전용). 책 정보 모달(book-info-modal.js)의 '이 책의 한 문장' 섹션을 미러:
  //   byBook(타인 전용·비UUID/게스트→[]) + SentenceCard(noBlind, 짹·대화 없음). 내 문장이 쌓이면(≥3)
  //   자동 소멸 → 콜드스타트 홈 밀도 보호. 0건+시드 미충전이면 섹션 통째 생략(빈 섹션 금지).
  const _coldStart = bookQuotes.length < 3;
  const [othersQuotes, setOthersQuotes] = _useState([]); // 타인 공개 문장(좋아요순 ~8건), 게스트/빈 → []
  const [othersResolved, setOthersResolved] = _useState(false); // byBook 응답 도착 여부(시드 트리거 게이트, #774)
  const [othersSeeding, setOthersSeeding] = _useState(false); // 마중물 시드 큐 처리 대기(#774) — '모으는 중' placeholder 게이트
  _useEffect(() => {
    if (!_coldStart) { setOthersQuotes([]); setOthersResolved(false); setOthersSeeding(false); return; }
    let alive = true;
    setOthersResolved(false);
    Promise.resolve((DataStore.sentences && DataStore.sentences.byBook) ? DataStore.sentences.byBook(nestState.book.id, { limit: 8, sort: 'likes' }) : [])
      .then((rows) => { if (alive) { setOthersQuotes(Array.isArray(rows) ? rows : []); setOthersResolved(true); } })
      .catch(() => { if (alive) { setOthersQuotes([]); setOthersResolved(true); } });
    return () => { alive = false; };
  }, [nestState.book.id, _coldStart]);
  // 마중물 시드 (#774, 큐 방식) — 타인 문장이 0건(빈 책)이면 /api/seed 로 큐잉 트리거 후 byBook 을 짧게 폴링.
  //   collector(맥미니)가 예스24 발췌를 여러 NPC 명의로 적재하면 폴링이 잡아 노출(book-info-modal.js 동일 패턴).
  //   deps 는 othersResolved/_coldStart 만 — 폴링이 setOthersQuotes 로 갱신하므로 결과를 deps 에 넣으면 무한 재실행.
  _useEffect(() => {
    if (!_coldStart || !othersResolved || othersQuotes.length > 0 || !nestState.book.title) { setOthersSeeding(false); return; }
    let alive = true;
    let timer = null;
    setOthersSeeding(true);
    window.RG_apiFetch('/api/seed', { method: 'POST', rgQuiet: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: nestState.book.title, author: nestState.book.author || '', isbn: nestState.book.isbn || '', have: 0 }) }).catch(() => {});
    const MAX = 5, DELAY = 4000;
    let tries = 0;
    const poll = () => {
      if (!alive) return;
      tries += 1;
      Promise.resolve((DataStore.sentences && DataStore.sentences.byBook) ? DataStore.sentences.byBook(nestState.book.id, { limit: 8, sort: 'likes' }) : [])
        .then((rows) => {
          if (!alive) return;
          if (Array.isArray(rows) && rows.length) { setOthersQuotes(rows); setOthersSeeding(false); return; }
          if (tries < MAX) timer = setTimeout(poll, DELAY); else setOthersSeeding(false);
        })
        .catch(() => { if (alive) { if (tries < MAX) timer = setTimeout(poll, DELAY); else setOthersSeeding(false); } });
    };
    timer = setTimeout(poll, DELAY);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [nestState.book.id, _coldStart, othersResolved]);

  // 활성 책 없음(신규/미등록): 데모책 대신 '책 등록' 온보딩 — 유령 책 체크인(영속 실패) 방지.
  if (!nestState.book || !nestState.book.id) {
    return (
      <section className="view active">
        <div className="card book-card-wrap">
          {/* '내 서재' 버튼 제거 (#410) — 하단 탭바로 충분. 책 없으면 ⚙️도 없음. */}
          <div style={{ padding: '34px 22px 26px', textAlign: 'center' }}>
            {/* 새 둘레 헤일로 — 따뜻한 포커스(#1056) */}
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle, #EAF6EF 0%, #EAF6EF 55%, rgba(234,246,239,0) 72%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <window.SparrowMark size={60} />
              </div>
            </div>
            {/* 온보딩 승격(#1134): 부정문("없어요") → 약속 선언 + 기능 예고 3줄.
                스토어 유입은 앱의 약속을 모른 채 이 화면을 만난다 — 둥지·재키·타인 문장의 존재를
                등록 전에 알린다. §A 슬라이드 없음 원칙 유지: 화면 추가 없이 이 카드 하나만 승격. */}
            <div style={{ fontWeight: 900, fontSize: 19, color: 'var(--ink)', marginBottom: 14 }}>하루 한 쪽, 한 문장이면 돼요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', maxWidth: 290, margin: '0 auto 20px' }}>
              {[
                { icon: 'pen', text: <>오늘 읽은 자리의 한 줄을 남기면<br /><b>둥지가 자라요</b></> },
                { icon: 'chat', text: <>문장마다 <b>재키</b>가 말을 걸어요<br />— AI 독서 파트너</> },
                { icon: 'users', text: <>같은 책을 읽는 사람의 <b>한 문장</b>을 만나요</> },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: 'var(--brand-tint)', color: 'var(--brand-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.rgIcon(f.icon, 15)}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, paddingTop: 4, wordBreak: 'keep-all' }}>{f.text}</span>
                </div>
              ))}
            </div>
            {/* 📖 이모지 → Feather 펼친 책 아이콘(탭바와 동일 결, #1056). 공개읽기 토글 제거 — 온보딩 단순화(숲 탭에 유지). */}
            <button className="checkin-cta" onClick={onOpenSearch} style={{ display: 'inline-flex', width: 'auto', padding: '15px 26px', fontSize: 16 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              읽을 책 등록하기
            </button>
            {/* 등록 마찰 제거 어필(#1134) — 사진(OCR)·바코드 경로 예고 */}
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>책 사진 한 장·바코드로도 등록돼요</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="view active">
      {/* 활성 책 카드 — 좌우 리볼빙으로 활성 책 전환 (#185). 버튼 + 스와이프 제스처(#1001).
          touchAction 'pan-y' = 세로 스크롤은 브라우저, 가로는 우리가 처리(세로 충돌 방지). */}
      <div className="card book-card-wrap" style={{ position: 'relative', touchAction: _swipeEnabled ? 'pan-y' : 'auto' }}
        onPointerDown={_onSwipeDown} onPointerMove={_onSwipeMove} onPointerUp={_onSwipeEnd} onPointerCancel={_onSwipeEnd}>
        {readingBooks.length > 1 && (
          <>
            <button onClick={() => switchBook(-1)} aria-label="이전 책" style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>‹</button>
            <button onClick={() => switchBook(1)} aria-label="다음 책" style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>›</button>
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4, zIndex: 3 }}>
              {readingBooks.map((b, i) => <span key={b.id || i} style={{ width: 5, height: 5, borderRadius: '50%', background: b.id === nestState.book.id ? 'var(--brand)' : 'var(--line-2, #ccc)' }} />)}
            </div>
          </>
        )}
        {/* 책 정보 탭 → 책 상세 모달(BookInfoModal) 진입 (#495). ⚙️ 수정 버튼은 stopPropagation으로 격리.
            ref=_cardRef: 스와이프 중 이 카드만 translateX(화살표·점은 wrap 기준 고정, #1001). */}
        <div className="book-card" ref={_cardRef} role="button" tabIndex={0} aria-label="책 상세 정보 보기"
          style={{ cursor: (nestState.book.id && window.RG_openBook) ? 'pointer' : 'default', willChange: 'transform' }}
          onClick={(e) => { if (_swallowClickIfDragged(e)) return; if (nestState.book.id && window.RG_openBook) window.RG_openBook(nestState.book.id); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && nestState.book.id && window.RG_openBook) { e.preventDefault(); window.RG_openBook(nestState.book.id); } }}>
          <BookCover className="book-cover" title={nestState.book.title} author={nestState.book.author} cover={nestState.book.cover} fb={nestState.book.fb} />
          <div className="book-meta">
            <div className="book-title-row">
              <p className="book-title">{nestState.book.title}</p>
              {/* 책 정보 수정 (#410) — 제목과 같은 행에서 현재 책 편집 맥락을 명확히 표시. */}
              <button className="book-jump" onClick={(e) => { e.stopPropagation(); setBookEditOpen(true); }} title="책 정보 수정" aria-label="책 정보 수정">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
            <p className="book-author">{[nestState.book.author, nestState.book.pub].map(x => (x || '').trim()).filter(Boolean).join(' · ')}</p>
            <div className="book-progress-row">
              <div className="book-progress">
                <span style={{width: (nestState.book.total > 0 ? Math.min(100, Math.round(nestState.book.cur / nestState.book.total * 100)) : 0) + '%'}} />
              </div>
              {/* #1117: 쪽수 미상(total=0)이면 "/ Np" 대신 현재 쪽만 — 가짜 "/ 1p"·100% 방지 */}
              <span className="book-progress-num">{nestState.book.total > 0 ? `${nestState.book.cur} / ${nestState.book.total}p` : `${nestState.book.cur}p`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 둥지 시어터(NestTheatre)는 프로필 상단으로 이동 (#428) — 홈은 책읽기 중심 */}

      {/* 데모 '하루 거르기' 제거 (#481) */}

      {/* 스트릭 복구·유예 — '하루 만회' (#938, A1). 깨진 스트릭이 복구 가능할 때만. 좌절 이탈 방지(고양감 보호).
          버튼 위계(DESIGN.md): 1차 솔리드(만회) 1개 + 3차 텍스트(괜찮아요). 점수·미션 아님 — 기존 스트릭 관용. */}
      {repairCard && (
        <div style={{ marginTop: 10, background: 'var(--brand-tint)', border: '1.5px solid var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🔥</span>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>
              {repairCard.lostStreak}일 연속이 끊길 뻔했어요
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 12 }}>
            {repairCard.brokenDays >= 2 ? `${repairCard.brokenDays}일 쉬어갔지만 ` : '하루 놓쳤지만 '}
            괜찮아요. 한 번 만회해서 그동안 쌓은 흐름을 이어가요. <span style={{ color: 'var(--ink-3)' }}>(주 1회)</span>
          </div>
          <button className="checkin-cta" onClick={doRepairStreak}
            style={{ width: '100%', marginBottom: 6 }}>
            🔥 하루 만회하고 이어가기
          </button>
          <button onClick={dismissRepair}
            style={{ display: 'block', width: '100%', padding: '8px 0', background: 'none', border: 'none', color: 'var(--ink-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            괜찮아요, 새로 시작할게요
          </button>
        </div>
      )}

      {/* 진도 섹션 */}
      <div style={{ marginTop: 10, background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>오늘은 어디까지 읽으셨나요?</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => _stepPage(setQuickPage, -1)} aria-label="쪽수 1 줄이기" style={_stepBtn}>−</button>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={quickPage} placeholder={String(nestState.book.cur||0)}
              className="rg-noscale-input"
              onChange={e => setQuickPage(e.target.value.replace(/[^0-9]/g, ''))}
              style={{ width: 60, textAlign: 'center', fontSize: 26, fontWeight: 900, color: 'var(--ink)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--brand)', outline: 'none', padding: '0 4px 2px', fontFamily: 'inherit' }} />
            <button onClick={() => _stepPage(setQuickPage, 1)} aria-label="쪽수 1 늘리기" style={_stepBtn}>+</button>
          </span>
          {nestState.book.total > 0
            ? <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700 }}>/ {nestState.book.total}p</span>
            : <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700 }}>p</span>}
          {nestState.book.total > 0 && (
            <span style={{ fontSize: 12, color: 'var(--brand-3)', fontWeight: 800, background: 'var(--brand-tint)', borderRadius: 999, padding: '3px 10px' }}>
              {Math.min(100, Math.round((parseInt(quickPage,10)||nestState.book.cur||0) / nestState.book.total * 100))}%
            </span>
          )}
          <button onClick={submitPage}
            style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: 999, background: 'var(--brand)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', flexShrink: 0, letterSpacing: '-0.2px' }}>
            저장하기
          </button>
        </div>
      </div>

      {/* 한 문장 입력 */}
      <div style={{ marginTop: 8, background: 'var(--card)', border: '1.5px solid var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '14px 14px 12px', position: 'relative', transition: 'opacity 0.2s, transform 0.3s', opacity: sentFlip ? 0 : 1, transform: sentFlip ? 'translateY(-10px) scale(0.97)' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>마음에 남은 문장이 있나요?</div>
        {/* OCR(사진 입력)은 하단 툴바의 카메라 아이콘 버튼으로 이동 — '···' 메뉴 제거(2026 UI). */}
        {/* 초안 행들(#1198) — drafts[0]=기존 입력창(OCR·포커스), drafts[1..]=(+)로 추가·× 삭제. 임시저장 상태. */}
        {drafts.map((d, i) => (
          i === 0 ? (
            <textarea key="d0" ref={_quickSentRef} value={d} onChange={(e) => { if (e.target.value.length > 1000) return; setDraft(0, e.target.value); }}
              placeholder="오늘 읽은 문장을 남겨요…" rows={4}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', resize: 'none', padding: 0, fontFamily: 'inherit' }} />
          ) : (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <textarea value={d} onChange={(e) => { if (e.target.value.length > 1000) return; setDraft(i, e.target.value); }}
                placeholder="또 다른 문장…" rows={2} autoFocus
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', resize: 'none', padding: 0, fontFamily: 'inherit' }} />
              <button onClick={() => removeDraft(i)} aria-label="이 문장 삭제"
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 12, border: 'none', background: 'var(--paper-2)', color: 'var(--ink-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                {window.rgIcon('close', 13)}
              </button>
            </div>
          )
        ))}
        {/* (+) 문장 더 추가 — 부담없이 쌓아두고 덮을 때 한번에(#1198). 2차 tonal(brand-soft). */}
        <button onClick={addDraft} aria-label="문장 더 추가"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '6px 12px', borderRadius: 999, border: 'none', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
          {window.rgIcon('plus', 13)} 문장 더 추가
        </button>
        {_draftCount > 1 && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5, wordBreak: 'keep-all' }}>
            적어둔 {_draftCount}개 문장은 자동 저장돼요 — 다 읽고 덮을 때 아래 쪽수와 함께 한번에 기록해요.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          {/* 사진으로 입력(OCR) — SVG 카메라 아이콘 버튼 (2026 UI, '···' 메뉴 대체) */}
          <button onClick={() => { if (!quickOcrBusy && _quickOcrInputRef.current) _quickOcrInputRef.current.click(); }}
            disabled={quickOcrBusy} title="사진으로 입력 (OCR)" aria-label="사진으로 입력 (OCR)"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', background: 'var(--brand-tint)', color: 'var(--brand-3)', cursor: quickOcrBusy ? 'default' : 'pointer', opacity: quickOcrBusy ? 0.5 : 1, padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          {/* #792 앨범에서 불러오기 — capture 없는 input → OS 갤러리. 동일 OcrCropOverlay 파이프라인 재사용 */}
          <button onClick={() => { if (!quickOcrBusy && _quickAlbumInputRef.current) _quickAlbumInputRef.current.click(); }}
            disabled={quickOcrBusy} title="앨범에서 불러오기" aria-label="앨범에서 불러오기"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', background: 'var(--brand-tint)', color: 'var(--brand-3)', cursor: quickOcrBusy ? 'default' : 'pointer', opacity: quickOcrBusy ? 0.5 : 1, padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>p</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => _stepPage(setQuickSentPage, -1)} aria-label="쪽수 1 줄이기" style={_stepBtnSm}>−</button>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={quickSentPage}
              placeholder={String(nestState.book.cur || 0)} onChange={(e) => setQuickSentPage(e.target.value.replace(/[^0-9]/g, ''))}
              style={{ width: 44, textAlign: 'center', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12, fontWeight: 700, background: 'var(--paper)' }} />
            <button onClick={() => _stepPage(setQuickSentPage, 1)} aria-label="쪽수 1 늘리기" style={_stepBtnSm}>+</button>
          </span>
          {nestState.book.total > 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>/ {nestState.book.total}</span>}
          <button onClick={() => { setSentFlip(true); setTimeout(() => { submitSentence(); setSentFlip(false); }, 280); }}
            style={{ marginLeft: 'auto', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 999, padding: '7px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.2px', flexShrink: 0 }}>
            {_draftCount > 1 ? `${_draftCount}개 한번에 기록` : '남기기'}
          </button>
        </div>
        <input ref={_quickOcrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setQuickOcrFile(f); e.target.value = ''; }} />
        <input ref={_quickAlbumInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setQuickOcrFile(f); e.target.value = ''; }} />
      </div>

      {/* 크롭 오버레이 */}
      {quickOcrFile && (
        <OcrCropOverlay file={quickOcrFile} onCancel={() => setQuickOcrFile(null)} onCrop={(blob) => { setQuickOcrFile(null); runOcrQuick(blob); }} />
      )}

      {/* OCR 추출 로딩 (#1201) — 토스트는 2.2s 후 사라져 장시간 추출 동안 피드백 공백.
          runOcrQuick 시작~finally 동안 스피너 오버레이로 진행 중임을 유지(성공·실패 모두 자동 해제). */}
      {quickOcrBusy && (
        <div style={{ position: 'fixed', inset: 0, height: 'var(--app-h, 100dvh)', background: 'rgba(0,0,0,0.62)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff' }}>
          <div className="rg-spinner" />
          <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{window.rgIcon('camera', 17)} 사진에서 글자를 읽는 중…</div>
        </div>
      )}

      {/* '오늘 기록 완료 · N일 연속' nudge 제거 (#481) */}

      {/* 시간차 되감기 카드 (#346) */}
      {resurfaceCard && (
        <div style={{ background: 'var(--brand-tint)', border: '1px solid var(--brand)', borderRadius: 12, padding: '14px 16px', margin: '10px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-3)', marginBottom: 6 }}>💬 참새</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
            {resurfaceCard.daysAgo}일 전, 이 문장을 남겼어요{resurfaceCard.bookTitle ? ` — 《${resurfaceCard.bookTitle}》` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-quote)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, fontStyle: resurfaceCard.kind === 'thought' ? 'normal' : 'italic', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 2px', marginBottom: 8 }}>
            {resurfaceCard.kind === 'thought' ? `💭 ${resurfaceCard.text}` : `"${resurfaceCard.text}"`}
          </div>
          {resurfaceCard.lastAnswer && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>
              내가 썼던 것: "{resurfaceCard.lastAnswer.length > 80 ? resurfaceCard.lastAnswer.slice(0, 80) + '…' : resurfaceCard.lastAnswer}"
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>지금은 어때요?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resurfaceTalk}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              재키와 다시 대화하기
            </button>
            {/* 나중에 = 3차 텍스트(DESIGN.md #1032: ghost 금지 → 텍스트 dismiss) */}
            <button onClick={resurfaceLater}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 이 책, 한 문장 (#499) — 현재 책 전체 기간 최신순 + 날짜·좋아요·삭제. */}
      <div className="section-head">
        {/* #1068: 0문장이면 카운트('0')·'전체 문장 보기'(빈 동선)를 숨겨 헤더를 비우고, 아래 빈 상태가 유도를 전담한다 */}
        <h3>내가 남긴 흔적 {bookQuotes.length > 0 && <span className="my-q-count">{bookQuotes.length}</span>}</h3>
        {bookQuotes.length > 0 && (
          <button className="more" onClick={() => window.RG_openCollection && window.RG_openCollection()}>
            전체 문장 보기 →
          </button>
        )}
      </div>
      {bookQuotes.length === 0 ? (
        // #1068/#1081: 손코딩 참새 SVG → 모노라인 아이콘(rgIcon) + 유도 카피 + '한 문장 남기기' CTA(위 입력창 포커스).
        <div className="my-q-empty">
          <span className="ico" aria-hidden="true">{window.rgIcon('pen', 28)}</span>
          <div className="my-q-empty-lead">이 책에서 만난 한 줄을 짹 해보세요.</div>
          <div className="my-q-empty-sub">남긴 문장이 여기 쌓여요.</div>
          <button type="button" className="my-q-empty-cta" onClick={focusSentenceInput}>한 문장 남기기</button>
        </div>
      ) : (
        bookQuotes.slice(0, 10).map((q, i) => {
          // 메타·인용·날짜·생각아이콘은 공용 QuoteCard 가 통일 렌더(홈·책장 동일). 여기선 footer(액션·재키)만.
          // getBook 미스 폴백 가드(사피엔스버그) — footer 의 sentence/companion 에 쓸 bkTitle.
          const _bk = getBook(q.bookId);
          const bkTitle = q.bookTitle || (_bk && _bk.id === q.bookId ? _bk.title : '') || '책';
          // 재키 대화 턴 수 (#654) — my_note의 Q. 블록 수. 축적 신호(분수 표기 안 함), 0이면 숨김.
          const turns = q.note ? q.note.split(/\n\n+/).filter((b) => /^Q\./.test(b.trim())).length : 0;
          // 내 감상(자유 메모) — my_note 의 비-Q/A 블록 (#1070). 카드에 미리보기 + '감상 수정' 진입.
          const noteFree = window.rgSplitNote ? window.rgSplitNote(q.note).free : '';
          // 문장별 성찰 진입 (#1070) — 모드를 명시해 연다: 'note'(내 감상만) / 'jacky'(재키와 대화).
          const openReflect = (m) => window.RG_openCompanion && window.RG_openCompanion(
            { id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind }, { mode: m });
          return (
            <window.QuoteCard key={q.id || i} q={q} variant="home">
              {/* 한 문장 액션 계약 (#610) — 공용 SentenceActions(공개범위+좋아요+수정+삭제). 삭제는 rg:sentence-removed 이벤트로 자동 갱신. */}
              {q.id && window.SentenceActions && (
                <SentenceActions sentence={{ id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind, visibility: q.visibility, isPrivate: q.isPrivate }} mine fav={favIds.has(q.id)} />
              )}
              {q.id && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* 내 감상 미리보기 — 적어둔 감상을 카드에서 바로 본다(탭하면 수정). */}
                  {noteFree ? (
                    <div onClick={() => openReflect('note')}
                      style={{ background: 'var(--paper-2)', borderRadius: 12, padding: '8px 11px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, cursor: 'pointer', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{noteFree}</div>
                  ) : null}
                  {/* 문장별 선택 (#1070): 내 감상(재키 없이) · 재키와 대화 — 한 탭으로 분명히. */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* 내 감상 = 2차 tonal(brand-soft 채움, ghost 아님 — DESIGN.md 위계) */}
                    <button onClick={() => openReflect('note')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-soft)', border: '1px solid var(--brand-soft)', color: 'var(--brand-3)', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      {window.rgIcon('pen', 13)}{noteFree ? '감상 수정' : '내 감상'}
                    </button>
                    {/* 재키와 대화 = 기존 q-ai(현행 유지) — 명시적으로 jacky 모드로 진입. */}
                    <button className="q-ai" style={{ marginTop: 0 }} onClick={() => openReflect('jacky')}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                        <ellipse cx="7" cy="9" rx="5" ry="4" fill="currentColor" opacity="0.55"/>
                        <circle cx="9.5" cy="5" r="3" fill="currentColor" opacity="0.75"/>
                        <circle cx="11" cy="4" r="1" fill="currentColor"/>
                        <path d="M12.5 5.5l2 .4-1.5 1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4.5 11.5l-2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
                        <path d="M7 12.5l-1 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
                      </svg>
                      {turns ? `재키와 대화 (${turns})` : '재키와 대화'}
                    </button>
                  </div>
                </div>
              )}
            </window.QuoteCard>
          );
        })
      )}

      {/* 이 책의 다른 한 문장 (#926, 콜드스타트 사회적 증거) — 내 문장 < 3개일 때만 노출(_coldStart).
          타인 공개 문장 좋아요순 ~8건, 읽기전용. book-info-modal.js '이 책의 한 문장' 섹션 미러
          (SentenceCard noBlind, 짹·대화 없음). 0건+시드 미충전이면 섹션 통째 생략(빈 섹션 금지).
          내 문장이 쌓이면(≥3) 자동 소멸 → 콜드스타트 홈 밀도 보호. */}
      {_coldStart && othersQuotes.length > 0 && window.SentenceCard && (
        <div>
          <div className="section-head">
            <h3>이 책의 다른 한 문장</h3>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 10 }}>
            다른 사람들은 이 책에서 이런 문장을 남겼어요.
          </div>
          {othersQuotes.map((s) => {
            const u = s.user || {};
            const _dec = window.decodeEntities || ((x) => x); // nest.js 스코프엔 alias 없음 → window 참조(미정의 폴백)
            return (
              <window.SentenceCard key={s.id} bookId={nestState.book.id} noBlind
                item={{ id: s.id, q: _dec(s.text || ''), nick: u.handle ? '@' + u.handle : (u.display_name || '익명'), avatar: <window.SparrowMark size={20} />,
                        page: s.page, time: '', claps: s.clapCount || 0, bookId: nestState.book.id, bookTitle: '', isMine: false }} />
            );
          })}
        </div>
      )}
      {/* 마중물 시드 (#774, 큐 방식) — 타인 문장이 0건이면 collector 가 예스24 발췌를 여러 NPC 명의로
          채우는 중. 채워지면 위 섹션에 노출된다. 여기선 진행 표시만(채우는 동안만, 빈 섹션 금지). */}
      {_coldStart && othersQuotes.length === 0 && othersSeeding && (
        <div>
          <div className="section-head">
            <h3>🌱 이웃의 문장</h3>
          </div>
          <div style={{ background: 'var(--card)', border: '1.5px dashed var(--line)', borderRadius: 'var(--r-md)', padding: 14, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            🌱 이웃의 문장을 모으는 중이에요… 둘러보는 동안 채워둘게요.
          </div>
        </div>
      )}


      {/* 세리머니 — portal */}
      {ceremony && ReactDOM.createPortal(
        <Ceremony
          data={ceremony}
          onClose={closeCeremony}
          onComplete={handleComplete}
        />,
        document.body
      )}

      {/* 컨페티 — portal */}
      {showConfetti && ReactDOM.createPortal(
        <Confetti active={showConfetti} nestUp={ceremony ? ceremony.nestUp : false} />,
        document.body
      )}
      {/* 책 정보 수정 (#410) — ⚙️ 진입. 저장 시 둥지 진척(total) 즉시 반영 */}
      {bookEditOpen && nestState.book && nestState.book.id && (
        <BookEditModal book={nestState.book} onClose={() => setBookEditOpen(false)}
          onSaved={({ pub, total }) => setNestState((ns) => ({ ...ns, book: { ...ns.book, pub: pub, total: total || ns.book.total } }))} />
      )}
    </section>
  );
}

window.NestView = NestView;

