// --- Stage4 CEM Runner ---
// Patch Tag: LB-STAGE4-REFINE-20251005A

/**
 * Cross-Entropy Method (CEM) for局部微調。
 * 於 [0,1] 空間建立高斯分佈，取前 ρ% 精英更新均值與標準差。
 * @param {Object} options
 * @param {Object} options.start - 起始參數（已展平）
 * @param {Object} options.bounds - 參數界線定義
 * @param {Function} options.encodeVec - 將參數物件轉為向量
 * @param {Function} options.decodeVec - 將向量還原成參數物件
 * @param {Function} options.evaluator - 評估函式，回傳 { score, ... }
 * @param {Function} [options.objective] - 自訂目標函式
 * @param {number} [options.iters=10] - 迭代回合數
 * @param {number} [options.popSize=40] - 每回合樣本數
 * @param {number} [options.eliteRatio=0.2] - 精英比例
 * @param {number} [options.initSigma=0.15] - 初始標準差
 * @param {Function} [options.onProgress] - 進度回報
 * @returns {Promise<{bestParams:Object,bestScore:number,bestEvaluation?:Object}>}
 */
export async function runCEM({
  start,
  bounds,
  encodeVec,
  decodeVec,
  evaluator,
  objective = (r) => r?.score ?? -Infinity,
  iters = 10,
  popSize = 40,
  eliteRatio = 0.2,
  initSigma = 0.15,
  onProgress = () => {}
}) {
  if (!start || typeof start !== 'object') {
    throw new Error('CEM: start params missing');
  }
  if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
    throw new Error('CEM: encode/decode functions are required');
  }
  if (typeof evaluator !== 'function') {
    throw new Error('CEM: evaluator function is required');
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

  const randomGaussian = (() => {
    let spare = null;
    return () => {
      if (spare !== null) {
        const val = spare;
        spare = null;
        return val;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const mag = Math.sqrt(-2.0 * Math.log(u));
      const z0 = mag * Math.cos(2 * Math.PI * v);
      const z1 = mag * Math.sin(2 * Math.PI * v);
      spare = z1;
      return z0;
    };
  })();

  const keys = boundEntries.map(([key]) => key);
  const startVec = encodeVec(start);
  let mean = startVec.map((val, idx) => normaliseValue(val, bounds[keys[idx]]));
  let sigma = keys.map(() => initSigma);

  let bestEvaluation = await evaluateNormalized(mean);

  async function evaluateNormalized(normVec) {
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
      score: Number.isFinite(score) ? score : -Infinity,
      normVec: normVec.slice()
    };
  }

  for (let iter = 0; iter < iters; iter += 1) {
    const population = [];
    for (let i = 0; i < popSize; i += 1) {
      const sample = mean.map((m, idx) => clamp01(m + sigma[idx] * randomGaussian()));
      const evalResult = await evaluateNormalized(sample);
      if (evalResult) {
        population.push(evalResult);
        if (!bestEvaluation || evalResult.score > bestEvaluation.score) {
          bestEvaluation = evalResult;
        }
      }
    }

    population.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    const eliteCount = Math.max(1, Math.floor(popSize * eliteRatio));
    const elites = population.slice(0, eliteCount);

    if (elites.length > 0) {
      mean = keys.map((_, idx) => {
        const sum = elites.reduce((acc, item) => acc + (item.normVec?.[idx] ?? 0), 0);
        return clamp01(sum / elites.length);
      });
      sigma = keys.map((_, idx) => {
        const mu = mean[idx];
        const variance = elites.reduce((acc, item) => {
          const diff = (item.normVec?.[idx] ?? mu) - mu;
          return acc + diff * diff;
        }, 0) / elites.length;
        const std = Math.sqrt(Math.max(variance, 1e-6));
        return Math.max(std * 0.9, 1e-3);
      });
    } else {
      sigma = sigma.map((s) => Math.max(s * 0.9, 1e-3));
    }

    try {
      onProgress({ iter: iter + 1, bestScore: bestEvaluation?.score ?? null });
    } catch (progressError) {
      console.warn('[CEM] onProgress callback failed:', progressError);
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
