(function (root) {
  const globalScope = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const namespace = globalScope.lazybacktestDiagnostics = globalScope.lazybacktestDiagnostics || {};
  const DSR_VERSION = "LB-DSR-20251120A";

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    let total = 0;
    for (const value of values) {
      total += value;
    }
    return total / values.length;
  }

  function computeCentralMoments(values, centre) {
    const moments = { m2: 0, m3: 0, m4: 0 };
    if (!Array.isArray(values) || values.length === 0) {
      return moments;
    }
    for (const value of values) {
      const diff = value - centre;
      const diff2 = diff * diff;
      moments.m2 += diff2;
      moments.m3 += diff2 * diff;
      moments.m4 += diff2 * diff2;
    }
    moments.m2 /= values.length;
    moments.m3 /= values.length;
    moments.m4 /= values.length;
    return moments;
  }

  function erf(x) {
    // Abramowitz & Stegun formula 7.1.26
    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * absX);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const poly = ((((a5 * t + a4) * t) + a3) * t + a2) * t + a1;
    const exponent = Math.exp(-absX * absX);
    return sign * (1 - poly * t * exponent);
  }

  function normCdf(x) {
    return 0.5 * (1 + erf(x / Math.SQRT2));
  }

  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    // Approximation by Peter J. Acklam (2003)
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
    let r;

    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    q = p - 0.5;
    r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  function deriveDailyReturnsFromCumulative(cumulativeSeries) {
    if (!Array.isArray(cumulativeSeries) || cumulativeSeries.length === 0) {
      return [];
    }
    const returns = [];
    let previousRatio = null;
    for (let i = 0; i < cumulativeSeries.length; i += 1) {
      const value = Number(cumulativeSeries[i]);
      if (!Number.isFinite(value)) {
        continue;
      }
      const ratio = 1 + value / 100;
      if (!Number.isFinite(ratio) || ratio <= 0) {
        continue;
      }
      if (previousRatio !== null && previousRatio > 0) {
        const dailyReturn = ratio / previousRatio - 1;
        if (Number.isFinite(dailyReturn)) {
          returns.push(dailyReturn);
        }
      }
      previousRatio = ratio;
    }
    return returns;
  }

  function computeDeflatedSharpeRatioFromReturns(dailyReturns, options = {}) {
    const info = {
      version: DSR_VERSION,
      value: null,
      sharpe: null,
      sampleSize: Array.isArray(dailyReturns) ? dailyReturns.length : 0,
      thresholdSharpe: null,
      skewness: null,
      kurtosis: null,
      trials: null,
      notes: [],
    };

    if (!Array.isArray(dailyReturns) || dailyReturns.length < 3) {
      info.notes.push('樣本不足，無法估計 DSR');
      return info;
    }

    const filtered = dailyReturns.filter((value) => Number.isFinite(value));
    if (filtered.length < 3) {
      info.notes.push('有效日報酬不足，無法估計 DSR');
      return info;
    }

    info.sampleSize = filtered.length;
    const avg = mean(filtered);
    if (!Number.isFinite(avg)) {
      info.notes.push('日報酬平均無效');
      return info;
    }

    const moments = computeCentralMoments(filtered, avg);
    if (!Number.isFinite(moments.m2) || moments.m2 <= 0) {
      info.notes.push('日報酬變異數不足');
      return info;
    }

    const stdDev = Math.sqrt(moments.m2);
    if (!Number.isFinite(stdDev) || stdDev === 0) {
      info.notes.push('日報酬標準差為 0');
      return info;
    }

    const annualization = Number.isFinite(options.annualizationFactor)
      ? options.annualizationFactor
      : 252;
    let sharpe = Number.isFinite(options.sharpeRatio) ? options.sharpeRatio : null;
    if (!Number.isFinite(sharpe)) {
      sharpe = (avg / stdDev) * Math.sqrt(annualization);
    }
    if (!Number.isFinite(sharpe)) {
      info.notes.push('Sharpe Ratio 無效');
      return info;
    }

    info.sharpe = sharpe;

    const skewness = stdDev === 0 ? 0 : moments.m3 / Math.pow(stdDev, 3);
    const kurtosis = stdDev === 0 ? 3 : moments.m4 / (moments.m2 * moments.m2);
    info.skewness = Number.isFinite(skewness) ? skewness : 0;
    info.kurtosis = Number.isFinite(kurtosis) ? kurtosis : 3;

    const trials = Number.isFinite(options.numTrials) && options.numTrials > 0
      ? Math.round(options.numTrials)
      : 1;
    info.trials = trials;

    if (info.sampleSize <= 1) {
      info.notes.push('有效樣本過少，無法估計 DSR');
      return info;
    }

    const varianceAdjustment = 1 - info.skewness * sharpe + ((info.kurtosis - 1) / 4) * sharpe * sharpe;
    if (!Number.isFinite(varianceAdjustment) || varianceAdjustment <= 0) {
      info.notes.push('Sharpe 校正值異常');
      return info;
    }

    const adjustedQuantile = 1 - 0.5 * (1 - Math.pow(0.5, 1 / trials));
    const zScore = normInv(adjustedQuantile);
    if (!Number.isFinite(zScore)) {
      info.notes.push('無法取得 Z 分數');
      return info;
    }

    const srThreshold = zScore * Math.sqrt(varianceAdjustment / (info.sampleSize - 1));
    info.thresholdSharpe = srThreshold;

    const numerator = (sharpe - srThreshold) * Math.sqrt(info.sampleSize - 1);
    const denominator = Math.sqrt(varianceAdjustment);
    if (!Number.isFinite(denominator) || denominator === 0) {
      info.notes.push('Sharpe 變異校正為 0');
      return info;
    }

    const dsrValue = normCdf(numerator / denominator);
    if (!Number.isFinite(dsrValue)) {
      info.notes.push('DSR 計算失敗');
      return info;
    }

    info.value = clamp(dsrValue, 0, 1);
    return info;
  }

  function computeDeflatedSharpeRatioFromCumulative(cumulativeReturns, options = {}) {
    const dailyReturns = deriveDailyReturnsFromCumulative(cumulativeReturns);
    return computeDeflatedSharpeRatioFromReturns(dailyReturns, options);
  }

  namespace.computeDeflatedSharpeRatio = computeDeflatedSharpeRatioFromReturns;
  namespace.computeDeflatedSharpeRatioFromCumulative = computeDeflatedSharpeRatioFromCumulative;
  namespace.deriveDailyReturnsFromCumulative = deriveDailyReturnsFromCumulative;
  namespace.dsrVersion = DSR_VERSION;
})(typeof self !== "undefined" ? self : this);
