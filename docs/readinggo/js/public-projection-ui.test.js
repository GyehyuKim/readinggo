import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function load(name, states = []) {
  let index = 0;
  const effects = [];
  const hooks = { ...React, useState: initial => {
    const i = index++;
    if (!(i in states)) states[i] = initial;
    return [states[i], value => { states[i] = value; }];
  }, useEffect: fn => effects.push(fn), useCallback: fn => fn };
  const window = { rgIcon: () => null, decodeEntities: x => x,
    SectionLabel: 'label', SentenceCard: props => React.createElement('pre', null, JSON.stringify(props.item)),
    SentenceActions: props => React.createElement('pre', null, JSON.stringify(props.sentence)) };
  const ctx = vm.createContext({ React: hooks, ReactDOM: { createPortal: x => x }, window,
    document: { body: {} }, location: { origin: 'https://example.test' }, console });
  const source = readFileSync(new URL(`./${name}.js`, import.meta.url), 'utf8');
  vm.runInContext((await transform(source, { loader: 'jsx', jsx: 'transform' })).code, ctx);
  return { ctx, states, effects, window, render: expr => { index = 0; return renderToStaticMarkup(vm.runInContext(expr, ctx)); } };
}
const privateMember = { user: { id: 'reader', cumulativePage: null, todayRecorded: null, streak: null, activityAvailable: false } };

test('SQL69 unavailable activity and progress stay null; real zero stays zero', async () => {
  const { ctx } = await load('co-reading');
  ctx.members = [privateMember];
  let stats = vm.runInContext('rgRoomStats(members, {total_pages:100})', ctx);
  assert.equal(stats.todayCount, null); assert.equal(stats.avgPct, null);
  ctx.members = [{ user: { cumulativePage: 0, todayRecorded: false } }];
  stats = vm.runInContext('rgRoomStats(members, {total_pages:100})', ctx);
  assert.equal(stats.todayCount, 0); assert.equal(stats.avgPct, 0);
  ctx.members.push(privateMember);
  stats = vm.runInContext('rgRoomStats(members, {total_pages:100})', ctx);
  assert.equal(stats.todayCount, null); assert.equal(stats.avgPct, null);
  assert.equal(vm.runInContext('rgMemberPartStatus(null,100)', ctx), 'unavailable');
  assert.equal(vm.runInContext('rgMemberPartStatus(undefined,null)', ctx), 'unavailable');
  assert.equal(vm.runInContext('rgMemberPartStatus(0,100)', ctx), 'behind');
  assert.equal(vm.runInContext('rgMemberPartStatus(100,100)', ctx), 'done');
  assert.equal(vm.runInContext('RoomTodayDots({today:null,count:2})', ctx), null);
});

test('room member rendering never labels unavailable data as zero or unlit', async () => {
  const h = await load('co-reading', [{ id: 'room', book: { total_pages: 100 } }, [privateMember], 'members', [], false, false]);
  const html = h.render('RoomModal({roomId:"room"})');
  assert.match(html, /진도 확인 불가/);
  assert.doesNotMatch(html, /진도 0%|오늘 0명|rg-room-light|평균 진도/);
});

test('schedule suppresses unknown completion and never marks private members behind', async () => {
  const h = await load('co-reading', [[{ id: 'part', end_page: 100 }], false, {}]);
  h.ctx.members = [privateMember];
  const html = h.render('RoomSchedule({roomId:"room",room:{},members,totalPages:100})');
  assert.match(html, /확인 불가/);
  assert.doesNotMatch(html, /뒤처짐|온트랙|0\/100쪽|rg-part-progressbar|rg-part-cheer/);
});

test('popular and owner sentence projections keep exact parent and explicit thought only', async () => {
  const sentence = { id: 'sentence', user_book_id: 'actual-parent', book_id: 'catalog', text: 'quote', publishable_thought: 'explicit-thought', my_note: 'SECRET', note: 'SECRET' };
  const h = await load('book-info-modal', [{ id: 'catalog', title: 'Book', total_pages: 100 }, '', '', '', [sentence], true, false, [], 'reading', []]);
  const html = h.render('BookInfoModal({bookId:"catalog"})');
  assert.match(html, /actual-parent/); assert.match(html, /explicit-thought/); assert.doesNotMatch(html, /SECRET/);
  h.window.DataStore = { sentences: { listMine: async () => [sentence] } };
  // Execute the owner-list effect, then inspect the actual state projection.
  h.effects[4]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.states[7][0].userBookId, 'actual-parent');
  assert.equal(h.states[7][0].publishable_thought, 'explicit-thought');
  assert.doesNotMatch(JSON.stringify(h.states[7]), /SECRET|my_note/);
});
