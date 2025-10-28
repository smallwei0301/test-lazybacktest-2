// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
// Patch Tag: LB-VOLUME-SPIKE-FLOW-20260730A
// Patch Tag: LB-VOLUME-EXIT-20240829A
// Patch Tag: LB-VOLUME-SPIKE-MODULAR-20240915A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (!registry || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

  const VERSION_CODE = 'LB-VOLUME-SPIKE-MODULAR-20240915A';

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function resolveIndicatorKey(role) {
    switch (role) {
      case 'longExit':
        return 'volumeAvgExit';
      case 'shortEntry':
        return 'volumeAvgShortEntry';
      case 'shortExit':
        return 'volumeAvgShortExit';
      default:
        return 'volumeAvgEntry';
    }
  }

  function roleToSignal(role) {
    switch (role) {
      case 'longExit':
        return 'exit';
      case 'shortEntry':
        return 'short';
      case 'shortExit':
        return 'cover';
      default:
        return 'enter';
    }
  }

  const volumeParamsSchema = Object.freeze({
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      multiplier: { type: 'number', minimum: 0, maximum: 100, default: 2 },
    },
    additionalProperties: true,
  });

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
      paramsSchema: volumeParamsSchema,
    };
  }

  function normaliseParams(params) {
    const multiplierRaw = Number(params?.multiplier);
    const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 2;
    const periodRaw = Number(params?.period);
    const period = Number.isFinite(periodRaw) && periodRaw >= 1 ? Math.floor(periodRaw) : 20;
    return { multiplier, period };
  }

  function registerVolumeSpikePlugin(definition) {
    if (!definition || typeof definition !== 'object') {
      return;
    }
    const plugin = createLegacyStrategyPlugin(getMeta(definition), (context, params) => {
      const idx = Number(context?.index) || 0;
      const series = context?.series;
      const volumes = series?.volume;
      const role = typeof context?.role === 'string' ? context.role : definition.expectedRole;
      const indicatorKey = definition.indicatorKey || resolveIndicatorKey(role);
      const avgSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(
            definition.indicatorKey && definition.expectedRole === role
              ? definition.indicatorKey
              : indicatorKey,
          )
        : undefined;

      if (!Array.isArray(volumes) || !Array.isArray(avgSeries)) {
        return { enter: false, exit: false, short: false, cover: false, meta: {} };
      }

      const { multiplier, period } = normaliseParams(params);
      const avg = toFinite(avgSeries[idx]);
      const volume = toFinite(volumes[idx]);
      const prevVolume = idx > 0 ? toFinite(volumes[idx - 1]) : null;
      const nextVolume = idx + 1 < volumes.length ? toFinite(volumes[idx + 1]) : null;
      const prevAvg = idx > 0 ? toFinite(avgSeries[idx - 1]) : null;
      const nextAvg = idx + 1 < avgSeries.length ? toFinite(avgSeries[idx + 1]) : null;

      const threshold = avg !== null ? avg * multiplier : null;
      const triggered = threshold !== null && volume !== null ? volume > threshold : false;

      const result = { enter: false, exit: false, short: false, cover: false, meta: {} };
      const signalField = definition.signalField || roleToSignal(role);
      const resolvedSignalField = definition.expectedRole && definition.expectedRole !== role
        ? roleToSignal(role)
        : signalField;

      if (triggered) {
        result[resolvedSignalField] = true;
        result.meta = {
          indicatorValues: {
            成交量: [prevVolume, volume, nextVolume],
            均量: [prevAvg, avg, nextAvg],
          },
          multiplier,
          period,
          indicatorKey:
            definition.indicatorKey && definition.expectedRole === role
              ? definition.indicatorKey
              : resolveIndicatorKey(role),
          thresholdVolume: threshold,
          version: VERSION_CODE,
        };
        if (definition.expectedRole && definition.expectedRole !== role) {
          result.meta.expectedRole = definition.expectedRole;
          result.meta.actualRole = role;
        }
      }

      return result;
    });

    registry.registerStrategy(plugin);
  }

  const definitions = [
    {
      id: 'volume_spike',
      label: '成交量暴增',
      signalField: 'enter',
      expectedRole: 'longEntry',
      indicatorKey: 'volumeAvgEntry',
    },
    {
      id: 'volume_spike_exit',
      label: '成交量暴增 (出場)',
      signalField: 'exit',
      expectedRole: 'longExit',
      indicatorKey: 'volumeAvgExit',
    },
    {
      id: 'short_volume_spike',
      label: '成交量暴增 (做空)',
      signalField: 'short',
      expectedRole: 'shortEntry',
      indicatorKey: 'volumeAvgShortEntry',
    },
    {
      id: 'cover_volume_spike',
      label: '成交量暴增 (回補)',
      signalField: 'cover',
      expectedRole: 'shortExit',
      indicatorKey: 'volumeAvgShortExit',
    },
  ];

  definitions.forEach(registerVolumeSpikePlugin);
})(typeof self !== 'undefined' ? self : this);
