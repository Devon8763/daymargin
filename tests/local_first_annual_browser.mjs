import {scheduleSafety} from './local_first_schedule_safety_checks.mjs';
import * as ledger from '../local-first/ledger.mjs';
import {emptyData,V2_SECTIONS,writeBackup} from '../local-first/backup.mjs';
import {addState} from '../local-first/idb.mjs';
const lines=[],check=(value,message)=>{if(!value)throw new Error(message);},text=bytes=>new TextDecoder().decode(bytes);
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
let db;
try {
  check(location.hostname==='127.0.0.1'&&Number(location.port)>=19000,'Isolated source required');
  const name='annual-'+crypto.randomUUID(),oldOpen=indexedDB.open(name,3);
  oldOpen.onupgradeneeded=()=>{for(const section of [...V2_SECTIONS,'meta'])oldOpen.result.createObjectStore(section,{keyPath:'key'});};
  let old=await request(oldOpen),legacy={format:'local-first-test-ledger',version:3,owner:'local-test-owner',...emptyData(2),incomes:[{id:'i_legacy',received_on:'2024-01-01',name:'合成收入',cents:'29',voided:0,revision:1}]};
  let tx=old.transaction([...V2_SECTIONS,'meta'],'readwrite');addState(tx,legacy);await done(tx);old.close();
  db=await ledger.openDatabase(name);check(db.version===11&&db.objectStoreNames.length===26,'Schema not upgraded to v11');
  check(text(await ledger.exportPortableBackup(db))===text(writeBackup({format:'life-ledger-backup',version:2,data:Object.fromEntries(V2_SECTIONS.map(key=>[key,legacy[key]]))})),'V3 migration changed original bytes');
  db.close();lines.push('v3 to v11 empty new-store migration preserves complete JSON v2 bytes');
  const badOpen=indexedDB.open(name+'-bad',3);badOpen.onupgradeneeded=()=>{for(const section of [...V2_SECTIONS,'meta'])badOpen.result.createObjectStore(section,{keyPath:'key'});};
  old=await request(badOpen);tx=old.transaction([...V2_SECTIONS,'meta'],'readwrite');addState(tx,legacy);tx.objectStore('meta').put({key:'row_count',value:0});await done(tx);old.close();
  let refused=false;try{(await ledger.openDatabase(name+'-bad')).close();}catch{refused=true;}check(refused,'Corrupt v3 accepted');
  old=await request(indexedDB.open(name+'-bad',3));check(old.objectStoreNames.length===14&&!old.objectStoreNames.contains('annual_rules'),'Failed upgrade left stores');old.close();
  lines.push('corrupt v3 migration abort leaves the complete original schema untouched');
  lines.push(...await scheduleSafety(['年度費用']));
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組年度原生交易驗證\n'+lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message+'\n'+lines.join('\n');throw error;}finally{db?.close();}
