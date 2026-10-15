# 十項瀏覽器失敗：根因、修正與安全覆蓋｜2026-10-14

只修改日餘候選repo的測試、測試預覽白名單與文件。沒有修改產品核心、資料契約、CSP、原DiscordBOT、帳本或8768服務；C1保持。分類依實際斷言與後續重跑，不以B0同樣失敗作為略過理由。

2026-10-15使用者明確授權工具無法繼續時建立C2；以下「C2暫停」為當時紀錄，現改為帶著明列的未驗證限制提交，沒有把人工驗收改記通過。詳見validation.md。

後續固定入口：使用者確認原終端已關閉，測前8768空閒後完整入口8/8通過，測後8768空閒；沒有終止其他程序。此結果更新固定CLI限制，不能代替下文仍待完成的普通設定檔、實體檔案、滑鼠雙擊及合成回退驗收。

## 逐項根因

| 原失敗入口 | 分類與直接依據 | 最小必要修正 |
|---|---|---|
| local_first_annual_browser.mjs | 過時測試：先期待schema6，現行idb.mjs開啟11／26 stores；繼續後呼叫已退役updateAnnual/processAnnual。ledger.mjs的legacyScheduleOnly明確拒絕現代庫寫入。 | 固定期待11／26，保留真schema3升級與損壞回滾；有效舊年度資料必須拒絕舊寫入。用現行逐期API驗證年度交易，保留舊JSON v3十五類加密／還原。 |
| local_first_income_browser.mjs | 過時測試：Expected v6；版本斷言修正後完整七組收入交易與JSON v2十三類精確復原通過。 | 只改schema期待11／26及報告標籤，不改舊schema2種子、故障注入、revision、備份或回滾斷言。 |
| local_first_fixed_browser.mjs | 過時測試：現代snapshot.version固定11，updateFixed刻意經legacyScheduleOnly拒絕；0.19.0改為逐期確認，不能恢復自動sync繞過。 | 原檔入口仍保留，改驗證退役拒絕、現行固定逐期原生交易；舊純changeFixed規則測試保持。用實際交易保留64 MiB、100000列、配額、request-success abort、競爭、跨年時鐘及損壞拒絕。 |
| local_first_recurring_browser.mjs | 過時測試：updateRecurring的舊add/update/sync/stop現代庫入口已退役；舊自動月付成功不再是產品契約。 | 訂閱及分期各自跑現行逐期原生安全案例，舊入口必須拒絕；純changeRecurring舊格式與版本算法測試保持，不重新啟用自動補記。 |
| local_first_usage_browser.mjs | 過時測試：schema6斷言之後，仍用舊sync生成三種來源；改用排程後，完整備份自然選v6，而原測試仍期待v4。 | 保留schema4真升級及追蹤所有交易斷言；三來源明確逐期建立、作廢後重複確認拒絕。另檢查只有舊追蹤時仍輸出／加密v4十六類；含排程時完整v6十九類復原。 |
| local_first_storage_browser.mjs | 過時測試：空庫／header仍期待7；所謂future8已是支援的舊版本。 | 固定期待11／26，真正未來庫改為12。空庫不初始化、完整舊列順序／revision、未知欄位／marker、損壞／未知store及blocked升級保留原斷言。 |
| local_first_tags_browser.mjs | 過時測試：schema6與bytes相同寫在同一短路斷言，先因版本失敗，不能據此認定備份遺失；版本修正後舊bytes核對通過，再暴露舊sync及備份v5假設。 | 升級期待11／26；現行逐期生成來源，保留精確87／58 cents、標籤競爭／刪除／revision／配額／abort／容量。另保留舊v5十八類加密bytes，含排程完整v6十九類復原。 |
| local_first_schedule_migration_browser.mjs | 過時測試：最新schema升級已期待11，但最後restored.version仍期待10。改版本後最大index、null付款及精確bytes斷言通過。 | 只改最後版本及報告標籤；舊schema6原始keys／positions／metadata／JSON v5、三種損壞回滾及最大期數／null付款完整往返保持。 |
| local_first_usability_browser.mjs | 過時測試：全body不得有「選填」；page.mjs已有「連結目標（選填）」與「期間…自訂名稱（選填）」，屬後續有效功能。 | 只將無「選填」的檢查限於原本要驗證的expense-form；使用期間提示、必填標記、付款方式新增／編輯差異、規劃欄位及只讀草稿／完整備份斷言保持。 |
| local_first_entry_browser.mjs | 工具／測試方法與安全策略衝突：fetch(blob:)失敗；隔離診斷直接收到TypeError及securitypolicyviolation.effectiveDirective=connect-src。serve.mjs仍是connect-src self。 | 比照現有crypto UI測試擷取實際建立的Blob，核對Blob與下載href身分、MIME、固定檔名、UTF-8 bytes、完整備份及重開。恢復URL／click攔截器，即使測試失敗也清理。沒有放寬CSP；不冒稱實體檔落地驗收。 |

