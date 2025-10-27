# Lazybacktest 策略平台重構待辦清單（版本 LB-COMPOSER-20250718A）

## 阶段 5：策略 DSL 與 Composer
- [x] 定義複合策略 DSL 結構（plugin 節點、AND/OR/NOT 運算元）。
- [x] 實作 `StrategyComposer.buildComposite`，確保遞迴組合、參數預設與錯誤回傳皆為純函式。
- [x] 建立單元測試覆蓋 AND/OR/NOT、Schema 預設、停損欄位合併等情境。

## 阶段 6：回測核心改用 Composer
- [x] 在 Worker 以 Composer 建立多頭/空頭進出場規則函式。
- [x] 將回測主迴圈訊號來源改為複合規則函式，維持倉位與暖身流程不變。
- [ ] 於開發者工具新增 Sandbox 操作案例（待 UI 階段實作）。

## 預告階段 7 ~ 10 主要工作（初版草稿）
- 階段 7：風險管理插件化──梳理停損/停利/加碼規則並接上 Composer。 
- 階段 8：Sandbox UI 原型──提供策略積木編輯器與即時驗證。 
- 階段 9：批次優化整合 Composer──支援 DSL 對應的優化組態。 
- 階段 10：Walk-Forward 與敏感度同步 Composer──確保滾動視窗沿用複合策略流程。

> 備註：待辦清單每次變更需更新版本碼，並於 log.md 紀錄跨階段成果。
