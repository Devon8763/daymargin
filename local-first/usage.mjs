import {isoDate,cents,recurringProgress,fixedSettings,ValidationError} from './rules.mjs';
import {scheduleRules} from './schedule.mjs';

export const MAX_USAGE_DAYS = 36500;
const dayNumber = date => Date.parse(isoDate(date)+'T00:00:00Z') / 86400000;
export function usageEnd(row) {
  const value = new Date((dayNumber(row.started_on) + row.days - 1) * 86400000).toISOString().slice(0,10);
  return isoDate(value);
}
export function usageInput(form) {
  const fields=['started_on','days','remind','reminder_days','show_daily_cost','active'];
  if (!form || Object.keys(form).length!==fields.length || fields.some(key=>!Object.hasOwn(form,key))) throw new ValidationError('使用期間欄位不符合規則。');
  isoDate(form.started_on);
  if (!Number.isInteger(form.days) || form.days<1 || form.days>MAX_USAGE_DAYS) throw new ValidationError('可使用天數需為 1～36,500 的整數。');
  if (!Number.isInteger(form.reminder_days) || form.reminder_days<0 || form.reminder_days>MAX_USAGE_DAYS) throw new ValidationError('提前提醒天數需為 0～36,500 的整數。');
  if (['remind','show_daily_cost','active'].some(key=>![0,1].includes(form[key]))) throw new ValidationError('請選擇有效的追蹤設定。');
  usageEnd(form);
  return {...form};
}
export function dailyCost(value,days) {
  if (!Number.isInteger(days) || days<1 || days>MAX_USAGE_DAYS) throw new ValidationError('可使用天數不符合規則。');
  const numerator=cents(value)*100n,denominator=BigInt(days),rounded=(numerator*2n+denominator)/(denominator*2n);
  if (rounded===0n && numerator>0n) return '<0.0001';
  return (rounded/10000n).toString()+((rounded%10000n) ? '.'+(rounded%10000n).toString().padStart(4,'0').replace(/0+$/,'') : '');
}
export function endingSoon(state,today) {
  const now=dayNumber(today),items=[],expenses=new Map(state.expenses.map(row=>[row.id,row]));
  for (const row of state.usage_periods || []) {
    const entry=expenses.get(row.expense_id);
    if (!entry || entry.voided!==0 || entry.spent_on>today || row.active!==1 || row.remind!==1 || row.started_on>today) continue;
    const end=usageEnd(row),remaining=dayNumber(end)-now;
    if (remaining>row.reminder_days) continue;
    items.push({kind:'usage',id:entry.id,name:entry.note,end,text:remaining>0 ? '剩 '+remaining+' 天' : remaining===0 ? '今天預計用完' : '預計已用完'});
  }
  const posted=new Map();
  for (const entry of state.expenses) if (entry.recurring_id!==null) {
    if (!posted.has(entry.recurring_id)) posted.set(entry.recurring_id,new Set());
    posted.get(entry.recurring_id).add(entry.period);
  }
  const unified=state.scheduled_periods?.length||state.recurring_versions.some(row=>Object.hasOwn(row,'from_index'));
  const views=unified?new Map(scheduleRules(state,today).map(row=>[row.id,row])):null;
  for (const rule of state.recurring_rules) {
    if (rule.kind!=='分期' || rule.active!==1) continue;
    const progress=recurringProgress(state,rule,BigInt(posted.get(rule.id)?.size || 0));
    if (!progress.complete && progress.total-progress.posted===1n) items.push({kind:'installment',id:rule.id,name:views?.get(rule.id)?.name??fixedSettings(state,rule,today.slice(0,7)).name,text:'剩 1 期'});
  }
  return items;
}
