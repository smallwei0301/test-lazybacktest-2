// Stage4 Local Refinement Runner - CEM Implementation
// Patch Tag: LB-STAGE4-REFINE-20250705A

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function roundByType(value, spec) {
    if (!Number.isFinite(value)) return spec?.min ?? 0;
    if (spec?.enum && Array.isArray(spec.enum) && spec.enum.length > 0) {
        const index = Math.min(spec.enum.length - 1, Math.max(0, Math.round(value)));
        return spec.enum[index];
    }
    if (spec?.type === 'int') {
        return Math.round(value);
    }
    const step = Number.isFinite(spec?.step) && spec.step > 0 ? spec.step : null;
    if (step) {
        return Math.round(value / step) * step;
    }
    return value;
}

function normaliseVector(vector, specs) {
    return vector.map((value, index) => {
        const spec = specs[index];
        if (!spec) return clamp01(value);
        if (spec.enum && Array.isArray(spec.enum) && spec.enum.length > 1) {
            const values = spec.enum;
            const idx = Math.max(0, values.findIndex((val) => val === value));
            return values.length <= 1 ? 0 : clamp01(idx / (values.length - 1));
        }
        const min = Number.isFinite(spec.min) ? spec.min : 0;
        const max = Number.isFinite(spec.max) ? spec.max : 1;
        if (max === min) return 0;
        return clamp01((value - min) / (max - min));
    });
}

function denormaliseVector(vector, specs) {
    return vector.map((value, index) => {
        const spec = specs[index];
        if (!spec) return value;
        const min = Number.isFinite(spec.min) ? spec.min : 0;
        const max = Number.isFinite(spec.max) ? spec.max : 1;
        if (spec.enum && Array.isArray(spec.enum) && spec.enum.length > 0) {
            const idx = Math.round(clamp01(value) * (spec.enum.length - 1));
            return spec.enum[Math.min(spec.enum.length - 1, Math.max(0, idx))];
        }
        const actual = min + clamp01(value) * (max - min);
        const clamped = Math.min(max, Math.max(min, actual));
        return roundByType(clamped, spec);
    });
}

function boxMullerRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

async function evaluatePopulation(evaluator, candidates) {
    const results = await evaluator(candidates);
    if (!Array.isArray(results)) return [];
    return results.map((result, index) => ({ result, candidate: candidates[index] }));
}

export async function runCEM({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => r.score,
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress = () => {}
} = {}) {
    if (!start) throw new Error('CEM: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('CEM: encode/decode functions are required');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('CEM: evaluator is required');
    }

    const boundKeys = Object.keys(bounds || {}).filter((key) => key !== 'constraintFix');
    if (boundKeys.length === 0) {
        throw new Error('CEM: bounds is empty');
    }
    const specs = boundKeys.map((key) => ({ key, ...bounds[key] }));
    const constraintFix = typeof bounds?.constraintFix === 'function' ? bounds.constraintFix : null;

    const startVector = encodeVec(start);
    let mean = normaliseVector(startVector, specs);
    let sigma = specs.map(() => initSigma);

    let bestScore = -Infinity;
    let bestParams = start;
    let bestMetrics = null;

    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));

    for (let iter = 0; iter < iters; iter++) {
        const samples = [];
        const candidates = [];

        for (let i = 0; i < popSize; i++) {
            const sampleVector = mean.map((m, index) => clamp01(m + sigma[index] * boxMullerRandom()));
            const decodedVector = denormaliseVector(sampleVector, specs);
            let candidate = decodeVec(decodedVector);
            if (constraintFix) {
                candidate = constraintFix(candidate) || candidate;
            }
            samples.push(sampleVector);
            candidates.push(candidate);
        }

        const evaluated = await evaluatePopulation(evaluator, candidates);
        const scored = evaluated
            .map(({ result, candidate }, index) => ({
                score: objective(result ?? { score: -Infinity }),
                metrics: result,
                candidate,
                vector: samples[index]
            }))
            .filter((item) => Number.isFinite(item.score));

        if (scored.length === 0) {
            try {
                onProgress({ iter: iter + 1, bestScore });
            } catch (error) {
                console.warn('[CEM] onProgress callback failed:', error);
            }
            continue;
        }

        scored.sort((a, b) => b.score - a.score);
        const elite = scored.slice(0, eliteCount);

        if (elite[0] && elite[0].score > bestScore) {
            bestScore = elite[0].score;
            bestParams = elite[0].candidate;
            bestMetrics = elite[0].metrics;
        }

        const newMean = new Array(mean.length).fill(0);
        const newSigma = new Array(mean.length).fill(0);

        elite.forEach((item) => {
            item.vector.forEach((value, index) => {
                newMean[index] += value;
            });
        });

        for (let index = 0; index < newMean.length; index++) {
            newMean[index] /= elite.length;
        }

        elite.forEach((item) => {
            item.vector.forEach((value, index) => {
                const diff = value - newMean[index];
                newSigma[index] += diff * diff;
            });
        });

        for (let index = 0; index < newSigma.length; index++) {
            const variance = elite.length > 1 ? newSigma[index] / (elite.length - 1) : 0;
            const std = Math.sqrt(Math.max(variance, 1e-6));
            sigma[index] = clamp01(0.9 * sigma[index] + 0.1 * std);
            mean[index] = clamp01(newMean[index]);
        }

        try {
            onProgress({ iter: iter + 1, bestScore });
        } catch (error) {
            console.warn('[CEM] onProgress callback failed:', error);
        }
    }

    return { bestParams, bestScore, bestMetrics };
}
