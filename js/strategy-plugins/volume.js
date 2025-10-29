// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
// Patch Tag: LB-VOLUME-SPIKE-FLOW-20260730A
// Patch Tag: LB-VOLUME-EXIT-20240829A
// Patch Tag: LB-VOLUME-SPIKE-BLOCK-20240914A
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

  function readDefaultFromSchema(meta, key, fallback) {
    const schema = meta?.paramsSchema;
    const defaultValue = schema?.properties?.[key]?.default;
    const numeric = Number(defaultValue);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    return fallback;
  }

  function normaliseMultiplier(value, fallback) {
    const raw = Number(value);
    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return fallback;
  }

  function normalisePeriod(value, fallback) {
    const raw = Number(value);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 365) {
      return Math.floor(raw);
    }
    return Math.floor(fallback);
  }

  const ROLE_PROFILES = {
    longEntry: {
      indicatorKey: 'volumeAvgEntry',
      signalField: 'enter',
    },
    longExit: {
      indicatorKey: 'volumeAvgExit',
      signalField: 'exit',
    },
    shortEntry: {
      indicatorKey: 'volumeAvgShortEntry',
      signalField: 'short',
    },
    shortExit: {
      indicatorKey: 'volumeAvgShortExit',
      signalField: 'cover',
    },
  };

  const PLUGIN_VARIANTS = [
    { id: 'volume_spike', label: '成交量暴增', lockedRole: null },
    { id: 'volume_spike_exit', label: '成交量暴增 (出場)', lockedRole: 'longExit' },
    { id: 'short_volume_spike', label: '成交量暴增 (做空)', lockedRole: 'shortEntry' },
    { id: 'cover_volume_spike', label: '成交量暴增 (回補)', lockedRole: 'shortExit' },
  ];

  function evaluateVariant(variant, meta, context, params, defaults) {
    const role = context?.role || 'longEntry';
    const resolvedRole = variant.lockedRole || role;
    const profile = ROLE_PROFILES[resolvedRole];
    if (!profile) {
      return { enter: false, exit: false, short: false, cover: false, meta: {} };
    }
    if (variant.lockedRole && role !== variant.lockedRole) {
      return { enter: false, exit: false, short: false, cover: false, meta: {} };
    }

    const volumes = context?.series?.volume;
    const indicatorSeries = context?.helpers?.getIndicator
      ? context.helpers.getIndicator(profile.indicatorKey)
      : undefined;

    const idx = Number(context?.index) || 0;
    const baseResult = { enter: false, exit: false, short: false, cover: false, meta: {} };

    if (!Array.isArray(volumes) || !Array.isArray(indicatorSeries)) {
      baseResult.meta = {
        pluginId: variant.id,
        role: resolvedRole,
        indicatorKey: profile.indicatorKey,
        multiplier: defaults.multiplier,
        period: defaults.period,
      };
      return baseResult;
    }

    const multiplier = normaliseMultiplier(params?.multiplier, defaults.multiplier);
    const period = normalisePeriod(params?.period, defaults.period);
    const avg = toFinite(indicatorSeries[idx]);
    const volume = toFinite(volumes[idx]);
    const avgTriplet = makeTriplet(indicatorSeries, idx);
    const volumeTriplet = makeTriplet(volumes, idx);

    const threshold = avg !== null ? avg * multiplier : null;
    const triggered = avg !== null && volume !== null ? volume > threshold : false;
    const ratio = avg !== null && avg !== 0 && volume !== null ? volume / avg : null;

    const metaPayload = {
      pluginId: variant.id,
      role: resolvedRole,
      indicatorKey: profile.indicatorKey,
      multiplier,
      period,
      thresholdVolume: threshold,
      volumeRatio: ratio,
      indicatorValues: {
        成交量: volumeTriplet,
        均量: avgTriplet,
      },
    };

    baseResult.meta = metaPayload;
    baseResult[profile.signalField] = triggered;
    return baseResult;
  }

  PLUGIN_VARIANTS.forEach((variant) => {
    const meta = getMeta({ id: variant.id, label: variant.label });
    const defaults = {
      multiplier: readDefaultFromSchema(meta, 'multiplier', 2),
      period: readDefaultFromSchema(meta, 'period', 20),
    };
    const plugin = createLegacyStrategyPlugin(meta, (context, params) =>
      evaluateVariant(variant, meta, context, params, defaults),
    );
    registry.registerStrategy(plugin);
  });
})(typeof self !== 'undefined' ? self : this);
