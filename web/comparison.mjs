import {isoDate,cents,categoryOptions,pythonStrip,ValidationError} from './rules.mjs';
import {activeExpenses,literalMatch,ordered,tagReport,validateTagQuery} from './browse.mjs';
const dayNumber=date=>Date.parse(date+'T00:00:00Z')/86400000;
const dateText=day=>new Date(day*86400000).toISOString().slice(0,10);
// Decimal ROUND_HALF_UP, without converting money or ratios to floating point.
export function ratioText(numerator,denominator,digits=2) {
  if(denominator===0n)return null;
  const scale=10n**BigInt(digits),negative=numerator<0n;
  const absolute=negative?-numerator:numerator;
  const rounded=(absolute*100n*scale*2n+denominator)/(denominator*2n);
  const fraction=(rounded%scale).toString().padStart(digits,'0').replace(/0+$/,'');
  return (negative&&rounded?'−':'')+(rounded/scale).toString()+(fraction?'.'+fraction:'');
}
export function comparisonDefaults(today) {
  isoDate(today);
  const first=today.slice(0,7)+'-01',previousEnd=dateText(dayNumber(first)-1);
  const next=new Date(first+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  return {a_start:first,a_end:dateText(next.getTime()/86400000-1),b_start:previousEnd.slice(0,7)+'-01',b_end:previousEnd,category:'',keyword:''};
}
export function analysisQuickRange(choice,today) {
  isoDate(today);
  if(choice==='custom')return null;
  if(choice==='all')return {start:'',end:''};
  const defaults=comparisonDefaults(today);
  if(choice==='month')return {start:defaults.a_start,end:today};
  if(choice==='previous')return {start:defaults.b_start,end:defaults.b_end};
  if(choice==='year')return {start:today.slice(0,4)+'-01-01',end:today};
  if(choice==='three'){const date=new Date(defaults.a_start+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()-2);return {start:date.toISOString().slice(0,10),end:today};}
  throw new ValidationError('請選擇有效時間條件。');
}
export function validateComparison(query,today) {
  isoDate(today);
  const result={};
  for(const key of ['a_start','a_end','b_start','b_end'])result[key]=isoDate(query[key]);
  if(result.a_start>result.a_end||result.b_start>result.b_end)throw new ValidationError('開始日期不可晚於結束日期。');
  if(typeof query.category!=='string'||typeof query.keyword!=='string'||[...query.keyword].length>200)throw new ValidationError('請確認分類及關鍵字（最多 200 字）。');
  return {...result,category:query.category,keyword:pythonStrip(query.keyword)};
}
export function comparisonCategories(state,today) {
  const options=categoryOptions(state).map(row=>({name:row.name,state:row.active===1?'active':'inactive'}));
  const names=new Set(options.map(row=>row.name));
  for(const name of [...new Set(activeExpenses(state,today).map(row=>row.category))].sort()){
    if(!names.has(name)){options.push({name,state:'historical'});names.add(name);}
  }
  return options;
}
export function compareExpenses(state,input,today) {
  const query=validateComparison(input,today),options=comparisonCategories(state,today);
  if(query.category&&!options.some(row=>row.name===query.category))throw new ValidationError('分類已變動，請重新載入後再選擇。');
  const rows=activeExpenses(state,today).filter(row=>(!query.category||row.category===query.category)&&(!query.keyword||literalMatch(row.note,query.keyword)));
  const period=(start,end)=>{
    const started=start<=today,actualEnd=end<today?end:today;
    const result={start,end,days:dayNumber(end)-dayNumber(start)+1,started,unfinished:end>today,actual_start:started?start:null,actual_end:started?actualEnd:null,total_cents:started?0n:null,record_count:started?0:null,categories:new Map(),daily:new Map(),actual_days:started?dayNumber(actualEnd)-dayNumber(start)+1:0};
    if(!started)return result;
    for(const row of rows){
      if(row.spent_on<start||row.spent_on>actualEnd)continue;
      const amount=cents(row.cents);result.total_cents+=amount;result.record_count++;
      result.categories.set(row.category,(result.categories.get(row.category)||0n)+amount);
      result.daily.set(row.spent_on,(result.daily.get(row.spent_on)||0n)+amount);
    }
    return result;
  };
  const a=period(query.a_start,query.a_end),b=period(query.b_start,query.b_end),comparable=a.started&&b.started;
  const share=(amount,total)=>{const value=ratioText(amount,total,1);return amount>0n&&value==='0'?'<0.1':value;};
  const categories=[...new Set([...a.categories.keys(),...b.categories.keys()])].sort().map(name=>{
    const ac=a.started?a.categories.get(name)||0n:null,bc=b.started?b.categories.get(name)||0n:null;
    return {name,a_cents:ac,b_cents:bc,difference_cents:comparable?ac-bc:null,a_percent:a.started?share(ac,a.total_cents):null,b_percent:b.started?share(bc,b.total_cents):null};
  });
  const difference=comparable?a.total_cents-b.total_cents:null;
  return {today,query,a,b,categories,difference_cents:difference,percent:comparable?ratioText(difference,b.total_cents):null,periods_differ:a.days!==b.days||a.unfinished||b.unfinished};
}
export function comparisonDay(period,index) {
  if(index<0||index>=period.actual_days)return null;
  const date=dateText(dayNumber(period.start)+index);
  return {day:index+1,date,cents:period.daily.get(date)||0n};
}
export function canPlotComparison(result) {
  const limit=BigInt(Number.MAX_SAFE_INTEGER);
  return [result.a,result.b].every(period=>period.total_cents===null||period.total_cents<=limit)&&
    result.categories.every(row=>[row.a_cents,row.b_cents].every(value=>value===null||value<=limit));
}

function analysisStart(unit,date) {
  isoDate(date);
  if(unit==='month')return date.slice(0,7)+'-01';
  if(unit==='year')return date.slice(0,4)+'-01-01';
  return dateText(dayNumber(date)-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
}
function analysisNext(unit,start) {
  if(unit==='week')return dayNumber(start)+7;
  const date=new Date(start+'T00:00:00Z');
  if(unit==='month')date.setUTCMonth(date.getUTCMonth()+1);else date.setUTCFullYear(date.getUTCFullYear()+1);
  return date.getTime()/86400000;
}
export function analysisPeriods(unit,start,end) {
  if(!['week','month','year'].includes(unit))throw new ValidationError('請選擇週、月或年。');
  isoDate(start);isoDate(end);
  if(start>end)throw new ValidationError('開始日期不可晚於結束日期。');
  const periods=[];
  for(let first=analysisStart(unit,start);first<=end;) {
    const next=analysisNext(unit,first),last=dateText(next-1);
    isoDate(first);isoDate(last);periods.push({start:first,end:last});
    if(next>dayNumber(end))break;
    first=dateText(next);
  }
  return periods;
}
export function analysisPeriodRange(unit,choice,value,today) {
  isoDate(today);
  if(!['week','month','year'].includes(unit))throw new ValidationError('請選擇週、月或年。');
  if(choice==='custom')return null;
  let anchor=today;
  if(choice==='select') {
    if(unit==='month') {if(typeof value!=='string'||!/^\d{4}-\d{2}$/.test(value))throw new ValidationError('請選擇有效月份。');anchor=value+'-01';}
    else if(unit==='year') {if(typeof value!=='string'||!/^\d{1,4}$/.test(value)||Number(value)<1)throw new ValidationError('請輸入1～9999的年份。');anchor=value.padStart(4,'0')+'-01-01';}
    else anchor=value;
  } else if(choice==='previous')anchor=dateText(dayNumber(analysisPeriods(unit,today,today)[0].start)-1);
  else if(choice!=='current'&&!(unit==='month'&&choice==='month'))throw new ValidationError('請選擇有效期間。');
  return analysisPeriods(unit,anchor,anchor)[0];
}
export function analysisDifference(result) {
  if(result.groups.length!==2)return null;
  const [a,b]=result.groups.map(group=>group.total_cents);
  return a===null||b===null?null:a-b;
}
function summarizePeriods(periods) {
  const started=periods.filter(period=>period.started),consumed=started.filter(period=>period.total_cents>0n),total=started.length?started.reduce((sum,period)=>sum+period.total_cents,0n):null;
  return {total_cents:total,selected_count:periods.length,started_count:started.length,consumed_count:consumed.length,
    highest_cents:started.length?started.reduce((max,period)=>period.total_cents>max?period.total_cents:max,0n):null,
    lowest_cents:started.length?started.reduce((min,period)=>period.total_cents<min?period.total_cents:min,started[0].total_cents):null,
    all_average:started.length?{numerator:total,denominator:BigInt(started.length)}:null,consumed_average:consumed.length?{numerator:total,denominator:BigInt(consumed.length)}:null};
}
export function analyzeExpenses(state,input,today) {
  isoDate(today);
  const validKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  if(!validKeys(input,['unit','groups','categories','keyword'])||!Array.isArray(input.groups)||!input.groups.length||!Array.isArray(input.categories)||input.categories.some(name=>typeof name!=='string')||typeof input.keyword!=='string'||[...input.keyword].length>200)
    throw new ValidationError('請確認分析期間、分類與關鍵字。');
  const choices=comparisonCategories(state,today);
  if(input.categories.some(name=>!choices.some(row=>row.name===name)))throw new ValidationError('分類已變動，請重新選擇。');
  const keyword=pythonStrip(input.keyword),selectedCategories=new Set(input.categories);
  const rows=activeExpenses(state,today).filter(row=>(!selectedCategories.size||selectedCategories.has(row.category))&&(!keyword||literalMatch(row.note,keyword)));
  const seen=new Set();let cross_overlap=false;
  const groups=input.groups.map(group=>{
    if(!validKeys(group,['name','ranges'])||typeof group.name!=='string'||!group.name.trim()||[...group.name].length>80||!Array.isArray(group.ranges)||!group.ranges.length)throw new ValidationError('每組請填名稱及至少一段期間。');
    const selected=new Map();let overlap=false;
    for(const range of group.ranges) {
      if(!validKeys(range,['start','end']))throw new ValidationError('請確認期間日期。');
      for(const period of analysisPeriods(input.unit,range.start,range.end)) {
        if(selected.has(period.start))overlap=true;
        selected.set(period.start,period);
      }
    }
    const periods=[...selected.values()].sort((a,b)=>a.start.localeCompare(b.start)).map(period=>({...period,started:period.start<=today,unfinished:period.end>today,actual_end:period.start<=today?(period.end<today?period.end:today):null,total_cents:period.start<=today?0n:null,rows:[],categories:new Map()}));
    const byStart=new Map(periods.map(period=>[period.start,period]));
    for(const period of periods){if(seen.has(period.start))cross_overlap=true;seen.add(period.start);}
    for(const row of rows) {
      const period=byStart.get(analysisStart(input.unit,row.spent_on));if(!period)continue;
      const value=cents(row.cents);period.total_cents+=value;period.rows.push(row);period.categories.set(row.category,(period.categories.get(row.category)||0n)+value);
    }
    for(const period of periods)ordered(period.rows);
    return {name:group.name,periods,overlap,...summarizePeriods(periods)};
  });
  const memberships=new Map();
  for(const group of groups)for(const period of group.periods)memberships.set(period.start,(memberships.get(period.start)||0)+1);
  for(const group of groups)for(const period of group.periods)period.cross_overlap=memberships.get(period.start)>1;
  return {unit:input.unit,today,groups,cross_overlap,plottable:groups.every(group=>group.total_cents===null||group.total_cents<=BigInt(Number.MAX_SAFE_INTEGER))};
}
export function analyzeTagMonths(state,query,today) {
  const bounds=validateTagQuery(query,today),report=tagReport(state,query,today);
  const start=bounds.start||(report.rows.length?report.rows.at(-1).spent_on.slice(0,7)+'-01':''),end=bounds.end;
  const periods=start?analyzeExpenses({...state,expenses:report.rows},{unit:'month',groups:[{name:'標籤',ranges:[{start,end}]}],categories:[],keyword:''},today).groups[0].periods.map(period=>{
    const selectedStart=period.start<start?start:period.start,selectedEnd=period.end>end?end:period.end,started=selectedStart<=today;
    return {...period,month:period.start.slice(0,7),start:selectedStart,end:selectedEnd,started,unfinished:selectedEnd>today,
      actual_end:started?(selectedEnd<today?selectedEnd:today):null,total_cents:started?period.total_cents:null};
  }):[];
  return {...report,today,start,end,periods,...summarizePeriods(periods),plottable:report.total<=BigInt(Number.MAX_SAFE_INTEGER)};
}
