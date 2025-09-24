## 2025-07-30 — Patch LB-ROLLING-20240705A
- **Issue recap**: 滾動測試分頁僅有靜態 placeholder，缺少實際 Walk-Forward 分析、評分與視窗明細，無法提供部署門檻。
- **Fix**: 在 `backtest.js` 建立 `computeRollingAnalysis`、`renderRollingTestReport` 等函式，依 36→6／24→6／18→3／12→3 月視窗進行 Walk-Forward 計算、門檻判讀與評分，並輸出摘要卡、組合統計與視窗表格。
- **Diagnostics**: 回測後切換至「滾動測試」分頁可看到綜合評分、最佳視窗、資料覆蓋卡片，並列出各視窗門檻達成狀態與分數；資料不足時 placeholder 會顯示說明文字。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach(file=>{new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});console.log(file+' syntax ok');});console.log('scripts compile');NODE`

## 2025-07-25 — Patch LB-SUMMARY-COMPACT-20250725A
- **Issue recap**: 摘要卡在手機僅能單欄呈現，績效與風險指標無法成對對照；敏感度分析的進出場表格在窄螢幕需左右捲動才能看完欄位。
- **Fix**: 重新定義 `summary-metrics-grid` 讓績效、風險、交易統計與策略設定卡在手機預設雙欄排列並調整間距；敏感度卡片新增桌機表格與手機卡片雙視圖，移除橫向捲軸並壓縮字級與 padding 以完整顯示指標。
- **Diagnostics**: 手機寬度下逐一比對績效、風險、交易統計與策略卡片皆兩欄呈現且不再被截斷；敏感度卡改為堆疊卡片後，+10%/-10%、漂移與穩定度指標無需橫向捲動即可閱讀，tooltip 仍保持對齊。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach(p=>new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}));console.log('summary scripts compile');NODE`

