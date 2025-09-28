// --- 預測分頁模組 - v1.0 ---
// Patch Tag: LB-PREDICTION-LSTM-GA-20251117A

(function () {
    const VERSION_CODE = 'LB-PREDICTION-LSTM-GA-20251117A';
    const MIN_SERIES_LENGTH = 60;
    const MIN_TEST_SAMPLES = 6;

    const state = {
        version: VERSION_CODE,
        series: [],
        context: {},
        chart: null,
        busy: false,
        lastFingerprint: null,
        autoRunTimer: null,
        tensorflowWaiter: null,
        pendingAutoRun: false,
        lastSummary: null,
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function getElement(id) {
        return typeof document === 'undefined' ? null : document.getElementById(id);
    }

    function updateVersionBadge() {
        const badge = getElement('prediction-version');
        if (badge) {
            badge.textContent = VERSION_CODE;
        }
    }

    function buildContextLabel(context) {
        if (!context || typeof context !== 'object') return '';
        const parts = [];
        if (context.stockNo) parts.push(String(context.stockNo).toUpperCase());
        if (context.market) parts.push(String(context.market).toUpperCase());
        return parts.join('・');
    }

    function updateStatus(message) {
        const statusEl = getElement('prediction-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function setRunButtonState(isBusy, label) {
        const runBtn = getElement('predictionRunBtn');
        if (!runBtn) return;
        const labelEl = runBtn.querySelector('[data-prediction-run-label]');
        if (labelEl) {
            labelEl.textContent = label || (isBusy ? '模型訓練中…' : '重新執行預測');
        }
        runBtn.disabled = Boolean(isBusy);
        runBtn.classList.toggle('opacity-60', Boolean(isBusy));
        runBtn.classList.toggle('cursor-not-allowed', Boolean(isBusy));
    }

    function clearError() {
        const errorEl = getElement('prediction-error');
        if (errorEl) {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        }
    }

    function showError(message) {
        const errorEl = getElement('prediction-error');
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    function setSummaryValue(id, value) {
        const el = getElement(id);
        if (el) {
            el.textContent = value;
        }
    }

    function resetSummary() {
        setSummaryValue('prediction-hit-rate', '—');
        setSummaryValue('prediction-average-rise', '—');
        setSummaryValue('prediction-average-drop', '—');
        updateMetaPanel(null);
        resetChart();
    }

    function formatPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(digits)}%`;
    }

    function formatSignedPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(digits)}%`;
    }

    function prepareSeries(rawSeries) {
        if (!Array.isArray(rawSeries)) return [];
        const byDate = new Map();
        rawSeries.forEach((row) => {
            if (!row) return;
            const date = row.date || row.Date || row.tradeDate;
            const close = Number(row.close ?? row.Close ?? row.c);
            if (!date || !Number.isFinite(close)) return;
            byDate.set(String(date), { date: String(date), close });
        });
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    function computeFingerprint(series) {
        if (!Array.isArray(series) || series.length === 0) return null;
        const first = series[0]?.date || '';
        const last = series[series.length - 1]?.date || '';
        return `${series.length}|${first}|${last}`;
    }

    function computeLookback(length) {
        if (!Number.isFinite(length) || length <= 0) return 20;
        const dynamic = Math.floor(length * 0.12);
        return clamp(dynamic, 20, 60);
    }

    function createSamples(series, lookback) {
        const samples = [];
        if (!Array.isArray(series) || series.length <= lookback) return samples;
        for (let i = 0; i < series.length - lookback; i += 1) {
            const window = series.slice(i, i + lookback);
            const targetPoint = series[i + lookback];
            const lastClose = window[window.length - 1].close;
            const prevClose = window.length >= 2 ? window[window.length - 2].close : lastClose;
            samples.push({
                window,
                target: targetPoint,
                lastClose,
                prevClose,
            });
        }
        return samples;
    }

    function createScaler(samples) {
        const values = [];
        samples.forEach((sample) => {
            sample.window.forEach((point) => {
                if (Number.isFinite(point.close)) values.push(point.close);
            });
            if (Number.isFinite(sample.target?.close)) values.push(sample.target.close);
        });
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 1;
        const rawRange = max - min;
        const safeRange = rawRange === 0 ? Math.max(1, Math.abs(max) || 1) : rawRange;
        return {
            min,
            max,
            range: safeRange,
            normalize(value) {
                if (!Number.isFinite(value)) return 0;
                return (value - min) / safeRange;
            },
            denormalize(value) {
                if (!Number.isFinite(value)) return min;
                return value * safeRange + min;
            },
        };
    }

    function samplesToTensor(samples, scaler, options = {}) {
        if (!Array.isArray(samples) || samples.length === 0) {
            return { tensorX: null, tensorY: null, features: [] };
        }
        const lookback = samples[0]?.window?.length || 0;
        if (lookback === 0) {
            return { tensorX: null, tensorY: null, features: [] };
        }
        const inputs = [];
        const labels = [];
        const features = [];
        samples.forEach((sample) => {
            const sequence = sample.window.map((point) => [scaler.normalize(point.close)]);
            inputs.push(sequence);
            if (options.includeLabels) {
                labels.push([scaler.normalize(sample.target.close)]);
            }
            features.push({
                lastCloseNorm: scaler.normalize(sample.lastClose),
                prevCloseNorm: scaler.normalize(sample.prevClose),
            });
        });
        const tensorX = tf.tensor3d(inputs, [inputs.length, lookback, 1]);
        const tensorY = options.includeLabels ? tf.tensor2d(labels, [labels.length, 1]) : null;
        return { tensorX, tensorY, features };
    }

    function createModel(lookback) {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 48, returnSequences: false, inputShape: [lookback, 1] }));
        model.add(tf.layers.dropout({ rate: 0.25 }));
        model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1 }));
        model.compile({ optimizer: tf.train.adam(0.005), loss: 'meanSquaredError' });
        return model;
    }

    function applyCorrection(predictedNorm, feature, params) {
        if (!feature || !params) return predictedNorm;
        const alpha = Number.isFinite(params.alpha) ? params.alpha : 0;
        const beta = Number.isFinite(params.beta) ? params.beta : 0;
        const gamma = Number.isFinite(params.gamma) ? params.gamma : 0;
        const deltaPred = predictedNorm - feature.lastCloseNorm;
        const lastChange = feature.lastCloseNorm - feature.prevCloseNorm;
        const adjusted = predictedNorm + alpha * deltaPred + beta * lastChange + gamma;
        return clamp(adjusted, -1, 2);
    }

    function runGeneticAlgorithm(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return { alpha: 0, beta: 0, gamma: 0 };
        }
        const populationSize = options.populationSize || 30;
        const generations = options.generations || 40;
        const mutationRate = options.mutationRate || 0.15;

        const randomCandidate = () => ({
            alpha: (Math.random() * 4) - 2,
            beta: (Math.random() * 4) - 2,
            gamma: (Math.random() * 1.2) - 0.6,
        });

        const evaluate = (candidate) => {
            let errorSum = 0;
            data.forEach((row) => {
                const corrected = applyCorrection(row.predicted, row.feature, candidate);
                const diff = corrected - row.target;
                errorSum += diff * diff;
            });
            return errorSum / data.length;
        };

        let population = Array.from({ length: populationSize }, randomCandidate);
        let best = null;

        for (let gen = 0; gen < generations; gen += 1) {
            const scored = population
                .map((candidate) => ({ candidate, error: evaluate(candidate) }))
                .sort((a, b) => a.error - b.error);

            if (!best || scored[0].error < best.error) {
                best = { ...scored[0] };
            }

            const eliteCount = Math.max(2, Math.floor(populationSize * 0.2));
            const elites = scored.slice(0, eliteCount).map((entry) => entry.candidate);
            const nextPopulation = elites.slice();

            while (nextPopulation.length < populationSize) {
                const parentA = elites[Math.floor(Math.random() * elites.length)] || randomCandidate();
                const parentB = scored[Math.floor(Math.random() * scored.length)]?.candidate || randomCandidate();
                const child = {
                    alpha: (parentA.alpha + parentB.alpha) / 2,
                    beta: (parentA.beta + parentB.beta) / 2,
                    gamma: (parentA.gamma + parentB.gamma) / 2,
                };
                if (Math.random() < mutationRate) {
                    child.alpha += (Math.random() * 0.6) - 0.3;
                    child.beta += (Math.random() * 0.6) - 0.3;
                    child.gamma += (Math.random() * 0.2) - 0.1;
                }
                nextPopulation.push({
                    alpha: clamp(child.alpha, -2.5, 2.5),
                    beta: clamp(child.beta, -2.5, 2.5),
                    gamma: clamp(child.gamma, -0.8, 0.8),
                });
            }

            population = nextPopulation;
        }

        return best ? best.candidate : { alpha: 0, beta: 0, gamma: 0 };
    }

    function resetChart() {
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        const placeholder = getElement('predictionChartPlaceholder');
        if (placeholder) {
            placeholder.classList.remove('hidden');
        }
    }

    function renderChart(labels, actualPrices, predictedPrices) {
        const canvas = getElement('predictionChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        const placeholder = getElement('predictionChartPlaceholder');
        if (placeholder) {
            placeholder.classList.add('hidden');
        }
        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '實際收盤價',
                        data: actualPrices,
                        borderColor: 'rgba(34, 197, 94, 0.9)',
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        tension: 0.2,
                        pointRadius: 0,
                        borderWidth: 2,
                    },
                    {
                        label: '預測收盤價',
                        data: predictedPrices,
                        borderColor: 'rgba(59, 130, 246, 0.9)',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        tension: 0.2,
                        pointRadius: 0,
                        borderDash: [4, 4],
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        display: true,
                        labels: { usePointStyle: true },
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value = context.parsed.y;
                                if (!Number.isFinite(value)) return `${context.dataset.label}: —`;
                                return `${context.dataset.label}: ${value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { maxTicksLimit: 12 },
                        grid: { display: false },
                    },
                    y: {
                        ticks: {
                            callback(value) {
                                if (!Number.isFinite(value)) return value;
                                return value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            },
                        },
                    },
                },
            },
        });
    }

    function computeMetrics(labels, prevCloses, actualPrices, predictedPrices) {
        let hitCount = 0;
        let riseCount = 0;
        let fallCount = 0;
        let riseSum = 0;
        let fallSum = 0;
        labels.forEach((label, idx) => {
            const prev = prevCloses[idx];
            const actual = actualPrices[idx];
            const predicted = predictedPrices[idx];
            if (!Number.isFinite(prev) || !Number.isFinite(actual) || !Number.isFinite(predicted)) return;
            const actualChange = actual - prev;
            const predictedChange = predicted - prev;
            const actualPct = prev !== 0 ? (actualChange / prev) * 100 : 0;
            const predictedPct = prev !== 0 ? (predictedChange / prev) * 100 : 0;
            const hit = (actualChange >= 0 && predictedChange >= 0) || (actualChange < 0 && predictedChange < 0);
            if (hit) hitCount += 1;
            if (actualChange > 0) {
                riseCount += 1;
                riseSum += actualPct;
            } else if (actualChange < 0) {
                fallCount += 1;
                fallSum += actualPct;
            }
        });
        const total = labels.length;
        return {
            hitRate: total > 0 ? (hitCount / total) * 100 : null,
            avgRise: riseCount > 0 ? riseSum / riseCount : null,
            avgDrop: fallCount > 0 ? fallSum / fallCount : null,
        };
    }

    function updateMetaPanel(info) {
        const metaEl = getElement('prediction-meta');
        if (!metaEl) return;
        if (!info) {
            metaEl.innerHTML = '<p>訓練樣本：—</p><p>測試樣本：—</p><p>視窗長度：—</p><p>測試區間：—</p>';
            return;
        }
        const trainText = Number.isFinite(info.trainCount) ? info.trainCount.toLocaleString('zh-TW') : '—';
        const testText = Number.isFinite(info.testCount) ? info.testCount.toLocaleString('zh-TW') : '—';
        const windowText = Number.isFinite(info.lookback) ? `${info.lookback} 日` : '—';
        const rangeText = info.testStart && info.testEnd ? `${info.testStart} ~ ${info.testEnd}` : '—';
        metaEl.innerHTML = `
            <p>訓練樣本：${trainText}</p>
            <p>測試樣本：${testText}</p>
            <p>視窗長度：${windowText}</p>
            <p>測試區間：${rangeText}</p>
        `;
    }

    function scheduleAutoRun() {
        if (state.autoRunTimer) {
            clearTimeout(state.autoRunTimer);
        }
        state.autoRunTimer = setTimeout(() => {
            runPrediction({ auto: true }).catch((error) => {
                console.warn('[Prediction] 自動預測失敗：', error);
            });
        }, 160);
    }

    function ensureTensorFlowReady(auto = false) {
        if (typeof tf !== 'undefined' && typeof tf.ready === 'function') {
            return true;
        }
        if (auto && !state.tensorflowWaiter) {
            state.pendingAutoRun = true;
            state.tensorflowWaiter = setInterval(() => {
                if (typeof tf !== 'undefined' && typeof tf.ready === 'function') {
                    clearInterval(state.tensorflowWaiter);
                    state.tensorflowWaiter = null;
                    const shouldRun = state.pendingAutoRun;
                    state.pendingAutoRun = false;
                    if (shouldRun) {
                        runPrediction({ auto: true }).catch((error) => {
                            console.warn('[Prediction] TensorFlow.js 就緒後自動預測失敗：', error);
                        });
                    }
                }
            }, 400);
        }
        return false;
    }

    async function runPrediction(options = {}) {
        if (state.busy) return null;
        if (!Array.isArray(state.series) || state.series.length < MIN_SERIES_LENGTH) {
            updateStatus('資料筆數不足，請延長回測期間後再試。');
            resetSummary();
            return null;
        }
        if (!ensureTensorFlowReady(Boolean(options.auto))) {
            updateStatus('TensorFlow.js 尚未載入，稍後將自動重新嘗試。');
            return null;
        }

        state.busy = true;
        clearError();
        setRunButtonState(true, '模型訓練中…');

        let trainX = null;
        let trainY = null;
        let testX = null;
        let model = null;

        try {
            await tf.ready();
            const lookback = computeLookback(state.series.length);
            const samples = createSamples(state.series, lookback);
            if (samples.length < MIN_TEST_SAMPLES + lookback) {
                updateStatus('有效樣本太少，無法建立可靠的預測模型。');
                resetSummary();
                return null;
            }

            const totalSamples = samples.length;
            const minTest = Math.max(MIN_TEST_SAMPLES, Math.floor(totalSamples * 0.2));
            let testCount = clamp(minTest, MIN_TEST_SAMPLES, totalSamples - 4);
            let trainCount = totalSamples - testCount;
            if (trainCount < lookback + 4) {
                trainCount = clamp(Math.floor(totalSamples * 0.7), lookback + 4, totalSamples - MIN_TEST_SAMPLES);
                testCount = totalSamples - trainCount;
            }
            if (testCount < MIN_TEST_SAMPLES) {
                updateStatus('測試樣本不足，請延長回測期間。');
                resetSummary();
                return null;
            }

            const trainSamples = samples.slice(0, trainCount);
            const testSamples = samples.slice(trainCount);
            const scaler = createScaler(trainSamples);
            const tensorsTrain = samplesToTensor(trainSamples, scaler, { includeLabels: true });
            const tensorsTest = samplesToTensor(testSamples, scaler, { includeLabels: false });
            trainX = tensorsTrain.tensorX;
            trainY = tensorsTrain.tensorY;
            testX = tensorsTest.tensorX;
            const trainFeatures = tensorsTrain.features;
            const testFeatures = tensorsTest.features;

            if (!trainX || !trainY || !testX) {
                updateStatus('資料轉換失敗，請重新整理後再試。');
                resetSummary();
                return null;
            }

            model = createModel(lookback);
            const epochs = trainSamples.length >= 120 ? 70 : 55;
            const batchSize = clamp(Math.floor(trainSamples.length / 6), 8, 32);
            updateStatus('LSTM 訓練中 (1/2)…');
            await model.fit(trainX, trainY, {
                epochs,
                batchSize,
                shuffle: false,
                validationSplit: trainSamples.length >= 60 ? 0.15 : 0,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        if (epoch === epochs - 1 || epoch % 10 === 9) {
                            updateStatus(`LSTM 訓練中 (1/2)… 第 ${epoch + 1}/${epochs} 回合，loss ${(logs?.loss ?? 0).toFixed(4)}`);
                            await tf.nextFrame();
                        }
                    },
                },
            });

            updateStatus('GA 誤差校正中 (2/2)…');
            const trainPredTensor = model.predict(trainX);
            const testPredTensor = model.predict(testX);
            const trainPredArray = await trainPredTensor.array();
            const testPredArray = await testPredTensor.array();
            trainPredTensor.dispose();
            testPredTensor.dispose();

            const gaSliceStart = Math.max(0, trainPredArray.length - Math.max(10, Math.floor(trainPredArray.length * 0.3)));
            const gaData = trainPredArray.slice(gaSliceStart).map((row, idx) => {
                const sample = trainSamples[gaSliceStart + idx];
                return {
                    predicted: row[0],
                    target: scaler.normalize(sample.target.close),
                    feature: trainFeatures[gaSliceStart + idx],
                };
            });
            const gaParams = runGeneticAlgorithm(gaData);

            const predictedPrices = testPredArray.map((row, idx) => {
                const correctedNorm = applyCorrection(row[0], testFeatures[idx], gaParams);
                return scaler.denormalize(correctedNorm);
            });
            const actualPrices = testSamples.map((sample) => sample.target.close);
            const prevCloses = testSamples.map((sample) => sample.lastClose);
            const labels = testSamples.map((sample) => sample.target.date);

            const metrics = computeMetrics(labels, prevCloses, actualPrices, predictedPrices);
            setSummaryValue('prediction-hit-rate', formatPercent(metrics.hitRate));
            setSummaryValue('prediction-average-rise', formatSignedPercent(metrics.avgRise));
            setSummaryValue('prediction-average-drop', formatSignedPercent(metrics.avgDrop));

            renderChart(labels, actualPrices, predictedPrices);

            const metaInfo = {
                trainCount,
                testCount,
                lookback,
                testStart: labels[0] || null,
                testEnd: labels[labels.length - 1] || null,
            };
            updateMetaPanel(metaInfo);

            const label = buildContextLabel(state.context);
            updateStatus(`${label ? `[${label}] ` : ''}完成 LSTM + GA 模型訓練，測試樣本 ${testCount.toLocaleString('zh-TW')} 筆。`);
            state.lastSummary = { metrics, metaInfo, labels };

            return state.lastSummary;
        } catch (error) {
            console.error('[Prediction] 預測流程發生錯誤：', error);
            showError(`預測過程發生錯誤：${error.message || error}`);
            updateStatus('預測失敗，請檢查控制台訊息後重試。');
            return null;
        } finally {
            if (trainX) trainX.dispose();
            if (trainY) trainY.dispose();
            if (testX) testX.dispose();
            if (model && typeof model.dispose === 'function') model.dispose();
            state.busy = false;
            setRunButtonState(false, '重新執行預測');
        }
    }

    function setSeries(rawSeries, context = {}) {
        const cleanSeries = prepareSeries(rawSeries);
        state.series = cleanSeries;
        state.context = context || {};
        const label = buildContextLabel(context);
        if (cleanSeries.length === 0) {
            updateStatus('請先執行回測以載入股價資料。');
            resetSummary();
            return;
        }
        const first = cleanSeries[0]?.date || '';
        const last = cleanSeries[cleanSeries.length - 1]?.date || '';
        updateStatus(`${label ? `[${label}] ` : ''}已載入 ${cleanSeries.length.toLocaleString('zh-TW')} 筆收盤價（${first} ~ ${last}）。`);
        const fingerprint = computeFingerprint(cleanSeries);
        if (fingerprint && fingerprint !== state.lastFingerprint) {
            state.lastFingerprint = fingerprint;
            scheduleAutoRun();
        }
    }

    function handleBacktestResult(payload) {
        if (!payload) return;
        const { priceSeries, context } = payload;
        setSeries(priceSeries, context);
    }

    function handleTabActivated() {
        if (state.chart && typeof state.chart.resize === 'function') {
            state.chart.resize();
        }
    }

    function init() {
        updateVersionBadge();
        const runBtn = getElement('predictionRunBtn');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                runPrediction({ auto: false }).catch((error) => {
                    console.error('[Prediction] 手動預測失敗：', error);
                    showError(`預測過程發生錯誤：${error.message || error}`);
                });
            });
        }
        if (!state.series.length) {
            resetSummary();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.lazybacktestPrediction = {
        VERSION_CODE,
        setSeries,
        run: runPrediction,
        handleTabActivated,
        onBacktestResult: handleBacktestResult,
    };
})();
