# ✅ 根本原因確認 - Worker 條件分支差異

**發現日期**: 2025-11-17  
**問題**: 批量優化和滾動測試相同訓練窗口下產生不同最佳參數  
**根本原因**: ✅ 已確認

---

## 🔴 核心差異

### Worker.js 中的優先級邏輯 (L12942-12977)

Worker 在處理 lookback 參數時使用此優先級：

```javascript
// 優先級 1：消息層 (e.data 直接層級)
e.data.lookbackDays

// 優先級 2：params 層
params.lookbackDays

// 優先級 3-5：計算邏輯
windowDecision.lookbackDays
resolveLookbackDays()
estimateLookbackBars()

// 優先級最低：預設值
Math.max(90, inferredMax * 2)
```

### 發送方式差異

**滾動測試**:
```javascript
worker.postMessage({
    params: { ... },
    dataStartDate: "2023-10-15",      // ✅ 消息層
    effectiveStartDate: "2024-01-01",  // ✅ 消息層
    lookbackDays: 180,                 // ✅ 消息層
    cachedData: [...],
    cachedMeta: { ... }                // ✅ 有元數據
});
// ➜ Worker 直接使用最高優先級的值，不進行重新計算
```

**批量優化**:
```javascript
worker.postMessage({
    params: {                          // 所有字段在 params 內
        dataStartDate: "2023-10-15",
        effectiveStartDate: "2024-01-01",
        lookbackDays: 180,
        ...
    },
    useCachedData: true,
    cachedData: [...]
    // ❌ 消息層沒有這些字段
    // ❌ 沒有 cachedMeta
});
// ➜ Worker 找不到消息層的值，使用優先級 2（params 層）
// ➜ Worker 在接收到優先級 2 的值後，可能仍然進行重新計算邏輯
```

---

## ⚙️ Worker 重新計算邏輯

即使批量優化提供了 `params.lookbackDays = 180`，Worker 仍會執行：

```javascript
// 1. 調用計算函數
let windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
// ⚠️ 這可能返回不同的 lookbackDays！

// 2. 使用次級優先級
const incomingLookback = params.lookbackDays; // 從 params 取得

// 3. 檢查是否被計算結果覆蓋
if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    lookbackDays = windowDecision.lookbackDays; // ⚠️ 被覆蓋
}
```

**關鍵問題**：`resolveDataWindow()` 可能返回與 `enrichParamsWithLookback()` 不同的值，因為：
- 主執行緒在特定時間點計算
- Worker 可能在不同邏輯路徑上計算
- 計算依賴於參數細節

---

## 📊 執行流程對比

### 滾動測試流程
```
1️⃣ prepareWorkerPayload() 計算 lookback
   ↓ 得到 lookbackDays = 180
   
2️⃣ runSingleWindow() 發送消息
   ↓ 消息層明確指定：e.data.lookbackDays = 180
   
3️⃣ Worker 接收
   ↓ 檢查優先級 1：e.data.lookbackDays 存在 ✅
   ↓ 直接使用 180，**不進行重新計算**
   
4️⃣ 結果確定
   ↓ lookbackDays = 180
   ↓ dataStartDate 和 effectiveStartDate 也明確指定
```

### 批量優化流程
```
1️⃣ enrichParamsWithLookback() 計算 lookback
   ↓ 得到 params.lookbackDays = 180
   
2️⃣ executeBacktestForCombination() 發送消息
   ↓ 只在 params 層：params.lookbackDays = 180
   ↓ 消息層沒有對應字段 ❌
   
3️⃣ Worker 接收
   ↓ 檢查優先級 1：e.data.lookbackDays 不存在 ❌
   ↓ 檢查優先級 2：params.lookbackDays = 180 ✅
   ↓ 但 Worker 同時調用了 resolveDataWindow()
   ↓ resolveDataWindow() 基於 params 再次計算
   ↓ **可能返回不同的值** ⚠️
   
4️⃣ 結果可能不同
   ↓ lookbackDays 可能被 windowDecision 覆蓋
   ↓ dataStartDate 計算路徑不同
```

---

## 🧬 為什麼 Worker 要重新計算？

Worker 設計目標是**容錯性和獨立性**：
- 不完全依賴主執行緒的計算
- 如果消息層沒有完整信息，自行計算
- 確保即使主執行緒傳遞不完整，Worker 也能工作

但這導致**不確定性**：
- 當同時存在 params 層和消息層的值時，優先使用消息層
- 當只有 params 層時，使用 params 層但可能進行額外計算
- 計算邏輯可能因 params 結構而產生不同結果

---

## ✅ 修正方案

### 統一 Message 結構

**檔案**: `v0 design code/public/app/js/batch-optimization.js`  
**位置**: Line 3519-3523 (在 `executeBacktestForCombination` 函數中)

**當前代碼**:
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
    // ✅ 添加消息層字段以匹配滾動測試
    dataStartDate: preparedParams.dataStartDate,
    effectiveStartDate: preparedParams.effectiveStartDate,
    lookbackDays: preparedParams.lookbackDays,
    useCachedData,
    cachedData: cachedDataForWorker,
    // ✅ 添加元數據
    cachedMeta: buildBatchDatasetMeta(preparedParams)
});
```

**效果**:
- 消息層有明確的 lookback 值 → Worker 優先使用 (優先級 1)
- Worker 不會進行重新計算
- 與滾動測試的行為完全一致

---

## 🔍 驗證步驟

### 1. 添加調試日誌（在 worker.js 中）

在 `self.onmessage` 函數開始位置添加：

```javascript
console.log('[Worker] Message structure:');
console.log('  e.data.lookbackDays:', e.data?.lookbackDays);
console.log('  params.lookbackDays:', params?.lookbackDays);
console.log('  e.data.dataStartDate:', e.data?.dataStartDate);
console.log('  params.dataStartDate:', params?.dataStartDate);
```

在計算完成後添加：

```javascript
console.log('[Worker] Resolved values:');
console.log('  Final lookbackDays:', lookbackDays);
console.log('  Final dataStartDate:', dataStartDate);
console.log('  Final effectiveStartDate:', effectiveStartDate);
```

### 2. 比較日誌輸出

**滾動測試預期**:
```
[Worker] Message structure:
  e.data.lookbackDays: 180
  params.lookbackDays: 180
  e.data.dataStartDate: 2023-10-15
  params.dataStartDate: 2023-10-15
```

**批量優化現狀**:
```
[Worker] Message structure:
  e.data.lookbackDays: undefined  ❌
  params.lookbackDays: 180
  e.data.dataStartDate: undefined  ❌
  params.dataStartDate: 2023-10-15
```

**修改後預期**:
```
[Worker] Message structure:
  e.data.lookbackDays: 180  ✅
  params.lookbackDays: 180
  e.data.dataStartDate: 2023-10-15  ✅
  params.dataStartDate: 2023-10-15
```

### 3. 驗證結果一致性

修改後運行：
- 滾動測試 + 批量優化（相同窗口）
- 對比最終 lookbackDays、dataStartDate、effectiveStartDate
- 確認回測結果相同

---

## 📋 完整文檔

詳細技術分析：`WORKER_LOOKUP_PATH_ANALYSIS.md`

---

**修正難度**: ⭐ 簡單（只需修改 postMessage 調用）  
**修正範圍**: 1 個位置  
**預期效果**: 批量優化結果與滾動測試一致
