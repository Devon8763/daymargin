import {isoDate,fixedDueDate,fixedSettings,cents,ValidationError} from './rules.mjs';

const DAY=86400000,day=value=>BigInt(new Date(isoDate(value)+'T00:00:00Z').getTime()/DAY);
const FIRST_DAY=day('0001-01-01'),LAST_DAY=day('9999-12-31');
export function scheduleDue(first,unit,every,index) {
  isoDate(first);
  if(!['day','week','month','year'].includes(unit) || !Number.isSafeInteger(every) || every<1 || !Number.isSafeInteger(index) || index<0)
    throw new ValidationError('請填寫有效的付款頻率與期數。');
  const offset=BigInt(every)*BigInt(index),[year,month,date]=first.split('-').map(Number);
  if(unit==='day'||unit==='week') {
    const target=day(first)+offset*(unit==='week'?7n:1n);
    if(target<FIRST_DAY||target>LAST_DAY)throw new ValidationError('付款日期超出可支援範圍。');
    return new Date(Number(target)*DAY).toISOString().slice(0,10);
  }
  const serial=BigInt(year*12+month-1)+offset*(unit==='year'?12n:1n);
  if(serial<12n||serial>119999n)throw new ValidationError('付款日期超出可支援範圍。');
  return fixedDueDate(String(serial/12n).padStart(4,'0')+'-'+String(serial%12n+1n).padStart(2,'0'),date);
}

