// Patch Tag: LB-PLUGIN-ATOMS-20250721A
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
          shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 12 },
          longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 26 },
          signalPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 9 },
        },
        additionalProperties: true,
      },
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
        const signalSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.signalKey)
          : undefined;
        const dif = makeTriplet(difSeries, idx);
        const signal = makeTriplet(signalSeries, idx);

        let triggered = false;
        if (
          dif.current !== null &&
          dif.prev !== null &&
          signal.current !== null &&
          signal.prev !== null
        ) {
          triggered = config.comparator({ dif, signal });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              DIF: [dif.prev, dif.current, dif.next],
              DEA: [signal.prev, signal.current, signal.next],
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
    label: 'MACD 黃金交叉 (多頭進場)',
    difKey: 'macdEntry',
    signalKey: 'macdSignalEntry',
    signalField: 'enter',
    comparator: ({ dif, signal }) => dif.current > signal.current && dif.prev <= signal.prev,
  });

  registerMacdPlugin({
    id: 'macd_cross_exit',
    label: 'MACD 死亡交叉 (多頭出場)',
    difKey: 'macdExit',
    signalKey: 'macdSignalExit',
    signalField: 'exit',
    comparator: ({ dif, signal }) => dif.current < signal.current && dif.prev >= signal.prev,
  });

  registerMacdPlugin({
    id: 'short_macd_cross',
    label: 'MACD 死亡交叉 (做空進場)',
    difKey: 'macdShortEntry',
    signalKey: 'macdSignalShortEntry',
    signalField: 'short',
    comparator: ({ dif, signal }) => dif.current < signal.current && dif.prev >= signal.prev,
  });

  registerMacdPlugin({
    id: 'cover_macd_cross',
    label: 'MACD 黃金交叉 (空單回補)',
    difKey: 'macdCover',
    signalKey: 'macdSignalCover',
    signalField: 'cover',
    comparator: ({ dif, signal }) => dif.current > signal.current && dif.prev <= signal.prev,
  });
})(typeof self !== 'undefined' ? self : this);
