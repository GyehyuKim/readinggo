import { assertValidChapterRows, sameChapterRows } from './chapter-core.js';

// Migrates one local TOC without ever overwriting a non-matching remote TOC.
// The caller persists its independent completion marker only when complete=true.
export async function migrateGuestChapters({ chapters, remoteUserBookId, dataStore, totalPages = null }) {
  const local = assertValidChapterRows(Array.isArray(chapters) ? chapters : [], totalPages);
  if (!local.length) return { complete: true, rows: [] };
  if (!remoteUserBookId || !dataStore || !dataStore.chapters) throw new Error('chapter_migration_target_required');
  const before = await dataStore.chapters.list(remoteUserBookId);
  if (sameChapterRows(local, before)) return { complete: true, rows: before, replayed: true };
  if (before.length) {
    const error = new Error('chapter_migration_conflict');
    error.code = 'chapter_migration_conflict';
    throw error;
  }
  try {
    await dataStore.chapters.replace(remoteUserBookId, local);
  } catch (cause) {
    // Unknown network outcome: one authoritative read can prove that the exact
    // intended rows committed. Anything else remains incomplete and local survives.
    let recovered = [];
    try { recovered = await dataStore.chapters.list(remoteUserBookId); } catch (readError) {}
    if (!sameChapterRows(local, recovered)) throw cause;
  }
  const after = await dataStore.chapters.list(remoteUserBookId);
  if (!sameChapterRows(local, after)) throw new Error('chapter_migration_readback_mismatch');
  return { complete: true, rows: after };
}

if (typeof window !== 'undefined') window.RG_migrateGuestChapters = migrateGuestChapters;
