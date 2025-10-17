// --- Stage4 CEM Runner - v1.0 ---
// Patch Tag: LB-STAGE4-REFINE-20250930A

const EPS = 1e-12;
const TWO_PI = Math.PI * 2;

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
    const lower = Number.isFinite(min) ? min : value;
    const upper = Number.isFinite(max) ? max : value;
    if (!Number.isFinite(value)) return lower;
    return Math.max(lower, Math.min(upper, value));
}

function resolveKeys(bounds) {
    return Object.keys(bounds || {}).filter((key) => key !== 'constraintFix');
}

function isEnumBound(bound) {
    return Array.isArray(bound?.enum) && bound.enum.length > 0;
}

function snapToStep(value, bound) {
    if (!bound) return value;
    const step = Number(bound.step);
    if (step && Number.isFinite(step) && step > 0) {
        const min = Number(bound.min) || 0;
        const snapped = min + Math.round((value - min) / step) * step;
        if (bound.type === 'int' || Number.isInteger(step)) {
            return Math.round(snapped);
        }
        return snapped;
    }
    if (bound.type === 'int') {
        return Math.round(value);
    }
    return value;
}

function normaliseValue(value, bound) {
    if (!bound) return clamp01(value);
    if (isEnumBound(bound)) {
        const idx = bound.enum.findIndex((entry) => entry === value);
        if (idx <= 0) return 0;
        if (bound.enum.length === 1) return 0;
        return clamp01(idx / (bound.enum.length - 1));
    }
    const min = Number(bound.min) || 0;
    const max = Number(bound.max);
    if (!Number.isFinite(max) || Math.abs(max - min) < EPS) {
        return 0;
    }
    return clamp01((value - min) / (max - min));
}

function denormaliseValue(norm, bound) {
    if (!bound) return norm;
    if (isEnumBound(bound)) {
        const scaled = clamp01(norm) * Math.max(0, bound.enum.length - 1);
        const idx = Math.round(scaled);
        return bound.enum[idx] ?? bound.enum[bound.enum.length - 1];
    }
    const min = Number(bound.min) || 0;
    const max = Number(bound.max);
    if (!Number.isFinite(max)) {
        return snapToStep(norm, bound);
    }
    const raw = min + clamp01(norm) * (max - min);
    const clamped = clamp(raw, min, max);
    return clamp(snapToStep(clamped, bound), min, max);
}

function normaliseVector(vec, bounds, keys) {
    return keys.map((key, index) => {
        const bound = bounds[key];
        const value = vec?.[index];
        return normaliseValue(value, bound);
    });
}

function denormaliseVector(normVec, bounds, keys) {
    return keys.map((key, index) => {
        const bound = bounds[key];
        const value = normVec?.[index];
        return denormaliseValue(value, bound);
    });
}

function cloneParams(params) {
    if (!params || typeof params !== 'object') return params;
    if (Array.isArray(params)) {
        return params.map((item) => cloneParams(item));
    }
    const cloned = {};
    for (const [key, value] of Object.entries(params)) {
        cloned[key] = cloneParams(value);
    }
    return cloned;
}

function resolveEvaluator(evaluator) {
    if (typeof evaluator === 'function') return evaluator;
    if (evaluator && typeof evaluator.evaluate === 'function') {
        return evaluator.evaluate.bind(evaluator);
    }
    throw new Error('runCEM: evaluator missing evaluate(pop) implementation');
}

function applyConstraint(bounds, decoded) {
    if (typeof bounds?.constraintFix === 'function') {
        const fixed = bounds.constraintFix(cloneParams(decoded));
        if (fixed) return fixed;
    }
    return decoded;
}

function boxMullerRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

async function evaluateCandidate({
    normVec,
    bounds,
    keys,
    decodeVec,
    evaluator,
    objective
}) {
    const rawVec = denormaliseVector(normVec, bounds, keys);
    let decoded = decodeVec(rawVec);
    decoded = applyConstraint(bounds, decoded);
    const evalFn = resolveEvaluator(evaluator);
    const results = await evalFn([decoded]);
    const record = Array.isArray(results) ? results[0] : results;
    if (!record) {
        return { record: null, score: Number.NEGATIVE_INFINITY };
    }
    const score = typeof objective === 'function'
        ? objective(record)
        : (record.score ?? Number.NEGATIVE_INFINITY);
    return { record: { ...record, params: decoded }, score };
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
    if (!start) throw new Error('runCEM: start params missing');
    const keys = resolveKeys(bounds);
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('runCEM: encodeVec/decodeVec must be provided');
    }
    const startVec = encodeVec(start);
    let mu = normaliseVector(startVec, bounds, keys);
    let sigma = mu.map(() => initSigma);
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestRecord = null;

    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));

    for (let iter = 0; iter < iters; iter++) {
        const population = [];
        for (let i = 0; i < popSize; i++) {
            const sample = mu.map((mean, index) => {
                const candidate = mean + sigma[index] * boxMullerRandom();
                return clamp01(candidate);
            });
            population.push(sample);
        }

        const evaluations = [];
        for (const candidate of population) {
            const evaluation = await evaluateCandidate({
                normVec: candidate,
                bounds,
                keys,
                decodeVec,
                evaluator,
                objective
            });
            evaluations.push({ candidate, ...evaluation });
        }

        evaluations.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));

        const top = evaluations.slice(0, eliteCount);
        if (top.length > 0 && top[0].record && top[0].score > bestScore) {
            bestScore = top[0].score;
            bestRecord = top[0].record;
        }

        // 更新均值與方差
        mu = keys.map((_, index) => {
            const mean = top.reduce((acc, cur) => acc + (cur.candidate[index] ?? 0), 0) / top.length;
            return clamp01(mean);
        });

        sigma = keys.map((_, index) => {
            const mean = mu[index];
            const variance = top.reduce((acc, cur) => {
                const diff = (cur.candidate[index] ?? mean) - mean;
                return acc + diff * diff;
            }, 0) / Math.max(1, top.length - 1);
            const std = Math.sqrt(Math.max(variance, EPS));
            const shrunk = std * 0.95; // 略微衰減
            return Math.max(shrunk, 0.01);
        });

        try {
            onProgress({ iter: iter + 1, bestScore });
        } catch (error) {
            console.warn('[CEM] onProgress callback failed:', error);
        }
    }

    if (!bestRecord) {
        const fallback = await evaluateCandidate({
            normVec: mu,
            bounds,
            keys,
            decodeVec,
            evaluator,
            objective
        });
        bestRecord = fallback.record;
        bestScore = fallback.score;
    }

    const bestParams = bestRecord?.params ?? applyConstraint(bounds, decodeVec(denormaliseVector(mu, bounds, keys)));
    return {
        bestParams,
        bestScore,
        bestRecord
    };
}

export default runCEM;
