import {emptyData,V5_SECTIONS,writeBackup} from '../local-first/backup.mjs';
import {openLedgerDatabase,readSnapshot,metadata,portable,rowKey,STORES,addState} from '../local-first/idb.mjs';

const check=(value,message)=>{if(!value)throw new Error(message);},text=bytes=>new TextDecoder().decode(bytes);
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
const lines=[],connections=[];
const oldStores=[...V5_SECTIONS,'meta'];
const oldState=()=>({format:'local-first-test-ledger',version:6,owner:'local-test-owner',...emptyData(5),
  categories:[{name:'餐飲',active:1}],payment_sources:[{id:'p_cash',name:'現金',active:1}],
  recurring_rules:[{id:'r_old',name:'合成月付',cents:'29',category:'餐飲',kind:'訂閱',start_month:'2026-10',periods:0,due_day:7,active:1,revision:0}],
  recurring_versions:[{id:'v_old',recurring_id:'r_old',effective_month:'2026-10',name:'合成月付',cents:'29',category:'餐飲',due_day:7}],
  expenses:[{id:'e_old',spent_on:'2026-10-07',cents:'29',category:'餐飲',note:'合成原始消費',source:'訂閱',recurring_id:'r_old',period:'2026-10',voided:1,payment_source_id:null,payment_source_name:'未指定',kind:'consumption',revision:2}],
  actions:[{id:'a_old',expense_id:'e_old',before:{id:'e_old',spent_on:'2026-10-07',cents:'29',category:'餐飲',note:'合成歷史快照',source:'訂閱',recurring_id:'r_old',period:'2026-10',voided:0,payment_source_id:null,payment_source_name:'未指定',kind:'consumption',revision:1},undone:0}],
  tags:[{id:'t_old',name:'合成標籤',hidden:0,revision:0}],expense_tags:[{expense_id:'e_old',tag_id:'t_old'}],
});
async function createOld(name,corrupt) {
  const opening=indexedDB.open(name,6);
  opening.onupgradeneeded=()=>{for(const section of oldStores)opening.result.createObjectStore(section,{keyPath:'key'});};
  const db=await request(opening),state=oldState(),tx=db.transaction(oldStores,'readwrite');
  for(const section of V5_SECTIONS) {
    const rows=section==='settings'?[state.settings]:state[section];
    rows.forEach((value,position)=>tx.objectStore(section).add({key:rowKey(section,value),position,value}));
  }
  for(const[key,value]of Object.entries(metadata(state)))tx.objectStore('meta').add({key,value});
  if(corrupt==='meta')tx.objectStore('meta').put({key:'row_count',value:999});
  if(corrupt==='row')tx.objectStore('expenses').put({key:'e_old',position:0,value:{...state.expenses[0],spent_on:'2026-11-01'}});
  if(corrupt==='key')tx.objectStore('recurring_versions').put({key:['r_old','2026-11'],position:0,value:state.recurring_versions[0]});
  await done(tx);
  return {db,state};
}
async function raw(db) {
  const tx=db.transaction(oldStores,'readonly');
  const records=await Promise.all(oldStores.map(section=>request(tx.objectStore(section).getAll())));
  return JSON.stringify(records);
}
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolation required');
  const name='life-schedule-migration-'+crypto.randomUUID();
  let {db:old,state}=await createOld(name),before=await raw(old),payload=text(writeBackup(portable(state)));
  old.close();const db=await openLedgerDatabase(name);connections.push(db);
  const snapshot=await readSnapshot(db);
  check(db.version===10&&snapshot.version===10&&db.objectStoreNames.length===25,'Schema not upgraded to twenty-five stores');
  check(snapshot.scheduled_periods.length===0&&snapshot.recurring_versions.length===1,'Migration manufactured schedule rows or versions');
  check(await raw(db)===before&&text(writeBackup(portable(snapshot)))===payload,'Migration rewrote original rows, metadata or backup bytes');
  lines.push('v6 to v10 adds empty schedule, goal and recurring-income stores; all original records, keys, positions, metadata and JSON v5 bytes are identical');
  db.close();const reopened=await openLedgerDatabase(name);connections.push(reopened);
  check(text(writeBackup(portable(await readSnapshot(reopened))))===payload,'Reopen changed old bytes');
  lines.push('v10 reopen retains old source links, voided consumption and action snapshots');
  for(const corrupt of ['meta','row','key']) {
    const invalidName=name+'-'+corrupt,seed=await createOld(invalidName,corrupt);
    old=seed.db;before=await raw(old);old.close();let refused=false;
    try{(await openLedgerDatabase(invalidName)).close();}catch{refused=true;}
    old=await request(indexedDB.open(invalidName,6));
    check(refused&&old.version===6&&old.objectStoreNames.length===19&&!old.objectStoreNames.contains('scheduled_periods'),'Corrupt '+corrupt+' upgrade changed old schema');
    check(await raw(old)===before,'Corrupt '+corrupt+' upgrade rewrote original bytes');old.close();
  }
  lines.push('corrupt metadata, legacy cross-month consumption and incorrect version keys abort upgrade and preserve every old record and store');
  const fresh=await openLedgerDatabase(name+'-fresh');connections.push(fresh);
  const current={...state,...emptyData(6),version:7,payment_sources:state.payment_sources,recurring_rules:state.recurring_rules,
    recurring_versions:[{id:'v_daily',recurring_id:'r_old',from_index:0,first_due_on:'2026-10-07',unit:'day',every:1,name:'合成新名稱',cents:'29',category:'餐飲',payment_source_id:null,payment_source_name:'未指定'}],
    scheduled_periods:[{rule_id:'r_old',index:3652058,defaults:{due_on:'9999-12-31',name:'合成草稿',cents:'29',category:'餐飲',payment_source_id:null,payment_source_name:'未指定'},status:'pending',expense_id:null,revision:0}]};
  const tx=fresh.transaction(STORES,'readwrite');addState(tx,current);await done(tx);
  const restored=await readSnapshot(fresh),encoded=text(writeBackup(portable(current)));
  check(restored.version===10&&text(writeBackup(portable(restored)))===encoded,'New schedule store cannot roundtrip maximal index or null payment');
  check(portable(restored).version===6&&Object.keys(portable(restored).data).length===19,'Generic version or schedule omitted from JSON v6');
  lines.push('native v7 generic version and maximal safe period index roundtrip with null legacy payment snapshots');
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組排程原生升級\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');}
finally{for(const connection of connections)connection.close();}
