import * as ledger from '../local-first/ledger.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Recurring income UI timeout');};
const report=document.createElement('pre');report.id='recurring-income-result';document.body.prepend(report);
const open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-recurring-income-ui-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),today=ledger.taiwanToday(),month=today.slice(0,7),lines=[];
await ledger.initializeLedger(db);const before=await ledger.exportPortableBackup(db);
const confirm=window.confirm;window.confirm=()=>true;
try{
  await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  check(q('#income-recurring')&&!q('#income-recurring').open,'Missing optional recurring income management');
  q('[data-view-button="planning"]').click();q('#income-planning').open=true;await wait(()=>q('#allocation-items').children.length===1);q('#income-recurring').open=true;
  check(new TextDecoder().decode(await ledger.exportPortableBackup(db))===new TextDecoder().decode(before),'Opening planning writes');
  const form=q('#income-rule-form');for(const [key,value]of Object.entries({name:'合成<img src=x onerror=alert(1)>月薪',amount:'.29',first_due_on:month+'-01',due_day:'1'}))form.elements[key].value=value;form.requestSubmit();await wait(()=>q('#income-rule-list li'));
  check(!q('#income-rule-list img')&&(await ledger.readLedger(db)).incomes.length===0,'Rule creation posts real income or XSS');lines.push('optional monthly rule creates no income; unsafe name is text');
  q('[data-view-button="record"]').click();q('#record-income-choice').click();q('#view-record a[href="#planning-pending"]').click();await wait(()=>q('#pending-income [data-status="pending"]'));
  q('#pending-income [data-status="pending"] [data-income-operation="skip"]').click();await wait(()=>q('#income-periods [data-status="skipped"]'));
  q('#income-periods').closest('details').open=true;q('#income-periods [data-status="skipped"] button').click();await wait(()=>q('#pending-income [data-status="pending"]'));
  check((await ledger.readLedger(db)).incomes.length===0,'Skip/restoration posts');lines.push('skip and restore only change this period, never received total');
  q('#pending-income [data-income-operation="edit"]').click();const income=q('#income-form');income.elements.amount.value='.31';income.elements.name.value='合成實收';income.requestSubmit();await wait(()=>q('#income-record-summary').textContent.includes('0.31 元'));
  check(q('#income-periods [data-status="recorded"]')&&(await ledger.readLedger(db)).incomes.length===1,'Receipt and status not atomic');lines.push('existing income form edits draft; confirmation creates one receipt and recorded status');
  check(q('#income-periods [data-status="recorded"]').textContent.includes('預定 0.29 元')&&q('#income-periods [data-status="recorded"]').textContent.includes('實收 0.31 元'),'Recorded amount confuses draft with actual receipt');
  q('#income-list li button:last-child').click();q('#confirm-income-void').click();await wait(()=>q('#income-record-summary').textContent.includes('0 元'));check(q('#income-periods [data-status="recorded"]')&&!q('#income-periods [data-income-operation="record"]'),'Voided receipt reappeared');lines.push('soft void excludes receipt, period remains recorded and cannot revive');
  q('[data-view-button="planning"]').click();q('#income-rule-list button').click();form.elements.amount.value='.32';form.requestSubmit();await wait(()=>q('#income-rule-list').textContent.includes('0.32 元'));
  check((await ledger.readLedger(db)).incomes[0].cents==='31','Rule edit rewrote receipt');lines.push('future edits preserve previous receipt and formed defaults');
  report.textContent='PASS：'+lines.length+' 組定期收入畫面\n'+lines.join('\n');
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{window.confirm=confirm;db.close();}
