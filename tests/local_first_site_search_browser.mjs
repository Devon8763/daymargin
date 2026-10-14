import * as ledger from '../local-first/ledger.mjs';
const editSearch=async(list='search-results')=>{
  const query=document.querySelector('#search-form');
  if(document.querySelector('#view-search').hidden){document.querySelector('[data-view-button="record"]').click();document.querySelector('#home-search-keyword').value=query.elements.keyword.value;document.querySelector('#view-record [data-search-open]').click();for(let i=0;i<250;i++){if(!document.querySelector('#search-groups').hidden&&document.querySelector('#search-results [data-batch-id]'))break;await new Promise(resolve=>setTimeout(resolve,20));}}
  if(list==='search-results')document.querySelector('#search-accounts').open=true;
  document.querySelector('#batch-clear').click();const input=document.querySelector('#'+list+' [data-batch-id]');if(!input)throw Error('Missing selected consumption');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#batch-edit').click();
};
import {readBackup} from '../local-first/backup.mjs';
import {STORES,addState} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<250;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Site search timeout');};
const report=document.createElement('pre');report.id='site-search-test';document.body.prepend(report);
const open=indexedDB.open.bind(indexedDB),name=new URLSearchParams(location.search).has('product')?ledger.DB_NAME:ledger.DB_NAME+'-site-search-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),lines=[],transaction=IDBDatabase.prototype.transaction,originalUrl=location.href;
const raw=async()=>{const rows={},tx=db.transaction(STORES,'readonly');for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?{bigint:String(value)}:value);};
try {
  check(await ledger.readLedgerIfPresent(db)===null,'Use a fresh synthetic source; do not overwrite an existing ledger');
  const fixture=readBackup(new Uint8Array(await(await fetch('/tests/fixtures/portable_life_ledger.json')).arrayBuffer()));
  const s={format:'local-first-test-ledger',version:2,owner:'local-test-owner',...fixture.data};
  s.categories.push({name:'旅行',active:0},{name:'旅行空',active:0});
  const base=s.expenses[0],trip=[];
  for(const [i,source]of ['manual','固定','訂閱','分期'].entries()){const row={...base,id:'trip-source-'+i,source,spent_on:'2024-02-29',cents:'101',note:'旅行合成'+source,category:'旅行',recurring_id:null,period:null,revision:0};s.expenses.push(row);trip.push(row.id);}
  for(let i=0;i<65;i++){const row={...base,id:'trip-batch-'+i,spent_on:'2024-02-29',cents:'1',note:'旅行合成',category:'旅行',revision:0};s.expenses.push(row);trip.push(row.id);}
  s.expenses.push({...base,id:'trip-void',spent_on:'2024-02-29',note:'旅行撤銷',category:'旅行',voided:1},
    {...base,id:'trip-future',spent_on:'2099-01-01',note:'旅行未來',category:'旅行'},
    {...base,id:'trip-danger',spent_on:'2024-02-29',note:'<img src=x onerror=alert(1)>旅行',category:'<svg/onload=x>旅行',cents:'1',revision:0});
  s.tags=[{id:'t_trip',name:'旅行',hidden:1,revision:0},{id:'t_other',name:'另一旅行',hidden:0,revision:0},{id:'t_empty',name:'旅行空',hidden:1,revision:0}];
  s.expense_tags=trip.map(id=>({expense_id:id,tag_id:'t_trip'}));s.expense_tags.push({expense_id:trip[0],tag_id:'t_other'},{expense_id:'trip-void',tag_id:'t_trip'});
  const tx=db.transaction(STORES,'readwrite');addState(tx,s);await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
  const before=await raw(),backup=new TextDecoder().decode(await ledger.exportPortableBackup(db));
  await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  check(q('#view-search')&&document.querySelectorAll('[data-search-open]').length===4,'Missing one shared search and four entries');
  check([...document.querySelectorAll('[data-search-open]')].every(button=>button.getAttribute('aria-label')?.includes('搜尋')),'Search icon lacks accessible name');
  const form=q('#search-form'),expense=q('#expense-form');expense.elements.amount.value='123.45';expense.elements.note.value='不能遺失的合成草稿';
  const draft=()=>JSON.stringify([...expense.elements].filter(el=>el.name).map(el=>[el.name,el.value,el.checked]));const draftBefore=draft();
  for(const view of ['record','planning','analysis','settings']){q('[data-view-button="'+view+'"]').click();q('#view-'+view+' [data-search-open]').click();check(!q('#view-search').hidden&&document.activeElement===form.elements.keyword,'Entry does not focus shared search');q('#site-search-back').click();check(!q('#view-'+view).hidden,'Return lost origin region');}
  lines.push('four accessible entries share one form and return to origin without losing expense draft');
  q('[data-view-button=record]').click();q('#home-search-keyword').value='旅行';q('#view-record [data-search-open]').click();
  await wait(()=>q('#search-count').textContent.includes('70'));
  check(q('#search-results').children.length===50&&!q('#search-more').hidden,'First 50/full count mismatch');q('#search-more').click();check(q('#search-results').children.length===70,'Search silently truncated');
  check(!q('#search-results').textContent.includes('旅行撤銷')&&!q('#search-results').textContent.includes('旅行未來'),'Voided/future leaked');
  check(['固定','訂閱','分期'].every(text=>q('#search-results').textContent.includes(text)),'Booked source missing');
  check(q('#search-categories').textContent.includes('停用')&&q('#search-tags').textContent.includes('不再顯示'),'Historical states missing');
  lines.push('grouped complete counts, four sources, >50 batches, void/future exclusion and historical states');
  q('#search-categories button').click();check(q('#search-selection-summary').textContent.includes('4.69 元')&&q('#search-selection-results').children.length===50,'Category total/display uses a limited batch');q('#search-selection-more').click();check(q('#search-selection-results').children.length===69,'Category result truncated');q('#search-selection-back').click();
  q('#search-tags button').click();check(q('#search-selection-summary').textContent.includes('4.69 元')&&q('#search-selection-title').textContent.includes('不再顯示'),'Hidden tag missing/double-counted/unlabelled');q('#search-selection-back').click();
  [...q('#search-tags').querySelectorAll('button')].find(button=>button.textContent.includes('另一旅行')).click();check(q('#search-selection-summary').textContent.includes('1.01 元'),'Different tags merged');q('#search-selection-back').click();
  [...q('#search-categories').querySelectorAll('button')].find(button=>button.textContent.includes('旅行空')).click();check(q('#search-selection-summary').textContent.includes('0 元')&&!q('#search-selection-empty').hidden,'Empty category is an error');q('#search-selection-back').click();
  lines.push('single disabled category / hidden tag totals, complete related rows and normal empty state');
  await editSearch();q('#cancel-edit').click();q('#search-categories button').click();
  check(!q('#search-selection').hidden,'Cancel edit disabled current name-result actions');
  check(draft()===draftBefore,'Search edit/cancel lost original expense draft');q('#search-selection-back').click();
  q('#search-tags button').click();await editSearch('search-selection-results');q('#cancel-edit').click();q('#search-selection-back').click();q('#search-tags button').click();
  check(!q('#search-selection').hidden&&draft()===draftBefore,'Related edit/cancel cannot return to working tag results and original draft');q('#search-selection-back').click();
  lines.push('expense and related-result edit/cancel retain original draft and leave name actions usable');
  let reads=0;IDBDatabase.prototype.transaction=function(...args){if(this.name===name)reads++;return transaction.apply(this,args);};
  form.elements.start.value='2024-03-01';form.elements.end.value='2024-02-29';form.requestSubmit();await wait(()=>q('#search-error').textContent.length>0);check(reads===0&&form.elements.start.value==='2024-03-01','Invalid date queried or lost draft');
  form.elements.start.value='2024-02-29';form.elements.end.value='2024-02-29';form.requestSubmit();await wait(()=>q('#search-count').textContent.includes('70'));check(reads===1,'Groups did not use one snapshot');
  form.elements.keyword.value='沒有符合';form.requestSubmit();await wait(()=>q('#search-count').textContent.includes('沒有符合'));check(q('#search-categories').textContent.includes('沒有符合')&&q('#search-tags').textContent.includes('沒有符合'),'Missing grouped empty state');
  IDBDatabase.prototype.transaction=transaction;lines.push('strict retained dates reject before read; all groups share one readonly snapshot; empty results normal');
  form.elements.keyword.value='預算';form.elements.start.value='';form.elements.end.value='';form.requestSubmit();await wait(()=>q('#search-functions button'));
  [...q('#search-functions').querySelectorAll('button')].find(button=>button.textContent==='預算').click();check(!q('#view-planning').hidden&&q('#budget-settings').open&&document.activeElement===q('#budget-settings summary'),'Function jump does not open/focus the actual feature');
  check(draft()===draftBefore,'Function jump lost expense input');lines.push('real feature target opens correct region/disclosure and focuses without writes');
  q('#view-planning [data-search-open]').click();form.elements.keyword.value='備份';form.requestSubmit();await wait(()=>!q('#search-groups').hidden&&[...q('#search-functions').querySelectorAll('button')].some(button=>button.textContent.includes('備份')));
  q('#search-functions button').click();check(!q('#view-settings').hidden&&document.activeElement===q('#download-backup')&&q('#export-panel').hidden,'Backup feature search triggered a download instead of focusing its real entry');
  q('[data-view-button=planning]').click();lines.push('backup feature is discoverable; navigation only focuses the entry without opening/downloading');
  q('#view-planning [data-search-open]').click();form.elements.keyword.value='收入';form.requestSubmit();
  await wait(()=>[...q('#search-functions').querySelectorAll('button')].some(button=>button.textContent.includes('新增已收到的收入')));
  [...q('#search-functions').querySelectorAll('button')].find(button=>button.textContent.includes('新增已收到的收入')).click();
  check(!q('#view-record').hidden&&!q('#income-record-section').hidden&&q('#expense-entry').hidden&&document.activeElement===q('#income-form-title'),'Income feature jump focuses a hidden entry');
  q('#view-record [data-search-open]').click();form.elements.keyword.value='記錄消費';form.requestSubmit();
  await wait(()=>[...q('#search-functions').querySelectorAll('button')].some(button=>button.textContent==='記錄消費'));
  [...q('#search-functions').querySelectorAll('button')].find(button=>button.textContent==='記錄消費').click();
  check(!q('#expense-entry').hidden&&q('#income-record-section').hidden&&document.activeElement===q('#form-title'),'Expense feature jump focuses a hidden entry');
  q('[data-view-button=planning]').click();lines.push('shared recording feature links reveal their own visible forms');
  q('#view-planning [data-search-open]').click();q('#site-search-back').click();q('[data-view-button=record]').click();q('#home-search-keyword').value='';
  let blankReads=0;IDBDatabase.prototype.transaction=function(...args){if(this.name===name)blankReads++;return transaction.apply(this,args);};
  q('#view-record [data-search-open]').click();await wait(()=>!q('#search-groups').hidden);check(q('#search-selection').hidden&&blankReads===1&&q('#search-functions button')&&q('#search-tags button'),'Blank browse must use one readonly snapshot and show current groups');IDBDatabase.prototype.transaction=transaction;
  lines.push('cleared keyword explicitly browses current groups from one readonly snapshot');
  form.elements.keyword.value='旅行';form.requestSubmit();await wait(()=>q('#search-count').textContent.includes('70'));
  {
    let held=null,first=true;const old=q('#search-categories button'),descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&first&&args[1]==='readonly'){first=false;Object.defineProperty(tx,'oncomplete',{set(fn){descriptor.set.call(tx,event=>{held=()=>fn.call(tx,event);});},get(){return descriptor.get.call(tx);}});}return tx;};
    form.elements.start.value='2025-01-01';form.requestSubmit();await wait(()=>held!==null);
    check(q('#search-groups').hidden,'Pending query leaves old result actions visible');old.click();check(q('#search-selection').hidden,'Stale category click cancels newer query');held();await wait(()=>q('#search-count').textContent.includes('沒有符合'));IDBDatabase.prototype.transaction=transaction;
    form.elements.start.value='';form.requestSubmit();await wait(()=>q('#search-count').textContent.includes('70'));
    lines.push('pending changed-date search hides old actions; stale click cannot cancel latest query');
  }
  q('#view-planning [data-search-open]').click();let release=null,first=true;
  const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
  IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&first&&args[1]==='readonly'){first=false;Object.defineProperty(tx,'oncomplete',{set(fn){descriptor.set.call(tx,event=>{release=()=>fn.call(tx,event);});},get(){return descriptor.get.call(tx);}});}return tx;};
  form.elements.keyword.value='旅行';form.requestSubmit();await wait(()=>release!==null);form.elements.keyword.value='預算';form.elements.keyword.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>q('#search-functions button')&&q('#search-count').textContent.includes('沒有符合'));release();await new Promise(resolve=>setTimeout(resolve,30));
  check(q('#search-functions button')&&q('#search-count').textContent.includes('沒有符合'),'Older read replaced latest input');IDBDatabase.prototype.transaction=transaction;
  lines.push('out-of-order completed readonly requests cannot replace latest input results');
  form.elements.keyword.value='<img src=x';form.requestSubmit();await wait(()=>q('#search-results').textContent.includes('<img src=x'));check(!q('#view-search img,#view-search svg')&&location.href===originalUrl,'User text executed HTML/entered URL');
  IDBDatabase.prototype.transaction=function(...args){if(this.name===name&&args[1]==='readonly')throw new Error('PRIVATE TOKEN DATABASE PATH');return transaction.apply(this,args);};
  try{form.requestSubmit();await wait(()=>q('#search-error').textContent.length>0);check(!q('#search-error').textContent.includes('PRIVATE')&&form.elements.keyword.value==='<img src=x','Read error leaked or lost input');}finally{IDBDatabase.prototype.transaction=transaction;}
  lines.push('read failure uses a safe fixed message and preserves entered conditions');
  check(draft()===draftBefore&&await raw()===before&&new TextDecoder().decode(await ledger.exportPortableBackup(db))===backup,'Search/navigation changed draft, rows, metadata or full backup');
  lines.push('safe text, unchanged original draft and exact full raw ledger/backup before and after');
  {
    let held=null,first=true;const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&first&&args[1]==='readonly'){first=false;Object.defineProperty(tx,'oncomplete',{set(fn){descriptor.set.call(tx,event=>{held=()=>fn.call(tx,event);});},get(){return descriptor.get.call(tx);}});}return tx;};
    q('#calendar-prev').click();await wait(()=>held!==null);IDBDatabase.prototype.transaction=transaction;
    await ledger.addExpense(db,{amount:'.29',note:'跨頁新增搜尋合成',spent_on:ledger.taiwanToday(),category:'餐飲',payment_source_id:s.payment_sources.find(row=>row.active===1).id},ledger.taiwanToday());
    const peerRaw=await raw(),peerBackup=new TextDecoder().decode(await ledger.exportPortableBackup(db));
    form.elements.keyword.value='跨頁新增搜尋合成';form.requestSubmit();await wait(()=>q('#search-count').textContent.includes('1 筆'));held();await new Promise(resolve=>setTimeout(resolve,30));
    check(q('#search-count').textContent.includes('1 筆'),'Old calendar snapshot overwrote newer search');
    check(await raw()===peerRaw&&new TextDecoder().decode(await ledger.exportPortableBackup(db))===peerBackup,'Readonly refresh changed the peer baseline');
    lines.push('delayed calendar cannot overwrite newer search; explicit synthetic peer write is followed by a fresh unchanged baseline');
  }
  report.textContent='PASS：'+lines.length+' 組全站搜尋原生畫面驗證\n'+lines.join('\n');
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');throw error;}
finally{IDBDatabase.prototype.transaction=transaction;db.close();}
