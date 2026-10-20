import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const page=await readFile(new URL('../web/page.mjs',import.meta.url),'utf8');
function copy(input){const source=page.match(/function recordTaskCopy\(task\) \{[\s\S]*?\n\}/)?.[0];assert.ok(source,'Missing task presentation for approved D01');return vm.runInNewContext(source+';recordTaskCopy')(input);}
test('task actions distinguish new entries, existing edits and pending receipts',()=>{
 assert.equal(copy({income:false}).action,'記錄消費');assert.equal(copy({income:true}).action,'儲存收入');
 assert.equal(copy({income:false,entry:{note:'合成消費',spent_on:'2026-10-17'}}).action,'儲存更改');
 assert.equal(copy({income:true,entry:{name:'合成收入',received_on:'2026-10-17'}}).action,'儲存收入更改');
 assert.equal(copy({income:true,period:{defaults:{name:'定期收入',due_on:'2026-10-17'}}}).action,'確認已收到並儲存');
 assert.equal(copy({income:false,period:{defaults:{name:'網路費',due_on:'2026-10-17'}}}).action,'記錄消費');
});
test('task context names exact object and source without changing account semantics',()=>{
 const edit=copy({income:false,entry:{note:'<合成長名稱>',spent_on:'2026-10-17'},origin:{listId:'calendar-day-results'}});
 assert.ok(edit.object.includes('<合成長名稱>')&&edit.object.includes('2026-10-17'));assert.equal(edit.source,'月曆');
 const draft=copy({income:true,period:{defaults:{name:'兼職',due_on:'2026-10-17'}}});assert.ok(draft.object.includes('2026-10-17')&&draft.source.includes('待確認'));
});
test('pending income cancel is not skip or implicit old-draft restoration',()=>{
 const result=copy({income:true,period:{defaults:{name:'兼職',due_on:'2026-10-17'}}});
 assert.match(result.cancel,/取消.*草稿/);assert.match(result.returnHint,/不等於略過/);assert.match(result.returnHint,/不自動恢復/);
});
test('return hint promises draft restoration only when a real snapshot exists',()=>{
 const task={income:false,entry:{note:'合成',spent_on:'2026-10-17'},origin:{listId:'search-results'}};
 assert.match(copy({...task,restoresDraft:true}).returnHint,/恢復原草稿/);assert.doesNotMatch(copy(task).returnHint,/恢復原草稿/);
});
