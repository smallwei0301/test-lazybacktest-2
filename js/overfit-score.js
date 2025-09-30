(function (global) {
  const namespace = global.lazybacktestOverfit || (global.lazybacktestOverfit = {});
  const OVERFIT_VERSION = 'LB-OVERFIT-SCORING-20250915A';

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const finite = values.filter(isFiniteNumber);
    if (finite.length === 0) {
      return null;
    }
    const sum = finite.reduce((acc, value) => acc + value, 0);
    return sum / finite.length;
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

  function percentile(values, q) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const finite = values.filter(isFiniteNumber).sort((a, b) => a - b);
    if (finite.length === 0) {
      return null;
    }
    const clampedQ = Math.min(Math.max(q, 0), 1);
    const position = clampedQ * (finite.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) {
      return finite[lowerIndex];
    }
    const weight = position - lowerIndex;
    return finite[lowerIndex] * (1 - weight) + finite[upperIndex] * weight;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeWeights(weights) {
    const defaults = { pbo: 0.5, dsr: 0.25, island: 0.25 };
    const raw = Object.assign({}, defaults, weights || {});
    const sanitized = {
      pbo: isFiniteNumber(raw.pbo) && raw.pbo >= 0 ? raw.pbo : defaults.pbo,
      dsr: isFiniteNumber(raw.dsr) && raw.dsr >= 0 ? raw.dsr : defaults.dsr,
      island: isFiniteNumber(raw.island) && raw.island >= 0 ? raw.island : defaults.island,
    };
    const sum = sanitized.pbo + sanitized.dsr + sanitized.island;
    if (sum <= 0) {
      return defaults;
    }
    return {
      pbo: sanitized.pbo / sum,
      dsr: sanitized.dsr / sum,
      island: sanitized.island / sum,
    };
  }

  function computeDailyReturnsFromResult(result) {
    const series = [];
    if (!result || !Array.isArray(result.strategyReturns)) {
      return series;
    }
    const cumulative = result.strategyReturns;
    let previousGross = null;
    for (let i = 0; i < cumulative.length; i += 1) {
      const rawValue = cumulative[i];
      if (!isFiniteNumber(rawValue)) {
        continue;
      }
      const gross = 1 + rawValue / 100;
      if (gross <= 0) {
        continue;
      }
      if (previousGross !== null) {
        const dailyReturn = gross / previousGross - 1;
        if (isFiniteNumber(dailyReturn)) {
          series.push(dailyReturn);
        }
      }
      previousGross = gross;
    }
    return series;
  }

  function computeBlockCandidate(length, requested) {
    if (!Number.isInteger(length) || length < 2) {
      return 0;
    }
    let block = Number.isInteger(requested) && requested > 0 ? requested : 10;
    block = Math.min(block, length);
    if (block % 2 !== 0) {
      block -= 1;
    }
    if (block < 2) {
      block = length - (length % 2);
    }
    while (block > 2 && length / block < 1) {
      block -= 2;
    }
    if (block % 2 !== 0) {
      block -= 1;
    }
    if (block < 2 || block > length) {
      return 0;
    }
    return block;
  }

  function computeBlockMetrics(dailyReturns, blockCount, metricType) {
    const metrics = [];
    if (!Array.isArray(dailyReturns) || blockCount <= 0) {
      return metrics;
    }
    const length = dailyReturns.length;
    if (length < blockCount) {
      return Array(blockCount).fill(NaN);
    }
    const baseSize = Math.floor(length / blockCount);
    const remainder = length % blockCount;
    let index = 0;
    for (let block = 0; block < blockCount; block += 1) {
      const blockSize = baseSize + (block < remainder ? 1 : 0);
      const slice = dailyReturns.slice(index, index + blockSize);
      index += blockSize;
      if (slice.length === 0) {
        metrics.push(NaN);
        continue;
      }
      if (metricType === 'return') {
        let gross = 1;
        for (let i = 0; i < slice.length; i += 1) {
          gross *= 1 + slice[i];
        }
        metrics.push(gross - 1);
      } else {
        const avg = slice.reduce((acc, value) => acc + value, 0) / slice.length;
        const variance = slice.reduce((acc, value) => acc + (value - avg) ** 2, 0) /
          (slice.length > 1 ? slice.length - 1 : 1);
        const std = Math.sqrt(Math.max(variance, 0));
        const dailySharpe = std > 0 ? avg / std : 0;
        metrics.push(dailySharpe * Math.sqrt(252));
      }
    }
    return metrics;
  }

  function buildGrid(buyStrategies, sellStrategies, perResult, perConfigStats, results) {
    const buyList = Array.isArray(buyStrategies) ? buyStrategies : [];
    const sellList = Array.isArray(sellStrategies) ? sellStrategies : [];
    if (buyList.length === 0 || sellList.length === 0) {
      return [];
    }
    const grid = buyList.map(() => Array(sellList.length).fill(null));
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (!result || !result.gridPosition) {
        continue;
      }
      const { buyIndex, sellIndex } = result.gridPosition;
      if (!Number.isInteger(buyIndex) || !Number.isInteger(sellIndex)) {
        continue;
      }
      if (buyIndex < 0 || buyIndex >= buyList.length || sellIndex < 0 || sellIndex >= sellList.length) {
        continue;
      }
      const stats = perConfigStats && perConfigStats[i] ? perConfigStats[i] : null;
      const cellValue = stats && isFiniteNumber(stats.medianTestMetric) ? stats.medianTestMetric : null;
      const failureProbability = stats && isFiniteNumber(stats.failureProbability)
        ? stats.failureProbability
        : null;
      if (cellValue === null) {
        continue;
      }
      const existing = grid[buyIndex][sellIndex];
      if (!existing || !isFiniteNumber(existing.value) || cellValue > existing.value) {
        grid[buyIndex][sellIndex] = {
          value: cellValue,
          index: i,
          pbo: failureProbability,
        };
      }
    }
    return grid;
  }

  function resetOverfitFields(results) {
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (!result) {
        continue;
      }
      result.overfitScore = null;
      result.pboProbability = null;
      result.dsr = null;
      result.islandScore = null;
      result.overfitDiagnostics = {
        version: OVERFIT_VERSION,
        blockCount: 0,
        metricType: null,
        blockMetrics: [],
        dailyReturnSample: 0,
        pbo: null,
        dsr: null,
        island: null,
        weights: null,
        islandQuantile: null,
      };
    }
  }

  function evaluateBatchResults(context) {
    const results = Array.isArray(context?.results) ? context.results : [];
    if (results.length === 0) {
      return null;
    }
    resetOverfitFields(results);

    const config = context?.config || {};
    const overfitSettings = config.overfitSettings || {};
    const requestedBlockCount = Number.isInteger(overfitSettings.blockCount)
      ? overfitSettings.blockCount
      : 10;
    const metricType = overfitSettings.metric === 'return' ? 'return' : 'sharpe';
    const islandQuantile = clamp(
      isFiniteNumber(overfitSettings.islandQuantile) ? overfitSettings.islandQuantile : 0.75,
      0.5,
      0.95,
    );
    const weights = normalizeWeights(overfitSettings.weights);

    const perResultData = results.map((result) => {
      const dailyReturns = computeDailyReturnsFromResult(result);
      const blockCandidate = computeBlockCandidate(dailyReturns.length, requestedBlockCount);
      return {
        dailyReturns,
        blockCandidate,
        blockMetrics: [],
        pboStats: null,
        dsrStats: null,
        islandInfo: null,
      };
    });

    const viableBlocks = perResultData
      .map((data) => data.blockCandidate)
      .filter((value) => Number.isInteger(value) && value >= 2);

    if (viableBlocks.length === 0) {
      return null;
    }

    const effectiveBlockCount = Math.min(...viableBlocks);
    if (!Number.isInteger(effectiveBlockCount) || effectiveBlockCount < 2) {
      return null;
    }

    perResultData.forEach((data) => {
      data.blockMetrics = computeBlockMetrics(data.dailyReturns, effectiveBlockCount, metricType);
    });

    const performanceMatrix = perResultData.map((data) => data.blockMetrics);
    const pboResult = typeof namespace.computeCSCVPBO === 'function'
      ? namespace.computeCSCVPBO(performanceMatrix, {
        blockCount: effectiveBlockCount,
        aggregate: (values) => {
          const avg = mean(values);
          return avg !== null ? avg : NaN;
        },
        direction: 'higher',
      })
      : null;

    const perConfigStats = pboResult && Array.isArray(pboResult.perConfig)
      ? pboResult.perConfig
      : [];

    perResultData.forEach((data, index) => {
      data.pboStats = perConfigStats[index] || null;
      if (typeof namespace.computeDSR === 'function') {
        data.dsrStats = namespace.computeDSR(data.dailyReturns, { numTrials: results.length });
      }
    });

    const buyStrategies = context?.buyStrategies || [];
    const sellStrategies = context?.sellStrategies || [];
    const islandResult = typeof namespace.detectIslands === 'function'
      ? namespace.detectIslands(
        buildGrid(buyStrategies, sellStrategies, perResultData, perConfigStats, results),
        {
          quantile: islandQuantile,
          alpha: 0.5,
          beta: 0.5,
          gamma: 1,
          minArea: 3,
        },
      )
      : null;

    const membership = islandResult?.membership || {};
    const scores = [];
    const dsrValues = [];

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const data = perResultData[i];
      if (!result || !data) {
        continue;
      }
      const pboStats = data.pboStats;
      const failureProbability = pboStats && isFiniteNumber(pboStats.failureProbability)
        ? clamp(pboStats.failureProbability, 0, 1)
        : null;
      const dsrValue = data.dsrStats && isFiniteNumber(data.dsrStats.dsr)
        ? clamp(data.dsrStats.dsr, 0, 1)
        : null;
      const islandData = membership[i] || null;
      const islandScore = islandData && isFiniteNumber(islandData.normalizedScore)
        ? clamp(islandData.normalizedScore, 0, 1)
        : 0;

      const pboPenalty = weights.pbo * (failureProbability !== null ? failureProbability * 100 : 100);
      const dsrPenalty = weights.dsr * (
        dsrValue !== null ? Math.max(0, 50 - dsrValue * 50) : 50
      );
      const islandPenalty = weights.island * (50 - islandScore * 50);
      const overfitScore = clamp(100 - pboPenalty - dsrPenalty - islandPenalty, 0, 100);

      result.overfitScore = overfitScore;
      result.pboProbability = failureProbability;
      result.dsr = dsrValue;
      result.islandScore = islandScore;
      result.overfitDiagnostics = {
        version: OVERFIT_VERSION,
        blockCount: effectiveBlockCount,
        metricType,
        blockMetrics: data.blockMetrics,
        dailyReturnSample: data.dailyReturns.length,
        pbo: pboStats,
        dsr: data.dsrStats,
        island: islandData,
        weights,
        islandQuantile,
      };

      if (isFiniteNumber(overfitScore)) {
        scores.push(overfitScore);
      }
      if (isFiniteNumber(dsrValue)) {
        dsrValues.push(dsrValue);
      }
    }

    const topCandidates = results
      .map((result, index) => ({ index, score: result && isFiniteNumber(result.overfitScore) ? result.overfitScore : -Infinity }))
      .filter((entry) => entry.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const topScores = topCandidates.map((entry) => {
      const result = results[entry.index];
      return {
        index: entry.index,
        buyStrategy: result?.buyStrategy || null,
        sellStrategy: result?.sellStrategy || null,
        score: result?.overfitScore || null,
        pbo: result?.pboProbability || null,
        dsr: result?.dsr || null,
        island: result?.islandScore || null,
      };
    });

    const lambdaSamples = pboResult?.lambdaSamples || [];
    const lambdaMedian = median(lambdaSamples);
    const lambdaNegativeShare = lambdaSamples.length > 0
      ? lambdaSamples.filter((value) => value < 0).length / lambdaSamples.length
      : null;

    const bestIsland = islandResult && Array.isArray(islandResult.islands)
      ? islandResult.islands.slice().sort((a, b) => (b.normalizedScore || 0) - (a.normalizedScore || 0))[0] || null
      : null;

    return {
      version: OVERFIT_VERSION,
      blockCount: effectiveBlockCount,
      metricType,
      weights,
      islandQuantile,
      combinations: results.length,
      pbo: {
        version: namespace.constants?.PBO_VERSION || null,
        value: pboResult?.pbo ?? null,
        lambdaMedian,
        lambdaNegativeShare,
        lambdaSamples,
      },
      dsr: {
        version: namespace.constants?.DSR_VERSION || null,
        median: median(dsrValues),
        average: mean(dsrValues),
        min: dsrValues.length > 0 ? Math.min(...dsrValues) : null,
        max: dsrValues.length > 0 ? Math.max(...dsrValues) : null,
        sampleSize: dsrValues.length,
      },
      islands: {
        version: namespace.constants?.ISLAND_VERSION || null,
        summary: islandResult,
        topIsland: bestIsland,
      },
      scoreStats: {
        average: mean(scores),
        percentile75: percentile(scores, 0.75),
        min: scores.length > 0 ? Math.min(...scores) : null,
        max: scores.length > 0 ? Math.max(...scores) : null,
      },
      topScores,
    };
  }

  namespace.evaluateBatchResults = evaluateBatchResults;
  namespace.constants = namespace.constants || {};
  namespace.constants.OVERFIT_VERSION = OVERFIT_VERSION;
})(typeof window !== 'undefined' ? window : self);
