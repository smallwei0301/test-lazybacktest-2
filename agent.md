# Lazybacktest 調整股價備援指引（版本 LB-GUIDE-20240520A）

## 背景
Lazybacktest 的上市櫃股價備援流程，需透過 Netlify Function `calculateAdjustedPrice` 取得原始 OHLC、FinMind 配息資料與還原因子，並回傳至 Web Worker 進行區間快取與回測。過往長期出現「有效還原事件為 0、價格未調整」的情況，造成多次往返除錯。以下整理已驗證的根本原因與對應解法，供後續 AI 協作者快速判斷並提出建議。

## 常見問題與根因
| 症狀 | 根本原因 | 必要處置 |
| --- | --- | --- |
| 有效還原事件為 0，價格仍為原始值 | `TaiwanStockDividendResult` 欄位解析失敗（全形、百分號、別名），或僅有 0 金額 | 確認 `before_price`、`after_price`、`stock_and_cache_dividend` 皆成功轉為數值，略過零金額紀錄並保留快照於 `dividendDiagnostics` |
| 備援係數 = 1，未套用還原因子 | Worker 端對已還原價格再乘以係數、或缺少 `rawClose` 基準值 | 確保 Netlify 回傳 `rawOpen/rawClose`，Worker 僅以原始價格乘上調整係數，並在 `summary` 標記來源 |
| FinMind 查詢成功但仍無事件 | 事件日期超出查詢範圍或未對齊股價日期 | 將股價查詢範圍向前延伸 540 天並濾除不在價格區間的事件 |
| 備援 API 502/504 | 單次請求時間過長或拆分策略不足 | 針對價格與股利皆使用可重試的日期分段佇列、設定冷卻時間、回傳 `responseLog` |
| UI 難以辨識錯誤來源 | 未揭露 `debugSteps`、零金額欄位、FinMind 狀態 | 回傳 `debugSteps`、`dividendDiagnostics.zeroAmountSamples`、`finmindStatus` 並於前端呈現 |

## 建議診斷流程
1. **檢查來源摘要**：確認 `summary.priceSource`、`dividendSource` 是否如預期（TWSE/FinMind）。
2. **檢視 `debugSteps`**：若在 `applyAdjustments` 前就標記為 `skipped`，需回到事件彙總確認係數。
3. **分析 `dividendEvents`**：
   - 若 `events.length = 0`，多為 FinMind 資料未成功解析；檢查 `dividendDiagnostics.zeroAmountSamples` 與欄位別名。
   - 若事件存在但被標記 `skipped`，檢查 `adjustmentRatio` 是否偏離 0~1 或缺少對應收盤價。
4. **確認 Worker 補救邏輯**：確保 `maybeApplyAdjustments` 以 `rawClose` 乘上比率，並在無係數時重新以事件推回。
5. **若為 HTTP 502/504**：比對 `responseLog` 的日期範圍與狀態碼，必要時降低分段大小並重試。

## 開發與對話準則
- **提出假設前先蒐集證據**：請先檢視 Netlify 回傳的 `summary`、`dividendDiagnostics`、`debugSteps`，再推論問題。
- **避免重複修補**：任何想調整的演算法須對照 log.md 既有修復紀錄，確認是否已解決同樣問題。
- **同步更新版本代碼**：若修改 Netlify 或 Worker 邏輯，記得提升版本號（如 `LB-ADJ-COMPOSER-YYYYMMDDX`）並在 log.md 記錄。
- **測試重點**：
  - 以實際有除息資料的上市與上櫃股票進行回測比對。
  - 確認前端價格檢視器顯示的還原因子與交易紀錄一致。
  - 確保沒有使用假資料或硬編碼 Token。
- **溝通建議**：若仍無法定位原因，整理「來源摘要、debugSteps、dividendDiagnostics、回測價格」四項資訊再向開發者提問，可大幅縮短往返時間。若開發者無法找出明確問題,請在目前的UI上面使用測試內容卡片,所有必要的log記錄在卡片上, 讓開發者可以用手動測試的方式, 逐步找出問題點發生在哪裡. 

## 後續維護建議
- 建議保留 `log.md` 的修補歷史並定期整理；新增問題時請記錄症狀、根因、處置與測試。
- 若需新增測試檔，務必在任務結束時確認是否仍需保留，避免測試用資料遺留在主分支。