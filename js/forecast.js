const FORECAST_VERSION_CODE = 'LB-FORECAST-LSTMGA-20251118A';
let forecastChartInstance = null;

function getSharedVisibleStockData() {
    const globalWindow = typeof window !== 'undefined' ? window : undefined;
    if (globalWindow && Array.isArray(globalWindow.visibleStockData)) {
        return globalWindow.visibleStockData;
    }
    if (typeof visibleStockData !== 'undefined' && Array.isArray(visibleStockData)) {
        return visibleStockData;
    }
    return [];
}

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

function describeCorrection(correction) {
    if (!correction || !Number.isFinite(correction.delta)) {
        return '尚未建立誤差校正參數。';
    }
    const deltaText = formatNumber(correction.delta * 100, 3);
    const carryText = Number.isFinite(correction.finalCumulativeError)
        ? formatNumber(correction.finalCumulativeError, 4)
        : '--';
    const mseText = Number.isFinite(correction.baselineTrainingMse) && Number.isFinite(correction.trainingMse)
        ? ` ｜ 訓練 MSE ${formatNumber(correction.baselineTrainingMse, 4)} → ${formatNumber(correction.trainingMse, 4)}`
        : '';
    const fitnessText = Number.isFinite(correction.fitness)
        ? ` ｜ 適應值 ${formatNumber(correction.fitness, 4)}`
        : '';
    return `校正閾值 δ = ${deltaText}% ｜ 訓練累積誤差 = ${carryText}${mseText}${fitnessText}`;
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
    const source = getSharedVisibleStockData();
    if (!Array.isArray(source) || source.length === 0) {
        return [];
    }
    const dedup = new Map();
    source.forEach((row) => {
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

function computeMse(predicted, actuals) {
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length !== actuals.length || predicted.length === 0) {
        return NaN;
    }
    const sumSq = predicted.reduce((sum, pred, idx) => {
        const diff = pred - actuals[idx];
        return sum + diff * diff;
    }, 0);
    return sumSq / predicted.length;
}

function computeRmse(predicted, actuals) {
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length !== actuals.length || predicted.length === 0) {
        return NaN;
    }
    const mse = computeMse(predicted, actuals);
    return Number.isFinite(mse) ? Math.sqrt(mse) : NaN;
}

function computeMae(predicted, actuals) {
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length !== actuals.length || predicted.length === 0) {
        return NaN;
    }
    const sumAbs = predicted.reduce((sum, pred, idx) => sum + Math.abs(pred - actuals[idx]), 0);
    return sumAbs / predicted.length;
}

function applyErrorCorrection({ rawPreds, actuals, initialCumulativeError = 0, delta }) {
    const corrected = [];
    let cumulativeError = Number.isFinite(initialCumulativeError) ? initialCumulativeError : 0;

    for (let idx = 0; idx < rawPreds.length; idx += 1) {
        const predictedValue = rawPreds[idx];
        const correctedValue = predictedValue + cumulativeError;
        corrected.push(correctedValue);

        if (Array.isArray(actuals) && Number.isFinite(actuals[idx])) {
            const actualValue = actuals[idx];
            const error = actualValue - correctedValue;
            const thresholdBase = Math.max(Math.abs(actualValue), 1e-6);
            if (Math.abs(error) > thresholdBase * delta) {
                cumulativeError += error;
            }
        }
    }

    return { corrected, finalCumulativeError: cumulativeError };
}

