# 2025-06-23 — Patch LB-TODAY-SUGGEST-20250623A
- **Issue recap**: 今日建議卡片僅回傳「等待」等泛用字樣，無法對準最新交易日的持倉狀態或策略訊號，使用者難以判斷今日應執行的動作。
- **Fix**: Worker 保存最後一次回測的倉位軌跡與訊號索引，並改寫建議引擎直接解析當日狀態，輸出「進場／出場／維持空手」等具體指示；前端改以動態樣式呈現不同動作，不再顯示「等待」。
- **Diagnostics**: 建議文字會帶出日期、倉位標籤與收盤價摘要，讓營運端可比對回測結果與顯示是否一致。
- **Testing**: 受限於容器無法啟動瀏覽器，僅完成程式碼審閱；待部署到 Netlify 後需以實際回測流程確認建議卡片行為。

# 2025-06-22 — Patch LB-US-NAMECACHE-20250622A
- **Issue recap**: 美股名稱雖已修正為正確來源，但僅存於記憶體快取；重新整理頁面或再次輸入 AAPL 仍需重新呼叫 proxy，導致名稱顯示延遲且增加 FinMind/Yahoo 請求量。
- **Fix**: 導入美股名稱 `localStorage` 永續快取（3 天 TTL），頁面載入時回灌記憶體 Map；快取寫入時以「市場｜代碼」為 key，同步清理過期項目並與台股快取共用 4096 筆上限，確保重複輸入常用代號可立即命中。
- **Diagnostics**: 名稱查詢 console 會標示快取命中市場與時間戳，過期項目會同時從記憶體與本地儲存移除，避免舊名錄殘留造成誤判。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-22 — Patch LB-NAME-DISPLAY-20250622A
- **Issue recap**: Stock Name 區塊顯示結果會附加「來源」「清單版本」等標籤，與使用者預期僅需看到股票名稱的需求相悖，容易造成視覺干擾。
- **Fix**: 調整名稱組字函式，僅輸出名稱及市場分類，移除來源／清單版本附註；README 與 agent 手冊同步記錄顯示策略調整，避免後續維運混淆。
- **Diagnostics**: UI 仍可透過資料暖身診斷卡檢視名稱來源與清單版本，確保維運資訊完整但不干擾一般使用者操作。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-21 — Patch LB-US-BACKTEST-20250621A
- **Issue recap**: 雖然已導入美股資料代理，前端回測仍沿用台股 3～7 碼代碼驗證，導致一字元或附帶 `.US` 後綴的美股代碼無法送出；若誤將 2330 等代號切換為美股市場，也可能把台股請求送往 FinMind US 路徑。
- **Fix**: 新增市場感知的代碼驗證邏輯，美股接受 1～6 碼英數字並支援 `.US`／`-` 後綴，台股限定 4～6 碼數字並允許一碼英數尾碼，同步在 README 與 agent 手冊註記行為；維持 FinMind 為美股主來源、Yahoo 為備援。
- **Diagnostics**: 驗證錯誤會即時顯示具體格式說明，價格診斷與測試卡仍可辨識 FinMind/Yahoo 來源，防止市場誤選造成快取與來源標籤混淆。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-20 — Patch LB-TW-DIRECTORY-20250620A
- **Issue recap**: TWSE/TPEX 名稱查詢仍仰賴逐次 API 呼叫與手工對照表，無法穩定判斷上市／上櫃市場別；測試卡片與診斷面板也缺乏名稱來源與清單版本資訊，維運難以確認是否命中官方名錄。
- **Fix**: 新增 `taiwan-directory` Netlify 函式快取 FinMind `TaiwanStockInfo`，前端開站即預載清單並寫入記憶體與 `localStorage` 快取，名稱查詢優先回傳官方清單並補上 `matchStrategy`／`directoryVersion`；資料診斷面板與測試卡提示會顯示名稱來源與清單版本。
- **Diagnostics**: 資料暖身診斷新增「名稱與清單資訊」區塊，資料來源測試卡同步顯示台股官方清單版本與更新時間。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-16 — Patch LB-TW-NAMELOCK-20250616A / LB-TW-NAMECACHE-20250616A
- **Issue recap**: 數字開頭的代號仍會落入美股名稱備援，導致 2330 這類台股顯示英文公司名；上市櫃名稱快取僅存在記憶體且無法跨頁面延續，ETF 判斷也無法覆蓋 0050、006208、00878 等五到六碼代號。
- **Fix**: 只要代號前四碼為數字即限制在上市／上櫃資料源查詢與自動切換，並在寫入快取時同步儲存至 `localStorage`，下次載入仍能快速顯示中文名稱；ETF 辨識支援 4～6 位數及末碼字母的 00 系列代號。
- **Diagnostics**: 名稱查詢日誌會顯示「TWSE/TPEX 限定」標記與快取命中時間戳，利於確認是否命中本地快取或需要重新發送請求。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-15 — Patch LB-NAME-GATE-20250615A / LB-MARKET-OVERRIDE-20250615A
- **Issue recap**: 4 字元防抖機制套用在所有代碼，美股僅輸入 1~3 字母即被阻擋；同時 `1101B` 等前四碼為數字的台股被判定為美股並顯示英文名稱，用戶手動調整市場後也會被自動切回其他市場。
- **Fix**: 只對開頭數字代碼套用 4 碼門檻，並以首四碼為台股優先順序抓取上市/上櫃中文名稱；新增使用者手動選擇市場的鎖定旗標，直到重新輸入代碼前不再自動切換市場或引用跨市場快取。
- **Diagnostics**: Console 日誌會標示觸發數字門檻的實際位數與是否因手動鎖定而略過自動切換，市場切換提示維持手動轉換按鈕供用戶決定是否改查其他市場。
- **Testing**: 受限於容器無法啟動瀏覽器，已以靜態程式檢查與 `node --input-type=module -e "import('./netlify/functions/us-proxy.js')"` 確認代理模組仍可載入；後續需在前端實機輸入 AAPL、1101B 等案例驗證互動流程。

