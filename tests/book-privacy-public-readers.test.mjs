import assert from 'node:assert/strict';
const calls = [];
const rows = Array.from({length: 125}, (_,i) => ({id: String(i),userId:'other',userBookId:'ub',bookId:'book',text:'quote',thought:'explicit',createdAt:'2026-01-01',clapCount:i,parent:{book:{title:'Title',coverUrl:'cover'},author:{displayName:'Reader'}}}));
globalThis.window = { RG_SB: { client: () => ({ rpc: async (name,args) => {
 calls.push({name,args});
 assert.equal(name,'sentences_public_feed');
 return {data: rows.slice(args.p_offset,args.p_offset+args.p_limit)};
} }) } };
await import('../docs/readinggo/js/datastore-supabase.js');
const result = await window.SupabaseDataStore.sentences.feed({limit:120});
assert.equal(result.length,120);
assert.deepEqual(calls.map(x=>x.args.p_offset),[0,50,100]);
assert.equal(result[119].clapCount,119);
assert.equal(result[0].user.display_name,'Reader');
assert.equal(result[0].user_book.book.cover_url,'cover');
assert.equal(result[0].publishable_thought,'explicit');
assert.equal(Object.hasOwn(result[0],'my_note'),false);
console.log('OK: public reader pages and safe UI mappings');
