// Patch Tag: LB-PLUGIN-ATOMS-20250721F
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
    if (!Array.isArray(series)) {
      return { prev: null, current: null, next: null };
    }
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return { prev, current, next };
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
          period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
          threshold: { type: 'number', minimum: -100, maximum: 0, default: config.defaultThreshold },
        },
        additionalProperties: true,
      },
    };
  }

  function registerWilliams(config) {
    const meta = getMeta(config);
    const defaultThreshold = meta?.paramsSchema?.properties?.threshold?.default ?? config.defaultThreshold;
    const plugin = createLegacyStrategyPlugin(
      meta,
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const series = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.indicatorKey)
          : undefined;
        const triplet = makeTriplet(series, idx);
        const rawThreshold = Number(params?.threshold);
        const threshold = Number.isFinite(rawThreshold) ? rawThreshold : defaultThreshold;

        let triggered = false;
        if (triplet.current !== null && triplet.prev !== null) {
          triggered = config.comparator({ current: triplet.current, prev: triplet.prev, threshold });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              '%R': [triplet.prev, triplet.current, triplet.next],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerWilliams({
    id: 'williams_oversold',
    label: '威廉指標超賣 (多頭進場)',
    indicatorKey: 'williamsEntry',
    signalField: 'enter',
    defaultThreshold: -80,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });

  registerWilliams({
    id: 'williams_overbought',
    label: '威廉指標超買 (多頭出場)',
    indicatorKey: 'williamsExit',
    signalField: 'exit',
    defaultThreshold: -20,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerWilliams({
    id: 'short_williams_overbought',
    label: '威廉指標超買 (做空進場)',
    indicatorKey: 'williamsShortEntry',
    signalField: 'short',
    defaultThreshold: -20,
    comparator: ({ current, prev, threshold }) => current < threshold && prev >= threshold,
  });

  registerWilliams({
    id: 'cover_williams_oversold',
    label: '威廉指標超賣 (空單回補)',
    indicatorKey: 'williamsCover',
    signalField: 'cover',
    defaultThreshold: -80,
    comparator: ({ current, prev, threshold }) => current > threshold && prev <= threshold,
  });
})(typeof self !== 'undefined' ? self : this);
