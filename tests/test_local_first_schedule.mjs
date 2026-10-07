import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDue,scheduleItems,scheduleMonth,scheduleRules,scheduleReserve} from '../local-first/schedule.mjs';
import {emptyData} from '../local-first/backup.mjs';

const sample=()=>({...emptyData(6),payment_sources:[{id:'p_cash',name:'現金',active:1},{id:'p_none',name:'未指定',active:1}],
  recurring_rules:[{id:'r_month',name:'合成月付',cents:'10001',category:'餐飲',kind:'固定',start_month:'2026-09',periods:0,due_day:7,active:1,revision:0}],
  annual_rules:[{id:'y_year',name:'合成年度',cents:'32900',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'歷史現金',first_year:2026,due_month:10,due_day:5,effective_month:'2026-10',active:1,revision:0}]});

test('daily and weekly intervals advance exact days from the original anchor',()=>{
  assert.deepEqual([0,1,2,3].map(index=>scheduleDue('2026-12-23','day',15,index)),['2026-12-23','2027-01-07','2027-01-22','2027-02-06']);
  assert.deepEqual([0,1,2].map(index=>scheduleDue('2028-02-20','week',2,index)),['2028-02-20','2028-03-05','2028-03-19']);
});
test('calendar intervals always retain the original month day and leap anchor',()=>{
  assert.deepEqual([0,1,2,3].map(index=>scheduleDue('2028-01-31','month',1,index)),['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);
  assert.equal(scheduleDue('2027-12-31','month',2,1),'2028-02-29');
  assert.deepEqual([0,1,2,4].map(index=>scheduleDue('2024-02-29','year',1,index)),['2024-02-29','2025-02-28','2026-02-28','2028-02-29']);
  assert.equal(scheduleDue('1896-02-29','year',4,1),'1900-02-28');
  assert.equal(scheduleDue('1996-02-29','year',4,1),'2000-02-29');
});
test('invalid dates and extreme arithmetic fail instead of rolling or rounding',()=>{
  for(const args of [['2026-02-29','day',1,0],['0000-01-01','day',1,0],['2026-01-01','other',1,0],['2026-01-01','day',0,1],['2026-01-01','day',1,-1],['2026-01-01','day',1.5,1],['2026-01-01','day',true,1],['2026-01-01','day',Number.MAX_SAFE_INTEGER,1],['9999-12-31','day',1,1],['9999-12-31','month',1,1],['9999-12-31','year',1,1]])assert.throws(()=>scheduleDue(...args));
  assert.equal(scheduleDue('0001-01-01','day',1,0),'0001-01-01');
});
test('one readonly period view combines monthly and annual backlog, upcoming and stored histories',()=>{
  const state=sample(),before=structuredClone(state),items=scheduleItems(state,'2026-10-10').items;
  assert.equal(items.find(row=>row.rule_id==='r_month'&&row.index===0).status,'pending');
  assert.equal(items.find(row=>row.rule_id==='r_month'&&row.index===2).status,'upcoming');
  assert.equal(items.find(row=>row.rule_id==='y_year'&&row.index===0).defaults.payment_source_name,'歷史現金');
  assert.equal(scheduleMonth(state,'2026-10','2026-10-10').total,42901n);assert.deepEqual(state,before);
  state.recurring_rules[0].active=0;state.scheduled_periods.push({rule_id:'r_month',index:0,defaults:{due_on:'2026-09-07',name:'已形成合成',cents:'101',category:'餐飲',payment_source_id:null,payment_source_name:'未指定'},status:'skipped',expense_id:null,revision:2});
  assert.equal(scheduleItems(state,'2026-10-10').items.find(row=>row.rule_id==='r_month').status,'skipped');
  assert.equal(scheduleMonth(state,'2026-10','2026-10-10').total,32900n);
});
test('due-month planning uses actual recorded cents across months, excludes void/skip and never rewrites allocations',()=>{
  const state=sample();state.expenses=[{id:'e_actual',spent_on:'2026-11-02',cents:'1029',category:'餐飲',note:'實付',source:'固定',recurring_id:'r_month',period:'2026-10',kind:'consumption',voided:0,revision:1}];
  state.scheduled_periods=[{rule_id:'r_month',index:1,defaults:{due_on:'2026-10-07',name:'合成月付',cents:'10001',category:'餐飲',payment_source_id:null,payment_source_name:'未指定'},status:'recorded',expense_id:'e_actual',revision:0}];
  state.annual_periods=[{annual_id:'y_year',year:2026,defaults:{due_on:'2026-10-05',name:'合成年度',cents:'32900',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'歷史現金'},status:'skipped',expense_id:null,revision:1}];
  const before=structuredClone(state);assert.equal(scheduleMonth(state,'2026-10','2026-11-10').total,1029n);assert.equal(scheduleMonth(state,'2026-11','2026-11-10').total,10001n);assert.deepEqual(state,before);
  state.expenses[0].voided=1;assert.equal(scheduleMonth(state,'2026-10','2026-11-10').total,0n);assert.equal(scheduleItems(state,'2026-11-10').items.find(row=>row.rule_id==='r_month'&&row.index===1).status,'recorded');
});
test('generic daily versions keep same-month periods distinct and annual reference remains separate',()=>{
  const state=sample();state.recurring_versions=[{id:'v_days',recurring_id:'r_month',from_index:0,first_due_on:'2026-10-01',unit:'day',every:15,name:'日付',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金'}];
  const items=scheduleMonth(state,'2026-10','2026-10-10').items.filter(row=>row.rule_id==='r_month');assert.deepEqual(items.map(row=>row.defaults.due_on),['2026-10-01','2026-10-16','2026-10-31']);
  assert.equal(scheduleMonth(state,'2026-10','2026-10-10').total,32987n);assert.equal(scheduleRules(state,'2026-10-10').find(row=>row.id==='r_month').edit_due_on,'2026-10-16');
  assert.equal(scheduleReserve(state,'2026-10','2026-10-10').total,2742n);assert.equal(scheduleReserve(state,'2026-09','2026-10-10').total,0n);
});
test('legacy next period remains readable before a later generic version starts',()=>{
  const state=sample();state.recurring_versions=[{id:'v_later',recurring_id:'r_month',from_index:3,first_due_on:'2026-12-07',unit:'week',every:2,name:'未來週付',cents:'31',category:'交通',payment_source_id:'p_cash',payment_source_name:'現金'}];
  const row=scheduleRules(state,'2026-10-01').find(row=>row.id==='r_month');assert.equal(row.edit_due_on,'2026-10-07');assert.equal(row.cents,'10001');
});
test('an annual rule with no supported remaining due date leaves readonly summaries usable',()=>{
  const state=sample();state.annual_rules[0]={...state.annual_rules[0],first_year:9999,due_month:1,effective_month:'9999-12'};
  assert.equal(scheduleMonth(state,'2026-10','2026-10-10').total,10001n);
  assert.equal(scheduleMonth(state,'9999-12','9999-12-01').items.some(row=>row.rule_id==='y_year'),false);
  assert.equal(scheduleItems(state,'2026-10-10').items.some(row=>row.rule_id==='y_year'),false);
  assert.equal(scheduleRules(state,'2026-10-10').find(row=>row.id==='y_year').next_due_on,null);
});
