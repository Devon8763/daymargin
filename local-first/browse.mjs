import { cents, isoDate, categoryOptions, ValidationError } from './rules.mjs';

const asciiLower = text => text.replace(/[A-Z]/g, char => char.toLowerCase());
export const literalMatch = (text, keyword) => asciiLower(text).includes(asciiLower(keyword));
export const ordered = rows => rows.sort((a, b) => b.spent_on.localeCompare(a.spent_on) ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

export function activeExpenses(state, today) {
  return state.expenses.filter(row => row.kind === 'consumption' && row.voided === 0 &&
    ['manual', '固定', '訂閱', '分期'].includes(row.source) && row.spent_on <= today);
}
export function validateTagQuery(query,today) {
  isoDate(today);
  if(!query || Object.keys(query).length!==3 || ['tag_id','start','end'].some(key=>typeof query[key]!=='string') || !/^[a-z][a-z0-9_-]{0,63}$/.test(query.tag_id))
    throw new ValidationError('請選擇一個現有標籤。');
  const start=query.start ? isoDate(query.start) : '',end=query.end ? isoDate(query.end) : today;
  if(start && start>end)throw new ValidationError('開始日期不可晚於結束日期。');
  return {start,end};
}
export function tagReport(state,query,today) {
  const {start,end}=validateTagQuery(query,today);
  if(!(state.tags || []).some(row=>row.id===query.tag_id))throw new ValidationError('標籤已移除，請重新選擇。');
  const ids=new Set((state.expense_tags || []).filter(row=>row.tag_id===query.tag_id).map(row=>row.expense_id));
  const rows=ordered(activeExpenses(state,today).filter(row=>ids.has(row.id) && row.spent_on>=start && row.spent_on<=end));
  return {rows,total:rows.reduce((total,row)=>total+cents(row.cents),0n)};
}

export function monthBudget(state, today) {
  const month = isoDate(today).slice(0, 7);
  const totals = new Map();
  let spent = 0n;
  for (const row of activeExpenses(state, today)) {
    if (!row.spent_on.startsWith(month)) continue;
    const amount = cents(row.cents);
    spent += amount;
    totals.set(row.category, (totals.get(row.category) || 0n) + amount);
  }
  const active = new Set(categoryOptions(state).filter(row => row.active === 1).map(row => row.name));
  const budgets = state.budgets.filter(row => row.month === month).map(row => {
    const amount = cents(row.cents), used = row.category === '總額' ? spent : totals.get(row.category) || 0n;
    return { category:row.category, cents:amount, spent:used, remaining:amount - used, active:active.has(row.category) };
  });
  return { month, spent, total:budgets.find(row => row.category === '總額') || null,
    categories:budgets.filter(row => row.category !== '總額') };
}

export function validateSearch(query, today) {
  isoDate(today);
  const keyword = query.keyword.trim();
  const start = query.start ? isoDate(query.start) : '';
  const end = query.end ? isoDate(query.end) : today;
  if (!keyword && !start) throw new ValidationError('請填寫消費項目關鍵字或開始日期。');
  if (start > today || end > today) throw new ValidationError('日期不可晚於台灣今天。');
  if (start && start > end) throw new ValidationError('開始日期不可晚於結束日期。');
  return { keyword, start, end };
}

export function searchExpenses(state, query, today) {
  const { keyword, start, end } = validateSearch(query, today);
  return ordered(activeExpenses(state, today).filter(row => row.spent_on >= start && row.spent_on <= end &&
    (!keyword || literalMatch(row.note, keyword))));
}

function searchCategories(state,today) {
  const options=new Map(categoryOptions(state).map(row=>[row.name,row]));
  for(const row of activeExpenses(state,today))if(!options.has(row.category))options.set(row.category,{name:row.category,active:0,historical:true});
  return [...options.values()];
}
export function siteSearch(state,query,today,functions=[]) {
  const expenses=searchExpenses(state,query,today),keyword=query.keyword.trim();
  return {expenses,
    functions:keyword ? functions.filter(row=>literalMatch(row.name,keyword)) : [],
    categories:keyword ? searchCategories(state,today).filter(row=>literalMatch(row.name,keyword)) : [],
    tags:keyword ? (state.tags || []).filter(row=>literalMatch(row.name,keyword)) : []};
}
export const validateBrowse=(query,today)=>validateSearch({...query,keyword:'',start:query.start||'0001-01-01'},today);
export function browseSite(state,query,today,functions=[]) {
  const {start,end}=validateBrowse(query,today);
  return {expenses:searchExpenses(state,{keyword:'',start,end},today),functions:[...functions],categories:searchCategories(state,today),tags:state.tags||[]};
}
export function categoryReport(state,query,today) {
  const rows=searchExpenses(state,{keyword:'',start:query.start || '0001-01-01',end:query.end},today);
  if(!searchCategories(state,today).some(row=>row.name===query.category))throw new ValidationError('分類已變更，請重新搜尋。');
  const related=rows.filter(row=>row.category===query.category);
  return {rows:related,total:related.reduce((sum,row)=>sum+cents(row.cents),0n)};
}

export function calendarMonth(state, month, today) {
  isoDate(today);
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) throw new ValidationError('月份格式錯誤。');
  isoDate(month + '-01');
  if (month > today.slice(0, 7)) throw new ValidationError('不能查看未來月份。');
  const [year, number] = month.split('-').map(Number);
  const first = new Date(0);
  first.setUTCFullYear(year, number - 1, 1);
  const last = new Date(0);
  last.setUTCFullYear(year, number, 0);
  const byDay = new Map();
  for (const row of activeExpenses(state, today)) {
    if (!row.spent_on.startsWith(month)) continue;
    if (!byDay.has(row.spent_on)) byDay.set(row.spent_on, []);
    byDay.get(row.spent_on).push(row);
  }
  const days = Array.from({ length:last.getUTCDate() }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const expenses = ordered(byDay.get(date) || []);
    return { date, day:index + 1, isFuture:date > today, hasExpense:expenses.length > 0,
      expenses, total:expenses.reduce((sum, row) => sum + cents(row.cents), 0n) };
  });
  return { month, leadingBlanks:(first.getUTCDay() + 6) % 7, days };
}
