// --- Stage4 SPSA Runner - v1.0 ---
// Patch Tag: LB-STAGE4-REFINE-20250930A

const EPS = 1e-12;

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
    throw new Error('runSPSA: evaluator missing evaluate(pop) implementation');
}

function applyConstraint(bounds, decoded) {
    if (typeof bounds?.constraintFix === 'function') {
        const fixed = bounds.constraintFix(cloneParams(decoded));
        if (fixed) return fixed;
    }
    return decoded;
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

function randomSign() {
    return Math.random() < 0.5 ? -1 : 1;
}

export async function runSPSA({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => r.score,
    steps = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress = () => {}
}) {
    if (!start) throw new Error('runSPSA: start params missing');
    const keys = resolveKeys(bounds);
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('runSPSA: encodeVec/decodeVec must be provided');
    }
    const startVec = encodeVec(start);
    const normStart = normaliseVector(startVec, bounds, keys);
    let theta = normStart.slice();
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestRecord = null;

    for (let k = 0; k < steps; k++) {
        const ak = a0 / Math.pow(k + 1, alpha);
        const ck = c0 / Math.pow(k + 1, gamma);
        const delta = keys.map(() => randomSign());

        const thetaPlus = theta.map((value, index) => clamp01(value + ck * delta[index]));
        const thetaMinus = theta.map((value, index) => clamp01(value - ck * delta[index]));

        const [{ record: plusRecord, score: yPlus }, { record: minusRecord, score: yMinus }] = await Promise.all([
            evaluateCandidate({ normVec: thetaPlus, bounds, keys, decodeVec, evaluator, objective }),
            evaluateCandidate({ normVec: thetaMinus, bounds, keys, decodeVec, evaluator, objective })
        ]);

        if (plusRecord && yPlus > bestScore) {
            bestScore = yPlus;
            bestRecord = plusRecord;
        }
        if (minusRecord && yMinus > bestScore) {
            bestScore = yMinus;
            bestRecord = minusRecord;
        }

        if (Number.isFinite(yPlus) && Number.isFinite(yMinus)) {
            const diff = (yPlus - yMinus) / (2 * ck);
            theta = theta.map((value, index) => {
                const grad = diff * delta[index];
                return clamp01(value + ak * grad);
            });
        }

        try {
            onProgress({ step: k + 1, bestScore });
        } catch (error) {
            console.warn('[SPSA] onProgress callback failed:', error);
        }
    }

    if (!bestRecord) {
        const fallback = await evaluateCandidate({
            normVec: theta,
            bounds,
            keys,
            decodeVec,
            evaluator,
            objective
        });
        bestRecord = fallback.record;
        bestScore = fallback.score;
    }

    const bestParams = bestRecord?.params ?? applyConstraint(bounds, decodeVec(denormaliseVector(theta, bounds, keys)));
    return {
        bestParams,
        bestScore,
        bestRecord
    };
}

export default runSPSA;
