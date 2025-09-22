# Lazybacktest 綜合診斷、暖身與價格治理手冊（版本 LB-GUIDE-20250610B）

## 背景與適用範圍
Lazybacktest 部署於 Netlify，主要服務台灣上市櫃與 ETF 回測，每日瀏覽量約 1 萬、活躍用戶約 6,000。核心流程如下：
1. **主執行緒** 依策略參數計算暖身（lookback）天數與資料抓取起點，建立 Worker 訊息並維護快取。
2. **Web Worker** 依暖身起點向 Proxy 逐月取得股價，合併月度 coverage，執行指標與回測邏輯，回傳診斷。
3. **前端 UI** 以使用者起始日切片顯示績效、價格表、指標值與倉位狀態，並提供測試卡片協助除錯。

文件整合「調整股價備援指引（LB-GUIDE-20240520A）」、後檢經驗（LB-POSTMORTEM-20240522A）與近期暖身/快取治理、買入持有修正、指標暖身等調整，供後續 AI 工程師快速定位問題與複製修復流程。

---

## 1. 共用工具與資料路徑
- **shared-lookback 模組**：
  - `getMaxPeriod` 涵蓋 MA、MACD（`longPeriod + signalPeriod`）、KD（`kPeriod + dPeriod`）、ATR、布林、動量等指標。
  - `resolveLookbackDays`/`resolveDataWindow` 會套用最小樣本數、額外緩衝天數與交易日回推，輸出 `dataStartDate`（暖身起點）與 `effectiveStartDate`（使用者起點）。
  - `traceLookbackDecision(params)` 可輸出最大指標週期、需求樣本、實際天數、迴圈推算過程，供 debug。
- **ISO ↔ UTC 工具**：主執行緒以 `parseISODateToUTC` 轉換使用者輸入，判斷快取首筆是否落後超過七天；Worker 使用 `isoToUTC`/`utcToISO` 重建 coverage。
- **快取 key 原則**：至少包含 `stockNo`、`dataStartDate`、`splitAdjustment` 等旗標，避免不同暖身需求互相覆蓋。

---

## 2. 暖身、快取與買入持有治理
| 症狀 | 可能根因 | 必要處置 | 可複製作法 |
| --- | --- | --- | --- |
| **使用者設定 9/01，但圖表從 9/23 起算** | 月度 coverage 曾被標記完整，`computeMissingRanges` 認定 9/01~9/20 無缺口；快取 key 未帶 `dataStartDate`；一鍵回測先寫入殘缺月度 | 重建 coverage 並強制補抓缺口，快取 key 納入緩衝起點；主執行緒檢查快取首筆是否落後使用者起點 7 日 | `shared-lookback.resolveDataWindow` 計算 `dataStartDate`/`effectiveStartDate`；Worker `fetchStockData` 依緩衝起點取用快取；`mergeIsoCoverage` 僅在 `fetchedRange` 就緒時合併 |
| **買入持有首日報酬非 0% 或晚於 7 天以上** | Buy & Hold 以暖身起點或資料摘要作為基準，而非使用者區間第一筆有效收盤 | 鎖定使用者起點後七日內第一筆有效收盤為基準；若仍落後，將報酬曲線歸零並輸出警示 | Worker 計算 `firstValidPriceIdxBH` 時帶入 `effectiveStartDate` 與 `BUY_HOLD_TOLERANCE_DAYS`；診斷回傳缺口資訊 |
| **均線／指標顯示「不足」，策略首日無訊號** | 暖身天數未涵蓋最長指標視窗（如 MA60、MACD、ATR） | 建立共用最大指標週期計算並全線導入 | 透過 `shared-lookback.getMaxPeriod` + `resolveLookbackDays`，在主執行緒、批量優化、建議面板統一採用 |
| **價格表缺少指標值或倉位狀態** | Worker 未保留暖身序列或指標欄位未回傳前端 | 回測後保留 `priceIndicatorSeries` 與 `positionStates`，前端依使用者起點切片，未達標顯示「不足」 | Worker `buildIndicatorColumns` 整併輸出；UI 動態插入欄位 |

### 診斷與操作流程
1. **確認暖身推算**：
   - 在主執行緒或 node 腳本呼叫 `traceLookbackDecision`，取得 `maxPeriod`、`minSamples`、`bufferDays`、`dataStartDate`。
2. **檢視主執行緒日誌**：
   - `runBacktestInternal` 輸出快取首筆日期與七日容忍檢查結果；若放棄快取，確認送往 Worker 的 `dataStartDate`。
