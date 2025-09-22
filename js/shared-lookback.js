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
    const multiplier = Number.isFinite(options.multiplier) && options.multiplier > 0 ? options.multiplier : 2;
    const minBars = Number.isFinite(options.minBars) ? options.minBars : 0;
    const extraBars = Number.isFinite(options.extraBars) ? options.extraBars : 0;
    const base = Number.isFinite(maxPeriod) && maxPeriod > 0 ? maxPeriod : 0;
    const scaled = Math.ceil(base * multiplier) + extraBars;
    return Math.max(minBars, scaled, 0);
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
      : 5;
    const totalTradingDays = Math.max(0, Math.ceil((lookbackBars || 0) + marginTradingDays));
    let buffered = subtractTradingDays(effectiveStartISO, totalTradingDays, options);
    const extraCalendarDays = Number.isFinite(options.extraCalendarDays)
      ? Math.max(0, Math.floor(options.extraCalendarDays))
      : 0;
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

  const api = {
    MIN_DATA_DATE: DEFAULT_MIN_DATA_DATE,
    getMaxIndicatorPeriod,
    estimateLookbackBars,
    computeBufferedStartDate,
    subtractTradingDays,
  };

  if (typeof globalScope.lazybacktestShared === 'object' && globalScope.lazybacktestShared) {
    Object.assign(globalScope.lazybacktestShared, api);
  } else {
    globalScope.lazybacktestShared = api;
  }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : undefined);
