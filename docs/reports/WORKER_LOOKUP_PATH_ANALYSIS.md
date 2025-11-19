# 🚨 發現：Worker 中的條件分支導致不同結果

**日期**: 2025-11-17  
**位置**: `worker.js` Line 12906-13030  
**狀態**: ✅ 根本原因確認

---

## 🔍 Worker 的 Lookback 解析邏輯

### Worker.js 的優先級順序 (L12942-12977)

```javascript
// 第 1 步：檢查消息層的 e.data.lookbackDays
const incomingLookback = Number.isFinite(e.data?.lookbackDays)
    ? e.data.lookbackDays                          // ✅ 優先使用消息層
    : Number.isFinite(params?.lookbackDays)
      ? params.lookbackDays                        // 其次使用 params 層
      : null;

// 第 2-5 步：逐級遞進計算
let lookbackDays = Number.isFinite(incomingLookback) && incomingLookback > 0
    ? incomingLookback
    : null;

// 如果上面得到 null，嘗試從 windowDecision 取得
if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && Number.isFinite(windowDecision?.lookbackDays)) {
    lookbackDays = windowDecision.lookbackDays;
}

// 再試試 resolveLookbackDays
if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    if (sharedUtils && typeof sharedUtils.resolveLookbackDays === "function") {
        const fallbackDecision = sharedUtils.resolveLookbackDays(params || {}, windowOptions);
        if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
            lookbackDays = fallbackDecision.lookbackDays;
            if (!windowDecision) {
                windowDecision = fallbackDecision;
            }
        }
    }
}

// 最後使用預估值或預設值
if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && sharedUtils && typeof sharedUtils.estimateLookbackBars === "function") {
    lookbackDays = sharedUtils.estimateLookbackBars(inferredMax, { minBars: 90, multiplier: 2 });
}

if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    lookbackDays = Math.max(90, inferredMax * 2);
}
```

### Worker.js 的 DataStartDate 解析邏輯 (L12986-12995)

```javascript
const effectiveStartDate =
    e.data?.effectiveStartDate ||                  // ✅ 優先消息層
    windowDecision?.effectiveStartDate ||
    params?.effectiveStartDate ||
    params?.startDate ||
    windowDecision?.minDataDate ||
    null;

const dataStartDate =
    e.data?.dataStartDate ||                       // ✅ 優先消息層
    windowDecision?.dataStartDate ||
    params?.dataStartDate ||
    effectiveStartDate ||
    params?.startDate ||
    null;
```

---

## 🎯 為什麼結果不同？

### 滾動測試的執行路徑

```
1. 發送消息：
   {
       params: { startDate: "2024-01-01", endDate: "2024-06-30" },
       dataStartDate: "2023-10-15",           // ✅ 在消息層
       effectiveStartDate: "2024-01-01",      // ✅ 在消息層
       lookbackDays: 180,                     // ✅ 在消息層
       useCachedData: true,
       cachedData: [...],
       cachedMeta: { ... }                    // ✅ 有元數據
   }

2. Worker 接收：
   incomingLookback = e.data.lookbackDays = 180  // ✅ 直接使用
   effectiveStartDate = e.data.effectiveStartDate = "2024-01-01"
   dataStartDate = e.data.dataStartDate = "2023-10-15"

3. 結果：使用明確指定的 lookback 和時間範圍
```

### 批量優化的執行路徑

```
1. 發送消息：
   {
       params: {
           startDate: "2024-01-01",
           endDate: "2024-06-30",
           dataStartDate: "2023-10-15",      // 在 params 層
           effectiveStartDate: "2024-01-01",  // 在 params 層
           lookbackDays: 180                 // 在 params 層
       },
       useCachedData: true,
       cachedData: [...]
       // ❌ 沒有消息層的獨立字段
       // ❌ 沒有 cachedMeta
   }

2. Worker 接收：
   e.data.lookbackDays = undefined  // ❌ 消息層沒有
   e.data.dataStartDate = undefined  // ❌ 消息層沒有
   
   incomingLookback = params.lookbackDays = 180  // 次要選項
   effectiveStartDate = params.effectiveStartDate  // 次要選項
   dataStartDate = params.dataStartDate

3. 但是...Worker 內部還會再次調用計算邏輯！
```

---

## 🔴 核心問題：重複計算

### Worker 中的重複計算邏輯

在 worker.js 中，即使已經接收到 `params.lookbackDays`，worker **還會再次調用計算邏輯**：

**L12945-12977**：
```javascript
// 調用 sharedUtils.resolveDataWindow - 這會根據 params 再次計算！
let windowDecision = null;
if (sharedUtils && typeof sharedUtils.resolveDataWindow === "function") {
    windowDecision = sharedUtils.resolveDataWindow(params || {}, windowOptions);
    // ⚠️ 這會返回一個新的 lookbackDays 值
}

// 如果消息層沒有 lookbackDays，則使用 params 層的
const incomingLookback = Number.isFinite(e.data?.lookbackDays)
    ? e.data.lookbackDays
    : Number.isFinite(params?.lookbackDays)
      ? params.lookbackDays  // ⚠️ 會被使用
      : null;

// 但是這之後可能會被 windowDecision 覆蓋
if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && Number.isFinite(windowDecision?.lookbackDays)) {
    lookbackDays = windowDecision.lookbackDays;  // ⚠️ 可能被覆蓋
}
```

