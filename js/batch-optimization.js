// --- 批量策略優化功能 - v1.0 ---
// Patch note: small harmless edit to refresh editor diagnostics

// 策略名稱映射：批量優化名稱 -> Worker名稱
function getWorkerStrategyName(batchStrategyName) {
    const strategyNameMap = {
        // 出場策略映射
        'ma_cross_exit': 'ma_cross',
        'ema_cross_exit': 'ema_cross',
        'k_d_cross_exit': 'k_d_cross',
        'macd_cross_exit': 'macd_cross',
        'rsi_overbought_exit': 'rsi_overbought',
        'williams_overbought_exit': 'williams_overbought',
        'ma_below_exit': 'ma_below',
        'rsi_reversal_exit': 'rsi_reversal',
        'williams_reversal_exit': 'williams_reversal',
        
        // 做空入場策略映射
        'short_ma_cross': 'short_ma_cross',
        'short_ema_cross': 'short_ema_cross',
        'short_k_d_cross': 'short_k_d_cross',
        'short_macd_cross': 'short_macd_cross',
        'short_rsi_overbought': 'short_rsi_overbought',
        'short_williams_overbought': 'short_williams_overbought',
        'short_ma_below': 'short_ma_below',
        'short_rsi_reversal': 'short_rsi_reversal',
        'short_williams_reversal': 'short_williams_reversal',
        
        // 回補策略映射
        'cover_ma_cross': 'cover_ma_cross',
        'cover_ema_cross': 'cover_ema_cross',
        'cover_k_d_cross': 'cover_k_d_cross',
        'cover_macd_cross': 'cover_macd_cross',
        'cover_rsi_oversold': 'cover_rsi_oversold',
        'cover_williams_oversold': 'cover_williams_oversold',
        'cover_ma_above': 'cover_ma_above',
        'cover_rsi_reversal': 'cover_rsi_reversal',
        'cover_williams_reversal': 'cover_williams_reversal'
    };
    
    // 如果有映射則返回映射的名稱，否則返回原名稱
    return strategyNameMap[batchStrategyName] || batchStrategyName;
}

// 全局變量
let batchOptimizationWorker = null;
let batchOptimizationResults = [];
let batchOptimizationConfig = {};
let isBatchOptimizationStopped = false;
let batchOptimizationStartTime = null;

// Worker / per-combination 狀態追蹤
let batchWorkerStatus = {
    concurrencyLimit: 0,
    inFlightCount: 0,
    entries: [] // { index, buyStrategy, sellStrategy, status: 'queued'|'running'|'done'|'error', startTime, endTime }
};

// --- 策略穩健度 (OFI) 版本與權重設定 ---
const BATCH_OFI_VERSION = 'LB-OFI-20240701B';
const OFI_DEFAULT_ALPHA = 0.1;
const OFI_DEFAULT_BLOCKS = 10;
const OFI_MAX_SPLITS = 400; // 若超過此值則抽樣，避免在行動裝置上卡頓
const OFI_SPA_SIGNIFICANCE = 0.1;
const OFI_SPA_BOOTSTRAP_SAMPLES = 300;
const OFI_SPA_AVG_BLOCK_LENGTH = 10;
const OFI_COMPONENT_WEIGHTS = {
    cPBO: 0.35,
    level: 0.20,
    stability: 0.15,
    island: 0.20,
    dsr: 0.10
};

// --- OFI 計算公用函式 ---
function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function safeArray(arrayLike) {
    return Array.isArray(arrayLike) ? arrayLike : [];
}

function computeMedian(values) {
    const arr = safeArray(values).filter((v) => Number.isFinite(v));
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function computeIQR(values) {
    const arr = safeArray(values).filter((v) => Number.isFinite(v));
    if (arr.length < 4) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const q1Index = (sorted.length - 1) * 0.25;
    const q3Index = (sorted.length - 1) * 0.75;
    const lower = interpolateQuantile(sorted, q1Index);
    const upper = interpolateQuantile(sorted, q3Index);
    return upper - lower;
}

function interpolateQuantile(sortedValues, index) {
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex];
    }
    const weight = index - lowerIndex;
    return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function decideCSCVBlockCount(minLength, preferred) {
    if (!Number.isFinite(minLength) || minLength < 32) {
        return 0;
    }
    const evenCandidates = [preferred, 12, 10, 8, 6, 4].filter((candidate) => {
        if (!Number.isFinite(candidate)) return false;
        if (candidate <= 0) return false;
        if (candidate % 2 !== 0) return false;
        return minLength / candidate >= 8; // 每個區塊至少保留 8 筆資料
    });
    if (evenCandidates.length > 0) {
        return evenCandidates[0];
    }
    return 0;
}

function buildBlockBoundaries(length, blockCount) {
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(blockCount) || blockCount <= 0) {
        return [];
    }
    const baseSize = Math.floor(length / blockCount);
    const remainder = length % blockCount;
    const boundaries = [];
    let start = 0;
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
        const extra = blockIndex < remainder ? 1 : 0;
        const size = baseSize + extra;
        const end = start + size - 1;
        boundaries.push({ start, end });
        start = end + 1;
    }
    return boundaries;
}

function computeBlockReturnsFromCumulative(cumulativeReturns, blockBoundaries) {
    const cleanSeries = safeArray(cumulativeReturns).map((value) => (Number.isFinite(value) ? value : null));
    if (cleanSeries.length === 0 || !Array.isArray(blockBoundaries) || blockBoundaries.length === 0) {
        return [];
    }
    let lastKnown = 0;
    const forwardFilled = cleanSeries.map((value) => {
        if (Number.isFinite(value)) {
            lastKnown = value;
            return value;
        }
        return lastKnown;
    });
    const blockReturns = blockBoundaries.map(({ start, end }) => {
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= forwardFilled.length || end <= start) {
            return NaN;
        }
        const startValue = forwardFilled[start];
        const endValue = forwardFilled[end];
        if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
            return NaN;
        }
        const startGrowth = 1 + startValue / 100;
        const endGrowth = 1 + endValue / 100;
        if (startGrowth <= 0 || endGrowth <= 0) {
            return NaN;
        }
        return (endGrowth / startGrowth) - 1;
    });
    return blockReturns;
}

function computeDailyReturnsFromCumulative(cumulativeReturns) {
    const cleanSeries = safeArray(cumulativeReturns)
        .map((value) => (Number.isFinite(value) ? value : null))
        .filter((value) => value !== null);
    if (cleanSeries.length <= 1) {
        return [];
    }
    const daily = [];
    let prev = cleanSeries[0];
    for (let i = 1; i < cleanSeries.length; i += 1) {
        const current = cleanSeries[i];
        const prevGrowth = 1 + prev / 100;
        const currentGrowth = 1 + current / 100;
        if (prevGrowth > 0 && currentGrowth > 0) {
            daily.push(currentGrowth / prevGrowth - 1);
        }
        prev = current;
    }
    return daily;
}

function computeDescendingQuantiles(values) {
    const n = values.length;
    if (n === 0) return [];
    const pairs = values.map((value, index) => ({ value: Number.isFinite(value) ? value : -Infinity, index }));
    pairs.sort((a, b) => b.value - a.value);
    const quantiles = new Array(n).fill(0);
    let i = 0;
    while (i < pairs.length) {
        let j = i + 1;
        while (j < pairs.length && pairs[j].value === pairs[i].value) {
            j += 1;
        }
        const avgRank = (i + (j - 1)) / 2;
        let quantile = 1;
        if (n > 1) {
            quantile = 1 - avgRank / (n - 1);
        }
        for (let k = i; k < j; k += 1) {
            quantiles[pairs[k].index] = clamp01(quantile);
        }
        i = j;
    }
    return quantiles;
}

function averageByIndices(values, indices) {
    const arr = safeArray(values);
    const subset = indices
        .map((index) => arr[index])
        .filter((value) => Number.isFinite(value));
    if (subset.length === 0) {
        return NaN;
    }
    const total = subset.reduce((sum, value) => sum + value, 0);
    return total / subset.length;
}

function generateCSCVSplits(blockCount, maxSplits) {
    if (!Number.isFinite(blockCount) || blockCount <= 0 || blockCount % 2 !== 0) {
        return [];
    }
    const half = blockCount / 2;
    const indices = Array.from({ length: blockCount }, (_, index) => index);
    const splits = [];
    const combo = [];

    function backtrack(start) {
        if (combo.length === half) {
            const inSample = combo.slice();
            const outSample = indices.filter((index) => !inSample.includes(index));
            splits.push({ is: inSample, oos: outSample });
            return;
        }
        for (let i = start; i <= blockCount - (half - combo.length); i += 1) {
            combo.push(indices[i]);
            backtrack(i + 1);
            combo.pop();
        }
    }

    backtrack(0);

    if (Number.isFinite(maxSplits) && maxSplits > 0 && splits.length > maxSplits) {
        const step = Math.ceil(splits.length / maxSplits);
        const sampled = [];
        for (let i = 0; i < splits.length; i += step) {
            sampled.push(splits[i]);
        }
        return sampled;
    }
    return splits;
}

function computeSkewness(values) {
    const arr = safeArray(values).filter((value) => Number.isFinite(value));
    if (arr.length < 3) return 0;
    const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
    const diffs = arr.map((value) => value - mean);
    const s2 = diffs.reduce((sum, diff) => sum + diff * diff, 0) / arr.length;
    const s = Math.sqrt(s2);
    if (s === 0) return 0;
    const skew =
        diffs.reduce((sum, diff) => sum + Math.pow(diff, 3), 0) /
        arr.length /
        Math.pow(s, 3);
    return skew;
}

function computeExcessKurtosis(values) {
    const arr = safeArray(values).filter((value) => Number.isFinite(value));
    if (arr.length < 4) return 0;
    const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
    const diffs = arr.map((value) => value - mean);
    const s2 = diffs.reduce((sum, diff) => sum + diff * diff, 0) / arr.length;
    if (s2 === 0) return 0;
    const kurtosis =
        diffs.reduce((sum, diff) => sum + Math.pow(diff, 4), 0) /
        arr.length /
        (s2 * s2);
    return kurtosis - 3; // excess kurtosis
}

function normalCDF(x) {
    const z = Math.max(-10, Math.min(10, x));
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    // Abramowitz and Stegun formula 7.1.26
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * absX);
    const y =
        1 -
        (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
}

function computeDeflatedSharpeRatio({ dailyReturns, sharpeRatio, trials }) {
    const returns = safeArray(dailyReturns).filter((value) => Number.isFinite(value));
    if (returns.length < 3 || !Number.isFinite(sharpeRatio)) {
        return 0;
    }
    const n = returns.length;
    const skewness = computeSkewness(returns);
    const excessKurtosis = computeExcessKurtosis(returns);
    const sr = sharpeRatio;
    const varianceSR = Math.max(
        1e-12,
        (1 - skewness * sr + ((excessKurtosis + 3 - 1) / 4) * sr * sr) / (n - 1)
    );
    const srStd = Math.sqrt(varianceSR);
    const totalTrials = Math.max(1, Number.isFinite(trials) ? Math.floor(trials) : 1);
    const extremeAdjustment = Math.sqrt(2 * Math.log(totalTrials));
    const correction =
        srStd *
        (extremeAdjustment -
            (Math.log(Math.log(totalTrials)) + Math.log(4 * Math.PI)) /
                (2 * extremeAdjustment || 1));
    const srMin = correction;
    const zScore = srStd > 0 ? (sr - srMin) / srStd : 0;
    return clamp01(normalCDF(zScore));
}

function logit(value) {
    const clamped = Math.min(1 - 1e-6, Math.max(1e-6, value));
    return Math.log(clamped / (1 - clamped));
}

function computeMean(values) {
    const arr = safeArray(values).filter((value) => Number.isFinite(value));
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, value) => acc + value, 0);
    return sum / arr.length;
}

function computeStd(values, providedMean) {
    const arr = safeArray(values).filter((value) => Number.isFinite(value));
    if (arr.length < 2) return 0;
    const mean = Number.isFinite(providedMean) ? providedMean : computeMean(arr);
    const variance = arr.reduce((acc, value) => acc + (value - mean) * (value - mean), 0) / (arr.length - 1);
    return Math.sqrt(Math.max(variance, 0));
}

function stationaryBootstrapSample(series, sampleSize, avgBlockLength) {
    const data = safeArray(series).filter((value) => Number.isFinite(value));
    if (data.length === 0) return [];
    const length = Math.max(1, Number.isFinite(sampleSize) ? Math.floor(sampleSize) : data.length);
    const blockLength = Math.max(1, Number.isFinite(avgBlockLength) ? avgBlockLength : 1);
    const stayProbability = Math.max(0, Math.min(1, 1 - 1 / blockLength));
    const result = new Array(length);
    let index = Math.floor(Math.random() * data.length);
    for (let i = 0; i < length; i += 1) {
        result[i] = data[index];
        if (Math.random() > stayProbability) {
            index = Math.floor(Math.random() * data.length);
        } else {
            index = (index + 1) % data.length;
        }
    }
    return result;
}

function computeSpaMcsMetrics(blockData, options = {}) {
    const significance = Number.isFinite(options.significance)
        ? options.significance
        : OFI_SPA_SIGNIFICANCE;
    const bootstrapSamples = Number.isFinite(options.bootstrapSamples)
        ? Math.max(50, Math.floor(options.bootstrapSamples))
        : OFI_SPA_BOOTSTRAP_SAMPLES;
    const avgBlockLength = Number.isFinite(options.avgBlockLength)
        ? Math.max(1, options.avgBlockLength)
        : OFI_SPA_AVG_BLOCK_LENGTH;
    const minSampleSize = Number.isFinite(options.minSampleSize)
        ? Math.max(30, Math.floor(options.minSampleSize))
        : 60;

    const metrics = blockData.map(() => ({
        spaStatistic: null,
        spaPValue: null,
        spaPassed: false,
        mcsDelta: null,
        mcsPValue: null,
        mcsIncluded: false
    }));

    const validEntries = blockData
        .map((data, index) => {
            const series = safeArray(data?.dailyReturns).filter((value) => Number.isFinite(value));
            return series.length >= minSampleSize ? { index, series } : null;
        })
        .filter((entry) => entry !== null);

    if (validEntries.length === 0) {
        return metrics;
    }

    const observedMeans = validEntries.map((entry) => computeMean(entry.series));
    const observedStds = validEntries.map((entry, idx) => computeStd(entry.series, observedMeans[idx]));
    const sampleSizes = validEntries.map((entry) => entry.series.length);
    const spaStatistics = observedMeans.map((mean, idx) => {
        const std = observedStds[idx];
        if (!Number.isFinite(std) || std <= 1e-12) {
            return mean > 0 ? Infinity : 0;
        }
        return Math.max(0, (Math.sqrt(sampleSizes[idx]) * mean) / std);
    });
    const bestObservedMean = Math.max(...observedMeans);
    const observedDeltas = observedMeans.map((mean) => bestObservedMean - mean);

    const spaExtremeCounts = new Array(validEntries.length).fill(0);
    const mcsExtremeCounts = new Array(validEntries.length).fill(0);

    for (let sampleIndex = 0; sampleIndex < bootstrapSamples; sampleIndex += 1) {
        const bootstrapMeans = new Array(validEntries.length);
        const bootstrapStds = new Array(validEntries.length);
        for (let entryIndex = 0; entryIndex < validEntries.length; entryIndex += 1) {
            const entry = validEntries[entryIndex];
            const bootstrapSeries = stationaryBootstrapSample(
                entry.series,
                entry.series.length,
                avgBlockLength
            );
            const mean = computeMean(bootstrapSeries);
            bootstrapMeans[entryIndex] = mean;
            bootstrapStds[entryIndex] = computeStd(bootstrapSeries, mean);
        }

        const bootstrapBestMean = Math.max(...bootstrapMeans);

        for (let entryIndex = 0; entryIndex < validEntries.length; entryIndex += 1) {
            const observedStd = observedStds[entryIndex];
            const refStd = Number.isFinite(bootstrapStds[entryIndex]) && bootstrapStds[entryIndex] > 1e-12
                ? bootstrapStds[entryIndex]
                : observedStd;
            const stat = refStd > 1e-12
                ? Math.max(
                    0,
                    (Math.sqrt(sampleSizes[entryIndex]) *
                        (bootstrapMeans[entryIndex] - observedMeans[entryIndex])) /
                        refStd
                )
                : 0;
            if (stat >= spaStatistics[entryIndex] - 1e-10) {
                spaExtremeCounts[entryIndex] += 1;
            }

            const delta = bootstrapBestMean - bootstrapMeans[entryIndex];
            if (delta >= observedDeltas[entryIndex] - 1e-10) {
                mcsExtremeCounts[entryIndex] += 1;
            }
        }
    }

    validEntries.forEach((entry, idx) => {
        const spaPValue = (spaExtremeCounts[idx] + 1) / (bootstrapSamples + 1);
        const mcsPValue = (mcsExtremeCounts[idx] + 1) / (bootstrapSamples + 1);
        metrics[entry.index] = {
            spaStatistic: spaStatistics[idx],
            spaPValue,
            spaPassed: spaPValue <= significance,
            mcsDelta: observedDeltas[idx],
            mcsPValue,
            mcsIncluded: mcsPValue >= significance
        };
    });

    return metrics;
}

function buildParameterVector(result) {
    const values = {};
    const addParams = (params, prefix) => {
        if (!params || typeof params !== 'object') return;
        Object.keys(params)
            .sort()
            .forEach((key) => {
                const value = params[key];
                if (Number.isFinite(value)) {
                    values[`${prefix}${key}`] = value;
                }
            });
    };
    addParams(result.buyParams || result.entryParams, 'B:');
    addParams(result.sellParams || result.exitParams, 'S:');
    return values;
}