3. **檢查 Worker 訊息**：
   - `fetchStockData` 會紀錄月度 coverage 缺口、強制補抓來源、`lastForcedReloadAt`。
   - `runStrategy` 前輸出 `Strategy date range`（使用者區間）與 `B&H date range`（買入持有起訖）。若 B&H 落後，回查 coverage。
4. **使用 UI 測試卡片**：
   - 確認「資料暖身診斷」中的 `暖身起點`、`第一筆>=使用者起點`、`第一筆有效收盤` 是否一致。
   - 需更多資訊時，於卡片加入 `coverageDebug`、`forceReloadSource` 等欄位並請使用者截圖。
5. **測試要求**：
   - 實機回測至少涵蓋 2330、2412、0050 等，包含長短週期指標與買入持有。
   - 若 Proxy 不可用，於 PR 或 log.md 註明限制與後續實測計畫。

---

## 3. 指標暖身與價格表呈現
- Worker 保留完整暖身序列計算指標，回傳後依 `effectiveStartDate` 切片再顯示。
- 價格明細彈窗：
  - 表頭保持既有佈局，動態插入使用者策略的指標欄位與倉位狀態（進場、持有、出場、空單等）。
  - 未達計算標準時顯示「不足」。
- `computeRollingExtrema`/追蹤停損等演算法已重新對齊視窗，確保暖身結束即產生訊號。

---

## 4. 調整股價備援指引（延續 LB-GUIDE-20240520A）

### 常見問題與根因
| 症狀 | 根本原因 | 必要處置 |
| --- | --- | --- |
| 有效還原事件為 0，價格仍為原始值 | `TaiwanStockDividendResult` 欄位解析失敗（全形、百分號、別名），或僅有 0 金額 | 確認 `before_price`、`after_price`、`stock_and_cache_dividend` 成功轉為數值，略過零金額並保留快照於 `dividendDiagnostics` |
| 備援係數 = 1，未套用還原因子 | Worker 端對已還原價格再乘以係數、或缺少 `rawClose` 基準值 | 確保 Netlify 回傳 `rawOpen/rawClose`，Worker 僅以原始價格乘上調整係數，並在 `summary` 標記來源 |
| FinMind 查詢成功但仍無事件 | 事件日期超出查詢範圍或未對齊股價日期 | 將股價查詢範圍向前延伸 540 天並濾除不在價格區間的事件 |
| 備援 API 502/504 | 單次請求時間過長或拆分策略不足 | 針對價格與股利皆使用可重試的日期分段佇列、設定冷卻時間、回傳 `responseLog` |
| UI 難以辨識錯誤來源 | 未揭露 `debugSteps`、零金額欄位、FinMind 狀態 | 回傳 `debugSteps`、`dividendDiagnostics.zeroAmountSamples`、`finmindStatus` 並於前端呈現 |

### 建議診斷流程
1. **檢查來源摘要**：確認 `summary.priceSource`、`dividendSource` 是否如預期（TWSE/FinMind）。
2. **檢視 `debugSteps`**：若在 `applyAdjustments` 前標記 `skipped`，需回到事件彙總確認係數。
3. **分析 `dividendEvents`**：
   - 若 `events.length = 0`，多為 FinMind 資料解析失敗，檢查 `dividendDiagnostics.zeroAmountSamples` 與欄位別名。
   - 若事件存在但為 `skipped`，檢查 `adjustmentRatio` 是否偏離 0~1 或缺少對應收盤價。
4. **確認 Worker 補救邏輯**：確保 `maybeApplyAdjustments` 以 `rawClose` 乘上比率，必要時重新推回事件。
5. **HTTP 502/504**：比對 `responseLog` 日期與狀態碼，調整分段大小與冷卻時間。

### 開發與對話準則（價格還原）
- 提出假設前先蒐集 `summary`、`dividendDiagnostics`、`debugSteps` 等證據。
- 調整演算法需對照 `log.md` 既有紀錄，避免重複修補。
- 修改 Netlify 或 Worker 邏輯時同步提升版本號（如 `LB-ADJ-COMPOSER-YYYYMMDDX`）。
- 測試包含：有除息／拆分標的回測、價格檢視器比對、確保無假資料或硬編碼 Token。
- 若仍無法定位原因，蒐集「來源摘要、debugSteps、dividendDiagnostics、回測價格」四項資訊，並於 UI 測試卡片提供，縮短往返。

---

## 5. Lazybacktest AI 開發後檢討（LB-POSTMORTEM-20240522A）

