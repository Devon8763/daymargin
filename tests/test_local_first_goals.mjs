import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,readBackup,writeBackup,MAX_INTEGER} from '../web/backup.mjs';
import {portable,metadata} from '../web/idb.mjs';
import * as ledger from '../web/ledger.mjs';
const initial=()=>({format:'local-first-test-ledger',version:8,owner:'local-test-owner',...emptyData(7)});
const form=(saved_amount='0',deadline='')=>({name:'合成目標',target_amount:'100',saved_amount,deadline,remind:1,completed:0});
const add=(state,id='g_one',value=form())=>ledger.changeGoal(state,'add',id,null,value);
const item=(amount='10',goal_id='g_one',id='save')=>({id,name:id,amount,goal_id});
const allocate=(state,month,expected,items,goals={g_one:state.goals[0]?.revision})=>ledger.changeAllocation(state,month,expected,items,goals);
test('goal creation, manual correction, deadline and explicit completion never write consumption',()=>{
  let state=add(initial());assert.equal(state.goals[0].saved_cents,'0');assert.equal(state.goal_actions.length,1);
  state=ledger.changeGoal(state,'update','g_one',0,{...form('120','2026-12-31'),completed:0});
  assert.equal(state.goals[0].saved_cents,'12000');assert.equal(state.goals[0].completed,0);
  assert.equal(state.goal_actions[1].delta_cents,'12000');
  state=ledger.changeGoal(state,'update','g_one',1,{...form('120'),completed:1});
  assert.equal(state.goals[0].deadline,null);assert.equal(state.goals[0].completed,1);
  assert.equal(state.goal_actions.length,2);assert.deepEqual(state.expenses,[]);assert.deepEqual(state.incomes,[]);
});
test('same month saves apply only delta; manual reset and later removal cannot go negative',()=>{
  let state=add(initial(), 'g_one',form('5'));state=allocate(state,'2026-10',null,[item()]);
  assert.equal(state.goals[0].saved_cents,'1500');const revision=state.goals[0].revision,actions=state.goal_actions.length;
  state=allocate(state,'2026-10',0,[item()]);assert.equal(state.goals[0].revision,revision);assert.equal(state.goal_actions.length,actions);
  state=allocate(state,'2026-10',1,[item('12.01')]);assert.equal(state.goals[0].saved_cents,'1701');
  state=ledger.changeGoal(state,'update','g_one',state.goals[0].revision,form('3'));const unchanged=structuredClone(state);
  assert.throws(()=>allocate(state,'2026-10',2,[]),/低於 0/);assert.deepEqual(state,unchanged);
  state=ledger.changeGoal(state,'update','g_one',state.goals[0].revision,form('20'));
  state=allocate(state,'2026-10',2,[]);assert.equal(state.goals[0].saved_cents,'799');
});
test('different months and explicit IDs remain independent; no retroactive name linking',()=>{
  let state=add(initial());state=add(state,'g_two',{...form(),name:'合成目標'});
  state=allocate(state,'2026-09',null,[item('0.11')]);state=allocate(state,'2026-10',null,[item('0.22','g_two')],{g_two:0});
  assert.equal(state.goals[0].saved_cents,'11');assert.equal(state.goals[1].saved_cents,'22');
  state=allocate(state,'2026-11',null,[{id:'plain',name:'合成目標',amount:'9'}]);assert.equal(state.goals[0].saved_cents,'11');
  state=allocate(state,'2026-09',0,[item('0.11','g_two')],{g_one:1,g_two:1});
  assert.equal(state.goals[0].saved_cents,'0');assert.equal(state.goals[1].saved_cents,'33');
});
test('invalid input, stale goal/allocation revision, completed and exact limits reject atomically',()=>{
  for(const bad of [{...form(),name:''},{...form(),target_amount:'0'},{...form(),saved_amount:'-1'},{...form(),saved_amount:'1000000001'},{...form(),deadline:'2026-02-30'},{...form(),remind:2},{...form(),owner:'other'}])assert.throws(()=>add(initial(),'g_one',bad));
  let state=add(initial());assert.throws(()=>ledger.changeGoal(state,'update','g_one',1,form()));
  assert.throws(()=>allocate(state,'2026-10',null,[item()],{g_one:1}));assert.throws(()=>allocate(state,'2026-10',null,[item()],{}));
  state=ledger.changeGoal(state,'update','g_one',0,{...form(),completed:1});
  assert.throws(()=>allocate(state,'2026-10',null,[item()],{g_one:1}));
  assert.throws(()=>allocate(state,'2026-10',null,[item('0')],{g_one:1}));
  const max=add(initial());max.goals[0].saved_cents=MAX_INTEGER.toString();Object.assign(max.goal_actions[0],{after_cents:MAX_INTEGER.toString(),delta_cents:MAX_INTEGER.toString()});
  assert.throws(()=>allocate(max,'2026-10',null,[item('0.01')]));metadata(max);
});
test('JSON v7 strictly preserves goals/actions/links, old formats remain identical and corruption rejects',()=>{
  let state=add(initial(),'g_one',{...form(),name:'<img src=x onerror=alert(1)>'});state=allocate(state,'2026-10',null,[item('0.29')]);
  const bundle=portable(state);assert.equal(bundle.version,7);assert.deepEqual(readBackup(writeBackup(bundle)),bundle);
  for(let version=1;version<=6;version++){const old={format:'life-ledger-backup',version,data:emptyData(version)};assert.deepEqual(readBackup(writeBackup(old)),old);}
  for(const mutate of [x=>x.version=6,x=>x.data.goals[0].saved_cents='30',x=>x.data.goal_actions[1].delta_cents='1',x=>x.data.monthly_allocations[0].items[0].goal_id='missing',x=>x.data.goals.push({...x.data.goals[0]}),x=>x.data.goal_actions[1].month='2026-09',x=>x.data.goal_actions[0].goal_id='missing']){
    const broken=structuredClone(bundle);mutate(broken);assert.throws(()=>writeBackup(broken));
  }
});
test('capacity and invalid second target preserve original goals and monthly allocation',()=>{
  let state=add(initial());state=add(state,'g_two');state=allocate(state,'2026-10',null,[item()]);const original=structuredClone(state);
  assert.throws(()=>allocate(state,'2026-10',0,[item('1'),item('2','g_two','second')],{g_one:1,g_two:99}));assert.deepEqual(state,original);
  const full=initial();full.incomes=Array.from({length:100000},(_,i)=>({id:'i_'+i,received_on:'2026-10-01',cents:'1',name:'合成',voided:0,revision:0}));metadata(full);
  assert.throws(()=>add(full));assert.equal(full.goals.length,0);assert.equal(full.goal_actions.length,0);
});
test('accumulated or imported large saved totals can be retained while editing other fields',()=>{
  let state=add(initial(),'g_one',form('1000000000'));state=allocate(state,'2026-10',null,[item('.01')]);
  state=ledger.changeGoal(state,'update','g_one',1,{...form('1000000000.01'),name:'更改名稱'});
  assert.equal(state.goals[0].saved_cents,'100000000001');assert.equal(state.goal_actions.length,2);
  assert.throws(()=>ledger.changeGoal(state,'update','g_one',2,form('1000000000.02')));
});
test('completed existing goals permit decreases but refuse new contributions and overflow revisions',()=>{
  let state=add(initial());state=allocate(state,'2026-10',null,[item('10')]);state=ledger.changeGoal(state,'update','g_one',1,{...form('10','2028-02-29'),completed:1});
  assert.throws(()=>allocate(state,'2026-10',0,[item('11')],{g_one:2}));
  state=allocate(state,'2026-10',0,[item('9')],{g_one:2});assert.equal(state.goals[0].saved_cents,'900');
  state.goals[0].revision=MAX_INTEGER;metadata(state);
  assert.throws(()=>allocate(state,'2026-10',1,[],{g_one:MAX_INTEGER}));
  assert.throws(()=>ledger.changeGoal(state,'update','g_one',MAX_INTEGER,{...form('9'),completed:1}));
});
