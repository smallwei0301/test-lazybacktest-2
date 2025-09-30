/* global tf, cachedStockData, cachedDataStore, getBacktestParams */
(function () {
    'use strict';

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    const VERSION_TAG = 'LB-AI-LSTM-20251120A';

    const elements = {
        windowSize: null,
        epochs: null,
        threshold: null,
        capital: null,
        runButton: null,
        status: null,
        progressBar: null,
        progressIndicator: null,
        trainSamples: null,
        testSamples: null,
        trainWinRate: null,
        testAccuracy: null,
        kellyRatio: null,
        averageProfit: null,
        summaryNote: null,
        tradeCount: null,
        finalCapital: null,
        totalReturn: null,
        testWinRate: null,
        tradeTable: null,
        tradeEmpty: null,
    };

    const state = {
        running: false,
        lastResult: null,
    };

    function assignElements() {
        elements.windowSize = document.getElementById('ai-window-size');
        elements.epochs = document.getElementById('ai-training-epochs');
        elements.threshold = document.getElementById('ai-entry-threshold');
        elements.capital = document.getElementById('ai-initial-capital');
        elements.runButton = document.getElementById('ai-run-prediction');
        elements.status = document.getElementById('ai-status');
        elements.progressBar = document.getElementById('ai-progress-bar');
        elements.progressIndicator = document.getElementById('ai-progress-indicator');
        elements.trainSamples = document.getElementById('ai-train-samples');
        elements.testSamples = document.getElementById('ai-test-samples');
        elements.trainWinRate = document.getElementById('ai-train-winrate');
        elements.testAccuracy = document.getElementById('ai-test-accuracy');
        elements.kellyRatio = document.getElementById('ai-kelly-ratio');
        elements.averageProfit = document.getElementById('ai-average-profit');
        elements.summaryNote = document.getElementById('ai-summary-note');
        elements.tradeCount = document.getElementById('ai-trade-count');
        elements.finalCapital = document.getElementById('ai-final-capital');
        elements.totalReturn = document.getElementById('ai-total-return');
        elements.testWinRate = document.getElementById('ai-test-winrate');
        elements.tradeTable = document.getElementById('ai-trade-table');
        elements.tradeEmpty = document.getElementById('ai-trade-empty');
    }

    function setStatus(message, tone) {
        if (!elements.status) {
            return;
        }
        elements.status.textContent = message;
        const palette = {
            info: 'var(--muted-foreground)',
            success: 'var(--primary)',
            error: 'var(--destructive)',
        };
        elements.status.style.color = palette[tone] || palette.info;
    }

    function toggleProgress(visible) {
        if (!elements.progressBar) return;
        elements.progressBar.classList.toggle('hidden', !visible);
        if (visible && elements.progressIndicator) {
            elements.progressIndicator.style.width = '0%';
        }
    }

    function setProgress(ratio) {
        if (!elements.progressIndicator) return;
        const percentage = Math.max(0, Math.min(1, Number(ratio) || 0)) * 100;
        elements.progressIndicator.style.width = `${percentage.toFixed(1)}%`;
    }

    function parseNumber(input, options = {}) {
        const { min = -Infinity, max = Infinity, fallback = null } = options;
        if (!input) return fallback;
        const value = Number.parseFloat(input.value);
        if (!Number.isFinite(value)) return fallback;
        const clamped = Math.min(Math.max(value, min), max);
        if (clamped !== value) {
            input.value = clamped.toString();
        }
        return clamped;
    }

    function getWindowSize() {
        return parseNumber(elements.windowSize, { min: 10, max: 120, fallback: 20 });
    }

    function getEpochs() {
        return Math.round(parseNumber(elements.epochs, { min: 10, max: 400, fallback: 60 }));
    }

    function getThreshold() {
        const value = parseNumber(elements.threshold, { min: 0.5, max: 0.95, fallback: 0.55 });
        return Number.isFinite(value) ? value : 0.55;
    }

    function getInitialCapital() {
        const direct = parseNumber(elements.capital, { min: 1, fallback: null });
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        if (typeof getBacktestParams === 'function') {
            try {
                const params = getBacktestParams();
                if (params && Number.isFinite(params.initialCapital)) {
                    return params.initialCapital;
                }
            } catch (error) {
                console.warn('[AI Prediction] 無法讀取主回測資金設定：', error);
            }
        }
        return 100000;
    }

    function toNumber(value) {
        const num = Number.parseFloat(value);
        return Number.isFinite(num) ? num : null;
    }

    function normalizeDate(dateString) {
        if (!dateString) return '';
        if (typeof dateString === 'string' && dateString.length >= 10) {
            return dateString.slice(0, 10);
        }
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getAvailableSeries() {
        if (Array.isArray(window.cachedStockData) && window.cachedStockData.length > 0) {
            return window.cachedStockData;
        }
        if (window.cachedDataStore instanceof Map) {
            for (const entry of window.cachedDataStore.values()) {
                if (entry && Array.isArray(entry.data) && entry.data.length > 0) {
                    return entry.data;
                }
            }
        }
        return null;
    }

    function normalizeWindow(values) {
        if (!Array.isArray(values) || values.length === 0) return [];
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const std = variance > 0 ? Math.sqrt(variance) : 1;
        return values.map((val) => (val - mean) / std);
    }

    function buildDataset(series, windowSize) {
        if (!Array.isArray(series)) {
            return { features: [], labels: [], meta: [] };
        }
        const sanitized = series
            .map((row) => {
                if (!row) return null;
                const close = toNumber(row.close ?? row.Close);
                const date = normalizeDate(row.date ?? row.Date);
                if (!Number.isFinite(close) || !date) return null;
                return { date, close };
            })
            .filter((item) => item)
            .sort((a, b) => a.date.localeCompare(b.date));
        if (sanitized.length <= windowSize) {
            return { features: [], labels: [], meta: [] };
        }
        const features = [];
        const labels = [];
        const meta = [];
        for (let idx = windowSize; idx < sanitized.length; idx += 1) {
            const windowSlice = sanitized.slice(idx - windowSize, idx);
            if (windowSlice.length !== windowSize) continue;
            const today = windowSlice[windowSlice.length - 1];
            const tomorrow = sanitized[idx];
            if (!today || !tomorrow) continue;
            if (!Number.isFinite(today.close) || !Number.isFinite(tomorrow.close)) continue;
            const normalized = normalizeWindow(windowSlice.map((item) => item.close));
            if (normalized.length !== windowSize) continue;
            const diff = tomorrow.close - today.close;
            const label = diff >= 2 ? 1 : 0;
            features.push(normalized);
            labels.push(label);
            meta.push({
                entryDate: today.date,
                exitDate: tomorrow.date,
                entryClose: today.close,
                exitClose: tomorrow.close,
                diff,
                label,
            });
        }
        return { features, labels, meta };
    }

    function splitDataset(dataset) {
        const { features, labels, meta } = dataset;
        if (!Array.isArray(features) || features.length === 0) {
            return {
                train: { features: [], labels: [], meta: [] },
                test: { features: [], labels: [], meta: [] },
            };
        }
        let splitIndex = Math.floor((features.length * 2) / 3);
        splitIndex = Math.max(1, Math.min(splitIndex, features.length - 1));
        return {
            train: {
                features: features.slice(0, splitIndex),
                labels: labels.slice(0, splitIndex),
                meta: meta.slice(0, splitIndex),
            },
            test: {
                features: features.slice(splitIndex),
                labels: labels.slice(splitIndex),
                meta: meta.slice(splitIndex),
            },
        };
    }

    function tensorise(features, labels) {
        const reshaped = features.map((window) => window.map((value) => [value]));
        const featureTensor = tf.tensor3d(reshaped);
        const labelTensor = tf.tensor2d(labels, [labels.length, 1]);
        return { featureTensor, labelTensor };
    }

    function createModel(windowSize) {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 32, inputShape: [windowSize, 1], returnSequences: false }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy' });
        return model;
    }

    function mean(values) {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const total = values.reduce((sum, val) => sum + val, 0);
        return total / values.length;
    }

    function computeTradeStats(predictions, labels, threshold) {
        let selected = 0;
        let wins = 0;
        let probabilitySum = 0;
        predictions.forEach((prob, index) => {
            if (!Number.isFinite(prob)) return;
            if (prob >= threshold) {
                selected += 1;
                probabilitySum += prob;
                if (labels[index] === 1) {
                    wins += 1;
                }
            }
        });
        return {
            selected,
            wins,
            winRate: selected > 0 ? wins / selected : 0,
            averageProbability: selected > 0 ? probabilitySum / selected : 0,
        };
    }

    function computeAccuracy(predictions, labels, threshold) {
        if (!Array.isArray(labels) || labels.length === 0) return 0;
        let correct = 0;
        predictions.forEach((prob, index) => {
            const predicted = Number.isFinite(prob) && prob >= threshold ? 1 : 0;
            if (predicted === labels[index]) {
                correct += 1;
            }
        });
        return correct / labels.length;
    }

    function computeKellyOdds(meta) {
        const successGains = [];
        const failureLosses = [];
        const failureShortfalls = [];
        meta.forEach((item) => {
            if (!item) return;
            const gain = item.exitClose - item.entryClose;
            if (item.label === 1) {
                if (Number.isFinite(gain)) successGains.push(gain);
            } else {
                if (Number.isFinite(gain) && gain < 0) {
                    failureLosses.push(-gain);
                }
                const shortfall = 2 - gain;
                if (Number.isFinite(shortfall) && shortfall > 0) {
                    failureShortfalls.push(shortfall);
                }
            }
        });
        const avgGain = mean(successGains);
        const avgLossCandidate = Math.max(mean(failureLosses), mean(failureShortfalls));
        const sanitizedGain = Number.isFinite(avgGain) && avgGain > 0 ? avgGain : 2;
        const sanitizedLoss = Number.isFinite(avgLossCandidate) && avgLossCandidate > 0 ? avgLossCandidate : 2;
        const odds = sanitizedGain / sanitizedLoss;
        return {
            avgGain: sanitizedGain,
            avgLoss: sanitizedLoss,
            odds,
        };
    }

    function computeKellyFraction(probability, odds) {
        if (!Number.isFinite(probability) || !Number.isFinite(odds) || odds <= 0) return 0;
        const p = Math.min(Math.max(probability, 1e-6), 1 - 1e-6);
        const q = 1 - p;
        const fraction = (odds * p - q) / odds;
        if (!Number.isFinite(fraction)) return 0;
        return Math.min(Math.max(fraction, 0), 1);
    }

    function simulateTrades(predictions, meta, threshold, initialCapital, odds) {
        let capital = initialCapital;
        const trades = [];
        const fractions = [];
        predictions.forEach((prob, index) => {
            if (!Number.isFinite(prob) || prob < threshold) return;
            const info = meta[index];
            if (!info) return;
            const entryPrice = info.entryClose;
            const exitPrice = info.exitClose;
            if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || entryPrice <= 0) return;
            const kellyFraction = computeKellyFraction(prob, odds);
            if (kellyFraction <= 0) return;
            const amount = capital * kellyFraction;
            if (!Number.isFinite(amount) || amount <= 0) return;
            const shares = amount / entryPrice;
            if (!Number.isFinite(shares) || shares <= 0) return;
            const profit = shares * (exitPrice - entryPrice);
            capital += profit;
            trades.push({
                entryDate: info.entryDate,
                exitDate: info.exitDate,
                entryPrice,
                exitPrice,
                amount,
                shares,
                probability: prob,
                kellyFraction,
                profit,
                actualDiff: info.diff,
            });
            fractions.push(kellyFraction);
        });
        return { trades, finalCapital: capital, averageKelly: mean(fractions) };
    }

    function formatNumber(value, fractionDigits = 2) {
        if (!Number.isFinite(value)) return '--';
        return value.toLocaleString('zh-TW', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        });
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '--';
        return `${(value * 100).toFixed(2)}%`;
    }

    function renderTrades(trades) {
        if (!elements.tradeTable || !elements.tradeEmpty) return;
        elements.tradeTable.innerHTML = '';
        if (!Array.isArray(trades) || trades.length === 0) {
            elements.tradeEmpty.classList.remove('hidden');
            elements.tradeEmpty.textContent = '尚未有模擬交易資料。';
            return;
        }
        elements.tradeEmpty.classList.add('hidden');
        trades.forEach((trade) => {
            const row = document.createElement('tr');
            const cells = [
                trade.entryDate,
                trade.exitDate,
                formatNumber(trade.entryPrice),
                formatNumber(trade.exitPrice),
                formatNumber(trade.amount),
                formatNumber(trade.shares, 4),
                formatPercent(trade.probability),
                formatPercent(trade.kellyFraction),
                formatNumber(trade.profit),
            ];
            cells.forEach((value, idx) => {
                const cell = document.createElement('td');
                cell.className = idx >= 2 ? 'px-3 py-2 text-right whitespace-nowrap' : 'px-3 py-2 text-left whitespace-nowrap';
                cell.textContent = value;
                row.appendChild(cell);
            });
            elements.tradeTable.appendChild(row);
        });
    }

    function updateMetrics(result) {
        if (!result) return;
        if (elements.trainSamples) elements.trainSamples.textContent = result.trainSamples.toString();
        if (elements.testSamples) elements.testSamples.textContent = result.testSamples.toString();
        if (elements.trainWinRate) elements.trainWinRate.textContent = formatPercent(result.trainWinRate);
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(result.testAccuracy);
        if (elements.kellyRatio) elements.kellyRatio.textContent = formatPercent(result.averageKellyFraction);
        if (elements.averageProfit) elements.averageProfit.textContent = formatNumber(result.averageProfit);
        if (elements.tradeCount) elements.tradeCount.textContent = result.tradeCount.toString();
        if (elements.finalCapital) elements.finalCapital.textContent = formatNumber(result.finalCapital);
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(result.totalReturn);
        if (elements.testWinRate) elements.testWinRate.textContent = formatPercent(result.testTradeWinRate);
        if (elements.summaryNote) {
            elements.summaryNote.textContent = result.summaryNote;
        }
        renderTrades(result.trades);
    }

    async function runPrediction() {
        if (state.running) return;
        if (typeof tf === 'undefined' || !tf || typeof tf.sequential !== 'function') {
            setStatus('尚未載入 TensorFlow.js，請檢查網路連線。', 'error');
            return;
        }
        const windowSize = getWindowSize();
        const epochs = getEpochs();
        const threshold = getThreshold();
        const initialCapital = getInitialCapital();
        const series = getAvailableSeries();
        if (!Array.isArray(series) || series.length < windowSize + 5) {
            setStatus('請先在左側執行主回測，並確保快取中有足夠的價格資料。', 'error');
            return;
        }

        state.running = true;
        setStatus('準備資料中...', 'info');
        toggleProgress(true);
        setProgress(0);
        if (elements.runButton) {
            elements.runButton.disabled = true;
            elements.runButton.classList.add('opacity-70', 'cursor-not-allowed');
        }

        await tf.ready();

        const dataset = buildDataset(series, windowSize);
        if (dataset.features.length < 30) {
            setStatus('資料樣本不足，無法訓練可靠的 LSTM 模型。', 'error');
            toggleProgress(false);
            if (elements.runButton) {
                elements.runButton.disabled = false;
                elements.runButton.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            state.running = false;
            return;
        }

        const split = splitDataset(dataset);
        const trainSamples = split.train.features.length;
        const testSamples = split.test.features.length;
        if (trainSamples < 10 || testSamples < 5) {
            setStatus('資料切割後樣本仍不足，請拉長回測區間或縮短視窗。', 'error');
            toggleProgress(false);
            if (elements.runButton) {
                elements.runButton.disabled = false;
                elements.runButton.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            state.running = false;
            return;
        }

        let model = null;
        let trainX;
        let trainY;
        let testX;
        let testY;
        let trainPredTensor;
        let testPredTensor;

        try {
            const trainTensors = tensorise(split.train.features, split.train.labels);
            const testTensors = tensorise(split.test.features, split.test.labels);
            trainX = trainTensors.featureTensor;
            trainY = trainTensors.labelTensor;
            testX = testTensors.featureTensor;
            testY = testTensors.labelTensor;

            model = createModel(windowSize);

            const batchSize = Math.max(8, Math.floor(trainSamples / 4));
            const validationSplit = trainSamples > 60 ? 0.1 : 0;

            await model.fit(trainX, trainY, {
                epochs,
                batchSize,
                shuffle: false,
                validationSplit,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        const loss = Number.isFinite(logs?.loss) ? logs.loss.toFixed(4) : '—';
                        const valLoss = Number.isFinite(logs?.val_loss) ? `｜val ${logs.val_loss.toFixed(4)}` : '';
                        setStatus(`Epoch ${epoch + 1}/${epochs} 完成，loss ${loss}${valLoss}`, 'info');
                        setProgress((epoch + 1) / epochs);
                        await tf.nextFrame();
                    },
                },
            });

            trainPredTensor = model.predict(trainX);
            testPredTensor = model.predict(testX);
            const trainPredArray = Array.from(await trainPredTensor.data());
            const testPredArray = Array.from(await testPredTensor.data());

            const trainStats = computeTradeStats(trainPredArray, split.train.labels, threshold);
            const trainAccuracy = computeAccuracy(trainPredArray, split.train.labels, threshold);
            const testAccuracy = computeAccuracy(testPredArray, split.test.labels, threshold);
            const kelly = computeKellyOdds(split.train.meta);
            const simulation = simulateTrades(testPredArray, split.test.meta, threshold, initialCapital, kelly.odds);
            const trades = simulation.trades;
            const testTradeWins = trades.filter((trade) => trade.actualDiff >= 2).length;
            const averageProfit = trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.profit, 0) / trades.length : 0;
            const totalReturn = trades.length > 0 ? (simulation.finalCapital - initialCapital) / initialCapital : 0;

            const summaryNote = trades.length > 0
                ? `模型以 ${windowSize} 日視窗訓練 ${trainSamples} 筆樣本，訓練進場勝率 ${formatPercent(trainStats.winRate)}，平均預測機率 ${formatPercent(trainStats.averageProbability)}。依據凱利公式推估平均投入 ${formatPercent(simulation.averageKelly)} 的資金，測試期執行 ${trades.length} 筆交易，總報酬率 ${formatPercent(totalReturn)}。`
                : `模型以 ${windowSize} 日視窗訓練 ${trainSamples} 筆樣本，訓練進場勝率 ${formatPercent(trainStats.winRate)}。測試階段未找到達到閾值的交易訊號，請調整參數後再試。`;

            const result = {
                version: VERSION_TAG,
                windowSize,
                epochs,
                threshold,
                initialCapital,
                trainSamples,
                testSamples,
                trainWinRate: trainStats.winRate,
                trainAccuracy,
                testAccuracy,
                averageKellyFraction: Number.isFinite(simulation.averageKelly) && simulation.averageKelly > 0 ? simulation.averageKelly : computeKellyFraction(trainStats.winRate, kelly.odds),
                averageProfit,
                trades,
                tradeCount: trades.length,
                finalCapital: simulation.finalCapital,
                totalReturn,
                testTradeWinRate: trades.length > 0 ? testTradeWins / trades.length : 0,
                summaryNote,
            };

            state.lastResult = result;
            updateMetrics(result);
            setStatus('AI 預測完成，可以在下方檢視交易模擬結果。', 'success');
        } catch (error) {
            console.error('[AI Prediction] 執行失敗：', error);
            setStatus(error?.message || '模型訓練或回測時發生錯誤。', 'error');
        } finally {
            if (trainPredTensor) trainPredTensor.dispose();
            if (testPredTensor) testPredTensor.dispose();
            if (trainX) trainX.dispose();
            if (trainY) trainY.dispose();
            if (testX) testX.dispose();
            if (testY) testY.dispose();
            if (model) model.dispose();
            toggleProgress(false);
            if (elements.runButton) {
                elements.runButton.disabled = false;
                elements.runButton.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            state.running = false;
        }
    }

    function init() {
        assignElements();
        if (!elements.runButton) {
            console.warn('[AI Prediction] 無法找到操作按鈕，初始化中止。');
            return;
        }
        if (elements.capital && !elements.capital.placeholder && typeof getBacktestParams === 'function') {
            try {
                const params = getBacktestParams();
                if (params && Number.isFinite(params.initialCapital)) {
                    elements.capital.placeholder = params.initialCapital.toString();
                }
            } catch (error) {
                console.warn('[AI Prediction] 無法讀取主回測資金設定：', error);
            }
        }
        setStatus('等待資料...', 'info');
        elements.runButton.addEventListener('click', runPrediction);
        window.lazybacktestAIPrediction = {
            version: VERSION_TAG,
            getState: () => ({ ...state }),
            runPrediction,
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
