// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    return;
  }

  const { ensureRuleResult } = contract;

  function getIndicatorSeries(context, key) {
    if (!context?.helpers || typeof context.helpers.getIndicator !== 'function') {
      return [];
    }
    const series = context.helpers.getIndicator(key);
    return Array.isArray(series) ? series : [];
  }

  function readNumeric(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) {
      return null;
    }
    const value = series[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function createThresholdPlugin(definition) {
    const { id, label, indicatorKey, defaultThreshold, resultKey, direction, paramsSchema, valueLabel } = definition;
    return {
      meta: {
        id,
        label,
        paramsSchema,
      },
      run(context, params) {
        const role = context?.role;
        if (role !== definition.role) {
          return ensureRuleResult({}, { pluginId: id, role, index: context?.index });
        }
        const index = context?.index ?? -1;
        if (!Number.isInteger(index) || index <= 0) {
          return ensureRuleResult({}, { pluginId: id, role, index });
        }
        const series = getIndicatorSeries(context, indicatorKey);
        const prev = readNumeric(series, index - 1);
        const curr = readNumeric(series, index);
        const next = readNumeric(series, index + 1);
        const thresholdRaw = Number(params?.threshold);
        const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : defaultThreshold;

        let triggered = false;
        if (prev !== null && curr !== null) {
          if (direction === 'crossAbove') {
            triggered = curr > threshold && prev <= threshold;
          } else {
            triggered = curr < threshold && prev >= threshold;
          }
        }

        const meta = triggered
          ? {
              indicatorValues: {
                [valueLabel]: [prev, curr, next],
              },
            }
          : {};

        return ensureRuleResult(
          {
            [resultKey]: triggered,
            meta,
          },
          { pluginId: id, role, index },
        );
      },
    };
  }

  function buildSchema(thresholdDefault) {
    return {
      type: 'object',
      properties: {
        period: { type: 'number', minimum: 2, maximum: 200, default: 14 },
        threshold: { type: 'number', minimum: 0, maximum: 100, default: thresholdDefault },
      },
      required: ['period', 'threshold'],
      additionalProperties: false,
    };
  }

  const plugins = [
    createThresholdPlugin({
      id: 'rsi_oversold',
      label: 'RSI 低檔翻揚',
      role: 'longEntry',
      indicatorKey: 'rsiEntry',
      defaultThreshold: 30,
      resultKey: 'enter',
      direction: 'crossAbove',
      paramsSchema: buildSchema(30),
      valueLabel: 'RSI',
    }),
    createThresholdPlugin({
      id: 'rsi_overbought',
      label: 'RSI 高檔反轉',
      role: 'longExit',
      indicatorKey: 'rsiExit',
      defaultThreshold: 70,
      resultKey: 'exit',
      direction: 'crossBelow',
      paramsSchema: buildSchema(70),
      valueLabel: 'RSI',
    }),
    createThresholdPlugin({
      id: 'short_rsi_overbought',
      label: 'RSI 高檔反轉做空',
      role: 'shortEntry',
      indicatorKey: 'rsiShortEntry',
      defaultThreshold: 70,
      resultKey: 'short',
      direction: 'crossBelow',
      paramsSchema: buildSchema(70),
      valueLabel: 'RSI',
    }),
    createThresholdPlugin({
      id: 'cover_rsi_oversold',
      label: 'RSI 低檔翻揚回補',
      role: 'shortExit',
      indicatorKey: 'rsiCover',
      defaultThreshold: 30,
      resultKey: 'cover',
      direction: 'crossAbove',
      paramsSchema: buildSchema(30),
      valueLabel: 'RSI',
    }),
  ];

  plugins.forEach((plugin) => {
    registry.register(plugin);
  });
})(typeof self !== 'undefined' ? self : this);
