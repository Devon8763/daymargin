# 日餘

目前版本：**0.27.0**（依核准A基準完成四區UI／UX、D01～D04與五項整合；帳務及資料契約不變，仍僅供合成資料測試）。

2026-10-15拆分時未完成的普通瀏覽器驗收限制保留於[拆分紀錄](docs/split-provenance/validation.md)。隔離自動瀏覽器測試不能代替普通設定檔、實體備份復原與使用者手測；日常使用決定也不代表未完成驗收已通過，詳見[目前驗證範圍](docs/local-first-0.27.0-validation.md)。

日餘，讓生活有度。網站程式位於 `web/`，是獨立local-first記帳專案，不需Discord登入或Python Web。僅供合成資料測試；IndexedDB帳本未加密，加密完整備份只保護下載檔。

## Windows啟動

雙擊根目錄 `start_local_first.local.cmd`。成功後開啟 <http://127.0.0.1:8768/local-first/>。視窗保持開啟；Ctrl+C停止自己的服務。8768被占用時停止啟動，不換埠、不關其他程式。

啟動器使用已存在的Node執行環境，或本機Codex bundled runtime；找不到會明確顯示錯誤。拆分驗證使用Node v24.19.0；沒有npm安裝、建置、Python伺服器或Discord登入需求。

## 更新與資料

等待新版完整下載，先保留草稿，再關閉此來源全部舊頁及視窗後重開。沒有強制刷新或skipWaiting。離線首次安裝不可用；首次在線完整載入後才可同瀏覽器、同網址離線冷啟動。

保留IndexedDB `discordbot-localfirst-synthetic-v1`／版本11、首頁 `daymargin.home.v1`與預算 `daymargin.budget.v1`。舊名稱是刻意的相容措施。JSON v1～v10、加密封裝v1與原子空白還原契約不變，不清除資料或自動搬移帳本。

下載要求不等於檔案落地；請確認實體加密檔，並在另一全新普通瀏覽器設定檔以合成資料驗證同檔還原。忘記密碼不能復原。本機持久保存及離線快取不保證資料永久安全。

## 歷史、授權與驗證

- [更新紀錄](CHANGELOG.md)：相關歷史保留版本、日期、原意及當時驗證限制，不能當成本輪結果。
- [第三方授權](THIRD_PARTY_LICENSES.md)：Chart.js、內嵌色彩庫及lossless-json原檔與MIT授權。
- [UI／UX第一版基準與實作對照](docs/ui-ux-design.md)；[0.27.0驗證與待驗收](docs/local-first-0.27.0-validation.md)。
- [拆分來源與SHA對照](docs/split-provenance/source.md)。
- [0.26.11驗證與手測](docs/local-first-0.26.11-validation.md)；[0.26.10驗證與手測](docs/local-first-0.26.10-validation.md)；[0.26.9量測、驗證及手測](docs/local-first-0.26.9-validation.md)；[0.26.8驗證及手測](docs/local-first-0.26.8-validation.md)；[既有驗證歷史](docs/local-first-browser-validation.md)。

原DiscordBOT及Python Web仍完整保留於原專案。日餘不依賴其目錄，不建立App／shared空殼、不沿用Git遠端。

## UI／UX開發Skills

專案內`.agents/skills/`提供Impeccable與UI UX Pro Max；僅供Codex開發，不是網站執行依賴，未啟用Hook。請在Codex開啟本專案後，以`$impeccable`或`$ui-ux-pro-max`明確選用。安裝來源、版本、測試、隱私與使用限制見[安裝紀錄](docs/ui-ux-skills-installation.md)；本次安裝不代表已開始UI／UX設計。

分工、按問題選 Skill、文件權威、實作授權與可直接使用的提示見 [UI／UX 協作規範](docs/ui-ux-workflow.md)。
