

## 2025-10-24 — Patch LB-BATCH-CACHE-20251024A
- **Issue recap**: 滾動測試啟動後僅裁切視窗資料傳給 Worker，但批量優化仍沿用舊的全域快取或 Session 快取，導致最佳參數落在舊資料範圍；重新整理頁面後仍可能沿用殘缺快取。
- **Fix**: `js/batch-optimization.js` 在快取檢查判定需要重新抓取時，於 Worker 回傳結果後同步更新 `cachedStockData`、`lastFetchSettings` 與 Session 快取條目，並在開發者模式卡片記錄快取決策與資料範圍。
- **Diagnostics**: 交替執行滾動視窗優化與批量優化，確認開發者模式卡片出現「批量快取診斷」紀錄，標示沿用/重建快取與需求區間，並驗證重新整理後批量優化仍能重現首次最佳參數。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-22 — Patch LB-BATCH-CACHE-20251022A
- **Issue recap**: Walk-Forward 自動優化後立即切換批量優化，仍可能沿用失效的全域快取或覆寫視窗，導致最佳參數無法重現；缺乏可追蹤的快取決策日誌。
- **Fix**:
  - `js/batch-optimization.js` 改為優先回填 `cachedDataStore` 內與請求相符的資料集，僅在覆蓋檢查通過時才傳給 Worker，若範圍不足會強制重抓。
  - `resolveWorkerCachePayload` 新增資料範圍摘要、來源標記與需求記錄，並共用 `logBatchCacheDecision` 在單參數優化與組合回測時輸出 debug log。
- **Diagnostics**:
  - 切換「滾動測試自動優化 → 批量優化」情境，確認 console 會列印 `required`、`summary`、`source`，對照是否命中視窗或全域快取。
  - 觀察當覆寫資料不足時是否出現 `cachedDataOverride skipped` 訊息並改為重新抓取。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-18 — Patch LB-BATCH-CACHE-20251018A
- **Scope**: 批量優化快取覆用檢查與共用載入流程。
- **Updates**:
  - `js/batch-optimization.js` 新增 `resolveWorkerCachePayload` helper，統一使用 `needsDataFetch`／`buildCacheKey` 與 `lastFetchSettings` 檢查資料是否覆蓋目標區間，並在快取失效時自動改為讓 Worker 重新抓取資料。
  - 單參數優化、風險參數優化與組合回測皆改用新 helper 傳遞 `cachedData`／`cachedMeta`，避免再度出現條件分歧造成錯誤覆用舊資料。
- **Testing**:
  - `node - <<'NODE' ...` 編譯 `js/batch-optimization.js`（本地容器）
  - 手動情境（待實機）：調整回測日期後直接啟動批量優化，確認最終結果與立即回測、單次優化輸出一致且 console 無錯誤。

## 2026-07-10 — Patch LB-STRATEGY-COMPARE-20260710C
- **Scope**: 策略比較分頁圖示位置調整與趨勢信心格式修正。
- **Updates**:
  - 依照設計在分頁捲動標籤加入 Lucide 圖示，移除卡片標題上的圖示，維持介面層級一致性。
  - 策略比較表的平均狀態信心改採與摘要相同的百分比格式，並兼容舊版儲存的數據。
  - 更新策略快照版本碼為 `LB-STRATEGY-COMPARE-20260710C`，供後續除錯追蹤。
- **Testing**: 需於瀏覽器啟動回測流程確認無 console error（本地容器無法啟動瀏覽器）。

## 2026-07-10 — Patch LB-STRATEGY-COMPARE-20260710B
- **Scope**: 策略比較分頁視覺與指標呈現微調。
- **Updates**:
  - 分頁內「策略比較設定」、「比較結果」標題新增 Lucide 圖示，與其他分頁標頭風格一致。
  - 策略比較表缺漏資料的提示字色改為站內慣用的橘色（`var(--secondary)`），維持一致的提醒層級。
  - 將趨勢區間欄位的「覆蓋」資訊改為呈現平均狀態信心，更新儲存快照版本碼為 `LB-STRATEGY-COMPARE-20260710B`。
- **Testing**: 需於瀏覽器啟動回測流程確認無 console error（本地容器無法啟動瀏覽器）。

## 2026-07-10 — Patch LB-STRATEGY-COMPARE-20260710A
- **Scope**: 策略比較分頁、儲存指標擴充與資金基準命名調整。
- **Updates**:
  - 將「初始本金」、「總資金」文案更新為「初始本金-固定金額買入」、「總資金-獲利再投入」，同步調整 tooltip 與報表標題。
  - 儲存策略時追加年化、Sharpe、最大回撤、交易次數、敏感度、滾動測試、趨勢摘要等指標快照，並標記版本碼 `LB-STRATEGY-COMPARE-20260710A`。
  - 新增「策略比較」分頁，可多選策略與欄位，缺漏資訊時提示「請先測試後保存策略」，資料來源連動儲存結果。
  - 滾動測試模組記錄彙總評分至 `state.aggregate`，供策略比較表讀取滾動測試分數與產出時間。
- **Testing**: 尚未執行自動化測試（需於瀏覽器環境驗證 UI 互動）。

## 2026-10-28 — Patch LB-ROLLING-TEST-20251028A
- **Issue recap**: 使用者希望 OOS 品質分數對應門檻、總分維持 0～100 顯示，同時需要更直覺的評級呈現、詳細計算明細與橫向比較視窗的表格，並取消強制的成交筆數門檻。
- **Fix**:
  - `index.html` 將「判定等級」卡片移至報告頂端僅顯示評級，新增可展開的總結說明、移除最少成交筆數欄位，並把逐窗表格改為指標列 × 視窗欄的轉置排版。
  - `js/rolling-test.js` 擴充 `computeAggregateReport` 與儀表卡，加入 OOS 指標分數、PSR／DSR／WFE／窗分數等可展開細節，調整總分卡片、評級卡與轉置後的逐窗渲染，並完全移除成交筆數門檻判定。
  - `clearRollingReport`、`renderSummaryDetails` 與相關說明改為支援新的 grade 卡與可折疊總結，確保回報資料時能重設狀態。
- **Docs**: `README.md` 更新為 LB-ROLLING-TEST-20251028A，說明評級卡片、詳細分數明細、轉置表格與成交筆數門檻調整。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-10-22 — Patch LB-ROLLING-TEST-20251022A
- **Issue recap**: 使用者回報 OOS 品質在多數指標未達門檻時仍顯示滿分、Walk-Forward 總分可能超過 100 分，且主回測完成後滾動測試面板仍出現「請先執行一次主回測」提示。
- **Fix**:
  - `js/rolling-test.js` 為 OOS 品質新增達標權重比，將品質分數限制在指標達標比例之內，並調整狀態文字改用「合格／略低／不足」等白話語句。
  - 將 Walk-Forward 總分截斷於 0～1 後再換算 0～100 分，避免 WFE 調整造成超過 100 分的顯示。
  - 監聽 `lazybacktest:visible-data-changed` 事件，自動刷新滾動測試預覽以移除「請先回測」提醒。
  - `computeOosQualityScore` 回傳指標達標比，摘要文字新增指標達標資訊，並更新模組版本碼至 `LB-ROLLING-TEST-20251022A`。
- **Docs**: `README.md` 更新為 LB-ROLLING-TEST-20251022A 的評分流程與介面調整說明。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-10-18 — Patch LB-ROLLING-TEST-20251018A
- **Issue recap**: OOS 品質在多項指標未達門檻時仍可能顯示滿分，總分僅顯示 0～1 小數且儀表板說明過於制式。
- **Fix**:
  - `js/rolling-test.js` 以使用者門檻作為 OOS 正規化起點並補齊缺漏指標的權重，確保未達門檻時不再出現滿分，並加入 0～100 分顯示與指標狀態提示。
  - 更新 Walk-Forward 總分卡片與報告敘述，轉為 0～100 分並在各卡片下方以白話呈現「合格／待加強」訊息。
  - 新增 `formatScorePoints` 與狀態描述函式，統一單窗分數與總分的顯示格式。
- **Docs**: `README.md` 說明新版正規化方式、0～100 分顯示與卡片提示；`log.md` 紀錄本次調整。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-10-12 — Patch LB-ROLLING-TEST-20251012A
- **Issue recap**: Walk-Forward 評分仍採 0~100 分加權與平均 WFE，缺乏 PSR／DSR 統計可信度與中位數穩健檢查，亦未揭露視窗樣本、MinTRL 與新版評級條件。
- **Fix**:
  - `js/worker.js` 新增 `computeReturnMomentSums` 並於 `runStrategy` 回傳 `oosDailyStats`，提供樣本數、動差、偏度、峰度等資料以支援 PSR／DSR／MinTRL 計算。
  - `js/rolling-test.js` 導入新版評分流程，計算 OOS 品質、PSR95、DSR、StatWeight、WindowScore、WFE 中位數與 TotalScore，並依 Credibility 與 DSR 調整評級；同時更新 UI 渲染、摘要文字與模組版號 `LB-ROLLING-TEST-20251012A`。
  - `index.html` 將訓練期優化與門檻欄位移入進階設定、預設開啟自動優化、擴充卡片／表格欄位顯示 PSR、DSR、可信度、WFE、窗分數與樣本資訊，調整排版間距與說明文字。
  - `README.md` 補充 Walk-Forward 新公式與評級門檻，協助使用者了解 OOS 品質 × 統計可信度 × WFE 的評分邏輯。
- **Diagnostics**:
  - 逐窗計算 WFE 中位數、PSR95、DSR、MinTRL，確認無交易或樣本不足時能標記並提示延長資料。
  - 驗證 `syncRollingOptimizeUI` 在預設勾選下展開設定，並於進階收合後保持狀態同步。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-10 — Patch LB-ROLLING-TEST-20250930B
- **Scope**: Walk-Forward 視窗自動調整與使用者提醒優化。
- **Updates**:
  - 以「滾動測試次數」取代固定訓練／測試／平移月份，依既有 36：12：6 比例與回測區間自動縮放視窗長度。
  - 新增進階設定折疊容器，保留原始欄位供專業使用者手動覆寫，同步更新版本代碼與版面文字。
  - 視窗預覽顯示目標次數與實際結果，若資料不足或期間少於五年會提示延長回測與建議使用五年以上數據。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`


## 2026-07-09 — Patch LB-LOCAL-REFINE-20260709A
- **Scope**: 批量優化局部微調範圍與進度呈現調整。
- **Updates**:
  - 於局部微調卡片新增排名選擇與自訂區間輸入，支援前三名、四到六名、六到十名或自訂名次的批量微調範圍。
  - 將交叉優化進度卡片移至階段卡片與結果表格之間，並顯示所屬排名資訊，強化進度脈絡。
  - 微調產出在結果表格以「微調」標籤呈現，與進場／出場固定範圍並列，避免與基礎結果混淆。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-07 — Patch LB-LOCAL-REFINE-20260707A
- **Scope**: 批量優化第四階段局部微調（SPSA／CEM）擾動放大。
- **Updates**:
  - 放大局部微調步長計算，依參數跨度增加額外範圍加權與最小步幅，確保 SPSA 擾動能跨越更大的鄰域。
  - 提升範圍權重的探索倍率，使 SPSA 尺度上限達約 3 倍原步長，最低擾動亦維持在原設定以上。
  - 擴大 CEM 採樣半徑初始值與衰減下限，讓多輪取樣仍能覆蓋超過半個參數區間，維持較慢衰減速度。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-06 — Patch LB-LOCAL-REFINE-20260705B
- **Scope**: 批量優化第四階段局部微調（SPSA／CEM）擾動調整。
- **Updates**:
  - 建立範圍權重估算與 SPSA 尺度設定，依策略參數跨度自動提升初始擾動並維持較高的最小步幅。
  - CEM 採樣半徑改為依參數權重推算初始半徑與衰減速率，確保多輪取樣仍能離散探索較大的鄰域。
  - 擴充局部微調步長計算，依範圍與離散步階動態放大擾動幅度，同時維持落在策略定義的合法範圍。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-05 — Patch LB-LOCAL-REFINE-20260705A
- **Scope**: 批量優化第四階段（局部微調）
- **Updates**:
  - 在交叉優化控制面板新增「第四階段：局部微調（SPSA 或 CEM）」按鈕與說明，沿用既有表格產出流程。
  - 導入自動挑選前三組最佳結果，根據參數維度自動選用 SPSA 或 CEM 進行微調，並將結果追加至優化表格。
  - 顯示進度條狀態與演算法資訊，確保局部微調與第二、三階段共享去重、排序與渲染邏輯。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-30 — Patch LB-ROLLING-TEST-DEBUG-20250930A
- **Issue recap**: Walk-Forward 第二個視窗起仍出現訓練期批量優化與滾動測試記錄的最佳參數不一致，有時甚至優於獨立批量優化結果。
- **Confirmed non-issues**:
  - 組合迭代上限：`plan.config.iterationLimit` 會透過 `runCombinationOptimizationForWindow()` 傳入 `window.batchOptimization.runCombinationOptimization()`，其後也用於剩餘範圍的交替優化回圈，確認與批量優化面板一致。
  - 視窗日期與暖身：`buildTrainingWindowBaseParams()` 與 `normalizeWindowBaseParams()` 在進入優化與訓練/測試前，會逐窗覆寫 `startDate`、`endDate` 並移除 `recent*` 相對期間旗標，確保每輪優化與回測皆使用訓練期的實際日期與緩衝規則。
  - 交易設定覆寫：Rolling Test 呼叫批量優化時以 `baseParamsOverride` 複製 `tradeTiming`、`initialCapital`、`positionSize`、多/空分段等控制，`prepareBaseParamsForOptimization()` 會保留這些欄位後再進行暖身推算，因此隔日買入與全額投入設定未被改寫。 
- **Active hypotheses**:
  - 需確認 `prepareBaseParamsForOptimization()` 與後續 `optimizeStrategyWithInternalConvergence()` 是否在多輪視窗間殘留前一輪的 `currentCombo` 參數或 Worker 快取，導致後續視窗使用到不同於覆寫日期的資料切片。 
  - `optimizeSingleStrategyParameter()` 目前永遠帶入 `cachedStockData`，可能在滾動視窗交替時沿用整體快取而未重新裁切，後續需比對 Worker 實際收到的 `startDate`/`dataStartDate` 是否與訓練窗一致。
- **Next actions**:
  - 加入每輪視窗的優化 debug log，記錄 `baseParamsOverride`、Worker payload 的 `startDate`/`dataStartDate`、以及批量優化回傳的 `__finalMetric`，以便與獨立批量優化結果比對。
  - 若發現快取裁切不一致，考慮在滾動流程中為每個訓練窗強制重建 `cachedData` 子集或調整批量優化 Worker 的 `useCachedData` 行為。

## 2025-09-22 — Patch LB-ROLLING-TEST-20250922B
- **Scope**: Walk-Forward 評分與滾動測試批量優化整合。
- **Updates**:
  - 導入 Pardo (2014) Walk-Forward Efficiency 與 QuantConnect／TradeStation 門檻，重寫評分公式並公開權重與分段換算規則。
  - 總結卡片新增 Walk-Forward Efficiency 指標，並在報告說明具體門檻與評級標準。
  - 精簡參數摘要文字，聚合多空流程與風控設定，提升逐窗表格的可讀性。
  - 訓練期優化自動初始化批量優化 Worker，保證滾動測試使用與批量優化一致的搜尋範圍與最佳參數。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-18 — Patch LB-ROLLING-TEST-20250918A
- **Scope**: Walk-Forward 測試報告與資料驗證。
- **Updates**:
  - 修正 Worker 在滾動測試期間沿用完整快取資料的問題，改為依視窗暖身起點與結束日切片資料，確保訓練／測試指標與單窗回測一致。
  - 啟動滾動測試前新增視窗覆蓋檢查，若資料期間不足或交易日低於建議門檻，會中止執行並提示不足原因。
  - 重構 Walk-Forward 評分公式，改以門檻比率換算 0～100 分，並在報告說明門檻約 70 分，超標才逐步加分。
  - 逐窗結果表加入參數摘要欄與更完整的多空／風控設定敘述，便於比對每個視窗採用的策略組合。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-15 — Patch LB-ROLLING-TEST-AUTO-OPT-20260115A
- **Scope**: Walk-Forward 訓練期參數優化。
- **Updates**:
  - 滾動測試設定新增「訓練期自動優化」開關，可選擇目標指標、掃描步數與要優化的策略範圍（做多 / 做空 / 風險控管）。
  - 每個視窗在訓練期自動呼叫批量優化模組，找出最佳參數後再重跑訓練與測試期，報告會附上參數調整摘要。
  - 進度條與逐窗備註會標示優化狀態，缺少模組或沒有可優化參數時會自動降級為原始設定。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-09 — Patch LB-SINGLE-OPT-WARMUP-20260109A
- **Issue recap**: 單一參數優化在 `LB-SINGLE-OPT-20251115A` 改版後，Worker 未帶入 `dataStartDate` 與暖身視窗，僅以使用者設定起始日回測，導致表格內的年化報酬率與夏普值與實際回測落差。
- **Fix**: Worker 在處理優化訊息時同步寫入 `lookbackDays`、`effectiveStartDate`、`dataStartDate`，並在每輪優化測試前將 `originalStartDate`、暖身起點與緩衝天數灌入參數，確保與主回測共用相同資料視窗。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`