# 2025-06-14 — Patch LB-US-NAMEFIX-20250614A / LB-NAME-CACHE-20250614A
- **Issue recap**: 美股代號 AAPL 會被 FinMind USStockInfo 回傳的第一筆資料覆蓋成 Agilent，UI 無法分辨上市/上櫃/美股/ETF，且名稱查詢每輸入一個字便觸發請求，導致辨識錯誤與效能下降。
- **Fix**: US proxy 重新比對 `stock_id`、`ticker`、`.US` 後綴並回傳 `marketCategory`/`securityType`，快取正確的股票名稱來源；前端新增名稱快取、最小 4 字元觸發、跨市場優先序判斷與 ETF 推測，顯示「美股・NASDAQ」等分類並在自動切換時沿用快取結果。
- **Diagnostics**: 名稱欄位會標示來源、快取與切換提示，避免再將錯誤名稱寫回 UI；proxy 另帶回 `matchStrategy` 協助後續排查 FinMind 回應格式。
- **Testing**: `node --input-type=module -e "import('./netlify/functions/us-proxy.js').then(() => console.log('us-proxy loaded')).catch(err => { console.error('load failed', err); process.exit(1); });"`

# 2025-06-13 — Patch LB-US-YAHOO-20250613A
- **Issue recap**: FinMind 失敗或 Token 未設定時，美股回測無備援資料；資料來源測試卡僅顯示 `aaData` 筆數，導致 FinMind 測試結果固定為 0 筆且無法檢視 Yahoo 備援。
- **Fix**: `us-proxy` 新增 Yahoo Finance 備援流程與 `forceSource` 參數，依來源獨立快取並回傳 `dataSources`/`fallback` 診斷；前端測試卡同步提供 FinMind、Yahoo 按鈕並支援美股 `/api/us/` 來源。
- **Diagnostics**: 測試卡會顯示實際筆數、涵蓋區間與備援原因，提示使用者 FinMind 為主來源、Yahoo 為備援來源，協助營運端交叉檢查資料命中情況。
- **Testing**: 受限於容器無法連線外部 API，透過程式碼審閱與 `us-proxy` 匯入檢查邏輯正確性，後續需在具備網路的環境進行實際 API 驗證。

