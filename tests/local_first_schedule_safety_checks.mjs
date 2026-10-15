import * as ledger from '../local-first/ledger.mjs';
import {STORES,addState,portable,metadata} from '../local-first/idb.mjs';
import {emptyData,readBackup,writeBackup,MAX_BYTES} from '../local-first/backup.mjs';
import {scheduleItems,scheduleMonth,scheduleModels} from '../local-first/schedule.mjs';
import {monthBudget,searchExpenses,calendarMonth} from '../local-first/browse.mjs';
import {encryptBackup,decryptBackup} from '../local-first/backup-crypto.mjs';

const check=(value,message)=>{if(!value)throw new Error(message);},text=value=>new TextDecoder().decode(value);
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
const bytes=db=>ledger.exportPortableBackup(db).then(text);
async function raw(db){
  const tx=db.transaction(STORES,'readonly'),complete=done(tx);
  const rows=await Promise.all(STORES.map(name=>new Promise((resolve,reject)=>{const q=tx.objectStore(name).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=reject;})));
  await complete;return JSON.stringify(rows,(_key,value)=>typeof value==='bigint'?{bigint:String(value)}:value);
}
async function seed(db,state){const tx=db.transaction(STORES,'readwrite');for(const section of STORES)tx.objectStore(section).clear();addState(tx,state);await done(tx);}
function fault(db,abort,method='put'){
  const wrapped={name:db.name,injected:false,transaction(...args){const tx=db.transaction(...args),get=tx.objectStore.bind(tx);let writes=0;
    tx.objectStore=name=>{const store=get(name),write=store[method].bind(store);store[method]=(...values)=>{
      const q=write(...values);if(++writes===2){wrapped.injected=true;if(abort)q.addEventListener('success',()=>tx.abort());else throw new DOMException('PRIVATE-DETAIL','QuotaExceededError');}return q;
    };return store;};return tx;}};return wrapped;
}
async function rejectFault(db,abort,operation){const damaged=fault(db,abort);await unchanged(db,()=>operation(damaged));check(damaged.injected,'Safety fault never reached a native write');}
async function unchanged(db,operation,code){
  const before=await raw(db),backup=await bytes(db);let failure;
  try{await operation();}catch(error){failure=error;}
  check(failure&&(!code||failure.code===code)&&!failure.message.includes('PRIVATE-DETAIL'),'Expected safe '+(code||'write')+' refusal; got '+(failure?.code??failure?.constructor.name??'success'));
  check(await raw(db)===before&&await bytes(db)===backup,'Rejected transaction changed raw rows, metadata or backup');
}

