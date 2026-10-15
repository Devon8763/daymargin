import test from 'node:test';
import assert from 'node:assert/strict';
import * as csv from '../web/csv.mjs';
import * as ledger from '../web/ledger.mjs';
import {emptyData,writeBackup,readBackup} from '../web/backup.mjs';
import {portable,metadata} from '../web/idb.mjs';
const head='載具自訂名稱,發票日期,發票號碼,發票金額,發票狀態,折讓,賣方統一編號,賣方名稱,賣方地址,買方統編,消費明細_數量,消費明細_單價,消費明細_金額,消費明細_品名';
const row=(number='AB00000001',note='合成品項',total='10.29',date='20240131',status='開立已確認',allowance='否',detail=total)=>['',date,number,total,status,allowance,'','','','','1',detail,detail,note].map(v=>/[,"\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v).join(',');
const file=(...rows)=>new TextEncoder().encode('\uFEFF'+head+'\r\n'+rows.join('\r\n'));
const base=()=>({...emptyData(8),format:'local-first-test-ledger',version:9,owner:'local-test-owner',payment_sources:[{id:'p_cash',name:'現金',active:1}]});
const choice=(number='AB00000001',date='2024-01-31')=>({number,date,form:{spent_on:date,amount:'10.29',note:'合成品項',category:'餐飲',payment_source_id:'p_cash'}});
test('invoice rows group by number and year, total once, literal item text and quoted newlines',()=>{
  const first=row('AB00000001','合成品項','10.29','20240131','開立已確認','否','5.29'),second=row('ab00000001','第二個,品項\n<img>','10.29','20240131','開立已確認','否','5');
  const value=csv.invoicePreview(file(first,second,row('AB00000001','翌年','20','20250131'),first,second,row('AB00000001','翌年','20','20250131')));
  assert.equal(value.items.length,2);assert.equal(value.items[0].amount,'10.29');assert.equal(value.items[0].note,'合成品項、第二個,品項\n<img>');assert.equal(value.items[1].date,'2025-01-31');
  assert.equal(csv.invoiceIdentity('AB00000001','2024-01-31'),csv.invoiceIdentity('ab00000001','2024-02-01'));
});
test('unsupported statuses and allowances excluded, footer warned; conflicts and malformed CSV refuse',()=>{
  const value=csv.invoicePreview(file(row(),row('AB00000002','合成','1','20240131','作廢'),row('AB00000003','合成','1','20240131','開立已確認','是'),'合成格式尾註'));
  assert.equal(value.items.length,1);assert.equal(value.excluded,2);assert.equal(value.footerRows,1);
  for(const content of [file(row('AB00000001','合成','10','20240131','開立已確認','否','3')),file(row('', '孤立品項')),file(row('AB00000002','合成','1','20240230')),file(row('wrong')),new TextEncoder().encode(head+'\n"unterminated'),new Uint8Array([0xff])])assert.throws(()=>csv.invoicePreview(content));
  assert.throws(()=>csv.invoicePreview(new Uint8Array(csv.MAX_INVOICE_BYTES+1)));
});
test('confirmed invoice batch uses original expense validation and ordered actions atomically',()=>{
  const state=base(),before=structuredClone(state),changed=ledger.changeInvoiceImport(state,[choice(),choice('AB00000002')],'2024-02-01');
  assert.deepEqual(state,before);assert.equal(changed.expenses.length,2);assert.equal(changed.actions.length,2);assert.equal(changed.expenses.reduce((sum,row)=>sum+BigInt(row.cents),0n),2058n);
  assert(changed.expenses.every(row=>row.source==='manual'&&row.revision===0&&row.payment_source_name==='現金'));assert(changed.actions.every(row=>row.before===null));
  assert.equal(portable(changed).version,9);assert.deepEqual(writeBackup(readBackup(writeBackup(portable(changed)))),writeBackup(portable(changed)));
  const downgrade=portable(changed);downgrade.version=8;assert.throws(()=>writeBackup(downgrade));
  for(const mutate of [value=>value.data.invoice_imports[0].expense_id='missing',value=>value.data.invoice_imports.push({...value.data.invoice_imports[0]}),value=>value.data.invoice_imports[0].key='invalid',value=>value.data.invoice_imports[1].expense_id=value.data.invoice_imports[0].expense_id]){const broken=portable(structuredClone(changed));mutate(broken);assert.throws(()=>writeBackup(broken));}
});
test('repeat imports and existing voided invoice IDs refuse whole batch; original state unchanged',()=>{
  const state=ledger.changeInvoiceImport(base(),[choice()],'2024-02-01');state.expenses[0].voided=1;state.expenses[0].revision=1;metadata(state);
  const before=structuredClone(state);assert.throws(()=>ledger.changeInvoiceImport(state,[choice('AB00000002'),choice()],'2024-02-01'));assert.deepEqual(state,before);
  assert.throws(()=>ledger.changeInvoiceImport(base(),[choice(),choice()],'2024-02-01'));
});
test('empty, forged fields, invalid or inactive options, extreme amounts and capacity refuse completely',()=>{
  const state=base();for(const choices of [[],[{...choice(),extra:1}],[{...choice(),number:'bad'}],[{...choice(),form:{...choice().form,amount:'1000000000.01'}}],[{...choice(),form:{...choice().form,spent_on:'2024-03-01'}}],[{...choice(),form:{...choice().form,tags:{ids:[],names:[]}}}]])assert.throws(()=>ledger.changeInvoiceImport(state,choices,'2024-02-01'));
  const disabled=base();disabled.categories=[{name:'餐飲',active:0}];assert.throws(()=>ledger.changeInvoiceImport(disabled,[choice()],'2024-02-01'));
  disabled.categories=[];disabled.payment_sources[0].active=0;assert.throws(()=>ledger.changeInvoiceImport(disabled,[choice()],'2024-02-01'));
  const full=base();full.categories=Array.from({length:99999},(_,i)=>({name:'c'+i,active:1}));metadata(full);assert.throws(()=>ledger.changeInvoiceImport(full,[{...choice(),form:{...choice().form,category:'c0'}}],'2024-02-01'));assert.equal(full.expenses.length,0);
});
test('import preview and safe rendering code are read only until explicit confirmation',async()=>{
  const {readFile}=await import('node:fs/promises'),html=await readFile(new URL('../web/index.html',import.meta.url),'utf8'),page=await readFile(new URL('../web/page.mjs',import.meta.url),'utf8');
  assert.match(html,/id="invoice-import"/);assert.match(html,/id="invoice-dialog"/);assert.match(page,/invoicePreview/);assert.match(page,/importInvoiceExpenses/);assert(!page.includes('invoiceContent.innerHTML'));
});
test('bounded parser refuses excessive rows, invoice groups and duplicate required columns',()=>{
  assert.throws(()=>csv.invoicePreview(file(...Array(10000).fill(row()))));
  assert.throws(()=>csv.invoicePreview(file(...Array.from({length:1001},(_,i)=>row('AB'+String(i).padStart(8,'0'))))));
  assert.throws(()=>csv.invoicePreview(new TextEncoder().encode(head+',發票號碼\n'+row()+',AB00000001')));
  assert.equal(csv.invoicePreview(file(row('AB00000001','合成','1','20240131','不明狀態'))).items.length,0);
  for(let version=1;version<=8;version++){const bytes=writeBackup({format:'life-ledger-backup',version,data:emptyData(version)});assert.deepEqual(writeBackup(readBackup(bytes)),bytes);}
});
test('invoice v9 preserves complete synthetic v1 relations, exact historical values and operation order',async()=>{
  const {readFile}=await import('node:fs/promises'),original=readBackup(await readFile(new URL('./fixtures/portable_life_ledger.json',import.meta.url))),state={...base(),...original.data},before=structuredClone(state);
  const form={...choice().form,category:'餐飲',payment_source_id:state.payment_sources.find(row=>row.active===1).id};
  const changed=ledger.changeInvoiceImport(state,[{...choice(),form}],'2026-10-12'),result=readBackup(writeBackup(portable(changed))).data;
  assert.deepEqual(state,before);assert.deepEqual(result.expenses.slice(0,-1),original.data.expenses);assert.deepEqual(result.actions.slice(0,-1),original.data.actions);
  for(const section of Object.keys(original.data).filter(section=>!['expenses','actions'].includes(section)))assert.deepEqual(result[section],original.data[section]);
  assert.equal(Object.keys(result).length,24);
});
test('legal old opaque IDs are not interpreted as invoice identities or refused',()=>{
  const data=emptyData(1);data.payment_sources=base().payment_sources;
  data.expenses=[{id:'e_invoice_2024_ab00000001',spent_on:'2024-01-31',cents:'29',category:'餐飲',note:'舊合成帳目',source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0}];
  const bytes=writeBackup({format:'life-ledger-backup',version:1,data});assert.deepEqual(writeBackup(readBackup(bytes)),bytes);
  const changed=ledger.changeInvoiceImport({...base(),...data},[choice()],'2024-02-01');assert.equal(changed.expenses.length,2);assert.equal(changed.invoice_imports.length,1);assert.notEqual(changed.invoice_imports[0].expense_id,data.expenses[0].id);
});
test('item-mode invoice sums exact signed detail amounts, including discounts, into one positive net',()=>{
  const value=csv.invoicePreview(file(row('AB00000001','商品甲','100'),row('AB00000001','商品乙','50'),row('AB00000001','折扣','-20')));
  assert.equal(value.items.length,1);assert.equal(value.items[0].amount,'130');assert.equal(value.items[0].note,'商品甲、商品乙、折扣');
  assert.equal(csv.invoicePreview(file(row('AB00000001','商品','0.01'),row('AB00000001','折扣','-0.01'))).nonpositive,1);
  assert.equal(csv.invoicePreview(file(row('AB00000001','商品','1'),row('AB00000001','折扣','-2'))).items.length,0);
  assert.equal(csv.invoicePreview(file(row('AB00000001','商品','0.30'),row('AB00000001','折扣','-0.01'))).items[0].amount,'0.29');
});
test('identical detail rows are not silently deleted; preview requires user-entered total',()=>{
  const value=csv.invoicePreview(file(row(),row()));assert.equal(value.items[0].needsTotal,true);assert.equal(value.items[0].amount,'20.58');
  const broken=file(row('AB00000001','商品','100'),row('AB00000002','商品','1'),row('AB00000001','不同明細','2'));assert.throws(()=>csv.invoicePreview(broken));
});
