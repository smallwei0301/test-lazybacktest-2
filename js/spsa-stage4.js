// --- Stage4 微調模組 (SPSA) ---
// Patch Tag: LB-STAGE4-SPSA-20251120A
const globalScope = typeof window !== 'undefined' ? window : globalThis;

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (Number.isFinite(min) && value < min) return min;
    if (Number.isFinite(max) && value > max) return max;
    return value;
}

function cloneCombo(combo) {
    if (!combo || typeof combo !== 'object') return {};
    const cloned = JSON.parse(JSON.stringify(combo));
    if (!cloned.buyParams || typeof cloned.buyParams !== 'object') cloned.buyParams = {};
    if (!cloned.sellParams || typeof cloned.sellParams !== 'object') cloned.sellParams = {};
    if (cloned.riskManagement && typeof cloned.riskManagement !== 'object') {
        cloned.riskManagement = {};
    }
    return cloned;
}

function toNumber(value) {
    if (typeof value === 'number') return value;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function buildRangeFromTarget(target, currentValue) {
    if (!target || typeof target !== 'object') {
        if (!Number.isFinite(currentValue)) return null;
        const base = Math.abs(currentValue) > 1 ? Math.abs(currentValue) * 0.25 : 1;
        return { min: currentValue - base, max: currentValue + base, step: 1 };
    }
    const range = target.range || {};
    const min = Number(range.from);
    const max = Number(range.to);
    const step = Number(range.step);
    const normalizedMin = Number.isFinite(min) ? min : Number.isFinite(max) ? max - (Number.isFinite(step) ? step * 10 : 10) : currentValue - 10;
    const normalizedMax = Number.isFinite(max) ? max : Number.isFinite(min) ? min + (Number.isFinite(step) ? step * 10 : 10) : currentValue + 10;
    const normalizedStep = Number.isFinite(step) ? Math.abs(step) : null;
    return {
        min: Number.isFinite(normalizedMin) ? normalizedMin : (Number.isFinite(currentValue) ? currentValue - 10 : 0),
        max: Number.isFinite(normalizedMax) ? normalizedMax : (Number.isFinite(currentValue) ? currentValue + 10 : 10),
        step: normalizedStep,
    };
}

function ensureOrdered(params, keyA, keyB, rangesMap, gap = 1) {
    if (!(keyA in params) || !(keyB in params)) return;
    const rangeA = rangesMap[keyA];
    const rangeB = rangesMap[keyB];
    let valueA = params[keyA];
    let valueB = params[keyB];
    if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return;
    if (valueA + gap <= valueB) return;
    valueB = valueA + gap;
    if (rangeB) valueB = clamp(valueB, rangeB.min, rangeB.max);
    if (valueB <= valueA) {
        valueA = valueB - gap;
        if (rangeA) valueA = clamp(valueA, rangeA.min, rangeA.max);
        if (valueA + gap > valueB) {
            valueB = valueA + gap;
            if (rangeB) valueB = clamp(valueB, rangeB.min, rangeB.max);
        }
    }
    params[keyA] = valueA;
    params[keyB] = valueB;
}

function applyStrategyConstraints(strategyKey, params, rangesMap) {
    if (!strategyKey || !params) return;
    const key = String(strategyKey);
    if (key.includes('ma_cross')) {
        ensureOrdered(params, 'shortPeriod', 'longPeriod', rangesMap, 1);
    }
    if (key.includes('macd_cross')) {
        ensureOrdered(params, 'shortPeriod', 'longPeriod', rangesMap, 1);
        if ('signalPeriod' in params) {
            const signalRange = rangesMap.signalPeriod;
            if (signalRange) {
                params.signalPeriod = clamp(params.signalPeriod, signalRange.min, signalRange.max);
            }
        }
    }
    if (key.includes('turtle')) {
        if ('stopLossPeriod' in params) {
            const range = rangesMap.stopLossPeriod;
            if (range) params.stopLossPeriod = clamp(params.stopLossPeriod, range.min, range.max);
        }
        if ('breakoutPeriod' in params) {
            const range = rangesMap.breakoutPeriod;
            if (range) params.breakoutPeriod = clamp(params.breakoutPeriod, range.min, range.max);
        }
    }
    if (key.includes('bollinger')) {
        if ('deviations' in params) {
            const range = rangesMap.deviations;
            if (range) params.deviations = clamp(params.deviations, range.min, range.max);
        }
    }
}

function buildParameterContext(startCombo) {
    const combo = cloneCombo(startCombo);
    const params = [];
    const strategyMap = typeof globalScope.strategyDescriptions === 'object' ? globalScope.strategyDescriptions : {};
    const riskTargets = typeof globalScope.globalOptimizeTargets === 'object' ? globalScope.globalOptimizeTargets : {};

    const addParamsFrom = (scope, strategyKey, sourceParams) => {
        if (!sourceParams || typeof sourceParams !== 'object') return;
        const strategyInfo = strategyMap[strategyKey] || null;
        const targetRanges = new Map();
        if (strategyInfo && Array.isArray(strategyInfo.optimizeTargets)) {
            strategyInfo.optimizeTargets.forEach((target) => {
                if (target?.name) {
                    const range = buildRangeFromTarget(target, toNumber(sourceParams[target.name]));
                    if (range) targetRanges.set(target.name, range);
                }
            });
        }
        Object.keys(sourceParams).forEach((key) => {
            const rawValue = toNumber(sourceParams[key]);
            if (!Number.isFinite(rawValue)) return;
            const range = targetRanges.get(key) || buildRangeFromTarget(null, rawValue);
            if (!range) return;
            const width = range.max - range.min;
            if (!Number.isFinite(width) || width === 0) {
                range.max = range.min + 1;
            }
            const normalized = (rawValue - range.min) / (range.max - range.min);
            params.push({
                scope,
                strategyKey,
                key,
                min: range.min,
                max: range.max,
                step: Number.isFinite(range.step) && range.step > 0 ? range.step : null,
                integer: Number.isInteger(rawValue) && (!range.step || Number.isInteger(range.step)),
                normalized: clamp(normalized, 0, 1),
            });
        });
    };

    addParamsFrom('buy', combo.buyStrategy, combo.buyParams);
    addParamsFrom('sell', combo.sellStrategy, combo.sellParams);
    if (combo.riskManagement && typeof combo.riskManagement === 'object') {
        Object.keys(combo.riskManagement).forEach((key) => {
            const rawValue = toNumber(combo.riskManagement[key]);
            if (!Number.isFinite(rawValue)) return;
            const target = riskTargets[key];
            const range = target ? buildRangeFromTarget(target, rawValue) : buildRangeFromTarget(null, rawValue);
            if (!range) return;
            if (range.max === range.min) range.max = range.min + 1;
            const normalized = (rawValue - range.min) / (range.max - range.min);
            params.push({
                scope: 'risk',
                strategyKey: 'risk',
                key,
                min: range.min,
                max: range.max,
                step: Number.isFinite(range.step) && range.step > 0 ? range.step : null,
                integer: Number.isInteger(rawValue) && (!range.step || Number.isInteger(range.step)),
                normalized: clamp(normalized, 0, 1),
            });
        });
    }

    return {
        baseCombo: combo,
        params,
        apply(normalizedVector) {
            const next = cloneCombo(combo);
            const rangesByStrategy = new Map();
            params.forEach((param, idx) => {
                const norm = clamp(normalizedVector[idx], 0, 1);
                const value = param.min + norm * (param.max - param.min);
                let adjusted = value;
                if (param.step) {
                    adjusted = Math.round(adjusted / param.step) * param.step;
                }
                if (param.integer) {
                    adjusted = Math.round(adjusted);
                }
                adjusted = clamp(adjusted, param.min, param.max);
                if (param.scope === 'buy') {
                    next.buyParams[param.key] = Number(adjusted.toFixed(6));
                    if (!rangesByStrategy.has(`buy:${next.buyStrategy}`)) rangesByStrategy.set(`buy:${next.buyStrategy}`, {});
                    rangesByStrategy.get(`buy:${next.buyStrategy}`)[param.key] = { min: param.min, max: param.max };
                } else if (param.scope === 'sell') {
                    next.sellParams[param.key] = Number(adjusted.toFixed(6));
                    if (!rangesByStrategy.has(`sell:${next.sellStrategy}`)) rangesByStrategy.set(`sell:${next.sellStrategy}`, {});
                    rangesByStrategy.get(`sell:${next.sellStrategy}`)[param.key] = { min: param.min, max: param.max };
                } else if (param.scope === 'risk') {
                    if (!next.riskManagement) next.riskManagement = {};
                    next.riskManagement[param.key] = Number(adjusted.toFixed(6));
                }
            });

            const applyConstraints = (scope, strategyKey, paramStore) => {
                if (!strategyKey) return;
                const rangeMap = rangesByStrategy.get(`${scope}:${strategyKey}`) || {};
                applyStrategyConstraints(strategyKey, paramStore, rangeMap);
            };

            applyConstraints('buy', next.buyStrategy, next.buyParams);
            applyConstraints('sell', next.sellStrategy, next.sellParams);
            return next;
        }
    };
}

function scoreFromResult(result) {
    if (!result || typeof result !== 'object') return -Infinity;
    const annualized = Number(result.annualizedReturn);
    const sharpe = Number(result.sharpeRatio);
    const drawdown = Number(result.maxDrawdown);
    let score = Number.isFinite(annualized) ? annualized : Number.isFinite(result.totalReturn) ? Number(result.totalReturn) : -Infinity;
    if (!Number.isFinite(score)) score = -Infinity;
    if (Number.isFinite(sharpe)) score += sharpe;
    if (Number.isFinite(drawdown)) score -= Math.abs(drawdown) * 0.1;
    return score;
}

async function evaluateCombo(combo, executeBacktest) {
    if (typeof executeBacktest !== 'function') {
        executeBacktest = globalScope.executeBacktestForCombination;
    }
    if (typeof executeBacktest !== 'function') return { combo, result: null, score: -Infinity };
    const result = await executeBacktest(combo);
    return {
        combo,
        result,
        score: scoreFromResult(result)
    };
}

export async function runStage4SPSA({
    startCombo,
    stepCount = 30,
    a0 = 0.2,
    c0 = 0.1,
    alpha = 0.602,
    gamma = 0.101,
    onProgress,
    executeBacktest,
} = {}) {
    const context = buildParameterContext(startCombo || {});
    if (!context.params || context.params.length === 0) {
        const evaluated = await evaluateCombo(cloneCombo(startCombo), executeBacktest);
        return { bestCombo: evaluated.combo, bestResult: evaluated.result };
    }

    const dimension = context.params.length;
    let theta = context.params.map(param => param.normalized);

    const baseline = await evaluateCombo(context.apply(theta), executeBacktest);
    let best = baseline;
    let lastScore = baseline.score;

    for (let k = 0; k < stepCount; k++) {
        const ak = a0 / Math.pow(k + 1, alpha);
        const ck = c0 / Math.pow(k + 1, gamma);
        const delta = Array.from({ length: dimension }, () => (Math.random() < 0.5 ? -1 : 1));

        const thetaPlus = theta.map((value, idx) => clamp(value + ck * delta[idx], 0, 1));
        const thetaMinus = theta.map((value, idx) => clamp(value - ck * delta[idx], 0, 1));

        const [plusEval, minusEval] = await Promise.all([
            evaluateCombo(context.apply(thetaPlus), executeBacktest),
            evaluateCombo(context.apply(thetaMinus), executeBacktest),
        ]);

        const yPlus = plusEval.score;
        const yMinus = minusEval.score;
        const gradient = delta.map((deltaValue) => ((yPlus - yMinus) / (2 * ck)) * deltaValue);

        theta = theta.map((value, idx) => clamp(value - ak * gradient[idx], 0, 1));
        const currentEval = await evaluateCombo(context.apply(theta), executeBacktest);
        lastScore = currentEval.score;
        if (currentEval.score > best.score) {
            best = currentEval;
        }

        if (typeof onProgress === 'function') {
            try {
                onProgress({
                    phase: 'spsa',
                    step: k + 1,
                    totalSteps: stepCount,
                    bestScore: best.score,
                    lastScore,
                    lastResult: currentEval.result,
                });
            } catch (error) {
                console.warn('[Stage4][SPSA] onProgress callback error:', error);
            }
        }
    }

    return {
        bestCombo: best.combo,
        bestResult: best.result,
    };
}

export default runStage4SPSA;
