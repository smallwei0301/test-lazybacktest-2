// Patch Tag: LB-PLUGIN-ATOMS-20250710A — Bollinger band crossover plugin.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    console.warn('[BollingerBandPlugin] 缺少 StrategyPluginContract 或 Registry，略過註冊。');
    return;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  const meta = {
    id: 'bollinger-band-v1',
    label: '布林帶價格交叉',
    paramsSchema: {
      type: 'object',
      properties: {
        bandIndicatorKey: { type: 'string', description: '布林帶指標鍵值' },
        comparison: {
          type: 'string',
          enum: ['priceCrossAbove', 'priceCrossBelow'],
          default: 'priceCrossAbove',
          description: '收盤價與布林帶的交叉方向',
        },
        priceSeries: {
          type: 'string',
          enum: ['close'],
          default: 'close',
        },
      },
      required: ['bandIndicatorKey'],
      additionalProperties: true,
    },
  };

  const plugin = contract.createLegacyStrategyPlugin(meta, (context, params) => {
    const bandKey = typeof params?.bandIndicatorKey === 'string' ? params.bandIndicatorKey : '';
    const comparison =
      params?.comparison === 'priceCrossBelow' ? 'priceCrossBelow' : 'priceCrossAbove';
    const priceSeriesKey = params?.priceSeries === 'close' ? 'close' : 'close';

    const bandSeries = context.helpers.getIndicator(bandKey) || [];
    const priceSeries = context.series?.[priceSeriesKey] || [];
    const idx = context.index;
    const price = Array.isArray(priceSeries) ? priceSeries[idx] : null;
    const prevPrice = idx > 0 && Array.isArray(priceSeries) ? priceSeries[idx - 1] : null;
    const band = Array.isArray(bandSeries) ? bandSeries[idx] : null;
    const prevBand = idx > 0 && Array.isArray(bandSeries) ? bandSeries[idx - 1] : null;

    const validPrice = isFiniteNumber(price);
    const validPrevPrice = isFiniteNumber(prevPrice);
    const validBand = isFiniteNumber(band);
    const validPrevBand = isFiniteNumber(prevBand);

    let crossed = false;
    if (comparison === 'priceCrossAbove') {
      crossed =
        validPrice &&
        validPrevPrice &&
        validBand &&
        validPrevBand &&
        price > band &&
        prevPrice <= prevBand;
    } else {
      crossed =
        validPrice &&
        validPrevPrice &&
        validBand &&
        validPrevBand &&
        price < band &&
        prevPrice >= prevBand;
    }

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      meta: {
        bandIndicatorKey: bandKey,
        comparison,
        priceSeries: priceSeriesKey,
        price: validPrice ? price : null,
        previousPrice: validPrevPrice ? prevPrice : null,
        band,
        previousBand: validPrevBand ? prevBand : null,
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

  registerAlias('bollinger_breakout', {
    pluginId: plugin.meta.id,
    roles: ['longEntry'],
    mapParams() {
      return {
        bandIndicatorKey: 'bollingerUpperEntry',
        comparison: 'priceCrossAbove',
        priceSeries: 'close',
      };
    },
  });

  registerAlias('bollinger_reversal', {
    pluginId: plugin.meta.id,
    roles: ['longExit'],
    mapParams() {
      return {
        bandIndicatorKey: 'bollingerMiddleExit',
        comparison: 'priceCrossBelow',
        priceSeries: 'close',
      };
    },
  });

  registerAlias('short_bollinger_reversal', {
    pluginId: plugin.meta.id,
    roles: ['shortEntry'],
    mapParams() {
      return {
        bandIndicatorKey: 'bollingerMiddleShortEntry',
        comparison: 'priceCrossBelow',
        priceSeries: 'close',
      };
    },
  });

  registerAlias('cover_bollinger_breakout', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams() {
      return {
        bandIndicatorKey: 'bollingerUpperCover',
        comparison: 'priceCrossAbove',
        priceSeries: 'close',
      };
    },
  });
})(typeof self !== 'undefined' ? self : this);
