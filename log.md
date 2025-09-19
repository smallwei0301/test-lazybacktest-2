backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TWSE)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1997 [Market Switch] 切換到 TPEX 查詢 3260
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1454 [Fees] Set default fees for 3260 (isETF: false) -> Buy: 0.1425%, Sell+Tax: 0.4425%
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: {stockNo: '3260', startDate: '2024-09-19', endDate: '2025-09-19', initialCapital: 100000, positionSize: 100, …}
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
worker.js:803 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TPEX)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:37 [Main] Received message from worker: progress undefined
/js/worker.js:114 [Worker] 獲取或處理 3260 (TPEX) 資料時發生錯誤: Error: 指定範圍 (2024-09-19 ~ 2025-09-19) 無 3260 交易數據
    at fetchStockData (/js/worker.js:108:19)
    at async self.onmessage (/js/worker.js:804:28)
fetchStockData @ /js/worker.js:114
await in fetchStockData
self.onmessage @ /js/worker.js:804
/js/worker.js:853 Worker 執行 runBacktest 期間錯誤: Error: 指定範圍 (2024-09-19 ~ 2025-09-19) 無 3260 交易數據
    at fetchStockData (/js/worker.js:108:19)
    at async self.onmessage (/js/worker.js:804:28)
self.onmessage @ /js/worker.js:853
backtest.js:37 [Main] Received message from worker: stockNameInfo undefined
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:37 [Main] Received message from worker: error {message: 'Worker runBacktest 錯誤: 指定範圍 (2024-09-19 ~ 2025-09-19) 無 3260 交易數據'}

Function tpex-proxy
Sep 19, 11:46:38 AM: 5dc681fc INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:39 AM: 5dc681fc Duration: 482.88 ms	Memory Usage: 128 MB
Sep 19, 11:46:39 AM: 24300d2e INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:39 AM: 24300d2e Duration: 128.74 ms	Memory Usage: 136 MB
Sep 19, 11:46:40 AM: 52837221 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:40 AM: 52837221 Duration: 249.8 ms	Memory Usage: 137 MB
Sep 19, 11:46:44 AM: 01eb0aca INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:44 AM: 01eb0aca Duration: 70.93 ms	Memory Usage: 138 MB
Sep 19, 11:51:08 AM: 62157a50 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:08 AM: 62157a50 Duration: 236.14 ms	Memory Usage: 138 MB
Sep 19, 11:51:09 AM: b0fddbdf INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:09 AM: b0fddbdf Duration: 103.39 ms	Memory Usage: 138 MB
Sep 19, 11:51:12 AM: 49cda32a INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:51:12 AM: 49cda32a Duration: 52.6 ms	Memory Usage: 138 MB