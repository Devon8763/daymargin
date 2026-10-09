import * as distribution from './vendor/lossless-json-4.3.1/lossless-json.js';
import { validateInput, expenseOptions, categoryOptions, categoryName, paymentName, orderedShortcuts, tagName, budgetCents, money, pythonStrip, cents, isoDate, fixedNextMonth, fixedDueDate, fixedSettings, validateFixed, recurringProgress, ValidationError } from './rules.mjs';
import { emptyData, readBackup, writeBackup, integerValue, storedInteger, MAX_INTEGER, MAX_BYTES } from './backup.mjs';
import { STORES, openLedgerDatabase, readSnapshot, scanTransaction, addState, portable, metadata, rowKey } from './idb.mjs';
import {annualInput,annualItem,annualDefaults} from './annual.mjs';
import {incomeInput, allocationInput, allocationMonth, defaultAllocation, goalInput} from './income.mjs';
import {usageInput} from './usage.mjs';
import {scheduleDue,scheduleModels,schedulePeriod,scheduleNext,scheduleDuePeriods} from './schedule.mjs';

export const DB_NAME = 'discordbot-localfirst-synthetic-v1';
const { stringify } = distribution.default ?? globalThis.LosslessJSON;
const encoder = new TextEncoder();
export class LedgerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const openDatabase = (name = DB_NAME) => openLedgerDatabase(name);
export const readLedger = db => readSnapshot(db);
export const readLedgerIfPresent = db => readSnapshot(db, true);
export function taiwanToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
const identifier = prefix => prefix + crypto.randomUUID();
const length = row => encoder.encode(stringify(row)).byteLength;
const storageFailure = () => new LedgerError('storage', '儲存未完成，資料沒有變更。請確認儲存空間後重試。');

function transaction(db, operation) {
  return new Promise((resolve, reject) => {
    let failure, result;
    let tx;
    try { tx = db.transaction(STORES, 'readwrite'); } catch { reject(storageFailure()); return; }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || storageFailure());
    scanTransaction(tx, (state, meta) => { result = operation(tx, state, meta); }, error => {
      failure = error instanceof LedgerError || error instanceof ValidationError ? error : storageFailure();
    });
  });
}

export function initializeLedger(db) {
  return transaction(db, (tx, state) => {
    if (state !== null) return state;
    const initial = { format:'local-first-test-ledger', version:8, owner:'local-test-owner', ...emptyData(7),
      payment_sources:[{ id:'p_cash', name:'現金', active:1 }, { id:'p_unspecified', name:'未指定', active:1 }] };
    addState(tx, initial);
    return initial;
  });
}

export function restorePortableBackup(db, payload, confirmedMain = false) {
  if (db.name !== DB_NAME + '-portable-checks' && !(db.name === DB_NAME && confirmedMain === true)) {
    throw new LedgerError('storage', '還原僅適用獨立的互通測試帳本或已確認的主驗證頁。');
  }
  const parsed = readBackup(payload);
  return transaction(db, (tx, state) => {
    if (state !== null) throw new LedgerError('nonempty', '目標測試帳本已有資料或建立標記，無法還原。');
    const restored = { format:'local-first-test-ledger', version:8, owner:'local-test-owner', ...emptyData(7), ...parsed.data };
    addState(tx, restored);
    return restored;
  });
}
export const exportPortableBackup = async db => writeBackup(portable(await readSnapshot(db)));

function current(state, id, expectedRevision, changing = true, position = state.expenses.findIndex(row => row.id === id)) {
  const entry = state.expenses[position];
  if (!entry || entry.id!==id || entry.kind!=='consumption' || !['manual','固定','訂閱','分期'].includes(entry.source) || entry.voided!==0)
    throw new LedgerError('unavailable', '此筆消費無法操作，請重新載入。');
  let expected;
  try { expected = integerValue(expectedRevision); }
  catch { throw new LedgerError('conflict', '資料已變更，請重新載入後再操作。'); }
  if (integerValue(entry.revision) !== expected) throw new LedgerError('conflict', '資料已變更，請重新載入後再操作。');
  if (changing && expected === MAX_INTEGER) throw new LedgerError('limit', '版本已達 signed 64-bit 上限，請停止操作。');
  return { entry, position };
}

