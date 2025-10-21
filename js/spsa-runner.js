// Stage4 Local Refinement - SPSA Runner
// Version Tag: LB-STAGE4-20250930A

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn('[Stage4][SPSA] structuredClone failed, fallback to JSON clone.', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Stage4][SPSA] JSON clone failed, returning shallow copy.', error);
        if (Array.isArray(value)) return [...value];
        return value && typeof value === 'object' ? { ...value } : value;
    }
}

function createNormalizer(bounds, order) {
    const mins = order.map((key) => bounds[key]?.min ?? 0);
    const maxs = order.map((key) => bounds[key]?.max ?? 1);
    const spans = maxs.map((max, idx) => Math.max(1e-9, max - mins[idx]));
    return {
        normalize(rawVector) {
            return rawVector.map((value, idx) => (value - mins[idx]) / spans[idx]);
        },
        denormalize(unitVector) {
            return unitVector.map((value, idx) => mins[idx] + value * spans[idx]);
        },
        clampUnit(unitVector) {
            return unitVector.map((value) => {
                if (!Number.isFinite(value)) return 0.5;
                if (value < 0) return 0;
                if (value > 1) return 1;
                return value;
            });
        }
    };
}

function projectToBounds(vector, bounds, order) {
    return vector.map((value, idx) => {
        const meta = bounds[order[idx]];
        if (!meta) return value;
        const min = meta.min ?? Number.NEGATIVE_INFINITY;
        const max = meta.max ?? Number.POSITIVE_INFINITY;
        let projected = Math.min(max, Math.max(min, value));
        if (meta.type === 'int' || meta.type === 'integer') {
            const step = Number.isFinite(meta.step) && meta.step > 0 ? meta.step : 1;
            projected = Math.round(projected / step) * step;
            projected = Math.min(max, Math.max(min, projected));
        }
        return projected;
    });
}

function computeDelta(dimension) {
    const delta = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
        delta[i] = Math.random() < 0.5 ? -1 : 1;
    }
    return delta;
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
    if (!start) throw new Error('SPSA: start params missing');
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('SPSA: encodeVec/decodeVec are required');
    }
    if (typeof evaluator !== 'function') throw new Error('SPSA: evaluator is required');

    const order = Object.keys(bounds).filter((key) => key !== 'constraintFix');
    if (order.length === 0) throw new Error('SPSA: No tunable parameters');

    const normalizer = createNormalizer(bounds, order);
    const startVector = encodeVec(start);
    const theta0 = normalizer.normalize(startVector);
    let theta = [...theta0];

    let bestEvaluation = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
        const k = stepIndex + 1;
        const ak = a0 / Math.pow(k, alpha);
        const ck = c0 / Math.pow(k, gamma);

        const delta = computeDelta(order.length);
        const thetaPlus = normalizer.clampUnit(theta.map((value, idx) => value + ck * delta[idx]));
        const thetaMinus = normalizer.clampUnit(theta.map((value, idx) => value - ck * delta[idx]));

        const rawPlus = projectToBounds(normalizer.denormalize(thetaPlus), bounds, order);
        const rawMinus = projectToBounds(normalizer.denormalize(thetaMinus), bounds, order);

        let paramsPlus = decodeVec(rawPlus);
        let paramsMinus = decodeVec(rawMinus);

        if (typeof bounds.constraintFix === 'function') {
            paramsPlus = bounds.constraintFix(deepClone(paramsPlus));
            paramsMinus = bounds.constraintFix(deepClone(paramsMinus));
        }

        const [evalPlus] = await evaluator([paramsPlus]);
        const [evalMinus] = await evaluator([paramsMinus]);

        const scorePlus = evalPlus ? objective(evalPlus) : Number.NEGATIVE_INFINITY;
        const scoreMinus = evalMinus ? objective(evalMinus) : Number.NEGATIVE_INFINITY;

        if (evalPlus && Number.isFinite(scorePlus) && scorePlus > bestScore) {
            bestScore = scorePlus;
            bestEvaluation = evalPlus;
        }
        if (evalMinus && Number.isFinite(scoreMinus) && scoreMinus > bestScore) {
            bestScore = scoreMinus;
            bestEvaluation = evalMinus;
        }

        const gradient = delta.map((value, idx) => {
            const denominator = 2 * ck * value;
            if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return 0;
            const diff = (Number.isFinite(scorePlus) ? scorePlus : 0) - (Number.isFinite(scoreMinus) ? scoreMinus : 0);
            return diff / denominator;
        });

        theta = normalizer.clampUnit(theta.map((value, idx) => value - ak * gradient[idx]));

        onProgress({ step: k, bestScore });
    }

    if (!bestEvaluation) {
        // fallback evaluate final theta
        const rawFinal = projectToBounds(normalizer.denormalize(theta), bounds, order);
        let paramsFinal = decodeVec(rawFinal);
        if (typeof bounds.constraintFix === 'function') {
            paramsFinal = bounds.constraintFix(deepClone(paramsFinal));
        }
        const [finalEvaluation] = await evaluator([paramsFinal]);
        if (finalEvaluation) {
            bestEvaluation = finalEvaluation;
            bestScore = objective(finalEvaluation);
        }
    }

    if (!bestEvaluation) {
        throw new Error('SPSA: Unable to obtain a valid evaluation result');
    }

    return {
        bestParams: deepClone(bestEvaluation.params || start),
        bestScore: bestScore,
        bestEvaluation
    };
}

export default runSPSA;
