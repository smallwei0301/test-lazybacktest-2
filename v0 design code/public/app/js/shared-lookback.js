(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_MIN_DATA_DATE = '2004-01-01';

  function toNumber(value) {
    if (value === null || value === undefined) return NaN;
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function gatherPeriods(paramObj, tracker) {
    if (!paramObj || typeof paramObj !== 'object') return;
    const normalized = {};
    for (const key of Object.keys(paramObj)) {
      const value = toNumber(paramObj[key]);
      if (!Number.isFinite(value) || value <= 0) continue;
      const lowerKey = key.toLowerCase();
      normalized[lowerKey] = value;
      if (lowerKey.includes('period') || lowerKey.includes('window')) {
        tracker.add(value);
      }
      if (lowerKey.includes('lookback') || lowerKey.endsWith('length')) {
        tracker.add(value);
      }
      if (lowerKey === 'atrperiod') {
        tracker.add(value);
      }
    }
    if (Number.isFinite(normalized.longperiod) && Number.isFinite(normalized.signalperiod)) {
      tracker.add(normalized.longperiod + normalized.signalperiod);
    }
    if (Number.isFinite(normalized.shortperiod) && Number.isFinite(normalized.signalperiod)) {
      tracker.add(normalized.shortperiod + normalized.signalperiod);
    }
    if (Number.isFinite(normalized.kperiod) && Number.isFinite(normalized.dperiod)) {
      tracker.add(normalized.kperiod + normalized.dperiod);
    }
    if (Number.isFinite(normalized.kperiod) && Number.isFinite(normalized.smoothingperiod)) {
      tracker.add(normalized.kperiod + normalized.smoothingperiod);
    }
  }

  class PeriodTracker {
    constructor() {
      this.max = 0;
    }
    add(value) {
      if (Number.isFinite(value) && value > this.max) {
        this.max = value;
      }
    }
    value() {
      return this.max;
    }
  }

  function getMaxIndicatorPeriod(params = {}) {
    const tracker = new PeriodTracker();
    const groups = [
      params.entryParams,
      params.exitParams,
      params.shortEntryParams,
      params.shortExitParams,
      params.riskParams,
    ];
    groups.forEach((group) => gatherPeriods(group, tracker));
    return tracker.value();
  }

  function estimateLookbackBars(maxPeriod, options = {}) {
    const multiplier =
      Number.isFinite(options.multiplier) && options.multiplier > 0
        ? options.multiplier
        : 2;
    const minBars =
      Number.isFinite(options.minBars) && options.minBars > 0
        ? Math.ceil(options.minBars)
        : 0;
    const extraBars =
      Number.isFinite(options.extraBars) && options.extraBars > 0
        ? Math.ceil(options.extraBars)
        : 0;
    const base = Number.isFinite(maxPeriod) && maxPeriod > 0 ? maxPeriod : 0;
    const scaled = base > 0 ? Math.ceil(base * multiplier) : 0;
    const margin = Number.isFinite(options.marginPeriods) && options.marginPeriods > 0
      ? Math.ceil(options.marginPeriods)
      : base > 0
        ? Math.max(10, Math.ceil(base * 0.5))
        : 0;
    const total = scaled + extraBars + margin;
    const fallback = base + margin;
    return Math.max(minBars, total, fallback, 0);
  }

  function parseISOToUTC(iso) {
    if (!iso || typeof iso !== 'string') return NaN;
    const [y, m, d] = iso.split('-').map((val) => parseInt(val, 10));
    if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
    return Date.UTC(y, (m || 1) - 1, d || 1);
  }

  function utcToISO(ms) {
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function subtractTradingDays(startISO, tradingDays, options = {}) {
    const startUTC = parseISOToUTC(startISO);
    if (!Number.isFinite(startUTC)) return startISO;
    const minDateISO = options.minDate || DEFAULT_MIN_DATA_DATE;
    const minUTC = parseISOToUTC(minDateISO);
    let remaining = Math.max(0, Math.floor(tradingDays));
    let cursor = startUTC - DAY_MS;
    while (remaining > 0 && cursor >= minUTC) {
      const day = new Date(cursor).getUTCDay();
      if (day >= 1 && day <= 5) {
        remaining -= 1;
      }
      cursor -= DAY_MS;
    }
    let resolved = cursor + DAY_MS;
    if (remaining > 0) {
      resolved = minUTC;
    }
    if (resolved < minUTC) {
      resolved = minUTC;
    }
    return utcToISO(resolved) || startISO;
  }

  function computeBufferedStartDate(effectiveStartISO, lookbackBars, options = {}) {
    if (!effectiveStartISO) return effectiveStartISO;
    const marginTradingDays = Number.isFinite(options.marginTradingDays)
      ? Math.max(0, Math.floor(options.marginTradingDays))
      : 10;
    const totalTradingDays = Math.max(0, Math.ceil((lookbackBars || 0) + marginTradingDays));
    let buffered = subtractTradingDays(effectiveStartISO, totalTradingDays, options);
    const extraCalendarDays = Number.isFinite(options.extraCalendarDays)
      ? Math.max(0, Math.floor(options.extraCalendarDays))
      : 7;
    if (extraCalendarDays > 0) {
      const bufferedUTC = parseISOToUTC(buffered);
      const minUTC = parseISOToUTC(options.minDate || DEFAULT_MIN_DATA_DATE);
      let targetUTC = bufferedUTC - extraCalendarDays * DAY_MS;
      if (Number.isFinite(targetUTC)) {
        if (Number.isFinite(minUTC) && targetUTC < minUTC) {
          targetUTC = minUTC;
        }
        buffered = utcToISO(targetUTC) || buffered;
      }
    }
    const effectiveUTC = parseISOToUTC(effectiveStartISO);
    const bufferedUTC = parseISOToUTC(buffered);
    if (Number.isFinite(effectiveUTC) && Number.isFinite(bufferedUTC) && bufferedUTC > effectiveUTC) {
      return effectiveStartISO;
    }
    return buffered;
  }

  function resolveLookbackDays(params = {}, options = {}) {
    const maxPeriod = getMaxIndicatorPeriod(params);
    const normalizedMinBars = Number.isFinite(options.minBars) && options.minBars > 0
      ? Math.ceil(options.minBars)
      : 90;
    const normalizedMultiplier = Number.isFinite(options.multiplier) && options.multiplier > 0
      ? Number(options.multiplier)
      : 2;
    const normalizedExtraBars = Number.isFinite(options.extraBars) && options.extraBars > 0
      ? Math.ceil(options.extraBars)
      : 0;
    const normalizedMarginPeriods = Number.isFinite(options.marginPeriods) && options.marginPeriods > 0
      ? Math.ceil(options.marginPeriods)
      : undefined;

    const estimated = estimateLookbackBars(maxPeriod, {
      multiplier: normalizedMultiplier,
      minBars: normalizedMinBars,
      extraBars: normalizedExtraBars,
      marginPeriods: normalizedMarginPeriods,
    });

    const paramMinLookback = toNumber(params?.minLookbackDays);
    const optionMinLookback = toNumber(options.minLookbackDays);
    const requestedMinLookback = Math.max(
      0,
      Number.isFinite(paramMinLookback) && paramMinLookback > 0 ? Math.ceil(paramMinLookback) : 0,
      Number.isFinite(optionMinLookback) && optionMinLookback > 0 ? Math.ceil(optionMinLookback) : 0,
    );

    const paramMaxLookback = toNumber(params?.maxLookbackDays);
    const optionMaxLookback = toNumber(options.maxLookbackDays);
    const requestedMaxLookbackCandidates = [paramMaxLookback, optionMaxLookback]
      .map((value) => (Number.isFinite(value) && value > 0 ? Math.ceil(value) : null))
      .filter((value) => Number.isFinite(value) && value > 0);
    const requestedMaxLookback = requestedMaxLookbackCandidates.length > 0
      ? Math.min(...requestedMaxLookbackCandidates)
      : null;

    let resolvedLookback = Number.isFinite(estimated) && estimated > 0 ? Math.ceil(estimated) : 0;
    if (requestedMinLookback > 0) {
      resolvedLookback = Math.max(resolvedLookback, requestedMinLookback);
    }
    if (Number.isFinite(requestedMaxLookback) && requestedMaxLookback > 0) {
      resolvedLookback = resolvedLookback > 0
        ? Math.min(resolvedLookback, requestedMaxLookback)
        : requestedMaxLookback;
    }

    const fallbackLookback = Number.isFinite(options.fallbackLookbackDays) && options.fallbackLookbackDays > 0
      ? Math.ceil(options.fallbackLookbackDays)
      : Math.max(normalizedMinBars, Math.ceil((maxPeriod || 0) * normalizedMultiplier));
    if (!Number.isFinite(resolvedLookback) || resolvedLookback <= 0) {
      resolvedLookback = Math.max(0, fallbackLookback);
    }

    const normalizedMarginTradingDays = Number.isFinite(options.marginTradingDays) && options.marginTradingDays >= 0
      ? Math.ceil(options.marginTradingDays)
      : 12;

    const minSamples = Math.max(
      normalizedMinBars,
      Math.ceil(maxPeriod || 0),
      requestedMinLookback,
      resolvedLookback,
    );

    return {
      maxIndicatorPeriod: maxPeriod || 0,
      estimatedLookbackDays: Math.ceil(Number.isFinite(estimated) ? estimated : 0),
      lookbackDays: Math.max(0, Math.ceil(resolvedLookback)),
      minSamples,
      bufferTradingDays: normalizedMarginTradingDays,
      options: {
        multiplier: normalizedMultiplier,
        minBars: normalizedMinBars,
        extraBars: normalizedExtraBars,
        marginPeriods: normalizedMarginPeriods || null,
        minLookbackDays: requestedMinLookback || 0,
        maxLookbackDays: Number.isFinite(requestedMaxLookback) ? requestedMaxLookback : null,
      },
    };
  }

  function resolveDataWindow(params = {}, options = {}) {
    const decision = resolveLookbackDays(params, options);
    const candidateEffectiveDates = [
      params?.effectiveStartDate,
      params?.startDate,
      options?.effectiveStartDate,
      options?.fallbackStartDate,
      options?.defaultStartDate,
    ];
    const effectiveStartDate = candidateEffectiveDates.find((value) => value && typeof value === 'string') || null;
    const minDate = options.minDate || DEFAULT_MIN_DATA_DATE;
    const normalizedExtraCalendar = Number.isFinite(options.extraCalendarDays) && options.extraCalendarDays >= 0
      ? Math.floor(options.extraCalendarDays)
      : 7;
    let dataStartDate = effectiveStartDate;
    if (effectiveStartDate) {
      dataStartDate = computeBufferedStartDate(effectiveStartDate, decision.lookbackDays, {
        minDate,
        marginTradingDays: decision.bufferTradingDays,
        extraCalendarDays: normalizedExtraCalendar,
      }) || effectiveStartDate;
    }
    if (!dataStartDate) {
      dataStartDate = minDate;
    }
    return {
      ...decision,
      effectiveStartDate,
      dataStartDate,
      extraCalendarDays: normalizedExtraCalendar,
      minDataDate: minDate,
    };
  }

  function traceLookbackDecision(params = {}, options = {}) {
    const windowDecision = resolveDataWindow(params, options);
    const steps = [
      {
        key: 'maxIndicatorPeriod',
        value: windowDecision.maxIndicatorPeriod,
        note: '策略參數推導的最大指標週期',
      },
      {
        key: 'estimatedLookbackDays',
        value: windowDecision.estimatedLookbackDays,
        note: 'estimateLookbackBars 估計的暖身需求',
      },
      {
        key: 'appliedMinSamples',
        value: windowDecision.minSamples,
        note: '套用最小樣本數後的需求',
      },
      {
        key: 'lookbackDays',
        value: windowDecision.lookbackDays,
        note: '最終暖身交易日數',
      },
      {
        key: 'bufferTradingDays',
        value: windowDecision.bufferTradingDays,
        note: '額外回推的交易日緩衝',
      },
      {
        key: 'extraCalendarDays',
        value: windowDecision.extraCalendarDays,
        note: '額外回推的日曆天數',
      },
      {
        key: 'effectiveStartDate',
        value: windowDecision.effectiveStartDate,
        note: '使用者設定或推導的回測起點',
      },
      {
        key: 'dataStartDate',
        value: windowDecision.dataStartDate,
        note: '實際抓取資料的暖身起點',
      },
    ];
    return {
      ...windowDecision,
      steps,
      paramsSnapshot: {
        startDate: params?.startDate || null,
        effectiveStartDate: params?.effectiveStartDate || null,
        market: params?.market || params?.marketType || null,
        minLookbackDays: params?.minLookbackDays || null,
        maxLookbackDays: params?.maxLookbackDays || null,
      },
    };
  }

  // ✅ P1 新增: 根據策略組合計算所需 lookback
  // 用於滾動測試和批量優化的統一邏輯
  function getRequiredLookbackForStrategies(strategyIds, options = {}) {
    if (!Array.isArray(strategyIds) || strategyIds.length === 0) {
      return Math.max(90, options.minBars || 90);
    }

    let maxPeriod = 0;

    strategyIds.forEach(strategyId => {
      if (!strategyId) return;

      // 嘗試從全局 strategyDescriptions 取得策略信息
      let strategyParams = null;
      
      if (typeof globalScope !== 'undefined' && globalScope.strategyDescriptions) {
        const strategyInfo = globalScope.strategyDescriptions[strategyId];
        if (strategyInfo && strategyInfo.defaultParams) {
          strategyParams = strategyInfo.defaultParams;
        }
      }

      // 如果找不到策略定義，嘗試使用傳入的參數
      if (!strategyParams && typeof options.strategyParams === 'object') {
        strategyParams = options.strategyParams[strategyId];
      }

      // 計算該策略的最大期數
      if (strategyParams) {
        const periodInThisStrategy = getMaxIndicatorPeriod(strategyParams);
        if (Number.isFinite(periodInThisStrategy) && periodInThisStrategy > maxPeriod) {
          maxPeriod = periodInThisStrategy;
        }
      }
    });

    // 計算最終所需暖身日數
    // 如果 maxPeriod 為 0，使用最小值 90
    const minBars = Number.isFinite(options.minBars) ? options.minBars : 90;
    const multiplier = Number.isFinite(options.multiplier) ? options.multiplier : 2;
    
    return estimateLookbackBars(maxPeriod, {
      minBars: minBars,
      multiplier: multiplier,
      extraBars: options.extraBars || 0,
    });
  }

  const api = {
    MIN_DATA_DATE: DEFAULT_MIN_DATA_DATE,
    getMaxIndicatorPeriod,
    estimateLookbackBars,
    computeBufferedStartDate,
    subtractTradingDays,
    resolveLookbackDays,
    resolveDataWindow,
    traceLookbackDecision,
    getRequiredLookbackForStrategies,  // ✅ 導出新函數
  };

  if (typeof globalScope.lazybacktestShared === 'object' && globalScope.lazybacktestShared) {
    Object.assign(globalScope.lazybacktestShared, api);
  } else {
    globalScope.lazybacktestShared = api;
  }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : undefined);
