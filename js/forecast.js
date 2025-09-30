const FORECAST_VERSION_CODE = 'LB-FORECAST-LSTMGA-20251219A';
const FORECAST_ITERATION_DEFAULT = 5;
const FORECAST_ITERATION_MIN = 1;
const FORECAST_ITERATION_MAX = 12;
let forecastChartInstance = null;
let lastForecastResult = null;
let lastForecastSeed = null;
let seedStorageSupportCache = null;
const FORECAST_SEED_STORAGE_KEY = 'lb-forecast-seeds-v1';

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

function clampIterationCount(value) {
    const numeric = Number.isFinite(value) ? Math.floor(value) : NaN;
    if (!Number.isFinite(numeric)) {
        return FORECAST_ITERATION_DEFAULT;
    }
    if (numeric < FORECAST_ITERATION_MIN) {
        return FORECAST_ITERATION_MIN;
    }
    if (numeric > FORECAST_ITERATION_MAX) {
        return FORECAST_ITERATION_MAX;
    }
    return numeric;
}

function resolveIterationCount() {
    const input = document.getElementById('forecastIterationCount');
    if (!input) {
        return FORECAST_ITERATION_DEFAULT;
    }
    const parsed = Number.parseInt(input.value, 10);
    const clamped = clampIterationCount(Number.isFinite(parsed) ? parsed : FORECAST_ITERATION_DEFAULT);
    input.value = clamped;
    return clamped;
}

function initialiseIterationControl() {
    const input = document.getElementById('forecastIterationCount');
    if (!input) return;
    const initialParsed = Number.parseInt(input.value, 10);
    input.value = clampIterationCount(Number.isFinite(initialParsed) ? initialParsed : FORECAST_ITERATION_DEFAULT);
    input.addEventListener('change', () => {
        const parsed = Number.parseInt(input.value, 10);
        input.value = clampIterationCount(Number.isFinite(parsed) ? parsed : FORECAST_ITERATION_DEFAULT);
    });
}

function generateSeedCandidates(count) {
    const seeds = [];
    const iterations = clampIterationCount(count);
    const base = Date.now().toString(36);
    const globalCrypto = typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
        ? globalThis.crypto
        : null;
    for (let idx = 0; idx < iterations; idx += 1) {
        if (globalCrypto) {
            const buffer = new Uint32Array(2);
            globalCrypto.getRandomValues(buffer);
            seeds.push(`${base}-${idx.toString(36)}-${buffer[0].toString(36)}${buffer[1].toString(36)}`);
        } else {
            const randomFallback = Math.floor(Math.random() * 0xfffffff);
            seeds.push(`${base}-${idx.toString(36)}-${randomFallback.toString(36)}`);
        }
    }
    return seeds;
}

function applySeedForForecast(seed) {
    if (seed === undefined || seed === null) return;
    const seedText = String(seed);
    if (typeof tf !== 'undefined' && tf.util && typeof tf.util.seedrandom === 'function') {
        tf.util.seedrandom(seedText);
        return;
    }
    if (typeof Math !== 'undefined' && typeof Math.seedrandom === 'function') {
        Math.seedrandom(seedText);
        return;
    }
    if (typeof seedrandom === 'function') {
        seedrandom(seedText);
    }
}

function hasSeedStorageSupport() {
    if (seedStorageSupportCache !== null) {
        return seedStorageSupportCache;
    }
    if (typeof window === 'undefined' || !window.localStorage) {
        seedStorageSupportCache = false;
        return seedStorageSupportCache;
    }
    try {
        const probeKey = '__lbForecastSeedProbe__';
        window.localStorage.setItem(probeKey, '1');
        window.localStorage.removeItem(probeKey);
        seedStorageSupportCache = true;
    } catch (error) {
        console.warn('[Forecast] Seed storage unavailable', error);
        seedStorageSupportCache = false;
    }
    return seedStorageSupportCache;
}

