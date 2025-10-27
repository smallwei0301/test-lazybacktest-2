# Lazybacktest 平台升級 Todo List

## 版本標記
- 策略組合引擎：`LB-STRATEGY-COMPOSER-20250720A`
- Worker 複合規則整合：`LB-WORKER-COMPOSITE-20250720A`

## 階段 5：策略 DSL 與 Composer
- [x] 定義 DSL 結構與節點驗證 (`AND`/`OR`/`NOT`/`LEAF`).
- [x] 實作 `StrategyComposer.buildComposite` 生成可執行函式。
- [x] 透過單元測試驗證 AND / OR / NOT 組合邏輯與參數覆寫。
- [ ] 建立更多複雜策略樣板（例如多層嵌套、風控節點）。

## 階段 6：回測核心改用 Composer
- [x] 在 Worker 建立複合規則函式並注入回測主迴圈。
- [x] 保留舊有 `callStrategyPlugin` 介面但改為優先走 Composer。
- [x] 確保停損 / 停利與倉位管理流程未受影響。
- [ ] 以手動測試確認多股票回測 UI 診斷資訊一致。

## 預備事項（階段 7～10）
- [ ] 階段 7：策略參數編輯器支援 DSL 節點視覺化配置。
- [ ] 階段 8：倉位引擎模組化（多策略共享倉位限制）。
- [ ] 階段 9：策略 Sandbox 與回測紀錄快取隔離。
- [ ] 階段 10：多執行緒部署與 UI 狀態同步。

> 註：待完成項目需於後續迭代中補齊，完成後請同步更新此列表。
