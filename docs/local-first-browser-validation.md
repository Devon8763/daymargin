# local-first 合成瀏覽器驗證紀錄

> 日餘拆分註記（2026-10-14）：本文保留原專案的歷史版本、日期、驗證結果及限制，不代表日餘本輪重測。現行程式磁碟目錄為 `web/`；HTTP仍為 `/local-first/`。Windows請雙擊根目錄 `start_local_first.local.cmd`，歷史 Python／Node 指令不是目前使用者操作入口。

## 0.26.6 分配預算對照與接近上限提示 — 2026-10-14

**只用隔離合成資料，不代表正式帳本驗收。** 實際起點0.26.5；分支`codex/localhost-web-auth`，HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`。原33個tracked修改、13個未追蹤路徑全部保留；本輪未stage／commit／push／PR／tag，未操作使用者25154／8767／8768來源，未讀寫正式SQLite、Token、`.env`或既有備份。

### 修改與重用

本輪19檔：`local-first/browse.mjs`、`budget-preferences.mjs`（新）、`page.mjs`、`index.html`、`style.css`、`serve.mjs`、`sw.js`；`tests/test_local_first_budget_hints.mjs`（新）、`test_local_first_budget_preferences.mjs`（新）、`local_first_budget_hints_browser.mjs`（新）、`local_first_preview.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`test_local_first_entry_server.mjs`；README、CHANGELOG及本文件。

- `monthBudget`沿用有效四來源及BigInt計算，增加嚴格選取月份參數供分配只讀對照；本月原呼叫者不變。零元仍是明確預算，分類-only不推算總額。分配與預算各自獨立，無名稱連結。
- 提示純規則使用`spent * 10 >= budget * 9`，不靠顯示百分比；0元無90%或進度。原`renderBudgets`摘要部分分成局部繪製，偏好切換不重建預算編輯表單。沒有首頁可見性覆蓋。
- 新偏好重用既有localStorage安全模式，獨立版本1鍵`daymargin.budget.v1`，1024字元上限／嚴格boolean與欄位；預設開啟，損壞讀取固定警告且不覆寫，寫入失敗保留舊值。既有首頁偏好不變，帳本／備份不保存偏好。
- 資料庫v11、完整JSON v1～v10及加密封裝v1不變；未改收入、分配、預算寫入、revision或交易。SW／固定靜態服務白名單加入唯一必要模組，共20資源，快取`local-first-offline-0.26.6-v1`。

### 本輪實際驗證

1. 先看見3個純規則測試失敗（選取月份取不到總額／缺少門檻規則），實作後通過；再看見3個偏好測試失敗、實作通過。原生UI先出現`Missing precise near-limit status`，再完成畫面。
2. 完整非固定入口Node **259/259**；隨機埠靜態安全 **7/7**（包含新偏好模組、Host／method／path、CSP、本機Chart.js）。首跑socket受沙箱EACCES阻擋，核准後重跑7/7；不把首跑算成產品失敗或通過。Ruff、**117**份非vendor JS語法、**7**份第三方雜湊及差異檢查通過。Node均使用Codex內建絕對路徑。
3. 25861新原生情境通過，使用隔離UUID IndexedDB：選取本月及歷史18,000／零元／category-only／未設定、總與分類精確90%提示、現有預算導覽及返回聚焦／分配草稿、提示關閉及儲存失敗不洩漏底層文字、分配999元超出0元實收仍保存且不改100元預算。只查詢／導覽／偏好前後原始所有列、metadata與完整備份逐位元組不變。延遲舊月份被較新月份擋住；首頁預算隱藏後，開關、消費更改／新增／軟刪除仍保持隱藏且摘要更新。
4. 同來源既有預算UI **4組**（歷史小數／停用／零元、下限與加總、跨連線revision、容量失敗不留半筆與XSS）及收入入口 **7組**通過，非沿用舊結果。
5. 25862代理直接操作桌面與375px iframe：鍵盤展開、預算導覽／返回、Space切換；未送出的分配777與預算123均保留。重新整理後提示關閉仍保存。375px iframe內容clientWidth360／scrollWidth360，已檢視桌面分配對照與窄版設定截圖，標題、文字、金額及開關未溢出。截圖僅為合成資料，位於忽略的`.tmp/budget-allocation-desktop.jpg`與`.tmp/budget-settings-375.jpg`。
6. 25862本版0.26.6的正式頁路徑，以畫面開始空白合成帳本、設100元總預算、記90元消費，確認近上限；關閉提示後停止本輪服務、關頁、從同網址離線開新頁，仍0.26.6／90元消費／剩10元／開關關閉，未清除網站資料。
7. 25863原生SW演練：兩頁0.26.6與未送草稿；測試0.26.7故意缺Chart.js安裝拒絕且舊快取／帳本不變；恢復完整資源後waiting，關一頁仍等待，關最後一頁自然啟用；停止本輪服務後同網址離線冷啟動通過。**20靜態資源、25類合成列、metadata與完整備份不變**；測試0.26.7僅標籤，不是新版發行。所有被停止的服務均為本輪25861～25863。

### 未驗證與手測

未跑固定8768 CLI（避免碰使用者服務）；未跑Python完整隔離回歸，因未修改任何Python或帳務儲存／備份程式。尚未驗證實體手機、螢幕閱讀器、真正斷網、普通全新瀏覽器設定檔、本版實體備份檔落地／還原及正式帳本。本輪無新增使用者手動確認，不能以歷史手測冒稱新版驗證。

使用原Windows雙擊啟動器，僅在另外準備的隔離合成來源手測：

1. 設100元總／分類預算，記89.99、90、100與100.01元的代表性消費，分別查看剩餘、即將用完、已用完及已超支；不要把四筆同時加總後誤認單筆邊界。
2. 規劃→收入與每月分配→展開分配，查看本月預算行；填未送草稿，查看預算後返回，核對原值。選過去月份核對YYYY-MM，無總預算不顯示。
3. 預算關閉接近上限提示並重新整理，90%只顯示剩餘；100%／超支事實仍在。首頁隱藏預算不應被提示打開。
4. 保存草稿與完整備份；新版完整下載後關閉此來源全部頁籤再開，確認版本及資料；不要清除網站資料。仍僅供合成資料測試，Python Web尚未被取代。

## 0.26.5 月曆收支呈現 — 2026-10-14

**僅供隔離合成資料測試，不代表正式帳本驗收。** 起點為實際0.26.4，分支`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`。原33個tracked修改、13個未追蹤檔完整保留，沒有新增路徑或暫存；未stage、commit、push、建立PR或tag。

### 實際修改與邊界

本輪12檔：產品`local-first/page.mjs`、`index.html`、`sw.js`；測試`tests/local_first_calendar_income_browser.mjs`、`local_first_preview.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`；文件`README.md`、`CHANGELOG.md`及本紀錄。

- 沿用原`showCalendar`／`showDay`與金額格式，不改`calendarMonth`、`searchAccounts`、`monthlyAccounts`、帳目資格或精確cents。雙記號由收入／支出各自存在與否決定，不由差額決定。無障礙名稱仍是完整日期及當日收支狀態，記號對輔助技術隱藏，避免重複朗讀。
- 只移除月曆每日差額文字；兩項合計與月曆明細加一次方向符號。共用帳目列以既有`daily`／`listId`辨認月曆，其他呼叫者保持原樣。三種篩選只改明細，保留更改、確認作廢及回到原月份／日期／類型。空狀態只縮短月曆，不改其他頁面。CSS未改，保留現有色彩，沒有新增色盤或全域樣式。
- 無新依賴、資料表、IndexedDB版本、備份格式或升級步驟；Python Web／Discord未改。快取`local-first-offline-0.26.5-v1`，仍19必要靜態資源，不強制啟用或刷新。

### 本輪代理實際驗證

1. TDD先在原生瀏覽器看見空月長句、舊「收／支」、每日差額及無方向明細的預期失敗，再逐項修正。相關純核心收支／月曆10/10保留，沒有為呈現變更調整核心期望值。
2. 完整非固定入口local-first Node **253/253**；隔離隨機埠靜態安全 **7/7**。明確不執行會占用固定8768的CLI測試；Node使用絕對執行檔`C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。Ruff、8份修改JavaScript語法及差異空白檢查通過，沒有自動修復或新依賴。
3. 原生IndexedDB月曆桌面／375px子頁面**各11組**。UUID測試帳本涵蓋四種消費來源、收入／支出各自存在、完全無資料、收支相等仍有雙記號、30,000.29／150.01元的精度與千分位、明細不重複符號、120筆完整明細、三種類型、正常空狀態、歷史付款名稱及惡意收入名稱安全文字。純查詢／導覽前後比較所有原始列、metadata及完整JSON備份內容一致；後續明確合成寫入測試另行驗證更改、雙擊確認、軟刪除、舊revision、延遲月份讀取與返回草稿，未刪原安全斷言。
4. 每月收支**9組**、收支搜尋**12組**、既有搜尋／月曆**11組**回歸通過；每月收支與搜尋正／負／零差額、50筆以外完整合計、rollback、安全錯誤及競態保護保留。新增月曆fixture另核對每月合計收入60,065.84元、支出30,170.86元、差額29,894.98元不變。
5. 使用本輪獨立24851／24853來源，不讀寫使用者21901或8768來源。代理實測375px iframe的Enter選日、全部／收入／支出切換、空月份「本月無記錄」及月份往返；摘要一直保留兩項合計。實際iframe375px、grid client／scroll均302，沒有橫向溢出。保存並檢視合成截圖；沒有將單元測試代稱為鍵盤或瀏覽器實測。
6. 另用真正表單在24851建立30,000.29元合成收入及150.01元合成支出，重新整理後日期格仍「14＋−」，選日兩項合計及方向正確。19項必要資源檢查通過；停服、關閉頁面、相同來源冷啟動後仍可選日／篩選，版本0.26.5及兩項金額正確，快取檢查前後帳本／metadata／完整備份不變。
7. 24853演練0.26.5→測試0.26.6（不是發行版）：必要Chart.js缺失時新版安裝失敗，舊頁及兩份未送出草稿保留；完整下載後waiting，關一頁仍waiting，全部舊頁關閉自然啟用。停服後新版冷啟動及收支／分析相容檢查通過；19靜態資源、25類原始合成資料／metadata／完整備份不變。只停止本輪自行建立的兩個測試服務。

### 合成資料手動驗收與限制

1. 確認使用的是合成帳本後，雙擊既有`start_local_first.local.cmd`；代理本輪沒有操作其8768來源。若顯示新版等待，先保存需要的草稿，等待完整下載並關閉此來源全部舊頁再開，不清網站資料或強制刷新；不需資料庫升級。
2. 準備只有收入、只有支出、同日收支及空白日期。日期格應只有日期和「＋／−」，即使兩筆金額相等也顯示兩個記號，鍵盤可選日期。
3. 選日確認只有收入／支出兩項合計，收入「＋」、支出「−」且只有一個方向符號；千分位及小數不變。切三種類型時合計不變，沒有明細顯示「無記錄」，空月顯示「本月無記錄」。
4. 更改或確認作廢後回原日期及類型；最後一筆作廢後對應記號消失。再到每月收支及搜尋確認差額仍存在。重新整理與離線操作只在已確認合成來源測試。

未重跑Python完整隔離回歸；未測固定8768 CLI、真實手機、螢幕閱讀器、普通瀏覽器設定檔、真正斷網、實體備份檔還原或正式帳本。沿用合成資料警語；本機IndexedDB未加密，Python Web未被取代，沒有把先前使用者手測或歷史通過數字列作本輪結果。

## 0.26.4 每月收支概況 — 2026-10-14

**只用隔離合成帳本；不是正式帳本、普通設定檔或實體手機驗收。** 起點實際0.26.3，分支`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`；原44個dirty／untracked路徑、0 staged完整保留。新增2個測試檔，最後46個路徑、staged仍空，HEAD不變；未stage／commit／push／PR／tag。

### 修改範圍與規則

本輪15檔：產品`local-first/browse.mjs`、`index.html`、`page.mjs`、`style.css`、`sw.js`；測試新增`tests/test_local_first_monthly_accounts.mjs`、`local_first_monthly_accounts_browser.mjs`，修改`local_first_preview.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`；文件`README.md`、`CHANGELOG.md`與本紀錄。所有既有收入、發票、備份、分類、月曆及其他未提交內容保留。

`monthlyAccounts`重用原`calendarMonth → searchAccounts → activeIncomes／activeExpenses`資格與日期規則；收入來源使用已儲存的`name`，分類使用原分類，不另設收入分類或推測／合併不同名稱。完整結果分組以BigInt加總，頁面只呈現，不在DOM內重新統計金額。每次查詢取得一次台灣今天、一次IndexedDB唯讀快照；當月截至今天，過去月份至月底。

沿用既有列／50筆呈現，僅增加唯讀選項以不顯示更改、作廢、捷徑或批次操作；使用期間、付款名稱及標籤取自同一快照。原搜尋／月曆操作入口仍有原身份、revision與交易流程，本輪沒有新增另一套更改或作廢。沒有新依賴、資料表、IndexedDB升級或JSON／加密格式變更；Python Web／Discord及正式SQLite不受影響。

### 本輪實際測試

- **TDD與自動測試**：先觀測6/6缺少計算介面的失敗，實作後與共用搜尋／月曆17/17通過。畫面先觀測「Monthly analysis entry missing」，接入原分析導覽後通過。初始合成發票關聯鍵不符合契約，由備份驗證安全拒絕；修正合成fixture鍵，沒有放寬驗證。完整非固定入口Node253/253、隨機連接埠靜態服務安全7/7、Ruff、113份非vendor JS語法、7項Chart.js／lossless-json授權資源SHA256及差異空白檢查通過。Node使用可用絕對執行檔路徑，不依賴裸node。
- **純規則**：嚴格月份／未來拒絕、跨年／閏年／月底、當日截斷、三種差額、收入／支出單側與空月份、停用歷史分類、多來源、四種已入帳支出、發票一次計入、作廢／未來／未知來源／非生活消費排除、草稿／分配／目標不計入。大值精確cents、完整超過50筆、分組與總額一致、不同集合同ID、來源不同名稱及輸入原狀不變均有測試。
- **原生IndexedDB畫面**：`/tests/local-first-monthly.html`與375px同來源子頁各9組；UUID隔離合成帳本，55筆薪資、另一來源、65筆四來源支出與發票關聯。每次查詢一份快照，分組完整合計／筆數與55／65筆可全部展開；展開不再讀庫、不執行惡意來源／分類／項目、不提供批次或編輯。無資料三項0元、無收入／無支出、過去／當月截至日期正常。
- **互動與故障**：月份／模式／搜尋往返保留原比較條件及記帳草稿，跳轉聚焦可見月份。無效／未來月份在資料庫查詢前拒絕且保留輸入；故意使IndexedDB讀取失敗時只顯示固定安全錯誤，不顯示私人底層字串或舊總額。延遲舊月份讀取不能蓋新月份；成功支出及收入寫入後使用提交完成的新狀態刷新，舊快照不能倒退結果或鎖住按鈕。純查詢、展開、模式切換前後全部store、metadata及完整明文備份逐位元組不變；合成競態寫入在不變性核對之後另行進行。
- **本輪既有瀏覽器回歸**：分析操作10組、收入月曆8組、收支搜尋12組通過，與新功能18組合計48組；原兩分頁舊revision、重複提交、交易abort與輸入保留等安全斷言保留，不以舊回報替代本輪結果。
- **代理實際畫面與鍵盤**：全新25841／25842／25843來源，未開啟或停止8767／8768。恢復工作時25841已停止，改用25842，不把連線失敗算成產品通過。桌面按Enter查詢與展開來源／分類帳目；保存並檢視`.tmp/monthly-desktop.jpg`及`monthly-narrow.jpg`。375px原生iframe的body client／scroll各360px，摘要堆疊、月份／文字／按鈕無橫向溢出。工具對子頁視外節點的點擊失敗，改用乾淨合成demo wrapper保存完整窄版；只調整測試wrapper，產品CSP不變。
- **更新／離線**：演練0.26.4→合成測試0.26.5（不是發行版），缺必要Chart.js時安裝失敗，兩舊頁、未送出草稿、帳本與備份保留；完整下載後waiting，關一頁仍等待，關全部舊頁自然啟用。停服同網址冷啟動與每月收支核對通過；19必要純靜態資源、25類合成資料／metadata／備份保持相同。另以最終0.26.4來源關頁、停服重開及完整資源核對，確認本月收入／支出0.29／0.29、差額0及空月份可用，無新增圖表或寫入。
- **未驗證／未執行**：沒有沿用使用者先前手測作為本輪代理測試。未操作固定8768 CLI、普通瀏覽器設定檔、實體手機／螢幕閱讀器、真正裝置斷網、停用JavaScript、實體備份落地還原或正式帳本。Python無本輪程式、資料格式或帳務變更，故沒有重跑Python完整隔離回歸，也未將過去結果列為本輪通過。測試程序只停止本輪自行建立的服務。

### 合成資料手測

1. 自行確認使用合成帳本後，雙擊既有`start_local_first.local.cmd`。若新版等待，先保存草稿，完整下載後關閉同來源所有舊頁再開，不清網站資料、不強制刷新。
2. 開「分析 → 每月收支」，預設台灣本月。選有資料的過去月份，核對收入／支出／差額，再展開收入來源與支出分類；超過50筆按顯示更多仍能查看全部。切換其他分析再返回，月份與原比較草稿應保留。
3. 查看無收入、只有收入及空月份；空月份應三項0元，沒有空圖表。未來月份須拒絕。用鍵盤Enter展開明細、按查看收支；快速切月不可回跳舊月份。
4. 首次完整快取後，關頁並停止自行啟動的服務，再用相同瀏覽器及網址重開；每月收支仍能查詢。只用隔離合成資料，不以此演練正式搬移。


## 0.26.3 分析期間卡與排版整理 — 2026-10-13

**僅供合成資料測試；不是正式帳本、普通瀏覽器設定檔或實體手機驗收。** 起點實際0.26.2，分支`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`，42個既有修改／未追蹤路徑、0 staged。保留全部既有內容，本輪新增2個測試檔；最後44個dirty／untracked路徑、staged仍為空，HEAD不變。沒有stage／commit／push／PR／tag。

### 本輪範圍與實際證據

- 修改17檔：產品`local-first/index.html`、`page.mjs`、`style.css`、`comparison.mjs`、`sw.js`；文件`README.md`、`CHANGELOG.md`、本紀錄；測試新增`tests/test_local_first_analysis_layout.mjs`、`local_first_analysis_layout_browser.mjs`，修改`local_first_analysis_controls_browser.mjs`、`local_first_analysis_ui_browser.mjs`、`local_first_preview.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`。既有收入、發票、備份、月曆等未提交內容完整保留，本輪沒有新增修改其規則。
- TDD：純計算缺少完整週／月／年選擇與精確差額接口先4/4失敗，再4/4通過；新畫面先失敗「period controls split across locations」，期間卡整合後通過。補負小數差額畫面先重現`0.-36 元`，最小修正分析專用文字格式後確認`-0.36 元`；BigInt計算不變。支出變化模式亦先重現不適用的比較組名仍顯示，補測試後只切換其hidden狀態，保留原草稿。
- 自動檢查：相關Node20/20含在完整非固定入口247/247；隨機連接埠靜態服務安全7/7，不執行會占8768的CLI。Ruff、111份非vendor JS語法、Chart.js與lossless-json共7項provenance SHA256及差異空白檢查通過。無新授權、依賴、資料表、IndexedDB或備份版本。
- 原生IndexedDB畫面fixture：期間卡桌面與375px各6組，既有分析操作10組、支出分析10組，本機Chart.js HTTP503失敗1組；合計33組畫面案例。UUID隔離合成帳本，包含65筆0.01元、另一月份0.29元、隱藏標籤、停用分類及惡意文字；純查詢與切換前後全部store、metadata及完整明文備份逐位元組不變。單筆更改後刷新、跨模式延遲查詢與寫入競態仍由既有回歸驗證，沒有刪除安全斷言。
- 期間卡驗證：本月／上月選單與完整日期相同，月份控制含閏年2月，週一完整週與完整年份不變；自訂日期、多組、多段、移除、組內去重、跨組重疊與自訂名稱保留。分類與關鍵字AND、收合仍顯示條件；兩組差額正／負／零與巨大值有純計算，負小數另有畫面斷言。未開始仍為尚未開始，錯誤日期在資料庫查詢前拒絕且保留輸入。
- 單一唯讀快照及完整65筆明細有計數檢查；切長條／折線／分類占比不再讀IndexedDB。Chart建構失敗及實際HTTP503保留精確摘要與每期表格、安全錯誤不透露底層細節。原純計算亦驗證超過安全繪圖精度時不丟棄精確文字資料。
- 代理實際畫面檢視：使用25781／25782／25783／25784／25785新隔離來源，未碰8767／8768。桌面1280px兩張477px卡片並排；375px同來源原生iframe兩卡上下排列，body client／scroll均360px。逐張保存並檢視`.tmp/analysis-default.jpg`、`analysis-custom-multirange.jpg`、`analysis-result-chart.jpg`、`analysis-narrow.jpg`，日期、選單、標題、長文字及按鈕均在所屬容器內；Tab可從期間選擇到可見開始日期。375px為iframe實測，不是真手機；只有測試wrapper允許同來源frame，產品CSP不變。
- 更新／離線：0.26.3→合成測試0.26.4（不是發行版）先模擬缺Chart.js安裝失敗，兩頁與未送出草稿保留；完整安裝後waiting，關一頁仍等待，全部舊頁關閉自然啟用。停服同網址重開後仍可分析與繪圖，19個必要純靜態資源、25類合成原始列／metadata／完整備份不變。另從最終0.26.3新來源完整快取後停服、關舊頁、重新開啟及分析，確認相同不變性；未skipWaiting、強制刷新或清資料。
- 本輪沒有把舊0.26.2／使用者手測結果算入上述通過數。未重跑Python完整隔離回歸（Python未改），未驗證實體手機／螢幕閱讀器、普通瀏覽器設定檔、真正裝置斷網、停用JavaScript或實體備份檔還原；沒有聲稱正式帳本可用。測試服務只停止本輪自己建立的來源。

### 合成資料手測

1. 自行確認使用合成帳本後，雙擊原`start_local_first.local.cmd`。若顯示新版等待，先保存需要的草稿，完整下載後關閉同來源全部舊頁再開；不清網站資料。代理沒有啟動或停止8768服務。
2. 開「分析」：預設「期間比較」，A本月／B上月，選單、月份與摘要應一致。改月份或週／年，再選自訂日期；只有自訂日期顯示起訖欄位，按「分析」才查詢。
3. 直接新增第三個比較期間、加入另一段日期並移除；在「更多條件」自訂名稱／關鍵字，分類選兩項，收合仍顯示已啟用條件。切三種模式再返回確認草稿與記帳草稿保留。
4. 看A／B總額與A−B，交換期間應看到負差額；未來期間不能當0元。切圖不重填條件，展開「統計明細」「每期資料與查看帳目」及超過50筆的下一批。
5. 用Tab／Enter操作，將畫面縮至375px確認上下堆疊。首次完整快取後停服務並關頁重開，分析與本機圖表仍可用。只使用隔離合成資料，不拿正式帳本進行這些步驟。


## 0.26.2 分析操作簡化 — 2026-10-13

**僅供合成資料測試；沒有正式帳本、真OAuth、實體手機或檔案還原驗收。** 本輪由實際0.26.1工作樹延伸，分支`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`未變。保留原31個tracked修改及7個未追蹤檔，index原本及交付均為空；不stage、commit、push或操作PR。

### 修改與驗證

- 產品：`local-first/index.html`、`page.mjs`、`style.css`、`comparison.mjs`、`sw.js`。僅新增常用日期帶入及操作狀態，統計仍重用原核心；三模式重用原表單，首段日期節點移到主要區，外移欄位以`form`維持`FormData`／`form.elements`契約。分類及進階條件收合，不刪除草稿；圖表控制在結果旁，詳情可展開。
- 測試：新增`tests/test_local_first_analysis_controls.mjs`、`local_first_analysis_controls_browser.mjs`；調整`local_first_preview.mjs`、`local_first_analysis_ui_browser.mjs`、`local_first_tag_monthly_ui_browser.mjs`、`local_first_comparison_ui_browser.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`。同步README、CHANGELOG及本文件，共18檔；無資料庫／依賴／備份格式變更。
- TDD：日期helper缺失先失敗後3/3；瀏覽器先重現沒有模式分流，再驗證每組時間帶入、跨模式草稿、舊比較互斥及標籤讀取取消後寫入的按鈕鎖定，最小修正後通過。唯讀程式審查指出的跨模式預設覆寫與取消查詢鎖定兩項已各有回歸測試。
- Node完整非固定入口243/243、隨機埠靜態安全7/7、Ruff、107份非vendor JS語法、`git diff --check`通過。使用本機絕對Node路徑`C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`；會使用固定8768的CLI測試未執行，並非完整固定入口驗收。
- 新操作fixture `/tests/local-first-analysis-controls.html`與375px同來源子頁面各10組。採UUID隔離IndexedDB、65筆合成標籤消費與另一月份支出，純切換／查詢／搜尋前後原始列、metadata及完整備份相同；額外合成寫入獨立驗證取消查詢後可再查。既有支出分析10組、標籤月分析6組、舊比較11組、全站搜尋14組通過，保留精確平均、歷史分類、完整明細、XSS及成功寫入後舊快照不得覆蓋的斷言。
- 使用獨立24621／24623／24625／24627來源，不操作8767／8768。瀏覽器視窗尺寸覆寫未改變實際1920px視窗，375px改以原生iframe驗證：實際內容寬375、分析區client／scroll各334，沒有橫向溢出；未放寬產品CSP，只有測試頁允許同來源frame。實測Enter展開進階／分類、模式切換、折線切換；本機資源503時支出及標籤各1組精確文字／帳本不變。
- 更新演練0.26.2→測試0.26.3（不是發行版）：Chart.js缺失時安裝失敗，原頁及兩份未送出草稿保留；完整下載後waiting，關一頁仍waiting，全部舊頁關閉自然啟用。停服冷啟動通過，19純靜態資源與25類合成資料／metadata／備份逐位元組不變。另以24627全新來源建立一筆0.65元合成支出，最終0.26.2停服後關頁重開，仍可查本月／上月及本機圖表。
- 額外Python完整隔離執行設有正式檔案拒讀與只准暫存SQLite的audit guard；只有FastAPI／Authlib的既有棄用提示，長時間未完成後中止本輪程序，沒有通過數可回報。未降低安全設定或新增依賴，未以歷史Python結果替代。
- 舊比較fixture重載時因來源已有合成帳本而安全拒絕，沒有清除它；改用全新24629來源重跑最終版本11/11。最後再核對107份JS語法、145個本機Markdown連結、Ruff、空白差異及版本一致性；工作樹33個修改、9個未追蹤檔（含既有工作），staged為空，HEAD未變。測試服務僅停止本輪自行建立的獨立來源。

### 合成資料手動驗收

1. 自行確認使用的是合成帳本，再雙擊既有`start_local_first.local.cmd`；本輪沒有啟動或停止其8768來源。若提示新版，先保存需要的草稿／自行備份，等待下載完整後關閉同來源所有舊頁再開，不清網站資料、不強制刷新。
2. 開分析，預設期間比較及本月／上月。填自訂組名、分類與關鍵字，切支出變化與標籤分析，再返回確認草稿保留、只顯示對應表單，沒有自動查詢；按主要查詢按鈕才取得結果。
3. 各組常用時間／趨勢近三月只帶入日期；標籤全部時間不被縮小。展開分類選兩項，收合仍顯示已選2項；進階加入組及不連續期間，收合摘要仍揭示啟用條件。
4. 結果先看總支出、兩種平均及一張圖；切圖不丟條件。展開完整期間、分類及帳目，超過50筆可繼續顯示；開啟進階的舊兩期間比較時，不同時攤開主要表單。
5. 用鍵盤Enter／Tab操作收合與選單；全站搜尋「支出變化」或「標籤分析」後，跳到對應可見控制。停服後已完整快取的相同來源重新開啟，確認分析與文字仍可用。正式來源、真正斷網、真手機／螢幕閱讀器、停用JavaScript及實體備份還原仍未驗證。

## 0.26.1 收入加入月曆 — 2026-10-13

起點為實際`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`、0.26.0，35個既有dirty／untracked路徑、0 staged。保留所有0.25.3／0.26.0及其他既有工作，不stage／commit／push／PR／tag。只使用新25571／25572合成來源、合成fixture與獨立IndexedDB，不操作8767／8768、正式SQLite、憑證／.env或使用者備份。

本輪修改15檔：產品`local-first/browse.mjs`、`page.mjs`、`index.html`、`sw.js`；文件`README.md`、`CHANGELOG.md`及本紀錄；測試新增`tests/test_local_first_calendar_income.mjs`、`local_first_calendar_income_browser.mjs`，修改`local_first_browse_browser.mjs`、`local_first_preview.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_update_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`。未修改income／ledger／backup／idb／comparison／CSV及偏好規則，沒有新資料表、備份版本或依賴。

- **本輪自動測試**：4組純計算先失敗再實作，涵蓋收入／支出專屬日、混合／空日、精確小數／巨大值、69筆、四來源、跨年／閏日、作廢／未來／投資／草稿排除、不同集合同ID及輸入不變。相關16/16包含在完整非固定入口Node240/240；另隨機連接埠靜態安全7/7，不啟動固定8768的CLI。Ruff、107份非vendor JS語法、7項vendor SHA256及`git diff --check`通過，原MIT授權與必要資源範圍不變。
- **本輪原生瀏覽器內畫面fixture**：桌面／375px各8組；先RED「daily type missing」及延遲切月蓋掉新寫入／選日，再實作GREEN。120筆完整每日合計、明細50筆分批可展開完整120筆、單側篩選仍保留三項全部合計；三種文字記號狀態、無金額日期格、完整ARIA日期狀態／圖例、未來及待確認草稿不標記、零／負差額、惡意名稱不執行。純瀏覽前後所有store、metadata及完整備份逐位元組不變；收入／支出原更改與確認流程返回同月／同日／類型並保留草稿、重複確認只寫一次、兩連線舊revision拒絕及輸入保留；首頁月曆hide/show/order仍同一DOM節點且不改帳本。
- **本輪既有回歸**：共用搜尋12組、舊月曆／搜尋11組、四區導覽10組通過。舊月曆首次同快照斷言失敗的原因是已確認要改為「當日有支出」而仍查「當日有消費」，僅同步該ARIA文案斷言，保留筆數及原帳本／備份一致性檢查。沒有刪除失敗的安全保護。
- **代理實際瀏覽器操作**：在新合成來源用Enter記錄收入10.29／支出3.1元，按日期Enter開明細、鍵盤切明細類型，三項始終10.29／3.1／7.19，日期同時有收／支記號。375px內容寬360／scrollWidth360，沒有水平溢出。
- **更新及離線**：以0.26.1→測試0.26.2演練，必要Chart.js資源缺失時安裝失敗，舊頁與兩份未送出草稿保留；完整下載後waiting，關一頁仍waiting，全部舊頁關閉後自然啟用。停服冷啟動仍有收入日期記號及選日收入0.29元，19個純靜態資源、25類合成資料／metadata／完整備份內容逐位元組不變。另實際0.26.1-v1完整必要快取檢查通過；停止25571本輪服務、關原頁後重開0.26.1，日期仍有收／支，Enter選日仍為10.29／3.1／7.19元，重做唯讀快取／原始列／metadata／備份不變檢查通過。0.26.2僅演練標籤，不是產品升版。
- **使用者手動確認與未驗證**：本輪沒有新增使用者確認，不借用舊驗收回報。未重跑完整Python隔離回歸、會用8768的CLI／啟動器雙擊、真實手機／螢幕閱讀器、普通新設定檔及實體備份檔還原。仍僅供合成資料測試，IndexedDB未加密，Python Web尚未被取代，差額不是存款或可用餘額。

合成手測：在全新瀏覽器設定檔，沿用Windows雙擊`start_local_first.local.cmd`及固定網址（不清原設定檔／帳本、不中止既有服務），確認頁面0.26.1；記錄同日收入10.29／支出3.1元，日期應有收／支、沒有金額，選日應顯示10.29／3.1／7.19；切單側明細三項合計不變。另查看無收入日／無支出日／空日、更改取消返回、刷新及自行核對離線重開。只用合成資料。


## 0.26.0 收入與支出共用搜尋 — 2026-10-13

起點實際`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`、0.25.3；30個既有dirty／untracked路徑、0 staged，全數保留。實際工作樹為`C:\Users\User\Desktop\DiscordBOT\.worktrees\localhost-web-auth`。本輪只用全新25461／25462來源與合成帳本，不開原8767／8768、正式SQLite、真實CSV、Token、.env或既有備份。

- 本輪修改16檔：產品`local-first/browse.mjs`、`income.mjs`、`page.mjs`、`index.html`、`sw.js`；文件`README.md`、`CHANGELOG.md`及本紀錄；測試新增`tests/test_local_first_account_search.mjs`、`local_first_account_search_browser.mjs`，修改`test_local_first_site_search.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`local_first_preview.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_update_browser.mjs`。沒有修改ledger、backup、idb、comparison或其他既有產品程式／格式；它們的既有dirty狀態保持，不是本輪新增。
- **本輪自動測試**：7組純查詢先RED（缺共用查詢）後GREEN，包含全部／單側、AND條件、跨年／閏日／兩端、不同集合同ID、四來源／作廢／未來／草稿排除、120筆與極大cents、正零負差額、身分注入、相關分類／標籤／功能契約。相關搜尋／收入子集29/29（包含在236，不另加總）；完整非固定入口Node236/236；隨機連接埠靜態安全7/7，不啟動8768的CLI占埠測試。Ruff、105份非vendor JS語法、7項vendor SHA256及差異檢查通過；依賴及授權檔未變。
- **本輪實際瀏覽器內測試fixture**：收支搜尋桌面／375px各12組，先失敗「default account type missing」；負差額、查詢／新寫入競爭及組字舊結果皆取得RED後修正。涵蓋原生IndexedDB單快照、原始所有store／metadata／完整備份不變、120筆／50筆批次、全選65筆支出、兩邊草稿、原更改／作廢／軟刪除、更換條件清除選取、雙連線舊revision、重複送出、quota拒絕、request-success後abort、安全讀取錯誤、惡意收入名及延遲舊查詢。另本輪重跑既有全站搜尋14組、批次7組、收入入口7組與定期收入5組。
- **代理透過瀏覽器操作**：用Enter建立合成收入、鍵盤切換帳目類型／展開清單；合成收入10.29、支出3.1、差額7.19元，混合全選只取1筆支出。375px內容body clientWidth360／scrollWidth360。更新演練0.26.0→測試0.26.1，安裝缺Chart.js會失敗而保留舊快取／兩頁草稿；完整下載waiting，關一頁不啟用，全部舊頁關閉才自然啟用；停服後同網址冷啟動仍可查到合成已收到收入。19個純靜態資源、25類原始合成列／metadata／完整備份內容逐位元組不變。演練標籤不代表升為0.26.1。
- **最終發行資源**：實際0.26.0-v1十九項必要快取檢查通過，含收支搜尋新介面；純檢查保留原始列／metadata／備份。沒有新增快取資料範圍或第三方請求，不快取帳目。停止25461本輪服務、關原頁後重新開0.26.0，仍能離線查詢收入10.29／支出3.1／差額7.19；重做快取／原始列／metadata／備份不變檢查通過。
- **環境過程**：初次375px嵌入被仍在執行的舊測試服務frame規則拒絕，重啟本輪服務才載入測試限定的同來源規則；正式頁frame-ancestors仍none。後續寬度972是測試用pre結果報告不換行，並非帳目列，改用p後360／360。不把這兩次失敗列為通過；修正並重跑後才記通過。
- **使用者手動確認**：本輪尚無新增使用者確認，不沿用0.25.3或更早手測作新版本通過。
- **未驗證**：未重跑完整Python隔離回歸（本輪不改Python）、會占8768的CLI、0.25.3標籤圖表完整畫面、真實手機／螢幕閱讀器、跨普通瀏覽器設定檔與實體備份下載還原。0.25.3原未完成驗收紀錄保留以下，這輪不是全產品正式資料驗收；仍僅供合成資料測試，IndexedDB未加密、Python Web尚未被取代。

