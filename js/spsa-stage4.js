const DEFAULT_OPTIONS = {
  stepCount: 30,
  a0: 0.2,
  c0: 0.1,
  alpha: 0.602,
  gamma: 0.101,
};

function cloneCombo(combo) {
  if (!combo) return null;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(combo);
    } catch (err) {}
  }
  return JSON.parse(JSON.stringify(combo));
}

function resolveParamDefs({ startCombo, strategyMeta = {}, riskMeta = {} }) {
  const defs = [];
  const addFromStrategy = (strategyKey, params, role) => {
    if (!strategyKey || !params) return;
    const meta = strategyMeta[strategyKey];
    if (!meta || !Array.isArray(meta.optimizeTargets)) return;
    meta.optimizeTargets.forEach((target) => {
      const key = target?.name;
      const range = target?.range || {};
      const value = params[key];
      if (!key || !Number.isFinite(value)) return;
      const min = Number.isFinite(range.from) ? Number(range.from) : value - Math.abs(value) || 1;
      const max = Number.isFinite(range.to) ? Number(range.to) : value + Math.abs(value) || 1;
      if (min === max) return;
      defs.push({
        role,
        strategyKey,
        key,
        min,
        max,
        step: Number.isFinite(range.step) ? Number(range.step) : null,
      });
    });
  };

  addFromStrategy(startCombo?.buyStrategy, startCombo?.buyParams, 'buy');
  addFromStrategy(startCombo?.sellStrategy, startCombo?.sellParams, 'sell');

  if (startCombo?.riskManagement) {
    Object.entries(startCombo.riskManagement).forEach(([key, value]) => {
      if (!Number.isFinite(value)) return;
      const range = riskMeta[key]?.range || {};
      const min = Number.isFinite(range.from) ? Number(range.from) : 0;
      const max = Number.isFinite(range.to) ? Number(range.to) : Math.max(value * 2, value + 1);
      if (min === max) return;
      defs.push({
        role: 'risk',
        strategyKey: 'riskManagement',
        key,
        min,
        max,
        step: Number.isFinite(range.step) ? Number(range.step) : null,
      });
    });
  }

  return defs;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalise(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function denormalise(value, min, max) {
  const raw = min + value * (max - min);
  if (!Number.isFinite(raw)) return min;
  return clamp(raw, min, max);
}

function roundToStep(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  const precision = Math.ceil(Math.max(0, -Math.log10(step))); 
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(precision));
}

function applyConstraints(combo) {
  if (!combo) return combo;
  const buy = combo.buyParams || {};
  const sell = combo.sellParams || {};
  const adjustOrder = (params, smallKey, largeKey, gap = 1) => {
    if (!Number.isFinite(params[smallKey]) || !Number.isFinite(params[largeKey])) return;
    if (params[smallKey] + gap > params[largeKey]) {
      const mid = (params[smallKey] + params[largeKey]) / 2;
      params[smallKey] = Math.floor(mid - gap / 2);
      params[largeKey] = Math.ceil(mid + gap / 2);
    }
  };
  adjustOrder(buy, 'shortPeriod', 'longPeriod', 1);
  adjustOrder(sell, 'shortPeriod', 'longPeriod', 1);
  adjustOrder(buy, 'thresholdX', 'thresholdY', 1);
  adjustOrder(sell, 'thresholdX', 'thresholdY', 1);
  return combo;
}

function buildVector(combo, defs) {
  return defs.map((def) => {
    const source = def.role === 'buy' ? combo.buyParams : def.role === 'sell' ? combo.sellParams : combo.riskManagement;
    return normalise(source?.[def.key], def.min, def.max);
  });
}

function vectorToCombo(baseCombo, vector, defs) {
  const next = cloneCombo(baseCombo) || {};
  next.buyParams = cloneCombo(baseCombo?.buyParams) || {};
  next.sellParams = cloneCombo(baseCombo?.sellParams) || {};
  next.riskManagement = cloneCombo(baseCombo?.riskManagement) || {};

  defs.forEach((def, idx) => {
    const source = def.role === 'buy' ? next.buyParams : def.role === 'sell' ? next.sellParams : next.riskManagement;
    let value = denormalise(vector[idx], def.min, def.max);
    value = roundToStep(value, def.step);
    source[def.key] = value;
  });

  return applyConstraints(next);
}

function getScore(result) {
  if (!result) return -Infinity;
  const score = result.annualizedReturn;
  return Number.isFinite(score) ? score : -Infinity;
}

async function evaluateComboVector({
  baseCombo,
  vector,
  defs,
  evaluateCombo,
}) {
  const candidate = vectorToCombo(baseCombo, vector, defs);
  const result = await evaluateCombo(candidate);
  return { combo: candidate, result, score: getScore(result) };
}

export async function runStage4SPSA({
  startCombo,
  stepCount = DEFAULT_OPTIONS.stepCount,
  a0 = DEFAULT_OPTIONS.a0,
  c0 = DEFAULT_OPTIONS.c0,
  alpha = DEFAULT_OPTIONS.alpha,
  gamma = DEFAULT_OPTIONS.gamma,
  onProgress,
  evaluateCombo,
  strategyMeta,
  riskMeta,
}) {
  if (!startCombo || typeof evaluateCombo !== 'function') {
    console.warn('[Stage4:SPSA] 無有效的起始組合或評估函式');
    return null;
  }

  const defs = resolveParamDefs({ startCombo, strategyMeta, riskMeta });
  if (!defs || defs.length === 0) {
    const result = await evaluateCombo(startCombo);
    return { bestCombo: cloneCombo(startCombo), bestResult: result };
  }

  const baseCombo = cloneCombo(startCombo);
  let currentVector = buildVector(baseCombo, defs);
  let bestRecord = await evaluateComboVector({ baseCombo, vector: currentVector, defs, evaluateCombo });
  let bestScore = bestRecord.score;

  for (let step = 1; step <= stepCount; step++) {
    const ak = a0 / Math.pow(step + 10, alpha);
    const ck = c0 / Math.pow(step, gamma);

    const delta = currentVector.map(() => (Math.random() < 0.5 ? -1 : 1));

    const plusVector = currentVector.map((value, idx) => clamp(value + ck * delta[idx], 0, 1));
    const minusVector = currentVector.map((value, idx) => clamp(value - ck * delta[idx], 0, 1));

    const [plus, minus] = await Promise.all([
      evaluateComboVector({ baseCombo, vector: plusVector, defs, evaluateCombo }),
      evaluateComboVector({ baseCombo, vector: minusVector, defs, evaluateCombo }),
    ]);

    const gradient = currentVector.map((_, idx) => {
      const diff = plus.score - minus.score;
      return (diff / (2 * ck)) * delta[idx];
    });

    const candidateVector = currentVector.map((value, idx) => clamp(value + ak * gradient[idx], 0, 1));

    const bestCandidate = plus.score >= minus.score ? plus : minus;
    if (bestCandidate.score > bestScore) {
      bestRecord = bestCandidate;
      bestScore = bestCandidate.score;
    }

    currentVector = candidateVector;

    if (typeof onProgress === 'function') {
      onProgress({
        method: 'spsa',
        step,
        stepCount,
        bestScore,
        candidateScore: bestCandidate.score,
      });
    }
  }

  return {
    bestCombo: bestRecord.combo,
    bestResult: bestRecord.result,
  };
}
