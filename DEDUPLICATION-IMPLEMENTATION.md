# 警告去重實現報告

## 實施日期
2025-10-31

## 問題說明
LOG 檔案中存在大量重複的警告訊息（44,924 筆記錄），特別是「持有首筆有效收盤價落後暖身起點 2 天」這類警告。

**根本原因**：
- 同一股票 (2330) 在 788 個參數組合 × 57 次迭代 = 44,916 次執行中，每次都記錄相同的警告
- 缺乏去重機制，導致同一警告被重複記錄多次

## 解決方案
實現基於 **股號 + 警告類型 + 數值（gap/count）** 的去重 Map

### 修改內容

#### 1️⃣ batch-optimization.js (第 18 行)
**新增全局去重 Map**
```javascript
const dataWarningsDeduped = new Map(); // 用於去重警告訊息
```

#### 2️⃣ batch-optimization.js (第 3373-3393 行)
**實現去重邏輯**

**修改前**：
```javascript
// 收集並記錄 Worker 回報的數據警告
if (Array.isArray(result?.dataWarnings) && result.dataWarnings.length > 0) {
    result.dataWarnings.forEach((warning) => {
        recordBatchDebug('data-insufficiency-warning', {
            // ... 記錄每一筆警告
        });
    });
}
```

**修改後**：
```javascript
// 收集並記錄 Worker 回報的數據警告 (去重)
if (Array.isArray(result?.dataWarnings) && result.dataWarnings.length > 0) {
    result.dataWarnings.forEach((warning) => {
        // 建立唯一識別碼：股號 + 警告類型 + 數值
        const warningKey = `${combination.stock}|${warning.type}|${warning.gap || warning.count || 'N/A'}`;
        
        // 只在首次遇到此警告時記錄
        if (!dataWarningsDeduped.has(warningKey)) {
            dataWarningsDeduped.set(warningKey, true);
            recordBatchDebug('data-insufficiency-warning', {
                // ... 記錄警告
            });
        }
    });
}
```

## 預期效果

| 指標 | 去重前 | 去重後 | 改善 |
|------|-------|-------|------|
| 警告記錄數 | 44,924 | ~58 | 99.87% ↓ |
| LOG 檔案大小 | ~2.3 MB | ~15 KB | 99.3% ↓ |
| 診斷資訊完整性 | ✅ 完整 | ✅ 完整 | 保留 |
| 首次發現時間 | 即時 | 即時 | 保留 |

## 去重識別碼說明

去重鍵的構成：
```
warningKey = `${股號}|${警告類型}|${數值參數}`
```

### 範例

**警告類型 1: 暖身期不足**
```
Key: 2330|insufficient-warmup-data|2
// 表示：股票 2330，缺少 2 天暖身資料
// 僅第一次記錄，後續相同警告跳過
```

**警告類型 2: 區間內無效資料**
```
Key: 2330|invalid-data-in-range|5
// 表示：股票 2330，區間內有 5 筆無效資料
// 僅第一次記錄，後續相同警告跳過
```

## 驗證方法

1. **檢查 LOG 檔案大小**
   ```
   舊版本: ~2.3 MB
   新版本: ~15 KB (目標)
   ```

2. **計算警告數量**
   ```javascript
   // 在瀏覽器主控台執行
   const logs = document.querySelectorAll('[data-event-type="data-insufficiency-warning"]');
   console.log(`Total warnings: ${logs.length}`); // 預期: ~58
   ```

3. **檢查去重效果**
   ```javascript
   // 應該看到同一股票的同一類型警告只出現一次
   const uniqueWarnings = new Set();
   logs.forEach(log => {
       const msg = log.getAttribute('data-message');
       uniqueWarnings.add(msg);
   });
   console.log(`Unique warnings: ${uniqueWarnings.size}`);
   ```

## 向後相容性
✅ **完全相容**
- 警告發出邏輯保持不變
- 只是去重時機改為首次發現時
- 現有的診斷和調試功能完全保留

## 代碼檔案修改清單
- ✅ `js/batch-optimization.js` - 第 18 行、第 3373-3393 行

## 驗證狀態
- ✅ 無編譯錯誤
- ✅ 代碼邏輯驗證
- ⏳ 等待運行時測試

---
**實施者**: GitHub Copilot  
**狀態**: ✅ 完成  
**測試狀態**: 待驗證
