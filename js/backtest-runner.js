// Patch Tag: LB-PLUGIN-RUNNER-20250712B
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const RUNNER_VERSION = 'LB-PLUGIN-RUNNER-20250712B';
  const existing = globalScope.BacktestRunner;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= RUNNER_VERSION) {
    return;
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function normalizeMarketValue(value) {
    const normalized = (value || 'TWSE').toString().toUpperCase();
    if (normalized === 'NASDAQ' || normalized === 'NYSE') {
      return 'US';
    }
    return normalized;
  }

  function isIndexSymbol(stockNo) {
    if (!stockNo || typeof stockNo !== 'string') {
      return false;
    }
    const trimmed = stockNo.trim();
    return trimmed.startsWith('^') && trimmed.length > 1;
  }

  function clampNumeric(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let output = value;
    if (descriptor.type === 'integer') {
      output = Math.round(output);
    }
    if (Number.isFinite(descriptor.minimum)) {
      output = Math.max(descriptor.minimum, output);
    }
    if (Number.isFinite(descriptor.maximum)) {
      output = Math.min(descriptor.maximum, output);
    }
    return output;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!schema || typeof schema !== 'object') {
      return rawParams && typeof rawParams === 'object' ? { ...rawParams } : {};
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    if (!rawParams || typeof rawParams !== 'object') {
      return output;
    }
    Object.keys(rawParams).forEach((key) => {
      const value = rawParams[key];
      const descriptor = properties[key];
      if (!descriptor || typeof descriptor !== 'object') {
        output[key] = value;
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = toNumber(value);
        if (Number.isFinite(numeric)) {
          output[key] = clampNumeric(numeric, descriptor);
        }
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function sanitizeStagePercentages(values, fallback) {
    if (!Array.isArray(values)) {
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.slice() : [100];
    }
    const sanitized = values
      .map((val) => toNumber(val))
      .filter((num) => Number.isFinite(num) && num > 0 && num <= 100)
      .map((num) => Math.round(num * 1000) / 1000);
    if (sanitized.length === 0) {
      return Array.isArray(fallback) && fallback.length > 0 ? fallback.slice() : [100];
    }
    return sanitized;
  }

  function resolveStrategyMeta(registry, strategyId) {
    if (!registry || typeof registry.getStrategyMetaById !== 'function') {
      return null;
    }
    try {
      return registry.getStrategyMetaById(strategyId) || null;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[BacktestRunner] 讀取策略 ${strategyId} meta 失敗`, error);
      }
      return null;
    }
  }

  function buildStrategyParams(registry, strategyId, params) {
    if (!strategyId) {
      return {};
    }
    const meta = resolveStrategyMeta(registry, strategyId);
    return applySchemaDefaults(meta && meta.paramsSchema, params);
  }

  function resolveWorkerUrl() {
    if (typeof workerUrl !== 'undefined' && workerUrl) {
      return workerUrl;
    }
    if (globalScope.workerUrl) {
      return globalScope.workerUrl;
    }
    return 'js/worker.js';
  }

  function computeLookbackDecision(params, overrides) {
    const shared = globalScope.lazybacktestShared && typeof globalScope.lazybacktestShared === 'object'
      ? globalScope.lazybacktestShared
      : null;
    const decisionOptions = {
      minBars: 90,
      multiplier: 2,
      marginTradingDays: 12,
      extraCalendarDays: 7,
      minDate: shared && typeof shared.MIN_DATA_DATE === 'string' ? shared.MIN_DATA_DATE : undefined,
    };
    let lookbackDays = Number.isFinite(overrides?.lookbackDays) && overrides.lookbackDays > 0
      ? Math.floor(overrides.lookbackDays)
      : null;
    let effectiveStartDate = overrides?.effectiveStartDate || params.effectiveStartDate || params.startDate;
    let dataStartDate = overrides?.dataStartDate || params.dataStartDate || effectiveStartDate || params.startDate;
    if (!lookbackDays && shared && typeof shared.resolveDataWindow === 'function') {
      try {
        const windowDecision = shared.resolveDataWindow(params, decisionOptions);
        if (windowDecision && Number.isFinite(windowDecision.lookbackDays) && windowDecision.lookbackDays > 0) {
          lookbackDays = Math.floor(windowDecision.lookbackDays);
        }
        if (windowDecision?.effectiveStartDate) {
          effectiveStartDate = windowDecision.effectiveStartDate;
        }
        if (windowDecision?.dataStartDate) {
          dataStartDate = windowDecision.dataStartDate;
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BacktestRunner] resolveDataWindow 失敗', error);
        }
      }
    }
    if (!lookbackDays && shared && typeof shared.resolveLookbackDays === 'function') {
      try {
        const fallbackDecision = shared.resolveLookbackDays(params, decisionOptions);
        if (fallbackDecision && Number.isFinite(fallbackDecision.lookbackDays) && fallbackDecision.lookbackDays > 0) {
          lookbackDays = Math.floor(fallbackDecision.lookbackDays);
        }
        if (!effectiveStartDate && fallbackDecision?.effectiveStartDate) {
          effectiveStartDate = fallbackDecision.effectiveStartDate;
        }
        if (!dataStartDate && fallbackDecision?.dataStartDate) {
          dataStartDate = fallbackDecision.dataStartDate;
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BacktestRunner] resolveLookbackDays 失敗', error);
        }
      }
    }
    if (!lookbackDays && shared && typeof shared.getMaxIndicatorPeriod === 'function' && typeof shared.estimateLookbackBars === 'function') {
      try {
        const maxPeriod = shared.getMaxIndicatorPeriod(params);
        const estimated = shared.estimateLookbackBars(maxPeriod, decisionOptions);
        if (Number.isFinite(estimated) && estimated > 0) {
          lookbackDays = Math.floor(estimated);
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BacktestRunner] 估算 lookback 失敗', error);
        }
      }
    }
    if (!effectiveStartDate) {
      effectiveStartDate = params.startDate;
    }
    if (!dataStartDate) {
      dataStartDate = effectiveStartDate || params.startDate;
    }
    return { lookbackDays, effectiveStartDate, dataStartDate };
  }

  function buildParams(options) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('BacktestRunner.run 需要傳入設定物件');
    }
    const registry = globalScope.StrategyPluginRegistry;
    const rawStockNo = options.stockNo || options.symbol || '2330';
    const stockNo = rawStockNo.toString().trim().toUpperCase();
    if (!stockNo) {
      throw new Error('BacktestRunner.run 需要提供 stockNo');
    }
    const startDate = options.startDate || options.beginDate || null;
    const endDate = options.endDate || options.finishDate || null;
    if (!startDate || !endDate) {
      throw new Error('BacktestRunner.run 需要提供 startDate 與 endDate');
    }
    const baseMarket = options.market || options.marketType || 'TWSE';
    const normalizedMarket = isIndexSymbol(stockNo) ? 'INDEX' : normalizeMarketValue(baseMarket);
    const initialCapitalRaw = toNumber(options.initialCapital);
    const initialCapital = Number.isFinite(initialCapitalRaw) && initialCapitalRaw > 0 ? initialCapitalRaw : 100000;
    const positionSizeRaw = toNumber(options.positionSize);
    const positionSize = Number.isFinite(positionSizeRaw) && positionSizeRaw > 0 && positionSizeRaw <= 100 ? positionSizeRaw : 100;
    const tradeTiming = options.tradeTiming === 'open' ? 'open' : 'close';
    const adjustedPrice = Boolean(options.adjustedPrice);
    const splitAdjustment = adjustedPrice && Boolean(options.splitAdjustment);
    const entryStrategy = options.entryStrategy || options.longEntryStrategy || null;
    const exitStrategy = options.exitStrategy || options.longExitStrategy || null;
    if (!entryStrategy || !exitStrategy) {
      throw new Error('BacktestRunner.run 需要 entryStrategy 與 exitStrategy');
    }
    const entryParams = buildStrategyParams(registry, entryStrategy, options.entryParams || options.longEntryParams);
    const exitParams = buildStrategyParams(registry, exitStrategy, options.exitParams || options.longExitParams);
    const enableShorting = Boolean(options.enableShorting || options.allowShortSelling);
    const shortEntryStrategy = enableShorting ? (options.shortEntryStrategy || null) : null;
    const shortExitStrategy = enableShorting ? (options.shortExitStrategy || null) : null;
    const shortEntryParams = enableShorting ? buildStrategyParams(registry, shortEntryStrategy, options.shortEntryParams) : {};
    const shortExitParams = enableShorting ? buildStrategyParams(registry, shortExitStrategy, options.shortExitParams) : {};
    const buyFeeRaw = toNumber(options.buyFee);
    const sellFeeRaw = toNumber(options.sellFee);
    const buyFee = Number.isFinite(buyFeeRaw) && buyFeeRaw >= 0 ? buyFeeRaw : 0;
    const sellFee = Number.isFinite(sellFeeRaw) && sellFeeRaw >= 0 ? sellFeeRaw : 0;
    const positionBasis = options.positionBasis === 'portfolio' ? 'portfolio' : 'initialCapital';
    const stopLossRaw = toNumber(options.stopLoss);
    const stopLoss = Number.isFinite(stopLossRaw) && stopLossRaw >= 0 && stopLossRaw <= 100 ? stopLossRaw : 0;
    const takeProfitRaw = toNumber(options.takeProfit);
    const takeProfit = Number.isFinite(takeProfitRaw) && takeProfitRaw >= 0 ? takeProfitRaw : 0;
    const entryStages = sanitizeStagePercentages(options.entryStages, [positionSize]);
    const exitStages = sanitizeStagePercentages(options.exitStages, [100]);
    const entryStagingMode = options.entryStagingMode === 'ratio' ? 'ratio' : 'signal_repeat';
    const exitStagingMode = options.exitStagingMode === 'ratio' ? 'ratio' : 'signal_repeat';
    const entryStrategyDsl = options.entryStrategyDsl || null;
    const exitStrategyDsl = options.exitStrategyDsl || null;
    const shortEntryStrategyDsl = enableShorting ? options.shortEntryStrategyDsl || null : null;
    const shortExitStrategyDsl = enableShorting ? options.shortExitStrategyDsl || null : null;

    return {
      stockNo,
      startDate,
      endDate,
      initialCapital,
      positionSize,
      tradeTiming,
      adjustedPrice,
      splitAdjustment,
      entryStrategy,
      exitStrategy,
      entryParams,
      exitParams,
      entryStages,
      entryStagingMode,
      exitStages,
      exitStagingMode,
      enableShorting,
      shortEntryStrategy,
      shortExitStrategy,
      shortEntryParams,
      shortExitParams,
      entryStrategyDsl,
      exitStrategyDsl,
      shortEntryStrategyDsl,
      shortExitStrategyDsl,
      buyFee,
      sellFee,
      positionBasis,
      stopLoss,
      takeProfit,
      market: normalizedMarket,
      marketType: normalizedMarket,
      priceMode: adjustedPrice ? 'adjusted' : 'raw',
    };
  }

  function runBacktest(options) {
    const params = buildParams(options || {});
    const lookbackDecision = computeLookbackDecision(params, options || {});
    if (lookbackDecision.lookbackDays && lookbackDecision.lookbackDays > 0) {
      params.lookbackDays = lookbackDecision.lookbackDays;
    }
    params.effectiveStartDate = lookbackDecision.effectiveStartDate;
    params.dataStartDate = lookbackDecision.dataStartDate;
    const workerMessage = {
      type: 'runBacktest',
      params,
      useCachedData: false,
      dataStartDate: lookbackDecision.dataStartDate,
      effectiveStartDate: lookbackDecision.effectiveStartDate,
      lookbackDays: lookbackDecision.lookbackDays,
    };
    const workerPath = resolveWorkerUrl();
    if (typeof Worker !== 'function') {
      throw new Error('當前環境不支援 Web Worker，無法執行回測');
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const worker = new Worker(workerPath);
      const cleanup = () => {
        try {
          worker.terminate();
        } catch (error) {
          // ignore terminate errors
        }
      };
      worker.onmessage = (event) => {
        const payload = event && event.data ? event.data : {};
        if (payload.type === 'progress') {
          if (typeof options?.onProgress === 'function') {
            try {
              options.onProgress(payload);
            } catch (callbackError) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[BacktestRunner] onProgress callback 失敗', callbackError);
              }
            }
          }
          return;
        }
        if (payload.type === 'result') {
          if (!settled) {
            settled = true;
            cleanup();
            resolve({
              data: payload.data,
              stockName: payload.stockName,
              dataSource: payload.dataSource,
              raw: payload,
            });
          }
          return;
        }
        if (payload.type === 'error' || payload.type === 'marketError' || payload.type === 'suggestionError') {
          if (!settled) {
            settled = true;
            cleanup();
            const message = payload?.data?.message || payload?.message || '回測過程發生錯誤';
            reject(new Error(message));
          }
        }
      };
      worker.onerror = (event) => {
        if (!settled) {
          settled = true;
          cleanup();
          const message = event && event.message ? event.message : 'Worker 執行失敗';
          reject(new Error(message));
        }
      };
      try {
        worker.postMessage(workerMessage);
      } catch (postError) {
        if (!settled) {
          settled = true;
          cleanup();
          reject(postError);
        }
      }
    });
  }

  const runner = Object.freeze({
    run: runBacktest,
    __version__: RUNNER_VERSION,
  });

  Object.defineProperty(globalScope, 'BacktestRunner', {
    value: runner,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof window !== 'undefined' ? window : this);
