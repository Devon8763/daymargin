import test from 'node:test';
import assert from 'node:assert/strict';
const prefs=await import('../local-first/budget-preferences.mjs').catch(()=>({}));
const storage=()=>{const map=new Map([['daymargin.home.v1','unchanged legacy home']]);return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
test('default on, explicit off reloads and preserves existing home preferences',()=>{
  const s=storage();assert.deepEqual(prefs.loadBudgetPreferences(s),{near:true,warning:''});
  assert.equal(prefs.saveBudgetPreferences(s,false),true);assert.deepEqual(prefs.loadBudgetPreferences(s),{near:false,warning:''});assert.equal(s.map.get('daymargin.home.v1'),'unchanged legacy home');
});
test('malformed, oversized or unavailable storage falls back safely without overwriting',()=>{
  for(const text of ['{','false','{"version":1,"near":0}','{"version":2,"near":false}','{"version":1,"near":false,"extra":1}',' '.repeat(1025)]){
    const s=storage();s.map.set(prefs.BUDGET_PREFERENCES_KEY,text);const result=prefs.loadBudgetPreferences(s);assert.equal(result.near,true);assert.ok(result.warning);assert.equal(s.map.get(prefs.BUDGET_PREFERENCES_KEY),text);
  }
  assert.ok(prefs.loadBudgetPreferences(null).warning);assert.equal(prefs.saveBudgetPreferences(null,false),false);assert.equal(prefs.saveBudgetPreferences(storage(),'false'),false);
});
test('quota/write failure never reports success or changes stored preference',()=>{
  const s=storage();prefs.saveBudgetPreferences(s,true);s.setItem=()=>{throw Error('private details');};assert.equal(prefs.saveBudgetPreferences(s,false),false);assert.equal(prefs.loadBudgetPreferences(s).near,true);
});
