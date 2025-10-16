// Surrogate-Assisted Genetic Algorithm - LB-BATCH-SGA-20250715A
(function (global) {
    const VERSION = 'LB-BATCH-SGA-20250715A';

    function defaultRandom() {
        return Math.random();
    }

    function selectParents(population, count, randomFn) {
        const parents = [];
        const pool = population.slice();
        pool.sort((a, b) => (b.score ?? b.predictedScore ?? -Infinity) - (a.score ?? a.predictedScore ?? -Infinity));
        const limit = Math.min(count, pool.length);
        for (let i = 0; i < limit; i++) {
            parents.push(pool[i]);
        }
        while (parents.length < count && pool.length > 0) {
            const idx = Math.floor(randomFn() * pool.length);
            parents.push(pool[idx]);
        }
        return parents;
    }

    function crossover(a, b, randomFn, mutateFn) {
        if (!a || !b) return null;
        const clone = JSON.parse(JSON.stringify(a.candidate));
        const source = JSON.parse(JSON.stringify(b.candidate));
        if (clone.buyParams && source.buyParams) {
            for (const key of Object.keys(clone.buyParams)) {
                if (randomFn() < 0.5 && key in source.buyParams) {
                    clone.buyParams[key] = source.buyParams[key];
                }
            }
        }
        if (clone.sellParams && source.sellParams) {
            for (const key of Object.keys(clone.sellParams)) {
                if (randomFn() < 0.5 && key in source.sellParams) {
                    clone.sellParams[key] = source.sellParams[key];
                }
            }
        }
        if (typeof mutateFn === 'function') {
            return mutateFn(clone, { intensity: 0.35 });
        }
        return clone;
    }

    async function runSurrogateGA(options) {
        const {
            population = [],
            evaluate,
            scoreKey = 'score',
            generations = 6,
            topK = 4,
            mutationRate = 0.25,
            surrogateWarmup = 6,
            randomizeCandidate,
            toVector,
            randomFn = defaultRandom,
            surrogateFactory,
            onGenerationStart,
            onGenerationComplete,
            onEvaluation,
        } = options || {};

        if (typeof evaluate !== 'function') {
            throw new Error('[Surrogate-GA] evaluate callback is required');
        }
        if (typeof randomizeCandidate !== 'function') {
            throw new Error('[Surrogate-GA] randomizeCandidate callback is required');
        }
        if (typeof toVector !== 'function') {
            throw new Error('[Surrogate-GA] toVector callback is required');
        }

        const surrogateFactoryFn = surrogateFactory || (global.lazybacktestSurrogate && global.lazybacktestSurrogate.createRBFSurrogate);
        if (typeof surrogateFactoryFn !== 'function') {
            throw new Error('[Surrogate-GA] Surrogate factory not available');
        }
        const surrogate = surrogateFactoryFn();
        const workingPopulation = population.slice();
        const evaluatedHistory = [];

        async function evaluateAndTrack(individual, opts = {}) {
            const result = await evaluate(individual.candidate, opts);
            if (!result) return null;
            const score = Number(result[scoreKey]);
            individual.score = Number.isFinite(score) ? score : -Infinity;
            individual.predictedScore = individual.score;
            individual.result = result;
            individual.evaluated = true;
            surrogate.add(toVector(individual.candidate), individual.score);
            evaluatedHistory.push({ candidate: individual.candidate, result, score: individual.score, generation: opts.generation });
            if (typeof onEvaluation === 'function') {
                onEvaluation({ individual, result, generation: opts.generation, score: individual.score });
            }
            return individual;
        }

        // Warmup evaluations
        for (let i = 0; i < Math.min(surrogateWarmup, workingPopulation.length); i++) {
            await evaluateAndTrack(workingPopulation[i], { generation: 0 });
        }

        for (let generation = 1; generation <= generations; generation++) {
            if (typeof onGenerationStart === 'function') {
                onGenerationStart({ generation, totalGenerations: generations, population: workingPopulation.length });
            }

            // Predict scores for unevaluated individuals
            if (surrogate.size() > 0) {
                for (const individual of workingPopulation) {
                    if (individual.evaluated) continue;
                    const vector = toVector(individual.candidate);
                    individual.predictedScore = surrogate.predict(vector);
                }
            }

            workingPopulation.sort((a, b) => {
                const scoreA = Number.isFinite(a.score) ? a.score : (Number.isFinite(a.predictedScore) ? a.predictedScore : -Infinity);
                const scoreB = Number.isFinite(b.score) ? b.score : (Number.isFinite(b.predictedScore) ? b.predictedScore : -Infinity);
                return scoreB - scoreA;
            });

            const evaluateTargets = [];
            for (let i = 0; i < Math.min(topK, workingPopulation.length); i++) {
                if (!workingPopulation[i].evaluated) {
                    evaluateTargets.push(workingPopulation[i]);
                }
            }
            if (evaluateTargets.length === 0 && workingPopulation.length > 0) {
                evaluateTargets.push(workingPopulation[0]);
            }
            for (const target of evaluateTargets) {
                await evaluateAndTrack(target, { generation });
            }

            // Build next generation
            const nextPopulation = workingPopulation.slice(0, Math.min(topK, workingPopulation.length));
            while (nextPopulation.length < workingPopulation.length) {
                const parents = selectParents(workingPopulation, 2, randomFn);
                if (parents.length < 2) break;
                const childCandidate = crossover(parents[0], parents[1], randomFn, randomizeCandidate);
                if (!childCandidate) break;
                let mutated = childCandidate;
                if (randomFn() < mutationRate) {
                    mutated = randomizeCandidate(childCandidate, { intensity: 0.75, generation }) || childCandidate;
                }
                nextPopulation.push({
                    candidate: mutated,
                    evaluated: false,
                    score: null,
                    predictedScore: surrogate.size() > 0 ? surrogate.predict(toVector(mutated)) : null,
                });
            }

            // Fill if population shrank
            while (nextPopulation.length < population.length) {
                const base = workingPopulation[Math.floor(randomFn() * workingPopulation.length)] || workingPopulation[0];
                const fresh = randomizeCandidate(base ? base.candidate : null, { generation, intensity: 1 }) || base?.candidate;
                if (!fresh) break;
                nextPopulation.push({ candidate: fresh, evaluated: false, score: null, predictedScore: null });
            }

            workingPopulation.splice(0, workingPopulation.length, ...nextPopulation);

            if (typeof onGenerationComplete === 'function') {
                onGenerationComplete({
                    generation,
                    totalGenerations: generations,
                    evaluatedCount: evaluatedHistory.length,
                    bestScore: evaluatedHistory.length > 0 ? evaluatedHistory[evaluatedHistory.length - 1].score : null,
                });
            }
        }

        workingPopulation.sort((a, b) => {
            const scoreA = Number.isFinite(a.score) ? a.score : (Number.isFinite(a.predictedScore) ? a.predictedScore : -Infinity);
            const scoreB = Number.isFinite(b.score) ? b.score : (Number.isFinite(b.predictedScore) ? b.predictedScore : -Infinity);
            return scoreB - scoreA;
        });

        const evaluated = evaluatedHistory.slice();
        evaluated.sort((a, b) => b.score - a.score);

        return {
            VERSION,
            evaluated,
            best: evaluated.length > 0 ? evaluated[0] : null,
            population: workingPopulation,
        };
    }

    global.lazybacktestSurrogateGA = {
        VERSION,
        run: runSurrogateGA,
    };
})(typeof window !== 'undefined' ? window : self);
