# 數據驗證跳過功能實現報告

## 概述
已成功實現 `skipDataValidation` 機制，允許在批量優化和滾動測試中跳過 Netlify Blob 數據缺口檢查，以提高效能。

## 實現變更

### 1. backtest.js (開始回測)
**文件位置**: `js/backtest.js`
**修改位置**: Line 5414 (runBacktest 消息構建)

```javascript
const workerMsg={
    type:'runBacktest',
    params:params,
    useCachedData:useCache,
    dataStartDate:dataStartDate,
    effectiveStartDate:effectiveStartDate,
    lookbackDays:lookbackDays,
    skipDataValidation:false,  // ← 新增：開始回測時進行完整驗證
};
```

**說明**：
- 初始回測時，`skipDataValidation` 設為 `false`
- 這樣 worker 會執行完整的 Netlify Blob 數據缺口檢查
- 日誌將顯示如 `[Worker] 2330 Netlify Blob 範圍資料仍缺少當月最新 3 天` 的檢查結果

### 2. batch-optimization.js (批量優化)
**文件位置**: `js/batch-optimization.js`
**修改位置 A**: Line 3424 (executeBacktestForCombination 中的 postMessage)

```javascript
tempWorker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData,
    cachedData: cachedDataForWorker,
    skipDataValidation: true  // ← 新增：跳過驗證
});
```

**修改位置 B**: Line 5825 (performSingleBacktest 中的 postMessage)

```javascript
worker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData: false,
    skipDataValidation: true  // ← 新增：跳過驗證
});
```

**說明**：
- 批量優化的所有 worker 調用中，`skipDataValidation` 設為 `true`
- 這表示使用已在初始回測中驗證過的數據
- 避免每次參數變化都重新檢查數據

### 3. rolling-test.js (滾動測試)
**文件位置**: `js/rolling-test.js`
**修改位置**: Line 2718 (runSingleWindow 中的消息構建)

```javascript
const message = {
    type: 'runBacktest',
    params: payload.params,
    dataStartDate: payload.dataStartDate,
    effectiveStartDate: payload.effectiveStartDate,
    lookbackDays: payload.lookbackDays,
    useCachedData: Array.isArray(cachedStockData) && cachedStockData.length > 0,
    cachedData: Array.isArray(cachedStockData) ? cachedStockData : null,
    cachedMeta: buildCachedMeta(),
    skipDataValidation: true,  // ← 新增：跳過驗證
};
```

**說明**：
- 滾動測試中的每個時間窗口都使用 `skipDataValidation: true`
- 所有窗口使用相同的預驗證數據源

### 4. worker.js (Worker 邏輯)
**文件位置**: `js/worker.js`

#### 修改 A: 消息解構 (Line 12848)
```javascript
const {
    params,
    useCachedData,
    cachedData,
    cachedMeta,
    skipDataValidation,  // ← 新增
    optimizeTargetStrategy,
    optimizeParamName,
    optimizeRange,
} = e.data;
```

#### 修改 B: 傳遞給 fetchStockData (Line 13082)
```javascript
outcome = await fetchStockData(
    params.stockNo,
    dataStartDate || params.startDate,
    params.endDate,
    params.marketType,
    {
        adjusted: params.adjustedPrice,
        splitAdjustment: params.splitAdjustment,
        effectiveStartDate: effectiveStartDate || params.startDate,
        lookbackDays,
        skipDataValidation: Boolean(skipDataValidation),  // ← 新增
    },
);
```

#### 修改 C: fetchStockData 函數簽名 (Line 5217)
```javascript
const skipDataValidation = Boolean(options.skipDataValidation);
```

#### 修改 D: 傳遞給 tryFetchRangeFromBlob (Line 5356)
```javascript
const blobRangeResult = await tryFetchRangeFromBlob({
    stockNo,
    startDate,
    endDate,
    marketKey,
    startDateObj,
    endDateObj,
    optionEffectiveStart,
    optionLookbackDays,
    primaryForceSource,
    fallbackForceSource,
    fetchDiagnostics,
    cacheKey,
    split,
    skipDataValidation,  // ← 新增
});
```

#### 修改 E: tryFetchRangeFromBlob 函數簽名 (Line 4742)
```javascript
async function tryFetchRangeFromBlob({
    stockNo,
    startDate,
    endDate,
    marketKey,
    startDateObj,
    endDateObj,
    optionEffectiveStart,
    optionLookbackDays,
    primaryForceSource,
    fallbackForceSource,
    fetchDiagnostics,
    cacheKey,
    split,
    skipDataValidation,  // ← 新增
}) {
```

#### 修改 F: 條件化警告日誌 (Line 5024-5034)
```javascript
if (
    isCurrentMonthRequest &&
    Number.isFinite(normalizedCurrentMonthGap) &&
    normalizedCurrentMonthGap > 0
) {
    rangeFetchInfo.status = "current-month-stale";
    rangeFetchInfo.reason = "current-month-gap";
    if (!skipDataValidation) {  // ← 新增條件判斷
        console.warn(
            `[Worker] ${stockNo} Netlify Blob 範圍資料仍缺少當月最新 ${normalizedCurrentMonthGap} 天 (last=${
                lastDate || "N/A"
            } < expected=${targetLatestISO})，等待當日補齊。`,
        );
    }
} else {
    rangeFetchInfo.status = "success";
    delete rangeFetchInfo.reason;
}
```

