import test from 'node:test';
import assert from 'node:assert/strict';
import * as ledger from '../local-first/ledger.mjs';
import {emptyData,writeBackup,MAX_INTEGER} from '../local-first/backup.mjs';
import {portable} from '../local-first/idb.mjs';
import {scheduleItems,scheduleMonth,scheduleRules} from '../local-first/schedule.mjs';
import {recurringSuggestions} from '../local-first/income.mjs';
import {endingSoon} from '../local-first/usage.mjs';
const today='2026-10-07',blank=()=>({...emptyData(6),payment_sources:[{id:'p_cash',name:'現金',active:1},{id:'p_none',name:'未指定',active:1}]}),form=(extra={})=>({kind:'固定',name:'合成定期',amount:'100.01',category:'餐飲',payment_source_id:'p_cash',first_due_on:'2026-09-01',unit:'day',every:15,periods:0,...extra});
const change=(state,op='add',id='r_one',expected=null,input=form(),date=today)=>ledger.changeSchedule(state,op,id,expected,input,date);
const process=(state,op,index=0,rev=null,input=null,date=today)=>ledger.changeScheduledPeriod(state,op,'r_one',index,state.recurring_rules[0]?.revision??state.annual_rules[0].revision,rev,input,date);
test('new interval rule only plans; record/skip/resume guard due date and create one atomic consumption',()=>{
  assert.equal(typeof ledger.changeSchedule,'function');let state=change(blank());const before=structuredClone(state);assert.equal(state.expenses.length,0);scheduleItems(state,today);assert.deepEqual(state,before);
  assert.throws(()=>process(state,'record',3));state=process(state,'record',0);assert.equal(state.expenses.length,1);assert.equal(state.actions.length,1);assert.equal(state.expenses[0].source,'固定');assert.equal(state.expenses[0].period,'2026-09');assert.throws(()=>process(state,'record',0,0));
  state=process(state,'skip',1);assert.equal(state.scheduled_periods.find(row=>row.index===1).status,'skipped');state=process(state,'resume',1,0);assert.equal(state.scheduled_periods.find(row=>row.index===1).status,'pending');assert.throws(()=>process(state,'record',1,0));state=process(state,'record',1,1);assert.equal(state.expenses.length,2);
});
test('actual date/amount are separate from due month; void never becomes pending or recreates',()=>{
  let state=change(blank(), 'add','r_one',null,form({first_due_on:'2026-09-30',unit:'month'}));state=process(state,'record',0,null,{spent_on:today,amount:'.29',note:'合成實付',category:'餐飲',payment_source_id:'p_cash'});
  assert.equal(state.expenses[0].spent_on,today);assert.equal(state.expenses[0].period,'2026-09');assert.equal(scheduleMonth(state,'2026-09',today).total,29n);state.expenses[0].voided=1;state.expenses[0].revision=1;assert.equal(scheduleMonth(state,'2026-09',today).total,0n);assert.throws(()=>process(state,'record',0,0));assert.equal(scheduleItems(state,today).items.find(row=>row.index===0).status,'recorded');assert.doesNotThrow(()=>writeBackup(portable(state)));
});
test('change/disable freeze due and saved periods without posting; future cadence replaces same cutover version',()=>{
  let state=change(blank()),original=structuredClone(state);state=change(state,'update','r_one',0,form({amount:'.31',first_due_on:'2026-10-08',unit:'week',every:2}));
  assert.equal(state.expenses.length,0);assert.equal(state.scheduled_periods.length,3);assert.equal(state.scheduled_periods[0].defaults.cents,'10001');assert.equal(scheduleRules(state,today)[0].edit_due_on,'2026-10-08');
  state=change(state,'update','r_one',1,form({amount:'.37',first_due_on:'2026-10-09',unit:'month'}));assert.equal(state.recurring_versions.length,2);assert.equal(state.recurring_versions[1].cents,'37');assert.deepEqual(original.expenses,[]);assert.throws(()=>change(state,'update','r_one',0,form()));
  state=change(state,'disable','r_one',2,null);assert.equal(state.expenses.length,0);assert.equal(state.recurring_rules[0].active,0);state=process(state,'skip',0,0);state=process(state,'resume',0,1);state=process(state,'record',0,2);assert.equal(state.expenses.length,1);assert.throws(()=>process(state,'record',3));
});
test('legacy monthly/annual IDs, null-day, versions and histories remain unchanged after new actions',()=>{
  let state=blank();state.recurring_rules=[{id:'r_one',name:'舊月付',cents:'29',category:'餐飲',kind:'訂閱',start_month:'2026-09',periods:0,due_day:null,active:1,revision:0}];
  state.recurring_versions=[{id:'v_old',recurring_id:'r_one',effective_month:'2026-10',name:'舊月付',cents:'31',category:'餐飲',due_day:1}];const root=structuredClone(state.recurring_rules[0]);state=process(state,'record',0);assert.equal(state.expenses[0].spent_on,'2026-09-01');assert.equal(state.expenses[0].source,'訂閱');assert.deepEqual(state.recurring_rules[0],root);assert.equal(state.recurring_versions[0].id,'v_old');
  let annual=change(blank(),'add','r_one',null,form({kind:'年度費用',unit:'year',first_due_on:'2024-02-29'}));annual=process(annual,'skip',0);annual=process(annual,'resume',0,0);annual=process(annual,'record',0,1);assert.equal(annual.expenses[0].source,'manual');assert.equal(annual.expenses[0].recurring_id,null);assert.throws(()=>ledger.shortcutDraft(annual,annual.expenses[0].id,0,today));
});
test('immutable identity, malformed/extreme fields, inactive defaults and capacity fail without mutating input',()=>{
  for(const fields of [{every:0},{every:true},{every:Number.MAX_SAFE_INTEGER},{first_due_on:'2026-02-29'},{unit:'bad'},{periods:1},{amount:'0'},{kind:'分期',periods:601}])assert.throws(()=>change(blank(),'add','r_one',null,form(fields)));
  let state=change(blank(),'add','r_one',null,form({kind:'分期',periods:1}));assert.throws(()=>change(state,'update','r_one',0,form({kind:'固定'})));assert.throws(()=>change(state,'update','r_one',0,form({kind:'分期',periods:2,first_due_on:'2026-10-08'})));
  state.recurring_rules[0].revision=MAX_INTEGER;const before=structuredClone(state);assert.throws(()=>change(state,'disable','r_one',MAX_INTEGER,null));assert.deepEqual(state,before);
  const cap=blank();cap.categories=Array.from({length:99998},(_,i)=>({name:'c'+i,active:0}));const saved=structuredClone(cap);assert.throws(()=>change(cap));assert.deepEqual(cap,saved);
});
test('category rename updates frozen schedule/legacy annual defaults and future versions atomically',()=>{
  let state=blank();state.annual_rules=[{id:'r_one',name:'舊年度',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金',first_year:2026,due_month:10,due_day:5,effective_month:'2026-10',active:1,revision:0}];
  state.annual_periods=[{annual_id:'r_one',year:2026,defaults:{due_on:'2026-10-05',name:'舊年度',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金'},status:'pending',expense_id:null,revision:0}];
  state=process(state,'record',0,0);state=ledger.changeCategory(state,'rename','餐飲','餐食');assert.equal(state.scheduled_periods[0].defaults.category,'餐食');assert.equal(state.annual_periods[0].defaults.category,'餐食');assert.equal(state.expenses[0].category,'餐食');
});
test('daily income suggestion groups all periods by original rule and installment reminder counts distinct periods including skips',()=>{
  let state=change(blank(),'add','r_one',null,form({first_due_on:'2026-10-01',amount:'.29'}));assert.equal(recurringSuggestions(state,'2026-10').total,87n);
  state=change(blank(),'add','r_one',null,form({first_due_on:'2026-10-01',every:1,kind:'分期',periods:3}));state=process(state,'record',0);state=process(state,'skip',1);assert.equal(endingSoon(state,today).find(row=>row.kind==='installment').text,'剩 1 期');state=process(state,'record',2);assert.equal(endingSoon(state,today).filter(row=>row.kind==='installment').length,0);
});
