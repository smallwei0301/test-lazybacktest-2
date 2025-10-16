/* global window */
// Patch Tag: LB-BATCH-SURRO-GA-20260130A — Surrogate-assisted GA with selective回測。
(function initSurrogateGAModule(global) {
    if (global && global.LazybacktestSurrogateGA) {
        return;
    }

    function cloneObject(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }

    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function runTournament(entries, sampleSize, rng) {
        const pool = ensureArray(entries);
        if (pool.length === 0) return null;
        const size = Math.max(1, Math.min(sampleSize || 2, pool.length));
        let best = null;
        for (let i = 0; i < size; i += 1) {
            const pick = pool[Math.floor((rng() || Math.random()) * pool.length)];
            if (!best || (pick && pick.score > best.score)) {
                best = pick;
            }
        }
        return best;
    }

    async function runSurrogateGA(config = {}) {
        const {
            initialPopulation = [],
            evaluateReal,
            surrogateFactory,
            vectorize,
            getScore,
            spawnCandidate,
            mutateCandidate,
            crossoverCandidates,
            keyFn,
            options = {},
            shouldStop,
            onGeneration,
            rng = Math.random,
        } = config;

        if (typeof evaluateReal !== 'function') {
            throw new Error('[Surrogate-GA] evaluateReal callback is required');
        }
        if (typeof surrogateFactory !== 'function') {
            throw new Error('[Surrogate-GA] surrogateFactory callback is required');
        }
        if (typeof vectorize !== 'function') {
            throw new Error('[Surrogate-GA] vectorize callback is required');
        }
        if (typeof getScore !== 'function') {
            throw new Error('[Surrogate-GA] getScore callback is required');
        }

        const surrogate = surrogateFactory();
        if (!surrogate || typeof surrogate.add !== 'function' || typeof surrogate.predict !== 'function') {
            throw new Error('[Surrogate-GA] surrogateFactory must return an object with add/predict');
        }

        const populationSize = Math.max(1, Math.round(options.populationSize || initialPopulation.length || 20));
        const generations = Math.max(1, Math.round(options.generations || 6));
        const mutationRate = options.mutationRate === undefined ? 0.25 : Math.max(0, Math.min(1, options.mutationRate));
        const crossoverRate = options.crossoverRate === undefined ? 0.6 : Math.max(0, Math.min(1, options.crossoverRate));
        const topK = Math.max(1, Math.min(populationSize, Math.round(options.topK || Math.ceil(populationSize / 3))));
        const elitism = Math.max(1, Math.min(topK, Math.round(options.elitism || Math.ceil(topK / 2))));
        const warmupEvaluations = Math.max(topK, Math.round(options.warmupEvaluations || topK));
        const warmupBudget = options.warmupBudget && options.warmupBudget > 0 ? Math.min(1, options.warmupBudget) : 0.4;
        const mainBudget = options.mainBudget && options.mainBudget > 0 ? Math.min(1, options.mainBudget) : 1;
        const tournamentSize = Math.max(2, Math.round(options.tournamentSize || 3));
        const maxStagnation = Math.max(3, Math.round(options.maxStagnation || generations + 1));
        const key = typeof keyFn === 'function'
            ? keyFn
            : (candidate) => JSON.stringify(candidate || {});
        const spawn = typeof spawnCandidate === 'function'
            ? spawnCandidate
            : (() => null);
        const mutate = typeof mutateCandidate === 'function'
            ? mutateCandidate
            : ((candidate) => candidate);
        const crossover = typeof crossoverCandidates === 'function'
            ? crossoverCandidates
            : ((a, b) => (rng() < 0.5 ? cloneObject(a) : cloneObject(b)));

        const population = [];
        const uniqueMap = new Map();
        function pushCandidate(candidate) {
            if (!candidate) return false;
            const keyValue = key(candidate);
            if (!uniqueMap.has(keyValue)) {
                uniqueMap.set(keyValue, candidate);
                population.push(candidate);
                return true;
            }
            return false;
        }

        ensureArray(initialPopulation).forEach((candidate) => {
            pushCandidate(cloneObject(candidate));
        });

        let safetyCounter = 0;
        while (population.length < populationSize && safetyCounter < populationSize * 10) {
            const spawned = spawn({ index: population.length, attempt: safetyCounter });
            if (!pushCandidate(cloneObject(spawned))) {
                safetyCounter += 1;
            }
        }
        if (population.length === 0) {
            throw new Error('[Surrogate-GA] Unable to initialise population');
        }
        if (population.length > populationSize) {
            population.length = populationSize;
        }

        const fitnessCache = new Map();
        const history = [];
        let globalBest = null;
        let stagnation = 0;

        function registerRealResult(candidate, result, budget, generation) {
            const keyValue = key(candidate);
            const score = getScore(result);
            if (!Number.isFinite(score)) {
                return;
            }
            fitnessCache.set(keyValue, {
                candidate: cloneObject(candidate),
                result,
                score,
                budget,
                generation,
                isReal: true,
            });
            const vector = vectorize(candidate);
            if (Array.isArray(vector)) {
                surrogate.add(vector, score);
            }
            history.push({ candidate: cloneObject(candidate), result, score, generation, budget, isReal: true });
            if (!globalBest || score > globalBest.score) {
                globalBest = { candidate: cloneObject(candidate), result, score, generation, budget };
                stagnation = 0;
            }
        }

        async function evaluateBatch(candidates, budget, generation) {
            if (!Array.isArray(candidates) || candidates.length === 0) {
                return [];
            }
            const results = await evaluateReal(candidates, { budget, generation });
            const normalized = Array.isArray(results) ? results : [];
            for (let i = 0; i < candidates.length; i += 1) {
                const candidate = candidates[i];
                const result = normalized[i];
                if (result) {
                    registerRealResult(candidate, result, budget, generation);
                }
            }
            return normalized;
        }

        const warmupList = population.slice(0, Math.min(warmupEvaluations, population.length));
        if (warmupList.length > 0) {
            await evaluateBatch(warmupList, warmupBudget, -1);
        }

        function buildAnnotatedPopulation(pop) {
            return pop.map((candidate) => {
                const keyValue = key(candidate);
                const cached = fitnessCache.get(keyValue);
                if (cached && cached.isReal) {
                    return {
                        candidate,
                        key: keyValue,
                        result: cached.result,
                        score: cached.score,
                        budget: cached.budget,
                        generation: cached.generation,
                        isReal: true,
                    };
                }
                const vector = vectorize(candidate);
                const predicted = surrogate.size() > 0 && Array.isArray(vector)
                    ? surrogate.predict(vector)
                    : 0;
                return {
                    candidate,
                    key: keyValue,
                    result: cached ? cached.result : null,
                    score: Number.isFinite(predicted) ? predicted : 0,
                    budget: cached ? cached.budget : 0,
                    generation: cached ? cached.generation : null,
                    isReal: Boolean(cached && cached.isReal),
                };
            });
        }

        for (let generation = 0; generation < generations; generation += 1) {
            if (typeof shouldStop === 'function' && shouldStop()) {
                break;
            }

            const annotated = buildAnnotatedPopulation(population);
            const sortedByScore = annotated.slice().sort((a, b) => b.score - a.score);
            const evalTargets = [];
            for (let i = 0; i < sortedByScore.length && evalTargets.length < topK; i += 1) {
                const entry = sortedByScore[i];
                const cached = fitnessCache.get(entry.key);
                const needsUpgrade = !cached || !cached.isReal || !Number.isFinite(cached.score) || (cached.budget || 0) < (mainBudget - 1e-4);
                if (needsUpgrade) {
                    evalTargets.push(entry.candidate);
                }
            }

            if (evalTargets.length > 0) {
                await evaluateBatch(evalTargets, mainBudget, generation);
            } else {
                stagnation += 1;
            }

            const refreshedAnnotated = buildAnnotatedPopulation(population);
            refreshedAnnotated.sort((a, b) => {
                if (a.isReal && b.isReal) return b.score - a.score;
                if (a.isReal) return -1;
                if (b.isReal) return 1;
                return b.score - a.score;
            });
            const bestEntry = refreshedAnnotated[0] || null;
            if (bestEntry && bestEntry.isReal) {
                if (!globalBest || bestEntry.score > globalBest.score) {
                    globalBest = {
                        candidate: cloneObject(bestEntry.candidate),
                        result: bestEntry.result,
                        score: bestEntry.score,
                        generation,
                        budget: bestEntry.budget,
                    };
                    stagnation = 0;
                } else {
                    stagnation += 1;
                }
            }

            if (typeof onGeneration === 'function') {
                onGeneration({
                    generation,
                    population: refreshedAnnotated,
                    best: bestEntry,
                    surrogateSize: surrogate.size(),
                    stagnation,
                });
            }

            if (generation === generations - 1) {
                break;
            }
            if (stagnation >= maxStagnation) {
                break;
            }

            const elites = refreshedAnnotated.slice(0, elitism).map((entry) => cloneObject(entry.candidate));
            const nextPopulation = elites.slice();
            const candidatePool = refreshedAnnotated.slice(0, Math.max(topK, elites.length));
            safetyCounter = 0;
            while (nextPopulation.length < populationSize && safetyCounter < populationSize * 10) {
                safetyCounter += 1;
                let child = null;
                if (rng() < crossoverRate && candidatePool.length >= 2) {
                    const parentA = runTournament(candidatePool, tournamentSize, rng);
                    const parentB = runTournament(candidatePool, tournamentSize, rng);
                    if (parentA && parentB) {
                        child = crossover(parentA.candidate, parentB.candidate, { generation });
                    }
                }
                if (!child && candidatePool.length > 0) {
                    const parent = runTournament(candidatePool, tournamentSize, rng);
                    if (parent) {
                        child = cloneObject(parent.candidate);
                    }
                }
                if (!child) {
                    child = cloneObject(spawn({ generation, index: nextPopulation.length }));
                }
                if (!child) {
                    continue;
                }
                if (rng() < mutationRate) {
                    child = cloneObject(mutate(child, { generation }));
                }
                const keyValue = key(child);
                if (!uniqueMap.has(keyValue)) {
                    uniqueMap.set(keyValue, child);
                    nextPopulation.push(child);
                }
            }
            while (nextPopulation.length < populationSize) {
                const filler = cloneObject(spawn({ generation, index: nextPopulation.length }));
                if (!filler) break;
                const keyValue = key(filler);
                if (!uniqueMap.has(keyValue)) {
                    uniqueMap.set(keyValue, filler);
                    nextPopulation.push(filler);
                }
            }
            if (nextPopulation.length === 0) {
                break;
            }
            population.length = 0;
            population.push(...nextPopulation.slice(0, populationSize));
        }

        const best = globalBest
            ? { ...globalBest }
            : null;
        return {
            best,
            history,
            cache: fitnessCache,
            surrogateSize: surrogate.size(),
        };
    }

    global.LazybacktestSurrogateGA = {
        runSurrogateGA,
    };
})(typeof window !== 'undefined' ? window : self);
