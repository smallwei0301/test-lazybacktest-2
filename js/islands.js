// --- Island Robustness Utilities ---
// Patch Tag: LB-OVERFIT-SCORE-20250915A
(function(global) {
    const MODULE_VERSION = 'LB-ISLANDS-20250915A';

    function computeIslandInsights(results, context = {}) {
        if (!Array.isArray(results) || results.length === 0) {
            return [];
        }
        const {
            cscv,
            matrixRowIndices = [],
        } = context;

        const insights = results.map(() => ({ score: null, components: {} }));
        if (!cscv || !Array.isArray(cscv.oosDistributions)) {
            return fallbackUsingSensitivity(results, insights);
        }

        matrixRowIndices.forEach((resultIndex, matrixIndex) => {
            const distribution = cscv.oosDistributions[matrixIndex] || [];
            const championShare = ratio(cscv.championCounts?.[matrixIndex], cscv.evaluatedSplits || 0);
            const medianValue = median(distribution);
            const iqrValue = iqr(distribution);
            const maxValue = max(distribution);
            const minValue = min(distribution);

            const areaComponent = clamp01(championShare * 4);
            const dispersionBase = Math.abs(medianValue) > 1 ? Math.abs(medianValue) : 1;
            const dispersionComponent = 1 - clamp01((iqrValue || 0) / (dispersionBase * 1.5));
            const edgeSpan = Math.max(Math.abs(maxValue - medianValue), Math.abs(medianValue - minValue));
            const edgeComponent = 1 - clamp01(edgeSpan / (dispersionBase * 4));

            const combinedScore = clamp01(0.45 * areaComponent + 0.35 * dispersionComponent + 0.20 * edgeComponent);

            insights[resultIndex] = {
                score: combinedScore,
                components: {
                    version: MODULE_VERSION,
                    areaComponent,
                    dispersionComponent,
                    edgeComponent,
                    championShare,
                    medianValue,
                    iqrValue,
                },
            };
        });

        return fallbackUsingSensitivity(results, insights);
    }

    function fallbackUsingSensitivity(results, insights) {
        return results.map((result, idx) => {
            const base = insights[idx] || { score: null, components: {} };
            if (Number.isFinite(base.score) && base.score !== null) {
                return base;
            }
            const sensitivityScore = resolveSensitivityScore(result);
            if (sensitivityScore !== null) {
                const normalized = clamp01(sensitivityScore / 100);
                return {
                    score: normalized,
                    components: {
                        version: MODULE_VERSION,
                        source: 'sensitivity',
                        stabilityScore: sensitivityScore,
                    },
                };
            }
            const defaultScore = 0.5;
            return {
                score: defaultScore,
                components: {
                    version: MODULE_VERSION,
                    source: 'fallback',
                },
            };
        });
    }

    function resolveSensitivityScore(result) {
        const analysis = result?.parameterSensitivity || result?.sensitivityAnalysis;
        const candidate = analysis?.summary?.stabilityScore;
        if (Number.isFinite(candidate)) {
            return candidate;
        }
        return null;
    }

    function ratio(numerator, denominator) {
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
            return 0;
        }
        return numerator / denominator;
    }

    function clamp01(value) {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }

    function median(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    function iqr(values) {
        if (!Array.isArray(values) || values.length < 4) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        return sorted[q3Index] - sorted[q1Index];
    }

    function max(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return values.reduce((acc, value) => (Number.isFinite(value) && value > acc ? value : acc), -Infinity);
    }

    function min(values) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        return values.reduce((acc, value) => (Number.isFinite(value) && value < acc ? value : acc), Infinity);
    }

    global.lazyIslands = {
        version: MODULE_VERSION,
        computeIslandInsights,
    };
})(typeof window !== 'undefined' ? window : self);
