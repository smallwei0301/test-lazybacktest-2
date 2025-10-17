// --- Stage 4 Local Refinement: CEM ---
// Patch Tag: LB-STAGE4-REFINE-20250701A

function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => deepClone(item));
    const cloned = {};
    for (const key of Object.keys(value)) {
        cloned[key] = deepClone(value[key]);
    }
    return cloned;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function clamp01(value) {
    return clamp(value, 0, 1);
}

function gaussianRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function getValueByPath(source, path) {
    if (!source || typeof source !== 'object') return undefined;
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
}

function setValueByPath(target, path, value) {
    if (!path) return target;
    const segments = path.split('.');
    let cursor = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
    return target;
}

function buildSpaces(bounds) {
    const keys = Object.keys(bounds || {}).sort((a, b) => a.localeCompare(b));
    return keys.map((key) => {
        const info = bounds[key] || {};
        const space = {
            key,
            min: Number.isFinite(info.min) ? Number(info.min) : 0,
            max: Number.isFinite(info.max) ? Number(info.max) : 0,
            step: Number.isFinite(info.step) ? Number(info.step) : null,
            enum: Array.isArray(info.enum) ? [...info.enum] : null,
            type: info.type || null,
            constraintFix: typeof info.constraintFix === 'function' ? info.constraintFix : null,
        };
        if (!space.type) {
            const isIntRange = Number.isInteger(space.min) && Number.isInteger(space.max) && (!space.step || Number.isInteger(space.step));
            space.type = isIntRange ? 'int' : 'float';
        }
        if (space.max === space.min && !space.enum) {
            space.max = space.min + 1;
        }
        return space;
    });
}

function normaliseValue(value, space) {
    if (space.enum) {
        const values = space.enum;
        const index = Math.max(0, values.findIndex((item) => item === value));
        if (values.length <= 1) return 0;
        return clamp01(index / (values.length - 1));
    }
    const min = space.min;
    const max = space.max;
    if (!Number.isFinite(value)) {
        return 0.5;
    }
    if (max === min) return 0.5;
    return clamp01((value - min) / (max - min));
}

function denormaliseValue(norm, space) {
    const clamped = clamp01(norm);
    if (space.enum) {
        const values = space.enum;
        if (values.length === 0) return undefined;
        const index = Math.round(clamped * (values.length - 1));
        return values[clamp(index, 0, values.length - 1)];
    }
    const min = space.min;
    const max = space.max;
    const raw = min + clamped * (max - min);
    if (space.type === 'int') {
        const rounded = Math.round(raw);
        return clamp(rounded, min, max);
    }
    return clamp(raw, min, max);
}

function clampCandidate(candidate, spaces) {
    spaces.forEach((space) => {
        const current = getValueByPath(candidate, space.key);
        const next = space.enum ? current : clamp(current, space.min, space.max);
        if (space.enum) {
            const values = space.enum;
            const idx = values.findIndex((item) => item === current);
            if (idx === -1) {
                setValueByPath(candidate, space.key, values[0]);
            }
        } else if (space.type === 'int' && Number.isFinite(next)) {
            setValueByPath(candidate, space.key, clamp(Math.round(next), space.min, space.max));
        } else if (Number.isFinite(next)) {
            setValueByPath(candidate, space.key, clamp(next, space.min, space.max));
        }
    });
    return candidate;
}

function applyConstraintFixes(candidate, spaces) {
    let adjusted = candidate;
    spaces.forEach((space) => {
        if (typeof space.constraintFix === 'function') {
            const result = space.constraintFix(adjusted, space.key);
            if (result && typeof result === 'object') {
                adjusted = result;
            }
        }
    });
    return adjusted;
}

function toNormalizedVector(params, spaces) {
    return spaces.map((space) => {
        const value = getValueByPath(params, space.key);
        return normaliseValue(value, space);
    });
}

function fromNormalizedVector(theta, spaces, template) {
    const candidate = deepClone(template || {});
    spaces.forEach((space, index) => {
        const value = denormaliseValue(theta[index], space);
        setValueByPath(candidate, space.key, value);
    });
    return candidate;
}

