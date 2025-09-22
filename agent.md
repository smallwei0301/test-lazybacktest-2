# Lazybacktest 整體診斷與暖身治理手冊（版本 LB-GUIDE-20250610A）

## 背景
Lazybacktest 主要服務台灣用戶，流量集中在台灣上市櫃股票回測。主流程包含：
1. 主執行緒依策略參數計算暖身（lookback）區間與資料抓取起點。
2. Web Worker 依暖身區間向 Proxy 取得逐月股價，合併快取並執行回測。
3. 前端 UI 以使用者起始日切片顯示績效、價格表與指標值。

近期多次除錯集中在「暖身與快取治理」與「買入持有基準」：若暖身日期、月度 coverage 或快取 key 不一致，會導致 2330 等熱門股票出現首日資料缺漏、進場訊號延後，甚至錯誤將 9/23 等日期視為回測起點。本手冊彙整既有 adjusted price 指南與最新暖身治理經驗，協助後續 AI 工程師快速定位並複製修正。

## 常見症狀、根因與處置
| 症狀 | 可能根因 | 必要處置 | 可複製作法 |
| --- | --- | --- | --- |
| **使用者設定 9/01，但圖表從 9/23 起算** | 月度 coverage 曾被標記完整，`computeMissingRanges` 認定 9/01~9/20 無缺口；快取 key 未帶緩衝起點；一鍵回測先寫入殘缺月度 | 重新以暖身起點重建 coverage，強制補抓缺口，快取 key 納入 `dataStartDate`；於主執行緒檢查快取首筆是否落後使用者起點 7 日 | 使用 `shared-lookback` 提供的 `resolveDataWindow` 計算 `dataStartDate` 與 `effectiveStartDate`，Worker `fetchStockData` 依緩衝起點取用快取；`mergeIsoCoverage` 僅在 `fetchedRange` 就緒時合併 |
| **買入持有首日報酬非 0%，或報酬日期落後 7 天以上** | Buy & Hold 以資料摘要/暖身起點作為基準，而非使用者區間首筆有效收盤 | 先鎖定使用者起點後七日內第一筆有效收盤作為基準；若落後仍超過寬限，將報酬曲線歸零並輸出警示 | Worker 計算 `firstValidPriceIdxBH` 時帶入 `effectiveStartDate`、`BUY_HOLD_TOLERANCE_DAYS`；回傳診斷記錄缺口與警示 |
| **均線／指標顯示「不足」，策略首日無訊號** | 暖身天數未涵蓋最長指標視窗（MA60、MACD、ATR 等） | 建立共用最大指標週期計算，所有入口（主執行緒、批量優化、建議面板）統一採用 | `shared-lookback.getMaxPeriod` 支援 MA、MACD (`longPeriod + signalPeriod`)、KD (`kPeriod + dPeriod`)、ATR (`atrPeriod`) 等；`resolveLookbackDays` 加上最小樣本與緩衝天數 |
| **價格表缺少指標值或倉位狀態** | Worker 未保留暖身序列或指標欄位未帶入前端 | 回測後保留 `priceIndicatorSeries` 與 `positionStates`，前端彈窗動態插入欄位，未達標顯示「不足」 | Worker 端 `buildIndicatorColumns` 整併輸出；主執行緒以 `effectiveStartDate` 切片後渲染表格 |
| **調整後價格錯誤或除權息缺失** | Netlify Function 未正確解析 FinMind 資料、或 Worker 再次乘以係數 | 依舊參照「價格備援指引」的流程檢查 `dividendDiagnostics`、`debugSteps` | 參考下方「價格還原治理」章節 |

## 診斷流程建議
1. **確認暖身推算**：使用 `shared-lookback` 中的 `traceLookbackDecision(params)`（可加 log）觀察：
   - 最長指標視窗（`maxPeriod`）
   - 最小樣本數（`minSamples`）
   - 緩衝天數、最終 `dataStartDate`
