# 統一定期支出與完整備份契約（0.19.0）

> 日餘拆分註記（2026-10-14）：本文保留原專案的歷史版本、日期、驗證結果及限制，不代表日餘本輪重測。現行程式磁碟目錄為 `web/`；HTTP仍為 `/local-first/`。Windows請雙擊根目錄 `start_local_first.local.cmd`，歷史 Python／Node 指令不是目前使用者操作入口。

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**

## 資料流與期數

原 `recurring_rules`（固定／訂閱／分期）與 `annual_rules` 保留原 ID、來源及欄位。`schedule.mjs` 以同一份唯讀快照推算各期，使用原日期驗證、月底處理及精確 cents。不補記、不保存查詢結果；到期當日才可記錄或略過。首頁總額按預定月份，消費月曆／統計按實際日期。已記錄但作廢的期數仍已處理，規劃貢獻為零。

每隔 N 日／週由首日加 N／7N 天；月／年由原首日推算，短月取月底，年度 2 月 29 日不永久改成 28 日。下一期超出 0001～9999 年時不繼續產生。期數索引從 0 起，最大 3652058；頻率為正安全整數，日期運算先用 BigInt 避免溢出或四捨五入。

新建／更改使用既有 `recurring_versions` 的新變體，欄位為 `id, recurring_id, from_index, first_due_on, unit, every, name, cents, category, payment_source_id, payment_source_name`。`recurring_id` 可引用兩種原規則；`unit` 僅 day／week／month／year。原 effective_month／due_day 版本形狀與限制仍可讀。更改凍結已到期及已保存的期數，再從下一個未到期且未保存的 index 生效；同一切點再次更改覆蓋該版本，不更改規則類型及分期總數。停用只凍結到期缺漏與原已保存歷史，不入帳，且不生成未來新期數。

`scheduled_periods` 欄位為 `rule_id, index, defaults, status, expense_id, revision`。`defaults` 僅 `due_on, name, cents, category, payment_source_id, payment_source_name`；保存後保留原預定值。status 僅 pending／skipped／recorded；未到期 upcoming 是畫面推算狀態，不是可寫入的狀態。略過可恢復，recorded 不可恢復或重建；付款引用 nullable 僅保留舊未指定快照，實際記帳仍需有效付款選項。

按原規則 ID＋索引唯一，recorded 的 expense_id 亦唯一。舊月付消費先映射原月份 index，舊年度期數先映射原年份；不能用衝突的新 pending／skipped 遮蓋舊已記錄消費。年度舊 defaults 及 recorded identity 不可被新版改寫。新固定／訂閱／分期消費保留原 source、recurring_id，period 為預定月份；只有明確 recorded 關聯允許同月多期及跨月實付。年度消費保留 manual／null 原語意，藉期數關聯辨識。軟刪除保留關聯；捷徑不得把年度關聯消費當成手動帶入來源。

## 儲存、驗證與還原

IndexedDB 原子升至 **v7**，新增一個 `scheduled_periods` store（鍵 rule_id＋index），共 **20 stores 含 meta**。升級驗證原資料與容量 metadata，只新增空 store，不寫期數或消費；原紀錄、順序、revision、標籤、收入、分配與付款名稱快照保留。損壞或被其他頁阻擋的升級拒絕且保留舊庫。

使用新版本變體或新期數時匯出 **JSON v6／十九類**，在原 v5 十八類後增加 scheduled_periods；沒有新資料仍按實際內容輸出 v1～v5，舊備份可於完全空白帳本原子還原。新版嚴驗欄位、型別、ID、關聯、唯一性、狀態、整數與日期，拒絕錯誤引用和舊期數復活。原九類及所有後續資料均不裁切。

沿用 **100000 列、64 MiB JSON**、正金額與 signed 64-bit cents／revision 上限；個別操作可因凍結大量歷史而整筆容量拒絕，不能只保存一部分。規則／期數 revision、雙連線衝突、交易完成才成功、request 成功後 abort 仍失敗、容量 metadata 同交易更新，均沿用原帳本工具。舊月付／年度的現代庫寫入入口安全拒絕，避免程式呼叫舊補記繞過逐期流程；純舊格式規則仍供相容測試使用。

加密封裝 **v1 不變**，解密後交同一完整備份驗證。每次匯出有新隨機參數；比較解密後內容，不能要求密文相同。**現有 Python 與舊 local-first 安全拒絕 JSON v6，不可刪除期數／版本欄位或改版本降級。** 本輪沒有擴張 Python／Discord 功能。

## 升級與復原

先自行保存草稿與完整備份，保持固定來源服務開啟至 18 個必要靜態資源完整下載，再關閉同來源全部舊頁重新開啟。快取為 `local-first-offline-0.19.0-v2`；不 skipWaiting、不強制刷新、不清除帳本。固定網址及原 IndexedDB 名稱不變。

若開啟失敗，保留原瀏覽器設定檔／網站資料，先停止操作查明原因；有可用完整備份時才在另一個全新空白設定檔以相同固定網址還原核對。加密只保護下載檔，備份密碼遺失無法取回。實測與未驗證事項見 [瀏覽器驗收](local-first-browser-validation.md)。
