// Patch Tag: LB-PLUGIN-ATOMS-20250710A — RSI threshold crossover plugin.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    console.warn('[RSIThresholdPlugin] 缺少 StrategyPluginContract 或 Registry，略過註冊。');
    return;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  const meta = {
    id: 'rsi-threshold-v1',
    label: 'RSI 門檻交叉',
    paramsSchema: {
      type: 'object',
      properties: {
        indicatorKey: { type: 'string', description: 'RSI 指標鍵值' },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: 50,
          description: '觸發交叉的 RSI 門檻值',
        },
        cross: {
          type: 'string',
          enum: ['above', 'below'],
          default: 'above',
          description: '判斷 RSI 穿越門檻方向',
        },
      },
      required: ['indicatorKey'],
      additionalProperties: true,
    },
  };

  const plugin = contract.createLegacyStrategyPlugin(meta, (context, params) => {
    const indicatorKey = typeof params?.indicatorKey === 'string' ? params.indicatorKey : '';
    const thresholdRaw = Number(params?.threshold);
    const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 50;
    const cross = params?.cross === 'below' ? 'below' : 'above';

    const series = context.helpers.getIndicator(indicatorKey) || [];
    const idx = context.index;
    const current = Array.isArray(series) ? series[idx] : null;
    const previous = idx > 0 && Array.isArray(series) ? series[idx - 1] : null;
    const validCurrent = isFiniteNumber(current);
    const validPrevious = isFiniteNumber(previous);

    let crossed = false;
    if (cross === 'above') {
      crossed =
        validCurrent &&
        validPrevious &&
        current > threshold &&
        previous <= threshold;
    } else {
      crossed =
        validCurrent &&
        validPrevious &&
        current < threshold &&
        previous >= threshold;
    }

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      meta: {
        indicatorKey,
        threshold,
        cross,
        current: validCurrent ? current : null,
        previous: validPrevious ? previous : null,
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

  registerAlias('rsi_oversold', {
    pluginId: plugin.meta.id,
    roles: ['longEntry'],
    mapParams(userParams) {
      const thresholdRaw = Number(userParams?.threshold);
      return {
        indicatorKey: 'rsiEntry',
        threshold: Number.isFinite(thresholdRaw) ? thresholdRaw : 30,
        cross: 'above',
      };
    },
  });

  registerAlias('rsi_overbought', {
    pluginId: plugin.meta.id,
    roles: ['longExit'],
    mapParams(userParams) {
      const thresholdRaw = Number(userParams?.threshold);
      return {
        indicatorKey: 'rsiExit',
        threshold: Number.isFinite(thresholdRaw) ? thresholdRaw : 70,
        cross: 'below',
      };
    },
  });

  registerAlias('short_rsi_overbought', {
    pluginId: plugin.meta.id,
    roles: ['shortEntry'],
    mapParams(userParams) {
      const thresholdRaw = Number(userParams?.threshold);
      return {
        indicatorKey: 'rsiShortEntry',
        threshold: Number.isFinite(thresholdRaw) ? thresholdRaw : 70,
        cross: 'below',
      };
    },
  });

  registerAlias('cover_rsi_oversold', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams(userParams) {
      const thresholdRaw = Number(userParams?.threshold);
      return {
        indicatorKey: 'rsiCover',
        threshold: Number.isFinite(thresholdRaw) ? thresholdRaw : 30,
        cross: 'above',
      };
    },
  });
})(typeof self !== 'undefined' ? self : this);
