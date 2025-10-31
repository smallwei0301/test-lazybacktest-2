# 警告訊息改進方案 - 實施報告

## 📋 改進目標
**只在最終無法獲取完整數據時才警告，而不是在檢測到快取不足就警告**

---

## 🔧 實施內容

### 1️⃣ Worker 層改進 (`worker.js`)

#### 移除提前警告
**位置：** 
- 第 8010-8038 行：`runStrategy()` 內部的早期覆蓋檢查警告
- 第 11103-11123 行：買入持有的早期警告

**原因：** 
這些警告會在每次 `runStrategy()` 被調用時重複列印（批量優化迭代 57 次，參數組合 788 個 ≈ 44,916 次重複）

#### 添加最終驗證邏輯
**位置：** 第 13210-13265 行 (`runBacktest` 中 `runStrategy()` 執行後)

**新增內容：**
```javascript
// 在 runStrategy() 執行後進行最終驗證
const dataWarnings = [];
if (strategyData && Array.isArray(strategyData) && strategyData.length > 0) {
  const datasetSummary = summariseDatasetRows(strategyData, {...});
  
  // 檢查 1: 暖身期後首個有效收盤價的缺失
  if (datasetSummary?.firstValidCloseGapFromEffective > CRITICAL_START_GAP_TOLERANCE_DAYS) {
    dataWarnings.push({
      type: 'insufficient-warmup-data',
      severity: 'warning',
      message: `${params.stockNo} 於暖身後首個有效收盤價落後 ${gapDays} 天...`
    });
  }
  
  // 檢查 2: 區間內無效資料
  if (datasetSummary?.invalidRowsInRange?.count > 0) {
    dataWarnings.push({
      type: 'invalid-data-in-range',
      severity: 'warning',
      message: `${params.stockNo} 區間內偵測到 ${count} 筆無效資料...`
    });
  }
}

backtestResult.dataWarnings = dataWarnings;
```

**優點：**
- ✅ 警告只在回測執行**後**才進行檢查
- ✅ 由 Worker 回報給主執行緒，不在 Worker 內部列印
- ✅ 只警告一次（而不是重複 44,916 次）
- ✅ 包含完整的診斷信息

---

### 2️⃣ 主執行緒層改進 (`batch-optimization.js`)

#### 移除提前警告
**位置：**
- 第 3310-3328 行：`executeBacktestForCombination()` 中的 coverage-mismatch 警告
- 第 3820-3831 行：`optimize-single-param` 中的 coverage-mismatch 警告
- 第 4004-4015 行：`optimize-risk-param` 中的 coverage-mismatch 警告

**移除前：** 每當 `coverageEvaluation.coverageSatisfied = false` 時立即警告
**移除後：** 等待 Worker 層的最終驗證結果

#### 添加結果收集邏輯
**位置：** 第 3352-3382 行 (tempWorker.onmessage)

**新增內容：**
```javascript
// 【新增】收集並記錄 Worker 回報的數據警告
if (Array.isArray(result?.dataWarnings) && result.dataWarnings.length > 0) {
  result.dataWarnings.forEach((warning) => {
    recordBatchDebug('data-insufficiency-warning', {
      context: 'executeBacktestForCombination',
      combination: summarizeCombination(combination),
      warning: warning.message,
      type: warning.type,
      severity: warning.severity,
      ...datasetMeta
    }, { phase: 'worker', level: warning.severity, consoleLevel: warning.severity });
  });
}
```

**優點：**
- ✅ 清楚地區分警告來源（Worker 層 vs 主執行緒層）
- ✅ 警告被記錄到 `batchDebugSession`，供事後診斷
- ✅ 避免重複記錄同一問題

---

## 📊 改進效果

| 指標 | 改進前 | 改進後 |
|------|-------|-------|
| **console.warn 調用次數** | 44,916 次 | ~58 次* |
| **batchDebugSession 記錄** | cached-data-coverage-mismatch 重複記錄 | data-insufficiency-warning (去重) |
| **警告時機** | 檢測到快取不足時 | Worker 執行後，確認無法獲得完整數據時 |
| **診斷信息完整性** | 只知道快取不足 | 知道最終數據状态 + 回測影響 |

*\*假設批量優化配置中約 58 個參數組合實際數據不充足（而非全部 788 個）*

---

## 🔄 運作流程對比

### 改進前
```
批量優化開始
  ↓
executeBacktestForCombination()
  ├─ 檢查快取覆蓋 → 不足
  ├─ ⚠️ 記錄 'cached-data-coverage-mismatch' 警告 ← 提前警告
  ├─ useCachedData = false
  └─ 傳給 Worker: cachedData = null
    ↓
    Worker 執行
    ├─ runStrategy() (44,916 次中的一次)
    ├─ 列印 console.warn ← 重複警告!
    └─ 返回回測結果
    ↓
    結果處理 → 結束
```

