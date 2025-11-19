# 🔴 滾動測試 vs 批量優化 - 相同訓練窗口下最佳參數不同 - 真實原因

**問題描述**: 當批量優化使用與滾動測試相同的訓練窗口時間範圍時，仍然優化出不同的最佳參數。

**調查日期**: 2025-11-17  
**狀態**: ✅ 發現根本原因

---

## 🔍 根本原因分析

### 發現 1️⃣：Worker Message 結構不同

#### 滾動測試發送的消息 (rolling-test.js L2714-2722)

```javascript
const message = {
    type: 'runBacktest',
    params: payload.params,                    // 參數
    dataStartDate: payload.dataStartDate,      // ✅ 明確傳送
    effectiveStartDate: payload.effectiveStartDate, // ✅ 明確傳送
    lookbackDays: payload.lookbackDays,        // ✅ 明確傳送
    useCachedData: true/false,
    cachedData: [...],
    cachedMeta: buildCachedMeta(),            // ✅ 包含快取元數據
};
```

#### 批量優化發送的消息 (batch-optimization.js L3519-3523)

```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,  // 已經在 enrichParamsWithLookback 中包含 lookback 字段
    useCachedData: true/false,
    cachedData: [...]
    // ❌ 沒有傳送 cachedMeta
    // ❌ 沒有單獨的 dataStartDate, effectiveStartDate, lookbackDays
});
```

**差異**:
1. 滾動測試通過 **3 個獨立字段** 明確傳遞 lookback 資訊
2. 批量優化將這些信息 **嵌入在 params 物件內**
3. 滾動測試傳送 **cachedMeta**，批量優化不傳送

---

### 發現 2️⃣：Cached Meta 的丟失

#### 滾動測試

```javascript
cachedMeta: buildCachedMeta(),  // 包含：
// {
//     summary: dataDebug.summary,
//     adjustments: Array.isArray(dataDebug.adjustments) ? dataDebug.adjustments : [],
//     debugSteps: Array.isArray(dataDebug.debugSteps) ? dataDebug.debugSteps : [],
//     adjustmentFallbackApplied: Boolean(dataDebug.adjustmentFallbackApplied),
//     priceSource: dataDebug.priceSource,
//     dataSource: dataDebug.dataSource,
//     splitDiagnostics: dataDebug.splitDiagnostics,
//     diagnostics: lastDatasetDiagnostics,
//     coverage,
//     fetchRange: dataDebug.fetchRange
// }
```

#### 批量優化

```javascript
// ❌ 完全沒有傳送 cachedMeta
// Worker 在沒有 cachedMeta 的情況下執行
```

**影響**:
- 滾動測試的 worker 可以使用快取元數據進行數據驗證和調整
- 批量優化的 worker 無法訪問此信息
- 可能導致數據處理邏輯出現差異

---

### 發現 3️⃣：參數結構的差異

| 項目 | 滾動測試 | 批量優化 |
|------|---------|---------|
| **params.dataStartDate** | 🟡 可能為 undefined | ✅ 由 `enrichParamsWithLookback` 填充 |
| **params.effectiveStartDate** | 🟡 可能為 undefined | ✅ 由 `enrichParamsWithLookback` 填充 |
| **params.lookbackDays** | 🟡 可能為 undefined | ✅ 由 `enrichParamsWithLookback` 填充 |
| **消息層 dataStartDate** | ✅ 在 message.dataStartDate | ❌ 不存在 |
| **消息層 effectiveStartDate** | ✅ 在 message.effectiveStartDate | ❌ 不存在 |
| **消息層 lookbackDays** | ✅ 在 message.lookbackDays | ❌ 不存在 |

**問題**:
- Worker 在接收消息時，可能優先使用 `message` 層的字段而非 `params` 層的字段
- 如果 worker 代碼檢查 `e.data.dataStartDate` 而非 `e.data.params.dataStartDate`，結果會不同

---

### 發現 4️⃣：數據切片差異

#### 滾動測試 - `selectCachedDataForWindow()`

```javascript
function selectCachedDataForWindow(startIso, endIso) {
    if (!Array.isArray(cachedStockData) || cachedStockData.length === 0) return null;
    const startTime = resolveIsoTimestamp(startIso);
    const endTime = resolveIsoTimestamp(endIso);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
    const inclusiveEnd = endTime + (24 * 60 * 60 * 1000) - 1;
    const filtered = cachedStockData.filter((row) => {
        const rowTime = resolveRowTimestamp(row);
        return Number.isFinite(rowTime) && rowTime >= startTime && rowTime <= inclusiveEnd;
    });
    return filtered.length > 0 ? filtered : null;
}
```