function applyUsage(state,id,input) {
  if (input === undefined) return;
  const previous=(state.usage_periods || []).find(row=>row.expense_id===id);
  if (input === null && !previous) return;
  const fields=input === null ? {...previous,active:0} : usageInput(input);
  const row={expense_id:id,...Object.fromEntries(['started_on','days','remind','reminder_days','show_daily_cost','active'].map(key=>[key,fields[key]])),revision:previous?.revision ?? 0};
  state.usage_periods ??= [];
  if (previous) {
    if (stringify(previous) === stringify(row)) return;
    incrementRevision(row);state.usage_periods[state.usage_periods.indexOf(previous)]=row;
  } else state.usage_periods.push(row);
}
function applyTags(state,id,input,append=false,remove=[]) {
  if(input===undefined&&!remove.length)return false;
  if(input===undefined)input={ids:[],names:[]};
  if(!input || Object.keys(input).length!==2 || !Array.isArray(input.ids) || !Array.isArray(input.names) ||
      input.ids.length+input.names.length>100000 || new Set(input.ids).size!==input.ids.length)
    throw new ValidationError('請選擇有效且不重複的標籤。');
  state.tags ??= [];state.expense_tags ??= [];
  const byId=new Map(state.tags.map(row=>[row.id,row])),byName=new Map(state.tags.map(row=>[row.name,row]));
  const selected=input.ids.map(id=>{if(typeof id!=='string' || !byId.has(id))throw new ValidationError('標籤已移除，請重新載入後再選取。');return id;});
  const names=input.names.map(tagName),created=new Set();
  if(new Set(names).size!==names.length)throw new ValidationError('請勿重複加入相同標籤。');
  for(const name of names) {
    let row=byName.get(name);
    if(!row){row={id:identifier('t_'),name,hidden:0,revision:0};state.tags.push(row);byName.set(name,row);byId.set(row.id,row);created.add(row.id);}
    selected.push(row.id);
  }
  if(new Set(selected).size!==selected.length)throw new ValidationError('請勿重複加入相同標籤。');
  const removed=new Set(remove),previous=new Set(state.expense_tags.filter(row=>row.expense_id===id).map(row=>row.tag_id)),wanted=new Set((append?[...previous,...selected]:selected).filter(tag=>!removed.has(tag)));
  for(const tag of new Set([...previous,...wanted]))if(previous.has(tag)!==wanted.has(tag) && !created.has(tag))incrementRevision(byId.get(tag));
  state.expense_tags=state.expense_tags.filter(row=>row.expense_id!==id || wanted.has(row.tag_id));
  for(const tag of wanted)if(!previous.has(tag))state.expense_tags.push({expense_id:id,tag_id:tag});
  return previous.size!==wanted.size||[...previous].some(tag=>!wanted.has(tag));
}
export function assignExpenseTags(state,id,input) {
  metadata(state);const changed={...emptyData(5),...structuredClone(state)};
  if(!changed.expenses.some(row=>row.id===id))throw new ValidationError('找不到此筆消費。');
  applyTags(changed,id,input);metadata(changed);return changed;
}
export function changeTag(state,operation,id,expected,name) {
  metadata(state);const changed={...emptyData(5),...structuredClone(state)},row=changed.tags.find(item=>item.id===id);
  if(operation==='add') {
    if(expected!==null || row)throw new LedgerError('conflict','此操作已處理，請重新載入。');
    const normalized=tagName(name);
    if(changed.tags.some(item=>item.name===normalized))throw new ValidationError('已有同名標籤，請使用既有項目。');
    changed.tags.push({id,name:normalized,hidden:0,revision:0});
  } else {
    if(!row)throw new LedgerError('unavailable','標籤已移除，請重新載入。');financeRevision(row,expected);
    if(operation==='remove') {
      const affected=new Set(changed.expense_tags.filter(item=>item.tag_id===id).map(item=>item.expense_id));
      for(const entry of changed.expenses)if(affected.has(entry.id))incrementRevision(entry);
      changed.expense_tags=changed.expense_tags.filter(item=>item.tag_id!==id);changed.tags=changed.tags.filter(item=>item.id!==id);
    } else if(operation==='hide' || operation==='show') {
      const hidden=operation==='hide'?1:0;if(row.hidden===hidden)throw new ValidationError('此標籤已是目前顯示狀態。');
      incrementRevision(row);row.hidden=hidden;
    } else throw new ValidationError('請選擇有效標籤操作。');
  }
  metadata(changed);return changed;
}
export const updateTag=(db,operation,id,expected,name)=>financeWrite(db,state=>changeTag(state,operation,id,expected,name));
function save(tx, state, meta, entry, before, position, usage, tags) {
  const action = { id:identifier('a_'), expense_id:entry.id, before:before ?? null, undone:0 };
  const expenseAdded = before === undefined;
  if (usage !== undefined || tags!==undefined) {
    const changed={...emptyData(5),...structuredClone(state)};
    if (expenseAdded) changed.expenses.push(entry); else changed.expenses[position]=entry;
    changed.actions.push(action);applyUsage(changed,entry.id,usage);applyTags(changed,entry.id,tags);
    saveSettings(tx,state,changed); // Validate all references and capacity before any request; resolve only at transaction complete.
    Object.assign(state,changed);return;
  }
  const delta = length(entry) - (expenseAdded ? 0 : length(before)) +
    (expenseAdded && state.expenses.length ? 1 : 0) + length(action) + (state.actions.length ? 1 : 0);
  if (meta.row_count + 1 + Number(expenseAdded) > 100000 || meta.backup_bytes + delta > MAX_BYTES) {
    throw new LedgerError('limit', '本機帳本已達完整備份容量上限，資料沒有變更。');
  }
  tx.objectStore('expenses').put({ key:entry.id, position, value:entry });
  tx.objectStore('actions').add({ key:action.id, position:meta.next_action_order, value:action });
  tx.objectStore('meta').put({ key:'next_action_order', value:meta.next_action_order + 1 });
  tx.objectStore('meta').put({ key:'row_count', value:meta.row_count + 1 + Number(expenseAdded) });
  tx.objectStore('meta').put({ key:'backup_bytes', value:meta.backup_bytes + delta });
  if (expenseAdded) state.expenses.push(entry);
  else state.expenses[position] = entry;
  state.actions.push(action);
}

function write(db, change) {
  return transaction(db, (tx, state, meta) => {
    if (state === null) throw new LedgerError('uninitialized', '測試帳本尚未建立。');
    change(tx, state, meta);
    return state;
  });
}
export function addExpense(db, form, today, id = identifier('e_')) {
  return write(db, (tx, state, meta) => {
    if(typeof id!=='string'|| !/^[a-z][a-z0-9_-]{0,63}$/.test(id))throw new ValidationError('此操作識別不符合規則。');
    if (STORES.some(section=>Array.isArray(state[section])&&state[section].some(row=>row.id===id))) throw new LedgerError('conflict','此操作已處理，請重新載入後確認。');
    const entry = { id, ...validateInput(form, state, today), source:'manual', recurring_id:null,
      period:null, voided:0, kind:'consumption', revision:0 };
    save(tx, state, meta, entry, undefined, state.expenses.length, form.usage,form.tags);
  });
}
export function editExpense(db, id, expectedRevision, form, today) {
  return write(db, (tx, state, meta) => {
    const {entry, position} = current(state, id, expectedRevision);
    const updated = { ...entry, ...validateInput(form, state, today, entry),
      revision:storedInteger(integerValue(entry.revision) + 1n) };
    save(tx, state, meta, updated, structuredClone(entry), position, form.usage,form.tags);
  });
}
export function voidExpense(db, id, expectedRevision) {
  return write(db, (tx, state, meta) => {
    const {entry, position} = current(state, id, expectedRevision);
    save(tx, state, meta, { ...entry, voided:1, revision:storedInteger(integerValue(entry.revision) + 1n) },
      structuredClone(entry), position);
  });
}

