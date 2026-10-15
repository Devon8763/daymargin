import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyData,readBackup,writeBackup,validateBackup,BackupError,MAX_INTEGER} from '../web/backup.mjs';
import {portable,rowKey,metadata} from '../web/idb.mjs';

const bundle=()=>({format:'life-ledger-backup',version:6,data:{...emptyData(5),scheduled_periods:[]}});
const defaults=(due_on='2026-10-07')=>({due_on,name:'合成費用',cents:'29',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金'});
function sample() {
  const value=bundle(),d=value.data;
  d.payment_sources=[{id:'p_cash',name:'現金',active:1}];
  d.recurring_rules=[{id:'r_daily',name:'合成費用',cents:'29',category:'餐飲',kind:'固定',start_month:'2026-10',periods:0,due_day:7,active:1,revision:0}];
  d.recurring_versions=[{id:'v_daily',recurring_id:'r_daily',from_index:0,first_due_on:'2026-10-07',unit:'day',every:1,...Object.fromEntries(Object.entries(defaults()).filter(([key])=>key!=='due_on'))}];
  d.expenses=[0,1].map(index=>({id:'e_'+index,spent_on:index?'2026-11-01':'2026-10-07',cents:'29',category:'餐飲',note:'合成資料',source:'固定',recurring_id:'r_daily',period:'2026-10',voided:index, payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0}));
  d.scheduled_periods=[0,1].map(index=>({rule_id:'r_daily',index,defaults:defaults(index?'2026-10-08':'2026-10-07'),status:'recorded',expense_id:'e_'+index,revision:0}));
  d.actions=[{id:'a_one',expense_id:'e_1',before:{...d.expenses[1],spent_on:'2026-12-01'},undone:0}];
  return value;
}
const rejects=(source,mutate)=>{const value=structuredClone(source);mutate(value.data,value);assert.throws(()=>validateBackup(value),BackupError);};

test('new period cannot turn an existing recorded annual period back into pending or relink it',()=>{
  const value=bundle(),d=value.data;d.payment_sources=[{id:'p_cash',name:'現金',active:1}];
  d.annual_rules=[{id:'y_old',...Object.fromEntries(Object.entries(defaults()).filter(([key])=>key!=='due_on')),first_year:2026,due_month:10,due_day:7,effective_month:'2026-10',active:1,revision:0}];
  d.expenses=[{id:'e_old',spent_on:'2026-10-07',cents:'29',category:'餐飲',note:'合成',source:'manual',recurring_id:null,period:null,voided:1,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:1}];
  d.annual_periods=[{annual_id:'y_old',year:2026,defaults:defaults(),status:'recorded',expense_id:'e_old',revision:0}];
  d.scheduled_periods=[{rule_id:'y_old',index:0,defaults:defaults(),status:'recorded',expense_id:'e_old',revision:0}];assert.doesNotThrow(()=>validateBackup(value));
  rejects(value,data=>{data.scheduled_periods[0].status='pending';data.scheduled_periods[0].expense_id=null;});
  rejects(value,data=>{data.scheduled_periods[0].defaults.due_on='2026-10-08';});
});
test('new period cannot hide an unlinked legacy monthly recorded identity or revive a voided period',()=>{
  const value=bundle(),d=value.data;d.payment_sources=[{id:'p_cash',name:'現金',active:1}];
  d.recurring_rules=[{id:'r_old',name:'合成費用',cents:'29',category:'餐飲',kind:'固定',start_month:'2026-10',periods:0,due_day:7,active:1,revision:0}];
  d.expenses=[{id:'e_old',spent_on:'2026-10-07',cents:'29',category:'餐飲',note:'合成',source:'固定',recurring_id:'r_old',period:'2026-10',voided:1,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:1}];
  d.scheduled_periods=[{rule_id:'r_old',index:0,defaults:defaults(),status:'pending',expense_id:null,revision:0}];
  assert.throws(()=>validateBackup(value),BackupError);
  d.scheduled_periods[0].status='skipped';assert.throws(()=>validateBackup(value),BackupError);
  d.scheduled_periods=[];assert.doesNotThrow(()=>validateBackup(value));
  d.scheduled_periods=[{rule_id:'r_old',index:0,defaults:defaults(),status:'recorded',expense_id:'e_old',revision:0}];assert.doesNotThrow(()=>validateBackup(value));
});

test('JSON v6 preserves nineteen sections, day/week same-month periods, cross-month actual dates and before snapshots',()=>{
  assert.equal(Object.keys(emptyData(6)).length,19);
  for(const unit of ['day','week','month','year']) {
    const value=sample();value.data.recurring_versions[0].unit=unit;
    assert.deepEqual(readBackup(writeBackup(value)),value);
    assert.equal(portable(value.data).version,6);
    assert.equal(Object.keys(portable(value.data).data).length,19);
  }
  assert.deepEqual(rowKey('scheduled_periods',{rule_id:'r_daily',index:2}),['r_daily',2]);
  assert.deepEqual(rowKey('scheduled_periods',{rule_id:'r_daily',index:3652058}),['r_daily',3652058]);
  assert.deepEqual(rowKey('recurring_versions',sample().data.recurring_versions[0]),['r_daily',0]);
  assert.equal(metadata(sample().data).row_count,8);
});

test('old v1..v5 portable payloads retain exact bytes and no empty scheduled section forces v6',()=>{
  const fixture=readBackup(readFileSync(new URL('fixtures/portable_life_ledger.json',import.meta.url)));
  for(let version=1;version<=5;version++) {
    const value={...fixture,version,data:{...emptyData(version),...fixture.data}};
    if(version===2)value.data.incomes=[{id:'i_one',received_on:'2026-01-01',cents:'1',name:'合成收入',voided:0,revision:0}];
    if(version===3)value.data.annual_rules=[{id:'ar_one',...Object.fromEntries(Object.entries(defaults()).filter(([key])=>key!=='due_on')),payment_source_id:value.data.payment_sources[0].id,first_year:2026,due_month:10,due_day:7,effective_month:'2026-01',active:1,revision:0}];
    if(version===4)value.data.usage_periods=[{expense_id:value.data.expenses[0].id,started_on:'2026-01-01',days:1,remind:0,reminder_days:0,show_daily_cost:0,active:1,revision:0}];
    if(version===5)value.data.tags=[{id:'t_one',name:'合成標籤',hidden:0,revision:0}];
    const original=writeBackup(value),state={...emptyData(6),...value.data};
    assert.deepEqual(readBackup(original),value);
    assert.deepEqual(writeBackup(portable(state)),original);
    const injected={...value,data:{...value.data,scheduled_periods:[]}};
    assert.throws(()=>validateBackup(injected),BackupError);
    rejects(value,d=>d.recurring_versions.push({...sample().data.recurring_versions[0],id:'v_injected',recurring_id:d.recurring_rules[0].id}));
  }
  const genericOnly=sample();genericOnly.data.scheduled_periods=[];genericOnly.data.expenses=[];genericOnly.data.actions=[];
  assert.equal(portable(genericOnly.data).version,6);
});

test('v6 refuses malformed periods, duplicate or missing links, invalid variants and legacy authorization bypasses',()=>{
  const value=sample();
  const mutations=[
    d=>d.scheduled_periods.push({...d.scheduled_periods[0]}),
    d=>d.scheduled_periods[1].expense_id='e_0',d=>d.scheduled_periods[0].expense_id='missing',
    d=>d.scheduled_periods[0].rule_id='missing',d=>d.scheduled_periods[0].index=-1,
    d=>d.scheduled_periods[0].index=Number.MAX_SAFE_INTEGER+1,d=>d.scheduled_periods[0].index=3652059,
    d=>d.scheduled_periods[0].status='upcoming',d=>d.scheduled_periods[0].status='pending',
    d=>d.scheduled_periods[0].defaults.due_on='2026-02-30',d=>d.scheduled_periods[0].defaults.cents='0',
    d=>d.scheduled_periods[0].defaults.name='\0',d=>d.scheduled_periods[0].defaults.payment_source_id='missing',
    d=>d.scheduled_periods[0].defaults.payment_source_name='',d=>d.scheduled_periods[0].defaults.category='',
    d=>d.scheduled_periods[0].defaults.cents='9223372036854775808',d=>d.scheduled_periods[0].revision=-1,
    d=>d.scheduled_periods[1].defaults.due_on='2026-11-01',d=>d.expenses[1].recurring_id=null,
    d=>d.expenses[1].source='manual',d=>d.scheduled_periods.pop(),
    d=>{d.scheduled_periods=[];d.expenses[1].spent_on='2026-10-08';d.actions=[];},
    d=>d.recurring_versions[0].unit='quarter',d=>d.recurring_versions[0].every=0,
    d=>d.recurring_versions[0].every=9007199254740992n,d=>d.recurring_versions[0].from_index=3652059,
    d=>d.recurring_versions[0].first_due_on='0000-01-01',d=>d.recurring_versions[0].recurring_id='missing',
    d=>d.recurring_versions[0].payment_source_id='missing',d=>d.recurring_versions[0].cents='01',
    d=>d.recurring_versions.push({...d.recurring_versions[0],id:'v_duplicate'}),
    d=>d.recurring_versions[0].id='e_0',d=>d.recurring_versions[0].effective_month='2026-10',
    d=>d.actions[0].before.period='2026-11',
  ];
  for(const mutate of mutations)rejects(value,mutate);
  const legacy=readBackup(readFileSync(new URL('fixtures/portable_life_ledger.json',import.meta.url)));
  legacy.version=6;legacy.data={...emptyData(6),...legacy.data};
  assert.doesNotThrow(()=>validateBackup(legacy));
  rejects(legacy,d=>d.expenses.find(row=>row.recurring_id!==null).spent_on='2026-11-01');
  rejects(legacy,d=>{const entry=d.expenses.find(row=>row.recurring_id!==null);d.expenses.push({...entry,id:'e_duplicate'});});
  rejects(legacy,d=>{d.recurring_versions[0].recurring_id=d.recurring_rules.find(row=>row.kind==='訂閱').id;});
});

test('pending, skipped, large indices and annual history coexist without orphan or cross-source references',()=>{
  const value=sample(),d=value.data;
  d.scheduled_periods.push({rule_id:'r_daily',index:3652058,defaults:{...defaults(),payment_source_id:null},status:'pending',expense_id:null,revision:MAX_INTEGER});
  d.scheduled_periods.push({rule_id:'r_daily',index:2,defaults:defaults(),status:'skipped',expense_id:null,revision:0});
  d.annual_rules=[{id:'ar_one',...Object.fromEntries(Object.entries(defaults()).filter(([key])=>key!=='due_on')),first_year:2026,due_month:10,due_day:7,effective_month:'2026-01',active:1,revision:0}];
  d.recurring_versions.push({...d.recurring_versions[0],id:'v_annual',recurring_id:'ar_one',unit:'year'});
  d.expenses.push({...d.expenses[0],id:'e_annual',source:'manual',recurring_id:null,period:null});
  d.scheduled_periods.push({rule_id:'ar_one',index:0,defaults:defaults(),status:'recorded',expense_id:'e_annual',revision:0});
  d.annual_periods=[{annual_id:'ar_one',year:2026,defaults:defaults(),status:'recorded',expense_id:'e_annual',revision:0}];
  assert.deepEqual(readBackup(writeBackup(value)),value);
  rejects(value,x=>{x.annual_periods[0].year=2027;x.annual_periods[0].defaults.due_on='2027-10-07';});
  rejects(value,x=>{x.annual_rules.push({...x.annual_rules[0],id:'ar_two'});x.annual_periods[0].annual_id='ar_two';});
  rejects(value,x=>x.scheduled_periods.at(-1).expense_id='e_0');
  rejects(value,x=>x.scheduled_periods[2].expense_id='e_0');
  const installment=sample();installment.data.recurring_rules[0].kind='分期';installment.data.recurring_rules[0].periods=1;installment.data.expenses.forEach(row=>row.source='分期');installment.data.actions[0].before.source='分期';
  assert.throws(()=>validateBackup(installment),BackupError);
  installment.data.recurring_rules[0].periods=2;
  assert.doesNotThrow(()=>validateBackup(installment));
  const subscription=sample();subscription.data.recurring_rules[0].kind='訂閱';subscription.data.expenses.forEach(row=>row.source='訂閱');subscription.data.actions[0].before.source='訂閱';
  subscription.data.recurring_versions[0].name='合成更名';subscription.data.recurring_versions[0].payment_source_id=null;
  assert.doesNotThrow(()=>validateBackup(subscription));
});

test('v6 retains total row and backup byte capacity limits',()=>{
  const value=sample();value.data.scheduled_periods.push(...Array.from({length:99994},(_,i)=>({rule_id:'r_daily',index:i+2,defaults:defaults(),status:'pending',expense_id:null,revision:0})));
  assert.throws(()=>validateBackup(value),BackupError);
  assert.throws(()=>readBackup(new Uint8Array(64*1024*1024+1)),BackupError);
});
