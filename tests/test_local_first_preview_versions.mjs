import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {CURRENT,SYNTHETIC,LEGACY_CACHE,assertVersionResponse} from './local_first_version_scenarios.mjs';
const preview=async mode=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,['tests/local_first_preview.mjs',String(port),'--secure',...(mode?[mode]:[])],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Preview startup timed out')),10000);child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Preview exited '+code));});child.stdout.on('data',data=>{if(String(data).includes('Synthetic static preview:')){clearTimeout(timeout);resolve();}});child.once('error',reject);});
  return {origin:'http://127.0.0.1:'+port,close:async()=>{const ended=once(child,'exit');child.kill();await ended;}};
};
test('next-worker serves a different page version and cache rather than silently retaining current content',async()=>{
  const old=await preview(),next=await preview('--next-worker');
  try{
    const read=async(origin,expected)=>{const htmlResponse=await fetch(origin+'/local-first/'),workerResponse=await fetch(origin+'/local-first/sw.js');assert.equal(htmlResponse.status,200);assert.equal(workerResponse.status,200);const html=await htmlResponse.text(),worker=await workerResponse.text();assertVersionResponse('/local-first/',html,expected);assertVersionResponse('/local-first/sw.js',worker,expected);return {page:html.match(/id="page-version"[^>]*>([^<]+)/)?.[1],cache:worker.match(/const CACHE = '([^']+)'/)?.[1]};};
    const a=await read(old.origin,CURRENT),b=await read(next.origin,SYNTHETIC.next);
    assert.ok(a.page&&a.cache&&b.page&&b.cache);assert.notEqual(a.page,b.page,'Synthetic next-page replacement did not happen');assert.notEqual(a.cache,b.cache,'Synthetic next-worker replacement did not happen');
  }finally{await old.close();await next.close();}
});
test('previous-worker is an explicitly synthetic resource omission fixture with its own cache',async()=>{
  const server=await preview('--previous-worker');
  try{
    const html=await(await fetch(server.origin+'/local-first/index.html')).text(),worker=await(await fetch(server.origin+'/local-first/sw.js')).text();
    assertVersionResponse('/local-first/index.html',html,CURRENT);assertVersionResponse('/local-first/sw.js',worker,{...CURRENT,cache:LEGACY_CACHE});
    assert.doesNotMatch(worker,/'\/local-first\/comparison\.mjs'/);assert.doesNotMatch(worker,/'\/local-first\/vendor\/chartjs-4\.5\.1\/chart\.umd\.min\.js'/);assert.match(worker,/'\/local-first\/backup\.mjs'/);
  }finally{await server.close();}
});
