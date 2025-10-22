// Patch Tag: LB-PLUGIN-ATOMS-20250721B
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

  function makeCloseSnapshot(series, index) {
    if (!Array.isArray(series)) {
      return { prev: null, current: null, next: null };
    }
    const prev = index > 0 ? toFinite(series[index - 1]) : null;
    const current = toFinite(series[index]);
    const next = index + 1 < series.length ? toFinite(series[index + 1]) : null;
    return { prev, current, next };
  }

  function makeMASnapshot(series, index) {
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
          period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
        },
        additionalProperties: true,
      },
    };
  }

  function registerMaLevel(config) {
    const plugin = createLegacyStrategyPlugin(
      getMeta(config),
      (context) => {
        const idx = Number(context?.index) || 0;
        const closeSnapshot = makeCloseSnapshot(context?.series?.close, idx);
        const maSeries = context?.helpers?.getIndicator
          ? context.helpers.getIndicator(config.maKey)
          : undefined;
        const maSnapshot = makeMASnapshot(maSeries, idx);

        let triggered = false;
        if (
          closeSnapshot.current !== null &&
          closeSnapshot.prev !== null &&
          maSnapshot.current !== null &&
          maSnapshot.prev !== null
        ) {
          triggered = config.comparator({ close: closeSnapshot, ma: maSnapshot });
        }

        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
        base[config.signalField] = triggered;
        if (triggered) {
          base.meta = {
            indicatorValues: {
              收盤價: [closeSnapshot.prev, closeSnapshot.current, closeSnapshot.next],
              均線: [maSnapshot.prev, maSnapshot.current, maSnapshot.next],
            },
          };
        }
        return base;
      },
    );
    registry.registerStrategy(plugin);
  }

  registerMaLevel({
    id: 'ma_above',
    label: '價格突破均線 (多頭進場)',
    maKey: 'maExit',
    signalField: 'enter',
    comparator: ({ close, ma }) => close.current > ma.current && close.prev <= ma.prev,
  });

  registerMaLevel({
    id: 'ma_below',
    label: '價格跌破均線 (多頭出場)',
    maKey: 'maExit',
    signalField: 'exit',
    comparator: ({ close, ma }) => close.current < ma.current && close.prev >= ma.prev,
  });

  registerMaLevel({
    id: 'short_ma_below',
    label: '價格跌破均線 (做空進場)',
    maKey: 'maExit',
    signalField: 'short',
    comparator: ({ close, ma }) => close.current < ma.current && close.prev >= ma.prev,
  });

  registerMaLevel({
    id: 'cover_ma_above',
    label: '價格突破均線 (空單回補)',
    maKey: 'maExit',
    signalField: 'cover',
    comparator: ({ close, ma }) => close.current > ma.current && close.prev <= ma.prev,
  });
})(typeof self !== 'undefined' ? self : this);
