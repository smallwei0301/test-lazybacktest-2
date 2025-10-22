// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    return;
  }

  const { ensureRuleResult } = contract;

  function getSeries(context, key) {
    if (!context?.helpers || typeof context.helpers.getIndicator !== 'function') {
      return [];
    }
    const result = context.helpers.getIndicator(key);
    return Array.isArray(result) ? result : [];
  }

  function valueAt(series, index) {
    if (!Array.isArray(series) || index < 0 || index >= series.length) {
      return null;
    }
    const value = series[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function buildKdMeta(kPrev, dPrev, kNow, dNow, kNext, dNext) {
    return {
      kdValues: {
        kPrev,
        dPrev,
        kNow,
        dNow,
        kNext,
        dNext,
      },
    };
  }

  function createKdPlugin(definition) {
    const { id, label, paramsSchema, resolver } = definition;
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
        const role = context?.role || '';
        const config = resolver(role);
        if (!config) {
          return ensureRuleResult({}, { pluginId: id, role, index });
        }
        const kSeries = getSeries(context, config.kKey);
        const dSeries = getSeries(context, config.dKey);
        const kPrev = valueAt(kSeries, index - 1);
        const kNow = valueAt(kSeries, index);
        const kNext = valueAt(kSeries, index + 1);
        const dPrev = valueAt(dSeries, index - 1);
        const dNow = valueAt(dSeries, index);
        const dNext = valueAt(dSeries, index + 1);
        const thresholdRaw = Number(params?.[config.thresholdKey]);
        const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : config.defaultThreshold;

        let signal = false;
        if (kPrev !== null && kNow !== null && dPrev !== null && dNow !== null) {
          if (config.mode === 'bullish') {
            signal = kNow > dNow && kPrev <= dPrev && dNow < threshold;
          } else {
            signal = kNow < dNow && kPrev >= dPrev && dNow > threshold;
          }
        }

        const meta = signal ? buildKdMeta(kPrev, dPrev, kNow, dNow, kNext, dNext) : {};
        return ensureRuleResult(
          {
            [config.resultKey]: signal,
            meta,
          },
          { pluginId: id, role, index },
        );
      },
    };
  }

  const baseSchema = {
    type: 'object',
    properties: {
      period: { type: 'number', minimum: 2, maximum: 200, default: 9 },
      thresholdX: { type: 'number', minimum: 0, maximum: 100, default: 30 },
      thresholdY: { type: 'number', minimum: 0, maximum: 100, default: 70 },
    },
    required: ['period', 'thresholdX', 'thresholdY'],
    additionalProperties: false,
  };

  const plugins = [
    createKdPlugin({
      id: 'k_d_cross',
      label: 'KD 黃金交叉',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'longEntry') {
          return {
            kKey: 'kEntry',
            dKey: 'dEntry',
            thresholdKey: 'thresholdX',
            defaultThreshold: 30,
            mode: 'bullish',
            resultKey: 'enter',
          };
        }
        if (role === 'longExit') {
          return {
            kKey: 'kExit',
            dKey: 'dExit',
            thresholdKey: 'thresholdY',
            defaultThreshold: 70,
            mode: 'bearish',
            resultKey: 'exit',
          };
        }
        return null;
      },
    }),
    createKdPlugin({
      id: 'short_k_d_cross',
      label: 'KD 死亡交叉做空',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'shortEntry') {
          return {
            kKey: 'kShortEntry',
            dKey: 'dShortEntry',
            thresholdKey: 'thresholdY',
            defaultThreshold: 70,
            mode: 'bearish',
            resultKey: 'short',
          };
        }
        return null;
      },
    }),
    createKdPlugin({
      id: 'cover_k_d_cross',
      label: 'KD 黃金交叉回補',
      paramsSchema: baseSchema,
      resolver(role) {
        if (role === 'shortExit') {
          return {
            kKey: 'kCover',
            dKey: 'dCover',
            thresholdKey: 'thresholdX',
            defaultThreshold: 30,
            mode: 'bullish',
            resultKey: 'cover',
          };
        }
        return null;
      },
    }),
  ];

  plugins.forEach((plugin) => registry.register(plugin));
})(typeof self !== 'undefined' ? self : this);