export function changeExpenseBatch(state,targets,changes,today) {
  metadata(state);isoDate(today);
  if(!Array.isArray(targets)||!targets.length||targets.length>100000||targets.some(row=>!row||Object.keys(row).length!==2||!Object.hasOwn(row,'id')||typeof row.id!=='string'||!Object.hasOwn(row,'revision'))||new Set(targets.map(row=>row.id)).size!==targets.length)
    throw new ValidationError('請選取有效且不重複的消費。');
  if(!changes||Array.isArray(changes)||Object.keys(changes).some(key=>!['category','payment_source_id','tags','remove_tag_ids'].includes(key))||
      (!Object.hasOwn(changes,'category')&&!Object.hasOwn(changes,'payment_source_id')&&!(changes.tags?.ids?.length||changes.tags?.names?.length||changes.remove_tag_ids?.length)))
    throw new ValidationError('請至少選擇一項批次更改。');
  const remove=Object.hasOwn(changes,'remove_tag_ids')?changes.remove_tag_ids:[],tags=new Map(state.tags.map(row=>[row.id,row]));
  if(!Array.isArray(remove)||remove.length>100000||new Set(remove).size!==remove.length||remove.some(id=>typeof id!=='string'||!tags.has(id)))throw new ValidationError('請選擇有效且不重複的待移除標籤。');
  if(remove.some(id=>(Array.isArray(changes.tags?.ids)&&changes.tags.ids.includes(id))||(Array.isArray(changes.tags?.names)&&changes.tags.names.some(name=>tagName(name)===tags.get(id).name))))throw new ValidationError('同一標籤不能同時新增與移除。');
  if(Object.hasOwn(changes,'category')&&!categoryOptions(state).some(row=>row.name===changes.category&&row.active===1))throw new ValidationError('請選擇有效分類。');
  if(Object.hasOwn(changes,'payment_source_id')&&!state.payment_sources.some(row=>row.id===changes.payment_source_id&&row.active===1))throw new ValidationError('請選擇有效付款方式。');
  const changed=structuredClone(state),positions=new Map(changed.expenses.map((row,index)=>[row.id,index]));
  for(const target of targets) {
    const {entry,position}=current(changed,target.id,target.revision,false,positions.get(target.id)??-1);
    if(entry.spent_on>today)throw new LedgerError('unavailable','此筆消費無法操作，請重新載入。');
    const updated={...entry,...expenseOptions({category:changes.category??entry.category,payment_source_id:changes.payment_source_id??''},changed,entry)};
    const tagChanged=applyTags(changed,entry.id,changes.tags,true,remove);
    if(!tagChanged&&['category','payment_source_id','payment_source_name'].every(key=>updated[key]===entry[key]))continue;
    incrementRevision(updated);changed.expenses[position]=updated;
    changed.actions.push({id:identifier('a_'),expense_id:entry.id,before:structuredClone(entry),undone:0});
  }
  metadata(changed);return changed;
}
export const editExpenseBatch=(db,targets,changes)=>financeWrite(db,state=>changeExpenseBatch(state,targets,changes,taiwanToday()));

function incrementRevision(row) {
  const revision = integerValue(row.revision);
  if (revision === MAX_INTEGER) throw new LedgerError('limit', '版本已達 signed 64-bit 上限，請停止操作。');
  row.revision = storedInteger(revision + 1n);
}

function financeRevision(row, expected) {
  if ((!row && expected !== null) || (row && (expected === null || integerValue(row.revision) !== integerValue(expected)))) {
    throw new LedgerError('conflict', '資料已變更，請重新載入後再操作。');
  }
}
export function changeIncome(state, operation, id, expected, form, today) {
  metadata(state);
  const changed = structuredClone(state), previous = changed.incomes.find(row => row.id === id);
  let row;
  if (operation === 'add') {
    if (previous || expected !== null) throw new LedgerError('conflict', '此操作已處理，請重新載入後確認。');
    row = {id, ...incomeInput(form,today), voided:0, revision:0};
    changed.incomes.push(row);
  } else {
    if (!previous || previous.voided !== 0) throw new LedgerError('unavailable','此筆收入無法操作，請重新載入。');
    financeRevision(previous,expected);
    row = {...previous}; incrementRevision(row);
    if (operation === 'update') Object.assign(row,incomeInput(form,today));
    else if (operation === 'void') row.voided = 1;
    else throw new ValidationError('請選擇有效的收入操作。');
    changed.incomes[changed.incomes.indexOf(previous)] = row;
  }
  changed.income_actions.push({id:identifier('ia_'),income_id:id,before:previous || null,undone:0});
  metadata(changed);
  return changed;
}
export function changeGoal(state,operation,id,expected,form) {
  metadata(state);const changed={...emptyData(7),...structuredClone(state)},previous=changed.goals.find(row=>row.id===id);
  if(!['add','update'].includes(operation))throw new ValidationError('請選擇有效的目標操作。');
  if(operation==='add'&&previous||operation==='update'&&!previous)throw new LedgerError('conflict','目標已變更，請重新載入後再操作。');
  financeRevision(previous,expected);const row={id,...goalInput(form,previous),revision:previous?.revision??0};
  if(previous){incrementRevision(row);changed.goals[changed.goals.indexOf(previous)]=row;}else changed.goals.push(row);
  if(!previous||row.saved_cents!==previous.saved_cents)changed.goal_actions.push({id:identifier('ga_'),goal_id:id,kind:'manual',month:null,
    before_cents:previous?.saved_cents??'0',after_cents:row.saved_cents,delta_cents:(cents(row.saved_cents)-cents(previous?.saved_cents??'0')).toString(),contribution_before_cents:null,contribution_after_cents:null});
  metadata(changed);return changed;
}
export function changeAllocation(state, month, expected, items, goalExpected={}) {
  metadata(state); allocationMonth(month);
  const changed = structuredClone(state), previous = changed.monthly_allocations.find(row => row.month === month);
  financeRevision(previous,expected);
  const row = {month,items:allocationInput(items),excluded_recurring_ids:previous?.excluded_recurring_ids || [],revision:previous?.revision ?? 0};
  const contributions=values=>{const result=new Map();for(const item of values)if(Object.hasOwn(item,'goal_id'))result.set(item.goal_id,(result.get(item.goal_id)??0n)+cents(item.cents));return result;};
  const before=contributions(previous?.items??[]),after=contributions(row.items);
  for(const id of new Set([...before.keys(),...after.keys()])) {
    const goal=changed.goals?.find(item=>item.id===id),old=before.get(id)??0n,value=after.get(id)??0n,delta=value-old;
    if(typeof id!=='string'||!goal)throw new ValidationError('請選擇有效目標。');
    financeRevision(goal,goalExpected?.[id]??null);
    if(goal.completed===1&&(!before.has(id)||delta>0n))throw new ValidationError('已完成目標不可新增分配；請先更改目標狀態。');
    if(!delta)continue;
    const total=cents(goal.saved_cents)+delta;
    if(total<0n)throw new ValidationError('已存總額將低於 0，請先校正目標已存總額；分配沒有變更。');
    if(total>MAX_INTEGER||value>MAX_INTEGER)throw new ValidationError('目標金額超出容量上限。');
    changed.goal_actions.push({id:identifier('ga_'),goal_id:id,kind:'allocation',month,before_cents:goal.saved_cents,after_cents:total.toString(),delta_cents:delta.toString(),contribution_before_cents:old.toString(),contribution_after_cents:value.toString()});
    goal.saved_cents=total.toString();incrementRevision(goal);
  }
  if (previous) { incrementRevision(row); changed.monthly_allocations[changed.monthly_allocations.indexOf(previous)] = row; }
  else changed.monthly_allocations.push(row);
  metadata(changed); return changed;
}
export function changeSuggestion(state, month, id, scope, expected, today = month + '-01') {
  metadata(state); allocationMonth(month);
  const changed = structuredClone(state);
  if (!changed.recurring_rules.some(row => row.id === id)) throw new ValidationError('找不到定期支出，請重新載入。');
  if (scope === 'future') {
    const previous = changed.allocation_preferences.find(row => row.recurring_id === id);
    financeRevision(previous,expected);
    if (previous) throw new ValidationError('此項目已排除往後建議。');
    changed.allocation_preferences.push({recurring_id:id,excluded_from_month:allocationMonth(isoDate(today).slice(0,7)),revision:0});
  } else if (scope === 'month') {
    let row = changed.monthly_allocations.find(row => row.month === month);
    financeRevision(row,expected);
    if (row?.excluded_recurring_ids.includes(id)) throw new ValidationError('本月份已排除此建議。');
    if (!row) { row = {month,items:defaultAllocation(),excluded_recurring_ids:[],revision:0}; changed.monthly_allocations.push(row); }
    else incrementRevision(row);
    row.excluded_recurring_ids.push(id);
  } else throw new ValidationError('請選擇有效的建議排除操作。');
  metadata(changed); return changed;
}
const financeWrite = (db, change) => transaction(db,(tx,state) => {
  if (!state) throw new LedgerError('uninitialized','測試帳本尚未建立。');
  const changed = change(state); saveSettings(tx,state,changed); return changed;
});
export const updateIncome = (db,operation,id,expected,form) => financeWrite(db,state => changeIncome(state,operation,id,expected,form,taiwanToday()));
export const updateGoal = (db,operation,id,expected,form) => financeWrite(db,state=>changeGoal(state,operation,id,expected,form));
export const updateAllocation = (db,month,expected,items,goals={}) => financeWrite(db,state => changeAllocation(state,month,expected,items,goals));
export const excludeSuggestion = (db,month,id,scope,expected) => financeWrite(db,state => changeSuggestion(state,month,id,scope,expected,taiwanToday()));

