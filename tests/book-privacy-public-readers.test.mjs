import assert from 'node:assert/strict';
const calls = [];
const rows = Array.from({length: 125}, (_,i) => ({id: String(i),userId:'other',userBookId:'ub',bookId:'book',text:'quote',thought:'explicit',createdAt:'2026-01-01',clapCount:i,parent:{book:{title:'Title',coverUrl:'cover'},author:{displayName:'Reader'}}}));
globalThis.window = { RG_SB: { client: () => ({ rpc: async (name,args) => {
 calls.push({name,args});
 assert.ok(['sentences_public_feed','book_public_quotes'].includes(name));
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
calls.length = 0;
const byBook = await window.SupabaseDataStore.sentences.publicByBook('ub');
assert.equal(byBook.length,125);
assert.deepEqual(calls.map(x=>x.args),[
 {p_user_book_id:'ub',p_sentence_id:null,p_limit:50,p_offset:0},
 {p_user_book_id:'ub',p_sentence_id:null,p_limit:50,p_offset:50},
 {p_user_book_id:'ub',p_sentence_id:null,p_limit:50,p_offset:100},
]);
console.log('OK: public reader pages and safe UI mappings');
