/* =========================================================
   ReadingGo — co-reading.js
   같이읽기(숲) — co-reading.md. '함께' 탭 ② 숲 레이어 + 숲 내부 + P2 등록 글루.
   - RoomsView      : 숲 목록(참여 중·추천) + 숲 찾기/만들기 진입 (§4.2)
   - FindRoomSheet  : 코드·링크 / 책으로 검색 (§4.3)
   - CreateRoomSheet: 책·이름·공개설정·정원·비밀번호 (§5.1)
   - RoomPreviewSheet: 참여 전 미리보기 + 비밀번호 (§4.5)
   - RoomModal      : 숲 내부 — 멤버 진척 그리드 + 한 문장 (§5.3)
   - P2(§7.5): 책 등록 시 기본 = 같이+공개(opt-out). rgCoReadMode/rgAutoJoinPublicRoom.
   데이터는 DataStore.rooms.* (어댑터 추상화, 직접 저장소 호출 금지 — backend.md §7.2).
   둥지(개인 홈)에서 나와 같은 책의 "숲"으로 모인다 (명칭 확정 #987, §8).
   ⚠ 코드 식별자(rooms.*·CSS .rg-room-*·함수명·RG_openRoom)는 방→숲 명칭 변경 대상 아님
     (회귀·churn 방지). 화면에 보이는 텍스트만 "숲".
   ========================================================= */

/* ── P2(§7.5) 같이읽기 모드 — 책 등록 기본값 = 같이+공개(opt-out) ──────────
   "함께 설정해두고 공개로 열면 알아서 붙어서 읽는다." 사용자 의도(=만남이 기본).
   저장은 DataStore.coReadMode.* (어댑터 — consent 선례, 직접 localStorage 금지 §S1).
   'together'(기본=같이+공개) | 'solo'(혼자, 숲 합류 안 함·조용히 읽음).
   프라이버시 트레이드오프: together 면 그 책 숲에서 "읽는 중"이 보인다(되돌릴 수 있음). */
function rgCoReadMode() {
  const DS = window.DataStore || {};
  if (DS.coReadMode && DS.coReadMode.get) { try { return DS.coReadMode.get() === 'solo' ? 'solo' : 'together'; } catch (e) {} }
  return 'together';
}
function rgSetCoReadMode(mode) {
  const v = mode === 'solo' ? 'solo' : 'together';
  const DS = window.DataStore || {};
  if (DS.coReadMode && DS.coReadMode.set) { try { DS.coReadMode.set(v); } catch (e) {} }
  try { window.dispatchEvent(new CustomEvent('rg:coread-mode-changed', { detail: { mode: v } })); } catch (e) {}
  return v;
}

/* 책 등록 시 공개 숲 자동 합류 (§7.5) — together 모드일 때만 호출.
   ① rooms.byBook 으로 그 책의 기존 공개 숲을 찾아 있으면 join(인원 많은 곳 우선)
   ② 없으면 rooms.create({visibility:'public'}) 로 새 공개 숲을 만들어 합류 = "알아서 붙어서 읽는다".
   가드: solo 모드·book id 없음 → no-op(null). 게스트/로컬은 어댑터가 로컬 숲만 다룸(표면 일치).
   P1 rooms.* 계약만 재사용(새 저장소 직접호출·새 테이블 없음). 실패해도 등록은 막지 않음. */
async function rgAutoJoinPublicRoom(book, opts) {
  const force = !!(opts && opts.force);
  if (!force && rgCoReadMode() === 'solo') return null;        // 혼자 모드 = 합류 안 함
  const DS = window.DataStore || {};
  if (!(DS.rooms && DS.rooms.byBook && DS.rooms.join && DS.rooms.create)) return null;
  const bk = book || {};
  const bookId = bk.id || bk.book_id || '';
  const title = bk.title || '';
  if (!bookId && !title) return null;
  try {
    // 이미 이 책 공개 숲에 들어가 있으면 새로 만들지 않는다(myRooms 교차 확인 — 중복 숲 방지).
    let mine = [];
    try { mine = (DS.rooms.myRooms ? await DS.rooms.myRooms() : []) || []; } catch (e) { mine = []; }
    const minePublic = mine.find(r => r && r.visibility === 'public' &&
      ((r.book && (r.book.id === bookId || r.book.title === title)) || r.book_id === bookId));
    if (minePublic) return minePublic;
    // ① 기존 공개 숲 — 인원 많은 곳 우선(빈 숲보다 사람 있는 숲), 정원 여유 있는 곳.
    const existing = (await DS.rooms.byBook(bookId, { limit: 12 })) || [];
    if (existing.length) {
      const cnt = (r) => (r.village_members && r.village_members[0] && r.village_members[0].count) || 0;
      const sorted = existing.slice().sort((a, b) => cnt(b) - cnt(a));
      const target = sorted.find(r => !r.capacity || cnt(r) < r.capacity) || sorted[0];
      if (target && target.id) {
        await DS.rooms.join(target.id, {});
        if (window.RG_roomsChanged) window.RG_roomsChanged();
        return target;
      }
    }
    // ② 없으면 공개 숲 새로 — "《제목》 같이 읽어요".
    const room = await DS.rooms.create({
      bookId, name: title ? `《${title}》 같이 읽어요` : '같이 읽어요', visibility: 'public',
    });
    if (window.RG_roomsChanged) window.RG_roomsChanged();
    return room || null;
  } catch (e) { return null; }   // 실패해도 등록 자체는 막지 않음(조용히)
}

/* ── 둥지 단계 이모지: 숲 책 진척% → 5단계 (nest.md §5.2 SSOT 이모지) ──
   멤버 그리드는 "숲 지정 책의 진척 단계"를 보여준다(개인 XP 둥지와 다른 책-진척 매핑).
   진척% 5구간으로 🌿🪹🪺🐣🏰 (NEST_STAGES 이모지 시퀀스 재사용). */
function rgRoomNestEmoji(pct) {
  const stages = (window.NEST_STAGES || []).map(s => s.short);
  const seq = stages.length === 5 ? stages : ['🌿', '🪹', '🪺', '🐣', '🏰'];
  const p = Math.max(0, Math.min(100, pct || 0));
  if (p >= 100) return seq[4];
  if (p >= 70) return seq[3];
  if (p >= 40) return seq[2];
  if (p >= 10) return seq[1];
  return seq[0];
}

// 숲 카드 표시용 집계 — members 배열에서 인원·오늘 읽은 수·평균 진도%.
function rgRoomStats(members, book) {
  const list = Array.isArray(members) ? members : [];
  const total = (book && (book.total_pages || book.total)) || 0;
  const count = list.length;
  let todayCount = 0, pctSum = 0;
  list.forEach(m => {
    const u = m.user || m;
    if (u.todayRecorded) todayCount++;
    const page = u.cumulativePage || 0;
    pctSum += total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;
  });
  return { count, todayCount, avgPct: count ? Math.round(pctSum / count) : 0 };
}

