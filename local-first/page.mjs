import { openDatabase, readLedgerIfPresent, readLedger, initializeLedger, restorePortableBackup, exportPortableBackup, addExpense, editExpense, editExpenseBatch, importInvoiceExpenses, voidExpense, updateCategory, updatePayment, updateBudget, updateSchedule, processSchedule, updateIncome, updateIncomeRule,processIncomePeriod,updateGoal, updateAllocation, excludeSuggestion, updateShortcut, shortcutDraft, updateTag, taiwanToday, LedgerError } from './ledger.mjs';
import { readBackup, validateStorageLimits, MAX_BYTES, integerValue, storedInteger } from './backup.mjs';
import {encryptBackup,decryptBackup,isEncryptedBackup,inspectEncryptedBackup,confirmBackupPassword,MAX_ENCRYPTED_BYTES,EncryptedBackupError} from './backup-crypto.mjs';
import { categoryOptions, categoryName, cents, validateInput, orderedShortcuts, tagName, tagSuggestions, ValidationError } from './rules.mjs';
import { activeExpenses, validateSearch, validateBrowse, browseSite, siteSearch, categoryReport, calendarMonth, monthBudget, tagReport, validateTagQuery } from './browse.mjs';
import { validateCsvRange, expenseCsv, invoicePreview,invoiceIdentity,MAX_INVOICE_BYTES } from './csv.mjs';
import {comparisonDefaults,comparisonCategories,validateComparison,compareExpenses,comparisonDay,canPlotComparison,analyzeExpenses,ratioText} from './comparison.mjs';
import {incomeMonth, recurringSuggestions, defaultAllocation, allocationMonth,recurringIncomeItems} from './income.mjs';
import {scheduleRules,scheduleItems,scheduleMonth,scheduleReserve} from './schedule.mjs';
import {endingSoon,usageEnd,dailyCost} from './usage.mjs';
import {defaultHomePreferences,loadHomePreferences,saveHomePreferences} from './home-preferences.mjs';

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
let helpReturn=null;
let searchRequest=0,searchReturn=null,searchSelection=null,selectionRows=[],selectionShown=0,selectionTrigger=null;
let searchExpenseDraft=null;
// Move the original nodes once: forms, listeners, disclosures and internal hidden flags are retained.
document.querySelector('#view-settings').append(document.querySelector('#home-edit'),document.querySelector('#settings-fields'),document.querySelector('#settings-error'));
const previousSettings=document.querySelector('#ledger-settings').closest('section');
for(const [id,label] of [['budget-settings','預算'],['fixed-settings','定期支出']]) {
  const section=node('section');section.setAttribute('aria-label',label);section.append(document.getElementById(id));document.querySelector('#view-planning').append(section);
}
previousSettings.remove();
for(const [view,selectors] of [
  ['record',['#expense-form','#shortcut-quick','#ending-soon','#budget-overview','#schedule-overview','#expenses','#calendar-grid']],
  ['search',['#search-form']],
  ['planning',['#income-planning','#goal-planning']],
  ['analysis',['#expense-analysis','#expense-comparison','#tag-analysis']],['settings',['#tag-settings','#data-management']]])
  for(const selector of selectors)document.querySelector('#view-'+view).append(document.querySelector(selector).closest('section'));
