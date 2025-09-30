// --- AI 預測模組 - v1.0 ---
// Patch Tag: LB-AI-PREDICTION-20251212A
/* global cachedStockData */

(function() {
    'use strict';

    const VERSION = 'LB-AI-PREDICTION-20251212A';

    const state = {
        version: VERSION,
        running: false,
        lastSummary: null,
    };

    const elements = {
        panel: null,
        status: null,
        progress: null,
        trainBtn: null,
        lookback: null,
        epochs: null,
        initialCapital: null,
        threshold: null,
        enableKelly: null,
        metrics: {
            trainAccuracy: null,
            testAccuracy: null,
            trainWinRate: null,
            nextProbability: null,
            nextDirection: null,
            nextKelly: null,
            averageReturn: null,
            totalReturn: null,
            sampleSize: null,
        },
        notes: null,
        tradeSummary: null,
        tradeTable: null,
        tradeEmpty: null,
    };

    function init() {
        if (typeof document === 'undefined') return;
        elements.panel = document.getElementById('ai-prediction-panel');
        if (!elements.panel) return;

        elements.status = document.getElementById('ai-prediction-status');
        elements.progress = document.getElementById('ai-train-progress');
        elements.trainBtn = document.getElementById('ai-train-btn');
        elements.lookback = document.getElementById('ai-lookback');
        elements.epochs = document.getElementById('ai-epochs');
        elements.initialCapital = document.getElementById('ai-initial-capital');
        elements.threshold = document.getElementById('ai-threshold');
        elements.enableKelly = document.getElementById('ai-enable-kelly');
        elements.notes = document.getElementById('ai-result-notes');
        elements.tradeSummary = document.getElementById('ai-trade-summary');
        elements.tradeTable = document.getElementById('ai-trade-table');
        elements.tradeEmpty = document.getElementById('ai-trade-empty');

        elements.metrics.trainAccuracy = document.getElementById('ai-train-accuracy');
        elements.metrics.testAccuracy = document.getElementById('ai-test-accuracy');
        elements.metrics.trainWinRate = document.getElementById('ai-train-winrate');
        elements.metrics.nextProbability = document.getElementById('ai-next-probability');
        elements.metrics.nextDirection = document.getElementById('ai-next-direction');
        elements.metrics.nextKelly = document.getElementById('ai-next-kelly');
        elements.metrics.averageReturn = document.getElementById('ai-average-return');
        elements.metrics.totalReturn = document.getElementById('ai-total-return');
        elements.metrics.sampleSize = document.getElementById('ai-sample-size');

        if (elements.trainBtn) {
            elements.trainBtn.addEventListener('click', handleTrainClick);
        }

        if (elements.enableKelly) {
            elements.enableKelly.addEventListener('change', () => {
                updateKellyHintVisibility();
            });
        }

        updateKellyHintVisibility();
        updateStatus('請先於主分頁執行一次回測，建立可用的價格資料。', 'muted');
    }

    function updateKellyHintVisibility() {
        const hint = document.getElementById('ai-kelly-hint');
        if (!hint || !elements.enableKelly) return;
        if (elements.enableKelly.checked) {
            hint.classList.remove('hidden');
        } else {
            hint.classList.add('hidden');
        }
    }

    function handleTrainClick(event) {
        if (event) event.preventDefault();
        if (state.running) return;

        const rows = Array.isArray(cachedStockData) ? cachedStockData : null;
        if (!rows || rows.length < 60) {
            updateStatus('尚未偵測到可用的回測資料，請先完成一次回測。', 'error');
            return;
        }

        if (typeof tf === 'undefined' || !tf?.sequential) {
            updateStatus('TensorFlow.js 尚未載入，請確認網路連線後重試。', 'error');
            return;
        }

        const lookback = clampNumber(parseInt(elements.lookback?.value, 10), 10, 180, 30);
        const epochs = clampNumber(parseInt(elements.epochs?.value, 10), 10, 300, 40);
        const initialCapital = clampNumber(parseFloat(elements.initialCapital?.value), 1, Number.MAX_SAFE_INTEGER, 100000);
        const threshold = clampNumber(parseFloat(elements.threshold?.value), 0.5, 0.95, 0.55);
        const useKelly = Boolean(elements.enableKelly?.checked);

        elements.lookback.value = lookback;
        elements.epochs.value = epochs;
        elements.initialCapital.value = Math.round(initialCapital);
        elements.threshold.value = threshold.toFixed(2);

        state.running = true;
        toggleTrainButton(true);
        updateStatus('開始訓練 LSTM 模型，請稍候...', 'info');
        setProgress('模型初始化中...');

        trainLstmModel({ lookback, epochs, initialCapital, threshold, useKelly })
            .then((summary) => {
                state.lastSummary = summary;
                renderSummary(summary);
                updateStatus('AI 預測完成，可於下方檢視測試結果與模擬交易。', 'success');
            })
            .catch((error) => {
                console.error('[AI Prediction] Failed to train model:', error);
                const message = error?.message || 'AI 預測過程發生未知錯誤。';
                updateStatus(message, 'error');
            })
            .finally(() => {
                clearProgress();
                toggleTrainButton(false);
                state.running = false;
            });
    }

    function toggleTrainButton(disabled) {
        if (!elements.trainBtn) return;
        elements.trainBtn.disabled = Boolean(disabled);
        if (disabled) {
            elements.trainBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-sm animate-spin"></i><span>訓練中...</span>';
        } else {
            elements.trainBtn.innerHTML = '<i data-lucide="rocket" class="lucide-sm"></i><span>開始訓練與回測</span>';
        }
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function updateStatus(message, tone) {
        if (!elements.status) return;
        const palette = {
            success: 'var(--primary)',
            info: 'var(--primary)',
            warning: 'var(--secondary)',
            error: 'var(--destructive)',
            muted: 'var(--muted-foreground)',
        };
        elements.status.textContent = message;
        const color = palette[tone] || palette.muted;
        elements.status.style.color = color;
        elements.status.style.backgroundColor = tone === 'error'
            ? 'color-mix(in srgb, var(--destructive) 12%, transparent)'
            : 'color-mix(in srgb, var(--card) 85%, transparent)';
    }

    function setProgress(message) {
        if (!elements.progress) return;
        elements.progress.textContent = message;
        elements.progress.classList.remove('hidden');
    }

    function clearProgress() {
        if (!elements.progress) return;
        elements.progress.classList.add('hidden');
        elements.progress.textContent = '';
    }

    async function trainLstmModel(options) {
        const { lookback, epochs, initialCapital, threshold, useKelly } = options;
        const dataset = buildDataset(Array.isArray(cachedStockData) ? cachedStockData : [], lookback);
        if (!dataset || dataset.features.length < 40) {
            throw new Error('資料筆數不足，請延長回測區間或降低序列長度。');
        }

        const totalSamples = dataset.features.length;
        const trainSize = Math.max(Math.floor((totalSamples * 2) / 3), 1);
        const testSize = totalSamples - trainSize;
        if (trainSize < 20 || testSize < 10) {
            throw new Error('資料尚不足以進行 2:1 訓練／測試切分，請增加歷史資料或縮短序列長度。');
        }

        const trainData = {
            features: dataset.features.slice(0, trainSize),
            labels: dataset.labels.slice(0, trainSize),
            meta: dataset.meta.slice(0, trainSize),
        };
        const testData = {
            features: dataset.features.slice(trainSize),
            labels: dataset.labels.slice(trainSize),
            meta: dataset.meta.slice(trainSize),
        };

        const trainStats = computeReturnStats(trainData.meta);
        const batchSize = Math.max(8, Math.min(64, Math.floor(trainSize / 4)));
        const model = createModel(lookback);

        const trainTensors = toTensors(trainData.features, trainData.labels);
        const testTensors = toTensors(testData.features, testData.labels);

        const history = await model.fit(trainTensors.xs, trainTensors.ys, {
            epochs,
            batchSize,
            shuffle: false,
            validationSplit: 0.15,
            callbacks: {
                onEpochEnd: async (epoch, logs) => {
                    const accuracy = pickMetric(logs, ['acc', 'accuracy']);
                    setProgress(`第 ${epoch + 1} / ${epochs} 輪：loss=${formatNumber(logs?.loss)}, acc=${formatPercent(accuracy)}`);
                    await tf.nextFrame();
                },
            },
        });

        const evaluation = model.evaluate(testTensors.xs, testTensors.ys, {
            batchSize: Math.max(8, Math.floor(testSize / 4)),
            verbose: 0,
        });

        const evalArray = Array.isArray(evaluation) ? evaluation : [evaluation];
        const testLoss = await tensorToNumber(evalArray[0]);
        const testAccuracy = await tensorToNumber(evalArray[1]);

        const predictionsTensor = model.predict(testTensors.xs);
        const predictions = await predictionsTensor.array();
        predictionsTensor.dispose();

        const simulation = simulateTrades(predictions, testData, {
            threshold,
            initialCapital,
            useKelly,
            trainStats,
        });

        let nextPrediction = null;
        if (Array.isArray(dataset.nextWindow) && dataset.nextWindow.length === lookback) {
            const nextTensor = tf.tensor3d([dataset.nextWindow.map((value) => [value])]);
            const probTensor = model.predict(nextTensor);
            const probArray = await probTensor.array();
            const probability = probArray?.[0]?.[0];
            const kellyFraction = useKelly ? computeKellyFraction(probability, trainStats.avgGain, trainStats.avgLoss) : null;
            nextPrediction = {
                probability,
                direction: Number.isFinite(probability) && probability >= threshold ? 'up' : 'down',
                kellyFraction,
                lastDate: dataset.lastDate,
            };
            probTensor.dispose();
            nextTensor.dispose();
        }

        const trainAccuracy = pickLast(history.history, ['acc', 'accuracy']);
        const trainWinRate = trainStats.winRate;
        const valAccuracy = pickLast(history.history, ['val_acc', 'val_accuracy']);

        model.dispose();
        tf.dispose([trainTensors.xs, trainTensors.ys, testTensors.xs, testTensors.ys]);
        evalArray.forEach((tensor) => tensor?.dispose?.());

        return {
            trainAccuracy,
            validationAccuracy: valAccuracy,
            testAccuracy,
            testLoss,
            trainWinRate,
            trainStats,
            simulation,
            nextPrediction,
            totalSamples,
            trainSize,
            testSize,
            lookback,
            threshold,
            epochs,
            useKelly,
        };
    }

    function buildDataset(rows, lookback) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { features: [], labels: [], meta: [], nextWindow: null, lastDate: null };
        }
        const prepared = rows
            .map((row) => ({ date: String(row?.date || ''), close: pickClose(row) }))
            .filter((item) => Number.isFinite(item.close) && item.close > 0 && item.date)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (prepared.length <= lookback) {
            return { features: [], labels: [], meta: [], nextWindow: null, lastDate: prepared.at(-1)?.date || null };
        }

        const features = [];
        const labels = [];
        const meta = [];

        for (let i = lookback; i < prepared.length - 1; i += 1) {
            const window = [];
            let valid = true;
            for (let j = i - lookback + 1; j <= i; j += 1) {
                const prev = prepared[j - 1]?.close;
                const current = prepared[j]?.close;
                if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(current) || current <= 0) {
                    valid = false;
                    break;
                }
                const logReturn = Math.log(current / prev);
                if (!Number.isFinite(logReturn)) {
                    valid = false;
                    break;
                }
                window.push(logReturn);
            }
            if (!valid || window.length !== lookback) continue;

            const entry = prepared[i];
            const exit = prepared[i + 1];
            const label = exit.close > entry.close ? 1 : 0;
            const returnPct = (exit.close - entry.close) / entry.close;

            features.push(window);
            labels.push(label);
            meta.push({
                entryDate: entry.date,
                exitDate: exit.date,
                entryClose: entry.close,
                exitClose: exit.close,
                returnPct,
                actualDirection: label ? 'up' : 'down',
            });
        }

        const nextWindow = buildNextWindow(prepared, lookback);
        const lastDate = prepared.at(-1)?.date || null;

        return { features, labels, meta, nextWindow, lastDate };
    }

    function buildNextWindow(prepared, lookback) {
        if (!Array.isArray(prepared) || prepared.length <= lookback) return null;
        const window = [];
        const start = prepared.length - lookback;
        for (let i = start; i < prepared.length; i += 1) {
            const prev = prepared[i - 1]?.close;
            const current = prepared[i]?.close;
            if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(current) || current <= 0) {
                return null;
            }
            const logReturn = Math.log(current / prev);
            if (!Number.isFinite(logReturn)) return null;
            window.push(logReturn);
        }
        return window;
    }

    function pickClose(row) {
        if (!row || typeof row !== 'object') return null;
        const candidates = ['close', 'adjustedClose', 'adjClose', 'Close', 'closingPrice'];
        for (let i = 0; i < candidates.length; i += 1) {
            const value = Number(row[candidates[i]]);
            if (Number.isFinite(value)) return value;
        }
        return null;
    }

    function toTensors(featureList, labelList) {
        const xs = tf.tensor3d(featureList.map((window) => window.map((value) => [value])));
        const ys = tf.tensor2d(labelList.map((label) => [label]));
        return { xs, ys };
    }

    function createModel(lookback) {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 32, inputShape: [lookback, 1], returnSequences: false }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });
        return model;
    }

    function computeReturnStats(meta) {
        const gains = [];
        const losses = [];
        meta.forEach((item) => {
            if (!item) return;
            if (item.returnPct > 0) gains.push(item.returnPct);
            else if (item.returnPct < 0) losses.push(Math.abs(item.returnPct));
        });
        const avgGain = gains.length > 0 ? gains.reduce((sum, value) => sum + value, 0) / gains.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0;
        const winRate = meta.length > 0 ? gains.length / meta.length : 0;
        return { avgGain, avgLoss, winRate };
    }

    function simulateTrades(predictions, testData, options) {
        const { threshold, initialCapital, useKelly, trainStats } = options;
        const trades = [];
        const capitalStart = Number.isFinite(initialCapital) && initialCapital > 0 ? initialCapital : 100000;
        let capital = capitalStart;
        let executed = 0;
        let wins = 0;
        let losses = 0;
        let totalReturn = 0;
        let totalProb = 0;

        for (let i = 0; i < predictions.length; i += 1) {
            const probability = Array.isArray(predictions[i]) ? predictions[i][0] : predictions[i];
            const meta = testData.meta[i];
            if (!meta || !Number.isFinite(probability)) continue;

            if (probability < threshold) continue;

            let fraction = 1;
            let kellySuggested = null;
            if (useKelly) {
                kellySuggested = computeKellyFraction(probability, trainStats.avgGain, trainStats.avgLoss);
                if (!Number.isFinite(kellySuggested)) {
                    fraction = 0;
                } else {
                    fraction = clampNumber(kellySuggested, 0, 1, 0);
                }
            }

            if (fraction <= 0) {
                trades.push({
                    entryDate: meta.entryDate,
                    exitDate: meta.exitDate,
                    entryClose: meta.entryClose,
                    exitClose: meta.exitClose,
                    returnPct: meta.returnPct,
                    probability,
                    investFraction: 0,
                    kellySuggested,
                    pnl: 0,
                    capitalAfter: capital,
                });
                continue;
            }

            const investAmount = capital * fraction;
            const pnl = investAmount * meta.returnPct;
            capital += pnl;
            executed += 1;
            totalReturn += meta.returnPct;
            totalProb += probability;
            if (meta.returnPct > 0) wins += 1;
            else if (meta.returnPct < 0) losses += 1;

            trades.push({
                entryDate: meta.entryDate,
                exitDate: meta.exitDate,
                entryClose: meta.entryClose,
                exitClose: meta.exitClose,
                returnPct: meta.returnPct,
                probability,
                investFraction: fraction,
                kellySuggested,
                pnl,
                capitalAfter: capital,
            });
        }

        const averageReturn = executed > 0 ? totalReturn / executed : 0;
        const totalReturnPct = capitalStart > 0 ? (capital - capitalStart) / capitalStart : 0;
        const averageProbability = executed > 0 ? totalProb / executed : 0;

        return {
            trades,
            capitalStart,
            capitalEnd: capital,
            executed,
            wins,
            losses,
            averageReturn,
            totalReturnPct,
            averageProbability,
            threshold,
        };
    }

    function computeKellyFraction(probability, avgGain, avgLoss) {
        if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null;
        if (!Number.isFinite(avgGain) || avgGain <= 0 || !Number.isFinite(avgLoss) || avgLoss <= 0) return null;
        const b = avgGain / avgLoss;
        if (!Number.isFinite(b) || b <= 0) return null;
        const q = 1 - probability;
        const numerator = (b * probability) - q;
        const fraction = numerator / b;
        return fraction;
    }

    function renderSummary(summary) {
        if (!summary) return;
        const { metrics } = elements;

        setMetric(metrics.trainAccuracy, formatPercent(summary.trainAccuracy));
        setMetric(metrics.testAccuracy, formatPercent(summary.testAccuracy));
        setMetric(metrics.trainWinRate, formatPercent(summary.trainWinRate));

        if (summary.nextPrediction && Number.isFinite(summary.nextPrediction.probability)) {
            setMetric(metrics.nextProbability, formatPercent(summary.nextPrediction.probability));
            const directionLabel = summary.nextPrediction.direction === 'up' ? '偏向看多' : '偏向觀望';
            setMetric(metrics.nextDirection, directionLabel);
            const kellyValue = Number.isFinite(summary.nextPrediction.kellyFraction)
                ? formatPercent(summary.nextPrediction.kellyFraction)
                : (summary.useKelly ? '不足以投入' : '—');
            setMetric(metrics.nextKelly, kellyValue);
        } else {
            setMetric(metrics.nextProbability, '—');
            setMetric(metrics.nextDirection, '—');
            setMetric(metrics.nextKelly, summary.useKelly ? '—' : '未啟用');
        }

        setMetric(metrics.averageReturn, formatPercent(summary.simulation.averageReturn));
        setMetric(metrics.totalReturn, formatPercent(summary.simulation.totalReturnPct));
        setMetric(metrics.sampleSize, `${summary.testSize} 筆`);

        if (elements.notes) {
            const valAccText = Number.isFinite(summary.validationAccuracy)
                ? `驗證集準確率 ${formatPercent(summary.validationAccuracy)}`
                : '驗證集準確率不足資料';
            elements.notes.textContent = `資料共 ${summary.totalSamples} 筆，訓練集 ${summary.trainSize} 筆、測試集 ${summary.testSize} 筆；${valAccText}，測試集 loss=${formatNumber(summary.testLoss)}。`;
        }

        renderTrades(summary.simulation);
    }

    function renderTrades(simulation) {
        if (!elements.tradeTable || !elements.tradeSummary) return;
        const { trades } = simulation;
        elements.tradeTable.innerHTML = '';

        if (!Array.isArray(trades) || trades.length === 0) {
            elements.tradeSummary.textContent = '尚未產生符合進場條件的交易紀錄，請調整門檻或延長資料區間。';
            if (elements.tradeEmpty) elements.tradeEmpty.classList.remove('hidden');
            return;
        }

        if (elements.tradeEmpty) elements.tradeEmpty.classList.add('hidden');

        const fragment = document.createDocumentFragment();
        trades.forEach((trade) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${trade.entryDate || '—'}</td>
                <td class="px-3 py-2">${trade.exitDate || '—'}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.entryClose)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.exitClose)}</td>
                <td class="px-3 py-2 text-right">${formatPercent(trade.returnPct)}</td>
                <td class="px-3 py-2 text-right">${formatPercent(trade.probability)}</td>
                <td class="px-3 py-2 text-right">${formatPercent(trade.investFraction)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.pnl)}</td>
                <td class="px-3 py-2 text-right">${formatCurrency(trade.capitalAfter)}</td>
            `;
            fragment.appendChild(tr);
        });
        elements.tradeTable.appendChild(fragment);

        const winRate = simulation.executed > 0 ? simulation.wins / simulation.executed : 0;
        const avgProb = simulation.averageProbability;
        elements.tradeSummary.textContent = `共模擬 ${trades.length} 筆交易（實際執行 ${simulation.executed} 筆），勝率 ${formatPercent(winRate)}，平均預測上漲機率 ${formatPercent(avgProb)}，累積報酬率 ${formatPercent(simulation.totalReturnPct)}。`;
    }

    function setMetric(element, value) {
        if (!element) return;
        element.textContent = value ?? '—';
    }

    function pickMetric(logs, keys) {
        if (!logs) return null;
        for (let i = 0; i < keys.length; i += 1) {
            if (Number.isFinite(logs[keys[i]])) return logs[keys[i]];
        }
        return null;
    }

    function pickLast(history, keys) {
        if (!history) return null;
        for (let i = 0; i < keys.length; i += 1) {
            const series = history[keys[i]];
            if (Array.isArray(series) && series.length > 0) {
                return series[series.length - 1];
            }
        }
        return null;
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '—';
        return `${(value * 100).toFixed(2)}%`;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '—';
        return new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(4);
    }

    function clampNumber(value, min, max, fallback) {
        if (!Number.isFinite(value)) return fallback;
        return Math.min(Math.max(value, min), max);
    }

    async function tensorToNumber(tensor) {
        if (!tensor) return null;
        const data = await tensor.data();
        return Number.isFinite(data?.[0]) ? data[0] : null;
    }

    window.aiPrediction = {
        init,
        state,
    };
})();