// Retired writers must stay closed; their safety cases now exercise real per-period transactions.
export async function scheduleSafety(kinds){
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolated source required');
  const run=crypto.randomUUID(),lines=[],today=ledger.taiwanToday();
  const shift=days=>new Date(new Date(today+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10);
  const input=kind=>({kind,name:'<img src=x onerror=alert(1)>合成'+kind,amount:'.29',category:'餐飲',payment_source_id:'p_cash',first_due_on:today,unit:'day',every:1,periods:kind==='分期'?3:0});
  const db=await ledger.openDatabase('schedule-safety-'+run),peer=await ledger.openDatabase(db.name);
  let target;
  try{
    await ledger.initializeLedger(db);
    const fixture=new Uint8Array(await(await fetch('/tests/fixtures/portable_life_ledger.json')).arrayBuffer());
    const imported={format:'local-first-test-ledger',version:11,owner:'local-test-owner',...emptyData(10),...readBackup(fixture).data};
    await seed(db,imported);const importedBytes=await bytes(db),importedRaw=await raw(db);
    for(const op of ['add','update','sync','stop']){
      await unchanged(db,()=>ledger.updateFixed(db,op,'retired',0,{}),'unavailable');
      await unchanged(db,()=>ledger.updateRecurring(db,op,'retired',0,{}),'unavailable');
    }
    for(const op of ['add','update','disable'])await unchanged(db,()=>ledger.updateAnnual(db,op,'retired',0,{}),'unavailable');
    for(const op of ['record','skip'])await unchanged(db,()=>ledger.processAnnual(db,op,'retired',2026,0,null,{}),'unavailable');
    scheduleItems(await ledger.readLedger(db),today);
    check(await bytes(db)===importedBytes&&await raw(db)===importedRaw,'Legacy viewing or refusal rewrote original fixture');
    let historicalPeriods=0;
    for(const model of scheduleModels(await ledger.readLedger(db)))for(const item of model.known.values()){
      if(item.status!=='recorded'||item.defaults.due_on>today)continue;
      await unchanged(db,()=>ledger.processSchedule(db,'record',model.root.id,item.index,model.root.revision,item.revision),'unavailable');
      historicalPeriods++;
    }
    check(historicalPeriods>0,'Legacy handled-period fixture did not exercise current duplicate protection');
    lines.push('all retired operations refused; original nine-section large IDs/revisions/zero/history/order and raw metadata exact');
    if(kinds.includes('年度費用')){
      const past={format:'local-first-test-ledger',version:4,owner:'local-test-owner',...emptyData(3),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
      const oldForm={name:'合成舊年度',amount:'1200.01',category:'餐飲',payment_source_id:'p_cash',first_year:Number(today.slice(0,4)),due_month:Number(today.slice(5,7)),due_day:31};
      const legacy=ledger.changeAnnual(past,'add','y_old',null,oldForm,today);
      await seed(db,legacy);const payload=await ledger.exportPortableBackup(db),legacyBytes=text(payload);
      check(readBackup(payload).version===3&&Object.keys(readBackup(payload).data).length===15,'Legacy annual v3 data omitted');
      const oldExpense={spent_on:today,amount:'.29',note:'合成年度實付',category:'餐飲',payment_source_id:'p_cash'};
      for(const op of ['record','skip'])await unchanged(db,()=>ledger.processAnnual(db,op,'y_old',Number(today.slice(0,4)),0,null,oldExpense),'unavailable');
      for(const op of ['update','disable'])await unchanged(db,()=>ledger.updateAnnual(db,op,'y_old',0,oldForm),'unavailable');
      check(text(await decryptBackup(await encryptBackup(payload,'synthetic-old-annual-password'),'synthetic-old-annual-password'))===legacyBytes,'Legacy annual encryption changed bytes');
      target=await ledger.openDatabase('old-annual-restore-'+run);Object.defineProperty(target,'name',{value:ledger.DB_NAME+'-portable-checks'});
      for(const abort of [false,true]){const damaged=fault(target,abort,'add');await unchangedBlankRestore(target,()=>ledger.restorePortableBackup(damaged,payload));check(damaged.injected,'Old annual restore fault did not execute');}
      await ledger.restorePortableBackup(target,payload);check(await bytes(target)===legacyBytes,'Legacy annual fifteen-section restore changed bytes');target.close();target=null;
      lines.push('legacy annual JSON v3/fifteen sections encrypted and atomic restore exact, quota/request-success abort leave blank');
    }

    for(const kind of kinds){
      const blank={format:'local-first-test-ledger',version:11,owner:'local-test-owner',...emptyData(10),payment_sources:[{id:'p_cash',name:'現金',active:1},{id:'p_none',name:'未指定',active:1}]};
      await seed(db,blank);const form=input(kind),id='r_one';
      for(const abort of [false,true])await rejectFault(db,abort,damaged=>ledger.updateSchedule(damaged,'add',id,null,form));
      await ledger.updateSchedule(db,'add',id,null,form);const base=await ledger.readLedger(db);
      check(base.expenses.length===0&&base.actions.length===0,'Rule creation implicitly posted');
      const before=await raw(db);scheduleItems(base,today);scheduleMonth(base,today.slice(0,7),today);check(await raw(db)===before,'Readonly schedule view wrote');
      for(const abort of [false,true]){
        await rejectFault(db,abort,damaged=>ledger.updateSchedule(damaged,'update',id,0,{...form,first_due_on:shift(1)}));
        await rejectFault(db,abort,damaged=>ledger.updateSchedule(damaged,'disable',id,0));
        for(const op of ['record','skip'])await rejectFault(db,abort,damaged=>ledger.processSchedule(damaged,op,id,0,0,null));
      }
      await ledger.processSchedule(db,'skip',id,0,0,null);
      await unchanged(db,()=>ledger.processSchedule(db,'skip',id,0,0,0),'unavailable');
      for(const abort of [false,true])await rejectFault(db,abort,damaged=>ledger.processSchedule(damaged,'resume',id,0,0,0));
      const resumed=await ledger.processSchedule(db,'resume',id,0,0,0);
      check(resumed.scheduled_periods[0].status==='pending'&&resumed.scheduled_periods[0].revision===1,'Resume did not retain and revise the opened period');
      await seed(db,base);
      await unchanged(db,()=>ledger.processSchedule(db,'record',id,1,0,null),'unavailable');
      const race=await Promise.allSettled([ledger.processSchedule(db,'record',id,0,0,null),ledger.processSchedule(peer,'record',id,0,0,null)]);
      check(race.filter(row=>row.status==='fulfilled').length===1,'Two connections duplicated period');
      let state=await ledger.readLedger(db);check(state.expenses.length===1&&state.actions.length===1&&state.scheduled_periods.length===1,'Incomplete expense/action/period');
      const entry=state.expenses[0];
      await ledger.editExpense(db,entry.id,0,{spent_on:entry.spent_on,amount:'.31',note:'合成實付',category:'餐飲',payment_source_id:''},today);
      await ledger.voidExpense(db,entry.id,1);
      await unchanged(db,()=>ledger.processSchedule(peer,'record',id,0,0,0),'unavailable');
      const editRace=await Promise.allSettled([ledger.updateSchedule(db,'update',id,0,{...form,first_due_on:shift(1),amount:'.37'}),ledger.updateSchedule(peer,'disable',id,0)]);
      check(editRace.filter(row=>row.status==='fulfilled').length===1,'Same revision had multiple winners');
      await unchanged(db,()=>ledger.updateSchedule(db,'update',id,0,{...form,first_due_on:shift(2)}));
      await seed(db,base);
      await ledger.updateSchedule(db,'update',id,0,{...form,first_due_on:shift(1),amount:'.37'});
      state=await ledger.updateSchedule(db,'update',id,1,{...form,first_due_on:shift(2),amount:'.41'});
      check(state.recurring_versions.length===2&&state.recurring_versions.filter(row=>row.from_index===1).length===1&&state.scheduled_periods[0].defaults.cents==='29','Future edit duplicated version or overwrote opened defaults');
      await ledger.processSchedule(db,'record',id,0,2,0);
      state=await ledger.readLedger(db);check(state.expenses[0].cents==='29','Already-opened period used changed future amount');
      state=await ledger.readLedger(db);const exact=await bytes(db),readBefore=await raw(db),month=today.slice(0,7);
      const total=monthBudget(state,today).spent;
      check(searchExpenses(state,{keyword:'',start:month+'-01',end:today},today).reduce((sum,row)=>sum+BigInt(row.cents),0n)===total,'Search/budget totals differ');
      check(calendarMonth(state,month,today).days.reduce((sum,row)=>sum+row.total,0n)===total,'Calendar/budget totals differ');
      check(await bytes(db)===exact&&await raw(db)===readBefore,'Readonly aggregate wrote');
      const payload=await ledger.exportPortableBackup(db),encrypted=await encryptBackup(payload,'synthetic-safety-password');
      check(text(await decryptBackup(encrypted,'synthetic-safety-password'))===exact,'Encrypted bytes changed');
      const damaged=encrypted.slice();damaged[damaged.length-1]^=1;
      for(const[file,password]of [[encrypted,'wrong-password'],[damaged,'synthetic-safety-password']]){let refused=false;try{await decryptBackup(file,password);}catch{refused=true;}check(refused,'Wrong password or damaged backup accepted');}
      target=await ledger.openDatabase('schedule-restore-'+run+'-'+kind);Object.defineProperty(target,'name',{value:ledger.DB_NAME+'-portable-checks'});
      for(const abort of [false,true]){const damaged=fault(target,abort,'add');await unchangedBlankRestore(target,()=>ledger.restorePortableBackup(damaged,payload));check(damaged.injected,'Restore fault did not reach add');}
      await ledger.restorePortableBackup(target,payload);check(await bytes(target)===exact,'Restore changed all sections/order');
      await unchanged(target,()=>ledger.restorePortableBackup(target,payload),'nonempty');
      target.close();target=await ledger.openDatabase('schedule-restore-'+run+'-'+kind);check(await bytes(target)===exact,'Reopen changed restored data');target.close();target=null;
      lines.push(kind+': add/update/disable/record/skip/resume quota and request-success abort; future/duplicate/stale races; edited/voided period cannot revive; readonly totals and encrypted restore/reopen exact');

      await seed(db,base);state=await ledger.updateSchedule(db,'disable',id,0);
      check(state.expenses.length===0&&state.scheduled_periods[0].status==='pending'&&state.scheduled_periods[0].defaults.cents==='29','Disable posted or lost an opened due draft');
      state=await ledger.processSchedule(db,'record',id,0,1,0);
      check(state.expenses.length===1&&state.expenses[0].cents==='29','Disabled rule lost its explicitly processable opened period');

      const cap=ledger.changeSchedule(blank,'add',id,null,form,today);
      cap.categories=Array.from({length:100000-metadata(cap).row_count-3},(_,i)=>({name:'c'+i,active:0}));
      await seed(db,cap);await ledger.processSchedule(db,'record',id,0,0,null);
      check(metadata(await ledger.readLedger(db)).row_count===100000,'Exact 100000-row record boundary refused');
      await unchanged(db,()=>ledger.updateSchedule(db,'add','r_over',null,form));
      await ledger.updateSchedule(db,'disable',id,0);check((await ledger.readLedger(db)).expenses.length===1,'Disable at row limit posted');
      lines.push(kind+': exact row limit commits complete expense/action/period and disable; excess rule leaves all rows/meta unchanged');
    }
    await verifyQueuedClock(db,kinds,lines);
    if(kinds.includes('固定'))await verifyByteLimit(db,input('固定'),today,lines);
    await seed(db,imported);target=await ledger.openDatabase('legacy-restore-'+run);Object.defineProperty(target,'name',{value:ledger.DB_NAME+'-portable-checks'});
    await ledger.restorePortableBackup(target,fixture);check(await bytes(target)===importedBytes,'Legacy v1 full fixture changed on restore');
    const restored=await ledger.readLedger(target);check(restored.expenses.some(row=>row.payment_source_id===null),'Legacy null payment lost');
    target.close();target=null;lines.push('legacy v1 blank restore retains complete original bytes and null historical payments');
    const invalid=db.transaction('recurring_rules','readwrite'),rule=imported.recurring_rules[0];
    invalid.objectStore('recurring_rules').put({key:rule.id,position:0,value:{...rule,cents:'broken'}});await done(invalid);
    const corruptRows=await raw(db);let failure;
    try{await ledger.updateSchedule(db,'disable',rule.id,rule.revision);}catch(error){failure=error;}
    check(failure?.code==='storage'&&!failure.message.includes('broken')&&await raw(db)===corruptRows,'Corrupt persisted rule was repaired, exposed or overwritten');
    lines.push('corrupt persisted rule refused with safe error and every original raw row unchanged');
    return lines;
  }finally{db.close();peer.close();target?.close();}
}
async function unchangedBlankRestore(db,operation){
  const before=await raw(db);let rejected=false;try{await operation();}catch{rejected=true;}
  check(rejected&&await raw(db)===before&&await ledger.readLedgerIfPresent(db)===null,'Failed restore left partial raw rows/metadata');
}
async function verifyQueuedClock(db,kinds,lines){
  const NativeDate=Date;let instant='2027-12-31T15:59:59Z';
  globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}};
  try{for(const kind of kinds){
    instant='2027-12-31T15:59:59Z';
    const blank={format:'local-first-test-ledger',version:11,owner:'local-test-owner',...emptyData(10),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
    const form={kind,name:'合成跨年',amount:'.29',category:'餐飲',payment_source_id:'p_cash',first_due_on:'2028-01-01',unit:'day',every:1,periods:kind==='分期'?3:0};
    await seed(db,ledger.changeSchedule(blank,'add','r_clock',null,form,'2027-12-31'));
    const blocker=db.transaction(STORES,'readwrite');blocker.objectStore('meta').get('created').onsuccess=()=>{instant='2027-12-31T16:00:00Z';};
    const queued=ledger.updateSchedule(db,'update','r_clock',0,{...form,first_due_on:'2028-01-02'});await done(blocker);const changed=await queued;
    check(changed.recurring_versions.at(-1).from_index===1&&changed.scheduled_periods[0].defaults.due_on==='2028-01-01','Queued update used caller/pre-transaction Taiwan clock');
  }}finally{globalThis.Date=NativeDate;}
  lines.push('queued changes use Taiwan clock inside native transaction across midnight/year, preserving newly-due defaults');
}
async function verifyByteLimit(db,form,today,lines){
  let large=ledger.changeSchedule({format:'local-first-test-ledger',version:11,owner:'local-test-owner',...emptyData(10),payment_sources:[{id:'p_cash',name:'現金',active:1}]},'add','r_large',null,form,today);
  large=ledger.changeSchedule(large,'add','r_sub',null,{...form,kind:'訂閱'},today);
  const expense={id:'e0',spent_on:today,cents:'1',category:'餐飲',note:'字'.repeat(4096),source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:null,payment_source_name:'未指定',kind:'consumption',revision:0};
  large.expenses=Array.from({length:5350},(_,i)=>({...expense,id:'e'+i}));let size=writeBackup(portable(large)).byteLength;
  const overhead=JSON.stringify({...expense,id:'epad',note:''}).length+1;
  while(MAX_BYTES-size>=overhead){const id='epad'+large.expenses.length,cost=new TextEncoder().encode(JSON.stringify({...expense,id,note:''})).byteLength+1;if(MAX_BYTES-size<cost)break;const note='x'.repeat(Math.min(4096,MAX_BYTES-size-cost));large.expenses.push({...expense,id,note});size+=cost+note.length;}
  const padding=MAX_BYTES-size,last=large.expenses.at(-1);check(last.note.length>=padding,'Fixture padding');last.note='é'.repeat(padding)+last.note.slice(padding);
  check(writeBackup(portable(large)).byteLength===MAX_BYTES,'Exact 64MiB byte boundary');await seed(db,large);
  await unchanged(db,()=>ledger.editExpense(db,'e0',0,{amount:'.31',note:'容量上限',spent_on:today,category:'餐飲',payment_source_id:''},today),'limit');
  await unchanged(db,()=>ledger.voidExpense(db,'e0',0),'limit');
  await unchanged(db,()=>ledger.processSchedule(db,'record','r_large',0,0,null),'storage');
  await unchanged(db,()=>ledger.updateSchedule(db,'disable','r_large',0),'storage');
  const tomorrow=new Date(new Date(today+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
  await unchanged(db,()=>ledger.updateSchedule(db,'update','r_large',0,{...form,first_due_on:tomorrow,amount:'.31'}),'storage');
  await unchanged(db,()=>ledger.updateSchedule(db,'update','r_sub',0,{...form,kind:'訂閱',first_due_on:tomorrow,amount:'.31'}),'storage');
  lines.push('64MiB exact UTF-8 boundary: edit/void/record/disable/update refuse without partial rows, metadata, history or stopped rule');
}
