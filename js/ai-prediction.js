/* global document, window, workerUrl */

// Patch Tag: LB-AI-ENTRY-20250924A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-ENTRY-20250924A';
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
    const BUY_RULES = {
        CLOSE_LIMIT: 'close-limit',
        OPEN_MARKET: 'open-market',
    };
    const BUY_RULE_LABELS = {
        [BUY_RULES.CLOSE_LIMIT]: '收盤價掛單',
        [BUY_RULES.OPEN_MARKET]: '開盤價買入',
    };
    const BUY_RULE_DESCRIPTIONS = {
        [BUY_RULES.CLOSE_LIMIT]: '收盤價掛單：隔日預測上漲且隔日最低價低於今日收盤，若開盤價低於今日收盤則以開盤價成交，否則以今日收盤價掛單，賣出價為隔日收盤。',
        [BUY_RULES.OPEN_MARKET]: '開盤價買入：隔日預測上漲即於隔日開盤價買入，當日收盤價賣出。',
    };
    const formatBuyRuleLabel = (rule) => BUY_RULE_LABELS[rule] || BUY_RULE_LABELS[BUY_RULES.CLOSE_LIMIT];
    const normalizeBuyRule = (rule) => (Object.values(BUY_RULES).includes(rule) ? rule : BUY_RULES.CLOSE_LIMIT);
    const createModelState = () => ({
        lastSummary: null,
        odds: 1,
        predictionsPayload: null,
        trainingMetrics: null,
        currentTrades: [],
        lastSeedDefault: '',
        winThreshold: 0.5,
        kellyEnabled: false,
        fixedFraction: 1,
        buyRule: BUY_RULES.CLOSE_LIMIT,
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
        activeModel: MODEL_TYPES.LSTM,
        models: {
            [MODEL_TYPES.LSTM]: createModelState(),
            [MODEL_TYPES.ANNS]: createModelState(),
        },
    };
    const getModelState = (model) => {
        if (!model || !globalState.models[model]) {
            return globalState.models[MODEL_TYPES.LSTM];
        }
        return globalState.models[model];
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
        buyRuleSelect: null,
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
        buyRuleDescription: null,
        seedName: null,
        saveSeedButton: null,
        savedSeedList: null,
        loadSeedButton: null,
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

    const formatPrice = (value) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(2);
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
        if (!Number.isFinite(num)) return 1;
        const normalized = num > 1 ? (num / 100) : num;
        return Math.min(Math.max(normalized, 0.01), 1);
    };

    const formatFractionInput = (fraction) => {
        const sanitized = sanitizeFraction(fraction);
        return (sanitized * 100).toFixed(0);
    };

    const updateBuyRuleDescription = (rule) => {
        if (!elements.buyRuleDescription) return;
        const normalized = normalizeBuyRule(rule);
        elements.buyRuleDescription.textContent = BUY_RULE_DESCRIPTIONS[normalized];
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
        const trainText = formatPercent(summary.trainAccuracy, 1);
        const testText = formatPercent(summary.testAccuracy, 1);
        return `訓練勝率${trainText}｜測試正確率${testText}`;
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

    const resolveOpenValue = (row, fallback) => {
        const candidates = [
            row?.open,
            row?.adjustedOpen,
            row?.rawOpen,
            row?.baseOpen,
            row?.referenceOpen,
        ];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(candidates[i]);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    };

    const resolveHighValue = (row, fallback) => {
        const candidates = [row?.high, row?.rawHigh, row?.baseHigh];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(candidates[i]);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    };

    const resolveLowValue = (row, fallback) => {
        const candidates = [row?.low, row?.rawLow, row?.baseLow];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(candidates[i]);
            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }
        return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
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
                open: resolveOpenValue(row, resolveCloseValue(row)),
                high: resolveHighValue(row, resolveCloseValue(row)),
                low: resolveLowValue(row, resolveCloseValue(row)),
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
                nextOpen: Number.isFinite(curr.open) ? curr.open : curr.close,
                nextLow: Number.isFinite(curr.low) ? curr.low : curr.close,
                nextClose: curr.close,
                nextHigh: Number.isFinite(curr.high) ? curr.high : curr.close,
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

    const evaluateTradeEntry = (metaItem, buyRule) => {
        if (!metaItem) return null;
        const normalizedRule = normalizeBuyRule(buyRule);
        const toPositive = (value) => {
            const num = Number(value);
            return Number.isFinite(num) && num > 0 ? num : NaN;
        };
        const tradeDate = typeof metaItem.sellDate === 'string' && metaItem.sellDate
            ? metaItem.sellDate
            : (typeof metaItem.tradeDate === 'string' ? metaItem.tradeDate : null);
        if (!tradeDate) return null;
        const buyClose = toPositive(metaItem.buyClose);
        const sellClose = toPositive(metaItem.sellClose);
        const nextCloseRaw = toPositive(metaItem.nextClose);
        const nextClose = Number.isFinite(nextCloseRaw) ? nextCloseRaw : sellClose;
        if (!Number.isFinite(nextClose)) return null;
        if (normalizedRule === BUY_RULES.OPEN_MARKET) {
            const nextOpenRaw = toPositive(metaItem.nextOpen);
            const resolvedOpen = Number.isFinite(nextOpenRaw) ? nextOpenRaw : nextClose;
            if (!Number.isFinite(resolvedOpen) || resolvedOpen <= 0) return null;
            const actualReturn = (nextClose - resolvedOpen) / resolvedOpen;
            return {
                tradeDate,
                buyPrice: resolvedOpen,
                sellPrice: nextClose,
                actualReturn,
            };
        }
        if (!Number.isFinite(buyClose) || buyClose <= 0) return null;
        const nextLowRaw = toPositive(metaItem.nextLow);
        const resolvedLow = Number.isFinite(nextLowRaw) ? nextLowRaw : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(resolvedLow) || resolvedLow >= buyClose) {
            return null;
        }
        const nextOpenRaw = toPositive(metaItem.nextOpen);
        const resolvedOpen = Number.isFinite(nextOpenRaw) ? nextOpenRaw : nextClose;
        const entryPrice = Number.isFinite(resolvedOpen) && resolvedOpen < buyClose
            ? resolvedOpen
            : buyClose;
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null;
        const actualReturn = (nextClose - entryPrice) / entryPrice;
        return {
            tradeDate,
            buyPrice: entryPrice,
            sellPrice: nextClose,
            actualReturn,
        };
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
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}
                            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>
                        </td>
                        <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                        <td class="px-3 py-2 text-right">—</td>
                        <td class="px-3 py-2 text-right">—</td>
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
            const buyPriceText = formatPrice(trade.buyPrice);
            const sellPriceText = formatPrice(trade.sellPrice);
            const actualClass = Number.isFinite(trade.actualReturn) && trade.actualReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const tradeReturnClass = Number.isFinite(trade.tradeReturn) && trade.tradeReturn < 0 ? 'text-rose-600' : 'text-emerald-600';
            const badge = trade.isForecast
                ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span>`
                : '';
            return `
                <tr${trade.isForecast ? ' class="bg-muted/30"' : ''}>
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(trade.tradeDate || '—')}${badge}</td>
                    <td class="px-3 py-2 text-right">${probabilityText}</td>
                    <td class="px-3 py-2 text-right">${buyPriceText}</td>
                    <td class="px-3 py-2 text-right">${sellPriceText}</td>
                    <td class="px-3 py-2 text-right ${actualClass}">${actualReturnText}</td>
                    <td class="px-3 py-2 text-right">${fractionText}</td>
                    <td class="px-3 py-2 text-right ${tradeReturnClass}">${tradeReturnText}</td>
                </tr>
            `;
        });

        if (forecast && Number.isFinite(forecast.probability)) {
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">—</td>
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
        updateBuyRuleDescription(getActiveModelState()?.buyRule);
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
            const ruleLabel = formatBuyRuleLabel(summary.buyRule);
            const medianText = formatPercent(summary.tradeReturnMedian, 2);
            const averageText = formatPercent(summary.tradeReturnAverage, 2);
            elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，勝率門檻設定為 ${Math.round((summary.threshold || 0.5) * 100)}%，執行 ${summary.executedTrades} 筆交易，${strategyLabel}，採用${ruleLabel}策略。交易報酬% 中位數 ${medianText}，平均報酬% ${averageText}。`;
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
                elements.nextDayForecast.textContent = `${baseLabel} 的隔日上漲機率為 ${formatPercent(forecast.probability, 1)}；勝率門檻 ${Math.round(threshold * 100)}%，${meetsThreshold}${kellyText}`;
            }
        }
        updateBuyRuleDescription(summary.buyRule);
    };

    const computeTradeOutcomes = (payload, options, trainingOdds) => {
        const predictions = Array.isArray(payload?.predictions) ? payload.predictions : [];
        const meta = Array.isArray(payload?.meta) ? payload.meta : [];
        const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.5;
        const useKelly = Boolean(options.useKelly);
        const fixedFraction = sanitizeFraction(options.fixedFraction);
        const buyRule = normalizeBuyRule(options.buyRule);

        const executedTrades = [];
        const tradeReturns = [];
        let wins = 0;

        for (let i = 0; i < predictions.length; i += 1) {
            const probability = Number(predictions[i]);
            const metaItem = meta[i];
            if (!Number.isFinite(probability) || !metaItem) {
                continue;
            }
            if (probability < threshold) {
                continue;
            }
            const decision = evaluateTradeEntry(metaItem, buyRule);
            if (!decision || !Number.isFinite(decision.actualReturn)) {
                continue;
            }
            const fraction = useKelly
                ? computeKellyFraction(probability, trainingOdds)
                : fixedFraction;
            const tradeReturn = decision.actualReturn * fraction;
            if (decision.actualReturn > 0) {
                wins += 1;
            }
            executedTrades.push({
                tradeDate: decision.tradeDate,
                probability,
                actualReturn: decision.actualReturn,
                fraction,
                tradeReturn,
                buyPrice: decision.buyPrice,
                sellPrice: decision.sellPrice,
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
        const normalizedRule = normalizeBuyRule(options.buyRule);
        const evaluation = computeTradeOutcomes(payload, { ...options, buyRule: normalizedRule }, trainingOdds);
        const forecast = payload.forecast && Number.isFinite(payload.forecast?.probability)
            ? { ...payload.forecast }
            : null;
        if (forecast) {
            const forecastFraction = options.useKelly
                ? computeKellyFraction(forecast.probability, trainingOdds)
                : sanitizeFraction(options.fixedFraction);
            forecast.fraction = forecastFraction;
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
            buyRule: normalizedRule,
            forecast,
        };

        modelState.trainingMetrics = metrics;
        modelState.lastSummary = summary;
        modelState.currentTrades = evaluation.trades;
        modelState.odds = trainingOdds;
        modelState.predictionsPayload = payload;
        modelState.buyRule = normalizedRule;

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
        const fractionInput = parseNumberInput(
            elements.fixedFraction,
            Number(formatFractionInput(modelState.fixedFraction)),
            { min: 1, max: 100 },
        );
        modelState.fixedFraction = sanitizeFraction(fractionInput);
        const selectedRule = elements.buyRuleSelect ? elements.buyRuleSelect.value : modelState.buyRule;
        modelState.buyRule = normalizeBuyRule(selectedRule);
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
            elements.fixedFraction.value = formatFractionInput(modelState.fixedFraction || 1);
        }
        if (elements.winThreshold) {
            const thresholdPercent = Math.round(((Number.isFinite(modelState.winThreshold) ? modelState.winThreshold : 0.5) * 100));
            elements.winThreshold.value = String(thresholdPercent);
        }
        if (elements.buyRuleSelect) {
            elements.buyRuleSelect.value = normalizeBuyRule(modelState.buyRule);
        }
        parseTrainRatio();
        parseWinThreshold();
        updateBuyRuleDescription(modelState.buyRule);
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
        let buyRule = normalizeBuyRule(modelState.buyRule);

        if (modelType === globalState.activeModel) {
            threshold = parseWinThreshold();
            useKelly = Boolean(elements.enableKelly?.checked);
            const fractionInput = parseNumberInput(
                elements.fixedFraction,
                Number(formatFractionInput(modelState.fixedFraction)),
                { min: 1, max: 100 },
            );
            modelState.kellyEnabled = useKelly;
            fixedFraction = sanitizeFraction(fractionInput);
            modelState.fixedFraction = fixedFraction;
            buyRule = normalizeBuyRule(elements.buyRuleSelect?.value || buyRule);
            modelState.buyRule = buyRule;
        }

        applyTradeEvaluation(modelType, modelState.predictionsPayload, modelState.trainingMetrics, {
            threshold,
            useKelly,
            fixedFraction,
            buyRule,
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
        const fractionInput = parseNumberInput(
            elements.fixedFraction,
            Number(formatFractionInput(modelState.fixedFraction)),
            { min: 1, max: 100 },
        );
        const fixedFraction = sanitizeFraction(fractionInput);
        const buyRule = normalizeBuyRule(elements.buyRuleSelect?.value || modelState.buyRule);
        modelState.buyRule = buyRule;
        const payload = modelState.predictionsPayload;
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(modelState.odds) ? modelState.odds : 1);
        let bestThreshold = modelState.winThreshold || 0.5;
        let bestMedian = Number.NEGATIVE_INFINITY;
        let bestAverage = Number.NEGATIVE_INFINITY;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = computeTradeOutcomes(payload, {
                threshold,
                useKelly,
                fixedFraction,
                buyRule,
            }, trainingOdds);
            const median = evaluation.stats.median;
            const average = evaluation.stats.average;
            const normalizedMedian = Number.isFinite(median) ? median : Number.NEGATIVE_INFINITY;
            const normalizedAverage = Number.isFinite(average) ? average : Number.NEGATIVE_INFINITY;
            if (
                normalizedMedian > bestMedian
                || (normalizedMedian === bestMedian && normalizedAverage > bestAverage)
                || (normalizedMedian === bestMedian && normalizedAverage === bestAverage && threshold < bestThreshold)
            ) {
                bestMedian = normalizedMedian;
                bestAverage = normalizedAverage;
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
        showStatus(`最佳化完成：勝率門檻 ${Math.round(bestThreshold * 100)}% 對應交易報酬% 中位數 ${formatPercent(bestMedian, 2)}。`, 'success');
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
                hyperparameters: modelState.predictionsPayload.hyperparameters,
            },
            trainingMetrics: modelState.trainingMetrics,
            summary: {
                threshold: summary.threshold,
                usingKelly: summary.usingKelly,
                fixedFraction: summary.fixedFraction,
                buyRule: summary.buyRule,
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
        modelState.predictionsPayload = {
            predictions: Array.isArray(seed.payload?.predictions) ? seed.payload.predictions : [],
            meta: Array.isArray(seed.payload?.meta) ? seed.payload.meta : [],
            returns: Array.isArray(seed.payload?.returns) ? seed.payload.returns : [],
            trainingOdds: seed.payload?.trainingOdds,
            forecast: seed.payload?.forecast || null,
            datasetLastDate: seed.payload?.datasetLastDate || null,
            hyperparameters: seed.payload?.hyperparameters || null,
        };
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
        if (elements.fixedFraction) {
            elements.fixedFraction.value = formatFractionInput(modelState.fixedFraction);
        }
        modelState.buyRule = normalizeBuyRule(seed.summary?.buyRule);
        modelState.winThreshold = Number.isFinite(seed.summary?.threshold)
            ? seed.summary.threshold
            : modelState.winThreshold;

        parseTrainRatio();
        parseWinThreshold();
        if (elements.buyRuleSelect) {
            elements.buyRuleSelect.value = modelState.buyRule;
        }
        updateBuyRuleDescription(modelState.buyRule);
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

    const runPrediction = async () => {
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
                buyRule: normalizeBuyRule(modelState.buyRule),
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
        elements.modelType = document.getElementById('ai-model-type');
        elements.trainRatio = document.getElementById('ai-train-ratio');
        elements.trainRatioBadge = document.getElementById('ai-train-ratio-badge');
        elements.lookback = document.getElementById('ai-lookback');
        elements.epochs = document.getElementById('ai-epochs');
        elements.batchSize = document.getElementById('ai-batch-size');
        elements.learningRate = document.getElementById('ai-learning-rate');
        elements.enableKelly = document.getElementById('ai-enable-kelly');
        elements.fixedFraction = document.getElementById('ai-fixed-fraction');
        elements.buyRuleSelect = document.getElementById('ai-buy-rule');
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
        elements.buyRuleDescription = document.getElementById('ai-buy-rule-description');
        elements.seedName = document.getElementById('ai-seed-name');
        elements.saveSeedButton = document.getElementById('ai-save-seed');
        elements.savedSeedList = document.getElementById('ai-saved-seeds');
        elements.loadSeedButton = document.getElementById('ai-load-seed');

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

        if (elements.buyRuleSelect) {
            elements.buyRuleSelect.addEventListener('change', () => {
                const modelState = getActiveModelState();
                if (modelState) {
                    modelState.buyRule = normalizeBuyRule(elements.buyRuleSelect.value);
                }
                updateBuyRuleDescription(elements.buyRuleSelect.value);
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
