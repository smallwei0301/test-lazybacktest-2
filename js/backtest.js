
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
            workerMsg.cachedData = cachedStockData; // Send main thread cache to worker
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

// ... (The rest of the file from the user's provided text, followed by the new function)

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
