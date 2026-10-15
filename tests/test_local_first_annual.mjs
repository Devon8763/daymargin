import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,readBackup,writeBackup,BackupError} from '../web/backup.mjs';
import {portable} from '../web/idb.mjs';
import {readFile} from 'node:fs/promises';
const state=()=>({format:'local-first-test-ledger',version:4,owner:'local-test-owner',...emptyData(3),payment_sources:[{id:'p_cash',name:'現金',active:1}]});
const form=(extra={})=>({name:'合成保險',amount:'1200.01',category:'餐飲',payment_source_id:'p_cash',first_year:2026,due_month:5,due_day:31,...extra});
const change=async(s,op,id,revision,value,today='2026-04-30')=>(await import('../web/ledger.mjs')).changeAnnual(s,op,id,revision,value,today);
test('annual input, short months and reference cents stay exact; no allocation writes',async()=>{
  const {annualInput,annualReserve}=await import('../web/annual.mjs');
  const s=state(),before=structuredClone(s),input=annualInput(form(),s,'2026-04-30');
  assert.equal(input.cents,'120001');
  assert.equal(annualReserve({...s,annual_rules:[{id:'y_one',...input,active:1,revision:0}]},'2026-04','2026-04-30').total,10001n);
  assert.deepEqual(s,before);
  for(const bad of [form({amount:'0'}),form({amount:'1000000001'}),form({due_day:32}),form({due_month:0}),form({first_year:0}),form({payment_source_id:'missing'}),form({category:'missing'}),form({name:''}),form({active:0})])assert.throws(()=>annualInput(bad,s,'2026-04-30'));
});
test('readonly annual periods appear from due month, persist over years and exclude unconfirmed spending',async()=>{
  const {annualItems,annualReserve}=await import('../web/annual.mjs');
  const {monthBudget,searchExpenses,calendarMonth}=await import('../web/browse.mjs');
  const {expenseCsv}=await import('../web/csv.mjs');
  const {compareExpenses}=await import('../web/comparison.mjs');
  const s=await change(state(),'add','y_one',null,form({first_year:2024,due_month:2,due_day:31}),'2024-01-01'),before=structuredClone(s);
  assert.equal(annualItems(s,'2024-01-31').items.length,0);
  assert.equal(annualItems(s,'2024-02-01').items[0].due_on,'2024-02-29');
  assert.deepEqual(annualItems(s,'2025-03-01').items.map(x=>x.due_on),['2024-02-29','2025-02-28']);
  assert.equal(annualReserve(s,'2024-01','2025-03-01').items.length,0);
  assert.equal(monthBudget(s,'2025-03-01').spent,0n);
  assert.equal(searchExpenses(s,{start:'2024-01-01',end:'2025-03-01',keyword:''},'2025-03-01').length,0);
  assert.equal(calendarMonth(s,'2025-03','2025-03-01').days.reduce((sum,row)=>sum+row.total,0n),0n);
  assert.equal(expenseCsv(s,{start:'2024-01-01',end:'2025-03-01'},'2025-03-01').count,0);
  assert.equal(compareExpenses(s,{a_start:'2024-01-01',a_end:'2025-03-01',b_start:'2024-01-01',b_end:'2025-03-01',category:'',keyword:''},'2025-03-01').a.record_count,0);
  assert.deepEqual(s,before);
});
test('changes freeze open periods; disabling preserves pending but opens no future period',async()=>{
  const {annualItems}=await import('../web/annual.mjs');
  let s=await change(state(),'add','y_one',null,form(),'2026-04-30');
  s=await change(s,'update','y_one',0,form({amount:'2400',due_month:4}),'2026-05-01');
  assert.equal(annualItems(s,'2026-08-01').items[0].defaults.cents,'120001');
  assert.equal(annualItems(s,'2027-04-01').items[1].defaults.cents,'240000');
  s=await change(s,'disable','y_one',1,null,'2026-08-01');
  assert.equal(annualItems(s,'2027-05-01').items.length,1);assert.equal(s.annual_rules[0].active,0);
  await assert.rejects(change(s,'update','y_one',2,form()));
});
test('confirmed or skipped year stays handled after expense edit/void; exact edited draft creates one action',async()=>{
  const {annualItems}=await import('../web/annual.mjs');
  const {changeAnnualPeriod}=await import('../web/ledger.mjs');
  let s=await change(state(),'add','y_one',null,form(),'2026-05-01');
  const draft={spent_on:'2026-05-01',amount:'.29',note:'實付保險',category:'餐飲',payment_source_id:'p_cash'};
  s=changeAnnualPeriod(s,'record','y_one',2026,0,null,draft,'2026-05-01');
  assert.equal(s.expenses.length,1);assert.equal(s.expenses[0].cents,'29');assert.equal(s.actions[0].before,null);
  assert.equal(s.annual_periods[0].expense_id,s.expenses[0].id);
  assert.equal(annualItems(s,'2026-06-01').items[0].status,'recorded');
  assert.throws(()=>changeAnnualPeriod(s,'record','y_one',2026,0,null,draft,'2026-06-01'));
  s.expenses[0].voided=1;s.expenses[0].revision=1;
  assert.equal(annualItems(s,'2026-06-01').items[0].status,'recorded');
  s=changeAnnualPeriod(s,'skip','y_one',2027,0,null,null,'2027-05-01');
  assert.equal(annualItems(s,'2027-05-01').items.at(-1).status,'skipped');
  assert.equal(annualItems(s,'2028-05-01').items.at(-1).status,'pending');
});
test('v3 backup keeps all fifteen sections, references and history; older formats stay readable',async()=>{
  const {changeAnnualPeriod}=await import('../web/ledger.mjs');
  let s=await change(state(),'add','y_one',null,form(),'2026-05-01');
  s=changeAnnualPeriod(s,'skip','y_one',2026,0,null,null,'2026-05-01');
  const payload=writeBackup(portable(s)),bundle=readBackup(payload);assert.equal(bundle.version,3);assert.equal(Object.keys(bundle.data).length,15);
  for(const version of [1,2])assert.equal(readBackup(writeBackup({format:'life-ledger-backup',version,data:emptyData(version)})).version,version);
  for(const mutate of [b=>b.data.annual_rules.push({...b.data.annual_rules[0]}),b=>b.data.annual_periods[0].annual_id='missing',b=>b.data.annual_periods[0].expense_id='missing',b=>b.data.annual_rules[0].due_day=32,b=>b.data.annual_periods[0].status='paid',b=>b.version=4]){const bad=structuredClone(bundle);mutate(bad);assert.throws(()=>writeBackup(bad),BackupError);}
});
test('category rename updates annual defaults and pending references with conflicts; inactive defaults cannot record',async()=>{
  const {changeCategory,changeAnnualPeriod}=await import('../web/ledger.mjs');
  let s=await change(state(),'add','y_one',null,form(),'2026-05-01');
  s=await change(s,'update','y_one',0,form(),'2026-05-01');
  s=changeCategory(s,'rename','餐飲','新餐飲');
  assert.equal(s.annual_rules[0].category,'新餐飲');assert.equal(s.annual_periods[0].defaults.category,'新餐飲');
  assert.equal(s.annual_rules[0].revision,2);assert.equal(s.annual_periods[0].revision,1);
  s=changeCategory(s,'disable','新餐飲');const before=structuredClone(s);
  assert.throws(()=>changeAnnualPeriod(s,'record','y_one',2026,2,1,{spent_on:'2026-05-01',amount:'1',note:'合成',category:'新餐飲',payment_source_id:'p_cash'},'2026-05-01'));
  assert.deepEqual(s,before);
});
test('stale revisions, invalid data and capacity refusal do not mutate original state',async()=>{
  const {changeAnnualPeriod}=await import('../web/ledger.mjs');
  let s=await change(state(),'add','y_one',null,form(),'2026-05-01');const before=structuredClone(s);
  assert.throws(()=>changeAnnualPeriod(s,'skip','y_one',2026,1,null,null,'2026-05-01'));
  await assert.rejects(change(s,'update','y_one',1,form()));assert.deepEqual(s,before);
  const full={...s,incomes:Array.from({length:99998},(_,i)=>({id:'i_'+i,received_on:'2026-05-01',cents:'1',name:'合成',voided:0,revision:0}))};
  assert.throws(()=>changeAnnualPeriod(full,'record','y_one',2026,0,null,{spent_on:'2026-05-01',amount:'1',note:'合成',category:'餐飲',payment_source_id:'p_cash'},'2026-05-01'));
  assert.equal(full.expenses.length,0);assert.equal(full.annual_periods.length,0);
});
test('optional annual entry and offline allowlists include the new flow without replacing expense form',async()=>{
  const root=new URL('../',import.meta.url),html=await readFile(new URL('web/index.html',root),'utf8');
  assert.match(html,/id="fixed-settings"/);assert.match(html,/<option value="年度費用">/);assert.match(html,/id="schedule-periods"/);assert.doesNotMatch(html,/id="annual-management"|id="annual-entry"|id="sync-fixed"/);
  assert.equal((html.match(/id="expense-form"/g)||[]).length,1);
  for(const file of ['web/sw.js','web/serve.mjs','tests/local_first_preview.mjs']){const source=await readFile(new URL(file,root),'utf8');assert.match(source,/annual\.mjs/);assert.match(source,/schedule\.mjs/);}
});
test('moving due month never creates a retroactive new year; repeated changes keep opened snapshot',async()=>{
  const {annualItems}=await import('../web/annual.mjs');
  let s=await change(state(),'add','y_one',null,form({due_month:12}),'2026-05-01');
  s=await change(s,'update','y_one',0,form({due_month:4}),'2026-05-01');
  assert.equal(annualItems(s,'2026-05-31').items.length,0);assert.equal(annualItems(s,'2027-04-01').items[0].year,2027);
  s=await change(s,'update','y_one',1,form({amount:'2'}),'2027-04-01');
  s=await change(s,'update','y_one',2,form({amount:'3'}),'2027-04-02');
  assert.equal(s.annual_periods.length,1);assert.equal(s.annual_periods[0].defaults.cents,'120001');
  assert.equal(annualItems(s,'2028-05-01').items.at(-1).defaults.cents,'300');
});
test('inactive payment snapshots remain drafts; extreme imported reserve and malicious references are exact',async()=>{
  const {annualReserve,annualItems}=await import('../web/annual.mjs');
  const {changeAnnualPeriod,changePayment}=await import('../web/ledger.mjs');
  let s=state();s.payment_sources.push({id:'p_old',name:'合成付款',active:1});
  s=await change(s,'add','y_one',null,form({payment_source_id:'p_old'}),'2026-05-01');
  s=changePayment(s,'rename','p_old','合成新名');assert.equal(annualItems(s,'2026-05-01').items[0].defaults.payment_source_name,'合成付款');
  s=changePayment(s,'disable','p_old');
  assert.throws(()=>changeAnnualPeriod(s,'record','y_one',2026,0,null,{spent_on:'2026-05-01',amount:'1',note:'合成',category:'餐飲',payment_source_id:'p_old'},'2026-05-01'));
  s.annual_rules[0].cents='9223372036854775807';assert.equal(annualReserve(s,'2026-05','2026-05-01').total,768614336404564651n);
  const bundle=portable(s);
  for(const mutate of [b=>b.data.annual_rules[0].payment_source_id='missing',b=>b.data.annual_rules[0].cents='0',b=>b.data.annual_rules[0].revision=9223372036854775808n,b=>b.data.annual_rules[0].effective_month='2026-99',b=>b.data.annual_periods.push({annual_id:'y_one',year:2025,defaults:{name:'合成',cents:'1',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金',due_on:'2026-05-01'},status:'pending',expense_id:null,revision:0})]) {
    const bad=structuredClone(bundle);mutate(bad);assert.throws(()=>writeBackup(bad),BackupError);
  }
});
test('imported future pending snapshots cannot bypass due-month boundary',async()=>{
  const {annualDefaults,annualItems}=await import('../web/annual.mjs');
  const {changeAnnualPeriod}=await import('../web/ledger.mjs');
  const s=await change(state(),'add','y_one',null,form(),'2026-04-01');
  s.annual_periods.push({annual_id:'y_one',year:2027,defaults:annualDefaults(s.annual_rules[0],2027),status:'pending',expense_id:null,revision:0});
  assert.equal(annualItems(s,'2026-04-01').items.length,0);
  assert.throws(()=>changeAnnualPeriod(s,'skip','y_one',2027,0,0,null,'2026-04-01'));
  assert.equal(annualItems(s,'2027-05-01').items.length,2);
});