## 2025-12-30 — Patch LB-AI-TRADE-VOLATILITY-20251230A
- **Scope**: 波動分級策略與多分類 AI 預測強化。
- **Updates**:
  - ANN 與 LSTM 改為三分類 softmax，依自訂大漲/大跌門檻產生標籤並回傳完整機率向量與分類結果。
  - 前端新增「波動分級持有」策略，可在大漲進場、小幅波動續抱、偵測大跌出場，交易表同步顯示分類與買賣價。
  - 勝率摘要、種子預設名稱與最佳化流程納入月/年平均報酬與波動門檻，確保重播與 UI 資訊一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE'`

## 2025-12-29 — Patch LB-AI-TRADE-RULE-20251229A
- **Scope**: AI 買入規則擴充與交易評估一致性。
- **Updates**:
  - 新增「收盤價買入」選項，預測上漲時即以當日收盤價買進、隔日收盤價賣出，並在 UI 切換時同步重算交易表與摘要。
  - `js/worker.js` 回傳收盤買入的買／賣價與報酬欄位，確保 ANN 重播與種子儲存可復現該策略。
  - `js/ai-prediction.js` 擴充交易評估邏輯，將三種買入規則統一納入凱利與固定投入計算。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-08 — Patch LB-AI-VOL-QUARTILE-20260108A
- **Issue recap**: 三分類模式下的大跌門檻以正值呈現，與「正漲幅／負跌幅」定義不符，且前端 quartile 仍採整體 25%/75% 分位，使得上下限無法對應訓練集的正負極端樣本。
- **Fix**: `js/ai-prediction.js` 將漲跌幅重新拆分為正報酬與負報酬列表，各自取前 25% 四分位；同時保留負號顯示大跌門檻並更新門檻說明與版本碼，讓交易摘要、種子預設名稱與 UI 提示一致。
- **Diagnostics**: 以同一訓練集重訓 ANN/LSTM，確認狀態列與表格顯示的大跌門檻為負值，且與 Worker 回傳的 `lowerQuantile` 一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-28 — Patch LB-AI-TRADE-RULE-20251228A
- **Scope**: AI 預測交易邏輯與資金配置體驗同步調整。
- **Updates**:
  - 新增「收盤價掛單／開盤價買入」雙買入規則選項，交易表與摘要會依使用者切換即時重算並顯示對應買入邏輯。
  - 固定投入比例改以百分比輸入，預設 100% 且與凱利公式切換同步更新種子、最佳化與摘要資訊。
  - Worker 回傳交易 meta 含近收盤與隔日開盤進場收益，確保種子重播與前端最佳化能重建相同交易結果。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-22 — Patch LB-AI-LSTM-20250922A
- **Scope**: AI 預測分頁資金控管、收益呈現與種子管理強化。
- **Features**:
  - 勝率門檻可獨立於訓練後重算交易結果並提供 50%~100% 自動掃描最佳化。
  - 凱利公式與固定投入比例可即時切換，交易報酬統計改採中位數／平均報酬%／標準差，表格同步改為交易報酬%。
  - 新增隔日預測摘要，表格保留最後一筆測試資料並附上隔日機率。
  - 建立本地種子儲存／載入與多選支援，預設名稱依訓練勝率與測試正確率生成。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-15 — Patch LB-AI-LSTM-20250915A
- **Scope**: 新增「AI 預測」分頁與 LSTM 深度學習模組，整合凱利公式資金管理與快取資料串接。
- **Features**:
  - 建立 `ai-prediction` 分頁，提供 lookback、epochs、批次大小、學習率與凱利公式開關等設定，並顯示訓練／測試勝率、交易摘要與文獻參考。
  - 引入 TensorFlow.js LSTM 模型，以 2:1 訓練／測試切分計算隔日收盤漲跌方向，並根據可視資料計算日報酬、Kelly 比率與平均盈虧比。
  - 擴充 `backtest.js` 將 `visibleStockData` 更新事件透過 `lazybacktestAIBridge` 廣播，供 AI 模組取得資料與同步資料摘要。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-12 — Patch LB-TRADE-ENTRY-20251112A
- **Issue recap**: 分段進場在全部出場後，`buildAggregatedLongEntry` 仍以已被清零的 `longPositionCost*` 值計算，導致交易紀錄中的買入價格被顯示為 0。
- **Fix**: 改用每段進場快照的 `originalCost`／`originalCostWithoutFee` 與 `originalShares` 彙總平均成本，確保整併後的買入價格維持原始交易成本。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-11 — Patch LB-PRICE-INSPECTOR-20251111A
- **Issue recap**: 區間價格檢視按鈕搬移到淨值卡片後，打開彈窗時未初始化 `sourceLabel`，在填入價格來源欄位時觸發 `ReferenceError`，導致彈窗仍維持隱藏狀態、使用者看不到表格。
- **Fix**: 於 `openPriceInspectorModal` 重新導入 `resolvePriceInspectorSourceLabel()` 的結果，確保渲染價格來源欄位時具備預設值，避免錯誤中斷。
- **Testing**: `node - <<'NODE' const fs=require('fs');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{new (require('vm').Script)(fs.readFileSync(file,'utf8'),{filename:file});});console.log('scripts compile');NODE`

## 2025-11-10 — Patch LB-TREND-STATE-20251110A
- **Issue recap**: Patch `LB-UI-SUMMARY-FOCUS-20251109A` 將趨勢評估狀態重設為僅保留日期與策略報酬，使 `recomputeTrendAnalysis` 重新整理時喪失 `rawData` 而覆寫基礎資料，導致初次回測後趨勢區間卡片顯示空白。
- **Fix**: 新增 `captureTrendAnalysisSource` 將回測結果所需欄位（日期、策略報酬與原始價格）完整封裝，並在趨勢分析重算時保留既有基礎資料，避免再度覆寫為空值。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-07 — Patch LB-UI-SUMMARY-TREND-20251107A
- **Scope**: 基本設定介面、今日建議訊息與趨勢／敏感度資訊層同步優化。
- **Basic Settings**: 重新配置股票代碼與市場下拉寬度，更新文案為「台灣/美國股票代碼 (目前無提供指數)」，避免窄螢幕時的選單重疊。
- **Today Suggestion**: 資料落後天數改附註於日期後方，取消備註區的重複提醒，並調整續抱文案為「請持續來本站追蹤」。
- **Trend Overlay**: 趨勢底色與圖例僅在趨勢區間評估展開時顯示，新增水平捲動支援與摺疊對稱間距。
- **Sensitivity Analysis**: 將「如何解讀敏感度結果」移入摺疊內容，調整偏移方向說明文字並維持表格預設收合。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-06 — Patch LB-UI-TODAY-TREND-20251106A
- **Scope**: 今日建議資訊層與趨勢圖例互動調整，優化行動訊息展示與小螢幕可讀性。
- **Today Suggestion**:
  - 改為以重點訊息填入原本價格欄位，保留第一則備註作為主體文案並同步寫入開發者紀錄。
  - 調整 UI 控制，部位概況與錯誤時的提示仍預設折疊，載入狀態改顯示文字提醒；開發者紀錄摘要改以 highlight 訊息為主。
- **Charts & Trend**:
  - 趨勢區間評估按鈕將圓形「＋」指示器搬到標題前並新增狀態文字，僅在展開時顯示趨勢圖例且支援橫向捲動並排顯示於窄螢幕。
- **Developer Tools**:
  - 今日建議開發者 log 更新摘要欄位，優先顯示主體訊息並沿用 highlight 值於詳情段落。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-30 — Patch LB-UI-REFRESH-20251030A
- **Scope**: 主頁版面與診斷工具整體調整，強化敏感度與今日建議的可讀性與互動設計。
- **UI**:
  - 策略戰報卡移至淨值曲線圖上方，並更新導引文案提醒使用者回測完成後優先查看戰報。
  - 今日建議改為以備註摘要取代價格文字，新增部位概況摺疊按鈕並預設收合，同時讓今日建議記錄面板改為預設摺疊。
  - 將區間價格檢視按鈕搬移至淨值卡片下方；市場下拉選單移除英文代碼；資料來源資訊改至開發者區塊顯示。
- **Charts & Analytics**:
  - 趨勢區間評估卡改為「＋」圓形按鈕控制的摺疊模式，開啟時同步顯示淨值底色圖例；淨值圖例支援小螢幕並僅在趨勢卡展開時顯示。
  - 敏感度分析在「如何解讀」段落後新增摺疊控制，預設收合所有表格內容。
- **Diagnostics**:
  - Blob 監控新增寫入摘要卡，揭露本月寫入次數與最近寫入事件；資料來源卡支援顯示主來源與命中資訊。
- **Testing**: `node - <<'NODE' ...` 檢查主要腳本語法無誤（同既有回歸命令）。

