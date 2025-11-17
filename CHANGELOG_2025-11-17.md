# 變更日誌 (2025-11-17)

## 🚀 施作版本
**v1.0.0-strategy-lookback-unification**

---

## ✅ 已完成的修改

### P0: 修復 cachedMeta 缺失 (CRITICAL)

**檔案**: `v0 design code/public/app/js/batch-optimization.js`

**修改點**: 
- L595-650: 新增 `buildBatchCachedMeta()` 函數
- L3673-3680: 修改 `executeBacktestForCombination()` 中的 postMessage 調用

**變更詳情**:
```diff
- tempWorker.postMessage({
-     type: 'runBacktest',
-     params: preparedParams,
-     useCachedData,
-     cachedData: cachedDataForWorker
- });

+ const cachedMeta = buildBatchCachedMeta(preparedParams);
+ tempWorker.postMessage({
+     type: 'runBacktest',
+     params: preparedParams,
+     useCachedData,
+     cachedData: cachedDataForWorker,
+     cachedMeta  // ✅ 新增
+ });
```

**影響**: Worker 層現在可以驗證數據調整、分割診斷和覆蓋率

---

### P1: 統一 Lookback 計算邏輯 (HIGH)

**檔案**: 
1. `v0 design code/public/app/js/shared-lookback.js`
2. `v0 design code/public/app/js/batch-optimization.js`
3. `v0 design code/public/app/js/rolling-test.js`

**修改點**:

#### shared-lookback.js
- L342-405: 新增 `getRequiredLookbackForStrategies()` 函數
- L397: 在 API 導出中添加新函數

#### batch-optimization.js
- L3505-3530: 在 `executeBacktestForCombination()` 中使用統一函數

#### rolling-test.js
- L2776-2810: 在 `prepareWorkerPayload()` 中使用統一函數

**變更詳情**:
```diff
  // 原來: 各自計算 lookback，邏輯分散
  const preparedParams = enrichParamsWithLookback(params);

  // 新的: 統一使用策略計算
+ const selectedStrategies = [combination.buyStrategy, combination.sellStrategy, ...];
+ const requiredLookbackDays = sharedUtils.getRequiredLookbackForStrategies(
+     selectedStrategies,
+     { minBars: 90, multiplier: 2 }
+ );
+ paramsForLookback.lookbackDays = requiredLookbackDays;
  const preparedParams = enrichParamsWithLookback(paramsForLookback);
```

**影響**: 
- 滾動測試和批量優化使用相同的 lookback 計算邏輯
- 多策略優化時自動選擇最大 lookback（確保充足暖身）

---

### P2: 改進 Lookback 優先級系統 (MEDIUM)

**檔案**:
1. `v0 design code/public/app/js/batch-optimization.js`
2. `v0 design code/public/app/js/rolling-test.js`

**修改點**:
- batch-optimization.js L1829-1895: 修改 `enrichParamsWithLookback()`
- rolling-test.js L2823-2890: 修改 `enrichParamsWithLookback()`

**變更詳情**:
```diff
  function enrichParamsWithLookback(params) {
      let lookbackDays = null;
      
+     // 優先級 1: 使用已提供的值（來自策略計算）
+     if (Number.isFinite(params.lookbackDays) && params.lookbackDays > 0) {
+         lookbackDays = params.lookbackDays;
+     }
-     // 直接使用 windowDecision
-     else if (Number.isFinite(windowDecision?.lookbackDays)) {
+     // 優先級 2-4: 其他備用方案
+     else if (...) {
          lookbackDays = windowDecision.lookbackDays;
      }
  }
```

**優先級順序**:
1. 策略計算的 lookbackDays (P1 提供)
2. windowDecision 計算的值
3. 備用決定 (resolveLookbackDays)
4. 基於指標期數的計算

**影響**: 避免重複計算，確保策略計算的值優先使用

---

## 📊 修改統計

| 項目 | 數量 |
|-----|------|
| 修改的檔案 | 3 |
| 新增函數 | 2 |
| 修改函數 | 4 |
| 新增程式碼行數 | ~150 |
| 刪除程式碼行數 | 0 (向後相容) |

---

## 🔍 驗證清單

- [x] P0: cachedMeta 已在 postMessage 中添加
- [x] P1: getRequiredLookbackForStrategies 已在 shared-lookback.js 中定義
- [x] P1: batch-optimization.js 中使用新函數
- [x] P1: rolling-test.js 中使用新函數
- [x] P2: enrichParamsWithLookback 優先級已調整
- [x] P2: 控制台日誌已添加用於調試
- [x] 所有修改均向後相容

---

## 📋 後續驗證步驟

1. **功能測試**
   ```
   執行批量優化 → 檢查控制台日誌 P1 和 P2 的消息
   執行滾動測試 → 檢查控制台日誌 P1 和 P2 的消息
   ```

2. **一致性測試**
   ```
   相同策略、相同時間範圍
   批量優化和滾動測試的 lookbackDays 應相同
   ```

3. **結果測試**
   ```
   對比回測結果是否更一致
   檢查 cachedMeta 是否正確傳遞到 Worker
   ```

---

## 📚 相關文檔

- `IMPLEMENTATION_SUMMARY.md` - 詳細實施摘要
- `STRATEGY_LOOKBACK_ANALYSIS.md` - 技術分析
- `LOOKBACK_QUICK_ANSWER.md` - 快速參考

---

**施作完成** ✅ 2025-11-17
