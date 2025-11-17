# 滾動測試與批量優化參數優化差異調查報告

**調查日期**: 2025-11-17  
**問題描述**: 滾動測試的參數優化功能與批量優化功能產生不同的最佳參數結果，儘管兩者應使用相同的 worker 和前置作業。  
**調查結論**: ✅ 發現關鍵差異，需要修正

---

## 📋 調查摘要

兩個功能在參數優化階段的差異主要源於：

1. **前置參數處理的差異**: 滾動測試在優化前清除了 lookback 相關字段，導致 worker 每次都重新計算
2. **參數計算的時機**: 兩個功能使用 `enrichParamsWithLookback` 的位置和時機不同
3. **Window 時間範圍**: 滾動測試使用訓練期時間範圍，批量優化可能使用全局時間範圍

---

## 🔍 詳細差異分析

### 差異 1: 參數清除邏輯

#### 滾動測試中 (rolling-test.js)

**位置**: Line 3142-3178

```javascript
function normalizeWindowBaseParams(target, windowInfo) {
    if (!target || typeof target !== 'object') return;
    if (windowInfo?.trainingStart) target.startDate = windowInfo.trainingStart;
    if (windowInfo?.trainingEnd) target.endDate = windowInfo.trainingEnd;
    stripRelativeRangeControls(target);
    clearWindowDerivedFields(target);  // ⚠️ 這裡清除了 lookback 字段
    // ...
}

function clearWindowDerivedFields(target) {
    ['dataStartDate', 'effectiveStartDate', 'lookbackDays'].forEach((key) => {
        if (key in target) delete target[key];  // ⚠️ 刪除所有 lookback 相關字段
    });
}
```

**流程**:
1. 在 `optimizeParametersForWindow` 中調用 `normalizeWindowBaseParams(outputParams, windowInfo)`
2. 此函數 **刪除** 已存在的 `dataStartDate`、`effectiveStartDate`、`lookbackDays`
3. 隨後在每次優化時，worker 內的 `enrichParamsWithLookback` 會重新計算這些字段

#### 批量優化中 (batch-optimization.js)

**位置**: Line 1781-1828

```javascript
function enrichParamsWithLookback(params) {
    // ...
    return {
        ...params,
        effectiveStartDate,
        dataStartDate,
        lookbackDays,
    };
}
```

**流程**:
1. 在 worker 消息處理時，優化任務發送的參數 **未經過** `normalizeWindowBaseParams` 清除
2. 如果參數中已存在 lookback 字段，會直接使用；如果不存在，才會重新計算
3. 使用全局時間範圍（通常是整個數據集時間範圍）

---

### 差異 2: 時間範圍的差異

#### 滾動測試

參數準備流程 (Line 3229):

```javascript
const workingParams = deepClone(baseWindowParams);
normalizeWindowBaseParams(workingParams, windowInfo);
```

**時間範圍設定**:
- `startDate`: 設置為 `windowInfo.trainingStart`（訓練期開始）
- `endDate`: 設置為 `windowInfo.trainingEnd`（訓練期結束）
- 使用 **訓練窗口的時間範圍**

#### 批量優化

參數發送流程 (Line 1654-1661):

```javascript
optimizeWorker.postMessage({
    type: "runOptimization",
    params: params,  // ⚠️ 未經過 normalizeWindowBaseParams 處理
    // ...
    cachedData: typeof cachedStockData !== "undefined" ? cachedStockData : null,
})
```

**時間範圍設定**:
- 使用參數原始的 `startDate` 和 `endDate`
- 可能是全局時間範圍，而非特定的訓練窗口
- 數據視窗的計算基於全局參數

---

### 差異 3: enrichParamsWithLookback 的執行時機

#### 滾動測試中

1. 在 `prepareWorkerPayload()` 中調用（Line 2768）
2. 但 **之前已經清除** 了這些字段（`clearWindowDerivedFields`）
3. 每次優化迭代都會重新計算
4. 基於 **訓練窗口時間範圍** 重新計算

#### 批量優化中

1. 在 worker 內接收到 `runOptimization` 消息時調用
2. 參數字段 **未被清除**，可能保留之前的計算結果
3. 基於參數中的 **原始時間範圍** 計算
4. 更容易重複使用之前的計算結果

---

### 差異 4: Worker 接收的參數差異

#### 滾動測試發送的參數

```javascript
{
    startDate: "2024-01-01",    // 訓練期開始
    endDate: "2024-06-30",      // 訓練期結束
    dataStartDate: undefined,   // ❌ 已被清除
    effectiveStartDate: undefined, // ❌ 已被清除
    lookbackDays: undefined,    // ❌ 已被清除
    entryParams: { ... },
    exitParams: { ... },
    // ... 其他參數
}
```

Worker 接收後會在 `enrichParamsWithLookback` 中重新計算：
- 基於訓練期時間範圍計算 `lookbackDays`
- 計算結果用於 **該訓練期的優化**

#### 批量優化發送的參數

```javascript
{
    startDate: "2020-01-01",    // 全局開始
    endDate: "2024-12-31",      // 全局結束
    dataStartDate: "2019-01-01", // ✅ 可能保留
    effectiveStartDate: "2020-01-01", // ✅ 可能保留
    lookbackDays: 180,          // ✅ 可能保留
    entryParams: { ... },
    exitParams: { ... },
    // ... 其他參數
}
```

