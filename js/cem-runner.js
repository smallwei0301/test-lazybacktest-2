// --- Stage 4 Local Refinement: CEM Runner ---
// Patch Tag: LB-STAGE4-REFINE-20250930A

const EPSILON = 1e-12;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function normaliseVector(rawVec, bounds, keys) {
    return rawVec.map((value, index) => {
        const key = keys[index];
        const bound = bounds[key];
        if (!bound) return 0;
        const min = Number(bound.min ?? 0);
        const max = Number(bound.max ?? 1);
        const span = Math.max(max - min, EPSILON);
        const numeric = Number.isFinite(value) ? value : min;
        return clamp01((numeric - min) / span);
    });
}

function snapToStep(value, bound) {
    const min = Number(bound.min ?? 0);
    const max = Number(bound.max ?? 1);
    const step = Number(bound.step ?? 0);
    let snapped = value;
    if (Number.isFinite(step) && step > 0) {
        const ratio = Math.round((value - min) / step);
        snapped = min + ratio * step;
    }
    snapped = Math.min(max, Math.max(min, snapped));
    if (bound.type === 'int') {
        snapped = Math.round(snapped);
    }
    return snapped;
}

function denormaliseVector(normVec, bounds, keys) {
    return normVec.map((value, index) => {
        const key = keys[index];
        const bound = bounds[key];
        if (!bound) return value;
        const min = Number(bound.min ?? 0);
        const max = Number(bound.max ?? 1);
        const span = Math.max(max - min, EPSILON);
        const clamped = clamp01(value);
        const denorm = min + clamped * span;
        return snapToStep(denorm, bound);
    });
}

function randomNormal(random) {
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

async function evaluateCandidate(theta, bounds, keys, decodeVec, evaluator, objective) {
    const candidateVec = denormaliseVector(theta, bounds, keys);
    const decoded = decodeVec(candidateVec);
    const fixed = typeof bounds.constraintFix === 'function'
        ? (bounds.constraintFix(decoded) || decoded)
        : decoded;
    const evalInput = Array.isArray(fixed) ? fixed : [fixed];
    const evalResult = await evaluator(evalInput);
    const record = Array.isArray(evalResult) ? evalResult[0] : evalResult;
    const scoreRaw = objective(record);
    const score = Number.isFinite(scoreRaw) ? scoreRaw : -Infinity;
    return { score, record, params: fixed };
}

function clampSigma(value) {
    return Math.max(0.05, Math.min(0.6, value));
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
}) {
    if (!start) throw new Error('CEM: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('CEM: encodeVec/decodeVec must be functions');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('CEM: evaluator must be provided');
    }

    const boundEntries = Object.entries(bounds || {}).filter(([key]) => key !== 'constraintFix');
    if (boundEntries.length === 0) {
        throw new Error('CEM: bounds required');
    }
    const keys = boundEntries.map(([key]) => key);
    const baseVec = encodeVec(start);
    let mean = normaliseVector(baseVec, bounds, keys);
    let sigma = new Array(mean.length).fill(clampSigma(initSigma));

    let bestScore = -Infinity;
    let bestParams = start;
    let bestEvaluation = null;
    const random = Math.random;
    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));

    for (let iter = 0; iter < iters; iter++) {
        const population = [];
        const evaluations = [];

        for (let i = 0; i < popSize; i++) {
            const sample = mean.map((mu, index) => {
                const value = mu + sigma[index] * randomNormal(random);
                return clamp01(value);
            });
            population.push(sample);
        }

        const results = [];
        for (let i = 0; i < population.length; i++) {
            const evaluation = await evaluateCandidate(population[i], bounds, keys, decodeVec, evaluator, objective);
            evaluations.push(evaluation);
            if (evaluation.score > bestScore) {
                bestScore = evaluation.score;
                bestParams = evaluation.params;
                bestEvaluation = evaluation.record;
            }
            results.push({ theta: population[i], evaluation });
        }

        results.sort((a, b) => b.evaluation.score - a.evaluation.score);
        const elites = results.slice(0, eliteCount);

        mean = new Array(mean.length).fill(0);
        sigma = new Array(sigma.length).fill(0);

        elites.forEach(({ theta }) => {
            theta.forEach((value, index) => {
                mean[index] += value;
            });
        });
        mean = mean.map(value => value / elites.length);

        elites.forEach(({ theta }) => {
            theta.forEach((value, index) => {
                const diff = value - mean[index];
                sigma[index] += diff * diff;
            });
        });
        sigma = sigma.map(value => clampSigma(Math.sqrt(value / elites.length) * 0.9));

        onProgress({ iter: iter + 1, bestScore });
    }

    return { bestParams, bestScore, bestEvaluation };
}
