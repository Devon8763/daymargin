import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const page=await readFile(new URL('../web/page.mjs',import.meta.url),'utf8');
const controls=page.slice(page.indexOf('function restoreControls('),page.indexOf("document.querySelector('#start-ledger').onclick"));
const handlers=page.slice(page.indexOf("document.querySelector('#cancel-restore').onclick"),page.indexOf('function resetExport('));
function setup(type) {
  const fault={type},elements=new Map(),calls={attempts:0,commits:0};
  const element=id=>{if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',focus(){}});return elements.get(id);};
  const document={querySelector:selector=>element(selector.slice(1)),getElementById:element};
  const api=vm.runInNewContext(`let busy=false,writeBlocked=false,selection=0,state=null,pendingBackup=new Uint8Array([1]);
    const error=document.querySelector('#error'),status=document.querySelector('#status'),review=document.querySelector('#restore-review'),fields=document.querySelector('#fields'),restorePassword=document.querySelector('#restore-password');
    ${controls}\n${handlers}
    ({confirm:()=>document.querySelector('#confirm-restore').onclick(),cancel:()=>document.querySelector('#cancel-restore').onclick(),controls:restoreControls,
      retry:()=>{pendingBackup=new Uint8Array([1]);},snapshot:()=>({busy,writeBlocked,fieldsDisabled:fields.disabled,error:error.textContent,status:status.textContent})})`,{
      document,Uint8Array,db:{},restorePortableBackup:async()=>{calls.attempts++;if(fault.type==='abort')throw new Error('synthetic abort');calls.commits++;},
      readLedger:async()=>{if(fault.type==='read')throw new Error('synthetic reread');return {synthetic:true};},
      showLedger:()=>{element('fields').disabled=false;if(['calendar','render'].includes(fault.type))throw new Error('synthetic initialization');}
    });
  return {api,calls,fault,elements};
}
test('normal restore remains unlocked after one successful commit',async()=>{
  const {api,calls,elements}=setup('normal');await api.confirm();assert.equal(calls.commits,1);assert.equal(api.snapshot().writeBlocked,false);assert.equal(api.snapshot().busy,false);assert.equal(elements.get('confirm-restore').disabled,false);
});
test('precommit abort remains retryable and is not reported as committed',async()=>{
  const {api,calls,fault}=setup('abort');await api.confirm();assert.equal(calls.commits,0);assert.equal(api.snapshot().writeBlocked,false);assert.match(api.snapshot().error,/還原未完成/);fault.type='normal';api.retry();await api.confirm();assert.equal(calls.commits,1);
});
for(const type of ['read','calendar','render'])test('committed restore '+type+' failure stays blocked after busy cleanup, cancel and repeated confirmation',async()=>{
  const {api,calls,elements}=setup(type);await api.confirm();
  assert.equal(calls.commits,1);assert.equal(api.snapshot().busy,false);assert.equal(api.snapshot().writeBlocked,true,'R01: committed restore did not block subsequent writes');assert.equal(api.snapshot().fieldsDisabled,true);
  const message=api.snapshot().error;assert.match(message,/還原.*已完成/);assert.match(message,/重新讀取.*畫面/);assert.match(message,/重新載入/);assert.equal(api.snapshot().status,message);
  api.cancel();api.retry();await api.confirm();await api.confirm();api.controls(false);
  assert.equal(calls.attempts,1);assert.equal(calls.commits,1);assert.equal(api.snapshot().writeBlocked,true);assert.equal(api.snapshot().error,message);assert.equal(elements.get('confirm-restore').disabled,true);assert.equal(elements.get('cancel-restore').disabled,true);
});