合成手動驗收（使用全新普通瀏覽器設定檔，不開原帳本）：
1. 雙擊工作樹的`start_local_first.local.cmd`，以全新設定檔開固定網址；若入口已由使用者執行，不停止它。確認頁面0.26.0，等待完整更新後關閉同來源所有舊頁再開，不清網站資料。
2. 明確建立合成帳本，新增收入「合成薪資」10.29元及支出「合成早餐」3.1元。全站搜尋留空／全部後展開帳目，應顯示2筆、收入10.29、支出3.1、差額7.19；切收入／支出及日期／關鍵字核對。
3. 先在兩邊表單留下未送出合成草稿，再從收入／支出搜尋列進更改並取消，確認返回條件及草稿保留。更改／確認作廢後核對筆數及合計；全選混合結果只選支出，收入沒有勾選框。
4. 另一頁更改同筆合成帳目後，在舊頁儲存應拒絕並保留輸入；重新查詢。關頁重開與離線僅在合成來源測試，勿停止使用者現有服務。不要將差額解讀為存款或資產。


## 0.25.3 標籤每月分析 — 2026-10-13（畫面驗收待補）

- 修改產品：`local-first/comparison.mjs`、`page.mjs`、`index.html`、`style.css`、`sw.js`。計算重用tagReport完整四來源清單與原分析摘要；僅單一標籤，同筆消費不重計，日期首末仍含兩端。初始全部時間從第一筆符合消費所在月份計至今天，明確日期保留首末部分月；沒有歷史也未選開始日時不創造平均窗口。零消費月份留在含零平均，有消費平均另列；未開始月份不作零元，未結束月份截止今天。
- 修改測試：新增`tests/test_local_first_tag_monthly.mjs`與`local_first_tag_monthly_ui_browser.mjs`；更新`local_first_preview.mjs`測試白名單，以及離線／更新的`local_first_offline_settings_browser.mjs`、`local_first_update_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`。產品未增加靜態資源、依賴、schema或備份格式。README／CHANGELOG同步0.25.3。
- 實際純計算RED：7項因缺少analyzeTagMonths而失敗。實作後新增7項、比較／分析／標籤相關28項及完整非固定入口Node229項通過；子集不另加總。Ruff、10檔JS語法及git diff --check通過。極大整數維持BigInt，65筆加總不受50筆展示限制；原輸入物件不變。
- 入口測試實際跑出1通過／7環境失敗，錯誤為connect EACCES，含固定入口CLI案；測試子程序已結束，沒有將其記為入口安全通過。Python由既有`.tmp/stage0_guard.py`禁止正式資料／憑證與非暫存SQLite，完整回歸停在Windows asyncio socketpair，120秒輸出逾時後停止，沒有完成數。
- 新畫面測試已編寫，包含一份唯讀快照、兩種平均、隱藏標籤／惡意文字、長條／折線、單月完整帳目、圖表失敗、無效日期查詢前拒絕、未來及舊讀取失效；**本輪未觀測其執行結果**。升權重啟19343隔離預覽時自動核准審查因額度不足未完成；一般權限重啟後，內建瀏覽器仍連線逾時。沒有以工具限制為由降低CSP或改用使用者資料。
- 修改前已用19343隔離來源重跑舊0.25.2分析畫面10組並擷取趨勢／兩組比較表單，僅用於操作建議。此證據不能替代0.25.3新標籤畫面、375px、鍵盤、自然SW更新或停服冷啟動驗證。
- 手動驗收：沿用Windows啟動器與合成帳本，等待新資源完整下載並保留草稿，關閉同來源舊頁重開，確認0.25.3。在「分析 → 標籤每月分析」選單一合成標籤與任意日期，核對總額、月份數、兩種平均、長條／折線、每月資料與單月／全部帳目往返；修改日期時舊結果消失，無效日期保留輸入；最後停服／關頁／同網址重開再查。結果尚未由使用者確認。
- 未驗證實體手機、其他瀏覽器、讀屏、正式帳本搬移、本輪實體備份復原；資料庫與備份格式不變。保留所有既有未提交內容，未stage／commit／push。

## 0.25.1 店家規則與發票預設分類 — 2026-10-13

本輪修改檔案（23個已追蹤修改＋1個新測試，0 staged）：
- 程式9檔：`local-first/backup.mjs`、`csv.mjs`、`idb.mjs`、`index.html`、`ledger.mjs`、`page.mjs`、`rules.mjs`、`style.css`、`sw.js`。
- 文件4檔：`README.md`、`CHANGELOG.md`、`docs/local-first-browser-validation.md`、`docs/local-first-invoice-import.md`。
- 測試11檔：`tests/test_local_first_merchants.mjs`（新增）、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`local_first_invoice_browser.mjs`、`local_first_invoice_ui_browser.mjs`、`local_first_goals_browser.mjs`、`local_first_recurring_income_browser.mjs`、`local_first_schedule_migration_browser.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_update_browser.mjs`、`local_first_preview.mjs`。既有migration／更新測試僅同步schema、版本斷言或補相關新資料，不移除既有保護。


起點核對為`codex/localhost-web-auth`、HEAD `baf832728885c4ca292774800c5527c76c6a7bfc`、0.25.0，staged／未提交均為0。本輪不讀真實CSV、正式帳本、憑證、既有備份或8767／8768來源；只使用全新25342／25343隔離來源、合成測試帳本及既有合成格式fixture。測試完成停止本輪服務；未stage／commit／push。

- **自動測試**：新增5組單元測試先失敗（缺店名、建議、延後分類建立、規則交易與新備份），畫面先失敗「merchant management missing」，追加長店名窄版失敗測試並修正換行；實作後完整Node222/222。另使用`.tmp/usage-entry-checks.mjs`隨機連接埠安全7/7；刻意不執行會啟動8768的CLI占埠／啟動器測試。Python由正式資料／SQLite路徑audit防護完整隔離執行463/463；Ruff通過、非vendor JS101份語法通過、7項vendor SHA256及既有MIT授權通過、`git diff --check`通過。
- **本輪原生瀏覽器測試fixture**：10組，v9／v10→v11升級保留舊備份內容；雙連線重複發票／同名規則競爭；已撤銷不重建；重新讀取選項；分類與消費同交易；quota／request-success後abort；規則更改／移除回滾、舊revision；JSON v10加密記憶體往返與空白原子還原／資料庫重開／非空白拒絕。
- **本輪實際瀏覽器畫面fixture**：桌面及375px iframe各13組。新增／更改／確認移除店家規則、惡意店名只作文字、精確金額、分類建議、逐張覆寫不學習、預覽取消不寫入、50張分批保留完整選取、重複確認、錯檔及儲存錯誤保留輸入、停用發票→其他、兩者停用留空。窄版body寬360／scrollWidth360無水平溢出。
- **本輪代理透過瀏覽器操作**：以Enter新增合成規則；375px以Enter收合／展開管理入口；停服後管理可達，重新整理仍看到同一合成規則。更新演練以0.25.1舊頁／測試0.25.2新頁，資源故障不留下不完整新版，完整下載等待且保留兩頁草稿，只關一頁仍等待，全部關閉後自然啟用，停服冷啟動。19個靜態資源、25類原始資料列／metadata／完整備份內容逐位元組不變（比對明文帳本，不要求兩份隨機密文相同）。
- **最終發行資源再核對**：長店名換行修正後，0.25.1-v1完整19檔快取與帳本不變檢查通過；停止本輪25342服務、關閉原頁後開新頁，顯示0.25.1並保留「合成最終離線店」規則，離線再次只讀檢查原始列／metadata／備份不變。
- **使用者手動驗證**：本輪沒有新增使用者手測確認，不把先前下載或還原回報當成本輪結果。
- **未驗證**：實體下載檔落地／兩個全新普通設定檔同檔還原、螢幕閱讀器／真實手機、真實發票、正式帳本。原生加密往返不替代實體檔驗收。仍僅供合成資料測試，IndexedDB未加密、Python Web尚未被取代；格式限制見[發票契約](local-first-invoice-import.md)。


**已完成使用者縮小範圍的發票匯入／去重，含明細折扣；店家規則及退款仍未實作。只用合成帳本驗證，IndexedDB未加密，Python Web尚未被取代。**下方前兩階段紀錄保留當時狀態及數字，不冒稱本次重跑；目前資料契約與限制見[發票文件](local-first-invoice-import.md)。

## 實際完成及資料語意

使用者允許新真實案例作格式核對；只在記憶體中讀指定附件，輸出必要欄位、UTF-8、YYYYMMDD、開立已確認／折讓否、基本欄位重複及金額型態摘要，沒有輸出／保存真實日期、金額、店家、品名、載具、號碼或原CSV，沒有把真實檔選入頁面或帳本。最後一致性核對發現同號不同金額及負行；使用者釐清是同票品項／折扣，核對兩金額欄逐列相同、明細淨額正數後，先補RED再改按明細精確合計。整張只記一筆，不另加票總、退款或收入。相同明細不能判重則需核對手填，不靜默丟掉真實購買；無正數淨額排除。指定附件只純解析檢查且回報格式接受／是否需手填的布林，未輸出或保存內容。

已實作合成正常路徑：設定／資料管理預覽、逐筆排除／修正、確認摘要，再同交易寫消費、操作紀錄、發票關聯及metadata。多品項總額只計一次、合併品名；50張是呈現批次，完整選取最多1000張。重新預覽識別既有／作廢，重複或雙分頁競態整批拒絕、保留輸入提示重新載入。沒有店家規則、退款、API、上傳或新依賴。

相容性複核先用失敗測試重現舊不透明ID被錯誤解讀，放棄把發票意義塞進消費ID。最終DB v10／25 stores只新增invoice_imports(key,expense_id)，JSON v9／二十四類；舊v1～v8還原，無新資料仍按原格式，加密封裝v1不變。關聯只對應一筆存在的手動消費，含作廢歷史，嚴驗重複／錯誤引用。舊Python及本輪修改前最高v8讀取器安全拒絕v9，避免Python重編ID丟掉去重。未修改Python產品。

## 本次實際重新執行

| 檢查 | 結果 |
|---|---|
| Node核心 | 217／217，新增發票11項；第一輪缺API／畫面先失敗，v9及舊ID相容性各再重現後修正。含精確金額、跨年識別、畸形／超限／矛盾、作廢不復活、舊v1完整關聯保留及v1～v8讀取。 |
| Python完整隔離 | 正式檔案／憑證／非暫存SQLite防護下463／463，最終35.108秒；新v9拒絕且暫存SQLite完全不變。 |
| 原生IndexedDB | 發票7＋收入8／目標5／排程4，共24組；DB v9→v10與更舊結構、原始列／metadata／版本引用保留、雙連線一勝、已作廢不復活、配額與含關聯request成功後abort完整回滾、v9加密空白還原／重開／非空拒絕。 |
| 畫面 | 發票10＋導覽10／CSV7／定期收入5／批次7，共39組；375px子頁同10組再通過不重複加總，預覽有控制項時測無橫向溢位，實際body可用360px／scrollWidth360px；鍵盤開闔及桌面取消／確認亦實測。 |
| 靜態／授權 | Ruff、100個非vendor JS語法、7個既有第三方檔SHA-256及git diff --check通過；未新增套件或資源。 |

CSV舊回歸在已有合成帳本來源重跑時，fixture安全拒絕覆寫；另起新來源重跑7組通過。工具viewport設定沒有改變IAB實際寬度（仍1265px），已reset，改用真正375px同源子頁測試；測試頁僅放寬自己的frame-ancestors為self，正式入口CSP／X-Frame-Options未動。部分遷移fixture最早文字仍寫v9，但當輪實際assert為DB10／25 stores；已同步文字，沒有降低安全斷言。

## 代理工具實測：最終24類實體檔

全部使用新隔離來源25201～25210及合成資料。從磁碟的合成CSV預覽三個品項、兩張發票，修正第一張實付0.31元／日期，再由原生確認記錄兩筆，共1.34元；月曆只在實際2日／3日標記，不重複記品項。修改前先取消確認，不入帳。最終發票關聯方案在25204下載1733 bytes實體加密檔；25205空白帳本選同一磁碟檔，錯密碼拒絕、正確密碼24類預覽，確認還原。關閉產品頁並開新頁，再實際下載1733 bytes；兩份完整解密內容SHA-256相同，密文不同。只讀本輪新下載檔，未寫明文帳本；早期未採用ID方案的13／14號合成檔不當作最終驗收。

這是同一IAB內不同隔離來源，不是兩個全新普通設定檔或整個瀏覽器程序退出；沒有使用者本輪手動確認可引用。先前手測只保留歷史標記。

最新快取local-first-offline-0.25.0-v9，仍19個必要本機資源。25205舊頁顯示等待啟用且未送出0.01元草稿保留；停止本輪服務確認零監聽、關閉最後舊產品頁後，同網址新文件離線開啟並能到發票入口。測試輔助頁在worker範圍外保留唯讀基線，核對25 stores原始列、metadata與完整備份逐位元組一致；不把可離線當作新版已啟用，也沒有skipWaiting或強制刷新。

## 檔案與限制

本次續作碰觸原backup／csv／idb／ledger／page／index／sw、測試預覽及遷移fixture、既有Python備份測試與離線fixture。新增tests/test_local_first_invoice.mjs、local_first_invoice_browser.html／mjs、local_first_invoice_ui_browser.mjs及docs/local-first-invoice-import.md。README／CHANGELOG及收入契約同步；原0.24.2 Web兩檔未修改，所有歷史文件保留，.tmp／新合成下載未納入Git。

尚未實作店家規則及退款；不支援無法核對的金額模式、不完整非連續同票區塊或自動判定相同明細是否真重複。未驗證全新普通設定檔、其他瀏覽器／實體手機／讀屏、真實配額／磁碟故障、正式搬移或真OAuth；不能宣稱正式帳本可用或安全認證。不stage／commit／push／PR／tag。

---


使用者釐清後再跑桌面與375px各10組，合成100＋50－20只新增一筆130元消費；相同明細列預填空金額、確認被拒直到手填。此10組含之前8組，不另加總。實體1733 bytes兩檔驗收在相同最終DB10／JSON9關聯方案下完成；後續只修解析／提示，備份及加密資料契約沒有再改，不冒稱重新下載兩檔。

最新折扣修正後：Node217／217（2616.0785ms後再次2592.1583ms）、受防護Python463／463最終35.108秒、桌面與375px各10組重新通過。最新v9快取冷啟動第一次核對恰逢activate清理舊快取未完成，沒有清除或跳過等待；狀態穩定後核對通過，19資源及25 stores／metadata／備份不變。

# 0.25.0 收入記帳與每月定期收入 — 2026-10-12

**僅供合成資料測試；IndexedDB未加密，Python Web尚未被取代。**起點為`codex/localhost-web-auth`，HEAD`0a56ec7015bf89451daddaddf8b52f783fa983b5`；README／CHANGELOG0.24.2，local-first畫面／快取0.24.1。原5個未提交修改（README、CHANGELOG、本文件、web/routes.py、tests/test_web_ledger_backup.py）保留，後兩檔沒有本輪產品修改。下方歷史測試數字不當作本輪重新執行。

## 階段結果與資料流

1. 收入入口：原income-form／收入清單移到記帳區，與expense-form所在section同層、共同位於不可隱藏的記帳區塊。預設收入收合；收入記帳及分配月份分開，兩邊草稿保留。原收入交易、操作紀錄、修訂與作廢確認沿用；規劃提供原實收歷史／分配。6組新增原生測試先因入口不存在失敗，後再重現income被誤放在消費region內，最小移動原節點後通過；沒有另一套模型。
2. 定期收入：使用者確認每月固定日、短月月底／翌月恢復原日、略過可恢復、停用保留已到期草稿。新規則及修改走financeWrite；讀取只投影草稿，確認才在同一交易新增收入、原income_actions及recorded期數。更改／停用凍結已到期草稿，不改歷史收入；已記錄後作廢仍已處理。分配、目標ID、自訂項目與原建議排除不自動修改。契約見[收入與備份說明](local-first-recurring-income.md)。
3. 電子發票CSV：**暫停實作**。僅讀指定附件第一列表頭；未讀真實日期、金額、店家、品名或其他資料列。使用者確認財政部平台、YYYYMMDD及多品項分行；其補充是一般狀態背景，仍不能確證「折讓」是數值或註記，以及後續品項列是否留空基本欄位。沒有CSV匯入、去重或店家規則程式，不猜官方格式、不使用日期＋金額判重、不讀真實發票或上傳檔案。下一步需去識別化合成範例確認這兩項，及原始發票識別欄位的可用性。

IndexedDB v9／24 stores含meta，新JSON v8／二十三類新增income_rules與income_periods；舊v1～v7可空白還原、無新資料按原格式輸出，加密封裝v1及64MiB／100000列不變。舊Python對v8安全拒絕、暫存SQLite不變；不讓舊程式靜默丟掉資料。

## 本輪自動與原生測試

| 範圍 | 實際結果 |
|---|---|
| Node核心 | 206／206；新增定期收入8項先RED後GREEN，含短月／閏年、到期前、跨月實收、重複／舊revision、略過／恢復、停用／更改凍結、極端日期／容量、v1～v7及v8嚴驗往返；新增日期邊界測試先重現本月未到期草稿遺失，再修正延期生效仍保留原草稿。 |
| 隨機埠入口 | 7／7；只用隨機埠測白名單、CSP、Host／路徑／方法與錯誤；沒有請求或占用8767／8768。固定埠CLI占用／啟動器雙擊不列為本輪驗證。 |
| 完整Python | 正式檔案、憑證及非暫存SQLite防護下462／462；第一輪36.019秒、後續40.013秒、日期邊界修正後最終34.232秒，包含新v8解析／還原拒絕且資料不變，以及原0.24.2Web修正回歸。 |
| 原生交易 | 定期收入8組：v8→v9原子升級／舊bytes保留、兩連線確認一勝、作廢不復活、規則競態一勝、配額與request-success abort整筆回滾、略過／恢復／停用、加密記憶體及空白還原／重開。既有目標5組與排程遷移4組亦通過，含舊v6／v7結構到v9、損壞升級中止及舊引用保留。 |
| 畫面 | 新收入入口6＋定期收入5；既有收入10、導覽10、目標7、首頁偏好9、預算4、批次7，共58組通過。新11組在正式CSP的隔離來源再驗證；income-entry連結防止預設錨點重開頁，保留回歸斷言。 |
| 靜態及授權 | Ruff、97個非vendor JS語法、7檔既有授權資源SHA-256、版本及git diff --check通過。沒有新增依賴或第三方資源。 |
| 舊local-first | 從HEAD取得的v7讀取器，對本輪實體v8加密檔的解密內容安全拒絕；沒有用舊程式開啟新資料庫。 |

首次預覽在受限環境無法連線，停止本輪服務後以允許的本機執行重新啟動，沒有改防火牆或資料防護。升版後強版本／快取regex曾失敗，同步fixture後完整核心重跑通過，未刪安全斷言。原生還原fixture曾使用不符合現有合成還原契約的DB名稱，改用既有portable-checks測試目標，沒有放寬產品還原限制。

## 代理工具實際操作與實體檔

全部使用本輪新來源25151～25156及合成帳本。桌面鍵盤手動記錄0.29元已收、建立0.31元月付規則（只產生草稿、不改實收）、再透過原收入表單確認草稿，實收0.60元；消費、預算及分配仍未增加。375px原生子頁以鍵盤查看收入、規則更改、切區與0.01元未送出收入草稿保留；body可用360px、scrollWidth360px，無橫向溢位。最終離線頁以DOM檢查確認收入與消費是同層region。

畫面加密下載事件返回**本輪新檔**，在磁碟核對存在、1612 bytes；只讀取此新合成檔，複本放Git忽略.tmp。另一個完全空白隔離來源選取同一檔，錯密碼固定安全拒絕、未進還原確認；正確密碼顯示23類筆數，再確認原子還原。關閉該產品頁、新頁重開仍有兩筆收入、規則及已記錄期數，並再次實際下載1612 bytes。兩份解密後完整備份SHA-256相同、密文不同；不要求加密檔逐位元相同，未寫明文帳本檔。**這是代理本輪實測，但使用同一IAB測試瀏覽器內不同隔離來源，不能寫成兩個全新普通瀏覽器設定檔驗收。**此前使用者手動驗證僅沿用歷史標記，不冒稱本輪重跑。

更新測試以同一安全標頭的25155來源完整重跑：缺Chart.js時新版安裝失敗、無不完整等待／快取；完整下載後兩舊頁仍由0.25.0控制且保留草稿，只關一頁仍等待，全關後自然啟用。停服確認零監聽後，同網址新文件顯示合成測試0.25.1（非發行版），19資源白名單、23類原始列／metadata／完整備份逐位元相同。最早一輪混用預覽標頭，輔助頁最終檢查失敗，雖新頁載入仍不列為全套通過；一致來源重跑後才列通過。

最後日期邊界修正由原生8組及既有定期收入畫面5組在新隔離來源25156重跑通過。最終資源快取為`local-first-offline-0.25.0-v4`（19檔）。最後修正收入region的並列位置、明確區分期數預定／實收，v4完整下載仍等待，沒有強制刷新；關閉最後舊產品頁、停服同網址離線冷啟動，兩筆實收0.60元仍在、收入／消費同層可操作。另以唯讀檢查頁核對最終快取及原始列／metadata／備份不變；不把「可離線重開」當「新版已啟用」。

## 修改檔案與未驗證

- 產品7檔：local-first/backup.mjs、idb.mjs、income.mjs、ledger.mjs、index.html、page.mjs、sw.js；無CSS美化或Python產品更改。
- 新測試5檔：tests/test_local_first_recurring_income.mjs、local_first_income_entry_browser.mjs、local_first_recurring_income_browser.html、local_first_recurring_income_browser.mjs、local_first_recurring_income_ui_browser.mjs。
- 既有測試9檔：tests/local_first_goals_browser.mjs、local_first_income_ui_browser.mjs、local_first_offline_settings_browser.mjs、local_first_preview.mjs、local_first_schedule_migration_browser.mjs、local_first_update_browser.mjs、test_browser_portable_backup.py、test_local_first_offline.mjs、test_local_first_update_status.mjs。
- 文件4檔：README.md、CHANGELOG.md、本文件、新docs/local-first-recurring-income.md。原web/routes.py、tests/test_web_ledger_backup.py修改未動；原0.24.2文件段落保留。新合成備份、截圖、服務與測試產物只在忽略.tmp或本輪新下載，不stage。

未驗證電子發票格式／匯入／店家規則、實體手機、讀屏、其他瀏覽器／全新普通設定檔、整個瀏覽器程序退出、真磁碟配額／損壞、真OAuth及正式帳本。IAB直接window.confirm操作未完成觀測，桌面實收採「先更改草稿」後確認表單；預設直接確認由原生核心測試驗證，不冒稱普通瀏覽器人手確認。沒有讀取正式data.db、Token、.env、使用者瀏覽器帳本或既有備份，沒有stage／commit／push／PR／tag。合成驗證不是正式帳本搬移或安全認證。

---

# 0.24.2 Python Web 完整備份模組修正與合成搬移 — 2026-10-12

原0.24.1文件補充與歷史驗證保留在下方；本輪只修正Python Web搬移入口，local-first產品程式、畫面版本、離線快取、IndexedDB及備份格式均未改。

實際瀏覽器檢查發現Web備份頁的`download.mjs`連鎖匯入`backup.mjs → usage.mjs → schedule.mjs`，但`/export/ledger/modules/`白名單漏掉後兩個檔案；`usage.mjs`回404且按鈕維持停用。新增測試沿本機靜態匯入逐一請求Web模組路由，先重現404後補齊兩檔，仍只服務明列檔案、拒絕其他路徑。

用`tests/web_ledger_backup_preview.py`提供**合成SQLite／OAuth替身**Web來源，另起隨機本機埠的local-first預覽；兩邊各使用全新、分開的Chrome持久設定檔。Web從本人帳本輸出JSON v1／九類、六筆消費，其他帳號專屬資料不在匯出內；頁面以本機Web Crypto加密，瀏覽器下載事件成功且檔案實際保存至磁碟。local-first空白設定檔選取**同一磁碟檔**，錯密碼拒絕且不進入確認畫面，正確密碼後顯示九類摘要並還原。還原後、關閉測試Chrome程序並重開後，以及再次由local-first頁面加密下載後，完整明文備份SHA-256均為`016aca0af5c135547a1b8aab300b108e5d6bdca8ac96ee3f8b6c244d58c9388b`；兩份密文各4706 bytes，因隨機參數不同不要求密文相同。臨時設定檔與加密測試檔保留在Git忽略的`.tmp/web-to-local-v1-artifacts/`，沒有操作固定8768來源。

新增模組鏈測試先RED（`usage.mjs`回404）再GREEN；正式檔案防護下的完整Python隔離測試461／461、非固定入口local-first Node198／198、Ruff與`git diff --check`通過。需要重啟Python Web才載入白名單修正；local-first不需更新快取或初始化帳本。**尚未**以真OAuth／正式`data.db`／使用者瀏覽器設定檔驗證，也未測其他瀏覽器、實體手機、真實配額或磁碟故障。此結果只補上合成搬移路徑，不能宣稱已安全取代Python Web；不應清除原帳本。

---

# 0.24.1 有效消費／月曆首頁開關與排序 — 2026-10-09

## 後續補充：JSON v7 加密實體檔復原驗收 — 2026-10-09

此段是0.24.1提交後另做的**合成資料驗收**，不改產品行為或版本，也不取代下方原本各輪的「當時未驗證」紀錄。使用兩個新建且不同的Chrome持久設定檔、同一個隨機`127.0.0.1`測試來源；未開啟固定8768來源或使用者帳本。A在實際頁面建立12.34元合成消費及已存29.15元的合成目標，確認匯出為JSON v7／21類，再由頁面預設加密流程下載；瀏覽器下載事件成功，`.llbk`檔已保存至測試磁碟目錄，檔案為1473 bytes。

B在完全空白設定檔從**該磁碟檔**選檔；錯密碼顯示安全錯誤且不進入還原預覽，正確密碼後顯示v7與21類筆數，再確認還原。還原後完整明文備份與A相同；關閉B整個測試Chrome程序、用同一設定檔重開後仍相同。B再次透過頁面下載加密檔，實際保存1473 bytes；兩份加密檔因每次隨機參數不同，解密後的完整備份SHA-256均為`a27ede77caaa3e9b2cef822522b8897b060abd52b333789a261196786b9c1056`。兩個臨時設定檔的IndexedDB均為未加密合成資料；磁碟下載檔均為加密格式。測試檔位於Git忽略的`.tmp/v7-physical-restore-artifacts/`，沒有加入版本控制。

此驗收只證明目前Chrome／合成資料的v7實體檔路徑；未測正式帳本搬移、真磁碟故障或配額耗盡、其他瀏覽器／實體手機，也不能保證日後使用者自行下載與保存成功。IndexedDB仍未加密，舊Python仍安全拒絕v7；**仍僅供合成資料測試，Python Web尚未被取代。**

**僅供合成資料測試；IndexedDB未加密，Python Web尚未被取代。**起點仍是`codex/localhost-web-auth`、HEAD`880bf535216c09f433cccf2e240791db5966b3f6`、實際0.24.0，原25個修改與11個未追蹤檔完整保留；在既有`.worktrees/localhost-web-auth`工作，不另建worktree，不stage／commit／push。

## 最小變更及舊偏好

偏好新增expenses／calendar兩個固定區塊，預設true並接在原七區尾端；原搜尋／記帳仍不允許隱藏，其他偏好規則不改。有效消費沿用expanded.expenses，expanded不加入calendar。原九份節點由固定註解homeAnchor定位，排序不再依附可移動的有效消費。沒有建立新月曆頁、重複節點／事件或新的計算。

保留`daymargin.home.v1`來源鍵，內容格式v1→v2。先嚴格驗證完整舊v1（七個唯一固定ID、五個visible、六個expanded、合法shortcut_count及完整頂層欄位），再於記憶體追加兩區；其餘設定逐項保留，不修改儲存內容。明確保存才寫v2。舊格式缺欄位、混合新欄位、未知ID、重複ID、非法型別／損壞皆安全回預設；沒有以忽略規則放寬解析。不觸碰IndexedDB／帳本／metadata或完整備份，也無新增依賴。

## 本輪修改14檔

- 產品4檔：`local-first/home-preferences.mjs`、`local-first/page.mjs`、`local-first/index.html`（頁面版本）、`local-first/sw.js`（快取版本）。
- 測試7檔：`tests/test_local_first_home_preferences.mjs`、`tests/local_first_home_preferences_ui_browser.mjs`、`tests/local_first_preview.mjs`、`tests/local_first_offline_settings_browser.mjs`、`tests/local_first_update_browser.mjs`、`tests/test_local_first_offline.mjs`、`tests/test_local_first_update_status.mjs`。後五檔只同步候選版本／快取，不改產品範圍。
- 文件3檔：`README.md`、`CHANGELOG.md`、本文件。沒有新增檔案；其他既有未提交內容仍保留，不當作本輪新增。

## 實際驗證

| 檢查 | 本輪結果 |
| --- | --- |
| TDD偏好核心 | 6項通過；新九區預設與舊格式保留先RED後GREEN，完整保留舊顯示、順序、shortcut_count、所有expanded且載入不寫；部分／偽造v1仍拒絕 |
| Node完整local-first | 198／198；另隨機本機埠入口安全7／7，不占用固定8768，固定CLI案例未驗證 |
| 原生畫面 | 新9、舊偏好4、損壞3組；各自隱藏／恢復、原節點身分、9區唯一、互換原插入位置、必要區塊、隱藏後搜尋與來源捷徑焦點；偏好／純導覽禁止財務transaction，財務原始列／metadata／完整備份逐位元組一致 |
| 舊畫面回歸 | 導覽10／捷徑15／使用期間8／預算4／批次7／目標7／分析10，共61組通過；未停用原安全、XSS、revision、衝突或rollback檢查 |
| Python完整隔離 | 460／460，39.015秒；使用正式data.db／Token／.env禁止、SQLite僅暫存的既有verify wrapper，跳過根dotenv後執行原隔離runner。中斷前執行輸出無法取回，已重跑，不使用先前未知結果 |
| 靜態／文件 | Ruff、修改JS語法、差異空白、相對md連結及README／CHANGELOG／頁面／worker版本核對 |

## 桌面／375px、重載與離線

只使用24341獨立本機來源，原生測試使用UUID合成帳本。實際產品頁明確建立0.29元「合成兩區驗證」為基準，這是測試寫入、不稱為唯讀；之後首頁偏好只寫localStorage。桌面1265px與375px原生iframe（內容360px）用滑鼠／Enter更改兩區顯示與排序，九區無重複，兩者scrollWidth等於clientWidth。月曆仍顯示10月9日有效消費記號，兩區隱藏後搜尋仍找到原0.29元帳目。

整頁重載確認兩區隱藏與順序、有效消費expanded=true保留，再各自恢復顯示；舊v1任意七區順序、捷徑數7與各種展開值以原生legacy案例確認完整保留，載入後原儲存字串未改。截圖`.tmp/home-extension-desktop.png`與`.tmp/home-extension-375.png`是忽略的合成產物，不入Git。

