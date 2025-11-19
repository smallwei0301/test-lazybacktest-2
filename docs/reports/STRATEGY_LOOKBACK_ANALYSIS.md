# 進出場策略 Lookback 計算與資料暖身分析

**時間**: 2025-11-17  
**分析重點**: 4項用戶需求分析

---

## 1️⃣ 每個進出場策略的 Lookback 計算方式

### 計算位置

檔案: `shared-lookback.js` (L1-357)  
核心函數: `getMaxIndicatorPeriod(params)` (L58-70)

### 計算公式

```javascript
function getMaxIndicatorPeriod(params = {}) {
    const tracker = new PeriodTracker();
    const groups = [
        params.entryParams,        // 進場策略參數
        params.exitParams,         // 出場策略參數
        params.shortEntryParams,   // 空頭進場參數
        params.shortExitParams,    // 空頭出場參數
        params.riskParams,         // 風險管理參數
    ];
    groups.forEach((group) => gatherPeriods(group, tracker));
    return tracker.value();  // 返回最大的期數值
}
```

### 具體計算邏輯

在 `gatherPeriods()` 函數中 (L17-41):

```javascript
function gatherPeriods(paramObj, tracker) {
    if (!paramObj || typeof paramObj !== 'object') return;
    const normalized = {};
    
    for (const key of Object.keys(paramObj)) {
        const value = toNumber(paramObj[key]);
        if (!Number.isFinite(value) || value <= 0) continue;
        
        const lowerKey = key.toLowerCase();
        normalized[lowerKey] = value;
        
        // ✅ 規則 1: 任何包含 'period' 或 'window' 的參數都記錄
        if (lowerKey.includes('period') || lowerKey.includes('window')) {
            tracker.add(value);
        }
        
        // ✅ 規則 2: 任何包含 'lookback' 或以 'length' 結尾的參數都記錄
        if (lowerKey.includes('lookback') || lowerKey.endsWith('length')) {
            tracker.add(value);
        }
        
        // ✅ 規則 3: ATR 週期特殊處理
        if (lowerKey === 'atrperiod') {
            tracker.add(value);
        }
    }
    
    // ✅ 規則 4: 組合期數計算
    if (Number.isFinite(normalized.longperiod) && Number.isFinite(normalized.signalperiod)) {
        tracker.add(normalized.longperiod + normalized.signalperiod);  // MACD
    }
    if (Number.isFinite(normalized.shortperiod) && Number.isFinite(normalized.signalperiod)) {
        tracker.add(normalized.shortperiod + normalized.signalperiod);  // EMA cross
    }
    if (Number.isFinite(normalized.kperiod) && Number.isFinite(normalized.dperiod)) {
        tracker.add(normalized.kperiod + normalized.dperiod);  // KD 隨機指標
    }
    if (Number.isFinite(normalized.kperiod) && Number.isFinite(normalized.smoothingperiod)) {
        tracker.add(normalized.kperiod + normalized.smoothingperiod);  // 平滑後的隨機指標
    }
}
```

### 常見策略的 Lookback 計算示例

| 策略名稱 | 參數結構 | 計算方式 | 最大期數 |
|---------|--------|--------|--------|
| **MA_cross** | `{ period: 20 }` | 最大期數 = 20 | 20 |
| **MACD_cross** | `{ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }` | 最大值 = max(26, 26+9) | 35 |
| **EMA_cross** | `{ shortPeriod: 9, longPeriod: 26 }` | 最大值 = 26 | 26 |
| **KD_RSI** | `{ kPeriod: 14, dPeriod: 3, rsiPeriod: 14 }` | 最大值 = max(14, 14+3, 14) | 17 |
| **多重指標** | `{ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }` | 組合計算 = slowPeriod + signalPeriod | 35 |

### 最終 Lookback 天數計算

在 `enrichParamsWithLookback()` 中 (batch-optimization.js L1781-1828):

