// Patch Tag: LB-PLUGIN-ATOMS-20250710A — Moving average cross plugin.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    console.warn('[MovingAverageCrossPlugin] 缺少 StrategyPluginContract 或 Registry，略過註冊。');
    return;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  const meta = {
    id: 'ma-cross-v1',
    label: '均線交叉',
    paramsSchema: {
      type: 'object',
      properties: {
        fastIndicatorKey: { type: 'string', description: '短期均線指標鍵值' },
        slowIndicatorKey: { type: 'string', description: '長期均線指標鍵值' },
        cross: {
          type: 'string',
          enum: ['fastAboveSlow', 'fastBelowSlow'],
          default: 'fastAboveSlow',
          description: '短期均線相對長期均線的交叉方向',
        },
      },
      required: ['fastIndicatorKey', 'slowIndicatorKey'],
      additionalProperties: true,
    },
  };

  const plugin = contract.createLegacyStrategyPlugin(meta, (context, params) => {
    const fastKey = typeof params?.fastIndicatorKey === 'string' ? params.fastIndicatorKey : '';
    const slowKey = typeof params?.slowIndicatorKey === 'string' ? params.slowIndicatorKey : '';
    const cross = params?.cross === 'fastBelowSlow' ? 'fastBelowSlow' : 'fastAboveSlow';

    const fastSeries = context.helpers.getIndicator(fastKey) || [];
    const slowSeries = context.helpers.getIndicator(slowKey) || [];
    const idx = context.index;
    const fastNow = Array.isArray(fastSeries) ? fastSeries[idx] : null;
    const slowNow = Array.isArray(slowSeries) ? slowSeries[idx] : null;
    const fastPrev = idx > 0 && Array.isArray(fastSeries) ? fastSeries[idx - 1] : null;
    const slowPrev = idx > 0 && Array.isArray(slowSeries) ? slowSeries[idx - 1] : null;

    const validFastNow = isFiniteNumber(fastNow);
    const validSlowNow = isFiniteNumber(slowNow);
    const validFastPrev = isFiniteNumber(fastPrev);
    const validSlowPrev = isFiniteNumber(slowPrev);

    let crossed = false;
    if (cross === 'fastAboveSlow') {
      crossed =
        validFastNow &&
        validSlowNow &&
        validFastPrev &&
        validSlowPrev &&
        fastNow > slowNow &&
        fastPrev <= slowPrev;
    } else {
      crossed =
        validFastNow &&
        validSlowNow &&
        validFastPrev &&
        validSlowPrev &&
        fastNow < slowNow &&
        fastPrev >= slowPrev;
    }

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      meta: {
        fastIndicatorKey: fastKey,
        slowIndicatorKey: slowKey,
        cross,
        fastNow: validFastNow ? fastNow : null,
        slowNow: validSlowNow ? slowNow : null,
        fastPrev: validFastPrev ? fastPrev : null,
        slowPrev: validSlowPrev ? slowPrev : null,
      },
    };

    switch (context.role) {
      case 'longEntry':
        base.enter = crossed;
        break;
      case 'longExit':
        base.exit = crossed;
        break;
      case 'shortEntry':
        base.short = crossed;
        break;
      case 'shortExit':
        base.cover = crossed;
        break;
      default:
        break;
    }

    return base;
  });

  registry.register(plugin);

  const { registerAlias } = registry;

  registerAlias('ma_cross', {
    pluginId: plugin.meta.id,
    roles: ['longEntry', 'longExit'],
    mapParams(userParams, contextInfo) {
      const role = contextInfo?.role;
      if (role === 'longExit') {
        return {
          fastIndicatorKey: 'maShortExit',
          slowIndicatorKey: 'maLongExit',
          cross: 'fastBelowSlow',
        };
      }
      return {
        fastIndicatorKey: 'maShort',
        slowIndicatorKey: 'maLong',
        cross: 'fastAboveSlow',
      };
    },
  });

  registerAlias('ema_cross', {
    pluginId: plugin.meta.id,
    roles: ['longEntry', 'longExit'],
    mapParams(userParams, contextInfo) {
      const role = contextInfo?.role;
      if (role === 'longExit') {
        return {
          fastIndicatorKey: 'maShortExit',
          slowIndicatorKey: 'maLongExit',
          cross: 'fastBelowSlow',
        };
      }
      return {
        fastIndicatorKey: 'maShort',
        slowIndicatorKey: 'maLong',
        cross: 'fastAboveSlow',
      };
    },
  });

  registerAlias('short_ma_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortEntry'],
    mapParams() {
      return {
        fastIndicatorKey: 'maShortShortEntry',
        slowIndicatorKey: 'maLongShortEntry',
        cross: 'fastBelowSlow',
      };
    },
  });

  registerAlias('short_ema_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortEntry'],
    mapParams() {
      return {
        fastIndicatorKey: 'maShortShortEntry',
        slowIndicatorKey: 'maLongShortEntry',
        cross: 'fastBelowSlow',
      };
    },
  });

  registerAlias('cover_ma_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams() {
      return {
        fastIndicatorKey: 'maShortCover',
        slowIndicatorKey: 'maLongCover',
        cross: 'fastAboveSlow',
      };
    },
  });

  registerAlias('cover_ema_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams() {
      return {
        fastIndicatorKey: 'maShortCover',
        slowIndicatorKey: 'maLongCover',
        cross: 'fastAboveSlow',
      };
    },
  });
})(typeof self !== 'undefined' ? self : this);
