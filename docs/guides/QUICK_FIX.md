# ⚡ 快速修正指南

## 問題
批量優化 + 滾動測試（相同訓練窗口）= 不同最佳參數

## 根本原因
Worker 優先級邏輯：**消息層 > params 層 > 計算**
- 滾動測試：在消息層傳遞 → 優先級 1 ✅
- 批量優化：在 params 層傳遞 → 優先級 2 ⚠️

## 一行總結
**批量優化沒有在消息層明確指定 lookback 字段，導致 Worker 進行重新計算**

## 修正位置
📍 `v0 design code/public/app/js/batch-optimization.js` L3519-3523

## 修正代碼

### ❌ 當前
```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData,
    cachedData: cachedDataForWorker
});
```

### ✅ 修改為
```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    dataStartDate: preparedParams.dataStartDate,
    effectiveStartDate: preparedParams.effectiveStartDate,
    lookbackDays: preparedParams.lookbackDays,
    useCachedData,
    cachedData: cachedDataForWorker,
    cachedMeta: buildBatchDatasetMeta(preparedParams)
});
```

## 驗證
修改後，批量優化的 Worker 日誌應顯示：
```
[Worker] e.data.lookbackDays: 180  ✅
```

而非：
```
[Worker] e.data.lookbackDays: undefined  ❌
```

## 詳細文檔
- `WORKER_LOOKUP_PATH_ANALYSIS.md` - 技術分析
- `FIX_SUMMARY.md` - 完整修正指南
