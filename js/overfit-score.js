(function(global) {
    const OVERFIT_VERSION_CODE = 'LB-OVERFIT-SCORING-20250709A';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function classifyPboRisk(pbo) {
        if (!Number.isFinite(pbo)) return '資料不足';
        if (pbo < 0.15) return '低風險';
        if (pbo < 0.35) return '中風險';
        return '高風險';
    }

    function evaluateIslands(islands, options = {}) {
        if (!Array.isArray(islands) || islands.length === 0) {
            return { islands: [], stats: { maxArea: 0, maxDispersion: 0, maxEdgeSharpness: 0 } };
        }

        const safeIslands = islands.map((island) => ({
            ...island,
            area: Number.isFinite(island.area) ? island.area : 0,
            dispersion: Number.isFinite(island.dispersion) ? island.dispersion : 0,
            edgeSharpness: Number.isFinite(island.edgeSharpness) ? island.edgeSharpness : 0,
            avgPbo: Number.isFinite(island.avgPbo) ? island.avgPbo : 0,
        }));

        const maxArea = Math.max(...safeIslands.map((island) => island.area), 0);
        const maxDispersion = Math.max(...safeIslands.map((island) => island.dispersion), 0);
        const maxEdgeSharpness = Math.max(...safeIslands.map((island) => island.edgeSharpness), 0);

        const weights = {
            area: Number.isFinite(options.areaWeight) ? options.areaWeight : 1,
            dispersion: Number.isFinite(options.dispersionWeight) ? options.dispersionWeight : 0.5,
            edge: Number.isFinite(options.edgeWeight) ? options.edgeWeight : 0.5,
            pbo: Number.isFinite(options.pboWeight) ? options.pboWeight : 1,
        };
        const totalWeight = weights.area + weights.dispersion + weights.edge + weights.pbo;

        const scoredIslands = safeIslands.map((island) => {
            const normArea = maxArea > 0 ? clamp(island.area / maxArea, 0, 1) : 0;
            const dispersionNorm = maxDispersion > 0 ? clamp(island.dispersion / maxDispersion, 0, 1) : 0;
            const edgeNorm = maxEdgeSharpness > 0 ? clamp(island.edgeSharpness / maxEdgeSharpness, 0, 1) : 0;
            const avgPbo = clamp(island.avgPbo, 0, 1);

            const stabilityScore = 1 - dispersionNorm;
            const smoothnessScore = 1 - edgeNorm;
            const lowPboScore = 1 - avgPbo;

            const weightedSum = (
                weights.area * normArea +
                weights.dispersion * stabilityScore +
                weights.edge * smoothnessScore +
                weights.pbo * lowPboScore
            );
            const score = totalWeight > 0 ? clamp(weightedSum / totalWeight, 0, 1) : 0;

            return {
                ...island,
                normArea,
                dispersionNorm,
                edgeNorm,
                avgPbo,
                stabilityScore,
                smoothnessScore,
                lowPboScore,
                score,
            };
        });

        return {
            islands: scoredIslands,
            stats: {
                maxArea,
                maxDispersion,
                maxEdgeSharpness,
            },
        };
    }

    function computeOverfitScore(components, options = {}) {
        const weights = {
            pbo: Number.isFinite(options.pboWeight) ? options.pboWeight : 0.5,
            dsr: Number.isFinite(options.dsrWeight) ? options.dsrWeight : 0.25,
            island: Number.isFinite(options.islandWeight) ? options.islandWeight : 0.25,
        };
        const pbo = Number.isFinite(components.pbo) ? clamp(components.pbo, 0, 1) : 1;
        const dsr = Number.isFinite(components.dsr) ? clamp(components.dsr, 0, 1) : 0;
        const islandScore = Number.isFinite(components.islandScore) ? clamp(components.islandScore, 0, 1) : 0;

        const pboPenalty = weights.pbo * (pbo * 100);
        const dsrPenalty = weights.dsr * Math.max(0, 50 - dsr * 50);
        const islandPenalty = weights.island * (50 - islandScore * 50);
        const score = clamp(100 - (pboPenalty + dsrPenalty + islandPenalty), 0, 100);
        return {
            version: OVERFIT_VERSION_CODE,
            score,
            components: {
                pboPenalty,
                dsrPenalty,
                islandPenalty,
            },
            weights,
        };
    }

    if (!global.lazybacktestOverfit) {
        global.lazybacktestOverfit = {};
    }

    if (!global.lazybacktestOverfit.overfit) {
        global.lazybacktestOverfit.overfit = {};
    }

    global.lazybacktestOverfit.overfit.evaluateIslands = evaluateIslands;
    global.lazybacktestOverfit.overfit.computeOverfitScore = computeOverfitScore;
    global.lazybacktestOverfit.overfit.classifyPboRisk = classifyPboRisk;
    global.lazybacktestOverfit.overfit.version = OVERFIT_VERSION_CODE;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
