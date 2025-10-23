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
          period: { type: 'integer', minimum: 1, maximum: 365, default: config.defaultPeriod },
          threshold: { type: 'number', minimum: -100, maximum: 0, default: config.defaultThreshold },
        },
        additionalProperties: true,
      },
    };
  }

  function registerWilliamsPlugin(config) {
    const meta = getMeta(config);
    const schema = meta?.paramsSchema;
    const defaultThreshold = schema?.properties?.threshold?.default ?? config.defaultThreshold;

    const plugin = createLegacyStrategyPlugin(
      meta,
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const series = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.indicatorKey)
          : undefined;
        if (!Array.isArray(series)) {
          return { enter: false, exit: false, short: false, cover: false, meta: {} };
        }

        const current = toFinite(series[idx]);
        const prev = idx > 0 ? toFinite(series[idx - 1]) : null;
        const next = idx + 1 < series.length ? toFinite(series[idx + 1]) : null;

        const thresholdRaw = Number(params?.threshold);
        const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : defaultThreshold;

        let triggered = false;
        if (current !== null && prev !== null) {
          triggered = config.comparator({ current, prev, threshold });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              '%R': [prev, current, next],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerWilliamsPlugin({
    id: 'williams_oversold',
    label: '威廉指標超賣',
    indicatorKey: 'williamsEntry',
    signalField: 'enter',
    defaultThreshold: -80,
    defaultPeriod: 14,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });

  registerWilliamsPlugin({
    id: 'williams_overbought',
    label: '威廉指標超買',
    indicatorKey: 'williamsExit',
    signalField: 'exit',
    defaultThreshold: -20,
    defaultPeriod: 14,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerWilliamsPlugin({
    id: 'short_williams_overbought',
    label: '威廉指標超買 (做空)',
    indicatorKey: 'williamsShortEntry',
    signalField: 'short',
    defaultThreshold: -20,
    defaultPeriod: 14,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerWilliamsPlugin({
    id: 'cover_williams_oversold',
    label: '威廉指標超賣 (回補)',
    indicatorKey: 'williamsCover',
    signalField: 'cover',
    defaultThreshold: -80,
    defaultPeriod: 14,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });
})(typeof self !== 'undefined' ? self : this);
