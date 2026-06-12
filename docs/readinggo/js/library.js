/* =========================================================
   ReadingGo — library.js
   프로필 탭: 프로필 정보 + 내서재 (찜한 책, 읽는 중, 완독)
   ========================================================= */
const { useState: _useState, useEffect: _useEffect } = React;

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
    const desc = await fetchBookDesc();
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
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
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
                                🐦 참새와 대화 이어가기{turns ? ' (' + turns + ')' : ''}
                              </button>
                            </div>
                          ) : (
                            <button onClick={openChat}
                              style={{marginTop:6, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--line)', background:'transparent', fontSize:11, fontWeight:800, color:'var(--brand-3)', cursor:'pointer'}}>
                              🐦 참새와 대화하기
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
  const [archiveOpen, setArchiveOpen] = _useState(false); // 성 컬렉션 책장 상세 (#312)
  const [activeSubtab, setActiveSubtab] = _useState('reading'); // 'wishlist' | 'reading' | 'completed'
  const [myBooks, setMyBooks] = _useState(null);   // null=로딩
  const [wishlistBooks, setWishlistBooks] = _useState([]);
  const [recall, setRecall] = _useState(null);     // 무작위 회상 (§5.8.7)
  // 좋아요한 문장은 내 한 문장 "전체 보기" 컬렉션 모달 내 필터로 이동 (#12)
  const [adminOpen, setAdminOpen] = _useState(false); // 운영 대시보드 (#161)
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
        };
      }));
    }).catch(() => { if (alive) setMyBooks([]); });
    Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
      if (!alive) return;
      setWishlistBooks((rows || []).map(_mapWish));
    }).catch(() => { if (alive) setWishlistBooks([]); });
    // 무작위 한 문장 회상 (§5.8.7)
    Promise.resolve(DataStore.sentences.random()).then(s => { if (alive) setRecall(s || null); }).catch(() => {});
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
        setMyBooks((rows || []).map(ub => { const b = ub.book || {}; return { ubId: ub.id, id: ub.book_id, title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: ub.current_page || 0, status: ub.status, rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at, recap: ub.companion_recap || '' }; }));
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
  // 성(🏰) 컬렉션 = 완독 집합 파생 (§5.2.1/§5.8.1)
  const castles = completedBooks.map(b => ({
    bookId: b.id, title: b.title, author: b.author, cover: b.cover, fb: b.fb,
    rating: b.rating, reviewText: b.comment, completedAt: b.completedAt,
  }))
    .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || ''))); // 최근 완독순

  const allItems = books.concat(wishlistBooks);
  const selectedBook = selectedBookId ? (allItems.find(x => x.id === selectedBookId) || null) : null;

  const tabsData = [
    { id: 'wishlist', label: '❤️ 읽고 싶은 책', books: wishlistBooks },
    { id: 'reading', label: '📖 읽고 있는 책', books: readingBooks },
    { id: 'completed', label: '✅ 읽은 책', books: completedBooks },
  ];

  const currentTab = tabsData.find(t => t.id === activeSubtab);
  const currentBooks = currentTab?.books || [];

  return (
    <section className="view active">
      {/* 프로필 상단 */}
      <div style={{background:'linear-gradient(135deg, var(--brand), var(--brand-3))', color:'white', padding:'20px 16px', marginBottom:20, position:'relative'}}>
        <button onClick={() => window.RG_openSettings && window.RG_openSettings()} title="설정"
          style={{position:'absolute', top:12, right:12, background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:34, height:34, fontSize:17, cursor:'pointer', color:'#fff', lineHeight:1}}>⚙️</button>
        {isAdmin && (
          <button onClick={() => setAdminOpen(true)} title="운영 대시보드"
            style={{position:'absolute', top:12, right:52, background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:34, height:34, fontSize:17, cursor:'pointer', color:'#fff', lineHeight:1}}>📊</button>
        )}
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:24, fontWeight:900}}>🐦 {(window.RG_ME && (window.RG_ME.displayName || window.RG_ME.handle)) || '독자'}</div>
          <div style={{fontSize:13, opacity:0.9, marginTop:4, minHeight:18}}>
            {(window.RG_ME && window.RG_ME.bio) || '한 줄 소개를 설정에서 적어보세요'}
          </div>
          {/* 통계 뱃지 한 줄 — 🏰 ×N · 🔥 N · ⚡ N (§5.8 v7.2) */}
          <div style={{display:'flex', justifyContent:'center', gap:16, marginTop:10, fontSize:14, fontWeight:800, opacity:0.95}}>
            <span>🏰 ×{castles.length}</span>
            <span>🔥 {state.streak || 0}</span>
            <span>⚡ {(state.xp || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 성(🏰) 컬렉션 선반 — 최상단 (§5.8.1, #205). 완독 파생. 둥지 상단 🏰×N 배지가 여기로 연결. */}
      {castles.length > 0 && (
        <div style={{padding:'0 12px', marginTop:16, marginBottom:20}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, paddingLeft:4}}>
            <div style={{fontSize:18, fontWeight:900}}>
              🏰 성 컬렉션 <span style={{fontSize:13, color:'var(--ink-3)', fontWeight:800}}>(완독 {castles.length}권)</span>
            </div>
            <button onClick={() => setArchiveOpen(true)}
              style={{background:'none', border:'none', color:'var(--brand-3)', fontWeight:800, fontSize:13, cursor:'pointer'}}>책장 상세 →</button>
          </div>
          {/* 최근 10권만 미리보기 (#312). 전체는 책장 상세 모달. */}
          <div style={{display:'flex', gap:12, overflowX:'auto', paddingBottom:8, paddingLeft:4, scrollBehavior:'smooth'}}>
            {castles.slice(0, 10).map(c => (
              <div
                key={c.bookId}
                onClick={() => setSelectedBookId(c.bookId)}
                style={{flex:'0 0 auto', width:96, cursor:'pointer'}}
              >
                <BookCover className="book-cover" title={c.title} author={c.author} cover={c.cover} fb={c.fb} radius={8}
                  style={{width:96, height:134, marginBottom:6, boxShadow:'0 2px 6px rgba(0,0,0,0.12)'}} />
                {typeof c.rating === 'number' && (
                  <div style={{fontSize:11, fontWeight:800, color:'var(--ink)'}}>⭐ {c.rating.toFixed(1)}</div>
                )}
                {c.completedAt && (
                  <div style={{fontSize:10, color:'var(--ink-3)', fontWeight:700, marginTop:2}}>{String(c.completedAt).slice(0, 10)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 무작위 한 문장 회상 (§5.8.7) — 과거 내 문장 1개 */}
      {recall && (
        <div
          onClick={() => { const bid = (recall.user_book && recall.user_book.book_id) || recall.book_id; if (bid) setSelectedBookId(bid); }}
          style={{margin:'0 12px 20px', padding:'14px 16px', background:'var(--brand-tint)', border:'1px solid var(--brand)', borderRadius:12, cursor:'pointer'}}
        >
          <div style={{fontSize:12, fontWeight:800, color:'var(--brand-3)', marginBottom:6}}>💭 그때 이런 문장을 남겼어요</div>
          <div style={{fontSize:14, color:'var(--ink)', fontStyle:'italic', lineHeight:1.5, marginBottom:6}}>"{recall.text}"</div>
          <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700}}>
            {(() => { const t = recall.user_book && recall.user_book.book && recall.user_book.book.title; return t ? t + ' · ' : ''; })()}{recall.page}p
          </div>
        </div>
      )}

      {/* 독서 활동 잔디 (#195) — 좌우 여백 축소로 스크롤 방지 (#11) */}
      <div style={{padding:'0 8px', marginBottom:20}}>
        <ActivityHeatmap days={182} />
      </div>

      {/* 내 한 문장 — 최대 10개 + 더 보기(컬렉션 모달, 좋아요 필터 포함) */}
      {state.myQuotes && state.myQuotes.length > 0 && (
        <div style={{padding:'0 12px', marginBottom:20}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingLeft:4}}>
            <div style={{fontSize:18, fontWeight:900}}>🔖 내 한 문장 <span style={{fontSize:13, color:'var(--ink-3)', fontWeight:800}}>({state.myQuotes.length})</span></div>
            {state.myQuotes.length > 10 && (
              <button onClick={() => window.RG_openCollection && window.RG_openCollection()} style={{background:'none', border:'none', color:'var(--brand-3)', fontWeight:800, fontSize:13, cursor:'pointer'}}>더 보기 →</button>
            )}
          </div>
          {state.myQuotes.slice(0, 10).map((q) => (
            <div key={q.id || q.text}
              onClick={() => { if (q.id && window.RG_openCompanion) window.RG_openCompanion({ id: q.id, text: q.text, bookId: q.bookId, bookTitle: q.bookTitle, author: q.author, page: q.page, note: q.note, kind: q.kind }); }}
              style={{background:'var(--card)', border:'1px solid var(--line)', borderRadius:8, padding:12, marginBottom:8, cursor: q.id ? 'pointer' : 'default'}}>
              <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:4}}>{q.bookTitle ? q.bookTitle + ' · ' : ''}{q.page != null ? q.page + 'p' : '페이지 미상'}{q.kind === 'thought' ? ' · 💭 내 생각' : ''}</div>
              {q.kind === 'thought'
                ? <div style={{fontSize:13, color:'var(--ink)', lineHeight:1.5}}>💭 {q.text}</div>
                : <div style={{fontSize:13, color:'var(--ink)', fontStyle:'italic', lineHeight:1.5}}>"{q.text}"</div>}
            </div>
          ))}
          <button onClick={() => window.RG_openCollection && window.RG_openCollection()} style={{display:'block', width:'100%', marginTop:4, padding:'10px', background:'var(--card)', border:'1px solid var(--line)', borderRadius:8, color:'var(--ink-3)', fontWeight:800, fontSize:13, cursor:'pointer', textAlign:'center'}}>전체 보기 · 좋아요 필터 →</button>
        </div>
      )}

      {/* 성 컬렉션은 프로필 최상단(헤더 직후)으로 이동 (#205) */}

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

        {/* 책 목록 */}
        {myBooks === null ? (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>불러오는 중…</div>
        ) : currentBooks.length > 0 ? (
          <div style={{display:'flex', flexDirection:'column', gap:0}}>
            {currentBooks.map(b => {
              const isCompleted = b.status === 'completed';
              const progText = isCompleted
                ? (typeof b.rating === 'number' ? `⭐ ${b.rating.toFixed(1)} / 5 · 완독` : '완독')
                : (b.cur > 0 ? `${b.cur} / ${b.total}p` : '아직 안 펼침');
              return (
                <div
                  key={b.ubId || b.id}
                  className={'shelf-row' + (b.id === state.book.id ? ' active' : '')}
                  onClick={() => setSelectedBookId(b.id)}
                  style={{cursor:'pointer'}}
                >
                  <BookCover className="shelf-cover" title={b.title} author={b.author} cover={b.cover} fb={b.fb} />
                  <div className="shelf-meta">
                    <div className="shelf-title">{b.title}</div>
                    <div className="shelf-prog">{b.status === 'wish' ? (b.author || '읽고 싶은 책') : progText}</div>
                  </div>
                  {b.id === state.book.id && <span className="shelf-active-pill">읽는 중</span>}
                  {b.status === 'wish' && (
                    <button onClick={(e) => removeWish(e, b.id)} title="찜 삭제" aria-label="찜 삭제"
                      style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--ink-3)', padding:'4px 6px', flexShrink:0 }}>✕</button>
                  )}
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
              {activeSubtab === 'completed' && '완독한 책이 없어요'}
            </div>
          </div>
        )}
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
      {archiveOpen && ReactDOM.createPortal(
        <ArchiveShelfModal
          castles={castles}
          onClose={() => setArchiveOpen(false)}
          onSelect={(id) => { setArchiveOpen(false); setSelectedBookId(id); }}
        />,
        document.body
      )}
    </section>
  );
}

/* ── ArchiveShelfModal: 성 컬렉션 책장 상세 (#312) — 5열 그리드 + 검색/정렬/필터 ── */
function ArchiveShelfModal({ castles, onClose, onSelect }) {
  const [q, setQ] = _useState('');
  const [sort, setSort] = _useState('recent'); // recent | rating | title
  const [minRating, setMinRating] = _useState(0);
  const t = (q || '').trim().toLowerCase();
  let list = (castles || []).filter(c => {
    if (t && !((c.title || '').toLowerCase().includes(t) || (c.author || '').toLowerCase().includes(t))) return false;
    if (minRating > 0 && !(typeof c.rating === 'number' && c.rating >= minRating)) return false;
    return true;
  });
  list = list.slice().sort((a, b) => {
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
    return String(b.completedAt || '').localeCompare(String(a.completedAt || ''));
  });
  const sorts = [['recent', '최근순'], ['rating', '별점순'], ['title', '제목순']];
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', width: '100%', maxWidth: 430, height: '92vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>🏰 성 컬렉션 <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 800 }}>(완독 {(castles || []).length}권)</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ padding: '0 18px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="제목·저자 검색"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sorts.map(([id, label]) => (
              <button key={id} onClick={() => setSort(id)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: sort === id ? 'var(--brand)' : 'var(--card)', color: sort === id ? '#fff' : 'var(--ink-2)', boxShadow: sort === id ? 'none' : 'inset 0 0 0 1px var(--line)' }}>{label}</button>
            ))}
            <button onClick={() => setMinRating(minRating >= 4 ? 0 : 4)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: minRating >= 4 ? 'var(--gold)' : 'var(--card)', color: minRating >= 4 ? '#fff' : 'var(--ink-2)', boxShadow: minRating >= 4 ? 'none' : 'inset 0 0 0 1px var(--line)' }}>⭐ 4+</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 24px' }}>
          {list.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: '40px 0', fontSize: 13 }}>조건에 맞는 책이 없어요</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {list.map(c => (
                <div key={c.bookId} onClick={() => onSelect(c.bookId)} style={{ cursor: 'pointer' }}>
                  <BookCover title={c.title} author={c.author} cover={c.cover} fb={c.fb} radius={6}
                    style={{ width: '100%', aspectRatio: '2 / 3', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
                  {typeof c.rating === 'number' && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', marginTop: 3, textAlign: 'center' }}>⭐{c.rating.toFixed(1)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.LibraryView = LibraryView;
window.BookDetailModal = BookDetailModal;
window.ArchiveShelfModal = ArchiveShelfModal;
