(function(global) {
    const OVERFIT_VERSION_CODE = 'LB-OVERFIT-SCORING-20250705A';

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function average(values) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length === 0) return null;
        const sum = valid.reduce((acc, v) => acc + v, 0);
        return sum / valid.length;
    }

    function median(values) {
        const valid = values.filter(isFiniteNumber).sort((a, b) => a - b);
        if (valid.length === 0) return null;
        const mid = Math.floor(valid.length / 2);
        if (valid.length % 2 === 0) {
            return (valid[mid - 1] + valid[mid]) / 2;
        }
        return valid[mid];
    }

    function quantile(values, q) {
        const valid = values.filter(isFiniteNumber).sort((a, b) => a - b);
        if (valid.length === 0) return null;
        const pos = (valid.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (base + 1 < valid.length) {
            return valid[base] + rest * (valid[base + 1] - valid[base]);
        }
        return valid[base];
    }

    function generateCombinations(elements, choose) {
        const results = [];
        const path = [];
        function backtrack(start) {
            if (path.length === choose) {
                results.push(path.slice());
                return;
            }
            for (let i = start; i < elements.length; i++) {
                path.push(elements[i]);
                backtrack(i + 1);
                path.pop();
            }
        }
        backtrack(0);
        return results;
    }

    function computeCSCVPBO(matrix, options = {}) {
        if (!Array.isArray(matrix) || matrix.length === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                blockCount: 0,
                splitCount: 0,
                pbo: null,
                lambdaSamples: [],
                configStats: [],
                notes: ['matrix_empty']
            };
        }

        const requestedBlocks = Number.isFinite(options.blockCount) ? Math.floor(options.blockCount) : (Array.isArray(matrix[0]) ? matrix[0].length : 0);
        let blockCount = Math.max(4, requestedBlocks);
        if (blockCount % 2 !== 0) {
            blockCount -= 1;
        }
        if (blockCount < 4) {
            return {
                version: OVERFIT_VERSION_CODE,
                blockCount: 0,
                splitCount: 0,
                pbo: null,
                lambdaSamples: [],
                configStats: [],
                notes: ['block_count_too_small']
            };
        }

        const trimmedMatrix = matrix.map((row) => {
            const safeRow = Array.isArray(row) ? row.slice(0, blockCount) : [];
            while (safeRow.length < blockCount) {
                safeRow.push(null);
            }
            return safeRow;
        });

        const columnCount = trimmedMatrix[0].length;
        if (columnCount < blockCount) {
            return {
                version: OVERFIT_VERSION_CODE,
                blockCount: columnCount,
                splitCount: 0,
                pbo: null,
                lambdaSamples: [],
                configStats: [],
                notes: ['insufficient_columns']
            };
        }

        const half = Math.floor(blockCount / 2);
        const blockIndices = Array.from({ length: blockCount }, (_, i) => i);
        const trainSets = generateCombinations(blockIndices, half);
        if (trainSets.length === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                blockCount,
                splitCount: 0,
                pbo: null,
                lambdaSamples: [],
                configStats: [],
                notes: ['no_training_sets']
            };
        }

        const lambdaSamples = [];
        const qSamples = [];
        const selectionCounts = Array(trimmedMatrix.length).fill(0);
        const oosSamplesByConfig = Array.from({ length: trimmedMatrix.length }, () => []);
        const configBelowMedianCounts = Array(trimmedMatrix.length).fill(0);

        trainSets.forEach((trainSet) => {
            const testSet = blockIndices.filter((idx) => !trainSet.includes(idx));

            const trainMetrics = trimmedMatrix.map((row) => average(trainSet.map((idx) => row[idx])));
            const bestTrainMetric = Math.max(...trainMetrics.map((val) => (isFiniteNumber(val) ? val : -Infinity)));
            const bestConfigIndex = trainMetrics.findIndex((val) => val === bestTrainMetric);
            if (bestConfigIndex === -1) {
                return;
            }
            selectionCounts[bestConfigIndex] += 1;

            const oosMetrics = trimmedMatrix.map((row) => average(testSet.map((idx) => row[idx])));
            const sortedOos = oosMetrics
                .map((value, idx) => ({ value: isFiniteNumber(value) ? value : -Infinity, idx }))
                .sort((a, b) => a.value - b.value);

            let rank = sortedOos.length;
            for (let i = 0; i < sortedOos.length; i++) {
                if (sortedOos[i].idx === bestConfigIndex) {
                    rank = i + 1;
                    break;
                }
            }
            const k = sortedOos.length;
            const qRaw = (rank - 0.5) / k;
            const q = Math.min(1 - 1 / (2 * k), Math.max(1 / (2 * k), qRaw));
            const lambda = Math.log((1 - q) / q);
            lambdaSamples.push(lambda);
            qSamples.push(q);

            const oosForBest = oosMetrics[bestConfigIndex];
            oosSamplesByConfig[bestConfigIndex].push(oosForBest);

            const oosValues = sortedOos.map((item) => item.value);
            const oosMedianValue = median(oosValues);
            if (isFiniteNumber(oosForBest) && isFiniteNumber(oosMedianValue) && oosForBest < oosMedianValue) {
                configBelowMedianCounts[bestConfigIndex] += 1;
            }
        });

        const pbo = lambdaSamples.length > 0
            ? lambdaSamples.filter((lambda) => isFiniteNumber(lambda) && lambda < 0).length / lambdaSamples.length
            : null;

        const configStats = trimmedMatrix.map((row, idx) => {
            const samples = oosSamplesByConfig[idx];
            const medianValue = median(samples);
            const meanValue = average(samples);
            const winRate = samples.length > 0
                ? (samples.filter((val) => isFiniteNumber(val) && medianValue !== null ? val >= medianValue : true).length / samples.length)
                : null;
            const belowMedianRate = samples.length > 0 ? configBelowMedianCounts[idx] / samples.length : null;
            return {
                index: idx,
                medianOOS: medianValue,
                meanOOS: meanValue,
                samples,
                selectionCount: selectionCounts[idx],
                belowMedianRate,
                winRate,
            };
        });

        return {
            version: OVERFIT_VERSION_CODE,
            blockCount,
            splitCount: trainSets.length,
            pbo,
            lambdaSamples,
            qSamples,
            configStats,
        };
    }

    if (!global.lazybacktestOverfit) {
        global.lazybacktestOverfit = {};
    }

    if (!global.lazybacktestOverfit.pbo) {
        global.lazybacktestOverfit.pbo = {};
    }

    global.lazybacktestOverfit.pbo.computeCSCVPBO = computeCSCVPBO;
    global.lazybacktestOverfit.pbo.version = OVERFIT_VERSION_CODE;
    global.lazybacktestOverfit.pbo.helpers = {
        median,
        quantile,
    };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
