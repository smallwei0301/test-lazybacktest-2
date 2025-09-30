/* global tf, lastOverallResult, cachedStockData, trendAnalysisState */
// --- AI 預測模組 - 版本碼 LB-AI-PREDICT-20250921A ---
(function initAIPredictor() {
    const VERSION_CODE = 'LB-AI-PREDICT-20250921A';
    const WINDOW_SIZE = 20;
    const EPOCHS = 40;
    const BATCH_SIZE = 32;
    const POSITIVE_GAP = 2; // 元
    const PREDICTION_THRESHOLD = 0.5;

    const percentFormatter = new Intl.NumberFormat('zh-TW', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const currencyFormatter = new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const decimalFormatter = new Intl.NumberFormat('zh-TW', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const state = {
        running: false,
        trades: [],
        elements: {
            runBtn: null,
            status: null,
            version: null,
            metrics: {
                trainAccuracy: null,
                trainWinRate: null,
                testAccuracy: null,
                testWinRate: null,
                kellyFraction: null,
                averageProfit: null,
                totalReturn: null,
                tradeCount: null,
            },
            tradesBody: null,
            exportBtn: null,
        },
        kellyFraction: 0,
        initialCapital: 0,
    };

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '-';
        return percentFormatter.format(value);
    }

    function formatPercentFromRatio(value) {
        if (!Number.isFinite(value)) return '-';
        return `${decimalFormatter.format(value * 100)}%`;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '-';
        return currencyFormatter.format(value);
    }

    function formatNumber(value, fractionDigits = 4) {
        if (!Number.isFinite(value)) return '-';
        return Number(value).toFixed(fractionDigits);
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function setStatus(message, type = 'info') {
        if (!state.elements.status) return;
        const colorMap = {
            success: 'var(--primary)',
            error: 'var(--destructive)',
            warning: 'var(--secondary)',
            progress: 'var(--primary)',
            info: 'var(--muted-foreground)',
        };
        state.elements.status.textContent = message || '';
        state.elements.status.style.color = colorMap[type] || 'var(--muted-foreground)';
    }

    function setMetric(key, value) {
        const target = state.elements.metrics[key];
        if (target) target.textContent = value;
    }

    function resetMetrics() {
        Object.keys(state.elements.metrics).forEach((key) => {
            setMetric(key, '-');
        });
        if (state.elements.tradesBody) {
            state.elements.tradesBody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-3 py-4 text-center text-xs">尚未執行 AI 預測或無符合條件的交易。</td>
                </tr>`;
        }
        state.trades = [];
        state.kellyFraction = 0;
    }

    function setRunning(running) {
        state.running = running;
        if (state.elements.runBtn) {
            state.elements.runBtn.disabled = running;
            state.elements.runBtn.classList.toggle('opacity-70', running);
            state.elements.runBtn.classList.toggle('cursor-wait', running);
        }
    }

    function sanitizeRow(row) {
        if (!row || typeof row !== 'object') return null;
        const date = typeof row.date === 'string' ? row.date.slice(0, 10) : null;
        const close = Number(row.close ?? row.Close ?? NaN);
        if (!date || !Number.isFinite(close)) return null;
        return { date, close };
    }

    function collectRawRows() {
        const sources = [];
        if (typeof trendAnalysisState === 'object' && trendAnalysisState && trendAnalysisState.result && Array.isArray(trendAnalysisState.result.rawData)) {
            sources.push(trendAnalysisState.result.rawData);
        }
        if (lastOverallResult) {
            if (Array.isArray(lastOverallResult.rawData)) sources.push(lastOverallResult.rawData);
            if (Array.isArray(lastOverallResult.rawDataUsed)) sources.push(lastOverallResult.rawDataUsed);
        }
        if (Array.isArray(cachedStockData)) {
            sources.push(cachedStockData);
        }
        for (let i = 0; i < sources.length; i += 1) {
            const rows = sources[i];
            if (Array.isArray(rows) && rows.length > 0) {
                return rows;
            }
        }
        return [];
    }

    function extractDataset() {
        const rawRows = collectRawRows();
        const allowedDates = Array.isArray(lastOverallResult?.dates)
            ? new Set(lastOverallResult.dates.filter((d) => typeof d === 'string'))
            : null;
        const seen = new Set();
        const sanitized = [];
        rawRows.forEach((row) => {
            const sanitizedRow = sanitizeRow(row);
            if (!sanitizedRow) return;
            if (allowedDates && !allowedDates.has(sanitizedRow.date)) return;
            if (seen.has(sanitizedRow.date)) return;
            seen.add(sanitizedRow.date);
            sanitized.push(sanitizedRow);
        });
        sanitized.sort((a, b) => new Date(a.date) - new Date(b.date));
        return sanitized;
    }

    function buildSamples(rows) {
        const sequences = [];
        const labels = [];
        const meta = [];
        for (let i = WINDOW_SIZE - 1; i < rows.length - 1; i += 1) {
            const windowSlice = rows.slice(i - WINDOW_SIZE + 1, i + 1);
            if (windowSlice.some((item) => !Number.isFinite(item.close))) {
                continue;
            }
            const today = rows[i];
            const tomorrow = rows[i + 1];
            if (!Number.isFinite(today.close) || !Number.isFinite(tomorrow.close)) {
                continue;
            }
            const sequence = windowSlice.map((item) => item.close);
            const priceDiff = tomorrow.close - today.close;
            const label = priceDiff >= POSITIVE_GAP ? 1 : 0;
            sequences.push(sequence);
            labels.push(label);
            meta.push({
                today,
                tomorrow,
                priceDiff,
            });
        }
        return { sequences, labels, meta };
    }

    function splitData(sequences, labels, meta) {
        const total = sequences.length;
        if (total < 2) {
            return null;
        }
        let trainCount = Math.floor((total * 2) / 3);
        trainCount = Math.max(1, Math.min(total - 1, trainCount));
        const testCount = total - trainCount;
        const train = {
            sequences: sequences.slice(0, trainCount),
            labels: labels.slice(0, trainCount),
            meta: meta.slice(0, trainCount),
        };
        const test = {
            sequences: sequences.slice(trainCount),
            labels: labels.slice(trainCount),
            meta: meta.slice(trainCount),
        };
        return { train, test };
    }

    function normalizeSequences(trainSeqs, testSeqs) {
        const flatten = trainSeqs.flat();
        const valid = flatten.filter((value) => Number.isFinite(value));
        const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
        const variance = valid.reduce((sum, value) => {
            const diff = value - mean;
            return sum + diff * diff;
        }, 0) / valid.length;
        const std = Math.sqrt(Math.max(variance, 1e-9));
        const normalize = (seq) => seq.map((value) => (value - mean) / std);
        return {
            train: trainSeqs.map(normalize),
            test: testSeqs.map(normalize),
            mean,
            std,
        };
    }

    function sequencesToTensor(sequences) {
        const data = sequences.map((sequence) => sequence.map((value) => [value]));
        return tf.tensor3d(data, [sequences.length, WINDOW_SIZE, 1]);
    }

    function labelsToTensor(labels) {
        return tf.tensor2d(labels, [labels.length, 1]);
    }

    function createModel() {
        const model = tf.sequential();
        model.add(tf.layers.lstm({
            units: 32,
            inputShape: [WINDOW_SIZE, 1],
            returnSequences: false,
        }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy'],
        });
        return model;
    }

    function computeTradeOutcomes(predictions, labels, meta) {
        const trades = [];
        let wins = 0;
        let totalPredicted = 0;
        predictions.forEach((probability, index) => {
            const predictedPositive = probability >= PREDICTION_THRESHOLD;
            if (!predictedPositive) return;
            totalPredicted += 1;
            const label = labels[index] === 1;
            if (label) wins += 1;
            const today = meta[index].today;
            const tomorrow = meta[index].tomorrow;
            const buyPrice = today.close;
            const sellPrice = tomorrow.close;
            const priceDiff = sellPrice - buyPrice;
            const returnPct = Number.isFinite(buyPrice) && buyPrice !== 0 ? priceDiff / buyPrice : 0;
            trades.push({
                date: today.date,
                buyPrice,
                sellPrice,
                priceDiff,
                returnPct,
                probability,
                actualWin: label,
            });
        });
        const winRate = totalPredicted > 0 ? wins / totalPredicted : 0;
        return { trades, winRate, totalPredicted };
    }

    function computeKelly(trades) {
        if (trades.length === 0) {
            return {
                fraction: 0,
                winProbability: 0,
                avgGain: 0,
                avgLoss: 0,
            };
        }
        const winning = trades.filter((trade) => trade.actualWin);
        const losing = trades.filter((trade) => !trade.actualWin);
        const avgGain = winning.length > 0
            ? winning.reduce((sum, trade) => sum + trade.returnPct, 0) / winning.length
            : 0;
        const avgLoss = losing.length > 0
            ? Math.abs(losing.reduce((sum, trade) => sum + trade.returnPct, 0) / losing.length)
            : 0;
        const winProbability = winning.length / trades.length;
        const b = avgLoss > 0 ? avgGain / avgLoss : null;
        const fraction = b && Number.isFinite(b)
            ? Math.max(0, Math.min(1, winProbability - (1 - winProbability) / b))
            : 0;
        return {
            fraction,
            winProbability,
            avgGain,
            avgLoss,
        };
    }

    function simulateKellyTrades(trades, initialCapital, fraction) {
        const results = [];
        let capital = initialCapital;
        trades.forEach((trade) => {
            const invest = capital * fraction;
            const profit = invest * trade.returnPct;
            capital += profit;
            results.push({
                ...trade,
                invested: invest,
                profit,
                capitalAfter: capital,
            });
        });
        const totalReturn = initialCapital > 0 ? (capital - initialCapital) / initialCapital : 0;
        const averageProfit = trades.length > 0
            ? results.reduce((sum, trade) => sum + trade.profit, 0) / trades.length
            : 0;
        return {
            results,
            totalReturn,
            averageProfit,
            finalCapital: capital,
        };
    }

    function renderTrades(trades) {
        if (!state.elements.tradesBody) return;
        if (!Array.isArray(trades) || trades.length === 0) {
            state.elements.tradesBody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-3 py-4 text-center text-xs">模型於測試集未產生符合條件的交易。</td>
                </tr>`;
            return;
        }
        const rows = trades.map((trade) => `
            <tr>
                <td class="px-3 py-2 text-left">${trade.date}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.buyPrice)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.sellPrice)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.priceDiff)}</td>
                <td class="px-3 py-2 text-right">${formatPercentFromRatio(trade.returnPct)}</td>
                <td class="px-3 py-2 text-right">${formatPercent(trade.probability)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.invested)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.profit)}</td>
            </tr>
        `);
        state.elements.tradesBody.innerHTML = rows.join('');
    }

    function getInitialCapital() {
        const input = document.getElementById('initialCapital');
        const value = Number(input?.value);
        if (Number.isFinite(value) && value > 0) return value;
        return 100000;
    }

    function exportCsv() {
        if (!Array.isArray(state.trades) || state.trades.length === 0) {
            setStatus('目前沒有可匯出的 AI 預測交易。', 'warning');
            return;
        }
        const headers = [
            '買進日期',
            '買進價',
            '隔日收盤價',
            '價格差',
            '報酬率',
            '預測機率',
            '投入資金',
            '損益',
            '是否達成 +2 元',
        ];
        const rows = state.trades.map((trade) => [
            trade.date,
            trade.buyPrice.toFixed(2),
            trade.sellPrice.toFixed(2),
            trade.priceDiff.toFixed(2),
            (trade.returnPct * 100).toFixed(2),
            (trade.probability * 100).toFixed(2),
            trade.invested.toFixed(2),
            trade.profit.toFixed(2),
            trade.actualWin ? '是' : '否',
        ].join(','));
        const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai_predict_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 0);
        setStatus('已匯出 AI 預測交易明細。', 'success');
    }

    async function runPrediction() {
        if (state.running) return;
        try {
            setRunning(true);
            setStatus('準備資料與 TensorFlow.js 執行環境...', 'progress');
            if (typeof tf === 'undefined' || typeof tf.ready !== 'function') {
                throw new Error('TensorFlow.js 未成功載入，請確認網路連線後再試。');
            }
            await tf.ready();
            if (!lastOverallResult || !Array.isArray(lastOverallResult.dates) || lastOverallResult.dates.length === 0) {
                throw new Error('請先於主頁籤完成一次回測，以取得訓練所需的歷史資料。');
            }
            const dataset = extractDataset();
            if (!Array.isArray(dataset) || dataset.length < WINDOW_SIZE + 2) {
                throw new Error('資料筆數不足，請拉長回測區間或確認資料來源完整。');
            }
            const samples = buildSamples(dataset);
            if (!samples.sequences.length) {
                throw new Error('無法從資料中建立有效樣本，可能是收盤價缺漏或非交易日。');
            }
            const split = splitData(samples.sequences, samples.labels, samples.meta);
            if (!split) {
                throw new Error('可用樣本不足以切分訓練／測試集，請放寬回測期間。');
            }
            const normalized = normalizeSequences(split.train.sequences, split.test.sequences);
            const xTrain = sequencesToTensor(normalized.train);
            const yTrain = labelsToTensor(split.train.labels);
            const xTest = sequencesToTensor(normalized.test);
            const yTest = labelsToTensor(split.test.labels);
            const model = createModel();
            const totalEpochs = EPOCHS;
            await model.fit(xTrain, yTrain, {
                epochs: totalEpochs,
                batchSize: Math.min(BATCH_SIZE, split.train.sequences.length),
                shuffle: false,
                validationSplit: 0.1,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        const loss = formatNumber(logs?.loss, 4);
                        const acc = Number.isFinite(logs?.acc) ? formatPercent(logs.acc) : (Number.isFinite(logs?.accuracy) ? formatPercent(logs.accuracy) : '');
                        setStatus(`訓練中（${epoch + 1}/${totalEpochs}）：loss=${loss}${acc ? `，accuracy=${acc}` : ''}`, 'progress');
                        await tf.nextFrame();
                    },
                },
            });

            const trainEval = await model.evaluate(xTrain, yTrain, { batchSize: Math.min(BATCH_SIZE, split.train.sequences.length), verbose: 0 });
            const testEval = await model.evaluate(xTest, yTest, { batchSize: Math.min(BATCH_SIZE, split.test.sequences.length), verbose: 0 });
            const trainAccTensor = Array.isArray(trainEval) ? trainEval[1] : null;
            const testAccTensor = Array.isArray(testEval) ? testEval[1] : null;
            const trainAccuracy = Number(trainAccTensor ? (await trainAccTensor.data())[0] : 0);
            const testAccuracy = Number(testAccTensor ? (await testAccTensor.data())[0] : 0);

            const trainPredTensor = model.predict(xTrain);
            const testPredTensor = model.predict(xTest);
            const trainPredictions = Array.from(await trainPredTensor.data());
            const testPredictions = Array.from(await testPredTensor.data());

            if (Array.isArray(trainEval)) trainEval.forEach((tensor) => tensor.dispose());
            else if (trainEval && typeof trainEval.dispose === 'function') trainEval.dispose();
            if (Array.isArray(testEval)) testEval.forEach((tensor) => tensor.dispose());
            else if (testEval && typeof testEval.dispose === 'function') testEval.dispose();
            trainPredTensor.dispose();
            testPredTensor.dispose();
            xTrain.dispose();
            yTrain.dispose();
            xTest.dispose();
            yTest.dispose();
            model.dispose();

            const trainTrades = computeTradeOutcomes(trainPredictions, split.train.labels, split.train.meta);
            const testTrades = computeTradeOutcomes(testPredictions, split.test.labels, split.test.meta);
            const kelly = computeKelly(testTrades.trades);
            const initialCapital = getInitialCapital();
            const simulation = simulateKellyTrades(testTrades.trades, initialCapital, kelly.fraction);

            state.trades = simulation.results;
            state.kellyFraction = kelly.fraction;
            state.initialCapital = initialCapital;

            setMetric('trainAccuracy', formatPercent(trainAccuracy));
            setMetric('trainWinRate', formatPercent(trainTrades.winRate));
            setMetric('testAccuracy', formatPercent(testAccuracy));
            setMetric('testWinRate', formatPercent(testTrades.winRate));
            setMetric('kellyFraction', formatPercent(kelly.fraction));
            setMetric('averageProfit', simulation.results.length > 0 ? formatCurrency(simulation.averageProfit) : '-');
            setMetric('totalReturn', formatPercent(simulation.totalReturn));
            setMetric('tradeCount', simulation.results.length.toString());

            renderTrades(simulation.results);

            if (simulation.results.length === 0) {
                setStatus('模型於測試集未觸發任何符合 2 元漲幅的做多交易。', 'warning');
            } else {
                const summary = `AI 預測完成，測試集共觸發 ${simulation.results.length} 筆交易，凱利建議投入 ${formatPercent(kelly.fraction)}。`;
                setStatus(summary, 'success');
            }
        } catch (error) {
            console.error('[AI Predict] 執行失敗：', error);
            setStatus(error?.message || 'AI 預測過程發生未知錯誤。', 'error');
            resetMetrics();
        } finally {
            setRunning(false);
        }
    }

    function setup() {
        state.elements.runBtn = getElement('aiPredictRunBtn');
        state.elements.status = getElement('aiPredictStatus');
        state.elements.version = getElement('aiPredictVersionLabel');
        state.elements.metrics.trainAccuracy = getElement('aiTrainAccuracy');
        state.elements.metrics.trainWinRate = getElement('aiTrainWinRate');
        state.elements.metrics.testAccuracy = getElement('aiTestAccuracy');
        state.elements.metrics.testWinRate = getElement('aiTestWinRate');
        state.elements.metrics.kellyFraction = getElement('aiKellyFraction');
        state.elements.metrics.averageProfit = getElement('aiAverageProfit');
        state.elements.metrics.totalReturn = getElement('aiTotalReturn');
        state.elements.metrics.tradeCount = getElement('aiTradeCount');
        state.elements.tradesBody = getElement('aiPredictTradesBody');
        state.elements.exportBtn = getElement('aiPredictExportBtn');

        if (!state.elements.runBtn) {
            return;
        }
        if (state.elements.version) {
            state.elements.version.textContent = VERSION_CODE;
        }
        resetMetrics();
        setStatus('準備就緒，請先於主頁籤完成回測再執行 AI 預測。', 'info');
        state.elements.runBtn.addEventListener('click', runPrediction);
        if (state.elements.exportBtn) {
            state.elements.exportBtn.addEventListener('click', exportCsv);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }

    window.lazybacktestAIPredictor = {
        version: VERSION_CODE,
        run: runPrediction,
        reset: resetMetrics,
    };
})();
