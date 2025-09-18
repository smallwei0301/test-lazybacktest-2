// 確保 zoom 插件正確註冊
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chart object:', typeof Chart);
    console.log('Available Chart plugins:', Chart.registry ? Object.keys(Chart.registry.plugins.items) : 'No registry');
});

// --- 主回測函數 ---
function runBacktestInternal() {
    console.log("[Main] runBacktestInternal called");
    if (!workerUrl) { showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); hideLoading(); return; }
    try {
        const params=getBacktestParams();
        console.log("[Main] Params:", params);
        const isValid = validateBacktestParams(params);
        console.log("[Main] Validation:", isValid);
        if(!isValid) return;

        const curSettings={stockNo:params.stockNo, startDate:params.startDate, endDate:params.endDate};
        const useCache=!needsDataFetch(curSettings);
        const msg=useCache?"⌛ 使用快取執行回測...":"⌛ 獲取數據並回測...";
        showLoading(msg);
        clearPreviousResults(); // Clear previous results including suggestion

        if(backtestWorker) { // Ensure previous worker is terminated
            backtestWorker.terminate();
            backtestWorker = null;
            console.log("[Main] Terminated previous worker.");
        }
        console.log("[Main] WorkerUrl:", workerUrl);
        console.log("[Main] Creating worker...");
        backtestWorker=new Worker(workerUrl);

        // Unified Worker Message Handler
        backtestWorker.onmessage=e=>{
            const{type,data,progress,message, stockName, dataSource}=e.data;
            console.log("[Main] Received message from worker:", type, data); // Debug log

            if(type==='progress'){
                updateProgress(progress);
                if(message)document.getElementById('loadingText').textContent=`⌛ ${message}`;
            } else if(type==='result'){
                if(!useCache&&data?.rawData){
                     cachedStockData = data.rawData;
                     lastFetchSettings=curSettings;
                     console.log(`[Main] Data cached for ${curSettings.stockNo}.`);
                } else if (useCache && cachedStockData ) {
                     console.log("[Main] Using main thread cached data for worker if needed.");
                } else if(!useCache) {
                     console.warn("[Main] No rawData to cache from backtest.");
                }
                handleBacktestResult(data, stockName, dataSource); // Process and display main results

                getSuggestion();

            } else if(type==='suggestionResult'){
                const suggestionArea = document.getElementById('today-suggestion-area');
                const suggestionText = document.getElementById('suggestion-text');
                if(suggestionArea && suggestionText){
                    suggestionText.textContent = data.suggestion || '無法取得建議';
                    suggestionArea.classList.remove('hidden', 'loading');
                     suggestionArea.className = 'my-4 p-4 border-l-4 rounded-md text-center'; // Base classes
                    if (data.suggestion === '做多買入' || data.suggestion === '持有 (多)') { suggestionArea.classList.add('bg-green-50', 'border-green-500', 'text-green-800'); }
                    else if (data.suggestion === '做空賣出' || data.suggestion === '持有 (空)') { suggestionArea.classList.add('bg-red-50', 'border-red-500', 'text-red-800'); }
                    else if (data.suggestion === '做多賣出' || data.suggestion === '做空回補') { suggestionArea.classList.add('bg-yellow-50', 'border-yellow-500', 'text-yellow-800'); }
                    else if (data.suggestion === '等待') { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }
                     else { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }

                    hideLoading();
                    showSuccess("回測完成！");
                    if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
                }
            } else if(type==='suggestionError'){
                const suggestionArea = document.getElementById('today-suggestion-area');
                const suggestionText = document.getElementById('suggestion-text');
                if(suggestionArea && suggestionText){
                    suggestionText.textContent = data.message || '計算建議時發生錯誤';
                    suggestionArea.classList.remove('hidden', 'loading');
                    suggestionArea.className = 'my-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md text-center';
                }
                 hideLoading();
                 showError("回測完成，但計算建議時發生錯誤。");
                 if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            } else if(type==='error'){
                showError(data?.message||"回測過程錯誤");
                if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
                hideLoading();
                const suggestionArea = document.getElementById('today-suggestion-area');
                 if (suggestionArea) suggestionArea.classList.add('hidden');
            }
        };

        backtestWorker.onerror=e=>{
             showError(`Worker錯誤: ${e.message}`); console.error("[Main] Worker Error:",e);
             if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
             hideLoading();
             const suggestionArea = document.getElementById('today-suggestion-area');
              if (suggestionArea) suggestionArea.classList.add('hidden');
        };

        const workerMsg={type:'runBacktest', params:params, useCachedData:useCache};
        if(useCache && cachedStockData) {
            workerMsg.cachedData = cachedStockData;
            console.log("[Main] Sending cached data to worker for backtest.");
        } else {
            console.log("[Main] Fetching new data for backtest.");
        }
        backtestWorker.postMessage(workerMsg);

    } catch (error) {
        console.error("[Main] Error in runBacktestInternal:", error);
        showError(`執行回測時發生錯誤: ${error.message}`);
        hideLoading();
        const suggestionArea = document.getElementById('today-suggestion-area');
        if (suggestionArea) suggestionArea.classList.add('hidden');
        if(backtestWorker)backtestWorker.terminate(); backtestWorker = null;
    }
}

