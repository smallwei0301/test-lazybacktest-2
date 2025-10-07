// --- 滾動測試模組 - v1.2 ---
// Patch Tag: LB-ROLLING-TEST-20250912B
/* global getBacktestParams, cachedStockData, cachedDataStore, buildCacheKey, lastDatasetDiagnostics, lastOverallResult, lastFetchSettings, computeCoverageFromRows, formatDate, workerUrl, showError, showInfo */

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
        version: 'LB-ROLLING-TEST-20250912B',
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

    const OPTIMIZATION_SCOPE_MAP = {
        entry: {
            value: 'entry',
            label: '多單進場策略',
            strategyKey: 'entryStrategy',
            paramsKey: 'entryParams',
        },
        exit: {
            value: 'exit',
            label: '多單出場策略',
            strategyKey: 'exitStrategy',
            paramsKey: 'exitParams',
        },
        shortEntry: {
            value: 'shortEntry',
            label: '空單進場策略',
            strategyKey: 'shortEntryStrategy',
            paramsKey: 'shortEntryParams',
        },
        shortExit: {
            value: 'shortExit',
            label: '空單回補策略',
            strategyKey: 'shortExitStrategy',
            paramsKey: 'shortExitParams',
        },
    };

    const OPTIMIZATION_METRICS = [
        { value: 'annualizedReturn', label: '年化報酬率', direction: 'max' },
        { value: 'sharpeRatio', label: 'Sharpe Ratio', direction: 'max' },
        { value: 'sortinoRatio', label: 'Sortino Ratio', direction: 'max' },
        { value: 'winRate', label: '勝率', direction: 'max' },
        { value: 'maxDrawdown', label: '最大回撤', direction: 'min' },
    ];

    function resolveOptimizationSettings(baseParams) {
        const toggle = document.getElementById('rolling-optimize-enabled');
        const scopeSelect = document.getElementById('rolling-optimize-scope');
        const paramSelect = document.getElementById('rolling-optimize-parameter');
        const metricSelect = document.getElementById('rolling-optimize-metric');
        const summaryEl = document.getElementById('rolling-optimize-summary');

        const enabled = Boolean(toggle?.checked);
        const summaryFallback = '訓練期自動優化目前未啟用。';

        if (!baseParams || typeof strategyDescriptions === 'undefined') {
            if (scopeSelect) { scopeSelect.innerHTML = ''; scopeSelect.disabled = true; }
            if (paramSelect) { paramSelect.innerHTML = ''; paramSelect.disabled = true; }
            ensureMetricSelectOptions(metricSelect);
            if (summaryEl) summaryEl.textContent = enabled ? '策略資訊不足，無法進行自動優化。' : summaryFallback;
            return { enabled: false, candidateCount: 0, summaryText: summaryEl?.textContent || summaryFallback };
        }

        const scopeOptions = computeAvailableOptimizationScopes(baseParams);
        const resolvedScopeValue = syncSelectOptions(scopeSelect, scopeOptions.map((opt) => ({ value: opt.value, label: opt.label })), scopeSelect?.value);
        const scopeEntry = scopeOptions.find((opt) => opt.value === resolvedScopeValue) || scopeOptions[0] || null;

        const parameterOptions = Array.isArray(scopeEntry?.strategyInfo?.optimizeTargets)
            ? scopeEntry.strategyInfo.optimizeTargets.map((target) => ({
                value: target.name,
                label: target.label || target.name,
                range: target.range || null,
            }))
            : [];

        const resolvedParamValue = syncSelectOptions(paramSelect, parameterOptions.map((opt) => ({ value: opt.value, label: opt.label })), paramSelect?.value);
        const parameterEntry = parameterOptions.find((opt) => opt.value === resolvedParamValue) || parameterOptions[0] || null;

        ensureMetricSelectOptions(metricSelect);
        const metricInfo = resolveMetricInfo(metricSelect?.value);
        if (metricSelect && metricInfo) {
            metricSelect.value = metricInfo.value;
        }
        if (metricSelect) {
            metricSelect.disabled = !enabled;
        }

        const shouldDisableControls = !enabled || scopeOptions.length === 0;
        if (scopeSelect) scopeSelect.disabled = shouldDisableControls || scopeOptions.length === 0;
        if (paramSelect) paramSelect.disabled = shouldDisableControls || parameterOptions.length === 0;

        let candidates = [];
        if (enabled && scopeEntry && parameterEntry) {
            candidates = buildCandidateValues(parameterEntry.range);
        }

        const optimizationEnabled = enabled
            && scopeEntry
            && parameterEntry
            && metricInfo
            && Array.isArray(candidates)
            && candidates.length > 0;

        const summaryText = buildOptimizationSummaryText({
            enabled,
            scopeEntry,
            parameterEntry,
            metricInfo,
            candidateCount: candidates.length,
        });

        if (summaryEl) summaryEl.textContent = summaryText;

        return {
            enabled: optimizationEnabled,
            scope: scopeEntry?.value || null,
            scopeLabel: scopeEntry?.label || null,
            strategyName: scopeEntry?.strategyName || null,
            parameterName: parameterEntry?.value || null,
            parameterLabel: parameterEntry?.label || null,
            metric: metricInfo?.value || null,
            metricLabel: metricInfo?.label || null,
            direction: metricInfo?.direction || 'max',
            candidateValues: optimizationEnabled ? candidates : [],
            candidateCount: optimizationEnabled ? candidates.length : 0,
            originalValue: scopeEntry ? baseParams?.[scopeEntry.paramsKey]?.[parameterEntry?.value] : null,
            summaryText,
        };
    }

    function computeAvailableOptimizationScopes(baseParams) {
        const scopes = [];
        Object.values(OPTIMIZATION_SCOPE_MAP).forEach((entry) => {
            if (!baseParams) return;
            if ((entry.value === 'shortEntry' || entry.value === 'shortExit') && !baseParams.enableShorting) return;
            const strategyName = baseParams[entry.strategyKey];
            if (!strategyName) return;
            const strategyInfo = strategyDescriptions?.[strategyName];
            if (!strategyInfo || !Array.isArray(strategyInfo.optimizeTargets) || strategyInfo.optimizeTargets.length === 0) return;
            scopes.push({
                ...entry,
                strategyName,
                strategyInfo,
            });
        });
        return scopes;
    }

    function ensureMetricSelectOptions(metricSelect) {
        if (!metricSelect) return;
        const previousValue = metricSelect.value;
        if (metricSelect.childElementCount === 0) {
            OPTIMIZATION_METRICS.forEach((metric) => {
                const option = document.createElement('option');
                option.value = metric.value;
                option.textContent = metric.label;
                metricSelect.appendChild(option);
            });
        }
        if (previousValue && OPTIMIZATION_METRICS.some((metric) => metric.value === previousValue)) {
            metricSelect.value = previousValue;
        } else if (OPTIMIZATION_METRICS.length > 0) {
            metricSelect.value = OPTIMIZATION_METRICS[0].value;
        }
    }

    function syncSelectOptions(selectEl, options, preferredValue) {
        if (!selectEl) return null;
        const previousValue = preferredValue ?? selectEl.value;
        selectEl.innerHTML = '';
        options.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label || opt.value;
            selectEl.appendChild(option);
        });
        if (options.length === 0) {
            selectEl.value = '';
            return null;
        }
        const hasPreferred = options.some((opt) => opt.value === previousValue);
        const resolvedValue = hasPreferred ? previousValue : options[0].value;
        selectEl.value = resolvedValue;
        return resolvedValue;
    }

    function resolveMetricInfo(metricValue) {
        const fallback = OPTIMIZATION_METRICS[0] || null;
        if (!metricValue) return fallback;
        return OPTIMIZATION_METRICS.find((metric) => metric.value === metricValue) || fallback;
    }

    function buildCandidateValues(range) {
        if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return [];
        const step = Number.isFinite(range.step) && range.step > 0 ? range.step : 1;
        const from = range.from;
        const to = range.to;
        const values = [];
        const decimals = countDecimals(step);
        if (from <= to) {
            for (let value = from; value <= to + (step / 2); value += step) {
                values.push(Number(value.toFixed(decimals)));
                if (values.length >= 500) break;
            }
        } else {
            for (let value = from; value >= to - (step / 2); value -= step) {
                values.push(Number(value.toFixed(decimals)));
                if (values.length >= 500) break;
            }
        }
        return values;
    }

    function countDecimals(value) {
        if (!Number.isFinite(value)) return 0;
        const parts = value.toString().split('.');
        return parts.length > 1 ? parts[1].length : 0;
    }

    function buildOptimizationSummaryText(context) {
        if (!context.enabled) {
            return '訓練期自動優化目前未啟用。';
        }
        if (!context.scopeEntry || !context.parameterEntry) {
            return '已啟用訓練期自動優化，但目前策略無可優化參數，將沿用原設定。';
        }
        if (!context.metricInfo) {
            return `已啟用訓練期自動優化：${context.scopeEntry.label} · ${context.parameterEntry.label}，請選擇評估指標。`;
        }
        if (!Number.isFinite(context.candidateCount) || context.candidateCount <= 0) {
            return `已啟用訓練期自動優化：${context.scopeEntry.label} · ${context.parameterEntry.label}，但缺少候選參數範圍。`;
        }
        const directionText = context.metricInfo.direction === 'min' ? '（最小化）' : '（最大化）';
        return `訓練期自動優化：${context.scopeEntry.label} / ${context.parameterEntry.label}，候選 ${context.candidateCount} 組，目標 ${context.metricInfo.label}${directionText}`;
    }

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

        const startBtn = document.getElementById('start-rolling-test');
        const stopBtn = document.getElementById('stop-rolling-test');
        if (startBtn) startBtn.addEventListener('click', startRollingTest);
        if (stopBtn) stopBtn.addEventListener('click', stopRollingTest);

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
        const trainingStepsPerWindow = Math.max(state.config?.optimization?.enabled ? state.config.optimization.candidateCount : 1, 1);
        state.progress.totalSteps = windows.length * (trainingStepsPerWindow + 1); // 訓練(含優化) + 測試
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

            let trainingResult = null;
            let testingResult = null;
            let optimizationDecision = null;
            let overrideParams = null;

            if (state.config?.optimization?.enabled) {
                try {
                    const outcome = await optimizeWindowParameters(baseParams, win, state.config.optimization, {
                        windowIndex: i + 1,
                        totalWindows: state.windows.length,
                    });
                    trainingResult = outcome.trainingResult;
                    overrideParams = outcome.paramOverrides;
                    optimizationDecision = outcome.decision;
                    if (trainingResult && typeof trainingResult === 'object') {
                        trainingResult.optimizationDecision = optimizationDecision;
                    }
                } catch (error) {
                    console.warn('[Rolling Test] Optimization failed for window', i + 1, error);
                    optimizationDecision = {
                        enabled: true,
                        error: error?.message || '訓練期優化失敗',
                        candidateCount: state.config.optimization?.candidateCount || 0,
                        metric: state.config.optimization?.metric || null,
                        metricLabel: state.config.optimization?.metricLabel || null,
                        parameterLabel: state.config.optimization?.parameterLabel || null,
                        scopeLabel: state.config.optimization?.scopeLabel || null,
                    };
                    if (!state.cancelled) {
                        try {
                            state.progress.totalSteps += 1;
                            trainingResult = await runSingleWindow(baseParams, win.trainingStart, win.trainingEnd, {
                                phase: '訓練期(原參數)',
                                windowIndex: i + 1,
                                totalWindows: state.windows.length,
                            });
                        } catch (fallbackError) {
                            console.warn('[Rolling Test] Fallback training failed:', fallbackError);
                            trainingResult = { error: fallbackError?.message || '訓練期回測失敗' };
                        }
                    } else {
                        trainingResult = { error: '滾動測試已中止' };
                    }
                }
            } else {
                try {
                    trainingResult = await runSingleWindow(baseParams, win.trainingStart, win.trainingEnd, {
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

            try {
                testingResult = await runSingleWindow(baseParams, win.testingStart, win.testingEnd, {
                    phase: '測試期',
                    windowIndex: i + 1,
                    totalWindows: state.windows.length,
                }, {
                    paramOverrides: overrideParams,
                    optimizationDecision,
                });
            } catch (error) {
                console.warn('[Rolling Test] Testing window failed:', error);
                testingResult = { error: error?.message || '測試期回測失敗' };
            }

            if (testingResult && typeof testingResult === 'object' && optimizationDecision) {
                testingResult.optimizationDecision = optimizationDecision;
            }

            state.results.push({
                window: win,
                training: trainingResult,
                testing: testingResult,
                optimization: optimizationDecision,
            });
        }
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
            optimization: entry.optimization || entry.training?.optimizationDecision || null,
        }));

        const aggregate = computeAggregateReport(
            analysisEntries,
            state.config?.thresholds || DEFAULT_THRESHOLDS,
            state.config?.minTrades || 0,
            state.config?.optimization || null,
        );

        const report = document.getElementById('rolling-test-report');
        const intro = document.getElementById('rolling-report-intro');
        if (intro) {
            const baseIntro = `共完成 ${aggregate.totalWindows} 個 Walk-Forward 視窗（訓練 ${state.config.trainingMonths} 個月 / 測試 ${state.config.testingMonths} 個月 / 平移 ${state.config.stepMonths} 個月）`;
            if (state.config?.optimization?.enabled) {
                const optSummary = describeOptimizationForIntro(state.config.optimization);
                intro.textContent = `${baseIntro} · ${optSummary}`;
            } else {
                intro.textContent = baseIntro;
            }
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

    function computeAggregateReport(entries, thresholds, minTrades, optimizationConfig) {
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
                if (entry.optimization?.enabled) {
                    if (Number.isFinite(entry.optimization.bestValue) || entry.optimization.bestValue === 0) {
                        const valueText = formatOptimizationValue(entry.optimization.bestValue);
                        const metricText = formatOptimizationMetric(entry.optimization.metric, entry.optimization.bestMetrics);
                        commentParts.push(`最佳 ${entry.optimization.parameterLabel || entry.optimization.parameterName} = ${valueText}${metricText ? `，訓練${metricText}` : ''}`);
                    } else if (entry.optimization.error) {
                        commentParts.push(`優化失敗：${entry.optimization.error}`);
                    }
                } else if (entry.optimization?.error) {
                    commentParts.push(`優化失敗：${entry.optimization.error}`);
                }
            }
            return {
                index: entry.index,
                window: entry.window,
                metrics: entry.testing,
                evaluation,
                comment: commentParts.join('；') || '—',
                optimization: entry.optimization || null,
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
            optimization: optimizationConfig,
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
        if (context.optimization?.enabled) {
            parts.push(describeOptimizationForSummary(context.optimization));
        }
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
        return new Promise((resolve, reject) => {
            try {
                const payload = prepareWorkerPayload(baseParams, startIso, endIso, options.paramOverrides || null);
                if (!payload) {
                    reject(new Error('無法準備回測參數'));
                    return;
                }
                const stageLabel = context?.phase || '';
                state.progress.stage = stageLabel;
                const windowIndex = context?.windowIndex || state.progress.windowIndex || 0;
                const totalWindows = context?.totalWindows || state.windows.length || 0;
                const baseMessage = totalWindows > 0 ? `視窗 ${windowIndex}/${totalWindows}` : '視窗處理中';
                const progressMessage = context?.progressNote
                    ? `${baseMessage} · ${context.progressNote}`
                    : stageLabel
                        ? `${baseMessage} · ${stageLabel}`
                        : baseMessage;
                updateProgressUI(progressMessage);

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
                        state.progress.currentStep += 1;
                        updateProgressUI();
                        worker.terminate();
                        resolve(type === 'result' ? data : result);
                        return;
                    }
                    if (type === 'error' || type === 'marketError') {
                        state.progress.currentStep += 1;
                        updateProgressUI();
                        worker.terminate();
                        reject(new Error(event.data?.message || '回測失敗'));
                    }
                };

                worker.onerror = (error) => {
                    state.progress.currentStep += 1;
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

    function prepareWorkerPayload(baseParams, startIso, endIso, paramOverrides) {
        if (!baseParams || !startIso || !endIso) return null;
        const clone = deepClone(baseParams);
        clone.startDate = startIso;
        clone.endDate = endIso;
        if ('recentYears' in clone) delete clone.recentYears;

        if (paramOverrides && typeof paramOverrides === 'object') {
            Object.keys(paramOverrides).forEach((key) => {
                const overrideValue = paramOverrides[key];
                if (overrideValue && typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
                    clone[key] = { ...(clone[key] || {}), ...overrideValue };
                } else {
                    clone[key] = overrideValue;
                }
            });
        }

        const enriched = enrichParamsWithLookback(clone);
        return {
            params: enriched,
            dataStartDate: enriched.dataStartDate || enriched.startDate,
            effectiveStartDate: enriched.effectiveStartDate || enriched.startDate,
            lookbackDays: Number.isFinite(enriched.lookbackDays) ? enriched.lookbackDays : null,
        };
    }

    async function optimizeWindowParameters(baseParams, window, optimization, context) {
        if (!optimization || !optimization.enabled) {
            throw new Error('尚未啟用訓練期自動優化');
        }
        const candidates = Array.isArray(optimization.candidateValues) ? optimization.candidateValues : [];
        if (candidates.length === 0) {
            throw new Error('缺少優化候選參數');
        }

        const evaluationLog = [];
        let bestCandidate = null;

        for (let idx = 0; idx < candidates.length; idx += 1) {
            if (state.cancelled) break;
            const candidateValue = candidates[idx];
            const overrides = buildParamOverrides(baseParams, optimization, candidateValue);
            const result = await runSingleWindow(baseParams, window.trainingStart, window.trainingEnd, {
                phase: '訓練期優化',
                windowIndex: context?.windowIndex,
                totalWindows: context?.totalWindows,
                progressNote: `訓練期優化 ${idx + 1}/${candidates.length}`,
            }, {
                paramOverrides: overrides,
            });

            const metrics = extractMetrics(result);
            const score = computeOptimizationScore(metrics, optimization);
            const candidateRecord = {
                value: candidateValue,
                metrics,
                score,
                overrides,
                result,
            };
            evaluationLog.push({
                value: candidateValue,
                score,
                metrics,
            });

            if (!bestCandidate || isBetterOptimizationCandidate(candidateRecord, bestCandidate, optimization.direction)) {
                bestCandidate = candidateRecord;
            }
        }

        if (!bestCandidate || !bestCandidate.result || bestCandidate.metrics?.error) {
            throw new Error('無法於訓練期取得有效優化結果');
        }

        const decision = {
            enabled: true,
            scope: optimization.scope,
            scopeLabel: optimization.scopeLabel,
            parameterName: optimization.parameterName,
            parameterLabel: optimization.parameterLabel,
            metric: optimization.metric,
            metricLabel: optimization.metricLabel,
            direction: optimization.direction,
            candidateCount: candidates.length,
            bestValue: bestCandidate.value,
            bestMetrics: bestCandidate.metrics,
            evaluationLog,
        };

        return {
            paramOverrides: bestCandidate.overrides,
            trainingResult: bestCandidate.result,
            decision,
        };
    }

    function buildParamOverrides(baseParams, optimization, candidateValue) {
        if (!optimization?.scope) return null;
        const scopeEntry = OPTIMIZATION_SCOPE_MAP[optimization.scope];
        if (!scopeEntry) return null;
        const overrides = {};
        const paramsKey = scopeEntry.paramsKey;
        if (paramsKey) {
            const baseParamsObj = baseParams?.[paramsKey] && typeof baseParams[paramsKey] === 'object'
                ? baseParams[paramsKey]
                : {};
            overrides[paramsKey] = { ...baseParamsObj, [optimization.parameterName]: candidateValue };
        }
        return overrides;
    }

    function computeOptimizationScore(metrics, optimization) {
        if (!optimization || !optimization.metric) return Number.NEGATIVE_INFINITY;
        if (!metrics || metrics.error) {
            return optimization.direction === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
        }
        const metricValue = metrics[optimization.metric];
        if (!Number.isFinite(metricValue)) {
            return optimization.direction === 'min' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
        }
        return metricValue;
    }

    function isBetterOptimizationCandidate(candidate, currentBest, direction) {
        if (!currentBest) return true;
        const isMinimize = direction === 'min';
        if (isMinimize) {
            if (!Number.isFinite(candidate.score)) return false;
            if (!Number.isFinite(currentBest.score)) return true;
            if (candidate.score < currentBest.score) return true;
            if (candidate.score === currentBest.score) {
                return Number.isFinite(candidate.metrics?.tradesCount) && candidate.metrics.tradesCount > (currentBest.metrics?.tradesCount || 0);
            }
            return false;
        }
        if (!Number.isFinite(candidate.score)) return false;
        if (!Number.isFinite(currentBest.score)) return true;
        if (candidate.score > currentBest.score) return true;
        if (candidate.score === currentBest.score) {
            return Number.isFinite(candidate.metrics?.tradesCount) && candidate.metrics.tradesCount > (currentBest.metrics?.tradesCount || 0);
        }
        return false;
    }

    function formatOptimizationValue(value) {
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return '—';
            if (Number.isInteger(value)) return value.toString();
            const precision = Math.abs(value) >= 100 ? 2 : 4;
            return Number(value.toFixed(precision)).toString();
        }
        if (value === null || typeof value === 'undefined') return '—';
        return String(value);
    }

    function formatOptimizationMetric(metricKey, metrics) {
        if (!metricKey || !metrics || metrics.error) return '';
        const label = resolveMetricLabel(metricKey) || metricKey;
        const rawValue = metrics[metricKey];
        if (!Number.isFinite(rawValue)) return '';
        if (metricKey === 'annualizedReturn' || metricKey === 'winRate' || metricKey === 'maxDrawdown') {
            return `${label} ${formatPercent(rawValue)}`;
        }
        return `${label} ${formatNumber(rawValue)}`;
    }

    function resolveMetricLabel(metricKey) {
        const metric = OPTIMIZATION_METRICS.find((item) => item.value === metricKey);
        return metric?.label || null;
    }

    function describeOptimizationForIntro(optimization) {
        if (!optimization || !optimization.enabled) {
            return '訓練期自動優化未啟用';
        }
        const candidateCount = Number.isFinite(optimization.candidateCount) ? optimization.candidateCount : (optimization.candidateValues?.length || 0);
        const metricLabel = optimization.metricLabel || resolveMetricLabel(optimization.metric) || optimization.metric || '評估指標';
        const directionText = optimization.direction === 'min' ? '最小化' : '最大化';
        const scopeLabel = optimization.scopeLabel || '策略';
        const parameterLabel = optimization.parameterLabel || optimization.parameterName || '參數';
        return `訓練期自動優化：${scopeLabel} / ${parameterLabel}（候選 ${candidateCount} 組，目標 ${metricLabel}·${directionText}）`;
    }

    function describeOptimizationForSummary(optimization) {
        if (!optimization || !optimization.enabled) {
            return '訓練期自動優化：未啟用';
        }
        const candidateCount = Number.isFinite(optimization.candidateCount) ? optimization.candidateCount : (optimization.candidateValues?.length || 0);
        const metricLabel = optimization.metricLabel || resolveMetricLabel(optimization.metric) || optimization.metric || '評估指標';
        const directionText = optimization.direction === 'min' ? '最小化' : '最大化';
        const scopeLabel = optimization.scopeLabel || '策略';
        const parameterLabel = optimization.parameterLabel || optimization.parameterName || '參數';
        return `訓練期自動優化：${scopeLabel} / ${parameterLabel}，候選 ${candidateCount} 組，目標 ${metricLabel}（${directionText}）`;
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
        const optimization = resolveOptimizationSettings(params);
        return {
            trainingMonths,
            testingMonths,
            stepMonths,
            minTrades,
            thresholds,
            baseStart: params?.startDate || lastFetchSettings?.startDate || null,
            baseEnd: params?.endDate || lastFetchSettings?.endDate || null,
            optimization,
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

    function updateRollingPlanPreview() {
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
