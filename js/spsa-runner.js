// --- Stage4 SPSA Runner ---
// Patch Tag: LB-STAGE4-SPSA-20260310A

const EPSILON = 1e-9;

function clamp(value, min = 0, max = 1) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            // ignore fallback
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return value;
    }
}

function normaliseNumber(value, min, max) {
    if (!Number.isFinite(value)) return 0.5;
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < EPSILON) {
        return clamp(value);
    }
    const normalised = (value - min) / (max - min);
    return clamp(normalised);
}

function denormaliseNumber(value, min, max, type, step) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return value;
    }
    const clamped = clamp(value);
    let actual = min + clamped * (max - min);
    if (Array.isArray(step) || Array.isArray(type)) return actual;
    if (type === 'int' || type === 'integer') {
        actual = Math.round(actual);
    } else if (Number.isFinite(step) && step > 0) {
        actual = Math.round(actual / step) * step;
    }
    if (type === 'enum' || type === 'discrete') {
        return Math.round(actual);
    }
    return actual;
}

function buildEnumNormaliser(enumValues) {
    if (!Array.isArray(enumValues) || enumValues.length === 0) {
        return {
            toNormalised: (value) => 0,
            fromNormalised: () => undefined,
        };
    }
    const lastIndex = enumValues.length - 1;
    return {
        toNormalised: (value) => {
            const index = enumValues.indexOf(value);
            if (index <= 0) return 0;
            return clamp(index / lastIndex);
        },
        fromNormalised: (weight) => {
            const index = Math.round(clamp(weight) * lastIndex);
            return enumValues[index] ?? enumValues[0];
        }
    };
}

function createVectorAdapter({ bounds, encodeVec, decodeVec, startParams }) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('Stage4 SPSA: encodeVec/decodeVec 缺失');
    }
    const constraintFix = typeof bounds?.constraintFix === 'function'
        ? bounds.constraintFix
        : null;
    const entries = Object.entries(bounds || {})
        .filter(([key]) => key !== 'constraintFix');
    if (entries.length === 0) {
        throw new Error('Stage4 SPSA: bounds 為空');
    }
    const orderedKeys = entries
        .map(([key]) => key)
        .sort((a, b) => a.localeCompare(b));
    const metaByKey = orderedKeys.map((key) => {
        const info = bounds[key] || {};
        const min = Number(info.min);
        const max = Number(info.max);
        const step = Number(info.step);
        const type = info.type || (Array.isArray(info.enum) ? 'enum' : 'float');
        const enumHelper = Array.isArray(info.enum) ? buildEnumNormaliser(info.enum) : null;
        return {
            key,
            min: Number.isFinite(min) ? min : 0,
            max: Number.isFinite(max) ? max : 1,
            type,
            step: Number.isFinite(step) && step > 0 ? step : null,
            enumValues: Array.isArray(info.enum) ? [...info.enum] : null,
            enumHelper,
        };
    });

    const startVector = encodeVec(startParams);
    if (!Array.isArray(startVector) || startVector.length !== metaByKey.length) {
        throw new Error('Stage4 SPSA: encodeVec 回傳維度與 bounds 不符');
    }

    const normaliseVector = (vector) => vector.map((value, index) => {
        const meta = metaByKey[index];
        if (meta.enumHelper) {
            return meta.enumHelper.toNormalised(value);
        }
        return normaliseNumber(value, meta.min, meta.max);
    });

    const denormaliseVector = (weights) => weights.map((weight, index) => {
        const meta = metaByKey[index];
        if (meta.enumHelper) {
            return meta.enumHelper.fromNormalised(weight);
        }
        return denormaliseNumber(weight, meta.min, meta.max, meta.type, meta.step);
    });

    const clampWeights = (weights) => weights.map((weight) => clamp(weight));

    const project = (weights) => {
        const clamped = clampWeights(weights);
        const candidateVector = denormaliseVector(clamped);
        let params = decodeVec(candidateVector);
        if (constraintFix) {
            const cloned = deepClone(params);
            const fixed = constraintFix(cloned) || cloned;
            params = fixed;
        }
        const reEncoded = encodeVec(params);
        const normalised = normaliseVector(reEncoded);
        return {
            normalised,
            params,
            vector: reEncoded,
        };
    };

    return {
        normaliseVector,
        denormaliseVector,
        project,
        constraintFix,
        startNormalised: normaliseVector(startVector),
        metaByKey,
    };
}

