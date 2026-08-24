import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const migration = read('docs/readinggo/supabase/49_ugc_moderation.sql');
const hardening = read('docs/readinggo/supabase/50_ugc_moderation_hardening.sql');
const supa = read('docs/readinggo/js/datastore-supabase.js');
const local = read('docs/readinggo/js/datastore.js');
const moderation = read('docs/readinggo/js/moderation.js');
const card = read('docs/readinggo/js/sentence-card.js');
const profile = read('docs/readinggo/js/user-profile-modal.js');
const app = read('docs/readinggo/js/app.js');
const nest = read('docs/readinggo/js/nest.js');
const main = read('docs/readinggo/main.js');
const admin = read('docs/readinggo/js/admin-dashboard.js');
const guidelines = read('docs/readinggo/public/community-guidelines.html');

for (const token of [
  'create table if not exists public.moderation_reports',
  'create table if not exists public.user_blocks',
  'create function public.moderation_report',
  'create or replace function public.moderation_block_user',
  'create or replace function public.moderation_accept_terms',
  'create or replace function public.moderation_user_visible',
  'create or replace function public.moderation_admin_reports',
  'create or replace function public.moderation_admin_action',
  'create or replace function public.moderation_admin_review',
  "s.visibility = 'public'",
  "s.visibility = 'followers'",
  'moderation_hidden_sentences',
  'moderation_suspended_users',
  'r.reporter_id = auth.uid()',
  'b.blocker_id = auth.uid()',
]) assert.ok(migration.includes(token), `migration contract missing: ${token}`);

assert.ok(migration.includes("revoke all on public.moderation_reports from anon, authenticated"), 'report table must not expose moderator detail directly');
assert.ok(!migration.includes('grant select on public.moderation_reports to authenticated'), 'authenticated must use narrow report/admin RPCs');
assert.ok(migration.includes("jsonb_build_object('id', v_report.id, 'status', v_report.status)"), 'report RPC must return only id/status');
assert.ok(migration.includes("nullif(settings #>> '{ugc_terms,accepted_at}', '') is not null"), 'server acceptance timestamp must be required');
assert.ok(migration.includes('using (public.moderation_user_visible(id))'), 'base users access must not bypass block/suspension/report filters');
assert.ok(migration.includes('and public.moderation_user_visible(following_id)'), 'blocked users must not recreate follows');

for (const method of ['report', 'blockUser', 'unblockUser', 'listBlockedUsers', 'isBlocked']) {
  assert.ok(supa.includes(`async ${method}`), `Supabase moderation method missing: ${method}`);
  assert.ok(local.includes(`async ${method}`), `Local moderation method missing: ${method}`);
}

assert.ok(main.includes("import './js/moderation.js'"), 'moderation module must load before app');
assert.ok(moderation.includes('RG_UGC_TERMS_VERSION'), 'versioned UGC acceptance missing');
assert.ok(moderation.includes('api.acceptTerms(RG_UGC_TERMS_VERSION)'), 'acceptance must use server-timestamped RPC');
assert.ok(moderation.includes('rg:moderation-hidden'), 'immediate hide event missing');
assert.ok(card.includes('RG_openReport'), 'SentenceCard report entry missing');
assert.ok(profile.includes('프로필 신고') && profile.includes('사용자 차단'), 'profile safety actions missing');
assert.ok(app.includes('await syncPendingToSupabase({ allowPublic: ugcAccepted })'), 'private guest sync must run before UGC acceptance');
assert.ok(app.includes('syncedSentenceIds.has'), 'guest sync must clear only successfully persisted migration UUIDs');
const ugcPreflight = nest.indexOf('if (window.DataStore === window.SupabaseDataStore');
const ugcRequired = nest.indexOf("window.dispatchEvent(new CustomEvent('rg:ugc-terms-required'))", ugcPreflight);
const checkinPersistence = nest.indexOf('checkinResult = onCheckin(', ugcPreflight);
assert.ok(ugcPreflight >= 0 && ugcRequired > ugcPreflight && checkinPersistence > ugcRequired,
  'public check-in must preflight terms before persistence');
assert.ok(card.includes("error.message !== 'ugc_terms_required'"), 'visibility UI must not move before a rejected public update');
assert.ok(admin.includes('moderationReports') && admin.includes('moderationAction'), 'admin moderation queue missing');
assert.ok(admin.includes('moderationReview') && admin.includes('검토 시작'), 'reviewed-state transition missing');
assert.ok(guidelines.includes('성적이거나') && guidelines.includes('신고와 차단'), 'public community guidelines incomplete');

assert.ok(hardening.includes('moderation_guard_public_profile_write'), 'public profile writes need a DB consent/suspension guard');
assert.ok(hardening.includes('moderation_guard_public_review_write'), 'public review writes need a DB consent/suspension guard');
assert.ok(hardening.includes("where status in ('open', 'reviewed')"), 'only active reports may be unique');
assert.ok(hardening.includes("on conflict (reporter_id, target_type, target_id) where status in ('open', 'reviewed')"), 'dismissed/actioned reports must create a new open report');
assert.ok(app.includes("RG_normalizeStoredSentenceVisibility(se.visibility) !== 'private' && !allowPublic"), 'public guest sentences must remain local until consent');
assert.ok(app.includes("pendingBookSynced && (!pend.sentence || !pend.sentence.text || pendingSentenceSynced)"), 'pending book marker must survive sentence failure');
assert.ok(app.includes('pb.remote_user_book_id'), 'partial retry must reuse the already-created remote book');
assert.ok(app.includes('syncedSentenceIds.has(se._migration_sentence_id)'), 'guest sentences without local ids must clear only after their migration UUID succeeds');
assert.ok(supa.includes('if (migrationUuid) ins.id = migrationUuid'), 'guest user_books retries must reuse a client-persisted UUID');
assert.ok(supa.includes('if (migrationUuid) payload.id = migrationUuid'), 'guest sentence retries must reuse a client-persisted UUID');

console.log('✅ UGC moderation contract passed');