本十項未確認需要改變產品行為的缺陷。這是本批失敗的分類，不代表整個產品沒有缺陷。

## 安全與相容覆蓋對照

三份退休寫入測試仍保留原檔名及入口，共用tests/local_first_schedule_safety_checks.mjs，避免複製三套同一原生交易檢查。這是已有的實際測試共用需求，不是產品shared架構。測試預覽只新增此精確檔案的一個白名單映射。

| 舊安全目的 | 現行驗證位置／方式 |
|---|---|
| 舊格式算法、月底／跨年、月付版本、停用歷史分類、null日期、精確大整數／revision | 原test_local_first_fixed.mjs、recurring.mjs、annual.mjs及schedule相關Node純規則測試不改；原fixture完整讀取／原生復原及序列化bytes核對。 |
| 有效舊年度資料不能繞過逐期確認 | 真正可由純舊規則處理的y_old年度資料，update/disable/record/skip live writers必須unavailable，raw rows／metadata／備份不變。其他退役入口各操作也核對拒絕。 |
| 配額例外與request已成功後abort仍不可部分提交 | 固定／訂閱／分期／年度各自覆蓋add、update、disable、record、skip、resume；故障必須實際到達原生寫入，不能用提前拒絕假裝回滾；逐store原始列與完整備份相同。 |
| 兩連線、重複、過時revision | 同一期記錄僅一個成功、一筆expense/action/period；同revision修改／停用僅一個成功；過期修改、重複略過及作廢後重記均拒絕。 |
| 修改不能覆蓋開啟期數、停用不能刪歷史或偷偷記帳 | 重複未來修改只有一個from_index版本；已開啟defaults仍29 cents；停用不新增消費，已開啟期數仍可明確確認。 |
| 原交易時鐘必須在交易內取台灣今天 | 實際IndexedDB blocker令排隊修改跨2027→2028台灣午夜；from_index及新到期期數快照必須反映交易時點。 |
| 100000列及64 MiB UTF-8邊界 | 各種類確認可在100000精確邊界完整提交，超限原始列／metadata不變；固定suite保留64 MiB精確padding，測單筆edit/void、record/disable及固定與訂閱未來修改。容量的既有錯誤路徑不同：單筆limit、完整快照storage；不修改產品錯誤行為。 |
| 備份、加密、空白目標、損壞密碼及重開 | 保留舊v1／v2／v3／v4／v5相容斷言；現行完整v6精確復原，錯密碼／篡改拒絕、quota／abort空庫不留資料、非空拒絕、重開bytes不變。實體檔與普通設定檔仍另待驗收。 |
| 損壞既有資料不能自動修復或覆蓋 | 原生寫入已損壞規則的合成資料，現行操作安全拒絕，所有原始列保持；原schema損壞升級測試仍保持原stores及bytes。 |
| 白名單、CSP、XSS、唯讀及草稿 | 生產白名單與安全標頭不改；入口七項隨機埠安全測試、原UI／crypto／導覽／交易測試與備份bytes回歸保留。Blob修正仍核對實際輸出，不添加blob connect權限。 |

## 證據與尚未完成

- 前輪失敗矩陣保留於audit/browser-validation-results.json，本轮重跑另保存，不改寫前輪失敗為成功。
- 隔離Blob診斷只用了合成資料，已移除診斷插碼；沒有碰下載資料夾或使用者備份。
- 獨立模型覆核因帳戶額度限制沒有完成；本輪以逐項舊／新斷言對照及實跑核對，不能將未完成覆核寫成通過。
- 原8768與原普通瀏覽器帳本未操作；固定入口、普通設定檔實體加密檔、窄版及回退仍待維護時段。C2和目標交付仍暫停。
- 最終本輪結果：54/54直接入口、19/19額外情境、37份Node259/259及隨機埠靜態安全7/7通過；Node／靜態測試皆禁止讀取原目錄。7項vendor雜湊、2份fixture、114份非vendor JS語法、20個SW資源、Git diff檢查及原HEAD／refs／165份檔案不變通過。
- 57個原瀏覽器入口中，54個本輪重跑；原生更新與離線設定兩項前輪已通過，因產品資源未改本輪未重跑，不冒稱本輪結果；固定來源一項延後。新增共用檢查檔是工具模組，不是第58個獨立入口。
- 原10項失敗全部修正並通過，前輪JSON保留；本輪矩陣、額外情境、修正檔SHA-256及Blob診斷另見暫存audit/failure-repair-results.json。
