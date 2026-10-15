import {openDatabase,readLedgerIfPresent,restorePortableBackup,exportPortableBackup,updateSchedule,updateGoal,updateAllocation,updateIncomeRule,processIncomePeriod,updateIncome,updateMerchantRule,importInvoiceExpenses,taiwanToday,readLedger} from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
import {SYNTHETIC,RELEASE,validateScenario,assertVersionResponse} from './local_first_version_scenarios.mjs';
const q=id=>document.querySelector('#'+id),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out');};
const text=bytes=>new TextDecoder().decode(bytes);
const scenarioName=new URLSearchParams(location.search).get('scenario')??'synthetic';
check(['synthetic','release'].includes(scenarioName),'Unknown update scenario');
const scenario=scenarioName==='release'?RELEASE:SYNTHETIC;validateScenario(scenario);
const responseVersions=async expected=>{
  for(const path of ['/local-first/','/local-first/sw.js']){const response=await fetch(path,{cache:'no-store'});check(response.ok,'Missing scenario response');assertVersionResponse(path,await response.text(),expected);}
};
const raw=async db=>{
  const tx=db.transaction(STORES,'readonly'),rows={};
  for(const name of STORES)tx.objectStore(name).getAll().onsuccess=event=>{rows[name]=event.target.result;};
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
  return JSON.stringify(STORES.map(name=>rows[name]),(_key,value)=>typeof value==='bigint'?{bigint:String(value)}:value);
};
const stage=(button,operation)=>{q(button).onclick=async()=>{q(button).disabled=true;try{await operation();}catch{q('result').textContent='FAIL：'+button;}finally{q(button).disabled=false;}};};
let db,a,b,newPage,backupBefore,rawBefore;
const unchanged=async()=>{
  check(text(await exportPortableBackup(db))===backupBefore,'Backup changed');
  check(await raw(db)===rawBefore,'Rows or metadata changed');
};
try{
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Use a fresh isolated test origin');
  db=await openDatabase();check(await readLedgerIfPresent(db)===null,'Refusing a nonempty origin');
  await restorePortableBackup(db,new Uint8Array(await (await fetch('/tests/fixtures/portable_life_ledger.json')).arrayBuffer()),true);
  const today=taiwanToday();
  await updateSchedule(db,'add','y_update',null,{kind:'年度費用',name:'合成更新年度',amount:'.29',category:'餐飲',payment_source_id:(await readLedger(db)).payment_sources.find(row=>row.active===1).id,first_due_on:today,unit:'year',every:1,periods:0});
  await updateSchedule(db,'disable','y_update',0,null);
  await updateGoal(db,'add','g_update',null,{name:'合成更新目標',target_amount:'100',saved_amount:'0',deadline:'',remind:0,completed:0});
  await updateAllocation(db,today.slice(0,7),null,[{id:'save',name:'合成目標分配',amount:'.29',goal_id:'g_update'}],{g_update:0});
  await updateIncomeRule(db,'add','ir_update',null,{name:'合成更新收入',amount:'.29',first_due_on:today,due_day:Number(today.slice(8))});
  await processIncomePeriod(db,'ir_update',today.slice(0,7),0,null,'skip');
  await processIncomePeriod(db,'ir_update',today.slice(0,7),0,0,'restore');
  await updateIncome(db,'add','i_search_update',null,{name:'合成更新實收',amount:'.29',received_on:today});
  await updateMerchantRule(db,'add',null,null,{merchant:'合成更新店',category:'餐飲'});
  await importInvoiceExpenses(db,[{number:'AB00000301',date:today,form:{spent_on:today,amount:'.29',note:'合成更新發票',category:'發票',payment_source_id:(await readLedger(db)).payment_sources.find(row=>row.active===1).id}}]);
  backupBefore=text(await exportPortableBackup(db));rawBefore=await raw(db);
  q('open-a').disabled=false;q('open-b').disabled=false;
  q('result').textContent='READY：'+scenario.label+'；二十五類合成資料已建立；帳本與備份基準保留在記憶體';
}catch{q('result').textContent='FAIL：isolated setup';}
const analysisReady=async page=>{
  const doc=page.document;doc.querySelector('[data-view-button=analysis]').click();
  const groups=doc.querySelector('#analysis-groups').children;
  check(groups.length===2&&groups[0].contains(doc.getElementById(groups[0].dataset.primaryRange)),'Period cards missing');
  check(groups[0].querySelector('[data-quick-range]').value==='month'&&groups[1].querySelector('[data-quick-range]').value==='previous','Offline preset mismatch');
  doc.querySelector('#analysis-form').requestSubmit();await wait(()=>!doc.querySelector('#analysis-submit').disabled&&doc.querySelector('#analysis-key-summary'));
  check(doc.querySelector('#analysis-error').textContent===''&&doc.querySelectorAll('#analysis-results canvas').length===1,'Offline analysis/chart missing');
  doc.querySelector('#analysis-monthly-entry').click();await wait(()=>doc.querySelector('#monthly-summary').textContent.includes('0.29 元'));
  check(doc.querySelector('#monthly-summary [data-total=income]').textContent==='0.29 元'&&doc.querySelector('#monthly-summary [data-total=expense]').textContent==='0.29 元'&&doc.querySelector('#monthly-summary [data-total=difference]').textContent==='0 元'&&!doc.querySelector('#monthly-analysis canvas'),'Monthly offline totals wrong');
  doc.querySelector('[data-view-button=record]').click();
};
const opened=async page=>{check(page,'Popup blocked');await wait(()=>page.document.querySelector('#ledger-page')?.hidden===false);};
// window.open must remain synchronous in each explicit click to preserve user activation.
q('open-a').onclick=()=>{a=window.open('/local-first/');q('open-a').disabled=true;q('check-old').disabled=false;};
q('open-b').onclick=()=>{b=window.open('/local-first/');q('open-b').disabled=true;};
stage('check-old',async()=>{
  await opened(a);await opened(b);
  await responseVersions(scenario.old);
  for(const [page,draft] of [[a,'未送出合成草稿 A'],[b,'未送出合成草稿 B']]){
    check(page.document.querySelector('#page-version').textContent==='目前使用頁面版本：'+scenario.old.version,'Wrong old page version');
    page.document.querySelector('#expense-form').elements.note.value=draft;
    check(!page.document.querySelector('#expenses img'),'Imported markup executed');
  }
  await wait(()=>a.navigator.serviceWorker.controller&&b.navigator.serviceWorker.controller);
  a.document.querySelector('#view-record [data-search-open]').click();await wait(()=>!a.document.querySelector('#search-groups').hidden);
  check(a.document.querySelector('#search-results [data-income-id="i_search_update"]')&&a.document.querySelector('#search-totals').textContent.includes('收入合計：0.29 元'),'mixed query missing');
  a.document.querySelector('#site-search-back').click();
  const day=a.document.querySelector('#calendar-grid [data-day="'+taiwanToday()+'"]');check(day.textContent.includes('＋'),'income calendar marker missing');day.click();check(a.document.querySelector('#calendar-day-total').textContent.includes('收入合計：＋0.29 元'),'income calendar total missing');
  await analysisReady(a);await unchanged();q('check-waiting').disabled=false;q('check-failure').disabled=false;
  q('result').textContent='PASS：'+scenario.label+'；舊版 '+scenario.old.version+' 控制兩頁、二十五類唯讀及惡意文字安全；草稿未儲存';
});
stage('check-failure',async()=>{
  await responseVersions(scenario.next);
  const registration=await navigator.serviceWorker.getRegistration('/local-first/');await registration.update();
  for(const [page,draft] of [[a,'未送出合成草稿 A'],[b,'未送出合成草稿 B']]){
    await wait(()=>page.document.querySelector('#update-status').textContent.includes('新版安裝未完成'));
    check(page.document.querySelector('#page-version').textContent==='目前使用頁面版本：'+scenario.old.version,'Failed update changed version');
    check(page.document.querySelector('#expense-form').elements.note.value===draft,'Failed update lost draft');
  }
  check(registration.waiting===null,'Failed update is waiting');
  check(JSON.stringify(await caches.keys())===JSON.stringify([scenario.old.cache]),'Failed cache retained or old cache removed');
  await unchanged();
  q('result').textContent='PASS：缺少 Chart.js 時新版安裝失敗、沒有等待／不完整快取；舊頁、草稿、帳本與備份不變';
});
stage('check-waiting',async()=>{
  await responseVersions(scenario.next);
  const registration=await navigator.serviceWorker.getRegistration('/local-first/');await registration.update();
  await wait(()=>registration.waiting?.state==='installed');
  for(const [page,draft] of [[a,'未送出合成草稿 A'],[b,'未送出合成草稿 B']]){
    check(page.document.querySelector('#page-version').textContent==='目前使用頁面版本：'+scenario.old.version,'Waiting changed page version');
    await wait(()=>page.document.querySelector('#update-status').textContent.includes('新版已下載，關閉此來源所有頁籤／視窗後重新開啟才會使用新版'));
    check(page.document.querySelector('#expense-form').elements.note.value===draft,'Draft lost');
    check(page.navigator.serviceWorker.controller.state==='activated'&&page.navigator.serviceWorker.controller!==registration.waiting,'Waiting replaced old controller');
  }
  await unchanged();q('close-a').disabled=false;
  q('result').textContent='PASS：新版完整下載但仍等待，兩頁維持 '+scenario.old.version+' 與原草稿；帳本／備份逐位元組不變';
});
stage('close-a',async()=>{
  a.close();const registration=await navigator.serviceWorker.getRegistration('/local-first/');
  check(registration.waiting?.state==='installed','Activated while old page remains');
  check(b.document.querySelector('#expense-form').elements.note.value==='未送出合成草稿 B','Remaining draft lost');
  await unchanged();q('close-b').disabled=false;
  q('result').textContent='PASS：只關閉一頁，新版仍等待，另一頁草稿與帳本不變';
});
stage('close-b',async()=>{
  b.close();const registration=await navigator.serviceWorker.getRegistration('/local-first/');
  await wait(()=>registration.waiting===null&&registration.active?.state==='activated');
  await unchanged();q('open-new').disabled=false;
  q('result').textContent='PASS：全部舊頁關閉後自然啟用，沒有 skipWaiting 或重新整理；帳本不變';
});
q('open-new').onclick=()=>{newPage=window.open('/local-first/');q('check-new').disabled=false;};
stage('check-new',async()=>{
  await opened(newPage);
  check(newPage.document.querySelector('#page-version').textContent==='目前使用頁面版本：'+scenario.next.version,'New cached page version not loaded');
  check(!newPage.document.querySelector('#update-status').textContent.includes('新版已下載'),'New page still claims waiting');
  await wait(()=>newPage.document.querySelector('#offline-status').textContent.includes('可離線重新開啟'));
  const names=await caches.keys();check(names.length===1&&names[0]===scenario.next.cache,'Wrong activated cache');
  const cache=await caches.open(names[0]),paths=(await cache.keys()).map(request=>new URL(request.url));
  assertVersionResponse('/local-first/',await(await cache.match('/local-first/index.html')).text(),scenario.next);
  check(paths.length===20&&paths.every(url=>url.origin===location.origin&&!url.search&&url.pathname.startsWith('/local-first/')),'Static cache contains extra content');
  newPage.document.querySelector('#view-record [data-search-open]').click();await wait(()=>!newPage.document.querySelector('#search-groups').hidden);
  check(newPage.document.querySelector('#search-results [data-income-id="i_search_update"]')&&newPage.document.querySelector('#search-totals').textContent.includes('收入合計：0.29 元'),'offline income search missing');
  newPage.document.querySelector('#site-search-back').click();const day=newPage.document.querySelector('#calendar-grid [data-day="'+taiwanToday()+'"]');check(day.textContent.includes('＋'),'offline income marker missing');day.click();check(newPage.document.querySelector('#calendar-day-total').textContent.includes('收入合計：＋0.29 元'),'offline income day missing');
  await analysisReady(newPage);await unchanged();
  q('result').textContent='PASS：'+scenario.label+'；停服後同網址離線冷啟動顯示 '+scenario.next.version+'；20 靜態資源、二十五類原始列／metadata／完整備份逐位元組不變';
});
window.addEventListener('pagehide',()=>{db?.close();a?.close();b?.close();newPage?.close();});
