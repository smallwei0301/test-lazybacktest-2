/* global document, window */

// Patch Tag: LB-AI-DUAL-20250922A
(function registerLazybacktestAIPrediction() {
    const VERSION_TAG = 'LB-AI-DUAL-20250922A';
    const MODEL_TYPES = {
        LSTM: 'lstm',
        ANNS: 'anns',
    };
    const MODEL_LABELS = {
        [MODEL_TYPES.LSTM]: 'LSTM 深度學習',
        [MODEL_TYPES.ANNS]: 'ANNS 技術指標',
    };
    const STORAGE_KEY = 'lazybacktest.ai.seeds.v1';

    const state = {
        running: false,
        worker: null,
        lastSummary: null,
        lastModel: MODEL_TYPES.LSTM,
        seeds: loadStoredSeeds(),
        datasetMeta: null,
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
        modelSelect: null,
        ratioSelect: null,
        ratioLabel: null,
        threshold: null,
        seedInput: null,
        seedSaveButton: null,
        modelBadge: null,
        confusionMatrix: null,
        kellySummary: null,
    };

    const colorMap = {
        info: 'var(--muted-foreground)',
        success: 'var(--primary)',
        warning: 'var(--secondary)',
        error: 'var(--destructive)',
    };

    function loadStoredSeeds() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return {};
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            console.warn('[AI Prediction] 無法載入種子設定:', error);
            return {};
        }
    }

    function persistSeeds() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.seeds || {}));
        } catch (error) {
            console.warn('[AI Prediction] 儲存種子設定失敗:', error);
        }
    }

    function getSeedForModel(modelKey) {
        const key = modelKey || state.lastModel;
        if (!state.seeds || typeof state.seeds !== 'object') return '';
        const value = state.seeds[key];
        return Number.isFinite(value) ? value : '';
    }

    function setSeedForModel(modelKey, value) {
        if (!state.seeds || typeof state.seeds !== 'object') {
            state.seeds = {};
        }
        if (value === '' || value === null || Number.isNaN(value)) {
            delete state.seeds[modelKey];
        } else {
            state.seeds[modelKey] = value;
        }
        persistSeeds();
    }

    function ensureBridge() {
        if (typeof window === 'undefined') return null;
        if (!window.lazybacktestAIBridge || typeof window.lazybacktestAIBridge !== 'object') {
            window.lazybacktestAIBridge = {};
        }
        return window.lazybacktestAIBridge;
    }

    function ensureWorker() {
        if (state.worker) return state.worker;
        try {
            const url = typeof window.workerUrl === 'string' && window.workerUrl ? window.workerUrl : 'js/worker.js';
            const worker = new Worker(url);
            worker.addEventListener('message', handleWorkerMessage);
            state.worker = worker;
            if (typeof window !== 'undefined') {
                window.lazybacktestAIWorker = worker;
            }
        } catch (error) {
            console.error('[AI Prediction] 建立 Worker 失敗:', error);
            showStatus('無法建立背景運算執行緒，請重新整理頁面。', 'error');
        }
        return state.worker;
    }

    function formatPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(digits)}%`;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '—';
        return `${Math.round(value).toLocaleString('zh-TW')}元`;
    }

    function formatNumber(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    }

    function parseNumberInput(el, fallback, options = {}) {
        if (!el) return fallback;
        const raw = typeof el.value === 'string' ? el.value.replace(/,/g, '') : el.value;
        const value = Number(raw);
        if (!Number.isFinite(value)) return fallback;
        const { min, max } = options || {};
        if (Number.isFinite(min) && value < min) return min;
        if (Number.isFinite(max) && value > max) return max;
        return value;
    }

    function resolveInitialCapital() {
        const input = document.getElementById('initialCapital');
        return parseNumberInput(input, 100000, { min: 1000 });
    }

    function getVisibleData() {
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
    }

    function showStatus(message, type = 'info') {
        if (!elements.status) return;
        elements.status.textContent = message;
        elements.status.style.color = colorMap[type] || colorMap.info;
    }

    function toggleRunning(flag) {
        state.running = Boolean(flag);
        if (!elements.runButton) return;
        elements.runButton.disabled = state.running;
        elements.runButton.classList.toggle('opacity-60', state.running);
        elements.runButton.classList.toggle('cursor-not-allowed', state.running);
    }

    function updateDatasetSummary(rows) {
        if (!elements.datasetSummary) return;
        const data = Array.isArray(rows) ? rows : [];
        if (data.length === 0) {
            elements.datasetSummary.textContent = '尚未取得資料，請先完成一次主回測。';
            return;
        }
        const sorted = data
            .filter((row) => row && typeof row.date === 'string')
            .sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length === 0) {
            elements.datasetSummary.textContent = '資料缺少有效日期，請重新回測。';
            return;
        }
        const firstDate = sorted[0].date;
        const lastDate = sorted[sorted.length - 1].date;
        elements.datasetSummary.textContent = `可用資料 ${sorted.length} 筆，區間 ${firstDate} ~ ${lastDate}。`;
    }

    function updateTrainRatioLabel(value) {
        if (!elements.ratioLabel) return;
        const ratio = Number(value);
        if (!Number.isFinite(ratio)) {
            elements.ratioLabel.textContent = '訓練 80%｜測試 20%';
            return;
        }
        const trainPercent = Math.round(ratio * 100);
        const testPercent = 100 - trainPercent;
        elements.ratioLabel.textContent = `訓練 ${trainPercent}%｜測試 ${testPercent}%`;
    }

    function updateModelBadge(modelKey) {
        if (!elements.modelBadge) return;
        const label = MODEL_LABELS[modelKey] || 'AI 模型';
        elements.modelBadge.textContent = label;
    }

    function renderTrades(records) {
        if (!elements.tradeTableBody) return;
        const rows = Array.isArray(records) ? records : [];
        if (rows.length === 0) {
            elements.tradeTableBody.innerHTML = '';
            return;
        }
        const limited = rows.slice(0, 200);
        const html = limited
            .map((trade) => {
                const probabilityText = formatPercent(trade.probability, 1);
                const returnText = formatPercent(trade.actualReturn, 2);
                const fractionText = formatPercent(trade.fraction, 2);
                const profitText = formatCurrency(trade.profit);
                const capitalText = formatCurrency(trade.capitalAfter);
                const returnClass = trade.actualReturn >= 0 ? 'text-emerald-600' : 'text-rose-600';
                const profitClass = trade.profit >= 0 ? 'text-emerald-600' : 'text-rose-600';
                return `
                    <tr>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.buyDate ?? '—'}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${trade.sellDate ?? '—'}</td>
                        <td class="px-3 py-2 text-right">${probabilityText}</td>
                        <td class="px-3 py-2 text-right ${returnClass}">${returnText}</td>
                        <td class="px-3 py-2 text-right">${fractionText}</td>
                        <td class="px-3 py-2 text-right ${profitClass}">${profitText}</td>
                        <td class="px-3 py-2 text-right font-medium">${capitalText}</td>
                    </tr>
                `;
            })
            .join('');
        elements.tradeTableBody.innerHTML = html;
    }

    function updateSummaryMetrics(summary, modelKey) {
        if (!summary) return;
        if (elements.trainAccuracy) elements.trainAccuracy.textContent = formatPercent(summary.trainAccuracy, 2);
        if (elements.trainLoss) elements.trainLoss.textContent = `Loss：${formatNumber(summary.trainLoss, 4)}`;
        if (elements.testAccuracy) elements.testAccuracy.textContent = formatPercent(summary.testAccuracy, 2);
        if (elements.testLoss) elements.testLoss.textContent = `Loss：${formatNumber(summary.testLoss, 4)}`;
        if (elements.tradeCount) elements.tradeCount.textContent = summary.executedTrades ?? '—';
        if (elements.hitRate) elements.hitRate.textContent = `命中率：${formatPercent(summary.hitRate, 2)}`;
        if (elements.totalReturn) elements.totalReturn.textContent = `${formatPercent(summary.totalReturn, 2)}（${formatCurrency(summary.finalCapital)}）`;
        if (elements.averageProfit) elements.averageProfit.textContent = `平均每筆：${formatCurrency(summary.averageProfit)}`;
        if (elements.tradeSummary) {
            const strategyLabel = summary.usingKelly ? '已啟用凱利公式' : '採用固定比例';
            const thresholdText = formatPercent(summary.threshold ?? 0.5, 0);
            const predictionsText = Number.isFinite(summary.totalPredictions) ? summary.totalPredictions : '—';
            const executedText = Number.isFinite(summary.executedTrades) ? summary.executedTrades : '—';
            elements.tradeSummary.textContent = `使用 ${MODEL_LABELS[modelKey] || 'AI 模型'}，共評估 ${predictionsText} 筆測試樣本，執行 ${executedText} 筆多單交易（門檻 ${thresholdText}，${strategyLabel}）。最終資金 ${formatCurrency(summary.finalCapital)}，總報酬 ${formatPercent(summary.totalReturn, 2)}。`;
        }
    }

    function updateConfusionMatrix(confusion, meta) {
        if (!elements.confusionMatrix) return;
        if (!confusion) {
            elements.confusionMatrix.textContent = '—';
            return;
        }
        const lines = [];
        lines.push(`TP（預測漲且漲）：${confusion.TP ?? 0}`);
        lines.push(`TN（預測跌且跌）：${confusion.TN ?? 0}`);
        lines.push(`FP（預測漲實際跌）：${confusion.FP ?? 0}`);
        lines.push(`FN（預測跌實際漲）：${confusion.FN ?? 0}`);
        if (meta && Number.isFinite(meta.testSize)) {
            lines.push(`測試樣本：${meta.testSize} 筆`);
        }
        elements.confusionMatrix.innerHTML = lines.map((text) => `<div>${text}</div>`).join('');
    }

    function updateKellySummary(kelly, summary, meta) {
        if (!elements.kellySummary) return;
        if (!kelly || !Number.isFinite(kelly.fraction)) {
            elements.kellySummary.textContent = '尚未計算凱利比例。';
            return;
        }
        const oddsText = Number.isFinite(kelly.odds) ? kelly.odds.toFixed(2) : '—';
        const probabilityText = Number.isFinite(kelly.winProbability) ? formatPercent(kelly.winProbability, 1) : '—';
        const fractionText = formatPercent(kelly.fraction, 2);
        const thresholdText = summary ? formatPercent(summary.threshold ?? 0.5, 0) : '—';
        const trainInfo = meta && Number.isFinite(meta.trainSize)
            ? `訓練樣本 ${meta.trainSize} 筆`
            : '';
        elements.kellySummary.innerHTML = `
            <div>預測門檻：${thresholdText}</div>
            <div>凱利建議投入比例：約 ${fractionText}</div>
            <div>預估勝率：${probabilityText}｜平均盈虧比：${oddsText}</div>
            <div>${trainInfo}</div>
        `;
    }

    function resetResultViews() {
        renderTrades([]);
        updateSummaryMetrics({
            trainAccuracy: NaN,
            trainLoss: NaN,
            testAccuracy: NaN,
            testLoss: NaN,
            executedTrades: 0,
            hitRate: 0,
            totalReturn: 0,
            averageProfit: 0,
            finalCapital: NaN,
            totalPredictions: 0,
            usingKelly: false,
            threshold: 0.5,
        }, state.lastModel);
        updateConfusionMatrix(null, null);
        updateKellySummary(null, null, null);
        if (elements.tradeSummary) elements.tradeSummary.textContent = '尚未生成交易結果。';
    }

    function handleWorkerMessage(event) {
        const msg = event.data || {};
        if (msg.type === 'AI_PROGRESS') {
            const { progress, stage, modelType } = msg.payload || {};
            const label = MODEL_LABELS[modelType] || 'AI 模型';
            if (Number.isFinite(progress)) {
                const percent = Math.round(progress * 100);
                showStatus(`${label} 訓練中… ${percent}%${stage ? `（${stage}）` : ''}`, 'info');
            } else {
                showStatus(`${label} 訓練中…${stage ? `（${stage}）` : ''}`, 'info');
            }
        } else if (msg.type === 'AI_DONE') {
            toggleRunning(false);
            const { summary, trades, confusion, kelly, meta, modelType } = msg.payload || {};
            state.lastModel = modelType || state.lastModel;
            state.lastSummary = summary || null;
            state.datasetMeta = meta || null;
            updateModelBadge(state.lastModel);
            updateSummaryMetrics(summary, state.lastModel);
            renderTrades(trades);
            updateConfusionMatrix(confusion, meta);
            updateKellySummary(kelly, summary, meta);
            if (meta && Number.isFinite(meta.totalSamples) && elements.datasetSummary) {
                elements.datasetSummary.textContent = `有效樣本 ${meta.totalSamples} 筆（訓練 ${meta.trainSize ?? '—'}、測試 ${meta.testSize ?? '—'}）。`;
            }
            if (elements.tradeSummary && summary) {
                const stageText = summary.usingKelly ? '凱利公式' : '固定比例';
                elements.tradeSummary.textContent = `完成 ${MODEL_LABELS[state.lastModel] || 'AI 模型'} 預測，測試正確率 ${formatPercent(summary.testAccuracy, 2)}。採用 ${stageText}，最終資金 ${formatCurrency(summary.finalCapital)}，總報酬 ${formatPercent(summary.totalReturn, 2)}。`;
            }
            showStatus(`完成 ${MODEL_LABELS[state.lastModel] || 'AI 模型'} 預測。`, 'success');
        } else if (msg.type === 'AI_ERROR') {
            toggleRunning(false);
            const label = MODEL_LABELS[msg.payload?.modelType] || 'AI 模型';
            const message = msg.payload?.message || '未知錯誤';
            showStatus(`${label} 執行失敗：${message}`, 'error');
            console.error('[AI Prediction] Worker 執行失敗:', msg.payload);
        }
    }

    function runPrediction() {
        if (state.running) return;
        const rows = getVisibleData();
        if (!Array.isArray(rows) || rows.length < 60) {
            showStatus('需要先完成一次主回測，並確保至少 60 筆資料。', 'warning');
            return;
        }

        const modelType = elements.modelSelect ? elements.modelSelect.value : MODEL_TYPES.LSTM;
        const lookback = Math.round(parseNumberInput(elements.lookback, 20, { min: 5, max: 60 }));
        const epochs = Math.round(parseNumberInput(elements.epochs, 80, { min: 10, max: 400 }));
        const batchSize = Math.round(parseNumberInput(elements.batchSize, 64, { min: 8, max: 512 }));
        const learningRate = parseNumberInput(elements.learningRate, 0.005, { min: 0.0001, max: 0.05 });
        const fixedFraction = parseNumberInput(elements.fixedFraction, 0.2, { min: 0.01, max: 1 });
        const useKelly = Boolean(elements.enableKelly?.checked);
        const trainRatio = parseNumberInput(elements.ratioSelect, 0.8, { min: 0.6, max: 0.9 });
        const threshold = parseNumberInput(elements.threshold, 0.5, { min: 0.1, max: 0.9 });
        const initialCapital = resolveInitialCapital();
        const seedValueRaw = elements.seedInput ? elements.seedInput.value : '';
        const seed = seedValueRaw === '' ? null : Number(seedValueRaw);

        if (seedValueRaw !== '' && !Number.isFinite(seed)) {
            showStatus('種子需為整數，請重新輸入。', 'warning');
            return;
        }

        const workerInstance = ensureWorker();
        if (!workerInstance) {
            showStatus('背景運算執行緒未就緒，請重新整理頁面。', 'error');
            return;
        }

        toggleRunning(true);
        showStatus(`${MODEL_LABELS[modelType] || 'AI 模型'} 訓練準備中…`, 'info');
        updateModelBadge(modelType);
        state.lastModel = modelType;

        const payload = {
            rows,
            options: {
                modelType,
                lookback,
                epochs,
                batchSize,
                learningRate,
                trainRatio,
                useKelly,
                fixedFraction,
                threshold,
                seed: seedValueRaw === '' ? null : seed,
                initialCapital,
            },
        };

        try {
            workerInstance.postMessage({ type: 'AI_PREDICT', payload });
        } catch (error) {
            toggleRunning(false);
            showStatus(`傳送資料至 Worker 失敗：${error.message}`, 'error');
            return;
        }

        state.datasetMeta = null;
        state.lastSummary = null;
    }

    function handleSeedSave() {
        if (!elements.modelSelect || !elements.seedInput) return;
        const modelKey = elements.modelSelect.value;
        const raw = elements.seedInput.value;
        if (raw === '') {
            setSeedForModel(modelKey, null);
            showStatus(`${MODEL_LABELS[modelKey] || 'AI 模型'} 的種子已清除。`, 'info');
            return;
        }
        const seed = Number(raw);
        if (!Number.isFinite(seed)) {
            showStatus('種子需為整數，請重新輸入。', 'warning');
            return;
        }
        setSeedForModel(modelKey, seed);
        showStatus(`${MODEL_LABELS[modelKey] || 'AI 模型'} 的種子已儲存。`, 'success');
    }

    function handleModelChange() {
        const modelKey = elements.modelSelect ? elements.modelSelect.value : MODEL_TYPES.LSTM;
        state.lastModel = modelKey;
        updateModelBadge(modelKey);
        if (elements.seedInput) {
            const storedSeed = getSeedForModel(modelKey);
            elements.seedInput.value = storedSeed === '' ? '' : storedSeed;
        }
    }

    function handleRatioChange() {
        const ratio = elements.ratioSelect ? elements.ratioSelect.value : '0.8';
        updateTrainRatioLabel(ratio);
    }

    function init() {
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
        elements.modelSelect = document.getElementById('ai-model-type');
        elements.ratioSelect = document.getElementById('ai-train-ratio');
        elements.ratioLabel = document.getElementById('ai-train-ratio-label');
        elements.threshold = document.getElementById('ai-threshold');
        elements.seedInput = document.getElementById('ai-seed');
        elements.seedSaveButton = document.getElementById('ai-save-seed');
        elements.modelBadge = document.getElementById('ai-model-badge');
        elements.confusionMatrix = document.getElementById('ai-confusion-matrix');
        elements.kellySummary = document.getElementById('ai-kelly-summary');

        if (elements.runButton) {
            elements.runButton.addEventListener('click', () => {
                resetResultViews();
                runPrediction();
            });
        }

        if (elements.seedSaveButton) {
            elements.seedSaveButton.addEventListener('click', handleSeedSave);
        }

        if (elements.modelSelect) {
            elements.modelSelect.addEventListener('change', () => {
                handleModelChange();
            });
            handleModelChange();
        }

        if (elements.ratioSelect) {
            elements.ratioSelect.addEventListener('change', () => {
                handleRatioChange();
            });
            handleRatioChange();
        } else {
            updateTrainRatioLabel(0.8);
        }

        updateDatasetSummary(getVisibleData());
        resetResultViews();

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
                updateDatasetSummary(Array.isArray(data) ? data : getVisibleData());
            };
            bridge.versionTag = VERSION_TAG;
        }

        window.addEventListener('lazybacktest:visible-data-changed', (event) => {
            if (event && typeof event.detail === 'object') {
                updateDatasetSummary(getVisibleData());
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
