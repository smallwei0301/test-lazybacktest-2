# Todo List — DSL Composer Roadmap (LB-DSL-COMPOSER-20260915A)

## 階段 5：策略 DSL 與 Composer
- [x] 建立 `LazyStrategyDSL.buildComposite`，支援 AND/OR/NOT 節點與參數預設值。
- [x] Worker 端導入 DSL 評估（多空進／出場、移動停損參數傳遞、暖身推算）。
- [x] 新增 `strategy-dsl.test.js` 單元測試涵蓋停損傳遞與邏輯運算。
- [x] 開發者區域加入「策略DSL測試」按鈕，使用 RSI/KD + 移動停損範例。
- [ ] 於可連線環境重新執行 DSL 範例回測並記錄實際交易列表。

## 階段 6：DSL 設定儲存與載入（預備）
- [ ] 設計表單欄位與 localStorage 結構，支援 DSL 與傳統策略並存。
- [ ] UI 呈現 DSL 組合摘要（例如顯示 AND/OR 階層與主要參數）。
- [ ] 匯出/匯入策略檔案時納入 DSL 定義，確保版本兼容。

## 階段 7：策略診斷與可視化
- [ ] 於指標面板顯示 DSL 子策略的 meta（如 RSI/KD 指標值）。
- [ ] 在資料診斷卡揭露 DSL 使用的插件、參數與暖身需求。
- [ ] 開發者卡提供 DSL 評估 trace（列出每個子節點輸出）。

## 階段 8：DSL 與批量/滾動測試整合
- [ ] Walk-Forward 與批量優化支援 DSL（建立等效參數映射與結果比較）。
- [ ] 新增批量優化日誌紀錄 DSL 節點結果，避免最佳解遺失組合資訊。
- [ ] 擴充自動化測試涵蓋 DSL 與非 DSL 策略混合優化情境。

## 階段 9：Sandbox／模擬環境
- [ ] 建立前端 Sandbox，允許拖拉 DSL 積木並即時預覽策略輸出。
- [ ] 提供靜態資料集（Mock）讓開發者離線驗證 DSL 行為。
- [ ] 記錄 Sandbox 版本碼與測試腳本，方便部署前比對。

## 階段 10：策略 Marketplace 與權限治理
- [ ] 定義 DSL 分享格式與驗證機制（避免惡意或不完整 DSL）。
- [ ] 建立權限層級（僅白名單用戶可上傳/使用自訂 DSL）。
- [ ] 規劃 Marketplace UI 與審核流程，串接回測與手動驗證報告。
