# 0.26.10：F04測試版本情境及F05現行說明

2026-10-15。這是代理執行的隔離合成驗證，不是使用者手測或安全認證。本輪只處理F04＋F05，沒有效能、架構、部署或資料格式變更。

## 起點與既有工作

- 工作目錄`C:\Users\User\Desktop\日餘`，分支`codex/daymargin-split`，HEAD `40d32285230cf16baae8f6fac90cb8a469bded7b`，開始為0.26.9及17個未提交路徑。
- 在產品或既有檔案修改前，保存上述17個路徑的內容與SHA-256，以及當時完整web資源作真實0.26.9工作版基準，沒有覆寫或重設原工作。
- 本輪結束：原17個路徑都保留。`web/page.mjs`、0.26.8／0.26.9驗證文件、F01／F02兩份原生測試及F03三份fixture／原生／Node測試共8檔逐位元組不變。重疊版本測試、預覽、index、SW、README及CHANGELOG僅作本輪必要增量；0.26.9起所有CHANGELOG歷史內容不變。
- web僅index文字／頁面版本及SW快取名稱有本輪差異；其他web程式與所有vendor／source map／LICENSE／provenance均與保存基準一致。schema、格式識別、舊IndexedDB名稱、偏好鍵及/local-first/不變。

## F04根因與修改邊界

原預覽還在直接替換0.26.7→0.26.8；當前實際0.26.9沒有該字串，replace無聲保留原內容。更新與離線測試另外保存0.26.8／0.26.9固定期待，彼此不一致。

新增`tests/local_first_version_scenarios.mjs`，實際使用者為preview、update-browser、offline-settings、offline Node、update-status Node及新回歸測試；產品沒有匯入它。

| 種類 | 獨立預期 | 用途／限制 |
|---|---|---|
| CURRENT | 頁面0.26.10；cache `local-first-offline-0.26.10-v1` | 人工維護的測試pin；不讀產品版本當expected。 |
| SYNTHETIC | CURRENT→0.26.11／不同cache | 相同產品程式只改測試版本標籤，明示合成升版、非真實舊版或發行版。 |
| RELEASE | 真實0.26.9／其cache→CURRENT | 必須另供已核對的真實舊資源；本輪用修改前保存的0.26.9工作版，不是用新程式改舊標籤。 |
| LEGACY_CACHE | 保留0.13.11歷史快取名稱 | --previous-worker只是合成「未含comparison／Chart.js」資源情境；頁面仍CURRENT，不代表真的執行0.13.11。 |

- replaceOnce只允許恰好一次且有差異；零次、多次及無差異明確拋錯。預覽以500及固定版本情境錯誤回應，不默默繼續。刪節兩個資源的舊測試情境同樣核對命中數。
- assertVersionResponse分別驗證單一HTML頁面版本標記與單一worker CACHE宣告；轉換前驗CURRENT，轉換後驗情境期待，不作全檔版本替換。
- validateScenario分別拒絕old／next版本相同或cache相同。更新控制頁於舊頁、失敗更新及完整下載階段讀實際HTTP HTML／worker；新頁另核對實際頁面、快取名稱、快取HTML及20資源。
- 獨立性：產品仍自行宣告頁面／SW版本，不共用測試pin。新測試用手寫1.2.3／1.2.4 HTML／worker資料驗證錯誤能被拒絕，並實際啟動預覽核對HTTP內容，不能單靠同一轉換函式產生expected。新增目前產品來源與獨立pin核對，既有完整安裝／不完整安裝／等待／草稿與安全斷言保留。
- 歷史0.13.13的「已載入頁面不隨worker改版本」測試值、舊快取清理案例、JSON相容fixture、schema 11與加密封裝v1沒有被替換。沒有通用manifest、產品設定、建置流程或依賴。

## F05核對與更正

| 現行檔案 | 實際更正及依據 |
|---|---|
| `THIRD_PARTY_LICENSES.md` | 移除圖表使用仍需Discord OAuth的舊敘述，說明日餘不依賴登入或Python Web，首次資源完整下載後才離線。lossless-json用途改為JSON保真解析／序列化；`web/backup.mjs` validate將bundle.version限制1n～10n，`web/idb.mjs` portable依現存資料選1～10，故不再限縮為v1。 |
| `web/index.html` | 更正noscript、備份說明及隱私區的「Python Web尚未被取代」定位；保留簡短頁面及既有詳細說明區。備份說明改為可匯入JSON v1～v10／匯出依內容決定，並保留舊程式可能不支援、不可刪資料降版的警語。 |
| `README.md` | 更新目前版本、驗證連結與獨立專案定位；明確帳本未加密，加密只保護下載檔；日常使用決定不代表未完成驗收已通過。拆分歷史的未驗證限制仍連回原紀錄。 |

未修改第三方LICENSE、發行檔、source map或provenance；沒有把原記錄的來源核對日期改成當前網路查核。舊CHANGELOG、原驗證紀錄、拆分來源文字與日期刻意保留，當時的JSON v1或Python Web描述仍是歷史，不能當作本版現況或本輪通過證據。

本機惡意程式／擴充套件、來源隔離、帳本未加密、瀏覽器清除資料、密碼不可取回、下載要求不等於檔案落地等警語保留；沒有新增法律政策、雲端、登入或品牌改版。標題與合成資料警告亦未藉日常使用決定刪除。

## 先失敗後通過與本輪Node結果

