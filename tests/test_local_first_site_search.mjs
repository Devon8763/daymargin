import test from 'node:test';
import assert from 'node:assert/strict';
import * as browse from '../local-first/browse.mjs';
const today='2026-10-07',query={keyword:'旅行',start:'',end:''};
const entry=(id,source='manual',extra={})=>({id,source,kind:'consumption',voided:0,spent_on:'2024-02-29',cents:'101',note:'旅行支出',category:'旅行',...extra});
const state=()=>({expenses:[entry('a'),entry('b','固定'),entry('c','訂閱'),entry('d','分期'),entry('v','manual',{voided:1}),entry('future','manual',{spent_on:'2099-01-01'}),entry('income','manual',{kind:'income'})],categories:[{name:'旅行',active:0}],tags:[{id:'t_trip',name:'旅行',hidden:1},{id:'t_other',name:'其他',hidden:0}],expense_tags:[{expense_id:'a',tag_id:'t_trip'},{expense_id:'a',tag_id:'t_other'},{expense_id:'b',tag_id:'t_trip'},{expense_id:'v',tag_id:'t_trip'}]});

test('site search groups all four booked sources and matching real feature/category/hidden tag',()=>{
  assert.equal(typeof browse.siteSearch,'function','Missing shared site search');
  const s=state(),before=structuredClone(s),result=browse.siteSearch(s,query,today,[{name:'旅行規劃',target:'budget-settings'},{name:'月曆',target:'calendar-title'}]);
  assert.deepEqual(result.expenses.map(row=>row.id),['d','c','b','a']);
  assert.equal(result.functions[0].target,'budget-settings');assert.equal(result.functions.length,1);
  assert.equal(result.categories[0].active,0);assert.equal(result.tags[0].hidden,1);assert.equal(result.tags.length,1);assert.deepEqual(s,before);
});
test('category report uses complete exact consumption, not a 50-row display batch',()=>{
  assert.equal(typeof browse.categoryReport,'function','Missing shared category read');
  const s=state();s.expenses.push(...Array.from({length:65},(_,i)=>entry('batch'+i,'manual',{cents:'1'})));
  const before=structuredClone(s),result=browse.categoryReport(s,{category:'旅行',start:'',end:''},today);
  assert.equal(result.rows.length,69);assert.equal(result.total,469n);assert.deepEqual(s,before);
  assert.equal(browse.siteSearch(s,query,today,[]).expenses.length,69);
});
test('single category and single hidden tag keep independent totals and inclusive leap-day ranges',()=>{
  assert.equal(typeof browse.categoryReport,'function','Missing category report');
  const s=state();s.expenses.push(entry('outside','manual',{spent_on:'2024-03-01'}));
  assert.equal(browse.categoryReport(s,{category:'旅行',start:'2024-02-29',end:'2024-02-29'},today).total,404n);
  assert.equal(browse.tagReport(s,{tag_id:'t_trip',start:'',end:''},today).total,202n);
  assert.equal(browse.tagReport(s,{tag_id:'t_other',start:'',end:''},today).total,101n);
  assert.equal(browse.categoryReport(s,{category:'旅行',start:'2024-03-02',end:''},today).total,0n);
});
test('site search preserves literal ASCII matching and historical categories without overrides',()=>{
  assert.equal(typeof browse.siteSearch,'function','Missing site search');
  const s=state();s.expenses.push(entry('history','manual',{note:'AbC[.*]<img>',category:'歷史無設定'}));
  assert.equal(browse.siteSearch(s,{...query,keyword:'abc[.*]'},today,[]).expenses[0].id,'history');
  assert.equal(browse.siteSearch(s,{...query,keyword:'.*'},today,[]).expenses.length,1);
  assert.equal(browse.siteSearch(s,{...query,keyword:'歷史'},today,[]).categories[0].historical,true);
  assert.deepEqual(browse.siteSearch(s,{...query,keyword:'沒有'},today,[]),{expenses:[],functions:[],categories:[],tags:[]});
});
test('dates reject before querying; dates alone search expenses without enumerating all names',()=>{
  assert.equal(typeof browse.siteSearch,'function','Missing site search');
  const unread={get expenses(){throw new Error('query executed');}};
  for(const bad of [{...query,start:'2024-02-30'},{...query,end:'2099-01-01'},{...query,start:'2025-01-01',end:'2024-01-01'},{keyword:'',start:'',end:'2024-01-01'}])assert.throws(()=>browse.siteSearch(unread,bad,today,[]),error=>error.message!=='query executed');
  const result=browse.siteSearch(state(),{keyword:'',start:'2024-02-29',end:'2024-02-29'},today,[{name:'預算'}]);
  assert.equal(result.expenses.length,4);assert.deepEqual([result.functions,result.categories,result.tags],[[],[],[]]);
});
test('category report rejects missing identities and future/invalid ranges with no mutation',()=>{
  assert.equal(typeof browse.categoryReport,'function','Missing category read');
  const s=state(),before=structuredClone(s);
  for(const q of [{category:'不存在',start:'',end:''},{category:'旅行',start:'2024-2-29',end:''},{category:'旅行',start:'',end:'2099-01-01'}])assert.throws(()=>browse.categoryReport(s,q,today));
  assert.deepEqual(s,before);
});