function readSeedStore() {
    if (!hasSeedStorageSupport()) {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(FORECAST_SEED_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch (error) {
        console.warn('[Forecast] Failed to parse seed storage', error);
    }
    return {};
}

function writeSeedStore(store) {
    if (!hasSeedStorageSupport()) {
        return false;
    }
    try {
        window.localStorage.setItem(FORECAST_SEED_STORAGE_KEY, JSON.stringify(store));
        return true;
    } catch (error) {
        console.warn('[Forecast] Failed to persist seed storage', error);
        return false;
    }
}

function resolveCurrentSeedKey() {
    if (typeof document === 'undefined') {
        return null;
    }
    const stockInput = document.getElementById('stockNo');
    const marketSelect = document.getElementById('marketSelect');
    const stockText = stockInput?.value ? stockInput.value.toString().trim().toUpperCase() : '';
    if (!stockText) {
        return null;
    }
    const marketText = marketSelect?.value ? marketSelect.value.toString().trim().toUpperCase() : 'TWSE';
    return `${marketText}|${stockText}`;
}

function loadStoredSeedForCurrentStock() {
    const key = resolveCurrentSeedKey();
    if (!key) {
        return null;
    }
    const store = readSeedStore();
    const entry = store[key];
    if (!entry || !entry.seed) {
        return null;
    }
    return {
        seed: String(entry.seed),
        savedAt: entry.savedAt || null,
    };
}

function saveSeedForCurrentStock(seed) {
    if (!seed) {
        return null;
    }
    const key = resolveCurrentSeedKey();
    if (!key) {
        return null;
    }
    const store = readSeedStore();
    const entry = {
        seed: String(seed),
        savedAt: new Date().toISOString(),
    };
    store[key] = entry;
    const success = writeSeedStore(store);
    return success ? entry : null;
}

function updateSeedStorageStatus(message, type = 'info') {
    const statusEl = document.getElementById('forecastSeedStorageStatus');
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

function refreshSeedInputPlaceholder(storedEntry) {
    const input = document.getElementById('forecastSeedInput');
    if (!input) return;
    if (input.value && input.value.trim()) {
        return;
    }
    if (storedEntry && storedEntry.seed) {
        input.placeholder = `已儲存：${storedEntry.seed}`;
    } else {
        input.placeholder = '輸入或貼上隨機種子';
    }
}

function handleSeedContextChange() {
    const stored = loadStoredSeedForCurrentStock();
    refreshSeedInputPlaceholder(stored);
    if (stored) {
        updateSeedStorageStatus(`已儲存種子 ${stored.seed}${stored.savedAt ? `（${formatTimestamp(stored.savedAt)}）` : ''}。`, 'info');
    } else if (hasSeedStorageSupport()) {
        updateSeedStorageStatus('尚未為此標的儲存種子。', 'info');
    } else {
        updateSeedStorageStatus('瀏覽器不支援本地儲存，無法保存種子。', 'warning');
    }
}

function handleSeedSaveRequest() {
    const input = document.getElementById('forecastSeedInput');
    const manualSeed = input?.value ? input.value.toString().trim() : '';
    const seedToSave = manualSeed || lastForecastSeed;
    if (!seedToSave) {
        updateSeedStorageStatus('請先輸入種子或完成預測取得最佳種子。', 'warning');
        return;
    }
    const entry = saveSeedForCurrentStock(seedToSave);
    if (!entry) {
        updateSeedStorageStatus('儲存種子失敗，請確認瀏覽器是否允許本地儲存。', 'error');
        return;
    }
    if (input) {
        input.value = seedToSave;
    }
    refreshSeedInputPlaceholder(entry);
    updateSeedStorageStatus(`已儲存種子 ${entry.seed}（${formatTimestamp(entry.savedAt)}）。`, 'success');
}

function handleSeedLoadRequest() {
    const stored = loadStoredSeedForCurrentStock();
    if (!stored) {
        updateSeedStorageStatus('目前沒有儲存的種子可載入。', hasSeedStorageSupport() ? 'warning' : 'error');
        return;
    }
    const input = document.getElementById('forecastSeedInput');
    if (input) {
        input.value = stored.seed;
        const changeEvent = new Event('change');
        input.dispatchEvent(changeEvent);
    }
    refreshSeedInputPlaceholder(stored);
    lastForecastSeed = stored.seed;
    updateSeedStorageStatus(`已載入儲存種子 ${stored.seed}。`, 'success');
}

function initialiseSeedControls() {
    const saveBtn = document.getElementById('forecastSeedSaveBtn');
    const loadBtn = document.getElementById('forecastSeedLoadBtn');
    const input = document.getElementById('forecastSeedInput');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSeedSaveRequest);
    }
    if (loadBtn) {
        loadBtn.addEventListener('click', handleSeedLoadRequest);
    }
    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSeedSaveRequest();
            }
        });
    }
    const stockInput = document.getElementById('stockNo');
    if (stockInput) {
        stockInput.addEventListener('change', handleSeedContextChange);
        stockInput.addEventListener('input', () => {
            // 於輸入過程不頻繁重設狀態，僅在欄位清空時同步更新提示
            if (!stockInput.value || !stockInput.value.trim()) {
                handleSeedContextChange();
            }
        });
    }
    const marketSelect = document.getElementById('marketSelect');
    if (marketSelect) {
        marketSelect.addEventListener('change', handleSeedContextChange);
    }
    handleSeedContextChange();
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

