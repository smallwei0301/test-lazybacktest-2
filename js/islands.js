(function (root) {
  const globalScope = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const namespace = globalScope.lazybacktestDiagnostics = globalScope.lazybacktestDiagnostics || {};
  const ISLAND_VERSION = "LB-ISLANDS-20251120A";

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

  function computeStdDev(values, mean) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const numeric = values.filter((value) => Number.isFinite(value));
    if (numeric.length === 0) return null;
    const resolvedMean = Number.isFinite(mean) ? mean : average(numeric);
    if (!Number.isFinite(resolvedMean)) return null;
    const variance = numeric.reduce((sum, value) => sum + Math.pow(value - resolvedMean, 2), 0) / numeric.length;
    return Math.sqrt(variance);
  }

  function computeIQR(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const q1Index = (sorted.length - 1) * 0.25;
    const q3Index = (sorted.length - 1) * 0.75;
    const lowerIndex = Math.floor(q1Index);
    const upperIndex = Math.ceil(q1Index);
    const lowerWeight = q1Index - lowerIndex;
    const q1 = lowerIndex === upperIndex
      ? sorted[lowerIndex]
      : sorted[lowerIndex] * (1 - lowerWeight) + sorted[upperIndex] * lowerWeight;
    const q3Lower = Math.floor(q3Index);
    const q3Upper = Math.ceil(q3Index);
    const q3Weight = q3Index - q3Lower;
    const q3 = q3Lower === q3Upper
      ? sorted[q3Lower]
      : sorted[q3Lower] * (1 - q3Weight) + sorted[q3Upper] * q3Weight;
    return q3 - q1;
  }

  function computePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const clamped = clamp(percentile, 0, 1);
    if (clamped === 0) return sorted[0];
    if (clamped === 1) return sorted[sorted.length - 1];
    const index = clamped * (sorted.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;
    if (lowerIndex === upperIndex) return sorted[lowerIndex];
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
  }

  function extractIslands(grid, options = {}) {
    if (!Array.isArray(grid) || grid.length === 0) {
      return {
        version: ISLAND_VERSION,
        islands: [],
        labels: [],
        threshold: null,
        adjacency: 4,
      };
    }

    const adjacency = options.adjacency === 8 ? 8 : 4;
    const thresholdPercentile = Number.isFinite(options.thresholdPercentile)
      ? clamp(options.thresholdPercentile, 0, 1)
      : 0.75;

    const rows = grid.length;
    const cols = Math.max(...grid.map((row) => (Array.isArray(row) ? row.length : 0)));
    const labels = Array.from({ length: rows }, () => Array(cols).fill(-1));
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

    const allValues = [];
    for (let r = 0; r < rows; r += 1) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c += 1) {
        const value = row[c];
        if (Number.isFinite(value)) {
          allValues.push(value);
        }
      }
    }

    if (allValues.length === 0) {
      return {
        version: ISLAND_VERSION,
        islands: [],
        labels,
        threshold: null,
        adjacency,
      };
    }

    const threshold = computePercentile(allValues, thresholdPercentile);
    const neighborOffsets = adjacency === 8
      ? [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [1, -1], [-1, 1], [-1, -1],
        ]
      : [
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ];

    const candidate = (value) => Number.isFinite(value) && value >= threshold;

    const islands = [];
    let islandId = 0;

    for (let r = 0; r < rows; r += 1) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c += 1) {
        if (visited[r][c]) continue;
        const value = row[c];
        if (!candidate(value)) {
          visited[r][c] = true;
          continue;
        }

        const queue = [[r, c]];
        visited[r][c] = true;
        labels[r][c] = islandId;

        const cells = [];
        const values = [];
        const boundaryValues = [];

        while (queue.length > 0) {
          const [currentR, currentC] = queue.shift();
          const currentValue = grid[currentR][currentC];
          if (!Number.isFinite(currentValue)) continue;

          cells.push([currentR, currentC]);
          values.push(currentValue);

          for (const [dr, dc] of neighborOffsets) {
            const nextR = currentR + dr;
            const nextC = currentC + dc;
            if (nextR < 0 || nextR >= rows || nextC < 0 || nextC >= cols) continue;
            const neighborRow = grid[nextR];
            if (!Array.isArray(neighborRow) || nextC >= neighborRow.length) continue;
            const neighborValue = neighborRow[nextC];
            if (candidate(neighborValue) && !visited[nextR][nextC]) {
              visited[nextR][nextC] = true;
              labels[nextR][nextC] = islandId;
              queue.push([nextR, nextC]);
            } else if (Number.isFinite(neighborValue)) {
              boundaryValues.push(neighborValue);
            }
          }
        }

        const area = cells.length;
        const meanValue = average(values);
        const medianValue = computePercentile(values, 0.5);
        const stdDev = computeStdDev(values, meanValue);
        const iqr = computeIQR(values);
        const boundaryMean = average(boundaryValues);
        const edgeSharpness = Number.isFinite(meanValue) && Number.isFinite(boundaryMean)
          ? meanValue - boundaryMean
          : 0;

        islands.push({
          id: islandId,
          area,
          cells,
          values,
          mean: Number.isFinite(meanValue) ? meanValue : null,
          median: Number.isFinite(medianValue) ? medianValue : null,
          stdDev: Number.isFinite(stdDev) ? stdDev : null,
          iqr: Number.isFinite(iqr) ? iqr : null,
          edgeSharpness: Number.isFinite(edgeSharpness) ? edgeSharpness : 0,
          boundaryValues,
        });

        islandId += 1;
      }
    }

    const maxArea = Math.max(0, ...islands.map((island) => island.area || 0));
    const maxIqr = Math.max(0, ...islands.map((island) => Number.isFinite(island.iqr) ? island.iqr : 0));
    const maxEdge = Math.max(0, ...islands.map((island) => Number.isFinite(island.edgeSharpness) ? Math.abs(island.edgeSharpness) : 0));

    for (const island of islands) {
      const areaScore = maxArea > 0 ? island.area / maxArea : 0;
      const dispersionPenalty = maxIqr > 0 && Number.isFinite(island.iqr) ? island.iqr / maxIqr : 0;
      const edgePenalty = maxEdge > 0 && Number.isFinite(island.edgeSharpness)
        ? Math.abs(island.edgeSharpness) / maxEdge
        : 0;
      const baseScore = areaScore;
      const penaltyWeight = clamp(options.penaltyWeight || 0.5, 0, 1);
      const combinedPenalty = clamp(
        (penaltyWeight * dispersionPenalty) + ((1 - penaltyWeight) * edgePenalty),
        0,
        1,
      );
      const score = clamp(baseScore * (1 - combinedPenalty), 0, 1);
      island.score = score;
    }

    return {
      version: ISLAND_VERSION,
      islands,
      labels,
      threshold,
      adjacency,
    };
  }

  function normalizeIslandScore(islands) {
    if (!Array.isArray(islands) || islands.length === 0) return 0;
    const best = Math.max(...islands.map((island) => Number.isFinite(island.score) ? island.score : 0));
    return clamp(best, 0, 1);
  }

  namespace.extractIslands = extractIslands;
  namespace.normalizeIslandScore = normalizeIslandScore;
  namespace.islandVersion = ISLAND_VERSION;
})(typeof self !== "undefined" ? self : this);
