# 0.26.11：R01還原提交後初始化失敗保護

日期：2026-10-16。只修R01，不開始UI／UX、其他重構或功能開發。以下為本輪實際執行結果，不是使用者手測，也不是安全認證。

## 起點、根因與最小修正

- 起點為0.26.10、分支`codex/daymargin-split`、HEAD `283c9e6b73e73ea6052d40f8647f70eb14d0cdcb`，工作樹乾淨。F01～F05已包含在這個提交；README「未提交F01／F02／F03」是過時描述，本輪只校正這處現況及必要版本／驗證連結。
- 檢查還原處理器、showLedger、showCalendar及呼叫者：restorePortableBackup只在IDB transaction complete後resolve；還原處理器設completed後重新讀取，再呼叫showLedger。後者先顯示帳本／啟用fields，最後才showCalendar；如果失敗，原catch只有文字、未設writeBlocked，finally又開回還原控制。
- 一般saving原已在提交後失敗設writeBlocked，所有一般寫入沿用其入口保護。本輪不修改saving、showLedger、showCalendar或帳務核心，只在還原區塊沿用同一旗標：提交後失敗鎖定、error與status清楚顯示已完成還原但讀取／畫面未完成，要求重載，勿重複還原。
- restoreControls(false)仍尊重writeBlocked；finally清busy後保持fields停用。選檔、檔案change、解密、取消還原／解密及確認還原入口核對旗標，防止程式觸發或舊事件繞過。未鎖定時的解密中取消仍可執行。
- 不重跑還原、不宣稱已提交資料回滾；沒有新狀態框架、持久鎖或資料遷移。重新載入會重新確認既有帳本，成功後可正常使用；原有非空還原拒絕不變。

## 失敗與通過證據

先補測試再修產品：

- Node處理器測試先正常／abort 2項通過，提交後read／calendar／render 3項失敗，錯誤`R01: committed restore did not block subsequent writes`。修正後同一份5/5通過。
- 原生未修正頁面注入月曆replaceChildren故障，還原提交且部分畫面開啟後，直接操作入口仍能啟動後續交易，報`R01: postcommit failure allowed another operation or changed restored rows/metadata`。未把初次測試事件選錯的工具腳本錯誤當作產品重現；修正測試事件後才得到此有效RED結果。
- 修正後原生五情境及三個實際重載情境均通過，沒有僅更新expected。所有資料皆為專案合成fixture及新資料庫。

## 記憶體測試與原生結果分開

`tests/test_local_first_restore_failure.mjs`擷取實際還原控制／處理器在Node vm執行，IDB操作與畫面步驟為記憶體替身，不能當成端到端結果。5項驗證正常、提交前失敗重試、提交後讀取／月曆／其他渲染失敗，以及busy清除、取消、強制重新備好pending資料後重複確認仍不再提交、控制不能重新啟用。

`tests/local_first_restore_failure_browser.mjs`載入實際page.mjs、原生IndexedDB及原表單事件。用新來源`127.0.0.1:55380`及每案例獨立合成DB；只在測試中攔截交易／節點，finally還原攔截。不開啟既有帳本、不清空使用者資料。

| 原生情境 | 實際驗證結果 |
|---|---|
| normal | 預覽取消無寫入；雙點確認只提交一次；完成後可記帳，非空再次還原拒絕且資料不變。 |
| abort | add request success後真正abort，所有store與metadata回到空白；仍可選檔重試，成功一次，後續正常操作。 |
| read | 還原transaction complete後，下一次readonly重新讀取拋錯；已提交資料保留，寫入保護及正確訊息生效。 |
| calendar | showLedger已顯示帳本後，實際calendar-grid.replaceChildren拋錯；部分畫面可見仍不能寫入。 |
| render | showLedger顯示帳本後，實際expenses.replaceChildren拋錯；同樣鎖定，不能從初始化較早失敗繞過。 |
| read／calendar／render各自重載 | 保留同一DB及raw／metadata基準，真的重新導覽、未重新種資料；成功讀回後表單可記帳，非空再次還原仍拒絕。 |