document.querySelector('#view-planning-title').after(document.querySelector('#planning-links'));
document.querySelector('#data-privacy').append(document.querySelector('#privacy-content'));
const homeSearchSection=node('section');homeSearchSection.setAttribute('aria-label','搜尋');homeSearchSection.append(document.querySelector('#home-search-entry'));document.querySelector('#view-record-title').after(homeSearchSection);
const homeBlocks=new Map([['search',homeSearchSection],['record',form.closest('section')],['shortcuts',document.querySelector('#shortcut-quick').closest('section')],['ending',document.querySelector('#ending-soon')],['budget',document.querySelector('#budget-overview')],['schedule',document.querySelector('#schedule-overview')],['goals',document.querySelector('#home-goals')],['expenses',document.querySelector('#expenses').closest('section')],['calendar',document.querySelector('#calendar-grid').closest('section')]].map(([key,section])=>{const wrap=node('div');wrap.dataset.homeBlock=key;section.before(wrap);wrap.append(section);return [key,wrap];}));
homeBlocks.get('record').append(document.querySelector('#income-record-section'));
const homeAnchor=document.createComment('home blocks');document.querySelector('#view-record').append(homeAnchor);
const homeLabels={search:'搜尋',record:'記帳',shortcuts:'操作捷徑',budget:'本月預算',schedule:'本月定期支出',goals:'存錢目標',ending:'快結束',expenses:'有效消費',calendar:'月曆'};
const shortcutHome=homeBlocks.get('shortcuts').querySelector('section'),shortcutManager=document.querySelector('#shortcut-settings'),shortcutSettingsHost=document.querySelector('#home-shortcut-settings-host');
let homeStorage;try{homeStorage=localStorage;}catch{homeStorage=null;}
const loadedHome=loadHomePreferences(homeStorage);let homePreferences=loadedHome.preferences,homeDraft=structuredClone(homePreferences);
document.querySelector('#home-preferences-status').textContent=loadedHome.warning;
const homeSummaries={shortcuts:shortcutManager,budget:document.querySelector('#category-budget-overview'),schedule:document.querySelector('#schedule-overview details'),goals:document.querySelector('#home-goals-details'),ending:document.querySelector('#ending-soon details'),expenses:document.querySelector('#expenses-disclosure')};
for(const [key,details]of Object.entries(homeSummaries))details.open=homePreferences.expanded[key];
function placeShortcutManager(view) {
  (view==='record'&&homePreferences.visible.shortcuts?shortcutHome:shortcutSettingsHost).append(shortcutManager);
}
function applyHomePreferences() {
  const target=document.querySelector('#view-record');
  for(const key of homePreferences.order){const wrap=homeBlocks.get(key);wrap.hidden=homePreferences.visible[key]===false;target.insertBefore(wrap,homeAnchor);}
  if(document.querySelector('#view-record').hidden)placeShortcutManager('settings');else placeShortcutManager('record');
}
function renderHomeOrder() {
  const list=document.querySelector('#home-order');list.replaceChildren();
  const visible=homeDraft.order.filter(key=>homeDraft.visible[key]!==false);
  for(const key of homeDraft.order){
    const row=node('li');row.dataset.block=key;
    if(Object.hasOwn(homeDraft.visible,key)){const label=node('label'),input=node('input');input.type='checkbox';input.checked=homeDraft.visible[key];input.dataset.visible='';input.onchange=()=>{homeDraft.visible[key]=input.checked;renderHomeOrder();document.querySelector('#home-order [data-block='+key+'] input').focus();};label.append(input,document.createTextNode(homeLabels[key]));row.append(label);}
    else row.append(node('span',homeLabels[key]+'（必須顯示）'));
    for(const [direction,label,offset]of [['up','上移',-1],['down','下移',1]]){
      const button=node('button',label);button.type='button';button.dataset.move=direction;button.setAttribute('aria-label',homeLabels[key]+' '+label);
      const index=visible.indexOf(key),other=visible[index+offset];button.disabled=index<0||!other;
      button.onclick=()=>{const a=homeDraft.order.indexOf(key),b=homeDraft.order.indexOf(other);[homeDraft.order[a],homeDraft.order[b]]=[homeDraft.order[b],homeDraft.order[a]];renderHomeOrder();const own=document.querySelector('#home-order [data-block='+key+'] [data-move='+direction+']');(own.disabled?own.parentElement.querySelector('button:not(:disabled)'):own)?.focus();};row.append(button);
    }
    list.append(row);
  }
}
function homePreferenceFields() {
  renderHomeOrder();document.querySelector('#home-shortcut-count').value=homePreferences.shortcut_count;
  const target=document.querySelector('#home-expansion-settings');target.querySelectorAll('label').forEach(label=>label.remove());
  for(const key of Object.keys(homePreferences.expanded)){const label=node('label'),input=node('input');input.type='checkbox';input.id='home-expanded-'+key;input.checked=homePreferences.expanded[key];label.append(input,document.createTextNode(homeLabels[key]));target.append(label);}
}
document.querySelector('#home-preferences-form').onsubmit=event=>{
  event.preventDefault();const text=document.querySelector('#home-shortcut-count').value,message=document.querySelector('#home-preferences-status');
  if(!/^\d+$/.test(text)||!Number.isSafeInteger(Number(text))){message.textContent='捷徑數量請填非負整數。';return;}
  homeDraft.shortcut_count=Number(text);for(const key of Object.keys(homeDraft.expanded))homeDraft.expanded[key]=document.querySelector('#home-expanded-'+key).checked;
  const saved=saveHomePreferences(homeStorage,homeDraft);homePreferences=saved?structuredClone(homeDraft):defaultHomePreferences();homeDraft=structuredClone(homePreferences);
  message.textContent=saved?'首頁偏好已儲存；摘要預設於下次重新開啟套用。':'首頁偏好未能儲存，本頁已回復預設；帳本不受影響。';
  applyHomePreferences();homePreferenceFields();if(state)renderShortcuts();
};
applyHomePreferences();homePreferenceFields();
const helpTopics=new Map();
for(const text of document.querySelectorAll('[data-help-topic]')) {
  const name=text.dataset.helpTopic;
  if(!helpTopics.has(name)){const section=node('section');section.append(node('h3',name));helpTopics.set(name,section);document.querySelector('#instructions-content').append(section);}
  helpTopics.get(name).append(text);
}
function closeHelp(focus=true) {
  if(!helpReturn)return;
  const previous=helpReturn;helpReturn=null;document.querySelector('#instructions-view').hidden=true;
  ledgerPage.hidden=previous.ledgerHidden;welcome.hidden=previous.welcomeHidden;
  if(focus)previous.trigger.focus();
}
function closePrivacy(focus=true) {
  if(!privacyReturn)return;
  const previous=privacyReturn;privacyReturn=null;privacyView.hidden=true;
  document.querySelector('#data-privacy').append(document.querySelector('#privacy-content'));
  ledgerPage.hidden=previous.ledgerHidden;welcome.hidden=previous.welcomeHidden;
  if(focus)previous.trigger.focus();
}
function showView(view,focus=true) {
  const panel=document.querySelector('#view-'+view);if(!panel?.hasAttribute('data-view'))return;
  if(view!=='search')++searchRequest;
  closePrivacy(false);
  closeHelp(false);
  placeShortcutManager(view);
  for(const item of document.querySelectorAll('[data-view]'))item.hidden=item!==panel;
  for(const button of viewNavigation.querySelectorAll('button'))button.setAttribute('aria-current',button.dataset.viewButton===view?'page':'false');
  if(focus)document.querySelector('#view-'+view+'-title').focus();
  if(view==='analysis')for(const chart of comparisonCharts)chart.resize();
  if(view==='analysis')analysisChart?.resize();
  renderBatchSelection();
}
for(const button of viewNavigation.querySelectorAll('button'))button.onclick=()=>showView(button.dataset.viewButton);
for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',event=>{
  if(link.hasAttribute('data-help-link')) {
    event.preventDefault();if(busy||helpReturn)return;closePrivacy(false);++searchRequest;
    helpReturn={trigger:link,ledgerHidden:ledgerPage.hidden,welcomeHidden:welcome.hidden};
    ledgerPage.hidden=true;welcome.hidden=true;document.querySelector('#instructions-view').hidden=false;document.querySelector('#instructions-title').focus();return;
  }
  if(link.hasAttribute('data-privacy-link')) {
    event.preventDefault();if(busy)return;
    closeHelp(false);
    privacyReturn={trigger:link,ledgerHidden:ledgerPage.hidden,welcomeHidden:welcome.hidden};
    ledgerPage.hidden=true;welcome.hidden=true;privacyView.hidden=false;privacyView.append(document.querySelector('#privacy-content'));
    document.querySelector('#privacy-back').textContent=privacyReturn.ledgerHidden?'返回首次使用':'返回設定';
    document.querySelector('#privacy-title').focus();return;
  }
  const target=document.getElementById(link.getAttribute('href').slice(1));
  const view=target?.closest('[data-view]');
  if(view)showView(view.dataset.view,false);
  if(target?.id==='data-privacy'){event.preventDefault();target.open=true;target.querySelector('summary').focus();}
  if(target?.id==='goal-planning'&&link.closest('#home-goals')){event.preventDefault();target.open=true;target.querySelector('summary').focus();}
  if(link.id==='home-shortcut-manager'){event.preventDefault();placeShortcutManager('settings');target.open=true;target.querySelector('summary').focus();}
  if(link.id==='budget-category-link'||link.id==='category-budget-back') {
    event.preventDefault();
    (target.id==='budget-settings'?target.querySelector('summary'):target).focus();
  }
});
document.querySelector('#privacy-back').onclick=()=>closePrivacy();
document.querySelector('#instructions-back').onclick=()=>closeHelp();
let pendingBackup = null, selection = 0;
let pendingEncrypted = null, exportSelection = 0;
const decryptForm=document.querySelector('#decrypt-form'),decryptPanel=document.querySelector('#decrypt-panel');
const restorePassword=document.querySelector('#restore-password'),passwordError=document.querySelector('#restore-password-error');
const exportForm=document.querySelector('#export-form'),exportPanel=document.querySelector('#export-panel');
const exportMode=document.querySelector('#export-mode'),exportError=document.querySelector('#export-error');
const csvForm = document.querySelector('#csv-form');
const csvError = document.querySelector('#csv-error'), csvStatus = document.querySelector('#csv-status');
const invoiceFile=document.querySelector('#invoice-file'),invoiceContent=document.querySelector('#invoice-preview'),invoiceError=document.querySelector('#invoice-error'),invoiceDialog=document.querySelector('#invoice-dialog');
let invoiceDrafts=[],invoiceShown=50,invoiceNotice='',invoiceFileRequest=0,invoiceConfirming=null;
function invoiceSelection() {
  const count=invoiceDrafts.filter(row=>row.selected&&!row.existing).length;
  document.querySelector('#invoice-preview-status').textContent=invoiceNotice+(invoiceDrafts.length?'｜選取 '+count+' 張（完整可匯入 '+invoiceDrafts.filter(row=>!row.existing).length+' 張）':'');
  document.querySelector('#invoice-review').disabled=!count||busy||writeBlocked;
}
function clearInvoicePreview() {
  ++invoiceFileRequest;invoiceDrafts=[];invoiceConfirming=null;invoiceFile.value='';invoiceNotice='';invoiceShown=50;invoiceContent.replaceChildren();invoiceError.textContent='';document.querySelector('#invoice-more').hidden=true;invoiceSelection();
}
function renderInvoicePreview() {
  invoiceContent.replaceChildren();
  const categories=categoryOptions(state).filter(row=>row.active===1),payments=state.payment_sources.filter(row=>row.active===1);
  for(const row of invoiceDrafts.slice(0,invoiceShown)) {
    const item=node('li'),fieldset=node('fieldset');fieldset.disabled=row.existing;
    const select=node('input');select.type='checkbox';select.checked=row.selected;select.disabled=row.existing;
    const selected=node('label',row.number+(row.existing?'｜已匯入或已作廢，不重建':'｜記錄這張發票'));selected.prepend(select);select.onchange=()=>{row.selected=select.checked;invoiceSelection();};item.append(selected);
    for(const [key,label,type]of [['spent_on','消費日期','date'],['amount','發票總金額（元）','text'],['note','合併品名','text'],['category','發票分類','select'],['payment_source_id','發票付款方式','select']]) {
      const control=node(type==='select'?'select':'input');control.name=key;
      if(type==='select'){for(const value of key==='category'?categories:payments){const option=node('option',value.name);option.value=key==='category'?value.name:value.id;control.append(option);}}
      else{control.type=type;if(key==='amount')control.inputMode='decimal';if(key==='note')control.maxLength=200;}
      control.value=row.form[key];control.oninput=()=>{row.form[key]=control.value;};control.onchange=control.oninput;
      const title=node('label',label);title.append(control);fieldset.append(title);
    }
    if(row.needsTotal&&!row.existing)item.append(node('p','有相同明細列，無法判定是重複檔案或實際購買；請核對並自行填入整張總額，不自動刪品項。'));
    item.append(fieldset);invoiceContent.append(item);
  }
  document.querySelector('#invoice-more').hidden=invoiceShown>=invoiceDrafts.length;invoiceSelection();
}
invoiceFile.onchange=async()=>{
  if(busy||writeBlocked)return;
  const file=invoiceFile.files[0],ticket=++invoiceFileRequest;invoiceDrafts=[];invoiceConfirming=null;invoiceShown=50;invoiceNotice='';invoiceError.textContent='';renderInvoicePreview();
  if(!file)return;
  try{
    if(file.size>MAX_INVOICE_BYTES)throw new ValidationError('發票 CSV 超過 4 MiB；未匯入。');
    const parsed=invoicePreview(new Uint8Array(await file.arrayBuffer()));if(ticket!==invoiceFileRequest)return;
    const known=new Set(state.invoice_imports.map(row=>row.key)),category=categoryOptions(state).find(row=>row.active===1&&row.name==='其他')??categoryOptions(state).find(row=>row.active===1),payment=state.payment_sources.find(row=>row.active===1);
    invoiceDrafts=parsed.items.map(row=>{const existing=known.has(invoiceIdentity(row.number,row.date));return {...row,existing,selected:!existing,form:{spent_on:row.date,amount:row.needsTotal?'':row.amount,note:row.note,category:category?.name??'',payment_source_id:payment?.id??''}};});
    invoiceNotice='預覽 '+parsed.items.length+' 張｜不支援狀態／折讓排除 '+parsed.excluded+' 張｜無正數淨額排除 '+parsed.nonpositive+' 張｜非發票尾註 '+parsed.footerRows+' 列未匯入';renderInvoicePreview();
  }catch(failure){if(ticket===invoiceFileRequest)invoiceError.textContent=failure instanceof ValidationError?failure.message:'無法讀取發票 CSV；未匯入，請重新選檔。';}
};
document.querySelector('#invoice-clear').onclick=()=>{if(!busy){invoiceDialog.close();clearInvoicePreview();}};
document.querySelector('#invoice-more').onclick=()=>{invoiceShown+=50;renderInvoicePreview();};
document.querySelector('#invoice-review').onclick=()=>{
  if(busy||writeBlocked)return;
  try{
    const selected=invoiceDrafts.filter(row=>row.selected&&!row.existing);if(!selected.length)throw new ValidationError('請選取發票。');
    const today=taiwanToday(),total=selected.reduce((sum,row)=>sum+cents(validateInput(row.form,state,today).cents),0n);
    invoiceConfirming=selected.map(row=>({number:row.number,date:row.date,form:structuredClone(row.form)}));
    document.querySelector('#invoice-summary').textContent='將記錄 '+selected.length+' 張發票，共 '+amountText(total.toString())+' 元。日期、品名、分類及付款方式依預覽中確認的設定。';
    document.querySelector('#invoice-confirm-items').replaceChildren(...selected.map(row=>node('li',row.form.spent_on+'｜'+row.form.note+'｜'+row.form.amount+' 元｜'+row.form.category+'｜'+(state.payment_sources.find(payment=>payment.id===row.form.payment_source_id)?.name??''))));
    invoiceError.textContent='';document.querySelector('#invoice-dialog-error').textContent='';invoiceDialog.showModal();
  }catch(failure){invoiceError.textContent=failure instanceof ValidationError?failure.message:'無法確認發票預覽，請重新檢查。';}
};
document.querySelector('#invoice-cancel').onclick=()=>{if(!busy)invoiceDialog.close();};
invoiceDialog.oncancel=event=>{if(busy)event.preventDefault();};
document.querySelector('#invoice-confirm').onclick=()=>{if(!invoiceConfirming||busy||writeBlocked)return;const choices=invoiceConfirming;saving(()=>importInvoiceExpenses(db,choices),()=>{invoiceDialog.close();clearInvoicePreview();invoiceNotice='已記錄 '+choices.length+' 張發票消費。';invoiceSelection();},document.querySelector('#invoice-dialog-error'));};
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
function requiredMarkers() {
  for(const control of document.querySelectorAll('input,select,textarea')) {
    const label=control.closest('label');if(!label)continue;
    const required=control.required&&!control.matches(':disabled')&&!control.readOnly;
    let mark=label.querySelector('.required-mark');
    if(required&&!mark) {
      let caption=label.querySelector(':scope > .field-caption');
      if(!caption) {
        const texts=[...label.childNodes].filter(item=>item.nodeType===Node.TEXT_NODE&&item.textContent.trim());if(!texts.length)continue;
        caption=node('span',undefined,'field-caption');texts[0].before(caption);caption.append(...texts);
      }
      mark=node('span',' *','required-mark');mark.setAttribute('aria-hidden','true');caption.append(mark);
    }
    if(mark)mark.hidden=!required;
  }
}
new MutationObserver(requiredMarkers).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['required','disabled','readonly']});
requiredMarkers();
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
  let focus=null;
  busy=true;fields.disabled=true;document.querySelector('#shortcut-fields').disabled=true;message.textContent='';
  try {focus=action(await readLedger(db));}
  catch(failure){message.textContent=failure instanceof LedgerError || failure instanceof ValidationError ? failure.message : '無法讀取捷徑，請重新載入後再試。';}
  finally {busy=false;fields.disabled=writeBlocked;document.querySelector('#shortcut-fields').disabled=writeBlocked;focus?.focus();}
}
function startShortcut(snapshot,values=null,id=null,source=null) {
  if(shortcutManager.closest('[data-view]').hidden)showView(homePreferences.visible.shortcuts?'record':'settings',false);
  shortcutEditing=id;shortcutSource=source;shortcutId=id || 's_'+crypto.randomUUID();shortcutExpected=structuredClone(snapshot.shortcuts);
  shortcutForm.reset();shortcutChoices(shortcutForm,snapshot,values);
  if(values)for(const key of ['name','note','amount'])shortcutForm.elements[key].value=values[key];
  document.querySelector('#shortcut-form-title').textContent=id ? '更改捷徑' : '新增捷徑';
  document.querySelector('#shortcut-settings').open=true;return shortcutForm.elements.name;
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
    return form.elements.amount;
  },error);
}
function renderShortcuts() {
  if(shortcutExpected===null) {shortcutExpected=structuredClone(state.shortcuts);shortcutChoices(shortcutForm,state);}
  else shortcutChoices(shortcutForm,state,{category:shortcutForm.elements.category.value,payment_source_id:shortcutForm.elements.payment_source_id.value});
  const active=orderedShortcuts(state),quick=document.querySelector('#shortcut-quick'),all=document.querySelector('#shortcut-list');
  quick.replaceChildren();all.replaceChildren();
  for(const row of active.slice(0,homePreferences.shortcut_count)) {
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
        if(operation==='update') {shortcutError.textContent='';startShortcut(state,{...row,amount:row.cents===null?'':amountText(row.cents,false)},row.id).focus();}
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
document.querySelector('#shortcut-new').onclick=()=>shortcutRead(snapshot=>startShortcut(snapshot));
document.querySelector('#cancel-shortcut').onclick=()=>{if(!busy&&!writeBlocked){resetShortcut();shortcutError.textContent='';}};
const annualDialog=document.querySelector('#annual-dialog');
let annualDraft=null,annualAction=null,annualLimit=100;
function askAnnual(item) {
  if(busy||writeBlocked)return;annualAction=structuredClone(item);
  document.querySelector('#annual-dialog-title').textContent='確認略過此期';
  document.querySelector('#annual-dialog-summary').textContent=item.defaults.due_on+'｜'+item.defaults.name+'：只略過這一期，不產生消費；可恢復同一期。';
  document.querySelector('#annual-dialog-error').textContent='';annualDialog.showModal();
}
function beginScheduleDraft(item) {
  if(busy||writeBlocked)return;
  if(editing||annualDraft){document.querySelector('#fixed-error').textContent='請先儲存或取消目前的消費編輯。';return;}
  const previous=expenseDraft();
  resetForm();annualDraft={...structuredClone(item),previous};
  editingOrigin={listId:'schedule-periods',ruleId:item.rule_id,index:item.index};showView('record',false);
  form.elements.spent_on.value=item.defaults.due_on;usageFields(null,item.defaults.due_on);
  form.elements.amount.value=amountText(item.defaults.cents,false);form.elements.note.value=item.defaults.name;
  form.elements.category.value=item.defaults.category;form.elements.payment_source_id.value=item.defaults.payment_source_id ?? '';
  document.querySelector('#form-title').textContent='記錄定期支出（原定 '+item.defaults.due_on+'）';document.querySelector('#save').textContent='記錄消費';document.querySelector('#cancel-edit').hidden=false;
  error.textContent=!form.elements.category.value||!form.elements.payment_source_id.value?'原分類或付款方式已停用或未指定，請另選有效項目。':'';
  renderShortcuts();form.elements.amount.focus();
}
function renderPeriods() {
  const result=scheduleItems(state,taiwanToday(),annualLimit),recent=document.querySelector('#schedule-recent'),older=document.querySelector('#schedule-older ul');
  recent.replaceChildren();older.replaceChildren();
  const items=result.items;
  if(!items.length)recent.append(node('li','目前沒有可查看的期數。'));
  for(const [position,item] of items.entries()) {
    const row=node('li');row.dataset.ruleId=item.rule_id;row.dataset.index=item.index;
    const entry=state.expenses.find(entry=>entry.id===item.expense_id),voided=entry?.voided===1;
    row.append(node('p','預定 '+item.defaults.due_on+'｜'+item.defaults.name+'｜預設 '+amountText(item.defaults.cents)+' 元｜'+item.defaults.category+'｜'+item.defaults.payment_source_name+'｜'+({upcoming:'即將到期',pending:'待記錄',recorded:'已記錄',skipped:'已略過'}[item.status])+(voided?'（消費已刪除，不會重建）':entry?'｜實付 '+amountText(entry.cents)+' 元｜實際日期 '+entry.spent_on:'')));
    if(item.status==='pending')for(const [operation,label] of [['record','按預設記錄'],['draft','更改實付再記錄'],['skip','略過此期']]) {
      const button=node('button',label);button.type='button';button.dataset.operation=operation;
      button.onclick=()=>{if(busy||writeBlocked)return;if(operation==='draft')beginScheduleDraft(item);else if(operation==='skip')askAnnual(item);else saving(()=>processSchedule(db,'record',item.rule_id,item.index,item.rule_revision,item.revision,null),()=>{},document.querySelector('#fixed-error'));};row.append(button);
    }
    else if(item.status==='skipped') {
      const button=node('button','恢復此期');button.type='button';button.dataset.operation='resume';
      button.onclick=()=>saving(()=>processSchedule(db,'resume',item.rule_id,item.index,item.rule_revision,item.revision,null),()=>{},document.querySelector('#fixed-error'));row.append(button);
    }
    (position<5?recent:older).append(row);
  }
  document.querySelector('#schedule-older').hidden=items.length<=5;
  document.querySelector('#schedule-more').hidden=!result.more;
}
function renderScheduleOverview() {
  const result=scheduleMonth(state,taiwanToday().slice(0,7),taiwanToday());
  document.querySelector('#schedule-total').textContent='本月規劃金額：'+amountText(result.total)+' 元';
  document.querySelector('#schedule-month-items').replaceChildren(...result.items.map(item=>node('li',item.defaults.due_on+'｜'+item.defaults.name+'｜'+amountText(item.contribution)+' 元｜'+({upcoming:'即將到期',pending:'待記錄',recorded:'已記錄',skipped:'已略過'}[item.status]))));
}
document.querySelector('#schedule-more').onclick=()=>{if(!busy&&!writeBlocked){annualLimit+=100;renderPeriods();}};
document.querySelector('#cancel-annual').onclick=()=>{if(!busy)annualDialog.close();};
annualDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
annualDialog.addEventListener('close',()=>{if(!annualDialog.open)annualAction=null;});
document.querySelector('#confirm-annual').onclick=()=>{
  if(busy||writeBlocked||!annualAction)return;const item=annualAction;
  saving(()=>processSchedule(db,'skip',item.rule_id,item.index,item.rule_revision,item.revision,null),()=>annualDialog.close(),document.querySelector('#annual-dialog-error'));
};
const goalForm=document.querySelector('#goal-form');let goalEditing=null,goalDraftId=null;
function resetGoalForm(){goalForm.reset();goalEditing=null;goalDraftId=null;document.querySelector('#goal-form-title').textContent='新增目標';}
document.querySelector('#goal-cancel').onclick=()=>{if(!busy&&!writeBlocked){resetGoalForm();document.querySelector('#goal-error').textContent='';}};
goalForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  const message=document.querySelector('#goal-error');message.textContent='';
  if(!goalForm.elements.deadline.validity.valid){message.textContent='請輸入有效的目標期限。';return;}
  goalDraftId??='g_'+crypto.randomUUID();const input=Object.fromEntries(new FormData(goalForm));
  input.remind=goalForm.elements.remind.checked?1:0;input.completed=goalForm.elements.completed.checked?1:0;
  const id=goalEditing?.id??goalDraftId;
  saving(()=>updateGoal(db,goalEditing?'update':'add',id,goalEditing?.revision??null,input),()=>{
    resetGoalForm();if(incomeLoaded){if(!allocationDirty)loadAllocation();else{
      allocationGoalExpected[id]=state.goals.find(row=>row.id===id).revision;
      for(const select of document.querySelectorAll('#allocation-items [data-field="goal_id"]'))allocationGoalChoices(select,select.value);
    }}
  },message);
};
function renderGoals() {
  const overview=document.querySelector('#home-goals-list');overview.replaceChildren(...(state.goals||[]).map(goal=>node('li',goal.name+'：'+amountText(goal.saved_cents)+'／'+amountText(goal.target_cents)+' 元（已存／目標）'+(goal.completed?'；已完成（手動確認）':''))));if(!overview.children.length)overview.append(node('li','尚未建立目標。'));
  const list=document.querySelector('#goal-list'),today=taiwanToday(),actions=new Map();list.replaceChildren();
  for(const action of state.goal_actions||[]){if(!actions.has(action.goal_id))actions.set(action.goal_id,[]);actions.get(action.goal_id).push(action);}
  if(!state.goals?.length){list.append(node('li','尚未建立目標。'));return;}
  for(const goal of state.goals) {
    const row=node('li');row.dataset.goalId=goal.id;row.append(node('h3',goal.name),node('p',amountText(goal.saved_cents)+'／'+amountText(goal.target_cents)+' 元（已存／目標）'));
    const progress=node('progress');progress.max=100;progress.value=Number(cents(goal.saved_cents)*100n/cents(goal.target_cents)>100n?100n:cents(goal.saved_cents)*100n/cents(goal.target_cents));progress.setAttribute('aria-label',goal.name+'的目標進度');row.append(progress);
    row.append(node('p',goal.completed?'已完成（手動確認）':'尚未完成'),node('p',goal.deadline?'期限：'+goal.deadline:'不限時'));
    if(goal.remind===1&&goal.deadline&&goal.completed===0)row.append(node('p',goal.deadline<=today?'期限已到；請自行確認目標進度。':'期限提示：'+goal.deadline+'，請自行安排。'));
    const edit=node('button','更改目標／調整已存總額');edit.type='button';edit.disabled=busy||writeBlocked;edit.onclick=()=>{
      if(busy||writeBlocked)return;goalEditing=structuredClone(goal);goalDraftId=null;
      for(const [key,value]of Object.entries({name:goal.name,target_amount:amountText(goal.target_cents,false),saved_amount:amountText(goal.saved_cents,false),deadline:goal.deadline??''}))goalForm.elements[key].value=value;
      goalForm.elements.remind.checked=goal.remind===1;goalForm.elements.completed.checked=goal.completed===1;document.querySelector('#goal-form-title').textContent='更改目標';goalForm.elements.name.focus();
    };row.append(edit);
    const history=node('details'),entries=node('ul');history.append(node('summary','查看已存調整紀錄'),entries);
    for(const action of actions.get(goal.id)||[]){
      const delta=BigInt(action.delta_cents);entries.append(node('li',(action.kind==='manual'?'手動校正':action.month+' 分配差額')+'：'+amountText(action.before_cents)+' → '+amountText(action.after_cents)+' 元；差額 '+(delta<0n?'-':delta>0n?'+':'')+amountText(delta<0n?-delta:delta)+' 元'));
    }
    row.append(history);list.append(row);
  }
}
document.querySelector('#goal-planning').addEventListener('toggle',()=>{if(state&&document.querySelector('#goal-planning').open)renderGoals();});
const incomePanel=document.querySelector('#income-planning'),incomeForm=document.querySelector('#income-form');
const incomeMonthForm=document.querySelector('#income-month-form'),allocationForm=document.querySelector('#allocation-form');
const incomeError=document.querySelector('#income-error'),incomeVoidDialog=document.querySelector('#income-void-dialog');
const incomeRecordMonthForm=document.querySelector('#income-record-month-form'),incomeRecordError=document.querySelector('#income-record-error');
let incomeRecordMonth=taiwanToday().slice(0,7);
const incomeRuleForm=document.querySelector('#income-rule-form'),incomeRuleError=document.querySelector('#income-rule-error');
let incomeRuleEditing=null,incomeRuleDraftId=null,incomeConfirming=null,incomePeriodLimit=100;
function resetIncomeRuleForm(){incomeRuleForm.reset();incomeRuleEditing=null;incomeRuleDraftId=null;incomeRuleForm.elements.first_due_on.value=taiwanToday();incomeRuleForm.elements.first_due_on.readOnly=false;incomeRuleForm.elements.due_day.value=String(Number(taiwanToday().slice(8)));document.querySelector('#income-rule-save').textContent='新增定期收入';}
resetIncomeRuleForm();
incomeRuleForm.elements.first_due_on.onchange=()=>{if(!incomeRuleEditing&&incomeRuleForm.elements.first_due_on.value)incomeRuleForm.elements.due_day.value=String(Number(incomeRuleForm.elements.first_due_on.value.slice(8)));};
document.querySelector('#income-rule-cancel').onclick=()=>{if(!busy&&!writeBlocked){resetIncomeRuleForm();incomeRuleError.textContent='';}};
incomeRuleForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  incomeRuleDraftId??='ir_'+crypto.randomUUID();const values=Object.fromEntries(new FormData(incomeRuleForm));values.due_day=Number(values.due_day);
  saving(()=>updateIncomeRule(db,incomeRuleEditing?'update':'add',incomeRuleEditing?.id??incomeRuleDraftId,incomeRuleEditing?.revision??null,values),resetIncomeRuleForm,incomeRuleError);
};
function renderRecurringIncome(){
  const list=document.querySelector('#income-rule-list');list.replaceChildren();
  for(const rule of state.income_rules||[]){
    const row=node('li');row.append(node('p',rule.name+'｜'+amountText(rule.cents)+' 元｜每月 '+rule.due_day+' 日｜首次 '+rule.first_due_on+(rule.active?'':'（已停用）')));
    if(rule.active===1){const edit=node('button','更改定期收入');edit.type='button';edit.onclick=()=>{
      if(busy||writeBlocked)return;incomeRuleEditing=structuredClone(rule);incomeRuleDraftId=null;
      for(const [key,value]of Object.entries({name:rule.name,amount:amountText(rule.cents,false),first_due_on:rule.first_due_on,due_day:String(rule.due_day)}))incomeRuleForm.elements[key].value=value;
      incomeRuleForm.elements.first_due_on.readOnly=true;document.querySelector('#income-rule-save').textContent='儲存定期收入更改';incomeRuleForm.elements.name.focus();
    };const stop=node('button','停用定期收入');stop.type='button';stop.onclick=()=>{if(busy||writeBlocked||!confirm('停用「'+rule.name+'」？已到期草稿與歷史收入保留，未來不再產生新期數。'))return;saving(()=>updateIncomeRule(db,'disable',rule.id,rule.revision,null),()=>{},incomeRuleError);};row.append(edit,stop);}list.append(row);
  }
  if(!list.children.length)list.append(node('li','尚未設定定期收入。'));
  const periods=document.querySelector('#income-periods'),result=recurringIncomeItems(state,taiwanToday(),incomePeriodLimit),receipts=new Map((state.incomes||[]).map(entry=>[entry.id,entry]));periods.replaceChildren();
  for(const item of result.items){
    const row=node('li');row.dataset.status=item.status;const entry=receipts.get(item.income_id);
    const label=item.status==='recorded'?(entry?.voided?'已記錄（收入已作廢，不會重建）':'已記錄'):item.status==='skipped'?'已略過':item.status==='upcoming'?'尚未到期':'待確認';
    row.append(node('p',item.defaults.due_on+'｜'+item.defaults.name+'｜預定 '+amountText(item.defaults.cents)+' 元｜'+label+(entry&&entry.voided===0?'｜實收 '+amountText(entry.cents)+' 元（'+entry.received_on+'）':'')));
    const process=(operation,values=null)=>{if(busy||writeBlocked)return;saving(()=>processIncomePeriod(db,item.rule_id,item.month,item.rule_revision,item.revision,operation,values),()=>{if(operation==='record')incomeRecordMonth=(values?.received_on??item.defaults.due_on).slice(0,7);},incomeRecordError);};
    if(item.defaults.due_on<=taiwanToday()&&item.status==='pending'){
      for(const [operation,text]of [['record','確認已收到'],['edit','先更改收入草稿'],['skip','略過這期']]){
        const button=node('button',text);button.type='button';button.dataset.incomeOperation=operation;button.onclick=()=>{
          if(busy||writeBlocked)return;
          if(operation==='edit'){
            if((incomeForm.elements.name.value||incomeForm.elements.amount.value)&&!confirm('改用這期收入草稿？目前未儲存的收入草稿將被取代。'))return;
            incomeConfirming=structuredClone(item);incomeEditing=null;incomeDraftId=null;
            for(const [key,value]of Object.entries({name:item.defaults.name,amount:amountText(item.defaults.cents,false),received_on:item.defaults.due_on}))incomeForm.elements[key].value=value;
            document.querySelector('#income-form-title').textContent='確認定期收入草稿';document.querySelector('#save-income').textContent='確認已收到並儲存';document.querySelector('#cancel-income-edit').hidden=false;incomeForm.elements.amount.focus();
          }else if(confirm((operation==='record'?'確認已收到':'略過這期')+'：'+item.defaults.due_on+'｜'+item.defaults.name+'｜'+amountText(item.defaults.cents)+' 元？'))process(operation);
        };row.append(button);
      }
    }else if(item.status==='skipped'&&item.defaults.due_on<=taiwanToday()){const button=node('button','恢復待確認');button.type='button';button.onclick=()=>process('restore');row.append(button);}periods.append(row);
  }
  if(!periods.children.length)periods.append(node('li','目前沒有定期收入期數。'));
  document.querySelector('#income-period-more').hidden=!result.more;
}
document.querySelector('#income-period-more').onclick=()=>{if(busy||writeBlocked)return;incomePeriodLimit=Math.min(incomePeriodLimit+100,100000);renderRecurringIncome();};
let incomeViewedMonth=taiwanToday().slice(0,7),incomeLoaded=false,incomeEditing=null,incomeVoiding=null;
let incomeDraftId=null,allocationExpected=null,allocationDirty=false,allocationGoalExpected={};
let incomeViewRequest=0;
incomeMonthForm.elements.month.value=incomeViewedMonth;
incomeRecordMonthForm.elements.month.value=incomeRecordMonth;
incomeForm.elements.received_on.value=taiwanToday();
function incomeBusy(disabled) {
  document.querySelector('#income-fields').disabled=disabled;
  document.querySelector('#income-record-fields').disabled=disabled;
  for (const id of ['confirm-income-void','cancel-income-void']) document.querySelector('#'+id).disabled=disabled;
}
function allocationGoalChoices(select,selected='') {
  const none=node('option','不連結目標');none.value='';select.replaceChildren(none);
  const goals=(state.goals||[]).filter(goal=>goal.completed===0||goal.id===selected),names=new Map();
  for(const goal of goals)names.set(goal.name,(names.get(goal.name)||0)+1);
  for(const goal of goals){const option=node('option',goal.name+(names.get(goal.name)>1?'（目標 '+amountText(goal.target_cents)+' 元）':'')+(goal.completed?'（已完成）':''));option.value=goal.id;select.append(option);}
  select.value=selected;
}
function allocationRow(item) {
  const row=node('div',undefined,'form-grid'); row.dataset.itemId=item.id;
  const name=node('input'),amount=node('input');name.value=item.name;name.maxLength=30;name.dataset.field='name';name.required=true;
  amount.value=amountText(item.cents,false);amount.inputMode='decimal';amount.dataset.field='amount';amount.required=true;
  const nameLabel=node('label','分配項目名稱'),amountLabel=node('label','分配金額（元）');nameLabel.append(name);amountLabel.append(amount);row.append(nameLabel,amountLabel);
  const select=node('select'),goalLabel=node('label','連結目標（選填）');select.dataset.field='goal_id';allocationGoalChoices(select,item.goal_id??'');goalLabel.append(select);row.append(goalLabel);
  const remove=node('button','移除此分配草稿項目');remove.type='button';remove.onclick=()=>{if(!busy&&!writeBlocked){row.remove();allocationDirty=true;}};row.append(remove);
  return row;
}
function loadAllocation() {
  const plan=state.monthly_allocations.find(row=>row.month===incomeViewedMonth);
  allocationExpected=plan?.revision??null;allocationDirty=false;
  allocationGoalExpected=Object.fromEntries((state.goals||[]).map(row=>[row.id,row.revision]));
  document.querySelector('#allocation-items').replaceChildren(...(plan?.items||defaultAllocation()).map(allocationRow));
}
function resetIncomeForm() {
  incomeForm.reset();incomeEditing=null;incomeDraftId=null;incomeConfirming=null;incomeForm.elements.received_on.value=taiwanToday();
  document.querySelector('#income-form-title').textContent='新增已收到的收入';document.querySelector('#save-income').textContent='儲存收入';
  document.querySelector('#cancel-income-edit').hidden=true;
}
function renderIncomeRecords() {
  incomeRecordMonthForm.elements.month.value=incomeRecordMonth;
  const summary=incomeMonth(state,incomeRecordMonth,taiwanToday());
  document.querySelector('#income-record-summary').textContent=incomeRecordMonth+' 已收到的收入：'+amountText(summary.received)+' 元';
  const incomes=document.querySelector('#income-list');incomes.replaceChildren();
  if(!summary.entries.length)incomes.append(node('li','本月尚無已收到的收入。'));
  for(const entry of summary.entries.slice().reverse()) {
    const row=node('li');row.dataset.incomeId=entry.id;row.append(node('p',entry.received_on+'｜'+entry.name+'｜'+amountText(entry.cents)+' 元'));
    const edit=node('button','更改收入');edit.type='button';edit.onclick=()=>{
      if(busy||writeBlocked)return;incomeEditing=structuredClone(entry);incomeDraftId=null;incomeConfirming=null;
      incomeForm.elements.received_on.value=entry.received_on;incomeForm.elements.name.value=entry.name;incomeForm.elements.amount.value=amountText(entry.cents,false);
      document.querySelector('#income-form-title').textContent='更改已收到的收入';document.querySelector('#save-income').textContent='儲存收入更改';
      document.querySelector('#cancel-income-edit').hidden=false;incomeForm.elements.amount.focus();
    };
    const remove=node('button','作廢收入');remove.type='button';remove.onclick=()=>{
      if(busy||writeBlocked)return;incomeVoiding=structuredClone(entry);
      document.querySelector('#income-void-summary').textContent=entry.received_on+'｜'+entry.name+'｜'+amountText(entry.cents)+' 元';incomeVoidDialog.showModal();
    };row.append(edit,remove);incomes.append(row);
  }
}
function renderIncome() {
  incomeMonthForm.elements.month.value=incomeViewedMonth;
  const summary=incomeMonth(state,incomeViewedMonth,taiwanToday()),suggestions=recurringSuggestions(state,incomeViewedMonth,taiwanToday());
  const totals=document.querySelector('#income-summary');
  totals.replaceChildren(node('h3',incomeViewedMonth),node('p','已收到的收入：'+amountText(summary.received)+' 元'),
    node('p','已規劃的分配：'+(summary.plan?amountText(summary.allocated)+' 元':'尚未設定')),
    node('p',summary.difference<0n?'超出本月收入 '+amountText(-summary.difference)+' 元':'尚未分配的規劃差額：'+amountText(summary.difference)+' 元'));
  document.querySelector('#income-history').replaceChildren(...(summary.entries.length?summary.entries.slice().reverse().map(entry=>node('li',entry.received_on+'｜'+entry.name+'｜'+amountText(entry.cents)+' 元')):[node('li','本月尚無已收到的收入。')]));
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
  const reserve=scheduleReserve(state,incomeViewedMonth,taiwanToday());
  document.querySelector('#annual-reserve-total').textContent=incomeViewedMonth<taiwanToday().slice(0,7)?'往月不重新推算年度參考額，以上為當時已儲存分配。':'每月參考額合計：'+amountText(reserve.total)+' 元（另列，不套用分配）';
  document.querySelector('#annual-reserve-items').replaceChildren(...reserve.items.map(item=>node('li',item.name+'｜年度預估 '+amountText(item.annual_cents)+' 元｜每月參考額 '+amountText(item.cents)+' 元')));
}
async function openIncomeMonth(month) {
  if(busy||writeBlocked)return;
  const request=++incomeViewRequest;
  try{allocationMonth(month);const snapshot=await readLedger(db);if(request!==incomeViewRequest)return;const retain=incomeLoaded&&month===incomeViewedMonth&&allocationDirty;state=snapshot;incomeViewedMonth=month;incomeLoaded=true;if(!retain)loadAllocation();renderIncome();incomeError.textContent='';}
  catch{if(request===incomeViewRequest)incomeError.textContent='無法讀取收入與分配，請確認月份並重新載入。';}
}
incomePanel.addEventListener('toggle',()=>{if(incomePanel.open){if(incomeLoaded)renderIncome();else openIncomeMonth(incomeViewedMonth);}});
document.querySelector('#income-entry').onclick=event=>{event.preventDefault();incomePanel.open=true;incomePanel.querySelector('summary').focus();};
incomeMonthForm.onsubmit=event=>{
  event.preventDefault();const month=incomeMonthForm.elements.month.value;
  if(allocationDirty&&month!==incomeViewedMonth&&!confirm('切換月份將放棄未儲存的分配草稿；已儲存資料不變。'))return;
  openIncomeMonth(month);
};
incomeForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  incomeDraftId??='i_'+crypto.randomUUID();const id=incomeEditing?.id||incomeDraftId,input=Object.fromEntries(new FormData(incomeForm));
  saving(()=>incomeConfirming?processIncomePeriod(db,incomeConfirming.rule_id,incomeConfirming.month,incomeConfirming.rule_revision,incomeConfirming.revision,'record',input):updateIncome(db,incomeEditing?'update':'add',id,incomeEditing?.revision??null,input),()=>{incomeRecordMonth=input.received_on.slice(0,7);resetIncomeForm();},incomeRecordError);
};
incomeRecordMonthForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  try{incomeRecordMonth=allocationMonth(incomeRecordMonthForm.elements.month.value);renderIncomeRecords();incomeRecordError.textContent='';}
  catch{incomeRecordError.textContent='請選擇有效收入月份。';}
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
  const value=recurringSuggestions(state,incomeViewedMonth,taiwanToday()).total;
  let target=document.querySelector('[data-item-id="living"] [data-field="amount"]');
  if(!target){document.querySelector('#allocation-items').append(allocationRow(defaultAllocation()[0]));target=document.querySelector('[data-item-id="living"] [data-field="amount"]');}
  target.value=amountText(value,false);allocationDirty=true;
};
allocationForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked||!incomeLoaded)return;
  const items=[...document.querySelectorAll('#allocation-items > div')].map(row=>({id:row.dataset.itemId,name:row.querySelector('[data-field="name"]').value,amount:row.querySelector('[data-field="amount"]').value,...(row.querySelector('[data-field="goal_id"]').value?{goal_id:row.querySelector('[data-field="goal_id"]').value}:{})}));
  saving(()=>updateAllocation(db,incomeViewedMonth,allocationExpected,items,allocationGoalExpected),()=>{loadAllocation();},incomeError);
};
const comparisonForm=document.querySelector('#comparison-form');
for(const [key,value] of Object.entries(comparisonDefaults(taiwanToday())))comparisonForm.elements[key].value=value;
let comparisonCharts=[],comparisonQuery=null,comparisonRequest=0;
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
async function showComparison(result,request=comparisonRequest) {
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
    if(request!==comparisonRequest)return;
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
  event.preventDefault();const button=comparisonForm.querySelector('button');if(button.disabled||busy||writeBlocked)return;
  const request=++comparisonRequest;comparisonQuery=null;
  const query=Object.fromEntries(new FormData(comparisonForm)),today=taiwanToday(),message=document.querySelector('#comparison-error');
  message.textContent='';clearComparison();button.disabled=true;
  try{
    if(['a_start','a_end','b_start','b_end'].some(key=>!comparisonForm.elements[key].validity.valid))throw new ValidationError('請輸入有效日期。');
    validateComparison(query,today);
    const snapshot=await readLedger(db); // One readonly transaction; never sync recurring rules.
    if(request!==comparisonRequest)return;comparisonQuery=query;
    await showComparison(compareExpenses(snapshot,query,today),request);
  }catch(failure){if(request!==comparisonRequest)return;comparisonQuery=null;clearComparison();message.textContent=failure instanceof ValidationError?failure.message:'無法比較支出，請重新載入後再試。';}
  finally{button.disabled=false;}
});
const analysisForm=document.querySelector('#analysis-form'),analysisGroups=document.querySelector('#analysis-groups');
let analysisChart=null,analysisResult=null,analysisRequest=0,analysisChartRequest=0,analysisSelected=null,analysisQuery=null;
function analysisRange(group,start='',end='') {
  const row=node('div',undefined,'form-grid');row.dataset.range='';
  for(const [name,title,value]of [['start','選取開始日期',start],['end','選取結束日期',end]]){
    const label=node('label',title),input=node('input');input.type='date';input.name=name;input.value=value;input.required=true;label.append(input);row.append(label);
  }
  const remove=node('button','移除此段');remove.type='button';remove.onclick=()=>{row.remove();group.querySelector('[data-add-range]').focus();};row.append(remove);group.querySelector('[data-ranges]').append(row);return row.querySelector('input');
}
function analysisGroup(name='',start='',end='') {
  const group=node('fieldset'),legend=node('legend','比較組'),label=node('label','組名'),input=node('input');input.name='group_name';input.value=name;input.required=true;input.maxLength=80;label.append(input);
  const ranges=node('div');ranges.dataset.ranges='';const add=node('button','新增所選期間'),remove=node('button','移除此組');add.type=remove.type='button';add.dataset.addRange='';add.onclick=()=>analysisRange(group).focus();remove.onclick=()=>{group.remove();document.querySelector('#analysis-add-group').focus();};
  group.append(legend,label,ranges,add,remove);analysisGroups.append(group);analysisRange(group,start,end);return input;
}
function analysisPreset() {
  const defaults=comparisonDefaults(taiwanToday());analysisGroups.replaceChildren();analysisGroup('本月',defaults.a_start,defaults.a_end);analysisGroup('上月',defaults.b_start,defaults.b_end);
  analysisForm.elements.unit.value='month';analysisForm.elements.trend_start.value=defaults.b_start;analysisForm.elements.trend_end.value=defaults.a_end;
}
analysisPreset();
document.querySelector('#analysis-add-group').onclick=()=>analysisGroup('比較組 '+(analysisGroups.children.length+1)).focus();
document.querySelector('#analysis-preset').onclick=()=>{analysisPreset();analysisForm.elements.mode.value='compare';analysisForm.elements.mode.onchange();runAnalysis();};
function analysisChoices() {
  const target=document.querySelector('#analysis-categories'),selected=new Set([...target.querySelectorAll('input:checked')].map(input=>input.value));
  target.querySelectorAll('label').forEach(label=>label.remove());
  for(const option of comparisonCategories(state,taiwanToday())){
    const label=node('label',undefined,'usage-checkbox'),input=node('input');input.type='checkbox';input.value=option.name;input.checked=selected.has(option.name);
    label.append(input,document.createTextNode(option.name+(option.state==='active'?'':option.state==='inactive'?'（停用）':'（歷史）')));target.append(label);
  }
}
function analysisInput() {
  const groups=analysisForm.elements.mode.value==='trend'?[{name:'連續區間',ranges:[{start:analysisForm.elements.trend_start.value,end:analysisForm.elements.trend_end.value}]}]:[...analysisGroups.children].map(group=>({name:group.querySelector('[name=group_name]').value,ranges:[...group.querySelectorAll('[data-range]')].map(row=>({start:row.querySelector('[name=start]').value,end:row.querySelector('[name=end]').value}))}));
  return {unit:analysisForm.elements.unit.value,groups,categories:[...document.querySelectorAll('#analysis-categories input:checked')].map(input=>input.value),keyword:analysisForm.elements.keyword.value};
}
const analysisMoney=value=>value===null?'無法計算':amountText(value)+' 元';
function analysisAverage(value) {
  if(value===null)return '無法計算';
  const {numerator,denominator}=value,rounded=(numerator*2n+denominator)/(denominator*2n);
  return (numerator%denominator?'約 ':'')+amountText(rounded)+' 元';
}
function analysisDetail(groupIndex,periodIndex) {
  const group=analysisResult.groups[groupIndex],period=group.periods[periodIndex],target=document.querySelector('#analysis-detail');analysisSelected={groupIndex,periodIndex};
  target.replaceChildren(node('h3',group.name+'：'+period.start+' ～ '+period.end),node('p',period.started?analysisMoney(period.total_cents)+(period.unfinished?'（截至今天）':''):'尚未開始'));
  if(!period.started)return;
  const categories=[...period.categories].sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]>b[1]?-1:1);
  target.append(comparisonTable(['分類','小計'],categories.map(([name,value])=>[name,analysisMoney(value)])));
  if(!period.rows.length){target.append(node('p','此期間沒有符合條件的消費。'));return;}
  const detail=node('details'),summary=node('summary','查看帳目（'+period.rows.length+' 筆）'),list=node('ul'),more=node('button','顯示更多帳目');more.type='button';more.dataset.more='';let shown=0;
  const append=()=>{for(const row of period.rows.slice(shown,shown+50))list.append(node('li',row.spent_on+'｜'+analysisMoney(BigInt(row.cents))+'｜'+row.note+'｜'+row.category+'｜'+row.payment_source_name));shown+=50;more.hidden=shown>=period.rows.length;};
  more.onclick=append;append();detail.append(summary,list,more);target.append(detail);
}
async function analysisPlot() {
  const request=++analysisChartRequest;analysisChart?.destroy();analysisChart=null;
  const box=document.querySelector('#analysis-chart'),message=document.querySelector('#analysis-chart-status');if(!box)return;box.replaceChildren();box.hidden=true;
  const result=analysisResult,kind=analysisForm.elements.chart.value;
  if(!result.plottable){message.textContent='金額超過圖表安全精度；請閱讀精確文字與表格。';return;}
  if(!result.groups.some(group=>group.started_count)){message.textContent='期間尚未開始，沒有可繪製資料。';return;}
  let data,tooltip;
  const money=value=>analysisMoney(value),colors=index=>`hsl(${(index*137.5)%360} 50% 40%)`;
  if(kind==='pie'){
    const selected=analysisSelected,period=selected&&result.groups[selected.groupIndex].periods[selected.periodIndex];
    if(!period?.started||period.total_cents===0n){message.textContent='請選擇有消費的期間查看分類占比。';return;}
    const rows=[...period.categories].sort((a,b)=>a[0].localeCompare(b[0]));
    data={labels:rows.map(row=>row[0]),datasets:[{data:rows.map(row=>Number(row[1])),backgroundColor:rows.map((_,i)=>colors(i))}]};
    tooltip=context=>{const row=rows[context.dataIndex],ratio=ratioText(row[1],period.total_cents,1);return row[0]+'：'+money(row[1])+'（'+(row[1]>0n&&ratio==='0'?'<0.1':ratio)+'%）';};
  }else{
    const starts=[...new Set(result.groups.flatMap(group=>group.periods.map(period=>period.start)))].sort();
    const series=result.groups.map(group=>new Map(group.periods.map(period=>[period.start,period])));
    data={labels:starts,datasets:result.groups.map((group,index)=>({label:group.name,data:starts.map(start=>{const period=series[index].get(start);return period?.started?Number(period.total_cents):null;}),backgroundColor:colors(index),borderColor:colors(index),tension:0,spanGaps:false,pointRadius:3}))};
    tooltip=context=>{const period=series[context.datasetIndex].get(starts[context.dataIndex]);return context.dataset.label+' '+period.start+' ～ '+period.end+'：'+money(period.total_cents)+(period.unfinished?'（截至今天）':'');};
  }
  try{
    await import('./vendor/chartjs-4.5.1/chart.umd.min.js');if(request!==analysisChartRequest)return;
    const canvas=node('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',kind==='pie'?'所選期間分類占比；精確資料見表格':kind==='line'?'支出分析折線；精確資料見表格':'支出分析長條；精確資料見表格');box.append(canvas);box.hidden=false;
    analysisChart=new globalThis.Chart(canvas,{type:kind,data,options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{tooltip:{callbacks:{label:tooltip}}},...(kind==='pie'?{}:{scales:{y:{beginAtZero:true,ticks:{callback:value=>Number.isSafeInteger(value)?money(BigInt(value)):''}}}})}});
    message.textContent='圖表為彙總，精確金額及帳目見下方文字。';
  }catch{if(request!==analysisChartRequest)return;analysisChart?.destroy();analysisChart=null;box.replaceChildren();box.hidden=true;message.textContent='圖表無法載入，請閱讀完整文字與表格。';}
}
async function showAnalysis(result) {
  const target=document.querySelector('#analysis-results');analysisResult=result;analysisSelected=null;target.replaceChildren();
  target.append(node('p','單位：'+({week:'週（週一開始）',month:'月',year:'年'}[result.unit])+'；未結束期間只統計截至今天。不等長或未結束不能解讀為花費變少。'));
  if(result.cross_overlap)target.append(node('p','不同組包含重疊期間，各組獨立計算，請勿把組總額相加。'));
  for(const group of result.groups){target.append(node('h3',group.name),node('p','所選期間數：'+group.selected_count+'；已開始：'+group.started_count+'；有消費期間數：'+group.consumed_count),node('p','總額：'+analysisMoney(group.total_cents)+'；最高：'+analysisMoney(group.highest_cents)+'；最低：'+analysisMoney(group.lowest_cents)),node('p','所有已開始期間平均（含0）：'+analysisAverage(group.all_average)+'；有消費期間平均（排除0）：'+analysisAverage(group.consumed_average)));if(group.overlap)target.append(node('p','本組選取重疊，期間及同筆消費只計一次。'));}
  const box=node('div',undefined,'comparison-chart');box.id='analysis-chart';const message=node('p');message.id='analysis-chart-status';target.append(box,message);
  for(const [groupIndex,group]of result.groups.entries()){
    target.append(node('h3',group.name+' 各期間'));
    const table=comparisonTable(['期間','總額','狀態','查看'],[]),body=table.querySelector('tbody');
    for(const [periodIndex,period]of group.periods.entries()){
      const row=node('tr');row.append(node('td',period.start+' ～ '+period.end),node('td',analysisMoney(period.total_cents)),node('td',(!period.started?'尚未開始':period.unfinished?'截至今天':'已結束')+(period.cross_overlap?'；跨組重疊':'')));
      const cell=node('td'),button=node('button','查看分類與帳目');button.type='button';button.dataset.period='';button.setAttribute('aria-label',group.name+' '+period.start+' 查看分類與帳目');button.onclick=()=>{analysisDetail(groupIndex,periodIndex);document.querySelector('#analysis-detail').focus();if(analysisForm.elements.chart.value==='pie')analysisPlot();};cell.append(button);row.append(cell);body.append(row);
    }
    target.append(table);
  }
  const detail=node('section');detail.id='analysis-detail';detail.tabIndex=-1;target.append(detail);
  const selected=result.groups.flatMap((group,groupIndex)=>group.periods.map((period,periodIndex)=>({period,groupIndex,periodIndex}))).find(item=>item.period.started&&item.period.total_cents>0n);
  if(selected)analysisDetail(selected.groupIndex,selected.periodIndex);
  await analysisPlot();
}
async function runAnalysis() {
  if(busy)return;const request=++analysisRequest,input=analysisInput(),message=document.querySelector('#analysis-error'),button=document.querySelector('#analysis-submit');button.disabled=true;message.textContent='';
  try{
    const snapshot=await readLedger(db);if(request!==analysisRequest)return;
    const result=analyzeExpenses(snapshot,input,taiwanToday());analysisQuery=input;await showAnalysis(result);
  }catch(failure){if(request!==analysisRequest)return;++analysisChartRequest;analysisChart?.destroy();analysisChart=null;analysisResult=null;analysisQuery=null;document.querySelector('#analysis-results').replaceChildren();message.textContent=failure instanceof ValidationError?failure.message:'無法分析支出，請重新載入後再試。';}
  finally{if(request===analysisRequest)button.disabled=false;}
}
analysisForm.onsubmit=event=>{event.preventDefault();runAnalysis();};
analysisForm.elements.unit.onchange=()=>{if(analysisQuery)runAnalysis();};
analysisForm.elements.mode.onchange=()=>{const trend=analysisForm.elements.mode.value==='trend';document.querySelector('#analysis-trend').hidden=!trend;document.querySelector('#analysis-custom').hidden=trend;};
analysisForm.elements.chart.onchange=()=>{if(analysisResult)analysisPlot();};
function choices() {
  form.elements.payment_source_id.required=!editing;
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
  usageRequired();
}
function usageRequired() {
  const tracked=form.elements.usage_days.value.trim()!=='';
  form.elements.usage_started_on.required=tracked;form.elements.usage_reminder_days.required=tracked;
}
form.elements.usage_days.addEventListener('input',usageRequired);
form.elements.usage_started_on.oninput=()=>{usageStartChosen=true;};
form.elements.spent_on.onchange=()=>{
  if(!usageStartChosen && (!editing || !state.usage_periods.some(row=>row.expense_id===editing.id)))
    form.elements.usage_started_on.value=form.elements.spent_on.value;
};
document.querySelector('#usage-stop').onclick=()=>{if(!busy&&!writeBlocked){form.elements.usage_days.value='';form.elements.usage_remind.checked=false;usageRequired();}};
function beginExpenseEdit(entry,origin,snapshot=state) {
  if(busy||writeBlocked)return;
  if(['search-results','search-selection-results'].includes(origin?.listId)&&!editing&&!annualDraft&&!searchExpenseDraft)searchExpenseDraft=expenseDraft();
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
function expenseDraft() {
  return {values:[...form.elements].filter(el=>el.name).map(el=>({name:el.name,value:el.value,checked:el.checked})),tags:structuredClone(tagDraft),query:tagInput.value,usageStartChosen,tagsOpen:document.querySelector('#expense-tags').open,usageOpen:document.querySelector('#usage-inputs').open};
}
function resetForm() {
  const origin = editingOrigin;
  const previous = annualDraft?.previous || searchExpenseDraft;
  searchExpenseDraft=null;
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
  if(previous) {
    for(const item of previous.values){form.elements[item.name].value=item.value;if(form.elements[item.name].type==='checkbox')form.elements[item.name].checked=item.checked;}
    tagDraft=previous.tags;tagInput.value=previous.query;usageStartChosen=previous.usageStartChosen;renderTagInput();
    document.querySelector('#expense-tags').open=previous.tagsOpen;document.querySelector('#usage-inputs').open=previous.usageOpen;
    document.querySelector('#cancel-edit').hidden=!previous.values.some(item=>['amount','note','usage_days'].includes(item.name)&&item.value.trim())&&tagDraft.length===0;
    renderShortcuts();
  }
  usageRequired();
  return origin;
}
function returnToExpense(origin) {
  if (!origin) return;
  const container = document.getElementById(origin.listId);
  showView(container.closest('[data-view]').dataset.view,false);
  const row = origin.ruleId ? [...container.querySelectorAll('[data-rule-id]')].find(row=>row.dataset.ruleId===origin.ruleId&&row.dataset.index===String(origin.index)) : [...container.children].find(row => row.dataset.expenseId === origin.id);
  if(row?.closest('details'))row.closest('details').open=true;
  const target = row?.querySelector('[data-batch-id]') || row?.querySelector('button') || container;
  if (target === container) target.tabIndex = -1;
  target.focus();
}
function render() {
  renderGoals();
  renderBatchChoices();
  renderTags();
  renderShortcuts();
  comparisonChoices();
  analysisChoices();
  renderSettings();
  renderBudgets();
  renderFixed();
  renderPeriods();
  renderScheduleOverview();
  renderEndingSoon();
  if (incomePanel.open && incomeLoaded) renderIncome();
  renderIncomeRecords();
  renderRecurringIncome();
  list.replaceChildren();
  const entries = activeExpenses(state, taiwanToday()).slice().reverse();
  document.querySelector('#empty').hidden = entries.length !== 0;
  list.append(...entries.map(entry=>expenseRow(entry,state)));
}
function expenseRow(entry,snapshot=state,selectable=false) {
    const row = node('li', undefined, 'expense');
    row.dataset.expenseId = entry.id;
    for (const [label, value] of [['日期', entry.spent_on], ['項目', entry.note], ['金額', amountText(entry.cents) + ' 元'], ['分類', entry.category], ['付款方式', entry.payment_source_name]]) {
      const cell = node('div'); cell.append(node('small', label), node('span', value)); row.append(cell);
    }
    const buttons = node('div', undefined, 'buttons');
    if(selectable) {
      row.classList.add('expense-selectable');const label=node('label',undefined,'batch-choice'),input=node('input');input.type='checkbox';input.dataset.batchId=entry.id;
      input.setAttribute('aria-label','選取消費：'+entry.note+'（'+entry.spent_on+'）');input.checked=batchSelected.has(entry.id);input.disabled=busy||writeBlocked;
      input.onchange=()=>{if(busy||writeBlocked||!input.isConnected||!batchListActive()||row.parentElement.id!==batchListId())return;if(input.checked)batchSelected.set(entry.id,{id:entry.id,revision:entry.revision});else batchSelected.delete(entry.id);renderBatchSelection();};label.prepend(input);row.prepend(label);
    }
    const tagIds=new Set((snapshot.expense_tags || []).filter(item=>item.expense_id===entry.id).map(item=>item.tag_id));
    const labels=(snapshot.tags || []).filter(item=>tagIds.has(item.id)).map(item=>'#'+item.name+(item.hidden?'（不再顯示）':''));if(labels.length)row.append(node('p',labels.join(' · '),'expense-tag-labels'));
    const usage=state.usage_periods.find(item=>item.expense_id===entry.id);
    if(usage) row.append(node('p',usage.active===1 ? '使用期間：'+usage.started_on+'～'+usageEnd(usage)+'（可使用 '+usage.days+' 天）'
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
    if(!selectable)buttons.append(edit);
    if(entry.source==='manual' && ![...(state.annual_periods || []),...(state.scheduled_periods || [])].some(item=>item.expense_id===entry.id)) {
      const shortcut=node('button','建立捷徑');shortcut.type='button';shortcut.dataset.operation='shortcut';
      shortcut.onclick=()=>shortcutRead(snapshot=>startShortcut(snapshot,shortcutDraft(snapshot,entry.id,entry.revision,taiwanToday()),null,{id:entry.id,revision:entry.revision}));
      buttons.append(shortcut);
    }
    buttons.append(remove);
    row.append(buttons); return row;
}
function appendBatch(rows, listElement, more, shown,snapshot=state) {
  listElement.append(...rows.slice(shown, shown + 50).map(entry=>expenseRow(entry,snapshot,['search-results','search-selection-results'].includes(listElement.id))));
  more.hidden = shown + 50 >= rows.length;
  return Math.min(shown + 50, rows.length);
}
const searchForm = document.querySelector('#search-form');
const batchForm=document.querySelector('#batch-form'),batchDialog=document.querySelector('#batch-dialog'),batchEditor=document.querySelector('#batch-editor'),batchInput=document.querySelector('#batch-tag-input');
const batchSelected=new Map();let batchTags=[],batchRemove=[],batchConfirmation=null;
const batchRows=()=>searchSelection?selectionRows:searchRows;
const batchListId=()=>searchSelection?'search-selection-results':'search-results';
const batchListName=()=>searchSelection?(searchSelection.kind==='category'?'分類：':'標籤：')+searchSelection.name:'帳目';
const batchListActive=()=>!document.querySelector('#view-search').hidden&&(searchSelection?!document.querySelector('#search-selection').hidden:!document.querySelector('#search-groups').hidden&&document.querySelector('#search-accounts').open);
function renderBatchSelection() {
  const controls=document.querySelector('#batch-controls'),activeList=document.getElementById(batchListId());if(controls.nextElementSibling!==activeList)activeList.before(controls);
  document.querySelector('#batch-controls').hidden=!batchListActive();document.querySelector('#batch-title').textContent='目前清單：'+batchListName();
  document.querySelector('#batch-count').textContent='已選取 '+batchSelected.size+' 筆；更換條件或清單會清除選取。';
  for(const input of document.querySelectorAll('#search-results [data-batch-id],#search-selection-results [data-batch-id]')){input.checked=batchSelected.has(input.dataset.batchId);input.disabled=busy||writeBlocked;}
  document.querySelector('#batch-select-all').textContent='全選「'+batchListName()+'」全部符合帳目';
  document.querySelector('#batch-select-all').disabled=busy||writeBlocked||!batchRows().length;
  document.querySelector('#batch-clear').disabled=busy||writeBlocked||!batchSelected.size;
  document.querySelector('#batch-edit').disabled=busy||writeBlocked||batchSelected.size!==1;
  document.querySelector('#batch-open').disabled=busy||writeBlocked||batchSelected.size<2;
  document.querySelector('#batch-fields').disabled=busy||writeBlocked;
}
function clearBatchSelection(){batchSelected.clear();if(!busy){if(batchDialog.open)batchDialog.close();if(batchEditor.open)batchEditor.close();}renderBatchSelection();}
document.querySelector('#search-accounts').ontoggle=()=>{if(!document.querySelector('#search-accounts').open&&!searchSelection)clearBatchSelection();renderBatchSelection();};
document.querySelector('#batch-edit').onclick=()=>{
  if(busy||writeBlocked||batchSelected.size!==1||!batchListActive())return;
  const target=[...batchSelected.values()][0],entry=batchRows().find(row=>row.id===target.id);if(entry)beginExpenseEdit({...entry,revision:target.revision},{listId:batchListId(),id:entry.id},searchSnapshot);
};
document.querySelector('#batch-open').onclick=()=>{if(busy||writeBlocked||batchSelected.size<2||!batchListActive())return;renderBatchChoices();document.querySelector('#batch-editor-title').textContent='批次更改 '+batchSelected.size+' 筆消費';document.querySelector('#batch-error').textContent='';batchEditor.showModal();};
document.querySelector('#batch-editor-cancel').onclick=()=>{if(!busy)batchEditor.close();};batchEditor.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
function renderBatchChoices() {
  for(const [key,rows,label]of [['category',categoryOptions(state).filter(row=>row.active===1).map(row=>({value:row.name,name:row.name})),'分類不更改'],['payment_source_id',state.payment_sources.filter(row=>row.active===1).map(row=>({value:row.id,name:row.name})),'付款方式不更改（保留各筆快照）']]) {
    const select=batchForm.elements[key],value=select.value,options=[node('option',label)];options[0].value='';
    for(const row of rows){const option=node('option',row.name);option.value=row.value;options.push(option);}
    if(value&&!rows.some(row=>row.value===value)){const option=node('option','已失效，請另選：'+value);option.value=value;options.push(option);}select.replaceChildren(...options);select.value=value;
  }
  renderBatchTags();renderBatchSelection();
}
function renderBatchTags() {
  batchTags=batchTags.map(item=>{const row=item.id===null&&state.tags.find(row=>row.name===item.name);return row?{id:row.id,name:row.name}:item;});
  document.querySelector('#batch-tag-suggestions').replaceChildren(...tagSuggestions(state,batchInput.value).map(row=>{const option=node('option');option.value='#'+row.name;return option;}));
  document.querySelector('#batch-tag-selected').replaceChildren(...batchTags.map(item=>{const button=node('button','#'+item.name+' ×');button.type='button';button.setAttribute('aria-label','取消批次新增標籤：'+item.name);button.onclick=()=>{if(!busy){batchTags=batchTags.filter(row=>row!==item);renderBatchTags();batchInput.focus();}};return button;}));
  document.querySelector('#batch-tag-options').replaceChildren(...tagSuggestions(state).map(row=>{const label=node('label','#'+row.name,'batch-choice'),input=node('input');input.type='checkbox';input.value=row.id;input.checked=batchTags.some(item=>item.id===row.id);input.onchange=()=>{if(busy)return;batchTags=batchTags.filter(item=>item.id!==row.id);if(input.checked)batchTags.push({id:row.id,name:row.name});renderBatchTags();document.querySelector('#batch-tag-options input[value="'+row.id+'"]').focus();};label.prepend(input);return label;}));
  document.querySelector('#batch-remove-options').replaceChildren(...state.tags.map(row=>{const label=node('label','#'+row.name+(row.hidden?'（不再顯示）':''),'batch-choice'),input=node('input');input.type='checkbox';input.value=row.id;input.checked=batchRemove.includes(row.id);input.onchange=()=>{if(busy)return;batchRemove=batchRemove.filter(id=>id!==row.id);if(input.checked)batchRemove.push(row.id);};label.prepend(input);return label;}));
}
function addBatchTag(){if(!batchInput.value.trim())return;const name=tagName(batchInput.value),row=state.tags.find(row=>row.name===name);if(!batchTags.some(item=>item.name===name))batchTags.push({id:row?.id??null,name});batchInput.value='';renderBatchTags();}
document.querySelector('#batch-tag-add').onclick=()=>{if(busy||writeBlocked)return;try{addBatchTag();document.querySelector('#batch-error').textContent='';}catch(failure){document.querySelector('#batch-error').textContent=failure instanceof ValidationError?failure.message:'請輸入有效標籤。';}};
batchInput.oninput=()=>renderBatchTags();batchInput.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();document.querySelector('#batch-tag-add').click();}};
document.querySelector('#batch-select-all').onclick=()=>{if(busy||writeBlocked||!batchListActive())return;for(const row of batchRows())if(!batchSelected.has(row.id))batchSelected.set(row.id,{id:row.id,revision:row.revision});renderBatchSelection();};
document.querySelector('#batch-clear').onclick=()=>{if(!busy&&!writeBlocked)clearBatchSelection();};
batchForm.onsubmit=event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  const message=document.querySelector('#batch-error');message.textContent='';
  try {
    if(batchSelected.size<2||!lastQuery||!batchEditor.open)throw new ValidationError('請選取至少兩筆消費後開啟批次更改。');addBatchTag();
    const changes={},labels=[];
    for(const [key,label]of [['category','分類'],['payment_source_id','付款方式']])if(batchForm.elements[key].value){changes[key]=batchForm.elements[key].value;labels.push(label+' → '+batchForm.elements[key].selectedOptions[0].textContent);}
    if(batchTags.length){changes.tags={ids:batchTags.filter(row=>row.id!==null).map(row=>row.id),names:batchTags.filter(row=>row.id===null).map(row=>row.name)};labels.push('新增標籤：'+batchTags.map(row=>'#'+row.name).join('、')+'（保留原標籤）');}
    if(batchRemove.length){if(batchTags.some(row=>batchRemove.includes(row.id)))throw new ValidationError('同一標籤不能同時新增與移除。');changes.remove_tag_ids=[...batchRemove];labels.push('移除標籤：'+batchRemove.map(id=>'#'+(state.tags.find(row=>row.id===id)?.name||'已失效的標籤')).join('、')+'（只解除選中帳目關聯）');}
    if(!labels.length)throw new ValidationError('請至少選擇一項批次更改。');
    batchConfirmation={targets:structuredClone([...batchSelected.values()]),changes};
    document.querySelector('#batch-summary').textContent='將套用至 '+batchSelected.size+' 筆消費；來源清單：'+batchListName()+'。關鍵字「'+lastQuery.keyword+'」；日期 '+(lastQuery.start||'全部時間')+' ～ '+(lastQuery.end||taiwanToday())+'。已具備的新增標籤或沒有的移除標籤會略過。';
    document.querySelector('#batch-changes').replaceChildren(...labels.map(label=>node('li',label)));document.querySelector('#batch-confirm-error').textContent='';batchDialog.showModal();
  }catch(failure){message.textContent=failure instanceof ValidationError?failure.message:'無法準備批次更改，請重新搜尋。';}
};
document.querySelector('#batch-cancel').onclick=()=>{if(!busy)batchDialog.close();};batchDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});batchDialog.addEventListener('close',()=>{if(!batchDialog.open)batchConfirmation=null;});
document.querySelector('#batch-confirm').onclick=async()=>{
  if(busy||writeBlocked||!batchConfirmation)return;const confirmed=structuredClone(batchConfirmation),message=document.querySelector('#batch-confirm-error');
  let changedCount=null;
  await saving(()=>editExpenseBatch(db,confirmed.targets,confirmed.changes),()=>{changedCount=confirmed.targets.filter(target=>integerValue(state.expenses.find(row=>row.id===target.id).revision)!==integerValue(target.revision)).length;batchDialog.close();batchEditor.close();batchSelected.clear();batchTags=[];batchRemove=[];batchInput.value='';batchForm.reset();document.querySelector('#batch-edit').focus();},message);
  if(changedCount!==null&&!writeBlocked)status.textContent='已更改 '+changedCount+' 筆消費；其餘已有設定，未重複更改。';
  if(message.textContent&&!writeBlocked)message.textContent+=' 選取與欄位已保留，請重新載入後再選取確認。';
};
const homeSearch=document.querySelector('#home-search-keyword');
function openSearch(trigger) {
  if(busy)return;
  searchReturn={view:trigger.closest('[data-view]').dataset.view,trigger};
  if(searchReturn.view==='record')searchForm.elements.keyword.value=homeSearch.value;
  document.querySelector('#site-search-back').textContent='返回'+document.querySelector('#view-'+searchReturn.view+'-title').textContent;
  showView('search',false);searchForm.elements.keyword.focus();
  runSearch(true);
}
for(const button of document.querySelectorAll('[data-search-open]'))button.onclick=()=>openSearch(button);
homeSearch.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();document.querySelector('#view-record [data-search-open]').click();}};
document.querySelector('#site-search-back').onclick=()=>{
  const origin=searchReturn || {view:'record',trigger:document.querySelector('#view-record [data-search-open]')};
  showView(origin.view,false);origin.trigger.focus();
};
function searchFunctions() {
  return [...document.querySelectorAll('[data-search-feature]')].filter(target=>!target.closest('[data-home-block]')?.hidden&&(target.id!=='budget-title'||!document.querySelector('#budget-overview').hidden)).map(target=>({name:target.textContent.trim(),target:target.id || target.parentElement.id}));
}
function jumpSearchFunction(id) {
  const target=document.getElementById(id),panel=target.closest('[data-view]');
  showView(panel.dataset.view,false);
  for(let details=target.closest('details');details;details=details.parentElement.closest('details'))details.open=true;
  const focus=target.tagName==='DETAILS'?target.querySelector('summary'):target;
  if(!focus.matches('summary,button,input,select,a'))focus.tabIndex=-1;
  focus.focus();
}
function showSearchNames(kind,rows,label,action) {
  const list=document.querySelector('#search-'+kind);list.replaceChildren();
  document.querySelector('#search-'+kind+'-heading').textContent=label+'（'+rows.length+'）';
  if(!rows.length)list.append(node('li','沒有符合的'+label+'。'));
  for(const row of rows) {
    const item=node('li'),button=node('button',row.name+(row.historical?'（歷史分類）':row.active===0?'（停用）':row.hidden===1?'（不再顯示，仍含歷史）':''));button.type='button';
    button.onclick=()=>{if(list.contains(button)&&!document.querySelector('#search-groups').hidden&&!document.querySelector('#view-search').hidden)action(row,button);};item.append(button);list.append(item);
  }
}
function showSearchSelection(snapshot,query,today,choice,focus=true,trigger=null) {
  if(!searchSelection||searchSelection.kind!==choice.kind||searchSelection.key!==choice.key)clearBatchSelection();searchSnapshot=snapshot;
  searchSelection=choice;selectionTrigger=trigger || selectionTrigger;
  document.querySelector('#search-groups').hidden=true;document.querySelector('#search-selection').hidden=false;
  document.querySelector('#search-selection-title').textContent=(choice.kind==='category'?'分類：':'標籤：')+choice.name;
  try {
    const report=choice.kind==='category'?categoryReport(snapshot,{category:choice.key,start:query.start,end:query.end},today)
      :tagReport(snapshot,{tag_id:choice.key,start:query.start,end:query.end},today);
    selectionRows=report.rows;
    document.querySelector('#search-selection-summary').textContent=amountText(report.total)+' 元，'+report.rows.length+' 筆；'+(query.start || '全部時間')+' ～ '+(query.end || today);
  } catch {
    selectionRows=[];document.querySelector('#search-selection-summary').textContent='分類或標籤已變更，請重新搜尋。';
  }
  document.querySelector('#search-selection-empty').hidden=selectionRows.length!==0;
  document.querySelector('#search-selection-results').replaceChildren();
  selectionShown=appendBatch(selectionRows,document.querySelector('#search-selection-results'),document.querySelector('#search-selection-more'),0,snapshot);
  if(focus)document.querySelector('#search-selection-title').focus();
  renderBatchSelection();
}
document.querySelector('#search-selection-back').onclick=()=>{
  clearBatchSelection();
  searchSelection=null;document.querySelector('#search-selection').hidden=true;document.querySelector('#search-groups').hidden=false;
  (selectionTrigger?.isConnected?selectionTrigger:searchForm.elements.keyword).focus();
  renderBatchSelection();
};
document.querySelector('#search-selection-more').onclick=()=>{
  selectionShown=appendBatch(selectionRows,document.querySelector('#search-selection-results'),document.querySelector('#search-selection-more'),selectionShown,searchSnapshot);
};
function showSearch(snapshot, query, today) {
  searchSnapshot=snapshot;
  const groups=query.keyword.trim()?siteSearch(snapshot,query,today,searchFunctions()):browseSite(snapshot,query,today,searchFunctions());
  searchRows = groups.expenses;
  searchShown = 0;
  homeSearch.value=query.keyword;
  document.querySelector('#search-groups').hidden=false;document.querySelector('#search-selection').hidden=true;
  document.querySelector('#search-expenses-heading').textContent='帳目（'+searchRows.length+'）';
  document.querySelector('#site-search-counts').textContent='帳目 '+searchRows.length+' · 功能 '+groups.functions.length+' · 分類 '+groups.categories.length+' · 標籤 '+groups.tags.length;
  showSearchNames('functions',groups.functions,'功能',row=>jumpSearchFunction(row.target));
  showSearchNames('categories',groups.categories,'分類',(row,button)=>showSearchSelection(snapshot,query,today,{kind:'category',key:row.name,name:row.name+(row.historical?'（歷史分類）':row.active===0?'（停用）':'')},true,button));
  showSearchNames('tags',groups.tags,'標籤',(row,button)=>showSearchSelection(snapshot,query,today,{kind:'tag',key:row.id,name:row.name+(row.hidden===1?'（不再顯示，仍含歷史）':'')},true,button));
  document.querySelector('#search-results').replaceChildren();
  document.querySelector('#search-count').textContent = searchRows.length
    ? `符合 ${searchRows.length} 筆消費。` : '沒有符合條件的消費。';
  searchShown = appendBatch(searchRows, document.querySelector('#search-results'), document.querySelector('#search-more'), searchShown,searchSnapshot);
  renderBatchSelection();
  if(searchSelection)showSearchSelection(snapshot,query,today,searchSelection,false);
}
async function runSearch(automatic=false) {
  const request=++searchRequest;
  if(busy||!state)return;
  clearBatchSelection();
  const query = Object.fromEntries(new FormData(searchForm));
  const today = taiwanToday();
  const message = document.querySelector('#search-error');
  message.textContent = '';
  try {
    if (!searchForm.elements.start.validity.valid || !searchForm.elements.end.validity.valid) {
      throw new ValidationError('請輸入有效日期。');
    }
    (query.keyword.trim()?validateSearch:validateBrowse)(query,today); // Invalid dates never open a database read.
    document.querySelector('#search-groups').hidden=true;document.querySelector('#search-selection').hidden=true;
    renderBatchSelection();
    document.querySelector('#search-progress').textContent='正在搜尋……';
    const snapshot = await readLedger(db);
    if(request!==searchRequest)return;
    document.querySelector('#search-progress').textContent='';
    lastQuery = query;
    showSearch(snapshot, query, today);
    showCalendar(snapshot, today);
  } catch (failure) {
    if(request!==searchRequest)return;
    lastQuery = null;
    clearSearchOutput();
    message.textContent = failure instanceof ValidationError ? failure.message : '無法搜尋，請重新載入後再試。';
  }
}
function clearSearchOutput() {
  clearBatchSelection();
  searchSelection=null;searchRows=[];selectionRows=[];
  document.querySelector('#search-groups').hidden=true;document.querySelector('#search-selection').hidden=true;
  for(const id of ['search-results','search-functions','search-categories','search-tags','search-selection-results'])document.getElementById(id).replaceChildren();
  for(const id of ['search-count','site-search-counts','search-progress'])document.getElementById(id).textContent='';
  document.querySelector('#search-more').hidden=true;
  renderBatchSelection();
}
searchForm.addEventListener('submit',event=>{event.preventDefault();searchSelection=null;runSearch();});
searchForm.addEventListener('input',event=>{clearBatchSelection();if(!event.isComposing){searchSelection=null;homeSearch.value=searchForm.elements.keyword.value;runSearch(true);}});
searchForm.elements.keyword.addEventListener('compositionend',()=>{searchSelection=null;homeSearch.value=searchForm.elements.keyword.value;runSearch(true);});
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
  const request=searchRequest;
  const today = taiwanToday();
  const month = nextMonth(viewedMonth, offset);
  if (month > today.slice(0, 7) || month < '0001-01') return;
  try {
    const snapshot = await readLedger(db);
    viewedMonth = month;
    showCalendar(snapshot, today);
    if (lastQuery && request===searchRequest) showSearch(snapshot, lastQuery, today);
    document.querySelector('#calendar-error').textContent = '';
  } catch { document.querySelector('#calendar-error').textContent = '無法讀取月曆，請重新載入後再試。'; }
}
document.querySelector('#calendar-prev').onclick = () => moveMonth(-1);
document.querySelector('#calendar-next').onclick = () => moveMonth(1);
async function saving(operation, success, message = error) {
  if (busy || writeBlocked) return;
    ++searchRequest;
    ++incomeViewRequest;
    ++tagQueryRequest;
    ++comparisonRequest;
    ++analysisRequest;
    ++analysisChartRequest;
  let committed = false;
  const budgetControl = document.activeElement.closest('#budget-fields') ? document.activeElement : null;
  const fixedControl = document.activeElement.closest('#fixed-fields') ? document.activeElement : null;
  const budgetRow = budgetControl?.closest('#budget-setting-list > li');
  busy = true; fields.disabled = true; error.textContent = '';
  document.querySelector('#invoice-fields').disabled=true;document.querySelector('#invoice-confirm').disabled=true;document.querySelector('#invoice-cancel').disabled=true;
  document.querySelector('#goal-fields').disabled=true;
  renderBatchSelection();document.querySelector('#batch-confirm').disabled=true;document.querySelector('#batch-cancel').disabled=true;
  document.querySelector('#shortcut-fields').disabled=true;
  document.querySelector('#tag-fields').disabled=true;
  incomeBusy(true);
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
    const origin = success(); clearBatchSelection(); render();
    if(comparisonQuery){clearComparison();await showComparison(compareExpenses(state,comparisonQuery,taiwanToday()));}
    if(analysisQuery)await showAnalysis(analyzeExpenses(state,analysisQuery,taiwanToday()));
    if (lastQuery) showSearch(state, lastQuery, taiwanToday());
    if (viewedMonth) showCalendar(state, taiwanToday());
    returnToExpense(origin);
    status.textContent = '瀏覽器本機測試帳本；儲存完成。';
  } catch (failure) {
    writeBlocked = committed;
    if (committed) for (const modal of [dialog, settingsDialog, fixedStopDialog, incomeVoidDialog, annualDialog,tagDialog,batchDialog,batchEditor,invoiceDialog]) if (modal.open) modal.close();
    message.textContent = committed ? '資料已儲存，但畫面更新未完成。請重新載入確認，勿重複提交。'
      : failure instanceof LedgerError || failure instanceof ValidationError ? failure.message : '儲存未完成，請確認瀏覽器儲存空間後重試。';
    if (dialog.open) document.querySelector('#delete-error').textContent = error.textContent;
    status.textContent = committed ? message.textContent : '瀏覽器本機測試帳本；此次儲存未完成。';
  } finally {
    busy = false; fields.disabled = writeBlocked;
    document.querySelector('#invoice-fields').disabled=writeBlocked;document.querySelector('#invoice-confirm').disabled=writeBlocked;document.querySelector('#invoice-cancel').disabled=writeBlocked;invoiceSelection();
    document.querySelector('#analysis-submit').disabled=false;
    document.querySelector('#goal-fields').disabled=writeBlocked;
    for(const button of document.querySelectorAll('#goal-list button'))button.disabled=writeBlocked;
    renderBatchSelection();document.querySelector('#batch-confirm').disabled=writeBlocked;document.querySelector('#batch-cancel').disabled=false;
    document.querySelector('#shortcut-fields').disabled=writeBlocked;
    document.querySelector('#tag-fields').disabled=writeBlocked;
    incomeBusy(writeBlocked);
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
  document.querySelector('#fixed-fields').disabled=disabled;
  for(const button of document.querySelectorAll('#fixed-list button,#schedule-periods button,#schedule-more,#confirm-fixed-stop,#cancel-fixed-stop'))button.disabled=disabled;
}
function fixedChoices() {
  for(const [field,rows] of [['category',categoryOptions(state).filter(row=>row.active===1||row.name===fixedEditing?.category).map(row=>({value:row.name,name:row.name+(row.active?'':'（停用，保留原值）')}))],
    ['payment_source_id',state.payment_sources.filter(row=>row.active===1||row.id===fixedEditing?.payment_source_id).map(row=>({value:row.id,name:row.name+(row.active?'':'（停用，保留原值）')}))]]) {
    const select=fixedForm.elements[field],value=select.value;
    if(field==='payment_source_id'&&fixedEditing?.payment_source_id===null)rows.unshift({value:'',name:'保留未指定付款方式'});
    select.replaceChildren(...rows.map(row=>{const option=node('option',row.name);option.value=row.value;return option;}));
    if(rows.some(row=>row.value===value))select.value=value;
  }
}
function resetFixed() {
  fixedEditing=null;fixedDraftId=null;fixedForm.reset();fixedForm.elements.first_due_on.value=taiwanToday();fixedChoices();recurringFields();
  document.querySelector('#cancel-fixed-edit').hidden=true;
}
const recurringLabel=kind=>kind==='固定'?'固定支出':kind;
const unitLabel={day:'日',week:'週',month:'月',year:'年'};
let fixedDraftId=null;
fixedForm.elements.first_due_on.value=taiwanToday();
function recurringFields() {
  const installment=fixedForm.elements.kind.value==='分期';
  fixedForm.elements.kind.disabled=fixedEditing!==null;fixedForm.elements.periods.disabled=!installment||fixedEditing!==null;
  document.querySelector('#installment-fields').hidden=!installment;
  fixedForm.elements.periods.required=installment&&!fixedEditing;fixedForm.elements.payment_source_id.required=!fixedEditing;
  if(!fixedEditing)for(const id of ['fixed-form-title','save-fixed'])document.querySelector('#'+id).textContent='新增'+recurringLabel(fixedForm.elements.kind.value);
}
fixedForm.elements.kind.onchange=recurringFields;
function fixedText(row) {
  return row.name+'｜'+amountText(row.cents)+' 元｜'+row.category+'｜'+row.payment_source_name+'｜每隔 '+row.every+' '+unitLabel[row.unit]+'｜安排首期 '+row.first_due_on;
}
function renderFixed() {
  fixedChoices();recurringFields();const rows=scheduleRules(state,taiwanToday()),listElement=document.querySelector('#fixed-list');
  document.querySelector('#fixed-empty').hidden=rows.length!==0;listElement.replaceChildren();
  for(const rule of rows.slice().reverse()) {
    const row=node('li');row.dataset.id=rule.id;
    row.append(node('h3',recurringLabel(rule.kind)+'：'+rule.name+(rule.complete?'（已完成）':rule.active===0?'（已停用）':'')),node('p','目前未來安排：'+fixedText(rule)),node('p',rule.next_due_on?'下一期預定 '+rule.next_due_on:'沒有未來新期數'));
    if(rule.kind==='分期')row.append(node('p','總期數：'+rule.periods+' 期（建立後保留）'));
    if(rule.active===1&&!rule.complete) {
      const buttons=node('div',undefined,'buttons');
      if(rule.edit_due_on) {
        const edit=node('button','更改'+recurringLabel(rule.kind));edit.type='button';edit.dataset.operation='update';
        edit.onclick=()=>{
          if(busy||writeBlocked)return;fixedEditing=structuredClone(rule);fixedDraftId=null;fixedChoices();
          for(const key of ['kind','name','category','unit','every'])fixedForm.elements[key].value=rule[key];
          fixedForm.elements.payment_source_id.value=rule.payment_source_id??'';fixedForm.elements.first_due_on.value=rule.edit_due_on;
          fixedForm.elements.periods.value=String(rule.periods);fixedForm.elements.amount.value=amountText(rule.cents,false);recurringFields();
          document.querySelector('#fixed-form-title').textContent='更改'+recurringLabel(rule.kind)+'（下一尚未到期且未保存期數生效）';document.querySelector('#save-fixed').textContent='儲存更改';document.querySelector('#cancel-fixed-edit').hidden=false;
          document.querySelector('#fixed-error').textContent='';fixedForm.elements.name.focus();
        };buttons.append(edit);
      }
      const stop=node('button','停用'+recurringLabel(rule.kind));stop.type='button';stop.dataset.operation='stop';
      stop.onclick=()=>{
        if(busy||writeBlocked)return;fixedStopping=structuredClone(rule);
        for(const id of ['fixed-stop-title','confirm-fixed-stop'])document.querySelector('#'+id).textContent='確認停用'+recurringLabel(rule.kind);
        document.querySelector('#fixed-stop-summary').textContent=recurringLabel(rule.kind)+'｜'+fixedText(rule);document.querySelector('#fixed-stop-error').textContent='';fixedStopDialog.showModal();
      };buttons.append(stop);
      if(rule.kind!=='年度費用') {
        const excluded=state.allocation_preferences.some(item=>item.recurring_id===rule.id),suggestion=node(excluded?'p':'button',excluded?'已排除往後分配建議':'往後不顯示分配建議');
        if(!excluded){suggestion.type='button';suggestion.onclick=()=>{if(busy||writeBlocked||!confirm('往後不顯示此項目的分配建議；定期安排仍保留。'))return;saving(()=>excludeSuggestion(db,taiwanToday().slice(0,7),rule.id,'future',null),()=>{},document.querySelector('#fixed-error'));};buttons.append(suggestion);}else row.append(suggestion);
      }
      row.append(buttons);
    }listElement.append(row);
  }
}
fixedForm.addEventListener('submit',event=>{
  event.preventDefault();if(busy||writeBlocked)return;
  const input=Object.fromEntries(new FormData(fixedForm));input.every=/^[0-9]+$/.test(input.every)?Number(input.every):NaN;
  input.kind=fixedEditing?.kind??input.kind;input.periods=fixedEditing?fixedEditing.periods:input.kind==='分期'&&/^[0-9]{1,3}$/.test(input.periods)?Number(input.periods):input.kind==='分期'?NaN:0;
  fixedDraftId??='r_'+crypto.randomUUID();
  saving(()=>updateSchedule(db,fixedEditing?'update':'add',fixedEditing?.id??fixedDraftId,fixedEditing?.revision??null,input),()=>{resetFixed();fixedForm.elements.name.focus();},document.querySelector('#fixed-error'));
});
document.querySelector('#cancel-fixed-edit').onclick=()=>{if(!busy&&!writeBlocked){resetFixed();document.querySelector('#fixed-error').textContent='';fixedForm.elements.name.focus();}};
document.querySelector('#confirm-fixed-stop').onclick=()=>{if(busy||writeBlocked||!fixedStopping)return;saving(()=>updateSchedule(db,'disable',fixedStopping.id,fixedStopping.revision,null),()=>{if(fixedEditing?.id===fixedStopping.id)resetFixed();fixedStopDialog.close();document.querySelector('#fixed-settings summary').focus();},document.querySelector('#fixed-stop-error'));};
document.querySelector('#cancel-fixed-stop').onclick=()=>{if(!busy)fixedStopDialog.close();};
fixedStopDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
fixedStopDialog.addEventListener('close',()=>{if(!fixedStopDialog.open)fixedStopping=null;});
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
  document.querySelector('#budget-overview').hidden=!overview.total&&overview.categories.length===0;
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
      const input = node('input'); input.name = 'amount'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off';input.required=true;
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
    if(analysisQuery)analysisQuery.categories=analysisQuery.categories.map(category=>category===change.key?name:category);
    for(const input of document.querySelectorAll('#analysis-categories input'))if(input.value===change.key)input.value=name;
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
  saving(() => annualDraft ? processSchedule(db,'record',annualDraft.rule_id,annualDraft.index,annualDraft.rule_revision,annualDraft.revision,input)
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
  const labels={expenses:'消費',categories:'分類',payment_sources:'付款方式',budgets:'預算',recurring_rules:'定期規則',recurring_versions:'歷史版本',shortcuts:'捷徑',actions:'消費操作紀錄',settings:'設定',incomes:'收入',income_actions:'收入操作紀錄',monthly_allocations:'月份分配',allocation_preferences:'往後建議排除',annual_rules:'年度費用',annual_periods:'年度期數',scheduled_periods:'定期支出期數',usage_periods:'使用期間',tags:'標籤',expense_tags:'消費標籤關聯',goals:'目標',goal_actions:'目標調整紀錄',income_rules:'定期收入規則',income_periods:'定期收入期數',invoice_imports:'發票匯入關聯'};
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
  exportRequired();
}
function exportRequired() {
  const encrypted=exportMode.value==='encrypted';
  document.querySelector('#export-password').required=encrypted;document.querySelector('#export-confirm-password').required=encrypted;document.querySelector('#export-risk').required=!encrypted;
}
exportRequired();
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
  exportRequired();
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
