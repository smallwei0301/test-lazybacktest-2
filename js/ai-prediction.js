// Patch Tag: LB-AI-PREDICT-20250915A
/* global tf, cachedStockData, lastFetchSettings */
(function () {
    const VERSION = 'LB-AI-PREDICT-20250915A';
    const DATA_EVENT = 'lazybacktest:dataset-updated';
    const LAST_FETCH_EVENT = 'lazybacktest:last-fetch-updated';
    const MIN_LOOKBACK = 10;
    const MAX_LOOKBACK = 60;
    const DEFAULT_LOOKBACK = 20;
    const MIN_TRAIN_SAMPLES = 20;
    const MIN_TEST_SAMPLES = 10;

    const state = {
        dataset: Array.isArray(cachedStockData) ? cachedStockData : [],
        meta: lastFetchSettings ? { settings: lastFetchSettings } : null,
        running: false,
        lookback: DEFAULT_LOOKBACK,
        kellyEnabled: false,
        elements: {},
    };

    function byDateAsc(a, b) {
        const aDate = (a?.date || '').toString();
        const bDate = (b?.date || '').toString();
        if (aDate < bDate) return -1;
        if (aDate > bDate) return 1;
        return 0;
    }

    function parseLookback(raw) {
        const value = Number.parseInt(raw, 10);
        if (Number.isNaN(value)) return DEFAULT_LOOKBACK;
        return Math.min(Math.max(value, MIN_LOOKBACK), MAX_LOOKBACK);
    }

    function formatPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const percent = (value * 100).toFixed(digits);
        return `${percent}%`;
    }

    function formatPercentDirect(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const percent = value.toFixed(digits);
        return `${percent}%`;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '—';
        try {
            return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
        } catch (error) {
            return value.toFixed(0);
        }
    }

    function formatDateLabel(dateText) {
        if (!dateText) return '—';
        return dateText;
    }

    function setStatus(message, tone = 'info') {
        const el = state.elements.status;
        if (!el) return;
        el.textContent = message;
        const colorMap = {
            info: 'var(--muted-foreground)',
            success: 'var(--primary)',
            warning: 'var(--secondary)',
            error: 'var(--destructive)',
        };
        el.style.color = colorMap[tone] || 'var(--muted-foreground)';
    }

    function toggleRunning(running) {
        state.running = running;
        const runButton = state.elements.runButton;
        const resetButton = state.elements.resetButton;
        const lookbackInput = state.elements.lookbackInput;
        const kellyCheckbox = state.elements.kellyCheckbox;
        if (runButton) {
            runButton.disabled = running;
            runButton.innerHTML = running
                ? '<i data-lucide="loader-2" class="lucide w-4 h-4 animate-spin"></i> 訓練中...'
                : '<i data-lucide="sparkles" class="lucide w-4 h-4"></i> 生成 AI 預測';
        }
        if (resetButton) resetButton.disabled = running;
        if (lookbackInput) lookbackInput.disabled = running;
        if (kellyCheckbox) kellyCheckbox.disabled = running;
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function updateDatasetSummary() {
        const summaryEl = state.elements.datasetSummary;
        const rangeEl = state.elements.datasetRange;
        const rows = Array.isArray(state.dataset) ? state.dataset : [];
        if (!summaryEl || !rangeEl) return;
        if (rows.length === 0) {
            summaryEl.textContent = '等待回測資料';
            rangeEl.textContent = '—';
            return;
        }
        const sorted = [...rows].sort(byDateAsc);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        summaryEl.textContent = `已同步 ${sorted.length.toLocaleString()} 筆收盤價`;
        rangeEl.textContent = `${formatDateLabel(first?.date)} ~ ${formatDateLabel(last?.date)}`;
    }

    function updateVersionLabel() {
        const summaryEl = state.elements.summaryText;
        if (!summaryEl) return;
        summaryEl.textContent = `模型版本 ${VERSION} 已就緒，請先完成主回測以建立資料。`;
    }

    function clearResults() {
        const card = state.elements.resultCard;
        if (card) card.classList.add('hidden');
        const ids = [
            'aiTrainAccuracy',
            'aiTestAccuracy',
            'aiNextProbability',
            'aiAverageProfit',
            'aiTradeCount',
            'aiTestWinRate',
            'aiTotalReturn',
            'aiFinalCapital',
        ];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        const textEls = [state.elements.summaryDetail, state.elements.narrative, state.elements.kellyNarrative];
        textEls.forEach((el) => {
            if (el) el.textContent = '';
        });
        const tbody = state.elements.tradesBody;
        if (tbody) tbody.innerHTML = '';
        setStatus('結果已清除，重新執行可取得最新預測。', 'info');
    }

    function handleDatasetUpdate(event) {
        const rows = event?.detail?.rows;
        state.dataset = Array.isArray(rows) ? rows : [];
        state.meta = event?.detail?.meta || null;
        updateDatasetSummary();
        if (state.dataset.length > 0) {
            setStatus('已同步最新回測資料，歡迎執行 AI 預測。', 'success');
        } else {
            setStatus('請先完成主回測以取得訓練資料。', 'warning');
        }
    }

    function handleLastFetchUpdate(event) {
        if (event?.detail?.settings) {
            state.meta = {
                ...(state.meta || {}),
                settings: event.detail.settings,
            };
        }
    }

    function prepareSamples(rows, lookback) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { samples: [], closes: [], dates: [] };
        }
        const sorted = [...rows]
            .filter((row) => row && Number.isFinite(row.close) && row.close > 0 && row.date)
            .sort(byDateAsc);
        const closes = sorted.map((row) => Number(row.close));
        const dates = sorted.map((row) => row.date);
        if (closes.length <= lookback + 1) {
            return { samples: [], closes, dates };
        }
        const returns = [];
        for (let i = 0; i < closes.length - 1; i += 1) {
            const base = closes[i];
            const next = closes[i + 1];
            if (!Number.isFinite(base) || !Number.isFinite(next) || base <= 0) {
                returns.push(null);
            } else {
                returns.push((next - base) / base);
            }
        }
        const samples = [];
        for (let t = lookback; t < returns.length; t += 1) {
            const featureWindow = returns.slice(t - lookback, t);
            if (featureWindow.some((val) => !Number.isFinite(val))) continue;
            const targetReturn = returns[t];
            if (!Number.isFinite(targetReturn)) continue;
            const todayClose = closes[t];
            const nextClose = closes[t + 1];
            if (!Number.isFinite(todayClose) || !Number.isFinite(nextClose)) continue;
            samples.push({
                features: featureWindow,
                label: targetReturn > 0 ? 1 : 0,
                probabilityTarget: targetReturn,
                trade: {
                    date: dates[t],
                    nextDate: dates[t + 1],
                    todayClose,
                    nextClose,
                    nextReturn: targetReturn,
                },
            });
        }
        return { samples, closes, dates };
    }

    function buildModel(inputLength) {
        const model = tf.sequential();
        model.add(tf.layers.inputLayer({ inputShape: [inputLength, 1] }));
        model.add(tf.layers.lstm({ units: 32, returnSequences: false, activation: 'tanh' }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: tf.train.adam(0.003), loss: 'binaryCrossentropy', metrics: ['accuracy'] });
        return model;
    }

    function toTensor3D(samples, lookback) {
        if (!Array.isArray(samples) || samples.length === 0) return null;
        const data = samples.map((sample) => sample.features.map((val) => [val]));
        return tf.tensor3d(data, [samples.length, lookback, 1]);
    }

    function toLabelTensor(samples) {
        if (!Array.isArray(samples) || samples.length === 0) return null;
        const labels = samples.map((sample) => [sample.label]);
        return tf.tensor2d(labels, [samples.length, 1]);
    }

    function computeKellyFraction(probability, avgGain, avgLoss) {
        const p = Math.min(Math.max(probability, 0.01), 0.99);
        const q = 1 - p;
        if (!Number.isFinite(avgGain) || avgGain <= 0 || !Number.isFinite(avgLoss) || avgLoss <= 0) {
            return Math.max(0, Math.min(p - q, 1));
        }
        const b = avgGain / avgLoss;
        if (!Number.isFinite(b) || b <= 0) {
            return Math.max(0, Math.min(p - q, 1));
        }
        const fraction = p - (q / b);
        if (!Number.isFinite(fraction)) return 0;
        return Math.max(0, Math.min(fraction, 1));
    }

    function buildNarrative(metrics) {
        if (!metrics) return '';
        const parts = [];
        if (Number.isFinite(metrics.testAccuracy)) {
            if (metrics.testAccuracy >= 0.6) {
                parts.push('模型在測試集的方向判斷優於 60%，可作為短線趨勢濾網。');
            } else if (metrics.testAccuracy >= 0.5) {
                parts.push('模型在測試集略高於隨機結果，建議搭配既有策略或其他因子交叉驗證。');
            } else {
                parts.push('模型測試表現低於 50%，建議重新檢視資料期間或調整視窗長度。');
            }
        }
        if (Number.isFinite(metrics.averageReturn)) {
            if (metrics.averageReturn > 0) {
                parts.push(`每筆交易平均貢獻 ${formatPercentDirect(metrics.averageReturn * 100, 2)}，顯示在上漲情境具正向增益。`);
            } else if (metrics.averageReturn < 0) {
                parts.push('平均報酬為負值，建議加入風控或僅在其他指標共振時進場。');
            }
        }
        if (!metrics.trades || metrics.trades.length === 0) {
            parts.push('測試期間未達進場條件，請確認資料量或降低進場門檻。');
        }
        return parts.join(' ');
    }

    function buildKellyNarrative(metrics) {
        if (!metrics) return '';
        if (!metrics.kellyEnabled) {
            return '未啟用凱利公式，模擬以 100% 可用資金投入。';
        }
        if (!Number.isFinite(metrics.avgGain) || !Number.isFinite(metrics.avgLoss)) {
            return '凱利公式缺乏足夠的盈虧樣本，已回退為固定全額投入。';
        }
        const fractionText = formatPercentDirect(metrics.avgKellyFraction * 100, 2);
        return `凱利公式依訓練集平均盈虧比推估每筆投入約 ${fractionText} 的可用資金，上限已限制在 100%。`;
    }

    function renderTrades(trades) {
        const tbody = state.elements.tradesBody;
        if (!tbody) return;
        if (!Array.isArray(trades) || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-3 text-center text-muted" style="color: var(--muted-foreground);">測試期間無進場紀錄。</td></tr>';
            return;
        }
        tbody.innerHTML = trades
            .map((trade) => {
                const remark = trade.predictedUp ? (trade.profit >= 0 ? '預測正確' : '預測失誤') : '未進場';
                return `
                    <tr>
                        <td class="px-3 py-2 whitespace-nowrap">${formatDateLabel(trade.date)}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${formatDateLabel(trade.nextDate)}</td>
                        <td class="px-3 py-2 text-right">${formatPercent(trade.probability)}</td>
                        <td class="px-3 py-2 text-right">${formatPercent(trade.actualReturn)}</td>
                        <td class="px-3 py-2 text-right">${formatCurrency(trade.amount)}</td>
                        <td class="px-3 py-2 text-right" style="color:${trade.profit >= 0 ? 'var(--primary)' : 'var(--destructive)'};">${formatCurrency(trade.profit)}</td>
                        <td class="px-3 py-2">${remark}</td>
                    </tr>
                `;
            })
            .join('');
    }

    async function runPrediction() {
        if (state.running) {
            setStatus('模型訓練中，請稍候。', 'warning');
            return;
        }
        if (typeof tf === 'undefined' || !tf?.layers) {
            setStatus('TensorFlow.js 未載入，無法執行 AI 預測。', 'error');
            return;
        }
        const lookback = parseLookback(state.elements.lookbackInput?.value ?? DEFAULT_LOOKBACK);
        state.lookback = lookback;
        const rows = Array.isArray(state.dataset) ? state.dataset : [];
        if (rows.length === 0) {
            setStatus('尚未取得回測資料，請先執行主回測。', 'warning');
            return;
        }
        toggleRunning(true);
        clearResults();
        setStatus('正在整理資料集...', 'info');

        const prepared = prepareSamples(rows, lookback);
        if (!prepared.samples || prepared.samples.length < MIN_TRAIN_SAMPLES + MIN_TEST_SAMPLES) {
            toggleRunning(false);
            setStatus('有效樣本不足，請拉長回測期間或降低視窗長度。', 'error');
            return;
        }

        const splitIndex = Math.max(Math.floor(prepared.samples.length * (2 / 3)), MIN_TRAIN_SAMPLES);
        const trainingSamples = prepared.samples.slice(0, splitIndex);
        const testingSamples = prepared.samples.slice(splitIndex);
        if (trainingSamples.length < MIN_TRAIN_SAMPLES || testingSamples.length < MIN_TEST_SAMPLES) {
            toggleRunning(false);
            setStatus('訓練或測試樣本不足，請調整資料量。', 'error');
            return;
        }

        const trainX = toTensor3D(trainingSamples, lookback);
        const trainY = toLabelTensor(trainingSamples);
        const testX = toTensor3D(testingSamples, lookback);
        const testY = toLabelTensor(testingSamples);
        if (!trainX || !trainY || !testX || !testY) {
            toggleRunning(false);
            setStatus('資料轉換失敗，請重新嘗試。', 'error');
            return;
        }

        const model = buildModel(lookback);
        let history;
        try {
            setStatus('正在訓練 LSTM 模型...', 'info');
            const batchSize = Math.max(8, Math.floor(trainingSamples.length / 12));
            history = await model.fit(trainX, trainY, {
                epochs: 35,
                batchSize,
                validationSplit: 0.1,
                shuffle: false,
                callbacks: {
                    onEpochEnd(epoch) {
                        if (epoch % 5 === 4) {
                            setStatus(`訓練中（Epoch ${epoch + 1}/35）...`, 'info');
                        }
                    },
                },
            });
        } catch (error) {
            console.error('[AI Prediction] LSTM 訓練失敗', error);
            toggleRunning(false);
            setStatus('模型訓練失敗，請查看主控台錯誤訊息。', 'error');
            tf.dispose([trainX, trainY, testX, testY, model]);
            return;
        }

        setStatus('正在評估模型...', 'info');
        let trainAccuracy = null;
        if (history?.history) {
            const accHistory = history.history.acc || history.history.accuracy;
            if (Array.isArray(accHistory) && accHistory.length > 0) {
                trainAccuracy = accHistory[accHistory.length - 1];
            }
        }

        let testProbabilitiesTensor;
        let testProbabilities = [];
        try {
            testProbabilitiesTensor = model.predict(testX);
            const array = await testProbabilitiesTensor.array();
            testProbabilities = Array.isArray(array) ? array.map((row) => (Array.isArray(row) ? row[0] : row)) : [];
        } catch (error) {
            console.error('[AI Prediction] 測試預測失敗', error);
            toggleRunning(false);
            setStatus('模型評估失敗，請檢查資料是否含缺值。', 'error');
            tf.dispose([trainX, trainY, testX, testY, model, testProbabilitiesTensor]);
            return;
        }

        let testAccuracy = null;
        if (testProbabilities.length === testingSamples.length) {
            let correct = 0;
            for (let i = 0; i < testingSamples.length; i += 1) {
                const predicted = testProbabilities[i] >= 0.5 ? 1 : 0;
                if (predicted === testingSamples[i].label) correct += 1;
            }
            testAccuracy = correct / testingSamples.length;
        }

        const lastSample = prepared.samples[prepared.samples.length - 1];
        let nextDayProbability = null;
        if (lastSample) {
            const windowTensor = tf.tensor3d([lastSample.features.map((val) => [val])], [1, lookback, 1]);
            try {
                const nextTensor = model.predict(windowTensor);
                const array = await nextTensor.array();
                nextDayProbability = Array.isArray(array) && Array.isArray(array[0]) ? array[0][0] : null;
                tf.dispose(nextTensor);
            } finally {
                tf.dispose(windowTensor);
            }
        }

        const trainingReturns = trainingSamples.map((sample) => sample.trade.nextReturn);
        const positive = trainingReturns.filter((ret) => Number.isFinite(ret) && ret > 0);
        const negative = trainingReturns.filter((ret) => Number.isFinite(ret) && ret < 0).map((ret) => Math.abs(ret));
        const avgGain = positive.length > 0 ? positive.reduce((sum, val) => sum + val, 0) / positive.length : null;
        const avgLoss = negative.length > 0 ? negative.reduce((sum, val) => sum + val, 0) / negative.length : null;

        const kellyEnabled = Boolean(state.elements.kellyCheckbox?.checked);
        const initialCapital = (() => {
            const raw = document.getElementById('initialCapital')?.value;
            const parsed = Number.parseFloat(raw);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 100000;
        })();

        const trades = [];
        let capital = initialCapital;
        let totalProfit = 0;
        let winCount = 0;
        let kellyFractionSum = 0;

        for (let i = 0; i < testingSamples.length; i += 1) {
            const sample = testingSamples[i];
            const probability = Number.isFinite(testProbabilities[i]) ? testProbabilities[i] : 0;
            const predictedUp = probability >= 0.5;
            let fraction = 1;
            if (kellyEnabled) {
                fraction = computeKellyFraction(probability, avgGain ?? 0, avgLoss ?? 0);
            }
            if (!predictedUp || fraction <= 0) {
                trades.push({
                    date: sample.trade.date,
                    nextDate: sample.trade.nextDate,
                    probability,
                    amount: 0,
                    profit: 0,
                    actualReturn: sample.trade.nextReturn,
                    predictedUp,
                });
                continue;
            }
            const appliedFraction = Math.min(Math.max(fraction, 0), 1);
            const amount = capital * appliedFraction;
            const profit = amount * sample.trade.nextReturn;
            capital += profit;
            totalProfit += profit;
            if (profit > 0) winCount += 1;
            if (kellyEnabled) {
                kellyFractionSum += appliedFraction;
            }
            trades.push({
                date: sample.trade.date,
                nextDate: sample.trade.nextDate,
                probability,
                amount,
                profit,
                actualReturn: sample.trade.nextReturn,
                predictedUp,
            });
        }

        const executedTrades = trades.filter((trade) => trade.amount > 0);
        const averageReturn = executedTrades.length > 0
            ? executedTrades.reduce((sum, trade) => sum + trade.actualReturn, 0) / executedTrades.length
            : 0;
        const totalReturn = (capital - initialCapital) / initialCapital;
        const winRate = executedTrades.length > 0 ? winCount / executedTrades.length : 0;
        const avgKellyFraction = kellyEnabled && executedTrades.length > 0
            ? kellyFractionSum / executedTrades.length
            : 1;

        const metrics = {
            trainAccuracy,
            testAccuracy,
            nextDayProbability,
            averageReturn,
            tradeCount: executedTrades.length,
            testWinRate: winRate,
            totalReturn,
            finalCapital: capital,
            kellyEnabled,
            avgGain,
            avgLoss,
            avgKellyFraction,
            trades: executedTrades,
        };

        const card = state.elements.resultCard;
        if (card) {
            card.classList.remove('hidden');
        }
        const summaryDetail = state.elements.summaryDetail;
        if (summaryDetail) {
            summaryDetail.textContent = `訓練樣本 ${trainingSamples.length} 筆、測試樣本 ${testingSamples.length} 筆。`;
        }
        const metricsMap = [
            { id: 'aiTrainAccuracy', value: trainAccuracy, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiTestAccuracy', value: testAccuracy, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiNextProbability', value: nextDayProbability, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiAverageProfit', value: averageReturn, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiTradeCount', value: executedTrades.length, formatter: (val) => `${val}` },
            { id: 'aiTestWinRate', value: winRate, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiTotalReturn', value: totalReturn, formatter: (val) => formatPercentDirect(val * 100) },
            { id: 'aiFinalCapital', value: capital, formatter: formatCurrency },
        ];
        metricsMap.forEach(({ id, value, formatter }) => {
            const el = document.getElementById(id);
            if (el) el.textContent = formatter(Number.isFinite(value) ? value : 0);
        });

        if (state.elements.narrative) {
            state.elements.narrative.textContent = buildNarrative({
                testAccuracy,
                averageReturn,
                trades: executedTrades,
            });
        }
        if (state.elements.kellyNarrative) {
            state.elements.kellyNarrative.textContent = buildKellyNarrative(metrics);
        }
        renderTrades(trades);

        setStatus('AI 預測完成，結果已更新。', 'success');
        toggleRunning(false);

        tf.dispose([trainX, trainY, testX, testY, model, testProbabilitiesTensor]);
    }

    function init() {
        const elements = {
            lookbackInput: document.getElementById('aiLookbackWindow'),
            kellyCheckbox: document.getElementById('aiEnableKelly'),
            runButton: document.getElementById('aiPredictionRun'),
            resetButton: document.getElementById('aiPredictionReset'),
            status: document.getElementById('aiPredictionStatus'),
            datasetSummary: document.getElementById('aiDatasetSummary'),
            datasetRange: document.getElementById('aiDatasetRange'),
            resultCard: document.getElementById('aiPredictionResultCard'),
            summaryDetail: document.getElementById('aiPredictionSummaryText'),
            narrative: document.getElementById('aiPredictionNarrative'),
            kellyNarrative: document.getElementById('aiKellyNarrative'),
            tradesBody: document.getElementById('aiPredictionTradesBody'),
            summaryText: document.getElementById('aiPredictionSummaryText'),
        };
        state.elements = elements;
        if (!elements.runButton || !elements.lookbackInput || !elements.status) {
            return;
        }
        elements.lookbackInput.value = DEFAULT_LOOKBACK;
        updateVersionLabel();
        updateDatasetSummary();
        setStatus(state.dataset.length > 0 ? '已同步回測資料，歡迎執行 AI 預測。' : '請先完成主回測以取得資料。', state.dataset.length > 0 ? 'success' : 'info');

        elements.lookbackInput.addEventListener('change', () => {
            const value = parseLookback(elements.lookbackInput.value);
            elements.lookbackInput.value = value;
            state.lookback = value;
            setStatus(`視窗長度已調整為 ${value} 日，下次訓練生效。`, 'info');
        });

        if (elements.kellyCheckbox) {
            elements.kellyCheckbox.addEventListener('change', () => {
                state.kellyEnabled = Boolean(elements.kellyCheckbox.checked);
                setStatus(state.kellyEnabled ? '已啟用凱利公式，將動態調整倉位比例。' : '已停用凱利公式，將以全額投入模擬。', 'info');
            });
        }

        elements.runButton.addEventListener('click', () => {
            runPrediction().catch((error) => {
                console.error('[AI Prediction] 執行失敗', error);
                toggleRunning(false);
                setStatus('AI 預測執行過程發生錯誤，請檢查主控台。', 'error');
            });
        });

        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', () => {
                if (state.running) {
                    setStatus('模型訓練中，暫時無法清除結果。', 'warning');
                    return;
                }
                clearResults();
            });
        }

        window.addEventListener(DATA_EVENT, handleDatasetUpdate);
        window.addEventListener(LAST_FETCH_EVENT, handleLastFetchUpdate);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
