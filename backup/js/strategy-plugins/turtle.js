// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
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

  function getMeta(config) {
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
          [config.periodParam]: {
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

  function getWindowExtrema(series, index, period, comparator) {
    if (!Array.isArray(series) || index < period) {
      return null;
    }
    const slice = series.slice(index - period, index).map(toFinite).filter((v) => v !== null);
    if (slice.length === 0) {
      return null;
    }
    return comparator(slice);
  }

  function registerTurtlePlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const closes = context?.series?.close;
        const highs = context?.series?.high;
        const lows = context?.series?.low;
        const rawPeriod = Number(params?.[config.periodParam]);
        const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? Math.floor(rawPeriod) : config.defaultPeriod;

        if (!Array.isArray(closes)) {
          return { enter: false, exit: false, short: false, cover: false, meta: {} };
        }

        const prevClose = idx > 0 ? toFinite(closes[idx - 1]) : null;
        const close = toFinite(closes[idx]);
        const nextClose = idx + 1 < closes.length ? toFinite(closes[idx + 1]) : null;

        let reference = null;
        if (config.windowType === 'high') {
          reference = getWindowExtrema(highs, idx, period, (values) => Math.max(...values));
        } else if (config.windowType === 'low') {
          reference = getWindowExtrema(lows, idx, period, (values) => Math.min(...values));
        }

        let triggered = false;
        if (reference !== null && close !== null) {
          triggered = config.comparator({ close, reference });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              收盤價: [prevClose, close, nextClose],
              [config.referenceLabel]: [null, reference, null],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerTurtlePlugin({
    id: 'turtle_breakout',
    label: '海龜突破 (僅進場)',
    signalField: 'enter',
    windowType: 'high',
    referenceLabel: 'N日高',
    periodParam: 'breakoutPeriod',
    defaultPeriod: 20,
    comparator: ({ close, reference }) => close > reference,
  });

  registerTurtlePlugin({
    id: 'turtle_stop_loss',
    label: '海龜停損 (N日低)',
    signalField: 'exit',
    windowType: 'low',
    referenceLabel: 'N日低',
    periodParam: 'stopLossPeriod',
    defaultPeriod: 10,
    comparator: ({ close, reference }) => close < reference,
  });

  registerTurtlePlugin({
    id: 'short_turtle_stop_loss',
    label: '海龜N日低 (做空)',
    signalField: 'short',
    windowType: 'low',
    referenceLabel: 'N日低',
    periodParam: 'stopLossPeriod',
    defaultPeriod: 10,
    comparator: ({ close, reference }) => close < reference,
  });

  registerTurtlePlugin({
    id: 'cover_turtle_breakout',
    label: '海龜N日高 (回補)',
    signalField: 'cover',
    windowType: 'high',
    referenceLabel: 'N日高',
    periodParam: 'breakoutPeriod',
    defaultPeriod: 20,
    comparator: ({ close, reference }) => close > reference,
  });
})(typeof self !== 'undefined' ? self : this);
