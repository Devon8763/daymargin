import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Usability test timeout');};
const report=document.createElement('pre');report.id='usability-result';document.body.prepend(report);
const mode=new URLSearchParams(location.search).get('case')||'all',open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-usability-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),lines=[];await ledger.initializeLedger(db);
const today=ledger.taiwanToday(),payment=(await ledger.readLedger(db)).payment_sources[0].id;
await ledger.addExpense(db,{amount:'3',note:'<img src=x onerror=alert(1)>合成追蹤',spent_on:'2024-02-29',category:'餐飲',payment_source_id:payment,usage:{started_on:'2024-02-29',days:3,remind:1,reminder_days:7,show_daily_cost:1,active:1}},today,'e_active');
await ledger.addExpense(db,{amount:'3',note:'合成停止追蹤',spent_on:'2024-02-29',category:'餐飲',payment_source_id:payment,usage:{started_on:'2024-02-29',days:3,remind:1,reminder_days:7,show_daily_cost:1,active:1}},today,'e_stopped');
await ledger.editExpense(db,'e_stopped',0,{amount:'3',note:'合成停止追蹤',spent_on:'2024-02-29',category:'餐飲',payment_source_id:'',usage:null},today);
const raw=async()=>{const rows={},tx=db.transaction(STORES,'readonly');for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?{bigint:String(value)}:value);};
const bytes=async()=>new TextDecoder().decode(await ledger.exportPortableBackup(db)),nav=view=>q('[data-view-button="'+view+'"]').click();
const run=async(label,action)=>{if(mode==='all'||mode===label){await action();lines.push(label);}};
try {
  const initial=await raw(),initialBackup=await bytes();await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  await run('help',async()=>{
    nav('record');const form=q('#expense-form');form.elements.amount.value='1.23';form.elements.note.value='原合成草稿';q('#usage-inputs').open=true;nav('planning');q('#budget-settings').open=true;q('#fixed-settings').open=true;q('#fixed-form').elements.name.value='定期合成草稿';nav('settings');
    check(q('[data-help-link]')&&q('#instructions-view'),'Missing one help page');
    const before=await raw(),backup=await bytes(),transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args){if(this.name===name)throw new Error('Pure help/navigation accessed storage');return transaction.apply(this,args);};
    try{q('[data-help-link]').click();q('[data-help-link]').click();check(!q('#instructions-view').hidden&&q('#privacy-view').hidden&&document.activeElement===q('#instructions-title'),'Help not independent/focused');q('#instructions-back').click();check(!q('#view-settings').hidden&&!q('#ledger-page').hidden&&document.activeElement===q('[data-help-link]'),'Help back loses focus');nav('record');nav('planning');}
    finally{IDBDatabase.prototype.transaction=transaction;}
    check(form.elements.note.value==='原合成草稿'&&q('#fixed-form').elements.name.value==='定期合成草稿'&&q('#budget-settings').open&&q('#fixed-settings').open&&q('#usage-inputs').open,'Navigation changed drafts/disclosures');
    check(await raw()===before&&await bytes()===backup,'Help changed rows/meta/backup');
    check(q('#instructions-view').textContent.includes('區分大小寫、忽略前後空白與開頭 #／＃，一次新增一個標籤'),'Tag rule not consolidated');
    check(q('#delete-dialog').textContent.includes('操作紀錄')&&q('#csv-export').textContent.includes('CSV 未加密')&&q('#export-panel').textContent.includes('忘記密碼無法取回'),'Critical risks moved');
  });
  await run('layout',async()=>{
    const blocks=['budget-settings','fixed-settings','income-planning'].map(id=>q('#'+id).closest('section'));
    check(new Set(blocks).size===3&&blocks.every(el=>el.parentElement===q('#view-planning')),'Planning blocks still share a card');
  });
  await run('usage',async()=>{
    const row=q('#expenses [data-expense-id=e_active]'),stopped=q('#expenses [data-expense-id=e_stopped]');
    check(row.textContent.includes('2024-02-29～2024-03-02（可使用 3 天）')&&row.textContent.includes('每日平均成本約 1 元／天'),'Usage range/daily cost incorrect');
    check(stopped.textContent.includes('已停止追蹤')&&!stopped.textContent.includes('2024-03-02'),'Stopped tracking exposes a fake end');
    check(!q('#expenses img'),'Untrusted record became HTML');
  });
  await run('disclosure',async()=>{
    const details=q('#expenses-disclosure');check(details?.tagName==='DETAILS'&&!details.open,'Effective expenses not initially collapsed');details.querySelector('summary').click();check(details.open&&q('#expenses').children.length===2,'Disclosure loses records/actions');
  });
  await run('required',async()=>{
    nav('record');const form=q('#expense-form');
    const visibleMark=el=>[...el.closest('label').querySelectorAll('.required-mark')].some(mark=>!mark.hidden);
    check(form.elements.amount.required&&visibleMark(form.elements.amount)&&!visibleMark(q('#tag-input')),'Required/optional marks incorrect');
    check(form.elements.payment_source_id.required&&visibleMark(form.elements.payment_source_id),'New consumption payment not required');
    check(!form.elements.usage_started_on.required,'Empty usage imposes required start');form.elements.usage_days.value='3';form.elements.usage_days.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>form.elements.usage_started_on.required&&visibleMark(form.elements.usage_started_on));
    check(form.elements.usage_reminder_days.required,'Tracking reminder value not required');form.elements.usage_days.value='';form.elements.usage_days.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>!form.elements.usage_started_on.required);
    nav('planning');const recurring=q('#fixed-form');recurring.elements.kind.value='分期';recurring.elements.kind.dispatchEvent(new Event('change'));await wait(()=>recurring.elements.periods.required&&visibleMark(recurring.elements.periods));recurring.elements.kind.value='固定';recurring.elements.kind.dispatchEvent(new Event('change'));await wait(()=>!recurring.elements.periods.required&&!visibleMark(recurring.elements.periods));
    await wait(()=>recurring.elements.amount.required&&visibleMark(recurring.elements.amount));
    for(const input of q('#allocation-items').querySelectorAll('input'))check(input.required&&visibleMark(input),'Allocation required fields missing');
    check(q('#usage-inputs').textContent.includes('開啟提示')&&!document.body.textContent.includes('選填'),'Optional labels or reminder title not simplified');
    nav('record');q('#expenses-disclosure').open=true;q('#expenses [data-expense-id=e_active] button').click();await wait(()=>!form.elements.payment_source_id.required&&!visibleMark(form.elements.payment_source_id));q('#cancel-edit').click();
    nav('settings');q('#download-backup').click();check(q('#export-password').required&&q('#export-confirm-password').required,'Encrypted password fields not required');q('#export-mode').value='plain';q('#export-mode').dispatchEvent(new Event('change'));await wait(()=>!q('#export-password').required&&q('#export-risk').required);q('#cancel-export').click();
  });
  await run('budget',async()=>{
    check(q('#budget-overview').hidden,'No budgets still shows overview');nav('planning');check(q('#budget-settings').closest('section').parentElement===q('#view-planning'),'Budget settings unavailable');
    q('#budget-settings').open=true;const row=[...q('#budget-setting-list').children].find(row=>row.dataset.category==='餐飲'),form=row.querySelector('form');form.elements.amount.value='100';form.requestSubmit();await wait(()=>q('#budget-setting-list').textContent.includes('100 元'));
    check(!q('#budget-overview').hidden&&q('#budget-total').textContent.includes('尚未設定總預算'),'Category-only budget hidden or treated as total');
  });
  await run('shortcuts',async()=>{
    nav('record');check(!q('#shortcut-quick').textContent.includes('建立操作捷徑')&&q('#shortcut-new'),'Duplicated shortcut create entry');q('#shortcut-settings').open=true;q('#shortcut-new').click();await wait(()=>document.activeElement===q('#shortcut-form').elements.name);
    const fields=q('#shortcut-form').elements;fields.name.value='合成捷徑';fields.note.value='捷徑合成餐點';fields.amount.value='.29';q('#shortcut-form').requestSubmit();await wait(()=>q('#shortcut-quick').textContent.includes('合成捷徑'));
    const edit=[...q('#shortcut-list').querySelectorAll('button')].find(button=>button.textContent==='更改');edit.click();check(document.activeElement===fields.name&&fields.name.value==='合成捷徑','Shortcut edit focus/prefill lost');q('#cancel-shortcut').click();
    const before=await raw(),backup=await bytes();q('#shortcut-quick button').click();await wait(()=>q('#expense-form').elements.note.value==='捷徑合成餐點');check(q('#expense-form').elements.amount.value==='0.29','Shortcut prefill lost exact cents');q('#cancel-edit').click();check(await raw()===before&&await bytes()===backup,'Shortcut prefill/cancel wrote');
  });
  if(!['all','budget','shortcuts'].includes(mode))check(await raw()===initial&&await bytes()===initialBackup,'Presentation changed full ledger');
  report.textContent='PASS：'+lines.length+' 組易用性原生驗證\n'+lines.join('\n');
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');throw error;}
finally{db.close();}
