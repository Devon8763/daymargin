"""Synthetic Python / browser-format interoperability; never use a real ledger."""
import json
import base64
import copy
import shutil
import subprocess
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import test_portable_life_backup as existing


def synthetic_payload(helper):
    owner = helper.seed()
    sp = existing.sp
    with sp.transaction() as conn:
        conn.execute("UPDATE expenses SET cents=5000000000000001,revision=9007199254740993,note=? WHERE user_id=? AND spent_on='2024-12-31'",
                     ('歷史用途' * 60 + '<img src=x onerror=alert(1)>', owner))
        conn.execute("UPDATE expenses SET cents=5000000000000002,revision=9223372036854775807 WHERE user_id=? AND spent_on='2029-01-01'", (owner,))
        conn.execute("UPDATE recurring_expenses SET revision=9007199254740994 WHERE user_id=? AND kind='固定'", (owner,))
        conn.execute("UPDATE recurring_expenses SET periods=9007199254740997 WHERE user_id=? AND kind='分期'", (owner,))
        conn.execute("UPDATE spending_shortcuts SET position=9007199254740995 WHERE user_id=?", (owner,))
        conn.execute("INSERT INTO budgets VALUES(?,?,?,0)", (owner, '2019-12', '總額'))
        conn.execute("INSERT INTO spending_categories VALUES(?,?,1)", (owner, '</script><img src=x onerror=alert(2)>'))
        key = conn.execute("INSERT INTO expenses(user_id,spent_on,cents,category,note,source,voided) VALUES(?,?,?,?,?,'固定',1)",
                           (owner, '2020-02-29', 29, '歷史無override', '')).lastrowid
        conn.execute("INSERT INTO expense_actions(user_id,expense_id,before_json,undone) VALUES(?,?,'null',1)", (owner, key))
    return helper.bk.export_backup(owner)


