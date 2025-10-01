/* global tf, document, window */

// Patch Tag: LB-AI-PREDICT-20250922A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-PREDICT-20250922A';
    const STORAGE_KEYS = {
        seeds: 'lazybacktest-ai-seeds-v1',
    };
    const state = {
        running: false,
        lastSummary: null,
        odds: 1,
        predictionRecords: [],
        nextPrediction: null,
        metricsBaseline: null,
        config: {
            useKelly: false,
            fixedFraction: 0.2,
            threshold: 0.6,
        },
        seedValue: 202409,
        seedQueue: [],
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
        winRateThreshold: null,
        bestThresholdButton: null,
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
        seedValue: null,
        seedName: null,
        saveSeedButton: null,
        loadSeedButton: null,
        savedSeeds: null,
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

    const computeMedian = (values) => {
        const source = Array.isArray(values) ? values.filter((value) => Number.isFinite(value)).slice() : [];
        if (source.length === 0) return NaN;
        source.sort((a, b) => a - b);
        const mid = Math.floor(source.length / 2);
        if (source.length % 2 === 0) {
            return (source[mid - 1] + source[mid]) / 2;
        }
        return source[mid];
    };

    const computeStandardDeviation = (values) => {
        const source = Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : [];
        if (source.length === 0) return NaN;
        const mean = source.reduce((sum, value) => sum + value, 0) / source.length;
        const variance = source.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / source.length;
        return Math.sqrt(Math.max(variance, 0));
    };

    const clampFraction = (value) => {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
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

    const setSeedInputValue = (value) => {
        if (elements.seedValue) {
            elements.seedValue.value = value;
        }
    };

    const parseSeedValue = () => {
        const fallback = Number.isFinite(state.seedValue) ? state.seedValue : 202409;
        const seed = Math.round(parseNumberInput(elements.seedValue, fallback, { min: 1 }));
        setSeedInputValue(seed);
        state.seedValue = seed;
        return seed;
    };

    const readSeedStorage = () => {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(STORAGE_KEYS.seeds);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((entry) => entry && Number.isFinite(entry.value))
                .map((entry) => ({
                    id: entry.id || `seed-${entry.value}`,
                    value: Number(entry.value),
                    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `Seed ${entry.value}`,
                    createdAt: entry.createdAt || null,
                    version: entry.version || null,
                }));
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取本地種子儲存：', error);
            return [];
        }
    };

    const writeSeedStorage = (entries) => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(STORAGE_KEYS.seeds, JSON.stringify(entries));
        } catch (error) {
            console.warn('[AI Prediction] 無法寫入本地種子儲存：', error);
        }
    };

    const refreshSeedOptions = () => {
        if (!elements.savedSeeds) return;
        const seeds = readSeedStorage();
        elements.savedSeeds.innerHTML = seeds
            .map((entry) => {
                const label = `${entry.name}（${entry.value}）`;
                return `<option value="${entry.value}" data-id="${entry.id}">${label}</option>`;
            })
            .join('');
    };

    const buildDefaultSeedName = (summary) => {
        if (!summary) return '';
        const trainText = formatPercent(summary.trainAccuracy, 1);
        const testText = formatPercent(summary.testAccuracy, 1);
        if (trainText === '—' && testText === '—') return '';
        return `訓練${trainText}｜測試${testText}`;
    };

    const ensureSeedNameDefault = (summary) => {
        if (!elements.seedName) return;
        if (elements.seedName.dataset.userEdited === 'true') return;
        const defaultName = buildDefaultSeedName(summary);
        if (defaultName) {
            elements.seedName.value = defaultName;
            elements.seedName.dataset.autofill = 'true';
            elements.seedName.dataset.userEdited = 'false';
        }
    };

    const handleSaveSeed = () => {
        if (!state.lastSummary) {
            showStatus('請先完成一次 AI 預測後再儲存種子。', 'warning');
            return;
        }
        const seedValue = parseSeedValue();
        const seeds = readSeedStorage();
        const nameInput = elements.seedName ? elements.seedName.value.trim() : '';
        const defaultName = buildDefaultSeedName(state.lastSummary);
        const name = nameInput || defaultName || `Seed ${seedValue}`;
        const entry = {
            id: `seed-${seedValue}-${Date.now()}`,
            value: seedValue,
            name,
            createdAt: new Date().toISOString(),
            version: VERSION_TAG,
        };
        const existingIndex = seeds.findIndex((item) => item.value === seedValue);
        if (existingIndex >= 0) {
            seeds[existingIndex] = entry;
        } else {
            seeds.push(entry);
        }
        writeSeedStorage(seeds);
        refreshSeedOptions();
        showStatus(`已儲存種子：${name}（${seedValue}）`, 'success');
    };

    const handleLoadSeed = () => {
        if (!elements.savedSeeds) {
            showStatus('目前無法載入種子，請重新整理頁面。', 'error');
            return;
        }
        const selectedOptions = Array.from(elements.savedSeeds.selectedOptions || []);
        if (selectedOptions.length === 0) {
            showStatus('請先選擇欲載入的種子。', 'warning');
            return;
        }
        const selectedValues = selectedOptions
            .map((option) => Number(option.value))
            .filter((value) => Number.isFinite(value) && value > 0);
        if (selectedValues.length === 0) {
            showStatus('選取的種子值無效，請重新選擇。', 'error');
            return;
        }
        state.seedQueue = selectedValues.slice();
        const firstSeed = state.seedQueue[0];
        if (Number.isFinite(firstSeed)) {
            setSeedInputValue(firstSeed);
            state.seedValue = firstSeed;
        }
        showStatus(`已載入 ${state.seedQueue.length} 個種子，當前使用 ${firstSeed}。`, 'success');
    };

    const advanceSeedQueueAfterRun = () => {
        if (!Array.isArray(state.seedQueue) || state.seedQueue.length === 0) return '';
        if (state.seedQueue[0] === state.seedValue) {
            state.seedQueue.shift();
        }
        if (state.seedQueue.length === 0) return '';
        const nextSeed = state.seedQueue[0];
        setSeedInputValue(nextSeed);
        state.seedValue = nextSeed;
        return `，已預載下一個種子 ${nextSeed}`;
    };

    const parseThresholdValue = () => {
        const fallbackPercent = Number.isFinite(state.config.threshold)
            ? Math.round(state.config.threshold * 100)
            : 60;
        const thresholdPercent = Math.round(
            parseNumberInput(elements.winRateThreshold, fallbackPercent, { min: 50, max: 100 })
        );
        if (elements.winRateThreshold) {
            elements.winRateThreshold.value = thresholdPercent;
        }
        const decimal = thresholdPercent / 100;
        state.config.threshold = decimal;
        return decimal;
    };

    const setThresholdInput = (decimal) => {
        if (!elements.winRateThreshold) return;
        const percent = Math.round(clampFraction(decimal) * 100);
        elements.winRateThreshold.value = Math.min(100, Math.max(50, percent));
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

    const createModel = (lookback, learningRate, seedValue) => {
        const baseSeed = Number.isFinite(seedValue) ? Math.abs(Math.floor(seedValue)) : 202409;
        const model = tf.sequential();
        model.add(
            tf.layers.lstm({
                units: 32,
                returnSequences: true,
                inputShape: [lookback, 1],
                kernelInitializer: tf.initializers.glorotUniform({ seed: baseSeed + 1 }),
                recurrentInitializer: tf.initializers.orthogonal({ seed: baseSeed + 2 }),
                biasInitializer: tf.initializers.zeros(),
            })
        );
        model.add(tf.layers.dropout({ rate: 0.2, seed: baseSeed + 3 }));
        model.add(
            tf.layers.lstm({
                units: 16,
                kernelInitializer: tf.initializers.glorotUniform({ seed: baseSeed + 4 }),
                recurrentInitializer: tf.initializers.orthogonal({ seed: baseSeed + 5 }),
                biasInitializer: tf.initializers.zeros(),
            })
        );
        model.add(tf.layers.dropout({ rate: 0.1, seed: baseSeed + 6 }));
        model.add(
            tf.layers.dense({
                units: 16,
                activation: 'relu',
                kernelInitializer: tf.initializers.heNormal({ seed: baseSeed + 7 }),
                biasInitializer: tf.initializers.zeros(),
            })
        );
        model.add(
            tf.layers.dense({
                units: 1,
                activation: 'sigmoid',
                kernelInitializer: tf.initializers.glorotUniform({ seed: baseSeed + 8 }),
                biasInitializer: tf.initializers.zeros(),
            })
        );
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
        const rows = Array.isArray(records) ? records.filter((row) => row) : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = '';
            return;
        }
        const projection = rows.find((row) => row.projected);
        const actualRows = projection ? rows.filter((row) => !row.projected) : rows;
        const limitedActuals = projection ? actualRows.slice(0, 199) : actualRows.slice(0, 200);
        const finalRows = projection ? [...limitedActuals, projection] : limitedActuals;
        const html = finalRows
            .map((trade) => {
                const probabilityText = formatPercent(trade.probability, 1);
                const actualReturnText = Number.isFinite(trade.actualReturn)
                    ? formatPercent(trade.actualReturn, 2)
                    : '—';
                const fractionText = formatPercent(trade.fraction, 2);
                const tradeReturnText = Number.isFinite(trade.tradeReturn)
                    ? formatPercent(trade.tradeReturn, 2)
                    : '—';
                const profitText = Number.isFinite(trade.profit)
                    ? formatCurrency(trade.profit)
                    : '—';
                const dateText = trade.projected
                    ? (trade.tradeDateLabel || `下一交易日（基於 ${trade.tradeDate || '最新交易日'}）`)
                    : (trade.tradeDate || '—');
                const rowClass = trade.projected ? 'bg-slate-100/60 text-slate-600 italic' : '';
                const probabilityClass = trade.projected ? 'text-slate-500' : '';
                const actualClass = Number.isFinite(trade.actualReturn)
                    ? (trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600')
                    : '';
                const returnClass = Number.isFinite(trade.tradeReturn)
                    ? (trade.tradeReturn >= 0 ? 'text-emerald-600' : 'text-rose-600')
                    : '';
                const profitClass = Number.isFinite(trade.profit)
                    ? (trade.profit >= 0 ? 'text-emerald-600' : 'text-rose-600')
                    : '';
                return `
                    <tr class="${rowClass}">
                        <td class="px-3 py-2 whitespace-nowrap">${dateText}</td>
                        <td class="px-3 py-2 text-right ${probabilityClass}">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${returnClass}">${tradeReturnText}</td>
                        <td class="px-3 py-2 text-right ${profitClass}">${profitText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    };

    const buildNextProjectionRecord = (config) => {
        if (!state.nextPrediction || !Number.isFinite(state.nextPrediction.probability)) {
            return null;
        }
        const fraction = config.useKelly
            ? computeKellyFraction(state.nextPrediction.probability, state.odds)
            : clampFraction(config.fixedFraction);
        return {
            projected: true,
            tradeDate: state.nextPrediction.anchorDate || '',
            tradeDateLabel: state.nextPrediction.anchorDate
                ? `下一交易日（基於 ${state.nextPrediction.anchorDate}）`
                : '下一交易日',
            probability: state.nextPrediction.probability,
            actualReturn: null,
            fraction,
            tradeReturn: null,
            profit: null,
        };
    };

    const evaluateTrades = (overrides = {}) => {
        const records = Array.isArray(state.predictionRecords) ? state.predictionRecords : [];
        if (records.length === 0) {
            return { trades: [], summary: state.lastSummary || null };
        }
        const config = {
            useKelly: overrides.useKelly ?? state.config.useKelly,
            fixedFraction: clampFraction(
                Number.isFinite(overrides.fixedFraction) ? overrides.fixedFraction : state.config.fixedFraction
            ),
            threshold: clampFraction(Number.isFinite(overrides.threshold) ? overrides.threshold : state.config.threshold),
        };
        const initialCapital = resolveInitialCapital();
        let capital = initialCapital;
        let wins = 0;
        const executedTrades = [];
        const tradeReturns = [];
        records.forEach((record) => {
            if (!record || !Number.isFinite(record.probability)) return;
            if (record.probability < config.threshold) return;
            if (!record.meta) return;
            const fraction = config.useKelly
                ? computeKellyFraction(record.probability, state.odds)
                : clampFraction(config.fixedFraction);
            const actualReturn = Number.isFinite(record.actualReturn) ? record.actualReturn : NaN;
            const profit = Number.isFinite(actualReturn) ? capital * fraction * actualReturn : NaN;
            if (Number.isFinite(profit)) {
                capital += profit;
            }
            if (Number.isFinite(actualReturn) && actualReturn > 0) {
                wins += 1;
            }
            const tradeReturn = Number.isFinite(actualReturn) ? actualReturn * fraction : NaN;
            if (Number.isFinite(tradeReturn)) {
                tradeReturns.push(tradeReturn);
            }
            executedTrades.push({
                probability: record.probability,
                actualReturn,
                fraction,
                profit,
                capitalAfter: capital,
                tradeDate: record.meta?.sellDate || record.meta?.buyDate || '',
                tradeReturn,
            });
        });
        const executed = executedTrades.length;
        const hitRate = executed > 0 ? wins / executed : 0;
        const averageTradeReturn = tradeReturns.length > 0
            ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length
            : 0;
        const medianReturn = computeMedian(tradeReturns);
        const std = computeStandardDeviation(tradeReturns);
        const baseline = state.metricsBaseline || {};
        const summary = {
            version: VERSION_TAG,
            trainAccuracy: baseline.trainAccuracy,
            trainLoss: baseline.trainLoss,
            testAccuracy: baseline.testAccuracy,
            testLoss: baseline.testLoss,
            totalPredictions: records.length,
            executedTrades: executed,
            hitRate,
            tradeReturnMedian: medianReturn,
            averageTradeReturn,
            tradeReturnStd: std,
            finalCapital: capital,
            totalReturn: (capital - initialCapital) / initialCapital,
            usingKelly: config.useKelly,
            threshold: config.threshold,
            fixedFraction: config.useKelly ? null : config.fixedFraction,
        };
        return { trades: executedTrades, summary };
    };

    const applyStrategyEvaluation = (overrides = {}) => {
        if (!Array.isArray(state.predictionRecords) || state.predictionRecords.length === 0) {
            return;
        }
        const evaluation = evaluateTrades(overrides);
        const { summary, trades } = evaluation;
        if (!summary) return;
        state.config = {
            useKelly: summary.usingKelly,
            fixedFraction: clampFraction(
                Number.isFinite(summary.fixedFraction) ? summary.fixedFraction : state.config.fixedFraction
            ),
            threshold: clampFraction(summary.threshold ?? state.config.threshold),
        };
        setThresholdInput(state.config.threshold);
        if (elements.enableKelly) {
            elements.enableKelly.checked = state.config.useKelly;
        }
        state.lastSummary = summary;
        updateSummaryMetrics(summary);
        const projection = buildNextProjectionRecord(state.config);
        const records = projection ? [...trades, projection] : trades;
        renderTrades(records);
    };

    const findBestThreshold = () => {
        if (!Array.isArray(state.predictionRecords) || state.predictionRecords.length === 0) {
            showStatus('請先完成 AI 預測，再尋找最佳勝率門檻。', 'warning');
            return;
        }
        let bestThreshold = state.config.threshold;
        let bestMedian = Number.isFinite(state.lastSummary?.tradeReturnMedian)
            ? state.lastSummary.tradeReturnMedian
            : -Infinity;
        let bestTrades = state.lastSummary?.executedTrades ?? 0;
        let found = Number.isFinite(bestMedian);
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = evaluateTrades({ threshold });
            const summary = evaluation.summary;
            if (!summary) continue;
            const median = Number.isFinite(summary.tradeReturnMedian) ? summary.tradeReturnMedian : -Infinity;
            const trades = summary.executedTrades ?? 0;
            if (!Number.isFinite(median) || median === -Infinity) continue;
            if (
                !found
                || median > bestMedian
                || (median === bestMedian && trades > bestTrades)
                || (median === bestMedian && trades === bestTrades && threshold < bestThreshold)
            ) {
                bestMedian = median;
                bestTrades = trades;
                bestThreshold = threshold;
                found = true;
            }
        }
        if (!found) {
            showStatus('無法在 50%~100% 範圍內找到有效的勝率門檻，請確認交易樣本是否足夠。', 'warning');
            return;
        }
        state.config.threshold = bestThreshold;
        setThresholdInput(bestThreshold);
        applyStrategyEvaluation({ threshold: bestThreshold });
        const percentText = Math.round(bestThreshold * 100);
        showStatus(`已套用最佳交易報酬%中位數門檻：${percentText}%`, 'success');
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = summary.executedTrades ?? '—';
        if (elements.hitRate) elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}`;
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(summary.tradeReturnMedian, 2);
        if (elements.averageProfit) {
            const avgText = formatPercent(summary.averageTradeReturn, 2);
            const stdText = formatPercent(summary.tradeReturnStd, 2);
            const countText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
            elements.averageProfit.textContent = `平均報酬%：${avgText}｜交易次數：${countText}｜標準差：${stdText}`;
        }
        if (elements.tradeSummary) {
            const thresholdPercent = Math.round((summary.threshold ?? state.config.threshold ?? 0.6) * 100);
            const strategyLabel = summary.usingKelly
                ? '採用凱利公式'
                : `固定比例 ${formatPercent(summary.fixedFraction ?? state.config.fixedFraction, 2)}`;
            elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，依勝率門檻 ${thresholdPercent}% 執行 ${summary.executedTrades} 筆多單交易，${strategyLabel}。交易報酬%中位數 ${formatPercent(summary.tradeReturnMedian, 2)}，平均報酬% ${formatPercent(summary.averageTradeReturn, 2)}，標準差 ${formatPercent(summary.tradeReturnStd, 2)}。`;
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
            const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
            const useKelly = Boolean(elements.enableKelly?.checked);
            const seedValue = parseSeedValue();
            state.predictionRecords = [];
            state.nextPrediction = null;

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

            const model = createModel(lookback, learningRate, seedValue);
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

            const sanitizedFraction = clampFraction(fixedFraction);
            if (elements.fixedFraction) {
                elements.fixedFraction.value = sanitizedFraction.toFixed(2);
            }
            const threshold = parseThresholdValue();
            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);
            state.predictionRecords = predictionValues.map((probability, index) => ({
                probability,
                actualReturn: testReturns[index],
                meta: testMeta[index],
            }));
            const resolvedTestAccuracy = Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy;
            state.metricsBaseline = {
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: resolvedTestAccuracy,
                testLoss,
            };
            state.config.useKelly = useKelly;
            state.config.fixedFraction = sanitizedFraction;
            state.config.threshold = threshold;

            state.nextPrediction = null;
            if (dataset.returns.length >= lookback) {
                const rawSequence = dataset.returns.slice(dataset.returns.length - lookback);
                if (rawSequence.length === lookback) {
                    const normalisedNext = rawSequence.map((value) => (value - normaliser.mean) / (normaliser.std || 1));
                    const nextInput = tf.tensor([normalisedNext.map((value) => [value])]);
                    const nextOutput = model.predict(nextInput);
                    const nextData = await nextOutput.data();
                    nextInput.dispose();
                    nextOutput.dispose();
                    state.nextPrediction = {
                        probability: nextData[0],
                        anchorDate: dataset.baseRows?.[dataset.baseRows.length - 1]?.date || '',
                    };
                }
            }

            if (state.predictionRecords.length === 0) {
                const fallbackSummary = {
                    version: VERSION_TAG,
                    trainAccuracy: finalTrainAccuracy,
                    trainLoss: finalTrainLoss,
                    testAccuracy: resolvedTestAccuracy,
                    testLoss,
                    totalPredictions: 0,
                    executedTrades: 0,
                    hitRate: 0,
                    tradeReturnMedian: NaN,
                    averageTradeReturn: NaN,
                    tradeReturnStd: NaN,
                    finalCapital: resolveInitialCapital(),
                    totalReturn: 0,
                    usingKelly: useKelly,
                    threshold,
                    fixedFraction: useKelly ? null : sanitizedFraction,
                };
                state.lastSummary = fallbackSummary;
                updateSummaryMetrics(fallbackSummary);
                renderTrades([]);
            } else {
                applyStrategyEvaluation({
                    useKelly,
                    fixedFraction: sanitizedFraction,
                    threshold,
                });
            }

            ensureSeedNameDefault(state.lastSummary);
            const queueNote = advanceSeedQueueAfterRun();
            const statusMessage = `完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${formatPercent(state.metricsBaseline.testAccuracy, 2)}${queueNote}`;
            showStatus(statusMessage, 'success');

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
        elements.winRateThreshold = document.getElementById('ai-winrate-threshold');
        elements.bestThresholdButton = document.getElementById('ai-best-threshold');
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
        elements.seedValue = document.getElementById('ai-seed-value');
        elements.seedName = document.getElementById('ai-seed-name');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.loadSeedButton = document.getElementById('ai-load-seed');
        elements.savedSeeds = document.getElementById('ai-saved-seeds');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.enableKelly) {
            elements.enableKelly.addEventListener('change', () => {
                const useKelly = Boolean(elements.enableKelly.checked);
                state.config.useKelly = useKelly;
                applyStrategyEvaluation({ useKelly });
            });
        }

        if (elements.fixedFraction) {
            elements.fixedFraction.addEventListener('change', () => {
                const sanitized = clampFraction(
                    parseNumberInput(elements.fixedFraction, state.config.fixedFraction || 0.2, { min: 0.01, max: 1 })
                );
                elements.fixedFraction.value = sanitized.toFixed(2);
                state.config.fixedFraction = sanitized;
                if (!state.config.useKelly) {
                    applyStrategyEvaluation({ fixedFraction: sanitized, useKelly: false });
                }
            });
        }

        if (elements.winRateThreshold) {
            setThresholdInput(state.config.threshold);
            elements.winRateThreshold.addEventListener('change', () => {
                const threshold = parseThresholdValue();
                applyStrategyEvaluation({ threshold });
            });
        }

        if (elements.bestThresholdButton) {
            elements.bestThresholdButton.addEventListener('click', () => {
                findBestThreshold();
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

        if (elements.seedName) {
            if (!elements.seedName.dataset.userEdited) {
                elements.seedName.dataset.userEdited = 'false';
            }
            elements.seedName.addEventListener('input', () => {
                elements.seedName.dataset.userEdited = 'true';
                elements.seedName.dataset.autofill = 'false';
            });
        }

        if (elements.seedValue) {
            elements.seedValue.addEventListener('change', () => {
                parseSeedValue();
            });
            setSeedInputValue(state.seedValue);
        }

        refreshSeedOptions();

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
