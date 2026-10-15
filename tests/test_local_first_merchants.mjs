import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../web/rules.mjs';
import * as ledger from '../web/ledger.mjs';
import {invoicePreview} from '../web/csv.mjs';
import {emptyData,writeBackup,readBackup} from '../web/backup.mjs';
import {portable,metadata} from '../web/idb.mjs';
const base=()=>({...emptyData(10),format:'local-first-test-ledger',version:11,owner:'local-test-owner',payment_sources:[{id:'p_cash',name:'現金',active:1}]});
const choice=(category='發票',number='AB00000001')=>({number,date:'2024-01-31',form:{spent_on:'2024-01-31',amount:'0.29',note:'合成品項',category,payment_source_id:'p_cash'}});
test('known merchant header is optional, exact and consistent across invoice items',()=>{
  const head='發票日期,發票號碼,發票金額,發票狀態,折讓,消費明細_品名,賣方名稱';
  const row=name=>'20240131,AB00000001,1,開立已確認,否,合成品項,'+name;
  const file=text=>new TextEncoder().encode(text);
  assert.equal(invoicePreview(file(head+'\n'+row(' 合成店 '))).items[0].merchant,'合成店');
  assert.equal(invoicePreview(file(head+'\n'+row('\u0085合成店\u0085'))).items[0].merchant,rules.merchantName('\u0085合成店\u0085'));
  assert.equal(invoicePreview(file(head+'\n'+row('\ufeff合成店\ufeff'))).items[0].merchant,rules.merchantName('\ufeff合成店\ufeff'));
  assert.throws(()=>invoicePreview(file(head+'\n'+row('合成店')+'\n'+row('其他店'))));
  assert.equal(invoicePreview(file(head.slice(0,-5)+'\n'+row('').slice(0,-1))).items[0].merchant,'');
});
test('suggestion precedence ignores inactive targets and never invents another fallback',()=>{
  assert.equal(typeof rules.invoiceCategorySuggestion,'function');
  const state=base();assert.equal(rules.invoiceCategorySuggestion(state,''),'發票');
  state.merchant_rules=[{id:'m_1',merchant:'合成店',category:'餐飲',revision:0}];
  assert.equal(rules.invoiceCategorySuggestion(state,' 合成店 '),'餐飲');
  assert.equal(rules.invoiceCategorySuggestion(state,'合成'),'發票');
  state.categories=[{name:'餐飲',active:0},{name:'發票',active:0}];
  assert.equal(rules.invoiceCategorySuggestion(state,'合成店'),'其他');
  state.categories.push({name:'其他',active:0});assert.equal(rules.invoiceCategorySuggestion(state,'合成店'),'');
});
test('invoice category is created only by a successful selected import; overrides and rejected batches leave no category',()=>{
  const state=base(),before=structuredClone(state);
  const changed=ledger.changeInvoiceImport(state,[choice()],'2024-02-01');
  assert.deepEqual(changed.categories,[{name:'發票',active:1}]);assert.deepEqual(state,before);
  assert.deepEqual(ledger.changeInvoiceImport(state,[choice('餐飲')],'2024-02-01').categories,[]);
  assert.throws(()=>ledger.changeInvoiceImport(state,[choice(),choice('不存在','AB00000002')],'2024-02-01'));assert.deepEqual(state,before);
  assert.throws(()=>ledger.changeInvoiceImport({...state,categories:[{name:'發票',active:0}]},[choice()],'2024-02-01'));
});
test('merchant changes validate active category, reject duplicate names and old revisions; independent of expenses',()=>{
  assert.equal(typeof ledger.changeMerchantRule,'function');
  const state=base(),changed=ledger.changeMerchantRule(state,'add',null,null,{merchant:' 合成<img>店 ',category:'餐飲'});
  const row=changed.merchant_rules[0];assert.equal(row.merchant,'合成<img>店');assert.equal(row.revision,0);assert.equal(changed.expenses.length,0);
  assert.throws(()=>ledger.changeMerchantRule(changed,'add',null,null,{merchant:row.merchant,category:'交通'}));
  assert.throws(()=>ledger.changeMerchantRule(changed,'edit',row.id,1,{merchant:'新店',category:'交通'}));
  const edited=ledger.changeMerchantRule(changed,'edit',row.id,0,{merchant:'新店',category:'交通'});assert.equal(edited.merchant_rules[0].revision,1);
  const renamed=ledger.changeCategory(edited,'rename','交通','新交通');assert.equal(renamed.merchant_rules[0].category,'新交通');assert.equal(renamed.merchant_rules[0].revision,2);
  assert.equal(ledger.changeMerchantRule(renamed,'remove',row.id,2).merchant_rules.length,0);
  assert.throws(()=>ledger.changeMerchantRule({...state,categories:[{name:'餐飲',active:0}]},'add',null,null,{merchant:'合成店',category:'餐飲'}));
  for(const merchant of ['', 'x'.repeat(201), 'x\n店'])assert.throws(()=>ledger.changeMerchantRule(state,'add',null,null,{merchant,category:'餐飲'}));
});
test('v10 backup retains rules, strict revisions, unique merchant and category references; old versions unchanged',()=>{
  assert.equal(typeof ledger.changeMerchantRule,'function');
  const state=ledger.changeMerchantRule(base(),'add',null,null,{merchant:'合成店',category:'餐飲'}),bundle=portable(state);
  assert.equal(bundle.version,10);assert.deepEqual(writeBackup(readBackup(writeBackup(bundle))),writeBackup(bundle));
  for(const change of [b=>b.data.merchant_rules.push({...b.data.merchant_rules[0],id:'m_other'}),b=>b.data.merchant_rules[0].merchant=' 合成店',b=>b.data.merchant_rules[0].category='missing',b=>b.data.merchant_rules[0].revision=-1,b=>b.version=9]){const broken=structuredClone(bundle);change(broken);assert.throws(()=>writeBackup(broken));}
  for(let version=1;version<=9;version++){const bytes=writeBackup({format:'life-ledger-backup',version,data:emptyData(version)});assert.deepEqual(writeBackup(readBackup(bytes)),bytes);}
  const full=base();full.categories=Array.from({length:99999},(_,i)=>({name:'c'+i,active:1}));metadata(full);
  assert.throws(()=>ledger.changeInvoiceImport(full,[choice()],'2024-02-01'));assert.equal(full.categories.length,99999);
});
