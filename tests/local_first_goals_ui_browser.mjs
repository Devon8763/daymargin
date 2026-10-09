import * as ledger from '../local-first/ledger.mjs';
const q=selector=>document.querySelector(selector),check=(v,m)=>{if(!v)throw new Error(m);};
const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw new Error('UI timeout');};
const report=document.createElement('pre');report.id='goal-ui-result';document.body.prepend(report);
const runId=sessionStorage.getItem('goal-ui-run')||crypto.randomUUID(),reloadKey='goal-ui-reload';sessionStorage.setItem('goal-ui-run',runId);
const resuming=sessionStorage.getItem(reloadKey)===runId,open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-goals-ui-'+runId;indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
const db=await ledger.openDatabase(),lines=[];await ledger.initializeLedger(db);
const bytes=()=>ledger.exportPortableBackup(db).then(value=>new TextDecoder().decode(value));
try {
  await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  if(resuming){
    sessionStorage.removeItem(reloadKey);q('[data-view-button="planning"]').click();q('#income-planning').open=true;await wait(()=>q('#allocation-items [data-field="goal_id"]'));
    const expectedId=sessionStorage.getItem('goal-ui-id'),expectedBackup=sessionStorage.getItem('goal-ui-backup'),saved=await ledger.readLedger(db),goal=saved.goals.find(row=>row.id===expectedId),select=q('#allocation-items [data-field="goal_id"]'),option=[...select.options].find(row=>row.value===expectedId);
    check(goal&&select.value===expectedId&&saved.monthly_allocations.find(row=>row.month===ledger.taiwanToday().slice(0,7))?.items.some(row=>row.goal_id===expectedId),'Page reload lost the saved goal ID');
    check(option?.textContent===goal.name+(goal.completed?'（已完成）':'')&&!option.textContent.includes(expectedId)&&!select.querySelector('img')&&await bytes()===expectedBackup,'Reloaded goal choice, safe text, or backup changed');
    sessionStorage.removeItem('goal-ui-run');sessionStorage.removeItem('goal-ui-id');sessionStorage.removeItem('goal-ui-backup');lines.push('full page reload restores the saved goal ID, readable completed state and exact backup');
    report.textContent='PASS：'+lines.length+' 組目標畫面\n'+lines.join('\n');
  } else {
  check(q('#goal-planning')&&!q('#goal-planning').open&&q('#goal-planning').closest('#view-planning')&&!q('#view-record').hidden,'optional collapsed goals missing');
  const before=await bytes();q('[data-view-button="planning"]').click();q('#goal-planning').open=true;check(await bytes()===before,'opening goals writes');
  lines.push('record remains default; goals are optional collapsed planning section; opening is readonly');
  const form=q('#goal-form');form.elements.name.value='<img src=x onerror=alert(1)>合成目標';form.elements.target_amount.value='100';form.elements.saved_amount.value='0';form.requestSubmit();await wait(()=>q('#goal-list li[data-goal-id]'));
  check(q('#goal-list').textContent.includes('0／100 元')&&!q('#goal-list img'),'goal display or XSS');
  const goal=(await ledger.readLedger(db)).goals[0],beforeChoices=await bytes();q('#income-planning').open=true;await wait(()=>q('#allocation-items [data-field="goal_id"]'));
  const select=q('#allocation-items [data-field="goal_id"]'),firstChoice=[...select.options].find(option=>option.value===goal.id);
  check(firstChoice?.textContent===goal.name&&firstChoice.value===goal.id&&!q('#allocation-items select img')&&await bytes()===beforeChoices,'Goal choice exposes internal ID, parses its name as HTML, or changes the backup');
  q('#allocation-items [data-field="amount"]').value='.29';q('#allocation-items [data-field="amount"]').dispatchEvent(new Event('input',{bubbles:true}));q('#allocation-items [data-field="goal_id"]').value=goal.id;
  form.elements.name.value=goal.name;form.elements.target_amount.value='50';form.requestSubmit();await wait(()=>q('#goal-list').children.length===2&&!q('#goal-fields').disabled);
  const second=(await ledger.readLedger(db)).goals.find(row=>row.id!==goal.id),choices=[...select.options].filter(option=>option.value);
  check(select.value===goal.id&&choices.find(option=>option.value===goal.id)?.textContent.includes('100 元')&&choices.find(option=>option.value===second.id)?.textContent.includes('50 元')&&choices.every(option=>!option.textContent.includes(option.value)),'Duplicate goal names are ambiguous or option values changed');
  check(q('#allocation-items [data-field="amount"]').value==='.29'&&q('#allocation-items [data-field="goal_id"]').value===goal.id&&q('#allocation-items [data-field="goal_id"]').options.length===3,'Goal creation lost draft or stale choices');
  lines.push('creating another goal preserves unsaved allocation fields and refreshes explicit ID choices');
  q('#allocation-form').requestSubmit();await wait(()=>q('#goal-list').textContent.includes('0.29／100 元'));
  let state=await ledger.readLedger(db),count=state.goal_actions.length;q('#allocation-form').requestSubmit();await wait(()=>q('#income-fields').disabled===false);await new Promise(r=>setTimeout(r,50));check((await ledger.readLedger(db)).goal_actions.length===count,'repeat counted twice');
  q('#income-month-form').requestSubmit();await wait(()=>q('#income-fields').disabled===false);check(q('#allocation-items [data-field="goal_id"]').value===goal.id&&(await ledger.readLedger(db)).monthly_allocations.find(row=>row.month===ledger.taiwanToday().slice(0,7)).items.some(row=>row.goal_id===goal.id),'Reloaded allocation lost its goal ID');
  check(q('#income-summary').textContent.includes('超出本月收入')&&(await ledger.readLedger(db)).expenses.length===0,'goal link became money flow');lines.push('explicit allocation ID adds precise delta only; repeated save is not double-counted and zero-income plan remains allowed');
  q('#goal-list button').click();form.elements.name.value='更名後目標';form.elements.saved_amount.value='.10';form.requestSubmit();await wait(()=>q('#goal-list').textContent.includes('0.1／100 元'));
  const renamed=[...q('#allocation-items [data-field="goal_id"]').options].find(option=>option.value===goal.id);check(renamed?.textContent==='更名後目標','Changing a goal did not refresh its visible allocation choice');
  q('#allocation-items [data-field="amount"]').value='0';q('#allocation-form').requestSubmit();await wait(()=>q('#income-error').textContent.includes('低於 0'));check(q('#allocation-items [data-field="amount"]').value==='0'&&(await ledger.readLedger(db)).goals[0].saved_cents==='10','underflow partially applied');
  lines.push('manual correction records total; later negative allocation difference rejects and keeps draft');
  q('#goal-list button').click();form.elements.saved_amount.value='120';form.elements.deadline.value=ledger.taiwanToday();form.requestSubmit();await wait(()=>q('#goal-list').textContent.includes('120／100 元'));
  check(q('#goal-list progress').value===100&&q('#goal-list').textContent.includes('期限已到'),'progress cap or reminder');check((await ledger.readLedger(db)).goals[0].completed===0,'automatic completion');
  q('#goal-list button').click();form.elements.completed.checked=true;form.requestSubmit();await wait(()=>q('#goal-list').textContent.includes('已完成'));check(q('#goal-list details').textContent.includes('手動校正'),'adjustment history missing');
  const completedChoice=[...q('#allocation-items [data-field="goal_id"]').options].find(option=>option.value===goal.id);check(completedChoice?.textContent==='更名後目標（已完成）','Completed goal lost its visible state or exposed ID');lines.push('oversaving displays true amount with capped progress; deadline and completion remain explicit; adjustments readable');
  const peer=await ledger.openDatabase();state=await ledger.readLedger(peer);q('#goal-list button').click();await ledger.updateGoal(peer,'update',goal.id,state.goals[0].revision,{name:'另一頁合成',target_amount:'100',saved_amount:'120',deadline:'',remind:0,completed:1});const peerBytes=await bytes();form.elements.name.value='我的草稿';form.requestSubmit();await wait(()=>q('#goal-error').textContent.includes('已變更'));check(form.elements.name.value==='我的草稿'&&await bytes()===peerBytes,'peer overwritten');peer.close();lines.push('stale goal revision refuses overwrite and preserves draft');
  const tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const result=tx.apply(this,args);if(this.name===name&&args[1]==='readwrite'){const store=result.objectStore.bind(result);result.objectStore=key=>{const value=store(key);value.put=()=>{throw new DOMException('synthetic-private','QuotaExceededError');};return value;};}return result;};
  q('#goal-cancel').click();form.elements.name.value='故障草稿';form.elements.target_amount.value='1';form.requestSubmit();await wait(()=>q('#goal-error').textContent.length>0);IDBDatabase.prototype.transaction=tx;check(form.elements.name.value==='故障草稿'&&!q('#goal-error').textContent.includes('synthetic-private')&&await bytes()===peerBytes,'quota lost input or partially stored');
  lines.push('quota shows fixed safe error, retains goal draft and rolls back all rows');
  sessionStorage.setItem(reloadKey,runId);sessionStorage.setItem('goal-ui-id',goal.id);sessionStorage.setItem('goal-ui-backup',await bytes());
  report.textContent='PASS：'+lines.length+' 組目標畫面；已儲存重載驗證基準\n'+lines.join('\n');
  }
}catch(error){report.textContent='FAIL：'+error.message+'\n'+lines.join('\n');}finally{db.close();}
