/* =========================================================
   ReadingGo — shelf-import.js  (#772 통합 서가 ① 스샷 서가 복원 · #1038 고도화)
   ShelfImportModal: 구매내역/서재 캡쳐 업로드 → /api/shelf-import(비전 OCR) →
   카탈로그 매칭(loadBooks·랭크매칭) → 검수(목적지 토글·알라딘 보강) →
   DataStore.myBooks.addBatch 일괄 등록.
   components 이후 로드. window 전역(showToast·DataStore·loadBooks)은 bare/window로 호출.

   #1038 고도화:
   - 목적지 토글: 읽은 책(기본)/읽고싶어요/읽는 중 → 그 status로 등록(구 'completed' 고정 해제).
   - 게스트 패리티: 카탈로그 book(cover/total/isbn)을 어댑터 표면(cover_url/total_pages/isbn13)으로
     정규화해 넘김 → 게스트도 표지·쪽수·ISBN 보존(구: undefined로 소실).
   - 알라딘 보강: 카탈로그 밖 미매칭 책을 /aladin 검색으로 표지·쪽수·ISBN 채움(자동 1차 + "찾기" 버튼).
   - 랭크 매칭: 무순위 hits[0] → 제목 정확도 랭킹으로 오매칭↓.
   - 핵심 로직은 window.RG_shelfImport 로 추출(매핑·매칭·보강 재사용 — #1039 유연 임포트가 재사용).

   #1042 비전 추출:
   - 워커가 비전(Gemini Flash)을 1순위로 써 표지 그리드(왓챠·밀리·교보 서재) 스샷에서 책을 직접 인식
     (텍스트 OCR이 0건 추락하는 케이스). 응답에 별점(rating)이 함께 오면 검수 카드에 ★ 표시 + 등록 시 보존.
   - 업로드/검수 흐름은 동일 — rating 한 필드만 추가로 흐른다(matchRows → rows.rating → addBatch item.rating).
   ========================================================= */

const { useState } = React;

/* ── 재사용 코어 (window.RG_shelfImport) ───────────────────
   매핑·매칭·알라딘 보강을 UI 와 분리해 순수/재사용 가능하게 둔다(#1038 결정 — #1039 재사용).
   - normalizeCatalogBook: 카탈로그 book(data.js: cover/total/isbn) → 어댑터 표면(cover_url/total_pages/isbn13).
   - rankMatch: fuzzySearch 후보를 제목 정확도로 랭크 → 최적 1건(보수 가드 유지: 양방향 포함만 채택).
   - aladinLookup: /aladin 검색으로 미매칭 책 메타(표지·쪽수·ISBN) 보강. */
