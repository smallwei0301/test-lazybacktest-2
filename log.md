# Lazybacktest Debug Log

## 2025-04-02 — Patch LB-ADJ-COMPOSER-20250402A / LB-DATASOURCE-20250402A
- **Issue recap**: Netlify 還原備援雖已回傳 FinMind 還原序列，但調整事件比率可能大於 1，Worker 端因此忽略備援並維持原始股價；測試卡僅顯示整體筆數，難以判讀係數對齊與備援樣本量。
- **Fix**: 重新計算 FinMind 還原係數差，產生小於 1 的調整比率並保留前後係數、變動方向與樣本統計，同時在 API 摘要揭露備援對齊筆數與係數樣本。
- **Diagnostics**: 測試卡新增價格筆數、成功/略過事件統計、備援統計與 FinMind 係數變化說明，協助快速鎖定係數停留在 1 的原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-31 — Patch LB-ADJ-COMPOSER-20250331A / LB-DATASOURCE-20250331A
- **Issue recap**: Yahoo 測試源回傳 `formatISODateFromDate is not defined`，FinMind 備援仍回傳 0 件有效還原事件，導致回測區間係數維持 1，缺乏進一步診斷資訊。
- **Fix**: TWSE proxy 補齊 `formatISODateFromDate`，Netlify 還原函式在調整失敗時改以 FinMind 還原股價序列推導係數並回傳備援摘要，前端測試卡顯示備援狀態、彙整事件與來源標籤。
- **Diagnostics**: 測試卡新增 FinMind 彙整事件區塊、備援還原狀態與詳細步驟；單元測試覆蓋備援序列的縮放結果，確保回傳係數與來源標記正確。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-28 — Patch LB-ADJ-COMPOSER-20250328A / LB-DATASOURCE-20250328A
- **Issue recap**: FinMind 備援常回傳金額為零的除權息紀錄，導致 `dividendEvents` 為空且回測交易價維持未還原值，測試面板亦缺乏顯示 pipeline 各階段狀態與問題線索。
- **Fix**: Netlify 還原函式在所有成分均為零時保留原始欄位快照並附帶於 `dividendDiagnostics.zeroAmountSamples`，回傳 `debugSteps` 與調整事件供前端檢視。
- **Diagnostics**: 資料來源測試卡新增還原流程狀態、零金額欄位快照與前三筆調整事件摘要，可快速確認係數略過的原因與對應欄位。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-20 — Patch LB-ADJ-COMPOSER-20250320A / LB-ADJ-PIPE-20250320A
- **Issue recap**: Netlify 備援回傳的 `dividendEvents` 雖然帶出有效配息資料，但 Worker 僅依賴 `adjustments`，一旦全數被標記為 `skipped`（如僅剩除權息事件、缺少基準價或權利比率偏高），就無法啟動備援縮放，前端仍顯示原始價位且摘要看不出個別紀錄的落差。
- **Fix**: Worker 端若未取得可用 `adjustments`，會回退使用 `dividendEvents` 重新計算係數；同時在 Netlify 函式中蒐集缺少除權息日、金額為零等診斷統計，並回傳給 UI 與快取以便追蹤。
- **Diagnostics**: 資料來源測試面板新增「FinMind 事件診斷」說明，各 proxy 也輸出請求參數與月份分段資訊，遇到 502/504 時可快速比對參數是否落在預期範圍。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-12 — Patch LB-ADJ-COMPOSER-20250312A / LB-ADJ-PIPE-20250312A
- **Issue recap**: 還原股價長期顯示 0 件有效事件，回測成交價格維持原始價。追蹤 Netlify 回傳資料後確認 `cashCapitalIncrease` 與其他成分的比值公式錯誤，造成調整係數被判定為無效並全部跳過。
- **Fix**: 重新依照證交所參考價公式計算調整係數，統一 Netlify 與 Worker 的 `computeAdjustmentRatio` / `computeFallbackRatio`，並在單元測試加入混合配息、增資場景驗證。
- **Diagnostics**: Netlify 還原服務回傳 `debugSteps`，Worker 與主執行緒同步快取 `summary`、`adjustments` 與備援標記，前端新增「還原流程」步驟提示與彈窗內的除權息摘要，利於快速檢視每個階段狀態與略過原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`（新增調整係數驗證）。

> 後續若再出現無法調整的案例，先在前台檢視「還原套用」步驟的略過原因與備援標記，再對照 `log.md` 上次修復時的調整內容。