```javascript
// 步驟 1: 取得最大指標期數
const fallbackMaxPeriod = sharedUtils.getMaxIndicatorPeriod(params);
// 範例結果: fallbackMaxPeriod = 35 (MACD 為例)

// 步驟 2: 根據最大期數計算所需暖身日數
let lookbackDays = sharedUtils.estimateLookbackBars(fallbackMaxPeriod, {
    minBars: 90,
    multiplier: 2
});

// 計算邏輯 (shared-lookback.js L72-87):
function estimateLookbackBars(maxPeriod, options = {}) {
    const multiplier = 2;          // 預設倍數
    const minBars = 90;             // 最少暖身天數
    const extraBars = 0;            // 額外日數
    
    const base = maxPeriod;         // 35 (假設 MACD)
    const scaled = base * multiplier; // 35 * 2 = 70
    const margin = Math.ceil(base * 0.5); // 35 * 0.5 ≈ 18
    
    const total = scaled + extraBars + margin; // 70 + 0 + 18 = 88
    const fallback = base + margin; // 35 + 18 = 53
    
    return Math.max(minBars, total, fallback); // Math.max(90, 88, 53) = 90
}
// 結果: lookbackDays = 90 (至少 90 天)
```

---

## 2️⃣ 初始回測時的暖身資料邏輯

### 當前實現位置

**檔案**: `batch-optimization.js` (L3360-3620)  
**函數**: `executeBacktestForCombination()`

### 當前邏輯 (問題: 使用固定暖身區間)

```javascript
const preparedParams = enrichParamsWithLookback(params);
const requiredRange = summarizeRequiredRangeFromParams(preparedParams);
const cachedUsage = buildCachedDatasetUsage(cachedPayload, requiredRange, { 
    batchOptimization: true 
});

// ❌ 問題: requiredRange 是基於預定義的訓練期，而非基於策略本身的 lookback
```

### 改進方案

```javascript
// ✅ 改進: 依據選定策略計算所需 lookback
async function executeBacktestForCombination(combination, options = {}) {
    // ... 其他代碼 ...
    
    const params = getBacktestParams();
    
    // ✅ 第一步: 從選定的進出場策略取得所需 lookback
    const entryStrategyInfo = strategyDescriptions[combination.buyStrategy];
    const exitStrategyInfo = strategyDescriptions[combination.sellStrategy];
    
    // ✅ 第二步: 計算進出場策略的最大 lookback
    const entryMaxPeriod = entryStrategyInfo?.maxPeriod || 0;  // 從策略定義取得
    const exitMaxPeriod = exitStrategyInfo?.maxPeriod || 0;
    const maxStrategyPeriod = Math.max(entryMaxPeriod, exitMaxPeriod);
    
    // ✅ 第三步: 計算所需暖身日數
    const requiredLookbackDays = estimateLookbackBars(maxStrategyPeriod, {
        minBars: 90,
        multiplier: 2
    });
    
    // ✅ 第四步: 根據策略暖身日數決定資料開始日期
    const effectiveStartDate = params.startDate;  // 回測實際開始日期
    const dataStartDate = computeBufferedStartDate(
        effectiveStartDate,
        requiredLookbackDays,
        {
            minDate: MIN_DATA_DATE,
            marginTradingDays: 12,
            extraCalendarDays: 7
        }
    );
    
    const enrichedParams = {
        ...params,
        lookbackDays: requiredLookbackDays,
        dataStartDate,
        effectiveStartDate
    };
    
    // ... 繼續回測 ...
}
```

### 暖身資料計算示例

假設：
- 選定策略: MACD (maxPeriod = 35)
- 回測開始日期: 2024-01-01
- 訓練期: 2023-01-01 至 2024-01-01

計算過程：

```
1. entryMaxPeriod (MACD) = 35
2. exitMaxPeriod (MA_cross) = 20
3. maxStrategyPeriod = Math.max(35, 20) = 35

4. requiredLookbackDays = estimateLookbackBars(35, {minBars: 90, multiplier: 2})
   = Math.max(90, 70+18, 35+18)
   = 90 天

5. dataStartDate = computeBufferedStartDate('2024-01-01', 90, {...})
   = 向前推算 90 個交易日
   = 大約 2023-08-15 左右

✅ 資料暖身區間: 2023-08-15 至 2024-01-01 (90 個交易日)
```

---

## 3️⃣ 滾動測試與批量優化的資料開始日期統一邏輯

### 當前問題對比

| 項目 | 滾動測試 | 批量優化 | 狀態 |
|------|---------|---------|------|
| **Lookback 計算來源** | 訓練期特定策略 | 全局固定策略 | ⚠️ 不統一 |
| **資料開始日期決定** | `prepareWorkerPayload()` | `enrichParamsWithLookback()` | ⚠️ 邏輯分散 |
| **多個策略時的 Lookback** | N/A (單一策略) | 需取最大值 | ❌ 未實現 |

