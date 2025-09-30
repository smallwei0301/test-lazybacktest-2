(function initLazybacktestOfiScope(global) {
  const MODULE_VERSION = 'LB-OFI-RATING-20251113A';
  const EPSILON = 1e-9;

  const DEFAULT_WEIGHTS = {
    flow: { beta1: 0.6, beta2: 0.2, beta3: 0.2 },
    strategy: { gamma1: 0.25, gamma2: 0.25, gamma3: 0.25, gamma4: 0.25 },
    final: { wF: 0.3, wS: 0.7 }
  };

  const DEFAULT_THRESHOLDS = {
    spaAlpha: 0.05,
    verdict: {
      excellent: 80,
      good: 65,
      fair: 50
    },
    lights: {
      pbo: { low: 0.15, medium: 0.35 },
      oos: { good: 0.65, ok: 0.5 },
      wfWinRate: 0.6,
      wfReturn: 0.6,
      islandArea: 9,
      islandDispersion: 0.5,
      dsr: { pass: 0.5, strong: 0.8 }
    }
  };

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function toFiniteArray(values) {
    if (!Array.isArray(values)) return [];
    return values.map(Number).filter(isFiniteNumber);
  }

  function clamp01(value) {
    if (!isFiniteNumber(value)) return null;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function mean(values) {
    const arr = toFiniteArray(values);
    if (arr.length === 0) return NaN;
    const sum = arr.reduce((acc, v) => acc + v, 0);
    return sum / arr.length;
  }

  function median(values) {
    const arr = toFiniteArray(values).sort((a, b) => a - b);
    if (arr.length === 0) return NaN;
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 0) {
      return (arr[mid - 1] + arr[mid]) / 2;
    }
    return arr[mid];
  }

  function quantile(sortedValues, q) {
    const arr = Array.isArray(sortedValues) ? sortedValues.filter(isFiniteNumber) : [];
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (base + 1 < sorted.length) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }

  function percentile(values, p) {
    return quantile(values, Math.min(Math.max(p, 0), 1));
  }

  function computeIqr(values) {
    const arr = toFiniteArray(values);
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    return q3 - q1;
  }

  function normalizeByQuantiles(value, population, lowerQ = 0.1, upperQ = 0.9) {
    if (!isFiniteNumber(value)) return null;
    const arr = toFiniteArray(population);
    if (arr.length === 0) return null;
    const lower = quantile(arr, lowerQ);
    const upper = quantile(arr, upperQ);
    if (!isFiniteNumber(lower) || !isFiniteNumber(upper)) return null;
    const range = upper - lower;
    if (Math.abs(range) < EPSILON) {
      return clamp01(0.5);
    }
    return clamp01((value - lower) / range);
  }

  function aggregateRow(row, indices, aggregator) {
    if (!Array.isArray(row) || !Array.isArray(indices) || indices.length === 0) return NaN;
    const values = indices
      .map(idx => (idx >= 0 && idx < row.length ? row[idx] : NaN))
      .filter(isFiniteNumber);
    if (values.length === 0) return NaN;
    if (aggregator === 'median') {
      return median(values);
    }
    return mean(values);
  }

  function buildRankQuantile(value, population) {
    const arr = toFiniteArray(population);
    if (!isFiniteNumber(value) || arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    let count = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      if (value >= sorted[i] - EPSILON) {
        count += 1;
      } else {
        break;
      }
    }
    const q = count / (sorted.length + 1);
    return Math.min(Math.max(q, EPSILON), 1 - EPSILON);
  }

  function computePboScore(matrix, splits, aggregator) {
    if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(splits) || splits.length === 0) {
      return { pbo: null, lambda: [], score: null };
    }
    const K = matrix.length;
    const lambdaList = [];
    let negativeCount = 0;
    splits.forEach(split => {
      const isIdx = split?.inSample || split?.inSampleIndices || split?.IS || split?.is || [];
      const oosIdx = split?.outSample || split?.outSampleIndices || split?.OOS || split?.oos || [];
      if (!Array.isArray(isIdx) || !Array.isArray(oosIdx) || isIdx.length === 0 || oosIdx.length === 0) {
        return;
      }
      const isValues = matrix.map(row => aggregateRow(row, isIdx, aggregator));
      if (isValues.every(v => !isFiniteNumber(v))) return;
      let championIndex = 0;
      let championValue = -Infinity;
      isValues.forEach((val, idx) => {
        if (isFiniteNumber(val) && val > championValue) {
          championValue = val;
          championIndex = idx;
        }
      });
      const oosValues = matrix.map(row => aggregateRow(row, oosIdx, aggregator));
      const championOos = oosValues[championIndex];
      if (!isFiniteNumber(championOos)) return;
      const q = buildRankQuantile(championOos, oosValues);
      if (q === null) return;
      const lambda = Math.log(q / (1 - q));
      lambdaList.push(lambda);
      if (lambda < 0) {
        negativeCount += 1;
      }
    });
    if (lambdaList.length === 0) {
      return { pbo: null, lambda: [], score: null };
    }
    const pbo = negativeCount / lambdaList.length;
    return { pbo, lambda: lambdaList, score: clamp01(1 - pbo) };
  }

  function computeSpaScore(spaDiagnostics, totalStrategies, alphaOverride) {
    if (!spaDiagnostics) return { score: null };
    const pValues = toFiniteArray(spaDiagnostics.pValues || spaDiagnostics);
    if (pValues.length === 0) return { score: null };
    const alpha = isFiniteNumber(spaDiagnostics.alpha)
      ? spaDiagnostics.alpha
      : isFiniteNumber(alphaOverride)
        ? alphaOverride
        : DEFAULT_THRESHOLDS.spaAlpha;
    const accepted = pValues.filter(p => isFiniteNumber(p) && p < alpha).length;
    const K = totalStrategies && totalStrategies > 0 ? totalStrategies : pValues.length;
    return { score: clamp01(accepted / K), alpha };
  }

  function computeMcsScore(mcsDiagnostics, totalStrategies) {
    if (!mcsDiagnostics) return { score: null };
    const survivors = Array.isArray(mcsDiagnostics.survivors)
      ? mcsDiagnostics.survivors
      : Array.isArray(mcsDiagnostics)
        ? mcsDiagnostics
        : [];
    if (survivors.length === 0) return { score: null };
    const K = totalStrategies && totalStrategies > 0 ? totalStrategies : survivors.length;
    return { score: clamp01(survivors.length / K) };
  }

  function computeOosFromMatrix(matrix, splits, aggregator) {
    if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(splits) || splits.length === 0) {
      return [];
    }
    return matrix.map(row => {
      const values = [];
      splits.forEach(split => {
        const oosIdx = split?.outSample || split?.outSampleIndices || split?.OOS || split?.oos || [];
        if (!Array.isArray(oosIdx) || oosIdx.length === 0) return;
        const aggregated = aggregateRow(row, oosIdx, aggregator);
        if (isFiniteNumber(aggregated)) {
          values.push(aggregated);
        }
      });
      return values;
    });
  }

  function computeMatrixOosDistributions(flowDiagnostics) {
    if (!flowDiagnostics) return [];
    const matrix = flowDiagnostics.matrix?.values || flowDiagnostics.performanceMatrix;
    const splits = flowDiagnostics.splits || flowDiagnostics.cscvSplits || flowDiagnostics.cscv || [];
    const aggregator = (flowDiagnostics.matrix?.aggregator || flowDiagnostics.aggregator || 'mean').toLowerCase();
    return computeOosFromMatrix(matrix, splits, aggregator);
  }

  function computeFlowScore(flowDiagnostics, config) {
    if (!flowDiagnostics) {
      return {
        version: MODULE_VERSION,
        score: null,
        components: { pboScore: null, pbo: null, spaScore: null, mcsScore: null }
      };
    }
    const matrix = flowDiagnostics.matrix?.values || flowDiagnostics.performanceMatrix || null;
    const splits = flowDiagnostics.splits || flowDiagnostics.cscvSplits || flowDiagnostics.cscv || [];
    const aggregator = (flowDiagnostics.matrix?.aggregator || flowDiagnostics.aggregator || 'mean').toLowerCase();
    const totalStrategies = Array.isArray(matrix) ? matrix.length : flowDiagnostics.totalStrategies;

    const pboResult = computePboScore(matrix, splits, aggregator);
    const spaResult = computeSpaScore(flowDiagnostics.spa, totalStrategies, config?.thresholds?.spaAlpha);
    const mcsResult = computeMcsScore(flowDiagnostics.mcs, totalStrategies);

    const beta1 = config?.weights?.flow?.beta1 ?? DEFAULT_WEIGHTS.flow.beta1;
    const beta2 = config?.weights?.flow?.beta2 ?? DEFAULT_WEIGHTS.flow.beta2;
    const beta3 = config?.weights?.flow?.beta3 ?? DEFAULT_WEIGHTS.flow.beta3;

    const components = [];
    if (isFiniteNumber(pboResult.score)) components.push({ weight: beta1, value: pboResult.score });
    if (isFiniteNumber(spaResult.score)) components.push({ weight: beta2, value: spaResult.score });
    if (isFiniteNumber(mcsResult.score)) components.push({ weight: beta3, value: mcsResult.score });

    let weightSum = 0;
    let weighted = 0;
    components.forEach(c => {
      weightSum += c.weight;
      weighted += c.weight * c.value;
    });
    const finalScore = weightSum > 0 ? clamp01(weighted / weightSum) : null;

    return {
      version: MODULE_VERSION,
      score: finalScore,
      components: {
        pboScore: isFiniteNumber(pboResult.score) ? pboResult.score : null,
        pbo: isFiniteNumber(pboResult.pbo) ? pboResult.pbo : null,
        spaScore: isFiniteNumber(spaResult.score) ? spaResult.score : null,
        mcsScore: isFiniteNumber(mcsResult.score) ? mcsResult.score : null,
        spaAlpha: spaResult.alpha ?? config?.thresholds?.spaAlpha ?? DEFAULT_THRESHOLDS.spaAlpha,
        totalStrategies: totalStrategies || null
      }
    };
  }

  function computeOosScores(strategies, config) {
    const medians = strategies.map(s => (isFiniteNumber(s.oosMedian) ? s.oosMedian : null)).filter(isFiniteNumber);
    const iqrs = strategies.map(s => (isFiniteNumber(s.oosIqr) ? s.oosIqr : null)).filter(isFiniteNumber);
    return strategies.map(strategy => {
      const midNorm = isFiniteNumber(strategy.oosMedian)
        ? normalizeByQuantiles(strategy.oosMedian, medians, 0.1, 0.9)
        : null;
      const iqrNorm = isFiniteNumber(strategy.oosIqr)
        ? normalizeByQuantiles(strategy.oosIqr, iqrs, 0.1, 0.9)
        : null;
      const alpha = config?.weights?.oosAlpha ?? 0.6;
      const components = [];
      if (isFiniteNumber(midNorm)) components.push({ weight: alpha, value: midNorm });
      if (isFiniteNumber(iqrNorm)) components.push({ weight: 1 - alpha, value: 1 - iqrNorm });
      let score = null;
      if (components.length > 0) {
        let weightSum = 0;
        let weighted = 0;
        components.forEach(c => {
          weightSum += c.weight;
          weighted += c.weight * c.value;
        });
        score = clamp01(weighted / weightSum);
      }
      return { ...strategy, oosScore: score, oosMidNorm: isFiniteNumber(midNorm) ? midNorm : null, oosIqrNorm: isFiniteNumber(iqrNorm) ? iqrNorm : null };
    });
  }

  function computeWalkForwardScores(strategies) {
    const avgReturns = strategies
      .map(s => (isFiniteNumber(s.walkForwardAverage) ? s.walkForwardAverage : null))
      .filter(isFiniteNumber);
    return strategies.map(strategy => {
      let wrNorm = null;
      if (isFiniteNumber(strategy.walkForwardWinRate)) {
        wrNorm = clamp01(strategy.walkForwardWinRate);
      }
      let retNorm = null;
      if (isFiniteNumber(strategy.walkForwardAverage)) {
        retNorm = normalizeByQuantiles(strategy.walkForwardAverage, avgReturns, 0.1, 0.9);
      }
      const weightWr = 0.6;
      const weightRet = 0.4;
      const components = [];
      if (isFiniteNumber(wrNorm)) components.push({ weight: weightWr, value: wrNorm });
      if (isFiniteNumber(retNorm)) components.push({ weight: weightRet, value: retNorm });
      let score = null;
      if (components.length > 0) {
        let weightSum = 0;
        let weighted = 0;
        components.forEach(c => {
          weightSum += c.weight;
          weighted += c.weight * c.value;
        });
        score = clamp01(weighted / weightSum);
      }
      return { ...strategy, wfScore: score, wfWrNorm: isFiniteNumber(wrNorm) ? wrNorm : null, wfRetNorm: isFiniteNumber(retNorm) ? retNorm : null };
    });
  }

  function groupByGrid(strategies) {
    const map = new Map();
    strategies.forEach(strategy => {
      const island = strategy.island;
      if (!island || !Array.isArray(island.grid)) return;
      const gridId = island.gridId || island.id || '__default__';
      if (!map.has(gridId)) {
        map.set(gridId, []);
      }
      map.get(gridId).push(strategy);
    });
    return map;
  }

  function extractIslandComponents(cells, rows, cols, threshold) {
    const visited = new Array(rows * cols).fill(false);
    const islands = [];
    const getIndex = (r, c) => r * cols + c;
    const directions = [-1, 0, 1];
    function explore(startIdx) {
      const queue = [startIdx];
      const component = [];
      visited[startIdx] = true;
      while (queue.length > 0) {
        const idx = queue.shift();
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        component.push({ idx, r, c, value: cells[idx] });
        directions.forEach(dr => {
          directions.forEach(dc => {
            if (dr === 0 && dc === 0) return;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
            const nIdx = getIndex(nr, nc);
            if (!visited[nIdx] && cells[nIdx] >= threshold) {
              visited[nIdx] = true;
              queue.push(nIdx);
            }
          });
        });
      }
      return component;
    }

    for (let idx = 0; idx < cells.length; idx += 1) {
      if (!visited[idx] && cells[idx] >= threshold) {
        islands.push(explore(idx));
      }
    }
    return islands;
  }

  function analyseIslandGrid(strategies, config) {
    const grouped = groupByGrid(strategies);
    const results = new Map();

    grouped.forEach((items, gridId) => {
      const islandInfo = items[0]?.island;
      if (!islandInfo || !Array.isArray(islandInfo.grid)) return;
      const grid = islandInfo.grid;
      const rows = grid.length;
      const cols = rows > 0 ? grid[0].length : 0;
      if (rows === 0 || cols === 0) return;
      const flat = [];
      grid.forEach(row => {
        if (Array.isArray(row)) {
          row.forEach(value => {
            flat.push(Number.isFinite(value) ? Number(value) : NaN);
          });
        }
      });
      const validCells = flat.filter(isFiniteNumber);
      if (validCells.length === 0) return;
      const tauPercentile = islandInfo.thresholdPercentile ?? 0.75;
      const threshold = quantile(validCells, tauPercentile);
      const cells = flat.map(value => (isFiniteNumber(value) ? value : -Infinity));
      const islands = extractIslandComponents(cells, rows, cols, threshold);
      if (islands.length === 0) {
        items.forEach(strategy => {
          results.set(strategy.key, { islandScore: 0, details: null });
        });
        return;
      }

      const areas = islands.map(component => component.length);
      const dispersions = islands.map(component => {
        const values = component.map(cell => cell.value);
        return computeIqr(values);
      });
      const edgeSharpness = islands.map(component => {
        const indexSet = new Set(component.map(cell => cell.idx));
        const edgeCells = [];
        const coreCells = [];
        component.forEach(cell => {
          let isEdge = false;
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              const nr = cell.r + dr;
              const nc = cell.c + dc;
              if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                isEdge = true;
              } else {
                const neighborIdx = nr * cols + nc;
                if (!indexSet.has(neighborIdx)) {
                  isEdge = true;
                }
              }
            }
          }
          if (isEdge) {
            edgeCells.push(cell.value);
          } else {
            coreCells.push(cell.value);
          }
        });
        const coreMean = coreCells.length > 0 ? mean(coreCells) : mean(component.map(cell => cell.value));
        const edgeMean = edgeCells.length > 0 ? mean(edgeCells) : coreMean;
        return (coreMean - edgeMean) / (Math.abs(coreMean) + EPSILON);
      });

      const areaNorms = areas.map(area => normalizeByQuantiles(area, areas, 0.25, 0.95) ?? 0);
      const dispersionNorms = dispersions.map(d => normalizeByQuantiles(d, dispersions, 0.25, 0.95) ?? 0);
      const edgePenaltyPool = edgeSharpness.map(val => Math.max(0, -val));
      const edgePenalties = edgeSharpness.map((sharp, idx) => {
        const penaltyBase = edgePenaltyPool[idx];
        return normalizeByQuantiles(penaltyBase, edgePenaltyPool, 0.25, 0.95) ?? 0;
      });

      const islandScores = islands.map((component, idx) => {
        const score = (areaNorms[idx] ?? 0) * (1 - (dispersionNorms[idx] ?? 0)) * (1 - (edgePenalties[idx] ?? 0));
        return { component, score };
      });

      const maxScore = islandScores.reduce((acc, item) => Math.max(acc, item.score), 0);
      const componentMap = new Map();
      islandScores.forEach((item, idx) => {
        item.component.forEach(cell => {
          componentMap.set(cell.idx, { rawScore: item.score, normalizedScore: maxScore > 0 ? item.score / maxScore : 0 });
        });
      });

      items.forEach(strategy => {
        const { island } = strategy;
        if (!island || island.row === undefined || island.col === undefined) {
          results.set(strategy.key, { islandScore: 0, details: null });
          return;
        }
        const row = island.row;
        const col = island.col;
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
          results.set(strategy.key, { islandScore: 0, details: null });
          return;
        }
        const idx = row * cols + col;
        const componentInfo = componentMap.get(idx);
        if (!componentInfo) {
          results.set(strategy.key, { islandScore: 0, details: null });
          return;
        }
        results.set(strategy.key, {
          islandScore: clamp01(componentInfo.normalizedScore),
          details: {
            rawScore: componentInfo.rawScore,
            normalizedScore: clamp01(componentInfo.normalizedScore),
            area: areas,
            dispersion: dispersions,
            edge: edgeSharpness
          }
        });
      });
    });

    return results;
  }

  function computeSignificanceScore(strategy) {
    const psr = strategy?.psr ?? strategy?.significance?.psr;
    const dsr = strategy?.dsr ?? strategy?.significance?.dsr;
    let psrVal = isFiniteNumber(psr) ? clamp01(psr) : null;
    let dsrVal = null;
    if (isFiniteNumber(dsr)) {
      if (dsr >= 0 && dsr <= 1) {
        dsrVal = clamp01(dsr);
      } else {
        const eta = 0.5;
        dsrVal = clamp01(1 / (1 + Math.exp(-eta * dsr)));
      }
    }
    const score = Math.max(psrVal ?? 0, dsrVal ?? 0, 0);
    return { score: clamp01(score), psr: psrVal, dsr: dsrVal };
  }

  function deriveVerdict(ofiScore) {
    if (!isFiniteNumber(ofiScore)) return null;
    if (ofiScore >= DEFAULT_THRESHOLDS.verdict.excellent) return '👍 穩健';
    if (ofiScore >= DEFAULT_THRESHOLDS.verdict.good) return '✅ 良好';
    if (ofiScore >= DEFAULT_THRESHOLDS.verdict.fair) return '😐 一般';
    return '⚠️ 高風險';
  }

  function assembleStrategyScores(strategies, islandScores, config, flowScore) {
    return strategies.map(strategy => {
      const significance = computeSignificanceScore(strategy);
      const island = islandScores.get(strategy.key) || { islandScore: null };
      const components = [
        { weight: config?.weights?.strategy?.gamma1 ?? DEFAULT_WEIGHTS.strategy.gamma1, value: significance.score },
        { weight: config?.weights?.strategy?.gamma2 ?? DEFAULT_WEIGHTS.strategy.gamma2, value: strategy.oosScore },
        { weight: config?.weights?.strategy?.gamma3 ?? DEFAULT_WEIGHTS.strategy.gamma3, value: strategy.wfScore },
        { weight: config?.weights?.strategy?.gamma4 ?? DEFAULT_WEIGHTS.strategy.gamma4, value: island.islandScore }
      ];
      let weighted = 0;
      let weightSum = 0;
      components.forEach(component => {
        if (isFiniteNumber(component.value)) {
          weighted += component.weight * component.value;
          weightSum += component.weight;
        }
      });
      const strategyScore = weightSum > 0 ? clamp01(weighted / weightSum) : null;
      const wF = config?.weights?.final?.wF ?? DEFAULT_WEIGHTS.final.wF;
      const wS = config?.weights?.final?.wS ?? DEFAULT_WEIGHTS.final.wS;
      let ofiScore = null;
      if (isFiniteNumber(flowScore?.score) || isFiniteNumber(strategyScore)) {
        const flowPart = isFiniteNumber(flowScore?.score) ? wF * flowScore.score : 0;
        const strategyPart = isFiniteNumber(strategyScore) ? wS * strategyScore : 0;
        const weightFlow = isFiniteNumber(flowScore?.score) ? wF : 0;
        const weightStrategy = isFiniteNumber(strategyScore) ? wS : 0;
        const totalWeight = weightFlow + weightStrategy;
        if (totalWeight > 0) {
          ofiScore = clamp01((flowPart + strategyPart) / totalWeight) * 100;
        }
      }
      const verdict = deriveVerdict(ofiScore);
      return {
        key: strategy.key,
        index: strategy.index,
        score: strategyScore,
        ofi: isFiniteNumber(ofiScore) ? ofiScore : null,
        verdict,
        components: {
          significanceScore: significance.score,
          psr: significance.psr,
          dsr: significance.dsr,
          oosScore: strategy.oosScore,
          oosMidNorm: strategy.oosMidNorm,
          oosIqrNorm: strategy.oosIqrNorm,
          wfScore: strategy.wfScore,
          wfWrNorm: strategy.wfWrNorm,
          wfRetNorm: strategy.wfRetNorm,
          islandScore: island.islandScore
        }
      };
    });
  }

  function prepareStrategies(diagnostics, matrixOos = []) {
    const strategies = [];
    const sourceStrategies = diagnostics?.strategies || diagnostics?.strategyList || [];
    sourceStrategies.forEach((strategy, index) => {
      const key = strategy.key ?? strategy.id ?? strategy.strategyKey ?? index;
      const fallbackOos = Array.isArray(matrixOos) && Array.isArray(matrixOos[index]) ? matrixOos[index] : [];
      const cscvOos = toFiniteArray(strategy.cscv?.oos || strategy.cscvOos || strategy.oosValues || fallbackOos);
      const oosMedian = cscvOos.length > 0 ? median(cscvOos) : NaN;
      const oosIqr = cscvOos.length > 0 ? computeIqr(cscvOos) : NaN;
      let wfReturns = toFiniteArray(strategy.walkForward?.returns || strategy.walkForwardReturns || []);
      const wfAverage = wfReturns.length > 0 ? mean(wfReturns) : (isFiniteNumber(strategy.walkForward?.averageReturn) ? strategy.walkForward.averageReturn : null);
      let wfWinRate = strategy.walkForward?.winRate;
      if (!isFiniteNumber(wfWinRate) && wfReturns.length > 0) {
        const wins = wfReturns.filter(r => r > 0).length;
        wfWinRate = wins / wfReturns.length;
      }
      strategies.push({
        key,
        index: strategy.index ?? index,
        oosMedian: isFiniteNumber(oosMedian) ? oosMedian : null,
        oosIqr: isFiniteNumber(oosIqr) ? oosIqr : null,
        walkForwardAverage: isFiniteNumber(wfAverage) ? wfAverage : null,
        walkForwardWinRate: isFiniteNumber(wfWinRate) ? wfWinRate : null,
        island: strategy.island,
        psr: strategy.psr ?? strategy.significance?.psr,
        dsr: strategy.dsr ?? strategy.significance?.dsr,
        significance: strategy.significance,
        cscvOos
      });
    });
    return strategies;
  }

  function computeOfiFromDiagnostics(diagnostics, options = {}) {
    if (!diagnostics) {
      return null;
    }
    const config = {
      weights: {
        flow: { ...DEFAULT_WEIGHTS.flow, ...(options.weights?.flow || {}), ...(diagnostics.weights?.flow || {}) },
        strategy: { ...DEFAULT_WEIGHTS.strategy, ...(options.weights?.strategy || {}), ...(diagnostics.weights?.strategy || {}) },
        final: { ...DEFAULT_WEIGHTS.final, ...(options.weights?.final || {}), ...(diagnostics.weights?.final || {}) }
      },
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        ...(options.thresholds || {}),
        ...(diagnostics.thresholds || {})
      }
    };

    const flowSource = diagnostics.flow || diagnostics;
    const matrixOos = computeMatrixOosDistributions(flowSource);
    const strategies = prepareStrategies(diagnostics, matrixOos);
    const enrichedOos = computeOosScores(strategies, config);
    const enrichedWf = computeWalkForwardScores(enrichedOos);
    const islandScores = analyseIslandGrid(enrichedWf, config);
    const flowScore = computeFlowScore(diagnostics.flow || diagnostics, config);
    const strategyScores = assembleStrategyScores(enrichedWf, islandScores, config, flowScore);

    const strategyMap = new Map();
    strategyScores.forEach(item => {
      strategyMap.set(item.key, item);
      if (item.index !== undefined && item.index !== null) {
        strategyMap.set(item.index, item);
      }
    });

    return {
      version: MODULE_VERSION,
      flow: flowScore,
      strategies: strategyScores,
      strategyMap,
      config
    };
  }

  function evaluateBatchResult(result, options = {}) {
    if (!result) return { score: null };
    if (isFiniteNumber(result.ofi)) {
      return {
        score: result.ofi,
        verdict: deriveVerdict(result.ofi),
        flow: null,
        components: null
      };
    }
    const diagnostics = result.ofiDiagnostics || result.overfitDiagnostics || options.diagnostics;
    if (!diagnostics) return { score: null };
    const evaluation = computeOfiFromDiagnostics(diagnostics, options);
    if (!evaluation) return { score: null };
    const keyCandidates = [
      diagnostics.strategy?.key,
      diagnostics.strategyKey,
      diagnostics.key,
      result.strategyKey,
      result.strategyId,
      result.batchKey,
      result.id,
      result.buyStrategy && result.sellStrategy ? `${result.buyStrategy}__${result.sellStrategy}` : null
    ].filter(Boolean);
    let matched = null;
    for (let i = 0; i < keyCandidates.length && !matched; i += 1) {
      matched = evaluation.strategyMap.get(keyCandidates[i]);
    }
    if (!matched && diagnostics.strategy && diagnostics.strategy.index !== undefined) {
      matched = evaluation.strategyMap.get(diagnostics.strategy.index);
    }
    if (!matched && evaluation.strategies.length === 1) {
      matched = evaluation.strategies[0];
    }
    if (!matched) {
      return { score: null, flow: evaluation.flow };
    }
    return {
      score: matched.ofi,
      verdict: matched.verdict,
      flow: evaluation.flow,
      components: matched.components,
      strategyScore: matched.score
    };
  }

  const exported = global.lazybacktestOfi || {};
  exported.VERSION = MODULE_VERSION;
  exported.computeOfiFromDiagnostics = computeOfiFromDiagnostics;
  exported.evaluateBatchResult = evaluateBatchResult;
  exported.deriveVerdict = deriveVerdict;
  exported.computeFlowScore = computeFlowScore;
  exported.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
  exported.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;
  global.lazybacktestOfi = exported;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this);
