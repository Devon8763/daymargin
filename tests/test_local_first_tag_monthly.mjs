import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../web/comparison.mjs';
import {emptyData} from '../web/backup.mjs';
const entry=(id,date,value,extra={})=>({id,spent_on:date,cents:value,category:'餐飲',note:'合成消費',source:'manual',kind:'consumption',voided:0,payment_source_name:'現金',...extra});
const state=rows=>({...emptyData(5),expenses:rows,tags:[{id:'t_a',name:'旅行',hidden:1,revision:0},{id:'t_b',name:'聚餐',hidden:0,revision:0}],expense_tags:rows.map(row=>({expense_id:row.id,tag_id:'t_a'}))});
const query=(start='',end='')=>({tag_id:'t_a',start,end});
const analyze=(data,input,today='2024-06-30')=>core.analyzeTagMonths(data,input,today);

test('tag months preserve zero months and distinguish whole-range and spending-month averages',()=>{
  assert.equal(typeof core.analyzeTagMonths,'function');
  const data=state([entry('a','2024-01-01','100'),entry('b','2024-02-01','200'),entry('c','2024-03-01','300'),entry('d','2024-04-01','400'),entry('f','2024-06-01','500')]),before=structuredClone(data);
  const result=analyze(data,query('2024-01-01','2024-06-30'));
  assert.deepEqual(result.periods.map(row=>row.total_cents),[100n,200n,300n,400n,0n,500n]);
  assert.equal(result.total,1500n);assert.equal(result.total_cents,1500n);assert.equal(result.started_count,6);assert.equal(result.consumed_count,5);
  assert.deepEqual(result.all_average,{numerator:1500n,denominator:6n});assert.deepEqual(result.consumed_average,{numerator:1500n,denominator:5n});
  assert.equal(result.highest_cents,500n);assert.equal(result.lowest_cents,0n);assert.deepEqual(data,before);
});
test('arbitrary cross-year and leap-month ranges retain exact partial date boundaries',()=>{
  const data=state([entry('excluded','2023-12-01','500'),entry('a','2023-12-20','10'),entry('b','2024-02-29','20'),entry('after','2024-03-01','600')]);
  const result=analyze(data,query('2023-12-20','2024-02-29'));
  assert.deepEqual(result.periods.map(row=>row.month),['2023-12','2024-01','2024-02']);assert.equal(result.total_cents,30n);
  assert.equal(result.periods[0].start,'2023-12-20');assert.equal(result.periods[2].end,'2024-02-29');
  assert.deepEqual(result.rows.map(row=>row.id),['b','a']);
});
test('all-time starts at first tagged consumption; an empty tag invents no averaging window',()=>{
  const result=analyze(state([entry('a','2023-12-20','1')]),query(),'2024-02-10');
  assert.equal(result.start,'2023-12-01');assert.equal(result.started_count,3);assert.equal(result.consumed_count,1);assert.equal(result.periods[2].actual_end,'2024-02-10');
  const empty=analyze(state([]),query());assert.deepEqual(empty.periods,[]);assert.equal(empty.total,0n);assert.equal(empty.all_average,null);
  const zero=analyze(state([]),query('2024-04-01','2024-06-30'));assert.equal(zero.started_count,3);assert.equal(zero.lowest_cents,0n);assert.equal(zero.all_average.numerator,0n);assert.equal(zero.consumed_average,null);
});
test('unstarted months and a future start within the current month never become zero-spending months',()=>{
  const data=state([entry('today','2024-06-15','1'),entry('tomorrow','2024-06-16','99')]);
  const result=analyze(data,query('2024-06-01','2024-08-31'),'2024-06-15');
  assert.deepEqual(result.periods.map(row=>row.total_cents),[1n,null,null]);assert.equal(result.started_count,1);assert.equal(result.periods[0].actual_end,'2024-06-15');
  const future=analyze(data,query('2024-06-20','2024-08-31'),'2024-06-15');assert.equal(future.started_count,0);assert.equal(future.total_cents,null);assert.equal(future.all_average,null);
});
test('one tag counts all four posted sources once and excludes other tags, voided and non-consumption',()=>{
  const data=state(['manual','固定','訂閱','分期'].map((source,i)=>entry('e'+i,'2024-03-01',String(i+1),{source})));
  data.expenses.push(entry('other','2024-03-01','100'),entry('void','2024-03-01','100',{voided:1}),entry('income','2024-03-01','100',{kind:'income'}));
  data.expense_tags.push({expense_id:'void',tag_id:'t_a'},{expense_id:'income',tag_id:'t_a'},{expense_id:'e0',tag_id:'t_b'});
  const result=analyze(data,query('2024-03-01','2024-03-31'));assert.equal(result.total_cents,10n);assert.equal(result.periods[0].rows.length,4);
});
test('complete large-cent statistics remain precise beyond fifty rows and chart precision',()=>{
  const data=state(Array.from({length:65},(_,i)=>entry('e'+i,'2024-03-01','9223372036854775807')));
  const result=analyze(data,query('2024-03-01','2024-03-31'));assert.equal(result.total_cents,599519182395560427455n);assert.equal(result.rows.length,65);assert.equal(result.plottable,false);
});
test('removed identities and invalid dates reject; edits and soft voids appear in a fresh readonly result',()=>{
  const data=state([entry('a','2024-03-01','100')]);
  for(const input of [query('2024-02-30'),query('2024-04-01','2024-03-01'),{...query(),tag_id:'missing'},{...query(),user_id:'other'}])assert.throws(()=>analyze(data,input));
  assert.equal(analyze(data,query()).total_cents,100n);data.expenses[0].cents='29';assert.equal(analyze(data,query()).total_cents,29n);data.expenses[0].voided=1;
  assert.equal(analyze(data,query('2024-03-01','2024-03-31')).total_cents,0n);
});