function computeIslandScores(results, medianQuantiles, parameterVectors) {
    const groups = new Map();
    results.forEach((result, index) => {
        const key = `${result.buyStrategy || ''}|${result.sellStrategy || ''}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push({ index, params: parameterVectors[index] });
    });
    const islandScores = new Array(results.length).fill(null);
    groups.forEach((entries) => {
        if (!Array.isArray(entries) || entries.length === 0) {
            return;
        }
        const labelSet = new Set();
        entries.forEach(({ params }) => {
            Object.keys(params || {}).forEach((label) => labelSet.add(label));
        });
        const labels = Array.from(labelSet).sort();
        if (labels.length === 0 || entries.length === 1) {
            entries.forEach(({ index }) => {
                const fallback = clamp01(medianQuantiles[index] || 0);
                islandScores[index] = Math.max(0.1, fallback * 0.6);
            });
            return;
        }
        const labelScales = labels.map((label) => {
            const values = entries
                .map(({ params }) => params[label])
                .filter((value) => Number.isFinite(value));
            if (values.length < 2) {
                return 1;
            }
            const iqr = computeIQR(values);
            if (Number.isFinite(iqr) && iqr > 0) {
                return iqr;
            }
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const span = maxVal - minVal;
            return span !== 0 ? span : 1;
        });
        const vectors = entries.map(({ params }) =>
            labels.map((label, idx) => {
                const value = params[label];
                if (!Number.isFinite(value)) return null;
                const scale = labelScales[idx] || 1;
                return scale !== 0 ? value / scale : value;
            })
        );
        const distances = [];
        for (let i = 0; i < vectors.length; i += 1) {
            for (let j = i + 1; j < vectors.length; j += 1) {
                const distance = computeVectorDistance(vectors[i], vectors[j]);
                if (Number.isFinite(distance)) {
                    distances.push(distance);
                }
            }
        }
        let threshold = 0;
        if (distances.length > 0) {
            const sorted = distances.sort((a, b) => a - b);
            threshold = sorted[Math.floor(sorted.length * 0.75)] || sorted[sorted.length - 1];
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
            threshold = 1;
        }
        const adjacency = entries.map((_, idx) => new Set());
        for (let i = 0; i < vectors.length; i += 1) {
            for (let j = i + 1; j < vectors.length; j += 1) {
                const distance = computeVectorDistance(vectors[i], vectors[j]);
                if (Number.isFinite(distance) && distance <= threshold) {
                    adjacency[i].add(j);
                    adjacency[j].add(i);
                }
            }
        }
        const visited = new Array(entries.length).fill(false);
        const globalAverage = computeMedian(entries.map(({ index }) => medianQuantiles[index] || 0)) || 0;
        const globalStdBase = computeIQR(entries.map(({ index }) => medianQuantiles[index] || 0)) || 0.1;
        for (let start = 0; start < entries.length; start += 1) {
            if (visited[start]) continue;
            const stack = [start];
            const component = [];
            visited[start] = true;
            while (stack.length > 0) {
                const current = stack.pop();
                component.push(current);
                adjacency[current].forEach((neighbor) => {
                    if (!visited[neighbor]) {
                        visited[neighbor] = true;
                        stack.push(neighbor);
                    }
                });
            }
            const componentMedianLevels = component.map((idx) => clamp01(medianQuantiles[entries[idx].index] || 0));
            const avgLevel = componentMedianLevels.reduce((sum, value) => sum + value, 0) / componentMedianLevels.length;
            const componentDistances = [];
            for (let i = 0; i < component.length; i += 1) {
                for (let j = i + 1; j < component.length; j += 1) {
                    const dist = computeVectorDistance(
                        vectors[component[i]],
                        vectors[component[j]]
                    );
                    if (Number.isFinite(dist)) {
                        componentDistances.push(dist);
                    }
                }
            }
            const avgDistance = componentDistances.length > 0
                ? componentDistances.reduce((sum, value) => sum + value, 0) / componentDistances.length
                : threshold;
            const sizeScore = clamp01(component.length / entries.length);
            const dispersionScore = clamp01(1 - avgDistance / (threshold || 1));
            const edgePenaltyBase = globalStdBase > 0 ? Math.max(0, avgLevel - globalAverage) / globalStdBase : 0;
            const edgeScore = clamp01(1 - edgePenaltyBase);
            const componentScore = clamp01(
                0.45 * sizeScore +
                0.30 * dispersionScore +
                0.25 * edgeScore
            );
            component.forEach((memberIdx) => {
                islandScores[entries[memberIdx].index] = componentScore;
            });
        }
    });
    return islandScores.map((score, index) => {
        if (score === null || score === undefined) {
            const fallback = clamp01(medianQuantiles[index] || 0);
            return Math.max(0.1, fallback * 0.6);
        }
        return clamp01(score);
    });
}

function computeVectorDistance(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
        return Infinity;
    }
    let sumSquares = 0;
    let count = 0;
    for (let i = 0; i < vecA.length; i += 1) {
        const a = vecA[i];
        const b = vecB[i];
        if (Number.isFinite(a) && Number.isFinite(b)) {
            const diff = a - b;
            sumSquares += diff * diff;
            count += 1;
        }
    }
    if (count === 0) return Infinity;
    return Math.sqrt(sumSquares / count);
}

function updateOFIMetrics(options = {}) {
    if (!Array.isArray(batchOptimizationResults) || batchOptimizationResults.length === 0) {
        return;
    }
    try {
        const effectiveLengths = batchOptimizationResults
            .map((result) => safeArray(result.strategyReturns).filter((value) => Number.isFinite(value)).length)
            .filter((length) => Number.isFinite(length) && length > 0);
        if (effectiveLengths.length === 0) {
            return;
        }
        const minLength = Math.min(...effectiveLengths);
        const preferredBlocks = Number.isFinite(options.blockCount)
            ? options.blockCount
            : OFI_DEFAULT_BLOCKS;
        const blockCount = decideCSCVBlockCount(minLength, preferredBlocks);
        if (!blockCount) {
            console.warn('[Batch Optimization][OFI] 無法決定 CSCV 分塊數量，略過 OFI 計算');
            return;
        }
        const blockBoundariesCache = buildBlockBoundaries(minLength, blockCount);
        const effectiveLength = blockBoundariesCache.length > 0
            ? blockBoundariesCache[blockBoundariesCache.length - 1].end + 1
            : 0;
        const blockData = batchOptimizationResults.map((result) => {
            const series = safeArray(result.strategyReturns);
            const trimmedSeries = effectiveLength > 0 ? series.slice(0, effectiveLength) : series;
            const returns = computeBlockReturnsFromCumulative(trimmedSeries, blockBoundariesCache);
            if (!Array.isArray(returns) || returns.length !== blockCount) {
                return null;
            }
            const dailyReturns = computeDailyReturnsFromCumulative(trimmedSeries);
            return {
                blockReturns: returns,
                dailyReturns,
                sharpeRatio: Number.isFinite(result.sharpeRatio) ? result.sharpeRatio : 0,
                parameterVector: buildParameterVector(result)
            };
        });
        const validIndices = blockData
            .map((data, index) => (data ? index : null))
            .filter((index) => index !== null);
        if (validIndices.length === 0) {
            return;
        }
        const splits = generateCSCVSplits(blockCount, options.maxSplits || OFI_MAX_SPLITS);
        if (!Array.isArray(splits) || splits.length === 0) {
            return;
        }
        const alpha = Number.isFinite(options.alpha) ? options.alpha : OFI_DEFAULT_ALPHA;
        const qualifies = new Array(batchOptimizationResults.length).fill(0);
        const fails = new Array(batchOptimizationResults.length).fill(0);
        const oosQuantilesLog = Array.from({ length: batchOptimizationResults.length }, () => []);
        splits.forEach((split) => {
            const inSampleMetrics = batchOptimizationResults.map((_, index) => {
                const data = blockData[index];
                if (!data) return NaN;
                return averageByIndices(data.blockReturns, split.is);
            });
            const outSampleMetrics = batchOptimizationResults.map((_, index) => {
                const data = blockData[index];
                if (!data) return NaN;
                return averageByIndices(data.blockReturns, split.oos);
            });
            const isQuantiles = computeDescendingQuantiles(inSampleMetrics);
            const oosQuantiles = computeDescendingQuantiles(outSampleMetrics);
            batchOptimizationResults.forEach((_, index) => {
                const qIS = isQuantiles[index];
                const qOOS = oosQuantiles[index];
                if (Number.isFinite(qOOS)) {
                    oosQuantilesLog[index].push(qOOS);
                }
                if (Number.isFinite(qIS) && qIS >= 1 - alpha) {
                    qualifies[index] += 1;
                    if (!Number.isFinite(qOOS) || qOOS < 0.5) {
                        fails[index] += 1;
                    }
                }
            });
        });
        const medianQuantiles = oosQuantilesLog.map((values) => computeMedian(values));
        const iqrValues = oosQuantilesLog.map((values) => computeIQR(values));
        const maxIQR = Math.max(0.05, ...iqrValues.map((value) => (Number.isFinite(value) ? value : 0)));
        const parameterVectors = blockData.map((data) => (data ? data.parameterVector : {}));
        const islandScores = computeIslandScores(batchOptimizationResults, medianQuantiles, parameterVectors);
        const spaMcsMetrics = computeSpaMcsMetrics(blockData, {
            significance: Number.isFinite(options.spaAlpha) ? options.spaAlpha : OFI_SPA_SIGNIFICANCE,
            bootstrapSamples: options.bootstrapSamples,
            avgBlockLength: options.avgBlockLength,
            minSampleSize: options.minSampleSize
        });
        const ofiResults = batchOptimizationResults.map((result, index) => {
            const data = blockData[index];
            if (!data) {
                return null;
            }
            const cPBO = qualifies[index] > 0 ? clamp01(fails[index] / qualifies[index]) : 0;
            const rCPBO = clamp01(1 - cPBO);
            const level = clamp01(medianQuantiles[index] ?? 0);
            const iqr = Number.isFinite(iqrValues[index]) ? Math.max(0, iqrValues[index]) : 0;
            const normIQR = clamp01(iqr / maxIQR);
            const stability = clamp01(1 - normIQR);
            const island = clamp01(islandScores[index] ?? level);
            const dsr = computeDeflatedSharpeRatio({
                dailyReturns: data.dailyReturns,
                sharpeRatio: data.sharpeRatio,
                trials: options.dsrTrials || batchOptimizationResults.length
            });
            const spaMcs = spaMcsMetrics[index] || {};
            const weights = { ...OFI_COMPONENT_WEIGHTS };
            const score = 100 * (
                weights.cPBO * rCPBO +
                weights.level * level +
                weights.stability * stability +
                weights.island * island +
                weights.dsr * dsr
            );
            const dsrClamped = clamp01(dsr);
            const spaPValue = Number.isFinite(spaMcs.spaPValue) ? spaMcs.spaPValue : null;
            const mcsPValue = Number.isFinite(spaMcs.mcsPValue) ? spaMcs.mcsPValue : null;
            return {
                version: BATCH_OFI_VERSION,
                score,
                components: {
                    cPBO,
                    rCPBO,
                    level,
                    stability,
                    island,
                    dsr: dsrClamped,
                    medianOOSQuantile: medianQuantiles[index] ?? null,
                    iqrOOSQuantile: iqr,
                    logitMedian: Number.isFinite(medianQuantiles[index]) ? logit(medianQuantiles[index]) : null,
                    qualifies: qualifies[index],
                    failures: fails[index],
                    alpha,
                    blockCount,
                    sampleSize: data.dailyReturns.length,
                    spaStatistic: Number.isFinite(spaMcs.spaStatistic) ? spaMcs.spaStatistic : null,
                    spaPValue,
                    mcsDelta: Number.isFinite(spaMcs.mcsDelta) ? spaMcs.mcsDelta : null,
                    mcsPValue
                },
                spaPassed: Boolean(spaMcs.spaPassed),
                spaPValue,
                mcsIncluded: Boolean(spaMcs.mcsIncluded),
                mcsPValue
            };
        });
        ofiResults.forEach((ofi, index) => {
            if (ofi) {
                batchOptimizationResults[index].ofi = ofi;
                batchOptimizationResults[index].ofiScore = Number(ofi.score.toFixed(2));
                batchOptimizationResults[index].ofiVersion = ofi.version;
            } else {
                batchOptimizationResults[index].ofi = null;
                batchOptimizationResults[index].ofiScore = null;
                batchOptimizationResults[index].ofiVersion = BATCH_OFI_VERSION;
            }
        });
    } catch (error) {
        console.error('[Batch Optimization][OFI] 計算失敗:', error);
    }
}

function enrichParamsWithLookback(params) {
    if (!params || typeof params !== 'object') return params;
    const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
    if (!sharedUtils) return params;
    const windowOptions = {
        minBars: 90,
        multiplier: 2,
        marginTradingDays: 12,
        extraCalendarDays: 7,
        minDate: sharedUtils?.MIN_DATA_DATE,
        defaultStartDate: params.startDate,
    };
    let windowDecision = null;
    if (typeof sharedUtils.resolveDataWindow === 'function') {
        windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
    }
    const fallbackMaxPeriod = typeof sharedUtils.getMaxIndicatorPeriod === 'function'
        ? sharedUtils.getMaxIndicatorPeriod(params)
        : 0;
    let lookbackDays = Number.isFinite(windowDecision?.lookbackDays)
        ? windowDecision.lookbackDays
        : null;
    if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
        if (typeof sharedUtils.resolveLookbackDays === 'function') {
            const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
            if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                lookbackDays = fallbackDecision.lookbackDays;
            }
        }
    }
    if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
        lookbackDays = typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(fallbackMaxPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, fallbackMaxPeriod * 2);
    }
    const effectiveStartDate = windowDecision?.effectiveStartDate || params.startDate || windowDecision?.minDataDate || windowOptions.defaultStartDate;
    let dataStartDate = windowDecision?.dataStartDate || null;
    if (!dataStartDate && effectiveStartDate && typeof sharedUtils.computeBufferedStartDate === 'function') {
        dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
            minDate: sharedUtils?.MIN_DATA_DATE,
            marginTradingDays: windowDecision?.bufferTradingDays || windowOptions.marginTradingDays,
            extraCalendarDays: windowDecision?.extraCalendarDays || windowOptions.extraCalendarDays,
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

function resetBatchWorkerStatus() {
    batchWorkerStatus.concurrencyLimit = 0;
    batchWorkerStatus.inFlightCount = 0;
    batchWorkerStatus.entries = [];
    renderBatchWorkerStatus();
}

function renderBatchWorkerStatus() {
    try {
        const panel = document.getElementById('batch-worker-status-panel');
        const concurrencyEl = document.getElementById('batch-current-concurrency');
        const inflightEl = document.getElementById('batch-inflight-count');
        const tbody = document.getElementById('batch-worker-status-tbody');

        if (!panel || !concurrencyEl || !inflightEl || !tbody) return;

        // 顯示/隱藏面板
        if (batchWorkerStatus.entries.length === 0) {
            panel.classList.add('hidden');
        } else {
            panel.classList.remove('hidden');
        }

        concurrencyEl.textContent = batchWorkerStatus.concurrencyLimit || '-';
        inflightEl.textContent = batchWorkerStatus.inFlightCount.toString();

        // 只顯示最近 50 筆
        const recent = batchWorkerStatus.entries.slice(-50).reverse();
        tbody.innerHTML = '';
        recent.forEach((e, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-2 py-1">${e.index}</td>
                <td class="px-2 py-1">${getStrategyChineseName(e.buyStrategy)}</td>
                <td class="px-2 py-1">${getStrategyChineseName(e.sellStrategy)}</td>
                <td class="px-2 py-1">${getStatusChineseText(e.status)}${e.error ? ' - ' + e.error : ''}</td>
                <td class="px-2 py-1">${e.startTime ? new Date(e.startTime).toLocaleTimeString() : '-'}${e.endTime ? ' → ' + new Date(e.endTime).toLocaleTimeString() : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('[Batch Worker Status] render error:', error);
    }
}

// 初始化批量優化功能
function initBatchOptimization() {
    console.log('[Batch Optimization] Initializing...');
    
    try {
        // 檢查必要的依賴是否存在
        if (typeof strategyDescriptions === 'undefined') {
            console.error('[Batch Optimization] strategyDescriptions not found');
            return;
        }
        
        // 生成策略選項
        generateStrategyOptions();
        
        // 綁定事件
        bindBatchOptimizationEvents();
        
        // 添加測試按鈕（僅在開發模式）
        if (window.location.hostname === 'localhost') {
            addTestButton();
        }
        
        // 初始化設定
        batchOptimizationConfig = {
            batchSize: 100,
            maxCombinations: 10000,
            optimizeTargets: ['annualizedReturn', 'sharpeRatio'],
            spaFilterEnabled: false,
            sortKey: 'annualizedReturn',
            sortDirection: 'desc',
            ofiAlpha: OFI_DEFAULT_ALPHA,
            ofiBlocks: OFI_DEFAULT_BLOCKS,
            spaAlpha: OFI_SPA_SIGNIFICANCE,
            spaBootstrapSamples: OFI_SPA_BOOTSTRAP_SAMPLES,
            spaBlockLength: OFI_SPA_AVG_BLOCK_LENGTH,
            spaMinSampleSize: 60
        };
        
        // 在 UI 中顯示推薦的 concurrency（若瀏覽器支援）
        try {
            const hint = document.getElementById('batch-optimize-concurrency-hint');
            if (hint && navigator.hardwareConcurrency) {
                hint.textContent = `建議值：≤ CPU 核心數 (${navigator.hardwareConcurrency})。預設 4。`;
            }
        } catch (e) {
            // ignore
        }
        
        console.log('[Batch Optimization] Initialized successfully');
    } catch (error) {
        console.error('[Batch Optimization] Initialization failed:', error);
    }
}

// 生成策略選項
function generateStrategyOptions() {
    try {
        const buyStrategiesList = document.getElementById('buy-strategies-list');
        const sellStrategiesList = document.getElementById('sell-strategies-list');
        
        if (!buyStrategiesList || !sellStrategiesList) {
            console.error('[Batch Optimization] Strategy lists not found');
            return;
        }
        
        // 清空現有內容
        buyStrategiesList.innerHTML = '';
        sellStrategiesList.innerHTML = '';
        
        // 買入策略 (做多進場)
        const buyStrategies = [
            'ma_cross', 'ma_above', 'rsi_oversold', 'macd_cross', 'bollinger_breakout',
            'k_d_cross', 'volume_spike', 'price_breakout', 'williams_oversold', 
            'ema_cross', 'turtle_breakout'
        ];
        
        // 賣出策略 (做多出場)
        const sellStrategies = [
            'ma_cross_exit', 'ma_below', 'rsi_overbought', 'macd_cross_exit', 'bollinger_reversal',
            'k_d_cross_exit', 'volume_spike', 'price_breakdown', 'williams_overbought',
            'ema_cross_exit', 'turtle_stop_loss', 'trailing_stop', 'fixed_stop_loss'
        ];
        
        // 生成買入策略選項
        buyStrategies.forEach(strategy => {
            const strategyInfo = strategyDescriptions[strategy];
            if (strategyInfo) {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="buy-${strategy}" value="${strategy}" class="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2">
                    <label for="buy-${strategy}" class="text-sm text-gray-700 cursor-pointer">
                        ${strategyInfo.name}
                    </label>
                `;
                buyStrategiesList.appendChild(div);
            }
        });
        
        // 生成賣出策略選項
        sellStrategies.forEach(strategy => {
            const strategyInfo = strategyDescriptions[strategy];
            if (strategyInfo) {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="sell-${strategy}" value="${strategy}" class="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2">
                    <label for="sell-${strategy}" class="text-sm text-gray-700 cursor-pointer">
                        ${strategyInfo.name}
                    </label>
                `;
                sellStrategiesList.appendChild(div);
            }
        });
        
        console.log('[Batch Optimization] Strategy options generated successfully');
    } catch (error) {
        console.error('[Batch Optimization] Error generating strategy options:', error);
    }
}

// 綁定事件
function bindBatchOptimizationEvents() {
    try {
        // 全選/清除按鈕
        const selectAllBuyBtn = document.getElementById('select-all-buy');
        if (selectAllBuyBtn) {
            selectAllBuyBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            });
        }
        
        const selectAllSellBtn = document.getElementById('select-all-sell');
        if (selectAllSellBtn) {
            selectAllSellBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#sell-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            });
        }
        
        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"], #sell-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = false);
            });
        }
        
        // 開始批量優化按鈕
        const startBtn = document.getElementById('start-batch-optimization');
        if (startBtn) {
            // 移除舊的事件監聽器
            startBtn.removeEventListener('click', startBatchOptimization);
            // 添加新的事件監聽器
            startBtn.addEventListener('click', startBatchOptimization);
        }
        
        // 停止批量優化按鈕
        const stopBtn = document.getElementById('stop-batch-optimization');
        if (stopBtn) {
            // 移除舊的事件監聽器
            stopBtn.removeEventListener('click', stopBatchOptimization);
            // 添加新的事件監聽器
            stopBtn.addEventListener('click', stopBatchOptimization);
        }
        
        // 排序相關
        const sortKeySelect = document.getElementById('batch-sort-key');
        if (sortKeySelect) {
            sortKeySelect.addEventListener('change', (e) => {
                const previousKey = batchOptimizationConfig.sortKey;
                const selectedKey = e.target.value;
                batchOptimizationConfig.sortKey = selectedKey;
                if (selectedKey === 'ofi_spaP' || selectedKey === 'ofi_mcsP') {
                    batchOptimizationConfig.sortDirection = 'asc';
                } else if (previousKey === 'ofi_spaP' || previousKey === 'ofi_mcsP') {
                    batchOptimizationConfig.sortDirection = 'desc';
                }
                updateSortDirectionButton();
                sortBatchResults();
            });
        }
        
        const sortDirectionBtn = document.getElementById('batch-sort-direction');
        if (sortDirectionBtn) {
            sortDirectionBtn.addEventListener('click', () => {
                batchOptimizationConfig.sortDirection = batchOptimizationConfig.sortDirection === 'asc' ? 'desc' : 'asc';
                updateSortDirectionButton();
                sortBatchResults();
            });
        }

        const spaFilterCheckbox = document.getElementById('batch-filter-spa');
        if (spaFilterCheckbox) {
            spaFilterCheckbox.addEventListener('change', (event) => {
                batchOptimizationConfig.spaFilterEnabled = Boolean(event.target.checked);
                renderBatchResultsTable();
            });
        }

        console.log('[Batch Optimization] Events bound successfully');
    } catch (error) {
        console.error('[Batch Optimization] Error binding events:', error);
    }
}

// 開始批量優化
function startBatchOptimization() {
    console.log('[Batch Optimization] Starting batch optimization...');
    
    // 防止重複執行
    if (window.batchOptimizationRunning) {
        console.log('[Batch Optimization] Already running, skipping...');
        return;
    }
    
    // 重置停止標誌和開始時間
    isBatchOptimizationStopped = false;
    batchOptimizationStartTime = Date.now();
    
    // 初始化進度追蹤
    currentBatchProgress.startTime = Date.now();
    currentBatchProgress.current = 0;
    currentBatchProgress.total = 0;
    currentBatchProgress.phase = 'preparing';
    currentBatchProgress.isLongRunning = false;
    currentBatchProgress.estimatedTotalTime = null;
    
    window.batchOptimizationRunning = true;
    
    // 更新 UI - 顯示停止按鈕，隱藏/禁用開始按鈕
    const startBtn = document.getElementById('start-batch-optimization');
    const stopBtn = document.getElementById('stop-batch-optimization');
    
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.add('opacity-50');
    }
    
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
    }
    
    // 驗證進出場條件不可為 null
    if (!validateBatchStrategies()) {
        restoreBatchOptimizationUI();
        return;
    }
    
    // 檢查是否有足夠的股票數據
    if (!cachedStockData || cachedStockData.length < 20) {
        showError('請先執行回測以建立快取股票數據，然後再進行批量優化');
        restoreBatchOptimizationUI();
        return;
    }
    
    try {
        // 獲取批量優化設定
        const config = getBatchOptimizationConfig();
        
        // 重置結果
        batchOptimizationResults = [];
    // 初始化 worker 狀態面板
    resetBatchWorkerStatus();
    const panel = document.getElementById('batch-worker-status-panel');
    if (panel) panel.classList.remove('hidden');
        
        // 顯示進度
        showBatchProgress();
        
        // 執行批量優化
        executeBatchOptimization(config);
    } catch (error) {
        console.error('[Batch Optimization] Error starting batch optimization:', error);
        showError('批量優化啟動失敗：' + error.message);
        restoreBatchOptimizationUI();
    }
}

// 驗證批量優化策略設定
function validateBatchStrategies() {
    console.log('[Batch Optimization] Validating strategies...');
    
    const buyStrategies = getSelectedStrategies('batch-buy-strategies');
    const sellStrategies = getSelectedStrategies('batch-sell-strategies');
    
    console.log('[Batch Optimization] Buy strategies:', buyStrategies);
    console.log('[Batch Optimization] Sell strategies:', sellStrategies);
    
    if (buyStrategies.length === 0) {
        showError('請至少選擇一個進場策略');
        return false;
    }
    
    if (sellStrategies.length === 0) {
        showError('請至少選擇一個出場策略');
        return false;
    }
    
    // 檢查選擇的策略是否為 null 或無效
    const invalidBuyStrategies = buyStrategies.filter(strategy => 
        !strategy || strategy === 'null' || !strategyDescriptions[strategy]
    );
    
    const invalidSellStrategies = sellStrategies.filter(strategy => 
        !strategy || strategy === 'null' || !strategyDescriptions[strategy]
    );
    
    if (invalidBuyStrategies.length > 0) {
        showError('進場策略包含無效選項，請重新選擇');
        return false;
    }
    
    if (invalidSellStrategies.length > 0) {
        showError('出場策略包含無效選項，請重新選擇');
        return false;
    }
    
    console.log('[Batch Optimization] Strategy validation passed');
    return true;
}

// 獲取選中的策略
function getSelectedStrategies(type) {
    console.log('[Batch Optimization] getSelectedStrategies called with type:', type);
    
    // 修正 ID 對應
    const idMapping = {
        'batch-buy-strategies': 'buy-strategies-list',
        'batch-sell-strategies': 'sell-strategies-list',
        'buy-strategies': 'buy-strategies-list',
        'sell-strategies': 'sell-strategies-list'
    };
    
    const actualId = idMapping[type] || type;
    console.log('[Batch Optimization] Using actual ID:', actualId);
    
    const checkboxes = document.querySelectorAll(`#${actualId} input[type="checkbox"]:checked`);
    console.log('[Batch Optimization] Found checkboxes:', checkboxes.length);
    
    const selected = Array.from(checkboxes).map(cb => {
        console.log('[Batch Optimization] Checkbox value:', cb.value);
        return cb.value;
    });
    
    console.log('[Batch Optimization] Selected strategies:', selected);
    return selected;
}

// 獲取批量優化設定
function getBatchOptimizationConfig() {
    try {
        // 初始化配置，設定預設值
        const config = {
            batchSize: 100,        // 預設批次大小
            maxCombinations: 10000, // 預設最大組合數  
            parameterTrials: 100,   // 預設參數優化次數
            targetMetric: 'annualizedReturn', // 預設優化目標指標
            concurrency: 4,         // 預設併發數
            iterationLimit: 6,      // 預設迭代上限
            optimizeTargets: ['annualizedReturn', 'sharpeRatio', 'maxDrawdown', 'sortinoRatio'] // 顯示所有指標
        };
        
        // 獲取參數優化次數
        const parameterTrialsElement = document.getElementById('batch-optimize-parameter-trials');
        if (parameterTrialsElement && parameterTrialsElement.value) {
            config.parameterTrials = parseInt(parameterTrialsElement.value) || 100;
        }
        
        // 獲取優化目標指標（單選按鈕）
        const targetMetricRadios = document.querySelectorAll('input[name="batch-target-metric"]:checked');
        if (targetMetricRadios.length > 0) {
            config.targetMetric = targetMetricRadios[0].value;
        }
        
        // 獲取併發數
        const concurrencyElement = document.getElementById('batch-optimize-concurrency');
        if (concurrencyElement && concurrencyElement.value) {
            config.concurrency = parseInt(concurrencyElement.value) || 4;
        }
        
        // 獲取迭代上限
        const iterationLimitElement = document.getElementById('batch-optimize-iteration-limit');
        if (iterationLimitElement && iterationLimitElement.value) {
            config.iterationLimit = parseInt(iterationLimitElement.value) || 6;
        }
        
        // 安全檢查優化目標
        const annualReturnElement = document.getElementById('optimize-annual-return');
        if (annualReturnElement && annualReturnElement.checked) {
        }
        
        const sharpeElement = document.getElementById('optimize-sharpe');
        if (sharpeElement && sharpeElement.checked) {
            config.optimizeTargets.push('sharpeRatio');
        }
        
        // 設定排序鍵值
        config.sortKey = batchOptimizationConfig.sortKey || config.targetMetric;
        config.sortDirection = batchOptimizationConfig.sortDirection || 'desc';

        return config;
    } catch (error) {
        console.error('[Batch Optimization] Error getting config:', error);
        // 返回預設設定
        return {
            batchSize: 100,
            maxCombinations: 10000,
            optimizeTargets: ['annualizedReturn'],
            sortKey: 'annualizedReturn',
            sortDirection: 'desc'
        };
    }
}

// 顯示進度區域
function showBatchProgress() {
    try {
        const progressElement = document.getElementById('batch-optimization-progress');
        const resultsElement = document.getElementById('batch-optimization-results');
        
        if (progressElement) {
            progressElement.classList.remove('hidden');
        }
        
        if (resultsElement) {
            resultsElement.classList.add('hidden');
        }
        
        // 重置進度
        currentBatchProgress = { current: 0, total: 0, phase: 'preparing' };
        updateBatchProgress();
    } catch (error) {
        console.error('[Batch Optimization] Error showing progress:', error);
    }
}

// 批量優化進度追蹤
let currentBatchProgress = {
    current: 0,
    total: 0,
    phase: 'preparing',
    startTime: null,
    lastUpdateTime: null,
    estimatedTotalTime: null,
    isLongRunning: false
};

// 獲取策略的中文名稱
function getStrategyChineseName(strategyKey) {
    if (typeof strategyDescriptions !== 'undefined' && strategyDescriptions[strategyKey]) {
        return strategyDescriptions[strategyKey].name || strategyKey;
    }
    return strategyKey;
}

// 獲取執行狀態的中文顯示
function getStatusChineseText(status) {
    const statusMap = {
        'preparing': '準備中',
        'running': '執行中',
        'optimizing': '優化中',
        'completed': '已完成',
        'failed': '失敗',
        'stopped': '已停止',
        'waiting': '等待中',
        'processing': '處理中'
    };
    return statusMap[status] || status;
}

// 重置批量優化進度
function resetBatchProgress() {
    currentBatchProgress = {
        current: 0,
        total: 0,
        phase: 'preparing',
        startTime: null,
        lastUpdateTime: null,
        estimatedTotalTime: null,
        isLongRunning: false
    };
    
    // 清空進度顯示
    const progressText = document.getElementById('batch-progress-text');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressDetail = document.getElementById('batch-progress-detail');
    const timeEstimate = document.getElementById('batch-time-estimate');
    const longWaitNotice = document.getElementById('batch-long-wait-notice');
    const hourglass = document.getElementById('batch-progress-hourglass');
    
    if (progressText) progressText.textContent = '0%';
    if (progressBar) progressBar.style.width = '0%';
    if (progressDetail) progressDetail.textContent = '已停止';
    if (timeEstimate) timeEstimate.textContent = '';
    if (longWaitNotice) longWaitNotice.classList.add('hidden');
    if (hourglass) hourglass.classList.remove('animate-spin');
}

// 更新進度顯示
function updateBatchProgress(currentCombination = null) {
    const progressText = document.getElementById('batch-progress-text');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressDetail = document.getElementById('batch-progress-detail');
    const progressCombination = document.getElementById('batch-progress-combination');
    const timeEstimate = document.getElementById('batch-time-estimate');
    const longWaitNotice = document.getElementById('batch-long-wait-notice');
    const hourglass = document.getElementById('batch-progress-hourglass');
    
    if (progressText && progressBar && progressDetail) {
        // 計算精確的百分比（每1%更新）
        const rawPercentage = currentBatchProgress.total > 0 ? 
            (currentBatchProgress.current / currentBatchProgress.total) * 100 : 0;
        const percentage = Math.floor(rawPercentage); // 確保是整數百分比
        
        // 避免NaN%問題
        const displayPercentage = isNaN(percentage) ? 0 : percentage;
        
        progressText.textContent = `${displayPercentage}%`;
        progressBar.style.width = `${displayPercentage}%`;
        
        // 顯示當前處理組合資訊
        if (progressCombination && currentCombination) {
            const { buyStrategy, sellStrategy, current, total } = currentCombination;
            const buyStrategyName = strategyDescriptions[buyStrategy]?.name || buyStrategy;
            const sellStrategyName = strategyDescriptions[sellStrategy]?.name || sellStrategy;
            progressCombination.textContent = `🔄 正在優化組合 ${current}/${total}：${buyStrategyName} + ${sellStrategyName}`;
        } else if (progressCombination) {
            progressCombination.textContent = '';
        }
        
        // 計算剩餘時間預估
        if (currentBatchProgress.startTime && currentBatchProgress.current > 0) {
            const elapsedTime = Date.now() - currentBatchProgress.startTime;
            const avgTimePerItem = elapsedTime / currentBatchProgress.current;
            const remaining = currentBatchProgress.total - currentBatchProgress.current;
            const estimatedRemainingTime = avgTimePerItem * remaining;
            
            // 更加保守的時間預估策略：
            // 1. 如果沒有初始預估，使用當前預估
            // 2. 如果有初始預估，使用較大值（更保守）
            // 3. 添加 20% 的緩衝時間避免預估過於樂觀
            const conservativeRemainingTime = estimatedRemainingTime * 1.2;
            
            if (!currentBatchProgress.estimatedTotalTime) {
                currentBatchProgress.estimatedTotalTime = conservativeRemainingTime;
            } else {
                // 使用移動平均來平滑預估時間，避免大幅波動
                const alpha = 0.3; // 平滑因子
                currentBatchProgress.estimatedTotalTime = 
                    alpha * conservativeRemainingTime + (1 - alpha) * currentBatchProgress.estimatedTotalTime;
            }
            
            // 顯示剩餘時間
            if (timeEstimate) {
                const remainingMinutes = Math.ceil(currentBatchProgress.estimatedTotalTime / 60000);
                if (remainingMinutes > 0) {
                    timeEstimate.textContent = `預估剩餘時間：約 ${remainingMinutes} 分鐘`;
                    
                    // 檢查是否為長時間運行
                    if (remainingMinutes > 2 && !currentBatchProgress.isLongRunning) {
                        currentBatchProgress.isLongRunning = true;
                        if (longWaitNotice) {
                            longWaitNotice.classList.remove('hidden');
                        }
                    }
                } else {
                    timeEstimate.textContent = '預估剩餘時間：不到1分鐘';
                }
            }
        }
        
        // 更新沙漏動畫
        if (hourglass) {
            if (currentBatchProgress.phase === 'optimizing' || currentBatchProgress.phase === 'preparing') {
                hourglass.classList.add('animate-spin');
            } else {
                hourglass.classList.remove('animate-spin');
            }
        }
        
        let detailText = '';
        switch (currentBatchProgress.phase) {
            case 'preparing':
                detailText = '準備策略組合...';
                break;
            case 'optimizing':
                detailText = `優化中... ${currentBatchProgress.current}/${currentBatchProgress.total}`;
                break;
                break;
            case 'completed':
                detailText = '優化完成！';
                break;
        }
        progressDetail.textContent = detailText;
    }
}

// 執行批量優化
async function executeBatchOptimization(config) {
    console.log('[Batch Optimization] executeBatchOptimization called with config:', config);
    
    try {
        // 步驟1：取得策略列表
        let buyStrategies = getSelectedStrategies('batch-buy-strategies');
        let sellStrategies = getSelectedStrategies('batch-sell-strategies');
        
        console.log('[Batch Optimization] Retrieved strategies - Buy:', buyStrategies, 'Sell:', sellStrategies);
        
        updateBatchProgress(5, '準備策略參數優化...');
        
        // 步驟2：先生成所有選中的策略組合，然後逐個對每個組合依序優化參數
        console.log('[Batch Optimization] Generating strategy combinations...');
        const rawCombinations = generateStrategyCombinations(buyStrategies, sellStrategies);
        const totalRaw = rawCombinations.length;
        console.log(`[Batch Optimization] Generated ${totalRaw} raw strategy combinations`);

        updateBatchProgress(30, '對每個組合進行參數優化...');

        // 步驟3：針對每個組合進行並行的 per-combination 優化
        const optimizedCombinations = await optimizeCombinations(rawCombinations, config);

        const totalCombinations = Math.min(optimizedCombinations.length, config.maxCombinations);
        console.log(`[Batch Optimization] Completed per-combination parameter optimization for ${optimizedCombinations.length} combinations`);

        // 限制組合數量
        const limitedCombinations = optimizedCombinations.slice(0, config.maxCombinations);
        
        // 重置進度狀態，接著分批處理
        currentBatchProgress = {
            current: 0,
            total: limitedCombinations.length
        };
        
        updateBatchProgress(35, `開始處理 ${limitedCombinations.length} 個優化組合...`);
        
        // 分批處理
        const batches = [];
        for (let i = 0; i < limitedCombinations.length; i += config.batchSize) {
            batches.push(limitedCombinations.slice(i, i + config.batchSize));
        }
        
        console.log(`[Batch Optimization] Processing in ${batches.length} batches`);
        
        // 開始處理每一批
        processBatch(batches, 0, config);
    } catch (error) {
        console.error('[Batch Optimization] Error in executeBatchOptimization:', error);
        showError('批量優化執行失敗：' + error.message);
        hideBatchProgress();
        restoreBatchOptimizationUI();
    }
}

// 比較 metric 值，針對某些指標（例如 maxDrawdown）越小越好
function isBetterMetric(a, b, metric) {
    if (a === null || a === undefined || isNaN(a)) return false;
    if (b === null || b === undefined || isNaN(b)) return true;
    if (metric === 'maxDrawdown') {
        return Math.abs(a) < Math.abs(b);
    }
    return a > b;
}

// 取得 result 的目標指標值，若無則回傳 NaN
function getMetricFromResult(result, metric) {
    if (!result) return NaN;
    const val = result[metric];
    if (val === undefined || val === null || isNaN(val)) return NaN;
    return val;
}

// 用來深度比較參數物件是否相等（簡單 JSON 比較）
function paramsEqual(a, b) {
    try {
        return JSON.stringify(a || {}) === JSON.stringify(b || {});
    } catch (e) {
        return false;
    }
}

// 修復：實現真正的交替迭代優化直到收斂
// 模擬用戶手動操作：進場優化 ↔ 出場優化 直到參數不再改變
async function optimizeCombinationIterative(combination, config) {
    console.log(`[Batch Optimization] Starting iterative combination optimization for ${combination.buyStrategy} + ${combination.sellStrategy}`);
    
    const maxIterations = (config && typeof config.iterationLimit !== 'undefined') ? (parseInt(config.iterationLimit, 10) || 6) : 6;
    
    let currentCombo = {
        buyStrategy: combination.buyStrategy,
        sellStrategy: combination.sellStrategy,
        buyParams: { ...combination.buyParams },
        sellParams: { ...combination.sellParams },
        riskManagement: combination.riskManagement
    };

    try {
        console.log(`[Batch Optimization] Initial combination:`, {
            buyStrategy: currentCombo.buyStrategy,
            buyParams: currentCombo.buyParams,
            sellStrategy: currentCombo.sellStrategy, 
            sellParams: currentCombo.sellParams,
            riskManagement: currentCombo.riskManagement
        });

        // 修復：實現策略間的交替迭代優化直到收斂
        // 這模擬了用戶手動操作的完整過程
        for (let iter = 0; iter < maxIterations; iter++) {
            console.log(`[Batch Optimization] === Iteration ${iter + 1}/${maxIterations} ===`);
            
            // 記錄本輪迭代前的參數
            const prevBuyParams = JSON.parse(JSON.stringify(currentCombo.buyParams || {}));
            const prevSellParams = JSON.parse(JSON.stringify(currentCombo.sellParams || {}));
            
            // Phase 1: 優化進場策略的所有參數直到內部收斂
            console.log(`[Batch Optimization] Phase 1: Optimizing entry strategy ${currentCombo.buyStrategy}`);
            if (currentCombo.buyStrategy && strategyDescriptions[currentCombo.buyStrategy]) {
                const optimizedEntryParams = await optimizeStrategyWithInternalConvergence(
                    currentCombo.buyStrategy,
                    'entry',
                    strategyDescriptions[currentCombo.buyStrategy],
                    config.targetMetric,
                    config.parameterTrials,
                    currentCombo // 包含當前出場參數的完整上下文
                );
                
                // 更新進場參數
                currentCombo.buyParams = { ...optimizedEntryParams };
                console.log(`[Batch Optimization] Updated entry params:`, optimizedEntryParams);
            }

            // Phase 2: 基於最新進場參數，優化出場策略的所有參數直到內部收斂
            console.log(`[Batch Optimization] Phase 2: Optimizing exit strategy ${currentCombo.sellStrategy}`);
            if (currentCombo.sellStrategy && strategyDescriptions[currentCombo.sellStrategy]) {
                const optimizedExitParams = await optimizeStrategyWithInternalConvergence(
                    currentCombo.sellStrategy,
                    'exit',
                    strategyDescriptions[currentCombo.sellStrategy],
                    config.targetMetric,
                    config.parameterTrials,
                    currentCombo // 包含已更新的進場參數
                );
                
                // 更新出場參數
                currentCombo.sellParams = { ...optimizedExitParams };
                console.log(`[Batch Optimization] Updated exit params:`, optimizedExitParams);
            }

            // Phase 3: 檢查策略間是否收斂
            const entryConverged = paramsEqual(prevBuyParams, currentCombo.buyParams);
            const exitConverged = paramsEqual(prevSellParams, currentCombo.sellParams);
            
            console.log(`[Batch Optimization] Convergence check - Entry: ${entryConverged}, Exit: ${exitConverged}`);
            
            if (entryConverged && exitConverged) {
                console.log(`[Batch Optimization] ✓ Converged after ${iter + 1} iterations`);
                break;
            }
            
            // 顯示本輪變化
            if (!entryConverged) {
                console.log(`[Batch Optimization] Entry params changed:`, {
                    from: prevBuyParams,
                    to: currentCombo.buyParams
                });
            }
            if (!exitConverged) {
                console.log(`[Batch Optimization] Exit params changed:`, {
                    from: prevSellParams,
                    to: currentCombo.sellParams
                });
            }
        }

        // 最終驗證：執行完整回測確認結果
        const finalResult = await executeBacktestForCombination(currentCombo);
        const finalMetric = getMetricFromResult(finalResult, config.targetMetric);
        console.log(`[Batch Optimization] Final combination metric (${config.targetMetric}): ${finalMetric.toFixed(4)}`);
        
        return currentCombo;
        
    } catch (error) {
        console.error(`[Batch Optimization] Error in iterative optimization for ${combination.buyStrategy} + ${combination.sellStrategy}:`, error);
        // 返回原始組合作為備用
        return combination;
    }
}

// 新增：策略內參數迭代優化直到內部收斂
// 這模擬了用戶在單一策略內反覆優化參數的過程
async function optimizeStrategyWithInternalConvergence(strategy, strategyType, strategyInfo, targetMetric, trials, baseCombo) {
    console.log(`[Batch Optimization] Starting internal convergence optimization for ${strategy}`);
    
    const maxInternalIterations = 5; // 策略內參數迭代次數限制
    const optimizeTargets = strategyInfo.optimizeTargets;
    
    if (!optimizeTargets || optimizeTargets.length === 0) {
        console.log(`[Batch Optimization] No parameters to optimize for ${strategy}`);
        return strategyInfo.defaultParams || {};
    }
    
    // 初始化參數：使用組合中的當前參數
    let currentParams = strategyType === 'entry' ? 
        { ...baseCombo.buyParams } : 
        { ...baseCombo.sellParams };
    
    // 如果當前參數為空，使用預設參數
    if (!currentParams || Object.keys(currentParams).length === 0) {
        currentParams = { ...strategyInfo.defaultParams };
    }
    
    console.log(`[Batch Optimization] Initial ${strategyType} params for ${strategy}:`, currentParams);
    
    // 策略內參數迭代優化直到收斂
    for (let iter = 0; iter < maxInternalIterations; iter++) {
        console.log(`[Batch Optimization] ${strategy} internal iteration ${iter + 1}/${maxInternalIterations}`);
        
        const prevParams = JSON.parse(JSON.stringify(currentParams));
        
        // 逐個優化策略內的每個參數
        for (let i = 0; i < optimizeTargets.length; i++) {
            const optimizeTarget = optimizeTargets[i];
            console.log(`[Batch Optimization] Optimizing ${strategy}.${optimizeTarget.name}...`);
            
            // 構建完整的 baseParams
            const baseParams = getBacktestParams();
            
            // 設定當前策略的參數
            if (strategyType === 'entry') {
                baseParams.entryStrategy = getWorkerStrategyName(strategy);
                baseParams.entryParams = { ...currentParams };
                // 包含完整的出場參數
                if (baseCombo && baseCombo.sellParams) {
                    baseParams.exitParams = { ...baseCombo.sellParams };
                    baseParams.exitStrategy = getWorkerStrategyName(baseCombo.sellStrategy);
                }
            } else {
                baseParams.exitStrategy = getWorkerStrategyName(strategy);
                baseParams.exitParams = { ...currentParams };
                // 包含完整的進場參數  
                if (baseCombo && baseCombo.buyParams) {
                    baseParams.entryParams = { ...baseCombo.buyParams };
                    baseParams.entryStrategy = getWorkerStrategyName(baseCombo.buyStrategy);
                }
            }
            
            // 包含風險管理參數
            if (baseCombo && baseCombo.riskManagement) {
                baseParams.stopLoss = baseCombo.riskManagement.stopLoss || 0;
                baseParams.takeProfit = baseCombo.riskManagement.takeProfit || 0;
            }
            
            // 優化當前參數
            const bestParam = await optimizeSingleStrategyParameter(
                baseParams,
                optimizeTarget,
                strategyType,
                targetMetric,
                Math.max(1, parseInt(trials, 10) || 1)
            );
            
            if (bestParam.value !== undefined) {
                currentParams[optimizeTarget.name] = bestParam.value;
                console.log(`[Batch Optimization] Updated ${strategy}.${optimizeTarget.name}: ${bestParam.value} (${targetMetric}: ${bestParam.metric.toFixed(4)})`);
            }
        }
        
        // 檢查策略內是否收斂
        const converged = paramsEqual(prevParams, currentParams);
        console.log(`[Batch Optimization] ${strategy} internal convergence: ${converged}`);
        
        if (converged) {
            console.log(`[Batch Optimization] ✓ ${strategy} converged after ${iter + 1} internal iterations`);
            break;
        }
        
        console.log(`[Batch Optimization] ${strategy} params changed:`, {
            from: prevParams,
            to: currentParams
        });
    }
    
    console.log(`[Batch Optimization] Final ${strategy} params:`, currentParams);
    return currentParams;
}


// 對所有組合依序執行 optimizeCombinationIterative（可改為批次並行以加速）
async function optimizeCombinations(combinations, config) {
    const optimized = [];

    const maxConcurrency = config.optimizeConcurrency || navigator.hardwareConcurrency || 4;
    console.log(`[Batch Optimization] Running per-combination optimization with concurrency = ${maxConcurrency}`);

    // 初始化狀態面板
    batchWorkerStatus.concurrencyLimit = maxConcurrency;
    batchWorkerStatus.inFlightCount = 0;
    batchWorkerStatus.entries = combinations.map((c, idx) => ({ index: idx + 1, buyStrategy: c.buyStrategy, sellStrategy: c.sellStrategy, status: 'queued', startTime: null, endTime: null }));
    renderBatchWorkerStatus();

    let index = 0;
    const inFlight = new Set();

    return new Promise((resolve) => {
        function launchNext() {
            if (isBatchOptimizationStopped) {
                console.log('[Batch Optimization] Stopped during per-combination optimization');
                // 等待現有任務完成後返回
                if (inFlight.size === 0) resolve(optimized);
                return;
            }

            while (index < combinations.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const combo = combinations[i];

                const p = optimizeCombinationIterative(combo, config)
                    .then(res => {
                        optimized[i] = res;

                        // 標記為完成
                        const entry = batchWorkerStatus.entries[i];
                        if (entry) {
                            entry.status = 'done';
                            entry.endTime = Date.now();
                        }

                        // 更新進度（以整體百分比顯示）
                        const completedCount = optimized.filter(Boolean).length;
                        updateBatchProgress(30 + (completedCount / combinations.length) * 30, `優化組合 ${completedCount}/${combinations.length}`);
                    })
                    .catch(err => {
                        console.error('[Batch Optimization] Error optimizing combination:', err);
                        optimized[i] = combo; // fallback

                        const entry = batchWorkerStatus.entries[i];
                        if (entry) {
                            entry.status = 'error';
                            entry.endTime = Date.now();
                            entry.error = (err && err.message) ? err.message : String(err);
                        }
                    })
                    .finally(() => {
                        inFlight.delete(p);
                        batchWorkerStatus.inFlightCount = inFlight.size;
                        renderBatchWorkerStatus();

                        // 如果還有可以啟動的任務，繼續啟動
                        if (index < combinations.length) {
                            launchNext();
                        } else if (inFlight.size === 0) {
                            // 全部完成
                            renderBatchWorkerStatus();
                            resolve(optimized.filter(Boolean));
                        }
                    });

                inFlight.add(p);

                // 更新狀態：任務從 queued -> running
                const entry = batchWorkerStatus.entries[i];
                if (entry) {
                    entry.status = 'running';
                    entry.startTime = Date.now();
                }
                batchWorkerStatus.inFlightCount = inFlight.size;
                renderBatchWorkerStatus();
            }
        }

        // 啟動初始併發
        launchNext();
    });
}

// 獲取策略預設參數
function getDefaultStrategyParams(strategy) {
    try {
        const strategyInfo = strategyDescriptions[strategy];
        if (strategyInfo && strategyInfo.defaultParams) {
            return { ...strategyInfo.defaultParams };
        }
        return {};
    } catch (error) {
        console.error(`[Batch Optimization] Error getting default params for strategy ${strategy}:`, error);
        return {};
    }
}

// 分批處理
function processBatch(batches, batchIndex, config) {
    // 檢查是否被停止
    if (isBatchOptimizationStopped) {
        console.log('[Batch Optimization] Process stopped by user');
        return;
    }
    
    if (batchIndex >= batches.length) {
        // 所有批次處理完成
        updateBatchProgress(100, '批量優化完成');
        
        // 顯示結果並恢復 UI
        showBatchResults();
        restoreBatchOptimizationUI();
        return;
    }
    
    const currentBatch = batches[batchIndex];
    console.log(`[Batch Optimization] Processing batch ${batchIndex + 1}/${batches.length} with ${currentBatch.length} combinations`);
    
    // 計算進度百分比
    const progressPercentage = 35 + ((batchIndex / batches.length) * 65);
    updateBatchProgress(progressPercentage, `處理批次 ${batchIndex + 1}/${batches.length}...`);
    
    // 處理當前批次
    processStrategyCombinations(currentBatch, config).then(() => {
        // 檢查是否被停止
        if (isBatchOptimizationStopped) {
            console.log('[Batch Optimization] Process stopped by user');
            return;
        }
        
        // 處理下一批次
        setTimeout(() => {
            processBatch(batches, batchIndex + 1, config);
        }, 100); // 小延遲避免阻塞UI
    }).catch(error => {
        console.error('[Batch Optimization] Error processing batch:', error);
        restoreBatchOptimizationUI();
    });
}

// 處理策略組合
async function processStrategyCombinations(combinations, config) {
    const results = [];
    
    for (let i = 0; i < combinations.length; i++) {
        // 檢查是否被停止
        if (isBatchOptimizationStopped) {
            console.log('[Batch Optimization] Process stopped by user during combination processing');
            break;
        }
        
        const combination = combinations[i];
        
        // 更新進度顯示，包含當前組合資訊
        const combinationInfo = {
            buyStrategy: combination.buyStrategy,
            sellStrategy: combination.sellStrategy,
            current: currentBatchProgress.current + 1,
            total: currentBatchProgress.total
        };
        
        try {
            // 執行回測
            const result = await executeBacktestForCombination(combination);
            if (result) {
                // 確保保留原始的策略 ID，不被 worker 結果覆蓋
                const combinedResult = {
                    ...result,
                    // 強制保留原始的策略 ID 和參數，覆蓋任何從 worker 來的值
                    buyStrategy: combination.buyStrategy,
                    sellStrategy: combination.sellStrategy,
                    buyParams: combination.buyParams,
                    sellParams: combination.sellParams
                };
                
                // 保留風險管理參數（如果有的話）
                if (combination.riskManagement) {
                    combinedResult.riskManagement = combination.riskManagement;
                    console.log(`[Batch Debug] Preserved risk management:`, combination.riskManagement);
                }
                
                // 移除可能會造成混淆的字段
                delete combinedResult.entryStrategy;
                delete combinedResult.exitStrategy;
                delete combinedResult.entryParams;
                delete combinedResult.exitParams;
                
                console.log(`[Batch Debug] Strategy preserved: ${combination.buyStrategy} -> ${combination.sellStrategy}`);
                console.log(`[Batch Debug] Final result sellStrategy:`, combinedResult.sellStrategy);
                results.push(combinedResult);
            }
        } catch (error) {
            console.error(`[Batch Optimization] Error processing combination:`, error);
        }
        
        // 更新進度
        currentBatchProgress.current++;
        if (currentBatchProgress.current % 10 === 0) { // 每10個更新一次進度
            updateBatchProgress(combinationInfo);
        }
    }
    
    // 將結果添加到全局結果中
    batchOptimizationResults.push(...results);
    
    console.log(`[Batch Optimization] Processed ${combinations.length} combinations, total results: ${batchOptimizationResults.length}`);
}

// 執行單個策略組合的回測
async function executeBacktestForCombination(combination) {
    return new Promise((resolve) => {
        try {
            // 使用現有的回測邏輯
            const params = getBacktestParams();
            
            // 更新策略設定（使用 worker 能理解的策略名稱）
            params.entryStrategy = getWorkerStrategyName(combination.buyStrategy);
            params.exitStrategy = getWorkerStrategyName(combination.sellStrategy);
            params.entryParams = combination.buyParams;
            params.exitParams = combination.sellParams;
            
            // 如果有風險管理參數，則應用到全局設定中
            if (combination.riskManagement) {
                if (combination.riskManagement.stopLoss !== undefined) {
                    params.stopLoss = combination.riskManagement.stopLoss;
                }
                if (combination.riskManagement.takeProfit !== undefined) {
                    params.takeProfit = combination.riskManagement.takeProfit;
                }
                console.log(`[Batch Optimization] Applied risk management:`, combination.riskManagement);
            }
            
            // 創建臨時worker執行回測
            if (workerUrl) {
                const tempWorker = new Worker(workerUrl);

                tempWorker.onmessage = function(e) {
                    if (e.data.type === 'result') {
                        const result = e.data.data;
                        
                        // 確保結果包含實際使用的停損停利參數
                        if (result) {
                            result.usedStopLoss = params.stopLoss;
                            result.usedTakeProfit = params.takeProfit;
                            console.log(`[Batch Optimization] Backtest completed with stopLoss: ${params.stopLoss}, takeProfit: ${params.takeProfit}`);
                        }
                        
                        tempWorker.terminate();
                        resolve(result);
                    } else if (e.data.type === 'error') {
                        console.error('[Batch Optimization] Worker error:', e.data.data?.message || e.data.error);
                        tempWorker.terminate();
                        resolve(null);
                    }
                };

                tempWorker.onerror = function(error) {
                    console.error('[Batch Optimization] Worker error:', error);
                    tempWorker.terminate();
                    resolve(null);
                };

                const preparedParams = enrichParamsWithLookback(params);
                tempWorker.postMessage({
                    type: 'runBacktest',
                    params: preparedParams,
                    useCachedData: true,
                    cachedData: cachedStockData
                });

                // 設定超時
                setTimeout(() => {
                    tempWorker.terminate();
                    resolve(null);
                }, 30000); // 30秒超時
            } else {
                console.warn('[Batch Optimization] Worker URL not available');
                resolve(null);
            }
        } catch (error) {
            console.error('[Batch Optimization] Error in executeBacktestForCombination:', error);
            resolve(null);
        }
    });
}

// 優化策略參數
async function optimizeStrategyParameters(strategy, strategyType, targetMetric, trials = 100) {
    return new Promise((resolve) => {
        try {
            const strategyInfo = strategyDescriptions[strategy];
            
            // 檢查是否為風險管理控制策略
            const isRiskManagementStrategy = strategy === 'fixed_stop_loss' || strategy === 'cover_fixed_stop_loss';
            
            if (isRiskManagementStrategy) {
                console.log(`[Batch Optimization] Optimizing risk management parameters for ${strategy} (${targetMetric})`);
                
                // 對於風險管理策略，優化停損和停利參數
                const params = getBacktestParams();
                
                // 修復：使用與單次風險管理優化相同的參數範圍和步長
                // 確保批量優化和單次優化的搜索空間一致
                const globalStopLossConfig = globalOptimizeTargets.stopLoss;
                const globalTakeProfitConfig = globalOptimizeTargets.takeProfit;
                
                // 定義風險管理參數的優化範圍（與單次優化一致）
                const riskOptimizeTargets = [
                    {
                        name: 'stopLoss',
                        range: globalStopLossConfig.range // 使用全局配置：{from: 1, to: 30, step: 0.5}
                    },
                    {
                        name: 'takeProfit', 
                        range: globalTakeProfitConfig.range // 使用全局配置：{from: 5, to: 100, step: 1}
                    }
                ];
                
                console.log(`[Batch Optimization] Risk management optimization ranges (consistent with single optimization):`, riskOptimizeTargets);
                
                // 順序優化兩個參數：先優化停損，再基於最佳停損值優化停利
                optimizeRiskManagementParameters(params, riskOptimizeTargets, targetMetric, trials)
                    .then(resolve)
                    .catch(error => {
                        console.error('[Batch Optimization] Risk management optimization error:', error);
                        resolve({});
                    });
                
                return;
            }
            
            // 原本的策略參數優化邏輯
            if (!strategyInfo || !strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
                // 如果沒有可優化的參數，返回預設參數
                resolve(strategyInfo?.defaultParams || {});
                return;
            }
            
            console.log(`[Batch Optimization] Optimizing ${strategy} parameters for ${targetMetric}`);
            console.log(`[Batch Optimization] Found ${strategyInfo.optimizeTargets.length} parameters to optimize:`, 
                strategyInfo.optimizeTargets.map(t => t.name));
            
            // 對所有可優化參數進行順序優化
            optimizeMultipleStrategyParameters(strategy, strategyType, strategyInfo, targetMetric, trials)
                .then(resolve)
                .catch(error => {
                    console.error('[Batch Optimization] Strategy parameters optimization error:', error);
                    resolve(strategyInfo?.defaultParams || {});
                });
                
            return;
        } catch (error) {
            console.error('[Batch Optimization] Error in optimizeStrategyParameters:', error);
            resolve(strategyDescriptions[strategy]?.defaultParams || {});
        }
    });
}

// 優化多個策略參數
// 修復：正確初始化 baseParams，確保包含當前組合的完整參數
// 這是批量優化無法找到最佳參數的關鍵問題：之前使用默認參數而非組合參數
async function optimizeMultipleStrategyParameters(strategy, strategyType, strategyInfo, targetMetric, trials, order = 'forward', baseCombo = null) {
    console.log(`[Batch Optimization] Starting simplified multi-parameter optimization for ${strategy}...`);
    
    try {
        const optimizeTargets = strategyInfo.optimizeTargets;
        
        // 修復：使用完整的組合參數作為基礎，而非預設參數
        // 這確保優化時的 baseParams 與用戶手動操作時一致
        const baseParams = getBacktestParams();
        
        // 每個參數使用使用者指定的優化次數
        const trialsPerParam = Math.max(1, parseInt(trials, 10) || 1);
        console.log(`[Batch Optimization] Optimizing ${optimizeTargets.length} parameters with ${trialsPerParam} trials each`);
        
        // 修復：設定策略參數時，使用組合中的實際參數而非預設參數
        if (strategyType === 'entry') {
            baseParams.entryStrategy = getWorkerStrategyName(strategy);
            // 使用組合中的進場參數作為起始點（如果有的話）
            if (baseCombo && baseCombo.buyParams) {
                baseParams.entryParams = { ...baseCombo.buyParams };
            } else {
                baseParams.entryParams = { ...strategyInfo.defaultParams };
            }
            // 確保包含當前組合的出場參數
            if (baseCombo && baseCombo.sellParams) {
                baseParams.exitParams = { ...baseCombo.sellParams };
                baseParams.exitStrategy = getWorkerStrategyName(baseCombo.sellStrategy);
            }
        } else {
            baseParams.exitStrategy = getWorkerStrategyName(strategy);
            // 使用組合中的出場參數作為起始點（如果有的話）
            if (baseCombo && baseCombo.sellParams) {
                baseParams.exitParams = { ...baseCombo.sellParams };
            } else {
                baseParams.exitParams = { ...strategyInfo.defaultParams };
            }
            // 確保包含當前組合的進場參數
            if (baseCombo && baseCombo.buyParams) {
                baseParams.entryParams = { ...baseCombo.buyParams };
                baseParams.entryStrategy = getWorkerStrategyName(baseCombo.buyStrategy);
            }
        }
        
        // 包含風險管理參數
        if (baseCombo && baseCombo.riskManagement) {
            baseParams.stopLoss = baseCombo.riskManagement.stopLoss || 0;
            baseParams.takeProfit = baseCombo.riskManagement.takeProfit || 0;
        }
        
        console.log(`[Batch Optimization] Initial baseParams for ${strategy}:`, {
            entryStrategy: baseParams.entryStrategy,
            exitStrategy: baseParams.exitStrategy,
            entryParams: baseParams.entryParams,
            exitParams: baseParams.exitParams,
            stopLoss: baseParams.stopLoss,
            takeProfit: baseParams.takeProfit
        });
        
        let optimizedParams = strategyType === 'entry' ? 
            { ...baseParams.entryParams } : 
            { ...baseParams.exitParams };
        
        // 修復：使用固定的參數優化順序，避免 reverse 導致的不穩定性
        // 按照參數在 optimizeTargets 中的自然順序進行優化
        for (let i = 0; i < optimizeTargets.length; i++) {
            const optimizeTarget = optimizeTargets[i];
            console.log(`[Batch Optimization] Phase ${i + 1}/${optimizeTargets.length}: Optimizing ${optimizeTarget.name}...`);
            
            // 更新當前最佳參數到 baseParams
            if (strategyType === 'entry') {
                baseParams.entryParams = { ...optimizedParams };
                // 保持出場參數不變
            } else {
                baseParams.exitParams = { ...optimizedParams };
                // 保持進場參數不變
            }
            
            console.log(`[Batch Optimization] baseParams before optimizing ${optimizeTarget.name}:`, {
                entryParams: baseParams.entryParams,
                exitParams: baseParams.exitParams
            });
            
            // 優化當前參數
            const bestParam = await optimizeSingleStrategyParameter(
                baseParams, 
                optimizeTarget, 
                strategyType, 
                targetMetric, 
                trialsPerParam
            );
            
            if (bestParam.value !== undefined) {
                optimizedParams[optimizeTarget.name] = bestParam.value;
                console.log(`[Batch Optimization] Best ${optimizeTarget.name}: ${bestParam.value}, ${targetMetric}: ${bestParam.metric.toFixed(4)}`);
            } else {
                console.warn(`[Batch Optimization] No valid optimization result for ${optimizeTarget.name}, keeping default value`);
            }
        }
        
        console.log(`[Batch Optimization] Final optimized parameters for ${strategy}:`, optimizedParams);
        return optimizedParams;
        
    } catch (error) {
        console.error('[Batch Optimization] Error in multi-parameter strategy optimization:', error);
        // 返回預設參數作為備用
        return { ...strategyInfo.defaultParams };
    }
}

// 優化單一策略參數
async function optimizeSingleStrategyParameter(params, optimizeTarget, strategyType, targetMetric, trials) {
    return new Promise((resolve) => {
        if (!workerUrl) {
            console.error('[Batch Optimization] Worker not available');
            resolve({ value: undefined, metric: -Infinity });
            return;
        }
        
        const optimizeWorker = new Worker(workerUrl);
        
        optimizeWorker.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'result') {
                optimizeWorker.terminate();

                console.debug('[Batch Optimization] optimizeSingleStrategyParameter worker returned data:', data);

                if (!data || !Array.isArray(data.results) || data.results.length === 0) {
                    console.warn(`[Batch Optimization] No optimization results for ${optimizeTarget.name}`);
                    resolve({ value: undefined, metric: -Infinity });
                    return;
                }

                // Normalize and sort using getMetricFromResult to be tolerant to missing/NaN metrics
                const results = data.results.map(r => ({
                    __orig: r,
                    paramValue: (r.paramValue !== undefined) ? r.paramValue : (r.value !== undefined ? r.value : (r.param !== undefined ? r.param : undefined)),
                    metricVal: getMetricFromResult(r, targetMetric)
                }));

                // Filter out entries without a paramValue
                const validResults = results.filter(r => r.paramValue !== undefined && !isNaN(r.metricVal));
                if (validResults.length === 0) {
                    console.warn(`[Batch Optimization] Optimization returned results but none had usable paramValue/metric for ${optimizeTarget.name}`);
                    // fallback: try to pick first result that has paramValue even if metric NaN
                    const fallback = results.find(r => r.paramValue !== undefined);
                    if (fallback) {
                        resolve({ value: fallback.paramValue, metric: fallback.metricVal });
                    } else {
                        resolve({ value: undefined, metric: -Infinity });
                    }
                    return;
                }

                // Sort: for maxDrawdown smaller is better
                validResults.sort((a, b) => {
                    if (targetMetric === 'maxDrawdown') {
                        return Math.abs(a.metricVal) - Math.abs(b.metricVal);
                    }
                    return b.metricVal - a.metricVal;
                });

                const best = validResults[0];
                console.debug('[Batch Optimization] Selected best optimization result:', best);
                resolve({ value: best.paramValue, metric: best.metricVal });
            } else if (type === 'error') {
                console.error(`[Batch Optimization] ${optimizeTarget.name} optimization error:`, e.data.data?.message);
                optimizeWorker.terminate();
                resolve({ value: undefined, metric: -Infinity });
            }
        };
        
        optimizeWorker.onerror = function(error) {
            console.error(`[Batch Optimization] ${optimizeTarget.name} optimization worker error:`, error);
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        };
        
        // 使用策略配置中的原始步長，不進行動態調整
        // 修復：批量優化應該使用與單次優化相同的參數範圍和步長，
        // 以確保搜索空間的一致性，避免跳過最優參數值
        const range = optimizeTarget.range;
        const optimizedRange = {
            from: range.from,
            to: range.to,
            step: range.step || 1  // 使用原始步長，確保與單次優化一致
        };
        
        console.log(`[Batch Optimization] Optimizing ${optimizeTarget.name} with range:`, optimizedRange);
        
        const preparedParams = enrichParamsWithLookback(params);

        // 發送優化任務
        optimizeWorker.postMessage({
            type: 'runOptimization',
            params: preparedParams,
            optimizeTargetStrategy: strategyType,
            optimizeParamName: optimizeTarget.name,
            optimizeRange: optimizedRange,
            useCachedData: true,
            cachedData: (typeof cachedStockData !== 'undefined') ? cachedStockData : null
        });
        
        // 設定超時
        setTimeout(() => {
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        }, 60000); // 60秒超時
    });
}

