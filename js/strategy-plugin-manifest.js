// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;

  if (!registry || typeof registry.registerStrategy !== 'function') {
    return;
  }

  function createGroupLoader(scriptPath) {
    let loaded = false;
    return function load() {
      if (loaded) {
        return;
      }
      if (typeof importScripts === 'function') {
        importScripts(scriptPath);
        loaded = true;
        return;
      }
      throw new Error(`StrategyPlugin loader 僅支援 Worker 環境 (${scriptPath})`);
    };
  }

  const groups = [
    {
      loader: createGroupLoader('strategy-plugins/rsi.js'),
      strategies: [
        {
          id: 'rsi_oversold',
          label: 'RSI 超賣 (多頭進場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
              threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'rsi_overbought',
          label: 'RSI 超買 (多頭出場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
              threshold: { type: 'number', minimum: 0, maximum: 100, default: 70 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'short_rsi_overbought',
          label: 'RSI 超買 (做空進場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
              threshold: { type: 'number', minimum: 0, maximum: 100, default: 70 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_rsi_oversold',
          label: 'RSI 超賣 (空單回補)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
              threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
            },
            additionalProperties: true,
          },
        },
      ],
    },
    {
      loader: createGroupLoader('strategy-plugins/kd.js'),
      strategies: [
        {
          id: 'k_d_cross',
          label: 'KD 黃金交叉 (多頭)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 200, default: 9 },
              thresholdX: { type: 'number', minimum: 0, maximum: 100, default: 30 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'k_d_cross_exit',
          label: 'KD 死亡交叉 (多頭出場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 200, default: 9 },
              thresholdY: { type: 'number', minimum: 0, maximum: 100, default: 70 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'short_k_d_cross',
          label: 'KD 死亡交叉 (做空)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 200, default: 9 },
              thresholdY: { type: 'number', minimum: 0, maximum: 100, default: 70 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_k_d_cross',
          label: 'KD 黃金交叉 (空單回補)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 200, default: 9 },
              thresholdX: { type: 'number', minimum: 0, maximum: 100, default: 30 },
            },
            additionalProperties: true,
          },
        },
      ],
    },
    {
      loader: createGroupLoader('strategy-plugins/bollinger.js'),
      strategies: [
        {
          id: 'bollinger_breakout',
          label: '布林通道突破 (多頭進場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
              deviations: { type: 'number', minimum: 0.1, maximum: 10, default: 2 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'bollinger_reversal',
          label: '布林通道反轉 (多頭出場)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
              deviations: { type: 'number', minimum: 0.1, maximum: 10, default: 2 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'short_bollinger_reversal',
          label: '布林通道反轉 (做空)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
              deviations: { type: 'number', minimum: 0.1, maximum: 10, default: 2 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_bollinger_breakout',
          label: '布林通道突破 (空單回補)',
          paramsSchema: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
              deviations: { type: 'number', minimum: 0.1, maximum: 10, default: 2 },
            },
            additionalProperties: true,
          },
        },
      ],
    },
    {
      loader: createGroupLoader('strategy-plugins/ma-cross.js'),
      strategies: [
        {
          id: 'ma_cross',
          label: '均線交叉 (多頭)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'ema_cross',
          label: 'EMA 交叉 (多頭)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'short_ma_cross',
          label: '均線交叉 (做空)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'short_ema_cross',
          label: 'EMA 交叉 (做空)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_ma_cross',
          label: '均線交叉 (空單回補)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_ema_cross',
          label: 'EMA 交叉 (空單回補)',
          paramsSchema: {
            type: 'object',
            properties: {
              shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
              longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
            },
            additionalProperties: true,
          },
        },
      ],
    },
    {
      loader: createGroupLoader('strategy-plugins/atr-stop.js'),
      strategies: [
        {
          id: 'trailing_stop',
          label: '移動停損 (%)',
          paramsSchema: {
            type: 'object',
            properties: {
              percentage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'cover_trailing_stop',
          label: '移動停損 (%) (空單)',
          paramsSchema: {
            type: 'object',
            properties: {
              percentage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
            },
            additionalProperties: true,
          },
        },
      ],
    },
  ];

  groups.forEach((group) => {
    group.strategies.forEach((meta) => {
      registry.registerStrategy({
        meta,
        loader: group.loader,
      });
    });
  });
})(typeof self !== 'undefined' ? self : this);
