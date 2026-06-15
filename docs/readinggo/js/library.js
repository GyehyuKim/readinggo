/* =========================================================
   ReadingGo — library.js
   프로필 탭: 프로필 정보 + 내서재 (찜한 책, 읽는 중, 완독)
   ========================================================= */
const { useState: _useState, useEffect: _useEffect } = React;

// HTML 엔티티 디코드 (#562) — 외부 API description 의 `&lt; &gt; &amp; &#39;` 등이 raw 노출되던 버그.
// 표시·markdown export 시점에 안전하게 텍스트로 디코드(스크립트 실행 없음, dangerouslySetInnerHTML 미사용).
// 브라우저: textarea.value 트릭(모든 엔티티). 비DOM(테스트): 핵심 엔티티 정규식 폴백.
function decodeEntities(s) {
  const str = String(s == null ? '' : s);
  if (!str || str.indexOf('&') < 0) return str;
  if (typeof document !== 'undefined' && document.createElement) {
    try { const t = document.createElement('textarea'); t.innerHTML = str; return t.value; } catch (e) { /* fall through */ }
  }
  const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = (ent[1] === 'x' || ent[1] === 'X') ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[ent.toLowerCase()] || m;
  });
}

/* ── BookDetailModal ─────────────────────────────────────── */
function BookDetailModal({ book, allQuotes, onClose, onActivate }) {
  // 실 book item: { id, title, author, pub, cover, fb, total, isbn, cur, status, rating, comment }
  const prog = { cur: book.cur || 0 };
  const progressPct = book.total ? Math.round((prog.cur / book.total) * 100) : 0;
  // 삭제(#325 후속): 낙관적 제거 — bookQuotes 는 prop 파생이라 삭제분을 로컬에서 즉시 거름.
  const [removedIds, setRemovedIds] = _useState({});
  const bookQuotes = (allQuotes || []).filter(q => q.bookId === book.id && !removedIds[q.id]);
  const delQuote = (q) => {
    if (!q.id) return;
    if (!window.confirm('이 한 문장을 삭제할까요? 되돌릴 수 없어요.')) return;
    Promise.resolve(DataStore.sentences.remove(q.id))
      .then(() => { setRemovedIds(m => ({ ...m, [q.id]: true })); showToast('🗑 한 문장을 삭제했어요'); if (window.rgTrack) window.rgTrack('sentence_deleted', { book_id: book.id }); })
      .catch(() => showToast('삭제 실패 — 잠시 후 다시'));
  };
  const bookshelfEntry = (book.status === 'completed') ? { rating: book.rating, comment: book.comment } : null;
  // 스포일러 전역 토글 + 카드별 탭 공개 (§5.7.1)
  const revealAll = React.useContext(SpoilerContext);
  const [revealed, setRevealed] = _useState({});
  // 사후 감상(§5.8.4): 문장별 my_note 추가·편집. setNote 는 Supabase 어댑터에 존재.
  const [noteEdits, setNoteEdits] = _useState({});   // sentenceId -> 저장된 감상(override)
  const [editingId, setEditingId] = _useState(null);
  const [draft, setDraft] = _useState('');
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
  _useEffect(() => {
    if ((book.description || '').trim()) { setBookDesc(book.description.trim()); return; }
    let alive = true;
    setDescLoading(true);
    Promise.resolve(fetchBookDesc())
      .then(d => { if (alive) { setBookDesc((d || '').trim()); setDescLoading(false); } })
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
  const saveNote = (q) => {
    if (!q.id || !(DataStore.sentences && DataStore.sentences.setNote)) { setEditingId(null); return; }
    Promise.resolve(DataStore.sentences.setNote(q.id, draft))
      .then(() => setNoteEdits(m => ({ ...m, [q.id]: draft })))
      .catch(() => {});
    setEditingId(null);
  };
  // 내 한 문장 좋아요(즐겨찾기) — sentence_bookmarks 재활용, 토글 (#11)
  const [bmarks, setBmarks] = _useState(null); // Set<sentenceId>
  _useEffect(() => {
    let alive = true;
    Promise.resolve((DataStore.bookmarks && DataStore.bookmarks.list) ? DataStore.bookmarks.list() : [])
      .then(rows => { if (alive) setBmarks(new Set((rows || []).map(r => r.sentence_id))); })
      .catch(() => { if (alive) setBmarks(new Set()); });
    return () => { alive = false; };
  }, []);
  const toggleFav = (q) => {
    if (!q.id || !(DataStore.bookmarks && DataStore.bookmarks.toggle)) return;
    Promise.resolve(DataStore.bookmarks.toggle(q.id)).then(on => {
      setBmarks(prev => { const n = new Set(prev || []); if (on) n.add(q.id); else n.delete(q.id); return n; });
    }).catch(() => {});
  };
  // visibility 3단계: public(전체) | followers(친구만) | private(나만) (#179)
  const _VIS_CYCLE = ['public', 'followers', 'private'];
  const _VIS_ICON = { public: '🌐', followers: '👥', private: '🔒' };
  const _VIS_LABEL = { public: '전체공개', followers: '친구공개', private: '비공개' };
  const [vis, setVis] = _useState({});
  const getVis = (q) => vis[q.id] || q.visibility || (q.isPrivate ? 'private' : 'public');
  const cycleVis = (q) => {
    if (!q.id || !(DataStore.sentences && DataStore.sentences.setVisibility)) return;
    const next = _VIS_CYCLE[(_VIS_CYCLE.indexOf(getVis(q)) + 1) % _VIS_CYCLE.length];
    setVis(m => ({ ...m, [q.id]: next }));
    Promise.resolve(DataStore.sentences.setVisibility(q.id, { visibility: next })).catch(() => {});
  };
  // note_private 별도 유지 (감상만 비공개)
  const [priv, setPriv] = _useState({});
  const isPrivNote = (q) => { const o = priv[q.id]; return (o && o.note_private !== undefined) ? o.note_private : !!q.notePrivate; };
  const togglePrivNote = (q) => {
    if (!q.id || !(DataStore.sentences && DataStore.sentences.setVisibility)) return;
    const next = !isPrivNote(q);
    setPriv(m => ({ ...m, [q.id]: { ...(m[q.id] || {}), note_private: next } }));
    Promise.resolve(DataStore.sentences.setVisibility(q.id, { note_private: next })).catch(() => {});
  };

  // 교보 상세는 ISBN 이 아닌 교보 고유번호(S…)를 써서 ISBN 직링크가 깨짐 → 검색결과로(QA #1-B).
  const kyoboUrl = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(book.isbn || book.title)}`;

  // 책 소개(description) 조회 (#316) — 알라딘 프록시 ISBN 단건. graceful(실패·미배포 시 빈 값).
  const fetchBookDesc = async () => {
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    if (!proxy || !book.isbn) return '';
    try {
      const r = await fetch(`${proxy}?isbn=${encodeURIComponent(book.isbn)}`);
      if (!r.ok) return '';
      const d = await r.json();
      const it = d && Array.isArray(d.items) && d.items[0];
      return (it && it.description) ? String(it.description).trim() : '';
    } catch (e) { return ''; }
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
    const desc = decodeEntities(await fetchBookDesc());
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
      const note = noteEdits[q.id] !== undefined ? noteEdits[q.id] : (q.note || '');
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
                    <div style={{fontSize:13, color:'var(--ink)', fontWeight:700, marginBottom:8}}>
                      ⭐ {bookshelfEntry.rating.toFixed(1)} / 5
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
              <div style={{fontSize:13, fontWeight:800, color:'var(--brand-3)', marginBottom:6}}>🐦 참새의 완독 회고</div>
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
                    {recapLoading ? '참새가 곱씹는 중…' : '🐦 회고 받기'}
                  </button>
                </>
              )}
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

          {/* 수동 완독 표시 (#265): 미완독 등록 책에만 노출 — 100% 트리거를 놓친 '망령 책' 복구. */}
          {!bookshelfEntry && book.ubId && (
            <button onClick={markDone}
              style={{display:'block', width:'100%', textAlign:'center', padding:'11px 14px', background:'var(--paper-2)', border:'1.5px solid var(--line)', borderRadius:'8px', color:'var(--ink-2)', fontSize:13, fontWeight:800, cursor:'pointer', marginBottom:14}}>
              🏰 완독으로 표시
            </button>
          )}

          <a href={kyoboUrl} target="_blank" rel="noopener noreferrer"
             style={{display:'block', textAlign:'center', padding:'12px 14px', background:'var(--brand-tint)', border:'1.5px solid var(--brand)', borderRadius:'8px', color:'var(--brand-3)', fontSize:13, fontWeight:800, textDecoration:'none', marginBottom:14, cursor:'pointer'}}>
            교보문고에서 보기 →
          </a>

          {/* 책 소개 (#530) — DB books.description 우선, 없으면 알라딘 실시간 폴백. 둘 다 없으면 섹션 생략. */}
          {(bookDesc || descLoading) && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:14, fontWeight:900, color:'var(--ink)', marginBottom:6}}>📚 책 소개</div>
              {descLoading && !bookDesc ? (
                <div style={{fontSize:13, color:'var(--ink-3)', fontWeight:700}}>책 소개를 불러오는 중…</div>
              ) : (
                <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.65, whiteSpace:'pre-wrap'}}>{decodeEntities(bookDesc)}</div>
              )}
            </div>
          )}

          {/* 함께 읽으면 좋은 책 (#496) — LLM 추천 + 실존 books 매칭(환각 필터). 표지 탭 → 찜.
              실제 '함께 읽은 사람들' 집계는 Phase 1이므로 허위 카피("N명이 읽었어요") 금지. */}
          {related.length > 0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:14, fontWeight:900, color:'var(--ink)', marginBottom:3}}>📚 함께 읽으면 좋은 책</div>
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
              style={{display:'block', width:'100%', textAlign:'center', padding:'12px 14px', background:'var(--paper-2)', border:'1.5px solid var(--line)', borderRadius:'8px', color:'var(--ink-2)', fontSize:13, fontWeight:800, cursor:'pointer', marginBottom:14, boxSizing:'border-box'}}>
              ⬇️ 내 한 문장 Markdown 내보내기
            </button>
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
                    <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span>{q.page}p · {q.when}</span>
                      {q.id && (
                        <span style={{display:'flex', gap:8, alignItems:'center'}}>
                          <button onClick={() => cycleVis(q)} title="탭하면 공개 범위 변경 (전체공개→친구공개→비공개)"
                            style={{display:'inline-flex', alignItems:'center', gap:4, background:'var(--card)', border:'1px solid var(--line)', borderRadius:12, cursor:'pointer', fontSize:11, fontWeight:800, color:'var(--ink-2)', padding:'3px 9px', lineHeight:1}}>
                            <span>{_VIS_ICON[getVis(q)]}</span><span>{_VIS_LABEL[getVis(q)]}</span>
                          </button>
                          <button onClick={() => toggleFav(q)} title="좋아요(즐겨찾기)"
                            style={{background:'none', border:'none', cursor:'pointer', fontSize:14, padding:0, lineHeight:1}}>
                            {(bmarks && bmarks.has(q.id)) ? '❤️' : '🤍'}
                          </button>
                          <button onClick={() => delQuote(q)} title="이 한 문장 삭제"
                            style={{background:'none', border:'none', cursor:'pointer', fontSize:13, padding:0, lineHeight:1, opacity:0.7}}>
                            🗑
                          </button>
                        </span>
                      )}
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
                                🐦 짹과 대화 이어가기{turns ? ' (' + turns + ')' : ''}
                              </button>
                            </div>
                          ) : (
                            <button onClick={openChat}
                              style={{marginTop:6, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--line)', background:'transparent', fontSize:11, fontWeight:800, color:'var(--brand-3)', cursor:'pointer'}}>
                              🐦 짹과 대화하기
                            </button>
                          );
                        })()}
                      </>
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
    </div>
  );
}

/* ── ProfileView ─────────────────────────────────────– */
// 위시 행 → 표시용 책 (#403). 양 어댑터 모두 {book_id, book} 객체 반환(로컬은 datastore에서 getBook 해소).
function _mapWish(w) {
  const b = (w && w.book) || w || {};
  return { id: b.id || w.book_id, title: b.title || '', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: 0, status: 'wish' };
}

function LibraryView({ state, onSetActiveBook, onActivateUserBook }) {
  const [selectedBookId, setSelectedBookId] = _useState(null);
  const [activeSubtab, setActiveSubtab] = _useState('reading'); // 'wishlist' | 'reading' | 'completed'
  const [completedSort, setCompletedSort] = _useState('recent'); // 'recent' | 'rating' | 'title' — 읽은 책 정렬 (#513)
  const [onlyHighRating, setOnlyHighRating] = _useState(false); // 4점 이상만 필터 (#513)
  const [myBooks, setMyBooks] = _useState(null);   // null=로딩
  const [wishlistBooks, setWishlistBooks] = _useState([]);
  const [savedCount, setSavedCount] = _useState(0); // ❤️ 저장(북마크) 문장 수 — stats행 (#471/#472)
  const [followCounts, setFollowCounts] = _useState({ following: 0, followers: 0 }); // 팔로잉/팔로워 수 (#516)
  const [followModal, setFollowModal] = _useState(null); // null | 'following' | 'followers' — 유저 목록 모달 (#509)
  // 좋아요한 문장은 내 한 문장 "전체 보기" 컬렉션 모달 내 필터로 이동 (#12)
  const [adminOpen, setAdminOpen] = _useState(false); // 운영 대시보드 (#161)
  // 한 줄 소개 인라인 편집 (#515) — 설정 탭에서 이동, 프로필 헤더에서 직접 수정.
  const [bioEditing, setBioEditing] = _useState(false);
  const [bioText, setBioText] = _useState((window.RG_ME && window.RG_ME.bio) || '');
  const saveBio = () => {
    const v = bioText.trim().slice(0, 100);
    Promise.resolve(DataStore.profile.update({ bio: v || null }))
      .then(() => { if (window.RG_ME) window.RG_ME.bio = v; setBioEditing(false); showToast('소개 저장됨'); })
      .catch(() => showToast('저장 실패 — 잠시 후 다시'));
  };
  // 닉네임 인라인 편집 (#568) — SettingsModal에서 이동, bio 패턴 동일하게.
  const [hdlEditing, setHdlEditing] = _useState(false);
  const [hdlText, setHdlText] = _useState((window.RG_ME && window.RG_ME.handle) || '');
  const [hdlMsg, setHdlMsg] = _useState('');
  const [hdlBusy, setHdlBusy] = _useState(false);
  const saveHandle = async () => {
    if (hdlBusy) return;
    const V = window.RG_VALIDATE || {};
    const r = V.handle ? V.handle(hdlText) : { ok: true, value: (hdlText || '').replace(/^@/, '').trim() };
    if (!r.ok) { setHdlMsg(r.msg); return; }
    const me = window.RG_ME || {};
    if (r.value === (me.handle || '')) { setHdlEditing(false); setHdlMsg(''); return; }
    setHdlBusy(true); setHdlMsg('확인 중…');
    try {
      const ok = (DataStore.users && DataStore.users.isHandleAvailable)
        ? await Promise.resolve(DataStore.users.isHandleAvailable(r.value)) : true;
      if (!ok) { setHdlMsg('이미 사용 중인 닉네임이에요'); return; }
      if (DataStore.profile && DataStore.profile.update) await Promise.resolve(DataStore.profile.update({ handle: r.value, display_name: r.value }));
      if (window.RG_ME) { window.RG_ME.handle = r.value; window.RG_ME.displayName = r.value; }
      setHdlEditing(false); setHdlMsg(''); showToast('닉네임 저장됨 — 새로고침하면 피드에 반영돼요');
    } catch (e) { setHdlMsg('이미 사용 중이거나 저장 실패'); }
    finally { setHdlBusy(false); }
  };
  // 데이터 내보내기 (#568 — SettingsModal에서 이동, 서재에서 직접)
  const exportData = async () => {
    try {
      const me = window.RG_ME || {};
      const [meRow, books, sents] = await Promise.all([
        Promise.resolve((DataStore.profile && DataStore.profile.get) ? DataStore.profile.get() : null).catch(() => null),
        Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : []).catch(() => []),
        Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : []).catch(() => []),
      ]);
      const payload = { app: 'ReadingGo', exported_at: new Date().toISOString(), profile: meRow, books, sentences: sents };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `readinggo-export-${(meRow && meRow.handle) || me.handle || 'me'}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('데이터를 내보냈어요 (JSON)');
    } catch (e) { showToast('내보내기 실패'); }
  };
  const isAdmin = !!(window.RG_ME && window.RG_ME.isAdmin);

  // 내 책(읽는중/완독) + 관심책 — 실 Supabase (양 어댑터 정규화). 데모 상수 미사용.
  _useEffect(() => {
    let alive = true;
    Promise.resolve(DataStore.myBooks.list()).then(rows => {
      if (!alive) return;
      setMyBooks((rows || []).map(ub => {
        const b = ub.book || {};
        return {
          ubId: ub.id, id: ub.book_id,
          title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '',
          cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'],
          total: b.total_pages || 0, isbn: b.isbn13 || '',
          cur: ub.current_page || 0, status: ub.status,
          rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at,
          recap: ub.companion_recap || '',   // 참새 완독 회고 캐시 (#352)
          description: (b.description || '').trim(),   // 책 소개 DB 값 (#530) — 모달이 우선 사용, 없으면 알라딘 폴백
        };
      }));
    }).catch(() => { if (alive) setMyBooks([]); });
    Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
      if (!alive) return;
      setWishlistBooks((rows || []).map(_mapWish));
    }).catch(() => { if (alive) setWishlistBooks([]); });
    // ❤️ 저장(북마크) 문장 수 — stats행 저장 카운트 (#471/#472)
    Promise.resolve((DataStore.bookmarks && DataStore.bookmarks.list) ? DataStore.bookmarks.list() : []).then(rows => { if (alive) setSavedCount((rows || []).length); }).catch(() => {});
    // 팔로잉/팔로워 수 — Supabase friends.counts (게스트/localStorage는 메서드 부재 → 0 유지) (#516)
    Promise.resolve((DataStore.friends && DataStore.friends.counts) ? DataStore.friends.counts() : { following: 0, followers: 0 }).then(c => { if (alive) setFollowCounts(c || { following: 0, followers: 0 }); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // 회고 저장 시 myBooks 의 해당 book.recap 즉시 갱신 (#404) — 모달 재오픈 시 stale 빈 화면 방지.
  _useEffect(() => {
    const onRecap = (e) => {
      const d = e && e.detail; if (!d) return;
      setMyBooks((prev) => (prev || []).map((b) => (b.ubId === d.ubId || b.id === d.bookId) ? { ...b, recap: d.recap } : b));
    };
    window.addEventListener('rg:recap-saved', onRecap);
    return () => window.removeEventListener('rg:recap-saved', onRecap);
  }, []);

  // 위시리스트/완독 변경(검색 책장 선택·찜 삭제·완독 추가, #403/#409) → 목록 즉시 갱신.
  _useEffect(() => {
    const reload = () => {
      Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
        setWishlistBooks((rows || []).map(_mapWish));
      }).catch(() => {});
      Promise.resolve(DataStore.myBooks.list()).then(rows => {
        setMyBooks((rows || []).map(ub => { const b = ub.book || {}; return { ubId: ub.id, id: ub.book_id, title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: ub.current_page || 0, status: ub.status, rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at, recap: ub.companion_recap || '', description: (b.description || '').trim() }; }));
      }).catch(() => {});
    };
    window.addEventListener('rg:wish-changed', reload);
    return () => window.removeEventListener('rg:wish-changed', reload);
  }, []);

  // 찜 삭제 (#403) — 위시리스트 카드 ✕. 낙관적 제거 + 토스트.
  const removeWish = (e, bookId) => {
    if (e) e.stopPropagation();
    setWishlistBooks((prev) => prev.filter((w) => w.id !== bookId));
    if (DataStore.wishBooks && DataStore.wishBooks.remove) Promise.resolve(DataStore.wishBooks.remove(bookId)).catch(() => {});
    showToast('찜 목록에서 제거했어요');
  };

  const books = myBooks || [];
  const readingBooks = books.filter(b => b.status === 'reading')
    .sort((a, b) => (a.id === state.book.id ? -1 : b.id === state.book.id ? 1 : (b.cur || 0) - (a.cur || 0)));
  const completedBooks = books.filter(b => b.status === 'completed');

  const allItems = books.concat(wishlistBooks);
  const selectedBook = selectedBookId ? (allItems.find(x => x.id === selectedBookId) || null) : null;

  const tabsData = [
    { id: 'wishlist', label: '❤️ 읽고 싶은 책', books: wishlistBooks },
    { id: 'reading', label: '📖 읽고 있는 책', books: readingBooks },
    { id: 'completed', label: '✅ 읽은 책', books: completedBooks },
  ];

  const currentTab = tabsData.find(t => t.id === activeSubtab);
  const currentBooks = currentTab?.books || [];

  // 읽은 책 탭: 정렬/필터 적용 (#513). 무평점은 0점 취급(최하). 다른 탭은 원본 순서 유지.
  const displayBooks = activeSubtab === 'completed'
    ? completedBooks
        .filter(b => !onlyHighRating || (b.rating || 0) >= 4)
        .slice()
        .sort((a, b) => {
          if (completedSort === 'rating') return (b.rating || 0) - (a.rating || 0);
          if (completedSort === 'title') return (a.title || '').localeCompare(b.title || '');
          return String(b.completedAt || '').localeCompare(String(a.completedAt || '')); // 최근순
        })
    : currentBooks;

  // 탭에 속한 책들의 ID 목록 추출 및 문장 필터링(필터 무관 — 탭 전체 문장)
  const currentBookIds = currentBooks.map(b => b.id);
  const tabQuotes = (state.myQuotes || [])
    .filter(q => currentBookIds.includes(q.bookId))
    .sort((a, b) => {
      const dateA = a.when || a.createdAt || '';
      const dateB = b.when || b.createdAt || '';
      return dateB.localeCompare(dateA); // 최신순
    });

  return (
    <section className="view active">
      {/* 프로필 정보 (#508) — 닉네임·한 줄 소개·팔로잉/팔로워/저장을 최상단으로(#428 '둥지 최상단' → 재배치, SNS 표준 UX) */}
      <div style={{padding:'4px 16px 16px', position:'relative', textAlign:'center'}}>
        <div style={{position:'absolute', top:0, right:12, display:'flex', gap:8}}>
          {/* 설정 ⚙️는 하단 '설정' 탭으로 이전 (#488). 운영 대시보드(📊)만 헤더 유지. */}
          {isAdmin && (
            <button onClick={() => setAdminOpen(true)} title="운영 대시보드"
              style={{background:'var(--card)', border:'1px solid var(--line)', borderRadius:'50%', width:34, height:34, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1}}>📊</button>
          )}
        </div>
        {/* 닉네임 인라인 편집 (#568) — 탭 → 입력, Enter/저장 → 저장, ESC/바깥 → 취소 */}
        {hdlEditing ? (
          <div style={{marginTop:2, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <div style={{display:'flex', gap:6, alignItems:'center', justifyContent:'center'}}>
              <span style={{fontSize:20}}>🐦</span>
              <span style={{color:'var(--ink-3)', fontWeight:800, fontSize:16}}>@</span>
              <input value={hdlText} maxLength={20} autoFocus
                onChange={e => { setHdlText(e.target.value); setHdlMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') saveHandle(); else if (e.key === 'Escape') { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(false); setHdlMsg(''); } }}
                onBlur={() => { if (!hdlBusy) { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(false); setHdlMsg(''); } }}
                placeholder="닉네임"
                style={{fontSize:16, fontWeight:900, padding:'4px 8px', border:'1.5px solid var(--brand)', borderRadius:6, color:'var(--ink)', background:'var(--card)', width:120, textAlign:'center'}} />
              <button onMouseDown={e => { e.preventDefault(); saveHandle(); }} disabled={hdlBusy}
                style={{padding:'4px 12px', borderRadius:6, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:hdlBusy ? 'default' : 'pointer', opacity:hdlBusy ? 0.6 : 1}}>저장</button>
            </div>
            {hdlMsg && <div style={{fontSize:11, color: hdlMsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', fontWeight:700}}>{hdlMsg}</div>}
          </div>
        ) : (
          <div onClick={() => { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(true); setHdlMsg(''); }}
            title="탭하여 닉네임 편집"
            style={{fontSize:22, fontWeight:900, color:'var(--ink)', cursor:'pointer'}}>
            🐦 {(window.RG_ME && (window.RG_ME.displayName || window.RG_ME.handle)) || '독자'} ✏️
          </div>
        )}
        {/* 한 줄 소개 인라인 편집 (#515) — 탭 → 입력, Enter/저장 → 저장, ESC/바깥 → 취소 */}
        {bioEditing ? (
          <div style={{marginTop:4, display:'flex', gap:6, alignItems:'center', justifyContent:'center'}}>
            <input value={bioText} maxLength={100} autoFocus
              onChange={e => setBioText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveBio(); else if (e.key === 'Escape') { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(false); } }}
              onBlur={() => { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(false); }}
              placeholder="한 줄 소개를 입력해보세요"
              style={{flex:1, fontSize:13, padding:'4px 8px', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)', background:'var(--card)'}} />
            <button onMouseDown={e => { e.preventDefault(); saveBio(); }}
              style={{padding:'4px 12px', borderRadius:6, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer'}}>저장</button>
          </div>
        ) : (
          <div onClick={() => { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(true); }}
            title="탭하여 한 줄 소개 편집"
            style={{fontSize:13, color:'var(--ink-3)', marginTop:4, minHeight:18, cursor:'pointer'}}>
            {(window.RG_ME && window.RG_ME.bio) ? `${window.RG_ME.bio} ✏️` : '한 줄 소개를 입력해보세요 ✏️'}
          </div>
        )}
        {/* 팔로잉/팔로워/저장 (#471/#472) — 팔로우 수는 Supabase friends.counts 실데이터 (#516). 탭 시 유저 목록 모달 (#509) */}
        {/* 가운데정렬 + 좌우 넓게 분배 — space-around 로 풀폭 균등 배치 */}
        <div style={{display:'flex', justifyContent:'space-around', marginTop:14, padding:'0 8px'}}>
          <button onClick={() => setFollowModal('following')}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{followCounts.following}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>팔로잉</div>
          </button>
          <button onClick={() => setFollowModal('followers')}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{followCounts.followers}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>팔로워</div>
          </button>
          <button onClick={() => window.RG_openCollection && window.RG_openCollection({ filter: 'fav' })}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{savedCount}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>❤️ 저장</div>
          </button>
        </div>
      </div>

      {/* 둥지 캐릭터(NestTheatre) — 프로필 헤더 아래로 이동 (#508, #428 갱신) */}
      {window.NestTheatre && <NestTheatre xp={state.xp} />}

      {/* 💭 과거 문장 회상 카드 제거 (#471) */}

      {/* 독서 활동 잔디 (#195) — 좌우 여백 축소로 스크롤 방지 (#11) */}
      <div style={{padding:'0 8px', marginBottom:20}}>
        <ActivityHeatmap days={182} />
      </div>

      {/* 📖 독서 기록 섹션(총 독서시간·일평균) 제거 (#471). duration_sec 저장(#430)은 유지(미표시). */}

      {/* 내 한 문장 섹션 제거(#439) — 프로필 → 내서재 → 읽고 있는 책 클릭 → 책 상세에서 그 책의 한 문장 + 참새 대화 확인 */}

      {/* 내 서재 섹션 */}
      <div style={{padding:'0 12px', marginBottom:20}}>
        <div style={{fontSize:18, fontWeight:900, marginBottom:12, paddingLeft:4}}>📚 내 서재</div>
        
        {/* 탭 버튼들 */}
        <div style={{display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:8, scrollBehavior:'smooth'}}>
          {tabsData.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubtab(tab.id)}
              style={{
                padding:'10px 14px',
                background: activeSubtab === tab.id ? 'var(--brand)' : 'var(--card)',
                color: activeSubtab === tab.id ? 'white' : 'var(--ink)',
                border: activeSubtab === tab.id ? 'none' : '1px solid var(--line)',
                borderRadius:'20px',
                fontSize:12,
                fontWeight:700,
                cursor:'pointer',
                whiteSpace:'nowrap',
                transition:'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 찜하기 — 위시리스트 탭에서 검색 모달로 책 추가 (#403) */}
        {activeSubtab === 'wishlist' && (
          <button onClick={() => window.RG_openSearch && window.RG_openSearch()}
            style={{ width:'100%', margin:'4px 0 12px', padding:'11px', borderRadius:12, border:'1px dashed var(--brand)', background:'var(--brand-tint)', color:'var(--brand-3)', fontWeight:800, fontSize:13.5, cursor:'pointer' }}>
            ＋ 읽고 싶은 책 찾아 담기
          </button>
        )}

        {/* 읽은 책 탭 정렬/필터 컨트롤 (#513) — 성 컬렉션 선반 대체. 완독 책이 있을 때만 노출. */}
        {activeSubtab === 'completed' && completedBooks.length > 0 && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, paddingLeft:4}}>
            {[['recent', '최근순'], ['rating', '별점순'], ['title', '제목순']].map(([id, label]) => (
              <button key={id} onClick={() => setCompletedSort(id)}
                style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: completedSort === id ? 'var(--brand)' : 'var(--card)', color: completedSort === id ? '#fff' : 'var(--ink-2)', boxShadow: completedSort === id ? 'none' : 'inset 0 0 0 1px var(--line)'}}>{label}</button>
            ))}
            <button onClick={() => setOnlyHighRating(v => !v)}
              style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: onlyHighRating ? 'var(--gold)' : 'var(--card)', color: onlyHighRating ? '#fff' : 'var(--ink-2)', boxShadow: onlyHighRating ? 'none' : 'inset 0 0 0 1px var(--line)'}}>⭐ 4점 이상</button>
          </div>
        )}

        {/* 책 목록 */}
        {myBooks === null ? (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>불러오는 중…</div>
        ) : displayBooks.length > 0 ? (
          <div className="shelf-grid">
            {displayBooks.map(b => {
              const isCompleted = b.status === 'completed';
              const progText = isCompleted
                ? (typeof b.rating === 'number' ? `⭐ ${b.rating.toFixed(1)}` : '완독')
                : (b.cur > 0 ? `${b.cur}/${b.total}p` : '미완독');
              return (
                <div
                  key={b.ubId || b.id}
                  className={'shelf-grid-item' + (b.id === state.book.id ? ' active' : '')}
                  onClick={() => setSelectedBookId(b.id)}
                >
                  {b.id === state.book.id && <span className="shelf-grid-active-pill">읽는중</span>}
                  {b.status === 'wish' && (
                    <button onClick={(e) => removeWish(e, b.id)} title="찜 삭제" aria-label="찜 삭제"
                      className="shelf-grid-remove-wish">✕</button>
                  )}
                  <BookCover className="shelf-grid-cover" title={b.title} author={b.author} cover={b.cover} fb={b.fb} />
                  <div className="shelf-grid-title">{b.title}</div>
                  <div className="shelf-grid-prog">{b.status === 'wish' ? (b.author || '관심책') : progText}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)'}}>
            <div style={{fontSize:24, marginBottom:8}}>📭</div>
            <div style={{fontSize:13, fontWeight:700}}>
              {activeSubtab === 'wishlist' && '찜한 책이 없어요'}
              {activeSubtab === 'reading' && '읽는 책이 없어요'}
              {activeSubtab === 'completed' && (onlyHighRating ? '4점 이상 완독한 책이 없어요' : '완독한 책이 없어요')}
            </div>
          </div>
        )}

        {/* 탭별 문장·감상 섹션 */}
        {myBooks !== null && (
          <div style={{marginTop:24, padding:'0 4px'}}>
            <div style={{fontSize:16, fontWeight:900, marginBottom:12, color:'var(--ink)'}}>💬 이 책들의 문장·감상</div>
            {tabQuotes.length > 0 ? (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {tabQuotes.map((q, i) => {
                  const getB = window.getBook;
                  const _bk = typeof getB === 'function' ? getB(q.bookId) : null;
                  const bkTitle = q.bookTitle || (_bk && (_bk.id === q.bookId || _bk.book_id === q.bookId) ? _bk.title : '') || '책';
                  const typeText = q.kind === 'thought' ? '💭내생각' : '📖책속';
                  const pageText = q.page ? `${q.page}p` : '';
                  const dateText = q.when || (q.createdAt ? String(q.createdAt).slice(0, 10) : '');

                  return (
                    <div key={i} className="my-q-card" onClick={() => setSelectedBookId(q.bookId)} style={{cursor:'pointer'}}>
                      <div className="meta">
                        <span className="kind">{typeText}</span>
                        <span className="dot">·</span>
                        <span className="bk" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120}}>{bkTitle}</span>
                        {pageText ? <span className="dot">·</span> : null}
                        {pageText ? <span>{pageText}</span> : null}
                        {dateText ? <span className="dot">·</span> : null}
                        {dateText ? <span>{dateText}</span> : null}
                      </div>
                      <div className="quote" style={{
                        fontStyle: q.kind === 'thought' ? 'normal' : 'italic',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxHeight: '4.65em',
                        lineHeight: '1.55'
                      }}>
                        {q.kind === 'thought' ? `💭 ${q.text}` : `"${q.text}"`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'24px 16px', background:'var(--card)', border:'1.5px dashed var(--line)', borderRadius:'var(--r-md)', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>
                저장된 문장·감상이 없습니다.
              </div>
            )}
          </div>
        )}

        {/* 데이터 내보내기 (#568 — 설정에서 서재로 이동, 내 책·한 문장 맥락과 직결) */}
        <button onClick={exportData}
          style={{marginTop:20, width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid var(--line)', background:'transparent', color:'var(--ink-2)', fontWeight:800, fontSize:14, cursor:'pointer'}}>
          📦 내 데이터 내보내기 (JSON)
        </button>
      </div>

      {/* 책 상세 모달 */}
      {selectedBook && ReactDOM.createPortal(
        <BookDetailModal
          book={selectedBook}
          allQuotes={state.myQuotes}
          onClose={() => setSelectedBookId(null)}
          onActivate={onActivateUserBook}
        />,
        document.body
      )}
      {adminOpen && ReactDOM.createPortal(
        <AdminDashboardModal onClose={() => setAdminOpen(false)} />,
        document.body
      )}
      {followModal && ReactDOM.createPortal(
        <FollowListModal mode={followModal} onClose={() => setFollowModal(null)} />,
        document.body
      )}
    </section>
  );
}

/* ── FollowListModal: 팔로잉/팔로워 유저 목록 (#509) ──────────
   stats행 팔로잉·팔로워 탭 시 오픈. 항목 탭 → 해당 유저 프로필. */
function FollowListModal({ mode, onClose }) {
  const [users, setUsers] = _useState(null); // null=로딩, []=빈
  const isFollowing = mode === 'following';
  const title = isFollowing ? '팔로잉' : '팔로워';
  _useEffect(() => {
    let alive = true;
    const F = (typeof DataStore !== 'undefined' && DataStore.friends) || {};
    const fn = isFollowing ? F.list : F.followers;
    if (typeof fn !== 'function') { setUsers([]); return; }
    Promise.resolve(fn.call(F)).then(rows => {
      if (!alive) return;
      // list → {following:{user}}, followers → {follower:{user}}
      setUsers((rows || []).map(r => (isFollowing ? r.following : r.follower)).filter(Boolean));
    }).catch(() => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, [mode]);
  const openProfile = (u) => {
    if (!u || !u.handle || !window.RG_openProfile) return;
    onClose();
    window.RG_openProfile('@' + u.handle);
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', width: '100%', maxWidth: 430, maxHeight: '80vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{title} {users && <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 800 }}>({users.length}명)</span>}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 24px' }}>
          {users === null ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: '40px 0', fontSize: 13 }}>불러오는 중…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: '40px 0', fontSize: 13 }}>
              {isFollowing ? '아직 팔로우하는 사람이 없어요' : '아직 나를 팔로우하는 사람이 없어요'}
            </div>
          ) : users.map(u => (
            <button key={u.id} onClick={() => openProfile(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--line-2)', padding: '10px 4px', cursor: 'pointer' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{(u.display_name && u.display_name[0]) || '🐦'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{u.display_name || ('@' + u.handle)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio || ('@' + u.handle)}</div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--ink-3)', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.LibraryView = LibraryView;
window.BookDetailModal = BookDetailModal;
window.FollowListModal = FollowListModal;