2. **檢視主執行緒日誌**：
   - `runBacktestInternal` 會輸出快取首筆日期與七日容忍檢查結果。
   - 若放棄快取，確認 `fetchStockData` 是否帶入緩衝起點。
3. **檢查 Worker 訊息**：
   - `fetchStockData` 會記錄每個月份是否偵測 coverage 缺口、是否強制補抓。
   - `runStrategy` 前應輸出 `Strategy date range`（使用者區間）與 `B&H date range`（買入持有首筆）。
   - 若 `B&H date range` 落後，回頭檢查該月份 coverage 是否重建失敗。
4. **檢視 UI 測試卡片**：
   - 確認「資料暖身診斷」的 `暖身起點`、`第一筆>=使用者起點`、`第一筆有效收盤` 是否同步。
   - 若無法判定問題來源，於卡片新增所需欄位（例如 `coverageDebug`, `forceReloadSource`），協請使用者截圖。
5. **價格還原檢查**：沿用舊版指引：確認 `summary.priceSource`、`dividendDiagnostics`、`debugSteps`、`adjustmentRatio`。

## 開發與溝通準則
- **禁止硬編碼股票或日期**：所有緩衝起點、容忍天數、快取 key 需由工具函式推算與參數驅動。
- **版本代碼管理**：每次調整需指定版本碼（如 `LB-COVERAGE-RECOVERY-YYYYMMDDX`），並同步更新 `log.md` 與本文件。
- **快取設計原則**：
  - 快取 key 組成至少包含 `stockNo`、`dataStartDate`、`splitAdjustment` 等旗標。
  - 月度 coverage 僅在確認取得資料筆數 > 0 時更新。
  - 儲存完整暖身資料，切片於顯示層處理，避免覆蓋舊快取。
- **測試要求**：
  - 進行任務時需以實際 Proxy 資料回測至少一次，確保 console 無錯誤。（若環境無法連線，需在 PR 說明中註明限制與手動測試計畫）
  - 回測案例需涵蓋長短周期指標（如 MA5/MA60、MACD 12-26-9、ATR 20）、買入持有、以及常見標的（2330、2412、0050 等）。
- **溝通建議**：
  - 問題未明時，請主動於 UI 測試卡片放入需要的診斷欄位與操作步驟，方便使用者手動測試。
  - 對外說明時，提醒使用者截圖「資料暖身診斷 + console log」，可快速對照快取與暖身狀態。

## 價格還原治理（沿用既有指引）
- **來源檢查**：確認 `summary.priceSource`、`dividendSource`、`splitSource`。
- **事件解析**：若 `dividendEvents.length = 0`，需檢查別名或 0 金額；若存在但 `skipped`，檢查 `adjustmentRatio` 是否合理。
- **Worker 運算**：僅在 `rawClose` 上乘上還原因子，避免重複套用。
- **除錯訊息**：保持 `dividendDiagnostics.zeroAmountSamples`、`responseLog`、`debugSteps` 顯示在測試卡片。

## 可複製流程與檢查清單
1. **需求確認表**：列出資料來源、旗標、快取 key、暖身需求、UI 呈現、測試案例。
2. **暖身/快取迭代**：
   - 使用 `shared-lookback` 重新計算 lookback。
   - 透過單元測試或 `node` 腳本驗證極值計算、指標對齊位置。
   - 回填 `log.md` 與測試紀錄。
3. **診斷輸出模板**：於 Worker 維持一致的 `datasetDiagnostics`、`coverageSummary`、`buyHoldCheck` 格式。
4. **雙軌驗證**：
   - 實際回測確認 console 無錯誤並截圖。
   - 若 Proxy 不可用，記錄替代驗證步驟（例如本地模擬或既有快取重播）。
5. **版本追蹤**：
   - 發佈改動時更新 `log.md` 版本章節與重點。
   - 在 PR 說明中列出影響範圍、測試結果與已知限制。

依循以上流程，能確保 2330 等熱門標的在使用者設定起始日後的第一個有效交易日即觸發策略與買入持有曲線，同時維持價格還原與指標顯示的一致性，降低回測落差再次發生的機率。