export function shortcutDraft(state,id,expectedRevision,today) {
  metadata(state);
  const {entry}=current(state,id,expectedRevision,false);
  if (entry.source!=='manual' || entry.spent_on>isoDate(today) ||
      [...(state.annual_periods || []),...(state.scheduled_periods || [])].some(row=>row.expense_id===id))
    throw new LedgerError('unavailable','只有有效的手動生活消費可建立捷徑；年度費用不適用。');
  const value=cents(entry.cents),fraction=(value%100n).toString().padStart(2,'0').replace(/0+$/,'');
  return {name:[...entry.note].slice(0,30).join(''),note:entry.note,category:entry.category,
    payment_source_id:entry.payment_source_id ?? '',amount:(value/100n).toString()+(fraction ? '.'+fraction : '')};
}
export function changeShortcut(state,expected,operation,id,form,source=null,today=taiwanToday()) {
  metadata(state);
  if (stringify(state.shortcuts)!==stringify(expected)) throw new LedgerError('conflict','捷徑已變更，請重新載入後再操作。');
  const changed=structuredClone(state),row=changed.shortcuts.find(item=>item.id===id);
  if (operation!=='add' && (!row || row.active!==1)) throw new LedgerError('unavailable','此捷徑無法操作，請重新載入。');
  if (source!==null) {
    if(operation!=='add')throw new ValidationError('請選擇有效的捷徑操作。');
    shortcutDraft(state,source.id,source.revision,today); // Recheck source in the same write transaction; no saved source link.
  }
  if (operation==='add' || operation==='update') {
    const keys=['name','note','category','payment_source_id','amount'];
    if(!form || Object.keys(form).length!==keys.length || keys.some(key=>!Object.hasOwn(form,key)) || typeof form.amount!=='string')
      throw new ValidationError('捷徑欄位不符合規則。');
    let name;
    try {name=paymentName(form.name);} catch {throw new ValidationError('捷徑名稱需 1～30 字，不可包含換行或控制字元。');}
    const optional=form.amount.trim()==='';
    const validated=validateInput({...form,spent_on:today,amount:optional?'1':form.amount},changed,today);
    const fields={name,note:validated.note,category:validated.category,payment_source_id:validated.payment_source_id,cents:optional?null:validated.cents};
    if(operation==='add') {
      if (STORES.some(section=>Array.isArray(changed[section])&&changed[section].some(item=>item.id===id)))
        throw new LedgerError('conflict','此操作已處理，請重新載入後確認。');
      const active=orderedShortcuts(changed);active.forEach((item,index)=>{item.position=index;});
      changed.shortcuts.push({id,...fields,position:active.length,active:1});
    } else Object.assign(row,fields);
  } else if(operation==='disable')row.active=0;
  else if(operation==='up' || operation==='down') {
    const active=orderedShortcuts(changed),index=active.findIndex(item=>item.id===id),target=index+(operation==='up'?-1:1);
    if(target>=0 && target<active.length) {
      [active[index],active[target]]=[active[target],active[index]];
      active.forEach((item,position)=>{item.position=position;}); // Also resolves equal legacy positions without losing manual order.
    }
  } else throw new ValidationError('請選擇有效的捷徑操作。');
  metadata(changed);return changed;
}
export const updateShortcut=(db,expected,operation,id,form=null,source=null)=>financeWrite(db,state=>changeShortcut(state,expected,operation,id,form,source,taiwanToday()));

