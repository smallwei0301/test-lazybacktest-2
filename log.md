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
worker.js:817 [Worker] Fetching new data for backtest.
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:1708 [Stock Name v9.3] 查詢股票名稱: 3260 (市場: TPEX)
backtest.js:1805 [TPEX Name] 查詢股票代碼: 3260
backtest.js:1874 [TPEX Proxy Name] Fetching name for 3260 via proxy: /.netlify/functions/tpex-proxy?stockNo=3260
/js/worker.js:80 [Worker] Raw data aaData length: 1310
 [Main] Received message from worker: progress undefined
/js/worker.js:82 [Worker] Processing item 0: (9) ['0050', '3260', '(股)', 2597748047, 56.5, 56.95, 56.25, 0.6, null]
/js/worker.js:84 [Worker] Item 0 - Original Date: 0050, Formatted Date: null
/js/worker.js:86 [Worker] Item 0 - Invalid formatted date: 0050
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1: (9) ['0051', '3260', '(股)', 8019020, 85.6, 86.15, 85.6, 1.15, null]
/js/worker.js:84 [Worker] Item 1 - Original Date: 0051, Formatted Date: null
/js/worker.js:86 [Worker] Item 1 - Invalid formatted date: 0051
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 2: (9) ['0052', '3260', '(股)', 74570473, 223.7, 224.45, 222.5, 1.7, null]
/js/worker.js:84 [Worker] Item 2 - Original Date: 0052, Formatted Date: null
/js/worker.js:86 [Worker] Item 2 - Invalid formatted date: 0052
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 3: (9) ['0053', '3260', '(股)', 1036684, 123.75, 124.8, 123.5, 1.7, null]
/js/worker.js:84 [Worker] Item 3 - Original Date: 0053, Formatted Date: null
/js/worker.js:86 [Worker] Item 3 - Invalid formatted date: 0053
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 4: (9) ['0055', '3260', '(股)', 2325391, 30.65, 30.65, 30.38, 0.05, null]
 [Main] Received message from worker: stockNameInfo undefined
/js/worker.js:84 [Worker] Item 4 - Original Date: 0055, Formatted Date: null
/js/worker.js:86 [Worker] Item 4 - Invalid formatted date: 0055
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 5: (9) ['0056', '3260', '(股)', 1254842779, 36.32, 36.42, 36.18, 0.22, null]
/js/worker.js:84 [Worker] Item 5 - Original Date: 0056, Formatted Date: null
/js/worker.js:86 [Worker] Item 5 - Invalid formatted date: 0056
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 6: (9) ['0057', '3260', '(股)', 4238884, 166, 167.95, 165.85, 1.5, null]
/js/worker.js:84 [Worker] Item 6 - Original Date: 0057, Formatted Date: null
/js/worker.js:86 [Worker] Item 6 - Invalid formatted date: 0057
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 7: (9) ['0061', '3260', '(股)', 7818425, 21.43, 21.58, 21.42, 0.06, null]
/js/worker.js:84 [Worker] Item 7 - Original Date: 0061, Formatted Date: null
/js/worker.js:86 [Worker] Item 7 - Invalid formatted date: 0061
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 8: (9) ['006203', '3260', '(股)', 758971, 102.85, 104.05, 102.85, 0.55, null]
/js/worker.js:84 [Worker] Item 8 - Original Date: 006203, Formatted Date: null
/js/worker.js:86 [Worker] Item 8 - Invalid formatted date: 006203
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 9: (9) ['006204', '3260', '(股)', 5365726, 130.35, 130.85, 130.3, 0.7, null]
/js/worker.js:84 [Worker] Item 9 - Original Date: 006204, Formatted Date: null
/js/worker.js:86 [Worker] Item 9 - Invalid formatted date: 006204
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 10: (9) ['006205', '3260', '(股)', 28074352, 36.59, 36.91, 36.59, 0.15, null]
/js/worker.js:84 [Worker] Item 10 - Original Date: 006205, Formatted Date: null
/js/worker.js:86 [Worker] Item 10 - Invalid formatted date: 006205
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 11: (9) ['006206', '3260', '(股)', 2368989, 33.76, 33.9, 33.7, -0.01, null]
/js/worker.js:84 [Worker] Item 11 - Original Date: 006206, Formatted Date: null
/js/worker.js:86 [Worker] Item 11 - Invalid formatted date: 006206
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 12: (9) ['006207', '3260', '(股)', 1178372, 28.21, 28.35, 28.21, 0, null]
/js/worker.js:84 [Worker] Item 12 - Original Date: 006207, Formatted Date: null
/js/worker.js:86 [Worker] Item 12 - Invalid formatted date: 006207
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 13: (9) ['006208', '3260', '(股)', 512117626, 132.05, 132.9, 131.5, 1.25, null]
/js/worker.js:84 [Worker] Item 13 - Original Date: 006208, Formatted Date: null
/js/worker.js:86 [Worker] Item 13 - Invalid formatted date: 006208
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 14: (9) ['00625K', '3260', '(股)', 8760, 8.76, 8.76, 8.76, 0.06, null]
/js/worker.js:84 [Worker] Item 14 - Original Date: 00625K, Formatted Date: null
/js/worker.js:86 [Worker] Item 14 - Invalid formatted date: 00625K
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 15: (9) ['00631L', '3260', '(股)', 927857651, 287.85, 291.3, 285.6, 5.65, null]
/js/worker.js:84 [Worker] Item 15 - Original Date: 00631L, Formatted Date: null
/js/worker.js:86 [Worker] Item 15 - Invalid formatted date: 00631L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 16: (9) ['00632R', '3260', '(股)', 725258778, 18.76, 18.82, 18.65, -0.2, null]
/js/worker.js:84 [Worker] Item 16 - Original Date: 00632R, Formatted Date: null
/js/worker.js:86 [Worker] Item 16 - Invalid formatted date: 00632R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 17: (9) ['00633L', '3260', '(股)', 189620093, 48.6, 49.08, 48.03, -0.36, null]
/js/worker.js:84 [Worker] Item 17 - Original Date: 00633L, Formatted Date: null
/js/worker.js:86 [Worker] Item 17 - Invalid formatted date: 00633L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 18: (9) ['00634R', '3260', '(股)', 654986, 3.26, 3.28, 3.23, 0.02, null]
/js/worker.js:84 [Worker] Item 18 - Original Date: 00634R, Formatted Date: null
/js/worker.js:86 [Worker] Item 18 - Invalid formatted date: 00634R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 19: (9) ['00635U', '3260', '(股)', 108024549, 39.75, 39.75, 39.62, -0.27, null]
/js/worker.js:84 [Worker] Item 19 - Original Date: 00635U, Formatted Date: null
/js/worker.js:86 [Worker] Item 19 - Invalid formatted date: 00635U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 20: (9) ['00636', '3260', '(股)', 28476464, 25.19, 25.34, 25.12, -0.05, null]
/js/worker.js:84 [Worker] Item 20 - Original Date: 00636, Formatted Date: null
/js/worker.js:86 [Worker] Item 20 - Invalid formatted date: 00636
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 21: (9) ['00636K', '3260', '(股)', 1684, 8.42, 8.42, 8.42, 0, null]
/js/worker.js:84 [Worker] Item 21 - Original Date: 00636K, Formatted Date: null
/js/worker.js:86 [Worker] Item 21 - Invalid formatted date: 00636K
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 22: (9) ['00637L', '3260', '(股)', 985012790, 19.58, 19.76, 19.33, -0.16, null]
/js/worker.js:84 [Worker] Item 22 - Original Date: 00637L, Formatted Date: null
/js/worker.js:86 [Worker] Item 22 - Invalid formatted date: 00637L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 23: (9) ['00638R', '3260', '(股)', 4076738, 6.82, 6.86, 6.8, 0.03, null]
/js/worker.js:84 [Worker] Item 23 - Original Date: 00638R, Formatted Date: null
/js/worker.js:86 [Worker] Item 23 - Invalid formatted date: 00638R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 24: (9) ['00639', '3260', '(股)', 27494084, 14.17, 14.29, 14.11, 0.08, null]
/js/worker.js:84 [Worker] Item 24 - Original Date: 00639, Formatted Date: null
/js/worker.js:86 [Worker] Item 24 - Invalid formatted date: 00639
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 25: (9) ['00640L', '3260', '(股)', 41155711, 66, 66.7, 66, 0.65, null]
/js/worker.js:84 [Worker] Item 25 - Original Date: 00640L, Formatted Date: null
/js/worker.js:86 [Worker] Item 25 - Invalid formatted date: 00640L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 26: (9) ['00641R', '3260', '(股)', 4980025, 5.03, 5.04, 5, -0.04, null]
/js/worker.js:84 [Worker] Item 26 - Original Date: 00641R, Formatted Date: null
/js/worker.js:86 [Worker] Item 26 - Invalid formatted date: 00641R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 27: (9) ['00642U', '3260', '(股)', 31505847, 16.31, 16.33, 16.25, -0.15, null]
/js/worker.js:84 [Worker] Item 27 - Original Date: 00642U, Formatted Date: null
/js/worker.js:86 [Worker] Item 27 - Invalid formatted date: 00642U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 28: (9) ['00643', '3260', '(股)', 46377048, 15.62, 15.93, 15.62, 0.14, null]
/js/worker.js:84 [Worker] Item 28 - Original Date: 00643, Formatted Date: null
/js/worker.js:86 [Worker] Item 28 - Invalid formatted date: 00643
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 29: (9) ['00643K', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 29 - Original Date: 00643K, Formatted Date: null
/js/worker.js:86 [Worker] Item 29 - Invalid formatted date: 00643K
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 30: (9) ['00645', '3260', '(股)', 11127815, 43.75, 43.98, 43.75, 0.21, null]
/js/worker.js:84 [Worker] Item 30 - Original Date: 00645, Formatted Date: null
/js/worker.js:86 [Worker] Item 30 - Invalid formatted date: 00645
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 31: (9) ['00646', '3260', '(股)', 234518037, 62.5, 62.7, 62.4, 0.55, null]
/js/worker.js:84 [Worker] Item 31 - Original Date: 00646, Formatted Date: null
/js/worker.js:86 [Worker] Item 31 - Invalid formatted date: 00646
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 32: (9) ['00647L', '3260', '(股)', 17106432, 108.1, 108.9, 108.1, 1.05, null]
/js/worker.js:84 [Worker] Item 32 - Original Date: 00647L, Formatted Date: null
/js/worker.js:86 [Worker] Item 32 - Invalid formatted date: 00647L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 33: (9) ['00648R', '3260', '(股)', 6734594, 4.45, 4.45, 4.43, -0.01, null]
/js/worker.js:84 [Worker] Item 33 - Original Date: 00648R, Formatted Date: null
/js/worker.js:86 [Worker] Item 33 - Invalid formatted date: 00648R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 34: (9) ['00650L', '3260', '(股)', 180740967, 18.98, 19.24, 18.79, -0.19, null]
/js/worker.js:84 [Worker] Item 34 - Original Date: 00650L, Formatted Date: null
/js/worker.js:86 [Worker] Item 34 - Invalid formatted date: 00650L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 35: (9) ['00651R', '3260', '(股)', 3947471, 5.14, 5.16, 5.1, 0.02, null]
/js/worker.js:84 [Worker] Item 35 - Original Date: 00651R, Formatted Date: null
/js/worker.js:86 [Worker] Item 35 - Invalid formatted date: 00651R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 36: (9) ['00652', '3260', '(股)', 27553620, 35.9, 36.12, 35.9, 0.24, null]
/js/worker.js:84 [Worker] Item 36 - Original Date: 00652, Formatted Date: null
/js/worker.js:86 [Worker] Item 36 - Invalid formatted date: 00652
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 37: (9) ['00653L', '3260', '(股)', 21830160, 56.8, 57.35, 56.8, 0.65, null]
/js/worker.js:84 [Worker] Item 37 - Original Date: 00653L, Formatted Date: null
/js/worker.js:86 [Worker] Item 37 - Invalid formatted date: 00653L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 38: (9) ['00654R', '3260', '(股)', 1849143, 6.23, 6.23, 6.22, -0.03, null]
/js/worker.js:84 [Worker] Item 38 - Original Date: 00654R, Formatted Date: null
/js/worker.js:86 [Worker] Item 38 - Invalid formatted date: 00654R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 39: (9) ['00655L', '3260', '(股)', 50840616, 33.7, 34.06, 33.37, -0.25, null]
/js/worker.js:84 [Worker] Item 39 - Original Date: 00655L, Formatted Date: null
/js/worker.js:86 [Worker] Item 39 - Invalid formatted date: 00655L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 40: (9) ['00656R', '3260', '(股)', 1765049, 6.04, 6.07, 6.01, 0.03, null]
/js/worker.js:84 [Worker] Item 40 - Original Date: 00656R, Formatted Date: null
/js/worker.js:86 [Worker] Item 40 - Invalid formatted date: 00656R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 41: (9) ['00657', '3260', '(股)', 1524759, 52.95, 53.3, 52.9, 0.75, null]
/js/worker.js:84 [Worker] Item 41 - Original Date: 00657, Formatted Date: null
/js/worker.js:86 [Worker] Item 41 - Invalid formatted date: 00657
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 42: (9) ['00657K', '3260', '(股)', 3560, 17.8, 17.8, 17.8, 0.11, null]
/js/worker.js:84 [Worker] Item 42 - Original Date: 00657K, Formatted Date: null
/js/worker.js:86 [Worker] Item 42 - Invalid formatted date: 00657K
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 43: (9) ['00660', '3260', '(股)', 911635, 39.09, 39.14, 39.01, 0.01, null]
/js/worker.js:84 [Worker] Item 43 - Original Date: 00660, Formatted Date: null
/js/worker.js:86 [Worker] Item 43 - Invalid formatted date: 00660
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 44: (9) ['00661', '3260', '(股)', 5008666, 57.55, 58.3, 57.55, 0.9, null]
/js/worker.js:84 [Worker] Item 44 - Original Date: 00661, Formatted Date: null
/js/worker.js:86 [Worker] Item 44 - Invalid formatted date: 00661
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 45: (9) ['00662', '3260', '(股)', 672093083, 93.95, 94.65, 93.95, 0.9, null]
/js/worker.js:84 [Worker] Item 45 - Original Date: 00662, Formatted Date: null
/js/worker.js:86 [Worker] Item 45 - Invalid formatted date: 00662
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 46: (9) ['00663L', '3260', '(股)', 154962528, 37.63, 38.06, 37.36, 0.72, null]
/js/worker.js:84 [Worker] Item 46 - Original Date: 00663L, Formatted Date: null
/js/worker.js:86 [Worker] Item 46 - Invalid formatted date: 00663L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 47: (9) ['00664R', '3260', '(股)', 43190583, 3.03, 3.05, 3.01, -0.03, null]
/js/worker.js:84 [Worker] Item 47 - Original Date: 00664R, Formatted Date: null
/js/worker.js:86 [Worker] Item 47 - Invalid formatted date: 00664R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 48: (9) ['00665L', '3260', '(股)', 368526123, 12.41, 12.59, 12.22, -0.14, null]
/js/worker.js:84 [Worker] Item 48 - Original Date: 00665L, Formatted Date: null
/js/worker.js:86 [Worker] Item 48 - Invalid formatted date: 00665L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 49: (9) ['00666R', '3260', '(股)', 8160951, 8.34, 8.39, 8.27, 0.05, null]
/js/worker.js:84 [Worker] Item 49 - Original Date: 00666R, Formatted Date: null
/js/worker.js:86 [Worker] Item 49 - Invalid formatted date: 00666R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 50: (9) ['00668', '3260', '(股)', 4380103, 50.45, 50.7, 50.45, 0.55, null]
/js/worker.js:84 [Worker] Item 50 - Original Date: 00668, Formatted Date: null
/js/worker.js:86 [Worker] Item 50 - Invalid formatted date: 00668
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 51: (9) ['00668K', '3260', '(股)', 3360, 16.8, 16.8, 16.8, 0.09, null]
/js/worker.js:84 [Worker] Item 51 - Original Date: 00668K, Formatted Date: null
/js/worker.js:86 [Worker] Item 51 - Invalid formatted date: 00668K
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 52: (9) ['00669R', '3260', '(股)', 10122499, 5.84, 5.84, 5.82, -0.04, null]
/js/worker.js:84 [Worker] Item 52 - Original Date: 00669R, Formatted Date: null
/js/worker.js:86 [Worker] Item 52 - Invalid formatted date: 00669R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 53: (9) ['00670L', '3260', '(股)', 127151792, 153.7, 154.85, 153.7, 1.45, null]
/js/worker.js:84 [Worker] Item 53 - Original Date: 00670L, Formatted Date: null
/js/worker.js:86 [Worker] Item 53 - Invalid formatted date: 00670L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 54: (9) ['00671R', '3260', '(股)', 62807379, 2.97, 2.98, 2.95, -0.01, null]
/js/worker.js:84 [Worker] Item 54 - Original Date: 00671R, Formatted Date: null
/js/worker.js:86 [Worker] Item 54 - Invalid formatted date: 00671R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 55: (9) ['00673R', '3260', '(股)', 52671169, 6.6, 6.63, 6.59, 0.06, null]
/js/worker.js:84 [Worker] Item 55 - Original Date: 00673R, Formatted Date: null
/js/worker.js:86 [Worker] Item 55 - Invalid formatted date: 00673R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 56: (9) ['00674R', '3260', '(股)', 14905332, 6.96, 6.98, 6.95, 0.06, null]
/js/worker.js:84 [Worker] Item 56 - Original Date: 00674R, Formatted Date: null
/js/worker.js:86 [Worker] Item 56 - Invalid formatted date: 00674R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 57: (9) ['00675L', '3260', '(股)', 253481153, 114.55, 115.8, 113.7, 1.85, null]
/js/worker.js:84 [Worker] Item 57 - Original Date: 00675L, Formatted Date: null
/js/worker.js:86 [Worker] Item 57 - Invalid formatted date: 00675L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 58: (9) ['00676R', '3260', '(股)', 27490697, 10.29, 10.34, 10.24, -0.11, null]
/js/worker.js:84 [Worker] Item 58 - Original Date: 00676R, Formatted Date: null
/js/worker.js:86 [Worker] Item 58 - Invalid formatted date: 00676R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 59: (9) ['00678', '3260', '(股)', 1594356, 27.79, 27.98, 27.79, 0.19, null]
/js/worker.js:84 [Worker] Item 59 - Original Date: 00678, Formatted Date: null
/js/worker.js:86 [Worker] Item 59 - Invalid formatted date: 00678
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 60: (9) ['00680L', '3260', '(股)', 578728884, 7.53, 7.57, 7.52, -0.06, null]
/js/worker.js:84 [Worker] Item 60 - Original Date: 00680L, Formatted Date: null
/js/worker.js:86 [Worker] Item 60 - Invalid formatted date: 00680L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 61: (9) ['00681R', '3260', '(股)', 4372910, 20.26, 20.27, 20.23, 0.09, null]
/js/worker.js:84 [Worker] Item 61 - Original Date: 00681R, Formatted Date: null
/js/worker.js:86 [Worker] Item 61 - Invalid formatted date: 00681R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 62: (9) ['00682U', '3260', '(股)', 20113, 19.82, 19.82, 19.82, 0.02, null]
/js/worker.js:84 [Worker] Item 62 - Original Date: 00682U, Formatted Date: null
/js/worker.js:86 [Worker] Item 62 - Invalid formatted date: 00682U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 63: (9) ['00683L', '3260', '(股)', 3445152, 20.08, 20.16, 20.07, 0.2, null]
/js/worker.js:84 [Worker] Item 63 - Original Date: 00683L, Formatted Date: null
/js/worker.js:86 [Worker] Item 63 - Invalid formatted date: 00683L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 64: (9) ['00684R', '3260', '(股)', 1937720, 15.89, 15.9, 15.86, -0.12, null]
/js/worker.js:84 [Worker] Item 64 - Original Date: 00684R, Formatted Date: null
/js/worker.js:86 [Worker] Item 64 - Invalid formatted date: 00684R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 65: (9) ['00685L', '3260', '(股)', 42446106, 102.8, 104.05, 102.15, 1.8, null]
/js/worker.js:84 [Worker] Item 65 - Original Date: 00685L, Formatted Date: null
/js/worker.js:86 [Worker] Item 65 - Invalid formatted date: 00685L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 66: (9) ['00686R', '3260', '(股)', 4384647, 1.85, 1.86, 1.83, -0.02, null]
/js/worker.js:84 [Worker] Item 66 - Original Date: 00686R, Formatted Date: null
/js/worker.js:86 [Worker] Item 66 - Invalid formatted date: 00686R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 67: (9) ['00688L', '3260', '(股)', 202863164, 7.51, 7.55, 7.49, -0.05, null]
/js/worker.js:84 [Worker] Item 67 - Original Date: 00688L, Formatted Date: null
/js/worker.js:86 [Worker] Item 67 - Invalid formatted date: 00688L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 68: (9) ['00689R', '3260', '(股)', 103850, 20.77, 20.77, 20.77, 0.1, null]
/js/worker.js:84 [Worker] Item 68 - Original Date: 00689R, Formatted Date: null
/js/worker.js:86 [Worker] Item 68 - Invalid formatted date: 00689R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 69: (9) ['00690', '3260', '(股)', 14563160, 40.54, 40.98, 40.45, 0.52, null]
/js/worker.js:84 [Worker] Item 69 - Original Date: 00690, Formatted Date: null
/js/worker.js:86 [Worker] Item 69 - Invalid formatted date: 00690
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 70: (9) ['00692', '3260', '(股)', 109815066, 51.25, 51.65, 51.05, 0.55, null]
/js/worker.js:84 [Worker] Item 70 - Original Date: 00692, Formatted Date: null
/js/worker.js:86 [Worker] Item 70 - Invalid formatted date: 00692
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 71: (9) ['00693U', '3260', '(股)', 53799151, 20.38, 20.38, 20.3, -0.12, null]
/js/worker.js:84 [Worker] Item 71 - Original Date: 00693U, Formatted Date: null
/js/worker.js:86 [Worker] Item 71 - Invalid formatted date: 00693U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 72: (9) ['00700', '3260', '(股)', 26345844, 18.8, 18.98, 18.71, -0.06, null]
/js/worker.js:84 [Worker] Item 72 - Original Date: 00700, Formatted Date: null
/js/worker.js:86 [Worker] Item 72 - Invalid formatted date: 00700
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 73: (9) ['00701', '3260', '(股)', 21154058, 27.58, 27.63, 27.5, 0.06, null]
/js/worker.js:84 [Worker] Item 73 - Original Date: 00701, Formatted Date: null
/js/worker.js:86 [Worker] Item 73 - Invalid formatted date: 00701
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 74: (9) ['00702', '3260', '(股)', 2807125, 22.46, 22.48, 22.45, -0.07, null]
/js/worker.js:84 [Worker] Item 74 - Original Date: 00702, Formatted Date: null
/js/worker.js:86 [Worker] Item 74 - Invalid formatted date: 00702
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 75: (9) ['00703', '3260', '(股)', 3922277, 22.34, 22.47, 22.21, 0.02, null]
/js/worker.js:84 [Worker] Item 75 - Original Date: 00703, Formatted Date: null
/js/worker.js:86 [Worker] Item 75 - Invalid formatted date: 00703
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 76: (9) ['00706L', '3260', '(股)', 33985529, 5.95, 5.95, 5.91, -0.05, null]
/js/worker.js:84 [Worker] Item 76 - Original Date: 00706L, Formatted Date: null
/js/worker.js:86 [Worker] Item 76 - Invalid formatted date: 00706L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 77: (9) ['00707R', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 77 - Original Date: 00707R, Formatted Date: null
/js/worker.js:86 [Worker] Item 77 - Invalid formatted date: 00707R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 78: (9) ['00708L', '3260', '(股)', 197482422, 67.3, 67.4, 66.9, -0.9, null]
/js/worker.js:84 [Worker] Item 78 - Original Date: 00708L, Formatted Date: null
/js/worker.js:86 [Worker] Item 78 - Invalid formatted date: 00708L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 79: (9) ['00709', '3260', '(股)', 5121123, 33.19, 33.29, 33.15, 0.08, null]
/js/worker.js:84 [Worker] Item 79 - Original Date: 00709, Formatted Date: null
/js/worker.js:86 [Worker] Item 79 - Invalid formatted date: 00709
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 80: (9) ['00710B', '3260', '(股)', 2837635, 18.25, 18.36, 18.25, 0.06, null]
/js/worker.js:84 [Worker] Item 80 - Original Date: 00710B, Formatted Date: null
/js/worker.js:86 [Worker] Item 80 - Invalid formatted date: 00710B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 81: (9) ['00711B', '3260', '(股)', 2252244, 15.72, 15.75, 15.72, 0.05, null]
/js/worker.js:84 [Worker] Item 81 - Original Date: 00711B, Formatted Date: null
/js/worker.js:86 [Worker] Item 81 - Invalid formatted date: 00711B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 82: (9) ['00712', '3260', '(股)', 283655649, 8.91, 8.92, 8.89, 0.01, null]
/js/worker.js:84 [Worker] Item 82 - Original Date: 00712, Formatted Date: null
/js/worker.js:86 [Worker] Item 82 - Invalid formatted date: 00712
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 83: (9) ['00713', '3260', '(股)', 544261589, 51.8, 51.85, 51.7, 0.15, null]
/js/worker.js:84 [Worker] Item 83 - Original Date: 00713, Formatted Date: null
/js/worker.js:86 [Worker] Item 83 - Invalid formatted date: 00713
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 84: (9) ['00714', '3260', '(股)', 14526361, 19.8, 19.82, 19.75, 0, null]
/js/worker.js:84 [Worker] Item 84 - Original Date: 00714, Formatted Date: null
/js/worker.js:86 [Worker] Item 84 - Invalid formatted date: 00714
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 85: (9) ['00715L', '3260', '(股)', 382939907, 11.41, 11.45, 11.33, -0.18, null]
/js/worker.js:84 [Worker] Item 85 - Original Date: 00715L, Formatted Date: null
/js/worker.js:86 [Worker] Item 85 - Invalid formatted date: 00715L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 86: (9) ['00717', '3260', '(股)', 5832028, 14.87, 14.96, 14.87, 0.04, null]
/js/worker.js:84 [Worker] Item 86 - Original Date: 00717, Formatted Date: null
/js/worker.js:86 [Worker] Item 86 - Invalid formatted date: 00717
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 87: (9) ['00728', '3260', '(股)', 13114311, 33.39, 33.81, 33.39, null, null]
/js/worker.js:84 [Worker] Item 87 - Original Date: 00728, Formatted Date: null
/js/worker.js:86 [Worker] Item 87 - Invalid formatted date: 00728
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 88: (9) ['00730', '3260', '(股)', 4667768, 24.57, 24.92, 24.57, 0.29, null]
/js/worker.js:84 [Worker] Item 88 - Original Date: 00730, Formatted Date: null
/js/worker.js:86 [Worker] Item 88 - Invalid formatted date: 00730
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 89: (9) ['00731', '3260', '(股)', 44348423, 67.3, 67.5, 67.2, 0.2, null]
/js/worker.js:84 [Worker] Item 89 - Original Date: 00731, Formatted Date: null
/js/worker.js:86 [Worker] Item 89 - Invalid formatted date: 00731
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 90: (9) ['00733', '3260', '(股)', 52501254, 46, 46.84, 46, 0.98, null]
/js/worker.js:84 [Worker] Item 90 - Original Date: 00733, Formatted Date: null
/js/worker.js:86 [Worker] Item 90 - Invalid formatted date: 00733
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 91: (9) ['00735', '3260', '(股)', 13798046, 41.17, 41.76, 41.17, 0.62, null]
/js/worker.js:84 [Worker] Item 91 - Original Date: 00735, Formatted Date: null
/js/worker.js:86 [Worker] Item 91 - Invalid formatted date: 00735
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 92: (9) ['00736', '3260', '(股)', 3155135, 26.47, 26.57, 26.4, 0.07, null]
/js/worker.js:84 [Worker] Item 92 - Original Date: 00736, Formatted Date: null
/js/worker.js:86 [Worker] Item 92 - Invalid formatted date: 00736
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 93: (9) ['00737', '3260', '(股)', 7394830, 34.2, 34.49, 34.2, 0.42, null]
/js/worker.js:84 [Worker] Item 93 - Original Date: 00737, Formatted Date: null
/js/worker.js:86 [Worker] Item 93 - Invalid formatted date: 00737
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 94: (9) ['00738U', '3260', '(股)', 91271331, 34.9, 34.98, 34.54, -0.35, null]
/js/worker.js:84 [Worker] Item 94 - Original Date: 00738U, Formatted Date: null
/js/worker.js:86 [Worker] Item 94 - Invalid formatted date: 00738U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 95: (9) ['00739', '3260', '(股)', 2353435, 25.61, 25.66, 25.46, -0.09, null]
/js/worker.js:84 [Worker] Item 95 - Original Date: 00739, Formatted Date: null
/js/worker.js:86 [Worker] Item 95 - Invalid formatted date: 00739
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 96: (9) ['00752', '3260', '(股)', 211071811, 26.93, 27.29, 26.93, 0.32, null]
/js/worker.js:84 [Worker] Item 96 - Original Date: 00752, Formatted Date: null
/js/worker.js:86 [Worker] Item 96 - Invalid formatted date: 00752
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 97: (9) ['00753L', '3260', '(股)', 446578263, 13.95, 14.09, 13.8, -0.01, null]
/js/worker.js:84 [Worker] Item 97 - Original Date: 00753L, Formatted Date: null
/js/worker.js:86 [Worker] Item 97 - Invalid formatted date: 00753L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 98: (9) ['00757', '3260', '(股)', 366186856, 116.2, 116.8, 116.1, 0.65, null]
/js/worker.js:84 [Worker] Item 98 - Original Date: 00757, Formatted Date: null
/js/worker.js:86 [Worker] Item 98 - Invalid formatted date: 00757
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 99: (9) ['00762', '3260', '(股)', 21507292, 79.85, 80.2, 79.75, 0.2, null]
/js/worker.js:84 [Worker] Item 99 - Original Date: 00762, Formatted Date: null
/js/worker.js:86 [Worker] Item 99 - Invalid formatted date: 00762
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 100: (9) ['00763U', '3260', '(股)', 38980943, 25.55, 25.55, 25.44, -0.29, null]
/js/worker.js:84 [Worker] Item 100 - Original Date: 00763U, Formatted Date: null
/js/worker.js:86 [Worker] Item 100 - Invalid formatted date: 00763U
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 101: (9) ['00770', '3260', '(股)', 38854605, 52.1, 52.65, 52.1, 0.4, null]
/js/worker.js:84 [Worker] Item 101 - Original Date: 00770, Formatted Date: null
/js/worker.js:86 [Worker] Item 101 - Invalid formatted date: 00770
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 102: (9) ['00771', '3260', '(股)', 2110662, 16.06, 16.06, 16.02, 0, null]
/js/worker.js:84 [Worker] Item 102 - Original Date: 00771, Formatted Date: null
/js/worker.js:86 [Worker] Item 102 - Invalid formatted date: 00771
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 103: (9) ['00775B', '3260', '(股)', 126555, 32.03, 32.07, 32.03, 0.12, null]
/js/worker.js:84 [Worker] Item 103 - Original Date: 00775B, Formatted Date: null
/js/worker.js:86 [Worker] Item 103 - Invalid formatted date: 00775B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 104: (9) ['00783', '3260', '(股)', 8434379, 23.59, 23.92, 23.59, 0.15, null]
/js/worker.js:84 [Worker] Item 104 - Original Date: 00783, Formatted Date: null
/js/worker.js:86 [Worker] Item 104 - Invalid formatted date: 00783
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 105: (9) ['00830', '3260', '(股)', 379989171, 47.25, 47.71, 47.25, 0.58, null]
/js/worker.js:84 [Worker] Item 105 - Original Date: 00830, Formatted Date: null
/js/worker.js:86 [Worker] Item 105 - Invalid formatted date: 00830
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 106: (9) ['00850', '3260', '(股)', 40403423, 49.98, 50.45, 49.94, 0.51, null]
/js/worker.js:84 [Worker] Item 106 - Original Date: 00850, Formatted Date: null
/js/worker.js:86 [Worker] Item 106 - Invalid formatted date: 00850
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 107: (9) ['00851', '3260', '(股)', 30300758, 53.15, 53.65, 53.15, 0.55, null]
/js/worker.js:84 [Worker] Item 107 - Original Date: 00851, Formatted Date: null
/js/worker.js:86 [Worker] Item 107 - Invalid formatted date: 00851
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 108: (9) ['00852L', '3260', '(股)', 31696665, 27.84, 27.94, 27.84, 0.51, null]
/js/worker.js:84 [Worker] Item 108 - Original Date: 00852L, Formatted Date: null
/js/worker.js:86 [Worker] Item 108 - Invalid formatted date: 00852L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 109: (9) ['00861', '3260', '(股)', 21021513, 47.46, 47.96, 47.46, 0.6, null]
/js/worker.js:84 [Worker] Item 109 - Original Date: 00861, Formatted Date: null
/js/worker.js:86 [Worker] Item 109 - Invalid formatted date: 00861
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 110: (9) ['00865B', '3260', '(股)', 43203656, 44.62, 44.73, 44.62, 0.12, null]
/js/worker.js:84 [Worker] Item 110 - Original Date: 00865B, Formatted Date: null
/js/worker.js:86 [Worker] Item 110 - Invalid formatted date: 00865B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 111: (9) ['00875', '3260', '(股)', 3784887, 38.64, 38.9, 38.64, 0.45, null]
/js/worker.js:84 [Worker] Item 111 - Original Date: 00875, Formatted Date: null
/js/worker.js:86 [Worker] Item 111 - Invalid formatted date: 00875
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 112: (9) ['00876', '3260', '(股)', 13255107, 42.72, 43.36, 42.72, 0.66, null]
/js/worker.js:84 [Worker] Item 112 - Original Date: 00876, Formatted Date: null
/js/worker.js:86 [Worker] Item 112 - Invalid formatted date: 00876
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 113: (9) ['00878', '3260', '(股)', 1485969345, 21.11, 21.14, 21.01, 0.08, null]
/js/worker.js:84 [Worker] Item 113 - Original Date: 00878, Formatted Date: null
/js/worker.js:86 [Worker] Item 113 - Invalid formatted date: 00878
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 114: (9) ['00881', '3260', '(股)', 356052241, 28.71, 29.06, 28.58, 0.41, null]
/js/worker.js:84 [Worker] Item 114 - Original Date: 00881, Formatted Date: null
/js/worker.js:86 [Worker] Item 114 - Invalid formatted date: 00881
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 115: (9) ['00882', '3260', '(股)', 282819481, 14.25, 14.3, 14.14, -0.11, null]
/js/worker.js:84 [Worker] Item 115 - Original Date: 00882, Formatted Date: null
/js/worker.js:86 [Worker] Item 115 - Invalid formatted date: 00882
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 116: (9) ['00885', '3260', '(股)', 106158994, 16.04, 16.21, 16.04, 0.02, null]
/js/worker.js:84 [Worker] Item 116 - Original Date: 00885, Formatted Date: null
/js/worker.js:86 [Worker] Item 116 - Invalid formatted date: 00885
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 117: (9) ['00891', '3260', '(股)', 89343069, 18.54, 18.64, 18.53, 0.19, null]
/js/worker.js:84 [Worker] Item 117 - Original Date: 00891, Formatted Date: null
/js/worker.js:86 [Worker] Item 117 - Invalid formatted date: 00891
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 118: (9) ['00892', '3260', '(股)', 65176251, 18.92, 19.17, 18.92, 0.37, null]
/js/worker.js:84 [Worker] Item 118 - Original Date: 00892, Formatted Date: null
/js/worker.js:86 [Worker] Item 118 - Invalid formatted date: 00892
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 119: (9) ['00893', '3260', '(股)', 98888467, 28.19, 28.46, 28.19, 0.21, null]
/js/worker.js:84 [Worker] Item 119 - Original Date: 00893, Formatted Date: null
/js/worker.js:86 [Worker] Item 119 - Invalid formatted date: 00893
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 120: (9) ['00894', '3260', '(股)', 75375506, 24.04, 24.37, 24.02, 0.39, null]
/js/worker.js:84 [Worker] Item 120 - Original Date: 00894, Formatted Date: null
/js/worker.js:86 [Worker] Item 120 - Invalid formatted date: 00894
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 121: (9) ['00895', '3260', '(股)', 42060636, 34.5, 34.56, 34.37, 0.04, null]
/js/worker.js:84 [Worker] Item 121 - Original Date: 00895, Formatted Date: null
/js/worker.js:86 [Worker] Item 121 - Invalid formatted date: 00895
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 122: (9) ['00896', '3260', '(股)', 27316787, 17.98, 18.27, 17.98, 0.22, null]
/js/worker.js:84 [Worker] Item 122 - Original Date: 00896, Formatted Date: null
/js/worker.js:86 [Worker] Item 122 - Invalid formatted date: 00896
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 123: (9) ['00897', '3260', '(股)', 3369890, 7.21, 7.27, 7.21, 0.05, null]
/js/worker.js:84 [Worker] Item 123 - Original Date: 00897, Formatted Date: null
/js/worker.js:86 [Worker] Item 123 - Invalid formatted date: 00897
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 124: (9) ['00898', '3260', '(股)', 2231595, 6.57, 6.57, 6.52, 0.07, null]
/js/worker.js:84 [Worker] Item 124 - Original Date: 00898, Formatted Date: null
/js/worker.js:86 [Worker] Item 124 - Invalid formatted date: 00898
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 125: (9) ['00899', '3260', '(股)', 6285308, 16.88, 17.16, 16.88, 0.26, null]
/js/worker.js:84 [Worker] Item 125 - Original Date: 00899, Formatted Date: null
/js/worker.js:86 [Worker] Item 125 - Invalid formatted date: 00899
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 126: (9) ['00900', '3260', '(股)', 209567621, 13.55, 13.63, 13.53, 0.13, null]
/js/worker.js:84 [Worker] Item 126 - Original Date: 00900, Formatted Date: null
/js/worker.js:86 [Worker] Item 126 - Invalid formatted date: 00900
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 127: (9) ['00901', '3260', '(股)', 3953681, 24.5, 24.82, 24.43, 0.4, null]
/js/worker.js:84 [Worker] Item 127 - Original Date: 00901, Formatted Date: null
/js/worker.js:86 [Worker] Item 127 - Invalid formatted date: 00901
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 128: (9) ['00902', '3260', '(股)', 45952626, 10.95, 11.01, 10.88, 0.06, null]
/js/worker.js:84 [Worker] Item 128 - Original Date: 00902, Formatted Date: null
/js/worker.js:86 [Worker] Item 128 - Invalid formatted date: 00902
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 129: (9) ['00903', '3260', '(股)', 25502143, 16.45, 16.6, 16.45, 0.17, null]
/js/worker.js:84 [Worker] Item 129 - Original Date: 00903, Formatted Date: null
/js/worker.js:86 [Worker] Item 129 - Invalid formatted date: 00903
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 130: (9) ['00904', '3260', '(股)', 15958349, 19.95, 20.2, 19.95, 0.35, null]
/js/worker.js:84 [Worker] Item 130 - Original Date: 00904, Formatted Date: null
/js/worker.js:86 [Worker] Item 130 - Invalid formatted date: 00904
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 131: (9) ['00905', '3260', '(股)', 32362577, 15.83, 15.97, 15.8, 0.17, null]
/js/worker.js:84 [Worker] Item 131 - Original Date: 00905, Formatted Date: null
/js/worker.js:86 [Worker] Item 131 - Invalid formatted date: 00905
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 132: (9) ['00907', '3260', '(股)', 10480827, 15.41, 15.44, 15.37, 0.02, null]
/js/worker.js:84 [Worker] Item 132 - Original Date: 00907, Formatted Date: null
/js/worker.js:86 [Worker] Item 132 - Invalid formatted date: 00907
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 133: (9) ['00908', '3260', '(股)', 11753462, 13.48, 13.5, 13.48, -0.02, null]
/js/worker.js:84 [Worker] Item 133 - Original Date: 00908, Formatted Date: null
/js/worker.js:86 [Worker] Item 133 - Invalid formatted date: 00908
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 134: (9) ['00909', '3260', '(股)', 150231464, 40.46, 41.17, 40.46, 1.18, null]
/js/worker.js:84 [Worker] Item 134 - Original Date: 00909, Formatted Date: null
/js/worker.js:86 [Worker] Item 134 - Invalid formatted date: 00909
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 135: (9) ['00910', '3260', '(股)', 48869988, 38.1, 38.29, 38.1, 0.14, null]
/js/worker.js:84 [Worker] Item 135 - Original Date: 00910, Formatted Date: null
/js/worker.js:86 [Worker] Item 135 - Invalid formatted date: 00910
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 136: (9) ['00911', '3260', '(股)', 14411921, 27.01, 27.24, 27, 0.26, null]
/js/worker.js:84 [Worker] Item 136 - Original Date: 00911, Formatted Date: null
/js/worker.js:86 [Worker] Item 136 - Invalid formatted date: 00911
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 137: (9) ['00912', '3260', '(股)', 7433156, 20.01, 20.13, 19.97, 0.17, null]
/js/worker.js:84 [Worker] Item 137 - Original Date: 00912, Formatted Date: null
/js/worker.js:86 [Worker] Item 137 - Invalid formatted date: 00912
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 138: (9) ['00913', '3260', '(股)', 4243747, 21.26, 21.57, 21.26, 0.46, null]
/js/worker.js:84 [Worker] Item 138 - Original Date: 00913, Formatted Date: null
/js/worker.js:86 [Worker] Item 138 - Invalid formatted date: 00913
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 139: (9) ['00915', '3260', '(股)', 108826176, 22.6, 22.67, 22.55, 0.15, null]
/js/worker.js:84 [Worker] Item 139 - Original Date: 00915, Formatted Date: null
/js/worker.js:86 [Worker] Item 139 - Invalid formatted date: 00915
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 140: (9) ['00916', '3260', '(股)', 5843262, 25.93, 25.93, 25.83, 0.23, null]
/js/worker.js:84 [Worker] Item 140 - Original Date: 00916, Formatted Date: null
/js/worker.js:86 [Worker] Item 140 - Invalid formatted date: 00916
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 141: (9) ['00917', '3260', '(股)', 8992743, 23.31, 23.54, 23.31, 0.21, null]
/js/worker.js:84 [Worker] Item 141 - Original Date: 00917, Formatted Date: null
/js/worker.js:86 [Worker] Item 141 - Invalid formatted date: 00917
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 142: (9) ['00918', '3260', '(股)', 607667748, 22.49, 22.53, 22.42, null, null]
/js/worker.js:84 [Worker] Item 142 - Original Date: 00918, Formatted Date: null
/js/worker.js:86 [Worker] Item 142 - Invalid formatted date: 00918
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 143: (9) ['00919', '3260', '(股)', 1145070351, 21.33, 21.38, 21.3, 0.05, null]
/js/worker.js:84 [Worker] Item 143 - Original Date: 00919, Formatted Date: null
/js/worker.js:86 [Worker] Item 143 - Invalid formatted date: 00919
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 144: (9) ['00920', '3260', '(股)', 5475077, 15.48, 15.67, 15.48, 0.29, null]
/js/worker.js:84 [Worker] Item 144 - Original Date: 00920, Formatted Date: null
/js/worker.js:86 [Worker] Item 144 - Invalid formatted date: 00920
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 145: (9) ['00921', '3260', '(股)', 5258050, 17.48, 17.54, 17.48, 0.04, null]
/js/worker.js:84 [Worker] Item 145 - Original Date: 00921, Formatted Date: null
/js/worker.js:86 [Worker] Item 145 - Invalid formatted date: 00921
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 146: (9) ['00922', '3260', '(股)', 165385163, 24.1, 24.25, 23.98, 0.24, null]
/js/worker.js:84 [Worker] Item 146 - Original Date: 00922, Formatted Date: null
/js/worker.js:86 [Worker] Item 146 - Invalid formatted date: 00922
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 147: (9) ['00923', '3260', '(股)', 83326576, 23.02, 23.14, 22.91, 0.24, null]
/js/worker.js:84 [Worker] Item 147 - Original Date: 00923, Formatted Date: null
/js/worker.js:86 [Worker] Item 147 - Invalid formatted date: 00923
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 148: (9) ['00924', '3260', '(股)', 56498655, 27.16, 27.24, 27.16, 0.1, null]
/js/worker.js:84 [Worker] Item 148 - Original Date: 00924, Formatted Date: null
/js/worker.js:86 [Worker] Item 148 - Invalid formatted date: 00924
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 149: (9) ['00926', '3260', '(股)', 26174317, 22.14, 22.2, 22.14, 0.04, null]
/js/worker.js:84 [Worker] Item 149 - Original Date: 00926, Formatted Date: null
/js/worker.js:86 [Worker] Item 149 - Invalid formatted date: 00926
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 150: (9) ['00927', '3260', '(股)', 207417454, 19.47, 19.78, 19.47, 0.42, null]
/js/worker.js:84 [Worker] Item 150 - Original Date: 00927, Formatted Date: null
/js/worker.js:86 [Worker] Item 150 - Invalid formatted date: 00927
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 151: (9) ['00929', '3260', '(股)', 1029098046, 18.29, 18.48, 18.29, 0.29, null]
/js/worker.js:84 [Worker] Item 151 - Original Date: 00929, Formatted Date: null
/js/worker.js:86 [Worker] Item 151 - Invalid formatted date: 00929
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 152: (9) ['00930', '3260', '(股)', 51389955, 17.43, 17.65, 17.43, 0.28, null]
/js/worker.js:84 [Worker] Item 152 - Original Date: 00930, Formatted Date: null
/js/worker.js:86 [Worker] Item 152 - Invalid formatted date: 00930
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 153: (9) ['00932', '3260', '(股)', 24565581, 14.57, 14.73, 14.57, 0.17, null]
/js/worker.js:84 [Worker] Item 153 - Original Date: 00932, Formatted Date: null
/js/worker.js:86 [Worker] Item 153 - Invalid formatted date: 00932
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 154: (9) ['00934', '3260', '(股)', 84920805, 19.98, 20.12, 19.95, 0.23, null]
/js/worker.js:84 [Worker] Item 154 - Original Date: 00934, Formatted Date: null
/js/worker.js:86 [Worker] Item 154 - Invalid formatted date: 00934
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 155: (9) ['00935', '3260', '(股)', 89561166, 26.04, 26.38, 26.01, 0.41, null]
/js/worker.js:84 [Worker] Item 155 - Original Date: 00935, Formatted Date: null
/js/worker.js:86 [Worker] Item 155 - Invalid formatted date: 00935
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 156: (9) ['00936', '3260', '(股)', 64006278, 15.78, 15.9, 15.78, 0.16, null]
/js/worker.js:84 [Worker] Item 156 - Original Date: 00936, Formatted Date: null
/js/worker.js:86 [Worker] Item 156 - Invalid formatted date: 00936
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 157: (9) ['00938', '3260', '(股)', 15208152, 15.72, 15.75, 15.65, 0.08, null]
/js/worker.js:84 [Worker] Item 157 - Original Date: 00938, Formatted Date: null
/js/worker.js:86 [Worker] Item 157 - Invalid formatted date: 00938
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 158: (9) ['00939', '3260', '(股)', 111813316, 14.06, 14.08, 14.03, 0.09, null]
/js/worker.js:84 [Worker] Item 158 - Original Date: 00939, Formatted Date: null
/js/worker.js:86 [Worker] Item 158 - Invalid formatted date: 00939
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 159: (9) ['00940', '3260', '(股)', 571961990, 9.42, 9.48, 9.41, 0.08, null]
/js/worker.js:84 [Worker] Item 159 - Original Date: 00940, Formatted Date: null
/js/worker.js:86 [Worker] Item 159 - Invalid formatted date: 00940
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 160: (9) ['00941', '3260', '(股)', 141675417, 14.61, 14.75, 14.61, 0.24, null]
/js/worker.js:84 [Worker] Item 160 - Original Date: 00941, Formatted Date: null
/js/worker.js:86 [Worker] Item 160 - Invalid formatted date: 00941
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 161: (9) ['00943', '3260', '(股)', 12821484, 14.49, 14.68, 14.49, 0.22, null]
/js/worker.js:84 [Worker] Item 161 - Original Date: 00943, Formatted Date: null
/js/worker.js:86 [Worker] Item 161 - Invalid formatted date: 00943
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 162: (9) ['00944', '3260', '(股)', 8819602, 14.36, 14.4, 14.36, 0.09, null]
/js/worker.js:84 [Worker] Item 162 - Original Date: 00944, Formatted Date: null
/js/worker.js:86 [Worker] Item 162 - Invalid formatted date: 00944
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 163: (9) ['00945B', '3260', '(股)', 58457132, 13.93, 13.95, 13.91, 0.03, null]
/js/worker.js:84 [Worker] Item 163 - Original Date: 00945B, Formatted Date: null
/js/worker.js:86 [Worker] Item 163 - Invalid formatted date: 00945B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 164: (9) ['00946', '3260', '(股)', 62658877, 10.25, 10.34, 10.25, 0.16, null]
/js/worker.js:84 [Worker] Item 164 - Original Date: 00946, Formatted Date: null
/js/worker.js:86 [Worker] Item 164 - Invalid formatted date: 00946
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 165: (9) ['00947', '3260', '(股)', 124161071, 15.37, 15.76, 15.37, 0.5, null]
/js/worker.js:84 [Worker] Item 165 - Original Date: 00947, Formatted Date: null
/js/worker.js:86 [Worker] Item 165 - Invalid formatted date: 00947
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 166: (9) ['00949', '3260', '(股)', 16363524, 17.3, 17.41, 17.28, 0.03, null]
/js/worker.js:84 [Worker] Item 166 - Original Date: 00949, Formatted Date: null
/js/worker.js:86 [Worker] Item 166 - Invalid formatted date: 00949
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 167: (9) ['00951', '3260', '(股)', 63867235, 9.49, 9.67, 9.49, 0.29, null]
/js/worker.js:84 [Worker] Item 167 - Original Date: 00951, Formatted Date: null
/js/worker.js:86 [Worker] Item 167 - Invalid formatted date: 00951
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 168: (9) ['00952', '3260', '(股)', 46073819, 10.92, 11.07, 10.92, 0.14, null]
/js/worker.js:84 [Worker] Item 168 - Original Date: 00952, Formatted Date: null
/js/worker.js:86 [Worker] Item 168 - Invalid formatted date: 00952
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 169: (9) ['00953B', '3260', '(股)', 321996490, 9.41, 9.42, 9.4, 0.02, null]
/js/worker.js:84 [Worker] Item 169 - Original Date: 00953B, Formatted Date: null
/js/worker.js:86 [Worker] Item 169 - Invalid formatted date: 00953B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 170: (9) ['00954', '3260', '(股)', 29535835, 10.04, 10.18, 10.03, 0.3, null]
/js/worker.js:84 [Worker] Item 170 - Original Date: 00954, Formatted Date: null
/js/worker.js:86 [Worker] Item 170 - Invalid formatted date: 00954
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 171: (9) ['00956', '3260', '(股)', 3018556, 10.56, 10.57, 10.54, 0.01, null]
/js/worker.js:84 [Worker] Item 171 - Original Date: 00956, Formatted Date: null
/js/worker.js:86 [Worker] Item 171 - Invalid formatted date: 00956
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 172: (9) ['00960', '3260', '(股)', 14772981, 14.48, 14.54, 14.48, 0.04, null]
/js/worker.js:84 [Worker] Item 172 - Original Date: 00960, Formatted Date: null
/js/worker.js:86 [Worker] Item 172 - Invalid formatted date: 00960
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 173: (9) ['00961', '3260', '(股)', 226925760, 9.22, 9.34, 9.22, 0.13, null]
/js/worker.js:84 [Worker] Item 173 - Original Date: 00961, Formatted Date: null
/js/worker.js:86 [Worker] Item 173 - Invalid formatted date: 00961
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 174: (9) ['00962', '3260', '(股)', 5773599, 10.49, 10.64, 10.49, 0.14, null]
/js/worker.js:84 [Worker] Item 174 - Original Date: 00962, Formatted Date: null
/js/worker.js:86 [Worker] Item 174 - Invalid formatted date: 00962
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 175: (9) ['00963', '3260', '(股)', 9459292, 10.57, 10.64, 10.57, 0.02, null]
/js/worker.js:84 [Worker] Item 175 - Original Date: 00963, Formatted Date: null
/js/worker.js:86 [Worker] Item 175 - Invalid formatted date: 00963
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 176: (9) ['00964', '3260', '(股)', 8340267, 10.85, 10.86, 10.82, 0.01, null]
/js/worker.js:84 [Worker] Item 176 - Original Date: 00964, Formatted Date: null
/js/worker.js:86 [Worker] Item 176 - Invalid formatted date: 00964
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 177: (9) ['00965', '3260', '(股)', 135686922, 21.45, 21.46, 21.38, -0.07, null]
/js/worker.js:84 [Worker] Item 177 - Original Date: 00965, Formatted Date: null
/js/worker.js:86 [Worker] Item 177 - Invalid formatted date: 00965
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 178: (9) ['00971', '3260', '(股)', 25624452, 15.65, 15.83, 15.65, 0.07, null]
/js/worker.js:84 [Worker] Item 178 - Original Date: 00971, Formatted Date: null
/js/worker.js:86 [Worker] Item 178 - Invalid formatted date: 00971
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 179: (9) ['00972', '3260', '(股)', 3204129, 16.62, 16.62, 16.53, -0.08, null]
/js/worker.js:84 [Worker] Item 179 - Original Date: 00972, Formatted Date: null
/js/worker.js:86 [Worker] Item 179 - Invalid formatted date: 00972
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 180: (9) ['009800', '3260', '(股)', 37706317, 10.17, 10.23, 10.17, 0.09, null]
/js/worker.js:84 [Worker] Item 180 - Original Date: 009800, Formatted Date: null
/js/worker.js:86 [Worker] Item 180 - Invalid formatted date: 009800
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 181: (9) ['009801', '3260', '(股)', 22781015, 10.57, 10.61, 10.57, 0.03, null]
/js/worker.js:84 [Worker] Item 181 - Original Date: 009801, Formatted Date: null
/js/worker.js:86 [Worker] Item 181 - Invalid formatted date: 009801
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 182: (9) ['009802', '3260', '(股)', 57235075, 10.63, 10.78, 10.58, 0.18, null]
/js/worker.js:84 [Worker] Item 182 - Original Date: 009802, Formatted Date: null
/js/worker.js:86 [Worker] Item 182 - Invalid formatted date: 009802
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 183: (9) ['009803', '3260', '(股)', 16992198, 11.73, 11.8, 11.66, 0.1, null]
/js/worker.js:84 [Worker] Item 183 - Original Date: 009803, Formatted Date: null
/js/worker.js:86 [Worker] Item 183 - Invalid formatted date: 009803
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 184: (9) ['009804', '3260', '(股)', 21824958, 13.11, 13.18, 13.02, 0.13, null]
/js/worker.js:84 [Worker] Item 184 - Original Date: 009804, Formatted Date: null
/js/worker.js:86 [Worker] Item 184 - Invalid formatted date: 009804
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 185: (9) ['009805', '3260', '(股)', 44236977, 11.51, 11.52, 11.48, 0.02, null]
/js/worker.js:84 [Worker] Item 185 - Original Date: 009805, Formatted Date: null
/js/worker.js:86 [Worker] Item 185 - Invalid formatted date: 009805
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 186: (9) ['009808', '3260', '(股)', 19562229, 18.08, 18.21, 17.99, 0.21, null]
/js/worker.js:84 [Worker] Item 186 - Original Date: 009808, Formatted Date: null
/js/worker.js:86 [Worker] Item 186 - Invalid formatted date: 009808
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 187: (9) ['00980A', '3260', '(股)', 131359206, 13.42, 13.6, 13.41, 0.2, null]
/js/worker.js:84 [Worker] Item 187 - Original Date: 00980A, Formatted Date: null
/js/worker.js:86 [Worker] Item 187 - Invalid formatted date: 00980A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 188: (9) ['009810', '3260', '(股)', 1897373, 16.58, 16.62, 16.57, 0.04, null]
/js/worker.js:84 [Worker] Item 188 - Original Date: 009810, Formatted Date: null
/js/worker.js:86 [Worker] Item 188 - Invalid formatted date: 009810
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 189: (9) ['009811', '3260', '(股)', 69713356, 10.83, 10.9, 10.83, 0.08, null]
/js/worker.js:84 [Worker] Item 189 - Original Date: 009811, Formatted Date: null
/js/worker.js:86 [Worker] Item 189 - Invalid formatted date: 009811
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 190: (9) ['009812', '3260', '(股)', 280952259, 10, 10.02, 9.97, 0.04, null]
/js/worker.js:84 [Worker] Item 190 - Original Date: 009812, Formatted Date: null
/js/worker.js:86 [Worker] Item 190 - Invalid formatted date: 009812
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 191: (9) ['00981A', '3260', '(股)', 876713249, 13.65, 13.88, 13.61, 0.29, null]
/js/worker.js:84 [Worker] Item 191 - Original Date: 00981A, Formatted Date: null
/js/worker.js:86 [Worker] Item 191 - Invalid formatted date: 00981A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 192: (9) ['00982A', '3260', '(股)', 457287475, 12.75, 12.93, 12.71, 0.22, null]
/js/worker.js:84 [Worker] Item 192 - Original Date: 00982A, Formatted Date: null
/js/worker.js:86 [Worker] Item 192 - Invalid formatted date: 00982A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 193: (9) ['00983A', '3260', '(股)', 79872648, 12, 12.06, 11.99, 0.11, null]
/js/worker.js:84 [Worker] Item 193 - Original Date: 00983A, Formatted Date: null
/js/worker.js:86 [Worker] Item 193 - Invalid formatted date: 00983A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 194: (9) ['00984A', '3260', '(股)', 41747000, 10.38, 10.44, 10.38, 0.06, null]
/js/worker.js:84 [Worker] Item 194 - Original Date: 00984A, Formatted Date: null
/js/worker.js:86 [Worker] Item 194 - Invalid formatted date: 00984A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 195: (9) ['00985A', '3260', '(股)', 96239234, 11.33, 11.39, 11.28, 0.11, null]
/js/worker.js:84 [Worker] Item 195 - Original Date: 00985A, Formatted Date: null
/js/worker.js:86 [Worker] Item 195 - Invalid formatted date: 00985A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 196: (9) ['00985B', '3260', '(股)', 141264984, 9.84, 9.85, 9.83, 0.02, null]
/js/worker.js:84 [Worker] Item 196 - Original Date: 00985B, Formatted Date: null
/js/worker.js:86 [Worker] Item 196 - Invalid formatted date: 00985B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 197: (9) ['00986A', '3260', '(股)', 28340062, 10.5, 10.52, 10.47, 0.02, null]
/js/worker.js:84 [Worker] Item 197 - Original Date: 00986A, Formatted Date: null
/js/worker.js:86 [Worker] Item 197 - Invalid formatted date: 00986A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 198: (9) ['01001T', '3260', '(股)', 12400, 12.4, 12.4, 12.4, 0.02, null]
/js/worker.js:84 [Worker] Item 198 - Original Date: 01001T, Formatted Date: null
/js/worker.js:86 [Worker] Item 198 - Invalid formatted date: 01001T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 199: (9) ['01002T', '3260', '(股)', 336480, 14.6, 14.65, 14.6, 0.07, null]
/js/worker.js:84 [Worker] Item 199 - Original Date: 01002T, Formatted Date: null
/js/worker.js:86 [Worker] Item 199 - Invalid formatted date: 01002T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 200: (9) ['01004T', '3260', '(股)', 1801850, 11.38, 11.41, 11.38, -0.01, null]
/js/worker.js:84 [Worker] Item 200 - Original Date: 01004T, Formatted Date: null
/js/worker.js:86 [Worker] Item 200 - Invalid formatted date: 01004T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 201: (9) ['01007T', '3260', '(股)', 113810, 14.2, 14.23, 14.2, 0.03, null]
/js/worker.js:84 [Worker] Item 201 - Original Date: 01007T, Formatted Date: null
/js/worker.js:86 [Worker] Item 201 - Invalid formatted date: 01007T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 202: (9) ['01009T', '3260', '(股)', 143873, 7.12, 7.12, 7.12, -0.13, null]
/js/worker.js:84 [Worker] Item 202 - Original Date: 01009T, Formatted Date: null
/js/worker.js:86 [Worker] Item 202 - Invalid formatted date: 01009T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 203: (9) ['01010T', '3260', '(股)', 130260, 10.02, 10.02, 10.02, 0, null]
/js/worker.js:84 [Worker] Item 203 - Original Date: 01010T, Formatted Date: null
/js/worker.js:86 [Worker] Item 203 - Invalid formatted date: 01010T
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 204: (9) ['020000', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 204 - Original Date: 020000, Formatted Date: null
/js/worker.js:86 [Worker] Item 204 - Invalid formatted date: 020000
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 205: (9) ['020011', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 205 - Original Date: 020011, Formatted Date: null
/js/worker.js:86 [Worker] Item 205 - Invalid formatted date: 020011
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 206: (9) ['020012', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 206 - Original Date: 020012, Formatted Date: null
/js/worker.js:86 [Worker] Item 206 - Invalid formatted date: 020012
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 207: (9) ['02001L', '3260', '(股)', 1833710, 37.1, 38.3, 36.75, 1.8, null]
/js/worker.js:84 [Worker] Item 207 - Original Date: 02001L, Formatted Date: null
/js/worker.js:86 [Worker] Item 207 - Invalid formatted date: 02001L
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 208: (9) ['02001R', '3260', '(股)', 10300, 1.03, 1.03, 1.03, -0.02, null]
/js/worker.js:84 [Worker] Item 208 - Original Date: 02001R, Formatted Date: null
/js/worker.js:86 [Worker] Item 208 - Invalid formatted date: 02001R
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 209: (9) ['02001S', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 209 - Original Date: 02001S, Formatted Date: null
/js/worker.js:86 [Worker] Item 209 - Invalid formatted date: 02001S
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 210: (9) ['020020', '3260', '(股)', 114920, 14.28, 14.4, 14.27, 0.18, null]
/js/worker.js:84 [Worker] Item 210 - Original Date: 020020, Formatted Date: null
/js/worker.js:86 [Worker] Item 210 - Invalid formatted date: 020020
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 211: (9) ['020028', '3260', '(股)', 3770540, 11.64, 11.94, 11.64, 0.27, null]
/js/worker.js:84 [Worker] Item 211 - Original Date: 020028, Formatted Date: null
/js/worker.js:86 [Worker] Item 211 - Invalid formatted date: 020028
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 212: (9) ['020029', '3260', '(股)', 222830, 9.65, 9.7, 9.65, 0.03, null]
/js/worker.js:84 [Worker] Item 212 - Original Date: 020029, Formatted Date: null
/js/worker.js:86 [Worker] Item 212 - Invalid formatted date: 020029
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 213: (9) ['020030', '3260', '(股)', 86670, 7.81, 7.91, 7.81, 0.16, null]
/js/worker.js:84 [Worker] Item 213 - Original Date: 020030, Formatted Date: null
/js/worker.js:86 [Worker] Item 213 - Invalid formatted date: 020030
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 214: (9) ['020031', '3260', '(股)', 141340, 6.41, 6.44, 6.41, null, null]
/js/worker.js:84 [Worker] Item 214 - Original Date: 020031, Formatted Date: null
/js/worker.js:86 [Worker] Item 214 - Invalid formatted date: 020031
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 215: (9) ['020032', '3260', '(股)', 64700, 7.11, 7.27, 7.11, 0.16, null]
/js/worker.js:84 [Worker] Item 215 - Original Date: 020032, Formatted Date: null
/js/worker.js:86 [Worker] Item 215 - Invalid formatted date: 020032
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 216: (9) ['020034', '3260', '(股)', 620370, 7.67, 7.8, 7.67, 0.16, null]
/js/worker.js:84 [Worker] Item 216 - Original Date: 020034, Formatted Date: null
/js/worker.js:86 [Worker] Item 216 - Invalid formatted date: 020034
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 217: (9) ['020036', '3260', '(股)', 21630, 7.21, 7.21, 7.21, null, null]
/js/worker.js:84 [Worker] Item 217 - Original Date: 020036, Formatted Date: null
/js/worker.js:86 [Worker] Item 217 - Invalid formatted date: 020036
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 218: (9) ['020037', '3260', '(股)', 92020, 7.66, 7.69, 7.66, 0, null]
/js/worker.js:84 [Worker] Item 218 - Original Date: 020037, Formatted Date: null
/js/worker.js:86 [Worker] Item 218 - Invalid formatted date: 020037
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 219: (9) ['020038', '3260', '(股)', 216120, 7.98, 8.02, 7.98, null, null]
/js/worker.js:84 [Worker] Item 219 - Original Date: 020038, Formatted Date: null
/js/worker.js:86 [Worker] Item 219 - Invalid formatted date: 020038
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 220: (9) ['020039', '3260', '(股)', 121170, 7.99, 8.1, 7.99, 0.09, null]
/js/worker.js:84 [Worker] Item 220 - Original Date: 020039, Formatted Date: null
/js/worker.js:86 [Worker] Item 220 - Invalid formatted date: 020039
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 221: (9) ['1101', '3260', '(股)', 480555909, 22.3, 22.4, 22.2, 0, null]
/js/worker.js:84 [Worker] Item 221 - Original Date: 1101, Formatted Date: null
/js/worker.js:86 [Worker] Item 221 - Invalid formatted date: 1101
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 222: (9) ['1101B', '3260', '(股)', 17997, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 222 - Original Date: 1101B, Formatted Date: null
/js/worker.js:86 [Worker] Item 222 - Invalid formatted date: 1101B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 223: (9) ['1102', '3260', '(股)', 280980938, 36.55, 36.55, 35.95, -0.25, null]
/js/worker.js:84 [Worker] Item 223 - Original Date: 1102, Formatted Date: null
/js/worker.js:86 [Worker] Item 223 - Invalid formatted date: 1102
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 224: (9) ['1103', '3260', '(股)', 2678669, 13.35, 13.4, 13.3, 0, null]
/js/worker.js:84 [Worker] Item 224 - Original Date: 1103, Formatted Date: null
/js/worker.js:86 [Worker] Item 224 - Invalid formatted date: 1103
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 225: (9) ['1104', '3260', '(股)', 33375593, 30.1, 30.1, 29.8, 0.05, null]
/js/worker.js:84 [Worker] Item 225 - Original Date: 1104, Formatted Date: null
/js/worker.js:86 [Worker] Item 225 - Invalid formatted date: 1104
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 226: (9) ['1108', '3260', '(股)', 1253915, 15.05, 15.15, 15.05, 0, null]
/js/worker.js:84 [Worker] Item 226 - Original Date: 1108, Formatted Date: null
/js/worker.js:86 [Worker] Item 226 - Invalid formatted date: 1108
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 227: (9) ['1109', '3260', '(股)', 1764909, 15.8, 15.8, 15.65, 0, null]
/js/worker.js:84 [Worker] Item 227 - Original Date: 1109, Formatted Date: null
/js/worker.js:86 [Worker] Item 227 - Invalid formatted date: 1109
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 228: (9) ['1110', '3260', '(股)', 5374296, 17.15, 17.4, 16.9, -0.15, null]
/js/worker.js:84 [Worker] Item 228 - Original Date: 1110, Formatted Date: null
/js/worker.js:86 [Worker] Item 228 - Invalid formatted date: 1110
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 229: (9) ['1201', '3260', '(股)', 5184173, 15.65, 15.65, 15.45, -0.05, null]
/js/worker.js:84 [Worker] Item 229 - Original Date: 1201, Formatted Date: null
/js/worker.js:86 [Worker] Item 229 - Invalid formatted date: 1201
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 230: (9) ['1203', '3260', '(股)', 721322, 39.45, 39.95, 39.3, -0.05, null]
/js/worker.js:84 [Worker] Item 230 - Original Date: 1203, Formatted Date: null
/js/worker.js:86 [Worker] Item 230 - Invalid formatted date: 1203
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 231: (9) ['1210', '3260', '(股)', 97362063, 52.9, 53, 52.4, -0.3, null]
/js/worker.js:84 [Worker] Item 231 - Original Date: 1210, Formatted Date: null
/js/worker.js:86 [Worker] Item 231 - Invalid formatted date: 1210
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 232: (9) ['1213', '3260', '(股)', 678256, 12.3, 12.3, 11.15, 0, null]
/js/worker.js:84 [Worker] Item 232 - Original Date: 1213, Formatted Date: null
/js/worker.js:86 [Worker] Item 232 - Invalid formatted date: 1213
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 233: (9) ['1215', '3260', '(股)', 96135555, 130, 131, 128, 0.5, null]
/js/worker.js:84 [Worker] Item 233 - Original Date: 1215, Formatted Date: null
/js/worker.js:86 [Worker] Item 233 - Invalid formatted date: 1215
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 234: (9) ['1216', '3260', '(股)', 432699320, 79.3, 79.4, 78.5, 0.2, null]
/js/worker.js:84 [Worker] Item 234 - Original Date: 1216, Formatted Date: null
/js/worker.js:86 [Worker] Item 234 - Invalid formatted date: 1216
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 235: (9) ['1217', '3260', '(股)', 3301830, 10.8, 10.8, 10.7, 0.05, null]
/js/worker.js:84 [Worker] Item 235 - Original Date: 1217, Formatted Date: null
/js/worker.js:86 [Worker] Item 235 - Invalid formatted date: 1217
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 236: (9) ['1218', '3260', '(股)', 7223776, 19, 19, 18.85, 0.15, null]
/js/worker.js:84 [Worker] Item 236 - Original Date: 1218, Formatted Date: null
/js/worker.js:86 [Worker] Item 236 - Invalid formatted date: 1218
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 237: (9) ['1219', '3260', '(股)', 2437025, 13.5, 13.5, 13.35, -0.05, null]
/js/worker.js:84 [Worker] Item 237 - Original Date: 1219, Formatted Date: null
/js/worker.js:86 [Worker] Item 237 - Invalid formatted date: 1219
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 238: (9) ['1220', '3260', '(股)', 1243315, 12.9, 12.95, 12.85, 0, null]
/js/worker.js:84 [Worker] Item 238 - Original Date: 1220, Formatted Date: null
/js/worker.js:86 [Worker] Item 238 - Invalid formatted date: 1220
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 239: (9) ['1225', '3260', '(股)', 3453831, 32.05, 32.35, 31.9, 0, null]
/js/worker.js:84 [Worker] Item 239 - Original Date: 1225, Formatted Date: null
/js/worker.js:86 [Worker] Item 239 - Invalid formatted date: 1225
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 240: (9) ['1227', '3260', '(股)', 12320908, 30.3, 30.3, 30.1, -0.05, null]
/js/worker.js:84 [Worker] Item 240 - Original Date: 1227, Formatted Date: null
/js/worker.js:86 [Worker] Item 240 - Invalid formatted date: 1227
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 241: (9) ['1229', '3260', '(股)', 91049697, 48, 49, 47.95, 1.15, null]
/js/worker.js:84 [Worker] Item 241 - Original Date: 1229, Formatted Date: null
/js/worker.js:86 [Worker] Item 241 - Invalid formatted date: 1229
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 242: (9) ['1231', '3260', '(股)', 27383971, 134, 134, 132, -1, null]
/js/worker.js:84 [Worker] Item 242 - Original Date: 1231, Formatted Date: null
/js/worker.js:86 [Worker] Item 242 - Invalid formatted date: 1231
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 243: (9) ['1232', '3260', '(股)', 4688916, 149, 149, 148, 0, null]
/js/worker.js:84 [Worker] Item 243 - Original Date: 1232, Formatted Date: null
/js/worker.js:86 [Worker] Item 243 - Invalid formatted date: 1232
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 244: (9) ['1233', '3260', '(股)', 126733, 30.8, 30.85, 30.8, 0.05, null]
/js/worker.js:84 [Worker] Item 244 - Original Date: 1233, Formatted Date: null
/js/worker.js:86 [Worker] Item 244 - Invalid formatted date: 1233
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 245: (9) ['1234', '3260', '(股)', 4342700, 38.5, 38.55, 38.45, 0, null]
/js/worker.js:84 [Worker] Item 245 - Original Date: 1234, Formatted Date: null
/js/worker.js:86 [Worker] Item 245 - Invalid formatted date: 1234
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 246: (9) ['1235', '3260', '(股)', 1181829, 60.5, 60.6, 60.2, 0.4, null]
/js/worker.js:84 [Worker] Item 246 - Original Date: 1235, Formatted Date: null
/js/worker.js:86 [Worker] Item 246 - Invalid formatted date: 1235
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 247: (9) ['1236', '3260', '(股)', 2795681, 23.35, 23.6, 23.25, 0.05, null]
/js/worker.js:84 [Worker] Item 247 - Original Date: 1236, Formatted Date: null
/js/worker.js:86 [Worker] Item 247 - Invalid formatted date: 1236
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 248: (9) ['1256', '3260', '(股)', 13952824, 183.5, 183.5, 167.5, -4, null]
/js/worker.js:84 [Worker] Item 248 - Original Date: 1256, Formatted Date: null
/js/worker.js:86 [Worker] Item 248 - Invalid formatted date: 1256
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 249: (9) ['1301', '3260', '(股)', 279961911, 37.45, 37.65, 37.35, -0.05, null]
/js/worker.js:84 [Worker] Item 249 - Original Date: 1301, Formatted Date: null
/js/worker.js:86 [Worker] Item 249 - Invalid formatted date: 1301
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 250: (9) ['1303', '3260', '(股)', 1281393490, 37.9, 37.95, 36.85, -0.8, null]
/js/worker.js:84 [Worker] Item 250 - Original Date: 1303, Formatted Date: null
/js/worker.js:86 [Worker] Item 250 - Invalid formatted date: 1303
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 251: (9) ['1304', '3260', '(股)', 9820451, 10.35, 10.35, 10.2, 0, null]
/js/worker.js:84 [Worker] Item 251 - Original Date: 1304, Formatted Date: null
/js/worker.js:86 [Worker] Item 251 - Invalid formatted date: 1304
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 252: (9) ['1305', '3260', '(股)', 5477071, 11.4, 11.5, 11.35, 0.15, null]
/js/worker.js:84 [Worker] Item 252 - Original Date: 1305, Formatted Date: null
/js/worker.js:86 [Worker] Item 252 - Invalid formatted date: 1305
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 253: (9) ['1307', '3260', '(股)', 13229318, 29.95, 30.05, 29.75, 0, null]
/js/worker.js:84 [Worker] Item 253 - Original Date: 1307, Formatted Date: null
/js/worker.js:86 [Worker] Item 253 - Invalid formatted date: 1307
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 254: (9) ['1308', '3260', '(股)', 8315623, 11.7, 11.8, 11.6, 0.1, null]
/js/worker.js:84 [Worker] Item 254 - Original Date: 1308, Formatted Date: null
/js/worker.js:86 [Worker] Item 254 - Invalid formatted date: 1308
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 255: (9) ['1309', '3260', '(股)', 6459313, 10.9, 10.95, 10.8, 0.05, null]
/js/worker.js:84 [Worker] Item 255 - Original Date: 1309, Formatted Date: null
/js/worker.js:86 [Worker] Item 255 - Invalid formatted date: 1309
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 256: (9) ['1310', '3260', '(股)', 5315634, 8.67, 8.75, 8.66, 0.07, null]
/js/worker.js:84 [Worker] Item 256 - Original Date: 1310, Formatted Date: null
/js/worker.js:86 [Worker] Item 256 - Invalid formatted date: 1310
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 257: (9) ['1312', '3260', '(股)', 21311511, 9.39, 9.47, 9.35, 0.03, null]
/js/worker.js:84 [Worker] Item 257 - Original Date: 1312, Formatted Date: null
/js/worker.js:86 [Worker] Item 257 - Invalid formatted date: 1312
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 258: (9) ['1312A', '3260', '(股)', 86100, 21.3, 21.7, 21.3, null, null]
/js/worker.js:84 [Worker] Item 258 - Original Date: 1312A, Formatted Date: null
/js/worker.js:86 [Worker] Item 258 - Invalid formatted date: 1312A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 259: (9) ['1313', '3260', '(股)', 24227931, 9.67, 10.1, 9.67, 0.34, null]
/js/worker.js:84 [Worker] Item 259 - Original Date: 1313, Formatted Date: null
/js/worker.js:86 [Worker] Item 259 - Invalid formatted date: 1313
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 260: (9) ['1314', '3260', '(股)', 63971078, 7.3, 7.31, 7.2, -0.05, null]
/js/worker.js:84 [Worker] Item 260 - Original Date: 1314, Formatted Date: null
/js/worker.js:86 [Worker] Item 260 - Invalid formatted date: 1314
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 261: (9) ['1315', '3260', '(股)', 385901, 64.3, 64.5, 64.1, -0.1, null]
/js/worker.js:84 [Worker] Item 261 - Original Date: 1315, Formatted Date: null
/js/worker.js:86 [Worker] Item 261 - Invalid formatted date: 1315
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 262: (9) ['1316', '3260', '(股)', 56974271, 14.6, 14.65, 14.35, 0.05, null]
/js/worker.js:84 [Worker] Item 262 - Original Date: 1316, Formatted Date: null
/js/worker.js:86 [Worker] Item 262 - Invalid formatted date: 1316
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 263: (9) ['1319', '3260', '(股)', 243489456, 95.2, 97.3, 95.2, 2.7, null]
/js/worker.js:84 [Worker] Item 263 - Original Date: 1319, Formatted Date: null
/js/worker.js:86 [Worker] Item 263 - Invalid formatted date: 1319
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 264: (9) ['1321', '3260', '(股)', 3649984, 36.4, 36.4, 36.2, 0.1, null]
/js/worker.js:84 [Worker] Item 264 - Original Date: 1321, Formatted Date: null
/js/worker.js:86 [Worker] Item 264 - Invalid formatted date: 1321
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 265: (9) ['1323', '3260', '(股)', 144986, 19.8, 19.8, 19.75, 0.05, null]
/js/worker.js:84 [Worker] Item 265 - Original Date: 1323, Formatted Date: null
/js/worker.js:86 [Worker] Item 265 - Invalid formatted date: 1323
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 266: (9) ['1324', '3260', '(股)', 193591, 10.65, 10.8, 10.65, 0, null]
/js/worker.js:84 [Worker] Item 266 - Original Date: 1324, Formatted Date: null
/js/worker.js:86 [Worker] Item 266 - Invalid formatted date: 1324
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 267: (9) ['1325', '3260', '(股)', 29318513, 29.35, 30, 29.3, 0.35, null]
/js/worker.js:84 [Worker] Item 267 - Original Date: 1325, Formatted Date: null
/js/worker.js:86 [Worker] Item 267 - Invalid formatted date: 1325
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 268: (9) ['1326', '3260', '(股)', 126202957, 29, 29, 28.55, -0.2, null]
/js/worker.js:84 [Worker] Item 268 - Original Date: 1326, Formatted Date: null
/js/worker.js:86 [Worker] Item 268 - Invalid formatted date: 1326
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 269: (9) ['1337', '3260', '(股)', 2974011, 5.04, 5.1, 5.04, 0.01, null]
/js/worker.js:84 [Worker] Item 269 - Original Date: 1337, Formatted Date: null
/js/worker.js:86 [Worker] Item 269 - Invalid formatted date: 1337
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 270: (9) ['1338', '3260', '(股)', 3877399, 22.15, 22.3, 22.1, 0.15, null]
/js/worker.js:84 [Worker] Item 270 - Original Date: 1338, Formatted Date: null
/js/worker.js:86 [Worker] Item 270 - Invalid formatted date: 1338
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 271: (9) ['1339', '3260', '(股)', 3665346, 43.4, 44.25, 42.9, -0.45, null]
/js/worker.js:84 [Worker] Item 271 - Original Date: 1339, Formatted Date: null
/js/worker.js:86 [Worker] Item 271 - Invalid formatted date: 1339
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 272: (9) ['1340', '3260', '(股)', 8219475, 5.97, 6.46, 5.93, 0.58, null]
/js/worker.js:84 [Worker] Item 272 - Original Date: 1340, Formatted Date: null
/js/worker.js:86 [Worker] Item 272 - Invalid formatted date: 1340
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 273: (9) ['1341', '3260', '(股)', 830191, 58, 60.8, 57.6, 0.8, null]
/js/worker.js:84 [Worker] Item 273 - Original Date: 1341, Formatted Date: null
/js/worker.js:86 [Worker] Item 273 - Invalid formatted date: 1341
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 274: (9) ['1342', '3260', '(股)', 6508858, 86.5, 87.2, 86.2, 0.2, null]
/js/worker.js:84 [Worker] Item 274 - Original Date: 1342, Formatted Date: null
/js/worker.js:86 [Worker] Item 274 - Invalid formatted date: 1342
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 275: (9) ['1402', '3260', '(股)', 82404021, 27.95, 27.95, 27.8, -0.05, null]
/js/worker.js:84 [Worker] Item 275 - Original Date: 1402, Formatted Date: null
/js/worker.js:86 [Worker] Item 275 - Invalid formatted date: 1402
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 276: (9) ['1409', '3260', '(股)', 56456147, 14.5, 14.55, 14.35, 0, null]
/js/worker.js:84 [Worker] Item 276 - Original Date: 1409, Formatted Date: null
/js/worker.js:86 [Worker] Item 276 - Invalid formatted date: 1409
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 277: (9) ['1410', '3260', '(股)', 212427, 35.6, 35.65, 35.1, -0.3, null]
/js/worker.js:84 [Worker] Item 277 - Original Date: 1410, Formatted Date: null
/js/worker.js:86 [Worker] Item 277 - Invalid formatted date: 1410
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 278: (9) ['1413', '3260', '(股)', 276426, 10.75, 10.8, 10.65, -0.05, null]
/js/worker.js:84 [Worker] Item 278 - Original Date: 1413, Formatted Date: null
/js/worker.js:86 [Worker] Item 278 - Invalid formatted date: 1413
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 279: (9) ['1414', '3260', '(股)', 2938378, 18.4, 18.5, 18.2, 0.15, null]
/js/worker.js:84 [Worker] Item 279 - Original Date: 1414, Formatted Date: null
/js/worker.js:86 [Worker] Item 279 - Invalid formatted date: 1414
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 280: (9) ['1416', '3260', '(股)', 830360, 11.35, 11.35, 11.25, 0, null]
/js/worker.js:84 [Worker] Item 280 - Original Date: 1416, Formatted Date: null
/js/worker.js:86 [Worker] Item 280 - Invalid formatted date: 1416
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 281: (9) ['1417', '3260', '(股)', 681691, 8.29, 8.29, 8.22, 0.02, null]
/js/worker.js:84 [Worker] Item 281 - Original Date: 1417, Formatted Date: null
/js/worker.js:86 [Worker] Item 281 - Invalid formatted date: 1417
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 282: (9) ['1418', '3260', '(股)', 1102071, 21.6, 22.1, 21.2, 1.1, null]
/js/worker.js:84 [Worker] Item 282 - Original Date: 1418, Formatted Date: null
/js/worker.js:86 [Worker] Item 282 - Invalid formatted date: 1418
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 283: (9) ['1419', '3260', '(股)', 21847736, 55.4, 55.5, 53.8, -0.6, null]
/js/worker.js:84 [Worker] Item 283 - Original Date: 1419, Formatted Date: null
/js/worker.js:86 [Worker] Item 283 - Invalid formatted date: 1419
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 284: (9) ['1423', '3260', '(股)', 299530, 37.9, 37.9, 37.7, -0.2, null]
/js/worker.js:84 [Worker] Item 284 - Original Date: 1423, Formatted Date: null
/js/worker.js:86 [Worker] Item 284 - Invalid formatted date: 1423
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 285: (9) ['1432', '3260', '(股)', 1652442, 17.5, 17.6, 17.45, 0.15, null]
/js/worker.js:84 [Worker] Item 285 - Original Date: 1432, Formatted Date: null
/js/worker.js:86 [Worker] Item 285 - Invalid formatted date: 1432
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 286: (9) ['1434', '3260', '(股)', 20692599, 15.3, 15.4, 15.25, 0.2, null]
/js/worker.js:84 [Worker] Item 286 - Original Date: 1434, Formatted Date: null
/js/worker.js:86 [Worker] Item 286 - Invalid formatted date: 1434
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 287: (9) ['1435', '3260', '(股)', 21836, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 287 - Original Date: 1435, Formatted Date: null
/js/worker.js:86 [Worker] Item 287 - Invalid formatted date: 1435
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 288: (9) ['1436', '3260', '(股)', 15590036, 77.8, 77.8, 75.2, -1.1, null]
/js/worker.js:84 [Worker] Item 288 - Original Date: 1436, Formatted Date: null
/js/worker.js:86 [Worker] Item 288 - Invalid formatted date: 1436
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 289: (9) ['1437', '3260', '(股)', 7911120, 31.45, 32.3, 31.3, 0.25, null]
/js/worker.js:84 [Worker] Item 289 - Original Date: 1437, Formatted Date: null
/js/worker.js:86 [Worker] Item 289 - Invalid formatted date: 1437
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 290: (9) ['1438', '3260', '(股)', 2226461, 37.65, 37.75, 37.4, 0.05, null]
/js/worker.js:84 [Worker] Item 290 - Original Date: 1438, Formatted Date: null
/js/worker.js:86 [Worker] Item 290 - Invalid formatted date: 1438
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 291: (9) ['1439', '3260', '(股)', 262379, 29.2, 29.35, 29, 0.05, null]
/js/worker.js:84 [Worker] Item 291 - Original Date: 1439, Formatted Date: null
/js/worker.js:86 [Worker] Item 291 - Invalid formatted date: 1439
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 292: (9) ['1440', '3260', '(股)', 19303881, 14.35, 14.35, 14.15, 0.05, null]
/js/worker.js:84 [Worker] Item 292 - Original Date: 1440, Formatted Date: null
/js/worker.js:86 [Worker] Item 292 - Invalid formatted date: 1440
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 293: (9) ['1441', '3260', '(股)', 620929, 11.35, 11.4, 11.15, 0, null]
/js/worker.js:84 [Worker] Item 293 - Original Date: 1441, Formatted Date: null
/js/worker.js:86 [Worker] Item 293 - Invalid formatted date: 1441
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 294: (9) ['1442', '3260', '(股)', 53371232, 49.6, 49.65, 47.5, -1.3, null]
/js/worker.js:84 [Worker] Item 294 - Original Date: 1442, Formatted Date: null
/js/worker.js:86 [Worker] Item 294 - Invalid formatted date: 1442
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 295: (9) ['1443', '3260', '(股)', 424071, 28.75, 28.8, 28.65, -0.1, null]
/js/worker.js:84 [Worker] Item 295 - Original Date: 1443, Formatted Date: null
/js/worker.js:86 [Worker] Item 295 - Invalid formatted date: 1443
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 296: (9) ['1444', '3260', '(股)', 3557768, 6.57, 6.62, 6.52, 0.08, null]
/js/worker.js:84 [Worker] Item 296 - Original Date: 1444, Formatted Date: null
/js/worker.js:86 [Worker] Item 296 - Invalid formatted date: 1444
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 297: (9) ['1445', '3260', '(股)', 938758, 15.1, 15.1, 15, -0.05, null]
/js/worker.js:84 [Worker] Item 297 - Original Date: 1445, Formatted Date: null
/js/worker.js:86 [Worker] Item 297 - Invalid formatted date: 1445
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 298: (9) ['1446', '3260', '(股)', 2313485, 20.5, 20.65, 20.35, -0.05, null]
/js/worker.js:84 [Worker] Item 298 - Original Date: 1446, Formatted Date: null
/js/worker.js:86 [Worker] Item 298 - Invalid formatted date: 1446
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 299: (9) ['1447', '3260', '(股)', 1805994, 5.75, 5.75, 5.7, 0.01, null]
/js/worker.js:84 [Worker] Item 299 - Original Date: 1447, Formatted Date: null
/js/worker.js:86 [Worker] Item 299 - Invalid formatted date: 1447
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 300: (9) ['1449', '3260', '(股)', 8661610, 12, 12.05, 11.6, 0, null]
/js/worker.js:84 [Worker] Item 300 - Original Date: 1449, Formatted Date: null
/js/worker.js:86 [Worker] Item 300 - Invalid formatted date: 1449
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 301: (9) ['1451', '3260', '(股)', 2132005, 17.9, 17.9, 17.75, 0.1, null]
/js/worker.js:84 [Worker] Item 301 - Original Date: 1451, Formatted Date: null
/js/worker.js:86 [Worker] Item 301 - Invalid formatted date: 1451
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 302: (9) ['1452', '3260', '(股)', 522156, 13.5, 13.5, 13.3, 0.05, null]
/js/worker.js:84 [Worker] Item 302 - Original Date: 1452, Formatted Date: null
/js/worker.js:86 [Worker] Item 302 - Invalid formatted date: 1452
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 303: (9) ['1453', '3260', '(股)', 1227140, 14, 14.2, 13.8, 0.05, null]
/js/worker.js:84 [Worker] Item 303 - Original Date: 1453, Formatted Date: null
/js/worker.js:86 [Worker] Item 303 - Invalid formatted date: 1453
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 304: (9) ['1454', '3260', '(股)', 474406, 14.35, 14.4, 14.2, 0, null]
/js/worker.js:84 [Worker] Item 304 - Original Date: 1454, Formatted Date: null
/js/worker.js:86 [Worker] Item 304 - Invalid formatted date: 1454
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 305: (9) ['1455', '3260', '(股)', 4957439, 9.14, 9.2, 9.03, -0.06, null]
/js/worker.js:84 [Worker] Item 305 - Original Date: 1455, Formatted Date: null
/js/worker.js:86 [Worker] Item 305 - Invalid formatted date: 1455
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 306: (9) ['1456', '3260', '(股)', 362774, 12.45, 12.45, 12.15, -0.1, null]
/js/worker.js:84 [Worker] Item 306 - Original Date: 1456, Formatted Date: null
/js/worker.js:86 [Worker] Item 306 - Invalid formatted date: 1456
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 307: (9) ['1457', '3260', '(股)', 5020068, 16.55, 16.55, 16.25, -0.1, null]
/js/worker.js:84 [Worker] Item 307 - Original Date: 1457, Formatted Date: null
/js/worker.js:86 [Worker] Item 307 - Invalid formatted date: 1457
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 308: (9) ['1459', '3260', '(股)', 1561969, 11.55, 11.65, 11.55, 0.1, null]
/js/worker.js:84 [Worker] Item 308 - Original Date: 1459, Formatted Date: null
/js/worker.js:86 [Worker] Item 308 - Invalid formatted date: 1459
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 309: (9) ['1460', '3260', '(股)', 10523109, 5.96, 6, 5.81, 0.04, null]
/js/worker.js:84 [Worker] Item 309 - Original Date: 1460, Formatted Date: null
/js/worker.js:86 [Worker] Item 309 - Invalid formatted date: 1460
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 310: (9) ['1463', '3260', '(股)', 1925497, 19.65, 19.7, 19.6, -0.05, null]
/js/worker.js:84 [Worker] Item 310 - Original Date: 1463, Formatted Date: null
/js/worker.js:86 [Worker] Item 310 - Invalid formatted date: 1463
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 311: (9) ['1464', '3260', '(股)', 4714866, 10.95, 11, 10.9, 0.05, null]
/js/worker.js:84 [Worker] Item 311 - Original Date: 1464, Formatted Date: null
/js/worker.js:86 [Worker] Item 311 - Invalid formatted date: 1464
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 312: (9) ['1465', '3260', '(股)', 370071, 13.15, 13.2, 13.05, 0, null]
/js/worker.js:84 [Worker] Item 312 - Original Date: 1465, Formatted Date: null
/js/worker.js:86 [Worker] Item 312 - Invalid formatted date: 1465
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 313: (9) ['1466', '3260', '(股)', 7371417, 16.6, 16.7, 16.2, -0.3, null]
/js/worker.js:84 [Worker] Item 313 - Original Date: 1466, Formatted Date: null
/js/worker.js:86 [Worker] Item 313 - Invalid formatted date: 1466
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 314: (9) ['1467', '3260', '(股)', 501062, 7.56, 7.57, 7.49, 0, null]
/js/worker.js:84 [Worker] Item 314 - Original Date: 1467, Formatted Date: null
/js/worker.js:86 [Worker] Item 314 - Invalid formatted date: 1467
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 315: (9) ['1468', '3260', '(股)', 919893, 13.6, 13.8, 13.3, 0.05, null]
/js/worker.js:84 [Worker] Item 315 - Original Date: 1468, Formatted Date: null
/js/worker.js:86 [Worker] Item 315 - Invalid formatted date: 1468
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 316: (9) ['1470', '3260', '(股)', 264000, 22, 22, 22, 0.7, null]
/js/worker.js:84 [Worker] Item 316 - Original Date: 1470, Formatted Date: null
/js/worker.js:86 [Worker] Item 316 - Invalid formatted date: 1470
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 317: (9) ['1471', '3260', '(股)', 3459360, 9.64, 9.86, 9.64, 0.16, null]
/js/worker.js:84 [Worker] Item 317 - Original Date: 1471, Formatted Date: null
/js/worker.js:86 [Worker] Item 317 - Invalid formatted date: 1471
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 318: (9) ['1472', '3260', '(股)', 2571310, 91.1, 91.2, 90.9, -0.1, null]
/js/worker.js:84 [Worker] Item 318 - Original Date: 1472, Formatted Date: null
/js/worker.js:86 [Worker] Item 318 - Invalid formatted date: 1472
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 319: (9) ['1473', '3260', '(股)', 1530793, 25.7, 25.7, 25.3, 0, null]
/js/worker.js:84 [Worker] Item 319 - Original Date: 1473, Formatted Date: null
/js/worker.js:86 [Worker] Item 319 - Invalid formatted date: 1473
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 320: (9) ['1474', '3260', '(股)', 1076507, 11.75, 11.9, 11.7, 0.15, null]
/js/worker.js:84 [Worker] Item 320 - Original Date: 1474, Formatted Date: null
/js/worker.js:86 [Worker] Item 320 - Invalid formatted date: 1474
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 321: (9) ['1475', '3260', '(股)', 894692, 32.7, 33, 32.7, 0.1, null]
/js/worker.js:84 [Worker] Item 321 - Original Date: 1475, Formatted Date: null
/js/worker.js:86 [Worker] Item 321 - Invalid formatted date: 1475
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 322: (9) ['1476', '3260', '(股)', 1058944355, 443, 458, 441.5, 6, null]
/js/worker.js:84 [Worker] Item 322 - Original Date: 1476, Formatted Date: null
/js/worker.js:86 [Worker] Item 322 - Invalid formatted date: 1476
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 323: (9) ['1477', '3260', '(股)', 734005671, 298.5, 300.5, 294.5, 0.5, null]
/js/worker.js:84 [Worker] Item 323 - Original Date: 1477, Formatted Date: null
/js/worker.js:86 [Worker] Item 323 - Invalid formatted date: 1477
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 324: (9) ['1503', '3260', '(股)', 340573345, 184, 187.5, 183, 1, null]
/js/worker.js:84 [Worker] Item 324 - Original Date: 1503, Formatted Date: null
/js/worker.js:86 [Worker] Item 324 - Invalid formatted date: 1503
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 325: (9) ['1504', '3260', '(股)', 3789139858, 87.7, 87.8, 82.2, -3.8, null]
/js/worker.js:84 [Worker] Item 325 - Original Date: 1504, Formatted Date: null
/js/worker.js:86 [Worker] Item 325 - Invalid formatted date: 1504
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 326: (9) ['1506', '3260', '(股)', 2906541, 13, 13.35, 12.85, 0.35, null]
/js/worker.js:84 [Worker] Item 326 - Original Date: 1506, Formatted Date: null
/js/worker.js:86 [Worker] Item 326 - Invalid formatted date: 1506
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 327: (9) ['1512', '3260', '(股)', 1234140, 8.4, 8.45, 8.22, -0.09, null]
/js/worker.js:84 [Worker] Item 327 - Original Date: 1512, Formatted Date: null
/js/worker.js:86 [Worker] Item 327 - Invalid formatted date: 1512
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 328: (9) ['1513', '3260', '(股)', 394788254, 160, 161, 159.5, 0.5, null]
/js/worker.js:84 [Worker] Item 328 - Original Date: 1513, Formatted Date: null
/js/worker.js:86 [Worker] Item 328 - Invalid formatted date: 1513
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 329: (9) ['1514', '3260', '(股)', 117541131, 103, 103.5, 102, 0.5, null]
/js/worker.js:84 [Worker] Item 329 - Original Date: 1514, Formatted Date: null
/js/worker.js:86 [Worker] Item 329 - Invalid formatted date: 1514
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 330: (9) ['1515', '3260', '(股)', 20406693, 30.35, 30.55, 29.9, -0.1, null]
/js/worker.js:84 [Worker] Item 330 - Original Date: 1515, Formatted Date: null
/js/worker.js:86 [Worker] Item 330 - Invalid formatted date: 1515
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 331: (9) ['1516', '3260', '(股)', 476670, 14.6, 15.35, 14.6, -0.1, null]
/js/worker.js:84 [Worker] Item 331 - Original Date: 1516, Formatted Date: null
/js/worker.js:86 [Worker] Item 331 - Invalid formatted date: 1516
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 332: (9) ['1517', '3260', '(股)', 3504044, 10.45, 10.65, 10.35, 0.05, null]
/js/worker.js:84 [Worker] Item 332 - Original Date: 1517, Formatted Date: null
/js/worker.js:86 [Worker] Item 332 - Invalid formatted date: 1517
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 333: (9) ['1519', '3260', '(股)', 819142003, 590, 598, 585, 12, null]
/js/worker.js:84 [Worker] Item 333 - Original Date: 1519, Formatted Date: null
/js/worker.js:86 [Worker] Item 333 - Invalid formatted date: 1519
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 334: (9) ['1521', '3260', '(股)', 1464944, 25.45, 25.5, 25.05, -0.3, null]
/js/worker.js:84 [Worker] Item 334 - Original Date: 1521, Formatted Date: null
/js/worker.js:86 [Worker] Item 334 - Invalid formatted date: 1521
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 335: (9) ['1522', '3260', '(股)', 70589389, 42.3, 42.85, 41.95, 0.95, null]
/js/worker.js:84 [Worker] Item 335 - Original Date: 1522, Formatted Date: null
/js/worker.js:86 [Worker] Item 335 - Invalid formatted date: 1522
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 336: (9) ['1522A', '3260', '(股)', 146280, 48.5, 48.6, 48.5, 0.1, null]
/js/worker.js:84 [Worker] Item 336 - Original Date: 1522A, Formatted Date: null
/js/worker.js:86 [Worker] Item 336 - Invalid formatted date: 1522A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 337: (9) ['1524', '3260', '(股)', 18761597, 29, 29.15, 28.75, 0.15, null]
/js/worker.js:84 [Worker] Item 337 - Original Date: 1524, Formatted Date: null
/js/worker.js:86 [Worker] Item 337 - Invalid formatted date: 1524
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 338: (9) ['1525', '3260', '(股)', 1257636, 70.8, 70.9, 69.7, -0.5, null]
/js/worker.js:84 [Worker] Item 338 - Original Date: 1525, Formatted Date: null
/js/worker.js:86 [Worker] Item 338 - Invalid formatted date: 1525
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 339: (9) ['1526', '3260', '(股)', 1934245, 17.1, 17.45, 17.1, 0.35, null]
/js/worker.js:84 [Worker] Item 339 - Original Date: 1526, Formatted Date: null
/js/worker.js:86 [Worker] Item 339 - Invalid formatted date: 1526
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 340: (9) ['1527', '3260', '(股)', 16488587, 33.5, 33.9, 33, 0.6, null]
/js/worker.js:84 [Worker] Item 340 - Original Date: 1527, Formatted Date: null
/js/worker.js:86 [Worker] Item 340 - Invalid formatted date: 1527
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 341: (9) ['1528', '3260', '(股)', 24362560, 16.3, 16.45, 16.1, -0.05, null]
/js/worker.js:84 [Worker] Item 341 - Original Date: 1528, Formatted Date: null
/js/worker.js:86 [Worker] Item 341 - Invalid formatted date: 1528
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 342: (9) ['1529', '3260', '(股)', 6950161, 24, 24.05, 23.8, 0.25, null]
/js/worker.js:84 [Worker] Item 342 - Original Date: 1529, Formatted Date: null
/js/worker.js:86 [Worker] Item 342 - Invalid formatted date: 1529
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 343: (9) ['1530', '3260', '(股)', 597501, 27.8, 28.15, 27.8, 0.3, null]
/js/worker.js:84 [Worker] Item 343 - Original Date: 1530, Formatted Date: null
/js/worker.js:86 [Worker] Item 343 - Invalid formatted date: 1530
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 344: (9) ['1531', '3260', '(股)', 334902, 11.75, 11.75, 11.75, 0, null]
/js/worker.js:84 [Worker] Item 344 - Original Date: 1531, Formatted Date: null
/js/worker.js:86 [Worker] Item 344 - Invalid formatted date: 1531
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 345: (9) ['1532', '3260', '(股)', 29305311, 27.35, 27.5, 26.85, -0.15, null]
/js/worker.js:84 [Worker] Item 345 - Original Date: 1532, Formatted Date: null
/js/worker.js:86 [Worker] Item 345 - Invalid formatted date: 1532
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 346: (9) ['1533', '3260', '(股)', 2984015, 33, 33.3, 32.7, 0.25, null]
/js/worker.js:84 [Worker] Item 346 - Original Date: 1533, Formatted Date: null
/js/worker.js:86 [Worker] Item 346 - Invalid formatted date: 1533
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 347: (9) ['1535', '3260', '(股)', 1891929, 54.9, 55.3, 54.9, 0.1, null]
/js/worker.js:84 [Worker] Item 347 - Original Date: 1535, Formatted Date: null
/js/worker.js:86 [Worker] Item 347 - Invalid formatted date: 1535
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 348: (9) ['1536', '3260', '(股)', 199807458, 67.6, 67.8, 65.7, -1, null]
/js/worker.js:84 [Worker] Item 348 - Original Date: 1536, Formatted Date: null
/js/worker.js:86 [Worker] Item 348 - Invalid formatted date: 1536
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 349: (9) ['1537', '3260', '(股)', 22552484, 127, 127.5, 126, 0.5, null]
/js/worker.js:84 [Worker] Item 349 - Original Date: 1537, Formatted Date: null
/js/worker.js:86 [Worker] Item 349 - Invalid formatted date: 1537
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 350: (9) ['1538', '3260', '(股)', 173901, 26.7, 26.75, 26.7, 0, null]
/js/worker.js:84 [Worker] Item 350 - Original Date: 1538, Formatted Date: null
/js/worker.js:86 [Worker] Item 350 - Invalid formatted date: 1538
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 351: (9) ['1539', '3260', '(股)', 4135180, 18.2, 18.6, 18, 0.25, null]
/js/worker.js:84 [Worker] Item 351 - Original Date: 1539, Formatted Date: null
/js/worker.js:86 [Worker] Item 351 - Invalid formatted date: 1539
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 352: (9) ['1540', '3260', '(股)', 7831137, 25.35, 25.5, 25.05, 0.2, null]
/js/worker.js:84 [Worker] Item 352 - Original Date: 1540, Formatted Date: null
/js/worker.js:86 [Worker] Item 352 - Invalid formatted date: 1540
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 353: (9) ['1541', '3260', '(股)', 344448, 26.2, 26.2, 26, -0.2, null]
/js/worker.js:84 [Worker] Item 353 - Original Date: 1541, Formatted Date: null
/js/worker.js:86 [Worker] Item 353 - Invalid formatted date: 1541
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 354: (9) ['1558', '3260', '(股)', 3493188, 91.1, 92, 91.1, 0.8, null]
/js/worker.js:84 [Worker] Item 354 - Original Date: 1558, Formatted Date: null
/js/worker.js:86 [Worker] Item 354 - Invalid formatted date: 1558
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 355: (9) ['1560', '3260', '(股)', 357635754, 325, 329.5, 324.5, 2.5, null]
/js/worker.js:84 [Worker] Item 355 - Original Date: 1560, Formatted Date: null
/js/worker.js:86 [Worker] Item 355 - Invalid formatted date: 1560
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 356: (9) ['1563', '3260', '(股)', 15989843, 49.45, 50.1, 49.45, 0.2, null]
/js/worker.js:84 [Worker] Item 356 - Original Date: 1563, Formatted Date: null
/js/worker.js:86 [Worker] Item 356 - Invalid formatted date: 1563
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 357: (9) ['1568', '3260', '(股)', 1093942, 23.55, 23.75, 23.55, 0.1, null]
/js/worker.js:84 [Worker] Item 357 - Original Date: 1568, Formatted Date: null
/js/worker.js:86 [Worker] Item 357 - Invalid formatted date: 1568
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 358: (9) ['1582', '3260', '(股)', 23050249, 68.4, 69.4, 68.4, 0.3, null]
/js/worker.js:84 [Worker] Item 358 - Original Date: 1582, Formatted Date: null
/js/worker.js:86 [Worker] Item 358 - Invalid formatted date: 1582
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 359: (9) ['1583', '3260', '(股)', 996665, 51.1, 51.3, 50.9, 1.6, null]
/js/worker.js:84 [Worker] Item 359 - Original Date: 1583, Formatted Date: null
/js/worker.js:86 [Worker] Item 359 - Invalid formatted date: 1583
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 360: (9) ['1587', '3260', '(股)', 246727836, 43.35, 44, 42.2, 4, null]
/js/worker.js:84 [Worker] Item 360 - Original Date: 1587, Formatted Date: null
/js/worker.js:86 [Worker] Item 360 - Invalid formatted date: 1587
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 361: (9) ['1589', '3260', '(股)', 10451057, 19.7, 19.9, 19.5, 0.3, null]
/js/worker.js:84 [Worker] Item 361 - Original Date: 1589, Formatted Date: null
/js/worker.js:86 [Worker] Item 361 - Invalid formatted date: 1589
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 362: (9) ['1590', '3260', '(股)', 688059479, 761, 775, 757, 12, null]
/js/worker.js:84 [Worker] Item 362 - Original Date: 1590, Formatted Date: null
/js/worker.js:86 [Worker] Item 362 - Invalid formatted date: 1590
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 363: (9) ['1597', '3260', '(股)', 28171632, 81.2, 82.3, 80.5, -0.5, null]
/js/worker.js:84 [Worker] Item 363 - Original Date: 1597, Formatted Date: null
/js/worker.js:86 [Worker] Item 363 - Invalid formatted date: 1597
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 364: (9) ['1598', '3260', '(股)', 1135785, 21.2, 21.2, 20.95, -0.1, null]
/js/worker.js:84 [Worker] Item 364 - Original Date: 1598, Formatted Date: null
/js/worker.js:86 [Worker] Item 364 - Invalid formatted date: 1598
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 365: (9) ['1603', '3260', '(股)', 29536166, 39.65, 39.65, 38.95, -0.05, null]
/js/worker.js:84 [Worker] Item 365 - Original Date: 1603, Formatted Date: null
/js/worker.js:86 [Worker] Item 365 - Invalid formatted date: 1603
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 366: (9) ['1604', '3260', '(股)', 6237862, 24.8, 25, 24.8, 0.2, null]
/js/worker.js:84 [Worker] Item 366 - Original Date: 1604, Formatted Date: null
/js/worker.js:86 [Worker] Item 366 - Invalid formatted date: 1604
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 367: (9) ['1605', '3260', '(股)', 635728946, 22.6, 23.3, 22.6, 0.35, null]
/js/worker.js:84 [Worker] Item 367 - Original Date: 1605, Formatted Date: null
/js/worker.js:86 [Worker] Item 367 - Invalid formatted date: 1605
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 368: (9) ['1608', '3260', '(股)', 85646105, 29.75, 29.8, 29.15, -0.3, null]
/js/worker.js:84 [Worker] Item 368 - Original Date: 1608, Formatted Date: null
/js/worker.js:86 [Worker] Item 368 - Invalid formatted date: 1608
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 369: (9) ['1609', '3260', '(股)', 134207502, 40.7, 41.1, 40.3, 0.1, null]
/js/worker.js:84 [Worker] Item 369 - Original Date: 1609, Formatted Date: null
/js/worker.js:86 [Worker] Item 369 - Invalid formatted date: 1609
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 370: (9) ['1611', '3260', '(股)', 5065055, 12.9, 13.05, 12.9, 0.15, null]
/js/worker.js:84 [Worker] Item 370 - Original Date: 1611, Formatted Date: null
/js/worker.js:86 [Worker] Item 370 - Invalid formatted date: 1611
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 371: (9) ['1612', '3260', '(股)', 20184318, 35.6, 35.85, 35.6, 0.05, null]
/js/worker.js:84 [Worker] Item 371 - Original Date: 1612, Formatted Date: null
/js/worker.js:86 [Worker] Item 371 - Invalid formatted date: 1612
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 372: (9) ['1614', '3260', '(股)', 2260240, 37.4, 37.4, 37, 0.15, null]
/js/worker.js:84 [Worker] Item 372 - Original Date: 1614, Formatted Date: null
/js/worker.js:86 [Worker] Item 372 - Invalid formatted date: 1614
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 373: (9) ['1615', '3260', '(股)', 4182739, 49.9, 49.9, 49.65, -0.15, null]
/js/worker.js:84 [Worker] Item 373 - Original Date: 1615, Formatted Date: null
/js/worker.js:86 [Worker] Item 373 - Invalid formatted date: 1615
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 374: (9) ['1616', '3260', '(股)', 49384738, 34.35, 34.35, 33.7, -0.05, null]
/js/worker.js:84 [Worker] Item 374 - Original Date: 1616, Formatted Date: null
/js/worker.js:86 [Worker] Item 374 - Invalid formatted date: 1616
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 375: (9) ['1617', '3260', '(股)', 933631, 14.7, 14.8, 14.7, -0.05, null]
/js/worker.js:84 [Worker] Item 375 - Original Date: 1617, Formatted Date: null
/js/worker.js:86 [Worker] Item 375 - Invalid formatted date: 1617
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 376: (9) ['1618', '3260', '(股)', 36639428, 46.9, 47.3, 46.5, 0.05, null]
/js/worker.js:84 [Worker] Item 376 - Original Date: 1618, Formatted Date: null
/js/worker.js:86 [Worker] Item 376 - Invalid formatted date: 1618
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 377: (9) ['1626', '3260', '(股)', 1170699, 11.95, 12.05, 11.95, 0, null]
/js/worker.js:84 [Worker] Item 377 - Original Date: 1626, Formatted Date: null
/js/worker.js:86 [Worker] Item 377 - Invalid formatted date: 1626
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 378: (9) ['1702', '3260', '(股)', 13113310, 39.5, 39.9, 39.5, 0.3, null]
/js/worker.js:84 [Worker] Item 378 - Original Date: 1702, Formatted Date: null
/js/worker.js:86 [Worker] Item 378 - Invalid formatted date: 1702
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 379: (9) ['1707', '3260', '(股)', 6540335, 131, 131, 129.5, -0.5, null]
/js/worker.js:84 [Worker] Item 379 - Original Date: 1707, Formatted Date: null
/js/worker.js:86 [Worker] Item 379 - Invalid formatted date: 1707
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 380: (9) ['1708', '3260', '(股)', 18184825, 30.65, 30.85, 30.6, 0.05, null]
/js/worker.js:84 [Worker] Item 380 - Original Date: 1708, Formatted Date: null
/js/worker.js:86 [Worker] Item 380 - Invalid formatted date: 1708
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 381: (9) ['1709', '3260', '(股)', 8544435, 16.25, 16.4, 16.2, 0.05, null]
/js/worker.js:84 [Worker] Item 381 - Original Date: 1709, Formatted Date: null
/js/worker.js:86 [Worker] Item 381 - Invalid formatted date: 1709
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 382: (9) ['1710', '3260', '(股)', 7733044, 12.2, 12.2, 12, 0.05, null]
/js/worker.js:84 [Worker] Item 382 - Original Date: 1710, Formatted Date: null
/js/worker.js:86 [Worker] Item 382 - Invalid formatted date: 1710
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 383: (9) ['1711', '3260', '(股)', 98397144, 19.3, 19.75, 19.15, 0.05, null]
/js/worker.js:84 [Worker] Item 383 - Original Date: 1711, Formatted Date: null
/js/worker.js:86 [Worker] Item 383 - Invalid formatted date: 1711
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 384: (9) ['1712', '3260', '(股)', 8799984, 43, 43, 42.7, 0.05, null]
/js/worker.js:84 [Worker] Item 384 - Original Date: 1712, Formatted Date: null
/js/worker.js:86 [Worker] Item 384 - Invalid formatted date: 1712
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 385: (9) ['1713', '3260', '(股)', 4897544, 49.3, 49.75, 49.2, -0.1, null]
/js/worker.js:84 [Worker] Item 385 - Original Date: 1713, Formatted Date: null
/js/worker.js:86 [Worker] Item 385 - Invalid formatted date: 1713
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 386: (9) ['1714', '3260', '(股)', 3996474, 7.8, 7.81, 7.77, 0.01, null]
/js/worker.js:84 [Worker] Item 386 - Original Date: 1714, Formatted Date: null
/js/worker.js:86 [Worker] Item 386 - Invalid formatted date: 1714
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 387: (9) ['1717', '3260', '(股)', 597338223, 42.6, 43.2, 41.05, -1.05, null]
/js/worker.js:84 [Worker] Item 387 - Original Date: 1717, Formatted Date: null
/js/worker.js:86 [Worker] Item 387 - Invalid formatted date: 1717
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 388: (9) ['1718', '3260', '(股)', 9756017, 6.45, 6.48, 6.41, 0.02, null]
/js/worker.js:84 [Worker] Item 388 - Original Date: 1718, Formatted Date: null
/js/worker.js:86 [Worker] Item 388 - Invalid formatted date: 1718
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 389: (9) ['1720', '3260', '(股)', 6557105, 55.8, 55.8, 55.4, -0.1, null]
/js/worker.js:84 [Worker] Item 389 - Original Date: 1720, Formatted Date: null
/js/worker.js:86 [Worker] Item 389 - Invalid formatted date: 1720
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 390: (9) ['1721', '3260', '(股)', 7522678, 12.65, 12.95, 12.5, 0.15, null]
/js/worker.js:84 [Worker] Item 390 - Original Date: 1721, Formatted Date: null
/js/worker.js:86 [Worker] Item 390 - Invalid formatted date: 1721
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 391: (9) ['1722', '3260', '(股)', 82048971, 50.2, 50.3, 49.8, -0.15, null]
/js/worker.js:84 [Worker] Item 391 - Original Date: 1722, Formatted Date: null
/js/worker.js:86 [Worker] Item 391 - Invalid formatted date: 1722
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 392: (9) ['1723', '3260', '(股)', 16001516, 82.2, 82.4, 81.8, 0.1, null]
/js/worker.js:84 [Worker] Item 392 - Original Date: 1723, Formatted Date: null
/js/worker.js:86 [Worker] Item 392 - Invalid formatted date: 1723
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 393: (9) ['1725', '3260', '(股)', 1097808, 28.2, 28.3, 28.05, -0.1, null]
/js/worker.js:84 [Worker] Item 393 - Original Date: 1725, Formatted Date: null
/js/worker.js:86 [Worker] Item 393 - Invalid formatted date: 1725
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 394: (9) ['1726', '3260', '(股)', 1298786, 75.8, 75.8, 75.5, 0.1, null]
/js/worker.js:84 [Worker] Item 394 - Original Date: 1726, Formatted Date: null
/js/worker.js:86 [Worker] Item 394 - Invalid formatted date: 1726
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 395: (9) ['1727', '3260', '(股)', 70332296, 33.75, 34.8, 33.4, 0.95, null]
/js/worker.js:84 [Worker] Item 395 - Original Date: 1727, Formatted Date: null
/js/worker.js:86 [Worker] Item 395 - Invalid formatted date: 1727
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 396: (9) ['1730', '3260', '(股)', 3049475, 52.1, 52.4, 52, 0, null]
/js/worker.js:84 [Worker] Item 396 - Original Date: 1730, Formatted Date: null
/js/worker.js:86 [Worker] Item 396 - Invalid formatted date: 1730
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 397: (9) ['1731', '3260', '(股)', 694562, 21.75, 21.85, 21.75, 0, null]
/js/worker.js:84 [Worker] Item 397 - Original Date: 1731, Formatted Date: null
/js/worker.js:86 [Worker] Item 397 - Invalid formatted date: 1731
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 398: (9) ['1732', '3260', '(股)', 7694669, 29.3, 29.5, 28.75, 0.2, null]
/js/worker.js:84 [Worker] Item 398 - Original Date: 1732, Formatted Date: null
/js/worker.js:86 [Worker] Item 398 - Invalid formatted date: 1732
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 399: (9) ['1733', '3260', '(股)', 10484901, 30.85, 31.8, 30.8, 0.65, null]
/js/worker.js:84 [Worker] Item 399 - Original Date: 1733, Formatted Date: null
/js/worker.js:86 [Worker] Item 399 - Invalid formatted date: 1733
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 400: (9) ['1734', '3260', '(股)', 9712467, 30.6, 30.7, 30.45, -0.1, null]
/js/worker.js:84 [Worker] Item 400 - Original Date: 1734, Formatted Date: null
/js/worker.js:86 [Worker] Item 400 - Invalid formatted date: 1734
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 401: (9) ['1735', '3260', '(股)', 928603, 15, 15.05, 15, 0.1, null]
/js/worker.js:84 [Worker] Item 401 - Original Date: 1735, Formatted Date: null
/js/worker.js:86 [Worker] Item 401 - Invalid formatted date: 1735
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 402: (9) ['1736', '3260', '(股)', 230909941, 155, 158.5, 153, 1.5, null]
/js/worker.js:84 [Worker] Item 402 - Original Date: 1736, Formatted Date: null
/js/worker.js:86 [Worker] Item 402 - Invalid formatted date: 1736
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 403: (9) ['1737', '3260', '(股)', 4401901, 32, 32.15, 32, 0, null]
/js/worker.js:84 [Worker] Item 403 - Original Date: 1737, Formatted Date: null
/js/worker.js:86 [Worker] Item 403 - Invalid formatted date: 1737
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 404: (9) ['1752', '3260', '(股)', 2849149, 38.7, 38.95, 38.55, -0.1, null]
/js/worker.js:84 [Worker] Item 404 - Original Date: 1752, Formatted Date: null
/js/worker.js:86 [Worker] Item 404 - Invalid formatted date: 1752
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 405: (9) ['1760', '3260', '(股)', 6117370, 70.2, 71, 70.2, 0.3, null]
/js/worker.js:84 [Worker] Item 405 - Original Date: 1760, Formatted Date: null
/js/worker.js:86 [Worker] Item 405 - Invalid formatted date: 1760
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 406: (9) ['1762', '3260', '(股)', 2862565, 25.7, 25.85, 25.55, -0.1, null]
/js/worker.js:84 [Worker] Item 406 - Original Date: 1762, Formatted Date: null
/js/worker.js:86 [Worker] Item 406 - Invalid formatted date: 1762
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 407: (9) ['1773', '3260', '(股)', 50865293, 137.5, 138.5, 137, 0.5, null]
/js/worker.js:84 [Worker] Item 407 - Original Date: 1773, Formatted Date: null
/js/worker.js:86 [Worker] Item 407 - Invalid formatted date: 1773
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 408: (9) ['1776', '3260', '(股)', 326514, 15.15, 15.25, 15.15, 0.05, null]
/js/worker.js:84 [Worker] Item 408 - Original Date: 1776, Formatted Date: null
/js/worker.js:86 [Worker] Item 408 - Invalid formatted date: 1776
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 409: (9) ['1783', '3260', '(股)', 26096201, 45.3, 46.4, 45, 0.75, null]
/js/worker.js:84 [Worker] Item 409 - Original Date: 1783, Formatted Date: null
/js/worker.js:86 [Worker] Item 409 - Invalid formatted date: 1783
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 410: (9) ['1786', '3260', '(股)', 169348667, 92.1, 95.3, 91.3, 1.3, null]
/js/worker.js:84 [Worker] Item 410 - Original Date: 1786, Formatted Date: null
/js/worker.js:86 [Worker] Item 410 - Invalid formatted date: 1786
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 411: (9) ['1789', '3260', '(股)', 15431626, 18.9, 18.95, 18.75, 0.2, null]
/js/worker.js:84 [Worker] Item 411 - Original Date: 1789, Formatted Date: null
/js/worker.js:86 [Worker] Item 411 - Invalid formatted date: 1789
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 412: (9) ['1795', '3260', '(股)', 271592995, 189, 193.5, 187.5, 5, null]
/js/worker.js:84 [Worker] Item 412 - Original Date: 1795, Formatted Date: null
/js/worker.js:86 [Worker] Item 412 - Invalid formatted date: 1795
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 413: (9) ['1802', '3260', '(股)', 790752952, 26, 26.1, 25.3, -0.1, null]
/js/worker.js:84 [Worker] Item 413 - Original Date: 1802, Formatted Date: null
/js/worker.js:86 [Worker] Item 413 - Invalid formatted date: 1802
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 414: (9) ['1805', '3260', '(股)', 2060756, 12.05, 12.05, 11.8, 0.05, null]
/js/worker.js:84 [Worker] Item 414 - Original Date: 1805, Formatted Date: null
/js/worker.js:86 [Worker] Item 414 - Invalid formatted date: 1805
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 415: (9) ['1806', '3260', '(股)', 6005546, 9.47, 9.64, 9.47, 0.03, null]
/js/worker.js:84 [Worker] Item 415 - Original Date: 1806, Formatted Date: null
/js/worker.js:86 [Worker] Item 415 - Invalid formatted date: 1806
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 416: (9) ['1808', '3260', '(股)', 26579704, 32.05, 32.05, 31.65, -0.2, null]
/js/worker.js:84 [Worker] Item 416 - Original Date: 1808, Formatted Date: null
/js/worker.js:86 [Worker] Item 416 - Invalid formatted date: 1808
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 417: (9) ['1809', '3260', '(股)', 47980847, 19.55, 20.1, 19.2, 0.1, null]
/js/worker.js:84 [Worker] Item 417 - Original Date: 1809, Formatted Date: null
/js/worker.js:86 [Worker] Item 417 - Invalid formatted date: 1809
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 418: (9) ['1810', '3260', '(股)', 56236653, 20.6, 20.7, 19.8, -0.5, null]
/js/worker.js:84 [Worker] Item 418 - Original Date: 1810, Formatted Date: null
/js/worker.js:86 [Worker] Item 418 - Invalid formatted date: 1810
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 419: (9) ['1817', '3260', '(股)', 680208, 39.05, 39.2, 38.95, 0, null]
/js/worker.js:84 [Worker] Item 419 - Original Date: 1817, Formatted Date: null
/js/worker.js:86 [Worker] Item 419 - Invalid formatted date: 1817
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 420: (9) ['1903', '3260', '(股)', 11461179, 53.7, 53.8, 52.8, -0.6, null]
/js/worker.js:84 [Worker] Item 420 - Original Date: 1903, Formatted Date: null
/js/worker.js:86 [Worker] Item 420 - Invalid formatted date: 1903
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 421: (9) ['1904', '3260', '(股)', 8897602, 17.9, 17.9, 17.65, 0, null]
/js/worker.js:84 [Worker] Item 421 - Original Date: 1904, Formatted Date: null
/js/worker.js:86 [Worker] Item 421 - Invalid formatted date: 1904
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 422: (9) ['1905', '3260', '(股)', 11755715, 12.4, 12.45, 12.2, -0.05, null]
/js/worker.js:84 [Worker] Item 422 - Original Date: 1905, Formatted Date: null
/js/worker.js:86 [Worker] Item 422 - Invalid formatted date: 1905
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 423: (9) ['1906', '3260', '(股)', 280581, 13.4, 13.5, 13.3, 0, null]
/js/worker.js:84 [Worker] Item 423 - Original Date: 1906, Formatted Date: null
/js/worker.js:86 [Worker] Item 423 - Invalid formatted date: 1906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 424: (9) ['1907', '3260', '(股)', 18364230, 25.3, 25.7, 25.3, 0.05, null]
/js/worker.js:84 [Worker] Item 424 - Original Date: 1907, Formatted Date: null
/js/worker.js:86 [Worker] Item 424 - Invalid formatted date: 1907
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 425: (9) ['1909', '3260', '(股)', 16760014, 10, 10.05, 9.9, -0.05, null]
/js/worker.js:84 [Worker] Item 425 - Original Date: 1909, Formatted Date: null
/js/worker.js:86 [Worker] Item 425 - Invalid formatted date: 1909
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 426: (9) ['2002', '3260', '(股)', 496587588, 19.4, 19.55, 19.35, 0.15, null]
/js/worker.js:84 [Worker] Item 426 - Original Date: 2002, Formatted Date: null
/js/worker.js:86 [Worker] Item 426 - Invalid formatted date: 2002
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 427: (9) ['2002A', '3260', '(股)', 3190, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 427 - Original Date: 2002A, Formatted Date: null
/js/worker.js:86 [Worker] Item 427 - Invalid formatted date: 2002A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 428: (9) ['2006', '3260', '(股)', 81092787, 59.8, 59.9, 59.3, 0, null]
/js/worker.js:84 [Worker] Item 428 - Original Date: 2006, Formatted Date: null
/js/worker.js:86 [Worker] Item 428 - Invalid formatted date: 2006
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 429: (9) ['2007', '3260', '(股)', 1591500, 7.82, 7.88, 7.8, -0.01, null]
/js/worker.js:84 [Worker] Item 429 - Original Date: 2007, Formatted Date: null
/js/worker.js:86 [Worker] Item 429 - Invalid formatted date: 2007
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 430: (9) ['2008', '3260', '(股)', 64556, 26.75, 26.75, 26.75, 0, null]
/js/worker.js:84 [Worker] Item 430 - Original Date: 2008, Formatted Date: null
/js/worker.js:86 [Worker] Item 430 - Invalid formatted date: 2008
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 431: (9) ['2009', '3260', '(股)', 41078735, 33.95, 34.45, 33.75, 0.15, null]
/js/worker.js:84 [Worker] Item 431 - Original Date: 2009, Formatted Date: null
/js/worker.js:86 [Worker] Item 431 - Invalid formatted date: 2009
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 432: (9) ['2010', '3260', '(股)', 14208499, 20.2, 20.25, 20.1, 0.1, null]
/js/worker.js:84 [Worker] Item 432 - Original Date: 2010, Formatted Date: null
/js/worker.js:86 [Worker] Item 432 - Invalid formatted date: 2010
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 433: (9) ['2012', '3260', '(股)', 390427, 17.1, 17.55, 17.1, 0.05, null]
/js/worker.js:84 [Worker] Item 433 - Original Date: 2012, Formatted Date: null
/js/worker.js:86 [Worker] Item 433 - Invalid formatted date: 2012
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 434: (9) ['2013', '3260', '(股)', 19794462, 41.75, 42.4, 41.75, 0.15, null]
/js/worker.js:84 [Worker] Item 434 - Original Date: 2013, Formatted Date: null
/js/worker.js:86 [Worker] Item 434 - Invalid formatted date: 2013
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 435: (9) ['2014', '3260', '(股)', 70469896, 15.5, 15.95, 15.5, 0.25, null]
/js/worker.js:84 [Worker] Item 435 - Original Date: 2014, Formatted Date: null
/js/worker.js:86 [Worker] Item 435 - Invalid formatted date: 2014
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 436: (9) ['2015', '3260', '(股)', 10115296, 64.3, 64.5, 64, 0, null]
/js/worker.js:84 [Worker] Item 436 - Original Date: 2015, Formatted Date: null
/js/worker.js:86 [Worker] Item 436 - Invalid formatted date: 2015
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 437: (9) ['2017', '3260', '(股)', 5201049, 9.67, 9.67, 9.5, -0.06, null]
/js/worker.js:84 [Worker] Item 437 - Original Date: 2017, Formatted Date: null
/js/worker.js:86 [Worker] Item 437 - Invalid formatted date: 2017
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 438: (9) ['2020', '3260', '(股)', 5224301, 24.7, 25.05, 24.7, 0.15, null]
/js/worker.js:84 [Worker] Item 438 - Original Date: 2020, Formatted Date: null
/js/worker.js:86 [Worker] Item 438 - Invalid formatted date: 2020
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 439: (9) ['2022', '3260', '(股)', 2458994, 7.68, 7.75, 7.67, 0.06, null]
/js/worker.js:84 [Worker] Item 439 - Original Date: 2022, Formatted Date: null
/js/worker.js:86 [Worker] Item 439 - Invalid formatted date: 2022
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 440: (9) ['2023', '3260', '(股)', 13393594, 15.35, 15.4, 15.2, 0.1, null]
/js/worker.js:84 [Worker] Item 440 - Original Date: 2023, Formatted Date: null
/js/worker.js:86 [Worker] Item 440 - Invalid formatted date: 2023
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 441: (9) ['2024', '3260', '(股)', 73231, 18.35, 18.35, 18, -0.35, null]
/js/worker.js:84 [Worker] Item 441 - Original Date: 2024, Formatted Date: null
/js/worker.js:86 [Worker] Item 441 - Invalid formatted date: 2024
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 442: (9) ['2025', '3260', '(股)', 4422047, 11.1, 11.65, 11, 0.15, null]
/js/worker.js:84 [Worker] Item 442 - Original Date: 2025, Formatted Date: null
/js/worker.js:86 [Worker] Item 442 - Invalid formatted date: 2025
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 443: (9) ['2027', '3260', '(股)', 770414638, 38, 39.15, 38, 0.6, null]
/js/worker.js:84 [Worker] Item 443 - Original Date: 2027, Formatted Date: null
/js/worker.js:86 [Worker] Item 443 - Invalid formatted date: 2027
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 444: (9) ['2028', '3260', '(股)', 1310674, 16.95, 17.1, 16.95, 0, null]
/js/worker.js:84 [Worker] Item 444 - Original Date: 2028, Formatted Date: null
/js/worker.js:86 [Worker] Item 444 - Invalid formatted date: 2028
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 445: (9) ['2029', '3260', '(股)', 2502261, 22.3, 22.4, 22.25, 0.1, null]
/js/worker.js:84 [Worker] Item 445 - Original Date: 2029, Formatted Date: null
/js/worker.js:86 [Worker] Item 445 - Invalid formatted date: 2029
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 446: (9) ['2030', '3260', '(股)', 3125956, 13.95, 13.95, 13.8, -0.05, null]
/js/worker.js:84 [Worker] Item 446 - Original Date: 2030, Formatted Date: null
/js/worker.js:86 [Worker] Item 446 - Invalid formatted date: 2030
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 447: (9) ['2031', '3260', '(股)', 24810539, 42.9, 43.3, 42.6, 0.25, null]
/js/worker.js:84 [Worker] Item 447 - Original Date: 2031, Formatted Date: null
/js/worker.js:86 [Worker] Item 447 - Invalid formatted date: 2031
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 448: (9) ['2032', '3260', '(股)', 3437357, 14.6, 15, 14.6, 0.1, null]
/js/worker.js:84 [Worker] Item 448 - Original Date: 2032, Formatted Date: null
/js/worker.js:86 [Worker] Item 448 - Invalid formatted date: 2032
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 449: (9) ['2033', '3260', '(股)', 737475, 17.65, 17.7, 17.4, 0.1, null]
/js/worker.js:84 [Worker] Item 449 - Original Date: 2033, Formatted Date: null
/js/worker.js:86 [Worker] Item 449 - Invalid formatted date: 2033
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 450: (9) ['2034', '3260', '(股)', 18837274, 20.1, 20.2, 19.8, 0, null]
/js/worker.js:84 [Worker] Item 450 - Original Date: 2034, Formatted Date: null
/js/worker.js:86 [Worker] Item 450 - Invalid formatted date: 2034
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 451: (9) ['2038', '3260', '(股)', 3757144, 15.2, 15.3, 15.05, 0, null]
/js/worker.js:84 [Worker] Item 451 - Original Date: 2038, Formatted Date: null
/js/worker.js:86 [Worker] Item 451 - Invalid formatted date: 2038
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 452: (9) ['2049', '3260', '(股)', 1069001039, 217.5, 223, 216, 3, null]
/js/worker.js:84 [Worker] Item 452 - Original Date: 2049, Formatted Date: null
/js/worker.js:86 [Worker] Item 452 - Invalid formatted date: 2049
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 453: (9) ['2059', '3260', '(股)', 1100749825, 3400, 3430, 3370, 45, null]
/js/worker.js:84 [Worker] Item 453 - Original Date: 2059, Formatted Date: null
/js/worker.js:86 [Worker] Item 453 - Invalid formatted date: 2059
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 454: (9) ['2062', '3260', '(股)', 10912695, 22.4, 22.75, 22.15, 0.4, null]
/js/worker.js:84 [Worker] Item 454 - Original Date: 2062, Formatted Date: null
/js/worker.js:86 [Worker] Item 454 - Invalid formatted date: 2062
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 455: (9) ['2069', '3260', '(股)', 2292326, 14.8, 14.95, 14.7, 0.1, null]
/js/worker.js:84 [Worker] Item 455 - Original Date: 2069, Formatted Date: null
/js/worker.js:86 [Worker] Item 455 - Invalid formatted date: 2069
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 456: (9) ['2101', '3260', '(股)', 89836370, 43.65, 43.75, 42.6, -1.05, null]
/js/worker.js:84 [Worker] Item 456 - Original Date: 2101, Formatted Date: null
/js/worker.js:86 [Worker] Item 456 - Invalid formatted date: 2101
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 457: (9) ['2102', '3260', '(股)', 6689976, 19.4, 19.75, 19.3, 0.05, null]
/js/worker.js:84 [Worker] Item 457 - Original Date: 2102, Formatted Date: null
/js/worker.js:86 [Worker] Item 457 - Invalid formatted date: 2102
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 458: (9) ['2103', '3260', '(股)', 16172650, 16.85, 16.85, 16.6, -0.05, null]
/js/worker.js:84 [Worker] Item 458 - Original Date: 2103, Formatted Date: null
/js/worker.js:86 [Worker] Item 458 - Invalid formatted date: 2103
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 459: (9) ['2104', '3260', '(股)', 12429843, 10.7, 10.75, 10.55, 0.05, null]
/js/worker.js:84 [Worker] Item 459 - Original Date: 2104, Formatted Date: null
/js/worker.js:86 [Worker] Item 459 - Invalid formatted date: 2104
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 460: (9) ['2105', '3260', '(股)', 127376634, 38.35, 38.5, 37.9, -0.15, null]
/js/worker.js:84 [Worker] Item 460 - Original Date: 2105, Formatted Date: null
/js/worker.js:86 [Worker] Item 460 - Invalid formatted date: 2105
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 461: (9) ['2106', '3260', '(股)', 12156299, 20.3, 20.35, 20.15, 0, null]
/js/worker.js:84 [Worker] Item 461 - Original Date: 2106, Formatted Date: null
/js/worker.js:86 [Worker] Item 461 - Invalid formatted date: 2106
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 462: (9) ['2107', '3260', '(股)', 10205741, 23.95, 24.5, 23.9, 0.25, null]
/js/worker.js:84 [Worker] Item 462 - Original Date: 2107, Formatted Date: null
/js/worker.js:86 [Worker] Item 462 - Invalid formatted date: 2107
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 463: (9) ['2108', '3260', '(股)', 9558164, 23.6, 23.75, 23.5, 0.2, null]
/js/worker.js:84 [Worker] Item 463 - Original Date: 2108, Formatted Date: null
/js/worker.js:86 [Worker] Item 463 - Invalid formatted date: 2108
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 464: (9) ['2109', '3260', '(股)', 1453086, 16.45, 16.5, 16.4, 0, null]
/js/worker.js:84 [Worker] Item 464 - Original Date: 2109, Formatted Date: null
/js/worker.js:86 [Worker] Item 464 - Invalid formatted date: 2109
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 465: (9) ['2114', '3260', '(股)', 1726365, 90.1, 90.1, 90, -0.1, null]
/js/worker.js:84 [Worker] Item 465 - Original Date: 2114, Formatted Date: null
/js/worker.js:86 [Worker] Item 465 - Invalid formatted date: 2114
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 466: (9) ['2115', '3260', '(股)', 1495234, 26.35, 26.8, 26.3, 0.3, null]
/js/worker.js:84 [Worker] Item 466 - Original Date: 2115, Formatted Date: null
/js/worker.js:86 [Worker] Item 466 - Invalid formatted date: 2115
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 467: (9) ['2201', '3260', '(股)', 145805485, 35.8, 36.3, 35.2, -0.05, null]
/js/worker.js:84 [Worker] Item 467 - Original Date: 2201, Formatted Date: null
/js/worker.js:86 [Worker] Item 467 - Invalid formatted date: 2201
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 468: (9) ['2204', '3260', '(股)', 76809180, 63.1, 63.5, 61.7, -0.7, null]
/js/worker.js:84 [Worker] Item 468 - Original Date: 2204, Formatted Date: null
/js/worker.js:86 [Worker] Item 468 - Invalid formatted date: 2204
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 469: (9) ['2206', '3260', '(股)', 65442798, 64.6, 64.7, 63.8, -0.8, null]
/js/worker.js:84 [Worker] Item 469 - Original Date: 2206, Formatted Date: null
/js/worker.js:86 [Worker] Item 469 - Invalid formatted date: 2206
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 470: (9) ['2207', '3260', '(股)', 115090030, 592, 592, 588, 1, null]
/js/worker.js:84 [Worker] Item 470 - Original Date: 2207, Formatted Date: null
/js/worker.js:86 [Worker] Item 470 - Invalid formatted date: 2207
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 471: (9) ['2208', '3260', '(股)', 1135442135, 26.3, 27.25, 25, -1.2, null]
/js/worker.js:84 [Worker] Item 471 - Original Date: 2208, Formatted Date: null
/js/worker.js:86 [Worker] Item 471 - Invalid formatted date: 2208
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 472: (9) ['2211', '3260', '(股)', 81882477, 94.5, 95.4, 94, 1.1, null]
/js/worker.js:84 [Worker] Item 472 - Original Date: 2211, Formatted Date: null
/js/worker.js:86 [Worker] Item 472 - Invalid formatted date: 2211
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 473: (9) ['2227', '3260', '(股)', 1508511, 55.8, 57, 55.5, 0, null]
/js/worker.js:84 [Worker] Item 473 - Original Date: 2227, Formatted Date: null
/js/worker.js:86 [Worker] Item 473 - Invalid formatted date: 2227
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 474: (9) ['2228', '3260', '(股)', 303944688, 109, 115, 108, 4.5, null]
/js/worker.js:84 [Worker] Item 474 - Original Date: 2228, Formatted Date: null
/js/worker.js:86 [Worker] Item 474 - Invalid formatted date: 2228
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 475: (9) ['2231', '3260', '(股)', 457733458, 131.5, 133.5, 124.5, -5, null]
/js/worker.js:84 [Worker] Item 475 - Original Date: 2231, Formatted Date: null
/js/worker.js:86 [Worker] Item 475 - Invalid formatted date: 2231
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 476: (9) ['2233', '3260', '(股)', 218991123, 214.5, 221.5, 212, 7, null]
/js/worker.js:84 [Worker] Item 476 - Original Date: 2233, Formatted Date: null
/js/worker.js:86 [Worker] Item 476 - Invalid formatted date: 2233
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 477: (9) ['2236', '3260', '(股)', 51037507, 108, 108.5, 105.5, 0, null]
/js/worker.js:84 [Worker] Item 477 - Original Date: 2236, Formatted Date: null
/js/worker.js:86 [Worker] Item 477 - Invalid formatted date: 2236
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 478: (9) ['2239', '3260', '(股)', 2075736, 33.1, 33.85, 33.1, 0.45, null]
/js/worker.js:84 [Worker] Item 478 - Original Date: 2239, Formatted Date: null
/js/worker.js:86 [Worker] Item 478 - Invalid formatted date: 2239
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 479: (9) ['2241', '3260', '(股)', 29149253, 26.7, 28.1, 26.65, 1.3, null]
/js/worker.js:84 [Worker] Item 479 - Original Date: 2241, Formatted Date: null
/js/worker.js:86 [Worker] Item 479 - Invalid formatted date: 2241
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 480: (9) ['2243', '3260', '(股)', 8335580, 11.55, 12.05, 11.55, 0.2, null]
/js/worker.js:84 [Worker] Item 480 - Original Date: 2243, Formatted Date: null
/js/worker.js:86 [Worker] Item 480 - Invalid formatted date: 2243
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 481: (9) ['2247', '3260', '(股)', 35375660, 295, 295.5, 292.5, 0.5, null]
/js/worker.js:84 [Worker] Item 481 - Original Date: 2247, Formatted Date: null
/js/worker.js:86 [Worker] Item 481 - Invalid formatted date: 2247
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 482: (9) ['2248', '3260', '(股)', 1437828, 41.85, 42, 41.85, 0, null]
/js/worker.js:84 [Worker] Item 482 - Original Date: 2248, Formatted Date: null
/js/worker.js:86 [Worker] Item 482 - Invalid formatted date: 2248
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 483: (9) ['2250', '3260', '(股)', 25120601, 92.5, 93, 90.2, -2.1, null]
/js/worker.js:84 [Worker] Item 483 - Original Date: 2250, Formatted Date: null
/js/worker.js:86 [Worker] Item 483 - Invalid formatted date: 2250
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 484: (9) ['2254', '3260', '(股)', 302900, 60.5, 60.6, 60.5, 0.3, null]
/js/worker.js:84 [Worker] Item 484 - Original Date: 2254, Formatted Date: null
/js/worker.js:86 [Worker] Item 484 - Invalid formatted date: 2254
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 485: (9) ['2258', '3260', '(股)', 11741326, 38.55, 38.9, 38.55, 0.1, null]
/js/worker.js:84 [Worker] Item 485 - Original Date: 2258, Formatted Date: null
/js/worker.js:86 [Worker] Item 485 - Invalid formatted date: 2258
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 486: (9) ['2301', '3260', '(股)', 7027121926, 159.5, 168, 159.5, 5, null]
/js/worker.js:84 [Worker] Item 486 - Original Date: 2301, Formatted Date: null
/js/worker.js:86 [Worker] Item 486 - Invalid formatted date: 2301
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 487: (9) ['2302', '3260', '(股)', 142104566, 18.4, 19.25, 18.15, 0.05, null]
/js/worker.js:84 [Worker] Item 487 - Original Date: 2302, Formatted Date: null
/js/worker.js:86 [Worker] Item 487 - Invalid formatted date: 2302
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 488: (9) ['2303', '3260', '(股)', 1628155637, 41.7, 42.1, 41.65, 0.35, null]
/js/worker.js:84 [Worker] Item 488 - Original Date: 2303, Formatted Date: null
/js/worker.js:86 [Worker] Item 488 - Invalid formatted date: 2303
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 489: (9) ['2305', '3260', '(股)', 15361567, 11.65, 12.3, 11.6, 0.5, null]
/js/worker.js:84 [Worker] Item 489 - Original Date: 2305, Formatted Date: null
/js/worker.js:86 [Worker] Item 489 - Invalid formatted date: 2305
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 490: (9) ['2308', '3260', '(股)', 19662834215, 837, 899, 837, 56, null]
/js/worker.js:84 [Worker] Item 490 - Original Date: 2308, Formatted Date: null
/js/worker.js:86 [Worker] Item 490 - Invalid formatted date: 2308
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 491: (9) ['2312', '3260', '(股)', 498380999, 19.55, 20.35, 19.55, 0.55, null]
/js/worker.js:84 [Worker] Item 491 - Original Date: 2312, Formatted Date: null
/js/worker.js:86 [Worker] Item 491 - Invalid formatted date: 2312
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 492: (9) ['2313', '3260', '(股)', 1186672539, 75.4, 76, 73.9, 0.9, null]
/js/worker.js:84 [Worker] Item 492 - Original Date: 2313, Formatted Date: null
/js/worker.js:86 [Worker] Item 492 - Invalid formatted date: 2313
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 493: (9) ['2314', '3260', '(股)', 5535779, 10.55, 10.6, 10.5, 0.1, null]
/js/worker.js:84 [Worker] Item 493 - Original Date: 2314, Formatted Date: null
/js/worker.js:86 [Worker] Item 493 - Invalid formatted date: 2314
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 494: (9) ['2316', '3260', '(股)', 1060092862, 100.5, 105.5, 98.3, 3, null]
/js/worker.js:84 [Worker] Item 494 - Original Date: 2316, Formatted Date: null
/js/worker.js:86 [Worker] Item 494 - Invalid formatted date: 2316
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 495: (9) ['2317', '3260', '(股)', 17094718551, 211.5, 216, 208, 3, null]
/js/worker.js:84 [Worker] Item 495 - Original Date: 2317, Formatted Date: null
/js/worker.js:86 [Worker] Item 495 - Invalid formatted date: 2317
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 496: (9) ['2321', '3260', '(股)', 766872, 15.7, 15.95, 15.4, 0.25, null]
/js/worker.js:84 [Worker] Item 496 - Original Date: 2321, Formatted Date: null
/js/worker.js:86 [Worker] Item 496 - Invalid formatted date: 2321
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 497: (9) ['2323', '3260', '(股)', 51350628, 9, 9.05, 8.91, 0.23, null]
/js/worker.js:84 [Worker] Item 497 - Original Date: 2323, Formatted Date: null
/js/worker.js:86 [Worker] Item 497 - Invalid formatted date: 2323
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 498: (9) ['2324', '3260', '(股)', 1149928407, 31.2, 31.45, 30.2, -0.35, null]
/js/worker.js:84 [Worker] Item 498 - Original Date: 2324, Formatted Date: null
/js/worker.js:86 [Worker] Item 498 - Invalid formatted date: 2324
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 499: (9) ['2327', '3260', '(股)', 5777838403, 158.5, 159, 154, 2, null]
/js/worker.js:84 [Worker] Item 499 - Original Date: 2327, Formatted Date: null
/js/worker.js:86 [Worker] Item 499 - Invalid formatted date: 2327
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 500: (9) ['2328', '3260', '(股)', 551856693, 53.8, 54.1, 52.8, -0.1, null]
/js/worker.js:84 [Worker] Item 500 - Original Date: 2328, Formatted Date: null
/js/worker.js:86 [Worker] Item 500 - Invalid formatted date: 2328
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 501: (9) ['2329', '3260', '(股)', 3021543597, 49, 49.7, 46.55, -1.45, null]
/js/worker.js:84 [Worker] Item 501 - Original Date: 2329, Formatted Date: null
/js/worker.js:86 [Worker] Item 501 - Invalid formatted date: 2329
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 502: (9) ['2330', '3260', '(股)', 33782903646, 1275, 1285, 1265, 20, null]
/js/worker.js:84 [Worker] Item 502 - Original Date: 2330, Formatted Date: null
/js/worker.js:86 [Worker] Item 502 - Invalid formatted date: 2330
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 503: (9) ['2331', '3260', '(股)', 107262704, 20.2, 20.9, 20.15, 0.85, null]
/js/worker.js:84 [Worker] Item 503 - Original Date: 2331, Formatted Date: null
/js/worker.js:86 [Worker] Item 503 - Invalid formatted date: 2331
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 504: (9) ['2332', '3260', '(股)', 125572009, 17.2, 17.9, 17.15, 0.5, null]
/js/worker.js:84 [Worker] Item 504 - Original Date: 2332, Formatted Date: null
/js/worker.js:86 [Worker] Item 504 - Invalid formatted date: 2332
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 505: (9) ['2337', '3260', '(股)', 2981433724, 25.5, 27.05, 25.2, 2.45, null]
/js/worker.js:84 [Worker] Item 505 - Original Date: 2337, Formatted Date: null
/js/worker.js:86 [Worker] Item 505 - Invalid formatted date: 2337
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 506: (9) ['2338', '3260', '(股)', 177009128, 41, 42.9, 40.65, 1.35, null]
/js/worker.js:84 [Worker] Item 506 - Original Date: 2338, Formatted Date: null
/js/worker.js:86 [Worker] Item 506 - Invalid formatted date: 2338
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 507: (9) ['2340', '3260', '(股)', 847430652, 29.6, 32, 29, 2.9, null]
/js/worker.js:84 [Worker] Item 507 - Original Date: 2340, Formatted Date: null
/js/worker.js:86 [Worker] Item 507 - Invalid formatted date: 2340
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 508: (9) ['2342', '3260', '(股)', 1066045278, 33.4, 34.3, 32.6, 3.1, null]
/js/worker.js:84 [Worker] Item 508 - Original Date: 2342, Formatted Date: null
/js/worker.js:86 [Worker] Item 508 - Invalid formatted date: 2342
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 509: (9) ['2344', '3260', '(股)', 14081142879, 30.25, 32.3, 30.25, 2.9, null]
/js/worker.js:84 [Worker] Item 509 - Original Date: 2344, Formatted Date: null
/js/worker.js:86 [Worker] Item 509 - Invalid formatted date: 2344
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 510: (9) ['2345', '3260', '(股)', 3061063571, 1060, 1090, 1055, 15, null]
/js/worker.js:84 [Worker] Item 510 - Original Date: 2345, Formatted Date: null
/js/worker.js:86 [Worker] Item 510 - Invalid formatted date: 2345
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 511: (9) ['2347', '3260', '(股)', 307923237, 61.8, 62.3, 61.1, -0.4, null]
/js/worker.js:84 [Worker] Item 511 - Original Date: 2347, Formatted Date: null
/js/worker.js:86 [Worker] Item 511 - Invalid formatted date: 2347
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 512: (9) ['2348', '3260', '(股)', 242402965, 103, 106, 99.1, -4.6, null]
/js/worker.js:84 [Worker] Item 512 - Original Date: 2348, Formatted Date: null
/js/worker.js:86 [Worker] Item 512 - Invalid formatted date: 2348
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 513: (9) ['2348A', '3260', '(股)', 2307436, 36.3, 36.3, 36, -0.15, null]
/js/worker.js:84 [Worker] Item 513 - Original Date: 2348A, Formatted Date: null
/js/worker.js:86 [Worker] Item 513 - Invalid formatted date: 2348A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 514: (9) ['2349', '3260', '(股)', 37387549, 10.4, 10.8, 10.35, 0.3, null]
/js/worker.js:84 [Worker] Item 514 - Original Date: 2349, Formatted Date: null
/js/worker.js:86 [Worker] Item 514 - Invalid formatted date: 2349
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 515: (9) ['2351', '3260', '(股)', 151797574, 81.6, 84.7, 81.6, 2.6, null]
/js/worker.js:84 [Worker] Item 515 - Original Date: 2351, Formatted Date: null
/js/worker.js:86 [Worker] Item 515 - Invalid formatted date: 2351
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 516: (9) ['2352', '3260', '(股)', 139273783, 31.15, 31.45, 30.65, 0, null]
/js/worker.js:84 [Worker] Item 516 - Original Date: 2352, Formatted Date: null
/js/worker.js:86 [Worker] Item 516 - Invalid formatted date: 2352
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 517: (9) ['2353', '3260', '(股)', 519035377, 31.1, 31.85, 31.1, 0.45, null]
/js/worker.js:84 [Worker] Item 517 - Original Date: 2353, Formatted Date: null
/js/worker.js:86 [Worker] Item 517 - Invalid formatted date: 2353
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 518: (9) ['2354', '3260', '(股)', 655898229, 69.2, 70.1, 68.4, 1.3, null]
/js/worker.js:84 [Worker] Item 518 - Original Date: 2354, Formatted Date: null
/js/worker.js:86 [Worker] Item 518 - Invalid formatted date: 2354
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 519: (9) ['2355', '3260', '(股)', 76633326, 36.55, 36.7, 36, -0.05, null]
/js/worker.js:84 [Worker] Item 519 - Original Date: 2355, Formatted Date: null
/js/worker.js:86 [Worker] Item 519 - Invalid formatted date: 2355
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 520: (9) ['2356', '3260', '(股)', 382406089, 42.95, 43.3, 42.6, 0.55, null]
/js/worker.js:84 [Worker] Item 520 - Original Date: 2356, Formatted Date: null
/js/worker.js:86 [Worker] Item 520 - Invalid formatted date: 2356
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 521: (9) ['2357', '3260', '(股)', 1799357699, 680, 687, 673, 7, null]
/js/worker.js:84 [Worker] Item 521 - Original Date: 2357, Formatted Date: null
/js/worker.js:86 [Worker] Item 521 - Invalid formatted date: 2357
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 522: (9) ['2359', '3260', '(股)', 213100012, 145.5, 146, 142.5, -1, null]
/js/worker.js:84 [Worker] Item 522 - Original Date: 2359, Formatted Date: null
/js/worker.js:86 [Worker] Item 522 - Invalid formatted date: 2359
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 523: (9) ['2360', '3260', '(股)', 2764878880, 568, 617, 566, 48, null]
/js/worker.js:84 [Worker] Item 523 - Original Date: 2360, Formatted Date: null
/js/worker.js:86 [Worker] Item 523 - Invalid formatted date: 2360
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 524: (9) ['2362', '3260', '(股)', 38126238, 41.9, 43, 41.9, 1, null]
/js/worker.js:84 [Worker] Item 524 - Original Date: 2362, Formatted Date: null
/js/worker.js:86 [Worker] Item 524 - Invalid formatted date: 2362
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 525: (9) ['2363', '3260', '(股)', 1918926318, 56.2, 61.4, 56.2, 5.5, null]
/js/worker.js:84 [Worker] Item 525 - Original Date: 2363, Formatted Date: null
/js/worker.js:86 [Worker] Item 525 - Invalid formatted date: 2363
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 526: (9) ['2364', '3260', '(股)', 18624029, 79.9, 80.6, 78.9, -1, null]
/js/worker.js:84 [Worker] Item 526 - Original Date: 2364, Formatted Date: null
/js/worker.js:86 [Worker] Item 526 - Invalid formatted date: 2364
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 527: (9) ['2365', '3260', '(股)', 113422485, 42.85, 43.4, 42.15, -0.3, null]
/js/worker.js:84 [Worker] Item 527 - Original Date: 2365, Formatted Date: null
/js/worker.js:86 [Worker] Item 527 - Invalid formatted date: 2365
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 528: (9) ['2367', '3260', '(股)', 153004751, 27.3, 27.45, 27.05, 0.3, null]
/js/worker.js:84 [Worker] Item 528 - Original Date: 2367, Formatted Date: null
/js/worker.js:86 [Worker] Item 528 - Invalid formatted date: 2367
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 529: (9) ['2368', '3260', '(股)', 4027215108, 448, 450, 436, -4.5, null]
/js/worker.js:84 [Worker] Item 529 - Original Date: 2368, Formatted Date: null
/js/worker.js:86 [Worker] Item 529 - Invalid formatted date: 2368
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 530: (9) ['2369', '3260', '(股)', 164301957, 18.65, 19.25, 18.5, 0.45, null]
/js/worker.js:84 [Worker] Item 530 - Original Date: 2369, Formatted Date: null
/js/worker.js:86 [Worker] Item 530 - Invalid formatted date: 2369
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 531: (9) ['2371', '3260', '(股)', 289276781, 40.1, 40.15, 39.4, -0.2, null]
/js/worker.js:84 [Worker] Item 531 - Original Date: 2371, Formatted Date: null
/js/worker.js:86 [Worker] Item 531 - Invalid formatted date: 2371
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 532: (9) ['2373', '3260', '(股)', 700107, 57, 57, 56.6, 0, null]
/js/worker.js:84 [Worker] Item 532 - Original Date: 2373, Formatted Date: null
/js/worker.js:86 [Worker] Item 532 - Invalid formatted date: 2373
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 533: (9) ['2374', '3260', '(股)', 3100056508, 93.5, 94, 85.9, -6.6, null]
/js/worker.js:84 [Worker] Item 533 - Original Date: 2374, Formatted Date: null
/js/worker.js:86 [Worker] Item 533 - Invalid formatted date: 2374
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 534: (9) ['2375', '3260', '(股)', 1005212468, 67.5, 69.4, 66.5, 2.3, null]
/js/worker.js:84 [Worker] Item 534 - Original Date: 2375, Formatted Date: null
/js/worker.js:86 [Worker] Item 534 - Invalid formatted date: 2375
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 535: (9) ['2376', '3260', '(股)', 599928524, 273, 275.5, 270.5, 5.5, null]
/js/worker.js:84 [Worker] Item 535 - Original Date: 2376, Formatted Date: null
/js/worker.js:86 [Worker] Item 535 - Invalid formatted date: 2376
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 536: (9) ['2377', '3260', '(股)', 622510269, 121.5, 122.5, 120.5, 0.5, null]
/js/worker.js:84 [Worker] Item 536 - Original Date: 2377, Formatted Date: null
/js/worker.js:86 [Worker] Item 536 - Invalid formatted date: 2377
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 537: (9) ['2379', '3260', '(股)', 874432112, 542, 545, 539, 1, null]
/js/worker.js:84 [Worker] Item 537 - Original Date: 2379, Formatted Date: null
/js/worker.js:86 [Worker] Item 537 - Invalid formatted date: 2379
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 538: (9) ['2380', '3260', '(股)', 958635, 5.95, 6, 5.68, -0.15, null]
/js/worker.js:84 [Worker] Item 538 - Original Date: 2380, Formatted Date: null
/js/worker.js:86 [Worker] Item 538 - Invalid formatted date: 2380
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 539: (9) ['2382', '3260', '(股)', 5790414409, 275, 279.5, 273, 6.5, null]
/js/worker.js:84 [Worker] Item 539 - Original Date: 2382, Formatted Date: null
/js/worker.js:86 [Worker] Item 539 - Invalid formatted date: 2382
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 540: (9) ['2383', '3260', '(股)', 3863236510, 1305, 1340, 1295, 20, null]
/js/worker.js:84 [Worker] Item 540 - Original Date: 2383, Formatted Date: null
/js/worker.js:86 [Worker] Item 540 - Invalid formatted date: 2383
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 541: (9) ['2385', '3260', '(股)', 816648731, 138.5, 143.5, 138, 3.5, null]
/js/worker.js:84 [Worker] Item 541 - Original Date: 2385, Formatted Date: null
/js/worker.js:86 [Worker] Item 541 - Invalid formatted date: 2385
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 542: (9) ['2387', '3260', '(股)', 18058087, 41.3, 42.1, 41.2, 0.65, null]
/js/worker.js:84 [Worker] Item 542 - Original Date: 2387, Formatted Date: null
/js/worker.js:86 [Worker] Item 542 - Invalid formatted date: 2387
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 543: (9) ['2388', '3260', '(股)', 974253856, 58.8, 64.1, 58.8, 5.8, null]
/js/worker.js:84 [Worker] Item 543 - Original Date: 2388, Formatted Date: null
/js/worker.js:86 [Worker] Item 543 - Invalid formatted date: 2388
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 544: (9) ['2390', '3260', '(股)', 5599721, 10.5, 10.65, 10.5, 0.15, null]
/js/worker.js:84 [Worker] Item 544 - Original Date: 2390, Formatted Date: null
/js/worker.js:86 [Worker] Item 544 - Invalid formatted date: 2390
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 545: (9) ['2392', '3260', '(股)', 101767433, 48.7, 49.55, 48.7, 0.9, null]
/js/worker.js:84 [Worker] Item 545 - Original Date: 2392, Formatted Date: null
/js/worker.js:86 [Worker] Item 545 - Invalid formatted date: 2392
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 546: (9) ['2393', '3260', '(股)', 107457385, 62.3, 63.4, 62.2, 0.5, null]
/js/worker.js:84 [Worker] Item 546 - Original Date: 2393, Formatted Date: null
/js/worker.js:86 [Worker] Item 546 - Invalid formatted date: 2393
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 547: (9) ['2395', '3260', '(股)', 1041662120, 320, 331.5, 320, 2, null]
/js/worker.js:84 [Worker] Item 547 - Original Date: 2395, Formatted Date: null
/js/worker.js:86 [Worker] Item 547 - Invalid formatted date: 2395
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 548: (9) ['2397', '3260', '(股)', 16579294, 73.3, 73.6, 72.7, 0.3, null]
/js/worker.js:84 [Worker] Item 548 - Original Date: 2397, Formatted Date: null
/js/worker.js:86 [Worker] Item 548 - Invalid formatted date: 2397
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 549: (9) ['2399', '3260', '(股)', 61517808, 19.45, 20.2, 19.45, 0.45, null]
/js/worker.js:84 [Worker] Item 549 - Original Date: 2399, Formatted Date: null
/js/worker.js:86 [Worker] Item 549 - Invalid formatted date: 2399
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 550: (9) ['2401', '3260', '(股)', 296078934, 24.45, 25.1, 24.25, 0.1, null]
/js/worker.js:84 [Worker] Item 550 - Original Date: 2401, Formatted Date: null
/js/worker.js:86 [Worker] Item 550 - Invalid formatted date: 2401
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 551: (9) ['2402', '3260', '(股)', 328316766, 54.3, 54.7, 52.6, -0.4, null]
/js/worker.js:84 [Worker] Item 551 - Original Date: 2402, Formatted Date: null
/js/worker.js:86 [Worker] Item 551 - Invalid formatted date: 2402
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 552: (9) ['2404', '3260', '(股)', 2516174812, 1000, 1005, 982, 3, null]
/js/worker.js:84 [Worker] Item 552 - Original Date: 2404, Formatted Date: null
/js/worker.js:86 [Worker] Item 552 - Invalid formatted date: 2404
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 553: (9) ['2405', '3260', '(股)', 56132249, 19.2, 19.55, 19.15, 0.2, null]
/js/worker.js:84 [Worker] Item 553 - Original Date: 2405, Formatted Date: null
/js/worker.js:86 [Worker] Item 553 - Invalid formatted date: 2405
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 554: (9) ['2406', '3260', '(股)', 478113890, 22.5, 23.75, 22.35, 0.4, null]
/js/worker.js:84 [Worker] Item 554 - Original Date: 2406, Formatted Date: null
/js/worker.js:86 [Worker] Item 554 - Invalid formatted date: 2406
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 555: (9) ['2408', '3260', '(股)', 26650040314, 76, 80, 75.3, 6.7, null]
/js/worker.js:84 [Worker] Item 555 - Original Date: 2408, Formatted Date: null
/js/worker.js:86 [Worker] Item 555 - Invalid formatted date: 2408
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 556: (9) ['2409', '3260', '(股)', 1671228567, 13.5, 13.9, 13.35, 0.2, null]
/js/worker.js:84 [Worker] Item 556 - Original Date: 2409, Formatted Date: null
/js/worker.js:86 [Worker] Item 556 - Invalid formatted date: 2409
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 557: (9) ['2412', '3260', '(股)', 627012617, 134.5, 135, 133.5, -0.5, null]
/js/worker.js:84 [Worker] Item 557 - Original Date: 2412, Formatted Date: null
/js/worker.js:86 [Worker] Item 557 - Invalid formatted date: 2412
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 558: (9) ['2413', '3260', '(股)', 8108777, 21.15, 21.35, 20.95, -0.05, null]
/js/worker.js:84 [Worker] Item 558 - Original Date: 2413, Formatted Date: null
/js/worker.js:86 [Worker] Item 558 - Invalid formatted date: 2413
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 559: (9) ['2414', '3260', '(股)', 7502693, 43.85, 43.85, 43.5, -0.2, null]
/js/worker.js:84 [Worker] Item 559 - Original Date: 2414, Formatted Date: null
/js/worker.js:86 [Worker] Item 559 - Invalid formatted date: 2414
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 560: (9) ['2415', '3260', '(股)', 1412601, 25.9, 26.45, 25.75, 0.65, null]
/js/worker.js:84 [Worker] Item 560 - Original Date: 2415, Formatted Date: null
/js/worker.js:86 [Worker] Item 560 - Invalid formatted date: 2415
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 561: (9) ['2417', '3260', '(股)', 34183025, 43.25, 43.85, 42.75, 0.05, null]
/js/worker.js:84 [Worker] Item 561 - Original Date: 2417, Formatted Date: null
/js/worker.js:86 [Worker] Item 561 - Invalid formatted date: 2417
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 562: (9) ['2419', '3260', '(股)', 37070963, 23.45, 24.05, 23.45, 0.6, null]
/js/worker.js:84 [Worker] Item 562 - Original Date: 2419, Formatted Date: null
/js/worker.js:86 [Worker] Item 562 - Invalid formatted date: 2419
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 563: (9) ['2420', '3260', '(股)', 30572321, 51.1, 51.4, 50.8, 0.1, null]
/js/worker.js:84 [Worker] Item 563 - Original Date: 2420, Formatted Date: null
/js/worker.js:86 [Worker] Item 563 - Invalid formatted date: 2420
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 564: (9) ['2421', '3260', '(股)', 445777437, 127.5, 130, 124.5, 1.5, null]
/js/worker.js:84 [Worker] Item 564 - Original Date: 2421, Formatted Date: null
/js/worker.js:86 [Worker] Item 564 - Invalid formatted date: 2421
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 565: (9) ['2423', '3260', '(股)', 12292317, 52.9, 53.7, 52.2, 0, null]
/js/worker.js:84 [Worker] Item 565 - Original Date: 2423, Formatted Date: null
/js/worker.js:86 [Worker] Item 565 - Invalid formatted date: 2423
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 566: (9) ['2424', '3260', '(股)', 1159759, 63.1, 63.7, 61.5, -1.7, null]
/js/worker.js:84 [Worker] Item 566 - Original Date: 2424, Formatted Date: null
/js/worker.js:86 [Worker] Item 566 - Invalid formatted date: 2424
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 567: (9) ['2425', '3260', '(股)', 17995542, 32.75, 33.2, 32.5, 0.65, null]
/js/worker.js:84 [Worker] Item 567 - Original Date: 2425, Formatted Date: null
/js/worker.js:86 [Worker] Item 567 - Invalid formatted date: 2425
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 568: (9) ['2426', '3260', '(股)', 35197228, 18, 19, 18, 0.5, null]
/js/worker.js:84 [Worker] Item 568 - Original Date: 2426, Formatted Date: null
/js/worker.js:86 [Worker] Item 568 - Invalid formatted date: 2426
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 569: (9) ['2427', '3260', '(股)', 24435974, 27.55, 27.65, 27.4, 0.35, null]
/js/worker.js:84 [Worker] Item 569 - Original Date: 2427, Formatted Date: null
/js/worker.js:86 [Worker] Item 569 - Invalid formatted date: 2427
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 570: (9) ['2428', '3260', '(股)', 31794663, 151.5, 151.5, 149.5, 0.5, null]
/js/worker.js:84 [Worker] Item 570 - Original Date: 2428, Formatted Date: null
/js/worker.js:86 [Worker] Item 570 - Invalid formatted date: 2428
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 571: (9) ['2429', '3260', '(股)', 97908194, 130, 130.5, 121.5, -4.5, null]
/js/worker.js:84 [Worker] Item 571 - Original Date: 2429, Formatted Date: null
worker.js:86 [Worker] Item 571 - Invalid formatted date: 2429
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 572: (9) ['2430', '3260', '(股)', 991921, 24.25, 24.5, 24.2, 0.15, null]
worker.js:84 [Worker] Item 572 - Original Date: 2430, Formatted Date: null
worker.js:86 [Worker] Item 572 - Invalid formatted date: 2430
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 573: (9) ['2431', '3260', '(股)', 21784433, 13.25, 13.45, 13.05, 0.15, null]
worker.js:84 [Worker] Item 573 - Original Date: 2431, Formatted Date: null
worker.js:86 [Worker] Item 573 - Invalid formatted date: 2431
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 574: (9) ['2432', '3260', '(股)', 773170, 27.75, 27.75, 27.4, 0, null]
worker.js:84 [Worker] Item 574 - Original Date: 2432, Formatted Date: null
worker.js:86 [Worker] Item 574 - Invalid formatted date: 2432
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 575: (9) ['2433', '3260', '(股)', 1474035, 49, 49, 48.9, -0.05, null]
worker.js:84 [Worker] Item 575 - Original Date: 2433, Formatted Date: null
worker.js:86 [Worker] Item 575 - Invalid formatted date: 2433
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 576: (9) ['2434', '3260', '(股)', 493029, 28.85, 29.2, 28.85, 0.4, null]
worker.js:84 [Worker] Item 576 - Original Date: 2434, Formatted Date: null
worker.js:86 [Worker] Item 576 - Invalid formatted date: 2434
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 577: (9) ['2436', '3260', '(股)', 337771917, 56.2, 58.3, 55.7, 0.9, null]
worker.js:84 [Worker] Item 577 - Original Date: 2436, Formatted Date: null
worker.js:86 [Worker] Item 577 - Invalid formatted date: 2436
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 578: (9) ['2438', '3260', '(股)', 1589097, 25, 25, 24.05, -0.35, null]
worker.js:84 [Worker] Item 578 - Original Date: 2438, Formatted Date: null
worker.js:86 [Worker] Item 578 - Invalid formatted date: 2438
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 579: (9) ['2439', '3260', '(股)', 168537663, 102.5, 103, 102, 1.5, null]
worker.js:84 [Worker] Item 579 - Original Date: 2439, Formatted Date: null
worker.js:86 [Worker] Item 579 - Invalid formatted date: 2439
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 580: (9) ['2440', '3260', '(股)', 3257833, 12.45, 12.45, 12.3, 0.05, null]
worker.js:84 [Worker] Item 580 - Original Date: 2440, Formatted Date: null
worker.js:86 [Worker] Item 580 - Invalid formatted date: 2440
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 581: (9) ['2441', '3260', '(股)', 124738531, 63.4, 64.4, 63.3, 1.1, null]
worker.js:84 [Worker] Item 581 - Original Date: 2441, Formatted Date: null
worker.js:86 [Worker] Item 581 - Invalid formatted date: 2441
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 582: (9) ['2442', '3260', '(股)', 14652697, 26.5, 26.55, 26.1, 0, null]
worker.js:84 [Worker] Item 582 - Original Date: 2442, Formatted Date: null
worker.js:86 [Worker] Item 582 - Invalid formatted date: 2442
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 583: (9) ['2444', '3260', '(股)', 33892923, 13.5, 13.5, 12.3, -0.15, null]
worker.js:84 [Worker] Item 583 - Original Date: 2444, Formatted Date: null
worker.js:86 [Worker] Item 583 - Invalid formatted date: 2444
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 584: (9) ['2449', '3260', '(股)', 5201366295, 166.5, 171.5, 165.5, 2.5, null]
worker.js:84 [Worker] Item 584 - Original Date: 2449, Formatted Date: null
worker.js:86 [Worker] Item 584 - Invalid formatted date: 2449
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 585: (9) ['2450', '3260', '(股)', 3082326, 29.55, 29.55, 29.45, 0.05, null]
worker.js:84 [Worker] Item 585 - Original Date: 2450, Formatted Date: null
worker.js:86 [Worker] Item 585 - Invalid formatted date: 2450
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 586: (9) ['2451', '3260', '(股)', 339003794, 119, 121.5, 118, 0.5, null]
worker.js:84 [Worker] Item 586 - Original Date: 2451, Formatted Date: null
worker.js:86 [Worker] Item 586 - Invalid formatted date: 2451
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 587: (9) ['2453', '3260', '(股)', 134830691, 61.2, 63.5, 61.2, 2.1, null]
worker.js:84 [Worker] Item 587 - Original Date: 2453, Formatted Date: null
worker.js:86 [Worker] Item 587 - Invalid formatted date: 2453
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 588: (9) ['2454', '3260', '(股)', 5886633915, 1525, 1530, 1495, 0, null]
worker.js:84 [Worker] Item 588 - Original Date: 2454, Formatted Date: null
worker.js:86 [Worker] Item 588 - Invalid formatted date: 2454
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 589: (9) ['2455', '3260', '(股)', 2536275533, 162, 170, 161, 4, null]
worker.js:84 [Worker] Item 589 - Original Date: 2455, Formatted Date: null
worker.js:86 [Worker] Item 589 - Invalid formatted date: 2455
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 590: (9) ['2457', '3260', '(股)', 148541014, 25.3, 25.95, 25.1, 0.3, null]
worker.js:84 [Worker] Item 590 - Original Date: 2457, Formatted Date: null
worker.js:86 [Worker] Item 590 - Invalid formatted date: 2457
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 591: (9) ['2458', '3260', '(股)', 725991885, 133.5, 138.5, 132.5, 3.5, null]
worker.js:84 [Worker] Item 591 - Original Date: 2458, Formatted Date: null
worker.js:86 [Worker] Item 591 - Invalid formatted date: 2458
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 592: (9) ['2459', '3260', '(股)', 2428612, 64, 64, 63.6, 0.4, null]
worker.js:84 [Worker] Item 592 - Original Date: 2459, Formatted Date: null
worker.js:86 [Worker] Item 592 - Invalid formatted date: 2459
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 593: (9) ['2460', '3260', '(股)', 1938727, 19, 19.3, 18.8, 0.15, null]
worker.js:84 [Worker] Item 593 - Original Date: 2460, Formatted Date: null
worker.js:86 [Worker] Item 593 - Invalid formatted date: 2460
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 594: (9) ['2461', '3260', '(股)', 7162747, 16.75, 17.1, 16.65, 0.35, null]
worker.js:84 [Worker] Item 594 - Original Date: 2461, Formatted Date: null
worker.js:86 [Worker] Item 594 - Invalid formatted date: 2461
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 595: (9) ['2462', '3260', '(股)', 16611852, 25.85, 25.85, 25.15, -0.2, null]
worker.js:84 [Worker] Item 595 - Original Date: 2462, Formatted Date: null
worker.js:86 [Worker] Item 595 - Invalid formatted date: 2462
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 596: (9) ['2464', '3260', '(股)', 413756529, 74.3, 74.7, 71.1, -2.8, null]
worker.js:84 [Worker] Item 596 - Original Date: 2464, Formatted Date: null
worker.js:86 [Worker] Item 596 - Invalid formatted date: 2464
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 597: (9) ['2465', '3260', '(股)', 11008440, 58.1, 59.3, 58, 0.3, null]
worker.js:84 [Worker] Item 597 - Original Date: 2465, Formatted Date: null
worker.js:86 [Worker] Item 597 - Invalid formatted date: 2465
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 598: (9) ['2466', '3260', '(股)', 14688273, 70.3, 72.1, 70.1, 0.2, null]
worker.js:84 [Worker] Item 598 - Original Date: 2466, Formatted Date: null
worker.js:86 [Worker] Item 598 - Invalid formatted date: 2466
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 599: (9) ['2467', '3260', '(股)', 357260702, 189, 196.5, 188.5, 3, null]
worker.js:84 [Worker] Item 599 - Original Date: 2467, Formatted Date: null
worker.js:86 [Worker] Item 599 - Invalid formatted date: 2467
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 600: (9) ['2468', '3260', '(股)', 48532340, 52.1, 52.4, 51.5, -0.4, null]
worker.js:84 [Worker] Item 600 - Original Date: 2468, Formatted Date: null
worker.js:86 [Worker] Item 600 - Invalid formatted date: 2468
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
worker.js:82 [Worker] Processing item 601: (9) ['2471', '3260', '(股)', 7698580, 50.1, 50.4, 49.85, 0.45, null]
worker.js:84 [Worker] Item 601 - Original Date: 2471, Formatted Date: null
worker.js:86 [Worker] Item 601 - Invalid formatted date: 2471
(anonymous) @ worker.js:86
fetchStockData @ worker.js:81
await in fetchStockData
self.onmessage @ worker.js:818
/js/worker.js:82 [Worker] Processing item 602: (9) ['2472', '3260', '(股)', 243296403, 85.3, 88.2, 84.2, 2.3, null]
/js/worker.js:84 [Worker] Item 602 - Original Date: 2472, Formatted Date: null
/js/worker.js:86 [Worker] Item 602 - Invalid formatted date: 2472
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 603: (9) ['2474', '3260', '(股)', 420365576, 186.5, 188, 185, 2, null]
/js/worker.js:84 [Worker] Item 603 - Original Date: 2474, Formatted Date: null
/js/worker.js:86 [Worker] Item 603 - Invalid formatted date: 2474
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 604: (9) ['2476', '3260', '(股)', 533481115, 107.5, 110, 106, 2.5, null]
/js/worker.js:84 [Worker] Item 604 - Original Date: 2476, Formatted Date: null
/js/worker.js:86 [Worker] Item 604 - Invalid formatted date: 2476
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 605: (9) ['2477', '3260', '(股)', 13543842, 24.5, 25.7, 24.5, 0.45, null]
/js/worker.js:84 [Worker] Item 605 - Original Date: 2477, Formatted Date: null
/js/worker.js:86 [Worker] Item 605 - Invalid formatted date: 2477
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 606: (9) ['2478', '3260', '(股)', 90461795, 44.6, 47.95, 44.3, 2.6, null]
/js/worker.js:84 [Worker] Item 606 - Original Date: 2478, Formatted Date: null
/js/worker.js:86 [Worker] Item 606 - Invalid formatted date: 2478
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 607: (9) ['2480', '3260', '(股)', 30697158, 170, 170.5, 168.5, 2, null]
/js/worker.js:84 [Worker] Item 607 - Original Date: 2480, Formatted Date: null
/js/worker.js:86 [Worker] Item 607 - Invalid formatted date: 2480
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 608: (9) ['2481', '3260', '(股)', 2445201859, 73.4, 75.8, 73.4, 2.3, null]
/js/worker.js:84 [Worker] Item 608 - Original Date: 2481, Formatted Date: null
/js/worker.js:86 [Worker] Item 608 - Invalid formatted date: 2481
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 609: (9) ['2482', '3260', '(股)', 1807905, 20.05, 20.35, 19.95, 0, null]
/js/worker.js:84 [Worker] Item 609 - Original Date: 2482, Formatted Date: null
/js/worker.js:86 [Worker] Item 609 - Invalid formatted date: 2482
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 610: (9) ['2483', '3260', '(股)', 775272, 19.8, 19.85, 19.7, 0.1, null]
/js/worker.js:84 [Worker] Item 610 - Original Date: 2483, Formatted Date: null
/js/worker.js:86 [Worker] Item 610 - Invalid formatted date: 2483
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 611: (9) ['2484', '3260', '(股)', 22858500, 21.8, 22.25, 21.7, 0.55, null]
/js/worker.js:84 [Worker] Item 611 - Original Date: 2484, Formatted Date: null
/js/worker.js:86 [Worker] Item 611 - Invalid formatted date: 2484
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 612: (9) ['2485', '3260', '(股)', 59091016, 13.9, 14.6, 13.7, 0.6, null]
/js/worker.js:84 [Worker] Item 612 - Original Date: 2485, Formatted Date: null
/js/worker.js:86 [Worker] Item 612 - Invalid formatted date: 2485
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 613: (9) ['2486', '3260', '(股)', 1216834348, 82.5, 86.9, 82.4, 3.3, null]
/js/worker.js:84 [Worker] Item 613 - Original Date: 2486, Formatted Date: null
/js/worker.js:86 [Worker] Item 613 - Invalid formatted date: 2486
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 614: (9) ['2488', '3260', '(股)', 17823437, 45, 45, 44.75, -0.25, null]
/js/worker.js:84 [Worker] Item 614 - Original Date: 2488, Formatted Date: null
/js/worker.js:86 [Worker] Item 614 - Invalid formatted date: 2488
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 615: (9) ['2489', '3260', '(股)', 30068040, 13.45, 13.65, 13.35, 0.05, null]
/js/worker.js:84 [Worker] Item 615 - Original Date: 2489, Formatted Date: null
/js/worker.js:86 [Worker] Item 615 - Invalid formatted date: 2489
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 616: (9) ['2491', '3260', '(股)', 1404918, 13.15, 13.7, 13, 0.15, null]
/js/worker.js:84 [Worker] Item 616 - Original Date: 2491, Formatted Date: null
/js/worker.js:86 [Worker] Item 616 - Invalid formatted date: 2491
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 617: (9) ['2492', '3260', '(股)', 242476172, 85.2, 87, 84.6, 2.4, null]
/js/worker.js:84 [Worker] Item 617 - Original Date: 2492, Formatted Date: null
/js/worker.js:86 [Worker] Item 617 - Invalid formatted date: 2492
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 618: (9) ['2493', '3260', '(股)', 107825946, 118, 118, 113.5, -2, null]
/js/worker.js:84 [Worker] Item 618 - Original Date: 2493, Formatted Date: null
/js/worker.js:86 [Worker] Item 618 - Invalid formatted date: 2493
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 619: (9) ['2495', '3260', '(股)', 41000494, 21.55, 22.15, 21.45, 0.3, null]
/js/worker.js:84 [Worker] Item 619 - Original Date: 2495, Formatted Date: null
/js/worker.js:86 [Worker] Item 619 - Invalid formatted date: 2495
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 620: (9) ['2496', '3260', '(股)', 1148353, 67.2, 67.6, 66.8, 0.3, null]
/js/worker.js:84 [Worker] Item 620 - Original Date: 2496, Formatted Date: null
/js/worker.js:86 [Worker] Item 620 - Invalid formatted date: 2496
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 621: (9) ['2497', '3260', '(股)', 29510364, 49.25, 49.8, 48.45, -0.6, null]
/js/worker.js:84 [Worker] Item 621 - Original Date: 2497, Formatted Date: null
/js/worker.js:86 [Worker] Item 621 - Invalid formatted date: 2497
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 622: (9) ['2498', '3260', '(股)', 5998464377, 69, 71.9, 68.1, 0.7, null]
/js/worker.js:84 [Worker] Item 622 - Original Date: 2498, Formatted Date: null
/js/worker.js:86 [Worker] Item 622 - Invalid formatted date: 2498
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 623: (9) ['2501', '3260', '(股)', 90496694, 24.15, 24.15, 23.3, -0.4, null]
/js/worker.js:84 [Worker] Item 623 - Original Date: 2501, Formatted Date: null
/js/worker.js:86 [Worker] Item 623 - Invalid formatted date: 2501
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 624: (9) ['2504', '3260', '(股)', 54652408, 36, 36.35, 35.8, 0.15, null]
/js/worker.js:84 [Worker] Item 624 - Original Date: 2504, Formatted Date: null
/js/worker.js:86 [Worker] Item 624 - Invalid formatted date: 2504
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 625: (9) ['2505', '3260', '(股)', 5855794, 19.4, 19.45, 19.05, 0.15, null]
/js/worker.js:84 [Worker] Item 625 - Original Date: 2505, Formatted Date: null
/js/worker.js:86 [Worker] Item 625 - Invalid formatted date: 2505
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 626: (9) ['2506', '3260', '(股)', 1108801, 9.75, 9.84, 9.72, 0, null]
/js/worker.js:84 [Worker] Item 626 - Original Date: 2506, Formatted Date: null
/js/worker.js:86 [Worker] Item 626 - Invalid formatted date: 2506
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 627: (9) ['2509', '3260', '(股)', 7977277, 17.5, 17.85, 17.35, 0.05, null]
/js/worker.js:84 [Worker] Item 627 - Original Date: 2509, Formatted Date: null
/js/worker.js:86 [Worker] Item 627 - Invalid formatted date: 2509
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 628: (9) ['2511', '3260', '(股)', 152265628, 9.27, 9.27, 9.19, 0, null]
/js/worker.js:84 [Worker] Item 628 - Original Date: 2511, Formatted Date: null
/js/worker.js:86 [Worker] Item 628 - Invalid formatted date: 2511
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 629: (9) ['2514', '3260', '(股)', 2586319, 14.9, 15.05, 14.85, 0.25, null]
/js/worker.js:84 [Worker] Item 629 - Original Date: 2514, Formatted Date: null
/js/worker.js:86 [Worker] Item 629 - Invalid formatted date: 2514
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 630: (9) ['2515', '3260', '(股)', 44228138, 11.25, 11.3, 11.1, -0.1, null]
/js/worker.js:84 [Worker] Item 630 - Original Date: 2515, Formatted Date: null
/js/worker.js:86 [Worker] Item 630 - Invalid formatted date: 2515
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 631: (9) ['2516', '3260', '(股)', 7372048, 14.6, 15.15, 14.55, 0.3, null]
/js/worker.js:84 [Worker] Item 631 - Original Date: 2516, Formatted Date: null
/js/worker.js:86 [Worker] Item 631 - Invalid formatted date: 2516
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 632: (9) ['2520', '3260', '(股)', 150514884, 39.05, 39.3, 38.05, -0.8, null]
/js/worker.js:84 [Worker] Item 632 - Original Date: 2520, Formatted Date: null
/js/worker.js:86 [Worker] Item 632 - Invalid formatted date: 2520
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 633: (9) ['2524', '3260', '(股)', 48299994, 51.6, 52.5, 49.3, -2.25, null]
/js/worker.js:84 [Worker] Item 633 - Original Date: 2524, Formatted Date: null
/js/worker.js:86 [Worker] Item 633 - Invalid formatted date: 2524
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 634: (9) ['2527', '3260', '(股)', 4800253, 25.5, 25.6, 25.25, -0.05, null]
/js/worker.js:84 [Worker] Item 634 - Original Date: 2527, Formatted Date: null
/js/worker.js:86 [Worker] Item 634 - Invalid formatted date: 2527
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 635: (9) ['2528', '3260', '(股)', 11739911, 30, 30.25, 29.75, -0.05, null]
/js/worker.js:84 [Worker] Item 635 - Original Date: 2528, Formatted Date: null
/js/worker.js:86 [Worker] Item 635 - Invalid formatted date: 2528
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 636: (9) ['2530', '3260', '(股)', 24942040, 31.55, 31.6, 30.7, -0.25, null]
/js/worker.js:84 [Worker] Item 636 - Original Date: 2530, Formatted Date: null
/js/worker.js:86 [Worker] Item 636 - Invalid formatted date: 2530
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 637: (9) ['2534', '3260', '(股)', 16737547, 22.7, 22.9, 22.1, -0.15, null]
/js/worker.js:84 [Worker] Item 637 - Original Date: 2534, Formatted Date: null
/js/worker.js:86 [Worker] Item 637 - Invalid formatted date: 2534
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 638: (9) ['2535', '3260', '(股)', 14141649, 60.5, 60.9, 60.4, 0.4, null]
/js/worker.js:84 [Worker] Item 638 - Original Date: 2535, Formatted Date: null
/js/worker.js:86 [Worker] Item 638 - Invalid formatted date: 2535
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 639: (9) ['2536', '3260', '(股)', 3332249, 28.45, 28.6, 28.15, -0.3, null]
/js/worker.js:84 [Worker] Item 639 - Original Date: 2536, Formatted Date: null
/js/worker.js:86 [Worker] Item 639 - Invalid formatted date: 2536
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 640: (9) ['2537', '3260', '(股)', 14789151, 11.75, 11.85, 11.45, -0.25, null]
/js/worker.js:84 [Worker] Item 640 - Original Date: 2537, Formatted Date: null
/js/worker.js:86 [Worker] Item 640 - Invalid formatted date: 2537
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 641: (9) ['2538', '3260', '(股)', 7455294, 11.2, 11.25, 11.1, 0, null]
/js/worker.js:84 [Worker] Item 641 - Original Date: 2538, Formatted Date: null
/js/worker.js:86 [Worker] Item 641 - Invalid formatted date: 2538
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 642: (9) ['2539', '3260', '(股)', 45249899, 50.6, 50.7, 49.65, -0.75, null]
/js/worker.js:84 [Worker] Item 642 - Original Date: 2539, Formatted Date: null
/js/worker.js:86 [Worker] Item 642 - Invalid formatted date: 2539
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 643: (9) ['2540', '3260', '(股)', 106527452, 85.4, 85.4, 84.1, 0.8, null]
/js/worker.js:84 [Worker] Item 643 - Original Date: 2540, Formatted Date: null
/js/worker.js:86 [Worker] Item 643 - Invalid formatted date: 2540
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 644: (9) ['2542', '3260', '(股)', 428379605, 46.4, 46.75, 45.75, -0.55, null]
/js/worker.js:84 [Worker] Item 644 - Original Date: 2542, Formatted Date: null
/js/worker.js:86 [Worker] Item 644 - Invalid formatted date: 2542
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 645: (9) ['2543', '3260', '(股)', 288844686, 75, 77.3, 73.3, 0.8, null]
/js/worker.js:84 [Worker] Item 645 - Original Date: 2543, Formatted Date: null
/js/worker.js:86 [Worker] Item 645 - Invalid formatted date: 2543
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 646: (9) ['2545', '3260', '(股)', 45242457, 44.55, 44.9, 43.9, -0.15, null]
/js/worker.js:84 [Worker] Item 646 - Original Date: 2545, Formatted Date: null
/js/worker.js:86 [Worker] Item 646 - Invalid formatted date: 2545
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 647: (9) ['2546', '3260', '(股)', 20031348, 87.5, 88.6, 86.6, -1.8, null]
/js/worker.js:84 [Worker] Item 647 - Original Date: 2546, Formatted Date: null
/js/worker.js:86 [Worker] Item 647 - Invalid formatted date: 2546
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 648: (9) ['2547', '3260', '(股)', 15239684, 11.4, 11.4, 11.2, -0.05, null]
/js/worker.js:84 [Worker] Item 648 - Original Date: 2547, Formatted Date: null
/js/worker.js:86 [Worker] Item 648 - Invalid formatted date: 2547
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 649: (9) ['2548', '3260', '(股)', 89595101, 101.5, 102, 99.8, -0.5, null]
/js/worker.js:84 [Worker] Item 649 - Original Date: 2548, Formatted Date: null
/js/worker.js:86 [Worker] Item 649 - Invalid formatted date: 2548
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 650: (9) ['2597', '3260', '(股)', 28082399, 155, 155, 153, 0.5, null]
/js/worker.js:84 [Worker] Item 650 - Original Date: 2597, Formatted Date: null
/js/worker.js:86 [Worker] Item 650 - Invalid formatted date: 2597
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 651: (9) ['2601', '3260', '(股)', 5804189, 5.89, 5.93, 5.89, 0.07, null]
/js/worker.js:84 [Worker] Item 651 - Original Date: 2601, Formatted Date: null
/js/worker.js:86 [Worker] Item 651 - Invalid formatted date: 2601
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 652: (9) ['2603', '3260', '(股)', 795320215, 185, 185, 183.5, 1, null]
/js/worker.js:84 [Worker] Item 652 - Original Date: 2603, Formatted Date: null
/js/worker.js:86 [Worker] Item 652 - Invalid formatted date: 2603
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 653: (9) ['2605', '3260', '(股)', 66857996, 23.1, 23.55, 23.1, 0.4, null]
/js/worker.js:84 [Worker] Item 653 - Original Date: 2605, Formatted Date: null
/js/worker.js:86 [Worker] Item 653 - Invalid formatted date: 2605
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 654: (9) ['2606', '3260', '(股)', 304433874, 57.1, 58.3, 57.1, 1.4, null]
/js/worker.js:84 [Worker] Item 654 - Original Date: 2606, Formatted Date: null
/js/worker.js:86 [Worker] Item 654 - Invalid formatted date: 2606
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 655: (9) ['2607', '3260', '(股)', 77063621, 34.7, 34.85, 34.3, -0.35, null]
/js/worker.js:84 [Worker] Item 655 - Original Date: 2607, Formatted Date: null
/js/worker.js:86 [Worker] Item 655 - Invalid formatted date: 2607
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 656: (9) ['2608', '3260', '(股)', 3933265, 34.3, 34.4, 34.15, -0.05, null]
/js/worker.js:84 [Worker] Item 656 - Original Date: 2608, Formatted Date: null
/js/worker.js:86 [Worker] Item 656 - Invalid formatted date: 2608
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 657: (9) ['2609', '3260', '(股)', 418798284, 56.2, 56.5, 56, 0, null]
/js/worker.js:84 [Worker] Item 657 - Original Date: 2609, Formatted Date: null
/js/worker.js:86 [Worker] Item 657 - Invalid formatted date: 2609
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 658: (9) ['2610', '3260', '(股)', 261673575, 21.15, 21.25, 20.95, 0.15, null]
/js/worker.js:84 [Worker] Item 658 - Original Date: 2610, Formatted Date: null
/js/worker.js:86 [Worker] Item 658 - Invalid formatted date: 2610
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 659: (9) ['2611', '3260', '(股)', 3195350, 15.8, 15.9, 15.8, 0.15, null]
/js/worker.js:84 [Worker] Item 659 - Original Date: 2611, Formatted Date: null
/js/worker.js:86 [Worker] Item 659 - Invalid formatted date: 2611
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 660: (9) ['2612', '3260', '(股)', 57561058, 55.1, 56, 55.1, 0.8, null]
/js/worker.js:84 [Worker] Item 660 - Original Date: 2612, Formatted Date: null
/js/worker.js:86 [Worker] Item 660 - Invalid formatted date: 2612
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 661: (9) ['2613', '3260', '(股)', 5384027, 26.25, 26.3, 26.05, 0.1, null]
/js/worker.js:84 [Worker] Item 661 - Original Date: 2613, Formatted Date: null
/js/worker.js:86 [Worker] Item 661 - Invalid formatted date: 2613
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 662: (9) ['2614', '3260', '(股)', 31563905, 21.7, 21.95, 21.5, 0.15, null]
/js/worker.js:84 [Worker] Item 662 - Original Date: 2614, Formatted Date: null
/js/worker.js:86 [Worker] Item 662 - Invalid formatted date: 2614
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 663: (9) ['2615', '3260', '(股)', 266699790, 81, 81.1, 80.3, 0.7, null]
/js/worker.js:84 [Worker] Item 663 - Original Date: 2615, Formatted Date: null
/js/worker.js:86 [Worker] Item 663 - Invalid formatted date: 2615
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 664: (9) ['2616', '3260', '(股)', 774651, 14.75, 14.8, 14.65, -0.1, null]
/js/worker.js:84 [Worker] Item 664 - Original Date: 2616, Formatted Date: null
/js/worker.js:86 [Worker] Item 664 - Invalid formatted date: 2616
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 665: (9) ['2617', '3260', '(股)', 12772380, 27.25, 27.4, 27.25, 0.1, null]
/js/worker.js:84 [Worker] Item 665 - Original Date: 2617, Formatted Date: null
/js/worker.js:86 [Worker] Item 665 - Invalid formatted date: 2617
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 666: (9) ['2618', '3260', '(股)', 635022197, 38.9, 39.1, 38.6, 0, null]
/js/worker.js:84 [Worker] Item 666 - Original Date: 2618, Formatted Date: null
/js/worker.js:86 [Worker] Item 666 - Invalid formatted date: 2618
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 667: (9) ['2630', '3260', '(股)', 377067603, 59.8, 60.4, 56.5, -1.8, null]
/js/worker.js:84 [Worker] Item 667 - Original Date: 2630, Formatted Date: null
/js/worker.js:86 [Worker] Item 667 - Invalid formatted date: 2630
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 668: (9) ['2633', '3260', '(股)', 43068817, 27.8, 27.9, 27.8, -0.05, null]
/js/worker.js:84 [Worker] Item 668 - Original Date: 2633, Formatted Date: null
/js/worker.js:86 [Worker] Item 668 - Invalid formatted date: 2633
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 669: (9) ['2634', '3260', '(股)', 1997551794, 63.9, 65.8, 62.2, -0.2, null]
/js/worker.js:84 [Worker] Item 669 - Original Date: 2634, Formatted Date: null
/js/worker.js:86 [Worker] Item 669 - Invalid formatted date: 2634
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 670: (9) ['2636', '3260', '(股)', 12311856, 70.7, 71.2, 70.6, 0.7, null]
/js/worker.js:84 [Worker] Item 670 - Original Date: 2636, Formatted Date: null
/js/worker.js:86 [Worker] Item 670 - Invalid formatted date: 2636
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 671: (9) ['2637', '3260', '(股)', 145494356, 59.4, 60.5, 59.4, 1.3, null]
/js/worker.js:84 [Worker] Item 671 - Original Date: 2637, Formatted Date: null
/js/worker.js:86 [Worker] Item 671 - Invalid formatted date: 2637
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 672: (9) ['2642', '3260', '(股)', 2873080, 28.85, 29.7, 28.85, 0.55, null]
/js/worker.js:84 [Worker] Item 672 - Original Date: 2642, Formatted Date: null
/js/worker.js:86 [Worker] Item 672 - Invalid formatted date: 2642
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 673: (9) ['2645', '3260', '(股)', 1229202146, 179, 180.5, 168.5, -8, null]
/js/worker.js:84 [Worker] Item 673 - Original Date: 2645, Formatted Date: null
/js/worker.js:86 [Worker] Item 673 - Invalid formatted date: 2645
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 674: (9) ['2646', '3260', '(股)', 110577050, 25.15, 25.15, 24.9, -0.1, null]
/js/worker.js:84 [Worker] Item 674 - Original Date: 2646, Formatted Date: null
/js/worker.js:86 [Worker] Item 674 - Invalid formatted date: 2646
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 675: (9) ['2701', '3260', '(股)', 1147313, 11.15, 11.15, 11.1, 0, null]
/js/worker.js:84 [Worker] Item 675 - Original Date: 2701, Formatted Date: null
/js/worker.js:86 [Worker] Item 675 - Invalid formatted date: 2701
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 676: (9) ['2702', '3260', '(股)', 435630, 12.45, 12.5, 12.4, 0, null]
/js/worker.js:84 [Worker] Item 676 - Original Date: 2702, Formatted Date: null
/js/worker.js:86 [Worker] Item 676 - Invalid formatted date: 2702
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 677: (9) ['2704', '3260', '(股)', 3131788, 44.35, 44.8, 44.35, -0.05, null]
/js/worker.js:84 [Worker] Item 677 - Original Date: 2704, Formatted Date: null
/js/worker.js:86 [Worker] Item 677 - Invalid formatted date: 2704
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 678: (9) ['2705', '3260', '(股)', 1332050, 17.2, 17.25, 17.15, -0.05, null]
/js/worker.js:84 [Worker] Item 678 - Original Date: 2705, Formatted Date: null
/js/worker.js:86 [Worker] Item 678 - Invalid formatted date: 2705
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 679: (9) ['2706', '3260', '(股)', 2125017, 13.45, 13.45, 13.4, null, null]
/js/worker.js:84 [Worker] Item 679 - Original Date: 2706, Formatted Date: null
/js/worker.js:86 [Worker] Item 679 - Invalid formatted date: 2706
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 680: (9) ['2707', '3260', '(股)', 28621014, 200, 200, 196.5, -1, null]
/js/worker.js:84 [Worker] Item 680 - Original Date: 2707, Formatted Date: null
/js/worker.js:86 [Worker] Item 680 - Invalid formatted date: 2707
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 681: (9) ['2712', '3260', '(股)', 186884, 20.2, 20.2, 20, -0.2, null]
/js/worker.js:84 [Worker] Item 681 - Original Date: 2712, Formatted Date: null
/js/worker.js:86 [Worker] Item 681 - Invalid formatted date: 2712
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 682: (9) ['2722', '3260', '(股)', 861297, 28.9, 28.9, 28.5, 0, null]
/js/worker.js:84 [Worker] Item 682 - Original Date: 2722, Formatted Date: null
/js/worker.js:86 [Worker] Item 682 - Invalid formatted date: 2722
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 683: (9) ['2723', '3260', '(股)', 29863694, 76.2, 76.2, 75.3, 0, null]
/js/worker.js:84 [Worker] Item 683 - Original Date: 2723, Formatted Date: null
/js/worker.js:86 [Worker] Item 683 - Invalid formatted date: 2723
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 684: (9) ['2727', '3260', '(股)', 52906021, 232.5, 232.5, 230, -0.5, null]
/js/worker.js:84 [Worker] Item 684 - Original Date: 2727, Formatted Date: null
/js/worker.js:86 [Worker] Item 684 - Invalid formatted date: 2727
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 685: (9) ['2731', '3260', '(股)', 58359807, 159.5, 160.5, 158.5, 1.5, null]
/js/worker.js:84 [Worker] Item 685 - Original Date: 2731, Formatted Date: null
/js/worker.js:86 [Worker] Item 685 - Invalid formatted date: 2731
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 686: (9) ['2739', '3260', '(股)', 3815428, 37.7, 38.25, 37.7, 0.55, null]
/js/worker.js:84 [Worker] Item 686 - Original Date: 2739, Formatted Date: null
/js/worker.js:86 [Worker] Item 686 - Invalid formatted date: 2739
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 687: (9) ['2748', '3260', '(股)', 4417844, 46.85, 47.1, 46.6, 0.2, null]
/js/worker.js:84 [Worker] Item 687 - Original Date: 2748, Formatted Date: null
/js/worker.js:86 [Worker] Item 687 - Invalid formatted date: 2748
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 688: (9) ['2753', '3260', '(股)', 34634262, 201, 202.5, 199, 1.5, null]
/js/worker.js:84 [Worker] Item 688 - Original Date: 2753, Formatted Date: null
/js/worker.js:86 [Worker] Item 688 - Invalid formatted date: 2753
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 689: (9) ['2762', '3260', '(股)', 1054443, 76.3, 76.3, 75.8, -0.2, null]
/js/worker.js:84 [Worker] Item 689 - Original Date: 2762, Formatted Date: null
/js/worker.js:86 [Worker] Item 689 - Invalid formatted date: 2762
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 690: (9) ['2801', '3260', '(股)', 329356154, 19.4, 19.45, 19.25, -0.05, null]
/js/worker.js:84 [Worker] Item 690 - Original Date: 2801, Formatted Date: null
/js/worker.js:86 [Worker] Item 690 - Invalid formatted date: 2801
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 691: (9) ['2812', '3260', '(股)', 91581067, 22.25, 22.35, 22.1, 0.15, null]
/js/worker.js:84 [Worker] Item 691 - Original Date: 2812, Formatted Date: null
/js/worker.js:86 [Worker] Item 691 - Invalid formatted date: 2812
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 692: (9) ['2816', '3260', '(股)', 1475565, 26.4, 26.8, 26.4, 0.3, null]
/js/worker.js:84 [Worker] Item 692 - Original Date: 2816, Formatted Date: null
/js/worker.js:86 [Worker] Item 692 - Invalid formatted date: 2816
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 693: (9) ['2820', '3260', '(股)', 14315932, 16.35, 16.35, 16.25, 0, null]
/js/worker.js:84 [Worker] Item 693 - Original Date: 2820, Formatted Date: null
/js/worker.js:86 [Worker] Item 693 - Invalid formatted date: 2820
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 694: (9) ['2832', '3260', '(股)', 13323850, 34.95, 35.2, 34.65, -0.2, null]
/js/worker.js:84 [Worker] Item 694 - Original Date: 2832, Formatted Date: null
/js/worker.js:86 [Worker] Item 694 - Invalid formatted date: 2832
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 695: (9) ['2834', '3260', '(股)', 145331419, 15.4, 15.4, 15.3, 0.1, null]
/js/worker.js:84 [Worker] Item 695 - Original Date: 2834, Formatted Date: null
/js/worker.js:86 [Worker] Item 695 - Invalid formatted date: 2834
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 696: (9) ['2836', '3260', '(股)', 3809163, 11.85, 11.9, 11.75, 0, null]
/js/worker.js:84 [Worker] Item 696 - Original Date: 2836, Formatted Date: null
/js/worker.js:86 [Worker] Item 696 - Invalid formatted date: 2836
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 697: (9) ['2836A', '3260', '(股)', 0, 0, 0, 0, 0, null]
/js/worker.js:84 [Worker] Item 697 - Original Date: 2836A, Formatted Date: null
/js/worker.js:86 [Worker] Item 697 - Invalid formatted date: 2836A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 698: (9) ['2838', '3260', '(股)', 21479345, 17.5, 17.55, 17.25, 0, null]
/js/worker.js:84 [Worker] Item 698 - Original Date: 2838, Formatted Date: null
/js/worker.js:86 [Worker] Item 698 - Invalid formatted date: 2838
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 699: (9) ['2838A', '3260', '(股)', 7951786, 54.2, 54.7, 54.2, 0.1, null]
/js/worker.js:84 [Worker] Item 699 - Original Date: 2838A, Formatted Date: null
/js/worker.js:86 [Worker] Item 699 - Invalid formatted date: 2838A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 700: (9) ['2845', '3260', '(股)', 109299594, 12.3, 12.3, 12.2, 0, null]
/js/worker.js:84 [Worker] Item 700 - Original Date: 2845, Formatted Date: null
/js/worker.js:86 [Worker] Item 700 - Invalid formatted date: 2845
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 701: (9) ['2849', '3260', '(股)', 695810, 13.2, 13.2, 13.15, 0, null]
/js/worker.js:84 [Worker] Item 701 - Original Date: 2849, Formatted Date: null
/js/worker.js:86 [Worker] Item 701 - Invalid formatted date: 2849
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 702: (9) ['2850', '3260', '(股)', 48811987, 111.5, 112.5, 110.5, 0, null]
/js/worker.js:84 [Worker] Item 702 - Original Date: 2850, Formatted Date: null
/js/worker.js:86 [Worker] Item 702 - Invalid formatted date: 2850
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 703: (9) ['2851', '3260', '(股)', 11768439, 23.8, 23.8, 23.65, 0, null]
/js/worker.js:84 [Worker] Item 703 - Original Date: 2851, Formatted Date: null
/js/worker.js:86 [Worker] Item 703 - Invalid formatted date: 2851
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 704: (9) ['2852', '3260', '(股)', 5043806, 26.75, 26.9, 26.7, -0.05, null]
/js/worker.js:84 [Worker] Item 704 - Original Date: 2852, Formatted Date: null
/js/worker.js:86 [Worker] Item 704 - Invalid formatted date: 2852
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 705: (9) ['2855', '3260', '(股)', 45633332, 22.35, 22.75, 22.35, 0.4, null]
/js/worker.js:84 [Worker] Item 705 - Original Date: 2855, Formatted Date: null
/js/worker.js:86 [Worker] Item 705 - Invalid formatted date: 2855
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 706: (9) ['2867', '3260', '(股)', 53048578, 5.84, 5.85, 5.76, -0.05, null]
/js/worker.js:84 [Worker] Item 706 - Original Date: 2867, Formatted Date: null
/js/worker.js:86 [Worker] Item 706 - Invalid formatted date: 2867
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 707: (9) ['2880', '3260', '(股)', 358400381, 29.4, 29.55, 29.25, 0.3, null]
/js/worker.js:84 [Worker] Item 707 - Original Date: 2880, Formatted Date: null
/js/worker.js:86 [Worker] Item 707 - Invalid formatted date: 2880
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 708: (9) ['2881', '3260', '(股)', 1295408048, 89, 89.2, 87.8, -0.4, null]
/js/worker.js:84 [Worker] Item 708 - Original Date: 2881, Formatted Date: null
/js/worker.js:86 [Worker] Item 708 - Invalid formatted date: 2881
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 709: (9) ['2881A', '3260', '(股)', 1255511, 63.2, 63.2, 63.1, 0, null]
/js/worker.js:84 [Worker] Item 709 - Original Date: 2881A, Formatted Date: null
/js/worker.js:86 [Worker] Item 709 - Invalid formatted date: 2881A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 710: (9) ['2881B', '3260', '(股)', 1228359, 61.7, 61.9, 61.7, 0.2, null]
/js/worker.js:84 [Worker] Item 710 - Original Date: 2881B, Formatted Date: null
/js/worker.js:86 [Worker] Item 710 - Invalid formatted date: 2881B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 711: (9) ['2881C', '3260', '(股)', 472954, 53.9, 54, 53.9, 0, null]
/js/worker.js:84 [Worker] Item 711 - Original Date: 2881C, Formatted Date: null
/js/worker.js:86 [Worker] Item 711 - Invalid formatted date: 2881C
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 712: (9) ['2882', '3260', '(股)', 999886194, 65.6, 65.6, 64.5, -0.7, null]
/js/worker.js:84 [Worker] Item 712 - Original Date: 2882, Formatted Date: null
/js/worker.js:86 [Worker] Item 712 - Invalid formatted date: 2882
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 713: (9) ['2882A', '3260', '(股)', 610929, 61, 61, 61, 0, null]
/js/worker.js:84 [Worker] Item 713 - Original Date: 2882A, Formatted Date: null
/js/worker.js:86 [Worker] Item 713 - Invalid formatted date: 2882A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 714: (9) ['2882B', '3260', '(股)', 3849980, 60, 60.2, 60, -0.1, null]
/js/worker.js:84 [Worker] Item 714 - Original Date: 2882B, Formatted Date: null
/js/worker.js:86 [Worker] Item 714 - Invalid formatted date: 2882B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 715: (9) ['2883', '3260', '(股)', 360364331, 15.2, 15.2, 15.1, 0.05, null]
/js/worker.js:84 [Worker] Item 715 - Original Date: 2883, Formatted Date: null
/js/worker.js:86 [Worker] Item 715 - Invalid formatted date: 2883
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 716: (9) ['2883B', '3260', '(股)', 5390976, 7.72, 7.72, 7.7, -0.01, null]
/js/worker.js:84 [Worker] Item 716 - Original Date: 2883B, Formatted Date: null
/js/worker.js:86 [Worker] Item 716 - Invalid formatted date: 2883B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 717: (9) ['2884', '3260', '(股)', 784186285, 33.25, 33.35, 33, 0.2, null]
/js/worker.js:84 [Worker] Item 717 - Original Date: 2884, Formatted Date: null
/js/worker.js:86 [Worker] Item 717 - Invalid formatted date: 2884
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 718: (9) ['2885', '3260', '(股)', 600088467, 34.3, 34.6, 33.9, 0.3, null]
/js/worker.js:84 [Worker] Item 718 - Original Date: 2885, Formatted Date: null
/js/worker.js:86 [Worker] Item 718 - Invalid formatted date: 2885
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 719: (9) ['2886', '3260', '(股)', 489933377, 41.4, 41.45, 40.95, 0.2, null]
/js/worker.js:84 [Worker] Item 719 - Original Date: 2886, Formatted Date: null
/js/worker.js:86 [Worker] Item 719 - Invalid formatted date: 2886
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 720: (9) ['2887', '3260', '(股)', 864026285, 17.4, 17.55, 17.25, 0.2, null]
/js/worker.js:84 [Worker] Item 720 - Original Date: 2887, Formatted Date: null
/js/worker.js:86 [Worker] Item 720 - Invalid formatted date: 2887
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 721: (9) ['2887E', '3260', '(股)', 2185621, 48.65, 48.65, 48.55, 0, null]
/js/worker.js:84 [Worker] Item 721 - Original Date: 2887E, Formatted Date: null
/js/worker.js:86 [Worker] Item 721 - Invalid formatted date: 2887E
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 722: (9) ['2887F', '3260', '(股)', 530212, 44.5, 44.5, 44.45, -0.05, null]
/js/worker.js:84 [Worker] Item 722 - Original Date: 2887F, Formatted Date: null
/js/worker.js:86 [Worker] Item 722 - Invalid formatted date: 2887F
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 723: (9) ['2887G', '3260', '(股)', 944090, 36.55, 36.55, 36.5, 0, null]
/js/worker.js:84 [Worker] Item 723 - Original Date: 2887G, Formatted Date: null
/js/worker.js:86 [Worker] Item 723 - Invalid formatted date: 2887G
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 724: (9) ['2887H', '3260', '(股)', 3113884, 36.6, 36.6, 36.5, 0.05, null]
/js/worker.js:84 [Worker] Item 724 - Original Date: 2887H, Formatted Date: null
/js/worker.js:86 [Worker] Item 724 - Invalid formatted date: 2887H
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 725: (9) ['2887I', '3260', '(股)', 221556470, 9.24, 9.26, 9.24, 0.01, null]
/js/worker.js:84 [Worker] Item 725 - Original Date: 2887I, Formatted Date: null
/js/worker.js:86 [Worker] Item 725 - Invalid formatted date: 2887I
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 726: (9) ['2887Z1', '3260', '(股)', 5627839, 15.95, 15.95, 15.9, -0.1, null]
/js/worker.js:84 [Worker] Item 726 - Original Date: 2887Z1, Formatted Date: null
/js/worker.js:86 [Worker] Item 726 - Invalid formatted date: 2887Z1
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 727: (9) ['2889', '3260', '(股)', 51099019, 15.15, 15.2, 14.9, 0, null]
/js/worker.js:84 [Worker] Item 727 - Original Date: 2889, Formatted Date: null
/js/worker.js:86 [Worker] Item 727 - Invalid formatted date: 2889
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 728: (9) ['2890', '3260', '(股)', 866915727, 24.75, 24.85, 24.45, 0.35, null]
/js/worker.js:84 [Worker] Item 728 - Original Date: 2890, Formatted Date: null
/js/worker.js:86 [Worker] Item 728 - Invalid formatted date: 2890
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 729: (9) ['2891', '3260', '(股)', 979002681, 43.35, 43.45, 42.95, 0.05, null]
/js/worker.js:84 [Worker] Item 729 - Original Date: 2891, Formatted Date: null
/js/worker.js:86 [Worker] Item 729 - Invalid formatted date: 2891
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 730: (9) ['2891B', '3260', '(股)', 739718, 63.2, 63.3, 63.2, 0, null]
/js/worker.js:84 [Worker] Item 730 - Original Date: 2891B, Formatted Date: null
/js/worker.js:86 [Worker] Item 730 - Invalid formatted date: 2891B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 731: (9) ['2891C', '3260', '(股)', 210925, 59.9, 60.3, 59.9, 0, null]
/js/worker.js:84 [Worker] Item 731 - Original Date: 2891C, Formatted Date: null
/js/worker.js:86 [Worker] Item 731 - Invalid formatted date: 2891C
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 732: (9) ['2892', '3260', '(股)', 326531546, 29.55, 29.65, 29.4, 0.2, null]
/js/worker.js:84 [Worker] Item 732 - Original Date: 2892, Formatted Date: null
/js/worker.js:86 [Worker] Item 732 - Invalid formatted date: 2892
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 733: (9) ['2897', '3260', '(股)', 14126550, 9.07, 9.07, 9.03, -0.01, null]
/js/worker.js:84 [Worker] Item 733 - Original Date: 2897, Formatted Date: null
/js/worker.js:86 [Worker] Item 733 - Invalid formatted date: 2897
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 734: (9) ['2897B', '3260', '(股)', 28057, 11.95, 11.95, 11.95, 0.05, null]
/js/worker.js:84 [Worker] Item 734 - Original Date: 2897B, Formatted Date: null
/js/worker.js:86 [Worker] Item 734 - Invalid formatted date: 2897B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 735: (9) ['2901', '3260', '(股)', 173048, 25.4, 25.65, 25.35, -0.05, null]
/js/worker.js:84 [Worker] Item 735 - Original Date: 2901, Formatted Date: null
/js/worker.js:86 [Worker] Item 735 - Invalid formatted date: 2901
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 736: (9) ['2903', '3260', '(股)', 42439306, 22.2, 22.35, 22.05, -0.05, null]
/js/worker.js:84 [Worker] Item 736 - Original Date: 2903, Formatted Date: null
/js/worker.js:86 [Worker] Item 736 - Invalid formatted date: 2903
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 737: (9) ['2904', '3260', '(股)', 558521, 17.4, 17.5, 17.4, 0, null]
/js/worker.js:84 [Worker] Item 737 - Original Date: 2904, Formatted Date: null
/js/worker.js:86 [Worker] Item 737 - Invalid formatted date: 2904
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 738: (9) ['2905', '3260', '(股)', 8934354, 12.4, 12.55, 12.15, -0.05, null]
/js/worker.js:84 [Worker] Item 738 - Original Date: 2905, Formatted Date: null
/js/worker.js:86 [Worker] Item 738 - Invalid formatted date: 2905
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 739: (9) ['2906', '3260', '(股)', 834337, 14.55, 14.6, 14.5, 0.1, null]
/js/worker.js:84 [Worker] Item 739 - Original Date: 2906, Formatted Date: null
/js/worker.js:86 [Worker] Item 739 - Invalid formatted date: 2906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 740: (9) ['2908', '3260', '(股)', 6100881, 19.9, 19.9, 19.8, 0, null]
/js/worker.js:84 [Worker] Item 740 - Original Date: 2908, Formatted Date: null
/js/worker.js:86 [Worker] Item 740 - Invalid formatted date: 2908
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 741: (9) ['2910', '3260', '(股)', 41600, 20.8, 20.8, 20.8, 0.05, null]
/js/worker.js:84 [Worker] Item 741 - Original Date: 2910, Formatted Date: null
/js/worker.js:86 [Worker] Item 741 - Invalid formatted date: 2910
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 742: (9) ['2911', '3260', '(股)', 174175, 5.15, 5.25, 5.09, 0.05, null]
/js/worker.js:84 [Worker] Item 742 - Original Date: 2911, Formatted Date: null
/js/worker.js:86 [Worker] Item 742 - Invalid formatted date: 2911
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 743: (9) ['2912', '3260', '(股)', 190949346, 251, 251.5, 250, 0.5, null]
/js/worker.js:84 [Worker] Item 743 - Original Date: 2912, Formatted Date: null
/js/worker.js:86 [Worker] Item 743 - Invalid formatted date: 2912
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 744: (9) ['2913', '3260', '(股)', 16615238, 14.5, 14.6, 14.4, 0.2, null]
/js/worker.js:84 [Worker] Item 744 - Original Date: 2913, Formatted Date: null
/js/worker.js:86 [Worker] Item 744 - Invalid formatted date: 2913
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 745: (9) ['2915', '3260', '(股)', 83451228, 54, 54.3, 53.7, 0.3, null]
/js/worker.js:84 [Worker] Item 745 - Original Date: 2915, Formatted Date: null
/js/worker.js:86 [Worker] Item 745 - Invalid formatted date: 2915
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 746: (9) ['2923', '3260', '(股)', 1309240, 22.05, 22.05, 21.85, -0.1, null]
/js/worker.js:84 [Worker] Item 746 - Original Date: 2923, Formatted Date: null
/js/worker.js:86 [Worker] Item 746 - Invalid formatted date: 2923
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 747: (9) ['2929', '3260', '(股)', 2750410, 9.2, 9.46, 9.2, 0.17, null]
/js/worker.js:84 [Worker] Item 747 - Original Date: 2929, Formatted Date: null
/js/worker.js:86 [Worker] Item 747 - Invalid formatted date: 2929
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 748: (9) ['2939', '3260', '(股)', 54452, 27.2, 27.2, 27.2, 0.95, null]
/js/worker.js:84 [Worker] Item 748 - Original Date: 2939, Formatted Date: null
/js/worker.js:86 [Worker] Item 748 - Invalid formatted date: 2939
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 749: (9) ['2945', '3260', '(股)', 90815, 37.7, 37.8, 37.7, -0.35, null]
/js/worker.js:84 [Worker] Item 749 - Original Date: 2945, Formatted Date: null
/js/worker.js:86 [Worker] Item 749 - Invalid formatted date: 2945
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 750: (9) ['3002', '3260', '(股)', 3045217, 16.2, 16.25, 15.95, -0.2, null]
/js/worker.js:84 [Worker] Item 750 - Original Date: 3002, Formatted Date: null
/js/worker.js:86 [Worker] Item 750 - Invalid formatted date: 3002
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 751: (9) ['3003', '3260', '(股)', 21802704, 52, 52.6, 51.5, 0.1, null]
/js/worker.js:84 [Worker] Item 751 - Original Date: 3003, Formatted Date: null
/js/worker.js:86 [Worker] Item 751 - Invalid formatted date: 3003
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 752: (9) ['3004', '3260', '(股)', 172685635, 136, 136, 131, -2.5, null]
/js/worker.js:84 [Worker] Item 752 - Original Date: 3004, Formatted Date: null
/js/worker.js:86 [Worker] Item 752 - Invalid formatted date: 3004
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 753: (9) ['3005', '3260', '(股)', 706077794, 157, 160, 156, 3.5, null]
/js/worker.js:84 [Worker] Item 753 - Original Date: 3005, Formatted Date: null
/js/worker.js:86 [Worker] Item 753 - Invalid formatted date: 3005
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 754: (9) ['3006', '3260', '(股)', 3286534558, 68.5, 73.7, 68.1, 5.6, null]
/js/worker.js:84 [Worker] Item 754 - Original Date: 3006, Formatted Date: null
/js/worker.js:86 [Worker] Item 754 - Invalid formatted date: 3006
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 755: (9) ['3008', '3260', '(股)', 1236820830, 2310, 2335, 2300, 15, null]
/js/worker.js:84 [Worker] Item 755 - Original Date: 3008, Formatted Date: null
/js/worker.js:86 [Worker] Item 755 - Invalid formatted date: 3008
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 756: (9) ['3010', '3260', '(股)', 44428915, 97.3, 98.3, 97, 1.2, null]
/js/worker.js:84 [Worker] Item 756 - Original Date: 3010, Formatted Date: null
/js/worker.js:86 [Worker] Item 756 - Invalid formatted date: 3010
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 757: (9) ['3011', '3260', '(股)', 11934706, 15.85, 15.9, 15.45, 0.2, null]
/js/worker.js:84 [Worker] Item 757 - Original Date: 3011, Formatted Date: null
/js/worker.js:86 [Worker] Item 757 - Invalid formatted date: 3011
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 758: (9) ['3013', '3260', '(股)', 268102101, 123, 125.5, 123, 3, null]
/js/worker.js:84 [Worker] Item 758 - Original Date: 3013, Formatted Date: null
/js/worker.js:86 [Worker] Item 758 - Invalid formatted date: 3013
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 759: (9) ['3014', '3260', '(股)', 116594211, 132, 135, 132, 2, null]
/js/worker.js:84 [Worker] Item 759 - Original Date: 3014, Formatted Date: null
/js/worker.js:86 [Worker] Item 759 - Invalid formatted date: 3014
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 760: (9) ['3015', '3260', '(股)', 10387709, 54.3, 54.4, 53.8, 0.4, null]
/js/worker.js:84 [Worker] Item 760 - Original Date: 3015, Formatted Date: null
/js/worker.js:86 [Worker] Item 760 - Invalid formatted date: 3015
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 761: (9) ['3016', '3260', '(股)', 3129556233, 59.6, 61.5, 56, 2.1, null]
/js/worker.js:84 [Worker] Item 761 - Original Date: 3016, Formatted Date: null
/js/worker.js:86 [Worker] Item 761 - Invalid formatted date: 3016
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 762: (9) ['3017', '3260', '(股)', 8317369060, 1015, 1065, 1000, 50, null]
/js/worker.js:84 [Worker] Item 762 - Original Date: 3017, Formatted Date: null
/js/worker.js:86 [Worker] Item 762 - Invalid formatted date: 3017
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 763: (9) ['3018', '3260', '(股)', 103018, 14.1, 14.1, 14.1, -0.1, null]
/js/worker.js:84 [Worker] Item 763 - Original Date: 3018, Formatted Date: null
/js/worker.js:86 [Worker] Item 763 - Invalid formatted date: 3018
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 764: (9) ['3019', '3260', '(股)', 643174594, 159, 160, 157.5, 0.5, null]
/js/worker.js:84 [Worker] Item 764 - Original Date: 3019, Formatted Date: null
/js/worker.js:86 [Worker] Item 764 - Invalid formatted date: 3019
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 765: (9) ['3021', '3260', '(股)', 2205048, 17.95, 18.35, 17.95, 0.25, null]
/js/worker.js:84 [Worker] Item 765 - Original Date: 3021, Formatted Date: null
/js/worker.js:86 [Worker] Item 765 - Invalid formatted date: 3021
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 766: (9) ['3022', '3260', '(股)', 34921593, 67.8, 68.2, 67.4, 0.5, null]
/js/worker.js:84 [Worker] Item 766 - Original Date: 3022, Formatted Date: null
/js/worker.js:86 [Worker] Item 766 - Invalid formatted date: 3022
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 767: (9) ['3023', '3260', '(股)', 480806129, 235, 237, 234, 1, null]
/js/worker.js:84 [Worker] Item 767 - Original Date: 3023, Formatted Date: null
/js/worker.js:86 [Worker] Item 767 - Invalid formatted date: 3023
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 768: (9) ['3024', '3260', '(股)', 17159741, 13.6, 13.6, 13.4, 0.05, null]
/js/worker.js:84 [Worker] Item 768 - Original Date: 3024, Formatted Date: null
/js/worker.js:86 [Worker] Item 768 - Invalid formatted date: 3024
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 769: (9) ['3025', '3260', '(股)', 17488472, 44.35, 44.9, 43.85, 0.15, null]
/js/worker.js:84 [Worker] Item 769 - Original Date: 3025, Formatted Date: null
/js/worker.js:86 [Worker] Item 769 - Invalid formatted date: 3025
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 770: (9) ['3026', '3260', '(股)', 52054759, 89.5, 89.5, 88.5, 0.7, null]
/js/worker.js:84 [Worker] Item 770 - Original Date: 3026, Formatted Date: null
/js/worker.js:86 [Worker] Item 770 - Invalid formatted date: 3026
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 771: (9) ['3027', '3260', '(股)', 23097420, 26.2, 27.6, 26.2, 1.4, null]
/js/worker.js:84 [Worker] Item 771 - Original Date: 3027, Formatted Date: null
/js/worker.js:86 [Worker] Item 771 - Invalid formatted date: 3027
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 772: (9) ['3028', '3260', '(股)', 14782588, 31.2, 32, 31.2, 0.5, null]
/js/worker.js:84 [Worker] Item 772 - Original Date: 3028, Formatted Date: null
/js/worker.js:86 [Worker] Item 772 - Invalid formatted date: 3028
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 773: (9) ['3029', '3260', '(股)', 167888070, 124, 125.5, 123, 2.5, null]
/js/worker.js:84 [Worker] Item 773 - Original Date: 3029, Formatted Date: null
/js/worker.js:86 [Worker] Item 773 - Invalid formatted date: 3029
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 774: (9) ['3030', '3260', '(股)', 586874875, 186.5, 188, 179.5, -2, null]
/js/worker.js:84 [Worker] Item 774 - Original Date: 3030, Formatted Date: null
/js/worker.js:86 [Worker] Item 774 - Invalid formatted date: 3030
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 775: (9) ['3031', '3260', '(股)', 24897049, 20.95, 21.25, 20.45, 0.35, null]
/js/worker.js:84 [Worker] Item 775 - Original Date: 3031, Formatted Date: null
/js/worker.js:86 [Worker] Item 775 - Invalid formatted date: 3031
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 776: (9) ['3032', '3260', '(股)', 169974919, 98.4, 102, 97.4, -0.6, null]
/js/worker.js:84 [Worker] Item 776 - Original Date: 3032, Formatted Date: null
/js/worker.js:86 [Worker] Item 776 - Invalid formatted date: 3032
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 777: (9) ['3033', '3260', '(股)', 41152023, 28.4, 28.8, 28.4, 0.35, null]
/js/worker.js:84 [Worker] Item 777 - Original Date: 3033, Formatted Date: null
/js/worker.js:86 [Worker] Item 777 - Invalid formatted date: 3033
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 778: (9) ['3034', '3260', '(股)', 2445820958, 426, 444, 426, 14.5, null]
/js/worker.js:84 [Worker] Item 778 - Original Date: 3034, Formatted Date: null
/js/worker.js:86 [Worker] Item 778 - Invalid formatted date: 3034
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 779: (9) ['3035', '3260', '(股)', 673588105, 151, 156, 149.5, 4, null]
/js/worker.js:84 [Worker] Item 779 - Original Date: 3035, Formatted Date: null
/js/worker.js:86 [Worker] Item 779 - Invalid formatted date: 3035
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 780: (9) ['3036', '3260', '(股)', 1064237083, 128, 134.5, 128, 6.5, null]
/js/worker.js:84 [Worker] Item 780 - Original Date: 3036, Formatted Date: null
/js/worker.js:86 [Worker] Item 780 - Invalid formatted date: 3036
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 781: (9) ['3036A', '3260', '(股)', 5713300, 50.7, 50.7, 50.5, -0.1, null]
/js/worker.js:84 [Worker] Item 781 - Original Date: 3036A, Formatted Date: null
/js/worker.js:86 [Worker] Item 781 - Invalid formatted date: 3036A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 782: (9) ['3037', '3260', '(股)', 4117125181, 150, 150, 145, 1, null]
/js/worker.js:84 [Worker] Item 782 - Original Date: 3037, Formatted Date: null
/js/worker.js:86 [Worker] Item 782 - Invalid formatted date: 3037
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 783: (9) ['3038', '3260', '(股)', 12597144, 22.1, 22.6, 22, 0.55, null]
/js/worker.js:84 [Worker] Item 783 - Original Date: 3038, Formatted Date: null
/js/worker.js:86 [Worker] Item 783 - Invalid formatted date: 3038
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 784: (9) ['3040', '3260', '(股)', 63961999, 65.3, 68, 63.7, -1.7, null]
/js/worker.js:84 [Worker] Item 784 - Original Date: 3040, Formatted Date: null
/js/worker.js:86 [Worker] Item 784 - Invalid formatted date: 3040
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 785: (9) ['3041', '3260', '(股)', 88697475, 27.8, 30.35, 27.65, 2.75, null]
/js/worker.js:84 [Worker] Item 785 - Original Date: 3041, Formatted Date: null
/js/worker.js:86 [Worker] Item 785 - Invalid formatted date: 3041
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 786: (9) ['3042', '3260', '(股)', 234946849, 90, 91.3, 88.8, 1.1, null]
/js/worker.js:84 [Worker] Item 786 - Original Date: 3042, Formatted Date: null
/js/worker.js:86 [Worker] Item 786 - Invalid formatted date: 3042
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 787: (9) ['3043', '3260', '(股)', 1953188, 24.6, 25.05, 24.5, -0.1, null]
/js/worker.js:84 [Worker] Item 787 - Original Date: 3043, Formatted Date: null
/js/worker.js:86 [Worker] Item 787 - Invalid formatted date: 3043
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 788: (9) ['3044', '3260', '(股)', 892853425, 300.5, 302, 296, 2.5, null]
/js/worker.js:84 [Worker] Item 788 - Original Date: 3044, Formatted Date: null
/js/worker.js:86 [Worker] Item 788 - Invalid formatted date: 3044
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 789: (9) ['3045', '3260', '(股)', 584413055, 106.5, 106.5, 106, 0.5, null]
/js/worker.js:84 [Worker] Item 789 - Original Date: 3045, Formatted Date: null
/js/worker.js:86 [Worker] Item 789 - Invalid formatted date: 3045
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 790: (9) ['3046', '3260', '(股)', 6762563, 43.65, 44.3, 43.5, 0.55, null]
/js/worker.js:84 [Worker] Item 790 - Original Date: 3046, Formatted Date: null
/js/worker.js:86 [Worker] Item 790 - Invalid formatted date: 3046
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 791: (9) ['3047', '3260', '(股)', 43266451, 19.75, 20.3, 19.75, 0.2, null]
/js/worker.js:84 [Worker] Item 791 - Original Date: 3047, Formatted Date: null
/js/worker.js:86 [Worker] Item 791 - Invalid formatted date: 3047
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 792: (9) ['3048', '3260', '(股)', 511308191, 40.15, 40.15, 37.3, -2.4, null]
/js/worker.js:84 [Worker] Item 792 - Original Date: 3048, Formatted Date: null
/js/worker.js:86 [Worker] Item 792 - Invalid formatted date: 3048
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 793: (9) ['3049', '3260', '(股)', 11429193, 6.16, 6.48, 6.15, 0.3, null]
/js/worker.js:84 [Worker] Item 793 - Original Date: 3049, Formatted Date: null
/js/worker.js:86 [Worker] Item 793 - Invalid formatted date: 3049
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 794: (9) ['3050', '3260', '(股)', 18892942, 12.6, 13.45, 12.6, 0.55, null]
/js/worker.js:84 [Worker] Item 794 - Original Date: 3050, Formatted Date: null
/js/worker.js:86 [Worker] Item 794 - Invalid formatted date: 3050
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 795: (9) ['3051', '3260', '(股)', 8582454, 23.2, 23.8, 23.1, 0.3, null]
/js/worker.js:84 [Worker] Item 795 - Original Date: 3051, Formatted Date: null
/js/worker.js:86 [Worker] Item 795 - Invalid formatted date: 3051
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 796: (9) ['3052', '3260', '(股)', 5056807, 11.4, 11.45, 11.35, 0.1, null]
/js/worker.js:84 [Worker] Item 796 - Original Date: 3052, Formatted Date: null
/js/worker.js:86 [Worker] Item 796 - Invalid formatted date: 3052
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 797: (9) ['3054', '3260', '(股)', 24773, 24.7, 24.7, 24.7, 0, null]
/js/worker.js:84 [Worker] Item 797 - Original Date: 3054, Formatted Date: null
/js/worker.js:86 [Worker] Item 797 - Invalid formatted date: 3054
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 798: (9) ['3055', '3260', '(股)', 168843258, 56.1, 60.9, 56.1, 3.8, null]
/js/worker.js:84 [Worker] Item 798 - Original Date: 3055, Formatted Date: null
/js/worker.js:86 [Worker] Item 798 - Invalid formatted date: 3055
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 799: (9) ['3056', '3260', '(股)', 56415337, 21.1, 21.1, 20.7, -0.15, null]
/js/worker.js:84 [Worker] Item 799 - Original Date: 3056, Formatted Date: null
/js/worker.js:86 [Worker] Item 799 - Invalid formatted date: 3056
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 800: (9) ['3057', '3260', '(股)', 1453580, 9.58, 9.75, 9.5, 0.14, null]
/js/worker.js:84 [Worker] Item 800 - Original Date: 3057, Formatted Date: null
/js/worker.js:86 [Worker] Item 800 - Invalid formatted date: 3057
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 801: (9) ['3058', '3260', '(股)', 18557663, 12.1, 12.5, 11.9, 0.35, null]
/js/worker.js:84 [Worker] Item 801 - Original Date: 3058, Formatted Date: null
/js/worker.js:86 [Worker] Item 801 - Invalid formatted date: 3058
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 802: (9) ['3059', '3260', '(股)', 1243167920, 56, 56.6, 52.6, -2.4, null]
/js/worker.js:84 [Worker] Item 802 - Original Date: 3059, Formatted Date: null
/js/worker.js:86 [Worker] Item 802 - Invalid formatted date: 3059
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 803: (9) ['3060', '3260', '(股)', 421309876, 25.6, 25.6, 24.2, 1.4, null]
/js/worker.js:84 [Worker] Item 803 - Original Date: 3060, Formatted Date: null
/js/worker.js:86 [Worker] Item 803 - Invalid formatted date: 3060
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 804: (9) ['3062', '3260', '(股)', 34702805, 23.95, 24.6, 23.95, 0.5, null]
/js/worker.js:84 [Worker] Item 804 - Original Date: 3062, Formatted Date: null
/js/worker.js:86 [Worker] Item 804 - Invalid formatted date: 3062
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 805: (9) ['3090', '3260', '(股)', 85999850, 73.5, 73.9, 72.9, 0.9, null]
/js/worker.js:84 [Worker] Item 805 - Original Date: 3090, Formatted Date: null
/js/worker.js:86 [Worker] Item 805 - Invalid formatted date: 3090
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 806: (9) ['3092', '3260', '(股)', 2505203, 16.45, 16.5, 16.2, 0, null]
/js/worker.js:84 [Worker] Item 806 - Original Date: 3092, Formatted Date: null
/js/worker.js:86 [Worker] Item 806 - Invalid formatted date: 3092
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 807: (9) ['3094', '3260', '(股)', 41033490, 26.4, 28.2, 26.4, 1.7, null]
/js/worker.js:84 [Worker] Item 807 - Original Date: 3094, Formatted Date: null
/js/worker.js:86 [Worker] Item 807 - Invalid formatted date: 3094
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 808: (9) ['3130', '3260', '(股)', 3823460, 227, 227, 225, 0, null]
/js/worker.js:84 [Worker] Item 808 - Original Date: 3130, Formatted Date: null
/js/worker.js:86 [Worker] Item 808 - Invalid formatted date: 3130
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 809: (9) ['3135', '3260', '(股)', 190856100, 40.2, 42.8, 39.2, 1.7, null]
/js/worker.js:84 [Worker] Item 809 - Original Date: 3135, Formatted Date: null
/js/worker.js:86 [Worker] Item 809 - Invalid formatted date: 3135
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 810: (9) ['3138', '3260', '(股)', 3356419, 92.4, 93.5, 92.1, 0.1, null]
/js/worker.js:84 [Worker] Item 810 - Original Date: 3138, Formatted Date: null
/js/worker.js:86 [Worker] Item 810 - Invalid formatted date: 3138
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 811: (9) ['3149', '3260', '(股)', 751145461, 38.95, 42.3, 38.95, 2.85, null]
/js/worker.js:84 [Worker] Item 811 - Original Date: 3149, Formatted Date: null
/js/worker.js:86 [Worker] Item 811 - Invalid formatted date: 3149
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 812: (9) ['3150', '3260', '(股)', 1882828, 22, 22, 21.6, 0, null]
/js/worker.js:84 [Worker] Item 812 - Original Date: 3150, Formatted Date: null
/js/worker.js:86 [Worker] Item 812 - Invalid formatted date: 3150
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 813: (9) ['3164', '3260', '(股)', 316995, 19.55, 19.8, 19.55, 0.15, null]
/js/worker.js:84 [Worker] Item 813 - Original Date: 3164, Formatted Date: null
/js/worker.js:86 [Worker] Item 813 - Invalid formatted date: 3164
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 814: (9) ['3167', '3260', '(股)', 149832050, 185.5, 188, 184.5, 1, null]
/js/worker.js:84 [Worker] Item 814 - Original Date: 3167, Formatted Date: null
/js/worker.js:86 [Worker] Item 814 - Invalid formatted date: 3167
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 815: (9) ['3168', '3260', '(股)', 4407551, 49.5, 49.8, 48.55, 0.4, null]
/js/worker.js:84 [Worker] Item 815 - Original Date: 3168, Formatted Date: null
/js/worker.js:86 [Worker] Item 815 - Invalid formatted date: 3168
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 816: (9) ['3189', '3260', '(股)', 598004612, 109.5, 110, 108, 2, null]
/js/worker.js:84 [Worker] Item 816 - Original Date: 3189, Formatted Date: null
/js/worker.js:86 [Worker] Item 816 - Invalid formatted date: 3189
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 817: (9) ['3209', '3260', '(股)', 20505931, 31.55, 31.85, 31.3, 0.4, null]
/js/worker.js:84 [Worker] Item 817 - Original Date: 3209, Formatted Date: null
/js/worker.js:86 [Worker] Item 817 - Invalid formatted date: 3209
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 818: (9) ['3229', '3260', '(股)', 419308, 14.5, 14.6, 14.3, -0.15, null]
/js/worker.js:84 [Worker] Item 818 - Original Date: 3229, Formatted Date: null
/js/worker.js:86 [Worker] Item 818 - Invalid formatted date: 3229
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 819: (9) ['3231', '3260', '(股)', 3096289896, 119.5, 120, 118.5, 1, null]
/js/worker.js:84 [Worker] Item 819 - Original Date: 3231, Formatted Date: null
/js/worker.js:86 [Worker] Item 819 - Invalid formatted date: 3231
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 820: (9) ['3257', '3260', '(股)', 557468849, 68.3, 74.5, 68.1, 6.7, null]
/js/worker.js:84 [Worker] Item 820 - Original Date: 3257, Formatted Date: null
/js/worker.js:86 [Worker] Item 820 - Invalid formatted date: 3257
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 821: (9) ['3266', '3260', '(股)', 771342, 14.5, 14.6, 14.3, -0.2, null]
/js/worker.js:84 [Worker] Item 821 - Original Date: 3266, Formatted Date: null
/js/worker.js:86 [Worker] Item 821 - Invalid formatted date: 3266
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 822: (9) ['3296', '3260', '(股)', 1088066, 22.35, 22.65, 22.15, 0.05, null]
/js/worker.js:84 [Worker] Item 822 - Original Date: 3296, Formatted Date: null
/js/worker.js:86 [Worker] Item 822 - Invalid formatted date: 3296
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 823: (9) ['3305', '3260', '(股)', 4068780410, 129.5, 130.5, 116, -12.5, null]
/js/worker.js:84 [Worker] Item 823 - Original Date: 3305, Formatted Date: null
/js/worker.js:86 [Worker] Item 823 - Invalid formatted date: 3305
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 824: (9) ['3308', '3260', '(股)', 2101777, 16.55, 16.7, 16.25, 0.15, null]
/js/worker.js:84 [Worker] Item 824 - Original Date: 3308, Formatted Date: null
/js/worker.js:86 [Worker] Item 824 - Invalid formatted date: 3308
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 825: (9) ['3311', '3260', '(股)', 15981533, 35.1, 35.5, 35, 0.35, null]
/js/worker.js:84 [Worker] Item 825 - Original Date: 3311, Formatted Date: null
/js/worker.js:86 [Worker] Item 825 - Invalid formatted date: 3311
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 826: (9) ['3312', '3260', '(股)', 49316839, 44, 44.6, 43.85, 0.6, null]
/js/worker.js:84 [Worker] Item 826 - Original Date: 3312, Formatted Date: null
/js/worker.js:86 [Worker] Item 826 - Invalid formatted date: 3312
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 827: (9) ['3321', '3260', '(股)', 1300374, 13.55, 13.75, 13.2, -0.5, null]
/js/worker.js:84 [Worker] Item 827 - Original Date: 3321, Formatted Date: null
/js/worker.js:86 [Worker] Item 827 - Invalid formatted date: 3321
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 828: (9) ['3338', '3260', '(股)', 20962512, 59.7, 60.6, 59.5, 0.7, null]
/js/worker.js:84 [Worker] Item 828 - Original Date: 3338, Formatted Date: null
/js/worker.js:86 [Worker] Item 828 - Invalid formatted date: 3338
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 829: (9) ['3346', '3260', '(股)', 33112338, 23.25, 24.65, 23.25, 1.05, null]
/js/worker.js:84 [Worker] Item 829 - Original Date: 3346, Formatted Date: null
/js/worker.js:86 [Worker] Item 829 - Invalid formatted date: 3346
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 830: (9) ['3356', '3260', '(股)', 134975210, 52.9, 54.5, 52.8, 1, null]
/js/worker.js:84 [Worker] Item 830 - Original Date: 3356, Formatted Date: null
/js/worker.js:86 [Worker] Item 830 - Invalid formatted date: 3356
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 831: (9) ['3376', '3260', '(股)', 479898144, 223, 223.5, 218, 0.5, null]
/js/worker.js:84 [Worker] Item 831 - Original Date: 3376, Formatted Date: null
/js/worker.js:86 [Worker] Item 831 - Invalid formatted date: 3376
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 832: (9) ['3380', '3260', '(股)', 33645687, 27.9, 28.45, 27.75, 0.35, null]
/js/worker.js:84 [Worker] Item 832 - Original Date: 3380, Formatted Date: null
/js/worker.js:86 [Worker] Item 832 - Invalid formatted date: 3380
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 833: (9) ['3406', '3260', '(股)', 519783308, 428, 434, 427, 9, null]
/js/worker.js:84 [Worker] Item 833 - Original Date: 3406, Formatted Date: null
/js/worker.js:86 [Worker] Item 833 - Invalid formatted date: 3406
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 834: (9) ['3413', '3260', '(股)', 144258067, 293.5, 298, 293.5, 3, null]
/js/worker.js:84 [Worker] Item 834 - Original Date: 3413, Formatted Date: null
/js/worker.js:86 [Worker] Item 834 - Invalid formatted date: 3413
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 835: (9) ['3416', '3260', '(股)', 244757341, 190, 193.5, 186.5, -0.5, null]
/js/worker.js:84 [Worker] Item 835 - Original Date: 3416, Formatted Date: null
/js/worker.js:86 [Worker] Item 835 - Invalid formatted date: 3416
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 836: (9) ['3419', '3260', '(股)', 2289243, 12.8, 13, 12.8, 0.1, null]
/js/worker.js:84 [Worker] Item 836 - Original Date: 3419, Formatted Date: null
/js/worker.js:86 [Worker] Item 836 - Invalid formatted date: 3419
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 837: (9) ['3432', '3260', '(股)', 345315, 15, 15.3, 15, 0.1, null]
/js/worker.js:84 [Worker] Item 837 - Original Date: 3432, Formatted Date: null
/js/worker.js:86 [Worker] Item 837 - Invalid formatted date: 3432
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 838: (9) ['3437', '3260', '(股)', 12588486, 15.55, 16.2, 15.55, 0.6, null]
/js/worker.js:84 [Worker] Item 838 - Original Date: 3437, Formatted Date: null
/js/worker.js:86 [Worker] Item 838 - Invalid formatted date: 3437
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 839: (9) ['3443', '3260', '(股)', 1624041945, 1305, 1315, 1295, 20, null]
/js/worker.js:84 [Worker] Item 839 - Original Date: 3443, Formatted Date: null
/js/worker.js:86 [Worker] Item 839 - Invalid formatted date: 3443
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 840: (9) ['3447', '3260', '(股)', 54845097, 65.9, 65.9, 63.6, -1.1, null]
/js/worker.js:84 [Worker] Item 840 - Original Date: 3447, Formatted Date: null
/js/worker.js:86 [Worker] Item 840 - Invalid formatted date: 3447
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 841: (9) ['3450', '3260', '(股)', 3872642522, 220.5, 226, 218.5, 5, null]
/js/worker.js:84 [Worker] Item 841 - Original Date: 3450, Formatted Date: null
/js/worker.js:86 [Worker] Item 841 - Invalid formatted date: 3450
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 842: (9) ['3454', '3260', '(股)', 5628036, 93.1, 93.9, 93, 1.2, null]
/js/worker.js:84 [Worker] Item 842 - Original Date: 3454, Formatted Date: null
/js/worker.js:86 [Worker] Item 842 - Invalid formatted date: 3454
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 843: (9) ['3481', '3260', '(股)', 819930446, 13.9, 14, 13.7, 0, null]
/js/worker.js:84 [Worker] Item 843 - Original Date: 3481, Formatted Date: null
/js/worker.js:86 [Worker] Item 843 - Invalid formatted date: 3481
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 844: (9) ['3494', '3260', '(股)', 1764791, 11.25, 11.25, 10.9, -0.3, null]
/js/worker.js:84 [Worker] Item 844 - Original Date: 3494, Formatted Date: null
/js/worker.js:86 [Worker] Item 844 - Invalid formatted date: 3494
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 845: (9) ['3501', '3260', '(股)', 3143730, 51.6, 51.9, 51.6, 0.2, null]
/js/worker.js:84 [Worker] Item 845 - Original Date: 3501, Formatted Date: null
/js/worker.js:86 [Worker] Item 845 - Invalid formatted date: 3501
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 846: (9) ['3504', '3260', '(股)', 37927019, 62.5, 62.6, 61.2, -0.1, null]
/js/worker.js:84 [Worker] Item 846 - Original Date: 3504, Formatted Date: null
/js/worker.js:86 [Worker] Item 846 - Invalid formatted date: 3504
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 847: (9) ['3515', '3260', '(股)', 211125746, 281, 283, 277.5, 3.5, null]
/js/worker.js:84 [Worker] Item 847 - Original Date: 3515, Formatted Date: null
/js/worker.js:86 [Worker] Item 847 - Invalid formatted date: 3515
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 848: (9) ['3518', '3260', '(股)', 61528326, 24.35, 25.2, 23.9, 1.25, null]
/js/worker.js:84 [Worker] Item 848 - Original Date: 3518, Formatted Date: null
/js/worker.js:86 [Worker] Item 848 - Invalid formatted date: 3518
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 849: (9) ['3528', '3260', '(股)', 16728002, 71.6, 73.3, 70.8, 0.6, null]
/js/worker.js:84 [Worker] Item 849 - Original Date: 3528, Formatted Date: null
/js/worker.js:86 [Worker] Item 849 - Invalid formatted date: 3528
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 850: (9) ['3530', '3260', '(股)', 274462712, 65.5, 72, 65.5, 0.3, null]
/js/worker.js:84 [Worker] Item 850 - Original Date: 3530, Formatted Date: null
/js/worker.js:86 [Worker] Item 850 - Invalid formatted date: 3530
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 851: (9) ['3532', '3260', '(股)', 1559568521, 98.1, 106.5, 95, 9.4, null]
/js/worker.js:84 [Worker] Item 851 - Original Date: 3532, Formatted Date: null
/js/worker.js:86 [Worker] Item 851 - Invalid formatted date: 3532
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 852: (9) ['3533', '3260', '(股)', 1606028250, 1700, 1700, 1650, -50, null]
/js/worker.js:84 [Worker] Item 852 - Original Date: 3533, Formatted Date: null
/js/worker.js:86 [Worker] Item 852 - Invalid formatted date: 3533
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 853: (9) ['3535', '3260', '(股)', 1431819362, 75.6, 83, 75.5, 7.5, null]
/js/worker.js:84 [Worker] Item 853 - Original Date: 3535, Formatted Date: null
/js/worker.js:86 [Worker] Item 853 - Invalid formatted date: 3535
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 854: (9) ['3543', '3260', '(股)', 36241625, 32.3, 32.9, 32, 0, null]
/js/worker.js:84 [Worker] Item 854 - Original Date: 3543, Formatted Date: null
/js/worker.js:86 [Worker] Item 854 - Invalid formatted date: 3543
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 855: (9) ['3545', '3260', '(股)', 151739299, 70.3, 71.3, 69.7, 0.5, null]
/js/worker.js:84 [Worker] Item 855 - Original Date: 3545, Formatted Date: null
/js/worker.js:86 [Worker] Item 855 - Invalid formatted date: 3545
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 856: (9) ['3550', '3260', '(股)', 3575285, 15, 15.2, 14.9, 0.05, null]
/js/worker.js:84 [Worker] Item 856 - Original Date: 3550, Formatted Date: null
/js/worker.js:86 [Worker] Item 856 - Invalid formatted date: 3550
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 857: (9) ['3557', '3260', '(股)', 2800884, 38.7, 38.85, 38.25, 0.25, null]
/js/worker.js:84 [Worker] Item 857 - Original Date: 3557, Formatted Date: null
/js/worker.js:86 [Worker] Item 857 - Invalid formatted date: 3557
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 858: (9) ['3563', '3260', '(股)', 286229843, 550, 559, 548, 7, null]
/js/worker.js:84 [Worker] Item 858 - Original Date: 3563, Formatted Date: null
/js/worker.js:86 [Worker] Item 858 - Invalid formatted date: 3563
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 859: (9) ['3576', '3260', '(股)', 118014031, 6.64, 6.97, 6.51, 0.45, null]
/js/worker.js:84 [Worker] Item 859 - Original Date: 3576, Formatted Date: null
/js/worker.js:86 [Worker] Item 859 - Invalid formatted date: 3576
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 860: (9) ['3583', '3260', '(股)', 612114555, 358, 377, 358, 16, null]
/js/worker.js:84 [Worker] Item 860 - Original Date: 3583, Formatted Date: null
/js/worker.js:86 [Worker] Item 860 - Invalid formatted date: 3583
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 861: (9) ['3588', '3260', '(股)', 192400087, 56.2, 59.3, 55.1, -1.1, null]
/js/worker.js:84 [Worker] Item 861 - Original Date: 3588, Formatted Date: null
/js/worker.js:86 [Worker] Item 861 - Invalid formatted date: 3588
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 862: (9) ['3591', '3260', '(股)', 6021338, 18.65, 18.9, 18.55, 0.15, null]
/js/worker.js:84 [Worker] Item 862 - Original Date: 3591, Formatted Date: null
/js/worker.js:86 [Worker] Item 862 - Invalid formatted date: 3591
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 863: (9) ['3592', '3260', '(股)', 86158807, 289, 292, 288, 3, null]
/js/worker.js:84 [Worker] Item 863 - Original Date: 3592, Formatted Date: null
/js/worker.js:86 [Worker] Item 863 - Invalid formatted date: 3592
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 864: (9) ['3593', '3260', '(股)', 216500, 7.12, 7.16, 7.11, 0.03, null]
/js/worker.js:84 [Worker] Item 864 - Original Date: 3593, Formatted Date: null
/js/worker.js:86 [Worker] Item 864 - Invalid formatted date: 3593
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 865: (9) ['3596', '3260', '(股)', 60552119, 224, 226.5, 223, 0.5, null]
/js/worker.js:84 [Worker] Item 865 - Original Date: 3596, Formatted Date: null
/js/worker.js:86 [Worker] Item 865 - Invalid formatted date: 3596
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 866: (9) ['3605', '3260', '(股)', 305204909, 74.7, 75, 72.6, -0.7, null]
/js/worker.js:84 [Worker] Item 866 - Original Date: 3605, Formatted Date: null
/js/worker.js:86 [Worker] Item 866 - Invalid formatted date: 3605
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 867: (9) ['3607', '3260', '(股)', 2854732, 14.05, 14.15, 13.95, 0, null]
/js/worker.js:84 [Worker] Item 867 - Original Date: 3607, Formatted Date: null
/js/worker.js:86 [Worker] Item 867 - Invalid formatted date: 3607
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 868: (9) ['3617', '3260', '(股)', 34015468, 213.5, 216.5, 212.5, 2.5, null]
/js/worker.js:84 [Worker] Item 868 - Original Date: 3617, Formatted Date: null
/js/worker.js:86 [Worker] Item 868 - Invalid formatted date: 3617
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 869: (9) ['3622', '3260', '(股)', 15755905, 51.5, 52.5, 51.5, 1.3, null]
/js/worker.js:84 [Worker] Item 869 - Original Date: 3622, Formatted Date: null
/js/worker.js:86 [Worker] Item 869 - Invalid formatted date: 3622
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 870: (9) ['3645', '3260', '(股)', 627238012, 72.7, 73.7, 70.9, -2.1, null]
/js/worker.js:84 [Worker] Item 870 - Original Date: 3645, Formatted Date: null
/js/worker.js:86 [Worker] Item 870 - Invalid formatted date: 3645
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 871: (9) ['3652', '3260', '(股)', 1355752, 30.55, 30.8, 30.15, 0.35, null]
/js/worker.js:84 [Worker] Item 871 - Original Date: 3652, Formatted Date: null
/js/worker.js:86 [Worker] Item 871 - Invalid formatted date: 3652
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 872: (9) ['3653', '3260', '(股)', 3708414240, 2350, 2420, 2325, 80, null]
/js/worker.js:84 [Worker] Item 872 - Original Date: 3653, Formatted Date: null
/js/worker.js:86 [Worker] Item 872 - Invalid formatted date: 3653
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 873: (9) ['3661', '3260', '(股)', 6400487540, 3780, 3785, 3690, -40, null]
/js/worker.js:84 [Worker] Item 873 - Original Date: 3661, Formatted Date: null
/js/worker.js:86 [Worker] Item 873 - Invalid formatted date: 3661
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 874: (9) ['3665', '3260', '(股)', 1640864610, 1110, 1135, 1100, 25, null]
/js/worker.js:84 [Worker] Item 874 - Original Date: 3665, Formatted Date: null
/js/worker.js:86 [Worker] Item 874 - Invalid formatted date: 3665
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 875: (9) ['3669', '3260', '(股)', 1352146, 32.5, 33.1, 32.35, 0.45, null]
/js/worker.js:84 [Worker] Item 875 - Original Date: 3669, Formatted Date: null
/js/worker.js:86 [Worker] Item 875 - Invalid formatted date: 3669
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 876: (9) ['3673', '3260', '(股)', 91458458, 39.6, 40.2, 39.45, 0.5, null]
/js/worker.js:84 [Worker] Item 876 - Original Date: 3673, Formatted Date: null
/js/worker.js:86 [Worker] Item 876 - Invalid formatted date: 3673
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 877: (9) ['3679', '3260', '(股)', 2381713, 114, 115, 114, 0.5, null]
/js/worker.js:84 [Worker] Item 877 - Original Date: 3679, Formatted Date: null
/js/worker.js:86 [Worker] Item 877 - Invalid formatted date: 3679
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 878: (9) ['3686', '3260', '(股)', 29932580, 17.5, 18.7, 17.5, 1.7, null]
/js/worker.js:84 [Worker] Item 878 - Original Date: 3686, Formatted Date: null
/js/worker.js:86 [Worker] Item 878 - Invalid formatted date: 3686
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 879: (9) ['3694', '3260', '(股)', 169160093, 85.1, 85.9, 82.5, -1.3, null]
/js/worker.js:84 [Worker] Item 879 - Original Date: 3694, Formatted Date: null
/js/worker.js:86 [Worker] Item 879 - Invalid formatted date: 3694
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 880: (9) ['3701', '3260', '(股)', 113644329, 41.8, 44.3, 41.8, 1.1, null]
/js/worker.js:84 [Worker] Item 880 - Original Date: 3701, Formatted Date: null
/js/worker.js:86 [Worker] Item 880 - Invalid formatted date: 3701
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 881: (9) ['3702', '3260', '(股)', 254050576, 65.4, 66, 65.3, 0.8, null]
/js/worker.js:84 [Worker] Item 881 - Original Date: 3702, Formatted Date: null
/js/worker.js:86 [Worker] Item 881 - Invalid formatted date: 3702
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 882: (9) ['3703', '3260', '(股)', 16620268, 23.5, 23.55, 23.25, 0, null]
/js/worker.js:84 [Worker] Item 882 - Original Date: 3703, Formatted Date: null
/js/worker.js:86 [Worker] Item 882 - Invalid formatted date: 3703
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 883: (9) ['3704', '3260', '(股)', 463754403, 38.35, 39.3, 36.2, -0.4, null]
/js/worker.js:84 [Worker] Item 883 - Original Date: 3704, Formatted Date: null
/js/worker.js:86 [Worker] Item 883 - Invalid formatted date: 3704
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 884: (9) ['3705', '3260', '(股)', 23459171, 55.5, 56.2, 55.5, 0.5, null]
/js/worker.js:84 [Worker] Item 884 - Original Date: 3705, Formatted Date: null
/js/worker.js:86 [Worker] Item 884 - Invalid formatted date: 3705
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 885: (9) ['3706', '3260', '(股)', 2336150648, 85, 85, 83, -1.6, null]
/js/worker.js:84 [Worker] Item 885 - Original Date: 3706, Formatted Date: null
/js/worker.js:86 [Worker] Item 885 - Invalid formatted date: 3706
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 886: (9) ['3708', '3260', '(股)', 148212389, 115.5, 115.5, 112, 1, null]
/js/worker.js:84 [Worker] Item 886 - Original Date: 3708, Formatted Date: null
/js/worker.js:86 [Worker] Item 886 - Invalid formatted date: 3708
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 887: (9) ['3711', '3260', '(股)', 3504195694, 170.5, 173.5, 169, 1, null]
/js/worker.js:84 [Worker] Item 887 - Original Date: 3711, Formatted Date: null
/js/worker.js:86 [Worker] Item 887 - Invalid formatted date: 3711
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 888: (9) ['3712', '3260', '(股)', 30500560, 34.7, 35.25, 34.4, 0.9, null]
/js/worker.js:84 [Worker] Item 888 - Original Date: 3712, Formatted Date: null
/js/worker.js:86 [Worker] Item 888 - Invalid formatted date: 3712
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 889: (9) ['3714', '3260', '(股)', 223039362, 40.05, 40.65, 39.8, 0.6, null]
/js/worker.js:84 [Worker] Item 889 - Original Date: 3714, Formatted Date: null
/js/worker.js:86 [Worker] Item 889 - Invalid formatted date: 3714
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 890: (9) ['3715', '3260', '(股)', 1898886568, 92.3, 92.8, 88.6, -2.6, null]
/js/worker.js:84 [Worker] Item 890 - Original Date: 3715, Formatted Date: null
/js/worker.js:86 [Worker] Item 890 - Invalid formatted date: 3715
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 891: (9) ['3716', '3260', '(股)', 2318287, 33.4, 33.45, 33.3, 0.05, null]
/js/worker.js:84 [Worker] Item 891 - Original Date: 3716, Formatted Date: null
/js/worker.js:86 [Worker] Item 891 - Invalid formatted date: 3716
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 892: (9) ['3717', '3260', '(股)', 7065120, 20.5, 20.55, 20.25, -0.25, null]
/js/worker.js:84 [Worker] Item 892 - Original Date: 3717, Formatted Date: null
/js/worker.js:86 [Worker] Item 892 - Invalid formatted date: 3717
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 893: (9) ['4104', '3260', '(股)', 15525762, 85, 85.2, 84.7, -0.2, null]
/js/worker.js:84 [Worker] Item 893 - Original Date: 4104, Formatted Date: null
/js/worker.js:86 [Worker] Item 893 - Invalid formatted date: 4104
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 894: (9) ['4106', '3260', '(股)', 2531323, 22.2, 22.25, 22.05, 0.05, null]
/js/worker.js:84 [Worker] Item 894 - Original Date: 4106, Formatted Date: null
/js/worker.js:86 [Worker] Item 894 - Invalid formatted date: 4106
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 895: (9) ['4108', '3260', '(股)', 2615116, 16.45, 16.45, 16.1, -0.05, null]
/js/worker.js:84 [Worker] Item 895 - Original Date: 4108, Formatted Date: null
/js/worker.js:86 [Worker] Item 895 - Invalid formatted date: 4108
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 896: (9) ['4119', '3260', '(股)', 3198446, 57.8, 58, 57.7, 0.2, null]
/js/worker.js:84 [Worker] Item 896 - Original Date: 4119, Formatted Date: null
/js/worker.js:86 [Worker] Item 896 - Invalid formatted date: 4119
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 897: (9) ['4133', '3260', '(股)', 1549631, 25.75, 26.15, 25.7, -0.15, null]
/js/worker.js:84 [Worker] Item 897 - Original Date: 4133, Formatted Date: null
/js/worker.js:86 [Worker] Item 897 - Invalid formatted date: 4133
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 898: (9) ['4137', '3260', '(股)', 4979667, 107.5, 108, 106.5, 0, null]
/js/worker.js:84 [Worker] Item 898 - Original Date: 4137, Formatted Date: null
/js/worker.js:86 [Worker] Item 898 - Invalid formatted date: 4137
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 899: (9) ['4142', '3260', '(股)', 22040928, 18.7, 18.9, 18.5, 0.05, null]
/js/worker.js:84 [Worker] Item 899 - Original Date: 4142, Formatted Date: null
/js/worker.js:86 [Worker] Item 899 - Invalid formatted date: 4142
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 900: (9) ['4148', '3260', '(股)', 656686, 39.6, 40.7, 39.55, 0.4, null]
/js/worker.js:84 [Worker] Item 900 - Original Date: 4148, Formatted Date: null
/js/worker.js:86 [Worker] Item 900 - Invalid formatted date: 4148
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 901: (9) ['4155', '3260', '(股)', 1862831, 15.45, 15.5, 15.3, -0.05, null]
/js/worker.js:84 [Worker] Item 901 - Original Date: 4155, Formatted Date: null
/js/worker.js:86 [Worker] Item 901 - Invalid formatted date: 4155
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 902: (9) ['4164', '3260', '(股)', 54079632, 48.35, 49.3, 48.1, 0.5, null]
/js/worker.js:84 [Worker] Item 902 - Original Date: 4164, Formatted Date: null
/js/worker.js:86 [Worker] Item 902 - Invalid formatted date: 4164
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 903: (9) ['4190', '3260', '(股)', 839593, 33.8, 34.05, 33.7, 0.25, null]
/js/worker.js:84 [Worker] Item 903 - Original Date: 4190, Formatted Date: null
/js/worker.js:86 [Worker] Item 903 - Invalid formatted date: 4190
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 904: (9) ['4306', '3260', '(股)', 10536644, 13.9, 14.05, 13.9, 0.15, null]
/js/worker.js:84 [Worker] Item 904 - Original Date: 4306, Formatted Date: null
/js/worker.js:86 [Worker] Item 904 - Invalid formatted date: 4306
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 905: (9) ['4414', '3260', '(股)', 4061987, 11.7, 11.8, 11.5, -0.15, null]
/js/worker.js:84 [Worker] Item 905 - Original Date: 4414, Formatted Date: null
/js/worker.js:86 [Worker] Item 905 - Invalid formatted date: 4414
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 906: (9) ['4426', '3260', '(股)', 1202666, 10.35, 10.4, 10.2, 0.1, null]
/js/worker.js:84 [Worker] Item 906 - Original Date: 4426, Formatted Date: null
/js/worker.js:86 [Worker] Item 906 - Invalid formatted date: 4426
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 907: (9) ['4438', '3260', '(股)', 7648669, 74.1, 74.6, 73, -0.9, null]
/js/worker.js:84 [Worker] Item 907 - Original Date: 4438, Formatted Date: null
/js/worker.js:86 [Worker] Item 907 - Invalid formatted date: 4438
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 908: (9) ['4439', '3260', '(股)', 1885391, 95.3, 95.9, 94.9, 0.6, null]
/js/worker.js:84 [Worker] Item 908 - Original Date: 4439, Formatted Date: null
/js/worker.js:86 [Worker] Item 908 - Invalid formatted date: 4439
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 909: (9) ['4440', '3260', '(股)', 1001848, 17.3, 17.4, 17.25, 0.2, null]
/js/worker.js:84 [Worker] Item 909 - Original Date: 4440, Formatted Date: null
/js/worker.js:86 [Worker] Item 909 - Invalid formatted date: 4440
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 910: (9) ['4441', '3260', '(股)', 127399913, 235, 250, 235, 10.5, null]
/js/worker.js:84 [Worker] Item 910 - Original Date: 4441, Formatted Date: null
/js/worker.js:86 [Worker] Item 910 - Invalid formatted date: 4441
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 911: (9) ['4526', '3260', '(股)', 347446639, 37.55, 37.8, 36.5, -0.35, null]
/js/worker.js:84 [Worker] Item 911 - Original Date: 4526, Formatted Date: null
/js/worker.js:86 [Worker] Item 911 - Invalid formatted date: 4526
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 912: (9) ['4532', '3260', '(股)', 23449615, 23.6, 23.95, 23.6, 0.25, null]
/js/worker.js:84 [Worker] Item 912 - Original Date: 4532, Formatted Date: null
/js/worker.js:86 [Worker] Item 912 - Invalid formatted date: 4532
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 913: (9) ['4536', '3260', '(股)', 58561692, 189, 192, 188, 1.5, null]
/js/worker.js:84 [Worker] Item 913 - Original Date: 4536, Formatted Date: null
/js/worker.js:86 [Worker] Item 913 - Invalid formatted date: 4536
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 914: (9) ['4540', '3260', '(股)', 52391543, 44.7, 44.9, 43.8, -0.5, null]
/js/worker.js:84 [Worker] Item 914 - Original Date: 4540, Formatted Date: null
/js/worker.js:86 [Worker] Item 914 - Invalid formatted date: 4540
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 915: (9) ['4545', '3260', '(股)', 22829628, 33.3, 33.6, 32.15, -0.5, null]
/js/worker.js:84 [Worker] Item 915 - Original Date: 4545, Formatted Date: null
/js/worker.js:86 [Worker] Item 915 - Invalid formatted date: 4545
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 916: (9) ['4551', '3260', '(股)', 350424641, 144, 155, 144, 10, null]
/js/worker.js:84 [Worker] Item 916 - Original Date: 4551, Formatted Date: null
/js/worker.js:86 [Worker] Item 916 - Invalid formatted date: 4551
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 917: (9) ['4552', '3260', '(股)', 1197594, 22.65, 22.8, 22.65, 0.1, null]
/js/worker.js:84 [Worker] Item 917 - Original Date: 4552, Formatted Date: null
/js/worker.js:86 [Worker] Item 917 - Invalid formatted date: 4552
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 918: (9) ['4555', '3260', '(股)', 20471655, 43.8, 43.85, 42.6, -0.85, null]
/js/worker.js:84 [Worker] Item 918 - Original Date: 4555, Formatted Date: null
/js/worker.js:86 [Worker] Item 918 - Invalid formatted date: 4555
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 919: (9) ['4557', '3260', '(股)', 10488023, 82.5, 83.3, 82.4, 0.4, null]
/js/worker.js:84 [Worker] Item 919 - Original Date: 4557, Formatted Date: null
/js/worker.js:86 [Worker] Item 919 - Invalid formatted date: 4557
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 920: (9) ['4560', '3260', '(股)', 9102850, 33.55, 33.6, 33.1, -0.3, null]
/js/worker.js:84 [Worker] Item 920 - Original Date: 4560, Formatted Date: null
/js/worker.js:86 [Worker] Item 920 - Invalid formatted date: 4560
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 921: (9) ['4562', '3260', '(股)', 10467006, 46.75, 46.75, 46.1, 0.25, null]
/js/worker.js:84 [Worker] Item 921 - Original Date: 4562, Formatted Date: null
/js/worker.js:86 [Worker] Item 921 - Invalid formatted date: 4562
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 922: (9) ['4564', '3260', '(股)', 32952121, 19.6, 19.85, 19.2, -0.1, null]
/js/worker.js:84 [Worker] Item 922 - Original Date: 4564, Formatted Date: null
/js/worker.js:86 [Worker] Item 922 - Invalid formatted date: 4564
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 923: (9) ['4566', '3260', '(股)', 18278447, 55.8, 56.6, 55.7, 0.3, null]
/js/worker.js:84 [Worker] Item 923 - Original Date: 4566, Formatted Date: null
/js/worker.js:86 [Worker] Item 923 - Invalid formatted date: 4566
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 924: (9) ['4569', '3260', '(股)', 12102301, 165, 166.5, 162.5, -0.5, null]
/js/worker.js:84 [Worker] Item 924 - Original Date: 4569, Formatted Date: null
/js/worker.js:86 [Worker] Item 924 - Invalid formatted date: 4569
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 925: (9) ['4571', '3260', '(股)', 96069370, 178, 181, 176, 3, null]
/js/worker.js:84 [Worker] Item 925 - Original Date: 4571, Formatted Date: null
/js/worker.js:86 [Worker] Item 925 - Invalid formatted date: 4571
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 926: (9) ['4572', '3260', '(股)', 27776560, 167, 167, 164, -1, null]
/js/worker.js:84 [Worker] Item 926 - Original Date: 4572, Formatted Date: null
/js/worker.js:86 [Worker] Item 926 - Invalid formatted date: 4572
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 927: (9) ['4576', '3260', '(股)', 93901500, 119, 120.5, 118, -0.5, null]
/js/worker.js:84 [Worker] Item 927 - Original Date: 4576, Formatted Date: null
/js/worker.js:86 [Worker] Item 927 - Invalid formatted date: 4576
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 928: (9) ['4581', '3260', '(股)', 439935, 54.9, 54.9, 54.5, -0.4, null]
/js/worker.js:84 [Worker] Item 928 - Original Date: 4581, Formatted Date: null
/js/worker.js:86 [Worker] Item 928 - Invalid formatted date: 4581
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 929: (9) ['4583', '3260', '(股)', 269510558, 691, 718, 691, 29, null]
/js/worker.js:84 [Worker] Item 929 - Original Date: 4583, Formatted Date: null
/js/worker.js:86 [Worker] Item 929 - Invalid formatted date: 4583
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 930: (9) ['4588', '3260', '(股)', 1498026, 64.1, 64.9, 63.8, 0, null]
/js/worker.js:84 [Worker] Item 930 - Original Date: 4588, Formatted Date: null
/js/worker.js:86 [Worker] Item 930 - Invalid formatted date: 4588
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 931: (9) ['4720', '3260', '(股)', 3437313, 15.7, 15.7, 15.6, -0.05, null]
/js/worker.js:84 [Worker] Item 931 - Original Date: 4720, Formatted Date: null
/js/worker.js:86 [Worker] Item 931 - Invalid formatted date: 4720
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 932: (9) ['4722', '3260', '(股)', 1641630855, 131, 142, 129, 9, null]
/js/worker.js:84 [Worker] Item 932 - Original Date: 4722, Formatted Date: null
/js/worker.js:86 [Worker] Item 932 - Invalid formatted date: 4722
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 933: (9) ['4736', '3260', '(股)', 9415779, 121, 121, 120, 1, null]
/js/worker.js:84 [Worker] Item 933 - Original Date: 4736, Formatted Date: null
/js/worker.js:86 [Worker] Item 933 - Invalid formatted date: 4736
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 934: (9) ['4737', '3260', '(股)', 4225534, 67.5, 69.6, 66.9, -0.8, null]
/js/worker.js:84 [Worker] Item 934 - Original Date: 4737, Formatted Date: null
/js/worker.js:86 [Worker] Item 934 - Invalid formatted date: 4737
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 935: (9) ['4739', '3260', '(股)', 37125432, 63.6, 64.3, 63.2, 0.5, null]
/js/worker.js:84 [Worker] Item 935 - Original Date: 4739, Formatted Date: null
/js/worker.js:86 [Worker] Item 935 - Invalid formatted date: 4739
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 936: (9) ['4746', '3260', '(股)', 26867345, 66, 67, 66, 0.5, null]
/js/worker.js:84 [Worker] Item 936 - Original Date: 4746, Formatted Date: null
/js/worker.js:86 [Worker] Item 936 - Invalid formatted date: 4746
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 937: (9) ['4755', '3260', '(股)', 49694799, 124.5, 130, 124.5, 5.5, null]
/js/worker.js:84 [Worker] Item 937 - Original Date: 4755, Formatted Date: null
/js/worker.js:86 [Worker] Item 937 - Invalid formatted date: 4755
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 938: (9) ['4763', '3260', '(股)', 297783780, 66.2, 66.7, 66.1, 0.2, null]
/js/worker.js:84 [Worker] Item 938 - Original Date: 4763, Formatted Date: null
/js/worker.js:86 [Worker] Item 938 - Invalid formatted date: 4763
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 939: (9) ['4764', '3260', '(股)', 394588, 40.1, 40.7, 40.1, 0.65, null]
/js/worker.js:84 [Worker] Item 939 - Original Date: 4764, Formatted Date: null
/js/worker.js:86 [Worker] Item 939 - Invalid formatted date: 4764
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 940: (9) ['4766', '3260', '(股)', 534600138, 404.5, 406.5, 395.5, -3.5, null]
/js/worker.js:84 [Worker] Item 940 - Original Date: 4766, Formatted Date: null
/js/worker.js:86 [Worker] Item 940 - Invalid formatted date: 4766
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 941: (9) ['4770', '3260', '(股)', 178882773, 303, 309, 301.5, 5, null]
/js/worker.js:84 [Worker] Item 941 - Original Date: 4770, Formatted Date: null
/js/worker.js:86 [Worker] Item 941 - Invalid formatted date: 4770
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 942: (9) ['4771', '3260', '(股)', 113274264, 181, 181, 178, 1, null]
/js/worker.js:84 [Worker] Item 942 - Original Date: 4771, Formatted Date: null
/js/worker.js:86 [Worker] Item 942 - Invalid formatted date: 4771
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 943: (9) ['4807', '3260', '(股)', 1407638, 17.25, 17.7, 17.15, 0.05, null]
/js/worker.js:84 [Worker] Item 943 - Original Date: 4807, Formatted Date: null
/js/worker.js:86 [Worker] Item 943 - Invalid formatted date: 4807
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 944: (9) ['4904', '3260', '(股)', 432472671, 85.7, 85.8, 85, -0.1, null]
/js/worker.js:84 [Worker] Item 944 - Original Date: 4904, Formatted Date: null
/js/worker.js:86 [Worker] Item 944 - Invalid formatted date: 4904
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 945: (9) ['4906', '3260', '(股)', 69202420, 25.35, 25.8, 25.3, 0.55, null]
/js/worker.js:84 [Worker] Item 945 - Original Date: 4906, Formatted Date: null
/js/worker.js:86 [Worker] Item 945 - Invalid formatted date: 4906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 946: (9) ['4912', '3260', '(股)', 12681291, 76.3, 77.5, 75.5, 0, null]
/js/worker.js:84 [Worker] Item 946 - Original Date: 4912, Formatted Date: null
/js/worker.js:86 [Worker] Item 946 - Invalid formatted date: 4912
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 947: (9) ['4915', '3260', '(股)', 125472709, 77.7, 78.1, 77.5, 0.3, null]
/js/worker.js:84 [Worker] Item 947 - Original Date: 4915, Formatted Date: null
/js/worker.js:86 [Worker] Item 947 - Invalid formatted date: 4915
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 948: (9) ['4916', '3260', '(股)', 523744901, 61.3, 62.4, 58.7, -1.6, null]
/js/worker.js:84 [Worker] Item 948 - Original Date: 4916, Formatted Date: null
/js/worker.js:86 [Worker] Item 948 - Invalid formatted date: 4916
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 949: (9) ['4919', '3260', '(股)', 547389252, 64.3, 67.5, 64, 2.5, null]
/js/worker.js:84 [Worker] Item 949 - Original Date: 4919, Formatted Date: null
/js/worker.js:86 [Worker] Item 949 - Invalid formatted date: 4919
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 950: (9) ['4927', '3260', '(股)', 384883197, 25.9, 28.35, 25.9, 1.95, null]
/js/worker.js:84 [Worker] Item 950 - Original Date: 4927, Formatted Date: null
/js/worker.js:86 [Worker] Item 950 - Invalid formatted date: 4927
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 951: (9) ['4930', '3260', '(股)', 388289, 23.6, 23.65, 23.55, -0.1, null]
/js/worker.js:84 [Worker] Item 951 - Original Date: 4930, Formatted Date: null
/js/worker.js:86 [Worker] Item 951 - Invalid formatted date: 4930
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 952: (9) ['4934', '3260', '(股)', 49878552, 14.55, 14.55, 14.3, 1.3, null]
/js/worker.js:84 [Worker] Item 952 - Original Date: 4934, Formatted Date: null
/js/worker.js:86 [Worker] Item 952 - Invalid formatted date: 4934
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 953: (9) ['4935', '3260', '(股)', 2327505, 46.15, 46.7, 45.6, 0.2, null]
/js/worker.js:84 [Worker] Item 953 - Original Date: 4935, Formatted Date: null
/js/worker.js:86 [Worker] Item 953 - Invalid formatted date: 4935
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 954: (9) ['4938', '3260', '(股)', 337437124, 70.2, 70.8, 70.1, 0.8, null]
/js/worker.js:84 [Worker] Item 954 - Original Date: 4938, Formatted Date: null
/js/worker.js:86 [Worker] Item 954 - Invalid formatted date: 4938
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 955: (9) ['4942', '3260', '(股)', 7937367, 35.7, 36.2, 35.25, 0.55, null]
/js/worker.js:84 [Worker] Item 955 - Original Date: 4942, Formatted Date: null
/js/worker.js:86 [Worker] Item 955 - Invalid formatted date: 4942
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 956: (9) ['4943', '3260', '(股)', 180623, 8.66, 9.21, 8.66, -0.03, null]
/js/worker.js:84 [Worker] Item 956 - Original Date: 4943, Formatted Date: null
/js/worker.js:86 [Worker] Item 956 - Invalid formatted date: 4943
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 957: (9) ['4949', '3260', '(股)', 24716855, 40, 41.25, 40, 1.4, null]
/js/worker.js:84 [Worker] Item 957 - Original Date: 4949, Formatted Date: null
/js/worker.js:86 [Worker] Item 957 - Invalid formatted date: 4949
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 958: (9) ['4952', '3260', '(股)', 27203088, 45.7, 46.4, 44.65, -0.35, null]
/js/worker.js:84 [Worker] Item 958 - Original Date: 4952, Formatted Date: null
/js/worker.js:86 [Worker] Item 958 - Invalid formatted date: 4952
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 959: (9) ['4956', '3260', '(股)', 23533008, 21.75, 22.4, 21.75, 0.3, null]
/js/worker.js:84 [Worker] Item 959 - Original Date: 4956, Formatted Date: null
/js/worker.js:86 [Worker] Item 959 - Invalid formatted date: 4956
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 960: (9) ['4958', '3260', '(股)', 4369908815, 172, 173, 166, -1.5, null]
/js/worker.js:84 [Worker] Item 960 - Original Date: 4958, Formatted Date: null
/js/worker.js:86 [Worker] Item 960 - Invalid formatted date: 4958
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 961: (9) ['4960', '3260', '(股)', 84868735, 13.95, 15.2, 13.95, 1, null]
/js/worker.js:84 [Worker] Item 961 - Original Date: 4960, Formatted Date: null
/js/worker.js:86 [Worker] Item 961 - Invalid formatted date: 4960
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 962: (9) ['4961', '3260', '(股)', 149508753, 173.5, 177.5, 172.5, 2.5, null]
/js/worker.js:84 [Worker] Item 962 - Original Date: 4961, Formatted Date: null
/js/worker.js:86 [Worker] Item 962 - Invalid formatted date: 4961
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 963: (9) ['4967', '3260', '(股)', 2321972184, 92, 95, 89.2, -1, null]
/js/worker.js:84 [Worker] Item 963 - Original Date: 4967, Formatted Date: null
/js/worker.js:86 [Worker] Item 963 - Invalid formatted date: 4967
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 964: (9) ['4968', '3260', '(股)', 499966061, 148, 156, 146.5, 5.5, null]
/js/worker.js:84 [Worker] Item 964 - Original Date: 4968, Formatted Date: null
/js/worker.js:86 [Worker] Item 964 - Invalid formatted date: 4968
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 965: (9) ['4976', '3260', '(股)', 171629962, 46, 46.2, 42.85, -2.8, null]
/js/worker.js:84 [Worker] Item 965 - Original Date: 4976, Formatted Date: null
/js/worker.js:86 [Worker] Item 965 - Invalid formatted date: 4976
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 966: (9) ['4977', '3260', '(股)', 589225338, 122, 124, 120, -2.5, null]
/js/worker.js:84 [Worker] Item 966 - Original Date: 4977, Formatted Date: null
/js/worker.js:86 [Worker] Item 966 - Invalid formatted date: 4977
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 967: (9) ['4989', '3260', '(股)', 54541100, 27.4, 27.9, 27.1, 0, null]
/js/worker.js:84 [Worker] Item 967 - Original Date: 4989, Formatted Date: null
/js/worker.js:86 [Worker] Item 967 - Invalid formatted date: 4989
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 968: (9) ['4994', '3260', '(股)', 1960171, 93.2, 93.6, 91.6, 0.7, null]
/js/worker.js:84 [Worker] Item 968 - Original Date: 4994, Formatted Date: null
/js/worker.js:86 [Worker] Item 968 - Invalid formatted date: 4994
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 969: (9) ['4999', '3260', '(股)', 1279390, 25.7, 26.2, 25.65, 0.25, null]
/js/worker.js:84 [Worker] Item 969 - Original Date: 4999, Formatted Date: null
/js/worker.js:86 [Worker] Item 969 - Invalid formatted date: 4999
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 970: (9) ['5007', '3260', '(股)', 1306397, 51.8, 52.4, 51.6, 0.2, null]
/js/worker.js:84 [Worker] Item 970 - Original Date: 5007, Formatted Date: null
/js/worker.js:86 [Worker] Item 970 - Invalid formatted date: 5007
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 971: (9) ['5203', '3260', '(股)', 13844592, 102, 102.5, 101.5, 0.5, null]
/js/worker.js:84 [Worker] Item 971 - Original Date: 5203, Formatted Date: null
/js/worker.js:86 [Worker] Item 971 - Invalid formatted date: 5203
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 972: (9) ['5215', '3260', '(股)', 1547727, 34.1, 34.35, 34.1, 0.25, null]
/js/worker.js:84 [Worker] Item 972 - Original Date: 5215, Formatted Date: null
/js/worker.js:86 [Worker] Item 972 - Invalid formatted date: 5215
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 973: (9) ['5222', '3260', '(股)', 294433605, 141, 149, 140, 1.5, null]
/js/worker.js:84 [Worker] Item 973 - Original Date: 5222, Formatted Date: null
/js/worker.js:86 [Worker] Item 973 - Invalid formatted date: 5222
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 974: (9) ['5225', '3260', '(股)', 28197411, 109, 109.5, 108, 1.5, null]
/js/worker.js:84 [Worker] Item 974 - Original Date: 5225, Formatted Date: null
/js/worker.js:86 [Worker] Item 974 - Invalid formatted date: 5225
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 975: (9) ['5234', '3260', '(股)', 488112748, 381, 383.5, 367, -8.5, null]
/js/worker.js:84 [Worker] Item 975 - Original Date: 5234, Formatted Date: null
/js/worker.js:86 [Worker] Item 975 - Invalid formatted date: 5234
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 976: (9) ['5243', '3260', '(股)', 57312969, 70, 70.9, 69.8, 0.7, null]
/js/worker.js:84 [Worker] Item 976 - Original Date: 5243, Formatted Date: null
/js/worker.js:86 [Worker] Item 976 - Invalid formatted date: 5243
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 977: (9) ['5244', '3260', '(股)', 47860923, 45.5, 47.1, 45.45, 1, null]
/js/worker.js:84 [Worker] Item 977 - Original Date: 5244, Formatted Date: null
/js/worker.js:86 [Worker] Item 977 - Invalid formatted date: 5244
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 978: (9) ['5258', '3260', '(股)', 25567121, 74.6, 76, 74.1, 2.5, null]
/js/worker.js:84 [Worker] Item 978 - Original Date: 5258, Formatted Date: null
/js/worker.js:86 [Worker] Item 978 - Invalid formatted date: 5258
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 979: (9) ['5269', '3260', '(股)', 563649915, 1615, 1645, 1610, 15, null]
/js/worker.js:84 [Worker] Item 979 - Original Date: 5269, Formatted Date: null
/js/worker.js:86 [Worker] Item 979 - Invalid formatted date: 5269
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 980: (9) ['5283', '3260', '(股)', 18542238, 68.3, 68.5, 67.4, -0.6, null]
/js/worker.js:84 [Worker] Item 980 - Original Date: 5283, Formatted Date: null
/js/worker.js:86 [Worker] Item 980 - Invalid formatted date: 5283
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 981: (9) ['5284', '3260', '(股)', 938126157, 276, 281, 265, -2, null]
/js/worker.js:84 [Worker] Item 981 - Original Date: 5284, Formatted Date: null
/js/worker.js:86 [Worker] Item 981 - Invalid formatted date: 5284
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 982: (9) ['5285', '3260', '(股)', 11782414, 50.5, 51.3, 49.65, -0.4, null]
/js/worker.js:84 [Worker] Item 982 - Original Date: 5285, Formatted Date: null
/js/worker.js:86 [Worker] Item 982 - Invalid formatted date: 5285
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 983: (9) ['5288', '3260', '(股)', 16839551, 113.5, 113.5, 111.5, 0.5, null]
/js/worker.js:84 [Worker] Item 983 - Original Date: 5288, Formatted Date: null
/js/worker.js:86 [Worker] Item 983 - Invalid formatted date: 5288
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 984: (9) ['5292', '3260', '(股)', 17088013, 155.5, 156, 153, 1.5, null]
/js/worker.js:84 [Worker] Item 984 - Original Date: 5292, Formatted Date: null
/js/worker.js:86 [Worker] Item 984 - Invalid formatted date: 5292
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 985: (9) ['5306', '3260', '(股)', 7931572, 88.8, 89.5, 88.5, 0.8, null]
/js/worker.js:84 [Worker] Item 985 - Original Date: 5306, Formatted Date: null
/js/worker.js:86 [Worker] Item 985 - Invalid formatted date: 5306
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 986: (9) ['5388', '3260', '(股)', 133645919, 103.5, 105.5, 103.5, 1.5, null]
/js/worker.js:84 [Worker] Item 986 - Original Date: 5388, Formatted Date: null
/js/worker.js:86 [Worker] Item 986 - Invalid formatted date: 5388
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 987: (9) ['5434', '3260', '(股)', 150640457, 290.5, 294.5, 288.5, 3.5, null]
/js/worker.js:84 [Worker] Item 987 - Original Date: 5434, Formatted Date: null
/js/worker.js:86 [Worker] Item 987 - Invalid formatted date: 5434
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 988: (9) ['5469', '3260', '(股)', 2086745844, 83.3, 88.7, 81.6, 8, null]
/js/worker.js:84 [Worker] Item 988 - Original Date: 5469, Formatted Date: null
/js/worker.js:86 [Worker] Item 988 - Invalid formatted date: 5469
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 989: (9) ['5471', '3260', '(股)', 54737845, 40.7, 41, 40, -0.45, null]
/js/worker.js:84 [Worker] Item 989 - Original Date: 5471, Formatted Date: null
/js/worker.js:86 [Worker] Item 989 - Invalid formatted date: 5471
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 990: (9) ['5484', '3260', '(股)', 10576637, 41.9, 42.9, 41.85, 0.1, null]
/js/worker.js:84 [Worker] Item 990 - Original Date: 5484, Formatted Date: null
/js/worker.js:86 [Worker] Item 990 - Invalid formatted date: 5484
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 991: (9) ['5515', '3260', '(股)', 4091529, 24, 24.05, 23.8, -0.05, null]
/js/worker.js:84 [Worker] Item 991 - Original Date: 5515, Formatted Date: null
/js/worker.js:86 [Worker] Item 991 - Invalid formatted date: 5515
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 992: (9) ['5519', '3260', '(股)', 8584594, 30.15, 30.25, 29.9, 0.2, null]
/js/worker.js:84 [Worker] Item 992 - Original Date: 5519, Formatted Date: null
/js/worker.js:86 [Worker] Item 992 - Invalid formatted date: 5519
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 993: (9) ['5521', '3260', '(股)', 22614944, 12.75, 12.75, 12.5, -0.1, null]
/js/worker.js:84 [Worker] Item 993 - Original Date: 5521, Formatted Date: null
/js/worker.js:86 [Worker] Item 993 - Invalid formatted date: 5521
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 994: (9) ['5522', '3260', '(股)', 55459866, 66.3, 66.3, 64.2, -0.7, null]
/js/worker.js:84 [Worker] Item 994 - Original Date: 5522, Formatted Date: null
/js/worker.js:86 [Worker] Item 994 - Invalid formatted date: 5522
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 995: (9) ['5525', '3260', '(股)', 1604891, 30.25, 30.5, 30.15, 0.05, null]
/js/worker.js:84 [Worker] Item 995 - Original Date: 5525, Formatted Date: null
/js/worker.js:86 [Worker] Item 995 - Invalid formatted date: 5525
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 996: (9) ['5531', '3260', '(股)', 3827127, 9.28, 9.36, 9.24, 0, null]
/js/worker.js:84 [Worker] Item 996 - Original Date: 5531, Formatted Date: null
/js/worker.js:86 [Worker] Item 996 - Invalid formatted date: 5531
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 997: (9) ['5533', '3260', '(股)', 1235078, 15.75, 15.85, 15.7, 0.05, null]
/js/worker.js:84 [Worker] Item 997 - Original Date: 5533, Formatted Date: null
/js/worker.js:86 [Worker] Item 997 - Invalid formatted date: 5533
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 998: (9) ['5534', '3260', '(股)', 80891046, 82.5, 83.7, 81.2, -0.7, null]
/js/worker.js:84 [Worker] Item 998 - Original Date: 5534, Formatted Date: null
/js/worker.js:86 [Worker] Item 998 - Invalid formatted date: 5534
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 999: (9) ['5538', '3260', '(股)', 933329, 29.15, 29.3, 29, -0.15, null]
/js/worker.js:84 [Worker] Item 999 - Original Date: 5538, Formatted Date: null
/js/worker.js:86 [Worker] Item 999 - Invalid formatted date: 5538
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1000: (9) ['5546', '3260', '(股)', 474580, 25.4, 25.95, 25.4, 0.05, null]
/js/worker.js:84 [Worker] Item 1000 - Original Date: 5546, Formatted Date: null
/js/worker.js:86 [Worker] Item 1000 - Invalid formatted date: 5546
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1001: (9) ['5607', '3260', '(股)', 18025047, 48.6, 48.95, 48.1, 0.2, null]
/js/worker.js:84 [Worker] Item 1001 - Original Date: 5607, Formatted Date: null
/js/worker.js:86 [Worker] Item 1001 - Invalid formatted date: 5607
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1002: (9) ['5608', '3260', '(股)', 40388897, 17.6, 17.95, 17.6, 0.2, null]
/js/worker.js:84 [Worker] Item 1002 - Original Date: 5608, Formatted Date: null
/js/worker.js:86 [Worker] Item 1002 - Invalid formatted date: 5608
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1003: (9) ['5706', '3260', '(股)', 4573424, 53.8, 54, 53.6, -0.1, null]
/js/worker.js:84 [Worker] Item 1003 - Original Date: 5706, Formatted Date: null
/js/worker.js:86 [Worker] Item 1003 - Invalid formatted date: 5706
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1004: (9) ['5871', '3260', '(股)', 551294193, 116.5, 117.5, 115.5, 1.5, null]
/js/worker.js:84 [Worker] Item 1004 - Original Date: 5871, Formatted Date: null
/js/worker.js:86 [Worker] Item 1004 - Invalid formatted date: 5871
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1005: (9) ['5871A', '3260', '(股)', 16249765, 101.5, 101.5, 101, 0, null]
/js/worker.js:84 [Worker] Item 1005 - Original Date: 5871A, Formatted Date: null
/js/worker.js:86 [Worker] Item 1005 - Invalid formatted date: 5871A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1006: (9) ['5876', '3260', '(股)', 182384682, 41.6, 41.75, 41.15, -0.1, null]
/js/worker.js:84 [Worker] Item 1006 - Original Date: 5876, Formatted Date: null
/js/worker.js:86 [Worker] Item 1006 - Invalid formatted date: 5876
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1007: (9) ['5880', '3260', '(股)', 275640762, 24.2, 24.4, 24.15, 0.15, null]
/js/worker.js:84 [Worker] Item 1007 - Original Date: 5880, Formatted Date: null
/js/worker.js:86 [Worker] Item 1007 - Invalid formatted date: 5880
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1008: (9) ['5906', '3260', '(股)', 361076, 51.1, 51.1, 49, -0.45, null]
/js/worker.js:84 [Worker] Item 1008 - Original Date: 5906, Formatted Date: null
/js/worker.js:86 [Worker] Item 1008 - Invalid formatted date: 5906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1009: (9) ['5907', '3260', '(股)', 1274141, 5.92, 6.09, 5.92, 0.1, null]
/js/worker.js:84 [Worker] Item 1009 - Original Date: 5907, Formatted Date: null
/js/worker.js:86 [Worker] Item 1009 - Invalid formatted date: 5907
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1010: (9) ['6005', '3260', '(股)', 112346073, 23.55, 23.85, 23.5, 0.45, null]
/js/worker.js:84 [Worker] Item 1010 - Original Date: 6005, Formatted Date: null
/js/worker.js:86 [Worker] Item 1010 - Invalid formatted date: 6005
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1011: (9) ['6024', '3260', '(股)', 17503742, 48.65, 48.8, 48.5, 0, null]
/js/worker.js:84 [Worker] Item 1011 - Original Date: 6024, Formatted Date: null
/js/worker.js:86 [Worker] Item 1011 - Invalid formatted date: 6024
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1012: (9) ['6108', '3260', '(股)', 1136152, 14.15, 14.3, 14.1, 0.15, null]
/js/worker.js:84 [Worker] Item 1012 - Original Date: 6108, Formatted Date: null
/js/worker.js:86 [Worker] Item 1012 - Invalid formatted date: 6108
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1013: (9) ['6112', '3260', '(股)', 52580480, 51.7, 52.7, 51.4, 0.8, null]
/js/worker.js:84 [Worker] Item 1013 - Original Date: 6112, Formatted Date: null
/js/worker.js:86 [Worker] Item 1013 - Invalid formatted date: 6112
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1014: (9) ['6115', '3260', '(股)', 2704043, 47, 47.4, 47, 0.15, null]
/js/worker.js:84 [Worker] Item 1014 - Original Date: 6115, Formatted Date: null
/js/worker.js:86 [Worker] Item 1014 - Invalid formatted date: 6115
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1015: (9) ['6116', '3260', '(股)', 155354941, 7.66, 7.98, 7.61, 0.29, null]
/js/worker.js:84 [Worker] Item 1015 - Original Date: 6116, Formatted Date: null
/js/worker.js:86 [Worker] Item 1015 - Invalid formatted date: 6116
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1016: (9) ['6117', '3260', '(股)', 73161356, 88.9, 90.3, 88, 1.5, null]
/js/worker.js:84 [Worker] Item 1016 - Original Date: 6117, Formatted Date: null
/js/worker.js:86 [Worker] Item 1016 - Invalid formatted date: 6117
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1017: (9) ['6128', '3260', '(股)', 1400480, 28.05, 28.05, 27.9, 0.05, null]
/js/worker.js:84 [Worker] Item 1017 - Original Date: 6128, Formatted Date: null
/js/worker.js:86 [Worker] Item 1017 - Invalid formatted date: 6128
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1018: (9) ['6133', '3260', '(股)', 9349196, 17.1, 17.35, 17.05, 0.05, null]
/js/worker.js:84 [Worker] Item 1018 - Original Date: 6133, Formatted Date: null
/js/worker.js:86 [Worker] Item 1018 - Invalid formatted date: 6133
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1019: (9) ['6136', '3260', '(股)', 2454115, 23.65, 23.75, 23.65, 0.05, null]
/js/worker.js:84 [Worker] Item 1019 - Original Date: 6136, Formatted Date: null
/js/worker.js:86 [Worker] Item 1019 - Invalid formatted date: 6136
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1020: (9) ['6139', '3260', '(股)', 818958148, 354.5, 359, 352.5, 2, null]
/js/worker.js:84 [Worker] Item 1020 - Original Date: 6139, Formatted Date: null
/js/worker.js:86 [Worker] Item 1020 - Invalid formatted date: 6139
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1021: (9) ['6141', '3260', '(股)', 3645579, 12.5, 12.75, 12.5, 0.2, null]
/js/worker.js:84 [Worker] Item 1021 - Original Date: 6141, Formatted Date: null
/js/worker.js:86 [Worker] Item 1021 - Invalid formatted date: 6141
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1022: (9) ['6142', '3260', '(股)', 4700000, 9.94, 10.3, 9.94, 0.21, null]
/js/worker.js:84 [Worker] Item 1022 - Original Date: 6142, Formatted Date: null
/js/worker.js:86 [Worker] Item 1022 - Invalid formatted date: 6142
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1023: (9) ['6152', '3260', '(股)', 3903236, 9.65, 9.7, 9.5, -0.02, null]
/js/worker.js:84 [Worker] Item 1023 - Original Date: 6152, Formatted Date: null
/js/worker.js:86 [Worker] Item 1023 - Invalid formatted date: 6152
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1024: (9) ['6153', '3260', '(股)', 142035643, 14.9, 15.75, 14.8, 0.7, null]
/js/worker.js:84 [Worker] Item 1024 - Original Date: 6153, Formatted Date: null
/js/worker.js:86 [Worker] Item 1024 - Invalid formatted date: 6153
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1025: (9) ['6155', '3260', '(股)', 3823395, 22.45, 22.8, 22.4, 0.5, null]
/js/worker.js:84 [Worker] Item 1025 - Original Date: 6155, Formatted Date: null
/js/worker.js:86 [Worker] Item 1025 - Invalid formatted date: 6155
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1026: (9) ['6164', '3260', '(股)', 4449653, 10.25, 10.45, 10.25, 0.1, null]
/js/worker.js:84 [Worker] Item 1026 - Original Date: 6164, Formatted Date: null
/js/worker.js:86 [Worker] Item 1026 - Invalid formatted date: 6164
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1027: (9) ['6165', '3260', '(股)', 40828626, 52.1, 52.8, 51.4, -0.2, null]
/js/worker.js:84 [Worker] Item 1027 - Original Date: 6165, Formatted Date: null
/js/worker.js:86 [Worker] Item 1027 - Invalid formatted date: 6165
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1028: (9) ['6166', '3260', '(股)', 66864498, 63.5, 65.2, 63.5, 1.4, null]
/js/worker.js:84 [Worker] Item 1028 - Original Date: 6166, Formatted Date: null
/js/worker.js:86 [Worker] Item 1028 - Invalid formatted date: 6166
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1029: (9) ['6168', '3260', '(股)', 40864187, 21.85, 22.15, 21.7, 0.6, null]
/js/worker.js:84 [Worker] Item 1029 - Original Date: 6168, Formatted Date: null
/js/worker.js:86 [Worker] Item 1029 - Invalid formatted date: 6168
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1030: (9) ['6176', '3260', '(股)', 216182546, 141.5, 143, 141, 1, null]
/js/worker.js:84 [Worker] Item 1030 - Original Date: 6176, Formatted Date: null
/js/worker.js:86 [Worker] Item 1030 - Invalid formatted date: 6176
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1031: (9) ['6177', '3260', '(股)', 247281224, 54.2, 55.2, 52.7, -0.2, null]
/js/worker.js:84 [Worker] Item 1031 - Original Date: 6177, Formatted Date: null
/js/worker.js:86 [Worker] Item 1031 - Invalid formatted date: 6177
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1032: (9) ['6183', '3260', '(股)', 3923791, 98.1, 98.3, 97, 0.4, null]
/js/worker.js:84 [Worker] Item 1032 - Original Date: 6183, Formatted Date: null
/js/worker.js:86 [Worker] Item 1032 - Invalid formatted date: 6183
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1033: (9) ['6184', '3260', '(股)', 3743772, 50.5, 50.7, 50.5, 0.1, null]
/js/worker.js:84 [Worker] Item 1033 - Original Date: 6184, Formatted Date: null
/js/worker.js:86 [Worker] Item 1033 - Invalid formatted date: 6184
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1034: (9) ['6189', '3260', '(股)', 45690594, 50.3, 51.7, 50.3, 0.9, null]
/js/worker.js:84 [Worker] Item 1034 - Original Date: 6189, Formatted Date: null
/js/worker.js:86 [Worker] Item 1034 - Invalid formatted date: 6189
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1035: (9) ['6191', '3260', '(股)', 5896690226, 122, 130.5, 122, 8, null]
/js/worker.js:84 [Worker] Item 1035 - Original Date: 6191, Formatted Date: null
/js/worker.js:86 [Worker] Item 1035 - Invalid formatted date: 6191
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1036: (9) ['6192', '3260', '(股)', 14928898, 104.5, 105, 104, 0, null]
/js/worker.js:84 [Worker] Item 1036 - Original Date: 6192, Formatted Date: null
/js/worker.js:86 [Worker] Item 1036 - Invalid formatted date: 6192
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1037: (9) ['6196', '3260', '(股)', 306154450, 254.5, 256, 251, 0.5, null]
/js/worker.js:84 [Worker] Item 1037 - Original Date: 6196, Formatted Date: null
/js/worker.js:86 [Worker] Item 1037 - Invalid formatted date: 6196
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1038: (9) ['6197', '3260', '(股)', 134716422, 159, 161, 158, 2.5, null]
/js/worker.js:84 [Worker] Item 1038 - Original Date: 6197, Formatted Date: null
/js/worker.js:86 [Worker] Item 1038 - Invalid formatted date: 6197
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1039: (9) ['6201', '3260', '(股)', 636037, 57.6, 57.7, 57.5, -0.1, null]
/js/worker.js:84 [Worker] Item 1039 - Original Date: 6201, Formatted Date: null
/js/worker.js:86 [Worker] Item 1039 - Invalid formatted date: 6201
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1040: (9) ['6202', '3260', '(股)', 167383643, 43, 43.9, 42.65, 0.7, null]
/js/worker.js:84 [Worker] Item 1040 - Original Date: 6202, Formatted Date: null
/js/worker.js:86 [Worker] Item 1040 - Invalid formatted date: 6202
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1041: (9) ['6205', '3260', '(股)', 7364290, 43.6, 44.1, 42.4, 1.3, null]
/js/worker.js:84 [Worker] Item 1041 - Original Date: 6205, Formatted Date: null
/js/worker.js:86 [Worker] Item 1041 - Invalid formatted date: 6205
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1042: (9) ['6206', '3260', '(股)', 69625707, 106, 107.5, 105, 0.5, null]
/js/worker.js:84 [Worker] Item 1042 - Original Date: 6206, Formatted Date: null
/js/worker.js:86 [Worker] Item 1042 - Invalid formatted date: 6206
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1043: (9) ['6209', '3260', '(股)', 135072777, 38.85, 39.35, 38.2, 0.85, null]
/js/worker.js:84 [Worker] Item 1043 - Original Date: 6209, Formatted Date: null
/js/worker.js:86 [Worker] Item 1043 - Invalid formatted date: 6209
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1044: (9) ['6213', '3260', '(股)', 798798386, 111.5, 114, 109.5, 1, null]
/js/worker.js:84 [Worker] Item 1044 - Original Date: 6213, Formatted Date: null
/js/worker.js:86 [Worker] Item 1044 - Invalid formatted date: 6213
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1045: (9) ['6214', '3260', '(股)', 38762533, 122, 122.5, 121.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1045 - Original Date: 6214, Formatted Date: null
/js/worker.js:86 [Worker] Item 1045 - Invalid formatted date: 6214
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1046: (9) ['6215', '3260', '(股)', 277696068, 123, 123.5, 120, 1, null]
/js/worker.js:84 [Worker] Item 1046 - Original Date: 6215, Formatted Date: null
/js/worker.js:86 [Worker] Item 1046 - Invalid formatted date: 6215
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1047: (9) ['6216', '3260', '(股)', 3076898, 27.7, 27.9, 27.6, 0.3, null]
/js/worker.js:84 [Worker] Item 1047 - Original Date: 6216, Formatted Date: null
/js/worker.js:86 [Worker] Item 1047 - Invalid formatted date: 6216
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1048: (9) ['6224', '3260', '(股)', 16528769, 41.7, 44.15, 41.7, 2.35, null]
/js/worker.js:84 [Worker] Item 1048 - Original Date: 6224, Formatted Date: null
/js/worker.js:86 [Worker] Item 1048 - Invalid formatted date: 6224
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1049: (9) ['6225', '3260', '(股)', 67617, 16.8, 16.8, 16.7, -0.4, null]
/js/worker.js:84 [Worker] Item 1049 - Original Date: 6225, Formatted Date: null
/js/worker.js:86 [Worker] Item 1049 - Invalid formatted date: 6225
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1050: (9) ['6226', '3260', '(股)', 841742, 7.03, 7.09, 7.02, 0.05, null]
/js/worker.js:84 [Worker] Item 1050 - Original Date: 6226, Formatted Date: null
/js/worker.js:86 [Worker] Item 1050 - Invalid formatted date: 6226
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1051: (9) ['6230', '3260', '(股)', 58736788, 141.5, 149, 141.5, 6, null]
/js/worker.js:84 [Worker] Item 1051 - Original Date: 6230, Formatted Date: null
/js/worker.js:86 [Worker] Item 1051 - Invalid formatted date: 6230
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1052: (9) ['6235', '3260', '(股)', 418176287, 67.2, 67.8, 64.7, -1.6, null]
/js/worker.js:84 [Worker] Item 1052 - Original Date: 6235, Formatted Date: null
/js/worker.js:86 [Worker] Item 1052 - Invalid formatted date: 6235
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1053: (9) ['6239', '3260', '(股)', 3412219723, 149, 153, 147, 4.5, null]
/js/worker.js:84 [Worker] Item 1053 - Original Date: 6239, Formatted Date: null
/js/worker.js:86 [Worker] Item 1053 - Invalid formatted date: 6239
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1054: (9) ['6243', '3260', '(股)', 22624369, 35.6, 37.9, 35.5, 2, null]
/js/worker.js:84 [Worker] Item 1054 - Original Date: 6243, Formatted Date: null
/js/worker.js:86 [Worker] Item 1054 - Invalid formatted date: 6243
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1055: (9) ['6257', '3260', '(股)', 556958586, 89.4, 92, 89, 3.5, null]
/js/worker.js:84 [Worker] Item 1055 - Original Date: 6257, Formatted Date: null
/js/worker.js:86 [Worker] Item 1055 - Invalid formatted date: 6257
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1056: (9) ['6269', '3260', '(股)', 183315670, 65, 66.2, 64.4, 1.6, null]
/js/worker.js:84 [Worker] Item 1056 - Original Date: 6269, Formatted Date: null
/js/worker.js:86 [Worker] Item 1056 - Invalid formatted date: 6269
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1057: (9) ['6271', '3260', '(股)', 521142565, 117.5, 123, 117.5, 5, null]
/js/worker.js:84 [Worker] Item 1057 - Original Date: 6271, Formatted Date: null
/js/worker.js:86 [Worker] Item 1057 - Invalid formatted date: 6271
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1058: (9) ['6277', '3260', '(股)', 4515649, 61.5, 61.5, 60.8, -0.2, null]
/js/worker.js:84 [Worker] Item 1058 - Original Date: 6277, Formatted Date: null
/js/worker.js:86 [Worker] Item 1058 - Invalid formatted date: 6277
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1059: (9) ['6278', '3260', '(股)', 201076033, 105.5, 107, 105, 2, null]
/js/worker.js:84 [Worker] Item 1059 - Original Date: 6278, Formatted Date: null
/js/worker.js:86 [Worker] Item 1059 - Invalid formatted date: 6278
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1060: (9) ['6281', '3260', '(股)', 5300126, 67.7, 68.3, 67.7, 0.6, null]
/js/worker.js:84 [Worker] Item 1060 - Original Date: 6281, Formatted Date: null
/js/worker.js:86 [Worker] Item 1060 - Invalid formatted date: 6281
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1061: (9) ['6282', '3260', '(股)', 187463329, 30.25, 30.45, 29.9, -0.15, null]
/js/worker.js:84 [Worker] Item 1061 - Original Date: 6282, Formatted Date: null
/js/worker.js:86 [Worker] Item 1061 - Invalid formatted date: 6282
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1062: (9) ['6283', '3260', '(股)', 3623570, 25.1, 25.55, 25, 0.15, null]
/js/worker.js:84 [Worker] Item 1062 - Original Date: 6283, Formatted Date: null
/js/worker.js:86 [Worker] Item 1062 - Invalid formatted date: 6283
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1063: (9) ['6285', '3260', '(股)', 249657888, 120, 120.5, 118.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1063 - Original Date: 6285, Formatted Date: null
/js/worker.js:86 [Worker] Item 1063 - Invalid formatted date: 6285
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1064: (9) ['6405', '3260', '(股)', 6953419, 25.25, 26.4, 25.25, 0.75, null]
/js/worker.js:84 [Worker] Item 1064 - Original Date: 6405, Formatted Date: null
/js/worker.js:86 [Worker] Item 1064 - Invalid formatted date: 6405
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1065: (9) ['6409', '3260', '(股)', 600975113, 956, 988, 945, 33, null]
/js/worker.js:84 [Worker] Item 1065 - Original Date: 6409, Formatted Date: null
/js/worker.js:86 [Worker] Item 1065 - Invalid formatted date: 6409
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1066: (9) ['6412', '3260', '(股)', 111543209, 102.5, 105, 102, 2, null]
/js/worker.js:84 [Worker] Item 1066 - Original Date: 6412, Formatted Date: null
/js/worker.js:86 [Worker] Item 1066 - Invalid formatted date: 6412
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1067: (9) ['6414', '3260', '(股)', 109052647, 300, 303.5, 299, 5, null]
/js/worker.js:84 [Worker] Item 1067 - Original Date: 6414, Formatted Date: null
/js/worker.js:86 [Worker] Item 1067 - Invalid formatted date: 6414
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1068: (9) ['6415', '3260', '(股)', 1240269378, 287, 298, 286.5, 6.5, null]
/js/worker.js:84 [Worker] Item 1068 - Original Date: 6415, Formatted Date: null
/js/worker.js:86 [Worker] Item 1068 - Invalid formatted date: 6415
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1069: (9) ['6416', '3260', '(股)', 17467346, 87.2, 88.6, 87.2, 1, null]
/js/worker.js:84 [Worker] Item 1069 - Original Date: 6416, Formatted Date: null
/js/worker.js:86 [Worker] Item 1069 - Invalid formatted date: 6416
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1070: (9) ['6423', '3260', '(股)', 1312855, 79.7, 81, 79.7, 1, null]
/js/worker.js:84 [Worker] Item 1070 - Original Date: 6423, Formatted Date: null
/js/worker.js:86 [Worker] Item 1070 - Invalid formatted date: 6423
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1071: (9) ['6426', '3260', '(股)', 8120029, 73.6, 75.1, 73.6, 0.3, null]
/js/worker.js:84 [Worker] Item 1071 - Original Date: 6426, Formatted Date: null
/js/worker.js:86 [Worker] Item 1071 - Invalid formatted date: 6426
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1072: (9) ['6431', '3260', '(股)', 580779, 16.1, 16.35, 16.1, -0.1, null]
/js/worker.js:84 [Worker] Item 1072 - Original Date: 6431, Formatted Date: null
/js/worker.js:86 [Worker] Item 1072 - Invalid formatted date: 6431
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1073: (9) ['6438', '3260', '(股)', 183510627, 173.5, 176, 172, 2, null]
/js/worker.js:84 [Worker] Item 1073 - Original Date: 6438, Formatted Date: null
/js/worker.js:86 [Worker] Item 1073 - Invalid formatted date: 6438
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1074: (9) ['6442', '3260', '(股)', 3332645950, 848, 848, 808, -29, null]
/js/worker.js:84 [Worker] Item 1074 - Original Date: 6442, Formatted Date: null
/js/worker.js:86 [Worker] Item 1074 - Invalid formatted date: 6442
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1075: (9) ['6443', '3260', '(股)', 212561145, 15.8, 15.9, 15.55, 0.4, null]
/js/worker.js:84 [Worker] Item 1075 - Original Date: 6443, Formatted Date: null
/js/worker.js:86 [Worker] Item 1075 - Invalid formatted date: 6443
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1076: (9) ['6446', '3260', '(股)', 1135376606, 483.5, 488, 477, 2.5, null]
/js/worker.js:84 [Worker] Item 1076 - Original Date: 6446, Formatted Date: null
/js/worker.js:86 [Worker] Item 1076 - Invalid formatted date: 6446
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1077: (9) ['6449', '3260', '(股)', 805078807, 191, 195.5, 185.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1077 - Original Date: 6449, Formatted Date: null
/js/worker.js:86 [Worker] Item 1077 - Invalid formatted date: 6449
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1078: (9) ['6451', '3260', '(股)', 108688426, 160, 162.5, 159, 3.5, null]
/js/worker.js:84 [Worker] Item 1078 - Original Date: 6451, Formatted Date: null
/js/worker.js:86 [Worker] Item 1078 - Invalid formatted date: 6451
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1079: (9) ['6456', '3260', '(股)', 75483552, 63.5, 63.7, 62.1, 0.6, null]
/js/worker.js:84 [Worker] Item 1079 - Original Date: 6456, Formatted Date: null
/js/worker.js:86 [Worker] Item 1079 - Invalid formatted date: 6456
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1080: (9) ['6464', '3260', '(股)', 342585, 77.3, 77.7, 77.3, -0.1, null]
/js/worker.js:84 [Worker] Item 1080 - Original Date: 6464, Formatted Date: null
/js/worker.js:86 [Worker] Item 1080 - Invalid formatted date: 6464
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1081: (9) ['6472', '3260', '(股)', 480381487, 697, 710, 696, 3, null]
/js/worker.js:84 [Worker] Item 1081 - Original Date: 6472, Formatted Date: null
/js/worker.js:86 [Worker] Item 1081 - Invalid formatted date: 6472
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1082: (9) ['6477', '3260', '(股)', 305549289, 44.55, 46.75, 42.5, -1.55, null]
/js/worker.js:84 [Worker] Item 1082 - Original Date: 6477, Formatted Date: null
/js/worker.js:86 [Worker] Item 1082 - Invalid formatted date: 6477
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1083: (9) ['6491', '3260', '(股)', 113914857, 308, 317.5, 308, 9.5, null]
/js/worker.js:84 [Worker] Item 1083 - Original Date: 6491, Formatted Date: null
/js/worker.js:86 [Worker] Item 1083 - Invalid formatted date: 6491
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1084: (9) ['6504', '3260', '(股)', 1637973, 49.4, 50.1, 49.3, 0.3, null]
/js/worker.js:84 [Worker] Item 1084 - Original Date: 6504, Formatted Date: null
/js/worker.js:86 [Worker] Item 1084 - Invalid formatted date: 6504
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1085: (9) ['6505', '3260', '(股)', 134528736, 39.1, 39.3, 38.7, -0.05, null]
/js/worker.js:84 [Worker] Item 1085 - Original Date: 6505, Formatted Date: null
/js/worker.js:86 [Worker] Item 1085 - Invalid formatted date: 6505
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1086: (9) ['6515', '3260', '(股)', 2675694605, 1720, 1875, 1680, 170, null]
/js/worker.js:84 [Worker] Item 1086 - Original Date: 6515, Formatted Date: null
/js/worker.js:86 [Worker] Item 1086 - Invalid formatted date: 6515
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1087: (9) ['6525', '3260', '(股)', 35018748, 83.5, 84.6, 82.7, -0.3, null]
/js/worker.js:84 [Worker] Item 1087 - Original Date: 6525, Formatted Date: null
/js/worker.js:86 [Worker] Item 1087 - Invalid formatted date: 6525
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1088: (9) ['6526', '3260', '(股)', 175355510, 551, 567, 551, 9, null]
/js/worker.js:84 [Worker] Item 1088 - Original Date: 6526, Formatted Date: null
/js/worker.js:86 [Worker] Item 1088 - Invalid formatted date: 6526
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1089: (9) ['6531', '3260', '(股)', 4783122635, 330, 359, 330, 27, null]
/js/worker.js:84 [Worker] Item 1089 - Original Date: 6531, Formatted Date: null
/js/worker.js:86 [Worker] Item 1089 - Invalid formatted date: 6531
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1090: (9) ['6533', '3260', '(股)', 290143896, 320.5, 330.5, 320, 2, null]
/js/worker.js:84 [Worker] Item 1090 - Original Date: 6533, Formatted Date: null
/js/worker.js:86 [Worker] Item 1090 - Invalid formatted date: 6533
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1091: (9) ['6534', '3260', '(股)', 4271214, 112, 112, 109.5, -2, null]
/js/worker.js:84 [Worker] Item 1091 - Original Date: 6534, Formatted Date: null
/js/worker.js:86 [Worker] Item 1091 - Invalid formatted date: 6534
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1092: (9) ['6541', '3260', '(股)', 11904745, 49.5, 50, 49.4, 0.2, null]
/js/worker.js:84 [Worker] Item 1092 - Original Date: 6541, Formatted Date: null
/js/worker.js:86 [Worker] Item 1092 - Invalid formatted date: 6541
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1093: (9) ['6550', '3260', '(股)', 14495348, 37.9, 38.1, 37.4, -0.05, null]
/js/worker.js:84 [Worker] Item 1093 - Original Date: 6550, Formatted Date: null
/js/worker.js:86 [Worker] Item 1093 - Invalid formatted date: 6550
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1094: (9) ['6552', '3260', '(股)', 3666261, 28.95, 29.95, 28.8, 0.6, null]
/js/worker.js:84 [Worker] Item 1094 - Original Date: 6552, Formatted Date: null
/js/worker.js:86 [Worker] Item 1094 - Invalid formatted date: 6552
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1095: (9) ['6558', '3260', '(股)', 72357152, 50.3, 50.7, 49.35, -0.6, null]
/js/worker.js:84 [Worker] Item 1095 - Original Date: 6558, Formatted Date: null
/js/worker.js:86 [Worker] Item 1095 - Invalid formatted date: 6558
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1096: (9) ['6573', '3260', '(股)', 2243195, 9.74, 10.65, 9.73, 0.95, null]
/js/worker.js:84 [Worker] Item 1096 - Original Date: 6573, Formatted Date: null
/js/worker.js:86 [Worker] Item 1096 - Invalid formatted date: 6573
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1097: (9) ['6579', '3260', '(股)', 24284115, 126.5, 126.5, 124.5, -1, null]
/js/worker.js:84 [Worker] Item 1097 - Original Date: 6579, Formatted Date: null
/js/worker.js:86 [Worker] Item 1097 - Invalid formatted date: 6579
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1098: (9) ['6581', '3260', '(股)', 1101804, 110, 110, 109.5, -1, null]
/js/worker.js:84 [Worker] Item 1098 - Original Date: 6581, Formatted Date: null
/js/worker.js:86 [Worker] Item 1098 - Invalid formatted date: 6581
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1099: (9) ['6582', '3260', '(股)', 2525896, 31.3, 31.3, 30.3, 0.05, null]
/js/worker.js:84 [Worker] Item 1099 - Original Date: 6582, Formatted Date: null
/js/worker.js:86 [Worker] Item 1099 - Invalid formatted date: 6582
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1100: (9) ['6585', '3260', '(股)', 5765346, 104, 104.5, 103.5, 0, null]
/js/worker.js:84 [Worker] Item 1100 - Original Date: 6585, Formatted Date: null
/js/worker.js:86 [Worker] Item 1100 - Invalid formatted date: 6585
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1101: (9) ['6589', '3260', '(股)', 21938903, 60.7, 61.2, 60.6, 0.3, null]
/js/worker.js:84 [Worker] Item 1101 - Original Date: 6589, Formatted Date: null
/js/worker.js:86 [Worker] Item 1101 - Invalid formatted date: 6589
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1102: (9) ['6591', '3260', '(股)', 79097015, 80.5, 82.1, 80.2, 1.6, null]
/js/worker.js:84 [Worker] Item 1102 - Original Date: 6591, Formatted Date: null
/js/worker.js:86 [Worker] Item 1102 - Invalid formatted date: 6591
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1103: (9) ['6592', '3260', '(股)', 11118202, 69, 69, 68, 0.1, null]
/js/worker.js:84 [Worker] Item 1103 - Original Date: 6592, Formatted Date: null
/js/worker.js:86 [Worker] Item 1103 - Invalid formatted date: 6592
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1104: (9) ['6592A', '3260', '(股)', 684670, 97.6, 97.8, 97.6, 0.3, null]
/js/worker.js:84 [Worker] Item 1104 - Original Date: 6592A, Formatted Date: null
/js/worker.js:86 [Worker] Item 1104 - Invalid formatted date: 6592A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1105: (9) ['6592B', '3260', '(股)', 199757, 98.7, 98.7, 98.6, 0, null]
/js/worker.js:84 [Worker] Item 1105 - Original Date: 6592B, Formatted Date: null
/js/worker.js:86 [Worker] Item 1105 - Invalid formatted date: 6592B
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1106: (9) ['6598', '3260', '(股)', 2165751, 23, 23, 22.65, -0.1, null]
/js/worker.js:84 [Worker] Item 1106 - Original Date: 6598, Formatted Date: null
/js/worker.js:86 [Worker] Item 1106 - Invalid formatted date: 6598
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1107: (9) ['6605', '3260', '(股)', 29362251, 133, 134, 132.5, 0, null]
/js/worker.js:84 [Worker] Item 1107 - Original Date: 6605, Formatted Date: null
/js/worker.js:86 [Worker] Item 1107 - Invalid formatted date: 6605
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1108: (9) ['6606', '3260', '(股)', 1387752, 25.45, 25.75, 25.45, 0.1, null]
/js/worker.js:84 [Worker] Item 1108 - Original Date: 6606, Formatted Date: null
/js/worker.js:86 [Worker] Item 1108 - Invalid formatted date: 6606
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1109: (9) ['6625', '3260', '(股)', 24433345, 84.7, 86, 84.7, 0, null]
/js/worker.js:84 [Worker] Item 1109 - Original Date: 6625, Formatted Date: null
/js/worker.js:86 [Worker] Item 1109 - Invalid formatted date: 6625
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1110: (9) ['6641', '3260', '(股)', 362450, 20.2, 20.2, 20.1, 0, null]
/js/worker.js:84 [Worker] Item 1110 - Original Date: 6641, Formatted Date: null
/js/worker.js:86 [Worker] Item 1110 - Invalid formatted date: 6641
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1111: (9) ['6645', '3260', '(股)', 844418, 23.7, 23.7, 23.3, -0.3, null]
/js/worker.js:84 [Worker] Item 1111 - Original Date: 6645, Formatted Date: null
/js/worker.js:86 [Worker] Item 1111 - Invalid formatted date: 6645
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1112: (9) ['6655', '3260', '(股)', 493612, 116.5, 116.5, 116.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1112 - Original Date: 6655, Formatted Date: null
/js/worker.js:86 [Worker] Item 1112 - Invalid formatted date: 6655
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1113: (9) ['6657', '3260', '(股)', 12231380, 54.3, 55.3, 53.5, 0.1, null]
/js/worker.js:84 [Worker] Item 1113 - Original Date: 6657, Formatted Date: null
/js/worker.js:86 [Worker] Item 1113 - Invalid formatted date: 6657
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1114: (9) ['6658', '3260', '(股)', 15082097, 60.6, 61.8, 60.4, 1.4, null]
/js/worker.js:84 [Worker] Item 1114 - Original Date: 6658, Formatted Date: null
/js/worker.js:86 [Worker] Item 1114 - Invalid formatted date: 6658
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1115: (9) ['6666', '3260', '(股)', 3877170, 51.4, 52.4, 50.2, -0.4, null]
/js/worker.js:84 [Worker] Item 1115 - Original Date: 6666, Formatted Date: null
/js/worker.js:86 [Worker] Item 1115 - Invalid formatted date: 6666
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1116: (9) ['6668', '3260', '(股)', 12964298, 45.45, 45.7, 44.7, 0.25, null]
/js/worker.js:84 [Worker] Item 1116 - Original Date: 6668, Formatted Date: null
/js/worker.js:86 [Worker] Item 1116 - Invalid formatted date: 6668
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1117: (9) ['6669', '3260', '(股)', 5091225505, 3160, 3260, 3140, 40, null]
/js/worker.js:84 [Worker] Item 1117 - Original Date: 6669, Formatted Date: null
/js/worker.js:86 [Worker] Item 1117 - Invalid formatted date: 6669
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1118: (9) ['6670', '3260', '(股)', 140573816, 270, 272, 267, 2, null]
/js/worker.js:84 [Worker] Item 1118 - Original Date: 6670, Formatted Date: null
/js/worker.js:86 [Worker] Item 1118 - Invalid formatted date: 6670
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1119: (9) ['6671', '3260', '(股)', 147600, 37, 37, 36.8, -0.05, null]
/js/worker.js:84 [Worker] Item 1119 - Original Date: 6671, Formatted Date: null
/js/worker.js:86 [Worker] Item 1119 - Invalid formatted date: 6671
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1120: (9) ['6672', '3260', '(股)', 268511546, 109.5, 110.5, 105.5, -2.5, null]
/js/worker.js:84 [Worker] Item 1120 - Original Date: 6672, Formatted Date: null
/js/worker.js:86 [Worker] Item 1120 - Invalid formatted date: 6672
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1121: (9) ['6674', '3260', '(股)', 706410, 20.95, 20.95, 20.5, 0, null]
/js/worker.js:84 [Worker] Item 1121 - Original Date: 6674, Formatted Date: null
/js/worker.js:86 [Worker] Item 1121 - Invalid formatted date: 6674
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1122: (9) ['6689', '3260', '(股)', 20742937, 76.4, 78, 76.4, 0.9, null]
/js/worker.js:84 [Worker] Item 1122 - Original Date: 6689, Formatted Date: null
/js/worker.js:86 [Worker] Item 1122 - Invalid formatted date: 6689
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1123: (9) ['6691', '3260', '(股)', 206730116, 450, 453.5, 446.5, 1.5, null]
/js/worker.js:84 [Worker] Item 1123 - Original Date: 6691, Formatted Date: null
/js/worker.js:86 [Worker] Item 1123 - Invalid formatted date: 6691
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1124: (9) ['6695', '3260', '(股)', 110930143, 53.2, 54.3, 52.8, 0.4, null]
/js/worker.js:84 [Worker] Item 1124 - Original Date: 6695, Formatted Date: null
/js/worker.js:86 [Worker] Item 1124 - Invalid formatted date: 6695
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1125: (9) ['6698', '3260', '(股)', 7021824, 36, 36.9, 35.9, 0.3, null]
/js/worker.js:84 [Worker] Item 1125 - Original Date: 6698, Formatted Date: null
/js/worker.js:86 [Worker] Item 1125 - Invalid formatted date: 6698
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1126: (9) ['6706', '3260', '(股)', 1125905352, 76.6, 81.7, 75.6, 4.6, null]
/js/worker.js:84 [Worker] Item 1126 - Original Date: 6706, Formatted Date: null
/js/worker.js:86 [Worker] Item 1126 - Invalid formatted date: 6706
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1127: (9) ['6715', '3260', '(股)', 4321086, 96.8, 97.5, 96.5, 0.3, null]
/js/worker.js:84 [Worker] Item 1127 - Original Date: 6715, Formatted Date: null
/js/worker.js:86 [Worker] Item 1127 - Invalid formatted date: 6715
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1128: (9) ['6719', '3260', '(股)', 172181239, 209, 213, 208, 3.5, null]
/js/worker.js:84 [Worker] Item 1128 - Original Date: 6719, Formatted Date: null
/js/worker.js:86 [Worker] Item 1128 - Invalid formatted date: 6719
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1129: (9) ['6742', '3260', '(股)', 128864005, 58.6, 60.8, 57.8, 1.1, null]
/js/worker.js:84 [Worker] Item 1129 - Original Date: 6742, Formatted Date: null
/js/worker.js:86 [Worker] Item 1129 - Invalid formatted date: 6742
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1130: (9) ['6743', '3260', '(股)', 10228652, 34.9, 35.5, 34.25, -0.65, null]
/js/worker.js:84 [Worker] Item 1130 - Original Date: 6743, Formatted Date: null
/js/worker.js:86 [Worker] Item 1130 - Invalid formatted date: 6743
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1131: (9) ['6753', '3260', '(股)', 1511789101, 169.5, 171.5, 156, -10, null]
/js/worker.js:84 [Worker] Item 1131 - Original Date: 6753, Formatted Date: null
/js/worker.js:86 [Worker] Item 1131 - Invalid formatted date: 6753
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1132: (9) ['6754', '3260', '(股)', 1185263, 49.5, 49.5, 48.9, -0.6, null]
/js/worker.js:84 [Worker] Item 1132 - Original Date: 6754, Formatted Date: null
/js/worker.js:86 [Worker] Item 1132 - Invalid formatted date: 6754
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1133: (9) ['6756', '3260', '(股)', 37650186, 93.6, 97.6, 93.6, 3.2, null]
/js/worker.js:84 [Worker] Item 1133 - Original Date: 6756, Formatted Date: null
/js/worker.js:86 [Worker] Item 1133 - Invalid formatted date: 6756
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1134: (9) ['6757', '3260', '(股)', 559962157, 82, 82, 79.8, null, null]
/js/worker.js:84 [Worker] Item 1134 - Original Date: 6757, Formatted Date: null
/js/worker.js:86 [Worker] Item 1134 - Invalid formatted date: 6757
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1135: (9) ['6768', '3260', '(股)', 218240796, 101, 106.5, 101, 3.5, null]
/js/worker.js:84 [Worker] Item 1135 - Original Date: 6768, Formatted Date: null
/js/worker.js:86 [Worker] Item 1135 - Invalid formatted date: 6768
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1136: (9) ['6770', '3260', '(股)', 7110942517, 21.25, 22.4, 20.95, 2, null]
/js/worker.js:84 [Worker] Item 1136 - Original Date: 6770, Formatted Date: null
/js/worker.js:86 [Worker] Item 1136 - Invalid formatted date: 6770
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1137: (9) ['6771', '3260', '(股)', 1628893, 51.9, 52.4, 51.8, -0.2, null]
/js/worker.js:84 [Worker] Item 1137 - Original Date: 6771, Formatted Date: null
/js/worker.js:86 [Worker] Item 1137 - Invalid formatted date: 6771
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1138: (9) ['6776', '3260', '(股)', 5514540, 52.9, 53.8, 52.9, 0.6, null]
/js/worker.js:84 [Worker] Item 1138 - Original Date: 6776, Formatted Date: null
/js/worker.js:86 [Worker] Item 1138 - Invalid formatted date: 6776
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1139: (9) ['6781', '3260', '(股)', 1389104250, 1245, 1250, 1215, 15, null]
/js/worker.js:84 [Worker] Item 1139 - Original Date: 6781, Formatted Date: null
/js/worker.js:86 [Worker] Item 1139 - Invalid formatted date: 6781
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1140: (9) ['6782', '3260', '(股)', 28538573, 190, 190.5, 188, 0, null]
/js/worker.js:84 [Worker] Item 1140 - Original Date: 6782, Formatted Date: null
/js/worker.js:86 [Worker] Item 1140 - Invalid formatted date: 6782
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1141: (9) ['6789', '3260', '(股)', 1178875676, 299, 307, 299, 3.5, null]
/js/worker.js:84 [Worker] Item 1141 - Original Date: 6789, Formatted Date: null
/js/worker.js:86 [Worker] Item 1141 - Invalid formatted date: 6789
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1142: (9) ['6790', '3260', '(股)', 6134829, 38.75, 38.75, 38.4, -0.05, null]
/js/worker.js:84 [Worker] Item 1142 - Original Date: 6790, Formatted Date: null
/js/worker.js:86 [Worker] Item 1142 - Invalid formatted date: 6790
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1143: (9) ['6792', '3260', '(股)', 5706155, 58.8, 60, 58.5, 0, null]
/js/worker.js:84 [Worker] Item 1143 - Original Date: 6792, Formatted Date: null
/js/worker.js:86 [Worker] Item 1143 - Invalid formatted date: 6792
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1144: (9) ['6794', '3260', '(股)', 2565047, 81.9, 81.9, 78.5, 0.6, null]
/js/worker.js:84 [Worker] Item 1144 - Original Date: 6794, Formatted Date: null
/js/worker.js:86 [Worker] Item 1144 - Invalid formatted date: 6794
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1145: (9) ['6796', '3260', '(股)', 1471357, 74, 74, 73.3, -0.7, null]
/js/worker.js:84 [Worker] Item 1145 - Original Date: 6796, Formatted Date: null
/js/worker.js:86 [Worker] Item 1145 - Invalid formatted date: 6796
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1146: (9) ['6799', '3260', '(股)', 209342196, 89.4, 97.4, 89.4, 5.6, null]
/js/worker.js:84 [Worker] Item 1146 - Original Date: 6799, Formatted Date: null
/js/worker.js:86 [Worker] Item 1146 - Invalid formatted date: 6799
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1147: (9) ['6805', '3260', '(股)', 2326454374, 986, 1015, 968, 20, null]
/js/worker.js:84 [Worker] Item 1147 - Original Date: 6805, Formatted Date: null
/js/worker.js:86 [Worker] Item 1147 - Invalid formatted date: 6805
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1148: (9) ['6806', '3260', '(股)', 198506755, 57.6, 60.1, 56.8, 2.7, null]
/js/worker.js:84 [Worker] Item 1148 - Original Date: 6806, Formatted Date: null
/js/worker.js:86 [Worker] Item 1148 - Invalid formatted date: 6806
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1149: (9) ['6807', '3260', '(股)', 553028, 49.7, 50.3, 49.7, 0.05, null]
/js/worker.js:84 [Worker] Item 1149 - Original Date: 6807, Formatted Date: null
/js/worker.js:86 [Worker] Item 1149 - Invalid formatted date: 6807
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1150: (9) ['6830', '3260', '(股)', 70114985, 170, 171.5, 167.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1150 - Original Date: 6830, Formatted Date: null
/js/worker.js:86 [Worker] Item 1150 - Invalid formatted date: 6830
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1151: (9) ['6834', '3260', '(股)', 3003560, 28.9, 29.8, 28.9, 0.5, null]
/js/worker.js:84 [Worker] Item 1151 - Original Date: 6834, Formatted Date: null
/js/worker.js:86 [Worker] Item 1151 - Invalid formatted date: 6834
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1152: (9) ['6835', '3260', '(股)', 3242141, 39.7, 40, 39.25, 0.05, null]
/js/worker.js:84 [Worker] Item 1152 - Original Date: 6835, Formatted Date: null
/js/worker.js:86 [Worker] Item 1152 - Invalid formatted date: 6835
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1153: (9) ['6838', '3260', '(股)', 8134272, 30.8, 31.5, 30.7, 0.25, null]
/js/worker.js:84 [Worker] Item 1153 - Original Date: 6838, Formatted Date: null
/js/worker.js:86 [Worker] Item 1153 - Invalid formatted date: 6838
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1154: (9) ['6854', '3260', '(股)', 50372792, 166.5, 166.5, 160, -3, null]
/js/worker.js:84 [Worker] Item 1154 - Original Date: 6854, Formatted Date: null
/js/worker.js:86 [Worker] Item 1154 - Invalid formatted date: 6854
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1155: (9) ['6861', '3260', '(股)', 13956871, 63.6, 63.6, 61, -0.5, null]
/js/worker.js:84 [Worker] Item 1155 - Original Date: 6861, Formatted Date: null
/js/worker.js:86 [Worker] Item 1155 - Invalid formatted date: 6861
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1156: (9) ['6862', '3260', '(股)', 130988316, 146, 157, 145.5, 14, null]
/js/worker.js:84 [Worker] Item 1156 - Original Date: 6862, Formatted Date: null
/js/worker.js:86 [Worker] Item 1156 - Invalid formatted date: 6862
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1157: (9) ['6863', '3260', '(股)', 23987426, 143.5, 144.5, 141.5, -0.5, null]
/js/worker.js:84 [Worker] Item 1157 - Original Date: 6863, Formatted Date: null
/js/worker.js:86 [Worker] Item 1157 - Invalid formatted date: 6863
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1158: (9) ['6869', '3260', '(股)', 82547568, 119.5, 121.5, 118, 2, null]
/js/worker.js:84 [Worker] Item 1158 - Original Date: 6869, Formatted Date: null
/js/worker.js:86 [Worker] Item 1158 - Invalid formatted date: 6869
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1159: (9) ['6873', '3260', '(股)', 138326180, 124.5, 127, 123.5, 2.5, null]
/js/worker.js:84 [Worker] Item 1159 - Original Date: 6873, Formatted Date: null
/js/worker.js:86 [Worker] Item 1159 - Invalid formatted date: 6873
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1160: (9) ['6885', '3260', '(股)', 13791805, 33.25, 33.25, 32.1, -0.5, null]
/js/worker.js:84 [Worker] Item 1160 - Original Date: 6885, Formatted Date: null
/js/worker.js:86 [Worker] Item 1160 - Invalid formatted date: 6885
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1161: (9) ['6887', '3260', '(股)', 1268382, 70.1, 70.1, 69.3, -0.6, null]
/js/worker.js:84 [Worker] Item 1161 - Original Date: 6887, Formatted Date: null
/js/worker.js:86 [Worker] Item 1161 - Invalid formatted date: 6887
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1162: (9) ['6890', '3260', '(股)', 329259912, 214, 227, 214, 12, null]
/js/worker.js:84 [Worker] Item 1162 - Original Date: 6890, Formatted Date: null
/js/worker.js:86 [Worker] Item 1162 - Invalid formatted date: 6890
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1163: (9) ['6901', '3260', '(股)', 14930853, 19.75, 20.25, 19.7, 0.1, null]
/js/worker.js:84 [Worker] Item 1163 - Original Date: 6901, Formatted Date: null
/js/worker.js:86 [Worker] Item 1163 - Invalid formatted date: 6901
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1164: (9) ['6902', '3260', '(股)', 5176382, 78.5, 78.6, 77, -1.1, null]
/js/worker.js:84 [Worker] Item 1164 - Original Date: 6902, Formatted Date: null
/js/worker.js:86 [Worker] Item 1164 - Invalid formatted date: 6902
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1165: (9) ['6906', '3260', '(股)', 8488350, 118, 119.5, 116, 0.5, null]
/js/worker.js:84 [Worker] Item 1165 - Original Date: 6906, Formatted Date: null
/js/worker.js:86 [Worker] Item 1165 - Invalid formatted date: 6906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1166: (9) ['6909', '3260', '(股)', 4158740, 46.3, 47.5, 46.3, 0.15, null]
/js/worker.js:84 [Worker] Item 1166 - Original Date: 6909, Formatted Date: null
/js/worker.js:86 [Worker] Item 1166 - Invalid formatted date: 6909
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1167: (9) ['6914', '3260', '(股)', 11231154, 146, 147, 145.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1167 - Original Date: 6914, Formatted Date: null
/js/worker.js:86 [Worker] Item 1167 - Invalid formatted date: 6914
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1168: (9) ['6916', '3260', '(股)', 515604, 19.1, 19.2, 18.7, 0.1, null]
/js/worker.js:84 [Worker] Item 1168 - Original Date: 6916, Formatted Date: null
/js/worker.js:86 [Worker] Item 1168 - Invalid formatted date: 6916
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1169: (9) ['6918', '3260', '(股)', 11376998, 91.8, 92, 90.2, -0.7, null]
/js/worker.js:84 [Worker] Item 1169 - Original Date: 6918, Formatted Date: null
/js/worker.js:86 [Worker] Item 1169 - Invalid formatted date: 6918
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1170: (9) ['6919', '3260', '(股)', 3468585720, 206, 206, 195, -2, null]
/js/worker.js:84 [Worker] Item 1170 - Original Date: 6919, Formatted Date: null
/js/worker.js:86 [Worker] Item 1170 - Invalid formatted date: 6919
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1171: (9) ['6923', '3260', '(股)', 286498815, 116, 117.5, 109.5, 2, null]
/js/worker.js:84 [Worker] Item 1171 - Original Date: 6923, Formatted Date: null
/js/worker.js:86 [Worker] Item 1171 - Invalid formatted date: 6923
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1172: (9) ['6924', '3260', '(股)', 247567, 62.2, 62.2, 61, null, null]
/js/worker.js:84 [Worker] Item 1172 - Original Date: 6924, Formatted Date: null
/js/worker.js:86 [Worker] Item 1172 - Invalid formatted date: 6924
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1173: (9) ['6928', '3260', '(股)', 188496600, 66, 69, 63.8, 2, null]
/js/worker.js:84 [Worker] Item 1173 - Original Date: 6928, Formatted Date: null
/js/worker.js:86 [Worker] Item 1173 - Invalid formatted date: 6928
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1174: (9) ['6931', '3260', '(股)', 2463145, 52, 52.1, 51.2, -0.1, null]
/js/worker.js:84 [Worker] Item 1174 - Original Date: 6931, Formatted Date: null
/js/worker.js:86 [Worker] Item 1174 - Invalid formatted date: 6931
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1175: (9) ['6933', '3260', '(股)', 29652819, 190, 193.5, 187, 3.5, null]
/js/worker.js:84 [Worker] Item 1175 - Original Date: 6933, Formatted Date: null
/js/worker.js:86 [Worker] Item 1175 - Invalid formatted date: 6933
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1176: (9) ['6936', '3260', '(股)', 1646950, 35.2, 35.45, 35.1, 0.1, null]
/js/worker.js:84 [Worker] Item 1176 - Original Date: 6936, Formatted Date: null
/js/worker.js:86 [Worker] Item 1176 - Invalid formatted date: 6936
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1177: (9) ['6937', '3260', '(股)', 183634208, 251.5, 254, 245.5, -4, null]
/js/worker.js:84 [Worker] Item 1177 - Original Date: 6937, Formatted Date: null
/js/worker.js:86 [Worker] Item 1177 - Invalid formatted date: 6937
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1178: (9) ['6944', '3260', '(股)', 188758511, 535, 547, 535, 0, null]
/js/worker.js:84 [Worker] Item 1178 - Original Date: 6944, Formatted Date: null
/js/worker.js:86 [Worker] Item 1178 - Invalid formatted date: 6944
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1179: (9) ['6949', '3260', '(股)', 50028104, 410.5, 418.5, 410, -9, null]
/js/worker.js:84 [Worker] Item 1179 - Original Date: 6949, Formatted Date: null
/js/worker.js:86 [Worker] Item 1179 - Invalid formatted date: 6949
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1180: (9) ['6951', '3260', '(股)', 1624618, 75, 75.4, 74.9, 0.4, null]
/js/worker.js:84 [Worker] Item 1180 - Original Date: 6951, Formatted Date: null
/js/worker.js:86 [Worker] Item 1180 - Invalid formatted date: 6951
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1181: (9) ['6952', '3260', '(股)', 1377455, 46.8, 48, 46.8, 0.6, null]
/js/worker.js:84 [Worker] Item 1181 - Original Date: 6952, Formatted Date: null
/js/worker.js:86 [Worker] Item 1181 - Invalid formatted date: 6952
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1182: (9) ['6955', '3260', '(股)', 343296, 168.5, 169, 168.5, -2, null]
/js/worker.js:84 [Worker] Item 1182 - Original Date: 6955, Formatted Date: null
/js/worker.js:86 [Worker] Item 1182 - Invalid formatted date: 6955
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1183: (9) ['6957', '3260', '(股)', 13134212, 174.5, 181.5, 174.5, 4, null]
/js/worker.js:84 [Worker] Item 1183 - Original Date: 6957, Formatted Date: null
/js/worker.js:86 [Worker] Item 1183 - Invalid formatted date: 6957
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1184: (9) ['6958', '3260', '(股)', 2406473, 18.15, 18.6, 18, 0.15, null]
/js/worker.js:84 [Worker] Item 1184 - Original Date: 6958, Formatted Date: null
/js/worker.js:86 [Worker] Item 1184 - Invalid formatted date: 6958
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1185: (9) ['6962', '3260', '(股)', 193446056, 44.45, 45.45, 44.45, 0.75, null]
/js/worker.js:84 [Worker] Item 1185 - Original Date: 6962, Formatted Date: null
/js/worker.js:86 [Worker] Item 1185 - Invalid formatted date: 6962
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1186: (9) ['6965', '3260', '(股)', 8373529, 100.5, 101.5, 99.8, 1, null]
/js/worker.js:84 [Worker] Item 1186 - Original Date: 6965, Formatted Date: null
/js/worker.js:86 [Worker] Item 1186 - Invalid formatted date: 6965
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1187: (9) ['6969', '3260', '(股)', 927100, 39.65, 41.8, 39.55, 2, null]
/js/worker.js:84 [Worker] Item 1187 - Original Date: 6969, Formatted Date: null
/js/worker.js:86 [Worker] Item 1187 - Invalid formatted date: 6969
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1188: (9) ['6988', '3260', '(股)', 17500, 17.5, 17.5, 17.5, -0.15, null]
/js/worker.js:84 [Worker] Item 1188 - Original Date: 6988, Formatted Date: null
/js/worker.js:86 [Worker] Item 1188 - Invalid formatted date: 6988
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1189: (9) ['6994', '3260', '(股)', 78008565, 98.1, 101.5, 96.2, 2.9, null]
/js/worker.js:84 [Worker] Item 1189 - Original Date: 6994, Formatted Date: null
/js/worker.js:86 [Worker] Item 1189 - Invalid formatted date: 6994
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1190: (9) ['7610', '3260', '(股)', 63476567, 109, 109.5, 100.5, -5, null]
/js/worker.js:84 [Worker] Item 1190 - Original Date: 7610, Formatted Date: null
/js/worker.js:86 [Worker] Item 1190 - Invalid formatted date: 7610
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1191: (9) ['7631', '3260', '(股)', 2226042, 148, 148, 146, -0.5, null]
/js/worker.js:84 [Worker] Item 1191 - Original Date: 7631, Formatted Date: null
/js/worker.js:86 [Worker] Item 1191 - Invalid formatted date: 7631
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1192: (9) ['7705', '3260', '(股)', 2690306, 43.65, 43.65, 43.3, -0.05, null]
/js/worker.js:84 [Worker] Item 1192 - Original Date: 7705, Formatted Date: null
/js/worker.js:86 [Worker] Item 1192 - Invalid formatted date: 7705
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1193: (9) ['7721', '3260', '(股)', 2541018, 63.3, 64.5, 63.3, 0.3, null]
/js/worker.js:84 [Worker] Item 1193 - Original Date: 7721, Formatted Date: null
/js/worker.js:86 [Worker] Item 1193 - Invalid formatted date: 7721
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1194: (9) ['7722', '3260', '(股)', 46036187, 620, 625, 610, -1, null]
/js/worker.js:84 [Worker] Item 1194 - Original Date: 7722, Formatted Date: null
/js/worker.js:86 [Worker] Item 1194 - Invalid formatted date: 7722
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1195: (9) ['7732', '3260', '(股)', 147700, 37, 37, 36.7, 0, null]
/js/worker.js:84 [Worker] Item 1195 - Original Date: 7732, Formatted Date: null
/js/worker.js:86 [Worker] Item 1195 - Invalid formatted date: 7732
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1196: (9) ['7736', '3260', '(股)', 1304869, 90.7, 93.7, 90.7, 2, null]
/js/worker.js:84 [Worker] Item 1196 - Original Date: 7736, Formatted Date: null
/js/worker.js:86 [Worker] Item 1196 - Invalid formatted date: 7736
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1197: (9) ['7740', '3260', '(股)', 31472674, 223, 223, 214, -8, null]
/js/worker.js:84 [Worker] Item 1197 - Original Date: 7740, Formatted Date: null
/js/worker.js:86 [Worker] Item 1197 - Invalid formatted date: 7740
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1198: (9) ['7749', '3260', '(股)', 67975128, 549, 549, 543, 4, null]
/js/worker.js:84 [Worker] Item 1198 - Original Date: 7749, Formatted Date: null
/js/worker.js:86 [Worker] Item 1198 - Invalid formatted date: 7749
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1199: (9) ['7750', '3260', '(股)', 1197789460, 915, 923, 886, -24, null]
/js/worker.js:84 [Worker] Item 1199 - Original Date: 7750, Formatted Date: null
/js/worker.js:86 [Worker] Item 1199 - Invalid formatted date: 7750
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1200: (9) ['7765', '3260', '(股)', 37877157, 307.5, 312, 305.5, 2.5, null]
/js/worker.js:84 [Worker] Item 1200 - Original Date: 7765, Formatted Date: null
/js/worker.js:86 [Worker] Item 1200 - Invalid formatted date: 7765
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1201: (9) ['7780', '3260', '(股)', 751168988, 240, 240, 215, 11, null]
/js/worker.js:84 [Worker] Item 1201 - Original Date: 7780, Formatted Date: null
/js/worker.js:86 [Worker] Item 1201 - Invalid formatted date: 7780
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1202: (9) ['7799', '3260', '(股)', 1185665544, 802, 810, 750, -60, null]
/js/worker.js:84 [Worker] Item 1202 - Original Date: 7799, Formatted Date: null
/js/worker.js:86 [Worker] Item 1202 - Invalid formatted date: 7799
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1203: (9) ['8011', '3260', '(股)', 13065207, 22.55, 22.6, 22.3, 0.1, null]
/js/worker.js:84 [Worker] Item 1203 - Original Date: 8011, Formatted Date: null
/js/worker.js:86 [Worker] Item 1203 - Invalid formatted date: 8011
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1204: (9) ['8016', '3260', '(股)', 131763745, 212, 213.5, 211, 0.5, null]
/js/worker.js:84 [Worker] Item 1204 - Original Date: 8016, Formatted Date: null
/js/worker.js:86 [Worker] Item 1204 - Invalid formatted date: 8016
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1205: (9) ['8021', '3260', '(股)', 3869470568, 93, 97.2, 89.8, 0.6, null]
/js/worker.js:84 [Worker] Item 1205 - Original Date: 8021, Formatted Date: null
/js/worker.js:86 [Worker] Item 1205 - Invalid formatted date: 8021
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1206: (9) ['8028', '3260', '(股)', 1191922942, 172, 175, 170, 2, null]
/js/worker.js:84 [Worker] Item 1206 - Original Date: 8028, Formatted Date: null
/js/worker.js:86 [Worker] Item 1206 - Invalid formatted date: 8028
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1207: (9) ['8033', '3260', '(股)', 3842699939, 155.5, 156.5, 141.5, -9, null]
/js/worker.js:84 [Worker] Item 1207 - Original Date: 8033, Formatted Date: null
/js/worker.js:86 [Worker] Item 1207 - Invalid formatted date: 8033
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1208: (9) ['8039', '3260', '(股)', 564913804, 62.1, 64.5, 61.8, 1.4, null]
/js/worker.js:84 [Worker] Item 1208 - Original Date: 8039, Formatted Date: null
/js/worker.js:86 [Worker] Item 1208 - Invalid formatted date: 8039
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1209: (9) ['8045', '3260', '(股)', 75641539, 96.9, 101.5, 96, 1.4, null]
/js/worker.js:84 [Worker] Item 1209 - Original Date: 8045, Formatted Date: null
/js/worker.js:86 [Worker] Item 1209 - Invalid formatted date: 8045
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1210: (9) ['8046', '3260', '(股)', 4140836655, 194.5, 201.5, 192.5, 6.5, null]
/js/worker.js:84 [Worker] Item 1210 - Original Date: 8046, Formatted Date: null
/js/worker.js:86 [Worker] Item 1210 - Invalid formatted date: 8046
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1211: (9) ['8070', '3260', '(股)', 79468024, 41.25, 41.75, 41.1, 0.9, null]
/js/worker.js:84 [Worker] Item 1211 - Original Date: 8070, Formatted Date: null
/js/worker.js:86 [Worker] Item 1211 - Invalid formatted date: 8070
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1212: (9) ['8072', '3260', '(股)', 11662532, 35.85, 35.85, 35.15, 0, null]
/js/worker.js:84 [Worker] Item 1212 - Original Date: 8072, Formatted Date: null
/js/worker.js:86 [Worker] Item 1212 - Invalid formatted date: 8072
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1213: (9) ['8081', '3260', '(股)', 77734699, 221.5, 224.5, 220.5, 3, null]
/js/worker.js:84 [Worker] Item 1213 - Original Date: 8081, Formatted Date: null
/js/worker.js:86 [Worker] Item 1213 - Invalid formatted date: 8081
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1214: (9) ['8101', '3260', '(股)', 492237, 19, 19, 18.45, 0.8, null]
/js/worker.js:84 [Worker] Item 1214 - Original Date: 8101, Formatted Date: null
/js/worker.js:86 [Worker] Item 1214 - Invalid formatted date: 8101
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1215: (9) ['8103', '3260', '(股)', 21932606, 50.9, 51, 50.2, 0.5, null]
/js/worker.js:84 [Worker] Item 1215 - Original Date: 8103, Formatted Date: null
/js/worker.js:86 [Worker] Item 1215 - Invalid formatted date: 8103
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1216: (9) ['8104', '3260', '(股)', 18737193, 38.45, 38.9, 38.4, 0.45, null]
/js/worker.js:84 [Worker] Item 1216 - Original Date: 8104, Formatted Date: null
/js/worker.js:86 [Worker] Item 1216 - Invalid formatted date: 8104
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1217: (9) ['8105', '3260', '(股)', 18166331, 13.3, 13.55, 13.1, 0.25, null]
/js/worker.js:84 [Worker] Item 1217 - Original Date: 8105, Formatted Date: null
/js/worker.js:86 [Worker] Item 1217 - Invalid formatted date: 8105
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1218: (9) ['8110', '3260', '(股)', 480932656, 16.5, 17.5, 16.5, 1.55, null]
/js/worker.js:84 [Worker] Item 1218 - Original Date: 8110, Formatted Date: null
/js/worker.js:86 [Worker] Item 1218 - Invalid formatted date: 8110
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1219: (9) ['8112', '3260', '(股)', 1613525527, 45, 48.65, 44.3, 4.4, null]
/js/worker.js:84 [Worker] Item 1219 - Original Date: 8112, Formatted Date: null
/js/worker.js:86 [Worker] Item 1219 - Invalid formatted date: 8112
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1220: (9) ['8112A', '3260', '(股)', 1299949, 43.2, 43.25, 43.2, 0.05, null]
/js/worker.js:84 [Worker] Item 1220 - Original Date: 8112A, Formatted Date: null
/js/worker.js:86 [Worker] Item 1220 - Invalid formatted date: 8112A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1221: (9) ['8114', '3260', '(股)', 50107361, 229, 233.5, 229, 3.5, null]
/js/worker.js:84 [Worker] Item 1221 - Original Date: 8114, Formatted Date: null
/js/worker.js:86 [Worker] Item 1221 - Invalid formatted date: 8114
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1222: (9) ['8131', '3260', '(股)', 107143752, 28.65, 31.4, 28.65, 2.1, null]
/js/worker.js:84 [Worker] Item 1222 - Original Date: 8131, Formatted Date: null
/js/worker.js:86 [Worker] Item 1222 - Invalid formatted date: 8131
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1223: (9) ['8150', '3260', '(股)', 264823992, 28.7, 29.75, 28.6, 1, null]
/js/worker.js:84 [Worker] Item 1223 - Original Date: 8150, Formatted Date: null
/js/worker.js:86 [Worker] Item 1223 - Invalid formatted date: 8150
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1224: (9) ['8162', '3260', '(股)', 33714001, 47.95, 48, 45.35, 2.95, null]
/js/worker.js:84 [Worker] Item 1224 - Original Date: 8162, Formatted Date: null
/js/worker.js:86 [Worker] Item 1224 - Invalid formatted date: 8162
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1225: (9) ['8163', '3260', '(股)', 28746584, 36.45, 37.2, 36.45, 0.45, null]
/js/worker.js:84 [Worker] Item 1225 - Original Date: 8163, Formatted Date: null
/js/worker.js:86 [Worker] Item 1225 - Invalid formatted date: 8163
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1226: (9) ['8201', '3260', '(股)', 11663008, 18, 18, 17, -1, null]
/js/worker.js:84 [Worker] Item 1226 - Original Date: 8201, Formatted Date: null
/js/worker.js:86 [Worker] Item 1226 - Invalid formatted date: 8201
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1227: (9) ['8210', '3260', '(股)', 594778122, 599, 612, 596, 14, null]
/js/worker.js:84 [Worker] Item 1227 - Original Date: 8210, Formatted Date: null
/js/worker.js:86 [Worker] Item 1227 - Invalid formatted date: 8210
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1228: (9) ['8213', '3260', '(股)', 12866955, 34.95, 35.4, 34.8, 0.6, null]
/js/worker.js:84 [Worker] Item 1228 - Original Date: 8213, Formatted Date: null
/js/worker.js:86 [Worker] Item 1228 - Invalid formatted date: 8213
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1229: (9) ['8215', '3260', '(股)', 9451988, 24.85, 25, 24.45, -0.05, null]
/js/worker.js:84 [Worker] Item 1229 - Original Date: 8215, Formatted Date: null
/js/worker.js:86 [Worker] Item 1229 - Invalid formatted date: 8215
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1230: (9) ['8222', '3260', '(股)', 65595427, 51.3, 52.2, 50.6, -0.2, null]
/js/worker.js:84 [Worker] Item 1230 - Original Date: 8222, Formatted Date: null
/js/worker.js:86 [Worker] Item 1230 - Invalid formatted date: 8222
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1231: (9) ['8249', '3260', '(股)', 144470020, 59.5, 59.9, 57.7, -1.3, null]
/js/worker.js:84 [Worker] Item 1231 - Original Date: 8249, Formatted Date: null
/js/worker.js:86 [Worker] Item 1231 - Invalid formatted date: 8249
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1232: (9) ['8261', '3260', '(股)', 682565995, 94.7, 97.4, 94.6, 2.8, null]
/js/worker.js:84 [Worker] Item 1232 - Original Date: 8261, Formatted Date: null
/js/worker.js:86 [Worker] Item 1232 - Invalid formatted date: 8261
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1233: (9) ['8271', '3260', '(股)', 838282321, 69, 71, 68.8, 0.8, null]
/js/worker.js:84 [Worker] Item 1233 - Original Date: 8271, Formatted Date: null
/js/worker.js:86 [Worker] Item 1233 - Invalid formatted date: 8271
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1234: (9) ['8341', '3260', '(股)', 33069772, 79.2, 80.5, 78.8, 1.4, null]
/js/worker.js:84 [Worker] Item 1234 - Original Date: 8341, Formatted Date: null
/js/worker.js:86 [Worker] Item 1234 - Invalid formatted date: 8341
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1235: (9) ['8367', '3260', '(股)', 1624068, 45.2, 45.7, 45.2, 0.25, null]
/js/worker.js:84 [Worker] Item 1235 - Original Date: 8367, Formatted Date: null
/js/worker.js:86 [Worker] Item 1235 - Invalid formatted date: 8367
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1236: (9) ['8374', '3260', '(股)', 35409856, 102, 103, 101, 0, null]
/js/worker.js:84 [Worker] Item 1236 - Original Date: 8374, Formatted Date: null
/js/worker.js:86 [Worker] Item 1236 - Invalid formatted date: 8374
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1237: (9) ['8404', '3260', '(股)', 15756973, 24.8, 24.9, 24.2, -0.3, null]
/js/worker.js:84 [Worker] Item 1237 - Original Date: 8404, Formatted Date: null
/js/worker.js:86 [Worker] Item 1237 - Invalid formatted date: 8404
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1238: (9) ['8411', '3260', '(股)', 927313, 12.85, 12.95, 12.85, 0.05, null]
/js/worker.js:84 [Worker] Item 1238 - Original Date: 8411, Formatted Date: null
/js/worker.js:86 [Worker] Item 1238 - Invalid formatted date: 8411
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1239: (9) ['8422', '3260', '(股)', 26008167, 196, 197, 195.5, 0.5, null]
/js/worker.js:84 [Worker] Item 1239 - Original Date: 8422, Formatted Date: null
/js/worker.js:86 [Worker] Item 1239 - Invalid formatted date: 8422
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1240: (9) ['8429', '3260', '(股)', 1115247, 7.8, 7.88, 7.77, 0.04, null]
/js/worker.js:84 [Worker] Item 1240 - Original Date: 8429, Formatted Date: null
/js/worker.js:86 [Worker] Item 1240 - Invalid formatted date: 8429
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1241: (9) ['8438', '3260', '(股)', 4800201, 30.6, 30.6, 30.05, -0.45, null]
/js/worker.js:84 [Worker] Item 1241 - Original Date: 8438, Formatted Date: null
/js/worker.js:86 [Worker] Item 1241 - Invalid formatted date: 8438
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1242: (9) ['8442', '3260', '(股)', 17651059, 74.8, 75.1, 74.7, 0.3, null]
/js/worker.js:84 [Worker] Item 1242 - Original Date: 8442, Formatted Date: null
/js/worker.js:86 [Worker] Item 1242 - Invalid formatted date: 8442
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1243: (9) ['8443', '3260', '(股)', 38830, 12.05, 12.05, 12.05, 0, null]
/js/worker.js:84 [Worker] Item 1243 - Original Date: 8443, Formatted Date: null
/js/worker.js:86 [Worker] Item 1243 - Invalid formatted date: 8443
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1244: (9) ['8454', '3260', '(股)', 87745549, 243.5, 247.5, 243, 4.5, null]
/js/worker.js:84 [Worker] Item 1244 - Original Date: 8454, Formatted Date: null
/js/worker.js:86 [Worker] Item 1244 - Invalid formatted date: 8454
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1245: (9) ['8462', '3260', '(股)', 30494227, 156, 156, 152, -1, null]
/js/worker.js:84 [Worker] Item 1245 - Original Date: 8462, Formatted Date: null
/js/worker.js:86 [Worker] Item 1245 - Invalid formatted date: 8462
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1246: (9) ['8463', '3260', '(股)', 2549906, 25.7, 25.75, 25.5, -0.1, null]
/js/worker.js:84 [Worker] Item 1246 - Original Date: 8463, Formatted Date: null
/js/worker.js:86 [Worker] Item 1246 - Invalid formatted date: 8463
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1247: (9) ['8464', '3260', '(股)', 262672230, 460, 472, 459, 13, null]
/js/worker.js:84 [Worker] Item 1247 - Original Date: 8464, Formatted Date: null
/js/worker.js:86 [Worker] Item 1247 - Invalid formatted date: 8464
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1248: (9) ['8466', '3260', '(股)', 878391, 25.75, 25.75, 25.4, -0.05, null]
/js/worker.js:84 [Worker] Item 1248 - Original Date: 8466, Formatted Date: null
/js/worker.js:86 [Worker] Item 1248 - Invalid formatted date: 8466
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1249: (9) ['8467', '3260', '(股)', 14786627, 176.5, 182.5, 176.5, 3.5, null]
/js/worker.js:84 [Worker] Item 1249 - Original Date: 8467, Formatted Date: null
/js/worker.js:86 [Worker] Item 1249 - Invalid formatted date: 8467
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1250: (9) ['8473', '3260', '(股)', 5324369, 35.2, 35.45, 35, 0, null]
/js/worker.js:84 [Worker] Item 1250 - Original Date: 8473, Formatted Date: null
/js/worker.js:86 [Worker] Item 1250 - Invalid formatted date: 8473
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1251: (9) ['8476', '3260', '(股)', 1650296, 19.9, 20, 19.8, -0.05, null]
/js/worker.js:84 [Worker] Item 1251 - Original Date: 8476, Formatted Date: null
/js/worker.js:86 [Worker] Item 1251 - Invalid formatted date: 8476
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1252: (9) ['8478', '3260', '(股)', 230782204, 231, 232, 220.5, -10.5, null]
/js/worker.js:84 [Worker] Item 1252 - Original Date: 8478, Formatted Date: null
/js/worker.js:86 [Worker] Item 1252 - Invalid formatted date: 8478
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1253: (9) ['8481', '3260', '(股)', 1178200, 43.9, 43.9, 43.45, -0.5, null]
/js/worker.js:84 [Worker] Item 1253 - Original Date: 8481, Formatted Date: null
/js/worker.js:86 [Worker] Item 1253 - Invalid formatted date: 8481
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1254: (9) ['8482', '3260', '(股)', 426985, 53, 53.2, 53, 0, null]
/js/worker.js:84 [Worker] Item 1254 - Original Date: 8482, Formatted Date: null
/js/worker.js:86 [Worker] Item 1254 - Invalid formatted date: 8482
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1255: (9) ['8487', '3260', '(股)', 809329, 80.4, 80.5, 80.4, 0.1, null]
/js/worker.js:84 [Worker] Item 1255 - Original Date: 8487, Formatted Date: null
/js/worker.js:86 [Worker] Item 1255 - Invalid formatted date: 8487
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1256: (9) ['8488', '3260', '(股)', 1953458, 11.9, 12.2, 11.6, 0.1, null]
/js/worker.js:84 [Worker] Item 1256 - Original Date: 8488, Formatted Date: null
/js/worker.js:86 [Worker] Item 1256 - Invalid formatted date: 8488
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1257: (9) ['8499', '3260', '(股)', 59690932, 262, 275, 260, 6.5, null]
/js/worker.js:84 [Worker] Item 1257 - Original Date: 8499, Formatted Date: null
/js/worker.js:86 [Worker] Item 1257 - Invalid formatted date: 8499
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1258: (9) ['8926', '3260', '(股)', 37913228, 45.8, 46.35, 45.8, 0.7, null]
/js/worker.js:84 [Worker] Item 1258 - Original Date: 8926, Formatted Date: null
/js/worker.js:86 [Worker] Item 1258 - Invalid formatted date: 8926
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1259: (9) ['8940', '3260', '(股)', 832397, 20.1, 20.2, 20, 0.2, null]
/js/worker.js:84 [Worker] Item 1259 - Original Date: 8940, Formatted Date: null
/js/worker.js:86 [Worker] Item 1259 - Invalid formatted date: 8940
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1260: (9) ['8996', '3260', '(股)', 463237372, 330, 335, 329, 6, null]
/js/worker.js:84 [Worker] Item 1260 - Original Date: 8996, Formatted Date: null
/js/worker.js:86 [Worker] Item 1260 - Invalid formatted date: 8996
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1261: (9) ['9103', '3260', '(股)', 1425986, 4.78, 4.82, 4.75, 0.02, null]
/js/worker.js:84 [Worker] Item 1261 - Original Date: 9103, Formatted Date: null
/js/worker.js:86 [Worker] Item 1261 - Invalid formatted date: 9103
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1262: (9) ['910322', '3260', '(股)', 225972, 21.25, 21.3, 21.25, 0.25, null]
/js/worker.js:84 [Worker] Item 1262 - Original Date: 910322, Formatted Date: null
/js/worker.js:86 [Worker] Item 1262 - Invalid formatted date: 910322
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1263: (9) ['9105', '3260', '(股)', 447119389, 6.41, 6.5, 6.2, 0.1, null]
/js/worker.js:84 [Worker] Item 1263 - Original Date: 9105, Formatted Date: null
/js/worker.js:86 [Worker] Item 1263 - Invalid formatted date: 9105
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1264: (9) ['910861', '3260', '(股)', 420426, 6.23, 6.33, 6.22, 0.22, null]
/js/worker.js:84 [Worker] Item 1264 - Original Date: 910861, Formatted Date: null
/js/worker.js:86 [Worker] Item 1264 - Invalid formatted date: 910861
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1265: (9) ['9110', '3260', '(股)', 13560, 4.49, 4.59, 4.48, -0.13, null]
/js/worker.js:84 [Worker] Item 1265 - Original Date: 9110, Formatted Date: null
/js/worker.js:86 [Worker] Item 1265 - Invalid formatted date: 9110
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1266: (9) ['911608', '3260', '(股)', 12177, 2.87, 2.92, 2.86, null, null]
/js/worker.js:84 [Worker] Item 1266 - Original Date: 911608, Formatted Date: null
/js/worker.js:86 [Worker] Item 1266 - Invalid formatted date: 911608
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1267: (9) ['911622', '3260', '(股)', 59507, 3.91, 3.94, 3.9, 0, null]
/js/worker.js:84 [Worker] Item 1267 - Original Date: 911622, Formatted Date: null
/js/worker.js:86 [Worker] Item 1267 - Invalid formatted date: 911622
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1268: (9) ['911868', '3260', '(股)', 886783, 1.3, 1.31, 1.28, 0, null]
/js/worker.js:84 [Worker] Item 1268 - Original Date: 911868, Formatted Date: null
/js/worker.js:86 [Worker] Item 1268 - Invalid formatted date: 911868
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1269: (9) ['912000', '3260', '(股)', 535275, 2.55, 2.57, 2.54, 0, null]
/js/worker.js:84 [Worker] Item 1269 - Original Date: 912000, Formatted Date: null
/js/worker.js:86 [Worker] Item 1269 - Invalid formatted date: 912000
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1270: (9) ['9136', '3260', '(股)', 287940, 6.09, 6.2, 6.09, 0.01, null]
/js/worker.js:84 [Worker] Item 1270 - Original Date: 9136, Formatted Date: null
/js/worker.js:86 [Worker] Item 1270 - Invalid formatted date: 9136
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1271: (9) ['9802', '3260', '(股)', 75178521, 102.5, 104, 102, 2, null]
/js/worker.js:84 [Worker] Item 1271 - Original Date: 9802, Formatted Date: null
/js/worker.js:86 [Worker] Item 1271 - Invalid formatted date: 9802
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1272: (9) ['9902', '3260', '(股)', 3535200, 16.8, 17, 16.45, -0.05, null]
/js/worker.js:84 [Worker] Item 1272 - Original Date: 9902, Formatted Date: null
/js/worker.js:86 [Worker] Item 1272 - Invalid formatted date: 9902
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1273: (9) ['9904', '3260', '(股)', 337174788, 28.55, 28.8, 28.5, 0.25, null]
/js/worker.js:84 [Worker] Item 1273 - Original Date: 9904, Formatted Date: null
/js/worker.js:86 [Worker] Item 1273 - Invalid formatted date: 9904
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1274: (9) ['9905', '3260', '(股)', 809368, 21.1, 21.1, 21.05, 0, null]
/js/worker.js:84 [Worker] Item 1274 - Original Date: 9905, Formatted Date: null
/js/worker.js:86 [Worker] Item 1274 - Invalid formatted date: 9905
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1275: (9) ['9906', '3260', '(股)', 16571327, 67.2, 68, 65.3, -1.9, null]
/js/worker.js:84 [Worker] Item 1275 - Original Date: 9906, Formatted Date: null
/js/worker.js:86 [Worker] Item 1275 - Invalid formatted date: 9906
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1276: (9) ['9907', '3260', '(股)', 20007449, 17.75, 17.75, 17.55, 0.05, null]
/js/worker.js:84 [Worker] Item 1276 - Original Date: 9907, Formatted Date: null
/js/worker.js:86 [Worker] Item 1276 - Invalid formatted date: 9907
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1277: (9) ['9908', '3260', '(股)', 2485561, 30, 30.05, 29.95, 0.05, null]
/js/worker.js:84 [Worker] Item 1277 - Original Date: 9908, Formatted Date: null
/js/worker.js:86 [Worker] Item 1277 - Invalid formatted date: 9908
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1278: (9) ['9910', '3260', '(股)', 111230549, 115.5, 117, 114, 0.5, null]
/js/worker.js:84 [Worker] Item 1278 - Original Date: 9910, Formatted Date: null
/js/worker.js:86 [Worker] Item 1278 - Invalid formatted date: 9910
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1279: (9) ['9911', '3260', '(股)', 14883048, 86.6, 86.6, 86.2, -0.4, null]
/js/worker.js:84 [Worker] Item 1279 - Original Date: 9911, Formatted Date: null
/js/worker.js:86 [Worker] Item 1279 - Invalid formatted date: 9911
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1280: (9) ['9912', '3260', '(股)', 448725, 12, 12.15, 12, 0.1, null]
/js/worker.js:84 [Worker] Item 1280 - Original Date: 9912, Formatted Date: null
/js/worker.js:86 [Worker] Item 1280 - Invalid formatted date: 9912
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1281: (9) ['9914', '3260', '(股)', 62948745, 110.5, 113, 110.5, 2, null]
/js/worker.js:84 [Worker] Item 1281 - Original Date: 9914, Formatted Date: null
/js/worker.js:86 [Worker] Item 1281 - Invalid formatted date: 9914
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1282: (9) ['9917', '3260', '(股)', 62068904, 113, 113, 112, 0, null]
/js/worker.js:84 [Worker] Item 1282 - Original Date: 9917, Formatted Date: null
/js/worker.js:86 [Worker] Item 1282 - Invalid formatted date: 9917
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1283: (9) ['9918', '3260', '(股)', 671192, 39.45, 39.45, 39.4, -0.05, null]
/js/worker.js:84 [Worker] Item 1283 - Original Date: 9918, Formatted Date: null
/js/worker.js:86 [Worker] Item 1283 - Invalid formatted date: 9918
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1284: (9) ['9919', '3260', '(股)', 8709324, 17.05, 17.3, 17.05, 0.3, null]
/js/worker.js:84 [Worker] Item 1284 - Original Date: 9919, Formatted Date: null
/js/worker.js:86 [Worker] Item 1284 - Invalid formatted date: 9919
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1285: (9) ['9921', '3260', '(股)', 140805752, 104, 106, 103, 0, null]
/js/worker.js:84 [Worker] Item 1285 - Original Date: 9921, Formatted Date: null
/js/worker.js:86 [Worker] Item 1285 - Invalid formatted date: 9921
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1286: (9) ['9924', '3260', '(股)', 6299525, 43.8, 43.8, 43.4, 0, null]
/js/worker.js:84 [Worker] Item 1286 - Original Date: 9924, Formatted Date: null
/js/worker.js:86 [Worker] Item 1286 - Invalid formatted date: 9924
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1287: (9) ['9925', '3260', '(股)', 3245790, 40.95, 40.95, 40.7, 0, null]
/js/worker.js:84 [Worker] Item 1287 - Original Date: 9925, Formatted Date: null
/js/worker.js:86 [Worker] Item 1287 - Invalid formatted date: 9925
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1288: (9) ['9926', '3260', '(股)', 149900, 49.9, 49.95, 49.9, -0.15, null]
/js/worker.js:84 [Worker] Item 1288 - Original Date: 9926, Formatted Date: null
/js/worker.js:86 [Worker] Item 1288 - Invalid formatted date: 9926
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1289: (9) ['9927', '3260', '(股)', 8288694, 55.8, 56.4, 55.6, 0.4, null]
/js/worker.js:84 [Worker] Item 1289 - Original Date: 9927, Formatted Date: null
/js/worker.js:86 [Worker] Item 1289 - Invalid formatted date: 9927
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1290: (9) ['9928', '3260', '(股)', 697804, 17.95, 17.95, 17.55, -0.25, null]
/js/worker.js:84 [Worker] Item 1290 - Original Date: 9928, Formatted Date: null
/js/worker.js:86 [Worker] Item 1290 - Invalid formatted date: 9928
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1291: (9) ['9929', '3260', '(股)', 153654, 14.05, 14.05, 13.3, 0.35, null]
/js/worker.js:84 [Worker] Item 1291 - Original Date: 9929, Formatted Date: null
/js/worker.js:86 [Worker] Item 1291 - Invalid formatted date: 9929
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1292: (9) ['9930', '3260', '(股)', 7447878, 70.6, 71.5, 70.5, 0.7, null]
/js/worker.js:84 [Worker] Item 1292 - Original Date: 9930, Formatted Date: null
/js/worker.js:86 [Worker] Item 1292 - Invalid formatted date: 9930
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1293: (9) ['9931', '3260', '(股)', 646284, 34.1, 34.1, 34, 0, null]
/js/worker.js:84 [Worker] Item 1293 - Original Date: 9931, Formatted Date: null
/js/worker.js:86 [Worker] Item 1293 - Invalid formatted date: 9931
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1294: (9) ['9933', '3260', '(股)', 93978226, 32.9, 32.9, 32.3, -0.05, null]
/js/worker.js:84 [Worker] Item 1294 - Original Date: 9933, Formatted Date: null
/js/worker.js:86 [Worker] Item 1294 - Invalid formatted date: 9933
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1295: (9) ['9934', '3260', '(股)', 4856050, 10.25, 10.4, 10.25, 0.1, null]
/js/worker.js:84 [Worker] Item 1295 - Original Date: 9934, Formatted Date: null
/js/worker.js:86 [Worker] Item 1295 - Invalid formatted date: 9934
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1296: (9) ['9935', '3260', '(股)', 3526702, 20.65, 20.8, 20.6, 0.1, null]
/js/worker.js:84 [Worker] Item 1296 - Original Date: 9935, Formatted Date: null
/js/worker.js:86 [Worker] Item 1296 - Invalid formatted date: 9935
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1297: (9) ['9937', '3260', '(股)', 4607344, 60.8, 62, 60.7, 0.7, null]
/js/worker.js:84 [Worker] Item 1297 - Original Date: 9937, Formatted Date: null
/js/worker.js:86 [Worker] Item 1297 - Invalid formatted date: 9937
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1298: (9) ['9938', '3260', '(股)', 51228674, 55.5, 56, 55.2, 0.2, null]
/js/worker.js:84 [Worker] Item 1298 - Original Date: 9938, Formatted Date: null
/js/worker.js:86 [Worker] Item 1298 - Invalid formatted date: 9938
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1299: (9) ['9939', '3260', '(股)', 124268533, 128.5, 129, 127, 0, null]
/js/worker.js:84 [Worker] Item 1299 - Original Date: 9939, Formatted Date: null
/js/worker.js:86 [Worker] Item 1299 - Invalid formatted date: 9939
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1300: (9) ['9940', '3260', '(股)', 4083559, 24.6, 24.75, 24.45, -0.05, null]
/js/worker.js:84 [Worker] Item 1300 - Original Date: 9940, Formatted Date: null
/js/worker.js:86 [Worker] Item 1300 - Invalid formatted date: 9940
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1301: (9) ['9941', '3260', '(股)', 94099082, 97.9, 98.9, 97.8, 1.4, null]
/js/worker.js:84 [Worker] Item 1301 - Original Date: 9941, Formatted Date: null
/js/worker.js:86 [Worker] Item 1301 - Invalid formatted date: 9941
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1302: (9) ['9941A', '3260', '(股)', 60550, 50.3, 50.3, 50.3, -0.1, null]
/js/worker.js:84 [Worker] Item 1302 - Original Date: 9941A, Formatted Date: null
/js/worker.js:86 [Worker] Item 1302 - Invalid formatted date: 9941A
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1303: (9) ['9942', '3260', '(股)', 3171895, 109, 109, 108, 0, null]
/js/worker.js:84 [Worker] Item 1303 - Original Date: 9942, Formatted Date: null
/js/worker.js:86 [Worker] Item 1303 - Invalid formatted date: 9942
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1304: (9) ['9943', '3260', '(股)', 1695771, 65.4, 66, 65.4, 0.4, null]
/js/worker.js:84 [Worker] Item 1304 - Original Date: 9943, Formatted Date: null
/js/worker.js:86 [Worker] Item 1304 - Invalid formatted date: 9943
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1305: (9) ['9944', '3260', '(股)', 825485, 17, 17.2, 17, 0, null]
/js/worker.js:84 [Worker] Item 1305 - Original Date: 9944, Formatted Date: null
/js/worker.js:86 [Worker] Item 1305 - Invalid formatted date: 9944
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1306: (9) ['9945', '3260', '(股)', 125378613, 30.55, 30.75, 30.2, -0.05, null]
/js/worker.js:84 [Worker] Item 1306 - Original Date: 9945, Formatted Date: null
/js/worker.js:86 [Worker] Item 1306 - Invalid formatted date: 9945
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1307: (9) ['9946', '3260', '(股)', 1801492, 19.35, 19.35, 19.05, -0.05, null]
/js/worker.js:84 [Worker] Item 1307 - Original Date: 9946, Formatted Date: null
/js/worker.js:86 [Worker] Item 1307 - Invalid formatted date: 9946
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1308: (9) ['9955', '3260', '(股)', 24337900, 29.8, 30, 29.25, -0.6, null]
/js/worker.js:84 [Worker] Item 1308 - Original Date: 9955, Formatted Date: null
/js/worker.js:86 [Worker] Item 1308 - Invalid formatted date: 9955
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
/js/worker.js:82 [Worker] Processing item 1309: (9) ['9958', '3260', '(股)', 219759300, 168.5, 171, 168, 3.5, null]
/js/worker.js:84 [Worker] Item 1309 - Original Date: 9958, Formatted Date: null
/js/worker.js:86 [Worker] Item 1309 - Invalid formatted date: 9958
(anonymous) @ /js/worker.js:86
fetchStockData @ /js/worker.js:81
await in fetchStockData
self.onmessage @ /js/worker.js:818
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
backtest.js:37 [Main] Received message from worker: progress undefined
backtest.js:37 [Main] Received message from worker: error {message: 'Worker runBacktest 錯誤: 指定範圍 (2020-09-19 ~ 2025-09-19) 無 3260 交易數據'}
Function tpex-proxy
Sep 19, 11:59:44 AM: 119ba131 INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:59:44 AM: 119ba131 Duration: 442.61 ms	Memory Usage: 126 MB
Sep 19, 11:59:44 AM: 04fa33de INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:59:44 AM: 04fa33de Duration: 134.53 ms	Memory Usage: 136 MB
Sep 19, 11:59:46 AM: ec7a6f1e INFO   [TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for 3260.TWO
Sep 19, 11:59:46 AM: ec7a6f1e Duration: 271.94 ms	Memory Usage: 145 MB