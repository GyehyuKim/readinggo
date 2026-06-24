/* =========================================================
   ReadingGo — book-detail-modal.js  (#761 모듈화: library.js에서 추출)
   BookDetailModal: 책장 책 상세(완독 별점·소감·한 문장·관련도서·Markdown export).
   library.js **이전** 로드(LibraryView가 window.BookDetailModal 소비).
   순수 이동 — DataStore 등 window 전역은 bare 참조 유지(런타임 재할당 반영, app.js:367),
   lexical 훅만 재선언. decodeEntities는 window 전역(components.js)으로 해소(library 로컬 중복 제거).
   ========================================================= */

const { useState: _useState, useEffect: _useEffect } = React;

/* ── BookDetailModal ─────────────────────────────────────── */
function BookDetailModal({ book, allQuotes, onClose, onActivate }) {
  // 실 book item: { id, title, author, pub, cover, fb, total, isbn, cur, status, rating, comment }
  const prog = { cur: book.cur || 0 };
  const progressPct = book.total ? Math.round((prog.cur / book.total) * 100) : 0;
  // 삭제(#325 후속): 낙관적 제거 — bookQuotes 는 prop 파생이라 삭제분을 로컬에서 즉시 거름.
  const [removedIds, setRemovedIds] = _useState({});
  const bookQuotes = (allQuotes || []).filter(q => q.bookId === book.id && !removedIds[q.id])
    // 페이지 내림차순(#737) — 미상(null)은 맨 아래, 동일 페이지는 최신순. 둥지(nest.js)와 정책 일치.
    .slice()
    .sort((a, b) => {
      const pa = (typeof a.page === 'number') ? a.page : -Infinity;
      const pb = (typeof b.page === 'number') ? b.page : -Infinity;
      if (pb !== pa) return pb - pa;
      return String(b.createdAt || b.when || '').localeCompare(String(a.createdAt || a.when || ''));
    });
  // 한 문장 추가 (#584) — 책 상세에서 직접(완독 책 포함). app.js 가 rg:sentence-added 로 myQuotes 갱신 → 목록 자동 반영.
  const [addOpen, setAddOpen] = _useState(false);
  const [addText, setAddText] = _useState('');
  const [addPage, setAddPage] = _useState('');
  const [addBusy, setAddBusy] = _useState(false);
  const [quotePasteOpen, setQuotePasteOpen] = _useState(false);  // #848 여러 문장 일괄 담기 모달
  const [batchBusy, setBatchBusy] = _useState(false);
  const [ocrItems, setOcrItems] = _useState(null);   // #844 사진 추출 결과 → BatchQuoteImport(initialItems) 검토
  const [ocrBusy, setOcrBusy] = _useState(false);
  const [ocrProgress, setOcrProgress] = _useState({ done: 0, total: 0 });
  const _ocrAlbumRef = React.useRef(null);
  const saveNewQuote = async () => {
    const t = (addText || '').trim();
    if (!t) { showToast('한 문장을 입력해주세요'); return; }
    if (!book.ubId) { showToast('이 책에는 추가할 수 없어요'); return; }
    if (addBusy) return;
    setAddBusy(true);
    try {
      const pg = addPage === '' ? null : (parseInt(addPage, 10) || null);
      const row = await Promise.resolve(DataStore.sentences.add({ userBookId: book.ubId, page: pg, text: t, kind: 'quote' }));
      // #595: DB 행 확정 시에만 낙관 반영(가짜 id 유령 → 리로드 시 사라짐 방지). id 없으면 실패 처리.
      if (!row || !row.id) { showToast('저장 실패 — 잠시 후 다시'); return; }
      window.dispatchEvent(new CustomEvent('rg:sentence-added', { detail: { quote: {
        id: row.id, text: row.text || t, bookId: book.id, bookTitle: book.title, author: book.author,
        page: (typeof row.page === 'number' ? row.page : (typeof pg === 'number' ? pg : 0)), when: '방금',
        createdAt: row.created_at || '', note: row.my_note || '', kind: 'quote', visibility: row.visibility || 'public',
      } } }));
      setAddText(''); setAddPage(''); setAddOpen(false);
      showToast('✍️ 한 문장을 남겼어요');
      if (window.rgTrack) window.rgTrack('sentence_added', { book_id: book.id, kind: 'quote' });
    } catch (e) { showToast('저장 실패 — 잠시 후 다시'); }
    finally { setAddBusy(false); }
  };
  // #848 여러 문장 일괄 담기 — saveNewQuote 패턴 재사용. sentences.add 반복 + xp.add(+20) 1회.
  // 각 문장 rg:sentence-added 로 app myQuotes·목록 자동 반영. page 미상=null, 200자/중복은 컴포넌트에서 거름.
  const saveBatchQuotes = async (quotes) => {
    const list = (quotes || []).map(t => (t || '').trim()).filter(t => t && t.length <= 200);
    if (!list.length) return { saved: 0 };
    if (!book.ubId) { showToast('이 책에는 추가할 수 없어요'); return { error: true, saved: 0 }; }
    let saved = 0;
    for (const text of list) {
      try {
        const row = await Promise.resolve(DataStore.sentences.add({ userBookId: book.ubId, page: null, text, kind: 'quote' }));
        if (row && row.id) {
          saved++;
          window.dispatchEvent(new CustomEvent('rg:sentence-added', { detail: { quote: {
            id: row.id, text: row.text || text, bookId: book.id, bookTitle: book.title, author: book.author,
            page: (typeof row.page === 'number' ? row.page : 0), when: '방금',
            createdAt: row.created_at || '', note: row.my_note || '', kind: 'quote', visibility: row.visibility || 'public',
          } } }));
        }
      } catch (e) { /* 개별 실패 스킵 */ }
    }
    if (saved > 0) {
      try { await Promise.resolve(DataStore.xp.add(20, 'batch')); } catch (e) {}
      if (window.rgTrack) window.rgTrack('text_import_saved', { book_id: book.id, saved });
    }
    return { saved };
  };
  // #844 배치 OCR — 앨범 N장 → 각 장 Gemini vision 강조 추출(순차+지연, 무료 10 RPM) → 추출 문장 → BatchQuoteImport(initialItems) 검토.
  const runOcrBatch = async (files) => {
    if (!book.ubId) { showToast('이 책에는 추가할 수 없어요'); return; }
    setOcrBusy(true); setOcrProgress({ done: 0, total: files.length });
    const all = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const fd = new FormData();
        fd.append('document', files[i], files[i].name || ('p' + i + '.jpg'));
        const r = await fetch('/api/extract-highlights', { method: 'POST', body: fd });
        const d = await r.json();
        if (d && Array.isArray(d.sentences)) all.push(...d.sentences);
      } catch (e) { /* 실패 장 스킵 — 부분 완료 */ }
      setOcrProgress({ done: i + 1, total: files.length });
      if (i < files.length - 1) await new Promise((res) => setTimeout(res, 1200));
    }
    setOcrBusy(false);
    const seen = new Set(), items = [];
    all.forEach((t) => { const k = (t || '').trim(); if (k && !seen.has(k)) { seen.add(k); items.push(k); } });
    if (!items.length) { showToast('강조된 문장을 찾지 못했어요 — 더 또렷한 사진으로'); return; }
    setOcrItems(items);
  };
  // #610: 자체 삭제/좋아요/공개범위 핸들러 폐기 → 공용 SentenceActions 가 담당(아래 한 문장 카드).
  const bookshelfEntry = (book.status === 'completed') ? { rating: book.rating, comment: book.comment } : null;
  // 스포일러 전역 토글 + 카드별 탭 공개 (§5.7.1)
  const revealAll = React.useContext(SpoilerContext);
  const [revealed, setRevealed] = _useState({});
  // 완독 별점·소감 수정 (QA #3) — 이미 완독한 책의 rating/review 편집.
  const [editMeta, setEditMeta] = _useState(false);
  const [rt, setRt] = _useState(book.rating || 0);
  const [rv, setRv] = _useState(book.comment || '');
  // 참새의 완독 회고 (#259) — 내 한 문장들을 엮어 회고 한 단락. 실패/키없음 시 목 폴백(서버에서 처리).
  // #352: 저장본(user_books.companion_recap) 우선 표시, 새로 받으면 캐시 갱신.
  const [recap, setRecap] = _useState(book.recap || '');
  const [recapLoading, setRecapLoading] = _useState(false);
  // 관련 도서 추천 (#496) — 이 책과 함께 읽으면 좋은 책. worker /api/related(LLM) + 실존 books 매칭.
  const [related, setRelated] = _useState([]);
  const [wished, setWished] = _useState({});
  _useEffect(() => {
    let alive = true;
    Promise.resolve((DataStore.books && DataStore.books.related) ? DataStore.books.related(book) : [])
      .then(list => { if (alive) setRelated(list || []); })
      .catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [book.id]);
  // 완독 후 AI 카드 (§5.8.6, #946) — ① 다음 책 추천 ② 추출 책. 완독(bookshelfEntry)일 때만 로드.
  // Phase 0 하드코딩 시뮬(DataStore.ai → data.js 헬퍼). 다음 책은 책 단위, 추출은 내 한 문장 기반.
  const completed = (book.status === 'completed');
  const [aiNextBooks, setAiNextBooks] = _useState([]);
  const [aiExtract, setAiExtract] = _useState(null);
  _useEffect(() => {
    if (!completed) { setAiNextBooks([]); setAiExtract(null); return; }
    let alive = true;
    Promise.resolve((DataStore.ai && DataStore.ai.recommendBooks) ? DataStore.ai.recommendBooks(book) : [])
      .then(list => { if (alive) setAiNextBooks(list || []); })
      .catch(() => { if (alive) setAiNextBooks([]); });
    return () => { alive = false; };
  }, [book.id, completed]);
  // 추출 책은 이 책의 한 문장(bookQuotes) 의존 — 한 문장 추가/삭제 시 즉시 갱신.
  _useEffect(() => {
    if (!completed) { setAiExtract(null); return; }
    let alive = true;
    const qs = (bookQuotes || []).map(q => ({ text: q.text, page: (typeof q.page === 'number') ? q.page : null }));
    Promise.resolve((DataStore.ai && DataStore.ai.extractBook) ? DataStore.ai.extractBook(book, qs) : null)
      .then(r => { if (alive) setAiExtract(r || null); })
      .catch(() => { if (alive) setAiExtract(null); });
    return () => { alive = false; };
  }, [book.id, completed, bookQuotes.length]);
  const addWish = (rb) => {
    if (!rb || !rb.id || wished[rb.id]) return;
    Promise.resolve(DataStore.wishBooks.add(rb.id))
      .then(() => {
        setWished(w => ({ ...w, [rb.id]: true }));
        showToast('🔖 찜한 책에 담았어요');
        if (window.rgTrack) window.rgTrack('related_book_wished', { from: book.id, to: rb.id });
      })
      .catch(() => showToast('담기 실패 — 잠시 후 다시'));
  };
  // 책 소개(description) 화면 표시 (#530) — DB 우선(book.description), 없을 때만 알라딘 실시간 폴백(쿼터 절약).
  const [bookDesc, setBookDesc] = _useState((book.description || '').trim());
  const [descLoading, setDescLoading] = _useState(false);
  // 소개 출처 (#642) — 'llm'이면 'AI 작성' 칩 노출. DB book.source 우선, 실시간 폴백이면 응답 source 승계.
  const [descSource, setDescSource] = _useState(book.source || '');
  _useEffect(() => {
    if ((book.description || '').trim()) { setBookDesc(book.description.trim()); setDescSource(book.source || ''); return; }
    let alive = true;
    setDescLoading(true);
    Promise.resolve(fetchBookDesc())
      .then(({ desc, source }) => { if (alive) { setBookDesc((desc || '').trim()); setDescSource(source || ''); setDescLoading(false); } })
      .catch(() => { if (alive) setDescLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);
  const loadRecap = async () => {
    if (recapLoading) return;
    setRecapLoading(true);
    try {
      const sentences = (bookQuotes || []).map(q => ({ text: q.text }));
      const r = await fetch('/api/companion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'recap', bookTitle: book.title, author: book.author || '',
          rating: (typeof book.rating === 'number') ? book.rating : undefined,
          review: book.comment || '', sentences,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d && d.recap) {
          setRecap(d.recap);
          if (window.rgTrack) window.rgTrack('companion_recap', { bookId: book.id, n: sentences.length });
          // 영속화 (#352) — 다음 진입 시 저장본 즉시 표시(LLM 재호출 없음). 실패해도 표시는 유지.
          if (book.ubId && DataStore.books && DataStore.books.saveRecap) {
            Promise.resolve(DataStore.books.saveRecap(book.ubId, d.recap)).catch(() => {});
          }
          // 같은 세션 정합 (#404) — 부모 myBooks 의 book.recap 갱신 → 모달 재오픈 시 빈 화면 방지.
          window.dispatchEvent(new CustomEvent('rg:recap-saved', { detail: { ubId: book.ubId, bookId: book.id, recap: d.recap } }));
        }
        else showToast('회고를 불러오지 못했어요 — 잠시 후 다시');
      } else showToast('회고를 불러오지 못했어요 — 잠시 후 다시');
    } catch (e) { showToast('회고를 불러오지 못했어요 — 잠시 후 다시'); }
    setRecapLoading(false);
  };
  const saveMeta = () => {
    if (!book.ubId || !(DataStore.books && DataStore.books.complete)) { setEditMeta(false); return; }
    Promise.resolve(DataStore.books.complete(book.ubId, { rating: rt || null, review_text: (rv || '').trim() || null }))
      .then(() => showToast('완독 정보 저장됨 — 새로고침하면 반영돼요'))
      .catch(() => showToast('저장 실패'));
    setEditMeta(false);
  };
  // 수동 완독 표시 (#265 안전망): 읽기 모드가 100% 트리거를 놓쳤거나 total 미상이던 '망령 책' 복구용.
  const markDone = () => {
    if (!book.ubId || !(DataStore.books && DataStore.books.complete)) return;
    if (!window.confirm(`'${book.title}'을(를) 완독으로 표시할까요?`)) return;
    Promise.resolve(DataStore.books.complete(book.ubId))
      .then(() => showToast('🏰 완독으로 표시했어요 — 새로고침하면 반영돼요'))
      .catch(() => showToast('완독 처리 실패 — 다시 시도'));
  };
  // 읽기 중단 (#593): 읽던 책을 '중단' 탭으로. 삭제 아님 — 진척 보존, '다시 읽기'로 복구 가능.
  const abortBook = () => {
    if (!book.ubId || !(DataStore.myBooks && DataStore.myBooks.abort)) return;
    if (!window.confirm(`'${book.title}' 읽기를 중단할까요?\n진척은 보존되고, '중단' 탭에서 다시 읽을 수 있어요.`)) return;
    Promise.resolve(DataStore.myBooks.abort(book.ubId))
      .then(() => { showToast('⏸️ 읽기를 중단했어요'); window.dispatchEvent(new CustomEvent('rg:wish-changed')); onClose(); })
      .catch(() => showToast('중단 처리 실패 — 다시 시도'));
  };
  // 다시 읽기 (#593): 중단 책을 '읽는 중'으로 복귀. current_page 그대로 이어감.
  const resumeBook = () => {
    if (!book.ubId || !(DataStore.myBooks && DataStore.myBooks.resume)) return;
    Promise.resolve(DataStore.myBooks.resume(book.ubId))
      .then(() => { showToast('📖 다시 읽기 시작 — 읽는 중으로 옮겼어요'); window.dispatchEvent(new CustomEvent('rg:wish-changed')); onClose(); })
      .catch(() => showToast('다시 읽기 실패 — 다시 시도'));
  };
  // 내 한 문장 좋아요(즐겨찾기) — claps 단일(#641: 자기 문장 좋아요=저장 통일), 토글 (#11)
  const [bmarks, setBmarks] = _useState(null); // Set<sentenceId>
  _useEffect(() => {
    let alive = true;
    Promise.resolve((DataStore.claps && DataStore.claps.list) ? DataStore.claps.list() : [])
      .then(rows => { if (alive) setBmarks(new Set((rows || []).map(r => r.sentence_id))); })
      .catch(() => { if (alive) setBmarks(new Set()); });
    return () => { alive = false; };
  }, []);
  // #610: 좋아요·공개범위(3단계) 토글은 공용 SentenceActions 가 담당 → 자체 핸들러/상태 제거.
  //   bmarks 는 SentenceActions fav 초기값 시드용으로만 유지.

  // 교보 상세는 ISBN 이 아닌 교보 고유번호(S…)를 써서 ISBN 직링크가 깨짐 → 검색결과로(QA #1-B).
  const kyoboUrl = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(book.isbn || book.title)}`;

  // 책 소개(description) 조회 (#316) — 알라딘 프록시 ISBN 단건. graceful(실패·미배포 시 빈 값).
  const fetchBookDesc = async () => {
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    if (!proxy || !book.isbn) return { desc: '', source: '' };
    try {
      const r = await fetch(`${proxy}?isbn=${encodeURIComponent(book.isbn)}`);
      if (!r.ok) return { desc: '', source: '' };
      const d = await r.json();
      const it = d && Array.isArray(d.items) && d.items[0];
      const desc = (it && it.description) ? String(it.description).trim() : '';
      return { desc, source: (it && it.source) || '' }; // #642: LLM 생성 소개 표기용 source 동반
    } catch (e) { return { desc: '', source: '' }; }
  };

  // Markdown Export (§5.8.4, #315/#316) — 책 메타·소개 + 완독정보 + 한 문장(페이지·날짜·감상). 북모리 양식 벤치마킹.
  const exportMarkdown = async () => {
    // 날짜 정규화: ISO/타임스탬프 → YYYY-MM-DD. 파싱 실패 시 빈 문자열(‘날짜 미상’ 대신 생략).
    const fmtDate = (v) => {
      if (!v) return '';
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
      const t = (typeof v === 'number') ? v : Date.parse(v);
      if (!t || isNaN(t)) return '';
      const d = new Date(t);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const lines = [`# ${book.title}`, ''];
    // 책 메타
    if (book.author) lines.push(`**${book.author}**`);
    const meta = [book.pub, (book.total > 0 ? `${book.total}쪽` : ''), (book.isbn ? `ISBN ${book.isbn}` : '')].filter(Boolean);
    if (meta.length) lines.push(meta.join(' · '));
    if (book.cover) { lines.push(''); lines.push(`![표지](${book.cover})`); }
    // 책 소개 (#316) — 알라딘 description. 없으면 섹션 생략.
    const desc = decodeEntities((await fetchBookDesc()).desc);
    if (desc) { lines.push('', '---', '', '## 📚 책 소개', '', desc); }
    // 완독 정보
    if (book.status === 'completed') {
      lines.push('', '---', '', '## 📖 완독 정보');
      const r = (typeof book.rating === 'number') ? `⭐ ${book.rating.toFixed(1)} / 5` : '';
      const cd = fmtDate(book.completedAt);
      const head = [r, cd ? `완독 ${cd}` : ''].filter(Boolean).join(' · ');
      if (head) lines.push(head);
      if (book.comment) lines.push(`> ${book.comment}`);
    }
    // 한 문장
    const sorted = (bookQuotes || []).slice().sort((a, b) => (a.page || 0) - (b.page || 0));
    lines.push('', '---', '', `## ✍️ 내 한 문장 (${sorted.length})`, '');
    sorted.forEach(q => {
      const date = fmtDate(q.createdAt || q.when);
      lines.push(`### p.${q.page ?? '?'}${date ? ` · ${date}` : ''}`);
      lines.push(`> ${q.text || ''}`);
      const note = q.note || '';
      if (note) { lines.push(''); lines.push(note); }
      lines.push('');
    });
    const content = lines.join('\n');
    const blob = new Blob(['\uFEFF', content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📄 Markdown 저장됨');
  };

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label={book.title}>
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1, zIndex:2}}>✕</button>
        
        <div style={{textAlign:'center', padding:'16px 20px 0'}}>
          <BookCover
            className="book-cover"
            title={book.title} author={book.author} cover={book.cover} fb={book.fb}
            radius={8}
            style={{ width:100, height:140, margin:'0 auto 12px' }}
          />
          <h2 style={{fontSize:18, fontWeight:900, margin:'0 0 4px', color:'var(--ink)'}}>{book.title}</h2>
          <p style={{fontSize:13, color:'var(--ink-2)', fontWeight:700, margin:'0 0 12px'}}>{[book.author, book.pub].map(x => (x || '').trim()).filter(Boolean).join(' · ')}</p>
        </div>

        <div style={{padding:'16px 20px', maxHeight:'50vh', overflowY:'auto'}}>
          {/* 완독 정보 */}
          {bookshelfEntry && (
            <div style={{background:'var(--paper-2)', borderRadius:'8px', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:800, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>완독 정보</span>
                {!editMeta && <button onClick={() => { setRt(book.rating || 0); setRv(book.comment || ''); setEditMeta(true); }} style={{background:'none', border:'none', color:'var(--brand-3)', fontWeight:800, fontSize:12, cursor:'pointer'}}>✏️ 수정</button>}
              </div>
              {editMeta ? (
                <div>
                  {/* 반별점 0.5 (#153): 좌측 절반=0.5, 우측 절반=정수 */}
                  <div role="radiogroup" aria-label="별점 (0.5 단위)" style={{marginBottom:8, display:'flex', gap:3, alignItems:'center'}}>
                    {[1,2,3,4,5].map(n => {
                      const fillPct = Math.max(0, Math.min(1, rt - (n - 1))) * 100;
                      return (
                        <span key={n} style={{position:'relative', display:'inline-block', width:26, height:26, fontSize:24, lineHeight:'26px'}}>
                          <span style={{color:'var(--line-2, #d0d4da)'}}>★</span>
                          <span style={{position:'absolute', left:0, top:0, width:fillPct+'%', overflow:'hidden', color:'#f5b301'}}>★</span>
                          <button type="button" aria-label={`${n-0.5}점`} onClick={() => setRt(rt === n-0.5 ? 0 : n-0.5)} style={{position:'absolute', left:0, top:0, width:'50%', height:'100%', background:'none', border:'none', cursor:'pointer', padding:0}} />
                          <button type="button" aria-label={`${n}점`} onClick={() => setRt(rt === n ? 0 : n)} style={{position:'absolute', right:0, top:0, width:'50%', height:'100%', background:'none', border:'none', cursor:'pointer', padding:0}} />
                        </span>
                      );
                    })}
                    <span style={{marginLeft:6, fontSize:13, fontWeight:800, color:'var(--ink-2)'}}>{rt > 0 ? rt.toFixed(1) : ''}</span>
                  </div>
                  <textarea value={rv} maxLength={1000} onChange={e => setRv(e.target.value)} placeholder="완독 소감 (최대 1000자)" rows={3}
                    style={{width:'100%', boxSizing:'border-box', padding:8, borderRadius:8, border:'1.5px solid var(--line)', fontSize:13, fontFamily:'inherit', resize:'vertical'}} />
                  <div style={{display:'flex', gap:6, marginTop:6}}>
                    <button onClick={saveMeta} style={{padding:'6px 12px', borderRadius:8, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer'}}>저장</button>
                    <button onClick={() => setEditMeta(false)} style={{padding:'6px 12px', borderRadius:8, border:'1px solid var(--line)', background:'transparent', fontSize:12, fontWeight:700, cursor:'pointer'}}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  {typeof bookshelfEntry.rating === 'number' ? (
                    // 별점 있음 — 빈 별 트랙 + 채움(반별점)으로 표시, 탭하면 수정 모드 진입 (#592).
                    // 기존엔 '⭐ 4.0 / 5' 텍스트만이라 빈 별이 안 보이고 어디를 눌러 조정할지 불명확했음.
                    <div style={{display:'flex', gap:3, alignItems:'center', marginBottom:8}}>
                      {[1,2,3,4,5].map(n => {
                        const fillPct = Math.max(0, Math.min(1, bookshelfEntry.rating - (n - 1))) * 100;
                        return (
                          <button key={n} type="button" aria-label={`${n}점 — 탭하여 별점 수정`}
                            onClick={() => { setRt(bookshelfEntry.rating); setRv(book.comment || ''); setEditMeta(true); }}
                            style={{position:'relative', display:'inline-block', width:26, height:26, fontSize:24, lineHeight:'26px', background:'none', border:'none', cursor:'pointer', padding:0}}>
                            <span style={{color:'var(--line-2, #d0d4da)'}}>★</span>
                            <span style={{position:'absolute', left:0, top:0, width:fillPct+'%', overflow:'hidden', color:'#f5b301'}}>★</span>
                          </button>
                        );
                      })}
                      <span style={{marginLeft:6, fontSize:12, color:'var(--ink-3)', fontWeight:700}}>{bookshelfEntry.rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    // 미입력 — 빈 별 실루엣 노출(탭하면 입력 모드 진입) (#314). 기존엔 '별점 없음' 텍스트만 떠서 입력 불가.
                    <div style={{display:'flex', gap:3, alignItems:'center', marginBottom:8}}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" aria-label={`${n}점 주기`}
                          onClick={() => { setRt(n); setRv(book.comment || ''); setEditMeta(true); }}
                          style={{background:'none', border:'none', cursor:'pointer', padding:0, fontSize:24, lineHeight:'26px', color:'var(--line-2, #d0d4da)'}}>★</button>
                      ))}
                      <span style={{marginLeft:6, fontSize:12, color:'var(--ink-3)', fontWeight:700}}>별점 주기</span>
                    </div>
                  )}
                  {bookshelfEntry.comment && (
                    <div style={{fontSize:13, color:'var(--ink)', lineHeight:'1.5'}}>{bookshelfEntry.comment}</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 참새의 완독 회고 (§5.8.6, #259) — 내 한 문장들을 참새(solar-pro3)가 엮어 회고 한 단락 */}
          {bookshelfEntry && (
            <div style={{background:'var(--brand-tint)', border:'1px solid var(--brand)', borderRadius:'8px', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:13, fontWeight:800, color:'var(--brand-3)', marginBottom:6}}><window.SparrowInline size={14} /> 참새의 완독 회고</div>
              {recap ? (
                <>
                  <div style={{fontSize:13, color:'var(--ink)', lineHeight:1.65, whiteSpace:'pre-wrap'}}>{recap}</div>
                  {bookQuotes.length > 0 && (
                    <button onClick={loadRecap} disabled={recapLoading}
                      style={{marginTop:8, padding:'5px 12px', background:'none', border:'1px solid var(--brand)', borderRadius:8, color:'var(--brand-3)', fontSize:11, fontWeight:800, cursor:recapLoading?'default':'pointer', opacity:recapLoading?0.6:1}}>
                      {recapLoading ? '참새가 곱씹는 중…' : '🔄 다시 받기'}
                    </button>
                  )}
                </>
              ) : bookQuotes.length === 0 ? (
                <div style={{fontSize:12, color:'var(--ink-2)', lineHeight:1.5}}>이 책에 남긴 한 문장이 있으면, 참새가 그 문장들을 엮어 회고를 들려줘요.</div>
              ) : (
                <>
                  <div style={{fontSize:12, color:'var(--ink-2)', lineHeight:1.5, marginBottom:8}}>이 책에서 남긴 {bookQuotes.length}개의 한 문장을 참새가 엮어 회고를 들려드려요.</div>
                  <button onClick={loadRecap} disabled={recapLoading}
                    style={{padding:'9px 16px', background:'var(--brand)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:800, cursor:recapLoading?'default':'pointer', opacity:recapLoading?0.6:1}}>
                    {recapLoading ? '참새가 곱씹는 중…' : <><window.SparrowInline size={13} /> 회고 받기</>}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── 완독 후 AI 카드 (§5.8.6, #946) — Phase 0 하드코딩 시뮬 ────────────── */}
          {/* ① AI 도서 추천 — 다음 책 (나↔책 fit, 친구 매칭 아님). CTA = 교보문고에서 보기 */}
          {bookshelfEntry && aiNextBooks.length > 0 && (
            <div style={{marginBottom:14}}>
              <SectionLabel icon="related" mb={3}>AI 추천 — 다음에 읽을 책</SectionLabel>
              <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:10}}>이 책을 완독한 당신에게 어울리는 다음 책이에요</div>
              {aiNextBooks.map(rb => (
                <div key={rb.id} style={{display:'flex', gap:12, alignItems:'flex-start', background:'var(--paper-2)', borderRadius:8, padding:'10px 12px', marginBottom:8}}>
                  <BookCover className="book-cover" title={rb.title} author={rb.author} cover={rb.cover}
                    radius={6} style={{width:48, height:68, flex:'0 0 auto'}} />
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:800, color:'var(--ink)', lineHeight:1.3}}>{rb.title}</div>
                    <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginTop:1}}>{rb.author}</div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, lineHeight:1.45, marginTop:5}}>{rb.reason}</div>
                    <a href={`https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(rb.isbn || rb.title)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{display:'inline-block', marginTop:6, fontSize:11, fontWeight:800, color:'var(--brand-3)', textDecoration:'none'}}>
                      교보문고에서 보기 →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ② AI 추출 책 — 나만의 추출 책 (내 한 문장 기반). Phase 0 = 한 문장 나열 + 고정 카피 */}
          {bookshelfEntry && aiExtract && (
            <div style={{background:'var(--brand-tint)', border:'1px solid var(--brand)', borderRadius:8, padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:13, fontWeight:800, color:'var(--brand-3)', marginBottom:8}}>✨ 나만의 추출 책</div>
              {/* 반응한 주제 TOP 3 */}
              <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:10}}>
                {aiExtract.topics.map((t, i) => (
                  <span key={i} style={{fontSize:11, fontWeight:800, color:'var(--brand-3)', background:'var(--card)', border:'1px solid var(--brand-soft)', borderRadius:12, padding:'3px 10px'}}>#{t}</span>
                ))}
              </div>
              {/* 가장 인상 깊었던 한 문장 */}
              {aiExtract.topQuote && aiExtract.topQuote.text && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:800, marginBottom:4}}>가장 인상 깊었던 한 문장</div>
                  <div style={{fontSize:13, color:'var(--ink)', fontWeight:400, fontStyle:'italic', lineHeight:1.55, padding:'8px 10px', background:'var(--card)', borderRadius:8}}>
                    "{aiExtract.topQuote.text}"
                    {typeof aiExtract.topQuote.page === 'number' && <span style={{fontStyle:'normal', fontSize:11, color:'var(--ink-3)', fontWeight:700, marginLeft:6}}>p.{aiExtract.topQuote.page}</span>}
                  </div>
                </div>
              )}
              {/* 흐름 요약 (고정 카피) */}
              <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, lineHeight:1.55}}>{aiExtract.summary}</div>
            </div>
          )}

          {/* 진도 정보 (읽는 중일 때) — 쪽수 미상 graceful (§5.8.4 v7.2 #204) */}
          {prog.cur > 0 && !bookshelfEntry && (
            <div style={{background:'var(--paper-2)', borderRadius:'8px', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:800, marginBottom:6}}>진도</div>
              {book.total > 0 ? (
                <>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{flex:1, height:8, background:'var(--line)', borderRadius:4, overflow:'hidden'}}>
                      <div style={{height:'100%', background:'var(--brand)', width:`${progressPct}%`, transition:'width 0.3s ease'}} />
                    </div>
                    <span style={{fontSize:13, fontWeight:800, color:'var(--ink)', minWidth:50}}>{prog.cur} / {book.total}p</span>
                  </div>
                  <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginTop:6}}>{progressPct}%</div>
                </>
              ) : (
                <div style={{fontSize:13, color:'var(--ink-3)', fontWeight:700}}>
                  📖 {prog.cur}p 읽음 · <span style={{color:'var(--ink-3)'}}>쪽수 미상</span>
                </div>
              )}
            </div>
          )}

          {/* 다시 읽기 (#593): 중단(aborted) 책 → 읽는 중 복귀. current_page 보존. */}
          {book.status === 'aborted' && book.ubId && (
            <button onClick={resumeBook}
              style={{display:'block', width:'100%', textAlign:'center', padding:'12px 14px', background:'var(--brand)', border:'none', borderRadius:'8px', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', marginBottom:14}}>
              📖 다시 읽기
            </button>
          )}

          {/* 완독 표시(#265) / 읽기 중단(#593) — 한 줄 좌우 2버튼 · SVG 아이콘(2026 UI, 이모지 제거).
              미완독·미중단 등록 책에만 노출. 완독=체크, 중단=일시정지. */}
          {!bookshelfEntry && book.status !== 'aborted' && book.ubId && (
            <div style={{display:'flex', gap:8, marginBottom:14}}>
              <button onClick={markDone}
                style={{flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px 12px', background:'var(--brand-tint)', border:'1.5px solid var(--brand-soft)', borderRadius:10, color:'var(--brand-3)', fontSize:13, fontWeight:800, cursor:'pointer'}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                완독으로 표시
              </button>
              <button onClick={abortBook}
                style={{flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px 12px', background:'transparent', border:'1.5px solid var(--line)', borderRadius:10, color:'var(--ink-3)', fontSize:13, fontWeight:800, cursor:'pointer'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>
                읽기 중단
              </button>
            </div>
          )}

          <a href={kyoboUrl} target="_blank" rel="noopener noreferrer"
             style={{display:'block', textAlign:'center', padding:'12px 14px', background:'var(--brand-tint)', border:'1.5px solid var(--brand)', borderRadius:'8px', color:'var(--brand-3)', fontSize:13, fontWeight:800, textDecoration:'none', marginBottom:14, cursor:'pointer'}}>
            교보문고에서 보기 →
          </a>

          {/* 책 소개 (#530) — DB books.description 우선, 없으면 알라딘 실시간 폴백. 둘 다 없으면 섹션 생략. */}
          {(bookDesc || descLoading) && (
            <div style={{marginBottom:14}}>
              {/* 섹션 헤더 #696 — 이모지 prefix 폐기, 공용 SectionLabel(components.js, window 노출). */}
              <SectionLabel icon="intro"
                trailing={descSource === 'llm' && <span title="AI가 작성한 소개예요 · 부정확할 수 있어요" style={{fontSize:10, fontWeight:800, color:'var(--ink-3)', background:'var(--line)', borderRadius:5, padding:'1px 6px', letterSpacing:0.3}}>AI</span>}>
                책 소개
              </SectionLabel>
              {descLoading && !bookDesc ? (
                <div style={{...window.RG_SECTION_CARD, fontSize:13, color:'var(--ink-3)', fontWeight:700}}>책 소개를 불러오는 중…</div>
              ) : (
                <div style={{...window.RG_SECTION_CARD, fontSize:13, color:'var(--ink-2)', lineHeight:1.65, whiteSpace:'pre-wrap'}}>{decodeEntities(bookDesc)}</div>
              )}
            </div>
          )}

          {/* 함께 읽으면 좋은 책 (#496) — LLM 추천 + 실존 books 매칭(환각 필터). 표지 탭 → 찜.
              실제 '함께 읽은 사람들' 집계는 Phase 1이므로 허위 카피("N명이 읽었어요") 금지. */}
          {related.length > 0 && (
            <div style={{marginBottom:14}}>
              <SectionLabel icon="related" mb={3}>함께 읽으면 좋은 책</SectionLabel>
              <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:10}}>이 책을 좋아한다면 — 표지를 누르면 찜에 담겨요</div>
              <div style={{display:'flex', gap:12, overflowX:'auto', paddingBottom:4, WebkitOverflowScrolling:'touch'}}>
                {related.map(rb => (
                  <button key={rb.id} type="button" onClick={() => addWish(rb)} title={`${rb.title} — 찜에 담기`}
                    style={{flex:'0 0 auto', width:92, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left'}}>
                    <div style={{position:'relative'}}>
                      <img src={rb.cover} alt={rb.title} loading="lazy"
                        style={{width:92, height:134, objectFit:'cover', borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,0.12)', background:'var(--paper-2)', display:'block'}} />
                      {wished[rb.id] && (
                        <div style={{position:'absolute', top:4, right:4, background:'var(--brand)', color:'#fff', fontSize:10, fontWeight:800, borderRadius:10, padding:'2px 6px'}}>찜 ✓</div>
                      )}
                    </div>
                    <div style={{fontSize:11, fontWeight:800, color:'var(--ink)', marginTop:6, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{rb.title}</div>
                    <div style={{fontSize:10, color:'var(--ink-3)', fontWeight:700, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rb.author}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Markdown Export (§5.8.4) — 내 한 문장이 1개 이상 있을 때만 노출 */}
          {bookQuotes.length > 0 && (
            <button onClick={exportMarkdown}
              style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, width:'100%', padding:'12px 14px', background:'var(--paper-2)', border:'1.5px solid var(--line)', borderRadius:'8px', color:'var(--ink-2)', fontSize:13, fontWeight:800, cursor:'pointer', marginBottom:14, boxSizing:'border-box'}}>
              {window.rgIcon('download',15)} 내 한 문장 Markdown 내보내기
            </button>
          )}

          {/* 한 문장 추가 (#584) — 완독 책 포함, book.ubId 있을 때. 목록 0개여도 항상 노출 */}
          {book.ubId && (
            <div style={{marginBottom:14}}>
              {!addOpen ? (
                <>
                  <button onClick={() => setAddOpen(true)}
                    style={{display:'block', width:'100%', padding:'12px', borderRadius:8, border:'1.5px dashed var(--brand)', background:'var(--brand-tint)', color:'var(--brand-3)', fontWeight:800, fontSize:14, cursor:'pointer'}}>✍️ 한 문장 추가</button>
                  {/* #848 여러 문장 한 번에 담기 — 눈에 띄는 카드 + 사용법 안내 */}
                  <button onClick={() => setQuotePasteOpen(true)}
                    style={{display:'block', width:'100%', marginTop:8, padding:'12px 14px', borderRadius:8, border:'1.5px solid var(--brand-soft)', background:'var(--brand-soft)', color:'var(--brand-3)', textAlign:'left', cursor:'pointer'}}>
                    <div style={{fontWeight:800, fontSize:14}}>📋 여러 문장 한 번에 담기</div>
                    <div style={{fontWeight:600, fontSize:12, color:'var(--ink-3)', marginTop:3, lineHeight:1.45}}>밑줄·메모·공유한 글을 <b>한 줄에 하나씩</b> 붙여넣으면 한꺼번에 담겨요</div>
                  </button>
                  {/* #844 사진에서 여러 문장 담기 — 앨범 다중 → Gemini vision 강조 추출 */}
                  <button onClick={() => _ocrAlbumRef.current && _ocrAlbumRef.current.click()}
                    style={{display:'block', width:'100%', marginTop:8, padding:'12px 14px', borderRadius:8, border:'1.5px solid var(--brand-soft)', background:'var(--brand-soft)', color:'var(--brand-3)', textAlign:'left', cursor:'pointer'}}>
                    <div style={{fontWeight:800, fontSize:14}}>📷 사진에서 여러 문장 담기</div>
                    <div style={{fontWeight:600, fontSize:12, color:'var(--ink-3)', marginTop:3, lineHeight:1.45}}>밑줄·형광펜 친 페이지를 <b>여러 장</b> 올리면 강조 문장만 골라 담아요</div>
                  </button>
                  <input ref={_ocrAlbumRef} type="file" accept="image/*" multiple style={{display:'none'}}
                    onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) runOcrBatch(fs); }} />
                </>
              ) : (
                <div style={{background:'var(--card)', border:'1.5px solid var(--line)', borderRadius:8, padding:12}}>
                  <textarea value={addText} onChange={e => { if (e.target.value.length <= 1000) setAddText(e.target.value); }}
                    placeholder="이 책에서 남기고 싶은 한 문장" rows={3} autoFocus
                    style={{width:'100%', boxSizing:'border-box', border:'1.5px solid var(--line)', borderRadius:8, padding:10, fontSize:14, lineHeight:1.5, resize:'none'}} />
                  {/* 인용/내 생각 토글 제거 (#596) — '내 생각' 폐기, 항상 인용(quote) 저장 */}
                  <div style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
                    <input type="number" inputMode="numeric" min="0" max="99999" value={addPage} onChange={e => setAddPage(e.target.value)} placeholder="페이지"
                      style={{width:72, textAlign:'center', padding:'7px 4px', border:'1.5px solid var(--line)', borderRadius:8, fontSize:13, fontWeight:700}} />
                  </div>
                  <div style={{display:'flex', gap:8, marginTop:10}}>
                    <button onClick={() => { setAddOpen(false); setAddText(''); setAddPage(''); }}
                      style={{flex:'0 0 auto', padding:'10px 14px', borderRadius:8, border:'1.5px solid var(--line)', background:'transparent', color:'var(--ink-3)', fontWeight:700, fontSize:13, cursor:'pointer'}}>취소</button>
                    <button onClick={saveNewQuote} disabled={addBusy}
                      style={{flex:1, padding:'10px', borderRadius:8, border:'none', background:'var(--brand)', color:'#fff', fontWeight:800, fontSize:14, cursor:addBusy?'default':'pointer', opacity:addBusy?0.6:1}}>{addBusy?'저장 중…':'저장'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {bookQuotes.length > 0 && (
            <>
              <div style={{fontSize:14, fontWeight:900, color:'var(--ink)', marginBottom:10}}>
                📖 내 한 문장 {bookQuotes.length}개
              </div>
              {bookQuotes.map((q, i) => {
                const blinded = !revealAll && !revealed[i] &&
                  isSentenceBlinded(book.id, q.page);
                return (
                  <div key={i} style={{background:'var(--card)', border:'1.5px solid var(--line)', borderRadius:'8px', padding:12, marginBottom:10}}>
                    <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:6}}>
                      <span>{q.page}p · {q.when}</span>
                    </div>
                    {blinded ? (
                      <div className="spoiler-blind" onClick={() => setRevealed(r => ({ ...r, [i]: true }))}>
                        ⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기
                      </div>
                    ) : (
                      <>
                        {/* 인용은 "이탤릭", 내 의견은 💭 (#360) */}
                        {q.kind === 'thought' ? (
                          <div style={{fontSize:13, color:'var(--ink)', fontWeight:400, lineHeight:'1.5'}}>💭 {q.text}</div>
                        ) : (
                          <div style={{fontSize:13, color:'var(--ink)', fontWeight:400, lineHeight:'1.5', fontStyle:'italic'}}>
                            "{q.text}"
                          </div>
                        )}
                        {/* 참새 대화로 통일 (#404) — 둥지와 동일 진입(CompanionModal). 자유 감상 편집은
                            폐지: 참새 Q/A 와 같은 my_note 칸을 공유해 서로 덮어쓰던 충돌 제거. */}
                        {q.id && (() => {
                          const note = q.note || '';
                          const turns = note ? note.split(/\n\n+/).filter((b) => /^Q\./.test(b.trim())).length : 0;
                          const openChat = () => window.RG_openCompanion && window.RG_openCompanion({
                            id: q.id, text: q.text, bookId: book.id, bookTitle: book.title, author: book.author,
                            page: q.page, note: q.note, kind: q.kind,
                          });
                          return note ? (
                            <div style={{marginTop:8}}>
                              <div onClick={openChat}
                                style={{padding:'8px 10px', background:'var(--paper-2)', borderRadius:8, fontSize:12, color:'var(--ink-2)', lineHeight:1.5, cursor:'pointer', whiteSpace:'pre-wrap', maxHeight:96, overflow:'hidden'}}>
                                💬 {note}
                              </div>
                              <button onClick={openChat}
                                style={{marginTop:4, background:'none', border:'none', color:'var(--brand-3)', fontSize:11, fontWeight:800, cursor:'pointer', padding:'2px 0'}}>
                                <window.SparrowInline size={13} /> 재키와 대화 이어가기{turns ? ' (' + turns + ')' : ''}
                              </button>
                            </div>
                          ) : (
                            <button onClick={openChat}
                              style={{marginTop:6, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--line)', background:'transparent', fontSize:11, fontWeight:800, color:'var(--brand-3)', cursor:'pointer'}}>
                              <window.SparrowInline size={13} /> 재키와 대화하기
                            </button>
                          );
                        })()}
                      </>
                    )}
                    {/* 한 문장 액션 계약 (#610) — 자체 렌더 대신 공용 SentenceActions(공개범위+좋아요+수정+삭제) 경유.
                        삭제는 rg:sentence-removed 이벤트로 목록 갱신(removedIds 리스너). blind 와 무관하게 내 문장 관리 가능. */}
                    {q.id && window.SentenceActions && (
                      <SentenceActions
                        sentence={{ id: q.id, text: q.text, bookId: book.id, bookTitle: book.title, author: book.author, page: q.page, note: q.note || q.my_note || '', kind: q.kind, visibility: q.visibility, isPrivate: q.isPrivate }}
                        mine fav={!!(bmarks && bmarks.has(q.id))}
                        onRemoved={(rid) => setRemovedIds(m => ({ ...m, [rid]: true }))} />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {!bookshelfEntry && (
          <button
            className="submit-btn"
            style={{margin:'12px 0 20px'}}
            onClick={() => { onActivate(book); onClose(); }}
          >
            이 책으로 변경하기
          </button>
        )}
      </div>

      {/* #848 여러 문장 일괄 담기 모달 */}
      {quotePasteOpen && (
        <BatchQuoteImport busy={batchBusy}
          onCancel={() => setQuotePasteOpen(false)}
          onSave={async (quotes) => {
            if (!quotes || !quotes.length) { setQuotePasteOpen(false); return; }
            setBatchBusy(true);
            try {
              const r = await saveBatchQuotes(quotes);
              if (r && r.error) { showToast('담기 실패 — 잠시 후 다시 시도해요'); }
              else { showToast('✨ ' + (r.saved || quotes.length) + '개 담았어요'); setQuotePasteOpen(false); }
            } catch (e) { showToast('담기 실패 — 잠시 후 다시 시도해요'); }
            finally { setBatchBusy(false); }
          }} />
      )}

      {/* #844 배치 OCR 진행률 */}
      {ocrBusy && (
        <div style={{position:'fixed', inset:0, height:'var(--app-h, 100dvh)', background:'rgba(0,0,0,0.62)', zIndex:1100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#fff'}}>
          <div style={{fontWeight:800, fontSize:16}}>📷 사진에서 강조 문장 읽는 중…</div>
          <div style={{fontSize:14, opacity:0.85}}>{ocrProgress.done} / {ocrProgress.total}장</div>
        </div>
      )}

      {/* #844 사진 추출 결과 검토 — BatchQuoteImport 재사용(initialItems로 바로 검토 단계) */}
      {ocrItems && (
        <BatchQuoteImport busy={batchBusy} initialItems={ocrItems}
          onCancel={() => setOcrItems(null)}
          onSave={async (quotes) => {
            if (!quotes || !quotes.length) { setOcrItems(null); return; }
            setBatchBusy(true);
            try {
              const r = await saveBatchQuotes(quotes);
              if (r && r.error) { showToast('담기 실패 — 잠시 후 다시 시도해요'); }
              else { showToast('✨ ' + (r.saved || quotes.length) + '개 담았어요'); setOcrItems(null); }
            } catch (e) { showToast('담기 실패 — 잠시 후 다시 시도해요'); }
            finally { setBatchBusy(false); }
          }} />
      )}
    </div>
  );
}
window.BookDetailModal = BookDetailModal;
