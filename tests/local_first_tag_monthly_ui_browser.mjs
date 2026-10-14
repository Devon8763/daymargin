import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<350;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Tag monthly UI timeout');};
const report=document.createElement('pre');report.id='tag-monthly-test-result';document.body.prepend(report);
const open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-tag-monthly-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),today=ledger.taiwanToday(),lines=[];await ledger.initializeLedger(db);
const payment=(await ledger.readLedger(db)).payment_sources[0].id;
await ledger.addExpense(db,{amount:'.01',note:'合成帳目',spent_on:'2024-01-01',category:'餐飲',payment_source_id:payment,tags:{ids:[],names:['<img src=x onerror=alert(1)>聚餐']}},today,'monthly_0');
const tag=(await ledger.readLedger(db)).tags[0];
for(let i=1;i<65;i++)await ledger.addExpense(db,{amount:'.01',note:'合成帳目 '+i,spent_on:'2024-01-01',category:'餐飲',payment_source_id:payment,tags:{ids:[tag.id],names:[]}},today,'monthly_'+i);
for(const [id,date,amount]of [['b','2024-02-29','.35'],['d','2024-04-01','.20']])await ledger.addExpense(db,{amount,note:'合成帳目 '+id,spent_on:date,category:'交通',payment_source_id:payment,tags:{ids:[tag.id],names:[]}},today,'monthly_'+id);
await ledger.updateTag(db,'hide',tag.id,(await ledger.readLedger(db)).tags[0].revision);
const backup=async()=>new TextDecoder().decode(await ledger.exportPortableBackup(db));
const raw=async()=>{const tx=db.transaction(STORES,'readonly'),rows={};for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
try{
  const original=await raw(),bytes=await backup();await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);q('[data-view-button=analysis]').click();
  q('#analysis-choice').value='tag';q('#analysis-choice').dispatchEvent(new Event('change'));
  check(q('#tag-monthly-results'),'Missing monthly tag analysis');
  const form=q('#tag-query');form.elements.tag_id.value=tag.id;form.elements.start.value='2024-01-01';form.elements.end.value='2024-06-30';
  const transaction=IDBDatabase.prototype.transaction;let reads=0;IDBDatabase.prototype.transaction=function(...args){if(this.name===name&&args[1]==='readonly')reads++;return transaction.apply(this,args);};
  try{form.requestSubmit();await wait(()=>q('#tag-month-count').textContent.includes('有消費 3')&&!form.querySelector('button').disabled);check(reads===1,'Monthly data reads inconsistent snapshots');}finally{IDBDatabase.prototype.transaction=transaction;}
  check(q('#tag-summary').textContent.includes('1.2 元')&&q('#tag-extra-summary').textContent.includes('0.65 元')&&q('#tag-monthly-summary').textContent.includes('0.2 元')&&q('#tag-monthly-summary').textContent.includes('0.4 元'),'Monthly totals, extrema or average basis wrong');
  check(!q('#tag-monthly-results img')&&!q('#tag-summary img'),'Tag name rendered as HTML');lines.push('single hidden tag, six months / three spending months, exact total, two averages and one readonly snapshot');
  if(new URLSearchParams(location.search).get('case')==='resource-failure'){
    await wait(()=>q('#tag-chart-status').textContent.includes('圖表無法載入'));check(q('#tag-monthly-table tbody').children.length===6&&await raw()===original&&await backup()===bytes,'Failed chart removed precise data or changed ledger');
    report.textContent='PASS：1 組真實503標籤圖表降級，精確數據及帳本不變';
  }else{
    await wait(()=>q('#tag-monthly-results canvas'));check(q('#tag-monthly-results canvas').getAttribute('aria-label').includes('長條'),'Monthly default is not a bar chart');
    q('#tag-chart-kind').value='line';q('#tag-chart-kind').dispatchEvent(new Event('change'));await wait(()=>q('#tag-monthly-results canvas')?.getAttribute('aria-label').includes('折線'));lines.push('one locally loaded bar / line chart; zero months remain in both series');
    q('#tag-monthly-data').open=true;q('#tag-monthly-table [data-tag-month="2024-01"]').click();
    check(q('#tag-expense-details').open&&q('#tag-expense-caption').textContent.includes('65')&&q('#tag-results').children.length===50,'Month drilldown lost complete rows');q('#tag-more').click();check(q('#tag-results').children.length===65,'Month display limit affects total');q('#tag-all-expenses').click();check(q('#tag-expense-caption').textContent.includes('67'),'Cannot return to all selected accounts');lines.push('monthly table opens complete month details, fifty-row batches and all-results return');
    form.elements.start.value='2024-03-01';form.elements.end.value='2024-05-31';form.requestSubmit();await wait(()=>q('#tag-summary').textContent.includes('0.2 元')&&!form.querySelector('button').disabled);check(q('#tag-month-count').textContent.includes('有消費 1')&&q('#tag-monthly-summary').textContent.includes('約 0.07 元'),'Arbitrary month range or zero-month denominator wrong');
    const Chart=globalThis.Chart;globalThis.Chart=class{constructor(){throw new Error('synthetic-private');}};try{q('#tag-chart-kind').value='bar';q('#tag-chart-kind').dispatchEvent(new Event('change'));await wait(()=>q('#tag-chart-status').textContent.includes('圖表無法載入'));check(!q('#tag-chart-status').textContent.includes('synthetic-private')&&q('#tag-monthly-table tbody').children.length===3,'Unsafe failed chart');}finally{globalThis.Chart=Chart;}lines.push('arbitrary date ranges and chart failure retain exact table without exposing failure details');
    reads=0;IDBDatabase.prototype.transaction=function(...args){if(this.name===name)reads++;return transaction.apply(this,args);};try{form.elements.start.value='2024-07-01';form.elements.end.value='2024-06-30';form.requestSubmit();await wait(()=>q('#tag-query-error').textContent.length>0);check(reads===0&&form.elements.start.value==='2024-07-01','Invalid dates queried or lost input');}finally{IDBDatabase.prototype.transaction=transaction;}
    form.elements.start.value='9999-01-01';form.elements.end.value='9999-03-31';form.requestSubmit();await wait(()=>q('#tag-summary').textContent.includes('尚未開始'));check(q('#tag-monthly-summary').textContent.includes('無法計算')&&!/NaN|Infinity/.test(q('#tag-monthly-results').textContent),'Future represented as actual zero');lines.push('invalid retained dates stop before reading; future months have no invented average');
    let held=false;IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name===name&&args[1]==='readonly'&&!held){held=true;Object.defineProperty(tx,'oncomplete',{set(callback){tx.addEventListener('complete',event=>setTimeout(()=>callback.call(tx,event),150));}});}return tx;};
    try{form.elements.start.value='2024-01-01';form.elements.end.value='2024-06-30';form.requestSubmit();form.elements.start.value='2024-04-01';form.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,200));check(q('#tag-summary').textContent.includes('請按查詢')&&!q('#tag-monthly-results canvas'),'Delayed old range reappeared after input changed');}finally{IDBDatabase.prototype.transaction=transaction;}
    form.elements.end.value='2024-06-30';form.requestSubmit();await wait(()=>!form.querySelector('button').disabled&&q('#tag-summary').textContent.includes('0.2 元'));check(await raw()===original&&await backup()===bytes,'Readonly analysis changed full ledger or backup');lines.push('changed input invalidates delayed reads; original stores, metadata and backup remain exact');
    report.textContent='PASS：'+lines.length+' 組每月標籤分析畫面\n'+lines.join('\n');
  }
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db.close();}