// 優化風險管理參數（停損和停利）
async function optimizeRiskManagementParameters(baseParams, optimizeTargets, targetMetric, trials) {
    console.log('[Batch Optimization] Starting multi-parameter risk management optimization...');
    
    try {
        // 第一階段：優化停損參數
        const stopLossTarget = optimizeTargets.find(t => t.name === 'stopLoss');
        console.log('[Batch Optimization] Phase 1: Optimizing stopLoss...', stopLossTarget);
        
        const bestStopLoss = await optimizeSingleRiskParameter(baseParams, stopLossTarget, targetMetric, Math.floor(trials / 2));
        console.log('[Batch Optimization] Best stopLoss result:', bestStopLoss);
        
        // 第二階段：基於最佳停損值優化停利參數
        const takeProfitTarget = optimizeTargets.find(t => t.name === 'takeProfit');
        const paramsWithBestStopLoss = { ...baseParams };
        if (bestStopLoss.value !== undefined) {
            paramsWithBestStopLoss.stopLoss = bestStopLoss.value;
        }
        
        console.log('[Batch Optimization] Phase 2: Optimizing takeProfit with stopLoss =', bestStopLoss.value);
        const bestTakeProfit = await optimizeSingleRiskParameter(paramsWithBestStopLoss, takeProfitTarget, targetMetric, Math.floor(trials / 2));
        console.log('[Batch Optimization] Best takeProfit result:', bestTakeProfit);
        
        // 組合最佳參數
        const optimizedParams = {};
        if (bestStopLoss.value !== undefined) {
            optimizedParams.stopLoss = bestStopLoss.value;
        }
        if (bestTakeProfit.value !== undefined) {
            optimizedParams.takeProfit = bestTakeProfit.value;
        }
        
        console.log('[Batch Optimization] Final optimized risk management parameters:', optimizedParams);
        return optimizedParams;
        
    } catch (error) {
        console.error('[Batch Optimization] Error in multi-parameter optimization:', error);
        return {};
    }
}

