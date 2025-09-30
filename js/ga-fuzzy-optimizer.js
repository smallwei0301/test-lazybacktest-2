(function(global) {
    'use strict';

    const VERSION = 'LB-GA-FUZZY-20251120A';
    const DEFAULT_OPTIONS = {
        populationSize: 28,
        generations: 16,
        crossoverRate: 0.75,
        mutationRate: 0.25,
        eliteCount: 2,
        tournamentSize: 3,
        sampleSize: 600
    };

    const BOUNDS = {
        rsiOversoldCenter: { min: 10, max: 45 },
        rsiOversoldWidth: { min: 5, max: 25 },
        rsiOverboughtCenter: { min: 55, max: 90 },
        rsiOverboughtWidth: { min: 5, max: 25 },
        kOversoldCenter: { min: 10, max: 40 },
        kOversoldWidth: { min: 5, max: 25 },
        kOverboughtCenter: { min: 60, max: 90 },
        kOverboughtWidth: { min: 5, max: 25 },
        dOversoldCenter: { min: 10, max: 40 },
        dOversoldWidth: { min: 5, max: 25 },
        dOverboughtCenter: { min: 60, max: 90 },
        dOverboughtWidth: { min: 5, max: 25 },
        delta: { min: 0.5, max: 6 }
    };

    function clamp(value, min, max) {
        if (!Number.isFinite(value)) return min;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function toNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function extractNumeric(row, keys) {
        if (!row || typeof row !== 'object') return null;
        for (let i = 0; i < keys.length; i++) {
            const val = toNumber(row[keys[i]]);
            if (val !== null) return val;
        }
        return null;
    }

    function buildSeries(stockData, sampleSize) {
        const startIndex = Math.max(0, stockData.length - sampleSize);
        const closes = [];
        const highs = [];
        const lows = [];
        const dates = [];

        for (let i = startIndex; i < stockData.length; i++) {
            const row = stockData[i];
            const close = extractNumeric(row, ['close', 'Close', 'c', 'ClosePrice']);
            const high = extractNumeric(row, ['high', 'High', 'h', 'HighPrice']);
            const low = extractNumeric(row, ['low', 'Low', 'l', 'LowPrice']);
            if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) {
                continue;
            }
            closes.push(close);
            highs.push(high);
            lows.push(low);
            dates.push(row?.date || row?.Date || row?.t || i);
        }

        return { closes, highs, lows, dates };
    }

    function computeRSI(closes, period) {
        const length = closes.length;
        const output = new Array(length).fill(null);
        if (length <= period) {
            return output;
        }
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (!Number.isFinite(change)) {
                return output;
            }
            if (change >= 0) gains += change; else losses -= change;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        if (!Number.isFinite(avgGain) || !Number.isFinite(avgLoss)) {
            return output;
        }
        const firstIndex = period;
        output[firstIndex] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
        for (let i = period + 1; i < length; i++) {
            const change = closes[i] - closes[i - 1];
            if (!Number.isFinite(change)) {
                output[i] = null;
                continue;
            }
            const currentGain = change >= 0 ? change : 0;
            const currentLoss = change < 0 ? -change : 0;
            avgGain = ((avgGain * (period - 1)) + currentGain) / period;
            avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
            if (!Number.isFinite(avgGain) || !Number.isFinite(avgLoss) || avgLoss === 0) {
                output[i] = avgLoss === 0 ? 100 : null;
            } else {
                const rs = avgGain / avgLoss;
                output[i] = 100 - (100 / (1 + rs));
            }
        }
        return output;
    }

    function computeStochasticKD(series, kPeriod, dPeriod) {
        const { closes, highs, lows } = series;
        const length = closes.length;
        const kValues = new Array(length).fill(null);
        const dValues = new Array(length).fill(null);
        const window = [];
        let sum = 0;

        for (let i = 0; i < length; i++) {
            const close = closes[i];
            const high = highs[i];
            const low = lows[i];
            if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) {
                window.length = 0;
                sum = 0;
                continue;
            }
            let highestHigh = -Infinity;
            let lowestLow = Infinity;
            for (let j = Math.max(0, i - kPeriod + 1); j <= i; j++) {
                const h = highs[j];
                const l = lows[j];
                if (!Number.isFinite(h) || !Number.isFinite(l)) {
                    highestHigh = -Infinity;
                    break;
                }
                if (h > highestHigh) highestHigh = h;
                if (l < lowestLow) lowestLow = l;
            }
            if (highestHigh === -Infinity || lowestLow === Infinity || highestHigh === lowestLow) {
                kValues[i] = null;
                continue;
            }
            const percentK = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
            kValues[i] = clamp(percentK, 0, 100);

            if (Number.isFinite(kValues[i])) {
                window.push(kValues[i]);
                sum += kValues[i];
                if (window.length > dPeriod) {
                    sum -= window.shift();
                }
                if (window.length === dPeriod) {
                    dValues[i] = clamp(sum / dPeriod, 0, 100);
                }
            } else {
                window.length = 0;
                sum = 0;
            }
        }

        return { k: kValues, d: dValues };
    }

    function triangularMembership(value, center, width) {
        if (!Number.isFinite(value)) return 0;
        const halfWidth = Math.max(width, 1);
        const left = center - halfWidth;
        const right = center + halfWidth;
        if (value <= left || value >= right) return 0;
        if (value === center) return 1;
        if (value < center) return (value - left) / (center - left);
        return (right - value) / (right - center);
    }

    function generateFuzzySignals(dataset, individual) {
        const length = dataset.closes.length;
        const buy = new Array(length).fill(0);
        const sell = new Array(length).fill(0);
        const {
            rsiOversoldCenter,
            rsiOversoldWidth,
            rsiOverboughtCenter,
            rsiOverboughtWidth,
            kOversoldCenter,
            kOversoldWidth,
            kOverboughtCenter,
            kOverboughtWidth,
            dOversoldCenter,
            dOversoldWidth,
            dOverboughtCenter,
            dOverboughtWidth
        } = individual;

        for (let i = 0; i < length; i++) {
            const rsiValue = dataset.rsi[i];
            const kValue = dataset.k[i];
            const dValue = dataset.d[i];

            const rsiLow = triangularMembership(rsiValue, rsiOversoldCenter, rsiOversoldWidth);
            const rsiHigh = triangularMembership(rsiValue, rsiOverboughtCenter, rsiOverboughtWidth);
            const kLow = triangularMembership(kValue, kOversoldCenter, kOversoldWidth);
            const kHigh = triangularMembership(kValue, kOverboughtCenter, kOverboughtWidth);
            const dLow = triangularMembership(dValue, dOversoldCenter, dOversoldWidth);
            const dHigh = triangularMembership(dValue, dOverboughtCenter, dOverboughtWidth);

            const buySignal = Math.max(rsiLow, Math.min(kLow, dLow));
            const sellSignal = Math.max(rsiHigh, Math.min(kHigh, dHigh));
            buy[i] = buySignal;
            sell[i] = sellSignal;
        }

        return { buy, sell };
    }

    function simulateFuzzyTrading(dataset, signals, delta) {
        const closes = dataset.closes;
        const length = closes.length;
        let capital = 1;
        let position = 0;
        let entryPrice = null;
        let bias = 0;
        let mseSum = 0;
        let mseCount = 0;
        const tradeReturns = [];

        for (let i = 1; i < length; i++) {
            const price = closes[i];
            const prevPrice = closes[i - 1];
            if (!Number.isFinite(price) || !Number.isFinite(prevPrice)) {
                continue;
            }
            let predicted = prevPrice + bias;
            let error = price - predicted;
            if (Math.abs(error) > delta) {
                bias += error * 0.3;
                predicted = prevPrice + bias;
                error = price - predicted;
            }
            mseSum += error * error;
            mseCount++;

            const buySignal = signals.buy[i];
            const sellSignal = signals.sell[i];

            if (position === 0 && buySignal >= 0.6) {
                position = capital / price;
                capital = 0;
                entryPrice = price;
            } else if (position > 0 && sellSignal >= 0.6) {
                capital = position * price;
                tradeReturns.push((price - entryPrice) / entryPrice);
                position = 0;
                entryPrice = null;
            }
        }

        if (position > 0 && Number.isFinite(closes[length - 1])) {
            const finalPrice = closes[length - 1];
            capital = position * finalPrice;
            if (entryPrice) {
                tradeReturns.push((finalPrice - entryPrice) / entryPrice);
            }
        }

        const totalReturn = capital - 1;
        const tradeCount = tradeReturns.length;
        const avgReturn = tradeCount > 0 ? tradeReturns.reduce((sum, r) => sum + r, 0) / tradeCount : 0;
        const variance = tradeCount > 1
            ? tradeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (tradeCount - 1)
            : 0;
        const stdDev = Math.sqrt(Math.max(variance, 0));
        const sharpe = stdDev > 0 ? (avgReturn * Math.sqrt(Math.min(252, tradeCount || 1))) / stdDev : 0;
        const mse = mseCount > 0 ? mseSum / mseCount : Infinity;
        const mseScore = Number.isFinite(mse) ? 1 / (1 + mse) : 0;
        const returnScore = Math.tanh(totalReturn);
        const sharpeScore = Math.tanh(sharpe / 5);
        const tradeScore = Math.min(1, tradeCount / 10);
        const score = (0.45 * returnScore) + (0.3 * sharpeScore) + (0.15 * mseScore) + (0.1 * tradeScore);

        return {
            score,
            totalReturn,
            sharpe,
            mse,
            tradeCount
        };
    }

    function createRandomIndividual() {
        const individual = {};
        Object.keys(BOUNDS).forEach((key) => {
            const bound = BOUNDS[key];
            individual[key] = bound.min + Math.random() * (bound.max - bound.min);
        });
        return individual;
    }

    function cloneIndividual(individual) {
        return Object.assign({}, individual);
    }

    function mutateIndividual(individual, mutationRate) {
        const mutated = cloneIndividual(individual);
        Object.keys(mutated).forEach((key) => {
            if (Math.random() < mutationRate) {
                const bound = BOUNDS[key];
                const range = bound.max - bound.min;
                const jitter = (Math.random() * 2 - 1) * range * 0.15;
                mutated[key] = clamp(mutated[key] + jitter, bound.min, bound.max);
            }
        });
        return mutated;
    }

    function crossoverIndividuals(parentA, parentB) {
        const child = {};
        Object.keys(parentA).forEach((key) => {
            child[key] = Math.random() < 0.5 ? parentA[key] : parentB[key];
        });
        return child;
    }

    function evaluateIndividual(individual, dataset) {
        const signals = generateFuzzySignals(dataset, individual);
        const evaluation = simulateFuzzyTrading(dataset, signals, individual.delta);
        if (!Number.isFinite(evaluation.score)) {
            evaluation.score = -Infinity;
        }
        return evaluation;
    }

    function tournamentSelection(evaluated, tournamentSize) {
        let best = null;
        for (let i = 0; i < tournamentSize; i++) {
            const candidate = evaluated[Math.floor(Math.random() * evaluated.length)];
            if (!best || candidate.metrics.score > best.metrics.score) {
                best = candidate;
            }
        }
        return cloneIndividual(best.individual);
    }

    function shouldUseFuzzyStrategy(strategy) {
        if (!strategy) return false;
        const fuzzyStrategies = new Set([
            'rsi_oversold',
            'rsi_overbought',
            'cover_rsi_oversold',
            'short_rsi_overbought',
            'k_d_cross',
            'k_d_cross_exit',
            'cover_k_d_cross',
            'short_k_d_cross'
        ]);
        return fuzzyStrategies.has(strategy);
    }

    function prepareFuzzyContext(options) {
        const { stockData, combination, fuzzyOptions } = options || {};
        if (!Array.isArray(stockData) || stockData.length < 50) {
            return null;
        }
        if (!combination || typeof combination !== 'object') {
            return null;
        }
        const entryRelevant = shouldUseFuzzyStrategy(combination.buyStrategy);
        const exitRelevant = shouldUseFuzzyStrategy(combination.sellStrategy);
        if (!entryRelevant && !exitRelevant) {
            return null;
        }
        const mergedOptions = Object.assign({}, DEFAULT_OPTIONS, fuzzyOptions || {});
        const series = buildSeries(stockData, mergedOptions.sampleSize);
        if (series.closes.length < 50) {
            return null;
        }
        const rsi = computeRSI(series.closes, 14);
        const kd = computeStochasticKD(series, 9, 3);
        const validSamples = kd.d.filter((val, idx) => Number.isFinite(val) && Number.isFinite(kd.k[idx]) && Number.isFinite(rsi[idx])).length;
        if (validSamples < 30) {
            return null;
        }
        const dataset = {
            closes: series.closes,
            highs: series.highs,
            lows: series.lows,
            dates: series.dates,
            rsi,
            k: kd.k,
            d: kd.d,
            meta: {
                sampleSize: series.closes.length,
                validSamples
            }
        };
        return {
            version: VERSION,
            dataset,
            options: mergedOptions,
            combination,
            relevant: { entry: entryRelevant, exit: exitRelevant }
        };
    }

    function runGeneticFuzzyOptimization(context) {
        return new Promise((resolve) => {
            if (!context || !context.dataset) {
                resolve(null);
                return;
            }
            setTimeout(() => {
                const options = context.options || DEFAULT_OPTIONS;
                const populationSize = Math.max(8, options.populationSize | 0);
                const generations = Math.max(1, options.generations | 0);
                const crossoverRate = clamp(options.crossoverRate ?? 0.75, 0, 1);
                const mutationRate = clamp(options.mutationRate ?? 0.25, 0, 1);
                const eliteCount = clamp(options.eliteCount ?? 2, 1, populationSize);
                const tournamentSize = clamp(options.tournamentSize ?? 3, 2, Math.max(2, populationSize - 1));

                let population = [];
                for (let i = 0; i < populationSize; i++) {
                    population.push(createRandomIndividual());
                }

                let bestIndividual = null;
                let bestMetrics = null;
                let evaluationCount = 0;

                for (let gen = 0; gen < generations; gen++) {
                    const evaluated = population.map((individual) => {
                        const metrics = evaluateIndividual(individual, context.dataset);
                        evaluationCount++;
                        return { individual, metrics };
                    });

                    evaluated.sort((a, b) => b.metrics.score - a.metrics.score);
                    if (!bestMetrics || evaluated[0].metrics.score > bestMetrics.score) {
                        bestIndividual = cloneIndividual(evaluated[0].individual);
                        bestMetrics = Object.assign({}, evaluated[0].metrics);
                    }

                    const nextPopulation = [];
                    const eliteLimit = Math.min(eliteCount, evaluated.length);
                    for (let i = 0; i < eliteLimit; i++) {
                        nextPopulation.push(cloneIndividual(evaluated[i].individual));
                    }

                    while (nextPopulation.length < populationSize) {
                        const parentA = tournamentSelection(evaluated, tournamentSize);
                        let offspring;
                        if (Math.random() < crossoverRate) {
                            const parentB = tournamentSelection(evaluated, tournamentSize);
                            offspring = crossoverIndividuals(parentA, parentB);
                        } else {
                            offspring = cloneIndividual(parentA);
                        }
                        offspring = mutateIndividual(offspring, mutationRate);
                        nextPopulation.push(offspring);
                    }

                    population = nextPopulation;
                }

                if (!bestIndividual || !bestMetrics || !Number.isFinite(bestMetrics.score) || bestMetrics.score === -Infinity) {
                    resolve(null);
                    return;
                }

                resolve({
                    version: VERSION,
                    bestIndividual,
                    metrics: bestMetrics,
                    diagnostics: {
                        evaluations: evaluationCount,
                        populationSize,
                        generations,
                        datasetSamples: context.dataset.meta?.sampleSize || null,
                        validSamples: context.dataset.meta?.validSamples || null
                    }
                });
            }, 0);
        });
    }

    const api = global.lazybacktestGA || {};
    api.VERSION = VERSION;
    api.prepareFuzzyContext = prepareFuzzyContext;
    api.runGeneticFuzzyOptimization = runGeneticFuzzyOptimization;
    api.shouldUseFuzzyStrategy = shouldUseFuzzyStrategy;
    api.clamp = clamp;
    global.lazybacktestGA = api;
})(typeof window !== 'undefined' ? window : self);
