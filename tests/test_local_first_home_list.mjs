import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {homeFixture} from './local_first_home_fixture.mjs';
import {emptyData,writeBackup,MAX_BYTES} from '../web/backup.mjs';
import {portable,metadata} from '../web/idb.mjs';
const page=await readFile(new URL('../web/page.mjs',import.meta.url),'utf8');
const source=page.match(/function expenseRelations\(snapshot\) \{[\s\S]*?\n\}/)?.[0];
const relations=state=>{assert.ok(source,'Missing per-render relation index');return vm.runInNewContext('('+source+')') (state);};

test('home relation index preserves definition order, multiple tags, hidden text and usage ownership without mutation',()=>{
  const state={usage_periods:[{expense_id:'e_b',days:30},{expense_id:'e_a',days:7}],tags:[{id:'t_a',name:'<img src=x>',hidden:0},{id:'t_b',name:'B',hidden:1}],expense_tags:[{expense_id:'e_a',tag_id:'t_b'},{expense_id:'e_b',tag_id:'t_b'},{expense_id:'e_a',tag_id:'t_a'}],annual_periods:[{expense_id:'e_a'}],scheduled_periods:[{expense_id:'e_c'}]};
  const before=JSON.stringify(state),result=relations(state);
  assert.equal(result.usage.get('e_a').days,7);assert.equal(result.usage.get('e_b').days,30);
  assert.deepEqual(Array.from(result.labels.get('e_a')),['#<img src=x>','#B（不再顯示）']);
  assert.deepEqual(Array.from(result.labels.get('e_b')),['#B（不再顯示）']);
  assert.equal(result.posted.has('e_a'),true);assert.equal(result.posted.has('e_c'),true);
  assert.equal(JSON.stringify(state),before);
});
test('new snapshots produce fresh relation indexes, including empty and removed associations',()=>{
  const state={usage_periods:[{expense_id:'e',days:7}],tags:[{id:'t',name:'old',hidden:0}],expense_tags:[{expense_id:'e',tag_id:'t'}],annual_periods:[],scheduled_periods:[]};
  const old=relations(state),next=relations({...state,usage_periods:[{expense_id:'e',days:30}],tags:[{id:'t',name:'new',hidden:0}]});
  assert.equal(old.usage.get('e').days,7);assert.equal(next.usage.get('e').days,30);
  assert.deepEqual(Array.from(next.labels.get('e')),['#new']);
  const empty=relations({usage_periods:[],tags:[],expense_tags:[],annual_periods:[],scheduled_periods:[]});
  assert.equal(empty.labels.size,0);assert.equal(empty.usage.size,0);
});
test('relation arrays are visited once per index and row lookups never rescan them',()=>{
  const visited={};
  const once=(key,rows)=>({*[Symbol.iterator](){for(const row of rows){visited[key]=(visited[key]??0)+1;yield row;}}});
  const state={usage_periods:once('usage',Array.from({length:1000},(_,i)=>({expense_id:'e_'+i,days:30}))),
    tags:once('tags',[{id:'t',name:'one',hidden:0}]),expense_tags:once('links',Array.from({length:1000},(_,i)=>({expense_id:'e_'+i,tag_id:'t'}))),annual_periods:[],scheduled_periods:[]};
  const result=relations(state);for(let i=0;i<1000;i++){assert.equal(result.usage.get('e_'+i).days,30);assert.equal(result.labels.get('e_'+i)[0],'#one');}
  assert.deepEqual(visited,{usage:1000,tags:1,links:1000});
});
test('representative 1000/5000/10000 seeds retain complete validated actions and metadata within existing limits',()=>{
  for(const count of [0,1,50,51,1000,5000,10000]){
    const state=homeFixture(count,'2026-10-15',emptyData),bytes=writeBackup(portable(state)),meta=metadata(state);
    assert.equal(state.actions.length,count);assert.equal(state.usage_periods.length,count);assert.equal(state.expense_tags.length,2*count);
    assert.equal(meta.row_count,5*count+15);assert.ok(meta.row_count<=100000&&bytes.length<=MAX_BYTES);
  }
  assert.throws(()=>homeFixture(10001,'2026-10-15',emptyData));
});
