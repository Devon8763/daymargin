import {isoDate, money, pythonStrip, cents, fixedSettings, fixedDueDate, recurringProgress, ValidationError} from './rules.mjs';
import {scheduleRules,scheduleMonth} from './schedule.mjs';

export const allocationMonth = value => { isoDate(value + '-01'); return value; };
export const defaultAllocation = () => [{id:'living', name:'生活開銷', cents:'0'}];
export function incomeName(value, limit = 200) {
  const name = pythonStrip(value);
  if (!name || [...name].length > limit || /[\u0000-\u001f]/u.test(name)) throw new ValidationError(`名稱需 1～${limit} 字，不可包含控制字元。`);
  return name;
}
export function incomeInput(form, today) {
  if (!form || Object.keys(form).length !== 3 || !['amount','received_on','name'].every(key => Object.hasOwn(form,key))) throw new ValidationError('收入欄位不符合規則。');
  const received_on = isoDate(form.received_on);
  if (received_on > isoDate(today)) throw new ValidationError('收入只記錄已收到的錢，日期不可晚於台灣今天。');
  return {received_on, cents:money(form.amount), name:incomeName(form.name)};
}
export function incomeRuleInput(form,previous=null) {
  const fields=['name','amount','first_due_on','due_day'];
  if(!form||Object.keys(form).length!==fields.length||fields.some(key=>!Object.hasOwn(form,key)))throw new ValidationError('定期收入欄位不符合規則。');
  const first=isoDate(form.first_due_on);
  if(!Number.isInteger(form.due_day)||form.due_day<1||form.due_day>31)throw new ValidationError('每月收款日需為1～31。');
  if(previous?first!==previous.first_due_on:fixedDueDate(first.slice(0,7),form.due_day)!==first)throw new ValidationError('首次日期不符合每月收款日；建立後首次日期不可更改。');
  return {name:incomeName(form.name),cents:money(form.amount),first_due_on:first,due_day:form.due_day};
}
const incomeMonthNumber=month=>Number(month.slice(0,4))*12+Number(month.slice(5))-1;
const incomeMonthAt=serial=>String(Math.floor(serial/12)).padStart(4,'0')+'-'+String(serial%12+1).padStart(2,'0');
export function recurringIncomeItem(state,id,month,today) {
  allocationMonth(month);isoDate(today);
  const rule=(state.income_rules||[]).find(row=>row.id===id);if(!rule)return null;
  const saved=(state.income_periods||[]).find(row=>row.rule_id===id&&row.month===month);
  if(saved)return {...saved,status:saved.status==='pending'&&saved.defaults.due_on>today?'upcoming':saved.status,rule_revision:rule.revision};
  if(rule.active!==1||month<rule.first_due_on.slice(0,7)||month<rule.effective_month)return null;
  const defaults={name:rule.name,cents:rule.cents,due_on:fixedDueDate(month,Number(rule.due_day))};
  if(defaults.due_on<rule.first_due_on)return null;
  return {rule_id:id,month,defaults,status:defaults.due_on>today?'upcoming':'pending',income_id:null,revision:null,rule_revision:rule.revision};
}
export function recurringIncomeItems(state,today,limit=100) {
  isoDate(today);if(!Number.isSafeInteger(limit)||limit<1||limit>100000)throw new ValidationError('查看期數超出範圍。');
  const items=[],last=incomeMonthNumber(today.slice(0,7));let more=false;
  const history=new Map();for(const row of state.income_periods||[]){if(!history.has(row.rule_id))history.set(row.rule_id,new Map());history.get(row.rule_id).set(row.month,row);}
  for(const rule of state.income_rules||[]) {
    const known=history.get(rule.id)||new Map(),months=new Set(known.keys());
    if(rule.active===1){const start=incomeMonthNumber(rule.effective_month),end=Math.min(last,start+limit+1);if(end<last)more=true;for(let serial=start;serial<=end;serial++)months.add(incomeMonthAt(serial));}
    let taken=0;
    for(const month of [...months].sort()) {
      const saved=known.get(month),defaults=saved?.defaults??{name:rule.name,cents:rule.cents,due_on:fixedDueDate(month,Number(rule.due_day))};
      if(!saved&&defaults.due_on<rule.first_due_on)continue;
      if(taken++>limit){more=true;break;}
      items.push(saved?{...saved,status:saved.status==='pending'&&defaults.due_on>today?'upcoming':saved.status,rule_revision:rule.revision}:{rule_id:rule.id,month,defaults,status:defaults.due_on>today?'upcoming':'pending',income_id:null,revision:null,rule_revision:rule.revision});
    }
    items.sort((a,b)=>a.defaults.due_on.localeCompare(b.defaults.due_on)||a.rule_id.localeCompare(b.rule_id));if(items.length>limit){more=true;items.splice(limit+1);}
  }
  return {items:items.slice(0,limit),more};
}
export function allocationInput(items) {
  if (!Array.isArray(items) || items.length > 100) throw new ValidationError('分配最多 100 個項目。');
  return items.map(item => {
    if (!item || Object.keys(item).length !== (Object.hasOwn(item,'goal_id')?4:3) || !['id','name','amount'].every(key => Object.hasOwn(item,key))) throw new ValidationError('分配欄位不符合規則。');
    const zero = typeof item.amount === 'string' && /^0+(?:\.0{0,2})?$/.test(item.amount.trim());
    return {id:item.id, name:incomeName(item.name,30), cents:zero ? '0' : money(item.amount),...(Object.hasOwn(item,'goal_id')?{goal_id:item.goal_id}:{})};
  });
}
export function goalInput(form,previous=null) {
  if(!form||Object.keys(form).length!==6||!['name','target_amount','saved_amount','deadline','remind','completed'].every(key=>Object.hasOwn(form,key)))throw new ValidationError('目標欄位不符合規則。');
  if(![0,1].includes(form.remind)||![0,1].includes(form.completed))throw new ValidationError('請選擇有效的目標狀態。');
  const value=(input,key,zero=false)=>{
    if(previous){const exact=cents(previous[key]),fraction=(exact%100n).toString().padStart(2,'0').replace(/0+$/,'');
      if(input===(exact/100n).toString()+(fraction?'.'+fraction:''))return previous[key];}
    return zero?allocationInput([{id:'saved',name:'已存',amount:input}])[0].cents:money(input);
  };
  return {name:incomeName(form.name),target_cents:value(form.target_amount,'target_cents'),saved_cents:value(form.saved_amount,'saved_cents',true),
    deadline:form.deadline===''?null:isoDate(form.deadline),remind:form.remind,completed:form.completed};
}
export const activeIncomes=(state,today)=>(state.incomes||[]).filter(row=>row.voided===0&&row.received_on<=today);
export function incomeMonth(state, month, today = '9999-12-31') {
  allocationMonth(month); isoDate(today);
  const entries = activeIncomes(state,today).filter(row=>row.received_on.slice(0,7)===month);
  const plan = (state.monthly_allocations || []).find(row => row.month === month) || null;
  const received = entries.reduce((sum,row) => sum + cents(row.cents),0n);
  const allocated = (plan?.items || []).reduce((sum,row) => sum + cents(row.cents),0n);
  return {entries, plan, received, allocated, difference:received-allocated};
}
export function recurringSuggestions(state, month, today='9999-12-31') {
  allocationMonth(month);
  const monthly = new Set(state.monthly_allocations?.find(row => row.month === month)?.excluded_recurring_ids || []);
  const future = new Set((state.allocation_preferences || []).filter(row => row.excluded_from_month <= month).map(row => row.recurring_id));
  const items = [];
  if(state.scheduled_periods?.length||state.recurring_versions.some(row=>Object.hasOwn(row,'from_index'))) {
    const rules=new Map(scheduleRules(state,today).map(row=>[row.id,row])),groups=new Map();
    for(const item of scheduleMonth(state,month,today).items) {
      const rule=rules.get(item.rule_id);if(!rule||rule.kind==='年度費用'||rule.active!==1||rule.complete||item.status==='skipped')continue;
      const current=groups.get(item.rule_id)??{id:item.rule_id,kind:rule.kind,name:item.defaults.name,cents:'0',due_on:item.defaults.due_on,excluded:monthly.has(item.rule_id)||future.has(item.rule_id),future:future.has(item.rule_id)};
      current.cents=(cents(current.cents)+item.contribution).toString();groups.set(item.rule_id,current);
    }
    return {items:[...groups.values()],total:[...groups.values()].filter(row=>!row.excluded).reduce((sum,row)=>sum+cents(row.cents),0n)};
  }
  for (const rule of state.recurring_rules) {
    if (rule.active !== 1 || rule.start_month > month || recurringProgress(state,rule).complete) continue;
    const offset = (Number(month.slice(0,4))-Number(rule.start_month.slice(0,4)))*12 + Number(month.slice(5))-Number(rule.start_month.slice(5));
    if (rule.kind === '分期' && BigInt(offset) >= BigInt(rule.periods)) continue;
    const settings = fixedSettings(state,rule,month);
    items.push({id:rule.id, kind:rule.kind, name:settings.name, cents:settings.cents,
      due_on:fixedDueDate(month,settings.due_day), excluded:monthly.has(rule.id) || future.has(rule.id), future:future.has(rule.id)});
  }
  return {items, total:items.filter(row => !row.excluded).reduce((sum,row) => sum+cents(row.cents),0n)};
}
