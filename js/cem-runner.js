// Stage4 Local Refinement - CEM Runner
// Version Tag: LB-STAGE4-20250930A

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn('[Stage4][CEM] structuredClone failed, fallback to JSON clone.', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Stage4][CEM] JSON clone failed, returning shallow copy.', error);
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

function gaussianRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
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
        throw new Error('CEM: encodeVec/decodeVec are required');
    }
    if (typeof evaluator !== 'function') throw new Error('CEM: evaluator is required');

    const order = Object.keys(bounds).filter((key) => key !== 'constraintFix');
    if (order.length === 0) throw new Error('CEM: No tunable parameters');

    const normalizer = createNormalizer(bounds, order);
    const startVector = encodeVec(start);
    let mean = normalizer.normalize(startVector);
    let sigma = new Array(order.length).fill(initSigma);

    let bestEvaluation = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));

    for (let iter = 0; iter < iters; iter++) {
        const candidates = [];

        for (let i = 0; i < popSize; i++) {
            const sample = mean.map((value, idx) => value + sigma[idx] * gaussianRandom());
            const unit = normalizer.clampUnit(sample);
            const rawVector = projectToBounds(normalizer.denormalize(unit), bounds, order);
            let params = decodeVec(rawVector);
            if (typeof bounds.constraintFix === 'function') {
                params = bounds.constraintFix(deepClone(params));
            }
            candidates.push({ params, unit });
        }

        const evaluations = await evaluator(candidates.map((item) => item.params));
        const combined = evaluations.map((evaluation, idx) => {
            const score = evaluation ? objective(evaluation) : Number.NEGATIVE_INFINITY;
            if (evaluation) evaluation.unit = candidates[idx].unit;
            return {
                evaluation,
                score,
                unit: candidates[idx].unit
            };
        }).filter((entry) => entry.evaluation);

        combined.sort((a, b) => (Number.isFinite(b.score) ? b.score : -Infinity) - (Number.isFinite(a.score) ? a.score : -Infinity));

        if (combined.length === 0) {
            continue;
        }

        if (Number.isFinite(combined[0].score) && combined[0].score > bestScore) {
            bestScore = combined[0].score;
            bestEvaluation = combined[0].evaluation;
        }

        const elites = combined.slice(0, eliteCount);

        const newMean = new Array(order.length).fill(0);
        const newSigma = new Array(order.length).fill(0);

        elites.forEach((elite) => {
            elite.unit.forEach((value, idx) => {
                newMean[idx] += value;
            });
        });

        for (let idx = 0; idx < order.length; idx++) {
            newMean[idx] /= elites.length;
        }

        elites.forEach((elite) => {
            elite.unit.forEach((value, idx) => {
                const diff = value - newMean[idx];
                newSigma[idx] += diff * diff;
            });
        });

        for (let idx = 0; idx < order.length; idx++) {
            const variance = elites.length > 0 ? newSigma[idx] / elites.length : initSigma * initSigma;
            const std = Math.sqrt(Math.max(1e-6, variance));
            sigma[idx] = 0.9 * std + 0.1 * sigma[idx];
            sigma[idx] = Math.max(0.02, Math.min(0.5, sigma[idx]));
        }

        mean = newMean.map((value) => {
            if (!Number.isFinite(value)) return 0.5;
            if (value < 0) return 0;
            if (value > 1) return 1;
            return value;
        });

        onProgress({ iter: iter + 1, bestScore });
    }

    if (!bestEvaluation) {
        const rawVector = projectToBounds(normalizer.denormalize(mean), bounds, order);
        let params = decodeVec(rawVector);
        if (typeof bounds.constraintFix === 'function') {
            params = bounds.constraintFix(deepClone(params));
        }
        const [finalEvaluation] = await evaluator([params]);
        if (finalEvaluation) {
            bestEvaluation = finalEvaluation;
            bestScore = objective(finalEvaluation);
        }
    }

    if (!bestEvaluation) {
        throw new Error('CEM: Unable to obtain a valid evaluation result');
    }

    return {
        bestParams: deepClone(bestEvaluation.params || start),
        bestScore,
        bestEvaluation
    };
}

export default runCEM;
