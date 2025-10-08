// --- OFI 綜合評分模組 - LB-OFI-RATING-20250923A ---
// 本模組依據 LazyBacktest OFI 規格，提供 Flow / Strategy 雙層評分與 OFI 總分
// 核心入口：lazybacktestOfi.calculate(results, options?)

(function() {
    const VERSION = 'LB-OFI-RATING-20250923A';

    const DEFAULT_CONFIG = {
        slices: 10,
        aggregator: 'mean',
        maxCscvSamples: 512,
        flowWeights: { pbo: 0.6, spa: 0.2, mcs: 0.2 },
        strategyWeights: { dsrPsr: 0.25, oos: 0.25, wf: 0.25, island: 0.25 },
        finalWeights: { flow: 0.3, strategy: 0.7 },
        spaAlpha: 0.05,
        psrThreshold: 0,
        verdicts: [
            { min: 80, label: '穩健', icon: '👍' },
            { min: 65, label: '良好', icon: '✅' },
            { min: 50, label: '一般', icon: '😐' },
            { min: 0, label: '高風險', icon: '⚠️' }
        ],
        diagnostics: true
    };

    const EPSILON = 1e-9;

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function clamp01(value) {
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.min(1, value));
    }

    function safeNumber(value, fallback = 0) {
        return Number.isFinite(value) ? value : fallback;
    }

    function mean(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const finite = values.filter((v) => Number.isFinite(v));
        if (finite.length === 0) return null;
        return finite.reduce((sum, v) => sum + v, 0) / finite.length;
    }

    function median(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
        if (finite.length === 0) return null;
        const mid = Math.floor(finite.length / 2);
        if (finite.length % 2 === 0) {
            return (finite[mid - 1] + finite[mid]) / 2;
        }
        return finite[mid];
    }

    function percentile(values, p) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
        if (finite.length === 0) return null;
        if (p <= 0) return finite[0];
        if (p >= 1) return finite[finite.length - 1];
        const index = (finite.length - 1) * p;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return finite[lower];
        const weight = index - lower;
        return finite[lower] * (1 - weight) + finite[upper] * weight;
    }

    function iqr(values) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const q1 = percentile(values, 0.25);
        const q3 = percentile(values, 0.75);
        if (!Number.isFinite(q1) || !Number.isFinite(q3)) return null;
        return q3 - q1;
    }

    function variance(values) {
        if (!Array.isArray(values) || values.length < 2) return null;
        const avg = mean(values);
        if (!Number.isFinite(avg)) return null;
        const finite = values.filter((v) => Number.isFinite(v));
        if (finite.length < 2) return null;
        const varSum = finite.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0);
        return varSum / finite.length;
    }

    function stdDev(values) {
        const varianceValue = variance(values);
        return Number.isFinite(varianceValue) ? Math.sqrt(varianceValue) : null;
    }

    function normalCdf(z) {
        if (!Number.isFinite(z)) return 0.5;
        return 0.5 * (1 + erf(z / Math.SQRT2));
    }

    function erf(x) {
        // Abramowitz and Stegun formula 7.1.26 approximation
        const sign = x >= 0 ? 1 : -1;
        const absX = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * absX);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const expTerm = Math.exp(-absX * absX);
        const poly = (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t;
        return sign * (1 - poly * expTerm);
    }

    function combineWeightedScores(values, weights) {
        const entries = Object.keys(weights).map((key) => ({
            key,
            weight: weights[key],
            value: values[key]
        }));
        const available = entries.filter((entry) => Number.isFinite(entry.value));
        if (available.length === 0) return null;
        const totalWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
        if (totalWeight <= 0) return null;
        const normalized = available.map((entry) => ({
            weight: entry.weight / totalWeight,
            value: entry.value
        }));
        const score = normalized.reduce((sum, entry) => sum + entry.weight * entry.value, 0);
        return score;
    }

    function computeDailyReturnsFromCumulative(cumulativeArray) {
        if (!Array.isArray(cumulativeArray) || cumulativeArray.length < 2) return [];
        const daily = [];
        for (let i = 1; i < cumulativeArray.length; i += 1) {
            const prev = cumulativeArray[i - 1];
            const curr = cumulativeArray[i];
            if (Number.isFinite(prev) && Number.isFinite(curr)) {
                daily.push((curr - prev) / 100);
            }
        }
        return daily;
    }

    function computePerformanceMatrix(results, slices, aggregator) {
        const matrix = [];
        const sliceCount = Math.max(2, slices);
        results.forEach((result, index) => {
            const cumulative = Array.isArray(result?.strategyReturns) ? result.strategyReturns : [];
            const daily = computeDailyReturnsFromCumulative(cumulative);
            const blockValues = [];
            if (daily.length === 0) {
                matrix[index] = blockValues;
                return;
            }
            for (let s = 0; s < sliceCount; s += 1) {
                const start = Math.floor((daily.length * s) / sliceCount);
                const end = Math.floor((daily.length * (s + 1)) / sliceCount);
                const slice = daily.slice(start, Math.max(start + 1, end));
                if (slice.length === 0) {
                    blockValues.push(0);
                } else if (aggregator === 'median') {
                    blockValues.push(median(slice));
                } else {
                    blockValues.push(mean(slice));
                }
            }
            matrix[index] = blockValues;
        });
        return matrix;
    }

    function generateCscvSplits(sliceCount, maxSamples) {
        const indices = Array.from({ length: sliceCount }, (_, i) => i);
        const choose = sliceCount / 2;
        const combos = [];

        function recurse(start, combo) {
            if (combo.length === choose) {
                combos.push(combo.slice());
                return;
            }
            for (let i = start; i < indices.length; i += 1) {
                combo.push(indices[i]);
                recurse(i + 1, combo);
                combo.pop();
                if (combos.length >= maxSamples) return;
            }
        }

        recurse(0, []);
        return combos.map((isIndices) => {
            const isSet = new Set(isIndices);
            const os = indices.filter((idx) => !isSet.has(idx));
            return { is: isIndices, os };
        });
    }

    function aggregateBlocks(blocks, indices) {
        if (!Array.isArray(blocks) || blocks.length === 0) return 0;
        const selected = indices.map((idx) => blocks[idx]).filter((v) => Number.isFinite(v));
        if (selected.length === 0) return 0;
        return mean(selected);
    }

    function computePbo(matrix, splits, context) {
        const K = matrix.length;
        if (K === 0 || splits.length === 0) {
            return { pbo: null, lambdaValues: [], qValues: [] };
        }
        const lambdaValues = [];
        const qValues = [];
        const oosByStrategy = Array.from({ length: K }, () => []);

        splits.forEach((split) => {
            const isScores = matrix.map((row) => aggregateBlocks(row, split.is));
            const osScores = matrix.map((row) => aggregateBlocks(row, split.os));
            const championIndex = isScores.reduce((bestIndex, value, idx) => {
                if (!Number.isFinite(value)) return bestIndex;
                if (bestIndex === -1) return idx;
                return value > isScores[bestIndex] ? idx : bestIndex;
            }, -1);
            if (championIndex === -1) {
                lambdaValues.push(null);
                qValues.push(null);
                return;
            }
            const championOos = osScores[championIndex];
            osScores.forEach((score, idx) => {
                if (Number.isFinite(score)) {
                    oosByStrategy[idx].push(score);
                }
            });
            const ranked = osScores
                .map((value, idx) => ({ value, idx }))
                .filter((item) => Number.isFinite(item.value))
                .sort((a, b) => b.value - a.value);
            const rank = ranked.findIndex((item) => item.idx === championIndex);
            const q = (rank + 1) / (ranked.length + 1);
            const lambda = Math.log(q / Math.max(EPSILON, 1 - q));
            lambdaValues.push(lambda);
            qValues.push(q);
        });

        const negativeLambdaCount = lambdaValues.filter((lambda) => Number.isFinite(lambda) && lambda < 0).length;
        const validLambdaCount = lambdaValues.filter((lambda) => Number.isFinite(lambda)).length;
        const pbo = validLambdaCount === 0 ? null : negativeLambdaCount / validLambdaCount;

        if (context) {
            context.oosByStrategy = oosByStrategy;
            context.lambdaValues = lambdaValues;
            context.qValues = qValues;
        }

        return { pbo, lambdaValues, qValues, oosByStrategy };
    }

    function computeSpaScore(oosByStrategy, alpha) {
        if (!Array.isArray(oosByStrategy) || oosByStrategy.length === 0) {
            return { spaScore: null, pValues: [] };
        }
        const pValues = oosByStrategy.map((values) => {
            if (!Array.isArray(values) || values.length < 2) return 1;
            const meanValue = mean(values);
            const sdValue = stdDev(values);
            if (!Number.isFinite(sdValue) || sdValue === 0) {
                return meanValue > 0 ? 0 : 1;
            }
            const tStatistic = (meanValue / sdValue) * Math.sqrt(values.length);
            const pValue = 1 - normalCdf(tStatistic);
            return clamp01(pValue);
        });
        const validPValues = pValues.filter((p) => Number.isFinite(p));
        if (validPValues.length === 0) {
            return { spaScore: null, pValues };
        }
        const passed = validPValues.filter((p) => p < alpha).length;
        const spaScore = passed / validPValues.length;
        return { spaScore, pValues };
    }

    function computeMcsScore(oosByStrategy) {
        if (!Array.isArray(oosByStrategy) || oosByStrategy.length === 0) {
            return { mcsScore: null, survivors: [] };
        }
        const means = oosByStrategy.map((values) => mean(values));
        const finiteMeans = means.filter((m) => Number.isFinite(m));
        if (finiteMeans.length === 0) {
            return { mcsScore: null, survivors: [] };
        }
        const bestMean = Math.max(...finiteMeans);
        const globalStd = stdDev(finiteMeans) || 0;
        const threshold = bestMean - globalStd;
        const survivors = means.map((value, idx) => ({
            idx,
            value,
            survive: Number.isFinite(value) ? value >= threshold : false
        }));
        const survivorCount = survivors.filter((item) => item.survive).length;
        const mcsScore = survivorCount / survivors.length;
        return { mcsScore, survivors };
    }

    function normalizeVector(values, lowerPercentile, upperPercentile) {
        const lower = percentile(values, lowerPercentile);
        const upper = percentile(values, upperPercentile);
        return values.map((value) => {
            if (!Number.isFinite(value)) return null;
            if (!Number.isFinite(lower) || !Number.isFinite(upper) || Math.abs(upper - lower) < EPSILON) {
                return clamp01((value - (lower || 0)));
            }
            const normalized = (value - lower) / (upper - lower);
            return clamp01(normalized);
        });
    }

    function computeOosScores(oosByStrategy, alphaWeight = 0.6) {
        const medians = oosByStrategy.map((values) => median(values));
        const iqrValues = oosByStrategy.map((values) => iqr(values));
        const midNorm = normalizeVector(medians, 0.1, 0.9);
        const iqrNorm = normalizeVector(iqrValues, 0.1, 0.9);
        const scores = oosByStrategy.map((_, idx) => {
            const mid = midNorm[idx];
            const spread = iqrNorm[idx];
            if (!Number.isFinite(mid) || !Number.isFinite(spread)) return null;
            const score = alphaWeight * mid + (1 - alphaWeight) * (1 - spread);
            return clamp01(score);
        });
        return { scores, medians, iqrs: iqrValues, midNorm, iqrNorm };
    }

    function computeWalkForwardScore(result) {
        const wf = result?.walkForward || result?.walkForwardSummary || result?.rollingTest || null;
        if (!wf) return null;
        let windows = [];
        if (Array.isArray(wf?.windows)) {
            windows = wf.windows;
        } else if (Array.isArray(wf)) {
            windows = wf;
        } else if (Array.isArray(result?.walkForwardResults)) {
            windows = result.walkForwardResults;
        }
        if (!Array.isArray(windows) || windows.length === 0) return null;
        const returns = [];
        windows.forEach((win) => {
            const oos = win?.testing || win?.oos || win?.test;
            if (oos && Number.isFinite(oos.returnRate)) {
                returns.push(oos.returnRate);
            } else if (Number.isFinite(win?.returnRate)) {
                returns.push(win.returnRate);
            }
        });
        if (returns.length === 0) return null;
        const wins = returns.filter((value) => value > 0).length;
        const winRate = wins / returns.length;
        const wrNorm = clamp01(winRate);
        const retNormArray = normalizeVector(returns, 0.1, 0.9);
        const retIndex = returns.map((value, idx) => ({ value, idx })).sort((a, b) => a.value - b.value);
        const retNorm = retNormArray[retIndex[retIndex.length - 1]?.idx ?? 0] ?? clamp01(mean(retNormArray.filter(Number.isFinite)));
        if (!Number.isFinite(retNorm)) return null;
        const score = 0.6 * wrNorm + 0.4 * retNorm;
        return clamp01(score);
    }

    function computeIslandScores(results) {
        const descriptors = [];
        results.forEach((result, idx) => {
            const sensitivity = result?.parameterSensitivity;
            if (!sensitivity || !Array.isArray(sensitivity.groups)) {
                return;
            }
            sensitivity.groups.forEach((group) => {
                if (!Array.isArray(group?.parameters)) return;
                group.parameters.forEach((param) => {
                    const scenarios = Array.isArray(param?.scenarios)
                        ? param.scenarios.filter((scenario) => scenario && scenario.run && Number.isFinite(scenario.run.returnRate))
                        : [];
                    if (scenarios.length === 0) return;
                    const positive = scenarios.filter((scenario) => Number.isFinite(scenario.deltaReturn) && scenario.deltaReturn >= 0);
                    if (positive.length === 0) return;
                    const negative = scenarios.filter((scenario) => Number.isFinite(scenario.deltaReturn) && scenario.deltaReturn < 0);
                    const area = positive.length;
                    const drifts = positive
                        .map((scenario) => Number.isFinite(scenario.driftPercent) ? Math.abs(scenario.driftPercent) : null)
                        .filter((value) => Number.isFinite(value));
                    const driftIqr = drifts.length > 0 ? iqr(drifts) : 0;
                    const muCore = mean(positive.map((scenario) => scenario.deltaReturn));
                    const muEdge = negative.length > 0 ? mean(negative.map((scenario) => scenario.deltaReturn)) : 0;
                    const edgeSharpness = (muCore - muEdge) / (Math.abs(muCore) + EPSILON);
                    descriptors.push({
                        strategyIndex: idx,
                        groupKey: group.key,
                        paramKey: param.key,
                        area,
                        driftIqr,
                        edgeSharpness,
                        baseValue: param.baseValue
                    });
                });
            });
        });
        if (descriptors.length === 0) {
            return { islandScores: results.map(() => null) };
        }
        const areas = descriptors.map((desc) => desc.area);
        const drifts = descriptors.map((desc) => desc.driftIqr);
        const edgePenaltyCandidates = descriptors.map((desc) => Math.max(0, -desc.edgeSharpness));
        const areaNorm = normalizeVector(areas, 0.25, 0.95);
        const driftNorm = normalizeVector(drifts, 0.25, 0.95);
        const edgeNorm = normalizeVector(edgePenaltyCandidates, 0.25, 0.95);
        const descriptorScores = descriptors.map((desc, idx) => {
            const a = areaNorm[idx];
            const d = driftNorm[idx];
            const e = edgeNorm[idx];
            const score = clamp01((Number.isFinite(a) ? a : 0) * (1 - (Number.isFinite(d) ? d : 0)) * (1 - (Number.isFinite(e) ? e : 0)));
            return { ...desc, normalizedScore: score };
        });
        const groupedByStrategy = descriptorScores.reduce((acc, desc) => {
            if (!acc[desc.strategyIndex]) acc[desc.strategyIndex] = [];
            acc[desc.strategyIndex].push(desc);
            return acc;
        }, {});
        const islandScores = results.map((_, idx) => {
            const list = groupedByStrategy[idx];
            if (!Array.isArray(list) || list.length === 0) return null;
            const best = list.reduce((max, item) => (item.normalizedScore > max.normalizedScore ? item : max), list[0]);
            const maxScore = Math.max(...list.map((item) => item.normalizedScore));
            if (!Number.isFinite(maxScore) || maxScore <= 0) return null;
            return clamp01(best.normalizedScore / maxScore);
        });
        return { islandScores, descriptors: descriptorScores };
    }

    function computeDsrPsrScores(results, dailyCache) {
        return results.map((result, idx) => {
            const cumulative = Array.isArray(result?.strategyReturns) ? result.strategyReturns : [];
            let daily = dailyCache[idx];
            if (!daily) {
                daily = computeDailyReturnsFromCumulative(cumulative);
                dailyCache[idx] = daily;
            }
            if (!Array.isArray(daily) || daily.length < 20) return { psr: null, dsr: null, combined: null };
            const meanDaily = mean(daily);
            const stdDaily = stdDev(daily);
            if (!Number.isFinite(meanDaily) || !Number.isFinite(stdDaily) || stdDaily === 0) {
                return { psr: null, dsr: null, combined: null };
            }
            const sr = (meanDaily / stdDaily) * Math.sqrt(252);
            const psr = normalCdf((sr - 0) * Math.sqrt(daily.length - 1));
            const skew = computeSkewness(daily);
            const kurt = computeExcessKurtosis(daily);
            const numerator = sr * Math.sqrt(daily.length - 1);
            const denominator = Math.sqrt(1 - skew * sr + ((kurt - 1) / 4) * sr * sr);
            const dsrProbability = normalCdf(numerator / Math.max(denominator, EPSILON));
            const combined = Math.max(clamp01(dsrProbability), clamp01(psr));
            return {
                psr: clamp01(psr),
                dsr: clamp01(dsrProbability),
                combined: clamp01(combined),
                sr,
                skew,
                kurt
            };
        });
    }

    function computeSkewness(values) {
        if (!Array.isArray(values) || values.length < 3) return 0;
        const avg = mean(values);
        const sd = stdDev(values);
        if (!Number.isFinite(sd) || sd === 0) return 0;
        const n = values.length;
        const skewSum = values.reduce((sum, value) => sum + Math.pow(value - avg, 3), 0);
        return (skewSum / n) / Math.pow(sd, 3);
    }

    function computeExcessKurtosis(values) {
        if (!Array.isArray(values) || values.length < 4) return 3;
        const avg = mean(values);
        const sd = stdDev(values);
        if (!Number.isFinite(sd) || sd === 0) return 3;
        const n = values.length;
        const kurtSum = values.reduce((sum, value) => sum + Math.pow(value - avg, 4), 0);
        return (kurtSum / n) / Math.pow(sd, 4);
    }

    function assignVerdict(score, verdicts) {
        if (!Number.isFinite(score)) return { label: '資料不足', icon: '❔' };
        const sorted = verdicts.slice().sort((a, b) => b.min - a.min);
        const found = sorted.find((item) => score >= item.min);
        return found || sorted[sorted.length - 1];
    }

    function calculate(results, options = {}) {
        const config = { ...DEFAULT_CONFIG, ...(options || {}) };
        const effectiveResults = Array.isArray(results) ? results : [];
        const performanceMatrix = computePerformanceMatrix(
            effectiveResults,
            config.slices,
            config.aggregator
        );
        const splits = generateCscvSplits(config.slices, config.maxCscvSamples);
        const context = { oosByStrategy: [] };
        const pboResult = computePbo(performanceMatrix, splits, context);
        const pbo = Number.isFinite(pboResult.pbo) ? clamp01(1 - pboResult.pbo) : null;
        const spaResult = computeSpaScore(context.oosByStrategy, config.spaAlpha);
        const mcsResult = computeMcsScore(context.oosByStrategy);
        const flowScore = combineWeightedScores(
            { pbo, spa: spaResult.spaScore, mcs: mcsResult.mcsScore },
            config.flowWeights
        );

        const oosScore = computeOosScores(context.oosByStrategy);
        const dailyCache = {};
        const dsrPsrScores = computeDsrPsrScores(effectiveResults, dailyCache);
        const islandScore = computeIslandScores(effectiveResults);
        const strategyScores = effectiveResults.map((result, idx) => {
            const wfScore = computeWalkForwardScore(result);
            const componentScores = {
                dsrPsr: dsrPsrScores[idx]?.combined ?? null,
                oos: oosScore.scores[idx] ?? null,
                wf: wfScore,
                island: islandScore.islandScores[idx] ?? null
            };
            const strategyScore = combineWeightedScores(componentScores, config.strategyWeights);
            return {
                strategyScore,
                componentScores,
                dsrPsrDetails: dsrPsrScores[idx] || null,
                wfScore,
                islandDescriptor: islandScore.descriptors?.filter((desc) => desc.strategyIndex === idx) || [],
                oosDistribution: context.oosByStrategy[idx] || []
            };
        });

        const ofiScores = strategyScores.map((scoreObj) => {
            if (!scoreObj) return null;
            const combined = combineWeightedScores(
                { flow: flowScore, strategy: scoreObj.strategyScore },
                config.finalWeights
            );
            return Number.isFinite(combined) ? clamp01(combined) : null;
        });

        const verdicts = ofiScores.map((score) => assignVerdict(score ? score * 100 : null, config.verdicts));

        return {
            version: VERSION,
            config,
            flow: {
                score: flowScore,
                components: {
                    pbo,
                    spa: spaResult.spaScore,
                    mcs: mcsResult.mcsScore
                },
                details: {
                    pboRaw: pboResult,
                    spaRaw: spaResult,
                    mcsRaw: mcsResult
                }
            },
            strategies: strategyScores.map((strategy, idx) => ({
                score: strategy?.strategyScore ?? null,
                components: strategy?.componentScores ?? {},
                dsrPsr: strategy?.dsrPsrDetails ?? null,
                wfScore: strategy?.wfScore ?? null,
                islandDescriptors: strategy?.islandDescriptor ?? [],
                oosDistribution: strategy?.oosDistribution ?? [],
                ofi: ofiScores[idx],
                verdict: verdicts[idx]
            })),
            ofiScores,
            verdicts
        };
    }

    function attachScores(results, options) {
        const calculation = calculate(results, options);
        results.forEach((result, idx) => {
            if (!result || typeof result !== 'object') return;
            const strategyData = calculation.strategies[idx];
            result.ofiScore = Number.isFinite(strategyData?.ofi) ? strategyData.ofi * 100 : null;
            result.ofiVerdict = strategyData?.verdict || null;
            result.ofiDetails = {
                version: calculation.version,
                flow: calculation.flow,
                strategy: strategyData,
                config: calculation.config
            };
        });
        return calculation;
    }

    window.lazybacktestOfi = {
        version: VERSION,
        calculate,
        attachScores,
        utils: {
            mean,
            median,
            percentile,
            iqr,
            clamp01,
            normalCdf
        }
    };
})();
