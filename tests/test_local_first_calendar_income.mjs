import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMonth} from '../web/browse.mjs';
const spent=(id,date='2024-02-29',extra={})=>({id,spent_on:date,cents:'29',note:'合成支出',source:'manual',kind:'consumption',voided:0,...extra});
const received=(id,date='2024-02-29',extra={})=>({id,received_on:date,cents:'101',name:'合成<img>收入',voided:0,...extra});
test('income-only, expense-only and mixed dates keep exact whole-day totals and separate flags',()=>{
  const state={expenses:[spent('e'),spent('only','2024-02-01')],incomes:[received('i'),received('only','2024-02-02')]},before=structuredClone(state);
  const month=calendarMonth(state,'2024-02','2024-03-01');assert.equal(month.leadingBlanks,3);assert.equal(month.days.length,29);
  assert.equal(month.days[0].hasIncome,false);assert.equal(month.days[0].expenseTotal,29n);
  assert.equal(month.days[1].hasIncome,true);assert.equal(month.days[1].hasExpense,false);assert.equal(month.days[1].incomeTotal,101n);
  const day=month.days[28];assert.equal(day.incomeTotal,101n);assert.equal(day.expenseTotal,29n);assert.equal(day.difference,72n);assert.equal(day.total,29n);assert.equal(day.rows.length,2);assert.deepEqual(state,before);
});
test('calendar filters voided, future and nonconsumption records and never includes unconfirmed plans',()=>{
  const state={expenses:[spent('paid','2024-02-20'),spent('void','2024-02-20',{voided:1}),spent('future'),spent('investment','2024-02-20',{kind:'investment'})],incomes:[received('paid','2024-02-20'),received('void','2024-02-20',{voided:1}),received('future')],income_periods:[{status:'pending',defaults:{due_on:'2024-02-20',cents:'999999'}}]};
  const month=calendarMonth(state,'2024-02','2024-02-20');assert.equal(month.days[19].rows.length,2);assert.equal(month.days[28].isFuture,true);assert.equal(month.days[28].hasIncome,false);assert.equal(month.days[28].hasExpense,false);assert.equal(month.days[28].rows.length,0);
  const empty=month.days[2];assert.equal(empty.incomeTotal,0n);assert.equal(empty.expenseTotal,0n);assert.equal(empty.difference,0n);
});
test('all four expenses, stable typed identity and more than fifty rows retain exact large totals',()=>{
  const state={expenses:['manual','固定','訂閱','分期'].map((source,i)=>spent('e'+i,'2024-02-29',{source})),incomes:Array.from({length:65},(_,i)=>received('i'+i,'2024-02-29',{cents:'9223372036854775807'}))};
  const day=calendarMonth(state,'2024-02','2024-03-01').days[28];assert.equal(day.rows.length,69);assert.equal(day.expenseTotal,116n);assert.equal(day.incomeTotal,599519182395560427455n);assert.equal(day.difference,599519182395560427339n);
  const collision=calendarMonth({expenses:[spent('same')],incomes:[received('same')]},'2024-02','2024-03-01').days[28];assert.deepEqual(collision.rows.map(row=>[row.type,row.id]),[['expense','same'],['income','same']]);
});
test('cross-year month ownership, negative and zero differences and strict dates remain intact',()=>{
  const state={expenses:[spent('a','2023-12-31',{cents:'101'}),spent('b','2024-01-01',{cents:'101'})],incomes:[received('a','2023-12-31',{cents:'29'}),received('b','2024-01-01')]};
  assert.equal(calendarMonth(state,'2023-12','2024-03-01').days[30].difference,-72n);assert.equal(calendarMonth(state,'2024-01','2024-03-01').days[0].difference,0n);
  const unread={get expenses(){throw Error('read executed');},get incomes(){throw Error('read executed');}};
  for(const month of ['2024-2','2024-13','2024-04'])assert.throws(()=>calendarMonth(unread,month,'2024-03-01'),e=>e.message!=='read executed');
  assert.equal(calendarMonth({expenses:[]},'2023-02','2024-03-01').days.length,28);
});
