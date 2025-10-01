/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250915A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-LSTM-20250915A';
    const state = {
        running: false,
        lastSummary: null,
        odds: 1,
    };

    const TFJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
    let tfLoadingPromise = null;

    const ensureTfjsLoaded = async () => {
        if (typeof tf !== 'undefined' && typeof tf.tensor === 'function') {
            return;
        }
        if (!tfLoadingPromise) {
            tfLoadingPromise = new Promise((resolve, reject) => {
                try {
                    const script = document.createElement('script');
                    script.src = TFJS_SCRIPT_URL;
                    script.async = true;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('TensorFlow.js 載入失敗，請稍後再試。'));
                    document.head.appendChild(script);
                } catch (err) {
                    reject(err);
                }
            }).finally(() => {
                tfLoadingPromise = null;
            });
        }
        await tfLoadingPromise;
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
            elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，執行 ${summary.executedTrades} 筆多單交易，${strategyLabel}。最終資金 ${formatCurrency(summary.finalCapital)}，總報酬 ${formatPercent(summary.totalReturn, 2)}。`;
        }
    };

    const runPrediction = async () => {
        if (state.running) return;
        try {
            await ensureTfjsLoaded();
        } catch (loadError) {
            showStatus(loadError?.message || 'TensorFlow.js 載入失敗。', 'error');
            return;
        }
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

            const initialCapital = resolveInitialCapital();
            let capital = initialCapital;
            let cumulativeProfit = 0;
            let wins = 0;
            let executed = 0;
            const executedTrades = [];
            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);

            for (let i = 0; i < predictionValues.length; i += 1) {
                const probability = predictionValues[i];
                const predictedUp = probability >= 0.5;
                const actualReturn = testReturns[i];
                const meta = testMeta[i];
                if (!predictedUp || !meta) {
                    continue;
                }
                const fraction = useKelly
                    ? computeKellyFraction(probability, trainingOdds)
                    : Math.max(0.01, Math.min(fixedFraction, 1));
                const allocation = capital * fraction;
                const profit = allocation * actualReturn;
                capital += profit;
                cumulativeProfit += profit;
                executed += 1;
                if (actualReturn > 0) {
                    wins += 1;
                }
                executedTrades.push({
                    buyDate: meta.buyDate,
                    sellDate: meta.sellDate,
                    probability,
                    actualReturn,
                    fraction,
                    profit,
                    capitalAfter: capital,
                });
            }

            const totalPredictions = predictionValues.length;
            const hitRate = executed > 0 ? wins / executed : 0;
            const totalReturn = (capital - initialCapital) / initialCapital;
            const averageProfit = executed > 0 ? cumulativeProfit / executed : 0;

            const summary = {
                version: VERSION_TAG,
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: Number.isFinite(testAccuracy) ? testAccuracy : manualAccuracy,
                testLoss,
                totalPredictions,
                executedTrades: executed,
                hitRate,
                totalReturn,
                averageProfit,
                finalCapital: capital,
                usingKelly: useKelly,
            };
            state.lastSummary = summary;

            updateSummaryMetrics(summary);
            renderTrades(executedTrades);
            showStatus(`完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${formatPercent(summary.testAccuracy, 2)}。`, 'success');

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

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
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
