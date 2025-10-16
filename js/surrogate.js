/* global window */
// Patch Tag: LB-BATCH-SURROGATE-20260130A — RBF surrogate for快速預估。
(function initSurrogateModule(global) {
    if (global && global.createRBFSurrogate) {
        return;
    }

    function squaredEuclidean(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return Infinity;
        }
        let sum = 0;
        for (let i = 0; i < a.length; i += 1) {
            const diff = (a[i] || 0) - (b[i] || 0);
            sum += diff * diff;
        }
        return sum;
    }

    function euclidean(a, b) {
        const distSq = squaredEuclidean(a, b);
        return Number.isFinite(distSq) ? Math.sqrt(Math.max(0, distSq)) : Infinity;
    }

    function recomputeLengthScale(samples, fallback) {
        if (!Array.isArray(samples) || samples.length < 2) {
            return fallback;
        }
        const maxPairs = 120;
        let total = 0;
        let count = 0;
        for (let i = 0; i < samples.length; i += 1) {
            for (let j = i + 1; j < samples.length; j += 1) {
                total += euclidean(samples[i].vec, samples[j].vec);
                count += 1;
                if (count >= maxPairs) {
                    return (total / count) || fallback;
                }
            }
        }
        const avg = (total / Math.max(1, count)) || fallback;
        return avg > 0 ? avg : fallback;
    }

    function createRBFSurrogate(options = {}) {
        const samples = [];
        const minLengthScale = 1e-6;
        let lengthScale = options.lengthScale && options.lengthScale > minLengthScale
            ? options.lengthScale
            : 1;

        function add(vec, score) {
            if (!Array.isArray(vec) || vec.length === 0 || !Number.isFinite(score)) {
                return;
            }
            samples.push({ vec: vec.slice(), score });
            lengthScale = recomputeLengthScale(samples, lengthScale);
            if (!Number.isFinite(lengthScale) || lengthScale <= minLengthScale) {
                lengthScale = 1;
            }
        }

        function predict(vec) {
            if (samples.length === 0 || !Array.isArray(vec) || vec.length === 0) {
                return 0;
            }
            let numerator = 0;
            let denominator = 0;
            let fallbackScore = samples[0].score;
            const ls = Math.max(lengthScale, minLengthScale);
            const denomFactor = 2 * ls * ls;

            for (let i = 0; i < samples.length; i += 1) {
                const sample = samples[i];
                const distSq = squaredEuclidean(vec, sample.vec);
                if (!Number.isFinite(distSq)) {
                    continue;
                }
                if (distSq === 0) {
                    return sample.score;
                }
                const weight = Math.exp(-distSq / denomFactor);
                numerator += weight * sample.score;
                denominator += weight;
                if (i === 0 || Math.abs(weight) > Math.abs(denominator)) {
                    fallbackScore = sample.score;
                }
            }

            if (denominator === 0) {
                return fallbackScore;
            }
            return numerator / denominator;
        }

        function size() {
            return samples.length;
        }

        return {
            add,
            predict,
            size,
        };
    }

    global.createRBFSurrogate = createRBFSurrogate;
})(typeof window !== 'undefined' ? window : self);
