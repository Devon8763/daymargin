# 拆分實際攜帶與省略｜2026-10-14

165份來源檔案依paths.tsv逐檔抽取；不以整個工作樹、web/或tests/為選取單位。原專案沒有刪除或搬走任何檔案。以下是在新repo抽取階段省略，不是刪除使用者資料。

| 省略項目 | 依據及理由 |
|---|---|
| 舊Python web/（Chart.js五檔除外）、Bot／投資／OAuth／SQLite及舊啟動器 | web/serve.mjs靜態白名單與15個瀏覽器模組匯入鏈沒有這些執行期依賴；Chart.js已由web/vendor獨立持有。原Python Web仍讀取原local-first備份模組，原檔不動。 |
| life_ledger_rules.py及Python規則測試 | tests/test_local_first_rules.mjs直接測試原JS規則及相同中立fixture，本輪重跑通過；不需再帶入一份Python參照實作。 |
| tests/test_browser_expense_comparison.py | 舊Python／JS比較對照，依賴舊Python規則；JS純規則與瀏覽器comparison测试仍保留。 |
| tests/test_browser_portable_backup.py、tests/test_portable_life_backup.py | 原跨系統Service／spending／隔離SQLite互通驗證；日餘原生備份、規則、交易及舊格式相容測試全數保留。 |
| tests/portable_backup_roundtrip.mjs | 消費者為上述Python互通測試；日餘Node備份測試直接匯入web/backup.mjs。 |
| Python Web搬移頁測試／預覽、web_ledger_backup_browser.mjs | 驗證舊Web搬移頁及白名單，留原專案；日餘安全白名單測試保留。 |
| requirements*.txt、Ruff設定、Python驗證runner | 原Python環境用途，保留的JS測試使用Node內建runner／瀏覽器原生頁面。 |
| 舊Bot／Web專用規格與計畫 | 與現行日餘啟動、備份契約無關；13份local-first相關文件原歷史內容保留。 |
| 混合README／CHANGELOG完整副本及其整份混合歷史 | 新README獨立撰寫；CHANGELOG保留相關版本原文、日期與當時限制，來源HEAD明列。不夾帶舊系統操作與無關敏感歷史。 |
| 原.git工作樹指標、.venv、node_modules、.tmp、快取與測試產物 | 原.git只用於正常Git傳輸讀取；物件不共享。環境與產物未抽取。暫存audit、tools、old-baseline、history.git亦不作為產品檔交付。 |
| 帳本、.env、Token／憑證、使用者備份／下载／匯出／上傳內容 | 不在逐檔白名單，未讀取或攜帶，不能作為清理刪除項目。 |

網站23檔及外部Chart.js五檔只在新repo純更名，C1全部165份SHA-256一致；vendor、source map、完整授權、兩份provenance及兩份合成fixture均保留。沒有刪除任何local-first執行模組、38份Node測試或80份瀏覽器測試檔；失敗測試也保留。

沒有新增App、shared、套件管理、建置框架或產品依賴。取得的git-filter-repo v2.47.0僅為本次工具，完整取得資訊見toolchain.md，不是日餘依賴。

具體來源路徑、歷史路徑與雜湊以paths.tsv、history-paths.tsv及commit-map.tsv為準。原始Python依賴檢查位置：原來源web/routes.py:354、tests/test_browser_expense_comparison.py:10、tests/test_browser_portable_backup.py:12及242、tests/test_portable_life_backup.py:13。這些是來源追查資訊，不是新專案的執行期路徑。
