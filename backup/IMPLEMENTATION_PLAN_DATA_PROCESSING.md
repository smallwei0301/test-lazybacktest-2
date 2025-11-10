# 數據處理流程優化實現方案

## 目標
1. **開始回測時**：讓 worker 進行數據缺漏的缺口判斷與快取數據切片
2. **批量優化和滾動測試**：不重複執行檢查，直接使用處理後的數據

## 當前問題
- 批量優化和滾動測試在參數優化時，會向 worker 傳遞 cachedData，worker 會重複執行數據檢查
- 產生的 log: `[Worker] 2330 Netlify Blob 範圍資料仍缺少當月最新 3 天`
- 這導致每次參數變化都要等待數據檢查完成

## 實現方案

### 第1階段：創建共享數據處理模組
**文件**: `js/data-processing-helper.js`

```javascript
// 全局變數存儲已處理的數據
window.LazyBacktestProcessedData = {
    current: null,
    metadata: null,
    timestamp: null,
    settings: null
};

// 從 worker 結果中提取已處理的數據
function extractProcessedDataFromWorkerResult(workerResult) {
    return {
        data: workerResult.rawData || [],
        meta: {
            status: workerResult.status,
            diagnostics: workerResult.datasetDiagnostics,
            fetchDiagnostics: workerResult.fetchDiagnostics,
            // ... 其他元數據
        }
    };
}
```

### 第2階段：修改 backtest.js 流程

**在 `runBacktestInternal` 中**:
1. 在發送 `runBacktest` 消息到 worker **之前**，增加一個數據檢查步驟
2. 等待 worker 返回數據檢查結果後再進行回測
3. 將處理後的數據存儲到 `window.LazyBacktestProcessedData.current`

**關鍵改動**:
```javascript
function runBacktestInternal() {
    // ... 現有代碼 ...
    
    // 步驟1: 先發送數據檢查請求
    const dataCheckMessage = {
        type: 'checkDataIntegrity',  // 新的消息類型
        stockNo: params.stockNo,
        market: marketType,
        startDate: effectiveStartDate,
        endDate: curSettings.endDate,
        cachedData: cachedEntry?.data,
        // ...
    };
    
    backtestWorker.postMessage(dataCheckMessage);
}
```

### 第3階段：修改 worker.js

**新增消息處理**:
```javascript
// 在 worker 中處理 checkDataIntegrity 消息
if (message.type === 'checkDataIntegrity') {
    const result = {
        type: 'dataCheckComplete',
        stockNo: message.stockNo,
        rawData: processedData,  // 已處理的數據
        // 缺口檢查、切片結果等
    };
    self.postMessage(result);
}
```

### 第4階段：修改 batch-optimization.js

**使用已處理的數據**:
```javascript
// 在 executeCrossOptimizationTasks 或回測前
function getProcessedDataForBatch() {
    return window.LazyBacktestProcessedData?.current || null;
}

// 發送 worker 消息時
worker.postMessage({
    type: 'runBacktest',
    params: preparedParams,
    useCachedData: true,
    cachedData: getProcessedDataForBatch(),  // 使用已處理的數據
    skipDataValidation: true,  // 新標記：跳過 worker 中的數據檢查
});
```

### 第5階段：修改 rolling-test.js

**同上**，使用 `skipDataValidation: true` 標記

## 實現步驟

1. ✅ 創建 `data-processing-helper.js` 
2. ⏳ 修改 `backtest.js` 的 `runBacktestInternal`
   - 添加 dataCheckMessage 流程
   - 在 worker.onmessage 中處理 dataCheckComplete
   - 存儲結果到 `window.LazyBacktestProcessedData`
3. ⏳ 修改 `worker.js`
   - 添加 `checkDataIntegrity` 消息處理
   - 提供清晰的已處理數據輸出
4. ⏳ 修改 `batch-optimization.js`
   - 使用 `getProcessedDataForBatch()`
   - 添加 `skipDataValidation: true`
5. ⏳ 修改 `rolling-test.js`
   - 同上
6. ⏳ 測試驗證

## 預期效果

### 開始回測
- 執行一次完整的 worker 數據檢查和切片
- Log: `[Worker] Data check complete, processed X rows`
- 將已處理數據存儲到全局變數

### 批量優化
- 使用已存儲的數據，跳過檢查
- 不再出現 `缺少當月最新 X 天` 的 log
- 執行速度提升 (避免重複檢查)

### 滾動測試
- 同批量優化

## 相關代碼位置

1. **backtest.js** (js/)
   - Line ~4871: `function runBacktestInternal()`
   - Line ~5420: `backtestWorker.postMessage(workerMsg)`

2. **batch-optimization.js** (js/)
   - Line ~3424: tempWorker.postMessage
   - Line ~5825: worker.postMessage (parameter optimization)

3. **rolling-test.js** (js/)
   - Line ~鈎取 worker 消息的位置

4. **worker.js** (js/)
   - 主消息處理邏輯 (onmessage)
   - 數據驗證邏輯