function projectTheta(theta, spaces, template) {
    const candidate = clampCandidate(applyConstraintFixes(fromNormalizedVector(theta, spaces, template), spaces), spaces);
    const normalized = toNormalizedVector(candidate, spaces);
    return { theta: normalized, candidate };
}

function safeObjective(objective, evaluation) {
    if (typeof objective === 'function') {
        try {
            const score = objective(evaluation);
            if (Number.isFinite(score)) return score;
        } catch (error) {
            console.warn('[Stage4][CEM] objective error:', error);
        }
    }
    const fallback = evaluation && typeof evaluation === 'object' ? evaluation.score : undefined;
    return Number.isFinite(fallback) ? fallback : -Infinity;
}

export async function runCEM(options) {
    const {
        start,
        bounds,
        encodeVec, // 保留參數，方便外部兼容
        decodeVec, // 保留參數，方便外部兼容
        evaluator,
        objective = (r) => (r ? r.score : -Infinity),
        iters = 10,
        popSize = 40,
        eliteRatio = 0.2,
        initSigma = 0.15,
        onProgress = () => {}
    } = options || {};

    if (!start || typeof start !== 'object') {
        throw new Error('CEM: start params missing');
    }
    if (!bounds || Object.keys(bounds).length === 0) {
        throw new Error('CEM: bounds missing');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('CEM: evaluator is required');
    }

    const spaces = buildSpaces(bounds);
    if (spaces.length === 0) {
        throw new Error('CEM: no dimensions to optimize');
    }

    const template = deepClone(start);
    const initialProjection = projectTheta(toNormalizedVector(start, spaces), spaces, template);
    let mu = initialProjection.theta;
    let sigma = spaces.map(() => clamp(initSigma, 0.01, 0.5));

    async function evaluatePopulation(population) {
        const response = await evaluator(population.map((item) => item.params));
        if (!Array.isArray(response)) {
            return population.map(() => null);
        }
        return response;
    }

    let bestParams = deepClone(initialProjection.candidate);
    let bestEvaluation = null;
    let bestScore = -Infinity;

    const baseEvaluation = await evaluatePopulation([{ params: initialProjection.candidate }]);
    if (Array.isArray(baseEvaluation) && baseEvaluation[0]) {
        bestEvaluation = baseEvaluation[0];
        bestScore = safeObjective(objective, bestEvaluation);
    }

    onProgress({ iter: 0, bestScore });

    for (let iterIndex = 0; iterIndex < iters; iterIndex += 1) {
        const samples = [];
        for (let i = 0; i < popSize; i += 1) {
            const thetaSample = mu.map((mean, dim) => clamp01(mean + sigma[dim] * gaussianRandom()));
            const projected = projectTheta(thetaSample, spaces, template);
            samples.push({ theta: projected.theta, params: projected.candidate });
        }

        const evaluations = await evaluatePopulation(samples);
        const scored = samples.map((sample, index) => {
            const evaluation = evaluations[index] || null;
            const score = safeObjective(objective, evaluation);
            if (score > bestScore) {
                bestScore = score;
                bestParams = deepClone(sample.params);
                bestEvaluation = evaluation;
            }
            return {
                theta: sample.theta,
                params: sample.params,
                evaluation,
                score
            };
        });

        scored.sort((a, b) => b.score - a.score);
        const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));
        const elites = scored.slice(0, eliteCount);

        mu = spaces.map((_, dim) => {
            const sum = elites.reduce((acc, elite) => acc + elite.theta[dim], 0);
            return clamp01(sum / eliteCount);
        });

        sigma = spaces.map((_, dim) => {
            const mean = mu[dim];
            const variance = elites.reduce((acc, elite) => acc + Math.pow(elite.theta[dim] - mean, 2), 0) / eliteCount;
            const std = Math.sqrt(Math.max(variance, 1e-6));
            return clamp(std * 0.9, 0.01, 0.5);
        });

        onProgress({ iter: iterIndex + 1, bestScore });
    }

    return {
        bestParams: deepClone(bestParams),
        bestScore,
        bestEvaluation
    };
}

if (typeof window !== 'undefined') {
    window.lazybacktestStage4 = window.lazybacktestStage4 || {};
    window.lazybacktestStage4.runCEM = runCEM;
}
