// Patch Tag: LB-PLUGIN-MACD-20250724A
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

  function getSeriesValue(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) {
      return null;
    }
    return toFinite(series[index]);
  }

  function buildMeta(config) {
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

  function buildRuleResult(field, triggered, metaBuilder) {
    const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
    base[field] = triggered;
    if (triggered && typeof metaBuilder === 'function') {
      const meta = metaBuilder();
      if (meta && typeof meta === 'object') {
        base.meta = meta;
      }
    }
    return base;
  }

  function registerMacdPlugin(config) {
    const meta = buildMeta(config);
    const roleMap = config.roleMap || {};
    const plugin = createLegacyStrategyPlugin(meta, (context) => {
      const idx = Number(context?.index) || 0;
      const role = context?.role;
      const roleConfig = roleMap[role];
      if (!roleConfig) {
        return { enter: false, exit: false, short: false, cover: false, meta: {} };
      }

      const difSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(roleConfig.difKey)
        : undefined;
      const deaSeries = context?.helpers?.getIndicator
        ? context.helpers.getIndicator(roleConfig.deaKey)
        : undefined;

      const difNow = getSeriesValue(difSeries, idx);
      const deaNow = getSeriesValue(deaSeries, idx);
      const difPrev = getSeriesValue(difSeries, idx - 1);
      const deaPrev = getSeriesValue(deaSeries, idx - 1);

      if (
        difNow === null ||
        deaNow === null ||
        difPrev === null ||
        deaPrev === null
      ) {
        return buildRuleResult(roleConfig.resultField, false);
      }

      const triggered = roleConfig.comparator({
        difNow,
        deaNow,
        difPrev,
        deaPrev,
      });

      return buildRuleResult(roleConfig.resultField, triggered, () => ({
        macdValues: {
          difPrev,
          deaPrev,
          difNow,
          deaNow,
          difNext: getSeriesValue(difSeries, idx + 1),
          deaNext: getSeriesValue(deaSeries, idx + 1),
        },
      }));
    });

    registry.registerStrategy(plugin);
  }

  registerMacdPlugin({
    id: 'macd_cross',
    label: 'MACD黃金交叉 (DI版)',
    roleMap: {
      longEntry: {
        difKey: 'macdEntry',
        deaKey: 'macdSignalEntry',
        resultField: 'enter',
        comparator: ({ difNow, deaNow, difPrev, deaPrev }) =>
          difNow > deaNow && difPrev <= deaPrev,
      },
      longExit: {
        difKey: 'macdExit',
        deaKey: 'macdSignalExit',
        resultField: 'exit',
        comparator: ({ difNow, deaNow, difPrev, deaPrev }) =>
          difNow < deaNow && difPrev >= deaPrev,
      },
    },
  });

  registerMacdPlugin({
    id: 'short_macd_cross',
    label: 'MACD死亡交叉 (DI版) (做空)',
    roleMap: {
      shortEntry: {
        difKey: 'macdShortEntry',
        deaKey: 'macdSignalShortEntry',
        resultField: 'short',
        comparator: ({ difNow, deaNow, difPrev, deaPrev }) =>
          difNow < deaNow && difPrev >= deaPrev,
      },
    },
  });

  registerMacdPlugin({
    id: 'cover_macd_cross',
    label: 'MACD黃金交叉 (DI版) (回補)',
    roleMap: {
      shortExit: {
        difKey: 'macdCover',
        deaKey: 'macdSignalCover',
        resultField: 'cover',
        comparator: ({ difNow, deaNow, difPrev, deaPrev }) =>
          difNow > deaNow && difPrev <= deaPrev,
      },
    },
  });
})(typeof self !== 'undefined' ? self : this);

