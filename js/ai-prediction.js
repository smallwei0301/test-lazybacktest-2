/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250924A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-LSTM-20250924A';
    const SEED_STORAGE_KEY = 'lazybacktest-ai-seeds-v1';
    const state = {
        running: false,
        lastSummary: null,
        odds: 1,
        predictionsPayload: null,
        trainingMetrics: null,
        currentTrades: [],
        lastSeedDefault: '',
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
        winThreshold: null,
        optimizeThreshold: null,
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
        nextDayForecast: null,
        seedName: null,
        saveSeedButton: null,
        savedSeedList: null,
        loadSeedButton: null,
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

    const loadStoredSeeds = () => {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(SEED_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取本地種子：', error);
            return [];
        }
    };

    const persistSeeds = (seeds) => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(seeds));
        } catch (error) {
            console.warn('[AI Prediction] 無法儲存本地種子：', error);
        }
    };

    const escapeHTML = (value) => {
        if (typeof value !== 'string') return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const formatPercent = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    };

    const formatNumber = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
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

    const computeMean = (values) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sum = values.reduce((acc, value) => acc + value, 0);
        return sum / values.length;
    };

    const computeStd = (values, mean) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const base = Number.isFinite(mean) ? mean : computeMean(values);
        if (!Number.isFinite(base)) return NaN;
        const variance = values.reduce((acc, value) => acc + ((value - base) ** 2), 0) / values.length;
        return Math.sqrt(Math.max(variance, 0));
    };

    const sanitizeFraction = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0.01;
        return Math.min(Math.max(num, 0.01), 1);
    };

    const parseWinThreshold = () => {
        if (!elements.winThreshold) return 0.5;
        const percent = Math.round(parseNumberInput(elements.winThreshold, 60, { min: 50, max: 100 }));
        elements.winThreshold.value = String(percent);
        const threshold = percent / 100;
        state.winThreshold = threshold;
        return threshold;
    };

    const refreshSeedOptions = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        const options = seeds
            .map((seed) => `<option value="${escapeHTML(seed.id)}">${escapeHTML(seed.name || '未命名種子')}</option>`)
            .join('');
        elements.savedSeedList.innerHTML = options;
    };

    const buildSeedDefaultName = (summary) => {
        if (!summary) return '';
        const trainText = formatPercent(summary.trainAccuracy, 1);
        const testText = formatPercent(summary.testAccuracy, 1);
        return `訓練勝率${trainText}｜測試正確率${testText}`;
    };

    const applySeedDefaultName = (summary) => {
        if (!elements.seedName) return;
        const defaultName = buildSeedDefaultName(summary);
        elements.seedName.dataset.defaultName = defaultName;
        if (!elements.seedName.value || elements.seedName.value === state.lastSeedDefault) {
            elements.seedName.value = defaultName;
        }
        state.lastSeedDefault = defaultName;
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

    const renderTrades = (records, forecast) => {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = forecast && Number.isFinite(forecast.probability)
                ? `
                    <tr class="bg-muted/30">
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>
                        </td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                    </tr>
                `
                : '';
            return;
        }
        const limited = rows.slice(-200);
        const htmlParts = limited.map((trade) => {
            const probabilityText = formatPercent(trade.probability, 1);
            const actualReturnText = formatPercent(trade.actualReturn, 2);
            const fractionText = formatPercent(trade.fraction, 2);
            const tradeReturnText = formatPercent(trade.tradeReturn, 2);
            const actualClass = Number.isFinite(trade.actualReturn) && trade.actualReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const tradeReturnClass = Number.isFinite(trade.tradeReturn) && trade.tradeReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const badge = trade.isForecast
                ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>`
                : '';
            return `
                <tr${trade.isForecast ? ' class="bg-muted/30"' : ''}>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(trade.tradeDate || '—')}${badge}</td>
                    <td class="px-3 py-2 text-right">${probabilityText}</td>
                    <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                    <td class="px-3 py-2 text-right">${fractionText}</td>
                    <td class="px-3 py-2 text-right ${tradeReturnClass}">${tradeReturnText}</td>
                </tr>
            `;
        });

        if (forecast && Number.isFinite(forecast.probability)) {
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                </tr>
            `);
        }

        elements.tradeTableBody.innerHTML = htmlParts.join('');
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
        if (elements.hitRate) {
            const thresholdPercent = Number.isFinite(summary.threshold) ? `${Math.round(summary.threshold * 100)}%` : '—';
            elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}｜勝率門檻：${thresholdPercent}`;
        }
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(summary.tradeReturnMedian, 2);
        if (elements.averageProfit) {
            const stdText = formatPercent(summary.tradeReturnStdDev, 2);
            elements.averageProfit.textContent = `平均報酬%：${formatPercent(summary.tradeReturnAverage, 2)}｜交易次數：${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}｜標準差：${stdText}`;
        }
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly
                ? '已啟用凱利公式'
                : `固定投入 ${formatPercent(summary.fixedFraction, 2)}`;
            const medianText = formatPercent(summary.tradeReturnMedian, 2);
            const averageText = formatPercent(summary.tradeReturnAverage, 2);
            elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，勝率門檻設定為 ${Math.round((summary.threshold || 0.5) * 100)}%，執行 ${summary.executedTrades} 筆交易，${strategyLabel}。交易報酬% 中位數 ${medianText}，平均報酬% ${averageText}。`;
        }
        if (elements.nextDayForecast) {
            const threshold = Number.isFinite(summary.threshold) ? summary.threshold : parseWinThreshold();
            const forecast = summary.forecast;
            if (!forecast || !Number.isFinite(forecast.probability)) {
                elements.nextDayForecast.textContent = '尚未計算隔日預測。';
            } else {
                const baseLabel = forecast.referenceDate ? `以 ${forecast.referenceDate} 收盤為基準` : '以最近一次收盤為基準';
                const meetsThreshold = Number.isFinite(threshold)
                    ? (forecast.probability >= threshold
                        ? '符合當前勝率門檻，可列入隔日進場條件評估。'
                        : '未達當前勝率門檻，建議僅作為觀察參考。')
                    : '';
                const kellyText = summary.usingKelly && Number.isFinite(forecast.fraction)
                    ? `凱利公式建議投入比例約 ${formatPercent(forecast.fraction, 2)}。`
                    : '';
                elements.nextDayForecast.textContent = `${baseLabel} 的隔日上漲機率為 ${formatPercent(forecast.probability, 1)}；勝率門檻 ${Math.round(threshold * 100)}%，${meetsThreshold}${kellyText}`;
            }
        }
        applySeedDefaultName(summary);
    };

    const computeTradeOutcomes = (payload, options, trainingOdds) => {
        const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
        const meta = Array.isArray(payload?.meta) ? payload.meta : [];
        const returns = Array.isArray(payload?.returns) ? payload.returns : [];
        const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.5;
        const useKelly = Boolean(options.useKelly);
        const fixedFraction = sanitizeFraction(options.fixedFraction);

        const executedTrades = [];
        const tradeReturns = [];
        let wins = 0;

        for (let i = 0; i < predictions.length; i += 1) {
            const probability = Number(predictions[i]);
            const metaItem = meta[i];
            const actualReturn = returns[i];
            if (!Number.isFinite(probability) || !metaItem || !Number.isFinite(actualReturn)) {
                continue;
            }
            if (probability < threshold) {
                continue;
            }
            const tradeDate = typeof metaItem.sellDate === 'string' && metaItem.sellDate
                ? metaItem.sellDate
                : (typeof metaItem.tradeDate === 'string' && metaItem.tradeDate
                    ? metaItem.tradeDate
                    : (typeof metaItem.date === 'string' && metaItem.date ? metaItem.date : null));
            if (!tradeDate) {
                continue;
            }
            const fraction = useKelly
                ? computeKellyFraction(probability, trainingOdds)
                : fixedFraction;
            const tradeReturn = actualReturn * fraction;
            if (actualReturn > 0) {
                wins += 1;
            }
            executedTrades.push({
                tradeDate,
                probability,
                actualReturn,
                fraction,
                tradeReturn,
            });
            tradeReturns.push(tradeReturn);
        }

        const executed = executedTrades.length;
        const hitRate = executed > 0 ? wins / executed : 0;
        const median = tradeReturns.length > 0 ? computeMedian(tradeReturns) : NaN;
        const average = tradeReturns.length > 0 ? computeMean(tradeReturns) : NaN;
        const stdDev = tradeReturns.length > 1 ? computeStd(tradeReturns, average) : NaN;

        return {
            trades: executedTrades,
            stats: {
                executed,
                hitRate,
                median,
                average,
                stdDev,
            },
        };
    };

    const applyTradeEvaluation = (payload, trainingMetrics, options) => {
        if (!payload) return;
        const metrics = trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(payload?.predictions) ? payload.predictions.length : 0,
        };
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(state.odds) ? state.odds : 1);
        const evaluation = computeTradeOutcomes(payload, options, trainingOdds);
        const forecast = payload.forecast && Number.isFinite(payload.forecast?.probability)
            ? { ...payload.forecast }
            : null;
        if (forecast) {
            const forecastFraction = options.useKelly
                ? computeKellyFraction(forecast.probability, trainingOdds)
                : sanitizeFraction(options.fixedFraction);
            forecast.fraction = forecastFraction;
        }

        const summary = {
            version: VERSION_TAG,
            trainAccuracy: metrics.trainAccuracy,
            trainLoss: metrics.trainLoss,
            testAccuracy: metrics.testAccuracy,
            testLoss: metrics.testLoss,
            totalPredictions: Number.isFinite(metrics.totalPredictions)
                ? metrics.totalPredictions
                : (Array.isArray(payload.predictions) ? payload.predictions.length : 0),
            executedTrades: evaluation.stats.executed,
            hitRate: evaluation.stats.hitRate,
            tradeReturnMedian: evaluation.stats.median,
            tradeReturnAverage: evaluation.stats.average,
            tradeReturnStdDev: evaluation.stats.stdDev,
            usingKelly: Boolean(options.useKelly),
            fixedFraction: sanitizeFraction(options.fixedFraction),
            threshold: Number.isFinite(options.threshold) ? options.threshold : 0.5,
            forecast,
        };
        state.lastSummary = summary;
        state.trainingMetrics = metrics;
        state.currentTrades = evaluation.trades;
        updateSummaryMetrics(summary);
        renderTrades(evaluation.trades, summary.forecast);
    };

    const recomputeTradesFromState = () => {
        if (!state.predictionsPayload || !state.trainingMetrics) return;
        const threshold = parseWinThreshold();
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        applyTradeEvaluation(state.predictionsPayload, state.trainingMetrics, {
            threshold,
            useKelly,
            fixedFraction,
        });
    };

    const optimiseWinThreshold = () => {
        if (!state.predictionsPayload || !state.trainingMetrics) {
            showStatus('請先完成一次 AI 預測或載入已儲存的種子。', 'warning');
            return;
        }
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        const payload = state.predictionsPayload;
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(state.odds) ? state.odds : 1);
        let bestThreshold = 0.5;
        let bestMedian = Number.NEGATIVE_INFINITY;
        let bestAverage = Number.NEGATIVE_INFINITY;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = computeTradeOutcomes(payload, {
                threshold,
                useKelly,
                fixedFraction,
            }, trainingOdds);
            const median = evaluation.stats.median;
            const average = evaluation.stats.average;
            const normalizedMedian = Number.isFinite(median) ? median : Number.NEGATIVE_INFINITY;
            const normalizedAverage = Number.isFinite(average) ? average : Number.NEGATIVE_INFINITY;
            if (
                normalizedMedian > bestMedian
                || (normalizedMedian === bestMedian && normalizedAverage > bestAverage)
                || (normalizedMedian === bestMedian && normalizedAverage === bestAverage && threshold < bestThreshold)
            ) {
                bestMedian = normalizedMedian;
                bestAverage = normalizedAverage;
                bestThreshold = threshold;
            }
        }
        if (!Number.isFinite(bestMedian) || bestMedian === Number.NEGATIVE_INFINITY) {
            showStatus('門檻掃描後仍無符合條件的交易。已維持原門檻設定。', 'warning');
            return;
        }
        elements.winThreshold.value = String(Math.round(bestThreshold * 100));
        state.winThreshold = bestThreshold;
        recomputeTradesFromState();
        showStatus(`最佳化完成：勝率門檻 ${Math.round(bestThreshold * 100)}% 對應交易報酬% 中位數 ${formatPercent(bestMedian, 2)}。`, 'success');
    };

    const handleSaveSeed = () => {
        if (!state.predictionsPayload || !state.trainingMetrics || !state.lastSummary) {
            showStatus('請先執行 AI 預測，再儲存種子。', 'warning');
            return;
        }
        if (typeof window === 'undefined' || !window.localStorage) {
            showStatus('此環境不支援本地儲存功能。', 'error');
            return;
        }
        const seeds = loadStoredSeeds();
        const summary = state.lastSummary;
        const defaultName = buildSeedDefaultName(summary) || '未命名種子';
        const inputName = elements.seedName?.value?.trim();
        const seedName = inputName || defaultName;
        const newSeed = {
            id: `seed-${Date.now()}`,
            name: seedName,
            createdAt: Date.now(),
            payload: {
                predictions: state.predictionsPayload.predictions,
                meta: state.predictionsPayload.meta,
                returns: state.predictionsPayload.returns,
                trainingOdds: state.predictionsPayload.trainingOdds,
                forecast: state.predictionsPayload.forecast,
                datasetLastDate: state.predictionsPayload.datasetLastDate,
                hyperparameters: state.predictionsPayload.hyperparameters,
            },
            trainingMetrics: state.trainingMetrics,
            summary: {
                threshold: summary.threshold,
                usingKelly: summary.usingKelly,
                fixedFraction: summary.fixedFraction,
            },
            version: VERSION_TAG,
        };
        seeds.push(newSeed);
        persistSeeds(seeds);
        refreshSeedOptions();
        showStatus(`已儲存種子「${seedName}」。`, 'success');
    };

    const activateSeed = (seed) => {
        if (!seed) return;
        state.predictionsPayload = {
            predictions: Array.isArray(seed.payload?.predictions) ? seed.payload.predictions : [],
            meta: Array.isArray(seed.payload?.meta) ? seed.payload.meta : [],
            returns: Array.isArray(seed.payload?.returns) ? seed.payload.returns : [],
            trainingOdds: seed.payload?.trainingOdds,
            forecast: seed.payload?.forecast || null,
            datasetLastDate: seed.payload?.datasetLastDate || null,
            hyperparameters: seed.payload?.hyperparameters || null,
        };
        const metrics = seed.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(state.predictionsPayload.predictions)
                ? state.predictionsPayload.predictions.length
                : 0,
        };
        state.trainingMetrics = metrics;
        state.odds = Number.isFinite(seed.payload?.trainingOdds) ? seed.payload.trainingOdds : state.odds;

        if (elements.lookback && Number.isFinite(seed.payload?.hyperparameters?.lookback)) {
            elements.lookback.value = seed.payload.hyperparameters.lookback;
        }
        if (elements.epochs && Number.isFinite(seed.payload?.hyperparameters?.epochs)) {
            elements.epochs.value = seed.payload.hyperparameters.epochs;
        }
        if (elements.batchSize && Number.isFinite(seed.payload?.hyperparameters?.batchSize)) {
            elements.batchSize.value = seed.payload.hyperparameters.batchSize;
        }
        if (elements.learningRate && Number.isFinite(seed.payload?.hyperparameters?.learningRate)) {
            elements.learningRate.value = seed.payload.hyperparameters.learningRate;
        }

        if (elements.enableKelly && typeof seed.summary?.usingKelly === 'boolean') {
            elements.enableKelly.checked = seed.summary.usingKelly;
        }
        if (elements.fixedFraction && Number.isFinite(seed.summary?.fixedFraction)) {
            elements.fixedFraction.value = seed.summary.fixedFraction;
        }
        if (elements.winThreshold && Number.isFinite(seed.summary?.threshold)) {
            elements.winThreshold.value = String(Math.round(seed.summary.threshold * 100));
        }

        recomputeTradesFromState();
    };

    const handleLoadSeed = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        const selectedIds = Array.from(elements.savedSeedList.selectedOptions || []).map((option) => option.value);
        if (selectedIds.length === 0) {
            showStatus('請先選擇至少一個已儲存的種子。', 'warning');
            return;
        }
        const selectedSeeds = selectedIds
            .map((id) => seeds.find((seed) => seed.id === id))
            .filter((seed) => Boolean(seed));
        if (selectedSeeds.length === 0) {
            showStatus('找不到選取的種子資料，請重新整理列表。', 'error');
            refreshSeedOptions();
            return;
        }
        const latestSeed = selectedSeeds[selectedSeeds.length - 1];
        activateSeed(latestSeed);
        showStatus(`已載入種子：${selectedSeeds.map((seed) => seed.name).join('、')}。`, 'success');
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
            const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
            const useKelly = Boolean(elements.enableKelly?.checked);

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
            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);

            let nextDayForecast = null;
            if (dataset.returns.length >= lookback) {
                const tailWindow = dataset.returns.slice(dataset.returns.length - lookback);
                if (tailWindow.length === lookback) {
                    const normalizedTail = tailWindow.map((value) => (value - normaliser.mean) / (normaliser.std || 1));
                    const forecastInput = tf.tensor([normalizedTail.map((value) => [value])]);
                    const forecastTensor = model.predict(forecastInput);
                    const forecastArray = Array.from(await forecastTensor.data());
                    nextDayForecast = {
                        probability: forecastArray[0],
                        referenceDate: dataset.baseRows?.[dataset.baseRows.length - 1]?.date || null,
                    };
                    forecastInput.dispose();
                    forecastTensor.dispose();
                }
            }

            const totalPredictions = predictionValues.length;
            const resolvedTestAccuracy = Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy;
            const trainingMetrics = {
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: resolvedTestAccuracy,
                testLoss,
                totalPredictions,
            };

            state.trainingMetrics = trainingMetrics;
            state.predictionsPayload = {
                predictions: predictionValues,
                meta: testMeta,
                returns: testReturns,
                trainingOdds,
                forecast: nextDayForecast,
                datasetLastDate: dataset.baseRows?.[dataset.baseRows.length - 1]?.date || null,
                hyperparameters: {
                    lookback,
                    epochs,
                    batchSize: Math.min(batchSize, boundedTrainSize),
                    learningRate,
                },
            };

            const threshold = parseWinThreshold();
            const fixedFractionValue = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
            applyTradeEvaluation(state.predictionsPayload, trainingMetrics, {
                threshold,
                useKelly,
                fixedFraction: fixedFractionValue,
            });

            const testAccuracyText = formatPercent(resolvedTestAccuracy, 2);
            showStatus(`完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${testAccuracyText}。`, 'success');

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
        elements.winThreshold = document.getElementById('ai-win-threshold');
        elements.optimizeThreshold = document.getElementById('ai-optimize-threshold');
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
        elements.nextDayForecast = document.getElementById('ai-next-day-forecast');
        elements.seedName = document.getElementById('ai-seed-name');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.savedSeedList = document.getElementById('ai-saved-seeds');
        elements.loadSeedButton = document.getElementById('ai-load-seed');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.enableKelly) {
            elements.enableKelly.addEventListener('change', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.fixedFraction) {
            elements.fixedFraction.addEventListener('change', () => {
                recomputeTradesFromState();
            });
            elements.fixedFraction.addEventListener('blur', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.winThreshold) {
            elements.winThreshold.addEventListener('change', () => {
                recomputeTradesFromState();
            });
            elements.winThreshold.addEventListener('blur', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.optimizeThreshold) {
            elements.optimizeThreshold.addEventListener('click', () => {
                optimiseWinThreshold();
            });
        }

        if (elements.saveSeedButton) {
            elements.saveSeedButton.addEventListener('click', () => {
                handleSaveSeed();
            });
        }

        if (elements.loadSeedButton) {
            elements.loadSeedButton.addEventListener('click', () => {
                handleLoadSeed();
            });
        }

        refreshSeedOptions();
        parseWinThreshold();

        updateDatasetSummary(getVisibleData());

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
