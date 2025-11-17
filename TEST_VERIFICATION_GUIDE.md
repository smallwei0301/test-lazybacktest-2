# 🧪 網站測試驗證指南

**日期**: 2025-11-17  
**目的**: 驗證代碼修改在網站上的成功部署和功能正常運作

---

## 📍 環境信息

### 部署配置
- **平臺**: Netlify
- **構建命令**: `npm run build`
- **發佈目錄**: `.next`
- **基礎目錄**: `v0 design code`

### 修改的核心文件位置
```
v0 design code/public/app/js/
├── batch-optimization.js   ✅ 修改 (P0, P1, P2)
├── rolling-test.js         ✅ 修改 (P1, P2)
└── shared-lookback.js      ✅ 修改 (新增 P1 函數)
```

---

## 🎯 測試計劃

### 第一階段: 部署驗證

#### 步驟 1: 檢查代碼文件是否已更新

```bash
# 確認文件修改時間
ls -la "v0 design code/public/app/js/batch-optimization.js"
ls -la "v0 design code/public/app/js/rolling-test.js"
ls -la "v0 design code/public/app/js/shared-lookback.js"
```

**預期結果**: 文件修改時間應該是 2025-11-17 之後

#### 步驟 2: 驗證代碼內容

在編輯器中打開以下位置確認修改：

**batch-optimization.js**:
- [ ] L595: `function buildBatchCachedMeta(params = {})` 存在
- [ ] L3673: `const cachedMeta = buildBatchCachedMeta(preparedParams);` 存在
- [ ] L3680: `cachedMeta  // ✅ 新增此字段以統一 Worker 消息結構` 存在
- [ ] L3505: `// ✅ P1 改進: 使用統一的策略 lookback 計算邏輯` 存在

**shared-lookback.js**:
- [ ] L342: `function getRequiredLookbackForStrategies(strategyIds, options = {})` 存在
- [ ] L397: `getRequiredLookbackForStrategies,  // ✅ 導出新函數` 存在

**rolling-test.js**:
- [ ] L2776: `// ✅ P1 改進: 使用統一的策略 lookback 計算邏輯` 存在
- [ ] L2792: `console.log(...P1: Calculated lookback...)` 存在

---

### 第二階段: 網站功能測試

#### 測試場景 1: 檢查 P0 修改 (cachedMeta 傳遞)

**操作步驟**:
1. 打開網站: https://test-lazybacktest.netlify.app (或您的實際 URL)
2. 進入「批量優化」頁面
3. 打開瀏覽器開發者工具 (F12) → Console
4. 清空控制台日誌
5. 選擇任一進出場策略組合
6. 點擊「開始優化」按鈕
7. 等待優化進程開始

**預期結果**:
```
[Batch Optimization] P1: Calculated lookback for strategies [...]: XX days
[Batch Optimization] P2: Using provided lookbackDays=XX from strategy calculation
Worker 開始執行回測
```

**檢查項**:
- [ ] 日誌中出現 "P1: Calculated lookback" 消息
- [ ] 日誌中出現 "P2: Using provided lookbackDays" 消息
- [ ] 優化進程正常運行，無錯誤
- [ ] cachedMeta 被正確傳遞（可在 Network 選項卡中查看 Worker 消息）

---

#### 測試場景 2: 檢查 P1 修改 (統一 Lookback 計算)

**操作步驟**:
1. 進入「滾動測試」頁面
2. 打開瀏覽器開發者工具 (F12) → Console
3. 清空控制台日誌
4. 設定測試參數
5. 點擊「開始測試」按鈕

**預期結果**:
```
[Rolling Test] P1: Calculated lookback for strategies [...]: XX days
[Rolling Test] P2: Using provided lookbackDays=XX from strategy calculation
```

**檢查項**:
- [ ] 日誌中出現 "P1: Calculated lookback" 消息
- [ ] lookbackDays 值與批量優化中相同策略的值相同

