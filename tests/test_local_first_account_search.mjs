import test from 'node:test';
import assert from 'node:assert/strict';
import * as browse from '../web/browse.mjs';
const today='2026-10-13',query={keyword:'',start:'',end:''};
const expense=(id,date='2024-02-29',extra={})=>({id,spent_on:date,cents:'29',note:'AbC[.*]<img>合成',category:'合成',source:'manual',kind:'consumption',voided:0,...extra});
const income=(id,date='2024-02-29',extra={})=>({id,received_on:date,cents:'101',name:'AbC[.*]<img>合成',voided:0,...extra});
const base=()=>({expenses:['manual','固定','訂閱','分期'].map((source,i)=>expense('e'+i,'2024-02-29',{source})),incomes:[income('i')],categories:[{name:'合成',active:0}],tags:[{id:'t',name:'合成',hidden:1}],expense_tags:[{expense_id:'e0',tag_id:'t'}],income_periods:[{status:'pending',defaults:{name:'合成',cents:'99999'}}],monthly_allocations:[{items:[{cents:'99999'}]}]});
test('default all and explicit sides share exact totals without counting plans or unreceived drafts',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state=base(),before=structuredClone(state);
  const all=browse.searchAccounts(state,query,today);assert.equal(all.rows.length,5);assert.equal(all.expenses.length,4);assert.equal(all.incomeTotal,101n);assert.equal(all.expenseTotal,116n);assert.equal(all.difference,-15n);
  const received=browse.searchAccounts(state,{...query,type:'income'},today);assert.equal(received.rows.length,1);assert.equal(received.expenseTotal,0n);assert.equal(received.difference,101n);
  const spent=browse.searchAccounts(state,{...query,type:'expense'},today);assert.equal(spent.rows.length,4);assert.equal(spent.incomeTotal,0n);assert.deepEqual(state,before);
});
test('literal keyword, inclusive dates, cross-year and leap-day filters combine with type',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state=base();state.incomes.push(income('cross','2023-12-31'),income('end','2024-03-01'));
  assert.equal(browse.searchAccounts(state,{keyword:'abc[.*]',start:'2023-12-31',end:'2024-02-29',type:'income'},today).rows.length,2);
  assert.equal(browse.searchAccounts(state,{keyword:'.*',start:'2024-02-29',end:'2024-02-29',type:'all'},today).rows.length,5);
  assert.equal(browse.searchAccounts(state,{keyword:'沒有',start:'',end:'',type:'all'},today).difference,0n);
  assert.equal(browse.searchAccounts(state,{...query,start:'2024-03-01',end:'2024-03-01'},today).incomeTotal,101n);
});
test('invalid query type, dates and identity injection reject before accessing ledger',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const unread={get expenses(){throw Error('query executed');},get incomes(){throw Error('query executed');}};
  for(const bad of [{...query,type:'investment'},{...query,type:null},{...query,keyword:null},{...query,start:'2024-02-30'},{...query,start:'2025-01-01',end:'2024-01-01'},{...query,end:'2099-01-01'},{...query,user_id:'other'},{...query,ledger_id:'other'}])assert.throws(()=>browse.searchAccounts(unread,bad,today),error=>error.message!=='query executed');
});
test('voided, future, nonconsumption and unknown expense sources are excluded',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state=base();state.expenses.push(expense('v','2024-02-29',{voided:1}),expense('future','2099-01-01'),expense('kind','2024-02-29',{kind:'income'}),expense('bad','2024-02-29',{source:'other'}));state.incomes.push(income('v','2024-02-29',{voided:1}),income('future','2099-01-01'));assert.equal(browse.searchAccounts(state,query,today).rows.length,5);
});
test('same-date ordering and identity collisions are stable across collections and input order',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state={expenses:[expense('same'),expense('z')],incomes:[income('same'),income('a')]};
  const result=browse.searchAccounts(state,query,today);assert.deepEqual(result.rows.map(row=>[row.type,row.id]),[['expense','z'],['expense','same'],['income','same'],['income','a']]);
  state.expenses.reverse();state.incomes.reverse();assert.deepEqual(browse.searchAccounts(state,query,today).rows,result.rows);
});
test('more than fifty exact totals, extreme cents and positive/zero/negative differences do not round',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state={expenses:Array.from({length:65},(_,i)=>expense('e'+i)),incomes:Array.from({length:55},(_,i)=>income('i'+i,'2024-02-29',{cents:'29'}))};
  let report=browse.searchAccounts(state,query,today);assert.equal(report.rows.length,120);assert.equal(report.incomeTotal,1595n);assert.equal(report.expenseTotal,1885n);assert.equal(report.difference,-290n);
  state.incomes.push(income('large','2024-02-29',{cents:'9223372036854775807'}));report=browse.searchAccounts(state,query,today);assert.equal(report.incomeTotal,9223372036854777402n);assert.equal(report.difference,9223372036854775517n);
  assert.equal(browse.searchAccounts({expenses:[expense('e')],incomes:[income('i','2024-02-29',{cents:'29'})]},query,today).difference,0n);
});
test('account type leaves function/category/tag contracts and related expense reports intact',()=>{
  assert.equal(typeof browse.searchAccounts,'function');const state=base(),functions=[{name:'合成規劃',target:'income-planning'}];
  const groups=browse.siteSearch(state,{keyword:'合成',start:'',end:'',type:'income'},today,functions);assert.equal(groups.accounts.rows.length,1);assert.equal(groups.categories.length,1);assert.equal(groups.tags.length,1);assert.deepEqual(groups.functions,functions);
  assert.equal(browse.categoryReport(state,{category:'合成',start:'',end:''},today).rows.length,4);assert.equal(browse.tagReport(state,{tag_id:'t',start:'',end:''},today).rows.length,1);
  const blank=browse.browseSite(state,{...query,type:'income'},today,functions);assert.equal(blank.accounts.rows.length,1);assert.equal(blank.categories.length,8);assert.equal(blank.tags.length,1);
});