function runGeneticOptimization({ rawPreds, actuals }) {
    const populationSize = 30;
    const generations = 40;
    const mutationRate = 0.25;
    const mutationScale = 0.02;
    const minDelta = 0.0005;
    const maxDelta = 0.2;

    if (!Array.isArray(rawPreds) || rawPreds.length === 0 || !Array.isArray(actuals) || actuals.length !== rawPreds.length) {
        return { delta: 0, mse: NaN, fitness: 0 };
    }

    const randomDelta = () => minDelta + Math.random() * (maxDelta - minDelta);

    const clampDelta = (value) => {
        if (!Number.isFinite(value)) return minDelta;
        if (value < minDelta) return minDelta;
        if (value > maxDelta) return maxDelta;
        return value;
    };

    const evaluateDelta = (delta) => {
        const { corrected } = applyErrorCorrection({ rawPreds, actuals, initialCumulativeError: 0, delta });
        const mse = computeMse(corrected, actuals);
        const fitness = Number.isFinite(mse) ? 1 / (1 + mse) : 0;
        return { delta, mse, fitness };
    };

    let population = Array.from({ length: populationSize }, () => evaluateDelta(randomDelta()));
    let bestIndividual = population.reduce((best, candidate) => (candidate.fitness > best.fitness ? candidate : best), population[0]);

    const selectParent = () => {
        const tournamentSize = 3;
        let selected = population[Math.floor(Math.random() * population.length)];
        for (let i = 1; i < tournamentSize; i += 1) {
            const challenger = population[Math.floor(Math.random() * population.length)];
            if (challenger.fitness > selected.fitness) {
                selected = challenger;
            }
        }
        return selected;
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const nextPopulation = [bestIndividual];
        while (nextPopulation.length < populationSize) {
            const parentA = selectParent();
            const parentB = selectParent();
            let childDelta = (parentA.delta + parentB.delta) / 2;
            if (Math.random() < mutationRate) {
                childDelta += (Math.random() * 2 - 1) * mutationScale;
            }
            const evaluatedChild = evaluateDelta(clampDelta(childDelta));
            nextPopulation.push(evaluatedChild);
            if (evaluatedChild.fitness > bestIndividual.fitness) {
                bestIndividual = evaluatedChild;
            }
        }
        population = nextPopulation;
    }

    return bestIndividual;
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
                    label: 'LSTM + 誤差校正',
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
    const rmseEl = document.getElementById('forecastRmse');
    const maeEl = document.getElementById('forecastMae');
    const correctionEl = document.getElementById('forecastCorrection');

    if (hitRateEl) hitRateEl.textContent = formatRatio(metrics.hitRate);
    if (gainEl) gainEl.textContent = formatChange(metrics.avgGain);
    if (lossEl) lossEl.textContent = formatChange(metrics.avgLoss);
    if (mseEl) mseEl.textContent = `${formatNumber(metrics.mse, 2)} （基準 ${formatNumber(metrics.baselineMse, 2)}）`;
    if (rmseEl) rmseEl.textContent = `${formatNumber(metrics.rmse, 2)} （基準 ${formatNumber(metrics.baselineRmse, 2)}）`;
    if (maeEl) maeEl.textContent = `${formatNumber(metrics.mae, 2)} （基準 ${formatNumber(metrics.baselineMae, 2)}）`;
    if (correctionEl) correctionEl.textContent = describeCorrection(result.correction);
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
    const baselineTrainingMse = computeMse(trainPredActuals, trainActuals);

    const gaResult = trainPredActuals.length >= 5
        ? runGeneticOptimization({ rawPreds: trainPredActuals, actuals: trainActuals })
        : { delta: 0, mse: NaN, fitness: 0 };

    const trainingCorrection = applyErrorCorrection({
        rawPreds: trainPredActuals,
        actuals: trainActuals,
        initialCumulativeError: 0,
        delta: gaResult.delta,
    });

    const testResult = await predictSequential(model, normalizedSeries, closes, trainCount, sequenceLength, stats, rows);
    const baselineMse = computeMse(testResult.predicted, testResult.actuals);
    const baselineRmse = Number.isFinite(baselineMse) ? Math.sqrt(baselineMse) : NaN;
    const baselineMae = computeMae(testResult.predicted, testResult.actuals);

    const correctedResult = applyErrorCorrection({
        rawPreds: testResult.predicted,
        actuals: testResult.actuals,
        initialCumulativeError: trainingCorrection.finalCumulativeError,
        delta: gaResult.delta,
    });

    const mse = computeMse(correctedResult.corrected, testResult.actuals);
    const rmse = Number.isFinite(mse) ? Math.sqrt(mse) : NaN;
    const mae = computeMae(correctedResult.corrected, testResult.actuals);

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
            delta: gaResult.delta,
            finalCumulativeError: trainingCorrection.finalCumulativeError,
            trainingMse: gaResult.mse,
            baselineTrainingMse,
            fitness: gaResult.fitness,
        },
        durationMs: 0,
        metrics: {
            hitRate: directionMetrics.hitRate,
            avgGain: directionMetrics.avgGain,
            avgLoss: directionMetrics.avgLoss,
            mse,
            rmse,
            mae,
            baselineRmse,
            baselineMae,
            baselineMse,
            baselineHitRate: baselineDirection.hitRate,
        },
        chart: chartPayload,
    };
}

async function handleForecastRequest(button) {
    const source = getSharedVisibleStockData();
    if (!Array.isArray(source) || source.length === 0) {
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
    if (getSharedVisibleStockData().length === 0) {
        updateForecastStatus('請先完成回測，再啟動預測模擬。', 'info');
    }
});
