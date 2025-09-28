/* global cachedStockData, Chart, tf */

// Patch Tag: LB-FORECAST-LSTM-GA-20250714A
(function forecastModuleBootstrap(globalScope) {
    const FORECAST_MODULE_VERSION = 'LB-FORECAST-LSTM-GA-20250714A';
    const MIN_REQUIRED_POINTS = 60;
    const WINDOW_SIZE = 20;
    const EVAL_RATIO = 0.2;

    const state = {
        version: FORECAST_MODULE_VERSION,
        model: null,
        scaler: null,
        chart: null,
        lastResult: null,
    };

    const clamp01 = (value) => {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    };

    const clampRange = (value, min, max) => {
        if (!Number.isFinite(value)) return min;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    };

    const parseNumeric = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };

    const extractDate = (input) => {
        if (typeof input !== 'string') return null;
        if (input.length === 0) return null;
        const trimmed = input.trim();
        if (!trimmed) return null;
        const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
        return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
    };

    const normaliseRow = (row) => {
        if (!row || typeof row !== 'object') return null;
        const dateCandidate = extractDate(row.date)
            || extractDate(row.tradeDate)
            || extractDate(row.tradingDate)
            || extractDate(row.time)
            || extractDate(row.timestamp);
        if (!dateCandidate) return null;

        const closeCandidate = [
            row.close,
            row.adjClose,
            row.adj_close,
            row.adjustedClose,
            row.closePrice,
            row.closingPrice,
            row.price,
            row.rawClose,
        ].map(parseNumeric).find((value) => value !== null);

        if (closeCandidate === null) return null;

        return {
            date: dateCandidate,
            close: closeCandidate,
        };
    };

    const collectRows = () => {
        if (!Array.isArray(globalScope.cachedStockData)) return [];
        const deduped = new Map();
        globalScope.cachedStockData.forEach((rawRow) => {
            const row = normaliseRow(rawRow);
            if (row) {
                deduped.set(row.date, row);
            }
        });
        return Array.from(deduped.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    const createScaler = (values) => {
        const finiteValues = values.filter((value) => Number.isFinite(value));
        if (finiteValues.length === 0) {
            return {
                min: 0,
                max: 1,
                range: 1,
                normalize: () => 0.5,
                denormalize: () => 0,
                clamp: clamp01,
            };
        }
        const min = Math.min(...finiteValues);
        const max = Math.max(...finiteValues);
        const range = max - min;
        return {
            min,
            max,
            range: range === 0 ? 1 : range,
            normalize: (value) => {
                if (!Number.isFinite(value)) return 0.5;
                if (range === 0) return 0.5;
                return clamp01((value - min) / (range === 0 ? 1 : range));
            },
            denormalize: (value) => {
                if (!Number.isFinite(value)) return min;
                return min + clamp01(value) * (range === 0 ? 1 : range);
            },
            clamp: clamp01,
        };
    };

    const prepareDataset = (rows) => {
        const dates = rows.map((row) => row.date);
        const closes = rows.map((row) => row.close);
        const total = closes.length;
        const evalStart = Math.min(
            total - 1,
            Math.max(WINDOW_SIZE + 5, Math.floor(total * (1 - EVAL_RATIO)))
        );

        if (evalStart <= WINDOW_SIZE || evalStart >= total) {
            return { error: '資料量不足以切分訓練與驗證集。' };
        }

        const scaler = createScaler(closes.slice(0, evalStart));
        const normalizedSeries = closes.map((value) => scaler.normalize(value));

        const trainX = [];
        const trainY = [];
        for (let index = WINDOW_SIZE; index < evalStart; index += 1) {
            const sequence = normalizedSeries.slice(index - WINDOW_SIZE, index);
            if (sequence.length === WINDOW_SIZE) {
                trainX.push(sequence);
                trainY.push(normalizedSeries[index]);
            }
        }

        if (trainX.length === 0) {
            return { error: '訓練樣本不足。' };
        }

        return {
            dates,
            closes,
            scaler,
            normalizedSeries,
            trainX,
            trainY,
            evalStart,
            meta: {
                total,
                trainSamples: trainX.length,
                evalSamples: total - evalStart,
                trainStartDate: dates[Math.max(WINDOW_SIZE, 0)] || dates[0],
                trainEndDate: dates[evalStart - 1],
                evalStartDate: dates[evalStart],
                evalEndDate: dates[total - 1],
            },
        };
    };

    const createTensor3D = (samples) => {
        const shaped = samples.map((sequence) => sequence.map((value) => [value]));
        return tf.tensor3d(shaped);
    };

    const createTensor2D = (labels) => {
        const shaped = labels.map((value) => [value]);
        return tf.tensor2d(shaped);
    };

    const buildModel = (windowSize) => {
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units: 32, inputShape: [windowSize, 1], returnSequences: false }));
        model.add(tf.layers.dense({ units: 1 }));
        model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
        return model;
    };

    const trainModel = async (model, trainX, trainY, statusEl) => {
        const epochs = Math.min(120, Math.max(50, Math.floor(trainY.shape[0] * 1.2)));
        updateStatus(statusEl, `LSTM 訓練中（共 ${epochs} 個 epoch）…`, 'info');
        await model.fit(trainX, trainY, {
            epochs,
            batchSize: Math.min(32, Math.max(8, Math.floor(trainY.shape[0] / 4))),
            shuffle: false,
            callbacks: {
                onEpochEnd: async (epoch, logs) => {
                    if ((epoch + 1) % 10 === 0 || epoch === epochs - 1) {
                        const lossText = Number.isFinite(logs?.loss) ? logs.loss.toFixed(5) : '—';
                        updateStatus(statusEl, `LSTM 訓練中：第 ${epoch + 1}/${epochs} 次，loss=${lossText}`, 'info');
                    }
                    await tf.nextFrame();
                },
            },
        });
    };

    const runGeneticAlgorithm = (basePredictions, actualValues) => {
        if (!Array.isArray(basePredictions) || basePredictions.length === 0) {
            return { a: 1, b: 0, mae: 0 };
        }
        const populationSize = 40;
        const generations = 60;
        const mutationRate = 0.2;

        const randomGene = () => ({
            a: 0.7 + Math.random() * 0.6,
            b: (Math.random() - 0.5) * 0.4,
        });

        const mutate = (gene) => ({
            a: clampRange(gene.a + (Math.random() - 0.5) * 0.2, 0.5, 1.5),
            b: clampRange(gene.b + (Math.random() - 0.5) * 0.1, -0.5, 0.5),
        });

        const evaluate = (gene) => {
            let error = 0;
            for (let i = 0; i < basePredictions.length; i += 1) {
                const corrected = clamp01(gene.a * basePredictions[i] + gene.b);
                const diff = Math.abs(corrected - actualValues[i]);
                error += diff;
            }
            const mae = error / basePredictions.length;
            return { fitness: 1 / (1 + mae), mae };
        };

        const selectParent = (population) => {
            const pick = () => population[Math.floor(Math.random() * population.length)];
            const candidateA = pick();
            const candidateB = pick();
            return candidateA.fitness > candidateB.fitness ? candidateA : candidateB;
        };

        let population = Array.from({ length: populationSize }, () => {
            const gene = randomGene();
            const score = evaluate(gene);
            return { ...gene, ...score };
        });

        for (let generation = 0; generation < generations; generation += 1) {
            population.sort((a, b) => b.fitness - a.fitness);
            const elites = population.slice(0, 2);
            const nextGen = [...elites];
            while (nextGen.length < populationSize) {
                const parentA = selectParent(population);
                const parentB = selectParent(population);
                const child = {
                    a: clampRange((parentA.a + parentB.a) / 2, 0.5, 1.5),
                    b: clampRange((parentA.b + parentB.b) / 2, -0.5, 0.5),
                };
                if (Math.random() < mutationRate) {
                    const mutated = mutate(child);
                    child.a = mutated.a;
                    child.b = mutated.b;
                }
                const score = evaluate(child);
                nextGen.push({ ...child, ...score });
            }
            population = nextGen;
        }

        population.sort((a, b) => b.fitness - a.fitness);
        const best = population[0];
        return { a: best.a, b: best.b, mae: best.mae };
    };

    const evaluateModel = async (model, normalizedSeries, closes, dates, evalStart, scaler, correction, statusEl) => {
        const predictions = new Array(closes.length).fill(null);
        const metrics = {
            total: 0,
            correct: 0,
            positive: [],
            negative: [],
        };

        const history = normalizedSeries.slice(0, evalStart);
        for (let index = evalStart; index < normalizedSeries.length; index += 1) {
            const windowSlice = history.slice(history.length - WINDOW_SIZE);
            if (windowSlice.length < WINDOW_SIZE) break;

            const basePred = tf.tidy(() => {
                const input = tf.tensor3d([windowSlice.map((value) => [value])]);
                const output = model.predict(input);
                const value = output.dataSync()[0];
                return value;
            });
            const correctedNormalized = scaler.clamp(correction.a * basePred + correction.b);
            const predictedPrice = scaler.denormalize(correctedNormalized);
            const actualPrice = closes[index];
            const prevPrice = closes[index - 1];
            predictions[index] = predictedPrice;

            if (Number.isFinite(actualPrice) && Number.isFinite(prevPrice) && prevPrice !== 0) {
                const predictedChange = ((predictedPrice - prevPrice) / prevPrice) * 100;
                const actualChange = ((actualPrice - prevPrice) / prevPrice) * 100;
                if (Number.isFinite(predictedChange) && Number.isFinite(actualChange)) {
                    metrics.total += 1;
                    const predictedPositive = predictedChange > 0.05;
                    const predictedNegative = predictedChange < -0.05;
                    const actualPositive = actualChange > 0.05;
                    const actualNegative = actualChange < -0.05;
                    if (
                        (predictedPositive && actualPositive)
                        || (predictedNegative && actualNegative)
                        || (!predictedPositive && !predictedNegative && Math.abs(actualChange) <= 0.05)
                    ) {
                        metrics.correct += 1;
                    }
                    if (actualChange > 0) metrics.positive.push(actualChange);
                    else if (actualChange < 0) metrics.negative.push(Math.abs(actualChange));
                }
            }

            history.push(normalizedSeries[index]);
            if ((index - evalStart) % 10 === 0) {
                updateStatus(statusEl, `逐日模擬預測中（${index - evalStart + 1}/${normalizedSeries.length - evalStart}）…`, 'info');
                await tf.nextFrame();
            }
        }

        return {
            predictions,
            metrics,
            period: {
                start: dates[evalStart],
                end: dates[dates.length - 1],
            },
        };
    };

    const computeAverage = (values) => {
        if (!Array.isArray(values) || values.length === 0) return null;
        const sum = values.reduce((acc, value) => acc + value, 0);
        return sum / values.length;
    };

    const renderMetrics = (metrics, diagnosticsEl, meta, correction) => {
        const container = document.getElementById('forecastMetrics');
        if (!container) return;
        if (!metrics) {
            container.innerHTML = `
                <div class="col-span-full text-center text-xs py-3 rounded-md border border-dashed"
                    style="border-color: var(--border); background-color: color-mix(in srgb, var(--muted) 10%, transparent);">
                    尚未產生預測結果。
                </div>`;
            if (diagnosticsEl) diagnosticsEl.innerHTML = '';
            return;
        }

        const accuracy = metrics.total > 0 ? (metrics.correct / metrics.total) * 100 : 0;
        const avgGain = computeAverage(metrics.positive);
        const avgDrop = computeAverage(metrics.negative);

        const formatPercent = (value) => (value === null ? '—' : `${value.toFixed(2)}%`);
        const cards = [
            {
                label: '方向命中率',
                value: `${accuracy.toFixed(1)}%`,
            },
            {
                label: '驗證樣本數',
                value: metrics.total.toString(),
            },
            {
                label: '平均漲幅',
                value: formatPercent(avgGain),
            },
            {
                label: '平均跌幅',
                value: avgDrop === null ? '—' : `${avgDrop.toFixed(2)}%`,
            },
        ];

        container.innerHTML = cards
            .map(
                (card) => `
                    <div class="p-4 rounded-lg border" style="border-color: var(--border); background-color: var(--card);">
                        <p class="text-[11px] mb-1" style="color: var(--muted-foreground);">${card.label}</p>
                        <p class="text-lg font-semibold" style="color: var(--foreground);">${card.value}</p>
                    </div>`
            )
            .join('');

        if (diagnosticsEl) {
            const gaLine = correction
                ? `GA 誤差校正：係數 ${correction.a.toFixed(3)}，偏移 ${correction.b.toFixed(3)}，訓練 MAE ${(correction.mae * 100).toFixed(2)}%`
                : '';
            diagnosticsEl.innerHTML = `
                <p>訓練樣本：${meta.trainSamples} 筆，期間 ${meta.trainStartDate || '—'} ～ ${meta.trainEndDate || '—'}</p>
                <p>驗證樣本：${metrics.total} 筆，期間 ${meta.evalStartDate || '—'} ～ ${meta.evalEndDate || '—'}</p>
                ${gaLine ? `<p>${gaLine}</p>` : ''}
            `;
        }
    };

    const renderChart = (dates, actual, predictions, evalStart) => {
        const canvas = document.getElementById('forecastChart');
        const placeholder = document.getElementById('forecastChartPlaceholder');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        const predictedSeries = predictions.map((value, index) => (index >= evalStart ? value : null));
        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: '實際收盤價',
                        data: actual,
                        borderColor: '#2563eb',
                        borderWidth: 1.8,
                        tension: 0.15,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                    {
                        label: '預測收盤價',
                        data: predictedSeries,
                        borderColor: '#f97316',
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        tension: 0.15,
                        pointRadius: 0,
                        spanGaps: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } },
                    tooltip: { mode: 'index', intersect: false },
                },
                scales: {
                    y: {
                        type: 'linear',
                        ticks: { callback: (value) => `${value}` },
                        grid: { color: '#e5e7eb' },
                    },
                    x: {
                        type: 'category',
                        ticks: { autoSkip: true, maxTicksLimit: 15 },
                        grid: { display: false },
                    },
                },
            },
        });
        if (placeholder) {
            placeholder.classList.add('hidden');
        }
    };

    const updateStatus = (statusEl, message, tone = 'info') => {
        if (!statusEl) return;
        statusEl.textContent = message;
        if (tone === 'error') {
            statusEl.style.color = 'var(--destructive, #dc2626)';
        } else if (tone === 'success') {
            statusEl.style.color = 'var(--emerald-600, #059669)';
        } else {
            statusEl.style.color = 'var(--muted-foreground)';
        }
    };

    const disableButton = (button, disabled) => {
        if (!button) return;
        button.disabled = disabled;
        if (disabled) {
            button.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
            button.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    };

    const runForecast = async () => {
        const statusEl = document.getElementById('forecastStatus');
        const diagnosticsEl = document.getElementById('forecastDiagnostics');
        const button = document.getElementById('runForecastBtn');

        if (typeof tf === 'undefined') {
            updateStatus(statusEl, 'TensorFlow.js 尚未載入，請重新整理頁面後重試。', 'error');
            return;
        }

        if (!Array.isArray(globalScope.cachedStockData) || globalScope.cachedStockData.length === 0) {
            updateStatus(statusEl, '尚未取得股價序列，請先完成一次回測。', 'error');
            return;
        }

        const rows = collectRows();
        if (rows.length < MIN_REQUIRED_POINTS) {
            updateStatus(statusEl, `資料筆數 ${rows.length} 筆不足（至少需 ${MIN_REQUIRED_POINTS} 筆）。`, 'error');
            return;
        }

        disableButton(button, true);
        updateStatus(statusEl, '準備訓練資料中…', 'info');
        renderMetrics(null, diagnosticsEl, null, null);

        let trainXTensor = null;
        let trainYTensor = null;
        let model = null;

        try {
            await tf.ready();

            if (state.model) {
                state.model.dispose();
                state.model = null;
            }

            const dataset = prepareDataset(rows);
            if (dataset.error) {
                updateStatus(statusEl, dataset.error, 'error');
                disableButton(button, false);
                return;
            }

            trainXTensor = createTensor3D(dataset.trainX);
            trainYTensor = createTensor2D(dataset.trainY);
            model = buildModel(WINDOW_SIZE);

            await trainModel(model, trainXTensor, trainYTensor, statusEl);

            const basePredictions = tf.tidy(() => {
                const preds = model.predict(trainXTensor);
                return Array.from(preds.dataSync());
            });
            const correction = runGeneticAlgorithm(basePredictions, dataset.trainY);
            updateStatus(statusEl, 'GA 誤差校正參數優化完成，開始逐日模擬…', 'info');

            const evaluation = await evaluateModel(
                model,
                dataset.normalizedSeries,
                dataset.closes,
                dataset.dates,
                dataset.evalStart,
                dataset.scaler,
                correction,
                statusEl,
            );

            renderChart(dataset.dates, dataset.closes, evaluation.predictions, dataset.evalStart);
            renderMetrics(evaluation.metrics, diagnosticsEl, dataset.meta, correction);
            updateStatus(statusEl, `預測完成：驗證樣本 ${evaluation.metrics.total} 筆。`, 'success');

            state.model = model;
            state.scaler = dataset.scaler;
            state.lastResult = {
                correction,
                metrics: evaluation.metrics,
                meta: dataset.meta,
                version: FORECAST_MODULE_VERSION,
            };
        } catch (error) {
            console.error('[Forecast] 預測流程錯誤：', error);
            updateStatus(statusEl, error?.message || '預測過程發生錯誤。', 'error');
        } finally {
            if (trainXTensor) trainXTensor.dispose();
            if (trainYTensor) trainYTensor.dispose();
            if (model && state.model !== model) {
                model.dispose();
            }
            disableButton(button, false);
        }
    };

    const initForecastTab = () => {
        const button = document.getElementById('runForecastBtn');
        const statusEl = document.getElementById('forecastStatus');
        if (!button || !statusEl) return;
        updateStatus(statusEl, '請先完成一次回測以建立可用的歷史股價資料。', 'info');
        button.addEventListener('click', () => {
            runForecast();
        });
        console.info(`[Forecast] 預測模組已載入（${FORECAST_MODULE_VERSION}）`);
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', initForecastTab);
    }

    globalScope.lazybacktestForecast = state;
})(typeof window !== 'undefined' ? window : globalThis);
