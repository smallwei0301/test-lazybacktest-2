# Lazybacktest Composer 升級待辦清單（版本 LB-STRATEGY-COMPOSER-20250720A）

## 當前進度
- [x] 階段 5：完成策略 DSL 與 Composer 核心，建立單元測試覆蓋 AND/OR/NOT、停損參數傳遞。
- [x] 階段 6：Worker 串接 Composer，維持暖身／快取流程並提供開發者手動檢驗按鈕。

## 下一步（階段 7 ～ 階段 10）
- [ ] 階段 7：擴充 UI 編輯介面，可視化建立 DSL 積木並同步策略儲存載入流程。
- [ ] 階段 8：支援多策略回測與批量優化的 DSL 下發，建立 Composer 與批次 Runner 的對齊測試。
- [ ] 階段 9：引入 Sandbox/Preview 模式，允許在不觸發正式回測的情況下預覽複合規則輸出與診斷。
- [ ] 階段 10：完成策略 Marketplace 整合，將 Composer 規則打包成可分享模組並建立版本比對工具。

> 備註：待辦清單會隨每個階段完成後更新，並同步於 `log.md` 記錄對應的版本代碼與驗證結果。
