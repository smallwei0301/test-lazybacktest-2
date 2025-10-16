// Patch Tag: LB-BATCH-HYBRID-20250215A
// Surrogate-assisted genetic algorithm runner
(function (globalScope) {
    const globalTarget = typeof globalScope !== 'undefined' ? globalScope : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));

    async function runSurrogateGA({
        seed,
        popSize = 48,
        gens = 15,
        topK = 12,
        crossoverRate = 0.9,
        mutationRate = 0.15,
        elitism = 2,
        bounds,
        encodeVec,
        generator,
        evaluator,
        objective = (r) => r?.score ?? r?.annualizedReturn ?? -Infinity,
        onProgress = () => {},
        shouldStop = () => false
    }) {
        if (!generator || typeof generator.createInitialCandidates !== 'function') {
            throw new Error('Surrogate-GA 需要提供 generator.createInitialCandidates');
        }
        if (!generator.cloneCandidate || !generator.crossover || !generator.mutate) {
            throw new Error('Surrogate-GA 需要提供 cloneCandidate/crossover/mutate 方法');
        }
        if (!evaluator || typeof evaluator.evaluate !== 'function') {
            throw new Error('Surrogate-GA 需要提供 evaluator.evaluate');
        }
        if (typeof encodeVec !== 'function') {
            throw new Error('Surrogate-GA 需要 encodeVec 函式');
        }
        if (!globalTarget.lazybacktestOptimizers || typeof globalTarget.lazybacktestOptimizers.createRBFSurrogate !== 'function') {
            throw new Error('Surrogate 模型尚未載入');
        }

        const rng = seedRandom(seed);
        const surrogate = globalTarget.lazybacktestOptimizers.createRBFSurrogate();
        let population = generator.createInitialCandidates(popSize, { seed: rng() });
        let bestRecord = null;
        const evaluatedMap = new Map();

        for (let genIndex = 0; genIndex < gens; genIndex++) {
            if (shouldStop()) break;

            const evaluatedScores = [];
            const scoredPopulation = population.map(candidate => {
                const key = candidateKey(candidate);
                if (evaluatedMap.has(key)) {
                    const stored = evaluatedMap.get(key);
                    evaluatedScores.push({ candidate, score: stored.score, result: stored.result });
                    return stored.score;
                }
                if (surrogate.size() === 0) {
                    return 0;
                }
                const prediction = surrogate.predict(encodeVec(candidate));
                evaluatedScores.push({ candidate, score: prediction, result: null });
                return prediction;
            });

            const evaluatedSet = selectTopK(population, evaluatedScores, topK);
            const freshEvaluations = await evaluateUniqueCandidates(evaluatedSet, evaluator, evaluatedMap, objective, encodeVec, surrogate, shouldStop);
            freshEvaluations.forEach(record => {
                if (!bestRecord || objective(record.result) > objective(bestRecord.result)) {
                    bestRecord = record;
                }
            });

            const populationWithScores = population.map((candidate, idx) => {
                const key = candidateKey(candidate);
                if (evaluatedMap.has(key)) {
                    return { candidate, score: evaluatedMap.get(key).score };
                }
                const predicted = surrogate.size() > 0 ? surrogate.predict(encodeVec(candidate)) : 0;
                return { candidate, score: predicted };
            });

            populationWithScores.sort((a, b) => b.score - a.score);
            const elites = populationWithScores.slice(0, Math.min(elitism, populationWithScores.length)).map(entry => generator.cloneCandidate(entry.candidate));

            const newPopulation = elites.slice();
            while (newPopulation.length < popSize) {
                if (shouldStop()) break;
                const parentA = tournamentSelect(populationWithScores, rng);
                const parentB = tournamentSelect(populationWithScores, rng);
                let child;
                if (rng() < crossoverRate) {
                    child = generator.crossover(parentA, parentB);
                } else {
                    child = generator.cloneCandidate(rng() < 0.5 ? parentA : parentB);
                }
                if (rng() < mutationRate) {
                    child = generator.mutate(child, mutationRate);
                }
                if (typeof generator.ensureBounds === 'function') {
                    child = generator.ensureBounds(child);
                }
                newPopulation.push(child);
            }
            population = newPopulation.slice(0, popSize);

            const progress = Math.round(((genIndex + 1) / gens) * 100);
            onProgress({
                mode: 'surrogate-ga',
                gen: genIndex + 1,
                gens,
                surrogateSize: surrogate.size(),
                bestScore: bestRecord ? objective(bestRecord.result) : null,
                progress
            });
        }

        onProgress({ mode: 'surrogate-ga', progress: 100, completed: true, best: bestRecord?.result });
        return bestRecord ? bestRecord.result : null;
    }

    async function evaluateUniqueCandidates(candidates, evaluator, evaluatedMap, objective, encodeVec, surrogate, shouldStop) {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];
        const results = [];
        const toEvaluate = [];

        for (const candidate of candidates) {
            const key = candidateKey(candidate);
            if (!evaluatedMap.has(key)) {
                toEvaluate.push(candidate);
            } else {
                results.push(evaluatedMap.get(key));
            }
        }

        if (toEvaluate.length === 0 || shouldStop()) {
            return results;
        }

        const evaluations = await evaluator.evaluate(toEvaluate, { budget: 1 });
        if (Array.isArray(evaluations)) {
            evaluations.forEach(record => {
                if (!record) return;
                const candidate = record.candidate || record.__candidate || record;
                const key = candidateKey(candidate);
                const score = objective(record);
                const entry = { candidate, score, result: record };
                evaluatedMap.set(key, entry);
                const encoded = encodeVec(candidate);
                surrogate.add(encoded, score);
                results.push(entry);
            });
        }
        return results;
    }

    function selectTopK(population, scores, topK) {
        if (!Array.isArray(population) || population.length === 0) return [];
        const paired = population.map((candidate, idx) => ({ candidate, score: scores[idx] ?? 0 }));
        paired.sort((a, b) => b.score - a.score);
        return paired.slice(0, Math.min(topK, paired.length)).map(item => item.candidate);
    }

    function tournamentSelect(populationWithScores, rng, size = 3) {
        if (!populationWithScores || populationWithScores.length === 0) {
            throw new Error('Tournament selection requires non-empty population');
        }
        let best = null;
        for (let i = 0; i < size; i++) {
            const pick = populationWithScores[Math.floor(rng() * populationWithScores.length)];
            if (!best || pick.score > best.score) {
                best = pick;
            }
        }
        return best.candidate;
    }

    function candidateKey(candidate) {
        return JSON.stringify({
            combo: candidate.comboIndex,
            buy: candidate.buyStrategy,
            sell: candidate.sellStrategy,
            buyParams: candidate.buyParams,
            sellParams: candidate.sellParams,
            risk: candidate.riskManagement
        });
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
    globalTarget.lazybacktestOptimizers.runSurrogateGA = runSurrogateGA;
})(typeof self !== 'undefined' ? self : this);
