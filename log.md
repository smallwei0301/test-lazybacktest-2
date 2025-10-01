## 2025-07-05 — Patch LB-FUGLE-PRIMARY-20250705A
- **Scope**: 將台股上市、上櫃資料管線改以 Fugle 為主來源並支援指數代碼查詢。
- **Highlights**:
  - TWSE/TPEX Netlify 函式新增 Fugle API 解析，保留 TWSE/FinMind/Yahoo 備援並更新資料來源摘要。
  - Worker 強制來源順序改為優先 Fugle，前端資料來源測試器新增 Fugle 按鈕與說明。
  - 台股清單快取併入 FinMind 指數資訊，名稱查詢支援台股指數並於 UI 加入指數市場選項。
  - README 更新 Netlify 環境變數指引，新增 `FUGLE_API_TOKEN` 與指數查詢行為說明。
- **Testing**: 待瀏覽器回測驗證（本地無前端環境）。

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

