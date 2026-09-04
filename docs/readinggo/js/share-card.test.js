import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./share-card.js', import.meta.url), 'utf8');
const sentenceCardSource = readFileSync(new URL('./sentence-card.js', import.meta.url), 'utf8');
const bookDetailSource = readFileSync(new URL('./book-detail-modal.js', import.meta.url), 'utf8');
const bookInfoSource = readFileSync(new URL('./book-info-modal.js', import.meta.url), 'utf8');

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = {};
    this.textContent = '';
    this.innerHTML = '';
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  get scrollHeight() {
    const lineHeight = Number.parseInt(this.style.lineHeight, 10) || 0;
    if (!lineHeight) return 0;
    return Math.ceil(Array.from(this.textContent || '').length / 20) * lineHeight;
  }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; return child; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { const listener = this.listeners.get('click'); if (listener) listener({ target: this }); }
  focus() { this.focused = true; }
}

class FakeFile extends Blob {
  constructor(parts, name, options) { super(parts, options); this.name = name; }
}

class FakeFileReader {
  readAsDataURL() { this.result = 'data:font/otf;base64,AA=='; queueMicrotask(() => this.onload()); }
}

function createHarness(toBlob) {
  const body = new FakeElement('body');
  const createdElements = [];
  const documentListeners = new Map();
  const document = {
    body,
    activeElement: body,
    createElement: (tag) => {
      const element = new FakeElement(tag);
      element.focus = () => { element.focused = true; document.activeElement = element; };
      createdElements.push(element);
      return element;
    },
    createTextNode: (text) => ({ nodeType: 3, textContent: text, parentNode: null }),
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (documentListeners.get(name) === listener) documentListeners.delete(name);
    },
  };
  body.focus = () => { body.focused = true; document.activeElement = body; };
  const renders = [];
  const shares = [];
  const tracks = [];
  const copied = [];
  const window = {
    RG_CONFIG: { API_ORIGIN: 'https://readinggo.example' },
    htmlToImage: {
      toBlob: async (node, options) => {
        renders.push({ node, options });
        if (toBlob) return toBlob(node, options);
        return new Blob(['png'], { type: 'image/png' });
      },
    },
    rgTrack: (event, props) => tracks.push({ event, props }),
  };
  const navigator = {
    canShare: () => true,
    share: async (payload) => { shares.push(payload); },
    clipboard: { writeText: async (text) => { copied.push(text); } },
  };
  const context = vm.createContext({
    window, document, navigator, location: { origin: 'https://readinggo.example' },
    console, Blob, File: FakeFile, FileReader: FakeFileReader, URL,
    fetch: async () => ({ ok: true, blob: async () => new Blob(['font']) }),
    queueMicrotask, setTimeout, clearTimeout, Promise, Object, Array, String, Math,
  });
  vm.runInContext(source, context);
  return { window, document, documentListeners, createdElements, renders, shares, tracks, copied, navigator };
}

const harness = createHarness();
const sentence = { id: 's1', text: '오래 보아야 사랑스럽다. 너도 그렇다.', bookTitle: '풀꽃', author: '나태주' };

test('format allowlist preserves the existing 1:1 default', () => {
  assert.equal(harness.window.RG_normalizeShareFormat(), '1:1');
  assert.equal(harness.window.RG_normalizeShareFormat('unexpected'), '1:1');
  assert.equal(harness.window.RG_normalizeShareFormat('9:16'), '9:16');
  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.window.RG_SHARE_FORMATS)),
    {
      '1:1': { width: 1080, height: 1080, filename: 'readinggo-sentence.png' },
      '9:16': { width: 1080, height: 1920, filename: 'readinggo-sentence-9x16.png' },
    },
  );
});