### 本次發生的問題概述
- **拆分還原因子未套用到價格區間**：雖成功抓到 `TaiwanStockSplitPrice`，但價格區間仍僅使用股息還原因子。
- **UI 選項狀態不同步**：拆分還原勾選框一度被鎖定或未同步，使用者無法啟用。
- **診斷資訊不足**：缺乏 debug log 與測試卡片說明，定位拆分係數遺失耗時。

### 重複發生的問題與潛在根因
- 資料管線旗標遺漏，顯示未建立完整 E2E 路徑檢查。
- 事件合併邏輯不一致，拆分加入後未同步更新。
- 測試範圍不足，未覆蓋「拆分 + 除權息」情境。

### 改善策略與有效作法
- 建立全流程旗標檢查清單：UI → Main Thread → Worker → API → Cache → 測試呈現。
- 統一調整係數計算模組，於 `normaliseCombinedAdjustments` 輸出表格診斷。
- 擴充自動化測試與 debug log，於 UI 顯示「手動比率、前後價格、合併因子」。

### 本次學到的經驗
- 旗標與快取版本需同步思考，並規劃 invalidation。
- 診斷資訊即文件，結構化 log 能降低溝通成本。
- 前端交互需搭配資料流 Scenario Test 驗證。

### 讓經驗可複製的流程
1. **需求確認表**：列出資料來源、旗標、快取 key、UI 互動、測試案例，開發前勾選。
2. **標準化診斷輸出**：維持 `adjustmentDebugLog`、`adjustmentChecks` 格式，擴充時僅新增來源。
3. **自動化測試模板**：整理拆分、除權息、混合、不同資料源 fallback 案例為模板。
4. **版本代碼管理**：每次更新發佈版本代碼（如 `LB-SPLITFIX-20240520`）並在變更紀錄標注影響範圍。
5. **雙軌驗證流程**：前端完成後必須實際回測一次並記錄 console，再搭配單元測試。

---

## 6. 開發與溝通準則（總覽）
- **禁止硬編碼股票或日期**：緩衝起點、容忍天數、快取 key 需由工具推算與參數驅動。
- **版本代碼管理**：每次調整指定版本碼（如 `LB-COVERAGE-RECOVERY-YYYYMMDDX`、`LB-WARMUP-SIGNAL-20250531A`），同步更新 `log.md` 與本文件。
- **快取設計原則**：
  - 快取 key 至少含 `stockNo`、`dataStartDate`、`splitAdjustment` 等旗標。
  - 月度 coverage 僅在取得資料筆數 > 0 時更新，並記錄 `lastForcedReloadAt`。
  - 儲存完整暖身資料，顯示層再切片，避免覆蓋舊快取。
- **測試與驗證**：
  - 實際 Proxy 回測，確保 console 無錯誤；若環境受限，需說明後續手動驗證計畫。
  - 回測案例須涵蓋長短周期指標、買入持有、熱門與冷門標的。
- **溝通建議**：
  - 問題未明時，在測試卡片放入需要的診斷欄位與操作步驟。
  - 對外說明時，請使用者提供「資料暖身診斷 + console log」截圖以加速定位。

---

## 7. 可複製流程與檢查清單
1. **需求確認表**：列出資料來源、旗標、快取 key、暖身需求、UI 呈現、測試案例。
2. **暖身/快取迭代**：
   - 使用 `shared-lookback` 重新計算 lookback。
   - 透過單元測試或 `node` 腳本驗證指標對齊與極值位置。
   - 回填 `log.md` 與測試紀錄。
3. **診斷輸出模板**：保持 Worker 的 `datasetDiagnostics`、`coverageSummary`、`buyHoldCheck` 格式一致。
4. **雙軌驗證**：
   - 實際回測確認 console 無錯誤並截圖。
   - Proxy 無法存取時，記錄替代驗證（本地快取重播等）。
5. **版本追蹤與溝通**：
   - 發佈改動時更新 `log.md` 版本章節與重點，PR 說明列出影響範圍、測試結果、已知限制。
   - 若測試後仍有疑慮，主動提供手動驗證腳本或操作指引。

---

依循上述指引，能確保在使用者設定起始日後的第一個有效交易日即觸發策略與買入持有曲線，並維持調整後價格、快取治理與指標呈現一致；面對 2330 等熱門標的亦能迅速找出 coverage 缺口、資料還原異常與旗標遺漏。是否還有想補強的情境或範本需要一併納入？

## 8. 後續維護建議
- 建議保留 `log.md` 的修補歷史並定期整理；新增問題時請記錄症狀、根因、處置與測試。
- 若需新增測試檔，務必在任務結束時確認是否仍需保留，避免測試用資料遺留在主分支。

