import * as ledger from '../local-first/ledger.mjs';
import {emptyData} from '../local-first/backup.mjs';
import {STORES,addState} from '../local-first/idb.mjs';
const q=s=>document.querySelector(s),check=(ok,message)=>{if(!ok)throw Error(message);};
const wait=async f=>{for(let i=0;i<350;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('Budget hints timeout');};
const report=document.createElement('pre');report.id='hints-test-result';document.body.prepend(report);
const demo=location.pathname.endsWith('-demo.html');
const open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-budget-hints-'+(demo?'demo':crypto.randomUUID());indexedDB.open=(v,version)=>open(v===ledger.DB_NAME?name:v,version);
const db=await ledger.openDatabase(),today=ledger.taiwanToday(),month=today.slice(0,7),transaction=IDBDatabase.prototype.transaction;
const raw=async()=>{const rows={},tx=db.transaction(STORES,'readonly');for(const store of STORES)tx.objectStore(store).getAll().onsuccess=e=>rows[store]=e.target.result;await new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=j;});return JSON.stringify(STORES.map(s=>rows[s]),(_k,v)=>typeof v==='bigint'?String(v):v);};
const bytes=()=>ledger.exportPortableBackup(db).then(b=>new TextDecoder().decode(b));
try{
 const state={...emptyData(10),format:'local-first-test-ledger',version:11,owner:'local-test-owner',payment_sources:[{id:'p_cash',name:'現金',active:1}]};
 state.budgets=[{month,category:'總額',cents:'10000'},{month,category:'餐飲',cents:'10000'},{month:'2024-01',category:'總額',cents:'1800000'},{month:'2024-02',category:'總額',cents:'0'},{month:'2024-03',category:'餐飲',cents:'100'}];
 state.expenses=[{id:'e_hint',spent_on:today,cents:'9000',category:'餐飲',note:'<img src=x onerror=alert(1)> 合成',source:'manual',kind:'consumption',voided:0,revision:0,recurring_id:null,period:null,payment_source_id:'p_cash',payment_source_name:'現金'}];
 if(!demo||await ledger.readLedgerIfPresent(db)===null){const seed=db.transaction(STORES,'readwrite');addState(seed,state);await new Promise((r,j)=>{seed.oncomplete=r;seed.onabort=j;});}const before=await raw(),backup=await bytes();
 await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
 if(!demo){
 q('#budget-near-enabled').checked=true;q('#budget-near-enabled').dispatchEvent(new Event('change',{bubbles:true}));
 check(q('#budget-total').textContent.includes('即將用完 · 剩餘 10 元'),'Missing precise near-limit status');
 check(q('#category-budget-list').textContent.includes('即將用完'),'Category status missing');
 q('[data-view-button=planning]').click();q('#income-planning').open=true;await wait(()=>q('#income-summary').textContent.includes(month));
 q('#allocation-details').open=true;check(q('#allocation-budget').textContent.includes('本月支出預算：100 元')&&!q('#allocation-budget-link').hidden,'Current allocation budget missing');
 const draft=q('#allocation-items input[name=amount]')||q('#allocation-items input[inputmode=decimal]');check(draft,'Allocation amount input missing');draft.value='999';draft.dispatchEvent(new Event('input',{bubbles:true}));
 q('#allocation-budget-link').click();check(q('#budget-settings').open&&document.activeElement===q('#budget-settings summary')&&draft.value==='999','Navigation loses draft or focus');q('#budget-allocation-back').click();check(q('#income-planning').open&&draft.value==='999'&&document.activeElement===q('#income-planning summary'),'Return loses draft');
 q('#budget-near-enabled').click();check(!q('#budget-total').textContent.includes('即將用完')&&q('#budget-total').textContent.includes('剩餘 10 元'),'Switch changes facts');
 const {loadBudgetPreferences}=await import('../local-first/budget-preferences.mjs');check(loadBudgetPreferences(localStorage).near===false,'Preference not reloadable');
 const setItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('PRIVATE-STORAGE');};q('#budget-near-enabled').click();Storage.prototype.setItem=setItem;check(!q('#budget-near-enabled').checked&&q('#budget-preference-status').textContent.includes('未能儲存')&&!q('#budget-preference-status').textContent.includes('PRIVATE'),'Write failure falsely saves or leaks');
 check(await raw()===before&&await bytes()===backup,'Preference or navigation altered ledger/meta/backup');
 // Reset dirty only by saving the deliberately over-income independent plan.
 draft.value='999';q('#allocation-form').requestSubmit();await wait(()=>q('#status').textContent.includes('儲存完成'));
 const saved=await ledger.readLedger(db);check(saved.budgets.find(r=>r.month===month&&r.category==='總額').cents==='10000','Allocation alters budget');
 const afterSave=await raw(),backupSave=await bytes();
 const set=async m=>{q('#income-month-form').elements.month.value=m;q('#income-month-form').requestSubmit();await wait(()=>q('#income-summary h3').textContent===m);};
 await set('2024-01');check(q('#allocation-budget').textContent.includes('2024-01 支出預算：18,000 元')&&q('#allocation-budget-link').hidden,'Historical budget wrong or editable');
 await set('2024-02');check(q('#allocation-budget').textContent.includes('0 元')&&!q('#allocation-budget').hidden,'Zero total treated as unset');
 await set('2024-03');check(q('#allocation-budget').hidden,'Category-only invents total');await set('2024-04');check(q('#allocation-budget').hidden,'Unset budget displayed');
 let release;IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&args[1]==='readonly'){Object.defineProperty(tx,'oncomplete',{set(handler){tx.addEventListener('complete',e=>{release=()=>handler.call(tx,e);});}});}return tx;};
 q('#income-month-form').elements.month.value='2024-01';q('#income-month-form').requestSubmit();await wait(()=>release);IDBDatabase.prototype.transaction=transaction;await set('2024-02');release();await new Promise(r=>setTimeout(r,20));check(q('#income-summary h3').textContent==='2024-02'&&q('#allocation-budget').textContent.includes('0 元'),'Late read replaces selected budget');
 check(await raw()===afterSave&&await bytes()===backupSave,'Readonly navigation or preference changes ledger/meta/backup');
 check(before!==afterSave&&backup!==backupSave,'Explicit allocation save not persisted');
 const {defaultHomePreferences,saveHomePreferences}=await import('../local-first/home-preferences.mjs');const home=defaultHomePreferences();home.visible.budget=false;saveHomePreferences(localStorage,home);q('[data-view-button=settings]').click();q('#home-order [data-block=budget] input').checked=false;q('#home-order [data-block=budget] input').dispatchEvent(new Event('change',{bubbles:true}));q('#home-preferences-form').requestSubmit();check(q('[data-home-block=budget]').hidden,'Home budget not hidden');q('#budget-near-enabled').click();check(q('[data-home-block=budget]').hidden,'Hint reveals hidden home budget');
 const full=await ledger.readLedger(db);await ledger.editExpense(db,'e_hint',0,{amount:'100',note:full.expenses[0].note,category:'餐飲',spent_on:today,payment_source_id:'p_cash'},today);
 // Reload the page's state through the existing selected-month read, then perform a UI write to refresh all summaries.
 await set(month);q('[data-view-button=record]').click();q('#expense-form').elements.note.value='合成更新';q('#expense-form').elements.amount.value='.01';q('#save').click();await wait(()=>q('#budget-total').textContent.includes('已超支 0.01 元'));check(q('[data-home-block=budget]').hidden,'Write reveals hidden budget');
 const row=q('#expenses [data-expense-id=e_hint]');[...row.querySelectorAll('button')].find(b=>b.textContent==='刪除').click();q('#confirm-delete').click();await wait(()=>q('#budget-total').textContent.includes('剩餘 99.99 元'));check(q('[data-home-block=budget]').hidden,'Void reveals hidden budget');
 report.textContent='PASS：selected months/zero/category-only; exact total/category hints; current navigation/return/draft; switch reload/write failure; independent over-income allocation; readonly raw/meta/backup unchanged';db.close();
 }else{report.hidden=true;db.close();}
}catch(error){report.textContent='FAIL：'+error.message;db.close();}finally{IDBDatabase.prototype.transaction=transaction;}
