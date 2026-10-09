import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../local-first/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../local-first/style.css',import.meta.url),'utf8');
const labels=[['usage_remind','開啟提示',true],['usage_show_daily_cost','顯示每日平均成本（約數，元／天）',false]];

test('usage checkboxes stay next to their complete clickable label text',()=>{
  const labelRule=css.match(/#usage-inputs \.usage-checkbox\s*\{([^}]+)\}/)?.[1]||'';
  assert.match(labelRule,/display:\s*flex/);
  assert.match(labelRule,/grid-column:\s*1\s*\/\s*-1/);
  assert.match(labelRule,/align-items:\s*center/);
  assert.match(labelRule,/min-height:\s*44px/);
  const checkboxRule=css.match(/#usage-inputs \.usage-checkbox input\[type="checkbox"\]\s*\{([^}]+)\}/)?.[1]||'';
  assert.match(checkboxRule,/width:\s*1\.25rem/);
  assert.match(checkboxRule,/height:\s*1\.25rem/);
  assert.match(checkboxRule,/padding:\s*0/);
  for(const [name,text,checked] of labels){
    const label=html.match(new RegExp(`<label class="usage-checkbox"><input name="${name}" type="checkbox"([^>]*)>([^<]+)</label>`));
    assert.ok(label,`Missing implicit text label for ${name}`);
    assert.equal(label[2],text,`Label text changed for ${name}`);
    assert.equal(/\bchecked\b/.test(label[1]),checked,`Checkbox default changed for ${name}`);
  }
});
