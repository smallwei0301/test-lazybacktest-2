const FORECAST_VERSION_CODE = 'LB-FORECAST-LSTMGA-20251209A';
const FORECAST_DEFAULT_ITERATIONS = 5;
const FORECAST_MAX_ITERATIONS = 25;
let forecastChartInstance = null;

function createSeededRandom(seedInput) {
    let seed = Number.isFinite(seedInput) ? seedInput : Date.now();
    seed = Math.floor(Math.abs(seed)) >>> 0;
    if (seed === 0) {
        seed = 0x1a2b3c4d;
    }
    return () => {
        seed += 0x6d2b79f5;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function describeIterationContext(context) {
    if (!context) return '';
    const { iterationIndex, totalIterations } = context;
    if (Number.isInteger(iterationIndex) && Number.isInteger(totalIterations) && totalIterations > 1) {
        return `第 ${iterationIndex + 1}/${totalIterations} 次迭代 `;
    }
    if (Number.isInteger(iterationIndex)) {
        return `第 ${iterationIndex + 1} 次迭代 `;
    }
    return '';
}

function resolveIterationCount() {
    const input = document.getElementById('forecastIterationInput');
    if (!input) {
        return FORECAST_DEFAULT_ITERATIONS;
    }
    const parsed = Number.parseInt(input.value, 10);
    let iterations = Number.isFinite(parsed) ? parsed : FORECAST_DEFAULT_ITERATIONS;
    if (iterations < 1) iterations = 1;
    if (iterations > FORECAST_MAX_ITERATIONS) iterations = FORECAST_MAX_ITERATIONS;
    input.value = String(iterations);
    return iterations;
}

function chooseBetterForecastResult(currentBest, candidate) {
    if (!candidate) return currentBest || null;
    if (!currentBest) return candidate;
    const candidateHit = Number.isFinite(candidate.metrics?.hitRate) ? candidate.metrics.hitRate : -Infinity;
    const bestHit = Number.isFinite(currentBest.metrics?.hitRate) ? currentBest.metrics.hitRate : -Infinity;
    if (candidateHit > bestHit) return candidate;
    if (candidateHit < bestHit) return currentBest;
    const candidateMse = Number.isFinite(candidate.metrics?.mse) ? candidate.metrics.mse : Infinity;
    const bestMse = Number.isFinite(currentBest.metrics?.mse) ? currentBest.metrics.mse : Infinity;
    if (candidateMse < bestMse) return candidate;
    if (candidateMse > bestMse) return currentBest;
    const candidateDuration = Number.isFinite(candidate.durationMs) ? candidate.durationMs : Infinity;
    const bestDuration = Number.isFinite(currentBest.durationMs) ? currentBest.durationMs : Infinity;
    if (candidateDuration < bestDuration) return candidate;
    return currentBest;
}

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
    const seedText = Number.isFinite(correction.seed)
        ? ` ｜ 隨機種子 ${Math.round(correction.seed)}`
        : '';
    const mseText = Number.isFinite(correction.baselineTrainingMse) && Number.isFinite(correction.trainingMse)
        ? ` ｜ 訓練 MSE ${formatNumber(correction.baselineTrainingMse, 4)} → ${formatNumber(correction.trainingMse, 4)}`
        : '';
    const fitnessText = Number.isFinite(correction.fitness)
        ? ` ｜ 適應值 ${formatNumber(correction.fitness, 4)}`
        : '';
    return `校正閾值 δ = ${deltaText}% ｜ 訓練累積誤差 = ${carryText}${seedText}${mseText}${fitnessText}`;
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

function createLstmModel(sequenceLength, seed) {
    const baseSeed = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : Math.floor(Math.random() * 1e9);
    const kernelSeed = baseSeed || 1;
    const recurrentSeed = (kernelSeed + 1) % 0x7fffffff;
    const denseSeed = (kernelSeed + 2) % 0x7fffffff;
    const dropoutSeed = (kernelSeed + 3) % 0x7fffffff;
    const kernelInitializer = tf.initializers.glorotUniform({ seed: kernelSeed });
    const recurrentInitializer = tf.initializers.orthogonal({ seed: recurrentSeed });
    const denseInitializer = tf.initializers.glorotUniform({ seed: denseSeed });
    const biasInitializer = tf.initializers.zeros();

    const model = tf.sequential();
    model.add(tf.layers.lstm({
        units: 32,
        inputShape: [sequenceLength, 1],
        returnSequences: false,
        kernelInitializer,
        recurrentInitializer,
        biasInitializer,
    }));
    model.add(tf.layers.dropout({ rate: 0.1, seed: dropoutSeed }));
    model.add(tf.layers.dense({ units: 1, kernelInitializer: denseInitializer, biasInitializer }));
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

async function fitLstmModel(model, trainX, trainY, sampleCount, statusContext) {
    const epochs = Math.min(160, Math.max(60, Math.round(sampleCount * 1.2)));
    let batchSize = Math.max(8, Math.floor(sampleCount / 4));
    if (batchSize > 32) batchSize = 32;
    if (batchSize > sampleCount) batchSize = sampleCount;
    batchSize = Math.max(4, batchSize);

    const iterationLabel = describeIterationContext(statusContext);

    await model.fit(trainX, trainY, {
        epochs,
        batchSize,
        shuffle: false,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if ((epoch + 1) % 10 === 0) {
                    updateForecastStatus(`${iterationLabel}訓練模型中（${epoch + 1}/${epochs}） loss=${formatNumber(logs?.loss, 4)}`, 'info');
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

function runGeneticOptimization({ rawPreds, actuals, random }) {
    const populationSize = 30;
    const generations = 40;
    const mutationRate = 0.25;
    const mutationScale = 0.02;
    const minDelta = 0.0005;
    const maxDelta = 0.2;
    const rand = typeof random === 'function' ? random : Math.random;

    if (!Array.isArray(rawPreds) || rawPreds.length === 0 || !Array.isArray(actuals) || actuals.length !== rawPreds.length) {
        return { delta: 0, mse: NaN, fitness: 0 };
    }

    const randomDelta = () => minDelta + rand() * (maxDelta - minDelta);

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
        let selected = population[Math.floor(rand() * population.length)];
        for (let i = 1; i < tournamentSize; i += 1) {
            const challenger = population[Math.floor(rand() * population.length)];
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
            if (rand() < mutationRate) {
                childDelta += (rand() * 2 - 1) * mutationScale;
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

function updateForecastIterationSummary(history, bestResult, totalDurationMs) {
    const summaryEl = document.getElementById('forecastIterationSummary');
    if (!summaryEl) return;
    if (!Array.isArray(history) || history.length === 0 || !bestResult) {
        summaryEl.textContent = '尚未執行迭代預測。';
        summaryEl.style.color = 'var(--muted-foreground)';
        summaryEl.title = '';
        return;
    }
    const bestHit = formatRatio(bestResult.metrics?.hitRate);
    const bestMse = formatNumber(bestResult.metrics?.mse, 2);
    const bestSeed = Number.isFinite(bestResult.seed) ? Math.round(bestResult.seed) : '--';
    const totalSeconds = Number.isFinite(totalDurationMs) ? totalDurationMs / 1000 : NaN;
    const detailLines = history
        .map((item) => {
            const iter = Number.isInteger(item.iteration) ? item.iteration : history.indexOf(item) + 1;
            const seedLabel = Number.isFinite(item.seed) ? Math.round(item.seed) : '--';
            const hit = formatRatio(item.metrics?.hitRate);
            return `#${iter} 種子 ${seedLabel}：${hit}`;
        })
        .join(' ｜ ');
    const baseText = `共執行 ${history.length} 次迭代，最佳種子 ${bestSeed}（命中率 ${bestHit}、MSE ${bestMse}）。`;
    const durationText = Number.isFinite(totalSeconds) ? `總耗時 ${formatNumber(totalSeconds, 1)} 秒。` : '';
    summaryEl.textContent = `${baseText} ${durationText}`.trim();
    summaryEl.style.color = 'var(--muted-foreground)';
    summaryEl.title = detailLines;
}

function summariseForecastCompletion(result, context = {}) {
    const iterations = Number.isInteger(context.iterations) && context.iterations > 1 ? context.iterations : 1;
    const durationMs = Number.isFinite(context.totalDurationMs)
        ? context.totalDurationMs
        : Number.isFinite(result.durationMs)
            ? result.durationMs
            : 0;
    const durationSeconds = durationMs / 1000;
    const iterationText = iterations > 1 ? `（${iterations} 次迭代）` : '';
    const seedText = Number.isFinite(result.seed) ? `，最佳種子 ${Math.round(result.seed)}` : '';
    const summary = `完成預測${iterationText}：命中率 ${formatRatio(result.metrics.baselineHitRate)} → ${formatRatio(result.metrics.hitRate)}，MSE ${formatNumber(result.metrics.baselineMse, 2)} → ${formatNumber(result.metrics.mse, 2)}${seedText}，耗時 ${formatNumber(durationSeconds, 1)} 秒。`;
    updateForecastStatus(summary, 'success');
}

async function runForecastWorkflow(options = {}) {
    const { seed, random, rowsOverride, statusContext } = options;
    const iterationLabel = describeIterationContext(statusContext);
    await ensureTensorflowReady();
    if (typeof seed === 'number' && tf?.util?.setSeed) {
        tf.util.setSeed(seed);
    }
    const rows = Array.isArray(rowsOverride) ? rowsOverride : extractForecastRows();
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

    updateForecastStatus(`${iterationLabel}建立 LSTM 模型與訓練資料（序列長度 ${sequenceLength}）...`, 'info');
    const model = createLstmModel(sequenceLength, seed);
    await fitLstmModel(model, trainX, trainY, sampleCount, statusContext);

    const trainPredTensor = model.predict(trainX);
    const trainPredNormArray = Array.from(await trainPredTensor.data());
    trainPredTensor.dispose();

    trainX.dispose();
    trainY.dispose();

    const trainPredActuals = trainPredNormArray.map((value) => denormalizeValue(value, stats));
    const trainActuals = closes.slice(sequenceLength, trainCount);
    const baselineTrainingMse = computeMse(trainPredActuals, trainActuals);

    const seededRandom = typeof random === 'function' ? random : undefined;
    const gaResult = trainPredActuals.length >= 5
        ? runGeneticOptimization({ rawPreds: trainPredActuals, actuals: trainActuals, random: seededRandom })
        : { delta: 0, mse: NaN, fitness: 0 };

    const trainingCorrection = applyErrorCorrection({
        rawPreds: trainPredActuals,
        actuals: trainActuals,
        initialCumulativeError: 0,
        delta: gaResult.delta,
    });

    updateForecastStatus(`${iterationLabel}套用遺傳演算法校正參數並評估測試資料...`, 'info');
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

    model.dispose();

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
            seed,
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
        seed,
    };
}

async function handleForecastRequest(button) {
    const source = getSharedVisibleStockData();
    if (!Array.isArray(source) || source.length === 0) {
        updateForecastStatus('請先執行一次回測以取得股價資料。', 'warning');
        return;
    }
    const iterations = resolveIterationCount();
    button.disabled = true;
    button.style.opacity = '0.7';
    updateForecastStatus(`準備資料並載入 TensorFlow.js（預計 ${iterations} 次迭代）...`, 'info');
    try {
        const rows = extractForecastRows();
        const iterationHistory = [];
        let bestResult = null;
        const globalStart = performance.now();
        const baseSeed = Math.floor(Math.random() * 1e9) + 7;
        updateForecastIterationSummary([], null, NaN);
        for (let idx = 0; idx < iterations; idx += 1) {
            const iterationSeed = baseSeed + idx * 9773;
            const seededRandom = createSeededRandom(iterationSeed);
            const iterationStart = performance.now();
            const result = await runForecastWorkflow({
                seed: iterationSeed,
                random: seededRandom,
                rowsOverride: rows,
                statusContext: { iterationIndex: idx, totalIterations: iterations },
            });
            result.durationMs = performance.now() - iterationStart;
            result.seed = iterationSeed;
            result.iteration = idx + 1;
            iterationHistory.push(result);
            bestResult = chooseBetterForecastResult(bestResult, result);
        }
        const totalDuration = performance.now() - globalStart;
        if (!bestResult) {
            throw new Error('無法取得有效的預測結果。');
        }
        setForecastSamples(bestResult.trainSamples, bestResult.testSamples);
        updateForecastMetrics(bestResult);
        updateForecastIterationSummary(iterationHistory, bestResult, totalDuration);
        renderForecastChart(bestResult.chart);
        summariseForecastCompletion(bestResult, { iterations, totalDurationMs: totalDuration });
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
    const iterationInput = document.getElementById('forecastIterationInput');
    if (iterationInput) {
        iterationInput.value = String(FORECAST_DEFAULT_ITERATIONS);
        iterationInput.setAttribute('min', '1');
        iterationInput.setAttribute('max', String(FORECAST_MAX_ITERATIONS));
        iterationInput.addEventListener('change', () => {
            resolveIterationCount();
        });
    }
    if (getSharedVisibleStockData().length === 0) {
        updateForecastStatus('請先完成回測，再啟動預測模擬。', 'info');
    }
});
