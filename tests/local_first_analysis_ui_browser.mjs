import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let n=0;n<400;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Analysis UI timeout');};
const report=document.createElement('pre');report.id='analysis-test-result';document.body.prepend(report);
const open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-analysis-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase();await ledger.initializeLedger(db);const today=ledger.taiwanToday(),payment=(await ledger.readLedger(db)).payment_sources[0].id;
await ledger.updateCategory(db,(await ledger.readLedger(db)).categories,'add',null,'合成分類');
await ledger.addExpense(db,{amount:'.03',note:'另一項合成資料',spent_on:'2024-03-01',category:'合成分類',payment_source_id:payment},today,'analysis_custom');
for(let i=0;i<65;i++)await ledger.addExpense(db,{amount:'.01',note:'<img src=x onerror=alert(1)> Lunch [x]',spent_on:'2024-03-01',category:'餐飲',payment_source_id:payment},today,'analysis_'+i);
await ledger.addExpense(db,{amount:'.29',note:'Lunch [x]',spent_on:'2024-06-01',category:'交通',payment_source_id:payment},today,'analysis_june');
const raw=async()=>{const rows={},tx=db.transaction(STORES,'readonly');for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const backup=async()=>new TextDecoder().decode(await ledger.exportPortableBackup(db)),lines=[];
try{
  const before=await raw(),bytes=await backup();await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  q('#expense-form').elements.note.value='普通記帳草稿';q('[data-view-button=analysis]').click();
  check(q('#analysis-form'),'Missing expense analysis entry');
  check(getComputedStyle(q('#analysis-trend')).display==='none','Trend fields visible in custom comparison');
  const form=q('#analysis-form'),range=group=>group.querySelectorAll('[data-range]'),groups=()=>[...q('#analysis-groups').children];
  const set=(group,start,end)=>{const row=range(group)[0];row.querySelector('[name=start]').value=start;row.querySelector('[name=end]').value=end;};
  set(groups()[0],'2024-03-01','2024-03-01');set(groups()[1],'2024-06-01','2024-06-01');form.elements.keyword.value='lunch [x]';form.requestSubmit();await wait(()=>q('#analysis-results').textContent.includes('0.65 元')&&!q('#analysis-submit').disabled);
  check(q('#analysis-results').textContent.includes('0.29 元'),'Disjoint group totals lost');
  if(new URLSearchParams(location.search).get('case')==='resource-failure'){
    check(q('#analysis-chart-status').textContent.includes('圖表無法載入')&&!q('#analysis-results canvas'),'Failed resource did not fall back');check(await raw()===before&&await backup()===bytes,'Failure fallback modified ledger');report.textContent='PASS：1 組真實本機圖表503降級；精確表格、帳本與完整備份不變';
  }else{
  check(q('#analysis-results').querySelectorAll('canvas').length===1,'Main chart duplicated');lines.push('disjoint periods and exact totals; one main local chart');
  q('#analysis-results [data-period]').click();q('#analysis-detail details summary').click();check(q('#analysis-detail').textContent.includes('65 筆'),'Detail uses a fifty-row query limit');q('#analysis-detail button[data-more]').click();check(q('#analysis-detail').textContent.includes('<img')&&!q('#analysis-detail img'),'Detail lost records or XSS');lines.push('complete detail and safe malicious text');
  groups()[0].querySelector('[data-add-range]').click();const extra=range(groups()[0])[1];extra.querySelector('[name=start]').value='2024-06-01';extra.querySelector('[name=end]').value='2024-06-01';
  q('#analysis-add-group').click();check(groups().length===3,'Cannot add third comparison group');set(groups()[2],'2024-03-01','2024-06-01');form.requestSubmit();await wait(()=>q('#analysis-results').textContent.includes('重疊')&&!q('#analysis-submit').disabled);check(q('#analysis-results').textContent.includes('0.94 元'),'Multi-range group total wrong');lines.push('three groups, multiple periods and explicit overlap');
  form.elements.chart.value='line';form.elements.chart.dispatchEvent(new Event('change'));await wait(()=>q('#analysis-results canvas')?.getAttribute('aria-label').includes('折線'));
  form.elements.chart.value='pie';form.elements.chart.dispatchEvent(new Event('change'));await wait(()=>q('#analysis-results canvas')?.getAttribute('aria-label').includes('分類占比'));lines.push('bar/line and selected-period pie replace a single chart');
  const chart=globalThis.Chart;globalThis.Chart=class{constructor(){throw new Error('synthetic chart failure');}};form.elements.chart.value='bar';form.elements.chart.dispatchEvent(new Event('change'));await wait(()=>q('#analysis-chart-status').textContent.includes('圖表無法載入'));check(q('#analysis-results').textContent.includes('0.94 元'),'Chart failure removed precise table');globalThis.Chart=chart;lines.push('chart failure preserves readable text and table');
  form.elements.mode.value='trend';form.elements.mode.dispatchEvent(new Event('change'));form.elements.trend_start.value='2024-01-01';form.elements.trend_end.value='2024-06-30';form.elements.unit.value='year';form.elements.unit.dispatchEvent(new Event('change'));await wait(()=>q('#analysis-results').textContent.includes('2024-12-31')&&!q('#analysis-submit').disabled);lines.push('unit change recomputes whole year; trend uses one unit');
  form.elements.trend_start.value='9999-01-01';form.elements.trend_end.value='9999-01-01';form.requestSubmit();await wait(()=>q('#analysis-results').textContent.includes('尚未開始'));check(q('#analysis-results').textContent.includes('無法計算')&&!/NaN|Infinity/.test(q('#analysis-results').textContent),'Future fabricated averages');
  form.elements.trend_start.value='2024-03-01';form.elements.trend_end.value='2024-02-01';form.requestSubmit();await wait(()=>q('#analysis-error').textContent.length>0);check(form.elements.trend_start.value==='2024-03-01','Invalid draft erased');lines.push('future and invalid input keep honest status and draft');
  q('[data-view-button=record]').click();check(q('#expense-form').elements.note.value==='普通記帳草稿','Analysis erased recording draft');check(await raw()===before&&await backup()===bytes,'Analysis modified rows/meta/full backup');lines.push('readonly navigation and analysis preserve full backup and metadata');
  q('[data-view-button=analysis]').click();form.elements.mode.value='trend';form.elements.mode.dispatchEvent(new Event('change'));form.elements.unit.value='month';form.elements.trend_start.value='2024-03-01';form.elements.trend_end.value='2024-03-31';form.requestSubmit();await wait(()=>!q('#analysis-submit').disabled&&q('#analysis-results').textContent.includes('0.65 元'));
  const transaction=IDBDatabase.prototype.transaction;let release=null,held=false;
  IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(!held&&this.name===name&&args[1]==='readonly'){held=true;Object.defineProperty(tx,'oncomplete',{set(handler){tx.addEventListener('complete',event=>{release=()=>handler.call(tx,event);});}});}return tx;};
  form.requestSubmit();await wait(()=>release!==null);IDBDatabase.prototype.transaction=transaction;
  q('[data-view-button=record]').click();const expense=q('#expense-form');expense.elements.amount.value='.01';expense.elements.note.value='Lunch [x] 合成競態';expense.elements.spent_on.value='2024-03-01';q('#save').click();await wait(()=>q('#status').textContent.includes('儲存完成'));release();await new Promise(resolve=>setTimeout(resolve,50));
  check(q('#analysis-results').textContent.includes('0.66 元')&&!q('#analysis-submit').disabled,'Old snapshot overwrote post-save analysis');lines.push('delayed readonly response cannot overwrite committed expense refresh');
  q('[data-view-button=analysis]').click();form.elements.mode.value='trend';form.elements.mode.dispatchEvent(new Event('change'));form.elements.trend_start.value='2024-03-01';form.elements.trend_end.value='2024-03-31';form.elements.keyword.value='';form.elements.chart.value='bar';form.elements.unit.value='month';
  for(const original of ['合成分類','餐飲']){
    for(const input of q('#analysis-categories').querySelectorAll('input'))input.checked=input.value===original;
    form.requestSubmit();await wait(()=>!q('#analysis-submit').disabled&&q('#analysis-results').textContent.includes(original==='餐飲'?'0.66 元':'0.03 元'));
    q('[data-view-button=settings]').click();[...q('#category-list').querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='更改分類：'+original).click();q('#setting-name').value='改名'+original;q('#confirm-setting').click();
    await wait(()=>q('#status').textContent.includes('儲存完成')||q('#settings-error').textContent.includes('畫面更新未完成'));
    check(!q('#fields').disabled,'Category rename blocks writes');check(q('#analysis-results').textContent.includes(original==='餐飲'?'0.66 元':'0.03 元'),'Renamed category lost analysis total');check([...q('#analysis-categories').querySelectorAll('input:checked')].some(input=>input.value==='改名'+original),'Category filter was not migrated');q('[data-view-button=analysis]').click();
  }
  lines.push('custom and built-in rename migrate filter/query without blocking ordinary writes');
  report.textContent='PASS：'+lines.length+' 組支出分析畫面\n'+lines.join('\n');
  }
}catch(error){report.textContent='FAIL：'+error.message;throw error;}finally{db.close();}
