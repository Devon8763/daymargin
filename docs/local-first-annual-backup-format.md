# 年度費用與完整備份 JSON v3

> 日餘拆分註記（2026-10-14）：本文保留原專案的歷史版本、日期、驗證結果及限制，不代表日餘本輪重測。現行程式磁碟目錄為 `web/`；HTTP仍為 `/local-first/`。Windows請雙擊根目錄 `start_local_first.local.cmd`，歷史 Python／Node 指令不是目前使用者操作入口。

0.15.0，2026-10-04。**僅供合成資料測試，請勿輸入真實帳目。IndexedDB 未加密，Python Web 尚未被取代。**

## 資料流與處理邊界

年度設定 → 唯讀推算到期年度草稿 → 使用者明確記錄或略過 → 同一 IndexedDB 寫入交易保存處理狀態。讀取、收入分配、搜尋、月曆、比較及匯出都不建立草稿列或消費。

- 每年按月／日重複，首次年份 1～9999，月份 1～12、日 1～31；沿用 `fixedDueDate` 的短月取月底。新設定金額為正數、最多十億元、最多兩位小數，儲存為精確 cents。
- 自到期月份開始，可處理尚未確認的草稿，包含歷年未處理期數。畫面每次先顯示 100 個期數，可繼續載入；不因切月消失。
- 經使用者確認：更改只影響尚未進入到期月份的期數。更改／停用交易先保存已開始且尚未保存的原草稿，再更改設定；未來設定的 `effective_month` 為操作當下台灣下月，不會因改成較早到期月而倒補新期數。已有年度快照不覆寫。
- 停用阻止未來新期數；既有已開始草稿仍能記錄／略過。略過只處理當年度；沒有重新啟用、背景排程、通知、已存金額或資產移動。
- 確認沿用新消費驗證，使用手動來源與原本消費欄位，建立消費、before=null 操作紀錄及年度處理連結，同一交易完成才回報成功。原草稿的停用分類／付款方式只能作參考，記錄新消費須另選有效選項。
- 確認後可沿用手動消費更改日期、內容／金額／分類／付款方式或軟刪除。年度連結維持「已記錄」，不因更改、撤銷或補記而重建；付款歷史快照沿用既有消費規則。
- 年度每月參考額為 `(cents + 11) / 12` 的 BigInt 整數除法，再精確顯示。與本月定期扣款建議分開，不寫入或覆蓋分配。往月不以目前年度設定重算，仍顯示當時已儲存分配。

## IndexedDB v4 與十五類 JSON

名稱、固定 `127.0.0.1:8768/local-first/` 及既有來源隔離不變。v4 保留原十三類 store，新增 `annual_rules`、`annual_periods`；含 meta 共 16 個 store。v2／v3 的升級在版本交易內重新驗證原資料、引用、容量與 metadata，空新 store 不改原備份 bytes。失敗完整中止，保留舊結構；v1 遷移契約仍支援。

`format` 維持 `life-ledger-backup`；JSON v3 為原九類 + [收入／分配四類](local-first-income-backup-format.md) + 下列兩類，禁止缺欄位或額外欄位。

| 類別 | 完整欄位 | 識別／限制 |
| --- | --- | --- |
| annual_rules | id, name, cents, category, payment_source_id, payment_source_name, first_year, due_month, due_day, effective_month, active, revision | id 與全帳本其他 id 不得重複；付款 ID 必須存在；名稱 1～200 字且無控制字元；active 為 0／1 |
| annual_periods | annual_id, year, defaults, status, expense_id, revision | key 為 annual_id＋year，唯一且規則存在；年份 1～9999 |
| defaults（內嵌快照） | name, cents, category, payment_source_id, payment_source_name, due_on | due_on 是有效日期且年份等於期數；與目前設定可不同，保留歷史原值 |

`status` 僅接受 pending／recorded／skipped。recorded 必須引用現有手動生活消費（可已撤銷），同一消費最多連結一個年度期數；其他狀態的 expense_id 必須為 null。保存的未來 pending 仍不得提前顯示／處理，核心按快照到期月份再檢查。revision 沿用 signed 64-bit 上限及舊狀態衝突拒絕。分類更改同步年度設定與所有快照並遞增相關 revision；付款更改不回寫歷史付款快照。

完整驗證仍共用 `backup.mjs`，cents 是正數十進位字串，匯入可保留合法 signed 64-bit 歷史精度；總列數最多 100000（不含 settings），明文完整 JSON 最多 64 MiB。JSON 深度、重複 key／ID、引用及形狀檢查沿用；不先寫入部分帳本。

## 相容與復原

沒有年度資料時仍選擇原 JSON v1／v2；有年度設定或期數就完整匯出 v3／十五類，不省略收入或歷史。舊 v1／v2 可在完全空白帳本原子還原，交易內再次檢查空白狀態。`.llbk` 的 [加密封裝 v1](local-first-encrypted-backup-format.md)、密碼導出／完整性驗證、容量與隨機參數不變；解密後仍交同一完整格式驗證。

**現有 Python 與舊版 local-first 不支援 JSON v3，安全拒絕，不會只還原九類而丟失年度資料。** 本輪不擴充 Python 帳務。勿修改版本、刪除新類別或降級瀏覽器程式來回存 Python。升級前保留完整備份及草稿，保持服務開啟完整下載，關閉此來源所有舊頁後重新開啟；SW 快取 `local-first-offline-0.15.0-v2`，共 16 個必要靜態資源。不要清除原網站資料。

手動復原驗收應使用合成帳本：下載新完整加密備份並親自確認檔案存在 → 在另一全新空白瀏覽器設定檔，以同一固定網址選該檔還原 → 核對年度設定、待記錄／略過／已記錄與原消費 → 關頁重開 → 再備份。程式只稱已發出下載要求；忘記密碼無法取回，密碼不代表 IndexedDB 加密，亦無法抵禦本機惡意程式、擴充套件或已解鎖電腦。實際驗證／未驗證見[本機驗證文件](local-first-browser-validation.md)。
