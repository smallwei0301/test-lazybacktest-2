# Lazybacktest 策略 Composer 待辦清單（LB-STRATEGY-COMPOSER-20260916A）

## 階段 5 — 策略 DSL 與 Composer
- [x] 建立 `StrategyComposer.buildComposite` 支援 AND/OR/NOT 組合。
- [x] 為複合規則與停損/停利傳遞撰寫單元測試。
- [ ] 研擬 UI/開發者模式的 DSL 編輯器與即時驗證（預計階段 7 導入）。

## 階段 6 — 回測核心改用 Composer
- [x] Worker 端以 `buildComposite` 生成多空進出場函式並套入回測主迴圈。
- [x] 確認倉位管理（單一進場、不加碼、停損停利）保持獨立，僅透過複合訊號驅動。
- [ ] 於開發者手動驗證按鈕導入 DSL 驗證流程，覆蓋多檔回測與資料暖身診斷。

## 階段 7 — 策略 Sandbox 與 DSL 編輯器
- [ ] 建立可視化策略積木／JSON 編輯介面，並提供語法提示。
- [ ] 將 Sandbox 產生的 DSL 寫回策略收藏與開發者測試面板。

## 階段 8 — 批量優化與 Walk-Forward 對齊
- [ ] 讓批量優化／Walk-Forward 任務共用 Composer DSL，確保視窗資料與訊號一致。
- [ ] 擴充測試案例涵蓋多視窗 DSL 策略與倉位轉換。

## 階段 9 — 回測報表與診斷整合
- [ ] 在績效摘要與資料暖身診斷顯示 DSL 來源、觸發條件與停損設定。
- [ ] 提供 DSL 版本記錄與可重播的策略快照。

## 階段 10 — Sandbox 與主流程收斂
- [ ] 將 Sandbox 驗證過的 DSL 一鍵套用至主回測流程並保留快取治理。
- [ ] 規劃最終 E2E 測試腳本，覆蓋 2330／2412／0050 等案例與多市場資料。
