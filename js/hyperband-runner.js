/* global window */
// Patch Tag: LB-BATCH-HYPERBAND-20260130A — Hyperband/ASHA scheduler for batch優化。
(function initHyperbandModule(global) {
    if (global && global.LazybacktestHyperbandRunner) {
        return;
    }

    function safeScore(getScore, result) {
        if (typeof getScore !== 'function') return Number.NEGATIVE_INFINITY;
        try {
            const value = getScore(result);
            return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
        } catch (error) {
            console.error('[Hyperband] Score extraction failed:', error);
            return Number.NEGATIVE_INFINITY;
        }
    }

    async function runHyperband(config = {}) {
        const {
            initialPopulation = [],
            evaluatePopulation,
            getScore,
            budgets = [],
            eta = 3,
            rounds: requestedRounds,
            onRound,
            shouldStop,
        } = config;

        if (!Array.isArray(initialPopulation) || initialPopulation.length === 0) {
            console.warn('[Hyperband] Empty initial population, nothing to evaluate.');
            return { best: null, history: [] };
        }
        if (typeof evaluatePopulation !== 'function') {
            throw new Error('[Hyperband] Missing evaluatePopulation callback');
        }

        const history = [];
        let survivors = initialPopulation.slice();
        const sanitizedBudgets = Array.isArray(budgets) && budgets.length > 0
            ? budgets.filter((v) => Number.isFinite(v) && v > 0)
            : [1];
        const rounds = Number.isInteger(requestedRounds) && requestedRounds > 0
            ? Math.min(requestedRounds, sanitizedBudgets.length)
            : sanitizedBudgets.length;

        for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
            if (!Array.isArray(survivors) || survivors.length === 0) {
                break;
            }
            if (typeof shouldStop === 'function' && shouldStop()) {
                break;
            }

            const budget = sanitizedBudgets[Math.min(roundIndex, sanitizedBudgets.length - 1)];
            if (typeof onRound === 'function') {
                onRound({ type: 'start', roundIndex, budget, populationSize: survivors.length });
            }

            const evaluationResults = await evaluatePopulation(survivors, {
                roundIndex,
                budget,
            });

            const ranked = survivors.map((candidate, index) => {
                const result = Array.isArray(evaluationResults) ? evaluationResults[index] : null;
                const score = safeScore(getScore, result);
                if (result) {
                    history.push({ candidate, result, roundIndex, budget, score });
                }
                return { candidate, result, roundIndex, budget, score };
            }).filter((entry) => entry.candidate);

            ranked.sort((a, b) => b.score - a.score);

            const reduction = Number.isFinite(eta) && eta > 1 ? eta : 2;
            const survivorsCount = roundIndex === rounds - 1
                ? Math.max(1, Math.min(ranked.length, Math.ceil(ranked.length / reduction)))
                : Math.max(1, Math.ceil(ranked.length / reduction));
            survivors = ranked.slice(0, survivorsCount).map((entry) => entry.candidate);

            if (typeof onRound === 'function') {
                onRound({
                    type: 'end',
                    roundIndex,
                    budget,
                    evaluations: ranked,
                    survivors,
                });
            }
        }

        history.sort((a, b) => b.score - a.score);
        const best = history.length > 0 ? history[0] : null;
        return { best, history };
    }

    global.LazybacktestHyperbandRunner = {
        runHyperband,
    };
})(typeof window !== 'undefined' ? window : self);
