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
  const bookQuotes = (allQuotes || []).filter(q => q.bookId === book.id);
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
  const saveMeta = () => {
    if (!book.ubId || !(DataStore.books && DataStore.books.complete)) { setEditMeta(false); return; }
    Promise.resolve(DataStore.books.complete(book.ubId, { rating: rt || null, review_text: (rv || '').trim() || null }))
      .then(() => showToast('완독 정보 저장됨 — 새로고침하면 반영돼요'))
      .catch(() => showToast('저장 실패'));
    setEditMeta(false);
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

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label={book.title}>
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1, zIndex:2}}>✕</button>
        
        <div style={{textAlign:'center', padding:'16px 20px 0'}}>
          <div
            className="book-cover"
            style={{
              width:100,
              height:140,
              background:`linear-gradient(135deg,${book.fb[0]},${book.fb[1]})`,
              borderRadius:'8px',
              margin:'0 auto 12px',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              overflow:'hidden',
            }}
          >
            <img src={book.cover} alt={book.title} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          </div>
          <h2 style={{fontSize:18, fontWeight:900, margin:'0 0 4px', color:'var(--ink)'}}>{book.title}</h2>
          <p style={{fontSize:13, color:'var(--ink-2)', fontWeight:700, margin:'0 0 12px'}}>{book.author} · {book.pub}</p>
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
                  <div role="radiogroup" aria-label="별점" style={{marginBottom:8}}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" aria-pressed={n <= rt} onClick={() => setRt(n === rt ? 0 : n)}
                        style={{background:'none', border:'none', cursor:'pointer', fontSize:22, padding:'0 2px', color: n <= rt ? '#f5b301' : 'var(--line)'}}>★</button>
                    ))}
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
                  <div style={{fontSize:13, color:'var(--ink)', fontWeight:700, marginBottom:8}}>
                    {typeof bookshelfEntry.rating === 'number' ? `⭐ ${bookshelfEntry.rating} / 5` : '별점 없음'}
                  </div>
                  {bookshelfEntry.comment && (
                    <div style={{fontSize:13, color:'var(--ink)', lineHeight:'1.5'}}>{bookshelfEntry.comment}</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 진도 정보 (읽는 중일 때) */}
          {prog.cur > 0 && !bookshelfEntry && (
            <div style={{background:'var(--paper-2)', borderRadius:'8px', padding:'12px 14px', marginBottom:14}}>
              <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:800, marginBottom:6}}>진도</div>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{flex:1, height:8, background:'var(--line)', borderRadius:4, overflow:'hidden'}}>
                  <div style={{height:'100%', background:'var(--brand)', width:`${progressPct}%`, transition:'width 0.3s ease'}} />
                </div>
                <span style={{fontSize:13, fontWeight:800, color:'var(--ink)', minWidth:50}}>{prog.cur} / {book.total}p</span>
              </div>
              <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginTop:6}}>{progressPct}%</div>
            </div>
          )}

          <a href={kyoboUrl} target="_blank" rel="noopener noreferrer" 
             style={{display:'block', textAlign:'center', padding:'12px 14px', background:'var(--brand-tint)', border:'1.5px solid var(--brand)', borderRadius:'8px', color:'var(--brand-3)', fontSize:13, fontWeight:800, textDecoration:'none', marginBottom:14, cursor:'pointer'}}>
            교보문고에서 보기 →
          </a>

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
                        </span>
                      )}
                    </div>
                    {blinded ? (
                      <div className="spoiler-blind" onClick={() => setRevealed(r => ({ ...r, [i]: true }))}>
                        ⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기
                      </div>
                    ) : (
                      <>
                        <div style={{fontSize:13, color:'var(--ink)', fontWeight:400, lineHeight:'1.5', fontStyle:'italic'}}>
                          "{q.text}"
                        </div>
                        {(() => {
                          const note = noteEdits[q.id] !== undefined ? noteEdits[q.id] : (q.note || '');
                          if (editingId === q.id) {
                            return (
                              <div style={{marginTop:8}}>
                                <textarea value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} placeholder="이 문장에 대한 감상… (최대 1000자)" rows={3}
                                  style={{width:'100%', boxSizing:'border-box', padding:8, borderRadius:8, border:'1.5px solid var(--line)', fontSize:13, fontFamily:'inherit', resize:'vertical'}} />
                                <div style={{display:'flex', gap:6, marginTop:6}}>
                                  <button onClick={() => saveNote(q)} style={{padding:'6px 12px', borderRadius:8, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer'}}>저장</button>
                                  <button onClick={() => setEditingId(null)} style={{padding:'6px 12px', borderRadius:8, border:'1px solid var(--line)', background:'transparent', fontSize:12, fontWeight:700, cursor:'pointer'}}>취소</button>
                                </div>
                              </div>
                            );
                          }
                          return note ? (
                            <div style={{marginTop:8}}>
                              <div onClick={() => { if (q.id) { setEditingId(q.id); setDraft(note); } }}
                                style={{padding:'8px 10px', background:'var(--paper-2)', borderRadius:8, fontSize:12, color:'var(--ink-2)', lineHeight:1.5, cursor:'pointer'}}>
                                💬 {note}
                              </div>
                              {q.id && (
                                <button onClick={() => togglePrivNote(q)}
                                  style={{marginTop:4, background:'none', border:'none', color:'var(--ink-3)', fontSize:11, fontWeight:700, cursor:'pointer', padding:'2px 0'}}>
                                  {isPrivNote(q) ? '🔒 감상 비공개' : '🌐 감상 공개'}
                                </button>
                              )}
                            </div>
                          ) : (q.id ? (
                            <button onClick={() => { setEditingId(q.id); setDraft(''); }}
                              style={{marginTop:6, padding:'4px 10px', borderRadius:8, border:'1px dashed var(--line)', background:'transparent', fontSize:11, fontWeight:700, color:'var(--ink-3)', cursor:'pointer'}}>
                              ✏️ 감상 추가
                            </button>
                          ) : null);
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
function LibraryView({ state, onSetActiveBook, onActivateUserBook }) {
  const [selectedBookId, setSelectedBookId] = _useState(null);
  const [activeSubtab, setActiveSubtab] = _useState('reading'); // 'wishlist' | 'reading' | 'completed'
  const [myBooks, setMyBooks] = _useState(null);   // null=로딩
  const [wishlistBooks, setWishlistBooks] = _useState([]);
  const [recall, setRecall] = _useState(null);     // 무작위 회상 (§5.8.7)
  const [favs, setFavs] = _useState(null);         // 좋아요한 문장 (#11)
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
        };
      }));
    }).catch(() => { if (alive) setMyBooks([]); });
    Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
      if (!alive) return;
      setWishlistBooks((rows || []).map(w => {
        const b = w.book || w || {};
        return {
          id: b.id || w.book_id, title: b.title || '', author: b.author || '', pub: b.publisher || '',
          cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0,
          isbn: b.isbn13 || '', cur: 0, status: 'wish',
        };
      }));
    }).catch(() => { if (alive) setWishlistBooks([]); });
    // 무작위 한 문장 회상 (§5.8.7)
    Promise.resolve(DataStore.sentences.random()).then(s => { if (alive) setRecall(s || null); }).catch(() => {});
    // 좋아요한 문장 (#11)
    Promise.resolve((DataStore.bookmarks && DataStore.bookmarks.list) ? DataStore.bookmarks.list() : []).then(rows => { if (alive) setFavs((rows || []).filter(r => r.sentence)); }).catch(() => { if (alive) setFavs([]); });
    return () => { alive = false; };
  }, []);

  const books = myBooks || [];
  const readingBooks = books.filter(b => b.status === 'reading')
    .sort((a, b) => (a.id === state.book.id ? -1 : b.id === state.book.id ? 1 : (b.cur || 0) - (a.cur || 0)));
  const completedBooks = books.filter(b => b.status === 'completed');
  // 성(🏰) 컬렉션 = 완독 집합 파생 (§5.2.1/§5.8.1)
  const castles = completedBooks.map(b => ({
    bookId: b.id, title: b.title, cover: b.cover, fb: b.fb,
    rating: b.rating, reviewText: b.comment, completedAt: b.completedAt,
  }));

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
          <div style={{fontSize:28, fontWeight:900, marginBottom:4}}>🐦 {(window.RG_ME && (window.RG_ME.displayName || window.RG_ME.handle)) || '독자'}</div>
          <div style={{fontSize:13, opacity:0.9, marginBottom:14, minHeight:20}}>
            책 속에서 길을 찾는 중
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, textAlign:'center'}}>
            <div>
              <div style={{fontSize:18, fontWeight:900}}>{state.nest.lv}</div>
              <div style={{fontSize:10, opacity:0.85}}>둥지 레벨</div>
            </div>
            <div>
              <div style={{fontSize:18, fontWeight:900}}>{castles.length}</div>
              <div style={{fontSize:10, opacity:0.85}}>완독</div>
            </div>
            <div>
              <div style={{fontSize:18, fontWeight:900}}>{state.streak}</div>
              <div style={{fontSize:10, opacity:0.85}}>스트릭 🔥</div>
            </div>
            <div>
              <div style={{fontSize:18, fontWeight:900}}>{state.xp}</div>
              <div style={{fontSize:10, opacity:0.85}}>XP</div>
            </div>
          </div>
        </div>
      </div>

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

      {/* 독서 활동 잔디 (#195) */}
      <div style={{padding:'0 12px', marginBottom:20}}>
        <ActivityHeatmap days={182} />
      </div>

      {/* 좋아요한 문장 (#11) — 즐겨찾기한 내 한 문장만 모아보기 */}
      {favs && favs.length > 0 && (
        <div style={{padding:'0 12px', marginBottom:20}}>
          <div style={{fontSize:18, fontWeight:900, marginBottom:12, paddingLeft:4}}>❤️ 좋아요한 문장 <span style={{fontSize:13, color:'var(--ink-3)', fontWeight:800}}>({favs.length})</span></div>
          {favs.map((f) => {
            const se = f.sentence || {};
            const bt = se.user_book && se.user_book.book && se.user_book.book.title;
            return (
              <div key={f.sentence_id} style={{background:'var(--card)', border:'1px solid var(--line)', borderRadius:8, padding:12, marginBottom:8}}>
                <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginBottom:4}}>{bt ? bt + ' · ' : ''}{se.page}p</div>
                <div style={{fontSize:13, color:'var(--ink)', fontStyle:'italic', lineHeight:1.5}}>"{se.text}"</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 성(🏰) 컬렉션 선반 — 완독 파생 (§5.8.1). 둥지 상단 🏰×N 배지가 여기로 연결. */}
      {castles.length > 0 && (
        <div style={{padding:'0 12px', marginBottom:20}}>
          <div style={{fontSize:18, fontWeight:900, marginBottom:12, paddingLeft:4}}>
            🏰 성 컬렉션 <span style={{fontSize:13, color:'var(--ink-3)', fontWeight:800}}>(완독 {castles.length}권)</span>
          </div>
          <div style={{display:'flex', gap:12, overflowX:'auto', paddingBottom:8, paddingLeft:4, scrollBehavior:'smooth'}}>
            {castles.map(c => (
              <div
                key={c.bookId}
                onClick={() => setSelectedBookId(c.bookId)}
                style={{flex:'0 0 auto', width:96, cursor:'pointer'}}
              >
                <div
                  className="book-cover"
                  style={{
                    width:96,
                    height:134,
                    background:`linear-gradient(135deg,${c.fb[0]},${c.fb[1]})`,
                    borderRadius:'8px',
                    overflow:'hidden',
                    marginBottom:6,
                    position:'relative',
                    boxShadow:'0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >
                  <img src={c.cover} alt={c.title} loading="lazy" referrerPolicy="no-referrer"
                       onError={e => e.target.style.display='none'}
                       style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  <span style={{position:'absolute', top:4, right:4, fontSize:16, filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.4))'}} aria-hidden="true">🏰</span>
                </div>
                {typeof c.rating === 'number' && (
                  <div style={{fontSize:11, fontWeight:800, color:'var(--ink)'}}>⭐ {c.rating}</div>
                )}
                {c.reviewText && (
                  <div style={{fontSize:10, color:'var(--ink-2)', fontWeight:600, lineHeight:'1.35', marginTop:2, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                    {c.reviewText}
                  </div>
                )}
                {c.completedAt && (
                  <div style={{fontSize:10, color:'var(--ink-3)', fontWeight:700, marginTop:2}}>{String(c.completedAt).slice(0, 10)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

        {/* 책 목록 */}
        {myBooks === null ? (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>불러오는 중…</div>
        ) : currentBooks.length > 0 ? (
          <div style={{display:'flex', flexDirection:'column', gap:0}}>
            {currentBooks.map(b => {
              const isCompleted = b.status === 'completed';
              const progText = isCompleted
                ? (typeof b.rating === 'number' ? `⭐ ${b.rating} / 5 · 완독` : '완독')
                : (b.cur > 0 ? `${b.cur} / ${b.total}p` : '아직 안 펼침');
              return (
                <div
                  key={b.ubId || b.id}
                  className={'shelf-row' + (b.id === state.book.id ? ' active' : '')}
                  onClick={() => setSelectedBookId(b.id)}
                  style={{cursor:'pointer'}}
                >
                  <div
                    className="shelf-cover"
                    style={{background: `linear-gradient(135deg,${(b.fb && b.fb[0]) || '#9AA7B2'},${(b.fb && b.fb[1]) || '#C7D0D8'})`}}
                  >
                    <img src={b.cover} alt={b.title} loading="lazy" referrerPolicy="no-referrer"
                         onError={e => e.target.style.display='none'} />
                  </div>
                  <div className="shelf-meta">
                    <div className="shelf-title">{b.title}</div>
                    <div className="shelf-prog">{progText}</div>
                  </div>
                  {b.id === state.book.id && <span className="shelf-active-pill">읽는 중</span>}
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
    </section>
  );
}

window.LibraryView = LibraryView;
window.BookDetailModal = BookDetailModal;
