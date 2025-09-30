// Patch Tag: LB-AI-FORECAST-20250915A
(function () {
    'use strict';

    const AI_FORECAST_VERSION = 'LB-AI-FORECAST-20250915A';
    const DEFAULT_LOOKBACK = 20;
    const MIN_SEQUENCE_COUNT = 40;
    const INITIAL_CAPITAL = 1_000_000;

    const aiForecastState = {
        initialized: false,
        dataset: null,
        datasetSignature: null,
        busy: false,
        stockName: null,
        priceModeLabel: null,
        lastResult: null,
        model: null,
        normalization: null,
        tfReady: false,
        tfPromise: null,
        lookback: DEFAULT_LOOKBACK,
    };

    function getElement(id) {
        return document.getElementById(id);
    }

    function setText(id, text) {
        const el = getElement(id);
        if (!el) return;
        el.textContent = text;
    }

    function formatPercent(value, fractionDigits = 2) {
        if (!Number.isFinite(value)) return '—';
        const percentage = value * 100;
        return `${percentage.toFixed(fractionDigits)}%`;
    }

    function formatNumber(value, fractionDigits = 0) {
        if (!Number.isFinite(value)) return '—';
        try {
            return new Intl.NumberFormat('zh-TW', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
        } catch (error) {
            return value.toFixed(fractionDigits);
        }
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '—';
        try {
            return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
        } catch (error) {
            return `${value.toFixed(0)}`;
        }
    }

    function parseNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function ensureInitialized() {
        if (aiForecastState.initialized) {
            return;
        }
        aiForecastState.initialized = true;
        const versionEl = getElement('ai-forecast-version');
        if (versionEl) {
            versionEl.textContent = AI_FORECAST_VERSION;
        }
        const runBtn = getElement('ai-forecast-run');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                runAiForecastTraining().catch((error) => {
                    console.error('[AI Forecast] Training failed:', error);
                });
            });
        }
        resetAiForecastMetrics();
        updateRunButtonState({ disabled: true, label: '啟動 AI 訓練' });
        setAiForecastStatus('尚未同步回測資料。', 'muted');
    }

    function resetAiForecastMetrics() {
        setText('ai-forecast-train-accuracy', '—');
        setText('ai-forecast-test-accuracy', '—');
        setText('ai-forecast-next-decision', '—');
        setText('ai-forecast-next-prob', '—');
        setText('ai-forecast-total-return', '—');
        setText('ai-forecast-average-return', '—');
        setText('ai-forecast-trade-count', '—');
        setText('ai-forecast-kelly-fraction', '—');
    }

    function setAiForecastStatus(message, tone = 'muted') {
        const statusEl = getElement('ai-forecast-status');
        if (!statusEl) return;
        statusEl.textContent = message;
        const toneColorMap = {
            success: 'var(--primary)',
            error: '#dc2626',
            info: 'var(--foreground)',
            muted: 'var(--muted-foreground)',
        };
        statusEl.style.color = toneColorMap[tone] || toneColorMap.muted;
    }

    function updateRunButtonState({ disabled, label }) {
        const runBtn = getElement('ai-forecast-run');
        if (!runBtn) return;
        runBtn.disabled = Boolean(disabled);
        if (label) {
            runBtn.textContent = label;
        }
    }

    function describePriceMode(priceMode) {
        if (!priceMode) return '';
        const normalized = priceMode.toString().toLowerCase();
        if (normalized.includes('adj')) return '調整後價格';
        if (normalized.includes('raw')) return '原始價格';
        return priceMode;
    }

    function summariseDataset(dataset) {
        const container = getElement('ai-forecast-dataset-summary');
        if (!container) return;
        if (!dataset || dataset.totalSamples === 0) {
            container.innerHTML = `
                <div class="p-4 rounded-lg border" style="border-color: var(--border); background-color: var(--background);">
                    <p class="text-xs uppercase tracking-wide" style="color: var(--muted-foreground);">資料概況</p>
                    <p class="text-sm mt-2" style="color: var(--foreground);">等待回測資料同步...</p>
                </div>
                <div class="p-4 rounded-lg border" style="border-color: var(--border); background-color: var(--background);">
                    <p class="text-xs uppercase tracking-wide" style="color: var(--muted-foreground);">訓練狀態</p>
                    <p class="text-sm mt-2" style="color: var(--muted-foreground);">尚未啟動訓練。</p>
                </div>`;
            return;
        }
        const priceModeLabel = aiForecastState.priceModeLabel ? `｜${aiForecastState.priceModeLabel}` : '';
        const trainSize = dataset.trainSize;
        const testSize = dataset.testSize;
        const availability = dataset.totalSamples >= MIN_SEQUENCE_COUNT
            ? '可啟動訓練'
            : `至少需要 ${MIN_SEQUENCE_COUNT} 筆樣本`;
        container.innerHTML = `
            <div class="p-4 rounded-lg border" style="border-color: var(--border); background-color: var(--background);">
                <p class="text-xs uppercase tracking-wide" style="color: var(--muted-foreground);">資料概況</p>
                <ul class="mt-2 space-y-1 text-sm" style="color: var(--foreground);">
                    <li>標的：${aiForecastState.stockName || '—'}${priceModeLabel}</li>
                    <li>樣本期間：${dataset.startDate || '—'} ~ ${dataset.lastDate || '—'}</li>
                    <li>可用樣本：${formatNumber(dataset.totalSamples)} 筆（lookback = ${dataset.lookback}）</li>
                    <li>拆分：訓練 ${formatNumber(trainSize)}｜測試 ${formatNumber(testSize)}</li>
                </ul>
            </div>
            <div class="p-4 rounded-lg border" style="border-color: var(--border); background-color: var(--background);">
                <p class="text-xs uppercase tracking-wide" style="color: var(--muted-foreground);">訓練狀態</p>
                <p class="text-sm mt-2" style="color: var(--muted-foreground);">${availability}</p>
            </div>`;
    }

    function resetAiForecastTab() {
        ensureInitialized();
        aiForecastState.dataset = null;
        aiForecastState.datasetSignature = null;
        aiForecastState.stockName = null;
        aiForecastState.priceModeLabel = null;
        aiForecastState.lastResult = null;
        resetAiForecastMetrics();
        summariseDataset(null);
        setAiForecastStatus('尚未同步回測資料。', 'muted');
        updateRunButtonState({ disabled: true, label: '啟動 AI 訓練' });
    }

    function toDatasetSignature(dataset) {
        if (!dataset) return null;
        const parts = [dataset.startDate, dataset.lastDate, dataset.totalSamples, dataset.lookback];
        return parts.filter(Boolean).join('|');
    }

    function buildDatasetFromVisibleData(rawData, lookback) {
        if (!Array.isArray(rawData) || rawData.length <= lookback) {
            return {
                sequences: [],
                labels: [],
                meta: [],
                totalSamples: 0,
                lookback,
                startDate: rawData && rawData[0] ? (rawData[0].date || rawData[0].Date || null) : null,
                lastDate: rawData && rawData.length > 0 ? (rawData[rawData.length - 1].date || rawData[rawData.length - 1].Date || null) : null,
                lastClose: rawData && rawData.length > 0 ? parseNumber(rawData[rawData.length - 1].close ?? rawData[rawData.length - 1].Close) : null,
                inferenceSequence: null,
            };
        }

        const closes = rawData.map((row) => parseNumber(row.close ?? row.Close));
        const dates = rawData.map((row) => row.date || row.Date || null);
        const returns = new Array(rawData.length).fill(null);
        for (let i = 1; i < rawData.length; i += 1) {
            const prev = closes[i - 1];
            const current = closes[i];
            if (!Number.isFinite(prev) || !Number.isFinite(current) || prev === 0) {
                returns[i] = null;
            } else {
                returns[i] = (current - prev) / prev;
            }
        }

        const sequences = [];
        const labels = [];
        const meta = [];
        let startDate = null;
        let lastDate = null;

        for (let index = lookback; index < rawData.length - 1; index += 1) {
            const sequence = [];
            let valid = true;
            for (let j = index - lookback + 1; j <= index; j += 1) {
                const value = returns[j];
                if (!Number.isFinite(value)) {
                    valid = false;
                    break;
                }
                sequence.push(value);
            }
            if (!valid || sequence.length !== lookback) {
                continue;
            }
            const currentClose = closes[index];
            const nextClose = closes[index + 1];
            if (!Number.isFinite(currentClose) || !Number.isFinite(nextClose)) {
                continue;
            }
            const priceDiff = nextClose - currentClose;
            const returnRatio = currentClose !== 0 ? priceDiff / currentClose : 0;
            const label = priceDiff >= 2 ? 1 : 0;

            sequences.push(sequence);
            labels.push(label);
            meta.push({
                date: dates[index] || null,
                nextDate: dates[index + 1] || null,
                currentClose,
                nextClose,
                diff: priceDiff,
                returnRatio,
                label,
            });
            if (!startDate) {
                startDate = dates[index - lookback + 1] || dates[index] || null;
            }
            lastDate = dates[index] || null;
        }

        let inferenceSequence = null;
        if (rawData.length > lookback) {
            const inferenceCandidate = [];
            for (let i = rawData.length - lookback; i < rawData.length; i += 1) {
                const value = returns[i];
                if (!Number.isFinite(value)) {
                    inferenceCandidate.length = 0;
                    break;
                }
                inferenceCandidate.push(value);
            }
            if (inferenceCandidate.length === lookback) {
                inferenceSequence = inferenceCandidate;
            }
        }

        return {
            sequences,
            labels,
            meta,
            lookback,
            totalSamples: sequences.length,
            startDate,
            lastDate,
            lastClose: closes[closes.length - 1] ?? null,
            lastDateForPrediction: dates[dates.length - 1] || null,
            inferenceSequence,
        };
    }

    function updateAiForecastTab(payload = {}) {
        ensureInitialized();
        const { result = null, stockName = null } = payload;
        const visibleData = Array.isArray(window.visibleStockData) ? window.visibleStockData : [];
        const lookback = aiForecastState.lookback;
        const dataset = buildDatasetFromVisibleData(visibleData, lookback);
        const totalSamples = dataset ? dataset.totalSamples : 0;
        const baseTrainSize = Math.floor(totalSamples * (2 / 3));
        const resolvedTrainSize = totalSamples > 0 ? Math.max(baseTrainSize, 1) : 0;
        const resolvedTestSize = Math.max(totalSamples - resolvedTrainSize, 0);
        dataset.trainSize = resolvedTrainSize;
        dataset.testSize = resolvedTestSize;

        aiForecastState.dataset = dataset;
        aiForecastState.datasetSignature = toDatasetSignature(dataset);
        aiForecastState.stockName = stockName || (result && result.stockName) || null;
        aiForecastState.priceModeLabel = describePriceMode(result && result.priceMode);
        aiForecastState.lastResult = null;
        summariseDataset(dataset);
        resetAiForecastMetrics();

        if (!dataset || dataset.totalSamples < MIN_SEQUENCE_COUNT) {
            setAiForecastStatus(`資料不足，至少需要 ${MIN_SEQUENCE_COUNT} 筆樣本才能訓練。`, 'muted');
            updateRunButtonState({ disabled: true, label: '啟動 AI 訓練' });
            return;
        }

        setAiForecastStatus('資料同步完成，可啟動訓練。', 'info');
        updateRunButtonState({ disabled: false, label: '啟動 AI 訓練' });
    }

    function computeNormalization(trainSequences) {
        if (!Array.isArray(trainSequences) || trainSequences.length === 0) {
            return { mean: 0, std: 1 };
        }
        let sum = 0;
        let count = 0;
        trainSequences.forEach((sequence) => {
            sequence.forEach((value) => {
                sum += value;
                count += 1;
            });
        });
        const mean = count > 0 ? sum / count : 0;
        let variance = 0;
        trainSequences.forEach((sequence) => {
            sequence.forEach((value) => {
                variance += (value - mean) ** 2;
            });
        });
        const std = count > 0 ? Math.sqrt(variance / count) : 1;
        return { mean, std: std === 0 ? 1 : std };
    }

    function normaliseSequence(sequence, normalization) {
        return sequence.map((value) => {
            const normalised = (value - normalization.mean) / normalization.std;
            return [normalised];
        });
    }

    function ensureTensorFlowReady() {
        if (aiForecastState.tfReady && typeof window.tf !== 'undefined') {
            return Promise.resolve(window.tf);
        }
        if (typeof window.tf !== 'undefined') {
            aiForecastState.tfReady = true;
            return Promise.resolve(window.tf);
        }
        if (!aiForecastState.tfPromise) {
            aiForecastState.tfPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-ai-forecast-tf="true"]');
                if (existing) {
                    if (typeof window.tf !== 'undefined') {
                        aiForecastState.tfReady = true;
                        resolve(window.tf);
                        return;
                    }
                    existing.addEventListener('load', () => {
                        if (typeof window.tf !== 'undefined') {
                            aiForecastState.tfReady = true;
                            resolve(window.tf);
                        } else {
                            reject(new Error('TensorFlow.js 尚未就緒'));
                        }
                    });
                    existing.addEventListener('error', () => {
                        reject(new Error('TensorFlow.js 載入失敗'));
                    });
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.12.0/dist/tf.min.js';
                script.async = true;
                script.dataset.aiForecastTf = 'true';
                script.onload = () => {
                    if (typeof window.tf !== 'undefined') {
                        aiForecastState.tfReady = true;
                        resolve(window.tf);
                    } else {
                        reject(new Error('TensorFlow.js 尚未就緒'));
                    }
                };
                script.onerror = () => reject(new Error('TensorFlow.js 載入失敗'));
                document.head.appendChild(script);
            });
        }
        return aiForecastState.tfPromise;
    }

    function computeKellyFraction(probability, avgWin, avgLoss) {
        if (!Number.isFinite(probability)) return 0;
        const p = Math.min(Math.max(probability, 0), 1);
        const q = 1 - p;
        if (!Number.isFinite(avgWin) || !Number.isFinite(avgLoss)) {
            return 0;
        }
        if (avgWin <= 0) {
            return 0;
        }
        const lossMagnitude = Math.abs(avgLoss);
        if (lossMagnitude === 0) {
            return 0;
        }
        const numerator = (p * avgWin) - (q * lossMagnitude);
        const denominator = avgWin * lossMagnitude;
        if (denominator === 0) {
            return 0;
        }
        const fraction = numerator / denominator;
        if (!Number.isFinite(fraction)) {
            return 0;
        }
        return Math.max(0, Math.min(fraction, 1));
    }

    function geometricMean(returns) {
        if (!Array.isArray(returns) || returns.length === 0) {
            return null;
        }
        let product = 1;
        let count = 0;
        for (let i = 0; i < returns.length; i += 1) {
            const value = returns[i];
            if (!Number.isFinite(value)) continue;
            const growth = 1 + value;
            if (growth <= 0) {
                return null;
            }
            product *= growth;
            count += 1;
        }
        if (count === 0) return null;
        return product ** (1 / count) - 1;
    }

    async function runAiForecastTraining() {
        ensureInitialized();
        if (aiForecastState.busy) {
            return;
        }
        const dataset = aiForecastState.dataset;
        if (!dataset || dataset.totalSamples < MIN_SEQUENCE_COUNT) {
            setAiForecastStatus(`資料不足，至少需要 ${MIN_SEQUENCE_COUNT} 筆樣本才能訓練。`, 'muted');
            return;
        }
        aiForecastState.busy = true;
        aiForecastState.lastResult = null;
        updateRunButtonState({ disabled: true, label: '訓練中...' });
        setAiForecastStatus('正在訓練 LSTM 模型，請稍候...', 'info');

        try {
            const tf = await ensureTensorFlowReady();
            const trainSize = dataset.trainSize ?? Math.floor(dataset.totalSamples * (2 / 3));
            const testSize = dataset.totalSamples - trainSize;

            const trainSequences = dataset.sequences.slice(0, trainSize);
            const trainLabels = dataset.labels.slice(0, trainSize);
            const trainMeta = dataset.meta.slice(0, trainSize);
            const testSequences = dataset.sequences.slice(trainSize);
            const testLabels = dataset.labels.slice(trainSize);
            const testMeta = dataset.meta.slice(trainSize);

            const normalization = computeNormalization(trainSequences);
            const trainTensor = tf.tensor3d(trainSequences.map((seq) => normaliseSequence(seq, normalization)));
            const trainLabelTensor = tf.tensor2d(trainLabels.map((label) => [label]));
            const testTensor = testSize > 0 ? tf.tensor3d(testSequences.map((seq) => normaliseSequence(seq, normalization))) : null;
            const testLabelTensor = testSize > 0 ? tf.tensor2d(testLabels.map((label) => [label])) : null;

            if (aiForecastState.model) {
                try {
                    aiForecastState.model.dispose();
                } catch (disposeError) {
                    console.warn('[AI Forecast] Failed to dispose previous model:', disposeError);
                }
                aiForecastState.model = null;
            }

            const model = tf.sequential();
            model.add(tf.layers.inputLayer({ inputShape: [dataset.lookback, 1] }));
            model.add(tf.layers.lstm({ units: 32, activation: 'tanh', recurrentActivation: 'sigmoid', kernelRegularizer: tf.regularizers.l2({ l2: 0.0005 }) }));
            model.add(tf.layers.dropout({ rate: 0.2 }));
            model.add(tf.layers.dense({ units: 16, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.0005 }) }));
            model.add(tf.layers.dropout({ rate: 0.1 }));
            model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
            model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });

            const epochs = Math.min(60, Math.max(25, Math.round(trainSize / 2)));
            const batchSize = Math.min(64, Math.max(8, Math.round(trainSize / 6)));
            let lastReportedEpoch = -1;

            await model.fit(trainTensor, trainLabelTensor, {
                epochs,
                batchSize,
                shuffle: true,
                validationSplit: trainSize > 60 ? 0.2 : 0,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (epoch - lastReportedEpoch >= 5 || epoch === epochs - 1) {
                            const loss = logs.loss != null ? logs.loss.toFixed(4) : '—';
                            setAiForecastStatus(`訓練進度：第 ${epoch + 1}/${epochs} 回合，loss=${loss}`, 'info');
                            lastReportedEpoch = epoch;
                            await tf.nextFrame();
                        }
                    },
                },
            });

            const [trainLossTensor, trainAccTensor] = model.evaluate(trainTensor, trainLabelTensor);
            const trainAccuracy = trainAccTensor ? (await trainAccTensor.data())[0] : null;
            if (trainLossTensor) trainLossTensor.dispose();
            if (trainAccTensor) trainAccTensor.dispose();

            let testAccuracy = null;
            let predictions = [];
            if (testTensor && testLabelTensor) {
                const evalResult = model.evaluate(testTensor, testLabelTensor);
                if (Array.isArray(evalResult) && evalResult.length > 1) {
                    const accTensor = evalResult[1];
                    testAccuracy = (await accTensor.data())[0];
                    evalResult[0]?.dispose?.();
                    accTensor?.dispose?.();
                }
                const predictionTensor = model.predict(testTensor);
                predictions = Array.isArray(predictionTensor)
                    ? await Promise.all(predictionTensor.map(async (tensor) => (await tensor.data())[0]))
                    : Array.from(await predictionTensor.data());
                predictionTensor.dispose();
            }

            const winReturns = [];
            const lossReturns = [];
            trainMeta.forEach((item, index) => {
                const ret = item.returnRatio;
                if (!Number.isFinite(ret)) return;
                if (trainLabels[index] === 1) {
                    winReturns.push(ret);
                } else if (ret < 0) {
                    lossReturns.push(ret);
                }
            });
            const avgWin = winReturns.length > 0 ? (winReturns.reduce((sum, val) => sum + val, 0) / winReturns.length) : null;
            const avgLoss = lossReturns.length > 0 ? (lossReturns.reduce((sum, val) => sum + val, 0) / lossReturns.length) : null;

            const trades = [];
            const tradeReturns = [];
            let capital = INITIAL_CAPITAL;
            let appliedKellySum = 0;
            if (testMeta.length > 0) {
                for (let i = 0; i < testMeta.length; i += 1) {
                    const probability = Number.isFinite(predictions[i]) ? predictions[i] : null;
                    const meta = testMeta[i];
                    if (probability === null || probability < 0.5) continue;
                    const kellyFraction = computeKellyFraction(probability, avgWin ?? 0, avgLoss ?? 0);
                    if (kellyFraction <= 0) continue;
                    const returnRatio = meta.returnRatio;
                    if (!Number.isFinite(returnRatio)) continue;
                    const positionSize = capital * kellyFraction;
                    const profit = positionSize * returnRatio;
                    capital += profit;
                    appliedKellySum += kellyFraction;
                    trades.push({
                        date: meta.date,
                        nextDate: meta.nextDate,
                        probability,
                        kellyFraction,
                        returnRatio,
                        diff: meta.diff,
                        currentClose: meta.currentClose,
                        nextClose: meta.nextClose,
                        label: meta.label,
                    });
                    tradeReturns.push(returnRatio);
                }
            }

            const totalReturn = capital / INITIAL_CAPITAL - 1;
            const avgKellyFraction = trades.length > 0 ? appliedKellySum / trades.length : 0;
            const averageTradeReturn = geometricMean(tradeReturns);

            let nextPrediction = null;
            if (Array.isArray(dataset.inferenceSequence) && dataset.inferenceSequence.length === dataset.lookback) {
                const inputTensor = tf.tensor3d([normaliseSequence(dataset.inferenceSequence, normalization)]);
                const predictionTensor = model.predict(inputTensor);
                const probability = (await predictionTensor.data())[0];
                inputTensor.dispose();
                predictionTensor.dispose();
                const kellyFraction = computeKellyFraction(probability, avgWin ?? 0, avgLoss ?? 0);
                nextPrediction = {
                    probability,
                    decision: probability >= 0.5 && kellyFraction > 0 ? '建議買入' : '建議觀望',
                    kellyFraction,
                    basisDate: dataset.lastDateForPrediction || dataset.lastDate || null,
                    basisClose: dataset.lastClose,
                };
            }

            trainTensor.dispose();
            trainLabelTensor.dispose();
            testTensor?.dispose();
            testLabelTensor?.dispose();

            aiForecastState.model = model;
            aiForecastState.normalization = normalization;
            aiForecastState.lastResult = {
                trainAccuracy,
                testAccuracy,
                totalReturn,
                averageTradeReturn,
                trades,
                avgKellyFraction,
                nextPrediction,
            };

            renderAiForecastResult(aiForecastState.lastResult);
            setAiForecastStatus('訓練完成，已更新評估結果。', 'success');
        } catch (error) {
            console.error('[AI Forecast] Unexpected error:', error);
            setAiForecastStatus(`訓練失敗：${error.message}`, 'error');
        } finally {
            aiForecastState.busy = false;
            updateRunButtonState({ disabled: false, label: '重新訓練' });
        }
    }

    function renderAiForecastResult(result) {
        if (!result) {
            resetAiForecastMetrics();
            return;
        }
        setText('ai-forecast-train-accuracy', formatPercent(result.trainAccuracy ?? null, 1));
        setText('ai-forecast-test-accuracy', formatPercent(result.testAccuracy ?? null, 1));
        const nextDecisionLabel = result.nextPrediction ? result.nextPrediction.decision : '—';
        const nextProbability = result.nextPrediction ? formatPercent(result.nextPrediction.probability ?? null, 1) : '—';
        setText('ai-forecast-next-decision', nextDecisionLabel);
        setText('ai-forecast-next-prob', nextProbability);

        setText('ai-forecast-total-return', formatPercent(result.totalReturn ?? null, 2));
        setText('ai-forecast-average-return', formatPercent(result.averageTradeReturn ?? null, 2));
        setText('ai-forecast-trade-count', formatNumber(result.trades ? result.trades.length : 0));
        const kellyDisplay = result.avgKellyFraction != null && result.avgKellyFraction > 0
            ? formatPercent(result.avgKellyFraction, 1)
            : '—';
        setText('ai-forecast-kelly-fraction', kellyDisplay);
    }

    document.addEventListener('DOMContentLoaded', () => {
        ensureInitialized();
    });

    window.updateAiForecastTab = updateAiForecastTab;
    window.resetAiForecastTab = resetAiForecastTab;
})();