## 2025-09-12 — Patch LB-TODAY-SUGGESTION-FINALEVAL-RETURN-20250912A
- **Issue recap**: 今日建議持續回傳 `no_data`，追查後發現 `runStrategy` 在建構回傳物件時直接 `return { ... }`，導致 `captureFinalState` 模式下的 `finalEvaluation` 永遠未附加，Worker 因而判定今日缺乏最終評估。
- **Fix**: 將 `runStrategy` 的回傳流程改為建立 `result` 物件後再附加 `finalEvaluation` 與傳回，確保主執行緒能取得最終評估快照並推導當日建議。
- **Diagnostics**: 重新以 2330 與 2412 等案例執行今日建議，檢視開發者紀錄確認 `strategyDiagnostics.finalState.captured` 為 true、`issueCode` 不再落入 `final_evaluation_missing`，notes 顯示正確建議。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-11 — Patch LB-TODAY-SUGGESTION-FINALSTATE-RECOVER-20250911A
- **Issue recap**: 今日建議在 `final_evaluation_missing` 案例仍會落入 `no_data`，即使 `strategyDiagnostics.finalState` 已回傳持有倉位、市值與快照日期，前端仍無法輸出操作建議。
- **Fix**: Worker 於 `getSuggestion` 偵測 `finalState` 快照時自動重建 `finalEvaluation`，補齊多空部位、價格與 fallback meta，並在建議 notes 與開發者紀錄標註快照來源與落後天數；同時新增 issue code `final_evaluation_recovered_from_snapshot`。
- **Diagnostics**: 以 2330、2412 等案例移除最後交易日收盤價，確認今日建議改為顯示「已套用前一有效快照」提示，長短倉摘要與 lag 診斷同步呈現，開發者區域列出重建路徑與 fallback 日期。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-10 — Patch LB-TODAY-SUGGESTION-FINALEVAL-20250910A
- **Issue recap**: 今日建議在資料充足時仍可能回傳 `final_evaluation_missing`，原因為最新交易日缺少有效收盤價導致 `runStrategy` 未建立 `finalEvaluation`，前端雖有快照卻無法給出操作建議。
- **Fix**: `runStrategy` 改為持續追蹤最後一筆有效評估並在最終收盤缺漏時回退，回傳 fallback 原因與 lag 診斷；Worker 將 fallback meta、issue code、開發者備註帶回主執行緒，前端 log 則優先採用實際評估日期並記錄缺價原因。
- **Diagnostics**: 模擬 2330 等案例刻意移除最後一日收盤，確認今日建議仍能顯示前一有效交易日的操作、notes 加註缺價提示，開發者紀錄也標示 fallback 日與落後天數。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`


## 2025-09-09 — Patch LB-TODAY-SUGGESTION-DIAG-20250909A
- **Issue recap**: 即使資料筆數充足，今日建議仍可能回傳 `final_evaluation_missing`，但開發者紀錄僅顯示一般暖身資訊，無法判斷回測最終狀態或是否存在待執行交易。
- **Fix**: `runStrategy` 新增最終狀態快照與隔日交易診斷，Worker 在 `no_data` 時同步回傳並於開發者備註標示模擬部位、市值與待執行交易，前端 log 會彙整為「模擬最終狀態／待執行交易／finalEvaluation 捕捉狀態」等欄位。
- **Diagnostics**: 於 `final_evaluation_missing` 案例確認開發者紀錄摘要包含模擬最終日期、倉位狀態、市值與待執行交易描述，並檢視 payload 內新增的 `strategyDiagnostics.finalState` 內容。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-08 — Patch LB-TODAY-SUGGESTION-DIAG-20250908A
- **Issue recap**: 今日建議顯示 `no_data` 時，卡片與開發者紀錄會重複出現同樣訊息，缺乏 Issue Code 說明與分類，難以快速判讀暖身或資料診斷重點。
- **Fix**: 導入文字去重工具並重構開發者紀錄為「使用者提示／開發者備註／資料診斷」三段式區塊，於摘要加入 Issue Code 解釋；今日建議卡片與 fallback 訊息也同步去重避免重複提醒。
- **Diagnostics**: 於 `no_data` 情境檢視卡片備註僅保留唯一訊息，開發者區域會顯示 Issue Code 與資料區間等整理後的診斷段落；console 確認記錄仍包含 coverage 與 fetchRange 等欄位。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-07 — Patch LB-TODAY-SUGGESTION-DIAG-20250907A
- **Issue recap**: 今日建議返回 `no_data` 時僅提示「回測資料不足」，開發者無法從 UI 看出實際資料區間、覆蓋段數或暖身缺口，難以判斷是哪個環節未產生最終倉位。
- **Fix**: Worker 在建議結果中回傳 dataset/warmup/coverage 診斷、資料筆數、暖身天數與 issue code，並新增開發者專用備註；前端 developer log 會顯示區間範圍、價格模式、資料來源與暖身缺口，協助對照為何無法產出建議。
- **Diagnostics**: 於開發者區域驗證 `no_data` 狀態會列出「資料區間」「總筆數」「暖身後首筆有效收盤」等資訊，並在 console 檢查 meta 內帶有 coverage fingerprint 與 fetch range，確保後續能追蹤快取與資料來源。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-05 — Patch LB-TODAY-SUGGESTION-DEVLOG-20250905A
- **Issue recap**: 今日建議在資料充足時仍可能回傳「無法判斷今日操作」，但開發者區域缺乏對應 log，難以追蹤是哪個步驟產生 fallback 訊息。
- **Fix**: 建立今日建議開發者紀錄面板，集中列出最新狀態、價格、部位摘要與訊息，並在 `showResult`、`showError` 中寫入 log 以保留錯誤脈絡。
- **Diagnostics**: 透過 UI 驗證今日建議在成功、無資料與錯誤狀態下皆會將訊息同步至開發者紀錄區，清除按鈕可重置觀察環境。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-04 — Patch LB-TODAY-SUGGESTION-20250904A
- **Issue recap**: 今日建議卡片仍沿用早期版面，缺乏行動標籤與部位摘要，備註訊息也未集中管理，導致使用者無法一眼辨識最新操作與潛在風險。
- **Fix**: 重構首頁今日建議卡為行動亮點＋多空統計＋備註清單的三段式結構，新增 `todaySuggestionUI` 控制器以統一處理載入、結果與錯誤狀態，並將主執行緒請求帶入 coverage/cachedMeta 供 Worker 直接推導 `runStrategy.finalEvaluation` 的建議內容。
- **Diagnostics**: 於瀏覽器確認卡片在載入、成功與錯誤時皆能切換顯示狀態，備註列表會依實際訊息展開；同時查看 console 確認 getSuggestion 訊息包含 coverage fingerprint 與資料診斷摘要。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-28 — Patch LB-TREND-CARD-20251028A
- **Issue recap**: 趨勢卡仍顯示版本章與「HMM 信心」字樣，使用者無法直接看到平均狀態信心；同時牛/盤整/熊卡片也未標示最新交易日，使得判讀即時 regime 辨識時缺乏焦點。
- **Fix**: 隱藏版本章、將滑桿指標改為「平均狀態信心」，並在四態統計中依最新 regime 以主色藍字附上最後交易日，確保使用者一眼看出最新分類。
- **Diagnostics**: 回測後確認趨勢卡標題無版本章，滑桿右側顯示「平均狀態信心：XX.X%」，且統計卡僅在最新 regime 卡片旁顯示藍色日期；若無結果則顯示破折號。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-23 — Patch LB-TREND-SENSITIVITY-20251023A
- **Issue recap**: 先前僅將滑桿預設值設定為 5，未先掃描 1000 組靈敏度組合確認平均狀態信心峰值，導致預設門檻可能偏離最佳判定且高檔覆蓋行為不穩定。
- **Fix**: 導入 0→10 滑桿 1000 組步進掃描，逐一計算四態 HMM 平均狀態信心並取最高參數，透過分段映射讓該參數對應滑桿值 5；同時更新門檻映射函式與卡片說明，揭露校準滑桿值、等效敏感度與信心峰值。
- **Diagnostics**: 回測後檢視趨勢卡版本章 `LB-TREND-SENSITIVITY-20251023A`，滑桿說明需顯示「滑桿 5→校準 X.X ｜ 峰值信心」與校準峰值摘要；拖曳滑桿確認覆蓋率隨數值遞減且滑桿 5 的門檻對應平均信心最高參數。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-20 — Patch LB-TREND-SENSITIVITY-20251020A
- **Issue recap**: 靈敏度滑桿擴充至 1→1000 後，覆蓋率補償邏輯雖可維持 80% 以上，但使用者難以掌握對應的門檻意義，且最大值仍可能殘留盤整倒掛。
- **Fix**: 重新定義滑桿為 0→10、步進 0.1，對應 1000 組離線覆蓋率測試的等效敏感度並將最佳信心值 5 設為預設；後端以 0→10 轉換為 1→1000 的有效敏感度再套用 Sigmoid 門檻，確保數值越高盤整覆蓋遞減且高敏度時仍保有 80% 以上趨勢判斷。
- **Diagnostics**: 檢查趨勢卡顯示版本章 `LB-TREND-SENSITIVITY-20251020A`、滑桿刻度 0→10 與預設值 5；拖曳滑桿觀察門檻文案顯示等效敏感度與覆蓋目標會同步刷新，趨勢底色在數值 10 時維持趨勢覆蓋 ≥80%。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-01 — Patch LB-TREND-SENSITIVITY-20251001A
## 2025-10-02 — Patch LB-TREND-SENSITIVITY-20251002A
- **Issue recap**: 高靈敏度端擴大為 1→1000 後，滑桿拉到 1000 會把門檻推得過於嚴苛，趨勢底色幾乎消失，實際覆蓋遠低於預期的 80%。
- **Fix**: 保留反向等效級距映射，但建立高靈敏度覆蓋回退機制，當覆蓋率低於 80% 時依序內插嚴格／寬鬆門檻至溫和區間，並把覆蓋比例與補償狀態揭露於卡片說明。
- **Diagnostics**: 拖曳滑桿至 1000 檢查趨勢卡顯示「已自動放寬門檻」提示、覆蓋率維持 80% 以上，趨勢底色與統計卡同步刷新且不再消失。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

- **Issue recap**: 趨勢區間評估卡片的靈敏度滑桿上限僅 100，且高靈敏度門檻仍標示為 100，使使用者難以分辨新的縮放基準；同時起漲與跌落色塊需要與 UI 主色系同步。
- **Fix**: 將滑桿重新對齊為 1→1000，讓新下限 1 對應舊版 100 並維持既有倍率縮放，更新門檻說明與預設值；同步交換起漲／跌落色票並調整圖例，確保紅色代表起漲、綠色代表跌落。
- **Diagnostics**: 檢查趨勢卡片顯示「滑桿 1→1000 ≈ 舊版 100→70」與倍率差距提示，滑桿拖曳時門檻、倍率與版本章節同步刷新，圖例顯示紅色為起漲、綠色為跌落。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-20 — Patch LB-STRATEGY-STATUS-20250920A
- **Issue recap**: 策略狀態卡雖已改為推文語氣，但最新需求希望改成電玩宅式的戰報敘事，既有文案缺乏遊戲化比喻與補師/技能等語境。
- **Fix**: 將版本更新為 `LB-STRATEGY-STATUS-20250920A`，重寫戰況卡各狀態標語、戰況比較句、體檢結論與敏感度建議，採用副本、Buff、滅團等電玩宅用語呈現策略優劣勢。
- **Diagnostics**: 以模擬資料檢查領先、平手、落後、資料缺席與錯誤情境，確認卡片顯示新徽章與條列，落後時強調句會提示開技能補血，敏感度與體檢文案全面換成電玩宅語調。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-15 — Patch LB-STRATEGY-STATUS-20250915A
- **Issue recap**: 策略狀態卡文案仍偏向一般說明口吻，與最新要求的 PTT 爆文語氣不符；落後時的強調句與敏感度建議也缺乏推文式調侃提醒。
- **Fix**: 將狀態卡版本更新為 `LB-STRATEGY-STATUS-20250915A`，重寫預設、載入、領先、平手、落後等狀態標語與子標題為 PTT 口吻，並改寫戰況條列、體檢結論與敏感度建議的文案讓散戶能用爆文語氣快速吸收重點。
- **Diagnostics**: 以模擬資料檢查落後、平手與領先情境，確認卡片顯示新的推文式標語、落後強調句與條列內容都採用 PTT 風格；敏感度資訊在各門檻下會輸出對應的新用語。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-10 — Patch LB-STRATEGY-STATUS-20250910A
- **Issue recap**: 策略狀態卡落後時缺乏敏感度分數的提醒，無法向使用者交代參數穩定度；差距欄位仍以破折號佔位，與最新不顯示要求不符，落後狀態也未加粗標語引導注意力。
- **Fix**: 新增 `buildSensitivityScoreAdvice` 將穩定度分數、平均漂移與方向偏移轉為戰況條列建議，更新狀態套用器隱藏差距欄破折號並於落後時插入「快呼叫策略優化…」強調句，版本碼調整為 `LB-STRATEGY-STATUS-20250910A`。
- **Diagnostics**: 以模擬結果檢查策略領先、平手、落後情境，確認戰況條列會出現敏感度判讀句並依門檻切換建議；落後時展開摺疊後可看到加粗激勵句與完整條列，差距欄位保持隱藏。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-07 — Patch LB-STRATEGY-STATUS-20250907A
- **Issue recap**: 策略狀態卡落後情境仍會顯示「快呼叫策略優化與風險管理小隊調整參數，下一波逆轉勝。」的大字標語，與最新需求不符；差距徽章同時以 "-14.67pp" 顯示百分點，造成視覺干擾。
- **Fix**: 移除落後狀態的強調標語，調整狀態套用器僅保留條列重點；差距徽章固定顯示破折號，避免輸出百分點文案。
- **Diagnostics**: 回測後逐一檢查策略領先、平手、落後等情境，確認卡片只呈現條列戰況與體檢句，不再出現放大標語，差距徽章持續顯示破折號。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-07-10 — Patch LB-STRATEGY-STATUS-20250710B
- **Issue recap**: 策略狀態卡的版本徽章佔據視覺重心且戰況條列一字排開，與回測摘要、趨勢評估卡緊貼排列，使用者難以掃描，也無法在落後時快速收合細節。
- **Fix**: 移除版本號展示並以 `data-lb-strategy-status-version` 註記版本，將趨勢評估卡搬到策略狀態卡上方並為摘要區塊加入 `space-y-6` 間距；戰況條列改為 `<details>` 摺疊呈現，落後時保留放大激勵句，改寫逆風副標維持幽默語氣。
- **Diagnostics**: 手動確認摘要頁卡片上下間距一致、趨勢卡順序調整成功，策略狀態卡落後時顯示加粗激勵句且條列需點擊展開；預設/載入階段仍以段落提示，無摺疊節點。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-12 — Patch LB-ROLLING-TEST-20250912A
- **Issue recap**: 已完成主回測仍被提示「請先執行一次主回測以產生快取資料」，導致滾動測試無法啟動並阻礙 Walk-Forward 分析。
- **Fix**: Walk-Forward 模組改為使用最近一次回測的快取條目自動回灌 `cachedStockData`，並允許以 coverage 範圍推算資料可用區間，避免已完成主回測仍被判定為缺少快取。
- **Diagnostics**: 滾動測試計畫表與啟動檢查會同步顯示最後一次回測資料的範圍，若 Map 快取異常會輸出警告並維持提示訊息，利於排查快取鍵或瀏覽器儲存行為。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/batch-optimization.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-10 — Patch LB-ROLLING-TEST-20250910A
- **Issue recap**: 用戶需要和國際量化平台一致的 Walk-Forward 滾動測試視圖，快速評估策略在多個市況中的穩健度與合格標準。
- **Fix**: 在批量優化旁新增「滾動測試」分頁，提供視窗配置、進度監控、Walk-Forward 評分與逐窗指標報告；採用常見 Sharpe、Sortino、年化報酬、最大回撤與勝率門檻，並計算合格率與整體評分。
- **Diagnostics**: 測試計畫表即時反映可用資料範圍、視窗數量與交易日；報告列出每個視窗的年度績效與缺失原因，便於判讀是否達到國際 Walk-Forward 合格標準。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/batch-optimization.js','js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-09-03 — Patch LB-TREND-REGRESSION-20250903A
- **Issue recap**: 先前趨勢偵測僅透過斜率與波動度比值判定，對盤整或不穩定區段常出現誤判，滑桿雖能調整倍率但無法穩定反映趨勢強度。
- **Fix**: 導入 20 日對數淨值線性回歸，加入 R²、斜率÷殘差與斜率÷波動度等訊噪指標，並依滑桿重新插值嚴格與寬鬆門檻，提升起漲／跌落判定準確度。
- **Diagnostics**: 檢查趨勢卡公式說明是否顯示線性回歸條件、R² 與雙訊噪閾值，拖曳滑桿確認斜率門檻與訊噪數值會隨靈敏度同步刷新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-08-23 — Patch LB-TREND-SENSITIVITY-20250823A
- **Issue recap**: 靈敏度滑桿雖有 1-100 級距，但前 69 段對應的倍率過於鈍化，拉到最大時仍只有 0.02 倍上下，盤整區塊依舊大幅蓋住圖表。
- **Fix**: 將滑桿 1 段改為對應舊版靈敏度 70，並把倍率下限壓縮到 0.0063，使 1→100 對應約 0.31→0.006 倍（約 50 倍差）；同步更新門檻計算函式回傳舊版等效級距、倍率範圍與解說文字。
- **Diagnostics**: 確認趨勢卡說明顯示「滑桿 1→100 ≈ 舊版 70→100」與新的倍率差距，拖曳滑桿時可看到目前等效級距與倍率即時刷新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-08-17 — Patch LB-TREND-SENSITIVITY-20250817A
- **Issue recap**: 靈敏度滑桿雖已擴充為 1-100 級距，但倍率縮放僅有 1.00→0.20，將滑桿推至 100 時仍難以明顯放大起漲／跌落分區。
- **Fix**: 維持 1-100 級距但將倍率範圍拓展至 1.00→0.02（上下限差 50 倍），同步更新趨勢卡說明與倍率比值提示，確保高靈敏度時盤整區段明顯收斂。
- **Diagnostics**: 手動檢視趨勢卡門檻說明顯示 50 倍差距、滑桿拖曳後倍率讀值同步刷新，並確認 Chart.js 底色插件會依新閾值重新著色。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-07-26 — Patch LB-TREND-SENSITIVITY-20250726A
- **Issue recap**: 使用者反映趨勢靈敏度滑桿僅有 0-10 級距，調整後仍難以顯示底色分段，盤整區塊覆蓋過大。
- **Fix**: 將滑桿範圍放大至 1-100，改以線性內插 1.00→0.20 的門檻倍率縮放，更新趨勢版本代碼與公式說明，確保高靈敏度時起漲／跌落段能明顯放大。
- **Diagnostics**: 手動調整滑桿確認數值顯示同步更新、趨勢卡描述出現新倍率區間，並檢查 Chart.js 插件背景確實依新閾值重新著色。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`；待 Netlify 預覽站實際回測驗證 console 無錯誤。

