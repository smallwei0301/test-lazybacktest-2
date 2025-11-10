// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
// Patch Tag: LB-VOLUME-SPIKE-FLOW-20260730A
// Patch Tag: LB-VOLUME-EXIT-20240829A
// Patch Tag: LB-VOLUME-SPIKE-BLOCKS-20240909A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (!registry || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;
  const VERSION = 'LB-VOLUME-SPIKE-BLOCKS-20240909A';

  const PARAMS_SCHEMA = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      multiplier: { type: 'number', minimum: 0, maximum: 100, default: 2 },
    },
    additionalProperties: true,
  };

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function makeTriplet(series, index) {
    if (!Array.isArray(series)) {
      return [null, null, null];
    }
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return [prev, current, next];
  }

  function getMeta(definition) {
    if (typeof registry.getStrategyMetaById === 'function') {
      const existing = registry.getStrategyMetaById(definition.id);
      if (existing) {
        return existing;
      }
    }
    return {
      id: definition.id,
      label: definition.label,
      paramsSchema: PARAMS_SCHEMA,
    };
  }

  const DEFINITIONS = [
    {
      id: 'volume_spike',
      label: '成交量暴增',
      indicatorKey: 'volumeAvgEntry',
      signalField: 'enter',
    },
    {
      id: 'volume_spike_exit',
      label: '成交量暴增 (出場)',
      indicatorKey: 'volumeAvgExit',
      signalField: 'exit',
    },
    {
      id: 'short_volume_spike',
      label: '成交量暴增 (做空)',
      indicatorKey: 'volumeAvgShortEntry',
      signalField: 'short',
    },
    {
      id: 'cover_volume_spike',
      label: '成交量暴增 (回補)',
      indicatorKey: 'volumeAvgShortExit',
      signalField: 'cover',
    },
  ];

  DEFINITIONS.forEach((definition) => {
    const plugin = createLegacyStrategyPlugin(
      getMeta(definition),
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const volumes = context?.series?.volume;
        const avgSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(definition.indicatorKey)
          : undefined;

        if (!Array.isArray(volumes) || !Array.isArray(avgSeries)) {
          return { enter: false, exit: false, short: false, cover: false, meta: {} };
        }

        const volumeTriplet = makeTriplet(volumes, idx);
        const avgTriplet = makeTriplet(avgSeries, idx);
        const currentVolume = volumeTriplet[1];
        const currentAvg = avgTriplet[1];

        const multiplierRaw = Number(params?.multiplier);
        const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : PARAMS_SCHEMA.properties.multiplier.default;
        const ratio = currentAvg && currentVolume ? currentVolume / currentAvg : null;
        const threshold = currentAvg !== null ? currentAvg * multiplier : null;
        const triggered = currentAvg !== null && currentVolume !== null ? currentVolume > currentAvg * multiplier : false;

        const result = { enter: false, exit: false, short: false, cover: false, meta: {} };
        result[definition.signalField] = triggered;
        result.meta = {
          version: VERSION,
          indicatorKey: definition.indicatorKey,
          multiplier,
          ratio,
          thresholdVolume: threshold,
          indicatorValues: {
            成交量: volumeTriplet,
            均量: avgTriplet,
          },
        };
        return result;
      },
    );

    registry.registerStrategy(plugin);
  });
})(typeof self !== 'undefined' ? self : this);
