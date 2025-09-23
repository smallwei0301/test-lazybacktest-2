// --- 滾動測試模組 - LB-WALKFORWARD-20250703A ---
(function() {
    const MODULE_VERSION = 'LB-WALKFORWARD-20250703A';
    const DAY_MS = 24 * 60 * 60 * 1000;

    const state = {
        schedule: [],
        runs: [],
        running: false,
        equityChart: null,
        aggregated: null,
    };

    function parseISODateInput(value) {
        if (!value || typeof value !== 'string') return null;
        const parts = value.split('-').map((item) => parseInt(item, 10));
        if (parts.length !== 3 || parts.some((num) => Number.isNaN(num))) return null;
        const [year, month, day] = parts;
        return new Date(Date.UTC(year, month - 1, day));
    }

    function isTradingDay(date) {
        if (!(date instanceof Date)) return false;
        const weekday = date.getUTCDay();
        return weekday !== 0 && weekday !== 6;
    }

    function addTradingDays(baseDate, days) {
        if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
        if (!Number.isFinite(days) || days < 0) return null;
        let remaining = Math.floor(days);
        let cursor = new Date(baseDate.getTime());
        while (remaining > 0) {
            cursor = new Date(cursor.getTime() + DAY_MS);
            if (isTradingDay(cursor)) remaining -= 1;
        }
        return cursor;
    }

    function countTradingDays(startDate, endDate) {
        if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
        if (startDate.getTime() > endDate.getTime()) return 0;
        let count = 0;
        let cursor = new Date(startDate.getTime());
        while (cursor.getTime() <= endDate.getTime()) {
            if (isTradingDay(cursor)) count += 1;
            cursor = new Date(cursor.getTime() + DAY_MS);
        }
        return count;
    }

    function formatDisplayDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
        const year = date.getUTCFullYear();
        const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${date.getUTCDate()}`.padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    function formatISODate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        const year = date.getUTCFullYear();
        const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${date.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateRange(startDate, endDate) {
        if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime()) || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
            return '—';
        }
        return `${formatDisplayDate(startDate)} ~ ${formatDisplayDate(endDate)}`;
    }

    function buildWalkforwardSchedule(startDate, endDate, inSampleLength, outSampleLength, stepLength) {
        if (!startDate || !endDate) return [];
        if (!Number.isFinite(inSampleLength) || !Number.isFinite(outSampleLength) || !Number.isFinite(stepLength)) return [];
        const schedule = [];
        let currentStart = new Date(startDate.getTime());
        while (currentStart.getTime() <= endDate.getTime()) {
            const inSampleEnd = addTradingDays(currentStart, inSampleLength - 1);
            if (!inSampleEnd || inSampleEnd.getTime() > endDate.getTime()) break;
            const outSampleStart = addTradingDays(inSampleEnd, 1);
            if (!outSampleStart) break;
            if (outSampleStart.getTime() > endDate.getTime()) break;
            const expectedOutSampleEnd = addTradingDays(outSampleStart, outSampleLength - 1);
            const truncated = !expectedOutSampleEnd || expectedOutSampleEnd.getTime() > endDate.getTime();
            const outSampleEnd = truncated ? new Date(endDate.getTime()) : expectedOutSampleEnd;
            schedule.push({
                index: schedule.length + 1,
                inSampleStart: new Date(currentStart.getTime()),
                inSampleEnd,
                outSampleStart,
                outSampleEnd,
                truncated,
            });
            if (truncated) break;
            const nextStart = addTradingDays(currentStart, stepLength);
            if (!nextStart) break;
            currentStart = nextStart;
        }
        return schedule;
    }

    function cloneDeep(value) {
        return value ? JSON.parse(JSON.stringify(value)) : value;
    }

    function enumerateRange(range) {
        if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to) || !Number.isFinite(range.step)) {
            return [];
        }
        const values = [];
        const totalSteps = Math.max(1, Math.floor((range.to - range.from) / range.step));
        for (let i = 0; i <= totalSteps + 1; i += 1) {
            const candidate = range.from + i * range.step;
            if (candidate > range.to + 1e-8) break;
            values.push(parseFloat(candidate.toFixed(6)));
        }
        if (values.length === 0) values.push(parseFloat(range.from.toFixed(6)));
        return values;
    }

    function resolveConfigKey(strategyKey, type) {
        if (!strategyKey) return null;
        if (type === 'exit' && ['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(strategyKey)) {
            return `${strategyKey}_exit`;
        }
        return strategyKey;
    }

    function getOptimizeTargets(strategyKey, type) {
        if (typeof strategyDescriptions === 'undefined') return [];
        const configKey = resolveConfigKey(strategyKey, type);
        const config = configKey ? strategyDescriptions[configKey] : null;
        if (!config || !Array.isArray(config.optimizeTargets)) return [];
        return config.optimizeTargets;
    }

    function formatNumber(value, options = {}) {
        if (!Number.isFinite(value)) return '—';
        const { digits = 2, percentage = false } = options;
        const formatter = new Intl.NumberFormat('zh-TW', {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits,
        });
        const formatted = formatter.format(value);
        return percentage ? `${formatted}%` : formatted;
    }

    function evaluateMetric(result, metric) {
        if (!result || typeof result !== 'object') return Number.NEGATIVE_INFINITY;
        if (metric === 'return') {
            return Number.isFinite(result.annualizedReturn) ? result.annualizedReturn : Number.NEGATIVE_INFINITY;
        }
        if (metric === 'sharpe') {
            return Number.isFinite(result.sharpeRatio) ? result.sharpeRatio : Number.NEGATIVE_INFINITY;
        }
        if (metric === 'maxDrawdown') {
            if (!Number.isFinite(result.maxDrawdown)) return Number.POSITIVE_INFINITY;
            return result.maxDrawdown;
        }
        return Number.NEGATIVE_INFINITY;
    }

    function isBetterMetric(candidate, current, metric) {
        if (current === null) return true;
        if (metric === 'maxDrawdown') {
            return candidate < current;
        }
        return candidate > current;
    }

    function enrichParamsWithLookback(params) {
        if (!params || typeof params !== 'object') return params;
        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        if (!sharedUtils) return params;
        const maxIndicatorPeriod = typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;
        const lookbackDays = typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(maxIndicatorPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, maxIndicatorPeriod * 2);
        const effectiveStartDate = params.startDate;
        let dataStartDate = effectiveStartDate;
        if (typeof sharedUtils.computeBufferedStartDate === 'function') {
            dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                minDate: sharedUtils.MIN_DATA_DATE,
                marginTradingDays: 12,
                extraCalendarDays: 7,
            }) || effectiveStartDate;
        }
        if (!dataStartDate) dataStartDate = effectiveStartDate;
        return {
            ...params,
            effectiveStartDate,
            dataStartDate,
            lookbackDays,
        };
    }

    function buildWorkerParams(baseParams, startISO, endISO, overrides = {}, initialCapital) {
        const params = cloneDeep(baseParams) || {};
        params.startDate = startISO;
        params.endDate = endISO;
        if (Number.isFinite(initialCapital)) params.initialCapital = initialCapital;
        params.entryParams = {
            ...(baseParams?.entryParams || {}),
            ...(overrides.entryParams || {}),
        };
        params.exitParams = {
            ...(baseParams?.exitParams || {}),
            ...(overrides.exitParams || {}),
        };
        if (baseParams?.enableShorting) {
            params.enableShorting = true;
            params.shortEntryParams = {
                ...(baseParams?.shortEntryParams || {}),
                ...(overrides.shortEntryParams || {}),
            };
            params.shortExitParams = {
                ...(baseParams?.shortExitParams || {}),
                ...(overrides.shortExitParams || {}),
            };
        } else {
            params.enableShorting = false;
        }
        params.marketType = params.marketType || params.market || currentMarket || 'TWSE';
        params.market = params.marketType;
        return enrichParamsWithLookback(params);
    }

    function runWorkerBacktest(params, options = {}) {
        return new Promise((resolve, reject) => {
            if (typeof workerUrl === 'undefined' || !workerUrl) {
                reject(new Error('背景計算引擎尚未準備就緒。'));
                return;
            }
            const worker = new Worker(workerUrl);
            let settled = false;
            const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 60000;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    worker.terminate();
                    reject(new Error('滾動測試逾時，請稍後再試。'));
                }
            }, timeoutMs);

            worker.onmessage = (event) => {
                const payload = event.data || {};
                if (payload.type === 'result') {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    worker.terminate();
                    resolve(payload.data);
                } else if (payload.type === 'error') {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    worker.terminate();
                    const message = payload?.data?.message || payload?.error || '回測失敗';
                    reject(new Error(message));
                } else if (payload.type === 'progress') {
                    if (typeof options.onProgress === 'function') {
                        options.onProgress(payload);
                    }
                }
            };

            worker.onerror = (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                worker.terminate();
                reject(new Error(error?.message || '背景計算引擎發生錯誤。'));
            };

            const useCache = options.useCache && Array.isArray(options.cachedData) && options.cachedData.length > 0;
            const message = {
                type: 'runBacktest',
                params,
                useCachedData: Boolean(useCache),
            };
            if (useCache) {
                message.cachedData = options.cachedData;
                if (options.cachedMeta) {
                    message.cachedMeta = options.cachedMeta;
                }
            }
            worker.postMessage(message);
        });
    }

    async function optimizeStrategy({
        strategyType,
        strategyKey,
        baseParams,
        startISO,
        endISO,
        entryParams,
        exitParams,
        datasetCache,
        targetMetric,
    }) {
        const optimizeTargets = getOptimizeTargets(strategyKey, strategyType);
        if (!optimizeTargets.length) {
            return {
                entryParams: cloneDeep(entryParams),
                exitParams: cloneDeep(exitParams),
                lastResult: null,
            };
        }

        let workingEntry = cloneDeep(entryParams) || {};
        let workingExit = cloneDeep(exitParams) || {};
        let lastResult = null;

        for (const target of optimizeTargets) {
            const candidates = enumerateRange(target.range);
            if (!candidates.length) continue;
            let bestScore = null;
            let bestValue = workingEntry[target.name];
            let bestResult = null;

            for (const candidate of candidates) {
                const overrides = {};
                if (strategyType === 'entry') {
                    overrides.entryParams = {
                        ...workingEntry,
                        [target.name]: candidate,
                    };
                    overrides.exitParams = workingExit;
                } else {
                    overrides.entryParams = workingEntry;
                    overrides.exitParams = {
                        ...workingExit,
                        [target.name]: candidate,
                    };
                }
                const paramsForRun = buildWorkerParams(baseParams, startISO, endISO, overrides);
                const useCache = Array.isArray(datasetCache.data) && datasetCache.data.length > 0;
                const result = await runWorkerBacktest(paramsForRun, {
                    useCache,
                    cachedData: datasetCache.data,
                    cachedMeta: datasetCache.meta,
                    timeoutMs: 60000,
                });
                if (!useCache && Array.isArray(result?.rawData) && result.rawData.length > 0) {
                    datasetCache.data = result.rawData;
                    datasetCache.meta = result.rawMeta || result.dataDebug || null;
                }
                const metricScore = evaluateMetric(result, targetMetric);
                if (isBetterMetric(metricScore, bestScore, targetMetric)) {
                    bestScore = metricScore;
                    bestValue = candidate;
                    bestResult = result;
                }
            }

            if (strategyType === 'entry') {
                workingEntry[target.name] = bestValue;
            } else {
                workingExit[target.name] = bestValue;
            }
            lastResult = bestResult || lastResult;
        }

        return {
            entryParams: workingEntry,
            exitParams: workingExit,
            lastResult,
        };
    }

    async function executeWalkforwardWindow(windowItem, baseParams, targetMetric) {
        const inSampleStartISO = formatISODate(windowItem.inSampleStart);
        const inSampleEndISO = formatISODate(windowItem.inSampleEnd);
        const outSampleStartISO = formatISODate(windowItem.outSampleStart);
        const outSampleEndISO = formatISODate(windowItem.outSampleEnd);

        const datasetCache = { data: null, meta: null };
        let entryParams = cloneDeep(baseParams.entryParams) || {};
        let exitParams = cloneDeep(baseParams.exitParams) || {};

        const entryOptimization = await optimizeStrategy({
            strategyType: 'entry',
            strategyKey: baseParams.entryStrategy,
            baseParams,
            startISO: inSampleStartISO,
            endISO: inSampleEndISO,
            entryParams,
            exitParams,
            datasetCache,
            targetMetric,
        });
        entryParams = entryOptimization.entryParams;
        exitParams = entryOptimization.exitParams;

        const exitOptimization = await optimizeStrategy({
            strategyType: 'exit',
            strategyKey: baseParams.exitStrategy,
            baseParams,
            startISO: inSampleStartISO,
            endISO: inSampleEndISO,
            entryParams,
            exitParams,
            datasetCache,
            targetMetric,
        });
        entryParams = exitOptimization.entryParams;
        exitParams = exitOptimization.exitParams;

        const inSampleOverrides = {
            entryParams,
            exitParams,
        };
        const inSampleParams = buildWorkerParams(baseParams, inSampleStartISO, inSampleEndISO, inSampleOverrides);
        const inSampleUseCache = Array.isArray(datasetCache.data) && datasetCache.data.length > 0;
        const inSampleResult = await runWorkerBacktest(inSampleParams, {
            useCache: inSampleUseCache,
            cachedData: datasetCache.data,
            cachedMeta: datasetCache.meta,
            timeoutMs: 60000,
        });

        const outSampleParams = buildWorkerParams(baseParams, outSampleStartISO, outSampleEndISO, inSampleOverrides);
        const outSampleResult = await runWorkerBacktest(outSampleParams, { timeoutMs: 60000 });

        return {
            index: windowItem.index,
            truncated: windowItem.truncated,
            inSampleRange: { start: inSampleStartISO, end: inSampleEndISO },
            outSampleRange: { start: outSampleStartISO, end: outSampleEndISO },
            entryParams,
            exitParams,
            inSampleResult,
            outSampleResult,
        };
    }

    function renderSummaryPlaceholder(tbody) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const rows = [
            {
                metric: '年化報酬率',
                oos: '待測試',
                insample: '待測試',
                stability: '績效衰退比率：—',
                description: '策略在實戰中的預期報酬，以及相較於傳統回測結果的衰退程度。',
            },
            {
                metric: '最大回撤 (MDD)',
                oos: '待測試',
                insample: '待測試',
                stability: '風險擴大率：—',
                description: '策略在模擬實戰中可能面臨的最大風險。',
            },
            {
                metric: '夏普值',
                oos: '待測試',
                insample: '待測試',
                stability: '夏普衰退比率：—',
                description: '衡量風險調整後的報酬表現。',
            },
            {
                metric: '獲利因子',
                oos: '待測試',
                insample: '待測試',
                stability: '—',
                description: '總獲利與總虧損的比率。',
            },
            {
                metric: '盈利週期百分比',
                oos: '待測試',
                insample: '—',
                stability: '—',
                description: '各考試期中獲利輪次的占比，用於衡量策略一致性。',
            },
        ];
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${row.metric}</td>
                <td class="px-3 py-2">${row.oos}</td>
                <td class="px-3 py-2">${row.insample}</td>
                <td class="px-3 py-2">${row.stability}</td>
                <td class="px-3 py-2">${row.description}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderPerPeriodRows(tbody, runs) {
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!runs.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="px-3 py-3 text-center">尚未建立滾動窗格。</td>';
            tbody.appendChild(tr);
            return;
        }
        runs.forEach((run) => {
            const oosResult = run.outSampleResult || {};
            const annualized = Number.isFinite(oosResult.annualizedReturn)
                ? `${formatNumber(oosResult.annualizedReturn, { digits: 2 })}%`
                : '—';
            const maxDD = Number.isFinite(oosResult.maxDrawdown)
                ? `${formatNumber(oosResult.maxDrawdown, { digits: 2 })}%`
                : '—';
            const remark = run.truncated ? '資料不足，自動截斷考試期。' : '測試完成';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${run.index}</td>
                <td class="px-3 py-2">${formatDisplayDate(parseISODateInput(run.outSampleRange.start))} ~ ${formatDisplayDate(parseISODateInput(run.outSampleRange.end))}</td>
                <td class="px-3 py-2">—</td>
                <td class="px-3 py-2">${annualized}</td>
                <td class="px-3 py-2">${maxDD}</td>
                <td class="px-3 py-2">${remark}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderParameterRows(tbody, runs) {
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!runs.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" class="px-3 py-3 text-center">等待滾動測試結果。</td>';
            tbody.appendChild(tr);
            return;
        }
        runs.forEach((run) => {
            const entryParams = run.entryParams || {};
            const exitParams = run.exitParams || {};
            const entryText = Object.keys(entryParams).length
                ? Object.entries(entryParams).map(([key, value]) => `${key}=${formatNumber(value, { digits: 4 })}`).join('、')
                : '—';
            const exitText = Object.keys(exitParams).length
                ? Object.entries(exitParams).map(([key, value]) => `${key}=${formatNumber(value, { digits: 4 })}`).join('、')
                : '—';
            const remark = run.truncated ? '（最後一輪，樣本不足）' : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${run.index}</td>
                <td class="px-3 py-2">${formatDateRange(parseISODateInput(run.inSampleRange.start), parseISODateInput(run.inSampleRange.end))}</td>
                <td class="px-3 py-2">${entryText}</td>
                <td class="px-3 py-2">${exitText}</td>
                <td class="px-3 py-2">最佳化完成 ${remark}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function calculateMaxDrawdownFromEquity(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        let peak = -Infinity;
        let maxDrawdown = 0;
        for (const value of values) {
            if (!Number.isFinite(value)) continue;
            peak = Math.max(peak, value);
            if (peak > 0) {
                const drawdown = ((peak - value) / peak) * 100;
                maxDrawdown = Math.max(maxDrawdown, drawdown);
            }
        }
        return maxDrawdown;
    }

    function computeDailyReturns(series) {
        const returns = [];
        if (!Array.isArray(series)) return returns;
        for (let i = 1; i < series.length; i += 1) {
            const prev = series[i - 1];
            const current = series[i];
            if (Number.isFinite(prev) && prev !== 0 && Number.isFinite(current)) {
                returns.push((current / prev) - 1);
            }
        }
        return returns;
    }

    function computeSharpeFromDailyReturns(dailyReturns) {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) return 0;
        const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / dailyReturns.length;
        const std = Math.sqrt(variance);
        if (std === 0) return mean >= 0 ? Infinity : 0;
        const annualReturn = mean * 252;
        const annualStd = std * Math.sqrt(252);
        if (annualStd === 0) return annualReturn >= 0 ? Infinity : 0;
        return annualReturn / annualStd;
    }

    function computeAggregatedMetrics(runs, initialCapital) {
        const equitySeries = [initialCapital];
        const buyHoldSeries = [initialCapital];
        const dateSeries = [];
        let currentCapital = initialCapital;
        let currentBuyHold = initialCapital;
        let totalTradingDays = 0;
        let totalProfitTrades = 0;
        let totalLossTrades = 0;

        runs.forEach((run) => {
            const oos = run.outSampleResult || {};
            const strategyReturns = Array.isArray(oos.strategyReturns) ? oos.strategyReturns : [];
            const buyHoldReturns = Array.isArray(oos.buyHoldReturns) ? oos.buyHoldReturns : [];
            const dates = Array.isArray(oos.dates) ? oos.dates : [];
            strategyReturns.forEach((ret, idx) => {
                const value = currentCapital * (1 + (ret || 0) / 100);
                equitySeries.push(value);
                dateSeries.push(dates[idx] || null);
            });
            buyHoldReturns.forEach((ret) => {
                const value = currentBuyHold * (1 + (ret || 0) / 100);
                buyHoldSeries.push(value);
            });
            if (strategyReturns.length > 0) {
                currentCapital = equitySeries[equitySeries.length - 1];
            }
            if (buyHoldReturns.length > 0) {
                currentBuyHold = buyHoldSeries[buyHoldSeries.length - 1];
            }
            totalTradingDays += dates.length;

            const trades = Array.isArray(oos.completedTrades) ? oos.completedTrades : [];
            trades.forEach((trade) => {
                const profit = Number(trade?.profit);
                if (!Number.isFinite(profit)) return;
                if (profit >= 0) totalProfitTrades += profit;
                else totalLossTrades += Math.abs(profit);
            });
        });

        const finalCapital = equitySeries.length > 0 ? equitySeries[equitySeries.length - 1] : initialCapital;
        const totalReturnFactor = initialCapital > 0 ? finalCapital / initialCapital : 1;
        const totalReturnPct = (totalReturnFactor - 1) * 100;
        const annualizedReturnPct = totalTradingDays > 0
            ? (Math.pow(totalReturnFactor, 252 / totalTradingDays) - 1) * 100
            : 0;
        const maxDrawdownPct = calculateMaxDrawdownFromEquity(equitySeries);
        const dailyReturns = computeDailyReturns(equitySeries);
        const sharpeRatio = computeSharpeFromDailyReturns(dailyReturns);
        const profitFactor = totalLossTrades > 0 ? (totalProfitTrades / totalLossTrades) : (totalProfitTrades > 0 ? Infinity : 0);

        return {
            equitySeries,
            buyHoldSeries,
            dates: dateSeries,
            totalTradingDays,
            totalReturnPct,
            annualizedReturnPct,
            maxDrawdownPct,
            sharpeRatio,
            finalCapital,
            profitFactor,
            dailyReturns,
        };
    }

    function computeBaselineMetrics(result, initialCapital) {
        if (!result) return null;
        const strategyReturns = Array.isArray(result.strategyReturns) ? result.strategyReturns : [];
        const dates = Array.isArray(result.dates) ? result.dates : [];
        const equitySeries = [initialCapital];
        strategyReturns.forEach((ret) => {
            const value = initialCapital * (1 + (ret || 0) / 100);
            equitySeries.push(value);
        });
        const finalCapital = equitySeries.length > 0 ? equitySeries[equitySeries.length - 1] : initialCapital;
        const totalReturnFactor = initialCapital > 0 ? finalCapital / initialCapital : 1;
        const totalReturnPct = (totalReturnFactor - 1) * 100;
        const annualizedReturnPct = dates.length > 0
            ? (Math.pow(totalReturnFactor, 252 / dates.length) - 1) * 100
            : 0;
        const maxDrawdownPct = calculateMaxDrawdownFromEquity(equitySeries);
        const dailyReturns = computeDailyReturns(equitySeries);
        const sharpeRatio = computeSharpeFromDailyReturns(dailyReturns);
        const trades = Array.isArray(result.completedTrades) ? result.completedTrades : [];
        let gain = 0;
        let loss = 0;
        trades.forEach((trade) => {
            const profit = Number(trade?.profit);
            if (!Number.isFinite(profit)) return;
            if (profit >= 0) gain += profit;
            else loss += Math.abs(profit);
        });
        const profitFactor = loss > 0 ? (gain / loss) : (gain > 0 ? Infinity : 0);
        return {
            totalReturnPct,
            annualizedReturnPct,
            maxDrawdownPct,
            sharpeRatio,
            profitFactor,
        };
    }

    function renderSummaryTable(tbody, aggregated, baseline, runs) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const profitableRuns = runs.filter((run) => {
            const oos = run.outSampleResult || {};
            if (!Number.isFinite(oos.finalValue) || !Number.isFinite(oos.initialCapital)) return false;
            return oos.finalValue > oos.initialCapital;
        });
        const profitableText = runs.length
            ? `${Math.round((profitableRuns.length / runs.length) * 100)}% (${profitableRuns.length}/${runs.length})`
            : '—';

        const baselineAnnualized = baseline ? baseline.annualizedReturnPct : null;
        const baselineMaxDD = baseline ? baseline.maxDrawdownPct : null;
        const baselineSharpe = baseline ? baseline.sharpeRatio : null;

        const rows = [
            {
                metric: '年化報酬率',
                oos: Number.isFinite(aggregated.annualizedReturnPct) ? `${formatNumber(aggregated.annualizedReturnPct, { digits: 2 })}%` : '—',
                insample: Number.isFinite(baselineAnnualized) ? `${formatNumber(baselineAnnualized, { digits: 2 })}%` : '—',
                stability: (Number.isFinite(aggregated.annualizedReturnPct) && Number.isFinite(baselineAnnualized) && baselineAnnualized !== 0)
                    ? `績效衰退比率：${formatNumber(aggregated.annualizedReturnPct / baselineAnnualized, { digits: 2 })}`
                    : '績效衰退比率：—',
                description: '策略在實戰中的預期報酬，以及相較於傳統回測結果的衰退程度。',
            },
            {
                metric: '最大回撤 (MDD)',
                oos: Number.isFinite(aggregated.maxDrawdownPct) ? `${formatNumber(aggregated.maxDrawdownPct, { digits: 2 })}%` : '—',
                insample: Number.isFinite(baselineMaxDD) ? `${formatNumber(baselineMaxDD, { digits: 2 })}%` : '—',
                stability: (Number.isFinite(aggregated.maxDrawdownPct) && Number.isFinite(baselineMaxDD) && baselineMaxDD !== 0)
                    ? `風險擴大率：${formatNumber(aggregated.maxDrawdownPct / baselineMaxDD, { digits: 2 })}`
                    : '風險擴大率：—',
                description: '策略在實戰中可能面臨的最大風險。',
            },
            {
                metric: '夏普值',
                oos: Number.isFinite(aggregated.sharpeRatio) ? formatNumber(aggregated.sharpeRatio, { digits: 2 }) : '—',
                insample: Number.isFinite(baselineSharpe) ? formatNumber(baselineSharpe, { digits: 2 }) : '—',
                stability: (Number.isFinite(aggregated.sharpeRatio) && Number.isFinite(baselineSharpe) && baselineSharpe !== 0)
                    ? `夏普衰退比率：${formatNumber(aggregated.sharpeRatio / baselineSharpe, { digits: 2 })}`
                    : '夏普衰退比率：—',
                description: '衡量風險調整後的報酬表現。',
            },
            {
                metric: '獲利因子',
                oos: Number.isFinite(aggregated.profitFactor)
                    ? (aggregated.profitFactor === Infinity ? '∞' : formatNumber(aggregated.profitFactor, { digits: 2 }))
                    : '—',
                insample: Number.isFinite(baseline?.profitFactor)
                    ? (baseline.profitFactor === Infinity ? '∞' : formatNumber(baseline.profitFactor, { digits: 2 }))
                    : '—',
                stability: '—',
                description: '總獲利與總虧損的比率。',
            },
            {
                metric: '盈利週期百分比',
                oos: profitableText,
                insample: '—',
                stability: '—',
                description: '各考試期中獲利輪次的占比，用於衡量策略一致性。',
            },
        ];

        rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${row.metric}</td>
                <td class="px-3 py-2">${row.oos}</td>
                <td class="px-3 py-2">${row.insample}</td>
                <td class="px-3 py-2">${row.stability}</td>
                <td class="px-3 py-2">${row.description}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderEquityChart(container, aggregated) {
        if (!container) return;
        const canvasId = 'walkforward-equity-canvas';
        let canvas = container.querySelector(`#${canvasId}`);
        if (!canvas) {
            container.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.id = canvasId;
            container.appendChild(canvas);
        }
        if (state.equityChart) {
            state.equityChart.destroy();
            state.equityChart = null;
        }
        const labels = aggregated.dates && aggregated.dates.length ? aggregated.dates : aggregated.equitySeries.map((_, idx) => idx + 1);
        const data = {
            labels,
            datasets: [
                {
                    label: '滾動測試淨值',
                    data: aggregated.equitySeries.map((value) => Number.isFinite(value) ? value : null),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    tension: 0.25,
                },
            ],
        };
        state.equityChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        display: false,
                    },
                    y: {
                        ticks: {
                            callback: (value) => formatNumber(value, { digits: 0 }),
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            usePointStyle: true,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `淨值：${formatNumber(context.parsed.y, { digits: 0 })}`,
                        },
                    },
                },
            },
        });
    }

    function setWarningMessage(target, message, stateName = 'info') {
        if (!target) return;
        target.textContent = message || '';
        if (stateName === 'error') {
            target.dataset.state = 'error';
        } else {
            delete target.dataset.state;
        }
    }

    function getSelectedTargetMetric(groupElement) {
        if (!groupElement) return 'return';
        const checked = groupElement.querySelector('input[name="walkforward-target"]:checked');
        return checked ? checked.value : 'return';
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.info(`[Walk-Forward] 初始化模組 ${MODULE_VERSION}`);

        const inSampleInput = document.getElementById('walkforward-in-sample');
        const outSampleInput = document.getElementById('walkforward-out-sample');
        const stepInput = document.getElementById('walkforward-step');
        const warningBox = document.getElementById('walkforward-warning');
        const totalPeriodDisplay = document.getElementById('walkforward-total-period');
        const planButton = document.getElementById('walkforward-generate-plan');
        const planSummary = document.getElementById('walkforward-plan-summary');
        const periodsBody = document.getElementById('walkforward-periods-body');
        const paramsBody = document.getElementById('walkforward-parameters-body');
        const summaryBody = document.getElementById('walkforward-summary-body');
        const equityContainer = document.getElementById('walkforward-equity-container');
        const targetGroup = document.getElementById('walkforward-target-group');
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        if (!inSampleInput || !outSampleInput || !stepInput || !planButton) {
            console.warn('[Walk-Forward] 找不到必要的滾動測試輸入欄位，略過初始化。');
            return;
        }

        renderSummaryPlaceholder(summaryBody);
        renderPerPeriodRows(periodsBody, []);
        renderParameterRows(paramsBody, []);

        const syncStepLength = () => {
            if (!outSampleInput.value) return;
            stepInput.value = outSampleInput.value;
        };

        const updateTotalPeriod = () => {
            if (!totalPeriodDisplay) return { tradingDays: 0, startDate: null, endDate: null };
            const startDate = parseISODateInput(startInput ? startInput.value : null);
            const endDate = parseISODateInput(endInput ? endInput.value : null);
            if (!startDate || !endDate) {
                totalPeriodDisplay.textContent = '請先設定回測開始與結束日期。';
                return { tradingDays: 0, startDate, endDate };
            }
            if (startDate.getTime() > endDate.getTime()) {
                totalPeriodDisplay.textContent = '結束日期需晚於開始日期，請調整設定。';
                return { tradingDays: 0, startDate, endDate };
            }
            const tradingDays = countTradingDays(startDate, endDate);
            totalPeriodDisplay.textContent = `預估可用交易日：約 ${tradingDays} 天（排除週末）`;
            return { tradingDays, startDate, endDate };
        };

        const updateValidationHint = () => {
            const { tradingDays: totalDays, startDate, endDate } = updateTotalPeriod();
            const inSample = parseInt(inSampleInput.value, 10);
            const outSample = parseInt(outSampleInput.value, 10);
            const stepLength = parseInt(stepInput.value, 10) || outSample;

            if (!startDate || !endDate || !totalDays) {
                setWarningMessage(warningBox, '尚未取得有效的回測區間，請確認日期設定。', 'error');
                return;
            }
            if (totalDays < inSample + outSample) {
                setWarningMessage(warningBox, `目前總交易日約 ${totalDays} 天，小於學習期 (${inSample}) 與考試期 (${outSample})之和，請延長回測期間或調整窗格長度。`, 'error');
                return;
            }
            const previewSchedule = buildWalkforwardSchedule(startDate, endDate, inSample, outSample, stepLength);
            const approxRuns = previewSchedule.length || 1;
            const truncated = previewSchedule.some((window) => window.truncated);
            const hintTail = truncated ? '（最後一輪會因資料不足而截斷）' : '';
            setWarningMessage(warningBox, `設定有效，預估可執行 ${approxRuns} 輪滾動測試${hintTail}。`);
        };

        syncStepLength();
        updateValidationHint();

        outSampleInput.addEventListener('input', () => {
            syncStepLength();
            updateValidationHint();
        });
        inSampleInput.addEventListener('input', updateValidationHint);
        if (startInput) startInput.addEventListener('change', updateValidationHint);
        if (endInput) endInput.addEventListener('change', updateValidationHint);

        planButton.addEventListener('click', async (event) => {
            event.preventDefault();
            if (state.running) return;

            const baseParams = cloneDeep(getBacktestParams());
            if (!validateBacktestParams(baseParams)) {
                setWarningMessage(warningBox, '回測參數驗證失敗，請先調整設定。', 'error');
                return;
            }

            const { tradingDays: totalDays, startDate, endDate } = updateTotalPeriod();
            const inSample = parseInt(inSampleInput.value, 10);
            const outSample = parseInt(outSampleInput.value, 10);
            const stepLength = parseInt(stepInput.value, 10) || outSample;

            if (!startDate || !endDate) {
                setWarningMessage(warningBox, '請先設定完整的回測期間再進行滾動測試。', 'error');
                return;
            }
            if (!Number.isFinite(inSample) || !Number.isFinite(outSample)) {
                setWarningMessage(warningBox, '請輸入有效的學習期與考試期長度。', 'error');
                return;
            }
            if (totalDays < inSample + outSample) {
                setWarningMessage(warningBox, '回測期間不足以建立第一個窗格，請調整參數。', 'error');
                return;
            }

            const schedule = buildWalkforwardSchedule(startDate, endDate, inSample, outSample, stepLength);
            if (!schedule.length) {
                setWarningMessage(warningBox, '目前的回測期間無法建立有效的滾動窗格，建議延長回測時間或縮短學習／考試期長度。', 'error');
                renderPerPeriodRows(periodsBody, []);
                renderParameterRows(paramsBody, []);
                return;
            }

            state.schedule = schedule;
            state.runs = [];
            renderPerPeriodRows(periodsBody, []);
            renderParameterRows(paramsBody, []);
            renderSummaryPlaceholder(summaryBody);
            if (state.equityChart) {
                state.equityChart.destroy();
                state.equityChart = null;
            }
            if (equityContainer) {
                equityContainer.innerHTML = '滾動淨值曲線尚未建立。';
            }

            const firstWindow = schedule[0];
            const lastWindow = schedule[schedule.length - 1];
            planSummary.textContent = `已建立 ${schedule.length} 個滾動窗格，第一輪涵蓋 ${formatDateRange(firstWindow.inSampleStart, firstWindow.outSampleEnd)}，最後一輪結束於 ${formatDisplayDate(lastWindow.outSampleEnd)}。`;

            const targetMetric = getSelectedTargetMetric(targetGroup);
            state.running = true;
            planButton.disabled = true;
            const originalButtonHtml = planButton.innerHTML;
            planButton.innerHTML = '<i data-lucide="loader-2" class="lucide mr-2 animate-spin"></i>執行中...';

            try {
                for (let i = 0; i < schedule.length; i += 1) {
                    const windowItem = schedule[i];
                    setWarningMessage(warningBox, `正在執行第 ${i + 1}/${schedule.length} 輪滾動測試...`);
                    const run = await executeWalkforwardWindow(windowItem, baseParams, targetMetric);
                    state.runs.push(run);
                    renderPerPeriodRows(periodsBody, state.runs);
                    renderParameterRows(paramsBody, state.runs);
                }

                const aggregated = computeAggregatedMetrics(state.runs, baseParams.initialCapital);
                state.aggregated = aggregated;

                const baselineParams = buildWorkerParams(baseParams, baseParams.startDate, baseParams.endDate, {
                    entryParams: baseParams.entryParams,
                    exitParams: baseParams.exitParams,
                });
                const baselineResult = await runWorkerBacktest(baselineParams, { timeoutMs: 60000 });
                const baselineMetrics = computeBaselineMetrics(baselineResult, baseParams.initialCapital);

                renderSummaryTable(summaryBody, aggregated, baselineMetrics, state.runs);
                if (equityContainer) {
                    renderEquityChart(equityContainer, aggregated);
                }

                setWarningMessage(warningBox, '滾動測試完成，可檢視彙整結果。');
                planSummary.textContent = `滾動測試已完成 ${schedule.length} 輪，最終淨值約為 ${formatNumber(aggregated.finalCapital, { digits: 0 })}。`;
            } catch (error) {
                console.error('[Walk-Forward] 執行錯誤：', error);
                setWarningMessage(warningBox, `滾動測試失敗：${error.message}`, 'error');
                planSummary.textContent = '滾動測試中途失敗，請檢查網路連線或重新設定參數後再試。';
            } finally {
                state.running = false;
                planButton.disabled = false;
                planButton.innerHTML = originalButtonHtml;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });
    });
})();
