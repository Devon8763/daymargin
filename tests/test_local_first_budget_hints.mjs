import test from 'node:test';
import assert from 'node:assert/strict';
import * as browse from '../web/browse.mjs';

test('selected month uses only its explicit total including zero, not category sum',()=>{
  const state={expenses:[],categories:[],budgets:[{month:'2024-01',category:'總額',cents:'1800000'},{month:'2024-02',category:'總額',cents:'0'},{month:'2024-03',category:'餐飲',cents:'100'}]};
  assert.equal(browse.monthBudget(state,'2026-10-14','2024-01').total.cents,1800000n);
  assert.equal(browse.monthBudget(state,'2026-10-14','2024-02').total.cents,0n);
  assert.equal(browse.monthBudget(state,'2026-10-14','2024-03').total,null);
  assert.equal(browse.monthBudget(state,'2026-10-14').total,null);
  for(const month of ['2024-1','2024-13','2024-02-01'])assert.throws(()=>browse.monthBudget(state,'2026-10-14',month));
});
test('budget status uses exact cents at 90/100 percent, switch only suppresses near',()=>{
  const status=(spent,enabled=true,budget=1001n)=>browse.budgetStatus({cents:budget,spent},enabled);
  assert.equal(status(900n),'remaining');assert.equal(status(901n),'near');
  assert.equal(status(900n,true,1000n),'near');assert.equal(status(1001n),'used');assert.equal(status(1002n),'over');
  assert.equal(status(901n,false),'remaining');assert.equal(status(1001n,false),'used');assert.equal(status(1002n,false),'over');
  assert.equal(status(0n,true,0n),'used');assert.equal(status(1n,true,0n),'over');
  assert.equal(status(900000000000000000000n,true,1000000000000000000000n),'near');
});
test('month overview keeps categories independent, excludes revoked/future and never mutates data',()=>{
  const expense=(cents,extra={})=>({id:'e',spent_on:'2024-02-01',kind:'consumption',source:'manual',voided:0,category:'餐飲',cents,...extra});
  const state={categories:[],budgets:[{month:'2024-02',category:'總額',cents:'1000'},{month:'2024-02',category:'餐飲',cents:'900'}],expenses:[expense('900'),expense('100',{voided:1}),expense('100',{spent_on:'2024-02-15'})]};
  const before=JSON.stringify(state),result=browse.monthBudget(state,'2024-02-14');
  assert.equal(browse.budgetStatus(result.total,true),'near');assert.equal(browse.budgetStatus(result.categories[0],true),'used');assert.equal(JSON.stringify(state),before);
});
