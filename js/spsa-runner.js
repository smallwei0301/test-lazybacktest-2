// --- Stage4 SPSA Runner ---
// Patch Tag: LB-STAGE4-REFINE-20251205A

const EPSILON = 1e-9;

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (Number.isFinite(min) && value < min) return min;
    if (Number.isFinite(max) && value > max) return max;
    return value;
}

function cloneDeep(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneDeep);
    const copy = {};
    for (const key of Object.keys(value)) {
        copy[key] = cloneDeep(value[key]);
    }
    return copy;
}

function extractKeys(bounds) {
    return Object.keys(bounds || {}).filter((key) => key !== 'constraintFix');
}

function normalizeValue(raw, bound) {
    if (!bound) return raw;
    const min = Number.isFinite(bound.min) ? bound.min : 0;
    const max = Number.isFinite(bound.max) ? bound.max : 1;
    if (Array.isArray(bound.enum) && bound.enum.length > 0) {
        const idx = bound.enum.findIndex((item) => item === raw);
        if (idx <= 0) return 0;
        if (idx >= bound.enum.length - 1) return 1;
        return idx / (bound.enum.length - 1);
    }
    const span = max - min;
    if (Math.abs(span) < EPSILON) return 0;
    const clamped = clamp(raw, min, max);
    return (clamped - min) / span;
}

function denormalizeValue(norm, bound) {
    if (!bound) return norm;
    const min = Number.isFinite(bound.min) ? bound.min : 0;
    const max = Number.isFinite(bound.max) ? bound.max : 1;
    const value = clamp(norm, 0, 1);
    if (Array.isArray(bound.enum) && bound.enum.length > 0) {
        if (bound.enum.length === 1) return bound.enum[0];
        const idx = Math.round(value * (bound.enum.length - 1));
        return bound.enum[clamp(idx, 0, bound.enum.length - 1)];
    }
    const span = max - min;
    const raw = span < EPSILON ? min : (min + value * span);
    const step = Number.isFinite(bound.step) && bound.step > 0 ? bound.step : null;
    let adjusted = raw;
    if (bound.type === 'int') {
        const rounded = Math.round(raw);
        adjusted = Number.isFinite(rounded) ? rounded : raw;
    }
    if (step) {
        const steps = Math.round((adjusted - min) / step);
        adjusted = min + steps * step;
    }
    return clamp(adjusted, min, max);
}

function vectorToUnit(rawVec, keys, bounds) {
    return rawVec.map((value, index) => normalizeValue(value, bounds[keys[index]]));
}

function unitToVector(unitVec, keys, bounds) {
    return unitVec.map((value, index) => denormalizeValue(value, bounds[keys[index]]));
}

function clampUnitVector(vec) {
    return vec.map((value) => clamp(value, 0, 1));
}

function applyConstraint(params, bounds) {
    if (bounds && typeof bounds.constraintFix === 'function') {
        const fixed = bounds.constraintFix(params);
        return fixed || params;
    }
    return params;
}

function rademacherVector(size, random) {
    const output = new Array(size);
    for (let i = 0; i < size; i++) {
        const value = (random() < 0.5 ? -1 : 1);
        output[i] = value;
    }
    return output;
}

function defaultRandom() {
    return Math.random();
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * SPSA 局部微調（每步評估兩個鄰域點）
 */
export async function runSPSA({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && typeof r.score === 'number' ? r.score : (r && typeof r.annualizedReturn === 'number' ? r.annualizedReturn : -Infinity)),
    steps = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress = () => {},
    random = defaultRandom
}) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('runSPSA: encodeVec/decodeVec are required');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('runSPSA: evaluator is required');
    }

    const keys = extractKeys(bounds);
    if (!keys.length) {
        throw new Error('runSPSA: bounds is empty');
    }

    const startVec = ensureArray(encodeVec(start));
    if (startVec.length !== keys.length) {
        throw new Error('runSPSA: encodeVec dimension mismatch with bounds');
    }

    let theta = vectorToUnit(startVec, keys, bounds);
    let bestParams = cloneDeep(start);
    let bestScore = -Infinity;
    let bestResult = null;

    // 評估起點
    try {
        const [initialResult] = await evaluator([applyConstraint(cloneDeep(start), bounds)]);
        const initialScore = objective(initialResult);
        if (Number.isFinite(initialScore) && initialScore > bestScore) {
            bestScore = initialScore;
            bestParams = cloneDeep(initialResult?.params || start);
            bestResult = initialResult || null;
        }
    } catch (error) {
        console.warn('[Stage4][SPSA] Failed to evaluate initial point:', error);
    }

    for (let k = 0; k < steps; k++) {
        const ak = a0 / Math.pow(k + 1, alpha);
        const ck = c0 / Math.pow(k + 1, gamma);
        const delta = rademacherVector(keys.length, random);

        const thetaPlus = clampUnitVector(theta.map((value, index) => value + ck * delta[index]));
        const thetaMinus = clampUnitVector(theta.map((value, index) => value - ck * delta[index]));

        const rawPlus = unitToVector(thetaPlus, keys, bounds);
        const rawMinus = unitToVector(thetaMinus, keys, bounds);

        const paramsPlus = applyConstraint(cloneDeep(decodeVec(rawPlus)), bounds);
        const paramsMinus = applyConstraint(cloneDeep(decodeVec(rawMinus)), bounds);

        let resultPlus = null;
        let resultMinus = null;

        try {
            const evalResults = await evaluator([paramsPlus, paramsMinus]);
            resultPlus = evalResults[0] || null;
            resultMinus = evalResults[1] || null;
        } catch (error) {
            console.warn('[Stage4][SPSA] Evaluator error:', error);
        }

        const scorePlus = objective(resultPlus);
        const scoreMinus = objective(resultMinus);

        if (Number.isFinite(scorePlus) && scorePlus > bestScore) {
            bestScore = scorePlus;
            bestParams = cloneDeep(resultPlus?.params || paramsPlus);
            bestResult = resultPlus;
        }
        if (Number.isFinite(scoreMinus) && scoreMinus > bestScore) {
            bestScore = scoreMinus;
            bestParams = cloneDeep(resultMinus?.params || paramsMinus);
            bestResult = resultMinus;
        }

        if (!Number.isFinite(scorePlus) || !Number.isFinite(scoreMinus)) {
            onProgress({ step: k + 1, bestScore });
            continue;
        }

        const gradient = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const denom = 2 * ck * delta[i];
            if (Math.abs(denom) < EPSILON) {
                gradient[i] = 0;
            } else {
                gradient[i] = (scorePlus - scoreMinus) / denom;
            }
        }

        theta = clampUnitVector(theta.map((value, index) => value - ak * gradient[index]));

        onProgress({ step: k + 1, bestScore });
    }

    return {
        bestParams: cloneDeep(bestParams),
        bestScore,
        bestResult
    };
}

export default runSPSA;
