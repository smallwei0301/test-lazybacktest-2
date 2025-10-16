const GA_MODULE_VERSION = 'LB-GA-OPT-20250216A';

function normaliseSeed(seed) {
    if (seed === undefined || seed === null) {
        return Date.now();
    }
    if (typeof seed === 'number' && Number.isFinite(seed)) {
        return seed;
    }
    if (typeof seed === 'string') {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) || Date.now();
    }
    return Date.now();
}

function createMulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function resolveStep(def) {
    const step = Number.isFinite(def.step) && def.step > 0 ? def.step : null;
    return step;
}

function snapToStep(value, def) {
    const step = resolveStep(def);
    if (!step) return value;
    const min = Number.isFinite(def.min) ? def.min : Number.isFinite(def.from) ? def.from : value;
    const steps = Math.round((value - min) / step);
    return min + steps * step;
}

function normaliseGeneValue(def, value) {
    if (def.type === 'bool') {
        return Boolean(value);
    }
    if (def.type === 'enum' && Array.isArray(def.values) && def.values.length > 0) {
        const idx = def.values.findIndex(v => v === value);
        if (idx >= 0) return def.values[idx];
        const fallbackIndex = 0;
        return def.values[fallbackIndex];
    }
    const min = Number.isFinite(def.min) ? def.min : Number.isFinite(def.from) ? def.from : Number.NEGATIVE_INFINITY;
    const max = Number.isFinite(def.max) ? def.max : Number.isFinite(def.to) ? def.to : Number.POSITIVE_INFINITY;
    let numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        numeric = min;
    }
    numeric = clamp(numeric, min, max);
    numeric = snapToStep(numeric, def);
    if (def.type === 'int') {
        numeric = Math.round(numeric);
    }
    return numeric;
}

function randomGeneValue(def, rng) {
    if (def.type === 'bool') {
        return rng() > 0.5;
    }
    if (def.type === 'enum' && Array.isArray(def.values) && def.values.length > 0) {
        const idx = Math.floor(rng() * def.values.length) % def.values.length;
        return def.values[idx];
    }
    const min = Number.isFinite(def.min) ? def.min : Number.isFinite(def.from) ? def.from : 0;
    const max = Number.isFinite(def.max) ? def.max : Number.isFinite(def.to) ? def.to : 1;
    const step = resolveStep(def);
    let value = min + rng() * (max - min);
    if (step) {
        value = snapToStep(value, def);
    }
    if (def.type === 'int') {
        value = Math.round(value);
    }
    return clamp(value, min, max);
}

function mutateGeneValue(def, value, rng, intensity = 1) {
    if (def.type === 'bool') {
        return rng() < 0.5 ? !value : value;
    }
    if (def.type === 'enum' && Array.isArray(def.values) && def.values.length > 0) {
        const options = def.values.filter(v => v !== value);
        if (options.length === 0) return value;
        const idx = Math.floor(rng() * options.length) % options.length;
        return options[idx];
    }
    const min = Number.isFinite(def.min) ? def.min : Number.isFinite(def.from) ? def.from : 0;
    const max = Number.isFinite(def.max) ? def.max : Number.isFinite(def.to) ? def.to : 1;
    const step = resolveStep(def);
    const span = max - min;
    const maxDelta = Math.max(step || span * 0.1, span * 0.05);
    let delta = (rng() - 0.5) * 2 * maxDelta * intensity;
    let mutated = value + delta;
    mutated = snapToStep(mutated, def);
    if (def.type === 'int') {
        mutated = Math.round(mutated);
    }
    return clamp(mutated, min, max);
}

function cloneChromosome(chromosome) {
    return JSON.parse(JSON.stringify(chromosome));
}

function sortByScoreDesc(a, b) {
    return (b.score ?? Number.NEGATIVE_INFINITY) - (a.score ?? Number.NEGATIVE_INFINITY);
}

