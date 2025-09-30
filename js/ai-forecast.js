// --- AI 預測模組 - v1.0 ---
// Patch Tag: LB-AI-FORECAST-20250915A
/* global tf, cachedStockData, getBacktestParams, showError, showInfo, showSuccess, lucide, lastOverallResult */

(function() {
    const state = {
        initialized: false,
        running: false,
        model: null,
        version: 'LB-AI-FORECAST-20250915A',
    };

    const numberFormatter = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const percentFormatter = new Intl.NumberFormat('zh-TW', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

    function init() {
        if (state.initialized) return;
        const tab = document.getElementById('ai-forecast-tab');
        const runBtn = document.getElementById('ai-forecast-run');
        if (!tab || !runBtn) return;

        runBtn.addEventListener('click', handleRunForecast);
        syncDefaultCapital();
        state.initialized = true;
        window.aiForecast = {
            init,
            run: handleRunForecast,
            version: state.version,
        };
    }

    function syncDefaultCapital() {
        const capitalInput = document.getElementById('ai-forecast-capital');
        const mainCapital = document.getElementById('initialCapital');
        if (!capitalInput) return;
        if (capitalInput.value && Number(capitalInput.value) > 0) return;
        if (mainCapital && mainCapital.value && Number(mainCapital.value) > 0) {
            capitalInput.value = mainCapital.value;
        }
    }

    function setStatus(message, tone = 'muted') {
        const statusEl = document.getElementById('ai-forecast-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        let color = 'var(--muted-foreground)';
        if (tone === 'success') color = 'var(--primary)';
        else if (tone === 'error') color = 'var(--destructive)';
        statusEl.style.color = color;
    }

    function toggleRunning(running) {
        const runBtn = document.getElementById('ai-forecast-run');
        if (!runBtn) return;
        runBtn.disabled = running;
        runBtn.classList.toggle('opacity-60', running);
        runBtn.classList.toggle('cursor-not-allowed', running);
    }

    function getDatasetFromCache() {
        if (Array.isArray(cachedStockData) && cachedStockData.length > 0) {
            return cachedStockData;
        }
        if (lastOverallResult && Array.isArray(lastOverallResult.rawDataUsed) && lastOverallResult.rawDataUsed.length > 0) {
            return lastOverallResult.rawDataUsed;
        }
        return null;
    }

    function normalisePriceRows(rows) {
        if (!Array.isArray(rows)) return [];
        const mapped = rows
            .map((row) => {
                const date = typeof row?.date === 'string' ? row.date : null;
                const close = Number(row?.close);
                if (!date || !Number.isFinite(close)) return null;
                return { date, close };
            })
            .filter((row) => row !== null);
        mapped.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        return mapped;
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '—';
        return percentFormatter.format(value);
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '—';
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: 'TWD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) return '—';
        return numberFormatter.format(value);
    }

    function buildMetricCard(title, value, description) {
        const wrapper = document.createElement('div');
        wrapper.className = 'p-4 border rounded-lg bg-white/80 shadow-sm flex flex-col gap-2';
        wrapper.style.borderColor = 'var(--border)';

        const titleEl = document.createElement('div');
        titleEl.className = 'text-xs font-semibold uppercase tracking-wide';
        titleEl.style.color = 'var(--muted-foreground)';
        titleEl.textContent = title;

        const valueEl = document.createElement('div');
        valueEl.className = 'text-2xl font-bold';
        valueEl.style.color = 'var(--foreground)';
        valueEl.textContent = value;

        const descEl = document.createElement('div');
        descEl.className = 'text-[11px] leading-relaxed';
        descEl.style.color = 'var(--muted-foreground)';
        descEl.textContent = description;

        wrapper.append(titleEl, valueEl, descEl);
        return wrapper;
    }

    function sliceTensor(tensor, begin, size) {
        if (!tensor) return null;
        return tensor.slice(begin, size);
    }

    async function handleRunForecast(event) {
        if (event) event.preventDefault();
        if (state.running) return;

        if (typeof tf === 'undefined' || !tf?.layers) {
            showError?.('找不到 TensorFlow.js，請確認網路是否允許載入 CDN。');
            return;
        }

        const rows = getDatasetFromCache();
        if (!Array.isArray(rows) || rows.length === 0) {
            showInfo?.('請先在主畫面執行一次完整回測，建立 AI 預測所需的價格資料。');
            return;
        }

        const lookbackInput = document.getElementById('ai-forecast-lookback');
        const capitalInput = document.getElementById('ai-forecast-capital');
        const thresholdInput = document.getElementById('ai-forecast-threshold');

        const lookback = Math.max(10, Math.min(90, Number(lookbackInput?.value) || 30));
        const capital = Math.max(10000, Number(capitalInput?.value) || 100000);
        const priceThreshold = Math.max(0.5, Number(thresholdInput?.value) || 2);

        const series = normalisePriceRows(rows);
        if (series.length <= lookback + 1) {
            showInfo?.('目前資料筆數不足以建立 LSTM 訓練集，請延長回測日期區間。');
            return;
        }

        if (state.model) {
            try {
                state.model.dispose();
            } catch (disposeError) {
                console.warn('[AI Forecast] Failed to dispose previous model:', disposeError);
            }
            state.model = null;
        }

        state.running = true;
        toggleRunning(true);
        setStatus('準備資料中...');

        const sequences = [];
        const labels = [];
        const meta = [];

        for (let i = lookback; i < series.length - 1; i += 1) {
            const window = [];
            let validWindow = true;
            for (let j = i - lookback; j < i; j += 1) {
                const prev = series[j];
                const next = series[j + 1];
                if (!prev || !next || !Number.isFinite(prev.close) || !Number.isFinite(next.close) || prev.close <= 0) {
                    validWindow = false;
                    break;
                }
                const dailyReturn = (next.close - prev.close) / prev.close;
                window.push(dailyReturn);
            }
            if (!validWindow || window.length !== lookback) continue;
            const today = series[i];
            const tomorrow = series[i + 1];
            const diff = tomorrow.close - today.close;
            const label = diff >= priceThreshold ? 1 : 0;
            sequences.push(window);
            labels.push(label);
            meta.push({
                buyDate: today.date,
                sellDate: tomorrow.date,
                buyPrice: today.close,
                sellPrice: tomorrow.close,
                priceDiff: diff,
                returnRatio: diff / today.close,
            });
        }

        const sampleCount = sequences.length;
        if (sampleCount < 6) {
            showInfo?.('資料有效樣本不足（至少 6 筆）無法切出 2:1 訓練 / 測試集，請延長日期或放寬參數。');
            setStatus('', 'muted');
            toggleRunning(false);
            state.running = false;
            return;
        }

        let trainSize = Math.floor(sampleCount * (2 / 3));
        trainSize = Math.max(2, Math.min(trainSize, sampleCount - 1));
        const testSize = sampleCount - trainSize;
        if (testSize < 1) {
            showInfo?.('測試樣本不足，請調整日期或參數。');
            setStatus('', 'muted');
            toggleRunning(false);
            state.running = false;
            return;
        }

        const featureData = sequences.map((seq) => seq.map((value) => [value]));
        const labelData = labels.map((val) => [val]);

        const tensorDisposables = [];
        let model = null;

        try {
            const featureTensor = tf.tensor3d(featureData);
            const labelTensor = tf.tensor2d(labelData);
            tensorDisposables.push(featureTensor, labelTensor);

            const xTrain = sliceTensor(featureTensor, [0, 0, 0], [trainSize, lookback, 1]);
            const yTrain = sliceTensor(labelTensor, [0, 0], [trainSize, 1]);
            const xTest = sliceTensor(featureTensor, [trainSize, 0, 0], [testSize, lookback, 1]);
            const yTest = sliceTensor(labelTensor, [trainSize, 0], [testSize, 1]);
            tensorDisposables.push(xTrain, yTrain, xTest, yTest);

            model = tf.sequential();
            model.add(tf.layers.lstm({ units: 32, inputShape: [lookback, 1], returnSequences: false }));
            model.add(tf.layers.dropout({ rate: 0.2 }));
            model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
            model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
            model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });

            setStatus('訓練 LSTM 模型中...');
            const batchSize = Math.min(32, Math.max(8, Math.round(trainSize / 3)));
            const epochs = Math.min(80, Math.max(35, Math.round(sampleCount / 2)));
            const validationSplit = trainSize > 30 ? 0.2 : 0;
            const history = await model.fit(xTrain, yTrain, {
                epochs,
                batchSize,
                shuffle: false,
                validationSplit,
                verbose: 0,
            });

            const trainAccuracyHistory = history.history.acc || history.history.accuracy || [];
            const finalTrainAccuracy = trainAccuracyHistory.length > 0 ? trainAccuracyHistory[trainAccuracyHistory.length - 1] : null;

            const trainPredTensor = model.predict(xTrain);
            tensorDisposables.push(trainPredTensor);
            const trainPredictions = await trainPredTensor.array();
            const trainLabels = labels.slice(0, trainSize);
            const trainingMeta = meta.slice(0, trainSize);
            const kellyStats = computeKellyStats(trainPredictions, trainLabels, trainingMeta, priceThreshold);

            const testPredTensor = model.predict(xTest);
            tensorDisposables.push(testPredTensor);
            const testPredictions = await testPredTensor.array();
            const testLabels = labels.slice(trainSize);
            const testMeta = meta.slice(trainSize);

            const testAccuracy = computeClassificationAccuracy(testPredictions, testLabels);
            const testPositivePrecision = computePositivePrecision(testPredictions, testLabels);
            const simulation = runKellySimulation(testPredictions, testMeta, {
                capital,
                priceThreshold,
                kellyFraction: kellyStats.kellyFraction,
            });

            renderResults({
                trainSize,
                testSize,
                finalTrainAccuracy,
                kellyStats,
                testAccuracy,
                testPositivePrecision,
                simulation,
                lookback,
                priceThreshold,
            });

            state.model = model;
            model = null; // 防止 finally dispose
            setStatus('AI 預測完成。', 'success');
            showSuccess?.('AI 預測完成，請檢視右側成果摘要。');
        } catch (error) {
            console.error('[AI Forecast] Failed to run forecast:', error);
            setStatus('AI 預測失敗。', 'error');
            showError?.(`AI 預測失敗：${error?.message || error}`);
        } finally {
            tensorDisposables.forEach((tensor) => {
                try {
                    tensor?.dispose?.();
                } catch (disposeError) {
                    console.warn('[AI Forecast] Tensor dispose error:', disposeError);
                }
            });
            if (model) {
                try {
                    model.dispose();
                } catch (disposeError) {
                    console.warn('[AI Forecast] Model dispose error:', disposeError);
                }
            }
            toggleRunning(false);
            state.running = false;
        }
    }

    function computeKellyStats(predictions, labels, meta, priceThreshold) {
        let predictedTrades = 0;
        let predictedWins = 0;
        const winReturns = [];
        const lossReturns = [];

        predictions.forEach((row, index) => {
            const probability = Array.isArray(row) ? row[0] : row;
            if (!Number.isFinite(probability)) return;
            if (probability < 0.5) return;
            predictedTrades += 1;
            const actual = labels[index];
            const info = meta[index];
            const realized = info ? info.returnRatio : 0;
            if (actual === 1) {
                predictedWins += 1;
                winReturns.push(realized);
            } else {
                lossReturns.push(Math.abs(realized));
            }
        });

        const winProbability = predictedTrades > 0 ? predictedWins / predictedTrades : 0;
        const avgWin = winReturns.length > 0 ? winReturns.reduce((sum, value) => sum + value, 0) / winReturns.length : 0;
        const avgLoss = lossReturns.length > 0 ? lossReturns.reduce((sum, value) => sum + value, 0) / lossReturns.length : 0;
        let kellyFraction;
        if (avgLoss > 1e-6) {
            const b = avgWin > 0 ? avgWin / avgLoss : 0;
            const rawKelly = winProbability - ((1 - winProbability) / Math.max(b, 1e-6));
            kellyFraction = Math.max(0, Math.min(1, rawKelly));
        } else if (predictedTrades > 0) {
            // 若尚未觀察到虧損樣本，採用保守折扣避免過度曝險
            kellyFraction = Math.min(0.25, Math.max(0, winProbability * 0.5));
        } else {
            kellyFraction = 0;
        }

        return {
            winProbability,
            avgWin,
            avgLoss,
            kellyFraction,
            predictedTrades,
            priceThreshold,
        };
    }

    function computeClassificationAccuracy(predictions, labels) {
        if (!predictions || !labels || predictions.length !== labels.length) return null;
        if (predictions.length === 0) return null;
        let correct = 0;
        predictions.forEach((row, index) => {
            const probability = Array.isArray(row) ? row[0] : row;
            const predicted = probability >= 0.5 ? 1 : 0;
            if (predicted === labels[index]) correct += 1;
        });
        return correct / predictions.length;
    }

    function computePositivePrecision(predictions, labels) {
        if (!predictions || !labels || predictions.length !== labels.length) return null;
        let predictedPositives = 0;
        let truePositives = 0;
        predictions.forEach((row, index) => {
            const probability = Array.isArray(row) ? row[0] : row;
            if (!Number.isFinite(probability) || probability < 0.5) return;
            predictedPositives += 1;
            if (labels[index] === 1) {
                truePositives += 1;
            }
        });
        if (predictedPositives === 0) return null;
        return truePositives / predictedPositives;
    }

    function runKellySimulation(predictions, meta, options) {
        const { capital: startingCapital, priceThreshold, kellyFraction } = options;
        let capital = startingCapital;
        const trades = [];

        predictions.forEach((row, index) => {
            const probability = Array.isArray(row) ? row[0] : row;
            if (!Number.isFinite(probability) || probability < 0.5) return;
            const info = meta[index];
            if (!info) return;
            const { buyPrice, sellPrice, buyDate, sellDate, returnRatio, priceDiff } = info;
            if (!Number.isFinite(buyPrice) || buyPrice <= 0 || !Number.isFinite(sellPrice)) return;
            const positionFraction = Math.max(0, Math.min(1, kellyFraction));
            if (positionFraction <= 0) return;
            const positionSize = capital * positionFraction;
            if (positionSize <= 0) return;
            const shares = positionSize / buyPrice;
            const pnl = shares * (sellPrice - buyPrice);
            capital += pnl;
            trades.push({
                buyDate,
                sellDate,
                buyPrice,
                sellPrice,
                probability,
                returnRatio,
                pnl,
                isWin: priceDiff >= priceThreshold,
            });
        });

        const totalPnL = capital - startingCapital;
        const averagePnL = trades.length > 0 ? totalPnL / trades.length : 0;
        const averageReturnRatio = trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.returnRatio, 0) / trades.length : 0;
        const winTrades = trades.filter((trade) => trade.isWin).length;

        return {
            startingCapital,
            finalCapital: capital,
            totalPnL,
            totalReturn: startingCapital > 0 ? totalPnL / startingCapital : 0,
            averagePnL,
            averageReturnRatio,
            trades,
            winRate: trades.length > 0 ? winTrades / trades.length : 0,
        };
    }

    function renderResults(payload) {
        const {
            trainSize,
            testSize,
            finalTrainAccuracy,
            kellyStats,
            testAccuracy,
            testPositivePrecision,
            simulation,
            lookback,
            priceThreshold,
        } = payload;

        const card = document.getElementById('ai-forecast-result-card');
        const summaryEl = document.getElementById('ai-forecast-summary');
        const metricsEl = document.getElementById('ai-forecast-metrics');
        const tradeSummaryEl = document.getElementById('ai-forecast-trade-summary');
        const tradesBody = document.getElementById('ai-forecast-trades');

        if (!card || !summaryEl || !metricsEl || !tradeSummaryEl || !tradesBody) return;

        card.classList.remove('hidden');

        summaryEl.textContent = `樣本 ${trainSize}（訓練） / ${testSize}（測試），觀察視窗 ${lookback} 日，漲幅門檻 ${priceThreshold.toFixed(2)} 元。`;

        metricsEl.innerHTML = '';
        const metricNodes = [
            buildMetricCard('訓練進場勝率', formatPercent(kellyStats.winProbability || 0), '僅統計模型預測進場的訓練樣本。'),
            buildMetricCard('測試整體準確率', formatPercent(testAccuracy || 0), '衡量模型在測試集中判斷漲跌方向的正確率。'),
            buildMetricCard('Kelly 建議投入比例', formatPercent(kellyStats.kellyFraction || 0), '依訓練樣本推估勝率與賠率後的凱利公式結果，並限制於 0-100%。'),
            buildMetricCard('測試期總報酬', formatPercent(simulation.totalReturn || 0), `以凱利比例配置後的最終報酬（起始資金 ${formatCurrency(simulation.startingCapital)}）。`),
        ];
        metricNodes.forEach((node) => metricsEl.appendChild(node));

        const tradeSummaryFragments = [
            `共執行 ${simulation.trades.length} 筆交易`,
            `勝率 ${formatPercent(simulation.winRate || 0)}`,
            `平均單筆報酬 ${formatPercent(simulation.averageReturnRatio || 0)}`,
            `最終資金 ${formatCurrency(simulation.finalCapital)}`,
        ];
        if (Number.isFinite(testPositivePrecision)) {
            tradeSummaryFragments.push(`測試期預測進場精確率 ${formatPercent(testPositivePrecision)}`);
        }
        tradeSummaryEl.innerHTML = tradeSummaryFragments
            .map((text) => `<span class="px-2 py-1 rounded border" style="border-color: var(--border); background-color: color-mix(in srgb, var(--primary) 8%, transparent);">${text}</span>`)
            .join(' ');

        tradesBody.innerHTML = '';
        const maxRows = 30;
        simulation.trades.slice(0, maxRows).forEach((trade) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-2 py-1 whitespace-nowrap">${trade.buyDate}</td>
                <td class="px-2 py-1 whitespace-nowrap">${trade.sellDate}</td>
                <td class="px-2 py-1 text-right">${formatNumber(trade.buyPrice)}</td>
                <td class="px-2 py-1 text-right">${formatNumber(trade.sellPrice)}</td>
                <td class="px-2 py-1 text-right">${formatPercent(trade.probability)}</td>
                <td class="px-2 py-1 text-right ${trade.returnRatio >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatPercent(trade.returnRatio)}</td>
            `;
            tradesBody.appendChild(row);
        });

        if (simulation.trades.length > maxRows) {
            const noteRow = document.createElement('tr');
            noteRow.innerHTML = `<td colspan="6" class="px-2 py-2 text-[11px] text-center" style="color: var(--muted-foreground);">僅顯示前 ${maxRows} 筆交易，詳情請另行匯出資料。</td>`;
            tradesBody.appendChild(noteRow);
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
