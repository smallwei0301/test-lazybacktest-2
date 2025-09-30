// --- CSCV PBO Utilities ---
// Patch Tag: LB-OVERFIT-SCORE-20250915A
(function(global) {
    const MODULE_VERSION = 'LB-CSCV-PBO-20250915A';

    function computeCSCVPBO(matrix, options = {}) {
        if (!Array.isArray(matrix) || matrix.length === 0) {
            return null;
        }
        const strategyCount = matrix.length;
        const blockCount = Array.isArray(matrix[0]) ? matrix[0].length : 0;
        if (!Number.isInteger(blockCount) || blockCount < 4 || blockCount % 2 !== 0) {
            return null;
        }
        const cleanedMatrix = matrix.map(row =>
            Array.isArray(row) ? row.map(value => (Number.isFinite(value) ? value : null)) : []
        );
        if (!cleanedMatrix.every(row => row.length === blockCount)) {
            return null;
        }

        const half = blockCount / 2;
        const totalSplits = combinationCount(blockCount, half);
        const lambdaSamples = [];
        const oosDistributions = Array.from({ length: strategyCount }, () => []);
        const championCounts = new Array(strategyCount).fill(0);
        const championFailures = new Array(strategyCount).fill(0);

        const splits = enumerateSymmetricSplits(blockCount, half, options.maxSplits || 1024);
        splits.forEach(indices => {
            const inSample = new Set(indices);
            const outSample = [];
            for (let i = 0; i < blockCount; i += 1) {
                if (!inSample.has(i)) outSample.push(i);
            }

            const isScores = cleanedMatrix.map(row => averageByIndices(row, indices));
            const oosScores = cleanedMatrix.map(row => averageByIndices(row, outSample));

            let championIndex = -1;
            let championScore = -Infinity;
            for (let i = 0; i < strategyCount; i += 1) {
                const score = isScores[i];
                if (!Number.isFinite(score)) continue;
                if (score > championScore) {
                    championScore = score;
                    championIndex = i;
                }
            }
            if (championIndex === -1) return;

            const championOOS = oosScores[championIndex];
            if (!Number.isFinite(championOOS)) return;

            const validOOS = oosScores
                .filter(value => Number.isFinite(value))
                .sort((a, b) => a - b);
            if (validOOS.length === 0) return;

            const rank = 1 + validOOS.findIndex(value => value >= championOOS);
            const adjustedRank = rank <= 0 ? validOOS.length : rank;
            const q = adjustedRank / (validOOS.length + 1);
            const lambda = Math.log(q / (1 - q));
            lambdaSamples.push(lambda);

            oosScores.forEach((score, idx) => {
                if (Number.isFinite(score)) {
                    oosDistributions[idx].push(score);
                }
            });

            championCounts[championIndex] += 1;
            if (lambda < 0) {
                championFailures[championIndex] += 1;
            }
        });

        const pbo = lambdaSamples.length > 0
            ? lambdaSamples.filter(value => value < 0).length / lambdaSamples.length
            : null;

        const oosMedianByConfig = oosDistributions.map(distribution => median(distribution));
        const championPbo = championCounts.map((count, idx) => {
            if (count === 0) return null;
            return championFailures[idx] / count;
        });

        return {
            version: MODULE_VERSION,
            blockCount,
            strategyCount,
            totalSplits,
            evaluatedSplits: lambdaSamples.length,
            pbo,
            lambdaSamples,
            oosDistributions,
            oosMedianByConfig,
            championCounts,
            championFailures,
            championPbo,
        };
    }

    function combinationCount(n, k) {
        if (k < 0 || k > n) return 0;
        let result = 1;
        for (let i = 1; i <= k; i += 1) {
            result = (result * (n - (k - i))) / i;
        }
        return result;
    }

    function enumerateSymmetricSplits(total, take, limit) {
        const results = [];
        const choose = (start, chosen) => {
            if (chosen.length === take) {
                results.push(chosen.slice());
                return;
            }
            if (limit && results.length >= limit) return;
            for (let i = start; i < total; i += 1) {
                chosen.push(i);
                choose(i + 1, chosen);
                chosen.pop();
                if (limit && results.length >= limit) return;
            }
        };
        choose(0, []);
        return results;
    }

    function averageByIndices(series, indices) {
        if (!Array.isArray(series) || indices.length === 0) return null;
        let sum = 0;
        let count = 0;
        for (let i = 0; i < indices.length; i += 1) {
            const value = series[indices[i]];
            if (!Number.isFinite(value)) continue;
            sum += value;
            count += 1;
        }
        if (count === 0) return null;
        return sum / count;
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

    global.lazyPBO = {
        version: MODULE_VERSION,
        computeCSCVPBO,
    };
})(typeof window !== 'undefined' ? window : self);
