(function (global) {
    function resolveBudgets(minBudget, maxBudget, eta, rounds) {
        const budgets = [];
        let current = Math.max(0.01, Number(minBudget) || 0.1);
        const upper = Math.min(1, Number(maxBudget) || 1);
        for (let i = 0; i < Math.max(2, Math.floor(rounds) || 4); i++) {
            budgets.push(Math.min(upper, current));
            current *= eta;
            if (budgets[budgets.length - 1] >= upper) break;
        }
        if (budgets[budgets.length - 1] < upper) {
            budgets[budgets.length - 1] = upper;
        }
        return budgets;
    }

    function defaultScore(result) {
        if (!result || typeof result !== 'object') return Number.NEGATIVE_INFINITY;
        if (typeof result.score === 'number') return result.score;
        return Number.NEGATIVE_INFINITY;
    }

    async function run(options = {}) {
        const evaluator = options.evaluator;
        if (!evaluator || typeof evaluator.evaluate !== 'function') {
            throw new Error('Hyperband 需要提供 evaluator.evaluate');
        }
        const population = Array.isArray(options.population) ? options.population.slice() : [];
        if (population.length === 0) {
            throw new Error('Hyperband 需要至少一組候選參數');
        }
        const eta = Math.max(2, Number(options.eta) || 3);
        const budgets = resolveBudgets(options.minBudget, options.maxBudget, eta, options.rounds);
        const scoreFn = typeof options.score === 'function' ? options.score : defaultScore;
        const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
        let active = population.map((candidate) => ({ candidate }));
        const history = [];
        let finalResults = [];

        for (let roundIndex = 0; roundIndex < budgets.length && active.length > 0; roundIndex++) {
            if (shouldStop()) break;
            const budget = budgets[roundIndex];
            const totalRounds = budgets.length;
            const round = roundIndex + 1;
            const candidates = active.map((entry) => entry.candidate);
            options.onRoundStart?.({
                round,
                totalRounds,
                budget,
                candidateCount: candidates.length,
            });

            let progressCount = 0;
            const results = await evaluator.evaluate(candidates, {
                budget,
                shouldStop,
                onProgress: (payload) => {
                    progressCount = payload?.completed || progressCount + 1;
                    options.onCandidateEvaluated?.({
                        round,
                        totalRounds,
                        completed: progressCount,
                        total: payload?.total || candidates.length,
                        result: payload?.result || null,
                    });
                },
            });

            const paired = results
                .map((result, index) => ({
                    candidate: candidates[index],
                    result,
                    score: scoreFn(result),
                }))
                .filter((entry) => entry.result);

            history.push({
                round,
                budget,
                evaluations: paired,
            });

            if (paired.length === 0) break;

            paired.sort((a, b) => b.score - a.score);

            if (round === totalRounds || shouldStop()) {
                finalResults = paired.map((entry) => entry.result);
                break;
            }

            const survivors = Math.max(1, Math.ceil(paired.length / eta));
            active = paired.slice(0, survivors).map((entry) => ({ candidate: entry.candidate }));
        }

        if (finalResults.length === 0 && history.length > 0) {
            finalResults = history[history.length - 1].evaluations.map((entry) => entry.result).filter(Boolean);
        }

        return { finalResults, history };
    }

    global.lazybacktestHyperband = { run };
})(typeof window !== 'undefined' ? window : self);
