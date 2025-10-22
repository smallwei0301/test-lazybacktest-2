// Patch Tag: LB-PLUGIN-ATOMS-20250710A — ATR trailing stop plugin.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    console.warn('[ATRStopPlugin] 缺少 StrategyPluginContract 或 Registry，略過註冊。');
    return;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  function getSeriesValue(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) return null;
    const value = series[index];
    return isFiniteNumber(value) ? Number(value) : null;
  }

  const meta = {
    id: 'atr-stop-v1',
    label: 'ATR 移動停損',
    paramsSchema: {
      type: 'object',
      properties: {
        stopIndicatorKey: { type: 'string', description: 'ATR 停損線指標鍵值' },
        comparison: {
          type: 'string',
          enum: ['priceBelowStop', 'priceAboveStop'],
          default: 'priceBelowStop',
          description: '收盤價相對停損線的位置判斷',
        },
        atrIndicatorKey: { type: 'string', description: 'ATR 值指標鍵值' },
        atrPeriod: {
          type: 'integer',
          minimum: 1,
          maximum: 252,
          default: 14,
          description: 'ATR 計算天數 (1-252)',
        },
        atrMultiplier: {
          type: 'number',
          minimum: 0.1,
          maximum: 10,
          default: 3,
          description: 'ATR 倍數 (0.1-10)',
        },
      },
      required: ['stopIndicatorKey'],
      additionalProperties: true,
    },
  };

  const plugin = contract.createLegacyStrategyPlugin(meta, (context, params) => {
    const stopKey = typeof params?.stopIndicatorKey === 'string' ? params.stopIndicatorKey : '';
    const atrKey = typeof params?.atrIndicatorKey === 'string' ? params.atrIndicatorKey : null;
    const comparison =
      params?.comparison === 'priceAboveStop' ? 'priceAboveStop' : 'priceBelowStop';

    const stopSeries = context.helpers.getIndicator(stopKey) || [];
    const atrSeries = atrKey ? context.helpers.getIndicator(atrKey) || [] : null;
    const priceSeries = context.series?.close || [];
    const idx = context.index;

    const priceNow = getSeriesValue(priceSeries, idx);
    const pricePrev = getSeriesValue(priceSeries, idx - 1);
    const stopNow = getSeriesValue(stopSeries, idx);
    const stopPrev = getSeriesValue(stopSeries, idx - 1);
    const atrNow = atrSeries ? getSeriesValue(atrSeries, idx) : null;

    let crossed = false;
    if (comparison === 'priceBelowStop') {
      crossed =
        priceNow !== null &&
        pricePrev !== null &&
        stopNow !== null &&
        stopPrev !== null &&
        priceNow < stopNow &&
        pricePrev >= stopPrev;
    } else {
      crossed =
        priceNow !== null &&
        pricePrev !== null &&
        stopNow !== null &&
        stopPrev !== null &&
        priceNow > stopNow &&
        pricePrev <= stopPrev;
    }

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      meta: {
        stopIndicatorKey: stopKey,
        atrIndicatorKey: atrKey,
        comparison,
        priceNow,
        pricePrev,
        stopNow,
        stopPrev,
        atrNow,
      },
    };

    switch (context.role) {
      case 'longExit':
        base.exit = crossed;
        break;
      case 'shortExit':
        base.cover = crossed;
        break;
      default:
        break;
    }

    return base;
  });

  registry.register(plugin);

  const { registerAlias } = registry;

  registerAlias('atr_stop_loss', {
    pluginId: plugin.meta.id,
    roles: ['longExit'],
    mapParams(userParams) {
      return {
        stopIndicatorKey: 'atrStopLongExit',
        atrIndicatorKey: 'atrLongExit',
        comparison: 'priceBelowStop',
        atrPeriod: Number(userParams?.atrPeriod) || 14,
        atrMultiplier: Number(userParams?.atrMultiplier) || 3,
      };
    },
  });

  registerAlias('cover_atr_stop_loss', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams(userParams) {
      return {
        stopIndicatorKey: 'atrStopShortCover',
        atrIndicatorKey: 'atrShortCover',
        comparison: 'priceAboveStop',
        atrPeriod: Number(userParams?.atrPeriod) || 14,
        atrMultiplier: Number(userParams?.atrMultiplier) || 3,
      };
    },
  });
})(typeof self !== 'undefined' ? self : this);
