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
          period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
          multiplier: { type: 'number', minimum: 0, maximum: 100, default: 2 },
        },
        additionalProperties: true,
      },
    };
  }

  const plugin = createLegacyStrategyPlugin(
    getMeta({ id: 'volume_spike', label: '成交量暴增' }),
    (context, params) => {
      const idx = Number(context?.index) || 0;
      const volumes = context?.series?.volume;
      const avgSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator('volumeAvgEntry')
        : undefined;

      if (!Array.isArray(volumes) || !Array.isArray(avgSeries)) {
        return { enter: false, exit: false, short: false, cover: false, meta: {} };
      }

      const multiplierRaw = Number(params?.multiplier);
      const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 2;
      const avg = toFinite(avgSeries[idx]);
      const volume = toFinite(volumes[idx]);
      const prevVolume = idx > 0 ? toFinite(volumes[idx - 1]) : null;
      const nextVolume = idx + 1 < volumes.length ? toFinite(volumes[idx + 1]) : null;
      const prevAvg = idx > 0 ? toFinite(avgSeries[idx - 1]) : null;
      const nextAvg = idx + 1 < avgSeries.length ? toFinite(avgSeries[idx + 1]) : null;

      let triggered = false;
      if (avg !== null && volume !== null) {
        triggered = volume > avg * multiplier;
      }

      const role = typeof context?.role === 'string' ? context.role : 'longEntry';
      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      if (triggered) {
        if (role === 'longExit') {
          base.exit = true;
        } else if (role === 'shortEntry') {
          base.short = true;
        } else if (role === 'shortExit') {
          base.cover = true;
        } else {
          base.enter = true;
        }
        base.meta = {
          indicatorValues: {
            成交量: [prevVolume, volume, nextVolume],
            均量: [prevAvg, avg, nextAvg],
          },
        };
      }
      return base;
    },
  );

  registry.registerStrategy(plugin);
})(typeof self !== 'undefined' ? self : this);
