import {DB_NAME,openDatabase,initializeLedger,exportPortableBackup} from '../local-first/ledger.mjs';
const report=document.createElement('pre');report.id='persistence-result';document.body.prepend(report);
const check=(value,message)=>{if(!value)throw new Error(message);};
const q=selector=>document.querySelector(selector);
const wait=predicate=>new Promise((resolve,reject)=>{if(predicate()){resolve();return;}const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}}),timer=setTimeout(()=>{observer.disconnect();reject(new Error('UI timeout'));},10000);observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
const scenario=new URLSearchParams(location.search).get('case')||'pending';
const open=indexedDB.open.bind(indexedDB),name=DB_NAME+'-persistence-'+crypto.randomUUID();
indexedDB.open=(value,version)=>open(value===DB_NAME?name:value,version);
const db=await openDatabase();await initializeLedger(db);
const original=new TextDecoder().decode(await exportPortableBackup(db));let queries=0,requests=0,release;
const storage={
  persisted:async()=>{queries++;if(scenario==='query-failure')throw new Error('PRIVATE-STORAGE-DETAIL');if(scenario==='pending')return new Promise(resolve=>{release=resolve;});return scenario==='granted';},
  persist:async()=>{requests++;if(scenario==='request-failure')throw new Error('PRIVATE-STORAGE-DETAIL');if(scenario==='request-pending')return new Promise(resolve=>{release=resolve;});return scenario==='approve';}
};
if(scenario==='query-only')delete storage.persist;
Object.defineProperty(navigator,'storage',{configurable:true,value:scenario==='unsupported'?undefined:storage});
if(scenario==='database-unavailable')indexedDB.open=()=>{throw new Error('PRIVATE-STORAGE-DETAIL');};
if(scenario==='initial-read-failure'){
  const transaction=IDBDatabase.prototype.transaction;let failed=false;
  IDBDatabase.prototype.transaction=function(...args){
    if(this.name===name&&!failed){failed=true;throw new Error('PRIVATE-STORAGE-DETAIL');}
    return transaction.apply(this,args);
  };
}
try{
  await import('../local-first/page.mjs');
  check(q('#storage-status')&&q('#request-persistence'),'Missing browser storage status');
  await wait(()=>q('#storage-status').textContent.length>0);
  check(requests===0,'Opening requested permission');
  const button=q('#request-persistence');
  if(scenario==='database-unavailable'||scenario==='initial-read-failure'){
    check(q('#error').textContent.includes('無法開啟')&&!q('#error').textContent.includes('PRIVATE-STORAGE-DETAIL'),'Unavailable IndexedDB loses safe error');
    check(q('#ledger-page').hidden&&requests===0,'Unavailable IndexedDB permits ledger operations or requests permission');
    const guidance=q('#recovery-guidance');
    check(guidance&&!guidance.hidden,'Missing visible recovery guidance');
    for(const text of ['不要清除','覆蓋','原瀏覽器設定檔','全新','空白','同一個固定網址','沒有可用備份','停止操作'])check(guidance.textContent.includes(text),'Incomplete recovery guidance');
    check(!guidance.querySelector('button,a,input,form')&&q('#welcome').hidden&&q('#start-ledger').disabled&&q('#choose-restore').disabled,'Failed source offers a destructive recovery shortcut');
    check(!document.body.textContent.includes('PRIVATE-STORAGE-DETAIL'),'Opening failure leaked exception');
  }else if(scenario==='pending'){
    check(button.disabled,'Pending query permits request');release(false);await wait(()=>!button.disabled);
  }else if(scenario==='granted'){
    await wait(()=>q('#storage-status').textContent.includes('已獲准'));check(button.disabled||button.hidden,'Granted repeats request');
  }else if(scenario==='unsupported'||scenario==='query-only'){
    await wait(()=>q('#storage-status').textContent.includes(scenario==='unsupported'?'不支援':'未獲准'));check(button.disabled||button.hidden,'Unsupported request enabled');
  }else if(scenario==='query-failure'){
    await wait(()=>q('#storage-status').textContent.includes('查詢失敗'));check(button.disabled,'Failed query permits request');
  }else{
    await wait(()=>!button.disabled);check(q('#storage-status').textContent.includes('未獲准'),'Incorrect initial state');button.click();button.click();
    if(scenario==='request-pending'){check(requests===1&&button.disabled,'Repeated pending request');release(true);}
    await wait(()=>q('#storage-status').textContent.includes(scenario==='request-failure'?'無法確認':scenario==='approve'||scenario==='request-pending'?'已獲准':'未獲准')&&requests===1);
    button.click();check(requests===1&&button.disabled,'Repeated permission request');
  }
  check(!q('#storage-status').textContent.includes('PRIVATE-STORAGE-DETAIL'),'Raw exception leaked');
  check(queries===(scenario==='unsupported'?0:1),'Storage query repeated');
  check(!q('#storage-status').textContent.includes('不會遺失'),'False permanence claim');
  check(new TextDecoder().decode(await exportPortableBackup(db))===original,'Storage API changed ledger');
  check(q('#data-management').textContent.includes('下載要求不代表'),'Lost manual backup distinction');
  report.textContent='PASS：'+scenario+'；準確狀態、明確單次申請、安全錯誤及帳本唯讀';
}catch(error){report.textContent='FAIL：'+error.message;throw error;}finally{db.close();}
