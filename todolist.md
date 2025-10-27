# LazyBacktest Composer Roadmap

_版本代碼：LB-COMPOSER-ROADMAP-20260301A_

## ✅ 已完成
- [x] **階段 5：策略 DSL 與 Composer** — 建立 JSON DSL、`buildComposite` 解析器與測試，確保 Plugin params 與 Run 簽章一致。
- [x] **階段 6：回測核心改用 Composer** — Worker 透過複合規則函式取得訊號，倉位管理維持獨立，並提供開發者手動檢驗工具。

## ⏭️ 進行中／待辦事項
- [ ] **階段 7：Composer 視覺化設定 UI**
  - 建立可視化策略積木編輯器（拖拉 AND/OR/NOT 與 Plugin 節點）。
  - 與現有策略選單整合，支援儲存／載入使用者自訂流程。
  - 為生成的 DSL 提供即時驗證與語法高亮提示。
- [ ] **階段 8：策略沙盒（Sandbox）**
  - 提供即時回放的沙盒模組，於子執行緒驗證策略輸出。
  - 匯出測試樣本（指標＋訊號）供 QA 與教學使用。
  - 將 Sandbox 與 Composer 接口串接，確保複合策略可立即試跑。
- [ ] **階段 9：觀測與診斷儀表板**
  - 增加複合策略診斷：每個節點的命中率、延遲、暖身起點。
  - 與倉位狀態視覺化工具整合，標示策略訊號來源。
  - 提供策略效能比較（Composer vs. 單一 Plugin）。
- [ ] **階段 10：策略 Sandbox 正式上線**
  - 打包 Sandbox 操作流程，加入開發者區域快捷鍵與說明。
  - 針對主執行緒／Worker 溝通加上錯誤復原與緊急 fallback。
  - 撰寫最終文件與教學影片腳本，協助用戶快速上手。

## 📌 附註
- Composer 測試流程使用 `tests/strategy-composer.test.js` 確保 AND/OR/NOT 與停損／停利行為正確。
- 開發者檢驗按鈕位於「開發者區域」，提供範例 DSL 回測與多檔暖身檢查。
