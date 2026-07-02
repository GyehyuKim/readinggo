/* =========================================================
   ReadingGo — book-info-modal.js  (#761 모듈화: components.js에서 추출)
   BookInfoModal: 한 문장의 책 제목 탭 → 책 정보(#11). books.getById 로 단건 조회.
   icons(SectionLabel·rgIcon·RG_SECTION_CARD)·sentence-card(SentenceCard·SentenceActions)·
   components(decodeEntities) **이후** 로드. 의존은 window 전역 alias(옮긴 코드 무수정). 순수 이동.
   ========================================================= */

// loadBabel 파일별 eval 스코프 → 훅·공유유틸·컴포넌트를 window에서 alias(옮긴 코드 무수정, #761).
const { useState, useEffect } = React;
const SectionLabel = window.SectionLabel, rgIcon = window.rgIcon, RG_SECTION_CARD = window.RG_SECTION_CARD;
const SentenceCard = window.SentenceCard, SentenceActions = window.SentenceActions;
const decodeEntities = window.decodeEntities;

function BookInfoModal({ bookId, onClose }) {
  const [bk, setBk] = useState(undefined); // undefined=로딩, null=없음
  const [manualPages, setManualPages] = useState(''); // 쪽수 메타 누락 시 수동 입력 (#204)
  const [desc, setDesc] = useState(''); // 책 소개 (#578) — DB description 우선, 없으면 알라딘 폴백
  const [descSource, setDescSource] = useState(''); // 소개 출처 (#642) — 'llm'이면 AI 작성 칩
  const [popular, setPopular] = useState([]); // 인기 한 문장 Top5 (#594) — 짹 많은 순, 게스트/빈 → []
  const [popularResolved, setPopularResolved] = useState(false); // byBook 응답 도착 여부 (시드 트리거 게이트, #774)
  const [seeding, setSeeding] = useState(false); // 마중물 시드 큐 처리 대기 (#774 큐 방식) — '모으는 중' placeholder 게이트
  const [mySents, setMySents] = useState([]); // 내 한 문장 (#610) — 이 책에 내가 남긴 것 (읽은 책)
  const [shelf, setShelf] = useState(null); // 서재 상태 (#644) — null=미상, 'reading'|'completed'|'aborted'|'wish'|'none'
  const [rooms, setRooms] = useState([]); // 같이읽기 방 (co-reading.md §4.4) — 이 책의 공개 방. 발견→방 진입점.
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.resolve((DS.books && DS.books.getById) ? DS.books.getById(bookId) : null)
      .then(b => { if (alive) setBk(b || null); }).catch(() => { if (alive) setBk(null); });
    return () => { alive = false; };
  }, [bookId]);
  // 서재 상태 판정 (#644) — 이미 내 책(읽는중/완독/중단)이면 발견용 찜·읽기 버튼을 숨겨
  // 홈/책장 동선을 통일한다. 찜만 한 상태면 '읽고 싶어요'만 숨기고 '이 책 읽기'는 유지.
  useEffect(() => {
    if (!bk) { setShelf(null); return; }
    let alive = true;
    const DS = window.DataStore || {};
    const isbn = bk.isbn13 || bk.isbn || '';
    const match = (b) => b && (b.id === bk.id || (isbn && b.isbn13 === isbn));
    Promise.resolve((DS.myBooks && DS.myBooks.list) ? DS.myBooks.list() : [])
      .then(rows => {
        if (!alive) return null;
        const ub = (Array.isArray(rows) ? rows : []).find(u => u.book_id === bk.id || match(u.book));
        if (ub) { setShelf(ub.status || 'reading'); return null; } // 내 책이면 위시 조회 생략
        return Promise.resolve((DS.wishBooks && DS.wishBooks.list) ? DS.wishBooks.list() : []);
      })
      .then(wishes => {
        if (!alive || wishes === null) return;
        const wished = (Array.isArray(wishes) ? wishes : []).some(w => w.book_id === bk.id || match(w.book));
        setShelf(wished ? 'wish' : 'none');
      })
      .catch(() => { if (alive) setShelf('none'); });
    return () => { alive = false; };
  }, [bk]);
  // 인기 한 문장 Top5 (#594) — 그 책 공개 문장 중 짹 많은 순. 게스트·비UUID·빈 결과 → 섹션 생략.
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {};
    setPopularResolved(false);
    Promise.resolve((DS.sentences && DS.sentences.byBook) ? DS.sentences.byBook(bookId, { limit: 5, sort: 'likes' }) : [])
      .then(rows => { if (alive) { setPopular(Array.isArray(rows) ? rows : []); setPopularResolved(true); } })
      .catch(() => { if (alive) { setPopular([]); setPopularResolved(true); } });
    return () => { alive = false; };
  }, [bookId]);
  // 마중물 시드 (#774, 큐 방식) — 인기 한 문장이 0건(빈 책)이면 /api/seed 로 큐잉 트리거 후 byBook 을 짧게 폴링한다.
  // collector(맥미니)가 예스24 발췌를 여러 NPC 명의로 sentences 에 적재하면 폴링이 잡아 popular 에 노출(동기 로딩 없음).
  // 의존성은 popularResolved/bk 만 — 폴링이 setPopular 로 갱신하므로 popular 를 deps 에 넣으면 무한 재실행.
  // 킬 스위치 (#960, config.js FLAGS.seedCollectorTrigger) — collector(백엔드) 장애·과부하 시
  //   배포·롤백 없이 클라발 /api/seed 호출을 즉시 끈다. off면 트리거·폴링 미실행 + seeding=false →
  //   '이웃의 문장 모으는 중' placeholder 도 graceful-skip(빈 섹션 금지). 인기 문장(byBook 읽기)은 별개로 유지.
  useEffect(() => {
    if (!(window.RG_flag && window.RG_flag('seedCollectorTrigger'))) { setSeeding(false); return; }
    if (!bk || !bk.title || !popularResolved || popular.length > 0) { setSeeding(false); return; }
    let alive = true;
    let timer = null;
    const DS = window.DataStore || {};
    setSeeding(true);
    // 1) 큐잉 트리거(동기 대기 안 함). 워커가 seed_queue 에 high 우선순위로 upsert.
    fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: bk.title, author: bk.author || '', isbn: bk.isbn13 || bk.isbn || '', have: popular.length }) }).catch(() => {});
    // 2) byBook 폴링(최대 5회 × 4초) — 채워지면 popular 갱신·중단, 아니면 '모으는 중' 유지.
    const MAX = 5, DELAY = 4000;
    let tries = 0;
    const poll = () => {
      if (!alive) return;
      tries += 1;
      Promise.resolve((DS.sentences && DS.sentences.byBook) ? DS.sentences.byBook(bookId, { limit: 5, sort: 'likes' }) : [])
        .then(rows => {
          if (!alive) return;
          if (Array.isArray(rows) && rows.length) { setPopular(rows); setSeeding(false); return; }
          if (tries < MAX) timer = setTimeout(poll, DELAY); else setSeeding(false);
        })
        .catch(() => { if (alive) { if (tries < MAX) timer = setTimeout(poll, DELAY); else setSeeding(false); } });
    };
    timer = setTimeout(poll, DELAY);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [bk, popularResolved]);
  // 내 한 문장 (#610) — 이 책에 내가 남긴 문장(byBook은 타인 전용이라 listMine 필터). 읽은 책이면 노출.
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {};
    Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : [])
      .then(rows => {
        if (!alive) return;
        const mine = (Array.isArray(rows) ? rows : []).filter(r => ((r.user_book && r.user_book.book_id) || r.book_id) === bookId);
        setMySents(mine.map(r => ({ id: r.id, text: r.text || '', page: r.page, bookId, bookTitle: (r.user_book && r.user_book.book && r.user_book.book.title) || '', visibility: r.visibility, isPrivate: r.is_private, note: r.my_note || '', kind: r.kind })));
      })
      .catch(() => { if (alive) setMySents([]); });
    return () => { alive = false; };
  }, [bookId]);
  // 책 소개 — DB books.description 우선, 비면 알라딘 프록시 폴백 (#578, library.js BookDetailModal §5.8 패턴)
  useEffect(() => {
    if (!bk) { setDesc(''); setDescSource(''); return; }
    const dbDesc = (bk.description || '').trim();
    if (dbDesc) { setDesc(dbDesc); setDescSource(bk.source || ''); return; } // #642: DB 소개의 출처 표기
    let alive = true;
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    const isbn = bk.isbn13 || bk.isbn || '';
    if (!proxy || !isbn) { setDesc(''); setDescSource(''); return; }
    fetch(`${proxy}?isbn=${encodeURIComponent(isbn)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!alive) return; const it = d && Array.isArray(d.items) && d.items[0]; setDesc((it && it.description) ? String(it.description).trim() : ''); setDescSource((it && it.source) || ''); }) // #642: 폴백 응답 source 동반
      .catch(() => { if (alive) { setDesc(''); setDescSource(''); } });
    return () => { alive = false; };
  }, [bk]);
  // 같이읽기 방 (co-reading.md §4.4) — 이 책의 공개 방. badge "이 책 N명 같이 읽는 중".
  useEffect(() => {
    let alive = true; setRooms([]);
    const DS = window.DataStore || {};
    if (!bk || !(DS.rooms && DS.rooms.byBook)) return;
    Promise.resolve(DS.rooms.byBook(bk.id, { limit: 12 }))
      .then(rs => { if (alive) setRooms(Array.isArray(rs) ? rs : []); })
      .catch(() => { if (alive) setRooms([]); });
    return () => { alive = false; };
  }, [bk]);
  // 방 멤버 합계 — N≥2 일 때만 "N명" 노출(1명짜리 과노출 방지, §4.4). 방 0·인원 0 이면 badge 생략.
  const roomMemberTotal = (rooms || []).reduce((n, r) => n + ((r.village_members && r.village_members[0] && r.village_members[0].count) || 0), 0);
  const showRoomBadge = (rooms || []).length > 0 && roomMemberTotal >= 1;
  const openRoomDiscovery = () => {
    // 방 1개면 바로 그 방, 여러 개면 첫 공개 방으로(P1: 단순 — 미리보기 없이 입장 미리보기는 방 탭에서).
    const first = (rooms || [])[0];
    if (first && window.RG_openRoom) { window.RG_openRoom(first.id); onClose && onClose(); }
  };
  const kyoboUrl = bk ? `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(bk.isbn13 || bk.title)}` : '#';
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="책 정보">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', color:'var(--ink-2)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center'}}>{rgIcon('close', 16)}</button>
        {bk === undefined ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
        ) : bk === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>책 정보를 찾을 수 없어요</div>
        ) : (
          <div style={{ padding: '8px 20px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ width: 100, height: 140, margin: '0 auto 12px', borderRadius: 12, overflow: 'hidden', background: 'var(--line)' }}>
                {bk.cover_url && <img src={bk.cover_url} alt={bk.title} referrerPolicy="no-referrer" onError={e => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: 'var(--ink)' }}>{bk.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700, margin: 0 }}>{bk.author}{bk.publisher ? ' · ' + bk.publisher : ''}{bk.total_pages ? ' · ' + bk.total_pages + 'p' : ''}</p>
              {/* 같이읽기 진입점 (co-reading.md §4.4) — 발견 맥락에 "이 책 N명 같이 읽는 중" → 방으로. */}
              {showRoomBadge && (
                <button onClick={openRoomDiscovery}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--brand-soft)', background: 'var(--brand-tint, var(--brand-soft))', color: 'var(--brand-3)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                  {rgIcon('book', 14)} 이 책 {roomMemberTotal >= 2 ? `${roomMemberTotal}명 ` : ''}같이 읽는 중
                </button>
              )}
            </div>
            <a href={kyoboUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--brand-tint)', border: '1.5px solid var(--brand)', borderRadius: 12, color: 'var(--brand-3)', fontSize: 13, fontWeight: 800, textDecoration: 'none', marginBottom: 10 }}>교보문고에서 보기 →</a>
            {/* 책 소개 (#578) — 왜 읽는지 보여 읽고 싶게. DB description 우선·알라딘 폴백, 없으면 섹션 생략. */}
            {desc && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="intro"
                  trailing={descSource === 'llm' && <span title="AI가 작성한 소개예요 · 부정확할 수 있어요" style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ink-3)', background: 'var(--line)', borderRadius: 999, padding: '1px 6px', letterSpacing: 0.3 }}>AI</span>}>
                  책 소개
                </SectionLabel>
                <div style={{ ...RG_SECTION_CARD, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{decodeEntities(desc)}</div>
              </div>
            )}
            {/* 내 한 문장 (#610) — 읽은 책: 내가 남긴 문장 + 공용 SentenceActions(공개범위·좋아요·수정·삭제) */}
            {mySents.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="mine">내 한 문장</SectionLabel>
                {mySents.map(s => (
                  <div key={s.id} style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontFamily: 'var(--font-quote)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>"{decodeEntities(s.text)}"</div>
                    {typeof s.page === 'number' && s.page > 0 ? <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>{s.page}p</div> : null}
                    <SentenceActions sentence={s} mine onRemoved={(rid) => setMySents(m => (m || []).filter(x => x.id !== rid))} />
                  </div>
                ))}
              </div>
            )}
            {/* 이 책의 인기 한 문장 Top5 (#594) — 짹 많은 순, 타인 공개 문장. 읽기 전용(짹 토글·대화 없음).
                게스트·비UUID·빈 결과면 섹션 생략. "왜 읽는지"의 사회적 맥락. */}
            {popular.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="sentence">이 책의 한 문장</SectionLabel>
                {/* 한 문장 액션 계약 (#610·#641) — 타인 문장은 공용 SentenceCard 로 통일(좋아요 보장). 발견 맥락이라 noBlind. */}
                {popular.map(s => {
                  const u = s.user || {};
                  return (
                    <SentenceCard key={s.id} bookId={bk.id} noBlind
                      item={{ id: s.id, q: decodeEntities(s.text || ''), nick: u.handle ? '@' + u.handle : (u.display_name || '익명'), avatar: <window.SparrowMark size={20} />,
                              page: s.page, time: '', claps: s.clapCount || 0, bookId: bk.id, bookTitle: '', isMine: false }} />
                  );
                })}
              </div>
            )}
            {/* 마중물 시드 (#774, 큐 방식) — 공개 문장이 0건이면 collector 가 예스24 발췌를 여러 NPC 명의로
                채우는 중. 채워지면 위 '이 책의 한 문장'(byBook)에 이웃 아바타와 함께 노출된다. 여기선 진행 표시만. */}
            {popular.length === 0 && seeding && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="sentence">🌱 이웃의 문장</SectionLabel>
                <div style={{ background: 'var(--card)', border: '1.5px dashed var(--line)', borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  🌱 이웃의 문장을 모으는 중이에요… 둘러보는 동안 채워둘게요.
                </div>
              </div>
            )}
            {/* 쪽수 메타 누락 시 수동 입력 — 진척률·읽기모드용 (#204) */}
            {!bk.total_pages && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--ink-2)', fontWeight: 700 }}>
                <span>총 쪽수 <small style={{ color: 'var(--ink-3)' }}>(선택 — 모르면 비워둬요)</small></span>
                <input type="number" inputMode="numeric" min="0" max="99999" value={manualPages} placeholder="예: 320"
                  onChange={e => setManualPages(e.target.value)}
                  style={{ width: 80, textAlign: 'center', padding: '6px 4px', border: '1.5px solid var(--line)', borderRadius: 12, fontSize: 14, fontWeight: 800 }} />
                <span>p</span>
              </div>
            )}
            {/* 찜 + 읽기 동선 (#578, #644) — 발견용 액션. 이미 내 책(읽는중/완독/중단)이면 숨겨
                홈/책장 상세 동선을 통일. 찜만 한 상태면 '읽고 싶어요'는 생략하고 '이 책 읽기'만 노출.
                서재 상태 조회 전(shelf===null)에는 깜빡임 방지를 위해 버튼을 그리지 않는다. */}
            {(shelf === 'none' || shelf === 'wish') && (
              <div style={{ display: 'flex', gap: 8, margin: '4px 0 0' }}>
                {shelf === 'none' && (
                  <button onClick={() => { if (window.RG_addBookToShelf) window.RG_addBookToShelf(bk, 'wish'); onClose(); }}
                    style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid var(--brand)', background: 'var(--brand-tint)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{rgIcon('bookmark', 15)} 읽고 싶어요</button>
                )}
                <button className="submit-btn" style={{ flex: 1, margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { if (window.RG_registerBook) { const tp = bk.total_pages || (parseInt(manualPages, 10) || 0); window.RG_registerBook({ ...bk, total_pages: tp }); } onClose(); }}>{rgIcon('book', 15)} 이 책 읽기</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
window.BookInfoModal = BookInfoModal;