快取`local-first-offline-0.24.1-v1`仍19個必要白名單資源，無新資源／schema。停止自己的預覽並確認24341無監聽，關閉自己產品頁後以相同網址開新文件，順序、顯示及有效消費展開仍保留；離線也可隱藏並恢復兩區。原生audit確認22類含metadata原始列／完整備份及最後偏好字串相同，未把偏好放進備份或worker快取。這不是重啟整個瀏覽器程序、換設定檔或手機飛航模式。

更新先保存／自行保留草稿，等下載完成，關閉全部同來源舊頁再開，不skipWaiting、不初始化帳本。未實測實體手機、讀屏、其他瀏覽器／設定檔、清除網站資料、瀏覽器程序重啟、固定CLI案例、正式帳本、真OAuth／Discord或實體備份還原；沒有讀寫正式data.db、Token、.env、既有備份／匯出或使用者來源。

---

# 0.24.0 簡易首頁自訂與設定整理 — 2026-10-08

**僅供合成資料測試；IndexedDB未加密，Python Web尚未被取代。**起點`codex/localhost-web-auth`、HEAD`880bf535216c09f433cccf2e240791db5966b3f6`、實際0.23.0，原24個修改與8個未追蹤檔完整保留。訊息省略了`.worktrees`的點，仍在既有`.worktrees/localhost-web-auth`實作；不stage／commit／push／PR／tag。

## 行為與邊界

設定順序為編輯首頁、分類、付款、標籤、資料管理。原分類／付款控制仍受同一`settings-fields`保護，保留表單、草稿及交易；資料管理內有原生隱私details，首次使用可將同一份原說明移到原首次使用頁，返回後移回，沒有複製或刪除風險提示。

只提供七種固定首頁區塊的順序：搜尋／記帳不可隱藏，其餘五種可選；有效消費／月曆保持原有位置，不提供任意模組。目標摘要為同一state的唯讀呈現，預設不顯示；原規劃目標功能保留。預算額外的原始未設定規則不被偏好覆蓋。捷徑管理是同一DOM表單，首頁／設定間移動；隱藏首頁仍可操作。失效卡片不在功能搜尋留下無法到達的投影，規劃原入口保留。

`home-preferences.mjs`只處理固定v1偏好：order、五個visible、非負安全整數shortcut_count、六個摘要expanded。來源localStorage鍵`daymargin.home.v1`，不含財務、姓名、帳目或憑證；不import帳本／資料庫，沒有儲存API。嚴格拒絕未知／缺少欄位、重複／未知區塊、舊版本、不合法型別與過大JSON；回到完整預設並固定提示。儲存失敗只影響本頁外觀，不更動財務與舊儲存內容；舊有效偏好可能仍存在。摘要預設只在初始化套用，儲存偏好後要下次開頁才套用摘要狀態，不壓過當下手動收合。

## 本輪修改17檔

- 新增：`local-first/home-preferences.mjs`、`tests/test_local_first_home_preferences.mjs`、`tests/local_first_home_preferences_ui_browser.mjs`。
- 產品／入口：`local-first/index.html`、`local-first/page.mjs`、`local-first/style.css`、`local-first/sw.js`、`local-first/serve.mjs`（只補新靜態資源白名單）。
- 既有測試／預覽：`tests/local_first_navigation_browser.mjs`、`tests/local_first_preview.mjs`、`tests/local_first_offline_settings_browser.mjs`、`tests/local_first_update_browser.mjs`、`tests/test_local_first_offline.mjs`、`tests/test_local_first_update_status.mjs`。
- 文件：`README.md`、`CHANGELOG.md`、本文件。其他既有修改不是本輪新增；沒有修改財務核心、schema／IndexedDB版本、備份格式、加密或Python。git總工作樹含原修改，勿只依HEAD差異認定本輪範圍。

## 本輪實際測試

| 檢查 | 結果 |
| --- | --- |
| 新Node偏好 | 4項先RED後GREEN：新來源預設、來源內保存／另一來源預設、必要區塊／未知／重複／舊格式／損壞拒絕、拒絕讀寫安全回退 |
| 全Node核心 | 196／196；新資源白名單順序修正後整套重跑通過 |
| 入口安全 | 隨機127.0.0.1埠7／7；沒有啟動或停止固定8768 CLI，該CLI占用案例未驗證 |
| 新原生畫面 | 8組先RED後GREEN，加損壞偏好3組；原生localStorage與IndexedDB合成帳本，禁止偏好／導覽開financial transaction，原始列／metadata／完整備份一致。核對可見管理表單與焦點，不只檢查預填值；未設定摘要、來源捷徑及隱藏搜尋問題有具體失敗再修正 |
| 舊原生畫面 | 導覽10、捷徑15、使用期間8、預算4、批次7、目標7、分析10，共61；原始驗證／XSS／revision／衝突／Quota／rollback斷言保留，僅更新設定隱私的實際新呈現 |
| Python | 受正式data.db／Token／.env防護，SQLite僅暫存，根dotenv跳過後執行原完整隔離runner：460／460，38.422秒；既有套件deprecation警告保留，未改依賴 |
| 靜態／文件 | Ruff、修改JS語法、`git diff --check`、相對md連結、README／CHANGELOG／頁面／worker版本核對 |

原生拒絕寫入案例是注入Storage.setItem的Quota錯誤，讀取拒絕為單元替身；不宣稱真實磁碟／瀏覽器政策故障已驗收。測試只在隨機DB名與24241／24242來源操作，測試偏好最後移除自用鍵，不清除帳本／網站資料，也不開使用者來源。

## 真實產品頁、375px與離線

產品頁在本輪24241來源手動建立0.29元合成消費、同一來源建立捷徑，以及100元／已存1.23元合成目標；這些是明確測試寫入。完成後開唯讀審核頁作基準，再調偏好、排序、展開隱私與導覽，22類含metadata原始列／完整備份逐位元組不變。沒有把新增消費／目標／捷徑稱為帳本不變。

桌面1265px與375px原生iframe（內容360px）實測上移／下移滑鼠及Enter、五區順序、資料管理直接閱讀、目標摘要、捷徑上限4、未保存記帳草稿。兩者scrollWidth等於clientWidth，無頁面橫向溢位。照片在忽略的`.tmp/home-settings-desktop.png`、`.tmp/home-settings-375.png`，不入Git。

整頁重新整理後排序／隱藏／4個快捷上限及目標／有效消費摘要預設展開保留；手動關閉摘要、切區不會強行重開。另一個新來源24242仍預設3、搜尋在記帳前且目標不顯示，沒有按開始記帳。沒有清除網站資料或更換真正瀏覽器設定檔。

快取`local-first-offline-0.24.0-v2`有19個必要靜態資源，只多一個小型偏好模組；偏好與帳目不納入worker快取。候選v1→v2自然下載／等待，關閉自己的全部產品頁後啟用，不skipWaiting；原生核對全部資源、新偏好內容及舊快取移除。停止兩個本輪預覽、確認24241／24242零監聽，再從同網址新文件離線開頁，順序、隱藏、上限4、摘要預設與直接隱私閱讀可用；帳本、metadata、完整備份及localStorage偏好字串再次一致。不是重啟整個瀏覽器程序，也不是實體手機飛航模式。

更新先儲存或自行保留草稿，等資源完整下載後關閉同來源全部舊頁再開；不初始化帳本。偏好與帳本各自分離，完整備份不攜帶首頁偏好；不要為清除偏好而清除正式帳本來源。

未實測真正清除網站資料、換瀏覽器／設定檔、讀屏、實體手機、瀏覽器程序重啟、固定入口CLI案例、真OAuth／Discord、正式帳本或實體備份還原。已保留無關內容，沒有接觸正式data.db、Token、.env、既有備份、匯出或使用者資料。

---

# 0.23.0 支出分析 — 2026-10-08

**僅供合成資料測試；IndexedDB未加密，Python Web尚未被取代。**從實際分支`codex/localhost-web-auth`、HEAD`880bf535216c09f433cccf2e240791db5966b3f6`、未提交0.22.0開始，保留原22個修改與6個未追蹤檔。使用者訊息中的`DiscordBOT.worktrees`不存在，沿用已確認的`.worktrees/localhost-web-auth`。本輪不stage、commit、push、PR或tag。

## 功能與精確資料

既有`comparison.mjs`增加唯讀`analysisPeriods(unit,start,end)`／`analyzeExpenses(state,input,today)`，重用`activeExpenses`、`literalMatch`、`ordered`及既有分類／日期／cents驗證，沒有另建SQL或帳本規則。日期選取所在的完整週／月／年，週以台灣今天及週一起點定義；一次只使用一個單位。比較組可含多段連續或不連續範圍，按期間去重，同一組同筆只計一次；跨組各自計算，逐期間標示重疊。

每組總額、最高／最低取自所選已開始期間，最低包含零；所選期間數包含未來，有消費期間數只算正額消費。所有已開始期間平均的分母是已開始期數，有消費期間平均的分母是正額期數，分子均為同組去重後總額；保留BigInt分子／分母，顯示取到分的非整除平均加「約」。完全未來不是零、沒有分母就是無法計算；未結束只統計截至今天，保留不等長提醒。金額不從畫面字串或50筆清單加總。

一次顯示一張長條／時間折線／所選期間圓餅；期別表、分類小計及帳目始終可讀，超過安全繪圖精度不畫假數據。帳目每批50筆可展開全部，分類付款名稱使用原保存值。無消費有正常空狀態。既有兩期間比較只改為原生收合入口，原計算與圖表保留；單一標籤分析不改。身分範圍是這一份已驗證本機帳本，不新增多帳號；查詢外部`user_id`欄位安全拒絕，不影響範圍。

修正分類改名後的分析篩選／查詢同步，包含自定與內建分類；儲存開始取消待完成舊分析，避免延遲快照覆蓋儲存後結果。純分析與導覽不寫入、不補記定期消費，記帳草稿保留；測試中明確建立／改名屬合成寫入，與唯讀不變檢查分開。

## 本輪修改清單（16檔）

- 產品5檔：`local-first/comparison.mjs`、`local-first/page.mjs`、`local-first/index.html`、`local-first/style.css`、`local-first/sw.js`。
- 新增測試2檔：`tests/test_local_first_analysis.mjs`、`tests/local_first_analysis_ui_browser.mjs`。
- 既有測試／預覽6檔：`tests/local_first_preview.mjs`、`tests/local_first_comparison_ui_browser.mjs`、`tests/local_first_offline_settings_browser.mjs`、`tests/local_first_update_browser.mjs`、`tests/test_local_first_offline.mjs`、`tests/test_local_first_update_status.mjs`。
- 文件3檔：`README.md`、`CHANGELOG.md`、本文件。未修改`ledger.mjs`、`browse.mjs`、資料庫／備份／加密核心或Python；這些檔案原有的0.22.0修改保留，不是本輪新增。

## 本輪驗證

| 檢查 | 實際結果 |
| --- | --- |
| TDD核心 | 6項先RED後GREEN；不連續月份、多組、組內／跨組重疊、週界、跨年／閏年、未結束／完全未來、零、兩種平均、多分類與停用歷史、四來源、撤銷／非消費／未來排除、65筆、巨大cents、安全拒絕非法條件及身分欄位、原始state不變；原比較9項仍通過 |
| Node全local-first核心 | 192／192；另隨機本機埠入口安全7／7。固定8768CLI占用案例刻意不執行，不干擾既有服務 |
| 原生IndexedDB／DOM | 新分析10組先RED後GREEN，含一張圖、完整65筆明細、文字XSS防護、切單位、圖表切換／建構失敗、草稿、22類原始列／metadata／完整備份逐位元組不變；分類改名及延遲tx完成後保存競態另先重現失敗再修正，明確寫入不稱唯讀 |
| 真實圖表資源503 | 24132隔離來源實測本機Chart.js回503，1組通過；沒有canvas，精確表格、原始列及完整備份不變 |
| 舊畫面回歸 | 比較11、導覽10、易用性7、批次7、目標7，共42組；未把既有測試改成假通過，只讓比較案例展開新的舊入口 |
| Python完整隔離 | 460／460，38.598秒；既有暫存verify wrapper禁止非暫存SQLite與正式data.db／Token／.env存取，跳過專案根dotenv載入後執行既有`tests/run_discord_validation.py`。既有套件deprecation警告不在本輪變更依賴 |
| 靜態／文件 | Ruff、修改JS語法、差異空白、相對文件連結及README／CHANGELOG／頁面／worker版本核對 |

## 真實瀏覽器及離線範圍

只開本輪24131／24132隔離合成來源，不開既有8767／8768或使用者來源。新測試頁每次建立UUID測試帳本；產品頁使用本輪舊比較測試插入的合成fixture（含安全文字攻擊與大整數）。桌面1265px、375px原生iframe（內容360px）實測滑鼠／Enter、週／月、多分類及期間明細。週趨勢2024-01-01～02-29實際選9個完整週、2期有消費、總額1.65元、平均約0.18元／約0.83元；跨月週結束為2024-03-03，與完整單位說明一致。展開65筆帳目正常，頁面scrollWidth等於clientWidth；表格保留自己的可捲動容器。圖表實際長條970×300與窄版折線已繪製；截圖`.tmp/analysis-desktop.png`及`.tmp/analysis-375.png`為忽略的合成產物，不入Git。

快取`local-first-offline-0.23.0-v1`仍18個必要白名單資源，沒有新套件或靜態模組。先持有0.22.0候選快取、觀測新版等待與舊頁不自動更新，關閉自己同來源產品頁後自然啟用0.23.0；不skipWaiting。原生檢查核對新分析HTML／page／核心、全部資源與舊快取移除，22類含metadata原始列及完整備份逐位元組不變。

停止本輪兩個預覽並確認24131／24132零監聽後，以同網址新文件離線開啟產品頁，再輸入2024年1／2月與`compare [x]`查詢，得到1元／0.65元並重新繪製本機圖表；唯讀檢查再次確認原始列及完整備份相同。這是相同瀏覽器來源的新文件，不是重啟整個瀏覽器、獨立設定檔或實體手機飛航模式。

更新請先保存／自行保留草稿，等新版完整下載、關閉同來源全部舊頁再重開；不初始化資料庫。沒有schema／備份／加密變更，原0.22.0目標相關升級注意事項仍有效。

未驗證實體手機、讀屏、其他瀏覽器／設定檔、瀏覽器程序重啟、跨數千年畫面／圖表效能、固定8768CLI占用案例、真實Discord／OAuth、正式帳本與實體備份還原。未讀寫正式data.db、Token、.env、既有備份／匯出或使用者資料。

---

# 0.22.0 存錢目標 — 2026-10-08

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**本輪起點為 `codex/localhost-web-auth`、HEAD `880bf535216c09f433cccf2e240791db5966b3f6`、工作檔0.21.1；原16修改／1未追蹤的易用性工作全部保留，staged原為0。以下0.21.1與更早紀錄是歷史，不冒稱本輪重跑。

## 功能與資料流

規劃提供預設收合目標，原首頁記帳不變。建立／更改走既有financeWrite交易；分配明確帶目標ID，交易重讀每個revision、按目標及月份算相對上次貢獻的差額，原子更新目標、分配、可讀校正紀錄及容量metadata。手動校正改當下總額，不改舊貢獻；後续差額使總額低於0時全部拒絕並保留輸入。完成手動確認，進度視覺最多100%、文字保留真額；期限提示不通知、不自動完成。目標不計入收入、消費或預算。

IndexedDB v8、22 stores含meta；完整JSON v7二十一類新增goals／goal_actions及選填goal_id。舊v1～v6仍可空白還原，無新資料仍用原格式；crypto封裝v1不變。規則及欄位見[目標備份契約](local-first-goals.md)。沒有修改Python產品、固定網址或資料庫名稱，也沒有新增依賴。

## 本輪自動測試與原生瀏覽器測試

| 範圍 | 實際結果 |
|---|---|
| 完整相關Node | 186／186，含新增目標8例；先RED後GREEN。涵蓋差額、校正、負值拒絕、月份／目標隔離、完成、精確／極端金額、revision、100000列容量、v7嚴驗及v1～v6往返。 |
| 原生IndexedDB | 新目標5組通過：舊v7→v8、雙連線／競態、put中斷與request成功後abort完整回滾、v7記憶體加密及空白原子還原、唯讀完整備份不變。既有遷移4組亦通過，含舊v6→v8及損壞升級中止。 |
| 新目標畫面 | 7組通過：預設記帳／收合、建立時保留分配草稿及更新ID選項、重複儲存不累加、校正後負值拒絕保留輸入、超額／期限／完成／紀錄、peer舊revision、配額失敗。 |
| 既有畫面回歸 | 收入10、導覽10、易用性7、批次7，共34組通過；保留安全文字、唯讀及原交易斷言。 |
| 完整Python隔離 | 正式檔案及非暫存SQLite防護下460／460，34.908秒；新增v7解析／還原安全拒絕、暫存SQLite不變。沒有測正式帳本。 |
| 入口及授權 | 隨機隔離埠入口7／7；7個原有授權資源SHA-256一致。沒有新增第三方資源。 |
| 靜態檢查 | Ruff、88個非vendor JavaScript語法及git diff --check通過。 |
| 舊local-first讀取器 | 從HEAD取得的v6備份讀取器，對合成新目標v7安全拒絕；不是降級資料庫操作。 |

原生加密演練：相同帳本兩次加密密文不同；正確密碼解密後內容一致，錯密碼拒絕；空白帳本交易還原／重開一致，非空白再次還原拒絕。這些使用記憶體封裝及合成IndexedDB，**未證實實體下載落地或全新普通設定檔從同一檔還原**。

最後靜態檢查時曾誤將固定入口測試納入較廣清單：194例中187通過、7例在受限環境因本機連線EACCES失敗，包含固定8768的CLI案例，不能列為全套通過。沒有重試固定埠、停止既有服務或取得使用者帳本內容；改回排除入口測試的186核心案例後重新全數通過。入口結果另以本輪先前隨機隔離埠7例為準，固定埠CLI行為沒有本輪通過證據。以上環境失敗保留為限制，不降低產品斷言。

## 本輪代理工具實際操作

全新隔離來源22631／22632，沒有操作8767／8768或使用者帳本。桌面鍵盤在實際產品新增「合成旅行目標」，100元目標／5元已存；10.29元分配明確連結，已存15.29元。375px同來源測試子頁以鍵盤校正16.29元、開啟紀錄；內容可用寬360px、scrollWidth360px無橫向溢出。重新整理回預設記帳，再開規劃可見16.29元及歷史。

Service Worker最終快取`local-first-offline-0.22.0-v1`、18必要本機資源。用合成測試下一版0.22.1（不是發行版）演練：缺圖表資源安裝失敗、兩舊頁仍由0.22.0控制／新worker等待、草稿保留、只關一頁仍等待、全部舊頁關閉後自然啟用；原始列、metadata及完整v7備份不變。沒有skipWaiting、強制刷新或清除帳本。

最後服務已停止且22632無監聽；但最後「同網址離線新頁」的結果尚未觀測。瀏覽器自動核准審查回報工具使用額度已滿，後續測試導覽未執行；不改工具或降低門檻繞過，不把離線資源檢查或自然啟用當成冷啟動通過。

## 使用者先前手動驗證與未驗證

此前使用者在合成隔離設定檔確認過加密檔落地、從同一檔錯密碼拒絕／正確還原、重開及再次下載；屬此前版本的**使用者手動驗證**，不是本輪工具獨立觀測，也不是新增v7目標資料的從檔驗收。

仍需以全新合成設定檔手測v7檔案落地、從同一檔空白還原、重開後目標／連結／紀錄及再次下載；兩份加密檔不要求逐位元相同，核對解密後內容。工具額度恢復後補最終離線冷啟動。實體手機、讀屏、其他瀏覽器、整個瀏覽器程序退出、真磁碟耗盡／損壞、真OAuth與正式資料未驗證。不得據此宣稱正式帳本可搬移或安全認證。無stage／commit／push／PR／tag。

## 目前工作樹修改清單

交付核對為22個已追蹤修改、6個未追蹤，staged為0；包含保留的0.21.1工作。分支與HEAD未變，不stage／commit／push／PR／tag。

- 產品8檔：`local-first/backup.mjs`、`idb.mjs`、`income.mjs`、`ledger.mjs`、`index.html`、`page.mjs`、`sw.js`；`style.css`為保留的0.21.1修改，本輪目標未改CSS。
- 文件4檔：`README.md`、`CHANGELOG.md`、`docs/local-first-browser-validation.md`、新增`docs/local-first-goals.md`。
- 新目標測試4檔：`tests/test_local_first_goals.mjs`、`local_first_goals_browser.html`、`local_first_goals_browser.mjs`、`local_first_goals_ui_browser.mjs`。
- 其餘測試12檔：`tests/local_first_navigation_browser.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_preview.mjs`、`local_first_schedule_migration_browser.mjs`、`local_first_shortcuts_ui_browser.mjs`、`local_first_update_browser.mjs`、`local_first_usage_ui_browser.mjs`、`test_browser_portable_backup.py`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`test_local_first_usage_layout.mjs`，以及既有未追蹤`local_first_usability_browser.mjs`。只因版本／結構調整更新相關斷言與fixture，其餘0.21.1工作保留。

---

# 0.21.1 易用性整理 — 2026-10-08

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**本輪由乾淨的 `codex/localhost-web-auth`、HEAD `880bf535216c09f433cccf2e240791db5966b3f6`、已提交 0.21.0 開始；不 stage、commit、push、PR 或 tag。

## 本輪畫面及資料邊界

設定提供獨立使用說明／返回與焦點恢復，隱私另頁、風險與即時錯誤不搬走。原有說明節點移到同一頁；預算、定期支出、收入與分配則搬為同層三區，不複製表單／事件。有效消費預設原生收合；使用期間為起訖與天數，停止追蹤不顯示假終點，原每日成本保留。必填標記有圖例且控制項本身 required；使用期間、分期、編輯付款及加密／未加密備份依狀態呈現。捷徑新增沿用原管理表單與交易；快捷預填、從消費建立及既有設定保留。首頁無總／分類預算才隱藏概況，規劃入口永遠可用。搜尋圖示外觀留待後續。

未修改 ledger／browse／schedule／income／backup／加密核心、IndexedDB v7、JSON v1～v6 或加密封裝 v1，也未更動 Python Web／Discord。純說明與切區測試禁止任何 IndexedDB transaction，原有草稿／收合狀態、19 類資料列與 metadata、完整備份逐位元組相同；分類預算設定、建立捷徑與手動記帳是明確的合成寫入，不稱為帳本不變。

## 本輪修改檔案

- 產品4檔：`local-first/index.html`、`local-first/page.mjs`、`local-first/style.css`、`local-first/sw.js`。
- 新增1檔：`tests/local_first_usability_browser.mjs`。
- 既有測試／預覽9檔：`tests/local_first_navigation_browser.mjs`、`tests/local_first_offline_settings_browser.mjs`、`tests/local_first_preview.mjs`、`tests/local_first_shortcuts_ui_browser.mjs`、`tests/local_first_update_browser.mjs`、`tests/local_first_usage_ui_browser.mjs`、`tests/test_local_first_offline.mjs`、`tests/test_local_first_update_status.mjs`、`tests/test_local_first_usage_layout.mjs`。
- 文件3檔：`README.md`、`CHANGELOG.md`、本文件。共16個既有修改與1個新增檔；index空白、HEAD未變。

## 本輪重新執行

| 驗證 | 實際結果 |
| --- | --- |
| TDD 原生畫面 | 7 組先 RED 後 GREEN：help、layout、usage、disclosure、required、budget、shortcuts；涵蓋說明返回、二次點擊、交易禁止、草稿、未設定／分類單獨預算、XSS、條件必填與新增／更改焦點 |
| 原生畫面回歸 | 60 組：導覽10、捷徑15、使用期間8、定期6、預算4、加密10、批次7；保留衝突、revision、Quota／abort rollback、備份唯讀及安全文字斷言 |
| Node | 核心178／178；隨機埠入口安全7／7。沙箱首次網路檢查 EACCES 後以隔離隨機埠重新通過。固定8768的CLI占用案例碰到既有服務，未完成，不停止或操作該服務 |
| Python | 以既有暫存防護 wrapper 執行完整 `tests/run_discord_validation.py`，459／459，35.740秒；正式 DB／Token／.env 檔案禁止、SQLite 僅暫存路徑，dotenv 根目錄載入跳過 |
| 靜態檢查 | Ruff、產品／相關測試 JS 語法、`git diff --check`；版本與本文件相對連結核對 |

## 實際瀏覽器與離線

只使用本輪隨機命名合成帳本及獨立 `http://127.0.0.1:22101` 來源，不開啟既有8767／8768或使用者帳本。原生自動化是上述測試頁，不等同人工驗收。另以實際產品頁手動新增 1.23 元／3 天的合成消費，設定只有餐飲100元的分類預算；實測滑鼠、Enter展開、設定→說明→返回焦點、三個規劃區、使用期間與每日0.41元顯示。桌面1265px與375px iframe（扣除垂直捲軸後360px）量測 scrollWidth 等於 clientWidth，沒有橫向溢位；窄版切區與返回保留記帳草稿。截圖位於忽略的 `.tmp/usability-planning-desktop.png` 與 `.tmp/usability-planning-375.png`，不納入產品或Git。

快取仍18個白名單資源，名稱 `local-first-offline-0.21.1-v1`。同一合成來源先持有舊候選快取，觀測新版等待且舊頁仍顯示0.21.0；關閉本輪產品舊頁後自然啟用0.21.1，沒有skipWaiting。唯讀檢查驗證新版說明／收合／概況條件靜態內容、移除舊快取與全部資源，19類原始列／metadata／完整備份逐位元組不變。之後停止自己22101預覽並確認無監聽，以同網址新文件離線開啟，仍可進說明／返回、規劃三區，資料比對再次通過。不是重啟整個瀏覽器程序，也不是手機飛航模式；375px檢查為連線時的原生子頁。

更新前請先儲存或自行保留草稿，等資源完整下載，關閉同來源全部舊頁再開；草稿只承諾頁內切區／返回保留，不新增跨重新整理持久化功能。無需初始化帳本或升級 schema。

未驗證實體手機、讀屏、其他瀏覽器／獨立設定檔、瀏覽器程序重啟、固定8768 CLI案例、真實Discord／OAuth、正式帳本與實體備份還原；沒有讀寫正式data.db、Token、.env、既有備份／匯出或使用者資料。

---

# 0.21.0 搜尋與批次互動修正 — 2026-10-08

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**以下為修正後這一輪實際測試；下方初版紀錄另行保留。使用者曾回報舊畫面的交易可用、互動不符預期，不能當成新版畫面的手動驗收。

起點為 codex/localhost-web-auth、HEAD 29d885d07f0e87ef7a1a6745bef0f134e9ad820d，工作檔已是未提交的 0.21.0，原有 14 個修改與 4 個未追蹤候選檔完整保留。修正合併同版；不 stage、commit、push 或更新 PR。

## 修正後流程與資料邊界

功能、分類、標籤、帳目改成四個預設收合的原生 details。空關鍵字以 browseSite 唯讀瀏覽現有資料，validateBrowse 重用既有日期驗證；原有嚴格關鍵字搜尋規則未放寬。主清單與分類／標籤相關消費共用 ID／revision 選取，勾選位於最左側；全選明確標示目前清單並涵蓋全部符合帳目，50 筆只是呈現上限。換條件、組字事件或清單清選取。

0 筆停用兩種更改；1 筆只開既有單筆表單，可更改原本允許的金額等欄位；多筆才開一張批次表單。移除常駐批次欄位。表單可追加與移除標籤；移除只解除所選帳目的關聯，全球標籤定義及其他關聯不刪除。新增保留其他標籤，已有待新增／沒有待移除項目安全略過。相同標籤同時新增／移除拒絕。舊分類、付款方式與標籤彼此不同不算衝突。

核心延伸既有 changeExpenseBatch／editExpenseBatch，仍在單一寫入交易重讀全部目標與選項；任一失效、舊 revision、容量拒絕、Quota 或 request 成功後 abort 整批回滾。實際無改動的列不追加操作紀錄或 revision，真正改動仍檢查 revision 上限。付款未重選保留快照，定期規則與期數不變；精確金額、before 快照與操作順序沿用原契約。未更動 IndexedDB v7、JSON v1～v6、加密封裝、Python 帳務或依賴。

## 本輪重新執行結果

| 驗證 | 實際結果 |
| --- | --- |
| Node | 178／178；批次 10 項、共用搜尋 7 項；先重現移除能力／空關鍵字瀏覽／新版結構缺口，以及 null 輸入與 revision 上限無變動，再實作通過 |
| 原生 IndexedDB 批次 | 6 組；65 筆中途 Quota 與 request 成功後 abort 完整回滾、雙連線只成功一次、四來源與 before 順序、標籤移除與無改動略過、失效／作廢／重複／舊 revision、100000 列容量、JSON v6 加密往返與空白原子還原後重開 |
| 新版畫面自動測試 | 7 組；四區收合／空瀏覽、左勾選、0／1／多筆、單筆 0.29 → 0.31 元更改、相關清單 64／65 筆全選、混合舊值、隱藏及惡意標籤新增／移除、取消／連點、peer 衝突、Quota、草稿與比較／預算同步刷新、唯讀資料不變及不送外部請求 |
| 既有畫面回歸 | 72 組；全站搜尋 13、搜尋月曆 11、標籤 10、四區導覽 10、共同故障 11、比較 11、統一定期 6；必要入口改為勾選＋單筆工具列，原安全斷言保留 |
| Python | 正式檔案、非暫存 SQLite 與真 dotenv 防護下 459／459，31.889 秒；僅既有棄用／asyncio 診斷 |
| 靜態／資源 | 隨機隔離埠入口 7／7、Ruff、82 個非 vendor JS 語法、7 檔既有授權資源 SHA-256、git diff --check 通過 |

加密往返使用合成資料與記憶體內容；不是實體下載落地／從實體檔還原證據。既有使用者檔案手測只保留為歷史紀錄。

## 本輪代理實際操作與離線

只使用自己啟動的 22511／22512 隔離來源、合成 IndexedDB 與內建瀏覽器；沒有操作既有 8767／8768、使用者來源、正式帳本、備份、Token 或 .env。桌面 Enter 空瀏覽得到功能 21、分類 7、標籤 4、帳目 65，四區收合；Enter 展開、Space 勾選，1 筆僅單筆更改可用，全選 65 筆僅批次可用。實際開按需表單、選移除隱藏標籤、查看摘要、取消，未寫入。

375px 使用原生同來源 iframe，Enter 展開／切清單、1 筆相關結果全選後開既有單筆表單並取消、回主清單全選 65 筆開批次表單。可用寬與內容寬均 360px，無水平溢出。一次文字按鈕點擊工具無法命中，重新核對可見控制項後用 Enter 完成；不宣稱實體觸控或螢幕閱讀器實測。合成截圖 search-groups-revised.png、batch-remove-revised.png、batch-form-375-revised.png 只放忽略的 .tmp。

最終 worker 為 local-first-offline-0.21.0-v4，18 個必要白名單資源完整，不快取帳目或測試路由。先觀測新版等待與舊頁繼續使用；關閉自己同來源產品／窄版頁後自然啟用，沒有 skipWaiting 或強制重整。原生檢查確認舊快取移除、新 HTML／browseSite／remove_tag_ids 及全部資源存在；帳本原始列、metadata 與完整備份逐位元組不變。

停止本輪 22512 服務並確認零監聽後，同網址新文件離線開啟，空瀏覽仍得到 65 筆與四收合區。展開、全選、預覽移除摘要及取消後，原始列、metadata、完整備份再次逐位元組不變。隨後明確選兩筆、離線確認移除隱藏標籤關聯，畫面顯示已更改 2 筆；關頁後再從相同網址離線新開，兩筆仍為 0.29 元、交通、合成卡與其餘惡意文字標籤，已移除的隱藏關聯未回來；全域四個標籤仍保留。這段明確寫入不稱為帳本不變，也未重啟整個瀏覽器程序。

## 修改範圍與未驗證

保留同版累計範圍：產品 7 檔（browse.mjs、index.html、ledger.mjs、page.mjs、rules.mjs、style.css、sw.js）；文件 3 檔（README、CHANGELOG、本文件）；測試 14 檔（4 個原批次新檔，以及 preview、offline_settings、update_browser、Node offline／update_status／site_search、browse／navigation／site_search／tags UI）。共 20 個修改與 4 個未追蹤候選檔，staged 為 0。backup.mjs、idb.mjs、backup-crypto.mjs 與 Python 產品未修改。

未驗證實體手機、其他瀏覽器、螢幕閱讀器、實體中文 IME、100000 筆批次效能、真磁碟配額／損壞、本輪實體加密檔落地與獨立設定檔從該檔還原、整個瀏覽器程序退出或正式帳本；不宣稱正式搬移或安全認證。

# 0.21.0 初版批次操作（舊互動驗證紀錄）— 2026-10-08

**僅供合成資料測試；IndexedDB未加密，Python Web尚未被取代。**本節為本輪代理執行；前輪使用者手動檔案驗收不冒稱這輪重測。

起點：codex/localhost-web-auth、HEAD 29d885d07f0e87ef7a1a6745bef0f134e9ad820d、已提交0.20.0，工作樹及staged清單空白。功能版0.21.0；不stage／commit／push／建立PR。

## 功能與交易驗收

帳目搜尋結果的勾選與「全選符合結果」只保存當次ID／revision，不寫入帳本；全選使用完整searchRows，50筆僅是呈現批次。條件改變／重新搜尋清空選取；合成isComposing事件先重現保留舊選取，再修成組字期間也立即清除，沒有新增或保存篩選器。原記帳頁仍直接記帳，批次選項只在搜尋帳目區、預設收合。