---

#### 測試場景 3: 一致性檢驗

**操作步驟**:
1. **批量優化側**:
   - 選擇特定策略組合 (例如: MA_cross + RSI)
   - 記錄控制台日誌中 "P1: Calculated lookback" 的值

2. **滾動測試側**:
   - 選擇相同的進出場策略
   - 記錄控制台日誌中 "P1: Calculated lookback" 的值

**預期結果**:
```
批量優化: "P1: Calculated lookback for strategies [MA_cross, RSI]: 90 days"
滾動測試: "P1: Calculated lookback for strategies [MA_cross, RSI]: 90 days"
```

**檢查項**:
- [ ] 兩側的 lookbackDays 值完全相同
- [ ] 選定的策略組合相同時，計算結果應一致

---

#### 測試場景 4: Network 檢查 (Worker 消息驗證)

**操作步驟**:
1. 打開開發者工具 → Network 選項卡
2. 過濾顯示 XHR/Fetch 請求
3. 執行批量優化
4. 在 Worker 消息中查找 postMessage 調用

**預期結果**:
```javascript
// 應該看到的消息結構
{
    type: 'runBacktest',
    params: {...},
    useCachedData: true/false,
    cachedData: [...],
    cachedMeta: {  // ✅ 新增字段
        summary: null,
        adjustments: [],
        debugSteps: [],
        adjustmentFallbackApplied: false,
        priceSource: null,
        dataSource: null,
        splitDiagnostics: null,
        diagnostics: null,
        coverage: null,
        fetchRange: null,
    }
}
```

**檢查項**:
- [ ] cachedMeta 字段存在於消息中
- [ ] cachedMeta 包含所有預期的子字段

---

### 第三階段: 功能回歸測試

#### 測試 1: 批量優化基本功能

**操作步驟**:
1. 進入批量優化
2. 選擇 1-2 個進出場策略
3. 設定 10-20 次迭代（用於快速測試）
4. 執行優化

**預期結果**:
- [ ] 優化正常完成
- [ ] 能看到結果表格
- [ ] 無 JavaScript 錯誤（Console 中無紅色錯誤）
- [ ] 計算時間合理

---

#### 測試 2: 滾動測試基本功能

**操作步驟**:
1. 進入滾動測試
2. 選擇訓練和測試時間段
3. 設定 2-3 個滾動窗口
4. 執行測試

**預期結果**:
- [ ] 測試正常完成
- [ ] 能看到各窗口的結果
- [ ] 無 JavaScript 錯誤
- [ ] 結果數據合理

---

#### 測試 3: 多策略組合測試

**操作步驟**:
1. 進入批量優化
2. 選擇 3-5 個進出場策略組合
3. 執行優化

**預期結果**:
- [ ] 系統自動選擇最大 lookback（可在日誌中確認）
- [ ] 所有策略組合都使用相同的 lookback 基數
- [ ] 優化完成，結果合理

---

## 📊 詳細檢查項清單

### P0 功能檢查 (cachedMeta)

| 項目 | 檢查 | 是否通過 |
|------|------|--------|
| buildBatchCachedMeta 函數存在 | batch-optimization.js L595 | [ ] |
| buildBatchCachedMeta 被調用 | batch-optimization.js L3673 | [ ] |
| cachedMeta 在 postMessage 中 | batch-optimization.js L3680 | [ ] |
| cachedMeta 包含正確字段 | 開發者工具 Network 中查看 | [ ] |
| Worker 正常處理 cachedMeta | 無報錯，優化完成 | [ ] |

### P1 功能檢查 (統一 Lookback)

| 項目 | 檢查 | 是否通過 |
|------|------|--------|
| getRequiredLookbackForStrategies 存在 | shared-lookback.js L342 | [ ] |
| 函數已導出 | shared-lookback.js L397 | [ ] |
| batch-optimization 使用新函數 | 日誌顯示 "P1: Calculated" | [ ] |
| rolling-test 使用新函數 | 日誌顯示 "P1: Calculated" | [ ] |
| 相同策略的 lookback 相同 | 兩側日誌比對 | [ ] |

