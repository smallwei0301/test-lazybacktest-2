/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250923A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-LSTM-20250923A';
    const SEED_STORAGE_KEY = 'lazybacktest.aiSeeds';
    const state = {
        running: false,
        lastSummary: null,
        lastRun: null,
        odds: 1,
        config: {
            useKelly: false,
            fixedFraction: 0.2,
            threshold: 0.5,
        },
        seedQueue: [],
        currentSeed: null,
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
        probabilityThreshold: null,
        autoThresholdButton: null,
        nextDayForecast: null,
        seedInput: null,
        saveSeedButton: null,
        loadSeedButton: null,
        seedList: null,
        seedStatus: null,
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

    const formatPercent = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    };

    const formatCurrency = (value) => {
        if (!Number.isFinite(value)) return '—';
        return `${Math.round(value).toLocaleString('zh-TW')}元`;
    };

    const formatNumber = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    };

    const formatPercentOrDash = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return formatPercent(value, digits);
    };

    const computeMedian = (values) => {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    };

    const evaluateTrades = (runData, config) => {
        if (!runData) {
            return { trades: [], summary: { executedTrades: 0, hitRate: 0, medianTradeReturn: 0, averageTradeReturn: 0, tradeStd: 0, totalPredictions: 0, executedReturns: [], lastTradeDate: null, finalCapital: Number.isFinite(runData?.initialCapital) ? runData.initialCapital : 0, cumulativeProfit: 0 } };
        }

        const {
            predictionValues = [],
            testReturns = [],
            testMeta = [],
            trainingOdds = 1,
            initialCapital = 0,
        } = runData;

        const trades = [];
        const executedReturns = [];
        let capital = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : 0;
        let cumulativeProfit = 0;
        let executedCount = 0;
        let wins = 0;

        for (let i = 0; i < predictionValues.length; i += 1) {
            const probability = predictionValues[i];
            const actualReturn = testReturns[i];
            const meta = testMeta[i] || {};
            const hasProbability = Number.isFinite(probability);
            const threshold = Number.isFinite(config.threshold) ? config.threshold : 0.5;
            const shouldEnter = hasProbability && probability >= threshold;
            const baseFraction = shouldEnter
                ? (config.useKelly
                    ? computeKellyFraction(probability, trainingOdds)
                    : Math.max(0.01, Math.min(config.fixedFraction ?? 0.2, 1)))
                : 0;
            const fraction = Number.isFinite(baseFraction) ? Math.max(0, Math.min(baseFraction, 1)) : 0;
            const executed = shouldEnter && Number.isFinite(actualReturn) && fraction > 0;

            let tradeReturn = 0;
            let profit = 0;
            if (executed) {
                tradeReturn = actualReturn * fraction;
                const allocation = capital * fraction;
                profit = allocation * actualReturn;
                capital += profit;
                cumulativeProfit += profit;
                executedReturns.push(tradeReturn);
                executedCount += 1;
                if (actualReturn > 0) {
                    wins += 1;
                }
            }

            trades.push({
                tradeDate: meta.sellDate || meta.buyDate || '',
                probability,
                actualReturn,
                fraction,
                tradeReturn,
                executed,
            });
        }

        const hitRate = executedCount > 0 ? wins / executedCount : 0;
        const medianTradeReturn = computeMedian(executedReturns);
        const averageTradeReturn = executedReturns.length > 0
            ? executedReturns.reduce((sum, value) => sum + value, 0) / executedReturns.length
            : 0;
        let tradeStd = 0;
        if (executedReturns.length > 1) {
            const variance = executedReturns.reduce(
                (acc, value) => acc + ((value - averageTradeReturn) ** 2),
                0,
            ) / (executedReturns.length - 1);
            tradeStd = Math.sqrt(Math.max(variance, 0));
        }

        const lastTradeDate = trades.length > 0 ? trades[trades.length - 1].tradeDate : null;

        return {
            trades,
            summary: {
                executedTrades: executedCount,
                hitRate,
                medianTradeReturn,
                averageTradeReturn,
                tradeStd,
                totalPredictions: predictionValues.length,
                executedReturns,
                lastTradeDate,
                finalCapital: capital,
                cumulativeProfit,
            },
        };
    };

    const loadStoredSeeds = () => {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return [];
        }
        try {
            const raw = window.localStorage.getItem(SEED_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取種子快取：', error);
            return [];
        }
    };

    const persistStoredSeeds = (seeds) => {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return;
        }
        try {
            window.localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(seeds));
        } catch (error) {
            console.warn('[AI Prediction] 無法寫入種子快取：', error);
        }
    };

    const refreshSeedOptions = () => {
        if (!elements.seedList) return;
        const seeds = loadStoredSeeds();
        if (seeds.length === 0) {
            elements.seedList.innerHTML = '';
            return;
        }
        const options = seeds
            .map((seed) => {
                const label = seed.label || `Seed ${seed.value}`;
                return `<option value="${seed.value}" data-id="${seed.id}">${label}（${seed.value}）</option>`;
            })
            .join('');
        elements.seedList.innerHTML = options;
    };

    const setSeedStatus = (message, type = 'info') => {
        if (!elements.seedStatus) return;
        elements.seedStatus.textContent = message;
        const colorMapSeed = {
            info: 'var(--muted-foreground)',
            success: 'var(--primary)',
            warning: 'var(--secondary)',
            error: 'var(--destructive)',
        };
        elements.seedStatus.style.color = colorMapSeed[type] || colorMapSeed.info;
    };

    const parseSeedValue = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.round(numeric);
    };

    const handleSaveSeed = () => {
        if (!state.lastSummary || !Number.isFinite(state.currentSeed)) {
            setSeedStatus('尚未產生可儲存的種子，請先執行一次 AI 預測。', 'warning');
            return;
        }
        const seeds = loadStoredSeeds();
        const exists = seeds.some((entry) => Number(entry.value) === Number(state.currentSeed));
        if (exists) {
            setSeedStatus('此種子已在列表中。', 'warning');
            return;
        }
        const trainLabel = formatPercentOrDash(state.lastSummary.trainAccuracy, 2);
        const testLabel = formatPercentOrDash(state.lastSummary.testAccuracy, 2);
        const label = `訓練 ${trainLabel}｜測試 ${testLabel}`;
        const entry = {
            id: `seed-${Date.now()}`,
            value: state.currentSeed,
            label,
            createdAt: new Date().toISOString(),
        };
        const updated = [...seeds, entry];
        persistStoredSeeds(updated);
        refreshSeedOptions();
        setSeedStatus(`已儲存種子 ${state.currentSeed}（${label}）。`, 'success');
    };

    const handleLoadSeed = () => {
        if (!elements.seedList) return;
        const selected = Array.from(elements.seedList.selectedOptions || []);
        if (selected.length === 0) {
            setSeedStatus('請先選取至少一個已儲存的種子。', 'warning');
            return;
        }
        const values = selected
            .map((option) => parseSeedValue(option.value))
            .filter((value) => Number.isFinite(value));
        if (values.length === 0) {
            setSeedStatus('選取的種子值無法解析。', 'error');
            return;
        }
        const [first, ...rest] = values;
        if (elements.seedInput) {
            elements.seedInput.value = first;
        }
        state.seedQueue = rest;
        state.currentSeed = first;
        setSeedStatus(`已載入種子 ${values.join(', ')}。如選取多個，請依序執行預測。`, 'success');
    };

    const clampThreshold = (value) => {
        if (!Number.isFinite(value)) return 0.5;
        if (value < 0.5) return 0.5;
        if (value > 1) return 1;
        return value;
    };

    const readConfigFromInputs = () => {
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, state.config.fixedFraction, { min: 0.01, max: 1 });
        const rawThreshold = elements.probabilityThreshold ? Number(elements.probabilityThreshold.value) : state.config.threshold;
        const threshold = clampThreshold(Number.isFinite(rawThreshold) ? rawThreshold : state.config.threshold);
        state.config = {
            useKelly,
            fixedFraction,
            threshold,
        };
        if (elements.probabilityThreshold) {
            elements.probabilityThreshold.value = threshold.toFixed(2);
        }
        return state.config;
    };

    const recomputeTrades = () => {
        if (!state.lastRun) return;
        const config = readConfigFromInputs();
        const evaluation = evaluateTrades(state.lastRun, config);
        const summary = {
            version: VERSION_TAG,
            trainAccuracy: state.lastRun.trainAccuracy,
            trainLoss: state.lastRun.trainLoss,
            testAccuracy: state.lastRun.testAccuracy,
            testLoss: state.lastRun.testLoss,
            executedTrades: evaluation.summary.executedTrades,
            totalPredictions: evaluation.summary.totalPredictions,
            hitRate: evaluation.summary.hitRate,
            medianTradeReturn: evaluation.summary.medianTradeReturn,
            averageTradeReturn: evaluation.summary.averageTradeReturn,
            tradeStd: evaluation.summary.tradeStd,
            usingKelly: config.useKelly,
            fixedFraction: config.fixedFraction,
            threshold: config.threshold,
            finalCapital: evaluation.summary.finalCapital,
            cumulativeProfit: evaluation.summary.cumulativeProfit,
            nextDayProbability: state.lastRun.nextDayProbability,
            lastTradeDate: evaluation.summary.lastTradeDate || state.lastRun.lastTradeDate,
            lastDataDate: state.lastRun.lastDataDate,
            initialCapital: state.lastRun.initialCapital,
            trainingOdds: state.lastRun.trainingOdds,
            seedValue: state.currentSeed,
            executedReturns: evaluation.summary.executedReturns,
            trades: evaluation.trades,
        };
        state.lastSummary = summary;
        renderTrades(evaluation.trades);
        updateSummaryMetrics(summary);
    };

    const handleConfigChange = () => {
        if (!state.lastRun) return;
        recomputeTrades();
    };

    const autoTuneThreshold = () => {
        if (!state.lastRun) {
            showStatus('尚未生成預測結果，無法搜尋最佳門檻。', 'warning');
            return;
        }
        const baseConfig = readConfigFromInputs();
        let bestThreshold = baseConfig.threshold || 0.5;
        let bestMedian = -Infinity;
        let bestAverage = -Infinity;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = clampThreshold(percent / 100);
            const evaluation = evaluateTrades(state.lastRun, {
                ...baseConfig,
                threshold,
            });
            const median = evaluation.summary.medianTradeReturn;
            const average = evaluation.summary.averageTradeReturn;
            if (median > bestMedian || (median === bestMedian && average > bestAverage)) {
                bestMedian = median;
                bestAverage = average;
                bestThreshold = threshold;
            }
        }
        if (elements.probabilityThreshold) {
            elements.probabilityThreshold.value = bestThreshold.toFixed(2);
        }
        state.config.threshold = bestThreshold;
        recomputeTrades();
        showStatus(`已找到最佳門檻 ${formatPercent(bestThreshold, 0)}，交易報酬中位數 ${formatPercent(bestMedian, 2)}。`, 'success');
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

    const resolveInitialCapital = () => {
        const input = document.getElementById('initialCapital');
        return parseNumberInput(input, 100000, { min: 1000 });
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
        const limited = rows.slice(0, 200);
        const html = limited
            .map((trade) => {
                const probabilityText = formatPercent(trade.probability, 1);
                const actualReturnText = formatPercent(trade.actualReturn, 2);
                const fractionText = formatPercent(trade.fraction, 2);
                const tradeReturnText = formatPercent(trade.tradeReturn, 2);
                const tradeDate = trade.tradeDate || '—';
                const rowClass = trade.executed ? '' : 'opacity-60';
                const statusTitle = trade.executed ? '' : ' title="未達勝率門檻或設定"';
                return `
                    <tr class="${rowClass}"${statusTitle}>
                        <td class="px-3 py-2 whitespace-nowrap">${tradeDate}</td>
                        <td class="px-3 py-2 text-right">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${actualReturnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${trade.tradeReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${tradeReturnText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercentOrDash(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercentOrDash(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) {
            elements.tradeCount.textContent = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
        }
        if (elements.hitRate) elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}`;
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(summary.medianTradeReturn, 2);
        if (elements.averageProfit) {
            const avgText = formatPercentOrDash(summary.averageTradeReturn, 2);
            const stdText = formatPercentOrDash(summary.tradeStd, 2);
            const countText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
            elements.averageProfit.textContent = `平均報酬%：${avgText}｜交易數：${countText}｜標準差：${stdText}`;
        }
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly
                ? '凱利公式'
                : `固定比例 ${formatPercent(summary.fixedFraction, 2)}`;
            const thresholdText = formatPercent(summary.threshold, 0);
            const hitRateText = formatPercent(summary.hitRate, 2);
            const medianText = formatPercent(summary.medianTradeReturn, 2);
            const totalPredictionsText = Number.isFinite(summary.totalPredictions) ? summary.totalPredictions : 0;
            const executedText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
            elements.tradeSummary.textContent = `共評估 ${totalPredictionsText} 筆測試樣本，依勝率門檻 ${thresholdText} 執行 ${executedText} 筆交易，採用${strategyLabel}。命中率 ${hitRateText}，交易報酬中位數 ${medianText}。`;
        }
        if (elements.nextDayForecast) {
            if (Number.isFinite(summary.nextDayProbability)) {
                const probabilityText = formatPercent(summary.nextDayProbability, 1);
                const lastDateText = summary.lastDataDate || summary.lastTradeDate || '—';
                elements.nextDayForecast.textContent = `最後資料日 ${lastDateText}，預測隔日上漲機率 ${probabilityText}。`;
                elements.nextDayForecast.style.color = 'var(--foreground)';
            } else {
                elements.nextDayForecast.textContent = '尚未計算隔日預測。';
                elements.nextDayForecast.style.color = 'var(--muted-foreground)';
            }
        }
    };

    const runPrediction = async () => {
        if (state.running) return;
        if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
            showStatus('未載入 TensorFlow.js，請確認網路連線。', 'error');
            return;
        }
        toggleRunning(true);

        try {
            const lookback = Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
            const epochs = Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 300 }));
            const batchSize = Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
            const learningRate = parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });
            const config = readConfigFromInputs();
            const seedValue = parseSeedValue(elements.seedInput ? elements.seedInput.value : null);
            if (Number.isFinite(seedValue)) {
                tf.util.setRandomSeed(seedValue);
                state.currentSeed = seedValue;
            } else {
                state.currentSeed = null;
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
            const xAll = tf.tensor(tensorInput);
            const yAll = tf.tensor(dataset.labels.map((label) => [label]));

            const xTrain = xAll.slice([0, 0, 0], [boundedTrainSize, lookback, 1]);
            const yTrain = yAll.slice([0, 0], [boundedTrainSize, 1]);
            const xTest = xAll.slice([boundedTrainSize, 0, 0], [testSize, lookback, 1]);
            const yTest = yAll.slice([boundedTrainSize, 0], [testSize, 1]);

            if (batchSize > boundedTrainSize) {
                showStatus(`批次大小 ${batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整為 ${boundedTrainSize}。`, 'warning');
            }

            const model = createModel(lookback, learningRate);
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

            if (predictionValues.length === 0) {
                showStatus('測試樣本數為 0，無法生成預測結果。', 'warning');
                tf.dispose([xAll, yAll, xTrain, yTrain, xTest, yTest]);
                model.dispose();
                return;
            }

            const labels = dataset.labels.slice(boundedTrainSize);
            let correctPredictions = 0;
            predictionValues.forEach((value, index) => {
                const predictedLabel = value >= 0.5 ? 1 : 0;
                if (predictedLabel === labels[index]) {
                    correctPredictions += 1;
                }
            });
            const manualAccuracy = correctPredictions / predictionValues.length;

            const trainingOdds = computeTrainingOdds(dataset.returns, boundedTrainSize);
            state.odds = trainingOdds;

            const initialCapital = resolveInitialCapital();
            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);
            const totalPredictions = predictionValues.length;

            let nextDayProbability = Number.NaN;
            if (dataset.returns.length >= lookback) {
                const futureWindow = dataset.returns.slice(dataset.returns.length - lookback);
                if (futureWindow.length === lookback) {
                    const normalisedFuture = futureWindow.map((value) => (value - normaliser.mean) / (normaliser.std || 1));
                    const nextTensor = tf.tensor3d([normalisedFuture.map((value) => [value])]);
                    const nextPredictionTensor = model.predict(nextTensor);
                    const nextData = await nextPredictionTensor.data();
                    nextDayProbability = nextData[0];
                    nextPredictionTensor.dispose();
                    nextTensor.dispose();
                }
            }

            state.lastRun = {
                version: VERSION_TAG,
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy,
                testLoss,
                totalPredictions,
                trainingOdds,
                predictionValues,
                testReturns,
                testMeta,
                initialCapital,
                nextDayProbability,
                lastTradeDate: testMeta[testMeta.length - 1]?.sellDate || null,
                lastDataDate: dataset.baseRows[dataset.baseRows.length - 1]?.date || null,
                seedValue: Number.isFinite(seedValue) ? seedValue : null,
            };
            state.config = {
                useKelly: config.useKelly,
                fixedFraction: config.fixedFraction,
                threshold: config.threshold,
            };

            recomputeTrades();

            const resolvedTestAccuracy = state.lastSummary?.testAccuracy ?? (Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy);
            showStatus(`完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${formatPercent(resolvedTestAccuracy, 2)}。`, 'success');

            if (state.seedQueue.length > 0) {
                const nextSeed = state.seedQueue.shift();
                if (elements.seedInput) {
                    elements.seedInput.value = nextSeed;
                }
                state.currentSeed = nextSeed;
                setSeedStatus(`已切換至下一個種子 ${nextSeed}，剩餘 ${state.seedQueue.length} 組待測。`, 'info');
            }

            tf.dispose([xAll, yAll, xTrain, yTrain, xTest, yTest]);
            model.dispose();
        } catch (error) {
            console.error('[AI Prediction] 執行失敗:', error);
            showStatus(`AI 預測執行失敗：${error.message}`, 'error');
        } finally {
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
        elements.probabilityThreshold = document.getElementById('ai-probability-threshold');
        elements.autoThresholdButton = document.getElementById('ai-auto-threshold');
        elements.nextDayForecast = document.getElementById('ai-next-day-forecast');
        elements.seedInput = document.getElementById('ai-seed-value');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.loadSeedButton = document.getElementById('ai-load-seed');
        elements.seedList = document.getElementById('ai-seed-list');
        elements.seedStatus = document.getElementById('ai-seed-status');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.enableKelly) {
            elements.enableKelly.addEventListener('change', handleConfigChange);
        }
        if (elements.fixedFraction) {
            elements.fixedFraction.addEventListener('change', handleConfigChange);
            elements.fixedFraction.addEventListener('blur', handleConfigChange);
        }
        if (elements.probabilityThreshold) {
            elements.probabilityThreshold.addEventListener('change', handleConfigChange);
            elements.probabilityThreshold.addEventListener('blur', handleConfigChange);
        }
        if (elements.autoThresholdButton) {
            elements.autoThresholdButton.addEventListener('click', autoTuneThreshold);
        }
        if (elements.saveSeedButton) {
            elements.saveSeedButton.addEventListener('click', handleSaveSeed);
        }
        if (elements.loadSeedButton) {
            elements.loadSeedButton.addEventListener('click', handleLoadSeed);
        }

        updateDatasetSummary(getVisibleData());
        readConfigFromInputs();
        refreshSeedOptions();
        if (elements.seedStatus) {
            const seeds = loadStoredSeeds();
            if (seeds.length === 0) {
                setSeedStatus('尚未儲存種子。', 'info');
            }
        }

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

        window.addEventListener('lazybacktest:visible-data-changed', (event) => {
            if (event && typeof event.detail === 'object') {
                updateDatasetSummary(getVisibleData());
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