export function changeAnnual(state,operation,id,expected,form,today) {
  const meta = metadata(state), changed = {...emptyData(3),...structuredClone(state)};
  isoDate(today);
  const rule = changed.annual_rules.find(row => row.id === id);
  if (operation === 'add') {
    if (rule || expected !== null) throw new LedgerError('conflict','此操作已處理，請重新載入後確認。');
    const fields = annualInput(form,changed,today);
    changed.annual_rules.push({id,...fields,effective_month:String(fields.first_year).padStart(4,'0')+'-'+String(fields.due_month).padStart(2,'0'),active:1,revision:0});
  } else {
    if (!rule || rule.active !== 1) throw new LedgerError('unavailable','此年度費用無法操作，請重新載入。');
    financeRevision(rule,expected);
    if (!['update','disable'].includes(operation)) throw new ValidationError('請選擇有效的年度費用操作。');
    // Capture defaults only on an explicit write, before changing future settings.
    let count = meta.row_count;
    const saved = new Set(changed.annual_periods.filter(row => row.annual_id === id).map(row => row.year));
    for (let year = Math.max(rule.first_year,Number(rule.effective_month.slice(0,4))); year <= Number(today.slice(0,4)); year++) {
      const defaults = annualDefaults(rule,year),month = defaults.due_on.slice(0,7);
      if (saved.has(year) || month < rule.effective_month || month > today.slice(0,7)) continue;
      if (++count > 100000) throw new LedgerError('limit','本機帳本已達完整備份容量上限，資料沒有變更。');
      changed.annual_periods.push({annual_id:id,year,defaults,status:'pending',expense_id:null,revision:0});
    }
    incrementRevision(rule);
    if (operation === 'disable') rule.active = 0;
    else Object.assign(rule,annualInput(form,changed,today,rule),{effective_month:fixedNextMonth(today.slice(0,7))});
  }
  metadata(changed); return changed;
}
export function changeAnnualPeriod(state,operation,id,year,expectedRule,expectedPeriod,form,today) {
  metadata(state);
  const changed = {...emptyData(3),...structuredClone(state)},rule = changed.annual_rules.find(row => row.id === id);
  if (!rule) throw new LedgerError('unavailable','此年度期數無法操作，請重新載入。');
  financeRevision(rule,expectedRule);
  const item = annualItem(changed,id,year,today);
  if (!item || item.status !== 'pending') throw new LedgerError('unavailable','此年度期數已處理或尚未到期，請重新載入。');
  const previous = changed.annual_periods.find(row => row.annual_id === id && row.year === year);
  financeRevision(previous,expectedPeriod);
  const row = previous || {annual_id:id,year,defaults:annualDefaults(rule,year),status:'pending',expense_id:null,revision:0};
  if (previous) incrementRevision(row);
  else changed.annual_periods.push(row);
  if (operation === 'record') {
    const entry = {id:identifier('e_'),...validateInput(form,changed,today),source:'manual',recurring_id:null,
      period:null,voided:0,kind:'consumption',revision:0};
    changed.expenses.push(entry);
    applyUsage(changed,entry.id,form.usage);
    applyTags(changed,entry.id,form.tags);
    changed.actions.push({id:identifier('a_'),expense_id:entry.id,before:null,undone:0});
    row.status = 'recorded'; row.expense_id = entry.id;
  } else if (operation === 'skip') row.status = 'skipped';
  else throw new ValidationError('請選擇有效的年度期數操作。');
  metadata(changed); return changed;
}
const legacyScheduleOnly=state=>{if(state.version>=7)throw new LedgerError('unavailable','請使用統一定期支出，逐期確認記錄。');};
export const updateAnnual = (db,op,id,expected,form) => financeWrite(db,state => {legacyScheduleOnly(state);return changeAnnual(state,op,id,expected,form,taiwanToday());});
export const processAnnual = (db,op,id,year,expectedRule,expectedPeriod,form) => financeWrite(db,state => {legacyScheduleOnly(state);return changeAnnualPeriod(state,op,id,year,expectedRule,expectedPeriod,form,taiwanToday());});

