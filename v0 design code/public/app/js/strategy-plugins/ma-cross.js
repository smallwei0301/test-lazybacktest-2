// Patch Tag: LB-PLUGIN-ATOMS-20250709A
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
    if (!Array.isArray(series)) return { prev: null, current: null, next: null };
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return { prev, current, next };
  }

  function buildResult(triggered, role, snapshots) {
    const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
    base[role] = triggered;
    if (triggered) {
      base.meta = {
        indicatorValues: {
          短SMA: [snapshots.short.prev, snapshots.short.current, snapshots.short.next],
          長SMA: [snapshots.long.prev, snapshots.long.current, snapshots.long.next],
        },
      };
    }
    return base;
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
          shortPeriod: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: 5,
          },
          longPeriod: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: 20,
          },
        },
        additionalProperties: true,
      },
    };
  }

  function registerCrossPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context) => {
        const idx = Number(context?.index) || 0;
        const role = context?.role;
        const mapping = config.roleMap[role];
        if (!mapping) {
          return { enter: false, exit: false, short: false, cover: false, meta: {} };
        }
        const shortSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(mapping.shortKey)
          : undefined;
        const longSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(mapping.longKey)
          : undefined;
        const shortSnap = makeTriplet(shortSeries, idx);
        const longSnap = makeTriplet(longSeries, idx);
        let triggered = false;
        if (
          shortSnap.current !== null &&
          shortSnap.prev !== null &&
          longSnap.current !== null &&
          longSnap.prev !== null
        ) {
          triggered = mapping.comparator({
            shortNow: shortSnap.current,
            shortPrev: shortSnap.prev,
            longNow: longSnap.current,
            longPrev: longSnap.prev,
          });
        }
        return buildResult(triggered, mapping.resultField, {
          short: shortSnap,
          long: longSnap,
        });
      },
    );
    registry.registerStrategy(plugin);
  }

  registerCrossPlugin({
    id: 'ma_cross',
    label: '均線黃金交叉',
    roleMap: {
      longEntry: {
        shortKey: 'maShort',
        longKey: 'maLong',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow > longNow && shortPrev <= longPrev,
        resultField: 'enter',
      },
      longExit: {
        shortKey: 'maShortExit',
        longKey: 'maLongExit',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow < longNow && shortPrev >= longPrev,
        resultField: 'exit',
      },
    },
  });

  registerCrossPlugin({
    id: 'ema_cross',
    label: 'EMA交叉 (多頭)',
    roleMap: {
      longEntry: {
        shortKey: 'maShort',
        longKey: 'maLong',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow > longNow && shortPrev <= longPrev,
        resultField: 'enter',
      },
      longExit: {
        shortKey: 'maShortExit',
        longKey: 'maLongExit',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow < longNow && shortPrev >= longPrev,
        resultField: 'exit',
      },
    },
  });

  registerCrossPlugin({
    id: 'short_ma_cross',
    label: '均線死亡交叉 (做空)',
    roleMap: {
      shortEntry: {
        shortKey: 'maShortShortEntry',
        longKey: 'maLongShortEntry',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow < longNow && shortPrev >= longPrev,
        resultField: 'short',
      },
    },
  });

  registerCrossPlugin({
    id: 'short_ema_cross',
    label: 'EMA交叉 (做空)',
    roleMap: {
      shortEntry: {
        shortKey: 'maShortShortEntry',
        longKey: 'maLongShortEntry',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow < longNow && shortPrev >= longPrev,
        resultField: 'short',
      },
    },
  });

  registerCrossPlugin({
    id: 'cover_ma_cross',
    label: '均線黃金交叉 (回補)',
    roleMap: {
      shortExit: {
        shortKey: 'maShortCover',
        longKey: 'maLongCover',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow > longNow && shortPrev <= longPrev,
        resultField: 'cover',
      },
    },
  });

  registerCrossPlugin({
    id: 'cover_ema_cross',
    label: 'EMA交叉 (回補)',
    roleMap: {
      shortExit: {
        shortKey: 'maShortCover',
        longKey: 'maLongCover',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow > longNow && shortPrev <= longPrev,
        resultField: 'cover',
      },
    },
  });

  registerCrossPlugin({
    id: 'ma_cross_exit',
    label: '均線死亡交叉',
    roleMap: {
      longExit: {
        shortKey: 'maShortExit',
        longKey: 'maLongExit',
        comparator: ({ shortNow, shortPrev, longNow, longPrev }) =>
          shortNow < longNow && shortPrev >= longPrev,
        resultField: 'exit',
      },
    },
  });
})(typeof self !== 'undefined' ? self : this);
