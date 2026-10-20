# 專案內UI／UX Skills安裝紀錄

日期：2026-10-17。只安裝及非破壞性驗證，不做設計或產品修改；產品版本維持0.26.11。

## 起點與範圍

- 專案：`C:\Users\User\Desktop\日餘`。
- 分支：`codex/daymargin-split`；起點HEAD：`49883e27d8e09e76ce383c0800e78423aef8be80`；起點工作樹／暫存區乾淨。
- 專案原無`.agents`、`.codex`、`.claude`或這兩套Skills；既有使用者Skills／插件快取未找到同名manifest。
- 安裝到專案`.agents/skills`，不安裝至使用者或系統目錄。不修改AGENTS、Hooks、Codex設定、Node／Python安裝、PATH或Git設定。
- 安裝前核對兩個官方GitHub的README；Codex專案Skill位置與辨識方式另對照[官方文件](https://learn.chatgpt.com/docs/build-skills)。

## 版本、來源與內容

| 項目 | 實際來源／版本 | 專案內位置 |
|---|---|---|
| Impeccable Skill | 4.6.0，官方提交`6af45ac9a5eb8792f033d3242f52e99812fd91fa`的`.agents/skills/impeccable` | `.agents/skills/impeccable/` |
| Impeccable Windows引擎 | 官方`engine-v0.1.15`，Windows x64 | `.agents/skills/impeccable/scripts/bin/windows-x64/impeccable.exe` |
| UI UX Pro Max | 官方CLI 2.15.0產生的Codex主Skill；SKILL.md未另宣告獨立版號 | `.agents/skills/ui-ux-pro-max/` |
| 遙測設定 | 新增`{"telemetry": false}`，無Hook | `.impeccable/config.json` |

Impeccable官方62份Skill原檔與UI UX Pro Max官方CLI產生的68份主Skill／腳本／資料原檔，複製後逐檔SHA-256一致。另各保留完整LICENSE；Impeccable另新增官方Windows引擎。合計133份安裝檔案，不含本紀錄或遙測設定。

- Impeccable：[官方README](https://github.com/pbakaus/impeccable/blob/6af45ac9a5eb8792f033d3242f52e99812fd91fa/README.md)，Apache-2.0。
- 引擎：[官方Windows發行](https://github.com/pbakaus/impeccable/releases/download/engine-v0.1.15/impeccable-windows-x64.exe)，SHA-256 `981324ea15cc3c107d46b8133b5be77f639dbcd22e671f1eb7d8c69136e9693b`；與官方sidecar及GitHub release digest一致。
- UI UX Pro Max：[官方README](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/56ea9cf174ed86786187daa9de0e6247cb0747e4/README.md)，MIT。安裝器取自`https://registry.npmjs.org/ui-ux-pro-max-cli/-/ui-ux-pro-max-cli-2.15.0.tgz`。
- CLI套件SHA-512 integrity：`sha512-D0J/C40xrzzi5si6ZLtRGbEE5v3QjL7d4wJNnasmP3yfDSrGiuqVCdwQiqCNnIkbqOuVoA/uonR2o1WKXh3urw==`，下載後已核對。

## 實際安裝方式

現有環境為Codex bundled Node v24.19.0、Python 3.12.14；沒有安裝或升級npm、Python套件或系統軟體。使用絕對路徑，使用者不需輸入裸node指令。

### Impeccable

使用Codex內建Skill Installer下載官方固定提交的Codex版本至忽略的暫存目錄，再採官方README的手動複製方式，只複製該主Skill：

```powershell
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  'C:\Users\User\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py' `
  --repo pbakaus/impeccable --ref 6af45ac9a5eb8792f033d3242f52e99812fd91fa `
  --path .agents/skills/impeccable `
  --dest 'C:\Users\User\Desktop\日餘\.tmp\skill-install-20261017\impeccable-selected' `
  --method download
```

將產生的`impeccable`資料夾複製至專案`.agents/skills/`；不複製官方`.codex/hooks.json`。引擎校驗後放入launcher原生支援的相鄰`bin/windows-x64/`，無須首次啟動時寫入使用者`~/.impeccable/bin/`。未修改launcher原檔。

### UI UX Pro Max

下載、校驗並解開上述官方npm發行包到`.tmp/skill-install-20261017/package/`；不執行npm install或套件生命週期腳本。在暫存的空白`uipro-generated/`目錄執行官方已打包CLI：

```powershell
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' `
  'C:\Users\User\Desktop\日餘\.tmp\skill-install-20261017\package\dist\index.js' `
  init --ai codex --offline
```

只將產生的`.agents/skills/ui-ux-pro-max/`複製至日餘同名位置，不複製banner-design、brand、design、design-system、slides或ui-styling六個附屬Skill。主Skill資料與腳本完整保留，未編輯官方指令。

官方main分支已有`--dry-run`程式，但最新已發布CLI 2.15.0實際不支援此旗標；嘗試時回報unknown option，沒有安裝寫入。改採上述暫存產生、檢查實際輸出及選定主Skill後複製，不修改官方CLI或改用未發布版本。

## 實際驗證

- Codex本機app-server透過隔離的暫存狀態呼叫`skills/list`，指定`cwds=[日餘]`、`forceReload=true`，兩個Skill均回報`scope: repo`、`enabled: true`，`errors: []`。沒有發送模型任務、啟動設計或讀取帳本。
- 第一次辨識程序因隔離CODEX_HOME目錄尚未建立而提前結束；建立該暫存目錄後，同一介面重跑成功。沒有改使用者Codex設定。
- Impeccable實際Windows `.cmd` launcher的`engine-probe`成功，回報`impeccable-engine 0.1.15`；引擎`--help`正常。
- 在移除本次命令的遙測環境變數後，`telemetry status`明確回報因專案`.impeccable/config.json`而關閉，不僅是臨時環境變數生效。
- UI UX Pro Max `search.py --help`成功；使用通用測試詞`keyboard focus --domain ux --max-results 1 --json`回傳1筆。僅測資料搜尋，未分析日餘、產生設計或使用`--persist`。
- 主Skill資料35份CSV、4308列可讀；腳本使用既有Python標準庫，未安裝第三方Python依賴。查詢時禁止產生`__pycache__`。
- 兩套Skill名稱、安裝目錄不衝突；未安裝Hook或額外捷徑。Impeccable的4份官方嵌套agent宣告隨原Skill保留，本輪未啟動agent。
- 本輪不改產品程式、schema、備份、加密、離線快取、CSP或服務；產品測試不因純工具安裝而重跑。既有受版本控制檔案逐檔核對，只有README、CHANGELOG及第三方授權文件為本輪預期文件更新。

## 使用與限制

先在Codex開啟`C:\Users\User\Desktop\日餘`專案。這個安裝不是全域，從DiscordBOT或其他專案開啟的聊天不會因而自動取得日餘的repo Skills。

- Impeccable：`$impeccable audit`或`$impeccable critique`，並明確限制目標及唯讀／實作範圍。
- UI UX Pro Max：`$ui-ux-pro-max`搭配配色、字體、版面或規範研究的明確要求。
- Codex應在後續回合辨識新增Skills；可用`/skills`查看。若未出現，關閉並重新開啟Codex／日餘專案。尚未觀測使用者目前桌面聊天的技能選單更新。
- 不需要核准Hook：本輪沒有新增任何Hook。未執行Impeccable init／document，也沒有建立PRODUCT.md、DESIGN.md、Design System或產品初始化設定；以後只有獲得設計授權才處理。
- Impeccable與UI UX Pro Max的設計建議可能重疊；以專案及使用者規則優先，一次指定主要Skill，不讓兩套互相覆寫設計規範。
- Impeccable關閉遙測不等於完全離線。部分新設計roll功能仍會連線官方目錄服務；未來須先確認網路範圍，不將秘密、帳目、備份或個資交給工具／外部服務。
- 本輪只有引擎probe／help、遙測狀態及本機搜尋smoke test；未跑完整設計、偵測、截圖、素材生成或外部目錄功能，不能宣稱上述功能全部已實測。
- Impeccable本機引擎為Windows x64，其他架構／作業系統需另取相容官方引擎。本機工具不是日餘網站執行依賴。
- 忽略的`.tmp/skill-install-20261017/`保留官方安裝器、候選產物及驗證工具，沒有納入Git；本輪未stage、commit、push、建立PR或tag。