// 優化單一風險管理參數
async function optimizeSingleRiskParameter(params, optimizeTarget, targetMetric, trials) {
    return new Promise((resolve) => {
        if (!workerUrl) {
            console.error('[Batch Optimization] Worker not available');
            resolve({ value: undefined, metric: -Infinity });
            return;
        }
        
        const optimizeWorker = new Worker(workerUrl);
        
        optimizeWorker.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'result') {
                optimizeWorker.terminate();
                
                if (data && data.results && data.results.length > 0) {
                    // 根據目標指標排序結果
                    const sortedResults = data.results.sort((a, b) => {
                        const aValue = a[targetMetric] || -Infinity;
                        const bValue = b[targetMetric] || -Infinity;
                        
                        if (targetMetric === 'maxDrawdown') {
                            // 最大回撤越小越好
                            return Math.abs(aValue) - Math.abs(bValue);
                        } else {
                            // 其他指標越大越好
                            return bValue - aValue;
                        }
                    });
                    
                    const bestResult = sortedResults[0];
                    console.log(`[Batch Optimization] Best ${optimizeTarget.name}: ${bestResult.paramValue}, ${targetMetric}: ${bestResult[targetMetric]}`);
                    
                    resolve({
                        value: bestResult.paramValue,
                        metric: bestResult[targetMetric]
                    });
                } else {
                    console.warn(`[Batch Optimization] No optimization results for ${optimizeTarget.name}`);
                    resolve({ value: undefined, metric: -Infinity });
                }
            } else if (type === 'error') {
                console.error(`[Batch Optimization] ${optimizeTarget.name} optimization error:`, e.data.data?.message);
                optimizeWorker.terminate();
                resolve({ value: undefined, metric: -Infinity });
            }
        };
        
        optimizeWorker.onerror = function(error) {
            console.error(`[Batch Optimization] ${optimizeTarget.name} optimization worker error:`, error);
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        };
        
        const preparedParams = enrichParamsWithLookback(params);

        // 發送優化任務
        optimizeWorker.postMessage({
            type: 'runOptimization',
            params: preparedParams,
            optimizeTargetStrategy: 'risk',
            optimizeParamName: optimizeTarget.name,
            optimizeRange: optimizeTarget.range,
            useCachedData: true,
            cachedData: (typeof cachedStockData !== 'undefined') ? cachedStockData : null
        });
    });
}