### 統一方案架構

```
┌─────────────────────────────────────────┐
│  用戶選擇進出場策略組合                  │
├─────────────────────────────────────────┤
│ 滾動測試:                               │
│ 1. 讀取 rolling-test.js 中的策略 ID     │
│ 2. 查詢 strategyDescriptions            │
│ 3. 計算該策略的 maxPeriod               │
│                                         │
│ 批量優化 (多策略):                      │
│ 1. 遍歷選定的進出場策略                 │
│ 2. 各自計算 maxPeriod                   │
│ 3. 取最大值: maxPeriod = max(all)       │
├─────────────────────────────────────────┤
│ 共同邏輯:                               │
│ 1. 計算 lookbackDays = estimateLookbackBars()
│ 2. 計算 dataStartDate = computeBufferedStartDate()
│ 3. 傳遞給 Worker: {                     │
│     dataStartDate,                      │
│     effectiveStartDate,                 │
│     lookbackDays                        │
│   }                                     │
└─────────────────────────────────────────┘
```

### 實現位置

#### 建議 1: 提取公用函數 (在 shared-lookback.js)

```javascript
function getRequiredLookbackForStrategies(strategyIds, sharedUtils) {
    let maxPeriod = 0;
    
    strategyIds.forEach(strategyId => {
        const strategyInfo = strategyDescriptions[strategyId];
        if (!strategyInfo) return;
        
        // 取得策略參數的最大期數
        const strategyParams = strategyInfo.defaultParams || {};
        const periodInThisStrategy = sharedUtils.getMaxIndicatorPeriod(strategyParams);
        
        if (periodInThisStrategy > maxPeriod) {
            maxPeriod = periodInThisStrategy;
        }
    });
    
    // 計算最終所需暖身日數
    return sharedUtils.estimateLookbackBars(maxPeriod, {
        minBars: 90,
        multiplier: 2
    });
}
```

#### 建議 2: 在 rolling-test.js 中使用

```javascript
function runSingleWindow(windowStart, windowEnd) {
    // ... 現有代碼 ...
    
    // ✅ 統一使用策略基礎 lookback
    const requiredLookback = getRequiredLookbackForStrategies(
        [selectedEntryStrategy, selectedExitStrategy],
        lazybacktestShared
    );
    
    const payload = prepareWorkerPayload({
        ...existing_params,
        lookbackDays: requiredLookback,  // ✅ 使用策略決定的值
    });
}
```

#### 建議 3: 在 batch-optimization.js 中使用

```javascript
async function executeBacktestForCombination(combination) {
    // ... 現有代碼 ...
    
    // ✅ 統一使用策略基礎 lookback
    const selectedStrategies = [
        combination.buyStrategy,
        combination.sellStrategy
    ].filter(s => s);
    
    if (combination.shortEntryStrategy) selectedStrategies.push(combination.shortEntryStrategy);
    if (combination.shortExitStrategy) selectedStrategies.push(combination.shortExitStrategy);
    
    const requiredLookback = getRequiredLookbackForStrategies(
        selectedStrategies,
        lazybacktestShared
    );
    
    const preparedParams = enrichParamsWithLookback({
        ...params,
        lookbackDays: requiredLookback,  // ✅ 使用所有策略的最大值
    });
}
```

---

## 4️⃣ 批量優化對 cachedMeta 的取用情況

### 當前狀態: ❌ 未取用

#### 位置 1: postMessage 缺少 cachedMeta

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

