/* =========================================================
   ReadingGo — ocr-crop-overlay.js  (#761 모듈화: nest.js에서 추출)
   OcrCropOverlay: 책 사진 OCR 드래그 영역 선택 v2 (#396). 자립적(자체 훅 선언, cross-file 의존 없음).
   nest.js **이전** 로드(NestView가 <OcrCropOverlay> bare 소비). 순수 이동.
   ========================================================= */

// 책 사진 OCR — 드래그 영역 선택 v2 (#396). 사진에서 원하는 구절만 사각형으로 골라
// 그 영역만 잘라 OCR → 배경 잡음·두 페이지 인터리빙(벤치마크 #395) 근본 회피.
function OcrCropOverlay({ file, onCancel, onCrop }) {
  const { useState: uS, useRef: uR, useEffect: uE } = React;
  const [url, setUrl] = uS(null);          // EXIF 정규화한 정방향 이미지 URL
  const [imgGeo, setImgGeo] = uS(null);   // 박스 기준 이미지 렌더 위치 {left,top,width,height}
  const [sel, setSel] = uS(null);          // 선택 사각형(이미지 좌표 기준) {x,y,w,h}
  const imgRef = uR(null), boxRef = uR(null), dragRef = uR(null);
  // EXIF orientation 정규화(#421): <img>는 EXIF로 회전 표시되지만 naturalWidth/Height·canvas drawImage는
  // 원시 픽셀(미회전)이라 crop 좌표가 90도 어긋나 누운 이미지가 OCR로 전송됨 → 글자 순서 붕괴.
  // 진입 시 정방향 비트맵을 캔버스로 재인코딩해, 보이는 것=자르는 것=보내는 것을 일치시킨다.
  uE(() => {
    let u = null, alive = true;
    (async () => {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        cv.getContext('2d').drawImage(bmp, 0, 0);
        if (bmp.close) bmp.close();
        const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.95));
        u = URL.createObjectURL(blob || file);
      } catch (e) {
        u = URL.createObjectURL(file);   // createImageBitmap 미지원/실패 — 원본 폴백(무중단)
      }
      if (alive) setUrl(u);
      else { try { URL.revokeObjectURL(u); } catch (e) {} }
    })();
    return () => { alive = false; try { if (u) URL.revokeObjectURL(u); } catch (e) {} };
  }, [file]);
  const measure = () => {
    if (!imgRef.current || !boxRef.current) return;
    const ir = imgRef.current.getBoundingClientRect(), br = boxRef.current.getBoundingClientRect();
    setImgGeo({ left: ir.left - br.left, top: ir.top - br.top, width: ir.width, height: ir.height });
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ptXY = (e) => {
    const ir = imgRef.current.getBoundingClientRect();
    return { x: clamp(e.clientX - ir.left, 0, ir.width), y: clamp(e.clientY - ir.top, 0, ir.height) };
  };
  const onDown = (e) => { if (!imgRef.current) return; const p = ptXY(e); dragRef.current = p; setSel({ x: p.x, y: p.y, w: 0, h: 0 }); };
  const onMove = (e) => { if (!dragRef.current) return; e.preventDefault(); const p = ptXY(e), s = dragRef.current; setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); };
  const onUp = () => { dragRef.current = null; };
  const doCrop = (whole) => {
    const img = imgRef.current; if (!img) return;
    const r = img.getBoundingClientRect();
    const sX = img.naturalWidth / r.width, sY = img.naturalHeight / r.height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (!whole && sel && sel.w >= 8 && sel.h >= 8) { sx = sel.x * sX; sy = sel.y * sY; sw = sel.w * sX; sh = sel.h * sY; }
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(sw)); cv.height = Math.max(1, Math.round(sh));
    cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => { if (blob) onCrop(blob); }, 'image/jpeg', 0.92);
  };
  const hasSel = sel && sel.w >= 8 && sel.h >= 8;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--app-h, 100dvh)', background: 'rgba(0,0,0,0.94)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      {/* #728: 버튼을 상단으로 — 모바일에서 하단 영역이 브라우저 툴바/하단 탭 뒤로 잘려도
          추출 버튼이 항상 보이고 눌리도록. 안내+액션을 위에 모으고 이미지는 아래 flex로 채운다. */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 16px 8px', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>가져올 글귀를 드래그로 선택</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>한 구절만 감싸면 배경·옆 페이지 없이 깔끔해요</div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', flexShrink: 0 }}>
        <button onClick={onCancel} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>취소</button>
        <button onClick={() => doCrop(true)} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>전체</button>
        <button onClick={() => doCrop(false)} disabled={!hasSel} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', background: hasSel ? 'var(--brand)' : 'rgba(255,255,255,0.15)', color: hasSel ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 900, fontSize: 14, cursor: hasSel ? 'pointer' : 'default' }}>{hasSel ? '✨ 선택 영역 추출' : '영역을 드래그하세요'}</button>
      </div>
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', touchAction: 'none', margin: '0 12px 12px' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {url
          ? <img ref={imgRef} src={url} alt="" onLoad={measure} draggable={false}
              style={{ position: 'absolute', inset: 0, margin: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>이미지 준비 중…</div>}
        {hasSel && imgGeo && (
          <div style={{ position: 'absolute', left: imgGeo.left + sel.x, top: imgGeo.top + sel.y, width: sel.w, height: sel.h, border: '2px solid var(--brand)', background: 'rgba(63,209,127,0.18)', borderRadius: 4, pointerEvents: 'none' }} />
        )}
      </div>
    </div>
  );
}
window.OcrCropOverlay = OcrCropOverlay;
