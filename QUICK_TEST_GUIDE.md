# 🌐 網站測試快速指南

**驗證時間**: 2025-11-17  
**本地驗證結果**: ✅ 全部通過

---

## 🎯 快速測試 (5分鐘)

### 前置準備

1. **清除瀏覽器緩存**
   ```
   按 Ctrl+Shift+Delete
   選擇「全部時間」
   勾選「Cookies 及其他網站資料」
   點擊「清除資料」
   ```

2. **打開開發者工具**
   ```
   按 F12 或 右鍵 → 檢查
   選擇「Console」選項卡
   ```

3. **訪問網站**
   ```
   https://test-lazybacktest.netlify.app
   或您的實際部署 URL
   ```

---

## 📋 三個快速測試

### ✅ 測試 1: P0 驗證 (2分鐘)

**目標**: 確認 cachedMeta 已傳遞給 Worker

**步驟**:
1. 進入「批量優化」頁面
2. 選擇 1-2 個進出場策略
3. 設定迭代次數為 10（快速測試）
4. 點擊「開始優化」
5. **在 Console 中查看消息**

**預期輸出**:
```
[Batch Optimization] P1: Calculated lookback for strategies [...]: XX days
[Batch Optimization] P2: Using provided lookbackDays=XX from strategy calculation
```

**檢查**:
- [ ] 看到上述消息（表示 P0/P1/P2 都正常）
- [ ] 優化進程正常運行
- [ ] Console 無紅色錯誤

---

### ✅ 測試 2: P1 驗證 (2分鐘)

**目標**: 驗證滾動測試和批量優化使用相同 lookback

**步驟**:

**批量優化側**:
1. 進入「批量優化」
2. 選擇策略組合（例如：MA_cross + RSI）
3. 查看 Console，記錄：
   ```
   [Batch Optimization] P1: Calculated lookback for strategies [ma_cross, rsi_indicator]: XX days
   ```
   **記錄 XX 的值**

**滾動測試側**:
1. 進入「滾動測試」
2. 選擇相同進出場策略（MA_cross 和 RSI）
3. 查看 Console，記錄：
   ```
   [Rolling Test] P1: Calculated lookback for strategies [ma_cross, rsi_indicator]: XX days
   ```

**檢查**:
- [ ] 兩側記錄的 XX 值**完全相同**
- [ ] 都顯示了 P1 和 P2 的消息

---

### ✅ 測試 3: 功能測試 (1分鐘)

**目標**: 確保修改未破壞現有功能

**步驟**:
1. 批量優化：執行 10-20 迭代，等待完成
2. 滾動測試：執行 2-3 個窗口，等待完成

**檢查**:
- [ ] 批量優化正常完成，顯示結果表格
- [ ] 滾動測試正常完成，顯示窗口結果
- [ ] Console 沒有紅色的 JavaScript 錯誤
- [ ] 計算時間合理（不會卡住或超時）

---

## 🔍 詳細 Console 檢查

如果想更深入地驗證修改，可以在 Console 中輸入以下命令：

### 檢查 1: 驗證新函數是否已加載
```javascript
// 在 Console 中輸入以下命令
typeof lazybacktestShared.getRequiredLookbackForStrategies

// 預期結果: "function"
```

### 檢查 2: 驗證 buildBatchCachedMeta 是否存在
```javascript
// 在 Console 中查看是否有此函數
// 方式 1: 搜索 Console 日誌中的相關消息
// 方式 2: 在 Network 選項卡中監控 Worker 消息

// 預期: 看到 cachedMeta 對象在 Worker 消息中
```

### 檢查 3: 監控 Worker 消息結構
```javascript
// 打開 Console
// 進入 Network 選項卡
// 過濾 "worker" 相關的 XHR/Fetch
// 查找 postMessage 調用
// 應該看到的結構：
{
    type: 'runBacktest',
    params: {...},
    useCachedData: true/false,
    cachedData: [...],
    cachedMeta: {
        summary: null,
        adjustments: [],
        debugSteps: [],
        // ... 其他字段
    }
}
```

---

## ⚠️ 常見問題排查

### 問題 1: 看不到 P1 和 P2 的消息

**原因**: 瀏覽器使用了舊版本的代碼（緩存）

**解決**:
```
1. Ctrl+Shift+Delete 清除所有緩存
2. 完全關閉瀏覽器
3. 重新打開並訪問網站
4. 在 Console 中搜索 "P1:" 或 "P2:"
```

### 問題 2: 優化或測試時出現錯誤

**排查**:
```
1. 打開 Console 看完整的錯誤消息
2. 檢查是否有 "buildBatchCachedMeta is not defined" 錯誤
3. 檢查是否有 "getRequiredLookbackForStrategies is not defined" 錯誤
4. 如有此類錯誤，表示代碼未正確部署
```

### 問題 3: lookbackDays 值不一致

**排查**:
```
1. 確認兩側選擇的策略完全相同
2. 檢查 Console 中的策略 ID 是否相同
3. 比較完整的日誌消息中的策略清單
4. 若所有條件相同但值仍不一致，表示有 bug 需修正
```

---

## ✅ 完成標準

### 最低標準 (必須)
- [ ] 看到 P1 和 P2 的日誌消息
- [ ] 批量優化能正常運行
- [ ] 滾動測試能正常運行
- [ ] Console 無 JavaScript 錯誤

### 完整標準 (建議)
- [ ] 相同策略的 lookbackDays 值一致
- [ ] Network 中能看到 cachedMeta 字段
- [ ] 優化/測試結果數據合理
- [ ] 多次運行結果一致

### 高級標準 (參考)
- [ ] 多策略優化時自動選擇最大 lookback
- [ ] 日誌中清晰展示優先級選擇過程
- [ ] 性能無明顯下降
- [ ] 結果與修改前對比合理

---

## 📊 測試結果記錄

完成測試後，記錄以下信息：

```
測試日期: ___________
測試 URL: ___________
瀏覽器: ____________

P1 驗證:
  批量優化 lookback: _____ days
  滾動測試 lookback: _____ days
  一致性: [ ] 是 [ ] 否

P0 驗證:
  cachedMeta 存在: [ ] 是 [ ] 否
  字段完整: [ ] 是 [ ] 否

功能驗證:
  批量優化: [ ] 正常 [ ] 異常
  滾動測試: [ ] 正常 [ ] 異常
  無錯誤: [ ] 是 [ ] 否

總體結論:
[ ] 全部通過
[ ] 部分通過，問題: ___
[ ] 未通過，原因: ___
```

---

## 🎯 下一步

如果測試全部通過：
1. ✅ 代碼修改已成功部署
2. ✅ 功能正常運作
3. ✅ 可以進行生產環境驗證

如果有失敗項：
1. 檢查 `TEST_VERIFICATION_GUIDE.md` 中的詳細步驟
2. 查看 `IMPLEMENTATION_SUMMARY.md` 了解修改細節
3. 參考 `TROUBLESHOOTING.md` 進行故障排查

---

**建議測試時間**: 5-10 分鐘  
**預期結果**: ✅ 全部通過

祝測試順利！ 🚀