同一確認可改分類、付款方式及追加多標籤。分類／付款重用單筆expenseOptions；付款未重選保持原ID與名稱快照，原停用分類可保留。明確目標必須有效，已有／隱藏標籤完整名稱重用原ID。原標籤不移除；新標籤只在成功交易中建立。純changeExpenseBatch先驗證原帳本，單筆current驗證來源、有效性及revision，保存每筆before／revision，最後檢查全帳本容量。editExpenseBatch重用financeWrite／saveSettings，一個readwrite交易重新讀取每一筆與選項；不循環呼叫單筆交易。記帳／預算／圖表金額沒有另計或改寫，原定期規則／期數保持。

原生確認窗顯示筆數、原搜尋關鍵字／日期與每個指定欄位，取消不寫。錯誤保留選取與更改欄位、固定安全訊息並提示重新載入；重複確認只提交一次。成功更新所有受影響畫面。既有已顯示比較未刷新的斷言先失敗，再修共用提交後快照刷新及過期比較請求，確保不被延遲唯讀結果覆蓋。

## 本輪實際自動／瀏覽器結果

| 驗證 | 本輪實際結果 |
| --- | --- |
| Node | 173／173，含新批次6項；四來源、精確signed64大額、舊快照、原標籤、無變更選項／畸形目標／容量等 |
| 批次原生IndexedDB | 5組：65筆中途Quota及request成功後abort完整回滾；雙連線只成功一次；空／重複／不存在／作廢／舊revision拒絕；既有JSON v6＋加密封裝、空白原子還原、重開與操作順序；100000列拒絕無漂移 |
| 批次原生畫面 | 7組：個別／65筆全選／取消、搜尋與組字清選、組合摘要／取消快速重開／連點、XSS與草稿、搜尋月曆預算比較刷新、peer衝突、儲存故障保留選擇／固定錯誤、唯讀不入網址／外部請求 |
| 既有畫面回歸 | 72組：全站搜尋13、搜尋月曆11、標籤10、支出比較11、共同故障11、四區導覽10、統一定期6 |
| Python | 正式檔案／非暫存SQLite／真dotenv防護下459／459，34.647秒；僅既有棄用與asyncio診斷，未改Python帳務 |
| 靜態／資源 | 隨機隔離埠入口7／7、Ruff、82個非vendor JS語法、7檔既有授權資源SHA-256及git diff --check通過 |

沒有新增依賴、資料表、IndexedDB或備份格式。原v7／JSON v1～v6／加密封裝v1按資料內容選版；新增標籤使用既有v5欄位，原新週期期數仍v6。核心測試明確確認無標籤資料更改後仍v1、已有標籤仍v5；原生含週期期數備份維持v6，引用、revision與操作順序不漏。記憶體加密往返不是實體下載檔還原。

## 本輪實際人工操作與離線

使用自己啟動的22311／22312隔離來源與合成資料，沒有讀寫既有8767／8768、正式data.db、Token、.env、使用者備份或設定檔。桌面Space個別勾選、Enter全選65筆、單一分類確認後成功；375px原生同來源iframe可Enter開搜尋／選項、全選／付款選項／確認取消，內容寬與可用寬均360px，沒有橫向溢出。50個已呈現checkbox可用可辨識的「選取消費：名稱（日期）」無障礙名稱取得。沒有把DOM標籤檢查說成螢幕閱讀器實測。

最終worker為local-first-offline-0.21.0-v2，仍僅18白名單資源；快取檢查新增批次HTML／頁面與核心存在的斷言，不快取帳目／搜尋或測試路由。先見新版等待、不強制刷新，關閉自己產品與窄版頁後自然啟用，raw／metadata／完整備份不變。停本輪22312服務並確認零監聽、關閉產品後同網址新文件離線可搜尋、65筆全選、預覽確認及取消；再次核對18資源與raw／metadata／完整備份逐位元組相同。然後明確離線更改1筆分類，看到儲存完成，關頁重開後同筆0.29元／原標籤／付款仍在、分類更新保留；此明確寫入不與寫入前唯讀基準比對為不變。

更新先保留未送出草稿與完整備份，保持服務至資源完整下載，關閉所有同來源舊頁再開。不skipWaiting／強制刷新／清除或初始化帳本。合成截圖只留忽略的.tmp。

## 尚未驗證與檔案範圍

未測實體手機、其他瀏覽器、螢幕閱讀器實機、實體中文IME、100000筆批次效能、真磁碟配額／損壞、本輪實體加密檔落地與獨立空白設定檔從該檔還原、整個瀏覽器程序退出及正式帳本／OAuth。此次沒有索取密碼或真實資料，也不作安全認證或正式搬移承諾。

產品6檔：local-first/index.html、ledger.mjs、page.mjs、rules.mjs、style.css、sw.js。文件3檔：README.md、CHANGELOG.md、本文件。測試9檔：新test_local_first_batch.mjs、local_first_batch_browser.html／mjs、local_first_batch_ui_browser.mjs；更新local_first_preview.mjs、local_first_offline_settings_browser.mjs、local_first_update_browser.mjs、test_local_first_offline.mjs、test_local_first_update_status.mjs。沒有改backup.mjs／idb.mjs／加密封裝或Python產品程式。

# 0.20.0 全站搜尋 — 2026-10-08

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**本節為代理工具本輪觀測；實作及瀏覽器驗證於 2026-10-07，文件／最終檢查於 10-08。保留下方使用者既有手動驗收，不冒稱本輪實體檔或正式帳本測試。

## 使用方式與資料範圍

記帳首頁長框按 Enter 或圖示，規劃／分析／設定按有明確名稱的圖示，開啟同一原搜尋表單；共用介面輸入會更新結果，返回時聚焦來源入口。清空回空白說明，不查資料、不留下舊結果；關鍵字不放入 URL，不用 AI、regex、模糊搜尋或外部服務。

四類結果各有完整筆數與空狀態。帳目沿用原日期驗證／排序、50 筆展開及更改／刪除流程；功能由實際主要標題／入口取得，點選切區、展開、聚焦，不直接下載或寫入。分類含停用及有效消費的歷史無覆寫名稱；標籤含隱藏定義。關聯明細只計該單項、保留本次日期範圍，但不以名稱關鍵字再過濾用途，顯示精確總額及完整可展開帳目。不同標籤不合併，空項目正常顯示 0 元；不重新啟用或建立項目。資格沿用本人已入帳、截至台灣今天、有效未撤銷四來源 consumption，排除預測及非消費。

## 自動驗證與重跑

- `node --test tests/test_local_first_site_search.mjs`：6／6；缺少共用能力先失敗再通過，含 literal／ASCII、四來源、撤銷與非消費排除、日期／閏日、停用／歷史分類、隱藏單標籤、69 筆完整精確總額及輸入快照不變。全非入口 local-first Node 167／167；入口以測試名稱篩選另跑隨機埠 7／7，排除固定 8768 CLI 案例。Ruff、80 個 JS 語法、`git diff --check` 通過。
- 使用**全新隔離來源** `node tests/local_first_preview.mjs 21901 --secure`，開啟 `/tests/local-first-site-search.html`；fixture 使用專用隨機後綴 IndexedDB，確認空白才植入合成資料，不覆蓋既有帳本。13 組真實頁面／原生 IndexedDB 通過：四區入口、70 筆完整計數／50 筆展開、69 筆單分類／隱藏標籤及 4.69 元、另一標籤獨立 1.01 元、空結果、無效日期零讀取、分組共用一次快照、固定安全讀取錯誤、惡意文字、快速輸入、功能／來源返回、原草稿與全部原始列／metadata／完整備份不變。
- 額外 RED → GREEN：清空殘留、新日期等待時舊名稱操作、較慢月曆覆蓋較新快照、取消更改後名稱操作失效及原記帳草稿遺失。修正用空白清除、結果隱藏／當前 DOM 歸屬、請求序號及共用草稿還原。建置寫入不包含在純查詢基準內；月曆競態明確模擬一次合成 peer 新增，隨後取新基準驗證查詢沒有額外寫入。備份功能測試只聚焦真實按鈕，不開啟／下載備份。
- 既有 `/tests/local-first-browse.html` 11、`/tests/local-first-navigation.html` 10、`/tests/local-first-tags.html` 10、`/tests/local-first-schedule.html` 6 組重新通過。僅同步搜尋新區域及返回位置斷言，未刪除來源、日期、peer 標籤、舊 revision、取消、寫入失敗／rollback 或隱私檢查。
- 額外 audit 防護啟動器執行既有 `tests/run_discord_validation.py`：459／459、38.401 秒；拒絕正式 data.db／Token／.env 開檔、非暫存 SQLite，隔離 Web 真 dotenv，保留測試自己的暫存設定。沒有啟動正式 Bot／真 Discord／正式資料庫。入口受限 socket 拒絕後以相同檢查重跑，沒有改防火牆或放寬規則；Python 僅既有棄用及 asyncio 提示。

## 桌面、375px 與離線（分開實測）

本輪只在自己建立的 21901 來源植入專案合成資料。測試頁 `?product=1` 只供空白來源建置演練，非空即拒絕；該 marker 曾被舊 fixture 斷言誤認為搜尋污染 URL，已改為核對原 URL 完全不變，未改產品 URL 或清除帳本重試。其他回歸各用自己的專用合成庫，不碰使用者既有來源／備份。

真產品 `/local-first/` 桌面 1280px：Enter 開啟、70 筆分組、單項 69 筆／4.69 元、Tab 返回、原草稿及跨區功能跳轉可用，可用／scrollWidth 均 1265px。375px 原生 iframe 子頁：首頁框／圖示、設定區只有圖示、分類明細及返回草稿正常，可用／scrollWidth 均 360px，無橫向溢出。沿用測試預覽的同來源 frame 路由，不改正式固定服務 DENY／CSP；不是實體手機驗證。截圖只在忽略的 `.tmp/site-search-desktop-proof.jpg` 與 `.tmp/site-search-375-proof.jpg`。

最終 `local-first-offline-0.20.0-v3` 仍只有 18 個必要靜態資源，無帳目／查詢／測試路由快取。實測等待提示、關閉自己的舊產品頁後自然啟用，不強制刷新；唯讀助手核對原始列／metadata／完整備份逐位元組相同。停止本輪 21901 服務並確認無監聽，關閉產品及窄版子頁後，同精確網址新頁冷啟動：離線搜 70 筆、單一隱藏標籤 4.69 元及功能導覽正常，產品頁無 warn／error；再次快取及帳本檢查 PASS。

更新先自行保留未儲存草稿與備份，保持服務在線至必要資源完整下載，關閉同來源全部舊頁再開；不初始化／搬移資料，不升 IndexedDB、完整或加密備份格式。起點為乾淨 `codex/localhost-web-auth`／`6e68945357d3f07532e2d142e07f4e2d54a7eff2`；本輪不 stage／commit／push。

未驗證：實體手機、其他瀏覽器、螢幕閱讀器、實體中文 IME、100000 筆搜尋效能、真 OAuth、正式帳本、實體備份下載／獨立設定檔還原、裝置或配額故障。未讀寫正式 data.db、Token、.env、既有備份／匯出或使用者資料。**仍僅供合成資料測試，不能視為正式帳本搬移或 Python Web 替代。**

# 0.19.0 第 2 階段：統一定期支出與年度費用 — 2026-10-07

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。** 本節為本輪代理工具實際執行；下方使用者手動驗收保持原範圍，不轉稱 v6 實體檔或正式帳本驗收。

實作輪起點：分支 codex/localhost-web-auth、HEAD f57d878a265325da490efca0c967010164933364、README／CHANGELOG 0.18.1、工作樹與 staged 清單空白。實作輪完成版 0.19.0，當時未 stage／commit／push；後續本機版本保存授權與驗收見下段。資料契約見[統一定期支出](local-first-schedule-backup-format.md)。

## 交付補充：使用者手動驗證 — 2026-10-07

使用者回報 **「1～4 各自通過」**。本次以全新隔離來源 `http://127.0.0.1:21790/`、兩個全新普通瀏覽器設定檔A／B及合成JSON v6帳本進行，包含新每日四期規則、已記錄、已略過、已恢復待記錄與另一期待記錄。

| 使用者手動驗證 | 回報結果 |
| --- | --- |
| A查看新定期支出的待處理、略過／恢復及本月規劃總額 | 通過 |
| A從畫面下載v6加密完整備份，實體檔存在、大小非零 | 通過 |
| 空白B選取A剛下載的同一檔，錯密碼拒絕且無部分資料；正確密碼預覽、確認還原 | 通過 |
| B關頁重開仍保留資料／期數，並再次下載備份 | 通過 |

上述為使用者親自操作後的直接回報，**代理工具沒有獨立觀測實體檔案或使用者瀏覽器設定檔**；未索取／記錄密碼、檔案內容或個資。兩份密文不必逐位元組相同，也沒有把發出下載要求當作落地證據。補足下方實作輪列為未驗證的四項實體流程，該段保留當時工具測試範圍；使用者未另外回報兩份實體檔解密後完整內容逐欄／順序比對。

本機版本保存前，41候選路徑及內容SHA-256與手測前記錄一致；本輪只修改本文件及目前版CHANGELOG以補結果，不改產品行為／版本。不納入忽略的.tmp種子、手測服務、備份或下載檔。實際重新執行Node161／161、隨機隔離埠入口7／7、正式檔案／非暫存SQLite防護下完整Python459／459（32.485秒）、Ruff、77個非vendor JS語法、7檔已追蹤授權資源SHA-256、離線18資源白名單、啟動器／授權追蹤及疑似憑證／資料檔排除檢查；git diff --check通過。審核輔助腳本首次使用錯誤啟動器檔名，核對實際已追蹤的start_local_first.local.cmd後重查通過，沒有新增或更動啟動器。舊實作輪46組原生／147組畫面為前輪結果，本次未冒稱重跑。

本輪使用者確認後授權建立本機commit；不push、建PR、建立tag、升版或開始全站搜尋。實體手機、其他瀏覽器、螢幕閱讀器、整個瀏覽器程序退出、真磁碟配額／損壞、正式帳本或完整正式搬移仍未驗證。**僅供合成資料測試，IndexedDB未加密，Python Web尚未被取代；不宣稱安全認證。**

## 本輪自動測試

| 測試 | 實際結果與範圍 |
| --- | --- |
| Node | 161／161，含新增純日期／模型8、備份7、資料變更7；舊格式純規則仍保留。 |
| 固定入口安全 | 隨機埠7／7，靜態白名單／CSP／Host／方法／路徑／授權；固定8768占埠項不計入通過。初次套件誤含入口測試遭環境EACCES，未取得來源回應；明確排除後重跑，沒有改服務或防護。 |
| Python | 正式檔案／非暫存SQLite防護下459／459，33.399秒；新增JSON v6安全拒絕及拒絕前後暫存資料不變。不改Python帳務。 |
| 靜態檢查 | Ruff、77個非vendor JavaScript語法、7檔既有授權資源SHA-256、git diff --check通過。3個本輪寫入的原LF測試檔及README新段落恢復原行尾；沒有改全庫行尾規則。 |

## 本輪瀏覽器執行的測試

原生 IndexedDB 共 **46組**：統一期數8、v6→v7升級4、既有逐列儲存升級7、舊完整備份互通12、手動消費11、四來源單筆4。新測試涵蓋原子規則／版本／期數／消費／action／metadata、未到期拒絕、雙連線同一期僅成功一次、舊revision、已作廢不復活、凍結舊期數、容量100000列、中途失敗及request成功後abort；十九類加密解密／空白還原／失敗回滾／關閉重開保持內容，兩次密文不同。升級只新增空store，舊列／鍵／position／metadata及舊JSON v5逐位元組相同；損壞升級不改原schema或資料。

畫面共 **147組**，每項實際讀到PASS，不以純Node或Blob代替畫面：

| 原生畫面 fixture | 組數 |
| --- | ---: |
| 統一期數 | 6 |
| 固定／訂閱分期／年度 | 5／5／7 |
| 收入分配／四區導覽／使用期間 | 10／10／8 |
| 共同故障／定期確認後畫面故障 | 11／11 |
| 十九類加密備份 | 10 |
| 捷徑／標籤／分類付款／預算 | 15／10／6／4 |
| 搜尋月曆／比較／CSV | 11／11／7 |

快速取消並立即重開略過／停用確認曾重現timeout，修正close只在真正關閉時清狀態；已記錄期數只顯示預設值的斷言先失敗，補實付及實際日期後6組通過。備份拒絕舊月付recorded與新版pending／skipped同index衝突、年度9999年空區間讀取先失敗後通過。保存期數共用索引避免平方查找，沒有改期數或交易語意。CSV首次在已有隔離帳本拒絕，改全新20994來源完成7組；沒有覆蓋原測試資料。

舊原生 fixed／recurring／annual自動補記腳本仍保留歷史程式，不列為v7驗收通過；其舊立即sync／月份開始年度語意已被本輪明確取代。新版統一期數fixture覆蓋交易、歷史及故障，另測所有舊live writer安全拒絕且帳本不變。這些舊腳本未重寫成另一套排程引擎，也不以其歷史通過數湊本輪數字。

## 本輪人工操作的瀏覽器實測

僅使用本輪新來源20991～20994與合成資料，沒有操作8767／8768現有帳本。桌面新帳本首先仍為消費表單，規劃原生收合表單預設每1月；實際新增每15日、首日2026-10-01，正確顯示10-01待記錄、10-16／31即將到期且無寫入操作。帶入原記帳表單，改實際日期10-07及99.29元，只產生一筆消費；本月規劃339.31元、普通消費99.29元，按不同日期歸屬。375px同來源原生iframe實測Enter切規劃／展開、查看實付與預設、窄版內容寬等於可用寬360px，無橫向溢出。iframe允許只存在隔離預覽測試路由，正式固定入口仍DENY／frame-ancestors none。

20992原生更新演練：兩頁0.19.0舊worker與未送出草稿，模擬假0.19.1缺Chart.js時安裝失敗，舊快取／帳本／草稿保留；完整下載仍等待，只關一頁不啟用，關閉最後一頁才自然啟用。停本輪服務，同網址新頁離線冷啟動，18必要資源及十九類原始列／metadata／完整備份逐位元組不變。此演練使用本輪中途v1 cache；假0.19.1僅測試標籤，不是產品版本。

確認修正後快取升到最終 **local-first-offline-0.19.0-v2**。20993另外實際更新等待、關閉全部產品／窄版頁後自然啟用；核對18完整資源與白名單。停止自己的20993服務並確認零監聽、關閉產品頁、相同精確網址新頁離線冷啟動，Enter開定期管理正常，實付／預定資料仍在。檢查器以操作前基準比對raw／metadata／完整JSON v6，再次PASS逐位元組相同。備份密文沒有用逐位元組比對；只有解密後帳本內容才比較。

## 仍未驗證

本輪沒有確證v6實體備份檔落地或另一個完整空白瀏覽器設定檔從同一檔還原；加密畫面fixture以捕捉Blob/File與原生IndexedDB驗證，不能代替實體流程。需要使用者另以兩個全新普通設定檔及合成資料，下載v6檔、確認存在、從同一檔錯密碼拒絕／正確還原、關頁重開及再次備份，核對解密後內容。先前第0階段使用者v5手測是歷史證據。

實體手機、其他瀏覽器、真螢幕閱讀器、整個瀏覽器程序退出、真磁碟配額／損壞、正式帳本或真OAuth未驗證；固定入口8768占埠項未計為本輪通過。合成驗收不等於正式搬移、安全認證或瀏覽器資料永久保存。

## 本輪修改檔案（41個）

- `CHANGELOG.md`
- `README.md`
- `docs/local-first-browser-validation.md`
- `local-first/backup.mjs`
- `local-first/idb.mjs`
- `local-first/income.mjs`
- `local-first/index.html`
- `local-first/ledger.mjs`
- `local-first/page.mjs`
- `local-first/rules.mjs`
- `local-first/serve.mjs`
- `local-first/style.css`
- `local-first/sw.js`
- `local-first/usage.mjs`
- `tests/local_first_annual_ui_browser.mjs`
- `tests/local_first_crypto_ui_browser.mjs`
- `tests/local_first_fixed_ui_browser.mjs`
- `tests/local_first_income_ui_browser.mjs`
- `tests/local_first_navigation_browser.mjs`
- `tests/local_first_offline_settings_browser.mjs`
- `tests/local_first_preview.mjs`
- `tests/local_first_recurring_ui_browser.mjs`
- `tests/local_first_shortcuts_ui_browser.mjs`
- `tests/local_first_storage_browser.mjs`
- `tests/local_first_ui_browser.mjs`
- `tests/local_first_update_browser.mjs`
- `tests/local_first_usage_ui_browser.mjs`
- `tests/test_browser_portable_backup.py`
- `tests/test_local_first_annual.mjs`
- `tests/test_local_first_offline.mjs`
- `tests/test_local_first_update_status.mjs`
- `docs/local-first-schedule-backup-format.md`
- `local-first/schedule.mjs`
- `tests/local_first_schedule_browser.html`
- `tests/local_first_schedule_browser.mjs`
- `tests/local_first_schedule_migration_browser.html`
- `tests/local_first_schedule_migration_browser.mjs`
- `tests/local_first_schedule_ui_browser.mjs`
- `tests/test_local_first_schedule.mjs`
- `tests/test_local_first_schedule_backup.mjs`
- `tests/test_local_first_schedule_ledger.mjs`

# 0.18.1 第 1 階段：規劃分流與分類管理連結 — 2026-10-07

**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**本節為代理工具本輪觀測；下方第 0 階段的使用者手動驗收保留，不冒稱本輪重新驗證下載落地或獨立設定檔還原。

「規劃」直接提供同層的原生收合入口「預算」「定期支出」，沒有共同收合外層；預算 →「更改分類名稱」切到設定的唯一分類管理並聚焦標題，Tab 可接續到「返回預算」，返回聚焦預算 summary。只移動原節點、不複製表單／事件、不清空草稿或補記。首頁概況卡、年度費用位置及其規則、定期頻率、收入分配、備份及 IndexedDB 結構均保持原樣，沒有 CSS、依賴或資料庫初始化變更。

## 本輪驗證與重跑方式

- 在**全新隔離來源**執行 `node tests/local_first_preview.mjs 20231 --secure`，不要使用已有帳本的來源。`/tests/local-first-navigation.html` 以新隨機後綴的合成 IndexedDB 執行真正頁面；新增斷言先失敗於共同收合外層，再通過 **10 組**。包含原表單物件不變、個別 disclosure、所有表單／選項草稿、連結聚焦與返回；純導覽期間拒絕任何 IndexedDB 交易，前後原始列／metadata 與完整備份相同。既有收入分配草稿、隱私、搜尋／月曆更改與取消／刪除回歸保留。
- 同一全新來源 `/tests/local-first-budgets.html` **4 組**、`/tests/local-first-recurring.html` **5 組**通過；只初始化各 fixture 的專用合成資料庫，涵蓋預算設定／清除／下限／歷史零元、固定／訂閱／分期原型別與期數、更改／取消／停用、精確統計、競態及配額 rollback。不能將這些合成流程當成正式帳本測試。
- 審查在第二個新來源 `127.0.0.1:20233` 重現 `/tests/local-first-settings.html` 對舊共同 details 的過時斷言失敗；改為實際設定區／獨立入口後 **6 組**通過，保留分類／付款交易、草稿、歷史快照、取消、跨分頁衝突及移動後 XSS 檢查。`/tests/local-first-fixed.html` **5 組**通過；`/tests/local-first-ui.html?case=settings-dialog` 及 `?case=fixed-dialog` **各 11 組**故障保護通過。保留未知儲存錯誤、quota、abort、重複提交、舊 revision 與提交後畫面故障的原有規則，沒有修改核心。版本強斷言曾在升版後失敗，同步當前頁面／快取及假下一版 fixture 後完整 Node 套件重新通過。
- 全部 `tests/test_local_first*.mjs` 中非入口檔 **139／139**，入口服務另跑 **8／8**；正式檔案 audit 防護啟動器執行既有 `tests/run_discord_validation.py` **458／458，37.154 秒**，禁止正式 data.db／Token／.env 開檔、非暫存 SQLite，隔離真 dotenv，保留測試自己的暫存設定。Ruff、**71** 個本機／測試 JS 語法與 `git diff --check` 通過。受限環境停滯後停止自己的程序，以相同防護重跑成功；未停用測試、放寬帳務規則或更換依賴。
- 實際產品 `/local-first/` 的全新合成帳本：桌面 Enter 展開預算，輸入未儲存總預算 `1500` 與定期草稿後，用鍵盤／滑鼠切分類、Tab 到返回連結及返回預算；焦點正確、兩份草稿及原收合狀態保持。桌面實際可用寬／scrollWidth 均 1265px。這些值只存在頁面草稿，沒有按儲存。
- 瀏覽器 viewport 覆寫沒有改變實際寬度，故改用既有 `/tests/local-first-narrow.html` 的 **375px 原生 iframe**；新增的 `/tests/local-first-product-frame.html` 只由測試預覽提供、讀原 index 及 page.mjs，不複製產品。該測試路由保留 CSP 且僅把 frame-ancestors／X-Frame-Options 改成同來源；正式 `/local-first/` 及固定服務維持 DENY，測試頁不在 SW 白名單。子頁可用寬／scrollWidth 均 **360px**，預算 `3750` 及定期草稿往返保留，鍵盤焦點落在原預算入口；截圖在忽略的 `.tmp/planning-375-proof.jpg`。不是實體手機或瀏覽器全部政策驗證。
- `/tests/local_first_offline_settings_browser.html` 核對新版 `local-first-offline-0.18.1-v1` 及 **17** 個必要同來源靜態資源，包含分流入口、分類標題及導覽程式；沒有測試頁、帳目、備份或 query 快取。桌面／窄版純導覽後，原始列／metadata／完整備份仍逐位元組不變。停止本輪自己的 20231 服務並確認無監聽，關閉產品及全部窄版子頁，再同網址新頁冷啟動：離線預算、分類連結及返回正常，再次唯讀檢查 PASS，產品頁無 error／warn。

## 更新與尚未驗證

固定啟動方式不變；先自行保留未儲存草稿，保持服務在線至必要資源完整下載，關閉同來源全部舊頁後再開。沒有強制刷新、skipWaiting、新 schema 或資料初始化。更新 fixture 只將當前基準設 0.18.1、合成假下一版設 0.18.2，不表示已有下一版產品；本輪未重跑兩舊頁等待／自然啟用的完整原生演練。

未驗證實體手機、其他瀏覽器、真螢幕閱讀器、正式帳本／備份、真 OAuth、整個瀏覽器程序退出或裝置故障。未讀取或修改正式 data.db、Token、.env、既有備份／匯出或使用者來源；未 stage、commit、push。工作起點為乾淨的 `codex/localhost-web-auth`／`f63bc8175cf8b8ae9a68487bd644864bc5284108`，僅本輪介面、相關測試與文件修改；不以這次 UI 驗證宣稱可安全搬移正式帳本。

# 0.18.0 第 0 階段：使用者手動驗收與本機版本保存 — 2026-10-07（回報日）

**僅供合成資料測試，請勿輸入真實帳目；IndexedDB 未加密，Python Web 尚未被取代。** 本節只補充驗收來源及本機版本保存，不新增功能、不升版本、不宣稱正式帳本已可安全搬移。

使用者直接回報：已親自在兩個全新普通瀏覽器設定檔、隔離來源及合成資料下完成下列四項。全部明確標為**使用者手動驗證**，不是代理工具本輪獨立觀測，也不是對先前工具下載逾時結果的改寫。

| 項目 | 證據來源 |
| --- | --- |
| 加密完整備份檔實際落地 | 使用者手動驗證 |
| 另一完全空白設定檔選取同一檔案，錯密碼安全拒絕，正確密碼還原 | 使用者手動驗證 |
| 關頁重開，資料仍保留 | 使用者手動驗證 |
| 再次下載完整備份 | 使用者手動驗證 |

這四項補足第 0 階段前輪因工具能力而未能確認的實體流程。代理工具仍無法建立兩個全新設定檔或獨立核對實體下載檔；使用者未回報兩份實體加密備份解密後的十八類全文／精確數值／操作順序逐位元組比對。加密每次使用新隨機參數，不能以兩份密文相同作為要求。既有 Node／原生 IndexedDB 的精確內容往返屬合成自動驗證，與這次使用者手測分開記錄。

本輪核對分支 `codex/localhost-web-auth`、提交前 HEAD `deae393bcfeb579c82f0074a6f70e83a2d475c71`、版本 0.18.0，以及前輪列出的 35 個候選路徑（29 個 tracked 修改、6 個未追蹤、staged 初始為空）。更新本節及目前版本 CHANGELOG 前，35 檔 SHA-256 全部與第 0 階段候選 manifest 相同；因此沒有重新執行產品測試。本輪僅新增這兩份文件的手測紀錄，其餘候選內容保留。

以下準確轉錄第 0 階段前輪報告，**不是本輪重跑**：

| 已執行的前輪檢查 | 結果 |
| --- | --- |
| Node／隔離隨機埠入口 | 139／139、7／7 |
| 正式資料檔與非暫存 SQLite 防護下的完整 Python 隔離測試 | 458／458，38.912 秒；沙箱 socketpair 停滯後，在可用環境保留相同防護重新完成 |
| Ruff／JavaScript 語法／授權資源 | Ruff 通過、72 個 JS 通過、7 檔 SHA-256 通過 |
| 標籤原生交易／十八類加密畫面 | 8 組／10 組；包含錯密碼、損壞、非空白／雙頁拒絕、容量、abort、空白原子還原及新隨機參數；File／Blob／bytes 測試不冒稱實體檔落地 |
| 匯出與離線資源 | 原始列、metadata、完整 JSON v5 在匯出與冷啟動前後逐位元組不變，17 個必要離線資源完整 |

本輪重新執行的是候選／manifest 範圍及內容比對、常見秘密樣式與資料檔排除、7 檔第三方資源／授權雜湊及既有追蹤狀態、版本一致性、`git diff --check`、staged 路徑與內容核對。35 個候選包含既有 0.17.1 四區分流／隱私與 0.18.0 標籤的產品、測試及必要文件；啟動器、固定服務與第三方原檔／授權已存在 HEAD，不需另行改寫或新增套件。提交使用明確路徑，不包含 `.tmp`、帳本、備份、下載檔、Token、`.env` 或測試產物；不 push、建 PR 或操作正式資料。原始本機報告及 manifest 為忽略的測試產物，相關結果已轉錄於本節，無須提交它們。

仍未驗證：代理工具獨立觀測四項實體流程、兩份實體備份解密後完整內容比對、真螢幕閱讀器、實體手機／其他瀏覽器、真磁碟配額／裝置損壞、整個瀏覽器程序退出，以及兩個舊頁等待新版 worker 的原生演練。保留合成資料定位，不把四項手動驗收或本機 Git 保存稱為正式帳本搬移或安全認證。

# 0.18.0 消費標籤合成驗收 — 2026-10-06

**僅供合成資料測試，請勿輸入真實帳目；IndexedDB 未加密，Python Web 尚未被取代。** 以下是本輪重新執行的隔離合成驗收，不是正式帳本搬移、安全認證或使用者先前手測的重測。

實際起點 0.17.1，分支 `codex/localhost-web-auth`，HEAD `deae393bcfeb579c82f0074a6f70e83a2d475c71`；開始有 18 個 tracked 修改、1 個未追蹤（既有四區導覽測試），staged 為空，全部保留。先核對工作樹 AGENTS.md、消費交易、shortcuts／定期規則、JSON v1～v4、加密封裝、原生 IndexedDB 與 Service Worker。先看到缺少純函式／畫面及原生中間列移除失敗，再完成實作；沒有另開純文件階段。

資料流：原消費表單的選填標籤草稿 → 原子消費／action／標籤／關聯／metadata 交易 → 原快照清單及單標籤唯讀統計。設定顯示與移除沿用同一帳本交易；移除保留消費及原 before，遞增受影響消費 revision，標籤關聯變更也更新標籤 revision。格式／正規化／升級步驟見[標籤與備份契約](local-first-tags-backup-format.md)。

| 驗證階段 | 本輪實際結果 |
| --- | --- |
| 純規則 | 標籤 6／6：空白／顯示符號／NFC、大小寫及不同字形不合併、隱藏完整名稱重用、多標籤各自完整金額、作廢／未來／非消費排除、日期兩端、65 筆超過顯示批次及超安全整數精確總額、全域移除／revision 上限、畸形引用與容量拒絕 |
| 標籤原生 IndexedDB | 8 組：舊 v5→v6 完整 bytes 保留、損壞升級回滾兩個新 store、新標籤與單消費／action 同交易、容量例外及 request 成功後 abort、中間列刪除保留其他定義／關聯、雙連線一勝一拒、隱藏重用、全域移除回滾／舊消費 revision、四來源事後標記／作廢不復活、唯讀不變、十八類加密空白原子還原、100000 列邊界 |
| 原生回歸 | 記帳 11、儲存 7、四來源單筆 4、舊完整備份 12、收入 7、年度 8、使用期間 9、分類／付款 9、預算 8、固定 9（含精確 64 MiB 邊界）、訂閱／分期 8、捷徑 6，加標籤 8，共 **106 組** |
| 標籤畫面 | 10 組：預設收合／取消／無效消費不建標籤、多標籤與重複提交只記一筆、單一標籤全部時間／日期範圍唯讀、搜尋更改只取消關聯、隱藏後不建同名新定義、重新顯示／取消及確認全域移除、另一連線剛加入的標籤保留於新搜尋編輯快照、容量失敗保留輸入／固定錯誤、舊設定拒絕覆寫、設定手動新增／重複及同名拒絕 |
| 畫面回歸 | 四區導覽 8、加密 v5 10（十八類預覽／錯密碼／竄改／取消／雙頁／quota／abort）、比較 11、CSV 7、固定 5、訂閱／分期 5、預算 4、收入 10、年度 7、捷徑 15、使用期間 8、分類／付款 6、搜尋／月曆 11、共用故障 11，加標籤 10，共 **128 組** |
| 全面檢查 | Node **139／139**（排除固定埠入口檔）、入口只監聽隨機埠 **7／7**、受正式檔案及非暫存 SQLite 防護 Python **458／458**、Ruff、**72** 個 JavaScript 語法、**7** 檔既有資源／授權 SHA-256、`git diff --check` 通過。Python 新增 v5 安全拒絕且暫存 SQLite 不變；原 HEAD 的 v4 local-first 讀取器亦實測拒絕 v5。無新增依賴，第三方原檔不變；既有 Python deprecation warnings 未為本輪更換套件 |

