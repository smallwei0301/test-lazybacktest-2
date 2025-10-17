// --- Stage4 CEM Runner ------------------------------------------------------
// Patch Tag: LB-STAGE4-CEM-20251212A
// Cross-Entropy Method：透過精英樣本逐步更新分佈，適合平滑化的局部搜索。

/**
 * Box-Muller 隨機數生成，以取得標準常態分佈。
 * @returns {number}
 */
function gaussian() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clampUnit(value) {
    if (!Number.isFinite(value)) return 0.5;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function normalize(value, bound) {
    const min = Number.isFinite(bound?.min) ? bound.min : 0;
    const max = Number.isFinite(bound?.max) ? bound.max : 1;
    if (max === min) return 0.5;
    return (value - min) / (max - min);
}

function denormalize(value, bound) {
    const min = Number.isFinite(bound?.min) ? bound.min : 0;
    const max = Number.isFinite(bound?.max) ? bound.max : 1;
    const raw = min + (max - min) * value;
    if (bound?.type === 'int' || bound?.type === 'integer') {
        return Math.round(raw);
    }
    return raw;
}

function toNormalizedVector(vec, keys, bounds) {
    return vec.map((value, index) => normalize(value, bounds[keys[index]]));
}

function fromNormalizedVector(vec, keys, bounds) {
    return vec.map((value, index) => denormalize(value, bounds[keys[index]]));
}

function computeMean(vectors) {
    if (!vectors.length) return [];
    const dimension = vectors[0].length;
    const mean = new Array(dimension).fill(0);
    vectors.forEach((vec) => {
        for (let i = 0; i < dimension; i++) {
            mean[i] += vec[i];
        }
    });
    for (let i = 0; i < dimension; i++) {
        mean[i] /= vectors.length;
    }
    return mean;
}

function computeStd(vectors, mean) {
    if (!vectors.length) return new Array(mean.length).fill(0.05);
    const dimension = mean.length;
    const variance = new Array(dimension).fill(0);
    vectors.forEach((vec) => {
        for (let i = 0; i < dimension; i++) {
            const diff = vec[i] - mean[i];
            variance[i] += diff * diff;
        }
    });
    for (let i = 0; i < dimension; i++) {
        variance[i] = Math.sqrt(variance[i] / vectors.length);
    }
    return variance;
}

async function evaluatePopulation(population, keys, bounds, decodeVec, evaluator, objective) {
    const decoded = population.map((normVec) => {
        const actualVec = fromNormalizedVector(normVec, keys, bounds);
        let params = decodeVec(actualVec);
        if (typeof bounds?.constraintFix === 'function') {
            params = bounds.constraintFix(params) || params;
        }
        return params;
    });

    const results = await evaluator(decoded);
    return results.map((result, index) => {
        const score = objective(result);
        return {
            normVec: population[index],
            params: decoded[index],
            result,
            score: Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY
        };
    });
}

export async function runCEM({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && typeof r.score === 'number') ? r.score : (r?.annualizedReturn ?? Number.NEGATIVE_INFINITY),
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress = () => {}
}) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('CEM: encodeVec/decodeVec 未提供');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('CEM: evaluator 未提供');
    }

    const vectorKeys = Array.isArray(bounds?.__vectorKeys)
        ? bounds.__vectorKeys.slice()
        : Object.keys(bounds || {}).filter((key) => key !== 'constraintFix' && !key.startsWith('__'));

    const startVec = encodeVec(start);
    let mean = toNormalizedVector(startVec, vectorKeys, bounds);
    let sigma = new Array(mean.length).fill(initSigma);

    let bestResult = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestParams = start;

    const eliteCount = Math.max(1, Math.floor(popSize * eliteRatio));

    for (let iter = 0; iter < iters; iter++) {
        const population = [];
        for (let i = 0; i < popSize; i++) {
            const sample = mean.map((m, index) => clampUnit(m + sigma[index] * gaussian()));
            population.push(sample);
        }

        // 保留當前均值位置以確保探索穩定
        population[0] = clampUnit(mean.slice());

        const evaluated = await evaluatePopulation(population, vectorKeys, bounds, decodeVec, evaluator, objective);

        evaluated.sort((a, b) => b.score - a.score);

        if (evaluated[0] && evaluated[0].score > bestScore) {
            bestScore = evaluated[0].score;
            bestParams = evaluated[0].params;
            bestResult = evaluated[0].result;
        }

        const elites = evaluated.slice(0, eliteCount).map((item) => item.normVec);
        const eliteMean = computeMean(elites);
        const eliteStd = computeStd(elites, eliteMean);

        mean = eliteMean.map((value) => clampUnit(value));
        sigma = eliteStd.map((value, index) => {
            const shrunk = value * 0.9 + initSigma * 0.1;
            return Math.max(0.02, Math.min(0.5, shrunk));
        });

        onProgress({ iter: iter + 1, bestScore });
    }

    return { bestParams, bestScore, bestResult };
}