// 顯示批量優化結果
function showBatchResults() {
    try {
        console.log(`[Batch Optimization] Showing ${batchOptimizationResults.length} results`);
        
        // 隱藏進度區域
        const progressElement = document.getElementById('batch-optimization-progress');
        if (progressElement) {
            progressElement.classList.add('hidden');
        }
        
        // 顯示結果區域
        const resultsDiv = document.getElementById('batch-optimization-results');
        if (resultsDiv) {
            resultsDiv.classList.remove('hidden');
        }
        
        // 更新策略穩健度 (OFI) 後再排序
        updateOFIMetrics({
            alpha: batchOptimizationConfig.ofiAlpha,
            blockCount: batchOptimizationConfig.ofiBlocks,
            dsrTrials: batchOptimizationResults.length,
            spaAlpha: batchOptimizationConfig.spaAlpha,
            bootstrapSamples: batchOptimizationConfig.spaBootstrapSamples,
            avgBlockLength: batchOptimizationConfig.spaBlockLength,
            minSampleSize: batchOptimizationConfig.spaMinSampleSize
        });

        // 排序結果
        sortBatchResults();
        
        // 渲染結果表格
        renderBatchResultsTable();
        
        // 重置運行狀態
        restoreBatchOptimizationUI();
    } catch (error) {
        console.error('[Batch Optimization] Error showing results:', error);
        restoreBatchOptimizationUI();
    }
}

// 排序結果
function resolveResultSortValue(result, sortKey) {
    if (!result) return NaN;
    switch (sortKey) {
        case 'ofiScore':
            return Number.isFinite(result.ofiScore) ? result.ofiScore : -Infinity;
        case 'ofi_cPBO':
            return Number.isFinite(result.ofi?.components?.cPBO)
                ? result.ofi.components.cPBO
                : NaN;
        case 'ofi_level':
            return Number.isFinite(result.ofi?.components?.level)
                ? result.ofi.components.level
                : NaN;
        case 'ofi_dsr':
            return Number.isFinite(result.ofi?.components?.dsr)
                ? result.ofi.components.dsr
                : NaN;
        case 'ofi_spaP':
            return Number.isFinite(result.ofi?.spaPValue)
                ? result.ofi.spaPValue
                : NaN;
        case 'ofi_mcsP':
            return Number.isFinite(result.ofi?.mcsPValue)
                ? result.ofi.mcsPValue
                : NaN;
        case 'tradeCount':
            return Number.isFinite(result.tradeCount)
                ? result.tradeCount
                : Number.isFinite(result.tradesCount)
                    ? result.tradesCount
                    : Number.isFinite(result.totalTrades)
                        ? result.totalTrades
                        : 0;
        case 'maxDrawdown':
            return Number.isFinite(result.maxDrawdown) ? Math.abs(result.maxDrawdown) : NaN;
        default:
            return Number.isFinite(result[sortKey]) ? result[sortKey] : NaN;
    }
}

function sortBatchResults() {
    const config = batchOptimizationConfig;
    const sortKey = config.sortKey || config.targetMetric || 'annualizedReturn';
    const sortDirection = config.sortDirection || 'desc';

    batchOptimizationResults.sort((a, b) => {
        const aValue = resolveResultSortValue(a, sortKey);
        const bValue = resolveResultSortValue(b, sortKey);

        if (isNaN(aValue) && isNaN(bValue)) return 0;
        if (isNaN(aValue)) return 1;
        if (isNaN(bValue)) return -1;

        if (sortKey === 'maxDrawdown') {
            if (sortDirection === 'desc') {
                return aValue - bValue;
            }
            return bValue - aValue;
        }

        if (sortDirection === 'asc') {
            return aValue - bValue;
        }
        return bValue - aValue;
    });

    // 重新渲染表格
    renderBatchResultsTable();
}

// 更新排序方向按鈕
function updateSortDirectionButton() {
    const button = document.getElementById('batch-sort-direction');
    if (button) {
        const icon = button.querySelector('i');
        if (batchOptimizationConfig.sortDirection === 'asc') {
            icon.className = 'fas fa-sort-up';
        } else {
            icon.className = 'fas fa-sort-down';
        }
    }
}

// 渲染結果表格
function renderBatchResultsTable() {
    const tbody = document.getElementById('batch-results-tbody');
    if (!tbody) return;

    // 添加交叉優化控制面板
    addCrossOptimizationControls();

    tbody.innerHTML = '';

    const resultsToRender = batchOptimizationResults.filter((result) => {
        if (!batchOptimizationConfig.spaFilterEnabled) {
            return true;
        }
        if (!result || !result.ofi) {
            return false;
        }
        return Boolean(result.ofi.spaPassed || result.ofi.mcsIncluded);
    });

    if (resultsToRender.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td class="px-3 py-4 text-sm text-gray-500" colspan="16">
                尚無符合條件的結果。請調整篩選條件或執行新的批量優化。
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    resultsToRender.forEach((result, rowIndex) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const buyStrategyName = strategyDescriptions[result.buyStrategy]?.name || result.buyStrategy;
        const sellStrategyName = result.sellStrategy ?
            (strategyDescriptions[result.sellStrategy]?.name || result.sellStrategy) :
            '未觸發';
        
        // 判斷優化類型並處理合併的類型標籤
        let optimizationType = '基礎';
        let typeClass = 'bg-gray-100 text-gray-700';
        
        if (result.optimizationTypes && result.optimizationTypes.length > 1) {
            // 多重結果，顯示合併標籤
            const typeMap = {
                'entry-fixed': '進場固定',
                'exit-fixed': '出場固定',
                '基礎': '基礎'
            };
            const mappedTypes = result.optimizationTypes.map(type => typeMap[type] || type);
            optimizationType = mappedTypes.join(',');
            typeClass = 'bg-yellow-100 text-yellow-700';
        } else if (result.crossOptimization) {
            if (result.optimizationType === 'entry-fixed') {
                optimizationType = '進場固定';
                typeClass = 'bg-purple-100 text-purple-700';
            } else if (result.optimizationType === 'exit-fixed') {
                optimizationType = '出場固定';
                typeClass = 'bg-blue-100 text-blue-700';
            }
        }
        
        // 顯示風險管理參數（如果有的話）
        let riskManagementInfo = '';
        if (result.riskManagement) {
            // 優化的風險管理參數
            const stopLoss = result.riskManagement.stopLoss ? `停損:${result.riskManagement.stopLoss}%` : '';
            const takeProfit = result.riskManagement.takeProfit ? `停利:${result.riskManagement.takeProfit}%` : '';
            const parts = [stopLoss, takeProfit].filter(part => part);
            if (parts.length > 0) {
                riskManagementInfo = `<small class="text-gray-600 block">(優化: ${parts.join(', ')})</small>`;
            }
        } else if (result.usedStopLoss !== undefined || result.usedTakeProfit !== undefined) {
            // 實際使用的風險管理參數
            const stopLoss = result.usedStopLoss !== undefined ? `停損:${result.usedStopLoss}%` : '';
            const takeProfit = result.usedTakeProfit !== undefined ? `停利:${result.usedTakeProfit}%` : '';
            const parts = [stopLoss, takeProfit].filter(part => part);
            if (parts.length > 0) {
                riskManagementInfo = `<small class="text-gray-600 block">(使用: ${parts.join(', ')})</small>`;
            }
        }

        const ofi = result.ofi || null;
        const stabilityScore = ofi?.components?.stability;
        const islandScore = ofi?.components?.island;
        const ofiTooltip = ofi
            ? `cPBO ${formatUnitPercent(ofi.components?.cPBO)} | Level ${formatUnitPercent(ofi.components?.level)} | Stability ${formatUnitPercent(stabilityScore)} | Island ${formatUnitPercent(islandScore)} | DSR ${formatUnitPercent(ofi.components?.dsr)}`
            : '尚未計算 OFI';
        const tradeCountValue = Number.isFinite(result.tradeCount)
            ? result.tradeCount
            : Number.isFinite(result.tradesCount)
                ? result.tradesCount
                : Number.isFinite(result.totalTrades)
                    ? result.totalTrades
                    : 0;
        const tableIndex = batchOptimizationResults.indexOf(result);

        row.innerHTML = `
            <td class="px-3 py-2 text-sm text-gray-900 font-medium">${rowIndex + 1}</td>
            <td class="px-3 py-2 text-sm">
                <span class="px-2 py-1 text-xs rounded-full ${typeClass}">${optimizationType}</span>
            </td>
            <td class="px-3 py-2 text-sm text-gray-900">${buyStrategyName}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${sellStrategyName}${riskManagementInfo}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatPercentage(result.annualizedReturn)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatNumber(result.sharpeRatio)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatNumber(result.sortinoRatio)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatPercentage(result.maxDrawdown)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${tradeCountValue}</td>
            <td class="px-3 py-2 text-sm text-gray-900" title="${ofiTooltip}">
                ${ofi ? `<div class="flex flex-col leading-tight">
                    <span class="font-semibold text-emerald-600">${Number.isFinite(result.ofiScore) ? result.ofiScore.toFixed(1) : '-'}</span>
                    <span class="text-[11px] text-gray-500">穩:${formatUnitPercent(stabilityScore)} 島:${formatUnitPercent(islandScore)}</span>
                </div>` : '-'}
            </td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatUnitPercent(ofi.components?.cPBO) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatUnitPercent(ofi.components?.medianOOSQuantile) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatUnitPercent(ofi.components?.iqrOOSQuantile) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatUnitPercent(ofi.components?.dsr) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatPValue(ofi.spaPValue) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${ofi ? formatPValue(ofi.mcsPValue) : '-'}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${buildSpaBadge(ofi)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">
                <button class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded border"
                        onclick="loadBatchStrategy(${tableIndex})">
                    載入
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// 添加交叉優化控制面板
function addCrossOptimizationControls() {
    // 檢查是否已經添加過控制面板
    if (document.getElementById('cross-optimization-controls')) {
        console.log('[Cross Optimization] Controls already exist');
        return;
    }
    
    // 檢查是否有批量優化結果
    const hasResults = batchOptimizationResults && batchOptimizationResults.length > 0;
    if (!hasResults) {
        console.log('[Cross Optimization] No batch results available, showing disabled controls');
    }
    
    const resultsDiv = document.getElementById('batch-optimization-results');
    if (!resultsDiv) {
        console.error('[Cross Optimization] Results div not found');
        return;
    }
    
    // 找到結果表格
    const table = resultsDiv.querySelector('table');
    if (!table) {
        console.error('[Cross Optimization] Results table not found');
        return;
    }
    
    console.log('[Cross Optimization] Adding control panel');
    
    // 創建控制面板
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'cross-optimization-controls';
    controlsDiv.className = 'mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg';
    
    controlsDiv.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="text-lg font-semibold text-purple-800 flex items-center">
                🔄 智能交叉優化
                <span class="ml-2 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">進階功能</span>
            </h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div class="space-y-2">
                <h5 class="font-medium text-purple-700">📈 第二階段：進場策略優化</h5>
                <p class="text-sm text-gray-600">固定最佳進場參數，優化所有出場策略組合</p>
                <button id="start-entry-cross-optimization" 
                        class="w-full px-4 py-2 ${hasResults ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors text-sm font-medium"
                        ${!hasResults ? 'disabled' : ''}>
                    🚀 開始進場策略交叉優化
                </button>
            </div>
            
            <div class="space-y-2">
                <h5 class="font-medium text-purple-700">📉 第三階段：出場策略優化</h5>
                <p class="text-sm text-gray-600">固定最佳出場參數，優化所有進場策略組合</p>
                <button id="start-exit-cross-optimization" 
                        class="w-full px-4 py-2 ${hasResults ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors text-sm font-medium"
                        ${!hasResults ? 'disabled' : ''}>
                    🎯 開始出場策略交叉優化
                </button>
            </div>
        </div>
        
        <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            ${hasResults 
                ? '<strong>💡 優化流程：</strong> 1️⃣ 從當前結果中找出最佳進場策略參數 → 2️⃣ 套用到不同出場策略重新優化 → 3️⃣ 再找出最佳出場策略參數 → 4️⃣ 套用到不同進場策略最終優化'
                : '<strong>⚠️ 提示：</strong> 請先執行批量優化以獲得初始結果，然後才能進行交叉優化'
            }
        </div>
    `;
    
    // 插入到表格前面
    table.parentNode.insertBefore(controlsDiv, table);
    
    // 添加事件監聽器
    const entryButton = document.getElementById('start-entry-cross-optimization');
    const exitButton = document.getElementById('start-exit-cross-optimization');
    
    if (entryButton && exitButton) {
        // 只在有結果時才添加事件監聽器
        if (hasResults) {
            entryButton.addEventListener('click', startEntryCrossOptimization);
            exitButton.addEventListener('click', startExitCrossOptimization);
            console.log('[Cross Optimization] Event listeners added successfully');
        }
        
        // 添加到全局作用域以便調試
        window.startEntryCrossOptimization = startEntryCrossOptimization;
        window.startExitCrossOptimization = startExitCrossOptimization;
        
    } else {
        console.error('[Cross Optimization] Failed to find buttons:', {
            entryButton: !!entryButton,
            exitButton: !!exitButton
        });
    }
}

// 開始進場策略交叉優化
async function startEntryCrossOptimization() {
    console.log('[Cross Optimization] startEntryCrossOptimization called');
    
    try {
        // 顯示交叉優化進度
        showCrossOptimizationProgress('entry');
        showInfo('🔄 開始進場策略交叉優化...');
        
        // 1. 取得當前配置的所有進場和出場策略
        const entryStrategies = getSelectedEntryStrategies();
        const exitStrategies = getSelectedExitStrategies();
        
        if (entryStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇進場策略');
            return;
        }
        
        if (exitStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇出場策略');
            return;
        }
        
        // 2. 準備交叉優化任務
        const crossOptimizationTasks = [];
        
        for (let entryIndex = 0; entryIndex < entryStrategies.length; entryIndex++) {
            const entryStrategy = entryStrategies[entryIndex];
            
            // 找到該進場策略的最佳結果
            const bestEntryResult = findBestResultForStrategy(entryStrategy, 'entry');
            
            if (!bestEntryResult) {
                console.warn(`找不到 ${strategyDescriptions[entryStrategy]?.name || entryStrategy} 的最佳結果`);
                continue;
            }
            
            // 為每個出場策略創建任務
            for (let exitIndex = 0; exitIndex < exitStrategies.length; exitIndex++) {
                const exitStrategy = exitStrategies[exitIndex];
                crossOptimizationTasks.push({
                    entryStrategy: entryStrategy,
                    entryParams: bestEntryResult.buyParams || bestEntryResult.entryParams,
                    exitStrategy: exitStrategy,
                    optimizationType: 'entry-fixed',
                    taskId: `${entryStrategy}-${exitStrategy}`
                });
            }
        }
        
        showInfo(`📊 準備執行 ${crossOptimizationTasks.length} 個交叉優化任務...`);
        
        // 3. 使用批量優化的並行處理邏輯
        const results = await executeCrossOptimizationTasks(crossOptimizationTasks);
        
        // 4. 更新結果並顯示
        if (results.length > 0) {
            // 添加交叉優化結果到總結果中，並進行去重處理
            addCrossOptimizationResults(results);
            sortBatchResults();
            renderBatchResultsTable();
            hideCrossOptimizationProgress();
            showSuccess(`✅ 進場策略交叉優化完成！新增 ${results.length} 個優化結果`);
        } else {
            hideCrossOptimizationProgress();
            showError('交叉優化失敗，未產生有效結果');
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in startEntryCrossOptimization:', error);
        hideCrossOptimizationProgress();
        showError('交叉優化執行失敗：' + error.message);
    }
}

// 執行交叉優化任務（使用批量優化的並行邏輯）
async function executeCrossOptimizationTasks(tasks) {
    const results = [];
    const maxConcurrency = navigator.hardwareConcurrency || 4;
    
    console.log(`[Cross Optimization] Running ${tasks.length} tasks with concurrency = ${maxConcurrency}`);
    
    // 設置交叉優化進度
    crossOptimizationProgress.total = tasks.length;
    crossOptimizationProgress.current = 0;
    
    let index = 0;
    const inFlight = new Set();
    
    return new Promise((resolve) => {
        function launchNext() {
            while (index < tasks.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const task = tasks[i];
                
                // 更新進度顯示
                updateCrossOptimizationProgress(task);
                
                const promise = performCrossOptimization(
                    task.entryStrategy,
                    task.entryParams,
                    task.exitStrategy,
                    task.optimizationType
                ).then(result => {
                    if (result) {
                        results[i] = result;
                        console.log(`[Cross Optimization] Task ${i + 1} completed successfully`);
                    } else {
                        console.warn(`[Cross Optimization] Task ${i + 1} failed`);
                    }
                }).catch(error => {
                    console.error(`[Cross Optimization] Task ${i + 1} error:`, error);
                }).finally(() => {
                    inFlight.delete(promise);
                    
                    // 更新進度
                    crossOptimizationProgress.current++;
                    updateCrossOptimizationProgress();
                    
                    if (inFlight.size === 0 && index >= tasks.length) {
                        // 所有任務完成
                        const validResults = results.filter(Boolean);
                        console.log(`[Cross Optimization] All tasks completed. Valid results: ${validResults.length}/${tasks.length}`);
                        resolve(validResults);
                    } else {
                        // 啟動下一個任務
                        launchNext();
                    }
                });
                
                inFlight.add(promise);
            }
            
            // 如果沒有更多任務且所有任務都完成了
            if (index >= tasks.length && inFlight.size === 0) {
                const validResults = results.filter(Boolean);
                resolve(validResults);
            }
        }
        
        // 開始處理
        launchNext();
    });
}

// 開始出場策略交叉優化
async function startExitCrossOptimization() {
    console.log('[Cross Optimization] startExitCrossOptimization called');
    
    try {
        // 顯示交叉優化進度
        showCrossOptimizationProgress('exit');
        showInfo('🔄 開始出場策略交叉優化...');
        
        // 1. 取得當前配置的所有進場和出場策略
        const entryStrategies = getSelectedEntryStrategies();
        const exitStrategies = getSelectedExitStrategies();
        
        if (entryStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇進場策略');
            return;
        }
        
        if (exitStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇出場策略');
            return;
        }
        
        // 2. 準備交叉優化任務
        const crossOptimizationTasks = [];
        
        for (let exitIndex = 0; exitIndex < exitStrategies.length; exitIndex++) {
            const exitStrategy = exitStrategies[exitIndex];
            
            // 找到該出場策略的最佳結果
            const bestExitResult = findBestResultForStrategy(exitStrategy, 'exit');
            
            if (!bestExitResult) {
                console.warn(`找不到 ${strategyDescriptions[exitStrategy]?.name || exitStrategy} 的最佳結果`);
                continue;
            }
            
            // 為每個進場策略創建任務
            for (let entryIndex = 0; entryIndex < entryStrategies.length; entryIndex++) {
                const entryStrategy = entryStrategies[entryIndex];
                crossOptimizationTasks.push({
                    entryStrategy: entryStrategy,
                    entryParams: null,
                    exitStrategy: exitStrategy,
                    exitParams: bestExitResult.sellParams || bestExitResult.exitParams,
                    optimizationType: 'exit-fixed',
                    taskId: `${entryStrategy}-${exitStrategy}`
                });
            }
        }
        
        showInfo(`📊 準備執行 ${crossOptimizationTasks.length} 個交叉優化任務...`);
        
        // 3. 使用批量優化的並行處理邏輯
        const results = await executeCrossOptimizationTasksExit(crossOptimizationTasks);
        
        // 4. 更新結果並顯示
        if (results.length > 0) {
            // 添加交叉優化結果到總結果中，並進行去重處理
            addCrossOptimizationResults(results);
            sortBatchResults();
            renderBatchResultsTable();
            hideCrossOptimizationProgress();
            showSuccess(`✅ 出場策略交叉優化完成！新增 ${results.length} 個優化結果`);
        } else {
            hideCrossOptimizationProgress();
            showError('交叉優化失敗，未產生有效結果');
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in startExitCrossOptimization:', error);
        hideCrossOptimizationProgress();
        showError('交叉優化執行失敗：' + error.message);
    }
}

// 執行出場策略交叉優化任務
async function executeCrossOptimizationTasksExit(tasks) {
    const results = [];
    const maxConcurrency = navigator.hardwareConcurrency || 4;
    
    console.log(`[Cross Optimization] Running ${tasks.length} exit tasks with concurrency = ${maxConcurrency}`);
    
    // 設置交叉優化進度
    crossOptimizationProgress.total = tasks.length;
    crossOptimizationProgress.current = 0;
    
    let index = 0;
    const inFlight = new Set();
    
    return new Promise((resolve) => {
        function launchNext() {
            while (index < tasks.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const task = tasks[i];
                
                // 更新進度顯示
                updateCrossOptimizationProgress(task);
                
                const promise = performCrossOptimization(
                    task.entryStrategy,
                    task.entryParams,
                    task.exitStrategy,
                    task.optimizationType,
                    task.exitParams
                ).then(result => {
                    if (result) {
                        results[i] = result;
                        console.log(`[Cross Optimization] Exit task ${i + 1} completed successfully`);
                    } else {
                        console.warn(`[Cross Optimization] Exit task ${i + 1} failed`);
                    }
                    
                    // 更新交叉優化進度
                    crossOptimizationProgress.current++;
                    updateCrossOptimizationProgress();
                }).catch(error => {
                    console.error(`[Cross Optimization] Exit task ${i + 1} error:`, error);
                }).finally(() => {
                    inFlight.delete(promise);
                    
                    if (inFlight.size === 0 && index >= tasks.length) {
                        // 所有任務完成
                        const validResults = results.filter(Boolean);
                        console.log(`[Cross Optimization] All exit tasks completed. Valid results: ${validResults.length}/${tasks.length}`);
                        resolve(validResults);
                    } else {
                        // 啟動下一個任務
                        launchNext();
                    }
                });
                
                inFlight.add(promise);
            }
            
            // 如果沒有更多任務且所有任務都完成了
            if (index >= tasks.length && inFlight.size === 0) {
                const validResults = results.filter(Boolean);
                resolve(validResults);
            }
        }
        
        // 開始處理
        launchNext();
    });
}

// 找到最佳進場策略
function findBestEntryStrategy() {
    console.log('[Cross Optimization] Finding best entry strategy');
    console.log('[Cross Optimization] Batch results:', batchOptimizationResults);
    
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        console.warn('[Cross Optimization] No batch optimization results available');
        return null;
    }
    
    // 按年化報酬率排序，找到最佳結果
    const sorted = [...batchOptimizationResults].sort((a, b) => {
        const aReturn = a.annualizedReturn || -Infinity;
        const bReturn = b.annualizedReturn || -Infinity;
        return bReturn - aReturn;
    });
    
    console.log('[Cross Optimization] Best entry strategy:', sorted[0]);
    return sorted[0];
}

// 找到最佳出場策略
function findBestExitStrategy() {
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        return null;
    }
    
    // 按年化報酬率排序，找到最佳結果
    const sorted = [...batchOptimizationResults].sort((a, b) => (b.annualizedReturn || 0) - (a.annualizedReturn || 0));
    return sorted[0];
}

// 找到特定策略的最佳結果
function findBestResultForStrategy(strategy, strategyType) {
    console.log(`[Cross Optimization] Finding best result for ${strategyType} strategy:`, strategy);
    
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        console.warn('[Cross Optimization] No batch optimization results available');
        return null;
    }
    
    // 過濾出使用該策略的結果
    const filteredResults = batchOptimizationResults.filter(result => {
        if (strategyType === 'entry') {
            return result.buyStrategy === strategy;
        } else if (strategyType === 'exit') {
            return result.sellStrategy === strategy;
        }
        return false;
    });
    
    console.log(`[Cross Optimization] Filtered results for ${strategy}:`, filteredResults);
    
    if (filteredResults.length === 0) {
        console.warn(`[Cross Optimization] No results found for ${strategyType} strategy: ${strategy}`);
        return null;
    }
    
    // 按年化報酬率排序，找到最佳結果
    const sorted = filteredResults.sort((a, b) => {
        const aReturn = a.annualizedReturn || -Infinity;
        const bReturn = b.annualizedReturn || -Infinity;
        return bReturn - aReturn;
    });
    
    console.log(`[Cross Optimization] Best result for ${strategy}:`, sorted[0]);
    return sorted[0];
}

// 取得選中的進場策略
function getSelectedEntryStrategies() {
    const entryStrategies = [];
    const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        entryStrategies.push(checkbox.value);
    });
    return entryStrategies;
}

