import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const editorSource = readFileSync(new URL('./book-detail-modal.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const localSource = readFileSync(new URL('./datastore.js', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('./datastore-supabase.js', import.meta.url), 'utf8');
const republishMigrationSource = readFileSync(new URL('../supabase/64_reading_story_atomic_republish.sql', import.meta.url), 'utf8');
const milestoneSource = readFileSync(new URL('./milestone-recap.js', import.meta.url), 'utf8');
const supabaseClientSource = readFileSync(new URL('./supabase-client.js', import.meta.url), 'utf8');
const worker = (await import('../../../worker/index.mjs')).default;

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing source marker: ${start}`);
  assert.notEqual(to, -1, `missing source marker: ${end}`);
  return source.slice(from, to);
}

function loadSaveQueue() {
  const queueSource = sourceBetween(
    editorSource,
    'function _createReadingStorySaveQueue()',
    '\n\nfunction ReadingStoryEditor',
  );
  const context = vm.createContext({ Promise, Map, Math });
  vm.runInContext(`${queueSource}\nthis.createQueue = _createReadingStorySaveQueue;`, context);
  return context.createQueue();
}

test('reading-story saves are serialized by revision', async () => {
  const queue = loadSaveQueue();
  const calls = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const first = queue.enqueue(1, async () => {
    calls.push('start-1');
    await firstGate;
    calls.push('end-1');
    return 'one';
  });
  const second = queue.enqueue(2, async () => {
    calls.push('start-2');
    calls.push('end-2');
    return 'two';
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['start-1']);
  releaseFirst();
  assert.equal((await first).value, 'one');
  assert.equal((await second).value, 'two');
  assert.deepEqual(calls, ['start-1', 'end-1', 'start-2', 'end-2']);
  assert.equal(queue.savedRevision(), 2);

  await assert.rejects(queue.enqueue(3, async () => { calls.push('fail-3'); throw new Error('offline'); }), /offline/);
  assert.equal((await queue.enqueue(4, async () => { calls.push('start-4'); return 'four'; })).value, 'four');
  assert.deepEqual(calls.slice(-2), ['fail-3', 'start-4']);
  assert.equal(queue.savedRevision(), 4);
});

test('editor owner operations resolve the active window DataStore and only clean the exact revision', () => {
  const editor = sourceBetween(editorSource, 'function ReadingStoryEditor', '\n\nfunction ReadingStoryPages');
  assert.doesNotMatch(editor, /\bDataStore\.readingStories/);
  assert.match(editor, /const store = window\.DataStore;/);
  assert.match(editor, /revisionRef\.current === saved\.revision/);
  assert.doesNotMatch(editor, /setStory\(next\); setDirty\(0\)/);
});

test('Supabase report uses only the slug report RPC contract and caps detail at 500 chars', async () => {
  const calls = [];
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      return { data: { accepted: true }, error: null };
    },
  };
  const window = {
    RG_CONFIG: {},
    RG_SB: {
      client: () => client,
      onAuthChange: () => () => {},
    },
  };
  const context = vm.createContext({ window, console, Date, Math, Promise, String, Object, Array, Uint8Array });
  vm.runInContext(supabaseSource, context);

  const result = await window.SupabaseDataStore.readingStories.report({
    slug: 'a'.repeat(36),
    reason: 'spam',
    detail: 'x'.repeat(501),
  });
  assert.deepEqual(result, { accepted: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'reading_story_report');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params)), {
    p_slug: 'a'.repeat(36),
    p_reason: 'spam',
    p_detail: 'x'.repeat(500),
  });
  assert.equal(Object.hasOwn(calls[0].params, 'p_story_id'), false);
});

test('local report adapter fails authentication instead of pretending success', () => {
  const stories = sourceBetween(localSource, '  readingStories: {', '\n\n  /* 시간차 되감기');
  assert.match(stories, /async report\(\) \{[\s\S]*throw new Error\('reading_story_authentication_required'\)/);
});

test('republish uses one atomic RPC and both adapters expose the same contract', () => {
  const editor = sourceBetween(editorSource, 'function ReadingStoryEditor', '\n\nfunction ReadingStoryPages');
  assert.match(editor, /store\.readingStories\.republish\(\{ userBookId:book\.ubId, pages:publishedPages \}\)/);
  assert.match(editor, /merged = \{ \.\.\.story, \.\.\.next, pages:publishedPages \}/);
  assert.match(editor, /merged = \{ \.\.\.saved, \.\.\.next, pages:publishedPages \}/);
  assert.match(editor, /const storyReview = String\(\(\(source\.find\(p => p\.type === 'review'\) \|\| \{\}\)\.text\) \|\| ''\)\.trim\(\);/);
  assert.match(editor, /normalizedReview !== storyReview \? 1 : 0/);
  assert.match(editor, /if \(normalizedReview === reviewTextRef\.current\) return;/);
  assert.match(localSource, /async republish\(\)/);
  assert.match(supabaseSource, /sb\(\)\.rpc\('reading_story_republish'/);
  assert.match(republishMigrationSource, /v_saved := public\.reading_story_save_draft\(p_user_book_id, p_pages\);/);
  assert.match(republishMigrationSource, /return public\.reading_story_publish\(\(v_saved->>'id'\)::uuid\);/);
  assert.match(republishMigrationSource, /alter function public\.reading_story_republish\(uuid, jsonb\) owner to postgres;/);
  assert.match(republishMigrationSource, /revoke all on function public\.reading_story_republish/);
  assert.match(republishMigrationSource, /grant execute on function public\.reading_story_republish\(uuid, jsonb\) to authenticated;/);
  assert.match(republishMigrationSource, /grant execute on function public\.reading_story_public\(text\) to service_role;/);
});

test('completion recap CTA hands off directly to the loaded story editor', () => {
  assert.match(milestoneSource, /RG_openBook\(milestone\.bookId, \{ openReadingStory:true, storyEntry:'completion_recap' \}\)/);
  assert.doesNotMatch(milestoneSource, /rgTrack\('reading_story_editor_opened'/);
  assert.match(appSource, /window\.RG_openBook = \(id, options\) =>/);
  assert.match(appSource, /openReadingStory: !!\(options && options\.openReadingStory\)/);
  assert.match(editorSource, /book\.openReadingStory && !storyLoading && !storyLoadError && publicStoryQuoteCount > 0/);
  assert.match(editorSource, /entry:entry \|\| 'book_detail'/);
});

test('report login preserves the story path with a same-origin OAuth redirect', () => {
  assert.match(appSource, /signInWithOAuth\('google', \{ redirectTo:window\.location\.origin \+ window\.location\.pathname \}\)/);
  assert.match(supabaseClientSource, /async signInWithOAuth\(provider, oauthOptions\)/);
  assert.match(supabaseClientSource, /requested\.origin === window\.location\.origin/);
  assert.match(supabaseClientSource, /redirectTo: NATIVE_REDIRECT/);
});

test('public report sheet has the fixed reason allowlist, 500-char limit, login handling, and narrow public RPC reads', () => {
  const publicStory = sourceBetween(appSource, 'const _readingStoryReportReasons', '\n\nfunction App()');
  for (const reason of ['sexual', 'violence', 'hate_or_harassment', 'spam', 'illegal', 'other']) {
    assert.match(publicStory, new RegExp(`\\['${reason}',`));
  }
  assert.match(publicStory, /maxLength=\{500\}/);
  assert.match(publicStory, /RG_SB\.currentUser/);
  assert.match(publicStory, /RG_SB\.signInWithOAuth\('google', \{ redirectTo:window\.location\.origin \+ window\.location\.pathname \}\)/);
  assert.match(publicStory, /const store = window\.SupabaseDataStore;/);
  assert.match(publicStory, /store\.readingStories\.getPublic\(slug\)/);
  assert.match(publicStory, /store\.readingStories\.report\(\{ slug, reason:reportReason, detail:reportDetail\.trim\(\) \}\)/);
  assert.match(publicStory, /setState\(\{ status:'unavailable', story:null \}\)/);
  assert.doesNotMatch(publicStory, /window\.DataStore/);
  assert.doesNotMatch(publicStory, /story\.id|p_story_id|rg_pending_story_report_slug/);
});

test('draft fallback stays behind symmetric DataStore adapters and stores no publication fields', async () => {
  const editor = sourceBetween(editorSource, 'function ReadingStoryEditor', '\n\nfunction ReadingStoryPages');
  assert.doesNotMatch(editor, /\blocalStorage\b|_readingStoryDraftFallback/);
  assert.match(editor, /fallbackTime > serverTime/);
  assert.match(editor, /if \(fallback && !recovered[\s\S]*removeLocalDraft\(book\.ubId\)/);
  for (const method of ['readLocalDraft', 'writeLocalDraft', 'removeLocalDraft']) {
    assert.match(editor, new RegExp(`readingStories\\.${method}`));
    assert.match(localSource, new RegExp(`${method}\\(`));
    assert.match(supabaseSource, new RegExp(`${method}\\(`));
  }

  const values = new Map();
  let authListener = () => {};
  const client = {
    auth: { getSession: async () => ({ data:{ session:{ user:{ id:'user-a' } } } }) },
    rpc: async () => ({ data:null, error:null }),
  };
  const window = {
    RG_CONFIG: {},
    RG_SB: {
      client: () => client,
      onAuthChange: callback => { authListener = callback; return () => {}; },
    },
  };
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const context = vm.createContext({ window, localStorage, console, Date, JSON, Math, Promise, String, Object, Array, Uint8Array, encodeURIComponent });
  vm.runInContext(supabaseSource, context);
  const drafts = window.SupabaseDataStore.readingStories;

  assert.equal(await drafts.writeLocalDraft('book-1', [{ type:'intro', text:'private draft' }], 7), true);
  const storedKey = [...values.keys()][0];
  assert.match(storedKey, /user-a:book-1$/);
  assert.deepEqual(JSON.parse(JSON.stringify(await drafts.readLocalDraft('book-1'))).pages, [{ type:'intro', text:'private draft' }]);
  const stored = JSON.parse(values.get(storedKey));
  assert.equal(Object.hasOwn(stored, 'slug'), false);
  assert.equal(Object.hasOwn(stored, 'status'), false);

  authListener({ id:'user-b' });
  assert.equal(await drafts.readLocalDraft('book-1'), null);
  authListener({ id:'user-a' });
  assert.equal(await drafts.readLocalDraft('book-2'), null);
  assert.equal(await drafts.removeLocalDraft('book-1'), true);
  assert.equal(values.size, 0);
});

test('editor keeps an existing published story live until explicit republish', () => {
  const editor = sourceBetween(editorSource, 'function ReadingStoryEditor', '\n\nfunction ReadingStoryPages');
  assert.match(editor, /if \(story && story\.status === 'published'\) \{\s*setSaveState\('변경됨 · 다시 발행 전까지 기존 공개본 유지'\);\s*return undefined;/);
  assert.match(editor, /store\.readingStories\.republish\(\{ userBookId:book\.ubId, pages:publishedPages \}\)/);
  assert.match(editor, /writeLocalDraft\(book\.ubId, pages\(\), revisionRef\.current\)/);
});

test('editor registers save-aware back handling with preview as the topmost overlay', () => {
  const editor = sourceBetween(editorSource, 'function ReadingStoryEditor', '\n\nfunction ReadingStoryPages');
  assert.match(editor, /_storyOverlayBack\(true, close\);\s*_storyOverlayBack\(preview, \(\) => setPreview\(false\)\);/);
  assert.match(editor, /catch \(e\) \{ if \(e && e\.readingStoryDraftStored\) onClose\(\); \}/);
});

test('worker serves only RPC-eligible stories with escaped dynamic metadata and hydration shell', async () => {
  const assetRequests = [];
  const rpcRequests = [];
  const shell = '<!doctype html><html><head><title>generic</title><meta name="description" content="generic"><meta property="og:title" content="generic"><meta property="og:image" content="generic"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
  const env = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
    ASSETS: { fetch: async request => {
      assetRequests.push({ url:request.url, method:request.method });
      return new Response(new URL(request.url).pathname === '/index.html' ? shell : 'missing', {
        status:new URL(request.url).pathname === '/index.html' ? 200 : 404,
        headers:{ 'Content-Type':'text/html' },
      });
    } },
  };
  const slug = 'a'.repeat(36);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    rpcRequests.push({ url:String(url), options });
    return new Response(JSON.stringify({
      slug,
      title:'Alice & <Bob>',
      book:{ title:'Book & <Title>', coverUrl:'https://covers.example/book.jpg' },
      author:{ displayName:'Reader "One"' },
      pages:[{ type:'quote', text:'private-looking quote must stay in RPC only' }],
    }), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  try {
    const response = await worker.route(new Request(`https://readinggo.test/s/${slug}?ref=share`), env, {});
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.match(html, /<title>Alice &amp; &lt;Bob&gt; — ReadingGo<\/title>/);
    assert.match(html, /Reader &quot;One&quot;님이 남긴 Book &amp; &lt;Title&gt; 독서 이야기/);
    assert.match(html, /<link rel="canonical" href="https:\/\/readinggo\.test\/s\/a{36}"/);
    assert.match(html, /https:\/\/covers\.example\/book\.jpg/);
    assert.match(html, /<base href="\/">/);
    assert.match(html, /<div id="root"><\/div><script src="\/app\.js"><\/script>/);
    assert.doesNotMatch(html, /private-looking quote/);
    assert.doesNotMatch(html, /server-secret/);
    assert.deepEqual(assetRequests.pop(), { url:'https://readinggo.test/index.html', method:'GET' });
    assert.equal(rpcRequests.length, 1);
    assert.equal(rpcRequests[0].url, 'https://project.supabase.co/rest/v1/rpc/reading_story_public');
    assert.deepEqual(JSON.parse(rpcRequests[0].options.body), { p_slug:slug });
    assert.equal(rpcRequests[0].options.headers.apikey, 'server-secret');
    assert.ok(rpcRequests[0].options.signal);

    const head = await worker.route(new Request(`https://readinggo.test/s/${slug}`, { method:'HEAD' }), env, {});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.deepEqual(assetRequests.pop(), { url:'https://readinggo.test/index.html', method:'GET' });
    assert.equal(rpcRequests.length, 2);

    globalThis.fetch = async () => new Response('null', { status:200, headers:{ 'Content-Type':'application/json' } });
    const unavailable = await worker.route(new Request(`https://readinggo.test/s/${slug}`), env, {});
    const unavailableHtml = await unavailable.text();
    assert.equal(unavailable.status, 404);
    assert.match(unavailableHtml, /noindex,nofollow/);
    assert.doesNotMatch(unavailableHtml, /<div id="root"|private-looking quote|Book &/);
    assert.equal(assetRequests.length, 0);

    globalThis.fetch = async () => { throw new Error('offline'); };
    const failed = await worker.route(new Request(`https://readinggo.test/s/${slug}`), env, {});
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /<div id="root"|private-looking quote|Book &/);
  } finally { globalThis.fetch = originalFetch; }
});

test('worker leaves invalid story, API, static, and non-read routes on normal asset 404 behavior', async () => {
  const seen = [];
  const env = { ASSETS: { fetch: async request => {
    seen.push({ url:request.url, method:request.method });
    return new Response('missing', { status:404 });
  } } };
  const slug = 'a'.repeat(36);
  for (const path of [`/s/${'A'.repeat(36)}`, `/s/${'a'.repeat(35)}`, `/s/${slug}/`, '/api/not-real', '/missing.js']) {
    assert.equal((await worker.route(new Request(`https://readinggo.test${path}`), env, {})).status, 404, path);
    assert.equal(new URL(seen.pop().url).pathname, path);
  }
  assert.equal((await worker.route(new Request(`https://readinggo.test/s/${slug}`, { method:'POST' }), env, {})).status, 404);
  assert.deepEqual(seen.pop(), { url:`https://readinggo.test/s/${slug}`, method:'POST' });
});
