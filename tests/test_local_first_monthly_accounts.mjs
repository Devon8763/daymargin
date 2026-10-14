import test from 'node:test';
import assert from 'node:assert/strict';
import * as browse from '../local-first/browse.mjs';
const spent=(id,date='2024-02-29',extra={})=>({id,spent_on:date,cents:'29',note:'<img> 合成',source:'manual',kind:'consumption',voided:0,category:'停用歷史',...extra});
const received=(id,date='2024-02-29',extra={})=>({id,received_on:date,cents:'101',name:'薪資<img>',voided:0,...extra});
const report=(state,month='2024-02',today='2024-03-01')=>{assert.equal(typeof browse.monthlyAccounts,'function');return browse.monthlyAccounts(state,month,today);};
test('strict monthly boundaries include leap/cross-year ends and reject future or injected months before reading',()=>{
  const state={expenses:[spent('dec','2023-12-31'),spent('jan','2024-01-01'),spent('feb'),spent('march','2024-03-01')],incomes:[]};
  assert.equal(report(state,'2023-12').expenseTotal,29n);assert.equal(report(state).expenseTotal,29n);assert.equal(report(state).through,'2024-02-29');assert.equal(report(state,'2024-03').through,'2024-03-01');
  const unread={get expenses(){throw Error('read executed');},get incomes(){throw Error('read executed');}};
  for(const month of ['',null,[],{month:'2024-02',user_id:'other'},'2024-2','0000-01','2024-00','2024-13','10000-01','2024-04'])assert.throws(()=>report(unread,month),e=>e.message!=='read executed');
  assert.throws(()=>report(unread,'2024-02','2024-02-30'),e=>e.message!=='read executed');
});
test('empty, income-only, expense-only and balanced months return exact positive/negative/zero differences',()=>{
  let result=report({expenses:[],incomes:[]});assert.equal(result.incomeTotal,0n);assert.equal(result.expenseTotal,0n);assert.equal(result.difference,0n);assert.deepEqual(result.incomeSources,[]);assert.deepEqual(result.expenseCategories,[]);
  result=report({expenses:[],incomes:[received('i')]});assert.equal(result.difference,101n);assert.equal(result.expenseCategories.length,0);
  result=report({expenses:[spent('e')],incomes:[]});assert.equal(result.difference,-29n);assert.equal(result.incomeSources.length,0);
  result=report({expenses:[spent('e')],incomes:[received('i','2024-02-29',{cents:'29'})]});assert.equal(result.difference,0n);
});
test('all four expense sources, one invoice expense and inactive/historical category and income names remain grouped',()=>{
  const state={expenses:['manual','固定','訂閱','分期'].map((source,i)=>spent('e'+i,'2024-02-29',{source})),incomes:[received('i'),received('bonus','2024-02-01',{name:'獎金',cents:'30'})],categories:[{name:'停用歷史',active:0}],invoice_imports:[{key:'e_invoice_2024_ab00000001',expense_id:'e0'}]};
  const result=report(state);assert.equal(result.expenseTotal,116n);assert.equal(result.incomeTotal,131n);assert.equal(result.expenseCategories[0].name,'停用歷史');assert.equal(result.expenseCategories[0].rows.length,4);assert.equal(result.incomeSources.length,2);
  assert.equal(result.incomeSources.reduce((sum,g)=>sum+g.total,0n),result.incomeTotal);assert.equal(result.expenseCategories.reduce((sum,g)=>sum+g.total,0n),result.expenseTotal);
});
test('today cutoff excludes voided, predictions, nonconsumption, drafts and all planning amounts without writing',()=>{
  const state={expenses:[spent('ok','2024-02-20'),spent('void','2024-02-20',{voided:1}),spent('future'),spent('asset','2024-02-20',{kind:'investment'}),spent('unknown','2024-02-20',{source:'future'})],incomes:[received('ok','2024-02-20'),received('void','2024-02-20',{voided:1}),received('future')],income_periods:[{status:'pending',defaults:{cents:'999999'}}],scheduled_periods:[{status:'pending',defaults:{cents:'999999'}}],annual_periods:[{status:'pending'}],monthly_allocations:[{items:[{cents:'999999'}]}],goals:[{saved_cents:'999999'}],allocation_preferences:[{excluded:1}]};
  const before=structuredClone(state),result=report(state,'2024-02','2024-02-20');assert.equal(result.through,'2024-02-20');assert.equal(result.incomeTotal,101n);assert.equal(result.expenseTotal,29n);assert.equal(result.expenseCategories[0].rows.length,1);assert.equal(result.incomeSources[0].rows.length,1);assert.deepEqual(state,before);
});
test('complete groups exceed fifty rows, retain exact extreme cents and stable typed identities',()=>{
  const state={expenses:Array.from({length:65},(_,i)=>spent('e'+i)),incomes:Array.from({length:55},(_,i)=>received('i'+i))};
  state.incomes.push(received('huge','2024-02-29',{cents:'9223372036854775807'}));const result=report(state);assert.equal(result.expenseCategories[0].rows.length,65);assert.equal(result.incomeSources[0].rows.length,56);assert.equal(result.expenseTotal,1885n);assert.equal(result.incomeTotal,9223372036854781362n);assert.equal(result.difference,9223372036854779477n);
  const collision=report({expenses:[spent('same')],incomes:[received('same')]});assert.equal(collision.expenseCategories[0].rows[0].type,'expense');assert.equal(collision.incomeSources[0].rows[0].type,'income');
  const order=report({expenses:[spent('a','2024-02-01'),spent('z')],incomes:[]});assert.equal(order.expenseCategories[0].rows[0].id,'z');
});
test('source grouping preserves existing distinct names and readonly input order',()=>{
  const state={expenses:[],incomes:[received('one','2024-02-01',{name:'Salary'}),received('two','2024-02-29',{name:'salary'}),received('three','2024-02-29',{name:'Salary'})]};const before=structuredClone(state),result=report(state);assert.equal(result.incomeSources.length,2);assert.equal(result.incomeSources.find(g=>g.name==='Salary').total,202n);assert.deepEqual(state,before);
});
