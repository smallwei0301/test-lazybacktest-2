// --- Stage4 CEM Refiner ---
// Patch Tag: LB-STAGE4-REFINE-20251120A

const MIN_SIGMA = 0.01;

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return value;
    if (Number.isFinite(min) && value < min) return min;
    if (Number.isFinite(max) && value > max) return max;
    return value;
}

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn('[Stage4][CEM] structuredClone failed, fallback to JSON clone:', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Stage4][CEM] JSON clone failed, returning shallow copy:', error);
        if (value && typeof value === 'object') {
            return Array.isArray(value) ? value.slice() : { ...value };
        }
        return value;
    }
}

function normalizeValue(value, min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return 0.5;
    }
    const clamped = clamp(value, min, max);
    return (clamped - min) / (max - min);
}

function denormalizeValue(norm, min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        return min;
    }
    return min + clamp(norm, 0, 1) * (max - min);
}

function quantizeValue(value, min, max, step) {
    if (!Number.isFinite(value)) return value;
    let result = value;
    if (Number.isFinite(step) && step > 0) {
        const steps = Math.round((value - min) / step);
        result = min + steps * step;
    }
    if (Number.isFinite(min)) result = Math.max(result, min);
    if (Number.isFinite(max)) result = Math.min(result, max);
    return Number(result.toFixed(6));
}

function safeOnProgress(handler, payload) {
    if (typeof handler === 'function') {
        try {
            handler(payload);
        } catch (error) {
            console.warn('[Stage4][CEM] onProgress handler error:', error);
        }
    }
}

function getStrategyDescriptions() {
    return (typeof globalThis !== 'undefined' && globalThis.strategyDescriptions)
        ? globalThis.strategyDescriptions
        : null;
}

function getGlobalOptimizeTargets() {
    return (typeof globalThis !== 'undefined' && globalThis.globalOptimizeTargets)
        ? globalThis.globalOptimizeTargets
        : null;
}

function collectNumericDescriptors(startCombo) {
    const descriptors = [];
    const descriptorByRoleKey = new Map();

    const strategyDescriptions = getStrategyDescriptions();
    const globalTargets = getGlobalOptimizeTargets();

    const pushDescriptor = (role, strategyKey, params, targetInfo) => {
        if (!targetInfo || !targetInfo.range) return;
        const { name } = targetInfo;
        if (!name) return;
        const min = Number(targetInfo.range.from);
        const max = Number(targetInfo.range.to);
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
        const stepRaw = Number(targetInfo.range.step);
        const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : (max - min) / 50;
        const valueRaw = params && params[name];
        const defaultRaw = targetInfo?.defaultValue;
        const fallbackFromStrategy = strategyDescriptions?.[strategyKey]?.defaultParams?.[name];
        let value = Number.isFinite(Number(valueRaw)) ? Number(valueRaw)
            : Number.isFinite(Number(defaultRaw)) ? Number(defaultRaw)
            : Number.isFinite(Number(fallbackFromStrategy)) ? Number(fallbackFromStrategy)
            : min;
        value = clamp(value, min, max);
        const descriptor = {
            role,
            strategy: strategyKey,
            key: name,
            min,
            max,
            step,
            initial: value
        };
        descriptors.push(descriptor);
        descriptorByRoleKey.set(`${role}:${name}`, descriptor);
    };

    const collectForStrategy = (role, strategyKey, params) => {
        if (!strategyKey || !strategyDescriptions?.[strategyKey]) return;
        const info = strategyDescriptions[strategyKey];
        const paramTargets = Array.isArray(info.optimizeTargets) ? info.optimizeTargets : [];
        paramTargets.forEach(target => pushDescriptor(role, strategyKey, params || {}, target));
    };

    collectForStrategy('buy', startCombo?.buyStrategy, startCombo?.buyParams);
    collectForStrategy('sell', startCombo?.sellStrategy, startCombo?.sellParams);

    if (startCombo?.riskManagement || globalTargets?.stopLoss || globalTargets?.takeProfit) {
        const riskParams = startCombo?.riskManagement || {};
        if (globalTargets?.stopLoss?.range) {
            pushDescriptor('risk', 'risk', riskParams, {
                name: 'stopLoss',
                range: globalTargets.stopLoss.range,
                defaultValue: globalTargets.stopLoss?.defaultValue
            });
        }
        if (globalTargets?.takeProfit?.range) {
            pushDescriptor('risk', 'risk', riskParams, {
                name: 'takeProfit',
                range: globalTargets.takeProfit.range,
                defaultValue: globalTargets.takeProfit?.defaultValue
            });
        }
    }

    const theta = descriptors.map(d => normalizeValue(d.initial, d.min, d.max));
    return { descriptors, descriptorByRoleKey, theta };
}

