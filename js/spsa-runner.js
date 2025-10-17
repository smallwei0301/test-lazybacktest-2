// --- Stage4 SPSA Runner ---
// Patch Tag: LB-STAGE4-REFINE-20251005A

/**
 * Stochastic Parallel Simultaneous Approximation (SPSA) optimizer
 * 將參數映射到 [0,1] 空間進行擾動，僅需兩次評估估計梯度。
 * @param {Object} options
 * @param {Object} options.start - 起始參數（已展平）
 * @param {Object} options.bounds - 參數界線定義
 * @param {Function} options.encodeVec - 將參數物件轉為向量
 * @param {Function} options.decodeVec - 將向量還原成參數物件
 * @param {Function} options.evaluator - 評估函式，回傳 { score, ... }
 * @param {Function} [options.objective] - 自訂目標函式
 * @param {number} [options.steps=30] - 迭代步數
 * @param {number} [options.a0=0.2] - 初始步長係數
 * @param {number} [options.c0=0.1] - 擾動幅度係數
 * @param {number} [options.alpha=0.602] - 步長衰減指數
 * @param {number} [options.gamma=0.101] - 擾動衰減指數
 * @param {Function} [options.onProgress] - 進度回報
 * @returns {Promise<{bestParams:Object,bestScore:number,bestEvaluation?:Object}>}
 */
export async function runSPSA({
  start,
  bounds,
  encodeVec,
  decodeVec,
  evaluator,
  objective = (r) => r?.score ?? -Infinity,
  steps = 30,
  a0 = 0.2,
  c0 = 0.1,
  alpha = 0.602,
  gamma = 0.101,
  onProgress = () => {}
}) {
  if (!start || typeof start !== 'object') {
    throw new Error('SPSA: start params missing');
  }
  if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
    throw new Error('SPSA: encode/decode functions are required');
  }
  if (typeof evaluator !== 'function') {
    throw new Error('SPSA: evaluator function is required');
  }

  const boundEntries = Object.entries(bounds || {}).filter(([key]) => key !== 'constraintFix');
  const constraintFix = typeof bounds?.constraintFix === 'function' ? bounds.constraintFix : null;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const normaliseValue = (value, info = {}) => {
    if (info.enum && Array.isArray(info.enum) && info.enum.length > 0) {
      const idx = info.enum.indexOf(value);
      if (idx < 0) return 0;
      return info.enum.length === 1 ? 0 : idx / (info.enum.length - 1);
    }
    const min = Number.isFinite(info.min) ? info.min : 0;
    const max = Number.isFinite(info.max) ? info.max : 1;
    if (max === min) return 0;
    return clamp01((value - min) / (max - min));
  };

  const denormaliseValue = (value, info = {}) => {
    const v = clamp01(value);
    if (info.enum && Array.isArray(info.enum) && info.enum.length > 0) {
      if (info.enum.length === 1) return info.enum[0];
      const idx = Math.round(v * (info.enum.length - 1));
      return info.enum[Math.max(0, Math.min(info.enum.length - 1, idx))];
    }
    const min = Number.isFinite(info.min) ? info.min : 0;
    const max = Number.isFinite(info.max) ? info.max : 1;
    if (max === min) return min;
    const raw = min + v * (max - min);
    if (info.type === 'int' || info.type === 'integer') {
      return Math.round(raw);
    }
    return raw;
  };

  const keys = boundEntries.map(([key]) => key);
  const startVec = encodeVec(start);
  const theta = startVec.map((val, idx) => normaliseValue(val, bounds[keys[idx]]));

  let bestEvaluation = null;

  const evaluateNormalized = async (normVec) => {
    const actualVec = normVec.map((val, idx) => denormaliseValue(val, bounds[keys[idx]]));
    let candidate = decodeVec(actualVec) || {};
    if (constraintFix) {
      const fixed = constraintFix({ ...candidate });
      if (fixed && typeof fixed === 'object') {
        candidate = fixed;
      }
    }
    const evaluation = await evaluator(candidate);
    if (!evaluation) return null;
    const score = Number(objective(evaluation));
    return {
      candidate,
      evaluation,
      score: Number.isFinite(score) ? score : -Infinity
    };
  };

  // 評估起始點
  bestEvaluation = await evaluateNormalized(theta);

  for (let step = 0; step < steps; step += 1) {
    const ck = c0 / Math.pow(step + 1, gamma);
    const ak = a0 / Math.pow(step + 1, alpha);

    const delta = keys.map(() => (Math.random() < 0.5 ? -1 : 1));
    const thetaPlus = theta.map((val, idx) => clamp01(val + ck * delta[idx]));
    const thetaMinus = theta.map((val, idx) => clamp01(val - ck * delta[idx]));

    const plusEval = await evaluateNormalized(thetaPlus);
    const minusEval = await evaluateNormalized(thetaMinus);

    const yPlus = plusEval?.score ?? bestEvaluation?.score ?? -Infinity;
    const yMinus = minusEval?.score ?? bestEvaluation?.score ?? -Infinity;

    const gradient = keys.map((_, idx) => {
      const denom = 2 * ck * (delta[idx] || 1);
      if (!denom) return 0;
      return (yPlus - yMinus) / denom;
    });

    for (let i = 0; i < theta.length; i += 1) {
      theta[i] = clamp01(theta[i] - ak * gradient[i]);
    }

    [plusEval, minusEval].forEach((candidateEval) => {
      if (candidateEval && (!bestEvaluation || candidateEval.score > bestEvaluation.score)) {
        bestEvaluation = candidateEval;
      }
    });

    try {
      onProgress({ step: step + 1, bestScore: bestEvaluation?.score ?? null });
    } catch (progressError) {
      console.warn('[SPSA] onProgress callback failed:', progressError);
    }
  }

  if (!bestEvaluation) {
    return {
      bestParams: start,
      bestScore: -Infinity
    };
  }

  return {
    bestParams: bestEvaluation.candidate,
    bestScore: bestEvaluation.score,
    bestEvaluation: bestEvaluation.evaluation
  };
}
