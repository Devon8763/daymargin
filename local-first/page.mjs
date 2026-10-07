import { openDatabase, readLedgerIfPresent, readLedger, initializeLedger, restorePortableBackup, exportPortableBackup, addExpense, editExpense, voidExpense, updateCategory, updatePayment, updateBudget, updateRecurring, updateIncome, updateAllocation, excludeSuggestion, updateAnnual, processAnnual, updateShortcut, shortcutDraft, updateTag, taiwanToday, LedgerError } from './ledger.mjs';
import { readBackup, validateStorageLimits, MAX_BYTES, integerValue, storedInteger } from './backup.mjs';
import {encryptBackup,decryptBackup,isEncryptedBackup,inspectEncryptedBackup,confirmBackupPassword,MAX_ENCRYPTED_BYTES,EncryptedBackupError} from './backup-crypto.mjs';
import { categoryOptions, categoryName, cents, orderedShortcuts, tagName, tagSuggestions, fixedNextMonth, fixedSettings, fixedView, recurringProgress, ValidationError } from './rules.mjs';
import { activeExpenses, validateSearch, searchExpenses, calendarMonth, monthBudget, tagReport, validateTagQuery } from './browse.mjs';
import { validateCsvRange, expenseCsv } from './csv.mjs';
import {comparisonDefaults,comparisonCategories,validateComparison,compareExpenses,comparisonDay,canPlotComparison} from './comparison.mjs';
import {incomeMonth, recurringSuggestions, defaultAllocation, allocationMonth} from './income.mjs';
import {annualItems,annualReserve} from './annual.mjs';
import {endingSoon,usageEnd,dailyCost} from './usage.mjs';

const form = document.querySelector('#expense-form');
const fields = document.querySelector('#fields');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const list = document.querySelector('#expenses');
const dialog = document.querySelector('#delete-dialog');
const welcome = document.querySelector('#welcome');
const ledgerPage = document.querySelector('#ledger-page');
const management = document.querySelector('#data-management');
const restoreFile = document.querySelector('#restore-file');
const review = document.querySelector('#restore-review');
let db, state, editing = null, deleting = null, busy = false, writeBlocked = false;
let editingOrigin = null, deletingOrigin = null;
let expenseSubmissionId=null,usageStartChosen=false;
const viewNavigation=document.querySelector('#view-navigation'),privacyView=document.querySelector('#privacy-view');
let privacyReturn=null;
// Move the original nodes once: forms, listeners, disclosures and internal hidden flags are retained.
const categorySection=document.createElement('section');categorySection.setAttribute('aria-label','分類與付款方式');
categorySection.append(document.querySelector('#settings-fields'),document.querySelector('#settings-error'));
document.querySelector('#view-settings').append(categorySection);
document.querySelector('#ledger-settings').prepend(document.querySelector('#budget-settings'));
for(const [view,selectors] of [
  ['record',['#expense-form','#shortcut-quick','#ending-soon','#budget-overview','#expenses','#search-form','#calendar-grid']],
  ['planning',['#ledger-settings','#income-planning','#annual-management']],
  ['analysis',['#expense-comparison','#tag-analysis']],['settings',['#data-management','#tag-settings']]])
  for(const selector of selectors)document.querySelector('#view-'+view).append(document.querySelector(selector).closest('section'));
document.querySelector('#view-planning-title').after(document.querySelector('#planning-links'));
function closePrivacy(focus=true) {
  if(!privacyReturn)return;
  const previous=privacyReturn;privacyReturn=null;privacyView.hidden=true;
  ledgerPage.hidden=previous.ledgerHidden;welcome.hidden=previous.welcomeHidden;
  if(focus)previous.trigger.focus();
}
function showView(view,focus=true) {
  const panel=document.querySelector('#view-'+view);if(!panel?.hasAttribute('data-view'))return;
  closePrivacy(false);
  for(const item of document.querySelectorAll('[data-view]'))item.hidden=item!==panel;
  for(const button of viewNavigation.querySelectorAll('button'))button.setAttribute('aria-current',button.dataset.viewButton===view?'page':'false');
  if(focus)document.querySelector('#view-'+view+'-title').focus();
  if(view==='analysis')for(const chart of comparisonCharts)chart.resize();
}
for(const button of viewNavigation.querySelectorAll('button'))button.onclick=()=>showView(button.dataset.viewButton);
for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',event=>{
  if(link.hasAttribute('data-privacy-link')) {
    event.preventDefault();if(busy)return;
    privacyReturn={trigger:link,ledgerHidden:ledgerPage.hidden,welcomeHidden:welcome.hidden};
    ledgerPage.hidden=true;welcome.hidden=true;privacyView.hidden=false;
    document.querySelector('#privacy-back').textContent=privacyReturn.ledgerHidden?'返回首次使用':'返回設定';
    document.querySelector('#privacy-title').focus();return;
  }
  const target=document.getElementById(link.getAttribute('href').slice(1));
  const view=target?.closest('[data-view]');
  if(view)showView(view.dataset.view,false);
  if(link.id==='budget-category-link'||link.id==='category-budget-back') {
    event.preventDefault();
    (target.id==='budget-settings'?target.querySelector('summary'):target).focus();
  }
});
document.querySelector('#privacy-back').onclick=()=>closePrivacy();
let pendingBackup = null, selection = 0;
let pendingEncrypted = null, exportSelection = 0;
const decryptForm=document.querySelector('#decrypt-form'),decryptPanel=document.querySelector('#decrypt-panel');
const restorePassword=document.querySelector('#restore-password'),passwordError=document.querySelector('#restore-password-error');
const exportForm=document.querySelector('#export-form'),exportPanel=document.querySelector('#export-panel');
const exportMode=document.querySelector('#export-mode'),exportError=document.querySelector('#export-error');
const csvForm = document.querySelector('#csv-form');
const csvError = document.querySelector('#csv-error'), csvStatus = document.querySelector('#csv-status');
const csvToday = taiwanToday();
csvForm.elements.start.value = csvToday.slice(0, 7) + '-01';
csvForm.elements.end.value = csvToday;
let searchRows = [], searchShown = 0, lastQuery = null, calendarData = null, selectedDay = null,searchSnapshot=null,calendarSnapshot=null;
let calendarShown = 0;
let viewedMonth = null;
const settingsDialog = document.querySelector('#settings-dialog');
let setting = null;
const fixedForm = document.querySelector('#fixed-form');
const fixedStopDialog = document.querySelector('#fixed-stop-dialog');
let fixedEditing = null, fixedStopping = null;
const storageStatus = document.querySelector('#storage-status');
const persistenceButton = document.querySelector('#request-persistence');
let persistenceRequested = false;
async function storageState() {
  try {
    if (typeof navigator.storage?.persisted !== 'function') {
      storageStatus.textContent = '本來源瀏覽器不支援持久保存狀態查詢。';
      return;
    }
    const granted = await navigator.storage.persisted();
    storageStatus.textContent = granted ? '本來源已獲准持久保存。' : '本來源未獲准持久保存。';
    if (!granted && typeof navigator.storage.persist !== 'function') storageStatus.textContent += '此瀏覽器不支援申請。';
    persistenceButton.disabled = granted || typeof navigator.storage.persist !== 'function';
  } catch {
    storageStatus.textContent = '本來源儲存狀態查詢失敗；無法確認是否獲准持久保存。';
  }
}
persistenceButton.onclick = async () => {
  if (persistenceRequested || persistenceButton.disabled) return;
  persistenceRequested = true; persistenceButton.disabled = true;
  storageStatus.textContent = '正在申請本來源持久保存……';
  try {
    storageStatus.textContent = await navigator.storage.persist()
      ? '本來源已獲准持久保存。' : '本來源未獲准持久保存；本次不再重複申請。';
  } catch {
    storageStatus.textContent = '本次申請結果無法確認；請保留手動備份，本次不再重複申請。';
  }
};
storageState(); // Query only; requesting permission requires the explicit button.

