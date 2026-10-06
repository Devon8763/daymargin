import test from 'node:test';
import assert from 'node:assert/strict';
import * as ledger from '../local-first/ledger.mjs';
import * as rules from '../local-first/rules.mjs';
import {emptyData,writeBackup,readBackup} from '../local-first/backup.mjs';
import {portable} from '../local-first/idb.mjs';
const today='2026-10-06';
const state=()=>({...emptyData(4),payment_sources:[{id:'p_cash',name:'現金',active:1}]});
const form=(extra={})=>({name:'早餐',note:'三明治',category:'餐飲',payment_source_id:'p_cash',amount:'.29',...extra});
const expense=(extra={})=>({id:'e_one',spent_on:today,cents:'29',category:'餐飲',note:'三明治',source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0,...extra});
test('shortcut creation uses optional exact cents and never creates an expense or action',()=>{
  assert.equal(typeof ledger.changeShortcut,'function');
  const s=state(),before=structuredClone(s),a=ledger.changeShortcut(s,[],'add','s_one',form(),null,today);
  assert.deepEqual(a.shortcuts,[{id:'s_one',name:'早餐',note:'三明治',category:'餐飲',payment_source_id:'p_cash',cents:'29',position:0,active:1}]);
  const b=ledger.changeShortcut(a,a.shortcuts,'add','s_two',form({amount:''}),null,today);
  assert.equal(b.shortcuts[1].cents,null);assert.deepEqual(b.expenses,[]);assert.deepEqual(b.actions,[]);assert.deepEqual(s,before);
  assert.deepEqual(readBackup(writeBackup(portable(b))),portable(b));assert.equal(portable(b).version,1);
});
test('shortcut input rejects inactive choices, invalid text, money and injected fields',()=>{
  for(const bad of [form({name:''}),form({name:'字'.repeat(31)}),form({name:'\n'}),form({note:''}),form({note:'字'.repeat(201)}),form({amount:'0'}),form({amount:'1.001'}),form({amount:'1000000001'}),form({category:'不存在'}),form({payment_source_id:'missing'}),form({position:0})])assert.throws(()=>ledger.changeShortcut(state(),[],'add','s_one',bad,null,today));
  let s=state();s.categories=[{name:'餐飲',active:0}];assert.throws(()=>ledger.changeShortcut(s,[],'add','s_one',form(),null,today));
  s=state();s.payment_sources[0].active=0;s.payment_sources[0].name='合成停用卡';assert.throws(()=>ledger.changeShortcut(s,[],'add','s_one',form(),null,today));
});
test('source draft accepts only current manual consumption, excludes annual links and stays independent',()=>{
  assert.equal(typeof ledger.shortcutDraft,'function');
  let s=state();s.expenses=[expense()];const draft=ledger.shortcutDraft(s,'e_one',0,today);
  assert.equal(draft.amount,'0.29');assert.equal(draft.note,'三明治');assert.equal(draft.payment_source_id,'p_cash');
  assert.equal(ledger.shortcutDraft({...s,expenses:[expense({revision:9223372036854775807n})]},'e_one',9223372036854775807n,today).amount,'0.29');
  let changed=ledger.changeShortcut(s,[],'add','s_one',draft,{id:'e_one',revision:0},today);changed.expenses[0].note='其他';changed.expenses[0].voided=1;
  assert.equal(changed.shortcuts[0].note,'三明治');
  for(const extra of [{voided:1},{source:'固定'},{source:'訂閱'},{source:'分期'},{kind:'income'},{revision:1},{spent_on:'2026-10-07'}]){const invalid={...s,expenses:[expense(extra)]};assert.throws(()=>ledger.shortcutDraft(invalid,'e_one',0,today));}
  s.annual_rules=[{id:'ar_one',name:'年費',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金',first_year:2026,due_month:10,due_day:1,effective_month:'2026-10',active:1,revision:0}];s.annual_periods=[{annual_id:'ar_one',year:2026,defaults:{name:'年費',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金',due_on:'2026-10-01'},status:'recorded',expense_id:'e_one',revision:0}];
  assert.throws(()=>ledger.shortcutDraft(s,'e_one',0,today));assert.throws(()=>ledger.changeShortcut(s,[],'add','s_annual',form(),{id:'e_one',revision:0},today));
});
test('manual order handles exact large and duplicate positions; edits and disable preserve history',()=>{
  assert.equal(typeof rules.orderedShortcuts,'function');
  let s=state();s.expenses=[expense()];s=ledger.changeShortcut(s,[],'add','s_b',form(),null,today);s=ledger.changeShortcut(s,s.shortcuts,'add','s_a',form({name:'午餐'}),null,today);
  s.shortcuts.forEach(row=>{row.position=9007199254740993n;});assert.deepEqual(rules.orderedShortcuts(s).map(row=>row.id),['s_a','s_b']);
  const before=structuredClone(s.expenses);s=ledger.changeShortcut(s,s.shortcuts,'up','s_b',null,null,today);assert.deepEqual(rules.orderedShortcuts(s).map(row=>row.id),['s_b','s_a']);
  s=ledger.changeShortcut(s,s.shortcuts,'update','s_b',form({name:'更改',amount:''}),null,today);assert.equal(s.shortcuts[0].cents,null);
  s=ledger.changeShortcut(s,s.shortcuts,'disable','s_b',null,null,today);assert.deepEqual(rules.orderedShortcuts(s).map(row=>row.id),['s_a']);assert.equal(s.shortcuts.length,2);assert.deepEqual(s.expenses,before);
  assert.throws(()=>ledger.changeShortcut(s,s.shortcuts,'update','s_b',form(),null,today));
});
test('stale snapshot, duplicate IDs, corrupt or over-capacity state are rejected without mutation',()=>{
  const s=state(),a=ledger.changeShortcut(s,[],'add','s_one',form(),null,today),before=structuredClone(a);
  assert.throws(()=>ledger.changeShortcut(a,[],'add','s_two',form(),null,today));assert.throws(()=>ledger.changeShortcut(a,a.shortcuts,'add','s_one',form(),null,today));
  const bad=structuredClone(a);bad.shortcuts[0].payment_source_id='missing';assert.throws(()=>ledger.changeShortcut(bad,bad.shortcuts,'disable','s_one',null,null,today));
  const cap={...s,categories:Array.from({length:99999},(_,i)=>({name:'c'+i,active:0}))};assert.throws(()=>ledger.changeShortcut(cap,[],'add','s_one',form(),null,today));assert.deepEqual(a,before);
});
