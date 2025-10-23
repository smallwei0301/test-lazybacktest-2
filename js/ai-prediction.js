/* global document, window, workerUrl */

// Patch Tag: LB-AI-TRADE-RULE-20251229A — Triple entry rules & deterministic evaluation.
// Patch Tag: LB-AI-TRADE-VOLATILITY-20251230A — Volatility-tier strategy & multi-class forecasts.
// Patch Tag: LB-AI-CLASS-MODE-20251230B — Classification mode toggle & binary-compatible pipelines.
// Patch Tag: LB-AI-VOL-QUARTILE-20251231A — Train-set quartile thresholds for volatility tiers.
// Patch Tag: LB-AI-VOL-QUARTILE-20260102A — Lock volatility UI to quartile-derived thresholds & fix ANN seed override.
// Patch Tag: LB-AI-VOL-QUARTILE-20260105A — Positive/negative quartile tiers & full prediction table toggle.
// Patch Tag: LB-AI-VOL-QUARTILE-20260108A — Sign-corrected quartile display & segregated gain/loss thresholds.
// Patch Tag: LB-AI-VOL-QUARTILE-20260110A — Train-set quartile diagnostics & UI disclosure.
// Patch Tag: LB-AI-HYBRID-20260122A — Multiclass threshold defaults & trade gating fixes.
// Patch Tag: LB-AI-THRESHOLD-20260124A — Binary default win threshold tuned to 50%.
// Patch Tag: LB-AI-VOL-QUARTILE-20260128A — 三分類預測幅度欄位與 quartile 門檻同步顯示。
// Patch Tag: LB-AI-VOL-QUARTILE-20260202A — 預估漲跌幅改以類別平均報酬計算並同步交易表。
// Patch Tag: LB-AI-SWING-20260210A — 預測漲跌幅移除門檻 fallback，僅顯示模型期望值。
// Patch Tag: LB-AI-VIX-FEATURE-20260320A — ANN 引入 VIX 指數特徵並自動對齊美股回測日期。
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-VIX-FEATURE-20260320A';
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
    const getDefaultWinThresholdForMode = (mode) => (normalizeClassificationMode(mode) === CLASSIFICATION_MODES.MULTICLASS
        ? 0
        : 0.5);
    const resolveWinThreshold = (state) => {
        if (!state) {
            return getDefaultWinThresholdForMode();
        }
        const classificationMode = normalizeClassificationMode(state.classification);
        return Number.isFinite(state.winThreshold)
            ? state.winThreshold
            : getDefaultWinThresholdForMode(classificationMode);
    };
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
        winThreshold: 0,
        kellyEnabled: false,
        fixedFraction: DEFAULT_FIXED_FRACTION,
        lastRunMeta: null,
        volatilityDiagnostics: null,
        annDiagnostics: null,
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
        volatilityDiagnostics: null,
        volatilitySampleSummary: null,
        volatilitySurgeSummary: null,
        volatilityDropSummary: null,
        annDiagnosticsButton: null,
        testAccuracyLabel: null,
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
    const VIX_INDEX_SYMBOL = '^VIX';
    const vixSeriesCache = new Map();

    const normalizeTradeRule = (rule) => (TRADE_RULE_MAP[rule] ? rule : DEFAULT_TRADE_RULE);
    const getTradeRuleConfig = (rule) => TRADE_RULE_MAP[normalizeTradeRule(rule)];
    const getTradeRuleDescription = (rule) => getTradeRuleConfig(rule).description;
    const updateTradeRuleDescription = (rule) => {
        if (!elements.tradeRules) return;
        const normalized = normalizeTradeRule(rule);
        let description = getTradeRuleDescription(normalized);
        const state = getModelState(globalState.activeModel);
        const classificationMode = state?.classification || CLASSIFICATION_MODES.MULTICLASS;
        if (normalized === 'volatility-tier') {
            if (classificationMode === CLASSIFICATION_MODES.BINARY) {
                description = '買賣邏輯：模型採二分類判斷，當預測隔日上漲且機率達門檻時於當日收盤進場，之後持有至預測隔日下跌且機率達門檻時於當日收盤出場。';
            } else {
                const thresholds = sanitizeVolatilityThresholds(state?.volatilityThresholds);
                description = `${description}（${formatVolatilityDescription(thresholds)}）`;
            }
        } else if (classificationMode === CLASSIFICATION_MODES.MULTICLASS) {
            description = `${description}（需同時判定為「大漲」且機率達門檻才會進場。）`;
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
        const diagnostics = getModelState(globalState.activeModel)?.volatilityDiagnostics;
        updateVolatilityDiagnosticsDisplay(diagnostics, _mode);
        if (elements.winThreshold) {
            const state = getModelState(globalState.activeModel);
            if (state) {
                const normalized = normalizeClassificationMode(_mode);
                const defaultThreshold = getDefaultWinThresholdForMode(normalized);
                if (!Number.isFinite(state.winThreshold)
                    || (normalized === CLASSIFICATION_MODES.MULTICLASS && state.winThreshold > defaultThreshold)
                    || (normalized === CLASSIFICATION_MODES.BINARY && state.winThreshold <= 0)) {
                    state.winThreshold = defaultThreshold;
                }
                elements.winThreshold.value = String(Math.round(resolveWinThreshold(state) * 100));
            }
            parseWinThreshold();
        }
        if (elements.testAccuracyLabel) {
            const normalized = normalizeClassificationMode(_mode);
            elements.testAccuracyLabel.textContent = normalized === CLASSIFICATION_MODES.MULTICLASS
                ? '大漲命中率'
                : '測試期預測正確率';
        }
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

    const formatNumber = (value, digits = 4) => {
        if (!Number.isFinite(value)) return '—';
        return Number(value).toFixed(digits);
    };

    const formatClassDistribution = (distribution, mode = CLASSIFICATION_MODES.MULTICLASS) => {
        if (!distribution || typeof distribution !== 'object') return '—';
        const normalized = normalizeClassificationMode(mode);
        if (normalized === CLASSIFICATION_MODES.BINARY) {
            const up = Number(distribution.up) || 0;
            const down = Number(distribution.down) || 0;
            return `上漲：${up}｜下跌：${down}`;
        }
        const surge = Number(distribution.surge) || 0;
        const flat = Number(distribution.flat) || 0;
        const drop = Number(distribution.drop) || 0;
        return `大漲：${surge}｜小幅波動：${flat}｜大跌：${drop}`;
    };

    const formatShape = (shape) => {
        if (Array.isArray(shape)) {
            return `[${shape.map((item) => (Number.isFinite(item) ? item : '∗')).join(', ')}]`;
        }
        if (typeof shape === 'string') return shape;
        if (shape && typeof shape === 'object') {
            try {
                return JSON.stringify(shape);
            } catch (error) {
                return '—';
            }
        }
        return '—';
    };

    const updateAnnDiagnosticsButtonState = () => {
        if (!elements.annDiagnosticsButton) return;
        const annState = getModelState(MODEL_TYPES.ANNS);
        const diagnostics = annState?.annDiagnostics;
        const hasDiagnostics = Boolean(diagnostics && Array.isArray(diagnostics.layerDiagnostics) && diagnostics.layerDiagnostics.length > 0);
        const isAnnActive = globalState.activeModel === MODEL_TYPES.ANNS;
        const canOpen = isAnnActive && hasDiagnostics;
        elements.annDiagnosticsButton.disabled = !canOpen;
        elements.annDiagnosticsButton.classList.toggle('opacity-60', !canOpen);
        elements.annDiagnosticsButton.classList.toggle('cursor-not-allowed', !canOpen);
        if (!isAnnActive) {
            const label = '僅在選取 ANNS 模型時可檢視功能測試報告';
            elements.annDiagnosticsButton.setAttribute('aria-label', label);
            elements.annDiagnosticsButton.setAttribute('title', label);
        } else if (hasDiagnostics) {
            const label = '開啟 ANNS 功能測試報告';
            elements.annDiagnosticsButton.setAttribute('aria-label', label);
            elements.annDiagnosticsButton.setAttribute('title', label);
        } else {
            const label = '尚未產生 ANNS 功能測試報告';
            elements.annDiagnosticsButton.setAttribute('aria-label', label);
            elements.annDiagnosticsButton.setAttribute('title', label);
        }
    };

    const buildAnnDiagnosticsHtml = (diagnostics) => {
        const dataset = diagnostics?.dataset || {};
        const performance = diagnostics?.performance || {};
        const indicatorDiagnostics = Array.isArray(diagnostics?.indicatorDiagnostics) ? diagnostics.indicatorDiagnostics : [];
        const layerDiagnostics = Array.isArray(diagnostics?.layerDiagnostics) ? diagnostics.layerDiagnostics : [];
        const accuracyLabel = performance.accuracyLabel || '測試正確率';
        const timestamp = Number.isFinite(diagnostics?.timestamp)
            ? new Date(diagnostics.timestamp).toISOString()
            : new Date().toISOString();
        const indicatorRows = indicatorDiagnostics.length > 0
            ? indicatorDiagnostics.map((entry) => `
                <tr>
                    <td>${escapeHTML(entry.name || '')}</td>
                    <td>${Number(entry.finiteSamples || 0)} / ${Number(entry.totalSamples || 0)}</td>
                    <td>${formatPercent(entry.coverage ?? (entry.totalSamples > 0 ? (entry.finiteSamples / entry.totalSamples) : 0), 1)}</td>
                    <td>${formatNumber(entry.min)}</td>
                    <td>${formatNumber(entry.max)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5">尚未取得技術指標檢查結果。</td></tr>';
        const layerRows = layerDiagnostics.length > 0
            ? layerDiagnostics.map((layer) => {
                const activation = layer.activation ? escapeHTML(layer.activation) : '—';
                const units = Number.isFinite(layer.units) ? layer.units : '—';
                const shapeText = formatShape(layer.outputShape);
                const hasNaN = layer.hasNaN ? '⚠️ 發現 NaN' : '✅ 通過';
                const weightSummaries = Array.isArray(layer.weightSummaries) && layer.weightSummaries.length > 0
                    ? layer.weightSummaries.map((item) => {
                        const label = `W${item.index ?? 0}`;
                        const sizeText = `尺寸 ${Number(item.size || 0)}`;
                        const finiteText = `有效 ${Number(item.finiteCount || 0)}`;
                        const nanText = `NaN ${Number(item.nanCount || 0)}`;
                        const rangeText = (Number.isFinite(item.min) && Number.isFinite(item.max))
                            ? `範圍 [${formatNumber(item.min, 4)}, ${formatNumber(item.max, 4)}]`
                            : '範圍 [—]';
                        return `${label}：${sizeText}｜${finiteText}｜${nanText}｜${rangeText}`;
                    }).join('<br/>')
                    : '無可檢測權重';
                const className = layer.className ? escapeHTML(layer.className) : '—';
                const name = layer.name ? escapeHTML(layer.name) : `Layer ${layer.index}`;
                return `
                    <tr>
                        <td>${layer.index ?? 0}</td>
                        <td>${name}</td>
                        <td>${className}</td>
                        <td>${activation}</td>
                        <td>${units}</td>
                        <td>${escapeHTML(shapeText)}</td>
                        <td>${hasNaN}</td>
                        <td>${weightSummaries}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="8">尚未產生層級診斷資訊。</td></tr>';

        const positivePrecisionText = Number.isFinite(performance.positivePrecision) ? formatPercent(performance.positivePrecision, 2) : '—';
        const positiveRecallText = Number.isFinite(performance.positiveRecall) ? formatPercent(performance.positiveRecall, 2) : '—';
        const positiveF1Text = Number.isFinite(performance.positiveF1) ? formatPercent(performance.positiveF1, 2) : '—';
        const positiveLabel = dataset.classificationMode === CLASSIFICATION_MODES.BINARY ? '上漲' : '大漲';
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="utf-8" />
    <title>ANNS 功能測試報告</title>
    <style>
        body { font-family: 'Inter', 'Noto Sans TC', sans-serif; margin: 16px; color: #1f2933; background-color: #f9fafb; }
        h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
        h2 { font-size: 1.125rem; margin: 1.5rem 0 0.75rem; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem; background-color: #ffffff; }
        th, td { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
        th { background-color: #f3f4f6; font-weight: 600; }
        .summary { background-color: #ffffff; border: 1px solid #d1d5db; padding: 1rem; border-radius: 8px; font-size: 0.9rem; }
        .meta { font-size: 0.8rem; color: #6b7280; margin-bottom: 1rem; }
        .note { font-size: 0.75rem; color: #4b5563; margin: 0.25rem 0; }
    </style>
</head>
<body>
    <h1>ANNS 功能測試報告</h1>
    <div class="meta">版本：${escapeHTML(diagnostics?.version || '—')}｜產出時間：${escapeHTML(timestamp)}</div>
    <section class="summary">
        <p>資料筆數：共 ${Number(dataset.usableSamples || 0)} 筆（原始 ${Number(dataset.totalParsedRows || 0)} 筆），訓練集 ${Number(dataset.trainSamples || 0)} 筆｜測試集 ${Number(dataset.testSamples || 0)} 筆。</p>
        <p>分類模式：${dataset.classificationMode === CLASSIFICATION_MODES.BINARY ? '二分類（漲跌）' : '三分類（波動分級）'}｜樣本分佈：${formatClassDistribution(dataset.classDistribution, dataset.classificationMode)}。</p>
        <p>${accuracyLabel}：${formatPercent(performance.testAccuracy, 2)}｜訓練期勝率：${formatPercent(performance.trainAccuracy, 2)}。</p>
        <p>${positiveLabel} precision：${positivePrecisionText}｜${positiveLabel} recall：${positiveRecallText}｜${positiveLabel} F1：${positiveF1Text}｜正向預測次數：${Number(performance.positivePredictions || 0)}｜實際${positiveLabel}天數：${Number(performance.positiveActuals || 0)}。</p>
        <p class="note">Precision（精確率） = TP ÷ (TP + FP) → 預測${positiveLabel}時，有多少是真的${positiveLabel}？</p>
        <p class="note">Recall（召回率） = TP ÷ (TP + FN) → 所有真的${positiveLabel}，有多少被模型抓到？</p>
        <p class="note">F1（調和平均） = 2 × Precision × Recall ÷ (Precision + Recall) → 精確率與召回率的綜合。</p>
    </section>
    <h2>技術指標覆蓋率</h2>
    <table>
        <thead>
            <tr>
                <th>指標名稱</th>
                <th>有效樣本 / 總樣本</th>
                <th>覆蓋率</th>
                <th>最小值</th>
                <th>最大值</th>
            </tr>
        </thead>
        <tbody>${indicatorRows}</tbody>
    </table>
    <h2>模型層級檢查</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>名稱</th>
                <th>類型</th>
                <th>Activation</th>
                <th>單元數</th>
                <th>輸出維度</th>
                <th>NaN 檢查</th>
                <th>權重摘要</th>
            </tr>
        </thead>
        <tbody>${layerRows}</tbody>
    </table>
</body>
</html>`;
        return html;
    };

    const openAnnDiagnosticsWindow = () => {
        const annState = getModelState(MODEL_TYPES.ANNS);
        const diagnostics = annState?.annDiagnostics;
        if (!diagnostics) {
            showStatus('[ANNS 技術指標感知器] 尚未產生功能測試報告，請先完成一次訓練。', 'warning');
            return;
        }
        const popup = window.open('', 'annsDiagnostics', 'width=720,height=640,scrollbars=yes,resizable=yes');
        if (!popup) {
            showStatus('[ANNS 技術指標感知器] 瀏覽器封鎖了彈出視窗，請允許後再試。', 'warning');
            return;
        }
        const reportHtml = buildAnnDiagnosticsHtml(diagnostics);
        popup.document.open();
        popup.document.write(reportHtml);
        popup.document.close();
        popup.focus();
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

    const deriveVolatilityThresholdsFromReturns = (values, fallback = DEFAULT_VOLATILITY_THRESHOLDS, diagnosticsRef = null) => {
        const fallbackSanitized = sanitizeVolatilityThresholds(fallback);
        if (!Array.isArray(values) || values.length === 0) {
            return fallbackSanitized;
        }
        const filtered = values.filter((value) => Number.isFinite(value));
        if (filtered.length === 0) {
            return fallbackSanitized;
        }

        const sorted = filtered.slice().sort((a, b) => a - b);
        const positives = sorted.filter((value) => value > 0);
        const negatives = sorted.filter((value) => value < 0);
        const zeroCount = filtered.length - positives.length - negatives.length;

        const combinedUpperQuartile = computeQuantileValue(sorted, 0.75);
        const combinedLowerQuartile = computeQuantileValue(sorted, 0.25);
        const positiveOnlyQuartile = positives.length > 0 ? computeQuantileValue(positives, 0.75) : NaN;
        const negativeOnlyQuartile = negatives.length > 0 ? computeQuantileValue(negatives, 0.25) : NaN;

        let positiveSource = 'combined';
        let negativeSource = 'combined';

        let upperCandidate = Number.isFinite(combinedUpperQuartile) ? combinedUpperQuartile : NaN;
        if (!(upperCandidate > 0)) {
            if (Number.isFinite(positiveOnlyQuartile) && positiveOnlyQuartile > 0) {
                upperCandidate = positiveOnlyQuartile;
                positiveSource = 'positive-only';
            } else {
                const fallbackUpper = Number.isFinite(fallbackSanitized.upperQuantile) && fallbackSanitized.upperQuantile > 0
                    ? fallbackSanitized.upperQuantile
                    : (fallbackSanitized.surge > 0 ? fallbackSanitized.surge : NaN);
                upperCandidate = Number.isFinite(fallbackUpper) ? fallbackUpper : NaN;
                positiveSource = 'default';
            }
        }

        let lowerCandidate = Number.isFinite(combinedLowerQuartile) ? combinedLowerQuartile : NaN;
        if (!(lowerCandidate < 0)) {
            if (Number.isFinite(negativeOnlyQuartile) && negativeOnlyQuartile < 0) {
                lowerCandidate = negativeOnlyQuartile;
                negativeSource = 'negative-only';
            } else {
                const fallbackLower = Number.isFinite(fallbackSanitized.lowerQuantile) && fallbackSanitized.lowerQuantile < 0
                    ? fallbackSanitized.lowerQuantile
                    : (fallbackSanitized.drop > 0 ? -fallbackSanitized.drop : NaN);
                lowerCandidate = Number.isFinite(fallbackLower) ? fallbackLower : NaN;
                negativeSource = 'default';
            }
        }

        const sanitized = sanitizeVolatilityThresholds({
            surge: upperCandidate,
            drop: Math.abs(lowerCandidate),
            lowerQuantile: lowerCandidate,
            upperQuantile: upperCandidate,
        });

        if (diagnosticsRef && typeof diagnosticsRef === 'object') {
            const positiveThreshold = Number.isFinite(sanitized.upperQuantile)
                ? sanitized.upperQuantile
                : (Number.isFinite(sanitized.surge) ? sanitized.surge : NaN);
            const negativeThreshold = Number.isFinite(sanitized.lowerQuantile)
                ? sanitized.lowerQuantile
                : (Number.isFinite(sanitized.drop) ? -sanitized.drop : NaN);

            let positiveExceedCount = 0;
            let negativeExceedCount = 0;
            if (Number.isFinite(positiveThreshold) || Number.isFinite(negativeThreshold)) {
                for (let i = 0; i < filtered.length; i += 1) {
                    const value = filtered[i];
                    if (Number.isFinite(positiveThreshold) && value >= positiveThreshold) {
                        positiveExceedCount += 1;
                    } else if (Number.isFinite(negativeThreshold) && value <= negativeThreshold) {
                        negativeExceedCount += 1;
                    }
                }
            }

            let midbandCount = filtered.length - positiveExceedCount - negativeExceedCount;
            if (!Number.isFinite(midbandCount) || midbandCount < 0) {
                midbandCount = Math.max(filtered.length - positiveExceedCount - negativeExceedCount, 0);
            }
            const positiveExceedShare = positives.length > 0 ? (positiveExceedCount / positives.length) : NaN;
            const negativeExceedShare = negatives.length > 0 ? (negativeExceedCount / negatives.length) : NaN;
            const totalPositiveShare = filtered.length > 0 ? (positiveExceedCount / filtered.length) : NaN;
            const totalNegativeShare = filtered.length > 0 ? (negativeExceedCount / filtered.length) : NaN;
            const zeroShare = filtered.length > 0 ? (zeroCount / filtered.length) : NaN;
            const midbandShare = filtered.length > 0 ? (midbandCount / filtered.length) : NaN;
            diagnosticsRef.totalSamples = filtered.length;
            if (!Number.isFinite(diagnosticsRef.expectedTrainSamples)) {
                diagnosticsRef.expectedTrainSamples = filtered.length;
            }
            diagnosticsRef.positiveSamples = positives.length;
            diagnosticsRef.negativeSamples = negatives.length;
            diagnosticsRef.zeroSamples = zeroCount;
            diagnosticsRef.upperQuartile = Number.isFinite(combinedUpperQuartile) ? combinedUpperQuartile : null;
            diagnosticsRef.lowerQuartile = Number.isFinite(combinedLowerQuartile) ? combinedLowerQuartile : null;
            diagnosticsRef.combinedUpperQuartile = diagnosticsRef.upperQuartile;
            diagnosticsRef.combinedLowerQuartile = diagnosticsRef.lowerQuartile;
            diagnosticsRef.positiveQuartile = diagnosticsRef.upperQuartile;
            diagnosticsRef.negativeQuartile = diagnosticsRef.lowerQuartile;
            diagnosticsRef.positiveOnlyQuartile = Number.isFinite(positiveOnlyQuartile) ? positiveOnlyQuartile : null;
            diagnosticsRef.negativeOnlyQuartile = Number.isFinite(negativeOnlyQuartile) ? negativeOnlyQuartile : null;
            diagnosticsRef.positiveThreshold = Number.isFinite(positiveThreshold) ? positiveThreshold : null;
            diagnosticsRef.negativeThreshold = Number.isFinite(negativeThreshold) ? negativeThreshold : null;
            diagnosticsRef.positiveExceedCount = positiveExceedCount;
            diagnosticsRef.negativeExceedCount = negativeExceedCount;
            diagnosticsRef.positiveExceedShare = Number.isFinite(positiveExceedShare) ? positiveExceedShare : null;
            diagnosticsRef.negativeExceedShare = Number.isFinite(negativeExceedShare) ? negativeExceedShare : null;
            diagnosticsRef.totalPositiveShare = Number.isFinite(totalPositiveShare) ? totalPositiveShare : null;
            diagnosticsRef.totalNegativeShare = Number.isFinite(totalNegativeShare) ? totalNegativeShare : null;
            diagnosticsRef.zeroShare = Number.isFinite(zeroShare) ? zeroShare : null;
            diagnosticsRef.midbandCount = midbandCount;
            diagnosticsRef.midbandShare = Number.isFinite(midbandShare) ? midbandShare : null;
            diagnosticsRef.usedPositiveFallback = positiveSource !== 'combined';
            diagnosticsRef.usedNegativeFallback = negativeSource !== 'combined';
            diagnosticsRef.positiveSource = positiveSource;
            diagnosticsRef.negativeSource = negativeSource;
            diagnosticsRef.fallbackUpperQuartile = null;
            diagnosticsRef.fallbackLowerQuartile = null;
        }

        return sanitized;
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

    const volatilityToPercent = (thresholds = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const upperSource = Number.isFinite(thresholds?.upperQuantile)
            ? thresholds.upperQuantile
            : (Number.isFinite(thresholds?.surge) ? thresholds.surge : DEFAULT_VOLATILITY_THRESHOLDS.surge);
        const lowerSource = Number.isFinite(thresholds?.lowerQuantile)
            ? thresholds.lowerQuantile
            : (Number.isFinite(thresholds?.drop) ? -Math.abs(thresholds.drop) : -DEFAULT_VOLATILITY_THRESHOLDS.drop);
        const clampedUpper = Math.min(Math.max(upperSource, 0), 0.5);
        const clampedLower = Math.max(Math.min(lowerSource, 0), -0.5);
        return {
            surge: Number((clampedUpper * 100).toFixed(2)),
            drop: Number((clampedLower * 100).toFixed(2)),
            upper: Number((clampedUpper * 100).toFixed(2)),
            lower: Number((clampedLower * 100).toFixed(2)),
        };
    };

    const resolveVolatilityBounds = (thresholds = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const sanitized = sanitizeVolatilityThresholds(thresholds);
        const upper = Number.isFinite(sanitized?.upperQuantile)
            ? sanitized.upperQuantile
            : (Number.isFinite(sanitized?.surge) ? sanitized.surge : NaN);
        const lower = Number.isFinite(sanitized?.lowerQuantile)
            ? sanitized.lowerQuantile
            : (Number.isFinite(sanitized?.drop) ? -Math.abs(sanitized.drop) : NaN);
        return {
            upper: Number.isFinite(upper) ? upper : NaN,
            lower: Number.isFinite(lower) ? lower : NaN,
        };
    };

    const formatVolatilityDescription = (thresholds = DEFAULT_VOLATILITY_THRESHOLDS) => {
        const percent = volatilityToPercent(thresholds);
        return `大漲≧${percent.surge.toFixed(2)}%｜大跌≦${percent.drop.toFixed(2)}%`;
    };

    const updateVolatilityDiagnosticsDisplay = (diagnostics, classificationMode = CLASSIFICATION_MODES.MULTICLASS) => {
        const container = elements.volatilityDiagnostics;
        const sampleEl = elements.volatilitySampleSummary;
        const surgeEl = elements.volatilitySurgeSummary;
        const dropEl = elements.volatilityDropSummary;
        if (!container || !sampleEl || !surgeEl || !dropEl) {
            return;
        }
        const normalizedMode = normalizeClassificationMode(classificationMode);
        const hasDiagnostics = diagnostics && typeof diagnostics === 'object';
        if (!hasDiagnostics || normalizedMode !== CLASSIFICATION_MODES.MULTICLASS) {
            container.classList.add('opacity-60');
            sampleEl.textContent = normalizedMode === CLASSIFICATION_MODES.MULTICLASS
                ? '尚未計算，請完成一次 AI 預測。'
                : '目前為二分類模式，僅顯示勝率門檻。';
            surgeEl.textContent = '';
            dropEl.textContent = '';
            return;
        }

        container.classList.remove('opacity-60');
        const totalSamples = Number.isFinite(diagnostics.totalSamples) ? diagnostics.totalSamples : 0;
        const expectedSamples = Number.isFinite(diagnostics.expectedTrainSamples)
            ? diagnostics.expectedTrainSamples
            : totalSamples;
        const positiveSamples = Number.isFinite(diagnostics.positiveSamples) ? diagnostics.positiveSamples : 0;
        const negativeSamples = Number.isFinite(diagnostics.negativeSamples) ? diagnostics.negativeSamples : 0;
        const zeroSamples = Number.isFinite(diagnostics.zeroSamples)
            ? diagnostics.zeroSamples
            : Math.max(totalSamples - positiveSamples - negativeSamples, 0);
        const positiveExceed = Number.isFinite(diagnostics.positiveExceedCount) ? diagnostics.positiveExceedCount : 0;
        const negativeExceed = Number.isFinite(diagnostics.negativeExceedCount) ? diagnostics.negativeExceedCount : 0;
        let midband = Number.isFinite(diagnostics.midbandCount)
            ? diagnostics.midbandCount
            : (totalSamples - positiveExceed - negativeExceed);
        if (!Number.isFinite(midband) || midband < 0) {
            midband = Math.max(totalSamples - positiveExceed - negativeExceed, 0);
        }

        const midbandShare = Number.isFinite(diagnostics.midbandShare)
            ? diagnostics.midbandShare
            : (totalSamples > 0 ? midband / totalSamples : NaN);
        const zeroShare = Number.isFinite(diagnostics.zeroShare)
            ? diagnostics.zeroShare
            : (totalSamples > 0 ? zeroSamples / totalSamples : NaN);

        const positiveShare = Number.isFinite(diagnostics.positiveExceedShare)
            ? diagnostics.positiveExceedShare
            : (positiveSamples > 0 ? positiveExceed / positiveSamples : NaN);
        const negativeShare = Number.isFinite(diagnostics.negativeExceedShare)
            ? diagnostics.negativeExceedShare
            : (negativeSamples > 0 ? negativeExceed / negativeSamples : NaN);
        const totalPositiveShare = Number.isFinite(diagnostics.totalPositiveShare)
            ? diagnostics.totalPositiveShare
            : (totalSamples > 0 ? positiveExceed / totalSamples : NaN);
        const totalNegativeShare = Number.isFinite(diagnostics.totalNegativeShare)
            ? diagnostics.totalNegativeShare
            : (totalSamples > 0 ? negativeExceed / totalSamples : NaN);

        const positiveThreshold = Number.isFinite(diagnostics.positiveThreshold) ? diagnostics.positiveThreshold : NaN;
        const negativeThreshold = Number.isFinite(diagnostics.negativeThreshold) ? diagnostics.negativeThreshold : NaN;
        const combinedUpperQuartile = Number.isFinite(diagnostics.combinedUpperQuartile)
            ? diagnostics.combinedUpperQuartile
            : (Number.isFinite(diagnostics.upperQuartile) ? diagnostics.upperQuartile : NaN);
        const combinedLowerQuartile = Number.isFinite(diagnostics.combinedLowerQuartile)
            ? diagnostics.combinedLowerQuartile
            : (Number.isFinite(diagnostics.lowerQuartile) ? diagnostics.lowerQuartile : NaN);
        const positiveOnlyQuartile = Number.isFinite(diagnostics.positiveOnlyQuartile)
            ? diagnostics.positiveOnlyQuartile
            : NaN;
        const negativeOnlyQuartile = Number.isFinite(diagnostics.negativeOnlyQuartile)
            ? diagnostics.negativeOnlyQuartile
            : NaN;
        const positiveSource = typeof diagnostics.positiveSource === 'string'
            ? diagnostics.positiveSource
            : (diagnostics.usedPositiveFallback ? 'default' : 'combined');
        const negativeSource = typeof diagnostics.negativeSource === 'string'
            ? diagnostics.negativeSource
            : (diagnostics.usedNegativeFallback ? 'default' : 'combined');

        const summaryParts = [`訓練集隔日收盤漲跌幅 ${expectedSamples} 天`];
        if (expectedSamples !== totalSamples) {
            summaryParts.push(`有效樣本 ${totalSamples} 天`);
        }
        const signComposition = [];
        if (positiveSamples > 0) signComposition.push(`上漲 ${positiveSamples} 天`);
        if (negativeSamples > 0) signComposition.push(`下跌 ${negativeSamples} 天`);
        if (zeroSamples > 0) {
            const zeroShareText = Number.isFinite(zeroShare) ? formatPercent(zeroShare, 1) : '—';
            signComposition.push(`平盤 ${zeroSamples} 天（約 ${zeroShareText}）`);
        }
        const midbandText = Number.isFinite(midbandShare) ? formatPercent(midbandShare, 1) : '—';
        const compositionText = signComposition.length > 0
            ? `（${signComposition.join('｜')}）`
            : '';
        const smallBandText = midband > 0
            ? `｜小波動門檻內 ${midband} 天（約 ${midbandText}）`
            : '';
        sampleEl.textContent = `${summaryParts.join('｜')}${compositionText}${smallBandText}`;

        const positiveCountText = positiveSamples > 0 ? `${positiveExceed}/${positiveSamples}` : `${positiveExceed}/—`;
        const positiveShareText = Number.isFinite(positiveShare) ? formatPercent(positiveShare, 1) : '—';
        const positiveTotalShareText = Number.isFinite(totalPositiveShare) ? formatPercent(totalPositiveShare, 1) : '—';
        let positiveSourceText = '';
        if (positiveSource === 'combined') {
            positiveSourceText = Number.isFinite(combinedUpperQuartile)
                ? `｜訓練集上四分位 (Q3) ${formatPercent(combinedUpperQuartile, 2)}`
                : '｜使用訓練集上四分位 (Q3)';
        } else if (positiveSource === 'positive-only') {
            positiveSourceText = Number.isFinite(positiveOnlyQuartile)
                ? `｜正報酬上四分位 ${formatPercent(positiveOnlyQuartile, 2)}`
                : '｜正報酬樣本上四分位';
        } else {
            positiveSourceText = Number.isFinite(positiveThreshold)
                ? `｜樣本不足，改用預設門檻 ${formatPercent(positiveThreshold, 2)}`
                : '｜樣本不足，改用預設門檻';
        }
        surgeEl.textContent = Number.isFinite(positiveThreshold)
            ? `大漲門檻 ≈ ${formatPercent(positiveThreshold, 2)}（達門檻 ${positiveCountText} 天，約 ${positiveShareText}｜占訓練集 ${positiveTotalShareText}）${positiveSourceText}`
            : '大漲門檻尚未計算，請重新訓練一次。';

        const negativeCountText = negativeSamples > 0 ? `${negativeExceed}/${negativeSamples}` : `${negativeExceed}/—`;
        const negativeShareText = Number.isFinite(negativeShare) ? formatPercent(negativeShare, 1) : '—';
        const negativeTotalShareText = Number.isFinite(totalNegativeShare) ? formatPercent(totalNegativeShare, 1) : '—';
        let negativeSourceText = '';
        if (negativeSource === 'combined') {
            negativeSourceText = Number.isFinite(combinedLowerQuartile)
                ? `｜訓練集下四分位 (Q1) ${formatPercent(combinedLowerQuartile, 2)}`
                : '｜使用訓練集下四分位 (Q1)';
        } else if (negativeSource === 'negative-only') {
            negativeSourceText = Number.isFinite(negativeOnlyQuartile)
                ? `｜負報酬下四分位 ${formatPercent(negativeOnlyQuartile, 2)}`
                : '｜負報酬樣本下四分位';
        } else {
            negativeSourceText = Number.isFinite(negativeThreshold)
                ? `｜樣本不足，改用預設門檻 ${formatPercent(negativeThreshold, 2)}`
                : '｜樣本不足，改用預設門檻';
        }
        dropEl.textContent = Number.isFinite(negativeThreshold)
            ? `大跌門檻 ≈ ${formatPercent(negativeThreshold, 2)}（達門檻 ${negativeCountText} 天，約 ${negativeShareText}｜占訓練集 ${negativeTotalShareText}）${negativeSourceText}`
            : '大跌門檻尚未計算，請重新訓練一次。';
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

    const normalizeClassReturnAverages = (stats, mode = CLASSIFICATION_MODES.MULTICLASS) => {
        const normalizedMode = normalizeClassificationMode(mode);
        const safe = stats && typeof stats === 'object' ? stats : {};
        const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
        return {
            train: ensureObject(safe.train),
            overall: ensureObject(safe.overall),
            trainCounts: ensureObject(safe.trainCounts),
            overallCounts: ensureObject(safe.overallCounts),
            mode: normalizedMode,
        };
    };

    const computePredictedSwingValue = (probabilities, mode, averages) => {
        const normalizedMode = normalizeClassificationMode(mode);
        if (!Array.isArray(probabilities) || probabilities.length === 0) return NaN;
        const baseProbs = probabilities.slice(0, 3);
        while (baseProbs.length < 3) baseProbs.push(0);
        const normalizedProbs = normalizeProbabilities(baseProbs);
        const stats = normalizeClassReturnAverages(averages, normalizedMode);
        const pickAverage = (key, fallbackValue) => {
            const trainValue = Number(stats.train[key]);
            if (Number.isFinite(trainValue)) return trainValue;
            const overallValue = Number(stats.overall[key]);
            if (Number.isFinite(overallValue)) return overallValue;
            return Number.isFinite(fallbackValue) ? fallbackValue : NaN;
        };
        if (normalizedMode === CLASSIFICATION_MODES.MULTICLASS) {
            const dropMean = pickAverage('drop', NaN);
            const flatMean = pickAverage('flat', 0);
            const surgeMean = pickAverage('surge', NaN);
            if (!Number.isFinite(dropMean) && !Number.isFinite(flatMean) && !Number.isFinite(surgeMean)) {
                return NaN;
            }
            return ((normalizedProbs[0] ?? 0) * dropMean)
                + ((normalizedProbs[1] ?? 0) * flatMean)
                + ((normalizedProbs[2] ?? 0) * surgeMean);
        }
        const downMean = pickAverage('down', NaN);
        const upMean = pickAverage('up', NaN);
        const downProb = normalizedProbs[0] ?? 0;
        const upProb = normalizedProbs[2] ?? (normalizedProbs[1] ?? 0);
        if (!Number.isFinite(downMean) && !Number.isFinite(upMean)) {
            return NaN;
        }
        return (downProb * downMean) + (upProb * upMean);
    };

    const formatPredictedSwingText = (value) => {
        if (!Number.isFinite(value)) return '—';
        return formatPercent(value, 2);
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
        const resolvedBounds = resolveVolatilityBounds(payload?.volatilityThresholds || DEFAULT_VOLATILITY_THRESHOLDS);
        annotated.volatilityUpper = resolvedBounds.upper;
        annotated.volatilityLower = resolvedBounds.lower;
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
        const modelState = getActiveModelState();
        const classificationMode = normalizeClassificationMode(modelState?.classification || elements.classificationMode?.value);
        if (!elements.winThreshold) return getDefaultWinThresholdForMode(classificationMode);
        const defaultPercent = Math.round(getDefaultWinThresholdForMode(classificationMode) * 100);
        const percent = Math.round(parseNumberInput(elements.winThreshold, defaultPercent, { min: 0, max: 100 }));
        elements.winThreshold.value = String(percent);
        const threshold = percent / 100;
        if (modelState) {
            modelState.winThreshold = threshold;
        }
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

    const getLastFetchSettingsSnapshot = () => {
        if (typeof window === 'undefined') return null;
        const snapshot = window.lastFetchSettings;
        if (snapshot && typeof snapshot === 'object') {
            return { ...snapshot };
        }
        return null;
    };

    const resolveActiveMarketKey = () => {
        const snapshot = getLastFetchSettingsSnapshot();
        const candidates = [
            snapshot?.market,
            snapshot?.marketType,
            snapshot?.marketCategory,
            snapshot?.marketLabel,
            typeof window !== 'undefined' ? window.currentMarket : null,
        ];
        for (let i = 0; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            if (candidate === null || candidate === undefined) continue;
            const text = candidate.toString().trim();
            if (!text) continue;
            return text.toUpperCase();
        }
        return '';
    };

    const isActiveMarketUS = () => {
        const marketKey = resolveActiveMarketKey();
        if (!marketKey) return false;
        if (marketKey === 'US' || marketKey === 'NASDAQ' || marketKey === 'NYSE') {
            return true;
        }
        if (marketKey.includes('US')) {
            return true;
        }
        return false;
    };

    const normalizeIsoDate = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
    };

    const resolveRowDateRange = (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const dated = rows
            .map((row) => (row && typeof row.date === 'string' ? row.date : null))
            .filter((date) => typeof date === 'string');
        if (dated.length === 0) return null;
        const sorted = dated.slice().sort((a, b) => a.localeCompare(b));
        const startISO = normalizeIsoDate(sorted[0]);
        const endISO = normalizeIsoDate(sorted[sorted.length - 1]);
        if (!startISO || !endISO) return null;
        return { startISO, endISO };
    };

    const buildVixCacheKey = (startISO, endISO) => `${startISO || 'NA'}|${endISO || 'NA'}`;

    const fetchVixSeries = async (startISO, endISO) => {
        const cacheKey = buildVixCacheKey(startISO, endISO);
        if (vixSeriesCache.has(cacheKey)) {
            return vixSeriesCache.get(cacheKey);
        }
        const params = new URLSearchParams({ stockNo: VIX_INDEX_SYMBOL });
        if (startISO) params.set('start', startISO);
        if (endISO) params.set('end', endISO);
        const response = await fetch(`/api/index/?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Index API HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload && typeof payload === 'object' && payload.error) {
            throw new Error(String(payload.error));
        }
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const normalized = rows
            .map((row) => {
                const date = typeof row?.date === 'string' ? row.date : null;
                if (!date) return null;
                const closeValue = Number(row?.close);
                return { date, close: Number.isFinite(closeValue) ? closeValue : NaN };
            })
            .filter(Boolean)
            .sort((a, b) => a.date.localeCompare(b.date));
        vixSeriesCache.set(cacheKey, normalized);
        return normalized;
    };

    const alignVixSeriesToRows = (rows, series) => {
        if (!Array.isArray(rows) || rows.length === 0) return rows;
        if (!Array.isArray(series) || series.length === 0) {
            return rows.map((row) => ({
                ...row,
                vixClose: Number.isFinite(Number(row?.vixClose)) ? Number(row.vixClose) : null,
            }));
        }
        const sortedSeries = series
            .filter((item) => item && typeof item.date === 'string')
            .sort((a, b) => a.date.localeCompare(b.date));
        const datedRows = rows
            .filter((row) => row && typeof row.date === 'string')
            .sort((a, b) => a.date.localeCompare(b.date));
        const mapping = new Map();
        let pointer = 0;
        let lastValue = NaN;
        datedRows.forEach((row) => {
            const rowDate = row.date;
            while (pointer < sortedSeries.length) {
                const candidate = sortedSeries[pointer];
                if (!candidate || typeof candidate.date !== 'string') {
                    pointer += 1;
                    continue;
                }
                if (candidate.date > rowDate) {
                    break;
                }
                if (Number.isFinite(candidate.close) && candidate.close > 0) {
                    lastValue = candidate.close;
                }
                pointer += 1;
            }
            let value = Number.isFinite(lastValue) ? lastValue : NaN;
            if (!Number.isFinite(value)) {
                for (let i = pointer; i < sortedSeries.length; i += 1) {
                    const candidate = sortedSeries[i];
                    if (Number.isFinite(candidate?.close) && candidate.close > 0) {
                        value = candidate.close;
                        break;
                    }
                }
            }
            if (Number.isFinite(value)) {
                mapping.set(rowDate, value);
                lastValue = value;
            }
        });
        return rows.map((row) => {
            if (!row || typeof row !== 'object') return row;
            const date = typeof row.date === 'string' ? row.date : null;
            const mappedValue = date ? mapping.get(date) : undefined;
            if (Number.isFinite(mappedValue)) {
                return { ...row, vixClose: mappedValue };
            }
            const existing = Number(row?.vixClose);
            if (Number.isFinite(existing)) {
                return { ...row, vixClose: existing };
            }
            return { ...row, vixClose: null };
        });
    };

    const ensureAnnRowsWithVix = async (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return rows;
        if (!isActiveMarketUS()) return rows;
        const hasExistingVix = rows.some((row) => Number.isFinite(Number(row?.vixClose)));
        if (hasExistingVix) return rows;
        const range = resolveRowDateRange(rows);
        if (!range) return rows;
        try {
            const series = await fetchVixSeries(range.startISO, range.endISO);
            if (!Array.isArray(series) || series.length === 0) {
                console.warn('[AI Prediction] VIX 指數資料為空，繼續使用原始特徵。');
                return rows;
            }
            return alignVixSeriesToRows(rows, series);
        } catch (error) {
            console.warn('[AI Prediction] 取得 VIX 指數資料失敗:', error);
            const label = formatModelLabel(MODEL_TYPES.ANNS);
            showStatus(`[${label}] 無法取得 VIX 指數資料，已以原始特徵繼續。`, 'warning');
            return rows;
        }
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
        const modelState = getActiveModelState();
        const fallbackMode = normalizeClassificationMode(modelState?.classification || CLASSIFICATION_MODES.MULTICLASS);
        const fallbackBounds = resolveVolatilityBounds(modelState?.volatilityThresholds || DEFAULT_VOLATILITY_THRESHOLDS);
        const classAverages = modelState?.predictionsPayload?.classReturnAverages || null;
        if (rows.length === 0) {
            const forecastMode = normalizeClassificationMode(forecast?.classificationMode || fallbackMode);
            const upperBound = Number.isFinite(forecast?.volatilityUpper) ? forecast.volatilityUpper : fallbackBounds.upper;
            const lowerBound = Number.isFinite(forecast?.volatilityLower) ? forecast.volatilityLower : fallbackBounds.lower;
            const forecastSwingValue = Number.isFinite(forecast?.predictedSwing)
                ? forecast.predictedSwing
                : computePredictedSwingValue(
                    Array.isArray(forecast?.probabilities) ? forecast.probabilities : [],
                    forecastMode,
                    classAverages);
            const swingText = formatPredictedSwingText(forecastSwingValue);
            const surgeText = forecastMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(upperBound)
                ? formatPercent(upperBound, 2)
                : '—';
            const dropText = forecastMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(lowerBound)
                ? formatPercent(lowerBound, 2)
                : '—';
            const probabilityDetail = forecast && forecast.classLabel
                ? `<div class="text-[10px]" style="color: var(--muted-foreground);">${escapeHTML(forecast.classLabel)}</div>`
                : '';
            elements.tradeTableBody.innerHTML = forecast && Number.isFinite(forecast?.probability)
                ? `
                    <tr class="bg-muted/30">
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.buyDate || forecast.referenceDate || '最近收盤')}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.tradeDate || computeNextTradingDate(forecast.referenceDate) || forecast.referenceDate || '—')}
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>
                        </td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}${probabilityDetail}</td>
                        <td class="px-3 py-2 text-right">${swingText}</td>
                        <td class="px-3 py-2 text-right">${surgeText}</td>
                        <td class="px-3 py-2 text-right">${dropText}</td>
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
            const recordMode = normalizeClassificationMode(trade.classificationMode || fallbackMode);
            const recordUpper = Number.isFinite(trade.volatilityUpper) ? trade.volatilityUpper : fallbackBounds.upper;
            const recordLower = Number.isFinite(trade.volatilityLower) ? trade.volatilityLower : fallbackBounds.lower;
            const predictedSwingValue = Number.isFinite(trade.predictedSwing)
                ? trade.predictedSwing
                : computePredictedSwingValue(
                    Array.isArray(trade.probabilities) ? trade.probabilities : [],
                    recordMode,
                    classAverages);
            const predictedSwingText = formatPredictedSwingText(predictedSwingValue);
            const surgeThresholdText = recordMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(recordUpper)
                ? formatPercent(recordUpper, 2)
                : '—';
            const dropThresholdText = recordMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(recordLower)
                ? formatPercent(recordLower, 2)
                : '—';
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
                    <td class="px-3 py-2 text-right">${predictedSwingText}</td>
                    <td class="px-3 py-2 text-right">${surgeThresholdText}</td>
                    <td class="px-3 py-2 text-right">${dropThresholdText}</td>
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
            const forecastMode = normalizeClassificationMode(forecast.classificationMode || fallbackMode);
            const upperBound = Number.isFinite(forecast.volatilityUpper) ? forecast.volatilityUpper : fallbackBounds.upper;
            const lowerBound = Number.isFinite(forecast.volatilityLower) ? forecast.volatilityLower : fallbackBounds.lower;
            const forecastSwingValue = Number.isFinite(forecast.predictedSwing)
                ? forecast.predictedSwing
                : computePredictedSwingValue(
                    Array.isArray(forecast.probabilities) ? forecast.probabilities : [],
                    forecastMode,
                    classAverages);
            const swingText = formatPredictedSwingText(forecastSwingValue);
            const surgeText = forecastMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(upperBound)
                ? formatPercent(upperBound, 2)
                : '—';
            const dropText = forecastMode === CLASSIFICATION_MODES.MULTICLASS && Number.isFinite(lowerBound)
                ? formatPercent(lowerBound, 2)
                : '—';
            const forecastDetail = forecast.classLabel
                ? `<div class="text-[10px]" style="color: var(--muted-foreground);">${escapeHTML(forecast.classLabel)}</div>`
                : '';
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.buyDate || forecast.referenceDate || '最近收盤')}</td>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(tradeDateLabel)}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}${forecastDetail}</td>
                    <td class="px-3 py-2 text-right">${swingText}</td>
                    <td class="px-3 py-2 text-right">${surgeText}</td>
                    <td class="px-3 py-2 text-right">${dropText}</td>
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
        const activeState = getActiveModelState();
        if (activeState) {
            activeState.volatilityDiagnostics = null;
        }
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
        updateVolatilityDiagnosticsDisplay(null, getActiveModelState()?.classification);
    };

    const updateSummaryMetrics = (summary) => {
        if (!summary) return;
        const modelState = getActiveModelState();
        const activeClassification = normalizeClassificationMode(summary.classificationMode || getActiveModelState()?.classification);
        const classAverages = summary.classReturnAverages || modelState?.predictionsPayload?.classReturnAverages || null;
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
        if (elements.testAccuracyLabel) {
            const accuracyLabel = summary.testAccuracyLabel
                || (activeClassification === CLASSIFICATION_MODES.MULTICLASS ? '大漲命中率' : '測試期預測正確率');
            elements.testAccuracyLabel.textContent = accuracyLabel;
        }
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
        if (elements.hitRate) {
            const thresholdValue = Number.isFinite(summary.threshold)
                ? summary.threshold
                : getDefaultWinThresholdForMode(activeClassification);
            const thresholdPercent = Number.isFinite(thresholdValue)
                ? `${Math.round(thresholdValue * 100)}%`
                : '—';
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
            const aiWinText = formatPercent(summary.testAccuracy, 2);
            const buyHoldAnnualText = formatPercent(summary.buyHoldAnnualized, 2);
            elements.averageProfit.textContent = `AI勝率：${aiWinText}｜單次平均報酬%：${singleText}｜月平均報酬%：${monthlyText}｜年平均報酬%：${yearlyText}｜買入持有年化報酬%：${buyHoldAnnualText}｜交易次數：${tradeCount}｜標準差：${stdText}`;
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
            const aiWinText = formatPercent(summary.testAccuracy, 2);
            const buyHoldAnnualText = formatPercent(summary.buyHoldAnnualized, 2);
            const thresholdValue = Number.isFinite(summary.threshold)
                ? summary.threshold
                : getDefaultWinThresholdForMode(activeClassification);
            elements.tradeSummary.textContent = `${periodClause}共評估 ${totalPredictions} 筆測試樣本，勝率門檻設定為 ${Math.round(thresholdValue * 100)}%，執行 ${executedCount} 筆交易，${strategyLabel}。${totalClause}交易報酬% 中位數 ${medianText}，單次平均報酬% ${singleText}，月平均報酬% ${monthlyText}，年平均報酬% ${yearlyText}，AI勝率 ${aiWinText}，買入持有年化報酬% ${buyHoldAnnualText}。`;
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
                const forecastMode = normalizeClassificationMode(forecast.classificationMode || activeClassification);
                const swingValue = Number.isFinite(forecast.predictedSwing)
                    ? forecast.predictedSwing
                    : computePredictedSwingValue(
                        Array.isArray(forecast.probabilities) ? forecast.probabilities : [],
                        forecastMode,
                        classAverages);
                const swingText = formatPredictedSwingText(swingValue);
                const classLabel = forecast.classLabel || formatClassLabel(forecast.predictedClass ?? (forecast.probability >= threshold ? 2 : 1), activeClassification);
                elements.nextDayForecast.textContent = `${baseLabel} 的隔日大漲機率為 ${formatPercent(forecast.probability, 1)}（預測分類：${classLabel}｜預估漲跌幅 ${swingText}）；勝率門檻 ${Math.round(threshold * 100)}%，${meetsThreshold}${kellyText}`;
            }
        }
        updateVolatilityDiagnosticsDisplay(summary.volatilityDiagnostics, activeClassification);
    };

    const computeTradeOutcomes = (payload, options, trainingOdds) => {
        const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
        const meta = Array.isArray(payload?.meta) ? payload.meta : [];
        const returns = Array.isArray(payload?.returns) ? payload.returns : [];
        const classificationMode = normalizeClassificationMode(payload?.classificationMode || payload?.hyperparameters?.classificationMode);
        const defaultThreshold = getDefaultWinThresholdForMode(classificationMode);
        const threshold = Number.isFinite(options.threshold) ? options.threshold : defaultThreshold;
        const useKelly = Boolean(options.useKelly);
        const fixedFraction = sanitizeFraction(options.fixedFraction);
        const tradeRule = normalizeTradeRule(options.tradeRule);
        const volatilityThresholds = sanitizeVolatilityThresholds(options.volatilityThresholds || payload?.volatilityThresholds || DEFAULT_VOLATILITY_THRESHOLDS);
        const volatilityBounds = resolveVolatilityBounds(volatilityThresholds);
        const volatilityUpper = volatilityBounds.upper;
        const volatilityLower = volatilityBounds.lower;
        const classReturnAverages = normalizeClassReturnAverages(payload?.classReturnAverages, classificationMode);

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
                const expectedSwing = computePredictedSwingValue(parsed.probabilities, classificationMode, classReturnAverages);
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
                    volatilityUpper,
                    volatilityLower,
                    predictedSwing: Number.isFinite(expectedSwing) ? expectedSwing : NaN,
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
                        expectedSwing: Number.isFinite(expectedSwing) ? expectedSwing : NaN,
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
                            volatilityUpper,
                            volatilityLower,
                            predictedSwing: Number.isFinite(position.expectedSwing)
                                ? position.expectedSwing
                                : (Number.isFinite(expectedSwing) ? expectedSwing : NaN),
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
                            if (!Number.isFinite(entryRecord.predictedSwing) && Number.isFinite(position.expectedSwing)) {
                                entryRecord.predictedSwing = position.expectedSwing;
                            }
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
                const classIndex = parsed.classIndex;
                const meetsClassRequirement = classificationMode === CLASSIFICATION_MODES.MULTICLASS ? classIndex === 2 : true;
                const metaItem = meta[i] || {};
                if (!Number.isFinite(probability)) {
                    continue;
                }
                const expectedSwing = computePredictedSwingValue(parsed.probabilities, classificationMode, classReturnAverages);

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
                const triggered = probability >= threshold && meetsClassRequirement;
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
                        predictedClass: classIndex,
                        predictedClassLabel: formatClassLabel(classIndex, classificationMode),
                        probabilities: parsed.probabilities,
                        classificationMode,
                        executed: true,
                        volatilityUpper,
                        volatilityLower,
                        predictedSwing: Number.isFinite(expectedSwing) ? expectedSwing : NaN,
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
                    volatilityUpper,
                    volatilityLower,
                    predictedSwing: Number.isFinite(expectedSwing) ? expectedSwing : NaN,
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

        let buyHoldReturn = NaN;
        let buyHoldAnnualized = NaN;
        if (meta.length > 0) {
            let firstClose = NaN;
            for (let i = 0; i < meta.length; i += 1) {
                const candidate = Number(meta[i]?.buyClose);
                if (Number.isFinite(candidate) && candidate > 0) {
                    firstClose = candidate;
                    break;
                }
            }
            let lastClose = NaN;
            for (let i = meta.length - 1; i >= 0; i -= 1) {
                const sellCandidate = Number(meta[i]?.sellClose);
                if (Number.isFinite(sellCandidate) && sellCandidate > 0) {
                    lastClose = sellCandidate;
                    break;
                }
                const fallbackSell = Number(meta[i]?.sellPrice);
                if (Number.isFinite(fallbackSell) && fallbackSell > 0) {
                    lastClose = fallbackSell;
                    break;
                }
            }
            if (Number.isFinite(firstClose) && Number.isFinite(lastClose) && firstClose > 0) {
                buyHoldReturn = (lastClose - firstClose) / firstClose;
                if (Number.isFinite(periodYears) && periodYears > 0) {
                    buyHoldAnnualized = ((1 + buyHoldReturn) ** (1 / periodYears)) - 1;
                }
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
                buyHoldReturn,
                buyHoldAnnualized,
            },
            rule: tradeRule,
            volatilityThresholds,
            classReturnAverages,
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
        const defaultThreshold = getDefaultWinThresholdForMode(classificationMode);
        const threshold = Number.isFinite(options.threshold) ? options.threshold : defaultThreshold;
        payload.classificationMode = classificationMode;
        const diagnostics = payload?.volatilityDiagnostics && typeof payload.volatilityDiagnostics === 'object'
            ? { ...payload.volatilityDiagnostics }
            : null;
        const evaluation = computeTradeOutcomes(payload, {
            ...options,
            tradeRule: selectedRule,
            fixedFraction: sanitizedFixedFraction,
            volatilityThresholds: resolvedVolatility,
        }, trainingOdds);
        const evaluationRule = normalizeTradeRule(evaluation.rule || selectedRule);
        const allRecords = Array.isArray(evaluation.allRecords) ? evaluation.allRecords : [];
        const evaluationBounds = resolveVolatilityBounds(evaluation.volatilityThresholds || resolvedVolatility);
        const volatilityUpper = evaluationBounds.upper;
        const volatilityLower = evaluationBounds.lower;
        const classAverages = evaluation.classReturnAverages || normalizeClassReturnAverages(payload.classReturnAverages, classificationMode);
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
            if (!Number.isFinite(forecast.volatilityUpper)) {
                forecast.volatilityUpper = volatilityUpper;
            }
            if (!Number.isFinite(forecast.volatilityLower)) {
                forecast.volatilityLower = volatilityLower;
            }
            if (evaluationRule === 'open-entry') {
                forecast.buyPrice = Number.isFinite(forecast.buyPrice) ? NaN : forecast.buyPrice;
            }
            const forecastSwing = computePredictedSwingValue(
                Array.isArray(forecast.probabilities) ? forecast.probabilities : [],
                classificationMode,
                classAverages
            );
            if (!Number.isFinite(forecast.predictedSwing) && Number.isFinite(forecastSwing)) {
                forecast.predictedSwing = forecastSwing;
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
            buyHoldReturn: evaluation.stats.buyHoldReturn,
            buyHoldAnnualized: evaluation.stats.buyHoldAnnualized,
            usingKelly: Boolean(options.useKelly),
            fixedFraction: sanitizedFixedFraction,
            threshold: Number.isFinite(options.threshold) ? options.threshold : defaultThreshold,
            seed: Number.isFinite(payload?.hyperparameters?.seed) ? payload.hyperparameters.seed : null,
            forecast,
            tradeRule: evaluationRule,
            volatilityThresholds: resolvedVolatility,
            classificationMode,
            testAccuracyLabel: classificationMode === CLASSIFICATION_MODES.MULTICLASS ? '大漲命中率' : '測試期預測正確率',
            volatilityDiagnostics: diagnostics,
            classReturnAverages: classAverages,
        };

        modelState.trainingMetrics = metrics;
        modelState.lastSummary = summary;
        modelState.currentTrades = evaluation.trades;
        modelState.allPredictionRows = allRecords;
        modelState.odds = trainingOdds;
        modelState.volatilityDiagnostics = diagnostics;
        payload.tradeRule = evaluationRule;
        payload.volatilityThresholds = resolvedVolatility;
        payload.allRecords = allRecords;
        payload.volatilityDiagnostics = diagnostics;
        payload.classReturnAverages = classAverages;
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
        updateAnnDiagnosticsButtonState();
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
            const thresholdPercent = Math.round(resolveWinThreshold(modelState) * 100);
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
        updateVolatilityDiagnosticsDisplay(modelState.volatilityDiagnostics, classificationMode);
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
        updateAnnDiagnosticsButtonState();
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
        let volatilityDiagnostics = null;
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
            const diagnosticsPayload = {};
            recalibratedVolatility = deriveVolatilityThresholdsFromReturns(trainingSwings, resolvedVolatility, diagnosticsPayload);
            diagnosticsPayload.expectedTrainSamples = trainingSwings.length;
            volatilityDiagnostics = diagnosticsPayload;
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
        dataset.volatilityDiagnostics = volatilityDiagnostics;
        resolvedVolatility = recalibratedVolatility;
        modelState.volatilityThresholds = resolvedVolatility;
        modelState.volatilityDiagnostics = volatilityDiagnostics;

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
            threshold: Number.isFinite(hyperparametersUsed?.threshold)
                ? hyperparametersUsed.threshold
                : (Number.isFinite(predictionsPayload.hyperparameters?.threshold)
                    ? predictionsPayload.hyperparameters.threshold
                    : getDefaultWinThresholdForMode(classificationMode)),
            seed: Number.isFinite(hyperparametersUsed?.seed)
                ? hyperparametersUsed.seed
                : (Number.isFinite(requestedSeed) ? requestedSeed : (Number.isFinite(hyperparameters.seed) ? hyperparameters.seed : null)),
            classificationMode,
        };

        predictionsPayload.hyperparameters = { ...resolvedHyper, volatility: resolvedVolatility };
        predictionsPayload.volatilityThresholds = resolvedVolatility;
        predictionsPayload.classificationMode = classificationMode;
        if (!predictionsPayload.volatilityDiagnostics && volatilityDiagnostics) {
            predictionsPayload.volatilityDiagnostics = { ...volatilityDiagnostics };
        }

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
            ? `｜交易報酬% 中位數 ${formatPercent(summary.tradeReturnMedian, 2)}｜單次平均報酬% ${formatPercent(Number.isFinite(summary.tradeReturnAverageSingle) ? summary.tradeReturnAverageSingle : summary.tradeReturnAverage, 2)}｜月平均報酬% ${formatPercent(summary.tradeReturnAverageMonthly, 2)}｜年平均報酬% ${formatPercent(summary.tradeReturnAverageYearly, 2)}｜AI勝率 ${formatPercent(summary.testAccuracy, 2)}｜買入持有年化報酬% ${formatPercent(summary.buyHoldAnnualized, 2)}｜交易次數 ${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}`
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
        modelState.annDiagnostics = workerResult?.diagnostics ? { ...workerResult.diagnostics } : null;
        updateAnnDiagnosticsButtonState();
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
            threshold: Number.isFinite(hyperparametersUsed?.threshold)
                ? hyperparametersUsed.threshold
                : (Number.isFinite(predictionsPayload.hyperparameters?.threshold)
                    ? predictionsPayload.hyperparameters.threshold
                    : getDefaultWinThresholdForMode(classificationMode)),
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
            ? `｜交易報酬% 中位數 ${formatPercent(summary.tradeReturnMedian, 2)}｜單次平均報酬% ${formatPercent(Number.isFinite(summary.tradeReturnAverageSingle) ? summary.tradeReturnAverageSingle : summary.tradeReturnAverage, 2)}｜月平均報酬% ${formatPercent(summary.tradeReturnAverageMonthly, 2)}｜年平均報酬% ${formatPercent(summary.tradeReturnAverageYearly, 2)}｜AI勝率 ${formatPercent(summary.testAccuracy, 2)}｜買入持有年化報酬% ${formatPercent(summary.buyHoldAnnualized, 2)}｜交易次數 ${Number.isFinite(summary.executedTrades) ? summary.executedTrades : 0}`
            : '';
        showStatus(`[${label}] ${finalMessage}${seedSuffix}${appended}`, 'success');
    };

    const recomputeTradesFromState = (modelType = globalState.activeModel) => {
        const modelState = getModelState(modelType);
        if (!modelState || !modelState.predictionsPayload || !modelState.trainingMetrics) return;

        let threshold = resolveWinThreshold(modelState);
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
        let bestThreshold = resolveWinThreshold(modelState);
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
                volatilityDiagnostics: modelState.volatilityDiagnostics,
                classReturnAverages: modelState.predictionsPayload.classReturnAverages,
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
                volatilityDiagnostics: summary.volatilityDiagnostics,
                classReturnAverages: summary.classReturnAverages,
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
            classReturnAverages: seed.payload?.classReturnAverages || null,
        };
        const seedDiagnostics = (seed.payload?.volatilityDiagnostics && typeof seed.payload.volatilityDiagnostics === 'object')
            ? seed.payload.volatilityDiagnostics
            : (seed.summary?.volatilityDiagnostics && typeof seed.summary.volatilityDiagnostics === 'object'
                ? seed.summary.volatilityDiagnostics
                : null);
        modelState.volatilityDiagnostics = seedDiagnostics ? { ...seedDiagnostics } : null;
        if (modelState.volatilityDiagnostics) {
            modelState.predictionsPayload.volatilityDiagnostics = { ...modelState.volatilityDiagnostics };
        }
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
                threshold: resolveWinThreshold(modelState),
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

            const datasetRows = normalizedModel === MODEL_TYPES.ANNS
                ? await ensureAnnRowsWithVix(rows)
                : rows;

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
                await runLstmModel(modelState, datasetRows, hyperparameters, riskOptions, lstmRuntimeOptions);
            } else {
                await runAnnModel(modelState, datasetRows, hyperparameters, riskOptions, annRuntimeOptions);
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
        elements.volatilityDiagnostics = document.getElementById('ai-volatility-diagnostics');
        elements.volatilitySampleSummary = document.getElementById('ai-volatility-sample-summary');
        elements.volatilitySurgeSummary = document.getElementById('ai-volatility-surge-summary');
        elements.volatilityDropSummary = document.getElementById('ai-volatility-drop-summary');
        elements.annDiagnosticsButton = document.getElementById('ai-ann-diagnostics');
        elements.testAccuracyLabel = document.getElementById('ai-test-accuracy-label');

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

        if (elements.annDiagnosticsButton) {
            elements.annDiagnosticsButton.addEventListener('click', () => {
                openAnnDiagnosticsWindow();
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
        updateAnnDiagnosticsButtonState();

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