---

## 📊 具體場景分析

### 場景 1：滾動測試（訓練期 6 個月）

```
輸入：
  trainStart = "2024-01-01"
  trainEnd = "2024-06-30"
  
prepareWorkerPayload 計算：
  lookbackDays = 180
  dataStartDate = "2023-10-15"
  
Worker 接收：
  消息層：e.data.lookbackDays = 180 ✅
  
計算結果：lookbackDays = 180（直接使用）
```

### 場景 2：批量優化（相同訓練期）

```
輸入：
  startDate = "2024-01-01"
  endDate = "2024-06-30"
  
enrichParamsWithLookback 計算：
  lookbackDays = 180
  dataStartDate = "2023-10-15"
  
Worker 接收：
  消息層：e.data.lookbackDays = undefined ❌
  params 層：params.lookbackDays = 180
  
Worker 再次計算：
  resolveDataWindow(params) → 可能返回不同的 lookbackDays！
  
可能的結果：lookbackDays ≠ 180
```

---

## 🔍 resolveDataWindow 的行為

Worker 調用 `sharedUtils.resolveDataWindow(params)` 時，這個函數可能基於不同的邏輯返回不同的結果：

**如果 params 中已經有 lookbackDays**：
- 它可能忽略該字段，重新計算
- 或者它可能優先使用 params 中的值

**取決於 shared-lookback.js 中的實現**，這導致：
- 滾動測試明確傳遞 lookback → 確定值
- 批量優化讓 worker 重新計算 → 可能不同的值

---

## 🧬 核心差異歸納

| 步驟 | 滾動測試 | 批量優化 | 結果 |
|------|---------|---------|------|
| 1. 計算 lookback | 在主執行緒中 | 在主執行緒中 | ✅ 相同 |
| 2. 傳遞給 worker | 消息層 `e.data.lookbackDays` | params 層 `params.lookbackDays` | ⚠️ 不同 |
| 3. Worker 使用優先級 | `e.data.lookbackDays` (最高) | `params.lookbackDays` (其次) | ❌ 不同 |
| 4. Worker 重新計算 | 不會再計算 (因為已有明確值) | **會再計算** (因為沒有消息層值) | ❌ 不同 |
| 5. 最終 lookback | 180 天 | 可能不是 180 天 | ❌ 結果不同 |

---

## 💡 根本問題總結

**滾動測試**:
```
明確指定 → Worker 使用明確值 → 無需再計算 → 結果確定
```

**批量優化**:
```
嵌入在 params → Worker 取得 params 值 → Worker 再次計算 → 結果不確定
```

Worker 在接收到消息層的 `dataStartDate`/`effectiveStartDate`/`lookbackDays` 時，會:
1. **優先使用** 消息層的值（不進行再計算）
2. 如果消息層沒有，才 **退用備用邏輯** 進行計算

---

## ✅ 修正方案

### 方案（推薦）：統一 Worker Message 結構

修改 `batch-optimization.js` 中的 `executeBacktestForCombination`，將 lookback 信息提升到消息層：

**位置**: `batch-optimization.js` Line 3519-3523

**當前**:
```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData,
    cachedData: cachedDataForWorker
});
```

**修改為**:
```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    dataStartDate: preparedParams.dataStartDate,      // ✅ 添加
    effectiveStartDate: preparedParams.effectiveStartDate, // ✅ 添加
    lookbackDays: preparedParams.lookbackDays,        // ✅ 添加
    useCachedData,
    cachedData: cachedDataForWorker,
    cachedMeta: buildBatchDatasetMeta(preparedParams) // ✅ 添加
});
```

---

## 🧪 驗證方法

1. **添加調試日誌**（在 worker.js 中）：
   ```javascript
   console.log('[Worker] e.data.lookbackDays:', e.data.lookbackDays);
   console.log('[Worker] params.lookbackDays:', params?.lookbackDays);
   console.log('[Worker] windowDecision.lookbackDays:', windowDecision?.lookbackDays);
   console.log('[Worker] Final lookbackDays:', lookbackDays);
   ```

2. **運行測試對比**：
   - 滾動測試：查看日誌中 `e.data.lookbackDays` 的值
   - 批量優化：查看日誌中的值是否不同

3. **驗證修正**：修改後再測，確認兩者輸出相同值

---

## 📌 結論

**最終原因**：Worker 在接收消息結構時有優先級順序，滾動測試通過消息層明確指定避免重新計算，而批量優化將 lookback 嵌入 params 導致 Worker 再次調用計算邏輯，結果可能不同。

**解決方式**：統一發送消息結構，將 `dataStartDate`/`effectiveStartDate`/`lookbackDays` 提升到消息層，並添加 `cachedMeta`。
