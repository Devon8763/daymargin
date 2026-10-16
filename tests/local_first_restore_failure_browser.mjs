import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const params=new URLSearchParams(location.search),mode=params.get('case')??'calendar',run=params.get('run')??crypto.randomUUID();
const name=ledger.DB_NAME+'-restore-failure-'+run,open=indexedDB.open.bind(indexedDB);
check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000&&['normal','abort','read','calendar','render'].includes(mode),'Use a fresh synthetic origin');
indexedDB.open=(value,version)=>{const request=open(value===ledger.DB_NAME?name:value,version);if(value===ledger.DB_NAME)request.addEventListener('success',()=>Object.defineProperty(request.result,'name',{value:ledger.DB_NAME}));return request;};
const report=document.createElement('pre');report.id='restore-failure-result';report.style.whiteSpace='pre-wrap';document.body.prepend(report);
const wait=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Restore UI timeout');};
const db=await ledger.openDatabase(),lines=[];
const raw=async()=>{const tx=db.transaction(STORES,'readonly'),rows={};for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const text=bytes=>new TextDecoder().decode(bytes),payload=new Uint8Array(await(await fetch('/tests/fixtures/portable_life_ledger.json')).arrayBuffer());
const choose=()=>{const transfer=new DataTransfer();transfer.items.add(new File([payload],'synthetic-r01.json'));q('#restore-file').files=transfer.files;q('#restore-file').dispatchEvent(new Event('change'));};
const saveExpense=async()=>{const state=await ledger.readLedger(db),form=q('#expense-form');form.elements.amount.value='.29';form.elements.note.value='R01 synthetic operation';form.elements.spent_on.value=ledger.taiwanToday();form.elements.category.value='餐飲';form.elements.payment_source_id.value=state.payment_sources.find(row=>row.active===1).id;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!q('#status').textContent.includes('正在儲存'));};
const rejectNonempty=async()=>{const before=await raw();let failure;try{await ledger.restorePortableBackup(db,payload,true);}catch(error){failure=error;}check(failure?.code==='nonempty'&&await raw()===before,'Nonempty restore was accepted or changed data');};
let transaction=IDBDatabase.prototype.transaction,add=IDBObjectStore.prototype.add,patchedNode,replaceChildren;
try{
  if(params.has('resume')){
    const baseline=sessionStorage.getItem('r01-'+name);check(baseline!==null&&await raw()===baseline,'Reload lost restored data or metadata');
    await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);check(!q('#fields').disabled,'Reload kept a stale in-memory lock');
    await saveExpense();check(q('#status').textContent.includes('儲存完成'),'Reload did not restore normal writes');await rejectNonempty();
    lines.push('actual reload preserves committed data/metadata, restores normal writes and still refuses nonempty restore');
  }else{
    check(await ledger.readLedgerIfPresent(db)===null,'Refusing nonempty test database');
    await import('../local-first/page.mjs');await wait(()=>!q('#welcome').hidden);const blank=await raw();
    choose();await wait(()=>!q('#restore-review').hidden);q('#cancel-restore').click();check(await raw()===blank&&q('#restore-review').hidden,'Cancellation wrote data');
    choose();await wait(()=>!q('#restore-review').hidden);let starts=0,commits=0,failRead=false,readInjected=false,initInjected=false;
    IDBDatabase.prototype.transaction=function(...args){
      if(this.name===ledger.DB_NAME&&args[1]==='readonly'&&failRead){failRead=false;readInjected=true;throw new Error('synthetic postcommit read fault');}
      const tx=transaction.apply(this,args);if(this.name===ledger.DB_NAME&&args[1]==='readwrite'){starts++;tx.addEventListener('complete',()=>{commits++;if(mode==='read'&&commits===1)failRead=true;});}return tx;
    };
    if(mode==='abort'){
      let aborted=false;IDBObjectStore.prototype.add=function(...args){const request=add.apply(this,args);request.addEventListener('success',()=>{if(!aborted){aborted=true;this.transaction.abort();}});return request;};
      q('#confirm-restore').click();await wait(()=>q('#error').textContent.includes('還原未完成'));IDBObjectStore.prototype.add=add;
      check(aborted&&commits===0&&await raw()===blank&&!q('#choose-restore').disabled,'Abort did not fully roll back or blocked a safe retry');
      lines.push('native request-success abort leaves all stores/metadata blank and allows retry');choose();await wait(()=>!q('#restore-review').hidden);
    }
    if(['calendar','render'].includes(mode)){
      patchedNode=q(mode==='calendar'?'#calendar-grid':'#expenses');replaceChildren=patchedNode.replaceChildren;
      patchedNode.replaceChildren=function(){initInjected=true;throw new Error('synthetic postcommit initialization fault');};
    }
    q('#confirm-restore').click();q('#confirm-restore').click();
    await wait(()=>commits===1&&(q('#error').textContent.length>0||!q('#ledger-page').hidden));
    if(patchedNode)patchedNode.replaceChildren=replaceChildren;
    if(['read','calendar','render'].includes(mode)){
      check(mode==='read'?readInjected:initInjected,'Fault did not run');if(mode!=='read')check(!q('#ledger-page').hidden,'Partial initialization was not reached');
      const before=await raw(),backup=text(await ledger.exportPortableBackup(db)),message=q('#error').textContent;
      await q('#start-ledger').onclick();await saveExpense();
      q('#cancel-restore').onclick();q('#cancel-decrypt').onclick();await q('#confirm-restore').onclick();await q('#confirm-restore').onclick();
      let fileClicks=0;const click=q('#restore-file').click;q('#restore-file').click=()=>fileClicks++;q('#choose-restore').onclick();q('#restore-file').click=click;choose();
      await wait(()=>!q('#status').textContent.includes('正在儲存'));
      check(starts===1&&commits===1&&await raw()===before&&text(await ledger.exportPortableBackup(db))===backup,'R01: postcommit failure allowed another operation or changed restored rows/metadata');
      check(q('#fields').disabled&&q('#confirm-restore').disabled&&q('#choose-restore').disabled&&fileClicks===0&&q('#restore-review').hidden,'Blocked UI or restore entry reopened');
      check(q('#error').textContent===message&&/還原.*已完成/.test(message)&&/重新讀取.*畫面/.test(message)&&/重新載入/.test(message)&&q('#status').textContent===message,'Committed failure is ambiguous or cancel removed the warning');
      sessionStorage.setItem('r01-'+name,await raw());lines.push('one real restore commit; postcommit '+mode+' fault blocks direct handlers, cancellation, repeated clicks and file selection; raw/metadata/backup unchanged');
    }else{
      check(commits===1&&starts===(mode==='abort'?2:1),'Restore committed more than once');await saveExpense();check(q('#status').textContent.includes('儲存完成'),'Normal restore did not allow writes');await rejectNonempty();lines.push('normal restore writes once, enables normal operations and refuses nonempty restore');
    }
  }
  report.dataset.done='pass';report.textContent='PASS R01 '+mode+' '+lines.length+' groups\n'+lines.join('\n');
}catch(error){report.dataset.done='fail';report.textContent='FAIL R01 '+mode+': '+error.message+'\n'+lines.join('\n');}
finally{IDBDatabase.prototype.transaction=transaction;IDBObjectStore.prototype.add=add;if(patchedNode)patchedNode.replaceChildren=replaceChildren;db.close();}
