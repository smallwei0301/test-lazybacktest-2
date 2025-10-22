# LB-PLUGIN-ROLLUP-20250701A — 現況盤點與暖身基準鎖定

## 1. 模組依賴概覽
- **主執行緒（`js/backtest.js`）**：透過 `lazybacktestShared` 取得 `resolveDataWindow`、`computeBufferedStartDate` 等共用暖身工具，先計算資料視窗後再建立 `worker.js`。核心函式 `runBacktestInternal` 會補齊 `effectiveStartDate`、`dataStartDate`、`lookbackDays`，並管理資料快取與 Worker 訊息。【F:js/backtest.js†L4563-L4680】
- **Web Worker（`js/worker.js`）**：以 `importScripts('shared-lookback.js')` 載入共用暖身模組，於 `self.onmessage` 入口統一決定 `lookbackDays`、`dataStartDate` 與 `effectiveStartDate`，再交給回測核心計算策略結果與指標序列。【F:js/worker.js†L15-L18】【F:js/worker.js†L11507-L11588】
- **共用暖身模組（`js/shared-lookback.js`）**：提供 `resolveDataWindow`、`resolveLookbackDays`、`computeBufferedStartDate` 等工具，並輸出最小暖身樣本數與緩衝天數，供主執行緒與 Worker 共用。【F:js/shared-lookback.js†L1-L347】

以上關係可概括為：`backtest.js` 先決定暖身視窗 → 封包參數給 `worker.js` → `worker.js` 再以相同工具確認暖身設定並執行策略 → 透過 `postMessage` 回傳結果與指標，最終在主執行緒顯示。

## 2. 策略入口、暖身計算與指標輸出
### 2.1 主執行緒 (`js/backtest.js`)
- `runBacktestInternal` 先取得策略參數、呼叫 `resolveDataWindow` 推導最大指標週期與 `lookbackDays`，必要時回退至 `resolveLookbackDays` 或 `estimateLookbackBars`；若仍缺資料則以 `computeBufferedStartDate` 回推暖身起點，最後寫回 `params` 並計算快取 key。【F:js/backtest.js†L4563-L4680】【F:js/backtest.js†L4620-L4653】
- 接收 Worker 回傳的 `priceIndicatorSeries` 後，`handleBacktestResult` 會把資料存入 `lastIndicatorSeries`，並在價格檢視器中借由 `collectPriceInspectorIndicatorColumns` 依策略別動態插入欄位。【F:js/backtest.js†L6191-L6240】【F:js/backtest.js†L5884-L5901】

### 2.2 Web Worker (`js/worker.js`)
- `self.onmessage` 是主要入口，先使用 `resolveDataWindow` 與相關 fallback 決定 `lookbackDays`、`effectiveStartDate`、`dataStartDate`，再將結果回寫至 `params`，確保回測核心與快取一致。【F:js/worker.js†L11507-L11588】
- 回測完成後會呼叫 `sliceIndicatorDisplay` 把暖身區段裁切為使用者可見範圍，並以 `priceIndicatorSeries` 與 `positionStates` 回傳主執行緒；資料同時用於多空分段指標與倉位顯示。【F:js/worker.js†L7395-L7465】【F:js/worker.js†L10238-L10429】

### 2.3 共用暖身模組 (`js/shared-lookback.js`)
- `resolveDataWindow` 會先透過 `resolveLookbackDays` 推導最大指標週期、樣本數與暖身天數，再搭配 `computeBufferedStartDate` 回推實際抓取範圍，輸出 `dataStartDate` 與 `effectiveStartDate` 供前述流程使用。【F:js/shared-lookback.js†L159-L278】

## 3. `resolveDataWindow` 使用紀錄
| 模組 | 呼叫情境 | 目的 |
| --- | --- | --- |
| `js/backtest.js` | `runBacktestInternal` 在送出 Worker 前計算暖身視窗與快取 key。 | 確保主執行緒抓取資料與快取都使用相同的 `dataStartDate` 與 `lookbackDays`。【F:js/backtest.js†L4563-L4653】 |
| `js/main.js` | 今日建議 (`getSuggestion`) 產生回測請求時重用同一套暖身推導，避免 Worker 收到與實際顯示不同的視窗。 | 與主回測一致化資料起點與暖身設定。【F:js/main.js†L3950-L3999】 |
| `js/batch-optimization.js` | `enrichParamsWithLookback` 在批量優化排程前補齊 `lookbackDays` 與 `dataStartDate`。 | 讓所有批次任務共用一致的暖身視窗與緩衝設定。【F:js/batch-optimization.js†L1465-L1515】 |
| `js/rolling-test.js` | 滾動測試建立訓練視窗時，先用 `resolveDataWindow` 決定暖身與緩衝，再裁切資料。 | 避免逐窗訓練提早看到未暖身資料，確保視窗切換一致。【F:js/rolling-test.js†L2796-L2840】 |
| `js/worker.js` | `self.onmessage` 入口重算並覆寫 `params`，同時處理 fallback。 | Worker 端最終決定抓取視窗與暖身天數，維持與主執行緒一致。【F:js/worker.js†L11507-L11588】 |

## 4. `priceIndicatorSeries` 使用紀錄
| 流程階段 | 生成／使用點 | 說明 |
| --- | --- | --- |
| Worker 計算 | `buildIndicatorDisplay` 針對長短倉進出策略組出指標欄位，再透過 `sliceIndicatorDisplay` 依使用者起點裁切。 | 確保回傳資料只包含暖身後區段，並附帶欄位標籤與格式資訊供前端呈現。【F:js/worker.js†L7395-L7465】【F:js/worker.js†L10238-L10429】 |
| 主執行緒接收 | `handleBacktestResult` 把 Worker 回傳的 `priceIndicatorSeries` 存入 `lastIndicatorSeries`，供 UI 使用。 | 維護最新回測結果的指標序列，讓價格檢視器可以動態顯示策略指標與狀態。【F:js/backtest.js†L6191-L6234】 |
| UI 呈現 | `collectPriceInspectorIndicatorColumns` 依策略別整理欄位，價格檢視器再逐列渲染數值或「不足」提示。 | 透過欄位定義決定表格結構，將 `priceIndicatorSeries` 轉為使用者可讀的指標明細。【F:js/backtest.js†L5884-L5932】 |

## 5. 測試執行紀錄
- 嘗試在容器環境以 `netlify dev` 或對應瀏覽器啟動本地回測，但因無圖形環境與外部 Proxy（2330/2412/0050 需走 Netlify Functions）而無法完成操作；後續需在具備瀏覽器與 Proxy 存取權的本機環境實測並截取 console log。
