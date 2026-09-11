import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const source = readFileSync(new URL('./share-card.js', import.meta.url), 'utf8');
function harness({ visibility='private', fail=false, consent=true }={}) {
  let row={id:'ub',visibility,revision:4}; const calls=[];
  const window={crypto:{randomUUID:()=> 'retry-id'},DataStore:{auth:{currentUser:async()=>({id:'owner'})},myBooks:{
    getVisibility:async()=>{calls.push('read');return {...row};},
    setVisibility:async(id,v,opts)=>{calls.push({...opts});if(fail){fail=false;throw Error('lost');}row={id,visibility:v,revision:5};}
  }}};
  const ctx=vm.createContext({window,location:{origin:'https://example.test'},console});
  vm.runInContext(source,ctx);
  vm.runInContext('_confirmBookPublication = async () => '+consent,ctx);
  return {window,calls,ctx};
}
test('private requires consent, exact CAS identity and readback',async()=>{
 const h=harness();const result=await h.window.RG_ensureBookVisibility({userBookId:'ub'});
 assert.equal(result.visibility,'public');assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),['read',{requestId:'retry-id',expectedRevision:4},'read']);
});
test('cancel never writes; public never repeats consent',async()=>{
 const h=harness({consent:false});assert.equal(await h.window.RG_ensureBookVisibility({userBookId:'ub'}),false);assert.equal(h.calls.length,1);
 const p=harness({visibility:'public',consent:false});assert.equal((await p.window.RG_ensureBookVisibility({userBookId:'ub'})).visibility,'public');assert.equal(p.calls.length,2);
});
test('unknown blocks then retries same identifier and revision',async()=>{
 const h=harness({fail:true});assert.equal(await h.window.RG_ensureBookVisibility({userBookId:'ub'}),false);
 assert.equal((await h.window.RG_ensureBookVisibility({userBookId:'ub'})).visibility,'public');
 const writes=h.calls.filter(x=>typeof x==='object');assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
});
test('missing parent blocks; raw AI and legacy note never enter text',async()=>{
 const h=harness();assert.equal(await h.window.RG_ensureBookVisibility({bookId:'catalog'}),false);
 const text=h.window.buildShareText({text:'quote',my_note:'SECRET AI',note:'SECRET OLD',publishable_thought:'explicit thought'},{includeNote:true});
 assert.doesNotMatch(text,/SECRET/);assert.match(text,/explicit thought/);
});
test('all changed JSX modules compile with existing esbuild classic transform',async()=>{
 for(const name of ['book-detail-modal','sentence-card','settings-modal']) {
  await transform(readFileSync(new URL('./'+name+'.js',import.meta.url),'utf8'),{loader:'jsx',jsx:'transform'});
 }
});
test('removed sentence selectors and fake content-link button stay absent',()=>{
 for(const name of ['sentence-card','settings-modal']) assert.doesNotMatch(readFileSync(new URL('./'+name+'.js',import.meta.url),'utf8'),/cycleVis|default_sentence_visibility|saveSentenceVisibility/);
 assert.doesNotMatch(source,/addButton\('ReadingGo 링크 복사/);
});