test('9:16 render uses wallpaper dimensions, safe areas, left alignment, and Jacky raster watermark', async () => {
  await harness.window.renderSentenceCardBlob(sentence, { format: '9:16' });
  const { node, options } = harness.renders.at(-1);
  assert.equal(options.width, 1080);
  assert.equal(options.height, 1920);
  assert.equal(node.style.width, '1080px');
  assert.equal(node.style.height, '1920px');
  assert.equal(node.style.padding, '192px 86px 192px');
  assert.equal(node.children[1].style.alignItems, 'flex-start');
  assert.equal(node.children[1].children.at(-1).style.textAlign, 'left');
  assert.equal(node.children[4].style.flexDirection, 'column');
  assert.match(node.children[4].children[0].innerHTML, /<img[^>]+assets\/jacky\/brand-mark\.png/);
  assert.doesNotMatch(node.children[4].children[0].innerHTML, /<svg/);
  assert.equal(harness.document.body.children.length, 0, 'temporary render node is always removed');
});

test('1,000-character wallpaper clips on a complete line box and keeps source and watermark fixed', async () => {
  await harness.window.renderSentenceCardBlob({ ...sentence, text: '가'.repeat(1000) }, { format: '9:16' });
  const { node } = harness.renders.at(-1);
  const wrap = node.children[1];
  const sentenceNode = wrap.children.at(-1);
  assert.equal(wrap.style.minHeight, '0');
  assert.equal(wrap.style.overflow, 'hidden');
  assert.equal(sentenceNode.style.lineHeight, '66px');
  assert.equal(sentenceNode.style.maxHeight, '858px');
  assert.equal(Number.parseInt(sentenceNode.style.maxHeight, 10) % Number.parseInt(sentenceNode.style.lineHeight, 10), 0);
  assert.equal(sentenceNode.style.overflow, 'hidden');
  assert.equal(sentenceNode.style.display, 'block');
  assert.equal(sentenceNode.style.WebkitLineClamp, undefined);
  assert.match(sentenceNode.textContent, /…$/);
  assert.ok(Array.from(sentenceNode.textContent).length < 1000);
  assert.ok(sentenceNode.scrollHeight <= Number.parseInt(sentenceNode.style.maxHeight, 10));
  assert.equal(node.children[2].style.flexShrink, '0', 'source must not be pushed beyond the canvas');
  assert.equal(node.children[3].style.flexShrink, '0', 'divider must remain inside the canvas');
  assert.equal(node.children[4].style.flexShrink, '0', 'watermark must remain inside the canvas');
  assert.equal(node.children[5].style.flexShrink, '0', 'link must remain inside the canvas');
});