# 2025-06-12 — Patch LB-US-MARKET-20250612A
- **Issue recap**: 使用者需要在網頁版回測器中新增美股市場，且股價與代碼必須透過 FinMind API 取得；現有流程僅支援上市/上櫃資料與 TWSE/TPEX 代理。
- **Fix**: 新增 `us-proxy` Netlify 函式整合 FinMind `USStockPrice/USStockInfo`，Worker 與前端導入 `US` 市場路徑、快取標籤與資料來源提示，並在 UI 改為下拉選單且自動停用美股的還原選項與手續費預設；`us-proxy` 亦補上 `stock_id` 名稱查詢備援與 FinMind 等級錯誤提示，避免 Sponsor 未啟用時難以診斷。
- **Diagnostics**: 資料來源測試卡顯示 FinMind 為唯一來源並提示 Token 等級；市場切換提示會針對上市/上櫃/美股顯示動態建議，Stock Name 查詢也改為跨市場搜尋與自動切換。
- **Testing**: 受限於容器無法連線 FinMind API，僅透過程式碼審閱與邏輯驗證確認路由、快取與 UI 狀態切換無誤。

# 2025-06-09 — Patch LB-CACHE-START-20250609A
- **Issue recap**: 買入持有基準修正後，快取檢查會因首筆有效日期落後 7 天而在每次回測都強制重抓，熱門股票回測等待時間明顯拉長。
- **Fix**: 主執行緒於快取項目記錄首筆有效交易日、落後天數與確認時間，僅於首次或超過等待期限時才重新抓取，其餘情境沿用快取並保留警示。
- **Diagnostics**: 快取結構新增 `firstEffectiveRowDate`、`startGapDays` 與 `startGapAcknowledgedAt`，價格診斷可追蹤暖身缺口是否已人工確認。
- **Testing**: 受限於容器無法連線實際台股 API，採程式碼審閱與節點驗證。

# 2025-06-08 — Patch LB-BUYHOLD-BASE-20250608A
- **Issue recap**: 買入持有報酬仍以暖身期內第一筆有效收盤作為基準，造成使用者設定起始日的首筆報酬出現 20% 以上落差。尤其在 2330 案例
  中，2024-09-02 應為 0% 的首日卻顯示 21% 報酬。
- **Fix**: Worker 將買入持有基準鎖定在資料摘要標記的首筆有效收盤，對於起始日前的缺口一律視為 0% 並維持同一基準計算後續報酬，確
  保圖表與診斷一致。
- **Diagnostics**: 若暖身期結束後仍找不到有效收盤價，報酬序列會回傳全 0 並沿用既有的暖身落差警示，方便比對缺漏原因。
- **Testing**: 靜態檢閱 Worker 買入持有報酬基準計算與暖身缺口覆寫邏輯（環境無法連線實際台股 API）。

# 2025-06-07 — Patch LB-COVERAGE-FORCE-20250607A
- **Issue recap**: 2330 在暖身期間即便多次重抓仍缺少 9/01～9/20 的交易日，買入持有首筆有效收盤距離使用者起點 22 天，導致基準報酬無法對齊。
- **Fix**: Worker 於偵測月度缺口時會優先以 `forceSource` 重新向主來源（TWSE／FinMind／Yahoo）補抓資料並記錄來源，若仍落後超過 7 天則將買入持有報酬鎖定為 0%，避免誤導績效。
- **Diagnostics**: 月度診斷新增 `forcedSources` 追蹤強制補抓來源，回測摘要亦揭露是否啟用強制補抓與買入持有暖身寬限設定，便於釐清資料仍缺漏或被歸零的原因。
- **Testing**: 靜態檢查 Worker 月度補抓流程、forceSource 參數傳遞與買入持有報酬計算分支（環境無法連線實際台股 API）。

# 2025-06-05 — Patch LB-WARMUP-DIAG-20250605A
- **Issue recap**: 診斷卡的「暖身起點」仍顯示使用者設定日期，造成 2330 等案例雖已回推 90 日暖身卻看不出快取實際抓取的起點，也難以衡量第一筆有效收盤距離暖身資料的落差。
- **Fix**: `summariseDatasetRows` 增加 `warmupStartDate` 與對應缺口統計，Worker 在回傳診斷與暖身摘要時帶入緩衝起點，前端改以 `warmupStartDate` 呈現並同時列出距暖身／使用者起點的天數，方便比對快取與實際資料差距。
- **Diagnostics**: 資料暖身面板與遠端抓取摘要新增暖身起點與缺口欄位，Warmup 摘要同步呈現暖身起點與首筆有效收盤差距，協助判斷是否仍需追查 Proxy 或月度快取缺漏。
- **Testing**: 以 Node 解析 `shared-lookback` 與 Worker 函式模擬輸出，檢查診斷結構；受限於環境無法連線 Proxy/API，未進行實際回測。

