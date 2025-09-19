?plugins=forms,container-queries:64 cdn.tailwindcss.com should not be used in production. To use Tailwind CSS in production, install it as a PostCSS plugin or use the Tailwind CLI: https://tailwindcss.com/docs/installation
(anonymous) @ ?plugins=forms,container-queries:64
main.js:135 [Main] DOM loaded, initializing...
main.js:149 [Main] Initialization completed
backtest.js:4 Chart object: function
backtest.js:5 Available Chart plugins: Array(8)
loader.js:3 [Loader] DOMContentLoaded event fired.
loader.js:6 [Loader] Set workerUrl to: js/worker.js
backtest.js:1454 [Fees] Set default fees for 2330 (isETF: false) -> Buy: 0.1425%, Sell+Tax: 0.4425%
loader.js:130 [Main] Initial setup complete.
loader.js:138 [Loader] Loader script finished.
batch-optimization.js:106 [Batch Optimization] Initializing...
batch-optimization.js:210 [Batch Optimization] Strategy options generated successfully
batch-optimization.js:280 [Batch Optimization] Events bound successfully
batch-optimization.js:143 [Batch Optimization] Initialized successfully
backtest.js:2080 [Market Switch] 市場切換功能已初始化
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: Object
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
 [Worker] 獲取或處理 2330 (TWSE) 資料時發生錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
fetchStockData @ /js/worker.js:114
 Worker 執行 runBacktest 期間錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
self.onmessage @ /js/worker.js:853
backtest.js:37 [Main] Received message from worker: error Object
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: Object
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
backtest.js:1454 [Fees] Set default fees for 3260 (isETF: false) -> Buy: 0.1425%, Sell+Tax: 0.4425%
 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TWSE)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
 [Worker] 獲取或處理 3260 (TWSE) 資料時發生錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
fetchStockData @ /js/worker.js:114
 Worker 執行 runBacktest 期間錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
self.onmessage @ /js/worker.js:853
backtest.js:37 [Main] Received message from worker: error Object
backtest.js:1997 [Market Switch] 切換到 TPEX 查詢 3260
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TPEX)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TPEX)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: Object
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
 [Worker] 獲取或處理 3260 (TPEX) 資料時發生錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
fetchStockData @ /js/worker.js:114
 Worker 執行 runBacktest 期間錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
self.onmessage @ /js/worker.js:853
backtest.js:37 [Main] Received message from worker: error Object

Function tpex-proxy

Sep 19, 11:46:38 AM: 5dc681fc INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:39 AM: 5dc681fc Duration: 482.88 ms	Memory Usage: 128 MB
Sep 19, 11:46:39 AM: 24300d2e INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:39 AM: 24300d2e Duration: 128.74 ms	Memory Usage: 136 MB
Sep 19, 11:46:40 AM: 52837221 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:40 AM: 52837221 Duration: 249.8 ms	Memory Usage: 137 MB
Sep 19, 11:46:44 AM: 01eb0aca INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:46:44 AM: 01eb0aca Duration: 70.93 ms	Memory Usage: 138 MB