function enforceOrderedPair(params, descriptorByRoleKey, role, shortKey, longKey, minGap = 1) {
    if (!params) return;
    const shortValue = Number(params[shortKey]);
    const longValue = Number(params[longKey]);
    if (!Number.isFinite(shortValue) || !Number.isFinite(longValue)) return;
    if (shortValue < longValue - minGap) return;
    const shortDescriptor = descriptorByRoleKey.get(`${role}:${shortKey}`);
    const longDescriptor = descriptorByRoleKey.get(`${role}:${longKey}`);
    const minShort = shortDescriptor?.min;
    const maxShort = shortDescriptor?.max;
    const minLong = longDescriptor?.min;
    const maxLong = longDescriptor?.max;
    const adjustedShort = clamp(longValue - minGap, minShort, maxShort);
    params[shortKey] = Number(adjustedShort.toFixed(6));
    const adjustedLong = clamp(Math.max(longValue, adjustedShort + minGap), minLong, maxLong);
    params[longKey] = Number(adjustedLong.toFixed(6));
}

function applyStrategyConstraints(strategyKey, params, descriptorByRoleKey, role) {
    if (!strategyKey || !params) return;
    const key = String(strategyKey).toLowerCase();
    if (params.shortPeriod !== undefined && params.longPeriod !== undefined) {
        enforceOrderedPair(params, descriptorByRoleKey, role, 'shortPeriod', 'longPeriod', 1);
    }
    if (key.includes('macd') && params.shortPeriod !== undefined && params.longPeriod !== undefined) {
        enforceOrderedPair(params, descriptorByRoleKey, role, 'shortPeriod', 'longPeriod', 2);
    }
    if (key.includes('ema') && params.shortPeriod !== undefined && params.longPeriod !== undefined) {
        enforceOrderedPair(params, descriptorByRoleKey, role, 'shortPeriod', 'longPeriod', 1);
    }
}

function applyRiskConstraints(riskParams, descriptorByRoleKey) {
    if (!riskParams) return;
    ['stopLoss', 'takeProfit'].forEach((key) => {
        if (riskParams[key] === undefined) return;
        const descriptor = descriptorByRoleKey.get(`risk:${key}`);
        if (!descriptor) return;
        riskParams[key] = quantizeValue(riskParams[key], descriptor.min, descriptor.max, descriptor.step);
    });
}

function buildComboFromTheta(theta, startCombo, descriptors, descriptorByRoleKey) {
    const combo = deepClone(startCombo || {});
    combo.buyParams = combo.buyParams ? deepClone(combo.buyParams) : {};
    combo.sellParams = combo.sellParams ? deepClone(combo.sellParams) : {};
    combo.riskManagement = combo.riskManagement ? deepClone(combo.riskManagement) : {};

    descriptors.forEach((descriptor, index) => {
        const actual = quantizeValue(
            denormalizeValue(theta[index], descriptor.min, descriptor.max),
            descriptor.min,
            descriptor.max,
            descriptor.step
        );
        if (descriptor.role === 'buy') {
            combo.buyParams[descriptor.key] = actual;
        } else if (descriptor.role === 'sell') {
            combo.sellParams[descriptor.key] = actual;
        } else if (descriptor.role === 'risk') {
            combo.riskManagement = combo.riskManagement || {};
            combo.riskManagement[descriptor.key] = actual;
        }
    });

    applyStrategyConstraints(combo.buyStrategy, combo.buyParams, descriptorByRoleKey, 'buy');
    applyStrategyConstraints(combo.sellStrategy, combo.sellParams, descriptorByRoleKey, 'sell');
    applyRiskConstraints(combo.riskManagement, descriptorByRoleKey);

    if (combo.riskManagement && Object.keys(combo.riskManagement).length === 0) {
        delete combo.riskManagement;
    }

    return combo;
}

async function resolveEvaluateFunction(evaluate) {
    if (typeof evaluate === 'function') return evaluate;
    if (typeof globalThis !== 'undefined' && typeof globalThis.executeBacktestForCombination === 'function') {
        return globalThis.executeBacktestForCombination;
    }
    try {
        const module = await import('./batch-optimization.js');
        if (typeof module.executeBacktestForCombination === 'function') {
            return module.executeBacktestForCombination;
        }
    } catch (error) {
        console.warn('[Stage4][CEM] Failed to dynamically import batch-optimization module:', error);
    }
    throw new Error('Stage4 CEM: executeBacktestForCombination not available');
}

function evaluateScore(result) {
    const value = Number(result?.annualizedReturn);
    if (Number.isFinite(value)) return value;
    const fallback = Number(result?.totalReturn);
    if (Number.isFinite(fallback)) return fallback;
    return -Infinity;
}

function boxMullerRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function makeComboKey(combo) {
    const ordered = (params) => {
        if (!params || typeof params !== 'object') return {};
        return Object.keys(params).sort().reduce((acc, key) => {
            const value = params[key];
            acc[key] = Number.isFinite(Number(value)) ? Number(Number(value).toFixed(6)) : value;
            return acc;
        }, {});
    };
    return JSON.stringify({
        buyStrategy: combo?.buyStrategy || '',
        sellStrategy: combo?.sellStrategy || '',
        buyParams: ordered(combo?.buyParams),
        sellParams: ordered(combo?.sellParams),
        riskManagement: ordered(combo?.riskManagement)
    });
}

function extractNormalizedVector(combo, descriptors) {
    return descriptors.map((descriptor) => {
        let value = null;
        if (descriptor.role === 'buy') {
            value = combo?.buyParams?.[descriptor.key];
        } else if (descriptor.role === 'sell') {
            value = combo?.sellParams?.[descriptor.key];
        } else if (descriptor.role === 'risk') {
            value = combo?.riskManagement?.[descriptor.key];
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return normalizeValue(descriptor.initial, descriptor.min, descriptor.max);
        }
        return normalizeValue(numeric, descriptor.min, descriptor.max);
    });
}

export async function runStage4CEM({
    startCombo,
    iters = 10,
    popSize = 40,
    eliteRatio = 0.2,
    initSigma = 0.15,
    onProgress,
    evaluate
}) {
    if (!startCombo) {
        console.warn('[Stage4][CEM] Missing startCombo, aborting');
        return null;
    }

    const { descriptors, descriptorByRoleKey, theta: initialTheta } = collectNumericDescriptors(startCombo);
    if (!descriptors.length) {
        const exec = await resolveEvaluateFunction(evaluate);
        const baseResult = await exec(deepClone(startCombo));
        return { bestCombo: deepClone(startCombo), bestResult: baseResult };
    }

    const exec = await resolveEvaluateFunction(evaluate);
    let mu = initialTheta.slice();
    let sigma = descriptors.map(() => clamp(initSigma, 0.05, 0.5));

    const startResult = await exec(deepClone(startCombo));
    let bestCombo = deepClone(startCombo);
    let bestResult = startResult;
    let bestScore = evaluateScore(startResult);

    safeOnProgress(onProgress, { phase: 'init', iteration: 0, total: iters, bestAnnualizedReturn: bestScore });

    for (let iter = 0; iter < iters; iter++) {
        const candidates = [];
        const seenKeys = new Set();

        for (let i = 0; i < popSize; i++) {
            let sampleVector = mu.map((m, index) => {
                if (i === 0) return clamp(m, 0, 1);
                const noise = sigma[index] * boxMullerRandom();
                return clamp(m + noise, 0, 1);
            });

            let candidateCombo = buildComboFromTheta(sampleVector, startCombo, descriptors, descriptorByRoleKey);
            let realizedVector = extractNormalizedVector(candidateCombo, descriptors);
            let key = makeComboKey(candidateCombo);
            let attempt = 0;
            while (seenKeys.has(key) && attempt < 5) {
                sampleVector = mu.map((m, index) => clamp(m + sigma[index] * boxMullerRandom(), 0, 1));
                candidateCombo = buildComboFromTheta(sampleVector, startCombo, descriptors, descriptorByRoleKey);
                realizedVector = extractNormalizedVector(candidateCombo, descriptors);
                key = makeComboKey(candidateCombo);
                attempt++;
            }
            seenKeys.add(key);

            const result = await exec(candidateCombo);
            const score = evaluateScore(result);
            if (score > bestScore && result) {
                bestScore = score;
                bestCombo = candidateCombo;
                bestResult = result;
            }
            candidates.push({ vector: realizedVector, combo: candidateCombo, result, score });
        }

        const validCandidates = candidates.filter(c => Number.isFinite(c.score));
        if (validCandidates.length) {
            validCandidates.sort((a, b) => b.score - a.score);
            const eliteCount = Math.max(1, Math.round(popSize * eliteRatio));
            const elites = validCandidates.slice(0, eliteCount);

            mu = mu.map((_, index) => {
                const sum = elites.reduce((acc, item) => acc + item.vector[index], 0);
                return clamp(sum / eliteCount, 0, 1);
            });

            sigma = sigma.map((current, index) => {
                const variance = elites.reduce((acc, item) => {
                    const diff = item.vector[index] - mu[index];
                    return acc + diff * diff;
                }, 0) / eliteCount;
                const stdDev = Math.sqrt(Math.max(variance, MIN_SIGMA * MIN_SIGMA));
                const updated = 0.9 * stdDev + 0.1 * current;
                return clamp(updated, 0.01, 0.5);
            });
        } else {
            sigma = sigma.map(value => clamp(value * 0.95, 0.01, 0.5));
        }

        safeOnProgress(onProgress, {
            phase: 'iterate',
            iteration: iter + 1,
            total: iters,
            bestAnnualizedReturn: bestScore,
            sigma
        });
    }

    return { bestCombo, bestResult };
}
