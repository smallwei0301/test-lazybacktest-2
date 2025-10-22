// Patch Tag: LB-PLUGIN-ATOMS-20250721C
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (!registry || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function sliceWindow(series, endIndex, period) {
    if (!Array.isArray(series) || period <= 0 || endIndex < period) {
      return [];
    }
    const start = endIndex - period;
    return series.slice(start, endIndex).map(toFinite).filter((value) => value !== null);
  }

  function resolveBaseMeta(config) {
    if (typeof registry.getStrategyMetaById === 'function') {
      const meta = registry.getStrategyMetaById(config.id);
      if (meta) {
        return meta;
      }
    }
    return {
      id: config.id,
      label: config.label,
      paramsSchema: {
        type: 'object',
        properties: {
          [config.periodKey]: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: config.defaultPeriod,
          },
        },
        additionalProperties: true,
      },
    };
  }

  function registerPriceAction(config) {
    const meta = resolveBaseMeta(config);
    const periodProperty = config.periodKey;
    const defaultPeriod = config.defaultPeriod;
    const plugin = createLegacyStrategyPlugin(
      meta,
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const closeSeries = Array.isArray(context?.series?.close)
          ? context.series.close
          : [];
        const refSeries = Array.isArray(context?.series?.[config.referenceKey])
          ? context.series[config.referenceKey]
          : [];
        const rawPeriod = Number(params?.[periodProperty]);
        const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? Math.floor(rawPeriod) : defaultPeriod;
        const closePrev = idx > 0 ? toFinite(closeSeries[idx - 1]) : null;
        const closeNow = toFinite(closeSeries[idx]);
        const closeNext = idx + 1 < closeSeries.length ? toFinite(closeSeries[idx + 1]) : null;
        const windowValues = sliceWindow(refSeries, idx, period);

        let threshold = null;
        if (windowValues.length > 0) {
          threshold = config.extremum === 'max'
            ? Math.max(...windowValues)
            : Math.min(...windowValues);
        }

        let triggered = false;
        if (closeNow !== null && threshold !== null) {
          triggered = config.comparator({ closeNow, closePrev, threshold });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              收盤價: [closePrev, closeNow, closeNext],
              [config.thresholdLabel]: [null, threshold, null],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerPriceAction({
    id: 'price_breakout',
    label: '價格突破前高 (多頭進場)',
    periodKey: 'period',
    defaultPeriod: 20,
    referenceKey: 'high',
    extremum: 'max',
    thresholdLabel: '前高',
    signalField: 'enter',
    comparator: ({ closeNow, threshold }) => closeNow > threshold,
  });

  registerPriceAction({
    id: 'price_breakdown',
    label: '價格跌破前低 (多頭出場)',
    periodKey: 'period',
    defaultPeriod: 20,
    referenceKey: 'low',
    extremum: 'min',
    thresholdLabel: '前低',
    signalField: 'exit',
    comparator: ({ closeNow, threshold }) => closeNow < threshold,
  });

  registerPriceAction({
    id: 'short_price_breakdown',
    label: '價格跌破前低 (做空進場)',
    periodKey: 'period',
    defaultPeriod: 20,
    referenceKey: 'low',
    extremum: 'min',
    thresholdLabel: '前低',
    signalField: 'short',
    comparator: ({ closeNow, threshold }) => closeNow < threshold,
  });

  registerPriceAction({
    id: 'cover_price_breakout',
    label: '價格突破前高 (空單回補)',
    periodKey: 'period',
    defaultPeriod: 20,
    referenceKey: 'high',
    extremum: 'max',
    thresholdLabel: '前高',
    signalField: 'cover',
    comparator: ({ closeNow, threshold }) => closeNow > threshold,
  });
})(typeof self !== 'undefined' ? self : this);