20111 為全新 CSP 合成測試來源，20114／20115 分別為收入空白還原／CSV 的獨立來源，20113 為比較來源；20112 是本輪新建產品及窄版來源。沒有操作既有 8767／8768 或使用者帳本。收入與 CSV 最初遇到其他合成測試留下的非空帳本而安全拒絕，改獨立空白來源重跑通過，沒有為重試清除既有帳本。搜尋／月曆首次發生月份等待逾時，其他大型驗證結束後依序重跑 11 組通過；沒有修改月曆帳務規則。瀏覽器連線最初受執行隔離限制，改為允許的本機測試服務；不改防火牆、不新增對外入口。

20112 桌面實際以 Enter 將 `#日本旅行`／`聚餐` 加入草稿，按儲存才建立一筆 1000.01 元消費；分析分別查任一標籤均為 1000.01 元，不重複加總。375px iframe（非實體手機）可從同筆更改查看標籤、鍵盤取消、查另一標籤及到設定管理；內容 clientWidth／scrollWidth 都為 360px。重新整理保留已儲存標籤，純查詢／導覽／取消前後全部原始列、metadata 與 JSON v5 完整備份逐位元組不變。四區仍預設直接記帳，沒有全域啟用開關，沒有強制填標籤。

完成最終 `local-first-offline-0.18.0-v1` 的 17 個同來源、無 query 必要資源檢查後，停止**本輪自己的** 20112 服務，確認拒絕連線，關閉全部產品／窄版子頁，再以相同精確網址新頁冷啟動成功；版本為 0.18.0，離線標籤分析正常。範圍外唯讀助手重新核對快取標籤程式、17 項白名單、全部原始列／metadata 及完整備份逐位元組相同；沒有將帳目、標籤、備份或密碼放入靜態快取。合成畫面截圖保存於忽略的 `.tmp/tags-offline-proof.jpg`。

**未驗證／需手測**：v5 實體下載落地及從該檔還原到另一全新瀏覽器設定檔、真 NVDA 等螢幕閱讀器、實體手機／其他瀏覽器、整個瀏覽器程序退出、真磁碟配額／裝置損壞，以及兩個舊頁等待新 worker 的原生更新演練。本輪加密 UI 用合成 File／Blob 及攔截下載，原生加密還原是 bytes 往返，不能代替實體檔證據。請以合成 v5 親自確認十八類筆數、隱藏標籤與關聯，在空白設定檔還原、關頁重開再備份；不要用正式帳本演練。使用者先前加密檔落地／獨立設定檔還原／重開／再次備份是**使用者先前手動驗證**，不是本輪或 v5 已通過。

本輪產品修改：`local-first/backup.mjs`、`browse.mjs`、`idb.mjs`、`ledger.mjs`、`rules.mjs`、`page.mjs`、`index.html`、`style.css`、`sw.js`。新增 `tests/test_local_first_tags.mjs`、`local_first_tags_browser.html`、`local_first_tags_browser.mjs`、`local_first_tags_ui_browser.mjs` 與 `docs/local-first-tags-backup-format.md`。測試調整（皆位於 tests）：`local_first_preview.mjs`、`local_first_crypto_ui_browser.mjs`、`local_first_storage_browser.mjs`、`local_first_income_browser.mjs`、`local_first_annual_browser.mjs`、`local_first_usage_browser.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_update_browser.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`test_browser_portable_backup.py`。文件同步 `README.md`、`CHANGELOG.md`、本文件及 `docs/local-first-encrypted-backup-format.md`。保留原四區導覽、快速刪除 close guard、測試／文件及未追蹤導覽測試的既有修改；Python／Discord 核心未改。

最終 Git：29 個 tracked 修改、6 個未追蹤（含既有導覽測試），staged 0；分支與 HEAD 不變。不 stage／commit／push／更新 PR，不讀寫正式 data.db、Token、.env、使用者備份；只停止本輪自己的隔離服務。

# 0.17.1 四區導覽與隱私說明合成驗收 — 2026-10-06

**僅供合成資料測試，請勿輸入真實帳目；IndexedDB 未加密，Python Web 尚未被取代。** 以下為本輪重新執行的結果，不是正式資料或安全認證。

實際起點 0.17.0、分支 `codex/localhost-web-auth`、HEAD `deae393bcfeb579c82f0074a6f70e83a2d475c71`；工作樹及 staged 均乾淨。先核對 AGENTS.md、原表單／details／對話框／焦點、靜態服務、Service Worker、備份及儲存流程，再逐項先測失敗、實作與驗證。只改呈現及導覽，不更動 ledger／rules／idb／backup／crypto、Python／Discord 帳務或儲存契約。

| 步驟 | 本輪實測 |
| --- | --- |
| 四區與首次隱私 | 先見缺入口失敗；空白帳本可選擇閱讀並返回開始／還原，不初始化帳本，不增加第五主入口。區域 mapping、預設記帳、單一可見區域、aria-current／aria-controls 與標題焦點通過 |
| 草稿及純導覽 | 多次切區保留全部表單值、使用期間、收入、分配、年度、比較、分類、捷徑與備份密碼／選擇；既有 details 開啟狀態保留。以實際 IndexedDB 攔截計數證實切區／隱私零交易，raw 列、metadata 及完整備份不變。圖表只有尺寸重繪，不重新查詢或計算帳目 |
| 原流程與快速對話框 | 搜尋／月曆取消、更改、刪除後條件及選取日期保留，焦點回原清單。快速取消後立即重開刪除先測出舊 close 清掉新狀態；共用一行 guard 修正後通過，沒有更動交易。年度草稿切到記帳、分期查看切到規劃；錨點及 CSV 收合可達 |
| 畫面回歸 | 新導覽／隱私 8、比較 11、加密 v4 10、CSV 7、固定 5、訂閱／分期 5、預算 4、收入 10、年度 7、捷徑 15、使用期間 8、分類／付款 6、搜尋／月曆 11，共 **107 組**；舊 fixture 只補先選對應區域，核心斷言保留 |
| 全面檢查 | Node **133／133**（排除固定埠入口檔）、隨機埠入口 **7／7**、受正式檔案與非暫存 SQLite 防護 Python **457／457**、Ruff、**69** 個 JS 語法、**7** 檔既有授權／資源 SHA-256、`git diff --check` 通過。無新增依賴；既有 Python deprecation warnings 未為此更換套件 |

19901 是新的 CSP 合成來源，19902 是 CSV 的獨立空白合成來源；未讀寫現有來源。加密／還原及 CSV 畫面驗證使用合成 File／Blob／攔截下載，沒有把它當成實體檔落地證明。原保存狀態及帳本開啟復原規則維持，沒有新權限申請或自動備份。

19903 全新產品來源，以 Enter 開啟／返回首次隱私，開始帳本後填 100.01 元合成草稿，Enter／Space 切規劃及記帳保留原值；確認後在分析看見精確 100.01 元／1 筆及既有圖表。設定內備份預設仍加密，切區保留已開啟設定，明確取消才清空。375px iframe（非實體手機）可切區、開隱私並返回；實際 clientWidth／scrollWidth 都為 360px。ARIA 區域／標題及鍵盤有核對，沒有冒稱真螢幕閱讀器驗收。重新整理預設回記帳且已記錄資料保留；本輪不新增跨重新整理的草稿永久保存。

固定來源、IndexedDB v5、完整 JSON v1～v4 及加密封裝 v1 不變。最終快取 `local-first-offline-0.17.1-v1` 保持 17 個同來源、無 query 的必要靜態資源；核對快取內導覽、隱私及既有功能模組。停止**本輪自己的** 19903 服務、確認拒絕連線，關閉產品主頁及窄版子頁，再以同一固定測試網址新頁冷啟動，四區與隱私可使用，離線就緒回報成功。範圍外唯讀助手在純導覽／隱私與冷啟動前後比對全部原始列、metadata 與完整備份逐位元組一致；不把帳目、備份、密碼放入靜態快取。

隱私短文根據目前程式：帳本按瀏覽器設定檔／來源存於 IndexedDB；加密下載不加密帳本；密碼未持久保存且無取回；固定服務僅提供白名單靜態讀取，頁面載入及更新仍要求本機資源。只說目前沒有帳務上傳／雲端同步入口，避免對整台電腦、擴充套件或其他軟體作絕對承諾；不冒稱正式隱私政策。

未驗證：本輪實體下載落地／獨立設定檔從檔還原、真 NVDA 等螢幕閱讀器、其他瀏覽器／實體手機、整個瀏覽器程序退出、真配額／裝置損壞、正式帳本及 0.17.0→0.17.1 的兩舊頁更新等待。更新不強制刷新／skipWaiting 的既有程式未改，相關 Node 安裝失敗與等待／草稿保留測試通過，但未把替身測試寫成此輪原生更新演練。使用者先前下載／還原／重開／再次備份仍標為**使用者先前手動驗證**，不是本輪重測。

修改：`local-first/index.html`、`page.mjs`、`style.css`、`sw.js`；新增 `tests/local_first_navigation_browser.mjs`；調整 preview、offline_settings、update、fixed／recurring／budgets／comparison／crypto／csv 畫面 fixture 與 Node offline／update_status；同步 README、CHANGELOG 與本文件。不 stage／commit／push／更新 PR，未碰正式 data.db、Token、.env、既有 8767／8768 帳本或使用者備份，未停止使用者服務。

# 0.17.0 操作捷徑合成驗收 — 2026-10-06

**僅供合成資料測試，請勿輸入真實帳目；IndexedDB 未加密，Python Web 尚未被取代。** 本節僅記錄本輪重新執行的結果，不是正式帳本驗證或安全認證。

實際起點 0.16.1，分支 `codex/localhost-web-auth`、HEAD `ba063a69b37573ecd9668b4a2f8940d0040e5479`，工作樹及 staged 清單皆空白。先讀 AGENTS.md、Python 捷徑與匯出規則、local-first 備份／交易／記帳流程，再逐項先測失敗、實作及驗證。

資料流：手動填寫或唯讀帶入手動消費 → 驗證來源與有效選項 → 設定交易保存捷徑 → 點選僅預填原消費表單 → 使用者確認後原消費交易入帳。年度費用的實付雖為 manual，仍依 annual_periods 連結排除。捷徑沒有來源關聯、不複製使用期間，也不增加支出統計。

沿用 `id,name,category,payment_source_id,note,cents,position,active` 八欄位；名稱 1～30 字、項目 1～200 字，選填新金額正數／最多兩位小數／十億元上限，空白保存 null。排序用精確 position／ID，人工移動時重編啟用順位以處理舊資料同順位及 int64 上限；停用列保留。捷徑沒有新 revision 欄位，交易內比對整份已查看快照，衝突拒絕；原消費 revision 保護不變。來源唯讀不增加原消費 revision，仍可讀取已達上限的有效來源，但原消費更改／作廢仍拒絕超限。

| 驗證層 | 本輪結果 |
| --- | --- |
| 純資料及金額 | 新增 5 項，先見缺核心／排序失敗後實作。選填金額、精確小數、名稱／項目／欄位注入、來源資格及 revision、年度排除、獨立設定、相同／大整數順位、停用、損壞資料與 100000 列容量拒絕通過 |
| 捷徑原生交易 | 6 組：設定不產生消費／action、重複 ID、兩連線同快照只有一勝、各操作容量例外與 request 成功後 abort 全回滾、來源作廢後獨立保留、JSON v1／加密往返、容量 metadata 一致 |
| 原生回歸 | 捷徑 6、記帳 11、儲存 7、四來源單筆 4、舊完整備份互通 12，共 **40 組** |
| 捷徑畫面 | **15 組**：首頁三個／完整收合清單、可留空金額、長文字窄版換行、同頁選項刷新、只預填／取消不入帳、不帶使用期間、確認只記一筆、有效清單／搜尋／月曆共用帶入、排序／停用、失效分類與付款須改選、寫入失敗保留草稿、所有自動與年度來源無入口、另一頁舊草稿在本頁刷新及排序後仍拒絕 |
| 畫面回歸 | 捷徑 15、使用期間 8、搜尋／月曆 11、年度 7、設定 6、加密 v4 10、訂閱／分期 5、預算 4，共 **66 組**；全部在本輪隔離來源執行 |
| 全面檢查 | Node **133／133**（排除固定埠入口檔）、隔離隨機埠入口 **7／7**、受正式檔案及非暫存 SQLite 防護 Python **457／457**、Ruff、**68** 個 JS 語法、**7** 檔既有授權／資源 SHA-256、`git diff --check` 通過 |
| Python 相容 | 新捷徑從 local-first JSON v1 還原至暫存 SQLite，再匯出核對九類、精確金額、空值、排序、停用與付款引用；原消費／操作歷史及其他領域不變。Python 外部 ID 按既有契約重編，測試依語意／關聯核對，沒有修改 Python 核心 |

19841 是全新 CSP 合成來源；交易、畫面與備份測試未使用既有來源，涉及共享 portable-checks 時依序執行。先看到缺畫面失敗，再實作；審查找到同頁新選項不刷新及排序造成自家新增衝突，均先重現後修正。另先測出舊草稿在「另一頁更改 → 本頁儲存其他消費 → 排序」後會錯誤接受，修正為只有原快照與該操作快照一致才同步；真正舊草稿仍拒絕。最後唯讀審查無剩餘阻擋。

0.16.1 使用期間畫面測試原本在宣告 form 前取用，先實測失敗，再只移動宣告順序，8 組通過；不是改產品。初次完整 Python 在受限制環境沒有完成，停止本輪該測試後，保留同一正式檔案／暫存 SQLite 防護重跑。新增跨 Python 測試最初誤要求外部 ID 字面不變，改為既有重編契約的精確內容／關聯驗證；最終完整 457 項通過，既有 Starlette／Authlib deprecation warnings 未新增依賴來處理。

19842 全新產品帳本實測：建立 100.01 元合成早餐捷徑，設定／點選／取消時消費為 0，Enter 確認後只有 100.01 元；重新整理保留。375px iframe 是窄版子頁面，不是實體手機；30 個連續 W 的名稱曾讓內容寬由 360 溢出至 520px，先補失敗畫面測試後只加換行，完整新版啟用後 clientWidth／scrollWidth 都為 360px。窄版完成更改、空金額新增及上移，預算仍只含一筆實際消費；兩個實際頁面中另一頁更改後，舊頁捷徑提示重新載入、不入帳。

本輪觀察快取 v1→v2→v3 安裝完成但等待，關閉所有產品頁後自然啟用；不強制 skipWaiting。最終 `local-first-offline-0.17.0-v3` 共 17 個同來源、無 query 的必要靜態資源。停止**本輪自己的** 19842 服務並確認拒絕連線，關閉產品頁與窄版子頁，再同網址開新頁，離線冷啟動及捷徑預填成功。範圍外唯讀助手前後核對原始列、metadata 與完整 JSON 備份逐位元組不變；快取不含帳目／備份／密碼。產品 CSP、安全白名單、固定 8768 與 IndexedDB v5／JSON v1～v4／加密封裝 v1 均不變，無新增依賴。

未驗證：本輪實體下載檔落地與獨立設定檔從該檔還原、其他瀏覽器／實體手機、整個瀏覽器程序退出、真配額耗盡／裝置損壞、正式資料及啟動器雙擊。加密畫面使用合成 File／Blob，不代替落地；先前使用者親自驗證的下載／還原／重開／再次備份仍是**使用者先前手動驗證**，不是本輪重測。沒有讀寫正式 data.db、Token、.env、使用者備份或既有 8767／8768 帳本，不 stage／commit／push／更新 PR，不停止使用者服務。

修改檔案：`local-first/index.html`、`page.mjs`、`ledger.mjs`、`rules.mjs`、`style.css`、`sw.js`；新增 `tests/test_local_first_shortcuts.mjs`、`local_first_shortcuts_browser.html`、`local_first_shortcuts_browser.mjs`、`local_first_shortcuts_ui_browser.mjs`；調整 preview、offline_settings、update、usage_ui、Python portable_backup、Node offline／update_status fixture；同步 README、CHANGELOG 與本文件。原備份驗證、加密、IndexedDB、白名單及第三方檔案沒有更改。

# 0.16.0 使用期間與共用快結束合成驗收 — 2026-10-05

**僅供合成資料測試，請勿輸入真實帳目。IndexedDB 未加密；Python Web 尚未被取代。** 本節是本輪重新執行的證據，不是正式帳本、安全認證或使用者先前手測的重測。

實際起點 0.15.0；分支 `codex/localhost-web-auth`、HEAD `26efd0fffc4e409b43c275aa3fe1f3f4b49c2768`；開始有 22 個已修改、13 個未追蹤，staged 空白，全部保留。資料流為原消費表單 → 同一交易保存消費／action／追蹤／metadata → 唯讀提醒，不建立第二筆費用。格式與升級規則見[JSON v4／IndexedDB v5](local-first-usage-backup-format.md)。

| 步驟 | 本輪實際驗證 |
| --- | --- |
| 純規則先失敗再實作 | 原先缺模組／完整備份省略追蹤，先見失敗後完成 6 項：1／7／180 天、閏年、跨月／年、門檻與開關、同名獨立、每日成本精確約數、分期撤銷進度、金額／預算／搜尋／月曆／比較／CSV 不變、舊版本與畸形引用拒絕 |
| 使用期間原生交易 | 先見 Usage not atomic，再完成 9 組：v4→v5 原 bytes 保留、損壞升級中止、單消費／action／追蹤、穩定提交 ID 防重複、兩連線同 revision 一勝一拒、容量失敗及 request 成功後 abort、停止／恢復／撤銷歷史、重新讀取失敗不破壞已提交內容、四來源日期核心限制及不復活、100000 列邊界、十六類加密空白原子還原與重開 |
| 原生回歸 | 使用期間 9、記帳 11、儲存 7、四來源單筆 4、年度 8、收入 7、訂閱／分期 8、分類／付款 9、預算 8、固定支出 9（含精確 64 MiB 邊界）、舊 JSON 互通 12，共 92 組 |
| 實際畫面模組 | 使用期間 8、加密 v4 10、收入 10、年度 7、訂閱／分期 5、搜尋／月曆 11、支出比較 11、固定 5、設定 6、預算 4、CSV 7，共 84 組；選填／預設關閉成本、安全 DOM、保留失敗輸入、stale 狀態、統計不重複、停止後恢復及共用分期入口通過。首次追蹤起始日未跟隨更改日期的缺口先測失敗，再修正，已保存起始日仍獨立 |
| 持久保存與開啟故障 | 11 情境各自通過：已獲准、拒絕、申請成功、不支援、僅支援查詢、查詢失敗、查詢中、申請失敗／申請中、帳本不可用、初次讀取失敗；固定安全復原指引與單次申請保留，帳本唯讀不變 |
| 全面檢查 | Node 127／127、隔離隨機埠入口 7／7、受正式檔案與非暫存 SQLite 防護 Python 456／456、Ruff、64 個 JS 語法、7 檔授權／資源 SHA-256、`git diff --check` 通過；Python 包含 JSON v4 安全拒絕且 SQLite 不變，不新增 Python 功能。第三方資源不變、無新增依賴 |

19731／19732 為本輪新建的 CSP 合成來源，19734／19735 分別使用空白來源檢查比較／CSV。既有來源或帳本未操作；原生 fixture 有共用 portable-checks 時依序執行。比較／CSV 首次遇到其他合成測試已初始化帳本而安全拒絕，改新來源重跑通過，未清除或覆蓋帳本。最終隨機埠測試首次在沙箱遭 EACCES，僅允許同一隨機埠測試重跑 7 項通過；固定 8768 占埠／啟動器未重測。

19733 全新合成產品頁實測 100.01 元洗髮精／7 天／約 14.2871 元／天，快結束顯示剩 6 天，預算仍只含 100.01 元。375px iframe（非實體手機）實際內容與 scrollWidth 都為 360px，可停止後儲存、再恢復為 1 天，顯示今天預計用完；鍵盤 Enter 提交及重新整理保留。提醒始終是估計，沒有第二筆費用。

最終 `0.16.0-v1` 完整載入後，停止**本輪自己的** 19733 服務，確認拒絕連線，關閉產品頁及窄版子頁，再以相同精確網址開全新頁，離線冷啟動成功。範圍外唯讀助手前後核對 17 個同來源、無 query 的必要快取、原始列、metadata 與 JSON v4 完整備份逐位元組不變，含 usage.mjs。快取只有靜態程式；未放帳目、備份或密碼。新 worker 安裝失敗保留舊快取／不留半份快取另有 Node 測試；本輪未重新演練兩個舊頁等待啟用。

加密 v4 畫面驗證十六類預覽／確認／還原、舊 JSON、取消、錯密碼、竄改、超大檔、雙頁競態、容量與 abort；下載攔截為合成 Blob／File，**不代表實體下載檔落地或從該檔還原**。仍需使用者以合成 v4 親自確認下載存在，在另一個全新空白瀏覽器設定檔以同一固定網址還原十六類，核對提醒與停止／撤銷歷史，關頁重開再備份。先前使用者已手測啟動器雙擊、加密檔落地、空白設定檔還原／重開／再備份，這是**使用者先前手動驗證**，不冒稱本輪或 v4 已驗證。

其他未驗證：正式帳本、其他瀏覽器／實體手機、整個瀏覽器程序退出、真配額／裝置損壞、完整封包擷取及新 v4 的實體備份搬移。未讀寫正式 data.db、Token、.env、使用者備份或既有 8767／8768 帳本，未停止使用者服務；保留既有未提交文件，不 stage／commit／push／更新 PR。密碼只保護備份檔，不保證對抗本機惡意程式、擴充套件或已解鎖電腦。

本輪修改範圍：新增 `local-first/usage.mjs`、`tests/test_local_first_usage.mjs`、`tests/local_first_usage_browser.html`、`tests/local_first_usage_browser.mjs`、`tests/local_first_usage_ui_browser.mjs` 與 `docs/local-first-usage-backup-format.md`。產品調整 `local-first/backup.mjs`、`idb.mjs`、`ledger.mjs`、`page.mjs`、`index.html`、`serve.mjs`、`sw.js`；同步 README、CHANGELOG、本文件及加密格式文件。測試調整 preview、crypto_ui、storage、offline_settings、update、income／annual 原生 fixture、Python portable backup、entry_server、offline、update_status。既有 `backup-crypto.mjs`、收入／年度模組、搜尋等待修正及先前驗收文件的未提交修改保留，沒有順便整理。

交付時 Git 為 22 個已修改、19 個未追蹤，staged 仍空白；分支與 HEAD 不變。本輪自己的隔離服務與頁籤於驗收後關閉，保留測試證據於忽略的 `.tmp`，未清除使用者資料。

# 0.15.0 年度費用合成驗收 — 2026-10-04

**僅供合成資料測試，請勿輸入真實帳目。IndexedDB 未加密；Python Web 尚未被取代。** 以下是本輪重新執行的結果，不等於正式帳本搬移或安全認證。保留此前的驗收紀錄與未提交文件。

起點實際為 0.14.0，分支 `codex/localhost-web-auth`、HEAD `26efd0fffc4e409b43c275aa3fe1f3f4b49c2768`；開始為 21 個已修改、7 個未追蹤，staged 空白。收入／分配與既有恢復更新的修改全部保留。年度完整資料契約及升級步驟見[JSON v3／IndexedDB v4](local-first-annual-backup-format.md)。

| 步驟 | 本輪實際驗證 |
| --- | --- |
| 核對既有規則 | 使用 `fixedDueDate` 的月底／閏年處理、原消費驗證及操作紀錄；未確認年度資料獨立於消費。使用者明確確認已開始草稿保留、停用仍可處理舊草稿 |
| 純計算與資料變更 | 先觀察缺模組／缺核心操作的 5 個失敗案例，再實作；分類更改引用、選用畫面與靜態白名單、匯入未來草稿亦先失敗後修正。年度 11 項涵蓋月界／跨年／閏年、精確參考額、停用分類／付款、已處理期數、stale revision、100000 列邊界、損壞引用與唯讀。未確認草稿不進搜尋、月曆、預算、比較及 CSV |
| 原生交易 | 年度 8 組：v3→v4 原 bytes 保留、損壞升級原結構保留、雙連線／重複操作、容量錯誤、request 成功後 abort、更改／停用凍結草稿、確認原子消費＋action＋期數、略過、消費更改／撤銷不復活、十五類加密還原與關頁連線重開 |
| 原生回歸 | 年度 8、收入 7、儲存 7、記帳 11、四來源單筆 4、定期 8、分類／付款 9、預算 8、舊 JSON 互通 12，共 74 組；共享 portable-checks 頁面依序執行，不並行覆寫測試帳本 |
| 實際畫面模組 | 年度 7、收入 10、訂閱／分期 5、搜尋／月曆 11、v3 加密備份 10、固定 5、分類／付款 6、預算 4，共 58 組。包括取消、失敗保留輸入、安全錯誤、XSS 純文字、舊狀態衝突、不改已存分配及十五類確認／還原。加密畫面攔截下載為記憶體 Blob，**不是下載落地證明** |
| 全面檢查 | Node 121／121（排除固定埠入口檔）、隨機埠入口 7／7、受正式檔案存取及非暫存 SQLite 防護的 Python 455／455、Ruff、60 個 JS 語法及 7 個原資源／授權 SHA-256 通過；最終 `git diff --check` 通過。第三方資源未改、新增依賴為零 |

隔離來源 19621／19622 用合成資料測原生交易與既有畫面回歸，包含既有 CSP 下的年度與加密操作。19623 以全新合成帳本實際新增年度保險、鍵盤提交 1100.29 元實付；每月參考額 100.01 元與實際支出分列。375px iframe 實際內容寬 360px／scrollWidth 360px，可新增年度設定及找到待記錄；這是窄版子頁面，不是實體手機。重新整理保留已記錄與待記錄狀態。

19623 的最終 `0.15.0-v2` 完整下載後仍等待；停止**本輪自己的**服務並確認連線拒絕，關閉主頁及窄版子頁，再用同網址新頁冷啟動成功。唯讀助手在更新前後核對全部 store 原始列、metadata 與 JSON v3 備份逐位元組不變，並確認 16 個同來源、無 query 的必要靜態資源，包含阻擋未來草稿的新模組；沒有帳目／備份／密碼進靜態快取。

19625 原生更新演練使用測試新版標籤 0.15.1（**非發行版**）：故意缺 Chart.js 時安裝失敗、不保留半份快取；恢復完整資源後仍等待，兩個 0.15.0 控制頁保留未儲存草稿，只關一頁不啟用。停服並確認拒絕連線，關閉最後一頁後自然啟用、同網址離線重開成功；十五類原始列／metadata／備份均不變。更新助手採無 CSP 的隔離預覽；CSP 與安全白名單另於入口及畫面測試驗證。19624 的安全標頭預覽視窗助手未完成跨頁檢查，未把它寫為通過，未因此放寬產品 CSP／COOP。

測試過程與處理：搜尋畫面固定等待 100ms 在同時開多個驗收頁時曾誤報，稍後結果已安全顯示；僅將該驗收改為等待指定結果，11 組重跑通過。首次 Node 集合誤包含固定埠案例，連線遭沙箱 EACCES 拒絕，未取得既有帳本內容；後續排除該案例，只在隨機埠完成入口 7 項，**本輪不宣稱固定 8768 占埠／啟動器已重測**。檔案寫入曾帶入 CRLF 差異，已只恢復本輪寫入檔案的原 LF 行尾；沒有全專案格式整理，最後差異檢查無錯。

仍需使用者手動驗證：使用合成 v3 下載檔，親自確認落地後，在另一全新空白瀏覽器設定檔以同一固定網址還原，核對十五類及已記錄／略過／待記錄狀態，關頁重開並再備份；本輪未證實檔案落地或從該實體檔還原。先前使用者已親自確認啟動器雙擊、加密檔落地、空白設定檔還原／重開／再備份，仍標為**使用者先前手動驗證**，不冒稱本輪重做或已驗證 v3。

其他未驗證：正式帳本、真 OAuth、真配額耗盡／裝置損壞、其他瀏覽器／實體手機、整個瀏覽器程序退出重開、完整網路封包與 CSP 下的跨視窗更新助手。所有輸入與帳本演練為新隔離合成資料；未讀寫正式 data.db、憑證、使用者備份或既有瀏覽器帳本，沒有停止使用者服務。本輪未 stage／commit／push／更新 PR，保留原未提交文件。備份密碼只保護檔案，遺失無法取回；不抵禦本機惡意程式、擴充套件或已解鎖電腦。

# 瀏覽器本機記帳驗證頁

目前專案版本：0.17.1；更新日期：2026-10-06；local-first 頁面版本 0.17.1，快取 `local-first-offline-0.17.1-v1`。**僅供合成資料測試，請勿輸入真實帳目。**

先前 0.13.14（2026-10-04）的全流程驗收、重新執行數字、桌面／375px／離線證據及該回合未確證的下載檔復原閉環，另見[生活消費功能驗收](local-first-functional-acceptance.md)。該回合只補文件、版本不變；以下歷史驗證不自動算作本輪重測。

## 0.14.0 收入與每月分配第一階段

1. 保持消費首頁，按次要「收入與每月分配」才展開。按月份查看已收到收入合計、明細、用途規劃及規劃差額；新增／更改／確認作廢收入不改分配，不接受未來收到日期。分配可低於、等於或超過收入，無收入也可保存；只有生活開銷草稿，不自動複製／覆蓋，新增項目由使用者命名。
2. 展開生活開銷建議，核對固定／訂閱／分期的應付月份、有效版本、短月／歷史空白日及明細；包含尚未到期但本月應付的項目，只供規劃。按「將建議合計填入生活開銷草稿」後仍須儲存；月份排除只影響該月，定期設定的往後排除從操作本月起生效，均不修改扣款規則或消費。
3. 升級 IndexedDB v3 保留原名稱／九類資料，新增四類。JSON v1／v2、自動選擇匯出版本及舊 Python 拒絕限制見[收入備份契約](local-first-income-backup-format.md)。含新資料要使用 0.14.0 或更新的相容 local-first，不能以改版本／裁切新資料回存 Python。先保留草稿，完整下載 15 個靜態資源，關閉舊頁再使用新版；保留原資料及備份，不能降回舊程式開啟 v3。

### 本輪實際合成驗證

- Node 110／110及隨機埠入口安全 7／7；明確排除會占用固定 8768 的 CLI 測試。受正式檔案、憑證及非暫存 SQLite 防護完整 Python 454／454，新增 v2 拒絕／SQLite 不變案例，沒有修改 Python 產品邏輯。
- 原生 IndexedDB 75 組：核心 11、儲存／遷移 7、完整 v1 互通 12、四來源單筆 4、預算 8、固定 9、訂閱／分期 8、分類／付款 9，以及新增收入／分配 7。新增案例含 v2→v3 逐位元組保留、損壞升級 abort 仍為 v2、精確收入／作廢／雙連線、分配獨立、quota／request 成功後 abort、v2 消費寫入保持四類 finance 與 metadata、加密十三類空白還原／重複還原拒絕及唯讀／連線重開。舊回歸共用 portable-checks 時互撞，換隔離來源／依序重跑，沒有修改產品來掩蓋測試干擾。
- 畫面 90 組：一般安全操作 11、搜尋／月曆 11、分類／付款 6、預算 4、固定 5、訂閱／分期 5、比較 11、CSV 7、v1 加密 10、v2 加密 10、新收入／分配 10。新案例包含閉合入口、無收入／自訂安排、收入更改／確認作廢／取消、保留失敗輸入、切月與重開、兩種排除、舊 revision、快速切月順序及讀取快照不能覆蓋已提交收入；先重現後修正。
- 使用全新 19420～19440 範圍內的不同隔離來源；沒有開啟既有 8767／8768 或使用者 18773。嚴格 CSP 下原有圖表／備份及新功能正常。桌面與 375px iframe 手動用鍵盤新增合成消費 1.23、收入 100.25、分配 200，顯示超出收入 99.75，消費仍為 1.23；重新整理保持資料。子頁面內容 `clientWidth=scrollWidth=360`，不是實體手機或整個瀏覽器 viewport。
- 最終 19434：收入等交易測試的早期 6 組版本建立合成 v2 帳本，讀取收入 0.11、分配 3、超出 2.89；確認 15 資源完整後停本輪自己的服務、HTTP ECONNREFUSED、關閉 scope 舊頁、同網址新頁成功冷啟動。收入入口仍收合；開啟後合計及分配相同，唯讀基準核對原始十三類資料、meta 及完整備份 bytes 全部不變，快取只有白名單靜態資源。後續第 7 組消費／finance 共存另在 19440 驗證。
- 19428 原生更新回歸：0.14.0 控制兩個頁面，缺少 Chart.js 的合成 0.14.1 安裝失敗時沒有不完整快取，舊版與未送出草稿不變；完整資源下載後明確等待，關閉一頁仍等待，停服／關閉最後舊頁才自然啟用。新頁同網址離線顯示測試標籤 0.14.1，15 靜態資源及九類帳本／meta／備份逐位元組不變。0.14.1 僅測試標籤，交付版本仍為 0.14.0；這項不是舊 0.13.14 worker 與資料庫升級同時進行的演練，資料庫 v2→v3 另有原生驗證。
- Ruff、54 個相關 JavaScript 語法、7 個第三方資源 SHA-256／MIT 紀錄及 git diff --check 通過，CSP 與服務靜態白名單包含收入模組。沒有新增依賴、帳務 API、第三方請求或背景入帳。唯讀程式審查另核對新四類完整備份、交易及畫面草稿；未發現阻擋問題，不代替實機／正式資料驗證。

### 使用者手動驗證及未驗證

先前使用者手動驗證的合成加密檔落地、全新空白設定檔還原、重開及再次備份維持歷史紀錄，本輪沒有重做，尤其不能視為新 JSON v2 已落地驗證。新 v2 這次使用 File／Blob／記憶體及原生 IndexedDB 往返；仍需使用者在合成帳本親自確認 v2 `.llbk` 下載檔存在，在獨立全新空白設定檔解密、核對十三類及作廢／分配／排除歷史，重開後再備份。

尚未驗證其他瀏覽器／實體手機、結束整個瀏覽器程序、實際配額／磁碟耗盡、正式資料搬移、完整封包或本機惡意程式抵抗。IndexedDB 未加密；備份加密只保護檔案，密碼忘記無法取回。合成測試不代表正式資料驗證或安全認證，Python Web 尚未被取代。

### 本輪修改檔案及 Git 狀態

- 程式（9）：`local-first/income.mjs`（新增）、`backup.mjs`、`backup-crypto.mjs`、`idb.mjs`、`ledger.mjs`、`page.mjs`、`index.html`、`serve.mjs`、`sw.js`（後八者同在 local-first）。
- 新測試（4）：`tests/test_local_first_income.mjs`、`local_first_income_browser.html`、`local_first_income_browser.mjs`、`local_first_income_ui_browser.mjs`（皆在 tests）。
- 既有測試調整（9）：`tests/test_browser_portable_backup.py`、`test_local_first_entry_server.mjs`、`test_local_first_offline.mjs`、`test_local_first_update_status.mjs`、`local_first_storage_browser.mjs`、`local_first_crypto_ui_browser.mjs`、`local_first_update_browser.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_preview.mjs`（皆在 tests）。
- 文件（5）：README、CHANGELOG、本文件、`docs/local-first-encrypted-backup-format.md`、新增 `docs/local-first-income-backup-format.md`。保留前三者先前未提交的驗收文字，`docs/local-first-functional-acceptance.md` 既有未追蹤文件沒有修改。
- 分支 `codex/localhost-web-auth`，HEAD `26efd0fffc4e409b43c275aa3fe1f3f4b49c2768` 不變；最後 21 個已追蹤修改、7 個未追蹤（其中 1 個為先前文件），staged 0。沒有 stage、commit、push、tag 或 PR 操作；只停止本輪自己的隔離服務，未停止使用者服務。

## 0.13.14 開啟故障與更新等待

### 操作及安全邊界

- 帳本開啟／初讀失敗只顯示固定指引，原設定檔與網站資料須保留；沒有清除、覆蓋或強行匯入入口。已有可用完整備份時，請在另一個全新空白瀏覽器設定檔、相同 `http://127.0.0.1:8768/local-first/` 還原，核對九類資料後再備份；沒有可用備份先停止與查明原因，不能因開啟失敗就斷言資料已遺失或可取回。
- 「目前使用頁面版本」取自已載入 HTML，不依目前磁碟、等待 worker 或網路重新推算。新版等待時，儲存或自行保留草稿再關閉此來源全部頁籤／視窗；單純看到「可離線重新開啟」不代表新版啟用。未完成安裝、失敗、離線或無法確認使用保守文字，不自動啟用／重新整理／關頁／清快取；第一次安裝不保證可離線。
- 僅在現有 HTML、頁面事件監聽與 worker 快取名稱做必要調整；不改帳本、九類 JSON v1、加密封裝、資料庫、Python Web／Bot、CSP、來源或依賴。測試控制頁／合成檔不進生產靜態白名單，也不進 SW 快取。