// ●●●●○○ 오늘 불빛 — 읽은 수만큼 채움(최대 8개 표시).
function RoomTodayDots({ today, count }) {
  const cap = Math.min(8, Math.max(count || 0, 0));
  const on = Math.min(today || 0, cap);
  if (!cap) return null;
  return (
    <span style={{ letterSpacing: '1px', fontSize: 11 }} aria-label={`오늘 ${on}명 읽음`}>
      <span style={{ color: 'var(--gold)' }}>{'●'.repeat(on)}</span>
      <span style={{ color: 'var(--line)' }}>{'○'.repeat(cap - on)}</span>
    </span>
  );
}

/* ── 숲 찾기 시트 (§4.3) — 코드·링크 / 책으로 검색 ────────────── */
function FindRoomSheet({ onClose, onPreview }) {
  const { useState } = React;
  const [tab, setTab] = useState('code'); // 'code' | 'book'
  const [codeInput, setCodeInput] = useState('');
  const [bq, setBq] = useState('');
  const [results, setResults] = useState(null); // null=초기, []=빈
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 입력에서 토큰/코드 추출 — 링크면 마지막 경로 세그먼트, 아니면 그대로.
  const parseToken = (raw) => {
    const t = (raw || '').trim();
    if (!t) return { token: '', code: '' };
    const m = t.match(/\/r\/([A-Za-z0-9]+)/);
    if (m) return { token: m[1], code: '' };
    // 6자리 영숫자면 코드, 그 외 긴 문자열은 토큰으로 시도
    if (/^[A-Za-z0-9]{6}$/.test(t)) return { token: '', code: t };
    return { token: t, code: '' };
  };

  const submitCode = async () => {
    setErr(''); setBusy(true);
    try {
      const { token, code } = parseToken(codeInput);
      let room = null;
      if (token && DataStore.rooms.findByToken) room = await DataStore.rooms.findByToken(token);
      if (!room && code && DataStore.rooms.findByCode) room = await DataStore.rooms.findByCode(code);
      if (!room) { setErr('숲을 찾을 수 없어요. 코드나 링크를 다시 확인해주세요.'); return; }
      onPreview(room);
    } catch (e) { setErr('숲을 찾을 수 없어요. 코드나 링크를 다시 확인해주세요.'); }
    finally { setBusy(false); }
  };

  const searchBook = async (q) => {
    setBq(q);
    const term = (q || '').trim();
    if (!term) { setResults(null); return; }
    try {
      // 책으로 공개 숲 검색 — 먼저 카탈로그에서 책 후보를 찾고 그 책들의 공개 숲을 모은다.
      const books = (typeof window.fuzzySearch === 'function' && window.ALL_BOOKS)
        ? window.fuzzySearch(window.ALL_BOOKS, term).slice(0, 8) : [];
      const seen = new Set(); const rooms = [];
      // 책 후보별 byBook (병렬)
      const lists = await Promise.all(books.map(b => Promise.resolve(DataStore.rooms.byBook(b.id, { limit: 10 })).catch(() => [])));
      lists.forEach(arr => (arr || []).forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); rooms.push(r); } }));
      // 제목 직접 매칭 폴백(임베드 책 제목으로 한번 더 거른다)
      const tl = term.toLowerCase();
      const filtered = rooms.filter(r => {
        const bk = r.book || {};
        return [bk.title, bk.author].some(x => (x || '').toLowerCase().includes(tl)) || books.length > 0;
      });
      setResults(filtered);
    } catch (e) { setResults([]); }
  };

  return (
    <div className="rg-room-sheet-backdrop" onClick={onClose}>
      <div className="rg-room-sheet" onClick={e => e.stopPropagation()}>
        <div className="rg-room-sheet-head">
          <strong>숲 찾기</strong>
          <button className="rg-room-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="rg-room-segor" style={{ margin: '0 0 14px' }}>
          <button className={'rg-seg' + (tab === 'code' ? ' on' : '')} onClick={() => setTab('code')}>{window.rgIcon('lock', 14)} 코드·링크</button>
          <button className={'rg-seg' + (tab === 'book' ? ' on' : '')} onClick={() => setTab('book')}>{window.rgIcon('globe', 14)} 책으로 검색</button>
        </div>
        {tab === 'code' ? (
          <div>
            <input value={codeInput} onChange={e => { setCodeInput(e.target.value); setErr(''); }}
              placeholder="초대 코드 또는 링크 붙여넣기" autoFocus
              className="rg-room-input" />
            {err ? <p className="rg-room-err">{err}</p> : null}
            <button className="rg-btn-primary" disabled={!codeInput.trim() || busy} onClick={submitCode} style={{ marginTop: 10 }}>
              {busy ? '확인 중…' : '참여하기'}
            </button>
          </div>
        ) : (
          <div>
            <input value={bq} onChange={e => searchBook(e.target.value)}
              placeholder="책 제목 · 저자 · ISBN 검색…" autoFocus className="rg-room-input" />
            <div style={{ marginTop: 10, maxHeight: '40vh', overflowY: 'auto' }}>
              {results === null ? (
                <p className="rg-room-hint">읽고 싶은 책으로 같이 읽는 숲을 찾아보세요.</p>
              ) : results.length === 0 ? (
                <p className="rg-room-hint">이 책을 같이 읽는 공개 숲이 없어요. 직접 만들어볼까요?</p>
              ) : results.map(r => (
                <RoomListRow key={r.id} room={r} onTap={() => onPreview(r)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 숲 만들기 시트 (§5.1) ─────────────────────────────────── */
function CreateRoomSheet({ onClose, onCreated }) {
  const { useState, useEffect } = React;
  const [step, setStep] = useState('book'); // 'book' | 'detail'
  const [book, setBook] = useState(null);
  const [bq, setBq] = useState('');
  const [bres, setBres] = useState([]);
  const [myBooks, setMyBooks] = useState([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [useCapacity, setUseCapacity] = useState(false);
  const [capacity, setCapacity] = useState(8);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : [])
      .then(list => setMyBooks((list || []).filter(ub => ub.book)))
      .catch(() => setMyBooks([]));
  }, []);

  useEffect(() => {
    const term = bq.trim();
    if (!term || !window.ALL_BOOKS) { setBres([]); return; }
    const t = setTimeout(() => {
      const r = (typeof window.fuzzySearch === 'function') ? window.fuzzySearch(window.ALL_BOOKS, term).slice(0, 12) : [];
      setBres(r);
    }, 200);
    return () => clearTimeout(t);
  }, [bq]);

  const pickBook = (b) => {
    // 카탈로그 row({id,title,...}) 또는 user_book({book:{...}, book_id}) 모두 수용.
    const bk = b.book ? { ...b.book, id: b.book.id || b.book_id } : b;
    setBook({ id: bk.id, title: bk.title, author: bk.author, cover: bk.cover || bk.cover_url, total: bk.total || bk.total_pages });
    if (!name) setName(`《${bk.title}》 같이 읽어요`);
    setStep('detail');
  };

  const create = async () => {
    setErr('');
    if (!book || !name.trim()) { setErr('숲 이름을 입력해주세요.'); return; }
    if (useCapacity && capacity < 2) { setErr('정원은 최소 2명이에요.'); return; }
    setBusy(true);
    try {
      const room = await DataStore.rooms.create({
        bookId: book.id, name: name.trim(), visibility,
        capacity: useCapacity ? Number(capacity) : null,
        password: (visibility === 'private' && usePassword) ? password.trim() : null,
      });
      if (window.showToast) window.showToast('숲을 만들었어요', { sparrow: true });
      onCreated(room);
    } catch (e) { setErr((e && e.message) || '숲을 만들지 못했어요.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rg-room-sheet-backdrop" onClick={onClose}>
      <div className="rg-room-sheet" onClick={e => e.stopPropagation()}>
        <div className="rg-room-sheet-head">
          <strong>{step === 'book' ? '어떤 책을 같이 읽을까요?' : '숲 만들기'}</strong>
          <button className="rg-room-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        {step === 'book' ? (
          <div>
            {myBooks.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p className="rg-room-label">내 책장에서</p>
                <div style={{ maxHeight: '24vh', overflowY: 'auto' }}>
                  {myBooks.map(ub => (
                    <button key={ub.id || ub.book_id} className="rg-room-bookrow" onClick={() => pickBook(ub)}>
                      <BookCover title={ub.book.title} author={ub.book.author} cover={ub.book.cover_url} radius={4} style={{ width: 30, height: 43 }} />
                      <span className="rg-room-bookmeta">
                        <span className="rg-room-booktitle">{ub.book.title}</span>
                        <span className="rg-room-bookauthor">{ub.book.author}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="rg-room-label">검색해서 찾기</p>
            <input value={bq} onChange={e => setBq(e.target.value)} placeholder="책 제목 · 저자로 검색…" className="rg-room-input" />
            <div style={{ marginTop: 8, maxHeight: '30vh', overflowY: 'auto' }}>
              {bres.map(b => (
                <button key={b.id} className="rg-room-bookrow" onClick={() => pickBook(b)}>
                  <BookCover title={b.title} author={b.author} cover={b.cover} radius={4} style={{ width: 30, height: 43 }} />
                  <span className="rg-room-bookmeta">
                    <span className="rg-room-booktitle">{b.title}</span>
                    <span className="rg-room-bookauthor">{b.author}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button className="rg-room-bookrow" onClick={() => setStep('book')} style={{ marginBottom: 12 }}>
              <BookCover title={book.title} author={book.author} cover={book.cover} radius={4} style={{ width: 36, height: 51 }} />
              <span className="rg-room-bookmeta">
                <span className="rg-room-booktitle">{book.title}</span>
                <span className="rg-room-bookauthor" style={{ color: 'var(--brand-3)' }}>책 바꾸기</span>
              </span>
            </button>
            <p className="rg-room-label">숲 이름</p>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="숲 이름" className="rg-room-input" maxLength={40} />

            <p className="rg-room-label" style={{ marginTop: 14 }}>공개 설정</p>
            <div className="rg-room-segor">
              <button className={'rg-seg' + (visibility === 'public' ? ' on' : '')} onClick={() => setVisibility('public')}>{window.rgIcon('globe', 14)} 공개</button>
              <button className={'rg-seg' + (visibility === 'private' ? ' on' : '')} onClick={() => setVisibility('private')}>{window.rgIcon('lock', 14)} 비공개</button>
            </div>
            <p className="rg-room-hint" style={{ marginTop: 6 }}>
              {visibility === 'public' ? '책으로 검색하면 누구나 이 숲을 찾을 수 있어요.' : '초대 링크·코드를 받은 사람만 들어와요.'}
            </p>

            <label className="rg-room-toggle-row">
              <input type="checkbox" checked={useCapacity} onChange={e => setUseCapacity(e.target.checked)} />
              <span>정원 정하기</span>
              {useCapacity && (
                <input type="number" min={2} max={50} value={capacity}
                  onChange={e => setCapacity(e.target.value)} className="rg-room-num" />
              )}
            </label>

            {visibility === 'private' && (
              <label className="rg-room-toggle-row">
                <input type="checkbox" checked={usePassword} onChange={e => setUsePassword(e.target.checked)} />
                <span>비밀번호 걸기</span>
                {usePassword && (
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호" className="rg-room-num" style={{ width: 110 }} />
                )}
              </label>
            )}

            {err ? <p className="rg-room-err">{err}</p> : null}
            <button className="rg-btn-primary" disabled={busy} onClick={create} style={{ marginTop: 14 }}>
              {busy ? '만드는 중…' : '숲 만들기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 숲 미리보기 시트 (§4.5) — 참여 전 + 비밀번호 ─────────────── */
function RoomPreviewSheet({ room, onClose, onJoined }) {
  const { useState } = React;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const book = room.book || {};
  const cnt = (room.village_members && room.village_members[0] && room.village_members[0].count) || 0;
  const me = window.RG_ME && window.RG_ME.id;
  const alreadyIn = !!(me && (room._members ? room._members.includes(me) : false));
  const full = room.capacity ? cnt >= room.capacity : false;
  // 비번 걸린 방인지 = has_password 플래그(비-비밀, #996). 해시·평문은 클라가 못 읽는다 —
  // 입력칸 노출 여부만 이 플래그로 판단하고, 실제 검증은 서버(room_verify_password)가 한다.
  const needsPw = !!room.has_password;

  const join = async () => {
    setErr(''); setBusy(true);
    try {
      await DataStore.rooms.join(room.id, { password: needsPw ? password.trim() : undefined });
      if (window.showToast) window.showToast('숲에 들어왔어요', { sparrow: true });
      onJoined(room);
    } catch (e) {
      const m = (e && e.message) || '';
      setErr(m.includes('비밀번호') ? '비밀번호가 맞지 않아요.' : (m.includes('정원') ? '정원이 마감되었습니다.' : '참여하지 못했어요.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="rg-room-sheet-backdrop" onClick={onClose}>
      <div className="rg-room-sheet" onClick={e => e.stopPropagation()}>
        <div className="rg-room-sheet-head">
          <strong>숲 발견!</strong>
          <button className="rg-room-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <BookCover title={book.title} author={book.author} cover={book.cover_url} radius={6} style={{ width: 52, height: 74 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{room.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>
              {book.title || ''}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
              인원 {cnt}{room.capacity ? ` / ${room.capacity}` : ''}명
            </div>
          </div>
        </div>
        {needsPw && !alreadyIn && (
          <div style={{ marginBottom: 10 }}>
            <input type="text" value={password} onChange={e => { setPassword(e.target.value); setErr(''); }}
              placeholder="🔒 비밀번호" className="rg-room-input" />
          </div>
        )}
        {err ? <p className="rg-room-err">{err}</p> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="rg-btn-tonal" onClick={onClose} style={{ flex: '0 0 auto', minWidth: 88 }}>취소</button>
          {alreadyIn ? (
            <button className="rg-btn-primary" disabled style={{ flex: 1 }}>참여 중</button>
          ) : full ? (
            <button className="rg-btn-primary" disabled style={{ flex: 1 }}>정원 마감</button>
          ) : (
            <button className="rg-btn-primary" disabled={busy || (needsPw && !password.trim())} onClick={join} style={{ flex: 1 }}>
              {busy ? '참여 중…' : '참여하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 숲 목록 1행 (검색 결과·추천 공용) — 표지·이름·인원·평균 + 참여 CTA
function RoomListRow({ room, onTap }) {
  const book = room.book || {};
  const cnt = (room.village_members && room.village_members[0] && room.village_members[0].count) || 0;
  return (
    <button className="rg-room-listrow" onClick={onTap}>
      <BookCover title={book.title} author={book.author} cover={book.cover_url} radius={4} style={{ width: 28, height: 40 }} />
      <span className="rg-room-listmeta">
        <span className="rg-room-listname">{room.name}</span>
        <span className="rg-room-listsub">{cnt}명{book.title ? ` · ${book.title}` : ''}</span>
      </span>
      <span className="rg-room-listcta">참여하기</span>
    </button>
  );
}

/* ── 추천 랭킹 (§7.6 auto-match) — 인원순 + 갓 생긴 숲 1개 끼움 ──────────
   "이 숲 어때요?" 권유용 정렬. 강제 join 아님(탭하면 미리보기). 입력 pool 은 이미
   내 숲 제외·dedup 된 후보들. 규칙:
     ① 멤버 인원수 desc(동률은 최신 created_at) — 사람 있는 숲을 위로.
     ② rich-get-richer 완화: 후보 중 가장 최근 생긴 숲 1개를 결과에 반드시 포함
        (인원순 정렬에서 limit 밖으로 밀렸어도 끼워 넣는다). 이미 상위에 있으면 그대로.
   limit 지정 시 그 길이를 지키되, 신규 숲 슬롯은 보존(상위에 없으면 마지막 자리를 양보).
   byBook 가 인원순 정렬을 이미 하지만, 합집합(여러 책) pool 은 재정렬이 필요하므로 여기서 통일. */
function rgRankRecommendedRooms(pool, opts) {
  const list = Array.isArray(pool) ? pool.slice() : [];
  if (list.length <= 1) return list;
  const cnt = (r) => (r.village_members && r.village_members[0] && r.village_members[0].count) || 0;
  const ts = (r) => { const t = Date.parse(r && r.created_at); return isNaN(t) ? 0 : t; };
  // ① 인원순 desc, 동률 최신순.
  const ranked = list.sort((a, b) => (cnt(b) - cnt(a)) || (ts(b) - ts(a)));
  const limit = opts && opts.limit;
  const capped = limit ? ranked.slice(0, limit) : ranked;
  // ② 갓 생긴 숲(최신 created_at) 1개가 결과에 없으면 끼운다(인기 숲만 비대해지는 것 완화).
  let newest = null;
  for (const r of list) { if (!newest || ts(r) > ts(newest)) newest = r; }
  if (newest && !capped.some(r => r.id === newest.id)) {
    if (limit && capped.length >= limit) capped[capped.length - 1] = newest; // 마지막 자리를 신규에 양보
    else capped.push(newest);
  }
  return capped;
}

/* ── 책 상세 "이 책 같이 읽는 숲" 추천 한 줄 (§4.4·§7.6) ───────────────
   BookDetailModal/BookInfoModal 에서 그 책의 공개 숲이 있을 때만 노출되는 소형 권유.
   강제 join 아님 — 탭하면 가장 사람 많은(추천 상위) 숲으로 입장(RG_openRoom).
   공개 숲 0 이면 아무것도 렌더 안 함(섹션 자체 생략 — 빈 박스 금지). */
function BookCoReadRow({ bookId, onOpen }) {
  const { useState, useEffect } = React;
  const [rooms, setRooms] = useState(null);   // null=로딩, []=없음
  useEffect(() => {
    let alive = true; setRooms(null);
    const DS = window.DataStore || {};
    if (!bookId || !(DS.rooms && DS.rooms.byBook)) { setRooms([]); return () => { alive = false; }; }
    Promise.resolve(DS.rooms.byBook(bookId, { limit: 6 }))
      .then(rs => { if (alive) setRooms(rgRankRecommendedRooms(Array.isArray(rs) ? rs : [], { limit: 3 })); })
      .catch(() => { if (alive) setRooms([]); });
    return () => { alive = false; };
  }, [bookId]);
  if (!rooms || rooms.length === 0) return null;   // 로딩·없음 = 미노출(존재할 때만)
  const top = rooms[0];
  const cnt = (r) => (r.village_members && r.village_members[0] && r.village_members[0].count) || 0;
  const total = rooms.reduce((n, r) => n + cnt(r), 0);
  const open = () => {
    if (onOpen) return onOpen(top);
    if (window.RG_openRoom) window.RG_openRoom(top.id);
  };
  return (
    <button type="button" className="rg-coread-rec" onClick={open}>
      <span className="rg-coread-rec-emoji" aria-hidden="true">🌳</span>
      <span className="rg-coread-rec-meta">
        <span className="rg-coread-rec-title">이 책 같이 읽는 숲</span>
        <span className="rg-coread-rec-sub">
          {rooms.length > 1 ? `${rooms.length}개 숲 · ` : ''}{total >= 2 ? `${total}명 함께 읽는 중` : '같이 읽어볼까요?'}
        </span>
      </span>
      <span className="rg-coread-rec-cta">들어가기 →</span>
    </button>
  );
}

/* ── 들어간 숲 카드 (members 로드해 불빛·평균) ─────────────── */
function MyRoomCard({ room, onOpen }) {
  const { useState, useEffect } = React;
  const [stats, setStats] = useState(null);
  const book = room.book || {};
  useEffect(() => {
    let alive = true;
    Promise.resolve(DataStore.rooms.members(room.id))
      .then(ms => { if (alive) setStats(rgRoomStats(ms, book)); })
      .catch(() => { if (alive) setStats({ count: 0, todayCount: 0, avgPct: 0 }); });
    return () => { alive = false; };
  }, [room.id]);
  const cnt = (stats && stats.count) || ((room.village_members && room.village_members[0] && room.village_members[0].count) || 0);
  return (
    <button className="rg-room-card" onClick={() => onOpen(room)}>
      <BookCover title={book.title} author={book.author} cover={book.cover_url} radius={6} style={{ width: 44, height: 63 }} />
      <div className="rg-room-cardbody">
        <div className="rg-room-cardname">{room.name}</div>
        <div className="rg-room-cardline">
          <span>{cnt}명</span>
          {stats ? <><span>·</span><span>오늘 {stats.todayCount}명</span><RoomTodayDots today={stats.todayCount} count={cnt} /></> : null}
        </div>
        {stats ? <div className="rg-room-cardpct">평균 진도 {stats.avgPct}%</div> : null}
      </div>
    </button>
  );
}

/* ── P2(§7.5) 같이읽기 모드 토글 — 등록 기본 = 같이+공개(opt-out) ──────────
   되돌릴 수 있는 명확한 스위치. 프라이버시 트레이드오프(공개=읽는 중 보임)를 그 자리에서 알린다.
   숲 탭 상단에 상주 + 'rg:coread-mode-changed' 로 다른 화면(등록 시트)과 동기화. */
function CoReadModeToggle() {
  const { useState, useEffect } = React;
  const [mode, setMode] = useState(rgCoReadMode());
  useEffect(() => {
    const sync = () => setMode(rgCoReadMode());
    window.addEventListener('rg:coread-mode-changed', sync);
    return () => window.removeEventListener('rg:coread-mode-changed', sync);
  }, []);
  const together = mode !== 'solo';
  const flip = () => setMode(rgSetCoReadMode(together ? 'solo' : 'together'));
  return (
    <div className="rg-coread-mode" role="group" aria-label="같이읽기 기본 설정">
      <button className="rg-coread-mode-btn" onClick={flip}
        aria-pressed={together} title={together ? '공개로 같이 읽는 중 — 끄면 혼자 읽어요' : '혼자 읽는 중 — 켜면 같은 책 공개 숲에 자동으로 함께해요'}>
        <span className="rg-coread-mode-emoji" style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 8, background: 'var(--brand-tint)', color: 'var(--brand-3)', alignItems: 'center', justifyContent: 'center' }}>
          {together
            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 6.8 11H9.6L5.4 17h13.2L14.4 11H17.2L12 3Z" /><path d="M12 17v4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}
        </span>
        <span className="rg-coread-mode-text">
          <span className="rg-coread-mode-title">{together ? '공개로 같이 읽기' : '혼자 읽기'}</span>
          <span className="rg-coread-mode-sub">
            {together ? '새 책은 같은 책 공개 숲에 자동으로 함께해요 · 읽는 중이 보여요' : '숲에 합류하지 않고 조용히 읽어요'}
          </span>
        </span>
        <span className={'rg-coread-switch' + (together ? ' on' : '')} aria-hidden="true"><span className="rg-coread-knob" /></span>
      </button>
    </div>
  );
}

/* ── 숲 탭 메인 (§4.2) ─────────────────────────────────────── */
function RoomsView() {
  const { useState, useEffect, useCallback } = React;
  const [mine, setMine] = useState(null);
  const [recommended, setRecommended] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  const reload = useCallback(() => {
    Promise.resolve(DataStore.rooms.myRooms()).then(r => setMine(r || [])).catch(() => setMine([]));
    // 추천(§7.6 auto-match) = 내 활성책을 같이 읽는 공개 숲. 강제 join 아님 — "이 숲 어때요?" 권유.
    //   내 책장 활성책별 byBook 합집합 → dedup(내 숲 제외) → rgRankRecommendedRooms(인원순 + 신규 1개 끼움).
    Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : [])
      .then(async (books) => {
        const reading = (books || []).filter(ub => (ub.status || 'reading') === 'reading' && ub.book).slice(0, 6);
        if (!reading.length) { setRecommended([]); return; }
        const lists = await Promise.all(reading.map(ub =>
          Promise.resolve(DataStore.rooms.byBook(ub.book_id || (ub.book && ub.book.id), { limit: 6 })).catch(() => [])));
        const myIds = new Set((mine || []).map(r => r.id));
        const seen = new Set(); const pool = [];
        lists.forEach(arr => (arr || []).forEach(r => { if (!seen.has(r.id) && !myIds.has(r.id)) { seen.add(r.id); pool.push(r); } }));
        setRecommended(rgRankRecommendedRooms(pool, { limit: 5 }));
      })
      .catch(() => setRecommended([]));
  }, [mine]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  // P2 자동합류·나가기 등 외부 변경 시 목록 갱신 (RG_roomsChanged 브로드캐스트 수신).
  useEffect(() => {
    const onChanged = () => reload();
    window.RG_roomsChanged = onChanged;
    window.addEventListener('rg:rooms-changed', onChanged);
    return () => { if (window.RG_roomsChanged === onChanged) window.RG_roomsChanged = null; window.removeEventListener('rg:rooms-changed', onChanged); };
  }, [reload]);

  const openRoom = (room) => { if (window.RG_openRoom) window.RG_openRoom(room.id); };
  const onJoined = (room) => { setPreview(null); setFindOpen(false); reload(); openRoom(room); };
  const onCreated = (room) => { setCreateOpen(false); reload(); openRoom(room); };

  const empty = mine && mine.length === 0;

  return (
    <div style={{ padding: '4px 0 8px' }}>
      {/* P2(§7.5): 같이읽기 기본 모드 토글(같이+공개 opt-out) — 상단 상주 */}
      <div style={{ padding: '0 16px 12px' }}><CoReadModeToggle /></div>

      {/* 상단 액션바(숲 찾기·만들기) — 들어간 숲이 있을 때만(#1056). 빈 상태는 아래 카드에 액션 통합
          (중복 1차 버튼 제거, DESIGN.md "1차 버튼 1개"). 아이콘=Feather 모노라인(탭바 결). */}
      {!empty && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
          <button className="rg-btn-primary" style={{ flex: 1 }} onClick={() => setFindOpen(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>숲 찾기</button>
          <button className="rg-btn-tonal" style={{ flex: '0 0 auto', minWidth: 104 }} onClick={() => setCreateOpen(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>만들기</button>
        </div>
      )}

      {/* 참여 중인 숲 */}
      <div style={{ padding: '0 16px' }}>
        {mine === null ? (
          <p className="rg-room-hint" style={{ padding: '12px 0' }}>불러오는 중…</p>
        ) : empty ? (
          <div className="rg-room-empty" style={{ padding: '30px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-tint)', color: 'var(--brand-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 4.6 10.5H7L3.2 15.5h11.6L11 10.5h2.4L9 4Z" /><path d="M9 15.5V19" /><path d="M16.5 8 14 12h1.7l-2 3h6l-2-3H19.5L17 8Z" /></svg>
            </div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: 'var(--ink)' }}>아직 들어간 숲이 없어요</p>
            <p style={{ margin: '7px 0 18px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>같은 책 읽는 사람들과<br />같이 읽어볼까요?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="rg-btn-primary" style={{ flex: 1 }} onClick={() => setFindOpen(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" /></svg>숲 찾기</button>
              <button className="rg-btn-tonal" style={{ flex: '0 0 auto', minWidth: 108 }} onClick={() => setCreateOpen(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>만들기</button>
            </div>
          </div>
        ) : (
          <>
            <p className="rg-room-section">들어간 숲 ({mine.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mine.map(r => <MyRoomCard key={r.id} room={r} onOpen={openRoom} />)}
            </div>
          </>
        )}
      </div>

      {/* 이 책 같이 읽는 숲 (추천 §7.6) — 권유 카드(탭하면 미리보기 → 입장). 강제 join 아님.
          정렬 = 인원순 + 갓 생긴 숲 1개(rgRankRecommendedRooms). */}
      {recommended && recommended.length > 0 && (
        <div style={{ padding: '18px 16px 0' }}>
          <p className="rg-room-section">이 책 같이 읽는 숲</p>
          <p className="rg-room-hint" style={{ margin: '-2px 0 8px' }}>같은 책 읽는 사람들과 같이 읽어볼까요? 탭하면 미리 볼 수 있어요.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommended.map(r => <RoomListRow key={r.id} room={r} onTap={() => setPreview(r)} />)}
          </div>
        </div>
      )}

      {findOpen && <FindRoomSheet onClose={() => setFindOpen(false)} onPreview={(r) => { setFindOpen(false); setPreview(r); }} />}
      {createOpen && <CreateRoomSheet onClose={() => setCreateOpen(false)} onCreated={onCreated} />}
      {preview && <RoomPreviewSheet room={preview} onClose={() => setPreview(null)} onJoined={onJoined} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   마일스톤 — 함께 읽기 일정/구간 (co-reading.md §6·§7 P2 마일스톤)
   village_parts(제목·목표페이지·마감) 재사용. host(created_by)=일정 편집,
   멤버=이번 구간·내 위치 보기 + 뒤처진 멤버 응원. 새 테이블 없음.
   ════════════════════════════════════════════════════════════════ */

// 오늘(로컬, YYYY-MM-DD). 마감 D-N 계산용. (RG_today 훅 있으면 우선 — 데모 날짜 시뮬레이터 정합.)
function rgToday() {
  try { if (window.RG_today) return window.RG_today(); } catch (e) {}
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

// 날짜 차 (마감까지 며칠) — 음수면 지남.
function rgDaysUntil(due) {
  if (!due) return null;
  const a = new Date(rgToday() + 'T00:00:00'); const b = new Date(due + 'T00:00:00');
  if (isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/* 활성 구간 = 가장 임박한 "미완" 구간.
   "미완"의 기준은 날짜 — 마감이 오늘 이후(또는 마감 없음)인 첫 구간을 활성으로 본다.
   모든 구간 마감이 지났으면 마지막 구간을 활성(완주 구간)으로 둔다. */
function rgActivePartIndex(parts) {
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) return -1;
  for (let i = 0; i < list.length; i++) {
    const d = list[i].due_date;
    if (!d) return i;                       // 마감 없는 첫 구간 = 활성
    if (rgDaysUntil(d) >= 0) return i;       // 아직 안 지난 첫 구간 = 활성
  }
  return list.length - 1;                    // 다 지났으면 마지막 구간
}

// 멤버 위치 vs 활성 구간 목표페이지 → 'done' | 'ontrack' | 'behind'.
// 목표페이지 없으면(자유 구간) 항상 ontrack.
function rgMemberPartStatus(cumulativePage, endPage) {
  if (endPage == null) return 'ontrack';
  const page = cumulativePage || 0;
  if (page >= endPage) return 'done';
  // 목표의 80% 이상이면 온트랙(거의 따라옴), 그 미만은 뒤처짐.
  return page >= endPage * 0.8 ? 'ontrack' : 'behind';
}

// 마감 문구 — D-N / 오늘 / N일 지남.
function rgDueLabel(due) {
  const n = rgDaysUntil(due);
  if (n == null) return '';
  if (n === 0) return '오늘 마감';
  if (n > 0) return `D-${n}`;
  return `${-n}일 지남`;
}

/* host 일정 편집 시트 — 구간 행(제목·목표페이지·마감) 추가/수정/삭제 후 setParts 로 저장.
   별도 역할 테이블 없음: created_by=host 가드(어댑터·RLS). */
function RoomScheduleEditor({ roomId, initial, totalPages, onClose, onSaved }) {
  const { useState } = React;
  const blank = () => ({ key: Math.random().toString(36).slice(2), title: '', end_page: '', due_date: '' });
  const [rows, setRows] = useState(() => {
    const src = (initial && initial.length) ? initial : [];
    return src.length
      ? src.map(p => ({ key: Math.random().toString(36).slice(2), title: p.title || '', end_page: p.end_page == null ? '' : String(p.end_page), due_date: p.due_date || '' }))
      : [blank()];
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(rs => [...rs, blank()]);
  const delRow = (i) => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs);

  const save = async () => {
    setErr('');
    const parts = rows
      .map(r => ({ title: (r.title || '').trim(), end_page: r.end_page, due_date: r.due_date || null }))
      .filter(r => r.title || r.end_page !== '' || r.due_date);
    setBusy(true);
    try {
      const saved = await DataStore.rooms.setParts(roomId, parts);
      if (window.showToast) window.showToast('일정을 저장했어요', { sparrow: true });
      onSaved(saved || []);
    } catch (e) {
      setErr((e && e.message) || '일정을 저장하지 못했어요.');
    } finally { setBusy(false); }
  };

  return (
    <div className="rg-room-sheet-backdrop" onClick={onClose}>
      <div className="rg-room-sheet" onClick={e => e.stopPropagation()}>
        <div className="rg-room-sheet-head">
          <strong>함께 읽기 일정</strong>
          <button className="rg-room-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <p className="rg-room-hint" style={{ margin: '0 0 12px' }}>
          구간을 나눠 같이 완독해요. 각 구간에 목표 페이지와 마감을 정할 수 있어요{totalPages ? ` (총 ${totalPages}쪽)` : ''}.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '46vh', overflowY: 'auto' }}>
          {rows.map((r, i) => (
            <div key={r.key} className="rg-part-editrow">
              <div className="rg-part-editnum">{i + 1}</div>
              <div className="rg-part-editfields">
                <input className="rg-room-input" value={r.title} maxLength={40}
                  onChange={e => setRow(i, { title: e.target.value })}
                  placeholder={`${i + 1}구간 이름 (예: ${i + 1}주차)`} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input className="rg-room-input" type="number" min={1} value={r.end_page}
                    onChange={e => setRow(i, { end_page: e.target.value })}
                    placeholder="목표 ~쪽" style={{ flex: 1 }} />
                  <input className="rg-room-input" type="date" value={r.due_date}
                    onChange={e => setRow(i, { due_date: e.target.value })}
                    style={{ flex: 1.2 }} />
                </div>
              </div>
              <button className="rg-part-del" onClick={() => delRow(i)} aria-label="구간 삭제"
                disabled={rows.length <= 1}>×</button>
            </div>
          ))}
        </div>
        <button className="rg-btn-tonal" onClick={addRow} style={{ width: '100%', marginTop: 10 }}>+ 구간 추가</button>
        {err ? <p className="rg-room-err">{err}</p> : null}
        <button className="rg-btn-primary" disabled={busy} onClick={save} style={{ marginTop: 12 }}>
          {busy ? '저장 중…' : '일정 저장'}
        </button>
      </div>
    </div>
  );
}

/* 일정 탭 — 이번 구간 하이라이트 + 멤버 위치 + 진도 집계 + (host)편집/(member)응원.
   members = RoomModal 이 이미 로드한 멤버 진척(각 user.cumulativePage·handle 포함, §5.3.1). */
function RoomSchedule({ roomId, room, members, totalPages }) {
  const { useState, useEffect, useCallback } = React;
  const [parts, setParts] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [cheered, setCheered] = useState({});   // userId -> true (이 세션에서 응원 보냄)

  // 로그인 사용자 id, 게스트/로컬은 어댑터와 동일하게 'me' 폴백(로컬 created_by='me' 와 매칭 → 생성자=host 인식).
  const me = (window.RG_ME && window.RG_ME.id) || 'me';
  const isHost = !!(room && room.created_by && room.created_by === me);

  const load = useCallback(() => {
    if (!roomId) return;
    Promise.resolve(DataStore.rooms.listParts(roomId)).then(p => setParts(p || [])).catch(() => setParts([]));
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  const cheer = async (u) => {
    if (!u || !u.id) return;
    setCheered(c => ({ ...c, [u.id]: true }));   // 낙관적(로컬은 no-op이어도 따뜻한 피드백)
    try { if (DataStore.pokes && DataStore.pokes.send) await DataStore.pokes.send(u.id); } catch (e) {}
    if (window.showToast) window.showToast(`${u.handle ? '@' + u.handle : '독자'}님에게 응원을 보냈어요 💪`);
  };

  if (parts === null) return <p className="rg-room-hint">불러오는 중…</p>;

  // 빈/콜드스타트 — host엔 만들기 CTA, 멤버엔 안내.
  if (!parts.length) {
    return (
      <div className="rg-part-empty">
        <div style={{ marginBottom: 6, color: 'var(--brand-3)' }}>{window.rgIcon('calendar', 30)}</div>
        {isHost ? (
          <>
            <p style={{ margin: 0, fontWeight: 800, color: 'var(--ink-2)' }}>아직 함께 읽기 일정이 없어요</p>
            <p style={{ margin: '6px 0 14px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              구간을 나눠 같이 완독 챌린지를 시작해보세요.
            </p>
            <button className="rg-btn-primary" style={{ width: '100%' }} onClick={() => setEditOpen(true)}>일정 만들기</button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontWeight: 800, color: 'var(--ink-2)' }}>아직 일정이 없어요</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              숲을 만든 사람이 함께 읽기 일정을 정하면 여기에 보여요.
            </p>
          </>
        )}
        {editOpen && (
          <RoomScheduleEditor roomId={roomId} initial={parts} totalPages={totalPages}
            onClose={() => setEditOpen(false)}
            onSaved={(saved) => { setEditOpen(false); setParts(saved); }} />
        )}
      </div>
    );
  }

  const activeIdx = rgActivePartIndex(parts);
  const active = activeIdx >= 0 ? parts[activeIdx] : null;
  const mlist = Array.isArray(members) ? members : [];

  // 활성 구간 기준 멤버 상태 집계.
  const statuses = mlist.map(m => {
    const u = m.user || m;
    return { u, status: rgMemberPartStatus(u.cumulativePage || 0, active ? active.end_page : null) };
  });
  const doneCount = statuses.filter(s => s.status === 'done').length;
  const behind = statuses.filter(s => s.status === 'behind');

  return (
    <div>
      {/* 이번 구간 하이라이트 */}
      {active && (
        <div className="rg-part-active">
          <div className="rg-part-active-top">
            <span className="rg-part-active-tag">이번 구간</span>
            {active.due_date ? (
              <span className={'rg-part-due' + (rgDaysUntil(active.due_date) < 0 ? ' over' : (rgDaysUntil(active.due_date) <= 1 ? ' soon' : ''))}>
                {rgDueLabel(active.due_date)}
              </span>
            ) : null}
          </div>
          <div className="rg-part-active-title">{active.title || `${activeIdx + 1}구간`}</div>
          <div className="rg-part-active-goal">
            {active.end_page != null ? `목표 ~${active.end_page}쪽` : '목표 페이지 자유'}
          </div>
          {active.end_page != null && mlist.length > 0 && (
            <div className="rg-part-progress">
              <div className="rg-part-progressbar">
                <span style={{ width: `${mlist.length ? Math.round((doneCount / mlist.length) * 100) : 0}%` }} />
              </div>
              <span className="rg-part-progresslabel">{mlist.length}명 중 {doneCount}명 이번 구간 완료</span>
            </div>
          )}
        </div>
      )}

      {/* 멤버 위치 — 활성 구간 대비 온트랙/완료/뒤처짐 */}
      {active && mlist.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="rg-room-section">멤버 위치</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {statuses.map(({ u, status }, i) => (
              <div key={u.id || i} className="rg-part-memrow">
                <button className="rg-part-memname"
                  onClick={() => { if (u.handle && window.RG_openProfile) window.RG_openProfile(u.handle); }}>
                  {u.handle || u.display_name || '독자'}
                </button>
                <span className="rg-part-mempage">{u.cumulativePage || 0}{active.end_page != null ? `/${active.end_page}` : ''}쪽</span>
                <span className={'rg-part-badge rg-part-' + status}>
                  {status === 'done' ? '완료' : status === 'behind' ? '뒤처짐' : '온트랙'}
                </span>
                {status === 'behind' && me && u.id && u.id !== me && (
                  cheered[u.id]
                    ? <span className="rg-part-cheered">응원함 💪</span>
                    : <button className="rg-part-cheer" onClick={() => cheer(u)}>응원</button>
                )}
              </div>
            ))}
          </div>
          {behind.length > 0 && (
            <p className="rg-room-hint" style={{ marginTop: 8 }}>
              뒤처진 {behind.length}명에게 가벼운 응원을 보내보세요.
            </p>
          )}
        </div>
      )}

      {/* 전체 구간 목록 */}
      <div style={{ marginTop: 18 }}>
        <p className="rg-room-section">전체 일정 ({parts.length}구간)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {parts.map((p, i) => (
            <div key={p.id || i} className={'rg-part-listrow' + (i === activeIdx ? ' on' : '')}>
              <span className="rg-part-listnum">{i + 1}</span>
              <span className="rg-part-listtitle">{p.title || `${i + 1}구간`}</span>
              <span className="rg-part-listmeta">
                {p.end_page != null ? `~${p.end_page}쪽` : ''}
                {p.end_page != null && p.due_date ? ' · ' : ''}
                {p.due_date ? rgDueLabel(p.due_date) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* host 편집 진입 */}
      {isHost && (
        <button className="rg-btn-tonal" style={{ width: '100%', marginTop: 14 }} onClick={() => setEditOpen(true)}>
          일정 편집
        </button>
      )}

      {editOpen && (
        <RoomScheduleEditor roomId={roomId} initial={parts} totalPages={totalPages}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => { setEditOpen(false); setParts(saved); }} />
      )}
    </div>
  );
}

/* ── 숲 내부 모달 (§5.3) — 멤버 진척 그리드 + 한 문장 + 일정 ─────────── */
function RoomModal({ roomId, onClose }) {
  const { useState, useEffect } = React;
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState(null);
  const [tab, setTab] = useState('members'); // 'members' | 'sentences'
  const [sentences, setSentences] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve(DataStore.rooms.get(roomId)).then(r => { if (alive) setRoom(r); }).catch(() => { if (alive) setRoom(null); });
    Promise.resolve(DataStore.rooms.members(roomId)).then(ms => { if (alive) setMembers(ms || []); }).catch(() => { if (alive) setMembers([]); });
    return () => { alive = false; };
  }, [roomId]);

  const book = (room && room.book) || {};
  const total = book.total_pages || 0;
  const stats = members ? rgRoomStats(members, book) : null;

  // 한 문장 탭 — 숲 지정 책의 한 문장 모음 (byBook, 좋아요순). SentenceCard 경유(공용).
  useEffect(() => {
    if (tab !== 'sentences' || !book.id) return;
    let alive = true; setSentences(null);
    const SS = DataStore.sentences || {};
    const src = SS.byBook ? SS.byBook(book.id, { limit: 50, sort: 'likes' }) : Promise.resolve([]);
    Promise.resolve(src).then(rows => {
      if (!alive) return;
      const myId = window.RG_ME && window.RG_ME.id;
      setSentences((rows || []).map(s => {
        const u = s.user || {};
        return {
          id: s.id, page: s.page, q: s.text,
          nick: u.handle ? ('@' + u.handle) : '@익명',
          avatar: (u.display_name && u.display_name[0]) || <window.SparrowMark size={18} />,
          claps: s.claps || s.clap_count || 0,
          time: s.created_at,
          bookId: book.id, bookTitle: book.title || '',
          isMine: !!(myId && s.user_id === myId),
        };
      }));
    }).catch(() => { if (alive) setSentences([]); });
    return () => { alive = false; };
  }, [tab, book.id]);

  const doLeave = async () => {
    try { await DataStore.rooms.leave(roomId); } catch (e) {}
    if (window.showToast) window.showToast('숲에서 나왔어요');
    setLeft(true);
    if (window.RG_roomsChanged) window.RG_roomsChanged();
    onClose();
  };

  const copy = (text, label) => {
    try { navigator.clipboard.writeText(text); if (window.showToast) window.showToast(label + ' 복사했어요'); } catch (e) {}
  };
  const tokenUrl = room && room.invite_token ? `https://rgo.app/r/${room.invite_token}` : '';

  return ReactDOM.createPortal(
    <div className="rg-room-modal-backdrop" onClick={onClose}>
      <div className="rg-room-modal" onClick={e => e.stopPropagation()}>
        <div className="rg-room-modal-head">
          <button className="rg-room-back" onClick={onClose} aria-label="뒤로">←</button>
          <span className="rg-room-modal-title">{room ? room.name : '숲'}</span>
          <button className="rg-room-gear" onClick={() => setSettingsOpen(v => !v)} aria-label="설정" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.rgIcon('settings', 18)}</button>
        </div>
        {/* 1줄 요약 */}
        {stats && (
          <div className="rg-room-summary">
            {stats.count}명 · 오늘 {stats.todayCount}명 읽음 · 평균 진도 {stats.avgPct}%
          </div>
        )}

        {settingsOpen && (
          <div className="rg-room-settings">
            <button className="rg-room-set-item" onClick={() => copy(tokenUrl, '초대 링크')} disabled={!tokenUrl}>{window.rgIcon('share', 15)} 초대 링크 복사</button>
            <button className="rg-room-set-item" onClick={() => copy(room && room.invite_code, '초대 코드')} disabled={!(room && room.invite_code)}>{window.rgIcon('hash', 15)} 초대 코드 복사{room && room.invite_code ? ` (${room.invite_code})` : ''}</button>
            <button className="rg-room-set-item rg-danger" onClick={doLeave}>{window.rgIcon('logout', 15)} 나가기</button>
          </div>
        )}

        {/* 3탭 (멤버 진척 · 일정 · 한 문장) */}
        <div className="rg-room-tabs">
          <button className={'rg-room-tab' + (tab === 'members' ? ' on' : '')} onClick={() => setTab('members')}>{window.rgIcon('users', 14)} 멤버 진척</button>
          <button className={'rg-room-tab' + (tab === 'schedule' ? ' on' : '')} onClick={() => setTab('schedule')}>{window.rgIcon('calendar', 14)} 일정</button>
          <button className={'rg-room-tab' + (tab === 'sentences' ? ' on' : '')} onClick={() => setTab('sentences')}>{window.rgIcon('book', 14)} 한 문장</button>
        </div>

        <div className="rg-room-modal-body">
          {tab === 'members' ? (
            members === null ? <p className="rg-room-hint">불러오는 중…</p> : (
              <div className="rg-room-grid">
                {members.map((m, i) => {
                  const u = m.user || {};
                  const pct = total > 0 ? Math.min(100, Math.round(((u.cumulativePage || 0) / total) * 100)) : 0;
                  return (
                    <button key={u.id || i} className="rg-room-membercard"
                      onClick={() => { if (u.handle && window.RG_openProfile) window.RG_openProfile(u.handle); }}>
                      <div className="rg-room-membertop">
                        <span className="rg-room-nest">{rgRoomNestEmoji(pct)}</span>
                        <span className="rg-room-light" style={{ color: u.todayRecorded ? 'var(--gold)' : 'var(--line)' }}>●</span>
                      </div>
                      <div className="rg-room-membername">{u.handle || u.display_name || '독자'}</div>
                      <div className="rg-room-memberpct">진도 {pct}%</div>
                    </button>
                  );
                })}
              </div>
            )
          ) : tab === 'schedule' ? (
            <RoomSchedule roomId={roomId} room={room} members={members} totalPages={total} />
          ) : (
            sentences === null ? <p className="rg-room-hint">불러오는 중…</p> :
              sentences.length === 0 ? (
                <p className="rg-room-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
                  아직 이 책의 한 문장이 없어요.<br />오늘 읽은 한 문장을 남겨보세요.
                </p>
              ) : (
                <div>{sentences.map((it, i) => <SentenceCard key={it.id || i} item={it} bookId={it.bookId} />)}</div>
              )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

window.RoomsView = RoomsView;
window.RoomModal = RoomModal;
window.rgRoomNestEmoji = rgRoomNestEmoji;
// P2(§7.5) 같이읽기 모드 + 공개 숲 자동합류 — 등록 글루(app.js)·토글에서 사용.
window.rgCoReadMode = rgCoReadMode;
window.rgSetCoReadMode = rgSetCoReadMode;
window.RG_coReadMode = rgCoReadMode;            // 외부(app.js) alias
window.RG_setCoReadMode = rgSetCoReadMode;
window.RG_autoJoinPublicRoom = rgAutoJoinPublicRoom;
window.CoReadModeToggle = CoReadModeToggle;
// P2(§7.6) 공개 숲 추천(auto-match) — 책 상세 진입점 + 랭킹 헬퍼(검증/재사용 위해 노출).
window.BookCoReadRow = BookCoReadRow;
window.rgRankRecommendedRooms = rgRankRecommendedRooms;
// 마일스톤(함께 읽기 일정/구간, §6·§7 P2) — RoomModal 일정 탭에서 사용. 헬퍼는 검증/재사용 위해 노출.
window.RoomSchedule = RoomSchedule;
window.rgActivePartIndex = rgActivePartIndex;
window.rgMemberPartStatus = rgMemberPartStatus;
