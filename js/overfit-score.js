// --- Overfit Scoring Utilities ---
// Patch Tag: LB-OVERFIT-SCORE-20250916A
(function(global) {
    const MODULE_VERSION = 'LB-OVERFIT-SCORE-20250916A';
    const YEAR_TRADING_DAYS = 252;

    function prepareResultAnalytics(result, options = {}) {
        if (!result || typeof result !== 'object') return;
        const desiredBlocks = ensureEvenNumber(options.blockCount || 10);
        if (!Number.isFinite(desiredBlocks) || desiredBlocks < 2) return;

        const meta = result.__overfit || (result.__overfit = { version: MODULE_VERSION });
        const force = options.force === true;
        const series = Array.isArray(result.strategyReturns) ? result.strategyReturns : [];
        const dates = Array.isArray(result.dates) ? result.dates : [];

        if (!force && meta.preparedVersion === MODULE_VERSION && meta.blockPreparedFor === desiredBlocks) {
            return;
        }

        const daily = extractDailyReturns(series);
        meta.dailyReturns = daily.returns;
        meta.dailyPairs = daily.pairs;
        meta.dailyPrepared = true;

        const blockMetrics = computeBlockMetrics({
            series,
            dates,
            blockCount: desiredBlocks,
            dailyReturns: daily.returns,
            dailyPairs: daily.pairs,
            riskFreeRate: options.riskFreeRate,
        });

        meta.blockMetrics = blockMetrics;
        meta.blockPreparedFor = Array.isArray(blockMetrics) ? blockMetrics.length : 0;
        meta.preparedVersion = MODULE_VERSION;
    }

    function aggregateBatchAnalytics(results, options = {}) {
        if (!Array.isArray(results) || results.length === 0) {
            return null;
        }

        const desiredBlocks = ensureEvenNumber(options.blockCount || 10);
        const riskFreeRate = Number.isFinite(options.riskFreeRate) ? options.riskFreeRate : 0.01;

        results.forEach(result => {
            prepareResultAnalytics(result, { blockCount: desiredBlocks, riskFreeRate });
        });

        const trialCount = Math.max(results.length, 1);
        const matrix = [];
        const matrixRowIndices = [];
        const skippedForBlocks = new Set();

        results.forEach((result, idx) => {
            const meta = result.__overfit;
            if (!meta || !Array.isArray(meta.blockMetrics)) {
                skippedForBlocks.add(idx);
                return;
            }
            const row = meta.blockMetrics.map(block => Number.isFinite(block.annualizedReturn) ? block.annualizedReturn : null);
            if (row.length !== desiredBlocks || row.some(value => !Number.isFinite(value))) {
                skippedForBlocks.add(idx);
                return;
            }
            matrix.push(row);
            matrixRowIndices.push(idx);
        });

        let cscv = null;
        if (matrix.length >= 2 && global.lazyPBO && typeof global.lazyPBO.computeCSCVPBO === 'function') {
            cscv = global.lazyPBO.computeCSCVPBO(matrix, { maxSplits: options.maxSplits || 2048 });
        }

        let islandInsights = [];
        if (global.lazyIslands && typeof global.lazyIslands.computeIslandInsights === 'function') {
            islandInsights = global.lazyIslands.computeIslandInsights(results, {
                cscv,
                matrixRowIndices,
            });
        } else {
            islandInsights = results.map(() => ({ score: null, components: {} }));
        }

        const warnings = [];
        if (matrix.length < 2) {
            warnings.push('有效策略數不足，無法完成 CSCV PBO 評估');
        }
        if (skippedForBlocks.size > 0) {
            warnings.push(`有 ${skippedForBlocks.size} 策略因資料不足未納入 CSCV 評估`);
        }

        const dsrValues = [];
        results.forEach((result, idx) => {
            const meta = result.__overfit;
            if (!meta) return;
            const dsr = computeDeflatedSharpe(meta.dailyReturns, trialCount, { riskFreeRate });
            if (Number.isFinite(dsr)) {
                meta.dsr = dsr;
                dsrValues.push(dsr);
            } else {
                meta.dsr = null;
            }
        });

        matrixRowIndices.forEach((resultIndex, matrixIndex) => {
            const meta = results[resultIndex].__overfit;
            if (!meta || !cscv) return;
            meta.championShare = ratio(cscv.championCounts?.[matrixIndex], cscv.evaluatedSplits || 0);
            meta.championPbo = Number.isFinite(cscv.championPbo?.[matrixIndex]) ? cscv.championPbo[matrixIndex] : null;
            meta.oosMedian = Number.isFinite(cscv.oosMedianByConfig?.[matrixIndex]) ? cscv.oosMedianByConfig[matrixIndex] : null;
            meta.oosDistribution = cscv.oosDistributions?.[matrixIndex] || [];
        });

        const overfitScores = [];
        const overfitDegrees = [];
        const islandScores = [];
        const verdictCounts = { success: 0, info: 0, warning: 0, danger: 0 };

        results.forEach((result, idx) => {
            const meta = result.__overfit || (result.__overfit = {});
            const islandInsight = islandInsights[idx];
            if (islandInsight && Number.isFinite(islandInsight.score)) {
                meta.islandScore = islandInsight.score;
                islandScores.push(islandInsight.score);
            } else {
                meta.islandScore = null;
            }

            const effectivePbo = Number.isFinite(meta.championPbo) ? meta.championPbo : (cscv?.pbo ?? null);
            const dsr = Number.isFinite(meta.dsr) ? meta.dsr : null;
            const islandScore = Number.isFinite(meta.islandScore) ? meta.islandScore : null;

            const scoreResult = computeOverfitScore({
                pbo: effectivePbo,
                globalPbo: cscv?.pbo ?? null,
                dsr,
                islandScore,
            });

            meta.overfitScore = scoreResult.score;
            meta.overfitDegree = scoreResult.degree;
            meta.overfitVerdict = scoreResult.verdict;
            meta.overfitComponents = scoreResult.components;

            result.overfitScore = meta.overfitScore;
            result.overfitDegree = meta.overfitDegree;
            result.overfitVerdict = scoreResult.verdict;
            result.overfitPbo = effectivePbo;
            result.overfitIslandScore = islandScore;
            result.overfitDsr = dsr;

            if (Number.isFinite(meta.overfitScore)) {
                overfitScores.push(meta.overfitScore);
            }
            if (Number.isFinite(meta.overfitDegree)) {
                overfitDegrees.push(meta.overfitDegree);
            }
            if (scoreResult.verdict && verdictCounts.hasOwnProperty(scoreResult.verdict.tone)) {
                verdictCounts[scoreResult.verdict.tone] += 1;
            }
        });

        const analytics = {
            version: MODULE_VERSION,
            blockCount: desiredBlocks,
            totalResults: results.length,
            validResults: matrix.length,
            pbo: cscv?.pbo ?? null,
            lambdaSamples: cscv?.lambdaSamples || [],
            overfitMedian: median(overfitScores),
            overfitDegreeMedian: median(overfitDegrees),
            overfitTop: max(overfitScores),
            islandMedian: median(islandScores),
            dsrMedian: median(dsrValues),
            verdictSummary: verdictCounts,
            warnings,
            computedAt: Date.now(),
        };

        analytics.globalVerdict = computeOverfitScore({
            pbo: analytics.pbo,
            dsr: analytics.dsrMedian,
            islandScore: analytics.islandMedian,
        }).verdict;

        global.lazyOverfit = global.lazyOverfit || {};
        global.lazyOverfit.lastAnalytics = analytics;
        return analytics;
    }

    function computeOverfitScore(components = {}) {
        const effectivePbo = Number.isFinite(components.pbo) ? components.pbo : null;
        const globalPbo = Number.isFinite(components.globalPbo) ? components.globalPbo : null;
        const dsr = Number.isFinite(components.dsr) ? components.dsr : null;
        const islandScore = Number.isFinite(components.islandScore) ? components.islandScore : null;

        const scores = [];
        const riskComponents = [];
        if (effectivePbo !== null) {
            const normalized = clamp01(1 - effectivePbo);
            scores.push({ key: 'pbo', weight: 0.5, value: normalized });
            riskComponents.push({ key: 'pbo', weight: 0.5, value: clamp01(effectivePbo) });
        } else if (globalPbo !== null) {
            const normalized = clamp01(1 - globalPbo);
            scores.push({ key: 'pbo', weight: 0.5, value: normalized });
            riskComponents.push({ key: 'pbo', weight: 0.5, value: clamp01(globalPbo) });
        }
        if (dsr !== null) {
            const normalized = clamp01(dsr);
            scores.push({ key: 'dsr', weight: 0.25, value: normalized });
            riskComponents.push({ key: 'dsr', weight: 0.25, value: clamp01(1 - normalized) });
        }
        if (islandScore !== null) {
            const normalized = clamp01(islandScore);
            scores.push({ key: 'island', weight: 0.25, value: normalized });
            riskComponents.push({ key: 'island', weight: 0.25, value: clamp01(1 - normalized) });
        }

        const totalWeight = scores.reduce((acc, item) => acc + item.weight, 0);
        const blendedScore = totalWeight > 0
            ? scores.reduce((acc, item) => acc + item.weight * item.value, 0) / totalWeight
            : 0.5;
        const score = Math.round(blendedScore * 100);

        const riskWeight = riskComponents.reduce((acc, item) => acc + item.weight, 0);
        const blendedRisk = riskWeight > 0
            ? riskComponents.reduce((acc, item) => acc + item.weight * item.value, 0) / riskWeight
            : 0.5;
        const degree = clamp01(blendedRisk);

        const verdict = determineVerdict({
            score,
            pbo: effectivePbo !== null ? effectivePbo : globalPbo,
        });

        return {
            score,
            degree,
            verdict,
            components: {
                version: MODULE_VERSION,
                contributions: scores.map(item => ({
                    key: item.key,
                    weight: item.weight,
                    value: item.value,
                })),
                riskContributions: riskComponents.map(item => ({
                    key: item.key,
                    weight: item.weight,
                    value: item.value,
                })),
                blendedScore,
                blendedRisk: degree,
            },
        };
    }

    function renderSummary(analytics) {
        const summaryEl = document.getElementById('batch-overfit-summary');
        const bannerEl = document.getElementById('batch-overfit-banner');

        if (!summaryEl || !bannerEl) {
            return;
        }

        if (!analytics) {
            summaryEl.classList.add('hidden');
            bannerEl.classList.add('hidden');
            return;
        }

        const verdict = analytics.globalVerdict || determineVerdict({ score: analytics.overfitMedian || 0, pbo: analytics.pbo });
        const toneClass = resolveToneClass(verdict.tone);

        bannerEl.innerHTML = `
            <div class="flex items-start md:items-center justify-between">
                <div>
                    <div class="text-sm uppercase tracking-wide opacity-80">過擬合風險評估</div>
                    <div class="text-xl font-semibold mt-1">${verdict.icon || 'ℹ️'} ${verdict.label || '評估結果'}</div>
                    <div class="text-xs mt-1 opacity-80">
                        PBO: ${formatPercent(analytics.pbo)} ｜ 分數中位數: ${formatScore(analytics.overfitMedian)}
                    </div>
                </div>
                <div class="text-right text-xs opacity-70">
                    已評估 ${analytics.validResults}/${analytics.totalResults} 組策略<br/>
                    ${analytics.warnings.length > 0 ? analytics.warnings.join('；') : 'CSCV 估計以有效策略為準'}
                </div>
            </div>`;
        bannerEl.className = `${toneClass} mb-4 p-4 rounded-md border`;

        summaryEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                ${renderStat('過擬合分數中位數', formatScore(analytics.overfitMedian), '越高越佳 (0~100)')}
                ${renderStat('過擬合度中位數', formatPercent(analytics.overfitDegreeMedian), '越低越好 (0~100%)')}
                ${renderStat('全域 PBO', formatPercent(analytics.pbo), '越低越好')}
                ${renderStat('穩健度中位數', formatPercent(analytics.islandMedian), '礁島分數，越高越穩健')}
                ${renderStat('DSR 中位數', formatScore(analytics.dsrMedian !== null ? analytics.dsrMedian * 100 : null), 'Deflated Sharpe Ratio')}
            </div>`;
        summaryEl.classList.remove('hidden');
    }

    function renderStat(label, value, helper) {
        return `
            <div class="p-3 border rounded-lg bg-white/60">
                <div class="text-xs uppercase tracking-wide text-gray-500">${label}</div>
                <div class="text-lg font-semibold mt-1">${value}</div>
                <div class="text-[11px] text-gray-500 mt-1">${helper || ''}</div>
            </div>`;
    }

    function determineVerdict({ score, pbo }) {
        const verdictMap = {
            success: { icon: '👍', label: '穩健', tone: 'success' },
            info: { icon: '✅', label: '良好', tone: 'info' },
            warning: { icon: '⚠️', label: '需留意', tone: 'warning' },
            danger: { icon: '🚫', label: '高風險', tone: 'danger' },
        };

        let tone = 'info';
        const effectiveScore = Number.isFinite(score) ? score : 50;
        const effectivePbo = Number.isFinite(pbo) ? pbo : null;

        if (effectivePbo !== null) {
            if (effectivePbo >= 0.5) tone = 'danger';
            else if (effectivePbo >= 0.35) tone = 'warning';
            else if (effectivePbo >= 0.15) tone = effectiveScore >= 60 ? 'info' : 'warning';
            else tone = effectiveScore >= 60 ? 'success' : 'info';
        } else {
            if (effectiveScore >= 80) tone = 'success';
            else if (effectiveScore >= 60) tone = 'info';
            else if (effectiveScore >= 45) tone = 'warning';
            else tone = 'danger';
        }

        return verdictMap[tone] || verdictMap.info;
    }

    function extractDailyReturns(series) {
        const returns = [];
        const pairs = [];
        let prevFactor = null;
        let prevIndex = null;
        for (let i = 0; i < series.length; i += 1) {
            const value = series[i];
            if (!Number.isFinite(value)) continue;
            const factor = 1 + value / 100;
            if (prevFactor !== null && prevFactor > 0 && factor > 0 && prevIndex !== null) {
                returns.push(factor / prevFactor - 1);
                pairs.push({ from: prevIndex, to: i });
            }
            prevFactor = factor;
            prevIndex = i;
        }
        return { returns, pairs };
    }

    function computeBlockMetrics({ series, dates, blockCount, dailyReturns, dailyPairs, riskFreeRate }) {
        if (!Array.isArray(series) || series.length === 0) return null;
        if (!Array.isArray(dailyPairs) || dailyPairs.length < blockCount) return null;

        const sizes = distributeSizes(dailyPairs.length, blockCount);
        if (sizes.length !== blockCount) return null;

        const metrics = [];
        let pointer = 0;
        for (let blockIndex = 0; blockIndex < sizes.length; blockIndex += 1) {
            const length = sizes[blockIndex];
            const sliceReturns = dailyReturns.slice(pointer, pointer + length);
            const slicePairs = dailyPairs.slice(pointer, pointer + length);
            pointer += length;

            if (slicePairs.length === 0) continue;
            const startIdx = slicePairs[0].from;
            const endIdx = slicePairs[slicePairs.length - 1].to;
            const startFactor = factorFromSeries(series[startIdx]);
            const endFactor = factorFromSeries(series[endIdx]);
            if (!Number.isFinite(startFactor) || !Number.isFinite(endFactor) || startFactor <= 0) {
                continue;
            }

            const totalFactor = sliceReturns.reduce((acc, value) => acc * (1 + value), 1);
            const totalReturn = totalFactor - 1;
            const tradingDays = sliceReturns.length;
            const years = tradingDays / YEAR_TRADING_DAYS;
            const annualized = years > 0 && totalFactor > 0 ? Math.pow(totalFactor, 1 / years) - 1 : totalReturn;
            const sharpe = computeSharpe(sliceReturns, riskFreeRate);

            metrics.push({
                index: blockIndex,
                startIndex: startIdx,
                endIndex: endIdx,
                startDate: dates[startIdx] || null,
                endDate: dates[endIdx] || null,
                dailyReturnCount: tradingDays,
                totalReturn: totalReturn * 100,
                annualizedReturn: Number.isFinite(annualized) ? annualized * 100 : totalReturn * 100,
                sharpe,
            });
        }

        return metrics.length === blockCount ? metrics : null;
    }

    function computeDeflatedSharpe(dailyReturns, trialCount, options = {}) {
        if (!Array.isArray(dailyReturns) || dailyReturns.length < 10) return null;
        const n = dailyReturns.length;
        const mean = dailyReturns.reduce((acc, value) => acc + value, 0) / n;
        const variance = dailyReturns.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / n;
        const std = Math.sqrt(variance);
        if (!Number.isFinite(std) || std === 0) return null;

        const riskFreeRate = Number.isFinite(options.riskFreeRate) ? options.riskFreeRate : 0.01;
        const dailyRf = riskFreeRate / YEAR_TRADING_DAYS;
        const excessMean = mean - dailyRf;
        const sharpe = (excessMean / std) * Math.sqrt(YEAR_TRADING_DAYS);

        const skew = computeStandardizedMoment(dailyReturns, mean, std, 3);
        const kurt = computeStandardizedMoment(dailyReturns, mean, std, 4);
        const varianceAdj = Math.max(1e-8, 1 - skew * sharpe + ((kurt - 1) / 4) * sharpe * sharpe);

        const effectiveTrials = Math.max(trialCount, 1.0001);
        const zAlpha = inverseStandardNormal(1 - 1 / effectiveTrials);
        const denominator = Math.sqrt(varianceAdj);
        const srMax = zAlpha * (denominator / Math.sqrt(Math.max(n - 1, 1)));
        const zScore = (sharpe - srMax) * Math.sqrt(Math.max(n - 1, 1)) / denominator;
        return clamp01(normalCdf(zScore));
    }

    function computeSharpe(dailyReturns, riskFreeRate = 0.01) {
        if (!Array.isArray(dailyReturns) || dailyReturns.length < 2) return null;
        const n = dailyReturns.length;
        const mean = dailyReturns.reduce((acc, value) => acc + value, 0) / n;
        const variance = dailyReturns.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / n;
        const std = Math.sqrt(variance);
        if (!Number.isFinite(std) || std === 0) return null;
        const dailyRf = riskFreeRate / YEAR_TRADING_DAYS;
        const excessMean = mean - dailyRf;
        return (excessMean / std) * Math.sqrt(YEAR_TRADING_DAYS);
    }

    function computeStandardizedMoment(values, mean, std, order) {
        if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(std) || std === 0) {
            return 0;
        }
        const n = values.length;
        const moment = values.reduce((acc, value) => acc + Math.pow(value - mean, order), 0) / n;
        return moment / Math.pow(std, order);
    }

    function distributeSizes(total, groups) {
        const base = Math.floor(total / groups);
        const remainder = total % groups;
        const sizes = [];
        for (let i = 0; i < groups; i += 1) {
            const size = base + (i < remainder ? 1 : 0);
            if (size <= 0) return [];
            sizes.push(size);
        }
        return sizes;
    }

    function factorFromSeries(value) {
        if (!Number.isFinite(value)) return null;
        return 1 + value / 100;
    }

    function ensureEvenNumber(value) {
        if (!Number.isFinite(value)) return 0;
        const rounded = Math.floor(value);
        return rounded % 2 === 0 ? rounded : rounded - 1;
    }

    function clamp01(value) {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }

    function ratio(numerator, denominator) {
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
        return numerator / denominator;
    }

    function median(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    function max(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        return values.reduce((acc, value) => (Number.isFinite(value) && value > acc ? value : acc), -Infinity);
    }

    function normalCdf(x) {
        return 0.5 * (1 + erf(x / Math.SQRT2));
    }

    function erf(x) {
        const sign = x >= 0 ? 1 : -1;
        const absX = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + p * absX);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
        return sign * y;
    }

    function inverseStandardNormal(p) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
        const b = [-8.4735109309, 23.08336743743, -21.06224101826, 3.13082909833];
        const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
            0.0276438810333863, 0.0038405729373609, 0.0003951896511919,
            0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
        let x = p - 0.5;
        if (Math.abs(x) < 0.42) {
            const r = x * x;
            const numerator = x * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]);
            const denominator = (((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1;
            return numerator / denominator;
        }
        let r = p;
        if (x > 0) {
            r = 1 - p;
        }
        r = Math.log(-Math.log(r));
        let result = c[0];
        for (let i = 1; i < c.length; i += 1) {
            result += c[i] * Math.pow(r, i);
        }
        return x < 0 ? -result : result;
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return '-';
        return `${(value * 100).toFixed(1)}%`;
    }

    function formatScore(value) {
        if (!Number.isFinite(value)) return '-';
        return `${value.toFixed(1)}`;
    }

    function resolveToneClass(tone) {
        switch (tone) {
            case 'success':
                return 'bg-emerald-50 border-emerald-200 text-emerald-700';
            case 'warning':
                return 'bg-amber-50 border-amber-200 text-amber-700';
            case 'danger':
                return 'bg-rose-50 border-rose-200 text-rose-700';
            default:
                return 'bg-sky-50 border-sky-200 text-sky-700';
        }
    }

    global.lazyOverfit = Object.assign({}, global.lazyOverfit, {
        version: MODULE_VERSION,
        prepareResultAnalytics,
        aggregateBatchAnalytics,
        computeOverfitScore,
        renderSummary,
    });
})(typeof window !== 'undefined' ? window : self);
