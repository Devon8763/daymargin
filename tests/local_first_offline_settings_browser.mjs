import {openDatabase,exportPortableBackup} from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const result=document.querySelector('#result'),button=document.querySelector('#check');
const db=await openDatabase();
const before=await exportPortableBackup(db),namesBefore=await caches.keys();
const homePreferencesBefore=localStorage.getItem('daymargin.home.v1'),budgetPreferencesBefore=localStorage.getItem('daymargin.budget.v1');
const raw=async()=>{
  const tx=db.transaction(STORES,'readonly'),data={};
  for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{data[store]=event.target.result;};
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});
  return JSON.stringify(STORES.map(store=>data[store]),(_key,value)=>typeof value==='bigint'?{bigint:value.toString()}:value);
};
const rawBefore=await raw();
const text=bytes=>new TextDecoder().decode(bytes);
button.onclick=async()=>{
  button.disabled=true;
  try {
    const names=await caches.keys(),version='local-first-offline-0.26.6-v1';
    if(!names.includes(version))throw new Error('新版快取尚未啟用');
    const cache=await caches.open(version);
    for(const [path,content] of [['index.html','id="view-search"'],['page.mjs','async function runSearch'],['browse.mjs','function siteSearch'],['index.html','id="budget-category-link"'],['index.html','id="category-management-title"'],['index.html','id="storage-status"'],['index.html','id="view-navigation"'],['index.html','id="privacy-title"'],['index.html','id="expense-tags"'],['index.html','id="tag-analysis"'],['index.html','id="analysis-navigation"'],['page.mjs','function syncAnalysisRange'],['comparison.mjs','function analysisPeriodRange'],['page.mjs',"statistics.id='analysis-statistics'"],['index.html','id="monthly-analysis"'],['browse.mjs','function monthlyAccounts'],['page.mjs','function runMonthlyAccounts'],['page.mjs','function showView'],['rules.mjs','function tagName'],['browse.mjs','function tagReport'],['ledger.mjs','export const updateTag'],['rules.mjs','自動來源消費的原入帳日期不可更改'],
      ['index.html','id="batch-dialog"'],['index.html','id="batch-editor"'],['index.html','id="search-accounts"'],['page.mjs','function renderBatchSelection'],['ledger.mjs','remove_tag_ids'],['ledger.mjs','function changeExpenseBatch'],['browse.mjs','function browseSite'],['schedule.mjs','function scheduleDue'],['annual.mjs',"saved.status === 'pending'"],['usage.mjs','function endingSoon'],['ledger.mjs',"kind === '固定' || operation === 'update'"],['page.mjs','function expenseRow'],['backup.mjs','版本不可更改欄位'],['browse.mjs','function monthBudget'],['csv.mjs','function expenseCsv'],['comparison.mjs','function compareExpenses'],['vendor/chartjs-4.5.1/chart.umd.min.js','Chart.js v4.5.1'],['backup-crypto.mjs','function decryptBackup']]){
      const resource=await cache.match('/local-first/'+path);
      if(!resource||!(await resource.text()).includes(content))throw new Error('離線資源不完整');
    }
    const html=await (await cache.match('/local-first/index.html')).text(),page=await (await cache.match('/local-first/page.mjs')).text();
    if(!html.includes('id="instructions-view"')||!html.includes('id="expenses-disclosure"')||!html.includes('開啟提示')||!page.includes('helpTopics')||!page.includes('!overview.total&&overview.categories.length===0'))throw new Error('新版易用性資源缺失');
    if(!html.includes('id="goal-planning"')||!page.includes('function renderGoals')||!(await(await cache.match('/local-first/ledger.mjs')).text()).includes('function changeGoal')||!(await(await cache.match('/local-first/backup.mjs')).text()).includes('目標已存總額'))throw new Error('目標離線資源缺失');
    if(!html.includes('id="income-recording"')||!html.includes('id="income-recurring"')||!page.includes("homeBlocks.get('record').querySelector('section').append")||!(await(await cache.match('/local-first/ledger.mjs')).text()).includes('function changeIncomePeriod')||!(await(await cache.match('/local-first/income.mjs')).text()).includes('function recurringIncomeItems'))throw new Error('收入與定期收入離線資源缺失');
    if(!html.includes('id="invoice-import"')||!html.includes('包含負數折扣')||!(await(await cache.match('/local-first/csv.mjs')).text()).includes('function invoiceCents')||!(await(await cache.match('/local-first/ledger.mjs')).text()).includes('function changeInvoiceImport')||!(await(await cache.match('/local-first/backup.mjs')).text()).includes("invoice_imports:['key','expense_id']"))throw new Error('發票匯入或完整備份離線資源缺失');
    if(!html.includes('id="calendar-day-type"')||!html.includes('id="calendar-legend"')||!page.includes('day.hasIncome')||!(await(await cache.match('/local-first/browse.mjs')).text()).includes('difference:incomeTotal-expenseTotal,total:expenseTotal'))throw new Error('收入月曆離線資源缺失');
    if(!html.includes('id="search-totals"')||!page.includes('function incomeSearchRow')||!(await(await cache.match('/local-first/browse.mjs')).text()).includes('function searchAccounts'))throw new Error('收支搜尋離線資源缺失');
    if(!html.includes('id="merchant-management"')||!page.includes('function renderMerchantRules')||!(await(await cache.match('/local-first/backup.mjs')).text()).includes("merchant_rules:['id','merchant','category','revision']"))throw new Error('店家規則離線資源缺失');
    if(!html.includes('id="expense-analysis"')||!page.includes('function showAnalysis')||!(await(await cache.match('/local-first/comparison.mjs')).text()).includes('function analyzeExpenses'))throw new Error('支出分析離線資源缺失');
    if(!html.includes('id="home-edit"')||!page.includes('function applyHomePreferences')||!(await(await cache.match('/local-first/home-preferences.mjs')).text()).includes('function loadHomePreferences'))throw new Error('首頁偏好離線資源缺失');
    const paths=(await cache.keys()).map(request=>new URL(request.url));
    const required=new Set(['','index.html','style.css','rules.mjs','schedule.mjs','income.mjs','annual.mjs','usage.mjs','ledger.mjs','page.mjs','home-preferences.mjs','budget-preferences.mjs','browse.mjs','csv.mjs','comparison.mjs','vendor/chartjs-4.5.1/chart.umd.min.js','idb.mjs','backup.mjs','backup-crypto.mjs','vendor/lossless-json-4.3.1/lossless-json.js'].map(path=>'/local-first/'+path));
    if(paths.length!==required.size||paths.some(url=>url.origin!==location.origin||url.search||!required.has(url.pathname)))throw new Error('快取超出必要靜態來源');
    if(names.some(name=>name.startsWith('local-first-offline-')&&name!==version))throw new Error('舊版快取仍在，請關閉舊頁後再試');
    if(text(await exportPortableBackup(db))!==text(before)||rawBefore!==await raw())throw new Error('唯讀檢查期間帳本改變');
    if(localStorage.getItem('daymargin.budget.v1')!==budgetPreferencesBefore)throw new Error('唯讀更新期間預算偏好改變');
    if(localStorage.getItem('daymargin.home.v1')!==homePreferencesBefore)throw new Error('唯讀更新期間首頁偏好改變');
    result.textContent='PASS：0.26.6-v1 全站搜尋、分組與分類／標籤明細及全部 20 個離線資源；原始資料列、metadata 與備份逐位元組不變'+(namesBefore.some(name=>name.startsWith('local-first-offline-')&&name!==version)?'；原生 Service Worker 更新完成':'');
  }catch(error){result.textContent='FAIL：'+error.message;}
  finally{button.disabled=false;}
};
button.click();
window.addEventListener('pagehide',()=>db.close());
