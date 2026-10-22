// Synthetic inputs only; no book photos or source passages (#1633).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { prepareHighlightImage } from '../docs/readinggo/js/highlight-image.js';

function browserHarness(sizes = [100]) {
  const calls = [], image = { width: 4000, height: 3000, close() { calls.push('close'); } };
  const canvas = { width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob(cb, type, quality) {
      calls.push({ width: canvas.width, height: canvas.height, type, quality });
      const size = sizes.length > 1 ? sizes.shift() : sizes[0];
      cb(size === null ? null : { size, type });
    },
  };
  const browser = { document: { createElement: () => canvas },
    async createImageBitmap(file, options) { calls.push({ file, options }); return image; },
  };
  return { browser, calls, image, canvas };
}

test('JPEG copy preserves full resolution, explicitly uses EXIF orientation and leaves source intact', async () => {
  const h = browserHarness(), file = new Blob(['synthetic-original'], { type: 'image/png' });
  const original = await file.text();
  const result = await prepareHighlightImage(file, h.browser);
  assert.equal(result.type, 'image/jpeg');
  assert.equal(h.calls[0].file, file);
  assert.equal(h.calls[0].options.imageOrientation, 'from-image');
  assert.deepEqual(h.calls[1], { width: 4000, height: 3000, type: 'image/jpeg', quality: 0.94 });
  assert.equal(await file.text(), original);
  assert.equal(h.calls.at(-1), 'close');
  assert.equal(h.canvas.width, 0);
});

test('tries JPEG quality before shrinking; boundary is strictly below 8MiB', async () => {
  const h = browserHarness([8 * 1024 * 1024, 500]);
  await prepareHighlightImage({}, h.browser);
  assert.equal(h.calls[1].width, 4000);
  assert.equal(h.calls[2].width, 4000);
  assert.equal(h.calls[2].quality, 0.88);
});

test('only oversized encodings trigger proportional shrinking', async () => {
  const h = browserHarness([9e6, 9e6, 9e6, 100]);
  await prepareHighlightImage({}, h.browser);
  assert.equal(h.calls[4].width, 3400);
  assert.equal(h.calls[4].height, 2550);
});

test('failed canvas conversion rejects and closes bitmap, never returns empty success', async () => {
  const h = browserHarness([null]);
  await assert.rejects(prepareHighlightImage({}, h.browser), /변환/);
  assert.equal(h.calls.at(-1), 'close');
});

test('Image fallback revokes object URL on success and decode failure', async () => {
  for (const fail of [false, true]) {
    let revoked;
    const h = browserHarness();
    h.browser.createImageBitmap = async () => { throw Error('unsupported'); };
    h.browser.URL = { createObjectURL: () => 'blob:synthetic', revokeObjectURL: url => { revoked = url; } };
    h.browser.Image = class {
      naturalWidth = 3000; naturalHeight = 4000;
      set src(_) { queueMicrotask(() => fail ? this.onerror() : this.onload()); }
    };
    if (fail) await assert.rejects(prepareHighlightImage({}, h.browser));
    else { await prepareHighlightImage({}, h.browser); assert.equal(h.calls[0].height, 4000); }
    assert.equal(revoked, 'blob:synthetic');
  }
});

const workerSource = readFileSync(new URL('../worker/index.mjs', import.meta.url), 'utf8');
const sectionStart = workerSource.indexOf('const HIGHLIGHT_SYSTEM');
const section = workerSource.slice(sectionStart, workerSource.indexOf('// 통합 서가 ①', sectionStart));
const sandbox = { Request, Response, FormData, Uint8Array, btoa, setTimeout,
  OCR_MAX_BYTES: 8 * 1024 * 1024, json: (data, status) => Response.json(data, { status }),
  fetch: async (_url, init) => {
    sandbox.payload = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: sandbox.content } }] });
  },
};
vm.runInNewContext(section + '\nthis.proxy = extractHighlightsProxy;', sandbox);
const env = { GEMINI_API_KEY: 'synthetic', VISION_BASE_URL: 'https://vision.test', VISION_MODEL: 'synthetic' };
async function extract(content) {
  sandbox.content = content;
  const form = new FormData();
  form.append('document', new Blob(['synthetic-image'], { type: 'image/jpeg' }), 'synthetic.jpg');
  const response = await sandbox.proxy(new Request('https://app.test', { method: 'POST', body: form }), env);
  return { status: response.status, data: await response.json() };
}

test('real proxy/vision payload preserves punctuation, independent spans and API shape', async () => {
  const result = await extract('["합성 구절 7.","다른 구절!","합성 구절 7."]');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { sentences: ['합성 구절 7.', '다른 구절!'] });
  const prompt = sandbox.payload.messages[0].content;
  for (const rule of ['왼쪽 페이지', '오른쪽 페이지', '음절', '각주 표지', '문장 부호', '실제 글자·표시 증거', '이웃 문장']) assert.ok(prompt.includes(rule));
});

test('genuine empty array remains successful', async () => {
  assert.deepEqual(await extract('[]'), { status: 200, data: { sentences: [] } });
});

test('malformed/truncated/non-array provider output returns 502, not sentences:[]', async () => {
  for (const content of ['', '["잘림', '{"sentences":[]}', '[null]', '["완료"] trailing', '["완료"], ["잘림']) {
    const result = await extract(content);
    assert.equal(result.status, 502, content);
    assert.equal('sentences' in result.data, false);
  }
});

test('code-fenced valid array and legacy text objects are still accepted', async () => {
  const result = await extract('```json\n[{"text":"합성 구절."}]\n```');
  assert.deepEqual(result.data, { sentences: ['합성 구절.'] });
});

for (const [name, start, end] of [
  ['book-detail-modal.js', '  const runOcrBatch = async (files) => {', '\n  // #610:'],
  ['data-import.js', '  const runExtract = async (files) => {', '\n  // 검토 확정'],
]) {
  test(`${name} runs preparation per photo and preserves successes across preparation/API failures`, async () => {
    const source = readFileSync(new URL('../docs/readinggo/js/' + name, import.meta.url), 'utf8');
    const body = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    const values = [], toasts = [], uploads = [], prepared = [];
    const context = {
      book: { ubId: 'synthetic' }, FormData, setTimeout: fn => fn(),
      prepareHighlightImage: async file => { prepared.push(file); if (file === 'bad') throw Error('decode'); return new Blob(['jpeg'], { type: 'image/jpeg' }); },
      window: { RG_apiFetch: async (_url, opts) => { uploads.push(opts.body.get('document')); return Response.json(uploads.length === 1 ? { sentences: ['합성 문장.'] } : { invalid: true }); } },
      showToast: text => toasts.push(text),
      setOcrItems: v => values.push(v), setItems: v => values.push(v), setStep() {},
      setOcrBusy() {}, setOcrProgress() {}, setBusy() {}, setProgress() {},
    };
    vm.runInNewContext(body + '\nthis.run = ' + (name.startsWith('book') ? 'runOcrBatch' : 'runExtract') + ';', context);
    await context.run(['good', 'bad', 'malformed']);
    assert.deepEqual(prepared, ['good', 'bad', 'malformed']);
    assert.equal(uploads.length, 2);
    assert.ok(uploads.every(file => file.type === 'image/jpeg' && file.name.endsWith('.jpg')));
    assert.deepEqual(Array.from(values[0]), ['합성 문장.']);
    assert.ok(toasts.some(text => text.includes('2장')));
  });
}
