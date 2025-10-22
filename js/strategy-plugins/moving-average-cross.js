// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    return;
  }

  const { ensureRuleResult } = contract;

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function pickIndicator(context, key) {
    if (!context || typeof context !== 'object') return [];
    if (!context.helpers || typeof context.helpers.getIndicator !== 'function') {
      return [];
    }
    const series = context.helpers.getIndicator(key);
    return Array.isArray(series) ? series : [];
  }

  function clampIndex(index, array) {
    if (!Array.isArray(array)) return null;
    if (index < 0 || index >= array.length) return null;
    const value = array[index];
    return isFiniteNumber(value) ? value : null;
  }

  function buildIndicatorMeta(labelFast, labelSlow, prevFast, currFast, nextFast, prevSlow, currSlow, nextSlow) {
    return {
      indicatorValues: {
        [labelFast]: [prevFast, currFast, nextFast],
        [labelSlow]: [prevSlow, currSlow, nextSlow],
      },
    };
  }

  function createCrossPlugin(definition) {
    const { id, label, paramsSchema, resolveKeys, direction, resultKey, indicatorLabels } = definition;
    return {
      meta: {
        id,
        label,
        paramsSchema,
      },
      run(context, params) {
        const index = context?.index ?? -1;
        if (!Number.isInteger(index) || index <= 0) {
          return ensureRuleResult({}, { pluginId: id, role: context?.role, index });
        }
        const { fastKey, slowKey } = resolveKeys(context.role || '');
        const fastSeries = pickIndicator(context, fastKey);
        const slowSeries = pickIndicator(context, slowKey);
        if (!Array.isArray(fastSeries) || !Array.isArray(slowSeries)) {
          return ensureRuleResult({}, { pluginId: id, role: context?.role, index });
        }
        const fastPrev = clampIndex(index - 1, fastSeries);
        const fastCurr = clampIndex(index, fastSeries);
        const fastNext = clampIndex(index + 1, fastSeries);
        const slowPrev = clampIndex(index - 1, slowSeries);
        const slowCurr = clampIndex(index, slowSeries);
        const slowNext = clampIndex(index + 1, slowSeries);

        let crossed = false;
        if (
          fastPrev !== null &&
          fastCurr !== null &&
          slowPrev !== null &&
          slowCurr !== null
        ) {
          if (direction === 'bullish') {
            crossed = fastCurr > slowCurr && fastPrev <= slowPrev;
          } else {
            crossed = fastCurr < slowCurr && fastPrev >= slowPrev;
          }
        }

        const result = ensureRuleResult(
          {
            [resultKey]: crossed,
            meta: crossed
              ? buildIndicatorMeta(
                  indicatorLabels.fast,
                  indicatorLabels.slow,
                  fastPrev,
                  fastCurr,
                  fastNext,
                  slowPrev,
                  slowCurr,
                  slowNext,
                )
              : {},
          },
          { pluginId: id, role: context?.role, index },
        );
        return result;
      },
    };
  }

  const baseSchema = {
    type: 'object',
    properties: {
      shortPeriod: { type: 'number', minimum: 1, maximum: 600, default: 5 },
      longPeriod: { type: 'number', minimum: 1, maximum: 600, default: 20 },
    },
    required: ['shortPeriod', 'longPeriod'],
    additionalProperties: false,
  };

  const plugins = [
    {
      id: 'ma_cross',
      label: '均線黃金交叉',
      paramsSchema: baseSchema,
      direction: 'bullish',
      resultKey: 'enter',
      indicatorLabels: { fast: '短SMA', slow: '長SMA' },
      resolveKeys(role) {
        switch (role) {
          case 'longExit':
            return { fastKey: 'maShortExit', slowKey: 'maLongExit' };
          case 'shortEntry':
            return { fastKey: 'maShortShortEntry', slowKey: 'maLongShortEntry' };
          case 'shortExit':
            return { fastKey: 'maShortCover', slowKey: 'maLongCover' };
          case 'longEntry':
          default:
            return { fastKey: 'maShort', slowKey: 'maLong' };
        }
      },
    },
    {
      id: 'ema_cross',
      label: 'EMA 黃金交叉',
      paramsSchema: baseSchema,
      direction: 'bullish',
      resultKey: 'enter',
      indicatorLabels: { fast: '短EMA', slow: '長EMA' },
      resolveKeys(role) {
        switch (role) {
          case 'longExit':
            return { fastKey: 'maShortExit', slowKey: 'maLongExit' };
          case 'shortEntry':
            return { fastKey: 'maShortShortEntry', slowKey: 'maLongShortEntry' };
          case 'shortExit':
            return { fastKey: 'maShortCover', slowKey: 'maLongCover' };
          case 'longEntry':
          default:
            return { fastKey: 'maShort', slowKey: 'maLong' };
        }
      },
    },
    {
      id: 'short_ma_cross',
      label: '均線死亡交叉 (做空)',
      paramsSchema: baseSchema,
      direction: 'bearish',
      resultKey: 'short',
      indicatorLabels: { fast: '短SMA', slow: '長SMA' },
      resolveKeys() {
        return { fastKey: 'maShortShortEntry', slowKey: 'maLongShortEntry' };
      },
    },
    {
      id: 'short_ema_cross',
      label: 'EMA 死亡交叉 (做空)',
      paramsSchema: baseSchema,
      direction: 'bearish',
      resultKey: 'short',
      indicatorLabels: { fast: '短EMA', slow: '長EMA' },
      resolveKeys() {
        return { fastKey: 'maShortShortEntry', slowKey: 'maLongShortEntry' };
      },
    },
    {
      id: 'cover_ma_cross',
      label: '均線黃金交叉回補',
      paramsSchema: baseSchema,
      direction: 'bullish',
      resultKey: 'cover',
      indicatorLabels: { fast: '短SMA', slow: '長SMA' },
      resolveKeys() {
        return { fastKey: 'maShortCover', slowKey: 'maLongCover' };
      },
    },
    {
      id: 'cover_ema_cross',
      label: 'EMA 黃金交叉回補',
      paramsSchema: baseSchema,
      direction: 'bullish',
      resultKey: 'cover',
      indicatorLabels: { fast: '短EMA', slow: '長EMA' },
      resolveKeys() {
        return { fastKey: 'maShortCover', slowKey: 'maLongCover' };
      },
    },
  ];

  plugins.forEach((definition) => {
    const plugin = createCrossPlugin(definition);
    registry.register(plugin);
  });
})(typeof self !== 'undefined' ? self : this);
