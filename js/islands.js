(function (global) {
  const namespace = global.lazybacktestOverfit || (global.lazybacktestOverfit = {});
  const ISLAND_VERSION = 'LB-OVERFIT-SCORING-20250915A';

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  function standardDeviation(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    const avg = mean(values);
    const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
    return Math.sqrt(Math.max(variance, 0));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function detectIslands(grid, options = {}) {
    if (!Array.isArray(grid) || grid.length === 0) {
      return {
        version: ISLAND_VERSION,
        quantile: options.quantile || 0.75,
        threshold: null,
        totalCells: 0,
        islands: [],
        membership: {},
      };
    }

    const rows = grid.length;
    const cols = grid.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    const values = [];
    const hasValueMatrix = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r += 1) {
      const row = Array.isArray(grid[r]) ? grid[r] : [];
      for (let c = 0; c < cols; c += 1) {
        const cell = row[c];
        if (cell && isFiniteNumber(cell.value)) {
          values.push(cell.value);
          hasValueMatrix[r][c] = true;
        }
      }
    }

    if (values.length === 0) {
      return {
        version: ISLAND_VERSION,
        quantile: options.quantile || 0.75,
        threshold: null,
        totalCells: 0,
        islands: [],
        membership: {},
      };
    }

    const quantile = clamp(isFiniteNumber(options.quantile) ? options.quantile : 0.75, 0, 0.99);
    const sortedValues = values.slice().sort((a, b) => a - b);
    const thresholdIndex = Math.max(0, Math.min(sortedValues.length - 1, Math.round((sortedValues.length - 1) * quantile)));
    const threshold = sortedValues[thresholdIndex];
    const minArea = Math.max(1, options.minArea || 3);
    const alpha = isFiniteNumber(options.alpha) ? options.alpha : 0.5;
    const beta = isFiniteNumber(options.beta) ? options.beta : 0.5;
    const gamma = isFiniteNumber(options.gamma) ? options.gamma : 1;
    const totalCells = values.length;

    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const islands = [];
    const membership = {};

    const neighborOffsets = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], /* self */ [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!hasValueMatrix[r][c]) {
          continue;
        }
        const cell = grid[r][c];
        if (!cell || !isFiniteNumber(cell.value) || cell.value < threshold) {
          continue;
        }
        if (visited[r][c]) {
          continue;
        }

        const queue = [[r, c]];
        visited[r][c] = true;
        const cells = [];
        const cellSet = new Set();
        const indices = [];
        const cellValues = [];
        const pboValues = [];

        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          const currentCell = grid[cr][cc];
          if (!currentCell || !isFiniteNumber(currentCell.value)) {
            continue;
          }
          cells.push([cr, cc]);
          cellSet.add(`${cr}#${cc}`);
          cellValues.push(currentCell.value);
          if (typeof currentCell.index === 'number') {
            indices.push(currentCell.index);
          }
          if (isFiniteNumber(currentCell.pbo)) {
            pboValues.push(currentCell.pbo);
          }

          for (let n = 0; n < neighborOffsets.length; n += 1) {
            const nr = cr + neighborOffsets[n][0];
            const nc = cc + neighborOffsets[n][1];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
              continue;
            }
            if (visited[nr][nc]) {
              continue;
            }
            if (!hasValueMatrix[nr][nc]) {
              continue;
            }
            const neighborCell = grid[nr][nc];
            if (!neighborCell || !isFiniteNumber(neighborCell.value) || neighborCell.value < threshold) {
              continue;
            }
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }

        if (cells.length < minArea) {
          continue;
        }

        const avgValue = mean(cellValues);
        const dispersion = standardDeviation(cellValues);
        const boundaryValues = [];
        for (let i = 0; i < cells.length; i += 1) {
          const [cr, cc] = cells[i];
          for (let n = 0; n < neighborOffsets.length; n += 1) {
            const nr = cr + neighborOffsets[n][0];
            const nc = cc + neighborOffsets[n][1];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
              continue;
            }
            if (cellSet.has(`${nr}#${nc}`)) {
              continue;
            }
            if (!hasValueMatrix[nr][nc]) {
              continue;
            }
            const neighborCell = grid[nr][nc];
            if (neighborCell && isFiniteNumber(neighborCell.value)) {
              boundaryValues.push(neighborCell.value);
            }
          }
        }
        const boundaryAverage = boundaryValues.length > 0 ? mean(boundaryValues) : avgValue;
        const edgeSharpness = Math.max(0, avgValue - boundaryAverage);
        const avgPbo = pboValues.length > 0 ? mean(pboValues) : null;
        const normArea = totalCells > 0 ? cells.length / totalCells : 0;
        const rawScore = normArea - alpha * dispersion - beta * edgeSharpness - gamma * (avgPbo || 0);

        islands.push({
          members: indices.slice(),
          cells,
          size: cells.length,
          normArea,
          dispersion,
          edgeSharpness,
          avgValue,
          avgPbo,
          rawScore,
        });
      }
    }

    if (islands.length === 0) {
      return {
        version: ISLAND_VERSION,
        quantile,
        threshold,
        totalCells,
        islands: [],
        membership: {},
      };
    }

    const rawScores = islands.map((island) => island.rawScore);
    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const denominator = maxScore - minScore;

    islands.forEach((island, index) => {
      const normalizedScore = denominator === 0 ? 1 : (island.rawScore - minScore) / denominator;
      island.normalizedScore = clamp(normalizedScore, 0, 1);
      island.id = index;
      island.members.forEach((memberIndex) => {
        if (typeof memberIndex === 'number') {
          membership[memberIndex] = {
            islandId: index,
            normalizedScore: island.normalizedScore,
            rawScore: island.rawScore,
          };
        }
      });
    });

    return {
      version: ISLAND_VERSION,
      quantile,
      threshold,
      totalCells,
      islands,
      membership,
    };
  }

  namespace.detectIslands = detectIslands;
  namespace.constants = namespace.constants || {};
  namespace.constants.ISLAND_VERSION = ISLAND_VERSION;
})(typeof window !== 'undefined' ? window : self);