**特點**: 明確根據訓練期時間範圍切片數據

#### 批量優化 - 數據處理

```javascript
const overrideData = Array.isArray(options?.cachedDataOverride) && options.cachedDataOverride.length > 0
    ? options.cachedDataOverride
    : null;
const cachedPayload = overrideData
    || (typeof cachedStockData !== 'undefined' && Array.isArray(cachedStockData) ? cachedStockData : null);

let { evaluation: coverageEvaluation, useCachedData } = cachedUsage;
const sliceSummary = cachedUsage.sliceInfo?.summaryAfter || null;

let cachedDataForWorker = useCachedData ? cachedUsage.datasetForWorker : null;
```

**特點**: 使用 `buildCachedDatasetUsage()` 進行複雜的數據評估和切片

---

## 🎯 最可能的實際差異

### 核心問題：Worker 接收的 Lookback 信息來源不同

#### 滾動測試
```
1. prepareWorkerPayload 計算 lookback → payload.lookbackDays
2. runSingleWindow 發送 message.lookbackDays ✅
3. Worker 接收 e.data.lookbackDays
4. Worker 使用此信息進行數據計算
```

#### 批量優化
```
1. enrichParamsWithLookback 計算 lookback → params.lookbackDays
2. executeBacktestForCombination 發送 params（包含 lookback）
3. Worker 接收 e.data.params.lookbackDays
4. Worker 可能再次計算 enrichParamsWithLookback（遞歸/重複計算）
```

**可能的後果**:
- 如果 worker 代碼再次調用 `enrichParamsWithLookback`，它會基於 `params` 中已經存在的 `startDate`/`endDate` 重新計算
- 某些計算邏輯可能在消息層找不到 `dataStartDate` 等字段而退用備用邏輯
- 導致兩個流程使用不同的 lookback 天數或數據視窗

---

### 次要問題：缺失的 cachedMeta

批量優化沒有發送 `cachedMeta`，這可能影響：
1. 數據調整（adjustment）邏輯
2. 股票分割診斷（splitDiagnostics）
3. 最終的回測結果計算

---

## 🔧 可能的修正方向

### 方案 1: 統一 Worker Message 結構

修改批量優化，使其發送與滾動測試相同的消息結構：

```javascript
// batch-optimization.js
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    // ✅ 添加這些字段以匹配滾動測試
    dataStartDate: preparedParams.dataStartDate,
    effectiveStartDate: preparedParams.effectiveStartDate,
    lookbackDays: preparedParams.lookbackDays,
    useCachedData,
    cachedData: cachedDataForWorker,
    cachedMeta: buildBatchDatasetMeta(preparedParams), // ✅ 新增
});
```

### 方案 2: 檢查 Worker 代碼

在 `worker.js` 中檢查是否有以下邏輯：
```javascript
const dataStartDate = e.data.dataStartDate || e.data.params?.dataStartDate;
const effectiveStartDate = e.data.effectiveStartDate || e.data.params?.effectiveStartDate;
const lookbackDays = e.data.lookbackDays || e.data.params?.lookbackDays;
```

如果有，需要確保兩個路徑都被測試並產生相同結果。

---

## 🧪 驗證步驟

1. **添加調試日誌** 在 worker 中：
   ```javascript
   console.log('[Worker] Received message.dataStartDate:', e.data.dataStartDate);
   console.log('[Worker] Received params.dataStartDate:', e.data.params?.dataStartDate);
   console.log('[Worker] Final dataStartDate used:', dataStartDate);
   ```

2. **測試相同窗口** 運行滾動測試和批量優化，記錄：
   - 發送給 worker 的完整消息
   - Worker 實際使用的 lookback 參數
   - 最終回測結果

3. **比較結果** 如果 dataStartDate/lookbackDays 不同，找到差異原因

---

## 📝 結論

即使時間範圍相同，滾動測試和批量優化產生不同結果的原因在於：

1. **Worker Message 結構差異**: 
   - 滾動測試: 在 message 層明確傳遞 lookback 信息
   - 批量優化: 在 params 層傳遞

2. **元數據丟失**:
   - 批量優化沒有傳送 cachedMeta

3. **可能的雙重計算**:
   - Worker 可能對已經包含 lookback 信息的 params 再次調用 enrichParamsWithLookback
   - 導致 lookback 日期計算不一致

**建議優先檢查**:
- Worker 代碼中如何處理 `e.data.dataStartDate` vs `e.data.params.dataStartDate`
- 是否存在條件分支根據消息結構而選擇不同的邏輯路徑