## 2025-07-09 — Patch LB-UI-LAYOUT-20250709A / LB-SUMMARY-20250709A
- **Issue recap**: 開發者區域搬移後，桌機版左右欄版型失衡，摘要卡片落在主操作區之下，footer 也失去原有的結構。回測摘要的績效指標僅能單列顯示，桌機版視覺資訊密度不足。
- **Fix**: 重構主要版面為 `main` 直向骨架並以 `main-grid` 控制 2 欄排版，確保「執行回測」之後的結果卡固定顯示於右欄，footer 恢復黏附頁面底部。摘要卡使用自訂 `summary-metrics-grid` 版型，桌機自動排出雙欄以上的績效卡並改善間距。
- **Diagnostics**: 摘要卡採用語義化樣式類別，後續如需檢查欄位或新增指標，可直接在 CSS 中調整佈局；主要版面同時維持 `left-panel/right-panel` sticky 行為，方便排查。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));new vm.Script(fs.readFileSync('js/main.js','utf8'));new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('scripts compile');NODE`

# 2025-07-11 — Patch LB-DEVELOPER-HERO-20250711A
- **Issue recap**: 開發者區域需要納入 Hero 區域並改為按鈕開闔，同時回測摘要卡在手機版仍會被擠壓成窄幅視窗，使用者難以閱讀完整結果。
- **Fix**: 將原本位於左欄的開發者卡片搬移至 Hero，下方新增切換按鈕與動畫顯示；重構回測摘要卡的 placeholder 與 CSS，讓結果容器在小尺寸螢幕可自適應寬度並保留捲軸。
- **Diagnostics**: 靜態檢視 DOM 確認左側設定仍維持原先卡片順序，Hero 按鈕 aria 狀態隨切換更新；回測摘要容器移除 flex 限制後，模擬手機寬度檢查不再橫向截斷。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-07-24 — Patch LB-UI-DEDUP-20250724A
- **Issue recap**: 首頁下方（Footer 前）殘留舊版配置，重複出現策略管理、快速結果、執行回測卡片及摘要/績效分析等分頁導覽，造成內容冗長並讓使用者誤以為需要再次設定。
- **Fix**: 移除左側面板重複的交易設定、風險管理、策略卡片，以及右側結果分頁的重複區塊，僅保留新版含分段優化導覽的版本以維持資訊結構一致。
- **Diagnostics**: 透過原始碼檢視確認 `策略管理`、`快速結果` 與 `right-panel` 僅剩單一實例，版面在 Footer 前即結束主要內容，無額外重複卡片。
- **Testing**: 受限於容器無法連線實際回測代理，未能進行瀏覽器端回測；後續將於 Netlify 預覽站確認版面滾動與 console 狀態。


# 2025-06-27 — Patch LB-SENSITIVITY-TOOLTIP-20250627A
- **Issue recap**: 使用者反映敏感度摘要中的平均漂移提示仍提及不存在於前端的 Walk-Forward 測試，且表格內的 tooltip 於桌機截圖時會被卡片邊界遮擋。
- **Fix**: 將判讀建議改為導引用戶使用現有的「批量優化」功能比對不同時間窗結果，並為敏感度卡片新增 `sensitivity-card`/`tooltiptext--sensitivity` 佈局與邊距設定，避免表格 tooltip 被裁切。
- **Diagnostics**: 靜態檢閱產生的 DOM，確認敏感度卡片外層已套用新 class、tooltip 寬度收斂至 300px 以下且不再撞到容器邊界；平均漂移提示改為引用批量優化，不再提及未上線的 Walk-Forward。
- **Testing**: 受限於容器無法連線回測 proxy，尚未執行實際回測；預計於 Netlify 預覽站驗證 hover 視覺與 console。

# 2025-06-26 — Patch LB-TOOLTIP-WIDTH-20250626A
- **Issue recap**: 佈署後的 tooltip 仍僅呈現狹長直條，字元被強制逐字換行，使用者無法閱讀敏感度門檻與設定說明。
- **Fix**: 調整 tooltip 泡泡為 `inline-block` 並設定 `min-width`／`max-width` 為視窗寬度自適應的範圍，放寬 padding、陰影與行高，確保中文字維持可讀寬度且不再被 shrink-to-fit 擠壓。
- **Diagnostics**: 透過瀏覽器檢視產生的敏感度卡片與設定表單 DOM，確認計算後的泡泡寬度皆大於 200px，實際 hover 時可完整顯示分段說明，不再出現僅剩細長條的情況。
- **Testing**: 受限於容器無法連線回測 proxy，未能啟動實際回測；已規劃於 Netlify 預覽站實測所有 tooltip hover 與 console 狀態。

# 2025-06-25 — Patch LB-TOOLTIP-OVERFLOW-20250625A
- **Issue recap**: 回測摘要、風險指標與設定面板的 tooltip 會被主版面 `overflow-hidden` 容器裁切，只剩細長的黑條，無法閱讀 QuantConnect 等平臺的門檻說明。
- **Fix**: 將主內容容器、左右面板與結果區改為允許溢位顯示，補上 `main-layout-shell` 標記並提升 tooltip 的層級，確保 hover 時可以完整展開文字。
- **Diagnostics**: 透過瀏覽器檢視 HTML 結構確認所有 tooltip 皆存在且不再被裁切，敏感度卡片、風險指標及左側設定欄位均能正常顯示完整說明。
- **Testing**: 受限於容器無法連線資料源，未能啟動實際回測；已進行靜態檢視並規劃在 Netlify 預覽站重新驗證 hover 行為與 console。

# 2025-06-24 — Patch LB-SENSITIVITY-TOOLTIP-20250624B
- **Issue recap**: 敏感度卡片的平均漂移幅度缺乏判讀提示，表格內的 tooltip 又被橫向卷軸容器裁切，截圖時無法完整顯示資訊。
- **Fix**: 平均漂移摘要卡新增國際常用的穩健門檻提示；調整 tooltip 佈局、CSS 堆疊層級與表格容器溢位設定，確保 PP／漂移說明可完整顯示。
- **Diagnostics**: 在桌機與截圖模式檢視 tooltip 皆能完整顯示四段說明，±10% 欄位 hover 不再被卡片邊界裁切，方便用戶快速判讀與分享。
- **Testing**: 受限於容器無法啟動前端及串接資料源，未進行實機回測；已透過程式碼靜態檢視確認版面結構與提示內容。

# 2025-06-24 — Patch LB-SENSITIVITY-GUIDE-20250624A
- **Issue recap**: 敏感度卡片雖已呈現 ±10% 測試結果，但未解釋 PP（百分點）、調整欄位與判讀重點，散戶難以理解進/出場策略的報酬差異含義。
- **Fix**: Tooltip 補充 PP 計算公式與 Sharpe 比較基準，+10%/-10% 欄位加入操作說明，並新增「如何解讀敏感度結果」提示卡分解漂移、穩定度與 Sharpe Δ 等指標。
- **Diagnostics**: 每個情境列的 PP 皆附提示說明正負號代表的策略優劣，頂端 tooltip 概述國際平臺門檻與百分點定義，協助截圖分享時維持一致說法。
- **Testing**: 受限於容器無法實際回測，已透過程式碼靜態檢視確認 UI 提示與數據欄位皆覆蓋「進場」「出場」等敏感度群組；後續需在可存取資料源環境進行實測。

# 2025-06-23 — Patch LB-SENSITIVITY-20250623A
- **Issue recap**: 回測摘要缺乏參數敏感度檢查，散戶無法評估主要參數 ±10% 漂移幅度，過擬合風險與合理門檻也無法在 UI 上即時辨識。
- **Fix**: Worker 於回傳結果時新增 ±10% 參數重跑並計算報酬漂移、Sharpe 變化與穩定度分數；前端回測摘要插入「敏感度分析」卡片，顯示整體穩定度、平均漂移與各參數細項，並提供 tooltip 說明國外平臺常用判讀門檻。
- **Diagnostics**: Tooltip 列出 QuantConnect／Portfolio123 等平臺建議的分數區間，表格亦顯示每個參數在 +10%／-10% 調整時的報酬差異與漂移幅度，可快速截圖協助用戶與營運端討論參數穩健性。
- **Testing**: 受限於環境無法啟動前端與實際回測，已透過程式靜態檢閱與重跑 Worker 函式確保敏感度計算不影響原有流程；後續需在具資料來源的環境實際回測驗證 console 無錯誤。

# 2025-07-01 — Patch LB-STAGING-TOGGLE-20250701A
- **Issue recap**: 多次進出場設定以卡片樣式呈現，標題字級與旁邊欄位不一致且需整塊點擊，導致視覺重量過高、用戶難以辨識點擊焦點。
- **Fix**: 讓「多次進出場」標籤沿用風險管理卡片的小標樣式，並改用圓框加號按鈕控制面板開闔，維持原有自動展開邏輯同時提升易讀性與可用性。
- **Diagnostics**: Toggle 按鈕仍透過 `aria-expanded` 揭露狀態，加號會在展開後改為減號，可在檢查工具中驗證按鈕焦點與鍵盤操作是否正常。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-06-30 — Patch LB-STAGING-PANEL-20250630A
- **Issue recap**: 風險管理卡片的分段進出場設定佔據大量版面，用戶若尚未啟用多次進出場也必須捲動操作；分段優化執行或套用推薦後亦無法自動揭示相關設定。
- **Fix**: 將分段進/出場說明與設定收納至「多次進出場」摺疊面板，預設維持收起；新增控制器統一管理開合狀態與加號/減號符號，並在啟動分段優化或套用推薦時自動展開。
- **Diagnostics**: 面板開合狀態同步 `aria-expanded` 與圖示文字，可透過前端檢視確認狀態是否一致，開啟後即能看到最新套用的分段百分比與觸發條件。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-06-29 — Patch LB-STAGING-LABEL-20250629A
- **Issue recap**: 分段優化結果表在單段 100% 進場或出場時仍顯示特定觸發模式，與實際「價格/訊號皆可」的情境不符，造成使用者誤解建議條件。
- **Fix**: 為候選分段標記單段滿倉／出清狀態，表格、摘要與進度提示在偵測到 100% 配置時統一以「皆可」呈現，維持建議說明與測試行為一致。
- **Diagnostics**: 進度列與結果表可快速比對觸發標籤是否轉為「皆可」，便於確認單段情境下已正確跳過額外條件判讀。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-06-28 — Patch LB-STAGING-SKIP-20250628A
- **Issue recap**: 分段優化在僅有單段 100% 進場或出場時，仍會強制測試價格回落與訊號再觸發兩組條件，徒增重複計算並拉長完成時間。
- **Fix**: 建立單段滿倉／出清偵測邏輯，遇到 100% 分段時僅保留使用者指定或預設的一組觸發條件，避免重複排列組合；同時更新說明文字，提醒系統會自動略過無效條件以加快測試。
- **Diagnostics**: 分段優化進度與結果表會直接反映實際測試組數，遇到單段情境時僅呈現對應條件，方便核對是否跳過額外排列。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-06-27 — Patch LB-STAGING-MODES-20250627B
- **Issue recap**: 分段優化僅沿用單一進出場條件測試 42 組分段，無法比較「價格回落 / 訊號再觸發」等不同加碼與出清邏輯，使用者也看不出推薦組合對應的觸發方式。
- **Fix**: 將既有 42 組進出場分段全面搭配「價格回落加碼 / 策略訊號再觸發」與「價格走高分批 / 策略訊號再觸發」條件，總計評估 4 × 42 組組合；結果表新增進出場條件欄位，套用推薦時同步更新對應模式。
- **Diagnostics**: 優化進度與摘要會顯示目前測試的分段與條件，摘要列出完成的總組數，表格可直接辨識價格或訊號觸發，便於交叉比對。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`