# 2025-06-04 — Patch LB-COVERAGE-TRACE-20250604A / LB-DATA-DIAG-20250604A
- **Issue recap**: 仍有用戶反映設定 9/01 起始日後，回測圖表與買進持有報告自 9/23 才出現有效價格；既有診斷卡片雖能顯示暖身資訊，但缺乏無效欄位統計、資料範例與手動測試指引，難以釐清遠端資料是否仍缺漏。 
- **Fix**: Worker 在 `summariseDatasetRows` 中累計無效欄位的原因與首筆位置，若仍落後會輸出 console 警示並附上鄰近樣本；同時於買進持有檢查與月度抓取流程新增無效資料統計，方便定位快取或遠端回應的資料斷層。 
- **Diagnostics**: 前端診斷卡新增「使用者起點鄰近樣本」、「無效欄位統計」與「手動測試指引」，並於主執行緒同步輸出原因彙總，協助營運與使用者蒐集回報所需資訊。 
- **Testing**: 以本地模擬資料驗證診斷卡、console 警示與快取合併流程；受限於環境無法連線 Proxy，未能進行實際 API 回測。 

# 2025-06-02 — Patch LB-COVERAGE-RECOVERY-20250602A
- **Issue recap**: 2330 月度快取曾被標記為已覆蓋完整九月區間，導致 Worker 判定 9/01～9/20 無需重抓，即便主執行緒強制重新整理仍只得到 9/23 起的資料。
- **Fix**: Worker 針對月度資料檢查實際成交日是否留有缺口，必要時會移除既有覆蓋區段並加入 cache bust 參數強制補抓缺漏天數，確保暖身期與使用者區間可一次補齊。
- **Diagnostics**: 一旦觸發強制補抓，Worker 會輸出 console 警示並記錄 `lastForcedReloadAt`，後續可於 price inspector 驗證首日資料是否補齊。
- **Testing**: 靜態檢查覆蓋修復流程（受限於本地環境無法連線實際台股 API 與瀏覽器）。

# 2025-06-01 — Patch LB-COVERAGE-GAP-20250601A
- **Issue recap**: 2330 一鍵回測後即使調整開始日期，價格表仍從 9/23 開始，研判為月度快取將未填補的起始區間視為已覆蓋，導致主執行緒重複沿用殘缺資料。
- **Fix**: Worker 僅在取得實際筆數時才記錄月度覆蓋範圍，並以資料列重新建構 coverage，避免零筆回應也標記整段完成；主執行緒若偵測快取首筆日期距離設定起點超過一週，會強制放棄快取改抓遠端。
- **Diagnostics**: 透過 console 警示 `快取首筆日期較設定起點晚於允許範圍` 判斷是否觸發重新抓取，同時在快取匯總中保留完整暖身資料供價格檢視器驗證首日交易狀態。
- **Testing**: 靜態檢視流程與日誌（受限於本地環境無法連線實際台股 API）。

# 2025-05-31 — Patch LB-WARMUP-SIGNAL-20250531A
- **Issue recap**: 僅使用均線策略時，價格區間表首日仍顯示「不足」，顯示暖身資料未被納入指標計算；不同指標的最大週期也可能低估所需緩衝，導致 Worker 未向 Proxy 抓取足量歷史資料。
- **Fix**: Worker 在執行策略時計算完整暖身序列並於回傳時僅裁切使用者指定區間，同步調高共享 lookback 工具的最小樣本數、緩衝日與交易日回推邏輯，確保主執行緒與批量優化皆向 Proxy 要求足夠歷史資料。
- **Diagnostics**: 若指定區間完全無交易資料會回傳 `no_data` 訊息並註記僅保留暖身資料，前端快取依然保有完整序列供價格檢視器查驗。
- **Testing**: 靜態檢查程式流程並重播 Worker 暖身資料行為（受限於此環境無法連線實際台股 API）。

