import { emptyData, SECTIONS as LEGACY_SECTIONS, ALL_SECTIONS as SECTIONS, FINANCE_SECTIONS, ANNUAL_SECTIONS, V2_SECTIONS, V3_SECTIONS, V4_SECTIONS, V5_SECTIONS, writeBackup } from './backup.mjs';

export class StorageError extends Error {
  constructor(code = 'storage', message = '本機測試帳本資料不完整，請保留資料並停止操作。') {
    super(message); this.code = code;
  }
}

const OWNER = 'local-test-owner';
const HEADER = ['format', 'version', 'owner'];
export const STORES = [...SECTIONS, 'meta'];
const fail = () => { throw new StorageError(); };
export const portable = state => {
  const annual = ANNUAL_SECTIONS.some(section => state[section]?.length);
  const extended = FINANCE_SECTIONS.some(section => state[section]?.length);
  const usage = state.usage_periods?.length;
  const tags=state.tags?.length || state.expense_tags?.length;
  const scheduled=state.scheduled_periods?.length || state.recurring_versions?.some(row=>Object.hasOwn(row,'from_index'));
  return {format:'life-ledger-backup', version:scheduled ? 6 : tags ? 5 : usage ? 4 : annual ? 3 : extended ? 2 : 1,
    data:Object.fromEntries((scheduled ? SECTIONS : tags ? V5_SECTIONS : usage ? V4_SECTIONS : annual ? V3_SECTIONS : extended ? V2_SECTIONS : LEGACY_SECTIONS).map(section => [section,state[section] || []]))};
};

export function rowKey(section, row) {
  if (section === 'categories') return row.name;
  if (section === 'budgets') return [row.month, row.category];
  if (section === 'recurring_versions') return [row.recurring_id, Object.hasOwn(row,'from_index') ? Number(row.from_index) : row.effective_month];
  if (section === 'scheduled_periods') return [row.rule_id,Number(row.index)];
  if (section === 'settings') return 'settings';
  if (section === 'annual_periods') return [row.annual_id,row.year];
  if (section === 'usage_periods') return row.expense_id;
  if (section === 'expense_tags') return [row.expense_id,row.tag_id];
  if (section === 'monthly_allocations') return row.month;
  if (section === 'allocation_preferences') return row.recurring_id;
  return row.id;
}

function checkedLegacy(state, marker, keys) {
  const legacy = state?.version === 1;
  const fields = [...HEADER, ...(legacy ? ['expenses', 'actions', 'categories', 'payment_sources'] : LEGACY_SECTIONS)];
  if (keys.length !== 2 || !keys.includes('created') || !keys.includes(OWNER) || marker !== 1 ||
      !state || state.format !== 'local-first-test-ledger' || state.owner !== OWNER ||
      ![1, 2].includes(state.version) || Object.keys(state).length !== fields.length ||
      fields.some(field => !Object.hasOwn(state, field))) fail();
  const full = { ...emptyData(6), ...state, version:7 };
  try { writeBackup(portable(full)); } catch { fail(); }
  return full;
}

export function metadata(state) {
  const bytes = writeBackup(portable(state)).byteLength;
  const rowCount = SECTIONS.filter(section => section !== 'settings')
    .reduce((total, section) => total + (state[section]?.length || 0), 0);
  return { created: 1, next_action_order: state.actions.length, row_count: rowCount, backup_bytes: bytes };
}

export function addState(tx, state) {
  for (const section of SECTIONS) {
    const rows = section === 'settings' ? [state.settings] : state[section] || [];
    rows.forEach((row, position) => tx.objectStore(section).add({ key: rowKey(section, row), position, value: row }));
  }
  for (const [key, value] of Object.entries(metadata(state))) tx.objectStore('meta').add({ key, value });
}

function snapshotFrom(records) {
  const meta = Object.fromEntries(records.meta.map(row => [row.key, row.value]));
  const rows = Object.fromEntries(SECTIONS.map(section => [section,
    records[section].sort((a, b) => a.position - b.position).map(record => record.value)]));
  if (records.meta.length === 0 && SECTIONS.every(section => records[section].length === 0)) return null;
  if (records.meta.length !== 4 || meta.created !== 1 || !Number.isSafeInteger(meta.next_action_order) ||
      !Number.isSafeInteger(meta.row_count) || !Number.isSafeInteger(meta.backup_bytes) ||
      records.settings.length !== 1 || meta.next_action_order !== rows.actions.length) fail();
  const state = { format: 'local-first-test-ledger', version: 7, owner: OWNER, ...rows, settings: rows.settings[0] };
  let actual;
  try { actual = metadata(state); } catch { fail(); }
  if (actual.row_count !== meta.row_count || actual.backup_bytes !== meta.backup_bytes ||
      SECTIONS.some(section => records[section].some((record, position) =>
        record.position !== position || JSON.stringify(record.key) !== JSON.stringify(rowKey(section, record.value))))) fail();
  return state;
}

