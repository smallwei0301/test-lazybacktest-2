?plugins=forms,container-queries:64 cdn.tailwindcss.com should not be used in production. To use Tailwind CSS in production, install it as a PostCSS plugin or use the Tailwind CLI: https://tailwindcss.com/docs/installation
(anonymous) @ ?plugins=forms,container-queries:64
(anonymous) @ ?plugins=forms,container-queries:64
main.js:135 [Main] DOM loaded, initializing...
main.js:149 [Main] Initialization completed
backtest.js:4 Chart object: function
backtest.js:5 Available Chart plugins: (8) ['colors', 'decimation', 'filler', 'legend', 'subtitle', 'title', 'tooltip', 'zoom']
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
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TWSE)
backtest.js:1454 [Fees] Set default fees for 3260 (isETF: false) -> Buy: 0.1425%, Sell+Tax: 0.4425%
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:1703 [Stock Name] 已有進行中的查詢，跳過本次請求
backtest.js:1997 [Market Switch] 切換到 TPEX 查詢 3260
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
backtest.js:10 [Main] runBacktestInternal called
backtest.js:14 [Main] Params: {stockNo: '3260', startDate: '2020-09-19', endDate: '2025-09-19', initialCapital: 100000, positionSize: 100, …}
backtest.js:16 [Main] Validation: true
backtest.js:30 [Main] WorkerUrl: js/worker.js
backtest.js:31 [Main] Creating worker...
backtest.js:120 [Main] Fetching new data for backtest.
worker.js:803 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
worker.js:114 [Worker] 獲取或處理 3260 (TPEX) 資料時發生錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
    at fetchStockData (/js/worker.js:61:19)
    at async self.onmessage (/js/worker.js:804:28)
fetchStockData @ worker.js:114
await in fetchStockData
self.onmessage @ worker.js:804
worker.js:853 Worker 執行 runBacktest 期間錯誤: Error: 代理伺服器錯誤: 400 - {"error":"缺少參數"}
    at fetchStockData (/js/worker.js:61:19)
    at async self.onmessage (/js/worker.js:804:28)
self.onmessage @ worker.js:853
backtest.js:37 [Main] Received message from worker: error {message: 'Worker runBacktest 錯誤: 代理伺服器錯誤: 400 - {"error":"缺少參數"}'}


Function tpex-proxy

Sep 19, 11:33:31 AM: 3d7a64bd INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:33:31 AM: 3d7a64bd Duration: 426.57 ms	Memory Usage: 125 MB
Sep 19, 11:33:31 AM: f71734bc INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:33:31 AM: f71734bc Duration: 133.81 ms	Memory Usage: 133 MB