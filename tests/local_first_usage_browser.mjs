import * as ledger from '../local-first/ledger.mjs';
import {emptyData,V3_SECTIONS,writeBackup,readBackup} from '../local-first/backup.mjs';
import {metadata,portable,rowKey,STORES,addState} from '../local-first/idb.mjs';
import {endingSoon} from '../local-first/usage.mjs';
import {encryptBackup,decryptBackup} from '../local-first/backup-crypto.mjs';
const lines=[],check=(value,message)=>{if(!value)throw new Error(message);},text=bytes=>new TextDecoder().decode(bytes);
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
const fault=(db,abort=false,method='put')=>({name:db.name,transaction(...args){const tx=db.transaction(...args),original=tx.objectStore.bind(tx);let failed=false;tx.objectStore=name=>{const store=original(name),write=store[method].bind(store);store[method]=(...values)=>{if(!abort)throw new DOMException('private-synthetic','QuotaExceededError');const req=write(...values);req.addEventListener('success',()=>{if(!failed){failed=true;tx.abort();}});return req;};return store;};return tx;}});
let db,peer,target;
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolated source required');
  const run=crypto.randomUUID(),open=indexedDB.open.bind(indexedDB);
  indexedDB.open=(value,version)=>{const isolated=value===ledger.DB_NAME+'-portable-checks',req=open(isolated?value+'-usage-'+run:value,version);if(isolated)req.addEventListener('success',()=>Object.defineProperty(req.result,'name',{value}));return req;};
  const name='usage-'+crypto.randomUUID(),opening=indexedDB.open(name,4);
  opening.onupgradeneeded=()=>{for(const section of [...V3_SECTIONS,'meta'])opening.result.createObjectStore(section,{keyPath:'key'});};
  let old=await request(opening),legacy={format:'local-first-test-ledger',version:4,owner:'local-test-owner',...emptyData(3),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
  let tx=old.transaction([...V3_SECTIONS,'meta'],'readwrite');
  const seed=(transaction,state)=>{for(const section of V3_SECTIONS){const rows=section==='settings'?[state.settings]:state[section];rows.forEach((value,position)=>transaction.objectStore(section).add({key:rowKey(section,value),position,value}));}for(const [key,value] of Object.entries(metadata(state)))transaction.objectStore('meta').add({key,value});};
  seed(tx,legacy);await done(tx);old.close();db=await ledger.openDatabase(name);check(db.version===11&&db.objectStoreNames.length===26,'Schema not upgraded to v11');
  check(text(await ledger.exportPortableBackup(db))===text(writeBackup(portable(legacy))),'Migration changed old bytes');db.close();
  lines.push('v4 to v11 migration preserves old complete backup bytes');
  const corrupt=indexedDB.open(name+'-corrupt',4);corrupt.onupgradeneeded=()=>{for(const section of [...V3_SECTIONS,'meta'])corrupt.result.createObjectStore(section,{keyPath:'key'});};
  old=await request(corrupt);tx=old.transaction([...V3_SECTIONS,'meta'],'readwrite');seed(tx,legacy);tx.objectStore('meta').put({key:'row_count',value:999});await done(tx);old.close();
  let refused=false;try{(await ledger.openDatabase(name+'-corrupt')).close();}catch{refused=true;}check(refused,'Corruption accepted');old=await request(indexedDB.open(name+'-corrupt',4));check(!old.objectStoreNames.contains('usage_periods'),'Failed migration changed schema');old.close();
  lines.push('corrupt migration abort preserves old schema');
  db=await ledger.openDatabase(name);peer=await ledger.openDatabase(name);
  const today=ledger.taiwanToday(),usage={started_on:today,days:7,remind:1,reminder_days:7,show_daily_cost:1,active:1};
  const form={spent_on:today,amount:'100.01',note:'<img src=x onerror=alert(1)>合成商品',category:'餐飲',payment_source_id:'p_cash',usage};
  const rejected=async op=>{const before=text(await ledger.exportPortableBackup(db));let failed=false;try{await op();}catch{failed=true;}check(failed&&text(await ledger.exportPortableBackup(db))===before,'Failure partially committed');};
  await ledger.addExpense(db,form,today,'e_usage');let state=await ledger.readLedger(db);check(state.usage_periods.length===1&&state.expenses.length===1&&state.actions.length===1,'Usage not atomic');
  await rejected(()=>ledger.addExpense(peer,form,today,'e_usage'));
  lines.push('one consumption/action/tracking row; repeated submission ID is refused');
  for(const abort of [false,true])await rejected(()=>ledger.editExpense(fault(db,abort),'e_usage',0,{...form,amount:'.29',usage:{...usage,days:180}},today));
  const race=await Promise.allSettled([ledger.editExpense(peer,'e_usage',0,{...form,spent_on:today.slice(0,7)+'-01',usage:{...usage,days:180}},today),ledger.editExpense(db,'e_usage',0,{...form,usage:{...usage,days:365}},today)]);
  check(race.filter(row=>row.status==='fulfilled').length===1,'Two-page tracking silently overwritten');
  await rejected(()=>ledger.editExpense(db,'e_usage',0,form,today));state=await ledger.readLedger(db);
  check(state.usage_periods[0].started_on===today&&state.usage_periods[0].revision===1&&state.expenses[0].revision===1,'Revision/start mismatch');
  lines.push('start stays explicit; stale peer, quota and request-success abort roll back all data');
  await ledger.editExpense(db,'e_usage',1,{...form,payment_source_id:'',usage:null},today);state=await ledger.readLedger(db);check(state.usage_periods[0].active===0,'Stop lost history');
  await ledger.editExpense(db,'e_usage',2,form,today);await ledger.voidExpense(db,'e_usage',3);state=await ledger.readLedger(db);check(state.usage_periods.length===1&&endingSoon(state,today).length===0,'Voided reminders revived');
  await rejected(()=>ledger.editExpense(peer,'e_usage',4,form,today));
  lines.push('stop and resume retain row; void retains history and suppresses reminders');
  const baseline=text(await ledger.exportPortableBackup(db));endingSoon(state,today);await ledger.readLedger(db);check(text(await ledger.exportPortableBackup(db))===baseline,'Readonly wrote');
  let readFailed=false;try{await ledger.readLedger({transaction(){throw new Error('private-synthetic');}});}catch(error){readFailed=error.code==='storage'&&!error.message.includes('private-synthetic');}
  check(readFailed&&text(await ledger.exportPortableBackup(db))===baseline,'Read failure damaged committed data');
  lines.push('readonly reminder, failed reread and reopen do not change complete backup');
  const legacyUsage=await ledger.exportPortableBackup(db);check(readBackup(legacyUsage).version===4&&Object.keys(readBackup(legacyUsage).data).length===16,'Legacy tracking-only backup changed format');check(text(await decryptBackup(await encryptBackup(legacyUsage,'synthetic-usage-password'),'synthetic-usage-password'))===text(legacyUsage),'Legacy encrypted v4 bytes changed');
  const scheduledIDs=[];
  for(const [index,kind] of ['固定','訂閱','分期'].entries()){
    const id='r_usage_'+index;scheduledIDs.push(id);
    await ledger.updateSchedule(db,'add',id,null,{kind,name:'合成'+kind,amount:'.29',category:'餐飲',payment_source_id:'p_cash',first_due_on:today,unit:'month',every:1,periods:kind==='分期'?2:0});
    await ledger.processSchedule(db,'record',id,0,0,null);
  }state=await ledger.readLedger(db);
  for(const entry of state.expenses.filter(row=>row.source!=='manual')) {
    const change={...form,spent_on:entry.spent_on,payment_source_id:'',usage:{...usage,days:1}};
    await rejected(()=>ledger.editExpense(db,entry.id,0,{...change,spent_on:today.slice(0,7)+'-02'},today));
    await ledger.editExpense(db,entry.id,0,change,today);await ledger.voidExpense(db,entry.id,1);
  }
  const beforeSync=text(await ledger.exportPortableBackup(db));
  for(const id of scheduledIDs){let refused=false;try{await ledger.processSchedule(db,'record',id,0,0,null);}catch(error){refused=error.code==='unavailable';}check(refused,'Voided scheduled period accepted another record');}
  check(text(await ledger.exportPortableBackup(db))===beforeSync,'Voided source rebuilt');
  check(endingSoon(await ledger.readLedger(db),today).filter(row=>row.kind==='usage').length===0,'Voided automatic usage shown');
  lines.push('four sources retain date and relationship rules; voided automatic tracking cannot revive on posting');
  const cap=await ledger.openDatabase('usage-limit-'+crypto.randomUUID()),limited={...emptyData(4),format:'local-first-test-ledger',version:5,owner:'local-test-owner',payment_sources:[{id:'p_cash',name:'現金',active:1}],expenses:[(await ledger.readLedger(db)).expenses[0]]};
  limited.expenses[0]={...limited.expenses[0],voided:0};
  limited.actions=Array.from({length:99998},(_,i)=>({id:'a_limit_'+i,expense_id:limited.expenses[0].id,before:null,undone:0}));
  tx=cap.transaction(STORES,'readwrite');addState(tx,limited);await done(tx);
  const capBefore=text(await ledger.exportPortableBackup(cap));let capacity=false;
  try{await ledger.editExpense(cap,limited.expenses[0].id,limited.expenses[0].revision,form,today);}catch{capacity=true;}
  check(capacity&&text(await ledger.exportPortableBackup(cap))===capBefore,'Row boundary partially committed');cap.close();
  lines.push('100000-row boundary refuses consumption/action/tracking atomically');
  const payload=await ledger.exportPortableBackup(db),encrypted=await encryptBackup(payload,'synthetic-usage-password');check(readBackup(payload).version===6&&Object.keys(readBackup(payload).data).length===19,'Tracking or schedules omitted');
  const decoded=await decryptBackup(encrypted,'synthetic-usage-password');check(text(decoded)===text(payload),'Encrypted bytes mismatch');
  target=await ledger.openDatabase(ledger.DB_NAME+'-portable-checks');
  for(const abort of [false,true]){let failed=false;try{await ledger.restorePortableBackup(fault(target,abort,'add'),decoded);}catch{failed=true;}check(failed&&await ledger.readLedgerIfPresent(target)===null,'Restore left partial state');}
  await ledger.restorePortableBackup(target,decoded);check(text(await ledger.exportPortableBackup(target))===text(payload),'Complete restore mismatch');
  lines.push('legacy v4 encrypted bytes preserved; scheduled v6 nineteen-section restore is atomic and exact');
  db.close();db=await ledger.openDatabase(name);check(text(await ledger.exportPortableBackup(db))===text(payload),'Reopen mismatch');
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組使用期間原生交易驗證\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db?.close();peer?.close();target?.close();}
