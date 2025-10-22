// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    return;
  }

  const { ensureRuleResult } = contract;

  function read(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) {
      return null;
    }
    const value = series[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function sanitizePercent(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return fallback;
    }
    return num;
  }

  function createTrailingPlugin(definition) {
    const { id, label, paramsSchema, resolver } = definition;
    return {
      meta: {
        id,
        label,
        paramsSchema,
      },
      run(context, params) {
        const role = context?.role || '';
        const config = resolver(role);
        if (!config) {
          return ensureRuleResult({}, { pluginId: id, role, index: context?.index });
        }
        const index = context?.index ?? -1;
        if (!Number.isInteger(index) || index < 0) {
          return ensureRuleResult({}, { pluginId: id, role, index });
        }
        const highs = Array.isArray(context?.series?.high) ? context.series.high : [];
        const lows = Array.isArray(context?.series?.low) ? context.series.low : [];
        const closes = Array.isArray(context?.series?.close) ? context.series.close : [];
        const seriesHigh = config.type === 'long' ? highs : lows;
        const closeNow = read(closes, index);
        const closePrev = read(closes, index - 1);
        const closeNext = read(closes, index + 1);
        const priceNow = read(seriesHigh, index);
        const runtimePosition = context?.runtime?.position || {};
        const stateInfo = config.type === 'long' ? runtimePosition.long : runtimePosition.short;
        const previousExtreme = Number(stateInfo?.[config.extremeKey]);
        const entryPrice = Number(stateInfo?.entryPrice);
        const percent = sanitizePercent(params?.percentage, config.defaultPercent);

        let nextExtreme = Number.isFinite(previousExtreme) ? previousExtreme : null;
        if (Number.isFinite(priceNow)) {
          if (config.type === 'long') {
            nextExtreme = Number.isFinite(nextExtreme)
              ? Math.max(nextExtreme, priceNow)
              : priceNow;
          } else {
            nextExtreme = Number.isFinite(nextExtreme)
              ? Math.min(nextExtreme, priceNow)
              : priceNow;
          }
        }

        let triggerPrice = null;
        if (Number.isFinite(nextExtreme) && Number.isFinite(percent) && percent > 0 && Number.isFinite(entryPrice) && entryPrice > 0) {
          if (config.type === 'long') {
            triggerPrice = nextExtreme * (1 - percent / 100);
          } else {
            triggerPrice = nextExtreme * (1 + percent / 100);
          }
        }

        let triggered = false;
        if (Number.isFinite(closeNow) && Number.isFinite(triggerPrice)) {
          if (config.type === 'long') {
            triggered = closeNow < triggerPrice;
          } else {
            triggered = closeNow > triggerPrice;
          }
        }

        const meta = triggered
          ? {
              indicatorValues: {
                收盤價: [closePrev, closeNow, closeNext],
                觸發價: [null, Number.isFinite(triggerPrice) ? Number(triggerPrice.toFixed(2)) : null, null],
              },
            }
          : {};

        meta[config.nextKey] = nextExtreme;
        if (Number.isFinite(triggerPrice)) {
          meta.triggerPrice = triggerPrice;
        }

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
      percentage: { type: 'number', minimum: 0.1, maximum: 50, default: 5 },
    },
    required: ['percentage'],
    additionalProperties: false,
  };

  const plugins = [
    createTrailingPlugin({
      id: 'trailing_stop',
      label: '移動停損',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'longExit') {
          return {
            type: 'long',
            extremeKey: 'currentPeakPrice',
            nextKey: 'nextPeak',
            resultKey: 'exit',
            defaultPercent: 5,
          };
        }
        return null;
      },
    }),
    createTrailingPlugin({
      id: 'cover_trailing_stop',
      label: '移動停損回補',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'shortExit') {
          return {
            type: 'short',
            extremeKey: 'currentTroughPrice',
            nextKey: 'nextTrough',
            resultKey: 'cover',
            defaultPercent: 5,
          };
        }
        return null;
      },
    }),
  ];

  plugins.forEach((plugin) => registry.register(plugin));
})(typeof self !== 'undefined' ? self : this);
