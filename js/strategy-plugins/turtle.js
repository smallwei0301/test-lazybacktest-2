// Patch Tag: LB-PLUGIN-EXTENDED-20250715A
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

  function computeRollingExtrema(series, index, period, mode) {
    if (!Array.isArray(series) || period <= 0 || index < period) {
      return null;
    }
    let extremum = mode === 'min' ? Infinity : -Infinity;
    for (let i = index - period; i < index; i += 1) {
      const value = toFinite(series[i]);
      if (!Number.isFinite(value)) {
        return null;
      }
      extremum = mode === 'min' ? Math.min(extremum, value) : Math.max(extremum, value);
    }
    return extremum;
  }

  function getMeta(config) {
    if (typeof registry.getStrategyMetaById === 'function') {
      const existing = registry.getStrategyMetaById(config.id);
      if (existing) {
        return existing;
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

  function registerTurtlePlugin(config) {
    const meta = getMeta(config);
    const schema = meta.paramsSchema;
    const defaultPeriod = schema.properties[config.periodKey].default;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      if (context?.role !== config.role) {
        throw new Error(`[${config.id}] 不支援的角色: ${context?.role}`);
      }
      const idx = Number(context?.index) || 0;
      const periodValue = Number.isFinite(Number(params?.[config.periodKey]))
        ? Math.max(1, Number(params[config.periodKey]))
        : defaultPeriod;
      const closes = Array.isArray(context?.series?.close) ? context.series.close : [];
      const highs = Array.isArray(context?.series?.high) ? context.series.high : [];
      const lows = Array.isArray(context?.series?.low) ? context.series.low : [];

      const prevClose = idx > 0 ? toFinite(closes[idx - 1]) : null;
      const currentClose = toFinite(closes[idx]);
      const nextClose = idx + 1 < closes.length ? toFinite(closes[idx + 1]) : null;
      const reference = config.extremaSource({ highs, lows, index: idx, period: periodValue });

      let triggered = false;
      if (reference !== null && currentClose !== null && prevClose !== null) {
        triggered = config.comparator({ currentClose, reference });
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base[config.resultField] = triggered;
      if (triggered) {
        base.meta = {
          indicatorValues: {
            收盤價: [prevClose, currentClose, nextClose],
            [config.referenceLabel(periodValue)]: [null, reference, null],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  registerTurtlePlugin({
    id: 'turtle_breakout',
    label: '海龜突破 (僅進場)',
    role: 'longEntry',
    periodKey: 'breakoutPeriod',
    defaultPeriod: 20,
    extremaSource: ({ highs, index, period }) => computeRollingExtrema(highs, index, period, 'max'),
    comparator: ({ currentClose, reference }) => currentClose > reference,
    resultField: 'enter',
    referenceLabel: (period) => `${period}日高`,
  });

  registerTurtlePlugin({
    id: 'turtle_stop_loss',
    label: '海龜停損 (N日低)',
    role: 'longExit',
    periodKey: 'stopLossPeriod',
    defaultPeriod: 10,
    extremaSource: ({ lows, index, period }) => computeRollingExtrema(lows, index, period, 'min'),
    comparator: ({ currentClose, reference }) => currentClose < reference,
    resultField: 'exit',
    referenceLabel: (period) => `${period}日低`,
  });

  registerTurtlePlugin({
    id: 'short_turtle_stop_loss',
    label: '海龜N日低 (做空)',
    role: 'shortEntry',
    periodKey: 'stopLossPeriod',
    defaultPeriod: 10,
    extremaSource: ({ lows, index, period }) => computeRollingExtrema(lows, index, period, 'min'),
    comparator: ({ currentClose, reference }) => currentClose < reference,
    resultField: 'short',
    referenceLabel: (period) => `${period}日低`,
  });

  registerTurtlePlugin({
    id: 'cover_turtle_breakout',
    label: '海龜N日高 (回補)',
    role: 'shortExit',
    periodKey: 'breakoutPeriod',
    defaultPeriod: 20,
    extremaSource: ({ highs, index, period }) => computeRollingExtrema(highs, index, period, 'max'),
    comparator: ({ currentClose, reference }) => currentClose > reference,
    resultField: 'cover',
    referenceLabel: (period) => `${period}日高`,
  });
})(typeof self !== 'undefined' ? self : this);
