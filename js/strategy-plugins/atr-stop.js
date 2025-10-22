// Patch Tag: LB-PLUGIN-ATOMS-20250709A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  const register =
    typeof registry?.registerStrategy === 'function'
      ? (plugin) => registry.registerStrategy(plugin)
      : typeof registry?.register === 'function'
      ? (plugin) => registry.register(plugin)
      : null;
  if (!register || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

  function toFinite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function registerTrailingPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
      {
        id: config.id,
        label: config.label,
        paramsSchema: {
          type: 'object',
          properties: {
            percentage: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 5,
            },
          },
          additionalProperties: true,
        },
      },
      (context, params) => {
        const runtime = params && typeof params.__runtime === 'object' ? params.__runtime : {};
        const currentPrice = toFinite(runtime.currentPrice);
        const referencePrice = toFinite(runtime.referencePrice);
        const rawPct = Number(params?.percentage);
        const pct = Number.isFinite(rawPct) ? Math.max(rawPct, 0) : 5;
        const base = { enter: false, exit: false, short: false, cover: false, meta: {} };

        if (currentPrice === null || referencePrice === null || referencePrice <= 0) {
          return base;
        }

        const triggered = config.comparator({
          currentPrice,
          referencePrice,
          percentage: pct,
        });
        base[config.signalField] = triggered;
        if (triggered) {
          const triggerPrice = config.triggerCalculator({
            referencePrice,
            percentage: pct,
          });
          base.meta = {
            indicatorValues: {
              收盤價: [null, currentPrice, null],
              觸發價: [null, triggerPrice !== null ? Number(triggerPrice.toFixed(2)) : null, null],
            },
          };
        }
        return base;
      },
    );
    register(plugin);
  }

  registerTrailingPlugin({
    id: 'trailing_stop',
    label: '移動停損 (%)',
    signalField: 'exit',
    comparator: ({ currentPrice, referencePrice, percentage }) =>
      currentPrice < referencePrice * (1 - percentage / 100),
    triggerCalculator: ({ referencePrice, percentage }) =>
      referencePrice * (1 - percentage / 100),
  });

  registerTrailingPlugin({
    id: 'cover_trailing_stop',
    label: '移動停損 (%) (空單)',
    signalField: 'cover',
    comparator: ({ currentPrice, referencePrice, percentage }) =>
      currentPrice > referencePrice * (1 + percentage / 100),
    triggerCalculator: ({ referencePrice, percentage }) =>
      referencePrice * (1 + percentage / 100),
  });
})(typeof self !== 'undefined' ? self : this);