const RG_shelfImport = (function () {
  function _norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  // 카탈로그 book(loadBooks/_mapDbBook 산출: {id,isbn,title,author,pub,total,cover})을
  // 어댑터(add/addBatch)가 기대하는 표면({cover_url,total_pages,isbn13,publisher})으로 정규화.
  // 양 어댑터 모두 이 표면을 읽으므로 게스트·로그인 패리티가 맞는다([P1-2]).
  // 이미 어댑터 표면이면(cover_url 등 존재) 그대로 보존(중복 매핑 안전).
  function normalizeCatalogBook(b) {
    if (!b) return null;
    return {
      id: b.id || '',
      title: (b.title || '').trim(),
      author: (b.author || '').trim(),
      publisher: b.publisher || b.pub || '',
      total_pages: b.total_pages || b.total || 0,
      cover_url: b.cover_url || b.cover || '',
      isbn13: b.isbn13 || b.isbn || '',
    };
  }

  // 추출 제목(q)에 대해 카탈로그 후보들을 제목 정확도로 랭크해 최적 1건 반환(없으면 null).
  // 점수: 완전일치 > prefix > 짧은 길이차(포함관계). 보수 가드(양방향 정규화 포함)는 유지 —
  // 동명/포함관계 오매칭을 줄이되, 갖다붙이기(가드 실패)는 여전히 미확인으로 떨어뜨린다([P2-1]).
  function rankMatch(catalog, q, author) {
    const qn = _norm(q);
    if (!qn || !Array.isArray(catalog) || !catalog.length) return null;
    let hits = [];
    try {
      hits = (window.fuzzySearch ? window.fuzzySearch(catalog, q) : []) || [];
    } catch (e) { hits = []; }
    const an = _norm(author);
    let best = null, bestScore = -Infinity;
    for (const c of hits) {
      const cn = _norm(c.title);
      if (!cn) continue;
      // 보수 가드: 제목이 양방향 포함 관계일 때만 후보(환각 표지 방지 — 기존 가드 유지).
      if (!(cn === qn || cn.includes(qn) || qn.includes(cn))) continue;
      let score = 0;
      if (cn === qn) score += 100;                 // 완전 일치 최우선
      else if (cn.startsWith(qn) || qn.startsWith(cn)) score += 60; // prefix
      else score += 30;                            // 단순 포함
      // 길이차 페널티(짧을수록 가까움) — "1984" vs "1984 다이어리" 구분.
      score -= Math.abs(cn.length - qn.length);
      // 저자 일치 가산(있을 때만) — 동명 제목 타이브레이크.
      if (an && _norm(c.author) && _norm(c.author).includes(an)) score += 8;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // 미매칭 책을 알라딘 검색(worker /aladin → ItemSearch)으로 보강([P1-1]).
  // 반환: 어댑터 표면 book({title,author,publisher,total_pages,cover_url,isbn13}) | null.
  // graceful: 프록시 미배포·실패·0건이면 null(호출부가 기존 텍스트 등록으로 폴백).
  // 워커가 결과를 Supabase books 에 비파괴 upsert 하므로(#489) 카탈로그도 점진적으로 채워진다.
  async function aladinLookup(title, author) {
    const q = String(title || '').trim();
    if (!q) return null;
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    if (!proxy) return null;
    try {
      // 제목+저자로 좁혀 오검색↓(저자 없으면 제목만).
      const query = author ? `${q} ${author}` : q;
      const r = await fetch(`${proxy}?query=${encodeURIComponent(query)}`);
      if (!r.ok) return null;
      const d = await r.json();
      const items = (d && Array.isArray(d.items)) ? d.items : [];
      if (!items.length) return null;
      // 제목 정확도로 알라딘 결과도 랭크(엉뚱한 1위 방지) — rankMatch 재사용. 없으면 1위 폴백.
      const it = rankMatch(items, q, author) || items[0];
      if (!it || !it.title) return null;
      return {
        title: it.title, author: it.author || author || '',
        publisher: it.publisher || '', total_pages: it.total_pages || 0,
        cover_url: it.cover_url || '', isbn13: it.isbn13 || '',
      };
    } catch (e) { return null; }
  }

  // 추출 결과(books)를 카탈로그와 매칭 — 행 배열 생성. UI 가 호출.
  // 행: {title, author, rating, book|null, checked, source}. source: 'catalog'(매칭)|'' (미확인).
  // rating(#1042): 비전 추출이 별점을 주면 0.5~5.0 숫자로 보존(없으면 null) → 검수 표시·등록 보존.
  async function matchRows(books) {
    let catalog = [];
    try { catalog = (await (window.loadBooks ? window.loadBooks() : [])) || []; } catch (e) { catalog = []; }
    return (books || []).map((b) => {
      const hit = rankMatch(catalog, b.title, b.author);
      const book = hit ? normalizeCatalogBook(hit) : null;
      const rn = Number(b && b.rating);
      const rating = (Number.isFinite(rn) && rn > 0) ? Math.min(5, Math.max(0.5, rn)) : null;
      return {
        title: b.title,
        author: b.author || (book && book.author) || '',
        rating,
        book,
        checked: true,
        source: book ? 'catalog' : '',
      };
    });
  }

  return { normalizeCatalogBook, rankMatch, aladinLookup, matchRows };
})();
window.RG_shelfImport = RG_shelfImport;

// 목적지(등록 status) 옵션 — 일괄 토글 1개로 충분(책별은 후속, #1038 결정).
const SHELF_DESTS = [
  { value: 'completed', label: '읽은 책', hint: '다 읽은 책으로 추가' },
  { value: 'wish', label: '읽고싶어요', hint: '위시리스트로 추가' },
  { value: 'reading', label: '읽는 중', hint: '읽는 중으로 추가' },
];

function ShelfImportModal({ onClose }) {
  const [phase, setPhase] = useState('upload');   // upload | loading | review
  const [rows, setRows] = useState([]);           // [{title, author, rating, book|null, checked, source}]
  const [dest, setDest] = useState('completed');  // 목적지 토글(기본 '읽은 책')
  const [enriching, setEnriching] = useState(false); // 알라딘 보강 진행 표시
  const [err, setErr] = useState('');

  const onPick = (file) => {
    if (!file) return;
    setErr('');
    if (file.size > 8 * 1024 * 1024) { setErr('이미지가 너무 커요 (최대 8MB)'); return; }
    setPhase('loading');
    if (window.rgTrack) window.rgTrack('shelf_import_started', {});
    const fd = new FormData();
    fd.append('document', file, file.name || 'shelf.jpg');
    fetch('/api/shelf-import', { method: 'POST', body: fd })
      .then((r) => r.json())
      .then(async (d) => {
        if (d && d.demo) { setErr('데모 환경에선 서가 복원이 비활성이에요.'); setPhase('upload'); return; }
        const books = (d && Array.isArray(d.books)) ? d.books : [];
        if (!books.length) {
          setErr(d && d.empty ? '사진에서 글자를 못 찾았어요 — 더 또렷한 캡쳐로 다시 시도해요.' : '책을 찾지 못했어요 — 책 목록이 잘 보이는 캡쳐가 필요해요.');
          setPhase('upload');
          return;
        }
        const matched = await RG_shelfImport.matchRows(books);
        setRows(matched);
        setPhase('review');
        if (window.rgTrack) window.rgTrack('shelf_import_extracted', { count: matched.length });
        // 미매칭 책은 백그라운드로 알라딘 보강 시도([P1-1]) — 표지·쪽수·ISBN 자동 채움.
        autoEnrich(matched);
      })
      .catch(() => { setErr('처리 중 문제가 생겼어요 — 잠시 후 다시 시도해요.'); setPhase('upload'); });
  };

  // 미매칭 행을 알라딘으로 일괄 보강(자동). 찾으면 book 채우고 source='aladin'.
  // 동시 과다호출 방지: 순차 처리. 실패/0건은 미확인 유지(무중단).
  // 매칭 키는 안정적인 인덱스(원배열 위치) — 제목 편집 중 레이스를 피하려 위치로 병합.
  const autoEnrich = async (matched) => {
    const targets = [];
    (matched || []).forEach((r, idx) => { if (!r.book && (r.title || '').trim()) targets.push({ idx, r }); });
    if (!targets.length) return;
    setEnriching(true);
    for (const { idx, r } of targets) {
      let found = null;
      try { found = await RG_shelfImport.aladinLookup(r.title, r.author); } catch (e) { found = null; }
      if (found) {
        setRows((rs) => rs.map((row, j) => (j === idx && !row.book
          ? { ...row, book: found, author: row.author || found.author, source: 'aladin' } : row)));
      }
    }
    setEnriching(false);
  };

  // 단건 수동 보강("찾기" 버튼) — 자동이 못 찾은 책을 유저가 다시 시도(제목 편집 후 등).
  const enrichOne = async (i) => {
    const r = rows[i];
    if (!r) return;
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, _finding: true } : x)));
    let found = null;
    try { found = await RG_shelfImport.aladinLookup(r.title, r.author); } catch (e) { found = null; }
    setRows((rs) => rs.map((x, j) => (j === i
      ? { ...x, _finding: false, book: found || x.book, author: x.author || (found && found.author) || '', source: found ? 'aladin' : x.source }
      : x)));
  };

  const toggle = (i) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)));
  const edit = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const register = () => {
    const picked = rows.filter((r) => r.checked && (r.title || '').trim());
    if (!picked.length) { setErr('등록할 책을 한 권 이상 선택해요.'); return; }
    const DS = window.DataStore || {};
    if (!(DS.myBooks && DS.myBooks.addBatch)) { setErr('등록 경로가 준비되지 않았어요.'); return; }
    // 매칭/보강된 책은 어댑터 표면 메타(정규화 완료), 미확인은 제목·저자만. status=목적지 토글값.
    // rating(#1042): 비전 추출 별점을 함께 넘김 → 어댑터가 user_books.rating 으로 보존(wish 는 별점 없음 → 무시).
    const items = picked.map((r) => ({
      book: r.book ? r.book : { title: r.title.trim(), author: (r.author || '').trim() },
      status: dest,
      rating: (typeof r.rating === 'number' && r.rating > 0) ? r.rating : null,
    }));
    Promise.resolve(DS.myBooks.addBatch(items))
      .then((res) => {
        const n = (res || []).length || items.length;
        if (window.rgTrack) window.rgTrack('shelf_import_registered', { count: n, status: dest });
        try { window.dispatchEvent(new CustomEvent('rg:wish-changed')); } catch (e) {}
        const msg = dest === 'wish'
          ? `📚 ${n}권을 읽고싶어요에 담았어요!`
          : `📚 ${n}권을 서가에 복원했어요! 한 문장도 남겨보세요`;
        if (window.showToast) window.showToast(msg);
        onClose();
      })
      .catch(() => { setErr('등록 중 문제가 생겼어요 — 다시 시도해요.'); });
  };

  const checkedCount = rows.filter((r) => r.checked).length;
  const matchedCount = rows.filter((r) => r.book).length;
  const destLabel = (SHELF_DESTS.find((d) => d.value === dest) || {}).label || '읽은 책';
  // 별점 표시 문자열(#1042) — ★ 정수 + 반점(½)은 ⯨ 대신 0.5 텍스트로 간결히. 0/없음이면 '' .
  const fmtStars = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '';
    const full = Math.floor(v);
    return '★'.repeat(full) + (v - full >= 0.5 ? '½' : '');
  };
  // 별점은 '읽은 책'/'읽는 중' 맥락에서만 의미(위시는 아직 안 읽음) — wish 목적지면 표시 숨김.
  const showRating = dest !== 'wish';

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="스샷으로 서가 복원">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '4px 0 6px', color: 'var(--ink)' }}>📸 스샷으로 서가 복원</h2>

          {phase === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>
                알라딘·교보·밀리 등 <b>주문내역이나 내 서재 화면을 캡쳐</b>해서 올리면, 사진 속 책들을 읽어 서가에 한 번에 복원해요.
              </p>
              {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #d23)', marginBottom: 10 }}>{err}</div>}
              <label className="submit-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', width: '100%', margin: 0 }}>
                사진 고르기
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files && e.target.files[0])} />
              </label>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}>사진은 책 인식에만 쓰고 저장하지 않아요 · 최대 8MB</p>
            </div>
          )}

          {phase === 'loading' && (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔎</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>사진에서 책을 찾는 중…</div>
            </div>
          )}

          {phase === 'review' && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}>
                {rows.length}권 찾았어요 (서가 매칭 {matchedCount}권){enriching ? ' · 표지 채우는 중…' : ''}. 등록할 책을 확인하세요.
              </div>

              {/* 목적지 토글 — 일괄 status 선택([P2-3]/#1038 결정) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {SHELF_DESTS.map((d) => (
                  <button key={d.value} type="button" onClick={() => setDest(d.value)} title={d.hint}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      border: dest === d.value ? '1.5px solid var(--brand, #2a7)' : '1.5px solid var(--line)',
                      background: dest === d.value ? 'var(--brand-tint, rgba(42,119,119,0.1))' : 'var(--card)',
                      color: dest === d.value ? 'var(--brand, #2a7)' : 'var(--ink-2)',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>

              {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #d23)', marginBottom: 10 }}>{err}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '42vh', overflowY: 'auto', marginBottom: 14 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 10, padding: '8px 10px', opacity: r.checked ? 1 : 0.5 }}>
                    <input type="checkbox" checked={r.checked} onChange={() => toggle(i)} aria-label="등록 선택" style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <div style={{ width: 30, height: 42, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--line)' }}>
                      {r.book && r.book.cover_url && <img src={r.book.cover_url} alt="" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input value={r.title} onChange={(e) => edit(i, 'title', e.target.value)} placeholder="제목" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', padding: 0 }} />
                      <input value={r.author} onChange={(e) => edit(i, 'author', e.target.value)} placeholder="저자" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11.5, color: 'var(--ink-3)', padding: 0, marginTop: 2 }} />
                      {showRating && r.rating > 0 && (
                        <div title={`내 별점 ${r.rating}점 (스샷에서 인식)`} style={{ fontSize: 11, color: '#f5a623', marginTop: 1, letterSpacing: 0.5 }}>
                          {fmtStars(r.rating)} <span style={{ color: 'var(--ink-3)' }}>{r.rating}</span>
                        </div>
                      )}
                    </div>
                    {!r.book && (
                      <button type="button" onClick={() => enrichOne(i)} disabled={r._finding}
                        title="알라딘에서 표지·정보 찾기"
                        style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand, #2a7)', background: 'var(--brand-tint, rgba(42,119,119,0.1))', border: 'none', borderRadius: 6, padding: '3px 7px', flexShrink: 0, cursor: 'pointer' }}>
                        {r._finding ? '찾는 중…' : '🔍 찾기'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="submit-btn" style={{ width: '100%', margin: 0 }} disabled={!checkedCount} onClick={register}>
                {checkedCount}권 {destLabel}에 추가
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
window.ShelfImportModal = ShelfImportModal;