function amountText(value, grouped = true) {
  const total = typeof value === 'bigint' ? value : cents(value);
  const whole = (total / 100n).toString();
  const fraction = (total % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return (grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole) + (fraction ? '.' + fraction : '');
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
const tagInput=document.querySelector('#tag-input'),tagDialog=document.querySelector('#tag-remove-dialog'),tagQueryForm=document.querySelector('#tag-query');
let tagDraft=[],tagDraftState=null,tagRemoving=null,tagCreateId=null,tagQuery=null,tagRows=[],tagShown=0,tagSnapshot=null,tagQueryRequest=0;
function renderTagInput(snapshot=tagDraftState || state) {
  tagDraftState=snapshot;
  tagDraft=tagDraft.map(item=>{const row=item.id===null && snapshot.tags.find(row=>row.name===item.name);return row ? {id:row.id,name:row.name} : item;});
  document.querySelector('#tag-suggestions').replaceChildren(...tagSuggestions(snapshot,tagInput.value).map(row=>{const option=node('option');option.value='#'+row.name;return option;}));
  const selected=document.querySelector('#tag-selected');selected.replaceChildren();
  for(const item of tagDraft) {
    const live=item.id ? snapshot.tags.find(row=>row.id===item.id) : null;
    const button=node('button','#'+item.name+(live?.hidden===1?'（不再顯示）':'')+' ×');button.type='button';button.setAttribute('aria-label','移除這筆消費的標籤：'+item.name);
    button.onclick=()=>{if(!busy){tagDraft=tagDraft.filter(row=>row!==item);renderTagInput();(document.querySelector('#tag-selected button') || tagInput).focus();}};selected.append(button);
  }
  document.querySelector('#tag-options').replaceChildren(...tagSuggestions(snapshot).map(row=>{
    const label=node('label','#'+row.name,'tag-choice'),input=node('input');input.type='checkbox';input.value=row.id;input.checked=tagDraft.some(item=>item.id===row.id);
    input.onchange=()=>{if(busy)return;tagDraft=tagDraft.filter(item=>item.id!==row.id);if(input.checked)tagDraft.push({id:row.id,name:row.name});document.querySelector('#cancel-edit').hidden=false;renderTagInput();document.querySelector('#tag-options input[value="'+row.id+'"]').focus();};
    label.prepend(input);return label;
  }));
}
function tagFields(id=null,snapshot=state) {
  const ids=new Set((snapshot.expense_tags || []).filter(row=>row.expense_id===id).map(row=>row.tag_id));
  tagDraft=(snapshot.tags || []).filter(row=>ids.has(row.id)).map(row=>({id:row.id,name:row.name}));tagInput.value='';
  document.querySelector('#expense-tags').open=tagDraft.length>0;renderTagInput(snapshot);
}
function addTagDraft() {
  if(!tagInput.value.trim())return;
  const name=tagName(tagInput.value),existing=(tagDraftState || state).tags.find(row=>row.name===name);
  if(!tagDraft.some(row=>row.name===name))tagDraft.push({id:existing?.id ?? null,name});
  tagInput.value='';document.querySelector('#cancel-edit').hidden=false;renderTagInput();
}
document.querySelector('#tag-draft-add').onclick=()=>{if(busy)return;try{addTagDraft();error.textContent='';}catch(failure){error.textContent=failure instanceof ValidationError?failure.message:'請輸入有效標籤。';}};
tagInput.oninput=()=>renderTagInput();tagInput.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();document.querySelector('#tag-draft-add').click();}};
function showTagReport(snapshot,query,today) {
  const result=tagReport(snapshot,query,today),tag=snapshot.tags.find(row=>row.id===query.tag_id);tagSnapshot=snapshot;tagRows=result.rows;tagShown=0;
  document.querySelector('#tag-summary').textContent='#'+tag.name+(tag.hidden?'（不再顯示，仍含歷史）':'')+'：'+amountText(result.total)+' 元，'+result.rows.length+' 筆；'+(query.start||'全部時間')+' ～ '+(query.end||today);
  document.querySelector('#tag-results').replaceChildren();tagShown=appendBatch(tagRows,document.querySelector('#tag-results'),document.querySelector('#tag-more'),tagShown,snapshot);
}
function renderTags() {
  renderTagInput(state);
  const select=tagQueryForm.elements.tag_id,value=select.value,options=[node('option','請選擇一個標籤')];options[0].value='';
  for(const row of state.tags){const option=node('option','#'+row.name+(row.hidden?'（不再顯示）':''));option.value=row.id;options.push(option);}select.replaceChildren(...options);if(state.tags.some(row=>row.id===value))select.value=value;
  const list=document.querySelector('#tag-list');list.replaceChildren();if(!state.tags.length)list.append(node('li','尚無標籤。'));
  for(const row of state.tags) {
    const item=node('li');item.append(node('span','#'+row.name+(row.hidden?'（不再顯示）':'')));
    for(const [operation,label] of [[row.hidden?'show':'hide',row.hidden?'重新顯示':'不再顯示'],['remove','移除']]) {
      const button=node('button',label);button.type='button';button.dataset.operation=operation;
      button.onclick=()=>{if(busy||writeBlocked)return;if(operation==='remove'){tagRemoving=structuredClone(row);document.querySelector('#tag-remove-error').textContent='';document.querySelector('#tag-remove-summary').textContent='#'+row.name+'：會取消 '+state.expense_tags.filter(link=>link.tag_id===row.id).length+' 筆帳目關聯。';tagDialog.showModal();}else saving(()=>updateTag(db,operation,row.id,row.revision),()=>{},document.querySelector('#tag-settings-error'));};item.append(button);
    }list.append(item);
  }
  if(tagQuery) {
    if(state.tags.some(row=>row.id===tagQuery.tag_id))showTagReport(state,tagQuery,taiwanToday());
    else {tagQuery=null;tagRows=[];document.querySelector('#tag-results').replaceChildren();document.querySelector('#tag-summary').textContent='此標籤已移除，請重新選擇。';document.querySelector('#tag-more').hidden=true;}
  }
}
document.querySelector('#tag-add').onsubmit=event=>{event.preventDefault();tagCreateId??='t_'+crypto.randomUUID();const id=tagCreateId,value=event.currentTarget.elements.name.value;saving(()=>updateTag(db,'add',id,null,value),()=>{document.querySelector('#tag-add').reset();tagCreateId=null;},document.querySelector('#tag-settings-error'));};
document.querySelector('#cancel-tag-remove').onclick=()=>{if(!busy)tagDialog.close();};tagDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});tagDialog.addEventListener('close',()=>{if(!tagDialog.open)tagRemoving=null;});
document.querySelector('#confirm-tag-remove').onclick=()=>{if(!tagRemoving||busy)return;const item=tagRemoving;saving(()=>updateTag(db,'remove',item.id,item.revision),()=>tagDialog.close(),document.querySelector('#tag-remove-error'));};
tagQueryForm.onsubmit=async event=>{
  event.preventDefault();const button=tagQueryForm.querySelector('button');if(button.disabled)return;button.disabled=true;document.querySelector('#tag-query-error').textContent='';const request=++tagQueryRequest;
  try{if(!tagQueryForm.elements.start.validity.valid||!tagQueryForm.elements.end.validity.valid)throw new ValidationError('請輸入有效日期。');const query=Object.fromEntries(new FormData(tagQueryForm)),today=taiwanToday();validateTagQuery(query,today);const snapshot=await readLedger(db);if(request!==tagQueryRequest)return;showTagReport(snapshot,query,today);tagQuery=query;}
  catch(failure){if(request===tagQueryRequest)document.querySelector('#tag-query-error').textContent=failure instanceof ValidationError?failure.message:'無法查看標籤消費，請重新載入後再試。';}
  finally{button.disabled=false;}
};
document.querySelector('#tag-more').onclick=()=>{tagShown=appendBatch(tagRows,document.querySelector('#tag-results'),document.querySelector('#tag-more'),tagShown,tagSnapshot);};
const shortcutForm=document.querySelector('#shortcut-form'),shortcutError=document.querySelector('#shortcut-error');
let shortcutEditing=null,shortcutSource=null,shortcutExpected=null,shortcutId=null;
function shortcutChoices(target,snapshot,row=null,message=shortcutError) {
  for(const [key,options,value] of [
    ['category',categoryOptions(snapshot).filter(item=>item.active===1).map(item=>({value:item.name,name:item.name})),row?.category],
    ['payment_source_id',snapshot.payment_sources.filter(item=>item.active===1).map(item=>({value:item.id,name:item.name})),row?.payment_source_id]]) {
    const elements=options.map(item=>{const option=node('option',item.name);option.value=item.value;return option;});
    if(row && !options.some(item=>item.value===value)) {
      const missing=node('option',key==='category' ? value+'（已失效，請改選）' : '原付款方式已失效，請改選');
      missing.value=value ?? '';missing.disabled=true;elements.push(missing);
      message.textContent='分類或付款方式已失效，請改選有效選項；不會自動啟用。';
    }
    target.elements[key].replaceChildren(...elements);if(row)target.elements[key].value=value ?? '';
  }
}
function resetShortcut() {
  shortcutEditing=null;shortcutSource=null;shortcutId=null;shortcutForm.reset();
  shortcutExpected=structuredClone(state.shortcuts);shortcutChoices(shortcutForm,state);
  document.querySelector('#shortcut-form-title').textContent='新增捷徑';
}
async function shortcutRead(action,message=shortcutError) {
  if(busy || writeBlocked)return;
  busy=true;fields.disabled=true;document.querySelector('#shortcut-fields').disabled=true;message.textContent='';
  try {action(await readLedger(db));}
  catch(failure){message.textContent=failure instanceof LedgerError || failure instanceof ValidationError ? failure.message : '無法讀取捷徑，請重新載入後再試。';}
  finally {busy=false;fields.disabled=writeBlocked;document.querySelector('#shortcut-fields').disabled=writeBlocked;}
}
function startShortcut(snapshot,values=null,id=null,source=null) {
  shortcutEditing=id;shortcutSource=source;shortcutId=id || 's_'+crypto.randomUUID();shortcutExpected=structuredClone(snapshot.shortcuts);
  shortcutForm.reset();shortcutChoices(shortcutForm,snapshot,values);
  if(values)for(const key of ['name','note','amount'])shortcutForm.elements[key].value=values[key];
  document.querySelector('#shortcut-form-title').textContent=id ? '更改捷徑' : '新增捷徑';
  document.querySelector('#shortcut-settings').open=true;shortcutForm.elements.name.focus();
}
function applyShortcut(expected) {
  if(editing || annualDraft)return;
  shortcutRead(snapshot=>{
    const row=snapshot.shortcuts.find(item=>item.id===expected.id&&item.active===1);
    if(!row || Object.keys(expected).some(key=>key==='position' ? integerValue(row[key])!==integerValue(expected[key]) : row[key]!==expected[key]))
      throw new LedgerError('conflict','捷徑已變更，請重新載入後再使用。');
    resetForm();shortcutChoices(form,snapshot,row,error);
    form.elements.amount.value=row.cents===null ? '' : amountText(row.cents,false);form.elements.note.value=row.note;
    form.elements.spent_on.value=taiwanToday();usageFields();
    document.querySelector('#save').textContent='記錄消費';document.querySelector('#cancel-edit').hidden=false;
    form.elements.amount.focus();
  },error);
}
function renderShortcuts() {
  if(shortcutExpected===null) {shortcutExpected=structuredClone(state.shortcuts);shortcutChoices(shortcutForm,state);}
  else shortcutChoices(shortcutForm,state,{category:shortcutForm.elements.category.value,payment_source_id:shortcutForm.elements.payment_source_id.value});
  const active=orderedShortcuts(state),quick=document.querySelector('#shortcut-quick'),all=document.querySelector('#shortcut-list');
  quick.replaceChildren();all.replaceChildren();
  if(!active.length) {
    const create=node('button','建立操作捷徑');create.type='button';create.onclick=()=>shortcutRead(snapshot=>startShortcut(snapshot));quick.append(create);
  }
  for(const row of active.slice(0,3)) {
    const button=node('button',row.name);button.type='button';button.disabled=editing!==null||annualDraft!==null;
    button.onclick=()=>applyShortcut(structuredClone(row));quick.append(button);
  }
  for(const row of [...active,...state.shortcuts.filter(item=>item.active!==1)]) {
    const item=node('li');item.dataset.id=row.id;
    const payment=state.payment_sources.find(option=>option.id===row.payment_source_id);
    item.append(node('p',row.name+'｜'+row.note+'｜'+row.category+'｜'+payment.name+(payment.active!==1?'（已失效）':'')+'｜'+(row.cents===null?'金額未設定':amountText(row.cents)+' 元')+(row.active!==1?'｜已停用':'')));
    if(row.active===1)for(const [operation,label] of [['update','更改'],['up','上移'],['down','下移'],['disable','停用']]) {
      const button=node('button',label);button.type='button';button.dataset.operation=operation;
      button.disabled=(operation==='up'&&active[0].id===row.id)||(operation==='down'&&active.at(-1).id===row.id);
      const expected=structuredClone(state.shortcuts);
      button.onclick=()=>{
        if(busy||writeBlocked)return;
        if(operation==='update') {shortcutError.textContent='';startShortcut(state,{...row,amount:row.cents===null?'':amountText(row.cents,false)},row.id);}
        else {
          const known=shortcutExpected.length===expected.length && shortcutExpected.every((item,index)=>
            Object.keys(item).every(key=>key==='position' ? integerValue(item[key])===integerValue(expected[index][key]) : item[key]===expected[index][key]));
          saving(()=>updateShortcut(db,expected,operation,row.id),()=>{if(known)shortcutExpected=structuredClone(state.shortcuts);},shortcutError);
        }
      };item.append(button);
    }
    all.append(item);
  }
}
shortcutForm.onsubmit=event=>{
  event.preventDefault();const expected=shortcutExpected,source=shortcutSource,operation=shortcutEditing?'update':'add';
  shortcutId ??= 's_'+crypto.randomUUID();const id=shortcutId,input=Object.fromEntries(new FormData(shortcutForm));
  saving(()=>updateShortcut(db,expected,operation,id,input,source),resetShortcut,shortcutError);
};
document.querySelector('#cancel-shortcut').onclick=()=>{if(!busy&&!writeBlocked){resetShortcut();shortcutError.textContent='';}};
const annualForm=document.querySelector('#annual-form'),annualPanel=document.querySelector('#annual-management');
const annualError=document.querySelector('#annual-error'),annualDialog=document.querySelector('#annual-dialog');
let annualEditing=null,annualDraftId=null,annualDraft=null,annualAction=null,annualLimit=100;
annualForm.elements.first_year.value=taiwanToday().slice(0,4);
annualForm.elements.due_month.value=Number(taiwanToday().slice(5,7));
annualForm.elements.due_day.value='1';
function annualChoices() {
  for(const [field,rows] of [['category',categoryOptions(state).filter(row=>row.active===1||row.name===annualEditing?.category).map(row=>({value:row.name,name:row.name+(row.active?'':'（已停用）')}))],
    ['payment_source_id',state.payment_sources.filter(row=>row.active===1||row.id===annualEditing?.payment_source_id).map(row=>({value:row.id,name:row.name+(row.active?'':'（已停用）')}))]]) {
    const select=annualForm.elements[field],value=select.value;
    select.replaceChildren(...rows.map(row=>{const option=node('option',row.name);option.value=row.value;return option;}));
    if(rows.some(row=>row.value===value))select.value=value;
  }
}
function resetAnnual() {
  annualForm.reset();annualEditing=null;annualDraftId=null;
  annualForm.elements.first_year.value=taiwanToday().slice(0,4);annualForm.elements.due_month.value=Number(taiwanToday().slice(5,7));annualForm.elements.due_day.value='1';
  document.querySelector('#annual-form-title').textContent='新增年度費用';document.querySelector('#cancel-annual-edit').hidden=true;annualChoices();
}
function askAnnual(operation,item) {
  if(busy||writeBlocked)return;annualAction={operation,item:structuredClone(item)};
  document.querySelector('#annual-dialog-title').textContent=operation==='disable'?'確認停用年度費用':'確認略過今年';
  document.querySelector('#annual-dialog-summary').textContent=operation==='disable'
    ? item.name+'：停止未來新期數，已到期未處理草稿仍保留；不產生或刪除消費。'
    : item.year+'｜'+item.defaults.name+'：只略過這一次，明年仍照常；不產生消費。';
  document.querySelector('#annual-dialog-error').textContent='';annualDialog.showModal();
}
function renderAnnual() {
  annualChoices();const rules=document.querySelector('#annual-rules');rules.replaceChildren();
  if(!state.annual_rules.length)rules.append(node('li','尚未設定年度費用。'));
  for(const rule of state.annual_rules) {
    const row=node('li');row.dataset.annualId=rule.id;
    row.append(node('p',rule.name+'｜'+amountText(rule.cents)+' 元｜每年 '+rule.due_month+'/'+rule.due_day+'｜首次 '+rule.first_year+' 年｜'+rule.category+'｜'+rule.payment_source_name+(rule.active?'':'（已停用）')));
    if(rule.active) {
      const edit=node('button','更改年度費用');edit.type='button';edit.onclick=()=>{
        if(busy||writeBlocked)return;annualEditing=structuredClone(rule);annualDraftId=null;annualChoices();
        for(const key of ['name','category','payment_source_id','first_year','due_month','due_day'])annualForm.elements[key].value=rule[key];
        annualForm.elements.amount.value=amountText(rule.cents,false);document.querySelector('#annual-form-title').textContent='更改年度費用（已開始期數保留原草稿）';
        document.querySelector('#cancel-annual-edit').hidden=false;annualForm.elements.name.focus();
      };
      const stop=node('button','停用年度費用');stop.type='button';stop.onclick=()=>askAnnual('disable',rule);row.append(edit,stop);
    }rules.append(row);
  }
  const periods=document.querySelector('#annual-periods'),result=annualItems(state,taiwanToday(),annualLimit);periods.replaceChildren();
  if(!result.items.length)periods.append(node('li','目前沒有已開始的年度期數。'));
  for(const item of result.items) {
    const row=node('li');row.dataset.annualId=item.annual_id;row.dataset.year=item.year;
    const voided=state.expenses.find(entry=>entry.id===item.expense_id)?.voided===1;
    row.append(node('p',item.year+'｜'+item.defaults.name+'｜原定 '+item.due_on+'｜'+amountText(item.defaults.cents)+' 元｜'+({pending:'待記錄',recorded:'已記錄',skipped:'已略過'}[item.status])+(voided?'（消費已刪除，不會重建）':'')));
    if(item.status==='pending') {
      const record=node('button','記錄消費');record.type='button';record.onclick=()=>{
        if(busy||writeBlocked)return;resetForm();annualDraft=structuredClone(item);
        showView('record',false);
        form.elements.spent_on.value=item.due_on;usageFields(null,item.due_on);form.elements.amount.value=amountText(item.defaults.cents,false);form.elements.note.value=item.defaults.name;
        form.elements.category.value=item.defaults.category;form.elements.payment_source_id.value=item.defaults.payment_source_id;
        document.querySelector('#form-title').textContent='記錄年度費用消費（'+item.year+' 年）';document.querySelector('#save').textContent='記錄消費';document.querySelector('#cancel-edit').hidden=false;
        error.textContent=!form.elements.category.value||!form.elements.payment_source_id.value?'原分類或付款方式已停用，請另選有效項目。':'';
        form.elements.amount.focus();
      };
      const skip=node('button','略過今年');skip.type='button';skip.onclick=()=>askAnnual('skip',item);row.append(record,skip);
    }periods.append(row);
  }
  document.querySelector('#annual-more').hidden=!result.more;
}
document.querySelector('#annual-more').onclick=()=>{if(!busy&&!writeBlocked){annualLimit+=100;renderAnnual();}};
document.querySelector('#annual-entry').onclick=()=>{annualPanel.open=true;};
annualForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  const input=Object.fromEntries(new FormData(annualForm));
  for(const field of ['first_year','due_month','due_day'])input[field]=/^[0-9]{1,4}$/.test(input[field])?Number(input[field]):NaN;
  annualDraftId??='y_'+crypto.randomUUID();
  saving(()=>updateAnnual(db,annualEditing?'update':'add',annualEditing?.id||annualDraftId,annualEditing?.revision??null,input),resetAnnual,annualError);
};
document.querySelector('#cancel-annual-edit').onclick=()=>{if(!busy&&!writeBlocked)resetAnnual();};
document.querySelector('#cancel-annual').onclick=()=>{if(!busy)annualDialog.close();};
annualDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
annualDialog.addEventListener('close',()=>{annualAction=null;});
document.querySelector('#confirm-annual').onclick=()=>{
  if(busy||writeBlocked||!annualAction)return;const {operation,item}=annualAction;
  saving(()=>operation==='disable'?updateAnnual(db,'disable',item.id,item.revision,null)
    :processAnnual(db,'skip',item.annual_id,item.year,item.rule_revision,item.revision,null),()=>annualDialog.close(),document.querySelector('#annual-dialog-error'));
};
const incomePanel=document.querySelector('#income-planning'),incomeForm=document.querySelector('#income-form');
const incomeMonthForm=document.querySelector('#income-month-form'),allocationForm=document.querySelector('#allocation-form');
const incomeError=document.querySelector('#income-error'),incomeVoidDialog=document.querySelector('#income-void-dialog');
let incomeViewedMonth=taiwanToday().slice(0,7),incomeLoaded=false,incomeEditing=null,incomeVoiding=null;
let incomeDraftId=null,allocationExpected=null,allocationDirty=false;
let incomeViewRequest=0;
incomeMonthForm.elements.month.value=incomeViewedMonth;
incomeForm.elements.received_on.value=taiwanToday();
function incomeBusy(disabled) {
  document.querySelector('#income-fields').disabled=disabled;
  for (const id of ['confirm-income-void','cancel-income-void']) document.querySelector('#'+id).disabled=disabled;
}
function allocationRow(item) {
  const row=node('div',undefined,'form-grid'); row.dataset.itemId=item.id;
  const name=node('input'),amount=node('input');name.value=item.name;name.maxLength=30;name.dataset.field='name';
  amount.value=amountText(item.cents,false);amount.inputMode='decimal';amount.dataset.field='amount';
  const nameLabel=node('label','分配項目名稱'),amountLabel=node('label','分配金額（元）');nameLabel.append(name);amountLabel.append(amount);row.append(nameLabel,amountLabel);
  const remove=node('button','移除此分配草稿項目');remove.type='button';remove.onclick=()=>{if(!busy&&!writeBlocked){row.remove();allocationDirty=true;}};row.append(remove);
  return row;
}
function loadAllocation() {
  const plan=state.monthly_allocations.find(row=>row.month===incomeViewedMonth);
  allocationExpected=plan?.revision??null;allocationDirty=false;
  document.querySelector('#allocation-items').replaceChildren(...(plan?.items||defaultAllocation()).map(allocationRow));
}
function resetIncomeForm() {
  incomeForm.reset();incomeEditing=null;incomeDraftId=null;incomeForm.elements.received_on.value=taiwanToday();
  document.querySelector('#income-form-title').textContent='新增已收到的收入';document.querySelector('#save-income').textContent='儲存收入';
  document.querySelector('#cancel-income-edit').hidden=true;
}
function renderIncome() {
  incomeMonthForm.elements.month.value=incomeViewedMonth;
  const summary=incomeMonth(state,incomeViewedMonth,taiwanToday()),suggestions=recurringSuggestions(state,incomeViewedMonth);
  const totals=document.querySelector('#income-summary');
  totals.replaceChildren(node('h3',incomeViewedMonth),node('p','已收到的收入：'+amountText(summary.received)+' 元'),
    node('p','已規劃的分配：'+(summary.plan?amountText(summary.allocated)+' 元':'尚未設定')),
    node('p',summary.difference<0n?'超出本月收入 '+amountText(-summary.difference)+' 元':'尚未分配的規劃差額：'+amountText(summary.difference)+' 元'));
  const incomes=document.querySelector('#income-list');incomes.replaceChildren();
  if(!summary.entries.length)incomes.append(node('li','本月尚無已收到的收入。'));
  for(const entry of summary.entries.slice().reverse()) {
    const row=node('li');row.dataset.incomeId=entry.id;row.append(node('p',entry.received_on+'｜'+entry.name+'｜'+amountText(entry.cents)+' 元'));
    const edit=node('button','更改收入');edit.type='button';edit.onclick=()=>{
      if(busy||writeBlocked)return;incomeEditing=structuredClone(entry);incomeDraftId=null;
      incomeForm.elements.received_on.value=entry.received_on;incomeForm.elements.name.value=entry.name;incomeForm.elements.amount.value=amountText(entry.cents,false);
      document.querySelector('#income-form-title').textContent='更改已收到的收入';document.querySelector('#save-income').textContent='儲存收入更改';
      document.querySelector('#cancel-income-edit').hidden=false;incomeForm.elements.amount.focus();
    };
    const remove=node('button','作廢收入');remove.type='button';remove.onclick=()=>{
      if(busy||writeBlocked)return;incomeVoiding=structuredClone(entry);
      document.querySelector('#income-void-summary').textContent=entry.received_on+'｜'+entry.name+'｜'+amountText(entry.cents)+' 元';incomeVoidDialog.showModal();
    };row.append(edit,remove);incomes.append(row);
  }
  document.querySelector('#income-suggestion-total').textContent='生活開銷建議合計：'+amountText(suggestions.total)+' 元（只供規劃）';
  const details=document.querySelector('#income-suggestions');details.replaceChildren();
  if(!suggestions.items.length)details.append(node('li','本月份沒有可用定期支出建議。'));
  for(const item of suggestions.items){
    const row=node('li');row.append(node('p',item.kind+'｜'+item.name+'｜'+item.due_on+'｜'+amountText(item.cents)+' 元'+(item.excluded?'（已排除建議）':'')));
    if(!item.excluded){const exclude=node('button','只排除此月份建議');exclude.type='button';exclude.onclick=()=>{
      if(busy||writeBlocked)return;
      saving(()=>excludeSuggestion(db,incomeViewedMonth,item.id,'month',allocationExpected),()=>{allocationExpected=state.monthly_allocations.find(row=>row.month===incomeViewedMonth).revision;},incomeError);
    };row.append(exclude);}details.append(row);
  }
  const reserve=annualReserve(state,incomeViewedMonth,taiwanToday());
  document.querySelector('#annual-reserve-total').textContent=incomeViewedMonth<taiwanToday().slice(0,7)?'往月不重新推算年度參考額，以上為當時已儲存分配。':'每月參考額合計：'+amountText(reserve.total)+' 元（另列，不套用分配）';
  document.querySelector('#annual-reserve-items').replaceChildren(...reserve.items.map(item=>node('li',item.name+'｜年度預估 '+amountText(item.annual_cents)+' 元｜每月參考額 '+amountText(item.cents)+' 元')));
}
async function openIncomeMonth(month) {
  if(busy||writeBlocked)return;
  const request=++incomeViewRequest;
  try{allocationMonth(month);const snapshot=await readLedger(db);if(request!==incomeViewRequest)return;const retain=incomeLoaded&&month===incomeViewedMonth&&allocationDirty;state=snapshot;incomeViewedMonth=month;incomeLoaded=true;if(!retain)loadAllocation();renderIncome();incomeError.textContent='';}
  catch{if(request===incomeViewRequest)incomeError.textContent='無法讀取收入與分配，請確認月份並重新載入。';}
}
incomePanel.addEventListener('toggle',()=>{if(incomePanel.open&&!incomeLoaded)openIncomeMonth(incomeViewedMonth);});
document.querySelector('#income-entry').onclick=()=>{incomePanel.open=true;};
incomeMonthForm.onsubmit=event=>{
  event.preventDefault();const month=incomeMonthForm.elements.month.value;
  if(allocationDirty&&month!==incomeViewedMonth&&!confirm('切換月份將放棄未儲存的分配草稿；已儲存資料不變。'))return;
  openIncomeMonth(month);
};
incomeForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked||!incomeLoaded)return;
  incomeDraftId??='i_'+crypto.randomUUID();const id=incomeEditing?.id||incomeDraftId,input=Object.fromEntries(new FormData(incomeForm));
  saving(()=>updateIncome(db,incomeEditing?'update':'add',id,incomeEditing?.revision??null,input),resetIncomeForm,incomeError);
};
document.querySelector('#cancel-income-edit').onclick=()=>{if(!busy&&!writeBlocked)resetIncomeForm();};
document.querySelector('#cancel-income-void').onclick=()=>{if(!busy)incomeVoidDialog.close();};
document.querySelector('#confirm-income-void').onclick=()=>{
  if(busy||writeBlocked||!incomeVoiding)return;
  saving(()=>updateIncome(db,'void',incomeVoiding.id,incomeVoiding.revision,null),()=>{incomeVoidDialog.close();incomeVoiding=null;},document.querySelector('#income-void-error'));
};
allocationForm.addEventListener('input',()=>{allocationDirty=true;});
document.querySelector('#add-allocation-item').onclick=()=>{
  if(busy||writeBlocked)return;document.querySelector('#allocation-items').append(allocationRow({id:'item_'+crypto.randomUUID(),name:'',cents:'0'}));allocationDirty=true;
};
document.querySelector('#apply-income-suggestion').onclick=()=>{
  if(busy||writeBlocked||!incomeLoaded)return;
  const value=recurringSuggestions(state,incomeViewedMonth).total;
  let target=document.querySelector('[data-item-id="living"] [data-field="amount"]');
  if(!target){document.querySelector('#allocation-items').append(allocationRow(defaultAllocation()[0]));target=document.querySelector('[data-item-id="living"] [data-field="amount"]');}
  target.value=amountText(value,false);allocationDirty=true;
};
allocationForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked||!incomeLoaded)return;
  const items=[...document.querySelectorAll('#allocation-items > div')].map(row=>({id:row.dataset.itemId,name:row.querySelector('[data-field="name"]').value,amount:row.querySelector('[data-field="amount"]').value}));
  saving(()=>updateAllocation(db,incomeViewedMonth,allocationExpected,items),()=>{allocationExpected=state.monthly_allocations.find(row=>row.month===incomeViewedMonth).revision;allocationDirty=false;},incomeError);
};
const comparisonForm=document.querySelector('#comparison-form');
for(const [key,value] of Object.entries(comparisonDefaults(taiwanToday())))comparisonForm.elements[key].value=value;
let comparisonCharts=[];
function comparisonChoices() {
  const selected=comparisonForm.elements.category.value;
  const all=node('option','全部分類');all.value='';
  comparisonForm.elements.category.replaceChildren(all,...comparisonCategories(state,taiwanToday()).map(row=>{
    const option=node('option',row.name+(row.state==='inactive'?'（停用）':row.state==='historical'?'（歷史）':''));option.value=row.name;return option;
  }));
  comparisonForm.elements.category.value=selected;
}
function comparisonTable(headers,rows) {
  const wrap=node('div',undefined,'comparison-table'),table=node('table'),head=node('thead'),tr=node('tr'),body=node('tbody');
  for(const title of headers){const cell=node('th',title);cell.scope='col';tr.append(cell);}head.append(tr);table.append(head,body);wrap.append(table);
  for(const values of rows){const row=node('tr');for(const text of values)row.append(node('td',text));body.append(row);}
  return wrap;
}
const comparisonMoney=value=>value===null?'—':amountText(value)+' 元';
const comparisonDifference=value=>value===null?'無法比較':(value>0n?'+':value<0n?'−':'')+amountText(value<0n?-value:value)+' 元';
function clearComparison() {
  for(const chart of comparisonCharts)chart.destroy();comparisonCharts=[];
  document.querySelector('#comparison-results').replaceChildren();
}
async function showComparison(result) {
  const target=document.querySelector('#comparison-results');
  for(const [key,label] of [['a','期間 A'],['b','期間 B']]){
    const period=result[key];target.append(node('h3',label),node('p',`所選範圍：${period.start} ～ ${period.end}`));
    target.append(node('p',period.started?`實際統計：${period.actual_start} ～ ${period.actual_end}；${comparisonMoney(period.total_cents)}，${period.record_count} 筆`:'期間尚未開始'));
  }
  target.append(node('p','差額 A − B：'+comparisonDifference(result.difference_cents)));
  const percent=result.percent;
  target.append(node('p',result.difference_cents===null?'百分比：無法比較（期間尚未開始）':percent===null?'百分比：B 為 0，無法計算百分比。':`以 B 為基準：${result.difference_cents>0n?'增加':result.difference_cents<0n?'減少':'相同'} ${percent.replace(/^−/,'')}%`));
  if(result.periods_differ)target.append(node('p','期間不等長或尚未結束，不可直接解讀為花費速度變化。'));
  target.append(node('h3','分類比較'),comparisonTable(['分類','A 金額／占比','B 金額／占比','A − B'],result.categories.map(row=>[row.name,...['a','b'].map(key=>comparisonMoney(row[key+'_cents'])+(row[key+'_percent']===null?'':`／${row[key+'_percent']}%`)),comparisonDifference(row.difference_cents)])));
  if(!result.categories.length)target.append(node('p','已開始的期間沒有符合條件的消費。'));
  const detail=node('details'),summary=node('summary','每日詳細數據（按各期間第幾天對齊）');detail.append(summary);
  const dayCount=Math.max(result.a.actual_days,result.b.actual_days);
  const dailyRow=index=>{const a=comparisonDay(result.a,index),b=comparisonDay(result.b,index);return [String(index+1),a?a.date:'—',a?comparisonMoney(a.cents):'—',b?b.date:'—',b?comparisonMoney(b.cents):'—'];};
  const dailyTable=comparisonTable(['第幾天','A 日期','A 支出','B 日期','B 支出'],[]),more=node('button','顯示更多日期');more.type='button';let shown=0;
  const appendDays=()=>{const body=dailyTable.querySelector('tbody'),end=Math.min(shown+500,dayCount);for(let i=shown;i<end;i++){const tr=node('tr');for(const value of dailyRow(i))tr.append(node('td',value));body.append(tr);}shown=end;more.hidden=shown>=dayCount;};
  more.onclick=appendDays;appendDays();detail.append(dailyTable,more);target.append(detail);
  const chartStatus=node('p','圖表載入中；完整數據可由文字與表格閱讀。');chartStatus.id='comparison-chart-status';target.append(chartStatus);
  if(![result.a,result.b].some(period=>period.total_cents>0n)){chartStatus.textContent='沒有已發生的正額支出可繪圖；未開始期間沒有統計資料。';return;}
  // ponytail: large series use exact paged text; add chart downsampling only if requested.
  if(!canPlotComparison(result)||dayCount>10000){chartStatus.textContent='資料超出安全繪圖範圍，請閱讀精確文字與表格。';return;}
  const wrappers=[];
  const canvas=(title,parent=target)=>{parent.append(node('h3',title));const wrap=node('div',undefined,'comparison-chart');wrap.hidden=true;const element=node('canvas');element.setAttribute('role','img');element.setAttribute('aria-label',title+'；完整數據見表格');wrap.append(element);parent.append(wrap);wrappers.push(wrap);return element;};
  const dailyCanvas=canvas('每日支出（非累積，按第幾天對齊）'),barCanvas=canvas('分類支出 A／B');
  const pies=node('div',undefined,'comparison-pies');target.append(pies);
  const pieCanvases=['a','b'].map(key=>{const panel=node('div');pies.append(panel);return result[key].total_cents>0n?canvas(`期間 ${key.toUpperCase()} 分類占比`,panel):(panel.append(node('h3',`期間 ${key.toUpperCase()} 分類占比`),node('p',result[key].started?'沒有正額支出可計算占比。':'期間尚未開始')),null);});
  try{
    await import('./vendor/chartjs-4.5.1/chart.umd.min.js');
    if(typeof globalThis.Chart!=='function')throw new Error('Chart unavailable');
    const keys=['a','b'],colors=['#26745b','#946437'];
    const options={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:true}}};
    const tick=value=>Number.isSafeInteger(value)?amountText(BigInt(value))+' 元':'';
    const make=(element,config)=>{const chart=new globalThis.Chart(element,config);comparisonCharts.push(chart);};
    make(dailyCanvas,{type:'line',data:{labels:Array.from({length:dayCount},(_,i)=>String(i+1)),datasets:keys.filter(key=>result[key].started).map(key=>({label:'期間 '+key.toUpperCase(),data:Array.from({length:result[key].actual_days},(_,i)=>Number(comparisonDay(result[key],i).cents)),borderColor:colors[key==='a'?0:1],borderDash:key==='b'?[6,3]:[],pointRadius:2,tension:0,fill:false}))},options:{...options,scales:{y:{beginAtZero:true,ticks:{callback:tick}},x:{title:{display:true,text:'期間第幾天'}}},plugins:{...options.plugins,tooltip:{callbacks:{label:context=>{const key=keys.filter(key=>result[key].started)[context.datasetIndex],day=comparisonDay(result[key],context.dataIndex);return `${context.dataset.label} ${day.date}：${comparisonMoney(day.cents)}`;}}}}}});
    make(barCanvas,{type:'bar',data:{labels:result.categories.map(row=>row.name),datasets:keys.filter(key=>result[key].started).map(key=>({label:'期間 '+key.toUpperCase(),data:result.categories.map(row=>Number(row[key+'_cents'])),backgroundColor:colors[key==='a'?0:1]}))},options:{...options,scales:{y:{beginAtZero:true,ticks:{callback:tick}}},plugins:{...options.plugins,tooltip:{callbacks:{label:context=>{const key=keys.filter(key=>result[key].started)[context.datasetIndex];return context.dataset.label+'：'+comparisonMoney(result.categories[context.dataIndex][key+'_cents']);}}}}}});
    for(const [index,key] of keys.entries())if(pieCanvases[index]){
      const rows=result.categories.map((row,i)=>({...row,color:`hsl(${(i*137.5)%360} 50% 45%)`})).filter(row=>row[key+'_cents']>0n);
      make(pieCanvases[index],{type:'pie',data:{labels:rows.map(row=>row.name),datasets:[{data:rows.map(row=>Number(row[key+'_cents'])),backgroundColor:rows.map(row=>row.color)}]},options:{...options,plugins:{...options.plugins,tooltip:{callbacks:{label:context=>{const row=rows[context.dataIndex];return row.name+'：'+comparisonMoney(row[key+'_cents'])+`（${row[key+'_percent']}%）`;}}}}}});
    }
    for(const wrap of wrappers)wrap.hidden=false;
    for(const chart of comparisonCharts)chart.resize();chartStatus.textContent='圖表只顯示彙總；精確金額與占比見文字及表格。';
  }catch{
    for(const chart of comparisonCharts)chart.destroy();comparisonCharts=[];
    for(const wrap of wrappers)wrap.remove();chartStatus.textContent='圖表無法載入，請閱讀完整文字與表格。';
  }
}
comparisonForm.addEventListener('submit',async event=>{
  event.preventDefault();const button=comparisonForm.querySelector('button');if(button.disabled)return;
  const query=Object.fromEntries(new FormData(comparisonForm)),today=taiwanToday(),message=document.querySelector('#comparison-error');
  message.textContent='';clearComparison();button.disabled=true;
  try{
    if(['a_start','a_end','b_start','b_end'].some(key=>!comparisonForm.elements[key].validity.valid))throw new ValidationError('請輸入有效日期。');
    validateComparison(query,today);
    const snapshot=await readLedger(db); // One readonly transaction; never sync recurring rules.
    await showComparison(compareExpenses(snapshot,query,today));
  }catch(failure){clearComparison();message.textContent=failure instanceof ValidationError?failure.message:'無法比較支出，請重新載入後再試。';}
  finally{button.disabled=false;}
});
function choices() {
  const categories = categoryOptions(state).filter(option => option.active === 1 || option.name === editing?.category);
  if (editing && !categories.some(option => option.name === editing.category)) categories.push({name:editing.category, active:0});
  form.elements.category.replaceChildren(...categories.map(option => {
    const element = node('option', option.name + (option.active === 0 ? '（停用，保留原值）' : ''));
    element.value = option.name;
    return element;
  }));
  const payments = state.payment_sources.filter(option => option.active === 1).map(option => {
    const element = node('option', option.name); element.value = option.id; return element;
  });
  if (editing) {
    const retain = node('option', '保留原付款方式：' + editing.payment_source_name); retain.value = ''; payments.unshift(retain);
  }
  form.elements.payment_source_id.replaceChildren(...payments);
}
function usageFields(row=null,date=form.elements.spent_on.value || taiwanToday()) {
  form.elements.usage_started_on.value=row?.started_on || date;
  form.elements.usage_days.value=row?.active===1 ? row.days : '';
  form.elements.usage_remind.checked=row ? row.remind===1 : true;
  form.elements.usage_reminder_days.value=row?.reminder_days ?? 7;
  form.elements.usage_show_daily_cost.checked=row?.show_daily_cost===1;
  document.querySelector('#usage-stop').hidden=!row || row.active!==1;
  document.querySelector('#usage-inputs').open=row?.active===1;
  usageStartChosen=false;
}
form.elements.usage_started_on.oninput=()=>{usageStartChosen=true;};
form.elements.spent_on.onchange=()=>{
  if(!usageStartChosen && (!editing || !state.usage_periods.some(row=>row.expense_id===editing.id)))
    form.elements.usage_started_on.value=form.elements.spent_on.value;
};
document.querySelector('#usage-stop').onclick=()=>{if(!busy&&!writeBlocked){form.elements.usage_days.value='';form.elements.usage_remind.checked=false;}};
function beginExpenseEdit(entry,origin,snapshot=state) {
  if(busy||writeBlocked)return;
  showView('record',false);
  annualDraft=null;expenseSubmissionId=null;editingOrigin=origin;
  editing=structuredClone(entry);choices();error.textContent='';
  form.elements.amount.value=amountText(entry.cents,false);form.elements.note.value=entry.note;
  form.elements.spent_on.value=entry.spent_on;form.elements.spent_on.readOnly=entry.source!=='manual';
  document.querySelector('#expense-date-note').hidden=entry.source==='manual';
  form.elements.category.value=entry.category;form.elements.payment_source_id.value='';
  usageFields(state.usage_periods.find(row=>row.expense_id===entry.id),entry.spent_on);
  tagFields(entry.id,snapshot);
  document.querySelector('#form-title').textContent='更改消費';document.querySelector('#save').textContent='儲存更改';
  document.querySelector('#cancel-edit').hidden=false;form.elements.amount.focus();
}
function renderEndingSoon() {
  const items=endingSoon(state,taiwanToday()),container=document.querySelector('#ending-soon-list');
  container.replaceChildren();document.querySelector('#ending-soon').hidden=items.length===0;
  for(const item of items) {
    const row=node('li');row.append(node('p',item.name+'｜'+item.text+(item.end?'｜預計用完 '+item.end:'')));
    const button=node('button',item.kind==='usage'?'更改／停止追蹤':'查看分期');button.type='button';
    if(item.kind==='usage') {
      row.dataset.expenseId=item.id;button.onclick=()=>beginExpenseEdit(state.expenses.find(entry=>entry.id===item.id),{listId:'ending-soon-list',id:item.id});
    } else button.onclick=()=>{
      showView('planning',false);
      document.querySelector('#fixed-settings').open=true;
      const target=[...document.querySelector('#fixed-list').children].find(entry=>entry.dataset.id===item.id);
      if(target){target.tabIndex=-1;target.focus();}
    };
    row.append(button);container.append(row);
  }
}
function resetForm() {
  const origin = editingOrigin;
  editing = null;
  annualDraft = null;
  editingOrigin = null;
  choices();
  form.elements.amount.value = '';
  form.elements.note.value = '';
  form.elements.spent_on.value = taiwanToday();
  expenseSubmissionId=null;usageFields();
  tagFields();
  form.elements.spent_on.readOnly = false;
  document.querySelector('#expense-date-note').hidden = true;
  document.querySelector('#form-title').textContent = '記錄消費';
  document.querySelector('#save').textContent = '儲存消費';
  document.querySelector('#cancel-edit').hidden = true;
  return origin;
}
function returnToExpense(origin) {
  if (!origin) return;
  const container = document.getElementById(origin.listId);
  showView(container.closest('[data-view]').dataset.view,false);
  const row = [...container.children].find(row => row.dataset.expenseId === origin.id);
  const target = row?.querySelector('button') || container;
  if (target === container) target.tabIndex = -1;
  target.focus();
}
function render() {
  renderTags();
  renderShortcuts();
  comparisonChoices();
  renderSettings();
  renderBudgets();
  renderFixed();
  renderAnnual();
  renderEndingSoon();
  if (incomePanel.open && incomeLoaded) renderIncome();
  list.replaceChildren();
  const entries = activeExpenses(state, taiwanToday()).slice().reverse();
  document.querySelector('#empty').hidden = entries.length !== 0;
  list.append(...entries.map(entry=>expenseRow(entry,state)));
}
function expenseRow(entry,snapshot=state) {
    const row = node('li', undefined, 'expense');
    row.dataset.expenseId = entry.id;
    for (const [label, value] of [['日期', entry.spent_on], ['項目', entry.note], ['金額', amountText(entry.cents) + ' 元'], ['分類', entry.category], ['付款方式', entry.payment_source_name]]) {
      const cell = node('div'); cell.append(node('small', label), node('span', value)); row.append(cell);
    }
    const buttons = node('div', undefined, 'buttons');
    const tagIds=new Set((snapshot.expense_tags || []).filter(item=>item.expense_id===entry.id).map(item=>item.tag_id));
    const labels=(snapshot.tags || []).filter(item=>tagIds.has(item.id)).map(item=>'#'+item.name+(item.hidden?'（不再顯示）':''));if(labels.length)row.append(node('p',labels.join(' · '),'expense-tag-labels'));
    const usage=state.usage_periods.find(item=>item.expense_id===entry.id);
    if(usage) row.append(node('p',usage.active===1 ? '使用期間：'+usage.started_on+' 起，'+usage.days+' 天；預計用完 '+usageEnd(usage)
      +(usage.show_daily_cost===1?'；每日平均成本約 '+dailyCost(entry.cents,usage.days)+' 元／天（只供理解）':'') : '使用期間：已停止追蹤'));
    const edit = node('button', '更改'); edit.type = 'button';
    edit.onclick = () => {
      beginExpenseEdit(entry,{listId:row.parentElement.id,id:entry.id},snapshot);
    };
    const remove = node('button', '刪除'); remove.type = 'button';
    remove.onclick = () => {
      if (busy || writeBlocked) return;
      deletingOrigin = {listId:row.parentElement.id, id:entry.id};
      deleting = structuredClone(entry);
      document.querySelector('#delete-error').textContent = '';
      document.querySelector('#delete-summary').textContent = `${entry.spent_on}｜${entry.note}｜${amountText(entry.cents)} 元｜${entry.category}｜${entry.payment_source_name}`;
      dialog.showModal();
    };
    buttons.append(edit);
    if(entry.source==='manual' && !(state.annual_periods || []).some(item=>item.expense_id===entry.id)) {
      const shortcut=node('button','建立捷徑');shortcut.type='button';shortcut.dataset.operation='shortcut';
      shortcut.onclick=()=>shortcutRead(snapshot=>startShortcut(snapshot,shortcutDraft(snapshot,entry.id,entry.revision,taiwanToday()),null,{id:entry.id,revision:entry.revision}));
      buttons.append(shortcut);
    }
    buttons.append(remove);
    row.append(buttons); return row;
}
function appendBatch(rows, listElement, more, shown,snapshot=state) {
  listElement.append(...rows.slice(shown, shown + 50).map(entry=>expenseRow(entry,snapshot)));
  more.hidden = shown + 50 >= rows.length;
  return Math.min(shown + 50, rows.length);
}
const searchForm = document.querySelector('#search-form');
function showSearch(snapshot, query, today) {
  searchSnapshot=snapshot;
  searchRows = searchExpenses(snapshot, query, today);
  searchShown = 0;
  document.querySelector('#search-results').replaceChildren();
  document.querySelector('#search-count').textContent = searchRows.length
    ? `符合 ${searchRows.length} 筆消費。` : '沒有符合條件的消費。';
  searchShown = appendBatch(searchRows, document.querySelector('#search-results'), document.querySelector('#search-more'), searchShown,searchSnapshot);
}
searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const query = Object.fromEntries(new FormData(searchForm));
  const today = taiwanToday();
  const message = document.querySelector('#search-error');
  message.textContent = '';
  try {
    if (!searchForm.elements.start.validity.valid || !searchForm.elements.end.validity.valid) {
      throw new ValidationError('請輸入有效日期。');
    }
    validateSearch(query, today); // Invalid conditions never open a database read.
    const snapshot = await readLedger(db);
    lastQuery = query;
    showSearch(snapshot, query, today);
    showCalendar(snapshot, today);
  } catch (failure) {
    lastQuery = null;
    searchRows = [];
    document.querySelector('#search-results').replaceChildren();
    document.querySelector('#search-count').textContent = '';
    document.querySelector('#search-more').hidden = true;
    message.textContent = failure instanceof ValidationError ? failure.message : '無法搜尋帳目，請重新載入後再試。';
  }
});
document.querySelector('#search-more').onclick = () => {
  searchShown = appendBatch(searchRows, document.querySelector('#search-results'), document.querySelector('#search-more'), searchShown,searchSnapshot);
};
function nextMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const serial = year * 12 + number - 1 + offset;
  return `${String(Math.floor(serial / 12)).padStart(4, '0')}-${String(serial % 12 + 1).padStart(2, '0')}`;
}
function showDay(day) {
  selectedDay = day.date;
  document.querySelector('#calendar-day-details').hidden = false;
  document.querySelector('#calendar-day-title').textContent = day.date;
  document.querySelector('#calendar-day-total').textContent = `當日消費合計：${amountText(day.total)} 元`;
  document.querySelector('#calendar-day-empty').hidden = day.expenses.length !== 0;
  const listElement = document.querySelector('#calendar-day-results');
  listElement.replaceChildren();
  calendarShown = appendBatch(day.expenses, listElement, document.querySelector('#calendar-day-more'), 0,calendarSnapshot);
  for (const button of document.querySelectorAll('#calendar-grid button[data-day]')) {
    button.setAttribute('aria-pressed', String(button.dataset.day === selectedDay));
  }
}
document.querySelector('#calendar-day-more').onclick = () => {
  const day = calendarData.days.find(item => item.date === selectedDay);
  calendarShown = appendBatch(day.expenses, document.querySelector('#calendar-day-results'),
    document.querySelector('#calendar-day-more'), calendarShown,calendarSnapshot);
};
function showCalendar(snapshot, today) {
  calendarSnapshot=snapshot;
  const retainedDay = selectedDay;
  calendarData = calendarMonth(snapshot, viewedMonth, today);
  document.querySelector('#calendar-month').textContent = viewedMonth.replace('-', ' 年 ') + ' 月';
  document.querySelector('#calendar-next').disabled = viewedMonth >= today.slice(0, 7);
  document.querySelector('#calendar-prev').disabled = viewedMonth === '0001-01';
  const grid = document.querySelector('#calendar-grid');
  grid.replaceChildren(...['一', '二', '三', '四', '五', '六', '日'].map(label => node('strong', label)));
  for (let i = 0; i < calendarData.leadingBlanks; i++) grid.append(node('span', ''));
  for (const day of calendarData.days) {
    const cell = node(day.isFuture ? 'span' : 'button');
    cell.textContent = String(day.day);
    cell.setAttribute('aria-label', day.date + (day.hasExpense ? '，當日有消費' : ''));
    if (!day.isFuture) {
      cell.type = 'button'; cell.dataset.day = day.date;
      cell.onclick = () => showDay(day);
    } else cell.setAttribute('aria-disabled', 'true');
    if (day.hasExpense) cell.append(node('span', '•', 'marker'));
    grid.append(cell);
  }
  document.querySelector('#calendar-empty').hidden = calendarData.days.some(day => day.hasExpense);
  document.querySelector('#calendar-day-details').hidden = true;
  selectedDay = null;
  const retained = calendarData.days.find(day => day.date === retainedDay && !day.isFuture);
  if (retained) showDay(retained);
}
async function moveMonth(offset) {
  const today = taiwanToday();
  const month = nextMonth(viewedMonth, offset);
  if (month > today.slice(0, 7) || month < '0001-01') return;
  try {
    const snapshot = await readLedger(db);
    viewedMonth = month;
    showCalendar(snapshot, today);
    if (lastQuery) showSearch(snapshot, lastQuery, today);
    document.querySelector('#calendar-error').textContent = '';
  } catch { document.querySelector('#calendar-error').textContent = '無法讀取月曆，請重新載入後再試。'; }
}
document.querySelector('#calendar-prev').onclick = () => moveMonth(-1);
document.querySelector('#calendar-next').onclick = () => moveMonth(1);
async function saving(operation, success, message = error) {
  if (busy || writeBlocked) return;
    ++incomeViewRequest;
    ++tagQueryRequest;
  let committed = false;
  const budgetControl = document.activeElement.closest('#budget-fields') ? document.activeElement : null;
  const fixedControl = document.activeElement.closest('#fixed-fields') ? document.activeElement : null;
  const budgetRow = budgetControl?.closest('#budget-setting-list > li');
  busy = true; fields.disabled = true; error.textContent = '';
  document.querySelector('#shortcut-fields').disabled=true;
  document.querySelector('#tag-fields').disabled=true;
  incomeBusy(true);
  document.querySelector('#annual-fields').disabled=true;
  document.querySelector('#confirm-annual').disabled=true;document.querySelector('#cancel-annual').disabled=true;
  message.textContent = '';
  document.querySelector('#settings-fields').disabled = true;
  document.querySelector('#budget-fields').disabled = true;
  document.querySelector('#setting-fields').disabled = true;
  fixedBusy(true);
  document.querySelector('#delete-error').textContent = '';
  document.querySelector('#confirm-delete').disabled = true;
  document.querySelector('#cancel-delete').disabled = true;
  status.textContent = '正在儲存瀏覽器本機測試帳本……';
  try {
    state = await operation(); // Resolved only by transaction complete, never request success.
    committed = true;
    const origin = success(); render();
    if (lastQuery) showSearch(state, lastQuery, taiwanToday());
    if (viewedMonth) showCalendar(state, taiwanToday());
    returnToExpense(origin);
    status.textContent = '瀏覽器本機測試帳本；儲存完成。';
  } catch (failure) {
    writeBlocked = committed;
    if (committed) for (const modal of [dialog, settingsDialog, fixedStopDialog, incomeVoidDialog, annualDialog,tagDialog]) if (modal.open) modal.close();
    message.textContent = committed ? '資料已儲存，但畫面更新未完成。請重新載入確認，勿重複提交。'
      : failure instanceof LedgerError || failure instanceof ValidationError ? failure.message : '儲存未完成，請確認瀏覽器儲存空間後重試。';
    if (dialog.open) document.querySelector('#delete-error').textContent = error.textContent;
    status.textContent = committed ? message.textContent : '瀏覽器本機測試帳本；此次儲存未完成。';
  } finally {
    busy = false; fields.disabled = writeBlocked;
    document.querySelector('#shortcut-fields').disabled=writeBlocked;
    document.querySelector('#tag-fields').disabled=writeBlocked;
    incomeBusy(writeBlocked);
    document.querySelector('#annual-fields').disabled=writeBlocked;
    document.querySelector('#confirm-annual').disabled=writeBlocked;document.querySelector('#cancel-annual').disabled=writeBlocked;
    document.querySelector('#settings-fields').disabled = writeBlocked;
    document.querySelector('#budget-fields').disabled = writeBlocked;
    document.querySelector('#setting-fields').disabled = writeBlocked;
    fixedBusy(writeBlocked);
    fixedControl?.focus();
    document.querySelector('#confirm-delete').disabled = writeBlocked;
    document.querySelector('#cancel-delete').disabled = false;
    if (budgetControl) {
      const row = [...document.querySelectorAll('#budget-setting-list > li')].find(row => row.dataset.category === budgetRow?.dataset.category);
      const selector = budgetControl.tagName === 'INPUT' ? 'input' : budgetControl.dataset.operation === 'clear' ? '[data-operation="clear"]' : 'button[type="submit"]';
      const control = budgetControl.isConnected ? budgetControl : row?.querySelector(selector);
      (control || document.querySelector('#budget-settings summary')).focus();
    }
  }
}
function fixedBusy(disabled) {
  document.querySelector('#fixed-fields').disabled = disabled;
  for (const button of document.querySelectorAll('#fixed-list button, #fixed-sync, #confirm-fixed-stop, #cancel-fixed-stop')) button.disabled = disabled;
}
function fixedChoices() {
  const selected = fixedForm.elements.category.value;
  const retained = fixedEditing ? fixedSettings(state, fixedEditing, fixedNextMonth(taiwanToday().slice(0, 7))).category : null;
  const options = categoryOptions(state).filter(row => row.active === 1 || row.name === retained);
  if (retained && !options.some(row => row.name === retained)) options.push({name:retained, active:0});
  fixedForm.elements.category.replaceChildren(...options.map(row => {
    const option = node('option', row.name + (row.active === 0 ? '（停用，保留原值）' : '')); option.value = row.name; return option;
  }));
  if (options.some(row => row.name === selected)) fixedForm.elements.category.value = selected;
  const month = taiwanToday().slice(0, 7), previous = fixedForm.elements.start_month.value;
  const months = fixedEditing ? [fixedEditing.start_month] : [month, fixedNextMonth(month)];
  fixedForm.elements.start_month.replaceChildren(...months.map(value => {const option = node('option', value); option.value = value; return option;}));
  if (months.includes(previous)) fixedForm.elements.start_month.value = previous;
  fixedForm.elements.start_month.disabled = fixedEditing !== null;
}
function resetFixed() {
  fixedEditing = null; fixedForm.reset(); fixedChoices();
  recurringFields();
  document.querySelector('#cancel-fixed-edit').hidden = true;
}
const recurringLabel = kind => kind === '固定' ? '固定支出' : kind;
function recurringFields() {
  const installment = !fixedEditing && fixedForm.elements.kind.value === '分期';
  for (const key of ['name', 'due_day']) fixedForm.elements[key].disabled = fixedEditing !== null && fixedEditing.kind !== '固定';
  fixedForm.elements.kind.disabled = fixedEditing !== null;
  fixedForm.elements.periods.disabled = !installment;
  document.querySelector('#installment-fields').hidden = !installment;
  if (!fixedEditing) for (const id of ['fixed-form-title', 'save-fixed']) {
    document.querySelector('#'+id).textContent = '新增'+recurringLabel(fixedForm.elements.kind.value);
  }
}
fixedForm.elements.kind.onchange = recurringFields;
function fixedText(row) {
  return `${row.name}｜${amountText(row.cents)} 元｜${row.category}｜每月 ${row.due_day ?? 1} 日（短月取月底）`;
}
function renderFixed() {
  fixedChoices(); recurringFields();
  const rows = state.recurring_rules;
  document.querySelector('#fixed-empty').hidden = rows.length !== 0;
  const listElement = document.querySelector('#fixed-list'); listElement.replaceChildren();
  const month = taiwanToday().slice(0, 7);
  const postedCounts = new Map();
  for (const entry of state.expenses) if (entry.recurring_id !== null) {
    postedCounts.set(entry.recurring_id, (postedCounts.get(entry.recurring_id) ?? 0n) + 1n);
  }
  for (const rule of rows.slice().reverse()) {
    const view = fixedView(state, rule, month), row = node('li'); row.dataset.id = rule.id;
    const progress = recurringProgress(state, rule, postedCounts.get(rule.id) ?? 0n);
    row.append(node('h3', recurringLabel(rule.kind)+'：'+view.name + (progress.complete ? '（已完成）' : rule.active === 0 ? '（已停用）' : '')), node('p', '目前設定：' + fixedText(view)),
      node('p', `開始月份：${rule.start_month}${rule.start_month > month ? '（尚未開始）' : ''}`));
    if (rule.kind === '分期') row.append(node('p', `已入帳 ${progress.posted}／${progress.total} 期（含已撤銷期數）`));
    if (view.pending) row.append(node('p', `${view.pending.effective_month === fixedNextMonth(month) ? '下月生效設定' : '未來生效設定'}（${view.pending.effective_month}）：${fixedText(view.pending)}${progress.complete ? '；已完成，不會執行' : rule.active === 0 ? '；已停用，不會執行' : ''}`));
    if (rule.active === 1 && !progress.complete) {
      const buttons = node('div', undefined, 'buttons');
      const edit = node('button', '更改'+recurringLabel(rule.kind)); edit.type = 'button'; edit.dataset.operation = 'update';
      edit.onclick = () => {
        if (busy) return;
        fixedEditing = structuredClone(rule); fixedChoices(); fixedForm.elements.kind.value = rule.kind; recurringFields();
        const target = fixedSettings(state, rule, fixedNextMonth(taiwanToday().slice(0, 7)));
        for (const key of ['name', 'category']) fixedForm.elements[key].value = target[key];
        fixedForm.elements.amount.value = amountText(target.cents, false);
        fixedForm.elements.due_day.value = target.due_day ?? 1;
        document.querySelector('#fixed-form-title').textContent = '更改'+recurringLabel(rule.kind)+'（下月生效）';
        document.querySelector('#save-fixed').textContent = '儲存'+recurringLabel(rule.kind)+'更改';
        document.querySelector('#cancel-fixed-edit').textContent = '取消更改'+recurringLabel(rule.kind);
        document.querySelector('#cancel-fixed-edit').hidden = false;
        document.querySelector('#fixed-error').textContent = ''; fixedForm.elements[rule.kind === '固定' ? 'name' : 'amount'].focus();
      };
      const stop = node('button', '停用'+recurringLabel(rule.kind)); stop.type = 'button'; stop.dataset.operation = 'stop';
      stop.onclick = () => {
        if (busy) return;
        fixedStopping = structuredClone(rule);
        for (const id of ['fixed-stop-title', 'confirm-fixed-stop']) document.querySelector('#'+id).textContent = '確認停用'+recurringLabel(rule.kind);
        document.querySelector('#fixed-stop-summary').textContent = recurringLabel(rule.kind)+'目前設定：' + fixedText(view) + (rule.kind === '分期' ? `；已入帳 ${progress.posted}／${progress.total} 期` : '') + (view.pending ? '；未來設定：' + fixedText(view.pending) : '');
        document.querySelector('#fixed-stop-error').textContent = ''; fixedStopDialog.showModal();
      };
      buttons.append(edit);
      buttons.append(stop);
      const excluded = state.allocation_preferences.some(item => item.recurring_id === rule.id);
      const suggestion = node(excluded ? 'p' : 'button', excluded ? '已排除往後分配建議' : '往後不顯示分配建議'); if (!excluded) suggestion.type = 'button';
      suggestion.onclick = () => {
        if (busy || writeBlocked) return;
        if (!confirm('往後不顯示此項目的分配建議；原定期支出仍照原規則執行。')) return;
        saving(() => excludeSuggestion(db,taiwanToday().slice(0,7),rule.id,'future',null), () => {}, document.querySelector('#fixed-error'));
      };
      if (!excluded) buttons.append(suggestion); else row.append(suggestion); row.append(buttons);
    }
    listElement.append(row);
  }
}
fixedForm.addEventListener('submit', event => {
  event.preventDefault(); if (busy) return;
  const input = Object.fromEntries(new FormData(fixedForm));
  if (!fixedEditing || fixedEditing.kind === '固定') input.due_day = /^\d{1,2}$/.test(input.due_day) ? Number(input.due_day) : NaN;
  if (!fixedEditing && input.kind === '分期') input.periods = /^\d{1,3}$/.test(input.periods) ? Number(input.periods) : NaN;
  saving(() => updateRecurring(db, fixedEditing ? 'update' : 'add', fixedEditing?.id, fixedEditing?.revision, input),
    () => {resetFixed(); fixedForm.elements.name.focus();}, document.querySelector('#fixed-error'));
});
document.querySelector('#cancel-fixed-edit').onclick = () => {if (!busy) {resetFixed(); document.querySelector('#fixed-error').textContent = ''; fixedForm.elements.name.focus();}};
document.querySelector('#fixed-sync').onclick = () => saving(() => updateRecurring(db, 'sync'), () => {}, document.querySelector('#fixed-error'));
document.querySelector('#confirm-fixed-stop').onclick = () => saving(
  () => updateRecurring(db, 'stop', fixedStopping.id, fixedStopping.revision),
  () => {if (fixedEditing?.id === fixedStopping.id) resetFixed(); fixedStopDialog.close(); document.querySelector('#fixed-settings summary').focus();},
  document.querySelector('#fixed-stop-error')
);
document.querySelector('#cancel-fixed-stop').onclick = () => {if (!busy) fixedStopDialog.close();};
fixedStopDialog.addEventListener('cancel', event => {if (busy) event.preventDefault();});
fixedStopDialog.addEventListener('close', () => {fixedStopping = null;});

