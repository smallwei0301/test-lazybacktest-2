// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;

  if (!registry || typeof registry.registerStrategyLoader !== 'function') {
    return;
  }

  const loaderCache = new Map();

  function loadScriptSync(scriptPath) {
    if (typeof importScripts === 'function') {
      importScripts(scriptPath);
      return;
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      const request = new XMLHttpRequest();
      request.open('GET', scriptPath, false);
      try {
        request.send(null);
      } catch (error) {
        throw new Error(`載入 ${scriptPath} 失敗: ${error && error.message ? error.message : error}`);
      }
      if ((request.status >= 200 && request.status < 300) || request.status === 0) {
        const source = `${request.responseText}\n//# sourceURL=${scriptPath}`;
        (0, eval)(source);
        return;
      }
      throw new Error(`載入 ${scriptPath} 失敗，HTTP 狀態碼 ${request.status}`);
    }
    throw new Error(`當前環境無法載入策略腳本: ${scriptPath}`);
  }

  function getLoader(scriptPath) {
    if (loaderCache.has(scriptPath)) {
      return loaderCache.get(scriptPath);
    }
    let loaded = false;
    const loader = function strategyScriptLoader() {
      if (loaded) return null;
      loadScriptSync(scriptPath);
      loaded = true;
      return null;
    };
    loaderCache.set(scriptPath, loader);
    return loader;
  }

  function createRsiSchema(defaultThreshold) {
    return {
      type: 'object',
      properties: {
        period: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 14,
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: defaultThreshold,
        },
      },
      additionalProperties: true,
    };
  }

  function createKdSchema(thresholdKey, defaultThreshold) {
    return {
      type: 'object',
      properties: {
        period: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          default: 9,
        },
        [thresholdKey]: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: defaultThreshold,
        },
      },
      additionalProperties: true,
    };
  }

  function createMaCrossSchema() {
    return {
      type: 'object',
      properties: {
        shortPeriod: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 5,
        },
        longPeriod: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 20,
        },
      },
      additionalProperties: true,
    };
  }

  function createBollingerSchema() {
    return {
      type: 'object',
      properties: {
        period: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 20,
        },
        deviations: {
          type: 'number',
          minimum: 0.1,
          maximum: 10,
          default: 2,
        },
      },
      additionalProperties: true,
    };
  }

  function createTrailingStopSchema() {
    return {
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
    };
  }

  const entries = [
    // RSI plugins
    {
      id: 'rsi_oversold',
      label: 'RSI 超賣 (多頭進場)',
      paramsSchema: createRsiSchema(30),
      loader: getLoader('strategy-plugins/rsi.js'),
    },
    {
      id: 'rsi_overbought',
      label: 'RSI 超買 (多頭出場)',
      paramsSchema: createRsiSchema(70),
      loader: getLoader('strategy-plugins/rsi.js'),
    },
    {
      id: 'short_rsi_overbought',
      label: 'RSI 超買 (做空)',
      paramsSchema: createRsiSchema(70),
      loader: getLoader('strategy-plugins/rsi.js'),
    },
    {
      id: 'cover_rsi_oversold',
      label: 'RSI 超賣 (空單回補)',
      paramsSchema: createRsiSchema(30),
      loader: getLoader('strategy-plugins/rsi.js'),
    },

    // KD plugins
    {
      id: 'k_d_cross',
      label: 'KD 黃金交叉 (多頭)',
      paramsSchema: createKdSchema('thresholdX', 30),
      loader: getLoader('strategy-plugins/kd.js'),
    },
    {
      id: 'k_d_cross_exit',
      label: 'KD 死亡交叉 (多頭出場)',
      paramsSchema: createKdSchema('thresholdY', 70),
      loader: getLoader('strategy-plugins/kd.js'),
    },
    {
      id: 'short_k_d_cross',
      label: 'KD 死亡交叉 (做空)',
      paramsSchema: createKdSchema('thresholdY', 70),
      loader: getLoader('strategy-plugins/kd.js'),
    },
    {
      id: 'cover_k_d_cross',
      label: 'KD 黃金交叉 (空單回補)',
      paramsSchema: createKdSchema('thresholdX', 30),
      loader: getLoader('strategy-plugins/kd.js'),
    },

    // Bollinger plugins
    {
      id: 'bollinger_breakout',
      label: '布林通道突破 (多頭進場)',
      paramsSchema: createBollingerSchema(),
      loader: getLoader('strategy-plugins/bollinger.js'),
    },
    {
      id: 'bollinger_reversal',
      label: '布林通道反轉 (多頭出場)',
      paramsSchema: createBollingerSchema(),
      loader: getLoader('strategy-plugins/bollinger.js'),
    },
    {
      id: 'short_bollinger_reversal',
      label: '布林通道反轉 (做空)',
      paramsSchema: createBollingerSchema(),
      loader: getLoader('strategy-plugins/bollinger.js'),
    },
    {
      id: 'cover_bollinger_breakout',
      label: '布林通道突破 (空單回補)',
      paramsSchema: createBollingerSchema(),
      loader: getLoader('strategy-plugins/bollinger.js'),
    },

    // Moving average cross plugins
    {
      id: 'ma_cross',
      label: '均線交叉 (多頭)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },
    {
      id: 'ema_cross',
      label: 'EMA 交叉 (多頭)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },
    {
      id: 'short_ma_cross',
      label: '均線交叉 (做空)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },
    {
      id: 'short_ema_cross',
      label: 'EMA 交叉 (做空)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },
    {
      id: 'cover_ma_cross',
      label: '均線交叉 (空單回補)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },
    {
      id: 'cover_ema_cross',
      label: 'EMA 交叉 (空單回補)',
      paramsSchema: createMaCrossSchema(),
      loader: getLoader('strategy-plugins/ma-cross.js'),
    },

    // Trailing stop plugins
    {
      id: 'trailing_stop',
      label: '移動停損 (%)',
      paramsSchema: createTrailingStopSchema(),
      loader: getLoader('strategy-plugins/atr-stop.js'),
    },
    {
      id: 'cover_trailing_stop',
      label: '移動停損 (%) (空單)',
      paramsSchema: createTrailingStopSchema(),
      loader: getLoader('strategy-plugins/atr-stop.js'),
    },
  ];

  entries.forEach((entry) => {
    registry.registerStrategyLoader({
      meta: {
        id: entry.id,
        label: entry.label,
        paramsSchema: entry.paramsSchema,
      },
      loader: entry.loader,
    });
  });

  if (globalScope && typeof globalScope === 'object') {
    const catalog = entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      paramsSchema: entry.paramsSchema,
    }));
    Object.defineProperty(globalScope, 'LazybacktestStrategyCatalog', {
      value: Object.freeze(catalog),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
})(typeof self !== 'undefined' ? self : this);