# 2025-05-30 — Patch LB-PRICE-INDICATOR-20250530A
- **Issue recap**: 長週期策略在價格檢視器中無法辨識暖身期是否充足，指標欄位缺乏顯示且倉位狀態難以追蹤，部分突破策略的最高/最低計算亦出現位移。
- **Fix**: Worker 端保留暖身資料後回傳 `priceIndicatorSeries` 與 `positionStates`，修正 `computeRollingExtrema` 的窗口對齊，並在前端價格檢視表動態生成各進出場策略指標與倉位欄位，未達計算標準時標示「不足」。
- **Diagnostics**: 價格檢視器可同時看到原始/還原價格、各策略指標值、倉位狀態與來源標籤，方便驗證首日即可觸發進出場條件；若指標尚在暖身將直接顯示「不足」。
- **Testing**: 本地模擬 Worker 計算流程並檢查 console log，確認無同步錯誤（此環境仍無法連線實際台股 API）。

# 2025-05-28 — Patch LB-LOOKBACK-BUFFER-20250528A
- **Issue recap**: 發現主執行緒合併回傳資料時，`mergeIsoCoverage` 於 `fetchedRange` 尚未定義前即被呼叫，導致部分瀏覽器在處理長週期回測結果時丟出 `ReferenceError`，使得首日暖身資料未能寫入快取。
- **Fix**: 先解析 `fetchedRange` 再呼叫 `mergeIsoCoverage`，並在缺少範圍資訊時安全地跳過合併；保持緩衝區間與 `effectiveStartDate` 的紀錄完整。
- **Diagnostics**: 維持 `fetchRange`、`lookbackDays` 等欄位回傳，便於部署後檢視暖身區間是否落地。
- **Testing**: 本地以開發工具模擬 Worker 回傳資料流程，確認不再出現 `ReferenceError`（此環境仍無法連線實際 API）。

# 2025-06-03 — Patch LB-COVERAGE-DEBUG-20250603A / LB-DATA-DIAG-20250603A
- **Issue recap**: 使用者仍回報 2330 回測圖表起點落後，舊版程式缺乏首筆有效收盤與暖身筆數的診斷資訊，無法釐清快取是否成功補齊。
- **Fix**: Worker 回傳 `datasetDiagnostics`，列出暖身起點、模擬索引、買入持有首筆有效收盤與月度補抓紀錄，主執行緒同步將診斷寫入快取並在 console 輸出差異。
- **Diagnostics**: 前端新增「診斷資料暖身」卡片，顯示區間筆數、無效樣本、暖身需求與月度抓取摘要，方便手動測試時一鍵截圖提供資訊；同時在 warmup 與 B&H 發現落差時主動輸出警示。
- **Testing**: 受限於離線環境，未能串接實際 Proxy，已透過本地資料結構模擬檢查面板渲染與 console 輸出格式。

# 2025-05-27 — Patch LB-LOOKBACK-BUFFER-20250527A / LB-DATA-BUFFER-20250527A
- **Issue recap**: 長週期指標與 MACD/KD 等策略在回測首日無法產生訊號，主因是資料抓取未留足夠暖身期間，主執行緒與 Worker 快取也缺乏緩衝期間辨識，導致不同 lookback 需求互相覆蓋。
- **Fix**: 新增共享的指標週期工具，主線與 Worker 依據最大指標週期計算 lookback 並回推緩衝起點，所有資料抓取、快取 key、Meta 與 UI 顯示均改為記錄緩衝區間與 effectiveStartDate，同步在 Worker 執行策略前依有效區間切片。
- **Diagnostics**: `rawMeta` 與 `dataDebug` 會帶回 `fetchRange`、`effectiveStartDate`、`lookbackDays`，前端快取也保存完整緩衝區，避免後續優化或建議功能讀取到截短資料。
- **Testing**: 手動驗證參數前處理與快取合併流程（本地環境無法連線實際 API，僅能檢視程式日誌與流程）。

# Lazybacktest Debug Log

# 2025-05-18 — Patch LB-ADJ-COMPOSER-20250518A / LB-PRICE-INSPECTOR-20250518A
- **Issue recap**: 備援還原流程仍以「已還原股價 × 還原因子」進行縮放，導致雙重折算；前端區間價格缺乏原始價格來源標籤，難以分辨 TWSE 與 FinMind 來源。
- **Fix**: Netlify 還原函式在調整時保留 `rawOpen`/`rawClose` 等基準數據並標示 `priceSource`，Worker 備援計算改以原始價格乘上係數；價格檢視器摘要與表格同步顯示 TWSE、FinMind 來源。
- **Diagnostics**: 區間價格表可直接看到原始收盤價、還原因子與實際採用的來源標籤，協助確認備援是否套用正確資料。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