### 本輪實際合成驗證

- 初始狀態：`codex/localhost-web-auth`、HEAD `124507f129923144be7bfb1284cd0480991fc5de`、0.13.13，工作樹乾淨。先新增失敗測試，Node 7／7 失敗、原生開啟故障缺指引，再完成實作。
- Node 100／100（完整執行相關 local-first 測試，排除會使用固定 8768 的 `test_local_first_entry_server.mjs`）；完整 Python 隔離 453／453，額外 audit 拒絕專案正式檔案／憑證與非暫存 SQLite；Ruff、52 個 JS 語法、Chart.js／lossless-json 7 個既有資源與授權雜湊、差異檢查通過。沒有把先前回報列作本輪重新通過。
- 19060 嚴格 CSP 合成來源：持久保存 API／開啟或初次讀取失敗 11 情境；兩種故障都顯示有／沒有備份指引、隱藏操作區、停用建立及還原、沒有底層例外，失敗前後完整備份相同。原生帳本 11、儲存 7、九類互通 12、故障安全畫面 11、搜尋／月曆 11、加密備份畫面 10 組回歸通過；含舊 revision、雙連線、request 成功後 abort、還原空白條件、惡意文字只作文字與備份互通。
- 19062 原生 Service Worker：兩頁實際載入 0.13.14，保留未儲存草稿；測試服務 `--next-worker` 僅把快取／HTML 標籤模擬為 0.13.15（非發行版）。下載完整 14 資源後兩舊頁仍是 0.13.14、有獨立等待提示且草稿不變；只關一頁不啟用。停服並確認連線拒絕，關閉全部舊頁後自然啟用，同網址新開頁離線載入測試 0.13.15。九類原始列、metadata 與完整備份逐位元組相同。
- 19064：`--next-worker --no-charts` 故意拒絕 Chart.js，原生安裝失敗提示正確，新快取被移除而舊版完整保留；兩頁版本／草稿／帳本不變。停服並確認拒絕連線、關閉全部受控頁後同網址新開仍顯示 0.13.14，必要 14 資源白名單完整且沒有財務資料；獨立唯讀檢查頁持有基準，冷啟動後原始列、metadata、完整備份逐位元組不變。這是關閉來源頁後的冷啟動，未結束整個瀏覽器程序。
- Node 事件替身另涵蓋安裝中不能稱已下載、updatefound／statechange、註冊拒絕不洩漏底層例外、`navigator.onLine=false` 與 online/offline、controllerchange 不改已載入版本／草稿。不以停止本機 HTTP 服務代替整個電腦斷網測試；已知等待 worker 在離線時仍可準確標示完成下載。

### 重做驗收與未驗證事項

1. 用全新未使用的隔離測試埠（至少 19000，不能用既有 8767／8768），啟動 `node tests/local_first_preview.mjs <埠> --secure`。開啟 `/tests/local-first-persistence.html?case=database-unavailable` 及 `case=initial-read-failure`，確認 PASS、固定指引與無可寫入的故障復原入口；其他情境見測試檔。
2. 在另一全新測試埠開 `/tests/local_first_update_browser.html`，兩次明確開啟 A／B，再檢查舊頁與草稿；控制頁在 worker 範圍之外，以九類合成備份建立基準，拒絕非空來源。改服務為 `--secure --next-worker`，檢查等待；或 `--secure --next-worker --no-charts` 檢查安裝失敗。只操作由此測試建立的頁籤。
3. 停服、確認連線拒絕，成功路徑逐頁關閉、同網址離線冷啟動並核對。失敗路徑先在同來源開 `/tests/local_first_offline_settings_browser.html` 保留唯讀基準，再停服、關閉控制頁（會關閉其 A／B 頁），新開同網址 0.13.14，回唯讀檢查頁按「重新檢查更新後資源與帳本」。0.13.15 只是合成測試標籤；實際交付仍是 0.13.14。快取只能有已啟用版的 14 個靜態資源，帳本／備份基準不可改變。
4. 尚須使用者自行驗證：自己的瀏覽器版本／設定檔、結束整個瀏覽器程序再重開、真實故障下保留原設定檔，以及有可用備份時在全新空白設定檔核對復原。沒有備份先停止調查。本輪未重做下載落地或跨設定檔復原；先前加密檔落地、獨立空白設定檔還原／重開／再備份為「使用者手動驗證」。不宣稱正式帳本已搬移或完成安全認證。

本輪檔案：`local-first/index.html`、`page.mjs`、`sw.js`；`tests/test_local_first_update_status.mjs`、`local_first_update_browser.html`／`.mjs`、`local_first_persistence_browser.mjs`、`local_first_preview.mjs`、`local_first_offline_settings_browser.mjs`；README、CHANGELOG 與本文件。仍僅供合成資料，IndexedDB 未加密、備份密碼遺失無法取回、Python Web 尚未被取代；不 stage／commit／push／建立 PR。

## 0.13.13 Python Web 完整帳本搬移

### 後續使用者手動驗證與本機交付

- 使用者已親自完成合成資料的 Web 加密下載檔落地、獨立空白設定檔還原、關頁重開保留及再次備份。這是**使用者手動驗證**，並非本機 Git 整理回合重新執行；下面原實作回合的工具限制仍保留作歷史證據，不再表示此使用者演練尚待完成。正式帳本未搬移、未驗證。
- 本機交付回合重新驗證 Python 隔離 453／453、Node 101／101、Ruff、50 個 JavaScript 語法、授權資源 7 檔 SHA-256 與差異檢查通過。Node 名稱篩選未生效，包含純靜態固定埠測試，但沒有開啟、存取既有 8767／8768 瀏覽器帳本；另從提交快照直接排除整個固定入口測試檔，驗證不依賴未追蹤／忽略的執行資源。版本、SW、資料契約不變，不包含測試產物、帳本或憑證。

### 原實作回合的資料流與工具驗證

1. 重啟 Python Web，在「設定 → 資料匯出」選「完整帳本搬移（加密備份）」。身分僅取 OAuth session，POST 僅送 CSRF；不接受 caller 身分、密碼或選擇明文。既有 Service 匯出本人 JSON v1 九類資料，沒有 SQL 複製、帳務寫入或新的資料格式。
2. 瀏覽器輸入並確認至少 12 字、最多 1024 UTF-8 bytes 的密碼，重用既有純備份驗證與加密封裝。回應及串流均限制 64 MiB；只從白名單提供加密／驗證模組和原本 MIT lossless-json，沒有 CDN、IDB 寫入模組或 Service Worker。回應具 no-store、nosniff、no-referrer、DENY 及 CSP，不放寬 inline/eval。明文僅在傳輸與記憶體，不寫伺服器檔；失敗不下載明文，取消丟棄結果，成功只說已發出下載要求。
3. 使用者手動演練仍需完成：在合成 Python Web 帳本匯出，親自確認新 `.llbk` 檔落地；建立獨立空白瀏覽器設定檔，以 local-first 固定網址開頁，選「從備份還原」（不要先建立預設帳本），從該檔解密、檢查九類筆數並確認。關頁重開、停服離線重開，再下載完整加密備份並確認落地／再次空白還原；核對精確金額、歷史付款快照、撤銷、版本與操作順序。保留來源與備份，不清除原帳本。**工具本輪未取得下載事件或檔案路徑，也未建立獨立瀏覽器設定檔；Blob／同設定檔隔離來源測試不替代此演練。**

### 本輪實際合成驗證與限制

- 受正式檔案／非暫存 SQLite 防護的完整 Python 隔離 453／453（本輪新增 7 項）、相關 Node 93／93、Ruff、50 個 JavaScript 語法及差異檢查通過。未執行需要固定 8768 的入口測試檔；既有棄用／asyncio 提示未造成失敗。
- 新增 Python Web 隔離案例先因缺入口失敗，再實作；覆蓋未登入、CSRF、身分／密碼注入、不同合成使用者、空帳本、惡意請求大小／編碼、Service 失敗及精確容量邊界，匯出前後 SQLite 全表快照不變。Python 暫存還原再匯出逐位元組一致，沒有觸碰正式檔案。
- 隔離 Web 19040 的真實頁面與 CSP 下，6 組驗證確認密碼不合先拒絕、匯出／超容量／格式／加密故障不下載明文、重複提交與取消丟棄結果、POST 僅含 CSRF、Python Web 真實回應加密解密逐位元組一致。原生 IDB 錯密碼／竄改／request 成功後 abort 均維持空白，九類資料、BigInt、關聯、revision、撤銷與順序還原／關閉連線重開／再匯出一致；匯出未改 Python 帳本，惡意字串未成為可執行 DOM。這是記憶體互通，不是從落地檔還原。
- 19042 嚴格 CSP 回歸既有加密備份畫面 10 組及原生互通 12 組，包含舊 JSON、兩連線非空衝突、容量與交易中止回滾、XSS 文字及明文確認規則。另用該隔離來源建立可拋棄預設帳本，確認離線就緒，停服並確認連線失敗，關頁後同網址冷啟動及加密下載要求通過；這個離線帳本不是由 Web 落地檔還原的帳本。Python Web 匯出本身需要服務在線，沒有把 OAuth／明文回應加入離線快取。
- 獨立唯讀程式審查未發現阻擋問題。本輪未操作既有 8767／8768 帳本；保留固定來源、IndexedDB 名稱／v2、JSON v1 九類資料、原 CSV、Python 帳務與 Discord 指令。local-first 快取仍為 14 個允許資源的 `local-first-offline-0.13.12-v2`。
- 未驗證：下載檔實際落地及從該檔完整演練、獨立瀏覽器設定檔、真 OAuth、正式資料、其他瀏覽器／實體手機、真正磁碟／配額耗盡、完整封包或本機惡意程式抵抗。0.13.6 啟動器雙擊、加密檔落地及空白還原仍是**使用者先前手動驗證**，不等同本輪新增 Web 搬移的實測。IndexedDB 未加密，密碼遺失無法取回，備份密碼無法抵禦本機惡意程式、擴充套件或已解鎖電腦；Python Web 尚未被取代，不宜直接以正式帳本取代。

## 0.13.12 支出比較

1. 保持固定本機服務開啟，完整載入新版並關閉舊頁，確認離線就緒；SW 為 `local-first-offline-0.13.12-v2`，原 12 個資源加比較模組及原有 Chart.js，共 14 個。固定 8768、CSP、帳本名稱／IndexedDB v2、九類 JSON v1 與加密備份契約不變，不需 SQLite 升級。本輪不修改 Python 生產邏輯。
2. 開啟「支出比較」，A／B 預設台灣本月／上月完整範圍；共同分類及最多 200 個 Unicode 字的字面關鍵字採 AND。每次比較只取一次台灣今天、一筆唯讀交易，涵蓋所有已入帳、有效四來源消費，不限 50 筆、不補記。所選／實際範圍、未開始與零支出、B 為零及期間差異提示分別呈現。
3. 文字摘要、分類表與各日資料保留精確 cents、差額與 Python 捨入。每日折線非累積且按期間第幾天對齊，另有分類長條及直接顯示的兩期圓餅；不另畫總額圖。Chart.js 只收彙總，沒有外部請求或 CDN。超安全整數金額／實際日數超過 10000／載入失敗時降級文字；每日資料每批 500 天，零支出日期仍可完整逐批讀取，統計不截斷。

### 本輪實際合成驗證

- Node 101／101、受正式檔案與非暫存 SQLite 防護的完整 Python 隔離 446／446、Ruff、49 個 JavaScript 語法與 Chart.js 四檔官方 SHA-256／MIT 資源檢查通過。9 項純比較測試含跨年／閏年／半年、交疊／不等長、未結束／未開始、B 為零、AND、停用／歷史／單邊分類、四來源與撤銷／未入帳排除、65 筆、精確小數／大整數、Unicode 字數及空白、錯誤輸入、739891 天範圍稀疏彙總與按需日期。Python 兩項跨程式案例比對同一合成輸入的期間、所有每日 cents、分類、筆數、差額、百分比捨入，不將純 Node 計算冒稱 IndexedDB 驗證。
- 新 `/tests/local-first-comparison.html` 在嚴格 CSP 的隔離來源正常圖表及刻意 503 圖表來源各通過 11 組：原生 IndexedDB 唯讀、一次今天／交易、65 筆不裁切、歷史分類與 XSS 純文字、四圖與直接顯示圓餅、單分類 AND、兩期零資料、未來不計差額、大金額安全降級、極長範圍分批日期、查詢故障保留輸入／固定錯誤、無資料 query URL／外部資源。前後完整九類備份與原始列／metadata 逐位元組一致。首次測試缺入口與資源先失敗，再實作；稀疏日期與 Unicode 邊界另經失敗測試後修正。
- 桌面與 375px 原生 iframe 以鍵盤 Enter 提交 A／B、共同字面關鍵字；結果 65 筆／0.65 元、B 1 元、差額 −0.35 元、減少 35%，兩期圖表與文字一致。窄頁實際內容為 360px，`scrollWidth=clientWidth=360`；這是 375px 子頁面，不冒稱整個瀏覽器 viewport 或實體手機。合成惡意分類在表格及 canvas 標籤只作文字。
- 既有原生帳本 11、逐筆儲存 7、完整互通 12、固定交易 9／畫面 5、定期交易 8／畫面 5、設定交易 9／畫面 6、預算交易 8／畫面 4、搜尋／月曆畫面 11、故障安全畫面 11、加密備份畫面 10 組回歸通過；共用測試 DB 的案例依序跑完。新增查詢、重新整理及匯出沒有補記或任何寫入。
- 在隔離 18918 以測試選項先安裝前版 12 資源的原生 worker，建立原始列／metadata／完整備份基準；重啟測試服務提供新版 worker，關閉舊控制頁後自然更新為 `0.13.12-v2`。僅 14 個允許資源、前版快取已移除，三份帳本基準逐位元組一致。停止該服務並確認 `ECONNREFUSED`，關頁後從同一網址離線冷啟動，以鍵盤重新查詢，四個 canvas 尺寸與繪圖完成提示正常、精確結果一致；離線重新整理、每日 31 天完整文字及再次關頁重開通過，基準仍不變。這是合成來源的實際原生更新及停服驗證，不操作既有帳本。
- 本輪隔離來源使用 189xx；從未開啟現有 8767／8768 帳本。未讀寫正式 SQLite、憑證或使用者備份；測試用自行建立的合成帳本與暫存檔。0.13.6 啟動器可見雙擊、加密備份檔落地及從檔案空白還原仍是**使用者先前手動驗證**，並非本輪自動測試。
- 未驗證正式帳本、實體手機、其他瀏覽器、作業系統真正配額耗盡、完整網路封包稽核或本輪重新下載備份檔落地；查詢故障為隔離注入。IndexedDB 未加密，未加密備份可被讀取，持久保存／離線不保證資料不會遺失，Python Web 尚未被取代。

### 本輪檔案與 Git

- 程式（8）：`local-first/comparison.mjs`（新增）、`browse.mjs`、`rules.mjs`、`page.mjs`、`index.html`、`style.css`、`serve.mjs`、`sw.js`。Chart.js 原發行檔未修改。
- 測試（7）：`tests/test_local_first_comparison.mjs`、`test_browser_expense_comparison.py`、`local_first_comparison_ui_browser.mjs`（以上新增）；`test_local_first_entry_server.mjs`、`test_local_first_offline.mjs`、`local_first_offline_settings_browser.mjs`、`local_first_preview.mjs`。
- 文件（4）：`README.md`、`CHANGELOG.md`、`THIRD_PARTY_LICENSES.md`、本驗證文件。共 19 檔；進場既有 46 個未提交檔案均保留，未涉及的 32 檔 SHA-256 不變。分支仍 `codex/localhost-web-auth`、HEAD `8c62c78`；51 個 dirty path（23 個 tracked 修改、28 個 untracked），staged 清單空白，沒有提交／推送／PR 操作。Python 生產檔原有未提交修改未被本輪觸碰。

這是獨立靜態小頁面，驗證手動新增、查看四來源有效消費、更改、摘要確認後軟刪除、完整備份下載／空白還原與同來源持久化。不替換 Python Web；不需要登入 Discord，不呼叫 Python 記帳 API，不連接電腦 SQLite。現有 Web／Bot 指令及畫面、OAuth、啟動與 schema 保留；0.13.10 的 Python 相容修正只供完整備份還原後套用既有月份版本，不整合兩端帳本。

## 0.13.11 搜尋／月曆單筆操作

1. 在有效清單、搜尋結果或月曆每日明細選「更改」，共用原記帳表單。手動日期可變；固定／訂閱／分期日期唯讀並提示只影響該筆，核心也拒絕偽造移動。原 source、recurring_id、period 不接受表單覆寫，不改規則／版本／其他期數。未重選付款保留原 ID 及名稱快照；停用或沒有 override 的原分類可保留，不能拿停用／未知分類新增。
2. 「刪除」仍先顯示日期、項目、精確金額、分類、付款摘要，取消不寫入；確認後軟刪除及 before 紀錄在同一交易提交。重複操作、撤銷／不存在、舊 revision、容量及中途失敗安全拒絕，不留半筆資料；兩分頁不得無聲覆寫。已撤銷期別再次補記不重建，瀏覽、搜尋、切月與重新整理仍不補記。
3. 成功後從交易回傳的同一快照更新有效清單、搜尋、月曆及本月預算，保留查詢、查看月份和選取日期；原日期清空也顯示該日無消費。焦點回原結果，刪掉結果時回清單，便於鍵盤操作。更改沿用 Python 的項目 1～200 字規則：合法備份中空白或過長的原項目須修正後才能儲存更改，仍可摘要軟刪除。
4. 更新先在線上完整載入、關閉舊頁並確認離線就緒；SW 為 `local-first-offline-0.13.11-v1`，只保留原 12 個必要靜態資源。不新增表、依賴、帳務 API、帳號或備份格式，固定 8768／CSP／8767 隔離不變。本輪未修改 Python 生產帳務邏輯。

### 本輪實際合成驗證

- 純規則先失敗：自動來源可偽造日期、原無 override 分類無法保留；原生交易先失敗：manual-only；搜尋畫面先失敗：沒有操作入口。逐項最小修正後完整 Node 90／90（含固定埠與啟動器檢查）、額外正式檔案／非暫存 SQLite 稽核防護 Python 444／444、Ruff、45 個 JavaScript 語法及差異／新增檔空白檢查通過。未讀写正式帳本、憑證或使用者備份。
- 新 `local_first_expense_browser.html` 4 組矩陣包含四來源更改／刪除、精確 .37、原日期及來源／引用／期別偽造、停用付款歷史名稱、before／revision、已撤銷／不存在／重複操作、兩原生連線編輯與刪除競爭、actions.add 配額例外、expenses.put 成功後 abort 全回滾、100000 列、損壞資料原始列不變、完整九類往返、唯讀搜尋／月曆／預算與撤銷防復活。既有固定容量測試另對真實 64 MiB 合成帳本驗證單筆更改／刪除拒絕。
- `local-first-browse.html` 11 組在入口同一 CSP 的 18890 通過：搜尋／每日明細共用表單、手動日期、自動日期唯讀提示、跨月份選取保留、查詢保留、確認取消、四來源當月預算同步、原歷史分類與付款快照、舊 revision 保留輸入、惡意文字安全呈現及無外部資源／查詢網址。搜尋／切月前後完整備份不變，50 筆分批不裁切結果。
- 原帳本 11、逐筆儲存 7、完整互通 12、固定交易 9／畫面 5、定期交易 8／畫面 5、設定交易 9／畫面 6、預算交易 8／畫面 4、故障安全畫面 11、加密備份畫面 10、CSV 畫面 7 組回歸通過；會使用同一 portable-checks 的測試依序完成。Python 新增格式互通案例由瀏覽器同一驗證規則產生四來源更改／軟刪除後 JSON v1，再還原至測試自行建立的暫存 SQLite；日期、cents、分類、項目、來源、period、voided、付款名稱、kind、精確 revision 及 before 核對，後續補記不復活、Node 再匯出一致。原生 IndexedDB 操作另由瀏覽器交易矩陣證明，未冒稱 Node 執行了 IndexedDB。
- 桌面鍵盤從搜尋更改訂閱，搜尋／每日明細／預算同步 .37，回到原更改按鈕；實際另一分頁提交 .53 被拒且輸入保留。摘要 Escape 取消再確認刪除，原選取日期保留、有效結果與預算同步歸零、補記不重建；重新整理保留結果。18892 的原生 375px iframe（內容 360px）鍵盤搜尋、更改 .41、確認軟刪除；`scrollWidth=clientWidth=360`，不是整體瀏覽器 viewport 或實體手機。
- 另將原生交易頁四來源更改／刪除後的實際 `exportPortableBackup()` 內容擷取至本輪自行建立的合成暫存檔（不輸出資料至日誌），由同一正式檔案／非暫存 SQLite 稽核防護還原。完整九類資料、before、操作順序及引用按 ID 正規化逐項一致；四筆均 37 cents、revision 2、voided 1。當期補記為 0，下期三筆仍各按原規則 29 cents，不更動原四筆；此驗證包含原生寫入後的實際匯出，但不代表瀏覽器下載檔已落地。
- 18890 自然更新 SW 0.13.10-v1 → 0.13.11-v1：保留檢查頁原始快照，載入新版並關閉舊頁，僅 12 個允許資源、舊快取移除；期間原始列、metadata 及完整備份逐位元組一致。停止服務並核對 ECONNREFUSED，再新開同網址離線冷啟動；從搜尋更改分期單筆 .41、預算與日期同步，關頁重開仍保留；離線月曆軟刪除、補記不復活，再冷啟動仍無有效消費。所有本輪測試分頁與服務完成後關閉，未開啟既有 8767／8768 帳本。
- 未驗證：正式帳本、真 OAuth、其他瀏覽器／實體手機、真實配額或裝置損壞、完整封包與本輪下載檔落地。0.13.6 雙擊啟動器可見視窗、加密檔落地及空白還原為**使用者先前手動驗證**，不列入本輪自動測試。仍僅供合成資料；IndexedDB 未加密，未加密備份可直接讀取，Python Web 未被取代，備份密碼不防本機惡意程式／擴充套件／已解鎖電腦。未 stage、commit、push 或更新 PR。

## 0.13.10 訂閱與分期更改

1. 在「固定支出／訂閱／分期」選啟用項目的「更改」，僅訂閱／分期的金額及分類可編輯；名稱、扣款日、開始月份、類型及總期數維持原值，核心拒絕偽造值與外傳生效月份。新金額沿用正數、十億元、最多兩位小數的精確 cents；原停用分類可保留，其他停用分類不能新選。已停用及已完成分期不能更改；只有使用者補記或確認停用會入帳。
2. 更改於寫入交易重新取台灣今天，下月生效，同月重複更改以最後成功版本為準。規則原始值、本月及歷史版本、已入帳／撤銷消費不回寫。開始下月的規則仍維持原開始月份及期數，首期取該月版本；短月日期取月底。查看及重新整理不寫入，畫面分列目前與下月設定，已完成／停用的未來版本註明不再執行。
3. 使用者同意 JSON v1 驗證契約最小擴充：recurring_versions 可引用三類規則，欄位及九類資料不變；訂閱／分期版本 name 必須等於規則 name，due_day 必須等於規則 due_day（原 null 以版本 1 表示），金額及分類可依月份不同。原 null、大期數、長名稱及歷史保留；同規則／月份版本唯一，生效不能早於開始。**舊備份仍接受，新訂閱／分期版本備份需 0.13.10 或更新的相容程式；舊版驗證會拒絕。** 加密解封後仍走同一 JSON v1 驗證，不新增格式版本、資料表或套件。
4. Python 補記／停用依每期應扣款月份選有效版本，保留唯一性及已撤銷防重建；當月規則查詢同步金額／分類，原 nonfixed 回傳欄位、name、due_day=null 及固定 _fixed_view 契約不變，不新增 Discord 更改。`fixed_burdens()` 既有剩餘排定金額以當月單價估算，不包含未來月份版本預測；本輪不新增預測流程。

### 本輪實際合成驗證

- 新增 6 項純核心測試先失敗，再與原固定 8 項驗證；完整 Node 最後 88／88，沒有排除本輪固定埠／CLI／啟動器測試。受正式檔案 open 與非暫存 SQLite 稽核防護的完整 Python 443／443，新增 3 個格式／跨端／版本補記案例，另補摘要讀取先失敗的回歸。Ruff、44 個 JavaScript 語法與差異／空白檢查通過，只有既有 Python 棄用／asyncio 提示。
- Node 合成新增並跨年更改三類、同月覆寫、保留已撤銷後匯出，還原至 Python 測試自行建立的暫存 SQLite；延遲補記按 2027-12、2028-01、2028-02 各期選 29、41、53 cents 與對應分類，閏月扣款 29 日。原已入帳列完全不變、重複補記為 0、再匯出至 Node 保留九類。Python 會重新配置識別碼，還原前後核對正規化識別碼及完整引用關係，不把 ID 重建當成資料遺失。
- 原生 `local_first_recurring_browser.html` 8 組及 `local-first-recurring.html` 畫面 5 組：兩類新增／更改／補記／停用的第二筆寫入例外及 request success 後 abort 全回滾；兩連線同 revision 更改只有一個成功，舊輸入拒絕；同月覆寫一個版本；跨台灣午夜及跨年排隊寫入取交易內月份；100000 列不能留下半版本；原 null、大期數、撤銷末期及搜尋／月曆／預算唯讀一致；完整九類往返包含新版本、零元及歷史月份／before／操作順序。
- 原固定原生 9／畫面 5（含 64 MiB 拒絕訂閱版本寫入、損壞及精確邊界）、分類／付款設定 9／6、預算 8／4、完整互通 12、帳本 11、儲存 7、故障安全畫面 11、加密 10 及 CSV 7 組通過。共用 portable-checks 的舊原生測試頁改依序重跑；CSV 驗收拒絕覆寫既有合成來源後改使用全新 18884 空白來源，沒有清空使用者帳本。
- 18880 隔離來源 `--secure` 使用 8768 同一 CSP；桌面鍵盤新增／更改下月首期分期及訂閱，原設定與 pending 分開，5 個不可更改欄位停用。兩個實際分頁爭用同一訂閱，舊頁收到重新載入訊息並保留 `.53`。重新整理仍保留原設定與下月版、不補記。18882 的原生 375px iframe（扣捲軸內容 360px）鍵盤新增分期及更改，`scrollWidth=clientWidth=360`；不是實體手機或整體瀏覽器 viewport 測試。
- `local_first_offline_settings_browser.html` 先在舊快取核對新版尚未啟用，再保持原始快照、在線上載入與關閉舊驗收頁，SW 自然更新至 `local-first-offline-0.13.10-v1`、舊快取移除。必要 12 項靜態資源含實際新更改／驗證邏輯；原始資料列、metadata 與完整備份逐位元組不變，不含帳目、密碼、備份、測試頁或第三方資源。未放寬 CSP。
- 停止本輪 18880 服務，實際 TCP `ECONNREFUSED` 後關頁新開同網址冷啟動，兩類的 current／pending 仍在，消費仍 0 元；離線更改訂閱至 43 cents、分期至 997 cents，再關頁重開保留新下月版與原值，不暗中補記。18880／18882／18884 本輪服務均已停止；未開啟既有 8767／8768 帳本、未觸及正式資料／憑證／備份。

**未驗證及限制**：正式帳本、真 OAuth、其他瀏覽器／實體手機、真實配額耗盡／裝置損壞、完整封包、本輪下載檔落地。0.13.6 啟動器雙擊可見視窗、加密檔落地及空白還原仍為「使用者先前手動驗證」，不是本輪自動結果。本輪瀏覽器自動審核曾因用量限制暫停，使用者要求繼續後原工具恢復並完成餘下驗收，沒有換工具繞過。**僅供合成資料測試；IndexedDB 未加密，未加密備份可被讀取，Python Web 尚未被取代。** 備份密碼不能抵禦本機惡意程式、擴充套件或已解鎖電腦。

## 0.13.9 訂閱與分期第一版

1. 展開「固定支出／訂閱／分期」，選類型再新增；只有分期顯示 1～600 總期數。名稱最多 100 字、金額沿用正數十億元及兩位小數精確 cents，分類須有效、開始限交易當下台灣本月／下月且建立後不變，扣款日 1～31、短月取月底。匯入空白日維持每月 1 日、大期數不裁切。固定仍可下月生效更改；訂閱／分期不提供更改或額外版本。
2. 新增及瀏覽不補記；只有補記按鈕處理三類啟用規則，不產生預測。分期從開始月份算第一期，最後一期入帳後「已完成」、無停用／後續入帳。已撤銷期數仍算入帳、不重建；完成不改 active 或新增欄位。停用先確認，再於同一交易補齊該規則截至今天的缺漏、更新 revision／停用；失敗全回滾，保留輸入。這是記帳，不代表銀行扣款。
3. 純規則 9 項先失敗再實作；原生 `local_first_recurring_browser.html` 6 組、`local-first-recurring.html` 畫面 4 組通過：兩連線重複補記及同 revision 停用一個成功；兩類新增／補記／停用的第二筆例外、request 成功後 abort 逐位元組回滾；100000 列不能半筆、完整邊界可寫。原固定原生 9／畫面 5 組仍通過，含 64 MiB、損壞、跨台灣午夜、下月生效更改及停用歷史。
4. 九類歷史零元／所有月份／大期數／操作 before 與順序經匯出 → 空白 IndexedDB 還原 → 再匯出逐位元組核對。已補記搜尋、月曆及預算相同精確結果，唯讀不變。新增 Python 互通測試實際將瀏覽器新增三類／補記後 JSON v1 還原暫存 SQLite，再由 Python 補記末期及重複補記、回到 Node；不改 Python 邏輯。既有帳本 11、儲存 7、互通 12、設定 9、預算 8、故障安全畫面 11、加密 10、CSV 7 組與保存狀態（獲准／IndexedDB 不可用）2 情境回歸通過。
5. `127.0.0.1:18870` 新隔離來源預覽加 `--secure` 套用 8768 同一 CSP；18872 用於舊測試頁及 375px iframe。未開啟 8767／8768 既有帳本。桌面鍵盤新增三類、補記 3 筆共 13.63 元，分期完成無操作，兩個實際分頁舊停用確認要求重新載入。375px iframe（扣捲軸內容寬 360px）欄位／列表無水平溢出，可鍵盤新增下月分期；工具 viewport 覆寫未生效，不宣稱整體瀏覽器 375px 或實體手機通過。
6. SW 原生更新至 `local-first-offline-0.13.9-v1`；關閉隔離來源所有舊驗證分頁後舊快取移除，僅 12 個必要本機資源，無帳目／密碼／備份／測試頁／第三方資源。唯讀查核原始列／metadata／備份不變。停止 18870 並確認拒絕連線，關頁新開同網址保留完成／停用與 13.63 元，重複補記無新筆；離線新增下月訂閱後再關頁重開仍保留且不補記。
7. Node 可執行 81／81；完整集合另 1 項 CLI／Windows 測試先因既有 8768 占用失敗，未停非本輪程序，再以 `--test-skip-pattern='CLI refuses occupied fixed port'` 明確排除後重跑其餘，不稱全 82 項通過。額外正式檔案開啟／非暫存 SQLite 防護跑完整既有 Python runner 440／440；防護只允許測試自己的暫存 .env／Token／SQLite，初次防護器誤擋 URI／Path 修正後全量重跑。Ruff、44 個 JavaScript 語法、CRLF 相容差異／新增檔空白檢查通過，未 stage／commit／push／更新 PR。

