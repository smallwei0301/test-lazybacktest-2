// Patch Tag: LB-PLUGIN-ATOMS-20250709A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (
    !registry ||
    typeof registry.registerStrategy !== 'function' ||
    !contract ||
    typeof contract.createLegacyStrategyPlugin !== 'function'
  ) {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function getClose(series, index) {
    if (!Array.isArray(series)) return { prev: null, current: null, next: null };
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return { prev, current, next };
  }

  function getBandSnapshot(indicator, index) {
    if (!Array.isArray(indicator)) return { prev: null, current: null, next: null };
    const prev = index > 0 ? toFinite(indicator[index - 1]) : null;
    const current = toFinite(indicator[index]);
    const next = index + 1 < indicator.length ? toFinite(indicator[index + 1]) : null;
    return { prev, current, next };
  }

  function registerBollingerPlugin(config) {
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
              maximum: 365,
              default: 20,
            },
            deviations: {
              type: 'number',
              minimum: 0.1,
              maximum: 10,
              default: 2,
            },
          },
          additionalProperties: true,
        },
      },
      (context) => {
        const idx = Number(context?.index) || 0;
        const closeSeries = context?.series?.close;
        const bandSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.bandKey)
          : undefined;
        const closeSnapshot = getClose(closeSeries, idx);
        const bandSnapshot = getBandSnapshot(bandSeries, idx);

        let triggered = false;
        if (
          closeSnapshot.current !== null &&
          closeSnapshot.prev !== null &&
          bandSnapshot.current !== null &&
          bandSnapshot.prev !== null
        ) {
          triggered = config.comparator({
            close: closeSnapshot.current,
            prevClose: closeSnapshot.prev,
            band: bandSnapshot.current,
            prevBand: bandSnapshot.prev,
          });
        }

        const baseResult = { enter: false, exit: false, short: false, cover: false, meta: {} };
        baseResult[config.signalField] = triggered;
        if (triggered) {
          baseResult.meta = {
            indicatorValues: {
              收盤價: [closeSnapshot.prev, closeSnapshot.current, closeSnapshot.next],
              [config.bandLabel]: [bandSnapshot.prev, bandSnapshot.current, bandSnapshot.next],
            },
          };
        }
        return baseResult;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerBollingerPlugin({
    id: 'bollinger_breakout',
    label: '布林通道突破 (多頭進場)',
    bandKey: 'bollingerUpperEntry',
    bandLabel: '上軌',
    signalField: 'enter',
    comparator: ({ close, prevClose, band, prevBand }) =>
      close > band && prevClose <= prevBand,
  });

  registerBollingerPlugin({
    id: 'bollinger_reversal',
    label: '布林通道反轉 (多頭出場)',
    bandKey: 'bollingerMiddleExit',
    bandLabel: '中軌',
    signalField: 'exit',
    comparator: ({ close, prevClose, band, prevBand }) =>
      close < band && prevClose >= prevBand,
  });

  registerBollingerPlugin({
    id: 'short_bollinger_reversal',
    label: '布林通道反轉 (做空)',
    bandKey: 'bollingerMiddleShortEntry',
    bandLabel: '中軌',
    signalField: 'short',
    comparator: ({ close, prevClose, band, prevBand }) =>
      close < band && prevClose >= prevBand,
  });

  registerBollingerPlugin({
    id: 'cover_bollinger_breakout',
    label: '布林通道突破 (空單回補)',
    bandKey: 'bollingerUpperCover',
    bandLabel: '上軌',
    signalField: 'cover',
    comparator: ({ close, prevClose, band, prevBand }) =>
      close > band && prevClose <= prevBand,
  });
})(typeof self !== 'undefined' ? self : this);
