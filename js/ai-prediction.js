/* global document, window, workerUrl */

// Patch Tag: LB-AI-ANN-20260108A — Stabilise ANN training weight snapshots and replay validation.
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-ANN-20260108A';
    const SEED_STORAGE_KEY = 'lazybacktest-ai-seeds-v1';
    const MODEL_TYPES = {
        LSTM: 'lstm',
        ANNS: 'anns',
    };
    const MODEL_LABELS = {
        [MODEL_TYPES.LSTM]: 'LSTM 長短期記憶網路',
        [MODEL_TYPES.ANNS]: 'ANNS 技術指標感知器',
    };
    const DEFAULT_MODEL = MODEL_TYPES.ANNS;
    const formatModelLabel = (modelType) => MODEL_LABELS[modelType] || 'AI 模型';
    const createModelState = () => ({
        lastSummary: null,
        odds: 1,
        predictionsPayload: null,
        trainingMetrics: null,
        currentTrades: [],
        lastSeedDefault: '',
        winThreshold: 0.5,
        kellyEnabled: false,
        fixedFraction: 0.2,
        hyperparameters: {
            lookback: 20,
            epochs: 80,
            batchSize: 64,
            learningRate: 0.005,
            trainRatio: 0.8,
        },
    });
    const globalState = {
        running: false,
        activeModel: DEFAULT_MODEL,
        models: {
            [MODEL_TYPES.LSTM]: createModelState(),
            [MODEL_TYPES.ANNS]: createModelState(),
        },
    };
    const getModelState = (model) => {
        const resolved = model && globalState.models[model] ? model : DEFAULT_MODEL;
        return globalState.models[resolved];
    };
    const getActiveModelState = () => getModelState(globalState.activeModel);

    let aiWorker = null;
    let aiWorkerSequence = 0;
    const aiWorkerRequests = new Map();

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        modelType: null,
        trainRatio: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
        winThreshold: null,
        optimizeThreshold: null,
        trainRatioBadge: null,
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
        nextDayForecast: null,
        seedName: null,
        saveSeedButton: null,
        savedSeedList: null,
        loadSeedButton: null,
        deleteSeedButton: null,
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

    const loadStoredSeeds = () => {
        if (typeof window === 'undefined' || !window.localStorage) return [];
        try {
            const raw = window.localStorage.getItem(SEED_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((seed) => {
                    if (!seed || typeof seed !== 'object') return null;
                    const normalizedModel = Object.values(MODEL_TYPES).includes(seed.modelType)
                        ? seed.modelType
                        : DEFAULT_MODEL;
                    const normalizedSummary = seed.summary && typeof seed.summary === 'object'
                        ? {
                            threshold: Number.isFinite(seed.summary.threshold) ? seed.summary.threshold : 0.5,
                            usingKelly: Boolean(seed.summary.usingKelly),
                            fixedFraction: Number.isFinite(seed.summary.fixedFraction)
                                ? sanitizeFraction(seed.summary.fixedFraction)
                                : sanitizeFraction(0.2),
                        }
                        : {
                            threshold: 0.5,
                            usingKelly: false,
                            fixedFraction: sanitizeFraction(0.2),
                        };
                    const normalizedPayload = seed.payload && typeof seed.payload === 'object'
                        ? {
                            predictions: Array.isArray(seed.payload.predictions) ? seed.payload.predictions : [],
                            meta: Array.isArray(seed.payload.meta) ? seed.payload.meta : [],
                            returns: Array.isArray(seed.payload.returns) ? seed.payload.returns : [],
                            trainingOdds: Number.isFinite(seed.payload.trainingOdds) ? seed.payload.trainingOdds : NaN,
                            forecast: normalizeSeedForecast(seed.payload.forecast),
                            datasetLastDate: typeof seed.payload.datasetLastDate === 'string'
                                ? seed.payload.datasetLastDate
                                : null,
                            hyperparameters: seed.payload.hyperparameters || null,
                            datasetRows: normalizeAnnDatasetRows(seed.payload.datasetRows),
                            standardization: seed.payload.standardization && typeof seed.payload.standardization === 'object'
                                ? {
                                    mean: Array.isArray(seed.payload.standardization.mean)
                                        ? seed.payload.standardization.mean
                                            .map((value) => Number(value))
                                            .filter((value) => Number.isFinite(value))
                                        : [],
                                    std: Array.isArray(seed.payload.standardization.std)
                                        ? seed.payload.standardization.std
                                            .map((value) => Number(value))
                                            .filter((value) => Number.isFinite(value))
                                        : [],
                                }
                                : { mean: [], std: [] },
                            trainWindow: seed.payload.trainWindow && typeof seed.payload.trainWindow === 'object'
                                ? {
                                    trainCount: Number.isFinite(seed.payload.trainWindow.trainCount)
                                        ? Math.max(1, Math.floor(seed.payload.trainWindow.trainCount))
                                        : null,
                                    totalCount: Number.isFinite(seed.payload.trainWindow.totalCount)
                                        ? Math.max(0, Math.floor(seed.payload.trainWindow.totalCount))
                                        : null,
                                }
                                : { trainCount: null, totalCount: null },
                            weightSnapshot: seed.payload.weightSnapshot && typeof seed.payload.weightSnapshot === 'object'
                                && typeof seed.payload.weightSnapshot.data === 'string'
                                ? {
                                    data: seed.payload.weightSnapshot.data,
                                    specs: Array.isArray(seed.payload.weightSnapshot.specs)
                                        ? seed.payload.weightSnapshot.specs
                                        : [],
                                }
                                : null,
                        }
                        : {
                            predictions: [],
                            meta: [],
                            returns: [],
                            trainingOdds: NaN,
                            forecast: null,
                            datasetLastDate: null,
                            hyperparameters: null,
                            datasetRows: [],
                            standardization: { mean: [], std: [] },
                            trainWindow: { trainCount: null, totalCount: null },
                            weightSnapshot: null,
                        };
                    const evaluation = seed.evaluation && typeof seed.evaluation === 'object'
                        ? {
                            summary: normalizeSeedSummary(seed.evaluation.summary),
                            trades: normalizeSeedTrades(seed.evaluation.trades),
                        }
                        : { summary: null, trades: [] };
                    return {
                        ...seed,
                        modelType: normalizedModel,
                        summary: normalizedSummary,
                        payload: normalizedPayload,
                        evaluation,
                    };
                })
                .filter(Boolean);
        } catch (error) {
            console.warn('[AI Prediction] 無法讀取本地種子：', error);
            return [];
        }
    };

    const persistSeeds = (seeds) => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(seeds));
        } catch (error) {
            console.warn('[AI Prediction] 無法儲存本地種子：', error);
        }
    };

    const escapeHTML = (value) => {
        if (typeof value !== 'string') return '';
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const formatPercent = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    };

    const formatNumber = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    };

    const getTaipeiTodayIso = () => {
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Taipei',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            return formatter.format(new Date());
        } catch (error) {
            const now = new Date();
            const offset = now.getTimezoneOffset();
            const taipeiOffsetMinutes = -480;
            const diffMs = (taipeiOffsetMinutes - offset) * 60 * 1000;
            const taipeiTime = new Date(now.getTime() + diffMs);
            const year = taipeiTime.getUTCFullYear();
            const month = String(taipeiTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(taipeiTime.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };

    const formatRocDateToIso = (value) => {
        if (typeof value !== 'string' || !value) return null;
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const rocMatch = trimmed.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
        if (!rocMatch) return null;
        const [, rocYearStr, monthStr, dayStr] = rocMatch;
        const year = Number.parseInt(rocYearStr, 10) + 1911;
        const month = String(Number.parseInt(monthStr, 10)).padStart(2, '0');
        const day = String(Number.parseInt(dayStr, 10)).padStart(2, '0');
        if (!Number.isFinite(year)) return null;
        return `${year}-${month}-${day}`;
    };

    const parseNumericText = (value) => {
        if (value === null || value === undefined) return NaN;
        const text = typeof value === 'string' ? value.replace(/,/g, '') : String(value);
        const num = Number(text);
        return Number.isFinite(num) ? num : NaN;
    };

    const getLastFetchSettings = () => {
        const bridge = ensureBridge();
        if (!bridge || typeof bridge.getLastFetchSettings !== 'function') return null;
        try {
            const settings = bridge.getLastFetchSettings();
            if (!settings || typeof settings !== 'object') return null;
            return { ...settings };
        } catch (error) {
            console.warn('[AI Prediction] 讀取最近抓取設定失敗：', error);
            return null;
        }
    };

    const resolveAnnContext = () => {
        const settings = getLastFetchSettings();
        if (!settings) return null;
        const stockNo = typeof settings.stockNo === 'string' && settings.stockNo ? settings.stockNo : null;
        const market = typeof settings.market === 'string' && settings.market ? settings.market.toUpperCase() : null;
        if (!stockNo || !market) return null;
        return {
            stockNo,
            market,
            adjusted: Boolean(settings.adjustedPrice),
            startDate: typeof settings.dataStartDate === 'string' ? settings.dataStartDate : null,
        };
    };

    const normalizeAnnDatasetRows = (rows) => {
        if (!Array.isArray(rows)) return [];
        return rows
            .map((row) => {
                if (!row || typeof row !== 'object') return null;
                const date = typeof row.date === 'string' ? row.date : null;
                const close = Number(row.close);
                const high = Number(row.high);
                const low = Number(row.low);
                if (!date || !Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
                return { date, close, high, low };
            })
            .filter(Boolean)
            .sort((a, b) => a.date.localeCompare(b.date));
    };

    const mergeAnnDatasetRows = (baseRows, newRows) => {
        const merged = new Map();
        normalizeAnnDatasetRows(baseRows).forEach((row) => {
            merged.set(row.date, row);
        });
        normalizeAnnDatasetRows(newRows).forEach((row) => {
            merged.set(row.date, row);
        });
        return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    const getLastDateFromRows = (rows) => {
        const normalised = normalizeAnnDatasetRows(rows);
        if (normalised.length === 0) return null;
        return normalised[normalised.length - 1].date;
    };

    const createAnnReplayBaseSnapshot = (payload, modelState) => ({
        weightSnapshot: payload.weightSnapshot,
        standardization: payload.standardization,
        trainWindow: payload.trainWindow,
        hyperparameters: payload.hyperparameters,
        trainingMetrics: modelState.trainingMetrics,
        trainingOdds: Number.isFinite(payload.trainingOdds) ? payload.trainingOdds : modelState.odds,
    });

    const runAnnReplayWithRows = async ({
        rows,
        payload,
        modelState,
        baseSnapshot,
        previousPredictions,
        successMessage,
    }) => {
        if (!Array.isArray(rows) || rows.length < 60) {
            throw new Error('資料不足，請延長資料範圍後再回放 ANN 種子。');
        }
        const workerResult = await sendAIWorkerTrainingTask('ai-replay-ann', {
            rows,
            baseSnapshot,
            hyperparameters: payload.hyperparameters,
            trainingMetrics: modelState.trainingMetrics,
            trainingOdds: Number.isFinite(payload.trainingOdds) ? payload.trainingOdds : modelState.odds,
        }, { modelType: MODEL_TYPES.ANNS });
        const predictionsPayload = workerResult?.predictionsPayload;
        if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
            throw new Error('AI Worker 未回傳有效的回放結果。');
        }
        if (!predictionsPayload.weightSnapshot && payload.weightSnapshot) {
            predictionsPayload.weightSnapshot = payload.weightSnapshot;
        }
        if (!predictionsPayload.standardization) {
            predictionsPayload.standardization = payload.standardization;
        }
        if (!predictionsPayload.trainWindow) {
            predictionsPayload.trainWindow = payload.trainWindow;
        }
        if (!Number.isFinite(predictionsPayload.trainingOdds) && Number.isFinite(payload.trainingOdds)) {
            predictionsPayload.trainingOdds = payload.trainingOdds;
        }
        predictionsPayload.hyperparameters = payload.hyperparameters ? { ...payload.hyperparameters } : null;
        predictionsPayload.datasetRows = normalizeAnnDatasetRows(rows);
        const metrics = workerResult?.trainingMetrics || modelState.trainingMetrics;
        if (metrics && typeof metrics === 'object') {
            modelState.trainingMetrics = metrics;
        }
        if (Array.isArray(previousPredictions) && previousPredictions.length > 0) {
            const mismatchIndex = previousPredictions.findIndex((value, index) => {
                const replayValue = predictionsPayload.predictions[index];
                if (!Number.isFinite(value) || !Number.isFinite(replayValue)) return false;
                return Math.abs(value - replayValue) > 1e-4;
            });
            if (mismatchIndex >= 0) {
                console.warn('[AI Prediction] ANN 回放結果與儲存種子略有差異，索引：', mismatchIndex);
            }
        }
        modelState.predictionsPayload = predictionsPayload;
        applyTradeEvaluation(MODEL_TYPES.ANNS, predictionsPayload, metrics, {
            threshold: modelState.winThreshold,
            useKelly: modelState.kellyEnabled,
            fixedFraction: modelState.fixedFraction,
        });
        if (successMessage) {
            showStatus(successMessage, 'success');
        }
    };

    const convertAaDataRowToDataset = (item) => {
        if (!Array.isArray(item)) return null;
        const iso = formatRocDateToIso(item[0]);
        if (!iso) return null;
        const open = parseNumericText(item[3]);
        const high = parseNumericText(item[4]);
        const low = parseNumericText(item[5]);
        const close = parseNumericText(item[6]);
        if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
        return {
            date: iso,
            open,
            high,
            low,
            close,
        };
    };

    const fetchAnnGapRows = async (context, startDate, endDate, lastKnownRow) => {
        if (!context || !context.stockNo || !context.market) return [];
        if (!startDate || !endDate || startDate >= endDate) return [];
        const params = new URLSearchParams({
            stockNo: context.stockNo,
            marketType: context.market,
            startDate,
            endDate,
        });
        const url = `/.netlify/functions/stock-range?${params.toString()}`;
        try {
            const response = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            const aaData = Array.isArray(payload?.aaData) ? payload.aaData : [];
            if (aaData.length === 0) return [];
            const converted = aaData.map(convertAaDataRowToDataset).filter(Boolean);
            if (converted.length === 0) return [];
            let scale = 1;
            if (context.adjusted && lastKnownRow && typeof lastKnownRow.date === 'string') {
                const overlap = converted.find((row) => row.date === lastKnownRow.date);
                if (overlap && Number.isFinite(overlap.close) && overlap.close > 0 && Number.isFinite(lastKnownRow.close)) {
                    scale = lastKnownRow.close / overlap.close;
                }
            }
            const scaled = converted.map((row) => ({
                date: row.date,
                close: Number.isFinite(row.close) ? row.close * scale : NaN,
                high: Number.isFinite(row.high) ? row.high * scale : NaN,
                low: Number.isFinite(row.low) ? row.low * scale : NaN,
            }));
            return normalizeAnnDatasetRows(scaled).filter((row) => row.date > startDate);
        } catch (error) {
            console.warn('[AI Prediction] 補抓 ANN 差距資料失敗：', error);
            return [];
        }
    };

    const cloneSeedValue = (value) => {
        if (value === null || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // 瀏覽器若不支援 structuredClone，改用 JSON 備援。
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            console.warn('[AI Prediction] 無法複製種子快照：', error);
            return value;
        }
    };

    const normalizeSeedForecast = (forecast) => {
        if (!forecast || typeof forecast !== 'object') return null;
        const normalized = {};
        const probability = Number(forecast.probability);
        if (Number.isFinite(probability)) {
            normalized.probability = Math.min(Math.max(probability, 0), 1);
        }
        const fractionValue = Number(forecast.fraction);
        if (Number.isFinite(fractionValue)) {
            normalized.fraction = Math.min(Math.max(fractionValue, 0), 1);
        }
        if (typeof forecast.basisDate === 'string' && forecast.basisDate) {
            normalized.basisDate = forecast.basisDate;
        }
        if (typeof forecast.referenceDate === 'string' && forecast.referenceDate) {
            normalized.referenceDate = forecast.referenceDate;
        }
        if (typeof forecast.displayDate === 'string' && forecast.displayDate) {
            normalized.displayDate = forecast.displayDate;
        }
        return Object.keys(normalized).length > 0 ? normalized : null;
    };

    const normalizeSeedSummary = (summary) => {
        if (!summary || typeof summary !== 'object') return null;
        const normalized = {
            version: typeof summary.version === 'string' ? summary.version : VERSION_TAG,
            trainAccuracy: Number.isFinite(summary.trainAccuracy) ? summary.trainAccuracy : NaN,
            trainLoss: Number.isFinite(summary.trainLoss) ? summary.trainLoss : NaN,
            testAccuracy: Number.isFinite(summary.testAccuracy) ? summary.testAccuracy : NaN,
            testLoss: Number.isFinite(summary.testLoss) ? summary.testLoss : NaN,
            totalPredictions: Number.isFinite(summary.totalPredictions) ? summary.totalPredictions : 0,
            executedTrades: Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0,
            hitRate: Number.isFinite(summary.hitRate) ? Math.min(Math.max(summary.hitRate, 0), 1) : NaN,
            tradeReturnMedian: Number.isFinite(summary.tradeReturnMedian) ? summary.tradeReturnMedian : NaN,
            tradeReturnAverage: Number.isFinite(summary.tradeReturnAverage) ? summary.tradeReturnAverage : NaN,
            tradeReturnStdDev: Number.isFinite(summary.tradeReturnStdDev) ? summary.tradeReturnStdDev : NaN,
            usingKelly: Boolean(summary.usingKelly),
            fixedFraction: Number.isFinite(summary.fixedFraction)
                ? sanitizeFraction(summary.fixedFraction)
                : sanitizeFraction(0.2),
            threshold: Number.isFinite(summary.threshold) ? summary.threshold : 0.5,
            datasetLastDate: typeof summary.datasetLastDate === 'string' ? summary.datasetLastDate : null,
            forecast: normalizeSeedForecast(summary.forecast),
        };
        return normalized;
    };

    const normalizeSeedTrades = (trades) => {
        if (!Array.isArray(trades)) return [];
        return trades
            .map((trade) => {
                if (!trade || typeof trade !== 'object') return null;
                const probability = Number(trade.probability);
                const actualReturn = Number(trade.actualReturn);
                const fraction = Number(trade.fraction);
                const tradeReturn = Number(trade.tradeReturn);
                return {
                    tradeDate: typeof trade.tradeDate === 'string' ? trade.tradeDate : null,
                    probability: Number.isFinite(probability) ? Math.min(Math.max(probability, 0), 1) : NaN,
                    actualReturn: Number.isFinite(actualReturn) ? actualReturn : NaN,
                    fraction: Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : NaN,
                    tradeReturn: Number.isFinite(tradeReturn) ? tradeReturn : NaN,
                    isForecast: Boolean(trade.isForecast),
                };
            })
            .filter(Boolean);
    };

    const computeMedian = (values) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    };

    const computeMean = (values) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sum = values.reduce((acc, value) => acc + value, 0);
        return sum / values.length;
    };

    const computeStd = (values, mean) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const base = Number.isFinite(mean) ? mean : computeMean(values);
        if (!Number.isFinite(base)) return NaN;
        const variance = values.reduce((acc, value) => acc + ((value - base) ** 2), 0) / values.length;
        return Math.sqrt(Math.max(variance, 0));
    };

    const computeNextTradingDate = (dateText) => {
        if (typeof dateText !== 'string' || !dateText) return null;
        const parts = dateText.split('-');
        if (parts.length !== 3) return null;
        const [yearText, monthText, dayText] = parts;
        const year = Number.parseInt(yearText, 10);
        const month = Number.parseInt(monthText, 10);
        const day = Number.parseInt(dayText, 10);
        if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (Number.isNaN(date.getTime())) return null;
        do {
            date.setUTCDate(date.getUTCDate() + 1);
        } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
        const nextYear = date.getUTCFullYear();
        const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
        const nextDay = String(date.getUTCDate()).padStart(2, '0');
        return `${nextYear}-${nextMonth}-${nextDay}`;
    };

    const sanitizeFraction = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0.01;
        return Math.min(Math.max(num, 0.01), 1);
    };

    const updateTrainRatioBadge = (ratio) => {
        if (!elements.trainRatioBadge) return;
        const sanitized = Number.isFinite(ratio) ? ratio : 0.8;
        const trainPercent = Math.round(sanitized * 100);
        const testPercent = Math.max(0, 100 - trainPercent);
        elements.trainRatioBadge.textContent = `訓練：測試 = ${trainPercent}%｜${testPercent}%`;
    };

    const parseTrainRatio = () => {
        if (!elements.trainRatio) {
            updateTrainRatioBadge(0.8);
            return 0.8;
        }
        const raw = Number(elements.trainRatio.value);
        const allowed = [0.7, 0.75, 0.8, 0.85];
        const ratio = allowed.includes(raw) ? raw : 0.8;
        if (!allowed.includes(raw)) {
            elements.trainRatio.value = '0.8';
        }
        updateTrainRatioBadge(ratio);
        const modelState = getActiveModelState();
        modelState.hyperparameters.trainRatio = ratio;
        return ratio;
    };

    const parseWinThreshold = () => {
        if (!elements.winThreshold) return 0.5;
        const percent = Math.round(parseNumberInput(elements.winThreshold, 60, { min: 50, max: 100 }));
        elements.winThreshold.value = String(percent);
        const threshold = percent / 100;
        const modelState = getActiveModelState();
        modelState.winThreshold = threshold;
        return threshold;
    };

    const refreshSeedOptions = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        const activeModel = globalState.activeModel;
        const options = seeds
            .filter((seed) => (seed.modelType || MODEL_TYPES.LSTM) === activeModel)
            .map((seed) => `<option value="${escapeHTML(seed.id)}">${escapeHTML(seed.name || '未命名種子')}</option>`)
            .join('');
        elements.savedSeedList.innerHTML = options;
    };

    const buildSeedDefaultName = (summary) => {
        if (!summary) return '';
        const hitRateText = formatPercent(summary.hitRate, 1);
        const medianText = formatPercent(summary.tradeReturnMedian, 1);
        const averageText = formatPercent(summary.tradeReturnAverage, 1);
        const executedTrades = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
        return `測試期預測正確率${hitRateText}｜交易報酬率中位數${medianText}｜平均報酬率${averageText}｜交易次數${executedTrades}`;
    };

    const applySeedDefaultName = (summary) => {
        if (!elements.seedName) return;
        const defaultName = buildSeedDefaultName(summary);
        elements.seedName.dataset.defaultName = defaultName;
        const modelState = getActiveModelState();
        if (!elements.seedName.value || elements.seedName.value === modelState.lastSeedDefault) {
            elements.seedName.value = defaultName;
        }
        modelState.lastSeedDefault = defaultName;
    };

    const showStatus = (message, type = 'info') => {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.style.color = colorMap[type] || colorMap.info;
    };

    const resolveAIWorkerUrl = () => {
        if (typeof workerUrl === 'string' && workerUrl) {
            return workerUrl;
        }
        return 'js/worker.js';
    };

    const resetAIWorker = () => {
        if (aiWorker) {
            try {
                aiWorker.terminate();
            } catch (error) {
                console.warn('[AI Prediction] 終止 AI Worker 失敗：', error);
            }
        }
        aiWorker = null;
    };

    const failPendingWorkerRequests = (error) => {
        const reason = error instanceof Error ? error : new Error(String(error || 'AI Worker 發生未知錯誤'));
        aiWorkerRequests.forEach(({ reject }) => {
            try {
                reject(reason);
            } catch (rejectError) {
                console.warn('[AI Prediction] 回傳 Worker 失敗原因時發生錯誤：', rejectError);
            }
        });
        aiWorkerRequests.clear();
    };

    const handleAIWorkerMessage = (event) => {
        if (!event || !event.data) return;
        const { type, id, data, error, message } = event.data;
        const isProgress = type === 'ai-train-lstm-progress'
            || type === 'ai-train-ann-progress'
            || type === 'ai-replay-ann-progress';
        if (isProgress) {
            const pending = id ? aiWorkerRequests.get(id) : null;
            const fallbackModel = (type === 'ai-train-ann-progress' || type === 'ai-replay-ann-progress')
                ? MODEL_TYPES.ANNS
                : MODEL_TYPES.LSTM;
            const modelType = pending?.modelType || fallbackModel;
            const label = MODEL_LABELS[modelType] || 'AI 模型';
            if (typeof message === 'string' && message) {
                showStatus(`[${label}] ${message}`, 'info');
            }
            return;
        }
        if (!id || !aiWorkerRequests.has(id)) {
            return;
        }
        const pending = aiWorkerRequests.get(id);
        const inferredModel = pending.taskType === 'ai-train-ann' || pending.taskType === 'ai-replay-ann'
            ? MODEL_TYPES.ANNS
            : MODEL_TYPES.LSTM;
        const modelType = pending.modelType || inferredModel;
        if (type === 'ai-train-lstm-result' || type === 'ai-train-ann-result' || type === 'ai-replay-ann-result') {
            aiWorkerRequests.delete(id);
            const payload = data || {};
            payload.modelType = modelType;
            payload.taskType = pending.taskType;
            pending.resolve(payload);
        } else if (type === 'ai-train-lstm-error' || type === 'ai-train-ann-error' || type === 'ai-replay-ann-error') {
            aiWorkerRequests.delete(id);
            const reason = error && typeof error.message === 'string'
                ? new Error(error.message)
                : new Error('AI 背景訓練失敗');
            reason.modelType = modelType;
            pending.reject(reason);
        } else {
            aiWorkerRequests.delete(id);
            const unknownError = new Error('AI Worker 回傳未知訊息。');
            unknownError.modelType = modelType;
            pending.reject(unknownError);
        }
    };

    const handleAIWorkerFailure = (event) => {
        const reason = event instanceof Error
            ? event
            : new Error(event?.message || 'AI Worker 發生未預期錯誤');
        console.error('[AI Prediction] 背景訓練錯誤：', reason);
        failPendingWorkerRequests(reason);
        resetAIWorker();
    };

    const ensureAIWorker = () => {
        if (aiWorker) {
            return aiWorker;
        }
        if (typeof Worker === 'undefined') {
            throw new Error('瀏覽器不支援 Web Worker，無法於背景執行 AI 訓練。');
        }
        const url = resolveAIWorkerUrl();
        try {
            aiWorker = new Worker(url);
            aiWorker.onmessage = handleAIWorkerMessage;
            aiWorker.onerror = handleAIWorkerFailure;
            aiWorker.onmessageerror = handleAIWorkerFailure;
        } catch (error) {
            aiWorker = null;
            throw new Error(`AI 背景執行緒初始化失敗：${error.message}`);
        }
        return aiWorker;
    };

    const sendAIWorkerTrainingTask = (taskType, payload, metadata = {}) => {
        const workerInstance = ensureAIWorker();
        const requestId = `ai-train-${Date.now()}-${aiWorkerSequence += 1}`;
        let inferredModelType = MODEL_TYPES.LSTM;
        if (taskType === 'ai-train-ann' || taskType === 'ai-replay-ann') {
            inferredModelType = MODEL_TYPES.ANNS;
        }
        const modelType = metadata.modelType || inferredModelType;
        return new Promise((resolve, reject) => {
            aiWorkerRequests.set(requestId, { resolve, reject, modelType, taskType });
            try {
                workerInstance.postMessage({
                    type: taskType,
                    id: requestId,
                    payload,
                });
            } catch (error) {
                aiWorkerRequests.delete(requestId);
                reject(new Error(`無法送出 AI 訓練請求：${error.message}`));
            }
        });
    };

    const toggleRunning = (flag) => {
        globalState.running = Boolean(flag);
        if (!elements.runButton) return;
        elements.runButton.disabled = globalState.running;
        elements.runButton.classList.toggle('opacity-60', globalState.running);
        elements.runButton.classList.toggle('cursor-not-allowed', globalState.running);
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

    const computeKellyFraction = (probability, odds) => {
        const sanitizedProb = Math.min(Math.max(probability, 0.001), 0.999);
        const b = Math.max(odds, 1e-6);
        const fraction = sanitizedProb - ((1 - sanitizedProb) / b);
        return Math.max(0, Math.min(fraction, 1));
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

    const renderTrades = (records, forecast) => {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = forecast && Number.isFinite(forecast.probability)
                ? `
                    <tr class="bg-muted/30">
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.displayDate || forecast.referenceDate || '最近收盤')}
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>
                        </td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                    </tr>
                `
                : '';
            return;
        }
        const limited = rows.slice(-200);
        const htmlParts = limited.map((trade) => {
            const probabilityText = formatPercent(trade.probability, 1);
            const actualReturnText = formatPercent(trade.actualReturn, 2);
            const fractionText = formatPercent(trade.fraction, 2);
            const tradeReturnText = formatPercent(trade.tradeReturn, 2);
            const actualClass = Number.isFinite(trade.actualReturn) && trade.actualReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const tradeReturnClass = Number.isFinite(trade.tradeReturn) && trade.tradeReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const badge = trade.isForecast
                ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>`
                : '';
            return `
                <tr${trade.isForecast ? ' class="bg-muted/30"' : ''}>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(trade.tradeDate || '—')}${badge}</td>
                    <td class="px-3 py-2 text-right">${probabilityText}</td>
                    <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                    <td class="px-3 py-2 text-right">${fractionText}</td>
                    <td class="px-3 py-2 text-right ${tradeReturnClass}">${tradeReturnText}</td>
                </tr>
            `;
        });

        if (forecast && Number.isFinite(forecast.probability)) {
            const forecastDateLabel = forecast.displayDate || forecast.referenceDate || '最近收盤';
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecastDateLabel)}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                </tr>
            `);
        }

        elements.tradeTableBody.innerHTML = htmlParts.join('');
    };

    const resetOutputs = () => {
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = '—';
        if (elements.trainLoss) elements.trainLoss.textContent = 'Loss：—';
        if (elements.testAccuracy) elements.testAccuracy.textContent = '—';
        if (elements.testLoss) elements.testLoss.textContent = 'Loss：—';
        if (elements.tradeCount) elements.tradeCount.textContent = '—';
        if (elements.hitRate) elements.hitRate.textContent = '命中率：—｜勝率門檻：—';
        if (elements.totalReturn) elements.totalReturn.textContent = '—';
        if (elements.averageProfit) elements.averageProfit.textContent = '平均報酬%：—｜交易次數：0｜標準差：—';
        if (elements.tradeSummary) elements.tradeSummary.textContent = '尚未生成交易結果。';
        if (elements.nextDayForecast) elements.nextDayForecast.textContent = '尚未計算隔日預測。';
        if (elements.tradeTableBody) elements.tradeTableBody.innerHTML = '';
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
        if (elements.hitRate) {
            const thresholdPercent = Number.isFinite(summary.threshold) ? `${Math.round(summary.threshold * 100)}%` : '—';
            elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}｜勝率門檻：${thresholdPercent}`;
        }
        if (elements.totalReturn) elements.totalReturn.textContent = formatPercent(summary.tradeReturnMedian, 2);
        if (elements.averageProfit) {
            const stdText = formatPercent(summary.tradeReturnStdDev, 2);
            elements.averageProfit.textContent = `平均報酬%：${formatPercent(summary.tradeReturnAverage, 2)}｜交易次數：${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}｜標準差：${stdText}`;
        }
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly
                ? '已啟用凱利公式'
                : `固定投入 ${formatPercent(summary.fixedFraction, 2)}`;
            const medianText = formatPercent(summary.tradeReturnMedian, 2);
            const averageText = formatPercent(summary.tradeReturnAverage, 2);
            elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，勝率門檻設定為 ${Math.round((summary.threshold || 0.5) * 100)}%，執行 ${summary.executedTrades} 筆交易，${strategyLabel}。交易報酬% 中位數 ${medianText}，平均報酬% ${averageText}。`;
        }
        if (elements.nextDayForecast) {
            const threshold = Number.isFinite(summary.threshold) ? summary.threshold : parseWinThreshold();
            const forecast = summary.forecast;
            if (!forecast || !Number.isFinite(forecast.probability)) {
                elements.nextDayForecast.textContent = '尚未計算隔日預測。';
            } else {
                const basisDate = forecast.basisDate || summary.datasetLastDate || null;
                const forecastDate = forecast.displayDate || forecast.referenceDate || null;
                const baseIntro = basisDate
                    ? `以 ${basisDate} 收盤為基準，`
                    : '以最近一次收盤為基準，';
                const probabilityText = forecastDate
                    ? `預估 ${forecastDate} 隔日上漲機率為 ${formatPercent(forecast.probability, 1)}`
                    : `隔日上漲機率為 ${formatPercent(forecast.probability, 1)}`;
                const meetsThreshold = Number.isFinite(threshold)
                    ? (forecast.probability >= threshold
                        ? '符合當前勝率門檻，可列入隔日進場條件評估。'
                        : '未達當前勝率門檻，建議僅作為觀察參考。')
                    : '';
                const kellyText = summary.usingKelly && Number.isFinite(forecast.fraction)
                    ? `凱利公式建議投入比例約 ${formatPercent(forecast.fraction, 2)}。`
                    : '';
                elements.nextDayForecast.textContent = `${baseIntro}${probabilityText}；勝率門檻 ${Math.round(threshold * 100)}%，${meetsThreshold}${kellyText}`;
            }
        }
    };

    const computeTradeOutcomes = (payload, options, trainingOdds) => {
        const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
        const meta = Array.isArray(payload?.meta) ? payload.meta : [];
        const returns = Array.isArray(payload?.returns) ? payload.returns : [];
        const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.5;
        const useKelly = Boolean(options.useKelly);
        const fixedFraction = sanitizeFraction(options.fixedFraction);

        const executedTrades = [];
        const tradeReturns = [];
        let wins = 0;

        for (let i = 0; i < predictions.length; i += 1) {
            const probability = Number(predictions[i]);
            const metaItem = meta[i];
            const actualReturn = returns[i];
            if (!Number.isFinite(probability) || !metaItem || !Number.isFinite(actualReturn)) {
                continue;
            }
            if (probability < threshold) {
                continue;
            }
            const tradeDate = typeof metaItem.sellDate === 'string' && metaItem.sellDate
                ? metaItem.sellDate
                : (typeof metaItem.tradeDate === 'string' && metaItem.tradeDate
                    ? metaItem.tradeDate
                    : (typeof metaItem.date === 'string' && metaItem.date ? metaItem.date : null));
            if (!tradeDate) {
                continue;
            }
            const fraction = useKelly
                ? computeKellyFraction(probability, trainingOdds)
                : fixedFraction;
            const tradeReturn = actualReturn * fraction;
            if (actualReturn > 0) {
                wins += 1;
            }
            executedTrades.push({
                tradeDate,
                probability,
                actualReturn,
                fraction,
                tradeReturn,
            });
            tradeReturns.push(tradeReturn);
        }

        const executed = executedTrades.length;
        const hitRate = executed > 0 ? wins / executed : 0;
        const median = tradeReturns.length > 0 ? computeMedian(tradeReturns) : NaN;
        const average = tradeReturns.length > 0 ? computeMean(tradeReturns) : NaN;
        const stdDev = tradeReturns.length > 1 ? computeStd(tradeReturns, average) : NaN;

        return {
            trades: executedTrades,
            stats: {
                executed,
                hitRate,
                median,
                average,
                stdDev,
            },
        };
    };

    const applyTradeEvaluation = (modelType, payload, trainingMetrics, options) => {
        const modelState = getModelState(modelType);
        if (!modelState || !payload) return;
        const metrics = trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(payload?.predictions) ? payload.predictions.length : 0,
        };
        const fallbackOdds = Number.isFinite(modelState.odds) ? modelState.odds : 1;
        const trainingOdds = Number.isFinite(payload.trainingOdds) ? payload.trainingOdds : fallbackOdds;
        const evaluation = computeTradeOutcomes(payload, options, trainingOdds);
        const forecast = payload.forecast && Number.isFinite(payload.forecast?.probability)
            ? { ...payload.forecast }
            : null;
        if (forecast) {
            const forecastFraction = options.useKelly
                ? computeKellyFraction(forecast.probability, trainingOdds)
                : sanitizeFraction(options.fixedFraction);
            forecast.fraction = forecastFraction;
            const datasetLastDate = typeof payload.datasetLastDate === 'string' ? payload.datasetLastDate : null;
            const existingBasis = typeof forecast.basisDate === 'string' ? forecast.basisDate : null;
            const basisDate = existingBasis || datasetLastDate || null;
            const hadBasis = Boolean(existingBasis);
            if (!hadBasis && basisDate) {
                forecast.basisDate = basisDate;
            }
            const sourceForNext = basisDate || (typeof forecast.referenceDate === 'string' ? forecast.referenceDate : null);
            const nextDate = sourceForNext ? computeNextTradingDate(sourceForNext) : null;
            if (nextDate) {
                forecast.displayDate = nextDate;
                if (!hadBasis && forecast.referenceDate === basisDate) {
                    forecast.referenceDate = nextDate;
                }
            } else if (typeof forecast.referenceDate === 'string') {
                const derivedNext = computeNextTradingDate(forecast.referenceDate);
                if (derivedNext) {
                    forecast.displayDate = derivedNext;
                    forecast.referenceDate = derivedNext;
                } else {
                    forecast.displayDate = forecast.referenceDate;
                }
            }
            if (!forecast.displayDate && typeof forecast.referenceDate === 'string') {
                forecast.displayDate = forecast.referenceDate;
            }
        }

        const summary = {
            version: VERSION_TAG,
            trainAccuracy: metrics.trainAccuracy,
            trainLoss: metrics.trainLoss,
            testAccuracy: metrics.testAccuracy,
            testLoss: metrics.testLoss,
            totalPredictions: Number.isFinite(metrics.totalPredictions)
                ? metrics.totalPredictions
                : (Array.isArray(payload.predictions) ? payload.predictions.length : 0),
            executedTrades: evaluation.stats.executed,
            hitRate: evaluation.stats.hitRate,
            tradeReturnMedian: evaluation.stats.median,
            tradeReturnAverage: evaluation.stats.average,
            tradeReturnStdDev: evaluation.stats.stdDev,
            usingKelly: Boolean(options.useKelly),
            fixedFraction: sanitizeFraction(options.fixedFraction),
            threshold: Number.isFinite(options.threshold) ? options.threshold : 0.5,
            datasetLastDate: typeof payload.datasetLastDate === 'string' ? payload.datasetLastDate : null,
            forecast,
        };

        modelState.trainingMetrics = metrics;
        modelState.lastSummary = summary;
        modelState.currentTrades = evaluation.trades;
        modelState.odds = trainingOdds;
        modelState.predictionsPayload = payload;

        if (globalState.activeModel === modelType) {
            updateSummaryMetrics(summary);
            renderTrades(evaluation.trades, summary.forecast);
            applySeedDefaultName(summary);
        }
    };

    const captureActiveModelSettings = () => {
        const modelState = getActiveModelState();
        if (!modelState) return;
        const lookback = Math.round(parseNumberInput(elements.lookback, modelState.hyperparameters.lookback, { min: 5, max: 60 }));
        const epochs = Math.round(parseNumberInput(elements.epochs, modelState.hyperparameters.epochs, { min: 10, max: 300 }));
        const batchSize = Math.round(parseNumberInput(elements.batchSize, modelState.hyperparameters.batchSize, { min: 8, max: 512 }));
        const learningRate = parseNumberInput(elements.learningRate, modelState.hyperparameters.learningRate, { min: 0.0001, max: 0.05 });
        const trainRatio = parseTrainRatio();

        modelState.hyperparameters = {
            lookback,
            epochs,
            batchSize,
            learningRate,
            trainRatio,
        };
        modelState.winThreshold = parseWinThreshold();
        modelState.kellyEnabled = Boolean(elements.enableKelly?.checked);
        modelState.fixedFraction = sanitizeFraction(parseNumberInput(elements.fixedFraction, modelState.fixedFraction, { min: 0.01, max: 1 }));
    };

    const applyModelSettingsToUI = (modelState) => {
        if (!modelState) return;
        if (elements.modelType) {
            elements.modelType.value = globalState.activeModel;
        }
        const hyper = modelState.hyperparameters || {};
        if (elements.lookback) {
            elements.lookback.value = Number.isFinite(hyper.lookback) ? hyper.lookback : 20;
        }
        if (elements.epochs) {
            elements.epochs.value = Number.isFinite(hyper.epochs) ? hyper.epochs : 80;
        }
        if (elements.batchSize) {
            elements.batchSize.value = Number.isFinite(hyper.batchSize) ? hyper.batchSize : 64;
        }
        if (elements.learningRate) {
            elements.learningRate.value = Number.isFinite(hyper.learningRate) ? hyper.learningRate : 0.005;
        }
        if (elements.trainRatio) {
            const ratioValue = Number.isFinite(hyper.trainRatio) ? hyper.trainRatio : 0.8;
            elements.trainRatio.value = String(ratioValue);
            updateTrainRatioBadge(ratioValue);
        }
        if (elements.enableKelly) {
            elements.enableKelly.checked = Boolean(modelState.kellyEnabled);
        }
        if (elements.fixedFraction) {
            elements.fixedFraction.value = sanitizeFraction(modelState.fixedFraction || 0.2);
        }
        if (elements.winThreshold) {
            const thresholdPercent = Math.round(((Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5) * 100));
            elements.winThreshold.value = String(thresholdPercent);
        }
        parseTrainRatio();
        parseWinThreshold();
    };

    const renderActiveModelOutputs = () => {
        const modelState = getActiveModelState();
        if (modelState && modelState.lastSummary) {
            updateSummaryMetrics(modelState.lastSummary);
            renderTrades(modelState.currentTrades, modelState.lastSummary.forecast);
            applySeedDefaultName(modelState.lastSummary);
        } else {
            resetOutputs();
            applySeedDefaultName(null);
        }
    };

    const runLstmModel = async (modelState, rows, hyperparameters, riskOptions) => {
        const modelType = MODEL_TYPES.LSTM;
        const label = formatModelLabel(modelType);
        const dataset = buildDataset(rows, hyperparameters.lookback);
        const minimumSamples = Math.max(45, hyperparameters.lookback * 3);
        if (dataset.sequences.length < minimumSamples) {
            showStatus(`[${label}] 資料樣本不足（需至少 ${minimumSamples} 筆有效樣本，目前 ${dataset.sequences.length} 筆），請延長回測期間。`, 'warning');
            return;
        }

        const totalSamples = dataset.sequences.length;
        const rawTrainSize = Math.max(Math.floor(totalSamples * hyperparameters.trainRatio), hyperparameters.lookback);
        const boundedTrainSize = Math.min(Math.max(rawTrainSize, hyperparameters.lookback), totalSamples - 1);
        const testSize = totalSamples - boundedTrainSize;
        if (boundedTrainSize <= 0 || testSize <= 0) {
            showStatus(`[${label}] 無法依照 ${Math.round(hyperparameters.trainRatio * 100)}% / ${100 - Math.round(hyperparameters.trainRatio * 100)}% 分割訓練與測試集，請延長資料範圍。`, 'warning');
            return;
        }

        const effectiveBatchSize = Math.min(hyperparameters.batchSize, boundedTrainSize);
        if (hyperparameters.batchSize > boundedTrainSize) {
            showStatus(`[${label}] 批次大小 ${hyperparameters.batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整為 ${effectiveBatchSize}。`, 'warning');
        }

        showStatus(`[${label}] 訓練中（共 ${hyperparameters.epochs} 輪）...`, 'info');
        const workerResult = await sendAIWorkerTrainingTask('ai-train-lstm', {
            dataset,
            hyperparameters: {
                lookback: hyperparameters.lookback,
                epochs: hyperparameters.epochs,
                batchSize: effectiveBatchSize,
                learningRate: hyperparameters.learningRate,
                totalSamples,
                trainSize: boundedTrainSize,
                trainRatio: hyperparameters.trainRatio,
            },
        }, { modelType });

        const resultModelType = workerResult.modelType || modelType;
        const trainingMetrics = workerResult?.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: 0,
        };
        const predictionsPayload = workerResult?.predictionsPayload || null;
        if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
            throw new Error('AI Worker 未回傳有效的預測結果。');
        }

        predictionsPayload.hyperparameters = {
            lookback: hyperparameters.lookback,
            epochs: hyperparameters.epochs,
            batchSize: effectiveBatchSize,
            learningRate: hyperparameters.learningRate,
            trainRatio: hyperparameters.trainRatio,
            modelType: resultModelType,
        };

        modelState.hyperparameters = {
            lookback: hyperparameters.lookback,
            epochs: hyperparameters.epochs,
            batchSize: effectiveBatchSize,
            learningRate: hyperparameters.learningRate,
            trainRatio: hyperparameters.trainRatio,
        };

        applyTradeEvaluation(resultModelType, predictionsPayload, trainingMetrics, riskOptions);

        const finalMessage = typeof workerResult?.finalMessage === 'string'
            ? workerResult.finalMessage
            : `完成：訓練勝率 ${formatPercent(trainingMetrics.trainAccuracy, 2)}，測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}。`;
        showStatus(`[${formatModelLabel(resultModelType)}] ${finalMessage}`, 'success');
    };

    const runAnnModel = async (modelState, rows, hyperparameters, riskOptions) => {
        const modelType = MODEL_TYPES.ANNS;
        const label = formatModelLabel(modelType);
        if (!Array.isArray(rows) || rows.length < 60) {
            showStatus(`[${label}] 資料不足（至少 60 根 K 線），請先延長回測期間。`, 'warning');
            return;
        }

        showStatus(`[${label}] 訓練中（共 ${hyperparameters.epochs} 輪）...`, 'info');
        const workerResult = await sendAIWorkerTrainingTask('ai-train-ann', {
            rows,
            options: {
                epochs: hyperparameters.epochs,
                batchSize: hyperparameters.batchSize,
                learningRate: hyperparameters.learningRate,
                trainRatio: hyperparameters.trainRatio,
                lookback: hyperparameters.lookback,
            },
        }, { modelType });

        const trainingMetrics = workerResult?.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: 0,
        };
        const predictionsPayload = workerResult?.predictionsPayload || null;
        if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
            throw new Error('AI Worker 未回傳有效的預測結果。');
        }

        predictionsPayload.hyperparameters = {
            lookback: hyperparameters.lookback,
            epochs: hyperparameters.epochs,
            batchSize: hyperparameters.batchSize,
            learningRate: hyperparameters.learningRate,
            trainRatio: hyperparameters.trainRatio,
            modelType,
        };

        modelState.hyperparameters = {
            lookback: hyperparameters.lookback,
            epochs: hyperparameters.epochs,
            batchSize: hyperparameters.batchSize,
            learningRate: hyperparameters.learningRate,
            trainRatio: hyperparameters.trainRatio,
        };

        applyTradeEvaluation(modelType, predictionsPayload, trainingMetrics, riskOptions);

        const finalMessage = typeof workerResult?.finalMessage === 'string'
            ? workerResult.finalMessage
            : `完成：測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}，混淆矩陣已同步更新。`;
        showStatus(`[${label}] ${finalMessage}`, 'success');
    };

    const recomputeTradesFromState = (modelType = globalState.activeModel) => {
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload || !modelState.trainingMetrics) return;

        let threshold = Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5;
        let useKelly = Boolean(modelState.kellyEnabled);
        let fixedFraction = sanitizeFraction(modelState.fixedFraction);

        if (modelType === globalState.activeModel) {
            threshold = parseWinThreshold();
            useKelly = Boolean(elements.enableKelly?.checked);
            fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
            modelState.kellyEnabled = useKelly;
            modelState.fixedFraction = sanitizeFraction(fixedFraction);
        }

        applyTradeEvaluation(modelType, modelState.predictionsPayload, modelState.trainingMetrics, {
            threshold,
            useKelly,
            fixedFraction,
        });
    };

    const optimiseWinThreshold = () => {
        const modelType = globalState.activeModel;
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload || !modelState.trainingMetrics) {
            showStatus('請先完成一次 AI 預測或載入已儲存的種子。', 'warning');
            return;
        }
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        const payload = modelState.predictionsPayload;
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(modelState.odds) ? modelState.odds : 1);
        let bestThreshold = modelState.winThreshold || 0.5;
        let bestMedian = Number.NEGATIVE_INFINITY;
        let bestAverage = Number.NEGATIVE_INFINITY;
        let bestMedianValue = NaN;
        let bestAverageValue = NaN;
        let bestExecuted = 0;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = computeTradeOutcomes(payload, {
                threshold,
                useKelly,
                fixedFraction,
            }, trainingOdds);
            const median = evaluation.stats.median;
            const average = evaluation.stats.average;
            const executed = evaluation.stats.executed;
            const normalizedMedian = Number.isFinite(median) ? median : Number.NEGATIVE_INFINITY;
            const normalizedAverage = Number.isFinite(average) ? average : Number.NEGATIVE_INFINITY;
            if (
                normalizedMedian > bestMedian
                || (normalizedMedian === bestMedian && normalizedAverage > bestAverage)
                || (normalizedMedian === bestMedian && normalizedAverage === bestAverage && threshold < bestThreshold)
            ) {
                bestMedian = normalizedMedian;
                bestAverage = normalizedAverage;
                bestMedianValue = Number.isFinite(median) ? median : NaN;
                bestAverageValue = Number.isFinite(average) ? average : NaN;
                bestExecuted = Number.isFinite(executed) ? executed : 0;
                bestThreshold = threshold;
            }
        }
        if (!Number.isFinite(bestMedian) || bestMedian === Number.NEGATIVE_INFINITY) {
            showStatus('門檻掃描後仍無符合條件的交易。已維持原門檻設定。', 'warning');
            return;
        }
        elements.winThreshold.value = String(Math.round(bestThreshold * 100));
        modelState.winThreshold = bestThreshold;
        parseWinThreshold();
        recomputeTradesFromState(modelType);
        const medianText = formatPercent(bestMedianValue, 2);
        const averageText = formatPercent(bestAverageValue, 2);
        const executedText = Number.isFinite(bestExecuted) ? bestExecuted : 0;
        showStatus(`最佳化完成：勝率門檻 ${Math.round(bestThreshold * 100)}% 對應交易報酬% 中位數 ${medianText}，平均報酬% ${averageText}，共執行 ${executedText} 筆交易。`, 'success');
    };

    const maybeRefreshAnnSeed = async (seed) => {
        const modelType = MODEL_TYPES.ANNS;
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload) return;
        if (modelState.refreshingReplay) return;
        const payload = modelState.predictionsPayload;
        if (!payload.weightSnapshot || typeof payload.weightSnapshot.data !== 'string') {
            return;
        }
        const storedRows = normalizeAnnDatasetRows(payload.datasetRows);
        const lastStoredDate = getLastDateFromRows(storedRows) || payload.datasetLastDate;
        if (!lastStoredDate) {
            return;
        }
        const todayIso = getTaipeiTodayIso();
        const visibleRaw = getVisibleData();
        const visibleRows = Array.isArray(visibleRaw)
            ? visibleRaw.map((row) => ({
                date: typeof row?.date === 'string' ? row.date : null,
                close: resolveCloseValue(row),
                high: Number(row?.high),
                low: Number(row?.low),
            }))
            : [];
        const tableRows = normalizeAnnDatasetRows(visibleRows);
        const tableLastDate = getLastDateFromRows(tableRows);
        const baseSnapshot = createAnnReplayBaseSnapshot(payload, modelState);
        const previousPredictions = Array.isArray(payload.predictions) ? [...payload.predictions] : [];
        const mergedWithTable = tableRows.length > 0 ? mergeAnnDatasetRows(storedRows, tableRows) : storedRows;
        const shouldReplayFromTable = Boolean(todayIso)
            && Boolean(tableLastDate)
            && tableLastDate === todayIso
            && tableLastDate > lastStoredDate
            && Array.isArray(mergedWithTable)
            && mergedWithTable.length >= storedRows.length;
        if (shouldReplayFromTable) {
            modelState.refreshingReplay = true;
            try {
                showStatus('[ANNS 技術指標感知器] 已偵測表格含最新交易資料，正在對齊預測結果...', 'info');
                await runAnnReplayWithRows({
                    rows: mergedWithTable,
                    payload,
                    modelState,
                    baseSnapshot,
                    previousPredictions,
                    successMessage: '[ANNS 技術指標感知器] 已使用現有表格資料更新隔日預測。',
                });
            } catch (error) {
                console.error('[AI Prediction] ANN 表格回放失敗：', error);
                showStatus(`ANN 表格回放失敗：${error.message || error}`, 'warning');
            } finally {
                delete modelState.refreshingReplay;
            }
            return;
        }
        if (!todayIso || lastStoredDate >= todayIso) {
            return;
        }
        const context = resolveAnnContext();
        if (!context) {
            showStatus('無法辨識最新資料來源，請先重新執行回測後再載入種子。', 'warning');
            return;
        }
        modelState.refreshingReplay = true;
        try {
            showStatus('[ANNS 技術指標感知器] 偵測到資料缺口，正在補抓最新交易日...', 'info');
            const lastRow = storedRows.find((row) => row.date === lastStoredDate) || null;
            const gapRows = await fetchAnnGapRows(context, lastStoredDate, todayIso, lastRow);
            if (!Array.isArray(gapRows) || gapRows.length === 0) {
                showStatus('尚未取得新的交易資料，已維持原預測結果。', 'info');
                return;
            }
            const mergedRows = mergeAnnDatasetRows(storedRows, gapRows);
            await runAnnReplayWithRows({
                rows: mergedRows,
                payload,
                modelState,
                baseSnapshot,
                previousPredictions,
                successMessage: '[ANNS 技術指標感知器] 已補齊最新資料並更新隔日預測。',
            });
        } catch (error) {
            console.error('[AI Prediction] ANN 種子回放失敗：', error);
            showStatus(`ANN 種子回放失敗：${error.message || error}`, 'warning');
        } finally {
            delete modelState.refreshingReplay;
        }
    };

    const handleSaveSeed = () => {
        const modelType = globalState.activeModel;
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload || !modelState.trainingMetrics || !modelState.lastSummary) {
            showStatus('請先執行 AI 預測，再儲存種子。', 'warning');
            return;
        }
        if (typeof window === 'undefined' || !window.localStorage) {
            showStatus('此環境不支援本地儲存功能。', 'error');
            return;
        }
        const seeds = loadStoredSeeds();
        const summary = modelState.lastSummary;
        const defaultName = buildSeedDefaultName(summary) || '未命名種子';
        const inputName = elements.seedName?.value?.trim();
        const seedName = inputName || defaultName;
        const payloadSource = modelState.predictionsPayload || {};
        const payloadSnapshot = {
            predictions: Array.isArray(payloadSource.predictions) ? cloneSeedValue(payloadSource.predictions) : [],
            meta: Array.isArray(payloadSource.meta) ? cloneSeedValue(payloadSource.meta) : [],
            returns: Array.isArray(payloadSource.returns) ? cloneSeedValue(payloadSource.returns) : [],
            trainingOdds: payloadSource.trainingOdds,
            forecast: cloneSeedValue(payloadSource.forecast),
            datasetLastDate: payloadSource.datasetLastDate,
            hyperparameters: payloadSource.hyperparameters ? { ...payloadSource.hyperparameters } : null,
            datasetRows: Array.isArray(payloadSource.datasetRows) ? cloneSeedValue(payloadSource.datasetRows) : [],
            standardization: payloadSource.standardization && typeof payloadSource.standardization === 'object'
                ? {
                    mean: Array.isArray(payloadSource.standardization.mean)
                        ? cloneSeedValue(payloadSource.standardization.mean)
                        : [],
                    std: Array.isArray(payloadSource.standardization.std)
                        ? cloneSeedValue(payloadSource.standardization.std)
                        : [],
                }
                : { mean: [], std: [] },
            trainWindow: payloadSource.trainWindow && typeof payloadSource.trainWindow === 'object'
                ? {
                    trainCount: payloadSource.trainWindow.trainCount,
                    totalCount: payloadSource.trainWindow.totalCount,
                }
                : { trainCount: null, totalCount: null },
            weightSnapshot: payloadSource.weightSnapshot && typeof payloadSource.weightSnapshot === 'object'
                ? {
                    data: payloadSource.weightSnapshot.data,
                    specs: Array.isArray(payloadSource.weightSnapshot.specs)
                        ? cloneSeedValue(payloadSource.weightSnapshot.specs)
                        : [],
                }
                : null,
        };
        const summarySnapshot = summary ? cloneSeedValue(summary) : null;
        const tradesSnapshot = Array.isArray(modelState.currentTrades)
            ? cloneSeedValue(modelState.currentTrades)
            : [];
        const trainingMetricsSnapshot = modelState.trainingMetrics
            ? cloneSeedValue(modelState.trainingMetrics)
            : null;
        const newSeed = {
            id: `seed-${Date.now()}`,
            name: seedName,
            createdAt: Date.now(),
            modelType,
            payload: payloadSnapshot,
            trainingMetrics: trainingMetricsSnapshot,
            summary: {
                threshold: summary.threshold,
                usingKelly: summary.usingKelly,
                fixedFraction: summary.fixedFraction,
            },
            evaluation: {
                summary: summarySnapshot,
                trades: tradesSnapshot,
            },
            version: VERSION_TAG,
        };
        seeds.push(newSeed);
        persistSeeds(seeds);
        refreshSeedOptions();
        showStatus(`已儲存種子「${seedName}」。`, 'success');
    };

    const activateSeed = (seed) => {
        if (!seed) return;
        const modelType = globalState.activeModel;
        const modelState = getModelState(modelType);
        const payload = seed.payload || {};
        modelState.predictionsPayload = {
            predictions: Array.isArray(payload.predictions) ? cloneSeedValue(payload.predictions) : [],
            meta: Array.isArray(payload.meta) ? cloneSeedValue(payload.meta) : [],
            returns: Array.isArray(payload.returns) ? cloneSeedValue(payload.returns) : [],
            trainingOdds: Number.isFinite(payload.trainingOdds) ? payload.trainingOdds : NaN,
            forecast: cloneSeedValue(payload.forecast),
            datasetLastDate: typeof payload.datasetLastDate === 'string' ? payload.datasetLastDate : null,
            hyperparameters: payload.hyperparameters ? { ...payload.hyperparameters } : null,
            datasetRows: Array.isArray(payload.datasetRows) ? cloneSeedValue(payload.datasetRows) : [],
            standardization: payload.standardization && typeof payload.standardization === 'object'
                ? {
                    mean: Array.isArray(payload.standardization.mean)
                        ? cloneSeedValue(payload.standardization.mean)
                        : [],
                    std: Array.isArray(payload.standardization.std)
                        ? cloneSeedValue(payload.standardization.std)
                        : [],
                }
                : { mean: [], std: [] },
            trainWindow: payload.trainWindow && typeof payload.trainWindow === 'object'
                ? {
                    trainCount: Number.isFinite(payload.trainWindow.trainCount)
                        ? payload.trainWindow.trainCount
                        : null,
                    totalCount: Number.isFinite(payload.trainWindow.totalCount)
                        ? payload.trainWindow.totalCount
                        : null,
                }
                : { trainCount: null, totalCount: null },
            weightSnapshot: payload.weightSnapshot && typeof payload.weightSnapshot === 'object'
                ? {
                    data: payload.weightSnapshot.data,
                    specs: Array.isArray(payload.weightSnapshot.specs)
                        ? cloneSeedValue(payload.weightSnapshot.specs)
                        : [],
                }
                : null,
        };
        const metricsSource = seed.trainingMetrics || {};
        const metrics = {
            trainAccuracy: Number.isFinite(metricsSource.trainAccuracy) ? metricsSource.trainAccuracy : NaN,
            trainLoss: Number.isFinite(metricsSource.trainLoss) ? metricsSource.trainLoss : NaN,
            testAccuracy: Number.isFinite(metricsSource.testAccuracy) ? metricsSource.testAccuracy : NaN,
            testLoss: Number.isFinite(metricsSource.testLoss) ? metricsSource.testLoss : NaN,
            totalPredictions: Number.isFinite(metricsSource.totalPredictions)
                ? metricsSource.totalPredictions
                : (Array.isArray(modelState.predictionsPayload.predictions)
                    ? modelState.predictionsPayload.predictions.length
                    : 0),
        };
        modelState.trainingMetrics = metrics;
        const restoredOdds = Number.isFinite(modelState.predictionsPayload.trainingOdds)
            ? modelState.predictionsPayload.trainingOdds
            : (Number.isFinite(seed.payload?.trainingOdds) ? seed.payload.trainingOdds : NaN);
        if (Number.isFinite(restoredOdds)) {
            modelState.odds = restoredOdds;
        }

        const evaluationSummary = seed.evaluation?.summary ? cloneSeedValue(seed.evaluation.summary) : null;
        const evaluationTrades = Array.isArray(seed.evaluation?.trades)
            ? cloneSeedValue(seed.evaluation.trades)
            : [];
        modelState.lastSummary = evaluationSummary;
        modelState.currentTrades = Array.isArray(evaluationTrades) ? evaluationTrades : [];

        if (globalState.activeModel === modelType) {
            renderActiveModelOutputs();
        }

        const hyper = seed.payload?.hyperparameters || {};
        if (elements.lookback && Number.isFinite(hyper.lookback)) {
            elements.lookback.value = hyper.lookback;
        }
        if (elements.epochs && Number.isFinite(hyper.epochs)) {
            elements.epochs.value = hyper.epochs;
        }
        if (elements.batchSize && Number.isFinite(hyper.batchSize)) {
            elements.batchSize.value = hyper.batchSize;
        }
        if (elements.learningRate && Number.isFinite(hyper.learningRate)) {
            elements.learningRate.value = hyper.learningRate;
        }
        if (elements.trainRatio && Number.isFinite(hyper.trainRatio)) {
            elements.trainRatio.value = String(hyper.trainRatio);
        }

        modelState.hyperparameters = {
            lookback: Number.isFinite(hyper.lookback) ? hyper.lookback : modelState.hyperparameters.lookback,
            epochs: Number.isFinite(hyper.epochs) ? hyper.epochs : modelState.hyperparameters.epochs,
            batchSize: Number.isFinite(hyper.batchSize) ? hyper.batchSize : modelState.hyperparameters.batchSize,
            learningRate: Number.isFinite(hyper.learningRate) ? hyper.learningRate : modelState.hyperparameters.learningRate,
            trainRatio: Number.isFinite(hyper.trainRatio) ? hyper.trainRatio : modelState.hyperparameters.trainRatio,
        };

        if (elements.enableKelly && typeof seed.summary?.usingKelly === 'boolean') {
            elements.enableKelly.checked = seed.summary.usingKelly;
        }
        if (elements.fixedFraction && Number.isFinite(seed.summary?.fixedFraction)) {
            elements.fixedFraction.value = seed.summary.fixedFraction;
        }
        if (elements.winThreshold && Number.isFinite(seed.summary?.threshold)) {
            elements.winThreshold.value = String(Math.round(seed.summary.threshold * 100));
        }

        modelState.kellyEnabled = Boolean(seed.summary?.usingKelly);
        modelState.fixedFraction = Number.isFinite(seed.summary?.fixedFraction)
            ? sanitizeFraction(seed.summary.fixedFraction)
            : modelState.fixedFraction;
        modelState.winThreshold = Number.isFinite(seed.summary?.threshold)
            ? seed.summary.threshold
            : modelState.winThreshold;

        parseTrainRatio();
        parseWinThreshold();
        recomputeTradesFromState(modelType);
        showStatus(`已載入種子：${seed.name || '未命名種子'}。`, 'success');
        if (modelType === MODEL_TYPES.ANNS) {
            maybeRefreshAnnSeed(seed).catch((error) => {
                console.error('[AI Prediction] ANN 種子回放錯誤：', error);
                showStatus(`ANN 種子回放錯誤：${error.message || error}`, 'warning');
            });
        }
    };

    const handleLoadSeed = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        const selectedIds = Array.from(elements.savedSeedList.selectedOptions || []).map((option) => option.value);
        if (selectedIds.length === 0) {
            showStatus('請先選擇至少一個已儲存的種子。', 'warning');
            return;
        }
        const selectedSeeds = selectedIds
            .map((id) => seeds.find((seed) => seed.id === id))
            .filter((seed) => Boolean(seed));
        if (selectedSeeds.length === 0) {
            showStatus('找不到選取的種子資料，請重新整理列表。', 'error');
            refreshSeedOptions();
            return;
        }
        const latestSeed = selectedSeeds[selectedSeeds.length - 1];
        activateSeed(latestSeed);
    };

    const handleDeleteSeeds = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        if (seeds.length === 0) {
            showStatus('目前沒有儲存的種子可供刪除。', 'warning');
            return;
        }
        const selectedIds = Array.from(elements.savedSeedList.selectedOptions || []).map((option) => option.value);
        if (selectedIds.length === 0) {
            showStatus('請先選擇要刪除的種子。', 'warning');
            return;
        }
        const remaining = seeds.filter((seed) => !selectedIds.includes(seed.id));
        const deletedCount = seeds.length - remaining.length;
        if (deletedCount <= 0) {
            showStatus('找不到選取的種子資料，已重新整理列表。', 'error');
            refreshSeedOptions();
            return;
        }
        persistSeeds(remaining);
        refreshSeedOptions();
        if (elements.savedSeedList) {
            elements.savedSeedList.selectedIndex = -1;
        }
        showStatus(`已刪除 ${deletedCount} 筆種子。`, 'success');
    };

    const runPrediction = async () => {
        if (globalState.running) return;
        toggleRunning(true);

        try {
            const selectedModel = elements.modelType ? elements.modelType.value : globalState.activeModel;
            const normalizedModel = Object.values(MODEL_TYPES).includes(selectedModel)
                ? selectedModel
                : DEFAULT_MODEL;

            if (globalState.activeModel !== normalizedModel) {
                captureActiveModelSettings();
                globalState.activeModel = normalizedModel;
                applyModelSettingsToUI(getActiveModelState());
            }

            const modelState = getActiveModelState();
            captureActiveModelSettings();

            const hyperparameters = { ...modelState.hyperparameters };
            const riskOptions = {
                threshold: Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5,
                useKelly: Boolean(modelState.kellyEnabled),
                fixedFraction: sanitizeFraction(modelState.fixedFraction),
            };

            const rows = getVisibleData();
            if (!Array.isArray(rows) || rows.length === 0) {
                showStatus(`[${formatModelLabel(normalizedModel)}] 尚未取得回測資料，請先在主頁面執行回測。`, 'warning');
                return;
            }

            if (normalizedModel === MODEL_TYPES.LSTM) {
                await runLstmModel(modelState, rows, hyperparameters, riskOptions);
            } else {
                await runAnnModel(modelState, rows, hyperparameters, riskOptions);
            }
        } catch (error) {
            const activeLabel = formatModelLabel(globalState.activeModel);
            console.error('[AI Prediction] 執行失敗:', error);
            const message = error instanceof Error ? error.message : String(error || '未知錯誤');
            showStatus(`[${activeLabel}] AI 預測執行失敗：${message}`, 'error');
        } finally {
            toggleRunning(false);
        }
    };
    const handleModelChange = () => {
        if (!elements.modelType) return;
        const selected = elements.modelType.value;
        const normalized = Object.values(MODEL_TYPES).includes(selected) ? selected : DEFAULT_MODEL;
        if (globalState.activeModel === normalized) {
            applyModelSettingsToUI(getActiveModelState());
            renderActiveModelOutputs();
            refreshSeedOptions();
            return;
        }
        captureActiveModelSettings();
        globalState.activeModel = normalized;
        if (elements.modelType.value !== normalized) {
            elements.modelType.value = normalized;
        }
        applyModelSettingsToUI(getActiveModelState());
        refreshSeedOptions();
        renderActiveModelOutputs();
    };

    const init = () => {
        elements.datasetSummary = document.getElementById('ai-dataset-summary');
        elements.status = document.getElementById('ai-status');
        elements.runButton = document.getElementById('ai-run-button');
        elements.modelType = document.getElementById('ai-model-type');
        elements.trainRatio = document.getElementById('ai-train-ratio');
        elements.trainRatioBadge = document.getElementById('ai-train-ratio-badge');
        elements.lookback = document.getElementById('ai-lookback');
        elements.epochs = document.getElementById('ai-epochs');
        elements.batchSize = document.getElementById('ai-batch-size');
        elements.learningRate = document.getElementById('ai-learning-rate');
        elements.enableKelly = document.getElementById('ai-enable-kelly');
        elements.fixedFraction = document.getElementById('ai-fixed-fraction');
        elements.winThreshold = document.getElementById('ai-win-threshold');
        elements.optimizeThreshold = document.getElementById('ai-optimize-threshold');
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
        elements.nextDayForecast = document.getElementById('ai-next-day-forecast');
        elements.seedName = document.getElementById('ai-seed-name');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.savedSeedList = document.getElementById('ai-saved-seeds');
        elements.loadSeedButton = document.getElementById('ai-load-seed');
        elements.deleteSeedButton = document.getElementById('ai-delete-seed');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.modelType) {
            elements.modelType.addEventListener('change', () => {
                handleModelChange();
            });
        }

        if (elements.trainRatio) {
            elements.trainRatio.addEventListener('change', () => {
                parseTrainRatio();
                captureActiveModelSettings();
            });
        }

        if (elements.enableKelly) {
            elements.enableKelly.addEventListener('change', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.fixedFraction) {
            elements.fixedFraction.addEventListener('change', () => {
                recomputeTradesFromState();
            });
            elements.fixedFraction.addEventListener('blur', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.winThreshold) {
            elements.winThreshold.addEventListener('change', () => {
                recomputeTradesFromState();
            });
            elements.winThreshold.addEventListener('blur', () => {
                recomputeTradesFromState();
            });
        }

        if (elements.optimizeThreshold) {
            elements.optimizeThreshold.addEventListener('click', () => {
                optimiseWinThreshold();
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

        if (elements.deleteSeedButton) {
            elements.deleteSeedButton.addEventListener('click', () => {
                handleDeleteSeeds();
            });
        }

        applyModelSettingsToUI(getActiveModelState());
        renderActiveModelOutputs();
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
