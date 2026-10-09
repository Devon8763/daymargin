import * as ledger from '../local-first/ledger.mjs';
import {STORES} from '../local-first/idb.mjs';
const q=selector=>document.querySelector(selector),check=(value,message)=>{if(!value)throw new Error(message);};
const wait=async predicate=>{for(let n=0;n<300;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Home preferences UI timeout');};
const report=document.createElement('pre');report.id='home-preferences-test-result';document.body.prepend(report);
const mode=new URLSearchParams(location.search).get('case')||'all',key='daymargin.home.v1',open=indexedDB.open.bind(indexedDB),name=ledger.DB_NAME+'-home-preferences-'+crypto.randomUUID();indexedDB.open=(value,version)=>open(value===ledger.DB_NAME?name:value,version);
check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Use an isolated synthetic preview origin');
localStorage.removeItem(key);if(mode==='corrupt')localStorage.setItem(key,'<script>synthetic invalid');
const legacy={version:1,order:['goals','record','budget','search','shortcuts','schedule','ending'],visible:{shortcuts:false,ending:false,budget:true,schedule:false,goals:true},shortcut_count:7,expanded:{shortcuts:true,budget:true,schedule:false,goals:false,ending:true,expenses:true}};
if(mode==='legacy')localStorage.setItem(key,JSON.stringify(legacy));
const db=await ledger.openDatabase();await ledger.initializeLedger(db);const today=ledger.taiwanToday(),payment=(await ledger.readLedger(db)).payment_sources[0].id;
for(let i=0;i<4;i++)await ledger.updateShortcut(db,(await ledger.readLedger(db)).shortcuts,'add','s_home_'+i,{name:'合成捷徑'+i,note:'合成餐點',amount:'.29',category:'餐飲',payment_source_id:payment});
await ledger.addExpense(db,{amount:'.29',note:'合成搜尋',spent_on:today,category:'餐飲',payment_source_id:payment},today,'e_home_preferences');
await ledger.updateBudget(db,(await ledger.readLedger(db)).budgets,'set','總額','100');
const raw=async()=>{const rows={},tx=db.transaction(STORES,'readonly');for(const store of STORES)tx.objectStore(store).getAll().onsuccess=event=>{rows[store]=event.target.result;};await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=reject;});return JSON.stringify(STORES.map(store=>rows[store]),(_key,value)=>typeof value==='bigint'?String(value):value);};
const backup=async()=>new TextDecoder().decode(await ledger.exportPortableBackup(db)),lines=[],nav=view=>q('[data-view-button='+view+']').click();
try{
  const before=await raw(),bytes=await backup();await import('../local-first/page.mjs');await wait(()=>!q('#ledger-page').hidden);
  check(q('#home-edit'),'Missing homepage settings');nav('settings');
  check(q('#home-order [data-block=expenses] [data-visible]')?.checked&&q('#home-order [data-block=calendar] [data-visible]')?.checked,'Expenses/calendar missing from home selection');
  check([...q('#view-settings').querySelectorAll('[data-settings-section]')].map(el=>el.dataset.settingsSection).join(',')==='home,category,payment,tags,data','Wrong settings order');
  q('#data-privacy summary').click();check(q('#data-privacy').textContent.includes('帳本本身未加密')&&!q('#ledger-page').hidden,'Privacy still only navigates away');lines.push('ordered settings; direct privacy reading keeps ledger page');
  q('#expense-form').elements.note.value='未儲存合成草稿';q('#category-add').elements.name.value='分類草稿';
  const transaction=IDBDatabase.prototype.transaction;let protect=true;IDBDatabase.prototype.transaction=function(...args){if(protect&&this.name===name)throw new Error('Preference/navigation touched financial storage');return transaction.apply(this,args);};
  try{
    if(mode==='legacy'){check([...q('#home-order').children].map(row=>row.dataset.block).join(',')==='goals,record,budget,search,shortcuts,schedule,ending,expenses,calendar'&&q('#home-shortcut-count').value==='7','Legacy order/count reset');for(const name of Object.keys(legacy.visible))check(q('#home-order [data-block='+name+'] input').checked===legacy.visible[name],'Legacy visibility reset');for(const name of Object.keys(legacy.expanded))check(q('#home-expanded-'+name).checked===legacy.expanded[name],'Legacy expansion reset');check(q('#expenses-disclosure').open&&localStorage.getItem(key)===JSON.stringify(legacy),'Load migration rewrote storage or dropped expense expansion');lines.push('valid legacy values fully retained without automatic preference write');}
    else if(mode==='corrupt'){check(q('#home-preferences-status').textContent.includes('預設')&&!q('#home-order img'),'Bad preferences did not recover safely');lines.push('corrupt browser preference safely defaults');}
    else {
      check(!q('#home-order [data-block=record] [data-visible]')&&!q('#home-order [data-block=search] [data-visible]'),'Required blocks can be hidden');
      const expenseNode=q('#expenses'),calendarNode=q('#calendar-grid');
      for(const key of ['expenses','calendar']){
        const input=q('#home-order [data-block='+key+'] input');input.checked=false;input.dispatchEvent(new Event('change'));q('#save-home-preferences').click();check(q('[data-home-block='+key+']').hidden&&!q('[data-home-block='+(key==='expenses'?'calendar':'expenses')+']').hidden,'Blocks do not hide independently');
        const enabled=q('#home-order [data-block='+key+'] input');enabled.checked=true;enabled.dispatchEvent(new Event('change'));q('#save-home-preferences').click();check(!q('[data-home-block='+key+']').hidden,'Cannot reveal block');
      }
      q('#home-order [data-block=calendar] [data-move=up]').click();q('#home-order [data-block=calendar] [data-move=up]').click();q('#home-order [data-block=expenses] [data-move=up]').click();q('#save-home-preferences').click();
      const ordered=[...q('#view-record').querySelectorAll('[data-home-block]')];check(ordered.length===9&&new Set(ordered.map(row=>row.dataset.homeBlock)).size===9&&q('#expenses')===expenseNode&&q('#calendar-grid')===calendarNode,'Moving former anchor duplicates/replaces nodes');check(ordered.findIndex(row=>row.dataset.homeBlock==='calendar')<ordered.findIndex(row=>row.dataset.homeBlock==='expenses'),'New blocks failed to swap');lines.push('expense/calendar independently hide/reveal and reorder original nodes');
      for(const input of q('#home-order').querySelectorAll('[data-visible]')){input.checked=false;input.dispatchEvent(new Event('change'));}
      q('#save-home-preferences').click();nav('record');check(!q('[data-home-block=record]').hidden&&!q('[data-home-block=search]').hidden,'Required home blocks vanished');check([...q('#view-record').querySelectorAll('[data-home-block]')].filter(el=>!['search','record'].includes(el.dataset.homeBlock)).every(el=>el.hidden),'Optional blocks not hidden');
      check(q('#expense-form').elements.note.value==='未儲存合成草稿','Home customization erased draft');lines.push('all optional hidden; mandatory record/search and draft remain');
      protect=false;q('#home-search-keyword').value='本月';q('#view-record [data-search-open]').click();await wait(()=>!q('#search-groups').hidden);check(!q('#search-functions').textContent.includes('本月預算')&&!q('#search-functions').textContent.includes('本月定期支出'),'Hidden home feature still leads to invisible target');nav('record');protect=true;lines.push('hidden home projections are not broken feature-search links');
      nav('settings');q('#home-order [data-block=shortcuts] [data-visible]').checked=true;q('#home-order [data-block=shortcuts] [data-visible]').dispatchEvent(new Event('change'));q('#home-shortcut-count').value='4';q('#home-expanded-shortcuts').checked=true;q('#save-home-preferences').click();nav('record');check(q('#shortcut-quick').children.length===4&&!q('#shortcut-settings').open&&JSON.parse(localStorage.getItem(key)).expanded.shortcuts,'Shortcut count/default expansion lost');q('#shortcut-settings').open=true;q('#shortcut-settings').open=false;
      nav('settings');nav('record');check(!q('#shortcut-settings').open,'Navigation forced expansion');lines.push('four shortcuts, one management form and manual disclosure survive');
      nav('settings');const up=q('#home-order [data-block=record] [data-move=up]');up.click();q('#save-home-preferences').click();nav('record');check(q('#view-record [data-home-block]').dataset.homeBlock==='record','Required block cannot move');lines.push('required blocks reorder without writes');
      nav('settings');const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('synthetic secret','QuotaExceededError');return setItem.call(this,k,v);};
      try{q('#home-shortcut-count').value='1';q('#save-home-preferences').click();check(q('#home-preferences-status').textContent.includes('預設')&&!q('#home-preferences-status').textContent.includes('secret'),'Blocked saving did not safely default');nav('record');check(q('#shortcut-quick').children.length===3&&!q('#fields').disabled,'Preference failure blocked bookkeeping');}finally{Storage.prototype.setItem=setItem;}
      lines.push('blocked preference write falls back without disabling ledger');
    }
  }finally{IDBDatabase.prototype.transaction=transaction;}
  check(await raw()===before&&await backup()===bytes,'Home settings changed rows/metadata/full backup');check(q('#category-add').elements.name.value==='分類草稿','Settings move lost draft');lines.push('financial rows, metadata and full backup byte-identical');
  if(mode!=='corrupt'){nav('record');q('#home-search-keyword').value='合成搜尋';q('#view-record [data-search-open]').click();await wait(()=>q('#search-results [data-operation=shortcut]'));q('#search-results [data-operation=shortcut]').click();await wait(()=>q('#shortcut-form').elements.note.value==='合成搜尋');check(!q('#shortcut-form').closest('[data-view]').hidden&&document.activeElement===q('#shortcut-form').elements.name,'Source shortcut opens hidden manager');check(await raw()===before&&await backup()===bytes,'Shortcut draft wrote ledger');lines.push('search source opens visible original shortcut manager without writes');}
  report.textContent='PASS：'+lines.length+' 組首頁偏好畫面\n'+lines.join('\n');
}catch(error){report.textContent='FAIL：'+error.message;throw error;}finally{db.close();localStorage.removeItem(key);}
