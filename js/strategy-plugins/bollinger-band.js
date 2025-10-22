// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    return;
  }

  const { ensureRuleResult } = contract;

  function getIndicator(context, key) {
    if (!context?.helpers || typeof context.helpers.getIndicator !== 'function') {
      return [];
    }
    const result = context.helpers.getIndicator(key);
    return Array.isArray(result) ? result : [];
  }

  function read(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) {
      return null;
    }
    const value = series[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function buildMeta(closePrev, closeNow, closeNext, bandLabel, bandPrev, bandNow, bandNext) {
    return {
      indicatorValues: {
        收盤價: [closePrev, closeNow, closeNext],
        [bandLabel]: [bandPrev, bandNow, bandNext],
      },
    };
  }

  function createBollingerPlugin(definition) {
    const { id, label, paramsSchema, resolver } = definition;
    return {
      meta: {
        id,
        label,
        paramsSchema,
      },
      run(context) {
        const role = context?.role || '';
        const config = resolver(role);
        if (!config) {
          return ensureRuleResult({}, { pluginId: id, role, index: context?.index });
        }
        const index = context?.index ?? -1;
        if (!Number.isInteger(index) || index <= 0) {
          return ensureRuleResult({}, { pluginId: id, role, index });
        }
        const closeSeries = Array.isArray(context?.series?.close) ? context.series.close : [];
        const bandSeries = getIndicator(context, config.bandKey);
        const closePrev = read(closeSeries, index - 1);
        const closeNow = read(closeSeries, index);
        const closeNext = read(closeSeries, index + 1);
        const bandPrev = read(bandSeries, index - 1);
        const bandNow = read(bandSeries, index);
        const bandNext = read(bandSeries, index + 1);

        let triggered = false;
        if (closePrev !== null && closeNow !== null && bandPrev !== null && bandNow !== null) {
          if (config.mode === 'crossAbove') {
            triggered = closeNow > bandNow && closePrev <= bandPrev;
          } else {
            triggered = closeNow < bandNow && closePrev >= bandPrev;
          }
        }

        const meta = triggered
          ? buildMeta(closePrev, closeNow, closeNext, config.bandLabel, bandPrev, bandNow, bandNext)
          : {};

        return ensureRuleResult(
          {
            [config.resultKey]: triggered,
            meta,
          },
          { pluginId: id, role, index },
        );
      },
    };
  }

  const baseSchema = {
    type: 'object',
    properties: {
      period: { type: 'number', minimum: 2, maximum: 200, default: 20 },
      deviations: { type: 'number', minimum: 0.5, maximum: 5, default: 2 },
    },
    required: ['period', 'deviations'],
    additionalProperties: false,
  };

  const plugins = [
    createBollingerPlugin({
      id: 'bollinger_breakout',
      label: '布林帶上軌突破',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'longEntry') {
          return {
            bandKey: 'bollingerUpperEntry',
            bandLabel: '上軌',
            mode: 'crossAbove',
            resultKey: 'enter',
          };
        }
        return null;
      },
    }),
    createBollingerPlugin({
      id: 'bollinger_reversal',
      label: '布林帶中軌跌破',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'longExit') {
          return {
            bandKey: 'bollingerMiddleExit',
            bandLabel: '中軌',
            mode: 'crossBelow',
            resultKey: 'exit',
          };
        }
        return null;
      },
    }),
    createBollingerPlugin({
      id: 'short_bollinger_reversal',
      label: '布林帶中軌跌破做空',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'shortEntry') {
          return {
            bandKey: 'bollingerMiddleShortEntry',
            bandLabel: '中軌',
            mode: 'crossBelow',
            resultKey: 'short',
          };
        }
        return null;
      },
    }),
    createBollingerPlugin({
      id: 'cover_bollinger_breakout',
      label: '布林帶上軌突破回補',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'shortExit') {
          return {
            bandKey: 'bollingerUpperCover',
            bandLabel: '上軌',
            mode: 'crossAbove',
            resultKey: 'cover',
          };
        }
        return null;
      },
    }),
  ];

  plugins.forEach((plugin) => registry.register(plugin));
})(typeof self !== 'undefined' ? self : this);
