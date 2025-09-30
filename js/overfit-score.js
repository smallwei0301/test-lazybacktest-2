(function(global) {
    const OVERFIT_VERSION_CODE = 'LB-OVERFIT-SCORING-20250705A';

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
        const maxArea = Math.max(...islands.map((island) => island.area || 0), 0);
        const maxDispersion = Math.max(...islands.map((island) => island.dispersion || 0), 0);
        const maxEdgeSharpness = Math.max(...islands.map((island) => island.edgeSharpness || 0), 0);
        const weights = {
            dispersion: Number.isFinite(options.dispersionWeight) ? options.dispersionWeight : 0.5,
            edge: Number.isFinite(options.edgeWeight) ? options.edgeWeight : 0.5,
            pbo: Number.isFinite(options.pboWeight) ? options.pboWeight : 1,
        };

        const scoredIslands = islands.map((island) => {
            const normArea = maxArea > 0 ? clamp((island.area || 0) / maxArea, 0, 1) : 0;
            const dispersionNorm = maxDispersion > 0 ? clamp((island.dispersion || 0) / maxDispersion, 0, 1) : 0;
            const edgeNorm = maxEdgeSharpness > 0 ? clamp((island.edgeSharpness || 0) / maxEdgeSharpness, 0, 1) : 0;
            const avgPbo = Number.isFinite(island.avgPbo) ? clamp(island.avgPbo, 0, 1) : 0;
            const rawScore = normArea - weights.dispersion * dispersionNorm - weights.edge * edgeNorm - weights.pbo * avgPbo;
            const score = clamp(rawScore, 0, 1);
            return {
                ...island,
                normArea,
                dispersionNorm,
                edgeNorm,
                avgPbo,
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