function clearPreviousResults() {
    document.getElementById("backtest-result").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("trade-results").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">請執行優化</p>`;
    document.getElementById("performance-table-container").innerHTML=`<p class="text-gray-500">請先執行回測以生成期間績效數據。</p>`;
    if(stockChart){
        stockChart.destroy(); 
        stockChart=null; 
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas><div class="text-muted text-center" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>執行回測後將顯示淨值曲線</p></div>';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
    const resEl=document.getElementById("result");
    resEl.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md';
    resEl.innerHTML = `<i class="fas fa-info-circle mr-2"></i> 請設定參數並執行。`;
    lastOverallResult = null; lastSubPeriodResults = null;
    
    const suggestionArea = document.getElementById('today-suggestion-area');
    const suggestionText = document.getElementById('suggestion-text');
    if (suggestionArea && suggestionText) {
        suggestionArea.classList.add('hidden');
        suggestionArea.className = 'my-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 rounded-md text-center hidden';
        suggestionText.textContent = "-";
    }
}

function handleBacktestResult(result, stockName, dataSource) {
    console.log("[Main] handleBacktestResult received:", result);
    updateDataSourceDisplay(dataSource, stockName);
    const suggestionArea = document.getElementById('today-suggestion-area');
    if(!result||!result.dates||result.dates.length===0){
        showError("回測結果無效或無數據");
        lastOverallResult = null; lastSubPeriodResults = null;
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
        return;
    }
    try {
        lastOverallResult = result;
        lastSubPeriodResults = result.subPeriodResults;

        displayBacktestResult(result);
        displayTradeResults(result);
        renderChart(result);
        displayPerformanceTable(lastSubPeriodResults);
        activateTab('summary');

        setTimeout(() => {
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                chartContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);

    } catch (error) {
         console.error("[Main] Error processing backtest result:", error);
         showError(`處理回測結果時發生錯誤: ${error.message}`);
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
         if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
    }
}

function updateDataSourceDisplay(dataSource, stockName) {
    const dataSourceEl = document.getElementById('dataSourceDisplay');
    const stockNameEl = document.getElementById('stockNameDisplay');

    if (stockNameEl && stockName) {
        stockNameEl.innerHTML = `<span class="font-semibold text-gray-700">${stockName}</span>`;
        stockNameEl.style.display = 'block';
    }

    if (dataSourceEl && dataSource) {
        let displaySource = dataSource;
        let colorClass = 'text-gray-500';
        if (dataSource.includes('快取')) {
            displaySource = `⚡️ ${dataSource}`;
            colorClass = 'text-blue-600';
        } else if (dataSource.includes('Yahoo') || dataSource.includes('FinMind')) {
            displaySource = `☁️ ${dataSource}`;
            colorClass = 'text-green-600';
        } else if (dataSource.includes('TWSE')) {
             displaySource = `🏢 ${dataSource}`;
             colorClass = 'text-purple-600';
        }
        dataSourceEl.innerHTML = `<span class="text-xs ${colorClass}">資料來源: ${displaySource}</span>`;
    }
}

// --- Main.js content ---
let stockChart = null;
let backtestWorker = null;
let optimizationWorker = null;
let workerUrl = null; 
let cachedStockData = null;
let lastFetchSettings = null;
let currentOptimizationResults = [];
let sortState = { key: 'annualizedReturn', direction: 'desc' };
let lastOverallResult = null;
let lastSubPeriodResults = null;
let preOptimizationResult = null;

function initDates() { const eD=new Date(); const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-5); document.getElementById('endDate').value=formatDate(eD); document.getElementById('startDate').value=formatDate(sD); document.getElementById('recentYears').value=5; }
function applyRecentYears() { const nYI=document.getElementById('recentYears'); const eDI=document.getElementById('endDate'); const sDI=document.getElementById('startDate'); const nY=parseInt(nYI.value); const eDS=eDI.value; if(isNaN(nY)||nY<1){showError("請輸入有效年數");return;} if(!eDS){showError("請先選結束日期");return;} const eD=new Date(eDS); if(isNaN(eD)){showError("結束日期格式無效");return;} const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-nY); const eY=1992; if(sD.getFullYear()<eY){sD.setFullYear(eY,0,1); const aY=eD.getFullYear()-eY; nYI.value=aY; showInfo(`資料最早至 ${eY} 年，已調整`);} else {showInfo(`已設定開始日期 ${formatDate(sD)}`);} sDI.value=formatDate(sD); }
function formatDate(d) { if(!(d instanceof Date)||isNaN(d))return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function showError(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-times-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md'; }
function showSuccess(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-check-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded-md'; }
function showInfo(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-info-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md'; }
function showLoading(m="⌛ 處理中...") { 
    const el = document.getElementById("loading"); 
    const loadingText = document.getElementById('loadingText');
    const progressBar = document.getElementById("progressBar");
    
    if (loadingText) loadingText.textContent = m; 
    if (el) el.classList.remove("hidden"); 
    if (progressBar) progressBar.style.width = `0%`; 
    
    const spinner = el?.querySelector('.fa-spinner'); 
    if (spinner) spinner.classList.add('fa-spin'); 
}
function hideLoading() { 
    const el = document.getElementById("loading"); 
    if (el) el.classList.add("hidden"); 
}
function updateProgress(p) { const bar=document.getElementById("progressBar"); bar.style.width=`${Math.min(100,Math.max(0,p))}%`; }
function getStrategyParams(type) { const strategySelectId = `${type}Strategy`; const strategySelect = document.getElementById(strategySelectId); if (!strategySelect) { console.error(`[Main] Cannot find select element with ID: ${strategySelectId}`); return {}; } const key = strategySelect.value; let internalKey = key; if (type === 'exit') { if(['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(key)) { internalKey = `${key}_exit`; } } else if (type === 'shortEntry') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(key)) { internalKey = `short_${key}`; } } else if (type === 'shortExit') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(key)) { internalKey = `cover_${key}`; } } const cfg = strategyDescriptions[internalKey]; const prm = {}; if (!cfg?.defaultParams) { return {}; } for (const pName in cfg.defaultParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if ((internalKey === 'macd_cross_exit' || internalKey === 'macd_cross') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; const id = `${type}${idSfx}`; const input = document.getElementById(id); if (input) { prm[pName] = parseFloat(input.value); } else { console.warn(`[getStrategyParams] Input not found for ${pName} (id: #${id})`); } } return prm; }
function getBacktestParams() { const sN=document.getElementById("stockNo").value.trim().toUpperCase()||"2330"; const sD=document.getElementById("startDate").value; const eD=document.getElementById("endDate").value; const iC=parseFloat(document.getElementById("initialCapital").value)||100000; const pS=parseFloat(document.getElementById("positionSize").value)||100; const sL=parseFloat(document.getElementById("stopLoss").value)||0; const tP=parseFloat(document.getElementById("takeProfit").value)||0; const tT=document.querySelector('input[name="tradeTiming"]:checked')?.value||'close'; const adjP=document.getElementById("adjustedPriceCheckbox").checked; const eS=document.getElementById("entryStrategy").value; const xS=document.getElementById("exitStrategy").value; const eP=getStrategyParams('entry'); const xP=getStrategyParams('exit'); const enableShorting = document.getElementById("enableShortSelling").checked; let shortES = null, shortXS = null, shortEP = {}, shortXP = {}; if (enableShorting) { shortES = document.getElementById("shortEntryStrategy").value; shortXS = document.getElementById("shortExitStrategy").value; shortEP = getStrategyParams('shortEntry'); shortXP = getStrategyParams('shortExit'); } const buyFee = parseFloat(document.getElementById("buyFee").value) || 0; const sellFee = parseFloat(document.getElementById("sellFee").value) || 0;     const positionBasis = document.querySelector('input[name="positionBasis"]:checked')?.value || 'initialCapital'; const marketSwitch = document.getElementById("marketSwitch"); const market = (marketSwitch && marketSwitch.checked) ? 'TPEX' : 'TWSE'; return { stockNo: sN, startDate: sD, endDate: eD, initialCapital: iC, positionSize: pS, stopLoss: sL, takeProfit: tP, tradeTiming: tT, adjustedPrice: adjP, entryStrategy: eS, exitStrategy: xS, entryParams: eP, exitParams: xP, enableShorting: enableShorting, shortEntryStrategy: shortES, shortExitStrategy: shortXS, shortEntryParams: shortEP, shortExitParams: shortXP, buyFee: buyFee, sellFee: sellFee, positionBasis: positionBasis, market: market, marketType: currentMarket }; }
function validateBacktestParams(p) { if(!/^[0-9A-Z]{3,7}$/.test(p.stockNo)){showError("請輸入有效代碼");return false;} if(!p.startDate||!p.endDate){showError("請選擇日期");return false;} if(new Date(p.startDate)>=new Date(p.endDate)){showError("結束日期需晚於開始日期");return false;} if(p.initialCapital<=0){showError("本金需>0");return false;} if(p.positionSize<=0||p.positionSize>100){showError("部位大小1-100%");return false;} if(p.stopLoss<0||p.stopLoss>100){showError("停損0-100%");return false;} if(p.takeProfit<0){showError("停利>=0%");return false;} if (p.buyFee < 0) { showError("買入手續費不能小於 0%"); return false; } if (p.sellFee < 0) { showError("賣出手續費+稅不能小於 0%"); return false; } const chkP=(ps,t)=>{ if (!ps) return true; for(const k in ps){ if(typeof ps[k]!=='number'||isNaN(ps[k])){ if(Object.keys(ps).length > 0) { showError(`${t}策略的參數 ${k} 錯誤 (值: ${ps[k]})`); return false; } } } return true; }; if(!chkP(p.entryParams,'做多進場'))return false; if(!chkP(p.exitParams,'做多出場'))return false; if (p.enableShorting) { if(!chkP(p.shortEntryParams,'做空進場'))return false; if(!chkP(p.shortExitParams,'回補出場'))return false; } return true; }
function needsDataFetch(cur) { if (!cachedStockData || !lastFetchSettings) return true; return cur.stockNo !== lastFetchSettings.stockNo || cur.startDate !== lastFetchSettings.startDate || cur.endDate !== lastFetchSettings.endDate; }
function getMaxPeriod(params) { let maxP = 0; const checkParams = (paramObj) => { if (!paramObj) return; for (const key in paramObj) { if (key.toLowerCase().includes('period') && !key.toLowerCase().includes('signal')) { const value = parseFloat(paramObj[key]); if (!isNaN(value) && value > maxP) maxP = value; } else if (['shortperiod', 'longperiod', 'breakoutperiod', 'stoplossperiod'].includes(key.toLowerCase())) { const value = parseFloat(paramObj[key]); if (!isNaN(value) && value > maxP) maxP = value; } } }; checkParams(params.entryParams); checkParams(params.exitParams); if (params.enableShorting) { checkParams(params.shortEntryParams); checkParams(params.shortExitParams); } console.log("[getMaxPeriod] Found max period:", maxP); return maxP; }

function getSuggestion() {
    console.log("[Main] getSuggestion called");
    const suggestionArea = document.getElementById('today-suggestion-area');
    const suggestionText = document.getElementById('suggestion-text');
    if (!suggestionArea || !suggestionText) return;

    if (!cachedStockData || cachedStockData.length < 2) {
        suggestionText.textContent = "請先執行回測獲取數據";
        suggestionArea.className = 'my-4 p-4 bg-gray-100 border-l-4 border-gray-400 text-gray-600 rounded-md text-center';
        suggestionArea.classList.remove('hidden');
        return;
    }

    suggestionText.textContent = "計算中...";
    suggestionArea.classList.remove('hidden');
    suggestionArea.className = 'my-4 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 rounded-md text-center loading';

    if (!workerUrl || !backtestWorker) {
        console.warn("[Suggestion] Worker not ready or busy.");
        suggestionText.textContent = "引擎未就緒或忙碌中";
        suggestionArea.classList.remove('loading');
        suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        return;
    }

    try {
        const params = getBacktestParams();
        const maxPeriod = getMaxPeriod(params);
        const lookbackDays = Math.max(20, maxPeriod * 2);
        console.log(`[Main] Max Period: ${maxPeriod}, Lookback Days for Suggestion: ${lookbackDays}`);

        if (cachedStockData.length < lookbackDays) {
            suggestionText.textContent = `數據不足 (${cachedStockData.length} < ${lookbackDays})`;
            suggestionArea.classList.remove('loading');
            suggestionArea.classList.add('bg-yellow-100', 'border-yellow-500', 'text-yellow-800');
            console.warn(`[Suggestion] Insufficient cached data for lookback: ${cachedStockData.length} < ${lookbackDays}`);
            if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            return;
        }

        if (backtestWorker && workerUrl) {
            backtestWorker.postMessage({
                type: 'getSuggestion',
                params: params,
                lookbackDays: lookbackDays
            });
        } else {
            suggestionText.textContent = "回測引擎未就緒";
            suggestionArea.classList.remove('loading');
            suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        }

    } catch (error) {
        console.error("[Main] Error getting suggestion:", error);
        suggestionText.textContent = "計算建議時出錯";
        suggestionArea.classList.remove('loading');
        suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
    }
}

function initTabs() {
    console.log("[Main] Tab initialization - handled by HTML event listeners");
}

function initBatchOptimizationFeature() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.batchOptimization && window.batchOptimization.init) {
                window.batchOptimization.init();
            }
        });
    } else {
        if (window.batchOptimization && window.batchOptimization.init) {
            window.batchOptimization.init();
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Main] DOM loaded, initializing...');
    
    try {
        initDates();
        initTabs();
        
        setTimeout(() => {
            initBatchOptimizationFeature();
        }, 100);
        
        console.log('[Main] Initialization completed');
    } catch (error) {
        console.error('[Main] Initialization failed:', error);
    }
});

// --- Loader.js content ---
document.addEventListener('DOMContentLoaded', function() {
     console.log("[Loader] DOMContentLoaded event fired.");
     if (typeof workerUrl === 'undefined' || workerUrl === null) {
        workerUrl = 'js/worker.js';
        console.log("[Loader] Set workerUrl to:", workerUrl);
     }

    try {
        initDates();
        initTabs();
        if (typeof populateSavedStrategiesDropdown === 'function') {
            populateSavedStrategiesDropdown();
        } else {
            console.warn('[Loader] populateSavedStrategiesDropdown 尚未定義，略過初始化。');
        }

        document.getElementById('applyYearsBtn').addEventListener('click', applyRecentYears);
        document.getElementById('backtestBtn').addEventListener('click', runBacktestInternal);
        document.getElementById('optimizeEntryBtn').addEventListener('click', () => runOptimizationInternal('entry'));
        document.getElementById('optimizeExitBtn').addEventListener('click', () => runOptimizationInternal('exit'));
        document.getElementById('optimizeShortEntryBtn').addEventListener('click', () => runOptimizationInternal('shortEntry'));
        document.getElementById('optimizeShortExitBtn').addEventListener('click', () => runOptimizationInternal('shortExit'));
        document.getElementById('optimizeRiskBtn').addEventListener('click', () => runOptimizationInternal('risk'));
        document.getElementById('resetBtn').addEventListener('click', resetSettings);
        document.getElementById('randomizeBtn').addEventListener('click', randomizeSettings);
        document.getElementById('stockNo').addEventListener('keypress', e=>{if(e.key==='Enter')runBacktestInternal();});
        document.getElementById('stockNo').addEventListener('change', (e) => setDefaultFees(e.target.value));

        const entrySelect = document.getElementById('entryStrategy');
        const exitSelect = document.getElementById('exitStrategy');
        const shortEntrySelect = document.getElementById('shortEntryStrategy');
        const shortExitSelect = document.getElementById('shortExitStrategy');
        const shortCheckbox = document.getElementById('enableShortSelling');
        const shortArea = document.getElementById('short-strategy-area');

        const copyParams = (sourceType, targetType) => {
            const sourceParams = getStrategyParams(sourceType);
            if (!sourceParams || Object.keys(sourceParams).length === 0) {
                console.log(`[Param Copy] No params found for source ${sourceType}.`);
                return;
            }
            const targetParamsContainer = document.getElementById(`${targetType}Params`);
            if (!targetParamsContainer) {
                console.warn(`[Param Copy] Target container ${targetType}Params not found.`);
                return;
            }
            const targetSelectElement = document.getElementById(`${targetType}Strategy`);
            const targetStrategyKey = targetSelectElement ? targetSelectElement.value : null;
            let targetInternalKey = targetStrategyKey;

            if (targetType === 'shortEntry') {
                if (!strategyDescriptions[targetInternalKey] && ['ma_cross', 'ma_below', 'ema_cross'].includes(targetStrategyKey)) targetInternalKey = `short_${targetStrategyKey}`;
            } else if (targetType === 'shortExit') {
                if (!strategyDescriptions[targetInternalKey] && ['ma_cross', 'ma_above', 'ema_cross'].includes(targetStrategyKey)) targetInternalKey = `cover_${targetStrategyKey}`;
            } else if (targetType === 'exit' && ['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(targetStrategyKey)) {
                targetInternalKey = `${targetStrategyKey}_exit`;
            }
            console.log(`[Param Copy] Attempting to copy from ${sourceType} to ${targetType} (InternalKey: ${targetInternalKey})`);

            for (const pName in sourceParams) {
                const sourceValue = sourceParams[pName];
                let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1);
                if (targetInternalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY';
                else if (targetInternalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX';
                else if (targetInternalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod';
                else if (targetInternalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod';
                else if (targetInternalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod';
                else if (targetInternalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod';
                else if (targetInternalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage';
                else if (targetInternalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY';
                else if (targetInternalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX';
                else if ((targetInternalKey === 'macd_cross_exit' || targetInternalKey === 'macd_cross') && pName === 'signalPeriod') idSfx = 'SignalPeriod';
                else if (targetInternalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod';

                const targetId = `${targetType}${idSfx}`;
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    targetInput.value = sourceValue;
                } else {
                    console.warn(`[Param Copy] Target input not found for ${pName} in ${targetType}: #${targetId}`);
                }
            }
        };

        shortCheckbox.addEventListener('change', function() {
            shortArea.style.display = this.checked ? 'grid' : 'none';
            if (this.checked) {
                const longEntryVal = entrySelect.value;
                const longExitVal = exitSelect.value;
                const correspondingCoverVal = longEntryToCoverMap[longEntryVal];
                if (correspondingCoverVal && shortExitSelect.querySelector(`option[value="${correspondingCoverVal}"]`)) {
                    shortExitSelect.value = correspondingCoverVal;
                    updateStrategyParams('shortExit');
                    copyParams('entry', 'shortExit');
                    console.log(`[Auto Set] Short Exit set to ${correspondingCoverVal} and params copied from Long Entry.`);
                } else {
                    console.warn(`[Auto Set] No corresponding cover strategy found for ${longEntryVal}. Updating shortExit with defaults.`);
                    updateStrategyParams('shortExit');
                }
                const correspondingShortVal = longExitToShortMap[longExitVal];
                if (correspondingShortVal && shortEntrySelect.querySelector(`option[value="${correspondingShortVal}"]`)) {
                    shortEntrySelect.value = correspondingShortVal;
                    updateStrategyParams('shortEntry');
                    copyParams('exit', 'shortEntry');
                    console.log(`[Auto Set] Short Entry set to ${correspondingShortVal} and params copied from Long Exit.`);
                } else {
                    console.warn(`[Auto Set] No corresponding short strategy found for ${longExitVal}. Updating shortEntry with defaults.`);
                    updateStrategyParams('shortEntry');
                }
            }
        });

        entrySelect.addEventListener('change', () => updateStrategyParams('entry'));
        exitSelect.addEventListener('change', () => updateStrategyParams('exit'));
        shortEntrySelect.addEventListener('change', () => updateStrategyParams('shortEntry'));
        shortExitSelect.addEventListener('change', () => updateStrategyParams('shortExit'));

        document.getElementById('saveStrategyBtn').addEventListener('click', saveStrategy);
        document.getElementById('loadStrategyBtn').addEventListener('click', loadStrategy);
        document.getElementById('deleteStrategyBtn').addEventListener('click', deleteStrategy);

        setDefaultFees(document.getElementById('stockNo').value);
        updateStrategyParams('entry');
        updateStrategyParams('exit');
        updateStrategyParams('shortEntry');
        updateStrategyParams('shortExit');
        shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none';
        showInfo("請設定參數並執行。");
        console.log("[Main] Initial setup complete.");

    } catch (initError) {
        console.error("[Loader/Main Init] Error during initial setup:", initError);
        if(typeof showError === 'function') showError(`頁面初始化失敗: ${initError.message}`);
        else alert(`頁面初始化失敗: ${initError.message}`);
    }

     console.log("[Loader] Loader script finished.");
});