## 2025-07-25 — Patch LB-SUMMARY-COMPACT-20250725A
- **Issue recap**: 淨值曲線缺乏趨勢分區與滑桿調節，使用者無法快速判讀起漲／盤整／跌落區段的績效差異，回測摘要也沒有提供分區報酬率。
- **Fix**: 新增版本代碼 `LB-TREND-SEGMENT-20250714A`，在圖表套用 20 日淨值斜率／波動度判別並以底色標示各趨勢，摘要頁插入「趨勢區間評估」卡片與靈敏度滑桿，可即時重新計算起漲、盤整、跌落區段的複利報酬與覆蓋比例。
- **Diagnostics**: 透過 DOM 檢視確認卡片顯示門檻公式、滑桿更新後重新渲染統計，Chart.js 插件背景亦會隨趨勢分段同步刷新；滑桿調至最大時盤整區縮小、起漲/跌落段落增加。
- **Testing**: 受限於容器無法啟動實際回測代理，已以 `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/backtest.js','utf8'));console.log('backtest.js compiles');NODE` 驗證腳本語法，後續將於 Netlify 預覽站執行回測確認 console 無錯誤。

## 2025-07-26 — Patch LB-TODAY-ACTION-20250726A
- **Issue recap**: 今日建議卡片尚未對準最新交易日，Worker 仍沿用舊版 `runSuggestionSimulation` 並在回測結束日強制平倉，導致實際持倉狀態與操作訊號容易脫鉤。
- **Fix**: 移除舊版模擬函式，改以 `runStrategy` 的 `finalEvaluation` 對今日資料延伸評估，產出多空持倉、最新價格與具體行動；同時補齊主執行緒快取 coverage 後灌入 Worker，確保建議計算命中現有資料並沿用最新 meta。
- **Diagnostics**: 今日建議回傳載明延伸至今日的資料日期、倉位摘要與 lag 天數，若策略起始日尚未到達亦會顯示提示訊息；Worker 快取保留 coverage fingerprint，後續重播時可比對資料區間。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach(p=>new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}));console.log('scripts compile');NODE`

## 2025-07-03 — Patch LB-STRATEGY-STATUS-20250703A
- **Issue recap**: 策略狀態速報仍隸屬建議分頁，無法在摘要頁即時查看戰況，也缺乏與買入持有差距與指標體檢的條列敘述，散戶難以秒讀策略健康度。
- **Fix**: 將卡片移至摘要頁淨值曲線下、回測摘要上方，新增幽默語氣的領先/落後徽章與差距顯示，並以 `buildStrategyHealthSummary`、`splitSummaryIntoBulletLines` 拆解年化報酬、夏普、索提諾、最大回撤、前後段穩定比的雙級診斷，落後時先輸出加粗激勵語再逐條列出注意事項。
- **Diagnostics**: 手動檢查預設版本碼 `LB-STRATEGY-STATUS-20250703A`、回測啟動時的「戰況計算中」提示、失敗時的 `戰況暫停` 標章，以及策略領先/落後/平手時差距與指標巡檢是否依門檻切換口吻與條列格式。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-07-25 — Patch LB-SUMMARY-COMPACT-20250725A
## 2025-07-15 — Patch LB-SENSITIVITY-GRID-20250715A / LB-SENSITIVITY-UX-20250715B
- **Issue recap**: ±10% 單點敏感度無法覆蓋均線等整數參數的小幅調整，前端表格也僅能呈現兩個情境，無法顯示多點擾動與方向性資訊。
- **Fix**: Worker 改為依策略參數型別生成 ±5%、±10%、±20% 與整數步階擾動，回傳多點平均漂移、最大偏移、方向偏移與樣本數；前端敏感度卡片改為動態網格與條列式指標，新增方向偏移卡、樣本統計與迷你圖例，手機版改為卡片堆疊呈現。
- **Diagnostics**: 透過靜態輸出確認 `parameterSensitivity.summary` 帶有 `scenarioCount/maxDriftPercent/positiveDriftPercent/negativeDriftPercent`，前端卡片與 tooltip 改為敘述擾動網格與多點漂移；桌機與手機版皆不再出現固定 ±10% 欄位。
- **Testing**: 受限於容器無法啟動實際回測代理，僅以 `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/backtest.js'].forEach(p=>new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}));console.log('scripts compile');NODE` 確認語法正確，後續部署至 Netlify 預覽站再以真實策略驗證 console 與 UI 行為。


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

# 2025-08-02 — Patch LB-BLOB-CURRENT-20250802B
- **Issue recap**: Blob 範圍快取雖能偵測當月落後，但直接改走逐月 Proxy 補抓導致整個暖身排程被打斷，當日僅缺少 1~2 筆資料時仍需重跑全月。
- **Fix**: `tryFetchRangeFromBlob` 在標記 `current-month-gap` 後改以 `fetchCurrentMonthGapPatch` 僅補抓缺漏日期，透過 proxy 月分 API 逐段合併資料並重新計算覆蓋狀態，同步記錄補抓診斷資訊。
- **Diagnostics**: Blob 診斷新增 `patch` 區塊揭露嘗試月份、來源與筆數，回填後會更新 `lastDate`、`currentMonthGapDays` 與覆蓋落差；若補抓仍失敗則維持 `current-month-stale` 供前端顯示警示。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');new vm.Script(fs.readFileSync('js/worker.js','utf8'),{filename:'worker.js'});console.log('worker.js compiles');NODE`

# 2025-07-30 — Patch LB-BLOB-CURRENT-20250730A
- **Issue recap**: Netlify Blob 範圍快取若在月中寫入，隔日回測仍沿用舊快取，導致使用者以當日結束日期回測時僅看到前一交易日的最後一筆資料。
- **Fix**: `tryFetchRangeFromBlob` 新增「當月資料新鮮度」檢查，當回測結束日在當月且 Blob 回應的最後日期落後於應到日期時，標記為 `current-month-gap` 並退回逐月 Proxy 補抓，確保快取不會卡在寫入日。
- **Diagnostics**: Blob 診斷新增 `firstDate`、`lastDate`、`targetLatestDate` 與 `currentMonthGapDays` 欄位，可於資料暖身診斷卡確認是否觸發當月回補並追蹤差距天數。
- **Testing**: 受限於容器無法啟動瀏覽器，僅完成程式碼檢閱與資料流程推演；後續需在本機以 2330、2412 等標的實測今日結束日回測，確認 Blob 命中時會在當月落後即回退 Proxy 且 console 無錯誤。

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
# 2025-07-24 — Patch LB-SENSITIVITY-RENDER-20250724A
- **Issue recap**: 導入多點敏感度後僅在 Worker 與資料層回傳資訊，但回測摘要最終排版仍未插入敏感度卡片，造成使用者無法在結果頁看到新的穩定度與漂移指標。
- **Fix**: 於 `displayBacktestResult` 的摘要版面中加入敏感度卡片段落，無論資料完整或缺漏都會顯示對應卡片，確保穩定度分數、平均漂移與各參數網格能與績效、風險指標並列呈現。
- **Diagnostics**: 靜態檢視渲染函式確認敏感度段落掛載在績效、風險指標之後，回傳空集合時仍會顯示「暫無結果」卡片，避免再度被版面忽略。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/worker.js'].forEach(p=>new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}));console.log('scripts compile');NODE`

# 2025-07-29 — Patch LB-SENSITIVITY-METRIC-20250729A / LB-SENSITIVITY-UX-20250729B
- **Issue recap**: 使用者反映敏感度卡僅顯示 ±10% 場景且未說明方向指標門檻，穩定度分數未考量 Sharpe Δ，摘要卡文案也與下方動態網格脫節。
- **Fix**: Worker 引入 `LB-SENSITIVITY-METRIC-20250729A`，彙整多點擾動的平均漂移、Sharpe 下滑並以「100 − 漂移 − Sharpe 懲罰」計算穩定度分數；前端更新敏感度摘要卡為動態解說句、補上方向偏移判讀與穩定度 tooltip 說明，並在提示卡補充 ±10pp／15pp 判準。
- **Diagnostics**: 透過 `console.log(result.parameterSensitivity.summary)` 確認回傳 `averageSharpeDrop`、`stabilityComponents`（含扣分明細）與方向偏移，前端則檢視 tooltip 與摘要句確實引用新數據，方向提示會依偏移絕對值改變建議文案。
- **Testing**: 受限於容器無法連線 Proxy，以 `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/backtest.js'].forEach(p=>new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}));console.log('scripts compile');NODE` 驗證語法，部署至 Netlify 預覽後再以實際策略回測檢查 console。 

