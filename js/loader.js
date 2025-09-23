// --- Loader Script ---
// Patch Tag: LB-EQUITY-SEGMENT-20250624B
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

        const applyYearsBtn = document.getElementById('applyYearsBtn');
        if (applyYearsBtn) applyYearsBtn.addEventListener('click', applyRecentYears);

        const backtestBtn = document.getElementById('backtestBtn');
        const stockInput = document.getElementById('stockNo');
        let activeRunBacktestHandler = null;

        const resolveRunBacktestHandler = () => {
            if (typeof runBacktestInternal === 'function') return runBacktestInternal;
            if (typeof window !== 'undefined' && typeof window.runBacktestInternal === 'function') {
                return window.runBacktestInternal;
            }
            return null;
        };

        const updateRunBacktestBinding = (candidate) => {
            if (typeof candidate === 'function') {
                activeRunBacktestHandler = candidate;
                console.log('[Loader] runBacktestInternal handler 已綁定。');
                return true;
            }
            return false;
        };

        const triggerRunBacktest = () => {
            if (typeof activeRunBacktestHandler === 'function') {
                activeRunBacktestHandler();
            } else {
                console.warn('[Loader] runBacktestInternal 尚未就緒，忽略本次觸發。');
            }
        };

        updateRunBacktestBinding(resolveRunBacktestHandler());

        if (typeof window !== 'undefined' && !activeRunBacktestHandler) {
            window.addEventListener('lazybacktest:runBacktestReady', (event) => {
                if (!updateRunBacktestBinding(event?.detail?.handler)) {
                    updateRunBacktestBinding(resolveRunBacktestHandler());
                }
            }, { once: true });
        }

        if (backtestBtn) backtestBtn.addEventListener('click', triggerRunBacktest);
        if (stockInput) {
            stockInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerRunBacktest();
                }
            });
            stockInput.addEventListener('change', (e) => setDefaultFees(e.target.value));
        }

        const optimizeEntryBtn = document.getElementById('optimizeEntryBtn');
        if (optimizeEntryBtn) optimizeEntryBtn.addEventListener('click', () => runOptimizationInternal('entry'));
        const optimizeExitBtn = document.getElementById('optimizeExitBtn');
        if (optimizeExitBtn) optimizeExitBtn.addEventListener('click', () => runOptimizationInternal('exit'));
        const optimizeShortEntryBtn = document.getElementById('optimizeShortEntryBtn');
        if (optimizeShortEntryBtn) optimizeShortEntryBtn.addEventListener('click', () => runOptimizationInternal('shortEntry'));
        const optimizeShortExitBtn = document.getElementById('optimizeShortExitBtn');
        if (optimizeShortExitBtn) optimizeShortExitBtn.addEventListener('click', () => runOptimizationInternal('shortExit'));
        const optimizeRiskBtn = document.getElementById('optimizeRiskBtn');
        if (optimizeRiskBtn) optimizeRiskBtn.addEventListener('click', () => runOptimizationInternal('risk'));
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetSettings);
        const randomizeBtn = document.getElementById('randomizeBtn');
        if (randomizeBtn) randomizeBtn.addEventListener('click', randomizeSettings);

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