#### 位置 2: 滾動測試有正確傳遞

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
    cachedMeta: buildCachedMeta()  // ✅ 有傳遞
};
```

### cachedMeta 的用途

**檔案**: `rolling-test.js` L2777-2795

```javascript
function buildCachedMeta() {
    const dataDebug = lastOverallResult?.dataDebug || {};
    const coverage = computeCoverageFromRows(cachedStockData);
    
    return {
        summary: dataDebug.summary || null,              // 數據摘要
        adjustments: dataDebug.adjustments || [],        // 數據調整記錄
        debugSteps: dataDebug.debugSteps || [],          // 調試步驟
        adjustmentFallbackApplied: dataDebug.adjustmentFallbackApplied,  // 是否使用備用調整
        priceSource: dataDebug.priceSource || null,      // 價格來源
        dataSource: dataDebug.dataSource || null,        // 數據源
        splitDiagnostics: dataDebug.splitDiagnostics || null,  // 股票分割診斷
        diagnostics: lastDatasetDiagnostics || null,     // 數據集診斷
        coverage,                                         // 覆蓋率
        fetchRange: dataDebug.fetchRange || null,        // 取得的日期範圍
    };
}
```

### Worker 如何使用 cachedMeta

**檔案**: `worker.js` L13015-13030 (onmessage 中)

```javascript
self.onmessage = function(e) {
    // ... 解析消息 ...
    
    const cachedMeta = e.data.cachedMeta || null;
    
    // ✅ 使用 cachedMeta 進行驗證
    if (cachedMeta) {
        // 驗證數據調整
        if (cachedMeta.adjustmentFallbackApplied) {
            console.log('[Worker] Data adjustment fallback was applied');
        }
        
        // 檢查覆蓋率
        if (cachedMeta.coverage) {
            validateCoverage(cachedMeta.coverage);
        }
        
        // 記錄股票分割診斷
        if (cachedMeta.splitDiagnostics) {
            console.log('[Worker] Split diagnostics:', cachedMeta.splitDiagnostics);
        }
    }
    
    // ... 執行回測 ...
};
```

### 批量優化缺少 cachedMeta 的影響

| 功能 | 滾動測試 | 批量優化 | 影響 |
|------|---------|---------|------|
| **數據調整驗證** | ✅ 可驗證 | ❌ 無法驗證 | 可能使用不同的調整方式 |
| **覆蓋率檢查** | ✅ 可檢查 | ❌ 無法檢查 | 無法確認數據完整性 |
| **股票分割診斷** | ✅ 有診斷 | ❌ 無診斷 | 可能對分割處理不同 |
| **回測結果一致性** | ✅ 一致 | ⚠️ 可能不同 | 結果可能存在差異 |

### 改進方案

#### 步驟 1: 在 batch-optimization.js 中構建 cachedMeta

```javascript
// 類似滾動測試的 buildCachedMeta()
function buildBatchCachedMeta(preparedParams) {
    // 從全局緩存取得元數據
    const cachedEntry = cachedDataStore?.get(generateCacheKey(preparedParams));
    
    if (!cachedEntry) {
        return null;  // 無緩存時返回 null
    }
    
    return {
        summary: cachedEntry.summary || null,
        adjustments: cachedEntry.adjustments || [],
        debugSteps: cachedEntry.debugSteps || [],
        adjustmentFallbackApplied: Boolean(cachedEntry.adjustmentFallbackApplied),
        priceSource: cachedEntry.priceSource || null,
        dataSource: cachedEntry.dataSource || null,
        splitDiagnostics: cachedEntry.splitDiagnostics || null,
        diagnostics: cachedEntry.diagnostics || null,
        coverage: cachedEntry.coverage || null,
        fetchRange: cachedEntry.fetchRange || null,
    };
}
```

#### 步驟 2: 在 executeBacktestForCombination 中使用

```javascript
async function executeBacktestForCombination(combination) {
    // ... 現有代碼 ...
    
    const cachedMeta = buildBatchCachedMeta(preparedParams);
    
    tempWorker.postMessage({
        type: 'runBacktest',
        params: preparedParams,
        useCachedData,
        cachedData: cachedDataForWorker,
        cachedMeta  // ✅ 新增此字段
    });
}
```

---

## 📋 總結對比表

| 需求 | 當前狀態 | 改進方案 | 優先級 |
|------|---------|---------|------|
| **1. 每個策略 Lookback 計算** | ✅ 已實現 | 提取計算邏輯供重用 | 中 |
| **2. 初始回測暖身資料** | ⚠️ 固定值 | 根據策略動態計算 | 🔴 高 |
| **3. 統一資料開始日期** | ❌ 邏輯分散 | 提取公用函數統一 | 🔴 高 |
| **4. 批量優化 cachedMeta** | ❌ 未取用 | 構建並傳遞 | 🟡 中 |

---

## 🔧 實現優先順序

1. **優先級 1 (立即)**: 修改 `batch-optimization.js` 在 postMessage 中添加 `cachedMeta`
2. **優先級 2 (次要)**: 在 `shared-lookback.js` 提取 `getRequiredLookbackForStrategies()` 函數
3. **優先級 3 (優化)**: 在 `rolling-test.js` 和 `batch-optimization.js` 中使用統一函數
4. **優先級 4 (增強)**: 添加調試日誌記錄策略-Lookback 的對應關係
