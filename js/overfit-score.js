(function (root) {
  const globalScope = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const namespace = globalScope.lazybacktestDiagnostics = globalScope.lazybacktestDiagnostics || {};
  const OVERFIT_SCORE_VERSION = "LB-OVERFIT-SCORE-20251120A";

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function computeOverfitScore(metrics = {}, weights = {}) {
    const pbo = Number.isFinite(metrics.pbo) ? clamp(metrics.pbo, 0, 1) : null;
    const dsr = Number.isFinite(metrics.dsr) ? clamp(metrics.dsr, 0, 1) : null;
    const islandScore = Number.isFinite(metrics.islandScore) ? clamp(metrics.islandScore, 0, 1) : null;

    const defaultWeights = {
      pbo: 0.6,
      dsr: 0.2,
      island: 0.2,
    };

    const activeKeys = [];
    if (pbo !== null) activeKeys.push("pbo");
    if (dsr !== null) activeKeys.push("dsr");
    if (islandScore !== null) activeKeys.push("island");

    if (activeKeys.length === 0) {
      return {
        version: OVERFIT_SCORE_VERSION,
        score: null,
        weights: {},
        penalties: {},
      };
    }

    const resolvedWeights = {};
    let totalWeight = 0;
    for (const key of activeKeys) {
      const provided = Number.isFinite(weights[key]) ? weights[key] : defaultWeights[key];
      const weight = Number.isFinite(provided) && provided > 0 ? provided : defaultWeights[key] || 1;
      resolvedWeights[key] = weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0) totalWeight = activeKeys.length;

    const normalizedWeights = {};
    for (const key of activeKeys) {
      normalizedWeights[key] = resolvedWeights[key] / totalWeight;
    }

    const penalties = {};
    if (pbo !== null) {
      penalties.pbo = pbo;
    }
    if (dsr !== null) {
      penalties.dsr = 1 - dsr;
    }
    if (islandScore !== null) {
      penalties.island = 1 - islandScore;
    }

    let weightedPenalty = 0;
    for (const key of activeKeys) {
      const penalty = Number.isFinite(penalties[key]) ? clamp(penalties[key], 0, 1) : 0;
      weightedPenalty += penalty * normalizedWeights[key];
    }

    const score = clamp(100 * (1 - weightedPenalty), 0, 100);

    return {
      version: OVERFIT_SCORE_VERSION,
      score,
      weights: normalizedWeights,
      penalties,
    };
  }

  namespace.computeOverfitScore = computeOverfitScore;
  namespace.overfitScoreVersion = OVERFIT_SCORE_VERSION;
})(typeof self !== "undefined" ? self : this);
