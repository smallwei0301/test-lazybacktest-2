backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: {stockNo: '3260', startDate: '2024-09-19', endDate: '2025-09-19', initialCapital: 100000, positionSize: 100, …}
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
worker.js:835 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
worker.js:146 [Worker] 獲取或處理 3260 (TPEX) 資料時發生錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
    at fetchStockData (/js/worker.js:93:19)
    at async self.onmessage (/js/worker.js:836:28)
fetchStockData @ worker.js:146
await in fetchStockData
self.onmessage @ worker.js:836
worker.js:885 Worker 執行 runBacktest 期間錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
    at fetchStockData (/js/worker.js:93:19)
    at async self.onmessage (/js/worker.js:836:28)
self.onmessage @ worker.js:885
backtest.js:37 [Main] Received message from worker: error {message: 'Worker runBacktest 錯誤: 代理伺服器錯誤: 400 - {"error":"缺少參數"}'}

Function tpex-proxy

Sep 19, 10:13:26 AM: c0bbd444 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 10:13:26 AM: c0bbd444 Duration: 429.17 ms	Memory Usage: 124 MB
Sep 19, 10:13:27 AM: bc7ae816 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 10:13:27 AM: bc7ae816 Duration: 337.02 ms	Memory Usage: 141 MB