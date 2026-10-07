import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../local-first/rules.mjs';
import * as ledger from '../local-first/ledger.mjs';
import * as browse from '../local-first/browse.mjs';
import {emptyData,writeBackup,readBackup} from '../local-first/backup.mjs';
import {portable,metadata} from '../local-first/idb.mjs';
const today='2026-10-06',selection=(ids=[],names=[])=>({ids,names});
const entry=(extra={})=>({id:'e_one',spent_on:today,cents:'100000',category:'餐飲',note:'合成消費',source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0,...extra});
const state=()=>({...emptyData(5),payment_sources:[{id:'p_cash',name:'現金',active:1}],expenses:[entry()]});
test('tag names normalize only whitespace/display prefixes and NFC, retaining distinct names',()=>{
  assert.equal(typeof rules.tagName,'function');
  for(const value of ['日本旅行',' #日本旅行 ','＃日本旅行','##日本旅行',' # #日本旅行 '])assert.equal(rules.tagName(value),'日本旅行');
  assert.equal(rules.tagName('cafe\u0301'),'café');assert.notEqual(rules.tagName('Travel'),rules.tagName('travel'));assert.notEqual(rules.tagName('Ａ'),rules.tagName('A'));
  for(const value of ['', '#','字'.repeat(51),'a\nB','a\0b','\ud800'])assert.throws(()=>rules.tagName(value));
});
test('two tags attach atomically in prepared state; hidden full name reuses identity without showing',()=>{
  assert.equal(typeof ledger.assignExpenseTags,'function');
  const s=state(),before=structuredClone(s);let changed=ledger.assignExpenseTags(s,'e_one',selection([],['#日本旅行','聚餐']));
  assert.equal(changed.tags.length,2);assert.equal(changed.expense_tags.length,2);assert.deepEqual(changed.expenses,s.expenses);assert.deepEqual(s,before);
  const first=changed.tags[0];changed=ledger.changeTag(changed,'hide',first.id,0);
  changed=ledger.assignExpenseTags(changed,'e_one',selection([],['日本旅行']));assert.equal(changed.tags.length,2);assert.equal(changed.tags[0].hidden,1);assert.deepEqual(changed.expense_tags,[{expense_id:'e_one',tag_id:first.id}]);
  assert.deepEqual(rules.tagSuggestions(changed,'日本'),[]);assert.equal(rules.tagSuggestions(changed,'聚')[0].name,'聚餐');
  assert.throws(()=>ledger.assignExpenseTags(changed,'e_one',selection([],['#新','新'])));
  assert.throws(()=>ledger.assignExpenseTags(changed,'e_one',selection(['missing'])));
});
test('single-tag exact totals exclude voided, future and non-consumption; date ranges include both ends',()=>{
  assert.equal(typeof browse.tagReport,'function');
  let s=ledger.assignExpenseTags(state(),'e_one',selection([],['A','B']));const [a,b]=s.tags;
  s.expenses.push(entry({id:'e_cent',spent_on:'2026-09-30',cents:'1'}),entry({id:'e_void',voided:1}),entry({id:'e_future',spent_on:'2026-10-07'}),entry({id:'e_other',kind:'income'}));
  for(const id of ['e_cent','e_void','e_future','e_other'])s.expense_tags.push({expense_id:id,tag_id:a.id});
  const before=structuredClone(s);assert.equal(browse.tagReport(s,{tag_id:a.id,start:'',end:''},today).total,100001n);assert.equal(browse.tagReport(s,{tag_id:b.id,start:'',end:''},today).total,100000n);
  assert.equal(browse.tagReport(s,{tag_id:a.id,start:today,end:today},today).rows.length,1);assert.deepEqual(s,before);
  assert.throws(()=>browse.tagReport(s,{tag_id:a.id,start:'2026-10-07',end:'2026-10-01'},today));assert.throws(()=>browse.tagReport(s,{tag_id:a.id,start:'invalid',end:''},today));assert.throws(()=>browse.tagReport(s,{tag_id:'missing',start:'',end:''},today));
  const bulk={...s,expenses:Array.from({length:65},(_,i)=>entry({id:'e_'+i,cents:'9223372036854775807'})),expense_tags:Array.from({length:65},(_,i)=>({expense_id:'e_'+i,tag_id:a.id}))};
  const report=browse.tagReport(bulk,{tag_id:a.id,start:'',end:''},today);assert.equal(report.rows.length,65);assert.equal(report.total,65n*9223372036854775807n);
});
test('global remove unlinks active and voided expenses, preserves fields/history and invalidates old revisions',()=>{
  let s=state();s.expenses.push(entry({id:'e_void',voided:1}));s=ledger.assignExpenseTags(s,'e_one',selection([],['聚餐']));s=ledger.assignExpenseTags(s,'e_void',selection([s.tags[0].id]));
  assert.equal(s.tags[0].revision,1);const original=structuredClone(s);const changed=ledger.changeTag(s,'remove',s.tags[0].id,1);
  assert.deepEqual(changed.tags,[]);assert.deepEqual(changed.expense_tags,[]);
  for(let i=0;i<2;i++)assert.deepEqual(changed.expenses[i],{...s.expenses[i],revision:1});assert.deepEqual(s,original);
  assert.throws(()=>ledger.changeTag({...s,expenses:[{...s.expenses[0],revision:9223372036854775807n},s.expenses[1]]},'remove',s.tags[0].id,1));
  const hidden=ledger.changeTag(s,'hide',s.tags[0].id,1);assert.throws(()=>ledger.changeTag(hidden,'show',s.tags[0].id,1));assert.equal(ledger.changeTag(hidden,'show',s.tags[0].id,2).tags[0].hidden,0);
});
test('JSON v5 strictly includes both tag sections, duplicates and orphan references cannot be restored',()=>{
  let s=ledger.assignExpenseTags(state(),'e_one',selection([],['聚餐']));assert.equal(portable(s).version,5);assert.equal(Object.keys(portable(s).data).length,18);assert.deepEqual(readBackup(writeBackup(portable(s))),portable(s));
  for(const mutate of [x=>x.tags.push({...x.tags[0],id:'t_other'}),x=>x.expense_tags.push(x.expense_tags[0]),x=>x.expense_tags[0].expense_id='missing',x=>x.expense_tags[0].tag_id='missing',x=>x.tags[0].name='#聚餐',x=>x.tags[0].hidden=2,x=>x.tags[0].revision=-1]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>writeBackup(portable(bad)));}
  for(const version of [1,2,3,4])assert.equal(readBackup(writeBackup({format:'life-ledger-backup',version,data:emptyData(version)})).version,version);
  assert.throws(()=>writeBackup({format:'life-ledger-backup',version:4,data:portable(s).data}));
});
test('all four sources can be tagged; recurring forecasts inherit no labels; capacity failure leaves input state exact',()=>{
  const s=state();for(const source of ['manual','固定','訂閱','分期']){const copy={...s,expenses:[entry({source})]};const result=ledger.assignExpenseTags(copy,'e_one',selection([],['A']));assert.equal(result.expense_tags.length,1);assert.equal(result.expenses[0].source,source);}
  const cap={...s,categories:Array.from({length:99998},(_,i)=>({name:'c'+i,active:0}))},before=structuredClone(cap);
  assert.throws(()=>ledger.assignExpenseTags(cap,'e_one',selection([],['A'])));assert.deepEqual(cap,before);assert.equal(metadata(state()).row_count,2);
});
