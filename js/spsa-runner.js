// --- Stage4 SPSA Runner -----------------------------------------------------
// Patch Tag: LB-STAGE4-SPSA-20251212A
// 以 Simultaneous Perturbation Stochastic Approximation (SPSA) 針對
// 既有最佳解附近進行局部微調。每步僅需兩次回測，適合昂貴的目標函數。

/**
 * 以線性方式將值正規化至 [0, 1] 區間。
 * @param {number} value 原始數值
 * @param {{ min:number, max:number }} bound 範圍
 * @returns {number}
 */
function normalize(value, bound) {
    const min = Number.isFinite(bound?.min) ? bound.min : 0;
    const max = Number.isFinite(bound?.max) ? bound.max : 1;
    if (max === min) return 0.5;
    const ratio = (value - min) / (max - min);
    return Math.max(0, Math.min(1, ratio));
}

/**
 * 由正規化值還原回實際數值，並依需求進行型別處理。
 * @param {number} value 正規化後的值
 * @param {{ min:number, max:number, type?:string }} bound 範圍資訊
 * @returns {number}
 */
function denormalize(value, bound) {
    const min = Number.isFinite(bound?.min) ? bound.min : 0;
    const max = Number.isFinite(bound?.max) ? bound.max : 1;
    const raw = min + (max - min) * value;
    if (bound?.type === 'int' || bound?.type === 'integer') {
        return Math.round(raw);
    }
    return raw;
}

/**
 * 產生 {-1, +1} 向量。
 * @param {number} dimension 維度
 * @returns {number[]}
 */
function createRademacherVector(dimension) {
    const delta = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
        delta[i] = Math.random() < 0.5 ? -1 : 1;
    }
    return delta;
}

/**
 * 將向量限制於 [0, 1]。
 * @param {number[]} vec
 * @returns {number[]}
 */
function clampUnit(vec) {
    return vec.map((v) => {
        if (!Number.isFinite(v)) return 0.5;
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    });
}

/**
 * 依照指定 key 順序將實際值轉為正規化向量。
 * @param {number[]} vec 原始向量
 * @param {string[]} keys 向量對應的 key 順序
 * @param {Record<string, any>} bounds
 * @returns {number[]}
 */
function toNormalizedVector(vec, keys, bounds) {
    return vec.map((value, index) => {
        const key = keys[index];
        return normalize(value, bounds[key]);
    });
}

/**
 * 由正規化向量轉回實際值陣列。
 * @param {number[]} vec 正規化向量
 * @param {string[]} keys key 順序
 * @param {Record<string, any>} bounds
 * @returns {number[]}
 */
function fromNormalizedVector(vec, keys, bounds) {
    return vec.map((value, index) => {
        const key = keys[index];
        return denormalize(value, bounds[key]);
    });
}

/**
 * 執行一次候選評估。
 * @param {number[]} normVec 正規化參數向量
 * @param {string[]} keys 維度對應 key
 * @param {Record<string, any>} bounds 範圍資訊
 * @param {(values:number[])=>any} decodeVec 反編碼函式
 * @param {(chromes:any[])=>Promise<any[]>} evaluator 評估函式
 * @param {(result:any)=>number} objective 目標函式
 * @returns {Promise<{ params:any, result:any, score:number }>}
 */
async function evaluateCandidate(normVec, keys, bounds, decodeVec, evaluator, objective) {
    const actualVec = fromNormalizedVector(normVec, keys, bounds);
    let params = decodeVec(actualVec);
    if (typeof bounds?.constraintFix === 'function') {
        params = bounds.constraintFix(params) || params;
    }

    const results = await evaluator([params]);
    const result = Array.isArray(results) ? results[0] : results;
    const score = objective(result);
    return {
        params,
        result,
        score: Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY
    };
}

/**
 * 執行 SPSA 微調流程。
 * @param {Object} options
 * @param {Object} options.start 起始參數
 * @param {Record<string, any>} options.bounds 參數範圍
 * @param {(chrom:any)=>number[]} options.encodeVec 編碼函式
 * @param {(vec:number[])=>any} options.decodeVec 反編碼函式
 * @param {(population:any[])=>Promise<any[]>} options.evaluator 評估器
 * @param {(result:any)=>number} [options.objective]
 * @param {number} [options.steps]
 * @param {number} [options.a0]
 * @param {number} [options.c0]
 * @param {number} [options.alpha]
 * @param {number} [options.gamma]
 * @param {(payload:Object)=>void} [options.onProgress]
 * @returns {Promise<{ bestParams:any, bestScore:number, bestResult:any }>}
 */
export async function runSPSA({
    start,
    bounds,
    encodeVec,
    decodeVec,
    evaluator,
    objective = (r) => (r && typeof r.score === 'number') ? r.score : (r?.annualizedReturn ?? Number.NEGATIVE_INFINITY),
    steps = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress = () => {}
}) {
    if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
        throw new Error('SPSA: encodeVec/decodeVec 未提供');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('SPSA: evaluator 未提供');
    }

    const vectorKeys = Array.isArray(bounds?.__vectorKeys)
        ? bounds.__vectorKeys.slice()
        : Object.keys(bounds || {}).filter((key) => key !== 'constraintFix' && !key.startsWith('__'));

    const startVec = encodeVec(start);
    const theta = toNormalizedVector(startVec, vectorKeys, bounds);

    let bestCandidate = await evaluateCandidate(theta, vectorKeys, bounds, decodeVec, evaluator, objective);
    let bestScore = bestCandidate.score;
    let bestParams = bestCandidate.params;
    let bestResult = bestCandidate.result;

    let currentTheta = theta.slice();

    for (let step = 0; step < steps; step++) {
        const ak = a0 / Math.pow(step + 1, alpha);
        const ck = c0 / Math.pow(step + 1, gamma);
        const delta = createRademacherVector(vectorKeys.length);

        const thetaPlus = clampUnit(currentTheta.map((v, i) => v + ck * delta[i]));
        const thetaMinus = clampUnit(currentTheta.map((v, i) => v - ck * delta[i]));

        const plusCandidate = await evaluateCandidate(thetaPlus, vectorKeys, bounds, decodeVec, evaluator, objective);
        const minusCandidate = await evaluateCandidate(thetaMinus, vectorKeys, bounds, decodeVec, evaluator, objective);

        const yPlus = plusCandidate.score;
        const yMinus = minusCandidate.score;

        const gradient = delta.map((value) => {
            if (value === 0) return 0;
            const g = (yPlus - yMinus) / (2 * ck * value);
            return Number.isFinite(g) ? g : 0;
        });

        currentTheta = clampUnit(currentTheta.map((value, index) => value - ak * gradient[index]));

        if (yPlus > bestScore) {
            bestScore = yPlus;
            bestParams = plusCandidate.params;
            bestResult = plusCandidate.result;
        }
        if (yMinus > bestScore) {
            bestScore = yMinus;
            bestParams = minusCandidate.params;
            bestResult = minusCandidate.result;
        }

        onProgress({ step: step + 1, bestScore });
    }

    return { bestParams, bestScore, bestResult };
}

