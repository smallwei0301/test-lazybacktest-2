// Patch Tag: LB-PLUGIN-ATOMS-20250721D
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

  function collectWindow(series, endIndex, period) {
    if (!Array.isArray(series) || period <= 0 || endIndex < period) {
      return [];
    }
    const start = endIndex - period;
    return series.slice(start, endIndex).map(toFinite).filter((value) => value !== null);
  }

  function buildMeta(config) {
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

  function registerTurtle(config) {
    const meta = buildMeta(config);
    const defaultPeriod = config.defaultPeriod;
    const periodKey = config.periodKey;
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
        const rawPeriod = Number(params?.[periodKey]);
        const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? Math.floor(rawPeriod) : defaultPeriod;
        const windowValues = collectWindow(refSeries, idx, period);

        let threshold = null;
        if (windowValues.length > 0) {
          threshold = config.mode === 'max'
            ? Math.max(...windowValues)
            : Math.min(...windowValues);
        }

        const closePrev = idx > 0 ? toFinite(closeSeries[idx - 1]) : null;
        const closeNow = toFinite(closeSeries[idx]);
        const closeNext = idx + 1 < closeSeries.length ? toFinite(closeSeries[idx + 1]) : null;

        let triggered = false;
        if (closeNow !== null && threshold !== null) {
          triggered = config.comparator({ closeNow, threshold });
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

  registerTurtle({
    id: 'turtle_breakout',
    label: '海龜突破 (多頭進場)',
    periodKey: 'breakoutPeriod',
    defaultPeriod: 20,
    referenceKey: 'high',
    mode: 'max',
    thresholdLabel: 'N日高',
    signalField: 'enter',
    comparator: ({ closeNow, threshold }) => closeNow > threshold,
  });

  registerTurtle({
    id: 'turtle_stop_loss',
    label: '海龜停損 (多頭出場)',
    periodKey: 'stopLossPeriod',
    defaultPeriod: 10,
    referenceKey: 'low',
    mode: 'min',
    thresholdLabel: 'N日低',
    signalField: 'exit',
    comparator: ({ closeNow, threshold }) => closeNow < threshold,
  });

  registerTurtle({
    id: 'short_turtle_stop_loss',
    label: '海龜N日低 (做空進場)',
    periodKey: 'stopLossPeriod',
    defaultPeriod: 10,
    referenceKey: 'low',
    mode: 'min',
    thresholdLabel: 'N日低',
    signalField: 'short',
    comparator: ({ closeNow, threshold }) => closeNow < threshold,
  });

  registerTurtle({
    id: 'cover_turtle_breakout',
    label: '海龜N日高 (空單回補)',
    periodKey: 'breakoutPeriod',
    defaultPeriod: 20,
    referenceKey: 'high',
    mode: 'max',
    thresholdLabel: 'N日高',
    signalField: 'cover',
    comparator: ({ closeNow, threshold }) => closeNow > threshold,
  });
})(typeof self !== 'undefined' ? self : this);
