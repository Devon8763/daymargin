import { activeExpenses, ordered } from './browse.mjs';
import { cents, isoDate, money, ValidationError } from './rules.mjs';

export const MAX_INVOICE_BYTES=4*1024*1024;
const invoiceError=()=>new ValidationError('發票 CSV 格式不符或資料矛盾；未匯入。請確認 UTF-8、必要欄位、日期、總金額與發票號碼。');
function invoiceCents(raw) {
  if(raw.length>17||! /^-?[0-9]+(?:\.[0-9]{1,2})?$/.test(raw))throw invoiceError();
  const value=raw.startsWith('-')?raw.slice(1):raw,exact=/^0+(?:\.0{1,2})?$/.test(value)?0n:cents(money(value));
  return raw.startsWith('-')?-exact:exact;
}
export function invoiceIdentity(number,date) {
  isoDate(date);
  if(typeof number!=='string'||! /^[A-Za-z]{2}[0-9]{8}$/.test(number))throw invoiceError();
  return 'e_invoice_'+date.slice(0,4)+'_'+number.toLowerCase();
}
function invoiceRows(text) {
  const rows=[];let row=[],value='',quoted=false,closed=false;
  const cell=()=>{row.push(value);value='';closed=false;};
  const line=()=>{cell();rows.push(row);row=[];if(rows.length>10000)throw invoiceError();};
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted){if(ch==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=ch;continue;}
    if(closed&&ch!==','&&ch!=='\r'&&ch!=='\n')throw invoiceError();
    if(ch==='"'){if(value||closed)throw invoiceError();quoted=true;}
    else if(ch===',')cell();
    else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;line();}
    else value+=ch;
  }
  if(quoted)throw invoiceError();if(value||closed||row.length)line();return rows;
}
export function invoicePreview(payload) {
  if(!(payload instanceof Uint8Array)||!payload.length||payload.byteLength>MAX_INVOICE_BYTES)throw invoiceError();
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(payload);}catch{throw invoiceError();}
  if(text.includes('\0'))throw invoiceError();
  const [head,...rows]=invoiceRows(text),required=['發票日期','發票號碼','發票金額','發票狀態','折讓','消費明細_品名'];
  if(!head||required.some(key=>head.filter(value=>value===key).length!==1)||new Set(head.filter(Boolean)).size!==head.filter(Boolean).length)throw invoiceError();
  const get=(row,key)=>head.includes(key)?row[head.indexOf(key)].trim():'',blocks=[],seen=new Map(),detail=head.includes('消費明細_金額');let footerRows=0,footer=false,current=null;
  for(const row of rows) {
    if(row.every(value=>!value.trim()))continue;
    if(row.length===1&&blocks.length){footerRows++;footer=true;continue;}
    if(footer||row.length!==head.length)throw invoiceError();
    const rawDate=get(row,'發票日期'),number=get(row,'發票號碼').toUpperCase();
    if(!/^[0-9]{8}$/.test(rawDate))throw invoiceError();
    const date=rawDate.slice(0,4)+'-'+rawDate.slice(4,6)+'-'+rawDate.slice(6),id=invoiceIdentity(number,date);
    const status=get(row,'發票狀態'),allowance=get(row,'折讓'),declared=invoiceCents(get(row,'發票金額')),amount=detail?invoiceCents(get(row,'消費明細_金額')):declared;
    const note=get(row,'消費明細_品名');
    if(!note||[...note].length>4096)throw invoiceError();
    if(current?.id!==id){current={id,number,date,status,allowance,rows:[]};blocks.push(current);}
    if(current.date!==date||current.status!==status||current.allowance!==allowance)throw invoiceError();
    current.rows.push({note,amount,declared,quantity:get(row,'消費明細_數量'),unit:get(row,'消費明細_單價')});
  }
  if(!blocks.length)throw invoiceError();
  const items=[];let excluded=0,nonpositive=0;
  for(const value of blocks) {
    const lines=value.rows.map(row=>[row.note,row.amount.toString(),row.declared.toString(),row.quantity,row.unit]);
    const signature=JSON.stringify([value.date,value.status,value.allowance,lines]);
    if(seen.has(value.id)){if(seen.get(value.id)!==signature)throw invoiceError();continue;}
    if(seen.size>=1000)throw invoiceError();seen.set(value.id,signature);
    if(value.status!=='開立已確認'||value.allowance!=='否'){excluded++;continue;}
    const sameTotal=value.rows.every(row=>row.declared===value.rows[0].declared),sum=detail?value.rows.reduce((total,row)=>total+row.amount,0n):value.rows[0].declared;
    if(detail?!value.rows.every(row=>row.declared===row.amount)&&!(sameTotal&&value.rows[0].declared===sum):!sameTotal)throw invoiceError();
    if(sum<=0n){nonpositive++;continue;}
    const amount=decimalAmount(sum.toString());money(amount);
    const note=[...new Set(value.rows.map(row=>row.note))].join('、');if([...note].length>4096)throw invoiceError();
    const needsTotal=detail&&new Set(lines.map(row=>JSON.stringify(row))).size!==lines.length;
    items.push({number:value.number,date:value.date,amount,note,needsTotal});
  }
  return {items,excluded,nonpositive,footerRows};
}

export function validateCsvRange(query, today) {
  isoDate(today);
  const start = isoDate(query.start), end = isoDate(query.end);
  if (start > end) throw new ValidationError('開始日期不可晚於結束日期。');
  return {start, end};
}

function safeText(value) {
  let controls = false;
  for (const character of value) {
    const control = /[\p{Cc}\p{Cf}]/u.test(character);
    if (/\s/u.test(character) || control) { controls ||= control; continue; }
    return controls || '=+-@'.includes(character) ? "'" + value : value;
  }
  return controls ? "'" + value : value;
}
const cell = value => /[",\r\n]/u.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
function decimalAmount(value) {
  const total = cents(value);
  const fraction = (total % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return (total / 100n).toString() + (fraction ? '.' + fraction : '');
}

export function expenseCsv(state, query, today) {
  const {start, end} = validateCsvRange(query, today);
  const rows = ordered(activeExpenses(state, today).filter(row => row.spent_on >= start && row.spent_on <= end));
  if (!rows.length) return {count:0, payload:null};
  const lines = ['日期,金額,消費項目,分類,付款方式'];
  for (const row of rows) lines.push([
    row.spent_on, decimalAmount(row.cents),
    ...[row.note, row.category, row.payment_source_name].map(safeText),
  ].map(cell).join(','));
  // ponytail: memory output uses the existing ledger capacity; never truncate an export.
  return {count:rows.length, payload:new TextEncoder().encode('\uFEFF' + lines.join('\r\n') + '\r\n')};
}
