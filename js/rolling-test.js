// --- 滾動測試模組 - v2.4 ---
// Patch Tag: LB-ROLLING-TEST-20251028B
/* global getBacktestParams, cachedStockData, cachedDataStore, buildCacheKey, lastDatasetDiagnostics, lastOverallResult, lastFetchSettings, computeCoverageFromRows, formatDate, workerUrl, showError, showInfo */

(function() {
    const state = {
        initialized: false,
        running: false,
        cancelled: false,
        windows: [],
        results: [],
        config: null,
        optimizationPlan: { enabled: false, scopes: [], config: null },
        startTime: null,
        progress: {
            totalSteps: 0,
            currentStep: 0,
            windowIndex: 0,
            stage: '',
        },
        version: 'LB-ROLLING-TEST-20251028B',
        batchOptimizerInitialized: false,
        aggregate: null,
        aggregateGeneratedAt: null,
    };

    let planRefreshTimer = null;

    const DEFAULT_THRESHOLDS = {
        annualizedReturn: 8,
        sharpeRatio: 1,
        sortinoRatio: 1.2,
        maxDrawdown: 25,
        winRate: 45,
    };

    const QUALITY_WEIGHTS = {
        annualizedReturn: 0.35,
        sharpeRatio: 0.25,
        sortinoRatio: 0.20,
        maxDrawdown: 0.10,
        winRate: 0.10,
    };

    const WALK_FORWARD_EFFICIENCY_BASELINE = 67;
    const DEFAULT_OPTIMIZATION_ITERATIONS = 6;
    const DEFAULT_WINDOW_RATIO = { training: 36, testing: 12, step: 6 };
    const DEFAULT_WINDOW_COUNT = 2;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const DAYS_PER_YEAR = 252;
    const RISK_FREE_RATE = 0.01;
    const MIN_TRACK_RECORD_CONFIDENCE = 0.95;
    const WFE_ADJUST_MIN = 0.8;
    const WFE_ADJUST_MAX = 1.2;

    const METRIC_LABELS = {
        annualizedReturn: '年化報酬率',
        sharpeRatio: 'Sharpe Ratio',
        sortinoRatio: 'Sortino Ratio',
        maxDrawdown: '最大回撤',
        winRate: '勝率',
    };

    const PARAM_NAME_LABELS = {
        shortPeriod: '短天數',
        longPeriod: '長天數',
        period: '週期',
        breakoutPeriod: '突破期',
        signalPeriod: '訊號期',
        threshold: '門檻',
        upperThreshold: '上限',
        lowerThreshold: '下限',
        multiplier: '倍數',
        length: '期間',
        offset: '位移',
        atrPeriod: 'ATR 期間',
        maPeriod: '均線天數',
        stopLoss: '停損 (%)',
        takeProfit: '停利 (%)',
        trailingStop: '移動停損',
        riskReward: 'RR 比',
        channelPeriod: '通道期',
        breakoutThreshold: '突破門檻',
    };

    function setAdvancedToggleState(expanded) {
        const container = document.getElementById('rolling-advanced-settings');
        const toggle = document.getElementById('toggle-rolling-advanced');
        if (!container || !toggle) return;
        if (expanded) container.classList.remove('hidden');
        else container.classList.add('hidden');
        toggle.setAttribute('aria-expanded', String(Boolean(expanded)));
        toggle.textContent = expanded ? '隱藏進階設定' : '顯示進階設定';
    }

    function isAdvancedSettingsActive() {
        const container = document.getElementById('rolling-advanced-settings');
        if (!container) return false;
        return !container.classList.contains('hidden');
    }

    function initRollingTest() {
        if (state.initialized) return;
        const tab = document.getElementById('rolling-test-tab');
        if (!tab) return;

        const inputs = tab.querySelectorAll('[data-rolling-input]');
        inputs.forEach((input) => {
            ['change', 'input'].forEach((evt) => {
                input.addEventListener(evt, () => {
                    updateRollingPlanPreview();
                    syncRollingOptimizeUI();
                });
            });
        });

        const startBtn = document.getElementById('start-rolling-test');
        const stopBtn = document.getElementById('stop-rolling-test');
        if (startBtn) startBtn.addEventListener('click', startRollingTest);
        if (stopBtn) stopBtn.addEventListener('click', stopRollingTest);

        const shortToggle = document.getElementById('enableShortSelling');
        if (shortToggle) {
            shortToggle.addEventListener('change', () => {
                syncRollingOptimizeUI();
            });
        }

        const advancedToggle = document.getElementById('toggle-rolling-advanced');
        if (advancedToggle) {
            setAdvancedToggleState(false);
            advancedToggle.addEventListener('click', () => {
                const expanded = !isAdvancedSettingsActive();
                setAdvancedToggleState(expanded);
                updateRollingPlanPreview();
            });
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('lazybacktest:visible-data-changed', handleVisibleDataChange, { passive: true });
        }

        updateRollingPlanPreview();
        syncRollingOptimizeUI();
        state.initialized = true;
    }

    function startRollingTest(event) {
        if (event) event.preventDefault();
        if (state.running) return;

        const cachedRows = ensureRollingCacheHydrated();
        const availability = getCachedAvailability(cachedRows);
        const config = getRollingConfig(availability);
        const windows = computeRollingWindows(config, availability);

        if (!Array.isArray(cachedRows) || cachedRows.length === 0) {
            setPlanWarning('請先執行一次主回測以產生快取資料');
            setAlert('請先在主畫面執行一次完整回測，以建立快取資料後再啟動滾動測試。', 'error');
            showError?.('滾動測試需要可用的回測快取資料，請先執行一次回測');
            return;
        }

        if (!windows || windows.length === 0) {
            setPlanWarning('目前設定無法建立有效的 Walk-Forward 視窗，請調整滾動測試次數或回測期間。');
            setAlert('目前設定無法建立有效的 Walk-Forward 視窗，請調整視窗長度或日期區間。', 'warning');
            showInfo?.('請調整滾動測試設定，例如延長日期區間或縮短視窗長度');
            return;
        }

        const coverageIssues = validateWindowCoverage(windows, cachedRows, config);
        if (coverageIssues.length > 0) {
            const primary = coverageIssues[0];
            const detail = coverageIssues.length > 1 ? `（共 ${coverageIssues.length} 項問題）` : '';
            setPlanWarning(`視窗規劃失敗：${primary}`);
            setAlert(`滾動測試無法啟動：${primary}${detail}`, 'error');
            showError?.(`[Rolling Test] ${primary}`);
            return;
        }

        state.optimizationPlan = { enabled: false, scopes: [], config: null };

        const baseParams = typeof getBacktestParams === 'function' ? getBacktestParams() : null;
        if (!baseParams) {
            setAlert('無法取得回測參數，請重新整理頁面後再試一次。', 'error');
            showError?.('滾動測試無法讀取目前的策略參數設定');
            return;
        }

        const optimizationPlan = buildRollingOptimizationPlan(config.optimization, baseParams);
        state.optimizationPlan = optimizationPlan;
        if (config?.optimization?.enabled && !optimizationPlan.enabled) {
            showInfo?.('已啟用訓練期優化，但目前策略未選擇可優化的參數。');
        }
        const stepsPerWindow = optimizationPlan.enabled ? 3 : 2;

        state.running = true;
        state.cancelled = false;
        state.config = config;
        state.windows = windows;
        state.results = [];
        state.startTime = Date.now();
        state.progress.totalSteps = windows.length * stepsPerWindow;
        state.progress.currentStep = 0;
        state.progress.windowIndex = 0;
        state.progress.stage = '';

        toggleRollingControls(true);
        clearRollingReport();
        ensureProgressPanelVisible(true);
        setAlert('系統已開始滾動測試，請保持頁面開啟。', 'info');
        updateProgressUI();

        runRollingSequence(baseParams).catch((error) => {
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

    async function runRollingSequence(baseParams) {
        if (!baseParams) throw new Error('無法取得回測參數，請重新整理頁面');
        const optimizationPlan = state.optimizationPlan || { enabled: false, scopes: [] };

        for (let i = 0; i < state.windows.length; i += 1) {
            if (state.cancelled) break;
            const win = state.windows[i];
            state.progress.windowIndex = i + 1;

            const trainingBaseParams = buildTrainingWindowBaseParams(baseParams, win);
            let windowParams = deepClone(trainingBaseParams);
            let optimizationSummary = null;

            if (optimizationPlan.enabled) {
                try {
                    state.progress.stage = '參數優化';
                    updateProgressUI(`視窗 ${state.progress.windowIndex}/${state.windows.length} · 參數優化`);
                    const optimizationResult = await optimizeParametersForWindow(trainingBaseParams, win, optimizationPlan);
                    if (optimizationResult?.params) {
                        windowParams = deepClone(optimizationResult.params);
                    } else {
                        windowParams = deepClone(trainingBaseParams);
                    }
                    optimizationSummary = optimizationResult?.summary || null;
                } catch (error) {
                    console.warn('[Rolling Test] Optimization failed:', error);
                    optimizationSummary = { error: error?.message || '參數優化失敗' };
                }
                state.progress.currentStep += 1;
                updateProgressUI();
            }

            let trainingResult = null;
            try {
                trainingResult = await runSingleWindow(windowParams, win.trainingStart, win.trainingEnd, {
                    phase: '訓練期',
                    windowIndex: i + 1,
                    totalWindows: state.windows.length,
                });
            } catch (error) {
                console.warn('[Rolling Test] Training window failed:', error);
                trainingResult = { error: error?.message || '訓練期回測失敗' };
            }

            if (state.cancelled) break;

            let testingResult = null;
            try {
                testingResult = await runSingleWindow(windowParams, win.testingStart, win.testingEnd, {
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
                optimization: optimizationSummary,
                params: deepClone(windowParams),
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
        const gradeLabel = document.getElementById('rolling-grade-label');
        if (gradeLabel) gradeLabel.textContent = '—';
        const gradeCard = document.getElementById('rolling-grade-card');
        if (gradeCard) {
            gradeCard.style.borderColor = 'var(--border)';
            gradeCard.style.backgroundColor = 'color-mix(in srgb, var(--primary) 6%, transparent)';
        }
        const scoreboard = document.getElementById('rolling-scoreboard');
        if (scoreboard) scoreboard.innerHTML = '';
        const table = document.getElementById('rolling-window-report');
        if (table) table.innerHTML = '';
        const header = document.getElementById('rolling-window-header');
        if (header) header.innerHTML = '';
        const summary = document.getElementById('rolling-score-summary');
        const summaryContent = document.getElementById('rolling-score-summary-content');
        if (summary) summary.open = false;
        if (summaryContent) summaryContent.innerHTML = '';
        const intro = document.getElementById('rolling-report-intro');
        if (intro) intro.textContent = '';
        state.aggregate = null;
        state.aggregateGeneratedAt = null;
    }

    function renderRollingReport() {
        if (!state.results || state.results.length === 0) {
            clearRollingReport();
            return;
        }

        const analysisEntries = state.results.map((entry, index) => {
            const trainingMetrics = extractMetrics(entry.training);
            const testingMetrics = extractMetrics(entry.testing);
            const walkForwardEfficiency = computeWalkForwardEfficiency(trainingMetrics, testingMetrics);
            if (Number.isFinite(walkForwardEfficiency)) {
                testingMetrics.walkForwardEfficiency = walkForwardEfficiency;
            }
            return {
                index,
                window: entry.window,
                training: trainingMetrics,
                testing: testingMetrics,
                walkForwardEfficiency,
                rawTraining: entry.training,
                rawTesting: entry.testing,
                optimization: entry.optimization || null,
                paramsSnapshot: entry.params || null,
            };
        });

        const aggregate = computeAggregateReport(analysisEntries, state.config?.thresholds || DEFAULT_THRESHOLDS, state.config?.minTrades || 0);
        state.aggregate = aggregate;
        state.aggregateGeneratedAt = new Date().toISOString();

        const report = document.getElementById('rolling-test-report');
        const intro = document.getElementById('rolling-report-intro');
        if (intro) {
            intro.textContent = `共完成 ${aggregate.totalWindows} 個 Walk-Forward 視窗（訓練 ${state.config.trainingMonths} 個月 / 測試 ${state.config.testingMonths} 個月 / 平移 ${state.config.stepMonths} 個月）`;
        }
        if (report) report.classList.remove('hidden');

        renderGradeCard(aggregate);
        renderScoreboard(aggregate);
        renderWindowTable(aggregate);
        renderSummaryDetails(aggregate);
    }

    function renderGradeCard(aggregate) {
        const card = document.getElementById('rolling-grade-card');
        const label = document.getElementById('rolling-grade-label');
        if (!card || !label) return;

        const gradeLabel = aggregate?.gradeLabel || '尚無結果';
        const accent = aggregate?.gradeColor || 'var(--foreground)';

        label.textContent = gradeLabel;
        label.style.color = accent;
        card.style.borderColor = accent;
        card.style.backgroundColor = `color-mix(in srgb, ${accent} 12%, transparent)`;
    }

    function renderSummaryDetails(aggregate) {
        const summary = document.getElementById('rolling-score-summary');
        const content = document.getElementById('rolling-score-summary-content');
        if (!summary || !content) return;

        content.innerHTML = '';
        const hasText = typeof aggregate?.summaryText === 'string' && aggregate.summaryText.trim().length > 0;
        summary.classList.toggle('hidden', !hasText);
        if (!hasText) {
            summary.open = false;
            return;
        }

        const parts = aggregate.summaryText.split('；').map((part) => part.trim()).filter((part) => part.length > 0);
        if (parts.length <= 1) {
            const paragraph = document.createElement('p');
            paragraph.textContent = aggregate.summaryText;
            content.appendChild(paragraph);
        } else {
            const list = document.createElement('ul');
            list.className = 'list-disc space-y-1 pl-4';
            parts.forEach((part) => {
                const item = document.createElement('li');
                item.textContent = part;
                list.appendChild(item);
            });
            content.appendChild(list);
        }

        summary.open = false;
    }

    function renderScoreboard(aggregate) {
        const scoreboard = document.getElementById('rolling-scoreboard');
        if (!scoreboard) return;
        scoreboard.innerHTML = '';

        const cards = [
            {
                title: 'Walk-Forward 總分',
                value: formatScorePoints(aggregate.totalScore),
                accent: aggregate.gradeColor,
                description: describeTotalScoreStatus(aggregate),
                detailBuilder: () => buildTotalScoreDetail(aggregate),
            },
            {
                title: 'OOS 品質 / 信度',
                value: `${formatScore(aggregate.medianOosQuality)} / ${formatProbability(aggregate.medianCredibility)}`,
                description: describeQualityStatus(aggregate),
                detailBuilder: () => buildQualityDetail(aggregate),
            },
            {
                title: 'WFE 中位',
                value: formatPercent(aggregate.medianWfePercent),
                description: describeWfeStatus(aggregate),
                detailBuilder: () => buildWfeDetail(aggregate),
            },
            {
                title: 'PSR / DSR',
                value: `${formatProbability(aggregate.medianPsr)} / ${formatProbability(aggregate.medianDsr)}`,
                description: describeCredibilityStatus(aggregate),
                detailBuilder: () => buildCredibilityDetail(aggregate),
            },
            {
                title: '整體 Sharpe',
                value: formatNumber(aggregate.overallSharpe),
                description: describeSharpeStatus(aggregate),
                detailBuilder: () => buildSharpeDetail(aggregate),
            },
            {
                title: '通過視窗比例',
                value: formatPercent(aggregate.passRate),
                description: describePassRateStatus(aggregate),
                detailBuilder: () => buildPassRateDetail(aggregate),
            },
        ];

        cards.forEach((card) => {
            const el = document.createElement('div');
            el.className = 'p-4 border rounded-lg shadow-sm flex flex-col gap-2';
            el.style.borderColor = 'var(--border)';
            el.style.background = 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent) 0%, var(--background) 100%)';

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

            if (typeof card.detailBuilder === 'function') {
                const detailContent = card.detailBuilder();
                if (detailContent) {
                    const details = document.createElement('details');
                    details.className = 'text-[11px] leading-relaxed';
                    const summary = document.createElement('summary');
                    summary.className = 'cursor-pointer select-none font-medium';
                    summary.textContent = '查看計算細節';
                    details.appendChild(summary);
                    details.appendChild(detailContent);
                    el.appendChild(details);
                }
            }

            scoreboard.appendChild(el);
        });
    }

    function buildTotalScoreDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1';

        const note = document.createElement('p');
        note.className = 'text-[11px] leading-relaxed';
        note.style.color = 'var(--muted-foreground)';
        note.textContent = '窗分數中位 = 各視窗的 OOS 品質 × 統計權重後取中位；Walk-Forward 總分 = 窗分數中位乘上 WFE 調整係數（限制在 0.8～1.2 範圍內）。';
        container.appendChild(note);

        const list = document.createElement('ul');
        list.className = 'list-disc pl-4 space-y-1';

        const addItem = (label, value) => {
            const li = document.createElement('li');
            li.textContent = `${label}：${value}`;
            list.appendChild(li);
        };

        addItem('窗分數中位', formatScore(aggregate.medianWindowScore));
        addItem('WFE 調整係數', Number.isFinite(aggregate.wfeAdjustment) ? trimNumber(aggregate.wfeAdjustment) : '—');
        addItem('總分（0-100）', formatScorePoints(aggregate.totalScore));
        addItem('通過視窗', `${aggregate.passCount}/${aggregate.totalWindows}`);

        container.appendChild(list);
        return container;
    }

    function buildQualityDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1 space-y-2';

        const note = document.createElement('p');
        note.className = 'text-[11px] leading-relaxed';
        note.style.color = 'var(--muted-foreground)';
        note.textContent = '品質分數中位為各視窗指標分數的中位數，指標達門檻即得 1 分，未達門檻依差距線性遞減；加權原值為未扣除達標權重比例前的加權平均。年化報酬門檻改採同期間買入持有的年化報酬率。';
        container.appendChild(note);

        const summary = document.createElement('p');
        summary.textContent = `品質分數中位 ${formatScore(aggregate.medianOosQuality)}（加權原值 ${formatScore(aggregate.medianOosQualityRaw)}），達標權重比 ${formatProbability(aggregate.medianOosPassRatio)}。`;
        container.appendChild(summary);

        const credibilityLine = document.createElement('p');
        credibilityLine.textContent = `統計可信度中位 ${formatProbability(aggregate.medianCredibility)}、統計權重中位 ${formatScore(aggregate.medianStatWeight)}。`;
        container.appendChild(credibilityLine);

        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'space-y-1';

        const header = document.createElement('div');
        header.className = 'grid grid-cols-4 gap-2 font-medium';
        header.innerHTML = '<span>指標</span><span class="text-right">中位值</span><span class="text-right">門檻</span><span class="text-right">分數</span>';
        gridWrapper.appendChild(header);

        const thresholds = aggregate.thresholds || DEFAULT_THRESHOLDS;
        const thresholdMedians = aggregate.qualityThresholdMedians || {};
        const componentScores = aggregate.qualityComponentMedians || {};
        const componentConfig = [
            {
                key: 'annualizedReturn',
                label: '年化報酬',
                median: aggregate.medianAnnualizedReturn,
                comparator: '≥',
                formatter: formatPercent,
            },
            {
                key: 'sharpeRatio',
                label: 'Sharpe',
                median: aggregate.medianSharpe,
                comparator: '≥',
                formatter: formatNumber,
            },
            {
                key: 'sortinoRatio',
                label: 'Sortino',
                median: aggregate.medianSortino,
                comparator: '≥',
                formatter: formatNumber,
            },
            {
                key: 'maxDrawdown',
                label: '最大回撤',
                median: aggregate.medianMaxDrawdown,
                comparator: '≤',
                formatter: formatPercent,
            },
            {
                key: 'winRate',
                label: '勝率',
                median: aggregate.medianWinRate,
                comparator: '≥',
                formatter: formatPercent,
            },
        ];

        componentConfig.forEach((config) => {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-4 gap-2 text-[11px] items-center';

            const labelEl = document.createElement('span');
            labelEl.textContent = config.label;

            const medianEl = document.createElement('span');
            medianEl.className = 'text-right';
            medianEl.textContent = config.formatter(config.median);

            const thresholdEl = document.createElement('span');
            thresholdEl.className = 'text-right';
            const thresholdValue = Number.isFinite(thresholdMedians[config.key])
                ? thresholdMedians[config.key]
                : thresholds[config.key];
            thresholdEl.textContent = Number.isFinite(thresholdValue)
                ? `${config.comparator} ${config.formatter(thresholdValue)}`
                : '—';

            const scoreEl = document.createElement('span');
            scoreEl.className = 'text-right';
            scoreEl.textContent = Number.isFinite(componentScores[config.key])
                ? formatScore(componentScores[config.key])
                : '—';

            row.appendChild(labelEl);
            row.appendChild(medianEl);
            row.appendChild(thresholdEl);
            row.appendChild(scoreEl);
            gridWrapper.appendChild(row);
        });

        container.appendChild(gridWrapper);
        return container;
    }

    function buildWfeDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1 space-y-2';

        const summary = document.createElement('p');
        summary.textContent = `WFE 中位 ${formatPercent(aggregate.medianWfePercent)}，調整係數 ${Number.isFinite(aggregate.wfeAdjustment) ? trimNumber(aggregate.wfeAdjustment) : '—'}（建議 ≥ ${WALK_FORWARD_EFFICIENCY_BASELINE}%）。`;
        container.appendChild(summary);

        const values = Array.isArray(aggregate.wfeValuesPercent) ? aggregate.wfeValuesPercent : [];
        const items = values
            .map((value, index) => (Number.isFinite(value) ? `視窗 ${index + 1}：${formatPercent(value)}` : null))
            .filter((item) => item);
        if (items.length > 0) {
            const list = document.createElement('ul');
            list.className = 'list-disc pl-4 space-y-1';
            items.forEach((text) => {
                const li = document.createElement('li');
                li.textContent = text;
                list.appendChild(li);
            });
            container.appendChild(list);
        }

        return container;
    }

    function buildCredibilityDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1 space-y-2';

        const sampleText = Number.isFinite(aggregate.medianSampleCount)
            ? `${Math.round(aggregate.medianSampleCount)} 筆`
            : '—';
        const minTrlText = Number.isFinite(aggregate.medianMinTrackRecordLength)
            ? `／需求 ≥ ${Math.ceil(aggregate.medianMinTrackRecordLength)} 日`
            : '';
        const summary = document.createElement('p');
        summary.textContent = `PSR≥95% 視窗比 ${formatProbability(aggregate.psrAbove95Ratio)}，DSR 中位 ${formatProbability(aggregate.medianDsr)}，樣本中位 ${sampleText}${minTrlText}。`;
        container.appendChild(summary);

        const list = document.createElement('ul');
        list.className = 'list-disc pl-4 space-y-1';
        const psrValues = Array.isArray(aggregate.psrValues) ? aggregate.psrValues : [];
        const dsrValues = Array.isArray(aggregate.dsrValues) ? aggregate.dsrValues : [];
        const sampleCounts = Array.isArray(aggregate.sampleCounts) ? aggregate.sampleCounts : [];
        const minTrlValues = Array.isArray(aggregate.minTrackRecordValues) ? aggregate.minTrackRecordValues : [];

        aggregate.evaluations.forEach((evaluation, index) => {
            const psrText = Number.isFinite(psrValues[index]) ? formatProbability(psrValues[index]) : '—';
            const dsrText = Number.isFinite(dsrValues[index]) ? formatProbability(dsrValues[index]) : '—';
            const sampleValue = Number.isFinite(sampleCounts[index]) ? Math.round(sampleCounts[index]) : null;
            const minTrlValue = Number.isFinite(minTrlValues[index]) ? Math.ceil(minTrlValues[index]) : null;
            const details = [];
            details.push(`PSR ${psrText}`);
            details.push(`DSR ${dsrText}`);
            if (sampleValue !== null) details.push(`樣本 ${sampleValue}`);
            if (minTrlValue !== null) details.push(`需求 ≥ ${minTrlValue}`);
            if (details.length === 0) return;
            const li = document.createElement('li');
            li.textContent = `視窗 ${index + 1}：${details.join('、')}`;
            list.appendChild(li);
        });

        if (list.children.length > 0) {
            container.appendChild(list);
        }
        return container;
    }

    function buildSharpeDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1';

        const list = document.createElement('ul');
        list.className = 'list-disc pl-4 space-y-1';

        const items = [
            `整體 Sharpe ${formatNumber(aggregate.overallSharpe)}`,
            `整體 PSR ${formatProbability(aggregate.overallPsr)}`,
            `整體 DSR ${formatProbability(aggregate.overallDsr)}`,
            `Sharpe 中位 ${formatNumber(aggregate.medianSharpe)}`,
            `Sortino 中位 ${formatNumber(aggregate.medianSortino)}`,
            `最大回撤中位 ${formatPercent(aggregate.medianMaxDrawdown)}`,
            `勝率中位 ${formatPercent(aggregate.medianWinRate)}`,
        ];

        if (Number.isFinite(aggregate.medianMinTrackRecordLength)) {
            items.push(`MinTRL 中位 ≥ ${Math.ceil(aggregate.medianMinTrackRecordLength)} 日`);
        }

        items.forEach((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });

        container.appendChild(list);
        return container;
    }

    function buildPassRateDetail(aggregate) {
        const container = document.createElement('div');
        container.className = 'mt-1 space-y-2';

        const summary = document.createElement('p');
        summary.textContent = `通過 ${aggregate.passCount}/${aggregate.totalWindows} 視窗（${formatPercent(aggregate.passRate)}）`;
        container.appendChild(summary);

        const list = document.createElement('ul');
        list.className = 'list-disc pl-4 space-y-1';
        aggregate.evaluations.forEach((evaluation, index) => {
            const li = document.createElement('li');
            const status = evaluation.evaluation.pass ? '通過' : '未通過';
            let text = `視窗 ${index + 1}：${status}`;
            if (!evaluation.evaluation.pass && Array.isArray(evaluation.evaluation.reasons) && evaluation.evaluation.reasons.length > 0) {
                text += `（${evaluation.evaluation.reasons.join('、')}）`;
            }
            li.textContent = text;
            list.appendChild(li);
        });

        if (list.children.length > 0) {
            container.appendChild(list);
        }
        return container;
    }

    function describeTotalScoreStatus(aggregate) {
        if (!Number.isFinite(aggregate?.totalScore)) return '尚未計分';
        if (aggregate.gradeLevel === 2) return '合格';
        if (aggregate.gradeLevel === 1) return '可觀察';
        if (aggregate.gradeLevel === 0) return '需調整';
        return '尚未計分';
    }

    function describeQualityStatus(aggregate) {
        const quality = Number.isFinite(aggregate?.medianOosQuality) ? aggregate.medianOosQuality : null;
        const credibility = Number.isFinite(aggregate?.medianCredibility) ? aggregate.medianCredibility : null;
        const passRatio = Number.isFinite(aggregate?.medianOosPassRatio) ? aggregate.medianOosPassRatio : null;
        if (quality === null || credibility === null) {
            return '尚未評分';
        }
        if (passRatio === null) {
            return '樣本不足';
        }
        const qualityPass = quality >= 0.7;
        const ratioPass = passRatio >= 0.7;
        const credibilityPass = credibility >= 0.5;
        if (qualityPass && ratioPass && credibilityPass) return '合格';
        if (!ratioPass) return '指標多數未達標';
        if (!qualityPass) return '品質需加強';
        if (!credibilityPass) return '信度需加強';
        return '持續觀察';
    }

    function describeWfeStatus(aggregate) {
        const wfe = Number.isFinite(aggregate?.medianWfePercent) ? aggregate.medianWfePercent : null;
        if (wfe === null) return '尚未評分';
        if (wfe >= 80) return '合格';
        if (wfe >= 60) return '略低';
        return '不足';
    }

    function describeCredibilityStatus(aggregate) {
        const psrRatio = Number.isFinite(aggregate?.psrAbove95Ratio) ? aggregate.psrAbove95Ratio : null;
        const medianDsr = Number.isFinite(aggregate?.medianDsr) ? aggregate.medianDsr : null;
        if (psrRatio === null || medianDsr === null) {
            return '樣本不足';
        }
        const psrPass = psrRatio >= 0.5;
        const dsrPass = medianDsr >= 0.7;
        if (psrPass && dsrPass) return '合格';
        if (!psrPass && dsrPass) return 'PSR 偏低';
        if (psrPass && !dsrPass) return 'DSR 偏低';
        return '需補樣本';
    }

    function describeSharpeStatus(aggregate) {
        const sharpe = Number.isFinite(aggregate?.overallSharpe) ? aggregate.overallSharpe : null;
        const dsr = Number.isFinite(aggregate?.overallDsr) ? aggregate.overallDsr : null;
        if (sharpe === null) return '尚未評分';
        const sharpeThreshold = Number.isFinite(aggregate?.thresholds?.sharpeRatio)
            ? aggregate.thresholds.sharpeRatio
            : DEFAULT_THRESHOLDS.sharpeRatio;
        const sharpePass = sharpe >= sharpeThreshold;
        const dsrPass = Number.isFinite(dsr) && dsr > 0;
        if (sharpePass && dsrPass) return '合格';
        if (sharpePass) return '顯著度待加強';
        if (dsrPass) return 'Sharpe 偏低';
        return '未達門檻';
    }

    function describePassRateStatus(aggregate) {
        const passRate = Number.isFinite(aggregate?.passRate) ? aggregate.passRate : null;
        if (passRate === null) return '尚未評分';
        if (passRate >= 60) return '合格';
        if (passRate >= 40) return '略低';
        return '不足';
    }

    function renderWindowTable(aggregate) {
        const header = document.getElementById('rolling-window-header');
        const tbody = document.getElementById('rolling-window-report');
        if (!header || !tbody) return;

        header.innerHTML = '';
        tbody.innerHTML = '';

        const evaluations = Array.isArray(aggregate?.evaluations) ? aggregate.evaluations : [];

        const leadHeader = document.createElement('th');
        leadHeader.className = 'px-3 py-2 text-left font-semibold';
        leadHeader.textContent = '指標';
        header.appendChild(leadHeader);

        evaluations.forEach((entry, index) => {
            const th = document.createElement('th');
            th.className = 'px-3 py-2 text-left font-semibold';
            th.textContent = `視窗 ${index + 1}`;
            header.appendChild(th);
        });

        if (evaluations.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = evaluations.length + 1;
            cell.className = 'px-3 py-4 text-center text-sm';
            cell.textContent = '尚無資料';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        const rows = [
            {
                label: '測試期間',
                className: 'text-left',
                getValue: (entry) => `${entry.window.testingStart} ~ ${entry.window.testingEnd}`,
            },
            {
                label: '年化%',
                className: (entry) => {
                    if (Number.isFinite(entry.metrics.annualizedReturn)) {
                        return `text-right ${entry.metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
                    }
                    return 'text-right';
                },
                getValue: (entry) => formatPercent(entry.metrics.annualizedReturn),
            },
            {
                label: 'Sharpe',
                className: 'text-right',
                getValue: (entry) => formatNumber(entry.metrics.sharpeRatio),
            },
            {
                label: 'Sortino',
                className: 'text-right',
                getValue: (entry) => formatNumber(entry.metrics.sortinoRatio),
            },
            {
                label: 'MaxDD%',
                className: 'text-right',
                getValue: (entry) => formatPercent(entry.metrics.maxDrawdown),
            },
            {
                label: '勝率%',
                className: 'text-right',
                getValue: (entry) => formatPercent(entry.metrics.winRate),
            },
            {
                label: '交易數',
                className: 'text-right',
                getValue: (entry) => (Number.isFinite(entry.metrics.tradesCount) ? entry.metrics.tradesCount : '—'),
            },
            {
                label: 'PSR95',
                className: 'text-right',
                getValue: (entry) => formatProbability(entry.analysis?.psrProbability),
            },
            {
                label: 'DSR',
                className: 'text-right',
                getValue: (entry) => formatProbability(entry.analysis?.dsrProbability),
            },
            {
                label: '可信度',
                className: 'text-right',
                getValue: (entry) => formatProbability(entry.analysis?.credibility),
            },
            {
                label: 'WFE%',
                className: 'text-right',
                getValue: (entry) => (Number.isFinite(entry.analysis?.wfe) ? formatPercent(entry.analysis.wfe) : '—'),
            },
            {
                label: '窗分數',
                className: 'text-right',
                getValue: (entry) => formatScorePoints(entry.analysis?.windowScore),
            },
            {
                label: '樣本',
                className: 'text-right',
                getValue: (entry) => {
                    const samples = Number.isFinite(entry.analysis?.sampleCount) ? entry.analysis.sampleCount : null;
                    const minTrl = Number.isFinite(entry.analysis?.minTrackRecordLength) ? entry.analysis.minTrackRecordLength : null;
                    if (Number.isFinite(samples)) {
                        const requirement = Number.isFinite(minTrl) && minTrl > samples ? ` / ≥ ${Math.ceil(minTrl)}` : '';
                        return `${Math.round(samples)}${requirement}`;
                    }
                    return '—';
                },
            },
            {
                label: '參數摘要',
                className: 'text-left whitespace-pre-wrap',
                getValue: (entry) => buildParameterSummary(entry.paramsSnapshot),
            },
            {
                label: '評語',
                className: 'text-left',
                getValue: (entry) => entry.comment || '—',
            },
        ];

        rows.forEach((rowConfig) => {
            const tr = document.createElement('tr');

            const labelCell = document.createElement('td');
            labelCell.className = 'px-3 py-2 font-semibold text-left';
            labelCell.textContent = rowConfig.label;
            tr.appendChild(labelCell);

            evaluations.forEach((entry, index) => {
                const cell = document.createElement('td');
                const className = typeof rowConfig.className === 'function'
                    ? rowConfig.className(entry, index)
                    : rowConfig.className || 'text-right';
                cell.className = `px-3 py-2 ${className}`.trim();
                cell.textContent = rowConfig.getValue(entry, index);
                tr.appendChild(cell);
            });

            tbody.appendChild(tr);
        });
    }

    function buildParameterSummary(params) {
        if (!params || typeof params !== 'object') return '—';
        const segments = [];

        const longSegment = describeTradingSide('多頭', {
            entryStrategy: params.entryStrategy,
            entryParams: params.entryParams,
            entryStages: params.entryStages,
            exitStrategy: params.exitStrategy,
            exitParams: params.exitParams,
            exitStages: params.exitStages,
        });
        if (longSegment) segments.push(longSegment);

        if (params.enableShorting) {
            const shortSegment = describeTradingSide('空頭', {
                entryStrategy: params.shortEntryStrategy,
                entryParams: params.shortEntryParams,
                entryStages: params.shortEntryStages,
                exitStrategy: params.shortExitStrategy,
                exitParams: params.shortExitParams,
                exitStages: params.shortExitStages,
                scopePrefix: 'short',
            });
            if (shortSegment) segments.push(shortSegment);
        }

        const risk = buildRiskSummary(params);
        if (risk) segments.push(`風控：${risk}`);

        return segments.length > 0 ? segments.join('｜') : '—';
    }

    function describeTradingSide(label, config) {
        const entrySummary = describeStrategyFlow('入', config.entryStrategy, config.entryParams, config.entryStages, config.scopePrefix ? `${config.scopePrefix}Entry` : 'entry');
        const exitSummary = describeStrategyFlow('出', config.exitStrategy, config.exitParams, config.exitStages, config.scopePrefix ? `${config.scopePrefix}Exit` : 'exit');
        const parts = [entrySummary, exitSummary].filter(Boolean);
        if (parts.length === 0) return '';
        return `${label} ${parts.join(' → ')}`;
    }

    function describeStrategyFlow(prefix, strategyKey, paramObj, stages, scope) {
        const strategyName = resolveStrategyDisplayName(strategyKey, scope);
        if (!strategyName) return '';
        const paramText = formatParamEntries(paramObj);
        const stageText = formatStageSummary(stages);
        const details = [paramText, stageText].filter(Boolean).join('、');
        return `${prefix}:${strategyName}${details ? `（${details}）` : ''}`;
    }

    function resolveStrategyDisplayName(strategyKey, scope) {
        if (!strategyKey) return '';
        let lookupKey = strategyKey;
        if (scope) {
            lookupKey = resolveStrategyConfigKey(strategyKey, scope) || strategyKey;
        }
        const info = strategyDescriptions?.[lookupKey];
        if (info?.name) return info.name;
        if (info?.label) return info.label;
        return strategyKey;
    }

    function formatParamEntries(paramObj) {
        if (!paramObj || typeof paramObj !== 'object') return '';
        const entries = Object.entries(paramObj)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => {
                const formatted = formatParamValue(value);
                if (!formatted) return null;
                const label = PARAM_NAME_LABELS[key] || key;
                return `${label}=${formatted}`;
            })
            .filter((entry) => entry);
        if (entries.length === 0) return '';
        const compact = entries.slice(0, 2);
        if (entries.length > 2) compact.push('…');
        return compact.join('、');
    }

    function formatParamValue(value) {
        if (Array.isArray(value)) {
            const formatted = value
                .filter((item) => item !== null && item !== undefined && item !== '')
                .map((item) => formatParamValue(item))
                .filter((item) => item !== '');
            return formatted.join(' / ');
        }
        if (typeof value === 'number') {
            return trimNumber(value);
        }
        if (typeof value === 'boolean') {
            return value ? '是' : '否';
        }
        if (typeof value === 'string') {
            return value.trim();
        }
        return '';
    }

    function formatStageSummary(stages) {
        if (!Array.isArray(stages) || stages.length === 0) return '';
        const valid = stages
            .map((stage) => (Number.isFinite(stage) ? Number(stage) : null))
            .filter((stage) => stage !== null && stage > 0);
        if (valid.length === 0) return '';
        return `分批 ${valid.map((stage) => `${trimNumber(stage)}%`).join(' + ')}`;
    }

    function buildRiskSummary(params) {
        const parts = [];
        if (Number.isFinite(params.stopLoss) && params.stopLoss > 0) {
            parts.push(`停損 ${trimNumber(params.stopLoss)}%`);
        }
        if (Number.isFinite(params.takeProfit) && params.takeProfit > 0) {
            parts.push(`停利 ${trimNumber(params.takeProfit)}%`);
        }
        const timing = resolveTradeTimingLabel(params.tradeTiming);
        if (timing) parts.push(`執行點 ${timing}`);
        const basis = resolvePositionBasisLabel(params.positionBasis);
        if (basis) parts.push(`部位基準 ${basis}`);
        return parts.join('、');
    }

    function resolveTradeTimingLabel(value) {
        if (value === 'close') return '收盤';
        if (value === 'open') return '開盤';
        return '';
    }

    function resolvePositionBasisLabel(value) {
        if (value === 'initialCapital') return '初始本金-固定金額買入';
        if (value === 'totalCapital') return '總資金-獲利再投入';
        return '';
    }

    function trimNumber(value) {
        if (!Number.isFinite(value)) return '';
        const abs = Math.abs(value);
        if (abs >= 100) return value.toFixed(0);
        if (abs >= 10) return value.toFixed(1).replace(/\.0$/, '');
        return value.toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '');
    }

    function computeAggregateReport(entries, thresholds, options = {}) {
        const resolvedThresholds = {
            annualizedReturn: resolveThreshold(thresholds?.annualizedReturn, DEFAULT_THRESHOLDS.annualizedReturn),
            sharpeRatio: resolveThreshold(thresholds?.sharpeRatio, DEFAULT_THRESHOLDS.sharpeRatio),
            sortinoRatio: resolveThreshold(thresholds?.sortinoRatio, DEFAULT_THRESHOLDS.sortinoRatio),
            maxDrawdown: resolveThreshold(thresholds?.maxDrawdown, DEFAULT_THRESHOLDS.maxDrawdown),
            winRate: resolveThreshold(thresholds?.winRate, DEFAULT_THRESHOLDS.winRate),
        };

        const srBenchmark = Number.isFinite(options?.srBenchmark) ? options.srBenchmark : resolvedThresholds.sharpeRatio;
        const optimizationTrials = options?.optimizationEnabled
            ? Math.max(1, Number(options?.optimizationTrials) || 60)
            : 1;

        const evaluations = entries.map((entry) => {
            const evaluation = evaluateWindow(entry.testing, resolvedThresholds);
            const commentParts = [];
            const analysis = computeWindowAnalysis(entry.testing, resolvedThresholds, {
                srBenchmark,
                trialCount: optimizationTrials,
            });
            if (entry.testing) {
                entry.testing.analysis = analysis;
            }

            if (entry.testing?.error) {
                commentParts.push(entry.testing.error);
            } else {
                if (evaluation.pass) {
                    commentParts.push('✓ 通過門檻');
                } else if (evaluation.reasons.length > 0) {
                    commentParts.push(evaluation.reasons.join('、'));
                }
                if (Number.isFinite(entry.training?.annualizedReturn) && Number.isFinite(entry.testing?.annualizedReturn)) {
                    commentParts.push(`訓練 ${formatPercent(entry.training.annualizedReturn)} → 測試 ${formatPercent(entry.testing.annualizedReturn)}`);
                }
                if (Number.isFinite(analysis?.minTrackRecordLength) && Number.isFinite(analysis?.sampleCount)
                    && analysis.sampleCount > 0 && analysis.minTrackRecordLength > analysis.sampleCount) {
                    commentParts.push(`樣本不足：需 ≥ ${Math.ceil(analysis.minTrackRecordLength)} 日`);
                }
                if (entry.optimization) {
                    if (Array.isArray(entry.optimization.messages) && entry.optimization.messages.length > 0) {
                        commentParts.push(entry.optimization.messages.join('；'));
                    } else if (entry.optimization.error) {
                        commentParts.push(`優化失敗：${entry.optimization.error}`);
                    }
                }
            }

            return {
                index: entry.index,
                window: entry.window,
                metrics: entry.testing,
                evaluation,
                paramsSnapshot: entry.paramsSnapshot,
                comment: commentParts.join('；') || '—',
                analysis,
            };
        });

        const validMetrics = evaluations
            .map((ev) => ev.metrics)
            .filter((metrics) => metrics && !metrics.error);

        const analyses = evaluations
            .map((ev) => ev.analysis)
            .filter((analysis) => analysis && typeof analysis === 'object');

        const averageAnnualizedReturn = average(validMetrics.map((m) => m.annualizedReturn));
        const averageSharpe = average(validMetrics.map((m) => m.sharpeRatio));
        const averageSortino = average(validMetrics.map((m) => m.sortinoRatio));
        const averageMaxDrawdown = average(validMetrics.map((m) => m.maxDrawdown));
        const medianAnnualizedReturn = median(validMetrics.map((m) => m.annualizedReturn));
        const medianSharpe = median(validMetrics.map((m) => m.sharpeRatio));
        const medianSortino = median(validMetrics.map((m) => m.sortinoRatio));
        const medianMaxDrawdown = median(validMetrics.map((m) => m.maxDrawdown));
        const medianWinRate = median(validMetrics.map((m) => m.winRate));
        const medianTrades = median(validMetrics.map((m) => m.tradesCount));
        const passCount = evaluations.filter((ev) => ev.evaluation.pass).length;
        const passRate = evaluations.length > 0 ? (passCount / evaluations.length) * 100 : 0;

        const windowScores = analyses.map((analysis) => (Number.isFinite(analysis?.windowScore) ? analysis.windowScore : null));
        const medianWindowScore = median(windowScores);

        const wfeValuesPercent = analyses.map((analysis) => (Number.isFinite(analysis?.wfe) ? analysis.wfe : null));
        const medianWfePercent = median(wfeValuesPercent);
        const medianWfeRatio = Number.isFinite(medianWfePercent) ? medianWfePercent / 100 : null;
        const wfeAdjustment = Number.isFinite(medianWfeRatio)
            ? clampNumber(medianWfeRatio, WFE_ADJUST_MIN, WFE_ADJUST_MAX)
            : 1;
        const totalScoreRaw = Number.isFinite(medianWindowScore) ? medianWindowScore * wfeAdjustment : null;
        const totalScore = Number.isFinite(totalScoreRaw) ? clampNumber(totalScoreRaw, 0, 1) : null;

        const oosQualityValues = analyses.map((analysis) => (Number.isFinite(analysis?.oosQuality?.value) ? analysis.oosQuality.value : null));
        const medianOosQuality = median(oosQualityValues);
        const oosQualityRawValues = analyses.map((analysis) => (Number.isFinite(analysis?.oosQuality?.rawValue) ? analysis.oosQuality.rawValue : null));
        const medianOosQualityRaw = median(oosQualityRawValues);
        const oosPassRatios = analyses.map((analysis) => (Number.isFinite(analysis?.oosQuality?.passRatio) ? analysis.oosQuality.passRatio : null));
        const medianOosPassRatio = median(oosPassRatios);
        const qualityComponentsList = analyses.map((analysis) => (analysis?.oosQuality?.components && typeof analysis.oosQuality.components === 'object'
            ? analysis.oosQuality.components
            : null));
        const qualityComponentMedians = computeMedianComponents(qualityComponentsList);
        const qualityThresholdList = analyses
            .map((analysis) => (analysis?.oosQuality?.thresholds && typeof analysis.oosQuality.thresholds === 'object'
                ? analysis.oosQuality.thresholds
                : null));
        const qualityThresholdMedians = computeMedianComponents(qualityThresholdList);
        const credibilityValues = analyses.map((analysis) => (Number.isFinite(analysis?.credibility) ? analysis.credibility : null));
        const medianCredibility = median(credibilityValues);
        const statWeightValues = analyses.map((analysis) => (Number.isFinite(analysis?.statWeight) ? analysis.statWeight : null));
        const medianStatWeight = median(statWeightValues);

        const psrValues = analyses.map((analysis) => (Number.isFinite(analysis?.psrProbability) ? analysis.psrProbability : null));
        const dsrValues = analyses.map((analysis) => (Number.isFinite(analysis?.dsrProbability) ? analysis.dsrProbability : null));
        const medianPsr = median(psrValues);
        const medianDsr = median(dsrValues);
        const psrAbove95Count = analyses.filter((analysis) => Number.isFinite(analysis?.psrProbability) && analysis.psrProbability >= 0.95).length;
        const psrAbove95Ratio = analyses.length > 0 ? psrAbove95Count / analyses.length : 0;

        const sampleCounts = analyses.map((analysis) => (Number.isFinite(analysis?.sampleCount) ? analysis.sampleCount : null));
        const medianSampleCount = median(sampleCounts);
        const minTrackRecordValues = analyses.map((analysis) => (Number.isFinite(analysis?.minTrackRecordLength) ? analysis.minTrackRecordLength : null));
        const medianMinTrackRecordLength = median(minTrackRecordValues);

        const overallMoments = combineReturnMoments(analyses.map((analysis) => analysis?.stats));
        const overallSharpe = computeAnnualizedSharpeFromMoments(overallMoments);
        const overallPsr = computeProbabilisticSharpeProbability({
            sharpe: overallSharpe,
            benchmark: srBenchmark,
            sampleCount: overallMoments?.sampleCount,
            skewness: overallMoments?.skewness,
            kurtosis: overallMoments?.kurtosis,
        });
        const overallDsr = computeDeflatedSharpeProbability({
            sharpe: overallSharpe,
            benchmark: srBenchmark,
            sampleCount: overallMoments?.sampleCount,
            skewness: overallMoments?.skewness,
            kurtosis: overallMoments?.kurtosis,
            trials: optimizationTrials,
        });

        let grade = resolveGrade({
            totalScore,
            medianWfeRatio,
            psrRatio: psrAbove95Ratio,
            medianDsr,
        });
        let gradeDowngraded = false;
        if (Number.isFinite(overallDsr) && overallDsr <= 0 && grade.level > 0) {
            gradeDowngraded = true;
            if (grade.level === 2) {
                grade = { label: '可進一步觀察', color: 'var(--accent)', level: 1 };
            } else if (grade.level === 1) {
                grade = { label: '未通過建議調整', color: 'var(--destructive)', level: 0 };
            }
        }

        const effectiveThresholds = { ...resolvedThresholds };
        if (Number.isFinite(qualityThresholdMedians?.annualizedReturn)) {
            effectiveThresholds.annualizedReturn = qualityThresholdMedians.annualizedReturn;
        }

        const summaryText = buildSummaryText({
            gradeLabel: grade.label,
            totalScore,
            passCount,
            total: evaluations.length,
            medianOosQuality,
            medianOosPassRatio,
            medianCredibility,
            medianWfePercent,
            psrAbove95Ratio,
            medianDsr,
            overallSharpe,
            overallPsr,
            overallDsr,
            passRate,
            thresholds: effectiveThresholds,
            gradeDowngraded,
        });

        return {
            evaluations,
            totalScore,
            scorePoints: Number.isFinite(totalScore) ? totalScore * 100 : null,
            medianWindowScore,
            wfeAdjustment,
            medianWfePercent,
            medianWfeRatio,
            passCount,
            passRate,
            totalWindows: evaluations.length,
            gradeLabel: grade.label,
            gradeColor: grade.color,
            gradeLevel: grade.level,
            gradeDowngraded,
            summaryText,
            averageAnnualizedReturn,
            averageSharpe,
            averageSortino,
            averageMaxDrawdown,
            medianAnnualizedReturn,
            medianSharpe,
            medianSortino,
            medianMaxDrawdown,
            medianWinRate,
            medianTrades,
            medianOosQuality,
            medianOosPassRatio,
            medianCredibility,
            medianStatWeight,
            medianPsr,
            medianDsr,
            psrAbove95Ratio,
            medianSampleCount,
            medianMinTrackRecordLength,
            overallSharpe,
            overallPsr,
            overallDsr,
            thresholds: effectiveThresholds,
            medianOosQualityRaw,
            qualityComponentMedians,
            qualityThresholdMedians,
            qualityComponents: qualityComponentsList,
            oosQualityValues,
            oosPassRatios,
            windowScores,
            wfeValuesPercent,
            credibilityValues,
            psrValues,
            dsrValues,
            sampleCounts,
            minTrackRecordValues,
            oosQualityRawValues,
        };
    }

    function buildSummaryText(context) {
        const parts = [];
        parts.push(`${context.gradeLabel} · Walk-Forward 總分 ${formatScorePoints(context.totalScore)}`);
        parts.push(`OOS 品質中位 ${formatScore(context.medianOosQuality)}，統計可信度中位 ${formatProbability(context.medianCredibility)}`);
        if (Number.isFinite(context.medianOosPassRatio)) {
            parts.push(`指標達標權重比 ${formatProbability(context.medianOosPassRatio)}`);
        }
        if (Number.isFinite(context.medianWfePercent)) {
            parts.push(`WFE 中位 ${formatPercent(context.medianWfePercent)}，PSR≥95% 視窗比 ${formatProbability(context.psrAbove95Ratio)}`);
        }
        if (Number.isFinite(context.overallSharpe) || Number.isFinite(context.overallPsr) || Number.isFinite(context.overallDsr)) {
            const sharpeText = Number.isFinite(context.overallSharpe) ? `Sharpe ${formatNumber(context.overallSharpe)}` : null;
            const psrText = Number.isFinite(context.overallPsr) ? `PSR ${formatProbability(context.overallPsr)}` : null;
            const dsrText = Number.isFinite(context.overallDsr) ? `DSR ${formatProbability(context.overallDsr)}` : null;
            const combined = [sharpeText, psrText, dsrText].filter(Boolean).join('，');
            if (combined) parts.push(`整體 ${combined}`);
        }
        parts.push(`共有 ${context.passCount}/${context.total} 視窗符合門檻（Sharpe ≥ ${context.thresholds.sharpeRatio}、Sortino ≥ ${context.thresholds.sortinoRatio}、MaxDD ≤ ${formatPercent(context.thresholds.maxDrawdown)}、勝率 ≥ ${context.thresholds.winRate}%）`);
        if (context.gradeDowngraded) {
            parts.push('整體 DSR 未達 0，已將等級下修一級');
        }
        return parts.join('；');
    }

    function resolveGrade(criteria) {
        const totalScore = Number.isFinite(criteria?.totalScore) ? criteria.totalScore : null;
        const medianWfeRatio = Number.isFinite(criteria?.medianWfeRatio) ? criteria.medianWfeRatio : null;
        const psrRatio = Number.isFinite(criteria?.psrRatio) ? criteria.psrRatio : null;
        const medianDsr = Number.isFinite(criteria?.medianDsr) ? criteria.medianDsr : null;

        if (totalScore === null || medianWfeRatio === null || psrRatio === null) {
            return { label: '尚無結果', color: 'var(--muted-foreground)', level: -1 };
        }

        if (totalScore >= 0.70 && medianWfeRatio >= 0.8 && psrRatio >= 0.5 && (!Number.isFinite(medianDsr) || medianDsr >= 0.7)) {
            return { label: '專業合格', color: 'var(--primary)', level: 2 };
        }

        if (totalScore >= 0.50 && medianWfeRatio >= 0.6 && psrRatio >= 0.3) {
            return { label: '可進一步觀察', color: 'var(--accent)', level: 1 };
        }

        return { label: '未通過建議調整', color: 'var(--destructive)', level: 0 };
    }

    function evaluateWindow(metrics, thresholds) {
        const reasons = [];
        if (!metrics || metrics.error) {
            reasons.push(metrics?.error || '無法取得結果');
            return { pass: false, reasons };
        }

        const checks = [];
        if (Number.isFinite(metrics.annualizedReturn)) {
            const annThreshold = resolveAnnualizedReturnThreshold(metrics, thresholds);
            if (Number.isFinite(annThreshold)) {
                const pass = metrics.annualizedReturn >= annThreshold;
                if (!pass) reasons.push(`年化報酬低於 ${formatPercent(annThreshold)}`);
                checks.push(pass);
            }
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
            buyHoldAnnualizedReturn: toFiniteNumber(result.buyHoldAnnualizedReturn),
            oosStats: sanitizeOosStats(result.oosDailyStats),
        };
    }

    function toFiniteNumber(value) {
        return Number.isFinite(value) ? Number(value) : null;
    }

    function sanitizeOosStats(stats) {
        if (!stats || typeof stats !== 'object') {
            return null;
        }
        const normalize = (value) => (Number.isFinite(value) ? Number(value) : null);
        const sampleCount = Number.isFinite(stats.sampleCount) && stats.sampleCount > 0
            ? Math.round(stats.sampleCount)
            : 0;
        return {
            sampleCount,
            sum1: normalize(stats.sum1) ?? 0,
            sum2: normalize(stats.sum2) ?? 0,
            sum3: normalize(stats.sum3) ?? 0,
            sum4: normalize(stats.sum4) ?? 0,
            mean: normalize(stats.mean),
            variance: normalize(stats.variance),
            stdDev: normalize(stats.stdDev),
            skewness: normalize(stats.skewness),
            kurtosis: normalize(stats.kurtosis),
        };
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

    function clamp01(value) {
        if (!Number.isFinite(value)) return 0;
        if (value <= 0) return 0;
        if (value >= 1) return 1;
        return value;
    }

    function normalizeRange(value, min, max) {
        if (!Number.isFinite(value)) return null;
        if (!Number.isFinite(min)) min = 0;
        if (!Number.isFinite(max) || max <= min) return null;
        const ratio = (value - min) / (max - min);
        return clamp01(ratio);
    }

    function normalizeInverseRange(value, best, worst) {
        if (!Number.isFinite(value)) return null;
        if (!Number.isFinite(best) || !Number.isFinite(worst)) return null;
        if (worst <= best) return value <= best ? 1 : 0;
        const ratio = (worst - value) / (worst - best);
        return clamp01(ratio);
    }

    function standardNormalCDF(x) {
        if (!Number.isFinite(x)) return null;
        return 0.5 * (1 + erf(x / Math.sqrt(2)));
    }

    function standardNormalInverse(p) {
        if (!Number.isFinite(p) || p <= 0 || p >= 1) {
            if (p === 0) return -Infinity;
            if (p === 1) return Infinity;
            return null;
        }
        const a = [
            -3.969683028665376e+01,
            2.209460984245205e+02,
            -2.759285104469687e+02,
            1.383577518672690e+02,
            -3.066479806614716e+01,
            2.506628277459239e+00,
        ];
        const b = [
            -5.447609879822406e+01,
            1.615858368580409e+02,
            -1.556989798598866e+02,
            6.680131188771972e+01,
            -1.328068155288572e+01,
        ];
        const c = [
            -7.784894002430293e-03,
            -3.223964580411365e-01,
            -2.400758277161838e+00,
            -2.549732539343734e+00,
            4.374664141464968e+00,
            2.938163982698783e+00,
        ];
        const d = [
            7.784695709041462e-03,
            3.224671290700398e-01,
            2.445134137142996e+00,
            3.754408661907416e+00,
        ];
        const plow = 0.02425;
        const phigh = 1 - plow;
        let q;
        let result;
        if (p < plow) {
            q = Math.sqrt(-2 * Math.log(p));
            result = ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5];
            result /= (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1;
            return -result;
        }
        if (p > phigh) {
            q = Math.sqrt(-2 * Math.log(1 - p));
            result = ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5];
            result /= (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1;
            return result;
        }
        q = p - 0.5;
        const r = q * q;
        result = ((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5];
        result *= q;
        result /= (((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4] + 1;
        return result;
    }

    function erf(x) {
        const sign = x >= 0 ? 1 : -1;
        const absX = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + p * absX);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
        return sign * y;
    }

    function resolveThreshold(value, fallback) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
        return fallback;
    }

    function resolveAnnualizedReturnThreshold(metrics, thresholds) {
        const baseline = toFiniteNumber(metrics?.buyHoldAnnualizedReturn);
        if (Number.isFinite(baseline)) {
            return baseline;
        }
        return resolveThreshold(thresholds?.annualizedReturn, DEFAULT_THRESHOLDS.annualizedReturn);
    }

    function computePositiveMetricScore(value, threshold) {
        const numericValue = toFiniteNumber(value);
        const numericThreshold = toFiniteNumber(threshold);
        if (!Number.isFinite(numericValue) || !Number.isFinite(numericThreshold)) {
            return null;
        }
        if (numericValue >= numericThreshold) {
            return 1;
        }
        const range = Math.max(Math.abs(numericThreshold), 1);
        const floor = numericThreshold - range;
        const denominator = numericThreshold - floor;
        if (!Number.isFinite(denominator) || denominator <= 0) {
            return 0;
        }
        const ratio = (numericValue - floor) / denominator;
        return clamp01(ratio);
    }

    function computeNegativeMetricScore(value, threshold) {
        const numericValue = toFiniteNumber(value);
        const numericThreshold = toFiniteNumber(threshold);
        if (!Number.isFinite(numericValue) || !Number.isFinite(numericThreshold)) {
            return null;
        }
        if (numericValue <= numericThreshold) {
            return 1;
        }
        const range = Math.max(Math.abs(numericThreshold), 5);
        const ceiling = numericThreshold + range;
        const denominator = ceiling - numericThreshold;
        if (!Number.isFinite(denominator) || denominator <= 0) {
            return 0;
        }
        const ratio = (ceiling - numericValue) / denominator;
        return clamp01(ratio);
    }

    function computeOosQualityScore(metrics, thresholds) {
        if (!metrics || metrics.error) {
            return { value: null, components: {}, passRatio: 0, rawValue: null, thresholds: {} };
        }
        const components = {};
        const thresholdsUsed = {};
        let weightedSum = 0;
        let weightTotal = 0;
        let passWeight = 0;

        const accumulate = (key, score, weight, passed, thresholdValue) => {
            const normalized = Number.isFinite(score) ? clamp01(score) : 0;
            components[key] = normalized;
            if (Number.isFinite(thresholdValue)) {
                thresholdsUsed[key] = thresholdValue;
            }
            weightedSum += weight * normalized;
            weightTotal += weight;
            if (passed) {
                passWeight += weight;
            }
        };

        const annThreshold = resolveAnnualizedReturnThreshold(metrics, thresholds);
        const annValue = toFiniteNumber(metrics.annualizedReturn);
        const annScore = computePositiveMetricScore(annValue, annThreshold);
        const annPass = Number.isFinite(annValue) && Number.isFinite(annThreshold) && annValue >= annThreshold;
        accumulate('annualizedReturn', annScore, QUALITY_WEIGHTS.annualizedReturn, annPass, annThreshold);

        const sharpeThreshold = resolveThreshold(thresholds?.sharpeRatio, DEFAULT_THRESHOLDS.sharpeRatio);
        const sharpeValue = toFiniteNumber(metrics.sharpeRatio);
        const sharpeScore = computePositiveMetricScore(sharpeValue, sharpeThreshold);
        const sharpePass = Number.isFinite(sharpeValue) && Number.isFinite(sharpeThreshold) && sharpeValue >= sharpeThreshold;
        accumulate('sharpeRatio', sharpeScore, QUALITY_WEIGHTS.sharpeRatio, sharpePass, sharpeThreshold);

        const sortinoThreshold = resolveThreshold(thresholds?.sortinoRatio, DEFAULT_THRESHOLDS.sortinoRatio);
        const sortinoValue = toFiniteNumber(metrics.sortinoRatio);
        const sortinoScore = computePositiveMetricScore(sortinoValue, sortinoThreshold);
        const sortinoPass = Number.isFinite(sortinoValue) && Number.isFinite(sortinoThreshold) && sortinoValue >= sortinoThreshold;
        accumulate('sortinoRatio', sortinoScore, QUALITY_WEIGHTS.sortinoRatio, sortinoPass, sortinoThreshold);

        const drawdownThreshold = resolveThreshold(thresholds?.maxDrawdown, DEFAULT_THRESHOLDS.maxDrawdown);
        const drawdownValue = toFiniteNumber(metrics.maxDrawdown);
        const drawdownScore = computeNegativeMetricScore(drawdownValue, drawdownThreshold);
        const drawdownPass = Number.isFinite(drawdownValue) && Number.isFinite(drawdownThreshold) && drawdownValue <= drawdownThreshold;
        accumulate('maxDrawdown', drawdownScore, QUALITY_WEIGHTS.maxDrawdown, drawdownPass, drawdownThreshold);

        const winRateThreshold = resolveThreshold(thresholds?.winRate, DEFAULT_THRESHOLDS.winRate);
        const winRateValue = toFiniteNumber(metrics.winRate);
        const winRateScore = computePositiveMetricScore(winRateValue, winRateThreshold);
        const winRatePass = Number.isFinite(winRateValue) && Number.isFinite(winRateThreshold) && winRateValue >= winRateThreshold;
        accumulate('winRate', winRateScore, QUALITY_WEIGHTS.winRate, winRatePass, winRateThreshold);

        const rawValue = weightTotal > 0 ? weightedSum / weightTotal : null;
        const passRatio = weightTotal > 0 ? clamp01(passWeight / weightTotal) : 0;
        const value = Number.isFinite(rawValue) ? Math.min(rawValue, passRatio) : null;
        return {
            value,
            components,
            passRatio,
            rawValue,
            thresholds: thresholdsUsed,
        };
    }

    function computeMedianComponents(componentList) {
        const keys = new Set();
        componentList.forEach((components) => {
            if (!components || typeof components !== 'object') return;
            Object.keys(components).forEach((key) => keys.add(key));
        });
        const result = {};
        keys.forEach((key) => {
            const values = componentList
                .map((components) => (components && Number.isFinite(components[key]) ? components[key] : null));
            const medianValue = median(values);
            if (Number.isFinite(medianValue)) {
                result[key] = medianValue;
            }
        });
        return result;
    }

    function computeWindowAnalysis(metrics, thresholds, options) {
        const srBenchmark = Number.isFinite(options?.srBenchmark) ? options.srBenchmark : thresholds.sharpeRatio;
        const trialCount = Math.max(1, Number(options?.trialCount) || 1);
        const wfe = Number.isFinite(metrics?.walkForwardEfficiency) ? metrics.walkForwardEfficiency : null;
        const stats = metrics?.oosStats && typeof metrics.oosStats === 'object' ? metrics.oosStats : null;
        const sampleCount = Number.isFinite(stats?.sampleCount) && stats.sampleCount > 0 ? stats.sampleCount : 0;

        const quality = computeOosQualityScore(metrics, thresholds);
        const sharpe = toFiniteNumber(metrics?.sharpeRatio);
        const skewness = Number.isFinite(stats?.skewness) ? stats.skewness : null;
        const kurtosis = Number.isFinite(stats?.kurtosis) ? stats.kurtosis : null;

        const psr = computeProbabilisticSharpeProbability({
            sharpe,
            benchmark: srBenchmark,
            sampleCount,
            skewness,
            kurtosis,
        });

        const dsr = computeDeflatedSharpeProbability({
            sharpe,
            benchmark: srBenchmark,
            sampleCount,
            skewness,
            kurtosis,
            trials: trialCount,
        });

        const psrContribution = Number.isFinite(psr) ? psr : 0;
        const dsrContribution = Number.isFinite(dsr) ? dsr : 0;
        const credibility = clamp01((psrContribution + dsrContribution) / 2);
        const statWeight = 0.5 + 0.5 * credibility;
        const windowScore = (Number.isFinite(quality.value) ? quality.value : 0) * statWeight;

        const minTrackRecordLength = computeMinTrackRecordLength({
            sharpe,
            benchmark: srBenchmark,
            sampleCount,
            skewness,
            kurtosis,
            confidence: MIN_TRACK_RECORD_CONFIDENCE,
        });

        return {
            oosQuality: quality,
            psrProbability: Number.isFinite(psr) ? clamp01(psr) : null,
            dsrProbability: Number.isFinite(dsr) ? clamp01(dsr) : null,
            credibility,
            statWeight,
            windowScore,
            minTrackRecordLength: Number.isFinite(minTrackRecordLength) ? minTrackRecordLength : null,
            sampleCount,
            stats,
            wfe,
        };
    }

    function computeProbabilisticSharpeProbability(args) {
        const sharpe = toFiniteNumber(args?.sharpe);
        const sampleCount = Number.isFinite(args?.sampleCount) ? args.sampleCount : 0;
        if (!Number.isFinite(sharpe) || sampleCount <= 1) return null;
        const benchmark = Number.isFinite(args?.benchmark) ? args.benchmark : 0;
        const diff = sharpe - benchmark;
        const skewness = Number.isFinite(args?.skewness) ? args.skewness : 0;
        const kurtosis = Number.isFinite(args?.kurtosis) ? args.kurtosis : 3;
        const varianceTerm = 1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
        if (!Number.isFinite(varianceTerm) || varianceTerm <= 0) return null;
        const denominator = Math.sqrt(varianceTerm / (sampleCount - 1));
        if (!Number.isFinite(denominator) || denominator <= 0) return null;
        const z = diff / denominator;
        const probability = standardNormalCDF(z);
        return Number.isFinite(probability) ? clamp01(probability) : null;
    }

    function computeDeflatedSharpeProbability(args) {
        const sharpe = toFiniteNumber(args?.sharpe);
        const sampleCount = Number.isFinite(args?.sampleCount) ? args.sampleCount : 0;
        if (!Number.isFinite(sharpe) || sampleCount <= 1) return null;
        const benchmark = Number.isFinite(args?.benchmark) ? args.benchmark : 0;
        const diff = sharpe - benchmark;
        const skewness = Number.isFinite(args?.skewness) ? args.skewness : 0;
        const kurtosis = Number.isFinite(args?.kurtosis) ? args.kurtosis : 3;
        const varianceTerm = 1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
        if (!Number.isFinite(varianceTerm) || varianceTerm <= 0) return null;
        const zBase = diff * Math.sqrt(sampleCount - 1);
        const denominator = Math.sqrt(varianceTerm);
        if (!Number.isFinite(denominator) || denominator <= 0) return null;
        const z = zBase / denominator;
        const trials = Math.max(1, Number(args?.trials) || 1);
        const penalty = standardNormalInverse(1 - 1 / (2 * trials));
        if (!Number.isFinite(penalty)) return null;
        const probability = standardNormalCDF(z - penalty);
        return Number.isFinite(probability) ? clamp01(probability) : null;
    }

    function computeMinTrackRecordLength(args) {
        const sharpe = toFiniteNumber(args?.sharpe);
        const benchmark = Number.isFinite(args?.benchmark) ? args.benchmark : 0;
        if (!Number.isFinite(sharpe)) return null;
        const diff = sharpe - benchmark;
        if (!(diff > 0)) return Infinity;
        const skewness = Number.isFinite(args?.skewness) ? args.skewness : 0;
        const kurtosis = Number.isFinite(args?.kurtosis) ? args.kurtosis : 3;
        const varianceTerm = 1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
        if (!Number.isFinite(varianceTerm) || varianceTerm <= 0) return null;
        const confidence = Number.isFinite(args?.confidence) ? args.confidence : 0.95;
        const z = standardNormalInverse(confidence);
        if (!Number.isFinite(z) || z <= 0) return null;
        const minSamples = 1 + Math.pow((z * Math.sqrt(varianceTerm)) / diff, 2);
        return Number.isFinite(minSamples) ? minSamples : null;
    }

    function combineReturnMoments(statsList) {
        if (!Array.isArray(statsList) || statsList.length === 0) return null;
        const totals = { sampleCount: 0, sum1: 0, sum2: 0, sum3: 0, sum4: 0 };
        statsList.forEach((stats) => {
            if (!stats || !Number.isFinite(stats.sampleCount) || stats.sampleCount <= 0) return;
            totals.sampleCount += stats.sampleCount;
            totals.sum1 += Number(stats.sum1) || 0;
            totals.sum2 += Number(stats.sum2) || 0;
            totals.sum3 += Number(stats.sum3) || 0;
            totals.sum4 += Number(stats.sum4) || 0;
        });
        if (totals.sampleCount < 2) return null;
        const n = totals.sampleCount;
        const mean = totals.sum1 / n;
        const diff2Sum = totals.sum2 - (totals.sum1 * totals.sum1) / n;
        const variance = diff2Sum > 0 ? diff2Sum / (n - 1) : 0;
        const stdDev = variance > 0 ? Math.sqrt(variance) : 0;
        const diff3Sum = totals.sum3 - 3 * mean * totals.sum2 + 3 * mean * mean * totals.sum1 - n * Math.pow(mean, 3);
        const diff4Sum = totals.sum4 - 4 * mean * totals.sum3 + 6 * mean * mean * totals.sum2 - 4 * Math.pow(mean, 3) * totals.sum1 + n * Math.pow(mean, 4);

        let skewness = null;
        if (n > 2 && diff2Sum > 0) {
            skewness = Math.sqrt(n * (n - 1)) * diff3Sum / ((n - 2) * Math.pow(diff2Sum, 1.5));
        }

        let kurtosis = null;
        if (n > 3 && variance > 0) {
            const denominator = (n - 1) * (n - 2) * (n - 3) * Math.pow(stdDev, 4);
            const correction = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
            const numerator = n * (n + 1) * diff4Sum;
            const excess = denominator !== 0 ? numerator / denominator - correction : null;
            kurtosis = excess !== null ? excess + 3 : null;
        }

        return {
            sampleCount: n,
            sum1: totals.sum1,
            sum2: totals.sum2,
            sum3: totals.sum3,
            sum4: totals.sum4,
            mean,
            variance,
            stdDev,
            skewness,
            kurtosis,
        };
    }

    function computeAnnualizedSharpeFromMoments(moment) {
        if (!moment || !Number.isFinite(moment.sampleCount) || moment.sampleCount < 2) return null;
        const dailyMean = Number.isFinite(moment.mean) ? moment.mean : (Number.isFinite(moment.sum1) ? moment.sum1 / moment.sampleCount : null);
        const dailyStd = Number.isFinite(moment.stdDev) ? moment.stdDev : null;
        if (!Number.isFinite(dailyMean) || !Number.isFinite(dailyStd) || dailyStd <= 0) return null;
        const annualMean = dailyMean * DAYS_PER_YEAR;
        const annualStd = dailyStd * Math.sqrt(DAYS_PER_YEAR);
        if (!Number.isFinite(annualStd) || annualStd <= 0) return null;
        return (annualMean - RISK_FREE_RATE) / annualStd;
    }

    function computeRollingWindows(config, availability) {
        if (!config || !config.baseStart || !config.baseEnd) return [];
        if (!availability) return [];

        const windows = [];
        const targetWindows = Number.isFinite(config?.windowCount) ? Math.max(1, Math.round(config.windowCount)) : null;
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

            if (targetWindows && windows.length >= targetWindows) break;

            currentTrainStart = addMonthsClamped(currentTrainStart, config.stepMonths);
            if (!currentTrainStart || currentTrainStart >= finalDate) break;
        }

        return windows;
    }

    function runSingleWindow(baseParams, startIso, endIso, context) {
        return new Promise((resolve, reject) => {
            try {
                const payload = prepareWorkerPayload(baseParams, startIso, endIso);
                if (!payload) {
                    reject(new Error('無法準備回測參數'));
                    return;
                }
                state.progress.stage = context?.phase || '';
                updateProgressUI(`視窗 ${context?.windowIndex}/${context?.totalWindows} · ${context?.phase || ''}`);

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

    function deriveAutoWindowDurations({ baseStart, baseEnd, availability, windowCount }) {
        const fallbackAvailability = availability || (baseStart && baseEnd ? { start: baseStart, end: baseEnd } : null);
        const effectiveStart = baseStart || fallbackAvailability?.start || null;
        const effectiveEnd = baseEnd || fallbackAvailability?.end || null;
        const defaultDurations = {
            trainingMonths: clampNumber(DEFAULT_WINDOW_RATIO.training, 6, 180),
            testingMonths: clampNumber(DEFAULT_WINDOW_RATIO.testing, 3, 72),
            stepMonths: clampNumber(DEFAULT_WINDOW_RATIO.step, 1, 36),
        };

        if (!effectiveStart || !effectiveEnd) {
            return defaultDurations;
        }

        const rangeMonths = computeMonthsBetween(effectiveStart, effectiveEnd);
        const targetCount = Number.isFinite(windowCount) ? Math.max(1, Math.round(windowCount)) : DEFAULT_WINDOW_COUNT;
        if (!Number.isFinite(rangeMonths) || rangeMonths <= 0) {
            return defaultDurations;
        }

        const ratioTotal = DEFAULT_WINDOW_RATIO.training
            + DEFAULT_WINDOW_RATIO.testing
            + DEFAULT_WINDOW_RATIO.step * Math.max(0, targetCount - 1);
        let scale = ratioTotal > 0 ? rangeMonths / ratioTotal : 1;
        if (!Number.isFinite(scale) || scale <= 0) scale = 1;

        const applyScale = (scaleValue) => ({
            trainingMonths: clampNumber(Math.max(6, Math.round(DEFAULT_WINDOW_RATIO.training * scaleValue)), 6, 180),
            testingMonths: clampNumber(Math.max(3, Math.round(DEFAULT_WINDOW_RATIO.testing * scaleValue)), 3, 72),
            stepMonths: clampNumber(Math.max(1, Math.round(DEFAULT_WINDOW_RATIO.step * scaleValue)), 1, 36),
        });

        const evaluateDurations = (durations) => {
            if (!fallbackAvailability) {
                return { count: targetCount, durations };
            }
            const candidateConfig = {
                trainingMonths: durations.trainingMonths,
                testingMonths: durations.testingMonths,
                stepMonths: durations.stepMonths,
                baseStart: effectiveStart,
                baseEnd: effectiveEnd,
                windowCount: targetCount,
            };
            const windows = computeRollingWindows(candidateConfig, fallbackAvailability);
            return { count: Array.isArray(windows) ? windows.length : 0, durations };
        };

        let best = evaluateDurations(applyScale(scale));
        let bestDiff = Math.abs(best.count - targetCount);

        if (fallbackAvailability) {
            let lowScale = scale / 4;
            let highScale = scale * 4;
            if (!Number.isFinite(lowScale) || lowScale <= 0) lowScale = scale / 2 || 0.5;
            if (!Number.isFinite(highScale) || highScale <= lowScale) highScale = lowScale + 1;

            for (let i = 0; i < 10; i += 1) {
                const testScale = (lowScale + highScale) / 2;
                const candidate = evaluateDurations(applyScale(testScale));
                const diff = Math.abs(candidate.count - targetCount);

                if (diff < bestDiff || (diff === bestDiff && candidate.count >= targetCount && best.count < targetCount)) {
                    best = candidate;
                    bestDiff = diff;
                }

                if (candidate.count === targetCount) break;
                if (candidate.count > targetCount) lowScale = testScale;
                else highScale = testScale;
            }
        }

        return best.durations;
    }

    function syncAutoDurationInputs(durations) {
        const trainingEl = document.getElementById('rolling-training-months');
        const testingEl = document.getElementById('rolling-testing-months');
        const stepEl = document.getElementById('rolling-step-months');
        if (trainingEl) trainingEl.value = String(durations.trainingMonths);
        if (testingEl) testingEl.value = String(durations.testingMonths);
        if (stepEl) stepEl.value = String(durations.stepMonths);
    }

    function getRollingConfig(availability) {
        const windowCountRaw = clampNumber(readInputValue('rolling-window-count', DEFAULT_WINDOW_COUNT), 1, 24);
        const windowCount = Math.max(1, Math.round(windowCountRaw));
        const thresholds = {
            annualizedReturn: clampNumber(readInputValue('rolling-threshold-ann', DEFAULT_THRESHOLDS.annualizedReturn), 0, 200),
            sharpeRatio: clampNumber(readInputValue('rolling-threshold-sharpe', DEFAULT_THRESHOLDS.sharpeRatio), 0, 10),
            sortinoRatio: clampNumber(readInputValue('rolling-threshold-sortino', DEFAULT_THRESHOLDS.sortinoRatio), 0, 10),
            maxDrawdown: clampNumber(readInputValue('rolling-threshold-maxdd', DEFAULT_THRESHOLDS.maxDrawdown), 1, 100),
            winRate: clampNumber(readInputValue('rolling-threshold-win', DEFAULT_THRESHOLDS.winRate), 0, 100),
        };
        const params = typeof getBacktestParams === 'function' ? getBacktestParams() : null;
        const optimization = getRollingOptimizationConfig();
        const baseStart = params?.startDate || availability?.start || lastFetchSettings?.startDate || null;
        const baseEnd = params?.endDate || availability?.end || lastFetchSettings?.endDate || null;

        let trainingMonths;
        let testingMonths;
        let stepMonths;

        if (isAdvancedSettingsActive()) {
            trainingMonths = clampNumber(readInputValue('rolling-training-months', DEFAULT_WINDOW_RATIO.training), 6, 180);
            testingMonths = clampNumber(readInputValue('rolling-testing-months', DEFAULT_WINDOW_RATIO.testing), 3, 72);
            stepMonths = clampNumber(readInputValue('rolling-step-months', DEFAULT_WINDOW_RATIO.step), 1, 36);
        } else {
            const durations = deriveAutoWindowDurations({
                baseStart,
                baseEnd,
                availability,
                windowCount,
            });
            trainingMonths = durations.trainingMonths;
            testingMonths = durations.testingMonths;
            stepMonths = durations.stepMonths;
            syncAutoDurationInputs(durations);
        }

        return {
            trainingMonths,
            testingMonths,
            stepMonths,
            thresholds,
            baseStart,
            baseEnd,
            optimization,
            windowCount,
        };
    }

    function getRollingOptimizationConfig() {
        const enabled = Boolean(document.getElementById('rolling-optimize-enabled')?.checked);
        const targetSelect = document.getElementById('rolling-optimize-target');
        const targetMetric = targetSelect?.value || 'annualizedReturn';
        const trialsValue = clampNumber(readInputValue('rolling-optimize-trials', 60), 5, 500);
        const trials = Math.max(5, Math.round(trialsValue));
        const optimizeEntry = Boolean(document.getElementById('rolling-optimize-entry')?.checked);
        const optimizeExit = Boolean(document.getElementById('rolling-optimize-exit')?.checked);
        const optimizeShortEntry = Boolean(document.getElementById('rolling-optimize-short-entry')?.checked);
        const optimizeShortExit = Boolean(document.getElementById('rolling-optimize-short-exit')?.checked);
        const optimizeRisk = Boolean(document.getElementById('rolling-optimize-risk')?.checked);
        let iterationLimit = Number.NaN;

        const rollingIterationEl = document.getElementById('rolling-optimize-iteration-limit');
        if (rollingIterationEl && rollingIterationEl.value !== '') {
            const parsed = parseFloat(rollingIterationEl.value);
            if (Number.isFinite(parsed)) iterationLimit = parsed;
        }

        if (!Number.isFinite(iterationLimit)) {
            const batchIterationEl = document.getElementById('batch-optimize-iteration-limit');
            if (batchIterationEl && batchIterationEl.value !== '') {
                const parsed = parseFloat(batchIterationEl.value);
                if (Number.isFinite(parsed)) iterationLimit = parsed;
            }
        }

        if (!Number.isFinite(iterationLimit)) {
            iterationLimit = DEFAULT_OPTIMIZATION_ITERATIONS;
        }

        iterationLimit = clampNumber(Math.round(iterationLimit), 1, 100);

        return {
            enabled,
            targetMetric,
            trials,
            optimizeEntry,
            optimizeExit,
            optimizeShortEntry,
            optimizeShortExit,
            optimizeRisk,
            iterationLimit,
        };
    }

    function syncRollingOptimizeUI() {
        const toggle = document.getElementById('rolling-optimize-enabled');
        const container = document.getElementById('rolling-optimize-settings');
        if (!toggle || !container) return;

        const enabled = Boolean(toggle.checked);
        if (enabled) container.classList.remove('hidden');
        else container.classList.add('hidden');

        const shortEnabled = Boolean(document.getElementById('enableShortSelling')?.checked);
        const shortControls = document.querySelectorAll('#rolling-optimize-panel .rolling-optimize-short');
        shortControls.forEach((label) => {
            if (!(label instanceof HTMLElement)) return;
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (!checkbox) return;
            if (shortEnabled) {
                checkbox.disabled = false;
                label.classList.remove('opacity-60');
            } else {
                checkbox.checked = false;
                checkbox.disabled = true;
                label.classList.add('opacity-60');
            }
        });
    }

    const OPTIMIZE_SCOPE_DEFINITIONS = {
        entry: { strategyKey: 'entryStrategy', paramsKey: 'entryParams', label: '做多進場' },
        exit: { strategyKey: 'exitStrategy', paramsKey: 'exitParams', label: '做多出場' },
        shortEntry: { strategyKey: 'shortEntryStrategy', paramsKey: 'shortEntryParams', label: '做空進場' },
        shortExit: { strategyKey: 'shortExitStrategy', paramsKey: 'shortExitParams', label: '回補出場' },
    };

    function buildRollingOptimizationPlan(optConfig, baseParams) {
        const normalized = {
            enabled: Boolean(optConfig?.enabled),
            targetMetric: optConfig?.targetMetric || 'annualizedReturn',
            trials: Number.isFinite(optConfig?.trials) ? Math.max(5, Math.round(optConfig.trials)) : 60,
            optimizeEntry: Boolean(optConfig?.optimizeEntry),
            optimizeExit: Boolean(optConfig?.optimizeExit),
            optimizeShortEntry: Boolean(optConfig?.optimizeShortEntry),
            optimizeShortExit: Boolean(optConfig?.optimizeShortExit),
            optimizeRisk: Boolean(optConfig?.optimizeRisk),
            iterationLimit: Number.isFinite(optConfig?.iterationLimit)
                ? Math.max(1, Math.round(optConfig.iterationLimit))
                : DEFAULT_OPTIMIZATION_ITERATIONS,
        };

        const plan = {
            enabled: false,
            scopes: [],
            config: normalized,
        };

        if (!normalized.enabled || !baseParams) {
            return plan;
        }

        const scopes = resolveOptimizationScopes(normalized, baseParams);
        plan.scopes = scopes;
        plan.enabled = scopes.length > 0;
        return plan;
    }

    function resolveOptimizationScopes(optConfig, baseParams) {
        if (!optConfig?.enabled || !baseParams) return [];
        if (typeof strategyDescriptions !== 'object' || !strategyDescriptions) return [];

        const scopes = [];
        const canOptimize = (strategyName, scope) => {
            if (!strategyName) return false;
            const key = resolveStrategyConfigKey(strategyName, scope);
            const info = strategyDescriptions?.[key];
            return Boolean(info?.optimizeTargets && info.optimizeTargets.length > 0);
        };

        if (optConfig.optimizeEntry && canOptimize(baseParams.entryStrategy, 'entry')) {
            scopes.push('entry');
        }
        if (optConfig.optimizeExit && canOptimize(baseParams.exitStrategy, 'exit')) {
            scopes.push('exit');
        }
        if (optConfig.optimizeShortEntry && baseParams.enableShorting && canOptimize(baseParams.shortEntryStrategy, 'shortEntry')) {
            scopes.push('shortEntry');
        }
        if (optConfig.optimizeShortExit && baseParams.enableShorting && canOptimize(baseParams.shortExitStrategy, 'shortExit')) {
            scopes.push('shortExit');
        }
        if (optConfig.optimizeRisk) {
            const hasRiskTargets = Boolean(globalOptimizeTargets?.stopLoss?.range || globalOptimizeTargets?.takeProfit?.range);
            if (hasRiskTargets) scopes.push('risk');
        }

        return scopes;
    }

    function buildTrainingWindowBaseParams(baseParams, windowInfo) {
        const clone = deepClone(baseParams || {});
        normalizeWindowBaseParams(clone, windowInfo);
        return clone;
    }

    function normalizeWindowBaseParams(target, windowInfo) {
        if (!target || typeof target !== 'object') return;
        if (windowInfo?.trainingStart) target.startDate = windowInfo.trainingStart;
        if (windowInfo?.trainingEnd) target.endDate = windowInfo.trainingEnd;
        stripRelativeRangeControls(target);
        clearWindowDerivedFields(target);
        target.entryStages = normalizeStageArray(target.entryStages, target.positionSize, 100);
        target.exitStages = normalizeStageArray(target.exitStages, 100, 100);
    }

    function stripRelativeRangeControls(target) {
        const keys = [
            'recentYears',
            'recentMonths',
            'recentQuarters',
            'recentWeeks',
            'recentDays',
            'recentRange',
            'useRecentYears',
            'useRecentRange',
        ];
        keys.forEach((key) => {
            if (key in target) delete target[key];
        });
    }

    function clearWindowDerivedFields(target) {
        ['dataStartDate', 'effectiveStartDate', 'lookbackDays'].forEach((key) => {
            if (key in target) delete target[key];
        });
    }

    function normalizeStageArray(values, fallbackPrimary, fallbackDefault) {
        const resolved = Array.isArray(values)
            ? values
                .map((val) => {
                    const num = Number(val);
                    return Number.isFinite(num) && num > 0 ? num : null;
                })
                .filter((val) => Number.isFinite(val) && val > 0)
            : [];
        if (resolved.length > 0) return resolved;
        if (Number.isFinite(fallbackPrimary) && fallbackPrimary > 0) return [Number(fallbackPrimary)];
        if (Number.isFinite(fallbackDefault) && fallbackDefault > 0) return [Number(fallbackDefault)];
        return [];
    }

    async function optimizeParametersForWindow(baseWindowParams, windowInfo, plan) {
        const targetMetric = plan?.config?.targetMetric || 'annualizedReturn';
        const metricLabel = resolveMetricLabel(targetMetric);
        const summary = {
            targetMetric,
            metricLabel,
            messages: [],
            scopeResults: [],
            engine: 'batchOptimizationWorker',
        };

        const outputParams = deepClone(baseWindowParams);
        normalizeWindowBaseParams(outputParams, windowInfo);

        if (!plan?.enabled || !Array.isArray(plan.scopes) || plan.scopes.length === 0) {
            return { params: outputParams, summary };
        }

        if (!state.batchOptimizerInitialized && window.batchOptimization && typeof window.batchOptimization.init === 'function') {
            try {
                window.batchOptimization.init();
                state.batchOptimizerInitialized = true;
            } catch (error) {
                console.warn('[Rolling Test] Failed to initialize batch optimization module:', error);
            }
        }

        if (typeof optimizeSingleStrategyParameter !== 'function') {
            summary.error = '缺少批量優化模組';
            summary.messages.push('優化模組未載入，已沿用原始參數。');
            return { params: outputParams, summary };
        }

        if (typeof strategyDescriptions !== 'object' || !strategyDescriptions) {
            summary.error = '無法讀取策略參數設定';
            summary.messages.push('找不到策略參數範圍，已沿用原始參數。');
            return { params: outputParams, summary };
        }

        const workingParams = deepClone(baseWindowParams);
        normalizeWindowBaseParams(workingParams, windowInfo);

        const trainingPayload = prepareWorkerPayload(workingParams, windowInfo.trainingStart, windowInfo.trainingEnd);
        const cachedWindowData = selectCachedDataForWindow(trainingPayload?.dataStartDate, windowInfo.trainingEnd);

        const baselineSnapshots = captureOptimizationBaselines(plan.scopes, outputParams);
        const scopeResults = [];
        const handledScopes = new Set();

        const combinationScopes = Array.isArray(plan.scopes)
            ? plan.scopes.filter((scope) => scope === 'entry' || scope === 'exit')
            : [];

        const optimizationOptions = {
            cachedDataOverride: cachedWindowData,
        };

        if (combinationScopes.length > 0 && typeof window.batchOptimization?.runCombinationOptimization === 'function') {
            try {
                const combinationOutcome = await runCombinationOptimizationForWindow({
                    baseParams: workingParams,
                    plan,
                    windowInfo,
                    combinationScopes,
                    baselineSnapshots,
                    cachedData: cachedWindowData,
                });
                    if (combinationOutcome) {
                        if (combinationOutcome.params) {
                            if (combinationOutcome.params.entryParams) {
                                outputParams.entryParams = { ...combinationOutcome.params.entryParams };
                                workingParams.entryParams = { ...combinationOutcome.params.entryParams };
                            }
                            if (combinationOutcome.params.exitParams) {
                                outputParams.exitParams = { ...combinationOutcome.params.exitParams };
                                workingParams.exitParams = { ...combinationOutcome.params.exitParams };
                            }
                            if ('stopLoss' in combinationOutcome.params) {
                                outputParams.stopLoss = combinationOutcome.params.stopLoss;
                                workingParams.stopLoss = combinationOutcome.params.stopLoss;
                            }
                            if ('takeProfit' in combinationOutcome.params) {
                                outputParams.takeProfit = combinationOutcome.params.takeProfit;
                                workingParams.takeProfit = combinationOutcome.params.takeProfit;
                            }
                        }
                    if (Array.isArray(combinationOutcome.scopeResults)) {
                        combinationOutcome.scopeResults.forEach((result) => {
                            if (result.error && !summary.error) summary.error = result.error;
                            scopeResults.push(result);
                            if (result.scope) handledScopes.add(result.scope);
                        });
                    }
                }
            } catch (error) {
                console.warn('[Rolling Test] Combination optimization failed:', error);
                const message = `批量優化組合失敗：${error?.message || error}`;
                summary.messages.push(message);
                if (!summary.error) summary.error = error?.message || '批量優化組合失敗';
            }
        }

        const remainingScopes = Array.isArray(plan.scopes)
            ? plan.scopes.filter((scope) => !handledScopes.has(scope))
            : [];

        if (remainingScopes.length > 0) {
            const iterationLimit = Math.max(1, Number(plan?.config?.iterationLimit) || DEFAULT_OPTIMIZATION_ITERATIONS);
            const scopeLastResult = new Map();
            const scopeMetricHistory = new Map();

            for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
                let iterationChanged = false;

                for (let i = 0; i < remainingScopes.length; i += 1) {
                    const scope = remainingScopes[i];
                    let result = null;
                    if (scope === 'risk') {
                        result = await optimizeRiskScopeForWindow(plan, workingParams, outputParams, optimizationOptions);
                    } else {
                        result = await optimizeStrategyScopeForWindow(scope, plan, workingParams, outputParams, optimizationOptions);
                    }
                    if (!result) continue;

                    scopeLastResult.set(scope, result);

                    if (Number.isFinite(result.metricValue)) {
                        const history = scopeMetricHistory.get(scope) || [];
                        history.push(result.metricValue);
                        scopeMetricHistory.set(scope, history);
                    }

                    if (Array.isArray(result.changedKeys) && result.changedKeys.length > 0) {
                        iterationChanged = true;
                    }

                    if (result.error && !summary.error) {
                        summary.error = result.error;
                    }
                }

                if (!iterationChanged) {
                    break;
                }
            }

            const remainingResults = collectFinalScopeResults(
                remainingScopes,
                scopeLastResult,
                scopeMetricHistory,
                baselineSnapshots,
                outputParams,
                plan.config.targetMetric,
            );

            remainingResults.forEach((result) => {
                scopeResults.push(result);
            });
        }

        summary.scopeResults = scopeResults;

        summary.scopeResults.forEach((result) => {
            const message = buildOptimizationMessage(result);
            if (message) summary.messages.push(message);
        });

        if (summary.messages.length > 0) {
            summary.messages.unshift(`優化目標：${metricLabel}`);
        } else if (!summary.error) {
            summary.messages.push('優化：維持原始參數');
        }

        return { params: outputParams, summary };
    }

    function buildCombinationFromParams(params) {
        if (!params || typeof params !== 'object') return null;
        const buyStrategy = resolveStrategyConfigKey(params.entryStrategy, 'entry') || params.entryStrategy;
        const sellStrategy = resolveStrategyConfigKey(params.exitStrategy, 'exit') || params.exitStrategy;
        if (!buyStrategy || !sellStrategy) return null;

        const combination = {
            buyStrategy,
            sellStrategy,
            buyParams: deepClone(params.entryParams || {}),
            sellParams: deepClone(params.exitParams || {}),
        };

        const riskSnapshot = buildRiskParamsSnapshot(params);
        if (riskSnapshot && Object.keys(riskSnapshot).length > 0) {
            combination.riskManagement = { ...riskSnapshot };
        }

        return combination;
    }

    function buildStrategyLabelMap(strategyInfo) {
        const labelMap = {};
        if (strategyInfo && Array.isArray(strategyInfo.optimizeTargets)) {
            strategyInfo.optimizeTargets.forEach((target) => {
                labelMap[target.name] = target.label || target.name;
            });
        }
        return labelMap;
    }

    function buildCombinationScopeResult(scope, optimizedCombination, baselineSnapshots, plan) {
        const definition = OPTIMIZE_SCOPE_DEFINITIONS[scope];
        if (!definition) return null;

        const strategyName = scope === 'entry'
            ? optimizedCombination.buyStrategy
            : optimizedCombination.sellStrategy;
        const configKey = resolveStrategyConfigKey(strategyName, scope);
        const strategyInfo = strategyDescriptions?.[configKey];
        const finalParams = scope === 'entry'
            ? deepClone(optimizedCombination.buyParams || {})
            : deepClone(optimizedCombination.sellParams || {});
        const baseParams = baselineSnapshots?.[scope]
            ? deepClone(baselineSnapshots[scope])
            : {};
        const changedKeys = resolveChangedKeysFromSnapshots(baseParams, finalParams);
        const metricValue = Number.isFinite(optimizedCombination?.__finalMetric)
            ? optimizedCombination.__finalMetric
            : null;

        return {
            scope,
            label: definition.label,
            params: finalParams,
            baseParams,
            changedKeys,
            labelMap: buildStrategyLabelMap(strategyInfo),
            metricLabel: resolveMetricLabel(plan.config.targetMetric),
            metricValue,
        };
    }

    async function runCombinationOptimizationForWindow({ baseParams, plan, windowInfo, combinationScopes, baselineSnapshots, cachedData }) {
        const combination = buildCombinationFromParams(baseParams);
        if (!combination) return null;

        const overrideParams = deepClone(baseParams);
        normalizeWindowBaseParams(overrideParams, windowInfo);

        const optimizationConfig = {
            targetMetric: plan.config.targetMetric,
            parameterTrials: plan.config.trials,
            iterationLimit: plan.config.iterationLimit,
        };

        const optimizedCombination = await window.batchOptimization.runCombinationOptimization(
            combination,
            optimizationConfig,
            {
                baseParamsOverride: overrideParams,
                enabledScopes: combinationScopes,
                cachedDataOverride: cachedData,
            },
        );

        if (!optimizedCombination || typeof optimizedCombination !== 'object') {
            return null;
        }

        const scopeResults = [];
        if (combinationScopes.includes('entry')) {
            const entryResult = buildCombinationScopeResult('entry', optimizedCombination, baselineSnapshots, plan);
            if (entryResult) scopeResults.push(entryResult);
        }
        if (combinationScopes.includes('exit')) {
            const exitResult = buildCombinationScopeResult('exit', optimizedCombination, baselineSnapshots, plan);
            if (exitResult) scopeResults.push(exitResult);
        }

        const params = {};
        if (optimizedCombination.buyParams) {
            params.entryParams = { ...optimizedCombination.buyParams };
        }
        if (optimizedCombination.sellParams) {
            params.exitParams = { ...optimizedCombination.sellParams };
        }
        if (optimizedCombination.riskManagement && typeof optimizedCombination.riskManagement === 'object') {
            const { stopLoss, takeProfit } = optimizedCombination.riskManagement;
            if (Number.isFinite(stopLoss)) params.stopLoss = stopLoss;
            if (Number.isFinite(takeProfit)) params.takeProfit = takeProfit;
        }

        return {
            params,
            scopeResults,
        };
    }

    async function optimizeStrategyScopeForWindow(scope, plan, workingParams, outputParams, options = {}) {
        const definition = OPTIMIZE_SCOPE_DEFINITIONS[scope];
        if (!definition) return null;

        const strategyName = workingParams[definition.strategyKey];
        const configKey = resolveStrategyConfigKey(strategyName, scope);
        const strategyInfo = strategyDescriptions?.[configKey];
        if (!strategyInfo || !Array.isArray(strategyInfo.optimizeTargets) || strategyInfo.optimizeTargets.length === 0) {
            return { scope, label: definition.label, skipped: true, changedKeys: [] };
        }

        const labelMap = {};
        strategyInfo.optimizeTargets.forEach((target) => {
            labelMap[target.name] = target.label || target.name;
        });

        const baseParams = outputParams[definition.paramsKey] && Object.keys(outputParams[definition.paramsKey]).length > 0
            ? { ...outputParams[definition.paramsKey] }
            : { ...(strategyInfo.defaultParams || {}) };

        let optimizedParams = { ...baseParams };
        const changedKeys = new Set();
        const metricSnapshots = [];

        for (let i = 0; i < strategyInfo.optimizeTargets.length; i += 1) {
            const target = strategyInfo.optimizeTargets[i];
            workingParams[definition.paramsKey] = { ...optimizedParams };
            const result = await optimizeSingleStrategyParameter(
                workingParams,
                target,
                scope,
                plan.config.targetMetric,
                plan.config.trials,
                { cachedDataOverride: options.cachedDataOverride },
            );
            if (result && result.value !== undefined) {
                optimizedParams[target.name] = result.value;
                if (!areValuesClose(result.value, baseParams[target.name])) {
                    changedKeys.add(target.name);
                }
                if (Number.isFinite(result.metric)) {
                    metricSnapshots.push(result.metric);
                }
            }
        }

        outputParams[definition.paramsKey] = optimizedParams;
        workingParams[definition.paramsKey] = { ...optimizedParams };

        return {
            scope,
            label: definition.label,
            params: optimizedParams,
            baseParams,
            changedKeys: Array.from(changedKeys),
            labelMap,
            metricLabel: resolveMetricLabel(plan.config.targetMetric),
            metricValue: resolveScopeMetricValue(metricSnapshots, plan.config.targetMetric),
        };
    }

    async function optimizeRiskScopeForWindow(plan, workingParams, outputParams, options = {}) {
        if (typeof optimizeRiskManagementParameters !== 'function') {
            return { scope: 'risk', label: '風險管理', error: '缺少風險優化模組', changedKeys: [] };
        }

        const optimizeTargets = [];
        if (globalOptimizeTargets?.stopLoss?.range) {
            optimizeTargets.push({ name: 'stopLoss', range: globalOptimizeTargets.stopLoss.range });
        }
        if (globalOptimizeTargets?.takeProfit?.range) {
            optimizeTargets.push({ name: 'takeProfit', range: globalOptimizeTargets.takeProfit.range });
        }
        if (optimizeTargets.length === 0) {
            return { scope: 'risk', label: '風險管理', skipped: true, changedKeys: [] };
        }

        const baseStopLoss = Number.isFinite(outputParams.stopLoss) ? outputParams.stopLoss : 0;
        const baseTakeProfit = Number.isFinite(outputParams.takeProfit) ? outputParams.takeProfit : 0;
        const labelMap = {
            stopLoss: globalOptimizeTargets?.stopLoss?.label || '停損 (%)',
            takeProfit: globalOptimizeTargets?.takeProfit?.label || '停利 (%)',
        };

        let optimizedResult = {};
        try {
            const riskParams = deepClone(workingParams);
            optimizedResult = await optimizeRiskManagementParameters(
                riskParams,
                optimizeTargets,
                plan.config.targetMetric,
                plan.config.trials,
                { cachedDataOverride: options.cachedDataOverride },
            );
        } catch (error) {
            return { scope: 'risk', label: '風險管理', error: error?.message || '優化失敗', changedKeys: [] };
        }

        const changedKeys = [];

        if (optimizedResult && optimizedResult.stopLoss !== undefined && Number.isFinite(optimizedResult.stopLoss)) {
            outputParams.stopLoss = optimizedResult.stopLoss;
            workingParams.stopLoss = optimizedResult.stopLoss;
            if (!areValuesClose(optimizedResult.stopLoss, baseStopLoss)) changedKeys.push('stopLoss');
        }

        if (optimizedResult && optimizedResult.takeProfit !== undefined && Number.isFinite(optimizedResult.takeProfit)) {
            outputParams.takeProfit = optimizedResult.takeProfit;
            workingParams.takeProfit = optimizedResult.takeProfit;
            if (!areValuesClose(optimizedResult.takeProfit, baseTakeProfit)) changedKeys.push('takeProfit');
        }

        const resultParams = {};
        if (Number.isFinite(outputParams.stopLoss)) resultParams.stopLoss = outputParams.stopLoss;
        if (Number.isFinite(outputParams.takeProfit)) resultParams.takeProfit = outputParams.takeProfit;

        return {
            scope: 'risk',
            label: '風險管理',
            params: resultParams,
            baseParams: { stopLoss: baseStopLoss, takeProfit: baseTakeProfit },
            changedKeys,
            labelMap,
            metricLabel: resolveMetricLabel(plan.config.targetMetric),
            metricValue: null,
        };
    }

    function selectCachedDataForWindow(startIso, endIso) {
        if (!Array.isArray(cachedStockData) || cachedStockData.length === 0) return null;
        const startTime = resolveIsoTimestamp(startIso);
        const endTime = resolveIsoTimestamp(endIso);
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
        const inclusiveEnd = endTime + (24 * 60 * 60 * 1000) - 1;
        const filtered = cachedStockData.filter((row) => {
            const rowTime = resolveRowTimestamp(row);
            return Number.isFinite(rowTime) && rowTime >= startTime && rowTime <= inclusiveEnd;
        });
        return filtered.length > 0 ? filtered : null;
    }

    function resolveRowTimestamp(row) {
        if (!row || typeof row !== 'object') return Number.NaN;
        const candidates = [
            row.date,
            row.Date,
            row.tradeDate,
            row.trade_date,
            row.timestamp,
            row.time,
            row.t,
        ];
        for (let i = 0; i < candidates.length; i += 1) {
            const ts = resolveIsoTimestamp(candidates[i]);
            if (Number.isFinite(ts)) return ts;
        }
        return Number.NaN;
    }

    function resolveIsoTimestamp(value) {
        if (!value) return Number.NaN;
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return Number.NaN;
    }

    function captureOptimizationBaselines(scopes, params) {
        const snapshot = {};
        if (!Array.isArray(scopes)) return snapshot;
        scopes.forEach((scope) => {
            if (scope === 'risk') {
                snapshot.risk = buildRiskParamsSnapshot(params);
                return;
            }
            const definition = OPTIMIZE_SCOPE_DEFINITIONS[scope];
            if (!definition) return;
            snapshot[scope] = deepClone(params[definition.paramsKey] || {});
        });
        return snapshot;
    }

    function collectFinalScopeResults(scopes, scopeLastResult, scopeMetricHistory, baselines, params, targetMetric) {
        if (!Array.isArray(scopes) || scopes.length === 0) return [];
        const results = [];
        scopes.forEach((scope) => {
            const last = scopeLastResult.get(scope);
            if (!last) return;

            const definition = OPTIMIZE_SCOPE_DEFINITIONS[scope];
            let finalParams;
            if (scope === 'risk') {
                finalParams = buildRiskParamsSnapshot(params);
            } else if (definition) {
                finalParams = deepClone(params[definition.paramsKey] || {});
            } else {
                finalParams = deepClone(last.params || {});
            }

            const baseParams = baselines?.[scope] ? deepClone(baselines[scope]) : {};
            const changedKeys = resolveChangedKeysFromSnapshots(baseParams, finalParams);
            const history = scopeMetricHistory.get(scope) || [];
            const metricValue = resolveScopeMetricValue(
                history.length > 0
                    ? history
                    : (Number.isFinite(last.metricValue) ? [last.metricValue] : []),
                targetMetric,
            );

            results.push({
                ...last,
                params: finalParams,
                baseParams,
                changedKeys,
                metricValue,
                metricLabel: resolveMetricLabel(targetMetric),
            });
        });
        return results;
    }

    function buildRiskParamsSnapshot(params) {
        const snapshot = {};
        if (Number.isFinite(params?.stopLoss)) snapshot.stopLoss = params.stopLoss;
        if (Number.isFinite(params?.takeProfit)) snapshot.takeProfit = params.takeProfit;
        return snapshot;
    }

    function resolveChangedKeysFromSnapshots(baseParams, finalParams) {
        const base = baseParams || {};
        const current = finalParams || {};
        const keys = new Set([...Object.keys(base), ...Object.keys(current)]);
        return Array.from(keys).filter((key) => !areValuesClose(base[key], current[key]));
    }

    function resolveStrategyConfigKey(strategyName, scope) {
        if (!strategyName) return null;
        let key = strategyName;
        if (scope === 'exit' && strategyDescriptions?.[`${strategyName}_exit`]) {
            key = `${strategyName}_exit`;
        } else if (scope === 'shortEntry' && !strategyDescriptions?.[key] && strategyDescriptions?.[`short_${strategyName}`]) {
            key = `short_${strategyName}`;
        } else if (scope === 'shortExit' && !strategyDescriptions?.[key] && strategyDescriptions?.[`cover_${strategyName}`]) {
            key = `cover_${strategyName}`;
        }
        return key;
    }

    function buildOptimizationMessage(result) {
        if (!result || result.skipped) return null;
        if (result.error) {
            return `${result.label}優化失敗：${result.error}`;
        }
        const changedKeys = Array.isArray(result.changedKeys) ? result.changedKeys : [];
        if (changedKeys.length === 0) {
            return `${result.label}優化：維持原始參數`;
        }
        const formatted = changedKeys.map((key) => {
            const label = result.labelMap?.[key] || key;
            const value = formatOptimizationParamValue(result.params?.[key]);
            return `${label}=${value}`;
        });
        const metricText = Number.isFinite(result.metricValue)
            ? `（${result.metricLabel || '目標值'}=${formatNumber(result.metricValue)}）`
            : '';
        return `${result.label}優化：${formatted.join('、')}${metricText}`;
    }

    function formatOptimizationParamValue(value) {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return '—';
            const abs = Math.abs(value);
            if (abs >= 1000) return value.toFixed(0);
            if (abs >= 100) return value.toFixed(1).replace(/\.0$/, '');
            if (abs >= 10) return value.toFixed(1).replace(/\.0$/, '');
            return value.toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '');
        }
        return String(value);
    }

    function areValuesClose(a, b) {
        if (Number.isFinite(a) && Number.isFinite(b)) {
            const diff = Math.abs(a - b);
            const tolerance = Math.max(1e-6, Math.abs(a) * 1e-4);
            return diff <= tolerance;
        }
        return a === b;
    }

    function resolveMetricLabel(metric) {
        return METRIC_LABELS[metric] || metric;
    }

    function resolveScopeMetricValue(metrics, targetMetric) {
        if (!Array.isArray(metrics) || metrics.length === 0) return null;
        if (targetMetric === 'maxDrawdown') {
            return metrics.reduce((best, current) => {
                if (!Number.isFinite(current)) return best;
                if (!Number.isFinite(best)) return current;
                return Math.min(best, current);
            }, null);
        }
        return metrics.reduce((best, current) => {
            if (!Number.isFinite(current)) return best;
            if (!Number.isFinite(best)) return current;
            return Math.max(best, current);
        }, null);
    }

    function computeMonthsBetween(startIso, endIso) {
        if (!startIso || !endIso) return null;
        const start = new Date(startIso);
        const end = new Date(endIso);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
        const diffMs = end.getTime() - start.getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return null;
        const days = diffMs / MS_PER_DAY + 1;
        return days / 30.4375;
    }

    function computeYearsBetween(startIso, endIso) {
        const months = computeMonthsBetween(startIso, endIso);
        if (!Number.isFinite(months)) return null;
        return months / 12;
    }

    function computeWalkForwardEfficiency(trainingMetrics, testingMetrics) {
        if (!trainingMetrics || !testingMetrics) return null;
        const trainReturn = toFiniteNumber(trainingMetrics.annualizedReturn);
        const testReturn = toFiniteNumber(testingMetrics.annualizedReturn);
        if (!Number.isFinite(trainReturn) || trainReturn <= 0 || !Number.isFinite(testReturn)) return null;
        return (testReturn / trainReturn) * 100;
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
        const config = getRollingConfig(availability);
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
            setPlanWarning('請先執行一次主回測以產生快取資料');
            setPlanAdvice('');
            if (summaryEl) summaryEl.textContent = '尚未取得快取資料，請先執行一次主回測。';
            return;
        }

        setPlanWarning('');
        if (!windows || windows.length === 0) {
            if (summaryEl) summaryEl.textContent = '目前設定下無法產生有效視窗，請調整視窗長度或日期區間。';
            setPlanAdvice('');
            return;
        }

        const summaryParts = [];
        if (Number.isFinite(config.windowCount)) {
            summaryParts.push(`目標 ${config.windowCount} 次`);
        }
        summaryParts.push(`訓練 ${config.trainingMonths} 個月`);
        summaryParts.push(`測試 ${config.testingMonths} 個月`);
        summaryParts.push(`平移 ${config.stepMonths} 個月`);
        if (summaryEl) {
            summaryEl.textContent = `共 ${windows.length} 個視窗（${summaryParts.join(' / ')}）`;
        }

        if (Number.isFinite(config.windowCount) && windows.length < config.windowCount) {
            setPlanWarning(`可用資料僅能建立 ${windows.length} 個視窗，建議延長回測期間。`);
        } else {
            setPlanWarning('');
        }

        const coverageYears = computeYearsBetween(config.baseStart || availability.start, config.baseEnd || availability.end);
        if (Number.isFinite(coverageYears) && coverageYears < 5) {
            setPlanAdvice('建議使用至少五年以上的歷史資料，以提高滾動測試的可信度。');
        } else {
            setPlanAdvice('');
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

    function setPlanWarning(message) {
        const warningEl = document.getElementById('rolling-plan-warning');
        if (!warningEl) return;
        if (message) {
            warningEl.textContent = message;
            warningEl.classList.remove('hidden');
        } else {
            warningEl.textContent = '';
            warningEl.classList.add('hidden');
        }
    }

    function setPlanAdvice(message) {
        const adviceEl = document.getElementById('rolling-plan-advice');
        if (!adviceEl) return;
        if (message) {
            adviceEl.textContent = message;
            adviceEl.classList.remove('hidden');
        } else {
            adviceEl.textContent = '';
            adviceEl.classList.add('hidden');
        }
    }

    function handleVisibleDataChange() {
        if (planRefreshTimer) {
            clearTimeout(planRefreshTimer);
        }
        planRefreshTimer = setTimeout(() => {
            updateRollingPlanPreview();
        }, 120);
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

    function validateWindowCoverage(windows, rows, config) {
        if (!Array.isArray(windows) || windows.length === 0) return [];
        const issues = [];
        const datasetStart = Array.isArray(rows) && rows.length > 0 ? rows[0]?.date : null;
        const datasetEnd = Array.isArray(rows) && rows.length > 0 ? rows[rows.length - 1]?.date : null;
        const minTrainingDays = Math.max(15, Math.ceil((config?.trainingMonths || 1) * 5));
        const minTestingDays = Math.max(5, Math.ceil((config?.testingMonths || 1) * 3));

        windows.forEach((win, index) => {
            if (datasetStart && win.trainingStart < datasetStart) {
                issues.push(`視窗 ${index + 1} 的訓練起點 (${win.trainingStart}) 早於可用資料 (${datasetStart})`);
            }
            if (datasetEnd && win.testingEnd > datasetEnd) {
                issues.push(`視窗 ${index + 1} 的測試終點 (${win.testingEnd}) 超出可用資料 (${datasetEnd})`);
            }

            const trainingDays = countTradingDays(win.trainingStart, win.trainingEnd, rows);
            const testingDays = countTradingDays(win.testingStart, win.testingEnd, rows);

            if (trainingDays === 0) {
                issues.push(`視窗 ${index + 1} 的訓練區間 (${win.trainingStart} ~ ${win.trainingEnd}) 缺少交易資料`);
            } else if (trainingDays < minTrainingDays) {
                issues.push(`視窗 ${index + 1} 的訓練區間僅有 ${trainingDays} 筆交易日（建議至少 ${minTrainingDays} 筆）`);
            }

            if (testingDays === 0) {
                issues.push(`視窗 ${index + 1} 的測試區間 (${win.testingStart} ~ ${win.testingEnd}) 缺少交易資料`);
            } else if (testingDays < minTestingDays) {
                issues.push(`視窗 ${index + 1} 的測試區間僅有 ${testingDays} 筆交易日（建議至少 ${minTestingDays} 筆）`);
            }
        });

        return issues;
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

    function formatScorePoints(value, decimals = 1) {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(decimals)} 分`;
    }

    function formatScore(value) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(2);
    }

    function formatProbability(value) {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(1)}%`;
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
