import * as ledger from '../local-first/ledger.mjs';
import {emptyData,readBackup} from '../local-first/backup.mjs';
import {STORES,addState} from '../local-first/idb.mjs';
import {encryptBackup,decryptBackup} from '../local-first/backup-crypto.mjs';
const check=(value,message)=>{if(!value)throw new Error(message);},text=bytes=>new TextDecoder().decode(bytes);
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
const lines=[],name='life-shortcuts-'+crypto.randomUUID(),db=await ledger.openDatabase(name),peer=await ledger.openDatabase(name);
let target;
const form={name:'合成早餐',note:'<img src=x onerror=alert(1)>',category:'餐飲',payment_source_id:'p_cash',amount:'.29'},today=ledger.taiwanToday();
const bytes=connection=>ledger.exportPortableBackup(connection).then(text);
const refuse=async action=>{const before=await bytes(db);let error;try{await action();}catch(value){error=value;}check(error&&!error.message.includes('PRIVATE'),'Missing safe rejection');check(await bytes(db)===before,'Partial shortcut write');};
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolation required');await ledger.initializeLedger(db);
  await ledger.updateShortcut(db,[],'add','s_one',form);let s=await ledger.readLedger(db);
  check(s.shortcuts[0].cents==='29'&&!s.expenses.length&&!s.actions.length,'Setting entered consumption');
  await refuse(()=>ledger.updateShortcut(peer,[],'add','s_one',form));lines.push('one setting only; duplicate/stale add refused');
  const races=await Promise.allSettled([ledger.updateShortcut(db,s.shortcuts,'update','s_one',{...form,amount:''}),ledger.updateShortcut(peer,s.shortcuts,'update','s_one',{...form,amount:'1'})]);
  check(races.filter(row=>row.status==='fulfilled').length===1,'Peer silent overwrite');s=await ledger.readLedger(db);lines.push('two connections same snapshot only one wins');
  const original=IDBObjectStore.prototype.put;
  for(const op of ['add','update','disable','down'])for(const abort of [false,true]) {
    s=await ledger.readLedger(db);const id=op==='add'?'s_new':'s_one';let writes=0;
    IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name===name&&++writes===2){if(!abort)throw new DOMException('PRIVATE','QuotaExceededError');const req=original.apply(this,args);req.addEventListener('success',()=>this.transaction.abort());return req;}return original.apply(this,args);};
    try{await refuse(()=>ledger.updateShortcut(db,s.shortcuts,op,id,form));}finally{IDBObjectStore.prototype.put=original;}
  }
  lines.push('all operations quota exception and request-success abort roll back settings and metadata');
  await ledger.addExpense(db,{...form,spent_on:today},today,'e_source');s=await ledger.readLedger(db);
  await ledger.updateShortcut(db,s.shortcuts,'add','s_source',ledger.shortcutDraft(s,'e_source',0,today),{id:'e_source',revision:0});
  await ledger.voidExpense(db,'e_source',0);s=await ledger.readLedger(db);check(s.shortcuts.find(row=>row.id==='s_source').note===form.note,'Source linked setting');
  await refuse(()=>ledger.updateShortcut(peer,s.shortcuts,'add','s_void',form,{id:'e_source',revision:1}));lines.push('source eligibility rechecked; voiding source preserves independent shortcut');
  const before=await bytes(db),payload=await ledger.exportPortableBackup(db),decoded=await decryptBackup(await encryptBackup(payload,'synthetic-shortcut-password'),'synthetic-shortcut-password');
  target=await ledger.openDatabase(ledger.DB_NAME+'-portable-checks-shortcuts-'+crypto.randomUUID());Object.defineProperty(target,'name',{value:ledger.DB_NAME+'-portable-checks'});
  await ledger.restorePortableBackup(target,decoded);check(await bytes(target)===before&&readBackup(decoded).version===1,'Backup format/roundtrip changed');await refuse(()=>ledger.updateShortcut(db,[],'disable','s_one'));
  lines.push('unchanged JSON v1 and encrypted envelope roundtrip preserve order and source history');
  const cap={format:'local-first-test-ledger',version:5,owner:'local-test-owner',...emptyData(4),payment_sources:[{id:'p_cash',name:'現金',active:1}],categories:Array.from({length:99999},(_,i)=>({name:'c'+i,active:0}))};
  let tx=db.transaction(STORES,'readwrite');for(const store of STORES)tx.objectStore(store).clear();addState(tx,cap);await done(tx);
  await refuse(()=>ledger.updateShortcut(db,[],'add','s_cap',form));lines.push('100000-row capacity refuses whole setting without partial metadata');
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組操作捷徑原生交易\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db.close();peer.close();target?.close();}
