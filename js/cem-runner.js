// --- Stage4 CEM Runner - LB-STAGE4-REFINE-20250930A ---

const EPSILON = 1e-9;

function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function toRanges(bounds, keys) {
    return keys.map((key) => {
        const def = bounds[key] || {};
        const min = Number.isFinite(def.min) ? def.min : 0;
        let max = Number.isFinite(def.max) ? def.max : min + 1;
        if (max - min <= EPSILON) {
            max = min + 1;
        }
        return { min, max };
    });
}

function normaliseVector(vec, ranges) {
    return vec.map((value, index) => {
        const { min, max } = ranges[index];
        const width = max - min;
        if (width <= EPSILON) return 0;
        return clamp((value - min) / width, 0, 1);
    });
}

function denormaliseVector(vec, ranges) {
    return vec.map((value, index) => {
        const { min, max } = ranges[index];
        const width = max - min;
        if (width <= EPSILON) return clamp(min, min, max);
        return clamp(min + value * width, min, max);
    });
}

function clampUnitVector(vec) {
    return vec.map((value) => clamp(value, 0, 1));
}

function gaussianRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function safeObjective(objective, result) {
    try {
        const value = objective(result);
        return Number.isFinite(value) ? value : -Infinity;
    } catch (error) {
        return -Infinity;
    }
}

export async function runCEM({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && Number.isFinite(r.score) ? r.score : -Infinity),
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress = () => {}
}) {
    if (!start) throw new Error('CEM: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('CEM: encodeVec/decodeVec not provided');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('CEM: evaluator not provided');
    }

    const paramKeys = Object.keys(bounds || {}).filter((key) => typeof bounds[key] === 'object');
    if (paramKeys.length === 0) {
        throw new Error('CEM: bounds is empty');
    }

    const ranges = toRanges(bounds, paramKeys);
    const startVec = encodeVec(start);
    const startUnit = normaliseVector(startVec, ranges);

    let mu = [...startUnit];
    let sigma = new Array(paramKeys.length).fill(initSigma);

    const initialEval = await evaluator([start]);
    const initialScore = safeObjective(objective, Array.isArray(initialEval) ? initialEval[0] : initialEval);

    let bestParams = start;
    let bestEvaluation = Array.isArray(initialEval) ? initialEval[0] : initialEval;
    let bestScore = Number.isFinite(initialScore) ? initialScore : -Infinity;

    const eliteCount = Math.max(1, Math.floor(popSize * eliteRatio));

    for (let iterIndex = 0; iterIndex < iters; iterIndex++) {
        const samples = [];

        const deterministicCandidate = decodeVec(denormaliseVector(mu, ranges));
        const [deterministicEval] = await evaluator([deterministicCandidate]) || [];
        const deterministicScore = safeObjective(objective, deterministicEval);
        samples.push({ unit: [...mu], params: deterministicCandidate, score: deterministicScore, evaluation: deterministicEval });

        const actualSamples = Math.max(0, popSize - 1);
        for (let i = 0; i < actualSamples; i++) {
            const unitCandidate = mu.map((m, idx) => m + gaussianRandom() * sigma[idx]);
            const clampedUnit = clampUnitVector(unitCandidate);
            const params = decodeVec(denormaliseVector(clampedUnit, ranges));
            const [evaluation] = await evaluator([params]) || [];
            const score = safeObjective(objective, evaluation);
            samples.push({ unit: clampedUnit, params, score, evaluation });
        }

        samples.forEach((sample) => {
            if (sample.score > bestScore && sample.evaluation) {
                bestScore = sample.score;
                bestParams = sample.params;
                bestEvaluation = sample.evaluation;
            }
        });

        samples.sort((a, b) => b.score - a.score);
        const elites = samples.slice(0, eliteCount);

        const newMu = new Array(paramKeys.length).fill(0);
        const newSigma = new Array(paramKeys.length).fill(0);

        elites.forEach((elite) => {
            elite.unit.forEach((value, idx) => {
                newMu[idx] += value;
            });
        });

        newMu.forEach((value, idx, arr) => {
            arr[idx] = value / elites.length;
        });

        elites.forEach((elite) => {
            elite.unit.forEach((value, idx) => {
                const diff = value - newMu[idx];
                newSigma[idx] += diff * diff;
            });
        });

        newSigma.forEach((value, idx, arr) => {
            const variance = value / elites.length;
            const stdDev = Math.sqrt(Math.max(variance, 1e-6));
            const decayed = sigma[idx] * 0.85 + stdDev * 0.15;
            arr[idx] = clamp(decayed, 0.01, 0.5);
        });

        mu = clampUnitVector(newMu);
        sigma = newSigma;

        try {
            onProgress({ iter: iterIndex + 1, bestScore });
        } catch (error) {
            // ignore UI callback errors
        }
    }

    return {
        bestParams,
        bestScore,
        bestEvaluation
    };
}
