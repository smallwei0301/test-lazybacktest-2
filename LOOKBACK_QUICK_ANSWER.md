# 快速回答 - 4項用戶需求

---

## 1️⃣ 每個進出場策略的最大 Lookback 日期計算

### 答案概述

**計算位置**: `shared-lookback.js` → `getMaxIndicatorPeriod(params)`

**公式**:
```
最大期數 = 掃描所有策略參數中最大的 period/window/length 值

常見例子:
- MA(20) → 最大期數 = 20
- MACD(12,26,9) → 最大期數 = 26 + 9 = 35 ✅ (組合計算)
- EMA_cross(9,26) → 最大期數 = 26

最終暖身日數 = max(90, maxPeriod × 2 + margin)
```

### 相關程式碼位置

| 檔案 | 行號 | 函數 |
|-----|------|------|
| `shared-lookback.js` | 17-41 | `gatherPeriods()` |
| `shared-lookback.js` | 58-70 | `getMaxIndicatorPeriod()` |
| `shared-lookback.js` | 72-87 | `estimateLookbackBars()` |

---

## 2️⃣ 執行初始回測時的暖身資料選擇

### 當前狀態: ❌ 使用固定暖身區間

### 需要改進的地方

**檔案**: `batch-optimization.js` L3443

```javascript
// ❌ 當前: 直接使用預定義的訓練期
const preparedParams = enrichParamsWithLookback(params);

// ✅ 應改為: 根據選定策略計算 lookback
const selectedStrategies = [combination.buyStrategy, combination.sellStrategy];
const requiredLookbackDays = calculateLookbackFromStrategies(selectedStrategies);
const preparedParams = enrichParamsWithLookback({
    ...params,
    lookbackDays: requiredLookbackDays
});
```

### 改進方案

1. 從 `strategyDescriptions` 取得選定的進出場策略
2. 各自計算該策略的 `maxPeriod`
3. 調用 `estimateLookbackBars(maxPeriod)` 得到暖身日數
4. 用此日數決定資料開始日期 (`dataStartDate`)

---

## 3️⃣ 滾動測試與批量優化的資料開始日期統一

### 當前問題

| 地方 | 計算方式 | 狀態 |
|-----|---------|------|
| 滾動測試 | `rolling-test.js` L2777 | 各自計算 |
| 批量優化 | `batch-optimization.js` L3443 | 各自計算 |
| **結果** | 邏輯分散在兩個檔案 | ⚠️ 不同步 |

### 統一方案

**提取公用函數** (建議放在 `shared-lookback.js`):

```javascript
function getRequiredLookbackForStrategies(strategyIds) {
    let maxPeriod = 0;
    
    strategyIds.forEach(strategyId => {
        const strategyInfo = strategyDescriptions[strategyId];
        const periodInStrategy = getMaxIndicatorPeriod(
            strategyInfo?.defaultParams || {}
        );
        maxPeriod = Math.max(maxPeriod, periodInStrategy);
    });
    
    return estimateLookbackBars(maxPeriod, {
        minBars: 90,
        multiplier: 2
    });
}
```

**在兩個地方都使用此函數**:
- `rolling-test.js`: `runSingleWindow()` 中
- `batch-optimization.js`: `executeBacktestForCombination()` 中

---

## 4️⃣ 批量優化對 cachedMeta 的取用情況

### 答案: ❌ 目前完全未取用

### 詳細情況

#### 滾動測試 ✅ 有傳遞 cachedMeta

**檔案**: `rolling-test.js` L2714-2722

```javascript
const message = {
    type: 'runBacktest',
    params: payload.params,
    dataStartDate: payload.dataStartDate,
    effectiveStartDate: payload.effectiveStartDate,
    lookbackDays: payload.lookbackDays,
    useCachedData: true,
    cachedData: [...],
    cachedMeta: buildCachedMeta()  // ✅ 傳遞了
};
```

#### 批量優化 ❌ 沒有傳遞 cachedMeta

**檔案**: `batch-optimization.js` L3592-3596

```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData,
    cachedData: cachedDataForWorker
    // ❌ 缺少 cachedMeta
});
```

### cachedMeta 的內容結構

```javascript
{
    summary: null,                      // 數據摘要
    adjustments: [],                    // 數據調整記錄
    debugSteps: [],                     // 調試步驟
    adjustmentFallbackApplied: false,   // 備用調整標記
    priceSource: null,                  // 價格來源
    dataSource: null,                   // 數據源
    splitDiagnostics: null,             // 股票分割診斷
    diagnostics: null,                  // 數據集診斷
    coverage: null,                     // 數據覆蓋率
    fetchRange: null,                   // 取得的日期範圍
}
```

### 修復方案

在 `batch-optimization.js` 中新增函數:

```javascript
function buildBatchCachedMeta(preparedParams) {
    // 從全局數據存儲取得緩存的元數據
    // 構造與滾動測試相同結構的 cachedMeta
}
```

在 `executeBacktestForCombination()` 中:

```javascript
const cachedMeta = buildBatchCachedMeta(preparedParams);

tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData,
    cachedData: cachedDataForWorker,
    cachedMeta  // ✅ 新增此字段
});
```

### 影響範圍

| 功能 | 沒有 cachedMeta 的後果 |
|-----|-------------------|
| 數據調整驗證 | 無法驗證調整邏輯是否相同 |
| 覆蓋率檢查 | 無法確認數據完整性 |
| 股票分割診斷 | 無法獲得分割診斷信息 |
| **結果一致性** | ⚠️ **滾動測試和批量優化結果可能不同** |

---

## 📌 建議實施順序

1. **立即** (P0): 修復批量優化的 `cachedMeta` 缺失
2. **次要** (P1): 統一資料開始日期計算邏輯
3. **優化** (P2): 根據策略動態計算暖身日數

詳見: `STRATEGY_LOOKBACK_ANALYSIS.md`
