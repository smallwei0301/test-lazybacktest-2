// --- Genetic Algorithm Runner for LazyBacktest ---
// Version Tag: LB-GA-20250712A

const DEFAULT_OBJECTIVE_WEIGHTS = Object.freeze({
    annualizedReturn: 0.6,
    sharpeRatio: 0.25,
    sortinoRatio: 0.1,
    overTradePenalty: 0.05,
    drawdownPenalty: 0.2,
    tradeThreshold: 120
});

function createRNG(seed = Date.now()) {
    let s = seed >>> 0;
    return function mulberry32() {
        s += 0x6D2B79F5;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function cloneChromosome(chromosome) {
    return JSON.parse(JSON.stringify(chromosome));
}

function randomValue(bound, rng) {
    if (!bound) return 0;
    if (bound.type === 'enum' || Array.isArray(bound.values)) {
        const values = bound.values || [];
        if (!values.length) return null;
        const idx = Math.floor(rng() * values.length) % values.length;
        return values[idx];
    }
    if (bound.type === 'boolean') {
        return rng() > 0.5;
    }
    const min = Number(bound.min ?? bound.from ?? 0);
    const max = Number(bound.max ?? bound.to ?? min + 1);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
    const step = Number(bound.step || 0);
    let value = min + rng() * (max - min);
    if (step > 0) {
        value = Math.round(value / step) * step;
    }
    if (bound.type === 'integer' || Number.isInteger(min) && Number.isInteger(max) && (!bound.step || Number.isInteger(bound.step))) {
        value = Math.round(value);
    }
    return Math.min(max, Math.max(min, value));
}

function mutateValue(value, bound, rng, intensity = 0.5) {
    if (!bound) return value;
    if (bound.type === 'enum' || Array.isArray(bound.values)) {
        if (rng() < 0.5) return value;
        const values = bound.values || [];
        if (!values.length) return value;
        let idx = values.indexOf(value);
        if (idx < 0) idx = Math.floor(rng() * values.length);
        const step = Math.max(1, Math.round(intensity * values.length));
        const offset = (idx + step + values.length) % values.length;
        return values[offset];
    }
    if (bound.type === 'boolean') {
        return rng() < intensity ? !value : value;
    }
    const min = Number(bound.min ?? bound.from ?? 0);
    const max = Number(bound.max ?? bound.to ?? min + 1);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
    const span = max - min;
    let delta = (rng() * 2 - 1) * span * intensity;
    if (bound.step) {
        delta = Math.round(delta / bound.step) * bound.step;
    }
    let mutated = value + delta;
    if (bound.step) {
        mutated = Math.round(mutated / bound.step) * bound.step;
    }
    if (bound.type === 'integer' || Number.isInteger(min) && Number.isInteger(max) && (!bound.step || Number.isInteger(bound.step))) {
        mutated = Math.round(mutated);
    }
    return Math.min(max, Math.max(min, mutated));
}

async function openIndexedDb(dbName, storeName) {
    if (typeof indexedDB === 'undefined') {
        return null;
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function createResultCache({ seed, namespace = 'lazybacktest-ga', store = 'chromosomeResults' } = {}) {
    const mapFallback = new Map();
    let dbPromise = null;
    const dbKey = `${namespace}-v1`;

    async function ensureDb() {
        if (dbPromise === null) {
            dbPromise = openIndexedDb(dbKey, store).catch(() => null);
        }
        return dbPromise;
    }

    function buildKey(chromosome) {
        return JSON.stringify({ seed, chromosome });
    }

    return {
        async get(chromosome) {
            const key = buildKey(chromosome);
            const db = await ensureDb();
            if (!db) {
                return mapFallback.get(key);
            }
            return new Promise((resolve) => {
                const tx = db.transaction(store, 'readonly');
                const storeRef = tx.objectStore(store);
                const req = storeRef.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
                req.onerror = () => resolve(undefined);
            });
        },
        async set(chromosome, value) {
            const key = buildKey(chromosome);
            const db = await ensureDb();
            if (!db) {
                mapFallback.set(key, value);
                return;
            }
            await new Promise((resolve) => {
                const tx = db.transaction(store, 'readwrite');
                const storeRef = tx.objectStore(store);
                storeRef.put({ key, value });
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        }
    };
}

function computeFitness(metrics, objectives = {}) {
    const weights = { ...DEFAULT_OBJECTIVE_WEIGHTS, ...(objectives.weights || {}) };
    const drawdown = Number(metrics.maxDrawdown ?? metrics.drawdown ?? 0);
    const annualized = Number(metrics.annualizedReturn ?? metrics.annualized ?? 0);
    const sharpe = Number(metrics.sharpeRatio ?? 0);
    const sortino = Number(metrics.sortinoRatio ?? 0);
    const tradeCount = Number(metrics.tradeCount ?? metrics.totalTrades ?? 0);

    const drawdownPenalty = weights.drawdownPenalty * Math.abs(drawdown);
    const threshold = weights.tradeThreshold || DEFAULT_OBJECTIVE_WEIGHTS.tradeThreshold;
    const overTrades = Math.max(0, tradeCount - threshold);
    const overTradePenalty = weights.overTradePenalty * overTrades;

    let fitness = 0;
    fitness += weights.annualizedReturn * annualized;
    fitness += weights.sharpeRatio * sharpe;
    fitness += weights.sortinoRatio * sortino;
    fitness -= drawdownPenalty;
    fitness -= overTradePenalty;

    if (typeof objectives.customScore === 'function') {
        const extra = objectives.customScore(metrics, { weights });
        if (Number.isFinite(extra)) fitness += extra;
    }

    return fitness;
}

function rouletteWheelSelection(population, rng) {
    const totalScore = population.reduce((sum, entry) => sum + Math.max(entry.score, 0), 0);
    if (totalScore <= 0) {
        return population[Math.floor(rng() * population.length)]?.chromosome;
    }
    let threshold = rng() * totalScore;
    for (const entry of population) {
        threshold -= Math.max(entry.score, 0);
        if (threshold <= 0) {
            return cloneChromosome(entry.chromosome);
        }
    }
    return cloneChromosome(population[population.length - 1].chromosome);
}

function crossoverChromosomes(parentA, parentB, bounds, rng) {
    const childA = cloneChromosome(parentA);
    const childB = cloneChromosome(parentB);
    const keys = Object.keys({ ...parentA, ...parentB });
    if (keys.length <= 1) {
        return [childA, childB];
    }
    const point1 = Math.floor(rng() * keys.length);
    let point2 = Math.floor(rng() * keys.length);
    if (point1 === point2) {
        point2 = (point2 + 1) % keys.length;
    }
    const [start, end] = point1 < point2 ? [point1, point2] : [point2, point1];
    for (let i = start; i <= end; i++) {
        const key = keys[i];
        const temp = childA[key];
        childA[key] = childB[key];
        childB[key] = temp;
    }
    return [childA, childB];
}

function mutateChromosome(chromosome, bounds, rng, mutationRate, intensity) {
    const keys = Object.keys(chromosome);
    for (const key of keys) {
        if (rng() > mutationRate) continue;
        chromosome[key] = mutateValue(chromosome[key], bounds[key], rng, intensity);
    }
    return chromosome;
}

function clampChromosome(chromosome, bounds) {
    for (const [key, bound] of Object.entries(bounds)) {
        if (!(key in chromosome)) continue;
        const value = chromosome[key];
        if (!bound) continue;
        if (bound.type === 'enum' || Array.isArray(bound.values)) {
            const values = bound.values || [];
            if (!values.length) continue;
            if (!values.includes(value)) {
                chromosome[key] = values[0];
            }
            continue;
        }
        if (bound.type === 'boolean') {
            chromosome[key] = Boolean(value);
            continue;
        }
        const min = Number(bound.min ?? bound.from ?? Number.NEGATIVE_INFINITY);
        const max = Number(bound.max ?? bound.to ?? Number.POSITIVE_INFINITY);
        let newValue = value;
        if (Number.isFinite(min)) newValue = Math.max(min, newValue);
        if (Number.isFinite(max)) newValue = Math.min(max, newValue);
        if (bound.step) {
            newValue = Math.round(newValue / bound.step) * bound.step;
        }
        if (bound.type === 'integer') {
            newValue = Math.round(newValue);
        }
        chromosome[key] = newValue;
    }
    return chromosome;
}

async function ensureArray(asyncMaybeArray) {
    const result = await asyncMaybeArray;
    if (!Array.isArray(result)) return [];
    return result;
}

export async function runGA({
    seed,
    popSize = 50,
    gens = 20,
    crossoverRate = 0.9,
    mutationRate = 0.15,
    elitism = 2,
    bounds = {},
    objectives = {},
    evaluator,
    earlyStop = 5,
    timeBudgetMs,
    normalizeChromosome,
    postProgressToUI,
    controlHooks,
} = {}) {
    if (!evaluator || typeof evaluator.evaluate !== 'function') {
        throw new Error('Evaluator with evaluate(population) method is required');
    }

    const rng = createRNG(seed || Date.now());
    const cache = createResultCache({ seed });
    const history = [];
    const startTime = Date.now();
    let bestEntry = null;
    let stagnation = 0;
    let currentMutationRate = mutationRate;
    let population = [];

    const boundKeys = Object.keys(bounds || {});
    const baseChromosome = {};
    for (const key of boundKeys) {
        baseChromosome[key] = randomValue(bounds[key], rng);
    }

    for (let i = 0; i < popSize; i++) {
        const chromosome = cloneChromosome(baseChromosome);
        for (const key of boundKeys) {
            chromosome[key] = randomValue(bounds[key], rng);
        }
        clampChromosome(chromosome, bounds);
        if (typeof normalizeChromosome === 'function') {
            normalizeChromosome(chromosome, { bounds, rng, stage: 'initial' });
        }
        population.push(chromosome);
    }

    async function evaluatePopulation(pop) {
        const evaluationResults = [];
        const pending = [];
        for (const chromosome of pop) {
            const key = cloneChromosome(chromosome);
            const cached = await cache.get(key);
            if (cached) {
                evaluationResults.push({ chromosome, ...cached });
                continue;
            }
            pending.push(chromosome);
        }

        if (pending.length > 0) {
            const freshResults = await ensureArray(evaluator.evaluate(pending));
            for (let i = 0; i < pending.length; i++) {
                const chromosome = pending[i];
                const result = freshResults[i] || {};
                const metrics = result.metrics || {};
                const score = Number.isFinite(result.score) ? result.score : computeFitness(metrics, objectives);
                const payload = { score, metrics };
                evaluationResults.push({ chromosome, ...payload });
                await cache.set(cloneChromosome(chromosome), payload);
            }
        }

        return evaluationResults;
    }

    for (let gen = 0; gen < gens; gen++) {
        if (controlHooks?.shouldStop?.()) break;
        if (typeof controlHooks?.waitIfPaused === 'function') {
            await controlHooks.waitIfPaused();
        }
        if (timeBudgetMs && Date.now() - startTime > timeBudgetMs) {
            break;
        }

        for (const chromosome of population) {
            clampChromosome(chromosome, bounds);
            if (typeof normalizeChromosome === 'function') {
                normalizeChromosome(chromosome, { bounds, rng, stage: 'pre-eval' });
            }
        }

        const evaluated = await evaluatePopulation(population);
        evaluated.sort((a, b) => b.score - a.score);
        const currentBest = evaluated[0];
        if (!bestEntry || currentBest.score > bestEntry.score) {
            bestEntry = { chromosome: cloneChromosome(currentBest.chromosome), score: currentBest.score, metrics: currentBest.metrics };
            stagnation = 0;
        } else {
            stagnation += 1;
        }

        history.push({
            generation: gen + 1,
            bestScore: currentBest.score,
            averageScore: evaluated.reduce((sum, item) => sum + item.score, 0) / evaluated.length,
            bestChromosome: cloneChromosome(currentBest.chromosome),
            metrics: currentBest.metrics,
            mutationRate: currentMutationRate,
        });

        if (typeof postProgressToUI === 'function') {
            try {
                postProgressToUI({
                    gen: gen + 1,
                    bestScore: currentBest.score,
                    bestChromosome: cloneChromosome(currentBest.chromosome),
                    metrics: currentBest.metrics,
                    mutationRate: currentMutationRate,
                    stagnation,
                });
            } catch (error) {
                console.error('[GA Runner] postProgressToUI failed:', error);
            }
        }

        if (earlyStop && stagnation >= earlyStop) {
            break;
        }

        const nextPopulation = [];
        for (let i = 0; i < elitism && i < evaluated.length; i++) {
            nextPopulation.push(cloneChromosome(evaluated[i].chromosome));
        }

        while (nextPopulation.length < popSize) {
            const parentA = rouletteWheelSelection(evaluated, rng);
            const parentB = rouletteWheelSelection(evaluated, rng);
            let [childA, childB] = [cloneChromosome(parentA), cloneChromosome(parentB)];
            if (rng() < crossoverRate) {
                [childA, childB] = crossoverChromosomes(parentA, parentB, bounds, rng);
            }
            mutateChromosome(childA, bounds, rng, currentMutationRate, 0.5 * (1 - (gen / gens)));
            mutateChromosome(childB, bounds, rng, currentMutationRate, 0.5 * (1 - (gen / gens)));
            clampChromosome(childA, bounds);
            clampChromosome(childB, bounds);
            if (typeof normalizeChromosome === 'function') {
                normalizeChromosome(childA, { bounds, rng, stage: 'post-mutation' });
                normalizeChromosome(childB, { bounds, rng, stage: 'post-mutation' });
            }
            nextPopulation.push(childA);
            if (nextPopulation.length < popSize) {
                nextPopulation.push(childB);
            }
        }

        currentMutationRate = Math.max(0.02, mutationRate * (1 - (gen + 1) / gens));
        population = nextPopulation.slice(0, popSize);
    }

    return {
        version: 'LB-GA-20250712A',
        seedUsed: seed,
        best: bestEntry ? { chromosome: cloneChromosome(bestEntry.chromosome), score: bestEntry.score, metrics: bestEntry.metrics } : null,
        history,
        elapsedMs: Date.now() - startTime,
    };
}

if (typeof window !== 'undefined') {
    window.LazybacktestGARunner = {
        runGA,
        GA_RUNNER_VERSION: 'LB-GA-20250712A'
    };
}
