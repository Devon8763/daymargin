import test from 'node:test';
import assert from 'node:assert/strict';
import * as ledger from '../web/ledger.mjs';
import * as income from '../web/income.mjs';
import {emptyData,readBackup,writeBackup,MAX_INTEGER} from '../web/backup.mjs';
import {portable,metadata} from '../web/idb.mjs';
const initial=()=>({...emptyData(8),format:'local-first-test-ledger',version:9,owner:'local-test-owner'});
const form={name:'合成月薪',amount:'10.29',first_due_on:'2024-01-31',due_day:31};
const add=(state=initial(),value=form,today='2024-01-01')=>ledger.changeIncomeRule(state,'add','ir_one',null,value,today);
const process=(state,month,action,revision=null,ruleRevision=state.income_rules[0].revision,actual=null,today='2024-03-31')=>ledger.changeIncomePeriod(state,'ir_one',month,ruleRevision,revision,action,actual,today);
test('monthly income retains day anchor across short months and reads never post',()=>{
  const state=add(),before=structuredClone(state);
  assert.deepEqual(income.recurringIncomeItems(state,'2024-03-31').items.map(x=>x.defaults.due_on),['2024-01-31','2024-02-29','2024-03-31']);
  assert.equal(income.recurringIncomeItems(state,'2024-01-30').items[0].status,'upcoming');
  assert.deepEqual(state,before);assert.equal(income.incomeMonth(state,'2024-03').received,0n);
  const ordinary=add(initial(),{...form,first_due_on:'2023-01-31'});
  assert.equal(income.recurringIncomeItem(ordinary,'ir_one','2023-02','2023-03-31').defaults.due_on,'2023-02-28');
  assert.equal(income.recurringIncomeItem(ordinary,'ir_one','2023-03','2023-03-31').defaults.due_on,'2023-03-31');
});
test('only explicit due confirmation records precise income and soft void never resurrects it',()=>{
  const base=add();assert.throws(()=>process(base,'2024-01','record',null,0,null,'2024-01-30'));
  let state=process(base,'2024-01','record',null,0,{name:'合成實收',amount:'.29',received_on:'2024-02-01'});
  assert.equal(state.incomes.length,1);assert.equal(income.incomeMonth(state,'2024-01').received,0n);assert.equal(income.incomeMonth(state,'2024-02').received,29n);
  const saved=structuredClone(state);assert.throws(()=>process(state,'2024-01','record',0));assert.deepEqual(state,saved);
  state=ledger.changeIncome(state,'void',state.incomes[0].id,0,null,'2024-03-31');
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-01','2024-03-31').status,'recorded');assert.throws(()=>process(state,'2024-01','restore',0));
  assert.equal(state.expenses.length,0);assert.equal(state.monthly_allocations.length,0);assert.equal(state.income_actions.length,2);
});
test('skip and restore are period-local; old revisions and repeats preserve input state',()=>{
  let state=process(add(),'2024-01','skip');assert.equal(state.incomes.length,0);assert.equal(state.income_periods[0].status,'skipped');
  assert.throws(()=>process(state,'2024-01','restore',null));state=process(state,'2024-01','restore',0);assert.equal(state.income_periods[0].revision,1);
  state=process(state,'2024-01','record',1);assert.equal(state.incomes[0].cents,'1029');assert.throws(()=>process(state,'2024-02','record',null,9));
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-02','2024-03-31').status,'pending');
});
test('rule editing and stopping freeze overdue defaults without posting or losing saved periods',()=>{
  let state=add();state=ledger.changeIncomeRule(state,'update','ir_one',0,{...form,name:'未來月薪',amount:'12',due_day:30},'2024-02-29');
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-02','2024-04-30').defaults.cents,'1029');
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-03','2024-04-30').defaults.cents,'1200');
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-03','2024-04-30').defaults.due_on,'2024-03-30');
  state=ledger.changeIncomeRule(state,'disable','ir_one',1,null,'2024-03-30');assert.equal(state.incomes.length,0);
  assert.equal(income.recurringIncomeItem(state,'ir_one','2024-03','2024-04-30').status,'pending');assert.equal(income.recurringIncomeItem(state,'ir_one','2024-04','2024-04-30'),null);
  state=process(state,'2024-03','record',0,2);assert.equal(state.incomes.length,1);assert.throws(()=>ledger.changeIncomeRule(state,'update','ir_one',2,form,'2024-04-01'));
});
test('invalid fields, extreme dates, stale state and capacity failures reject completely',()=>{
  for(const value of [{...form,amount:'0'},{...form,amount:'1000000000.01'},{...form,due_day:0},{...form,first_due_on:'2024-02-30'},{...form,name:''},{...form,owner:'other'}])assert.throws(()=>add(initial(),value));
  const state=add();assert.throws(()=>ledger.changeIncomeRule(state,'update','ir_one',0,{...form,first_due_on:'2024-02-01'},'2024-02-01'));
  assert.throws(()=>process(state,'2024-13','skip'));assert.throws(()=>process(state,'2024-01','unknown'));assert.throws(()=>process(state,'2024-01','record',null,0,{name:'x',amount:'1',received_on:'2025-01-01'}));
  const max=add(initial(),{...form,first_due_on:'9999-12-31'},'9999-12-01');assert.equal(income.recurringIncomeItems(max,'9999-12-31').items.length,1);
  const full=initial();full.categories=Array.from({length:100000},(_,i)=>({name:'c'+i,active:1}));metadata(full);assert.throws(()=>add(full));assert.equal(full.income_rules.length,0);
  state.income_rules[0].revision=MAX_INTEGER;metadata(state);assert.throws(()=>ledger.changeIncomeRule(state,'disable','ir_one',MAX_INTEGER,null,'2024-01-31'));
});
test('JSON v8 includes exact income references, frozen periods and all old data; corruption refuses',()=>{
  let state=process(add(),'2024-01','record');state=process(state,'2024-02','skip');const data=portable(state),bytes=writeBackup(data);
  assert.equal(data.version,8);assert.deepEqual(writeBackup(readBackup(bytes)),bytes);
  for(const mutate of [x=>x.version=7,x=>x.data.income_periods[0].income_id='missing',x=>x.data.income_periods.push({...x.data.income_periods[0]}),x=>x.data.income_periods[1].defaults.due_on='2024-03-01',x=>x.data.income_rules[0].due_day=0,x=>x.data.income_periods[1].income_id=x.data.incomes[0].id,x=>x.data.income_rules[0].name='']){
    const broken=structuredClone(data);mutate(broken);assert.throws(()=>writeBackup(broken));
  }
  for(let version=1;version<=7;version++){const original=writeBackup({format:'life-ledger-backup',version,data:emptyData(version)});assert.deepEqual(writeBackup(readBackup(original)),original);}
});
test('long unsaved schedule views paginate without overflowing; freezing over-cap history refuses',()=>{
  const state=add(initial(),{...form,first_due_on:'0001-01-31'},'0001-01-01'),before=structuredClone(state);
  const view=income.recurringIncomeItems(state,'9999-12-31',10);assert.equal(view.items.length,10);assert.equal(view.more,true);assert.deepEqual(state,before);
  assert.throws(()=>ledger.changeIncomeRule(state,'disable','ir_one',0,null,'9999-12-31'));assert.deepEqual(state,before);
});
test('moving a future collection day to an elapsed day preserves this month before next-month changes',()=>{
  const original=add(),before=structuredClone(original);
  const state=ledger.changeIncomeRule(original,'update','ir_one',0,{...form,name:'未來設定',amount:'20',due_day:1},'2024-01-12');
  assert.deepEqual(original,before);assert.equal(state.incomes.length,0);
  const current=income.recurringIncomeItem(state,'ir_one','2024-01','2024-01-12');
  assert.equal(current.defaults.due_on,'2024-01-31');assert.equal(current.defaults.cents,'1029');assert.equal(current.status,'upcoming');
  assert.equal(income.recurringIncomeItems(state,'2024-01-12').items[0].status,'upcoming');
  assert.throws(()=>process(state,'2024-01','record',0,1,null,'2024-01-12'));
  const next=income.recurringIncomeItem(state,'ir_one','2024-02','2024-02-01');
  assert.equal(next.defaults.due_on,'2024-02-01');assert.equal(next.defaults.cents,'2000');
  assert.equal(process(state,'2024-01','record',0,1,null,'2024-01-31').incomes[0].cents,'1029');
});
