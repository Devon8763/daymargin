import {DB_NAME,openDatabase,readLedgerIfPresent,initializeLedger,exportPortableBackup} from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
import {readBackup,writeBackup,emptyData} from '../local-first/backup.mjs';
import {encryptBackup,decryptBackup,MAX_ENCRYPTED_BYTES} from '../local-first/backup-crypto.mjs';
const report=document.createElement('pre');report.id='crypto-test-result';document.body.prepend(report);
const lines=[],check=(value,message)=>{if(!value)throw new Error(message);};
const q=selector=>document.querySelector(selector),text=bytes=>new TextDecoder().decode(bytes);
const wait=predicate=>new Promise((resolve,reject)=>{if(predicate()){resolve();return;}const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}}),timer=setTimeout(()=>{observer.disconnect();reject(new Error('UI timeout'));},10000);observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
const name=DB_NAME+'-crypto-ui-'+crypto.randomUUID(),open=indexedDB.open.bind(indexedDB);
indexedDB.open=(value,version)=>{const request=open(value===DB_NAME?name:value,version);if(value===DB_NAME)request.addEventListener('success',()=>Object.defineProperty(request.result,'name',{value:DB_NAME}));return request;};
const db=await openDatabase(),choose=payload=>{const transfer=new DataTransfer();transfer.items.add(payload instanceof File?payload:new File([payload],'synthetic.backup'));q('#restore-file').files=transfer.files;q('#restore-file').dispatchEvent(new Event('change'));};
const password='合成 encrypted password 123',legacyPayload=new Uint8Array(await (await fetch('/tests/fixtures/portable_life_ledger.json')).arrayBuffer());
let payload=legacyPayload;
if(['v2','v3','v4','v5','v6'].includes(new URLSearchParams(location.search).get('finance'))){
  const original=readBackup(legacyPayload),rule=original.data.recurring_rules[0].id;
  payload=writeBackup({format:original.format,version:2,data:{...emptyData(2),...original.data,
    incomes:[{id:'i_finance',received_on:'2025-02-28',cents:'29',name:'<img src=x onerror=alert(3)>合成收入',voided:1,revision:1}],
    income_actions:[{id:'ia_finance',income_id:'i_finance',before:{id:'i_finance',received_on:'2025-02-28',cents:'29',name:'<img src=x onerror=alert(3)>合成收入',voided:0,revision:0},undone:0}],
    monthly_allocations:[{month:'2025-02',items:[{id:'living',name:'生活開銷',cents:'10'},{id:'custom',name:'<img src=x onerror=alert(4)>',cents:'20'}],excluded_recurring_ids:[rule],revision:1}],
    allocation_preferences:[{recurring_id:rule,excluded_from_month:'2025-03',revision:0}]}});
}
if(['v3','v4','v5','v6'].includes(new URLSearchParams(location.search).get('finance'))){
  const original=readBackup(payload),payment=original.data.payment_sources.find(row=>row.active===1),entry=original.data.expenses.find(row=>row.source==='manual');
  const defaults=year=>({name:'<img src=x onerror=alert(5)>合成年度',cents:'120001',category:'餐飲',payment_source_id:payment.id,payment_source_name:payment.name,due_on:year+'-02-'+(year===2024?'29':'28')});
  payload=writeBackup({format:original.format,version:3,data:{...emptyData(3),...original.data,
    annual_rules:[{id:'y_crypto',...defaults(2024),first_year:2024,due_month:2,due_day:31,effective_month:'2024-02',active:1,revision:2}].map(({due_on,...row})=>row),
    annual_periods:[{annual_id:'y_crypto',year:2024,defaults:defaults(2024),status:'recorded',expense_id:entry.id,revision:1},
      {annual_id:'y_crypto',year:2025,defaults:defaults(2025),status:'skipped',expense_id:null,revision:0},
      {annual_id:'y_crypto',year:2026,defaults:defaults(2026),status:'pending',expense_id:null,revision:0}]}});
}
if(['v4','v5','v6'].includes(new URLSearchParams(location.search).get('finance'))){
  const original=readBackup(payload),entry=original.data.expenses[0];
  payload=writeBackup({format:original.format,version:4,data:{...emptyData(4),...original.data,
    usage_periods:[{expense_id:entry.id,started_on:'2025-02-28',days:180,remind:1,reminder_days:7,show_daily_cost:1,active:0,revision:3}]}});
}
if(new URLSearchParams(location.search).get('finance')==='v5'||new URLSearchParams(location.search).get('finance')==='v6'){
  const original=readBackup(payload),entry=original.data.expenses[0];
  payload=writeBackup({format:original.format,version:5,data:{...emptyData(5),...original.data,
    tags:[{id:'t_crypto',name:'<img src=x onerror=alert(6)>',hidden:1,revision:2}],
    expense_tags:[{expense_id:entry.id,tag_id:'t_crypto'}]}});
}
if(new URLSearchParams(location.search).get('finance')==='v6'){
  const original=readBackup(payload),entry=original.data.expenses.find(row=>row.source==='固定'&&row.recurring_id!==null),due=entry.spent_on;
  original.data.scheduled_periods=[{rule_id:entry.recurring_id,index:0,defaults:{due_on:due,name:entry.note,cents:entry.cents,category:entry.category,payment_source_id:entry.payment_source_id,payment_source_name:entry.payment_source_name},status:'recorded',expense_id:entry.id,revision:1}];
  entry.spent_on='2025-02-01';
  payload=writeBackup({format:original.format,version:6,data:{...emptyData(6),...original.data}});
}
const encrypted=await encryptBackup(payload,password),blobs=[],create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
URL.createObjectURL=blob=>{blobs.push(blob);return create(blob);};HTMLAnchorElement.prototype.click=function(){};
const enterPassword=()=>{q('#restore-password').value=password;q('#decrypt-form').requestSubmit();};
const previewEncrypted=async()=>{choose(encrypted);await wait(()=>!q('#decrypt-panel').hidden);enterPassword();await wait(()=>!q('#restore-review').hidden);};
try{
  await import('../local-first/page.mjs');
  check(q('#export-form')&&q('#decrypt-form'),'Missing password backup UI');
  check(await readLedgerIfPresent(db)===null,'Opening created ledger');
  choose(encrypted);await wait(()=>!q('#decrypt-panel').hidden);q('#restore-password').value='WRONG SECRET';q('#decrypt-form').requestSubmit();
  await wait(()=>q('#restore-password-error').textContent.length>0);
  check(await readLedgerIfPresent(db)===null&&q('#restore-review').hidden,'Wrong password wrote data');
  check(!q('#restore-password-error').textContent.includes('WRONG SECRET'),'Password leaked');
  enterPassword();await wait(()=>!q('#restore-review').hidden);
  check(q('#restore-summary').children.length===Object.keys(readBackup(payload).data).length&&q('#restore-password').value==='','Missing validated counts or password cleanup');
  q('#cancel-restore').click();check(await readLedgerIfPresent(db)===null,'Cancel preview wrote data');lines.push('encrypted password gate, safe failure, '+Object.keys(readBackup(payload).data).length+' validated section counts and cancel');
  const changed=encrypted.slice();changed[47]^=1;choose(changed);await wait(()=>!q('#decrypt-panel').hidden);enterPassword();await wait(()=>q('#restore-password-error').textContent.length>0);q('#cancel-decrypt').click();
  const huge=new File(['small'],'synthetic');Object.defineProperty(huge,'size',{value:MAX_ENCRYPTED_BYTES+1});choose(huge);await wait(()=>q('#error').textContent.includes('上限'));
  check(await readLedgerIfPresent(db)===null,'Corrupt/oversized import wrote data');lines.push('tampered and oversized files leave blank ledger');
  choose(legacyPayload);await wait(()=>!q('#restore-review').hidden);check(q('#restore-summary').children.length===9,'Legacy v1 lost nine-section review');q('#cancel-restore').click();lines.push('legacy JSON remains importable without password');
  const deriveRestore=crypto.subtle.deriveKey.bind(crypto.subtle);let releaseRestore;
  crypto.subtle.deriveKey=(...args)=>new Promise(resolve=>{releaseRestore=()=>resolve(deriveRestore(...args));});
  choose(encrypted);await wait(()=>!q('#decrypt-panel').hidden);enterPassword();await wait(()=>q('#decrypt-backup').disabled);
  while(!releaseRestore)await new Promise(resolve=>setTimeout(resolve,10));q('#cancel-decrypt').click();releaseRestore();crypto.subtle.deriveKey=deriveRestore;
  await wait(()=>!q('#start-ledger').disabled);check(q('#restore-review').hidden&&q('#restore-password').value===''&&await readLedgerIfPresent(db)===null,'Canceled decrypt retained password, preview or data');
  choose(encrypted);await wait(()=>!q('#decrypt-panel').hidden);q('#restore-password').value=password;q('#start-ledger').click();await wait(()=>!q('#ledger-page').hidden);
  check(q('#restore-password').value===''&&q('#decrypt-panel').hidden,'Start ledger retained hidden password');lines.push('cancel decrypt during KDF and start-ledger alternative clear passwords');
  const blank=db.transaction(STORES,'readwrite');for(const store of STORES)blank.objectStore(store).clear();await done(blank);
  q('#ledger-page').hidden=true;q('#welcome').hidden=false;
  await previewEncrypted();const add=IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add=function(...args){const request=add.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request;};
  q('#confirm-restore').click();await wait(()=>q('#error').textContent.includes('還原未完成'));IDBObjectStore.prototype.add=add;
  check(await readLedgerIfPresent(db)===null,'Abort left partial data');
  await previewEncrypted();IDBObjectStore.prototype.add=()=>{throw new DOMException('PRIVATE INTERNAL','QuotaExceededError');};
  q('#confirm-restore').click();await wait(()=>q('#error').textContent.includes('還原未完成'));IDBObjectStore.prototype.add=add;
  check(await readLedgerIfPresent(db)===null&&!q('#error').textContent.includes('PRIVATE INTERNAL'),'Quota left data or leaked details');lines.push('encrypted restore abort and quota roll back all stores');
  await previewEncrypted();const other=await openDatabase();await initializeLedger(other);other.close();const defaults=text(await exportPortableBackup(db));
  q('#confirm-restore').click();await wait(()=>q('#error').textContent.includes('還原未完成'));
  check(text(await exportPortableBackup(db))===defaults,'Other tab defaults overwritten');lines.push('second connection nonempty race refuses entire encrypted restore');
  const reset=db.transaction(STORES,'readwrite');for(const store of STORES)reset.objectStore(store).clear();await done(reset);
  await previewEncrypted();q('#confirm-restore').click();await wait(()=>!q('#ledger-page').hidden);
  const original=text(await exportPortableBackup(db));check(original===text(writeBackup(readBackup(payload))),'Nine-section restore changed history');
  check(!q('#expenses img')&&!q('#expenses script'),'Restored XSS became DOM');lines.push('encrypted restore preserves all values and history; XSS stays text');
  q('[data-view-button="settings"]').click();q('#download-backup').click();check(q('#export-mode').value==='encrypted','Export not encrypted by default');
  q('#export-password').value=password;q('#export-confirm-password').value='mismatch';q('#export-form').requestSubmit();await wait(()=>q('#export-error').textContent.length>0);
  check(blobs.length===0&&q('#export-password').value===password,'Mismatch lost input or downloaded');
  q('#export-confirm-password').value=password;q('#export-form').requestSubmit();await wait(()=>q('#export-panel').hidden);
  check(blobs.length===1&&q('#export-password').value==='','Encrypted download missing or retained password');
  const first=new Uint8Array(await blobs[0].arrayBuffer());check(text(await decryptBackup(first,password))===original,'Encrypted download not full JSON');
  q('#download-backup').click();q('#export-password').value=password;q('#export-confirm-password').value=password;q('#export-form').requestSubmit();await wait(()=>q('#export-panel').hidden);
  check(text(first)!==text(new Uint8Array(await blobs[1].arrayBuffer())),'Ciphertext reused');lines.push('default encryption, mismatch preserves input, cleanup and fresh random export');
  q('#download-backup').click();q('#export-mode').value='plain';q('#export-mode').dispatchEvent(new Event('change'));q('#export-form').requestSubmit();await wait(()=>q('#export-error').textContent.length>0);
  check(q('#export-password-fields').getClientRects().length===0,'Plain export still displays password fields');
  check(blobs.length===2&&!q('#export-plain-risk').hidden,'Plain download skipped confirmation');
  q('#export-risk').checked=true;q('#export-form').requestSubmit();await wait(()=>q('#export-panel').hidden);
  check(text(new Uint8Array(await blobs[2].arrayBuffer()))===original,'Plain JSON changed');
  q('#download-backup').click();check(q('#export-mode').value==='encrypted'&&!q('#export-risk').checked,'Remembered plain choice');q('#cancel-export').click();check(blobs.length===3,'Cancel downloaded');lines.push('explicit unencrypted risk confirmation; every opening resets choice');
  const derive=crypto.subtle.deriveKey.bind(crypto.subtle);let release;
  crypto.subtle.deriveKey=(...args)=>new Promise(resolve=>{release=()=>resolve(derive(...args));});
  q('#download-backup').click();q('#export-password').value=password;q('#export-confirm-password').value=password;q('#export-form').requestSubmit();await wait(()=>q('#confirm-export').disabled);
  while(!release)await new Promise(resolve=>setTimeout(resolve,10));q('#cancel-export').click();release();crypto.subtle.deriveKey=derive;await wait(()=>!q('#download-backup').disabled);
  check(blobs.length===3&&q('#export-password').value==='','Canceled KDF downloaded or kept password');
  check(text(await exportPortableBackup(db))===original,'Exports modified ledger');
  check(!q('#status').textContent.includes('備份已保存'),'False saved claim');lines.push('cancel during KDF discards result; all exports are read-only and never claim saved');
  report.textContent='PASS：'+lines.length+' 組可選密碼備份畫面驗證\n'+lines.join('\n');
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');throw error;}
finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;db.close();}