class BrowserPortableBackupTests(unittest.TestCase):
    def test_invoice_json_v9_rejects_in_python_without_losing_deduplication(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
import {changeInvoiceImport} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
const state={...emptyData(8),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
const changed=changeInvoiceImport(state,[{number:'AB00000001',date:'2024-01-31',form:{spent_on:'2024-01-31',amount:'.29',note:'synthetic',category:'餐飲',payment_source_id:'p_cash'}}],'2024-02-01');
process.stdout.write(writeBackup(portable(changed)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 9)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('invoice-target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_schedule_json_v6_safely_rejects_in_python_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
const data=emptyData(6);
data.payment_sources=[{id:'p_cash',name:'現金',active:1}];
data.recurring_rules=[{id:'r_one',name:'synthetic',cents:'1',category:'餐飲',kind:'固定',start_month:'2026-10',periods:0,due_day:7,active:1,revision:0}];
data.recurring_versions=[{id:'v_one',recurring_id:'r_one',from_index:0,first_due_on:'2026-10-07',unit:'day',every:15,name:'synthetic',cents:'1',category:'餐飲',payment_source_id:'p_cash',payment_source_name:'現金'}];
process.stdout.write(writeBackup({format:'life-ledger-backup',version:6,data}));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 6)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_tag_json_v5_safely_rejects_in_python_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
const data=emptyData(5);
data.payment_sources=[{id:'p_cash',name:'現金',active:1}];
data.expenses=[{id:'e_tag',spent_on:'2026-10-01',cents:'100001',category:'餐飲',note:'synthetic',source:'manual',recurring_id:null,period:null,voided:1,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:1}];
data.tags=[{id:'t_one',name:'synthetic',hidden:1,revision:1}];
data.expense_tags=[{expense_id:'e_tag',tag_id:'t_one'}];
process.stdout.write(writeBackup({format:'life-ledger-backup',version:5,data}));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 5)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_local_shortcuts_restore_to_python_without_format_or_history_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
import {changeShortcut} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
let state={...emptyData(4),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
const form={name:'合成早餐',note:'<img src=x onerror=alert(1)>',category:'餐飲',payment_source_id:'p_cash',amount:'.29'};
state=changeShortcut(state,[],'add','s_one',form,null,'2026-10-06');
state=changeShortcut(state,state.shortcuts,'add','s_two',{...form,name:'合成午餐',amount:''},null,'2026-10-06');
state=changeShortcut(state,state.shortcuts,'up','s_two',null,null,'2026-10-06');
state=changeShortcut(state,state.shortcuts,'disable','s_one',null,null,'2026-10-06');
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        original = self.helper.bk.read_backup(result.stdout)
        self.assertEqual(original['version'], 1)
        self.assertEqual(len(original['data']), 9)
        before = self.helper.snapshot()
        existing.service.restore_portable_backup('shortcut-target', result.stdout)
        restored = self.helper.bk.read_backup(self.helper.bk.export_backup('shortcut-target'))
        for section in original['data']:
            if section not in ('shortcuts', 'payment_sources'):
                self.assertEqual(restored['data'][section], original['data'][section])
        self.assertEqual([(r['name'], r['active']) for r in restored['data']['payment_sources']],
                         [(r['name'], r['active']) for r in original['data']['payment_sources']])
        self.assertEqual([{k: v for k, v in r.items() if k not in ('id', 'payment_source_id')}
                          for r in restored['data']['shortcuts']],
                         [{k: v for k, v in r.items() if k not in ('id', 'payment_source_id')}
                          for r in original['data']['shortcuts']])
        payment_id = restored['data']['payment_sources'][0]['id']
        self.assertTrue(all(r['payment_source_id'] == payment_id for r in restored['data']['shortcuts']))
        rows = existing.sp.shortcuts('shortcut-target', include_inactive=True)
        self.assertEqual([(r['name'], r['cents'], r['active'], r['position']) for r in rows],
                         [('合成午餐', None, 1, 0), ('合成早餐', 29, 0, 1)])
        after = self.helper.snapshot()
        for table in ('expenses', 'expense_actions', 'assets', 'ai_preferences', 'users'):
            self.assertEqual(after[table], before[table])

    def test_goal_json_v7_safely_rejects_in_python_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
import {changeGoal,changeAllocation} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
let state={format:'local-first-test-ledger',version:8,owner:'local-test-owner',...emptyData(7)};
state=changeGoal(state,'add','g_one',null,{name:'合成目標',target_amount:'100',saved_amount:'0',deadline:'',remind:1,completed:0});
state=changeAllocation(state,'2026-10',null,[{id:'save',name:'目標分配',amount:'.29',goal_id:'g_one'}],{g_one:0});
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 7)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_recurring_income_json_v8_safely_rejects_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
import {changeIncomeRule,changeIncomePeriod} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
let state={format:'local-first-test-ledger',version:9,owner:'local-test-owner',...emptyData(8)};
state=changeIncomeRule(state,'add','ir_synthetic',null,{name:'合成收入',amount:'.29',first_due_on:'2026-10-01',due_day:1},'2026-10-12');
state=changeIncomePeriod(state,'ir_synthetic','2026-10',0,null,'record',null,'2026-10-12');
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 8)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_usage_json_v4_safely_rejects_in_python_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
const data=emptyData(4);
data.payment_sources=[{id:'p_cash',name:'現金',active:1}];
data.expenses=[{id:'e_usage',spent_on:'2026-10-01',cents:'29',category:'餐飲',note:'合成商品',source:'manual',recurring_id:null,period:null,voided:1,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:1}];
data.usage_periods=[{expense_id:'e_usage',started_on:'2026-10-01',days:7,remind:1,reminder_days:7,show_daily_cost:0,active:0,revision:1}];
process.stdout.write(writeBackup({format:'life-ledger-backup',version:4,data}));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 4)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_annual_json_v3_safely_rejects_in_python_without_changes(self):
        code = """
import {emptyData,writeBackup} from './local-first/backup.mjs';
import {changeAnnual} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
const state={format:'local-first-test-ledger',version:4,owner:'local-test-owner',...emptyData(3),payment_sources:[{id:'p_cash',name:'現金',active:1}]};
const changed=changeAnnual(state,'add','y_one',null,{name:'合成年度',amount:'.29',category:'餐飲',payment_source_id:'p_cash',first_year:2026,due_month:5,due_day:31},'2026-05-01');
process.stdout.write(writeBackup(portable(changed)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 3)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def test_finance_json_v2_is_explicitly_rejected_by_unchanged_python(self):
        code = """
