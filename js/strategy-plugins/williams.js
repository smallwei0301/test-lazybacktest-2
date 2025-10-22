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

  function getSeriesSnapshot(series, index) {
    const data = Array.isArray(series) ? series : [];
    const prev = index > 0 ? toFinite(data[index - 1]) : null;
    const current = toFinite(data[index]);
    const next = index + 1 < data.length ? toFinite(data[index + 1]) : null;
    return { prev, current, next };
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
          period: { type: 'integer', minimum: 1, maximum: 200, default: config.defaultPeriod },
          threshold: { type: 'number', minimum: -100, maximum: 0, default: config.defaultThreshold },
        },
        additionalProperties: true,
      },
    };
  }

  function registerWilliamsPlugin(config) {
    const meta = getMeta(config);
    const schema = meta.paramsSchema;
    const defaultPeriod = schema.properties.period.default;
    const defaultThreshold = schema.properties.threshold.default;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      const role = context?.role;
      if (role !== config.role) {
        throw new Error(`[${config.id}] 不支援的角色: ${role}`);
      }
      const idx = Number(context?.index) || 0;
      const indicatorSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(config.indicatorKey)
        : undefined;
      const snapshot = getSeriesSnapshot(indicatorSeries, idx);
      const threshold = Number.isFinite(Number(params?.threshold))
        ? Number(params.threshold)
        : defaultThreshold;
      const period = Number.isFinite(Number(params?.period)) ? Math.max(1, Number(params.period)) : defaultPeriod;

      let triggered = false;
      if (snapshot.current !== null && snapshot.prev !== null) {
        triggered = config.comparator({
          current: snapshot.current,
          previous: snapshot.prev,
          threshold,
        });
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base[config.resultField] = triggered;
      if (triggered) {
        base.meta = {
          indicatorValues: {
            [`%R(${period})`]: [snapshot.prev, snapshot.current, snapshot.next],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  registerWilliamsPlugin({
    id: 'williams_oversold',
    label: '威廉指標超賣',
    indicatorKey: 'williamsEntry',
    role: 'longEntry',
    defaultPeriod: 14,
    defaultThreshold: -80,
    resultField: 'enter',
    comparator: ({ current, previous, threshold }) => current > threshold && previous <= threshold,
  });

  registerWilliamsPlugin({
    id: 'williams_overbought',
    label: '威廉指標超買',
    indicatorKey: 'williamsExit',
    role: 'longExit',
    defaultPeriod: 14,
    defaultThreshold: -20,
    resultField: 'exit',
    comparator: ({ current, previous, threshold }) => current < threshold && previous >= threshold,
  });

  registerWilliamsPlugin({
    id: 'short_williams_overbought',
    label: '威廉指標超買 (做空)',
    indicatorKey: 'williamsShortEntry',
    role: 'shortEntry',
    defaultPeriod: 14,
    defaultThreshold: -20,
    resultField: 'short',
    comparator: ({ current, previous, threshold }) => current < threshold && previous >= threshold,
  });

  registerWilliamsPlugin({
    id: 'cover_williams_oversold',
    label: '威廉指標超賣 (回補)',
    indicatorKey: 'williamsCover',
    role: 'shortExit',
    defaultPeriod: 14,
    defaultThreshold: -80,
    resultField: 'cover',
    comparator: ({ current, previous, threshold }) => current > threshold && previous <= threshold,
  });
})(typeof self !== 'undefined' ? self : this);