async function callEvaluator(evaluator, population) {
    if (!evaluator) {
        throw new Error('Stage4 SPSA: evaluator 未定義');
    }
    if (typeof evaluator === 'function') {
        return await evaluator(population);
    }
    if (typeof evaluator.evaluate === 'function') {
        return await evaluator.evaluate(population);
    }
    throw new Error('Stage4 SPSA: evaluator 格式不支援');
}

function resolveScore(result, objective) {
    if (!result) return -Infinity;
    try {
        const value = objective ? objective(result) : result?.score;
        return Number.isFinite(value) ? value : -Infinity;
    } catch (error) {
        return -Infinity;
    }
}

function extractMetrics(result) {
    if (!result || typeof result !== 'object') return null;
    if (result.metrics && typeof result.metrics === 'object') {
        return deepClone(result.metrics);
    }
    const cloned = deepClone(result);
    delete cloned.metrics;
    return cloned;
}

export async function runSPSA({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => r?.score,
    steps = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress = () => {}
}) {
    if (!start) throw new Error('Stage4 SPSA: 缺少起始參數');
    const adapter = createVectorAdapter({ bounds, encodeVec, decodeVec, startParams: start });
    const { startNormalised, project } = adapter;

    let theta = [...startNormalised];
    const projection = project(theta);
    theta = projection.normalised;
    let bestParams = projection.params;
    let bestScore = -Infinity;
    let bestMetrics = null;

    const initialResults = await callEvaluator(evaluator, [bestParams]);
    if (Array.isArray(initialResults) && initialResults.length > 0) {
        const initialScore = resolveScore(initialResults[0], objective);
        if (initialScore > bestScore) {
            bestScore = initialScore;
            bestMetrics = extractMetrics(initialResults[0]);
        }
    }

    for (let step = 0; step < steps; step++) {
        const iteration = step + 1;
        const a_t = a0 / Math.pow(iteration, alpha);
        const c_t = c0 / Math.pow(iteration, gamma);

        const delta = theta.map(() => Math.random() < 0.5 ? -1 : 1);
        const thetaPlus = theta.map((value, index) => clamp(value + c_t * delta[index]));
        const thetaMinus = theta.map((value, index) => clamp(value - c_t * delta[index]));

        const projectedPlus = project(thetaPlus);
        const projectedMinus = project(thetaMinus);

        const evaluations = await callEvaluator(evaluator, [projectedPlus.params, projectedMinus.params]);
        const plusResult = Array.isArray(evaluations) ? evaluations[0] : null;
        const minusResult = Array.isArray(evaluations) ? evaluations[1] : null;
        const scorePlus = resolveScore(plusResult, objective);
        const scoreMinus = resolveScore(minusResult, objective);

        if (scorePlus > bestScore && plusResult) {
            bestScore = scorePlus;
            bestParams = projectedPlus.params;
            bestMetrics = extractMetrics(plusResult);
        }
        if (scoreMinus > bestScore && minusResult) {
            bestScore = scoreMinus;
            bestParams = projectedMinus.params;
            bestMetrics = extractMetrics(minusResult);
        }

        const gradient = delta.map((direction, index) => {
            if (Math.abs(direction) < EPSILON) return 0;
            const numerator = scorePlus - scoreMinus;
            return (numerator / (2 * c_t * direction));
        });

        const updatedTheta = theta.map((value, index) => clamp(value + a_t * gradient[index]));
        const projected = project(updatedTheta);
        theta = projected.normalised;

        const currentEval = await callEvaluator(evaluator, [projected.params]);
        if (Array.isArray(currentEval) && currentEval.length > 0) {
            const currentScore = resolveScore(currentEval[0], objective);
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestParams = projected.params;
                bestMetrics = extractMetrics(currentEval[0]);
            }
        }

        try {
            onProgress({ step: iteration, bestScore });
        } catch (error) {
            console.warn('[Stage4 SPSA] onProgress 發送失敗:', error);
        }
    }

    if (!Number.isFinite(bestScore)) {
        throw new Error('Stage4 SPSA: 無法找到有效的最佳分數');
    }

    return { bestParams, bestScore, bestMetrics };
}

export default runSPSA;