三種提交後失敗都驗證：恰好一次還原readwrite開始／commit；busy清除後直接呼叫start-ledger、發送消費submit事件、取消還原／解密、重複確認、直接選檔事件均不啟動另一筆寫入。原始全store／meta、完整備份逐位元組相同，訊息未被取消清除。這些不是只檢查disabled或程式字串。

## 其他本輪驗證

- 完整非固定入口Node **41份275/275**；新增5項包含在總數內。固定8768 CLI案例明確排除。
- 隨機埠靜態安全 **7/7**；6份修改JS語法、7項vendor SHA-256及git diff --check通過。
- 既有原生首次選擇／還原／下載 **9組**：格式、容量、abort、取消、正常保真、非空拒絕與重開。
- 既有加密備份原生 **10組**：密碼、竄改、解密KDF取消、abort／quota／另一連線非空競爭、完整保真、加密與明文下載Blob、下載取消；不冒稱實體檔案落地或跨設定檔復原。
- F02原生 **6組**額外回歸一般saving的真提交後畫面失敗仍鎖定，沒有為R01削弱原保護。本輪未重跑全部F01／F03原生情境；帳務與顯示既有Node回歸已完整執行。

## 真實版本更新及離線

沿用F04既有版本情境模組，獨立測試pin更新CURRENT 0.26.11、RELEASE 0.26.10→0.26.11、合成下一版0.26.12；schema與備份版本不混用。新合成標籤不是發行版，本輪原生演練使用真實舊資源。

修改前保存完整0.26.10 web資源及SHA-256，舊版不是拿新程式改標籤。獨立隨機來源`127.0.0.1:57969`實際通過：舊worker控制兩頁／保留草稿、缺Chart.js拒絕安裝、完整下載後等待、只關一頁仍等待、全關後自然啟用。核對命令列後只停止本輪擁有的代理服務，停服後新開同網址顯示0.26.11；20必要資源、25類raw／metadata／完整備份及首頁／預算偏好不變。

沒有skipWaiting、強制刷新、清網站資料或改SW策略／scope／資源URL。更新前保留草稿，完整下載後關閉同來源全部舊頁再開即可，無資料庫升級步驟。

## 檔案與Git

本輪共10個變更路徑：

- `web/page.mjs`：僅restoreControls至還原處理器的區塊；前後其他page內容保持。
- `web/index.html`、`web/sw.js`：僅版本／快取名稱。
- `tests/local_first_version_scenarios.mjs`：既有測試情境pin。
- `tests/local_first_preview.mjs`：新增隔離R01測試入口與資源；正式服務白名單不變。
- `tests/test_local_first_restore_failure.mjs`、`tests/local_first_restore_failure_browser.mjs`：上述記憶體／原生回歸。
- `README.md`、`CHANGELOG.md`、本文件：版本、指定過時描述及實際驗證紀錄；0.26.10起歷史內容保留。

起點以來HEAD與分支不變，未stage／commit／push／PR／tag。ledger、idb、backup、backup-crypto、rules、browse、usage、comparison、serve及所有vendor／授權原檔未改；不改schema、備份／加密格式、儲存識別、revision、交易、rollback、CSP或依賴。原DiscordBOT未操作。

原始合成證據在忽略目錄`.tmp/r01-20261016/`：initial.json含起點與web SHA、baseline、units.log、static-security.log、checks.json、native-before-reload.json、native-results.json、offline-results.json、final-state.json及畫面。均非使用者備份或正式帳本。

## 未驗證及手測

普通Chrome／Edge設定檔、實體手機／讀屏、真正斷網、實體加密檔復原、固定8768 CLI、Windows滑鼠雙擊及使用者手測本輪未驗證。沒有讀寫正式帳本、原設定檔、Token、.env或既有備份，沒有操作8767／8768來源或停止使用者服務。沒有修改安全設定或放寬測試；本輪原生及非固定入口測試均已實際完成。

使用者另行驗收時雙擊`C:\Users\User\Desktop\日餘\start_local_first.local.cmd`，使用新普通設定檔及合成備份，在空白帳本正常還原後記帳、重新載入及核對完整資料；不要用正式帳本刻意製造故障或重複還原。版本更新先保存草稿，待完整下載後關閉全部舊頁再開確認0.26.11。8768被占用時不終止其他程序，無須輸入Node指令。本輪完成後停止，等待使用者驗收，不開始下一批。
