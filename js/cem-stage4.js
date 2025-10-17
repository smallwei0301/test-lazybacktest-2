// --- 第四階段局部微調：CEM Runner ---
// Patch Tag: LB-STAGE4-REFINE-20251005A
(function(global) {
  const stage4Namespace = global.Stage4Modules || (global.Stage4Modules = {});
  const helpers = stage4Namespace.helpers || createStage4Helpers(global);
  stage4Namespace.helpers = helpers;
  if (typeof helpers.randomGaussian !== 'function') {
    helpers.randomGaussian = function(mean, std) {
      const u1 = Math.random() || 1e-9;
      const u2 = Math.random() || 1e-9;
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z0 * std;
    };
  }

  function ensureExecutor() {
    const exec = helpers.getExecutor();
    if (typeof exec !== 'function') {
      console.warn('[Stage4][CEM] executeBacktestForCombination not available');
      return null;
    }
    return exec;
  }

  async function runStage4CEM(options = {}) {
    const {
      startCombo,
      iters = 10,
      popSize = 40,
      eliteRatio = 0.2,
      initSigma = 0.15,
      onProgress
    } = options;

    if (!startCombo || typeof startCombo !== 'object') {
      console.warn('[Stage4][CEM] startCombo is required');
      return null;
    }

    const executor = ensureExecutor();
    if (!executor) return null;

    const metas = helpers.collectNumericMetas(startCombo);
    if (metas.length === 0) {
      const combo = helpers.cloneCombo(startCombo);
      helpers.applyConstraints(combo, metas);
      const result = await executor(combo);
      return { bestCombo: combo, bestResult: result };
    }

    const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));
    const means = metas.map((meta) => helpers.clamp01(meta.getNormalized(startCombo)));
    const sigmas = metas.map(() => Math.max(0.02, initSigma));

    let bestCombo = helpers.cloneCombo(startCombo);
    helpers.applyConstraints(bestCombo, metas);
    let bestResult = await executor(bestCombo);
    let bestScore = helpers.scoreFromResult(bestResult);
    if (!Number.isFinite(bestScore)) bestScore = -Infinity;

    for (let iter = 0; iter < iters; iter++) {
      const samples = [];
      for (let i = 0; i < popSize; i++) {
        const normalizedVector = means.map((mean, idx) => {
          const sigma = sigmas[idx];
          const sample = helpers.randomGaussian(mean, sigma);
          return helpers.clamp01(sample);
        });

        const candidateCombo = helpers.cloneCombo(startCombo);
        metas.forEach((meta, idx) => {
          meta.setNormalized(candidateCombo, normalizedVector[idx]);
        });
        helpers.applyConstraints(candidateCombo, metas);

        const result = await executor(candidateCombo);
        const score = helpers.scoreFromResult(result);
        samples.push({ combo: candidateCombo, result, score, normalized: normalizedVector });

        if (Number.isFinite(score) && score > bestScore) {
          bestCombo = helpers.cloneCombo(candidateCombo);
          bestResult = result;
          bestScore = score;
        }
      }

      samples.sort((a, b) => (Number.isFinite(b.score) ? b.score : -Infinity) - (Number.isFinite(a.score) ? a.score : -Infinity));
      const elites = samples.slice(0, eliteCount);

      metas.forEach((meta, idx) => {
        const eliteValues = elites.map(sample => sample.normalized[idx]);
        const meanValue = eliteValues.reduce((sum, val) => sum + val, 0) / eliteValues.length;
        const variance = eliteValues.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0) / eliteValues.length;
        const stdDev = Math.sqrt(Math.max(variance, 1e-6));
        const blendedSigma = (0.75 * sigmas[idx]) + (0.25 * stdDev);
        means[idx] = helpers.clamp01(meanValue);
        sigmas[idx] = Math.min(0.5, Math.max(0.02, blendedSigma * 0.9));
      });

      if (typeof onProgress === 'function') {
        try {
          onProgress({
            method: 'cem',
            iteration: iter + 1,
            total: iters,
            bestScore,
            currentMean: means.slice(),
            currentSigma: sigmas.slice()
          });
        } catch (err) {
          console.warn('[Stage4][CEM] onProgress callback error:', err);
        }
      }
    }

    if (!bestResult) {
      const fallbackCombo = helpers.cloneCombo(startCombo);
      helpers.applyConstraints(fallbackCombo, metas);
      bestResult = await executor(fallbackCombo);
      bestCombo = fallbackCombo;
    }

    return {
      bestCombo,
      bestResult
    };
  }

  stage4Namespace.runStage4CEM = runStage4CEM;

  function createStage4Helpers(globalScope) {
    if (globalScope.Stage4Modules && globalScope.Stage4Modules.helpers) {
      return globalScope.Stage4Modules.helpers;
    }

    const baseHelpers = {};

    function cloneCombo(combo) {
      if (!combo || typeof combo !== 'object') return {};
      return JSON.parse(JSON.stringify(combo));
    }

    function clampNumber(value, min, max) {
      if (!Number.isFinite(value)) return Number.isFinite(min) ? min : 0;
      let out = value;
      if (Number.isFinite(min)) out = Math.max(out, min);
      if (Number.isFinite(max)) out = Math.min(out, max);
      return out;
    }

    function clamp01(value) {
      if (!Number.isFinite(value)) return 0.5;
      return Math.min(1, Math.max(0, value));
    }

    function toFixedNumber(value, precision = 6) {
      if (!Number.isFinite(value)) return value;
      const factor = Math.pow(10, precision);
      return Math.round(value * factor) / factor;
    }

    function getExecutor() {
      const ctx = globalScope.batchOptimizationStage4 || {};
      if (typeof ctx.executeBacktestForCombination === 'function') {
        return ctx.executeBacktestForCombination;
      }
      if (typeof globalScope.executeBacktestForCombination === 'function') {
        return globalScope.executeBacktestForCombination;
      }
      return null;
    }

    function getParamRange(strategyName, key) {
      if (!strategyName || !key) return null;
      const desc = globalScope.strategyDescriptions?.[strategyName];
      if (!desc || !Array.isArray(desc.optimizeTargets)) return null;
      return desc.optimizeTargets.find(target => target.name === key)?.range || null;
    }

    function computeBounds(value, range) {
      let min = Number.isFinite(range?.from) ? range.from : null;
      let max = Number.isFinite(range?.to) ? range.to : null;
      if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
        const base = Number.isFinite(value) ? value : 0;
        const span = Math.max(Math.abs(base) * 0.6, 1);
        min = base - span;
        max = base + span;
      }
      if (min === max) {
        min -= 1;
        max += 1;
      }
      if (min > max) {
        const mid = (min + max) / 2;
        min = mid - 1;
        max = mid + 1;
      }
      return { min, max };
    }

    function createQuantizer(range) {
      if (!range || !Number.isFinite(range.step) || range.step <= 0) return null;
      const step = range.step;
      const base = Number.isFinite(range.from) ? range.from : 0;
      return function(value) {
        if (!Number.isFinite(value)) return value;
        const steps = Math.round((value - base) / step);
        return base + steps * step;
      };
    }

    function getNestedValue(obj, path) {
      return path.reduce((acc, key) => (acc && typeof acc === 'object') ? acc[key] : undefined, obj);
    }

    function setNestedValue(obj, path, value) {
      if (!path.length) return;
      let target = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }
      target[path[path.length - 1]] = value;
    }

    function normalizeValue(value, bounds) {
      if (!Number.isFinite(value)) return 0.5;
      const span = bounds.max - bounds.min;
      if (!Number.isFinite(span) || span === 0) return 0.5;
      return clamp01((value - bounds.min) / span);
    }

    function denormalizeValue(normalized, bounds) {
      const span = bounds.max - bounds.min;
      if (!Number.isFinite(span) || span === 0) return bounds.min || 0;
      return bounds.min + normalized * span;
    }

    function createMeta(strategyName, key, path, baseValue) {
      const range = getParamRange(strategyName, key);
      const bounds = computeBounds(baseValue, range);
      const quantize = createQuantizer(range);
      return {
        strategyName,
        key,
        path,
        bounds,
        range,
        quantize,
        getValue(combo) {
          return getNestedValue(combo, path);
        },
        setValue(combo, value) {
          setNestedValue(combo, path, value);
        },
        getNormalized(combo) {
          const val = this.getValue(combo);
          return normalizeValue(val, bounds);
        },
        setNormalized(combo, normalized) {
          let actual = denormalizeValue(normalized, bounds);
          actual = clampNumber(actual, bounds.min, bounds.max);
          if (typeof quantize === 'function') {
            actual = quantize(actual);
          }
          actual = toFixedNumber(actual);
          this.setValue(combo, actual);
        }
      };
    }

    function collectNumericMetas(combo) {
      const metas = [];
      if (!combo || typeof combo !== 'object') return metas;

      const addParamSet = (params, strategyName, rootKey) => {
        if (!params || typeof params !== 'object') return;
        Object.keys(params).forEach((key) => {
          const value = params[key];
          if (typeof value !== 'number' || !Number.isFinite(value)) return;
          metas.push(createMeta(strategyName, key, [rootKey, key], value));
        });
      };

      addParamSet(combo.buyParams, combo.buyStrategy, 'buyParams');
      addParamSet(combo.sellParams, combo.sellStrategy, 'sellParams');
      if (combo.riskManagement && typeof combo.riskManagement === 'object') {
        Object.keys(combo.riskManagement).forEach((key) => {
          const value = combo.riskManagement[key];
          if (typeof value !== 'number' || !Number.isFinite(value)) return;
          metas.push(createMeta('riskManagement', key, ['riskManagement', key], value));
        });
      }

      return metas;
    }

    function clampComboToBounds(combo, metas) {
      if (!Array.isArray(metas)) return;
      metas.forEach((meta) => {
        const value = meta.getValue(combo);
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        let adjusted = clampNumber(value, meta.bounds.min, meta.bounds.max);
        if (typeof meta.quantize === 'function') {
          adjusted = meta.quantize(adjusted);
        }
        adjusted = toFixedNumber(adjusted);
        meta.setValue(combo, adjusted);
      });
    }

    function applyStrategyConstraints(strategyName, params) {
      if (!params || typeof params !== 'object') return;
      const lowerKeys = Object.keys(params);
      lowerKeys.forEach((key) => {
        const value = params[key];
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        if (/period|window|length|bars|days/i.test(key)) {
          params[key] = Math.max(1, value);
        }
        if (/deviation|deviations|multiplier/i.test(key)) {
          params[key] = Math.max(0.01, value);
        }
        if (/threshold/i.test(key)) {
          params[key] = clampNumber(value, -120, 120);
        }
      });

      if (params.shortPeriod !== undefined && params.longPeriod !== undefined) {
        if (params.shortPeriod >= params.longPeriod) {
          const gap = 1;
          params.longPeriod = Math.max(params.shortPeriod + gap, params.longPeriod);
        }
        params.shortPeriod = Math.max(1, params.shortPeriod);
        params.longPeriod = Math.max(params.shortPeriod + 1, params.longPeriod);
      }

      if (params.signalPeriod !== undefined) {
        params.signalPeriod = Math.max(1, params.signalPeriod);
      }
    }

    function applyRiskConstraints(risk) {
      if (!risk || typeof risk !== 'object') return;
      Object.keys(risk).forEach((key) => {
        const value = risk[key];
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        risk[key] = Math.max(0, value);
      });
    }

    function applyConstraints(combo, metas) {
      if (!combo || typeof combo !== 'object') return combo;
      clampComboToBounds(combo, metas);
      applyStrategyConstraints(combo.buyStrategy, combo.buyParams);
      applyStrategyConstraints(combo.sellStrategy, combo.sellParams);
      applyRiskConstraints(combo.riskManagement);
      clampComboToBounds(combo, metas);
      return combo;
    }

    function scoreFromResult(result) {
      if (!result || typeof result !== 'object') return -Infinity;
      const candidates = [
        result.annualizedReturn,
        result.finalAnnualReturn,
        result.totalReturn,
        result.totalReturnPct,
        result.cumulativeReturn,
        result.profitFactor
      ];
      for (let i = 0; i < candidates.length; i++) {
        if (Number.isFinite(candidates[i])) return candidates[i];
      }
      return -Infinity;
    }

    function randomGaussian(mean, std) {
      const u1 = Math.random() || 1e-9;
      const u2 = Math.random() || 1e-9;
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z0 * std;
    }

    Object.assign(baseHelpers, {
      version: 'LB-STAGE4-REFINE-20251005A',
      cloneCombo,
      clamp01,
      collectNumericMetas,
      applyConstraints,
      clampComboToBounds,
      scoreFromResult,
      getExecutor,
      toFixedNumber,
      randomGaussian
    });

    return baseHelpers;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
