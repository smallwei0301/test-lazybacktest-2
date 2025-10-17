// Stage4 Local Refinement CEM Runner
// Patch Tag: LB-STAGE4-REFINE-20250930A

const DEFAULT_MIN_SIGMA = 1e-3;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function createNormalizers(bounds) {
  const keys = Object.keys(bounds).filter((key) => key !== 'constraintFix');
  const meta = keys.map((key) => ({ key, ...bounds[key] }));

  const toUnit = (vec) => vec.map((value, index) => {
    const info = meta[index];
    const span = info.max - info.min || DEFAULT_MIN_SIGMA;
    return clamp((value - info.min) / span, 0, 1);
  });

  const fromUnit = (unitVec) => unitVec.map((value, index) => {
    const info = meta[index];
    const span = info.max - info.min || DEFAULT_MIN_SIGMA;
    const raw = info.min + clamp(value, 0, 1) * span;
    if (info.type === 'int') {
      const rounded = Math.round(raw);
      return clamp(rounded, info.min, info.max);
    }
    return clamp(raw, info.min, info.max);
  });

  return { keys, meta, toUnit, fromUnit };
}

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

async function evaluateCandidate(evaluator, candidate) {
  if (!evaluator) throw new Error('CEM: evaluator not provided');
  const payload = Array.isArray(candidate) ? candidate : [candidate];
  let output;
  if (typeof evaluator.evaluate === 'function') {
    output = await evaluator.evaluate(payload);
  } else if (typeof evaluator === 'function') {
    output = await evaluator(payload);
  } else {
    throw new Error('CEM: evaluator must be function');
  }

  if (Array.isArray(output)) return output[0] || null;
  if (output && Array.isArray(output.results)) return output.results[0] || null;
  return output || null;
}

export async function runCEM({
  start,
  bounds,
  encodeVec,
  decodeVec,
  evaluator,
  objective = (r) => r?.score ?? 0,
  iters = 10,
  popSize = 40,
  eliteRatio = 0.2,
  initSigma = 0.15,
  onProgress = () => {}
}) {
  if (!start) throw new Error('CEM: start params required');
  if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
    throw new Error('CEM: encodeVec/decodeVec required');
  }
  if (!bounds || typeof bounds !== 'object') {
    throw new Error('CEM: bounds required');
  }

  const { meta, toUnit, fromUnit } = createNormalizers(bounds);
  const applyConstraint = typeof bounds.constraintFix === 'function'
    ? bounds.constraintFix
    : (params) => params;

  const startVec = encodeVec(start);
  if (!Array.isArray(startVec) || startVec.length !== meta.length) {
    throw new Error('CEM: encodeVec must return vector matching bounds');
  }

  let mean = toUnit(startVec);
  let sigma = mean.map(() => initSigma);

  let bestParams = applyConstraint(start);
  let bestEvaluation = await evaluateCandidate(evaluator, bestParams);
  let bestScore = objective(bestEvaluation);

  const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));

  for (let iter = 0; iter < iters; iter += 1) {
    const population = [];
    for (let i = 0; i < popSize; i += 1) {
      const sampleUnit = mean.map((m, index) => {
        const perturb = gaussianRandom() * (sigma[index] ?? initSigma);
        return clamp(m + perturb, 0, 1);
      });
      const candidate = applyConstraint(decodeVec(fromUnit(sampleUnit)));
      const evaluation = await evaluateCandidate(evaluator, candidate);
      const score = objective(evaluation);
      if (score > bestScore) {
        bestScore = score;
        bestParams = candidate;
        bestEvaluation = evaluation;
      }
      population.push({ unit: sampleUnit, candidate, evaluation, score });
    }

    population.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
    const elites = population.slice(0, eliteCount);

    mean = mean.map((_, index) => {
      const avg = elites.reduce((sum, item) => sum + item.unit[index], 0) / elites.length;
      return clamp(avg, 0, 1);
    });

    sigma = sigma.map((_, index) => {
      const avg = elites.reduce((sum, item) => sum + item.unit[index], 0) / elites.length;
      const variance = elites.reduce((sum, item) => {
        const diff = item.unit[index] - avg;
        return sum + diff * diff;
      }, 0) / elites.length;
      const std = Math.sqrt(Math.max(variance, DEFAULT_MIN_SIGMA * DEFAULT_MIN_SIGMA));
      return clamp(std * 0.9, DEFAULT_MIN_SIGMA, 0.5);
    });

    onProgress({ iter: iter + 1, bestScore });
  }

  return { bestParams, bestScore, bestEvaluation };
}