function renderSettings() {
  for (const [type, options] of [['category', categoryOptions(state)], ['payment', state.payment_sources]]) {
    const rows = options.map(option => {
      const row = node('li'); row.append(node('span', option.name));
      if (option.active === 0) row.append(node('small', '已停用'));
      if (type === 'payment' && ['現金', '未指定'].includes(option.name)) row.append(node('small', '保留選項'));
      else for (const [operation, label] of [['rename', '更改'], ['disable', '停用']]) {
        if (option.active === 0 && (type === 'category' || operation === 'disable')) continue;
        const button = node('button', label); button.type = 'button'; button.dataset.operation = operation;
        button.setAttribute('aria-label', label + (type === 'category' ? '分類：' : '付款方式：') + option.name);
        button.onclick = () => {
          if (busy) return;
          setting = { type, operation, key:type === 'category' ? option.name : option.id,
            expected:structuredClone(type === 'category' ? state.categories : state.payment_sources) };
          document.querySelector('#settings-title').textContent = label + (type === 'category' ? '分類' : '付款方式');
          document.querySelector('#settings-summary').textContent = option.name + '。' + (operation === 'disable'
            ? '停用後不供新帳目選取，既有帳目與歷史仍保留。'
            : type === 'category' ? '更改將同步既有帳目、所有預算、定期規則、捷徑及操作快照。'
              : '更改後沿用原付款方式，舊帳目的付款名稱快照仍保留。');
          document.querySelector('#setting-name-label').hidden = operation === 'disable';
          document.querySelector('#setting-name').value = option.name;
          document.querySelector('#setting-error').textContent = '';
          document.querySelector('#confirm-setting').textContent = '確認' + label;
          settingsDialog.showModal();
        };
        row.append(button);
      }
      return row;
    });
    document.querySelector('#' + type + '-list').replaceChildren(...rows);
  }
}

