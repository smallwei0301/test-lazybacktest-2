// --- Loader Script ---
document.addEventListener('DOMContentLoaded', function() {
     console.log("[Loader] DOMContentLoaded event fired.");
     if (typeof workerUrl === 'undefined' || workerUrl === null) {
        workerUrl = 'js/worker.js';
        console.log("[Loader] Set workerUrl to:", workerUrl);
     }

    if (typeof StrategyPluginRegistry !== 'undefined' && typeof StrategyPluginRegistry.listStrategies === 'function') {
        try {
            const manifest = StrategyPluginRegistry.listStrategies();
            window.lazybacktestStrategyManifest = manifest;
            console.log('[Loader] 策略清單暖身完成:', manifest.map((item) => item.id).join(', '));
        } catch (manifestError) {
            console.error('[Loader] 讀取策略清單失敗', manifestError);
        }
    } else {
        console.warn('[Loader] StrategyPluginRegistry.listStrategies 尚未就緒，略過策略清單暖身。');
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
        // Patch Tag: LB-INDEX-UI-20250727A
        const quickRunBacktestBtn = document.getElementById('quickRunBacktestBtn');
        if (quickRunBacktestBtn) {
            quickRunBacktestBtn.addEventListener('click', runBacktestInternal);
        }
        document.getElementById('optimizeEntryBtn').addEventListener('click', () => runOptimizationInternal('entry'));
        document.getElementById('optimizeExitBtn').addEventListener('click', () => runOptimizationInternal('exit'));
        document.getElementById('optimizeShortEntryBtn').addEventListener('click', () => runOptimizationInternal('shortEntry'));
        document.getElementById('optimizeShortExitBtn').addEventListener('click', () => runOptimizationInternal('shortExit'));
        document.getElementById('optimizeRiskBtn').addEventListener('click', () => runOptimizationInternal('risk'));
        const stagingOptimizeBtn = document.getElementById('stagingOptimizationBtn');
        if (stagingOptimizeBtn) {
            stagingOptimizeBtn.addEventListener('click', runStagingOptimization);
        }
        const applyStagingBtn = document.getElementById('applyStagingOptimizationBtn');
        if (applyStagingBtn) {
            applyStagingBtn.addEventListener('click', applyBestStagingRecommendation);
        }
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
            const normalizedTargetKey = typeof normalizeStrategyId === 'function'
                ? normalizeStrategyId(targetType, targetStrategyKey)
                : targetStrategyKey;
            let targetInternalKey = normalizedTargetKey && strategyDescriptions[normalizedTargetKey]
                ? normalizedTargetKey
                : targetStrategyKey;

            if (!strategyDescriptions[targetInternalKey] && targetStrategyKey) {
                if (normalizedTargetKey && strategyDescriptions[normalizedTargetKey]) {
                    targetInternalKey = normalizedTargetKey;
                } else if (targetType === 'shortEntry') {
                    const legacyShortKey = `short_${targetStrategyKey}`;
                    if (strategyDescriptions[legacyShortKey]) {
                        targetInternalKey = legacyShortKey;
                    }
                } else if (targetType === 'shortExit') {
                    const legacyCoverKey = `cover_${targetStrategyKey}`;
                    if (strategyDescriptions[legacyCoverKey]) {
                        targetInternalKey = legacyCoverKey;
                    }
                } else if (targetType === 'exit') {
                    const legacyExitKey = `${targetStrategyKey}_exit`;
                    if (strategyDescriptions[legacyExitKey]) {
                        targetInternalKey = legacyExitKey;
                    }
                }
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
                else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod';
                else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage';
                else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY';
                else if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX';
                else if ((internalKey === 'macd_cross_exit' || internalKey === 'macd_cross') && pName === 'signalPeriod') idSfx = 'SignalPeriod';
                else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod';

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