/* global tf, document, window */

// Patch Tag: LB-AI-LSTM-20250915A
// Patch Tag: LB-AI-MULTIMODEL-20251120A
// Patch Tag: LB-AI-ANNS-20251120A
// Patch Tag: LB-AI-MULTIMODEL-20251121B
// Patch Tag: LB-AI-ANNS-20251121B

(function registerLazybacktestAIPrediction() {
    const MULTI_VERSION_TAG = 'LB-AI-MULTIMODEL-20251121B';
    const LSTM_VERSION_TAG = 'LB-AI-LSTM-20250915A';
    const ANN_VERSION_TAG = 'LB-AI-ANNS-20251121B';
    const STORAGE_PREFIX = 'LB_AI_MODEL_SEED_';
    const MAX_RENDER_TRADES = 200;

    const MODEL_DEFINITIONS = {
        lstm: {
            id: 'lstm',
            label: 'LSTM 深度學習',
            versionTag: LSTM_VERSION_TAG,
            description: '依據 Fischer & Krauss (2018)、Sirignano & Cont (2019) 與 Chen et al. (2024) 的研究設計，採用 LSTM 分析隔日收盤方向，僅使用歷史收盤序列與報酬。',
        },
        anns: {
            id: 'anns',
            label: 'ANNS 技術指標',
            versionTag: ANN_VERSION_TAG,
            description: '以技術指標為特徵的前饋式人工神經網路（ANN），於 Worker 端計算 SMA、EMA、KD、RSI、MACD、CCI 等指標並分割 80/20 訓練測試，回傳混淆矩陣與凱利建議。',
        },
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };

    const state = {
        running: false,
        activeModel: 'lstm',
        seeds: {},
        modelResults: {
            lstm: null,
            anns: null,
        },
        trainingOdds: {
            lstm: null,
            anns: null,
        },
        annWorker: null,
        annWorkerReady: false,
    };

    const elements = {
        datasetSummary: null,
        status: null,
        runButton: null,
        lookback: null,
        epochs: null,
        batchSize: null,
        learningRate: null,
        enableKelly: null,
        fixedFraction: null,
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
        modelVersion: null,
        modelToggles: [],
        settingsTitle: null,
        settingsDescription: null,
        trainRatio: null,
        threshold: null,
        thresholdBadge: null,
        trainRatioBadge: null,
        seedInput: null,
        seedSave: null,
        seedRandom: null,
        resultModelLabel: null,
        kellyStats: null,
        trainingOddsLabel: null,
        confusion: {
            tp: null,
            tn: null,
            fp: null,
            fn: null,
        },
    };

    const ensureBridge = () => {
        if (typeof window === 'undefined') return null;
        if (!window.lazybacktestAIBridge || typeof window.lazybacktestAIBridge !== 'object') {
            window.lazybacktestAIBridge = {};
        }
        return window.lazybacktestAIBridge;
    };

    const formatPercent = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    };

    const formatCurrency = (value) => {
        if (!Number.isFinite(value)) return '—';
        return `${Math.round(value).toLocaleString('zh-TW')}元`;
    };

    const formatNumber = (value, digits = 2) => {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    };

    const showStatus = (message, type = 'info') => {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.style.color = colorMap[type] || colorMap.info;
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

    const resolveInitialCapital = () => {
        const input = document.getElementById('initialCapital');
        return parseNumberInput(input, 100000, { min: 1000 });
    };

    const getLookback = () => Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
    const getEpochs = () => Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 300 }));
    const getBatchSize = () => Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
    const getLearningRate = () => parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });

    const getTrainRatio = () => {
        if (!elements.trainRatio) return 0.8;
        const value = Number(elements.trainRatio.value);
        if (!Number.isFinite(value)) return 0.8;
        return Math.min(Math.max(value, 0.6), 0.9);
    };

    const getThreshold = () => {
        if (!elements.threshold) return 0.5;
        return Math.min(Math.max(Number(elements.threshold.value) || 0.5, 0.1), 0.9);
    };

    const getFixedFraction = () => parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });

    const isKellyEnabled = () => Boolean(elements.enableKelly?.checked);

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

    const getDatasetRows = () => {
        if (typeof window !== 'undefined' && Array.isArray(window.cachedStockData) && window.cachedStockData.length > 0) {
            return window.cachedStockData;
        }
        return getVisibleData();
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

    const computeNormalisation = (sequences, trainSize) => {
        if (!Array.isArray(sequences) || sequences.length === 0 || trainSize <= 0) {
            return { mean: 0, std: 1 };
        }
        const trainSlice = sequences.slice(0, trainSize);
        const values = trainSlice.flat();
        if (values.length === 0) {
            return { mean: 0, std: 1 };
        }
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
        const std = Math.sqrt(variance) || 1;
        return { mean, std };
    };

    const normaliseSequences = (sequences, normaliser) => {
        const { mean, std } = normaliser;
        if (!Array.isArray(sequences) || sequences.length === 0) return [];
        return sequences.map((seq) => seq.map((value) => (value - mean) / (std || 1)));
    };

    const computeTrainingOdds = (returns, trainSize) => {
        if (!Array.isArray(returns) || returns.length === 0 || trainSize <= 0) {
            return 1;
        }
        const trainReturns = returns.slice(0, trainSize);
        const wins = trainReturns.filter((value) => value > 0);
        const losses = trainReturns.filter((value) => value < 0).map((value) => Math.abs(value));
        const avgWin = wins.length > 0 ? wins.reduce((sum, value) => sum + value, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0;
        if (!Number.isFinite(avgWin) || avgWin <= 0 || !Number.isFinite(avgLoss) || avgLoss <= 0) {
            return 1;
        }
        return Math.max(avgWin / avgLoss, 0.25);
    };

    const computeKellyFraction = (probability, odds) => {
        const sanitizedProb = Math.min(Math.max(probability, 0.001), 0.999);
        const b = Math.max(odds, 1e-6);
        const fraction = sanitizedProb - ((1 - sanitizedProb) / b);
        return Math.max(0, Math.min(fraction, 1));
    };

    const computeConfusionMatrix = (labels, probabilities, threshold) => {
        const confusion = { TP: 0, TN: 0, FP: 0, FN: 0 };
        if (!Array.isArray(labels) || !Array.isArray(probabilities) || labels.length !== probabilities.length) {
            return confusion;
        }
        for (let i = 0; i < labels.length; i += 1) {
            const actual = labels[i];
            const predicted = probabilities[i] >= threshold ? 1 : 0;
            if (actual === 1 && predicted === 1) confusion.TP += 1;
            else if (actual === 0 && predicted === 0) confusion.TN += 1;
            else if (actual === 0 && predicted === 1) confusion.FP += 1;
            else if (actual === 1 && predicted === 0) confusion.FN += 1;
        }
        return confusion;
    };

    const estimateKellyFromTrades = (trades) => {
        if (!Array.isArray(trades) || trades.length === 0) {
            return { p: 0, b: 0, k: 0 };
        }
        const ups = [];
        const dns = [];
        trades.forEach((trade) => {
            if (!trade || !Number.isFinite(trade.actualReturn)) return;
            if (trade.actualReturn > 0) ups.push(trade.actualReturn);
            else dns.push(Math.abs(trade.actualReturn));
        });
        const total = ups.length + dns.length;
        const p = total > 0 ? ups.length / total : 0;
        const avgUp = ups.length ? ups.reduce((a, b) => a + b, 0) / ups.length : 0;
        const avgDn = dns.length ? dns.reduce((a, b) => a + b, 0) / dns.length : 0;
        const b = avgDn > 0 ? (avgUp / avgDn) : 1;
        const q = 1 - p;
        const k = Math.max(0, (b * p - q) / (b || 1));
        return { p, b, k };
    };

    const resetMetricsDisplay = () => {
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = '—';
        if (elements.trainLoss) elements.trainLoss.textContent = 'Loss：—';
        if (elements.testAccuracy) elements.testAccuracy.textContent = '—';
        if (elements.testLoss) elements.testLoss.textContent = 'Loss：—';
        if (elements.tradeCount) elements.tradeCount.textContent = '—';
        if (elements.hitRate) elements.hitRate.textContent = '命中率：—';
        if (elements.totalReturn) elements.totalReturn.textContent = '—';
        if (elements.averageProfit) elements.averageProfit.textContent = '平均每筆：—';
        if (elements.kellyStats) elements.kellyStats.textContent = '尚未計算。';
        if (elements.trainingOddsLabel) elements.trainingOddsLabel.textContent = '訓練期平均盈虧比：—';
        if (elements.confusion.tp) elements.confusion.tp.textContent = '—';
        if (elements.confusion.tn) elements.confusion.tn.textContent = '—';
        if (elements.confusion.fp) elements.confusion.fp.textContent = '—';
        if (elements.confusion.fn) elements.confusion.fn.textContent = '—';
        if (elements.tradeTableBody) elements.tradeTableBody.innerHTML = '';
        if (elements.tradeSummary) elements.tradeSummary.textContent = '尚未生成交易結果。';
    };

    const renderTrades = (records) => {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = '';
            return;
        }
        const limited = rows.slice(0, MAX_RENDER_TRADES);
        const html = limited
            .map((trade) => {
                const probabilityText = formatPercent(trade.probability, 1);
                const returnText = formatPercent(trade.actualReturn, 2);
                const fractionText = formatPercent(trade.fraction, 2);
                const profitText = formatCurrency(trade.profit);
                const capitalText = formatCurrency(trade.capitalAfter);
                return `
                    <tr>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.buyDate}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.sellDate}</td>
                        <td class="px-3 py-2 text-right">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${returnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${trade.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${profitText}</td>
                        <td class="px-3 py-2 text-right font-medium">${capitalText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    };

    const updateMetricTexts = (summary) => {
        if (!summary) {
            resetMetricsDisplay();
            return;
        }
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = summary.executedTrades ?? '—';
        if (elements.hitRate) elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}`;
        if (elements.totalReturn) elements.totalReturn.textContent = `${formatPercent(summary.totalReturn, 2)}（${formatCurrency(summary.finalCapital)}）`;
        if (elements.averageProfit) elements.averageProfit.textContent = `平均每筆：${formatCurrency(summary.averageProfit)}`;
        if (elements.trainingOddsLabel) {
            const odds = state.trainingOdds[state.activeModel];
            elements.trainingOddsLabel.textContent = Number.isFinite(odds)
                ? `訓練期平均盈虧比：${formatNumber(odds, 2)}`
                : '訓練期平均盈虧比：—';
        }
    };

    const updateKellyInfo = (summary) => {
        if (!elements.kellyStats) return;
        if (!summary || !Number.isFinite(summary.kelly)) {
            elements.kellyStats.textContent = '尚未計算。';
            return;
        }
        const details = summary.kellyDetails || {};
        elements.kellyStats.textContent = summary.kelly > 0
            ? `建議最大投入比例約 ${formatPercent(summary.kelly, 1)}，測試集中勝率 ${formatPercent(details.p || 0, 1)}、盈虧比 ${formatNumber(details.b || 0, 2)}。`
            : '測試集中優勢不足，建議降低部位或觀望。';
    };

    const updateConfusionDisplay = (confusion) => {
        const target = confusion || { TP: null, TN: null, FP: null, FN: null };
        if (elements.confusion.tp) elements.confusion.tp.textContent = Number.isFinite(target.TP) ? target.TP : '—';
        if (elements.confusion.tn) elements.confusion.tn.textContent = Number.isFinite(target.TN) ? target.TN : '—';
        if (elements.confusion.fp) elements.confusion.fp.textContent = Number.isFinite(target.FP) ? target.FP : '—';
        if (elements.confusion.fn) elements.confusion.fn.textContent = Number.isFinite(target.FN) ? target.FN : '—';
    };

    const updateTradeSummary = (summary) => {
        if (!elements.tradeSummary) return;
        if (!summary) {
            elements.tradeSummary.textContent = '尚未生成交易結果。';
            return;
        }
        const strategyLabel = summary.usingKelly ? '已啟用凱利公式' : '採用固定比例';
        const thresholdText = `預測門檻 ${formatPercent(summary.threshold, 0)}`;
        const ratioText = `訓練/測試 = ${Math.round(summary.trainRatio * 100)} / ${Math.round((1 - summary.trainRatio) * 100)}`;
        elements.tradeSummary.textContent = `共評估 ${summary.totalPredictions} 筆測試樣本，執行 ${summary.executedTrades} 筆多單交易，${strategyLabel}，${thresholdText}，${ratioText}。最終資金 ${formatCurrency(summary.finalCapital)}，總報酬 ${formatPercent(summary.totalReturn, 2)}。`;
    };

    const updateModelVersionLabel = () => {
        if (!elements.modelVersion) return;
        const definition = MODEL_DEFINITIONS[state.activeModel];
        elements.modelVersion.textContent = definition ? definition.label : 'AI 模型';
    };

    const updateResultModelLabel = () => {
        if (!elements.resultModelLabel) return;
        const definition = MODEL_DEFINITIONS[state.activeModel];
        elements.resultModelLabel.textContent = definition ? definition.label : 'AI 模型';
    };

    const renderModelResult = (modelId) => {
        const result = state.modelResults[modelId] || null;
        if (elements.resultModelLabel) {
            const definition = MODEL_DEFINITIONS[modelId];
            elements.resultModelLabel.textContent = definition ? definition.label : 'AI 模型';
        }
        if (!result) {
            resetMetricsDisplay();
            return;
        }
        updateMetricTexts(result.summary);
        updateKellyInfo(result.summary);
        updateConfusionDisplay(result.confusion);
        renderTrades(result.trades);
        updateTradeSummary(result.summary);
    };

    const updateDatasetSummary = (rows) => {
        if (!elements.datasetSummary) return;
        const data = Array.isArray(rows) ? rows : getDatasetRows();
        if (!Array.isArray(data) || data.length === 0) {
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

    const updateRatioBadge = () => {
        if (!elements.trainRatioBadge) return;
        const ratio = getTrainRatio();
        const trainPct = Math.round(ratio * 100);
        const testPct = 100 - trainPct;
        elements.trainRatioBadge.textContent = `訓練：測試 = ${trainPct} : ${testPct}`;
    };

    const updateThresholdBadge = () => {
        if (!elements.thresholdBadge) return;
        elements.thresholdBadge.textContent = `預測門檻 ${formatPercent(getThreshold(), 0)}`;
    };

    const applyModelSeed = (modelId) => {
        const seed = state.seeds[modelId];
        if (!Number.isFinite(seed)) return;
        if (typeof tf !== 'undefined' && tf?.util?.setSeed) {
            try {
                tf.util.setSeed(seed);
            } catch (error) {
                console.warn('[AI Prediction] 設定隨機種子失敗:', error);
            }
        }
    };

    const ensureAnnWorker = () => {
        if (state.annWorker) return state.annWorker;
        const workerPath = (typeof window !== 'undefined' && typeof window.workerUrl === 'string')
            ? window.workerUrl
            : 'js/worker.js';
        try {
            const worker = new Worker(workerPath);
            worker.addEventListener('message', (event) => {
                const message = event.data || {};
                if (message.type === 'AI_ANN_PROGRESS') {
                    const progress = message.payload?.progress ?? 0;
                    showStatus(`訓練中… ${Math.round(progress * 100)}%`, 'info');
                } else if (message.type === 'AI_ANN_DONE') {
                    toggleRunning(false);
                    showStatus('ANN 訓練完成', 'success');
                    const payload = message.payload || {};
                    state.modelResults.anns = {
                        summary: payload.summary || null,
                        trades: payload.trades || [],
                        confusion: payload.confusion || null,
                    };
                    state.trainingOdds.anns = payload.summary?.trainingOdds ?? null;
                    if (state.activeModel === 'anns') {
                        renderModelResult('anns');
                    }
                } else if (message.type === 'AI_ANN_ERROR') {
                    toggleRunning(false);
                    showStatus(`ANN 執行失敗：${message.payload?.message || '未知錯誤'}`, 'error');
                }
            });
            state.annWorker = worker;
            return worker;
        } catch (error) {
            console.error('[AI Prediction] 建立 ANN Worker 失敗:', error);
            showStatus('無法建立 ANN 訓練引擎，請檢查瀏覽器支援度。', 'error');
            return null;
        }
    };

    const storeSeed = (modelId, value) => {
        if (!Number.isFinite(value)) return;
        state.seeds[modelId] = value;
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(`${STORAGE_PREFIX}${modelId}`, String(Math.round(value)));
            } catch (error) {
                console.warn('[AI Prediction] 無法儲存種子至 localStorage:', error);
            }
        }
    };

    const loadStoredSeeds = () => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        Object.keys(MODEL_DEFINITIONS).forEach((modelId) => {
            try {
                const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${modelId}`);
                if (stored !== null) {
                    const parsed = Number(stored);
                    if (Number.isFinite(parsed)) {
                        state.seeds[modelId] = parsed;
                    }
                }
            } catch (error) {
                console.warn('[AI Prediction] 載入種子失敗:', error);
            }
            if (!Number.isFinite(state.seeds[modelId])) {
                state.seeds[modelId] = 42;
            }
        });
    };

    const updateSeedInput = () => {
        if (!elements.seedInput) return;
        const seed = state.seeds[state.activeModel];
        elements.seedInput.value = Number.isFinite(seed) ? String(Math.round(seed)) : '42';
    };

    const generateRandomSeed = () => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const buffer = new Uint32Array(1);
            crypto.getRandomValues(buffer);
            return buffer[0];
        }
        return Math.floor(Math.random() * 1e9);
    };

    const setActiveModel = (modelId) => {
        if (!MODEL_DEFINITIONS[modelId]) return;
        state.activeModel = modelId;
        elements.modelToggles.forEach((btn) => {
            const target = btn.dataset.aiModel;
            const isActive = target === modelId;
            btn.style.backgroundColor = isActive ? 'var(--primary)' : 'transparent';
            btn.style.color = isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)';
        });
        const definition = MODEL_DEFINITIONS[modelId];
        if (elements.settingsTitle) elements.settingsTitle.textContent = 'AI 模型預測設定';
        if (elements.settingsDescription) elements.settingsDescription.textContent = definition?.description || '';
        if (elements.modelVersion) elements.modelVersion.textContent = definition?.label || 'AI 模型';
        updateResultModelLabel();
        updateSeedInput();
        updateRatioBadge();
        updateThresholdBadge();
        renderModelResult(modelId);
    };

    const runLstmModel = async () => {
        if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
            showStatus('未載入 TensorFlow.js，請確認網路連線。', 'error');
            return;
        }

        toggleRunning(true);
        showStatus('準備資料…', 'info');

        try {
            const rows = getDatasetRows();
            if (!Array.isArray(rows) || rows.length === 0) {
                showStatus('尚未取得回測資料，請先在主頁面執行回測。', 'warning');
                toggleRunning(false);
                return;
            }

            const lookback = getLookback();
            const epochs = getEpochs();
            const batchSize = getBatchSize();
            const learningRate = getLearningRate();
            const fixedFraction = getFixedFraction();
            const useKelly = isKellyEnabled();
            const trainRatio = getTrainRatio();
            const threshold = getThreshold();

            const dataset = buildDataset(rows, lookback);
            if (dataset.sequences.length < Math.max(45, lookback * 3)) {
                showStatus(`資料樣本不足（需至少 ${Math.max(45, lookback * 3)} 筆有效樣本，目前 ${dataset.sequences.length} 筆），請延長回測期間。`, 'warning');
                toggleRunning(false);
                return;
            }

            const totalSamples = dataset.sequences.length;
            const tentativeTrainSize = Math.max(Math.floor(totalSamples * trainRatio), lookback);
            const boundedTrainSize = Math.min(tentativeTrainSize, totalSamples - 1);
            const testSize = totalSamples - boundedTrainSize;
            if (boundedTrainSize <= 0 || testSize <= 0) {
                showStatus('無法依照設定切分訓練與測試集，請延長資料範圍。', 'warning');
                toggleRunning(false);
                return;
            }

            const normaliser = computeNormalisation(dataset.sequences, boundedTrainSize);
            const normalizedSequences = normaliseSequences(dataset.sequences, normaliser);
            const tensorInput = normalizedSequences.map((seq) => seq.map((value) => [value]));
            const xAll = tf.tensor(tensorInput);
            const yAll = tf.tensor(dataset.labels.map((label) => [label]));

            const xTrain = xAll.slice([0, 0, 0], [boundedTrainSize, lookback, 1]);
            const yTrain = yAll.slice([0, 0], [boundedTrainSize, 1]);
            const xTest = xAll.slice([boundedTrainSize, 0, 0], [testSize, lookback, 1]);
            const yTest = yAll.slice([boundedTrainSize, 0], [testSize, 1]);

            if (batchSize > boundedTrainSize) {
                showStatus(`批次大小 ${batchSize} 大於訓練樣本數 ${boundedTrainSize}，已自動調整為 ${boundedTrainSize}。`, 'warning');
            }

            const model = tf.sequential();
            model.add(tf.layers.lstm({ units: 32, returnSequences: true, inputShape: [lookback, 1] }));
            model.add(tf.layers.dropout({ rate: 0.2 }));
            model.add(tf.layers.lstm({ units: 16 }));
            model.add(tf.layers.dropout({ rate: 0.1 }));
            model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
            model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
            const optimizer = tf.train.adam(learningRate);
            model.compile({ optimizer, loss: 'binaryCrossentropy', metrics: ['accuracy'] });

            applyModelSeed('lstm');

            showStatus(`訓練中（共 ${epochs} 輪）...`, 'info');
            const history = await model.fit(xTrain, yTrain, {
                epochs,
                batchSize: Math.min(batchSize, boundedTrainSize),
                validationSplit: Math.min(0.2, Math.max(0.1, boundedTrainSize > 50 ? 0.2 : 0.1)),
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        const lossText = Number.isFinite(logs.loss) ? logs.loss.toFixed(4) : '—';
                        const accValue = logs.acc ?? logs.accuracy;
                        const accText = Number.isFinite(accValue) ? formatPercent(accValue, 2) : '—';
                        showStatus(`訓練中（${epoch + 1}/${epochs}） Loss ${lossText} / Acc ${accText}`, 'info');
                    },
                },
            });

            const accuracyKey = history.history.acc ? 'acc' : (history.history.accuracy ? 'accuracy' : null);
            const finalTrainAccuracy = accuracyKey ? history.history[accuracyKey][history.history[accuracyKey].length - 1] : NaN;
            const finalTrainLoss = history.history.loss?.[history.history.loss.length - 1] ?? NaN;

            const evalOutput = model.evaluate(xTest, yTest);
            const evalArray = Array.isArray(evalOutput) ? evalOutput : [evalOutput];
            const evalValues = await Promise.all(
                evalArray.map(async (tensor) => {
                    const data = await tensor.data();
                    tensor.dispose();
                    return data[0];
                })
            );
            const testLoss = evalValues[0] ?? NaN;

            const predictionsTensor = model.predict(xTest);
            const predictionValues = Array.from(await predictionsTensor.data());
            predictionsTensor.dispose();

            const labels = dataset.labels.slice(boundedTrainSize);
            let correctPredictions = 0;
            predictionValues.forEach((value, index) => {
                const predictedLabel = value >= threshold ? 1 : 0;
                if (predictedLabel === labels[index]) {
                    correctPredictions += 1;
                }
            });
            const manualAccuracy = predictionValues.length > 0 ? (correctPredictions / predictionValues.length) : NaN;

            const trainingOdds = computeTrainingOdds(dataset.returns, boundedTrainSize);
            state.trainingOdds.lstm = trainingOdds;

            const initialCapital = resolveInitialCapital();
            let capital = initialCapital;
            let cumulativeProfit = 0;
            let wins = 0;
            let executed = 0;
            const executedTrades = [];
            const testMeta = dataset.meta.slice(boundedTrainSize);
            const testReturns = dataset.returns.slice(boundedTrainSize);

            for (let i = 0; i < predictionValues.length; i += 1) {
                const probability = predictionValues[i];
                const predictedUp = probability >= threshold;
                const actualReturn = testReturns[i];
                const meta = testMeta[i];
                if (!predictedUp || !meta) {
                    continue;
                }
                const fraction = useKelly
                    ? computeKellyFraction(probability, trainingOdds)
                    : Math.max(0.01, Math.min(fixedFraction, 1));
                const allocation = capital * fraction;
                const profit = allocation * actualReturn;
                capital += profit;
                cumulativeProfit += profit;
                executed += 1;
                if (actualReturn > 0) {
                    wins += 1;
                }
                executedTrades.push({
                    buyDate: meta.buyDate,
                    sellDate: meta.sellDate,
                    probability,
                    actualReturn,
                    fraction,
                    profit,
                    capitalAfter: capital,
                });
            }

            const totalPredictions = predictionValues.length;
            const hitRate = executed > 0 ? wins / executed : 0;
            const totalReturn = (capital - initialCapital) / initialCapital;
            const averageProfit = executed > 0 ? cumulativeProfit / executed : 0;

            const kellyInfo = estimateKellyFromTrades(executedTrades);
            const confusion = computeConfusionMatrix(labels, predictionValues, threshold);

            const summary = {
                version: LSTM_VERSION_TAG,
                trainAccuracy: finalTrainAccuracy,
                trainLoss: finalTrainLoss,
                testAccuracy: Number.isFinite(manualAccuracy) ? manualAccuracy : evalValues[1] ?? NaN,
                testLoss,
                totalPredictions,
                executedTrades: executed,
                hitRate,
                totalReturn,
                averageProfit,
                finalCapital: capital,
                usingKelly: useKelly,
                threshold,
                trainRatio,
                kelly: kellyInfo.k,
                kellyDetails: kellyInfo,
                trainingOdds,
            };

            state.modelResults.lstm = {
                summary,
                trades: executedTrades,
                confusion,
            };

            if (state.activeModel === 'lstm') {
                updateMetricTexts(summary);
                updateKellyInfo(summary);
                updateConfusionDisplay(confusion);
                renderTrades(executedTrades);
                updateTradeSummary(summary);
            }

            showStatus(`完成：訓練勝率 ${formatPercent(finalTrainAccuracy, 2)}，測試正確率 ${formatPercent(summary.testAccuracy, 2)}。`, 'success');

            tf.dispose([xAll, yAll, xTrain, yTrain, xTest, yTest]);
            model.dispose();
        } catch (error) {
            console.error('[AI Prediction] 執行 LSTM 失敗:', error);
            showStatus(`AI 預測執行失敗：${error.message}`, 'error');
        } finally {
            toggleRunning(false);
        }
    };

    const runAnnModel = () => {
        const worker = ensureAnnWorker();
        if (!worker) return;

        const rows = getDatasetRows();
        if (!Array.isArray(rows) || rows.length < 60) {
            showStatus('資料不足（至少 60 根 K 線），請先延長回測期間。', 'warning');
            return;
        }

        const payload = {
            rows,
            options: {
                trainRatio: getTrainRatio(),
                epochs: getEpochs(),
                batchSize: getBatchSize(),
                learningRate: getLearningRate(),
                useKelly: isKellyEnabled(),
                fixedFraction: getFixedFraction(),
                threshold: getThreshold(),
                seed: state.seeds.anns,
                initialCapital: resolveInitialCapital(),
            },
        };

        try {
            toggleRunning(true);
            showStatus('已送出至 Worker，開始訓練 ANN…', 'info');
            worker.postMessage({ type: 'AI_ANN_RUN', payload });
        } catch (error) {
            console.error('[AI Prediction] 送交 ANN Worker 失敗:', error);
            toggleRunning(false);
            showStatus(`送交 ANN Worker 失敗：${error.message}`, 'error');
        }
    };

    const runActiveModel = () => {
        if (state.running) return;
        if (state.activeModel === 'anns') {
            runAnnModel();
        } else {
            runLstmModel();
        }
    };

    const bindEvents = () => {
        if (elements.runButton) {
            elements.runButton.addEventListener('click', runActiveModel);
        }

        if (elements.trainRatio) {
            elements.trainRatio.addEventListener('change', () => {
                updateRatioBadge();
                const rows = getDatasetRows();
                updateDatasetSummary(rows);
            });
        }

        if (elements.threshold) {
            elements.threshold.addEventListener('input', () => {
                updateThresholdBadge();
            });
        }

        if (elements.seedSave) {
            elements.seedSave.addEventListener('click', () => {
                const seedValue = Number(elements.seedInput?.value);
                if (!Number.isFinite(seedValue)) {
                    showStatus('請輸入有效的整數種子。', 'warning');
                    return;
                }
                storeSeed(state.activeModel, Math.round(seedValue));
                showStatus(`已儲存 ${MODEL_DEFINITIONS[state.activeModel].label} 的隨機種子。`, 'success');
            });
        }

        if (elements.seedRandom) {
            elements.seedRandom.addEventListener('click', () => {
                const randomSeed = generateRandomSeed();
                if (elements.seedInput) elements.seedInput.value = String(randomSeed);
            });
        }

        elements.modelToggles.forEach((btn) => {
            btn.addEventListener('click', () => {
                const modelId = btn.dataset.aiModel;
                setActiveModel(modelId);
            });
        });
    };

    const initElements = () => {
        elements.datasetSummary = document.getElementById('ai-dataset-summary');
        elements.status = document.getElementById('ai-status');
        elements.runButton = document.getElementById('ai-run-button');
        elements.lookback = document.getElementById('ai-lookback');
        elements.epochs = document.getElementById('ai-epochs');
        elements.batchSize = document.getElementById('ai-batch-size');
        elements.learningRate = document.getElementById('ai-learning-rate');
        elements.enableKelly = document.getElementById('ai-enable-kelly');
        elements.fixedFraction = document.getElementById('ai-fixed-fraction');
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
        elements.modelVersion = document.getElementById('ai-model-version');
        elements.settingsTitle = document.getElementById('ai-settings-title');
        elements.settingsDescription = document.getElementById('ai-settings-description');
        elements.trainRatio = document.getElementById('ai-train-ratio');
        elements.threshold = document.getElementById('ai-threshold');
        elements.thresholdBadge = document.getElementById('ai-threshold-badge');
        elements.trainRatioBadge = document.getElementById('ai-train-ratio-badge');
        elements.seedInput = document.getElementById('ai-random-seed');
        elements.seedSave = document.getElementById('ai-save-seed');
        elements.seedRandom = document.getElementById('ai-randomize-seed');
        elements.resultModelLabel = document.getElementById('ai-result-model-label');
        elements.kellyStats = document.getElementById('ai-kelly-stats');
        elements.trainingOddsLabel = document.getElementById('ai-training-odds');
        elements.confusion.tp = document.getElementById('ai-confusion-tp');
        elements.confusion.tn = document.getElementById('ai-confusion-tn');
        elements.confusion.fp = document.getElementById('ai-confusion-fp');
        elements.confusion.fn = document.getElementById('ai-confusion-fn');

        const switcher = document.getElementById('ai-model-switcher');
        if (switcher) {
            elements.modelToggles = Array.from(switcher.querySelectorAll('[data-ai-model]'));
        }
    };

    const registerBridge = () => {
        const bridge = ensureBridge();
        if (!bridge) return;
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
        bridge.versionTag = MULTI_VERSION_TAG;
    };

    const init = () => {
        initElements();
        loadStoredSeeds();
        setActiveModel('lstm');
        updateRatioBadge();
        updateThresholdBadge();
        updateSeedInput();
        updateDatasetSummary(getDatasetRows());
        bindEvents();
        registerBridge();

        window.addEventListener('lazybacktest:visible-data-changed', () => {
            updateDatasetSummary(getDatasetRows());
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