**已驗證限制**：合法匯入分期名稱接近 4096 字時，加上既定期數可能超過備份 note 上限；整批補記或該規則停用明確拒絕、原資料不變，不截斷或另改格式，也不新增本輪禁止的更改入口。新建最多 100 字不受此邊界影響。

**未驗證**：CLI 完整占埠／重啟測試、其他瀏覽器／實體手機、真實配額耗盡／裝置損壞、完整封包、正式帳本及真 OAuth。先前啟動器雙擊、加密備份落地／空白還原仍為「使用者手動驗證」，非本輪結果。**僅供合成資料測試；IndexedDB 未加密，未加密備份可被讀取，Python Web 尚未被取代。** 備份密碼不能抵禦本機惡意程式、擴充套件或已解鎖電腦。

## 0.13.8 CSV 支出匯出

在既有「資料管理」展開「CSV 支出匯出」，選擇起訖日期後下載；沒有重排頁面。預設台灣本月第一天至今天，日期須實際存在、格式嚴格、開始不晚於結束，兩端均包含。與搜尋的未來日期限制不同，CSV 可選未來結束日，但有效消費選取仍排除台灣今天之後的帳目；不改搜尋規則。無效輸入保留、不讀帳本；無符合帳目正常提示、不產生空檔；讀取失敗只顯示固定安全訊息、保留日期。

### 資料與安全契約

- 從已驗證為本機帳本擁有者的同一完整唯讀快照產生，不接受外部 user_id。重用搜尋／月曆的有效生活消費選取：`kind=consumption`、未撤銷、四個合法來源、截至今天；沒有未來預測、收入、投資、轉帳或其他使用者資料。完整結果不受畫面每批 50 筆限制，不遍歷月份另做統計。
- 欄位依序為日期、金額、消費項目、分類、付款方式；使用歷史付款名稱快照，日期降序、同日既有本機 ID 字串降序。這與 Python Web 的日期／ID 降序方向一致，但各自 ID 型別不同，不宣稱兩端能以同一筆本機 ID 數值排序。cents 全程 BigInt；整數無小數、真實小數才顯示，沒有千分位／元，不使用浮點或四捨五入。
- UTF-8 BOM、CRLF；逗號／引號／換行欄位用標準 CSV 包裹與雙引號加倍。所有可控文字欄位掃描前導空白和 Unicode 控制／格式字元；第一個有效字元為 `= + - @` 或前導有控制／格式字元時，在匯出副本加單引號。普通引號開頭是字面文字，仍正確跳脫；不只靠 CSV 引號阻擋公式。原始資料不改，其他工具再次匯入可能保留單引號；本頁不支援 CSV 匯入，不應自動移除防護前綴後交給試算表計算。金額不加文字前綴。
- **CSV 未加密、不是完整備份、不能用來還原帳本。**僅適合分析；真正復原仍使用完整 JSON／加密備份。下載檔名固定 `discordbot-expenses.csv`，成功只稱「已要求瀏覽器下載」；必須自行確認檔案存在及妥善保管。
- 開頁與 CSV 匯出不建立預設資料、不補記固定支出、不改 revision 或 metadata，不傳帳目至伺服器／第三方，不寫入 URL／log／Service Worker／前端靜態檔。記憶體產生 Blob，沿用既有完整帳本容量，不額外截斷；完整 JSON v1、加密格式、IndexedDB v2、Python Web／Discord／SQLite schema 及依賴不變。

### 可重跑步驟與實際結果

1. `node --test tests/test_local_first*.mjs`：73／73（CSV 新增 8 項）；先看到缺少 CSV 模組／資源而失敗，再實作通過。包含跨月閏年、空結果、四來源、撤銷／未來／非消費排除、65 筆完整排序、歷史付款快照、1 cent／大整數、BOM、公式／Unicode 控制字元／引號逗號換行及無效日期先拒絕再查詢。既有備份、固定支出、搜尋月曆、原子交易與離線／固定入口回歸保留。
2. 以**未使用的新隔離來源**執行 `node tests/local_first_preview.mjs 18906 --secure`，開啟 `http://127.0.0.1:18906/tests/local-first-csv.html`。fixture 只在空白來源建立專案合成資料，發現既存帳本即拒絕，不覆蓋。原生 IndexedDB／真正 page.mjs：7 組通過，含有效匯出、無效日期零讀取、無資料不下載、讀取失敗保留草稿、固定安全錯誤、Blob 精確內容／類型與 XSS 保護。比較九類原始 key／position／value、metadata 及完整 JSON bytes 前後一致。
3. 本輪實際使用新來源 `127.0.0.1:18904`，開啟產品 `/local-first/` 並點擊真正下載按鈕（此頁未攔截 anchor）；顯示「已要求瀏覽器下載」。375px 下 CSV 日期改為單欄、scrollWidth 360px 等於可用寬，沒有橫向溢出。瀏覽器下載事件逾時，未取得落地檔路徑；**未確認磁碟檔案存在／內容，不稱實際落地通過**。fixture 捕捉的 Blob bytes 只驗證產生契約，不能取代落地檔檢查。
4. `/tests/local_first_offline_settings_browser.html` 核對 `local-first-offline-0.13.8-v1` 12 個必要資源（含 csv.mjs）、不存在測試／帳目／CSV／查詢字串快取，以及原始資料列／metadata／完整備份不變。停止 18904 服務並確認無監聽後，關閉產品頁、相同網址另開新分頁：冷啟動與 CSV 匯出要求正常；再次按「重新檢查更新後資源與帳本」仍 PASS。產品頁無 error／warn。這驗證停止本機服務後可用，不代表實體手機／所有瀏覽器政策或完整封包驗證。
5. 額外正式檔案存取防護啟動器執行 `.venv\Scripts\python.exe tests/run_discord_validation.py` 同一 runner：439／439；拒絕正式資料／Token／.env 開檔及非暫存 SQLite，Web 真實 .env 載入被替換，測試自己的暫存設定不受影響。`.venv\Scripts\ruff.exe check .`、41 個本機／測試／vendor JavaScript 語法、差異／新增檔空白檢查通過。Python 只有既有棄用／asyncio 提示；不以隔離測試宣稱正式帳本或真 OAuth 通過。

### 更新及未驗證項目

在線上完整載入、關閉舊頁並確認離線就緒後使用新版；快取為 `local-first-offline-0.13.8-v1`，不需要 SQLite 初始化／搬移、套件或備份格式升級。沒有讀取既有 8767／8768 帳本、正式 data.db、Token、.env、備份、匯出檔或使用者資料；未 stage／commit／push 或更新 PR。

**未驗證**：下載檔落地及其磁碟內容、Excel／其他試算表的實際相容性、其他瀏覽器、實體手機、正式帳本／備份、真 OAuth、真實配額／磁碟損壞與完整封包。**僅供合成資料測試；IndexedDB 未加密，Python Web 尚未被取代。**CSV 防護不代表任意第三方工具重新處理文字後仍安全。

## 0.13.7 本機資料保存狀態與故障驗收

