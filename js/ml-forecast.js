/* global Chart, cachedStockData, showError, lastFetchSettings */
(() => {
    'use strict';

    const MODULE_VERSION = 'LB-ML-KELLY-20251209A';
    window.lazybacktestMlForecastVersion = MODULE_VERSION;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const mean = (arr) => (arr && arr.length ? arr.reduce((acc, val) => acc + val, 0) / arr.length : 0);
    const std = (arr) => {
        if (!arr || arr.length <= 1) return 0;
        const mu = mean(arr);
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - mu, 2), 0) / arr.length;
        return Math.sqrt(variance);
    };

    const computeRsi = (closes, period = 14) => {
        const output = Array(closes.length).fill(null);
        if (closes.length <= period) return output;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i += 1) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change; else losses -= change;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        output[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        for (let i = period + 1; i < closes.length; i += 1) {
            const change = closes[i] - closes[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
            output[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        }
        return output;
    };

    const buildFeatures = (rows) => {
        const closes = rows.map((row) => Number(row.close));
        const volatility20 = rows.map((_, idx) => {
            const start = Math.max(0, idx - 19);
            const slice = closes.slice(start, idx + 1);
            return std(slice);
        });
        const rsi14 = computeRsi(closes, 14);
        const sma20 = rows.map((_, idx) => {
            if (idx < 19) return null;
            const start = idx - 19;
            const slice = closes.slice(start, idx + 1);
            return mean(slice);
        });

        const results = {
            X: [],
            y: [],
            yRet: [],
            tradeDates: [],
        };

        const computeReturn = (lag, index) => {
            if (index - lag < 0) return null;
            const base = closes[index - lag];
            return base ? (closes[index] - base) / base : null;
        };

        for (let i = 21; i < rows.length - 1; i += 1) {
            const ret1 = computeReturn(1, i);
            const ret3 = computeReturn(3, i);
            const ret5 = computeReturn(5, i);
            const vol = volatility20[i];
            const rsi = rsi14[i];
            const sma = sma20[i];
            if ([ret1, ret3, ret5, vol, rsi, sma].some((val) => val === null || Number.isNaN(val))) continue;
            const gap = sma === 0 ? 0 : (closes[i] - sma) / sma;
            const nextReturn = (closes[i + 1] - closes[i]) / closes[i];
            results.X.push([ret1, ret3, ret5, vol, rsi / 100, gap]);
            results.y.push(nextReturn > 0 ? 1 : 0);
            results.yRet.push(nextReturn);
            results.tradeDates.push(rows[i + 1].date);
        }

        return results;
    };

    const standardize = (matrix) => {
        const cols = matrix[0].length;
        const mu = Array(cols).fill(0);
        const sigma = Array(cols).fill(0);
        for (let j = 0; j < cols; j += 1) {
            const column = matrix.map((row) => row[j]);
            mu[j] = mean(column);
            const deviation = std(column);
            sigma[j] = deviation === 0 ? 1e-8 : deviation;
        }
        const normalized = matrix.map((row) => row.map((value, idx) => (value - mu[idx]) / sigma[idx]));
        return { normalized, mu, sigma };
    };

    const applyStandardization = (row, mu, sigma) => row.map((value, idx) => (value - mu[idx]) / sigma[idx]);

    const trainLogisticRegression = (features, labels, options) => {
        const settings = Object.assign({ lr: 0.05, epochs: 150 }, options || {});
        const weights = Array(features[0].length).fill(0);
        let bias = 0;
        const sigmoid = (z) => 1 / (1 + Math.exp(-z));

        for (let epoch = 0; epoch < settings.epochs; epoch += 1) {
            for (let i = 0; i < features.length; i += 1) {
                const z = features[i].reduce((acc, value, idx) => acc + (weights[idx] * value), bias);
                const prediction = sigmoid(z);
                const error = prediction - labels[i];
                for (let j = 0; j < weights.length; j += 1) {
                    weights[j] -= settings.lr * error * features[i][j];
                }
                bias -= settings.lr * error;
            }
        }

        return {
            weights,
            bias,
            predict(row) {
                const z = row.reduce((acc, value, idx) => acc + (weights[idx] * value), bias);
                return 1 / (1 + Math.exp(-z));
            },
        };
    };

    const fitThreshold = (probabilities, labels, returns) => {
        let best = { threshold: 0.5, accuracy: 0, avgUp: 0, avgDown: 0, samples: 0 };
        for (let thr = 0.35; thr <= 0.65; thr += 0.01) {
            const picks = [];
            for (let i = 0; i < probabilities.length; i += 1) {
                if (probabilities[i] >= thr) {
                    picks.push({
                        correct: labels[i] === 1,
                        ret: returns[i],
                    });
                }
            }
            if (picks.length < 20) continue;
            const accuracy = mean(picks.map((item) => (item.correct ? 1 : 0)));
            const ups = picks.filter((item) => item.ret > 0).map((item) => item.ret);
            const downs = picks.filter((item) => item.ret <= 0).map((item) => item.ret);
            const avgUp = ups.length ? mean(ups) : 0;
            const avgDown = downs.length ? mean(downs) : 0;
            if (accuracy > best.accuracy) {
                best = { threshold: Number(thr.toFixed(2)), accuracy, avgUp, avgDown, samples: picks.length };
            }
        }
        return best;
    };

    const kellyFraction = (probability, avgUp, avgDown, multiplier, cap) => {
        if (!(avgUp > 0) || !(avgDown < 0)) return 0;
        const edge = avgUp / Math.abs(avgDown);
        const raw = probability - ((1 - probability) / Math.max(edge, 1e-8));
        if (!Number.isFinite(raw)) return 0;
        return clamp(raw * multiplier, 0, cap);
    };

    const simulate = (probabilities, returns, dates, avgUp, avgDown, threshold, multiplier, cap) => {
        let mlEquity = 1;
        let bhEquity = 1;
        const equitySeries = [];
        const bhSeries = [];
        const trades = [];

        for (let i = 0; i < probabilities.length; i += 1) {
            const prob = probabilities[i];
            const dailyReturn = returns[i];
            const labelDate = dates[i];

            bhEquity *= (1 + dailyReturn);

            if (prob >= threshold) {
                const fraction = kellyFraction(prob, avgUp, avgDown, multiplier, cap);
                const growth = 1 + (fraction * dailyReturn);
                mlEquity *= growth > 0 ? growth : 0;
                trades.push({
                    date: labelDate,
                    probability: prob,
                    fraction,
                    dayReturn: dailyReturn,
                    pnl: fraction * dailyReturn,
                });
            }

            equitySeries.push({ date: labelDate, equity: mlEquity });
            bhSeries.push({ date: labelDate, equity: bhEquity });
        }

        return { mlEquity, bhEquity, equitySeries, bhSeries, trades };
    };

    const renderCards = (container, summary) => {
        if (!container) return;
        const cards = [
            {
                title: '訓練最佳門檻',
                main: summary.threshold.toFixed(2),
                note: `命中率 ${(summary.trainAccuracy * 100).toFixed(1)}%（樣本 ${summary.samples}）`,
                mainClass: 'text-lg font-semibold',
            },
            {
                title: '平均漲幅 / 跌幅',
                main: `${(summary.avgUp * 100).toFixed(2)}% / ${(summary.avgDown * 100).toFixed(2)}%`,
                note: '基於訓練集中符合門檻的樣本',
                mainClass: 'text-sm font-semibold',
            },
            {
                title: '測試命中率',
                main: `${(summary.testAccuracy * 100).toFixed(1)}%`,
                note: `平均建議持倉 ${(summary.avgKelly * 100).toFixed(1)}%`,
                mainClass: 'text-lg font-semibold',
            },
            {
                title: '累積報酬（測試）',
                main: `ML+Kelly ${(summary.mlReturn * 100).toFixed(2)}%`,
                note: `買進持有 ${(summary.bhReturn * 100).toFixed(2)}%`,
                mainClass: 'text-sm font-semibold',
            },
        ];
        container.innerHTML = cards.map((card) => `
            <div class="p-3 border rounded-lg bg-white shadow-sm space-y-1" style="border-color: var(--border);">
                <div class="text-[11px] font-medium" style="color: var(--muted-foreground);">${card.title}</div>
                <div class="${card.mainClass || 'text-sm font-semibold'}" style="color: var(--foreground);">${card.main}</div>
                <div class="text-[11px]" style="color: var(--muted-foreground);">${card.note}</div>
            </div>
        `).join('');
    };

    const renderTrades = (container, trades) => {
        if (!container) return;
        if (!trades.length) {
            container.innerHTML = '<div class="text-[11px]" style="color: var(--muted-foreground);">測試期間沒有達到門檻的交易。</div>';
            return;
        }
        const rows = trades.map((trade) => {
            const direction = trade.dayReturn >= 0 ? '上漲' : '下跌';
            return `
                <div class="ml-trade-entry">
                    <strong>${trade.date} ｜ ${direction}</strong>
                    <span>P(上漲) ${trade.probability.toFixed(2)} ｜ 凱利倉位 ${(trade.fraction * 100).toFixed(1)}%</span>
                    <span>隔日報酬 ${(trade.dayReturn * 100).toFixed(2)}% ｜ 損益 ${(trade.pnl * 100).toFixed(2)}%</span>
                </div>
            `;
        });
        container.innerHTML = rows.join('');
    };

    const renderCharts = (equityCanvas, histogramCanvas, equitySeries, bhSeries, probabilities) => {
        if (!equityCanvas || !histogramCanvas || typeof Chart === 'undefined') return;

        if (window.lazybacktestMlEquityChart) {
            window.lazybacktestMlEquityChart.destroy();
        }
        if (window.lazybacktestMlProbChart) {
            window.lazybacktestMlProbChart.destroy();
        }

        const labels = equitySeries.map((item) => item.date);
        window.lazybacktestMlEquityChart = new Chart(equityCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'ML + Kelly',
                        data: equitySeries.map((item) => item.equity),
                        borderColor: '#2563eb',
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.1,
                    },
                    {
                        label: '買進持有',
                        data: bhSeries.map((item) => item.equity),
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'logarithmic',
                        ticks: {
                            callback(value) {
                                if (value === 0) return '0';
                                return Number(value).toFixed(2);
                            },
                        },
                    },
                },
                plugins: {
                    legend: { position: 'bottom' },
                },
            },
        });

        const bins = Array(11).fill(0);
        probabilities.forEach((prob) => {
            const index = Math.max(0, Math.min(10, Math.floor(prob * 10)));
            bins[index] += 1;
        });

        window.lazybacktestMlProbChart = new Chart(histogramCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: bins.map((_, idx) => `${(idx / 10).toFixed(1)}–${((idx + 1) / 10).toFixed(1)}`),
                datasets: [
                    {
                        label: 'P(上漲)',
                        data: bins,
                        backgroundColor: '#64748b',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
            },
        });
    };

    const withinRange = (date, start, end) => (!start || date >= start) && (!end || date <= end);

    const collectInputs = () => {
        const pick = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };
        return {
            trainStart: pick('ml-train-start'),
            trainEnd: pick('ml-train-end'),
            testStart: pick('ml-test-start'),
            testEnd: pick('ml-test-end'),
            lr: Number(pick('ml-lr') || 0.05),
            epochs: Number(pick('ml-epochs') || 150),
            kellyMultiplier: Number(pick('ml-kelly-mult') || 0.5),
            maxFraction: Number(pick('ml-max-f') || 25) / 100,
        };
    };

    const populateDefaultDates = () => {
        const setIfEmpty = (id, value) => {
            const el = document.getElementById(id);
            if (el && !el.value && value) {
                el.value = value;
            }
        };

        const tryFromSettings = () => {
            if (!window.lastFetchSettings) return false;
            const { startDate, endDate } = window.lastFetchSettings;
            if (!startDate || !endDate) return false;
            const dataRows = Array.isArray(cachedStockData) ? cachedStockData : [];
            const allDates = dataRows.map((row) => row.date).filter(Boolean);
            const splitIndex = Math.max(0, Math.floor(allDates.length * 0.7) - 1);
            const splitDate = allDates[splitIndex] || startDate;
            const testStart = allDates[splitIndex + 1] || splitDate;
            setIfEmpty('ml-train-start', startDate);
            setIfEmpty('ml-train-end', splitDate);
            setIfEmpty('ml-test-start', testStart);
            setIfEmpty('ml-test-end', endDate);
            return true;
        };

        if (tryFromSettings()) return;

        const rows = Array.isArray(cachedStockData) ? cachedStockData : [];
        if (!rows.length) return;
        const dates = rows.map((row) => row.date).filter(Boolean);
        if (!dates.length) return;
        const start = dates[0];
        const end = dates[dates.length - 1];
        const splitIndex = Math.max(0, Math.floor(dates.length * 0.7) - 1);
        const split = dates[splitIndex] || start;
        const testStart = dates[splitIndex + 1] || split;
        setIfEmpty('ml-train-start', start);
        setIfEmpty('ml-train-end', split);
        setIfEmpty('ml-test-start', testStart);
        setIfEmpty('ml-test-end', end);
    };

    const runForecast = () => {
        if (!Array.isArray(cachedStockData) || cachedStockData.length < 80) {
            if (typeof showError === 'function') {
                showError('請先在主回測分頁執行一次，以建立足夠的快取資料供預測機制使用。');
            }
            return;
        }

        const inputs = collectInputs();
        const rows = cachedStockData
            .map((row) => ({
                date: row.date,
                open: Number(row.open),
                high: Number(row.high),
                low: Number(row.low),
                close: Number(row.close),
                volume: Number(row.volume),
            }))
            .filter((row) => Number.isFinite(row.close));

        const { X, y, yRet, tradeDates } = buildFeatures(rows);
        if (!X.length) {
            if (typeof showError === 'function') {
                showError('可用的特徵樣本不足，請調整日期或確認快取資料。');
            }
            return;
        }

        const maskTrain = tradeDates.map((date) => withinRange(date, inputs.trainStart, inputs.trainEnd));
        const maskTest = tradeDates.map((date) => withinRange(date, inputs.testStart, inputs.testEnd));

        const Xtrain = X.filter((_, idx) => maskTrain[idx]);
        const yTrain = y.filter((_, idx) => maskTrain[idx]);
        const rTrain = yRet.filter((_, idx) => maskTrain[idx]);
        const Xtest = X.filter((_, idx) => maskTest[idx]);
        const yTest = y.filter((_, idx) => maskTest[idx]);
        const rTest = yRet.filter((_, idx) => maskTest[idx]);
        const dTest = tradeDates.filter((_, idx) => maskTest[idx]);

        if (Xtrain.length < 100 || Xtest.length < 50) {
            if (typeof showError === 'function') {
                showError('訓練或測試樣本太少，請調整區間或延長日期範圍。');
            }
            return;
        }

        const { normalized: Ztrain, mu, sigma } = standardize(Xtrain);
        const model = trainLogisticRegression(Ztrain, yTrain, { lr: inputs.lr, epochs: inputs.epochs });
        const trainProb = Ztrain.map((row) => model.predict(row));
        const { threshold, accuracy, avgUp, avgDown, samples } = fitThreshold(trainProb, yTrain, rTrain);

        const Ztest = Xtest.map((row) => applyStandardization(row, mu, sigma));
        const testProb = Ztest.map((row) => model.predict(row));

        const { mlEquity, bhEquity, equitySeries, bhSeries, trades } = simulate(
            testProb,
            rTest,
            dTest,
            avgUp,
            avgDown,
            threshold,
            inputs.kellyMultiplier,
            inputs.maxFraction,
        );

        const classify = (prob) => (prob >= threshold ? 1 : 0);
        const testAccuracy = mean(testProb.map((prob, idx) => (classify(prob) === yTest[idx] ? 1 : 0)));
        const filteredTrainProb = trainProb.filter((prob) => prob >= threshold);
        const avgKelly = (avgUp > 0 && avgDown < 0 && filteredTrainProb.length)
            ? clamp(
                mean(filteredTrainProb.map((prob) => prob - ((1 - prob) / Math.max(avgUp / Math.abs(avgDown), 1e-8))))
                    * inputs.kellyMultiplier,
                0,
                inputs.maxFraction,
            )
            : 0;

        renderCards(document.getElementById('ml-cards'), {
            threshold,
            trainAccuracy: accuracy,
            samples,
            avgUp,
            avgDown,
            testAccuracy,
            avgKelly,
            mlReturn: mlEquity - 1,
            bhReturn: bhEquity - 1,
        });

        renderCharts(
            document.getElementById('ml-equity-chart'),
            document.getElementById('ml-prob-hist'),
            equitySeries,
            bhSeries,
            testProb,
        );

        renderTrades(document.getElementById('ml-trades'), trades);
    };

    document.addEventListener('DOMContentLoaded', () => {
        populateDefaultDates();
        const tradeContainer = document.getElementById('ml-trades');
        if (tradeContainer) {
            tradeContainer.innerHTML = '<div class="text-[11px]" style="color: var(--muted-foreground);">請先設定區間並按下「訓練 + 回測」，結果將顯示於此。</div>';
        }
        const runButton = document.getElementById('ml-run');
        if (runButton) {
            runButton.addEventListener('click', () => {
                try {
                    runForecast();
                } catch (error) {
                    console.error('[LazyBacktest][ML Forecast] unexpected error', error);
                    if (typeof showError === 'function') {
                        showError(`預測流程發生錯誤：${error && error.message ? error.message : error}`);
                    }
                }
            });
        }
    });
})();
