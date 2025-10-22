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

  function getCloseSnapshot(series, index) {
    const data = Array.isArray(series) ? series : [];
    const prev = index > 0 ? toFinite(data[index - 1]) : null;
    const current = toFinite(data[index]);
    const next = index + 1 < data.length ? toFinite(data[index + 1]) : null;
    return { prev, current, next };
  }

  function getIndicatorSnapshot(series, index) {
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
          period: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: config.defaultPeriod,
          },
        },
        additionalProperties: true,
      },
    };
  }

  function registerMaThresholdPlugin(config) {
    const meta = getMeta(config);
    const schema = meta?.paramsSchema;
    const defaultPeriod =
      schema && schema.properties && schema.properties.period && typeof schema.properties.period.default === 'number'
        ? schema.properties.period.default
        : config.defaultPeriod;

    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      const role = context?.role;
      if (role !== config.role) {
        throw new Error(`[${config.id}] 不支援的角色: ${role}`);
      }
      const idx = Number(context?.index) || 0;
      const closeSnapshot = getCloseSnapshot(context?.series?.close, idx);
      const indicatorSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(config.indicatorKey)
        : undefined;
      const indicatorSnapshot = getIndicatorSnapshot(indicatorSeries, idx);
      const period = Number.isFinite(Number(params?.period)) ? Math.max(1, Number(params.period)) : defaultPeriod;

      let triggered = false;
      if (
        closeSnapshot.current !== null &&
        closeSnapshot.prev !== null &&
        indicatorSnapshot.current !== null &&
        indicatorSnapshot.prev !== null
      ) {
        triggered = config.comparator({
          currentClose: closeSnapshot.current,
          previousClose: closeSnapshot.prev,
          currentIndicator: indicatorSnapshot.current,
          previousIndicator: indicatorSnapshot.prev,
        });
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base[config.resultField] = triggered;
      if (triggered) {
        base.meta = {
          indicatorValues: {
            收盤價: [closeSnapshot.prev, closeSnapshot.current, closeSnapshot.next],
            [`SMA(${period})`]: [
              indicatorSnapshot.prev,
              indicatorSnapshot.current,
              indicatorSnapshot.next,
            ],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  registerMaThresholdPlugin({
    id: 'ma_above',
    label: '價格突破均線',
    indicatorKey: 'maExit',
    resultField: 'enter',
    role: 'longEntry',
    defaultPeriod: 20,
    comparator: ({ currentClose, previousClose, currentIndicator, previousIndicator }) =>
      currentClose > currentIndicator && previousClose <= previousIndicator,
  });

  registerMaThresholdPlugin({
    id: 'ma_below',
    label: '價格跌破均線',
    indicatorKey: 'maExit',
    resultField: 'exit',
    role: 'longExit',
    defaultPeriod: 20,
    comparator: ({ currentClose, previousClose, currentIndicator, previousIndicator }) =>
      currentClose < currentIndicator && previousClose >= previousIndicator,
  });

  registerMaThresholdPlugin({
    id: 'short_ma_below',
    label: '價格跌破均線 (做空)',
    indicatorKey: 'maExit',
    resultField: 'short',
    role: 'shortEntry',
    defaultPeriod: 20,
    comparator: ({ currentClose, previousClose, currentIndicator, previousIndicator }) =>
      currentClose < currentIndicator && previousClose >= previousIndicator,
  });

  registerMaThresholdPlugin({
    id: 'cover_ma_above',
    label: '價格突破均線 (回補)',
    indicatorKey: 'maExit',
    resultField: 'cover',
    role: 'shortExit',
    defaultPeriod: 20,
    comparator: ({ currentClose, previousClose, currentIndicator, previousIndicator }) =>
      currentClose > currentIndicator && previousClose <= previousIndicator,
  });
})(typeof self !== 'undefined' ? self : this);
