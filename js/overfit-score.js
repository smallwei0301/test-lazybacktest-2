/*
 * Overfit Indicator computation module
 * Version: LB-OFI-DUALSCORE-20250930A
 */
(function () {
  const MODULE_VERSION = "LB-OFI-DUALSCORE-20250930A";

  const DEFAULT_CONFIG = {
    desiredSegments: 10,
    minPointsPerSegment: 5,
    aggregator: "median",
    maxCSCVSplits: 1024,
    spaAlpha: 0.1,
    dsrSharpeThreshold: 0,
    dsrLogisticEta: 0.5,
    walkforward: {
      trainWindow: 252,
      testWindow: 63,
      stepSize: 63,
      minimumWindows: 2,
    },
    weights: {
      flow: { pbo: 0.4, len: 0.2, pool: 0.15, spa: 0.15, mcs: 0.1 },
      strategy: { dsrpsr: 0.25, oos: 0.25, wf: 0.25, island: 0.25 },
      ofi: { flow: 0.3, strategy: 0.7 },
    },
    oosAlpha: 0.6,
    flowVerdictThresholds: {
      pass: 70,
      caution: 50,
    },
  };

  const EPSILON = 1e-6;

  function computeOFIForResults(results, options) {
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const config = mergeDeep(DEFAULT_CONFIG, options || {});
    const prepared = prepareResults(results, config);
    const validPrepared = prepared.filter((item) => item.valid);
    if (validPrepared.length < 2) {
      return {
        version: MODULE_VERSION,
        flow: buildEmptyFlowMetrics(),
        strategies: prepared.map((item) => buildEmptyStrategyResult(item.index)),
      };
    }

    const segments = resolveSegments(validPrepared, config);
    if (!segments || segments < 2 || segments % 2 !== 0) {
      return {
        version: MODULE_VERSION,
        flow: buildEmptyFlowMetrics(),
        strategies: prepared.map((item) => buildEmptyStrategyResult(item.index)),
      };
    }

    const cscvMatrix = buildCSCVMatrix(validPrepared, segments, config);
    const cscvSplits = generateCSCVSplits(segments, config.maxCSCVSplits);
    const cscvOutcome = evaluateCSCV(validPrepared, cscvMatrix, cscvSplits, config);

    const flowMetrics = computeFlowScore(validPrepared, cscvOutcome, config);

    computeOOSMetrics(validPrepared, cscvOutcome, config);
    computeWalkForwardMetrics(validPrepared, config);
    computeSignificanceMetrics(validPrepared, config);
    const islandMap = computeIslandScores(validPrepared, config);
    applyIslandScores(validPrepared, islandMap);

    const strategyEvaluations = buildStrategyEvaluations(prepared, validPrepared, flowMetrics, config);

    return {
      version: MODULE_VERSION,
      flow: flowMetrics,
      strategies: strategyEvaluations,
    };
  }

  function buildEmptyFlowMetrics() {
    return {
      RFlow: null,
      flowScore: null,
      RPBO: null,
      RLen: null,
      RPool: null,
      RSPA: null,
      RMCS: null,
      PBO: null,
      lambda: [],
      qValues: [],
      totalSplits: 0,
      validSplits: 0,
      segments: null,
      sampleLength: null,
      sampleLengthLabel: null,
      sampleLengthStatus: null,
      suggestedBlockLength: null,
      strategyPoolSize: null,
      strategyPoolLabel: null,
      flowVerdict: "Flow 指標資料不足",
      flowVerdictStatus: "unknown",
      allowStrategyRanking: false,
      summary: "Flow 指標資料不足",
      recommendations: [],
      version: MODULE_VERSION,
    };
  }

  function buildEmptyStrategyResult(index) {
    return {
      index,
      ofiScore: null,
      verdict: "資料不足",
      components: {
        strategy: null,
        strategyScorePercent: null,
        ROOS: null,
        RWF: null,
        RDSRPSR: null,
        RIsland: null,
        finalOfi: null,
      },
      meta: {
        version: MODULE_VERSION,
        flowVerdict: null,
      },
    };
  }

  function mergeDeep(target, source) {
    const output = Array.isArray(target) ? target.slice() : { ...target };
    if (!source || typeof source !== "object") {
      return output;
    }
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = mergeDeep(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function prepareResults(results, config) {
    return results.map((result, index) => {
      const strategyReturns = Array.isArray(result.strategyReturns)
        ? result.strategyReturns.map((v) => (Number.isFinite(Number(v)) ? Number(v) : null))
        : [];
      const initialCapital = Number.isFinite(Number(result.initialCapital))
        ? Number(result.initialCapital)
        : 100000;
      const dailyReturns = computeDailyReturnsFromCumulative(strategyReturns, initialCapital);
      const valid = Array.isArray(dailyReturns) && dailyReturns.length >= config.desiredSegments;
      return {
        index,
        valid,
        dailyReturns,
        initialCapital,
        buyStrategy: result.buyStrategy || null,
        sellStrategy: result.sellStrategy || null,
        buyParams: cloneNumericParams(result.buyParams),
        sellParams: cloneNumericParams(result.sellParams),
        rawResult: result,
        oosValues: [],
        isValues: [],
        cscvSegments: [],
        oosMedian: null,
        oosIQR: null,
        oosScore: null,
        wfWinRate: null,
        wfAverageReturn: null,
        wfScore: null,
        psr: extractNumericField(result, ["psr", "PSR", "psrScore", "psrProbability"]),
        dsr: extractNumericField(result, ["dsr", "DSR", "dsrScore"]),
        dsrScore: null,
        dsrpsrScore: null,
        islandScore: null,
        strategyScore: null,
        finalOFI: null,
        verdict: null,
        components: {},
      };
    });
  }

  function cloneNumericParams(params) {
    if (!params || typeof params !== "object") return {};
    const clone = {};
    Object.keys(params).forEach((key) => {
      const value = Number(params[key]);
      if (Number.isFinite(value)) {
        clone[key] = value;
      }
    });
    return clone;
  }

  function extractNumericField(target, keys) {
    if (!target || typeof target !== "object") return null;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        const value = Number(target[key]);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return null;
  }

  function computeDailyReturnsFromCumulative(cumulative, initialCapital) {
    if (!Array.isArray(cumulative) || cumulative.length < 2) {
      return [];
    }
    const baseCapital = Number.isFinite(initialCapital) && initialCapital > EPSILON ? initialCapital : 100000;
    const valueSeries = cumulative.map((value) => {
      if (!Number.isFinite(value)) return null;
      return baseCapital * (1 + value / 100);
    });
    const returns = [];
    let prevValue = null;
    for (let i = 0; i < valueSeries.length; i += 1) {
      const current = valueSeries[i];
      if (!Number.isFinite(current)) {
        prevValue = null;
        continue;
      }
      if (prevValue !== null && Math.abs(prevValue) > EPSILON) {
        const r = current / prevValue - 1;
        if (Number.isFinite(r)) {
          returns.push(r);
        }
      }
      prevValue = current;
    }
    return returns;
  }

  function resolveSegments(prepared, config) {
    const lengths = prepared
      .map((item) => (Array.isArray(item.dailyReturns) ? item.dailyReturns.length : 0))
      .filter((len) => len > 0);
    if (lengths.length === 0) {
      return null;
    }
    const minLength = Math.min.apply(null, lengths);
    let segments = config.desiredSegments;
    if (segments % 2 === 1) segments -= 1;
    if (segments < 2) segments = 2;
    while (segments > 2 && Math.floor(minLength / segments) < config.minPointsPerSegment) {
      segments -= 2;
    }
    if (segments < 2) segments = 2;
    if (segments > minLength) segments = Math.max(2, Math.floor(minLength / config.minPointsPerSegment) * 2 || 2);
    if (segments % 2 === 1) segments -= 1;
    return Math.max(2, segments);
  }

  function buildCSCVMatrix(prepared, segments, config) {
    return prepared.map((item) => {
      const segmentMetrics = computeSegmentMetrics(item.dailyReturns, segments, config.aggregator);
      item.cscvSegments = segmentMetrics;
      return segmentMetrics;
    });
  }

  function computeSegmentMetrics(values, segments, aggregator) {
    if (!Array.isArray(values) || values.length === 0 || segments <= 0) {
      return [];
    }
    const n = values.length;
    const baseSize = Math.floor(n / segments);
    const remainder = n % segments;
    const metrics = [];
    let start = 0;
    for (let s = 0; s < segments; s += 1) {
      let segmentSize = baseSize;
      if (s < remainder) segmentSize += 1;
      const end = start + segmentSize;
      const slice = values.slice(start, Math.min(end, n));
      metrics.push(computeAggregator(slice, aggregator));
      start = end;
    }
    return metrics;
  }

  function computeAggregator(values, aggregator) {
    const valid = values.filter((v) => Number.isFinite(v));
    if (valid.length === 0) return null;
    if (aggregator === "mean") {
      return mean(valid);
    }
    return median(valid);
  }

  function generateCSCVSplits(segments, maxSplits) {
    const indices = Array.from({ length: segments }, (_, i) => i);
    const half = segments / 2;
    const combinations = [];

    function backtrack(start, combo) {
      if (combo.length === half) {
        combinations.push(combo.slice());
        return;
      }
      for (let i = start; i < indices.length; i += 1) {
        combo.push(indices[i]);
        backtrack(i + 1, combo);
        combo.pop();
        if (maxSplits && combinations.length >= maxSplits) return;
      }
    }

    backtrack(0, []);

    return combinations.map((combo) => {
      const isSet = new Set(combo);
      const oos = indices.filter((idx) => !isSet.has(idx));
      return { IS: combo, OOS: oos };
    });
  }

  function evaluateCSCV(prepared, matrix, splits, config) {
    const lambdaValues = [];
    const qValues = [];
    const indicators = [];
    const oosDistributions = prepared.map(() => []);
    const isDistributions = prepared.map(() => []);
    let validSplits = 0;

    splits.forEach((split) => {
      const isScores = matrix.map((segments) => aggregateSegments(segments, split.IS, config.aggregator));
      const championIndex = selectChampion(isScores);
      if (championIndex === -1) {
        return;
      }
      const oosScores = matrix.map((segments) => aggregateSegments(segments, split.OOS, config.aggregator));
      const championOOS = oosScores[championIndex];
      if (!Number.isFinite(championOOS)) {
        return;
      }
      const validOOS = oosScores.filter((score) => Number.isFinite(score));
      if (validOOS.length === 0) {
        return;
      }
      const sorted = validOOS.slice().sort((a, b) => a - b);
      let rank = 1;
      for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i] <= championOOS + EPSILON) {
          rank = i + 1;
        }
      }
      const qRaw = rank / (validOOS.length + 1);
      const q = clamp(qRaw, 1 / (validOOS.length + 1 + EPSILON), 1 - 1 / (validOOS.length + 1 + EPSILON));
      const lambda = Math.log(q / (1 - q));
      lambdaValues.push(lambda);
      qValues.push(q);
      indicators.push(lambda < 0 ? 1 : 0);
      validSplits += 1;

      oosScores.forEach((score, idx) => {
        if (Number.isFinite(score)) {
          oosDistributions[idx].push(score);
        }
      });
      isScores.forEach((score, idx) => {
        if (Number.isFinite(score)) {
          isDistributions[idx].push(score);
        }
      });
    });

    prepared.forEach((item, idx) => {
      item.oosValues = oosDistributions[idx];
      item.isValues = isDistributions[idx];
    });

    const totalSplits = splits.length;
    const pbo = indicators.length > 0 ? indicators.reduce((sum, val) => sum + val, 0) / indicators.length : null;

    return {
      lambdaValues,
      qValues,
      indicators,
      pbo,
      validSplits,
      totalSplits,
    };
  }

  function aggregateSegments(segments, indices, aggregator) {
    if (!Array.isArray(segments) || segments.length === 0) return null;
    const values = indices
      .map((idx) => segments[idx])
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    return computeAggregator(values, aggregator);
  }

  function selectChampion(scores) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    scores.forEach((score, idx) => {
      if (Number.isFinite(score) && score > bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
    });
    return bestIndex;
  }

  function computeFlowScore(prepared, cscvOutcome, config) {
    const RPBO = Number.isFinite(cscvOutcome.pbo) ? clamp(1 - cscvOutcome.pbo, 0, 1) : null;
    const lenInfo = computeSampleLengthScore(prepared);
    const RLen = lenInfo.score;
    const poolInfo = computePoolBreadthScore(prepared);
    const RPool = poolInfo.score;
    const RSPA = computeSPAScore(prepared, config);
    const RMCS = computeMCSScore(prepared, config);
    const components = [
      { value: RPBO, weight: config.weights.flow.pbo },
      { value: RLen, weight: config.weights.flow.len },
      { value: RPool, weight: config.weights.flow.pool },
      { value: RSPA, weight: config.weights.flow.spa },
      { value: RMCS, weight: config.weights.flow.mcs },
    ];
    const normalisedFlow = weightedAverage(components);
    const flowScoreValue = Number.isFinite(normalisedFlow) ? normalisedFlow * 100 : null;
    const verdict = deriveFlowVerdict(flowScoreValue, config.flowVerdictThresholds);
    const summary = buildFlowSummary(verdict, flowScoreValue, {
      RPBO,
      RLen,
      RPool,
      RSPA,
      RMCS,
      PBO: cscvOutcome.pbo,
      spaRate: RSPA,
      mcsRate: RMCS,
    }, lenInfo, poolInfo);
    const recommendations = buildFlowRecommendations(verdict, {
      RPBO,
      RLen,
      RPool,
      RSPA,
      RMCS,
    }, lenInfo, poolInfo);
    const flowScore = {
      RFlow: normalisedFlow,
      flowScore: flowScoreValue,
      RPBO,
      RLen,
      RPool,
      RSPA,
      RMCS,
      PBO: cscvOutcome.pbo,
      lambda: cscvOutcome.lambdaValues,
      qValues: cscvOutcome.qValues,
      totalSplits: cscvOutcome.totalSplits,
      validSplits: cscvOutcome.validSplits,
      sampleLength: lenInfo.sampleLength,
      sampleLengthLabel: lenInfo.label,
      sampleLengthStatus: lenInfo.statusText,
      suggestedBlockLength: lenInfo.blockLength,
      strategyPoolSize: poolInfo.size,
      strategyPoolLabel: poolInfo.label,
      flowVerdict: verdict.label,
      flowVerdictStatus: verdict.status,
      allowStrategyRanking: verdict.allowStrategyRanking,
      summary,
      recommendations,
      version: MODULE_VERSION,
    };
    prepared.forEach((item) => {
      item.flowScore = flowScore.RFlow;
      item.RPBO = RPBO;
      item.RLen = RLen;
      item.RPool = RPool;
      item.RSPA = RSPA;
      item.RMCS = RMCS;
      item.flowVerdictStatus = verdict.status;
    });
    return flowScore;
  }

  function computeSampleLengthScore(prepared) {
    const lengths = Array.isArray(prepared)
      ? prepared
          .map((item) => (Array.isArray(item.dailyReturns) ? item.dailyReturns.length : null))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [];
    if (lengths.length === 0) {
      return { score: null, sampleLength: null, label: "資料不足", statusText: "資料不足", blockLength: null };
    }
    const medianLength = median(lengths);
    if (!Number.isFinite(medianLength)) {
      return { score: null, sampleLength: null, label: "資料不足", statusText: "資料不足", blockLength: null };
    }
    let score = null;
    let label = "資料不足";
    let statusText = "資料不足";
    if (medianLength < 250) {
      score = 0;
      label = "不足";
      statusText = "樣本長度不足";
    } else if (medianLength < 500) {
      score = 0.5;
      label = "偏弱";
      statusText = "樣本長度偏短";
    } else {
      score = 1;
      label = "充足";
      statusText = "樣本長度充足";
    }
    const blockLength = Math.max(1, Math.round(Math.pow(medianLength, 1 / 3)));
    return { score, sampleLength: medianLength, label, statusText, blockLength };
  }

  function computePoolBreadthScore(prepared) {
    const size = Array.isArray(prepared) ? prepared.length : 0;
    if (!Number.isFinite(size) || size <= 0) {
      return { score: null, size: size || 0, label: "資料不足", statusText: "資料不足" };
    }
    let score = null;
    let label = "資料不足";
    let statusText = "資料不足";
    if (size < 20) {
      score = 0;
      label = "不足";
      statusText = "策略池過小";
    } else if (size < 100) {
      score = 0.7;
      label = "合理";
      statusText = "策略池合理";
    } else {
      score = 1;
      label = "充足";
      statusText = "策略池充足";
    }
    return { score, size, label, statusText };
  }

  function deriveFlowVerdict(flowScore, thresholds) {
    const passThreshold = thresholds?.pass ?? 70;
    const cautionThreshold = thresholds?.caution ?? 50;
    if (!Number.isFinite(flowScore)) {
      return { label: "Flow 指標資料不足", status: "unknown", allowStrategyRanking: false };
    }
    if (flowScore >= passThreshold) {
      return { label: "🟢 本次試驗合格", status: "pass", allowStrategyRanking: true };
    }
    if (flowScore >= cautionThreshold) {
      return { label: "🟡 本次試驗邊界", status: "caution", allowStrategyRanking: true };
    }
    return { label: "🔴 本次試驗不合格", status: "fail", allowStrategyRanking: false };
  }

  function buildFlowSummary(verdict, flowScore, metrics, lenInfo, poolInfo) {
    const fragments = [];
    if (Number.isFinite(metrics.PBO)) {
      fragments.push(`PBO=${(metrics.PBO * 100).toFixed(1)}%`);
    }
    if (lenInfo && Number.isFinite(lenInfo.sampleLength)) {
      fragments.push(`樣本長度${lenInfo.label}`);
    }
    if (poolInfo && Number.isFinite(poolInfo.size)) {
      const poolLabel = poolInfo.label ? `（${poolInfo.label}）` : "";
      fragments.push(`策略池 ${poolInfo.size} 組${poolLabel}`);
    }
    if (Number.isFinite(metrics.RSPA)) {
      fragments.push(`SPA 通過率 ${(metrics.RSPA * 100).toFixed(0)}%`);
    }
    if (Number.isFinite(metrics.RMCS)) {
      fragments.push(`MCS ${(metrics.RMCS * 100).toFixed(0)}%`);
    }
    const base = fragments.join("，");
    if (!Number.isFinite(flowScore)) {
      return base || "Flow 指標資料不足";
    }
    if (verdict.status === "pass") {
      return base ? `本次測試合格：${base}。可以進入策略比較。` : "本次測試合格，可以進入策略比較。";
    }
    if (verdict.status === "caution") {
      return base ? `本次測試邊界：${base}。仍可參考策略比較，但請審慎解讀。` : "本次測試邊界，仍可參考策略比較，但請審慎解讀。";
    }
    if (verdict.status === "fail") {
      return base ? `本次測試不合格：${base}。` : "本次測試不合格。";
    }
    return base || "Flow 指標資料不足";
  }

  function buildFlowRecommendations(verdict, metrics, lenInfo, poolInfo) {
    const suggestions = [];
    if (verdict.status === "fail" || verdict.status === "caution") {
      if (lenInfo && Number.isFinite(lenInfo.score)) {
        if (lenInfo.score === 0) {
          suggestions.push("延長回測期至 ≥ 2 年（約 500 筆以上）以支援 block bootstrap。");
        } else if (lenInfo.score === 0.5) {
          suggestions.push("適度延長回測期，提升樣本長度至 ≥ 500 筆。");
        }
      }
      if (poolInfo && Number.isFinite(poolInfo.score)) {
        if (poolInfo.score === 0) {
          suggestions.push("擴充策略池，至少提供 20 組以上參數組合。");
        } else if (poolInfo.score < 1) {
          suggestions.push("建議擴充策略池至 100 組以上，提升比較可信度。");
        }
      }
      if (Number.isFinite(metrics.RPBO) && metrics.RPBO < 0.6) {
        suggestions.push("PBO 偏高，請增加 CSCV 區塊或調整策略以降低過擬合風險。");
      }
      if (Number.isFinite(metrics.RSPA) && metrics.RSPA < 0.3) {
        suggestions.push("Top-N 策略通過 SPA 的比例偏低，建議檢查策略穩健度或延長資料期間。");
      }
      if (Number.isFinite(metrics.RMCS) && metrics.RMCS < 0.3) {
        suggestions.push("MCS 存活比例偏低，可檢查策略組合是否過於集中。");
      }
    }
    return suggestions;
  }

  function computeSPAScore(prepared, config) {
    const alpha = config.spaAlpha;
    const values = prepared
      .map((item) => extractNumericField(item.rawResult, ["spaPValue", "spaP", "spa_p_value", "spaPVal"]))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    const indicators = values.map((value) => (value < alpha ? 1 : 0));
    return indicators.reduce((sum, val) => sum + val, 0) / indicators.length;
  }

  function computeMCSScore(prepared) {
    const survivors = prepared
      .map((item) => extractMCSFlag(item.rawResult))
      .filter((value) => value !== null);
    if (survivors.length === 0) return null;
    const alive = survivors.filter((value) => value).length;
    return survivors.length > 0 ? alive / survivors.length : null;
  }

  function extractMCSFlag(result) {
    if (!result || typeof result !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(result, "mcsSurvivor")) {
      return Boolean(result.mcsSurvivor);
    }
    if (Object.prototype.hasOwnProperty.call(result, "mcsInclusion")) {
      const value = result.mcsInclusion;
      if (typeof value === "string") {
        if (value === "included" || value === "survived") return true;
        if (value === "excluded") return false;
      }
      if (typeof value === "boolean") return value;
    }
    if (Object.prototype.hasOwnProperty.call(result, "mcsRank")) {
      const rank = Number(result.mcsRank);
      if (Number.isFinite(rank)) {
        return rank === 0;
      }
    }
    return null;
  }

  function computeOOSMetrics(prepared, cscvOutcome, config) {
    const medians = [];
    const iqrs = [];
    prepared.forEach((item) => {
      const medianValue = median(item.oosValues);
      const iqrValue = iqr(item.oosValues);
      item.oosMedian = Number.isFinite(medianValue) ? medianValue : null;
      item.oosIQR = Number.isFinite(iqrValue) ? iqrValue : null;
      if (Number.isFinite(item.oosMedian)) medians.push(item.oosMedian);
      if (Number.isFinite(item.oosIQR)) iqrs.push(item.oosIQR);
    });

    const p10Median = percentile(medians, 10);
    const p90Median = percentile(medians, 90);
    const p10IQR = percentile(iqrs, 10);
    const p90IQR = percentile(iqrs, 90);

    prepared.forEach((item) => {
      if (!Number.isFinite(item.oosMedian)) {
        item.oosScore = null;
        return;
      }
      const midNorm = normaliseWithQuantiles(item.oosMedian, p10Median, p90Median);
      const iqrNorm = Number.isFinite(item.oosIQR)
        ? normaliseWithQuantiles(item.oosIQR, p10IQR, p90IQR)
        : 1;
      const score = config.oosAlpha * midNorm + (1 - config.oosAlpha) * (1 - iqrNorm);
      item.oosScore = clamp(score, 0, 1);
    });
  }

  function computeWalkForwardMetrics(prepared, config) {
    const winRates = [];
    const avgReturns = [];
    prepared.forEach((item) => {
      const result = runWalkForward(item.dailyReturns, config.walkforward);
      if (!result) {
        item.wfWinRate = null;
        item.wfAverageReturn = null;
        item.wfScore = null;
        return;
      }
      item.wfWinRate = result.winRate;
      item.wfAverageReturn = result.averageReturn;
      winRates.push(result.winRate);
      avgReturns.push(result.averageReturn);
    });

    const p10Return = percentile(avgReturns, 10);
    const p90Return = percentile(avgReturns, 90);

    prepared.forEach((item) => {
      if (!Number.isFinite(item.wfWinRate) || !Number.isFinite(item.wfAverageReturn)) {
        item.wfScore = null;
        return;
      }
      const winComponent = clamp(item.wfWinRate, 0, 1);
      const retComponent = normaliseWithQuantiles(item.wfAverageReturn, p10Return, p90Return);
      item.wfScore = clamp(0.6 * winComponent + 0.4 * retComponent, 0, 1);
    });
  }

  function runWalkForward(dailyReturns, options) {
    if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
      return null;
    }
    const train = Math.max(1, options.trainWindow || 252);
    const test = Math.max(1, options.testWindow || 63);
    const step = Math.max(1, options.stepSize || test);
    const required = train + test;
    if (dailyReturns.length < required) {
      return null;
    }
    const windows = [];
    let start = 0;
    while (start + required <= dailyReturns.length) {
      const testStart = start + train;
      const testSlice = dailyReturns.slice(testStart, testStart + test);
      if (testSlice.length === 0) break;
      const cumulative = testSlice.reduce((sum, value) => sum + value, 0);
      windows.push({
        cumulative,
      });
      start += step;
    }
    if (windows.length < options.minimumWindows) {
      return null;
    }
    const positives = windows.filter((w) => w.cumulative > 0).length;
    const winRate = windows.length > 0 ? positives / windows.length : 0;
    const averageReturn = windows.length > 0
      ? windows.reduce((sum, w) => sum + w.cumulative, 0) / windows.length
      : 0;
    return {
      winRate,
      averageReturn,
      windows,
    };
  }

  function computeSignificanceMetrics(prepared, config) {
    prepared.forEach((item) => {
      const sampleSize = Array.isArray(item.dailyReturns) ? item.dailyReturns.length : 0;
      const sharpe = Number.isFinite(item.rawResult?.sharpeRatio)
        ? Number(item.rawResult.sharpeRatio)
        : null;
      if (!Number.isFinite(sharpe) || sampleSize <= 1) {
        item.psrScore = null;
        item.dsrScore = null;
        item.dsrpsrScore = null;
        return;
      }
      const psr = computePSR(sharpe, config.dsrSharpeThreshold, sampleSize);
      const dsrNorm = computeDSRNormalised(sharpe, sampleSize, config.dsrLogisticEta);
      item.psrScore = psr;
      item.dsrScore = dsrNorm;
      const components = [
        Number.isFinite(dsrNorm) ? dsrNorm : null,
        Number.isFinite(psr) ? psr : null,
        Number.isFinite(item.psr) ? clamp(item.psr, 0, 1) : null,
        Number.isFinite(item.dsr) ? clamp(item.dsr, 0, 1) : null,
      ].filter((value) => Number.isFinite(value));
      if (components.length === 0) {
        item.dsrpsrScore = null;
      } else {
        item.dsrpsrScore = clamp(Math.max.apply(null, components), 0, 1);
      }
    });
  }

  function computePSR(sharpe, threshold, sampleSize) {
    if (!Number.isFinite(sharpe) || !Number.isFinite(sampleSize) || sampleSize <= 1) {
      return null;
    }
    const z = (sharpe - threshold) * Math.sqrt(Math.max(sampleSize - 1, 1));
    return clamp(normalCDF(z), 0, 1);
  }

  function computeDSRNormalised(sharpe, sampleSize, eta) {
    if (!Number.isFinite(sharpe) || !Number.isFinite(sampleSize) || sampleSize <= 1) {
      return null;
    }
    const z = sharpe * Math.sqrt(Math.max(sampleSize - 1, 1));
    const scaled = eta * z;
    return clamp(sigmoid(scaled), 0, 1);
  }

  function computeIslandScores(prepared, config) {
    const groups = new Map();
    prepared.forEach((item) => {
      if (!Number.isFinite(item.oosMedian)) return;
      const groupKey = item.buyStrategy || "unknown";
      if (!groups.has(groupKey)) {
        groups.set(groupKey, createIslandGroup(item));
      }
      const group = groups.get(groupKey);
      if (!group) return;
      if (!group.axisX || !group.axisY) return;
      const point = extractPointForIsland(item, group);
      if (!point) return;
      const keyX = point.keyX;
      const keyY = point.keyY;
      if (!group.grid.has(keyY)) {
        group.grid.set(keyY, new Map());
      }
      group.grid.get(keyY).set(keyX, item.oosMedian);
      group.cellOwners.set(`${keyX}|${keyY}`, group.cellOwners.get(`${keyX}|${keyY}`) || []);
      group.cellOwners.get(`${keyX}|${keyY}`).push(item.index);
      group.xValues.set(keyX, point.valueX);
      group.yValues.set(keyY, point.valueY);
    });

    const islands = [];
    groups.forEach((group, key) => {
      const groupIslands = analyseGroupIslands(group, key);
      if (Array.isArray(groupIslands)) {
        islands.push(...groupIslands);
      }
    });

    if (islands.length === 0) {
      return new Map();
    }

    const areaValues = islands.map((island) => island.area);
    const dispersionValues = islands.map((island) => island.dispersion);
    const edgePenalties = islands.map((island) => island.edgePenaltyRaw);
    const areaP25 = percentile(areaValues, 25);
    const areaP95 = percentile(areaValues, 95);
    const dispersionP25 = percentile(dispersionValues, 25);
    const dispersionP95 = percentile(dispersionValues, 95);
    const edgeP25 = percentile(edgePenalties, 25);
    const edgeP95 = percentile(edgePenalties, 95);

    const scoreMap = new Map();
    islands.forEach((island) => {
      island.areaNorm = normaliseWithQuantiles(island.area, areaP25, areaP95);
      island.dispersionNorm = normaliseWithQuantiles(island.dispersion, dispersionP25, dispersionP95);
      island.edgeNorm = normaliseWithQuantiles(island.edgePenaltyRaw, edgeP25, edgeP95);
      const rawScore = island.areaNorm * (1 - island.dispersionNorm) * (1 - island.edgeNorm);
      island.rawScore = clamp(rawScore, 0, 1);
    });

    const maxIslandScore = islands.reduce((max, island) => (island.rawScore > max ? island.rawScore : max), 0);

    islands.forEach((island) => {
      const normalisedScore = maxIslandScore > EPSILON ? clamp(island.rawScore / maxIslandScore, 0, 1) : 0;
      island.cells.forEach((cellKey) => {
        const owners = island.group.cellOwners.get(cellKey) || [];
        owners.forEach((ownerIndex) => {
          const existing = scoreMap.get(ownerIndex);
          if (!existing || normalisedScore > existing.score) {
            scoreMap.set(ownerIndex, {
              score: normalisedScore,
              meta: {
                area: island.area,
                dispersion: island.dispersion,
                edgePenalty: island.edgePenaltyRaw,
                areaNorm: island.areaNorm,
                dispersionNorm: island.dispersionNorm,
                edgeNorm: island.edgeNorm,
                rawScore: island.rawScore,
                maxScore: maxIslandScore,
                normalisedScore,
                groupKey: island.groupKey,
              },
            });
          }
        });
      });
    });

    return scoreMap;
  }

  function createIslandGroup(item) {
    const axisCandidates = resolveAxisCandidates(item);
    return {
      axisX: axisCandidates.axisX,
      axisY: axisCandidates.axisY,
      grid: new Map(),
      xValues: new Map(),
      yValues: new Map(),
      cellOwners: new Map(),
    };
  }

  function resolveAxisCandidates(item) {
    const entryParams = collectParamEntries(item.buyParams, "entry");
    const exitParams = collectParamEntries(item.sellParams, "exit");
    const combined = entryParams.concat(exitParams);
    if (entryParams.length >= 2) {
      return { axisX: entryParams[0], axisY: entryParams[1] };
    }
    if (entryParams.length === 1 && combined.length >= 2) {
      return { axisX: entryParams[0], axisY: combined.find((param) => param.key !== entryParams[0].key) };
    }
    if (combined.length >= 2) {
      return { axisX: combined[0], axisY: combined[1] };
    }
    return { axisX: null, axisY: null };
  }

  function collectParamEntries(params, context) {
    if (!params || typeof params !== "object") return [];
    return Object.keys(params)
      .map((key) => ({
        context,
        key,
        value: Number(params[key]),
      }))
      .filter((entry) => Number.isFinite(entry.value));
  }

  function extractPointForIsland(item, group) {
    const axisXValue = extractAxisValue(item, group.axisX);
    const axisYValue = extractAxisValue(item, group.axisY);
    if (!Number.isFinite(axisXValue) || !Number.isFinite(axisYValue)) {
      return null;
    }
    return {
      valueX: axisXValue,
      valueY: axisYValue,
      keyX: axisKey(axisXValue),
      keyY: axisKey(axisYValue),
    };
  }

  function extractAxisValue(item, axis) {
    if (!axis) return null;
    if (axis.context === "entry") {
      return Number.isFinite(item.buyParams?.[axis.key]) ? item.buyParams[axis.key] : null;
    }
    if (axis.context === "exit") {
      return Number.isFinite(item.sellParams?.[axis.key]) ? item.sellParams[axis.key] : null;
    }
    return null;
  }

  function axisKey(value) {
    if (!Number.isFinite(value)) return "";
    return Number(value.toFixed(6)).toString();
  }

  function analyseGroupIslands(group, groupKey) {
    const xKeys = Array.from(group.xValues.keys());
    const yKeys = Array.from(group.yValues.keys());
    if (xKeys.length === 0 || yKeys.length === 0) {
      return [];
    }
    const sortedX = xKeys.sort((a, b) => group.xValues.get(a) - group.xValues.get(b));
    const sortedY = yKeys.sort((a, b) => group.yValues.get(a) - group.yValues.get(b));
    const matrix = [];
    const values = [];
    sortedY.forEach((yKey, rowIdx) => {
      const row = [];
      const column = group.grid.get(yKey) || new Map();
      sortedX.forEach((xKey) => {
        const value = column.has(xKey) ? column.get(xKey) : null;
        row.push(Number.isFinite(value) ? value : null);
        if (Number.isFinite(value)) {
          values.push(value);
        }
      });
      matrix.push(row);
    });
    if (values.length === 0) {
      return [];
    }
    const threshold = percentile(values, 75);
    if (!Number.isFinite(threshold)) {
      return [];
    }
    const mask = matrix.map((row) => row.map((value) => Number.isFinite(value) && value >= threshold));
    const visited = matrix.map((row) => row.map(() => false));
    const islands = [];
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (let row = 0; row < mask.length; row += 1) {
      for (let col = 0; col < mask[row].length; col += 1) {
        if (!mask[row][col] || visited[row][col]) continue;
        const queue = [[row, col]];
        visited[row][col] = true;
        const cells = [];
        const valuesInIsland = [];
        while (queue.length > 0) {
          const [r, c] = queue.shift();
          const value = matrix[r][c];
          if (!Number.isFinite(value)) continue;
          const cellKey = `${sortedX[c]}|${sortedY[r]}`;
          cells.push(cellKey);
          valuesInIsland.push(value);
          directions.forEach(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr >= 0 &&
              nr < mask.length &&
              nc >= 0 &&
              nc < mask[nr].length &&
              mask[nr][nc] &&
              !visited[nr][nc]
            ) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          });
        }
        if (cells.length === 0) continue;
        const dispersion = iqr(valuesInIsland);
        const { edgePenalty } = computeIslandEdgePenalty(matrix, mask, valuesInIsland, cells, sortedX, sortedY, group);
        islands.push({
          area: cells.length,
          dispersion: Number.isFinite(dispersion) ? dispersion : 0,
          edgePenaltyRaw: edgePenalty,
          cells,
          group,
          groupKey,
        });
      }
    }
    return islands;
  }

  function computeIslandEdgePenalty(matrix, mask, values, cells, sortedX, sortedY, group) {
    const cellSet = new Set(cells);
    const coreValues = [];
    const edgeValues = [];
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        const cellKey = `${sortedX[col]}|${sortedY[row]}`;
        if (!cellSet.has(cellKey)) continue;
        const value = matrix[row][col];
        if (!Number.isFinite(value)) continue;
        const neighbors = getNeighbors(row, col, mask.length, mask[row].length);
        const isCore = neighbors.every(([nr, nc]) => mask[nr][nc]);
        if (isCore) {
          coreValues.push(value);
        } else {
          edgeValues.push(value);
        }
      }
    }
    const muCore = coreValues.length > 0 ? mean(coreValues) : mean(values);
    const muEdge = edgeValues.length > 0 ? mean(edgeValues) : muCore;
    const numerator = muCore - muEdge;
    const denominator = Math.abs(muCore) + EPSILON;
    const edgeSharpness = numerator / denominator;
    const penalty = Math.max(0, -edgeSharpness);
    return {
      edgePenalty: penalty,
    };
  }

  function getNeighbors(row, col, rows, cols) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          neighbors.push([nr, nc]);
        }
      }
    }
    return neighbors;
  }

  function applyIslandScores(prepared, scoreMap) {
    prepared.forEach((item) => {
      if (scoreMap.has(item.index)) {
        const info = scoreMap.get(item.index);
        item.islandScore = info.score;
        item.islandMeta = info.meta;
      } else {
        item.islandScore = 0;
        item.islandMeta = {
          reason: "no_island",
          message: "未取得完整參數熱圖或無高分島嶼",
          rawScore: 0,
          normalisedScore: 0,
        };
      }
    });
  }

  function buildStrategyEvaluations(preparedAll, preparedValid, flowMetrics, config) {
    const flowScore = flowMetrics.RFlow;
    const flowScorePercent = Number.isFinite(flowScore) ? flowScore * 100 : null;
    const allowRanking = flowMetrics.allowStrategyRanking !== false;
    const flowVerdictStatus = flowMetrics.flowVerdictStatus || "unknown";
    const flowVerdictLabel = flowMetrics.flowVerdict || "Flow 指標資料不足";
    preparedValid.forEach((item) => {
      const components = [
        { value: item.dsrpsrScore, weight: config.weights.strategy.dsrpsr },
        { value: item.oosScore, weight: config.weights.strategy.oos },
        { value: item.wfScore, weight: config.weights.strategy.wf },
        { value: item.islandScore, weight: config.weights.strategy.island },
      ];
      const strategyScore = weightedAverage(components);
      item.strategyScore = strategyScore;
      const strategyScorePercent = Number.isFinite(strategyScore) ? strategyScore * 100 : null;
      const finalComponents = [
        { value: flowScore, weight: config.weights.ofi.flow },
        { value: strategyScore, weight: config.weights.ofi.strategy },
      ];
      const ofiNormalised = weightedAverage(finalComponents);
      const computedOFI = Number.isFinite(ofiNormalised) ? ofiNormalised * 100 : null;
      const displayScore = allowRanking ? computedOFI : null;
      item.finalOFI = allowRanking ? computedOFI : null;
      item.displayScore = displayScore;
      item.components = {
        strategy: strategyScore,
        strategyScorePercent,
        ROOS: item.oosScore,
        RWF: item.wfScore,
        RDSRPSR: item.dsrpsrScore,
        RIsland: item.islandScore,
        RFlow: flowScore,
        RFlowPercent: flowScorePercent,
        RPBO: item.RPBO,
        RLen: item.RLen,
        RPool: item.RPool,
        RSPA: item.RSPA,
        RMCS: item.RMCS,
        finalOfi: allowRanking ? computedOFI : null,
        finalOfiNormalised: allowRanking && Number.isFinite(ofiNormalised) ? ofiNormalised : null,
      };
      if (!allowRanking) {
        item.verdict = "🔒 暫停策略比較";
      } else {
        const baseVerdict = deriveVerdict(displayScore);
        if (flowVerdictStatus === "caution" && baseVerdict !== "資料不足") {
          item.verdict = `${baseVerdict}｜Flow 邊界`;
        } else {
          item.verdict = baseVerdict;
        }
      }
      item.metaFlowVerdict = flowVerdictLabel;
      item.metaStrategyScore = strategyScorePercent;
    });

    return preparedAll.map((item) => {
      const validItem = preparedValid.find((v) => v.index === item.index);
      if (!validItem) {
        const empty = buildEmptyStrategyResult(item.index);
        if (!allowRanking) {
          empty.verdict = "🔒 暫停策略比較";
          empty.meta.flowVerdict = flowVerdictLabel;
        }
        return empty;
      }
      return {
        index: validItem.index,
        ofiScore: validItem.displayScore,
        verdict: validItem.verdict,
        components: validItem.components,
        meta: {
          version: MODULE_VERSION,
          island: validItem.islandMeta || null,
          flowVerdict: flowVerdictLabel,
          finalOfi: validItem.finalOFI,
          strategyScorePercent: validItem.metaStrategyScore,
          flowScore: flowScorePercent,
        },
      };
    });
  }

  function weightedAverage(components) {
    const available = components.filter((component) => Number.isFinite(component.value));
    if (available.length === 0) {
      return null;
    }
    const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
    if (totalWeight <= EPSILON) {
      return null;
    }
    const score = available.reduce((sum, component) => sum + (component.value * component.weight) / totalWeight, 0);
    return clamp(score, 0, 1);
  }

  function deriveVerdict(ofiScore) {
    if (!Number.isFinite(ofiScore)) {
      return "資料不足";
    }
    if (ofiScore >= 80) return "👍 穩健";
    if (ofiScore >= 65) return "✅ 良好";
    if (ofiScore >= 50) return "😐 一般";
    return "⚠️ 高風險";
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  function median(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  function percentile(values, percentileValue) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const rank = (percentileValue / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) {
      return sorted[lower];
    }
    const weight = rank - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  function iqr(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const q1 = percentile(values, 25);
    const q3 = percentile(values, 75);
    if (!Number.isFinite(q1) || !Number.isFinite(q3)) return null;
    return q3 - q1;
  }

  function normaliseWithQuantiles(value, lower, upper) {
    if (!Number.isFinite(value)) return 0;
    const lowerFinite = Number.isFinite(lower);
    const upperFinite = Number.isFinite(upper);
    if (!lowerFinite && !upperFinite) {
      return 0;
    }
    if (!lowerFinite && upperFinite) {
      return value > upper ? 1 : 0;
    }
    if (lowerFinite && !upperFinite) {
      return value <= lower ? 0 : 1;
    }
    if (Math.abs(upper - lower) < EPSILON) {
      if (value > upper) return 1;
      if (value < lower) return 0;
      return 0;
    }
    const raw = (value - lower) / (upper - lower);
    return clamp(raw, 0, 1);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return value;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
  }

  function normalCDF(x) {
    return (1 + erf(x / Math.sqrt(2))) / 2;
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  }

  if (!window.lazybacktestOFI) {
    window.lazybacktestOFI = {};
  }
  window.lazybacktestOFI.computeOFIForResults = computeOFIForResults;
  window.lazybacktestOFI.version = MODULE_VERSION;
  window.lazybacktestOFI.getVerdict = deriveVerdict;
})();