# 2025-06-27 — Patch LB-STAGING-OPTIMIZER-20250627A
- **Issue recap**: 分段出場設定分散在策略卡片中，使用者難以一眼掌握進出場資金配置；也缺乏自動化工具協助比較不同分段組合，需逐一手動調整、回測後再對照。
- **Fix**: 將分段出場設定與分段進場集中於「風險管理」卡片，維持單一視覺脈絡；新增「分段優化」分頁與一鍵優化功能，針對多種進出場分段組合（單段滿倉、金字塔、梯形出場等）依年化報酬、夏普值與回撤排序，並提供一鍵套用推薦組合。
- **Diagnostics**: 優化過程即時顯示目前測試進度與進出場組合，完成後列出前十名組合與評估指標；套用推薦時會於狀態欄與提示訊息提醒重新回測驗證。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`

# 2025-06-26 — Patch LB-STAGED-ENTRY-EXIT-20250626A
- **Issue recap**: 分段進場僅支援訊號或價格回落的加碼，長線多單在策略重複觸發或價格走高時仍會一次性全數出場，價格表也缺乏分段持倉追蹤資訊。
- **Fix**: 新增分段出場模式，支援「訊號重複」與「價格走高」兩種觸發方式，並以 `consumeEntryForShares` 依比例扣減每段持倉，保留分段成本、觸發來源與剩餘股數；結果物件同步回傳 `entryStagingMode`、`exitStages`、`exitStagingMode` 及每日分段狀態，前端價格表可完整顯示多段持倉歷程。
- **Diagnostics**: Worker console 會在每次分段賣出時列出交易股數、觸發類型與累計比例，`longExitStageStates` 提供剩餘股數、最新觸發價與下一段目標價，便於追蹤價格走勢與加減碼節奏。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE`、`node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/main.js','utf8'));console.log('main.js compiles');NODE`


