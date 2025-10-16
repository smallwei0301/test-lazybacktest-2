// RBF Surrogate - LB-BATCH-SURROGATE-20250715A
(function (global) {
    const VERSION = 'LB-BATCH-SURROGATE-20250715A';

    function squaredDistance(a, b) {
        let sum = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const diff = (a[i] || 0) - (b[i] || 0);
            sum += diff * diff;
        }
        return sum;
    }

    function createRBFSurrogate(options = {}) {
        const gamma = typeof options.gamma === 'number' && options.gamma > 0 ? options.gamma : null;
        const samples = [];
        const vectors = [];

        function add(vec, score) {
            if (!Array.isArray(vec)) return;
            if (!Number.isFinite(score)) return;
            vectors.push(vec.slice());
            samples.push(Number(score));
        }

        function size() {
            return samples.length;
        }

        function predict(vec) {
            if (!Array.isArray(vec) || vec.length === 0) return 0;
            if (samples.length === 0) return 0;
            if (samples.length === 1) return samples[0];

            const weights = [];
            let weightSum = 0;
            const localGamma = gamma || computeAdaptiveGamma(vec);
            for (let i = 0; i < samples.length; i++) {
                const dist = squaredDistance(vec, vectors[i]);
                const weight = Math.exp(-localGamma * dist);
                weights.push(weight);
                weightSum += weight;
            }
            if (weightSum === 0) {
                return samples.reduce((acc, val) => acc + val, 0) / samples.length;
            }
            let prediction = 0;
            for (let i = 0; i < samples.length; i++) {
                prediction += (weights[i] / weightSum) * samples[i];
            }
            return prediction;
        }

        function computeAdaptiveGamma(vec) {
            if (samples.length < 2) return 0.5;
            let avgDistance = 0;
            const comparisons = Math.min(samples.length, 12);
            for (let i = 0; i < comparisons; i++) {
                const idx = (i * 9973) % samples.length;
                avgDistance += Math.sqrt(squaredDistance(vec, vectors[idx]));
            }
            avgDistance /= comparisons;
            if (!Number.isFinite(avgDistance) || avgDistance <= 1e-6) {
                return 0.5;
            }
            return 1 / (2 * avgDistance * avgDistance);
        }

        return {
            VERSION,
            add,
            predict,
            size,
        };
    }

    global.lazybacktestSurrogate = {
        VERSION,
        createRBFSurrogate,
    };
})(typeof window !== 'undefined' ? window : self);