function scheduleInput(form,state,today,model=null) {
  const keys=['kind','name','amount','category','payment_source_id','first_due_on','unit','every','periods'];
  if(!form||Object.keys(form).length!==keys.length||keys.some(key=>!Object.hasOwn(form,key)))throw new ValidationError('定期支出欄位不符合規則。');
  if(!['固定','訂閱','分期','年度費用'].includes(form.kind))throw new ValidationError('請選擇有效的支出類型。');
  if(model&&(form.kind!==model.kind||integerValue(form.periods)!==model.total))throw new ValidationError('建立後不能更改支出類型或分期總期數。');
  if(!model&&(!Number.isInteger(form.periods)||(form.kind==='分期'?form.periods<1||form.periods>600:form.periods!==0)))throw new ValidationError('分期總期數須為 1～600。');
  if(typeof form.name!=='string'||!pythonStrip(form.name)||[...form.name].length>100)throw new ValidationError('消費項目需填寫，且最多 100 字。');
  const first_due_on=isoDate(form.first_due_on);
  if(model&&first_due_on<=today)throw new ValidationError('更改後的首期日期必須晚於台灣今天。');
  const next=model?scheduleNext(model,today):null,remaining=model?.total?model.total-BigInt(next?.index??0):BigInt(form.periods);
  scheduleDue(first_due_on,form.unit,form.every,(model?model.total===0n||remaining>1n:form.kind!=='分期'||form.periods>1)?1:0);
  const previous=model?next?.defaults??model.known.values().next().value?.defaults??model.root:null;
  if(!categoryOptions(state).some(row=>row.active===1&&row.name===form.category)&&form.category!==previous?.category)throw new ValidationError('請選擇有效分類；更改時可保留原停用分類。');
  let payment;
  if(model&&form.payment_source_id==='')payment={id:previous?.payment_source_id??null,name:previous?.payment_source_name??'未指定'};
  else {
    payment=state.payment_sources.find(row=>row.id===form.payment_source_id);
    if(!payment||(payment.active!==1&&payment.id!==previous?.payment_source_id))throw new ValidationError('請選擇有效付款方式。');
    if(payment.id===previous?.payment_source_id)payment={id:payment.id,name:previous.payment_source_name};
  }
  return {first_due_on,unit:form.unit,every:form.every,name:form.name,cents:money(form.amount),category:form.category,payment_source_id:payment.id,payment_source_name:payment.name};
}
function persistSchedulePeriod(state,item,count) {
  count.rows??=new Map(state.scheduled_periods.map(row=>[row.rule_id+'\0'+row.index,row]));
  const key=item.rule_id+'\0'+item.index;let row=count.rows.get(key);
  if(row)return row;
  if(++count.value>100000)throw new LedgerError('limit','本機帳本已達完整備份容量上限，資料沒有變更。');
  row={rule_id:item.rule_id,index:item.index,defaults:structuredClone(item.defaults),status:item.status==='upcoming'?'pending':item.status,expense_id:item.expense_id,revision:item.revision??0};state.scheduled_periods.push(row);count.rows.set(key,row);return row;
}
function captureSchedule(state,model,count,freezeDue=false) {
  for(const item of model.known.values())persistSchedulePeriod(state,item,count);
  if(freezeDue)for(const item of scheduleDuePeriods(model,count.today))persistSchedulePeriod(state,item,count);
}
export function changeSchedule(state,operation,id,expected,form,today) {
  const meta=metadata(state),changed={...emptyData(6),...structuredClone(state)};isoDate(today);
  const model=scheduleModels(changed).find(row=>row.root.id===id);
  if(operation==='add') {
    if(model||expected!==null)throw new LedgerError('conflict','此操作已處理，請重新載入。');
    const fields=scheduleInput(form,changed,today),month=fields.first_due_on.slice(0,7);
    if(form.kind==='年度費用')changed.annual_rules.push({id,name:fields.name,cents:fields.cents,category:fields.category,payment_source_id:fields.payment_source_id,payment_source_name:fields.payment_source_name,first_year:Number(fields.first_due_on.slice(0,4)),due_month:Number(fields.first_due_on.slice(5,7)),due_day:Number(fields.first_due_on.slice(8)),effective_month:month,active:1,revision:0});
    else changed.recurring_rules.push({id,name:fields.name,cents:fields.cents,category:fields.category,kind:form.kind,start_month:month,periods:form.periods,due_day:Number(fields.first_due_on.slice(8)),active:1,revision:0});
    changed.recurring_versions.push({id:identifier('v_'),recurring_id:id,from_index:0,...fields});
  } else {
    if(!model||model.root.active!==1)throw new LedgerError('unavailable','此定期支出無法操作，請重新載入。');
    financeRevision(model.root,expected);
    if(!['update','disable'].includes(operation))throw new ValidationError('請選擇有效定期支出操作。');
    const next=scheduleNext(model,today);
    if(operation==='update'&&!next)throw new LedgerError('unavailable','沒有可更改的未來期數。');
    const fields=operation==='update'?scheduleInput(form,changed,today,model):null;
    captureSchedule(changed,model,{value:meta.row_count,today},true);incrementRevision(model.root);
    if(operation==='disable')model.root.active=0;
    else {
      const version=changed.recurring_versions.find(row=>row.recurring_id===id&&row.from_index===next.index);
      if(version)Object.assign(version,fields);else changed.recurring_versions.push({id:identifier('v_'),recurring_id:id,from_index:next.index,...fields});
    }
  }
  metadata(changed);return changed;
}
const amountInput=value=>{const exact=cents(value);return (exact/100n).toString()+'.'+(exact%100n).toString().padStart(2,'0');};
export function changeScheduledPeriod(state,operation,id,index,expectedRule,expectedPeriod,form,today) {
  const meta=metadata(state),changed={...emptyData(6),...structuredClone(state)};isoDate(today);
  const model=scheduleModels(changed).find(row=>row.root.id===id);
  if(!model)throw new LedgerError('unavailable','找不到此定期支出。');financeRevision(model.root,expectedRule);
  const item=schedulePeriod(model,index,today);
  if(!item||item.defaults.due_on>today||item.status==='recorded'||(operation==='resume'?item.status!=='skipped':item.status!=='pending'))throw new LedgerError('unavailable','此期已處理或尚未到期，請重新載入。');
  financeRevision(item.revision===null?null:item,expectedPeriod);
  const count={value:meta.row_count,today};captureSchedule(changed,model,count);
  const row=persistSchedulePeriod(changed,item,count);if(item.revision!==null)incrementRevision(row);
  if(operation==='record') {
    const defaultPayment=item.defaults.payment_source_id??changed.payment_sources.find(row=>row.active===1&&row.name==='未指定')?.id;
    const input=form??{spent_on:item.defaults.due_on,amount:amountInput(item.defaults.cents),note:item.defaults.name,category:item.defaults.category,payment_source_id:defaultPayment};
    const entry={id:identifier('e_'),...validateInput(input,changed,today),source:model.annual?'manual':model.root.kind,recurring_id:model.annual?null:id,period:model.annual?null:item.defaults.due_on.slice(0,7),voided:0,kind:'consumption',revision:0};
    changed.expenses.push(entry);applyUsage(changed,entry.id,input.usage);applyTags(changed,entry.id,input.tags);changed.actions.push({id:identifier('a_'),expense_id:entry.id,before:null,undone:0});row.status='recorded';row.expense_id=entry.id;
  }else if(operation==='skip')row.status='skipped';else if(operation==='resume')row.status='pending';else throw new ValidationError('請選擇有效期數操作。');
  metadata(changed);return changed;
}
export const updateSchedule=(db,op,id=null,expected=null,form=null)=>financeWrite(db,state=>changeSchedule(state,op,id,expected,form,taiwanToday()));
export const processSchedule=(db,op,id,index,expectedRule,expectedPeriod,form=null)=>financeWrite(db,state=>changeScheduledPeriod(state,op,id,index,expectedRule,expectedPeriod,form,taiwanToday()));

export function changeCategory(state, operation, oldName, value) {
  metadata(state); // Reject corrupt or over-limit history before preparing any changes.
  const changed = structuredClone(state);
  const options = categoryOptions(state);
  if (operation === 'add') {
    const name = categoryName(value);
    if (options.some(row => row.name === name)) throw new ValidationError('已有同名分類（含停用項目），請使用其他名稱。');
    changed.categories.push({ name, active:1 });
  } else {
    if (!options.some(row => row.name === oldName && row.active === 1)) throw new ValidationError('找不到啟用中的分類，請重新載入。');
    const position = changed.categories.findIndex(row => row.name === oldName);
    if (operation === 'disable') {
      if (position < 0) changed.categories.push({ name:oldName, active:0 });
      else changed.categories[position].active = 0;
    } else if (operation === 'rename') {
      const name = categoryName(value);
      const references = ['expenses', 'budgets', 'recurring_rules', 'recurring_versions', 'shortcuts', 'annual_rules'];
      if (options.some(row => row.name === name) || references.some(section => (state[section] || []).some(row => row.category === name)) ||
          (state.annual_periods || []).some(row => row.defaults.category === name) ||
          (state.scheduled_periods || []).some(row => row.defaults.category === name) ||
          state.actions.some(row => row.before?.category === name)) {
        throw new ValidationError('已有同名分類或歷史，不能合併分類。');
      }
      // Missing overrides identify builtin defaults; explicit builtin overrides still use the same rule.
      if (categoryOptions({categories:[]}).some(row => row.name === oldName)) {
        if (position < 0) changed.categories.push({ name:oldName, active:0 });
        else changed.categories[position].active = 0;
        changed.categories.push({ name, active:1 });
      } else changed.categories[position].name = name;
      const versionRules = new Set(state.recurring_versions.filter(row => row.category === oldName).map(row => row.recurring_id));
      for (const row of changed.recurring_rules) {
        if (row.category === oldName || versionRules.has(row.id)) incrementRevision(row);
      }
      for(const row of changed.annual_rules||[])if(row.category!==oldName&&versionRules.has(row.id))incrementRevision(row);
      for (const section of references) for (const row of changed[section] || []) {
        if (row.category !== oldName) continue;
        row.category = name;
        if (section === 'expenses' || section === 'annual_rules') incrementRevision(row);
      }
      for (const row of changed.annual_periods || []) if (row.defaults.category === oldName) {
        row.defaults.category = name; incrementRevision(row);
      }
      for(const row of changed.scheduled_periods||[])if(row.defaults.category===oldName){row.defaults.category=name;incrementRevision(row);}
      for (const row of changed.actions) if (row.before?.category === oldName) row.before.category = name;
    } else throw new ValidationError('請選擇有效的分類操作。');
  }
  metadata(changed); // Includes complete backup validation, byte and row limits.
  return changed;
}

