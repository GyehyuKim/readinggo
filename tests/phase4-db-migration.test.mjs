import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrations = path.join(root, 'docs', 'readinggo', 'supabase');
const migrationName = '55_remove_legacy_xp_repair.sql';
const migration = fs.readFileSync(path.join(migrations, migrationName), 'utf8');

const position = (pattern, label) => {
  const index = migration.search(pattern);
  assert.notEqual(index, -1, `${label} must be present`);
  return index;
};

test('Phase 4 migration is sequential and snapshots every legacy DB surface before dropping it', () => {
  assert.equal(fs.existsSync(path.join(migrations, '54_freeze_increment_xp.sql')), true);
  assert.equal(fs.existsSync(path.join(migrations, migrationName)), true);

  const backups = [
    ['increment_xp', /create table if not exists migration_backups\.phase4_increment_xp/i, /drop function if exists public\.increment_xp\(int\)/i],
    ['users_public view', /create table if not exists migration_backups\.phase4_users_public_view/i, /drop view if exists public\.users_public/i],
    ['reading_sessions.xp_earned', /create table if not exists migration_backups\.phase4_reading_sessions_xp/i, /alter table if exists public\.reading_sessions drop column if exists xp_earned/i],
    ['users.xp', /create table if not exists migration_backups\.phase4_users_xp/i, /alter table if exists public\.users drop column if exists xp/i],
    ['streak.last_repair_date', /create table if not exists migration_backups\.phase4_streak_repair/i, /alter table if exists public\.streak drop column if exists last_repair_date/i],
  ];
  for (const [label, backupPattern, dropPattern] of backups) {
    const backup = position(backupPattern, `${label} backup table`);
    const drop = position(dropPattern, `${label} drop`);
    assert.ok(backup < drop, `${label} must be snapshotted before drop`);
  }
});

test('Phase 4 migration is retry-safe and verifies DEV-readable postconditions', () => {
  assert.match(migration, /begin;[\s\S]*commit;/i);
  assert.match(migration, /create schema if not exists migration_backups/i);
  assert.match(migration, /information_schema\.columns/g);
  assert.match(migration, /on conflict \([^)]*\) do nothing/g);
  assert.doesNotMatch(migration, /on conflict \([^)]*\) do update/g, 'retry must not overwrite the first rollback snapshot');
  assert.match(migration, /table_name = 'users_public' and column_name = 'xp'[\s\S]*insert into migration_backups\.phase4_users_public_view/i,
    'users_public snapshot must only be captured while the legacy XP column exists');
  assert.match(migration, /to_regprocedure\('public\.increment_xp\(integer\)'\)/g);
  assert.match(migration, /pg_get_viewdef\(c\.oid, true\)/i);
  const viewDrop = position(/drop view if exists public\.users_public/i, 'users_public drop');
  const viewCreate = position(/create view public\.users_public as[\s\S]*u\.wishlist_public, u\.created_at[\s\S]*moderation_user_visible\(u\.id\)/i, 'XP-free users_public recreation');
  const usersXpDrop = position(/alter table if exists public\.users drop column if exists xp/i, 'users.xp drop');
  assert.ok(viewDrop < viewCreate && viewCreate < usersXpDrop, 'users_public must be recreated without XP before users.xp is dropped');
  assert.match(migration, /grant select on public\.users_public to authenticated/i);
  assert.match(migration, /revoke select on public\.users_public from public, anon/i);
  assert.match(migration, /has_table_privilege\('authenticated', 'public\.users_public', 'select'\)/i);
  assert.match(migration, /has_table_privilege\('anon', 'public\.users_public', 'select'\)/i);
  assert.match(migration, /backup mismatch/g);
  assert.match(migration, /\$readback\$[\s\S]*legacy XP\/repair column still exists/i);
  assert.match(migration, /to_regclass\('public\.books'\)[\s\S]*to_regclass\('public\.sentences'\)[\s\S]*session_date/i);
});

test('migration and bootstrap schema preserve protected book, sentence, progress, and session-date data', () => {
  const destructive = [...migration.matchAll(/(?:drop\s+(?:table|column)|delete\s+from|truncate\s+table)[^;]*/gi)]
    .map((match) => match[0])
    .join('\n');
  assert.doesNotMatch(destructive, /\bbooks?\b|\bsentences?\b|current_page|session_date/i);

  const schema = fs.readFileSync(path.join(migrations, 'schema.sql'), 'utf8');
  assert.doesNotMatch(schema, /^\s*xp\s+int\b/m);
  assert.doesNotMatch(schema, /^\s*xp_earned\s+int\b/m);
  assert.doesNotMatch(schema, /last_repair_date/i);
  assert.match(schema, /current_page\s+int/i);
  assert.match(schema, /session_date\s+date/i);
});
