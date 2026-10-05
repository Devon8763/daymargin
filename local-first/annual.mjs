import {isoDate, money, categoryOptions, fixedDueDate, cents, ValidationError} from './rules.mjs';
import {incomeName, allocationMonth} from './income.mjs';

export function annualInput(form, state, today, previous = null) {
  isoDate(today);
  const fields = ['name','amount','category','payment_source_id','first_year','due_month','due_day'];
  if (!form || Object.keys(form).length !== fields.length || fields.some(key => !Object.hasOwn(form,key))) throw new ValidationError('年度費用欄位不符合規則。');
  for (const [field,max] of [['first_year',9999],['due_month',12],['due_day',31]]) {
    if (!Number.isInteger(form[field]) || form[field] < 1 || form[field] > max) throw new ValidationError('請填寫有效的首次年份、月份及扣款日。');
  }
  if (!categoryOptions(state).some(row => row.name === form.category && row.active === 1) && form.category !== previous?.category) throw new ValidationError('請選擇有效分類。');
  const payment = state.payment_sources.find(row => row.id === form.payment_source_id);
  if (!payment || (payment.active !== 1 && payment.id !== previous?.payment_source_id)) throw new ValidationError('請選擇有效付款方式。');
  return {name:incomeName(form.name),cents:money(form.amount),category:form.category,
    payment_source_id:payment.id,payment_source_name:payment.id === previous?.payment_source_id ? previous.payment_source_name : payment.name,
    first_year:form.first_year,due_month:form.due_month,due_day:form.due_day};
}
export const annualDefaults = (rule,year) => ({name:rule.name,cents:rule.cents,category:rule.category,
  payment_source_id:rule.payment_source_id,payment_source_name:rule.payment_source_name,
  due_on:fixedDueDate(String(year).padStart(4,'0')+'-'+String(rule.due_month).padStart(2,'0'),rule.due_day)});
function itemFor(rule,saved,year,today) {
  if (saved) return saved.status === 'pending' && saved.defaults.due_on.slice(0,7) > today.slice(0,7) ? null
    : {...saved,due_on:saved.defaults.due_on,rule_revision:rule.revision};
  const defaults = annualDefaults(rule,year),month = defaults.due_on.slice(0,7);
  if (rule.active !== 1 || year < rule.first_year || month < rule.effective_month || month > today.slice(0,7)) return null;
  return {annual_id:rule.id,year,defaults,due_on:defaults.due_on,status:'pending',expense_id:null,revision:null,rule_revision:rule.revision};
}
export function annualItem(state,id,year,today) {
  isoDate(today);
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new ValidationError('年度期數不符合規則。');
  const rule = (state.annual_rules || []).find(row => row.id === id);
  if (!rule) return null;
  const saved = (state.annual_periods || []).find(row => row.annual_id === id && row.year === year);
  return itemFor(rule,saved,year,today);
}
export function annualItems(state,today,limit = 100) {
  isoDate(today);
  const items = [], saved = new Map();
  for (const row of state.annual_periods || []) {
    if (!saved.has(row.annual_id)) saved.set(row.annual_id,new Map());
    saved.get(row.annual_id).set(row.year,row);
  }
  for (const rule of state.annual_rules || []) {
    const history = saved.get(rule.id) || new Map(),years = new Set(history.keys());
    if (rule.active === 1) for (let year = Math.max(rule.first_year,Number(rule.effective_month.slice(0,4))); year <= Number(today.slice(0,4)); year++) years.add(year);
    for (const year of [...years].sort((a,b)=>a-b)) {
      const item = itemFor(rule,history.get(year),year,today);
      if (item) items.push(item);
      if (items.length > limit) return {items:items.slice(0,limit),more:true};
    }
  }
  return {items,more:false};
}
export function annualReserve(state,month,today) {
  allocationMonth(month); isoDate(today);
  const items = month < today.slice(0,7) ? [] : (state.annual_rules || []).filter(row => row.active === 1)
    .map(row => ({id:row.id,name:row.name,cents:(cents(row.cents)+11n)/12n,annual_cents:row.cents}));
  return {items,total:items.reduce((sum,row)=>sum+row.cents,0n)};
}
