/* global document, window, workerUrl */

// Patch Tag: LB-AI-HYBRID-20251001A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-HYBRID-20251001A';
    const SEED_STORAGE_KEY = 'lazybacktest-ai-seeds-v1';
    const state = {
        running: false,
        lastSummary: null,
        odds: 1,
        predictionsPayload: null,
        trainingMetrics: null,
        currentTrades: [],
        lastSeedDefault: '',
        modelType: 'lstm',
        trainRatio: 0.8,
        trainingDiagnostics: null,
    };

    let aiWorker = null;
    let aiWorkerSequence = 0;
    const aiWorkerRequests = new Map();

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        runButtonLabel: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
        winThreshold: null,
        optimizeThreshold: null,
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
        modelType: null,
        trainRatio: null,
        ratioBadge: null,
        modelTag: null,
        diagnosticCard: null,
        confusionMatrix: null,
        confusionNote: null,
        thresholdSummary: null,
        kellySummary: null,
    };

    const MODEL_CONFIG = {
        lstm: {
            label: 'LSTM',
            description: 'LSTM 深度學習',
        },
        anns: {
            label: 'ANNS',
            description: 'ANNS 技術指標神經網路',
        },
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };

    const getModelLabel = (type) => {
        const key = typeof type === 'string' ? type.toLowerCase() : 'lstm';
        return MODEL_CONFIG[key]?.label || MODEL_CONFIG.lstm.label;
    };

    const getModelDescription = (type) => {
        const key = typeof type === 'string' ? type.toLowerCase() : 'lstm';
        return MODEL_CONFIG[key]?.description || MODEL_CONFIG.lstm.description;
    };

    const formatTrainRatioText = (ratio) => {
        if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
            return '訓練：測試 = 80% : 20%';
        }
        const trainPercent = Math.round(ratio * 100);
        const testPercent = Math.max(0, 100 - trainPercent);
        return `訓練：測試 = ${trainPercent}% : ${testPercent}%`;
    };

    const updateTrainRatioBadge = (ratio) => {
        if (!elements.ratioBadge) return;
        elements.ratioBadge.textContent = formatTrainRatioText(ratio);
    };

    const updateModelBadge = (type) => {
        if (!elements.modelTag) return;
        const label = getModelLabel(type);
        elements.modelTag.textContent = label;
    };

    const updateRunButtonLabel = () => {
        if (!elements.runButtonLabel) return;
        const label = getModelLabel(state.modelType);
        elements.runButtonLabel.textContent = `啟動 ${label} 預測`;
    };

    const getTrainRatio = () => {
        if (!elements.trainRatio) return state.trainRatio || 0.8;
        const value = Number(elements.trainRatio.value);
        if (!Number.isFinite(value) || value <= 0 || value >= 1) {
            return state.trainRatio || 0.8;
        }
        state.trainRatio = value;
        return value;
    };

    const applyTrainRatioSelection = (ratio) => {
        if (!elements.trainRatio) return;
        const sanitized = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0.55), 0.95) : (state.trainRatio || 0.8);
        const normalized = Number(sanitized.toFixed(2));
        const ratioString = normalized.toString();
        const options = Array.from(elements.trainRatio.options || []);
        const exists = options.some((option) => option.value === ratioString);
        if (!exists) {
            const option = document.createElement('option');
            option.value = ratioString;
            option.textContent = `${Math.round(sanitized * 100)}% / ${Math.max(0, 100 - Math.round(sanitized * 100))}%`;
            option.dataset.dynamic = 'true';
            elements.trainRatio.appendChild(option);
        }
        elements.trainRatio.value = ratioString;
        state.trainRatio = sanitized;
        updateTrainRatioBadge(sanitized);
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
            return Array.isArray(parsed) ? parsed : [];
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
        if (!Number.isFinite(num)) return 0.01;
        return Math.min(Math.max(num, 0.01), 1);
    };

    const computeKellyStats = (returns) => {
        const result = {
            fraction: 0,
            winRate: 0,
            odds: 1,
        };
        if (!Array.isArray(returns) || returns.length === 0) {
            return result;
        }
        const wins = [];
        const losses = [];
        returns.forEach((ret) => {
            if (!Number.isFinite(ret)) return;
            if (ret > 0) wins.push(ret);
            else if (ret < 0) losses.push(Math.abs(ret));
        });
        const total = wins.length + losses.length;
        if (total === 0) {
            return result;
        }
        const winRate = wins.length / total;
        const avgWin = wins.length > 0 ? wins.reduce((acc, value) => acc + value, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((acc, value) => acc + value, 0) / losses.length : 0;
        const odds = avgLoss > 0 ? avgWin / avgLoss : 1;
        const q = 1 - winRate;
        const fraction = odds > 0 ? Math.max(0, (odds * winRate - q) / odds) : 0;
        return {
            fraction,
            winRate,
            odds,
        };
    };

    const computeConfusionMatrix = (predictions, returns, threshold) => {
        const matrix = { TP: 0, TN: 0, FP: 0, FN: 0 };
        if (!Array.isArray(predictions) || !Array.isArray(returns)) {
            return matrix;
        }
        const limit = Math.min(predictions.length, returns.length);
        const cut = Number.isFinite(threshold) ? threshold : 0.5;
        for (let i = 0; i < limit; i += 1) {
            const prob = predictions[i];
            const actual = returns[i];
            if (!Number.isFinite(prob) || !Number.isFinite(actual)) continue;
            const predictedUp = prob >= cut;
            const actualUp = actual > 0;
            if (predictedUp && actualUp) matrix.TP += 1;
            else if (predictedUp && !actualUp) matrix.FP += 1;
            else if (!predictedUp && actualUp) matrix.FN += 1;
            else matrix.TN += 1;
        }
        return matrix;
    };

    const parseWinThreshold = () => {
        if (!elements.winThreshold) return 0.5;
        const percent = Math.round(parseNumberInput(elements.winThreshold, 60, { min: 50, max: 100 }));
        elements.winThreshold.value = String(percent);
        const threshold = percent / 100;
        state.winThreshold = threshold;
        return threshold;
    };

    const refreshSeedOptions = () => {
        if (!elements.savedSeedList) return;
        const seeds = loadStoredSeeds();
        const options = seeds
            .map((seed) => {
                const modelLabel = getModelLabel(seed?.modelType || seed?.summary?.modelType || 'lstm');
                const displayName = seed?.name || '未命名種子';
                return `<option value="${escapeHTML(seed.id)}">${escapeHTML(`[${modelLabel}] ${displayName}`)}</option>`;
            })
            .join('');
        elements.savedSeedList.innerHTML = options;
    };

    const buildSeedDefaultName = (summary) => {
        if (!summary) return '';
        const trainText = formatPercent(summary.trainAccuracy, 1);
        const testText = formatPercent(summary.testAccuracy, 1);
        const ratio = Number.isFinite(summary.trainRatio) ? summary.trainRatio : state.trainRatio || 0.8;
        const ratioLabel = formatTrainRatioText(ratio).replace('訓練：測試 = ', '');
        const modelLabel = getModelLabel(summary.modelType || state.modelType);
        return `${modelLabel}｜訓練勝率${trainText}｜測試正確率${testText}｜${ratioLabel}`;
    };

    const applySeedDefaultName = (summary) => {
        if (!elements.seedName) return;
        const defaultName = buildSeedDefaultName(summary);
        elements.seedName.dataset.defaultName = defaultName;
        if (!elements.seedName.value || elements.seedName.value === state.lastSeedDefault) {
            elements.seedName.value = defaultName;
        }
        state.lastSeedDefault = defaultName;
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
        if (type === 'ai-train-lstm-progress' || type === 'ai-train-anns-progress') {
            if (typeof message === 'string' && message) {
                showStatus(message, 'info');
            }
            return;
        }
        if (!id || !aiWorkerRequests.has(id)) {
            return;
        }
        const pending = aiWorkerRequests.get(id);
        if (type === 'ai-train-lstm-result' || type === 'ai-train-anns-result') {
            aiWorkerRequests.delete(id);
            pending.resolve(data || {});
        } else if (type === 'ai-train-lstm-error' || type === 'ai-train-anns-error') {
            aiWorkerRequests.delete(id);
            const reason = error && typeof error.message === 'string'
                ? new Error(error.message)
                : new Error('AI 背景訓練失敗');
            pending.reject(reason);
        } else {
            aiWorkerRequests.delete(id);
            pending.reject(new Error('AI Worker 回傳未知訊息。'));
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

    const sendAIWorkerTrainingTask = (taskType, payload) => {
        const workerInstance = ensureAIWorker();
        const requestId = `ai-train-${Date.now()}-${aiWorkerSequence += 1}`;
        return new Promise((resolve, reject) => {
            aiWorkerRequests.set(requestId, { resolve, reject });
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
        state.running = Boolean(flag);
        if (!elements.runButton) return;
        elements.runButton.disabled = state.running;
        elements.runButton.classList.toggle('opacity-60', state.running);
        elements.runButton.classList.toggle('cursor-not-allowed', state.running);
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

    const resolveNumericField = (row, keys) => {
        if (!row || typeof row !== 'object') return null;
        for (let i = 0; i < keys.length; i += 1) {
            const value = Number(row[keys[i]]);
            if (Number.isFinite(value)) {
                return value;
            }
        }
        return null;
    };

    const buildAnnInputRows = (rows) => {
        if (!Array.isArray(rows)) return [];
        return rows
            .filter((row) => row && typeof row.date === 'string')
            .map((row) => {
                const close = resolveCloseValue(row);
                if (!Number.isFinite(close)) return null;
                const open = resolveNumericField(row, ['open', 'rawOpen', 'baseOpen', 'adjustedOpen', 'openPrice']);
                const high = resolveNumericField(row, ['high', 'rawHigh', 'baseHigh', 'adjustedHigh', 'highPrice']);
                const low = resolveNumericField(row, ['low', 'rawLow', 'baseLow', 'adjustedLow', 'lowPrice']);
                const volume = resolveNumericField(row, ['volume', 'vol', 'tradingVolume']);
                return {
                    date: row.date,
                    open: Number.isFinite(open) ? open : close,
                    high: Number.isFinite(high) ? high : close,
                    low: Number.isFinite(low) ? low : close,
                    close,
                    volume: Number.isFinite(volume) ? volume : 0,
                };
            })
            .filter((row) => row !== null)
            .sort((a, b) => a.date.localeCompare(b.date));
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
                        <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}
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
            htmlParts.push(`
                <tr class="bg-muted/30">
                    <td class="px-3 py-2 whitespace-nowrap">${escapeHTML(forecast.referenceDate || '最近收盤')}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium" style="background-color: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary-foreground);">隔日預測</span></td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.probability, 1)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                    <td class="px-3 py-2 text-right">${formatPercent(forecast.fraction, 2)}</td>
                    <td class="px-3 py-2 text-right">—</td>
                </tr>
            `);
        }

        elements.tradeTableBody.innerHTML = htmlParts.join('');
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
        applySeedDefaultName(summary);
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
        const triggeredReturns = [];
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
            triggeredReturns.push(actualReturn);
        }

        const executed = executedTrades.length;
        const hitRate = executed > 0 ? wins / executed : 0;
        const median = tradeReturns.length > 0 ? computeMedian(tradeReturns) : NaN;
        const average = tradeReturns.length > 0 ? computeMean(tradeReturns) : NaN;
        const stdDev = tradeReturns.length > 1 ? computeStd(tradeReturns, average) : NaN;
        const kellyStats = computeKellyStats(triggeredReturns);

        return {
            trades: executedTrades,
            stats: {
                executed,
                hitRate,
                median,
                average,
                stdDev,
                kelly: kellyStats,
            },
        };
    };

    const updateDiagnostics = (diagnostics, summary = state.lastSummary) => {
        if (!elements.diagnosticCard) return;
        const hasConfusion = diagnostics && diagnostics.confusion;
        const hasKelly = diagnostics && diagnostics.kelly;
        if (!hasConfusion && !hasKelly) {
            elements.diagnosticCard.classList.add('hidden');
            if (elements.confusionMatrix) elements.confusionMatrix.innerHTML = '';
            if (elements.confusionNote) elements.confusionNote.textContent = '';
            if (elements.thresholdSummary) elements.thresholdSummary.textContent = '尚無結果，可先執行一次模型訓練。';
            if (elements.kellySummary) elements.kellySummary.textContent = '';
            return;
        }
        elements.diagnosticCard.classList.remove('hidden');

        if (elements.confusionMatrix) {
            if (hasConfusion) {
                const { TP = 0, TN = 0, FP = 0, FN = 0 } = diagnostics.confusion;
                const cells = [
                    { label: 'TP（預測漲且漲）', value: TP },
                    { label: 'TN（預測跌且跌）', value: TN },
                    { label: 'FP（預測漲實際跌）', value: FP },
                    { label: 'FN（預測跌實際漲）', value: FN },
                ];
                elements.confusionMatrix.innerHTML = cells.map((cell) => `
                    <div class="p-2 border rounded" style="border-color: var(--border);">
                        <p class="text-[11px]" style="color: var(--muted-foreground);">${cell.label}</p>
                        <p class="text-base font-semibold">${cell.value}</p>
                    </div>
                `).join('');
            } else {
                elements.confusionMatrix.innerHTML = '';
            }
        }

        if (elements.confusionNote) {
            const thresholdPercent = summary && Number.isFinite(summary.threshold)
                ? Math.round(summary.threshold * 100)
                : Math.round((diagnostics?.threshold || state.winThreshold || 0.5) * 100);
            const modelLabel = getModelLabel(diagnostics?.modelType || summary?.modelType || state.modelType);
            elements.confusionNote.textContent = `模型：${modelLabel}，以勝率門檻 ${thresholdPercent}% 計算。`;
        }

        if (elements.thresholdSummary) {
            const executedTrades = Number.isFinite(summary?.executedTrades) ? summary.executedTrades : 0;
            const samples = diagnostics && Number.isFinite(diagnostics.samples)
                ? diagnostics.samples
                : (Number.isFinite(summary?.totalPredictions) ? summary.totalPredictions : 0);
            elements.thresholdSummary.textContent = `測試樣本 ${samples} 筆，觸發交易 ${executedTrades} 筆。`;
        }

        if (elements.kellySummary) {
            if (hasKelly) {
                const { fraction = 0, winRate = 0, odds = 1 } = diagnostics.kelly || {};
                const fractionText = formatPercent(fraction, 2);
                const winRateText = formatPercent(winRate, 1);
                const oddsText = Number.isFinite(odds) ? odds.toFixed(2) : '—';
                elements.kellySummary.innerHTML = `建議投入比例：<span class="font-semibold">${fractionText}</span>（勝率 ${winRateText}、盈虧比 ${oddsText}）。`;
            } else {
                elements.kellySummary.textContent = '尚無凱利估算結果。';
            }
        }
    };

    const applyTradeEvaluation = (payload, trainingMetrics, options) => {
        if (!payload) return;
        const metrics = trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(payload?.predictions) ? payload.predictions.length : 0,
        };
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(state.odds) ? state.odds : 1);
        const evaluation = computeTradeOutcomes(payload, options, trainingOdds);
        const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
        const returns = Array.isArray(payload.returns) ? payload.returns : [];
        const confusion = computeConfusionMatrix(predictions, returns, options.threshold);
        const kellyStats = evaluation.stats.kelly || { fraction: 0, winRate: 0, odds: 1 };
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
            modelType: payload.modelType || state.modelType || 'lstm',
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
            forecast,
            confusion,
            kelly: kellyStats,
            trainRatio: Number.isFinite(payload.hyperparameters?.trainRatio)
                ? payload.hyperparameters.trainRatio
                : (Number.isFinite(state.trainRatio) ? state.trainRatio : 0.8),
            kellyFraction: Number.isFinite(kellyStats?.fraction) ? kellyStats.fraction : NaN,
        };
        state.lastSummary = summary;
        state.trainingMetrics = metrics;
        state.currentTrades = evaluation.trades;
        state.modelType = summary.modelType;
        state.trainRatio = summary.trainRatio;
        state.trainingDiagnostics = {
            confusion,
            kelly: kellyStats,
            modelType: summary.modelType,
            trainRatio: summary.trainRatio,
            threshold: summary.threshold,
            samples: predictions.length,
        };
        updateSummaryMetrics(summary);
        renderTrades(evaluation.trades, summary.forecast);
        updateModelBadge(summary.modelType);
        updateRunButtonLabel();
        updateTrainRatioBadge(summary.trainRatio);
        updateDiagnostics(state.trainingDiagnostics, summary);
    };

    const recomputeTradesFromState = () => {
        if (!state.predictionsPayload || !state.trainingMetrics) {
            updateDiagnostics(null);
            return;
        }
        const threshold = parseWinThreshold();
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        applyTradeEvaluation(state.predictionsPayload, state.trainingMetrics, {
            threshold,
            useKelly,
            fixedFraction,
        });
    };

    const optimiseWinThreshold = () => {
        if (!state.predictionsPayload || !state.trainingMetrics) {
            showStatus('請先完成一次 AI 預測或載入已儲存的種子。', 'warning');
            return;
        }
        const useKelly = Boolean(elements.enableKelly?.checked);
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        const payload = state.predictionsPayload;
        const trainingOdds = Number.isFinite(payload.trainingOdds)
            ? payload.trainingOdds
            : (Number.isFinite(state.odds) ? state.odds : 1);
        let bestThreshold = 0.5;
        let bestMedian = Number.NEGATIVE_INFINITY;
        let bestAverage = Number.NEGATIVE_INFINITY;
        for (let percent = 50; percent <= 100; percent += 1) {
            const threshold = percent / 100;
            const evaluation = computeTradeOutcomes(payload, {
                threshold,
                useKelly,
                fixedFraction,
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
        state.winThreshold = bestThreshold;
        recomputeTradesFromState();
        showStatus(`最佳化完成：勝率門檻 ${Math.round(bestThreshold * 100)}% 對應交易報酬% 中位數 ${formatPercent(bestMedian, 2)}。`, 'success');
    };

    const handleSaveSeed = () => {
        if (!state.predictionsPayload || !state.trainingMetrics || !state.lastSummary) {
            showStatus('請先執行 AI 預測，再儲存種子。', 'warning');
            return;
        }
        if (typeof window === 'undefined' || !window.localStorage) {
            showStatus('此環境不支援本地儲存功能。', 'error');
            return;
        }
        const seeds = loadStoredSeeds();
        const summary = state.lastSummary;
        const defaultName = buildSeedDefaultName(summary) || '未命名種子';
        const inputName = elements.seedName?.value?.trim();
        const seedName = inputName || defaultName;
        const payloadModelType = state.predictionsPayload?.modelType || summary?.modelType || state.modelType;
        const hyperparameters = {
            ...(state.predictionsPayload?.hyperparameters || {}),
            trainRatio: Number.isFinite(summary?.trainRatio)
                ? summary.trainRatio
                : (Number.isFinite(state.trainRatio) ? state.trainRatio : state.predictionsPayload?.hyperparameters?.trainRatio),
            modelType: payloadModelType,
        };
        const newSeed = {
            id: `seed-${Date.now()}`,
            name: seedName,
            createdAt: Date.now(),
            payload: {
                predictions: state.predictionsPayload.predictions,
                meta: state.predictionsPayload.meta,
                returns: state.predictionsPayload.returns,
                trainingOdds: state.predictionsPayload.trainingOdds,
                forecast: state.predictionsPayload.forecast,
                datasetLastDate: state.predictionsPayload.datasetLastDate,
                hyperparameters,
                modelType: payloadModelType,
            },
            trainingMetrics: state.trainingMetrics,
            summary: {
                threshold: summary.threshold,
                usingKelly: summary.usingKelly,
                fixedFraction: summary.fixedFraction,
                trainRatio: summary.trainRatio,
                modelType: summary.modelType,
            },
            version: VERSION_TAG,
            modelType: payloadModelType,
        };
        seeds.push(newSeed);
        persistSeeds(seeds);
        refreshSeedOptions();
        showStatus(`已儲存種子「${seedName}」。`, 'success');
    };

    const activateSeed = (seed) => {
        if (!seed) return;
        const seedModelType = seed.payload?.modelType || seed.summary?.modelType || 'lstm';
        const seedTrainRatio = Number.isFinite(seed.summary?.trainRatio)
            ? seed.summary.trainRatio
            : (Number.isFinite(seed.payload?.hyperparameters?.trainRatio)
                ? seed.payload.hyperparameters.trainRatio
                : state.trainRatio);
        state.predictionsPayload = {
            predictions: Array.isArray(seed.payload?.predictions) ? seed.payload.predictions : [],
            meta: Array.isArray(seed.payload?.meta) ? seed.payload.meta : [],
            returns: Array.isArray(seed.payload?.returns) ? seed.payload.returns : [],
            trainingOdds: seed.payload?.trainingOdds,
            forecast: seed.payload?.forecast || null,
            datasetLastDate: seed.payload?.datasetLastDate || null,
            hyperparameters: seed.payload?.hyperparameters || {},
            modelType: seedModelType,
        };
        const metrics = seed.trainingMetrics || {
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            totalPredictions: Array.isArray(state.predictionsPayload.predictions)
                ? state.predictionsPayload.predictions.length
                : 0,
        };
        state.trainingMetrics = metrics;
        state.odds = Number.isFinite(seed.payload?.trainingOdds) ? seed.payload.trainingOdds : state.odds;
        state.modelType = seedModelType;
        if (elements.modelType) {
            const normalized = ['lstm', 'anns'].includes(seedModelType) ? seedModelType : 'lstm';
            elements.modelType.value = normalized;
        }
        applyTrainRatioSelection(seedTrainRatio);
        updateModelBadge(seedModelType);
        updateRunButtonLabel();

        if (elements.lookback && Number.isFinite(seed.payload?.hyperparameters?.lookback)) {
            elements.lookback.value = seed.payload.hyperparameters.lookback;
        }
        if (elements.epochs && Number.isFinite(seed.payload?.hyperparameters?.epochs)) {
            elements.epochs.value = seed.payload.hyperparameters.epochs;
        }
        if (elements.batchSize && Number.isFinite(seed.payload?.hyperparameters?.batchSize)) {
            elements.batchSize.value = seed.payload.hyperparameters.batchSize;
        }
        if (elements.learningRate && Number.isFinite(seed.payload?.hyperparameters?.learningRate)) {
            elements.learningRate.value = seed.payload.hyperparameters.learningRate;
        }

        if (elements.enableKelly && typeof seed.summary?.usingKelly === 'boolean') {
            elements.enableKelly.checked = seed.summary.usingKelly;
        }
        if (elements.fixedFraction && Number.isFinite(seed.summary?.fixedFraction)) {
            elements.fixedFraction.value = seed.summary.fixedFraction;
        }
        if (elements.winThreshold && Number.isFinite(seed.summary?.threshold)) {
            elements.winThreshold.value = String(Math.round(seed.summary.threshold * 100));
        }

        recomputeTradesFromState();
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
        showStatus(`已載入種子：${selectedSeeds.map((seed) => seed.name).join('、')}。`, 'success');
    };

    const runPrediction = async () => {
        if (state.running) return;
        toggleRunning(true);

        try {
            const lookback = Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
            const epochs = Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 300 }));
            const batchSize = Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
            const learningRate = parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });
            const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
            const useKelly = Boolean(elements.enableKelly?.checked);

            const modelType = elements.modelType?.value === 'anns' ? 'anns' : 'lstm';
            state.modelType = modelType;
            updateModelBadge(modelType);
            updateRunButtonLabel();

            const ratioSelection = getTrainRatio();
            applyTrainRatioSelection(ratioSelection);
            state.trainingDiagnostics = null;
            updateDiagnostics(null);

            const rows = getVisibleData();
            if (!Array.isArray(rows) || rows.length === 0) {
                showStatus('尚未取得回測資料，請先在主頁面執行回測。', 'warning');
                return;
            }

            if (modelType === 'lstm') {
                const dataset = buildDataset(rows, lookback);
                const minimumSamples = Math.max(45, lookback * 3);
                if (dataset.sequences.length < minimumSamples) {
                    showStatus(`資料樣本不足（需至少 ${minimumSamples} 筆有效樣本，目前 ${dataset.sequences.length} 筆），請延長回測期間。`, 'warning');
                    return;
                }

                const totalSamples = dataset.sequences.length;
                const rawTrainSize = Math.floor(totalSamples * ratioSelection);
                const minTrainSize = Math.max(lookback, Math.floor(totalSamples * 0.5));
                const boundedTrainSize = Math.min(Math.max(rawTrainSize, minTrainSize), totalSamples - 1);
                const testSize = totalSamples - boundedTrainSize;
                if (boundedTrainSize <= 0 || testSize <= 0) {
                    showStatus('訓練 / 測試樣本不足，請延長資料範圍或降低 lookback。', 'warning');
                    return;
                }
                const actualRatio = boundedTrainSize / totalSamples;
                state.trainRatio = actualRatio;
                applyTrainRatioSelection(actualRatio);

                const effectiveBatchSize = Math.min(batchSize, boundedTrainSize);
                if (batchSize > boundedTrainSize) {
                    showStatus(`批次大小 ${batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整為 ${effectiveBatchSize}。`, 'warning');
                }

                showStatus(`${getModelLabel(modelType)} 訓練中（共 ${epochs} 輪）...`, 'info');
                const workerResult = await sendAIWorkerTrainingTask('ai-train-lstm', {
                    dataset,
                    hyperparameters: {
                        lookback,
                        epochs,
                        batchSize: effectiveBatchSize,
                        learningRate,
                        totalSamples,
                        trainSize: boundedTrainSize,
                        trainRatio: actualRatio,
                    },
                });

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

                const hyperparameters = {
                    ...(predictionsPayload.hyperparameters || {}),
                    lookback,
                    epochs,
                    batchSize: effectiveBatchSize,
                    learningRate,
                    totalSamples,
                    trainSize: boundedTrainSize,
                    trainRatio: Number.isFinite(predictionsPayload.hyperparameters?.trainRatio)
                        ? predictionsPayload.hyperparameters.trainRatio
                        : actualRatio,
                    modelType,
                };

                state.predictionsPayload = {
                    ...predictionsPayload,
                    hyperparameters,
                    modelType,
                };
                state.odds = Number.isFinite(predictionsPayload.trainingOdds)
                    ? predictionsPayload.trainingOdds
                    : state.odds;
                state.trainRatio = hyperparameters.trainRatio;
                applyTrainRatioSelection(state.trainRatio);

                const threshold = parseWinThreshold();
                const fixedFractionValue = sanitizeFraction(fixedFraction);
                applyTradeEvaluation(state.predictionsPayload, trainingMetrics, {
                    threshold,
                    useKelly,
                    fixedFraction: fixedFractionValue,
                });

                const finalMessage = typeof workerResult?.finalMessage === 'string'
                    ? workerResult.finalMessage
                    : `完成：訓練勝率 ${formatPercent(trainingMetrics.trainAccuracy, 2)}，測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}。`;
                showStatus(finalMessage, 'success');
                return;
            }

            const annRows = buildAnnInputRows(rows);
            if (annRows.length < 60) {
                showStatus(`資料樣本不足（需至少 60 筆有效日線，目前 ${annRows.length} 筆），請延長回測期間。`, 'warning');
                return;
            }

            const annOptions = {
                trainRatio: ratioSelection,
                epochs,
                batchSize,
                learningRate,
                lookback,
            };

            showStatus(`${getModelLabel(modelType)} 訓練中（共 ${epochs} 輪）...`, 'info');
            const workerResult = await sendAIWorkerTrainingTask('ai-train-anns', {
                rows: annRows,
                options: annOptions,
            });

            const trainingMetrics = workerResult?.trainingMetrics || {
                trainAccuracy: NaN,
                trainLoss: NaN,
                testAccuracy: NaN,
                testLoss: NaN,
                totalPredictions: 0,
            };
            const predictionsPayload = workerResult?.predictionsPayload || null;
            if (!predictionsPayload || !Array.isArray(predictionsPayload.predictions)) {
                throw new Error('AI Worker 未回傳有效的 ANNS 預測結果。');
            }

            const annHyperparameters = {
                ...(predictionsPayload.hyperparameters || {}),
                trainRatio: Number.isFinite(predictionsPayload.hyperparameters?.trainRatio)
                    ? predictionsPayload.hyperparameters.trainRatio
                    : ratioSelection,
                epochs,
                batchSize,
                learningRate,
                lookback,
                modelType,
            };

            state.predictionsPayload = {
                ...predictionsPayload,
                hyperparameters: annHyperparameters,
                modelType,
            };
            state.odds = Number.isFinite(predictionsPayload.trainingOdds)
                ? predictionsPayload.trainingOdds
                : state.odds;
            state.trainRatio = annHyperparameters.trainRatio;
            applyTrainRatioSelection(state.trainRatio);

            const threshold = parseWinThreshold();
            const fixedFractionValue = sanitizeFraction(fixedFraction);
            applyTradeEvaluation(state.predictionsPayload, trainingMetrics, {
                threshold,
                useKelly,
                fixedFraction: fixedFractionValue,
            });

            const finalMessage = typeof workerResult?.finalMessage === 'string'
                ? workerResult.finalMessage
                : `完成：測試正確率 ${formatPercent(trainingMetrics.testAccuracy, 2)}，混淆矩陣與資金建議已更新。`;
            showStatus(finalMessage, 'success');
        } catch (error) {
            console.error('[AI Prediction] 執行失敗:', error);
            showStatus(`AI 預測執行失敗：${error.message}`, 'error');
        } finally {
            toggleRunning(false);
        }
    };

    const init = () => {
        elements.datasetSummary = document.getElementById('ai-dataset-summary');
        elements.status = document.getElementById('ai-status');
        elements.runButton = document.getElementById('ai-run-button');
        elements.runButtonLabel = document.getElementById('ai-run-button-label');
        elements.modelType = document.getElementById('ai-model-type');
        elements.trainRatio = document.getElementById('ai-train-ratio');
        elements.ratioBadge = document.getElementById('ai-train-ratio-badge');
        elements.modelTag = document.getElementById('ai-model-tag');
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
        elements.diagnosticCard = document.getElementById('ai-model-diagnostics');
        elements.confusionMatrix = document.getElementById('ai-confusion-matrix');
        elements.confusionNote = document.getElementById('ai-confusion-note');
        elements.thresholdSummary = document.getElementById('ai-threshold-summary');
        elements.kellySummary = document.getElementById('ai-kelly-summary');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                runPrediction();
            });
        }

        if (elements.modelType) {
            elements.modelType.addEventListener('change', () => {
                state.modelType = elements.modelType.value === 'anns' ? 'anns' : 'lstm';
                updateModelBadge(state.modelType);
                updateRunButtonLabel();
            });
            state.modelType = elements.modelType.value === 'anns' ? 'anns' : 'lstm';
        }

        if (elements.trainRatio) {
            elements.trainRatio.addEventListener('change', () => {
                const ratio = getTrainRatio();
                updateTrainRatioBadge(ratio);
            });
            applyTrainRatioSelection(getTrainRatio());
        } else {
            updateTrainRatioBadge(state.trainRatio || 0.8);
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

        refreshSeedOptions();
        parseWinThreshold();
        updateModelBadge(state.modelType);
        updateRunButtonLabel();
        updateDiagnostics(null);

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
