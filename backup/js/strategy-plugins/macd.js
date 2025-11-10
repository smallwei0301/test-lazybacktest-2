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
          shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 12 },
          longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 26 },
          signalPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 9 },
        },
        additionalProperties: true,
      },
    };
  }

  function makeSnapshot(series, index) {
    if (!Array.isArray(series)) {
      return { prev: null, current: null, next: null };
    }
    return {
      prev: index > 0 ? toFinite(series[index - 1]) : null,
      current: toFinite(series[index]),
      next: index + 1 < series.length ? toFinite(series[index + 1]) : null,
    };
  }

  function registerMacdPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context) => {
        const idx = Number(context?.index) || 0;
        const difSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.difKey)
          : undefined;
        const deaSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.deaKey)
          : undefined;

        const difSnapshot = makeSnapshot(difSeries, idx);
        const deaSnapshot = makeSnapshot(deaSeries, idx);

        let triggered = false;
        if (
          difSnapshot.current !== null &&
          difSnapshot.prev !== null &&
          deaSnapshot.current !== null &&
          deaSnapshot.prev !== null
        ) {
          triggered = config.comparator({
            dif: difSnapshot.current,
            difPrev: difSnapshot.prev,
            dea: deaSnapshot.current,
            deaPrev: deaSnapshot.prev,
          });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            macdValues: {
              difPrev: difSnapshot.prev,
              deaPrev: deaSnapshot.prev,
              difNow: difSnapshot.current,
              deaNow: deaSnapshot.current,
              difNext: difSnapshot.next,
              deaNext: deaSnapshot.next,
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerMacdPlugin({
    id: 'macd_cross',
    label: 'MACD黃金交叉 (DI版)',
    difKey: 'macdEntry',
    deaKey: 'macdSignalEntry',
    signalField: 'enter',
    comparator: ({ dif, difPrev, dea, deaPrev }) => dif > dea && difPrev <= deaPrev,
  });

  registerMacdPlugin({
    id: 'macd_cross_exit',
    label: 'MACD死亡交叉 (DI版)',
    difKey: 'macdExit',
    deaKey: 'macdSignalExit',
    signalField: 'exit',
    comparator: ({ dif, difPrev, dea, deaPrev }) => dif < dea && difPrev >= deaPrev,
  });

  registerMacdPlugin({
    id: 'short_macd_cross',
    label: 'MACD死亡交叉 (DI版) (做空)',
    difKey: 'macdShortEntry',
    deaKey: 'macdSignalShortEntry',
    signalField: 'short',
    comparator: ({ dif, difPrev, dea, deaPrev }) => dif < dea && difPrev >= deaPrev,
  });

  registerMacdPlugin({
    id: 'cover_macd_cross',
    label: 'MACD黃金交叉 (DI版) (回補)',
    difKey: 'macdCover',
    deaKey: 'macdSignalCover',
    signalField: 'cover',
    comparator: ({ dif, difPrev, dea, deaPrev }) => dif > dea && difPrev <= deaPrev,
  });
})(typeof self !== 'undefined' ? self : this);