function saveSettings(tx, state, changed) {
  const meta = metadata(changed);
  for(const section of ['tags','expense_tags']) {
    const keys=new Set((changed[section] || []).map(row=>stringify(rowKey(section,row))));
    for(const row of state[section] || [])if(!keys.has(stringify(rowKey(section,row))))tx.objectStore(section).delete(rowKey(section,row));
  }
  for (const section of STORES.filter(section => !['meta', 'settings'].includes(section))) {
    (changed[section] || []).forEach((row, position) => {
      const previous = state[section]?.[position];
      if (previous && stringify(previous) === stringify(row)) return;
      const store = tx.objectStore(section);
      if (previous && !['tags','expense_tags'].includes(section) && stringify(rowKey(section, previous)) !== stringify(rowKey(section, row))) store.delete(rowKey(section, previous));
      store.put({ key:rowKey(section, row), position, value:row });
    });
  }
  for (const key of ['row_count', 'backup_bytes', 'next_action_order']) tx.objectStore('meta').put({ key, value:meta[key] });
}

export function updateCategory(db, expectedCategories, operation, oldName, value) {
  return transaction(db, (tx, state) => {
    if (state === null) throw new LedgerError('uninitialized', '測試帳本尚未建立。');
    if (stringify(state.categories) !== stringify(expectedCategories)) throw new LedgerError('conflict', '設定已變更，請重新載入後再操作。');
    const changed = changeCategory(state, operation, oldName, value);
    saveSettings(tx, state, changed);
    return changed;
  });
}

export function changePayment(state, operation, id, value) {
  metadata(state);
  const changed = structuredClone(state);
  const row = changed.payment_sources.find(item => item.id === id);
  if (operation !== 'add') {
    if (!row || (operation === 'disable' && row.active !== 1)) throw new ValidationError('找不到付款方式，請重新載入。');
    if (['現金', '未指定'].includes(row.name)) throw new ValidationError('「現金」與「未指定」不能更改或停用。');
  }
  if (operation === 'add' || operation === 'rename') {
    const name = paymentName(value);
    if (changed.payment_sources.some(item => item.name === name && (operation === 'add' || item.id !== id))) {
      throw new ValidationError('已有同名付款方式（含停用項目），請使用其他名稱。');
    }
    if (operation === 'add') changed.payment_sources.push({ id:identifier('p_'), name, active:1 });
    else row.name = name;
  } else if (operation === 'disable') row.active = 0;
  else throw new ValidationError('請選擇有效的付款方式操作。');
  metadata(changed);
  return changed;
}

export function updatePayment(db, expectedPayments, operation, id, value) {
  return transaction(db, (tx, state) => {
    if (state === null) throw new LedgerError('uninitialized', '測試帳本尚未建立。');
    if (stringify(state.payment_sources) !== stringify(expectedPayments)) throw new LedgerError('conflict', '設定已變更，請重新載入後再操作。');
    const changed = changePayment(state, operation, id, value);
    saveSettings(tx, state, changed);
    return changed;
  });
}

export function changeBudget(state, operation, category, value, today) {
  metadata(state);
  const month = isoDate(today).slice(0, 7);
  const changed = structuredClone(state);
  const position = changed.budgets.findIndex(row => row.month === month && row.category === category);
  const previous = changed.budgets[position];
  if (operation === 'clear') {
    if (!previous) throw new ValidationError('找不到本月預算，請重新載入。');
    changed.budgets.splice(position, 1);
  } else {
    if (previous && cents(previous.cents) % 100n) throw new ValidationError('歷史小數預算只可清除；原值仍保留。');
    let amount;
    if (operation === 'sum' && category === '總額') {
      const rows = changed.budgets.filter(row => row.month === month && row.category !== '總額');
      const sum = rows.reduce((total, row) => total + cents(row.cents), 0n);
      if (!rows.length || sum <= 0n) throw new ValidationError('目前沒有正數分類預算可合計。');
      if (sum % 100n) throw new ValidationError('分類預算加總含歷史小數，請先清除小數預算。');
      amount = budgetCents((sum / 100n).toString());
    } else if (operation === 'set') {
      if (category !== '總額' && !categoryOptions(state).some(row => row.name === category && row.active === 1)) {
        throw new ValidationError('停用或不存在的分類不能設定預算，既有預算只可清除。');
      }
      amount = budgetCents(value);
    } else throw new ValidationError('請選擇有效的預算操作。');
    const row = {month, category, cents:amount};
    if (position < 0) changed.budgets.push(row);
    else changed.budgets[position] = row;
  }
  const rows = changed.budgets.filter(row => row.month === month);
  const total = rows.find(row => row.category === '總額');
  const sum = rows.filter(row => row.category !== '總額').reduce((sum, row) => sum + cents(row.cents), 0n);
  if (total && cents(total.cents) < sum) throw new ValidationError('分類預算合計不可超過總預算。');
  metadata(changed);
  return changed;
}

