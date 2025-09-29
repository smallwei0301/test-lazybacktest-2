const FORECAST_VERSION_CODE = 'LB-FORECAST-LSTMGA-20251115A';
let forecastChartInstance = null;

function updateForecastStatus(message, type = 'info') {
    const statusEl = document.getElementById('forecastStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    const colorMap = {
        info: 'var(--muted-foreground)',
        success: '#047857',
        error: '#b91c1c',
        warning: '#b45309',
    };
    statusEl.style.color = colorMap[type] || 'var(--muted-foreground)';
}

function setForecastSamples(trainSamples, testSamples) {
    const el = document.getElementById('forecastSamples');
    if (!el) return;
    if (!Number.isFinite(trainSamples) || !Number.isFinite(testSamples)) {
        el.textContent = '尚未建立樣本';
        return;
    }
    el.textContent = `訓練樣本 ${trainSamples} 筆 ｜ 測試樣本 ${testSamples} 筆`;
    el.style.color = 'var(--muted-foreground)';
}

function setForecastVersion() {
    const el = document.getElementById('forecastVersion');
    if (el) {
        el.textContent = FORECAST_VERSION_CODE;
        el.style.color = 'var(--muted-foreground)';
    }
}

function formatRatio(value, digits = 1) {
    if (!Number.isFinite(value)) return '--';
    return `${(value * 100).toFixed(digits)}%`;
}

