import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectBookTree } from '../docs/readinggo/js/book-tree-selector.js';

const app = readFileSync(new URL('../docs/readinggo/js/app.js', import.meta.url), 'utf8');
const treeUi = readFileSync(new URL('../docs/readinggo/js/book-tree-home-ui.js', import.meta.url), 'utf8');

const userBooks = [
  { id: 'a', book_id: 'book-a', status: 'reading', book: { title: 'A' } },
  { id: 'b', book_id: 'book-b', status: 'completed', book: { title: 'B' } },
];
const sentences = [
  { id: 'a-1', user_book_id: 'a' },
  { id: 'a-2', user_book_id: 'a' },
  { id: 'b-1', user_book_id: 'b' },
];
const tree = selectBookTree({ userBooks, sentences });
assert.equal(tree.familiarSummary, '책 2권 · 문장 3개');
assert.equal(tree.accessibilitySummary, '책 2권, 문장 3개');

assert.match(app, /window\.RG_bookTree\.fromDataStore\(window\.DataStore\)/,
  'TopBar는 RG_bookTree 권위 projection을 직접 사용해야 한다');
assert.match(treeUi, /window\.RG_bookTree\.fromDataStore\(dataStore/,
  '전용 책나무 UI도 같은 RG_bookTree projection을 사용해야 한다');

const topbar = app.slice(app.indexOf('<div className="topbar-stats">'), app.indexOf('{/* 전역 Toast'));
assert.match(topbar, /topbarTree\.tree\.familiarSummary/,
  'TopBar는 selector가 만든 익숙한 용어 요약을 그대로 표시해야 한다');
assert.match(topbar, /책과 문장 불러오는 중…/,
  '비동기 projection 로딩 중 거짓 0건을 표시하면 안 된다');
assert.match(topbar, /책과 문장 수를 불러오지 못했어요/,
  'projection 오류 상태는 안전한 대체 설명을 제공해야 한다');
assert.doesNotMatch(topbar, /\bXP\b|nestCastleCount|완성한 둥지|🪺/,
  'TopBar 사용자 표면에 XP·완성 둥지 수가 남으면 안 된다');

console.log('✓ #1453 TopBar·책나무 동일 selector 집계 계약');
