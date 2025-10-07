// --- 滾動測試模組 - v1.2 ---
// Patch Tag: LB-ROLLING-AUTOTUNE-20260115A
/* global getBacktestParams, cachedStockData, cachedDataStore, buildCacheKey, lastDatasetDiagnostics, lastOverallResult, lastFetchSettings, computeCoverageFromRows, formatDate, workerUrl, showError, showInfo, strategyDescriptions */

(function() {
    const state = {
        initialized: false,
        running: false,
        cancelled: false,
        windows: [],
        results: [],
        config: null,
        startTime: null,
        progress: {
            totalSteps: 0,
            currentStep: 0,
            windowIndex: 0,
            stage: '',
        },
        version: 'LB-ROLLING-AUTOTUNE-20260115A',
    };

    const DEFAULT_THRESHOLDS = {
        annualizedReturn: 8,
        sharpeRatio: 1,
        sortinoRatio: 1.2,
        maxDrawdown: 25,
        winRate: 45,
    };

    const SCORE_WEIGHTS = {
        annualizedReturn: 0.35,
        sharpeRatio: 0.3,
        sortinoRatio: 0.2,
        maxDrawdown: 0.1,
        winRate: 0.05,
    };

    const AUTO_TUNE_DEFAULTS = {
        metric: 'annualizedReturn',
        scope: 'entry',
        maxCombinations: 60,
    };

    const AUTO_TUNE_METRIC_LABELS = {
        annualizedReturn: '年化報酬率',
        sharpeRatio: 'Sharpe Ratio',
        sortinoRatio: 'Sortino Ratio',
        winRate: '勝率',
        maxDrawdown: '最大回撤',
    };

    const AUTO_TUNE_SCOPE_CONFIG = {
        entry: { label: '進場策略', strategyKey: 'entryStrategy', paramsKey: 'entryParams', requiresShort: false },
        exit: { label: '出場策略', strategyKey: 'exitStrategy', paramsKey: 'exitParams', requiresShort: false },
        shortEntry: { label: '做空進場', strategyKey: 'shortEntryStrategy', paramsKey: 'shortEntryParams', requiresShort: true },
        shortExit: { label: '做空回補', strategyKey: 'shortExitStrategy', paramsKey: 'shortExitParams', requiresShort: true },
    };

    const AUTO_TUNE_MINIMIZE_METRICS = new Set(['maxDrawdown']);

    function initRollingTest() {
        if (state.initialized) return;
        const tab = document.getElementById('rolling-test-tab');
        if (!tab) return;

        const inputs = tab.querySelectorAll('[data-rolling-input]');
        inputs.forEach((input) => {
            ['change', 'input'].forEach((evt) => {
                input.addEventListener(evt, () => updateRollingPlanPreview());
            });
        });

        const autoTuneToggle = document.getElementById('rolling-autotune-toggle');
        if (autoTuneToggle) {
            autoTuneToggle.addEventListener('change', () => {
                handleAutoTuneToggleChange();
                updateRollingPlanPreview();
            });
        }

        const startBtn = document.getElementById('start-rolling-test');
        const stopBtn = document.getElementById('stop-rolling-test');
        if (startBtn) startBtn.addEventListener('click', startRollingTest);
        if (stopBtn) stopBtn.addEventListener('click', stopRollingTest);

        refreshAutoTuneScopeOptions();
        handleAutoTuneToggleChange();
        updateRollingPlanPreview();
        state.initialized = true;
    }

    function startRollingTest(event) {
        if (event) event.preventDefault();
        if (state.running) return;

        const config = getRollingConfig();
        const cachedRows = ensureRollingCacheHydrated();
        const availability = getCachedAvailability(cachedRows);
        const windows = computeRollingWindows(config, availability);

        if (!Array.isArray(cachedRows) || cachedRows.length === 0) {
            setPlanWarning(true);
            setAlert('請先在主畫面執行一次完整回測，以建立快取資料後再啟動滾動測試。', 'error');
            showError?.('滾動測試需要可用的回測快取資料，請先執行一次回測');
            return;
        }

        if (!windows || windows.length === 0) {
            setAlert('目前設定無法建立有效的 Walk-Forward 視窗，請調整視窗長度或日期區間。', 'warning');
            showInfo?.('請調整滾動測試設定，例如延長日期區間或縮短視窗長度');
            return;
        }

        state.running = true;
        state.cancelled = false;
        state.config = config;
        state.windows = windows;
        state.results = [];
        state.startTime = Date.now();
        state.progress.totalSteps = windows.length * 2; // 訓練 + 測試
        state.progress.currentStep = 0;
        state.progress.windowIndex = 0;
        state.progress.stage = '';

        toggleRollingControls(true);
        clearRollingReport();
        ensureProgressPanelVisible(true);
        setAlert('系統已開始滾動測試，請保持頁面開啟。', 'info');
        updateProgressUI();

        runRollingSequence().catch((error) => {
            console.error('[Rolling Test] Unexpected error:', error);
            showError?.(`滾動測試失敗：${error?.message || error}`);
            setAlert(`滾動測試失敗：${error?.message || '未知錯誤'}`, 'error');
        }).finally(() => {
            finalizeRollingRun();
        });
    }

    function stopRollingTest(event) {
        if (event) event.preventDefault();
        if (!state.running || state.cancelled) return;
        state.cancelled = true;
        const stopBtn = document.getElementById('stop-rolling-test');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.classList.add('opacity-60', 'cursor-not-allowed');
        }
        setAlert('已送出停止指令，系統會在目前視窗結束後停止。', 'warning');
    }

    async function runRollingSequence() {
        const baseParams = typeof getBacktestParams === 'function' ? getBacktestParams() : null;
        if (!baseParams) throw new Error('無法取得回測參數，請重新整理頁面');

        for (let i = 0; i < state.windows.length; i += 1) {
            if (state.cancelled) break;
            const win = state.windows[i];
            state.progress.windowIndex = i + 1;

            const windowBaseParams = deepClone(baseParams);
            let paramsForTesting = windowBaseParams;
            let trainingResult = null;
            let autoTuneMeta = null;

            if (state.config?.autoTune?.enabled) {
                let autoOutcome = null;
                try {
                    autoOutcome = await performAutoTuneForWindow(windowBaseParams, win, i);
                } catch (error) {
                    console.warn('[Rolling AutoTune] 執行訓練優化失敗：', error);
                    autoOutcome = { error: error?.message || '訓練優化失敗' };
                }

                if (state.cancelled) break;

                if (autoOutcome?.trainingResult) {
                    trainingResult = autoOutcome.trainingResult;
                    paramsForTesting = autoOutcome.bestParams || windowBaseParams;
                    state.progress.stage = '訓練期優化';
                    state.progress.currentStep += 1;
                    updateProgressUI(`視窗 ${i + 1}/${state.windows.length} · 訓練期優化完成`);
                } else {
                    state.progress.stage = '訓練期';
                    try {
                        trainingResult = await runSingleWindow(windowBaseParams, win.trainingStart, win.trainingEnd, {
                            phase: '訓練期',
                            windowIndex: i + 1,
                            totalWindows: state.windows.length,
                        });
                    } catch (error) {
                        console.warn('[Rolling Test] Training window failed:', error);
                        trainingResult = { error: error?.message || '訓練期回測失敗' };
                    }
                }

                autoTuneMeta = buildAutoTuneMeta(autoOutcome, state.config.autoTune);
            } else {
                state.progress.stage = '訓練期';
                try {
                    trainingResult = await runSingleWindow(windowBaseParams, win.trainingStart, win.trainingEnd, {
                        phase: '訓練期',
                        windowIndex: i + 1,
                        totalWindows: state.windows.length,
                    });
                } catch (error) {
                    console.warn('[Rolling Test] Training window failed:', error);
                    trainingResult = { error: error?.message || '訓練期回測失敗' };
                }
            }

            if (state.cancelled) break;

            let testingResult = null;
            try {
                state.progress.stage = '測試期';
                testingResult = await runSingleWindow(paramsForTesting, win.testingStart, win.testingEnd, {
                    phase: '測試期',
                    windowIndex: i + 1,
                    totalWindows: state.windows.length,
                });
            } catch (error) {
                console.warn('[Rolling Test] Testing window failed:', error);
                testingResult = { error: error?.message || '測試期回測失敗' };
            }

            state.results.push({
                window: win,
                training: trainingResult,
                testing: testingResult,
                autoTune: autoTuneMeta,
            });
        }
    }

    function buildAutoTuneMeta(outcome, config) {
        if (!config?.enabled) return null;
        if (!outcome) {
            return {
                enabled: true,
                scope: config.scope,
                metric: config.metric,
                error: '未執行訓練優化',
                combosTested: 0,
                totalCandidates: null,
                bestParamValues: null,
                summary: null,
            };
        }
        return {
            enabled: true,
            scope: outcome.scope || config.scope,
            metric: outcome.metric || config.metric,
            error: outcome.error || null,
            combosTested: Number.isFinite(outcome.combosTested) ? outcome.combosTested : 0,
            totalCandidates: Number.isFinite(outcome.totalCandidates) ? outcome.totalCandidates : null,
            bestParamValues: outcome.bestParamValues || null,
            summary: outcome.summary || null,
        };
    }

    async function performAutoTuneForWindow(baseParams, windowDef, index) {
        const autoConfig = state.config?.autoTune;
        if (!autoConfig?.enabled) return null;

        const scope = autoConfig.scope || AUTO_TUNE_DEFAULTS.scope;
        const metric = autoConfig.metric || AUTO_TUNE_DEFAULTS.metric;
        const scopeConfig = AUTO_TUNE_SCOPE_CONFIG[scope];
        if (!scopeConfig) {
            return { error: '未支援的優化範圍', scope, metric, combosTested: 0 };
        }
        if (scopeConfig.requiresShort && !baseParams?.enableShorting) {
            return { error: '尚未啟用做空策略', scope, metric, combosTested: 0 };
        }

        const strategyKey = baseParams?.[scopeConfig.strategyKey];
        if (!strategyKey) {
            return { error: '尚未選擇策略', scope, metric, combosTested: 0 };
        }

        const strategyMeta = strategyDescriptions?.[strategyKey];
        if (!strategyMeta || !Array.isArray(strategyMeta.optimizeTargets) || strategyMeta.optimizeTargets.length === 0) {
            return { error: '該策略無可優化參數', scope, metric, combosTested: 0 };
        }

        const plan = buildAutoTunePlan(strategyMeta.optimizeTargets, baseParams?.[scopeConfig.paramsKey] || {}, autoConfig.maxCombinations);
        if (!plan || plan.combinations.length === 0) {
            return {
                error: '無可用的參數組合',
                scope,
                metric,
                combosTested: 0,
                totalCandidates: plan?.totalCandidates || 0,
            };
        }

        const combos = plan.combinations;
        const totalCandidates = plan.totalCandidates;
        let best = null;
        let bestParams = null;
        let evaluated = 0;

        for (let idx = 0; idx < combos.length; idx += 1) {
            if (state.cancelled) break;
            const combo = combos[idx];
            state.progress.stage = '訓練期優化';
            updateProgressUI(`視窗 ${index + 1}/${state.windows.length} · 訓練期優化（${idx + 1}/${combos.length}）`);
            const candidateParams = applyAutoTuneParams(baseParams, scope, combo);
            let outcome = null;
            try {
                outcome = await runSingleWindow(candidateParams, windowDef.trainingStart, windowDef.trainingEnd, {
                    phase: '訓練期優化',
                    windowIndex: index + 1,
                    totalWindows: state.windows.length,
                }, { countTowardsProgress: false, suppressStageUpdate: true });
            } catch (error) {
                console.warn('[Rolling AutoTune] 測試參數組合失敗：', combo, error);
                continue;
            }
            if (!outcome) continue;
            evaluated += 1;

            const metrics = extractMetrics(outcome);
            const score = computeAutoTuneScore(metrics, metric);
            if (score === null) continue;

            if (!best || isAutoTuneCandidateBetter({ score, metrics }, best, metric)) {
                best = { score, metrics, outcome, combo };
                bestParams = candidateParams;
            }
        }

        if (state.cancelled) {
            return { scope, metric, combosTested: evaluated, totalCandidates };
        }

        if (!best) {
            return {
                error: evaluated === 0 ? '無法取得有效的訓練結果' : '未找到符合目標的組合',
                scope,
                metric,
                combosTested: evaluated,
                totalCandidates,
            };
        }

        return {
            trainingResult: best.outcome,
            bestParams,
            bestParamValues: best.combo,
            combosTested: evaluated,
            totalCandidates,
            metric,
            scope,
            summary: buildAutoTuneSummary(metric, best.metrics, best.combo, evaluated, totalCandidates, strategyMeta),
        };
    }

    function buildAutoTunePlan(targets, baseValues, maxCombinations) {
        if (!Array.isArray(targets) || targets.length === 0) return null;
        const validTargets = targets.filter((target) => target && target.name && target.range);
        if (validTargets.length === 0) return null;
        const safeMaxCombinations = Math.max(5, Math.min(Number(maxCombinations) || AUTO_TUNE_DEFAULTS.maxCombinations, 200));
        const limitPerParam = Math.max(3, Math.floor(Math.pow(safeMaxCombinations, 1 / validTargets.length)) + 1);
        const sweeps = [];
        let totalCandidates = 1;

        validTargets.forEach((target) => {
            const values = buildAutoTuneValues(target.range, baseValues?.[target.name], limitPerParam);
            if (values.length > 0) {
                sweeps.push({
                    name: target.name,
                    label: target.label || target.name,
                    values,
                });
                totalCandidates *= values.length;
            }
        });

        if (sweeps.length === 0) return null;
        const combinations = enumerateAutoTuneCombinations(sweeps, safeMaxCombinations);
        return { sweeps, combinations, totalCandidates };
    }

    function buildAutoTuneValues(range, baseValue, limit) {
        if (!range) return [];
        const min = Math.min(range.from, range.to);
        const max = Math.max(range.from, range.to);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
            const single = Number.isFinite(baseValue) ? Number(baseValue) : min;
            return Number.isFinite(single) ? [Number(single)] : [];
        }
        const rawStep = Number.isFinite(range.step) && range.step > 0 ? range.step : (max - min) / Math.max(limit - 1, 1);
        const precision = inferStepPrecision(rawStep);
        const values = [];
        for (let value = min; value <= max + rawStep / 2; value += rawStep) {
            values.push(normalizeCandidateValue(value, precision));
        }
        const unique = Array.from(new Set(values.filter((val) => Number.isFinite(val)))).sort((a, b) => a - b);
        if (unique.length === 0) return [];

        const result = [];
        const baseNormalized = Number.isFinite(baseValue) ? normalizeCandidateValue(baseValue, precision) : null;
        if (baseNormalized !== null && baseNormalized >= unique[0] && baseNormalized <= unique[unique.length - 1]) {
            result.push(baseNormalized);
        }
        result.push(unique[0]);
        if (unique.length > 1) {
            result.push(unique[unique.length - 1]);
        }

        const stepCount = unique.length;
        for (let i = 0; i < stepCount && result.length < limit; i += 1) {
            const ratio = stepCount === 1 ? 0 : i / (stepCount - 1);
            const index = Math.min(stepCount - 1, Math.round(ratio * (stepCount - 1)));
            result.push(unique[index]);
        }

        const finalValues = Array.from(new Set(result.filter((val) => Number.isFinite(val)))).sort((a, b) => a - b);
        if (baseNormalized !== null) {
            const baseIndex = finalValues.indexOf(baseNormalized);
            if (baseIndex > 0) {
                finalValues.splice(baseIndex, 1);
                finalValues.unshift(baseNormalized);
            }
        }
        return finalValues.slice(0, limit);
    }

    function enumerateAutoTuneCombinations(sweeps, maxCombinations) {
        const limit = Math.max(1, Math.min(Number(maxCombinations) || AUTO_TUNE_DEFAULTS.maxCombinations, 500));
        const combinations = [];
        const seen = new Set();

        function dfs(depth, current) {
            if (combinations.length >= limit) return;
            if (depth >= sweeps.length) {
                const combo = {};
                sweeps.forEach((sweep) => {
                    combo[sweep.name] = current[sweep.name];
                });
                const key = JSON.stringify(combo);
                if (!seen.has(key)) {
                    combinations.push(combo);
                    seen.add(key);
                }
                return;
            }
            const sweep = sweeps[depth];
            for (let idx = 0; idx < sweep.values.length; idx += 1) {
                current[sweep.name] = sweep.values[idx];
                dfs(depth + 1, current);
                if (combinations.length >= limit) break;
            }
        }

        dfs(0, {});
        return combinations;
    }

    function applyAutoTuneParams(baseParams, scope, values) {
        const scopeConfig = AUTO_TUNE_SCOPE_CONFIG[scope];
        if (!scopeConfig) return deepClone(baseParams || {});
        const clone = deepClone(baseParams || {});
        if (scopeConfig.requiresShort) {
            clone.enableShorting = true;
        }
        const targetKey = scopeConfig.paramsKey;
        const original = clone[targetKey] && typeof clone[targetKey] === 'object' ? clone[targetKey] : {};
        const nextParams = { ...original };
        Object.entries(values || {}).forEach(([key, value]) => {
            nextParams[key] = Number.isFinite(value) ? Number(value) : value;
        });
        clone[targetKey] = nextParams;
        return clone;
    }

    function computeAutoTuneScore(metrics, metric) {
        if (!metrics || !metric) return null;
        const value = metrics[metric];
        if (!Number.isFinite(value)) return null;
        if (AUTO_TUNE_MINIMIZE_METRICS.has(metric)) {
            return -value;
        }
        return value;
    }

    function isAutoTuneCandidateBetter(candidate, current, metric) {
        if (!current) return true;
        if (candidate.score > current.score) return true;
        if (candidate.score < current.score) return false;
        const candidateMetrics = candidate.metrics || {};
        const currentMetrics = current.metrics || {};
        const candidateDrawdown = candidateMetrics.maxDrawdown;
        const currentDrawdown = currentMetrics.maxDrawdown;
        if (Number.isFinite(candidateDrawdown) && Number.isFinite(currentDrawdown) && candidateDrawdown !== currentDrawdown) {
            return candidateDrawdown < currentDrawdown;
        }
        const candidateSharpe = candidateMetrics.sharpeRatio;
        const currentSharpe = currentMetrics.sharpeRatio;
        if (Number.isFinite(candidateSharpe) && Number.isFinite(currentSharpe) && candidateSharpe !== currentSharpe) {
            return candidateSharpe > currentSharpe;
        }
        if (metric !== 'annualizedReturn') {
            const candidateReturn = candidateMetrics.annualizedReturn;
            const currentReturn = currentMetrics.annualizedReturn;
            if (Number.isFinite(candidateReturn) && Number.isFinite(currentReturn) && candidateReturn !== currentReturn) {
                return candidateReturn > currentReturn;
            }
        }
        return false;
    }

    function buildAutoTuneSummary(metric, metrics, combo, tested, totalCandidates, strategyMeta) {
        const parts = [];
        const metricLabel = AUTO_TUNE_METRIC_LABELS[metric] || metric;
        const metricValue = metrics ? metrics[metric] : null;
        const formattedMetric = formatAutoTuneMetric(metric, metricValue);
        if (formattedMetric) {
            parts.push(`最佳${metricLabel}：${formattedMetric}`);
        }
        if (Number.isFinite(tested)) {
            if (Number.isFinite(totalCandidates) && totalCandidates > tested) {
                parts.push(`掃描 ${tested}/${totalCandidates} 組`);
            } else {
                parts.push(`掃描 ${tested} 組`);
            }
        }
        const paramSummary = formatAutoTuneParams(combo, strategyMeta);
        if (paramSummary) {
            parts.push(`參數 ${paramSummary}`);
        }
        return parts.join('；');
    }

    function formatAutoTuneMetric(metric, value) {
        if (!Number.isFinite(value)) return null;
        if (metric === 'annualizedReturn' || metric === 'winRate' || metric === 'maxDrawdown') {
            return formatPercent(value);
        }
        if (metric === 'sharpeRatio' || metric === 'sortinoRatio') {
            return formatNumber(value);
        }
        return value.toFixed(2);
    }

    function formatAutoTuneParams(combo, strategyMeta) {
        if (!combo) return '';
        const entries = Object.entries(combo);
        if (entries.length === 0) return '';
        const labelMap = new Map();
        if (strategyMeta && Array.isArray(strategyMeta.optimizeTargets)) {
            strategyMeta.optimizeTargets.forEach((target) => {
                if (target?.name) {
                    labelMap.set(target.name, target.label || target.name);
                }
            });
        }
        return entries
            .map(([key, value]) => {
                const label = labelMap.get(key) || key;
                return `${label}=${formatAutoTuneParamValue(value)}`;
            })
            .join('、');
    }

    function formatAutoTuneParamValue(value) {
        if (!Number.isFinite(value)) return value;
        const rounded = Math.round(value);
        if (Math.abs(rounded - value) < 1e-6) {
            return rounded.toString();
        }
        return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
    }

    function inferStepPrecision(step) {
        if (!Number.isFinite(step) || step <= 0) return 4;
        const stepStr = step.toString();
        if (stepStr.includes('e-')) {
            const [, exponent] = stepStr.split('e-');
            const digits = parseInt(exponent, 10);
            return Number.isFinite(digits) ? Math.min(digits + 1, 6) : 4;
        }
        const decimals = stepStr.split('.')[1];
        if (!decimals) return 2;
        return Math.min(decimals.length + 1, 6);
    }

    function normalizeCandidateValue(value, precision) {
        if (!Number.isFinite(value)) return value;
        const digits = Number.isFinite(precision) ? precision : 4;
        const factor = 10 ** Math.min(Math.max(digits, 0), 6);
        return Math.round(value * factor) / factor;
    }

    function finalizeRollingRun() {
        toggleRollingControls(false);
        state.running = false;
        ensureProgressPanelVisible(state.results.length > 0);
        if (state.cancelled) {
            setAlert('滾動測試已中止，可重新調整參數後再試。', 'warning');
        } else if (state.results.length > 0) {
            setAlert('滾動測試完成，以下提供綜合評分與逐窗細節。', 'success');
        }
        renderRollingReport();
        updateRollingPlanPreview();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function toggleRollingControls(running) {
        const startBtn = document.getElementById('start-rolling-test');
        const stopBtn = document.getElementById('stop-rolling-test');
        if (startBtn) {
            startBtn.disabled = running;
            startBtn.classList.toggle('opacity-60', running);
            startBtn.classList.toggle('cursor-not-allowed', running);
        }
        if (stopBtn) {
            if (running) {
                stopBtn.classList.remove('hidden');
                stopBtn.disabled = false;
                stopBtn.classList.remove('opacity-60', 'cursor-not-allowed');
            } else {
                stopBtn.classList.add('hidden');
            }
        }
    }

    function ensureProgressPanelVisible(visible) {
        const panel = document.getElementById('rolling-progress-panel');
        if (!panel) return;
        if (visible) panel.classList.remove('hidden');
        else panel.classList.add('hidden');
    }

    function updateProgressUI(message) {
        const percentEl = document.getElementById('rolling-progress-percent');
        const barEl = document.getElementById('rolling-progress-bar');
        const textEl = document.getElementById('rolling-progress-text');
        const phaseEl = document.getElementById('rolling-progress-phase');
        const elapsedEl = document.getElementById('rolling-progress-elapsed');
        const etaEl = document.getElementById('rolling-progress-eta');

        const { currentStep, totalSteps, stage, windowIndex } = state.progress;
        const percent = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;

        if (percentEl) percentEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
        if (textEl) textEl.textContent = message || `共 ${totalSteps} 個階段，已完成 ${currentStep}`;
        if (phaseEl) phaseEl.textContent = stage ? `第 ${windowIndex}/${state.windows.length} 視窗 · ${stage}` : '尚未開始';

        const elapsedMs = state.startTime ? Date.now() - state.startTime : 0;
        if (elapsedEl) {
            if (elapsedMs > 0) {
                elapsedEl.textContent = `已耗時 ${formatDuration(elapsedMs)}`;
                elapsedEl.classList.remove('hidden');
            } else {
                elapsedEl.classList.add('hidden');
            }
        }

        const stepsCompleted = Math.max(currentStep, 1);
        const avgStepTime = stepsCompleted > 0 ? elapsedMs / stepsCompleted : 0;
        const remainingSteps = Math.max(totalSteps - currentStep, 0);
        const etaMs = avgStepTime * remainingSteps;
        if (etaEl) {
            if (etaMs > 0 && totalSteps > 0 && currentStep < totalSteps) {
                etaEl.textContent = `預估還需 ${formatDuration(etaMs)}`;
                etaEl.classList.remove('hidden');
            } else {
                etaEl.classList.add('hidden');
            }
        }
    }

    function setAlert(message, tone = 'info') {
        const alertEl = document.getElementById('rolling-progress-alert');
        if (!alertEl) return;
        if (!message) {
            alertEl.classList.add('hidden');
            return;
        }

        const palette = {
            success: {
                color: 'var(--primary)',
                border: 'color-mix(in srgb, var(--primary) 40%, transparent)',
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            },
            warning: {
                color: 'var(--accent)',
                border: 'color-mix(in srgb, var(--accent) 45%, transparent)',
                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            },
            error: {
                color: 'var(--destructive)',
                border: 'color-mix(in srgb, var(--destructive) 45%, transparent)',
                background: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
            },
            info: {
                color: 'var(--foreground)',
                border: 'color-mix(in srgb, var(--muted) 40%, transparent)',
                background: 'color-mix(in srgb, var(--muted) 12%, transparent)',
            },
        };
        const paletteEntry = palette[tone] || palette.info;
        alertEl.textContent = message;
        alertEl.style.color = paletteEntry.color;
        alertEl.style.borderColor = paletteEntry.border;
        alertEl.style.backgroundColor = paletteEntry.background;
        alertEl.classList.remove('hidden');
    }

    function clearRollingReport() {
        const report = document.getElementById('rolling-test-report');
        if (report) report.classList.add('hidden');
        const scoreboard = document.getElementById('rolling-scoreboard');
        if (scoreboard) scoreboard.innerHTML = '';
        const table = document.getElementById('rolling-window-report');
        if (table) table.innerHTML = '';
        const summary = document.getElementById('rolling-score-summary');
        if (summary) summary.textContent = '';
        const intro = document.getElementById('rolling-report-intro');
        if (intro) intro.textContent = '';
    }

    function renderRollingReport() {
        if (!state.results || state.results.length === 0) {
            clearRollingReport();
            return;
        }

        const analysisEntries = state.results.map((entry, index) => ({
            index,
            window: entry.window,
            training: extractMetrics(entry.training),
            testing: extractMetrics(entry.testing),
            rawTraining: entry.training,
            rawTesting: entry.testing,
            autoTune: entry.autoTune || null,
        }));

        const aggregate = computeAggregateReport(analysisEntries, state.config?.thresholds || DEFAULT_THRESHOLDS, state.config?.minTrades || 0);

        const report = document.getElementById('rolling-test-report');
        const intro = document.getElementById('rolling-report-intro');
        if (intro) {
            intro.textContent = `共完成 ${aggregate.totalWindows} 個 Walk-Forward 視窗（訓練 ${state.config.trainingMonths} 個月 / 測試 ${state.config.testingMonths} 個月 / 平移 ${state.config.stepMonths} 個月）`;
        }
        if (report) report.classList.remove('hidden');

        renderScoreboard(aggregate);
        renderWindowTable(aggregate);
        const summary = document.getElementById('rolling-score-summary');
        if (summary) {
            summary.textContent = aggregate.summaryText;
        }
    }

    function renderScoreboard(aggregate) {
        const scoreboard = document.getElementById('rolling-scoreboard');
        if (!scoreboard) return;
        scoreboard.innerHTML = '';

        const cards = [
            {
                title: 'Walk-Forward 評分',
                value: `${aggregate.score} 分`,
                accent: aggregate.gradeColor,
                description: `${aggregate.gradeLabel} · ${aggregate.passCount}/${aggregate.totalWindows} 視窗符合門檻`,
            },
            {
                title: '平均年化報酬 (OOS)',
                value: formatPercent(aggregate.averageAnnualizedReturn),
                description: 'Out-of-Sample 平均年化報酬率',
            },
            {
                title: 'Sharpe / Sortino 中位數',
                value: `${formatNumber(aggregate.medianSharpe)} / ${formatNumber(aggregate.medianSortino)}`,
                description: 'Sharpe 與 Sortino 比率中位數',
            },
            {
                title: '通過視窗比例',
                value: formatPercent(aggregate.passRate),
                description: `共有 ${aggregate.passCount} 個視窗達標，勝率門檻 ${aggregate.thresholds.winRate}%`,
            },
        ];

        cards.forEach((card) => {
            const el = document.createElement('div');
            el.className = 'p-4 border rounded-lg shadow-sm flex flex-col gap-1';
            el.style.borderColor = 'var(--border)';
            el.style.background = 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 4%, transparent) 0%, var(--background) 100%)';

            const title = document.createElement('div');
            title.textContent = card.title;
            title.className = 'text-xs font-medium';
            title.style.color = 'var(--muted-foreground)';

            const value = document.createElement('div');
            value.textContent = card.value || '—';
            value.className = 'text-xl font-semibold';
            value.style.color = card.accent || 'var(--foreground)';

            const desc = document.createElement('div');
            desc.textContent = card.description || '';
            desc.className = 'text-[11px]';
            desc.style.color = 'var(--muted-foreground)';

            el.appendChild(title);
            el.appendChild(value);
            el.appendChild(desc);
            scoreboard.appendChild(el);
        });
    }

    function renderWindowTable(aggregate) {
        const tbody = document.getElementById('rolling-window-report');
        if (!tbody) return;
        tbody.innerHTML = '';

        aggregate.evaluations.forEach((entry) => {
            const tr = document.createElement('tr');
            tr.innerHTML = [
                `<td class="px-3 py-2">${entry.index + 1}</td>`,
                `<td class="px-3 py-2">${entry.window.testingStart} ~ ${entry.window.testingEnd}</td>`,
                `<td class="px-3 py-2 text-right ${entry.metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatPercent(entry.metrics.annualizedReturn)}</td>`,
                `<td class="px-3 py-2 text-right">${formatNumber(entry.metrics.sharpeRatio)}</td>`,
                `<td class="px-3 py-2 text-right">${formatNumber(entry.metrics.sortinoRatio)}</td>`,
                `<td class="px-3 py-2 text-right">${formatPercent(entry.metrics.maxDrawdown)}</td>`,
                `<td class="px-3 py-2 text-right">${formatPercent(entry.metrics.winRate)}</td>`,
                `<td class="px-3 py-2 text-right">${Number.isFinite(entry.metrics.tradesCount) ? entry.metrics.tradesCount : '—'}</td>`,
                `<td class="px-3 py-2 text-left">${entry.comment}</td>`,
            ].join('');
            tbody.appendChild(tr);
        });
    }

    function computeAggregateReport(entries, thresholds, minTrades) {
        const evaluations = entries.map((entry) => {
            const evaluation = evaluateWindow(entry.testing, thresholds, minTrades);
            const commentParts = [];
            if (entry.testing.error) {
                commentParts.push(entry.testing.error);
            } else {
                if (evaluation.pass) {
                    commentParts.push('✓ 通過門檻');
                } else if (evaluation.reasons.length > 0) {
                    commentParts.push(evaluation.reasons.join('、'));
                }
                if (Number.isFinite(entry.training.annualizedReturn) && Number.isFinite(entry.testing.annualizedReturn)) {
                    commentParts.push(`訓練 ${formatPercent(entry.training.annualizedReturn)} → 測試 ${formatPercent(entry.testing.annualizedReturn)}`);
                }
                if (!Number.isFinite(entry.testing.tradesCount) || entry.testing.tradesCount < minTrades) {
                    commentParts.push(`交易樣本 ${entry.testing.tradesCount || 0} 筆`);
                }
            }
            if (entry.autoTune) {
                if (entry.autoTune.summary) {
                    commentParts.push(`優化：${entry.autoTune.summary}`);
                } else if (entry.autoTune.error) {
                    commentParts.push(`優化失敗：${entry.autoTune.error}`);
                }
            }
            return {
                index: entry.index,
                window: entry.window,
                metrics: entry.testing,
                evaluation,
                comment: commentParts.join('；') || '—',
            };
        });

        const validMetrics = evaluations
            .map((ev) => ev.metrics)
            .filter((metrics) => metrics && !metrics.error);

        const averageAnnualizedReturn = average(validMetrics.map((m) => m.annualizedReturn));
        const averageSharpe = average(validMetrics.map((m) => m.sharpeRatio));
        const averageSortino = average(validMetrics.map((m) => m.sortinoRatio));
        const averageMaxDrawdown = average(validMetrics.map((m) => m.maxDrawdown));
        const medianSharpe = median(validMetrics.map((m) => m.sharpeRatio));
        const medianSortino = median(validMetrics.map((m) => m.sortinoRatio));
        const passCount = evaluations.filter((ev) => ev.evaluation.pass).length;
        const passRate = evaluations.length > 0 ? (passCount / evaluations.length) * 100 : 0;
        const score = computeCompositeScore(validMetrics, thresholds);
        const gradeInfo = resolveGrade(score, passRate, passCount, evaluations.length);

        const summaryText = buildSummaryText({
            gradeLabel: gradeInfo.label,
            score,
            passCount,
            total: evaluations.length,
            averageAnnualizedReturn,
            medianSharpe,
            medianSortino,
            averageMaxDrawdown,
            thresholds,
        });

        return {
            evaluations,
            score,
            passCount,
            passRate,
            totalWindows: evaluations.length,
            gradeLabel: gradeInfo.label,
            gradeColor: gradeInfo.color,
            summaryText,
            averageAnnualizedReturn,
            averageSharpe,
            averageSortino,
            averageMaxDrawdown,
            medianSharpe,
            medianSortino,
            thresholds,
        };
    }

    function buildSummaryText(context) {
        const parts = [];
        parts.push(`${context.gradeLabel} · Walk-Forward 評分 ${context.score} 分`);
        parts.push(`平均年化報酬 ${formatPercent(context.averageAnnualizedReturn)}，Sharpe 中位數 ${formatNumber(context.medianSharpe)}，Sortino 中位數 ${formatNumber(context.medianSortino)}`);
        parts.push(`共有 ${context.passCount}/${context.total} 視窗符合門檻（Sharpe ≥ ${context.thresholds.sharpeRatio}、Sortino ≥ ${context.thresholds.sortinoRatio}、MaxDD ≤ ${formatPercent(context.thresholds.maxDrawdown)}、勝率 ≥ ${context.thresholds.winRate}%）`);
        return parts.join('；');
    }

    function computeCompositeScore(metricsList, thresholds) {
        if (!Array.isArray(metricsList) || metricsList.length === 0) return 0;
        let weightedScore = 0;
        let weightSum = 0;

        metricsList.forEach((metrics) => {
            if (!metrics || metrics.error) return;
            if (Number.isFinite(metrics.annualizedReturn)) {
                weightedScore += SCORE_WEIGHTS.annualizedReturn * normalisePositive(metrics.annualizedReturn, thresholds.annualizedReturn, 2);
                weightSum += SCORE_WEIGHTS.annualizedReturn;
            }
            if (Number.isFinite(metrics.sharpeRatio)) {
                weightedScore += SCORE_WEIGHTS.sharpeRatio * normalisePositive(metrics.sharpeRatio, thresholds.sharpeRatio, 2);
                weightSum += SCORE_WEIGHTS.sharpeRatio;
            }
            if (Number.isFinite(metrics.sortinoRatio)) {
                weightedScore += SCORE_WEIGHTS.sortinoRatio * normalisePositive(metrics.sortinoRatio, thresholds.sortinoRatio, 2.5);
                weightSum += SCORE_WEIGHTS.sortinoRatio;
            }
            if (Number.isFinite(metrics.maxDrawdown)) {
                weightedScore += SCORE_WEIGHTS.maxDrawdown * normaliseInverse(metrics.maxDrawdown, thresholds.maxDrawdown, 2);
                weightSum += SCORE_WEIGHTS.maxDrawdown;
            }
            if (Number.isFinite(metrics.winRate)) {
                weightedScore += SCORE_WEIGHTS.winRate * normalisePositive(metrics.winRate, thresholds.winRate, 2);
                weightSum += SCORE_WEIGHTS.winRate;
            }
        });

        if (weightSum === 0) return 0;
        const normalized = Math.min(100, Math.max(0, (weightedScore / weightSum) * 100));
        return Math.round(normalized);
    }

    function resolveGrade(score, passRate, passCount, total) {
        if (total === 0) {
            return { label: '尚無結果', color: 'var(--muted-foreground)' };
        }
        if (score >= 85 && passRate >= 70) {
            return { label: '專業合格', color: 'var(--primary)' };
        }
        if (score >= 70 && passRate >= 50) {
            return { label: '可進一步驗證', color: 'var(--accent)' };
        }
        if (score >= 55) {
            return { label: '需要調整', color: 'var(--muted-foreground)' };
        }
        return { label: '未通過', color: 'var(--destructive)' };
    }

    function evaluateWindow(metrics, thresholds, minTrades) {
        const reasons = [];
        if (!metrics || metrics.error) {
            reasons.push(metrics?.error || '無法取得結果');
            return { pass: false, reasons };
        }

        const checks = [];
        if (Number.isFinite(metrics.annualizedReturn)) {
            const pass = metrics.annualizedReturn >= thresholds.annualizedReturn;
            if (!pass) reasons.push(`年化報酬低於 ${thresholds.annualizedReturn}%`);
            checks.push(pass);
        }
        if (Number.isFinite(metrics.sharpeRatio)) {
            const pass = metrics.sharpeRatio >= thresholds.sharpeRatio;
            if (!pass) reasons.push(`Sharpe < ${thresholds.sharpeRatio}`);
            checks.push(pass);
        }
        if (Number.isFinite(metrics.sortinoRatio)) {
            const pass = metrics.sortinoRatio >= thresholds.sortinoRatio;
            if (!pass) reasons.push(`Sortino < ${thresholds.sortinoRatio}`);
            checks.push(pass);
        }
        if (Number.isFinite(metrics.maxDrawdown)) {
            const pass = metrics.maxDrawdown <= thresholds.maxDrawdown;
            if (!pass) reasons.push(`最大回撤高於 ${formatPercent(thresholds.maxDrawdown)}`);
            checks.push(pass);
        }
        if (Number.isFinite(metrics.winRate)) {
            const pass = metrics.winRate >= thresholds.winRate;
            if (!pass) reasons.push(`勝率低於 ${thresholds.winRate}%`);
            checks.push(pass);
        }
        if (Number.isFinite(minTrades) && minTrades > 0) {
            if (!Number.isFinite(metrics.tradesCount) || metrics.tradesCount < minTrades) {
                reasons.push(`交易樣本低於 ${minTrades} 筆`);
                checks.push(false);
            }
        }

        const pass = checks.length > 0 ? checks.every(Boolean) : false;
        return { pass, reasons };
    }

    function extractMetrics(result) {
        if (!result || result.error) {
            return { error: result?.error || '無效結果' };
        }
        const tradesCount = Number.isFinite(result.tradesCount)
            ? result.tradesCount
            : Array.isArray(result.completedTrades)
                ? result.completedTrades.length
                : null;
        let winRate = Number.isFinite(result.winRate) ? result.winRate : null;
        if (!Number.isFinite(winRate) && Array.isArray(result.completedTrades) && tradesCount) {
            const wins = result.completedTrades.filter((trade) => Number.isFinite(trade?.profit) && trade.profit > 0).length;
            winRate = wins / tradesCount * 100;
        }
        return {
            annualizedReturn: toFiniteNumber(result.annualizedReturn),
            sharpeRatio: toFiniteNumber(result.sharpeRatio),
            sortinoRatio: toFiniteNumber(result.sortinoRatio),
            maxDrawdown: toFiniteNumber(result.maxDrawdown),
            winRate: toFiniteNumber(winRate),
            tradesCount: Number.isFinite(tradesCount) ? tradesCount : null,
        };
    }

    function toFiniteNumber(value) {
        return Number.isFinite(value) ? Number(value) : null;
    }

    function normalisePositive(value, baseline, cap = 2) {
        if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return 0;
        return Math.min(cap, Math.max(0, value / baseline));
    }

    function normaliseInverse(value, baseline, cap = 2) {
        if (!Number.isFinite(value) || !Number.isFinite(baseline) || value <= 0) return 0;
        return Math.min(cap, Math.max(0, baseline / value));
    }

    function average(values) {
        const filtered = values.filter((v) => Number.isFinite(v));
        if (filtered.length === 0) return null;
        const sum = filtered.reduce((acc, v) => acc + v, 0);
        return sum / filtered.length;
    }

    function median(values) {
        const filtered = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
        if (filtered.length === 0) return null;
        const mid = Math.floor(filtered.length / 2);
        if (filtered.length % 2 === 0) {
            return (filtered[mid - 1] + filtered[mid]) / 2;
        }
        return filtered[mid];
    }

    function computeRollingWindows(config, availability) {
        if (!config || !config.baseStart || !config.baseEnd) return [];
        if (!availability) return [];

        const windows = [];
        const startDate = new Date(Math.max(new Date(config.baseStart).getTime(), new Date(availability.start).getTime()));
        const finalDate = new Date(Math.min(new Date(config.baseEnd).getTime(), new Date(availability.end).getTime()));

        let currentTrainStart = startDate;
        while (currentTrainStart < finalDate) {
            const trainingEnd = addDays(addMonthsClamped(currentTrainStart, config.trainingMonths), -1);
            const testingStart = addDays(trainingEnd, 1);
            const testingEnd = addDays(addMonthsClamped(testingStart, config.testingMonths), -1);

            if (testingEnd > finalDate) break;

            windows.push({
                trainingStart: formatISODate(currentTrainStart),
                trainingEnd: formatISODate(trainingEnd),
                testingStart: formatISODate(testingStart),
                testingEnd: formatISODate(testingEnd),
            });

            currentTrainStart = addMonthsClamped(currentTrainStart, config.stepMonths);
            if (!currentTrainStart || currentTrainStart >= finalDate) break;
        }

        return windows;
    }

    function runSingleWindow(baseParams, startIso, endIso, context, options = {}) {
        const countTowardsProgress = options.countTowardsProgress !== false;
        const suppressStageUpdate = Boolean(options.suppressStageUpdate);
        return new Promise((resolve, reject) => {
            try {
                const payload = prepareWorkerPayload(baseParams, startIso, endIso);
                if (!payload) {
                    reject(new Error('無法準備回測參數'));
                    return;
                }
                if (!suppressStageUpdate) {
                    state.progress.stage = context?.phase || '';
                    updateProgressUI(`視窗 ${context?.windowIndex}/${context?.totalWindows} · ${context?.phase || ''}`);
                }

                const worker = new Worker(workerUrl);
                const message = {
                    type: 'runBacktest',
                    params: payload.params,
                    dataStartDate: payload.dataStartDate,
                    effectiveStartDate: payload.effectiveStartDate,
                    lookbackDays: payload.lookbackDays,
                    useCachedData: Array.isArray(cachedStockData) && cachedStockData.length > 0,
                    cachedData: Array.isArray(cachedStockData) ? cachedStockData : null,
                    cachedMeta: buildCachedMeta(),
                };

                worker.onmessage = (event) => {
                    const { type, data, result, message: progressMessage } = event.data;
                    if (type === 'progress') {
                        if (progressMessage) {
                            updateProgressUI(progressMessage);
                        }
                        return;
                    }
                    if (type === 'result' || type === 'backtest_result') {
                        if (countTowardsProgress) {
                            state.progress.currentStep += 1;
                        }
                        if (!suppressStageUpdate) {
                            state.progress.stage = context?.phase || '';
                        }
                        updateProgressUI();
                        worker.terminate();
                        resolve(type === 'result' ? data : result);
                        return;
                    }
                    if (type === 'error' || type === 'marketError') {
                        if (countTowardsProgress) {
                            state.progress.currentStep += 1;
                        }
                        if (!suppressStageUpdate) {
                            state.progress.stage = context?.phase || '';
                        }
                        updateProgressUI();
                        worker.terminate();
                        reject(new Error(event.data?.message || '回測失敗'));
                    }
                };

                worker.onerror = (error) => {
                    if (countTowardsProgress) {
                        state.progress.currentStep += 1;
                    }
                    if (!suppressStageUpdate) {
                        state.progress.stage = context?.phase || '';
                    }
                    updateProgressUI();
                    worker.terminate();
                    reject(error instanceof Error ? error : new Error(error.message || 'Worker 錯誤'));
                };

                worker.postMessage(message);
            } catch (error) {
                reject(error);
            }
        });
    }

    function prepareWorkerPayload(baseParams, startIso, endIso) {
        if (!baseParams || !startIso || !endIso) return null;
        const clone = deepClone(baseParams);
        clone.startDate = startIso;
        clone.endDate = endIso;
        if ('recentYears' in clone) delete clone.recentYears;

        const enriched = enrichParamsWithLookback(clone);
        return {
            params: enriched,
            dataStartDate: enriched.dataStartDate || enriched.startDate,
            effectiveStartDate: enriched.effectiveStartDate || enriched.startDate,
            lookbackDays: Number.isFinite(enriched.lookbackDays) ? enriched.lookbackDays : null,
        };
    }

    function buildCachedMeta() {
        const dataDebug = lastOverallResult?.dataDebug || {};
        const coverage = typeof computeCoverageFromRows === 'function' && Array.isArray(cachedStockData)
            ? computeCoverageFromRows(cachedStockData)
            : null;
        return {
            summary: dataDebug.summary || null,
            adjustments: Array.isArray(dataDebug.adjustments) ? dataDebug.adjustments : [],
            debugSteps: Array.isArray(dataDebug.debugSteps) ? dataDebug.debugSteps : [],
            adjustmentFallbackApplied: Boolean(dataDebug.adjustmentFallbackApplied),
            priceSource: dataDebug.priceSource || null,
            dataSource: dataDebug.dataSource || null,
            splitDiagnostics: dataDebug.splitDiagnostics || null,
            diagnostics: lastDatasetDiagnostics || null,
            coverage,
            fetchRange: dataDebug.fetchRange || null,
        };
    }

    function enrichParamsWithLookback(params) {
        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        if (!sharedUtils) return { ...params };
        const windowOptions = {
            minBars: 90,
            multiplier: 2,
            marginTradingDays: 12,
            extraCalendarDays: 7,
            minDate: sharedUtils?.MIN_DATA_DATE,
            defaultStartDate: params.startDate,
        };
        let windowDecision = null;
        if (typeof sharedUtils.resolveDataWindow === 'function') {
            windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
        }
        const fallbackMaxPeriod = typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;
        let lookbackDays = Number.isFinite(windowDecision?.lookbackDays)
            ? windowDecision.lookbackDays
            : null;
        if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && typeof sharedUtils.resolveLookbackDays === 'function') {
            const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
            if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                lookbackDays = fallbackDecision.lookbackDays;
                if (!windowDecision) windowDecision = fallbackDecision;
            }
        }
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = typeof sharedUtils.estimateLookbackBars === 'function'
                ? sharedUtils.estimateLookbackBars(fallbackMaxPeriod, { minBars: 90, multiplier: 2 })
                : Math.max(90, fallbackMaxPeriod * 2);
        }
        const effectiveStartDate = windowDecision?.effectiveStartDate
            || params.effectiveStartDate
            || params.startDate
            || windowDecision?.minDataDate
            || params.startDate;
        let dataStartDate = windowDecision?.dataStartDate || params.dataStartDate || null;
        if (!dataStartDate && effectiveStartDate && typeof sharedUtils.computeBufferedStartDate === 'function') {
            dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                minDate: sharedUtils?.MIN_DATA_DATE,
                marginTradingDays: windowDecision?.bufferTradingDays || windowOptions.marginTradingDays,
                extraCalendarDays: windowDecision?.extraCalendarDays || windowOptions.extraCalendarDays,
            }) || effectiveStartDate;
        }
        return {
            ...params,
            lookbackDays,
            effectiveStartDate,
            dataStartDate: dataStartDate || effectiveStartDate || params.startDate,
        };
    }

    function deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            console.warn('[Rolling Test] JSON clone failed, returning shallow copy.');
            return { ...obj };
        }
    }

    function getRollingConfig() {
        const trainingMonths = clampNumber(readInputValue('rolling-training-months', 36), 6, 120);
        const testingMonths = clampNumber(readInputValue('rolling-testing-months', 12), 3, 36);
        const stepMonths = clampNumber(readInputValue('rolling-step-months', 6), 1, 24);
        const minTrades = clampNumber(readInputValue('rolling-min-trades', 10), 0, 1000);
        const thresholds = {
            annualizedReturn: clampNumber(readInputValue('rolling-threshold-ann', DEFAULT_THRESHOLDS.annualizedReturn), 0, 200),
            sharpeRatio: clampNumber(readInputValue('rolling-threshold-sharpe', DEFAULT_THRESHOLDS.sharpeRatio), 0, 10),
            sortinoRatio: clampNumber(readInputValue('rolling-threshold-sortino', DEFAULT_THRESHOLDS.sortinoRatio), 0, 10),
            maxDrawdown: clampNumber(readInputValue('rolling-threshold-maxdd', DEFAULT_THRESHOLDS.maxDrawdown), 1, 100),
            winRate: clampNumber(readInputValue('rolling-threshold-win', DEFAULT_THRESHOLDS.winRate), 0, 100),
        };
        const params = typeof getBacktestParams === 'function' ? getBacktestParams() : null;
        const autoTuneScope = document.getElementById('rolling-autotune-scope')?.value || AUTO_TUNE_DEFAULTS.scope;
        const autoTuneMetric = document.getElementById('rolling-autotune-metric')?.value || AUTO_TUNE_DEFAULTS.metric;
        const autoTuneMax = clampNumber(readInputValue('rolling-autotune-max', AUTO_TUNE_DEFAULTS.maxCombinations), 5, 200);
        const toggle = document.getElementById('rolling-autotune-toggle');
        const autoTuneEnabled = Boolean(toggle?.checked);
        const scopeAvailable = autoTuneEnabled && isAutoTuneScopeAvailable(params, autoTuneScope);
        return {
            trainingMonths,
            testingMonths,
            stepMonths,
            minTrades,
            thresholds,
            baseStart: params?.startDate || lastFetchSettings?.startDate || null,
            baseEnd: params?.endDate || lastFetchSettings?.endDate || null,
            autoTune: {
                enabled: scopeAvailable,
                scope: autoTuneScope,
                metric: autoTuneMetric,
                maxCombinations: autoTuneMax,
            },
        };
    }

    function readInputValue(id, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const parsed = parseFloat(el.value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clampNumber(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.min(Math.max(value, min), max);
    }

    function handleAutoTuneToggleChange() {
        const toggle = document.getElementById('rolling-autotune-toggle');
        const scopeSelect = document.getElementById('rolling-autotune-scope');
        const metricSelect = document.getElementById('rolling-autotune-metric');
        const maxInput = document.getElementById('rolling-autotune-max');
        const scopeAvailable = scopeSelect && Array.from(scopeSelect.options || []).some((opt) => !opt.disabled);
        if (toggle && !scopeAvailable) {
            toggle.checked = false;
        }
        const enabled = Boolean(toggle?.checked) && scopeAvailable;
        [scopeSelect, metricSelect, maxInput].forEach((el) => {
            if (el) el.disabled = !enabled;
        });
    }

    function refreshAutoTuneScopeOptions() {
        const scopeSelect = document.getElementById('rolling-autotune-scope');
        const toggle = document.getElementById('rolling-autotune-toggle');
        const metricSelect = document.getElementById('rolling-autotune-metric');
        const maxInput = document.getElementById('rolling-autotune-max');
        if (!scopeSelect || !toggle) return;

        const previousValue = scopeSelect.value;
        let baseParams = null;
        try {
            baseParams = typeof getBacktestParams === 'function' ? getBacktestParams() : null;
        } catch (error) {
            console.warn('[Rolling AutoTune] 無法取得回測參數以刷新可用範圍：', error);
        }

        scopeSelect.innerHTML = '';
        let firstEnabledValue = null;
        Object.entries(AUTO_TUNE_SCOPE_CONFIG).forEach(([value, meta]) => {
            const option = document.createElement('option');
            option.value = value;
            const available = isAutoTuneScopeAvailable(baseParams, value);
            option.disabled = !available;
            option.textContent = available ? meta.label : `${meta.label}（不可用）`;
            scopeSelect.appendChild(option);
            if (available && firstEnabledValue === null) {
                firstEnabledValue = value;
            }
        });

        let nextValue = previousValue;
        if (!Array.from(scopeSelect.options).some((opt) => opt.value === previousValue && !opt.disabled)) {
            nextValue = firstEnabledValue || '';
        }
        if (nextValue) {
            scopeSelect.value = nextValue;
        } else {
            scopeSelect.selectedIndex = -1;
        }

        const hasAvailable = Boolean(firstEnabledValue);
        toggle.disabled = !hasAvailable;
        if (!hasAvailable) {
            toggle.checked = false;
            [scopeSelect, metricSelect, maxInput].forEach((el) => {
                if (el) el.disabled = true;
            });
        }
    }

    function isAutoTuneScopeAvailable(baseParams, scope) {
        const scopeConfig = AUTO_TUNE_SCOPE_CONFIG[scope];
        if (!scopeConfig) return false;
        if (scopeConfig.requiresShort && !baseParams?.enableShorting) return false;
        const strategyKey = baseParams?.[scopeConfig.strategyKey];
        if (!strategyKey) return false;
        const strategyMeta = strategyDescriptions?.[strategyKey];
        return Boolean(strategyMeta && Array.isArray(strategyMeta.optimizeTargets) && strategyMeta.optimizeTargets.length > 0);
    }

    function updateRollingPlanPreview() {
        refreshAutoTuneScopeOptions();
        handleAutoTuneToggleChange();
        const cachedRows = ensureRollingCacheHydrated();
        const availability = getCachedAvailability(cachedRows);
        const config = getRollingConfig();
        const windows = computeRollingWindows(config, availability);

        const summaryEl = document.getElementById('rolling-plan-summary');
        const rangeEl = document.getElementById('rolling-plan-range');
        const tbody = document.getElementById('rolling-plan-tbody');

        if (rangeEl) {
            if (availability) {
                rangeEl.textContent = `可用資料範圍：${availability.start} ~ ${availability.end}`;
            } else {
                rangeEl.textContent = '尚未建立快取資料，請先執行回測。';
            }
        }

        if (tbody) tbody.innerHTML = '';

        if (!availability || !Array.isArray(cachedRows) || cachedRows.length === 0) {
            setPlanWarning(true);
            if (summaryEl) summaryEl.textContent = '尚未取得快取資料，請先執行一次主回測。';
            return;
        }

        setPlanWarning(false);
        if (!windows || windows.length === 0) {
            if (summaryEl) summaryEl.textContent = '目前設定下無法產生有效視窗，請調整視窗長度或日期區間。';
            return;
        }

        if (summaryEl) {
            summaryEl.textContent = `共 ${windows.length} 個視窗（訓練 ${config.trainingMonths} 個月 / 測試 ${config.testingMonths} 個月 / 平移 ${config.stepMonths} 個月）`;
        }

        if (tbody) {
            windows.forEach((win, index) => {
                const tr = document.createElement('tr');
                const tradingDays = countTradingDays(win.testingStart, win.testingEnd, cachedRows);
                tr.innerHTML = [
                    `<td class="px-3 py-2">${index + 1}</td>`,
                    `<td class="px-3 py-2">${win.trainingStart} ~ ${win.trainingEnd}</td>`,
                    `<td class="px-3 py-2">${win.testingStart} ~ ${win.testingEnd}</td>`,
                    `<td class="px-3 py-2">${tradingDays}</td>`,
                ].join('');
                tbody.appendChild(tr);
            });
        }
    }

    function setPlanWarning(visible) {
        const warningEl = document.getElementById('rolling-plan-warning');
        if (!warningEl) return;
        if (visible) warningEl.classList.remove('hidden');
        else warningEl.classList.add('hidden');
    }

    function countTradingDays(startIso, endIso, rowsOverride) {
        const rows = Array.isArray(rowsOverride) ? rowsOverride : ensureRollingCacheHydrated();
        if (!Array.isArray(rows) || rows.length === 0) return 0;
        return rows.reduce((count, row) => {
            if (!row || !row.date) return count;
            if (row.date >= startIso && row.date <= endIso) return count + 1;
            return count;
        }, 0);
    }

    function getCachedAvailability(rowsOverride) {
        const rows = Array.isArray(rowsOverride) ? rowsOverride : ensureRollingCacheHydrated();
        if (Array.isArray(rows) && rows.length > 0) {
            const first = rows[0]?.date;
            const last = rows[rows.length - 1]?.date;
            if (first && last) {
                return { start: first, end: last };
            }
        }

        const entry = getLastCacheEntry();
        if (entry && Array.isArray(entry.coverage) && entry.coverage.length > 0) {
            const firstSeg = entry.coverage[0];
            const lastSeg = entry.coverage[entry.coverage.length - 1];
            if (firstSeg && lastSeg && (firstSeg.start || firstSeg.end) && (lastSeg.start || lastSeg.end)) {
                return {
                    start: firstSeg.start || firstSeg.end,
                    end: lastSeg.end || lastSeg.start,
                };
            }
        }

        const diagnosticsCoverage = lastDatasetDiagnostics?.coverage;
        if (Array.isArray(diagnosticsCoverage) && diagnosticsCoverage.length > 0) {
            const firstSeg = diagnosticsCoverage[0];
            const lastSeg = diagnosticsCoverage[diagnosticsCoverage.length - 1];
            if (firstSeg && lastSeg && (firstSeg.start || firstSeg.end) && (lastSeg.start || lastSeg.end)) {
                return {
                    start: firstSeg.start || firstSeg.end,
                    end: lastSeg.end || lastSeg.start,
                };
            }
        }

        return null;
    }

    function ensureRollingCacheHydrated() {
        if (typeof cachedStockData !== 'undefined' && Array.isArray(cachedStockData) && cachedStockData.length > 0) {
            return cachedStockData;
        }

        const entry = getLastCacheEntry();
        if (!entry) return null;

        const candidateArrays = [
            entry.data,
            entry.rows,
            entry.dataset,
            entry.rawData,
            entry.rawDataUsed,
            entry.payload?.data,
            entry.payload?.rows,
        ];

        for (let i = 0; i < candidateArrays.length; i += 1) {
            const candidate = candidateArrays[i];
            if (Array.isArray(candidate) && candidate.length > 0) {
                cachedStockData = candidate;
                return cachedStockData;
            }
        }

        return null;
    }

    function getLastCacheEntry() {
        try {
            const store = resolveCacheStore();
            if (!store || !lastFetchSettings || typeof buildCacheKey !== 'function') return null;
            const key = buildCacheKey(lastFetchSettings);
            if (!key) return null;
            return store.get(key) || null;
        } catch (error) {
            console.warn('[Rolling Test] 無法解析快取條目：', error);
            return null;
        }
    }

    function resolveCacheStore() {
        if (typeof cachedDataStore !== 'undefined' && cachedDataStore instanceof Map) return cachedDataStore;
        if (typeof window !== 'undefined' && window.cachedDataStore instanceof Map) return window.cachedDataStore;
        return null;
    }

    function formatISODate(date) {
        if (!date) return '';
        if (typeof date === 'string') return date.slice(0, 10);
        if (typeof formatDate === 'function') return formatDate(date);
        return date.toISOString().split('T')[0];
    }

    function addMonthsClamped(date, months) {
        const result = new Date(date);
        const day = result.getDate();
        result.setDate(1);
        result.setMonth(result.getMonth() + months);
        const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
        result.setDate(Math.min(day, lastDay));
        return result;
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(2)}%`;
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(2);
    }

    function formatDuration(ms) {
        if (!Number.isFinite(ms) || ms <= 0) return '0 秒';
        const totalSeconds = Math.round(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) return `${minutes} 分 ${seconds} 秒`;
        return `${seconds} 秒`;
    }

    window.rollingTest = {
        init: initRollingTest,
        refreshPlan: updateRollingPlanPreview,
        state,
    };
})();
