// --- Genetic Algorithm Runner ---
// Version code: LB-GA-RUNNER-20250214A
/* global indexedDB */
(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        global.lazybacktestGA = factory();
    }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    const GA_MODULE_VERSION = 'LB-GA-RUNNER-20250214A';

    function hashString(input) {
        let h = 0;
        const str = String(input);
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return h >>> 0;
    }

    function createSeededRandom(seed) {
        let state = 0;
        if (typeof seed === 'number' && Number.isFinite(seed)) {
            state = seed >>> 0;
        } else if (typeof seed === 'string') {
            state = hashString(seed);
        } else {
            state = Math.floor(Math.random() * 0x7fffffff);
        }
        if (state === 0) state = 0x1a2b3c4d;
        return function () {
            state |= 0;
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function clamp(value, min, max) {
        if (Number.isFinite(min) && value < min) return min;
        if (Number.isFinite(max) && value > max) return max;
        return value;
    }

    function countDecimals(step) {
        if (!Number.isFinite(step)) return 0;
        const stepStr = step.toString();
        if (!stepStr.includes('.')) return 0;
        return stepStr.split('.')[1].length;
    }

    function sampleNumeric(range, rng) {
        if (!range || typeof range.from === 'undefined' || typeof range.to === 'undefined') {
            return 0;
        }
        const min = Number(range.from);
        const max = Number(range.to);
        const step = Number(range.step || 1);
        const steps = Math.max(0, Math.round((max - min) / step));
        const pick = Math.min(steps, Math.floor(rng() * (steps + 1)));
        const value = min + pick * step;
        const decimals = countDecimals(step);
        return Number(decimals > 0 ? value.toFixed(decimals) : value);
    }

    function sampleBoolean(rng) {
        return rng() < 0.5;
    }

    function sampleEnum(values, rng) {
        if (!Array.isArray(values) || values.length === 0) return null;
        const idx = Math.floor(rng() * values.length);
        return values[Math.min(values.length - 1, Math.max(0, idx))];
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj || {}));
    }

    function ensureConstraints(chromosome, bounds) {
        const entryParams = chromosome.buyParams || {};
        const exitParams = chromosome.sellParams || {};

        if (Number.isFinite(entryParams.shortPeriod) && Number.isFinite(entryParams.longPeriod)) {
            if (entryParams.shortPeriod >= entryParams.longPeriod) {
                const mid = Math.floor((entryParams.shortPeriod + entryParams.longPeriod) / 2);
                entryParams.shortPeriod = Math.max(entryParams.shortPeriod - 1, mid - 1);
                entryParams.longPeriod = Math.max(entryParams.shortPeriod + 1, entryParams.longPeriod + 1);
            }
        }
        if (Number.isFinite(exitParams.shortPeriod) && Number.isFinite(exitParams.longPeriod)) {
            if (exitParams.shortPeriod >= exitParams.longPeriod) {
                const mid = Math.floor((exitParams.shortPeriod + exitParams.longPeriod) / 2);
                exitParams.shortPeriod = Math.max(exitParams.shortPeriod - 1, mid - 1);
                exitParams.longPeriod = Math.max(exitParams.shortPeriod + 1, exitParams.longPeriod + 1);
            }
        }

        const appliedBounds = bounds && Array.isArray(bounds.constraintFns) ? bounds.constraintFns : [];
        appliedBounds.forEach(fn => {
            try {
                fn?.(chromosome, bounds);
            } catch (err) {
                console.warn('[GA] Constraint function failed:', err);
            }
        });
    }

    function mutateNumericGene(value, range, rng, intensity) {
        if (!range) return value;
        const step = Number(range.step || 1);
        const decimals = countDecimals(step);
        const span = Number(range.to) - Number(range.from);
        const delta = span * 0.2 * (rng() * 2 - 1) * intensity;
        let next = value + delta;
        next = clamp(next, range.from, range.to);
        if (step > 0) {
            const snapped = Math.round((next - range.from) / step) * step + Number(range.from);
            next = clamp(snapped, range.from, range.to);
        }
        return Number(decimals > 0 ? next.toFixed(decimals) : next);
    }

    function mutateChromosome(chromosome, bounds, rng, baseMutationRate, intensity) {
        const mutationRate = clamp(baseMutationRate * intensity, 0.01, 0.9);
        const mutated = {
            buyStrategy: chromosome.buyStrategy,
            sellStrategy: chromosome.sellStrategy,
            buyParams: deepClone(chromosome.buyParams),
            sellParams: deepClone(chromosome.sellParams),
            riskManagement: deepClone(chromosome.riskManagement),
        };

        if (rng() < mutationRate && Array.isArray(bounds?.entryStrategies) && bounds.entryStrategies.length > 0) {
            mutated.buyStrategy = sampleEnum(bounds.entryStrategies, rng) || mutated.buyStrategy;
        }
        if (rng() < mutationRate && Array.isArray(bounds?.exitStrategies) && bounds.exitStrategies.length > 0) {
            mutated.sellStrategy = sampleEnum(bounds.exitStrategies, rng) || mutated.sellStrategy;
        }

        const entryDefs = bounds?.entryParamBounds?.[mutated.buyStrategy] || [];
        entryDefs.forEach(def => {
            if (rng() < mutationRate) {
                if (def.range) {
                    const current = mutated.buyParams?.[def.name];
                    mutated.buyParams[def.name] = mutateNumericGene(
                        Number.isFinite(current) ? current : sampleNumeric(def.range, rng),
                        def.range,
                        rng,
                        intensity
                    );
                } else if (Array.isArray(def.values)) {
                    mutated.buyParams[def.name] = sampleEnum(def.values, rng);
                } else if (def.type === 'boolean') {
                    mutated.buyParams[def.name] = sampleBoolean(rng);
                }
            }
        });

        const exitDefs = bounds?.exitParamBounds?.[mutated.sellStrategy] || [];
        exitDefs.forEach(def => {
            if (rng() < mutationRate) {
                if (def.range) {
                    const current = mutated.sellParams?.[def.name];
                    mutated.sellParams[def.name] = mutateNumericGene(
                        Number.isFinite(current) ? current : sampleNumeric(def.range, rng),
                        def.range,
                        rng,
                        intensity
                    );
                } else if (Array.isArray(def.values)) {
                    mutated.sellParams[def.name] = sampleEnum(def.values, rng);
                } else if (def.type === 'boolean') {
                    mutated.sellParams[def.name] = sampleBoolean(rng);
                }
            }
        });

        const riskDefs = bounds?.riskParamBounds || {};
        Object.keys(riskDefs).forEach(key => {
            if (rng() < mutationRate) {
                const def = riskDefs[key];
                if (def.range) {
                    const current = mutated.riskManagement?.[key];
                    if (!mutated.riskManagement) mutated.riskManagement = {};
                    mutated.riskManagement[key] = mutateNumericGene(
                        Number.isFinite(current) ? current : sampleNumeric(def.range, rng),
                        def.range,
                        rng,
                        intensity
                    );
                } else if (Array.isArray(def.values)) {
                    if (!mutated.riskManagement) mutated.riskManagement = {};
                    mutated.riskManagement[key] = sampleEnum(def.values, rng);
                } else if (def.type === 'boolean') {
                    if (!mutated.riskManagement) mutated.riskManagement = {};
                    mutated.riskManagement[key] = sampleBoolean(rng);
                }
            }
        });

        ensureConstraints(mutated, bounds);
        return mutated;
    }

    function crossoverChromosomes(parentA, parentB, rng) {
        const child1 = {
            buyStrategy: rng() < 0.5 ? parentA.buyStrategy : parentB.buyStrategy,
            sellStrategy: rng() < 0.5 ? parentA.sellStrategy : parentB.sellStrategy,
            buyParams: {},
            sellParams: {},
            riskManagement: {},
        };
        const child2 = {
            buyStrategy: child1.buyStrategy === parentA.buyStrategy ? parentB.buyStrategy : parentA.buyStrategy,
            sellStrategy: child1.sellStrategy === parentA.sellStrategy ? parentB.sellStrategy : parentA.sellStrategy,
            buyParams: {},
            sellParams: {},
            riskManagement: {},
        };

        const keys = new Set([
            ...Object.keys(parentA.buyParams || {}),
            ...Object.keys(parentB.buyParams || {}),
        ]);
        keys.forEach(key => {
            if (rng() < 0.5) {
                child1.buyParams[key] = parentA.buyParams?.[key];
                child2.buyParams[key] = parentB.buyParams?.[key];
            } else {
                child1.buyParams[key] = parentB.buyParams?.[key];
                child2.buyParams[key] = parentA.buyParams?.[key];
            }
        });

        const exitKeys = new Set([
            ...Object.keys(parentA.sellParams || {}),
            ...Object.keys(parentB.sellParams || {}),
        ]);
        exitKeys.forEach(key => {
            if (rng() < 0.5) {
                child1.sellParams[key] = parentA.sellParams?.[key];
                child2.sellParams[key] = parentB.sellParams?.[key];
            } else {
                child1.sellParams[key] = parentB.sellParams?.[key];
                child2.sellParams[key] = parentA.sellParams?.[key];
            }
        });

        const riskKeys = new Set([
            ...Object.keys(parentA.riskManagement || {}),
            ...Object.keys(parentB.riskManagement || {}),
        ]);
        riskKeys.forEach(key => {
            if (rng() < 0.5) {
                child1.riskManagement[key] = parentA.riskManagement?.[key];
                child2.riskManagement[key] = parentB.riskManagement?.[key];
            } else {
                child1.riskManagement[key] = parentB.riskManagement?.[key];
                child2.riskManagement[key] = parentA.riskManagement?.[key];
            }
        });

        return [child1, child2];
    }

    function tournamentSelect(population, k, rng) {
        let best = null;
        for (let i = 0; i < k; i++) {
            const idx = Math.floor(rng() * population.length);
            const candidate = population[Math.min(population.length - 1, Math.max(0, idx))];
            if (!best || (candidate.score ?? -Infinity) > (best.score ?? -Infinity)) {
                best = candidate;
            }
        }
        return best;
    }

    function computeFitness(metrics, objectives) {
        if (!metrics) return -Infinity;
        if (objectives && typeof objectives.fitness === 'function') {
            try {
                return objectives.fitness(metrics);
            } catch (err) {
                console.error('[GA] Custom fitness evaluation failed:', err);
            }
        }
        const weights = objectives?.weights || {};
        const penalties = objectives?.penalties || {};
        const annReturn = Number(metrics.annualizedReturn || 0);
        const sharpe = Number(metrics.sharpeRatio || 0);
        const sortino = Number(metrics.sortinoRatio || 0);
        const maxDrawdown = Math.abs(Number(metrics.maxDrawdown || 0));
        const tradeCount = Number(metrics.tradeCount || 0);

        const wAnn = Number(weights.annualizedReturn ?? (objectives?.targetMetric === 'annualizedReturn' ? 0.6 : 0.3));
        const wSharpe = Number(weights.sharpeRatio ?? (objectives?.targetMetric === 'sharpeRatio' ? 0.45 : 0.25));
        const wSortino = Number(weights.sortinoRatio ?? (objectives?.targetMetric === 'sortinoRatio' ? 0.3 : 0.1));
        const wDrawdown = Number(penalties.maxDrawdown ?? 0.2);
        const wTrades = Number(penalties.tradeCount ?? 0.05);

        const normalizedTrades = tradeCount / 200;
        const score = (
            annReturn * wAnn +
            sharpe * wSharpe +
            sortino * wSortino -
            maxDrawdown * wDrawdown -
            normalizedTrades * wTrades
        );
        return Number.isFinite(score) ? score : -Infinity;
    }

    class GAResultCache {
        constructor(options = {}) {
            this.dbName = options.dbName || 'lazybacktest-ga-cache';
            this.storeName = options.storeName || 'evaluations';
            this.enabled = typeof indexedDB !== 'undefined';
            this.db = null;
            this.memoryFallback = new Map();
            this.initialised = false;
        }

        async init() {
            if (!this.enabled || this.initialised) {
                this.initialised = true;
                return;
            }
            this.db = await new Promise((resolve, reject) => {
                try {
                    const request = indexedDB.open(this.dbName, 1);
                    request.onupgradeneeded = event => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            db.createObjectStore(this.storeName, { keyPath: 'key' });
                        }
                    };
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } catch (err) {
                    reject(err);
                }
            }).catch(err => {
                console.warn('[GA] IndexedDB initialisation failed, using memory cache:', err);
                this.enabled = false;
                this.db = null;
            });
            this.initialised = true;
        }

        async get(key) {
            if (!key) return null;
            if (!this.enabled || !this.db) {
                return this.memoryFallback.get(key) || null;
            }
            await this.init();
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(this.storeName, 'readonly');
                    const store = tx.objectStore(this.storeName);
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result ? request.result.value : null);
                    request.onerror = () => reject(request.error);
                } catch (err) {
                    reject(err);
                }
            }).catch(err => {
                console.warn('[GA] IndexedDB get failed, fallback to memory:', err);
                return this.memoryFallback.get(key) || null;
            });
        }

        async set(key, value) {
            if (!key) return;
            if (!this.enabled || !this.db) {
                this.memoryFallback.set(key, value);
                return;
            }
            await this.init();
            return new Promise((resolve, reject) => {
                try {
                    const tx = this.db.transaction(this.storeName, 'readwrite');
                    const store = tx.objectStore(this.storeName);
                    store.put({ key, value });
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                } catch (err) {
                    reject(err);
                }
            }).catch(err => {
                console.warn('[GA] IndexedDB set failed, fallback to memory:', err);
                this.memoryFallback.set(key, value);
            });
        }
    }

    const sharedCache = new GAResultCache();

    function defaultHashChromosome(chromosome) {
        return JSON.stringify({
            buyStrategy: chromosome.buyStrategy,
            sellStrategy: chromosome.sellStrategy,
            buyParams: chromosome.buyParams || {},
            sellParams: chromosome.sellParams || {},
            riskManagement: chromosome.riskManagement || {},
        });
    }

    async function evaluatePopulationWithCache(population, evaluator, cache, hashChromosome) {
        const results = new Array(population.length);
        const pendingIndices = [];
        const pendingChromosomes = [];

        for (let i = 0; i < population.length; i++) {
            const chrom = population[i];
            const key = hashChromosome(chrom, i);
            const cached = cache ? await cache.get(key) : null;
            if (cached) {
                results[i] = { ...cached, key };
            } else {
                pendingIndices.push(i);
                pendingChromosomes.push(chrom);
            }
        }

        if (pendingChromosomes.length > 0) {
            const evaluated = await evaluator.evaluate(pendingChromosomes);
            for (let i = 0; i < evaluated.length; i++) {
                const idx = pendingIndices[i];
                const key = hashChromosome(population[idx], idx);
                const value = { ...(evaluated[i] || {}), key };
                results[idx] = value;
                if (cache) await cache.set(key, value);
            }
        }

        return results;
    }

    async function maybeHandleControlSignal(controlSignal) {
        if (!controlSignal) return false;
        if (controlSignal.isStopped) return true;
        if (controlSignal.isPaused) {
            await controlSignal.waitForResume?.();
            if (controlSignal.isStopped) return true;
        }
        return false;
    }

    async function runGA({
        seed,
        popSize = 50,
        gens = 20,
        crossoverRate = 0.9,
        mutationRate = 0.15,
        elitism = 2,
        bounds,
        objectives,
        evaluator,
        earlyStop = 5,
        timeBudgetMs,
        postProgressToUI,
        controlSignal,
        hashChromosome = defaultHashChromosome,
        cacheProvider,
        initialPopulation = []
    }) {
        if (!evaluator || typeof evaluator.evaluate !== 'function') {
            throw new Error('Evaluator with evaluate(population) is required');
        }

        const rng = createSeededRandom(seed);
        const cache = cacheProvider || sharedCache;
        await cache.init?.();

        const population = [];
        const seenKeys = new Set();

        const useBounds = bounds || {};
        const seedPool = Array.isArray(initialPopulation) ? initialPopulation : [];
        seedPool.forEach(seedChrom => {
            const key = hashChromosome(seedChrom);
            if (!seenKeys.has(key) && population.length < popSize) {
                population.push(deepClone(seedChrom));
                seenKeys.add(key);
            }
        });

        while (population.length < popSize) {
            const chrom = generateRandomChromosome(useBounds, rng);
            const key = hashChromosome(chrom);
            if (!seenKeys.has(key)) {
                population.push(chrom);
                seenKeys.add(key);
            }
        }

        let best = null;
        let stagnantGenerations = 0;
        const history = [];
        const startedAt = Date.now();

        for (let gen = 0; gen < gens; gen++) {
            if (await maybeHandleControlSignal(controlSignal)) break;
            if (typeof timeBudgetMs === 'number' && timeBudgetMs > 0) {
                if ((Date.now() - startedAt) >= timeBudgetMs) {
                    break;
                }
            }

            const evaluations = await evaluatePopulationWithCache(population, evaluator, cache, hashChromosome);
            const annotatedPopulation = population.map((chrom, idx) => {
                const evalResult = evaluations[idx] || {};
                const metrics = evalResult.metrics || evalResult.raw || {};
                const rawScore = evalResult.score;
                const score = Number.isFinite(rawScore) ? rawScore : computeFitness(metrics, objectives);
                return {
                    chromosome: chrom,
                    metrics,
                    score,
                    raw: evalResult.raw || metrics,
                    key: evalResult.key
                };
            });

            annotatedPopulation.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
            const generationBest = annotatedPopulation[0];
            if (!best || (generationBest.score ?? -Infinity) > (best.score ?? -Infinity)) {
                best = { ...generationBest, generation: gen };
                stagnantGenerations = 0;
            } else {
                stagnantGenerations += 1;
            }

            const avgScore = annotatedPopulation.reduce((sum, item) => sum + (Number.isFinite(item.score) ? item.score : 0), 0) / annotatedPopulation.length;
            const snapshot = {
                gen,
                bestScore: generationBest?.score ?? -Infinity,
                avgScore,
                bestChromosome: deepClone(generationBest?.chromosome),
                bestMetrics: generationBest?.metrics ? { ...generationBest.metrics } : {},
                elapsedMs: Date.now() - startedAt,
            };
            history.push(snapshot);

            if (typeof postProgressToUI === 'function') {
                try {
                    postProgressToUI({
                        generation: gen,
                        bestScore: snapshot.bestScore,
                        avgScore,
                        bestChromosome: snapshot.bestChromosome,
                        bestMetrics: snapshot.bestMetrics,
                        history: history.slice(),
                        elapsedMs: snapshot.elapsedMs,
                    });
                } catch (err) {
                    console.warn('[GA] postProgressToUI failed:', err);
                }
            }

            if (earlyStop > 0 && stagnantGenerations >= earlyStop) {
                break;
            }

            const eliteCount = Math.max(1, Math.min(elitism, annotatedPopulation.length));
            const nextPopulation = annotatedPopulation.slice(0, eliteCount).map(item => deepClone(item.chromosome));

            while (nextPopulation.length < popSize) {
                if (await maybeHandleControlSignal(controlSignal)) break;
                const parentA = tournamentSelect(annotatedPopulation, 3, rng);
                const parentB = tournamentSelect(annotatedPopulation, 3, rng);
                let offspring = [];
                if (rng() < crossoverRate) {
                    offspring = crossoverChromosomes(parentA.chromosome, parentB.chromosome, rng);
                } else {
                    offspring = [deepClone(parentA.chromosome), deepClone(parentB.chromosome)];
                }

                const progressRatio = (gen + 1) / gens;
                const intensity = 1 - (progressRatio * 0.7);

                offspring.forEach(child => {
                    const mutated = mutateChromosome(child, useBounds, rng, mutationRate, intensity);
                    ensureConstraints(mutated, useBounds);
                    if (nextPopulation.length < popSize) {
                        nextPopulation.push(mutated);
                    }
                });
            }

            population.length = 0;
            nextPopulation.slice(0, popSize).forEach(chrom => population.push(chrom));
        }

        return {
            version: GA_MODULE_VERSION,
            best,
            history,
            generationsExecuted: history.length,
            stopped: Boolean(controlSignal?.isStopped),
            elapsedMs: Date.now() - startedAt,
        };
    }

    function generateRandomChromosome(bounds, rng) {
        const buyStrategy = sampleEnum(bounds?.entryStrategies || [], rng);
        const sellStrategy = sampleEnum(bounds?.exitStrategies || [], rng);
        const buyParams = {};
        const sellParams = {};

        const entryDefs = bounds?.entryParamBounds?.[buyStrategy] || [];
        entryDefs.forEach(def => {
            if (def.range) {
                buyParams[def.name] = sampleNumeric(def.range, rng);
            } else if (Array.isArray(def.values)) {
                buyParams[def.name] = sampleEnum(def.values, rng);
            } else if (def.type === 'boolean') {
                buyParams[def.name] = sampleBoolean(rng);
            }
        });

        const exitDefs = bounds?.exitParamBounds?.[sellStrategy] || [];
        exitDefs.forEach(def => {
            if (def.range) {
                sellParams[def.name] = sampleNumeric(def.range, rng);
            } else if (Array.isArray(def.values)) {
                sellParams[def.name] = sampleEnum(def.values, rng);
            } else if (def.type === 'boolean') {
                sellParams[def.name] = sampleBoolean(rng);
            }
        });

        const riskManagement = {};
        const riskDefs = bounds?.riskParamBounds || {};
        Object.keys(riskDefs).forEach(key => {
            const def = riskDefs[key];
            if (def.range) {
                riskManagement[key] = sampleNumeric(def.range, rng);
            } else if (Array.isArray(def.values)) {
                riskManagement[key] = sampleEnum(def.values, rng);
            } else if (def.type === 'boolean') {
                riskManagement[key] = sampleBoolean(rng);
            }
        });

        const chromosome = { buyStrategy, sellStrategy, buyParams, sellParams, riskManagement };
        ensureConstraints(chromosome, bounds);
        return chromosome;
    }

    return {
        runGA,
        createSeededRandom,
        GAResultCache,
        defaultHashChromosome,
        generateRandomChromosome,
        version: GA_MODULE_VERSION,
        cache: sharedCache,
    };
});
