// Hyperband/ASHA Runner - LB-BATCH-HYPERBAND-20250715A
(function (global) {
    const VERSION = 'LB-BATCH-HYPERBAND-20250715A';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function ensureArray(input) {
        if (!Array.isArray(input)) return [];
        return input.slice();
    }

    async function runHyperband(options) {
        const {
            candidates = [],
            evaluate,
            scoreKey = 'score',
            minBudget = 0.2,
            maxBudget = 1,
            eta = 3,
            rounds = 3,
            initCandidates = 12,
            onRoundStart,
            onRoundComplete,
            onCandidateEvaluated,
            randomizeCandidate,
        } = options || {};

        if (typeof evaluate !== 'function') {
            throw new Error('[Hyperband] evaluate callback is required');
        }

        const preparedCandidates = ensureArray(candidates);
        if (typeof randomizeCandidate === 'function' && preparedCandidates.length < initCandidates) {
            const pool = preparedCandidates.slice();
            let index = 0;
            while (pool.length < initCandidates && pool.length > 0) {
                const base = pool[index % pool.length];
                const cloned = randomizeCandidate(base, { budget: minBudget, round: 0, index: pool.length });
                if (cloned) {
                    pool.push(cloned);
                } else {
                    break;
                }
                index++;
            }
            while (pool.length < initCandidates && preparedCandidates.length > 0) {
                const base = preparedCandidates[Math.floor(Math.random() * preparedCandidates.length)];
                const fallback = randomizeCandidate ? randomizeCandidate(base, { budget: minBudget, round: 0, index: pool.length }) : null;
                if (fallback) {
                    pool.push(fallback);
                } else {
                    break;
                }
            }
            if (pool.length > preparedCandidates.length) {
                preparedCandidates.splice(0, preparedCandidates.length, ...pool);
            }
        }

        const runPool = preparedCandidates.slice(0, Math.max(initCandidates, 1));
        if (runPool.length === 0) {
            throw new Error('[Hyperband] No candidates provided');
        }

        const budgets = [];
        let currentBudget = clamp(minBudget, 0.05, 1);
        for (let i = 0; i < rounds; i++) {
            budgets.push(clamp(currentBudget, 0.05, 1));
            currentBudget *= eta;
            if (currentBudget > maxBudget) {
                budgets.push(clamp(maxBudget, 0.05, 1));
                break;
            }
        }

        const evaluatedHistory = [];
        let survivors = runPool.map((candidate, idx) => ({ candidate, id: idx + 1 }));

        for (let roundIndex = 0; roundIndex < budgets.length; roundIndex++) {
            const budget = budgets[roundIndex];
            if (typeof onRoundStart === 'function') {
                onRoundStart({ round: roundIndex + 1, totalRounds: budgets.length, budget, count: survivors.length });
            }

            const roundResults = [];
            for (let i = 0; i < survivors.length; i++) {
                const item = survivors[i];
                const evalResult = await evaluate(item.candidate, { budget, round: roundIndex + 1, index: i });
                if (!evalResult) continue;
                const score = Number(evalResult[scoreKey]);
                const payload = {
                    candidate: item.candidate,
                    result: evalResult,
                    score: Number.isFinite(score) ? score : -Infinity,
                    budget,
                    round: roundIndex + 1,
                };
                roundResults.push(payload);
                evaluatedHistory.push(payload);
                if (typeof onCandidateEvaluated === 'function') {
                    onCandidateEvaluated({
                        round: roundIndex + 1,
                        budget,
                        candidate: item.candidate,
                        result: evalResult,
                        score: payload.score,
                        index: i,
                    });
                }
            }

            roundResults.sort((a, b) => b.score - a.score);
            const keepCount = Math.max(1, Math.floor(roundResults.length / eta));
            const survivorsForNext = roundResults.slice(0, keepCount);
            survivors = survivorsForNext.map((entry, idx) => ({
                candidate: typeof randomizeCandidate === 'function'
                    ? randomizeCandidate(entry.candidate, { budget: budgets[Math.min(roundIndex + 1, budgets.length - 1)], round: roundIndex + 1, index: idx }) || entry.candidate
                    : entry.candidate,
                id: entry.id || (idx + 1),
            }));

            if (typeof onRoundComplete === 'function') {
                onRoundComplete({
                    round: roundIndex + 1,
                    totalRounds: budgets.length,
                    budget,
                    survivors: survivors.length,
                    results: roundResults,
                });
            }

            if (survivors.length <= 1 && roundIndex < budgets.length - 1) {
                break;
            }
        }

        evaluatedHistory.sort((a, b) => b.score - a.score);
        return {
            version: VERSION,
            evaluated: evaluatedHistory,
            best: evaluatedHistory.length > 0 ? evaluatedHistory[0] : null,
        };
    }

    global.lazybacktestHyperbandRunner = {
        VERSION,
        run: runHyperband,
    };
})(typeof window !== 'undefined' ? window : self);
