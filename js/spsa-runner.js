// Stage4 Local Refinement Runner - SPSA Implementation
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
        // 將 [0,1] 映射到 enum 索引
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
        const min = Number.isFinite(spec.min) ? spec.min : 0;
        const max = Number.isFinite(spec.max) ? spec.max : 1;
        if (spec.enum && Array.isArray(spec.enum) && spec.enum.length > 1) {
            const values = spec.enum;
            const idx = Math.max(0, values.findIndex((val) => val === value));
            return values.length <= 1 ? 0 : clamp01(idx / (values.length - 1));
        }
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
        let actual = value;
        if (spec.enum && Array.isArray(spec.enum) && spec.enum.length > 0) {
            const idx = Math.round(clamp01(value) * (spec.enum.length - 1));
            return spec.enum[Math.min(spec.enum.length - 1, Math.max(0, idx))];
        }
        actual = min + clamp01(value) * (max - min);
        actual = Math.min(max, Math.max(min, actual));
        return roundByType(actual, spec);
    });
}

async function evaluateCandidate(evaluator, candidate) {
    const results = await evaluator([candidate]);
    if (Array.isArray(results) && results.length > 0) {
        return results[0];
    }
    return null;
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
} = {}) {
    if (!start) throw new Error('SPSA: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('SPSA: encode/decode functions are required');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('SPSA: evaluator is required');
    }

    const boundKeys = Object.keys(bounds || {}).filter((key) => key !== 'constraintFix');
    if (boundKeys.length === 0) {
        throw new Error('SPSA: bounds is empty');
    }
    const specs = boundKeys.map((key) => ({ key, ...bounds[key] }));
    const constraintFix = typeof bounds?.constraintFix === 'function' ? bounds.constraintFix : null;

    const initialVector = encodeVec(start);
    const theta = normaliseVector(initialVector, specs);

    let bestParams = start;
    let bestScore = -Infinity;
    let bestMetrics = null;

    for (let k = 0; k < steps; k++) {
        const stepIndex = k + 1;
        const ak = a0 / Math.pow(stepIndex, alpha);
        const ck = c0 / Math.pow(stepIndex, gamma);
        const delta = specs.map(() => (Math.random() < 0.5 ? -1 : 1));

        const thetaPlus = theta.map((value, index) => clamp01(value + ck * delta[index]));
        const thetaMinus = theta.map((value, index) => clamp01(value - ck * delta[index]));

        const candidatePlusVector = denormaliseVector(thetaPlus, specs);
        const candidateMinusVector = denormaliseVector(thetaMinus, specs);

        let candidatePlus = decodeVec(candidatePlusVector);
        let candidateMinus = decodeVec(candidateMinusVector);

        if (constraintFix) {
            candidatePlus = constraintFix(candidatePlus) || candidatePlus;
            candidateMinus = constraintFix(candidateMinus) || candidateMinus;
        }

        const plusMetrics = await evaluateCandidate(evaluator, candidatePlus);
        const minusMetrics = await evaluateCandidate(evaluator, candidateMinus);

        const yPlus = objective(plusMetrics ?? { score: -Infinity });
        const yMinus = objective(minusMetrics ?? { score: -Infinity });

        if (plusMetrics && yPlus > bestScore) {
            bestScore = yPlus;
            bestParams = candidatePlus;
            bestMetrics = plusMetrics;
        }
        if (minusMetrics && yMinus > bestScore) {
            bestScore = yMinus;
            bestParams = candidateMinus;
            bestMetrics = minusMetrics;
        }

        const gradient = specs.map((_, index) => {
            const denom = 2 * ck * delta[index];
            if (denom === 0) return 0;
            return (yPlus - yMinus) / denom;
        });

        for (let index = 0; index < theta.length; index++) {
            theta[index] = clamp01(theta[index] - ak * gradient[index]);
        }

        try {
            onProgress({ step: stepIndex, bestScore });
        } catch (error) {
            console.warn('[SPSA] onProgress callback failed:', error);
        }
    }

    return { bestParams, bestScore, bestMetrics };
}
