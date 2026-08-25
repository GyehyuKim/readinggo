import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./share-card.js', import.meta.url), 'utf8');

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
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; return child; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
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

function createHarness() {
  const body = new FakeElement('body');
  const createdElements = [];
  const documentListeners = new Map();
  const document = {
    body,
    createElement: (tag) => { const element = new FakeElement(tag); createdElements.push(element); return element; },
    createTextNode: (text) => ({ nodeType: 3, textContent: text, parentNode: null }),
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (documentListeners.get(name) === listener) documentListeners.delete(name);
    },
  };
  const renders = [];
  const shares = [];
  const tracks = [];
  const copied = [];
  const window = {
    RG_CONFIG: { API_ORIGIN: 'https://readinggo.example' },
    htmlToImage: {
      toBlob: async (node, options) => {
        renders.push({ node, options });
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

test('9:16 render uses wallpaper dimensions, safe areas, left alignment, and Sparrow watermark', async () => {
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
  assert.match(node.children[4].children[0].innerHTML, /<svg[^>]+viewBox="0 0 100 100"/);
  assert.equal(harness.document.body.children.length, 0, 'temporary render node is always removed');
});

test('1:1 rendering remains 1080 square when format is omitted or invalid', async () => {
  await harness.window.renderSentenceCardBlob(sentence);
  assert.equal(harness.renders.at(-1).options.width, 1080);
  assert.equal(harness.renders.at(-1).options.height, 1080);
  await harness.window.renderSentenceCardBlob(sentence, { format: 'wide' });
  assert.equal(harness.renders.at(-1).options.height, 1080);
});

test('story Web Share uses allowlisted filename and analytics format', async () => {
  await harness.window.shareSentence(sentence, { format: '9:16' });
  assert.equal(harness.shares.at(-1).files[0].name, 'readinggo-sentence-9x16.png');
  assert.equal(harness.tracks.at(-1).event, 'sentence_shared');
  assert.equal(harness.tracks.at(-1).props.format, '9:16');
});

test('file-share fallback downloads the format filename and copies accessible text', async () => {
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
    assert.match(harness.copied.at(-1), /ReadingGo에서 내 한 문장 남기기/);
    assert.equal(harness.document.body.children.length, 0, 'download anchor is removed');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(revokedUrl, 'blob:share-card');
  } finally {
    harness.navigator.canShare = originalCanShare;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

test('format picker is single-instance, cleans up, and forwards the story choice', async () => {
  const first = harness.window.shareSentenceWithFormatChoice(sentence);
  const second = harness.window.shareSentenceWithFormatChoice(sentence);
  assert.equal(first, second);
  assert.equal(harness.document.body.children.length, 1);
  const overlay = harness.document.body.children[0];
  const actions = overlay.children[0].children[2];
  actions.children[1].click();
  assert.equal(harness.document.body.children.filter((child) => child === overlay).length, 0);
  await first;
  assert.equal(harness.renders.at(-1).options.height, 1920);
  assert.equal(harness.documentListeners.has('keydown'), false);
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