## 2025-10-05 — Patch LB-TREND-SENSITIVITY-20251005A
- **Issue recap**: 新增 1→1000 靈敏度後，高檔滑桿仍以嚴格門檻回傳盤整為主，1000 時盤整覆蓋反而超過 40%，未能達成「靈敏度越高趨勢段越多」的預期行為。
- **Fix**: 重新採用線性回歸 t 統計與訊噪比作為核心門檻，將滑桿映射到 45%→85% 的趨勢覆蓋目標並動態放寬斜率、R² 與訊噪閾值，確保 1000 時盤整覆蓋低於 20%。
- **Diagnostics**: 於本地輸入測試回測結果檢查門檻說明、覆蓋提示與倍率區間，拖曳滑桿確認趨勢覆蓋目標會隨數值遞減盤整比例，高段顯示「依滑桿目標調整門檻」提示。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-07 — Patch LB-TREND-SENSITIVITY-20251007A
- **Issue recap**: 依滑桿目標調整後，仍有案例在靈敏度 1000 僅判出 0.4% 趨勢段，盤整覆蓋明顯超標，未達「高靈敏度至少 80% 判定」的目標。
- **Fix**: 重新校準 20 日斜率、t 統計與雙訊噪比門檻，下修高靈敏度端的基準值並導入階段性補償與最後防線，確保不足時自動放寬至極低門檻，使趨勢覆蓋與滑桿目標同步提升。
- **Diagnostics**: 驗證門檻說明新增「自動展開補償」描述，並以多組回測結果觀察覆蓋提示訊息改為「系統已依滑桿目標調整門檻」，確認 1000 時趨勢段佔比維持在 80% 以上。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-11 — Patch LB-TREND-SENSITIVITY-20251011A
- **Issue recap**: 1→1000 靈敏度滑桿在高端仍可能出現盤整覆蓋倒掛，且最大值會讓趨勢段完全消失，未能實現「調整數值=覆蓋目標」的期待。
- **Fix**: 將趨勢滑桿改為 0%→100%，直接對應趨勢覆蓋目標，並重寫補償流程，在高覆蓋目標下逐層放寬門檻、必要時降至零門檻以確保至少 80% 以上區段被標示為趨勢。
- **Diagnostics**: 檢查趨勢卡文案與門檻說明新增「覆蓋目標」提示，實際拉動滑桿觀察數值顯示百分比、覆蓋提示同步更新，並驗證 100% 設定會觸發最高階補償讓趨勢段仍保持。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-12 — Patch LB-REGIME-HMM-20251012A
- **Issue recap**: 趨勢卡仍僅提供三態（起漲／盤整／跌落）與覆蓋率映射，無法反映多空與波動組合的四象限結果，也缺少 ADX/布林/ATR 門檻模板與 HMM 分段落地程式。
- **Fix**: 於前端重寫趨勢分析流程，導入 ADX、布林帶寬、ATR 比率與二維 HMM 建立牛高／牛低／熊高／熊低四態分類，滑桿改為 0→100 精細度並影響門檻、平滑與最小區段長度；同步更新 UI 文案、圖例與版本章。
- **Diagnostics**: `renderTrendSummary` 顯示各門檻數值、平滑窗與最小區段資訊，圖表疊層使用對應色塊；趨勢摘要呈現四態覆蓋率、區段數與複利報酬並揭露 HMM 迭代與平均信心。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-13 — Patch LB-REGIME-RANGEBOUND-20251013A
- **Issue recap**: 牛／熊低波動狀態分別呈現，導致盤整覆蓋在滑桿高端反而上升，圖例亦未統一色塊，且 HMM 僅迭代 40 次在部分樣本上收斂不足。
- **Fix**: 將牛／熊低波動整併為「盤整區域」灰色象限，趨勢圖與摘要卡同步改為三態呈現並調整文案、圖例與版本章；同時把 HMM 迭代上限提升至 100 次確保盤整覆蓋會隨滑桿放大而下降且 1000 時趨勢判定覆蓋 80% 以上。
- **Diagnostics**: 檢視 `renderTrendSummary` 確認僅輸出牛高／盤整／熊高三態統計，平均信心仍可分別從牛／熊低波動 posterior 取最大值；圖表灰階背景與 legend 色塊對齊新分類。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-15 — Patch LB-TREND-SIGMOID-20251015A
- **Issue recap**: 靈敏度 1→1000 的滑桿仍採線性門檻，導致覆蓋率在高靈敏度端反覆倒掛，甚至出現趨勢段不到 1% 的情形，無法落實「數值越高盤整越少」的邏輯。
- **Fix**: 導入對數 Sigmoid 門檻函式，將滑桿映射到 38%→86% 的趨勢覆蓋目標，並加入基於 ADX／布林帶寬／ATR 與 HMM posterior 的盤整補償流程，動態將高分盤整日提升為趨勢段，確保 1000 時趨勢覆蓋維持 80% 以上。
- **Diagnostics**: 趨勢卡片顯示目標與實際趨勢覆蓋、Sigmoid 補償日數與是否達標；門檻說明同步揭露對數映射後的 ADX／布林／ATR 判準與平滑視窗，滑桿拖曳時覆蓋指標與補償統計會隨即更新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-18 — Patch LB-REGIME-FEATURES-20250718A
- **Issue recap**: 現行四態 HMM 僅採用日對數報酬與 ATR 比率兩項特徵，對成交量動能與報酬分布偏態的掌握不足，滑桿在高靈敏度端偶爾出現盤整覆蓋倒掛，未完全呼應多維特徵可提升 regime 判別精準度的研究建議。
- **Fix**: 新增 20 日對數報酬偏態與成交量 Z-score 作為 HMM 觀測向量，並在送入模型前以 z-score 正規化每個維度，讓 regime 偵測同時考量波動、動能與量能結構，維持滑桿覆蓋率單調遞減。
- **Diagnostics**: 回測摘要檢視 `result.regimeBase.hmm.normalization` 確認均值與標準差紀錄，並比對高靈敏度設定時趨勢段覆蓋仍可達 80% 以上且盤整覆蓋低於 20%；同時驗證 HMM 迭代收斂與平均信心未因特徵擴充而惡化。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-10-24 — Patch LB-TREND-SENSITIVITY-20251024A
- **Issue recap**: 滑桿預設值維持在 5 時仍以固定 5%～95% 線性範圍對映，當 HMM 校準峰值落在極端位置時無法映射回預設點，導致最高平均信心參數與預設值脫鉤。
- **Fix**: 依校準步數動態計算最小安全邊界（0.1% 起跳），取代原先固定區間並在校準資訊中保留邊界值，確保滑桿 5 會回推到峰值參數，同時避免 targetNormalized 達到 0 或 1 時的階梯化行為。
- **Diagnostics**: 於本地透過 `mapSliderToEffectiveSensitivity` 比對校準前後的等效靈敏度，確認 anchor=5 時的 `effectiveSensitivity` 與 `bestSlider` 等值，並檢視 `trendSensitivityValue` 描述同步揭露峰值滑桿、信心與校準邊界。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-08 — Patch LB-UI-STRATEGY-TREND-20251108A
- **Issue recap**: 策略戰況逆風狀態的激勵句與風控提醒分離呈現，字重落差造成閱讀中斷；趨勢卡滑桿標籤與門檻說明未符合最新 UX 要求；敏感度摘要在行動裝置仍為單欄排列且 tooltip 與標題分離，易造成資訊負擔。
- **Fix**: 將逆風提醒併入副標維持同一字型層級；滑桿標籤改為「0 精細／10 寬鬆」並隱藏門檻解說段落；敏感度卡預設雙欄起跳並調整穩定度分數 tooltip 與標題並排，維持小螢幕可掃描性。
- **Diagnostics**: 本地檢視摘要頁確認戰況卡副標連貫呈現無額外段落；趨勢區間折疊後不再顯示詳細門檻字串；縮小視窗觀察敏感度四卡維持兩欄排列且 tooltip 位置緊貼標題。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-09 — Patch LB-UI-SUMMARY-FOCUS-20251109A
- **Issue recap**: 回測重跑同參數時趨勢區間卡出現空白統計、摘要仍預設捲至淨值圖；敏感度摘要文案過度數字化且重複提示佔版；價格檢視工具在主畫面露出多餘資料來源字串。
- **Fix**: 重新初始化趨勢底層資料並在回測完成後自動聚焦戰況卡，同步重置滑桿；調整敏感度摘要為置中佈局、將 ±10pp 文案移入 tooltip 並改以語句式提醒；移除查看區間價格的來源尾註。
- **Diagnostics**: 多次以相同標的重跑確認趨勢信心與底色維持輸出；檢視敏感度卡僅顯示一句摘要且 tooltip 提供補充；查看區間價格文字僅留筆數與模式資訊。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-10 — Patch LB-TREND-CALIBRATION-20251110A
- **Issue recap**: 相同參數重跑回測時，趨勢區間滑桿的預設值 5 可能不再對應首次回測找到的最高平均狀態信心，重開回測後需要手動調整滑桿才能回到最佳點。
- **Fix**: 保留上一輪趨勢原始資料快照並在缺少 `rawData` 時回填，`prepareRegimeBaseData` 支援使用快照與既有基礎資料，確保重新回測仍能以同一組 HMM 輸入校準；滑桿預設值因此穩定映射到最佳平均信心。
- **Diagnostics**: 多次以相同標的重跑確認 `trendAnalysisState.calibration.bestSlider` 與預設值維持一致，且 `captureTrendAnalysisSource` 在缺資料時會沿用同日期序列的上一版快照。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-15 — Patch LB-SINGLE-OPT-20251115A
- **Issue recap**: 單一參數優化沿用逐值 `JSON.stringify` 複製與完整敏感度分析，導致每一步都重新建立深層物件並重算敏感度網格，範圍稍大時執行時間暴增。
- **Fix**: 建立參數範圍掃描器與可重用的優化模板，只在每輪生成淺層複本並標記 `skipSensitivity`，同時以 `suppressProgress` 避免額外的 Worker 訊息；新增版本旗標 `LB-SINGLE-OPT-20251115A` 以利追蹤。
- **Diagnostics**: 於開發者工具觀察單一參數優化時 Worker 僅輸出範圍測試紀錄，且無再觸發敏感度計算；確認結果表格仍維持年化報酬、夏普值、下普值與回撤等欄位排序一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/worker.js','js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-12 — Patch LB-QUICK-KEYIN-20251112A
- **Issue recap**: 首頁「一鍵回測台積電」按鈕文字固定且無輸入提示，使用者難以察覺可替換標的；就算輸入其他名稱也無法同步至代碼欄，回測仍鎖在 2330。
- **Fix**: 在按鈕內嵌可編輯欄位與閃爍光標，支援即時輸入並透過台股官方清單比對關鍵字，自動更新股票代碼與市場設定；回測進度改以狀態區塊呈現避免破壞可編輯元件，同步新增提示文案。
- **Diagnostics**: 驗證 `resolveKeywordToStock` 能對照台股清單並回傳市場資訊，`updateHintDisplay` 會顯示最終代碼與名稱；測試清空、中文名稱、台/美股代碼皆能更新 `#stockNo` 並觸發名稱查詢。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-13 — Patch LB-QUICK-KEYIN-20251113A
- **Issue recap**: 一鍵回測按鈕內的可編輯區域仍偏窄，行動裝置上難以察覺可點擊範圍，亦容易誤觸其他按鈕。
- **Fix**: 擴大可編輯區最小寬度與高度、補強內距與間距並加入聚焦陰影，確保輸入區塊在桌機與手機皆有明確點擊範圍，同時調整預設標籤間距。
- **Diagnostics**: 本地檢視首頁 Hero 區塊確認輸入欄位維持底線樣式但寬度顯著放大，聚焦時顯示色塊與陰影提示，光標與提示文案位置穩定。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-14 — Patch LB-QUICK-KEYIN-20251114A
- **Issue recap**: 快捷回測輸入欄的閃爍指示仍位於底線之外，使用者無法直覺理解「台積電」三字可自訂，亦與底線分離造成視覺跳動。
- **Fix**: 改以可編輯欄位的偽元素呈現插入符號，讓光標緊貼關鍵字結尾並隨聚焦狀態自動隱藏，維持底線整體性且避免額外節點。
- **Diagnostics**: 在桌機與行動版檢視英雄區，確認未聚焦時插入符號緊貼最後一字且共享底線，聚焦後交還原生輸入游標、失焦時恢復動畫。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-15 — Patch LB-QUICK-KEYIN-20251115A
- **Issue recap**: 快捷回測預設範例「台積電」與使用者輸入在底線區塊內偏向左側，未能直觀呈現可編輯範圍的中心位置。
- **Fix**: 將可編輯區設定為置中對齊並同步調整空狀態的提示對齊方式，確保範例字與使用者輸入皆落在底線中央。
- **Diagnostics**: 在桌機與行動尺寸檢視英雄區，確認輸入框於不同字數與清空狀態下都維持置中排版且光標與底線對齊。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/backtest.js','js/main.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-16 — Patch LB-PROGRESS-PIPELINE-20251116A
- **Issue recap**: 回測進度條會自動衝到 100% 但後端流程仍在跑，且遇到 Netlify Blob 首次未命中時進度訊息卡在「檢查 Netlify Blob 範圍快取...」。
- **Fix**: 以階段化動畫取代舊自動補數邏輯，進度僅依實際回報推進並同步於狀態文字顯示百分比；同時在 Blob 快取落空後立即發布轉換訊息，縮短停留時間。
- **Diagnostics**: 本地多次啟動回測觀察進度列不再提前到頂，Blob 首次 miss 亦會立刻切換為「改用 Proxy 逐月補抓...」等下一步提示。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-16 — Patch LB-PROGRESS-PIPELINE-20251116B
- **Issue recap**: Blob 範圍快取檢查遇到慢速回應時仍停留在「檢查快取」訊息，未能及時落回逐月補抓；進度條沙漏符號也與全新敘事不符。
- **Fix**: Worker 端對 Netlify Blob 範圍檢索加入 2.5 秒逾時並紀錄狀態，逾時即回傳讓主流程顯示「回應逾時」訊息並提前切換；同時將進度卡沙漏改為指定 Chiikawa GIF，維持品牌調性。
- **Diagnostics**: 人為調降 Blob 回應速度確認 2.5 秒即逾時並切換訊息，`fetchDiagnostics.rangeFetch.status` 會標記為 `timeout`；前端載入時檢視執行卡顯示 GIF 並隨進度文字更新百分比。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-19 — Patch LB-PROGRESS-VISUAL-20251119A
- **Issue recap**: 執行中卡片的 Chiikawa GIF 在圓形容器邊緣出現灰色條紋，與吉祥物風格不符且破壞進度敘事的一致性。
- **Fix**: 建立專用的 `loading-mascot-wrapper` 造型，使用柔和粉色邊框與白色背景包覆 GIF，並強制 Tenor 嵌入內容填滿圓形避免再露出灰邊。
- **Diagnostics**: 本地載入回測進度卡確認 GIF 圓形邊緣維持粉白配色、無灰階漏出，且 Tenor iframe 仍能自動播放並隨進度文字更新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-19 — Patch LB-PROGRESS-MASCOT-20251119B
- **Issue recap**: 進度卡仍使用粉色圓框與舊版 Chiikawa GIF，與最新 UI 指引要求的方形、無邊框 Hachiware 造型不符。
- **Fix**: 移除進度吉祥物容器的粉色邊線與陰影，改為方形透明背景，同步將 Tenor 嵌入更新為 Hachiware GIF。
- **Diagnostics**: 本地檢視執行卡確認 GIF 方形填滿容器、周圍不再出現粉色外框，進度敘事文字與百分比持續正確更新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-20 — Patch LB-PROGRESS-VISUAL-20251120A
- **Issue recap**: 進度吉祥物的 Tenor 嵌入在載入時仍可能覆蓋灰底，且點擊後會跳出 Facebook 等分享連結，破壞透明背景與專注式體驗。
- **Fix**: 於樣式層全面移除 Tenor 內層背景並禁用指標事件，同步導入 MutationObserver 清理嵌入產生的連結與 iframe，使背景維持透明且無法被點擊。
- **Diagnostics**: 本地重載回測進度卡確認吉祥物保持透明邊緣、無分享彈層，並檢視 console 確認 `data-lb-mascot-sanitiser` 標記套用版本碼。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-25 — Patch LB-PROGRESS-VISUAL-20251125A
- **Issue recap**: `initLoadingMascotSanitiser` 與 MutationObserver 同步調整時未斷開監聽，Tenor 內嵌節點在清理過程反覆觸發屬性變更，導致主執行緒陷入無窮回圈、頁面載入即卡住。
- **Fix**: 於 Sanitiser 中記錄新版本碼並在每次偵測到變動時先行 `disconnect`，完成清理後透過 `queueMicrotask`（退回 `setTimeout`）再重新註冊 MutationObserver，避免自我觸發的屬性回呼；同步限制監控屬性清單並保留透明化、禁用點擊的處理。
- **Diagnostics**: 本地重載首頁確認 DOMContentLoaded 後進度卡正常顯示、控制台無卡住記錄，反覆觸發 Tenor 重新注入（透過重新開啟進度卡）亦僅執行單次清理且不再堆疊監聽。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-26 — Patch LB-PROGRESS-MASCOT-20251126A
- **Issue recap**: 即便採用 MutationObserver 清理 Tenor 內嵌，吉祥物仍殘留灰色邊框與背景，且分享連結 iframe 造成透明度難以維持。
- **Fix**: 改以 Tenor v2 API 動態抓取指定貼圖的 GIF URL，直接以 `<img>` 呈現並停用外部嵌入腳本，確保透明像素不再被灰底覆蓋，同時加上本地 fallback 指示避免 API 失敗時影響進度敘事。
- **Diagnostics**: 於本地重新載入執行卡確認容器僅包含 `<img>` 並維持透明背景，網路攔截測試時會顯示 `⌛` fallback 並記錄在 console，確保使用者仍感知進度。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-27 — Patch LB-PROGRESS-MASCOT-20251127A
- **Issue recap**: Tenor v2 API 偶發失敗時進度吉祥物立即落入沙漏 fallback，無法持續顯示 Hachiware 動畫且缺乏自動重試與備援來源。
- **Fix**: 擴增 `initLoadingMascotSanitiser`，先以 Tenor v2 重試三次、再回退至舊版 API，並預載多組 GIF 直接連結或必要時重新掛載官方嵌入，同時保持透明背景與禁用分享連結。
- **Diagnostics**: 本地封鎖 `tenor.googleapis.com` 後觀察到自動切換至 fallback GIF／官方嵌入仍維持透明與不可點，恢復網路則會回填最新動畫且僅注入單一 `<img>`。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-11-30 — Patch LB-PROGRESS-MASCOT-20251130A
- **Issue recap**: 實際頁面載入時進度吉祥物區域未顯示任何圖像，推測 DOM 初始化前若腳本未執行便失去預設 `<img>`，同時仍需確保 Hachiware GIF 無灰色外框與透明背景維持一致。
- **Fix**: 在進度卡容器預先放置指定 Hachiware GIF 的 `<img>` 作為靜態後盾，並強化 `loading-mascot` 樣式強制透明背景、移除額外留白；同步更新 Sanitiser 版本碼，沿用 Tenor API 自動換源時也會覆寫同一個 `<img>`。
- **Diagnostics**: 本地重新整理後未觸發 JavaScript 仍能直接呈現 GIF，開啟網路面板確認載入同一張透明素材且容器背景維持透明方形。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-01 — Patch LB-PROGRESS-MASCOT-20251201A
- **Issue recap**: 回測進度條仍偶發只剩灰底或空白，追查為 GIF fallback 採 `loading="lazy"`、Tenor API 更新至 Chiikawa ID 後未同步回寫 inline 與 fallback 清單，導致腳本執行前無預設影像，腳本執行時又消耗完備援佇列。
- **Fix**: 將進度吉祥物預設 `<img>` 改為 `loading="eager"`，並在 Sanitiser 內優先收集現有 `<img>` 與 data fallback、重新整理失敗時會強制刷新同一路徑，另外把 Tenor Post ID 更新為 Chiikawa 動畫並維持舊 Hachiware 作為最後一層備援。
- **Diagnostics**: 在本地重現前次灰框情境（阻擋 Tenor API 與 CDN）後，確認仍能維持 Chiikawa／Hachiware 靜態 fallback，待網路恢復則由 v2 API 覆寫為最新 GIF；多次切換回測流程也不再出現空白狀態。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-05 — Patch LB-PROGRESS-MASCOT-20251205A
- **Issue recap**: 在多數企業網路（含代理）環境中 Tenor 伺服器回傳 HTTP 403，導致進度吉祥物區域長時間維持空白或沙漏 fallback，無法確認回測狀態。
- **Fix**: 新增 `assets/mascot/hachiware-dance-fallback.svg` 作為本地可離線的 Chiikawa/Hachiware 動畫，並將 Sanitiser 更新為版本碼 `LB-PROGRESS-MASCOT-20251205A`：先載入本地 SVG，若 Tenor API 403 即停止重試並回退；同時標記 `data-lb-mascot-source` 以利診斷。
- **Diagnostics**: 在無法連線 Tenor 的環境下重新載入回測流程，`#loadingGif` 會立即顯示 SVG 動畫且 `dataset.lbMascotSource` 標記為 `fallback:assets/...`；解鎖網路後可觀察 Sanitiser 自動覆寫為 Tenor GIF 並標記 `tenor:<url>`。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-26 — Patch LB-AI-LSTM-REPRO-20251226A / LB-AI-HYBRID-20251226A
- **Issue recap**: LSTM 仍採用 Dropout、Adam shuffle 與未鎖定種子的初始化，導致同一資料集重訓時勝率與混淆矩陣無法完全重現，也缺乏標準化參數與模型版本的保存。前端「新的預測」僅支援 ANN，無法針對 LSTM 重新產生隨機種子。
- **Fix**:
  - `js/worker.js` 移除 Dropout、統一以 `seedrandom` 產生的 Glorot/Orthogonal 初始化器建立 LSTM，訓練採固定批次且禁止 shuffle，並回傳 TP/TN/FP/FN、實際切分索引與標準化 mean/std；完成後會將模型存入 `indexeddb://lstm_v1_model`，同步以 `LSTM_META` 訊息送出版本、後端與種子等重播資訊。
  - `js/ai-prediction.js` 為 LSTM 加入與 ANN 相同的種子管理流程，按下「新的預測」會解鎖新的隨機種子並傳遞至 Worker，狀態列顯示 Seed 編號，並將 LSTM 執行 meta 寫入 `localStorage` 以利之後重播；同時統一以 Worker 回傳的閾值重算交易統計。
