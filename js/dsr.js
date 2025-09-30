(function(global) {
    const OVERFIT_VERSION_CODE = 'LB-OVERFIT-SCORING-20250709A';

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function mean(values) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length === 0) return null;
        const total = valid.reduce((acc, value) => acc + value, 0);
        return total / valid.length;
    }

    function variance(values, sampleMean) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length < 2) return null;
        const meanValue = sampleMean ?? mean(valid);
        if (!isFiniteNumber(meanValue)) return null;
        const sumSquared = valid.reduce((acc, value) => acc + Math.pow(value - meanValue, 2), 0);
        return sumSquared / (valid.length - 1);
    }

    function skewness(values, sampleMean, sampleStd) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length < 3 || !isFiniteNumber(sampleMean) || !isFiniteNumber(sampleStd) || sampleStd === 0) return 0;
        const n = valid.length;
        const sum = valid.reduce((acc, value) => acc + Math.pow((value - sampleMean) / sampleStd, 3), 0);
        return (n / ((n - 1) * (n - 2))) * sum;
    }

    function excessKurtosis(values, sampleMean, sampleStd) {
        const valid = values.filter(isFiniteNumber);
        if (valid.length < 4 || !isFiniteNumber(sampleMean) || !isFiniteNumber(sampleStd) || sampleStd === 0) return 0;
        const n = valid.length;
        const sum = valid.reduce((acc, value) => acc + Math.pow((value - sampleMean) / sampleStd, 4), 0);
        const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum;
        const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
        return term1 - term2;
    }

    function normalCdf(value) {
        return 0.5 * (1 + erf(value / Math.SQRT2));
    }

    function erf(x) {
        const sign = x >= 0 ? 1 : -1;
        const absX = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + p * absX);
        const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
        return sign * y;
    }

    function expectedMaxSharpe(numTrials) {
        if (!Number.isFinite(numTrials) || numTrials <= 1) {
            return 0;
        }
        const logN = Math.log(numTrials);
        if (!Number.isFinite(logN) || logN <= 0) {
            return 0;
        }
        const logLogN = Math.log(logN);
        const term1 = Math.sqrt(2 * logN);
        const term2 = (logLogN + Math.log(4 * Math.PI)) / (2 * term1);
        return term1 - term2;
    }

    function computeDeflatedSharpeRatio(dailyReturns, options = {}) {
        if (!Array.isArray(dailyReturns) || dailyReturns.length < 2) {
            return {
                version: OVERFIT_VERSION_CODE,
                sampleSize: Array.isArray(dailyReturns) ? dailyReturns.length : 0,
                sharpe: null,
                dsr: null,
                notes: ['insufficient_samples']
            };
        }

        const validReturns = dailyReturns.filter(isFiniteNumber);
        if (validReturns.length < 2) {
            return {
                version: OVERFIT_VERSION_CODE,
                sampleSize: validReturns.length,
                sharpe: null,
                dsr: null,
                notes: ['no_valid_returns']
            };
        }

        const sampleMean = mean(validReturns);
        const sampleVariance = variance(validReturns, sampleMean);
        if (!isFiniteNumber(sampleVariance) || sampleVariance === 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                sampleSize: validReturns.length,
                sharpe: 0,
                dsr: 0,
                notes: ['zero_variance']
            };
        }
        const sampleStd = Math.sqrt(sampleVariance);
        const sharpe = sampleStd > 0 ? (sampleMean / sampleStd) * Math.sqrt(252) : 0;
        const sampleSkewness = skewness(validReturns, sampleMean, sampleStd);
        const sampleExcessKurtosis = excessKurtosis(validReturns, sampleMean, sampleStd);

        const sampleSize = validReturns.length;
        const trialCount = options.trialCount && Number.isFinite(options.trialCount)
            ? Math.max(1, options.trialCount)
            : 1;
        const srMin = expectedMaxSharpe(trialCount);
        const denominator = Math.sqrt(
            1 - sampleSkewness * sharpe + (sampleExcessKurtosis / 4) * sharpe * sharpe
        );
        if (!isFiniteNumber(denominator) || denominator <= 0) {
            return {
                version: OVERFIT_VERSION_CODE,
                sampleSize,
                sharpe,
                srMin,
                dsr: 0,
                skewness: sampleSkewness,
                excessKurtosis: sampleExcessKurtosis,
                notes: ['invalid_denominator']
            };
        }

        const adjustedSharpe = (sharpe - srMin) * Math.sqrt(sampleSize - 1) / denominator;
        const dsr = normalCdf(adjustedSharpe);

        return {
            version: OVERFIT_VERSION_CODE,
            sampleSize,
            sharpe,
            srMin,
            dsr: Math.max(0, Math.min(1, dsr)),
            skewness: sampleSkewness,
            excessKurtosis: sampleExcessKurtosis,
            denominator,
        };
    }

    if (!global.lazybacktestOverfit) {
        global.lazybacktestOverfit = {};
    }

    if (!global.lazybacktestOverfit.dsr) {
        global.lazybacktestOverfit.dsr = {};
    }

    global.lazybacktestOverfit.dsr.computeDeflatedSharpeRatio = computeDeflatedSharpeRatio;
    global.lazybacktestOverfit.dsr.version = OVERFIT_VERSION_CODE;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
