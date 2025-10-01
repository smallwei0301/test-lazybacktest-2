/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250915A
// Patch Tag: LB-AI-HYBRID-20250930A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-HYBRID-20250930A';
    const MODEL_CONFIGS = {
        lstm: {
            key: 'lstm',
            label: 'LSTM 深度學習',
            runLabel: '啟動 LSTM 預測',
            short: 'LSTM',
        },
        anns: {
            key: 'anns',
            label: 'ANNS 指標神經網路',
            runLabel: '啟動 ANNS 預測',
            short: 'ANNS',
        },
    };
    const STORAGE_KEYS = {
        seed: (model) => `lazybacktest.ai.seed.${model}`,
        threshold: (model) => `lazybacktest.ai.threshold.${model}`,
        trainRatio: 'lazybacktest.ai.trainRatio',
    };
    const DEFAULT_SEED = 20250930;
    const DEFAULT_THRESHOLD = 0.5;
    const state = {
        running: false,
        lastSummary: null,
        odds: 1,
        activeModel: 'lstm',
        trainRatio: 0.8,
        threshold: 0.5,
        seed: 20250930,
        annWorker: null,
        annJob: null,
    };

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        runLabel: null,
        modelSelect: null,
        ratioSelect: null,
        ratioChip: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
        seedInput: null,
        seedSaveButton: null,
        thresholdInput: null,
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
    };

    const getModelConfig = (key) => {
        if (!key || !MODEL_CONFIGS[key]) return MODEL_CONFIGS.lstm;
        return MODEL_CONFIGS[key];
    };

    const formatRatioLabel = (ratio) => {
        const sanitized = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0.5), 0.95) : 0.8;
        const trainPct = Math.round(sanitized * 100);
        const testPct = Math.max(0, 100 - trainPct);
        return `訓練：測試 = ${trainPct}% : ${testPct}%`;
    };

    const updateRunLabel = () => {
        const config = getModelConfig(state.activeModel);
        if (elements.runLabel) {
            elements.runLabel.textContent = config.runLabel;
        }
        if (elements.runButton) {
            elements.runButton.setAttribute('aria-label', config.runLabel);
        }
    };

    const updateRatioChip = () => {
        if (elements.ratioChip) {
            elements.ratioChip.textContent = formatRatioLabel(state.trainRatio);
        }
    };

    const loadPersistedSeed = (modelKey) => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEYS.seed(modelKey));
            if (stored === null) return null;
            const value = Number(stored);
            return Number.isFinite(value) ? value : null;
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取儲存的種子：', error);
            return null;
        }
    };

    const persistSeed = (modelKey, value) => {
        if (!modelKey) return;
        try {
            window.localStorage.setItem(STORAGE_KEYS.seed(modelKey), String(value));
        } catch (error) {
            console.warn('[AI Prediction] 儲存種子失敗：', error);
        }
    };

    const loadPersistedThreshold = (modelKey) => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEYS.threshold(modelKey));
            if (stored === null) return null;
            const value = Number(stored);
            return Number.isFinite(value) ? value : null;
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取預測門檻：', error);
            return null;
        }
    };

    const persistThreshold = (modelKey, value) => {
        if (!modelKey) return;
        try {
            window.localStorage.setItem(STORAGE_KEYS.threshold(modelKey), String(value));
        } catch (error) {
            console.warn('[AI Prediction] 儲存預測門檻失敗：', error);
        }
    };

    const loadPersistedTrainRatio = () => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEYS.trainRatio);
            if (stored === null) return null;
            const value = Number(stored);
            if (!Number.isFinite(value)) return null;
            if (value <= 0.5 || value >= 0.95) return null;
            return value;
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取訓練比例設定：', error);
            return null;
        }
    };

    const persistTrainRatio = (ratio) => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.trainRatio, String(ratio));
        } catch (error) {
            console.warn('[AI Prediction] 儲存訓練比例失敗：', error);
        }
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };

    const applySeed = (seed) => {
        if (!Number.isFinite(seed)) return;
        state.seed = seed;
        try {
            if (typeof tf !== 'undefined' && tf?.util?.seedrandom) {
                tf.util.seedrandom(String(seed));
            }
        } catch (error) {
            console.warn('[AI Prediction] 套用種子失敗：', error);
        }
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

    const showStatus = (message, type = 'info') => {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.style.color = colorMap[type] || colorMap.info;
    };

    const toggleRunning = (flag) => {
        state.running = Boolean(flag);
        if (elements.runButton) {
            elements.runButton.disabled = state.running;
            elements.runButton.classList.toggle('opacity-60', state.running);
            elements.runButton.classList.toggle('cursor-not-allowed', state.running);
        }
        const controls = [
            elements.modelSelect,
            elements.ratioSelect,
            elements.seedInput,
            elements.seedSaveButton,
            elements.thresholdInput,
        ];
        controls.forEach((control) => {
            if (!control) return;
            control.disabled = state.running;
        });
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
            updateRatioChip();
            return;
        }
        const sorted = [...data]
            .filter((row) => row && typeof row.date === 'string')
            .sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
            elements.datasetSummary.textContent = '資料缺少有效日期，請重新回測。';
            updateRatioChip();
            return;
        }
        const firstDate = sorted[0].date;
        const lastDate = sorted[sorted.length - 1].date;
        elements.datasetSummary.textContent = `可用資料 ${sorted.length} 筆，區間 ${firstDate} ~ ${lastDate}。`;
        updateRatioChip();
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
                const returnText = formatPercent(trade.actualReturn, 2);
                const fractionText = formatPercent(trade.fraction, 2);
                const profitText = formatCurrency(trade.profit);
                const capitalText = formatCurrency(trade.capitalAfter);
                return `
                    <tr>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.buyDate}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.sellDate}</td>
                        <td class="px-3 py-2 text-right">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${returnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${trade.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${profitText}</td>
                        <td class="px-3 py-2 text-right font-medium">${capitalText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = summary.executedTrades ?? '—';
        if (elements.hitRate) elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}`;
        if (elements.totalReturn) elements.totalReturn.textContent = `${formatPercent(summary.totalReturn, 2)}（${formatCurrency(summary.finalCapital)}）`;
        if (elements.averageProfit) elements.averageProfit.textContent = `平均每筆：${formatCurrency(summary.averageProfit)}`;
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly ? '已啟用凱利公式' : '採用固定比例';
            const modelLabel = summary.modelLabel || 'AI 模型';
            elements.tradeSummary.textContent = `${modelLabel} 共評估 ${summary.totalPredictions} 筆測試樣本，執行 ${summary.executedTrades} 筆多單交易，${strategyLabel}。最終資金 ${formatCurrency(summary.finalCapital)}，總報酬 ${formatPercent(summary.totalReturn, 2)}。`;
        }
    };

    const computeTradeSummary = (probabilities, testReturns, testMeta, options) => {
        const {
            threshold,
            useKelly,
            fixedFraction,
            trainingOdds,
            initialCapital,
        } = options;
        const safeThreshold = Number.isFinite(threshold)
            ? Math.min(Math.max(threshold, 0.05), 0.95)
            : 0.5;
        const safeFraction = Number.isFinite(fixedFraction)
            ? Math.min(Math.max(fixedFraction, 0.01), 1)
            : 0.2;
        const odds = Number.isFinite(trainingOdds) && trainingOdds > 0 ? trainingOdds : 1;
        const baseCapital = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : 100000;
        let capital = baseCapital;
        let cumulativeProfit = 0;
        let wins = 0;
        let executed = 0;
        const trades = [];

        for (let i = 0; i < probabilities.length; i += 1) {
            const probability = probabilities[i];
            const actualReturn = testReturns[i];
            const meta = testMeta[i];
            if (!Number.isFinite(probability) || !Number.isFinite(actualReturn) || !meta) {
                continue;
            }
            if (probability < safeThreshold) continue;
            const fraction = useKelly
                ? computeKellyFraction(probability, odds)
                : safeFraction;
            const boundedFraction = Math.min(Math.max(fraction, 0), 1);
            const allocation = capital * boundedFraction;
            const profit = allocation * actualReturn;
            capital += profit;
            cumulativeProfit += profit;
            executed += 1;
            if (actualReturn > 0) wins += 1;
            trades.push({
                buyDate: meta.buyDate,
                sellDate: meta.sellDate,
                probability,
                actualReturn,
                fraction: boundedFraction,
                profit,
                capitalAfter: capital,
            });
        }

        const hitRate = executed > 0 ? wins / executed : 0;
        const totalReturn = (capital - baseCapital) / baseCapital;
        const averageProfit = executed > 0 ? cumulativeProfit / executed : 0;

        return {
            trades,
            executed,
            wins,
            capital,
            cumulativeProfit,
            hitRate,
            totalReturn,
            averageProfit,
        };
    };

    const handleAnnWorkerMessage = (event) => {
        const message = event?.data || {};
        if (message.type === 'ai-ann-progress') {
            const progress = Number(message.payload?.progress) || 0;
            const loss = Number(message.payload?.loss);
            const progressText = `${Math.min(100, Math.max(0, Math.round(progress * 100)))}%`;
            const lossText = Number.isFinite(loss) ? ` Loss ${loss.toFixed(4)}` : '';
            showStatus(`ANNS 訓練中… ${progressText}${lossText}`, 'info');
        } else if (message.type === 'ai-ann-result') {
            if (state.annJob && typeof state.annJob.resolve === 'function') {
                state.annJob.resolve(message.payload || {});
            }
            state.annJob = null;
        } else if (message.type === 'ai-ann-error') {
            const errorMessage = message.payload?.message || 'ANNS 執行失敗';
            if (state.annJob && typeof state.annJob.reject === 'function') {
                state.annJob.reject(new Error(errorMessage));
            } else {
                showStatus(`ANNS 執行失敗：${errorMessage}`, 'error');
            }
            state.annJob = null;
        }
    };

    const ensureAnnWorker = () => {
        if (typeof window === 'undefined') return null;
        if (state.annWorker) return state.annWorker;
        const url = typeof window.workerUrl === 'string' ? window.workerUrl : 'js/worker.js';
        try {
            state.annWorker = new Worker(url);
            state.annWorker.addEventListener('message', handleAnnWorkerMessage);
            state.annWorker.addEventListener('error', (event) => {
                const err = event?.error || new Error('ANNS Worker 發生錯誤');
                if (state.annJob && typeof state.annJob.reject === 'function') {
                    state.annJob.reject(err);
                }
                state.annJob = null;
                console.error('[AI Prediction] ANNS Worker error:', err);
            });
        } catch (error) {
            console.error('[AI Prediction] 建立 ANNS Worker 失敗:', error);
            return null;
        }
        return state.annWorker;
    };

    const runLstmPrediction = async (options) => {
        const {
            rows,
            lookback,
            epochs,
            batchSize,
            learningRate,
            fixedFraction,
            useKelly,
            threshold,
            seed,
            trainRatio,
        } = options;

        if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
            throw new Error('未載入 TensorFlow.js');
        }

        applySeed(seed);

        const dataset = buildDataset(rows, lookback);
        if (dataset.sequences.length < Math.max(45, lookback * 3)) {
            throw new Error(`資料樣本不足（需至少 ${Math.max(45, lookback * 3)} 筆有效樣本，目前 ${dataset.sequences.length} 筆）`);
        }

        const totalSamples = dataset.sequences.length;
        const desiredTrain = Math.max(Math.floor(totalSamples * trainRatio), lookback);
        const boundedTrainSize = Math.min(desiredTrain, totalSamples - 1);
        const testSize = totalSamples - boundedTrainSize;
        if (boundedTrainSize <= 0 || testSize <= 0) {
            throw new Error('無法按照指定比例分割訓練與測試集，請延長資料範圍。');
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
            showStatus(`批次大小 ${batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整。`, 'warning');
        }

        const model = createModel(lookback, learningRate);
        showStatus(`LSTM 訓練中（共 ${epochs} 輪）...`, 'info');

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
                    showStatus(`LSTM 訓練中（${epoch + 1}/${epochs}） Loss ${lossText} / Acc ${accText}`, 'info');
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
        const testAccuracyRaw = evalValues[1] ?? NaN;

        const predictionsTensor = model.predict(xTest);
        const predictionValues = Array.from(await predictionsTensor.data());
        predictionsTensor.dispose();

        const labels = dataset.labels.slice(boundedTrainSize);
        let correctPredictions = 0;
        predictionValues.forEach((value, index) => {
            const predictedLabel = value >= threshold ? 1 : 0;
            if (predictedLabel === labels[index]) {
                correctPredictions += 1;
            }
        });
        const manualAccuracy = predictionValues.length > 0 ? (correctPredictions / predictionValues.length) : NaN;

        const trainingOdds = computeTrainingOdds(dataset.returns, boundedTrainSize);
        state.odds = trainingOdds;

        const testMeta = dataset.meta.slice(boundedTrainSize);
        const testReturns = dataset.returns.slice(boundedTrainSize);
        const initialCapital = resolveInitialCapital();
        const tradeSummary = computeTradeSummary(predictionValues, testReturns, testMeta, {
            threshold,
            useKelly,
            fixedFraction,
            trainingOdds,
            initialCapital,
        });

        const totalPredictions = predictionValues.length;
        const summary = {
            version: VERSION_TAG,
            model: 'lstm',
            modelLabel: getModelConfig('lstm').label,
            trainAccuracy: finalTrainAccuracy,
            trainLoss: finalTrainLoss,
            testAccuracy: Number.isFinite(testAccuracyRaw) ? testAccuracyRaw : manualAccuracy,
            testLoss,
            totalPredictions,
            executedTrades: tradeSummary.executed,
            hitRate: tradeSummary.hitRate,
            totalReturn: tradeSummary.totalReturn,
            averageProfit: tradeSummary.averageProfit,
            finalCapital: tradeSummary.capital,
            usingKelly: useKelly,
            threshold,
            trainRatio,
            seed,
        };

        state.lastSummary = summary;

        updateSummaryMetrics(summary);
        renderTrades(tradeSummary.trades);
        showStatus(`LSTM 完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${formatPercent(summary.testAccuracy, 2)}。`, 'success');

        tf.dispose([xAll, yAll, xTrain, yTrain, xTest, yTest]);
        model.dispose();
    };

    const runAnnPrediction = async (options) => {
        const {
            rows,
            epochs,
            batchSize,
            learningRate,
            fixedFraction,
            useKelly,
            threshold,
            seed,
            trainRatio,
        } = options;

        const worker = ensureAnnWorker();
        if (!worker) {
            throw new Error('無法建立 ANNS 訓練執行緒');
        }
        if (state.annJob) {
            throw new Error('ANNS 模型仍在執行中，請稍候');
        }

        applySeed(seed);
        showStatus('ANNS 訓練準備中…', 'info');

        const result = await new Promise((resolve, reject) => {
            state.annJob = { resolve, reject };
            worker.postMessage({
                type: 'ai-ann-run',
                payload: {
                    rows,
                    options: {
                        epochs,
                        batchSize,
                        learningRate,
                        trainRatio,
                        seed,
                    },
                },
            });
        });

        const probabilities = Array.isArray(result?.probabilities) ? result.probabilities : [];
        const testReturns = Array.isArray(result?.testReturns) ? result.testReturns : [];
        const testMeta = Array.isArray(result?.testMeta) ? result.testMeta : [];
        const trainingOdds = Number.isFinite(result?.trainingOdds) ? result.trainingOdds : 1;
        state.odds = trainingOdds;

        const initialCapital = resolveInitialCapital();
        const tradeSummary = computeTradeSummary(probabilities, testReturns, testMeta, {
            threshold,
            useKelly,
            fixedFraction,
            trainingOdds,
            initialCapital,
        });

        let manualAccuracy = NaN;
        if (probabilities.length > 0 && probabilities.length === testReturns.length) {
            let correct = 0;
            for (let i = 0; i < probabilities.length; i += 1) {
                const predicted = probabilities[i] >= threshold ? 1 : 0;
                const actual = testReturns[i] > 0 ? 1 : 0;
                if (predicted === actual) correct += 1;
            }
            manualAccuracy = correct / probabilities.length;
        }

        const trainAccuracy = Number.isFinite(result?.trainAccuracy) ? result.trainAccuracy : NaN;
        const trainLoss = Number.isFinite(result?.trainLoss) ? result.trainLoss : NaN;
        const testAccuracy = Number.isFinite(result?.testAccuracy) ? result.testAccuracy : manualAccuracy;
        const testLoss = Number.isFinite(result?.testLoss) ? result.testLoss : NaN;

        const summary = {
            version: result?.version || VERSION_TAG,
            model: 'anns',
            modelLabel: getModelConfig('anns').label,
            trainAccuracy,
            trainLoss,
            testAccuracy,
            testLoss,
            totalPredictions: Number.isFinite(result?.totalPredictions) ? result.totalPredictions : probabilities.length,
            executedTrades: tradeSummary.executed,
            hitRate: tradeSummary.hitRate,
            totalReturn: tradeSummary.totalReturn,
            averageProfit: tradeSummary.averageProfit,
            finalCapital: tradeSummary.capital,
            usingKelly: useKelly,
            threshold,
            trainRatio,
            seed,
        };

        state.lastSummary = summary;

        updateSummaryMetrics(summary);
        renderTrades(tradeSummary.trades);
        showStatus(`ANNS 完成：訓練勝率 ${formatPercent(summary.trainAccuracy, 2)}，測試正確率 ${formatPercent(summary.testAccuracy, 2)}。`, 'success');
    };

    const runPrediction = async () => {
        if (state.running) return;

        const config = getModelConfig(state.activeModel);
        const lookback = Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
        const epochs = Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 300 }));
        const batchSize = Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
        const learningRate = parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        const useKelly = Boolean(elements.enableKelly?.checked);
        const ratioValue = parseFloat(elements.ratioSelect?.value ?? state.trainRatio);
        const trainRatio = Number.isFinite(ratioValue) ? Math.min(Math.max(ratioValue, 0.6), 0.9) : state.trainRatio;
        state.trainRatio = trainRatio;
        persistTrainRatio(trainRatio);
        updateRatioChip();

        const threshold = parseNumberInput(elements.thresholdInput, state.threshold, { min: 0.05, max: 0.95 });
        state.threshold = threshold;
        if (elements.thresholdInput) elements.thresholdInput.value = threshold.toFixed(2);
        persistThreshold(state.activeModel, threshold);

        const seed = Math.round(parseNumberInput(elements.seedInput, state.seed, { min: -2147483647, max: 2147483647 }));
        state.seed = seed;
        if (elements.seedInput) elements.seedInput.value = seed.toString();

        toggleRunning(true);
        try {
            const rows = getVisibleData();
            if (!Array.isArray(rows) || rows.length < 60) {
                throw new Error('資料筆數不足（需至少 60 根 K 線），請先延長回測區間');
            }

            const commonOptions = {
                rows,
                lookback,
                epochs,
                batchSize,
                learningRate,
                fixedFraction,
                useKelly,
                threshold,
                seed,
                trainRatio,
            };

            if (state.activeModel === 'anns') {
                await runAnnPrediction(commonOptions);
            } else {
                await runLstmPrediction(commonOptions);
            }
        } catch (error) {
            console.error('[AI Prediction] 執行失敗:', error);
            showStatus(`${config.short} 預測執行失敗：${error.message}`, 'error');
        } finally {
            toggleRunning(false);
        }
    };

    const init = () => {
        elements.datasetSummary = document.getElementById('ai-dataset-summary');
        elements.status = document.getElementById('ai-status');
        elements.runButton = document.getElementById('ai-run-button');
        elements.runLabel = document.getElementById('ai-run-label');
        elements.modelSelect = document.getElementById('ai-model-select');
        elements.ratioSelect = document.getElementById('ai-train-ratio');
        elements.ratioChip = document.getElementById('ai-ratio-chip');
        elements.seedInput = document.getElementById('ai-random-seed');
        elements.seedSaveButton = document.getElementById('ai-save-seed');
        elements.thresholdInput = document.getElementById('ai-threshold');
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

        const persistedRatio = loadPersistedTrainRatio();
        if (Number.isFinite(persistedRatio)) {
            state.trainRatio = Math.min(Math.max(persistedRatio, 0.6), 0.9);
        }
        if (elements.ratioSelect) {
            const ratioStr = String(state.trainRatio);
            const hasOption = Array.from(elements.ratioSelect.options || []).some((option) => option.value === ratioStr);
            if (hasOption) {
                elements.ratioSelect.value = ratioStr;
            }
        }
        updateRatioChip();

        const initialSeed = loadPersistedSeed(state.activeModel);
        state.seed = Number.isFinite(initialSeed) ? Math.round(initialSeed) : DEFAULT_SEED;
        if (elements.seedInput) {
            elements.seedInput.value = state.seed.toString();
        }

        const initialThreshold = loadPersistedThreshold(state.activeModel);
        state.threshold = Number.isFinite(initialThreshold) ? initialThreshold : DEFAULT_THRESHOLD;
        if (elements.thresholdInput) {
            elements.thresholdInput.value = state.threshold.toFixed(2);
        }

        updateRunLabel();
        showStatus('尚未開始', 'info');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.modelSelect) {
            elements.modelSelect.value = state.activeModel;
            elements.modelSelect.addEventListener('change', (event) => {
                if (state.running) return;
                const value = event.target.value === 'anns' ? 'anns' : 'lstm';
                state.activeModel = value;
                const seedValue = loadPersistedSeed(value);
                state.seed = Number.isFinite(seedValue) ? Math.round(seedValue) : DEFAULT_SEED;
                if (elements.seedInput) elements.seedInput.value = state.seed.toString();
                const thresholdValue = loadPersistedThreshold(value);
                state.threshold = Number.isFinite(thresholdValue) ? thresholdValue : DEFAULT_THRESHOLD;
                if (elements.thresholdInput) elements.thresholdInput.value = state.threshold.toFixed(2);
                updateRunLabel();
                showStatus(`${getModelConfig(value).label} 已啟用。`, 'info');
            });
        }

        if (elements.ratioSelect) {
            elements.ratioSelect.addEventListener('change', () => {
                if (state.running) return;
                const ratio = parseFloat(elements.ratioSelect.value);
                state.trainRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0.6), 0.9) : state.trainRatio;
                persistTrainRatio(state.trainRatio);
                updateRatioChip();
            });
        }

        if (elements.seedInput) {
            elements.seedInput.addEventListener('change', () => {
                const newSeed = Math.round(parseNumberInput(elements.seedInput, state.seed, { min: -2147483647, max: 2147483647 }));
                state.seed = newSeed;
                elements.seedInput.value = newSeed.toString();
            });
        }

        if (elements.seedSaveButton) {
            elements.seedSaveButton.addEventListener('click', () => {
                if (state.running) return;
                const seedValue = Math.round(parseNumberInput(elements.seedInput, state.seed, { min: -2147483647, max: 2147483647 }));
                state.seed = seedValue;
                elements.seedInput.value = seedValue.toString();
                persistSeed(state.activeModel, seedValue);
                showStatus(`${getModelConfig(state.activeModel).short} 已儲存種子 ${seedValue}`, 'success');
            });
        }

        if (elements.thresholdInput) {
            elements.thresholdInput.addEventListener('change', () => {
                const thresholdValue = parseNumberInput(elements.thresholdInput, state.threshold, { min: 0.05, max: 0.95 });
                state.threshold = thresholdValue;
                elements.thresholdInput.value = thresholdValue.toFixed(2);
                persistThreshold(state.activeModel, thresholdValue);
            });
        }

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