function formatChange(value, digits = 2) {
    if (!Number.isFinite(value)) return '--';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}%`;
}

function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(digits);
}

function describeCorrection(delta, finalCarry) {
    if (!Number.isFinite(delta)) {
        return '尚未建立校正閥值。';
    }
    const deltaText = `最佳校正閥值 δ = ${(delta * 100).toFixed(3)}%`;
    const carryText = Number.isFinite(finalCarry)
        ? `最新累積誤差 C_last = ${formatNumber(finalCarry, 4)}`
        : '最新累積誤差 C_last = --';
    return `${deltaText} ｜ ${carryText}`;
}

function resolveCloseValue(row) {
    const candidates = [row?.close, row?.adjustedClose, row?.adjClose, row?.rawClose, row?.price];
    for (const candidate of candidates) {
        const numeric = typeof candidate === 'string' ? Number(candidate) : candidate;
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    return null;
}

function extractForecastRows() {
    if (!Array.isArray(window.visibleStockData) || window.visibleStockData.length === 0) {
        return [];
    }
    const dedup = new Map();
    window.visibleStockData.forEach((row) => {
        const dateText = row?.date ? String(row.date).trim() : '';
        if (!dateText) return;
        const closeValue = resolveCloseValue(row);
        if (!Number.isFinite(closeValue)) return;
        const dateObj = new Date(dateText);
        if (Number.isNaN(dateObj.getTime())) return;
        const iso = dateObj.toISOString().slice(0, 10);
        dedup.set(iso, closeValue);
    });
    const sorted = Array.from(dedup.entries())
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted;
}

function computeStats(values) {
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length === 0) {
        return { mean: 0, std: 1 };
    }
    const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length;
    const variance = valid.reduce((sum, v) => sum + (v - mean) ** 2, 0) / valid.length;
    const std = Math.sqrt(Math.max(variance, 1e-8));
    return { mean, std };
}

function normalizeValue(value, stats) {
    return (value - stats.mean) / (stats.std || 1);
}

function denormalizeValue(value, stats) {
    return value * (stats.std || 1) + stats.mean;
}

function computeMse(predicted, actuals) {
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length !== actuals.length || predicted.length === 0) {
        return NaN;
    }
    const sumSq = predicted.reduce((sum, pred, idx) => {
        const actual = actuals[idx];
        if (!Number.isFinite(pred) || !Number.isFinite(actual)) {
            return sum;
        }
        const diff = pred - actual;
        return sum + diff * diff;
    }, 0);
    return sumSq / predicted.length;
}

function createLstmModel(sequenceLength) {
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, inputShape: [sequenceLength, 1], returnSequences: false }));
    model.add(tf.layers.dropout({ rate: 0.1 }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
    return model;
}

async function ensureTensorflowReady() {
    if (typeof tf === 'undefined' || typeof tf.ready !== 'function') {
        throw new Error('TensorFlow.js 尚未載入，請稍後再試。');
    }
    await tf.ready();
}

function buildTrainingTensors(normalizedSeries, sequenceLength, trainCount) {
    const sequences = [];
    const targets = [];
    for (let idx = sequenceLength; idx < trainCount; idx += 1) {
        const windowSlice = normalizedSeries.slice(idx - sequenceLength, idx);
        if (windowSlice.length !== sequenceLength) continue;
        sequences.push(windowSlice.map((v) => [v]));
        targets.push([normalizedSeries[idx]]);
    }
    if (sequences.length === 0) {
        throw new Error('訓練資料不足，無法建立序列樣本。');
    }
    const trainX = tf.tensor3d(sequences);
    const trainY = tf.tensor2d(targets);
    return { trainX, trainY, sampleCount: sequences.length };
}

async function fitLstmModel(model, trainX, trainY, sampleCount) {
    const epochs = Math.min(160, Math.max(60, Math.round(sampleCount * 1.2)));
    let batchSize = Math.max(8, Math.floor(sampleCount / 4));
    if (batchSize > 32) batchSize = 32;
    if (batchSize > sampleCount) batchSize = sampleCount;
    batchSize = Math.max(4, batchSize);

    await model.fit(trainX, trainY, {
        epochs,
        batchSize,
        shuffle: false,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0) {
                    updateForecastStatus(`訓練模型中（${epoch + 1}/${epochs}） loss=${formatNumber(logs?.loss, 4)}`, 'info');
                }
            },
        },
    });
}

async function predictSequential(model, normalizedSeries, closes, startIndex, sequenceLength, stats, rows) {
    const predicted = [];
    const actuals = [];
    const dates = [];
    for (let idx = startIndex; idx < normalizedSeries.length; idx += 1) {
        const windowSlice = normalizedSeries.slice(idx - sequenceLength, idx);
        if (windowSlice.length !== sequenceLength) continue;
        const inputTensor = tf.tensor3d([windowSlice.map((v) => [v])]);
        const outputTensor = model.predict(inputTensor);
        const predNormArray = await outputTensor.data();
        const predNorm = predNormArray[0];
        inputTensor.dispose();
        outputTensor.dispose();
        predicted.push(denormalizeValue(predNorm, stats));
        actuals.push(closes[idx]);
        dates.push(rows[idx]?.date || '');
    }
    return { predicted, actuals, dates };
}

function applyDeltaCorrection(rawPreds, actuals, initialCarry, delta) {
    const corrected = [];
    const residuals = [];
    let carry = Number.isFinite(initialCarry) ? initialCarry : 0;
    for (let idx = 0; idx < rawPreds.length; idx += 1) {
        const baseline = rawPreds[idx];
        const predicted = Number.isFinite(baseline) ? baseline + carry : NaN;
        corrected.push(predicted);
        const actual = actuals[idx];
        if (Number.isFinite(actual) && Number.isFinite(predicted)) {
            const residual = actual - predicted;
            residuals.push(residual);
            const threshold = Math.abs(actual) * (Number.isFinite(delta) ? Math.max(delta, 0) : 0);
            if (Math.abs(residual) > threshold) {
                carry += residual;
            }
        } else {
            residuals.push(NaN);
        }
    }
    return { corrected, residuals, finalCarry: carry };
}

function runGeneticDeltaSearch({ rawPreds, actuals }) {
    if (!Array.isArray(rawPreds) || rawPreds.length === 0 || !Array.isArray(actuals) || actuals.length !== rawPreds.length) {
        return { delta: 0, mse: computeMse(rawPreds, actuals) };
    }

    const populationSize = 24;
    const generations = 40;
    const mutationRate = 0.3;
    const crossoverRate = 0.7;
    const deltaMin = 0.0005;
    const deltaMax = 0.15;

    const randomDelta = () => deltaMin + Math.random() * (deltaMax - deltaMin);

    const evaluate = (delta) => {
        const { corrected } = applyDeltaCorrection(rawPreds, actuals, 0, delta);
        return computeMse(corrected, actuals);
    };

    let population = Array.from({ length: populationSize }, randomDelta);
    let bestDelta = population[0];
    let bestScore = evaluate(bestDelta);

    for (let generation = 0; generation < generations; generation += 1) {
        const scores = population.map(evaluate);
        scores.forEach((score, idx) => {
            if (score < bestScore) {
                bestScore = score;
                bestDelta = population[idx];
            }
        });

        const matingPool = [];
        while (matingPool.length < populationSize) {
            const idxA = Math.floor(Math.random() * population.length);
            const idxB = Math.floor(Math.random() * population.length);
            const selected = scores[idxA] < scores[idxB] ? population[idxA] : population[idxB];
            matingPool.push(selected);
        }

        const nextPopulation = [];
        for (let i = 0; i < populationSize; i += 1) {
            let offspring = matingPool[i];
            if (Math.random() < crossoverRate) {
                const mate = matingPool[Math.floor(Math.random() * matingPool.length)];
                offspring = (offspring + mate) / 2;
            }
            if (Math.random() < mutationRate) {
                const perturbation = (Math.random() - 0.5) * 0.05;
                offspring += perturbation;
            }
            if (!Number.isFinite(offspring)) {
                offspring = randomDelta();
            }
            if (offspring < deltaMin) offspring = deltaMin;
            if (offspring > deltaMax) offspring = deltaMax;
            nextPopulation.push(offspring);
        }

        population = nextPopulation;
    }

    return { delta: bestDelta, mse: bestScore };
}

function computeDirectionMetrics(predicted, actuals, closes, startIndex) {
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length !== actuals.length || predicted.length === 0) {
        return { hitRate: NaN, avgGain: NaN, avgLoss: NaN };
    }
    const gains = [];
    const losses = [];
    let hits = 0;
    for (let idx = 0; idx < predicted.length; idx += 1) {
        const dataIndex = startIndex + idx;
        const prevClose = closes[dataIndex - 1];
        const actualClose = actuals[idx];
        const predictedClose = predicted[idx];
        if (!Number.isFinite(prevClose) || !Number.isFinite(actualClose) || !Number.isFinite(predictedClose)) {
            continue;
        }
        const actualChange = ((actualClose - prevClose) / prevClose) * 100;
        const predictedChange = ((predictedClose - prevClose) / prevClose) * 100;
        if (actualChange > 0) gains.push(actualChange);
        if (actualChange < 0) losses.push(actualChange);
        const actualDirection = actualChange >= 0 ? 1 : -1;
        const predictedDirection = predictedChange >= 0 ? 1 : -1;
        if (actualDirection === predictedDirection) {
            hits += 1;
        }
    }
    const total = predicted.length;
    const avgGain = gains.length > 0 ? gains.reduce((sum, v) => sum + v, 0) / gains.length : NaN;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, v) => sum + v, 0) / losses.length : NaN;
    return {
        hitRate: total > 0 ? hits / total : NaN,
        avgGain,
        avgLoss,
    };
}

function renderForecastChart({ dates, actual, baseline, corrected }) {
    const canvas = document.getElementById('forecastChart');
    if (!canvas) return;
    if (forecastChartInstance) {
        forecastChartInstance.destroy();
        forecastChartInstance = null;
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue('--primary')?.trim() || '#0ea5a4';
    const accentColor = rootStyles.getPropertyValue('--accent')?.trim() || '#f59e0b';
    const foregroundColor = rootStyles.getPropertyValue('--foreground')?.trim() || '#1f2937';

    forecastChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: '實際收盤價',
                    data: actual,
                    borderColor: foregroundColor,
                    borderWidth: 2,
                    tension: 0.2,
                    fill: false,
                },
                {
                    label: 'LSTM 預測',
                    data: baseline,
                    borderColor: accentColor,
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    tension: 0.2,
                    fill: false,
                },
                {
                    label: 'LSTM + GA 校正',
                    data: corrected,
                    borderColor: primaryColor,
                    borderWidth: 2,
                    tension: 0.2,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    ticks: { maxRotation: 0, autoSkip: true },
                    grid: { display: false },
                },
                y: {
                    ticks: { callback: (value) => value.toFixed ? value.toFixed(0) : value },
                    grid: { color: 'rgba(148, 163, 184, 0.2)' },
                },
            },
            plugins: {
                legend: {
                    labels: { usePointStyle: true },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)}`,
                    },
                },
            },
        },
    });
}

