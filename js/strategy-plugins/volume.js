// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
// Patch Tag: LB-VOLUME-SPIKE-FLOW-20260730A
// Patch Tag: LB-VOLUME-EXIT-20240829A
// Patch Tag: LB-VOLUME-MODULAR-20240909A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (!registry || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

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
          period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
          multiplier: { type: 'number', minimum: 0, maximum: 100, default: 2 },
        },
        additionalProperties: true,
      },
    };
  }

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  const ROLE_SIGNAL_FIELD = {
    longEntry: 'enter',
    longExit: 'exit',
    shortEntry: 'short',
    shortExit: 'cover',
  };

  function registerVolumeSpikePlugin(config) {
    const meta = getMeta({ id: config.id, label: config.label });
    const schema = meta?.paramsSchema;
    const multiplierDefault =
      schema &&
      schema.properties &&
      typeof schema.properties.multiplier === 'object' &&
      schema.properties.multiplier !== null &&
      Number.isFinite(Number(schema.properties.multiplier.default))
        ? Number(schema.properties.multiplier.default)
        : 2;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      const signalField = ROLE_SIGNAL_FIELD[config.role];
      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };

      if (!context || context.role !== config.role) {
        return base;
      }

      const idx = Number(context.index) || 0;
      const volumes = context.series?.volume;
      const avgSeries = context.helpers?.getIndicator
        ? context.helpers.getIndicator(config.indicatorKey)
        : undefined;

      if (!Array.isArray(volumes) || !Array.isArray(avgSeries)) {
        return base;
      }

      const multiplierRaw = Number(params?.multiplier);
      const multiplier =
        Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : multiplierDefault;

      const avg = toFinite(avgSeries[idx]);
      const volume = toFinite(volumes[idx]);

      if (avg === null || volume === null) {
        return base;
      }

      const threshold = avg * multiplier;
      const triggered = volume > threshold;

      if (triggered) {
        const prevVolume = idx > 0 ? toFinite(volumes[idx - 1]) : null;
        const nextVolume = idx + 1 < volumes.length ? toFinite(volumes[idx + 1]) : null;
        const prevAvg = idx > 0 ? toFinite(avgSeries[idx - 1]) : null;
        const nextAvg = idx + 1 < avgSeries.length ? toFinite(avgSeries[idx + 1]) : null;

        base.meta = {
          indicatorValues: {
            成交量: [prevVolume, volume, nextVolume],
            均量: [prevAvg, avg, nextAvg],
          },
          multiplier,
          indicatorKey: config.indicatorKey,
          thresholdVolume: toFinite(threshold),
        };
      }

      base[signalField] = triggered;
      return base;
    });

    registry.registerStrategy(plugin);
  }

  const definitions = [
    {
      id: 'volume_spike',
      label: '成交量暴增',
      role: 'longEntry',
      indicatorKey: 'volumeAvgEntry',
    },
    {
      id: 'volume_spike_exit',
      label: '成交量暴增 (出場)',
      role: 'longExit',
      indicatorKey: 'volumeAvgExit',
    },
    {
      id: 'short_volume_spike',
      label: '成交量暴增 (做空)',
      role: 'shortEntry',
      indicatorKey: 'volumeAvgShortEntry',
    },
    {
      id: 'cover_volume_spike',
      label: '成交量暴增 (回補)',
      role: 'shortExit',
      indicatorKey: 'volumeAvgShortExit',
    },
  ];

  definitions.forEach(registerVolumeSpikePlugin);
})(typeof self !== 'undefined' ? self : this);
