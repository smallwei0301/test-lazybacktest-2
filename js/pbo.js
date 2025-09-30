(function (root) {
  const globalScope = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const namespace = globalScope.lazybacktestDiagnostics = globalScope.lazybacktestDiagnostics || {};
  const CSCV_VERSION = "LB-PBO-METRIC-20251120A";

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function average(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const value of values) {
      if (Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    if (count === 0) return null;
    return sum / count;
  }

  function median(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const numeric = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (numeric.length === 0) return null;
    const mid = Math.floor(numeric.length / 2);
    if (numeric.length % 2 === 0) {
      return (numeric[mid - 1] + numeric[mid]) / 2;
    }
    return numeric[mid];
  }

  function percentile(values, percentileRank) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const clampedPercentile = clamp(percentileRank, 0, 1);
    if (clampedPercentile === 0) return sorted[0];
    if (clampedPercentile === 1) return sorted[sorted.length - 1];
    const index = clampedPercentile * (sorted.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;
    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
  }

  function enumerateHalfSplits(blockCount) {
    const half = blockCount / 2;
    const splits = [];
    const current = [];

    function backtrack(start) {
      if (current.length === half) {
        const inSample = current.slice();
        const mask = new Array(blockCount).fill(false);
        for (const index of inSample) {
          mask[index] = true;
        }
        const outOfSample = [];
        for (let i = 0; i < blockCount; i += 1) {
          if (!mask[i]) {
            outOfSample.push(i);
          }
        }
        splits.push({ isSet: inSample, oosSet: outOfSample });
        return;
      }
      for (let i = start; i <= blockCount - (half - current.length); i += 1) {
        current.push(i);
        backtrack(i + 1);
        current.pop();
      }
    }

    backtrack(0);
    return splits;
  }

  function gatherValuesByIndices(row, indices) {
    if (!Array.isArray(row) || !Array.isArray(indices)) return [];
    const values = [];
    for (const index of indices) {
      const value = row[index];
      if (Number.isFinite(value)) {
        values.push(value);
      }
    }
    return values;
  }

  function computeQuantile(sortedValues, value) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
    if (!Number.isFinite(value)) return null;
    let lowerCount = 0;
    let equalCount = 0;
    for (const current of sortedValues) {
      if (current < value) {
        lowerCount += 1;
      } else if (current === value) {
        equalCount += 1;
      }
    }
    if (equalCount === 0) {
      equalCount = 1;
    }
    const averageRank = lowerCount + equalCount / 2;
    const quantile = averageRank / sortedValues.length;
    const epsilon = 1 / (2 * sortedValues.length);
    return clamp(quantile, epsilon, 1 - epsilon);
  }

  function computeCSCVPBO(matrix, options = {}) {
    const method = typeof options.method === "string" ? options.method : "mean";
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return {
        version: CSCV_VERSION,
        pbo: null,
        lambdaSamples: [],
        perConfigOOS: [],
        blockCount: 0,
        totalSplits: 0,
      };
    }

    const blockCount = Array.isArray(matrix[0]) ? matrix[0].length : 0;
    if (!Number.isFinite(blockCount) || blockCount < 2 || blockCount % 2 !== 0) {
      return {
        version: CSCV_VERSION,
        pbo: null,
        lambdaSamples: [],
        perConfigOOS: [],
        blockCount,
        totalSplits: 0,
      };
    }

    const configCount = matrix.length;
    const lambdaSamples = [];
    const perConfigOOSValues = Array.from({ length: configCount }, () => []);
    const splits = enumerateHalfSplits(blockCount);

    for (const split of splits) {
      const { isSet, oosSet } = split;
      if (!Array.isArray(isSet) || !Array.isArray(oosSet)) continue;

      let championIndex = -1;
      let championScore = -Infinity;

      for (let configIndex = 0; configIndex < configCount; configIndex += 1) {
        const row = matrix[configIndex];
        if (!Array.isArray(row) || row.length !== blockCount) continue;

        const inSampleValues = gatherValuesByIndices(row, isSet);
        if (inSampleValues.length === 0) continue;

        let score = null;
        if (method === "median") {
          score = median(inSampleValues);
        } else {
          score = average(inSampleValues);
        }

        if (!Number.isFinite(score)) continue;
        if (score > championScore) {
          championScore = score;
          championIndex = configIndex;
        }
      }

      if (championIndex === -1) continue;

      const oosScores = [];
      for (let configIndex = 0; configIndex < configCount; configIndex += 1) {
        const row = matrix[configIndex];
        const oosValues = gatherValuesByIndices(row, oosSet);
        let oosScore = null;
        if (oosValues.length > 0) {
          if (method === "median") {
            oosScore = median(oosValues);
          } else {
            oosScore = average(oosValues);
          }
        }
        oosScores.push(Number.isFinite(oosScore) ? oosScore : null);
        if (Number.isFinite(oosScore)) {
          perConfigOOSValues[configIndex].push(oosScore);
        }
      }

      const championOOS = oosScores[championIndex];
      const validScores = oosScores.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
      if (!Number.isFinite(championOOS) || validScores.length === 0) continue;

      const quantile = computeQuantile(validScores, championOOS);
      if (!Number.isFinite(quantile) || quantile <= 0 || quantile >= 1) continue;

      const lambda = Math.log(quantile / (1 - quantile));
      if (Number.isFinite(lambda)) {
        lambdaSamples.push(lambda);
      }
    }

    const perConfigOOS = perConfigOOSValues.map((values) => {
      if (!Array.isArray(values) || values.length === 0) {
        return {
          median: null,
          mean: null,
          sampleSize: 0,
          positiveShare: null,
        };
      }
      const sorted = values.slice().sort((a, b) => a - b);
      const medianValue = median(sorted);
      const meanValue = average(sorted);
      const positiveShare = sorted.length > 0
        ? sorted.filter((value) => Number.isFinite(value) && value > 0).length / sorted.length
        : null;
      return {
        median: Number.isFinite(medianValue) ? medianValue : null,
        mean: Number.isFinite(meanValue) ? meanValue : null,
        sampleSize: sorted.length,
        positiveShare: Number.isFinite(positiveShare) ? positiveShare : null,
      };
    });

    const lambdaCount = lambdaSamples.length;
    const negativeLambda = lambdaSamples.filter((lambda) => Number.isFinite(lambda) && lambda < 0).length;
    const pboValue = lambdaCount > 0 ? negativeLambda / lambdaCount : null;

    return {
      version: CSCV_VERSION,
      pbo: Number.isFinite(pboValue) ? clamp(pboValue, 0, 1) : null,
      lambdaSamples,
      perConfigOOS,
      blockCount,
      totalSplits: splits.length,
    };
  }

  namespace.computeCSCVPBO = computeCSCVPBO;
  namespace.cscvVersion = CSCV_VERSION;
  namespace.computeCSCVPBOPercentile = percentile;
})(typeof self !== "undefined" ? self : this);