export function scanTransaction(tx, callback, onFailure = () => {}) {
  const records = {};
  for (const section of STORES) {
    const req = tx.objectStore(section).getAll();
    req.onsuccess = () => {
      records[section] = req.result;
      if (Object.keys(records).length === STORES.length) {
        try { callback(snapshotFrom(records), Object.fromEntries(records.meta.map(row => [row.key, row.value]))); }
        catch (error) { onFailure(error); tx.abort(); }
      }
    };
  }
}

export function readSnapshot(db, optional = false) {
  return new Promise((resolve, reject) => {
    let result, failure;
    let tx;
    try { tx = db.transaction(STORES, 'readonly'); } catch { reject(new StorageError()); return; }
    tx.oncomplete = () => failure ? reject(failure) : result === null && !optional
      ? reject(new StorageError('uninitialized', '測試帳本尚未建立。')) : resolve(result);
    tx.onabort = () => reject(new StorageError());
    scanTransaction(tx, state => { result = state; }, error => { failure = error; });
  });
}

export function openLedgerDatabase(name) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(name, 7);
    const rejectSafe = message => {
      if (!settled) { settled = true; reject(new StorageError('storage', message)); }
    };
    request.onupgradeneeded = event => {
      const db = request.result;
      const tx = request.transaction;
      if (settled) { tx.abort(); return; }
      try {
        if ([2,3,4,5,6].includes(event.oldVersion)) {
          const previous = [...(event.oldVersion === 2 ? LEGACY_SECTIONS : event.oldVersion === 3 ? V2_SECTIONS : event.oldVersion===4 ? V3_SECTIONS : event.oldVersion===5 ? V4_SECTIONS : V5_SECTIONS), 'meta'];
          if (db.objectStoreNames.length !== previous.length || previous.some(section => !db.objectStoreNames.contains(section))) fail();
          for (const section of SECTIONS.filter(section=>!previous.includes(section))) db.createObjectStore(section,{keyPath:'key'});
          // Validate every original row and metadata in the upgrade transaction.
          // Empty new stores keep the original JSON v1 bytes and metadata intact.
          scanTransaction(tx, () => {}, () => {});
          return;
        }
        if (event.oldVersion !== 0 && (event.oldVersion !== 1 || db.objectStoreNames.length !== 1 ||
            !db.objectStoreNames.contains('ledger'))) fail();
        for (const section of STORES) db.createObjectStore(section, { keyPath: 'key' });
        if (event.oldVersion === 0) return;
        const old = tx.objectStore('ledger');
        let keys, state, marker;
        const migrate = () => {
          if (keys === undefined || state === undefined || marker === undefined) return;
          try {
            const full = checkedLegacy(state, marker, keys);
            addState(tx, full);
            const copied = {};
            for (const section of STORES) {
              tx.objectStore(section).getAll().onsuccess = event => {
                copied[section] = event.target.result;
                if (Object.keys(copied).length !== STORES.length) return;
                try {
                  const restored = snapshotFrom(copied);
                  if (new TextDecoder().decode(writeBackup(portable(restored))) !==
                      new TextDecoder().decode(writeBackup(portable(full)))) fail();
                  db.deleteObjectStore('ledger');
                } catch { tx.abort(); }
              };
            }
          } catch { tx.abort(); }
        };
        old.getAllKeys().onsuccess = event => { keys = event.target.result; migrate(); };
        old.get(OWNER).onsuccess = event => { state = event.target.result ?? null; migrate(); };
        old.get('created').onsuccess = event => { marker = event.target.result ?? null; migrate(); };
      } catch { tx.abort(); }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      if (db.objectStoreNames.length !== STORES.length || STORES.some(store => !db.objectStoreNames.contains(store))) {
        db.close(); rejectSafe('本機測試帳本結構不符合預期，請保留資料並停止操作。'); return;
      }
      settled = true;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => rejectSafe('無法開啟本機測試帳本。');
    request.onblocked = () => rejectSafe('請關閉其他驗證頁後重新開啟。');
  });
}