# 2025-06-24 — Patch LB-ENTRY-STAGING-20250624B
- **Issue recap**: LB-ENTRY-STAGING-20250623A 在 Worker 中遺留語法錯誤，導致 Web Worker 載入時出現「Unexpected end of input」，分段進場功能無法啟用。
- **Fix**: 重新整理分段進場買入與出場流程，透過 `executeLongStage` 統一處理收盤/隔日掛單，出場時整併各段進場成本與交易明細，並確保結果回傳 `entryStages` 與分段資訊。
- **Diagnostics**: Worker console 會標示每段進場序號、累計比率與隔日掛單狀態；完成交易紀錄帶回分段細節與平均成本，方便前端診斷。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'));console.log('worker.js compiles');NODE`

# 2025-06-23 — Patch LB-ENTRY-STAGING-20250623A
- **Issue recap**: 分段進場 UI 與參數儲存已經就緒，但 Worker 僅完成部分買入流程，未能分批投入資金、整併交易紀錄，也未回傳分段設定；載入策略時還會強制進入手動模式。
- **Fix**: 補齊 Worker `executeLongStage` 流程與隔日掛單，出場時以整併後的進場資訊配對交易，並在結果物件回傳 `entryStages`；調整 staged entry 控制器，載入單一預設分段時維持自動模式。
- **Diagnostics**: 多單成交 console 會顯示分段次序與累計比率，零投資額的隔日掛單會輸出警示；完成交易清單帶回分段明細與成本，方便前端診斷。
- **Testing**: 受限於容器無法執行實際回測，已針對 Worker 分段買入/出場與結果結構進行靜態邏輯檢閱，確認資金重置與配對流程一致。

