// Patch Tag: LB-PLUGIN-ATOMS-20250721E
// Patch Tag: LB-PLUGIN-VOLUME-20250729A
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
          period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
          multiplier: { type: 'number', minimum: 0.1, maximum: 20, default: 2 },
        },
        additionalProperties: true,
      },
    };
  }

  function registerVolumePlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const volumeSeries = Array.isArray(context?.series?.volume)
          ? context.series.volume
          : [];
        const avgSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator('volumeAvgEntry')
          : undefined;
        const volumeSnapshot = makeTriplet(volumeSeries, idx);
        const avgSnapshot = makeTriplet(avgSeries, idx);
        const rawMultiplier = Number(params?.multiplier);
        const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0
          ? rawMultiplier
          : (Number.isFinite(config.defaultMultiplier) && config.defaultMultiplier > 0
            ? config.defaultMultiplier
            : 2);
        const comparator = typeof config.comparator === 'function'
          ? config.comparator
          : (({ volumeNow, avgNow, multiplier: m }) => volumeNow > avgNow * m);

        let triggered = false;
        if (avgSnapshot.current !== null && avgSnapshot.current > 0 && volumeSnapshot.current !== null) {
          triggered = comparator({
            volumeNow: volumeSnapshot.current,
            volumePrev: volumeSnapshot.prev,
            avgNow: avgSnapshot.current,
            avgPrev: avgSnapshot.prev,
            multiplier,
          });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              成交量: [volumeSnapshot.prev, volumeSnapshot.current, volumeSnapshot.next],
              均量: [avgSnapshot.prev, avgSnapshot.current, avgSnapshot.next],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerVolumePlugin({
    id: 'volume_spike',
    label: '成交量暴增 (多頭進場)',
    signalField: 'enter',
    defaultMultiplier: 2,
    comparator: ({ volumeNow, avgNow, multiplier }) => volumeNow > avgNow * multiplier,
  });

  registerVolumePlugin({
    id: 'volume_spike_exit',
    label: '成交量暴增 (多頭出場)',
    signalField: 'exit',
    defaultMultiplier: 2,
    comparator: ({ volumeNow, avgNow, multiplier }) => volumeNow < avgNow * multiplier,
  });

  registerVolumePlugin({
    id: 'short_volume_spike',
    label: '成交量暴增 (做空進場)',
    signalField: 'short',
    defaultMultiplier: 2,
    comparator: ({ volumeNow, avgNow, multiplier }) => volumeNow > avgNow * multiplier,
  });

  registerVolumePlugin({
    id: 'cover_volume_spike',
    label: '成交量暴增 (空單回補)',
    signalField: 'cover',
    defaultMultiplier: 2,
    comparator: ({ volumeNow, avgNow, multiplier }) => volumeNow < avgNow * multiplier,
  });
})(typeof self !== 'undefined' ? self : this);
