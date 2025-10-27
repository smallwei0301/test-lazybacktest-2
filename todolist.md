# TODO — Strategy Composer Rollout (LB-COMPOSER-DSL-20250720A)

## 已完成階段
- [x] **Stage 5｜策略 DSL 與 Composer**：建立 JSON DSL、純函式 `StrategyComposer.buildComposite`、確保插件參數預設與 `RuleResult` 驗證。
- [x] **Stage 6｜回測核心接上 Composer**：主流程、Worker 導入複合規則函式，信號與倉位管理分離，維持暖身/快取流程。

## 待辦階段與流程化步驟
- [ ] **Stage 7｜Sandbox 與診斷儀表**
  - 建立策略 Sandbox 面板：載入自訂 DSL、顯示每根 K 線的布林判斷與來源。
  - 串接 `StrategyComposer` 診斷資料（`meta.composer`）到 UI，標記觸發條件與插件。
  - 撰寫單元測試覆蓋錯誤 DSL、缺插件、runtime override。

- [ ] **Stage 8｜批量與敏感度 Composer 化**
  - 批量優化、敏感度分析改用 DSL 傳遞複合規則，統一策略管線。
  - 匯出/載入策略組合時保存 DSL，確保快照還原一致。
  - 增補壓力測試：多股票批次驗證 DSL 序列化與回放。

- [ ] **Stage 9｜倉位模組與 Composer 解耦檢核**
  - 針對停損/停利、追蹤停損模組建立 composer 回歸測試。
  - 評估全局 `stopLoss/takeProfit` 與複合規則衝突處理（優先順序、警示）。
  - 擴充診斷卡片：顯示 composer 來源、停損來源、符號。

- [ ] **Stage 10｜策略 Sandbox 自動化驗證**
  - 實作自動化跑多檔股票的 sandbox 腳本，紀錄第一筆訊號、倉位狀態。
  - 建立 CI 指標：DSL 解析成功率、策略錯誤分類、回測完成率。
  - 彙整 release checklist，覆蓋 DSL 匯入、Sandbox、主回測、批量流程。