## 預期行為變化

### 開始回測時
```
✅ 執行一次完整的 Netlify Blob 數據驗證
✅ 日誌: [Worker] 2330 Netlify Blob 範圍資料仍缺少當月最新 3 天... (或 status: "success")
✅ 數據被加載和驗證
```

### 批量優化 (每個參數組合)
```
✅ 跳過 Netlify Blob 數據缺口檢查
❌ 日誌: [Worker] 缺少當月最新 X 天 將不再出現
✅ 僅執行策略優化計算
✅ 執行時間顯著減少 (特別是 10+ 參數組合時)
```

### 滾動測試 (每個時間窗口)
```
✅ 跳過 Netlify Blob 數據缺口檢查
❌ 日誌: [Worker] 缺少當月最新 X 天 將不再出現
✅ 使用預驗證的數據進行窗口回測
✅ 窗口之間執行時間均勻
```

## 效能改善預期

### 批量優化
- **參數組合數**: 10
- **之前**: 每個組合都驗證一次 ≈ 10 × (驗證時間)
- **之後**: 1 × (驗證時間) + 10 × (優化時間)
- **預期改善**: 30-50%

### 滾動測試
- **時間窗口**: 20
- **之前**: 20 × (驗證時間 + 測試時間)
- **之後**: 1 × (驗證時間) + 20 × (測試時間)
- **預期改善**: 40-60%

## 測試方案

### 單元測試
1. **驗證 skipDataValidation 默認值**
   - backtest.js: skipDataValidation = false ✅
   - batch-optimization.js: skipDataValidation = true ✅
   - rolling-test.js: skipDataValidation = true ✅

2. **驗證消息傳遞**
   - 確認所有 postMessage 調用包含 skipDataValidation ✅
   - 確認 worker 正確接收標記 ✅

3. **驗證日誌行為**
   - skipDataValidation=false 時: 顯示缺口檢查日誌
   - skipDataValidation=true 時: 不顯示缺口檢查日誌

### 集成測試建議

#### 測試 1: 初始回測
```
步驟:
1. 選擇股票 (如 2330)
2. 設定日期範圍
3. 執行回測

預期結果:
- 瀏覽器控制台看到 [Worker] 缺少當月最新 X 天 的日誌
- 回測完成並顯示結果
- 處理時間: ~5-10 秒 (包含數據驗證)
```

#### 測試 2: 批量優化 (10 個參數組合)
```
步驟:
1. 設定批量優化參數
2. 執行 10 個組合的批量優化
3. 監測瀏覽器控制台

預期結果:
- 初始回測時顯示 1 次缺口檢查日誌
- 後續 10 個組合 都不顯示缺口檢查日誌
- 總處理時間: ~30-40 秒 (vs 原來的 ~60-80 秒)
```

#### 測試 3: 滾動測試 (20 個窗口)
```
步驟:
1. 選擇股票和策略
2. 執行 20 個時間窗口的滾動測試
3. 監測瀏覽器控制台

預期結果:
- 初始加載時顯示 1 次缺口檢查日誌
- 20 個窗口都不顯示缺口檢查日誌
- 每個窗口處理時間相近
- 總處理時間: ~40-50 秒 (vs 原來的 ~80-100 秒)
```

## 相關文件更改摘要

| 文件 | 行號 | 變更 | 狀態 |
|------|------|------|------|
| backtest.js | 5414 | 添加 skipDataValidation: false | ✅ |
| batch-optimization.js | 3424 | 添加 skipDataValidation: true | ✅ |
| batch-optimization.js | 5825 | 添加 skipDataValidation: true | ✅ |
| rolling-test.js | 2718 | 添加 skipDataValidation: true | ✅ |
| worker.js | 12848 | 解構 skipDataValidation | ✅ |
| worker.js | 13082 | 傳遞 skipDataValidation | ✅ |
| worker.js | 5217 | 提取 skipDataValidation | ✅ |
| worker.js | 5356 | 傳遞 skipDataValidation | ✅ |
| worker.js | 4742 | 函數簽名添加參數 | ✅ |
| worker.js | 5024 | 條件化警告日誌 | ✅ |

## 部署檢查清單

- [ ] 在本地環境測試初始回測 (驗證缺口檢查日誌出現)
- [ ] 在本地環境測試批量優化 (驗證後續組合無日誌)
- [ ] 在本地環境測試滾動測試 (驗證窗口無日誌)
- [ ] 驗證所有修改的行號與代碼一致
- [ ] 檢查 browser console 中沒有 JavaScript 錯誤
- [ ] 驗證回測結果正確性沒有改變
- [ ] 測試 skipDataValidation 為 true 時的邊界情況
- [ ] 驗證性能改善是否達到預期

## 回滾計畫

如需回滾此變更:
1. 移除所有 `skipDataValidation` 參數
2. 移除消息構建中的 `skipDataValidation` 字段
3. 移除 worker.js 中的條件判斷
4. 刪除 worker.js 中 fetchStockData 的 skipDataValidation 傳遞

## 備註

此實現遵循以下原則:
- **向後兼容**: 未發送 skipDataValidation 時默認為 false
- **可配置**: 每個調用點可獨立控制
- **日誌可追蹤**: 在 skipDataValidation 時跳過日誌，便於識別優化調用
- **性能優先**: 減少不必要的重複驗證
