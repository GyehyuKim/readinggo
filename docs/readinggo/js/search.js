// SearchModal: 도서 검색 기능
// - Fuse.js를 사용한 클라이언트 사이드 fuzzy 검색
// - ISBN / 제목 / 저자 검색
// - Phase 0: books.tsv 데이터 위에서만 검색

const SearchModal = ({
  isOpen,
  onClose,
  books,
  onSelectBook,
  topRecommendations,
}) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [fuse, setFuse] = React.useState(null);
  const [remote, setRemote] = React.useState([]);  // 알라딘 원격 결과 (외부)
  const [dbResults, setDbResults] = React.useState([]); // 우리 DB(books) 결과 — 즉시 표시 (#148)
  const [dbLoading, setDbLoading] = React.useState(false);     // 검색 진행중 구분 (#202)
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [pendingBook, setPendingBook] = React.useState(null); // 책장 선택 대기 (#409)
  // 📷 사진으로 시작 (#939) — 책 귀절 사진 → OCR 첫 문장 추출 → OCR 텍스트로 책 추정. 온보딩 첫 책 등록 타이핑 마찰 제거.
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [ocrSentence, setOcrSentence] = React.useState(''); // 추출 문장(편집 가능 — 정확도 가드)
  const [ocrDone, setOcrDone] = React.useState(false);      // 패널 열림(추출 1회 이상 시도 후)
  const _ocrCamRef = React.useRef(null);   // 카메라 촬영(capture)
  const _ocrFileRef = React.useRef(null);  // 앨범/파일 선택

  // 닫히면 OCR/검색 상태 초기화 (#939) — 다음에 열 때 깨끗한 시작.
  React.useEffect(() => {
    if (!isOpen) { setOcrDone(false); setOcrSentence(''); setOcrBusy(false); setQuery(''); }
  }, [isOpen]);

  // Fuse.js 인덱싱 (최초 1회)
  React.useEffect(() => {
    if (!fuse && books.length > 0) {
      const fuseInstance = new Fuse(books, {
        keys: ['title', 'author', 'isbn'],
        threshold: 0.3,
        minMatchCharLength: 1,
        ignoreLocation: true,
      });
      setFuse(fuseInstance);
    }
  }, [books, fuse]);

  // 검색 수행
  React.useEffect(() => {
    if (!fuse) return;

    if (query.trim() === '') {
      setResults([]);
    } else {
      const searchResults = fuse.search(query);
      setResults(searchResults.slice(0, 10)); // 최대 10개 결과
    }
  }, [query, fuse]);

  // 우리 DB(books) 검색 — 이미 등록·캐시된 책을 즉시 표시 (DataStore.books.search ilike).
  React.useEffect(() => {
    const q = query.trim();
    if (!q || !(window.DataStore && window.DataStore.books && window.DataStore.books.search)) { setDbResults([]); setDbLoading(false); return; }
    let alive = true;
    setDbLoading(true);
    const t = setTimeout(() => {
      Promise.resolve(window.DataStore.books.search(q)).then((rows) => {
        if (!alive) return;
        if (Array.isArray(rows)) setDbResults(rows.map((b) => ({
          book_id: b.id, id: b.id, isbn13: b.isbn13, isbn: b.isbn13,
          title: b.title, author: b.author, publisher: b.publisher,
          total_pages: b.total_pages, cover_url: b.cover_url, _source: 'db',
        })));
      }).catch(() => { if (alive) setDbResults([]); }).then(() => { if (alive) setDbLoading(false); });
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  // 알라딘 원격 검색(외부) — 디바운스 + graceful(프록시 미배포/실패 시 무시).
  React.useEffect(() => {
    const q = query.trim();
    if (!q) { setRemote([]); setRemoteLoading(false); return; }
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    if (!proxy) { setRemote([]); setRemoteLoading(false); return; }
    let alive = true;
    setRemoteLoading(true);
    const t = setTimeout(() => {
      fetch(`${proxy}?query=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d || !Array.isArray(d.items)) return;
          setRemote(d.items.map((it) => ({
            book_id: it.isbn13 || it.title,
            isbn13: it.isbn13, isbn: it.isbn13,
            title: it.title, author: it.author,
            publisher: it.publisher, total_pages: it.total_pages,
            cover_url: it.cover_url, _source: 'aladin',
          })));
        })
        .catch(() => { if (alive) setRemote([]); })
        .then(() => { if (alive) setRemoteLoading(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  if (!isOpen) return null;

  // 책 탭 → 즉시 등록(읽는중) 대신 책장 선택 시트(#409). 찜/읽는중/완독 분기.
  const handleSelectResult = (item) => {
    setPendingBook(item);
  };
  const chooseShelf = (shelf) => {
    const item = pendingBook;
    // #939: 사진으로 시작 경로면 추출 문장을 첫 기록으로 함께 넘긴다(읽는중일 때만 — 찜/완독은 첫 문장 기록 안 함).
    const first = (shelf === 'reading' && ocrDone) ? ocrSentence.trim() : '';
    setPendingBook(null);
    setQuery('');
    setOcrDone(false); setOcrSentence('');
    onClose();
    if (item) onSelectBook(item, shelf, first ? { firstSentence: first } : undefined);
  };

  // 📷 사진으로 시작 (#939) — 공유 헬퍼로 OCR(읽기모드와 동일 경로). 추출 문장은 편집 가능 패널에 채우고,
  // 그 텍스트로 책 검색을 자동 트리거(책 추정). 게스트도 호출 가능(ocrProxy 인증 없음).
  const runOcr = (file) => {
    if (!file || ocrBusy) return;
    if (file.size && file.size > 8 * 1024 * 1024) { if (window.showToast) showToast('이미지가 너무 커요(최대 8MB)'); return; }
    setOcrBusy(true);
    if (window.showToast) showToast('📷 사진에서 글자를 읽는 중…');
    if (window.rgTrack) rgTrack('onboarding_ocr_started', {});
    Promise.resolve((window.ocrExtractSentence ? window.ocrExtractSentence(file) : Promise.resolve({ text: '', error: 'unavailable' })))
      .then((d) => {
        setOcrDone(true);
        if (d && d.text) {
          const t = String(d.text).slice(0, 200);   // 첫 문장 — onboarding 한 문장 상한(200자)
          setOcrSentence(t);
          setQuery(t);   // 책 추정 — 추출 문장으로 검색 자동 트리거(아래 검색 effect 가 후보를 채움)
          if (window.showToast) showToast('✨ 문장을 읽었어요 — 책을 골라 시작하세요');
          if (window.rgTrack) rgTrack('onboarding_ocr_extracted', { chars: t.length });
        } else if (d && d.empty) {
          if (window.showToast) showToast('글자를 찾지 못했어요 — 직접 검색으로 시작해요');
          if (window.rgTrack) rgTrack('onboarding_ocr_empty', {});
        } else {
          if (window.showToast) showToast('추출 실패 — 직접 검색으로 시작해요');
          if (window.rgTrack) rgTrack('onboarding_ocr_failed', { reason: (d && d.error) || 'failed' });
        }
      })
      .finally(() => setOcrBusy(false));
  };

  // 병합 우선순위: 우리 DB(즉시) → 로컬(데모) → 알라딘(외부). isbn/제목 기준 중복 제거.
  const localItems = results.map((r) => r.item);
  const _seen = new Set();
  const _dedup = (arr) => arr.filter((b) => {
    const k = b.isbn13 || b.isbn || b.title;
    if (!k || _seen.has(k)) return false;
    _seen.add(k);
    return true;
  });
  const merged = _dedup(dbResults).concat(_dedup(localItems)).concat(_dedup(remote));
  const searching = dbLoading || remoteLoading;  // 진행중 — 결과없음과 구분 (#202)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--paper)',
          flex: 1,
          width: '100%',
          maxWidth: 430,
          display: 'flex',
          flexDirection: 'column',
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
          overflow: 'hidden',
          animation: 'slideDown 0.3s',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더: 검색창 */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--card)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              font: 'inherit',
              cursor: 'pointer',
              fontSize: 20,
              padding: 4,
            }}
            title="닫기"
          >
            ✕
          </button>
          <input
            type="text"
            placeholder="제목, 저자, ISBN 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              background: 'var(--paper)',
              padding: '8px 12px',
              borderRadius: 8,
              font: 'inherit',
              fontSize: 14,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                font: 'inherit',
                cursor: 'pointer',
                fontSize: 16,
                color: 'var(--ink-3)',
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 검색 결과 또는 추천 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            padding: '8px 0',
          }}
        >
          {/* 숨김 파일 입력 (#939) — 카메라 촬영 / 앨범 선택 */}
          <input ref={_ocrCamRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) runOcr(f); }} />
          <input ref={_ocrFileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) runOcr(f); }} />

          {/* 추출 문장 편집 패널 (#939) — OCR 결과를 바로 고칠 수 있게(정확도 가드). 책을 고르면 첫 기록으로 저장. */}
          {ocrDone && ocrSentence.trim() !== '' && (
            <div style={{ margin: '4px 12px 10px', padding: 12, borderRadius: 12, background: 'var(--brand-soft)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📷 사진에서 읽은 첫 문장</span>
                <span style={{ color: 'var(--ink-4)', fontWeight: 600 }}>· 책을 고르면 함께 기록돼요</span>
              </div>
              <textarea value={ocrSentence} maxLength={200}
                onChange={(e) => setOcrSentence(e.target.value)}
                placeholder="추출된 문장을 다듬어보세요"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 56, resize: 'vertical', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', font: 'inherit', fontSize: 14, fontFamily: "'Noto Serif KR', serif", background: 'var(--paper)', color: 'var(--ink)' }} />
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, textAlign: 'right' }}>{ocrSentence.length}/200</div>
            </div>
          )}

          {query.trim() === '' ? (
            // 검색어 없을 때: 사진으로 시작 + 추천도서
            <div>
              {/* 📷 사진으로 시작 (#939) — 온보딩 첫 책 등록 타이핑 마찰 제거. 책 귀절 사진 → OCR 첫 문장 → 책 추정. */}
              <div style={{ padding: '4px 12px 12px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => !ocrBusy && _ocrCamRef.current && _ocrCamRef.current.click()} disabled={ocrBusy}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: ocrBusy ? 'default' : 'pointer', opacity: ocrBusy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {ocrBusy ? '읽는 중…' : '📷 사진으로 시작'}
                  </button>
                  <button onClick={() => !ocrBusy && _ocrFileRef.current && _ocrFileRef.current.click()} disabled={ocrBusy}
                    style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: ocrBusy ? 'default' : 'pointer', opacity: ocrBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    앨범
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, textAlign: 'center' }}>
                  책 속 한 구절을 찍으면 문장과 책을 자동으로 찾아드려요
                </div>
              </div>
              {topRecommendations && topRecommendations.length > 0 && (
                <div>
                  <h3
                    style={{
                      padding: '12px 16px 8px',
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    📚 인기 도서
                  </h3>
                  {topRecommendations.map((book) => (
                    <SearchResultItem
                      key={book.book_id}
                      book={book}
                      onClick={() => handleSelectResult(book)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : merged.length > 0 ? (
            // 검색 결과 (로컬 데모 + 알라딘 실 책 DB)
            <div>
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
              >
                {merged.length}개 검색 결과
              </div>
              {merged.map((book) => (
                <SearchResultItem
                  key={book.book_id}
                  book={book}
                  onClick={() => handleSelectResult(book)}
                />
              ))}
            </div>
          ) : searching ? (
            // 검색 진행중 (#202) — 결과없음과 구분
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
              <div style={{ fontSize: 14 }}>검색 중…</div>
            </div>
          ) : ocrDone ? (
            // 사진으로 시작 — 추출 문장으론 책을 못 찾음(문장≠제목). 제목으로 검색 유도(문장은 위 패널에 보존). (#939)
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>문장으론 책을 못 찾았어요</div>
              <div style={{ fontSize: 12, marginTop: 4, marginBottom: 14 }}>책 제목·저자로 찾아주세요 — 위 문장은 그대로 기록돼요</div>
              <button onClick={() => setQuery('')}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                제목으로 검색
              </button>
            </div>
          ) : (
            // 검색 결과 없음 (#202)
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
              <div style={{ fontSize: 14 }}>검색 결과가 없어요</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                제목·저자·ISBN으로 다시 검색해보세요
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 책장 선택 시트 (#409) — 책 탭 후 읽고싶어요/읽는중/다읽었어요 분기 */}
      {pendingBook && (
        <div onClick={() => setPendingBook(null)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 10000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '20px 20px 0 0', padding: '18px 18px 24px' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>어떤 책장에 놓을까요?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingBook.title}</div>
            {[
              ['wish', '읽고 싶어요', <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>],
              ['reading', '지금 읽는 중', <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>],
              ['completed', '다 읽었어요', <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>],
            ].map(([k, label, icon]) => (
              <button key={k} onClick={() => chooseShelf(k)}
                style={{ width: '100%', padding: '14px', marginBottom: 8, borderRadius: 12, border: '1.5px solid var(--line)', background: k === 'reading' ? 'var(--brand-tint)' : 'var(--card)', color: 'var(--ink)', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', flexShrink: 0, color: k === 'reading' ? 'var(--brand-3)' : 'var(--ink-2)' }}>{icon}</span>{label}
              </button>
            ))}
            <button onClick={() => setPendingBook(null)}
              style={{ width: '100%', padding: '10px', marginTop: 4, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
};

// SearchResultItem: 검색 결과 아이템
const SearchResultItem = ({ book, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'var(--card-soft)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = 'transparent')
      }
    >
      {/* 책 표지 */}
      <img
        src={book.cover_url}
        alt={book.title}
        style={{
          width: 48,
          height: 64,
          objectFit: 'cover',
          borderRadius: 4,
          flexShrink: 0,
        }}
        onError={(e) => {
          e.currentTarget.style.background = 'var(--line)';
          e.currentTarget.src = '';
        }}
      />

      {/* 정보 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-3)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.author}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-4)',
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.publisher} · {book.total_pages}p
        </div>
      </div>
    </button>
  );
};

window.SearchModal = SearchModal;
window.SearchResultItem = SearchResultItem;