function updateForecastMetrics(result) {
    const { metrics } = result;
    const hitRateEl = document.getElementById('forecastHitRate');
    const gainEl = document.getElementById('forecastAvgGain');
    const lossEl = document.getElementById('forecastAvgLoss');
    const mseEl = document.getElementById('forecastMse');
    const correctionEl = document.getElementById('forecastCorrection');
    const correctionDetailsEl = document.getElementById('forecastCorrectionDetails');

    if (hitRateEl) hitRateEl.textContent = formatRatio(metrics.hitRate);
    if (gainEl) gainEl.textContent = formatChange(metrics.avgGain);
    if (lossEl) lossEl.textContent = formatChange(metrics.avgLoss);
    if (mseEl) mseEl.textContent = `${formatNumber(metrics.mse, 2)} （基準 ${formatNumber(metrics.baselineMse, 2)}）`;
    const deltaValue = Number.isFinite(result.correction?.delta) ? result.correction.delta : NaN;
    if (correctionEl) {
        const finalCarry = result.correction?.finalCarry;
        correctionEl.textContent = describeCorrection(deltaValue, finalCarry);
    }
    if (correctionDetailsEl) {
        correctionDetailsEl.textContent = `訓練期 MSE ${formatNumber(metrics.baselineTrainingMse, 2)} → ${formatNumber(metrics.trainingMse, 2)}，δ ${(Number.isFinite(deltaValue) ? (deltaValue * 100).toFixed(3) : '—')}%。`;
    }
}