// 取得選中的出場策略
function getSelectedExitStrategies() {
    const exitStrategies = [];
    const checkboxes = document.querySelectorAll('#sell-strategies-list input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        exitStrategies.push(checkbox.value);
    });
    return exitStrategies;
}

// 執行交叉優化
async function performCrossOptimization(entryStrategy, entryParams, exitStrategy, optimizationType, exitParams = null) {
    try {
        console.log('[Cross Optimization] performCrossOptimization started:', {
            entryStrategy, entryParams, exitStrategy, optimizationType, exitParams
        });
        
        // 設定基礎參數
        const baseParams = getBacktestParams();
        console.log('[Cross Optimization] Base params obtained:', baseParams);
        
        baseParams.entryStrategy = getWorkerStrategyName(entryStrategy);
        baseParams.exitStrategy = getWorkerStrategyName(exitStrategy);
        
        console.log('[Cross Optimization] Strategy names converted:', {
            entryStrategy: baseParams.entryStrategy,
            exitStrategy: baseParams.exitStrategy
        });
        
        // 根據優化類型設定固定參數
        if (optimizationType === 'entry-fixed' && entryParams) {
            console.log('[Cross Optimization] Entry-fixed optimization, setting entry params:', entryParams);
            // 固定進場參數，優化出場參數
            baseParams.entryParams = { ...entryParams };
            
            // 優化出場策略參數
            const exitStrategyInfo = strategyDescriptions[exitStrategy];
            console.log('[Cross Optimization] Exit strategy info:', exitStrategyInfo);
            
            if (exitStrategyInfo && exitStrategyInfo.optimizeTargets) {
                console.log('[Cross Optimization] Starting exit strategy optimization...');
                const optimizedExitParams = await optimizeSingleStrategyParametersFast(exitStrategy, 'exit', exitStrategyInfo, baseParams);
                console.log('[Cross Optimization] Optimized exit params:', optimizedExitParams);
                baseParams.exitParams = optimizedExitParams;
            } else {
                console.log('[Cross Optimization] Using default exit params for:', exitStrategy);
                baseParams.exitParams = getDefaultStrategyParams(exitStrategy);
            }
            
        } else if (optimizationType === 'exit-fixed' && exitParams) {
            console.log('[Cross Optimization] Exit-fixed optimization, setting exit params:', exitParams);
            // 固定出場參數，優化進場參數
            baseParams.exitParams = { ...exitParams };
            
            // 優化進場策略參數
            const entryStrategyInfo = strategyDescriptions[entryStrategy];
            console.log('[Cross Optimization] Entry strategy info:', entryStrategyInfo);
            
            if (entryStrategyInfo && entryStrategyInfo.optimizeTargets) {
                console.log('[Cross Optimization] Starting entry strategy optimization...');
                const optimizedEntryParams = await optimizeSingleStrategyParametersFast(entryStrategy, 'entry', entryStrategyInfo, baseParams);
                console.log('[Cross Optimization] Optimized entry params:', optimizedEntryParams);
                baseParams.entryParams = optimizedEntryParams;
            } else {
                console.log('[Cross Optimization] Using default entry params for:', entryStrategy);
                baseParams.entryParams = getDefaultStrategyParams(entryStrategy);
            }
        } else {
            console.log('[Cross Optimization] Invalid optimization type or missing params:', {
                optimizationType, entryParams, exitParams
            });
            return null;
        }
        
        console.log('[Cross Optimization] Final backtest params:', baseParams);
        
        // 執行回測
        console.log('[Cross Optimization] Starting backtest...');
        const result = await performSingleBacktestFast(baseParams);
        console.log('[Cross Optimization] Backtest result:', result);
        
        if (result && result.annualizedReturn !== undefined) {
            console.log('[Cross Optimization] Valid result obtained, processing...');
            // 添加交叉優化標記
            result.crossOptimization = true;
            result.optimizationType = optimizationType;
            result.buyStrategy = entryStrategy;
            result.sellStrategy = exitStrategy;
            result.buyParams = baseParams.entryParams;
            result.sellParams = baseParams.exitParams;
            
            console.log('[Cross Optimization] Final result with metadata:', result);
            return result;
        } else {
            console.log('[Cross Optimization] Invalid or null result from backtest');
            return null;
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in performCrossOptimization:', error);
        return null;
    }
}

// 優化單一策略參數（簡化版）
async function optimizeSingleStrategyParameters(strategy, strategyType, strategyInfo, baseParams) {
    try {
        console.log('[Cross Optimization] optimizeSingleStrategyParameters called:', {
            strategy, strategyType, strategyInfo: strategyInfo?.name
        });
        
        if (!strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
            console.log('[Cross Optimization] No optimize targets, using default params');
            const defaultParams = getDefaultStrategyParams(strategy);
            console.log('[Cross Optimization] Default params:', defaultParams);
            return defaultParams;
        }
        
        const optimizeTarget = strategyInfo.optimizeTargets[0]; // 優化第一個參數
        const range = optimizeTarget.range;
        
        console.log('[Cross Optimization] Optimization target:', optimizeTarget);
        
        let bestParams = getDefaultStrategyParams(strategy);
        let bestReturn = -Infinity;
        
        console.log('[Cross Optimization] Starting optimization with default params:', bestParams);
        
        // 簡單的網格搜索
        const steps = Math.min(10, Math.ceil((range.to - range.from) / range.step));
        const stepSize = (range.to - range.from) / steps;
        
        console.log('[Cross Optimization] Grid search parameters:', { steps, stepSize, range });
        
        for (let i = 0; i <= steps; i++) {
            const testValue = range.from + i * stepSize;
            const testParams = { ...bestParams };
            testParams[optimizeTarget.name] = testValue;
            
            // 設定測試參數
            const testBacktestParams = { ...baseParams };
            if (strategyType === 'entry') {
                testBacktestParams.entryParams = testParams;
            } else {
                testBacktestParams.exitParams = testParams;
            }
            
            console.log(`[Cross Optimization] Testing step ${i+1}/${steps+1} with value ${testValue}`);
            
            // 執行回測
            const result = await performSingleBacktest(testBacktestParams);
            
            if (result && result.annualizedReturn > bestReturn) {
                bestReturn = result.annualizedReturn;
                bestParams = { ...testParams };
                console.log(`[Cross Optimization] New best found: ${bestReturn}% with params:`, bestParams);
            }
        }
        
        console.log('[Cross Optimization] Optimization completed. Best params:', bestParams);
        return bestParams;
        
    } catch (error) {
        console.error('[Cross Optimization] Error optimizing single strategy:', error);
        return getDefaultStrategyParams(strategy);
    }
}

// 執行單次回測
function performSingleBacktest(params) {
    console.log('[Cross Optimization] performSingleBacktest called with:', {
        stockNo: params.stockNo,
        entryStrategy: params.entryStrategy,
        exitStrategy: params.exitStrategy,
        entryParams: params.entryParams,
        exitParams: params.exitParams
    });
    
    return new Promise((resolve) => {
        try {
            // 創建 Worker 進行回測
            const worker = new Worker(workerUrl);
            
            const timeoutId = setTimeout(() => {
                console.log('[Cross Optimization] Worker timeout');
                worker.terminate();
                resolve(null);
            }, 30000); // 30秒超時
            
            worker.onmessage = function(e) {
                console.log('[Cross Optimization] Worker response type:', e.data.type);
                
                // 處理進度消息，但不終止 Worker，繼續等待最終結果
                if (e.data.type === 'progress') {
                    console.log('[Cross Optimization] Progress update received, continuing...');
                    return; // 不要 resolve，繼續等待最終結果
                }
                
                // 處理最終結果
                clearTimeout(timeoutId);
                worker.terminate();
                
                if (e.data.type === 'result') {
                    console.log('[Cross Optimization] Worker returned valid result');
                    resolve(e.data.data);
                } else if (e.data.type === 'backtest_result') {
                    console.log('[Cross Optimization] Worker returned backtest_result');
                    resolve(e.data.result);
                } else if (e.data.type === 'error') {
                    console.error('[Cross Optimization] Worker error:', e.data.message);
                    resolve(null);
                } else {
                    console.log('[Cross Optimization] Unknown worker response type:', e.data.type);
                    resolve(null);
                }
            };
            
            worker.onerror = function(error) {
                console.error('[Cross Optimization] Worker onerror:', error);
                clearTimeout(timeoutId);
                worker.terminate();
                resolve(null);
            };
            
            // 發送回測請求 - 使用正確的消息類型
            console.log('[Cross Optimization] Sending message to worker...');
            const preparedParams = enrichParamsWithLookback(params);
            worker.postMessage({
                type: 'runBacktest',
                params: preparedParams,
                useCachedData: false
            });
            
        } catch (error) {
            console.error('[Cross Optimization] Error in performSingleBacktest:', error);
            resolve(null);
        }
    });
}

// 格式化百分比
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    // 修正：數據已經是百分比格式，不需要再乘以100
    return `${value.toFixed(2)}%`;
}

// 格式化數字
function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return value.toFixed(2);
}

function formatUnitPercent(value, digits = 1) {
    if (!Number.isFinite(value)) return '-';
    const clamped = Math.max(-1, Math.min(1, value));
    return `${(clamped * 100).toFixed(digits)}%`;
}

function formatPValue(value) {
    if (!Number.isFinite(value)) return '-';
    if (value < 0.001) return '&lt;0.001';
    if (value > 0.999) return '&gt;0.999';
    return value.toFixed(3);
}

function buildSpaBadge(ofi) {
    if (!ofi) {
        return '<span class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">待檢</span>';
    }
    const badges = [];
    if (Number.isFinite(ofi.spaPValue)) {
        if (ofi.spaPassed) {
            badges.push(
                `<span class="px-2 py-0.5 mr-1 text-xs rounded bg-emerald-100 text-emerald-700">SPA ✓ p=${formatPValue(ofi.spaPValue)}</span>`
            );
        } else {
            badges.push(
                `<span class="px-2 py-0.5 mr-1 text-xs rounded bg-amber-100 text-amber-700">SPA ✗ p=${formatPValue(ofi.spaPValue)}</span>`
            );
        }
    } else {
        badges.push('<span class="px-2 py-0.5 mr-1 text-xs rounded bg-gray-100 text-gray-500">SPA 樣本不足</span>');
    }
    if (Number.isFinite(ofi.mcsPValue)) {
        if (ofi.mcsIncluded) {
            badges.push(
                `<span class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">MCS ✓ p=${formatPValue(ofi.mcsPValue)}</span>`
            );
        } else {
            badges.push(
                `<span class="px-2 py-0.5 text-xs rounded bg-rose-100 text-rose-700">MCS ✗ p=${formatPValue(ofi.mcsPValue)}</span>`
            );
        }
    } else {
        badges.push('<span class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">MCS 樣本不足</span>');
    }
    return badges.join('');
}

