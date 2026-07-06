// BarcodeScanModal — 바코드(뒤표지 EAN-13 = ISBN-13) 스캔으로 책 등록 (#943)
// 무의존(Stack Lock OK): 브라우저 네이티브 BarcodeDetector + getUserMedia. 새 npm 0.
// 흐름: 카메라 뷰파인더 → EAN-13 검출 → normalizeIsbn13 → BOOK_BY_ID/카탈로그/알라딘 매칭 →
//       onSelectBook(book, shelf) (검색 모달 책장 시트 재사용). 자세한 설계: specs/barcode-scan.md.
//
// capability gate(barcodeScanSupported)를 통과한 환경에서만 진입점이 노출된다(search.js).
// 미지원(iOS Safari 등)은 진입점 자체가 안 보이므로 이 모달은 지원 환경에서만 마운트된다.

// 지원 여부 — BarcodeDetector 존재 + ean_13 포맷 지원. 1회 캐시(중복 getSupportedFormats 회피).
let _bcSupportCache = null;
function barcodeScanSupported() {
  if (_bcSupportCache !== null) return _bcSupportCache;
  _bcSupportCache = (async () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false;
    try {
      const fmts = await window.BarcodeDetector.getSupportedFormats();
      return Array.isArray(fmts) && fmts.includes('ean_13');
    } catch (e) {
      return false;
    }
  })();
  return _bcSupportCache;
}

// ISBN-13 → 책 1권 해석 (오탐 0 — 정규화 ISBN 정확 일치만, fuzzy 금지). spec §2.1.
//   1) 로컬 즉시: BOOK_BY_ID[isbn] (부팅 캐시, 동기)
//   2) 카탈로그:  loadBooks() 중 isbn 일치
//   3) 원격 단건: ALADIN_PROXY?isbn=<isbn> (ItemLookUp)
// 반환: { book, matched: 'local'|'catalog'|'aladin'|'none' }. book 은 등록 경로(onSelectBook)가 받는 형태.
async function resolveBookByIsbn(isbn13) {
  const isbn = (window.normalizeIsbn13 ? window.normalizeIsbn13(isbn13) : String(isbn13 || '').replace(/[^0-9]/g, ''));
  if (!isbn || isbn.length !== 13) return { book: null, matched: 'none' };

  // 1) 로컬 즉시 (data.js _indexBooks 가 isbn13 키로 채움 — #490 A)
  const local = window.BOOK_BY_ID && window.BOOK_BY_ID[isbn];
  if (local && local.title) {
    return { book: { isbn13: isbn, title: local.title, author: local.author, publisher: local.pub, total_pages: local.total, cover_url: local.cover }, matched: 'local' };
  }

  // 2) 카탈로그 스캔 (보통 1에서 끝남 — loadBooks 가 _indexBooks 하므로. 방어적 2차)
  try {
    if (window.loadBooks) {
      const books = await window.loadBooks();
      const hit = (books || []).find((b) => (window.normalizeIsbn13 ? window.normalizeIsbn13(b.isbn) : '') === isbn);
      if (hit && hit.title) {
        return { book: { isbn13: isbn, title: hit.title, author: hit.author, publisher: hit.pub, total_pages: hit.total, cover_url: hit.cover }, matched: 'catalog' };
      }
    }
  } catch (e) { /* 카탈로그 실패 → 원격 시도 */ }

  // 3) 원격 단건 조회 (worker aladinProxy → ItemLookUp, 외서 보강 포함)
  const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
  if (proxy) {
    try {
      const r = await fetch(`${proxy}?isbn=${encodeURIComponent(isbn)}`);
      if (r.ok) {
        const d = await r.json();
        const it = d && d.items && d.items[0];
        if (it && it.title) {
          return { book: { isbn13: it.isbn13 || isbn, title: it.title, author: it.author, publisher: it.publisher, total_pages: it.total_pages, cover_url: it.cover_url }, matched: 'aladin' };
        }
      }
    } catch (e) { /* 원격 실패 → none */ }
  }

  return { book: null, matched: 'none' };
}

