// Genetic Algorithm Runner for Lazybacktest
// Version code: LB-GA-20250713B

const GA_VERSION_CODE = 'LB-GA-20250713B';
const DEFAULT_OBJECTIVES = Object.freeze({
    weights: {
        annualizedReturn: 1,
        sharpeRatio: 0.7
    },
    penalties: {
        maxDrawdown: 0.4,
        tradeCount: 0.05
    }
});

const DEFAULT_CACHE_NAMESPACE = 'lazybacktest-ga-evaluations';

function createSeededRNG(seed) {
    if (seed === undefined || seed === null || seed === '') {
        return Math.random;
    }
    let state = 0;
    const seedStr = String(seed);
    for (let i = 0; i < seedStr.length; i++) {
        state = (state * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    if (state === 0) state = 0x12345678;
    return function rng() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return (state & 0xffffffff) / 0x100000000;
    };
}

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (err) {
            // fall through to JSON clone
        }
    }
    return JSON.parse(JSON.stringify(value));
}

function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
        if (typeof obj === 'number') {
            return Number.isFinite(obj) ? obj.toString() : 'null';
        }
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return `[${obj.map(item => stableStringify(item)).join(',')}]`;
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map(key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
    return `{${parts.join(',')}}`;
}

function computeFitnessFromMetrics(metrics, objectives = DEFAULT_OBJECTIVES) {
    if (!metrics || typeof metrics !== 'object') return Number.NEGATIVE_INFINITY;
    if (objectives && typeof objectives.evaluate === 'function') {
        try {
            const customScore = objectives.evaluate(metrics);
            if (Number.isFinite(customScore)) {
                return customScore;
            }
        } catch (err) {
            console.warn('[GA] Custom objective evaluate() failed:', err);
        }
    }

    const weights = objectives?.weights || {};
    const penalties = objectives?.penalties || {};
    let score = 0;
    let hasComponent = false;

    Object.entries(weights).forEach(([metric, weight]) => {
        const value = Number(metrics?.[metric]);
        const numericWeight = Number(weight);
        if (Number.isFinite(value) && Number.isFinite(numericWeight)) {
            score += value * numericWeight;
            hasComponent = true;
        }
    });

    Object.entries(penalties).forEach(([metric, penalty]) => {
        const value = Number(metrics?.[metric]);
        const numericPenalty = Number(penalty);
        if (Number.isFinite(value) && Number.isFinite(numericPenalty)) {
            score -= Math.abs(value) * numericPenalty;
            hasComponent = true;
        }
    });

    if (!hasComponent) {
        const fallback = Number(metrics?.score ?? metrics?.fitness);
        if (Number.isFinite(fallback)) return fallback;
        return Number.NEGATIVE_INFINITY;
    }

    return Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class GAResultCache {
    constructor(namespace = DEFAULT_CACHE_NAMESPACE) {
        this.namespace = namespace;
        this.memory = new Map();
        this.dbPromise = null;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.persisted = 0;
        if (typeof indexedDB !== 'undefined') {
            this.dbPromise = this.openDB();
        }
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('LazybacktestGA', 1);
                request.onupgradeneeded = event => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('evaluations')) {
                        db.createObjectStore('evaluations', { keyPath: 'key' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (err) {
                console.warn('[GA] IndexedDB unavailable:', err);
                reject(err);
            }
        }).catch(() => null);
    }

    buildKey(rawKey) {
        return `${this.namespace}::${rawKey}`;
    }

    async get(key) {
        const fullKey = this.buildKey(key);
        if (this.memory.has(fullKey)) {
            this.cacheHits++;
            return this.memory.get(fullKey);
        }
        if (!this.dbPromise) {
            this.cacheMisses++;
            return null;
        }
        const db = await this.dbPromise;
        if (!db) {
            this.cacheMisses++;
            return null;
        }
        return new Promise(resolve => {
            try {
                const tx = db.transaction('evaluations', 'readonly');
                const store = tx.objectStore('evaluations');
                const request = store.get(fullKey);
                request.onsuccess = () => {
                    if (request.result) {
                        this.memory.set(fullKey, request.result.value);
                        this.cacheHits++;
                        resolve(request.result.value);
                    } else {
                        this.cacheMisses++;
                        resolve(null);
                    }
                };
                request.onerror = () => {
                    this.cacheMisses++;
                    resolve(null);
                };
            } catch (err) {
                console.warn('[GA] IndexedDB read failed:', err);
                this.cacheMisses++;
                resolve(null);
            }
        });
    }

    async set(key, value) {
        const fullKey = this.buildKey(key);
        this.memory.set(fullKey, value);
        if (!this.dbPromise) return;
        const db = await this.dbPromise;
        if (!db) return;
        try {
            const tx = db.transaction('evaluations', 'readwrite');
            const store = tx.objectStore('evaluations');
            store.put({ key: fullKey, value });
            this.persisted++;
        } catch (err) {
            console.warn('[GA] IndexedDB write failed:', err);
        }
    }
}

function ensureConstraints(chromosome, constraints, context, repairFn, generator) {
    if (!constraints || constraints.length === 0) {
        return chromosome;
    }
    const maxAttempts = 12;
    let attempt = 0;
    let candidate = chromosome;
    while (attempt < maxAttempts) {
        const isValid = constraints.every(fn => {
            try {
                return fn(candidate, context) !== false;
            } catch (err) {
                console.warn('[GA] Constraint threw error:', err);
                return false;
            }
        });
        if (isValid) return candidate;
        attempt++;
        if (typeof repairFn === 'function') {
            try {
                const repaired = repairFn(candidate, context);
                if (repaired) {
                    candidate = repaired;
                    continue;
                }
            } catch (err) {
                console.warn('[GA] Repair function failed:', err);
            }
        }
        if (typeof generator === 'function') {
            candidate = generator(context);
        } else {
            break;
        }
    }
    return candidate;
}

async function evaluatePopulationWithCache(population, evaluator, cache, options) {
    const {
        cacheKeyFn,
        objectives
    } = options;

    const evaluated = new Array(population.length).fill(null);
    const pendingChromosomes = [];
    const pendingIndices = [];
    const pendingKeys = [];

    for (let i = 0; i < population.length; i++) {
        const chromosome = population[i];
        const cacheKey = cacheKeyFn ? cacheKeyFn(chromosome) : stableStringify(chromosome);
        const cached = await cache.get(cacheKey);
        if (cached) {
            evaluated[i] = {
                ...cached,
                chromosome: deepClone(chromosome),
                cacheKey,
                fromCache: true
            };
        } else {
            pendingChromosomes.push(chromosome);
            pendingIndices.push(i);
            pendingKeys.push(cacheKey);
        }
    }

    if (pendingChromosomes.length > 0) {
        try {
            const freshResults = await evaluator.evaluate(pendingChromosomes);
            for (let idx = 0; idx < pendingIndices.length; idx++) {
                const populationIndex = pendingIndices[idx];
                const key = pendingKeys[idx];
                const chromosome = pendingChromosomes[idx];
                const rawResult = Array.isArray(freshResults) ? freshResults[idx] : null;
                const metrics = rawResult?.metrics || rawResult || {};
                const score = Number.isFinite(rawResult?.score)
                    ? rawResult.score
                    : computeFitnessFromMetrics(metrics, objectives);
                const packaged = {
                    chromosome: deepClone(chromosome),
                    score,
                    metrics,
                    raw: rawResult,
                    cacheKey: key,
                    fromCache: false
                };
                evaluated[populationIndex] = packaged;
                cache.set(key, {
                    score,
                    metrics,
                    raw: rawResult
                });
            }
        } catch (err) {
            console.error('[GA] Evaluator failed:', err);
            pendingIndices.forEach((populationIndex, idx) => {
                const key = pendingKeys[idx];
                const chromosome = pendingChromosomes[idx];
                const fallback = {
                    chromosome: deepClone(chromosome),
                    score: Number.NEGATIVE_INFINITY,
                    metrics: {},
                    raw: null,
                    cacheKey: key,
                    fromCache: false
                };
                evaluated[populationIndex] = fallback;
                cache.set(key, fallback);
            });
        }
    }

    return evaluated;
}

function selectParent(population, rng) {
    if (!population || population.length === 0) {
        throw new Error('[GA] Population empty when selecting parent');
    }
    const scores = population.map(ind => Number.isFinite(ind.score) ? ind.score : Number.NEGATIVE_INFINITY);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const offset = maxScore > 0 ? Math.max(0, -minScore) : Math.abs(minScore);
    const total = scores.reduce((sum, score) => {
        const adjusted = Math.max(0, score + offset + 1e-6);
        return sum + adjusted;
    }, 0);

    if (!Number.isFinite(total) || total <= 0) {
        const index = Math.floor(rng() * population.length);
        return population[index];
    }

    let threshold = rng() * total;
    for (let i = 0; i < population.length; i++) {
        const adjusted = Math.max(0, scores[i] + offset + 1e-6);
        threshold -= adjusted;
        if (threshold <= 0) {
            return population[i];
        }
    }
    return population[population.length - 1];
}

async function waitWhilePaused(control) {
    if (!control || typeof control.isPaused !== 'function') return;
    while (control.isPaused()) {
        await sleep(120);
    }
}

export async function runGA({
    seed,
    popSize = 50,
    gens = 20,
    crossoverRate = 0.9,
    mutationRate = 0.15,
    elitism = 2,
    bounds = null,
    objectives = DEFAULT_OBJECTIVES,
    evaluator,
    earlyStop = 5,
    timeBudgetMs,
    generateChromosome,
    mutateChromosome,
    crossoverChromosome,
    repairChromosome,
    constraints = [],
    cacheKeyFn,
    initialPopulation = [],
    control,
    progressCallback,
    postProgressToUI,
    abortSignal,
    customContext = {},
    mutationFloor = 0.02
} = {}) {
    if (!evaluator || typeof evaluator.evaluate !== 'function') {
        throw new Error('[GA] Evaluator with evaluate(population) is required');
    }

    const rng = createSeededRNG(seed);
    const cache = new GAResultCache();
    const startTime = Date.now();
    const abortController = { aborted: false };

    if (abortSignal) {
        if (abortSignal.aborted) {
            abortController.aborted = true;
        } else {
            abortSignal.addEventListener('abort', () => {
                abortController.aborted = true;
            }, { once: true });
        }
    }

    const makeDefaultChromosome = (ctx) => {
        const chromosome = {};
        if (!bounds || typeof bounds !== 'object') {
            return chromosome;
        }
        Object.entries(bounds).forEach(([key, spec]) => {
            if (!spec) return;
            if (Array.isArray(spec.values)) {
                const idx = Math.floor(ctx.rng() * spec.values.length);
                chromosome[key] = spec.values[idx];
                return;
            }
            const min = Number(spec.min ?? spec.from ?? 0);
            const max = Number(spec.max ?? spec.to ?? min);
            const step = Number(spec.step ?? 1);
            const type = spec.type || 'float';
            if (type === 'boolean') {
                chromosome[key] = ctx.rng() < 0.5;
            } else if (type === 'integer' || Number.isInteger(step)) {
                const totalSteps = Math.floor((max - min) / (step || 1));
                const chosen = min + (Math.floor(ctx.rng() * (totalSteps + 1)) * (step || 1));
                chromosome[key] = Math.max(min, Math.min(max, Math.round(chosen)));
            } else {
                const value = min + ctx.rng() * (max - min);
                const decimals = spec.decimals ?? 4;
                chromosome[key] = Number(value.toFixed(decimals));
            }
        });
        return chromosome;
    };

    const defaultMutate = (chromosome, ctx) => {
        const mutated = deepClone(chromosome);
        if (!bounds || typeof bounds !== 'object') return mutated;
        Object.entries(bounds).forEach(([key, spec]) => {
            if (ctx.rng() > ctx.mutationRate) return;
            if (!spec) return;
            if (Array.isArray(spec.values)) {
                const idx = Math.floor(ctx.rng() * spec.values.length);
                mutated[key] = spec.values[idx];
                return;
            }
            const min = Number(spec.min ?? spec.from ?? 0);
            const max = Number(spec.max ?? spec.to ?? min);
            const step = Number(spec.step ?? 1);
            if (spec.type === 'boolean') {
                mutated[key] = !mutated[key];
            } else if (spec.type === 'integer' || Number.isInteger(step)) {
                const direction = ctx.rng() < 0.5 ? -1 : 1;
                const current = Number(mutated[key] ?? min);
                const next = current + direction * (step || 1);
                mutated[key] = Math.max(min, Math.min(max, Math.round(next)));
            } else {
                const span = max - min;
                const delta = (ctx.rng() - 0.5) * span * 0.2;
                const raw = Number(mutated[key] ?? min) + delta;
                const decimals = spec.decimals ?? 4;
                mutated[key] = Number(Math.max(min, Math.min(max, raw)).toFixed(decimals));
            }
        });
        return mutated;
    };

    const defaultCrossover = (parentA, parentB, ctx) => {
        const keys = Object.keys({ ...parentA, ...parentB });
        if (keys.length <= 1) {
            return [deepClone(parentA), deepClone(parentB)];
        }
        const point1 = Math.floor(ctx.rng() * keys.length);
        let point2 = Math.floor(ctx.rng() * keys.length);
        if (point2 === point1) {
            point2 = (point1 + 1) % keys.length;
        }
        const [start, end] = point1 < point2 ? [point1, point2] : [point2, point1];
        const child1 = {};
        const child2 = {};
        keys.forEach((key, index) => {
            if (index >= start && index < end) {
                child1[key] = parentB[key];
                child2[key] = parentA[key];
            } else {
                child1[key] = parentA[key];
                child2[key] = parentB[key];
            }
        });
        return [child1, child2];
    };

    const generator = generateChromosome || makeDefaultChromosome;
    const mutator = mutateChromosome || defaultMutate;
    const crossoverFn = crossoverChromosome || defaultCrossover;

    const baseContext = {
        rng,
        bounds,
        objectives,
        custom: customContext
    };

    const population = [];
    const initialPool = Array.isArray(initialPopulation) ? initialPopulation : [];
    initialPool.forEach(chromosome => {
        if (chromosome) {
            const ctx = { ...baseContext, generation: 0 };
            const valid = ensureConstraints(deepClone(chromosome), constraints, ctx, repairChromosome, generator);
            if (valid) {
                population.push(valid);
            }
        }
    });

    while (population.length < popSize) {
        const ctx = { ...baseContext, generation: 0 };
        const candidate = generator(ctx);
        const valid = ensureConstraints(candidate, constraints, ctx, repairChromosome, generator);
        if (valid) {
            population.push(valid);
        }
        if (population.length >= popSize) break;
    }

    let evaluatedPopulation = await evaluatePopulationWithCache(population, evaluator, cache, {
        cacheKeyFn,
        objectives
    });

    let bestIndividual = null;
    let stagnantGenerations = 0;
    const history = [];
    let totalEvaluations = evaluatedPopulation.length;
    let stoppedEarly = false;

    for (let gen = 0; gen < gens; gen++) {
        if (abortController.aborted || (control && typeof control.shouldStop === 'function' && control.shouldStop())) {
            stoppedEarly = true;
            break;
        }

        await waitWhilePaused(control);

        const elapsed = Date.now() - startTime;
        if (timeBudgetMs && elapsed >= timeBudgetMs) {
            stoppedEarly = true;
            break;
        }

        evaluatedPopulation.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const currentBest = evaluatedPopulation[0];

        if (!bestIndividual || (currentBest && currentBest.score > bestIndividual.score)) {
            bestIndividual = deepClone(currentBest);
            stagnantGenerations = 0;
        } else {
            stagnantGenerations++;
        }

        const scores = evaluatedPopulation.map(item => Number.isFinite(item.score) ? item.score : 0);
        const avgScore = scores.reduce((sum, value) => sum + value, 0) / (scores.length || 1);
        const medianScore = scores.slice().sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 0;
        const generationProgress = gens > 1 ? gen / (gens - 1) : 1;
        const effectiveMutationRate = Math.max(mutationFloor, mutationRate * (1 - generationProgress));

        const progressPayload = {
            generation: gen,
            generations: gens,
            bestScore: currentBest?.score ?? Number.NEGATIVE_INFINITY,
            bestMetrics: deepClone(currentBest?.metrics || {}),
            bestChromosome: deepClone(currentBest?.chromosome || {}),
            avgScore,
            medianScore,
            mutationRate: effectiveMutationRate,
            elapsedMs: elapsed,
            evaluations: totalEvaluations,
            cacheStats: {
                hits: cache.cacheHits,
                misses: cache.cacheMisses,
                persisted: cache.persisted
            }
        };

        history.push(progressPayload);
        if (typeof progressCallback === 'function') {
            try {
                progressCallback(progressPayload);
            } catch (err) {
                console.warn('[GA] progressCallback failed:', err);
            }
        }
        const uiDispatcher = typeof postProgressToUI === 'function'
            ? postProgressToUI
            : (typeof window !== 'undefined' && typeof window.postProgressToUI === 'function'
                ? window.postProgressToUI
                : null);
        if (uiDispatcher) {
            try {
                uiDispatcher({ gen, bestScore: currentBest?.score ?? Number.NEGATIVE_INFINITY });
            } catch (err) {
                console.warn('[GA] postProgressToUI failed:', err);
            }
        }

        if (earlyStop && stagnantGenerations >= earlyStop) {
            stoppedEarly = true;
            break;
        }

        if (gen === gens - 1) {
            break;
        }

        const nextPopulation = [];
        const ctxBase = { ...baseContext, generation: gen + 1, mutationRate: effectiveMutationRate, crossoverRate };

        const elitesToKeep = Math.min(elitism, evaluatedPopulation.length);
        for (let i = 0; i < elitesToKeep; i++) {
            nextPopulation.push(deepClone(evaluatedPopulation[i].chromosome));
        }

        while (nextPopulation.length < popSize) {
            const parentA = selectParent(evaluatedPopulation, rng);
            const parentB = selectParent(evaluatedPopulation, rng);
            let offspring = [deepClone(parentA.chromosome), deepClone(parentB.chromosome)];
            if (rng() < crossoverRate) {
                try {
                    offspring = crossoverFn(parentA.chromosome, parentB.chromosome, ctxBase) || offspring;
                } catch (err) {
                    console.warn('[GA] Crossover failed, fallback to parents:', err);
                }
            }
            for (let child of offspring) {
                if (nextPopulation.length >= popSize) break;
                try {
                    const mutated = mutator(child, ctxBase) || child;
                    const valid = ensureConstraints(mutated, constraints, ctxBase, repairChromosome, generator);
                    if (valid) {
                        nextPopulation.push(deepClone(valid));
                    }
                } catch (err) {
                    console.warn('[GA] Mutation failed:', err);
                }
            }
        }

        evaluatedPopulation = await evaluatePopulationWithCache(nextPopulation, evaluator, cache, {
            cacheKeyFn,
            objectives
        });
        totalEvaluations += evaluatedPopulation.length;

        await sleep(0);
    }

    const finalPopulation = evaluatedPopulation.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
        version: GA_VERSION_CODE,
        best: bestIndividual ? deepClone(bestIndividual) : null,
        history,
        population: finalPopulation,
        evaluations: totalEvaluations,
        cacheStats: {
            hits: cache.cacheHits,
            misses: cache.cacheMisses,
            persisted: cache.persisted
        },
        stoppedEarly,
        elapsedMs: Date.now() - startTime,
        config: {
            seed,
            popSize,
            gens,
            crossoverRate,
            mutationRate,
            elitism,
            earlyStop,
            timeBudgetMs
        }
    };
}

if (typeof window !== 'undefined') {
    window.lazybacktestGA = Object.freeze({
        runGA,
        GA_VERSION_CODE
    });
}

// Usage example (ES Module):
// import { runGA } from './gaRunner.js';
// const best = await runGA({ evaluator, bounds, objectives: { weights: { annualizedReturn: 1 } } });
// console.log('Best parameters:', best);

export const GA_VERSION = GA_VERSION_CODE;

