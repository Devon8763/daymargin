import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../local-first/comparison.mjs';
const row=(date,cents='29',extra={})=>({id:crypto.randomUUID(),spent_on:date,cents,category:'餐飲',note:'Lunch [x]',source:'manual',kind:'consumption',voided:0,...extra});
const state=expenses=>({expenses,categories:[{name:'停用',active:0}]});
const group=(ranges,name='組一')=>({name,ranges:ranges.map(([start,end=start])=>({start,end}))});
const input=(groups,extra={})=>({unit:'month',groups,categories:[],keyword:'',...extra});
test('noncontiguous months, arbitrary groups and duplicate ranges count each booked expense once per group',()=>{
  assert.equal(typeof core.analyzeExpenses,'function');
  const result=core.analyzeExpenses(state([row('2024-03-01','29'),row('2024-06-30','31')]),input([group([['2024-03-01'],['2024-06-01'],['2024-03-15']]),group([['2024-03-01']],'組二'),group([['2024-01-01','2024-06-01']],'組三')]),'2024-07-01');
  assert.equal(result.groups.length,3);assert.deepEqual(result.groups[0].periods.map(p=>p.start),['2024-03-01','2024-06-01']);
  assert.equal(result.groups[0].total_cents,60n);assert.equal(result.groups[0].selected_count,2);assert.equal(result.groups[0].overlap,true);assert.equal(result.cross_overlap,true);
  assert.equal(result.groups[0].periods[0].cross_overlap,true);
});
test('Monday weeks and leap/cross-year full periods align independently of timezone',()=>{
  assert.equal(typeof core.analysisPeriods,'function');
  assert.deepEqual(core.analysisPeriods('week','2023-12-31','2024-01-01'),[{start:'2023-12-25',end:'2023-12-31'},{start:'2024-01-01',end:'2024-01-07'}]);
  assert.deepEqual(core.analysisPeriods('month','2024-02-29','2024-03-01'),[{start:'2024-02-01',end:'2024-02-29'},{start:'2024-03-01',end:'2024-03-31'}]);
  assert.deepEqual(core.analysisPeriods('year','2023-12-31','2024-01-01'),[{start:'2023-01-01',end:'2023-12-31'},{start:'2024-01-01',end:'2024-12-31'}]);
});
test('zero and unfinished started periods enter only the correctly named exact averages; future never becomes zero',()=>{
  assert.equal(typeof core.analyzeExpenses,'function');
  const r=core.analyzeExpenses(state([row('2024-03-15','101')]),input([group([['2024-02-01','2024-04-01']]),group([['2025-01-01']])]),'2024-03-20');
  const a=r.groups[0];assert.deepEqual(a.periods.map(p=>p.total_cents),[0n,101n,null]);assert.equal(a.periods[1].unfinished,true);
  assert.equal(a.selected_count,3);assert.equal(a.started_count,2);assert.equal(a.consumed_count,1);assert.equal(a.highest_cents,101n);assert.equal(a.lowest_cents,0n);
  assert.deepEqual(a.all_average,{numerator:101n,denominator:2n});assert.deepEqual(a.consumed_average,{numerator:101n,denominator:1n});assert.equal(r.groups[1].total_cents,null);assert.equal(r.groups[1].all_average,null);
});
test('all four sources, multiple and inactive historical categories, literal keyword and complete rows share one readonly snapshot',()=>{
  assert.equal(typeof core.analyzeExpenses,'function');
  const data=state([...Array.from({length:65},()=>row('2024-02-29','1')),...['固定','訂閱','分期'].map(source=>row('2024-02-29','2',{source,category:'停用'})),row('2024-02-29','9',{voided:1}),row('2024-02-29','9',{kind:'income'}),row('2024-03-01','9'),row('2024-02-29','9',{source:'prediction'}),row('2024-02-29','9',{note:'Other'})]);
  const before=structuredClone(data),r=core.analyzeExpenses(data,input([group([['2024-02-01']])],{categories:['餐飲','停用'],keyword:'lunch [x]'}),'2024-02-29');
  assert.equal(r.groups[0].total_cents,71n);assert.equal(r.groups[0].periods[0].rows.length,68);assert.equal(r.groups[0].periods[0].categories.get('停用'),6n);assert.deepEqual(data,before);
});
test('precise huge cents stay BigInt and chart guard does not discard text data',()=>{
  assert.equal(typeof core.analyzeExpenses,'function');
  const r=core.analyzeExpenses(state([row('2024-02-01','9223372036854775807')]),input([group([['2024-02-01']])]),'2024-02-29');
  assert.equal(r.groups[0].total_cents,9223372036854775807n);assert.equal(r.plottable,false);
});
test('invalid dates, mixed units, unknown categories and identity injection fail before analysis',()=>{
  assert.equal(typeof core.analyzeExpenses,'function');
  for(const q of [input([group([['2024-02-30']])]),input([group([['2024-03-01','2024-01-01']])]),input([]),input([group([['2024-02-01']])],{unit:'day'}),input([group([['2024-02-01']])],{user_id:'other'}),input([group([['2024-02-01']])],{categories:['other']}),input([group([['2024-02-01']])],{keyword:'😀'.repeat(201)})])assert.throws(()=>core.analyzeExpenses(state([]),q,'2024-02-29'));
});
