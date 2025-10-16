// Patch Tag: LB-BATCH-HYBRID-20250215A
// RBF Surrogate model for surrogate-assisted optimizers
(function (globalScope) {
    const globalTarget = typeof globalScope !== 'undefined' ? globalScope : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));

    function computeMedian(values) {
        if (!values || values.length === 0) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    function squaredDistance(a, b) {
        const len = Math.max(a.length, b.length);
        let sum = 0;
        for (let i = 0; i < len; i++) {
            const diff = (a[i] || 0) - (b[i] || 0);
            sum += diff * diff;
        }
        return sum;
    }

    function createRBFSurrogate() {
        const samples = [];
        let gamma = 1;

        function recomputeGamma() {
            if (samples.length < 2) {
                gamma = 1;
                return;
            }
            const distances = [];
            for (let i = 0; i < samples.length; i++) {
                for (let j = i + 1; j < samples.length; j++) {
                    const dist = Math.sqrt(squaredDistance(samples[i].vec, samples[j].vec));
                    if (Number.isFinite(dist) && dist > 0) {
                        distances.push(dist);
                    }
                }
            }
            const median = computeMedian(distances);
            if (!Number.isFinite(median) || median <= 0) {
                gamma = 1;
                return;
            }
            gamma = 1 / (median * median);
        }

        function add(vec, score) {
            if (!Array.isArray(vec)) return;
            if (!Number.isFinite(score)) return;
            samples.push({ vec: vec.slice(), score });
            if (samples.length <= 1) {
                gamma = 1;
            } else {
                recomputeGamma();
            }
        }

        function predict(vec) {
            if (!Array.isArray(vec) || samples.length === 0) {
                return 0;
            }
            if (samples.length === 1) {
                return samples[0].score;
            }
            let numerator = 0;
            let denominator = 0;
            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];
                const distSquared = squaredDistance(vec, sample.vec);
                const weight = Math.exp(-gamma * distSquared);
                numerator += weight * sample.score;
                denominator += weight;
            }
            if (denominator === 0) {
                const avg = samples.reduce((acc, cur) => acc + cur.score, 0) / samples.length;
                return avg;
            }
            return numerator / denominator;
        }

        function size() {
            return samples.length;
        }

        return { add, predict, size };
    }

    if (!globalTarget.lazybacktestOptimizers) {
        globalTarget.lazybacktestOptimizers = {};
    }
    globalTarget.lazybacktestOptimizers.createRBFSurrogate = createRBFSurrogate;
})(typeof self !== 'undefined' ? self : this);