# 2025-05-09 — Patch LB-ADJ-COMPOSER-20250509A / LB-DATASOURCE-20250509A
- **Issue recap**: FinMind `TaiwanStockDividendResult` 事件在缺少 `after_price` 時，會改以「前價減股利」推估，導致實際還原流程等同於「股價乘上還原因子後再扣股利」，造成重複折減。
- **Fix**: 要求 `after_price` 必須存在且為正值才建立事件，移除 `before - dividend` 的回退邏輯，確保還原比率只來自 FinMind 提供的前後股價；同步更新函式版號為 `LB-ADJ-COMPOSER-20250509A`。
- **Diagnostics**: 單元測試新增「缺少 after_price 應略過」案例，避免後續回歸；同時保留股利總額於診斷供比對。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

# 2025-04-26 — Patch LB-ADJ-COMPOSER-20250426A / LB-DATASOURCE-20250426A
- **Issue recap**: 僅改用 `TaiwanStockDividendResult` 後，還原流程缺乏完整測試覆蓋，測試卡也無法看出事件截斷或計算方式，導致仍難以追蹤係數為何未被套用。
- **Fix**: Netlify 還原函式改為可注入 mock fetch 並輸出事件預覽總數，依 `before_price`、`after_price` 計算的手動比率同時在 UI 顯示計算式，並保留超過預覽上限的剩餘筆數說明。
- **Diagnostics**: 測試卡新增「TaiwanStockDividendResult」公式提示與「尚有 X 筆」說明，讓開發者了解係數來源與被截斷的事件；診斷回傳也保證附帶 FinMind response log，便於排查 API 失敗時的請求歷程。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

# 2025-04-21 — Patch LB-ADJ-COMPOSER-20250421A / LB-DATASOURCE-20250421A
- **Issue recap**: FinMind 備援僅能依賴 `TaiwanStockDividend` 欄位推導現金／股票配息，若資料全為 0 或欄位缺漏，仍無法計算出還原股價，營運端也難以分辨配息查詢與還原序列的差異。
- **Fix**: Netlify 還原函式接入 `TaiwanStockDividendResult`，以 `before_price`、`after_price` 與 `stock_and_cache_dividend` 產生手動調整比率，並在主流程將該結果納入備援鏈；同時暴露 `normaliseDividendResultRecord`、`buildDividendResultEvents` 供單元測試覆蓋。
- **Diagnostics**: `finmindStatus` 增列 `dividendResult` 狀態，前端測試卡顯示配息結果 API 狀態、資料集與請求區間；`dividendDiagnostics` 新增配息結果統計，便於快速檢視備援觸發原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

