import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../web/home-preferences.mjs').catch(()=>({}));
const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};};
test('fresh source keeps required search/record, original order, three shortcuts and collapsed summaries',async()=>{
  const core=await load();assert.equal(typeof core.loadHomePreferences,'function');
  const {preferences,warning}=core.loadHomePreferences(storage());assert.equal(warning,'');assert.deepEqual(preferences.order,['search','record','shortcuts','ending','budget','schedule','goals','expenses','calendar']);assert.equal(preferences.shortcut_count,3);assert.equal(preferences.visible.goals,false);assert.equal(preferences.visible.expenses,true);assert.equal(preferences.visible.calendar,true);assert.equal(preferences.expanded.expenses,false);assert.ok(!Object.hasOwn(preferences.expanded,'calendar'));
});
test('strict 0.24.0 migration preserves all customized values, appends two visible blocks and does not write storage',async()=>{
  const core=await load();
  const legacy={version:1,order:['goals','record','budget','search','shortcuts','schedule','ending'],visible:{shortcuts:false,ending:false,budget:true,schedule:false,goals:true},shortcut_count:7,expanded:{shortcuts:true,budget:true,schedule:false,goals:false,ending:true,expenses:true}},text=JSON.stringify(legacy);
  const source={getItem:()=>text,setItem(){throw new Error('Migration must not write');}},loaded=core.loadHomePreferences(source);
  assert.equal(loaded.warning,'');assert.equal(loaded.preferences.version,2);assert.deepEqual(loaded.preferences.order,[...legacy.order,'expenses','calendar']);assert.deepEqual(loaded.preferences.visible,{...legacy.visible,expenses:true,calendar:true});assert.deepEqual(loaded.preferences.expanded,legacy.expanded);assert.equal(loaded.preferences.shortcut_count,7);
  const target=storage();assert.equal(core.saveHomePreferences(target,loaded.preferences),true);assert.deepEqual(core.loadHomePreferences(target).preferences,loaded.preferences);
});
test('partial or forged legacy preference is not accepted as a valid upgrade',async()=>{
  const core=await load();const p={version:1,order:['search','record','shortcuts','ending','budget','schedule','goals'],visible:{shortcuts:true,ending:true,budget:true,schedule:true,goals:false},shortcut_count:3,expanded:{shortcuts:false,budget:false,schedule:false,goals:false,ending:false,expenses:false}};
  for(const bad of [{...p,order:[...p.order,'expenses']},{...p,visible:{...p.visible,expenses:false}},{...p,expanded:{...p.expanded,calendar:true}},{...p,order:p.order.map(key=>key==='goals'?'search':key)}]){const loaded=core.loadHomePreferences({getItem:()=>JSON.stringify(bad)});assert.ok(loaded.warning);assert.deepEqual(loaded.preferences,core.defaultHomePreferences());}
});
test('known optional visibility, order, shortcut count and initial summary survive a source-local roundtrip',async()=>{
  const core=await load();assert.equal(typeof core.saveHomePreferences,'function');const source=storage(),p=core.defaultHomePreferences();p.order.reverse();p.visible.budget=false;p.shortcut_count=8;p.expanded.budget=true;
  assert.equal(core.saveHomePreferences(source,p),true);assert.deepEqual(core.loadHomePreferences(source).preferences,p);assert.equal(core.loadHomePreferences(storage()).preferences.shortcut_count,3);
});
test('required hiding, duplicate/unknown blocks, malformed and old formats fall back as a whole',async()=>{
  const core=await load();assert.equal(typeof core.loadHomePreferences,'function');
  const bads=[null,'{broken',{version:0},{...core.defaultHomePreferences(),visible:{...core.defaultHomePreferences().visible,record:false}},{...core.defaultHomePreferences(),order:['record','record']},{...core.defaultHomePreferences(),shortcut_count:-1},{...core.defaultHomePreferences(),expanded:{...core.defaultHomePreferences().expanded,fake:true}}];
  for(const bad of bads){const source={getItem:()=>typeof bad==='string'?bad:JSON.stringify(bad)};const loaded=core.loadHomePreferences(source);assert.deepEqual(loaded.preferences,core.defaultHomePreferences());assert.ok(loaded.warning);}
});
test('blocked reads/writes and unsafe values never throw or retain an unsaved layout',async()=>{
  const core=await load();assert.equal(typeof core.saveHomePreferences,'function');const denied={getItem(){throw new Error('secret detail');},setItem(){throw new Error('secret detail');}};
  assert.deepEqual(core.loadHomePreferences(denied).preferences,core.defaultHomePreferences());assert.ok(!core.loadHomePreferences(denied).warning.includes('secret'));
  assert.equal(core.saveHomePreferences(denied,core.defaultHomePreferences()),false);assert.equal(core.saveHomePreferences(storage(),{...core.defaultHomePreferences(),shortcut_count:Infinity}),false);
});