export function updateBudget(db, expectedBudgets, operation, category, value) {
  return transaction(db, (tx, state) => {
    if (state === null) throw new LedgerError('uninitialized', '測試帳本尚未建立。');
    // Read the Taiwan clock inside the write transaction; callers cannot choose a month.
    const today = taiwanToday(), month = today.slice(0, 7);
    const selected = rows => rows.find(row => row.month === month && row.category === category) || null;
    if (!Array.isArray(expectedBudgets) || stringify(selected(state.budgets)) !== stringify(selected(expectedBudgets))) {
      throw new LedgerError('conflict', '預算已變更，請重新載入後再操作。');
    }
    const changed = changeBudget(state, operation, category, value, today);
    const meta = metadata(changed), store = tx.objectStore('budgets');
    if (operation === 'clear') store.delete([month, category]);
    changed.budgets.forEach((row, position) => {
      if (stringify(state.budgets[position]) !== stringify(row)) store.put({key:rowKey('budgets', row), position, value:row});
    });
    for (const key of ['row_count', 'backup_bytes']) tx.objectStore('meta').put({key, value:meta[key]});
    return changed;
  });
}

export function changeRecurring(state, operation, id, expectedRevision, form, today, fixedOnly = false) {
  const meta = metadata(state);
  const month = isoDate(today).slice(0, 7), changed = structuredClone(state);
  const rule = changed.recurring_rules.find(row => row.id === id && (!fixedOnly || row.kind === '固定') && row.active === 1);
  if (operation !== 'add' && operation !== 'sync') {
    if (!rule || recurringProgress(changed, rule).complete) {
      throw new LedgerError('unavailable', '此定期規則無法操作，請重新載入。');
    }
    let expected;
    try { expected = integerValue(expectedRevision); } catch { /* Fixed conflict message below. */ }
    if (expected === undefined || expected < 0n || integerValue(rule.revision) !== expected) {
      throw new LedgerError('conflict', '定期規則已變更，請重新載入後再操作。');
    }
    incrementRevision(rule);
  }
  if (operation === 'add' || operation === 'update') {
    const kind = operation === 'add' ? form?.kind ?? '固定' : rule.kind;
    const periods = operation === 'add' ? (kind === '分期' ? form?.periods : form?.periods ?? 0) : rule.periods;
    if (!['固定', '訂閱', '分期'].includes(kind) || (fixedOnly && kind !== '固定') ||
        (operation === 'add' && (!Number.isInteger(periods) || (kind === '分期' ? periods < 1 || periods > 600 : periods !== 0))) ||
        (operation === 'update' && kind === '固定' && form?.periods !== undefined && form.periods !== 0)) {
      throw new ValidationError('請選擇有效的支出類型；分期總期數須為 1～600。');
    }
    const effective = operation === 'add' ? form?.start_month : fixedNextMonth(month);
    if (operation === 'add' && ![month, fixedNextMonth(month)].includes(effective)) {
      throw new ValidationError('開始月份只能選台灣本月或下月。');
    }
    if (operation === 'update' && form?.start_month !== undefined && form.start_month !== rule.start_month) {
      throw new ValidationError('建立後不能更改開始月份。');
    }
    const previous = operation === 'update' ? fixedSettings(changed, rule, effective) : null;
    const fields = validateFixed(form, changed, today, previous, operation === 'update' && kind !== '固定' ? rule : null);
    const key = operation === 'add' ? identifier('r_') : rule.id;
    if (operation === 'add') changed.recurring_rules.push({id:key, ...fields, kind, start_month:effective, periods, active:1, revision:0});
    if (kind === '固定' || operation === 'update') {
      const version = changed.recurring_versions.find(row => row.recurring_id === key && row.effective_month === effective);
      if (version) Object.assign(version, fields);
      else changed.recurring_versions.push({id:identifier('v_'), recurring_id:key, effective_month:effective, ...fields});
    }
  } else if (operation === 'sync' || operation === 'stop') {
    const posted = new Set(changed.expenses.filter(row => row.recurring_id !== null).map(row => row.recurring_id + ':' + row.period));
    const versions = new Map();
    for (const row of changed.recurring_versions) {
      if (!versions.has(row.recurring_id)) versions.set(row.recurring_id, []);
      versions.get(row.recurring_id).push(row);
    }
    let count = meta.row_count;
    const selected = operation === 'stop' ? [rule] : changed.recurring_rules.filter(row => (!fixedOnly || row.kind === '固定') && row.active === 1);
    for (const selectedRule of selected) {
      const history = (versions.get(selectedRule.id) || []).sort((a, b) => a.effective_month.localeCompare(b.effective_month));
      let settings = selectedRule, index = 0, installment = 1n;
      const total = integerValue(selectedRule.periods);
      for (let period = selectedRule.start_month; period <= month && (total === 0n || installment <= total); installment++) {
        while (index < history.length && history[index].effective_month <= period) settings = history[index++];
        const due = fixedDueDate(period, settings.due_day), key = selectedRule.id + ':' + period;
        if (due <= today && !posted.has(key)) {
          if (count + 2 > 100000) throw new LedgerError('limit', '本機帳本已達完整備份容量上限，資料沒有變更。');
          const note = settings.name + (selectedRule.kind === '分期' ? `（第 ${installment}/${total} 期）` : '');
          if ([...note].length > 4096) throw new LedgerError('limit', '分期項目加上期數後超過備份文字上限，資料沒有變更。請保留原備份。');
          const entry = {id:identifier('e_'), spent_on:due, cents:settings.cents, category:settings.category,
            note, source:selectedRule.kind, recurring_id:selectedRule.id, period, voided:0,
            payment_source_id:null, payment_source_name:'未指定', kind:'consumption', revision:0};
          changed.expenses.push(entry);
          changed.actions.push({id:identifier('a_'), expense_id:entry.id, before:null, undone:0});
          posted.add(key); count += 2;
        }
        if (period === month) break;
        period = fixedNextMonth(period);
      }
    }
    if (operation === 'stop') rule.active = 0;
  } else throw new ValidationError('請選擇有效的固定支出操作。');
  metadata(changed);
  return changed;
}

export function changeFixed(state, operation, id, expectedRevision, form, today) {
  return changeRecurring(state, operation, id, expectedRevision, form, today, true);
}

export function updateRecurring(db, operation, id = null, expectedRevision = null, form = null, fixedOnly = false) {
  return transaction(db, (tx, state) => {
    if (state === null) throw new LedgerError('uninitialized', '測試帳本尚未建立。');
    legacyScheduleOnly(state);
    const changed = changeRecurring(state, operation, id, expectedRevision, form, taiwanToday(), fixedOnly);
    saveSettings(tx, state, changed);
    if (changed.actions.length !== state.actions.length) {
      tx.objectStore('meta').put({key:'next_action_order', value:changed.actions.length});
    }
    return changed;
  });
}

export function updateFixed(db, operation, id = null, expectedRevision = null, form = null) {
  return updateRecurring(db, operation, id, expectedRevision, form, true);
}
