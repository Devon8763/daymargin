import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('UI timeout');};
const report=document.createElement('pre');report.id='comparison-rename-result';document.body.prepend(report);
const lines=[],name=ledger.DB_NAME+'-comparison-rename-'+crypto.randomUUID(),open=indexedDB.open.bind(indexedDB);
indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),today=ledger.taiwanToday();
const raw=async()=>{const tx=db.transaction(STORES,'readonly'),rows={};for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const summary=()=>[...q('#comparison-results').querySelectorAll(':scope > p')].map(row=>row.textContent).join('\n');
const formData=form=>JSON.stringify(Object.fromEntries(new FormData(form)));
try{
  check(Number(location.port)>=19000,'Use a fresh synthetic source');await ledger.initializeLedger(db);
  for(const category of ['F02 original','F02 other'])await ledger.updateCategory(db,(await ledger.readLedger(db)).categories,'add',null,category);
  const payment=(await ledger.readLedger(db)).payment_sources.find(row=>row.name==='現金').id;
  for(const [id,spent_on,amount,category]of [['e_f02_a','2024-02-01','1.23','F02 original'],['e_f02_b','2024-01-01','.29','F02 original'],['e_f02_other','2024-02-01','.50','F02 other']])
    await ledger.addExpense(db,{amount,note:'F02 match '+id,category,payment_source_id:payment,spent_on},today,id);
  await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  q('[data-view-button="analysis"]').click();q('#analysis-advanced').open=true;q('#legacy-comparison').open=true;
  const form=q('#comparison-form');
  const query=async category=>{for(const [key,value]of Object.entries({a_start:'2024-02-01',a_end:'2024-02-29',b_start:'2024-01-01',b_end:'2024-01-31',keyword:'F02 match',category}))form.elements[key].value=value;
    form.requestSubmit();await wait(()=>!form.querySelector('button').disabled);check(q('#comparison-error').textContent===''&&q('#comparison-results').children.length,'Comparison query failed');};
  const rename=async(oldName,newName)=>{q('[data-view-button="settings"]').click();q('#category-list button[aria-label="更改分類：'+oldName+'"]').click();q('#setting-name').value=newName;q('#settings-form').requestSubmit();await wait(()=>!q('#status').textContent.includes('正在儲存'));};
  const selectedEntries=state=>state.expenses.filter(row=>row.id.startsWith('e_f02_')).map(({id,cents,note,spent_on})=>({id,cents,note,spent_on}));
  await query('F02 original');const before=summary(),entries=JSON.stringify(selectedEntries(await ledger.readLedger(db)));
  check(before.includes('1.23 元，1 筆')&&before.includes('0.29 元，1 筆'),'Incorrect synthetic baseline');
  await rename('F02 original','F02 renamed');
  check(!q('#fields').disabled,'F02: successful category rename locked writes while refreshing old comparison');
  check(form.elements.category.value==='F02 renamed'&&summary()===before,'Renamed form/query lost exact totals or fell back to all');
  check(JSON.stringify(selectedEntries(await ledger.readLedger(db)))===entries,'Rename changed selected accounts');
  lines.push('renamed submitted query and selected form preserve exact totals, counts and account identities');
  await query('F02 renamed');
  const expense=q('#expense-form');expense.elements.amount.value='.01';expense.elements.note.value='F02 ordinary write';expense.elements.category.value='F02 other';expense.requestSubmit();await wait(()=>!q('#status').textContent.includes('正在儲存'));
  check(q('#status').textContent.includes('儲存完成')&&summary()===before,'Cannot continue writing/comparing after rename');
  lines.push('ordinary expense save and explicit comparison remain available after rename');
  form.elements.category.value='F02 other';form.elements.keyword.value='未提交關鍵字';form.elements.a_start.value='2023-02-01';
  const draft=formData(form);await rename('F02 renamed','F02 second');
  check(!q('#fields').disabled&&formData(form)===draft&&summary()===before,'Unsubmitted unrelated category/date/keyword draft was changed or used as query');
  form.elements.category.value='F02 second';await rename('F02 second','F02 third');
  const migrated=JSON.parse(draft);migrated.category='F02 third';
  check(formData(form)===JSON.stringify(migrated)&&summary()===before,'Matching draft category migration cleared other draft fields');
  lines.push('matching category alone migrates; unrelated category, dates and keyword drafts stay untouched');
  await query('');const all=summary();await rename('F02 third','F02 fourth');
  check(form.elements.category.value===''&&summary()===all&&!q('#fields').disabled,'All-category query changed');
  await query('F02 other');const other=summary();form.elements.category.value='F02 fourth';form.elements.keyword.value='另一草稿';
  await rename('F02 fourth','F02 fifth');
  check(form.elements.category.value==='F02 fifth'&&form.elements.keyword.value==='另一草稿'&&summary()===other&&!q('#fields').disabled,'Other-category committed query was changed');
  lines.push('all-category and other-category committed queries remain independent from the draft');
  await query('F02 fifth');const failureBefore=await raw(),formBefore=formData(form),put=IDBObjectStore.prototype.put;let injected=false;
  IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name===name){injected=true;throw new DOMException('private-test-detail','QuotaExceededError');}return put.apply(this,args);};
  try{await rename('F02 fifth','F02 rejected');}finally{IDBObjectStore.prototype.put=put;}
  check(injected&&await raw()===failureBefore&&formData(form)===formBefore,'Failed transaction changed data or comparison selection');
  check(q('#settings-dialog').open&&q('#setting-name').value==='F02 rejected'&&!q('#fields').disabled&&q('#setting-error').textContent,'Failed rename pretended success or lost retry');
  q('#cancel-setting').click();lines.push('native category-rename failure preserves raw stores/metadata, query, form and retry input');
  const list=q('#expenses'),replace=list.replaceChildren;let refreshFailed=false;
  list.replaceChildren=function(){refreshFailed=true;throw new Error('synthetic post-commit render failure');};
  try{await rename('F02 fifth','F02 committed');}finally{list.replaceChildren=replace;}
  check(refreshFailed&&(await ledger.readLedger(db)).categories.some(row=>row.name==='F02 committed'),'Post-commit failure was not reached after a real commit');
  check(q('#fields').disabled&&q('#settings-fields').disabled&&q('#status').textContent.includes('資料已儲存，但畫面更新未完成'),'Genuine post-commit failure no longer locks writes');
  const locked=await raw();expense.elements.note.value='must not write';expense.requestSubmit();
  check(await raw()===locked,'Locked form wrote again');lines.push('genuine committed-but-render-failed protection still locks writes and prevents duplicate submission');
  report.dataset.done='pass';report.textContent='PASS F02 '+lines.length+' groups\n'+lines.join('\n');
}catch(failure){report.dataset.done='fail';report.textContent='FAIL F02: '+failure.message+'\n'+lines.join('\n');}
finally{db.close();}
