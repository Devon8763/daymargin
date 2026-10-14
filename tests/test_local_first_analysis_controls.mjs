import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../local-first/comparison.mjs';
test('quick ranges use full previous calendar months across years and leap February',()=>{
  assert.equal(typeof core.analysisQuickRange,'function');
  assert.deepEqual(core.analysisQuickRange('month','2024-02-20'),{start:'2024-02-01',end:'2024-02-20'});
  assert.deepEqual(core.analysisQuickRange('previous','2024-03-15'),{start:'2024-02-01',end:'2024-02-29'});
  assert.deepEqual(core.analysisQuickRange('three','2025-01-15'),{start:'2024-11-01',end:'2025-01-15'});
  assert.deepEqual(core.analysisQuickRange('year','2025-03-15'),{start:'2025-01-01',end:'2025-03-15'});
});
test('all-time and custom do not silently shrink a tag date range',()=>{
  assert.equal(typeof core.analysisQuickRange,'function');assert.deepEqual(core.analysisQuickRange('all','2024-03-15'),{start:'',end:''});assert.equal(core.analysisQuickRange('custom','2024-03-15'),null);
});
test('invalid quick choice/date fails safely rather than inventing a range',()=>{
  assert.equal(typeof core.analysisQuickRange,'function');assert.throws(()=>core.analysisQuickRange('other','2024-03-15'));assert.throws(()=>core.analysisQuickRange('month','2024-02-30'));
});
