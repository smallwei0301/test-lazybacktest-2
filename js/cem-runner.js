// --- Stage4 CEM Runner ---
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

function randomNormal(random) {
    const u1 = Math.max(random(), EPSILON);
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function defaultRandom() {
    return Math.random();
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * Cross-Entropy Method for Stage4 fine-tuning
 */
export async function runCEM({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && typeof r.score === 'number' ? r.score : (r && typeof r.annualizedReturn === 'number' ? r.annualizedReturn : -Infinity)),
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress = () => {},
    random = defaultRandom
}) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('runCEM: encodeVec/decodeVec are required');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('runCEM: evaluator is required');
    }

    const keys = extractKeys(bounds);
    if (!keys.length) {
        throw new Error('runCEM: bounds is empty');
    }

    const startVec = ensureArray(encodeVec(start));
    if (startVec.length !== keys.length) {
        throw new Error('runCEM: encodeVec dimension mismatch with bounds');
    }

    let mu = vectorToUnit(startVec, keys, bounds);
    let sigma = new Array(keys.length).fill(Math.max(initSigma, 0.01));
    let bestParams = cloneDeep(start);
    let bestScore = -Infinity;
    let bestResult = null;

    // Evaluate initial point
    try {
        const [initialResult] = await evaluator([applyConstraint(cloneDeep(start), bounds)]);
        const initialScore = objective(initialResult);
        if (Number.isFinite(initialScore) && initialScore > bestScore) {
            bestScore = initialScore;
            bestParams = cloneDeep(initialResult?.params || start);
            bestResult = initialResult || null;
        }
    } catch (error) {
        console.warn('[Stage4][CEM] Failed to evaluate initial point:', error);
    }

    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));
    const sigmaFloor = 0.01;

    for (let iter = 0; iter < iters; iter++) {
        const candidates = [];
        for (let i = 0; i < popSize; i++) {
            const sample = mu.map((value, index) => {
                const draw = value + sigma[index] * randomNormal(random);
                return clamp(draw, 0, 1);
            });
            const rawVector = unitToVector(sample, keys, bounds);
            const candidateParams = applyConstraint(cloneDeep(decodeVec(rawVector)), bounds);
            candidates.push({
                unit: sample,
                raw: rawVector,
                params: candidateParams,
                score: -Infinity,
                result: null
            });
        }

        let evalResults = [];
        try {
            evalResults = await evaluator(candidates.map((c) => c.params));
        } catch (error) {
            console.warn('[Stage4][CEM] Evaluator error:', error);
            evalResults = new Array(candidates.length).fill(null);
        }

        candidates.forEach((candidate, index) => {
            const result = evalResults[index] || null;
            const score = objective(result);
            candidate.score = Number.isFinite(score) ? score : -Infinity;
            candidate.result = result;

            if (Number.isFinite(candidate.score) && candidate.score > bestScore) {
                bestScore = candidate.score;
                bestParams = cloneDeep(result?.params || candidate.params);
                bestResult = result;
            }
        });

        const validCandidates = candidates.filter((c) => Number.isFinite(c.score));
        if (validCandidates.length === 0) {
            onProgress({ iter: iter + 1, bestScore });
            continue;
        }

        validCandidates.sort((a, b) => b.score - a.score);
        const elites = validCandidates.slice(0, eliteCount);

        mu = mu.map((_, index) => {
            const sum = elites.reduce((acc, elite) => acc + elite.unit[index], 0);
            return clamp(sum / elites.length, 0, 1);
        });

        sigma = sigma.map((currentSigma, index) => {
            const mean = mu[index];
            const variance = elites.reduce((acc, elite) => {
                const diff = elite.unit[index] - mean;
                return acc + diff * diff;
            }, 0) / elites.length;
            const std = Math.sqrt(Math.max(variance, 0));
            const blended = 0.9 * currentSigma + 0.1 * Math.max(std, sigmaFloor);
            return clamp(blended, sigmaFloor, 0.5);
        });

        onProgress({ iter: iter + 1, bestScore });
    }

    return {
        bestParams: cloneDeep(bestParams),
        bestScore,
        bestResult
    };
}

export default runCEM;