// cameraSupported=false(iOS Safari·카메라 없는 웹) → 카메라 없이 'manual' 로 바로 진입.
const BarcodeScanModal = ({ isOpen, onClose, onSelectBook, cameraSupported = true }) => {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const detectorRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const lockRef = React.useRef(false);  // 검출/해석 중 재진입 방지
  const [status, setStatus] = React.useState('starting'); // starting | scanning | denied | error | resolving | manual
  const [pendingBook, setPendingBook] = React.useState(null); // 책장 선택 대기 (search.js 와 동일 UX)
  const [manualIsbn, setManualIsbn] = React.useState('');     // 수동 ISBN 입력값 (폴백)
  const [showManual, setShowManual] = React.useState(false);  // 스캔 중 "직접 입력" 펼침

  // 카메라·루프 정지 — 닫힘/언마운트/검출성공 공통. 카메라 LED·배터리 누수 방지(spec §4).
  const stopCamera = React.useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) { try { videoRef.current.srcObject = null; } catch (e) {} }
  }, []);

  const handleClose = React.useCallback(() => { stopCamera(); if (onClose) onClose(); }, [stopCamera, onClose]);

  // ISBN 1개 확정 → 책 해석 → 라우팅. 카메라 검출·수동 입력 공용 경로.
  //   성공 시 책장 시트, 실패 시 토스트 + 검색 폴백. (기존 onDetectedIsbn 본체를 추출 — #943 후속)
  const resolveAndRoute = React.useCallback(async (isbn) => {
    lockRef.current = true;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    setStatus('resolving');
    if (window.rgTrack) window.rgTrack('barcode_detected', { isbn });
    try {
      const { book, matched } = await resolveBookByIsbn(isbn);
      if (window.rgTrack) window.rgTrack('barcode_detected', { matched });
      if (book) {
        stopCamera();
        setPendingBook(book);  // 책장 선택 시트로
      } else {
        // 유효 ISBN 이나 책 못 찾음 — 검색에 ISBN 프리필(수동 확인). 자동 등록 금지.
        if (window.showToast) window.showToast('이 바코드의 책을 찾지 못했어요 — 검색으로 확인해요');
        handleClose();
        if (window.RG_openSearchWith) window.RG_openSearchWith(isbn);
      }
    } catch (e) {
      if (window.showToast) window.showToast('책을 찾지 못했어요 — 다시 시도해요');
      lockRef.current = false;
      setStatus(cameraSupported ? 'scanning' : 'manual');
    }
  }, [stopCamera, handleClose, cameraSupported]);

  // 카메라 검출 콜백 — 잡 바코드는 조용히 무시하고 계속 스캔.
  const onDetectedIsbn = React.useCallback(async (raw) => {
    if (lockRef.current) return;
    const isbn = (window.normalizeIsbn13 ? window.normalizeIsbn13(raw) : String(raw || '').replace(/[^0-9]/g, ''));
    if (!isbn || isbn.length !== 13) return;  // 잡 바코드 — 무시하고 계속(토스트 스팸 금지)
    resolveAndRoute(isbn);
  }, [resolveAndRoute]);

  // 수동 입력 제출 — 13자리 검증 후 공용 경로. Enter·버튼 공통.
  const submitManual = React.useCallback(() => {
    if (lockRef.current) return;
    const isbn = (window.normalizeIsbn13 ? window.normalizeIsbn13(manualIsbn) : String(manualIsbn || '').replace(/[^0-9]/g, ''));
    if (!isbn || isbn.length !== 13) {
      if (window.showToast) window.showToast('ISBN 13자리를 정확히 입력해주세요');
      return;
    }
    resolveAndRoute(isbn);
  }, [manualIsbn, resolveAndRoute]);

  // 카메라 시작 + 디코드 루프 (모달 열릴 때). 미지원이면 카메라 없이 수동 입력으로.
  React.useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    lockRef.current = false;
    setPendingBook(null);
    setManualIsbn('');
    setShowManual(false);
    if (!cameraSupported) { setStatus('manual'); return undefined; }
    setStatus('starting');

    (async () => {
      // detector 준비
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['ean_13'] });
      } catch (e) { if (!cancelled) setStatus('error'); return; }

      // 카메라 권한·스트림
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (e) {
        if (cancelled) return;
        // NotAllowedError = 권한 거부, 그 외 = 장치/보안컨텍스트 문제
        setStatus(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'error');
        return;
      }
      if (cancelled) { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {} return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* autoplay 정책 — muted+playsinline 로 보통 통과 */ }
      if (cancelled) return;
      setStatus('scanning');
      if (window.rgTrack) window.rgTrack('barcode_scan_opened', {});

      // rAF 디코드 루프 — 프레임마다 detect. 검출 시 onDetectedIsbn 가 루프 정지.
      const tick = async () => {
        if (cancelled || lockRef.current) return;
        const v = videoRef.current, det = detectorRef.current;
        if (v && det && v.readyState >= 2) {
          try {
            const codes = await det.detect(v);
            if (!cancelled && !lockRef.current && codes && codes.length) {
              const ean = codes.find((c) => c.format === 'ean_13') || codes[0];
              if (ean && ean.rawValue) { onDetectedIsbn(ean.rawValue); return; }
            }
          } catch (e) { /* 일시적 detect 실패 — 다음 프레임 */ }
        }
        if (!cancelled && !lockRef.current) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    })();

    return () => { cancelled = true; stopCamera(); };
  }, [isOpen, stopCamera, onDetectedIsbn, cameraSupported]);

  if (!isOpen) return null;

  const chooseShelf = (shelf) => {
    const item = pendingBook;
    setPendingBook(null);
    handleClose();
    if (item && onSelectBook) onSelectBook(item, shelf);
  };

  const overlayMsg = status === 'denied'
    ? '카메라 권한이 필요해요'
    : status === 'error'
      ? '카메라를 열 수 없어요'
      : status === 'resolving'
        ? '책을 찾는 중…'
        : status === 'starting'
          ? '카메라를 준비하는 중…'
          : status === 'manual'
            ? 'ISBN으로 책을 등록해요'
            : '책 뒤표지의 바코드를 비춰주세요';

  // 수동 ISBN 입력 블록 — 카메라 미지원/거부/실패, 또는 스캔 중 "직접 입력" 공용.
  //   책 뒤표지 바코드 위 숫자(978…)를 그대로 입력. 데모·아이폰 웹에서도 등록 경로 확보.
  const manualBlock = (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={manualIsbn}
          onChange={(e) => setManualIsbn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="ISBN 13자리 (예: 9788937460449)"
          aria-label="ISBN 직접 입력"
          style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: 'none', fontSize: 15, color: '#111', background: '#fff', outline: 'none' }}
        />
        <button onClick={submitManual} aria-label="ISBN으로 찾기"
          style={{ flexShrink: 0, background: '#fff', color: '#111', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>찾기</button>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.5 }}>책 뒤표지 바코드 위 13자리 숫자예요</div>
    </div>
  );

  const showManualView = status === 'denied' || status === 'error' || status === 'manual';

  return (
    <div onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, background: 'rgb(11, 13, 16)', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.2s' }}>
      {/* 헤더 — 닫기 */}
      <div style={{ width: '100%', maxWidth: 430, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', color: '#fff', zIndex: 2 }}>
        <button onClick={handleClose} aria-label="닫기" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.rgIcon('close', 18)}</button>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.2px' }}>{cameraSupported ? '바코드로 등록' : 'ISBN으로 등록'}</span>
        <span style={{ width: 34 }} />
      </div>

      {/* 뷰파인더 */}
      <div style={{ position: 'relative', flex: 1, width: '100%', maxWidth: 430, overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: (status === 'scanning' || status === 'resolving') ? 'block' : 'none' }} />
        {/* 중앙 가이드 프레임 (EAN 가로 비율) */}
        {(status === 'scanning' || status === 'resolving') && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '74%', height: 120, border: '2px solid rgba(255,255,255,0.9)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
        )}
        {/* 카메라 미지원·거부·오류 — ISBN 직접 입력 폴백(전면). */}
        {showManualView && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', color: '#fff' }}>
            <div style={{ display: 'inline-flex' }}>{window.rgIcon(status === 'manual' ? 'search' : 'camera', 40)}</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{overlayMsg}</div>
            {status === 'denied' && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>브라우저 설정에서 카메라를 허용하거나,{'\n'}아래에 ISBN을 직접 입력해요.</div>
            )}
            {manualBlock}
            <button onClick={() => { handleClose(); if (window.RG_openSearchWith) window.RG_openSearchWith(''); }}
              style={{ marginTop: 2, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              제목·저자로 검색하기
            </button>
          </div>
        )}
      </div>

      {/* 하단 안내 — 스캔 중 + "직접 입력" 폴백 토글 */}
      {(status === 'scanning' || status === 'resolving' || status === 'starting') && (
        <div style={{ width: '100%', maxWidth: 430, padding: '16px 16px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.92)', zIndex: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{overlayMsg}</div>
          {showManual ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>{manualBlock}</div>
          ) : (
            <button onClick={() => setShowManual(true)}
              style={{ marginTop: 6, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              바코드가 안 잡히나요? ISBN 직접 입력
            </button>
          )}
        </div>
      )}

      {/* 책장 선택 시트 — search.js 와 동일 UX(읽고싶어요/읽는중/완독) */}
      {pendingBook && (
        <div onClick={() => { setPendingBook(null); handleClose(); }}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 10002 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '20px 20px 0 0', padding: '18px 18px 24px' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>어떤 책장에 놓을까요?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingBook.title}</div>
            {[
              ['wish', '읽고 싶어요'],
              ['reading', '지금 읽는 중'],
              ['completed', '다 읽었어요'],
            ].map(([k, label]) => (
              <button key={k} onClick={() => chooseShelf(k)}
                style={{ width: '100%', padding: '14px', marginBottom: 8, borderRadius: 12, border: '1.5px solid var(--line)', background: k === 'reading' ? 'var(--brand-tint)' : 'var(--card)', color: 'var(--ink)', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
            <button onClick={() => { setPendingBook(null); handleClose(); }}
              style={{ width: '100%', padding: '10px', marginTop: 4, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
};

window.barcodeScanSupported = barcodeScanSupported;
window.resolveBookByIsbn = resolveBookByIsbn;
window.BarcodeScanModal = BarcodeScanModal;
