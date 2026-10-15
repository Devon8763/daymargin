# 日餘

目前版本：**0.26.7**（獨立專案；依使用者指示建立C2，仍僅供合成資料測試）。

2026-10-15使用者授權在工具無法完成普通瀏覽器驗收後繼續C2；這不代表未驗證項目通過。滑鼠雙擊、兩個全新普通設定檔的實體加密備份還原、窄版、固定來源隔離及合成回退仍未完成，詳見[驗證紀錄](docs/split-provenance/validation.md)。

日餘，讓生活有度。網站程式位於 `web/`，沿用瀏覽器本機帳本與既有功能。僅供合成資料测试；IndexedDB帳本未加密，完整備份可選密碼保護。

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
- [拆分來源與SHA對照](docs/split-provenance/source.md)。
- [本輪驗證及手測](docs/local-first-browser-validation.md)。

原DiscordBOT及Python Web仍完整保留於原專案。日餘不依賴其目錄，不建立App／shared空殼、不沿用Git遠端。
