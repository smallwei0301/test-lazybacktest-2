(function (global) {
  const namespace = global.lazybacktestOverfit || (global.lazybacktestOverfit = {});
  const PBO_VERSION = 'LB-OVERFIT-SCORING-20250915A';

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const finite = values.filter(isFiniteNumber);
    if (finite.length === 0) {
      return null;
    }
    const total = finite.reduce((sum, value) => sum + value, 0);
    return total / finite.length;
  }

  function median(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const finite = values.filter(isFiniteNumber).sort((a, b) => a - b);
    if (finite.length === 0) {
      return null;
    }
    const mid = Math.floor(finite.length / 2);
    if (finite.length % 2 === 0) {
      return (finite[mid - 1] + finite[mid]) / 2;
    }
    return finite[mid];
  }

  function generateIndexCombinations(length, subsetSize) {
    const results = [];
    if (!Number.isInteger(length) || length <= 0 || !Number.isInteger(subsetSize) || subsetSize <= 0 || subsetSize > length) {
      return results;
    }
    const combo = Array(subsetSize).fill(0);
    function backtrack(start, depth) {
      if (depth === subsetSize) {
        results.push(combo.slice());
        return;
      }
      for (let i = start; i <= length - (subsetSize - depth); i += 1) {
        combo[depth] = i;
        backtrack(i + 1, depth + 1);
      }
    }
    backtrack(0, 0);
    return results;
  }

  function aggregateSubset(row, indices, aggregator) {
    if (!Array.isArray(row) || !Array.isArray(indices) || typeof aggregator !== 'function') {
      return null;
    }
    const values = [];
    for (let i = 0; i < indices.length; i += 1) {
      const idx = indices[i];
      if (idx >= 0 && idx < row.length && isFiniteNumber(row[idx])) {
        values.push(row[idx]);
      }
    }
    if (values.length === 0) {
      return null;
    }
    return aggregator(values);
  }

  function computeRanks(metrics, higherIsBetter) {
    const entries = metrics
      .map((value, index) => ({ value, index }))
      .filter((entry) => isFiniteNumber(entry.value));
    if (entries.length === 0) {
      return { ranks: new Map(), median: null };
    }
    entries.sort((a, b) => {
      if (higherIsBetter) {
        return b.value - a.value;
      }
      return a.value - b.value;
    });
    const ranks = new Map();
    let currentRank = 1;
    let i = 0;
    while (i < entries.length) {
      let j = i + 1;
      while (j < entries.length && Math.abs(entries[j].value - entries[i].value) <= 1e-9) {
        j += 1;
      }
      const groupSize = j - i;
      const averageRank = currentRank + (groupSize - 1) / 2;
      for (let k = i; k < j; k += 1) {
        ranks.set(entries[k].index, averageRank);
      }
      currentRank += groupSize;
      i = j;
    }
    const sortedValues = entries.map((entry) => entry.value).sort((a, b) => a - b);
    const med = median(sortedValues);
    return { ranks, median: med };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function computeCSCVPBO(matrix, options = {}) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return {
        version: PBO_VERSION,
        blockCount: 0,
        combinations: 0,
        partitions: [],
        lambdaSamples: [],
        pbo: null,
        perConfig: [],
      };
    }

    const combinationsCount = matrix.length;
    const rowLength = Array.isArray(matrix[0]) ? matrix[0].length : 0;
    let blockCount = Number.isInteger(options.blockCount) ? options.blockCount : rowLength;
    blockCount = Math.min(blockCount, rowLength);
    if (blockCount % 2 !== 0) {
      blockCount -= 1;
    }
    if (!Number.isInteger(blockCount) || blockCount < 2) {
      return {
        version: PBO_VERSION,
        blockCount: 0,
        combinations: combinationsCount,
        partitions: [],
        lambdaSamples: [],
        pbo: null,
        perConfig: matrix.map(() => ({
          oosMetrics: [],
          failureProbability: null,
          aboveMedianFraction: null,
          championFrequency: 0,
          medianTestMetric: null,
          meanTestMetric: null,
          averageRank: null,
        })),
      };
    }

    const aggregator = typeof options.aggregate === 'function' ? options.aggregate : mean;
    const higherIsBetter = options.direction !== 'lower';

    const processedMatrix = matrix.map((row) => {
      if (!Array.isArray(row)) {
        return Array(blockCount).fill(null);
      }
      const trimmed = row.slice(0, blockCount);
      return trimmed.map((value) => (isFiniteNumber(value) ? value : null));
    });

    const half = blockCount / 2;
    const trainSplits = generateIndexCombinations(blockCount, half);
    const lambdaSamples = [];
    const partitions = [];

    const perConfigStats = processedMatrix.map(() => ({
      oosMetrics: [],
      aboveMedianCount: 0,
      observationCount: 0,
      championFrequency: 0,
      ranks: [],
    }));

    for (let splitIdx = 0; splitIdx < trainSplits.length; splitIdx += 1) {
      const trainIndices = trainSplits[splitIdx];
      const indexSet = new Set(trainIndices);
      const testIndices = [];
      for (let idx = 0; idx < blockCount; idx += 1) {
        if (!indexSet.has(idx)) {
          testIndices.push(idx);
        }
      }

      const trainMetrics = processedMatrix.map((row) => aggregateSubset(row, trainIndices, aggregator));
      const testMetrics = processedMatrix.map((row) => aggregateSubset(row, testIndices, aggregator));

      let championIndex = -1;
      let championTrainMetric = null;
      for (let k = 0; k < trainMetrics.length; k += 1) {
        const metric = trainMetrics[k];
        if (!isFiniteNumber(metric)) {
          continue;
        }
        if (championIndex === -1) {
          championIndex = k;
          championTrainMetric = metric;
          continue;
        }
        if (higherIsBetter) {
          if (metric > championTrainMetric) {
            championIndex = k;
            championTrainMetric = metric;
          }
        } else if (metric < championTrainMetric) {
          championIndex = k;
          championTrainMetric = metric;
        }
      }

      if (championIndex === -1) {
        continue;
      }

      const championTestMetric = testMetrics[championIndex];
      if (!isFiniteNumber(championTestMetric)) {
        continue;
      }

      const { ranks, median: partitionMedian } = computeRanks(testMetrics, higherIsBetter);
      const finiteTestMetrics = testMetrics.filter(isFiniteNumber);
      if (finiteTestMetrics.length === 0) {
        continue;
      }

      const sortedForRank = finiteTestMetrics.slice().sort((a, b) => a - b);
      let lowerCount = 0;
      let equalCount = 0;
      for (let i = 0; i < sortedForRank.length; i += 1) {
        const value = sortedForRank[i];
        if (Math.abs(value - championTestMetric) <= 1e-9) {
          equalCount += 1;
        } else if (value < championTestMetric) {
          lowerCount += 1;
        }
      }
      const rankPosition = lowerCount + (equalCount > 0 ? (equalCount + 1) / 2 : 0.5);
      const omegaRaw = (rankPosition - 0.5) / finiteTestMetrics.length;
      const omega = clamp(omegaRaw, 1e-4, 1 - 1e-4);
      const lambda = Math.log(omega / (1 - omega));
      lambdaSamples.push(lambda);

      perConfigStats.forEach((stat, configIndex) => {
        const testMetric = testMetrics[configIndex];
        if (isFiniteNumber(testMetric)) {
          stat.oosMetrics.push(testMetric);
          stat.observationCount += 1;
          const rankValue = ranks.get(configIndex);
          if (isFiniteNumber(rankValue)) {
            stat.ranks.push(rankValue);
          }
          if (isFiniteNumber(partitionMedian)) {
            if (higherIsBetter ? testMetric >= partitionMedian : testMetric <= partitionMedian) {
              stat.aboveMedianCount += 1;
            }
          }
        }
      });
      if (perConfigStats[championIndex]) {
        perConfigStats[championIndex].championFrequency += 1;
      }

      partitions.push({
        trainIndices: trainIndices.slice(),
        testIndices,
        championIndex,
        championTrainMetric,
        championTestMetric,
        omega,
        lambda,
        medianTestMetric: partitionMedian,
      });
    }

    const lambdaNegatives = lambdaSamples.filter((value) => value < 0).length;
    const pboValue = lambdaSamples.length > 0 ? lambdaNegatives / lambdaSamples.length : null;

    const perConfig = perConfigStats.map((stat) => {
      const medianMetric = median(stat.oosMetrics);
      return {
        oosMetrics: stat.oosMetrics.slice(),
        failureProbability:
          stat.observationCount > 0
            ? 1 - stat.aboveMedianCount / stat.observationCount
            : null,
        aboveMedianFraction:
          stat.observationCount > 0
            ? stat.aboveMedianCount / stat.observationCount
            : null,
        championFrequency: stat.championFrequency,
        medianTestMetric: medianMetric,
        meanTestMetric: mean(stat.oosMetrics),
        averageRank: stat.ranks.length > 0 ? mean(stat.ranks) : null,
      };
    });

    return {
      version: PBO_VERSION,
      blockCount,
      combinations: combinationsCount,
      partitions,
      lambdaSamples,
      pbo: pboValue,
      perConfig,
    };
  }

  namespace.computeCSCVPBO = computeCSCVPBO;
  namespace.constants = namespace.constants || {};
  namespace.constants.PBO_VERSION = PBO_VERSION;
})(typeof window !== 'undefined' ? window : self);
