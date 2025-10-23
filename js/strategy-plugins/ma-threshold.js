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
          period: {
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

  function registerMaThresholdPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context) => {
        const idx = Number(context?.index) || 0;
        const closes = context?.series?.close;
        const maSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator('maExit')
          : undefined;

        if (!Array.isArray(closes) || !Array.isArray(maSeries)) {
          return { enter: false, exit: false, short: false, cover: false, meta: {} };
        }

        const prevClose = idx > 0 ? toFinite(closes[idx - 1]) : null;
        const close = toFinite(closes[idx]);
        const nextClose = idx + 1 < closes.length ? toFinite(closes[idx + 1]) : null;
        const prevMa = idx > 0 ? toFinite(maSeries[idx - 1]) : null;
        const ma = toFinite(maSeries[idx]);
        const nextMa = idx + 1 < maSeries.length ? toFinite(maSeries[idx + 1]) : null;

        let triggered = false;
        if (close !== null && prevClose !== null && ma !== null && prevMa !== null) {
          triggered = config.comparator({ close, prevClose, ma, prevMa });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              收盤價: [prevClose, close, nextClose],
              SMA: [prevMa, ma, nextMa],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerMaThresholdPlugin({
    id: 'ma_above',
    label: '價格突破均線',
    signalField: 'enter',
    comparator: ({ close, prevClose, ma, prevMa }) => close > ma && prevClose <= prevMa,
  });

  registerMaThresholdPlugin({
    id: 'ma_below',
    label: '價格跌破均線',
    signalField: 'exit',
    comparator: ({ close, prevClose, ma, prevMa }) => close < ma && prevClose >= prevMa,
  });

  registerMaThresholdPlugin({
    id: 'short_ma_below',
    label: '價格跌破均線 (做空)',
    signalField: 'short',
    comparator: ({ close, prevClose, ma, prevMa }) => close < ma && prevClose >= prevMa,
  });

  registerMaThresholdPlugin({
    id: 'cover_ma_above',
    label: '價格突破均線 (回補)',
    signalField: 'cover',
    comparator: ({ close, prevClose, ma, prevMa }) => close > ma && prevClose <= prevMa,
  });
})(typeof self !== 'undefined' ? self : this);