### P2 功能檢查 (優先級系統)

| 項目 | 檢查 | 是否通過 |
|------|------|--------|
| P2 優先級邏輯存在 | enrichParamsWithLookback 中 | [ ] |
| 日誌顯示 "P2: Using provided" | 日誌中出現此消息 | [ ] |
| 策略計算值被優先使用 | lookbackDays 來自策略計算 | [ ] |
| 避免重複計算 | 單個回測過程中只計算一次 | [ ] |

---

## 🐛 故障排查指南

### 問題 1: 看不到 P1 日誌消息

**原因可能**:
- 代碼修改未正確部署
- lazybacktestShared 不可用
- 網站沒有刷新（清除緩存）

**解決方案**:
```
1. Ctrl+Shift+Delete 清除瀏覽器緩存
2. 重新訪問網站
3. 在開發者工具中檢查 shared-lookback.js 是否加載
4. 檢查 Console 中是否有任何加載錯誤
```

### 問題 2: cachedMeta 仍然不存在

**原因可能**:
- buildBatchCachedMeta 函數未正確定義
- postMessage 中未添加 cachedMeta

**解決方案**:
```javascript
// 在開發者工具 Console 中運行
// 檢查函數是否存在
typeof buildBatchCachedMeta  // 應返回 "function"

// 檢查是否有加載錯誤
console.error  // 查看是否有相關錯誤日誌
```

### 問題 3: lookbackDays 值不一致

**原因可能**:
- 選擇的策略不同
- 優先級系統未正確運行
- 時間範圍不同導致計算結果不同

**解決方案**:
```
1. 確認兩側選擇的策略完全相同
2. 檢查日誌中策略 ID 是否一致
3. 查看 enrichParamsWithLookback 中的優先級判斷邏輯
```

---

## 📝 測試報告模板

完成以下測試並填寫報告：

```markdown
# 測試報告 - 2025-11-17

## 環境信息
- 測試日期: ___
- 瀏覽器: ___ (版本 ___)
- 網站 URL: ___

## P0 測試結果
- cachedMeta 傳遞: [ ] 通過 [ ] 失敗
- Worker 消息結構: [ ] 正確 [ ] 不正確
- 具體結果: ___

## P1 測試結果
- 統一 Lookback 計算: [ ] 通過 [ ] 失敗
- 日誌消息: [ ] 出現 [ ] 未出現
- 一致性檢驗: [ ] 一致 [ ] 不一致
- 具體結果: ___

## P2 測試結果
- 優先級系統: [ ] 通過 [ ] 失敗
- 日誌消息: [ ] 出現 [ ] 未出現
- 重複計算: [ ] 已避免 [ ] 未避免
- 具體結果: ___

## 功能回歸
- 批量優化: [ ] 正常 [ ] 異常
- 滾動測試: [ ] 正常 [ ] 異常
- 無錯誤: [ ] 是 [ ] 否

## 總體結論
[ ] 全部通過
[ ] 部分通過，需修正: ___
[ ] 未通過，原因: ___
```

---

## ✅ 完成檢查清單

在進行完整測試前，請確認：

- [ ] 網站可正常訪問
- [ ] 瀏覽器開發者工具可用
- [ ] 代碼文件已更新（檢查修改時間）
- [ ] 緩存已清除
- [ ] 有可用的測試數據

---

## 🔗 相關資源

- `FINAL_REPORT.md` - 完成報告
- `IMPLEMENTATION_SUMMARY.md` - 施作詳解
- `CHANGELOG_2025-11-17.md` - 變更日誌

---

**測試計劃已準備就緒** ✅

請按照上述步驟進行測試，並記錄結果。如有任何問題，請參考「故障排查指南」。
