(function (global) {
    function squaredDistance(a, b) {
        const length = Math.max(Array.isArray(a) ? a.length : 0, Array.isArray(b) ? b.length : 0);
        let sum = 0;
        for (let i = 0; i < length; i += 1) {
            const av = Number.isFinite(a?.[i]) ? Number(a[i]) : 0;
            const bv = Number.isFinite(b?.[i]) ? Number(b[i]) : 0;
            const diff = av - bv;
            sum += diff * diff;
        }
        return sum;
    }

    function createRBFSurrogate(options = {}) {
        const gamma = Number(options.gamma) > 0 ? Number(options.gamma) : 0.5;
        const samples = [];

        function averageScore() {
            if (samples.length === 0) return 0;
            return samples.reduce((acc, sample) => acc + sample.score, 0) / samples.length;
        }

        return {
            add(vec, score) {
                if (!Array.isArray(vec) || !Number.isFinite(score)) return;
                samples.push({ vec: vec.slice(), score: Number(score) });
            },
            predict(vec) {
                if (samples.length === 0) return 0;
                if (!Array.isArray(vec) || vec.length === 0) return averageScore();
                let numerator = 0;
                let denominator = 0;
                samples.forEach((sample) => {
                    const dist = squaredDistance(sample.vec, vec);
                    const weight = Math.exp(-gamma * dist);
                    numerator += weight * sample.score;
                    denominator += weight;
                });
                if (denominator === 0) return averageScore();
                return numerator / denominator;
            },
            size() {
                return samples.length;
            }
        };
    }

    global.lazybacktestSurrogate = {
        createRBFSurrogate,
        create: createRBFSurrogate
    };
})(typeof window !== 'undefined' ? window : self);