function renderBudgets() {
  const overview = monthBudget(state, taiwanToday());
  document.querySelector('#budget-month').textContent = overview.month.replace('-', ' 年 ') + ' 月（截至台灣今天）';
  document.querySelector('#budget-spent').textContent = '已記錄消費：' + amountText(overview.spent) + ' 元';
  const display = (row, index) => {
    const block = node(row.category === '總額' ? 'div' : 'li');
    const title = node('h3', row.category === '總額' ? '總預算：' + amountText(row.cents) + ' 元' : row.category + (row.active ? '' : '（已停用）'));
    title.id = 'budget-label-' + index;
    const remaining = row.remaining;
    const text = node('p', (row.category === '總額' ? '' : '預算 ' + amountText(row.cents) + ' 元；') +
      '已花 ' + amountText(row.spent) + ' 元；' + (remaining < 0n ? '超支 ' : '剩餘 ') + amountText(remaining < 0n ? -remaining : remaining) + ' 元');
    text.id = 'budget-status-' + index;
    block.append(title, text);
    if (row.cents > 0n) {
      const progress = node('progress');
      const ratio = row.spent * 10000n / row.cents;
      progress.max = 100; progress.value = Number(ratio > 10000n ? 10000n : ratio) / 100;
      progress.setAttribute('aria-labelledby', title.id); progress.setAttribute('aria-describedby', text.id);
      block.append(progress);
    } else block.append(node('small', '零元歷史預算不計算使用率。'));
    return block;
  };
  document.querySelector('#budget-total').replaceChildren(overview.total ? display(overview.total, 'total') : node('p', '尚未設定總預算'));
  document.querySelector('#category-budget-list').replaceChildren(...(overview.categories.length
    ? overview.categories.map((row, index) => display(row, index)) : [node('li', '尚未設定分類預算')]));

  const expected = structuredClone(state.budgets);
  const options = categoryOptions(state);
  const names = ['總額', ...options.filter(row => row.active === 1 || overview.categories.some(budget => budget.category === row.name)).map(row => row.name)];
  for (const row of overview.categories) if (!names.includes(row.category)) names.push(row.category);
  const rows = names.map(category => {
    const row = node('li'); row.dataset.category = category;
    const budget = category === '總額' ? overview.total : overview.categories.find(row => row.category === category);
    const active = category === '總額' || options.some(row => row.name === category && row.active === 1);
    const name = category === '總額' ? '總預算' : category + '預算';
    row.append(node('h3', name + (active ? '' : '（已停用）')), node('p', budget ? amountText(budget.cents) + ' 元' : '尚未設定'));
    if (budget && budget.cents % 100n) row.append(node('small', '歷史小數預算保留精確原值，僅可清除。'));
    else if (active) {
      const form = node('form'); form.noValidate = true;
      const label = node('label', name + '金額');
      const input = node('input'); input.name = 'amount'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off';
      input.value = budget ? amountText(budget.cents, false) : '';
      label.append(input);
      const button = node('button', (budget ? '更改' : '設定') + name); button.type = 'submit';
      form.append(label, button);
      form.onsubmit = event => {
        event.preventDefault();
        saving(() => updateBudget(db, expected, 'set', category, input.value), () => {}, document.querySelector('#budget-error'));
      };
      row.append(form);
    }
    if (budget) {
      const clear = node('button', '清除' + name); clear.type = 'button'; clear.dataset.operation = 'clear';
      clear.onclick = () => saving(() => updateBudget(db, expected, 'clear', category), () => {}, document.querySelector('#budget-error'));
      row.append(clear);
    }
    return row;
  });
  document.querySelector('#budget-setting-list').replaceChildren(...rows);
  const sum = document.querySelector('#budget-sum');
  sum.disabled = !overview.categories.length || overview.categories.reduce((sum, row) => sum + row.cents, 0n) <= 0n;
  sum.onclick = () => saving(() => updateBudget(db, expected, 'sum', '總額'), () => {}, document.querySelector('#budget-error'));
}
function refreshChoices(change = null) {
  let category = form.elements.category.value;
  const payment = form.elements.payment_source_id.value;
  if (change?.type === 'category' && change.operation === 'rename') {
    const name = categoryName(document.querySelector('#setting-name').value);
    if (category === change.key) category = name;
    const committed = state.expenses.find(row => row.id === editing?.id);
    if (editing?.category === change.key && committed?.category === name &&
        integerValue(committed.revision) === integerValue(editing.revision) + 1n) {
      editing.category = name; editing.revision = storedInteger(integerValue(editing.revision) + 1n);
    }
  }
  choices();
  if ([...form.elements.category.options].some(row => row.value === category)) form.elements.category.value = category;
  if ([...form.elements.payment_source_id.options].some(row => row.value === payment)) form.elements.payment_source_id.value = payment;
}
for (const type of ['category', 'payment']) {
  const addForm = document.querySelector('#' + type + '-add');
  addForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = addForm.elements.name.value;
    const update = type === 'category' ? updateCategory : updatePayment;
    const expected = type === 'category' ? state.categories : state.payment_sources;
    saving(() => update(db, expected, 'add', null, name), () => { addForm.reset(); refreshChoices(); }, document.querySelector('#settings-error'));
  });
}
document.querySelector('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!setting || busy) return;
  const change = setting, value = document.querySelector('#setting-name').value;
  const update = change.type === 'category' ? updateCategory : updatePayment;
  saving(() => update(db, change.expected, change.operation, change.key, value),
    () => { refreshChoices(change); settingsDialog.close(); }, document.querySelector('#setting-error'));
});
document.querySelector('#cancel-setting').onclick = () => { if (!busy) settingsDialog.close(); };
settingsDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
settingsDialog.addEventListener('close', () => { setting = null; });
form.addEventListener('submit', event => {
  event.preventDefault();
  if(busy||writeBlocked)return;
  const input = Object.fromEntries(new FormData(form));
  try{addTagDraft();input.tags={ids:tagDraft.filter(row=>row.id!==null).map(row=>row.id),names:tagDraft.filter(row=>row.id===null).map(row=>row.name)};}
  catch(failure){error.textContent=failure instanceof ValidationError?failure.message:'請輸入有效標籤。';return;}
  if(form.elements.usage_days.value.trim())input.usage={started_on:form.elements.usage_started_on.value,days:Number(form.elements.usage_days.value),
    remind:Number(form.elements.usage_remind.checked),reminder_days:form.elements.usage_reminder_days.value.trim()===''?NaN:Number(form.elements.usage_reminder_days.value),show_daily_cost:Number(form.elements.usage_show_daily_cost.checked),active:1};
  else if(editing && state.usage_periods.some(row=>row.expense_id===editing.id))input.usage=null;
  const today = taiwanToday();
  expenseSubmissionId ??= 'e_'+crypto.randomUUID();
  saving(() => annualDraft ? processAnnual(db,'record',annualDraft.annual_id,annualDraft.year,annualDraft.rule_revision,annualDraft.revision,input)
    : editing ? editExpense(db, editing.id, editing.revision, input, today) : addExpense(db, input, today,expenseSubmissionId), resetForm);
});
document.querySelector('#cancel-edit').onclick = () => { if (!busy) { const origin = resetForm(); error.textContent = ''; returnToExpense(origin); } };
document.querySelector('#cancel-delete').onclick = () => dialog.close();
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', () => { if(!dialog.open){deleting = null; deletingOrigin = null;} });
document.querySelector('#confirm-delete').onclick = () => saving(
  () => voidExpense(db, deleting.id, deleting.revision),
  () => { const origin = deletingOrigin; if (editing?.id === deleting.id) resetForm(); dialog.close(); return origin; }
);
function showLedger() {
  ++selection;pendingEncrypted=null;pendingBackup=null;decryptForm.reset();decryptPanel.hidden=true;
  welcome.hidden = true;
  review.hidden = true;
  ledgerPage.hidden = false;
  viewNavigation.hidden=false;showView('record',false);
  management.hidden = false;
  resetForm(); render(); fields.disabled = false;
  viewedMonth = taiwanToday().slice(0, 7);
  showCalendar(state, taiwanToday());
  status.textContent = '瀏覽器本機測試帳本；資料僅保存在此瀏覽器與來源。';
}
function restoreControls(disabled) {
  for (const id of ['start-ledger', 'choose-restore', 'confirm-restore', 'cancel-restore', 'decrypt-backup']) {
    document.getElementById(id).disabled = disabled;
  }
  restorePassword.disabled=disabled;
}
document.querySelector('#start-ledger').onclick = async () => {
  if (busy || writeBlocked) return;
  restoreControls(true);
  try { await saving(() => initializeLedger(db), showLedger); }
  finally { restoreControls(false); }
};
document.querySelector('#choose-restore').onclick = () => { if (!busy) restoreFile.click(); };
function prepareRestore(payload){
  const backup=readBackup(payload);validateStorageLimits(backup);
  const labels={expenses:'消費',categories:'分類',payment_sources:'付款方式',budgets:'預算',recurring_rules:'定期規則',recurring_versions:'歷史版本',shortcuts:'捷徑',actions:'消費操作紀錄',settings:'設定',incomes:'收入',income_actions:'收入操作紀錄',monthly_allocations:'月份分配',allocation_preferences:'往後建議排除',annual_rules:'年度費用',annual_periods:'年度期數',usage_periods:'使用期間',tags:'標籤',expense_tags:'消費標籤關聯'};
  document.querySelector('#restore-format').textContent=`備份 JSON v${backup.version}${backup.version >= 2 ? '（舊 Python 不支援）' : ''}`;
  document.querySelector('#restore-summary').replaceChildren(...Object.keys(backup.data).map(section=>node('li',`${labels[section]}：${section==='settings'?1:backup.data[section].length} 項`)));
  pendingBackup=payload;pendingEncrypted=null;decryptForm.reset();decryptPanel.hidden=true;review.hidden=false;
  document.querySelector('#restore-title').focus();
}
restoreFile.onchange = async () => {
  if(busy)return;
  const file = restoreFile.files[0];
  const currentSelection = ++selection;
  restoreFile.value = '';
  pendingBackup = null;
  pendingEncrypted=null;decryptForm.reset();decryptPanel.hidden=true;passwordError.textContent='';
  review.hidden = true;
  error.textContent = '';
  if (!file || busy) return;
  if (file.size > MAX_ENCRYPTED_BYTES) { error.textContent = '備份檔超過容量上限（JSON 64 MiB；加密檔另含 63 bytes 封裝）。'; return; }
  busy=true;restoreControls(true);
  try {
    const payload = new Uint8Array(await file.arrayBuffer());
    if (currentSelection !== selection) return;
    if(isEncryptedBackup(payload)){
      inspectEncryptedBackup(payload);pendingEncrypted=payload;decryptPanel.hidden=false;
    }else{
      if(payload.length>MAX_BYTES){error.textContent='JSON 備份檔超過 64 MiB 上限。';return;}
      prepareRestore(payload);
    }
  } catch {
    if (currentSelection === selection) error.textContent = '備份檔格式或資料不符合規則，或超過本機容量上限。請選擇有效的完整備份。';
  }finally{busy=false;restoreControls(false);if(!decryptPanel.hidden)restorePassword.focus();}
};
decryptForm.onsubmit=async event=>{
  event.preventDefault();if(busy||!pendingEncrypted)return;
  const currentSelection=selection;busy=true;restoreControls(true);passwordError.textContent='';
  try{
    const payload=await decryptBackup(pendingEncrypted,restorePassword.value);
    if(currentSelection!==selection)return;
    prepareRestore(payload);
  }catch(failure){if(currentSelection===selection)passwordError.textContent=failure instanceof EncryptedBackupError?failure.message:'解密或備份資料驗證未完成，請確認密碼與備份檔。';}
  finally{busy=false;restoreControls(false);if(currentSelection!==selection)document.querySelector('#choose-restore').focus();}
};
document.querySelector('#cancel-decrypt').onclick=()=>{
  ++selection;pendingEncrypted=null;pendingBackup=null;decryptForm.reset();decryptPanel.hidden=true;passwordError.textContent='';
  if(!busy)document.querySelector('#choose-restore').focus();
};
document.querySelector('#cancel-restore').onclick = () => {
  if (busy) return;
  ++selection; pendingBackup = null; review.hidden = true; error.textContent = '';
  document.querySelector('#choose-restore').focus();
};
document.querySelector('#confirm-restore').onclick = async () => {
  if (busy || !pendingBackup) return;
  busy = true; restoreControls(true); error.textContent = '';
  let completed = false;
  try {
    await restorePortableBackup(db, pendingBackup, true);
    completed = true;
    state = await readLedger(db);
    pendingBackup = null;
    showLedger();
  } catch {
    pendingBackup = null; review.hidden = true;
    error.textContent = completed ? '還原交易已完成，但重新讀取失敗。請重新載入頁面確認資料。' : '還原未完成，資料沒有變更。請重新選擇備份；若帳本已有資料，無法還原。';
  } finally { busy = false; restoreControls(false); }
};
function resetExport(){
  exportForm.reset();exportError.textContent='';document.querySelector('#export-password-fields').hidden=false;
  document.querySelector('#export-plain-risk').hidden=true;document.querySelector('#confirm-export').textContent='產生加密備份';
}
csvForm.onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  csvError.textContent = ''; csvStatus.textContent = '';
  const query = Object.fromEntries(new FormData(csvForm)), today = taiwanToday();
  try {
    if (!csvForm.elements.start.validity.valid || !csvForm.elements.end.validity.valid) {
      throw new ValidationError('請輸入有效日期。');
    }
    validateCsvRange(query, today); // Reject invalid input before opening a read transaction.
  } catch (failure) {
    csvError.textContent = failure instanceof ValidationError ? failure.message : '請檢查匯出日期。';
    return;
  }
  busy = true; document.querySelector('#csv-inputs').disabled = true;
  try {
    const snapshot = await readLedger(db);
    const result = expenseCsv(snapshot, query, today);
    if (!result.count) { csvStatus.textContent = '沒有符合日期範圍的已入帳生活消費。'; return; }
    const url = URL.createObjectURL(new Blob([result.payload], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'discordbot-expenses.csv';
    document.body.append(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    csvStatus.textContent = '已要求瀏覽器下載 CSV；請自行確認檔案存在並妥善保管。';
  } catch {
    csvError.textContent = '無法產生 CSV，帳本沒有變更。請重新載入後再試。';
  } finally { busy = false; document.querySelector('#csv-inputs').disabled = false; }
};
document.querySelector('#download-backup').onclick=()=>{
  if(busy)return;++exportSelection;resetExport();exportPanel.hidden=false;document.querySelector('#export-password').focus();
};
exportMode.onchange=()=>{
  document.querySelector('#export-password').value='';document.querySelector('#export-confirm-password').value='';document.querySelector('#export-risk').checked=false;
  const encrypted=exportMode.value==='encrypted';document.querySelector('#export-password-fields').hidden=!encrypted;
  document.querySelector('#export-plain-risk').hidden=encrypted;document.querySelector('#confirm-export').textContent=encrypted?'產生加密備份':'確認下載未加密備份';exportError.textContent='';
};
document.querySelector('#cancel-export').onclick=()=>{++exportSelection;resetExport();exportPanel.hidden=true;if(!busy)document.querySelector('#download-backup').focus();};
exportForm.onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const encrypted=exportMode.value==='encrypted',password=document.querySelector('#export-password').value;
  exportError.textContent='';
  try{
    if(encrypted)confirmBackupPassword(password,document.querySelector('#export-confirm-password').value);
    else if(exportMode.value!=='plain'||!document.querySelector('#export-risk').checked)throw new EncryptedBackupError('請閱讀未加密風險，並勾選明確確認後再下載。');
  }catch(failure){exportError.textContent=failure instanceof EncryptedBackupError?failure.message:'備份設定不符合規則。';return;}
  const currentSelection=++exportSelection;busy = true;
  document.querySelector('#export-inputs').disabled=true;document.querySelector('#confirm-export').disabled=true;document.querySelector('#download-backup').disabled=true;
  try {
    let payload = await exportPortableBackup(db);
    if(currentSelection!==exportSelection)return;
    if(encrypted)payload=await encryptBackup(payload,password);
    if(currentSelection!==exportSelection)return;
    const url = URL.createObjectURL(new Blob([payload], { type: encrypted?'application/octet-stream':'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = encrypted?'life-ledger-encrypted-backup-v1.llbk':`life-ledger-backup-v${readBackup(payload).version}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    resetExport();exportPanel.hidden=true;
    status.textContent = '已要求瀏覽器下載完整備份；尚未確認檔案已保存。請確認檔案存在，並妥善保管備份與密碼。';
  } catch {
    if(currentSelection===exportSelection)exportError.textContent = '無法產生完整備份，帳本沒有變更。請確認瀏覽器儲存狀態後重試。';
  } finally {
    busy = false;document.querySelector('#export-inputs').disabled=false;document.querySelector('#confirm-export').disabled=false;document.querySelector('#download-backup').disabled=false;
    if(exportPanel.hidden)document.querySelector('#download-backup').focus();
  }
};
try {
  db = await openDatabase();
  state = await readLedgerIfPresent(db);
  if (state) showLedger();
  else {
    welcome.hidden = false;
    status.textContent = '瀏覽器本機測試帳本尚未建立；請選擇開始記帳或從備份還原。';
  }
} catch {
  error.textContent = '無法開啟本機測試帳本。請保留資料並確認瀏覽器允許本機儲存。';
  status.textContent = '瀏覽器本機測試帳本尚未就緒。';
  document.querySelector('#recovery-guidance').hidden = false;
  welcome.hidden = true; ledgerPage.hidden = true;
  writeBlocked = true; restoreControls(true);
  db?.close();
}

if (['/local-first/', '/local-first/index.html'].includes(location.pathname) && 'serviceWorker' in navigator) {
  const offlineStatus = document.querySelector('#offline-status');
  const updateStatus = document.querySelector('#update-status');
  let registration = null, installFailed = false;
  const showUpdate = () => {
    updateStatus.textContent = registration?.waiting?.state === 'installed'
      ? '新版已下載，關閉此來源所有頁籤／視窗後重新開啟才會使用新版。請先儲存或自行保留草稿。'
      : !navigator.onLine ? '目前離線，無法確認是否有新版；目前頁面不會自動更新。'
      : !registration ? '無法確認新版狀態；目前頁面不會自動更新。'
      : installFailed ? '新版安裝未完成；目前頁面不會自動更新，請稍後連線再確認。'
      : registration.installing ? '新版正在下載／安裝，尚未確認完成；目前頁面不會自動更新。'
      : '未偵測到等待啟用的新版；目前頁面不會自動更新。';
  };
  const observeInstall = () => {
    installFailed = false;
    const worker = registration.installing;
    if (worker) worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') installFailed = true;
      showUpdate();
    });
    showUpdate();
  };
  let checkNumber = 0;
  const checkOffline = async () => {
    const current = ++checkNumber;
    offlineStatus.textContent = '離線重新開啟尚未就緒；請保持預覽服務開啟。';
    const controller = navigator.serviceWorker.controller;
    if (!controller || new URL(controller.scriptURL).pathname !== '/local-first/sw.js') return;
    const channel = new MessageChannel();
    const complete = new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), 5000);
      channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data === true); };
    });
    try { controller.postMessage({ type: 'offline-ready' }, [channel.port2]); }
    catch { channel.port1.close(); return; }
    const ready = await complete;
    channel.port1.close();
    if (current !== checkNumber) return;
    offlineStatus.textContent = ready
      ? '可離線重新開啟（相同瀏覽器與網址）；請定期下載備份。'
      : '離線重新開啟尚未就緒；請保持預覽服務開啟。';
  };
  const refreshStatus = () => { showUpdate(); checkOffline(); };
  navigator.serviceWorker.addEventListener('controllerchange', refreshStatus);
  window.addEventListener('pageshow', refreshStatus);
  window.addEventListener('online', showUpdate);
  window.addEventListener('offline', showUpdate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshStatus(); });
  navigator.serviceWorker.register('/local-first/sw.js', { scope: '/local-first/' })
    .then(value => {
      registration = value;
      registration.addEventListener('updatefound', observeInstall);
      observeInstall(); checkOffline();
    })
    .catch(refreshStatus);
}