const monthNumber=value=>Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;
const monthAt=value=>String(Math.floor(value/12)).padStart(4,'0')+'-'+String(value%12+1).padStart(2,'0');
export function scheduleModels(state) {
  const linked=new Set((state.scheduled_periods||[]).filter(row=>row.expense_id!==null).map(row=>row.expense_id));
  const models=[...state.recurring_rules.map(root=>({root,annual:false})),...(state.annual_rules||[]).map(root=>({root,annual:true}))];
  const byId=new Map(models.map(model=>[model.root.id,model]));
  const years=new Map(),versions=new Map();
  for(const row of state.annual_periods||[])years.set(row.annual_id,Math.min(years.get(row.annual_id)??9999,Number(row.year)));
  for(const row of state.recurring_versions)if(Object.hasOwn(row,'from_index')){if(!versions.has(row.recurring_id))versions.set(row.recurring_id,[]);versions.get(row.recurring_id).push({...row,from_index:Number(row.from_index),every:Number(row.every)});}
  for(const model of models) {
    const {root,annual}=model;model.state=state;model.kind=annual?'年度費用':root.kind;model.known=new Map();
    model.firstYear=annual?Math.min(Number(root.first_year),years.get(root.id)??9999):null;
    const initialDay=annual?root.due_day:fixedSettings(state,root,root.start_month).due_day;
    const first=fixedDueDate(annual?String(model.firstYear).padStart(4,'0')+'-'+String(root.due_month).padStart(2,'0'):root.start_month,initialDay===null?null:Number(initialDay));
    const generic=(versions.get(root.id)||[]).sort((a,b)=>a.from_index-b.from_index);
    model.phases=[{from_index:0,first_due_on:first,unit:annual?'year':'month',every:1,legacy:true},...generic];
    if(generic[0]?.from_index===0)model.phases.shift();
    model.phases.forEach((phase,index)=>{model.phases[index]={...phase,end:(model.phases[index+1]?.from_index??3652059)-1};});
    model.total=annual?0n:BigInt(root.periods);
  }
  for(const entry of state.expenses) {
    if(entry.recurring_id===null||linked.has(entry.id))continue;
    const model=byId.get(entry.recurring_id);if(!model)continue;
    const index=monthNumber(entry.period)-monthNumber(model.root.start_month);
    model.known.set(index,{rule_id:model.root.id,index,defaults:{due_on:entry.spent_on,name:entry.note,cents:entry.cents,category:entry.category,payment_source_id:entry.payment_source_id,payment_source_name:entry.payment_source_name},status:'recorded',expense_id:entry.id,revision:null});
  }
  for(const row of state.annual_periods||[]) {
    const model=byId.get(row.annual_id);if(model)model.known.set(Number(row.year)-model.firstYear,{rule_id:row.annual_id,index:Number(row.year)-model.firstYear,defaults:row.defaults,status:row.status,expense_id:row.expense_id,revision:row.revision});
  }
  for(const row of state.scheduled_periods||[])byId.get(row.rule_id)?.known.set(Number(row.index),row);
  return models;
}
function phaseFor(model,index) { return model.phases.findLast(phase=>phase.from_index<=index); }
function dateAt(model,phase,index) {
  if(!phase.legacy)return scheduleDue(phase.first_due_on,phase.unit,phase.every,index-phase.from_index);
  if(model.annual)return fixedDueDate(String(model.firstYear+index).padStart(4,'0')+'-'+String(model.root.due_month).padStart(2,'0'),Number(model.root.due_day));
  const month=monthAt(monthNumber(model.root.start_month)+index),day=fixedSettings(model.state,model.root,month).due_day;return fixedDueDate(month,day===null?null:Number(day));
}
function defaultsAt(model,phase,index) {
  const due_on=dateAt(model,phase,index),source=phase.legacy?(model.annual?model.root:fixedSettings(model.state,model.root,due_on.slice(0,7))):phase;
  return {due_on,name:source.name,cents:source.cents,category:source.category,payment_source_id:source.payment_source_id??null,payment_source_name:source.payment_source_name??'未指定'};
}
function lastAt(model,phase,date) {
  if(date<phase.first_due_on)return phase.from_index-1;
  const distance=phase.unit==='day'||phase.unit==='week'?day(date)-day(phase.first_due_on):BigInt(monthNumber(date)-monthNumber(phase.first_due_on));
  const divisor=BigInt(phase.every)*(phase.unit==='week'?7n:phase.unit==='year'?12n:1n);
  let index=Math.min(phase.end,phase.from_index+Number(distance/divisor),model.total?Number(model.total-1n>3652058n?3652058n:model.total-1n):3652058);
  if(index>=phase.from_index&&dateAt(model,phase,index)>date)index--;
  return index;
}
function earliest(model,phase) {
  if(!phase.legacy||!model.annual)return phase.from_index;
  const first=Math.max(model.firstYear,model.root.first_year,Number(model.root.effective_month.slice(0,4)));
  let index=first-model.firstYear;
  if(dateAt(model,phase,index).slice(0,7)<model.root.effective_month)index++;
  return Math.max(phase.from_index,index);
}
export function schedulePeriod(model,index,today) {
  isoDate(today);if(!Number.isSafeInteger(index)||index<0||index>3652058)throw new ValidationError('請選擇有效期數。');
  let row=model.known.get(index);
  if(!row) {
    const phase=phaseFor(model,index);
    if(model.root.active!==1||!phase||index>phase.end||index<earliest(model,phase)||(model.total&&BigInt(index)>=model.total))return null;
    let defaults;try{defaults=defaultsAt(model,phase,index);}catch{return null;}
    row={rule_id:model.root.id,index,defaults,status:'pending',expense_id:null,revision:null};
  }
  return {...row,index:Number(row.index),kind:model.kind,status:row.status==='pending'&&row.defaults.due_on>today?'upcoming':row.status,rule_revision:model.root.revision};
}
export function scheduleNext(model,today) {
  if(model.root.active!==1)return null;
  let next=null;
  for(const phase of model.phases) {
    let index=Math.max(earliest(model,phase),lastAt(model,phase,today)+1);
    while(index<=phase.end&&model.known.has(index))index++;
    const item=index<=phase.end?schedulePeriod(model,index,today):null;
    if(item?.status==='upcoming'&&(!next||item.defaults.due_on<next.defaults.due_on))next=item;
  }
  return next;
}
export function scheduleRules(state,today) {
  isoDate(today);
  return scheduleModels(state).map(model=>{
    const next=scheduleNext(model,today),phase=next?phaseFor(model,next.index):model.phases.at(-1),index=next?.index??phase.from_index;
    const settings=defaultsAt(model,phase,index);
    const handled=[...model.known.values()].filter(row=>row.status==='recorded'||row.status==='skipped').length;
    return {id:model.root.id,kind:model.kind,active:model.root.active,revision:model.root.revision,...settings,first_due_on:phase.first_due_on,unit:phase.unit,every:phase.every,periods:model.annual?0:model.root.periods,complete:model.kind==='分期'&&BigInt(handled)===model.total,edit_due_on:next?.defaults.due_on??null,next_due_on:next?.defaults.due_on??null};
  });
}
export function* scheduleDuePeriods(model,today) {
  isoDate(today);if(model.root.active!==1)return;
  for(const phase of model.phases)for(let index=earliest(model,phase),last=lastAt(model,phase,today);index<=last;index++) {
    if(model.known.has(index))continue;
    const row=schedulePeriod(model,index,today);if(row?.status==='pending')yield row;
  }
}
export function scheduleItems(state,today,limit=100) {
  isoDate(today);if(!Number.isSafeInteger(limit)||limit<1||limit>100000)throw new ValidationError('請選擇有效顯示筆數。');
  const best=[],todayDay=day(today),end=fixedDueDate(today.slice(0,7),31);
  const add=item=>{if(!item)return;const distance=day(item.defaults.due_on)-todayDay;best.push({item,distance:Number(distance<0n?-distance:distance)});best.sort((a,b)=>a.distance-b.distance||a.item.defaults.due_on.localeCompare(b.item.defaults.due_on)||a.item.rule_id.localeCompare(b.item.rule_id)||a.item.index-b.item.index);if(best.length>limit+1)best.length=limit+1;};
  for(const model of scheduleModels(state)) {
    for(const index of model.known.keys())add(schedulePeriod(model,index,today));
    if(model.root.active!==1)continue;
    for(const phase of model.phases) {
      let index=lastAt(model,phase,end),count=0;
      for(;index>=earliest(model,phase)&&count<=limit;index--)if(!model.known.has(index)){add(schedulePeriod(model,index,today));count++;}
    }
    const next=scheduleNext(model,today);if(next?.defaults.due_on>end)add(next);
  }
  return {items:best.slice(0,limit).map(row=>row.item),more:best.length>limit};
}
export function scheduleMonth(state,month,today) {
  const start=isoDate(month+'-01'),end=fixedDueDate(month,31);isoDate(today);
  const items=[],entries=new Map(state.expenses.map(row=>[row.id,row]));
  const add=item=>{
    if(!item||item.defaults.due_on.slice(0,7)!==month)return;
    const entry=entries.get(item.expense_id),contribution=item.status==='skipped'?0n:item.status==='recorded'?(entry&&entry.voided===0&&entry.spent_on<=today?cents(entry.cents):0n):cents(item.defaults.cents);
    items.push({...item,contribution});
  };
  for(const model of scheduleModels(state)) {
    for(const index of model.known.keys())add(schedulePeriod(model,index,today));
    if(model.root.active!==1)continue;
    for(const phase of model.phases) {
      let first=Math.max(earliest(model,phase),lastAt(model,phase,start));
      const last=lastAt(model,phase,end);
      if(first>last)continue;
      if(first>=phase.from_index&&dateAt(model,phase,first)<start)first++;
      for(let index=first;index<=last;index++)if(!model.known.has(index))add(schedulePeriod(model,index,today));
    }
  }
  items.sort((a,b)=>a.defaults.due_on.localeCompare(b.defaults.due_on)||a.rule_id.localeCompare(b.rule_id)||a.index-b.index);
  return {items,total:items.reduce((sum,row)=>sum+row.contribution,0n)};
}
export function scheduleReserve(state,month,today) {
  isoDate(month+'-01');isoDate(today);
  const items=month<today.slice(0,7)?[]:scheduleRules(state,today).filter(row=>row.kind==='年度費用'&&row.active===1&&row.unit==='year').map(row=>{
    const divisor=12n*BigInt(row.every);return {id:row.id,name:row.name,unit:row.unit,every:row.every,annual_cents:row.cents,cents:(cents(row.cents)+divisor-1n)/divisor};
  });
  return {items,total:items.reduce((sum,row)=>sum+row.cents,0n)};
}