1. 先寫並實際執行預覽HTTP測試，失敗為`Synthetic next-page replacement did not happen`：兩個實際回應都顯示0.26.9；測試自己的隨機埠程序正常關閉。
2. 再先寫5項版本工具測試，缺少fail-closed工具時失敗；實作後實際驗證零／多次／無差異、相同版本或cache、錯誤／重複HTML與worker、契約文字不被替換、新舊情境差異及獨立pin。預覽HTTP另驗證正常與合成缺資源模式。
3. 最終產品說明修改後完整重跑：非固定入口Node **40份270/270**、隨機埠靜態安全 **7/7**、修改JS語法 **15份**、授權SHA-256 **7項**、git diff --check通過。明確排除占用8768的入口CLI案例，沒有用測試刪除／弱化取得綠燈。

## 本輪原生瀏覽器範圍

只使用Codex內嵌原生瀏覽器的新獨立來源與合成IndexedDB，沒有開啟原設定檔或8768。

- F01實際雙分頁 **5組**：新30天快照、外部新增期間、日期／停止追蹤、再次外部修改revision拒絕、標籤及失敗／取消草稿保留。
- F02 **6組**：更名比較總額／帳目不變、繼續記帳、條件／草稿隔離、更名交易失敗不假成功、真正提交後刷新失敗仍鎖定。
- F03六個種子 **0／1／50／51／105／1000筆共15組**：首批及完整展開、排序／不重複、期間與多標籤、安全文字、全量搜尋／全選／CSV／預算、隱藏／順序／收合／草稿、後續批次取消／成功焦點、軟刪除保留歷史關聯，以及raw／metadata／完整備份不變。本輪沒有重做效能量測、375px或F03既有重載專用情境；不沿用前輪數字當作新結果。
- 另重跑導覽／隱私 **10組**、搜尋月曆 **11組**。其餘原生套件未全數重跑，完整Node中的相關回歸均有執行。

## 兩種更新／離線演練

真實來源`127.0.0.1:63196`使用本輪保存的0.26.9完整web資源→實際0.26.10；合成來源`127.0.0.1:63197`則使用實際預覽模式0.26.10→測試0.26.11。控制頁分別帶`scenario=release`／`scenario=synthetic`，對外結果明列種類。真實舊版來源的SHA-256清單保存在本輪證據目錄，非僅改版本字串。

兩種情境均實際通過：

1. 正常安裝，兩個舊產品分頁由舊worker控制，保留未送出草稿；HTTP頁面／worker符合舊預期。
2. 新版缺Chart.js，安裝失敗，無不完整等待快取，舊頁／草稿／帳本／備份不變；HTTP新版標記與cache符合新版情境，並非根本沒換版本。
3. 完整下載新版，兩頁仍保留舊版與草稿；只關閉一頁仍等待。
4. 關閉最後舊頁後自然啟用，無skipWaiting或強制重新整理。
5. 先核對20資源，再核對命令列只停止本輪擁有的隨機來源代理。停服後新開同網址產品頁，真實情境顯示0.26.10、合成情境顯示0.26.11；20靜態資源、25類完整原始列／metadata／完整備份及兩個偏好鍵不變。
6. 在停服後真實候選頁實際開啟隱私說明，確認新定位與未加密／下載檔風險文字可見；再次核對資料、metadata、偏好及備份仍不變。

SW產品策略、scope、20項資源URL、等待與草稿保護未變；只有cache名稱升0.26.10。資料純說明／測試情境整理沒有帳本遷移步驟。

## 檔案、證據與未驗證項目

本輪檔案：`tests/local_first_version_scenarios.mjs`、`tests/test_local_first_version_scenarios.mjs`、`tests/test_local_first_preview_versions.mjs`、`tests/local_first_preview.mjs`、`tests/local_first_update_browser.mjs`及.html、`tests/local_first_offline_settings_browser.mjs`、`tests/test_local_first_offline.mjs`、`tests/test_local_first_update_status.mjs`、`THIRD_PARTY_LICENSES.md`、`web/index.html`、`web/sw.js`、`README.md`、`CHANGELOG.md`、本文件。其餘原有未提交路徑保留。

原始證據位於忽略目錄`.tmp/f04-f05-20261015/`：initial.json與原17檔副本、baseline web及baseline-sha256.json、units.log、static-security.log、checks.json、native-results.json、offline-results.json、final-preservation.json及畫面。這些都是程式或本輪合成測試證據，不帶入產品，不含使用者帳本。

尚未驗證普通Chrome／Edge設定檔、實體手機／讀屏、真正斷網、實體加密檔復原、固定8768與Windows滑鼠雙擊、使用者手測；不把先前未完成驗收改記為通過。不操作正式帳本、Token、.env、使用者備份，沒有停止既有服務或修改原DiscordBOT。沒有stage／commit／push／PR／tag，等待使用者驗收，不開始部署或重構。

## 使用者另行手測

保留未送出草稿，另行安排使用新普通瀏覽器設定檔與合成資料。雙擊`C:\Users\User\Desktop\日餘\start_local_first.local.cmd`；8768被占用時不停止其他程序。等待完整下載，關閉同來源全部舊頁後重開確認0.26.10；檢查設定的隱私／備份說明及原記帳流程。關閉自己啟動的服務後同網址離線重開，核對合成帳目與偏好。加密備份仍須自行確認實體檔與另一空白設定檔復原；本輪未完成這項，不以下載要求代替檔案復原。使用者不需輸入Node指令。
