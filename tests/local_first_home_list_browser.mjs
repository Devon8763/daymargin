import * as ledger from '../local-first/ledger.mjs';
import {emptyData,writeBackup} from '../local-first/backup.mjs';
import {STORES,addState,portable,metadata} from '../local-first/idb.mjs';
import {activeExpenses,monthBudget} from '../local-first/browse.mjs';
import {expenseCsv} from '../local-first/csv.mjs';
import {homeFixture} from './local_first_home_fixture.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<1200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Home UI timeout');};
const report=document.createElement('pre');report.id='home-list-result';report.style.whiteSpace='pre-wrap';document.body.prepend(report);
const params=new URLSearchParams(location.search),count=Number(params.get('size')??105),mode=params.get('mode')??'check';
const run=params.get('run')??crypto.randomUUID(),name=ledger.DB_NAME+'-home-list-'+run,open=indexedDB.open.bind(indexedDB);
indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),today=ledger.taiwanToday(),lines=[];
const raw=async()=>{const tx=db.transaction(STORES,'readonly'),rows={};for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const ids=()=>[...q('#expenses').children].map(row=>row.dataset.expenseId);
const layout=()=>q('#expenses').getBoundingClientRect().height;
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Fresh random origin required');
  if(params.has('resume')) {
    const expected=sessionStorage.getItem('home-test-'+name);check(expected!==null,'Missing synthetic reload baseline');
    await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
    const restored=await ledger.readLedger(db),active=activeExpenses(restored,today);
    check(q('#expenses').children.length===Math.min(active.length,50),'Reload built the wrong first batch');
    while(!q('#expenses-more').hidden)q('#expenses-more').click();
    check(JSON.stringify(ids())===JSON.stringify(active.slice().reverse().map(row=>row.id)),'Reload list order/rows wrong');
    check(await raw()===expected,'Reload changed original rows or metadata');
    report.dataset.done='pass';report.textContent='PASS HOME reload: existing synthetic database, complete active rows and raw metadata unchanged';
    db.close();
  }else{
  const seed=homeFixture(count,today,emptyData),payload=writeBackup(portable(seed)),seedMetadata=metadata(seed);
  const seedHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',payload))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const tx=db.transaction(STORES,'readwrite');addState(tx,seed);await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
  const before=await raw(),backupBefore=new TextDecoder().decode(await ledger.exportPortableBackup(db));
  const expected=activeExpenses(seed,today).slice().reverse().map(row=>row.id);
  const start=performance.now();await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);layout();
  const loadMs=performance.now()-start,loadRows=q('#expenses').children.length,details=q('#expenses-disclosure');
  check(!details.open,'Default disclosure changed');
  const expandStart=performance.now();const toggled=new Promise(resolve=>details.addEventListener('toggle',resolve,{once:true}));details.open=true;await toggled;layout();
  const expandMs=performance.now()-expandStart,expandedRows=q('#expenses').children.length;
  if(mode==='bench') {
    details.open=false;await new Promise(resolve=>setTimeout(resolve,0));
    const transaction=IDBDatabase.prototype.transaction;let committedAt=null;
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&args[1]==='readwrite')tx.addEventListener('complete',()=>{committedAt=performance.now();});return tx;};
    const form=q('#expense-form');form.elements.amount.value='.01';form.elements.note.value='合成首頁量測新增';form.elements.category.value='餐飲';form.elements.payment_source_id.value='p_cash';
    const saveStart=performance.now();try{form.requestSubmit();await wait(()=>q('#status').textContent.includes('儲存完成'));layout();}finally{IDBDatabase.prototype.transaction=transaction;}
    check(committedAt!==null,'No real native commit measured');
    const result={count,seedHash,seedBytes:payload.byteLength,rowCount:seedMetadata.row_count,loadMs,loadRows,expandMs,expandedRows,saveMs:performance.now()-saveStart,commitMs:committedAt-saveStart,afterCommitMs:performance.now()-committedAt,savedRows:q('#expenses').children.length};
    report.dataset.done='pass';report.textContent='PASS BENCH '+JSON.stringify(result);report.dataset.result=JSON.stringify(result);
  }else if(mode==='interactive'){
    report.dataset.done='pass';report.textContent='READY HOME keyboard and viewport';
    const checkRead=document.createElement('button');checkRead.id='home-read-check';checkRead.textContent='核對純展開與取消未寫入';
    checkRead.onclick=async()=>{try{check(await raw()===before&&new TextDecoder().decode(await ledger.exportPortableBackup(db))===backupBefore,'Keyboard/view operations changed data');report.textContent='PASS HOME keyboard: native more/edit/cancel preserved complete raw rows, metadata and backup';}catch(failure){report.textContent='FAIL HOME keyboard: '+failure.message;}};
    report.after(checkRead);
  }else {
    check(loadRows===Math.min(count,50),'First render built all historical rows instead of the first batch');
    check(q('#expenses-count')?.textContent.includes(String(count)),'Missing complete active count');
    const more=q('#expenses-more');check(more&&more.hidden===(count<=50),'More control boundary is wrong');
    while(!more.hidden)more.click();
    check(JSON.stringify(ids())===JSON.stringify(expected)&&new Set(ids()).size===count,'Order, complete rows or uniqueness changed');
    for(const row of q('#expenses').children){const id=row.dataset.expenseId,links=new Set(seed.expense_tags.filter(link=>link.expense_id===id).map(link=>link.tag_id));const tags=seed.tags.filter(tag=>links.has(tag.id)).map(tag=>'#'+tag.name+(tag.hidden?'（不再顯示）':''));check(row.querySelector('.expense-tag-labels')?.textContent===tags.join(' · '),'Wrong tag order or relation');check(row.textContent.includes('可使用 '+seed.usage_periods.find(item=>item.expense_id===id).days+' 天'),'Usage crossed expenses');}
    check(!q('#expenses img,#expenses svg'),'Untrusted names became markup');
    check(await raw()===before&&new TextDecoder().decode(await ledger.exportPortableBackup(db))===backupBefore,'Pure expansion changed rows, metadata or backup');
    const query={start:today,end:today};
    check(monthBudget(await ledger.readLedger(db),today).spent===monthBudget(seed,today).spent,'Budget uses displayed rows only');
    check(expenseCsv(await ledger.readLedger(db),query,today).count===count,'CSV omitted later batches');
    lines.push('first batch50; full count, ordering and complete unique expansion; per-expense ordered tags and usage; pure reads preserve raw metadata/backup');
    if(count>50){
      const expense=q('#expense-form'),listNode=q('#expenses');expense.elements.note.value='未送出首頁草稿';details.open=false;
      q('[data-view-button="settings"]').click();const input=q('#home-order [data-block=expenses] input');input.checked=false;input.dispatchEvent(new Event('change'));q('#home-order [data-block=expenses] [data-move=up]').click();q('#home-expanded-expenses').checked=true;q('#save-home-preferences').click();
      check(q('[data-home-block=expenses]').hidden&&q('#expenses')===listNode&&!details.open&&expense.elements.note.value==='未送出首頁草稿','Hide/order preferences replaced nodes, disclosure or draft');
      const enabled=q('#home-order [data-block=expenses] input');enabled.checked=true;enabled.dispatchEvent(new Event('change'));q('#save-home-preferences').click();q('[data-view-button="record"]').click();details.open=true;
      q('#home-search-keyword').value='';q('#view-record [data-search-open]').click();await wait(()=>!q('#search-groups').hidden);q('#search-accounts').open=true;q('#batch-select-all').click();
      check(q('#batch-count').textContent.includes(count+' 筆')&&q('#search-results').children.length===50,'Search/select-all limited to home batch');
      check(await raw()===before&&new TextDecoder().decode(await ledger.exportPortableBackup(db))===backupBefore,'Preferences/search/index changed ledger or backup');q('#site-search-back').click();
      check(expense.elements.note.value==='未送出首頁草稿','Search return lost ordinary draft');
      lines.push('homepage hide/reorder/manual disclosure and draft survive; full-result search/select-all, CSV and budget independent of batches');
      const id=expected[70]??expected.at(-1),row=q('#expenses [data-expense-id="'+id+'"]');row.querySelector('button').click();q('#expense-form').elements.note.value='取消編輯草稿';q('#cancel-edit').click();
      check(document.activeElement.closest('[data-expense-id]')?.dataset.expenseId===id,'Cancel did not return to later batch row');
      q('#expenses [data-expense-id="'+id+'"] button').click();const form=q('#expense-form');form.elements.note.value='合成更改後續批次';form.requestSubmit();await wait(()=>q('#status').textContent.includes('儲存完成'));
      check(document.activeElement.closest('[data-expense-id]')?.dataset.expenseId===id,'Saved edit lost later batch return');
      check(q('#expenses [data-expense-id="'+id+'"]').textContent.includes('合成更改後續批次'),'New snapshot left stale row');
      lines.push('later-batch cancel/save returns directly to the correct row using current snapshot');
      const deleted=q('#expenses [data-expense-id="'+id+'"]');[...deleted.querySelectorAll('button')].find(button=>button.textContent==='刪除').click();q('#confirm-delete').click();await wait(()=>q('#status').textContent.includes('儲存完成')&&!q('#delete-dialog').open);
      check(!q('#expenses [data-expense-id="'+id+'"]')&&q('#expenses-count').textContent.includes(String(count-1)),'Soft deletion left stale list/index or full count');
      const after=await ledger.readLedger(db);check(after.usage_periods.some(row=>row.expense_id===id)&&after.expense_tags.some(row=>row.expense_id===id),'Display deletion removed historical relations');
      sessionStorage.setItem('home-test-'+name,await raw());lines.push('soft delete refresh excludes only the voided expense and retains historical tags/usage; raw reload baseline saved');
    }
    report.dataset.done='pass';report.textContent='PASS HOME '+count+' '+lines.length+' groups\n'+lines.join('\n');
  }
  }
}catch(failure){report.dataset.done='fail';report.textContent='FAIL HOME: '+failure.message+'\n'+lines.join('\n');}
finally{if(mode!=='interactive')db.close();}
window.addEventListener('pagehide',()=>db.close());