function defaultDecode(chromosome) {
    return chromosome;
}

function defaultConstraints() {
    return [];
}

function ensureBounds(bounds) {
    const genes = Array.isArray(bounds?.genes) ? bounds.genes : [];
    const decode = typeof bounds?.decode === 'function' ? bounds.decode : defaultDecode;
    const constraints = Array.isArray(bounds?.constraints) ? bounds.constraints : defaultConstraints();
    const repair = typeof bounds?.repair === 'function' ? bounds.repair : null;
    return { genes, decode, constraints, repair };
}

function validateChromosome(chromosome, decode, constraints) {
    const decoded = decode(chromosome);
    if (!constraints || constraints.length === 0) {
        return { valid: true, decoded };
    }
    for (const constraint of constraints) {
        try {
            const result = constraint(chromosome, decoded);
            if (result === false) {
                return { valid: false, decoded, reason: 'constraint_failed' };
            }
            if (result && typeof result === 'object') {
                if (result.valid === false) {
                    return { valid: false, decoded, reason: result.reason || 'constraint_failed' };
                }
            }
        } catch (error) {
            return { valid: false, decoded, reason: 'constraint_error', error };
        }
    }
    return { valid: true, decoded };
}

function encodeChromosomeKey(chromosome) {
    const entries = Object.keys(chromosome).sort().map(key => {
        const value = chromosome[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return `${key}:${encodeChromosomeKey(value)}`;
        }
        return `${key}:${JSON.stringify(value)}`;
    });
    return entries.join('|');
}

const memoryCache = new Map();
let indexedDbPromise = null;

function openIndexedDb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (indexedDbPromise) return indexedDbPromise;
    indexedDbPromise = new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open('lazybacktest-ga-cache', 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('evaluations')) {
                    db.createObjectStore('evaluations');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (error) {
            resolve(null);
        }
    });
    return indexedDbPromise;
}

async function idbGet(db, key) {
    if (!db) return null;
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction('evaluations', 'readonly');
            const store = tx.objectStore('evaluations');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        } catch (error) {
            resolve(null);
        }
    });
}

async function idbSet(db, key, value) {
    if (!db) return;
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction('evaluations', 'readwrite');
            const store = tx.objectStore('evaluations');
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        } catch (error) {
            resolve();
        }
    });
}

async function getCachedEvaluation(key) {
    if (memoryCache.has(key)) {
        return memoryCache.get(key);
    }
    const db = await openIndexedDb();
    if (!db) return null;
    try {
        const result = await idbGet(db, key);
        if (result) {
            memoryCache.set(key, result);
        }
        return result;
    } catch (error) {
        return null;
    }
}

async function storeCachedEvaluation(key, value) {
    memoryCache.set(key, value);
    const db = await openIndexedDb();
    if (!db) return;
    try {
        await idbSet(db, key, value);
    } catch (error) {
        // ignore cache write failures
    }
}

function computeFitness(metrics, objectives) {
    if (!metrics) return Number.NEGATIVE_INFINITY;
    if (objectives?.customFitness && typeof objectives.customFitness === 'function') {
        try {
            return objectives.customFitness(metrics);
        } catch (error) {
            // fallback to default scoring
        }
    }
    const weights = objectives?.weights || {};
    const penalties = objectives?.penalties || {};
    let score = 0;
    let applied = false;
    for (const key of Object.keys(weights)) {
        const w = Number(weights[key]);
        if (!Number.isFinite(w) || w === 0) continue;
        const metricValue = metrics[key];
        if (Number.isFinite(metricValue)) {
            score += metricValue * w;
            applied = true;
        }
    }
    for (const key of Object.keys(penalties)) {
        const penalty = Number(penalties[key]);
        if (!Number.isFinite(penalty) || penalty === 0) continue;
        const metricValue = metrics[key];
        if (Number.isFinite(metricValue)) {
            score -= Math.abs(metricValue) * penalty;
            applied = true;
        }
    }
    if (!applied) {
        const target = objectives?.targetMetric;
        if (target && Number.isFinite(metrics[target])) {
            const targetValue = metrics[target];
            if (target === 'maxDrawdown') {
                score = -Math.abs(targetValue);
            } else {
                score = targetValue;
            }
        } else if (Number.isFinite(metrics.score)) {
            score = metrics.score;
        } else if (Number.isFinite(metrics.annualizedReturn)) {
            score = metrics.annualizedReturn;
        } else {
            score = Number.NEGATIVE_INFINITY;
        }
    }
    return score;
}

