(function (global) {
    const surrogateFactory = global.lazybacktestSurrogate;

    function ensureIdFactory() {
        let counter = 0;
        return function ensureId(candidate) {
            if (candidate && (candidate.__optimizerId === undefined || candidate.__optimizerId === null)) {
                counter += 1;
                candidate.__optimizerId = counter;
            }
            return candidate;
        };
    }

    function tournamentSelect(pool, random, size = 3) {
        if (!Array.isArray(pool) || pool.length === 0) return null;
        let best = null;
        for (let i = 0; i < size; i += 1) {
            const entry = pool[Math.floor(random() * pool.length)];
            if (!best || (entry?.score ?? Number.NEGATIVE_INFINITY) > (best?.score ?? Number.NEGATIVE_INFINITY)) {
                best = entry;
            }
        }
        return best || pool[0];
    }

    async function run(options = {}) {
        if (!options.evaluator || typeof options.evaluator.evaluate !== 'function') {
            throw new Error('Surrogate-GA 需要提供 evaluator.evaluate');
        }

        const ensureId = ensureIdFactory();
        let population = Array.isArray(options.population) ? options.population.map(ensureId) : [];
        const populationSize = options.populationSize || population.length || 24;
        const randomIndividual = typeof options.randomIndividual === 'function' ? options.randomIndividual : null;
        if (population.length === 0 && randomIndividual) {
            for (let i = 0; i < populationSize; i += 1) {
                const candidate = ensureId(randomIndividual());
                if (candidate) population.push(candidate);
            }
        }
        if (population.length === 0) {
            throw new Error('Surrogate-GA 需要初始族群或 randomIndividual 工廠');
        }

        const generations = Math.max(1, Math.floor(options.generations || 6));
        const topK = Math.max(2, Math.min(population.length, options.topK || Math.ceil(populationSize / 4)));
        const mutationRate = Math.max(0, Math.min(1, Number(options.mutationRate) || 0.2));
        const crossoverRate = Math.max(0, Math.min(1, Number(options.crossoverRate) || 0.6));
        const warmup = Math.max(2, Math.min(population.length, options.warmup || topK));
        const clone = typeof options.clone === 'function' ? options.clone : (combo) => combo;
        const mutate = typeof options.mutate === 'function' ? options.mutate : (combo) => combo;
        const crossover = typeof options.crossover === 'function' ? options.crossover : (a) => clone(a);
        const vectorize = typeof options.vectorize === 'function' ? options.vectorize : () => [];
        const scoreFn = typeof options.score === 'function' ? options.score : ((result) => result?.score ?? Number.NEGATIVE_INFINITY);
        const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
        const random = typeof options.random === 'function' ? options.random : Math.random;
        const evaluator = options.evaluator;
        const surrogate = surrogateFactory && typeof surrogateFactory.createRBFSurrogate === 'function'
            ? surrogateFactory.createRBFSurrogate(options.surrogateOptions)
            : { add() {}, predict: () => 0, size: () => 0 };

        const evaluationCache = new Map();
        let bestResult = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        const history = [];

        const evaluateSet = async (candidates, generation, totalGenerations) => {
            if (!Array.isArray(candidates) || candidates.length === 0) return [];
            let progressCount = 0;
            const results = await evaluator.evaluate(candidates, {
                shouldStop,
                onProgress: (payload) => {
                    progressCount = payload?.completed || progressCount + 1;
                    options.onCandidateEvaluated?.({
                        generation,
                        totalGenerations,
                        evaluatedCount: progressCount,
                        toEvaluate: payload?.total || candidates.length,
                        result: payload?.result || null,
                    });
                }
            });
            results.forEach((result, idx) => {
                const candidate = candidates[idx];
                if (!candidate || !result) return;
                const id = candidate.__optimizerId;
                evaluationCache.set(id, result);
                const score = scoreFn(result);
                surrogate.add(vectorize(candidate), score);
                if (score > bestScore) {
                    bestScore = score;
                    bestResult = result;
                }
            });
            return results;
        };

        // 暖身資料
        await evaluateSet(population.slice(0, warmup), 0, generations);

        for (let generation = 1; generation <= generations; generation += 1) {
            if (shouldStop()) break;
            options.onGenerationStart?.({
                generation,
                totalGenerations: generations,
                populationSize: population.length,
                toEvaluate: topK,
                bestScore,
            });

            const scoredPopulation = population.map((candidate) => {
                const actual = evaluationCache.get(candidate.__optimizerId) || null;
                const prediction = actual ? scoreFn(actual) : (surrogate.size() > 0 ? surrogate.predict(vectorize(candidate)) : 0);
                const score = actual ? scoreFn(actual) : prediction;
                return { candidate, result: actual, score, predicted: prediction };
            });

            scoredPopulation.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

            const evaluationCandidates = scoredPopulation.slice(0, topK).map((entry) => entry.candidate);
            await evaluateSet(evaluationCandidates, generation, generations);

            scoredPopulation.forEach((entry) => {
                const actual = evaluationCache.get(entry.candidate.__optimizerId) || null;
                if (actual) {
                    entry.result = actual;
                    entry.score = scoreFn(actual);
                }
            });

            scoredPopulation.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
            history.push({ generation, evaluations: scoredPopulation.slice(0, topK) });

            if (generation === generations || shouldStop()) {
                break;
            }

            const nextPopulation = [];
            const eliteCount = Math.max(2, Math.floor(populationSize * 0.1));
            for (let i = 0; i < eliteCount && i < scoredPopulation.length; i += 1) {
                const elite = clone(scoredPopulation[i].candidate);
                if (elite) nextPopulation.push(ensureId(elite));
            }

            while (nextPopulation.length < populationSize) {
                const parentA = tournamentSelect(scoredPopulation, random) || scoredPopulation[0];
                const parentB = tournamentSelect(scoredPopulation, random) || parentA;
                let child = null;
                if (random() < crossoverRate) {
                    child = crossover(parentA.candidate, parentB.candidate);
                }
                if (!child && randomIndividual) {
                    child = randomIndividual();
                }
                if (child && random() < mutationRate) {
                    child = mutate(child);
                }
                if (child) {
                    nextPopulation.push(ensureId(child));
                }

                if (random() < 0.1 && randomIndividual) {
                    const fresh = ensureId(randomIndividual());
                    if (fresh) nextPopulation.push(fresh);
                }
            }

            population = nextPopulation.slice(0, populationSize);
        }

        const finalEntries = population
            .map((candidate) => ({
                candidate,
                result: evaluationCache.get(candidate.__optimizerId) || null,
            }))
            .filter((entry) => entry.result)
            .sort((a, b) => scoreFn(b.result) - scoreFn(a.result));

        const finalResults = finalEntries.length > 0
            ? finalEntries.slice(0, topK).map((entry) => entry.result)
            : Array.from(evaluationCache.values())
                .sort((a, b) => scoreFn(b) - scoreFn(a))
                .slice(0, topK);

        return { finalResults, history, bestResult };
    }

    global.lazybacktestSurrogateGA = { run };
})(typeof window !== 'undefined' ? window : self);
