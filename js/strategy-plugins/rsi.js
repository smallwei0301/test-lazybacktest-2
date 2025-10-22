// Patch Tag: LB-PLUGIN-ATOMS-20250709A
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

  function makeTriplet(series, index) {
    if (!Array.isArray(series)) return [null, null, null];
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return [prev, current, next];
  }

  function registerRsiPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      {
        id: config.id,
        label: config.label,
        paramsSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              default: 14,
            },
            threshold: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: config.defaultThreshold,
            },
          },
          additionalProperties: true,
        },
      },
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const indicator = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.indicatorKey)
          : undefined;
        const [prev, current, next] = makeTriplet(indicator, idx);
        const rawThreshold = Number(params?.threshold);
        const threshold = Number.isFinite(rawThreshold)
          ? Math.min(Math.max(rawThreshold, 0), 100)
          : config.defaultThreshold;

        let triggered = false;
        if (current !== null && prev !== null) {
          triggered = config.comparator({ current, prev, threshold });
        }

        const baseResult = { enter: false, exit: false, short: false, cover: false, meta: {} };
        baseResult[config.signalField] = triggered;
        if (triggered) {
          baseResult.meta = {
            indicatorValues: {
              RSI: [prev, current, next],
            },
          };
        }
        return baseResult;
      },
    );
    registry.register(plugin);
  }

  registerRsiPlugin({
    id: 'rsi_oversold',
    label: 'RSI 超賣 (多頭進場)',
    indicatorKey: 'rsiEntry',
    signalField: 'enter',
    defaultThreshold: 30,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });

  registerRsiPlugin({
    id: 'rsi_overbought',
    label: 'RSI 超買 (多頭出場)',
    indicatorKey: 'rsiExit',
    signalField: 'exit',
    defaultThreshold: 70,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerRsiPlugin({
    id: 'short_rsi_overbought',
    label: 'RSI 超買 (做空進場)',
    indicatorKey: 'rsiShortEntry',
    signalField: 'short',
    defaultThreshold: 70,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerRsiPlugin({
    id: 'cover_rsi_oversold',
    label: 'RSI 超賣 (空單回補)',
    indicatorKey: 'rsiCover',
    signalField: 'cover',
    defaultThreshold: 30,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });
})(typeof self !== 'undefined' ? self : this);
