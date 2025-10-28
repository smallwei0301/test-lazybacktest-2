// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
// Patch Tag: LB-VOLUME-SPIKE-FLOW-20260730A
// Patch Tag: LB-VOLUME-EXIT-20240829A
// Patch Tag: LB-VOLUME-PARAMS-20260923A
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

  const ROLE_AVG_KEY_MAP = {
    longEntry: 'volumeAvgEntry',
    longExit: 'volumeAvgExit',
    shortEntry: 'volumeAvgShortEntry',
    shortExit: 'volumeAvgCover',
  };

  function clampPeriod(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      const fb = Number(fallback);
      return Math.max(1, Math.min(365, Number.isFinite(fb) && fb > 0 ? Math.floor(fb) : 20));
    }
    return Math.max(1, Math.min(365, Math.floor(numeric)));
  }

  function resolveAverageSeries(context, params) {
    const role = context?.role || 'longEntry';
    const preferredKeys = [];
    const primaryKey = ROLE_AVG_KEY_MAP[role];
    if (primaryKey) preferredKeys.push(primaryKey);
    if (!preferredKeys.includes('volumeAvgEntry')) {
      preferredKeys.push('volumeAvgEntry');
    }

    if (context?.helpers?.getIndicator) {
      for (let i = 0; i < preferredKeys.length; i += 1) {
        const key = preferredKeys[i];
        if (!key) continue;
        const candidate = context.helpers.getIndicator(key);
        if (Array.isArray(candidate)) {
          return { key, series: candidate };
        }
      }
    }

    const volumes = Array.isArray(context?.series?.volume)
      ? context.series.volume
      : null;
    const length = Array.isArray(volumes) ? volumes.length : 0;
    if (!length) {
      return { key: primaryKey || 'volumeAvgEntry', series: null };
    }
    const period = clampPeriod(params?.period, 20);
    const averages = new Array(length).fill(null);
    const window = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < length; i += 1) {
      const value = toFinite(volumes[i]);
      if (value !== null) {
        window.push(value);
        sum += value;
        count += 1;
      } else {
        window.push(null);
      }
      if (window.length > period) {
        const removed = window.shift();
        if (removed !== null) {
          sum -= removed;
          count -= 1;
        }
      }
      if (window.length === period && count > 0) {
        averages[i] = sum / count;
      }
    }
    return { key: primaryKey || 'volumeAvgEntry', series: averages };
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
      const role = context?.role || 'longEntry';
      const volumes = Array.isArray(context?.series?.volume)
        ? context.series.volume
        : null;
      const avgInfo = resolveAverageSeries(context, params);
      const avgSeries = avgInfo.series;

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      if (!Array.isArray(volumes) || !Array.isArray(avgSeries)) {
        return base;
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

      if (triggered) {
        base.meta = {
          indicatorValues: {
            成交量: [prevVolume, volume, nextVolume],
            均量: [prevAvg, avg, nextAvg],
          },
        };
      }

      switch (role) {
        case 'longExit':
          base.exit = triggered;
          break;
        case 'shortEntry':
          base.short = triggered;
          break;
        case 'shortExit':
          base.cover = triggered;
          break;
        default:
          base.enter = triggered;
          break;
      }

      return base;
    },
  );

  registry.registerStrategy(plugin);
})(typeof self !== 'undefined' ? self : this);
