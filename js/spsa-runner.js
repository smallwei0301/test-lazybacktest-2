// --- Stage4 SPSA Runner - LB-STAGE4-REFINE-20250930A ---

const EPSILON = 1e-9;

function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function normaliseVector(vec, ranges) {
    return vec.map((value, index) => {
        const range = ranges[index];
        const min = Number.isFinite(range.min) ? range.min : 0;
        const max = Number.isFinite(range.max) ? range.max : min + 1;
        const width = max - min;
        if (width <= EPSILON) return 0;
        return clamp((value - min) / width, 0, 1);
    });
}

function denormaliseVector(vec, ranges) {
    return vec.map((value, index) => {
        const range = ranges[index];
        const min = Number.isFinite(range.min) ? range.min : 0;
        const max = Number.isFinite(range.max) ? range.max : min + 1;
        const width = max - min;
        if (width <= EPSILON) return clamp(min, min, max);
        return clamp(min + value * width, min, max);
    });
}

function randomSign() {
    return Math.random() < 0.5 ? -1 : 1;
}

function clampUnitVector(vec) {
    return vec.map((value) => clamp(value, 0, 1));
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

function safeObjective(objective, result) {
    try {
        const value = objective(result);
        return Number.isFinite(value) ? value : -Infinity;
    } catch (error) {
        return -Infinity;
    }
}

export async function runSPSA({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && Number.isFinite(r.score) ? r.score : -Infinity),
    steps = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress = () => {}
}) {
    if (!start) throw new Error('SPSA: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('SPSA: encodeVec/decodeVec not provided');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('SPSA: evaluator not provided');
    }

    const paramKeys = Object.keys(bounds || {}).filter((key) => typeof bounds[key] === 'object');
    if (paramKeys.length === 0) {
        throw new Error('SPSA: bounds is empty');
    }

    const ranges = toRanges(bounds, paramKeys);
    const startVec = encodeVec(start);
    const startUnit = normaliseVector(startVec, ranges);

    let theta = [...startUnit];

    const initialEval = await evaluator([start]);
    const initialScore = safeObjective(objective, Array.isArray(initialEval) ? initialEval[0] : initialEval);

    let bestParams = start;
    let bestEvaluation = Array.isArray(initialEval) ? initialEval[0] : initialEval;
    let bestScore = Number.isFinite(initialScore) ? initialScore : -Infinity;

    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
        const ak = a0 / Math.pow(stepIndex + 1, alpha);
        const ck = c0 / Math.pow(stepIndex + 1, gamma);
        const delta = new Array(paramKeys.length).fill(0).map(() => randomSign());

        const thetaPlus = clampUnitVector(theta.map((value, idx) => value + ck * delta[idx]));
        const thetaMinus = clampUnitVector(theta.map((value, idx) => value - ck * delta[idx]));

        const plusParams = decodeVec(denormaliseVector(thetaPlus, ranges));
        const minusParams = decodeVec(denormaliseVector(thetaMinus, ranges));

        const [plusEval] = await evaluator([plusParams]) || [];
        const [minusEval] = await evaluator([minusParams]) || [];

        const yPlus = safeObjective(objective, plusEval);
        const yMinus = safeObjective(objective, minusEval);

        if (yPlus > bestScore && plusEval) {
            bestScore = yPlus;
            bestParams = plusParams;
            bestEvaluation = plusEval;
        }
        if (yMinus > bestScore && minusEval) {
            bestScore = yMinus;
            bestParams = minusParams;
            bestEvaluation = minusEval;
        }

        const gradient = delta.map((sign) => {
            if (!Number.isFinite(sign) || sign === 0) return 0;
            const numerator = yPlus - yMinus;
            const denominator = 2 * ck * sign;
            if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) <= EPSILON) {
                return 0;
            }
            return numerator / denominator;
        });

        theta = clampUnitVector(theta.map((value, idx) => value + ak * gradient[idx]));

        try {
            onProgress({ step: stepIndex + 1, bestScore });
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