import {readBackup,emptyData,writeBackup} from './local-first/backup.mjs';
import {changeIncome} from './local-first/ledger.mjs';
import {portable} from './local-first/idb.mjs';
const state={format:'local-first-test-ledger',version:3,owner:'local-test-owner',...emptyData(2)};
const changed=changeIncome(state,'add','i_received',null,{received_on:'2025-02-01',amount:'.29',name:'合成收入'},'2025-02-28');
process.stdout.write(writeBackup(portable(changed)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                cwd=Path(__file__).resolve().parents[1], capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout)['version'], 2)
        before = self.helper.snapshot()
        with self.assertRaises(self.helper.bk.PortableBackupError):
            self.helper.bk.read_backup(result.stdout)
        with self.assertRaises(self.helper.bk.PortableBackupError):
            existing.service.restore_portable_backup('target', result.stdout)
        self.assertEqual(self.helper.snapshot(), before)

    def setUp(self):
        self.helper = existing.PortableLifeBackupTests('test_full_roundtrip_preserves_meaning_settings_and_history')
        self.helper.setUp()
        self.addCleanup(self.helper.doCleanups)
        self.payload = synthetic_payload(self.helper)

    def test_fixture_is_the_actual_python_export(self):
        fixture = Path(__file__).parent / 'fixtures' / 'portable_life_ledger.json'
        self.assertEqual(fixture.read_bytes(), self.payload)
        parsed = self.helper.bk.read_backup(self.payload)['data']
        self.assertEqual(len(parsed), 9)
        self.assertEqual(parsed['shortcuts'][0]['position'], 9007199254740995)
        self.assertEqual(parsed['recurring_rules'][2]['periods'], 9007199254740997)

    def test_node_lossless_roundtrip_then_python_restore_and_core_semantics(self):
        node = shutil.which('node')
        self.assertIsNotNone(node, 'Node is required for the explicit interoperability test')
        script = Path(__file__).parent / 'portable_backup_roundtrip.mjs'
        result = subprocess.run([node, str(script)], input=self.payload, capture_output=True, check=True)
        self.verify(result.stdout)

    def test_node_acceptance_matches_python_v1_contract(self):
        bk = self.helper.bk
        original = bk.read_backup(self.payload)
        def encode(value):
            return json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode()
        cases = [self.payload]
        # Every required section and every record field is checked against Python.
        for section, rows in original['data'].items():
            changed = copy.deepcopy(original)
            del changed['data'][section]
            cases.append(encode(changed))
            records = rows if isinstance(rows, list) else [rows]
            if not records:
                continue
            for field in records[0]:
                changed = copy.deepcopy(original)
                record = changed['data'][section][0] if isinstance(rows, list) else changed['data'][section]
                del record[field]
                cases.append(encode(changed))
        mutations = [
            lambda d: d.update(owner='injected'),
            lambda d: d['data']['expenses'][0].update(revision=True),
            lambda d: d['data']['expenses'][0].update(revision=9223372036854775808),
            lambda d: d['data']['expenses'][0].update(revision=-1),
            lambda d: d['data']['expenses'][0].update(revision=1.0),
            lambda d: d['data']['expenses'][0].update(cents='01'),
            lambda d: d['data']['expenses'][0].update(cents='9223372036854775808'),
            lambda d: d['data']['expenses'][0].update(payment_source_id=[]),
            lambda d: d['data']['expenses'][0].update(spent_on='2025-02-29'),
            lambda d: d['data']['expenses'][1].update(period='2025-02'),
            lambda d: d['data']['expenses'].append({**d['data']['expenses'][1], 'id': 'duplicate_month'}),
            lambda d: d['data']['recurring_versions'].append({**d['data']['recurring_versions'][0], 'id': 'duplicate_version'}),
            lambda d: d['data']['recurring_rules'][2].update(periods=0),
            lambda d: d['data']['shortcuts'][0].update(position=9223372036854775807),
            lambda d: d['data']['shortcuts'][0].update(id=d['data']['expenses'][0]['id']),
            lambda d: d['data']['actions'][0].update(expense_id='missing'),
            lambda d: d['data']['actions'][5]['before'].update(source='固定'),
            lambda d: d['data']['actions'][5]['before'].update(id='wrong'),
            lambda d: d['data']['settings'].update(reminder_levels=[]),
            lambda d: d['data']['settings'].update(reminder_levels=[80, 80]),
            lambda d: d['data']['settings'].update(reminder_levels=[True]),
            lambda d: d['data']['settings'].update(recording_started_on='0001-01-01'),
            lambda d: d['data']['categories'][0].update(name='\u0085'),
            lambda d: d['data']['categories'][0].update(name='\ufeff'),
            lambda d: d['data']['categories'][0].update(name='😀' * 4096),
            lambda d: d['data']['expenses'][0].update(note='\ud800'),
            lambda d: d['data']['expenses'][0].update(note='\0'),
            lambda d: d['data']['expenses'][0].update(note='字' * 4097),
        ]
        for mutate in mutations:
            changed = copy.deepcopy(original)
            mutate(changed)
            cases.append(encode(changed))
        cases += [b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}', b'{"x":1e2}',
                  b'{"__proto__":{},"__proto__":{}}', b'\xef\xbb\xbf' + self.payload,
                  b'\xff', b'[' * 13 + b']' * 13, b' ' * (16 * 1024 * 1024 + 1)]
        cases += [self.payload.replace(b'"version":1', replacement) for replacement in (
            b'"version":1,"version":1', b'"version":1,"v\\u0065rsion":1',
            b'"version":1,"__proto__":null', b'"version":1,"__proto__":0',
            b'"version":1,"__proto__":true', b'"version":1,"__proto__":"text"',
            b'"version":1,"\\u005f\\u005fproto__":null')]
        cases += [self.payload.replace(b'"settings":', b'"settings":' + encode(original['data']['settings']) + b',"settings":'),
                  self.payload.replace(b'"active":1', b'"active":1,"active":1', 1),
                  self.payload.replace(b'"source":"manual"', b'"source":"manual","__proto__":null', 1)]
        expected = []
        for payload in cases:
            try:
                bk.read_backup(payload)
                expected.append(True)
            except bk.PortableBackupError:
                expected.append(False)
        script = Path(__file__).parent / 'portable_backup_roundtrip.mjs'
        result = subprocess.run([shutil.which('node'), str(script), '--validate-cases'],
                                input=json.dumps([base64.b64encode(payload).decode() for payload in cases]).encode(),
                                capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout), expected)

    def test_browser_recurring_creation_posting_then_python_restore(self):
        code = """
import {readFileSync} from 'node:fs';
import {readBackup,writeBackup} from './local-first/backup.mjs';
import {portable} from './local-first/idb.mjs';
import {changeRecurring} from './local-first/ledger.mjs';
let state={format:'local-first-test-ledger',version:2,owner:'local-test-owner',...readBackup(readFileSync(0)).data};
for(const kind of ['固定','訂閱','分期']) state=changeRecurring(state,'add',null,null,
  {kind,name:'合成新'+kind,amount:'.29',category:'居住',start_month:'2025-02',due_day:31,periods:kind==='分期'?2:0},'2025-02-28');
state=changeRecurring(state,'sync',null,null,null,'2025-02-28');
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                input=self.payload, capture_output=True, check=True,
                                cwd=Path(__file__).resolve().parents[1])
        bk, sp = self.helper.bk, existing.sp
        parsed = bk.read_backup(result.stdout)['data']
        self.assertEqual(len(parsed), 9)
        self.assertEqual(len(parsed['recurring_rules']), 6)
        self.assertEqual(len(parsed['recurring_versions']), 3)
        self.assertEqual([row['cents'] for row in parsed['expenses'] if row['note'].startswith('合成新')], ['29'] * 3)
        self.assertEqual([row['note'] for row in parsed['expenses'] if row['source'] == '分期'][-1], '合成新分期（第 1/2 期）')
        bk.restore_backup('target', result.stdout)
        restored = bk.read_backup(bk.export_backup('target'))['data']
        for section in parsed:
            self.assertEqual(len(restored[section]), len(parsed[section]))
        self.assertEqual(sp.sync_recurring('target', date(2025, 2, 28)), 0)
        self.assertEqual(sp.sync_recurring('target', date(2025, 3, 31)), 6)
        self.assertEqual(sp.sync_recurring('target', date(2025, 3, 31)), 0)
        self.assertEqual(sp.sync_recurring('target', date(2025, 4, 30)), 5)
        installments = sp.rows("SELECT * FROM expenses WHERE user_id='target' AND note LIKE '合成新分期%' ORDER BY spent_on")
        self.assertEqual([(row['spent_on'], row['cents'], row['note']) for row in installments],
                         [('2025-02-28', 29, '合成新分期（第 1/2 期）'), ('2025-03-31', 29, '合成新分期（第 2/2 期）')])
        roundtrip = subprocess.run([shutil.which('node'), str(Path(__file__).with_name('portable_backup_roundtrip.mjs'))],
                                   input=bk.export_backup('target'), capture_output=True, check=True)
        self.assertEqual(bk.read_backup(roundtrip.stdout), bk.read_backup(bk.export_backup('target')))

    def test_nonfixed_versions_validate_immutable_fields_in_both_formats(self):
        bk = self.helper.bk
        for kind in ('訂閱', '分期'):
            bundle = bk.read_backup(self.payload)
            rule = next(row for row in bundle['data']['recurring_rules'] if row['kind'] == kind)
            version = dict(id='v_new', recurring_id=rule['id'], effective_month='2025-02',
                           name=rule['name'], cents='31', category='醫療', due_day=rule['due_day'] or 1)
            bundle['data']['recurring_versions'].append(version)
            payload = json.dumps(bundle, ensure_ascii=True, separators=(',', ':')).encode()
            self.assertEqual(bk.read_backup(payload), bundle)
            script = Path(__file__).with_name('portable_backup_roundtrip.mjs')
            result = subprocess.run([shutil.which('node'), str(script)], input=payload, capture_output=True, check=True)
            self.assertEqual(bk.read_backup(result.stdout), bundle)
            for fields in ({'name': '偽造名稱'}, {'due_day': 2}, {'recurring_id': 'missing'}, {'effective_month': '2024-12'}):
                changed = copy.deepcopy(bundle)
                changed['data']['recurring_versions'][-1].update(fields)
                with self.assertRaises(bk.PortableBackupError):
                    bk.read_backup(json.dumps(changed).encode())

    def test_browser_versions_restore_and_python_catchup_select_due_month(self):
        code = """
