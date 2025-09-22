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
