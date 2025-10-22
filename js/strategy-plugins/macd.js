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
          shortPeriod: { type: 'integer', minimum: 1, maximum: 200, default: config.defaultShort },
          longPeriod: { type: 'integer', minimum: 1, maximum: 400, default: config.defaultLong },
          signalPeriod: { type: 'integer', minimum: 1, maximum: 200, default: config.defaultSignal },
        },
        additionalProperties: true,
      },
    };
  }

  function getSeriesSnapshot(series, index) {
    const data = Array.isArray(series) ? series : [];
    const prev = index > 0 ? toFinite(data[index - 1]) : null;
    const current = toFinite(data[index]);
    const next = index + 1 < data.length ? toFinite(data[index + 1]) : null;
    return { prev, current, next };
  }

  function registerMacdPlugin(config) {
    const meta = getMeta(config);
    const roleConfig = config.roleMap;

    const plugin = createLegacyStrategyPlugin(meta, (context) => {
      const idx = Number(context?.index) || 0;
      const role = context?.role;
      const mapping = roleConfig[role];
      if (!mapping) {
        throw new Error(`[${config.id}] 不支援的角色: ${role}`);
      }
      const macdSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(mapping.macdKey)
        : undefined;
      const signalSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(mapping.signalKey)
        : undefined;
      const difSnapshot = getSeriesSnapshot(macdSeries, idx);
      const deaSnapshot = getSeriesSnapshot(signalSeries, idx);

      let triggered = false;
      if (
        difSnapshot.current !== null &&
        difSnapshot.prev !== null &&
        deaSnapshot.current !== null &&
        deaSnapshot.prev !== null
      ) {
        triggered = mapping.comparator({
          difNow: difSnapshot.current,
          difPrev: difSnapshot.prev,
          deaNow: deaSnapshot.current,
          deaPrev: deaSnapshot.prev,
        });
      }

      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      base[mapping.resultField] = triggered;
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
          indicatorValues: {
            DIF: [difSnapshot.prev, difSnapshot.current, difSnapshot.next],
            DEA: [deaSnapshot.prev, deaSnapshot.current, deaSnapshot.next],
          },
        };
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  registerMacdPlugin({
    id: 'macd_cross',
    label: 'MACD黃金交叉 (DI版)',
    defaultShort: 12,
    defaultLong: 26,
    defaultSignal: 9,
    roleMap: {
      longEntry: {
        macdKey: 'macdEntry',
        signalKey: 'macdSignalEntry',
        resultField: 'enter',
        comparator: ({ difNow, difPrev, deaNow, deaPrev }) => difNow > deaNow && difPrev <= deaPrev,
      },
      longExit: {
        macdKey: 'macdExit',
        signalKey: 'macdSignalExit',
        resultField: 'exit',
        comparator: ({ difNow, difPrev, deaNow, deaPrev }) => difNow < deaNow && difPrev >= deaPrev,
      },
    },
  });

  registerMacdPlugin({
    id: 'short_macd_cross',
    label: 'MACD死亡交叉 (DI版) (做空)',
    defaultShort: 12,
    defaultLong: 26,
    defaultSignal: 9,
    roleMap: {
      shortEntry: {
        macdKey: 'macdShortEntry',
        signalKey: 'macdSignalShortEntry',
        resultField: 'short',
        comparator: ({ difNow, difPrev, deaNow, deaPrev }) => difNow < deaNow && difPrev >= deaPrev,
      },
    },
  });

  registerMacdPlugin({
    id: 'cover_macd_cross',
    label: 'MACD黃金交叉 (DI版) (回補)',
    defaultShort: 12,
    defaultLong: 26,
    defaultSignal: 9,
    roleMap: {
      shortExit: {
        macdKey: 'macdCover',
        signalKey: 'macdSignalCover',
        resultField: 'cover',
        comparator: ({ difNow, difPrev, deaNow, deaPrev }) => difNow > deaNow && difPrev <= deaPrev,
      },
    },
  });
})(typeof self !== 'undefined' ? self : this);