function selectParent(population, rng) {
    const totalFitness = population.reduce((sum, p) => {
        const fitness = Math.max(p.score ?? Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
        if (!Number.isFinite(fitness)) return sum;
        return sum + Math.max(fitness, 0);
    }, 0);
    if (totalFitness <= 0) {
        const idx = Math.floor(rng() * population.length) % population.length;
        return population[idx];
    }
    const threshold = rng() * totalFitness;
    let cumulative = 0;
    for (const individual of population) {
        const fitness = Math.max(individual.score ?? 0, 0);
        cumulative += fitness;
        if (cumulative >= threshold) {
            return individual;
        }
    }
    return population[population.length - 1];
}

function crossover(parentA, parentB, rng, genes) {
    const childA = {};
    const childB = {};
    if (genes.length === 0) {
        return [cloneChromosome(parentA.chromosome), cloneChromosome(parentB.chromosome)];
    }
    const point1 = Math.floor(rng() * genes.length);
    let point2 = Math.floor(rng() * genes.length);
    if (point1 === point2) {
        point2 = (point1 + 1) % genes.length;
    }
    const [start, end] = point1 < point2 ? [point1, point2] : [point2, point1];
    genes.forEach((gene, index) => {
        const key = gene.key;
        if (index >= start && index <= end) {
            childA[key] = parentB.chromosome[key];
            childB[key] = parentA.chromosome[key];
        } else {
            childA[key] = parentA.chromosome[key];
            childB[key] = parentB.chromosome[key];
        }
    });
    return [childA, childB];
}

function mutateChromosome(chromosome, genes, rng, mutationRate) {
    const mutated = cloneChromosome(chromosome);
    genes.forEach(gene => {
        if (rng() < mutationRate) {
            mutated[gene.key] = mutateGeneValue(gene, mutated[gene.key], rng);
        }
    });
    return mutated;
}

function createInitialChromosome(genes, rng, seeds, index) {
    if (seeds && seeds[index]) {
        const seeded = cloneChromosome(seeds[index]);
        genes.forEach(gene => {
            if (!(gene.key in seeded)) {
                seeded[gene.key] = randomGeneValue(gene, rng);
            }
        });
        return seeded;
    }
    const chromosome = {};
    genes.forEach(gene => {
        chromosome[gene.key] = randomGeneValue(gene, rng);
    });
    return chromosome;
}

async function evaluatePopulation(population, bounds, evaluator, objectives, options) {
    const decode = bounds.decode || defaultDecode;
    const results = new Array(population.length);
    const decodedPopulation = new Array(population.length);
    const toEvaluate = [];
    const toEvaluateIndices = [];

    for (let i = 0; i < population.length; i++) {
        const chromosome = population[i];
        const key = encodeChromosomeKey(chromosome);
        const validation = validateChromosome(chromosome, decode, bounds.constraints);
        decodedPopulation[i] = validation.decoded;
        if (!validation.valid) {
            results[i] = {
                chromosome,
                decoded: validation.decoded,
                score: Number.NEGATIVE_INFINITY,
                metrics: { reason: validation.reason },
                cached: false,
                invalid: true
            };
            continue;
        }
        const cached = await getCachedEvaluation(key);
        if (cached) {
            const score = computeFitness(cached.metrics || cached, objectives);
            results[i] = {
                chromosome,
                decoded: validation.decoded,
                score,
                metrics: cached.metrics || cached,
                cached: true,
                invalid: false
            };
        } else {
            toEvaluate.push(validation.decoded);
            toEvaluateIndices.push(i);
        }
    }

    if (toEvaluate.length > 0) {
        const evaluationResults = await evaluator.evaluate(toEvaluate, options);
        for (let i = 0; i < evaluationResults.length; i++) {
            const originalIndex = toEvaluateIndices[i];
            const metrics = evaluationResults[i] || {};
            const chromosome = population[originalIndex];
            const score = computeFitness(metrics, objectives);
            results[originalIndex] = {
                chromosome,
                decoded: decodedPopulation[originalIndex],
                score,
                metrics,
                cached: false,
                invalid: false
            };
            const key = encodeChromosomeKey(chromosome);
            storeCachedEvaluation(key, { metrics });
        }
    }

    return results;
}

function computeAverageScore(evaluated) {
    const validScores = evaluated.map(e => e.score).filter(score => Number.isFinite(score));
    if (validScores.length === 0) return Number.NEGATIVE_INFINITY;
    const sum = validScores.reduce((acc, val) => acc + val, 0);
    return sum / validScores.length;
}

function defaultProgressPoster() {}

async function waitIfPaused(controller) {
    if (!controller) return;
    if (typeof controller.waitIfPaused === 'function') {
        await controller.waitIfPaused();
    }
}

export async function runGA({
    seed,
    popSize = 50,
    gens = 20,
    crossoverRate = 0.9,
    mutationRate = 0.15,
    elitism = 2,
    bounds,
    objectives = {},
    evaluator,
    earlyStop = 5,
    timeBudgetMs,
    seedPopulation,
    postProgressToUI = defaultProgressPoster,
    shouldStop,
    pauseController,
    generationCallback
}) {
    if (!evaluator || typeof evaluator.evaluate !== 'function') {
        throw new Error('Evaluator with evaluate(population) method is required');
    }
    const resolvedSeed = normaliseSeed(seed);
    const rng = createMulberry32(resolvedSeed);
    const settings = ensureBounds(bounds || {});
    const history = [];
    const populationSize = Math.max(4, popSize | 0);
    const totalGenerations = Math.max(1, gens | 0);
    const elites = clamp(elitism | 0, 0, populationSize - 1);
    const startTime = Date.now();
    const progressPoster = typeof postProgressToUI === 'function' ? postProgressToUI : defaultProgressPoster;

    const population = new Array(populationSize).fill(null).map((_, index) => {
        const chromosome = createInitialChromosome(settings.genes, rng, seedPopulation, index);
        if (settings.repair) {
            settings.repair(chromosome, rng);
        }
        return chromosome;
    });

    let evaluated = await evaluatePopulation(population, settings, evaluator, objectives, { generation: 0 });
    evaluated.sort(sortByScoreDesc);
    let best = evaluated[0];
    let bestGeneration = 0;
    let stagnantCount = 0;

    history.push({
        generation: 0,
        bestScore: best.score,
        averageScore: computeAverageScore(evaluated),
        bestMetrics: best.metrics,
        chromosome: cloneChromosome(best.chromosome)
    });
    progressPoster({
        gen: 0,
        bestScore: best.score,
        bestMetrics: best.metrics,
        chromosome: best.chromosome,
        averageScore: history[0].averageScore,
        version: GA_MODULE_VERSION
    });

    for (let generation = 1; generation <= totalGenerations; generation++) {
        if (shouldStop && shouldStop()) {
            return {
                bestChromosome: cloneChromosome(best.chromosome),
                bestDecoded: best.decoded,
                bestMetrics: best.metrics,
                bestScore: best.score,
                history,
                version: GA_MODULE_VERSION,
                stopped: true,
                stopReason: 'manual_stop'
            };
        }
        if (timeBudgetMs && Date.now() - startTime > timeBudgetMs) {
            return {
                bestChromosome: cloneChromosome(best.chromosome),
                bestDecoded: best.decoded,
                bestMetrics: best.metrics,
                bestScore: best.score,
                history,
                version: GA_MODULE_VERSION,
                stopped: true,
                stopReason: 'time_budget'
            };
        }
        await waitIfPaused(pauseController);

        const newPopulation = [];
        const sortedCurrent = evaluated.slice().sort(sortByScoreDesc);
        for (let i = 0; i < elites; i++) {
            if (!sortedCurrent[i]) break;
            newPopulation.push(cloneChromosome(sortedCurrent[i].chromosome));
        }

        while (newPopulation.length < populationSize) {
            const parentA = selectParent(sortedCurrent, rng);
            const parentB = selectParent(sortedCurrent, rng);
            let offspring;
            if (rng() < crossoverRate) {
                const [childA, childB] = crossover(parentA, parentB, rng, settings.genes);
                offspring = [childA, childB];
            } else {
                offspring = [cloneChromosome(parentA.chromosome), cloneChromosome(parentB.chromosome)];
            }
            offspring = offspring.map(child => mutateChromosome(child, settings.genes, rng, mutationRate * (1 - generation / (totalGenerations + 1))));
            offspring.forEach(child => {
                settings.genes.forEach(gene => {
                    child[gene.key] = normaliseGeneValue(gene, child[gene.key]);
                });
                if (settings.repair) {
                    settings.repair(child, rng);
                }
                if (newPopulation.length < populationSize) {
                    newPopulation.push(child);
                }
            });
        }

        evaluated = await evaluatePopulation(newPopulation.slice(0, populationSize), settings, evaluator, objectives, { generation });
        evaluated.sort(sortByScoreDesc);
        const generationBest = evaluated[0];

        if (generationBest && generationBest.score > best.score) {
            best = generationBest;
            bestGeneration = generation;
            stagnantCount = 0;
        } else {
            stagnantCount += 1;
        }

        const averageScore = computeAverageScore(evaluated);
        const generationRecord = {
            generation,
            bestScore: generationBest?.score ?? Number.NEGATIVE_INFINITY,
            averageScore,
            bestMetrics: generationBest?.metrics,
            chromosome: cloneChromosome(generationBest?.chromosome || {})
        };
        history.push(generationRecord);

        progressPoster({
            gen: generation,
            bestScore: generationBest?.score ?? Number.NEGATIVE_INFINITY,
            bestMetrics: generationBest?.metrics,
            chromosome: generationBest?.chromosome,
            averageScore,
            version: GA_MODULE_VERSION,
            stagnation: stagnantCount,
            bestEver: { score: best.score, generation: bestGeneration, metrics: best.metrics }
        });

        if (typeof generationCallback === 'function') {
            try {
                await generationCallback({ generation, evaluated, best: generationBest, bestEver: best });
            } catch (error) {
                // ignore generation callback failure
            }
        }

        if (earlyStop && stagnantCount >= earlyStop) {
            return {
                bestChromosome: cloneChromosome(best.chromosome),
                bestDecoded: best.decoded,
                bestMetrics: best.metrics,
                bestScore: best.score,
                history,
                version: GA_MODULE_VERSION,
                stopped: true,
                stopReason: 'early_stop'
            };
        }
    }

    return {
        bestChromosome: cloneChromosome(best.chromosome),
        bestDecoded: best.decoded,
        bestMetrics: best.metrics,
        bestScore: best.score,
        history,
        version: GA_MODULE_VERSION,
        stopped: false,
        stopReason: null
    };
}

if (typeof window !== 'undefined') {
    window.lazybacktestGA = Object.assign(window.lazybacktestGA || {}, {
        runGA,
        version: GA_MODULE_VERSION
    });
}