- **Diagnostics**: 對同一資料集連續啟動「啟動 AI 預測」取得固定種子結果，再按「新的預測」產生新 seed，確認測試勝率、混淆矩陣與交易摘要完全一致；重複啟動舊種子可 100% 重現前一次結果，IndexedDB 可見最新 `lstm_v1_model` 條目。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-03-10 — Patch LB-PROGRESS-MASCOT-20260310A
- **Issue recap**: 回測時的吉祥物改為隨機來源後尺寸偏離原始設計，且仍位於進度列左側，使用者視線難以聚焦於進度狀態。
- **Fix**: 建立 `--loading-mascot-size` 變數維持原本 3.5rem 尺寸並統一於樣式層置中；進度卡改為先顯示狀態文字與進度條，再於下方中央呈現吉祥物。
- **Diagnostics**: 於桌機與行動裝置檢視執行卡，確認吉祥物固定方形尺寸、水平垂直皆置中且會在每次回測切換來源，進度文字仍與百分比同步更新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/loading-mascot-sources.js','js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-24 — Patch LB-AI-HYBRID-20251224A / LB-AI-ANNS-REPRO-20251224B
- **Issue recap**: AI 預測表未揭露實際進出價格與完整進場條件，種子列表無法快速整理，且 ANN/LSTM 的交易報酬仍沿用前一日收盤對收盤的估算方式，導致凱利資金管理與重播種子與實際邏輯不一致。
- **Fix**:
  - `js/ai-prediction.js` 將 AI 預測預設模型改為 ANNS，交易表新增買入／賣出價格欄位並套用「隔日最低價跌破當日收盤才進場、優先使用隔日開盤價」的進場邏輯；同時在狀態訊息顯示平均報酬與交易次數、更新種子預設命名格式並提供刪除功能，資金控管卡片移到勝率門檻下方且進階超參數改為預設收合。
  - `js/worker.js` 在 ANN 管線計算進場價格、實際報酬與進場旗標，回傳 `buyPrice`／`sellPrice`、`entryEligible`、`lastClose` 與 `forecast.buyPrice` 等資訊；LSTM 亦同步附帶最後收盤價，兩者的 `returns` 均改用新進場邏輯所得到的實際報酬。
  - `index.html` 調整表格與卡片版面，新增買入邏輯說明段落，確保 UI 與後端邏輯一致可讀。
- **Diagnostics**: 比對過往種子與新模型輸出的 `buyPrice`／`sellPrice`、交易數與平均報酬，確認凱利模式與固定投入模式皆落在相同的實際報酬；舊種子載入後仍能維持原勝率與交易統計，並可一鍵刪除多筆紀錄。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-23 — Patch LB-AI-ANNS-REPRO-20251223A
- **Issue recap**: 將 ANN 特徵縮減為 10 欄並以訓練集計算標準化參數後，實測勝率下滑且與既有部署結果不符，需要回復原 12 維技術指標與全資料集正規化流程。
- **Fix**:
  - 還原 MACD Signal、MACD Hist 特徵並恢復 dataset-wide 標準化計算，確保輸入維度與 2025-12-15 研究設定一致。
  - ANN 訊息 meta 的 `featureOrder`、版本碼更新為 `LB-AI-ANNS-REPRO-20251223A`，以利前端識別新模型配置並延續可重播種子機制。
- **Diagnostics**: 以同一資料集重訓 ANN，確認勝率回復至調整前水準且混淆矩陣與原部署結果一致，IndexedDB 亦記錄 12 維特徵。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-22 — Patch LB-AI-HYBRID-20251222A / LB-AI-ANNS-REPRO-20251222A
- **Issue recap**: 需要在維持 ANNS 可重播的前提下，提供一鍵生成新隨機種子的訓練流程，並確保種子管理（儲存／載入）能夠複製當下的預測結果。
- **Fix**:
  - 前端新增「新的預測」按鈕，動態產生安全隨機種子並傳遞至 Worker，狀態列會顯示 Seed 編號；同時保留原「啟動 AI 預測」按鈕以沿用既有種子重播結果。
  - `js/ai-prediction.js` 追蹤種子於模型狀態、預測摘要與種子載入流程中，保存於 saved seed payload 以及 localStorage 的 ANN meta，以利後續重訓或重播。
  - `js/worker.js` 支援 seed override，重新套用 `tf.util.seedrandom(seed)` 與 Glorot 初始化器，並在 meta/hyperparameters 回傳實際使用的 seed，確保 IndexedDB 模型和本地參數一致。
- **Diagnostics**: 於同一資料集先後按「啟動 AI 預測」與「新的預測」比對混淆矩陣、勝率與種子欄位，再重按「啟動 AI 預測」確認可依最新種子重播完全一致的結果。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-27 — Patch LB-AI-HYBRID-20251227B
- **Issue recap**: 種子預設名稱未標示模型別且 LSTM 會沿用 ANNS 勝率，勝率最佳化僅能針對交易報酬中位數，無法限制交易筆數；UI 亦缺少月／年平均報酬等指標與儲存動態回饋。
- **Fix**:
  - 調整 `ai-prediction.js` 交易評估邏輯，計算交易報酬總和、單次／月／年平均報酬與測試期間範圍，並在狀態列、種子預設名稱與摘要同步顯示。
  - 新增門檻最佳化目標下拉與最小交易次數輸入，狀態訊息會依目標顯示對應績效，並更新 LSTM／ANNS 訓練完成訊息的指標清單。
  - 將「儲存種子」移到啟動區塊，新增按鈕成功後的視覺回饋，並在種子清單標註模型前綴；UI 說明更新為單次／月／年平均報酬。
- **Diagnostics**: 本地操作切換 LSTM 與 ANNS，確認種子預設名稱皆以【模型】開頭且指標數值對應；執行門檻最佳化時驗證最小交易筆數限制與目標指標切換生效。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-20 — Patch LB-AI-ANNS-REPRO-20251220A
- **Issue recap**: ANNS 管線仍存在隨機初始值、批次洗牌與後端不一致等因素，導致相同資料重跑時正確率與混淆矩陣無法 100% 重現，也缺乏標準化參數與切分邊界的保存機制。
- **Fix**:
  - 鎖定 TensorFlow.js 4.20.0 WASM 後端並套用 `seedrandom(1337)` 的 Glorot 初始器，ANN 採全批次 SGD（epochs=200、threshold=0.5）且禁止 shuffle；技術指標回到 10 維（SMA30~WilliamsR14）。
  - 標準化僅使用訓練集均值／標準差，保留切分索引與混淆矩陣結果；每次訓練會儲存模型至 `indexeddb://anns_v1_model` 並透過 `ANN_META` 訊息回傳 mean/std、featureOrder、seed、backend 等重現資訊。
  - 前端接收 `ANN_META` 後寫入 `localStorage`，訓練成果統一使用 worker 回傳的超參數與閾值，並在狀態列顯示 TP/TN/FP/FN 以利比對。
- **Diagnostics**: 於同一資料集連續重訓多次，確認測試正確率與混淆矩陣完全一致，localStorage 亦更新最新 mean/std 與切分邊界以供重播。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-15 — Patch LB-AI-ANNS-20251215A
- **Issue recap**: ANNS 模型仍採 Adam + binaryCrossentropy，且輸入僅含 MACD Diff，與 Chen et al. (2024) 研究設定不符。
- **Fix**: 將 `annBuildModel` 調整為 SGD（學習率 0.01）搭配 MSE，並把資料特徵擴充至 Diff/Signal/Hist 共 12 欄，同步更新標準化與預測輸入。
- **Diagnostics**: 透過背景訓練流程確認 ANN 任務可正常輸出進度、測試評估與隔日預測，未發現特徵長度錯配或 Shape 錯誤。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-07 — Patch LB-PROGRESS-MASCOT-20251207A
- **Issue recap**: 實際回測時吉祥物仍顯示成 SVG 或沙漏，追查為 Tenor 貼圖 ID 與 fallback 清單未對應到使用者指定的 Hachiware 動畫，導致 Sanitiser 成功後仍回填錯誤素材。
- **Fix**: 將 `#loadingGif` 的 Tenor Post ID 更新為 `1718069610368761676`，同步清除 SVG fallback，僅保留使用者提供的 Hachiware GIF 來源，並將 Sanitiser 版本碼提升為 `LB-PROGRESS-MASCOT-20251205B` 以確保快取重新套用。
- **Diagnostics**: 於本地載入頁面確認初始 `<img>` 即為指定 GIF，並觀察 `dataset.lbMascotSource` 會在 Tenor API 成功後更新為 `tenor:https://media.tenor.com/...`，確保不再回退到 SVG。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js','js/backtest.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-12 — Patch LB-AI-HYBRID-20251212A
- **Issue recap**: 隔日 AI 模型僅支援 LSTM，預設訓練/測試比例為 2:1，無法切換 ANNS 或於 UI 調整 80/20 等比例，也缺乏背景執行緒的 ANNS 管線。
- **Fix**: 於 `index.html` 新增模型與切分比例選項，`js/ai-prediction.js` 重構成多模型狀態管理，並整合 ANN 與 LSTM 共同的訓練流程、門檻/種子設定；`js/worker.js` 導入技術指標 ANN 資料管線、統一訓練比例預設 80/20、補上 ANN 訊息型別處理與 TensorFlow.js 4.20 載入。
- **Diagnostics**: 切換模型時檢查勝率門檻/凱利/種子是否維持各自設定，確認 Worker 回傳訊息分流（`ai-train-ann`、`ai-train-lstm`）。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-10 — Patch LB-AI-LSTM-20250929B
- **Issue recap**: LSTM 模型仍在主執行緒訓練，啟動 AI 預測時頁面易凍結且進度無法掌握，亦缺乏背景錯誤通知機制。
- **Fix**: 建立 `LB-AI-LSTM-20250929B` 管線，改以 `worker.js` 執行 TensorFlow.js 訓練並透過訊息回傳進度、結果與錯誤，前端僅負責資料切片與結果渲染。
- **Diagnostics**: 確認 Web Worker 能接收資料集、回傳訓練指標與隔日預測，UI 端在勝率門檻、凱利開關與種子載入時可即時重算交易統計。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-09 — Patch LB-AI-LSTM-20250924A
- **Issue recap**: AI 隔日預測在啟用凱利公式時未提供建議投入比例，且交易報酬統計未過濾缺少交易日的筆數，造成評估依據不完整。
- **Fix**: 於凱利模式下依預測勝率計算隔日投入比例並同步顯示於預測區與表格，同時僅保留具備有效交易日的交易紀錄再計算中位數、平均與標準差。
- **Diagnostics**: 本地載入 AI 分頁，套用凱利公式與勝率門檻調整後可看到隔日預測顯示投入比例，並確認交易表與統計僅涵蓋具日期的交易。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-31 — Patch LB-AI-VOL-QUARTILE-20251231A / LB-AI-ANNS-REPRO-20251231A / LB-AI-LSTM-REPRO-20251231A
- **Issue recap**: 三分類波動門檻採用固定參數，導致 ANN 與 LSTM 在不同資料期間無法自動對齊「大漲／大跌」定義，亦未在前端保存訓練集對應的量化邊界，重播時容易出現分類落差。
- **Fix**: `worker.js` 於 ANN、LSTM 訓練前以訓練集相鄰收盤報酬計算 25/75 百分位數，重建三分類標籤並隨模型中繼資料回傳；`js/ai-prediction.js` 先行以訓練集波動度重算資料集標籤、同步更新種子與門檻說明，確保 UI、重播與門檻最佳化共用同一組 quantile。
- **Diagnostics**: 以固定種子多次訓練 ANN/LSTM，檢查 `ANN_META` 與 `LSTM_META` 皆帶回 `lowerQuantile`／`upperQuantile`，並比對 UI 顯示與 Worker 回傳之 `volatilityThresholds` 一致，驗證再訓練與載入種子時分類結果維持不變。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2025-12-30 — Patch LB-AI-CLASS-MODE-20251230B / LB-AI-LSTM-CLASS-20251230A
- **Issue recap**: 使用者需於 ANN 與 LSTM 間切換原本二分類與新三分類預測，但前端僅支援多分類說明，LSTM 亦缺少二分類資料集與機率輸出，導致波段持有策略無法在 LSTM 下重現舊的漲跌邏輯。
- **Fix**:
  - `js/ai-prediction.js` 建立預測分類模式下拉、同步將訓練結果與種子流程寫入 `classificationMode`，並在二分類波段持有時採「預測隔日下跌即收盤出場」邏輯。
  - `js/worker.js` 將 LSTM 訓練／預測改為依 `classificationMode` 動態建立 Sigmoid 或 Softmax 輸出，正規化預測／隔日機率並回傳 `[pDown,pFlat,pUp]`，同時在 Meta 與超參數中保存分類模式。