// 載入批量優化策略
function loadBatchStrategy(index) {
    const result = batchOptimizationResults[index];
    if (!result) {
        console.error('[Batch Optimization] No result found at index:', index);
        return;
    }
    
    console.log('[Batch Optimization] Loading strategy at index:', index);
    console.log('[Batch Optimization] Full result object:', result);
    console.log('[Batch Optimization] buyStrategy:', result.buyStrategy);
    console.log('[Batch Optimization] sellStrategy:', result.sellStrategy);
    console.log('[Batch Optimization] sellStrategy type:', typeof result.sellStrategy);
    console.log('[Batch Optimization] Has sellStrategy property:', 'sellStrategy' in result);
    console.log('[Batch Optimization] Object keys:', Object.keys(result));
    
    // 檢查是否有 exitStrategy 字段（這可能是問題所在）
    if ('exitStrategy' in result) {
        console.warn('[Batch Optimization] Found exitStrategy field:', result.exitStrategy);
        console.warn('[Batch Optimization] This might be overriding sellStrategy');
    }
    
    // 更新策略選擇
    const entryStrategyElement = document.getElementById('entryStrategy');
    const exitStrategyElement = document.getElementById('exitStrategy');
    
    if (entryStrategyElement) {
        entryStrategyElement.value = result.buyStrategy;
        // 觸發策略變更事件
        entryStrategyElement.dispatchEvent(new Event('change'));
    }
    
    if (exitStrategyElement) {
        // 優先使用 sellStrategy，如果不存在則檢查 exitStrategy，最後使用預設策略
        let exitStrategy = result.sellStrategy;
        if (!exitStrategy && result.exitStrategy) {
            console.warn('[Batch Optimization] Using exitStrategy as fallback:', result.exitStrategy);
            exitStrategy = result.exitStrategy;
        }
        if (!exitStrategy) {
            console.warn('[Batch Optimization] No exit strategy found, using default');
            exitStrategy = 'stop_loss_take_profit';
        }
        
        // 關鍵修復：將批量優化的完整策略ID轉換為HTML select期待的簡化版本
        let selectValue = exitStrategy;
        if (exitStrategy.endsWith('_exit')) {
            // 移除 '_exit' 後綴，因為HTML select中可能只存儲基礎名稱
            const baseStrategy = exitStrategy.replace('_exit', '');
            console.log(`[Batch Optimization] Converting strategy from '${exitStrategy}' to '${baseStrategy}'`);
            selectValue = baseStrategy;
        }
        
        console.log('[Batch Optimization] Setting exit strategy to:', selectValue);
        console.log('[Batch Optimization] Available options in select:', Array.from(exitStrategyElement.options).map(o => o.value));
        
        // 檢查選項是否存在
        const optionExists = Array.from(exitStrategyElement.options).some(option => option.value === selectValue);
        if (!optionExists) {
            console.warn(`[Batch Optimization] Option '${selectValue}' not found in select, trying original value '${exitStrategy}'`);
            selectValue = exitStrategy; // 回退到原始值
            
            // 如果還是不存在，使用預設策略
            const fallbackExists = Array.from(exitStrategyElement.options).some(option => option.value === selectValue);
            if (!fallbackExists) {
                console.warn(`[Batch Optimization] Neither '${selectValue}' nor original value found, using stop_loss_take_profit`);
                selectValue = 'stop_loss_take_profit';
            }
        }
        
        exitStrategyElement.value = selectValue;
        
        // 如果出場策略為 null 或使用預設策略，顯示訊息給用戶
        if (!result.sellStrategy) {
            console.log('[Batch Optimization] 出場策略未觸發，使用策略:', selectValue);
            if (selectValue === 'stop_loss_take_profit') {
                showInfo('此優化結果的出場策略未觸發，已載入預設的停損停利策略。您可以根據需要調整出場策略。');
            } else {
                const strategyName = strategyDescriptions[result.sellStrategy]?.name || strategyDescriptions[selectValue]?.name || selectValue;
                showInfo(`已載入出場策略：${strategyName}`);
            }
        }
        
        // 觸發策略變更事件
        exitStrategyElement.dispatchEvent(new Event('change'));
    }
    
    // 更新策略參數
    updateBatchStrategyParams('entry', result.buyParams, result.buyStrategy);
    // 更新出場策略參數，優先使用 sellParams，然後嘗試 exitParams
    const exitParams = result.sellParams || result.exitParams;
    const exitStrategyName = result.sellStrategy || result.exitStrategy;
    if (exitParams && Object.keys(exitParams).length > 0) {
        updateBatchStrategyParams('exit', exitParams, exitStrategyName);
        console.log('[Batch Optimization] 已更新出場策略參數:', exitParams, '策略:', exitStrategyName);
    } else {
        console.log('[Batch Optimization] 出場策略參數為空，跳過參數更新');
    }
    
    // 檢查並應用風險管理參數
    console.log('[Batch Optimization] Checking for risk management parameters...');
    console.log('[Batch Optimization] Result has riskManagement:', 'riskManagement' in result);
    console.log('[Batch Optimization] riskManagement value:', result.riskManagement);
    
    if (result.riskManagement) {
        console.log('[Batch Optimization] 應用風險管理參數:', result.riskManagement);
        
        // 設定停損
        if (result.riskManagement.stopLoss !== undefined) {
            const stopLossInput = document.getElementById('stopLoss');
            if (stopLossInput) {
                console.log('[Batch Optimization] 設定停損前的值:', stopLossInput.value);
                stopLossInput.value = result.riskManagement.stopLoss;
                console.log('[Batch Optimization] 設定停損後的值:', stopLossInput.value);
                console.log('[Batch Optimization] 設定停損:', result.riskManagement.stopLoss);
            } else {
                console.error('[Batch Optimization] 找不到停損輸入框 (stopLoss)');
            }
        }
        
        // 設定停利
        if (result.riskManagement.takeProfit !== undefined) {
            const takeProfitInput = document.getElementById('takeProfit');
            if (takeProfitInput) {
                console.log('[Batch Optimization] 設定停利前的值:', takeProfitInput.value);
                takeProfitInput.value = result.riskManagement.takeProfit;
                console.log('[Batch Optimization] 設定停利後的值:', takeProfitInput.value);
                console.log('[Batch Optimization] 設定停利:', result.riskManagement.takeProfit);
            } else {
                console.error('[Batch Optimization] 找不到停利輸入框 (takeProfit)');
            }
        }
        
        showInfo(`已載入優化的風險管理參數：停損 ${result.riskManagement.stopLoss || 0}%，停利 ${result.riskManagement.takeProfit || 0}%`);
    } else {
        console.log('[Batch Optimization] 沒有風險管理參數需要載入');
        
        // 檢查是否為風險管理策略但沒有參數
        if (result.sellStrategy === 'fixed_stop_loss' || result.sellStrategy === 'cover_fixed_stop_loss') {
            console.warn('[Batch Optimization] 這是風險管理策略但沒有找到 riskManagement 參數');
            console.warn('[Batch Optimization] 完整結果物件:', result);
        }
        
        // 對於非風險管理策略，載入該組合實際使用的停損停利參數
        console.log('[Batch Optimization] Checking for used risk management parameters...');
        console.log('[Batch Optimization] usedStopLoss:', result.usedStopLoss);
        console.log('[Batch Optimization] usedTakeProfit:', result.usedTakeProfit);
        
        if (result.usedStopLoss !== undefined || result.usedTakeProfit !== undefined) {
            console.log('[Batch Optimization] 載入該組合實際使用的風險管理參數');
            
            // 設定停損
            if (result.usedStopLoss !== undefined) {
                const stopLossInput = document.getElementById('stopLoss');
                if (stopLossInput) {
                    console.log('[Batch Optimization] 設定實際使用的停損前的值:', stopLossInput.value);
                    stopLossInput.value = result.usedStopLoss;
                    console.log('[Batch Optimization] 設定實際使用的停損後的值:', stopLossInput.value);
                } else {
                    console.error('[Batch Optimization] 找不到停損輸入框 (stopLoss)');
                }
            }
            
            // 設定停利
            if (result.usedTakeProfit !== undefined) {
                const takeProfitInput = document.getElementById('takeProfit');
                if (takeProfitInput) {
                    console.log('[Batch Optimization] 設定實際使用的停利前的值:', takeProfitInput.value);
                    takeProfitInput.value = result.usedTakeProfit;
                    console.log('[Batch Optimization] 設定實際使用的停利後的值:', takeProfitInput.value);
                } else {
                    console.error('[Batch Optimization] 找不到停利輸入框 (takeProfit)');
                }
            }
            
            showInfo(`已載入該組合使用的風險管理參數：停損 ${result.usedStopLoss || 0}%，停利 ${result.usedTakeProfit || 0}%`);
        }
    }
    
    // 顯示進場策略載入成功的通知
    const entryStrategyName = strategyDescriptions[result.buyStrategy]?.name || result.buyStrategy;
    showSuccess(`進場策略已載入：${entryStrategyName}`);
    
    // 顯示確認對話框並自動執行回測
    if (confirm(`批量優化策略參數已載入完成！\n\n是否立即執行回測以查看策略表現？`)) {
        // 自動執行回測
        setTimeout(() => {
            runBacktestInternal();
        }, 100);
    }
    
    // 切換到優化頁籤
    switchTab('optimization');
}

// 添加測試按鈕（開發用）
function addTestButton() {
    const batchOptimizationDiv = document.querySelector('#batchOptimization');
    if (batchOptimizationDiv) {
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 測試載入策略修復';
        testButton.className = 'px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded border mr-2';
        testButton.onclick = testLoadStrategyFix;
        
        const firstButton = batchOptimizationDiv.querySelector('button');
        if (firstButton) {
            firstButton.parentNode.insertBefore(testButton, firstButton);
        }
    }
}

// 測試載入策略修復
function testLoadStrategyFix() {
    console.log('[Test] Creating test batch optimization result with death cross strategies...');
    
    // 創建測試數據 - 包含各種死亡交叉策略
    const testResults = [
        {
            buyStrategy: 'ma_cross',
            sellStrategy: 'ma_cross_exit', // 均線死亡交叉
            buyParams: { shortPeriod: 5, longPeriod: 20 },
            sellParams: { shortPeriod: 3, longPeriod: 15 },
            annualizedReturn: 0.15,
            sharpeRatio: 1.2,
            maxDrawdown: 0.08,
            totalReturn: 0.45,
            // 模擬 worker 可能添加的混淆字段
            exitStrategy: null,
            entryStrategy: 'ma_cross',
            exitParams: null
        },
        {
            buyStrategy: 'rsi_oversold',
            sellStrategy: 'k_d_cross_exit', // KD死亡交叉
            buyParams: { period: 14, threshold: 30 },
            sellParams: { period: 9, thresholdY: 70 },
            annualizedReturn: 0.12,
            sharpeRatio: 1.0,
            maxDrawdown: 0.10,
            totalReturn: 0.38,
            exitStrategy: null,
            entryStrategy: 'rsi_oversold',
            exitParams: null
        },
        {
            buyStrategy: 'macd_cross',
            sellStrategy: 'macd_cross_exit', // MACD死亡交叉
            buyParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
            sellParams: { shortPeriod: 10, longPeriod: 24, signalPeriod: 8 },
            annualizedReturn: 0.18,
            sharpeRatio: 1.5,
            maxDrawdown: 0.06,
            totalReturn: 0.52,
            exitStrategy: null,
            entryStrategy: 'macd_cross',
            exitParams: null
        }
    ];
    
    // 添加到結果中
    batchOptimizationResults = testResults;
    
    // 顯示結果
    displayBatchOptimizationResults();
    
    console.log('[Test] Test results created with death cross strategies. Try loading them now.');
    showInfo('已創建包含死亡交叉策略的測試結果，請點擊表格中的"載入"按鈕測試修復效果');
}

// 更新策略參數
function updateBatchStrategyParams(type, params, strategyName = null) {
    // 檢查參數是否有效
    if (!params || typeof params !== 'object') {
        console.warn(`[Batch Optimization] Invalid params for ${type}:`, params);
        return;
    }
    
    try {
        // 獲取當前選擇的策略，用於特殊參數名稱映射
        // 優先使用傳入的策略名稱，否則從DOM獲取
        let currentStrategy = strategyName;
        if (!currentStrategy) {
            const strategySelect = document.getElementById(`${type}Strategy`);
            currentStrategy = strategySelect ? strategySelect.value : '';
        }
        
        console.log(`[Batch Optimization] Updating ${type} params for strategy: ${currentStrategy}`, params);
        
        for (const [key, value] of Object.entries(params)) {
            if (key && value !== undefined && value !== null) {
                // 基礎ID生成
                let inputId = `${type}${key.charAt(0).toUpperCase() + key.slice(1)}`;
                
                // KD策略的特殊參數名稱映射（與 loadStrategy 函數保持一致）
                if ((currentStrategy === 'k_d_cross' || currentStrategy === 'k_d_cross_exit') && key === 'thresholdX') {
                    inputId = `${type}KdThresholdX`;
                } else if ((currentStrategy === 'k_d_cross_exit' || currentStrategy.includes('k_d_cross')) && key === 'thresholdY') {
                    inputId = `${type}KdThresholdY`;
                } else if ((currentStrategy === 'macd_cross' || currentStrategy === 'macd_cross_exit') && key === 'signalPeriod') {
                    inputId = `${type}SignalPeriod`;
                } else if (currentStrategy === 'turtle_stop_loss' && key === 'stopLossPeriod') {
                    inputId = `${type}StopLossPeriod`;
                }
                
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = value;
                    console.log(`[Batch Optimization] Set ${inputId} = ${value} (strategy: ${currentStrategy})`);
                } else {
                    console.warn(`[Batch Optimization] Input element not found: ${inputId} for strategy ${currentStrategy}, key: ${key}`);
                }
            }
        }
    } catch (error) {
        console.error(`[Batch Optimization] Error updating strategy params for ${type}:`, error);
    }
}

// 儲存批量優化策略
// 切換頁籤
function switchTab(tabName) {
    // 隱藏所有頁籤內容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有頁籤按鈕的active狀態
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('border-blue-500', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    // 顯示選中的頁籤內容
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 更新選中頁籤按鈕的狀態
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.remove('border-transparent', 'text-gray-500');
        targetButton.classList.add('border-blue-500', 'text-blue-600');
    }
}

// 優化所有策略參數
async function optimizeAllStrategies(buyStrategies, sellStrategies, config) {
    const optimizedBuy = {};
    const optimizedSell = {};
    
    const totalStrategies = buyStrategies.length + sellStrategies.length;
    let completedStrategies = 0;
    
    // 優化進場策略
    for (const strategy of buyStrategies) {
        updateBatchProgress(5 + (completedStrategies / totalStrategies) * 20, 
            `優化進場策略: ${strategyDescriptions[strategy]?.name || strategy}...`);
        
        optimizedBuy[strategy] = await optimizeStrategyParameters(strategy, 'entry', config.targetMetric, config.parameterTrials);
        completedStrategies++;
    }
    
    // 優化出場策略
    for (const strategy of sellStrategies) {
        updateBatchProgress(5 + (completedStrategies / totalStrategies) * 20, 
            `優化出場策略: ${strategyDescriptions[strategy]?.name || strategy}...`);
        
        optimizedSell[strategy] = await optimizeStrategyParameters(strategy, 'exit', config.targetMetric, config.parameterTrials);
        completedStrategies++;
    }
    
    return {
        buy: optimizedBuy,
        sell: optimizedSell
    };
}

// 生成優化後的策略組合
function generateOptimizedStrategyCombinations(optimizedBuyStrategies, optimizedSellStrategies) {
    const combinations = [];
    
    for (const [buyStrategy, buyParams] of Object.entries(optimizedBuyStrategies)) {
        for (const [sellStrategy, sellParams] of Object.entries(optimizedSellStrategies)) {
            const combination = {
                buyStrategy: buyStrategy,
                sellStrategy: sellStrategy,
                buyParams: buyParams,
                sellParams: sellParams
            };
            
            // 檢查是否為風險管理策略，如果是則將參數加入到風險管理設定中
            if ((sellStrategy === 'fixed_stop_loss' || sellStrategy === 'cover_fixed_stop_loss') && sellParams) {
                combination.riskManagement = sellParams;
                combination.sellParams = {}; // 風險管理策略本身沒有策略參數
                console.log(`[Batch Optimization] Risk management parameters for ${sellStrategy}:`, sellParams);
            }
            
            combinations.push(combination);
        }
    }
    
    return combinations;
}

// 生成策略組合（使用策略的預設參數）
function generateStrategyCombinations(buyStrategies, sellStrategies) {
    const combinations = [];

    for (const buyStrategy of buyStrategies) {
        const buyParams = getDefaultStrategyParams(buyStrategy) || {};

        for (const sellStrategy of sellStrategies) {
            const sellParams = getDefaultStrategyParams(sellStrategy) || {};
            const combination = {
                buyStrategy: buyStrategy,
                sellStrategy: sellStrategy,
                buyParams: { ...buyParams },
                sellParams: { ...sellParams }
            };

            // 處理風險管理策略（如 fixed_stop_loss, cover_fixed_stop_loss）
            if ((sellStrategy === 'fixed_stop_loss' || sellStrategy === 'cover_fixed_stop_loss') && sellParams && Object.keys(sellParams).length > 0) {
                combination.riskManagement = { ...sellParams };
                combination.sellParams = {}; // 風險管理策略本身不使用 exitParams
            }

            combinations.push(combination);
        }
    }

    return combinations;
}

// 更新批量進度（支援自訂訊息）
function updateBatchProgress(percentage, message) {
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const progressDetail = document.getElementById('batch-progress-detail');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    if (progressDetail && message) {
        let displayMessage = message;
        
        // 計算剩餘時間（只有在進度 > 5% 時才顯示）
        if (percentage > 5 && batchOptimizationStartTime) {
            const elapsedTime = Date.now() - batchOptimizationStartTime;
            const estimatedTotal = (elapsedTime / percentage) * 100;
            const remainingTime = estimatedTotal - elapsedTime;
            
            if (remainingTime > 0) {
                const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));
                const remainingSeconds = Math.ceil((remainingTime % (1000 * 60)) / 1000);
                
                if (remainingMinutes > 0) {
                    displayMessage += ` (預計剩餘: ${remainingMinutes}分${remainingSeconds}秒)`;
                } else {
                    displayMessage += ` (預計剩餘: ${remainingSeconds}秒)`;
                }
            }
        }
        
        progressDetail.textContent = displayMessage;
    }
}

// 顯示批量優化進度
function showBatchProgress() {
    console.log('[Batch Optimization] showBatchProgress called');
    const progressElement = document.getElementById('batch-optimization-progress');
    if (progressElement) {
        console.log('[Batch Optimization] Progress element found, showing...');
        progressElement.classList.remove('hidden');
    } else {
        console.error('[Batch Optimization] Progress element not found!');
    }
    
    // 隱藏結果區域
    const resultsDiv = document.getElementById('batch-optimization-results');
    if (resultsDiv) {
        resultsDiv.classList.add('hidden');
    }
    
    // 初始化進度
    updateBatchProgress(0, '準備中...');
}

// 隱藏批量優化進度
function hideBatchProgress() {
    const progressElement = document.getElementById('batch-optimization-progress');
    if (progressElement) {
        progressElement.classList.add('hidden');
    }
}

// 隱藏批量進度
function hideBatchProgress() {
    const progressElement = document.getElementById('batch-optimization-progress');
    if (progressElement) {
        progressElement.classList.add('hidden');
    }
}

// 導出函數供外部使用
window.batchOptimization = {
    init: initBatchOptimization,
    loadStrategy: loadBatchStrategy,
    stop: stopBatchOptimization,
    getWorkerStrategyName: getWorkerStrategyName
};

// 測試風險管理優化功能
function testRiskManagementOptimization() {
    console.log('[Test] Testing risk management optimization...');
    
    // 測試策略設定
    const testStrategies = [
        {
            entryStrategy: 'ma_cross',
            exitStrategy: 'fixed_stop_loss',
            shortEntryStrategy: 'none',
            shortExitStrategy: 'none'
        }
    ];
    
    console.log('[Test] Testing fixed_stop_loss strategy optimization with both stopLoss and takeProfit...');
    
    // 測試 optimizeStrategyParameters 函數（現在應該優化兩個參數）
    optimizeStrategyParameters('fixed_stop_loss', 'exit', 'annualizedReturn', 20)
        .then(result => {
            console.log('[Test] Risk management optimization result:', result);
            console.log('[Test] Expected: optimized stopLoss AND takeProfit parameters');
            
            const hasStopLoss = result && result.stopLoss !== undefined;
            const hasTakeProfit = result && result.takeProfit !== undefined;
            
            if (hasStopLoss && hasTakeProfit) {
                console.log('[Test] ✓ Multi-parameter optimization successful!');
                console.log('[Test] ✓ stopLoss:', result.stopLoss);
                console.log('[Test] ✓ takeProfit:', result.takeProfit);
            } else if (hasStopLoss) {
                console.log('[Test] ⚠ Only stopLoss optimized:', result.stopLoss);
                console.log('[Test] ✗ takeProfit missing');
            } else if (hasTakeProfit) {
                console.log('[Test] ⚠ Only takeProfit optimized:', result.takeProfit);
                console.log('[Test] ✗ stopLoss missing');
            } else {
                console.log('[Test] ✗ Risk management optimization failed or returned empty result');
            }
        })
        .catch(error => {
            console.error('[Test] Risk management optimization error:', error);
        });
}