Worker 接收後：
- 如果字段已存在，可能直接使用（取決於 `enrichParamsWithLookback` 的邏輯）
- 基於全局時間範圍的 lookback 設置進行優化

---

## 🎯 差異導致的最終影響

| 方面 | 滾動測試 | 批量優化 | 影響 |
|------|---------|---------|------|
| **時間範圍** | 訓練期時間窗 | 全局時間範圍 | ⚠️ 數據窗口大小不同 |
| **Lookback 計算** | 每次重新計算 | 可能重複使用 | ⚠️ Lookback 期間不同 |
| **參數清除** | 清除所有 lookback 字段 | 不清除 | ⚠️ 計算邏輯不同 |
| **最終參數** | 基於訓練期最優 | 基於全局最優 | ❌ **結果不同** |

---

## 💡 根本原因

### 主要原因

在 `normalizeWindowBaseParams()` 函數中的 `clearWindowDerivedFields()` 實現：

```javascript
function clearWindowDerivedFields(target) {
    ['dataStartDate', 'effectiveStartDate', 'lookbackDays'].forEach((key) => {
        if (key in target) delete target[key];  // ⚠️ 無條件刪除
    });
}
```

**問題**:
1. 這個清除操作會導致每次優化都需要重新計算 lookback 參數
2. 重新計算基於訓練期時間範圍，而非全局時間範圍
3. 導致兩個功能使用的數據窗口大小不同

### 次要原因

在 `enrichParamsWithLookback()` 的邏輯中，批量優化可能沒有清除字段，導致：
1. 保留之前計算的 lookback 參數
2. 基於全局時間範圍的參數進行優化
3. 最終優化結果基於不同的數據集

---

## 📝 修正建議

### 方案 1: 統一參數處理 (推薦)

**修改位置**: `clearWindowDerivedFields()` 和優化前的參數準備

**目標**: 確保兩個功能都以相同的方式準備 lookback 參數

**步驟**:

1. **在滾動測試中**，在優化前應用 `enrichParamsWithLookback`，而 **不是** 清除字段：

```javascript
// 舊做法 - 清除字段導致不一致
function clearWindowDerivedFields(target) {
    ['dataStartDate', 'effectiveStartDate', 'lookbackDays'].forEach((key) => {
        if (key in target) delete target[key];
    });
}

// 新做法 - 使用統一的 enrichParamsWithLookback
const workingParams = deepClone(baseWindowParams);
normalizeWindowBaseParams(workingParams, windowInfo);
// 不清除 lookback 字段，而是確保它們已被正確計算
const enrichedParams = enrichParamsWithLookback(workingParams);
```

2. **在批量優化中**，確保也清除並重新計算（保持一致性）

### 方案 2: 修改 clearWindowDerivedFields 的邏輯

**修改位置**: `rolling-test.js` 的 `clearWindowDerivedFields()` 函數

**目標**: 而不是無條件刪除字段，改為有條件地準備它們

```javascript
function clearWindowDerivedFields(target) {
    // 替代：不清除，而是準備
    // 在調用前確保已調用 enrichParamsWithLookback
    // 或只在需要時清除
}
```

---

## ✅ 驗證方法

要驗證這個假設是否正確，可以：

1. **添加調試日誌**:
   - 在滾動測試優化前後記錄 `dataStartDate`, `effectiveStartDate`, `lookbackDays`
   - 在批量優化優化前後記錄相同的字段
   - 比較兩者的值

2. **測試執行**:
   - 使用相同的參數和時間範圍運行滾動測試和批量優化
   - 記錄優化結果的最佳參數
   - 驗證結果是否相同

3. **代碼追蹤**:
   - 在 `enrichParamsWithLookback` 中添加日誌
   - 在 worker 中添加日誌
   - 追蹤參數的完整轉換路徑

---

## 📌 相關代碼位置

### 滾動測試

- `rolling-test.js` Line 3142-3178: `normalizeWindowBaseParams()` 和 `clearWindowDerivedFields()`
- `rolling-test.js` Line 3189-3350: `optimizeParametersForWindow()`
- `rolling-test.js` Line 3484-3650: `optimizeStrategyScopeForWindow()`
- `rolling-test.js` Line 2796-2870: `enrichParamsWithLookback()`

### 批量優化

- `batch-optimization.js` Line 1781-1828: `enrichParamsWithLookback()`
- `batch-optimization.js` Line 1561-1700: `optimizeSingleStrategyParameter()`
- `batch-optimization.js` Line 948-1050: `optimizeStrategyWithInternalConvergence()`

---

## 🎓 結論

滾動測試和批量優化在參數優化階段存在以下關鍵差異：

1. **參數清除邏輯不同**: 滾動測試清除 lookback 字段，批量優化保留
2. **時間範圍不同**: 滾動測試基於訓練窗口，批量優化基於全局時間
3. **Lookback 計算時機不同**: 導致使用的數據窗口大小不同
4. **最終結果**: 優化出的最佳參數必然不同，因為基於不同的數據集

**修正重點**: 需要統一 `normalizeWindowBaseParams()` 的處理邏輯，確保兩個功能都使用相同的 lookback 參數準備方式。