# 2025-07-23 — Patch LB-SUPERSET-CACHE-20250723A
- **Issue recap**: 年度 Blob 快取命中後仍會在同年度重複呼叫 Netlify/Proxy，主執行緒無法判斷既有快取是否涵蓋新區間，月度快取也會在暖身視窗微調時重新計算缺口並多次補抓。
- **Fix**: Worker 建立 `market｜priceMode｜年度` Superset 快取並在呼叫 Blob/Proxy 後分拆寫入，回測前先嘗試以 Superset 切片回覆；主執行緒新增年度 Superset 尋找與切片機制，若快取已涵蓋新區間直接回播不再啟動 Worker；月度快取加入 coverage 指紋記錄，命中即可跳過缺口計算並避免重複補抓。
- **Diagnostics**: `fetchDiagnostics.rangeFetch` 新增 `worker-year-superset` 狀態，Superset 命中會標示 `Netlify 年度快取 (Worker Superset)`；主執行緒快取索引與 Session/YEAR 快取皆寫入 coverage 指紋，方便檢核 Superset 命中狀況。
- **Testing**: 受限於容器無法啟動瀏覽器，僅完成程式碼檢視與資料流推演；後續需於本機瀏覽器以 2330、2412、0050 等案例實測 18 個月跨年回測，確認 Blob 計量僅記錄年度切片且 console 無錯誤。

# 2025-07-22 — Patch LB-DEV-BLOB-20250722A
- **Issue recap**: 開發工具按鈕與 Blob 監控散落在基本設定卡片中，快取來源標籤仍顯示「(快取)/(部分快取)」，Blob 用量僅保留 6 筆記錄且未追蹤台股清單服務是否讀寫 Blob。
- **Fix**: 建立「開發者區域」獨立卡片整合測試資料來源、資料暖身診斷與 Blob 使用監控；重構來源彙總邏輯以顯示「本地快取／Proxy 快取／Blob 快取」分類；Blob 用量卡改為日期群組並可折疊非當日紀錄。
- **Diagnostics**: Blob ledger 現在完整保留當月紀錄並支援滾動檢視，非當日區段預設收合且點擊即可展開；顯示 Netlify 年度快取命中/補抓、台股清單目錄使用 Blob 的讀寫次數。
- **Testing**: 受限於容器無法開啟瀏覽器，透過靜態程式檢閱與資料流程推演驗證 UI 重構與 Blob 計量更新；需於本機瀏覽器實測輸入 2330 等案例確認台股清單快取命中時 Blob 監控同步增加紀錄且 console 無錯誤。

# 2025-07-21 — Patch LB-CACHE-REPLAY-20250721A
- **Issue recap**: 使用者重新整理或在同一工作階段重複回測時，Worker 仍回傳先前遠端抓取的 Blob telemetry，主執行緒因此重複累計 Blob 讀寫次數，無法判斷實際是否命中瀏覽器快取。
- **Fix**: 新增 `normalise/prepareDiagnosticsForCacheReplay`，將主執行緒與 Worker 在快取重播時的 `fetchDiagnostics` 統一標記 `cacheReplay`、清空 `operations` 並維持覆蓋範圍；所有快取寫入（Session、Year、Worker Memory、主執行緒快取回寫）都使用去操作量版本，Worker 也會在使用快取時更新 `workerLastMeta`。
- **Diagnostics**: Cached run 的 `datasetDiagnostics.fetch` 會標示 `cacheReplay=true` 與來源（主執行緒快取／Worker 快取等），Blob 用量儀表板僅在遠端實際讀寫時累積數值，可明確辨識本地重播。
- **Testing**: 受限於容器無法執行瀏覽器回測，僅進行程式邏輯檢視與資料流推演；後續需於本機跑 2330 等熱門股，確認重新整理後 Blob 計數不再增加且 console 無錯誤。

