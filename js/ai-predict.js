/* global tf, lastOverallResult, cachedStockData, trendAnalysisState, Chart */
// --- AI 預測模組 - 版本碼 LB-AI-PREDICT-20250923A ---
(function initAIPredictor() {
    const VERSION_CODE = 'LB-AI-PREDICT-20250923A';
    const WINDOW_SIZE = 20;
    const EPOCHS = 40;
    const BATCH_SIZE = 32;
    const PREDICTION_THRESHOLD = 0.5;
    const CAPITAL_MODES = {
        KELLY: 'kelly',
        FIXED: 'fixed',
    };

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
        kellyFraction: 0,
        initialCapital: 0,
        tradeCandidates: [],
        simulations: {},
        equityCurves: null,
        currentMode: CAPITAL_MODES.KELLY,
        trades: [],
        equityChart: null,
        elements: {
            runBtn: null,
            status: null,
            version: null,
            capitalMode: null,
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
    };

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '-';
        return percentFormatter.format(value);
    }

    function formatPercentFromRatio(value) {
        if (!Number.isFinite(value)) return '-';
        return `${decimalFormatter.format(value * 100)}%`;
    }

    function formatPercentDisplay(value) {
        if (!Number.isFinite(value)) return '-';
        return `${decimalFormatter.format(value)}%`;
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

    function destroyChart() {
        if (state.equityChart && typeof state.equityChart.destroy === 'function') {
            state.equityChart.destroy();
        }
        state.equityChart = null;
    }

    function resetMetrics() {
        Object.keys(state.elements.metrics).forEach((key) => {
            setMetric(key, '-');
        });
        if (state.elements.tradesBody) {
            state.elements.tradesBody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-3 py-4 text-center text-xs">尚未執行 AI 預測或無符合條件的交易。</td>
                </tr>`;
        }
        destroyChart();
        state.trades = [];
        state.tradeCandidates = [];
        state.simulations = {};
        state.equityCurves = null;
        state.kellyFraction = 0;
        state.initialCapital = 0;
        state.currentMode = CAPITAL_MODES.KELLY;
        if (state.elements.capitalMode) {
            state.elements.capitalMode.value = CAPITAL_MODES.KELLY;
        }
    }

    function setRunning(running) {
        state.running = running;
        if (state.elements.runBtn) {
            state.elements.runBtn.disabled = running;
            state.elements.runBtn.classList.toggle('opacity-70', running);
            state.elements.runBtn.classList.toggle('cursor-wait', running);
        }
    }

    function pickNumeric(row, keys) {
        for (let i = 0; i < keys.length; i += 1) {
            const value = Number(row[keys[i]]);
            if (Number.isFinite(value)) {
                return value;
            }
        }
        return Number.NaN;
    }

    function sanitizeRow(row) {
        if (!row || typeof row !== 'object') return null;
        const date = typeof row.date === 'string' ? row.date.slice(0, 10) : null;
        const close = pickNumeric(row, ['close', 'Close', 'closingPrice', 'ClosingPrice']);
        if (!date || !Number.isFinite(close)) return null;
        const open = pickNumeric(row, ['open', 'Open', 'openingPrice', 'OpeningPrice', 'startPrice']);
        const high = pickNumeric(row, ['high', 'High', 'max', 'Max', 'highestPrice', 'HighPrice']);
        const low = pickNumeric(row, ['low', 'Low', 'min', 'Min', 'lowestPrice', 'LowPrice']);
        return {
            date,
            open,
            high,
            low,
            close,
        };
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
            const label = tomorrow.close > today.close ? 1 : 0;
            sequences.push(sequence);
            labels.push(label);
            meta.push({
                today: { ...today },
                tomorrow: { ...tomorrow },
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
        let executed = 0;
        predictions.forEach((probability, index) => {
            if (probability < PREDICTION_THRESHOLD) return;
            const metaItem = meta[index];
            if (!metaItem || !metaItem.today || !metaItem.tomorrow) return;
            const buyPrice = Number(metaItem.today.close);
            const sellPrice = Number(metaItem.tomorrow.close);
            if (!Number.isFinite(buyPrice) || !Number.isFinite(sellPrice)) return;
            const rangeHigh = Number(metaItem.tomorrow.high);
            const rangeLow = Number(metaItem.tomorrow.low);
            const openPrice = Number(metaItem.tomorrow.open);
            let filled = false;
            if (Number.isFinite(rangeHigh) && Number.isFinite(rangeLow)) {
                filled = rangeLow <= buyPrice && buyPrice <= rangeHigh;
            } else if (Number.isFinite(openPrice)) {
                const maxPrice = Math.max(openPrice, sellPrice);
                const minPrice = Math.min(openPrice, sellPrice);
                filled = buyPrice >= minPrice && buyPrice <= maxPrice;
            }
            if (!filled) return;
            executed += 1;
            const actualWin = labels[index] === 1;
            if (actualWin) wins += 1;
            const priceDiff = sellPrice - buyPrice;
            const returnPct = buyPrice !== 0 ? priceDiff / buyPrice : 0;
            trades.push({
                date: metaItem.today.date,
                sellDate: metaItem.tomorrow.date,
                buyPrice,
                sellPrice,
                priceDiff,
                returnPct,
                probability,
                actualWin,
            });
        });
        const winRate = executed > 0 ? wins / executed : 0;
        return { trades, winRate, executed };
    }

    function computeKelly(trades) {
        if (!Array.isArray(trades) || trades.length === 0) {
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
        const rawFraction = b && Number.isFinite(b)
            ? winProbability - (1 - winProbability) / b
            : 0;
        const fraction = Math.max(0, Math.min(1, rawFraction));
        return {
            fraction,
            winProbability,
            avgGain,
            avgLoss,
        };
    }

    function simulateTrades(trades, initialCapital, options) {
        const { mode, fraction = 0 } = options;
        if (!Array.isArray(trades) || trades.length === 0 || !Number.isFinite(initialCapital) || initialCapital <= 0) {
            return {
                results: [],
                totalReturn: 0,
                averageProfit: 0,
                finalCapital: initialCapital || 0,
            };
        }
        const sortedTrades = trades.slice().sort((a, b) => new Date(a.sellDate) - new Date(b.sellDate));
        const results = [];
        let capital = initialCapital;
        sortedTrades.forEach((trade) => {
            const positionFraction = mode === CAPITAL_MODES.KELLY ? fraction : 1;
            const invest = capital * positionFraction;
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
        const averageProfit = results.length > 0
            ? results.reduce((sum, trade) => sum + trade.profit, 0) / results.length
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
                    <td colspan="9" class="px-3 py-4 text-center text-xs">模型於測試集未產生符合條件且能成交的交易。</td>
                </tr>`;
            return;
        }
        const rows = trades.map((trade) => `
            <tr>
                <td class="px-3 py-2 text-left">${trade.date}</td>
                <td class="px-3 py-2 text-left">${trade.sellDate || '-'}</td>
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

    function buildEquityCurves(meta, initialCapital, simulations) {
        if (!Array.isArray(meta) || meta.length === 0 || !Number.isFinite(initialCapital) || initialCapital <= 0) {
            return null;
        }
        const priceByDate = new Map();
        meta.forEach((entry) => {
            if (entry.today?.date && Number.isFinite(entry.today.close)) {
                priceByDate.set(entry.today.date, Number(entry.today.close));
            }
            if (entry.tomorrow?.date && Number.isFinite(entry.tomorrow.close)) {
                priceByDate.set(entry.tomorrow.date, Number(entry.tomorrow.close));
            }
        });
        const sortedDates = Array.from(priceByDate.keys()).sort((a, b) => new Date(a) - new Date(b));
        if (sortedDates.length === 0) return null;
        const startPrice = priceByDate.get(sortedDates[0]);
        const safeStartPrice = Number.isFinite(startPrice) && startPrice !== 0 ? startPrice : null;
        const buyHold = sortedDates.map((date) => {
            const price = priceByDate.get(date);
            const ratio = safeStartPrice ? price / safeStartPrice : 1;
            return {
                date,
                capital: initialCapital * ratio,
            };
        });

        const buildFromSimulation = (simulation) => {
            if (!simulation || !Array.isArray(simulation.results)) {
                return buyHold.map(({ date }) => ({ date, capital: initialCapital }));
            }
            const capitalByDate = new Map();
            simulation.results.forEach((trade) => {
                if (trade.sellDate) {
                    capitalByDate.set(trade.sellDate, trade.capitalAfter);
                }
            });
            let currentCapital = initialCapital;
            return sortedDates.map((date) => {
                if (capitalByDate.has(date)) {
                    currentCapital = capitalByDate.get(date);
                }
                return {
                    date,
                    capital: currentCapital,
                };
            });
        };

        return {
            buyHold,
            kelly: buildFromSimulation(simulations[CAPITAL_MODES.KELLY]),
            fixed: buildFromSimulation(simulations[CAPITAL_MODES.FIXED]),
        };
    }

    function renderEquityChart(curves, activeMode) {
        if (!curves) {
            destroyChart();
            return;
        }
        const canvas = document.getElementById('aiPredictEquityChart');
        if (!canvas || typeof Chart === 'undefined') {
            return;
        }
        const labels = curves.buyHold.map((point) => point.date);
        const baseValue = state.initialCapital > 0 ? state.initialCapital : 1;
        const toPercentSeries = (series) => series.map((point) => {
            if (!Number.isFinite(point.capital)) return 0;
            return ((point.capital / baseValue) - 1) * 100;
        });
        const datasets = [
            {
                key: CAPITAL_MODES.KELLY,
                label: '凱利資金策略',
                borderColor: '#0ea5a4',
                backgroundColor: '#0ea5a4',
                data: toPercentSeries(curves.kelly),
            },
            {
                key: CAPITAL_MODES.FIXED,
                label: '固定全額策略',
                borderColor: '#f59e0b',
                backgroundColor: '#f59e0b',
                data: toPercentSeries(curves.fixed),
            },
            {
                key: 'buyHold',
                label: '買入持有',
                borderColor: '#6366f1',
                backgroundColor: '#6366f1',
                data: toPercentSeries(curves.buyHold),
            },
        ];
        destroyChart();
        const ctx = canvas.getContext('2d');
        state.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: datasets.map((dataset) => ({
                    label: dataset.label,
                    data: dataset.data,
                    borderColor: dataset.borderColor,
                    backgroundColor: dataset.backgroundColor,
                    borderWidth: dataset.key === activeMode ? 3 : 1.5,
                    borderDash: dataset.key === activeMode || dataset.key === 'buyHold' ? [] : [6, 4],
                    tension: 0.25,
                    pointRadius: 0,
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 8,
                            color: 'var(--muted-foreground)',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.15)',
                        },
                    },
                    y: {
                        ticks: {
                            callback: (value) => `${Number(value).toFixed(1)}%`,
                            color: 'var(--muted-foreground)',
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.15)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--muted-foreground)',
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = Number(context.parsed.y);
                                return `${context.dataset.label}: ${formatPercentDisplay(value)}`;
                            },
                        },
                    },
                },
            },
        });
    }

    function applySimulationMode(mode) {
        const selectedMode = mode === CAPITAL_MODES.FIXED ? CAPITAL_MODES.FIXED : CAPITAL_MODES.KELLY;
        state.currentMode = selectedMode;
        const simulation = state.simulations[selectedMode];
        if (!simulation) {
            renderTrades([]);
            setMetric('averageProfit', '-');
            setMetric('totalReturn', '-');
            setMetric('tradeCount', '0');
            setMetric('kellyFraction', selectedMode === CAPITAL_MODES.KELLY ? formatPercent(state.kellyFraction) : '不適用');
            return;
        }
        setMetric('averageProfit', simulation.results.length > 0 ? formatCurrency(simulation.averageProfit) : '-');
        setMetric('totalReturn', formatPercent(simulation.totalReturn));
        setMetric('tradeCount', simulation.results.length.toString());
        if (selectedMode === CAPITAL_MODES.KELLY) {
            setMetric('kellyFraction', formatPercent(state.kellyFraction));
        } else {
            setMetric('kellyFraction', '不適用');
        }
        state.trades = simulation.results;
        renderTrades(simulation.results);
        renderEquityChart(state.equityCurves, selectedMode);
    }

    function exportCsv() {
        if (!Array.isArray(state.trades) || state.trades.length === 0) {
            setStatus('目前沒有可匯出的 AI 預測交易。', 'warning');
            return;
        }
        const headers = [
            '買進日期',
            '賣出日期',
            '買進價',
            '賣出價',
            '價格差',
            '報酬率(%)',
            '預測機率(%)',
            '投入資金',
            '損益',
            '預測是否正確',
        ];
        const rows = state.trades.map((trade) => [
            trade.date,
            trade.sellDate || '',
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
                        const acc = Number.isFinite(logs?.acc)
                            ? formatPercent(logs.acc)
                            : (Number.isFinite(logs?.accuracy) ? formatPercent(logs.accuracy) : '');
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
            const kellySimulation = simulateTrades(testTrades.trades, initialCapital, {
                mode: CAPITAL_MODES.KELLY,
                fraction: kelly.fraction,
            });
            const fixedSimulation = simulateTrades(testTrades.trades, initialCapital, {
                mode: CAPITAL_MODES.FIXED,
                fraction: 1,
            });

            state.kellyFraction = kelly.fraction;
            state.initialCapital = initialCapital;
            state.tradeCandidates = testTrades.trades;
            state.simulations = {
                [CAPITAL_MODES.KELLY]: kellySimulation,
                [CAPITAL_MODES.FIXED]: fixedSimulation,
            };
            state.equityCurves = buildEquityCurves(split.test.meta, initialCapital, state.simulations);

            setMetric('trainAccuracy', formatPercent(trainAccuracy));
            setMetric('trainWinRate', formatPercent(trainTrades.winRate));
            setMetric('testAccuracy', formatPercent(testAccuracy));
            setMetric('testWinRate', formatPercent(testTrades.winRate));

            const selectedMode = state.elements.capitalMode?.value === CAPITAL_MODES.FIXED
                ? CAPITAL_MODES.FIXED
                : CAPITAL_MODES.KELLY;
            state.elements.capitalMode.value = selectedMode;
            applySimulationMode(selectedMode);

            if (!state.tradeCandidates.length) {
                setStatus('模型於測試集未找到符合條件且能成交的做多機會。', 'warning');
            } else {
                const summary = `AI 預測完成，測試集共成交 ${state.tradeCandidates.length} 筆交易，凱利建議投入 ${formatPercent(state.kellyFraction)}。`;
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
        state.elements.capitalMode = getElement('aiCapitalMode');
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
        if (state.elements.capitalMode) {
            state.elements.capitalMode.addEventListener('change', (event) => {
                applySimulationMode(event.target.value);
            });
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
