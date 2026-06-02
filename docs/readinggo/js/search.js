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

  if (!isOpen) return null;

  const handleSelectResult = (item) => {
    onSelectBook(item);
    setQuery('');
    onClose();
  };

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
        zIndex: 9999,
        animation: 'fadeIn 0.2s',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--paper)',
          flex: 1,
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
          ) : results.length > 0 ? (
            // 검색 결과 있음
            <div>
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
              >
                {results.length}개 검색 결과
              </div>
              {results.map((result) => (
                <SearchResultItem
                  key={result.item.book_id}
                  book={result.item}
                  onClick={() => handleSelectResult(result.item)}
                />
              ))}
            </div>
          ) : (
            // 검색 결과 없음
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
              <div style={{ fontSize: 14 }}>찾으시는 책이 없나요?</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                직접 등록할 수 있어요 (Phase 1)
              </div>
            </div>
          )}
        </div>
      </div>
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
          }}
        >
          {book.author}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-4)',
            marginTop: 4,
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
