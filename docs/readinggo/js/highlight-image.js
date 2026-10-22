// 강조 추출 전송 사본만 생성한다. 원본 File은 수정하지 않는다 (#1633).
const MAX_BYTES = 8 * 1024 * 1024;

async function decodeImage(file, browser) {
  if (typeof browser.createImageBitmap === 'function') {
    try { return await browser.createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Safari/지원하지 않는 형식은 HTMLImageElement로 재시도 */ }
  }
  const url = browser.URL.createObjectURL(file);
  try {
    const image = new browser.Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
      image.src = url;
    });
    // 최신 브라우저의 Image 디코더가 EXIF 방향을 적용한다.
    return image;
  } finally { browser.URL.revokeObjectURL(url); }
}

export async function prepareHighlightImage(file, browser = globalThis) {
  const image = await decodeImage(file, browser);
  const canvas = browser.document.createElement('canvas');
  try {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!(width > 0 && height > 0)) throw new Error('이미지 크기를 읽지 못했어요');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 변환을 시작하지 못했어요');
    // 2560px 일괄 축소 대신 원래 해상도에서 먼저 인코딩한다.
    let scale = 1;
    for (let attempt = 0; attempt < 16; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.94, 0.88, 0.8]) {
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 변환에 실패했어요')), 'image/jpeg', quality);
        });
        if (blob.type !== 'image/jpeg') throw new Error('JPEG 변환을 지원하지 않아요');
        if (blob.size > 0 && blob.size < MAX_BYTES) return blob;
      }
      scale *= 0.85;
    }
    throw new Error('이미지가 너무 커요(최대 8MB)');
  } finally {
    if (typeof image.close === 'function') image.close();
    canvas.width = canvas.height = 0;
  }
}
