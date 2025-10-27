# Lazybacktest 策略 Composer 任務追蹤（版本 LB-STRATEGY-COMPOSER-20250720A）

## 階段 5｜策略 DSL 與 Composer
- [x] 盤點既有策略插件介面與 `StrategyPluginContract` 約束。
- [x] 定義 DSL 結構（PLUGIN/AND/OR/NOT）與 `buildComposite(json, registry)` 解析器。
- [x] 建立純函式化的 Composer 模組並提供單元測試覆蓋 AND/OR/NOT、停損傳遞、runtime 參數。

## 階段 6｜回測核心導入 Composer
- [x] 在 Worker 以 `buildComposite` 生成多空進出場規則函式並接軌既有倉位管理。
- [x] 維持暖身流程、資料快取與停損停利治理，僅替換訊號來源。
- [x] 回傳策略 Meta 與指標診斷時合併 DSL 組合資訊，確保 UI 與日志維持一致。
- [x] `BacktestRunner` 支援傳遞 JSON DSL（字串／物件）並保留相容舊參數。

## 階段 7～10 預備流程
- [ ] 階段 7：定義策略 Composer 的參數表單與 UI 積木流程，建立 DSL 與 UI 的雙向綁定草稿。
- [ ] 階段 8：回測結果面板擴充，顯示複合策略來源、組合診斷與子規則觸發狀態。
- [ ] 階段 9：Worker/主執行緒診斷卡整合 DSL 來源，提供手動檢驗按鈕與輸出截圖腳本。
- [ ] 階段 10：策略 Sandbox 規劃，將 Composer 與批量優化、Walk-Forward 流程打通並撰寫測試腳本。

> 備註：每完成一階段需更新本清單與 `log.md`，並安排 Netlify 實機回測確認 console 無錯誤。
