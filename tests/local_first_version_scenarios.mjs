// Independent test pins; never infer expected versions from product files.
export const CURRENT={version:'0.27.0',cache:'local-first-offline-0.27.0-v1'};
export const SYNTHETIC={label:'合成升版（相同產品程式，非真實舊版／發行版）',old:CURRENT,next:{version:'0.27.1',cache:'local-first-offline-0.27.1-v1'}};
export const RELEASE={label:'真實0.26.11工作版→0.27.0候選版（須提供已核對的舊資源）',old:{version:'0.26.11',cache:'local-first-offline-0.26.11-v1'},next:CURRENT};
// Historical cache name only: this fixture is not the actual 0.13.11 product.
export const LEGACY_CACHE='local-first-offline-0.13.11-v1';
const fail=message=>{throw new Error('Version scenario: '+message);};
export function replaceOnce(text,target,replacement) {
  if(target===replacement)fail('replacement must be different');
  const count=text.split(target).length-1;if(count!==1)fail('expected one replacement hit; count='+count);
  return text.replace(target,replacement);
}
export function validateScenario({old,next}) {
  if(!old?.version||!old.cache||!next?.version||!next.cache)fail('missing version/cache');
  if(old.version===next.version||old.cache===next.cache)fail('old/new versions and caches must be different');
}
export function assertVersionResponse(path,text,expected) {
  const worker=path==='/local-first/sw.js';
  const matches=[...text.matchAll(worker?/const CACHE = '([^']+)';/g:/<p id="page-version"[^>]*>目前使用頁面版本：([^<]+)<\/p>/g)];
  if(matches.length!==1||matches[0][1]!==expected[worker?'cache':'version'])fail('response version/cache mismatch or marker count');
}
export function renderPreviewVersion(path,text,mode='current') {
  if(!['/local-first/','/local-first/index.html','/local-first/sw.js'].includes(path))return text;
  validateScenario(SYNTHETIC);assertVersionResponse(path,text,CURRENT);
  const worker=path==='/local-first/sw.js';
  if(mode==='next') {
    text=replaceOnce(text,worker?"const CACHE = '"+CURRENT.cache+"';":'目前使用頁面版本：'+CURRENT.version,worker?"const CACHE = '"+SYNTHETIC.next.cache+"';":'目前使用頁面版本：'+SYNTHETIC.next.version);
    assertVersionResponse(path,text,SYNTHETIC.next);
  }else if(mode==='previous'&&worker) {
    text=replaceOnce(text,"const CACHE = '"+CURRENT.cache+"';","const CACHE = '"+LEGACY_CACHE+"';");
    for(const asset of ['comparison.mjs','vendor/chartjs-4.5.1/chart.umd.min.js'])text=replaceOnce(text,"  '/local-first/"+asset+"',\n",'');
    assertVersionResponse(path,text,{...CURRENT,cache:LEGACY_CACHE});
  }
  return text;
}
validateScenario(SYNTHETIC);validateScenario(RELEASE);
