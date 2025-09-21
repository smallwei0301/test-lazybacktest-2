# Lazybacktest Debug Log

## 2025-03-12 — Patch LB-ADJ-COMPOSER-20250312A / LB-ADJ-PIPE-20250312A
- **Issue recap**: 還原股價長期顯示 0 件有效事件，回測成交價格維持原始價。追蹤 Netlify 回傳資料後確認 `cashCapitalIncrease` 與其他成分的比值公式錯誤，造成調整係數被判定為無效並全部跳過。
- **Fix**: 重新依照證交所參考價公式計算調整係數，統一 Netlify 與 Worker 的 `computeAdjustmentRatio` / `computeFallbackRatio`，並在單元測試加入混合配息、增資場景驗證。
- **Diagnostics**: Netlify 還原服務回傳 `debugSteps`，Worker 與主執行緒同步快取 `summary`、`adjustments` 與備援標記，前端新增「還原流程」步驟提示與彈窗內的除權息摘要，利於快速檢視每個階段狀態與略過原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`（新增調整係數驗證）。

> 後續若再出現無法調整的案例，先在前台檢視「還原套用」步驟的略過原因與備援標記，再對照 `log.md` 上次修復時的調整內容。
