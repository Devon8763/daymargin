import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../local-first/comparison.mjs';
test('period controls select complete calendar months with matching presets and leap boundaries',()=>{
  assert.equal(typeof core.analysisPeriodRange,'function');
  assert.deepEqual(core.analysisPeriodRange('month','month','','2024-02-20'),{start:'2024-02-01',end:'2024-02-29'});
  assert.deepEqual(core.analysisPeriodRange('month','previous','','2025-01-15'),{start:'2024-12-01',end:'2024-12-31'});
  assert.deepEqual(core.analysisPeriodRange('month','select','2023-02','2024-03-15'),{start:'2023-02-01',end:'2023-02-28'});
});
test('week and year controls preserve Monday weeks and complete calendar years',()=>{
  assert.equal(typeof core.analysisPeriodRange,'function');
  assert.deepEqual(core.analysisPeriodRange('week','current','','2024-01-03'),{start:'2024-01-01',end:'2024-01-07'});
  assert.deepEqual(core.analysisPeriodRange('week','previous','','2024-01-03'),{start:'2023-12-25',end:'2023-12-31'});
  assert.deepEqual(core.analysisPeriodRange('year','select','2024','2025-01-03'),{start:'2024-01-01',end:'2024-12-31'});
  assert.deepEqual(core.analysisPeriodRange('year','previous','','2025-01-03'),{start:'2024-01-01',end:'2024-12-31'});
});
test('custom selection does not invent dates; invalid visible controls reject safely',()=>{
  assert.equal(typeof core.analysisPeriodRange,'function');assert.equal(core.analysisPeriodRange('month','custom','','2024-03-15'),null);
  for(const args of [['month','select','2024-13'],['year','select','0'],['year','select','10000'],['week','select','2024-02-30'],['other','current',''],['month','bad','']])assert.throws(()=>core.analysisPeriodRange(...args,'2024-03-15'));
});
test('two-group difference is exact and unavailable when a whole group has not started',()=>{
  assert.equal(typeof core.analysisDifference,'function');const result=(a,b)=>({groups:[{total_cents:a},{total_cents:b}]});
  assert.equal(core.analysisDifference(result(29n,31n)),-2n);assert.equal(core.analysisDifference(result(31n,29n)),2n);assert.equal(core.analysisDifference(result(29n,29n)),0n);
  assert.equal(core.analysisDifference(result(9223372036854775807n,1n)),9223372036854775806n);assert.equal(core.analysisDifference(result(29n,null)),null);assert.equal(core.analysisDifference({groups:[{total_cents:29n}]}),null);
});
