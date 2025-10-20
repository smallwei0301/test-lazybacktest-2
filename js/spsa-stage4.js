// --- Stage4 SPSA Refiner ---
// Patch Tag: LB-STAGE4-REFINE-20251120A

const MIN_SIGMA = 0.0001;

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
            console.warn('[Stage4][SPSA] structuredClone failed, fallback to JSON clone:', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Stage4][SPSA] JSON clone failed, returning shallow copy:', error);
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
            console.warn('[Stage4][SPSA] onProgress handler error:', error);
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
        console.warn('[Stage4][SPSA] Failed to dynamically import batch-optimization module:', error);
    }
    throw new Error('Stage4 SPSA: executeBacktestForCombination not available');
}

function evaluateScore(result) {
    const value = Number(result?.annualizedReturn);
    if (Number.isFinite(value)) return value;
    const fallback = Number(result?.totalReturn);
    if (Number.isFinite(fallback)) return fallback;
    return -Infinity;
}

export async function runStage4SPSA({
    startCombo,
    stepCount = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress,
    evaluate
}) {
    if (!startCombo) {
        console.warn('[Stage4][SPSA] Missing startCombo, aborting');
        return null;
    }

    const { descriptors, descriptorByRoleKey, theta: initialTheta } = collectNumericDescriptors(startCombo);
    if (!descriptors.length) {
        const exec = await resolveEvaluateFunction(evaluate);
        const baseResult = await exec(deepClone(startCombo));
        return { bestCombo: deepClone(startCombo), bestResult: baseResult };
    }

    const exec = await resolveEvaluateFunction(evaluate);
    let theta = initialTheta.slice();

    const startResult = await exec(deepClone(startCombo));
    let bestCombo = deepClone(startCombo);
    let bestResult = startResult;
    let bestScore = evaluateScore(startResult);

    safeOnProgress(onProgress, { phase: 'init', step: 0, total: stepCount, bestAnnualizedReturn: bestScore });

    for (let t = 0; t < stepCount; t++) {
        const a = a0 / Math.pow(t + 1, alpha);
        const c = c0 / Math.pow(t + 1, gamma);
        const delta = descriptors.map(() => (Math.random() < 0.5 ? -1 : 1));

        const thetaPlus = theta.map((value, index) => clamp(value + c * delta[index], 0, 1));
        const thetaMinus = theta.map((value, index) => clamp(value - c * delta[index], 0, 1));

        const comboPlus = buildComboFromTheta(thetaPlus, startCombo, descriptors, descriptorByRoleKey);
        const comboMinus = buildComboFromTheta(thetaMinus, startCombo, descriptors, descriptorByRoleKey);

        const [resultPlus, resultMinus] = await Promise.all([
            exec(comboPlus),
            exec(comboMinus)
        ]);

        const scorePlus = evaluateScore(resultPlus);
        const scoreMinus = evaluateScore(resultMinus);

        if (scorePlus > bestScore && resultPlus) {
            bestScore = scorePlus;
            bestCombo = comboPlus;
            bestResult = resultPlus;
        }
        if (scoreMinus > bestScore && resultMinus) {
            bestScore = scoreMinus;
            bestCombo = comboMinus;
            bestResult = resultMinus;
        }

        if (Number.isFinite(scorePlus) && Number.isFinite(scoreMinus) && c > MIN_SIGMA) {
            const gradientFactor = (-(scorePlus) + scoreMinus) / (2 * c);
            theta = theta.map((value, index) => {
                const g = gradientFactor / delta[index];
                if (!Number.isFinite(g)) return value;
                return clamp(value - a * g, 0, 1);
            });
        }

        safeOnProgress(onProgress, {
            phase: 'iterate',
            step: t + 1,
            total: stepCount,
            bestAnnualizedReturn: bestScore,
            lastPlus: scorePlus,
            lastMinus: scoreMinus
        });
    }

    return { bestCombo, bestResult };
}
