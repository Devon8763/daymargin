import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyData,readBackup,writeBackup,BackupError} from '../web/backup.mjs';
const initial=()=>({format:'local-first-test-ledger',version:3,owner:'local-test-owner',...emptyData(),incomes:[],income_actions:[],monthly_allocations:[],allocation_preferences:[]});
const bundle=data=>({format:'life-ledger-backup',version:2,data:Object.fromEntries(Object.entries(data).filter(([key])=>!['format','version','owner'].includes(key)))});
const form=(amount='0.10',received_on='2026-10-01')=>({amount,received_on,name:'月薪'});
const change=async(state,operation,id,revision,input,today='2026-10-04')=>(await import('../web/ledger.mjs')).changeIncome(state,operation,id,revision,input,today);

test('separate income records: exact month totals, date moves, void and immutable history',async()=>{
  let state=await change(initial(),'add','i_one',null,form());
  state=await change(state,'add','i_two',null,form('0.20'));
  state=await change(state,'add','i_september',null,form('10','2026-09-30'));
  const {incomeMonth}=await import('../web/income.mjs');
  assert.equal(incomeMonth(state,'2026-10').received,30n);
  assert.equal(incomeMonth(state,'2026-09').received,1000n);
  state=await change(state,'update','i_one',0,form('0.11','2026-09-30'));
  assert.equal(incomeMonth(state,'2026-10').received,20n);
  state=await change(state,'void','i_two',0,null);
  assert.equal(incomeMonth(state,'2026-10').received,0n);
  assert.equal(state.income_actions.at(-1).before.cents,'20');
  assert.equal(state.income_actions.length,5);
  assert.deepEqual(state.expenses,[]); assert.deepEqual(state.budgets,[]);
  await assert.rejects(change(state,'void','i_two',1,null));
});
test('income rejects future, malformed values, missing source, forged fields and old revision',async()=>{
  for(const bad of [form('0'),form('-1'),form('1.001'),form('1000000001'),form('1','2026-02-30'),form('1','2026-10-05'),{...form(),name:''},{...form(),voided:1}])await assert.rejects(change(initial(),'add','i_one',null,bad));
  const state=await change(initial(),'add','i_one',null,form());
  await assert.rejects(change(state,'update','i_one',1,form()));
  await assert.rejects(change(state,'add','i_one',null,form()));
  assert.equal((await change(initial(),'add','i_limit',null,form('1000000000'))).incomes[0].cents,'100000000000');
});
test('allocation defaults only living; under/equal/over allocation and zero income remain plans',async()=>{
  const {incomeMonth,defaultAllocation}=await import('../web/income.mjs');
  const {changeAllocation}=await import('../web/ledger.mjs');
  let state=initial(); assert.deepEqual(defaultAllocation(),[{id:'living',name:'生活開銷',cents:'0'}]);
  for(const value of ['0','0.10','0.20','0.30']){
    state=changeAllocation(state,'2026-10',state.monthly_allocations[0]?.revision??null,[{id:'living',name:'生活開銷',amount:value},{id:'custom_one',name:'自訂用途',amount:'0'}]);
    assert.equal(incomeMonth(state,'2026-10').received,0n);
  }
  state=await change(state,'add','i_one',null,form('0.20'));
  assert.equal(incomeMonth(state,'2026-10').difference,-10n);
  const saved=structuredClone(state.monthly_allocations);
  state=await change(state,'update','i_one',0,form('0.50'));
  assert.deepEqual(state.monthly_allocations,saved);
  assert.equal(incomeMonth(state,'2026-10').difference,20n);
  assert.equal(incomeMonth(state,'2026-11').allocated,0n);
  assert.throws(()=>changeAllocation(state,'2026-10',null,[])); // Existing month still needs its current revision.
  assert.equal(changeAllocation(state,'2026-11',null,[{id:'living',name:'生活開銷',amount:'0.00'}]).monthly_allocations.at(-1).items[0].cents,'0');
  for(const rows of [[{id:'living',name:'',amount:'1'}],[{id:'living',name:'生活開銷',amount:'1'},{id:'living',name:'重複',amount:'1'}]])assert.throws(()=>changeAllocation(state,'2026-11',null,rows));
  assert.equal(changeAllocation(state,'2026-11',null,[{id:'living',name:'生活費',amount:'1'}]).monthly_allocations.at(-1).items[0].name,'生活費');
  assert.deepEqual(changeAllocation(state,'2026-11',null,[]).monthly_allocations.at(-1).items,[]);
});
test('monthly recurring suggestion uses existing versions, null day, final period and read-only exclusion',async()=>{
  const {recurringSuggestions}=await import('../web/income.mjs');
  const {changeSuggestion}=await import('../web/ledger.mjs');
  let state=initial();
  state.recurring_rules=['固定','訂閱','分期'].map((kind,i)=>({id:'r_'+i,name:kind,cents:'100',category:'餐飲',kind,start_month:'2026-09',periods:kind==='分期'?2:0,due_day:i?31:null,active:1,revision:0}));
  state.recurring_versions.push({id:'v_one',recurring_id:'r_1',effective_month:'2026-10',name:'訂閱',cents:'123',category:'餐飲',due_day:31});
  const unchanged=structuredClone(state);
  assert.equal(recurringSuggestions(state,'2026-10').total,323n);
  assert.equal(recurringSuggestions(state,'2026-09').items[2].due_on,'2026-09-30');
  assert.equal(recurringSuggestions(state,'2026-11').items.length,2);
  assert.deepEqual(state,unchanged);
  state=changeSuggestion(state,'2026-10','r_0','month',null);
  assert.equal(recurringSuggestions(state,'2026-10').total,223n);
  assert.equal(recurringSuggestions(state,'2026-11').total,223n);
  state=changeSuggestion(state,'2026-10','r_1','future',null);
  assert.equal(recurringSuggestions(state,'2026-11').total,100n);
  assert.deepEqual(state.recurring_rules,unchanged.recurring_rules); assert.deepEqual(state.expenses,[]);
  state.recurring_rules[0].active=0;
  assert.equal(recurringSuggestions(state,'2026-11').total,0n);
  assert.throws(()=>changeSuggestion(state,'2026-10','r_1','future',null));
});
test('JSON v2 validates all finance rows, references and order; v1 remains unchanged',async()=>{
  let state=await change(initial(),'add','i_one',null,form());
  const full=bundle(state);assert.deepEqual(readBackup(writeBackup(full)),full);
  const legacy={format:'life-ledger-backup',version:1,data:emptyData()};assert.deepEqual(readBackup(writeBackup(legacy)),legacy);
  const mutations=[x=>x.data.incomes.push({...x.data.incomes[0]}),x=>x.data.income_actions[0].income_id='missing',x=>x.data.incomes[0].cents='0',x=>x.data.incomes[0].received_on='2026-02-30',x=>x.data.incomes[0].kind='consumption',x=>x.version=3,x=>delete x.data.incomes,x=>x.data.allocation_preferences.push({recurring_id:'missing',excluded:1,revision:0})];
  for(const mutate of mutations){const bad=structuredClone(full);mutate(bad);assert.throws(()=>writeBackup(bad),BackupError);}
  assert.equal(readBackup(writeBackup(full)).data.income_actions[0].before,null);
});
test('income is an optional secondary entry and its local module is fully cached and allowlisted',()=>{
  const source=file=>readFileSync(new URL('../web/'+file,import.meta.url),'utf8');
  assert.match(source('index.html'),/<details id="income-planning">/);
  assert.match(source('index.html'),/href="#income-planning"/);
  for(const file of ['sw.js','serve.mjs'])assert.match(source(file),/income\.mjs/);
});
test('allocation peer conflict, malformed references and exact row capacity are rejected without mutation',async()=>{
  const {changeAllocation,changeSuggestion}=await import('../web/ledger.mjs');
  const state=initial(),before=structuredClone(state),items=[{id:'living',name:'生活開銷',amount:'1'}];
  const changed=changeAllocation(state,'2026-10',null,items);
  assert.throws(()=>changeAllocation(changed,'2026-10',null,items));
  assert.throws(()=>changeSuggestion(state,'2026-10','missing','month',null));
  for(const bad of [{...items[0],amount:'-1'},{...items[0],id:'bad id'},{...items[0],amount:'1000000001'}])assert.throws(()=>changeAllocation(state,'2026-10',null,[bad]));
  assert.deepEqual(state,before);
  const capacity=initial();capacity.incomes=Array.from({length:100000},(_,i)=>({id:'i_'+i,received_on:'2026-10-01',cents:'1',name:'容量合成',voided:0,revision:0}));
  await assert.rejects(change(capacity,'add','i_limit',null,form()));
  assert.equal(capacity.incomes.length,100000);assert.equal(capacity.income_actions.length,0);
});
test('completed last installment and extreme imported cents do not revive or lose exact totals',async()=>{
  const {recurringSuggestions,incomeMonth}=await import('../web/income.mjs');
  const state=initial();state.recurring_rules=[{id:'r_last',name:'分期',cents:'1',category:'餐飲',kind:'分期',start_month:'2026-02',periods:1,due_day:31,active:1,revision:0}];
  state.expenses=[{id:'e_last',source:'分期',recurring_id:'r_last',period:'2026-02',voided:1}];
  assert.equal(recurringSuggestions(state,'2026-02').items.length,0);
  state.incomes=[{id:'i_large',name:'歷史精確值',received_on:'2026-02-28',cents:'9223372036854775807',revision:0,voided:0}];
  assert.equal(incomeMonth(state,'2026-02').received,9223372036854775807n);
  assert.equal(incomeMonth(state,'2026-02','2026-02-27').received,0n);
});
test('suggestion boundaries use leap/short months and never leak into expense statistics',async()=>{
  const {recurringSuggestions}=await import('../web/income.mjs');
  const {monthBudget,searchExpenses}=await import('../web/browse.mjs');
  const state=initial();state.recurring_rules=[{id:'r_cross',name:'跨年',cents:'29',category:'餐飲',kind:'訂閱',start_month:'2023-12',periods:0,due_day:31,active:1,revision:0}];
  for(const [month,day] of [['2023-12','31'],['2024-02','29'],['2025-02','28'],['2024-04','30']])assert.equal(recurringSuggestions(state,month).items[0].due_on,month+'-'+day);
  const before=monthBudget(state,'2026-10-04');const changed=await change(state,'add','i_income',null,form());
  assert.deepEqual(monthBudget(changed,'2026-10-04'),before);
  assert.deepEqual(searchExpenses(changed,{keyword:'',start:'2026-10-01',end:''},'2026-10-04'),[]);
});
test('v2 encrypted backup retains exact bytes and rejects wrong passwords or ciphertext tampering',async()=>{
  const {encryptBackup,decryptBackup}=await import('../web/backup-crypto.mjs');
  const payload=writeBackup(bundle(await change(initial(),'add','i_one',null,form()))),password='synthetic-income-password';
  const one=await encryptBackup(payload,password),two=await encryptBackup(payload,password);
  assert.notDeepEqual(one,two);assert.deepEqual(await decryptBackup(one,password),payload);
  await assert.rejects(decryptBackup(one,'wrong-password'));one[one.length-1]^=1;await assert.rejects(decryptBackup(one,password));
});
