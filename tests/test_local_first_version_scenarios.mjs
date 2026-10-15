import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let helpers;try{helpers=await import('./local_first_version_scenarios.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const api=()=>{assert.ok(helpers,'Missing fail-closed version scenario helpers');return helpers;};
const old={version:'1.2.3',cache:'local-first-offline-1.2.3-v1'},next={version:'1.2.4',cache:'local-first-offline-1.2.4-v1'};
test('replacement rejects absent or duplicate targets and no-op replacements',()=>{
  const {replaceOnce}=api();assert.throws(()=>replaceOnce('none','old','new'),/hit|count/i);assert.throws(()=>replaceOnce('old old','old','new'),/hit|count/i);assert.throws(()=>replaceOnce('old','old','old'),/different/i);assert.equal(replaceOnce('A old B','old','new'),'A new B');
});
test('scenario rejects the same old/new page or cache independently',()=>{
  const {validateScenario}=api();assert.throws(()=>validateScenario({old,next:old}),/different/i);assert.throws(()=>validateScenario({old,next:{...next,cache:old.cache}}),/different/i);assert.throws(()=>validateScenario({old,next:{...next,version:old.version}}),/different/i);validateScenario({old,next});
});
test('response validation rejects missing, duplicate or wrong HTML and worker versions',()=>{
  const {assertVersionResponse}=api();for(const body of ['no marker','<p id="page-version">目前使用頁面版本：1.2.4</p>','<p id="page-version">目前使用頁面版本：1.2.3</p>'.repeat(2)])assert.throws(()=>assertVersionResponse('/local-first/',body,old));
  for(const body of ['none',"const CACHE = 'local-first-offline-1.2.4-v1';","const CACHE = 'local-first-offline-1.2.3-v1';".repeat(2)])assert.throws(()=>assertVersionResponse('/local-first/sw.js',body,old));
  assertVersionResponse('/local-first/','<p id="page-version">目前使用頁面版本：1.2.3</p>',old);assertVersionResponse('/local-first/sw.js',"const CACHE = 'local-first-offline-1.2.3-v1';",old);
});
test('synthetic transforms only exact version targets and preserves schema, backup and asset contracts',()=>{
  const {CURRENT,SYNTHETIC,renderPreviewVersion,assertVersionResponse}=api();
  const html='<p id="page-version">目前使用頁面版本：'+CURRENT.version+'</p><p>schema11 JSON v1～v10 encrypted v1</p>';
  const sw="const CACHE = '"+CURRENT.cache+"';\nconst ASSETS=['/local-first/idb.mjs'];";
  const changed=renderPreviewVersion('/local-first/',html,'next');assertVersionResponse('/local-first/',changed,SYNTHETIC.next);assert.ok(changed.includes('schema11 JSON v1～v10 encrypted v1'));
  const worker=renderPreviewVersion('/local-first/sw.js',sw,'next');assertVersionResponse('/local-first/sw.js',worker,SYNTHETIC.next);assert.ok(worker.endsWith("const ASSETS=['/local-first/idb.mjs'];"));
  assert.throws(()=>renderPreviewVersion('/local-first/',html.replace(CURRENT.version,'9.9.9'),'next'));assert.throws(()=>renderPreviewVersion('/local-first/sw.js',sw+sw,'next'));
});
test('independent test pins match actual current HTML and worker, while historical and synthetic scenarios differ',async()=>{
  const {CURRENT,SYNTHETIC,RELEASE,validateScenario,assertVersionResponse}=api();validateScenario(SYNTHETIC);validateScenario(RELEASE);
  assert.notDeepEqual(CURRENT,RELEASE.old);assert.equal(SYNTHETIC.label.includes('合成'),true);assert.equal(RELEASE.label.includes('真實'),true);
  assertVersionResponse('/local-first/',await readFile(new URL('../web/index.html',import.meta.url),'utf8'),CURRENT);
  assertVersionResponse('/local-first/sw.js',await readFile(new URL('../web/sw.js',import.meta.url),'utf8'),CURRENT);
});
