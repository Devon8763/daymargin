import * as ledger from '../local-first/ledger.mjs';
import {emptyData,V7_SECTIONS,writeBackup,readBackup} from '../local-first/backup.mjs';
import {rowKey,metadata} from '../local-first/idb.mjs';
import {recurringIncomeItems} from '../local-first/income.mjs';
import {encryptBackup,decryptBackup} from '../local-first/backup-crypto.mjs';
const check=(value,message)=>{if(!value)throw new Error(message);},lines=[];
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
const opened=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=reject;});
const name='recurring-income-'+crypto.randomUUID(),today=ledger.taiwanToday(),month=today.slice(0,7);
let db,peer,target;
try{
  check(location.hostname==='127.0.0.1'&&Number(location.port)>19000,'isolated source required');
  const request=indexedDB.open(name,8);request.onupgradeneeded=()=>{for(const section of [...V7_SECTIONS,'meta'])request.result.createObjectStore(section,{keyPath:'key'});};
  const old=await opened(request),state={...emptyData(7),format:'local-first-test-ledger',version:8,owner:'local-test-owner'};
  const tx=old.transaction([...V7_SECTIONS,'meta'],'readwrite');for(const section of V7_SECTIONS)for(const [position,row]of(section==='settings'?[state.settings]:state[section]).entries())tx.objectStore(section).add({key:rowKey(section,row),position,value:row});
  for(const [key,value]of Object.entries(metadata(state)))tx.objectStore('meta').add({key,value});await done(tx);old.close();
  db=await ledger.openDatabase(name);peer=await ledger.openDatabase(name);check(db.version===10,'v10 schema');
  const bytes=database=>ledger.exportPortableBackup(database).then(value=>new TextDecoder().decode(value));
  check(await bytes(db)===new TextDecoder().decode(writeBackup({format:'life-ledger-backup',version:1,data:emptyData(1)})),'migration changed old backup');lines.push('v8 to v10 creates two empty stores atomically, retains original rows and metadata');
  await ledger.updateIncomeRule(db,'add','ir_one',null,{name:'合成<img src=x onerror=alert(1)>',amount:'.29',first_due_on:month+'-01',due_day:1});
  const before=await bytes(db);recurringIncomeItems(await ledger.readLedger(db),today);check(await bytes(db)===before,'readonly posts income');
  const races=await Promise.allSettled([ledger.processIncomePeriod(db,'ir_one',month,0,null,'record'),ledger.processIncomePeriod(peer,'ir_one',month,0,null,'record')]);
  check(races.filter(row=>row.status==='fulfilled').length===1,'race duplicate');check((await ledger.readLedger(db)).incomes.length===1,'missing/duplicate income');lines.push('readonly drafts never post; two connections confirm with exactly one atomic winner');
  const reject=async task=>{const original=await bytes(db);let failed=false;try{await task();}catch{failed=true;}check(failed&&await bytes(db)===original,'partial change');};
  await reject(()=>ledger.processIncomePeriod(peer,'ir_one',month,0,null,'record'));
  const income=(await ledger.readLedger(db)).incomes[0];await ledger.updateIncome(db,'void',income.id,0,null);await reject(()=>ledger.processIncomePeriod(db,'ir_one',month,0,0,'record'));lines.push('duplicate, stale and voided recorded periods cannot re-create income');
  const ruleForm={name:'合成往後收入',amount:'.30',first_due_on:month+'-01',due_day:1};
  const ruleRaces=await Promise.allSettled([ledger.updateIncomeRule(db,'update','ir_one',0,ruleForm),ledger.updateIncomeRule(peer,'update','ir_one',0,{...ruleForm,amount:'.31'})]);
  check(ruleRaces.filter(row=>row.status==='fulfilled').length===1,'rule revision race');check((await ledger.readLedger(db)).incomes.length===1,'rule change posted');lines.push('two rule edits with old revision have one winner, never overwrite recorded income');
  await ledger.updateIncomeRule(db,'add','ir_two',null,{name:'合成第二收入',amount:'.30',first_due_on:month+'-01',due_day:1});
  const fault=(abort,after=2)=>({name:db.name,transaction(...args){const tx=db.transaction(...args),objectStore=tx.objectStore.bind(tx);let writes=0;tx.objectStore=key=>{const store=objectStore(key),put=store.put.bind(store);store.put=(...values)=>{const request=put(...values);if(++writes===after){if(abort)request.addEventListener('success',()=>tx.abort());else throw new DOMException('synthetic-private','QuotaExceededError');}return request;};return store;};return tx;}});
  for(const abort of [false,true]){
    await reject(()=>ledger.processIncomePeriod(fault(abort),'ir_two',month,0,null,'record'));
    await reject(()=>ledger.updateIncomeRule(fault(abort),'disable','ir_two',0,null));
  }
  lines.push('mid-write quota and request-success abort roll back income, action, period, rule and metadata');
  await ledger.processIncomePeriod(db,'ir_two',month,0,null,'skip');await ledger.processIncomePeriod(db,'ir_two',month,0,0,'restore');await ledger.updateIncomeRule(db,'disable','ir_two',0,null);
  await ledger.processIncomePeriod(db,'ir_two',month,1,1,'record');check((await ledger.readLedger(db)).incomes.length===2,'stopped pending lost');lines.push('skip/restoration and disable preserve overdue draft; explicit confirmation still possible');
  const payload=await ledger.exportPortableBackup(db);check(readBackup(payload).version===8,'backup omits recurring income');const password='synthetic-income-password';
  const first=await encryptBackup(payload,password),second=await encryptBackup(payload,password);check(new TextDecoder().decode(first)!==new TextDecoder().decode(second),'random parameters reused');
  let failed=false;try{await decryptBackup(first,'wrong');}catch{failed=true;}check(failed,'wrong password accepted');
  target=await ledger.openDatabase(ledger.DB_NAME+'-portable-checks');await ledger.restorePortableBackup(target,await decryptBackup(first,password));check(await bytes(target)===new TextDecoder().decode(payload),'restoration changed relations');
  failed=false;try{await ledger.restorePortableBackup(target,payload);}catch{failed=true;}check(failed,'nonempty target overwritten');target.close();target=await ledger.openDatabase(ledger.DB_NAME+'-portable-checks');check(await bytes(target)===new TextDecoder().decode(payload),'reopen changed backup');lines.push('v8 encrypted memory roundtrip, blank restore and reopen preserve amounts, statuses, revisions and operation order');
  if(Number(today.slice(-2))<31){
    const first=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()).padStart(2,'0');
    if(first>today){await ledger.updateIncomeRule(db,'add','ir_future',null,{name:'合成月底收入',amount:'.32',first_due_on:first,due_day:31});
      await ledger.updateIncomeRule(db,'update','ir_future',0,{name:'合成下月收入',amount:'.33',first_due_on:first,due_day:1});
      const state=await ledger.readLedger(db),period=recurringIncomeItems(state,today).items.find(row=>row.rule_id==='ir_future');
      check(period?.defaults.due_on===first&&period.defaults.cents==='32'&&period.status==='upcoming','unexpired current month disappeared');
      await reject(()=>ledger.processIncomePeriod(db,'ir_future',month,1,0,'record'));lines.push('deferred edits preserve this month’s original unexpired draft and refuse early confirmation');}
  }
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組定期收入原生交易\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db?.close();peer?.close();target?.close();}
