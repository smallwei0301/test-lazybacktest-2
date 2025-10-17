// --- Stage 4 Local Refinement: SPSA ---
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

function rademacher() {
    return Math.random() < 0.5 ? -1 : 1;
}

function safeObjective(objective, evaluation) {
    if (typeof objective === 'function') {
        try {
            const score = objective(evaluation);
            if (Number.isFinite(score)) return score;
        } catch (error) {
            console.warn('[Stage4][SPSA] objective error:', error);
        }
    }
    const fallback = evaluation && typeof evaluation === 'object' ? evaluation.score : undefined;
    return Number.isFinite(fallback) ? fallback : -Infinity;
}

export async function runSPSA(options) {
    const {
        start,
        bounds,
        encodeVec, // 保留參數，方便外部兼容
        decodeVec, // 保留參數，方便外部兼容
        evaluator,
        objective = (r) => (r ? r.score : -Infinity),
        steps = 30,
        a0 = 0.2,
        c0 = 0.1,
        alpha = 0.602,
        gamma = 0.101,
        onProgress = () => {}
    } = options || {};

    if (!start || typeof start !== 'object') {
        throw new Error('SPSA: start params missing');
    }
    if (!bounds || Object.keys(bounds).length === 0) {
        throw new Error('SPSA: bounds missing');
    }
    if (typeof evaluator !== 'function') {
        throw new Error('SPSA: evaluator is required');
    }

    const spaces = buildSpaces(bounds);
    if (spaces.length === 0) {
        throw new Error('SPSA: no dimensions to optimize');
    }

    const template = deepClone(start);
    let { theta, candidate } = projectTheta(toNormalizedVector(start, spaces), spaces, template);

    async function evaluateCandidate(params) {
        const response = await evaluator([params]);
        if (Array.isArray(response)) {
            return response[0] || null;
        }
        return response;
    }

    let bestEvaluation = await evaluateCandidate(candidate);
    let bestScore = safeObjective(objective, bestEvaluation);
    let bestParams = deepClone(candidate);

    onProgress({ step: 0, bestScore });

    for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
        const ck = c0 / Math.pow(stepIndex + 1, gamma);
        const ak = a0 / Math.pow(stepIndex + 1, alpha);
        const delta = spaces.map(() => rademacher());

        const thetaPlus = theta.map((value, index) => clamp01(value + ck * delta[index]));
        const thetaMinus = theta.map((value, index) => clamp01(value - ck * delta[index]));

        const plusProjected = projectTheta(thetaPlus, spaces, template);
        const minusProjected = projectTheta(thetaMinus, spaces, template);

        const evaluationPlus = await evaluateCandidate(plusProjected.candidate);
        const evaluationMinus = await evaluateCandidate(minusProjected.candidate);

        const scorePlus = safeObjective(objective, evaluationPlus);
        const scoreMinus = safeObjective(objective, evaluationMinus);

        if (scorePlus > bestScore) {
            bestScore = scorePlus;
            bestEvaluation = evaluationPlus;
            bestParams = deepClone(plusProjected.candidate);
        }
        if (scoreMinus > bestScore) {
            bestScore = scoreMinus;
            bestEvaluation = evaluationMinus;
            bestParams = deepClone(minusProjected.candidate);
        }

        const gradient = spaces.map((_, index) => {
            const denom = 2 * ck * delta[index];
            if (!Number.isFinite(denom) || denom === 0) return 0;
            return (scorePlus - scoreMinus) / denom;
        });

        const updatedTheta = theta.map((value, index) => clamp01(value + ak * gradient[index]));
        const projected = projectTheta(updatedTheta, spaces, template);
        theta = projected.theta;
        candidate = projected.candidate;

        onProgress({ step: stepIndex + 1, bestScore });
    }

    return {
        bestParams: deepClone(bestParams),
        bestScore,
        bestEvaluation
    };
}

if (typeof window !== 'undefined') {
    window.lazybacktestStage4 = window.lazybacktestStage4 || {};
    window.lazybacktestStage4.runSPSA = runSPSA;
}
