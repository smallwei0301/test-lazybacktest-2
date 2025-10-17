// --- Stage 4 Local Refinement: SPSA Runner ---
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

function generateDelta(dimension, random) {
    const delta = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
        delta[i] = random() > 0.5 ? 1 : -1;
    }
    return delta;
}

function applyUpdate(theta, gradient, stepSize) {
    return theta.map((value, index) => clamp01(value + stepSize * gradient[index]));
}

function computeGradient(yPlus, yMinus, delta, c) {
    const factor = (yPlus - yMinus) / (2 * c + EPSILON);
    return delta.map(component => factor * component);
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
        throw new Error('SPSA: encodeVec/decodeVec must be functions');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('SPSA: evaluator must be provided');
    }

    const boundEntries = Object.entries(bounds || {}).filter(([key]) => key !== 'constraintFix');
    if (boundEntries.length === 0) {
        throw new Error('SPSA: bounds required');
    }
    const keys = boundEntries.map(([key]) => key);
    const initialVec = encodeVec(start);
    const theta0 = normaliseVector(initialVec, bounds, keys);
    const dimension = theta0.length;

    let theta = [...theta0];
    let bestScore = -Infinity;
    let bestParams = start;
    let bestEvaluation = null;
    const random = Math.random;
    const stabilityOffset = steps / 10;

    for (let step = 0; step < steps; step++) {
        const a = a0 / Math.pow(step + 1 + stabilityOffset, alpha);
        const c = c0 / Math.pow(step + 1, gamma);
        const delta = generateDelta(dimension, random);

        const thetaPlus = theta.map((value, index) => clamp01(value + c * delta[index]));
        const thetaMinus = theta.map((value, index) => clamp01(value - c * delta[index]));

        const [plusEval, minusEval] = await Promise.all([
            evaluateCandidate(thetaPlus, bounds, keys, decodeVec, evaluator, objective),
            evaluateCandidate(thetaMinus, bounds, keys, decodeVec, evaluator, objective)
        ]);

        if (plusEval.score > bestScore) {
            bestScore = plusEval.score;
            bestParams = plusEval.params;
            bestEvaluation = plusEval.record;
        }
        if (minusEval.score > bestScore) {
            bestScore = minusEval.score;
            bestParams = minusEval.params;
            bestEvaluation = minusEval.record;
        }

        const gradient = computeGradient(plusEval.score, minusEval.score, delta, c);
        theta = applyUpdate(theta, gradient, a);

        onProgress({ step: step + 1, bestScore });
    }

    return { bestParams, bestScore, bestEvaluation };
}
