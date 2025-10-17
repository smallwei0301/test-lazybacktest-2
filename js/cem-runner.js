// --- Stage4 CEM Runner ---
// Patch Tag: LB-STAGE4-CEM-20260310A

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

function boxMuller() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function createVectorAdapter({ bounds, encodeVec, decodeVec, startParams }) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('Stage4 CEM: encodeVec/decodeVec 缺失');
    }
    const constraintFix = typeof bounds?.constraintFix === 'function'
        ? bounds.constraintFix
        : null;
    const entries = Object.entries(bounds || {})
        .filter(([key]) => key !== 'constraintFix');
    if (entries.length === 0) {
        throw new Error('Stage4 CEM: bounds 為空');
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
        throw new Error('Stage4 CEM: encodeVec 回傳維度與 bounds 不符');
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

    const project = (weights) => {
        const clamped = weights.map((weight) => clamp(weight));
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
            params,
            normalised,
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
        throw new Error('Stage4 CEM: evaluator 未定義');
    }
    if (typeof evaluator === 'function') {
        return await evaluator(population);
    }
    if (typeof evaluator.evaluate === 'function') {
        return await evaluator.evaluate(population);
    }
    throw new Error('Stage4 CEM: evaluator 格式不支援');
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

function computeMean(vectors) {
    if (vectors.length === 0) return [];
    const length = vectors[0].length;
    const mean = new Array(length).fill(0);
    vectors.forEach((vec) => {
        for (let i = 0; i < length; i++) {
            mean[i] += vec[i];
        }
    });
    return mean.map((value) => value / vectors.length);
}

function computeStd(elites, mean) {
    if (elites.length === 0) return mean.map(() => 0.05);
    const length = mean.length;
    const variance = new Array(length).fill(0);
    elites.forEach((elite) => {
        for (let i = 0; i < length; i++) {
            const diff = elite.normalised[i] - mean[i];
            variance[i] += diff * diff;
        }
    });
    return variance.map((value) => {
        const std = Math.sqrt(value / elites.length);
        return Math.max(std, 0.01);
    });
}

export async function runCEM({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => r?.score,
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress = () => {}
}) {
    if (!start) throw new Error('Stage4 CEM: 缺少起始參數');
    const adapter = createVectorAdapter({ bounds, encodeVec, decodeVec, startParams: start });
    const { startNormalised, project } = adapter;

    let mu = [...startNormalised];
    let sigma = mu.map(() => clamp(initSigma, 0.01, 0.5));

    const startProjection = project(mu);
    mu = startProjection.normalised;

    let bestParams = startProjection.params;
    let bestScore = -Infinity;
    let bestMetrics = null;

    const initialEval = await callEvaluator(evaluator, [bestParams]);
    if (Array.isArray(initialEval) && initialEval.length > 0) {
        const initialScore = resolveScore(initialEval[0], objective);
        if (initialScore > bestScore) {
            bestScore = initialScore;
            bestMetrics = extractMetrics(initialEval[0]);
        }
    }

    for (let iter = 0; iter < iters; iter++) {
        const candidates = [];
        const evaluations = [];

        for (let i = 0; i < popSize; i++) {
            const sample = mu.map((mean, index) => clamp(mean + sigma[index] * boxMuller()));
            const projected = project(sample);
            candidates.push(projected);
        }

        const populationResults = await callEvaluator(evaluator, candidates.map((item) => item.params));

        for (let i = 0; i < candidates.length; i++) {
            const result = Array.isArray(populationResults) ? populationResults[i] : null;
            const score = resolveScore(result, objective);
            if (score > bestScore && result) {
                bestScore = score;
                bestParams = candidates[i].params;
                bestMetrics = extractMetrics(result);
            }
            evaluations.push({
                params: candidates[i].params,
                normalised: candidates[i].normalised,
                score,
                metrics: result ? extractMetrics(result) : null,
            });
        }

        evaluations.sort((a, b) => b.score - a.score);
        const eliteCount = Math.max(1, Math.floor(popSize * eliteRatio));
        const elites = evaluations.slice(0, eliteCount);
        const eliteNormals = elites.map((elite) => elite.normalised);

        const mean = computeMean(eliteNormals);
        const std = computeStd(elites, mean);

        mu = mean.map((value) => clamp(value));
        sigma = sigma.map((prev, index) => {
            const blended = 0.9 * std[index] + 0.1 * prev;
            return clamp(blended, 0.01, 0.35);
        });

        try {
            onProgress({ iter: iter + 1, bestScore });
        } catch (error) {
            console.warn('[Stage4 CEM] onProgress 發送失敗:', error);
        }
    }

    if (!Number.isFinite(bestScore)) {
        throw new Error('Stage4 CEM: 無法找到有效的最佳分數');
    }

    return { bestParams, bestScore, bestMetrics };
}

export default runCEM;
