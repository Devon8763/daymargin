import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,writeBackup,readBackup} from '../web/backup.mjs';
import {portable} from '../web/idb.mjs';
import {monthBudget,searchExpenses,calendarMonth} from '../web/browse.mjs';
import {expenseCsv} from '../web/csv.mjs';
import {compareExpenses} from '../web/comparison.mjs';
const usage=await import('../web/usage.mjs').catch(()=>({}));
const form=(extra={})=>({started_on:'2024-02-28',days:7,remind:1,reminder_days:7,show_daily_cost:0,active:1,...extra});
const entry=(extra={})=>({id:'e_one',spent_on:'2024-02-28',cents:'10001',category:'餐飲',note:'合成商品',source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0,...extra});
const state=()=>({...emptyData(4),payment_sources:[{id:'p_cash',name:'現金',active:1}],expenses:[entry()]});
test('usage dates count the starting day and handle leap years and boundaries',()=>{
  assert.equal(typeof usage.usageInput,'function');
  for(const [started_on,days,end] of [['2024-02-28',1,'2024-02-28'],['2024-02-28',7,'2024-03-05'],['2023-12-31',180,'2024-06-27'],['0001-01-01',7,'0001-01-07'],['2024-12-31',2,'2025-01-01']]) {
    assert.equal(usage.usageEnd(usage.usageInput(form({started_on,days}))),end);
  }
  for(const bad of [form({days:0}),form({days:-1}),form({days:36501}),form({days:1.5}),form({days:'7'}),form({started_on:'2023-02-29'}),form({started_on:'9999-12-31',days:2}),form({reminder_days:-1}),form({reminder_days:36501}),form({remind:2}),form({active:2}),form({extra:'forged'})])assert.throws(()=>usage.usageInput(bad));
});
test('reminders distinguish not started, threshold, today, overdue, disabled and voided',()=>{
  assert.equal(typeof usage.endingSoon,'function');
  const s=state();s.usage_periods=[{expense_id:'e_one',...form({started_on:'2024-03-01',days:10,reminder_days:2}),revision:0}];
  const before=structuredClone(s);
  for(const today of ['2024-02-29','2024-03-07'])assert.deepEqual(usage.endingSoon(s,today),[]);
  assert.equal(usage.endingSoon(s,'2024-03-08')[0].text,'剩 2 天');
  assert.equal(usage.endingSoon(s,'2024-03-10')[0].text,'今天預計用完');
  assert.equal(usage.endingSoon(s,'2024-03-11')[0].text,'預計已用完');
  assert.deepEqual(s,before);
  for(const key of ['remind','active'])assert.deepEqual(usage.endingSoon({...s,usage_periods:[{...s.usage_periods[0],[key]:0}]},'2024-03-10'),[]);
  assert.deepEqual(usage.endingSoon({...s,expenses:[entry({voided:1})]},'2024-03-10'),[]);
  assert.equal(usage.endingSoon({...s,usage_periods:[{...s.usage_periods[0],reminder_days:0}]},'2024-03-09').length,0);
});
test('daily cost is exact rational display and tracking never changes expense statistics',()=>{
  assert.equal(typeof usage.dailyCost,'function');
  assert.equal(usage.dailyCost('10001',180),'0.5556');
  assert.equal(usage.dailyCost('1',36500),'<0.0001');
  assert.equal(usage.dailyCost('9223372036854775807',1),'92233720368547758.07');
  const s=state(),t={...s,usage_periods:[{expense_id:'e_one',...form({show_daily_cost:1}),revision:0}]};
  const stats=x=>[monthBudget(x,'2024-02-29'),searchExpenses(x,{start:'2024-02-01',end:'2024-02-29',keyword:''},'2024-02-29'),calendarMonth(x,'2024-02','2024-02-29'),expenseCsv(x,{start:'2024-02-01',end:'2024-02-29'},'2024-02-29'),compareExpenses(x,{a_start:'2024-02-01',a_end:'2024-02-29',b_start:'2024-02-01',b_end:'2024-02-29',category:'',keyword:''},'2024-02-29')];
  assert.deepEqual(stats(t),stats(s));
});
test('last installment counts voided periods as handled and excludes stopped or complete rules',()=>{
  assert.equal(typeof usage.endingSoon,'function');
  const s=state();s.recurring_rules=[{id:'r_one',name:'合成分期',cents:'100',category:'餐飲',kind:'分期',start_month:'2024-01',periods:2,due_day:31,active:1,revision:0}];
  s.expenses=[entry({source:'分期',recurring_id:'r_one',period:'2024-01',voided:1})];
  assert.equal(usage.endingSoon(s,'2024-02-01')[0].text,'剩 1 期');
  assert.equal(usage.endingSoon({...s,recurring_rules:[{...s.recurring_rules[0],active:0}]},'2024-02-01').length,0);
  s.expenses.push(entry({id:'e_two',source:'分期',recurring_id:'r_one',period:'2024-02'}));
  assert.deepEqual(usage.endingSoon(s,'2024-02-29'),[]);
});
test('v4 complete backup preserves tracking including voided history, rejects invalid references and fields',()=>{
  const s=state();s.usage_periods=[{expense_id:'e_one',...form(),revision:0}];
  assert.equal(portable(s).version,4);
  assert.deepEqual(readBackup(writeBackup(portable(s))),portable(s));
  for(const bad of [{expense_id:'missing'},{days:0},{revision:-1},{started_on:'invalid'},{show_daily_cost:3},{extra:1}]) {
    const changed=structuredClone(s);Object.assign(changed.usage_periods[0],bad);assert.throws(()=>writeBackup(portable(changed)));
  }
  assert.throws(()=>writeBackup(portable({...s,usage_periods:[s.usage_periods[0],s.usage_periods[0]]})));
  assert.equal(readBackup(writeBackup(portable({...s,expenses:[entry({voided:1})]}))).data.usage_periods.length,1);
  for(const version of [1,2,3])assert.equal(readBackup(writeBackup({format:'life-ledger-backup',version,data:emptyData(version)})).version,version);
  assert.throws(()=>writeBackup({format:'life-ledger-backup',version:3,data:s}));
});
test('same names remain separate and readonly suggestions never overwrite tracking',()=>{
  const s=state();s.expenses.push(entry({id:'e_two'}));
  s.usage_periods=[{expense_id:'e_one',...form({days:1}),revision:0},{expense_id:'e_two',...form({days:7}),revision:0}];
  assert.deepEqual(usage.endingSoon(s,'2024-02-28').map(row=>row.text),['今天預計用完','剩 6 天']);
  s.usage_periods[0].remind=0;
  assert.deepEqual(usage.endingSoon(s,'2024-02-28').map(row=>row.id),['e_two']);
  assert.equal(s.expenses.length,2);assert.equal(s.usage_periods[1].days,7);
});
