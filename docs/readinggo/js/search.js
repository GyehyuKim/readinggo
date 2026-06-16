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
    setPendingBook(null);
    setQuery('');
    onClose();
    if (item) onSelectBook(item, shelf);
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
          {query.trim() === '' ? (
            // 검색어 없을 때: 추천도서
            <div>
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
            {[['wish', '🔖 읽고 싶어요'], ['reading', '📖 지금 읽는 중'], ['completed', '🏰 다 읽었어요']].map(([k, label]) => (
              <button key={k} onClick={() => chooseShelf(k)}
                style={{ width: '100%', padding: '14px', marginBottom: 8, borderRadius: 12, border: '1.5px solid var(--line)', background: k === 'reading' ? 'var(--brand-tint)' : 'var(--card)', color: 'var(--ink)', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
                {label}
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