- **Diagnostics**: 本地以相同資料集分別執行二分類與三分類，檢查交易表的買入日／賣出日、波段持有出場點與平均報酬，確認 LSTM 與 ANN 皆依選取的分類模式輸出一致結果。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-02 — Patch LB-AI-VOL-QUARTILE-20260102A
- **Issue recap**: ANNS 執行「新的預測」時，因重新指派 `resolvedVolatility` 造成 `Assignment to constant variable` 錯誤；同時 UI 仍允許手動調整大漲/大跌門檻，與訓練集 25%／75% 分位自動推導的策略不一致。
- **Fix**:
  - 將 ANN 前端訓練流程的 `resolvedVolatility` 改為可覆寫的 `let`，確保載入 Worker 回傳門檻時不會觸發常數重新指派錯誤。
  - 鎖定 AI 波動門檻輸入為唯讀，改以訓練集 25%／75% 收盤漲跌分位自動更新，並在 UI/提示文字中明確標示為檢視用途。
  - 更新波動分級策略描述與版本碼，確保種子、狀態列與交易摘要共用同一組 quartile 門檻。
- **Diagnostics**: 本地透過 ANN「新的預測」與舊種子載入重播，確認不再出現常數指派錯誤，波動門檻欄位僅顯示最新 quartile 值且不可編輯。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-10 — Patch LB-AI-VOL-QUARTILE-20260110A
- **Issue recap**: 三分類波動門檻雖採用訓練集 25%／75% 分位數，但 UI 缺乏訓練樣本統計，難以驗證大漲／大跌界線是否源自正確的漲跌樣本；同時勝率門檻無法調整至 0%，限制極端策略模擬。
- **Fix**: `js/worker.js` 回傳訓練集漲跌樣本數、四分位值與達門檻筆數，並隨 ANN/LSTM 執行資訊一併保存；`js/ai-prediction.js` 與 `index.html` 新增波動統計區塊、載入種子時同步顯示診斷資料，並將勝率門檻輸入下限放寬至 0%。
- **Diagnostics**: 以相同資料集重訓 ANN/LSTM，確認 UI 顯示訓練樣本／大漲與大跌達門檻天數，與 Worker 回傳的 `volatilityDiagnostics` 數值一致，並驗證勝率門檻可調整至 0%。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-11 — Patch LB-AI-VOL-QUARTILE-20260111A
- **Issue recap**: 前端診斷僅顯示漲跌四分位數與筆數，未揭露是否使用 fallback 門檻，亦缺少達門檻天數占上漲／下跌樣本與整體訓練集的比例，使用者難以確認約 25%／50% 的分佈假設是否成立。
- **Fix**: `js/worker.js` 於四分位推導時加入 fallback 旗標、整體分位備援與達門檻比例；`js/ai-prediction.js` 將上述資訊同步保存至種子與摘要，並在波動統計卡中顯示訓練樣本來源、上漲/下跌門檻筆數占比及 fallback 說明。
- **Diagnostics**: 以多個資料期間重訓 ANN/LSTM，確認 UI 會顯示「依上漲樣本計算」或「樣本不足改用整體四分位」的文字，且達門檻天數占比接近 25%／訓練集占比接近 12.5%，與 Worker 診斷一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-13 — Patch LB-AI-VOL-QUARTILE-20260113A
- **Issue recap**: 三分類波動門檻仍各自以正/負報酬四分位推導，導致前端顯示的 25% 位數與大漲/大跌實際採用值不一致，且診斷缺乏平盤樣本與小波動占比說明，使用者難以確認約 50% 的小波動假設。
- **Fix**: `js/worker.js` 與 `js/ai-prediction.js` 改以訓練集報酬序列的上/下四分位（Q3/Q1）作為主要門檻，並在樣本不足時落回正/負報酬分位或預設值；同步回傳平盤天數、小波動占比與來源旗標，確保重播與 UI 診斷一致。
- **Diagnostics**: 以 ANN/LSTM 重新訓練三分類，檢查 UI 顯示的 Q1/Q3 百分比、平盤天數與小波動占比與 Worker 診斷相符，且達門檻筆數接近 25%／小波動約 50%。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-05 — Patch LB-AI-VOL-QUARTILE-20260105A
- **Issue recap**: 三分類波動門檻僅以整體 25%/75% 分位衡量，無法區分上漲與下跌樣本的尾端區間；交易表亦僅顯示達門檻的成交紀錄，無法檢視低於 50% 機率的日常預測。
- **Fix**:
  - `js/worker.js` 將訓練集隔日報酬拆為正報酬與負報酬兩組，再以上漲樣本前 25% 與下跌樣本前 25% 的四分位推導大漲／大跌門檻，隨模型中繼資料一併回傳。
  - `js/ai-prediction.js` 擴充交易評估輸出每日預測紀錄、保留觸發狀態與投入比例，新增「顯示全部預測紀錄」切換按鈕並於狀態列同步更新，重算報酬時維持切換狀態。
  - `index.html` 調整波動門檻說明文字、加入顯示全部預測按鈕，預設為停用狀態並於載入後由腳本啟用。
- **Diagnostics**: 以同一資料集重訓 ANN 與 LSTM，確認 `volatilityThresholds.upperQuantile/lowerQuantile` 反映正負四分位；切換「顯示全部預測」時，交易表會在 200 筆限制解除後呈現每日預測並保留原有成交筆數。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-18 — Patch LB-AI-HYBRID-20260118A / LB-AI-ANN-DIAG-20260118A / LB-AI-LSTM-REPRO-20260118A
- **Issue recap**: 多分類模式的測試正確率仍採用整體分類準確率，導致 AI 勝率未能反映「預測大漲命中率」，同時 ANNS 測試報告按鈕在切換 LSTM 時仍保持啟用，缺乏視覺提示；交易摘要也尚未整合 AI 勝率與買入持有年化報酬。
- **Fix**:
  - LSTM 與 ANNS 的訓練流程統一以「預測為大漲時的 precision」作為測試期勝率，並在三分類交易邏輯中強制同時滿足大漲判斷與勝率門檻；前端勝率標籤預設為 0%，UI 亦同步標示「大漲命中率」。
  - 擴充交易評估摘要，新增 AI 勝率與買入持有年化報酬率欄位，種子預設名稱也同步包含這兩項指標。
  - 建立 ANNS 功能測試報告彈窗，列出 12 項技術指標覆蓋率與各層權重檢查，並於切換至 LSTM 時停用按鈕與提示「需回到 ANNS 才能檢視」。
- **Diagnostics**: 於同一資料集先後執行 ANN 與 LSTM 的三分類訓練，確認 UI 顯示的大漲命中率與 Worker 回傳 precision 一致，並檢查 ANNS 測試報告顯示 12 指標覆蓋率與各層 NaN 檢查；切換至 LSTM 時按鈕顯示停用提示。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-22 — Patch LB-AI-HYBRID-20260122A / LB-AI-THRESHOLD-20260122A
- **Issue recap**: 三分類預設勝率門檻雖設為 0%，但前端載入時仍套用舊的 50% 門檻，導致顯示「34% 大漲｜未達門檻」且不觸發交易，須手動重新輸入門檻才能成交；LSTM/ANN Worker 亦回傳 0.5 門檻，使種子重播時重現同樣錯誤。
- **Fix**:
  - `js/ai-prediction.js` 新增 `getDefaultWinThresholdForMode/resolveWinThreshold`，將多分類預設門檻統一為 0，二分類維持 60%，並於 UI 初始化、種子載入、交易重算與 Worker 結果整合時套用正確預設值。
  - `js/worker.js` 將 ANN/LSTM 訓練與回傳的門檻改為依分類模式自動帶入 0 或 60%，確保重播或新預測皆採用一致的觸發條件。
- **Diagnostics**: 以相同資料集重訓 ANNS/LSTM，多分類下立即顯示勝率門檻 0%，交易表中的大漲預測可直接觸發「收盤價買入」策略；切換門檻或載入舊種子後，Worker 回傳的 threshold 與 UI 顯示保持一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-24 — Patch LB-AI-THRESHOLD-20260124A
- **Issue recap**: 二分類模式仍沿用 60% 預設勝率門檻，與最新需求的 50% 不符，導致預設情境下仍須手動下調門檻才能觸發交易並與多分類邏輯對齊。
- **Fix**:
  - `js/ai-prediction.js` 將二分類預設勝率門檻改為 50%，並同步更新版本代碼與 UI 預設值，確保初始載入即反映新標準。
  - `js/worker.js` 將 ANN/LSTM 的二分類預設門檻調整為 0.5，使訓練流程、重播與種子儲存皆採用一致值。
- **Diagnostics**: 於二分類模式下執行 ANNS/LSTM，確認 UI 初始門檻為 50%，且 Worker 回傳的 threshold 與重播後的門檻皆維持 0.5，無需額外調整即可觸發預設交易策略。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-26 — Patch LB-AI-ANN-DIAG-20260126B
- **Issue recap**: ANNS 功能測試報告僅於三分類情境呈現 Precision／Recall，二分類缺少相同診斷，也未提供 F1 與指標定義說明，使評估報告無法完整對照 TP/FP/FN。
- **Fix**: `js/worker.js` 為 ANN 訓練流程計算 Precision／Recall／F1 並隨診斷回傳；`js/ai-prediction.js` 在測試報告中統一顯示上漲/大漲 Precision、Recall、F1 及其公式說明，確保二元與三元分類皆可對照混淆矩陣理解模型表現。
- **Diagnostics**: 本地以 ANN 二分類與三分類分別執行一次訓練，確認測試報告顯示 Precision／Recall／F1 與 Worker 回傳值一致，且備註文字依分類模式顯示「上漲」或「大漲」說明。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-01-28 — Patch LB-AI-VOL-QUARTILE-20260128A
- **Issue recap**: ANNS 功能測試報告的三分類樣本分佈仍沿用預設門檻統計，導致與四分位診斷顯示的達門檻天數不一致；交易表僅顯示機率，無法對照實際採用的大漲/大跌門檻與預測漲跌幅範圍。
- **Fix**:
  - `js/worker.js` 在依訓練集四分位重建標籤後重新統計 `classDistribution`，並將最終筆數寫入 `volatilityDiagnostics` 以確保報告與診斷同步。
  - `js/ai-prediction.js` 與 `index.html` 為交易表新增「預測漲跌幅％」「大漲門檻％」「大跌門檻％」欄位，所有紀錄與隔日預測皆使用實際門檻值格式化顯示。
- **Diagnostics**: 重新訓練三分類 ANN，確認測試報告樣本數與診斷中的達門檻天數一致，並於交易表檢視未達勝率門檻的紀錄，確定欄位顯示的門檻與實際買入判斷相符。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-02 — Patch LB-AI-VOL-QUARTILE-20260202A / LB-AI-ANNS-REPRO-20260202A / LB-AI-ANN-DIAG-20260202A
- **Issue recap**: 交易表的「預測漲跌幅％」僅以門檻區間顯示 ≥/≤，無法呈現模型實際預估的漲跌幅；同時 Worker 未回傳各類別平均報酬，使前端難以還原預估值，種子重播也缺乏一致性的預估幅度。
- **Fix**:
  - `js/worker.js` 於 ANN 訓練流程統計訓練/全樣本的大漲、平盤、大跌平均報酬並寫入 `classReturnAverages`，同時在即時預測中計算預估漲跌幅並存入模型中繼資料與診斷。
  - `js/ai-prediction.js` 以類別平均報酬加權 `softmax` 機率計算預估漲跌幅，交易表與隔日預測欄位直接顯示百分比數值，並在摘要敘述中同步揭露預估漲跌幅；種子儲存/載入亦保存 `classReturnAverages` 以維持重播一致性。
- **Diagnostics**: 以三分類 ANN 執行訓練後，檢查 Worker 回傳的類別平均報酬與診斷統計；於前端交易表比對每筆紀錄的預估漲跌幅是否隨機率變動，並載入儲存種子確認預估值一致。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-10 — Patch LB-AI-SWING-20260210A / LB-AI-ANNS-REPRO-20260210A / LB-AI-ANN-DIAG-20260210A
- **Issue recap**: 「預測漲跌幅％」仍可能回退到四分位門檻，導致表格出現與門檻相同的數值；Worker 端的 `computeExpectedSwing` 亦在缺少樣本時改用門檻 fallback，使種子重播難以區分模型期望值與閾值。
- **Fix**:
  - `js/worker.js` 將 `computeExpectedSwing` 改為僅依訓練/整體平均報酬計算期望值，無樣本時回傳 `NaN`，並更新 ANN 版本代碼追蹤此行為調整。
  - `js/ai-prediction.js` 移除預估漲跌幅的門檻 fallback，僅顯示模型期望值；若無平均報酬可用則顯示破折號，避免與門檻數值混淆，並更新版本標記供前端診斷。
- **Diagnostics**: 以樣本較少的大漲資料集重訓 ANN，確認預測表中的預估漲跌幅僅在有類別平均報酬時顯示數值；於無足夠樣本的情境下顯示 `—` 而非門檻百分比，並檢查 ANN 診斷版號更新。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/ai-prediction.js','js/worker.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-18 — Patch LB-ROLLING-TEST-20250925A
- **Issue recap**: Walk-Forward 訓練期僅逐參數掃描一次，未套用批量優化的交替迭代流程，導致滾動測試未能收斂到批量優化挑選的最佳參數組合。
- **Fix**:
  - `js/rolling-test.js` 導入批量優化迭代上限設定，於訓練視窗對做多/做空進出場與風險管理重複交替優化，並以原始參數快照計算實際調整鍵值。
  - 同步收集各迭代指標並整合訊息摘要，確保最終報告揭露批量優化引擎選出的參數與指標成效，版本碼更新為 `LB-ROLLING-TEST-20250925A`。
