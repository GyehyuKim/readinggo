// OCR 사진 배치의 공용 계약: 같은 파일을 429에 재시도하고, 성공분은 이후 실패와 무관하게 보존한다.
export const HIGHLIGHT_REQUEST_DELAY_MS = 6200;

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestHighlight(file, fileName, options = {}) {
  const apiFetch = options.apiFetch || window.RG_apiFetch;
  const wait = options.wait || defaultWait;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    const form = new FormData();
    form.append('document', file, fileName);
    response = await apiFetch('/api/extract-highlights', { method: 'POST', body: form });
    if (response.status !== 429 || attempt === 2) return response;
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || 6;
    await wait(Math.max(HIGHLIGHT_REQUEST_DELAY_MS, Math.min(120000, retryAfterSeconds * 1000)));
  }
  return response;
}

export async function extractHighlightBatch(files, options = {}) {
  const request = options.request || requestHighlight;
  const wait = options.wait || defaultWait;
  const onProgress = options.onProgress || (() => {});
  const all = [];
  let failed = 0;
  for (let index = 0; index < files.length; index++) {
    try {
      const file = files[index];
      const response = await request(file, file.name || `p${index}.jpg`);
      if (!response.ok) failed += 1;
      else {
        const data = await response.json();
        if (data && Array.isArray(data.sentences)) all.push(...data.sentences);
      }
    } catch {
      failed += 1;
    }
    onProgress({ done: index + 1, total: files.length });
    if (index < files.length - 1) await wait(HIGHLIGHT_REQUEST_DELAY_MS);
  }
  const seen = new Set();
  const items = [];
  for (const value of all) {
    const text = String(value || '').trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      items.push(text);
    }
  }
  return { items, failed };
}

if (typeof window !== 'undefined') {
  window.RG_HIGHLIGHT_REQUEST_DELAY_MS = HIGHLIGHT_REQUEST_DELAY_MS;
  window.RG_requestHighlight = requestHighlight;
  window.RG_extractHighlightBatch = extractHighlightBatch;
}
