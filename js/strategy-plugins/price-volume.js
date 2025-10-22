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

  function getSeriesValue(series, index) {
    const data = Array.isArray(series) ? series : [];
    return toFinite(data[index]);
  }

  function sliceExtrema(series, index, period, mode) {
    if (!Array.isArray(series) || period <= 0 || index < period) {
      return null;
    }
    let extrema = mode === 'min' ? Infinity : -Infinity;
    let hasValue = false;
    for (let i = index - period; i < index; i += 1) {
      const value = toFinite(series[i]);
      if (!Number.isFinite(value)) {
        return null;
      }
      hasValue = true;
      if (mode === 'min') {
        extrema = Math.min(extrema, value);
      } else {
        extrema = Math.max(extrema, value);
      }
    }
    return hasValue ? extrema : null;
  }

  function registerVolumeSpikePlugin() {
    const meta = getVolumeMeta();
    const schema = meta.paramsSchema;
    const defaultPeriod = schema.properties.period.default;
    const defaultMultiplier = schema.properties.multiplier.default;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      if (context?.role !== 'longEntry') {
        throw new Error('[volume_spike] 不支援的角色');
      }
      const idx = Number(context?.index) || 0;
      const period = Number.isFinite(Number(params?.period)) ? Math.max(1, Number(params.period)) : defaultPeriod;
      const multiplier = Number.isFinite(Number(params?.multiplier))
        ? Math.max(0, Number(params.multiplier))
        : defaultMultiplier;

      const avgSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator('volumeAvgEntry')
        : undefined;
      const avgSnapshot = Array.isArray(avgSeries) ? toFinite(avgSeries[idx]) : null;
      const volumeSnapshot = getSeriesValue(context?.series?.volume, idx);
      const prevVolume = idx > 0 ? getSeriesValue(context?.series?.volume, idx - 1) : null;
      const nextVolume = idx + 1 < (context?.series?.volume?.length || 0)
        ? getSeriesValue(context.series.volume, idx + 1)
        : null;
      const prevAvg = idx > 0 && Array.isArray(avgSeries) ? toFinite(avgSeries[idx - 1]) : null;
      const nextAvg = Array.isArray(avgSeries) && idx + 1 < avgSeries.length ? toFinite(avgSeries[idx + 1]) : null;

      let triggered = false;
      if (Number.isFinite(avgSnapshot) && Number.isFinite(volumeSnapshot)) {
        triggered = volumeSnapshot > avgSnapshot * multiplier;
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base.enter = triggered;
      if (triggered) {
        base.meta = {
          indicatorValues: {
            成交量: [prevVolume, volumeSnapshot, nextVolume],
            [`均量(${period})`]: [prevAvg, avgSnapshot, nextAvg],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  function getVolumeMeta() {
    if (typeof registry.getStrategyMetaById === 'function') {
      const existing = registry.getStrategyMetaById('volume_spike');
      if (existing) {
        return existing;
      }
    }
    return {
      id: 'volume_spike',
      label: '成交量暴增',
      paramsSchema: {
        type: 'object',
        properties: {
          period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
          multiplier: { type: 'number', minimum: 0, maximum: 20, default: 2 },
        },
        additionalProperties: true,
      },
    };
  }

  function registerPricePlugin(config) {
    const meta = (function resolveMeta() {
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
    })();

    const schema = meta.paramsSchema;
    const defaultPeriod = schema.properties[config.periodKey].default;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      const idx = Number(context?.index) || 0;
      if (context?.role !== config.role) {
        throw new Error(`[${config.id}] 不支援的角色: ${context?.role}`);
      }
      const series = context?.series;
      const closes = Array.isArray(series?.close) ? series.close : [];
      const highs = Array.isArray(series?.high) ? series.high : [];
      const lows = Array.isArray(series?.low) ? series.low : [];
      const prevClose = idx > 0 ? toFinite(closes[idx - 1]) : null;
      const currentClose = toFinite(closes[idx]);
      const nextClose = idx + 1 < closes.length ? toFinite(closes[idx + 1]) : null;
      const period = Number.isFinite(Number(params?.[config.periodKey]))
        ? Math.max(1, Number(params[config.periodKey]))
        : defaultPeriod;

      const reference = config.extremaSource({ highs, lows, index: idx, period });
      let triggered = false;
      if (reference !== null && currentClose !== null && prevClose !== null) {
        triggered = config.comparator({ currentClose, previousClose: prevClose, reference });
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base[config.resultField] = triggered;
      if (triggered) {
        base.meta = {
          indicatorValues: {
            收盤價: [prevClose, currentClose, nextClose],
            [config.referenceLabel(period)]: [null, reference, null],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  registerVolumeSpikePlugin();

  registerPricePlugin({
    id: 'price_breakout',
    label: '價格突破前高',
    role: 'longEntry',
    defaultPeriod: 20,
    periodKey: 'period',
    extremaSource: ({ highs, index, period }) => sliceExtrema(highs, index, period, 'max'),
    comparator: ({ currentClose, previousClose, reference }) => currentClose > reference,
    resultField: 'enter',
    referenceLabel: (period) => `${period}日高`,
  });

  registerPricePlugin({
    id: 'price_breakdown',
    label: '價格跌破前低',
    role: 'longExit',
    defaultPeriod: 20,
    periodKey: 'period',
    extremaSource: ({ lows, index, period }) => sliceExtrema(lows, index, period, 'min'),
    comparator: ({ currentClose, reference }) => currentClose < reference,
    resultField: 'exit',
    referenceLabel: (period) => `${period}日低`,
  });

  registerPricePlugin({
    id: 'short_price_breakdown',
    label: '價格跌破前低 (做空)',
    role: 'shortEntry',
    defaultPeriod: 20,
    periodKey: 'period',
    extremaSource: ({ lows, index, period }) => sliceExtrema(lows, index, period, 'min'),
    comparator: ({ currentClose, reference }) => currentClose < reference,
    resultField: 'short',
    referenceLabel: (period) => `${period}日低`,
  });

  registerPricePlugin({
    id: 'cover_price_breakout',
    label: '價格突破前高 (回補)',
    role: 'shortExit',
    defaultPeriod: 20,
    periodKey: 'period',
    extremaSource: ({ highs, index, period }) => sliceExtrema(highs, index, period, 'max'),
    comparator: ({ currentClose, reference }) => currentClose > reference,
    resultField: 'cover',
    referenceLabel: (period) => `${period}日高`,
  });
})(typeof self !== 'undefined' ? self : this);
