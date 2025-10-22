// Patch Tag: LB-PLUGIN-EXTENDED-20250724A
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

  function getSeriesTriplet(series, index) {
    if (!Array.isArray(series)) {
      return { prev: null, current: null, next: null };
    }
    return {
      prev: index > 0 ? toFinite(series[index - 1]) : null,
      current: toFinite(series[index]),
      next: index + 1 < series.length ? toFinite(series[index + 1]) : null,
    };
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
      paramsSchema: config.paramsSchema || {
        type: 'object',
        additionalProperties: true,
      },
    };
  }

  function registerSimplePlugin(config) {
    const meta = getMeta(config);
    const handlers = config.handlers || {};
    const plugin = createLegacyStrategyPlugin(meta, (context, params) => {
      const idx = Number(context?.index) || 0;
      const role = context?.role;
      const handler = handlers[role];
      const base = { enter: false, exit: false, short: false, cover: false, meta: {} };
      if (!handler || typeof handler.evaluate !== 'function') {
        return base;
      }
      const evaluation = handler.evaluate({
        context,
        params: params || {},
        index: idx,
      });
      if (!evaluation || typeof evaluation !== 'object') {
        return base;
      }
      const triggered = evaluation.triggered === true;
      base[handler.field] = triggered;
      if (triggered && evaluation.meta && typeof evaluation.meta === 'object') {
        base.meta = evaluation.meta;
      }
      return base;
    });

    registry.registerStrategy(plugin);
  }

  function getCloses(context) {
    const series = context?.series?.close;
    return Array.isArray(series) ? series : [];
  }

  function getVolumes(context) {
    const series = context?.series?.volume;
    return Array.isArray(series) ? series : [];
  }

  function getHighs(context) {
    const series = context?.series?.high;
    return Array.isArray(series) ? series : [];
  }

  function getLows(context) {
    const series = context?.series?.low;
    return Array.isArray(series) ? series : [];
  }

  function computeRollingExtreme(series, endIndex, period, mode) {
    if (!Array.isArray(series) || !Number.isFinite(endIndex) || period <= 0) {
      return null;
    }
    if (endIndex < period) {
      return null;
    }
    const start = endIndex - period;
    let candidate = null;
    for (let i = start; i < endIndex; i += 1) {
      const value = toFinite(series[i]);
      if (value === null) continue;
      if (candidate === null) {
        candidate = value;
      } else if (mode === 'max') {
        candidate = Math.max(candidate, value);
      } else if (mode === 'min') {
        candidate = Math.min(candidate, value);
      }
    }
    return candidate;
  }

  function clampThreshold(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(value, min), max);
  }

  registerSimplePlugin({
    id: 'ma_above',
    label: '價格突破均線',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longEntry: {
        field: 'enter',
        evaluate: ({ context, index }) => {
          const closes = getCloses(context);
          const maSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('maExit')
            : undefined;
          const closeSnap = getSeriesTriplet(closes, index);
          const maSnap = getSeriesTriplet(maSeries, index);
          const triggered =
            closeSnap.current !== null &&
            closeSnap.prev !== null &&
            maSnap.current !== null &&
            maSnap.prev !== null &&
            closeSnap.current > maSnap.current &&
            closeSnap.prev <= maSnap.prev;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    SMA: [maSnap.prev, maSnap.current, maSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'ma_below',
    label: '價格跌破均線',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longExit: {
        field: 'exit',
        evaluate: ({ context, index }) => {
          const closes = getCloses(context);
          const maSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('maExit')
            : undefined;
          const closeSnap = getSeriesTriplet(closes, index);
          const maSnap = getSeriesTriplet(maSeries, index);
          const triggered =
            closeSnap.current !== null &&
            closeSnap.prev !== null &&
            maSnap.current !== null &&
            maSnap.prev !== null &&
            closeSnap.current < maSnap.current &&
            closeSnap.prev >= maSnap.prev;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    SMA: [maSnap.prev, maSnap.current, maSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'short_ma_below',
    label: '價格跌破均線 (做空)',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortEntry: {
        field: 'short',
        evaluate: ({ context, index }) => {
          const closes = getCloses(context);
          const maSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('maExit')
            : undefined;
          const closeSnap = getSeriesTriplet(closes, index);
          const maSnap = getSeriesTriplet(maSeries, index);
          const triggered =
            closeSnap.current !== null &&
            closeSnap.prev !== null &&
            maSnap.current !== null &&
            maSnap.prev !== null &&
            closeSnap.current < maSnap.current &&
            closeSnap.prev >= maSnap.prev;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    SMA: [maSnap.prev, maSnap.current, maSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'cover_ma_above',
    label: '價格突破均線 (回補)',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortExit: {
        field: 'cover',
        evaluate: ({ context, index }) => {
          const closes = getCloses(context);
          const maSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('maExit')
            : undefined;
          const closeSnap = getSeriesTriplet(closes, index);
          const maSnap = getSeriesTriplet(maSeries, index);
          const triggered =
            closeSnap.current !== null &&
            closeSnap.prev !== null &&
            maSnap.current !== null &&
            maSnap.prev !== null &&
            closeSnap.current > maSnap.current &&
            closeSnap.prev <= maSnap.prev;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    SMA: [maSnap.prev, maSnap.current, maSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'volume_spike',
    label: '成交量暴增',
    paramsSchema: {
      type: 'object',
      properties: {
        multiplier: { type: 'number', minimum: 0, maximum: 20, default: 2 },
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longEntry: {
        field: 'enter',
        evaluate: ({ context, params, index }) => {
          const volumes = getVolumes(context);
          const avgSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('volumeAvgEntry')
            : undefined;
          const avgSnap = getSeriesTriplet(avgSeries, index);
          const volumeSnap = getSeriesTriplet(volumes, index);
          const multiplier = Number(params?.multiplier) || 2;
          const triggered =
            volumeSnap.current !== null &&
            avgSnap.current !== null &&
            multiplier > 0 &&
            volumeSnap.current > avgSnap.current * multiplier;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    成交量: [volumeSnap.prev, volumeSnap.current, volumeSnap.next],
                    均量: [avgSnap.prev, avgSnap.current, avgSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
      longExit: {
        field: 'exit',
        evaluate: ({ context, params, index }) => {
          const volumes = getVolumes(context);
          const avgSeries = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('volumeAvgEntry')
            : undefined;
          const avgSnap = getSeriesTriplet(avgSeries, index);
          const volumeSnap = getSeriesTriplet(volumes, index);
          const multiplier = Number(params?.multiplier) || 2;
          const triggered =
            volumeSnap.current !== null &&
            avgSnap.current !== null &&
            multiplier > 0 &&
            volumeSnap.current > avgSnap.current * multiplier;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    成交量: [volumeSnap.prev, volumeSnap.current, volumeSnap.next],
                    均量: [avgSnap.prev, avgSnap.current, avgSnap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'price_breakout',
    label: '價格突破前高',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longEntry: {
        field: 'enter',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const highs = getHighs(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.period) || 20);
          const periodHigh = computeRollingExtreme(highs, index, period, 'max');
          const triggered =
            closeSnap.current !== null &&
            periodHigh !== null &&
            closeSnap.current > periodHigh;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    前高: [null, periodHigh, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'price_breakdown',
    label: '價格跌破前低',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longExit: {
        field: 'exit',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const lows = getLows(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.period) || 20);
          const periodLow = computeRollingExtreme(lows, index, period, 'min');
          const triggered =
            closeSnap.current !== null &&
            periodLow !== null &&
            closeSnap.current < periodLow;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    前低: [null, periodLow, null],
                  },
                }
              : undefined,
          };
        },
      },
      shortEntry: {
        field: 'short',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const lows = getLows(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.period) || 20);
          const periodLow = computeRollingExtreme(lows, index, period, 'min');
          const triggered =
            closeSnap.current !== null &&
            periodLow !== null &&
            closeSnap.current < periodLow;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    前低: [null, periodLow, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'cover_price_breakout',
    label: '價格突破前高 (回補)',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortExit: {
        field: 'cover',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const highs = getHighs(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.period) || 20);
          const periodHigh = computeRollingExtreme(highs, index, period, 'max');
          const triggered =
            closeSnap.current !== null &&
            periodHigh !== null &&
            closeSnap.current > periodHigh;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    前高: [null, periodHigh, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'williams_oversold',
    label: '威廉指標超賣',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: -100, maximum: 0, default: -80 },
      },
      additionalProperties: true,
    },
    handlers: {
      longEntry: {
        field: 'enter',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsEntry')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -80);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current > threshold &&
            snap.prev <= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
      shortExit: {
        field: 'cover',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsCover')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -80);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current > threshold &&
            snap.prev <= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'williams_overbought',
    label: '威廉指標超買',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: -100, maximum: 0, default: -20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longExit: {
        field: 'exit',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsExit')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -20);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current < threshold &&
            snap.prev >= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
      shortEntry: {
        field: 'short',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsShortEntry')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -20);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current < threshold &&
            snap.prev >= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'short_williams_overbought',
    label: '威廉指標超買 (做空)',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: -100, maximum: 0, default: -20 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortEntry: {
        field: 'short',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsShortEntry')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -20);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current < threshold &&
            snap.prev >= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'cover_williams_oversold',
    label: '威廉指標超賣 (回補)',
    paramsSchema: {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: -100, maximum: 0, default: -80 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortExit: {
        field: 'cover',
        evaluate: ({ context, params, index }) => {
          const indicator = context?.helpers?.getIndicator
            ? context.helpers.getIndicator('williamsCover')
            : undefined;
          const snap = getSeriesTriplet(indicator, index);
          const threshold = clampThreshold(Number(params?.threshold), -100, 0, -80);
          const triggered =
            snap.current !== null &&
            snap.prev !== null &&
            snap.current > threshold &&
            snap.prev <= threshold;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    '%R': [snap.prev, snap.current, snap.next],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'turtle_breakout',
    label: '海龜突破 (僅進場)',
    paramsSchema: {
      type: 'object',
      properties: {
        breakoutPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      longEntry: {
        field: 'enter',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const highs = getHighs(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.breakoutPeriod) || 20);
          const periodHigh = computeRollingExtreme(highs, index, period, 'max');
          const triggered =
            closeSnap.current !== null &&
            periodHigh !== null &&
            closeSnap.current > periodHigh;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    N日高: [null, periodHigh, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'turtle_stop_loss',
    label: '海龜停損 (N日低)',
    paramsSchema: {
      type: 'object',
      properties: {
        stopLossPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 10 },
      },
      additionalProperties: true,
    },
    handlers: {
      longExit: {
        field: 'exit',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const lows = getLows(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.stopLossPeriod) || 10);
          const periodLow = computeRollingExtreme(lows, index, period, 'min');
          const triggered =
            closeSnap.current !== null &&
            periodLow !== null &&
            closeSnap.current < periodLow;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    N日低: [null, periodLow, null],
                  },
                }
              : undefined,
          };
        },
      },
      shortEntry: {
        field: 'short',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const lows = getLows(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.stopLossPeriod) || 10);
          const periodLow = computeRollingExtreme(lows, index, period, 'min');
          const triggered =
            closeSnap.current !== null &&
            periodLow !== null &&
            closeSnap.current < periodLow;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    N日低: [null, periodLow, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'short_turtle_stop_loss',
    label: '海龜N日低 (做空)',
    paramsSchema: {
      type: 'object',
      properties: {
        stopLossPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 10 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortEntry: {
        field: 'short',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const lows = getLows(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.stopLossPeriod) || 10);
          const periodLow = computeRollingExtreme(lows, index, period, 'min');
          const triggered =
            closeSnap.current !== null &&
            periodLow !== null &&
            closeSnap.current < periodLow;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    N日低: [null, periodLow, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });

  registerSimplePlugin({
    id: 'cover_turtle_breakout',
    label: '海龜N日高 (回補)',
    paramsSchema: {
      type: 'object',
      properties: {
        breakoutPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      },
      additionalProperties: true,
    },
    handlers: {
      shortExit: {
        field: 'cover',
        evaluate: ({ context, params, index }) => {
          const closes = getCloses(context);
          const highs = getHighs(context);
          const closeSnap = getSeriesTriplet(closes, index);
          const period = Math.max(1, Number(params?.breakoutPeriod) || 20);
          const periodHigh = computeRollingExtreme(highs, index, period, 'max');
          const triggered =
            closeSnap.current !== null &&
            periodHigh !== null &&
            closeSnap.current > periodHigh;
          return {
            triggered,
            meta: triggered
              ? {
                  indicatorValues: {
                    收盤價: [closeSnap.prev, closeSnap.current, closeSnap.next],
                    N日高: [null, periodHigh, null],
                  },
                }
              : undefined,
          };
        },
      },
    },
  });
})(typeof self !== 'undefined' ? self : this);

