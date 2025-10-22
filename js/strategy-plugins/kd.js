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

  function makeKDTriplet(seriesK, seriesD, index) {
    if (!Array.isArray(seriesK) || !Array.isArray(seriesD)) {
      return {
        prev: { k: null, d: null },
        current: { k: null, d: null },
        next: { k: null, d: null },
      };
    }
    const prev = {
      k: index > 0 ? toFinite(seriesK[index - 1]) : null,
      d: index > 0 ? toFinite(seriesD[index - 1]) : null,
    };
    const current = {
      k: toFinite(seriesK[index]),
      d: toFinite(seriesD[index]),
    };
    const next = {
      k: index + 1 < seriesK.length ? toFinite(seriesK[index + 1]) : null,
      d: index + 1 < seriesD.length ? toFinite(seriesD[index + 1]) : null,
    };
    return { prev, current, next };
  }

  function registerKDPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      {
        id: config.id,
        label: config.label,
        paramsSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'integer',
              minimum: 1,
              maximum: 200,
              default: 9,
            },
            [config.thresholdParam]: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: config.defaultThreshold,
            },
          },
          additionalProperties: true,
        },
      },
      (context, params) => {
        const idx = Number(context?.index) || 0;
        const kSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.kKey)
          : undefined;
        const dSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.dKey)
          : undefined;
        const snapshots = makeKDTriplet(kSeries, dSeries, idx);
        const rawThreshold = Number(params?.[config.thresholdParam]);
        const threshold = Number.isFinite(rawThreshold)
          ? Math.min(Math.max(rawThreshold, 0), 100)
          : config.defaultThreshold;

        let triggered = false;
        const { prev, current } = snapshots;
        if (current.k !== null && current.d !== null && prev.k !== null && prev.d !== null) {
          triggered = config.comparator({ current, prev, threshold });
        }

        const baseResult = { enter: false, exit: false, short: false, cover: false, meta: {} };
        baseResult[config.signalField] = triggered;
        if (triggered) {
          baseResult.meta = {
            kdValues: {
              kPrev: prev.k,
              dPrev: prev.d,
              kNow: current.k,
              dNow: current.d,
              kNext: snapshots.next.k,
              dNext: snapshots.next.d,
            },
          };
        }
        return baseResult;
      },
    );
    registry.register(plugin);
  }

  registerKDPlugin({
    id: 'k_d_cross',
    label: 'KD 黃金交叉 (多頭)',
    kKey: 'kEntry',
    dKey: 'dEntry',
    signalField: 'enter',
    thresholdParam: 'thresholdX',
    defaultThreshold: 30,
    comparator: ({ current, prev, threshold }) =>
      current.k > current.d && prev.k <= prev.d && current.d !== null && current.d < threshold,
  });

  registerKDPlugin({
    id: 'k_d_cross_exit',
    label: 'KD 死亡交叉 (多頭出場)',
    kKey: 'kExit',
    dKey: 'dExit',
    signalField: 'exit',
    thresholdParam: 'thresholdY',
    defaultThreshold: 70,
    comparator: ({ current, prev, threshold }) =>
      current.k < current.d && prev.k >= prev.d && current.d !== null && current.d > threshold,
  });

  registerKDPlugin({
    id: 'short_k_d_cross',
    label: 'KD 死亡交叉 (做空)',
    kKey: 'kShortEntry',
    dKey: 'dShortEntry',
    signalField: 'short',
    thresholdParam: 'thresholdY',
    defaultThreshold: 70,
    comparator: ({ current, prev, threshold }) =>
      current.k < current.d && prev.k >= prev.d && current.d !== null && current.d > threshold,
  });

  registerKDPlugin({
    id: 'cover_k_d_cross',
    label: 'KD 黃金交叉 (空單回補)',
    kKey: 'kCover',
    dKey: 'dCover',
    signalField: 'cover',
    thresholdParam: 'thresholdX',
    defaultThreshold: 30,
    comparator: ({ current, prev, threshold }) =>
      current.k > current.d && prev.k <= prev.d && current.d !== null && current.d < threshold,
  });
})(typeof self !== 'undefined' ? self : this);