test('feed share entry point is a keyboard-focusable native button', () => {
  assert.match(sentenceCardSource, /<button type="button" className="chip" aria-label="한 문장 공유"/);
  assert.doesNotMatch(sentenceCardSource, /<span className="chip" onClick=\{\(\) => \(window\.shareSentenceWithFormatChoice/);
});

test('1:1 rendering remains 1080 square when format is omitted or invalid', async () => {
  await harness.window.renderSentenceCardBlob(sentence);
  assert.equal(harness.renders.at(-1).options.width, 1080);
  assert.equal(harness.renders.at(-1).options.height, 1080);
  await harness.window.renderSentenceCardBlob(sentence, { format: 'wide' });
  assert.equal(harness.renders.at(-1).options.height, 1080);
});

test('story Web Share uses allowlisted filename and emits preview then sent after resolution', async () => {
  await harness.window.shareSentence(sentence, { format: '9:16' });
  assert.equal(harness.shares.at(-1).files[0].name, 'readinggo-sentence-9x16.png');
  assert.deepEqual(harness.tracks.slice(-2).map((item) => item.event), ['sentence_share_previewed', 'sentence_share_sent']);
  assert.equal(harness.tracks.at(-1).props.format, '9:16');
});

test('file-share fallback downloads without implicitly copying link or text', async () => {
  const originalCanShare = harness.navigator.canShare;
  harness.navigator.canShare = () => false;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let createdBlob;
  let revokedUrl;
  URL.createObjectURL = (blob) => { createdBlob = blob; return 'blob:share-card'; };
  URL.revokeObjectURL = (url) => { revokedUrl = url; };
  try {
    const shareCount = harness.shares.length;
    await harness.window.shareSentence(sentence, { format: '9:16' });
    assert.equal(harness.shares.length, shareCount);
    assert.equal(createdBlob.type, 'image/png');
    assert.equal(harness.createdElements.filter((element) => element.tagName === 'A').at(-1).download, 'readinggo-sentence-9x16.png');
    assert.equal(harness.copied.length, 0);
    assert.equal(harness.tracks.at(-1).props.method, 'download');
    assert.equal(harness.document.body.children.length, 0, 'download anchor is removed');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(revokedUrl, 'blob:share-card');
  } finally {
    harness.navigator.canShare = originalCanShare;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

test('bottom sheet is single-instance, generates an actual preview, and sends the selected story image', async () => {
  const local = createHarness();
  const first = local.window.shareSentenceWithFormatChoice({ ...sentence, visibility: 'public' });
  const second = local.window.shareSentenceWithFormatChoice({ ...sentence, visibility: 'public' });
  assert.equal(first, second);
  const overlay = local.document.body.children[0];
  const dialog = overlay.children[0];
  const formats = dialog.children[2];
  formats.children[1].click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(formats.children[0].attributes['aria-pressed'], 'false');
  assert.equal(formats.children[1].attributes['aria-pressed'], 'true');
  assert.equal(formats.children[1].style.background, 'var(--brand)');
  const preview = dialog.children[3];
  assert.match(preview.src, /^blob:/);
  assert.equal(local.tracks.at(-1).event, 'sentence_share_previewed');
  const actions = dialog.children.at(-1);
  await actions.children[0].listeners.get('click')();
  await first;
  assert.equal(local.renders.at(-1).options.height, 1920);
  assert.equal(local.documentListeners.has('keydown'), false);
  assert.equal(local.document.body.children.length, 0);
});

test('format change clears stale preview until the latest render finishes', async () => {
  const pending = [];
  const local = createHarness(() => new Promise((resolve) => pending.push(resolve)));
  const choice = local.window.shareSentenceWithFormatChoice({ ...sentence, note: '생각' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = local.document.body.children[0].children[0];
  const formats = dialog.children[2];
  const actions = dialog.children.at(-1);
  const send = actions.children[0];
  assert.equal(send.disabled, true);
  pending[0](new Blob(['square'], { type: 'image/png' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(send.disabled, false);
  formats.children[1].click();
  assert.equal(send.disabled, true);
  send.click();
  assert.equal(local.shares.length, 0, 'stale square blob must not be sent');
  await new Promise((resolve) => setTimeout(resolve, 0));
  pending[1](new Blob(['story'], { type: 'image/png' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(send.disabled, false);
  send.click();
  assert.equal(await choice, true);
  assert.equal(local.shares.at(-1).files[0].name, 'readinggo-sentence-9x16.png');
});

test('preview failure alt text is restored after a successful retry', async () => {
  let attempts = 0;
  const local = createHarness(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('render failed');
    return new Blob(['recovered'], { type: 'image/png' });
  });
  const choice = local.window.shareSentenceWithFormatChoice(sentence);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = local.document.body.children[0].children[0];
  const preview = dialog.children[3];
  assert.equal(preview.attributes.alt, '미리보기를 만들지 못했어요');
  dialog.children[2].children[1].click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(preview.attributes.alt, '선택한 한 문장 공유 이미지 미리보기');
  local.documentListeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(await choice, false);
});

test('format picker traps Tab and restores focus to its trigger on Escape', async () => {
  const local = createHarness();
  const trigger = local.document.createElement('button');
  local.document.body.appendChild(trigger);
  trigger.focus();
  const choice = local.window.shareSentenceWithFormatChoice(sentence);
  const overlay = local.document.body.children.at(-1);
  const dialog = overlay.children[0];
  const formatButtons = dialog.children[2].children;
  const actionButtons = dialog.children.at(-1).children.filter((item) => item.tagName === 'BUTTON');
  assert.equal(local.document.activeElement, formatButtons[0]);
  let prevented = 0;
  const keydown = local.documentListeners.get('keydown');
  keydown({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented += 1; } });
  assert.equal(local.document.activeElement, actionButtons.at(-1));
  keydown({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented += 1; } });
  assert.equal(local.document.activeElement, formatButtons[0]);
  keydown({ key: 'Escape', shiftKey: false, preventDefault: () => { prevented += 1; } });
  assert.equal(await choice, false);
  assert.equal(local.document.activeElement, trigger);
  assert.equal(local.document.body.children.length, 1, 'only the original trigger remains');
  assert.equal(prevented, 3);
});

test('public note defaults on, opt-out removes it, and private notes are never rendered or shared', async () => {
  const local = createHarness();
  const choice = local.window.shareSentenceWithFormatChoice({ ...sentence, note: '천천히 읽고 싶다', visibility: 'public' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = local.document.body.children[0].children[0];
  const noteToggle = dialog.children[4].children[0];
  assert.equal(noteToggle.checked, true);
  assert.equal(local.renders.at(-1).node.children.some((child) => child.attributes['data-rg-share-note'] === 'true'), true);
  assert.match(local.window.buildShareText({ ...sentence, note: '천천히 읽고 싶다' }, { includeNote: true }), /내 생각: 천천히/);
  noteToggle.checked = false;
  await noteToggle.listeners.get('change')();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.doesNotMatch(local.window.buildShareText({ ...sentence, note: '천천히 읽고 싶다' }, { includeNote: false }), /천천히/);
  local.documentListeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  await choice;

  await local.window.renderSentenceCardBlob({ ...sentence, my_note: '비밀', note_private: true }, { includeNote: true });
  const privateNode = local.renders.at(-1).node;
  assert.equal(privateNode.children.some((child) => child.attributes['data-rg-share-note'] === 'true'), false);
  assert.doesNotMatch(local.window.buildShareText({ ...sentence, my_note: '비밀', note_private: true }, { includeNote: true }), /비밀/);
});

test('AbortError is cancellation and never emits sent success', async () => {
  const local = createHarness();
  local.navigator.share = async () => { const error = new Error('cancel'); error.name = 'AbortError'; throw error; };
  const result = await local.window.shareSentence(sentence, { format: '1:1' });
  assert.equal(result, false);
  assert.equal(local.tracks.filter((item) => item.event === 'sentence_share_sent').length, 0);
  assert.equal(local.tracks.filter((item) => item.event === 'sentence_share_previewed').length, 1);
});

test('sentence callers forward only share-safe fields including visibility and note privacy', () => {
  assert.match(sentenceCardSource, /notePrivate: item\.notePrivate, note_private: item\.note_private, visibility: item\.visibility/);
  assert.match(sentenceCardSource, /notePrivate: sentence\.notePrivate, note_private: sentence\.note_private, visibility: sentence\.visibility/);
  assert.match(bookDetailSource, /notePrivate: q\.notePrivate, note_private: q\.note_private/);
  assert.match(bookInfoSource, /notePrivate: !!r\.note_private, note_private: !!r\.note_private/);
});

test('link action copies the working ReadingGo service URL separately from the image', async () => {
  const local = createHarness();
  const choice = local.window.shareSentenceWithFormatChoice(sentence);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const actions = local.document.body.children[0].children[0].children.at(-1);
  await actions.children[1].listeners.get('click')();
  assert.equal(local.copied.at(-1), 'https://readinggo.example');
  assert.equal(local.tracks.at(-1).props.method, 'clipboard');
  local.documentListeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(await choice, false);
});

test('double submit reuses one in-flight render and share operation', async () => {
  let release;
  let renderCount = 0;
  harness.window.htmlToImage.toBlob = async () => {
    renderCount += 1;
    await new Promise((resolve) => { release = resolve; });
    return new Blob(['png'], { type: 'image/png' });
  };
  const first = harness.window.shareSentence(sentence, { format: '9:16' });
  const second = harness.window.shareSentence(sentence, { format: '1:1' });
  assert.equal(first, second);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(renderCount, 1);
  release();
  await first;
});
