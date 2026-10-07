import * as ledger from '../local-first/ledger.mjs';
import {V4_SECTIONS,emptyData,writeBackup,readBackup} from '../local-first/backup.mjs';
import {STORES,rowKey,metadata,portable,addState} from '../local-first/idb.mjs';
import {tagReport,monthBudget} from '../local-first/browse.mjs';
import {encryptBackup,decryptBackup} from '../local-first/backup-crypto.mjs';
const check=(value,message)=>{if(!value)throw new Error(message);},text=bytes=>new TextDecoder().decode(bytes);
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);}),request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const today=ledger.taiwanToday(),name='life-tags-'+crypto.randomUUID(),lines=[];let db,peer,target;
const form={spent_on:today,amount:'1000',note:'合成消費',category:'餐飲',payment_source_id:'p_cash',tags:{ids:[],names:['日本旅行','聚餐','公帳','末尾']}};
const fault=(connection,abort=false,method='put')=>({name:connection.name,transaction(...args){const tx=connection.transaction(...args),store=tx.objectStore.bind(tx);let n=0;tx.objectStore=section=>{const object=store(section),original=object[method].bind(object);object[method]=(...values)=>{if(++n===2){if(!abort)throw new DOMException('PRIVATE','QuotaExceededError');const req=original(...values);req.addEventListener('success',()=>tx.abort());return req;}return original(...values);};return object;};return tx;}});
const bytes=connection=>ledger.exportPortableBackup(connection).then(text);
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolation required');
  const oldOpen=indexedDB.open(name,5);oldOpen.onupgradeneeded=()=>{for(const store of [...V4_SECTIONS,'meta'])oldOpen.result.createObjectStore(store,{keyPath:'key'});};
  const old=await request(oldOpen),legacy={format:'local-first-test-ledger',version:5,owner:'local-test-owner',...emptyData(4),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
  const seedOld=tx=>{for(const section of V4_SECTIONS){const rows=section==='settings'?[legacy.settings]:legacy[section];rows.forEach((value,position)=>tx.objectStore(section).add({key:rowKey(section,value),position,value}));}for(const[key,value]of Object.entries(metadata(legacy)))tx.objectStore('meta').add({key,value});};
  let tx=old.transaction([...V4_SECTIONS,'meta'],'readwrite');seedOld(tx);await done(tx);old.close();db=await ledger.openDatabase(name);peer=await ledger.openDatabase(name);
  check(db.version===6&&await bytes(db)===text(writeBackup(portable(legacy))),'Migration lost old backup');lines.push('v5 to v6 adds empty tag stores and preserves original bytes');
  const corrupt=indexedDB.open(name+'-corrupt',5);corrupt.onupgradeneeded=()=>{for(const store of [...V4_SECTIONS,'meta'])corrupt.result.createObjectStore(store,{keyPath:'key'});};
  let invalidOld=await request(corrupt);tx=invalidOld.transaction([...V4_SECTIONS,'meta'],'readwrite');seedOld(tx);tx.objectStore('meta').put({key:'row_count',value:999});await done(tx);invalidOld.close();
  let migrationRefused=false;try{(await ledger.openDatabase(name+'-corrupt')).close();}catch{migrationRefused=true;}
  invalidOld=await request(indexedDB.open(name+'-corrupt',5));check(migrationRefused&&invalidOld.version===5&&!invalidOld.objectStoreNames.contains('tags')&&!invalidOld.objectStoreNames.contains('expense_tags'),'Corrupt migration changed old schema');invalidOld.close();lines.push('corrupt v5 migration refuses and rolls back both new stores');
  const before=await bytes(db);let invalid=false;try{await ledger.addExpense(db,{...form,amount:'0'},today,'e_bad');}catch{invalid=true;}check(invalid&&await bytes(db)===before,'Invalid expense created labels');
  for(const abort of [false,true]){let rejected=false;try{await ledger.addExpense(fault(db,abort),form,today,'e_failed');}catch(error){rejected=!error.message.includes('PRIVATE');}check(rejected&&await bytes(db)===before,'Failed add left tag or expense');}
  await ledger.addExpense(db,form,today,'e_one');let state=await ledger.readLedger(db);check(state.tags.length===4&&state.expense_tags.length===4&&state.actions.length===1,'Incomplete tagged add');
  lines.push('invalid/quota/request-success abort leaves no tags; success commits consumption, action and all labels once');
  const middle=state.tags[1];await ledger.updateTag(db,'remove',middle.id,middle.revision);state=await ledger.readLedger(db);
  check(state.tags.length===3&&state.expense_tags.length===3&&state.expenses.length===1&&state.expenses[0].cents==='100000','Global removal lost surviving rows');lines.push('middle tag deletion preserves other tags, links and original consumption');
  const tag=state.tags[0],races=await Promise.allSettled([ledger.updateTag(db,'hide',tag.id,tag.revision),ledger.updateTag(peer,'hide',tag.id,tag.revision)]);
  check(races.filter(row=>row.status==='fulfilled').length===1,'Hidden-state peer overwrite');state=await ledger.readLedger(db);
  await ledger.addExpense(db,{...form,tags:{ids:[],names:['#日本旅行']}},today,'e_two');state=await ledger.readLedger(db);check(state.tags.length===3&&state.tags.find(row=>row.id===tag.id).hidden===1,'Hidden full name duplicated or unhidden');
  const revision=state.expenses[0].revision,snapshot=await bytes(db),current=state.tags.find(row=>row.id===tag.id);
  for(const abort of [false,true]){let rejected=false;try{await ledger.updateTag(fault(db,abort,'delete'),'remove',tag.id,current.revision);}catch{rejected=true;}check(rejected&&await bytes(db)===snapshot,'Global removal partially committed');}
  await ledger.updateTag(db,'remove',tag.id,current.revision);let stale=false;try{await ledger.editExpense(peer,'e_one',revision,{...form,tags:{ids:[],names:[]}},today);}catch(error){stale=error.code==='conflict';}check(stale,'Removal did not invalidate old expense draft');
  lines.push('one-winner hide, hidden reuse, global-remove abort and stale consumption revision protection');
  for(const kind of ['固定','訂閱','分期'])await ledger.updateRecurring(db,'add',null,null,{kind,name:'合成'+kind,amount:'.29',category:'餐飲',start_month:today.slice(0,7),due_day:1,periods:kind==='分期'?2:0});await ledger.updateRecurring(db,'sync');state=await ledger.readLedger(db);
  for(const entry of state.expenses.filter(row=>row.source!=='manual'))await ledger.editExpense(db,entry.id,entry.revision,{...form,amount:'.29',spent_on:entry.spent_on,payment_source_id:'',tags:{ids:[],names:['事後標記']}},today);
  state=await ledger.readLedger(db);const shared=state.tags.find(row=>row.name==='事後標記');check(tagReport(state,{tag_id:shared.id,start:'',end:''},today).total===87n,'Four-source tag totals wrong');
  const automatic=state.expenses.find(row=>row.source==='分期');await ledger.voidExpense(db,automatic.id,automatic.revision);state=await ledger.readLedger(db);check(tagReport(state,{tag_id:shared.id,start:'',end:''},today).total===58n,'Voided tag included');
  await ledger.updateRecurring(db,'sync');state=await ledger.readLedger(db);check(state.expenses.filter(row=>row.recurring_id===automatic.recurring_id&&row.period===automatic.period).length===1,'Voided period revived');
  const pure=await bytes(db);tagReport(state,{tag_id:shared.id,start:today,end:today},today);monthBudget(state,today);check(await bytes(db)===pure,'Read-only query wrote');lines.push('automatic dates/identity intact, four-source marking, void exclusion, no revival and readonly exact totals');
  const payload=await ledger.exportPortableBackup(db),encrypted=await encryptBackup(payload,'synthetic-tag-password'),decoded=await decryptBackup(encrypted,'synthetic-tag-password');check(readBackup(decoded).version===5&&Object.keys(readBackup(decoded).data).length===18,'Tag backup omitted sections');
  target=await ledger.openDatabase('life-tags-restore-'+crypto.randomUUID());Object.defineProperty(target,'name',{value:ledger.DB_NAME+'-portable-checks'});
  for(const abort of [false,true]){let refused=false;try{await ledger.restorePortableBackup(fault(target,abort,'add'),decoded);}catch{refused=true;}check(refused&&await ledger.readLedgerIfPresent(target)===null,'Restore left partial tags');}
  await ledger.restorePortableBackup(target,decoded);check(await bytes(target)===text(payload),'Encrypted roundtrip changed fields or order');lines.push('JSON v5 encrypted eighteen-section blank restore is atomic and exact');
  const cap=await ledger.openDatabase('life-tags-cap-'+crypto.randomUUID()),limited={...emptyData(5),format:'local-first-test-ledger',version:6,owner:'local-test-owner',categories:Array.from({length:99999},(_,i)=>({name:'c'+i,active:0})),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
  tx=cap.transaction(STORES,'readwrite');addState(tx,limited);await done(tx);const capBefore=await bytes(cap);let refused=false;try{await ledger.updateTag(cap,'add','t_cap',null,'超限');}catch{refused=true;}check(refused&&await bytes(cap)===capBefore,'Capacity partially created tag');cap.close();lines.push('100000-row capacity boundary refuses all writes without partial metadata');
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組標籤原生交易\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db?.close();peer?.close();target?.close();}
