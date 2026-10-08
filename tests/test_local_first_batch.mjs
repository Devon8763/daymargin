import test from 'node:test';
import assert from 'node:assert/strict';
import * as ledger from '../local-first/ledger.mjs';
import {emptyData,writeBackup,MAX_INTEGER} from '../local-first/backup.mjs';
import {portable} from '../local-first/idb.mjs';
import {readFileSync} from 'node:fs';
const today='2026-10-08';
const blank=()=>({format:'local-first-test-ledger',version:7,owner:'local-test-owner',...emptyData(6),payment_sources:[{id:'p_cash',name:'現金',active:1},{id:'p_old',name:'停用卡',active:0},{id:'p_card',name:'新卡',active:1}]});
const entry=(id,extra={})=>({id,spent_on:today,cents:'29',category:'停用歷史',note:'合成消費',source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_old',payment_source_name:'原付款快照',kind:'consumption',revision:0,...extra});
const sample=()=>{const state=blank();state.categories=[{name:'停用歷史',active:0}];state.tags=[{id:'t_old',name:'原標籤',hidden:0,revision:0},{id:'t_hidden',name:'隱藏',hidden:1,revision:0}];for(const [i,source]of ['manual','固定','訂閱','分期'].entries()){const id='e_'+i;if(i)state.recurring_rules.push({id:'r_'+i,name:'合成規則',cents:'29',category:'餐飲',kind:source,start_month:'2026-10',periods:i===3?2:0,due_day:8,active:1,revision:0});state.expenses.push(entry(id,{source,recurring_id:i?'r_'+i:null,period:i?'2026-10':null}));state.expense_tags.push({expense_id:id,tag_id:'t_old'});}return state;};
const targets=state=>state.expenses.map(row=>({id:row.id,revision:row.revision}));
const bytes=state=>writeBackup(portable(state));
test('batch combination preserves four sources, exact fields, original tags and independent rules; actions keep before/order',()=>{
  assert.equal(typeof ledger.changeExpenseBatch,'function');
  const state=sample(),before=structuredClone(state);state.expenses[0].cents=String(MAX_INTEGER);before.expenses[0].cents=String(MAX_INTEGER);
  const changed=ledger.changeExpenseBatch(state,targets(state),{category:'交通',payment_source_id:'p_card',tags:{ids:[],names:['#新用途','隱藏']}},today);
  assert.deepEqual(state,before);assert.deepEqual(changed.recurring_rules,state.recurring_rules);assert.equal(changed.expenses.length,4);assert.equal(changed.actions.length,4);assert.equal(changed.tags.length,3);
  changed.expenses.forEach((row,i)=>{assert.equal(row.category,'交通');assert.equal(row.payment_source_name,'新卡');assert.equal(row.revision,1);for(const field of ['cents','spent_on','source','recurring_id','period','note'])assert.equal(row[field],state.expenses[i][field]);assert.deepEqual(changed.actions[i].before,state.expenses[i]);assert.equal(changed.actions[i].expense_id,row.id);assert.equal(changed.expense_tags.filter(link=>link.expense_id===row.id).length,3);});
  assert.equal(changed.tags.find(row=>row.id==='t_hidden').hidden,1);assert.doesNotThrow(()=>bytes(changed));
  assert.equal(portable(changed).version,5);
});
test('omitted options preserve inactive original category/payment snapshot; append already-used tag is idempotent',()=>{
  const state=sample(),changed=ledger.changeExpenseBatch(state,targets(state),{tags:{ids:['t_old'],names:['#隱藏']}},today);
  assert.equal(changed.tags.length,2);assert.equal(changed.expense_tags.length,8);
  for(const row of changed.expenses){assert.equal(row.category,'停用歷史');assert.equal(row.payment_source_name,'原付款快照');assert.equal(row.payment_source_id,'p_old');}
  assert.equal(changed.tags.find(row=>row.id==='t_old').revision,0);
});
test('empty/forged/duplicate targets, missing choices, invalid options and tags refuse without mutation',()=>{
  const state=sample(),before=bytes(state),selected=targets(state);
  for(const [rows,change]of [[[],{category:'交通'}],[selected,{}],[selected,{tags:{ids:[],names:[]}}],[selected,{amount:'2'}],[selected,{category:'停用歷史'}],[selected,{payment_source_id:'p_old'}],[selected,{category:'missing'}],[selected,{tags:{ids:['missing'],names:[]}}],[selected,{tags:{ids:[],names:['#新','新']}}],[[selected[0],selected[0]],{category:'交通'}],[[{id:'missing',revision:0}],{category:'交通'}],[[{...selected[0],note:'forged'}],{category:'交通'}]]){assert.throws(()=>ledger.changeExpenseBatch(state,rows,change,today));assert.deepEqual(bytes(state),before);}
});
test('stale, voided, future or non-consumption member rejects whole group and leaves no tags/actions',()=>{
  for(const patch of [{revision:1},{voided:1},{spent_on:'2099-01-01'},{kind:'income'},{revision:MAX_INTEGER}]){const state=sample(),selected=targets(state);Object.assign(state.expenses[1],patch);const before=structuredClone(state);assert.throws(()=>ledger.changeExpenseBatch(state,selected,{tags:{ids:[],names:['不得留下']}},today));assert.deepEqual(state,before);}
});
test('more than fifty targets and capacity/revision boundaries remain one complete validated change',()=>{
  const state=blank();state.expenses=Array.from({length:65},(_,i)=>entry('e_many_'+i));const changed=ledger.changeExpenseBatch(state,targets(state),{category:'餐飲'},today);assert.equal(changed.actions.length,65);assert.equal(changed.expenses.filter(row=>row.category==='餐飲').length,65);assert.doesNotThrow(()=>bytes(changed));assert.equal(portable(changed).version,1);
  const limited=blank();limited.expenses=[entry('e_one')];limited.categories=Array.from({length:99996},(_,i)=>({name:'c'+i,active:0}));const before=structuredClone(limited);assert.throws(()=>ledger.changeExpenseBatch(limited,targets(limited),{tags:{ids:[],names:['容量拒絕']}},today));assert.deepEqual(limited,before);
  const capped=sample();capped.tags[1].revision=MAX_INTEGER;assert.throws(()=>ledger.changeExpenseBatch(capped,targets(capped),{tags:{ids:['t_hidden'],names:[]}},today));
});
test('search offers native batch selection, optional options and a separate explicit confirmation',()=>{
  const html=readFileSync(new URL('../local-first/index.html',import.meta.url),'utf8');
  for(const id of ['batch-select-all','batch-clear','batch-count','batch-form','batch-category','batch-payment','batch-tag-input','batch-tag-options','batch-dialog','batch-summary','batch-confirm','batch-cancel'])assert(html.includes('id="'+id+'"'),'Missing batch control '+id);
  assert(html.includes('全選符合結果'));assert(html.includes('新增標籤'));assert(html.includes('aria-labelledby="batch-title"'));
});
test('batch removes associations only, accepts different old values and skips already-added/absent-removal tags',()=>{
  const state=sample();state.expenses[1].category='交通';state.expenses[1].payment_source_id='p_cash';state.expenses[1].payment_source_name='現金';state.expense_tags=state.expense_tags.filter(row=>row.expense_id!=='e_1');state.expense_tags.push({expense_id:'e_1',tag_id:'t_hidden'});
  const original=structuredClone(state),changed=ledger.changeExpenseBatch(state,targets(state),{tags:{ids:['t_hidden'],names:[]},remove_tag_ids:['t_old']},today);
  assert.deepEqual(state,original);assert.equal(changed.tags.length,2);assert.equal(changed.expense_tags.length,4);assert(changed.expense_tags.every(row=>row.tag_id==='t_hidden'));
  assert.equal(changed.actions.length,3);assert.equal(changed.expenses[1].revision,0);assert.deepEqual(changed.expenses[1],state.expenses[1]);
  for(const change of [{tags:{ids:['t_old'],names:[]},remove_tag_ids:['t_old']},{tags:{ids:[],names:['#原標籤']},remove_tag_ids:['t_old']},{remove_tag_ids:['missing']},{remove_tag_ids:['t_old','t_old']}])assert.throws(()=>ledger.changeExpenseBatch(state,targets(state),change,today));
  const unchanged=ledger.changeExpenseBatch(changed,targets(changed),{tags:{ids:['t_hidden'],names:[]},remove_tag_ids:['t_old']},today);assert.deepEqual(bytes(unchanged),bytes(changed));
  const combined=ledger.changeExpenseBatch(state,targets(state),{category:'購物',payment_source_id:'p_card',tags:{ids:[],names:['追加']},remove_tag_ids:['t_old']},today);assert.equal(combined.actions.length,4);assert.equal(combined.tags.length,3);assert(combined.expenses.every(row=>row.category==='購物'&&row.payment_source_name==='新卡'));assert.doesNotThrow(()=>bytes(combined));
});
test('search interaction has four closed disclosures and separate single/batch actions with one modal form',()=>{
  const html=readFileSync(new URL('../local-first/index.html',import.meta.url),'utf8');
  for(const id of ['search-functions-group','search-categories-group','search-tags-group','search-accounts']){const tag=html.match(new RegExp('<details id="'+id+'"[^>]*>'))?.[0];assert(tag,'Missing disclosure '+id);assert(!/\sopen(?:\s|>)/.test(tag),'Disclosure defaults open');}
  assert(html.includes('id="batch-edit"'));assert(html.includes('id="batch-open"'));assert(html.includes('<dialog id="batch-editor"'));assert(html.includes('id="batch-remove-options"'));assert(!html.includes('id="batch-options"'));
});
test('malformed null tag input cannot accompany a valid classification change',()=>{
  const s=sample(),before=bytes(s);assert.throws(()=>ledger.changeExpenseBatch(s,targets(s),{category:'交通',tags:null},today));assert.deepEqual(bytes(s),before);
  assert.throws(()=>ledger.changeExpenseBatch(s,targets(s),{category:'交通',remove_tag_ids:null},today));
});
test('a maximal expense revision can skip an unchanged tag but still refuses an actual change atomically',()=>{
  const s=sample();s.expenses[0].revision=MAX_INTEGER;const before=bytes(s);
  assert.deepEqual(bytes(ledger.changeExpenseBatch(s,targets(s),{tags:{ids:['t_old'],names:[]}},today)),before);
  assert.throws(()=>ledger.changeExpenseBatch(s,targets(s),{remove_tag_ids:['t_old']},today));assert.deepEqual(bytes(s),before);
});