import {readFileSync} from 'node:fs';
import {readBackup,writeBackup} from './local-first/backup.mjs';
import {portable} from './local-first/idb.mjs';
import {changeRecurring} from './local-first/ledger.mjs';
let state={format:'local-first-test-ledger',version:2,owner:'local-test-owner',...readBackup(readFileSync(0)).data};
for(const kind of ['固定','訂閱','分期']) {
 state=changeRecurring(state,'add',null,null,{kind,name:'合成更改'+kind,amount:'.29',category:'居住',
   start_month:'2027-12',due_day:31,periods:kind==='分期'?3:0},'2027-12-15');
 const rule=state.recurring_rules.at(-1),extra=kind==='固定'?{name:rule.name,due_day:31}:{};
 state=changeRecurring(state,'update',rule.id,0,{...extra,amount:'.37',category:'娛樂'},'2027-12-15');
 state=changeRecurring(state,'update',rule.id,1,{...extra,amount:'.41',category:'居住'},'2027-12-31');
 state=changeRecurring(state,'update',rule.id,2,{...extra,amount:'.53',category:'醫療'},'2028-01-15');
}
state=changeRecurring(state,'sync',null,null,null,'2027-12-31');
const row=state.expenses.find(row=>row.note==='合成更改訂閱');row.voided=1;
state.actions.find(action=>action.expense_id===row.id).undone=1;
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                input=self.payload, capture_output=True, check=True,
                                cwd=Path(__file__).resolve().parents[1])
        bk, sp = self.helper.bk, existing.sp
        original = bk.read_backup(result.stdout)
        self.assertEqual(len(original['data']), 9)
        bk.restore_backup('target', result.stdout)
        def canonical(bundle):
            ids = {row['id']: prefix + str(index + 1)
                   for section, prefix in bk.PREFIXES.items()
                   for index, row in enumerate(bundle['data'][section])}
            def normalize(value):
                if isinstance(value, list):
                    return [normalize(row) for row in value]
                if isinstance(value, dict):
                    return {key: ids.get(item, item) if key in ('id', 'recurring_id', 'expense_id', 'payment_source_id')
                            else normalize(item) for key, item in value.items()}
                return value
            return normalize(bundle)
        self.assertEqual(canonical(bk.read_backup(bk.export_backup('target'))), canonical(original))
        before = sp.rows("SELECT * FROM expenses WHERE user_id='target' ORDER BY id")
        sp.sync_recurring('target', date(2028, 2, 29))
        rows = sp.rows("SELECT * FROM expenses WHERE user_id='target' AND note LIKE '合成更改%' ORDER BY source,period")
        for kind in ('固定', '訂閱', '分期'):
            actual = [(row['spent_on'], row['cents'], row['category']) for row in rows if row['source'] == kind]
            self.assertEqual(actual, [('2027-12-31', 29, '居住'), ('2028-01-31', 41, '居住'), ('2028-02-29', 53, '醫療')])
        self.assertEqual(sp.sync_recurring('target', date(2028, 2, 29)), 0)
        after = {row['id']: row for row in sp.rows("SELECT * FROM expenses WHERE user_id='target'")}
        for row in before:
            self.assertEqual(after[row['id']], row)
        roundtrip = subprocess.run([shutil.which('node'), str(Path(__file__).with_name('portable_backup_roundtrip.mjs'))],
                                   input=bk.export_backup('target'), capture_output=True, check=True)
        self.assertEqual(bk.read_backup(roundtrip.stdout), bk.read_backup(bk.export_backup('target')))

    def test_python_posting_applies_subscription_installment_versions(self):
        sp = existing.sp
        with sp.transaction() as conn:
            for kind in ('訂閱', '分期'):
                key = conn.execute('INSERT INTO recurring_expenses(user_id,name,cents,category,kind,start_month,periods,due_day) '
                                   'VALUES(?,?,?,?,?,?,?,?)', ('target', '合成版本'+kind, 29, '居住', kind, '2027-12', 3 if kind == '分期' else 0, None)).lastrowid
                conn.execute('INSERT INTO recurring_expense_versions(recurring_id,user_id,effective_month,name,cents,category,due_day) VALUES(?,?,?,?,?,?,?)',
                             (key, 'target', '2028-01', '合成版本'+kind, 31, '醫療', 1))
        self.assertEqual(sp.sync_recurring('target', date(2028, 2, 29)), 6)
        for kind in ('訂閱', '分期'):
            rows = sp.rows('SELECT * FROM expenses WHERE user_id=? AND source=? ORDER BY period', ('target', kind))
            self.assertEqual([(row['spent_on'], row['cents'], row['category']) for row in rows],
                             [('2027-12-01', 29, '居住'), ('2028-01-01', 31, '醫療'), ('2028-02-01', 31, '醫療')])
        before = self.helper.snapshot()
        with patch.object(sp, 'today', return_value=date(2028, 1, 15)):
            views = sp.recurring_expenses('target')
            for view in views:
                self.assertEqual((view['cents'], view['category'], view['due_day']), (31, '醫療', None))
                self.assertNotIn('pending', view)
            summary = sp.fixed_burdens('target')
            self.assertTrue(all(row['monthly_amount'] == .31 and row['category'] == '醫療' for row in summary['rules']))
        self.assertEqual(self.helper.snapshot(), before)

    def test_browser_single_expense_fields_and_voided_periods_restore_in_python(self):
        code = """
import {readFileSync} from 'node:fs';
import {readBackup,writeBackup,integerValue,storedInteger} from './local-first/backup.mjs';
import {portable} from './local-first/idb.mjs';
import {changeRecurring} from './local-first/ledger.mjs';
import {validateInput} from './local-first/rules.mjs';
let state={format:'local-first-test-ledger',version:2,owner:'local-test-owner',...readBackup(readFileSync(0)).data};
state=changeRecurring(state,'sync',null,null,null,'2025-02-28');
for(const [sequence,source] of ['manual','固定','訂閱','分期'].entries()){
 const index=state.expenses.findIndex(row=>row.source===source&&!row.voided&&row.spent_on<='2025-02-28'),before=structuredClone(state.expenses[index]);
 const form={amount:'.37',note:'合成單筆'+source,spent_on:before.spent_on,category:before.category,payment_source_id:''};
 const edited={...before,...validateInput(form,state,'2025-02-28',before),revision:storedInteger(integerValue(before.revision)+1n)};
 state.actions.push({id:'a_edit_'+sequence,expense_id:before.id,before,undone:0});
 state.actions.push({id:'a_void_'+sequence,expense_id:before.id,before:structuredClone(edited),undone:0});
 state.expenses[index]={...edited,voided:1,revision:storedInteger(integerValue(edited.revision)+1n)};
}
process.stdout.write(writeBackup(portable(state)));
"""
        result = subprocess.run([shutil.which('node'), '--input-type=module', '-e', code],
                                input=self.payload, capture_output=True, check=True,
                                cwd=Path(__file__).resolve().parents[1])
        bk, sp = self.helper.bk, existing.sp
        bundle = bk.read_backup(result.stdout)
        bk.restore_backup('target', result.stdout)
        restored = bk.read_backup(bk.export_backup('target'))
        fields = ('spent_on', 'cents', 'category', 'note', 'source', 'period', 'voided', 'payment_source_name', 'kind', 'revision')
        for source in ('manual', '固定', '訂閱', '分期'):
            original = next(row for row in bundle['data']['expenses'] if row['note'] == '合成單筆'+source)
            actual = next(row for row in restored['data']['expenses'] if row['note'] == original['note'])
            self.assertEqual({field: actual[field] for field in fields}, {field: original[field] for field in fields})
            self.assertEqual(actual['recurring_id'] is None, original['recurring_id'] is None)
            self.assertEqual(actual['payment_source_id'] is None, original['payment_source_id'] is None)
            snapshots = [row['before'] for row in restored['data']['actions'] if row['expense_id'] == actual['id'] and row['before']]
            self.assertEqual(snapshots[-1]['note'], original['note'])
            self.assertEqual(snapshots[-1]['voided'], 0)
        before = sp.rows("SELECT * FROM expenses WHERE user_id='target' ORDER BY id")
        self.assertEqual(sp.sync_recurring('target', date(2025, 2, 28)), 0)
        self.assertEqual(sp.sync_recurring('target', date(2025, 3, 31)), 3)
        after = {row['id']: row for row in sp.rows("SELECT * FROM expenses WHERE user_id='target'")}
        for row in before:
            self.assertEqual(after[row['id']], row)
        roundtrip = subprocess.run([shutil.which('node'), str(Path(__file__).with_name('portable_backup_roundtrip.mjs'))],
                                   input=bk.export_backup('target'), capture_output=True, check=True)
        self.assertEqual(bk.read_backup(roundtrip.stdout), bk.read_backup(bk.export_backup('target')))

    def verify(self, payload):
        bk, sp = self.helper.bk, existing.sp
        original = bk.read_backup(self.payload)
        self.assertEqual(bk.read_backup(payload), original)
        before = self.helper.snapshot()
        bk.restore_backup('target', payload)
        self.assertEqual(bk.read_backup(bk.export_backup('target')), original)
        after = self.helper.snapshot()
        for table in ('assets', 'ai_preferences', 'users'):
            self.assertEqual(before[table], after[table])
        source = 'source-discord-identity'
        for month in ('2019-12', '2024-12', '2025-01', '2025-02'):
            self.assertEqual(sp.month_report(source, month), sp.month_report('target', month))
            if month == '2019-12':
                for owner in (source, 'target'):
                    zero = sp.month_report(owner, month)['budgets'][0]
                    self.assertEqual((zero['budget_cents'], zero['spent_cents'], zero['remaining_cents']), (0, 0, 0))
                    self.assertIsNone(zero['used_percent'])
            self.assertEqual(sp.chart_data(source, month), sp.chart_data('target', month))
        def comparison(owner):
            return sp.expense_comparison(owner, '2024-12-01', '2025-01-31', '2025-02-01', '2025-03-31', as_of=date(2025, 2, 28))
        self.assertEqual(comparison(source), comparison('target'))
        for owner in (source, 'target'):
            action, entry = sp.undo(owner)
            old = sp.get_expense(owner, entry)['revision']
            sp.undo(owner, action)
            row = sp.get_expense(owner, entry)
            self.assertEqual((row['note'], row['revision']), ('更改前用途', old + 1))
            self.assertEqual(sp.sync_recurring(owner, date(2025, 1, 31)), 0)
            self.assertEqual(sp.sync_recurring(owner, date(2025, 2, 28)), 3)
            self.assertEqual(sp.sync_recurring(owner, date(2025, 2, 28)), 0)
        self.assertEqual(bk.read_backup(bk.export_backup(source)), bk.read_backup(bk.export_backup('target')))


if __name__ == '__main__':
    unittest.main()
