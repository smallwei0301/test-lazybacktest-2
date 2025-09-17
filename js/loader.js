// --- Loader Script ---
document.addEventListener('DOMContentLoaded', function() {
     console.log("[Loader] DOMContentLoaded event fired.");
     const workerScriptElement = document.getElementById('backtest-worker'); // This ID might need to change if we are no longer using an inline script tag for the worker
     console.log("[Loader] Found worker element (by ID 'backtest-worker'):", workerScriptElement ? 'Yes' : 'No');

     // If worker.js is now a separate file, we directly use its path for the Worker constructor.
     // The original logic of creating a Blob URL from an inline script is no longer needed
     // if the worker code is in 'js/worker.js'.

     // Assuming workerUrl should point to the path of the worker.js file
     // This global variable `workerUrl` is expected by `main.js` or `backtest.js`.
     // We need to ensure it's correctly assigned.
     // A simple approach is to hardcode it if the structure is fixed.
     // Or, it could be passed via a data attribute in the HTML script tag that loads this loader.
     // For now, let's assume worker.js is in the same js/ directory.
     if (typeof workerUrl === 'undefined' || workerUrl === null) {
        // Attempt to set a default path if not already defined (e.g. by an inline script in HTML)
        // This part needs careful consideration on how workerUrl is actually being set/used.
        // If main.js/backtest.js directly instantiates new Worker('js/worker.js'), then this
        // global workerUrl might not be strictly necessary for the Worker creation itself,
        // but it is used in showLoading checks.
        // For the purpose of this refactoring, we'll ensure workerUrl is set.
        // The original HTML had a script tag with ID "backtest-worker" which was read.
        // Now that it's a file, the logic in main.js/backtest.js that uses `new Worker(workerUrl)`
        // will need `workerUrl` to be the path to `js/worker.js`.

        // Let's assume the main HTML will define workerUrl or the main scripts will handle it.
        // This loader's original purpose was to create a Blob URL.
        // If we are no longer doing that, this loader's role changes.

        // If the intention is that `main.js` or `backtest.js` uses a global `workerUrl`,
        // then this loader (or an inline script in HTML) must define it.
        // Let's set it here for clarity, assuming `js/worker.js` is the path.
        workerUrl = 'js/worker.js'; // Path to the external worker file
        console.log("[Loader] Set workerUrl to:", workerUrl);
     }


     // The following part of the original loader script was for creating a Blob from inline script.
     // This is no longer needed if worker.js is a separate file.
     /*
     if (workerScriptElement) {
         try {
             const workerScript = workerScriptElement.textContent || "";
             console.log("[Loader] Worker script content length:", workerScript?.length);
             if (!workerScript || workerScript.trim() === '') {
                 console.error("[Loader] Worker script content is empty!");
                 throw new Error("Worker 腳本內容缺失。");
             }
             const blob = new Blob([workerScript], { type: 'application/javascript' });
             console.log("[Loader] Blob created:", blob);
             workerUrl = URL.createObjectURL(blob); // Assign to global workerUrl
             console.log("[Loader] Web Worker Blob URL created successfully:", workerUrl);
         } catch (e) {
              console.error("[Loader] 創建 Worker Blob URL 失敗:", e);
              if(typeof showError === 'function') showError("無法初始化背景計算引擎：" + e.message + "。請檢查控制台(F12)以獲取詳細資訊，可能與瀏覽器安全設置(CSP)有關。");
              else alert("無法初始化背景計算引擎：" + e.message);
              // 禁用所有操作按鈕
              ['backtestBtn', 'optimizeEntryBtn', 'optimizeExitBtn', 'optimizeShortEntryBtn', 'optimizeShortExitBtn', 'optimizeRiskBtn', 'randomizeBtn'].forEach(id => { const btn = document.getElementById(id); if(btn) btn.disabled = true; });
         }
     } else {
         // This case should ideally not happen if workerUrl is set directly to the path.
         // However, if some logic still relies on finding 'backtest-worker' element,
         // it indicates a mismatch in refactoring approach.
         console.error("[Loader] 無法找到 ID 為 'backtest-worker' 的 Worker 腳本元素！ (This might be OK if workerUrl is set directly)");
         // if(typeof showError === 'function') showError("無法初始化背景計算引擎，請檢查網頁代碼結構。");
         // else alert("無法初始化背景計算引擎，請檢查網頁代碼結構。");
         // ['backtestBtn', 'optimizeEntryBtn', 'optimizeExitBtn', 'optimizeShortEntryBtn', 'optimizeShortExitBtn', 'optimizeRiskBtn', 'randomizeBtn'].forEach(id => { const btn = document.getElementById(id); if(btn) btn.disabled = true; });
     }
     */

    // Call initialization functions that are now in main.js or backtest.js
    // These were originally in the DOMContentLoaded of the main script.
    // We need to ensure they are called after all scripts are loaded.
    // This might be better handled by placing these calls at the end of backtest.js
    // or by ensuring this loader script is the last one.

    try {

        initDates();
        initTabs(); // This function is in backtest.js
        if (typeof populateSavedStrategiesDropdown === 'function') {
            populateSavedStrategiesDropdown(); // This function is in backtest.js
        } else {
            console.warn('[Loader] populateSavedStrategiesDropdown 尚未定義，略過初始化。');
        }

        // Event Listeners from the original main script's DOMContentLoaded
        document.getElementById('applyYearsBtn').addEventListener('click', applyRecentYears); // in main.js
        document.getElementById('backtestBtn').addEventListener('click', runBacktestInternal); // in backtest.js
        document.getElementById('optimizeEntryBtn').addEventListener('click', () => runOptimizationInternal('entry')); // in backtest.js
        document.getElementById('optimizeExitBtn').addEventListener('click', () => runOptimizationInternal('exit')); // in backtest.js
        document.getElementById('optimizeShortEntryBtn').addEventListener('click', () => runOptimizationInternal('shortEntry')); // in backtest.js
        document.getElementById('optimizeShortExitBtn').addEventListener('click', () => runOptimizationInternal('shortExit')); // in backtest.js
        document.getElementById('optimizeRiskBtn').addEventListener('click', () => runOptimizationInternal('risk')); // in backtest.js
        document.getElementById('resetBtn').addEventListener('click', resetSettings); // in backtest.js
        document.getElementById('randomizeBtn').addEventListener('click', randomizeSettings); // in backtest.js
        document.getElementById('stockNo').addEventListener('keypress', e=>{if(e.key==='Enter')runBacktestInternal();});
        document.getElementById('stockNo').addEventListener('change', (e) => setDefaultFees(e.target.value)); // in backtest.js

        const entrySelect = document.getElementById('entryStrategy');
        const exitSelect = document.getElementById('exitStrategy');
        const shortEntrySelect = document.getElementById('shortEntryStrategy');
        const shortExitSelect = document.getElementById('shortExitStrategy');
        const shortCheckbox = document.getElementById('enableShortSelling');
        const shortArea = document.getElementById('short-strategy-area');

        const copyParams = (sourceType, targetType) => {
            const sourceParams = getStrategyParams(sourceType); // in main.js
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
                // This complex ID suffix logic should ideally be centralized or simplified if possible
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

                const targetId = `${targetType}${idSfx}`; // Corrected: was `${type}${idSfx}` which is undefined
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
                    updateStrategyParams('shortExit'); // in backtest.js
                    copyParams('entry', 'shortExit');
                    console.log(`[Auto Set] Short Exit set to ${correspondingCoverVal} and params copied from Long Entry.`);
                } else {
                    console.warn(`[Auto Set] No corresponding cover strategy found for ${longEntryVal}. Updating shortExit with defaults.`);
                    updateStrategyParams('shortExit');
                }
                const correspondingShortVal = longExitToShortMap[longExitVal];
                if (correspondingShortVal && shortEntrySelect.querySelector(`option[value="${correspondingShortVal}"]`)) {
                    shortEntrySelect.value = correspondingShortVal;
                    updateStrategyParams('shortEntry'); // in backtest.js
                    copyParams('exit', 'shortEntry');
                    console.log(`[Auto Set] Short Entry set to ${correspondingShortVal} and params copied from Long Exit.`);
                } else {
                    console.warn(`[Auto Set] No corresponding short strategy found for ${longExitVal}. Updating shortEntry with defaults.`);
                    updateStrategyParams('shortEntry');
                }
            }
        });

        entrySelect.addEventListener('change', () => updateStrategyParams('entry')); // in backtest.js
        exitSelect.addEventListener('change', () => updateStrategyParams('exit')); // in backtest.js
        shortEntrySelect.addEventListener('change', () => updateStrategyParams('shortEntry')); // in backtest.js
        shortExitSelect.addEventListener('change', () => updateStrategyParams('shortExit')); // in backtest.js

        document.getElementById('saveStrategyBtn').addEventListener('click', saveStrategy); // in backtest.js
        document.getElementById('loadStrategyBtn').addEventListener('click', loadStrategy); // in backtest.js
        document.getElementById('deleteStrategyBtn').addEventListener('click', deleteStrategy); // in backtest.js

        setDefaultFees(document.getElementById('stockNo').value); // in backtest.js
        updateStrategyParams('entry');
        updateStrategyParams('exit');
        updateStrategyParams('shortEntry');
        updateStrategyParams('shortExit');
        shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none';
        showInfo("請設定參數並執行。"); // in main.js
        console.log("[Main] Initial setup complete.");

    } catch (initError) {
        console.error("[Loader/Main Init] Error during initial setup:", initError);
        if(typeof showError === 'function') showError(`頁面初始化失敗: ${initError.message}`);
        else alert(`頁面初始化失敗: ${initError.message}`);
    }

     console.log("[Loader] Loader script finished.");
});