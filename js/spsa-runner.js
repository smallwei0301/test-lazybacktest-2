// Stage4 Local Refinement SPSA Runner
// Patch Tag: LB-STAGE4-REFINE-20250930A

const DEFAULT_MIN_STEP = 1e-6;

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
    const span = info.max - info.min || DEFAULT_MIN_STEP;
    return clamp((value - info.min) / span, 0, 1);
  });

  const fromUnit = (unitVec) => unitVec.map((value, index) => {
    const info = meta[index];
    const span = info.max - info.min || DEFAULT_MIN_STEP;
    const raw = info.min + clamp(value, 0, 1) * span;
    if (info.type === 'int') {
      const rounded = Math.round(raw);
      return clamp(rounded, info.min, info.max);
    }
    return clamp(raw, info.min, info.max);
  });

  return { keys, meta, toUnit, fromUnit };
}

async function evaluateCandidate(evaluator, candidate) {
  if (!evaluator) throw new Error('SPSA: evaluator not provided');
  const payload = Array.isArray(candidate) ? candidate : [candidate];
  let output;
  if (typeof evaluator.evaluate === 'function') {
    output = await evaluator.evaluate(payload);
  } else if (typeof evaluator === 'function') {
    output = await evaluator(payload);
  } else {
    throw new Error('SPSA: evaluator must be function');
  }

  if (Array.isArray(output)) return output[0] || null;
  if (output && Array.isArray(output.results)) return output.results[0] || null;
  return output || null;
}

export async function runSPSA({
  start,
  bounds,
  encodeVec,
  decodeVec,
  evaluator,
  objective = (r) => r?.score ?? 0,
  steps = 30,
  a0 = 0.2,
  c0 = 0.1,
  alpha = 0.602,
  gamma = 0.101,
  onProgress = () => {}
}) {
  if (!start) throw new Error('SPSA: start params required');
  if (typeof encodeVec !== 'function' || typeof decodeVec !== 'function') {
    throw new Error('SPSA: encodeVec/decodeVec required');
  }
  if (!bounds || typeof bounds !== 'object') {
    throw new Error('SPSA: bounds required');
  }

  const { meta, toUnit, fromUnit } = createNormalizers(bounds);
  const applyConstraint = typeof bounds.constraintFix === 'function'
    ? bounds.constraintFix
    : (params) => params;

  const startVec = encodeVec(start);
  if (!Array.isArray(startVec) || startVec.length !== meta.length) {
    throw new Error('SPSA: encodeVec must return vector matching bounds');
  }

  let theta = toUnit(startVec);

  let bestParams = applyConstraint(start);
  let bestEvaluation = await evaluateCandidate(evaluator, bestParams);
  let bestScore = objective(bestEvaluation);

  for (let step = 0; step < steps; step += 1) {
    const aT = a0 / Math.pow(step + 1, alpha);
    const cT = c0 / Math.pow(step + 1, gamma);
    const delta = theta.map(() => (Math.random() < 0.5 ? -1 : 1));

    const thetaPlus = theta.map((value, index) => clamp(value + cT * delta[index], 0, 1));
    const thetaMinus = theta.map((value, index) => clamp(value - cT * delta[index], 0, 1));

    const candidatePlus = applyConstraint(decodeVec(fromUnit(thetaPlus)));
    const evalPlus = await evaluateCandidate(evaluator, candidatePlus);
    const yPlus = objective(evalPlus);

    if (yPlus > bestScore) {
      bestScore = yPlus;
      bestParams = candidatePlus;
      bestEvaluation = evalPlus;
    }

    const candidateMinus = applyConstraint(decodeVec(fromUnit(thetaMinus)));
    const evalMinus = await evaluateCandidate(evaluator, candidateMinus);
    const yMinus = objective(evalMinus);

    if (yMinus > bestScore) {
      bestScore = yMinus;
      bestParams = candidateMinus;
      bestEvaluation = evalMinus;
    }

    const gradient = theta.map((_, index) => {
      const denom = 2 * cT * delta[index];
      if (!Number.isFinite(denom) || Math.abs(denom) < DEFAULT_MIN_STEP) return 0;
      return (yPlus - yMinus) / denom;
    });

    theta = theta.map((value, index) => clamp(value - aT * gradient[index], 0, 1));

    onProgress({ step: step + 1, bestScore });
  }

  return { bestParams, bestScore, bestEvaluation };
}
