// Synthetic, network-isolated rendering of the real editor; no live account/DB writes.
// Run: node --test story-editor-ux.test.mjs (build first for production CSS).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const source = readFileSync(new URL('./js/book-detail-modal.js', import.meta.url), 'utf8');
const editor = source.slice(0, source.indexOf('/* ── BookDetailModal'));
const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).join('\n');
const artifacts = process.env.STORY_UX_ARTIFACTS || join(tmpdir(), 'readinggo-story-editor-ux');
mkdirSync(artifacts, { recursive: true });
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
${editor}
const root = createRoot(document.getElementById('root'));
window.mountEditor = props => root.render(React.createElement(ReadingStoryEditor, props));`,
    resolveDir: new URL('.', import.meta.url).pathname, loader: 'jsx' },
  bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
});
const book = { id:'catalog-fixture', ubId:'owner-book', title:'독서 이야기 검증용 책', author:'테스트 저자' };
const quotes = [
  { id:'s1', userBookId:book.ubId, text:'문장별 공개값과 관계없이 책의 공개 설정을 따라요.', page:12,
    visibility:'private', isPrivate:true, publishable_thought:'직접 작성한 생각만 이야기로 공유해요.', note:'LEGACY_SECRET', my_note:'MIXED_SECRET', conversations:[{ content:'AI_SECRET' }] },
  { id:'s2', user_book_id:book.ubId, text:'생각 없이 남긴 문장도 선택할 수 있어요.', visibility:'followers', note:'LEGACY_ONLY' },
  { id:'foreign', userBookId:'another-owner-book', text:'FOREIGN_SECRET', publishable_thought:'FOREIGN_THOUGHT' },
  { id:'orphan', text:'ORPHAN_SECRET', visibility:'public' },
];

async function mount(page, initialStory = null, candidates = quotes) {
  await page.goto('http://story.test/');
  await page.addScriptTag({ content:bundle.outputFiles[0].text });
  await page.evaluate(({book, quotes, initialStory}) => {
    window.events = []; window.allow = false;
    window.showToast = () => {};
    window.RG_ensureBookVisibility = async value => { window.events.push(['gate', value]); return window.allow; };
    window.renderSentenceCardBlob = async (value, options) => {
      window.events.push(['image', value, options]); return new Blob(['synthetic image fixture'], {type:'image/png'});
    };
    window.DataStore = { readingStories: {
      readLocalDraft: async () => null,
      saveDraft: async value => { window.events.push(['draft', value]); return { id:'draft-fixture', status:'draft', pages:value.pages }; },
      publish: async id => { window.events.push(['publish', id]); return { id, status:'published', slug:'a'.repeat(36) }; },
    } };
    window.mountEditor({ book, quotes, initialStory, reviewText:'', entry:'test', onClose:() => {}, onStory:() => {} });
  }, {book, quotes:candidates, initialStory});
  await page.getByRole('heading', {name:'문장과 생각 선택', exact:true}).waitFor();
}

test('story copy, parent-scoped candidates, safe preview/image, explicit publish gate, three viewports', async () => {
  const browser = await chromium.launch({headless:true});
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().resourceType() === 'document'
      ? route.fulfill({contentType:'text/html', body:`<!doctype html><html lang="ko"><head><meta charset="utf-8">${styles}</head><body><div id="root"></div></body></html>`})
      : route.abort());
    for (const [width,height] of [[390,844],[430,932],[1280,900]]) {
      await page.setViewportSize({width,height});
      await mount(page);
      assert.equal(await page.getByText('전체 공개된 책만 공유할 수 있어요.', {exact:true}).count(), 1);
      assert.equal(await page.getByRole('button', {name:'문장 선택', exact:true}).count(), 2);
      assert.equal(await page.getByRole('button', {name:'생각 선택', exact:true}).count(), 1);
      assert.equal(await page.getByRole('button', {name:'문장 선택됨', exact:true}).count(), 0);
      assert.doesNotMatch(await page.locator('body').innerText(), /SECRET|LEGACY|public 문장|공개할 문장과 생각 선택/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false);
      await page.screenshot({path:join(artifacts, `editor-${width}.png`), fullPage:true});
    }
    await page.getByRole('button', {name:'문장 선택', exact:true}).first().click();
    await page.getByRole('button', {name:'생각 선택', exact:true}).click();
    await page.getByRole('button', {name:'미리보기', exact:true}).click();
    assert.match(await page.locator('body').innerText(), /직접 작성한 생각만 이야기로 공유해요/);
    assert.doesNotMatch(await page.locator('body').innerText(), /SECRET|LEGACY/);
    await page.getByRole('button', {name:'편집', exact:true}).click();
    await page.getByRole('button', {name:'발행하기', exact:true}).click();
    assert.equal(await page.evaluate(() => events.filter(e => e[0] === 'publish').length), 0);
    await page.evaluate(() => { window.allow = true; });
    await page.getByRole('button', {name:'발행하기', exact:true}).click();
    await page.waitForFunction(() => events.some(e => e[0] === 'publish'));
    const events = await page.evaluate(() => window.events);
    assert.equal(events.filter(e => e[0] === 'gate').length, 2);
    assert.ok(events.findIndex(e => e[0] === 'gate') < events.findIndex(e => e[0] === 'publish'));
    // Cancel the external output after inspecting the renderer input.
    await page.evaluate(() => { window.allow = false; });
    await page.getByRole('button', {name:'Instagram 스토리용 9:16 PNG', exact:true}).click();
    await page.waitForFunction(() => events.some(e => e[0] === 'image'));
    const image = await page.evaluate(() => events.find(e => e[0] === 'image'));
    assert.equal(image[1].publishable_thought, quotes[0].publishable_thought);
    assert.doesNotMatch(JSON.stringify(image), /SECRET|LEGACY|my_note|conversations/);
    assert.equal(image[2].includeNote, true);
    await mount(page, { id:'restored', status:'draft', pages:[
      {type:'quote',sentenceId:'s1'}, {type:'note',sentenceId:'s1'},
      {type:'note',sentenceId:'s2'}, {type:'quote',sentenceId:'foreign'},
    ] });
    assert.equal(await page.getByRole('button', {name:/카드 제거$/}).count(), 2);
    await mount(page, null, []);
    assert.equal(await page.getByText('먼저 기억할 문장을 남겨보세요.', {exact:true}).count(), 1);
    assert.doesNotMatch(source, /먼저 기억할 문장을 공개로 남겨보세요/);
    assert.deepEqual(errors, []);
    console.log(`Visual artifacts: ${artifacts}`);
  } finally { await browser.close(); }
});
