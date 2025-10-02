/* global document, window, workerUrl */

// Patch Tag: LB-AI-TRADE-RULE-20251229A — Triple entry rules & deterministic evaluation.
// Patch Tag: LB-AI-TRADE-VOLATILITY-20251230A — Volatility-tier strategy & multi-class forecasts.
// Patch Tag: LB-AI-CLASS-MODE-20251230B — Classification mode toggle & binary-compatible pipelines.
// Patch Tag: LB-AI-VOL-QUARTILE-20251231A — Train-set quartile thresholds for volatility tiers.
// Patch Tag: LB-AI-VOL-QUARTILE-20260102A — Lock volatility UI to quartile-derived thresholds & fix ANN seed override.
// Patch Tag: LB-AI-VOL-QUARTILE-20260105A — Positive/negative quartile tiers & full prediction table toggle.
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-VOL-QUARTILE-20260105A';
    const DEFAULT_FIXED_FRACTION = 1;
    const SEED_STORAGE_KEY = 'lazybacktest-ai-seeds-v1';
    const MODEL_TYPES = {
        LSTM: 'lstm',
        ANNS: 'anns',
    };
    const MODEL_LABELS = {
        [MODEL_TYPES.LSTM]: 'LSTM 長短期記憶網路',
        [MODEL_TYPES.ANNS]: 'ANNS 技術指標感知器',
    };
    const formatModelLabel = (modelType) => MODEL_LABELS[modelType] || 'AI 模型';
    const CLASSIFICATION_MODES = {
        BINARY: 'binary',
        MULTICLASS: 'multiclass',
    };
    const normalizeClassificationMode = (mode) => (mode === CLASSIFICATION_MODES.BINARY
        ? CLASSIFICATION_MODES.BINARY
        : CLASSIFICATION_MODES.MULTICLASS);
    const DEFAULT_VOLATILITY_THRESHOLDS = { surge: 0.03, drop: 0.03 };
    const VOLATILITY_CLASS_LABELS = ['大跌', '小幅波動', '大漲'];

    const TRADE_RULE_OPTIONS = [
        {
            value: 'close-trigger',
            label: '收盤價掛單',
            description: '買入邏輯：隔日預測上漲且隔日最低價跌破當日收盤價時，若隔日開盤價低於當日收盤價則以開盤價成交，否則以當日收盤價成交，並於隔日收盤價出場。',
        },
        {
            value: 'close-entry',
            label: '收盤價買入',
            description: '買入邏輯：預測上漲時即以當日收盤價買入，並於隔日收盤價出場。',
        },
        {
            value: 'open-entry',
            label: '開盤價買入',
            description: '買入邏輯：隔日預測上漲時即以隔日開盤價買入，並於隔日收盤價出場。',
        },
        {
            value: 'volatility-tier',
            label: '波動分級持有',
            description: '買賣邏輯：模型依「大漲／小幅波動／大跌」三類判斷；當預測落在大漲區間且機率達門檻時於當日收盤價進場，之後小幅波動僅持有，遇到預測大跌且機率達門檻時於當日收盤前出場（門檻固定為訓練集上漲樣本前 25% 與下跌樣本前 25% 的四分位漲跌幅）。',
        },
    ];
    const DEFAULT_TRADE_RULE = TRADE_RULE_OPTIONS[0].value;
    const TRADE_RULE_MAP = TRADE_RULE_OPTIONS.reduce((acc, option) => {
        acc[option.value] = option;
        return acc;
    }, {});
    const ANN_META_MESSAGE = 'ANN_META';
    const ANN_META_STORAGE_KEY = 'LB_ANN_META';
    const LSTM_META_MESSAGE = 'LSTM_META';
    const LSTM_META_STORAGE_KEY = 'LB_LSTM_META';
    const createModelState = () => ({
        lastSummary: null,
        odds: 1,
        predictionsPayload: null,
        trainingMetrics: null,
        currentTrades: [],
        allPredictionRows: [],
        lastSeedDefault: '',
        winThreshold: 0.5,
        kellyEnabled: false,
        fixedFraction: DEFAULT_FIXED_FRACTION,
        lastRunMeta: null,
        hyperparameters: {
            lookback: 20,
            epochs: 80,
            batchSize: 64,
            learningRate: 0.005,
            trainRatio: 0.8,
            seed: null,
        },
        tradeRule: DEFAULT_TRADE_RULE,
        classification: CLASSIFICATION_MODES.MULTICLASS,
        volatilityThresholds: { ...DEFAULT_VOLATILITY_THRESHOLDS },
    });
    const globalState = {
        running: false,
        activeModel: MODEL_TYPES.ANNS,
        showAllPredictions: false,
        models: {
            [MODEL_TYPES.LSTM]: createModelState(),
            [MODEL_TYPES.ANNS]: createModelState(),
        },
    };
    const getModelState = (model) => {
        if (!model || !globalState.models[model]) {
            return globalState.models[MODEL_TYPES.ANNS];
        }
        return globalState.models[model];
    };
    const getActiveModelState = () => getModelState(globalState.activeModel);
    const getTradeRuleForModel = (model = globalState.activeModel) => {
        const state = getModelState(model);
        return normalizeTradeRule(state?.tradeRule);
    };

    let aiWorker = null;
    let aiWorkerSequence = 0;
    const aiWorkerRequests = new Map();

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        freshRunButton: null,
        modelType: null,
        classificationMode: null,
        trainRatio: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
        winThreshold: null,
        optimizeThreshold: null,
        optimizeTarget: null,
        optimizeMinTrades: null,
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
        toggleAllTrades: null,
        seedName: null,
        saveSeedButton: null,
        savedSeedList: null,
        loadSeedButton: null,
        deleteSeedButton: null,
        tradeRuleSelect: null,
        tradeRules: null,
        volatilitySurge: null,
        volatilityDrop: null,
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };
    const FRACTION_MIN_PERCENT = 1;
    const FRACTION_MAX_PERCENT = 100;
    const DAY_MS = 24 * 60 * 60 * 1000;

    const normalizeTradeRule = (rule) => (TRADE_RULE_MAP[rule] ? rule : DEFAULT_TRADE_RULE);
    const getTradeRuleConfig = (rule) => TRADE_RULE_MAP[normalizeTradeRule(rule)];
    const getTradeRuleDescription = (rule) => getTradeRuleConfig(rule).description;
    const updateTradeRuleDescription = (rule) => {
        if (!elements.tradeRules) return;
        const normalized = normalizeTradeRule(rule);
        let description = getTradeRuleDescription(normalized);
        if (normalized === 'volatility-tier') {
            const state = getModelState(globalState.activeModel);
            const classificationMode = state?.classification || CLASSIFICATION_MODES.MULTICLASS;
            if (classificationMode === CLASSIFICATION_MODES.BINARY) {
                description = '買賣邏輯：模型採二分類判斷，當預測隔日上漲且機率達門檻時於當日收盤進場，之後持有至預測隔日下跌且機率達門檻時於當日收盤出場。';
            } else {
                const thresholds = sanitizeVolatilityThresholds(state?.volatilityThresholds);
                description = `${description}（${formatVolatilityDescription(thresholds)}）`;
            }
        }
        elements.tradeRules.textContent = description;
    };

    const updateClassificationUIState = (_mode = CLASSIFICATION_MODES.MULTICLASS) => {
        const surgeLabel = elements.volatilitySurge ? elements.volatilitySurge.closest('label') : null;
        const dropLabel = elements.volatilityDrop ? elements.volatilityDrop.closest('label') : null;
        [elements.volatilitySurge, elements.volatilityDrop].forEach((input) => {
            if (!input) return;
            input.disabled = true;
            input.setAttribute('aria-disabled', 'true');
            input.setAttribute('title', '門檻由訓練集上漲樣本前 25% 與下跌樣本前 25% 的四分位自動決定');
            input.classList.add('cursor-not-allowed');
        });
        [surgeLabel, dropLabel].forEach((label) => {
            if (label && label.classList) {
                label.classList.add('opacity-60');
            }
        });
        updateTradeRuleDescription(getTradeRuleForModel());
    };

    const convertFractionToPercent = (fraction) => {
        const sanitized = sanitizeFraction(Number.isFinite(fraction) ? fraction : DEFAULT_FIXED_FRACTION);
        const percent = sanitized * 100;
        if (!Number.isFinite(percent)) {
            return FRACTION_MIN_PERCENT;
        }
        return Math.min(Math.max(percent, FRACTION_MIN_PERCENT), FRACTION_MAX_PERCENT);
    };

    const syncFractionInputDisplay = (fraction) => {
        if (!elements.fixedFraction) return;
        const percent = convertFractionToPercent(fraction);
        const display = Number(percent.toFixed(2));
        elements.fixedFraction.value = Number.isFinite(display)
            ? String(display)
            : String(convertFractionToPercent(DEFAULT_FIXED_FRACTION));
    };

    const readFractionFromInput = (fallbackFraction = DEFAULT_FIXED_FRACTION) => {
        if (!elements.fixedFraction) return sanitizeFraction(fallbackFraction);
        const fallbackPercent = convertFractionToPercent(fallbackFraction);
        const percentValue = parseNumberInput(elements.fixedFraction, fallbackPercent, {
            min: FRACTION_MIN_PERCENT,
            max: FRACTION_MAX_PERCENT,
        });
        const normalized = sanitizeFraction(percentValue / 100);
        const display = Number(percentValue.toFixed(2));
        elements.fixedFraction.value = Number.isFinite(display)
            ? String(display)
            : String(fallbackPercent);
        return normalized;
    };

    let seedSaveFeedbackTimer = null;

    const formatPrice = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    };

    const computeNextTradingDate = (dateString) => {
        if (typeof dateString !== 'string' || !dateString) return null;
        const base = new Date(`${dateString}T00:00:00Z`);
        if (Number.isNaN(base.getTime())) return null;
        const candidate = new Date(base.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + 1);
        let weekday = candidate.getUTCDay();
        while (weekday === 0 || weekday === 6) {
            candidate.setUTCDate(candidate.getUTCDate() + 1);
            weekday = candidate.getUTCDay();
        }
        return candidate.toISOString().slice(0, 10);
    };

    const resolveOpenValue = (row, fallback) => {
        const candidates = [row?.open, row?.adjustedOpen, row?.adjOpen, row?.rawOpen];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(candidates[i]);
            if (Number.isFinite(value) && value > 0) return value;
        }
        return Number.isFinite(fallback) && fallback > 0 ? fallback : NaN;
    };

    const resolveLowValue = (row, fallback) => {
        const value = Number(row?.low);
        if (Number.isFinite(value)) return value;
        return Number.isFinite(fallback) ? fallback : NaN;
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
                        : MODEL_TYPES.LSTM;
                    return { ...seed, modelType: normalizedModel };
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

    const persistAnnMeta = (meta) => {
        if (!meta || typeof meta !== 'object') return;
        const modelState = globalState.models[MODEL_TYPES.ANNS];
        if (modelState) {
            modelState.lastRunMeta = { ...meta };
        }
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const payload = { ...meta, savedAt: new Date().toISOString() };
            window.localStorage.setItem(ANN_META_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('[AI Prediction] 無法儲存 ANN 執行資訊：', error);
        }
    };

    const persistLstmMeta = (meta) => {
        if (!meta || typeof meta !== 'object') return;
        const modelState = globalState.models[MODEL_TYPES.LSTM];
        if (modelState) {
            modelState.lastRunMeta = { ...meta };
        }
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const payload = { ...meta, savedAt: new Date().toISOString() };
            window.localStorage.setItem(LSTM_META_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('[AI Prediction] 無法儲存 LSTM 執行資訊：', error);
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

    const sanitizeFraction = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return DEFAULT_FIXED_FRACTION;
        return Math.min(Math.max(num, 0.01), 1);
    };

    const computeQuantileValue = (values, percentile) => {
        if (!Array.isArray(values) || values.length === 0) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const clamped = Math.min(Math.max(percentile, 0), 1);
        if (sorted.length === 1 || clamped === 0) return sorted[0];
        if (clamped === 1) return sorted[sorted.length - 1];
        const position = (sorted.length - 1) * clamped;
        const lowerIndex = Math.floor(position);
        const upperIndex = Math.min(lowerIndex + 1, sorted.length - 1);
        const weight = position - lowerIndex;
        const lowerValue = sorted[lowerIndex];
        const upperValue = sorted[upperIndex];
        if (!Number.isFinite(lowerValue)) return upperValue;
        if (!Number.isFinite(upperValue)) return lowerValue;
        return lowerValue + ((upperValue - lowerValue) * weight);
    };

    const sanitizeVolatilityThresholds = (input = {}) => {
        const fallbackSurge = DEFAULT_VOLATILITY_THRESHOLDS.surge;
        const fallbackDrop = DEFAULT_VOLATILITY_THRESHOLDS.drop;
        const rawSurge = Number(input?.surge);
        const rawDrop = Number(input?.drop);
        const rawLower = Number(input?.lowerQuantile);
        const rawUpper = Number(input?.upperQuantile);

        let surge = Number.isFinite(rawSurge) && Math.abs(rawSurge) > 0 ? Math.abs(rawSurge) : NaN;
        let drop = Number.isFinite(rawDrop) && Math.abs(rawDrop) > 0 ? Math.abs(rawDrop) : NaN;

        if (!(surge > 0) && Number.isFinite(rawUpper) && Math.abs(rawUpper) > 0) {
            surge = Math.abs(rawUpper);
        }
        if (!(drop > 0) && Number.isFinite(rawLower) && Math.abs(rawLower) > 0) {
            drop = Math.abs(rawLower);
        }

        if (!(surge > 0)) {
            surge = fallbackSurge;
        }
        if (!(drop > 0)) {
            drop = fallbackDrop;
        }

        surge = Math.min(Math.max(surge, 0.0001), 0.5);
        drop = Math.min(Math.max(drop, 0.0001), 0.5);

        let lowerQuantile;
        if (Number.isFinite(rawLower) && Math.abs(rawLower) > 0) {
            lowerQuantile = rawLower > 0 ? -Math.abs(rawLower) : Math.max(rawLower, -0.5);
        } else {
            lowerQuantile = -drop;
        }

        let upperQuantile;
        if (Number.isFinite(rawUpper) && Math.abs(rawUpper) > 0) {
            upperQuantile = rawUpper < 0 ? Math.abs(rawUpper) : Math.min(rawUpper, 0.5);
        } else {
            upperQuantile = surge;
        }

        upperQuantile = Math.min(Math.max(upperQuantile, 0.0001), 0.5);
        lowerQuantile = Math.max(Math.min(lowerQuantile, -0.0001), -0.5);

        return {
            surge,
            drop,
            lowerQuantile,
            upperQuantile,
        };
    };

    const deriveVolatilityThresholdsFromReturns = (values, fallback = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const fallbackSanitized = sanitizeVolatilityThresholds(fallback);
        if (!Array.isArray(values) || values.length === 0) {
            return fallbackSanitized;
        }
        const filtered = values.filter((value) => Number.isFinite(value));
        if (filtered.length === 0) {
            return fallbackSanitized;
        }
        const lower = computeQuantileValue(filtered, 0.25);
        const upper = computeQuantileValue(filtered, 0.75);
        const dropMagnitude = Number.isFinite(lower) && lower < 0
            ? Math.min(Math.abs(lower), 0.5)
            : fallbackSanitized.drop;
        const surgeMagnitude = Number.isFinite(upper) && upper > 0
            ? Math.min(Math.abs(upper), 0.5)
            : fallbackSanitized.surge;
        const lowerQuantile = Number.isFinite(lower) && lower < 0 ? lower : -dropMagnitude;
        const upperQuantile = Number.isFinite(upper) && upper > 0 ? upper : surgeMagnitude;
        return sanitizeVolatilityThresholds({
            surge: surgeMagnitude,
            drop: dropMagnitude,
            lowerQuantile,
            upperQuantile,
        });
    };

    const classifySwingReturn = (value, thresholds) => {
        if (!Number.isFinite(value)) return 1;
        const upper = Number.isFinite(thresholds?.upperQuantile) ? thresholds.upperQuantile : thresholds?.surge;
        const lower = Number.isFinite(thresholds?.lowerQuantile)
            ? thresholds.lowerQuantile
            : (Number.isFinite(thresholds?.drop) ? -thresholds.drop : -DEFAULT_VOLATILITY_THRESHOLDS.drop);
        if (Number.isFinite(upper) && value >= upper) {
            return 2;
        }
        if (Number.isFinite(lower) && value <= lower) {
            return 0;
        }
        const fallbackSurge = Number.isFinite(thresholds?.surge) ? thresholds.surge : DEFAULT_VOLATILITY_THRESHOLDS.surge;
        const fallbackDrop = Number.isFinite(thresholds?.drop) ? thresholds.drop : DEFAULT_VOLATILITY_THRESHOLDS.drop;
        if (Number.isFinite(fallbackSurge) && value >= fallbackSurge) {
            return 2;
        }
        if (Number.isFinite(fallbackDrop) && value <= -fallbackDrop) {
            return 0;
        }
        return 1;
    };

    const volatilityToPercent = (thresholds = DEFAULT_VOLATILITY_THRESHOLDS) => ({
        surge: Number(((thresholds?.surge ?? DEFAULT_VOLATILITY_THRESHOLDS.surge) * 100).toFixed(2)),
        drop: Number(((thresholds?.drop ?? DEFAULT_VOLATILITY_THRESHOLDS.drop) * 100).toFixed(2)),
    });

    const formatVolatilityDescription = (thresholds = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const percent = volatilityToPercent(thresholds);
        return `大漲≧${percent.surge.toFixed(2)}%｜大跌≧${percent.drop.toFixed(2)}%`;
    };

    const normalizeProbabilities = (values) => {
        const probs = values.map((value) => {
            const num = Number(value);
            if (!Number.isFinite(num)) return 0;
            if (num < 0) return 0;
            if (num > 1) return 1;
            return num;
        });
        const sum = probs.reduce((acc, value) => acc + value, 0);
        if (sum <= 0) {
            return [1 / 3, 1 / 3, 1 / 3];
        }
        return probs.map((value) => value / sum);
    };

    const parsePredictionEntry = (value, mode = CLASSIFICATION_MODES.MULTICLASS) => {
        const classificationMode = normalizeClassificationMode(mode);
        const clampProbability = (num, fallback = 0) => {
            const parsed = Number(num);
            if (!Number.isFinite(parsed)) return fallback;
            if (parsed < 0) return 0;
            if (parsed > 1) return 1;
            return parsed;
        };
        if (Array.isArray(value)) {
            let probabilities;
            if (value.length >= 3) {
                probabilities = normalizeProbabilities([value[0], value[1], value[2]]);
            } else if (classificationMode === CLASSIFICATION_MODES.BINARY) {
                const pUp = clampProbability(value[value.length - 1], 0.5);
                const pDown = clampProbability(value[0], 1 - pUp);
                probabilities = normalizeProbabilities([pDown, 0, pUp]);
            } else if (value.length === 2) {
                probabilities = normalizeProbabilities([value[0], value[1], 1 - (Number(value[0]) + Number(value[1]))]);
            } else {
                const base = clampProbability(value[0], 1 / 3);
                probabilities = normalizeProbabilities([base, base, base]);
            }
            const classIndex = probabilities.indexOf(Math.max(...probabilities));
            return {
                probabilities,
                pDown: probabilities[0],
                pFlat: probabilities[1],
                pUp: probabilities[2],
                classIndex,
            };
        }
        if (value && typeof value === 'object') {
            if (Array.isArray(value.probabilities)) {
                return parsePredictionEntry(value.probabilities, classificationMode);
            }
            if (Array.isArray(value.probs)) {
                return parsePredictionEntry(value.probs, classificationMode);
            }
            if (typeof value.pUp === 'number' || typeof value.up === 'number') {
                const upValue = Number(value.pUp ?? value.up);
                const downValue = Number(value.pDown ?? value.down ?? (1 - upValue));
                const flatValue = Number(value.pFlat ?? value.flat ?? (1 - upValue - downValue));
                return parsePredictionEntry([downValue, flatValue, upValue], classificationMode);
            }
        }
        const fallback = classificationMode === CLASSIFICATION_MODES.BINARY ? 0.5 : (1 / 3);
        const probability = clampProbability(value, fallback);
        if (classificationMode === CLASSIFICATION_MODES.BINARY) {
            const pUp = probability;
            const pDown = 1 - pUp;
            const probabilities = normalizeProbabilities([pDown, 0, pUp]);
            return {
                probabilities,
                pDown: probabilities[0],
                pFlat: probabilities[1],
                pUp: probabilities[2],
                classIndex: probabilities[2] >= probabilities[0] ? 2 : 0,
            };
        }
        return {
            probabilities: [1 / 3, 1 / 3, 1 / 3],
            pDown: 1 / 3,
            pFlat: 1 / 3,
            pUp: 1 / 3,
            classIndex: 1,
        };
    };

    const formatClassLabel = (index, mode = CLASSIFICATION_MODES.MULTICLASS) => {
        const classificationMode = normalizeClassificationMode(mode);
        if (classificationMode === CLASSIFICATION_MODES.BINARY) {
            return index === 2 ? '預測上漲' : '預測下跌';
        }
        return VOLATILITY_CLASS_LABELS[index] || VOLATILITY_CLASS_LABELS[1];
    };

    const readVolatilityThresholdsFromInputs = (fallback = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const sanitized = sanitizeVolatilityThresholds(fallback);
        const percent = volatilityToPercent(sanitized);
        if (elements.volatilitySurge) {
            elements.volatilitySurge.value = percent.surge.toFixed(2);
        }
        if (elements.volatilityDrop) {
            elements.volatilityDrop.value = percent.drop.toFixed(2);
        }
        return sanitized;
    };

    const annotateForecast = (forecast, payload) => {
        if (!forecast || !Number.isFinite(forecast.probability)) return null;
        const annotated = { ...forecast };
        const referenceDate = typeof annotated.referenceDate === 'string'
            ? annotated.referenceDate
            : (typeof payload?.datasetLastDate === 'string' ? payload.datasetLastDate : null);
        if (!annotated.tradeDate || typeof annotated.tradeDate !== 'string') {
            const computedDate = computeNextTradingDate(referenceDate);
            if (computedDate) {
                annotated.tradeDate = computedDate;
            }
        }
        if (!Number.isFinite(annotated.buyPrice) && Number.isFinite(payload?.lastClose)) {
            annotated.buyPrice = payload.lastClose;
        }
        if (referenceDate && !annotated.referenceDate) {
            annotated.referenceDate = referenceDate;
        }
        if (referenceDate && !annotated.buyDate) {
            annotated.buyDate = referenceDate;
        }
        if (annotated.tradeDate && !annotated.sellDate) {
            annotated.sellDate = annotated.tradeDate;
        }
        return annotated;
    };

    const generateRuntimeSeed = () => {
        if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            const seeded = array[0] >>> 0;
            if (seeded > 0) {
                return seeded;
            }
        }
        const timeComponent = Date.now() & 0x7fffffff;
        const randomComponent = Math.floor((Math.random() * 0x7fffffff) % 0x7fffffff);
        const combined = (timeComponent ^ randomComponent) & 0x7fffffff;
        return combined > 0 ? combined : (timeComponent || 1);
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
            .sort((a, b) => (Number(b?.createdAt || 0) - Number(a?.createdAt || 0)))
            .map((seed) => `<option value="${escapeHTML(seed.id)}">${escapeHTML(seed.name || '未命名種子')}</option>`)
            .join('');
        elements.savedSeedList.innerHTML = options;
    };

    const buildSeedDefaultName = (summary, modelType = globalState.activeModel) => {
        const prefix = modelType === MODEL_TYPES.LSTM ? '【LSTM】' : '【ANNS】';
        if (!summary) {
            return `${prefix}尚未產生預設名稱`;
        }
        const testText = formatPercent(summary.testAccuracy, 1);
        const medianText = formatPercent(summary.tradeReturnMedian, 2);
        const singleAverage = Number.isFinite(summary.tradeReturnAverageSingle)
            ? formatPercent(summary.tradeReturnAverageSingle, 2)
            : formatPercent(summary.tradeReturnAverage, 2);
        const monthlyText = formatPercent(summary.tradeReturnAverageMonthly, 2);
        const yearlyText = formatPercent(summary.tradeReturnAverageYearly, 2);
        const tradeCountText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
        return `${prefix}測試勝率${testText}｜交易報酬中位數${medianText}｜單次平均報酬${singleAverage}｜月平均報酬${monthlyText}｜年平均報酬${yearlyText}｜交易次數${tradeCountText}`;
    };

    const applySeedDefaultName = (summary, modelType = globalState.activeModel, options = {}) => {
        const modelState = getModelState(modelType);
        const previousDefault = modelState?.lastSeedDefault || '';
        const defaultName = buildSeedDefaultName(summary, modelType);
        if (modelState) {
            modelState.lastSeedDefault = defaultName;
        }
        if (!elements.seedName || globalState.activeModel !== modelType) {
            return;
        }
        const currentValue = elements.seedName.value || '';
        const previousDatasetDefault = elements.seedName.dataset?.defaultName || '';
        const shouldUpdate = Boolean(options.force)
            || !currentValue
            || currentValue === previousDatasetDefault
            || currentValue === previousDefault;
        elements.seedName.dataset.defaultName = defaultName;
        if (shouldUpdate) {
            elements.seedName.value = defaultName;
        }
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
        const { type, id, data, error, message, payload } = event.data;
        if (type === ANN_META_MESSAGE) {
            if (payload && typeof payload === 'object') {
                persistAnnMeta(payload);
            }
            return;
        }
        if (type === LSTM_META_MESSAGE) {
            if (payload && typeof payload === 'object') {
                persistLstmMeta(payload);
            }
            return;
        }
        const isProgress = type === 'ai-train-lstm-progress' || type === 'ai-train-ann-progress';
        if (isProgress) {
            const pending = id ? aiWorkerRequests.get(id) : null;
            const fallbackModel = type === 'ai-train-ann-progress' ? MODEL_TYPES.ANNS : MODEL_TYPES.LSTM;
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
        const modelType = pending.modelType || (pending.taskType === 'ai-train-ann' ? MODEL_TYPES.ANNS : MODEL_TYPES.LSTM);
        if (type === 'ai-train-lstm-result' || type === 'ai-train-ann-result') {
            aiWorkerRequests.delete(id);
            const payload = data || {};
            payload.modelType = modelType;
            payload.taskType = pending.taskType;
            pending.resolve(payload);
        } else if (type === 'ai-train-lstm-error' || type === 'ai-train-ann-error') {
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
        const modelType = metadata.modelType || (taskType === 'ai-train-ann' ? MODEL_TYPES.ANNS : MODEL_TYPES.LSTM);
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
        if (elements.runButton) {
            elements.runButton.disabled = globalState.running;
            elements.runButton.classList.toggle('opacity-60', globalState.running);
            elements.runButton.classList.toggle('cursor-not-allowed', globalState.running);
        }
        if (elements.freshRunButton) {
            elements.freshRunButton.disabled = globalState.running;
            elements.freshRunButton.classList.toggle('opacity-60', globalState.running);
            elements.freshRunButton.classList.toggle('cursor-not-allowed', globalState.running);
        }
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

    const buildDataset = (rows, lookback, volatilityOverrides = DEFAULT_VOLATILITY_THRESHOLDS, classificationOverride = CLASSIFICATION_MODES.MULTICLASS) => {
        const classificationMode = normalizeClassificationMode(classificationOverride);
        if (!Array.isArray(rows)) {
            return { sequences: [], labels: [], meta: [], returns: [], swingTargets: [], baseRows: [] };
        }
        const volatilityThresholds = sanitizeVolatilityThresholds(volatilityOverrides);
        const sorted = rows
            .filter((row) => row && typeof row.date === 'string')
            .map((row) => {
                const close = resolveCloseValue(row);
                return {
                    date: row.date,
                    close,
                    open: resolveOpenValue(row, close),
                    low: resolveLowValue(row, close),
                };
            })
            .filter((row) => Number.isFinite(row.close) && row.close > 0)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (sorted.length <= lookback + 2) {
            return {
                sequences: [],
                labels: [],
                meta: [],
                returns: [],
                swingTargets: [],
                baseRows: sorted,
                lastClose: sorted.length > 0 ? sorted[sorted.length - 1].close : null,
            };
        }

        const priceChanges = [];
        const tradeReturns = [];
        const meta = [];
        for (let i = 1; i < sorted.length; i += 1) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            if (!Number.isFinite(prev.close) || prev.close <= 0 || !Number.isFinite(curr.close)) continue;
            const rawChange = (curr.close - prev.close) / prev.close;
            const nextLow = Number.isFinite(curr.low) ? curr.low : prev.close;
            const entryTrigger = prev.close;
            const nextOpen = Number.isFinite(curr.open) ? curr.open : entryTrigger;
            const entryEligible = Number.isFinite(nextLow) && nextLow < entryTrigger;
            const closeEntryBuyPrice = entryEligible
                ? (Number.isFinite(nextOpen) && nextOpen < entryTrigger ? nextOpen : entryTrigger)
                : entryTrigger;
            const sellPrice = curr.close;
            const closeEntryReturn = entryEligible && Number.isFinite(closeEntryBuyPrice) && closeEntryBuyPrice > 0
                ? (sellPrice - closeEntryBuyPrice) / closeEntryBuyPrice
                : 0;
            const openEntryBuyPrice = Number.isFinite(nextOpen) && nextOpen > 0 ? nextOpen : entryTrigger;
            const openEntryEligible = Number.isFinite(openEntryBuyPrice) && openEntryBuyPrice > 0 && Number.isFinite(sellPrice);
            const openEntryReturn = openEntryEligible
                ? (sellPrice - openEntryBuyPrice) / openEntryBuyPrice
                : 0;
            const actualReturn = closeEntryReturn;
            priceChanges.push(rawChange);
            tradeReturns.push(actualReturn);
            meta.push({
                buyDate: prev.date,
                sellDate: curr.date,
                tradeDate: curr.date,
                buyClose: prev.close,
                sellClose: curr.close,
                buyPrice: closeEntryBuyPrice,
                sellPrice,
                nextOpen,
                nextLow,
                entryEligible,
                closeEntryEligible: entryEligible,
                closeEntryBuyPrice,
                closeEntryReturn,
                openEntryEligible,
                openEntryBuyPrice,
                openEntrySellPrice: sellPrice,
                openEntryReturn,
                actualReturn,
                buyTrigger: entryTrigger,
                swingReturn: rawChange,
                classLabel: classificationMode === CLASSIFICATION_MODES.BINARY ? Number(actualReturn > 0) : 1,
            });
        }

        const sequences = [];
        const labels = [];
        const targetReturns = [];
        const swingTargets = [];
        for (let i = lookback; i < priceChanges.length; i += 1) {
            const feature = priceChanges.slice(i - lookback, i);
            if (feature.length !== lookback) continue;
            sequences.push(feature);
            labels.push(1);
            swingTargets.push(priceChanges[i]);
            targetReturns.push(tradeReturns[i]);
        }

        const metaAligned = meta.slice(lookback);
        return {
            sequences,
            labels,
            meta: metaAligned,
            returns: targetReturns,
            swingTargets,
            baseRows: sorted,
            lastClose: sorted.length > 0 ? sorted[sorted.length - 1].close : null,
            volatilityThresholds,
            classificationMode,
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

    const renderTrades = (records, forecast, showingAll = false) => {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = forecast && Number.isFinite(forecast.probability)
                ? `
                    <tr class="bg-muted/30">
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.buyDate || forecast.referenceDate || '最近收盤')}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.tradeDate || computeNextTradingDate(forecast.referenceDate) || forecast.referenceDate || '—')}
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>
                        </td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}${forecast.classLabel ? `<div class="text-[10px]" style="color: var(--muted-foreground);">${escapeHTML(forecast.classLabel)}</div>` : ''}</td>
                        <td class="px-3 py-2 text-right">${formatPrice(forecast.buyPrice)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                        <td class="px-3 py-2 text-right">—</td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                    </tr>
                `
                : '';
            return;
        }
        const sourceRows = showingAll ? rows : rows.slice(-200);
        const htmlParts = sourceRows.map((trade) => {
            const probabilityText = formatPercent(trade.probability, 1);
            const detailParts = [];
            if (trade.predictedClassLabel) {
                detailParts.push(escapeHTML(trade.predictedClassLabel));
            }
            if (showingAll) {
                const statusText = trade.executed
                    ? '已執行'
                    : (trade.triggered ? '達門檻（未成交）' : '未達門檻');
                detailParts.push(statusText);
            }
            const probabilityDetail = detailParts.length > 0
                ? `<div class="text-[10px]" style="color: var(--muted-foreground);">${detailParts.join('｜')}</div>`
                : '';
            const actualReturnText = formatPercent(trade.actualReturn, 2);
            const fractionText = formatPercent(trade.fraction, 2);
            const tradeReturnText = formatPercent(trade.tradeReturn, 2);
            const buyPriceText = formatPrice(trade.buyPrice);
            const sellPriceText = formatPrice(trade.sellPrice);
            const actualClass = Number.isFinite(trade.actualReturn) && trade.actualReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const tradeReturnClass = Number.isFinite(trade.tradeReturn) && trade.tradeReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const badge = trade.isForecast
                ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>`
                : '';
            const rowClass = [];
            if (trade.isForecast) {
                rowClass.push('bg-muted/30');
            } else if (showingAll && !trade.executed) {
                rowClass.push('opacity-75');
            }
            const rowClassAttr = rowClass.length > 0 ? ` class="${rowClass.join(' ')}"` : '';
            return `
                <tr${rowClassAttr}>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(trade.buyDate || '—')}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(trade.sellDate || trade.tradeDate || '—')}${badge}</td>
                    <td class="px-3 py-2 text-right">${probabilityText}${probabilityDetail}</td>
                    <td class="px-3 py-2 text-right">${buyPriceText}</td>
                    <td class="px-3 py-2 text-right">${sellPriceText}</td>
                    <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                    <td class="px-3 py-2 text-right">${fractionText}</td>
                    <td class="px-3 py-2 text-right ${tradeReturnClass}">${tradeReturnText}</td>
                </tr>
            `;
        });

        if (forecast && Number.isFinite(forecast.probability)) {
            const tradeDateLabel = forecast.tradeDate || computeNextTradingDate(forecast.referenceDate) || forecast.referenceDate || '最近收盤';
            const forecastDetail = forecast.classLabel
                ? `<div class="text-[10px]" style="color: var(--muted-foreground);">${escapeHTML(forecast.classLabel)}</div>`
                : '';
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.buyDate || forecast.referenceDate || '最近收盤')}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(tradeDateLabel)}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}${forecastDetail}</td>
                    <td class="px-3 py-2 text-right">${formatPrice(forecast.buyPrice)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                </tr>
            `);
        }

        elements.tradeTableBody.innerHTML = htmlParts.join('');
    };

    const updateAllPredictionsToggleButton = (modelState) => {
        if (!elements.toggleAllTrades) return;
        const total = Array.isArray(modelState?.allPredictionRows) ? modelState.allPredictionRows.length : 0;
        const executed = Array.isArray(modelState?.currentTrades) ? modelState.currentTrades.length : 0;
        const showingAll = Boolean(globalState.showAllPredictions && total > 0);
        elements.toggleAllTrades.disabled = total === 0;
        if (total === 0) {
            elements.toggleAllTrades.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
            elements.toggleAllTrades.classList.remove('opacity-60', 'cursor-not-allowed');
        }
        elements.toggleAllTrades.setAttribute('aria-pressed', showingAll ? 'true' : 'false');
        if (total === 0) {
            elements.toggleAllTrades.textContent = '顯示全部預測紀錄';
        } else if (showingAll) {
            elements.toggleAllTrades.textContent = `僅顯示觸發交易（${executed} 筆）`;
        } else {
            elements.toggleAllTrades.textContent = `顯示全部預測紀錄（共 ${total} 筆）`;
        }
    };

    const resetOutputs = () => {
        globalState.showAllPredictions = false;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = '—';
        if (elements.trainLoss) elements.trainLoss.textContent = 'Loss：—';
        if (elements.testAccuracy) elements.testAccuracy.textContent = '—';
        if (elements.testLoss) elements.testLoss.textContent = 'Loss：—';
        if (elements.tradeCount) elements.tradeCount.textContent = '—';
        if (elements.hitRate) elements.hitRate.textContent = '命中率：—｜勝率門檻：—';
        if (elements.totalReturn) elements.totalReturn.textContent = '—';
        if (elements.averageProfit) elements.averageProfit.textContent = '單次平均報酬%：—｜月平均報酬%：—｜年平均報酬%：—｜交易次數：0｜標準差：—';
        if (elements.tradeSummary) elements.tradeSummary.textContent = '尚未生成交易結果。';
        if (elements.nextDayForecast) elements.nextDayForecast.textContent = '尚未計算隔日預測。';
        if (elements.tradeTableBody) elements.tradeTableBody.innerHTML = '';
        if (elements.toggleAllTrades) {
            elements.toggleAllTrades.disabled = true;
            elements.toggleAllTrades.classList.add('opacity-60', 'cursor-not-allowed');
            elements.toggleAllTrades.textContent = '顯示全部預測紀錄';
            elements.toggleAllTrades.setAttribute('aria-pressed', 'false');
        }
        const rule = getTradeRuleForModel();
        if (elements.tradeRuleSelect) {
            elements.tradeRuleSelect.value = rule;
        }
        updateTradeRuleDescription(rule);
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        const activeClassification = normalizeClassificationMode(summary.classificationMode || getActiveModelState()?.classification);
        updateTradeRuleDescription(summary.tradeRule || getTradeRuleForModel());
        if (elements.tradeRuleSelect && summary.tradeRule) {
            elements.tradeRuleSelect.value = normalizeTradeRule(summary.tradeRule);
        }
        if (elements.fixedFraction) {
            syncFractionInputDisplay(summary.fixedFraction);
        }
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
            const singleText = formatPercent(Number.isFinite(summary.tradeReturnAverageSingle)
                ? summary.tradeReturnAverageSingle
                : summary.tradeReturnAverage, 2);
            const monthlyText = formatPercent(summary.tradeReturnAverageMonthly, 2);
            const yearlyText = formatPercent(summary.tradeReturnAverageYearly, 2);
            const tradeCount = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
            elements.averageProfit.textContent = `單次平均報酬%：${singleText}｜月平均報酬%：${monthlyText}｜年平均報酬%：${yearlyText}｜交易次數：${tradeCount}｜標準差：${stdText}`;
        }
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly
                ? '已啟用凱利公式'
                : `固定投入 ${formatPercent(summary.fixedFraction, 2)}`;
            const medianText = formatPercent(summary.tradeReturnMedian, 2);
            const singleText = formatPercent(Number.isFinite(summary.tradeReturnAverageSingle)
                ? summary.tradeReturnAverageSingle
                : summary.tradeReturnAverage, 2);
            const monthlyText = formatPercent(summary.tradeReturnAverageMonthly, 2);
            const yearlyText = formatPercent(summary.tradeReturnAverageYearly, 2);
            const totalText = Number.isFinite(summary.tradeReturnTotal)
                ? formatPercent(summary.tradeReturnTotal, 2)
                : null;
            const totalPredictions = Number.isFinite(summary.totalPredictions) ? summary.totalPredictions : 0;
            const executedCount = Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0;
            const periodClause = summary.tradePeriodStart && summary.tradePeriodEnd
                ? `測試期間 ${summary.tradePeriodStart} ~ ${summary.tradePeriodEnd}，`
                : '';
            const totalClause = totalText ? `交易報酬% 總和 ${totalText}，` : '';
            elements.tradeSummary.textContent = `${periodClause}共評估 ${totalPredictions} 筆測試樣本，勝率門檻設定為 ${Math.round((summary.threshold || 0.5) * 100)}%，執行 ${executedCount} 筆交易，${strategyLabel}。${totalClause}交易報酬% 中位數 ${medianText}，單次平均報酬% ${singleText}，月平均報酬% ${monthlyText}，年平均報酬% ${yearlyText}。`;
        }
        if (elements.nextDayForecast) {
            const threshold = Number.isFinite(summary.threshold) ? summary.threshold : parseWinThreshold();
            const forecast = summary.forecast;
            if (!forecast || !Number.isFinite(forecast.probability)) {
                elements.nextDayForecast.textContent = '尚未計算隔日預測。';
            } else {
                const baseLabel = forecast.referenceDate ? `以 ${forecast.referenceDate} 收盤為基準` : '以最近一次收盤為基準';
                const meetsThreshold = Number.isFinite(threshold)
                    ? (forecast.probability >= threshold
                        ? '符合當前勝率門檻，可列入隔日進場條件評估。'
                        : '未達當前勝率門檻，建議僅作為觀察參考。')
                    : '';
                const kellyText = summary.usingKelly && Number.isFinite(forecast.fraction)
                    ? `凱利公式建議投入比例約 ${formatPercent(forecast.fraction, 2)}。`
                    : '';
                const classLabel = forecast.classLabel || formatClassLabel(forecast.predictedClass ?? (forecast.probability >= threshold ? 2 : 1), activeClassification);
                elements.nextDayForecast.textContent = `${baseLabel} 的隔日大漲機率為 ${formatPercent(forecast.probability, 1)}（預測分類：${classLabel}）；勝率門檻 ${Math.round(threshold * 100)}%，${meetsThreshold}${kellyText}`;
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
        const tradeRule = normalizeTradeRule(options.tradeRule);
        const volatilityThresholds = sanitizeVolatilityThresholds(options.volatilityThresholds || payload?.volatilityThresholds || DEFAULT_VOLATILITY_THRESHOLDS);
        const classificationMode = normalizeClassificationMode(payload?.classificationMode || payload?.hyperparameters?.classificationMode);

        const executedTrades = [];
        const tradeReturns = [];
        const executedDateValues = [];
        const dailyRecords = [];
        let wins = 0;

        const parseDateToUTC = (value) => {
            if (typeof value !== 'string' || !value) return NaN;
            const isoCandidate = value.length <= 10 ? `${value}T00:00:00Z` : value;
            const timestamp = Date.parse(isoCandidate);
            if (Number.isFinite(timestamp)) {
                return timestamp;
            }
            const fallback = Date.parse(value);
            return Number.isFinite(fallback) ? fallback : NaN;
        };

        if (tradeRule === 'volatility-tier') {
            let position = null;
            for (let i = 0; i < predictions.length; i += 1) {
                const metaItem = meta[i] || {};
                const parsed = parsePredictionEntry(predictions[i], classificationMode);
                const classIndex = parsed.classIndex;
                const entryProbability = parsed.pUp;
                const exitProbability = parsed.pDown;
                const dayClose = Number(metaItem.buyClose);
                const nextClose = Number(metaItem.sellClose);
                const exitDateCandidate = metaItem.sellDate || metaItem.tradeDate || metaItem.buyDate || null;
                const entryDateCandidate = metaItem.buyDate || metaItem.tradeDate || metaItem.sellDate || exitDateCandidate;

                if (position && Number.isFinite(dayClose) && dayClose > 0) {
                    position.lastPrice = dayClose;
                }

                const baseBuyPrice = Number.isFinite(metaItem.closeSameDayBuyPrice) && metaItem.closeSameDayBuyPrice > 0
                    ? metaItem.closeSameDayBuyPrice
                    : (Number.isFinite(metaItem.buyClose) ? metaItem.buyClose : NaN);
                const baseSellPrice = Number.isFinite(metaItem.sellPrice)
                    ? metaItem.sellPrice
                    : (Number.isFinite(metaItem.sellClose) ? metaItem.sellClose : NaN);
                const baseReturn = Number.isFinite(metaItem.swingReturn)
                    ? metaItem.swingReturn
                    : (Number.isFinite(metaItem.closeSameDayReturn)
                        ? metaItem.closeSameDayReturn
                        : (Number.isFinite(metaItem.actualReturn) ? metaItem.actualReturn : NaN));
                const entryEligible = Boolean(typeof metaItem.closeSameDayEligible === 'boolean'
                    ? metaItem.closeSameDayEligible
                    : (Number.isFinite(baseBuyPrice) && Number.isFinite(baseSellPrice)));
                const recordIndex = dailyRecords.length;
                const record = {
                    buyDate: entryDateCandidate || metaItem.buyDate || null,
                    sellDate: exitDateCandidate || metaItem.sellDate || entryDateCandidate || null,
                    tradeDate: exitDateCandidate || entryDateCandidate || null,
                    probability: entryProbability,
                    predictedClass: classIndex,
                    predictedClassLabel: formatClassLabel(classIndex, classificationMode),
                    classificationMode,
                    tradeRule,
                    entryEligible,
                    executed: false,
                    triggered: entryProbability >= threshold && classIndex === 2,
                    buyPrice: Number.isFinite(baseBuyPrice) ? baseBuyPrice : NaN,
                    sellPrice: Number.isFinite(baseSellPrice) ? baseSellPrice : NaN,
                    actualReturn: Number.isFinite(baseReturn) ? baseReturn : NaN,
                    fraction: 0,
                    tradeReturn: 0,
                    holdDays: 1,
                    probabilities: parsed.probabilities,
                    exitClass: classIndex,
                };

                let openedThisBar = false;
                if (!position && record.triggered && entryEligible && Number.isFinite(baseBuyPrice) && baseBuyPrice > 0) {
                    const fraction = useKelly
                        ? computeKellyFraction(entryProbability, trainingOdds)
                        : fixedFraction;
                    position = {
                        entryIndex: i,
                        entryRecordIndex: recordIndex,
                        entryDate: entryDateCandidate,
                        entrySellDateCandidate: exitDateCandidate,
                        entryPrice: baseBuyPrice,
                        entryProbability,
                        entryClassIndex: classIndex,
                        fraction,
                        holdDays: 0,
                        lastPrice: Number.isFinite(nextClose) && nextClose > 0
                            ? nextClose
                            : (Number.isFinite(dayClose) && dayClose > 0 ? dayClose : baseBuyPrice),
                    };
                    record.executed = true;
                    record.fraction = fraction;
                    openedThisBar = true;
                }

                const exitSignal = classIndex === 0 && exitProbability >= threshold;
                const isLastSample = i === predictions.length - 1;
                if (position && !openedThisBar && (exitSignal || isLastSample)) {
                    let exitPrice = position.lastPrice;
                    let exitDate = exitDateCandidate || entryDateCandidate;
                    if (exitSignal) {
                        if (Number.isFinite(dayClose) && dayClose > 0) {
                            exitPrice = dayClose;
                        }
                        exitDate = entryDateCandidate || exitDateCandidate;
                    } else if (Number.isFinite(nextClose) && nextClose > 0) {
                        exitPrice = nextClose;
                    }

                    if (Number.isFinite(exitPrice) && exitPrice > 0 && Number.isFinite(position.entryPrice) && position.entryPrice > 0) {
                        const grossReturn = (exitPrice - position.entryPrice) / position.entryPrice;
                        const fraction = Number.isFinite(position.fraction)
                            ? position.fraction
                            : (useKelly ? computeKellyFraction(position.entryProbability, trainingOdds) : fixedFraction);
                        const tradeReturn = grossReturn * fraction;
                        if (grossReturn > 0) {
                            wins += 1;
                        }
                        const tradeTimestamp = parseDateToUTC(exitDate);
                        if (Number.isFinite(tradeTimestamp)) {
                            executedDateValues.push(tradeTimestamp);
                        }
                        executedTrades.push({
                            buyDate: position.entryDate,
                            sellDate: exitDate,
                            tradeDate: exitDate,
                            probability: position.entryProbability,
                            actualReturn: grossReturn,
                            fraction,
                            tradeReturn,
                            buyPrice: position.entryPrice,
                            sellPrice: exitPrice,
                            tradeRule,
                            predictedClass: position.entryClassIndex,
                            predictedClassLabel: formatClassLabel(position.entryClassIndex, classificationMode),
                            exitClass: classIndex,
                            holdDays: position.holdDays + 1,
                            probabilities: parsed.probabilities,
                            classificationMode,
                            executed: true,
                        });
                        tradeReturns.push(tradeReturn);
                        record.executed = true;
                        record.triggered = record.triggered || exitSignal || isLastSample;
                        record.buyDate = position.entryDate || record.buyDate;
                        record.sellDate = exitDate || record.sellDate;
                        record.tradeDate = exitDate || record.tradeDate;
                        record.buyPrice = position.entryPrice;
                        record.sellPrice = exitPrice;
                        record.actualReturn = grossReturn;
                        record.fraction = fraction;
                        record.tradeReturn = tradeReturn;
                        record.holdDays = position.holdDays + 1;
                        const entryRecord = dailyRecords[position.entryRecordIndex];
                        if (entryRecord) {
                            entryRecord.sellDate = exitDate || entryRecord.sellDate;
                            entryRecord.sellPrice = exitPrice;
                            entryRecord.actualReturn = grossReturn;
                            entryRecord.tradeReturn = tradeReturn;
                            entryRecord.holdDays = position.holdDays + 1;
                            entryRecord.executed = true;
                        }
                    }
                    position = null;
                } else if (position) {
                    position.holdDays += 1;
                    if (Number.isFinite(nextClose) && nextClose > 0) {
                        position.lastPrice = nextClose;
                    }
                }

                dailyRecords.push(record);
            }
        } else {
            for (let i = 0; i < predictions.length; i += 1) {
                const parsed = parsePredictionEntry(predictions[i], classificationMode);
                const probability = parsed.pUp;
                const metaItem = meta[i] || {};
                if (!Number.isFinite(probability)) {
                    continue;
                }

                const baseSellPrice = Number.isFinite(metaItem.sellPrice)
                    ? metaItem.sellPrice
                    : (Number.isFinite(metaItem.sellClose) ? metaItem.sellClose : NaN);
                let resolvedBuyPrice = NaN;
                let resolvedSellPrice = baseSellPrice;
                let entryEligible;
                let actualReturn;
                const buyDate = metaItem.buyDate || metaItem.tradeDate || null;
                const sellDate = metaItem.sellDate || metaItem.tradeDate || null;

                if (tradeRule === 'open-entry') {
                    const openEligible = typeof metaItem.openEntryEligible === 'boolean'
                        ? metaItem.openEntryEligible
                        : null;
                    resolvedBuyPrice = Number(metaItem.openEntryBuyPrice);
                    if (!Number.isFinite(resolvedBuyPrice) || resolvedBuyPrice <= 0) {
                        const nextOpen = Number(metaItem.nextOpen);
                        if (Number.isFinite(nextOpen) && nextOpen > 0) {
                            resolvedBuyPrice = nextOpen;
                        } else if (Number.isFinite(metaItem.buyPrice) && metaItem.buyPrice > 0) {
                            resolvedBuyPrice = metaItem.buyPrice;
                        }
                    }
                    if (!Number.isFinite(resolvedSellPrice)) {
                        const openSell = Number(metaItem.openEntrySellPrice);
                        if (Number.isFinite(openSell)) {
                            resolvedSellPrice = openSell;
                        }
                    }
                    actualReturn = Number(metaItem.openEntryReturn);
                    entryEligible = typeof openEligible === 'boolean'
                        ? openEligible
                        : (Number.isFinite(resolvedBuyPrice) && resolvedBuyPrice > 0 && Number.isFinite(resolvedSellPrice));
                } else if (tradeRule === 'close-entry') {
                    const prevClose = Number(metaItem.buyClose);
                    const sameDayEligible = typeof metaItem.closeSameDayEligible === 'boolean'
                        ? metaItem.closeSameDayEligible
                        : null;
                    if (typeof sameDayEligible === 'boolean') {
                        entryEligible = sameDayEligible;
                    } else {
                        entryEligible = Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(resolvedSellPrice);
                    }
                    resolvedBuyPrice = Number(metaItem.closeSameDayBuyPrice);
                    if (!Number.isFinite(resolvedBuyPrice) || resolvedBuyPrice <= 0) {
                        if (Number.isFinite(prevClose) && prevClose > 0) {
                            resolvedBuyPrice = prevClose;
                        } else if (Number.isFinite(metaItem.buyPrice) && metaItem.buyPrice > 0) {
                            resolvedBuyPrice = metaItem.buyPrice;
                        }
                    }
                    if (!Number.isFinite(resolvedSellPrice)) {
                        const sameDaySell = Number(metaItem.closeSameDaySellPrice);
                        if (Number.isFinite(sameDaySell)) {
                            resolvedSellPrice = sameDaySell;
                        }
                    }
                    actualReturn = Number(metaItem.closeSameDayReturn);
                    if (!Number.isFinite(actualReturn) && Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(resolvedSellPrice)) {
                        actualReturn = (resolvedSellPrice - prevClose) / prevClose;
                    }
                } else {
                    const prevClose = Number(metaItem.buyClose);
                    const nextLow = Number(metaItem.nextLow);
                    const closeEligible = typeof metaItem.closeEntryEligible === 'boolean'
                        ? metaItem.closeEntryEligible
                        : (typeof metaItem.entryEligible === 'boolean' ? metaItem.entryEligible : null);
                    if (closeEligible === null) {
                        entryEligible = Number.isFinite(nextLow) && Number.isFinite(prevClose)
                            ? nextLow < prevClose
                            : true;
                    } else {
                        entryEligible = closeEligible;
                    }
                    resolvedBuyPrice = Number(metaItem.closeEntryBuyPrice);
                    if (!Number.isFinite(resolvedBuyPrice) || resolvedBuyPrice <= 0) {
                        if (Number.isFinite(metaItem.buyPrice) && metaItem.buyPrice > 0) {
                            resolvedBuyPrice = metaItem.buyPrice;
                        } else if (Number.isFinite(prevClose)) {
                            const nextOpen = Number(metaItem.nextOpen);
                            if (Number.isFinite(nextOpen) && nextOpen < prevClose) {
                                resolvedBuyPrice = nextOpen;
                            } else {
                                resolvedBuyPrice = prevClose;
                            }
                        }
                    }
                    actualReturn = Number(returns[i]);
                    if (!Number.isFinite(actualReturn)) {
                        actualReturn = Number(metaItem.closeEntryReturn);
                    }
                    if (!Number.isFinite(actualReturn)) {
                        actualReturn = Number(metaItem.actualReturn);
                    }
                }

                if (typeof entryEligible !== 'boolean') {
                    entryEligible = true;
                }

                if (!Number.isFinite(resolvedSellPrice)) {
                    resolvedSellPrice = Number(metaItem.sellClose);
                }

                if (!Number.isFinite(actualReturn) && Number.isFinite(resolvedBuyPrice) && resolvedBuyPrice > 0 && Number.isFinite(resolvedSellPrice)) {
                    actualReturn = (resolvedSellPrice - resolvedBuyPrice) / resolvedBuyPrice;
                }

                const tradeDate = sellDate || metaItem.tradeDate || metaItem.date || buyDate || null;
                const triggered = probability >= threshold;
                const executed = Boolean(triggered
                    && entryEligible
                    && Number.isFinite(resolvedBuyPrice) && resolvedBuyPrice > 0
                    && Number.isFinite(resolvedSellPrice));
                let fraction = 0;
                let tradeReturn = 0;
                if (executed && Number.isFinite(actualReturn)) {
                    fraction = useKelly
                        ? computeKellyFraction(probability, trainingOdds)
                        : fixedFraction;
                    tradeReturn = actualReturn * fraction;
                    if (actualReturn > 0) {
                        wins += 1;
                    }
                    if (tradeDate) {
                        const tradeTimestamp = parseDateToUTC(tradeDate);
                        if (Number.isFinite(tradeTimestamp)) {
                            executedDateValues.push(tradeTimestamp);
                        }
                    }
                    executedTrades.push({
                        buyDate,
                        sellDate: tradeDate,
                        tradeDate,
                        probability,
                        actualReturn,
                        fraction,
                        tradeReturn,
                        buyPrice: resolvedBuyPrice,
                        sellPrice: resolvedSellPrice,
                        tradeRule,
                        predictedClass: parsed.classIndex,
                        predictedClassLabel: formatClassLabel(parsed.classIndex, classificationMode),
                        probabilities: parsed.probabilities,
                        classificationMode,
                        executed: true,
                    });
                    tradeReturns.push(tradeReturn);
                }

                dailyRecords.push({
                    buyDate,
                    sellDate: tradeDate || sellDate,
                    tradeDate: tradeDate || sellDate,
                    probability,
                    predictedClass: parsed.classIndex,
                    predictedClassLabel: formatClassLabel(parsed.classIndex, classificationMode),
                    classificationMode,
                    tradeRule,
                    entryEligible,
                    executed,
                    triggered,
                    buyPrice: Number.isFinite(resolvedBuyPrice) ? resolvedBuyPrice : NaN,
                    sellPrice: Number.isFinite(resolvedSellPrice) ? resolvedSellPrice : NaN,
                    actualReturn: Number.isFinite(actualReturn) ? actualReturn : NaN,
                    fraction,
                    tradeReturn,
                    holdDays: 1,
                    probabilities: parsed.probabilities,
                });
            }
        }

        const executed = executedTrades.length;
        const hitRate = executed > 0 ? wins / executed : 0;
        const median = tradeReturns.length > 0 ? computeMedian(tradeReturns) : NaN;
        const average = tradeReturns.length > 0 ? computeMean(tradeReturns) : NaN;
        const stdDev = tradeReturns.length > 1 ? computeStd(tradeReturns, average) : NaN;
        const totalReturn = tradeReturns.reduce((acc, value) => acc + value, 0);

        const metaDates = meta
            .map((item) => parseDateToUTC(item?.sellDate || item?.tradeDate || item?.date || item?.buyDate))
            .filter((value) => Number.isFinite(value));
        const dateCandidates = metaDates.length > 0 ? metaDates : executedDateValues;
        let averageMonthly = NaN;
        let averageYearly = NaN;
        let periodStart = null;
        let periodEnd = null;
        let periodMonths = NaN;
        let periodYears = NaN;
        if (dateCandidates.length > 0) {
            const minTime = Math.min(...dateCandidates);
            const maxTime = Math.max(...dateCandidates);
            if (Number.isFinite(minTime) && Number.isFinite(maxTime) && maxTime >= minTime) {
                const diffMs = Math.max(0, maxTime - minTime);
                const diffDays = Math.max(1, (diffMs / DAY_MS) + 1);
                periodMonths = diffDays / 30.4375;
                periodYears = diffDays / 365.25;
                if (periodMonths > 0) {
                    averageMonthly = totalReturn / periodMonths;
                }
                if (periodYears > 0) {
                    averageYearly = totalReturn / periodYears;
                }
                periodStart = new Date(minTime).toISOString().slice(0, 10);
                periodEnd = new Date(maxTime).toISOString().slice(0, 10);
            }
        }

        return {
            trades: executedTrades,
            stats: {
                executed,
                hitRate,
                median,
                average,
                stdDev,
                total: totalReturn,
                averageMonthly,
                averageYearly,
                periodStart,
                periodEnd,
                periodMonths,
                periodYears,
            },
            rule: tradeRule,
            volatilityThresholds,
            allRecords: dailyRecords,
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
        const selectedRule = normalizeTradeRule(options.tradeRule);
        const sanitizedFixedFraction = sanitizeFraction(options.fixedFraction);
        const resolvedVolatility = sanitizeVolatilityThresholds(options.volatilityThresholds || modelState.volatilityThresholds);
        modelState.volatilityThresholds = resolvedVolatility;
        const classificationMode = normalizeClassificationMode(payload?.classificationMode || modelState.classification);
        const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.5;
        payload.classificationMode = classificationMode;
        const evaluation = computeTradeOutcomes(payload, {
            ...options,
            tradeRule: selectedRule,
            fixedFraction: sanitizedFixedFraction,
            volatilityThresholds: resolvedVolatility,
        }, trainingOdds);
        const evaluationRule = normalizeTradeRule(evaluation.rule || selectedRule);
        const allRecords = Array.isArray(evaluation.allRecords) ? evaluation.allRecords : [];
        const forecast = payload.forecast && Number.isFinite(payload.forecast?.probability)
            ? annotateForecast({ ...payload.forecast }, payload) || { ...payload.forecast }
            : null;
        if (forecast) {
            forecast.classificationMode = classificationMode;
            forecast.classLabel = formatClassLabel(forecast.predictedClass ?? (forecast.probability >= threshold ? 2 : 1), classificationMode);
            const forecastFraction = options.useKelly
                ? computeKellyFraction(forecast.probability, trainingOdds)
                : sanitizedFixedFraction;
            forecast.fraction = forecastFraction;
            forecast.tradeRule = evaluationRule;
            if (evaluationRule === 'open-entry') {
                forecast.buyPrice = Number.isFinite(forecast.buyPrice) ? NaN : forecast.buyPrice;
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
            tradeReturnAverageSingle: evaluation.stats.average,
            tradeReturnAverageMonthly: evaluation.stats.averageMonthly,
            tradeReturnAverageYearly: evaluation.stats.averageYearly,
            tradeReturnTotal: evaluation.stats.total,
            tradeReturnStdDev: evaluation.stats.stdDev,
            tradePeriodStart: evaluation.stats.periodStart,
            tradePeriodEnd: evaluation.stats.periodEnd,
            tradePeriodMonths: evaluation.stats.periodMonths,
            tradePeriodYears: evaluation.stats.periodYears,
            usingKelly: Boolean(options.useKelly),
            fixedFraction: sanitizedFixedFraction,
            threshold: Number.isFinite(options.threshold) ? options.threshold : 0.5,
            seed: Number.isFinite(payload?.hyperparameters?.seed) ? payload.hyperparameters.seed : null,
            forecast,
            tradeRule: evaluationRule,
            volatilityThresholds: resolvedVolatility,
            classificationMode,
        };

        modelState.trainingMetrics = metrics;
        modelState.lastSummary = summary;
        modelState.currentTrades = evaluation.trades;
        modelState.allPredictionRows = allRecords;
        modelState.odds = trainingOdds;
        payload.tradeRule = evaluationRule;
        payload.volatilityThresholds = resolvedVolatility;
        payload.allRecords = allRecords;
        modelState.predictionsPayload = payload;
        modelState.tradeRule = evaluationRule;
        modelState.classification = classificationMode;

        applySeedDefaultName(summary, modelType);

        if (globalState.activeModel === modelType) {
            updateSummaryMetrics(summary);
            if (!allRecords.length && globalState.showAllPredictions) {
                globalState.showAllPredictions = false;
            }
            const rowsToRender = globalState.showAllPredictions ? allRecords : evaluation.trades;
            renderTrades(rowsToRender, summary.forecast, globalState.showAllPredictions);
            updateAllPredictionsToggleButton(modelState);
            if (elements.tradeRuleSelect) {
                elements.tradeRuleSelect.value = evaluationRule;
            }
        } else {
            updateAllPredictionsToggleButton(modelState);
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
        const currentSeed = Number.isFinite(modelState.hyperparameters?.seed)
            ? modelState.hyperparameters.seed
            : null;

        modelState.hyperparameters = {
            lookback,
            epochs,
            batchSize,
            learningRate,
            trainRatio,
            seed: currentSeed,
        };
        modelState.winThreshold = parseWinThreshold();
        modelState.kellyEnabled = Boolean(elements.enableKelly?.checked);
        modelState.fixedFraction = readFractionFromInput(modelState.fixedFraction);
        modelState.tradeRule = normalizeTradeRule(elements.tradeRuleSelect?.value);
        modelState.volatilityThresholds = readVolatilityThresholdsFromInputs(modelState.volatilityThresholds);
        if (elements.classificationMode) {
            modelState.classification = normalizeClassificationMode(elements.classificationMode.value);
        }
    };

    const applyModelSettingsToUI = (modelState) => {
        if (!modelState) return;
        if (elements.modelType) {
            elements.modelType.value = globalState.activeModel;
        }
        const hyper = modelState.hyperparameters || {};
        const classificationMode = normalizeClassificationMode(modelState.classification);
        if (elements.classificationMode) {
            elements.classificationMode.value = classificationMode;
        }
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
            syncFractionInputDisplay(modelState.fixedFraction ?? DEFAULT_FIXED_FRACTION);
        }
        if (elements.winThreshold) {
            const thresholdPercent = Math.round(((Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5) * 100));
            elements.winThreshold.value = String(thresholdPercent);
        }
        if (elements.tradeRuleSelect) {
            const rule = getTradeRuleForModel(globalState.activeModel);
            elements.tradeRuleSelect.value = rule;
        }
        const thresholds = sanitizeVolatilityThresholds(modelState.volatilityThresholds);
        const percent = volatilityToPercent(thresholds);
        if (elements.volatilitySurge) {
            elements.volatilitySurge.value = percent.surge.toFixed(2);
        }
        if (elements.volatilityDrop) {
            elements.volatilityDrop.value = percent.drop.toFixed(2);
        }
        updateClassificationUIState(classificationMode);
        parseTrainRatio();
        parseWinThreshold();
    };

    const renderActiveModelOutputs = () => {
        const modelType = globalState.activeModel;
        const modelState = getModelState(modelType);
        if (modelState && modelState.lastSummary) {
            updateSummaryMetrics(modelState.lastSummary);
            const hasAllRecords = Array.isArray(modelState.allPredictionRows) && modelState.allPredictionRows.length > 0;
            if (!hasAllRecords && globalState.showAllPredictions) {
                globalState.showAllPredictions = false;
            }
            const rowsToRender = globalState.showAllPredictions && hasAllRecords
                ? modelState.allPredictionRows
                : modelState.currentTrades;
            renderTrades(rowsToRender, modelState.lastSummary.forecast, globalState.showAllPredictions && hasAllRecords);
            updateAllPredictionsToggleButton(modelState);
            applySeedDefaultName(modelState.lastSummary, modelType, { force: true });
        } else {
            resetOutputs();
            updateAllPredictionsToggleButton(modelState);
            applySeedDefaultName(null, modelType, { force: true });
        }
    };

    const runLstmModel = async (modelState, rows, hyperparameters, riskOptions, runtimeOptions = {}) => {
        const modelType = MODEL_TYPES.LSTM;
        const label = formatModelLabel(modelType);
        const classificationMode = normalizeClassificationMode(modelState.classification);
        let resolvedVolatility = sanitizeVolatilityThresholds(riskOptions?.volatilityThresholds || modelState.volatilityThresholds);
        modelState.volatilityThresholds = resolvedVolatility;
        const dataset = buildDataset(rows, hyperparameters.lookback, resolvedVolatility, classificationMode);
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

        const sampleCount = dataset.sequences.length;
        const datasetLabels = new Array(sampleCount);
        let recalibratedVolatility = resolvedVolatility;
        if (classificationMode === CLASSIFICATION_MODES.BINARY) {
            for (let i = 0; i < sampleCount; i += 1) {
                const metaItem = dataset.meta[i] || {};
                const actualReturn = Number.isFinite(metaItem?.actualReturn)
                    ? metaItem.actualReturn
                    : dataset.returns[i];
                const label = Number(actualReturn > 0);
                datasetLabels[i] = label;
                if (metaItem) {
                    metaItem.classLabel = label;
                }
            }
        } else {
            const swingTargets = Array.isArray(dataset.swingTargets)
                ? dataset.swingTargets
                : dataset.meta.map((item) => Number(item?.swingReturn));
            const trainingSwings = swingTargets
                .slice(0, boundedTrainSize)
                .filter((value) => Number.isFinite(value));
            recalibratedVolatility = deriveVolatilityThresholdsFromReturns(trainingSwings, resolvedVolatility);
            for (let i = 0; i < sampleCount; i += 1) {
                const metaItem = dataset.meta[i] || {};
                const swingValue = Number.isFinite(swingTargets[i])
                    ? swingTargets[i]
                    : Number(metaItem?.swingReturn);
                const label = classifySwingReturn(swingValue, recalibratedVolatility);
                datasetLabels[i] = label;
                if (metaItem) {
                    metaItem.classLabel = label;
                }
            }
        }
        dataset.labels = datasetLabels;
        dataset.volatilityThresholds = recalibratedVolatility;
        resolvedVolatility = recalibratedVolatility;
        modelState.volatilityThresholds = resolvedVolatility;

        const requestedSeed = Number.isFinite(runtimeOptions?.seedOverride)
            ? Math.max(1, Math.round(runtimeOptions.seedOverride))
            : (Number.isFinite(hyperparameters.seed) ? Math.max(1, Math.round(hyperparameters.seed)) : null);

        showStatus(`[${label}] 訓練中（共 ${hyperparameters.epochs} 輪）...`, 'info');
        const workerPayload = {
            dataset,
            hyperparameters: {
                lookback: hyperparameters.lookback,
                epochs: hyperparameters.epochs,
                batchSize: effectiveBatchSize,
                learningRate: hyperparameters.learningRate,
                totalSamples,
                trainSize: boundedTrainSize,
                trainRatio: hyperparameters.trainRatio,
                seed: Number.isFinite(requestedSeed) ? requestedSeed : (Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null),
                volatility: resolvedVolatility,
                classificationMode,
            },
        };
        if (Number.isFinite(requestedSeed)) {
            workerPayload.overrides = { seed: requestedSeed };
        }
        const workerResult = await sendAIWorkerTrainingTask('ai-train-lstm', workerPayload, { modelType });

        const resultModelType = workerResult.modelType || modelType;
        const trainingMetrics = workerResult?.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: 0,
        };
        const predictionsPayload = workerResult?.predictionsPayload || null;
        const hyperparametersUsed = workerResult?.hyperparametersUsed && typeof workerResult.hyperparametersUsed === 'object'
            ? workerResult.hyperparametersUsed
            : null;
        if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
            throw new Error('AI Worker 未回傳有效的預測結果。');
        }

        const resolvedHyper = {
            lookback: Number.isFinite(hyperparametersUsed?.lookback) ? hyperparametersUsed.lookback : hyperparameters.lookback,
            epochs: Number.isFinite(hyperparametersUsed?.epochs) ? hyperparametersUsed.epochs : hyperparameters.epochs,
            batchSize: Number.isFinite(hyperparametersUsed?.batchSize) ? hyperparametersUsed.batchSize : effectiveBatchSize,
            learningRate: Number.isFinite(hyperparametersUsed?.learningRate) ? hyperparametersUsed.learningRate : hyperparameters.learningRate,
            trainRatio: Number.isFinite(hyperparametersUsed?.trainRatio) ? hyperparametersUsed.trainRatio : hyperparameters.trainRatio,
            modelType: resultModelType,
            splitIndex: Number.isFinite(hyperparametersUsed?.splitIndex) ? hyperparametersUsed.splitIndex : (predictionsPayload.hyperparameters?.splitIndex ?? boundedTrainSize),
            threshold: Number.isFinite(hyperparametersUsed?.threshold) ? hyperparametersUsed.threshold : (predictionsPayload.hyperparameters?.threshold ?? 0.5),
            seed: Number.isFinite(hyperparametersUsed?.seed)
                ? hyperparametersUsed.seed
                : (Number.isFinite(requestedSeed) ? requestedSeed : (Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null)),
            classificationMode,
        };

        predictionsPayload.hyperparameters = { ...resolvedHyper, volatility: resolvedVolatility };
        predictionsPayload.volatilityThresholds = resolvedVolatility;
        predictionsPayload.classificationMode = classificationMode;

        modelState.hyperparameters = {
            lookback: resolvedHyper.lookback,
            epochs: resolvedHyper.epochs,
            batchSize: resolvedHyper.batchSize,
            learningRate: resolvedHyper.learningRate,
            trainRatio: resolvedHyper.trainRatio,
            seed: resolvedHyper.seed,
        };

        modelState.winThreshold = resolvedHyper.threshold;

        const evaluationOptions = {
            ...riskOptions,
            threshold: resolvedHyper.threshold,
            volatilityThresholds: resolvedVolatility,
        };

        applyTradeEvaluation(resultModelType, predictionsPayload, trainingMetrics, evaluationOptions);

        if (workerResult?.confusion && modelState?.lastSummary) {
            modelState.lastSummary.confusion = { ...workerResult.confusion };
        }

        const finalMessage = typeof workerResult?.finalMessage === 'string'
            ? workerResult.finalMessage
            : `完成：訓練勝率 ${formatPercent(trainingMetrics.trainAccuracy, 2)}，測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}。`;
        const seedSuffix = Number.isFinite(resolvedHyper.seed) ? `（Seed ${resolvedHyper.seed}）` : '';
        const summary = modelState.lastSummary;
        const appended = summary
            ? `｜交易報酬% 中位數 ${formatPercent(summary.tradeReturnMedian, 2)}｜單次平均報酬% ${formatPercent(Number.isFinite(summary.tradeReturnAverageSingle) ? summary.tradeReturnAverageSingle : summary.tradeReturnAverage, 2)}｜月平均報酬% ${formatPercent(summary.tradeReturnAverageMonthly, 2)}｜年平均報酬% ${formatPercent(summary.tradeReturnAverageYearly, 2)}｜交易次數 ${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}`
            : '';
        showStatus(`[${formatModelLabel(resultModelType)}] ${finalMessage}${seedSuffix}${appended}`, 'success');
    };

    const runAnnModel = async (modelState, rows, hyperparameters, riskOptions, runtimeOptions = {}) => {
        const modelType = MODEL_TYPES.ANNS;
        const label = formatModelLabel(modelType);
        if (!Array.isArray(rows) || rows.length < 60) {
            showStatus(`[${label}] 資料不足（至少 60 根 K 線），請先延長回測期間。`, 'warning');
            return;
        }

        const requestedSeed = Number.isFinite(runtimeOptions?.seedOverride)
            ? Math.max(1, Math.round(runtimeOptions.seedOverride))
            : (Number.isFinite(hyperparameters.seed) ? Math.max(1, Math.round(hyperparameters.seed)) : null);

        let resolvedVolatility = sanitizeVolatilityThresholds(riskOptions?.volatilityThresholds || modelState.volatilityThresholds);
        modelState.volatilityThresholds = resolvedVolatility;
        const classificationMode = normalizeClassificationMode(modelState.classification);

        showStatus(`[${label}] 訓練中（共 ${hyperparameters.epochs} 輪）...`, 'info');
        const taskPayload = {
            rows,
            options: {
                epochs: hyperparameters.epochs,
                batchSize: hyperparameters.batchSize,
                learningRate: hyperparameters.learningRate,
                trainRatio: hyperparameters.trainRatio,
                lookback: hyperparameters.lookback,
                volatility: resolvedVolatility,
                classificationMode,
            },
        };
        if (Number.isFinite(requestedSeed)) {
            taskPayload.overrides = { seed: requestedSeed };
        }
        const workerResult = await sendAIWorkerTrainingTask('ai-train-ann', taskPayload, { modelType });

        const trainingMetrics = workerResult?.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: 0,
        };
        const predictionsPayload = workerResult?.predictionsPayload || null;
        const hyperparametersUsed = workerResult?.hyperparametersUsed && typeof workerResult.hyperparametersUsed === 'object'
            ? workerResult.hyperparametersUsed
            : null;
        if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
            throw new Error('AI Worker 未回傳有效的預測結果。');
        }

        const workerVolatility = sanitizeVolatilityThresholds(predictionsPayload?.volatilityThresholds || resolvedVolatility);
        resolvedVolatility = workerVolatility;
        modelState.volatilityThresholds = resolvedVolatility;

        const resolvedHyper = {
            lookback: Number.isFinite(hyperparametersUsed?.lookback) ? hyperparametersUsed.lookback : hyperparameters.lookback,
            epochs: Number.isFinite(hyperparametersUsed?.epochs) ? hyperparametersUsed.epochs : hyperparameters.epochs,
            batchSize: Number.isFinite(hyperparametersUsed?.batchSize) ? hyperparametersUsed.batchSize : hyperparameters.batchSize,
            learningRate: Number.isFinite(hyperparametersUsed?.learningRate) ? hyperparametersUsed.learningRate : hyperparameters.learningRate,
            trainRatio: Number.isFinite(hyperparametersUsed?.trainRatio) ? hyperparametersUsed.trainRatio : hyperparameters.trainRatio,
            modelType,
            splitIndex: Number.isFinite(hyperparametersUsed?.splitIndex) ? hyperparametersUsed.splitIndex : (predictionsPayload.hyperparameters?.splitIndex ?? null),
            threshold: Number.isFinite(hyperparametersUsed?.threshold) ? hyperparametersUsed.threshold : 0.5,
            seed: Number.isFinite(hyperparametersUsed?.seed)
                ? hyperparametersUsed.seed
                : (Number.isFinite(requestedSeed) ? requestedSeed : (Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null)),
            classificationMode,
        };

        predictionsPayload.hyperparameters = { ...resolvedHyper, volatility: resolvedVolatility };
        predictionsPayload.volatilityThresholds = resolvedVolatility;
        predictionsPayload.classificationMode = classificationMode;

        modelState.hyperparameters = {
            lookback: resolvedHyper.lookback,
            epochs: resolvedHyper.epochs,
            batchSize: resolvedHyper.batchSize,
            learningRate: resolvedHyper.learningRate,
            trainRatio: resolvedHyper.trainRatio,
            seed: resolvedHyper.seed,
        };

        modelState.winThreshold = resolvedHyper.threshold;

        const evaluationOptions = {
            ...riskOptions,
            threshold: resolvedHyper.threshold,
            volatilityThresholds: resolvedVolatility,
        };

        applyTradeEvaluation(modelType, predictionsPayload, trainingMetrics, evaluationOptions);

        if (workerResult?.confusion && modelState?.lastSummary) {
            modelState.lastSummary.confusion = { ...workerResult.confusion };
        }

        const finalMessage = typeof workerResult?.finalMessage === 'string'
            ? workerResult.finalMessage
            : `完成：測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}，混淆矩陣已同步更新。`;
        const seedSuffix = Number.isFinite(resolvedHyper.seed) ? `（Seed ${resolvedHyper.seed}）` : '';
        const summary = modelState.lastSummary;
        const appended = summary
            ? `｜交易報酬% 中位數 ${formatPercent(summary.tradeReturnMedian, 2)}｜單次平均報酬% ${formatPercent(Number.isFinite(summary.tradeReturnAverageSingle) ? summary.tradeReturnAverageSingle : summary.tradeReturnAverage, 2)}｜月平均報酬% ${formatPercent(summary.tradeReturnAverageMonthly, 2)}｜年平均報酬% ${formatPercent(summary.tradeReturnAverageYearly, 2)}｜交易次數 ${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}`
            : '';
        showStatus(`[${label}] ${finalMessage}${seedSuffix}${appended}`, 'success');
    };

    const recomputeTradesFromState = (modelType = globalState.activeModel) => {
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload || !modelState.trainingMetrics) return;

        let threshold = Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5;
        let useKelly = Boolean(modelState.kellyEnabled);
        let fixedFraction = sanitizeFraction(modelState.fixedFraction);
        let tradeRule = getTradeRuleForModel(modelType);

        if (modelType === globalState.activeModel) {
            threshold = parseWinThreshold();
            useKelly = Boolean(elements.enableKelly?.checked);
            fixedFraction = readFractionFromInput(modelState.fixedFraction);
            tradeRule = normalizeTradeRule(elements.tradeRuleSelect?.value);
            modelState.volatilityThresholds = readVolatilityThresholdsFromInputs(modelState.volatilityThresholds);
            modelState.kellyEnabled = useKelly;
            modelState.fixedFraction = fixedFraction;
            modelState.tradeRule = tradeRule;
            updateTradeRuleDescription(tradeRule);
            if (elements.tradeRuleSelect) {
                elements.tradeRuleSelect.value = tradeRule;
            }
        }

        applyTradeEvaluation(modelType, modelState.predictionsPayload, modelState.trainingMetrics, {
            threshold,
            useKelly,
            fixedFraction,
            tradeRule,
            volatilityThresholds: modelState.volatilityThresholds,
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
        const fixedFraction = readFractionFromInput(modelState.fixedFraction);
        const tradeRule = normalizeTradeRule(elements.tradeRuleSelect?.value);
        modelState.fixedFraction = fixedFraction;
        modelState.tradeRule = tradeRule;
        updateTradeRuleDescription(tradeRule);
        if (elements.tradeRuleSelect) {
            elements.tradeRuleSelect.value = tradeRule;
        }
        const payload = modelState.predictionsPayload;
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(modelState.odds) ? modelState.odds : 1);
        const target = elements.optimizeTarget?.value || 'median';
        const targetFieldMap = {
            median: 'median',
            single: 'average',
            monthly: 'averageMonthly',
            yearly: 'averageYearly',
        };
        const targetLabelMap = {
            median: '交易報酬% 中位數',
            single: '單次平均報酬%',
            monthly: '月平均報酬%',
            yearly: '年平均報酬%',
        };
        const targetField = targetFieldMap[target] || 'median';
        const minTradesRaw = parseNumberInput(elements.optimizeMinTrades, 1, { min: 0, max: 10000 });
        const minTrades = Math.max(0, Math.floor(Number.isFinite(minTradesRaw) ? minTradesRaw : 1));
        if (elements.optimizeMinTrades) {
            elements.optimizeMinTrades.value = String(minTrades);
        }
        let bestThreshold = modelState.winThreshold || 0.5;
        let bestValue = Number.NEGATIVE_INFINITY;
        let bestStats = null;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = computeTradeOutcomes(payload, {
                threshold,
                useKelly,
                fixedFraction,
                tradeRule,
                volatilityThresholds: modelState.volatilityThresholds,
            }, trainingOdds);
            const executedCount = Number.isFinite(evaluation.stats.executed) ? evaluation.stats.executed : 0;
            if (executedCount < minTrades) {
                continue;
            }
            const statValue = evaluation.stats[targetField];
            const normalizedValue = Number.isFinite(statValue) ? statValue : Number.NEGATIVE_INFINITY;
            const currentMedian = Number.isFinite(evaluation.stats.median) ? evaluation.stats.median : Number.NEGATIVE_INFINITY;
            const currentAverage = Number.isFinite(evaluation.stats.average) ? evaluation.stats.average : Number.NEGATIVE_INFINITY;
            const bestMedian = Number.isFinite(bestStats?.median) ? bestStats.median : Number.NEGATIVE_INFINITY;
            const bestAverage = Number.isFinite(bestStats?.average) ? bestStats.average : Number.NEGATIVE_INFINITY;
            if (
                normalizedValue > bestValue
                || (normalizedValue === bestValue && currentMedian > bestMedian)
                || (normalizedValue === bestValue && currentMedian === bestMedian && currentAverage > bestAverage)
                || (normalizedValue === bestValue && currentMedian === bestMedian && currentAverage === bestAverage && threshold < bestThreshold)
            ) {
                bestValue = normalizedValue;
                bestThreshold = threshold;
                bestStats = { ...evaluation.stats, executed: executedCount };
            }
        }
        if (!bestStats || bestValue === Number.NEGATIVE_INFINITY) {
            const requirementText = minTrades > 0
                ? `（至少需 ${minTrades} 筆交易）`
                : '';
            showStatus(`門檻掃描後仍無符合條件的交易${requirementText}。已維持原門檻設定。`, 'warning');
            return;
        }
        elements.winThreshold.value = String(Math.round(bestThreshold * 100));
        modelState.winThreshold = bestThreshold;
        parseWinThreshold();
        recomputeTradesFromState(modelType);
        const updatedSummary = getModelState(modelType)?.lastSummary;
        const targetLabel = targetLabelMap[target] || targetLabelMap.median;
        const summaryValue = updatedSummary
            ? (() => {
                switch (targetField) {
                    case 'average':
                        return Number.isFinite(updatedSummary.tradeReturnAverageSingle)
                            ? updatedSummary.tradeReturnAverageSingle
                            : updatedSummary.tradeReturnAverage;
                    case 'averageMonthly':
                        return updatedSummary.tradeReturnAverageMonthly;
                    case 'averageYearly':
                        return updatedSummary.tradeReturnAverageYearly;
                    case 'median':
                    default:
                        return updatedSummary.tradeReturnMedian;
                }
            })()
            : bestValue;
        const appendMetrics = updatedSummary
            ? `｜交易報酬% 中位數 ${formatPercent(updatedSummary.tradeReturnMedian, 2)}｜單次平均報酬% ${formatPercent(Number.isFinite(updatedSummary.tradeReturnAverageSingle) ? updatedSummary.tradeReturnAverageSingle : updatedSummary.tradeReturnAverage, 2)}｜月平均報酬% ${formatPercent(updatedSummary.tradeReturnAverageMonthly, 2)}｜年平均報酬% ${formatPercent(updatedSummary.tradeReturnAverageYearly, 2)}｜交易次數 ${Number.isFinite(updatedSummary.executedTrades) ? updatedSummary.executedTrades : 0}`
            : '';
        showStatus(`最佳化完成：勝率門檻 ${Math.round(bestThreshold * 100)}% 對應${targetLabel} ${formatPercent(summaryValue, 2)}${appendMetrics}。`, 'success');
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
        const defaultName = buildSeedDefaultName(summary, modelType) || '未命名種子';
        const inputName = elements.seedName?.value?.trim();
        const seedName = inputName || defaultName;
        const newSeed = {
            id: `seed-${Date.now()}`,
            name: seedName,
            createdAt: Date.now(),
            modelType,
            payload: {
                predictions: Array.isArray(modelState.predictionsPayload.predictions) ? modelState.predictionsPayload.predictions : [],
                meta: Array.isArray(modelState.predictionsPayload.meta) ? modelState.predictionsPayload.meta : [],
                returns: Array.isArray(modelState.predictionsPayload.returns) ? modelState.predictionsPayload.returns : [],
                trainingOdds: modelState.predictionsPayload.trainingOdds,
                forecast: modelState.predictionsPayload.forecast,
                datasetLastDate: modelState.predictionsPayload.datasetLastDate,
                lastClose: modelState.predictionsPayload.lastClose,
                hyperparameters: modelState.predictionsPayload.hyperparameters,
                volatilityThresholds: modelState.volatilityThresholds,
                classificationMode: modelState.classification,
            },
            trainingMetrics: modelState.trainingMetrics,
            summary: {
                threshold: summary.threshold,
                usingKelly: summary.usingKelly,
                fixedFraction: summary.fixedFraction,
                executedTrades: summary.executedTrades,
                tradeReturnMedian: summary.tradeReturnMedian,
                tradeReturnAverage: summary.tradeReturnAverage,
                tradeReturnAverageSingle: summary.tradeReturnAverageSingle,
                tradeReturnAverageMonthly: summary.tradeReturnAverageMonthly,
                tradeReturnAverageYearly: summary.tradeReturnAverageYearly,
                tradeReturnTotal: summary.tradeReturnTotal,
                tradeRule: summary.tradeRule,
                volatilityThresholds: summary.volatilityThresholds,
                classificationMode: summary.classificationMode,
            },
            version: VERSION_TAG,
        };
        seeds.push(newSeed);
        persistSeeds(seeds);
        refreshSeedOptions();
        showStatus(`已儲存種子「${seedName}」。`, 'success');
        if (elements.saveSeedButton) {
            const button = elements.saveSeedButton;
            const baseLabel = button.dataset.originalLabel || button.textContent.trim();
            button.dataset.originalLabel = baseLabel;
            button.disabled = true;
            button.classList.add('bg-emerald-500', 'text-white', 'ring-2', 'ring-emerald-400');
            button.textContent = '已儲存種子 ✓';
            if (typeof window !== 'undefined') {
                if (seedSaveFeedbackTimer) {
                    window.clearTimeout(seedSaveFeedbackTimer);
                }
                seedSaveFeedbackTimer = window.setTimeout(() => {
                    button.disabled = false;
                    button.classList.remove('bg-emerald-500', 'text-white', 'ring-2', 'ring-emerald-400');
                    button.textContent = baseLabel;
                    seedSaveFeedbackTimer = null;
                }, 1800);
            } else {
                button.disabled = false;
                button.classList.remove('bg-emerald-500', 'text-white', 'ring-2', 'ring-emerald-400');
                button.textContent = baseLabel;
                seedSaveFeedbackTimer = null;
            }
        }
    };

    const activateSeed = (seed) => {
        if (!seed) return;
        const modelType = globalState.activeModel;
        const modelState = getModelState(modelType);
        modelState.predictionsPayload = {
            predictions: Array.isArray(seed.payload?.predictions) ? seed.payload.predictions : [],
            meta: Array.isArray(seed.payload?.meta) ? seed.payload.meta : [],
            returns: Array.isArray(seed.payload?.returns) ? seed.payload.returns : [],
            trainingOdds: seed.payload?.trainingOdds,
            forecast: seed.payload?.forecast || null,
            datasetLastDate: seed.payload?.datasetLastDate || null,
            lastClose: Number.isFinite(seed.payload?.lastClose) ? seed.payload.lastClose : null,
            hyperparameters: seed.payload?.hyperparameters || null,
            volatilityThresholds: sanitizeVolatilityThresholds(seed.payload?.volatilityThresholds || seed.summary?.volatilityThresholds || modelState.volatilityThresholds),
            classificationMode: normalizeClassificationMode(seed.payload?.classificationMode || seed.summary?.classificationMode || modelState.classification),
        };
        modelState.classification = modelState.predictionsPayload.classificationMode;
        const metrics = seed.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(modelState.predictionsPayload.predictions)
                ? modelState.predictionsPayload.predictions.length
                : 0,
        };
        modelState.trainingMetrics = metrics;
        modelState.odds = Number.isFinite(seed.payload?.trainingOdds) ? seed.payload.trainingOdds : modelState.odds;
        modelState.volatilityThresholds = sanitizeVolatilityThresholds(seed.summary?.volatilityThresholds || modelState.predictionsPayload.volatilityThresholds || modelState.volatilityThresholds);
        updateClassificationUIState(modelState.classification);

        const hyper = seed.payload?.hyperparameters || {};
        const existingHyper = modelState.hyperparameters || {};

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
            lookback: Number.isFinite(hyper.lookback) ? hyper.lookback : existingHyper.lookback,
            epochs: Number.isFinite(hyper.epochs) ? hyper.epochs : existingHyper.epochs,
            batchSize: Number.isFinite(hyper.batchSize) ? hyper.batchSize : existingHyper.batchSize,
            learningRate: Number.isFinite(hyper.learningRate) ? hyper.learningRate : existingHyper.learningRate,
            trainRatio: Number.isFinite(hyper.trainRatio) ? hyper.trainRatio : existingHyper.trainRatio,
            seed: Number.isFinite(hyper.seed) ? hyper.seed : existingHyper.seed,
        };

        if (elements.enableKelly && typeof seed.summary?.usingKelly === 'boolean') {
            elements.enableKelly.checked = seed.summary.usingKelly;
        }
        const summaryFraction = Number.isFinite(seed.summary?.fixedFraction)
            ? sanitizeFraction(seed.summary.fixedFraction)
            : null;
        if (summaryFraction !== null) {
            modelState.fixedFraction = summaryFraction;
            syncFractionInputDisplay(summaryFraction);
        } else {
            syncFractionInputDisplay(modelState.fixedFraction);
        }
        if (elements.winThreshold && Number.isFinite(seed.summary?.threshold)) {
            elements.winThreshold.value = String(Math.round(seed.summary.threshold * 100));
        }

        modelState.kellyEnabled = Boolean(seed.summary?.usingKelly);
        modelState.winThreshold = Number.isFinite(seed.summary?.threshold)
            ? seed.summary.threshold
            : modelState.winThreshold;
        const summaryRule = normalizeTradeRule(seed.summary?.tradeRule);
        modelState.tradeRule = summaryRule;
        if (elements.tradeRuleSelect) {
            elements.tradeRuleSelect.value = summaryRule;
        }
        updateTradeRuleDescription(summaryRule);

        parseTrainRatio();
        parseWinThreshold();
        recomputeTradesFromState(modelType);
        showStatus(`已載入種子：${seed.name || '未命名種子'}。`, 'success');
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
        const selectedIds = Array.from(elements.savedSeedList.selectedOptions || []).map((option) => option.value).filter(Boolean);
        if (selectedIds.length === 0) {
            showStatus('請先選擇要刪除的種子。', 'warning');
            return;
        }
        const seeds = loadStoredSeeds();
        const remaining = seeds.filter((seed) => !selectedIds.includes(seed.id));
        if (remaining.length === seeds.length) {
            showStatus('未刪除任何種子。', 'warning');
            return;
        }
        persistSeeds(remaining);
        refreshSeedOptions();
        if (elements.savedSeedList) {
            elements.savedSeedList.selectedIndex = -1;
        }
        showStatus(`已刪除 ${selectedIds.length} 筆種子。`, 'success');
    };

    const runPrediction = async (options = {}) => {
        if (globalState.running) return;
        toggleRunning(true);

        try {
            const selectedModel = elements.modelType ? elements.modelType.value : globalState.activeModel;
            const normalizedModel = Object.values(MODEL_TYPES).includes(selectedModel)
                ? selectedModel
                : MODEL_TYPES.LSTM;

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
                tradeRule: getTradeRuleForModel(normalizedModel),
                volatilityThresholds: sanitizeVolatilityThresholds(modelState.volatilityThresholds),
            };

            const rows = getVisibleData();
            if (!Array.isArray(rows) || rows.length === 0) {
                showStatus(`[${formatModelLabel(normalizedModel)}] 尚未取得回測資料，請先在主頁面執行回測。`, 'warning');
                return;
            }

            let annRuntimeOptions = {};
            let lstmRuntimeOptions = {};
            if (normalizedModel === MODEL_TYPES.ANNS) {
                const storedSeed = Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null;
                if (options?.freshSeed) {
                    const freshSeed = generateRuntimeSeed();
                    annRuntimeOptions = {
                        seedOverride: freshSeed,
                    };
                } else if (Number.isFinite(storedSeed)) {
                    annRuntimeOptions = { seedOverride: storedSeed };
                }
            }

            if (normalizedModel === MODEL_TYPES.LSTM) {
                const storedSeed = Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null;
                if (options?.freshSeed) {
                    const freshSeed = generateRuntimeSeed();
                    lstmRuntimeOptions = {
                        seedOverride: freshSeed,
                    };
                } else if (Number.isFinite(storedSeed)) {
                    lstmRuntimeOptions = { seedOverride: storedSeed };
                }
            }

            if (normalizedModel === MODEL_TYPES.LSTM) {
                await runLstmModel(modelState, rows, hyperparameters, riskOptions, lstmRuntimeOptions);
            } else {
                await runAnnModel(modelState, rows, hyperparameters, riskOptions, annRuntimeOptions);
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
        const normalized = Object.values(MODEL_TYPES).includes(selected) ? selected : MODEL_TYPES.LSTM;
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
        elements.freshRunButton = document.getElementById('ai-run-fresh-button');
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
        elements.optimizeTarget = document.getElementById('ai-optimize-target');
        elements.optimizeMinTrades = document.getElementById('ai-optimize-min-trades');
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
        elements.toggleAllTrades = document.getElementById('ai-toggle-all-trades');
        elements.seedName = document.getElementById('ai-seed-name');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.savedSeedList = document.getElementById('ai-saved-seeds');
        elements.loadSeedButton = document.getElementById('ai-load-seed');
        elements.deleteSeedButton = document.getElementById('ai-delete-seed');
        elements.classificationMode = document.getElementById('ai-classification-mode');
        elements.tradeRuleSelect = document.getElementById('ai-trade-rule');
        elements.tradeRules = document.getElementById('ai-trade-rules');
        elements.volatilitySurge = document.getElementById('ai-volatility-surge');
        elements.volatilityDrop = document.getElementById('ai-volatility-drop');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.freshRunButton) {
            elements.freshRunButton.addEventListener('click', () => {
                runPrediction({ freshSeed: true });
            });
        }

        if (elements.toggleAllTrades) {
            elements.toggleAllTrades.addEventListener('click', () => {
                const modelState = getActiveModelState();
                const totalRecords = Array.isArray(modelState?.allPredictionRows) ? modelState.allPredictionRows.length : 0;
                if (elements.toggleAllTrades.disabled || totalRecords === 0) {
                    return;
                }
                globalState.showAllPredictions = !globalState.showAllPredictions;
                updateAllPredictionsToggleButton(modelState);
                if (modelState?.lastSummary) {
                    const rowsToRender = globalState.showAllPredictions
                        ? modelState.allPredictionRows
                        : modelState.currentTrades;
                    renderTrades(rowsToRender, modelState.lastSummary.forecast, globalState.showAllPredictions);
                }
            });
        }

        updateAllPredictionsToggleButton(getActiveModelState());

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

        if (elements.classificationMode) {
            elements.classificationMode.addEventListener('change', () => {
                const mode = normalizeClassificationMode(elements.classificationMode.value);
                const modelState = getActiveModelState();
                if (modelState) {
                    modelState.classification = mode;
                }
                updateClassificationUIState(mode);
                captureActiveModelSettings();
                recomputeTradesFromState();
            });
        }

        if (elements.tradeRuleSelect) {
            elements.tradeRuleSelect.addEventListener('change', () => {
                const rule = normalizeTradeRule(elements.tradeRuleSelect.value);
                const modelState = getActiveModelState();
                if (modelState) {
                    modelState.tradeRule = rule;
                }
                updateTradeRuleDescription(rule);
                recomputeTradesFromState();
            });
        }

        const bindVolatilityInput = (elKey, updater) => {
            const el = elements[elKey];
            if (!el) return;
            el.addEventListener('change', updater);
            el.addEventListener('blur', updater);
        };

        bindVolatilityInput('volatilitySurge', () => {
            captureActiveModelSettings();
            recomputeTradesFromState();
        });
        bindVolatilityInput('volatilityDrop', () => {
            captureActiveModelSettings();
            recomputeTradesFromState();
        });

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

        updateTradeRuleDescription(getTradeRuleForModel());

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