- **Diagnostics**: 於本地以滾動測試啟用訓練期優化，確認多輪迭代後的參數與批量優化面板載入結果一致，並檢視報告訊息顯示迭代後的調整明細。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-24 — Patch LB-ROLLING-TEST-20250926A
- **Issue recap**: Walk-Forward 訓練期雖已循序掃描參數，但仍與批量優化面板獨立執行時的最佳解不符，原因在於滾動測試未真正復用批量優化的組合交替流程與資料視窗設定。
- **Fix**:
  - `js/batch-optimization.js` 新增 `clonePlainObject`/`prepareBaseParamsForOptimization`，並擴充 `optimizeCombinationIterative`、`optimizeStrategyWithInternalConvergence`、`executeBacktestForCombination` 支援外部覆寫訓練區間與啟用範圍，同步公開 `runCombinationOptimization` 以便模組外重用。
  - `js/rolling-test.js` 建立 `runCombinationOptimizationForWindow`，於訓練期直接呼叫批量優化組合迭代並以原始參數快照產生摘要，保留對風險與做空參數的交替迭代，版本碼更新為 `LB-ROLLING-TEST-20250926A`。
- **Diagnostics**: 以單視窗訓練期手動執行批量優化與滾動測試，自比對進/出場參數與最終指標，確認兩者一致並在報告中顯示批量優化目標指標；同時驗證做空與風險參數仍能在剩餘迭代中收斂。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js','js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`


## 2026-02-26 — Patch LB-ROLLING-TEST-20250927A
- **Issue recap**: Walk-Forward 訓練期雖已導入批量優化引擎，但在組合優化階段仍以做多配置的鍵值查詢出場策略設定，造成滾動測試與批量優化面板在同一訓練視窗下產生不同的最佳出場參數。
- **Fix**: `js/rolling-test.js` 於建立組合時改用 `resolveStrategyConfigKey` 轉換做多/做空出場策略對應的批量優化鍵值，並更新模組版本碼至 `LB-ROLLING-TEST-20250927A`，確保批量優化與 Walk-Forward 共用相同策略範圍。
- **Diagnostics**: 重新於訓練視窗內分別執行批量優化與滾動測試，確認兩者的出場參數完全一致，並比對報告摘要所列優化訊息。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-27 — Patch LB-ROLLING-TEST-20250928A
- **Issue recap**: 第二個視窗起的 Walk-Forward 測試期採用的訓練參數仍與批量優化面板對同一訓練期間的最佳解不一致，推查發現訓練視窗仍沿用前一輪的相對期間旗標與 staging 陣列，導致批量優化覆寫的日期與資金配置未完全同步。
- **Fix**:
  - `js/rolling-test.js` 新增 `buildTrainingWindowBaseParams`、`normalizeWindowBaseParams` 等工具，於每個訓練視窗重新清除 `recent*` 相對期間設定、暖身欄位與 staging 預設值，並依視窗日期重建回測參數後再交由批量優化引擎處理。
  - 批量組合優化回傳時同步帶入停損/停利調整，讓測試期確實沿用批量優化產出的完整參數組合。
  - 更新模組版本碼至 `LB-ROLLING-TEST-20250928A`，並於滾動測試流程中統一以正規化後的參數驅動訓練與測試回測。
- **Diagnostics**: 針對第二與第三個視窗分別在批量優化面板及 Walk-Forward 訓練期執行一次回測，確認最佳參數（含停損/停利與買進時點設定）完全一致，測試期亦沿用相同設定。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-02-28 — Patch LB-ROLLING-TEST-20250929A
- **Issue recap**: Walk-Forward 第二輪起的訓練視窗仍與批量優化結果不符，排查後確認滾動測試固定使用 4 輪交替迭代，與批量優化面板的 6 輪（或使用者自訂值）不同，導致部分視窗未收斂或出現與面板不一致的最佳參數。
- **Fix**:
  - `index.html` 為滾動測試優化面板新增「組合迭代上限」欄位，預設 6 並支援同步調整交替優化輪數。
  - `js/rolling-test.js` 讀取滾動面板或批量優化面板的迭代上限，若未設定則回退至預設 6，並更新模組版號為 `LB-ROLLING-TEST-20250929A`。
- **Diagnostics**: 以相同訓練視窗分別在批量優化面板與滾動測試啟動優化，確認 `plan.config.iterationLimit` 與面板設定一致，且交替迭代輪數相同時最佳參數完全重合。
- **Debug log**:
  - 交叉比對 `batch-optimize-iteration-limit` 與滾動模組紀錄，確定批量面板預設 6、滾動模組僅執行 4 輪是差異來源。
  - 逐窗列印 `plan.config.iterationLimit` 驗證覆寫順序：先讀滾動面板、再回退批量面板、最後採預設值。
  - 若未來仍有差異，建議檢查 `optimizeCombinationIterative` 的迭代收斂紀錄與 Worker 回傳的最佳指標，以確認是否需要同步 trials 或風控迭代策略。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-03-02 — Patch LB-ROLLING-TEST-20250930A / LB-BATCH-OPT-20250930A
- **Issue recap**: 第二視窗後的訓練最佳解仍優於批量優化面板，確認交替輪數一致後，推定為滾動模組在優化時沿用整體 `cachedStockData`，導致 Worker 可能取用超出訓練窗的資料。
- **Fix**:
  - `js/rolling-test.js` 於訓練視窗建置 `prepareWorkerPayload`，依回傳的 `dataStartDate` 裁切 `cachedStockData`，並透過 `cachedDataOverride` 傳入批量優化與風險優化流程。
  - `js/batch-optimization.js` 的 `runCombinationOptimization`、單參數／風險優化與驗證回測均支援 `cachedDataOverride`，遇到覆寫時改以視窗限定的快取取代全域資料。
  - 模組版號更新為 `LB-ROLLING-TEST-20250930A`、`LB-BATCH-OPT-20250930A` 以追蹤視窗資料裁切改動。
- **Diagnostics**: 準備針對第二、第三視窗記錄 `cachedWindowData.length` 與原始快取長度，並比對批量優化單跑的 `rawDataUsed.fetchRange`，確認 Worker 僅接收到對應訓練期間的資料。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/rolling-test.js','js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

### Debug Log — LB-ROLLING-TEST-DEBUG-20251001A
- **Confirmed non-issues**: 迭代上限與優化 scope 已與批量面板一致；`resolveStrategyConfigKey` 未發生多空鍵值錯置。
- **Active hypothesis**: 滾動優化若未裁切快取會攜帶後續資料，造成第二窗後的最佳解偏離批量優化；此次改為傳遞 `cachedDataOverride` 以驗證。
- **Next checks**:
  1. 針對出現差異的視窗列印 `trainingPayload.dataStartDate`、`cachedWindowData[0/last].date`，確保裁切範圍覆蓋暖身+訓練期間。
  2. 若仍有差異，改為在 Worker `runOptimization` 內紀錄 `baseParams.startDate/endDate`，比對是否仍帶入超出視窗的日期。
  3. 若裁切成功但結果仍優於批量面板，需再排查 `optimizeRiskManagementParameters` 是否應同步裁切或調整 trials。
  
## 2026-03-05 — Patch LB-PROGRESS-MASCOT-20260305A
- **Issue recap**: Tenor 進度吉祥物已無法符合授權需求，且新增素材須在每次執行回測時隨機顯示指定連結清單，避免重複出現同一張。
- **Fix**:
  - 新增 `js/loading-mascot-sources.js` 匯出完整素材清單並進行去重、前後端共用版本碼 `LB-PROGRESS-MASCOT-20260305A`。
  - `index.html` 移除 Tenor 相關屬性，改以本地預設圖作為 fallback，並於腳本載入順序中注入來源清單模組。
  - `js/main.js` 以 `refreshLoadingMascotImage` 取代舊有 Tenor 載入流程：在 `showLoading` 啟動與初始載入時隨機挑選來源、同時保留錯誤重試與沙漏備援，並透過 `window.lazybacktestMascot` 暴露除錯介面。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/loading-mascot-sources.js','js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`
## 2026-03-06 — Patch LB-PROGRESS-MASCOT-20260306A
- **Issue recap**: 進度吉祥物仍維持 3.5rem 正方形，無法與進度條等寬，導致寬螢幕時顯得過小且失去原始比例。
- **Fix**:
  - `css/style.css` 改為以 100% 寬度呈現吉祥物容器，移除固定尺寸變數並讓圖片依原始比例自適應高度。
  - `index.html` 調整容器寬度類別，確保吉祥物隨卡片寬度拉伸並與進度條對齊。
- **Diagnostics**: 於本地檢視載入中的卡片，確認隨視窗縮放時吉祥物與進度條維持相同寬度且無裁切變形。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/loading-mascot-sources.js','js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-03 — Patch LB-PROGRESS-MASCOT-20260703A
- **Issue recap**: 進度吉祥物在長時間載入時可能停留於同一張圖片，缺乏輪播節奏且會在單輪隨機尚未走完時重複素材。
- **Fix**:
  - `js/main.js` 建立輪播序列與 4 秒自動換圖計時器，確保同輪所有來源皆顯示後才重新洗牌，並於載入失敗時自動改試下一張。
  - 新增排程治理：手動或自動換圖時會重置計時器、重新安排下一次刷新，確保長時間載入不會停滯。
- **Diagnostics**: 人工調整來源清單與瀏覽器 devtools 人為延遲，驗證單輪顯示順序不重複且換輪時不會立即重覆上一張，並確認時鐘限制生效。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-05 — Patch LB-PROGRESS-MASCOT-20260705A
- **Issue recap**: 載入吉祥物無法由使用者自行關閉，長時間回測時可能造成視覺干擾，亦缺乏顯示狀態的可及性標示。
- **Fix**:
  - `index.html` 注入位於圖片左上角的顯示/隱藏按鈕與 fallback 容器，並預設開啟、符合 `aria-pressed` 無障礙語意。
  - `css/style.css` 調整畫布指標事件與最小高度，新增 `loading-mascot-toggle`、隱藏狀態提示與 fallback 顯示動畫，確保響應式排版穩定。
  - `js/main.js` 導入 `ensureLoadingMascotInfrastructure`、`applyLoadingMascotHiddenState` 等輔助函式，記錄顯示狀態並在隱藏時停止輪播、維持來源隊列。
- **Diagnostics**: 透過 DevTools 手動觸發 `refreshLoadingMascotImage`、輪播逾時與 fallback 情境，確認隱藏狀態可持續、重開時重取新圖且沙漏備援不會移除控制鈕。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-08 — Patch LB-PROGRESS-MASCOT-20260708A
- **Issue recap**: 現有頁面預先渲染控制鈕，導致 `ensureLoadingMascotInfrastructure` 跳過事件綁定，使用者按下無法切換顯示狀態。
- **Fix**:
  - `js/main.js` 新增 `handleLoadingMascotToggle` 與 `bindLoadingMascotToggle`，不論按鈕是否為既有節點皆綁定點擊事件並同步類別、ARIA 屬性。
  - 更新進度吉祥物版本碼至 `LB-PROGRESS-MASCOT-20260708A`，並在綁定流程中維持 fallback 屬性完整。
- **Diagnostics**: 本地以 DOMContentLoaded 後直接點擊預設控制鈕，確認立即進入隱藏狀態並停止輪播，再次點擊可正常顯示並重新排程換圖。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-09 — Patch LB-PROGRESS-MASCOT-20260709A
- **Issue recap**: 使用者切換至隱藏模式時仍殘留圖片容器與「圖片已隱藏」提示，視覺上占位過大且與需求不符。
- **Fix**:
  - `css/style.css` 將隱藏狀態改為完全收合畫布，只保留「+」控制鈕並關閉提示文字與多餘高度。
  - `js/main.js` 更新 `applyLoadingMascotHiddenState` 配合新樣式維持顯示狀態與 aria 屬性，同步提升版本碼至 `LB-PROGRESS-MASCOT-20260709A`。
- **Diagnostics**: 於本地多次切換顯示/隱藏並驗證畫布空間即時收合、重新開啟後恢復原始尺寸且輪播可重新排程。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/main.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-10 — Patch LB-BATCH-CACHE-20251020A
- **Issue recap**: 先執行滾動測試的自動優化後再回到批量優化面板，最佳參數欄位偶爾回傳空值；推查發現裁切後的視窗快取在覆用時可能缺少暖身或測試期尾端資料，批量優化沿用失效快取導致 Worker 回傳 `no_data`。
- **Fix**:
  - `js/batch-optimization.js` 擴充 `resolveWorkerCachePayload`，針對 `cachedDataOverride` 與全域 `cachedStockData` 皆檢查實際資料範圍是否涵蓋 `dataStartDate`～`endDate`，不足時改為強制重新抓取，並記錄範圍不足原因。
  - 新增跨來源時間戳解析工具，支援數值／字串時間戳並允許 7 天容忍，以符合暖身緩衝的最小需求。
- **Diagnostics**: 滾動測試訓練窗與批量面板交替執行，確認覆用視窗快取時 `cachedDataOverride` 與全域快取皆通過範圍檢查，並於控制台觀察覆寫被拒後改為重新抓取的資訊訊息。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

## 2026-07-11 — Patch LB-BATCH-CACHE-20251027A
- **Issue recap**: 滾動測試後立即執行批量優化時，部分流程仍沿用訓練視窗殘留的快取資料，且缺乏可複製的批量比較紀錄，導致最佳參數與首次批量結果不一致。
- **Fix**:
  - `js/batch-optimization.js` 新增 `ensureBatchCachePrimed` 預檢流程，先檢查資料範圍是否足夠，必要時自動呼叫主執行緒回測補齊快取並記錄 preflight 決策。
  - 建立批量優化跑次歷史與比較摘要，於開發者模式卡片輸出可複製的兩輪差異（目標指標、資料區間、最佳策略與指標值），協助比對滾動測試後與原始批量結果。
- **Diagnostics**: 依「滾動優化 → 批量優化 → 調整日期 → 再跑批量」流程，確認預檢會觸發主回測補快取且開發者日誌記錄兩輪結果與差異摘要，可貼上複製比對。
- **Testing**: `node - <<'NODE' const fs=require('fs');const vm=require('vm');['js/batch-optimization.js'].forEach((file)=>{const code=fs.readFileSync(file,'utf8');new vm.Script(code,{filename:file});});console.log('scripts compile');NODE`

