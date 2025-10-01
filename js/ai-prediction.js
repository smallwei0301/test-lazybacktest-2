/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250920A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-LSTM-20250920A';
    const SEED_STORAGE_KEY = 'lazybacktestAiSeeds';
    const MAX_RENDERED_TRADES = 200;

    const state = {
        running: false,
        lastSummary: null,
        lastRun: null,
        odds: 1,
        executionThreshold: 0.6,
        useKelly: false,
        fixedFraction: 0.2,
        savedSeeds: [],
    };

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
        trainAccuracy: null,
        trainLoss: null,
        testAccuracy: null,
        testLoss: null,
        tradeCount: null,
        hitRate: null,
        totalReturn: null,
        averageProfit: null,
        tradeTableBody: null,
        tradeSummary: null,
        threshold: null,
        thresholdOptimize: null,
        thresholdFeedback: null,
        saveSeed: null,
        loadSeed: null,
        seedList: null,
        nextPrediction: null,
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };

    const ensureBridge = () => {
        if (typeof window === 'undefined') return null;
        if (!window.lazybacktestAIBridge || typeof window.lazybacktestAIBridge !== 'object') {
            window.lazybacktestAIBridge = {};
        }
        return window.lazybacktestAIBridge;
    };

    const showStatus = (message, type = 'info') => {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.style.color = colorMap[type] || colorMap.info;
    };

    const toggleRunning = (flag) => {
        state.running = Boolean(flag);
        if (!elements.runButton) return;
        elements.runButton.disabled = state.running;
        elements.runButton.classList.toggle('opacity-60', state.running);
        elements.runButton.classList.toggle('cursor-not-allowed', state.running);
    };

    const parseNumberInput = (el, fallback, options = {}) => {
        if (!el) return fallback;
        const raw = typeof el.value === 'string' ? el.value.replace(/,/g, '') : el.value;
        const value = Number(raw);
        if (!Number.isFinite(value)) return fallback;
        const { min, max } = options;
        if (Number.isFinite(min) && value < min) return min;
        if (Number.isFinite(max) && value > max) return max;
        return value;
    };

    const formatPercent = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    };

    const formatNumber = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    };

    const clampFraction = (value) => {
        if (!Number.isFinite(value)) return 0.2;
        return Math.max(0, Math.min(value, 1));
    };

    const computeMedian = (values) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    };

    const computeAverage = (values) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sum = values.reduce((acc, value) => acc + value, 0);
        return sum / values.length;
    };

    const computeStdDev = (values, average) => {
        if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(average)) return NaN;
        const variance = values.reduce((acc, value) => acc + ((value - average) ** 2), 0) / values.length;
        return Math.sqrt(Math.max(variance, 0));
    };

    const cloneData = (input) => {
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(input);
            } catch (error) {
                // ignore and fallback
            }
        }
        try {
            return JSON.parse(JSON.stringify(input, (key, value) => {
                if (typeof value === 'number' && !Number.isFinite(value)) {
                    return null;
                }
                return value;
            }));
        } catch (error) {
            return null;
        }
    };

    const getSafeLocalStorage = () => {
        if (typeof window === 'undefined') return null;
        try {
            if (!window.localStorage) return null;
        } catch (error) {
            return null;
        }
        return window.localStorage;
    };

    const loadSeedsFromStorage = () => {
        const storage = getSafeLocalStorage();
        if (!storage) return [];
        try {
            const raw = storage.getItem(SEED_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((seed) => seed && typeof seed.id === 'string');
        } catch (error) {
            console.warn('[AI Prediction] 載入種子失敗:', error);
            return [];
        }
    };

    const persistSeeds = () => {
        const storage = getSafeLocalStorage();
        if (!storage) return;
        try {
            const payload = JSON.stringify(state.savedSeeds, (key, value) => {
                if (typeof value === 'number' && !Number.isFinite(value)) {
                    return null;
                }
                return value;
            });
            storage.setItem(SEED_STORAGE_KEY, payload);
        } catch (error) {
            console.warn('[AI Prediction] 儲存種子失敗:', error);
        }
    };

    const refreshSeedOptions = () => {
        if (!elements.seedList) return;
        const select = elements.seedList;
        const previousSelection = new Set(Array.from(select.selectedOptions || []).map((option) => option.value));
        select.innerHTML = '';
        if (!Array.isArray(state.savedSeeds) || state.savedSeeds.length === 0) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '尚未儲存種子';
            placeholder.disabled = true;
            select.appendChild(placeholder);
            return;
        }
        state.savedSeeds.forEach((seed) => {
            const option = document.createElement('option');
            option.value = seed.id;
            option.textContent = seed.name;
            if (previousSelection.has(seed.id)) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    };

    const getVisibleData = () => {
        const bridge = ensureBridge();
        if (bridge && typeof bridge.getVisibleStockData === 'function') {
            try {
                const data = bridge.getVisibleStockData();
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.warn('[AI Prediction] 讀取可視資料失敗:', error);
            }
        }
        return [];
    };

    const resolveCloseValue = (row) => {
        const candidates = [
            row?.close,
            row?.adjustedClose,
            row?.adjClose,
            row?.rawClose,
            row?.baseClose,
        ];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(candidates[i]);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        return null;
    };

    const buildDataset = (rows, lookback) => {
        if (!Array.isArray(rows)) {
            return { sequences: [], labels: [], meta: [], returns: [], baseRows: [] };
        }
        const sorted = rows
            .filter((row) => row && typeof row.date === 'string')
            .map((row) => ({
                date: row.date,
                close: resolveCloseValue(row),
            }))
            .filter((row) => Number.isFinite(row.close) && row.close > 0)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (sorted.length <= lookback + 2) {
            return { sequences: [], labels: [], meta: [], returns: [], baseRows: sorted };
        }

        const returns = [];
        const meta = [];
        for (let i = 1; i < sorted.length; i += 1) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            if (!Number.isFinite(prev.close) || prev.close <= 0) continue;
            const change = (curr.close - prev.close) / prev.close;
            returns.push(change);
            meta.push({
                buyDate: prev.date,
                sellDate: curr.date,
                buyClose: prev.close,
                sellClose: curr.close,
                actualReturn: change,
            });
        }

        const sequences = [];
        const labels = [];
        const targetReturns = [];
        for (let i = lookback; i < returns.length; i += 1) {
            const feature = returns.slice(i - lookback, i);
            if (feature.length !== lookback) continue;
            sequences.push(feature);
            labels.push(returns[i] > 0 ? 1 : 0);
            targetReturns.push(returns[i]);
        }

        const metaAligned = meta.slice(lookback);
        return {
            sequences,
            labels,
            meta: metaAligned,
            returns: targetReturns,
            baseRows: sorted,
        };
    };

    const computeNormalisation = (sequences, trainSize) => {
        if (!Array.isArray(sequences) || sequences.length === 0 || trainSize <= 0) {
            return { mean: 0, std: 1 };
        }
        const trainSlice = sequences.slice(0, trainSize);
        const values = trainSlice.flat();
        if (values.length === 0) {
            return { mean: 0, std: 1 };
        }
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
        const std = Math.sqrt(variance) || 1;
        return { mean, std };
    };

    const normaliseSequences = (sequences, normaliser) => {
        const { mean, std } = normaliser;
        if (!Array.isArray(sequences) || sequences.length === 0) return [];
        return sequences.map((seq) => seq.map((value) => (value - mean) / (std || 1)));
    };

    const createModel = (lookback, learningRate) => {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 32, returnSequences: true, inputShape: [lookback, 1] }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.lstm({ units: 16 }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        const optimizer = tf.train.adam(learningRate);
        model.compile({ optimizer, loss: 'binaryCrossentropy', metrics: ['accuracy'] });
        return model;
    };

    const computeKellyFraction = (probability, odds) => {
        const sanitizedProb = Math.min(Math.max(probability, 0.001), 0.999);
        const b = Math.max(odds, 1e-6);
        const fraction = sanitizedProb - ((1 - sanitizedProb) / b);
        return Math.max(0, Math.min(fraction, 1));
    };

    const computeTrainingOdds = (returns, trainSize) => {
        if (!Array.isArray(returns) || returns.length === 0 || trainSize <= 0) {
            return 1;
        }
        const trainReturns = returns.slice(0, trainSize);
        const wins = trainReturns.filter((value) => value > 0);
        const losses = trainReturns.filter((value) => value < 0).map((value) => Math.abs(value));
        const avgWin = wins.length > 0 ? wins.reduce((sum, value) => sum + value, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0;
        if (!Number.isFinite(avgWin) || avgWin <= 0 || !Number.isFinite(avgLoss) || avgLoss <= 0) {
            return 1;
        }
        return Math.max(avgWin / avgLoss, 0.25);
    };

    const updateDatasetSummary = (rows) => {
        if (!elements.datasetSummary) return;
        const data = Array.isArray(rows) ? rows : [];
        if (data.length === 0) {
            elements.datasetSummary.textContent = '尚未取得資料，請先完成一次主回測。';
            return;
        }
        const sorted = [...data]
            .filter((row) => row && typeof row.date === 'string')
            .sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
            elements.datasetSummary.textContent = '資料缺少有效日期，請重新回測。';
            return;
        }
        const firstDate = sorted[0].date;
        const lastDate = sorted[sorted.length - 1].date;
        elements.datasetSummary.textContent = `可用資料 ${sorted.length} 筆，區間 ${firstDate} ~ ${lastDate}。`;
    };

    const renderTrades = (records) => {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = '';
            return;
        }
        const limited = rows.slice(0, MAX_RENDERED_TRADES);
        const html = limited
            .map((trade) => {
                const probabilityText = formatPercent(trade.probability, 1);
                const actualReturnText = formatPercent(trade.actualReturn, 2);
                const fractionText = formatPercent(trade.fraction, 2);
                const tradeReturnText = formatPercent(trade.tradeReturn, 2);
                const actualClass = trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600';
                const tradeClass = trade.tradeReturn >= 0 ? 'text-emerald-600' : 'text-rose-600';
                return `
                    <tr>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.tradingDate || '—'}</td>
                        <td class="px-3 py-2 text-right">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${tradeClass}">${tradeReturnText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) {
            if (elements.trainAccuracy) elements.trainAccuracy.textContent = '—';
            if (elements.trainLoss) elements.trainLoss.textContent = 'Loss：—';
            if (elements.testAccuracy) elements.testAccuracy.textContent = '—';
            if (elements.testLoss) elements.testLoss.textContent = 'Loss：—';
            if (elements.tradeCount) elements.tradeCount.textContent = '—';
            if (elements.hitRate) elements.hitRate.textContent = '命中率：—';
            if (elements.totalReturn) elements.totalReturn.textContent = '—';
            if (elements.averageProfit) elements.averageProfit.textContent = '平均報酬：—｜交易數：—｜標準差：—';
            return;
        }
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
        if (elements.hitRate) {
            const hitRateText = formatPercent(summary.hitRate, 2);
            elements.hitRate.textContent = `命中率：${hitRateText}`;
        }
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(summary.medianTradeReturn, 2);
        if (elements.averageProfit) {
            const averageText = formatPercent(summary.averageTradeReturn, 2);
            const tradeCountText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
            const stdText = formatPercent(summary.tradeReturnStdDev, 2);
            elements.averageProfit.textContent = `平均報酬：${averageText}｜交易數：${tradeCountText}｜標準差：${stdText}`;
        }
    };

    const refreshTradeSummary = () => {
        if (!elements.tradeSummary) return;
        const summary = state.lastSummary;
        if (!summary) {
            elements.tradeSummary.textContent = '尚未生成交易結果。';
            return;
        }
        const thresholdPercent = Math.round((summary.executionThreshold ?? state.executionThreshold) * 100);
        const fixedFraction = summary.fixedFraction ?? state.fixedFraction;
        const strategyLabel = summary.usingKelly
            ? '使用凱利公式調整投入比例'
            : `採固定投入比例 ${formatPercent(fixedFraction, 2)}`;
        const totalPredictions = Number.isFinite(summary.totalPredictions) ? summary.totalPredictions : 0;
        const executed = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
        const medianText = formatPercent(summary.medianTradeReturn, 2);
        const next = state.lastRun?.nextPrediction;
        const nextText = next && Number.isFinite(next.probability)
            ? `下一交易日${next.date ? `（${next.date}）` : ''}預測上漲機率 ${formatPercent(next.probability, 1)}。`
            : '';
        const parts = [
            `共評估 ${totalPredictions} 筆測試樣本，在勝率門檻 ${thresholdPercent}% 下執行 ${executed} 筆交易，${strategyLabel}。`,
            `交易報酬中位數 ${medianText}。`,
            nextText,
        ].filter((text) => text && text.trim().length > 0);
        elements.tradeSummary.textContent = parts.join(' ');
    };

    const displayNextPrediction = () => {
        if (!elements.nextPrediction) return;
        const next = state.lastRun?.nextPrediction;
        if (!next || !Number.isFinite(next.probability)) {
            elements.nextPrediction.textContent = '尚未產生隔日預測。';
            return;
        }
        const dateText = next.date ? `（${next.date}）` : '';
        elements.nextPrediction.textContent = `下一交易日${dateText}預測上漲機率 ${formatPercent(next.probability, 1)}。`;
    };

    const computeNextDate = (isoDate) => {
        if (typeof isoDate !== 'string') return null;
        const parts = isoDate.split('-').map((part) => Number(part));
        if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return null;
        const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        if (Number.isNaN(date.getTime())) return null;
        date.setUTCDate(date.getUTCDate() + 1);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const computeTradeStatistics = (threshold, useKelly, fixedFraction) => {
        if (!state.lastRun || !Array.isArray(state.lastRun.predictions) || !Array.isArray(state.lastRun.returns) || !Array.isArray(state.lastRun.meta)) {
            return null;
        }
        const executedTrades = [];
        let wins = 0;
        const sanitizedThreshold = Number.isFinite(threshold) ? Math.max(0.5, Math.min(threshold, 1)) : 0.5;
        const sanitizedFraction = clampFraction(fixedFraction);
        for (let i = 0; i < state.lastRun.predictions.length; i += 1) {
            const probability = state.lastRun.predictions[i];
            const actualReturn = state.lastRun.returns[i];
            const info = state.lastRun.meta[i];
            if (!Number.isFinite(probability) || probability < sanitizedThreshold) continue;
            if (!Number.isFinite(actualReturn) || !info) continue;
            const fraction = useKelly
                ? computeKellyFraction(probability, state.odds)
                : sanitizedFraction;
            const tradeReturn = actualReturn * fraction;
            executedTrades.push({
                tradingDate: info.sellDate || info.date || info.buyDate || '—',
                probability,
                actualReturn,
                fraction,
                tradeReturn,
            });
            if (actualReturn > 0) {
                wins += 1;
            }
        }
        const executed = executedTrades.length;
        const tradeReturns = executedTrades.map((item) => item.tradeReturn);
        const medianTradeReturn = computeMedian(tradeReturns);
        const averageTradeReturn = computeAverage(tradeReturns);
        const tradeReturnStdDev = computeStdDev(tradeReturns, averageTradeReturn);
        const hitRate = executed > 0 ? wins / executed : NaN;
        return {
            executedTrades,
            executed,
            hitRate,
            medianTradeReturn,
            averageTradeReturn,
            tradeReturnStdDev,
        };
    };

    const recomputeTrades = () => {
        const stats = computeTradeStatistics(state.executionThreshold, state.useKelly, state.fixedFraction);
        if (!stats) {
            renderTrades([]);
            if (state.lastSummary) {
                const merged = {
                    ...state.lastSummary,
                    executedTrades: 0,
                    hitRate: NaN,
                    medianTradeReturn: NaN,
                    averageTradeReturn: NaN,
                    tradeReturnStdDev: NaN,
                    usingKelly: state.useKelly,
                    executionThreshold: state.executionThreshold,
                    fixedFraction: state.fixedFraction,
                };
                state.lastSummary = merged;
                updateSummaryMetrics(merged);
            } else {
                updateSummaryMetrics(null);
            }
            refreshTradeSummary();
            return null;
        }
        if (state.lastRun) {
            state.lastRun.tradeRecords = stats.executedTrades;
        }
        const mergedSummary = {
            ...(state.lastSummary || {}),
            executedTrades: stats.executed,
            hitRate: stats.hitRate,
            medianTradeReturn: stats.medianTradeReturn,
            averageTradeReturn: stats.averageTradeReturn,
            tradeReturnStdDev: stats.tradeReturnStdDev,
            usingKelly: state.useKelly,
            executionThreshold: state.executionThreshold,
            fixedFraction: state.fixedFraction,
            totalPredictions: state.lastRun?.predictions?.length ?? (state.lastSummary?.totalPredictions ?? 0),
        };
        state.lastSummary = mergedSummary;
        renderTrades(stats.executedTrades);
        updateSummaryMetrics(mergedSummary);
        refreshTradeSummary();
        return stats;
    };

    const handleThresholdChange = () => {
        if (!elements.threshold) return;
        const percent = parseNumberInput(elements.threshold, state.executionThreshold * 100, { min: 50, max: 100 });
        const normalized = Math.min(Math.max(percent / 100, 0.5), 1);
        state.executionThreshold = normalized;
        elements.threshold.value = Math.round(normalized * 100);
        if (elements.thresholdFeedback) {
            elements.thresholdFeedback.textContent = `已套用勝率門檻 ${Math.round(normalized * 100)}%。`;
        }
        recomputeTrades();
    };

    const handleKellyToggle = () => {
        state.useKelly = Boolean(elements.enableKelly?.checked);
        recomputeTrades();
    };

    const handleFixedFractionChange = () => {
        if (!elements.fixedFraction) return;
        const value = parseNumberInput(elements.fixedFraction, state.fixedFraction, { min: 0.01, max: 1 });
        const sanitized = clampFraction(value);
        state.fixedFraction = sanitized;
        elements.fixedFraction.value = sanitized.toFixed(2);
        recomputeTrades();
    };

    const handleOptimalThreshold = () => {
        if (!state.lastRun || !Array.isArray(state.lastRun.predictions) || state.lastRun.predictions.length === 0) {
            showStatus('尚未產生 AI 預測結果，無法計算最佳門檻。', 'warning');
            return;
        }
        let bestThreshold = null;
        let bestStats = null;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const stats = computeTradeStatistics(threshold, state.useKelly, state.fixedFraction);
            if (!stats || stats.executed === 0 || !Number.isFinite(stats.medianTradeReturn)) {
                continue;
            }
            const currentMedian = stats.medianTradeReturn;
            const bestMedian = bestStats ? bestStats.medianTradeReturn : -Infinity;
            const currentAverage = Number.isFinite(stats.averageTradeReturn) ? stats.averageTradeReturn : -Infinity;
            const bestAverage = bestStats && Number.isFinite(bestStats.averageTradeReturn) ? bestStats.averageTradeReturn : -Infinity;
            if (
                !bestStats
                || currentMedian > bestMedian
                || (currentMedian === bestMedian && currentAverage > bestAverage)
                || (currentMedian === bestMedian && currentAverage === bestAverage && stats.executed > bestStats.executed)
            ) {
                bestThreshold = threshold;
                bestStats = stats;
            }
        }
        if (!bestStats || bestThreshold === null) {
            showStatus('在 50%~100% 門檻範圍內沒有找到有效的交易紀錄。', 'warning');
            if (elements.thresholdFeedback) {
                elements.thresholdFeedback.textContent = '掃描 50%~100% 門檻，找出交易報酬中位數最佳值。';
            }
            return;
        }
        state.executionThreshold = bestThreshold;
        if (elements.threshold) {
            elements.threshold.value = Math.round(bestThreshold * 100);
        }
        const result = recomputeTrades();
        const message = `最佳門檻為 ${Math.round(bestThreshold * 100)}%，交易報酬中位數 ${formatPercent(bestStats.medianTradeReturn, 2)}（${bestStats.executed} 筆交易）。`;
        showStatus(message, 'success');
        if (elements.thresholdFeedback) {
            elements.thresholdFeedback.textContent = message;
        }
        return result;
    };

    const handleSaveSeed = () => {
        if (!state.lastRun || !Array.isArray(state.lastRun.predictions) || state.lastRun.predictions.length === 0 || !state.lastSummary) {
            showStatus('尚未產生可儲存的 AI 預測結果。', 'warning');
            return;
        }
        const defaultName = `訓練${formatPercent(state.lastSummary.trainAccuracy, 1)}_測試${formatPercent(state.lastSummary.testAccuracy, 1)}`;
        const inputName = typeof window !== 'undefined' ? window.prompt('請輸入種子名稱', defaultName) : defaultName;
        const seedName = (inputName && inputName.trim().length > 0) ? inputName.trim() : defaultName;
        const newSeed = {
            id: `seed-${Date.now()}`,
            name: seedName,
            createdAt: new Date().toISOString(),
            summary: cloneData(state.lastSummary),
            run: cloneData({
                ...state.lastRun,
                tradeRecords: state.lastRun.tradeRecords ?? [],
            }),
            odds: state.odds,
            config: cloneData({
                ...(state.lastRun?.config || {}),
                useKelly: state.useKelly,
                fixedFraction: state.fixedFraction,
                threshold: state.executionThreshold,
            }),
        };
        state.savedSeeds.push(newSeed);
        persistSeeds();
        refreshSeedOptions();
        showStatus(`已儲存種子「${seedName}」。`, 'success');
    };

    const applySeed = (seed) => {
        if (!seed) return;
        const summary = cloneData(seed.summary);
        const run = cloneData(seed.run);
        if (!run || !Array.isArray(run.predictions)) {
            showStatus('種子資料缺少預測紀錄，無法載入。', 'error');
            return;
        }
        state.lastSummary = summary || null;
        state.lastRun = run;
        state.odds = Number.isFinite(seed.odds) ? seed.odds : 1;
        const fractionValue = Number(seed.config?.fixedFraction);
        state.fixedFraction = Number.isFinite(fractionValue) ? clampFraction(fractionValue) : 0.2;
        const thresholdValue = Number(seed.config?.threshold);
        state.executionThreshold = Number.isFinite(thresholdValue) ? Math.min(Math.max(thresholdValue, 0.5), 1) : state.executionThreshold;
        state.useKelly = Boolean(seed.config?.useKelly);
        if (elements.enableKelly) elements.enableKelly.checked = state.useKelly;
        if (elements.fixedFraction) elements.fixedFraction.value = state.fixedFraction.toFixed(2);
        if (elements.threshold) elements.threshold.value = Math.round(state.executionThreshold * 100);
        if (elements.lookback && Number.isFinite(seed.config?.lookback)) elements.lookback.value = seed.config.lookback;
        if (elements.epochs && Number.isFinite(seed.config?.epochs)) elements.epochs.value = seed.config.epochs;
        if (elements.batchSize && Number.isFinite(seed.config?.batchSize)) elements.batchSize.value = seed.config.batchSize;
        if (elements.learningRate && Number.isFinite(seed.config?.learningRate)) elements.learningRate.value = seed.config.learningRate;
        if (elements.datasetSummary) elements.datasetSummary.textContent = run.datasetSummaryText || '已載入歷史種子資料。';
        if (elements.thresholdFeedback) {
            elements.thresholdFeedback.textContent = `已套用勝率門檻 ${Math.round(state.executionThreshold * 100)}%。`;
        }
        recomputeTrades();
        displayNextPrediction();
    };

    const handleLoadSeed = () => {
        if (!elements.seedList) return;
        const selectedOptions = Array.from(elements.seedList.selectedOptions || []);
        if (selectedOptions.length === 0) {
            showStatus('請先選擇要載入的種子。', 'warning');
            return;
        }
        const ids = selectedOptions.map((option) => option.value);
        const matched = state.savedSeeds.filter((seed) => ids.includes(seed.id));
        if (matched.length === 0) {
            showStatus('找不到選擇的種子紀錄。', 'error');
            return;
        }
        const seed = matched[matched.length - 1];
        applySeed(seed);
        showStatus(`已載入種子「${seed.name}」。`, 'success');
    };

    const runPrediction = async () => {
        if (state.running) return;
        if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
            showStatus('未載入 TensorFlow.js，請確認網路連線。', 'error');
            return;
        }
        toggleRunning(true);

        let xAll;
        let yAll;
        let xTrain;
        let yTrain;
        let xTest;
        let yTest;
        let model;

        try {
            const lookback = Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
            const epochs = Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 300 }));
            const batchSize = Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
            const learningRate = parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });
            const fixedFractionInput = parseNumberInput(elements.fixedFraction, state.fixedFraction, { min: 0.01, max: 1 });
            const useKelly = Boolean(elements.enableKelly?.checked);
            const thresholdPercent = parseNumberInput(elements.threshold, state.executionThreshold * 100, { min: 50, max: 100 });
            state.executionThreshold = Math.min(Math.max(thresholdPercent / 100, 0.5), 1);
            if (elements.threshold) {
                elements.threshold.value = Math.round(state.executionThreshold * 100);
            }
            state.useKelly = useKelly;
            state.fixedFraction = clampFraction(fixedFractionInput);
            if (elements.fixedFraction) {
                elements.fixedFraction.value = state.fixedFraction.toFixed(2);
            }
            if (elements.enableKelly) {
                elements.enableKelly.checked = state.useKelly;
            }

            const rows = getVisibleData();
            if (!Array.isArray(rows) || rows.length === 0) {
                showStatus('尚未取得回測資料，請先在主頁面執行回測。', 'warning');
                toggleRunning(false);
                return;
            }

            const dataset = buildDataset(rows, lookback);
            if (dataset.sequences.length < 45) {
                showStatus(`資料樣本不足（需至少 ${Math.max(45, lookback * 3)} 筆有效樣本，目前 ${dataset.sequences.length} 筆），請延長回測期間。`, 'warning');
                toggleRunning(false);
                return;
            }

            const totalSamples = dataset.sequences.length;
            const trainSize = Math.max(Math.floor(totalSamples * (2 / 3)), lookback);
            const boundedTrainSize = Math.min(trainSize, totalSamples - 1);
            const testSize = totalSamples - boundedTrainSize;
            if (boundedTrainSize <= 0 || testSize <= 0) {
                showStatus('無法按照 2:1 分割訓練與測試集，請延長資料範圍。', 'warning');
                toggleRunning(false);
                return;
            }

            const normaliser = computeNormalisation(dataset.sequences, boundedTrainSize);
            const normalizedSequences = normaliseSequences(dataset.sequences, normaliser);
            const tensorInput = normalizedSequences.map((seq) => seq.map((value) => [value]));
            xAll = tf.tensor(tensorInput);
            yAll = tf.tensor(dataset.labels.map((label) => [label]));

            xTrain = xAll.slice([0, 0, 0], [boundedTrainSize, lookback, 1]);
            yTrain = yAll.slice([0, 0], [boundedTrainSize, 1]);
            xTest = xAll.slice([boundedTrainSize, 0, 0], [testSize, lookback, 1]);
            yTest = yAll.slice([boundedTrainSize, 0], [testSize, 1]);

            if (batchSize > boundedTrainSize) {
                showStatus(`批次大小 ${batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整為 ${boundedTrainSize}。`, 'warning');
            }

            model = createModel(lookback, learningRate);
            showStatus(`訓練中（共 ${epochs} 輪）...`, 'info');

            const history = await model.fit(xTrain, yTrain, {
                epochs,
                batchSize: Math.min(batchSize, boundedTrainSize),
                validationSplit: Math.min(0.2, Math.max(0.1, boundedTrainSize > 50 ? 0.2 : 0.1)),
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        const lossText = Number.isFinite(logs.loss) ? logs.loss.toFixed(4) : '—';
                        const accValue = logs.acc ?? logs.accuracy;
                        const accText = Number.isFinite(accValue) ? formatPercent(accValue, 2) : '—';
                        showStatus(`訓練中（${epoch + 1}/${epochs}） Loss ${lossText} / Acc ${accText}`, 'info');
                    },
                },
            });

            const accuracyKey = history.history.acc ? 'acc' : (history.history.accuracy ? 'accuracy' : null);
            const finalTrainAccuracy = accuracyKey ? history.history[accuracyKey][history.history[accuracyKey].length - 1] : NaN;
            const finalTrainLoss = history.history.loss?.[history.history.loss.length - 1] ?? NaN;

            const evalOutput = model.evaluate(xTest, yTest);
            const evalArray = Array.isArray(evalOutput) ? evalOutput : [evalOutput];
            const evalValues = await Promise.all(
                evalArray.map(async (tensor) => {
                    const data = await tensor.data();
                    tensor.dispose();
                    return data[0];
                })
            );
            const testLoss = evalValues[0] ?? NaN;
            const testAccuracy = evalValues[1] ?? NaN;

            const predictionsTensor = model.predict(xTest);
            const predictionValues = Array.from(await predictionsTensor.data());
            predictionsTensor.dispose();

            const labels = dataset.labels.slice(boundedTrainSize);
            let correctPredictions = 0;
            predictionValues.forEach((value, index) => {
                const predictedLabel = value >= 0.5 ? 1 : 0;
                if (predictedLabel === labels[index]) {
                    correctPredictions += 1;
                }
            });
            const manualAccuracy = labels.length > 0 ? correctPredictions / labels.length : NaN;

            const trainingOdds = computeTrainingOdds(dataset.returns, boundedTrainSize);
            state.odds = trainingOdds;

            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);

            let nextPrediction = null;
            let nextPredictionDate = null;
            const latestWindow = dataset.returns.slice(dataset.returns.length - lookback);
            if (latestWindow.length === lookback) {
                const normalizedWindow = latestWindow.map((value) => (value - normaliser.mean) / (normaliser.std || 1));
                const nextInput = tf.tensor(normalizedWindow, [1, lookback, 1]);
                const nextTensor = model.predict(nextInput);
                const nextArray = await nextTensor.data();
                nextPrediction = nextArray[0];
                nextTensor.dispose();
                nextInput.dispose();
                const lastSellDate = testMeta[testMeta.length - 1]?.sellDate || dataset.baseRows[dataset.baseRows.length - 1]?.date;
                nextPredictionDate = computeNextDate(lastSellDate);
            }

            state.lastRun = {
                predictions: predictionValues,
                returns: testReturns,
                meta: testMeta,
                tradeRecords: [],
                lookback,
                normaliser,
                totalPredictions: predictionValues.length,
                manualAccuracy,
                trainingOdds,
                datasetSummaryText: elements.datasetSummary?.textContent || '',
                nextPrediction: Number.isFinite(nextPrediction) ? { probability: nextPrediction, date: nextPredictionDate } : null,
                config: {
                    lookback,
                    epochs,
                    batchSize,
                    learningRate,
                },
            };

            state.lastSummary = {
                version: VERSION_TAG,
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy,
                testLoss,
                totalPredictions: predictionValues.length,
                usingKelly: state.useKelly,
                executionThreshold: state.executionThreshold,
                fixedFraction: state.fixedFraction,
            };

            const stats = recomputeTrades();
            displayNextPrediction();

            const statusParts = [
                `完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}`,
                `測試正確率 ${formatPercent(state.lastSummary.testAccuracy, 2)}`,
            ];
            if (stats && Number.isFinite(state.lastRun?.nextPrediction?.probability)) {
                statusParts.push(`隔日預測上漲機率 ${formatPercent(state.lastRun.nextPrediction.probability, 1)}`);
            }
            showStatus(statusParts.join(' / '), 'success');
        } catch (error) {
            console.error('[AI Prediction] 執行失敗:', error);
            showStatus(`AI 預測執行失敗：${error.message}`, 'error');
        } finally {
            if (xAll) xAll.dispose();
            if (yAll) yAll.dispose();
            if (xTrain) xTrain.dispose();
            if (yTrain) yTrain.dispose();
            if (xTest) xTest.dispose();
            if (yTest) yTest.dispose();
            if (model) model.dispose();
            toggleRunning(false);
        }
    };

    const init = () => {
        elements.datasetSummary = document.getElementById('ai-dataset-summary');
        elements.status = document.getElementById('ai-status');
        elements.runButton = document.getElementById('ai-run-button');
        elements.lookback = document.getElementById('ai-lookback');
        elements.epochs = document.getElementById('ai-epochs');
        elements.batchSize = document.getElementById('ai-batch-size');
        elements.learningRate = document.getElementById('ai-learning-rate');
        elements.enableKelly = document.getElementById('ai-enable-kelly');
        elements.fixedFraction = document.getElementById('ai-fixed-fraction');
        elements.trainAccuracy = document.getElementById('ai-train-accuracy');
        elements.trainLoss = document.getElementById('ai-train-loss');
        elements.testAccuracy = document.getElementById('ai-test-accuracy');
        elements.testLoss = document.getElementById('ai-test-loss');
        elements.tradeCount = document.getElementById('ai-trade-count');
        elements.hitRate = document.getElementById('ai-hit-rate');
        elements.totalReturn = document.getElementById('ai-total-return');
        elements.averageProfit = document.getElementById('ai-average-profit');
        elements.tradeTableBody = document.getElementById('ai-trade-table-body');
        elements.tradeSummary = document.getElementById('ai-trade-summary');
        elements.threshold = document.getElementById('ai-threshold');
        elements.thresholdOptimize = document.getElementById('ai-threshold-optimize');
        elements.thresholdFeedback = document.getElementById('ai-threshold-feedback');
        elements.saveSeed = document.getElementById('ai-save-seed');
        elements.loadSeed = document.getElementById('ai-load-seed');
        elements.seedList = document.getElementById('ai-seed-list');
        elements.nextPrediction = document.getElementById('ai-next-prediction');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }
        if (elements.threshold) {
            const percent = parseNumberInput(elements.threshold, 60, { min: 50, max: 100 });
            state.executionThreshold = Math.min(Math.max(percent / 100, 0.5), 1);
            elements.threshold.value = Math.round(state.executionThreshold * 100);
            elements.threshold.addEventListener('input', handleThresholdChange);
        }
        if (elements.thresholdOptimize) {
            elements.thresholdOptimize.addEventListener('click', handleOptimalThreshold);
        }
        if (elements.enableKelly) {
            state.useKelly = Boolean(elements.enableKelly.checked);
            elements.enableKelly.addEventListener('change', handleKellyToggle);
        }
        if (elements.fixedFraction) {
            const fraction = parseNumberInput(elements.fixedFraction, state.fixedFraction, { min: 0.01, max: 1 });
            state.fixedFraction = clampFraction(fraction);
            elements.fixedFraction.value = state.fixedFraction.toFixed(2);
            elements.fixedFraction.addEventListener('input', handleFixedFractionChange);
        }
        if (elements.saveSeed) {
            elements.saveSeed.addEventListener('click', handleSaveSeed);
        }
        if (elements.loadSeed) {
            elements.loadSeed.addEventListener('click', handleLoadSeed);
        }

        state.savedSeeds = loadSeedsFromStorage();
        refreshSeedOptions();

        updateDatasetSummary(getVisibleData());
        displayNextPrediction();

        const bridge = ensureBridge();
        if (bridge) {
            const previousHandler = typeof bridge.handleVisibleDataUpdate === 'function'
                ? bridge.handleVisibleDataUpdate
                : null;
            bridge.handleVisibleDataUpdate = (data) => {
                if (typeof previousHandler === 'function') {
                    try {
                        previousHandler(data);
                    } catch (error) {
                        console.warn('[AI Prediction] 前一個資料更新處理失敗:', error);
                    }
                }
                updateDatasetSummary(data);
            };
            bridge.versionTag = VERSION_TAG;
        }

        window.addEventListener('lazybacktest:visible-data-changed', () => {
            updateDatasetSummary(getVisibleData());
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