本輪只補可靠性，不重排介面、不改 CSS、動畫或帳務資料定義。「資料管理」新增本來源的原生持久保存查詢／申請，帳本仍不需帳號或解鎖，IndexedDB 未加密。`persisted()` 只讀狀態；`persist()` 僅明確按鈕操作，一次開頁最多一次，已獲准／查詢中／查詢失敗／不支援時不反覆申請。未獲准仍可使用帳本；獲准仍可能因清除瀏覽器、裝置故障等遺失。API 規則見 [Storage Standard](https://storage.spec.whatwg.org/#dom-storagemanager-persist)。

### 可重跑步驟與實際結果

1. 使用新隔離來源執行 `node tests/local_first_preview.mjs 18864 --secure`，開啟 `/tests/local-first-persistence.html?case=...`：`granted`、`denied`、`approve`、`unsupported`、`query-only`、`query-failure`、`request-failure`、`pending`、`request-pending` 與 `database-unavailable`。原生 IndexedDB 與真正頁面照常執行，只在 fixture 模擬 API 回應／不可開啟；每例確認不自動申請、安全錯誤、單次明確操作及完整帳本 bytes 不變。缺提示時先失敗，再實作；10 情境通過。
2. `/tests/local-first-ui.html` 共 11 組：無效輸入、request success 後 abort、配額例外、未知錯誤、惡意文字無 DOM／URL 執行、取消與軟刪、無法建立交易、重複提交、另一連線舊 revision、交易完成後畫面故障。真正失敗保留草稿且資料不變；提交後如實顯示已儲存、封鎖寫入至重新載入而可開啟備份。另用 `?case=settings-dialog` 與 `?case=fixed-dialog` 各跑同樣 11 組，重現關閉 modal 前的故障，再修正為關閉阻擋備份的確認窗。這三條在嚴格 CSP 下通過。`/tests/local-first-entry.html?case=start-ui-failure` 6 組在隔離預覽通過；首次建立也沿用共用提交處理。
3. 原生／畫面回歸：帳本 11、儲存升級 7、設定 9／6、預算 8／4、固定支出 9／5、搜尋月曆 8、JSON 互通 12、嚴格 CSP 加密 UI 10、首次入口 start／restore／failure 5／7／9 組全通過。包含精確 100000 列／64 MiB 容量邊界、損壞資料、兩連線競爭、舊 revision、請求成功後交易中止、所有月份／零元／歷史引用與九類備份逐位元組往返；沒有新增表或改動格式。現有固定入口安全服務 7 項與 SW 安裝／更新 4 項回歸通過。
4. 實際產品頁使用本輪新 `127.0.0.1:18860` 合成來源及與固定入口相同的 CSP。桌面 1280px／375px（scrollWidth 分別 1265／360）沒有水平溢出。Enter 申請一次，實際瀏覽器回傳未獲准，如實提示且不重複要求。兩個真正分頁先讀相同 revision，一頁成功改為 0.38 元、另一頁的 0.39 元更改拒絕且草稿保留；重新整理／關頁後只有成功值。
5. 先讓隔離頁載入 0.13.6-v2 worker，將新快取檢查寫成會失敗的測試，再升級 worker。原生 0.13.6 → 0.13.7 及最後 v2 更新完成；`/tests/local_first_offline_settings_browser.html` 使用外部 module 以遵守 CSP，核對全部 11 必要靜態資源、無測試路由／備份／帳目內容／查詢字串快取、舊版本清除與更新前後帳本 bytes 一致。先停服並確認 18860 CLOSED，再關閉產品頁，相同網址新分頁冷啟動保留 0.38 元、保存狀態、離線就緒及預設加密備份面板。未呼叫背景補記，未開啟原 8767 或既有 8768 帳本。
6. `node --test tests/test_local_first*.mjs` 65／65；`.venv\Scripts\python.exe tests/run_discord_validation.py` 正式檔案防護隔離 439／439；`.venv\Scripts\ruff.exe check .`、37 個本機／測試／vendor JavaScript 語法、`git -c core.whitespace=cr-at-eol diff --check` 通過。Python 只有既有 httpx 棄用／asyncio 提示。未 stage、commit、push 或更新 PR。

### 備份與保存狀態的界線

- 「本機帳本」指這個瀏覽器來源內的 IndexedDB；持久保存權限不加密帳本，也不是備份。
- 「已發出下載要求」只表示瀏覽器收到下載操作，程式不能證明檔案已保存。仍須使用者確認檔案存在，保存密碼，並以空白合成帳本檢查還原；本頁不自動寫指定資料夾，不記錄已保存旗標或自動備份。
- **使用者手動驗證（先前 0.13.6）**：使用者親自在個人電腦確認啟動器雙擊出現可見視窗、加密下載檔確實落地、能從該檔還原空白瀏覽器帳本。本輪只記錄此回報，不列入自動測試，也沒有把這三項重做當作前置門檻；下方歷史 0.13.6 的「未驗證」為當時工具限制紀錄。

### Windows 由使用者自行檢查

1. 由使用者自己開啟 Windows「設定」，搜尋「裝置加密」或「管理 BitLocker」，檢查目前狀態；若選項不存在，不代表已加密，依裝置與 Windows 版本查看 [Microsoft 裝置加密說明](https://support.microsoft.com/zh-tw/windows/security/encryption/device-encryption-in-windows)。本輪不代為查詢狀態或切換開關。
2. 由使用者自己確認復原金鑰的保管位置及在裝置無法開機時仍能取得；參考 [Microsoft 復原金鑰說明](https://support.microsoft.com/zh-tw/windows/security/encryption/find-your-bitlocker-recovery-key)。**不要將金鑰貼到聊天、此頁、專案、截圖或日誌；程式不讀取、顯示、記錄或上傳任何復原金鑰。**本輪不代為備份或上傳金鑰。
3. 裝置／磁碟加密是作業系統層級保護，**不是 IndexedDB 應用程式加密**，也不能防止已解鎖電腦、本機惡意程式或擴充套件讀取帳本。加密備份與其密碼是另一個獨立保護；忘記密碼無法取回，仍需手動保管備份。

### 本輪修改與未驗證範圍

本輪修改：`README.md`、`CHANGELOG.md`、本文件、`local-first/index.html`、`page.mjs`、`sw.js`、`tests/local_first_ui_browser.mjs`、`local_first_entry_browser.mjs`、`local_first_offline_settings_browser.html`、`local_first_preview.mjs`；新增 `tests/local_first_persistence_browser.mjs` 與 `local_first_offline_settings_browser.mjs`。起點為 `codex/localhost-web-auth`／`8c62c78`，實際版本 0.13.6，原有 26 個未提交路徑完整保留；本輪不改帳務核心、規則、CSS、CSP／固定服務、啟動器、加密格式或依賴。完成時工作樹共 29 個未提交路徑（14 個已追蹤修改、15 個未追蹤），無 staged 變更。

**未驗證**：真實配額／磁碟滿、斷電與磁碟損毀、Windows 裝置加密狀態／復原金鑰、其他瀏覽器政策、實體手機、螢幕閱讀器與完整封包。故障注入／合成帳本不是正式資料或硬體故障驗證。本輪未重做使用者先前下載落地、實際檔案還原、Explorer 雙擊手測。**僅供合成資料測試，請勿輸入真實帳目；IndexedDB 未加密，不加密 JSON 備份仍可被讀取，Python Web 尚未被取代。**持久保存及備份密碼不能抵禦本機惡意程式、擴充套件或已解鎖電腦。

## 0.13.6 可選密碼完整備份與還原

- 每次「下載完整備份」開啟原生頁內表單，預設加密、不記住不加密選擇。加密須輸入與確認密碼，不加密須勾選風險。取消／完成／切換方式清空密碼；錯誤保留輸入。開頁與匯出唯讀，沒有自動寫檔，提醒自行確認檔案存在。帳本仍不需登入或解鎖，IndexedDB 未加密；忘記備份密碼不能取回。
- 加密封裝 v1、PBKDF2-HMAC-SHA-256 600000、salt 16 bytes、AES-256-GCM／IV 12 bytes／tag 16 bytes，完整 47-byte header 為 AAD。每次新隨機參數；檔案大小／版本／精確固定參數／長度於 KDF 前限制。明文沿用 64 MiB／100000 列，封裝最多 67108927 bytes。完整規範及未來 App 相容策略見[加密格式](local-first-encrypted-backup-format.md)，內部 JSON v1 九類契約完全不變。
- 加密檔輸入密碼、解密並經既有完整驗證後顯示九類筆數，再確認空白帳本還原；交易內重新檢查空白，兩分頁／重複還原拒絕，中途 throw／request success 後 abort 全部回滾。舊 JSON 路徑及精確 cents／BigInt／歷史月份／零元／引用／操作順序不變。取消導出／解密中的 KDF 丟棄結果，計算完成前不能重新提交；建立空白帳本亦清除候選檔與密碼。
- 先補失敗測試後實作：核心缺少模組、畫面缺少密碼流程、服務白名單及 SW 缺加密模組皆先失敗；審查再補合法開頭 U+FEFF 密碼與建立帳本隱藏密碼未清空的失敗測試，已修正。Node 65／65（加密核心 8）、受正式檔案防護 Python 隔離 439／439、Ruff、36 個 JavaScript／離線 inline module 語法及差異檢查通過。Python 只有既有 httpx 棄用／asyncio 提示。
- 嚴格 CSP 的新隔離來源 `127.0.0.1:18846` 通過 10 組原生密碼畫面驗證：錯密碼／密文竄改／超大檔案、舊 JSON、取消、九類摘要、錯誤保留輸入、密碼清理、兩連線競態、quota／abort、XSS、預設加密與兩次隨機密文、明確不加密確認及全程唯讀。測試 fixture 捕捉 Blob 只用於 bytes 契約，不冒充落地檔。另一隔離來源 18848 回歸：帳本 11、儲存 7、分類付款交易／畫面 9／6、預算 8／4、固定 9／5、安全畫面 7、搜尋月曆 8、互通 12、首次入口 5／7／9 組通過。容量驗證包含 100000 列及精確 64 MiB 邊界。
- 實際產品頁用專案合成 JSON 檔還原，桌面 1280px／實際 375px（scrollWidth 360px）檢查密碼面板、Enter 不一致錯誤、預設與風險提示，惡意項目／分類保持文字，無 CSP 錯誤。關頁／重新整理持久化；停止服務並確認 18846 CLOSED，關閉頁面後相同網址冷啟動，離線仍可產生加密備份並發出下載要求。固定 8768 的 7 項安全服務回歸含新模組及原生 CMD 占埠錯誤等待按鍵；本輪沒有開啟／讀寫 8767 或既有 8768 主帳本，沒有清除／搬移它們。
- 服務僅多一個必要靜態模組（白名單共 12 路徑），固定 Host／GET／CSP 不變；SW 更新 `local-first-offline-0.13.6-v2`，加入加密模組。預覽工具的 `--secure` 只供新隔離 CSP 測試，固定服務沒有換埠選項／測試路由。IndexedDB v2、JSON v1、Python Web／Bot／SQLite／依賴不變。沒有讀寫正式 data.db、.env、Token、既有使用者備份；未 stage／commit／push／更新 PR。
- **未驗證**：實際瀏覽器下載事件逾時，工具未給出落地路徑，因此「下載檔確實存在，再從該檔還原」仍未驗證，不能用 Blob／記憶體往返取代。原生電腦 UI API 不可用，Explorer 雙擊可見視窗亦未驗證。其他瀏覽器／實體手機、螢幕閱讀器、真實配額耗盡、跨裝置 App 互通及正式帳本未驗證。密碼／金鑰不持久化，但 JavaScript 字串／CryptoKey 記憶體不能保證即時清除；加密備份不能抵禦本機惡意程式、擴充套件或已解鎖電腦。**僅供合成資料測試，請勿輸入真實帳目；未加密備份仍可被讀取，Python Web 尚未被取代。**

本輪修改／新增檔案（其餘先前修改保留）：

- 程式：`local-first/backup-crypto.mjs`、`index.html`、`page.mjs`、`style.css`、`sw.js`、`serve.mjs`。
- 測試：`tests/test_local_first_backup_crypto.mjs`、`local_first_crypto_ui_browser.mjs`、`local_first_entry_browser.mjs`、`local_first_offline_settings_browser.html`、`local_first_preview.mjs`、`test_local_first_offline.mjs`、`test_local_first_entry_server.mjs`。
- 文件：根目錄 `README.md`、`CHANGELOG.md`、本文件與 `docs/local-first-encrypted-backup-format.md`。

最後窄版補出「不加密模式仍顯示密碼欄」失敗測試，修正該區 `[hidden]` CSS；10 組嚴格 CSP 測試重跑通過，實際 375px 密碼欄隱藏、scrollWidth 360px。最終 v2 快取原生核對完整；再次停服冷啟動、離線加密與 Enter 均通過。Git 為 `codex/localhost-web-auth`、HEAD `8c62c78`，13 個 tracked 修改／13 個 untracked，index 無 staged 差異；9 個無關既有修改檔案 SHA-256 與本輪起點完全相同，包含固定支出邏輯／測試、規則、Windows 啟動器及舊來源唯讀比對。

重跑密碼畫面：另選全新合成來源，例如 `node tests/local_first_preview.mjs 18850 --secure`，開啟 `http://127.0.0.1:18850/tests/local-first-crypto.html`，結果應為 10 組 PASS；測試只使用自己命名的隨機 DB，不作為產品入口。固定服務仍只能使用 8768。實際落地驗收須手動確認下載檔存在，在另一個完全空白的隔離合成來源選取該檔、輸入密碼、核對九類並確認還原，再匯出核對；勿拿正式帳目或既有使用者備份試驗。

## 0.13.5 固定本機入口與合成來源隔離

- Windows 雙擊根目錄 `start_local_first.local.cmd`，或執行 `node local-first/serve.mjs`；固定網址 <http://127.0.0.1:8768/local-first/>，僅監聽 127.0.0.1。既有 Node／Codex bundled runtime 可直接使用，沒有套件或建置步驟。占埠、找不到 runtime 或啟動失敗會報錯，啟動器等待按鍵，不換埠、不顯示假的新帳本。成功後保持視窗開啟，Ctrl+C 停服。
- 固定服務只接受精確 `Host: 127.0.0.1:8768`、GET、11 個白名單原始路徑；拒絕查詢、方法／Host／GET body、編碼／穿越／絕對路徑及其他檔案。無目錄列表、測試路由、API、上傳、帳務寫入、請求日誌或錯誤輸入反射。全部模組與 vendor 本機載入；CSP 限 self script/style/connect/worker，其他 default none、base/object/frame/form 禁止，搭配 nosniff、no-referrer、DENY、same-origin、no-store 與權限限制，未使用 unsafe-inline/eval/CDN。
- 舊 `127.0.0.1:8767` 預覽仍可用原指令，且測試頁只由它提供；不同埠是不同來源，同名合成 IndexedDB／SW scope／CacheStorage 各自隔離。本輪沒有更名、清除、搬移或覆蓋 8767。九類 JSON v1、IndexedDB v2、Python Web／Bot／SQLite／依賴不變；既有 0.13.4 固定支出程式與測試完整保留。本輪沒有改快取資源，`local-first-offline-0.13.4-v2` 不變；8768 首次安裝自己的完整靜態快取。
- 重跑服務測試：先停止 8768 服務，再執行 `node --test tests/test_local_first_entry_server.mjs`，它會短暫占用／釋放固定 8768；不會終止其他占用程式。7 項測試先缺少入口失敗，再實作通過。全 Node 57／57；Windows CMD 原生子程序驗證占埠錯誤等待按鍵後退出 1；受正式檔案防護 Python 隔離 439／439、Ruff、33 個 JS 與離線 inline module 語法及差異通過。既有 httpx 棄用／asyncio 提示未改套件。
- 8767 舊來源唯讀驗證：啟動原預覽，開啟 `/tests/local_first_origin_browser.html` 建立基準，不建立／升級主帳本；新 8768 操作後按「重新比對」。本輪原主合成帳本及全部原始列／metadata、資料庫清單、8 個既有靜態快取回應（含 bytes／headers）與 SW 註冊的 SHA-256 前後同為 `bfb2ada81359d59271dfa76e2a54cac5e7abc28acd6816529597b4d8a6b1ab0f`。比對時 8768 頁面仍能直接使用，跨來源 fetch 被拒絕；不能只用 fetch 失敗推斷隔離，服務未啟動也會失敗。
- 回歸在另外的隔離 `127.0.0.1:18765` 跑，避免更動舊來源資料庫清單：原生帳本 11、儲存 7、分類付款交易／畫面 9／6、預算 8／4、固定 9／5、頁面故障安全 7、查找 8、完整備份互通 12、首次入口 5／7／9 組通過；各自只重設命名測試 DB，portable-checks 順序執行。含所有九類／歷史月份／明確零元／BigInt／引用／順序 bytes 往返、損壞／容量／交易中止，不稱正式資料驗證。
- 實際固定 8768 首次為空白，8767 原合成帳本不可見。嚴格 CSP 下用專案合成 JSON fixture 確認還原，查看九類資料及歷史精確值，惡意帳目／分類只作文字，沒有 img、inline script、外部靜態資源或 CSP 錯誤。新增分類／付款、付款更改、總／分類預算與加總、手動 12.34 元、固定 0.29 元新增／補記／下月改 1.29 元均正常，補記前後預算、搜尋與月曆一致；付款更改仍保留原消費快照。桌面 1280px 與實際 375px（頁面 360px、對話框 328px）無水平溢出，Enter／Escape、確認取消、重新整理及關頁重開已測。
- 停止 8768 服務，確認 TCP 連線失敗、關閉頁籤，以同設定檔與完全相同網址冷啟動；快取頁可用、原合成支出 12.63 元仍在。離線 Enter 新增 0.37 元後再關頁冷啟動，仍顯示 13 元、總預算 100 元／剩餘 87 元。舊來源唯讀基準未改，回歸在別的來源，沒有測試內容進入固定來源靜態快取。
- 已要求 Blob 完整備份下載，頁面顯示要求已發出、無 CSP 錯誤；工具 download 事件逾時，未確認檔案落地。備份往返結果來自原生 IndexedDB 測試 bytes，沒有宣稱使用落地檔再還原。未驗證 Explorer 雙擊可見視窗、其他瀏覽器／實體手機／螢幕閱讀器、完整封包、真實配額耗盡或正式資料。固定來源不防本機惡意程式搶占埠、擴充套件／同來源程式，也不保證瀏覽器永久保存；沒有帳號、同步、加密、自動備份或正式匯入。**備份未加密，Python Web 尚未被取代；僅供合成資料測試，請勿輸入真實帳目。**

## 0.13.4 每月固定支出與手動補記

- 收合「固定支出」僅管理每月固定規則：查看、新增、更改、確認停用。項目需非空、最多 100 個 Unicode 字且保留原文字；金額沿既有精確 cents、正數／最多兩位小數／十億元限制。開始月份限交易操作當下台灣本月或下月，建立後只讀；扣款日整數 1～31，短月取月底。新增需有效分類，更改沿 Python 保留目標原停用／歷史分類。
- 更改 upsert 下月版本，重複更改保留同一版本 ID，最後一次成功儲存生效；父 revision 精確加一，base、本月消費及過去版本不回寫。列表分目前／下月生效，備份中更遠未來版本標實際月份；尚未開始與已停用有文字說明。不提供訂閱／分期管理、重新啟用或實體刪除。
- 按「補記已到期消費」才入帳啟用的固定規則：從開始月份補至台灣今天，依每月有效版本及原定扣款日；歷史 due_day=null 視為 1 日。已入帳或已撤銷的 `(recurring_id, period)` 都不重建；每筆加一個 before=null 操作，付款快照「未指定」，來源固定／kind consumption／初始 revision 0。確認停用在同一寫入交易先補齊該規則，再停用並增加 revision。**這是記帳，不代表銀行已扣款。**讀取、收合、搜尋、月曆、預算、重新整理與匯出不補記；沒有排程、通知或其他背景寫入。
- 重用 `rules.mjs`／`ledger.mjs`／`idb.mjs` 現有規則與交易；同一交易重新讀完整快照／台灣時鐘／revision，驗證完整九類備份與容量，逐筆更新受影響 store 及 metadata（含 next_action_order）。兩分頁舊 revision 拒絕覆蓋；並行補記重新讀唯一標記。任何例外／request success 後 abort 全回滾，交易 complete 才成功。錯誤保留表單與確認視窗，固定安全訊息；Enter 儲存後恢復焦點。全部名稱用 DOM 文字 API，沒有 HTML、資料網址／日誌／靜態快取／外部服務。
- 實際測試：Node 50／50，固定 pure 8 項先失敗再完成；原生固定交易 9 組、固定畫面 5 組，含精確 100000 列／64 MiB、損壞、兩種中途故障、競態／舊版、交易排隊跨台灣午夜、短月／閏年／跨年、legacy null、停用／歷史分類、撤銷不復活、唯讀完全不變、補記後預算／搜尋／月曆一致、全九類及原月份／零元／大整數／操作順序的逐位元組備份往返。先重現儲存後鍵盤焦點遺失再修正；成功停用後無管理按鈕、保留停用分類／下月版本也已測。既有帳本 11、儲存 7、故障／安全 7、查找 8、分類付款 9／6、預算 8／4、互通 12、入口 5／7／9 組瀏覽器回歸通過。受正式檔案防護 Python 隔離 439／439、Ruff、30 個 JS 檔與離線 inline module 語法、差異檢查通過。
- 主頁使用新隔離 `127.0.0.1:18832`，未動原來源。實測桌面 1280px／375px、原生鍵盤 Enter／Escape、停用取消／確認、惡意文字、兩個實際分頁舊 revision、重新整理與關頁重開；375px 無水平溢出、視窗 328px。新規則及重整仍 0 元，補記房租才 12.34 元且即時反映於三個查閱區；停用缺漏合成 0.29 元後 12.63 元。停服並確認埠關閉、關頁冷啟動，再離線新增 0.29 元／明確補記／下月更改 1.29 元／確認停用，再次重開仍為 12.92 元與原版本、停用狀態。離線快取 `local-first-offline-0.13.4-v2` 完整只含白名單靜態資源。
- IndexedDB v2、JSON v1 九類及 Python SQLite schema／依賴不變，啟動仍用 `node tests/local_first_preview.mjs`；更新須在線上完整載入、關閉舊分頁並確認離線就緒。未驗證其他瀏覽器／實體手機、螢幕閱讀器、真實配額耗盡、完整封包或實體備份跨裝置；本輪往返用隔離合成 IndexedDB 與 bytes，不稱正式資料驗證。**備份未加密、瀏覽器可能清除資料、Python Web 尚未被取代；請勿輸入真實帳目。**

## 0.13.3 本月預算與剩餘金額

- 原生收合設定提供總／分類預算的個別設定、更改、清除及「設為分類預算加總」。台灣時鐘由既有帳本模組與頁面共用，寫入交易執行變動時才取得本月；操作沒有月份參數。其他月份只保留／完整備份，不提供管理入口。預算皆可不設定；總額存在時至少等於所有本月分類合計（含停用分類），分類停用時只能清除其既有預算。
- 新金額沿 Python `budget_cents` 只接受 ASCII 正整數台幣且不超過十億元。依使用者確認，加總也套十億元上限（Python 加總原功能不變）；歷史小數預算精確顯示且只可清除，不回寫或四捨五入。歷史明確零元保留「已設定」狀態與清除入口，新設定仍拒絕 0。整數預算文字帶「元」且不帶 .00，輸入只放數字；支出與剩餘／超支有小數才顯示精確小數。
- `browse.mjs:monthBudget` 使用唯讀快照及 BigInt cents，沿用四來源有效 consumption 過濾，限台灣本月至今天；撤銷、未來及其他月份不列入，沒有補入帳或提醒。總額含未設分類預算的消費；原分類明細完整顯示所有本月已設預算，包括停用與零消費。總額／分類未設各顯示「尚未設定」；原生 progress 最高 100%，超支用文字呈現，歷史零元無百分比／進度。
- `ledger.mjs:updateBudget` 重用完整快照與原子交易工具，重讀目標列以拒絕同一預算的舊分頁；加總重讀最新分類，其他分類的舊畫面資料不充當計算來源。變動後重新驗證下限、九類資料及容量，再寫預算／meta；清除重排剩餘 position，順序不裁切。沒有新增 revision、store、備份版本或通用架構。交易 complete 才成功，例外或 abort 全回滾；固定錯誤保留輸入，成功／失敗恢復預算鍵盤焦點。文字只用安全 DOM API，不送網址、日誌、靜態快取或第三方。
- 驗收：`node --test tests/test_local_first_*.mjs` 42 項通過（預算 7）；完整受保護 Python 隔離 439 項、Ruff、26 個 JS 檔與離線 inline module 語法及差異檢查通過。`/tests/local_first_budgets_browser.html` 8 組原生交易，`/tests/local-first-budgets.html` 4 組實際畫面；功能缺少與鍵盤焦點均先失敗再通過。涵蓋 100000 列／64 MiB、損壞資料、中途例外與 request success 後 abort、兩連線競態／最新加總、排隊跨月、全月份／零元／大整數／引用／操作順序的逐位元組備份往返及唯讀帳本不變；沒有測試正式資料。
- 主頁隔離來源 `127.0.0.1:18812` 實測 1280px／375px、Enter 操作與焦點、兩個實際分頁舊預算拒絕、停用項目只可清除、重新整理及關頁重開。停服且埠關閉後冷啟動，離線新增、更改、清除、加總，再重開總額 125 元／已花 12.34 元／剩餘 112.66 元一致。既有帳本／儲存／故障安全／查找／分類付款／備份互通／三種首次入口瀏覽器回歸全通過。靜態快取為 `local-first-offline-0.13.3-v1`，已核對新版完整資源；更新須先在線上載入並關閉舊頁。
- 未驗證其他瀏覽器／實體手機、螢幕閱讀器、真實配額耗盡、完整封包、新版備份實體下載跨裝置或正式資料。IndexedDB v2、JSON v1 與 Python SQLite 不變，啟動仍為 `node tests/local_first_preview.mjs`，不需資料搬移。**備份未加密、瀏覽器可能清除資料、Python Web 尚未被取代；不可輸入真實帳目。**

## 0.13.2 分類與付款方式設定

- 原生 `<details>` 預設收合，兩類清單各提供新增、更改／確認停用；保留「現金／未指定」與停用狀態，不提供重新啟用。名稱驗證沿用 Python strip、Unicode 字數、分類保留名稱及付款控制字元規則；備份仍沿用原格式的 Unicode／文字／關聯限制。交易完成才刷新記帳選項；失敗保留輸入、在確認視窗顯示固定錯誤，取消不寫入。分類／付款／帳目與備份全部以文字 DOM 顯示，不放入網址、日誌或快取。
- `rules.mjs` 管理名稱驗證，`ledger.mjs` 在既有 IndexedDB 交易內重讀與驗證完整快照，準備變動後先驗證完整 JSON v1 大小與列數，才逐筆寫受影響資料及容量 meta。分類更改同步所有現存引用，包含撤銷消費、歷史／未來預算、定期規則／版本、捷徑與所有 before；受影響消費與父規則 revision 精確增加，before revision 不增加。內建分類舊 override 停用、新 override 啟用。付款更改沿用 ID，不回寫消費與 before 名稱快照。設定寫入比較原清單以拒絕舊分頁，不新增版本欄位、store、架構層或依賴。
- Node 設定 9 項由失敗到通過；全部相關 Node 35 項、完整受保護 Python 隔離 439 項、Ruff、23 個 JavaScript 語法與 CRLF 相容差異檢查通過。原生設定交易 9 組涵蓋完整同步／精確 revision、重新鍵入、衝突／損壞、兩種中途回滾、100000 列與近 64 MiB 擴張拒絕、完整備份逐位元組往返；設定畫面 6 組涵蓋安全文字、錯誤保留、選項更新、確認取消、原停用值與快照。審查發現跨分頁編輯 revision 可能被錯誤推進，先重現後修正；正常更改仍保留編輯草稿，另一分頁更改不能被覆蓋。既有帳本／升級／故障／查找／互通／入口回歸亦通過。
- 主頁實測使用新隔離來源 `127.0.0.1:18791`，在 1280px／375px 操作與確認，沒有水平溢出（375px 視窗為 328px）。兩個實際分頁驗證舊設定拒絕；重新整理、關頁重開及停服後冷啟動均保留設定、12.34 元精確 cents 與原付款名稱快照；離線新增、更改、停用後再次重開一致。Service Worker 為 `local-first-offline-0.13.2-v3`，更新須在線上完整載入並關閉舊頁，沒有 Python／SQLite 升級步驟。
- 尚未驗證其他瀏覽器、實體手機、螢幕閱讀器、真實配額耗盡、完整封包、新設定備份落地檔案跨裝置搬移或正式資料。本輪往返在原生 IndexedDB 與備份 bytes 進行。**備份未加密、瀏覽器可能清除資料、Python Web 尚未被取代；不可輸入真實帳目。**

## 0.13.1 搜尋與月曆

- 搜尋以關鍵字或開始日期至少一項啟動；原生日期欄位兩端包含，未填結束日截至台灣今天，錯誤時保留欄位。範圍為四種來源的已入帳、有效生活消費，排除未來與撤銷；每批顯示 50 筆並保留完整總數。月曆星期一開頭，預設台灣本月，只能切換本月與過去月份；搜尋或切月時兩區由同一唯讀快照更新，月曆記號、當日明細及 BigInt 合計亦取自同一月份結果。
- 瀏覽器測試使用新隔離來源 `http://127.0.0.1:18773` 與合成帳本，未清除原 `8767` 來源。停服、連接埠關閉並關頁重開後仍可搜尋與查看日合計；375px／桌面皆七欄且無水平溢出。惡意文字只作文字、65 筆分批完整呈現，查找前後完整備份與操作筆數未變。舊版 IndexedDB 首次開啟仍會執行 0.13.0 既有原子升級；本輪新增查找操作不寫帳本。**不可存放真實帳目**，其他瀏覽器與實體手機尚未驗證。

## 0.13.0 現行儲存與驗證

- 同名合成 IndexedDB 已升至版本 2：九類資料分開保存，另有 `meta`；舊版單一 `ledger` store 在同一升級交易內驗證、搬移並移除，失敗不半套升級。每次手動操作仍在同一交易重查有效帳目與 revision，只寫變動的帳目、操作和 meta；完整 JSON v1 匯出使用一致唯讀快照，還原只在確認後的完全空白帳本進行。
- Python 與瀏覽器完整 JSON v1 均最多 **64 MiB**，八個資料清單合計最多 **100000 列**；舊 200 筆消費／1000 筆操作的本機限制已移除。舊程式不能讀取超過 16 MiB 的新版備份。每次寫入仍讀取並驗證全帳本，僅儲存寫入改為逐筆；資料成長時的效能仍須繼續量測。
- 合成 Chromium 154／Windows 10 In-app Browser 於 20000 筆消費／50000 筆操作（新增後 20001／50001 筆、8,997,419 bytes）測得：舊版升級 4436 ms、讀取 506 ms、匯出 682 ms、寫入加匯出 1833 ms、空白還原加匯出 4793 ms。精確 64 MiB 與 100000 列邊界各耗 5592 ms、9356 ms；合成負載不代表手機效能。另在獨立 `127.0.0.1:18763` 來源停服、確認連線失敗、關頁重開後，離線新增合成消費且再次重開仍可讀。既有主測試來源未清除。
- Node 21 項、正式檔案防護 Python 隔離 439 項、Ruff、JavaScript 語法及 CRLF 相容差異檢查通過；原樣 `git diff --check` 僅對既有 CRLF 測試檔的修改行警告。原生瀏覽器儲存 7 組、帳本 11 組、互通 12 組、頁面 7 組、入口 5／7／9 組與大量資料邊界測試通過。獨立審查後新增提交成功但後續唯讀失敗、未知 store、阻擋解除後不得暗中升級的回歸案例，均先失敗再修正。未驗證真實儲存配額耗盡、手機／其他瀏覽器、正式帳本、真 OAuth、完整封包與舊 Service Worker 升級中缺檔。JSON 未加密，瀏覽器可清除網站資料；可信固定 HTTPS 來源、真實資料搬移及備份復原保護尚未完成。**不可用來記錄真實帳目。**

以下 0.12.2 與更早小節為當時的歷史驗證紀錄；其中的 IndexedDB 版本 1、16 MiB、200／1000 上限及「尚未逐筆儲存」均不代表目前狀態。

## 0.12.2 安全與可靠性核對

- 表單先由純規則驗證，帳目、revision 與操作紀錄在 IndexedDB 同一交易寫入；匯入檔先在記憶體完成 v1 格式、關聯與容量檢查，確認後在寫入交易內重查空白。頁面以文字節點／表單值呈現，唯讀快照產生未加密 JSON Blob 下載。程式沒有將帳目放進網址、靜態檔或 CacheStorage，也沒有對外部網域的主動請求；預覽服務只記錄 HTTP 方法與路徑，不記錄表單或備份內容。Service Worker 只快取固定的 `/local-first/` 程式白名單，不攔截備份 Blob、`/tests/` 或 Python Web。
- 已重現儲存配額錯誤原文會顯示在頁面的缺口；改為只有本機帳本／表單驗證的已知錯誤能顯示具體文字，其他寫入故障一律顯示固定提示。新測試涵蓋 DOMException 與一般 Error，並確認輸入保留、交易回滾。修改靜態模組時同步更新離線快取版本。
- 合成資料瀏覽器測試涵蓋直接輸入與完整備份還原的 HTML／script 字串，只出現文字節點，沒有生成可執行元素或惡意路徑請求；測試頁 Resource Timing 未見外部來源。既有格式、200／1000 上限、兩連線 revision 衝突、非空拒絕與交易中斷測試維持通過。Service Worker 缺檔、更新失敗與舊快取保留由 Node 模擬核對，未在真瀏覽器刻意破壞快取。實際以既有 In-app Browser 合成測試設定檔停止預覽服務並確認無法連線後，關閉頁籤重開原網址，合成帳目仍在；離線更改、軟刪除及再次冷啟動持續有效。本輪工具只觀察到離線備份下載請求，沒有確認檔案實際落地；使用者先前手動確認過落地，不能算成本輪重新實測。
- 仍是整份帳本的單次交易快照（200 筆消費／1000 筆操作）；接近儲存配額時可能拒絕寫入，未實測真實配額耗盡。瀏覽器可清除 IndexedDB／快取；未加密 JSON 應自行保管，同來源其他程式若有執行權也可接觸本機資料。要承載真實資料，還需明確的來源隔離、持久化與備份復原設計及更多瀏覽器／裝置驗證；本輪沒有做逐筆儲存、加密或正式搬移。

## 同版合成資料跨來源搬移與復原演練（2026-09-30）

- 使用既有 In-app Browser 測試設定檔，但在此前未建立帳本的兩個新來源 `http://127.0.0.1:18761`（A）與 `http://127.0.0.1:18762`（B）操作；沒有開啟、清除或搬動原 `127.0.0.1:8767` 的瀏覽器儲存。兩個來源由一次性白名單預覽副本提供，臨時程式與儲存檢查頁於演練後移除，原預覽工具和產品頁未改。
- A 從合成九類備份建立帳本並實際下載 4,643 bytes 的 JSON；B 初始完全空白，顯示九類筆數供確認後，才使用 **A 的落地檔**還原。B 關頁重開再下載的 4,643 bytes 與 A 原檔逐位元組一致，SHA-256 同為 `016aca0af5c135547a1b8aab300b108e5d6bdca8ac96ee3f8b`。保真解析逐欄比對涵蓋 cents、ID／關聯、revision、大整數、歷史版本、before 快照、voided 與操作順序，不只比總額。
- B 的可操作手動帳目更改後再確認軟刪除：原 ID 不變，revision 從 `9007199254740993` 精確增加至 `9007199254740995`，操作從 7 筆增至 9 筆，新增兩筆 before 快照與原資料一致；其他八類及其餘消費未變。B 再次關頁重開仍不顯示已刪帳目；A 重新下載的檔案與最初原檔逐位元組相同。
- 來源唯讀檢查顯示 A／B 各自的 IndexedDB 帳本、`/local-first/` Service Worker 範圍及 CacheStorage URL 都屬於各自埠口；快取只有固定程式資源，沒有帳目或備份檔。預覽日誌只有方法與靜態路徑，沒有帳目；既有惡意字串與外部資源瀏覽器回歸仍通過。兩個埠口在同一測試瀏覽器設定檔中，驗證的是**來源隔離**，不是跨設定檔同步。
- 另在獨立合成測試帳本驗證損壞／超過 16 MiB、超過 200 筆消費／1000 筆操作、非空或重複還原、request success 後中止、模擬儲存配額錯誤，均拒絕且不留下半套資料；錯誤不回顯備份內容或底層儲存細節。容量故障案例是本輪新增的最小回歸測試，產品程式與備份格式沒有改。Node 20 項、原生 IndexedDB 11 組、完整互通 14 組、頁面故障／安全 7 組及入口故障 10 組通過；完整 Python 隔離 438 項、Ruff、JavaScript 語法與差異核對通過。
- 本輪用於比對的四份落地下載檔都在使用者 Downloads 目錄，**僅含合成資料**；不自動刪除檔案。現有 JSON 未加密，不應將實際帳目存入驗證頁。真實資料使用前仍需固定可信來源／分發方式、處理瀏覽器清除或配額耗盡的資料遺失風險，並制定未加密備份的保護、復原與裝置驗證；未測真實配額耗盡、其他瀏覽器設定檔／手機或完整封包。日後如需加密，應採成熟、標準且廣泛審查的密碼學原語與函式庫。

## 開啟與重跑

實際 worktree：`C:\Users\User\Desktop\DiscordBOT\.worktrees\localhost-web-auth`，分支 `codex/localhost-web-auth`。

固定本機入口用前述 8768 啟動器；以下是可提供測試頁的開發預覽，與固定來源隔離。在該目錄執行：

```powershell
node tests/local_first_preview.mjs
```

開啟 <http://127.0.0.1:8767/local-first/>。這個 Node 標準庫開發工具提供白名單產品及測試檔案、監聽 loopback，不處理記帳、沒有 API 或目錄列表，不提供正式檔案；它仍有方法／路徑預覽日誌，不能代替具備 Host／CSP 限制及無請求日誌的 8768 固定服務。沒有 npm 專案、安裝套件或建置步驟。不同預覽埠是不同的合成帳本來源，不應因占埠自行換固定入口。

```powershell
node --test tests/test_local_first_*.mjs
```

- <http://127.0.0.1:8767/tests/local_first_origin_browser.html>：舊來源主合成帳本、metadata、離線靜態快取及 SW 唯讀基準／比對，不清除或搬移。比對時須同時確認 8768 直接可用；其他會建立測試 DB 的回歸請另用隔離預覽來源。
- <http://127.0.0.1:8767/tests/local_first_browser.html>：原生 IndexedDB 規則／交易隔離檢查。
- <http://127.0.0.1:8767/tests/local_first_storage_browser.html>：隔離合成帳本的版本 1 → 2 升級、損壞與阻擋檢查。
- <http://127.0.0.1:8767/tests/local_first_settings_browser.html>：原生設定交易、所有歷史引用、原子回滾、容量與備份往返；含大型合成資料，執行較久，只重設自己的 `-settings-checks`／`-portable-checks` 測試帳本。
- <http://127.0.0.1:8767/tests/local-first-settings.html>：隔離 `-settings-ui-checks` 帳本，實際設定畫面、惡意文字、錯誤保留與編輯競態；故障注入只存在測試腳本。
- <http://127.0.0.1:8767/tests/local_first_offline_settings_browser.html>：在線上載入新版主頁並關閉舊主頁後，只讀核對 `0.13.6-v2` 的加密備份、固定支出、分類付款與預算靜態資源已完整快取；主頁離線冷啟動仍需實際停服重開驗證。
- <http://127.0.0.1:8767/tests/local_first_fixed_browser.html>：固定交易與備份往返、競態／回滾／容量／台灣午夜；只重設 `-fixed-checks` 與 `-portable-checks`，大型合成容量測試執行較久，勿與其他重設 portable-checks 的測試同時跑。
- <http://127.0.0.1:8767/tests/local-first-fixed.html>：隔離 `-fixed-ui-checks` 原生固定表單、設定區、重複按鈕、錯誤保留、停用確認與安全 DOM；故障注入只存在測試腳本，不快取。
- <http://127.0.0.1:8767/tests/local_first_scale_browser.html>：隔離大量資料、64 MiB 與 100000 列邊界；執行耗時與記憶體需求較高。
- <http://127.0.0.1:8767/tests/local-first-ui.html>：原頁面 DOM 與腳本，使用另一測試 DB、注入交易失敗；不將故障注入放進產品頁。
- <http://127.0.0.1:8767/tests/local-first-narrow.html>：375px 原生 iframe，同一來源的實際頁面布局／操作；不是實體手機測試。
- <http://127.0.0.1:8767/tests/local_first_portable_browser.html>：完整合成備份互通測試，只重設獨立 `-portable-checks` 帳本。完成後關閉頁面，重開相同網址加 `?resume=1`，只讀取並再匯出，不重新初始化／還原。再匯出文字供 Python 隔離驗證，不是正式備份下載入口。
- <http://127.0.0.1:8767/tests/local-first-entry.html?case=restore>：首次選擇／還原／下載的合成資料瀏覽器測試，每次使用新的 `run` 查詢值建立獨立 `-entry-` 帳本；`case=start` 測明確建立，`case=failure` 測還原回滾。測試不清空其他資料庫。

首次載入須有預覽服務。看到「可離線重新開啟」後，可用 Ctrl+C 停止預覽、關閉頁籤，在**相同瀏覽器設定檔、協定、主機、埠及 `/local-first/` 路徑**重新開啟；未曾在線上完整安裝的瀏覽器無法離線首次開啟。若顯示尚未就緒，請保持服務開啟並檢查瀏覽器是否允許 Service Worker／快取。停用或清除網站資料可能同時移除快取和 IndexedDB；下載後仍需自行確認備份檔實際保存並妥善保管密碼，未加密 JSON 應自行保護。本功能不是 PWA 或 App，沒有離線首次安裝保證。

## 0.12.1 最小離線載入

- `local-first/sw.js` 的 scope 僅 `/local-first/`，安裝時完整快取首頁、CSS、四個本頁模組及既有本機 lossless-json 發行檔。只對同來源、無 query、固定白名單 GET 回應快取；不攔截 `/tests/`、Python Web／OAuth、任意其他檔案、備份 Blob 下載或使用者資料。帳目仍僅在 IndexedDB，不進 Cache API。
- 完整安裝後才啟用新快取；更新中的 worker 等舊頁關閉後才接手，不強制 `skipWaiting()`，啟用時先核對新快取完整才移除本功能舊快取，其他快取與 IndexedDB 不動。更動離線程式資源時需更新 worker 的 `CACHE` 版本名稱，避免新舊頁混用。
- 頁面只在被本功能 worker 控制、且 worker 實際核對每個必需檔案存在後顯示「可離線重新開啟」。不支援、註冊失敗、未受控制或缺檔時維持「尚未就緒」。瀏覽器日後仍可能淘汰快取或帳本，離線可載入不代表資料永久安全。

實際 In-app Browser 使用合成資料：`http://127.0.0.1:8767/local-first/` 首次在線上看到就緒，關頁、Ctrl+C 停服並確認埠關閉後冷啟動成功；離線新增、更改、確認軟刪除，再關頁重開，原帳本保留且已刪帳目未復活。另以獨立的 `http://localhost:8767` 空白來源首次在線上安裝、停服後開頁，離線選用 `tests/fixtures/portable_life_ledger.json`，顯示九類摘要、確認還原，關頁重開仍讀到資料。`/tests/` 在停服後拒絕連線。原生 IndexedDB 11 組、頁面故障／安全 6 組、互通 14 組、入口 5／8／9 組瀏覽器測試重新通過；Node 20 項、正式檔案防護 Python 隔離 438 項、Ruff、JS 語法及 CRLF 相容差異檢查通過。瀏覽器使用現有 In-app Browser 測試設定檔，沒有另建全新 profile；離線按鈕顯示已要求下載，但工具未捕捉完成檔案，故未確認下載實際落地。快取淘汰、停用 Service Worker 的真瀏覽器畫面、其他瀏覽器／實體手機、正式帳本與真 OAuth 未驗證。

## 規則與資料邊界

- `local-first/rules.mjs`：無 DOM、儲存、網路或時鐘的純規則。金額使用精確十進位解析與 BigInt，cents／合計／差額不經 float；新增上限沿既有 1,000,000,000 元，必須為正數且精確整分。支援一般科學記號、Unicode 十進位數字與既有 Decimal 的底線輸入。嚴格 Gregorian ISO 日期 `0001-01-01` 至 `9999-12-31`，閏日有效；不晚於入口提供的台灣今天，項目非空且最多 200 個 Unicode 字元。
- `page.mjs` 以 `Intl.DateTimeFormat` 的 `Asia/Taipei` 取得今天，每次提交傳入規則；裝置時區不改變日期定義，但装置時鐘是否準確仍由裝置負責。金額呈現千分位、元、移除不必要尾零，儲存值不變。使用文字節點，不拼接使用者 HTML。
- 使用原 `tests/fixtures/life_ledger_rules.json` 金額案例與閏日／短月日期核對，未修改案例。這次只移植本頁需要的金額／日期／手動驗證；沒有移植比較、預算或自動入帳，也未宣稱完整 Python 規則都能在瀏覽器執行。
- **已確認的規則差異**：Python 現有 Decimal 上下文會把 `1.000000000000000000000000000001` 算成 100 cents、把 `1e-1000030` 下溢成 0 cents。本頁依使用者確認採精確正數／最多兩位小數，拒絕這兩類非整分／下溢輸入；長尾全零仍可接受。Python 程式保持不變，不以浮點解析模擬這些異常。

主驗證頁新增帳目保存備份 v1 的 13 欄語意：`id, spent_on, cents, category, note, source, recurring_id, period, voided, payment_source_id, payment_source_name, kind, revision`；新增僅 `source=manual`、`kind=consumption`、規則／月份引用 null。新增 ID 為符合備份字串規則的 `e_`／`a_` 加 UUID，付款為 `p_cash`／`p_unspecified`，不依賴 SQLite 自增數字；互通測試另原樣保存備份四來源及其既有 ID／引用。

固定本機測試擁有者 `local-test-owner` 不帶 Discord 身分。操作依陣列順序保存 `id, expense_id, before, undone`，新增 before=null，更改／刪除 before 保留完整當時帳目與付款名稱快照；revision 遞增、voided=1 保留帳目。沒有復原按鈕；0.11.26 另以完整合成資料驗證四來源保存，以及再還原到 SQLite 後的既有撤銷語意，不代表瀏覽器已能管理全部來源或撤銷。

預設七分類以缺省規則呈現，`categories=[]` 表示沒有 override；明確 active=0 保留停用，不會被一般讀取重設。首次建立只寫現金／未指定付款選項及空帳本，不产生操作歷史。更改可保留停用的原分類與歷史付款快照，停用選項不能當作新增選項。0.13.2 已加入分類／付款設定介面，完整規則及驗證見本文件開頭。

## IndexedDB 與交易

**以下為 0.11.25～0.11.28 的歷史實作說明；現行 0.13.0 以本文件開頭的版本 2 說明為準。**

- 本頁資料庫：`discordbot-localfirst-synthetic-v1`，儲存版本 1；object store `ledger`，獨立建立標記 `created` 與本機帳本鍵。資料保存在 **目前瀏覽器設定檔、來源 `http://127.0.0.1:8767`**，不在電腦 data.db。
- 0.11.26 內部帳本狀態改為 v2，保存備份的九類資料；IndexedDB 名稱、store 與儲存版本不變。只對欄位完整的舊本機 v1 四清單狀態補出五項空資料／null 設定，讀取／匯出不寫入升級；下一次成功手動操作才保存 v2，帳目／操作原樣保留。非法備份缺欄位與損毀狀態仍拒絕，沒有正式 schema 遷移。
- 首次明確建立在同一交易写入標記與帳本；再開頁僅檢查已存在資料，不重建缺損帳本、不新增操作。`readLedger()` 純 readonly，不隱含初始化。兩個自動測試帳本分別加 `-checks`／`-ui-checks`；只重設自己的測試資料，不清除主驗證頁或其他網站資料。
- 更改／刪除在同一 readwrite 交易重新取得帳目並檢查有效手動來源、expected_revision。舊版本拒絕並要求重新載入，不覆寫另一分頁的新資料。消費與操作紀錄同一交易，**transaction complete** 才顯示成功；request success 後 abort 仍拒絕、完整回滾。驗證／儲存失敗保留表單；刪除失敗在確認視窗內顯示錯誤。
- `ponytail:` 註解記錄簡化方式：整份本機帳本在單一交易讀寫，**最多 200 筆消費（包含軟刪除）與 1,000 筆操作**，達上限拒絕；沒有自動丟棄歷史。正式大量資料需改逐筆 store／索引並保留原子交易，本輪不建立第二套儲存抽象。
- 同來源重開才能核對持久化；換瀏覽器／設定檔、網域、協定或埠不會自動共享。清除網站資料／瀏覽器淘汰資料可能刪除本機帳本，隱私模式也可能不保留；即使有測試備份入口，**不能作為唯一正式資料來源**。

## 0.11.28 首次選擇與完整備份入口

- 空白帳本首次載入只讀取，不自動建立帳本或付款預設；選「開始記帳」才在同一交易建立帳本與標記。已有完整帳本直接進入原表單；殘缺／非空資料拒絕當成空白。每次讀取仍不新增操作紀錄。
- 「從備份還原」選 JSON 後，先沿用 v1 保真解析、16 MiB 格式限制與本機 200 筆消費／1000 筆操作限制，畫面只顯示九類資料的筆數。取消、非法／超限檔案都不寫入；明確按「確認還原」後才開交易，交易內再次確認整個 store 完全空白，帳本與標記一起完成或回滾。成功後重新讀取；已有帳本、預設付款、建立標記或任何鍵均拒絕，沒有清空／覆蓋／合併。
- 原帳本「資料管理」可要求瀏覽器下載固定檔名 `life-ledger-backup-v1.json`；內容由既有 `exportPortableBackup()` 在 readonly 快照產生 UTF-8 v1 JSON，不修改資料。畫面只表示已要求下載，仍需使用者確認檔案實際保存。**JSON 未加密，含財務資料；下載後自行妥善保管。**
- 主頁明確確認才允許 `restorePortableBackup(db, bytes, true)` 寫入主測試帳本；原 `-portable-checks` 互通測試仍可使用原兩參數呼叫及原隔離資料庫。備份範圍、精確大整數、交易、容量、Python v1 契約未改。這不是正式資料搬移；仍無自動來源管理、預算管理、復原按鈕、同步或 App。0.12.1 才加入合成頁離線重開能力。

實際驗證來源 `http://127.0.0.1:8767`，Node 靜態預覽不處理記帳。新增隔離瀏覽器開始／還原／故障分別5／8／9組通過，原互通14組、原生IndexedDB11組、表單故障／安全6組重新通過；純 Node16項與正式檔案防護 Python 隔離447項通過。In-app Browser 於1280px／375px核對首次選擇、九類摘要、錯誤提示、無水平溢出與鍵盤開始／取消；備份 Blob 位元及唯讀前後帳本核對一致。下載事件未被工具捕捉，不能證明檔案實際落地；未驗證正式帳本／真 OAuth／實體手機／真正配額耗盡。Ruff、JS語法與差異／空白檢查通過。

## 0.11.25 實際驗證紀錄

- 改動前 Python 相關隔離基準 162 項通過；新 Node 純規則 9 項先 RED 再 GREEN，不啟動瀏覽器或 SQLite。Node v24.19.0；原生 IndexedDB 11 組與實際表單 6 組通過：一次建立／唯讀、不重複、精確輸入、操作順序、舊 revision、兩連線競爭、請求成功後 abort 的帳目／操作回滾、停用 override、重新連線不復活、儲存失敗輸入保留及惡意項目／分類文字。
- In-app Browser 在上述 loopback 來源完成新增、重新整理不重複、關閉分頁後同來源重開仍在、更改、取消／確認軟刪除、兩實際分頁舊 revision 拒絕。桌面實際内容寬 1265px；375px 原生子頁面（可視內容 360px）表單／清單操作正常，scrollWidth=clientWidth。工具的 viewport 覆寫未影響實際尺寸，因此採原生子頁面核對，沒有把未生效覆寫當作已測手機。
- 停止靜態檔案伺服器後，已載入頁面仍完成新增／更改／軟刪除，證明操作不依賴檔案伺服器或 Python／Discord API。工具沒有網路停用能力，**未實測整個瀏覽器斷網**，不能宣稱離線首次開啟／重新載入。主驗證頁錯誤／警告日誌為空；本機伺服器只見靜態資源 GET，產品頁腳本沒有 fetch／遠端資源，測試頁另讀合成 JSON 案例；沒有完整對外網路追蹤能力，不宣稱已封包驗證所有對外請求。
- 原 Python 完整正式檔案防護隔離驗證 434 項通過；Ruff、全部新 JS 語法、差異／空白與既有內容保存核對通過。隔離測試不是正式帳本、真 OAuth／Discord、實體手機、跨瀏覽器或真正儲存配額耗盡驗證。
## 0.11.26 完整備份互通核心

- `backup.mjs` 為純格式模組：`readBackup(Uint8Array)` 完整解析／驗證，`writeBackup(bundle)` 回傳 UTF-8 bytes。沒有 DOM、IndexedDB、網路、身分或時鐘；本機 lossless-json 4.3.1 負責 JSON 語法，專案負責欄位、型別、版本與全部關聯。[授權／來源／雜湊](../THIRD_PARTY_LICENSES.md)保留官方 UMD、source map 與 MIT 聲明，沒有 npm 專案或自行撰寫通用 parser。
- 完整保存 `expenses, categories, payment_sources, budgets, recurring_rules, recurring_versions, shortcuts, actions, settings`。四來源、voided、已存未來日期、付款快照、所有月份／零元／停用預算、版本、捷徑與 before／undone／操作顺序保留；空清單與 null 不混用，不補預設、不回算／同步、不裁切。備份內可用 ID 原樣保留，所有引用及歷史快照不重建 UUID。
- cents／ID 仍為規範字串；JSON 整數先精確解析成 BigInt，安全範圍才轉 Number。超安全範圍的 revision／periods／position 以原生 BigInt structured clone 保存，再匯出仍為**沒有引號的整數 token**，不保存 LosslessNumber prototype，不改任何全域原型。手動更改／刪除精確比較 revision，signed 64-bit 最大值不能再遞增，拒絕且不產生操作。
- 對照 Python `read_backup()`：16MiB UTF-8（無 BOM）、深度12、八清單總共100000筆、文字4096個 Unicode 字元，精確欄位集合、全域字串 ID 唯一及 signed 64-bit 單值。拒絕 duplicate key、NaN／Infinity、浮點／指數數值、bool 整數、錯誤日期／月份／cents、孤立引用、來源／規則不符、重複規則月份／版本、非法 before 不變欄位與設定。合法歷史值不套用目前手動表單的項目200字／金額／非未來限制，沒有略過、修復或截斷。
- `restorePortableBackup(db, bytes)` 只允許 `discordbot-localfirst-synthetic-v1-portable-checks`，**完整驗證及本機容量檢查後**才開 readwrite，在交易內確認整個 store 無鍵。任何帳本、標記、預設付款或其他鍵（即使值為 undefined）皆拒絕，不清除；帳本／建立標記一起寫入，complete 才成功，abort 完整回滾。`exportPortableBackup(db)` 用 readonly 同一快照，不初始化、不改操作或預設。
- 格式上限與本機上限分開：本機仍最多 **200 筆消費（含軟刪除）／1000 筆操作**；任一超限拒絕整份，不匯入前幾筆。其他清單仍受 16MiB／100000 筆等格式限制；全快照設計不適合任意規模，正式化需逐筆 store／索引並保留原子交易。本輪不提高上限或增加儲存架構。

### 實際互通驗證與限制

- 先確認新純格式測試因模組未存在而失敗，原生還原測試因介面未存在而失敗，再實作。Node 原9項加新7項共16項通過；3項新 Python 測試包含實際匯出 fixture、一致性 corpus（109種輸入）及 Node → Python 空白 SQLite 還原。審查重現官方解析器忽略相同值的重複欄位與未知 `__proto__` 鍵，先補失敗測試，再於既有深度掃描中檢查每層鍵；字串解碼與完整JSON語法仍由套件處理，不修改官方檔案。改動前相關隔離52項、完成後完整正式檔案防護437項通過，涵蓋舊 CSV／ZIP／備份、核心／Services／Web／Discord；Ruff／JS語法／差異核對通過。
- In-app Browser 實際來源 `http://127.0.0.1:8767`，14組原生互通檢查通過：九類全部欄位／引用／快照／順序、超安全整數、歷史／未来／零預算、唯讀、非空／標記拒絕、兩連線競爭至多一成功、request success 後 abort、精確 revision／上限、空資料／只有設定、200／1000邊界與超限、舊 v1 只讀相容與損毀拒絕。
- 既有手動原生11組與實際頁面6組重新通過，包含故障回滾／輸入保留／惡意文字／取消及確認刪除；三個測試頁沒有錯誤或警告。互通再匯出含惡意分類文字，DOM沒有生成img或額外script。未修改主驗證頁布局、表單或操作。
- 關閉分頁後以 `?resume=1` 同來源重開，未重設／重新還原，全部資料仍完整。實際瀏覽器再匯出交由 Python `read_backup()` 接受，所有中立欄位、引用與順序相等；暫存 SQLite 還原後同日期基準摘要／預算／比較、撤銷順序／revision、補記不重複及 voided 不復活一致。不是只比較總額，也不是產品呼叫 Python API。
- **後續修正（0.11.27）**：Python月摘要已接受既存／還原的明確零元總預算及分類預算，保留精確cents；使用率為None，Web不顯示其百分比／進度，零元跳過門檻提醒。新增／更改預算仍只接受正整數台幣，備份格式／本機結構不變。相關269項與完整防護隔離447項通過，含Node再匯出→Python還原摘要；本輪沒有重跑實際瀏覽器，前述瀏覽器結果仍是0.11.26紀錄。通知狀態不在備份，正預算後續重算仍可能再次提醒，還原不重播通知。
- 主驗證頁沒有檔案匯入／下載按鈕或正式搬移入口。匯入的自動來源只保存／讀取，沒有管理、改日、同步、提醒／入帳；沒有瀏覽器預算管理／分析／undo、加密／簽章、離線首次開啟／重載、Service Worker、PWA／App 或同步。
- 全部資料為合成；未驗證正式帳本／正式備份、真 OAuth、實體手機／其他瀏覽器、真正配額耗盡、完整網路封包或離線載入。測試伺服器仍只提供白名單靜態 GET；Python 僅做合成生成與隔離核對，產品解析、IndexedDB 還原／匯出沒有 Python／Discord 或網路 API。帳本未加密，只在本瀏覽器／同來源，仍不能作為唯一正式資料來源。

0.11.26 的下一步「本機備份入口」已於 0.11.28 完成合成驗證，0.12.1 補本機驗證頁的最小離線重開；正式資料保護／搬移、其餘本機規則與介面及離線首次安裝仍未完成。這不是整個網站 local-first 或完整正式搬移。
