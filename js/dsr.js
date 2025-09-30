(function (global) {
  const namespace = global.lazybacktestOverfit || (global.lazybacktestOverfit = {});
  const DSR_VERSION = 'LB-OVERFIT-SCORING-20250915A';

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * absX);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const poly = (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t;
    const result = 1 - poly * Math.exp(-absX * absX);
    return sign * result;
  }

  function normCdf(x) {
    if (!isFiniteNumber(x)) {
      return NaN;
    }
    return 0.5 * (1 + erf(x / Math.SQRT2));
  }

  function normInv(p) {
    if (p <= 0) {
      return -Infinity;
    }
    if (p >= 1) {
      return Infinity;
    }
    const a = [
      -3.969683028665376e+01,
      2.209460984245205e+02,
      -2.759285104469687e+02,
      1.383577518672690e+02,
      -3.066479806614716e+01,
      2.506628277459239e+00,
    ];
    const b = [
      -5.447609879822406e+01,
      1.615858368580409e+02,
      -1.556989798598866e+02,
      6.680131188771972e+01,
      -1.328068155288572e+01,
    ];
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
      4.374664141464968e+00,
      2.938163982698783e+00,
    ];
    const d = [
      7.784695709041462e-03,
      3.224671290700398e-01,
      2.445134137142996e+00,
      3.754408661907416e+00,
    ];
    const plow = 0.02425;
    const phigh = 1 - plow;
    let q;
    let x;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      return -x;
    }
    if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      return x;
    }
    q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    return x;
  }

  function calculateMoments(values) {
    const n = values.length;
    if (n === 0) {
      return {
        mean: 0,
        std: 0,
        skewness: 0,
        kurtosis: 3,
      };
    }
    const meanValue = values.reduce((sum, value) => sum + value, 0) / n;
    let m2 = 0;
    let m3 = 0;
    let m4 = 0;
    for (let i = 0; i < n; i += 1) {
      const diff = values[i] - meanValue;
      const diff2 = diff * diff;
      m2 += diff2;
      m3 += diff2 * diff;
      m4 += diff2 * diff2;
    }
    m2 /= n;
    m3 /= n;
    m4 /= n;
    const std = Math.sqrt(Math.max(m2, 0));
    const skewness = std > 0 ? m3 / Math.pow(std, 3) : 0;
    const kurtosis = std > 0 ? m4 / (m2 * m2) : 3;
    return { mean: meanValue, std, skewness, kurtosis };
  }

  function computeDSR(dailyReturns, options = {}) {
    const returns = Array.isArray(dailyReturns)
      ? dailyReturns.filter(isFiniteNumber)
      : [];
    const sampleSize = returns.length;
    if (sampleSize < 3) {
      return {
        version: DSR_VERSION,
        dsr: 0,
        sharpe: null,
        dailySharpe: null,
        sampleSize,
        skewness: null,
        kurtosis: null,
        srStar: null,
        zValue: null,
      };
    }

    const { mean: meanReturn, std, skewness, kurtosis } = calculateMoments(returns);
    if (std === 0) {
      return {
        version: DSR_VERSION,
        dsr: 0,
        sharpe: null,
        dailySharpe: 0,
        sampleSize,
        skewness,
        kurtosis,
        srStar: null,
        zValue: null,
      };
    }

    const dailySharpe = meanReturn / std;
    const annualizedSharpe = dailySharpe * Math.sqrt(252);
    const trials = Math.max(1, Number.isFinite(options.numTrials) ? options.numTrials : 1);
    const srStar = trials > 1 ? normInv(1 - 1 / trials) : 0;
    const denominatorBase = 1 - skewness * dailySharpe + ((kurtosis - 1) / 4) * dailySharpe * dailySharpe;
    const denominator = Math.sqrt(Math.max(denominatorBase, 1e-12));
    const numerator = (dailySharpe - srStar) * Math.sqrt(sampleSize - 1);
    const zValue = numerator / denominator;
    const dsrProbability = normCdf(zValue);

    return {
      version: DSR_VERSION,
      dsr: dsrProbability,
      sharpe: annualizedSharpe,
      dailySharpe,
      sampleSize,
      skewness,
      kurtosis,
      srStar,
      zValue,
    };
  }

  namespace.computeDSR = computeDSR;
  namespace.normCdf = normCdf;
  namespace.normInv = normInv;
  namespace.constants = namespace.constants || {};
  namespace.constants.DSR_VERSION = DSR_VERSION;
})(typeof window !== 'undefined' ? window : self);
