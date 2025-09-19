backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TWSE)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1997 [Market Switch] 切換到 TPEX 查詢 3260
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1454 [Fees] Set default fees for 3260 (isETF: false) -> Buy: 0.1425%, Sell+Tax: 0.4425%
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: {stockNo: '3260', startDate: '2020-09-19', endDate: '2025-09-19', initialCapital: 100000, positionSize: 100, …}
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TPEX)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
worker.js:817 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
worker.js:80 [Worker] Raw data aaData length: 1310
backtest.js:37 [Main] Received message from worker: progress undefined
/js/worker.js:128 [Worker] 獲取或處理 3260 (TPEX) 資料時發生錯誤: Error: 指定範圍 (2020-09-19 ~ 2025-09-19) 無 3260 交易數據
    at fetchStockData (/js/worker.js:122:19)
    at async self.onmessage (/js/worker.js:818:28)
fetchStockData @ /js/worker.js:128
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:867 Worker 執行 runBacktest 期間錯誤: Error: 指定範圍 (2020-09-19 ~ 2025-09-19) 無 3260 交易數據
    at fetchStockData (/js/worker.js:122:19)
    at async self.onmessage (/js/worker.js:818:28)
self.onmessage @ /js/worker.js:867
backtest.js:37 [Main] Received message from worker: stockNameInfo undefined
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:37 [Main] Received message from worker: error {message: 'Worker runBacktest 錯誤: 指定範圍 (2020-09-19 ~ 2025-09-19) 無 3260 交易數據'}
Function tpex-proxy
Sep 19, 11:51:08 AM: 62157a50 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:08 AM: 62157a50 Duration: 236.14 ms	Memory Usage: 138 MB
Sep 19, 11:51:09 AM: b0fddbdf INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:09 AM: b0fddbdf Duration: 103.39 ms	Memory Usage: 138 MB
Sep 19, 11:51:12 AM: 49cda32a INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:12 AM: 49cda32a Duration: 52.6 ms	Memory Usage: 138 MB
Sep 19, 11:53:29 AM: b2312e8a INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:53:29 AM: b2312e8a Duration: 97.04 ms	Memory Usage: 138 MB
Sep 19, 11:53:29 AM: fcfab231 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:53:29 AM: fcfab231 Duration: 104.36 ms	Memory Usage: 138 MB
Sep 19, 11:53:33 AM: f80f8aca INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:53:33 AM: f80f8aca Duration: 88.58 ms	Memory Usage: 138 MB