function formatTimestamp(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
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

function resolveHighValue(row) {
    const candidates = [
        row?.high,
        row?.High,
        row?.adjustedHigh,
        row?.adjHigh,
        row?.rawHigh,
        row?.max,
        row?.highest,
        row?.dayHigh,
    ];
    for (const candidate of candidates) {
        const numeric = typeof candidate === 'string' ? Number(candidate) : candidate;
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    return null;
}

function resolveLowValue(row) {
    const candidates = [
        row?.low,
        row?.Low,
        row?.adjustedLow,
        row?.adjLow,
        row?.rawLow,
        row?.min,
        row?.lowest,
        row?.dayLow,
    ];
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
        const highValue = resolveHighValue(row);
        const lowValue = resolveLowValue(row);
        const dateObj = new Date(dateText);
        if (Number.isNaN(dateObj.getTime())) return;
        const iso = dateObj.toISOString().slice(0, 10);
        const entry = {
            date: iso,
            close: closeValue,
        };
        if (Number.isFinite(highValue)) {
            entry.high = highValue;
        }
        if (Number.isFinite(lowValue)) {
            entry.low = lowValue;
        }
        dedup.set(iso, entry);
    });
    const sorted = Array.from(dedup.values())
        .map((entry) => ({ ...entry }))
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

function prepareForecastDataset() {
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
    const trainSamples = Math.max(0, trainCount - sequenceLength);
    const testSamples = Math.max(0, closes.length - trainCount);

    return {
        rows,
        closes,
        sequenceLength,
        trainCount,
        stats,
        normalizedSeries,
        trainSamples,
        testSamples,
    };
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

async function fitLstmModel(model, trainX, trainY, sampleCount, iterationLabel = '') {
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
                    const prefix = iterationLabel ? `[${iterationLabel}] ` : '';
                    updateForecastStatus(`${prefix}訓練模型中（${epoch + 1}/${epochs}） loss=${formatNumber(logs?.loss, 4)}`, 'info');
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

function selectBetterForecastResult(currentBest, candidate) {
    if (!candidate) return currentBest;
    if (!currentBest) return candidate;

    const candidateHit = candidate?.metrics?.hitRate;
    const currentHit = currentBest?.metrics?.hitRate;

    if (Number.isFinite(candidateHit) && Number.isFinite(currentHit)) {
        const delta = candidateHit - currentHit;
        if (delta > 1e-6) {
            return candidate;
        }
        if (delta < -1e-6) {
            return currentBest;
        }

        const candidateMse = candidate?.metrics?.mse;
        const currentMse = currentBest?.metrics?.mse;
        if (Number.isFinite(candidateMse) && Number.isFinite(currentMse)) {
            if (candidateMse + 1e-6 < currentMse) {
                return candidate;
            }
            if (candidateMse - 1e-6 > currentMse) {
                return currentBest;
            }
        }

        const candidateFitness = candidate?.correction?.fitness;
        const currentFitness = currentBest?.correction?.fitness;
        if (Number.isFinite(candidateFitness) && Number.isFinite(currentFitness) && candidateFitness > currentFitness) {
            return candidate;
        }

        return currentBest;
    }

    if (Number.isFinite(candidateHit)) {
        return candidate;
    }

    if (!Number.isFinite(currentHit) && Number.isFinite(candidate?.metrics?.mse)) {
        if (!Number.isFinite(currentBest?.metrics?.mse) || candidate.metrics.mse < currentBest.metrics.mse) {
            return candidate;
        }
    }

    return currentBest;
}

function computeDirectionMetrics(predicted, actuals, rows, startIndex) {
    const emptyResult = {
        hitRate: NaN,
        avgGain: NaN,
        avgLoss: NaN,
        totalReturn: NaN,
        tradeCount: 0,
        trades: [],
        finalEquity: 1,
    };
    if (!Array.isArray(predicted) || !Array.isArray(actuals) || predicted.length === 0) {
        return emptyResult;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return emptyResult;
    }

    const gains = [];
    const losses = [];
    const trades = [];
    let hits = 0;
    let tradeCount = 0;
    let equity = 1;

    const sampleLength = Math.min(predicted.length, actuals.length);

    for (let idx = 0; idx < sampleLength; idx += 1) {
        const dataIndex = startIndex + idx;
        const prevRow = rows[dataIndex - 1];
        const currentRow = rows[dataIndex];
        if (!prevRow || !currentRow) {
            continue;
        }

        const prevClose = Number(prevRow?.close);
        const nextClose = Number(currentRow?.close);
        const nextLow = Number(currentRow?.low);
        const nextHigh = Number(currentRow?.high);
        const predictedClose = Number(predicted[idx]);

        if (
            !Number.isFinite(prevClose)
            || !Number.isFinite(nextClose)
            || !Number.isFinite(predictedClose)
            || !Number.isFinite(nextLow)
        ) {
            continue;
        }

        if (prevClose <= 0) {
            continue;
        }

        if (predictedClose <= prevClose) {
            continue;
        }

        if (nextLow > prevClose) {
            continue;
        }

        const tradeReturn = (nextClose - prevClose) / prevClose;
        if (!Number.isFinite(tradeReturn)) {
            continue;
        }

        equity *= 1 + tradeReturn;
        tradeCount += 1;

        const tradePercent = tradeReturn * 100;
        if (tradeReturn >= 0) {
            hits += 1;
            gains.push(tradePercent);
        } else {
            losses.push(tradePercent);
        }

        trades.push({
            entryDate: prevRow?.date || null,
            executionDate: currentRow?.date || null,
            entryPrice: prevClose,
            exitPrice: nextClose,
            intradayLow: Number.isFinite(nextLow) ? nextLow : null,
            intradayHigh: Number.isFinite(nextHigh) ? nextHigh : null,
            returnPercent: tradePercent,
        });
    }

    const avgGain = gains.length > 0 ? gains.reduce((sum, v) => sum + v, 0) / gains.length : NaN;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, v) => sum + v, 0) / losses.length : NaN;
    const hitRate = tradeCount > 0 ? hits / tradeCount : NaN;
    const totalReturn = tradeCount > 0 ? (equity - 1) * 100 : NaN;

    return {
        hitRate,
        avgGain,
        avgLoss,
        totalReturn,
        tradeCount,
        trades,
        finalEquity: equity,
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
    const totalReturnEl = document.getElementById('forecastTotalReturn');
    const tradeCountEl = document.getElementById('forecastTradeCount');
    const mseEl = document.getElementById('forecastMse');
    const rmseEl = document.getElementById('forecastRmse');
    const maeEl = document.getElementById('forecastMae');
    const correctionEl = document.getElementById('forecastCorrection');

    if (hitRateEl) hitRateEl.textContent = formatRatio(metrics.hitRate);
    if (gainEl) gainEl.textContent = formatChange(metrics.avgGain);
    if (lossEl) lossEl.textContent = formatChange(metrics.avgLoss);
    if (totalReturnEl) totalReturnEl.textContent = formatChange(metrics.totalReturn);
    if (tradeCountEl) {
        if (Number.isFinite(metrics.tradeCount) && metrics.tradeCount > 0) {
            const finalEquityText = Number.isFinite(metrics.finalEquity)
                ? `，最終資金 ${formatNumber(metrics.finalEquity, 3)} 倍`
                : '';
            tradeCountEl.textContent = `共執行 ${metrics.tradeCount} 筆交易${finalEquityText}`;
        } else {
            tradeCountEl.textContent = '尚未產生交易';
        }
    }
    if (mseEl) mseEl.textContent = `${formatNumber(metrics.mse, 2)} （基準 ${formatNumber(metrics.baselineMse, 2)}）`;
    if (rmseEl) rmseEl.textContent = `${formatNumber(metrics.rmse, 2)} （基準 ${formatNumber(metrics.baselineRmse, 2)}）`;
    if (maeEl) maeEl.textContent = `${formatNumber(metrics.mae, 2)} （基準 ${formatNumber(metrics.baselineMae, 2)}）`;
    if (correctionEl) correctionEl.textContent = describeCorrection(result.correction);
    updateForecastSeedSummary(result);
    renderForecastTradeLog(metrics?.trades);
}

function updateForecastSeedSummary(result) {
    const seedEl = document.getElementById('forecastSeedSummary');
    if (!seedEl) return;
    if (!result || !result.seed) {
        seedEl.textContent = '尚未探索隨機種子。';
        seedEl.style.color = 'var(--muted-foreground)';
        return;
    }
    const iterationCount = Number.isFinite(result.iterationCount) ? result.iterationCount : 1;
    const iterationIndex = Number.isFinite(result.iterationIndex) ? result.iterationIndex : 0;
    const iterationText = iterationCount > 1
        ? `最佳結果為第 ${iterationIndex + 1}/${iterationCount} 次迭代`
        : '單次迭代結果';
    const hitRateText = formatRatio(result.metrics?.hitRate);
    seedEl.textContent = `${iterationText}，隨機種子 ${result.seed}（命中率 ${hitRateText}）。`;
    seedEl.style.color = 'var(--muted-foreground)';
}

function renderForecastTradeLog(trades) {
    const container = document.getElementById('forecastTradeLog');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(trades) || trades.length === 0) {
        container.textContent = '尚未產生交易';
        container.style.color = 'var(--muted-foreground)';
        return;
    }
    container.style.color = 'var(--foreground)';
    const fragment = document.createDocumentFragment();
    const recentTrades = trades.slice(-12);
    recentTrades.forEach((trade) => {
        const row = document.createElement('div');
        row.className = 'flex flex-wrap justify-between gap-2 py-1 border-b border-dashed last:border-b-0';
        row.style.borderColor = 'var(--border)';

        const title = document.createElement('div');
        title.className = 'text-[11px] font-medium';
        const percentText = formatChange(trade?.returnPercent);
        title.textContent = `${trade?.executionDate || '--'} ｜ 報酬 ${percentText}`;
        if (Number.isFinite(trade?.returnPercent) && trade.returnPercent < 0) {
            title.style.color = '#b91c1c';
        } else if (Number.isFinite(trade?.returnPercent)) {
            title.style.color = '#047857';
        } else {
            title.style.color = 'var(--foreground)';
        }

        const detail = document.createElement('div');
        detail.className = 'text-[11px]';
        detail.style.color = 'var(--muted-foreground)';
        const entryPriceText = formatNumber(trade?.entryPrice, 2);
        const exitPriceText = formatNumber(trade?.exitPrice, 2);
        detail.textContent = `前日收盤 ${entryPriceText} → 隔日收盤 ${exitPriceText}`;

        row.appendChild(title);
        row.appendChild(detail);
        fragment.appendChild(row);
    });
    container.appendChild(fragment);
    if (trades.length > recentTrades.length) {
        const hint = document.createElement('div');
        hint.className = 'text-[10px] mt-1';
        hint.style.color = 'var(--muted-foreground)';
        hint.textContent = `僅顯示最近 ${recentTrades.length} 筆，共 ${trades.length} 筆。`;
        container.appendChild(hint);
    }
}

function summariseForecastCompletion(result, { iterationCount = 1, iterationIndex = 0, seed, durationMs } = {}) {
    const effectiveDuration = Number.isFinite(durationMs)
        ? durationMs
        : (Number.isFinite(result?.durationMs) ? result.durationMs : 0);
    const durationSeconds = Number.isFinite(effectiveDuration) ? effectiveDuration / 1000 : 0;
    const seedText = seed || result?.seed || '--';
    const iterationText = iterationCount > 1
        ? `最佳迭代第 ${iterationIndex + 1}/${iterationCount} 次（種子 ${seedText}）`
        : `隨機種子 ${seedText}`;
    const baselineReturnText = formatChange(result.metrics?.baselineTotalReturn);
    const totalReturnText = formatChange(result.metrics?.totalReturn);
    const tradeCountText = Number.isFinite(result.metrics?.tradeCount) && result.metrics.tradeCount > 0
        ? `${result.metrics.tradeCount} 筆交易`
        : '無交易';
    const summary = `完成預測：${iterationText}，命中率 ${formatRatio(result.metrics.baselineHitRate)} → ${formatRatio(result.metrics.hitRate)}，總報酬率 ${baselineReturnText} → ${totalReturnText}（${tradeCountText}），MSE ${formatNumber(result.metrics.baselineMse, 2)} → ${formatNumber(result.metrics.mse, 2)}，耗時 ${formatNumber(durationSeconds, 1)} 秒。`;
    updateForecastStatus(summary, 'success');
}

async function runForecastIteration(dataset, { seed, iterationLabel } = {}) {
    if (!dataset) {
        throw new Error('缺少預測資料集。');
    }
    applySeedForForecast(seed);

    const {
        normalizedSeries,
        sequenceLength,
        trainCount,
        closes,
        stats,
        rows,
    } = dataset;

    const { trainX, trainY, sampleCount } = buildTrainingTensors(normalizedSeries, sequenceLength, trainCount);
    const model = createLstmModel(sequenceLength);

    const label = seed ? `${iterationLabel || '預測'}｜種子 ${seed}` : iterationLabel;
    await fitLstmModel(model, trainX, trainY, sampleCount, label);

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

    const testResult = await predictSequential(
        model,
        normalizedSeries,
        closes,
        trainCount,
        sequenceLength,
        stats,
        rows,
    );
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
        rows,
        trainCount,
    );

    const baselineDirection = computeDirectionMetrics(
        testResult.predicted,
        testResult.actuals,
        rows,
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
        seed,
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
            totalReturn: directionMetrics.totalReturn,
            tradeCount: directionMetrics.tradeCount,
            finalEquity: directionMetrics.finalEquity,
            trades: directionMetrics.trades,
            mse,
            rmse,
            mae,
            baselineRmse,
            baselineMae,
            baselineMse,
            baselineHitRate: baselineDirection.hitRate,
            baselineTotalReturn: baselineDirection.totalReturn,
            baselineTradeCount: baselineDirection.tradeCount,
            baselineFinalEquity: baselineDirection.finalEquity,
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
        await ensureTensorflowReady();
        const dataset = prepareForecastDataset();
        setForecastSamples(dataset.trainSamples, dataset.testSamples);
        const iterationCount = resolveIterationCount();
        const seedInput = document.getElementById('forecastSeedInput');
        const manualSeed = seedInput?.value ? seedInput.value.toString().trim() : '';
        const seeds = manualSeed ? [manualSeed] : generateSeedCandidates(iterationCount);
        const usingManualSeed = Boolean(manualSeed);

        let bestResult = null;
        const overallStart = performance.now();

        for (let idx = 0; idx < seeds.length; idx += 1) {
            const seed = seeds[idx];
            const iterationLabel = seeds.length > 1
                ? `第 ${idx + 1}/${seeds.length} 次`
                : (usingManualSeed ? '指定種子' : '單次');
            updateForecastStatus(`啟動${iterationLabel}預測（種子 ${seed}）...`, 'info');

            const iterationStart = performance.now();
            const result = await runForecastIteration(dataset, { seed, iterationLabel });
            result.durationMs = performance.now() - iterationStart;
            result.seed = seed;
            result.iterationIndex = idx;
            result.iterationCount = seeds.length;

            bestResult = selectBetterForecastResult(bestResult, result);

            if (seeds.length > 1) {
                const bestHitRate = bestResult?.metrics?.hitRate;
                updateForecastStatus(
                    `完成${iterationLabel}預測：命中率 ${formatRatio(result.metrics.hitRate)}，目前最佳 ${formatRatio(bestHitRate)}（種子 ${bestResult?.seed || '--'}）。`,
                    'info',
                );
            }
        }

        if (!bestResult) {
            throw new Error('無法取得有效的預測結果。');
        }

        const totalDuration = performance.now() - overallStart;
        updateForecastMetrics(bestResult);
        renderForecastChart(bestResult.chart);
        summariseForecastCompletion(bestResult, {
            iterationCount: seeds.length,
            iterationIndex: bestResult.iterationIndex,
            seed: bestResult.seed,
            durationMs: totalDuration,
        });
        lastForecastResult = bestResult;
        lastForecastSeed = bestResult.seed || null;
        const storedSeed = loadStoredSeedForCurrentStock();
        refreshSeedInputPlaceholder(storedSeed);
        if (bestResult.seed) {
            if (storedSeed && storedSeed.seed === bestResult.seed) {
                updateSeedStorageStatus(`已套用儲存種子 ${bestResult.seed}（${storedSeed.savedAt ? formatTimestamp(storedSeed.savedAt) : '未記錄時間'}）。`, 'success');
            } else {
                updateSeedStorageStatus(`最佳結果使用種子 ${bestResult.seed}，可點「儲存種子」保留紀錄。`, 'info');
            }
        }
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
    initialiseIterationControl();
    initialiseSeedControls();
    const runBtn = document.getElementById('runForecastBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => handleForecastRequest(runBtn));
    }
    if (getSharedVisibleStockData().length === 0) {
        updateForecastStatus('請先完成回測，再啟動預測模擬。', 'info');
    }
});
