import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('UI timeout');};
const params=new URLSearchParams(location.search),run=params.get('run'),role=params.get('role');
if(!/^[a-z0-9-]{8,64}$/.test(run)||!['a','b'].includes(role)||Number(location.port)<19000)throw new Error('Use a fresh synthetic test run');
const name=ledger.DB_NAME+'-edit-snapshot-'+run,open=indexedDB.open.bind(indexedDB);
indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const report=document.createElement('pre');report.id='edit-snapshot-result';document.body.prepend(report);
const lines=[],channel=new BroadcastChannel('edit-snapshot-'+run),db=await ledger.openDatabase(),today=ledger.taiwanToday();
const done=message=>{lines.push(message);report.textContent=lines.join('\n');};
const raw=async()=>{const tx=db.transaction(STORES,'readonly'),rows={};for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const tracked='e_f01_tracked',added='e_f01_added',bare='e_f01_bare';
const usage=days=>({started_on:today,days,remind:1,reminder_days:7,show_daily_cost:1,active:1});
const editFresh=async id=>{
  const entry=(await ledger.readLedger(db)).expenses.find(row=>row.id===id);
  q('[data-view-button="record"]').click();q('#home-search-keyword').value=entry.note;
  q('#view-record [data-search-open]').click();
  await wait(()=>q('#search-progress').textContent===''&&q('#search-results [data-expense-id="'+id+'"]'));
  q('#search-accounts').open=true;q('#search-results [data-expense-id="'+id+'"] [data-batch-id]').click();q('#batch-edit').click();
};
const submit=async()=>{q('#expense-form').requestSubmit();await wait(()=>!q('#fields').disabled&&!q('#status').textContent.includes('正在儲存'));};
try{
  if(role==='a'){
    check(await ledger.readLedgerIfPresent(db)===null,'Synthetic database must start blank');
    await ledger.initializeLedger(db);const initial=await ledger.readLedger(db),payment=initial.payment_sources.find(row=>row.name==='現金').id;
    for(const [id,note,days]of [[tracked,'F01 tracked',7],[added,'F01 added',null],[bare,'F01 bare',null]])
      await ledger.addExpense(db,{amount:'1.23',note,category:'餐飲',payment_source_id:payment,spent_on:today,...(days?{usage:usage(days)}:{}),tags:{ids:[],names:['舊標籤']}},today,id);
  }
  await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  const form=q('#expense-form');
  if(role==='b'){
    channel.onmessage=async event=>{
      const {request,id,days,note}=event.data;if(!request)return;
      try{await editFresh(id);form.elements.usage_days.value=String(days);form.elements.usage_started_on.value=today;
        form.elements.usage_remind.checked=true;form.elements.note.value=note;
        q('#tag-input').value='新標籤';q('#tag-draft-add').click();await submit();
        check(q('#status').textContent.includes('儲存完成'),'Second-tab form did not commit');
        channel.postMessage({request,ok:true});done('PASS B real form '+id+' '+days+' days');
      }catch(failure){channel.postMessage({request,error:failure.message});done('FAIL B '+failure.message);}
    };
    channel.postMessage({ready:true});done('READY B: real second product page');
  }else{
    const pending=new Map();let ready=false;
    channel.onmessage=event=>{if(event.data.ready)ready=true;else if(pending.has(event.data.request)){pending.get(event.data.request)(event.data);pending.delete(event.data.request);}};
    const external=async(id,days,note)=>{const request=crypto.randomUUID();const reply=new Promise(resolve=>pending.set(request,resolve));channel.postMessage({request,id,days,note});const result=await Promise.race([reply,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Second tab timeout')),12000))]);check(result.ok,result.error);};
    done('READY A: open role=b with the same run in a second tab');await wait(()=>ready);
    form.elements.amount.value='9.87';form.elements.note.value='原本未送出草稿';form.elements.usage_days.value='45';q('#tag-input').value='草稿標籤';
    await external(tracked,30,'F01 latest 30');await editFresh(tracked);
    check(q('#tag-selected').textContent.includes('新標籤'),'Fresh tags not loaded');
    form.elements.note.value='F01 note only';await submit();
    let state=await ledger.readLedger(db);
    check(state.usage_periods.find(row=>row.expense_id===tracked).days===30,'F01: note-only edit overwrote fresh 30-day usage');
    check(state.expense_tags.filter(row=>row.expense_id===tracked).length===2,'Fresh tags rolled back');
    check(form.elements.note.value==='原本未送出草稿'&&form.elements.usage_days.value==='45'&&q('#tag-input').value==='草稿標籤','Successful edit lost original draft');
    done('PASS fresh 30-day snapshot, note-only write, tags and original draft return');
    await external(added,30,'F01 added by B');await editFresh(added);
    check(form.elements.usage_days.value==='30'&&!q('#usage-stop').hidden,'Newly added usage missing');
    form.elements.spent_on.value='2024-01-01';form.elements.spent_on.dispatchEvent(new Event('change'));
    check(form.elements.usage_started_on.value===today,'Existing fresh usage followed edited expense date');
    form.elements.spent_on.value=today;q('#usage-stop').click();await submit();
    check((await ledger.readLedger(db)).usage_periods.find(row=>row.expense_id===added).active===0,'Stop tracking ignored displayed fresh usage');
    done('PASS externally added usage, saved start-date rule and stop tracking');
    await editFresh(bare);form.elements.spent_on.value='2024-01-01';form.elements.spent_on.dispatchEvent(new Event('change'));
    check(form.elements.usage_started_on.value==='2024-01-01','Missing usage did not follow expense date');
    form.elements.usage_started_on.value='2024-01-02';form.elements.usage_started_on.dispatchEvent(new Event('input'));
    form.elements.spent_on.value='2024-01-03';form.elements.spent_on.dispatchEvent(new Event('change'));
    check(form.elements.usage_started_on.value==='2024-01-02','Explicit usage start was overwritten');q('#cancel-edit').click();
    check(form.elements.note.value==='原本未送出草稿'&&form.elements.usage_days.value==='45','Cancel lost original draft');
    done('PASS no-usage and manually chosen date rules, cancel restores original draft');
    await editFresh(tracked);await external(tracked,40,'F01 changed during editing');
    const before=await raw();form.elements.note.value='F01 rejected stale draft';form.elements.usage_days.value='35';await submit();
    check(q('#error').textContent.includes('重新載入')&&await raw()===before,'Stale edit bypassed revision or changed data');
    check(form.elements.note.value==='F01 rejected stale draft'&&form.elements.usage_days.value==='35'&&q('#tag-selected').textContent.includes('新標籤'),'Conflict lost edit inputs');q('#cancel-edit').click();
    done('PASS actual two-tab later edit rejects stale revision, exact raw rollback and draft retention');
    await editFresh(tracked);form.elements.note.value='F01 quota draft';form.elements.usage_days.value='26';
    const quotaBefore=await raw(),put=IDBObjectStore.prototype.put;let injected=false;
    IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name===name){injected=true;throw new DOMException('private-test-detail','QuotaExceededError');}return put.apply(this,args);};
    try{await submit();}finally{IDBObjectStore.prototype.put=put;}
    check(injected&&await raw()===quotaBefore&&!q('#fields').disabled,'Failed write changed data or locked ordinary retry');
    check(form.elements.note.value==='F01 quota draft'&&form.elements.usage_days.value==='26'&&q('#tag-selected').textContent.includes('新標籤'),'Quota failure lost form inputs');q('#cancel-edit').click();
    check(form.elements.note.value==='原本未送出草稿'&&q('#tag-input').value==='草稿標籤','Failed-edit cancel lost original draft');
    done('PASS real native write failure preserves data, edit inputs, tags and cancelled draft');
    report.dataset.done='pass';report.textContent='PASS F01 '+lines.filter(line=>line.startsWith('PASS')).length+' groups\n'+lines.join('\n');
  }
}catch(failure){report.dataset.done='fail';report.textContent='FAIL F01: '+failure.message+'\n'+lines.join('\n');}
window.addEventListener('pagehide',()=>{db.close();channel.close();});
