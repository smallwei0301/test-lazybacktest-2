(function(global) {
    const OVERFIT_VERSION_CODE = 'LB-OVERFIT-SCORING-20250705A';

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function quantile(values, q) {
        const valid = values.filter(isFiniteNumber).sort((a, b) => a - b);
        if (valid.length === 0) return null;
        const pos = (valid.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (base + 1 < valid.length) {
            return valid[base] + rest * (valid[base + 1] - valid[base]);
        }
        return valid[base];
    }

    function median(values) {
        return quantile(values, 0.5);
    }

    function standardDeviation(values) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length < 2) return 0;
        const mean = valid.reduce((acc, value) => acc + value, 0) / valid.length;
        const variance = valid.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / (valid.length - 1);
        return Math.sqrt(Math.max(variance, 0));
    }

    function minPositiveDiff(values) {
        const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
        let minDiff = null;
        for (let i = 1; i < sorted.length; i++) {
            const diff = sorted[i] - sorted[i - 1];
            if (diff > 0 && (minDiff === null || diff < minDiff)) {
                minDiff = diff;
            }
        }
        return minDiff;
    }

    function extractIslands(points, options = {}) {
        if (!Array.isArray(points) || points.length === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                islands: [],
                assignments: new Map(),
                threshold: null,
                notes: ['no_points']
            };
        }

        const scores = points.map((point) => point.score).filter(isFiniteNumber);
        if (scores.length === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                islands: [],
                assignments: new Map(),
                threshold: null,
                notes: ['no_scores']
            };
        }

        const threshold = Number.isFinite(options.threshold)
            ? options.threshold
            : quantile(scores, options.quantile ?? 0.75);

        const candidatePoints = points.filter((point) => isFiniteNumber(point.score) && point.score >= threshold);
        if (candidatePoints.length === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                islands: [],
                assignments: new Map(),
                threshold,
                notes: ['no_candidates']
            };
        }

        const xs = candidatePoints.map((point) => point.x ?? 0);
        const ys = candidatePoints.map((point) => point.y ?? 0);
        const stepX = minPositiveDiff(xs) ?? 1;
        const stepY = minPositiveDiff(ys) ?? (stepX || 1);
        const toleranceX = (options.toleranceMultiplier ?? 1.5) * stepX;
        const toleranceY = (options.toleranceMultiplier ?? 1.5) * stepY;

        const visited = new Set();
        const assignments = new Map();
        const islands = [];

        candidatePoints.forEach((point) => {
            if (visited.has(point.id)) return;
            const queue = [point];
            visited.add(point.id);
            const members = [];
            while (queue.length > 0) {
                const current = queue.shift();
                members.push(current);
                candidatePoints.forEach((neighbor) => {
                    if (visited.has(neighbor.id)) return;
                    const dx = Math.abs((neighbor.x ?? 0) - (current.x ?? 0));
                    const dy = Math.abs((neighbor.y ?? 0) - (current.y ?? 0));
                    if (dx <= toleranceX + 1e-9 && dy <= toleranceY + 1e-9) {
                        visited.add(neighbor.id);
                        queue.push(neighbor);
                    }
                });
            }
            members.forEach((member) => assignments.set(member.id, islands.length));
            islands.push({ members });
        });

        const scoredIslands = islands.map((island, index) => {
            const memberScores = island.members.map((member) => member.score).filter(isFiniteNumber);
            const avgScore = memberScores.length > 0
                ? memberScores.reduce((acc, value) => acc + value, 0) / memberScores.length
                : null;
            const medianScore = median(memberScores);
            const dispersion = standardDeviation(memberScores);
            const avgPbo = island.members
                .map((member) => member.pbo)
                .filter(isFiniteNumber);
            const avgPboValue = avgPbo.length > 0
                ? avgPbo.reduce((acc, value) => acc + value, 0) / avgPbo.length
                : null;

            return {
                id: index,
                members: island.members.map((member) => member.id),
                area: island.members.length,
                avgScore,
                medianScore,
                dispersion,
                avgPbo: avgPboValue,
                rawMembers: island.members,
            };
        });

        const allNeighborScores = [];
        candidatePoints.forEach((point) => {
            const islandId = assignments.get(point.id);
            const island = scoredIslands[islandId];
            const neighbors = points.filter((other) => !assignments.has(other.id));
            const neighborScores = neighbors
                .filter((neighbor) => {
                    const dx = Math.abs((neighbor.x ?? 0) - (point.x ?? 0));
                    const dy = Math.abs((neighbor.y ?? 0) - (point.y ?? 0));
                    return dx <= toleranceX * 2 + 1e-9 && dy <= toleranceY * 2 + 1e-9;
                })
                .map((neighbor) => neighbor.score)
                .filter(isFiniteNumber);
            if (neighborScores.length > 0) {
                allNeighborScores.push({ islandId, scores: neighborScores });
            }
        });

        const edgeSharpnessByIsland = new Map();
        allNeighborScores.forEach((entry) => {
            const existing = edgeSharpnessByIsland.get(entry.islandId) || [];
            edgeSharpnessByIsland.set(entry.islandId, existing.concat(entry.scores));
        });

        scoredIslands.forEach((island) => {
            const neighborScores = edgeSharpnessByIsland.get(island.id) || [];
            if (neighborScores.length > 0 && isFiniteNumber(island.medianScore)) {
                const neighborMedian = median(neighborScores);
                island.edgeSharpness = isFiniteNumber(neighborMedian)
                    ? Math.max(0, island.medianScore - neighborMedian)
                    : 0;
            } else {
                island.edgeSharpness = 0;
            }
        });

        return {
            version: OVERFIT_VERSION_CODE,
            threshold,
            stepX,
            stepY,
            islands: scoredIslands,
            assignments,
        };
    }

    if (!global.lazybacktestOverfit) {
        global.lazybacktestOverfit = {};
    }

    if (!global.lazybacktestOverfit.islands) {
        global.lazybacktestOverfit.islands = {};
    }

    global.lazybacktestOverfit.islands.extractIslands = extractIslands;
    global.lazybacktestOverfit.islands.version = OVERFIT_VERSION_CODE;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