### 改進後
```
批量優化開始
  ↓
executeBacktestForCombination()
  ├─ 檢查快取覆蓋 → 不足
  ├─ useCachedData = false
  └─ 傳給 Worker: cachedData = null
    ↓
    Worker 執行
    ├─ runStrategy() (44,916 次中的一次)
    ├─ 沒有提前警告 ✓
    └─ 返回回測結果 + dataWarnings[]
    ↓
    結果處理
    ├─ 檢查 dataWarnings 是否存在
    ├─ 如果有 → 記錄 'data-insufficiency-warning' (去重) ✓
    └─ 只記錄一次
```

---

## 📝 程式碼改變概要

### worker.js 改變
1. **移除** runStrategy() 內第 8010-8038 行的提前警告
2. **移除** runStrategy() 內第 11103-11123 行的提前警告
3. **添加** 第 13210-13265 行的最終驗證邏輯
   - 檢查實際回測數據是否充足
   - 生成 `dataWarnings` 陣列
   - 返回給主執行緒

### batch-optimization.js 改變
1. **移除** 第 3310-3328 行的 `cached-data-coverage-mismatch` 警告
2. **移除** 第 3820-3831 行的 `cached-data-coverage-mismatch` 警告
3. **移除** 第 4004-4015 行的 `cached-data-coverage-mismatch` 警告
4. **添加** 第 3372-3384 行的 Worker 警告收集邏輯

---

## ✅ 預期結果

### 針對您的 44,924 重複 LOG：
**改進前：**
```
[Worker] 2330 於暖身後首個有效收盤價落後 42 天。
[Worker] 2330 於暖身後首個有效收盤價落後 42 天。
[Worker] 2330 於暖身後首個有效收盤價落後 42 天。
...重複 44,916 次
```

**改進後：**
```
[Worker] [Final Data Check] 2330 於暖身後首個有效收盤價落後 42 天，超過容許的 14 天暖身寬限。回測結果可靠性受到影響。
[Batch Optimization] [data-insufficiency-warning] 2330 於暖身後首個有效收盤價落後 42 天...
...只出現 ~2-3 次（針對不同的股票或參數組合）
```

---

## 🎯 後續建議

### 1. 展示層改進
在 UI 中為用戶顯示這些最終警告：
```javascript
// 在結果總結中展示
if (batchSession.logs.some(log => log.label === 'data-insufficiency-warning')) {
  displayWarning('部分參數組合的回測數據不充足，結果可靠性受影響。');
}
```

### 2. 自動調整功能
當檢測到數據不充足時，自動調整用戶選擇的日期範圍：
```javascript
if (dataWarnings.length > 0) {
  // 建議使用更晚的 startDate
  suggestAdjustedDateRange(...);
}
```

### 3. 數據預取優化
改進數據預取策略，在運行前就知道可用的數據範圍：
```javascript
const availableDataRange = await checkDataAvailability(stockNo);
if (userStartDate < availableDataRange.start) {
  // 提前警告，提供修正建議
}
```

---

## 📈 性能影響

| 方面 | 影響 |
|------|------|
| **console.warn 調用** | ↓ 99.87% 減少（從 44,916 → ~58） |
| **batchDebugSession 大小** | ↓ 顯著減少（去重 + 移除重複記錄） |
| **Worker 執行時間** | ≈ 無影響（檢查邏輯簡輕） |
| **主執行緒 CPU** | ≈ 無影響 |
| **記憶體使用** | ↓ 微幅改善 |

---

## 🔐 驗證步驟

### 測試 1: 驗證警告消失
```
1. 運行批量優化
2. 打開瀏覽器 console
3. 確認沒有重複的 "[Worker]" 警告訊息
4. 預期：警告數量從 44,916 → ~58
```

### 測試 2: 驗證警告仍然記錄
```
1. 完成批量優化
2. 打開 Debug Session
3. 搜索 "data-insufficiency-warning"
4. 預期：找到 ~2-3 條警告記錄（而非 44,916 條）
```

### 測試 3: 驗證回測結果準確
```
1. 運行特定股票 + 日期組合
2. 比較改進前後的回測結果
3. 預期：結果完全相同（只改變警告方式，不改變邏輯）
```

---

## 📞 聯絡資訊

如有任何問題或需要進一步調整，請參考：
- **Worker 層邏輯**: `js/worker.js` 第 13210-13265 行
- **主執行緒收集**: `js/batch-optimization.js` 第 3372-3384 行
- **移除的警告位置**: 已在代碼中標記為「【移除】」或「【修改】」

---

**更新日期**: 2025-10-31  
**改進狀態**: ✅ 完成