# 2025-04-14 — Patch LB-ADJ-COMPOSER-20250414A / LB-DATASOURCE-20250414A
- **Issue recap**: FinMind 備援仍出現 HTTP 400 導致還原序列無法落地，UI 無法掌握請求分段紀錄，零金額診斷也缺少原始欄位對照，難以判讀金額為 0 的實際欄位內容。
- **Fix**: Netlify 還原函式將 400 視為可拆分狀態並記錄請求 `responseLog`，於 fallback 摘要中傳回；同時擴充零金額快照的原始欄位預覽，前端測試卡新增 FinMind 請求紀錄區塊與欄位預覽。
- **Diagnostics**: 資料來源測試卡可直接查看 FinMind 股利與備援序列的請求狀態與訊息，零金額快照提供原始欄位值與解析後數值，利於營運端比對。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-04-10 — Patch LB-ADJ-COMPOSER-20250410A / LB-DATASOURCE-20250410A / LB-ADJ-PIPE-20250410A
- **Issue recap**: FinMind 備援成功回應仍難以判讀是 API 權限不足、Token 設定錯誤還是查詢參數造成無資料，使得營運端無法釐清除息事件未被還原的根本原因。
- **Fix**: Netlify 還原函式記錄 FinMind 呼叫回應與狀態碼，分類權限不足、Token 異常、參數錯誤與查無資料等情境，並於摘要 `finmindStatus` 帶回 UI 與 Worker。
- **Diagnostics**: 資料來源測試卡新增「FinMind API 診斷」區塊，若未設定 Token、權限不足或 API 回傳錯誤可即時看到建議處置；Worker 亦同步快取該狀態供後續流程使用。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-04-02 — Patch LB-ADJ-COMPOSER-20250402A / LB-DATASOURCE-20250402A
- **Issue recap**: Netlify 還原備援雖已回傳 FinMind 還原序列，但調整事件比率可能大於 1，Worker 端因此忽略備援並維持原始股價；測試卡僅顯示整體筆數，難以判讀係數對齊與備援樣本量。
- **Fix**: 重新計算 FinMind 還原係數差，產生小於 1 的調整比率並保留前後係數、變動方向與樣本統計，同時在 API 摘要揭露備援對齊筆數與係數樣本。
- **Diagnostics**: 測試卡新增價格筆數、成功/略過事件統計、備援統計與 FinMind 係數變化說明，協助快速鎖定係數停留在 1 的原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-31 — Patch LB-ADJ-COMPOSER-20250331A / LB-DATASOURCE-20250331A
- **Issue recap**: Yahoo 測試源回傳 `formatISODateFromDate is not defined`，FinMind 備援仍回傳 0 件有效還原事件，導致回測區間係數維持 1，缺乏進一步診斷資訊。
- **Fix**: TWSE proxy 補齊 `formatISODateFromDate`，Netlify 還原函式在調整失敗時改以 FinMind 還原股價序列推導係數並回傳備援摘要，前端測試卡顯示備援狀態、彙整事件與來源標籤。
- **Diagnostics**: 測試卡新增 FinMind 彙整事件區塊、備援還原狀態與詳細步驟；單元測試覆蓋備援序列的縮放結果，確保回傳係數與來源標記正確。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-28 — Patch LB-ADJ-COMPOSER-20250328A / LB-DATASOURCE-20250328A
- **Issue recap**: FinMind 備援常回傳金額為零的除權息紀錄，導致 `dividendEvents` 為空且回測交易價維持未還原值，測試面板亦缺乏顯示 pipeline 各階段狀態與問題線索。
- **Fix**: Netlify 還原函式在所有成分均為零時保留原始欄位快照並附帶於 `dividendDiagnostics.zeroAmountSamples`，回傳 `debugSteps` 與調整事件供前端檢視。
- **Diagnostics**: 資料來源測試卡新增還原流程狀態、零金額欄位快照與前三筆調整事件摘要，可快速確認係數略過的原因與對應欄位。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-20 — Patch LB-ADJ-COMPOSER-20250320A / LB-ADJ-PIPE-20250320A
- **Issue recap**: Netlify 備援回傳的 `dividendEvents` 雖然帶出有效配息資料，但 Worker 僅依賴 `adjustments`，一旦全數被標記為 `skipped`（如僅剩除權息事件、缺少基準價或權利比率偏高），就無法啟動備援縮放，前端仍顯示原始價位且摘要看不出個別紀錄的落差。
- **Fix**: Worker 端若未取得可用 `adjustments`，會回退使用 `dividendEvents` 重新計算係數；同時在 Netlify 函式中蒐集缺少除權息日、金額為零等診斷統計，並回傳給 UI 與快取以便追蹤。
- **Diagnostics**: 資料來源測試面板新增「FinMind 事件診斷」說明，各 proxy 也輸出請求參數與月份分段資訊，遇到 502/504 時可快速比對參數是否落在預期範圍。
- **Testing**: `node tests/dividend-normalisation.test.mjs`。

## 2025-03-12 — Patch LB-ADJ-COMPOSER-20250312A / LB-ADJ-PIPE-20250312A
- **Issue recap**: 還原股價長期顯示 0 件有效事件，回測成交價格維持原始價。追蹤 Netlify 回傳資料後確認 `cashCapitalIncrease` 與其他成分的比值公式錯誤，造成調整係數被判定為無效並全部跳過。
- **Fix**: 重新依照證交所參考價公式計算調整係數，統一 Netlify 與 Worker 的 `computeAdjustmentRatio` / `computeFallbackRatio`，並在單元測試加入混合配息、增資場景驗證。
- **Diagnostics**: Netlify 還原服務回傳 `debugSteps`，Worker 與主執行緒同步快取 `summary`、`adjustments` 與備援標記，前端新增「還原流程」步驟提示與彈窗內的除權息摘要，利於快速檢視每個階段狀態與略過原因。
- **Testing**: `node tests/dividend-normalisation.test.mjs`（新增調整係數驗證）。

> 後續若再出現無法調整的案例，先在前台檢視「還原套用」步驟的略過原因與備援標記，再對照 `log.md` 上次修復時的調整內容。