function summariseForecastCompletion(result) {
    const durationSeconds = Number.isFinite(result.durationMs) ? result.durationMs / 1000 : 0;
    const summary = `完成預測：命中率 ${formatRatio(result.metrics.baselineHitRate)} → ${formatRatio(result.metrics.hitRate)}，MSE ${formatNumber(result.metrics.baselineMse, 2)} → ${formatNumber(result.metrics.mse, 2)}，耗時 ${formatNumber(durationSeconds, 1)} 秒。`;
    updateForecastStatus(summary, 'success');
}

async function runForecastWorkflow() {
    await ensureTensorflowReady();
    const rows = extractForecastRows();
    if (rows.length < 80) {
        throw new Error('資料不足，請拉長回測區間（至少 80 筆有效收盤價）。');
    }
    const closes = rows.map((row) => row.close);

    let sequenceLength = 20;
    if (rows.length < 160) {
        sequenceLength = Math.max(12, Math.floor(rows.length * 0.15));
    }
    sequenceLength = Math.min(40, Math.max(12, sequenceLength));

    let trainCount = Math.floor(rows.length * 0.75);
    if (trainCount < sequenceLength + 15) {
        trainCount = sequenceLength + 15;
    }
    if (trainCount > rows.length - 5) {
        trainCount = rows.length - 5;
    }
    if (trainCount <= sequenceLength) {
        throw new Error('資料區間過短，無法建立訓練樣本。');
    }

    const stats = computeStats(closes.slice(0, trainCount));
    const normalizedSeries = closes.map((value) => normalizeValue(value, stats));
    const { trainX, trainY, sampleCount } = buildTrainingTensors(normalizedSeries, sequenceLength, trainCount);

    const model = createLstmModel(sequenceLength);
    await fitLstmModel(model, trainX, trainY, sampleCount);

    const trainPredTensor = model.predict(trainX);
    const trainPredNormArray = Array.from(await trainPredTensor.data());
    trainPredTensor.dispose();

    trainX.dispose();
    trainY.dispose();

    const trainPredActuals = trainPredNormArray.map((value) => denormalizeValue(value, stats));
    const trainActuals = closes.slice(sequenceLength, trainCount);

    const deltaSearch = trainPredActuals.length >= 5
        ? runGeneticDeltaSearch({ rawPreds: trainPredActuals, actuals: trainActuals })
        : { delta: 0, mse: computeMse(trainPredActuals, trainActuals) };

    const baselineTrainingMse = computeMse(trainPredActuals, trainActuals);
    const trainingCorrection = applyDeltaCorrection(trainPredActuals, trainActuals, 0, deltaSearch.delta);
    const trainingMse = computeMse(trainingCorrection.corrected, trainActuals);

    const testResult = await predictSequential(model, normalizedSeries, closes, trainCount, sequenceLength, stats, rows);
    const baselineMse = computeMse(testResult.predicted, testResult.actuals);

    const correctedResult = applyDeltaCorrection(
        testResult.predicted,
        testResult.actuals,
        trainingCorrection.finalCarry,
        deltaSearch.delta,
    );

    const mse = computeMse(correctedResult.corrected, testResult.actuals);

    const directionMetrics = computeDirectionMetrics(
        correctedResult.corrected,
        testResult.actuals,
        closes,
        trainCount,
    );

    const baselineDirection = computeDirectionMetrics(
        testResult.predicted,
        testResult.actuals,
        closes,
        trainCount,
    );

    const chartPayload = {
        dates: testResult.dates,
        actual: testResult.actuals,
        baseline: testResult.predicted,
        corrected: correctedResult.corrected,
    };

    return {
        version: FORECAST_VERSION_CODE,
        sequenceLength,
        trainSamples: sampleCount,
        testSamples: testResult.actuals.length,
        correction: {
            delta: deltaSearch.delta,
            finalCarry: correctedResult.finalCarry,
        },
        durationMs: 0,
        metrics: {
            hitRate: directionMetrics.hitRate,
            avgGain: directionMetrics.avgGain,
            avgLoss: directionMetrics.avgLoss,
            mse,
            baselineMse,
            trainingMse,
            baselineTrainingMse,
            baselineHitRate: baselineDirection.hitRate,
        },
        chart: chartPayload,
    };
}

async function handleForecastRequest(button) {
    if (!Array.isArray(window.visibleStockData) || window.visibleStockData.length === 0) {
        updateForecastStatus('請先執行一次回測以取得股價資料。', 'warning');
        return;
    }
    button.disabled = true;
    button.style.opacity = '0.7';
    updateForecastStatus('準備資料並載入 TensorFlow.js...', 'info');
    try {
        const start = performance.now();
        const result = await runForecastWorkflow();
        result.durationMs = performance.now() - start;
        setForecastSamples(result.trainSamples, result.testSamples);
        updateForecastMetrics(result);
        renderForecastChart(result.chart);
        summariseForecastCompletion(result);
    } catch (error) {
        console.error('[Forecast] Failed to generate prediction', error);
        updateForecastStatus(`預測失敗：${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.style.opacity = '1';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setForecastVersion();
    const runBtn = document.getElementById('runForecastBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => handleForecastRequest(runBtn));
    }
    if (!Array.isArray(window.visibleStockData) || window.visibleStockData.length === 0) {
        updateForecastStatus('請先完成回測，再啟動預測模擬。', 'info');
    }
});