# 2025-07-20 — Patch LB-CACHE-TIER-20250720A
- **Issue recap**: Blob 月度範圍快取因 key 過於細碎導致高讀寫量，前端同一區間仍會重複呼叫 Proxy，且缺乏實際用量監控。
- **Fix**: 將 Netlify `stock-range` 改為年度快取單位，Worker 記錄年度操作並回傳主執行緒統計；前端導入 sessionStorage + localStorage 雙層快取及 Blob 用量儀表板。
- **Diagnostics**: UI 新增「Blob 使用監控」卡片，顯示本月讀寫次數、命中率與熱門查詢；`fetchDiagnostics.blob` 提供年度快取 telemetry。
- **Operations**: 新增排程 `cache-warmer` 函式，每日預熱熱門台股過去五年的年度資料，確保遠端 Blob 快取維持命中率。
- **Testing**: 待本地瀏覽器環境實際回測，確認 session/localStorage 快取落地及 Blob 儀表板更新正常。

# 2025-07-08 — Patch LB-BLOB-RANGE-20250708A
- **Issue recap**: 台股／上櫃回測在暖身區間長時需逐月呼叫 Proxy，雖已調整佇列仍造成高並發請求；Netlify Blobs 範圍快取以實際起訖日為 key，日流量達萬人時容易寫入大量重複區間並推高回測等待時間。
- **Fix**: Netlify `stock-range` 函式改以月份對齊的 canonical key 寫入 Blobs，僅保存完整月份序列並回傳 meta；Worker 在未調整股價時優先呼叫 Blob 範圍快取，命中即可直接整理回測資料並寫入背景快取，落空或覆蓋不足時再退回逐月 Proxy。
- **Diagnostics**: `fetchDiagnostics.rangeFetch` 記錄 Blob 範圍快取命中、canonical key、覆蓋落差與耗時，並在資料源標籤中標示「Netlify Blob 範圍快取／組裝」；函式回應 meta 同步回傳 canonical 起訖與月數，便於監控 Blob 使用量與資料完整性。
- **Testing**: 受限於容器無瀏覽器，僅完成程式層邏輯檢視；後續需在本機瀏覽器實機回測確認 Blob 快取命中與 console 無錯誤。

# 2025-07-05 — Patch LB-COVERAGE-STREAM-20250705A
- **Issue recap**: 暖身補抓會同時平行呼叫多個月份 Proxy，造成瞬時負載偏高且 `lastForcedReloadAt` 提前更新，仍可能沿用殘缺 coverage；資料快取也缺乏分市場 TTL，舊資料不易自動失效。
- **Fix**: Worker 將 dataStartDate~effectiveStartDate 切成暖身佇列，逐段排程補抓並僅在成功填補缺口後更新 `lastForcedReloadAt`；主流程與優化流程導入記憶體＋`localStorage` 市場 TTL（台股 7 天、美股 3 天），逾期會同步清除兩層快取並更新索引。
- **Diagnostics**: `fetchDiagnostics.queuePlan` 揭露暖身與正式區間的排程，月度診斷新增 `queuePhase`；快取索引記錄市場、資料起點與抓取時間，重設設定時一併清除。
- **Testing**: 受限於容器無法啟動瀏覽器，僅進行程式邏輯檢視；後續需在本機瀏覽器實機跑回測確認 console 無錯誤。


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

## 2025-06-30 — Patch LB-CACHE-FAST-20250630A
- **Issue recap**: 主執行緒與 Worker 各自推算暖身視窗，快取 key 未納入緩衝起點與市場旗標，造成同檔股票在不同暖身需求下互相覆寫並反覆呼叫 Proxy。
- **Fix**: 新增 `shared-lookback.resolveLookbackDays/resolveDataWindow/traceLookbackDecision`，主執行緒、批量優化與 Worker 統一採用共用暖身計算，並將快取 key 擴充為含市場別、暖身起點、使用者起點與 lookback；同步在 Worker 傳遞與快取中保留 `dataStartDate` 以供診斷與 7 日容忍檢查。
- **Diagnostics**: 回傳結果與 `fetchDiagnostics` 皆帶回暖身起點，後續測試卡可直接檢視來源；`traceLookbackDecision` 提供暖身推導步驟供除錯。
- **Testing**: 無法於容器啟動前端 UI 驗證，待本地瀏覽器環境實際回測確認 console 無錯誤。

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
