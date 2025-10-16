// Patch Tag: LB-BATCH-HYBRID-20250215A
// Hyperband / Successive Halving runner
(function (globalScope) {
    const globalTarget = typeof globalScope !== 'undefined' ? globalScope : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));

    async function runHyperband({
        seed,
        maxBudget = 1.0,
        minBudget = 0.125,
        eta = 3,
        rounds = 3,
        generator,
        initCandidates = 60,
        evaluator,
        objective = (r) => r?.score ?? r?.annualizedReturn ?? -Infinity,
        onProgress = () => {},
        shouldStop = () => false
    }) {
        if (!generator || typeof generator.createInitialCandidates !== 'function') {
            throw new Error('Hyperband 需要提供 generator.createInitialCandidates');
        }
        if (!evaluator || typeof evaluator.evaluate !== 'function') {
            throw new Error('Hyperband 需要提供 evaluator.evaluate');
        }

        const rng = seedRandom(seed);
        const totalRounds = Math.max(1, rounds);
        const stageBudgets = buildBudgetLevels(minBudget, maxBudget, eta);
        const totalStages = stageBudgets.length * totalRounds;
        let completedStages = 0;
        let globalBest = null;

        for (let round = 1; round <= totalRounds; round++) {
            if (shouldStop()) break;
            let candidates = generator.createInitialCandidates(initCandidates, { seed: rng() });
            if (!Array.isArray(candidates) || candidates.length === 0) {
                break;
            }

            for (let stageIndex = 0; stageIndex < stageBudgets.length; stageIndex++) {
                if (shouldStop()) break;
                const budget = stageBudgets[stageIndex];
                const progressBase = completedStages / totalStages;
                const progress = Math.min(100, Math.round(((completedStages + 0.5) / totalStages) * 100));

                onProgress({
                    mode: 'hyperband',
                    round,
                    totalRounds,
                    stage: stageIndex + 1,
                    stageCount: stageBudgets.length,
                    budget,
                    candidatesRemaining: candidates.length,
                    progress
                });

                const evaluations = await evaluator.evaluate(candidates, { budget });
                if (Array.isArray(evaluations) && evaluations.length > 0) {
                    const sorted = evaluations.slice().sort((a, b) => objective(b) - objective(a));
                    if (!globalBest || objective(sorted[0]) > objective(globalBest)) {
                        globalBest = sorted[0];
                    }
                    const survivors = Math.max(1, Math.floor(sorted.length / eta));
                    candidates = sorted.slice(0, survivors).map(result => result.candidate || result.__candidate || result);
                } else {
                    // 沒有評估結果時提前結束
                    candidates = [];
                }
                completedStages += 1;
            }
        }

        onProgress({ mode: 'hyperband', progress: 100, completed: true, best: globalBest });
        return globalBest;
    }

    function buildBudgetLevels(minBudget, maxBudget, eta) {
        const levels = [];
        const start = Math.max(0.01, Math.min(minBudget, maxBudget));
        const end = Math.max(start, maxBudget);
        let current = start;
        while (current < end - 1e-6) {
            levels.push(Math.min(1, current));
            current *= eta;
            if (current > end) {
                current = end;
            }
        }
        if (levels.length === 0 || levels[levels.length - 1] !== Math.min(1, end)) {
            levels.push(Math.min(1, end));
        }
        return levels;
    }

    function seedRandom(seed) {
        if (!Number.isFinite(seed)) {
            return Math.random;
        }
        let value = Math.abs(Math.floor(seed)) % 2147483647;
        if (value === 0) value = 1;
        return function () {
            value = (value * 16807) % 2147483647;
            return (value - 1) / 2147483646;
        };
    }

    if (!globalTarget.lazybacktestOptimizers) {
        globalTarget.lazybacktestOptimizers = {};
    }
    globalTarget.lazybacktestOptimizers.runHyperband = runHyperband;
})(typeof self !== 'undefined' ? self : this);