// 測試多參數策略優化
function testMultiParameterStrategyOptimization() {
    console.log('[Test] Testing multi-parameter strategy optimization...');
    
    // 測試均線策略（有 shortPeriod 和 longPeriod 兩個參數）
    console.log('[Test] Testing ma_cross strategy with shortPeriod and longPeriod...');
    
    optimizeStrategyParameters('ma_cross', 'entry', 'annualizedReturn', 40)
        .then(result => {
            console.log('[Test] MA cross optimization result:', result);
            console.log('[Test] Expected: optimized shortPeriod AND longPeriod parameters');
            
            const hasShortPeriod = result && result.shortPeriod !== undefined;
            const hasLongPeriod = result && result.longPeriod !== undefined;
            
            if (hasShortPeriod && hasLongPeriod) {
                console.log('[Test] ✓ Multi-parameter strategy optimization successful!');
                console.log('[Test] ✓ shortPeriod:', result.shortPeriod);
                console.log('[Test] ✓ longPeriod:', result.longPeriod);
            } else {
                console.log('[Test] ✗ Some parameters missing in optimization result');
                console.log('[Test] hasShortPeriod:', hasShortPeriod);
                console.log('[Test] hasLongPeriod:', hasLongPeriod);
            }
        })
        .catch(error => {
            console.error('[Test] Multi-parameter strategy optimization error:', error);
        });
    
    // 測試 MACD 策略（有三個參數）
    console.log('[Test] Testing macd_cross strategy with three parameters...');
    
    optimizeStrategyParameters('macd_cross', 'entry', 'sharpeRatio', 60)
        .then(result => {
            console.log('[Test] MACD optimization result:', result);
            console.log('[Test] Expected: optimized shortPeriod, longPeriod AND signalPeriod');
            
            const hasShort = result && result.shortPeriod !== undefined;
            const hasLong = result && result.longPeriod !== undefined;
            const hasSignal = result && result.signalPeriod !== undefined;
            
            if (hasShort && hasLong && hasSignal) {
                console.log('[Test] ✓ Three-parameter optimization successful!');
                console.log('[Test] ✓ shortPeriod:', result.shortPeriod);
                console.log('[Test] ✓ longPeriod:', result.longPeriod);
                console.log('[Test] ✓ signalPeriod:', result.signalPeriod);
            } else {
                console.log('[Test] ✗ Some MACD parameters missing');
                console.log('[Test] hasShort:', hasShort, 'hasLong:', hasLong, 'hasSignal:', hasSignal);
            }
        })
        .catch(error => {
            console.error('[Test] MACD optimization error:', error);
        });
}

// 調試批量優化結果結構
function debugBatchResults() {
    console.log('[Debug] Checking batch optimization results...');
    console.log('[Debug] Results count:', batchOptimizationResults ? batchOptimizationResults.length : 0);
    
    if (batchOptimizationResults && batchOptimizationResults.length > 0) {
        batchOptimizationResults.forEach((result, index) => {
            console.log(`[Debug] Result ${index}:`, result);
            console.log(`[Debug] Result ${index} sellStrategy:`, result.sellStrategy);
            console.log(`[Debug] Result ${index} has riskManagement:`, 'riskManagement' in result);
            console.log(`[Debug] Result ${index} riskManagement:`, result.riskManagement);
            console.log(`[Debug] Result ${index} usedStopLoss:`, result.usedStopLoss);
            console.log(`[Debug] Result ${index} usedTakeProfit:`, result.usedTakeProfit);
            
            if (result.sellStrategy === 'fixed_stop_loss' || result.sellStrategy === 'cover_fixed_stop_loss') {
                if (!result.riskManagement) {
                    console.warn(`[Debug] Warning: Risk management strategy without riskManagement parameters!`);
                } else {
                    console.log(`[Debug] ✓ Risk management parameters found for result ${index}:`, result.riskManagement);
                }
            } else {
                // 非風險管理策略，檢查是否有實際使用的參數
                if (result.usedStopLoss !== undefined || result.usedTakeProfit !== undefined) {
                    console.log(`[Debug] ✓ Used risk parameters found for result ${index}: stopLoss=${result.usedStopLoss}, takeProfit=${result.usedTakeProfit}`);
                } else {
                    console.log(`[Debug] ⚠ No used risk parameters for result ${index}`);
                }
            }
        });
    } else {
        console.log('[Debug] No batch optimization results found');
    }
}

// 測試參數範圍和步進值計算
function testParameterRanges() {
    console.log('[Test] Testing parameter ranges calculation (using global config)...');
    
    // 使用全局配置的範圍和步長
    const stopLossConfig = globalOptimizeTargets.stopLoss;
    const takeProfitConfig = globalOptimizeTargets.takeProfit;
    
    console.log(`[Test] StopLoss config:`, stopLossConfig);
    console.log(`[Test] TakeProfit config:`, takeProfitConfig);
    
    const stopLossRange = stopLossConfig.range;
    const takeProfitRange = takeProfitConfig.range;
    
    const stopLossPoints = Math.floor((stopLossRange.to - stopLossRange.from) / stopLossRange.step) + 1;
    const takeProfitPoints = Math.floor((takeProfitRange.to - takeProfitRange.from) / takeProfitRange.step) + 1;
    
    console.log(`[Test] StopLoss: range ${stopLossRange.from}-${stopLossRange.to}, step ${stopLossRange.step}, points: ${stopLossPoints}`);
    console.log(`[Test] TakeProfit: range ${takeProfitRange.from}-${takeProfitRange.to}, step ${takeProfitRange.step}, points: ${takeProfitPoints}`);
    console.log(`[Test] Total risk combinations: ${stopLossPoints * takeProfitPoints}`);
}

// 檢查所有策略的參數配置
function checkAllStrategyParameters() {
    console.log('[Debug] Checking all strategy parameter configurations...');
    
    if (typeof strategyDescriptions === 'undefined') {
        console.error('[Debug] strategyDescriptions not found');
        return;
    }
    
    const strategies = Object.keys(strategyDescriptions);
    console.log(`[Debug] Found ${strategies.length} strategies to check`);
    
    strategies.forEach(strategyKey => {
        const strategy = strategyDescriptions[strategyKey];
        console.log(`\n[Debug] Strategy: ${strategyKey} (${strategy.name})`);
        console.log(`[Debug] Default params:`, strategy.defaultParams);
        
        if (strategy.optimizeTargets && strategy.optimizeTargets.length > 0) {
            console.log(`[Debug] ✓ Has ${strategy.optimizeTargets.length} optimizable parameters:`);
            strategy.optimizeTargets.forEach((target, index) => {
                console.log(`[Debug]   ${index + 1}. ${target.name} (${target.label}): range ${target.range.from}-${target.range.to}, step ${target.range.step}`);
            });
        } else {
            console.log(`[Debug] ⚠ No optimizable parameters defined`);
        }
    });
    
    // 統計
    const strategiesWithParams = strategies.filter(key => 
        strategyDescriptions[key].optimizeTargets && 
        strategyDescriptions[key].optimizeTargets.length > 0
    );
    
    const multiParamStrategies = strategies.filter(key => 
        strategyDescriptions[key].optimizeTargets && 
        strategyDescriptions[key].optimizeTargets.length > 1
    );
    
    console.log(`\n[Debug] Summary:`);
    console.log(`[Debug] - Total strategies: ${strategies.length}`);
    console.log(`[Debug] - Strategies with parameters: ${strategiesWithParams.length}`);
    console.log(`[Debug] - Multi-parameter strategies: ${multiParamStrategies.length}`);
    
    if (multiParamStrategies.length > 0) {
        console.log(`[Debug] - Multi-parameter strategies:`);
        multiParamStrategies.forEach(key => {
            const paramCount = strategyDescriptions[key].optimizeTargets.length;
            console.log(`[Debug]   * ${key}: ${paramCount} parameters`);
        });
    }
}

// 測試完整的批量優化功能（包含風險管理策略）
function testFullRiskManagementOptimization() {
    console.log('[Test] Testing full batch optimization with risk management...');
    
    if (!cachedStockData || cachedStockData.length < 20) {
        console.error('[Test] No cached stock data available. Please run a backtest first.');
        return;
    }
    
    // 模擬批量優化配置
    const testConfig = {
        buyStrategies: ['ma_cross'],
        sellStrategies: ['fixed_stop_loss'],
        maxCombinations: 2,
        batchSize: 1,
        sortKey: 'annualizedReturn',
        sortDirection: 'desc'
    };
    
    console.log('[Test] Starting test optimization with config:', testConfig);
    
    // 執行測試優化
    executeBatchOptimization(testConfig).then(() => {
        console.log('[Test] Batch optimization completed successfully');
        console.log('[Test] Results count:', batchOptimizationResults.length);
        
        if (batchOptimizationResults.length > 0) {
            const firstResult = batchOptimizationResults[0];
            console.log('[Test] First result:', firstResult);
            
            if (firstResult.riskManagement) {
                console.log('[Test] ✓ Risk management parameters found:', firstResult.riskManagement);
            } else {
                console.log('[Test] ✗ Risk management parameters missing');
            }
        }
        
        // 執行調試
        debugBatchResults();
    }).catch(error => {
        console.error('[Test] Batch optimization failed:', error);
    });
}

// 恢復批量優化UI狀態
function restoreBatchOptimizationUI() {
    const startBtn = document.getElementById('start-batch-optimization');
    const stopBtn = document.getElementById('stop-batch-optimization');
    
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50');
    }
    
    if (stopBtn) {
        stopBtn.classList.add('hidden');
    }
    
    window.batchOptimizationRunning = false;

    // 隱藏並重置 worker 狀態面板
    try {
        const panel = document.getElementById('batch-worker-status-panel');
        if (panel) panel.classList.add('hidden');
    } catch(e) {}
    resetBatchWorkerStatus();
}

// 停止批量優化
function stopBatchOptimization() {
    console.log('[Batch Optimization] Stopping batch optimization...');
    
    // 設置停止標誌
    isBatchOptimizationStopped = true;
    
    // 終止 worker
    if (batchOptimizationWorker) {
        batchOptimizationWorker.terminate();
        batchOptimizationWorker = null;
    }
    
    // 清空進度條並重置進度
    resetBatchProgress();
    
    // 恢復 UI
    restoreBatchOptimizationUI();

    // 隱藏並重置 worker 狀態面板（保險）
    try { resetBatchWorkerStatus(); } catch(e) {}
    
    // 更新進度顯示為已停止
    const progressDiv = document.getElementById('batch-optimization-progress');
    if (progressDiv) {
        const statusDiv = progressDiv.querySelector('.text-sm.text-blue-600');
        if (statusDiv) {
            statusDiv.textContent = '批量優化已停止';
            statusDiv.className = 'text-sm text-red-600 font-medium';
        }
    }
    
    console.log('[Batch Optimization] Stopped successfully');
}

// 將測試函數添加到導出對象
window.batchOptimization.testRiskManagement = testRiskManagementOptimization;
window.batchOptimization.testMultiParameterStrategy = testMultiParameterStrategyOptimization;
window.batchOptimization.testFullRiskManagement = testFullRiskManagementOptimization;
window.batchOptimization.debugResults = debugBatchResults;
window.batchOptimization.testParameterRanges = testParameterRanges;
window.batchOptimization.checkAllParameters = checkAllStrategyParameters;

// 交叉優化進度管理
let crossOptimizationProgress = {
    current: 0,
    total: 0,
    phase: 'idle',
    startTime: null
};

// 顯示交叉優化進度
function showCrossOptimizationProgress(phase = 'entry') {
    try {
        const progressDiv = document.getElementById('cross-optimization-progress');
        const progressIcon = document.getElementById('cross-progress-icon');
        const progressDetail = document.getElementById('cross-progress-detail');
        const progressStatus = document.getElementById('cross-progress-status');
        
        if (progressDiv) progressDiv.classList.remove('hidden');
        if (progressIcon) progressIcon.classList.add('animate-pulse');
        if (progressDetail) progressDetail.textContent = '正在初始化交叉優化...';
        if (progressStatus) {
            progressStatus.textContent = phase === 'entry' ? '📈 第二階段：進場策略優化' : '📉 第三階段：出場策略優化';
        }
        
        // 重置進度
        crossOptimizationProgress = { current: 0, total: 0, phase: phase, startTime: Date.now() };
        updateCrossOptimizationProgress();
    } catch (error) {
        console.error('[Cross Optimization] Error showing progress:', error);
    }
}

// 隱藏交叉優化進度
function hideCrossOptimizationProgress() {
    try {
        const progressDiv = document.getElementById('cross-optimization-progress');
        const progressIcon = document.getElementById('cross-progress-icon');
        
        if (progressDiv) progressDiv.classList.add('hidden');
        if (progressIcon) progressIcon.classList.remove('animate-pulse');
        
        console.log('[Cross Optimization] Progress hidden');
    } catch (error) {
        console.error('[Cross Optimization] Error hiding progress:', error);
    }
}

// 更新交叉優化進度
function updateCrossOptimizationProgress(currentTask = null) {
    try {
        const progressText = document.getElementById('cross-progress-text');
        const progressBar = document.getElementById('cross-progress-bar');
        const progressDetail = document.getElementById('cross-progress-detail');
        const timeEstimate = document.getElementById('cross-time-estimate');
        
        if (!progressText || !progressBar || !progressDetail) return;
        
        // 計算進度百分比
        const percentage = crossOptimizationProgress.total > 0 ? 
            Math.floor((crossOptimizationProgress.current / crossOptimizationProgress.total) * 100) : 0;
        
        progressText.textContent = `${percentage}%`;
        progressBar.style.width = `${percentage}%`;
        
        // 更新詳細信息
        if (currentTask) {
            const entryName = strategyDescriptions[currentTask.entryStrategy]?.name || currentTask.entryStrategy;
            const exitName = strategyDescriptions[currentTask.exitStrategy]?.name || currentTask.exitStrategy;
            progressDetail.textContent = `🔄 正在優化: ${entryName} + ${exitName} (${crossOptimizationProgress.current}/${crossOptimizationProgress.total})`;
        } else {
            progressDetail.textContent = `處理中... (${crossOptimizationProgress.current}/${crossOptimizationProgress.total})`;
        }
        
        // 時間估算
        if (timeEstimate && crossOptimizationProgress.startTime && crossOptimizationProgress.current > 0) {
            const elapsed = Date.now() - crossOptimizationProgress.startTime;
            const avgTime = elapsed / crossOptimizationProgress.current;
            const remaining = crossOptimizationProgress.total - crossOptimizationProgress.current;
            const estimatedMinutes = Math.ceil((avgTime * remaining) / 60000);
            
            if (estimatedMinutes > 0) {
                timeEstimate.textContent = `預估剩餘: ${estimatedMinutes} 分鐘`;
            } else {
                timeEstimate.textContent = '即將完成...';
            }
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error updating progress:', error);
    }
}

// 添加交叉優化結果到總結果中，並進行去重處理
function addCrossOptimizationResults(newResults) {
    newResults.forEach(newResult => {
        // 查找是否有相同的買入策略、賣出策略和年化報酬率的結果
        const existingIndex = batchOptimizationResults.findIndex(existing =>
            existing.buyStrategy === newResult.buyStrategy &&
            existing.sellStrategy === newResult.sellStrategy &&
            Math.abs(existing.annualizedReturn - newResult.annualizedReturn) < 0.0001 // 允許微小差異
        );
        
        if (existingIndex !== -1) {
            // 找到重複結果，合併優化類型標籤
            const existing = batchOptimizationResults[existingIndex];
            
            // 合併優化類型標籤
            const existingTypes = existing.optimizationTypes || [existing.optimizationType || '基礎'];
            const newType = newResult.optimizationType || '基礎';
            
            if (!existingTypes.includes(newType)) {
                existingTypes.push(newType);
            }
            
            // 更新現有結果
            existing.optimizationTypes = existingTypes;
            existing.isDuplicate = true;
            
            console.log(`[Cross Optimization] 合併重複結果: ${newResult.buyStrategy} + ${newResult.sellStrategy}, 優化類型: ${existingTypes.join(', ')}`);
        } else {
            // 沒有重複，直接添加新結果
            if (newResult.optimizationType) {
                newResult.optimizationTypes = [newResult.optimizationType];
            }
            batchOptimizationResults.push(newResult);
            console.log(`[Cross Optimization] 添加新結果: ${newResult.buyStrategy} + ${newResult.sellStrategy}, 類型: ${newResult.optimizationType}`);
        }
    });

    updateOFIMetrics({
        alpha: batchOptimizationConfig.ofiAlpha,
        blockCount: batchOptimizationConfig.ofiBlocks,
        dsrTrials: batchOptimizationResults.length,
        spaAlpha: batchOptimizationConfig.spaAlpha,
        bootstrapSamples: batchOptimizationConfig.spaBootstrapSamples,
        avgBlockLength: batchOptimizationConfig.spaBlockLength,
        minSampleSize: batchOptimizationConfig.spaMinSampleSize
    });
}

// 快速優化單一策略參數（減少步數，用於交叉優化）
async function optimizeSingleStrategyParametersFast(strategy, strategyType, strategyInfo, baseParams) {
    try {
        if (!strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
            return getDefaultStrategyParams(strategy);
        }
        
        const optimizeTarget = strategyInfo.optimizeTargets[0]; // 優化第一個參數
        const range = optimizeTarget.range;
        
        // 獲取優化目標指標
        const config = getBatchOptimizationConfig();
        const targetMetric = config.targetMetric || 'annualizedReturn';
        
        let bestParams = getDefaultStrategyParams(strategy);
        let bestMetric = targetMetric === 'maxDrawdown' ? Infinity : -Infinity;
        
        // 根據迭代次數決定優化步驟（來自UI設定）
        const iterationLimit = parseInt(document.getElementById('batch-optimize-iteration-limit')?.value) || 6;
        const steps = Math.min(iterationLimit, Math.ceil((range.to - range.from) / range.step));
        const stepSize = (range.to - range.from) / steps;
        
        for (let i = 0; i <= steps; i++) {
            const testValue = range.from + i * stepSize;
            const testParams = { ...bestParams };
            testParams[optimizeTarget.name] = testValue;
            
            // 設定測試參數
            const testBacktestParams = { ...baseParams };
            if (strategyType === 'entry') {
                testBacktestParams.entryParams = testParams;
            } else {
                testBacktestParams.exitParams = testParams;
            }
            
            // 執行回測（使用緩存數據）
            const result = await performSingleBacktestFast(testBacktestParams);
            
            if (result) {
                const metric = getMetricFromResult(result, targetMetric);
                if (!isNaN(metric)) {
                    let isNewBest = false;
                    if (targetMetric === 'maxDrawdown') {
                        // 對於最大回撤，絕對值越小越好
                        isNewBest = Math.abs(metric) < Math.abs(bestMetric);
                    } else {
                        // 對於其他指標，值越大越好
                        isNewBest = metric > bestMetric;
                    }
                    
                    if (isNewBest) {
                        bestMetric = metric;
                        bestParams = { ...testParams };
                    }
                }
            }
        }
        
        return bestParams;
        
    } catch (error) {
        console.error('[Cross Optimization] Error optimizing single strategy:', error);
        return getDefaultStrategyParams(strategy);
    }
}

// 快速執行單次回測（使用緩存數據，用於交叉優化）
function performSingleBacktestFast(params) {
    return new Promise((resolve) => {
        try {
            // 創建 Worker 進行回測
            const worker = new Worker(workerUrl);
            
            const timeoutId = setTimeout(() => {
                worker.terminate();
                resolve(null);
            }, 15000); // 減少超時時間到15秒
            
            worker.onmessage = function(e) {
                // 處理進度消息，但不終止 Worker，繼續等待最終結果
                if (e.data.type === 'progress') {
                    return; // 不要 resolve，繼續等待最終結果
                }
                
                // 處理最終結果
                clearTimeout(timeoutId);
                worker.terminate();
                
                if (e.data.type === 'result') {
                    resolve(e.data.data);
                } else if (e.data.type === 'backtest_result') {
                    resolve(e.data.result);
                } else if (e.data.type === 'error') {
                    console.error('[Cross Optimization] Worker error:', e.data.message);
                    resolve(null);
                } else {
                    resolve(null);
                }
            };
            
            worker.onerror = function(error) {
                clearTimeout(timeoutId);
                worker.terminate();
                console.error('[Cross Optimization] Worker error:', error);
                resolve(null);
            };
            
            // 發送回測請求 - 使用緩存數據提高速度
            const preparedParams = enrichParamsWithLookback(params);
            worker.postMessage({
                type: 'runBacktest',
                params: preparedParams,
                useCachedData: true,
                cachedData: cachedStockData
            });
            
        } catch (error) {
            console.error('[Cross Optimization] Error in performSingleBacktestFast:', error);
            resolve(null);
        }
    });
}
