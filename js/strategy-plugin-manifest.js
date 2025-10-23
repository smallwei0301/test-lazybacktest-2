// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope || !globalScope.StrategyPluginRegistry) {
    return;
  }

  const registry = globalScope.StrategyPluginRegistry;
  if (typeof registry.registerLazyStrategy !== 'function') {
    return;
  }

  const manifestBaseUrl = (function resolveManifestBaseUrl() {
    if (typeof document !== 'undefined') {
      const current = document.currentScript;
      if (current && current.src) {
        return current.src.replace(/[^/]*$/, '');
      }
      const scripts = document.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const candidate = scripts[i];
        if (candidate && candidate.src && candidate.src.includes('strategy-plugin-manifest')) {
          return candidate.src.replace(/[^/]*$/, '');
        }
      }
      if (typeof document.baseURI === 'string') {
        try {
          return new URL('.', document.baseURI).toString();
        } catch (error) {
          // ignore and fall through
        }
      }
    }
    if (globalScope && globalScope.location && typeof globalScope.location.href === 'string') {
      return globalScope.location.href.replace(/[^/]*$/, '');
    }
    return '';
  })();

  function resolveLoaderUrl(scriptPath) {
    if (typeof scriptPath !== 'string') {
      throw new TypeError('[StrategyPluginManifest] loader 路徑必須為字串');
    }
    const trimmed = scriptPath.trim();
    if (!trimmed) {
      throw new Error('[StrategyPluginManifest] loader 路徑不可為空');
    }
    if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    if (manifestBaseUrl) {
      try {
        return new URL(trimmed, manifestBaseUrl).toString();
      } catch (error) {
        // ignore fallback below
      }
    }
    return trimmed;
  }

  function fetchScriptSynchronously(url) {
    if (!url) {
      throw new Error('[StrategyPluginManifest] 載入路徑不可為空');
    }
    if (typeof globalScope.XMLHttpRequest !== 'function') {
      throw new Error(`[StrategyPluginManifest] 此環境不支援同步載入 ${url}`);
    }
    const request = new globalScope.XMLHttpRequest();
    request.open('GET', url, false);
    try {
      request.overrideMimeType && request.overrideMimeType('application/javascript');
    } catch (overrideError) {
      // ignore override errors
    }
    try {
      request.send(null);
    } catch (networkError) {
      throw new Error(`[StrategyPluginManifest] 載入 ${url} 失敗: ${networkError && networkError.message ? networkError.message : networkError}`);
    }
    const status = request.status === 0 || (request.status >= 200 && request.status < 300);
    if (!status) {
      throw new Error(`[StrategyPluginManifest] 讀取 ${url} 失敗 (status=${request.status})`);
    }
    const response = request.responseText;
    if (typeof response !== 'string' || !response.trim()) {
      throw new Error(`[StrategyPluginManifest] ${url} 回傳空內容`);
    }
    return response;
  }

  function evaluateScriptSource(source, url) {
    const scriptSource = `${source}\n//# sourceURL=${url}`;
    const globalEval = (0, eval); // eslint-disable-line no-eval
    globalEval(scriptSource);
  }

  function createScriptLoader(scriptPath) {
    let loaded = false;
    return function load() {
      if (loaded) {
        return;
      }
      const resolvedUrl = resolveLoaderUrl(scriptPath);
      if (typeof importScripts === 'function') {
        importScripts(resolvedUrl);
        loaded = true;
        return;
      }
      try {
        const scriptContent = fetchScriptSynchronously(resolvedUrl);
        evaluateScriptSource(scriptContent, resolvedUrl);
        loaded = true;
        return;
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyPluginManifest] 載入 ${resolvedUrl} 失敗`, error);
        }
        throw error;
      }
    };
  }

  function rsiSchema(thresholdDefault) {
    return {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: 0, maximum: 100, default: thresholdDefault },
      },
      additionalProperties: true,
    };
  }

  function kdSchema(thresholdKey, thresholdDefault) {
    return {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 200, default: 9 },
        [thresholdKey]: { type: 'number', minimum: 0, maximum: 100, default: thresholdDefault },
      },
      additionalProperties: true,
    };
  }

  const maSchema = {
    type: 'object',
    properties: {
      shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 5 },
      longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
    },
    additionalProperties: true,
  };

  const bollingerSchema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      deviations: { type: 'number', minimum: 0.1, maximum: 10, default: 2 },
    },
    additionalProperties: true,
  };

  const trailingSchema = {
    type: 'object',
    properties: {
      percentage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
    },
    additionalProperties: true,
  };

  const loaders = {
    rsi: createScriptLoader('strategy-plugins/rsi.js'),
    kd: createScriptLoader('strategy-plugins/kd.js'),
    ma: createScriptLoader('strategy-plugins/ma-cross.js'),
    maThreshold: createScriptLoader('strategy-plugins/ma-threshold.js'),
    bollinger: createScriptLoader('strategy-plugins/bollinger.js'),
    trailing: createScriptLoader('strategy-plugins/atr-stop.js'),
    macd: createScriptLoader('strategy-plugins/macd.js'),
    price: createScriptLoader('strategy-plugins/price.js'),
    williams: createScriptLoader('strategy-plugins/williams.js'),
    turtle: createScriptLoader('strategy-plugins/turtle.js'),
    volume: createScriptLoader('strategy-plugins/volume.js'),
    risk: createScriptLoader('strategy-plugins/risk-managed.js'),
  };

  const maThresholdSchema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
    },
    additionalProperties: true,
  };

  const macdSchema = {
    type: 'object',
    properties: {
      shortPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 12 },
      longPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 26 },
      signalPeriod: { type: 'integer', minimum: 1, maximum: 365, default: 9 },
    },
    additionalProperties: true,
  };

  const priceSchema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
    },
    additionalProperties: true,
  };

  function williamsSchema(defaultThreshold) {
    return {
      type: 'object',
      properties: {
        period: { type: 'integer', minimum: 1, maximum: 365, default: 14 },
        threshold: { type: 'number', minimum: -100, maximum: 0, default: defaultThreshold },
      },
      additionalProperties: true,
    };
  }

  function turtleSchema(periodParam, defaultPeriod) {
    return {
      type: 'object',
      properties: {
        [periodParam]: { type: 'integer', minimum: 1, maximum: 365, default: defaultPeriod },
      },
      additionalProperties: true,
    };
  }

  const volumeSchema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 20 },
      multiplier: { type: 'number', minimum: 0, maximum: 100, default: 2 },
    },
    additionalProperties: true,
  };

  const riskSchema = {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };

  const definitions = [
    { id: 'cover_bollinger_breakout', label: '布林通道突破 (回補)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'bollinger_breakout', label: '布林通道突破', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'short_bollinger_reversal', label: '布林通道反轉 (做空)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'bollinger_reversal', label: '布林通道反轉', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'cover_fixed_stop_loss', label: '(由風險管理控制)', paramsSchema: riskSchema, loader: loaders.risk },
    { id: 'fixed_stop_loss', label: '(由風險管理控制)', paramsSchema: riskSchema, loader: loaders.risk },
    { id: 'cover_k_d_cross', label: 'KD黃金交叉 (D<X) (回補)', paramsSchema: kdSchema('thresholdX', 30), loader: loaders.kd },
    { id: 'k_d_cross', label: 'KD黃金交叉 (D<X)', paramsSchema: kdSchema('thresholdX', 30), loader: loaders.kd },
    { id: 'k_d_cross_exit', label: 'KD死亡交叉 (D>Y)', paramsSchema: kdSchema('thresholdY', 70), loader: loaders.kd },
    { id: 'short_k_d_cross', label: 'KD死亡交叉 (D>Y) (做空)', paramsSchema: kdSchema('thresholdY', 70), loader: loaders.kd },
    { id: 'cover_ma_above', label: '價格突破均線 (回補)', paramsSchema: maThresholdSchema, loader: loaders.maThreshold },
    { id: 'ma_above', label: '價格突破均線', paramsSchema: maThresholdSchema, loader: loaders.maThreshold },
    { id: 'ma_below', label: '價格跌破均線', paramsSchema: maThresholdSchema, loader: loaders.maThreshold },
    { id: 'short_ma_below', label: '價格跌破均線 (做空)', paramsSchema: maThresholdSchema, loader: loaders.maThreshold },
    { id: 'cover_ma_cross', label: '均線黃金交叉 (回補)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'ma_cross', label: '均線黃金交叉', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'ma_cross_exit', label: '均線死亡交叉', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'short_ma_cross', label: '均線死亡交叉 (做空)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'cover_price_breakout', label: '價格突破前高 (回補)', paramsSchema: priceSchema, loader: loaders.price },
    { id: 'price_breakout', label: '價格突破前高', paramsSchema: priceSchema, loader: loaders.price },
    { id: 'price_breakdown', label: '價格跌破前低', paramsSchema: priceSchema, loader: loaders.price },
    { id: 'short_price_breakdown', label: '價格跌破前低 (做空)', paramsSchema: priceSchema, loader: loaders.price },
    { id: 'cover_rsi_oversold', label: 'RSI超賣 (回補)', paramsSchema: rsiSchema(30), loader: loaders.rsi },
    { id: 'rsi_oversold', label: 'RSI超賣', paramsSchema: rsiSchema(30), loader: loaders.rsi },
    { id: 'rsi_overbought', label: 'RSI超買', paramsSchema: rsiSchema(70), loader: loaders.rsi },
    { id: 'short_rsi_overbought', label: 'RSI超買 (做空)', paramsSchema: rsiSchema(70), loader: loaders.rsi },
    { id: 'cover_trailing_stop', label: '移動停損 (%) (空單停損)', paramsSchema: trailingSchema, loader: loaders.trailing },
    { id: 'trailing_stop', label: '移動停損 (%)', paramsSchema: trailingSchema, loader: loaders.trailing },
    { id: 'cover_turtle_breakout', label: '海龜N日高 (回補)', paramsSchema: turtleSchema('breakoutPeriod', 20), loader: loaders.turtle },
    { id: 'turtle_breakout', label: '海龜突破 (僅進場)', paramsSchema: turtleSchema('breakoutPeriod', 20), loader: loaders.turtle },
    { id: 'turtle_stop_loss', label: '海龜停損 (N日低)', paramsSchema: turtleSchema('stopLossPeriod', 10), loader: loaders.turtle },
    { id: 'short_turtle_stop_loss', label: '海龜N日低 (做空)', paramsSchema: turtleSchema('stopLossPeriod', 10), loader: loaders.turtle },
    { id: 'cover_macd_cross', label: 'MACD黃金交叉 (DI版) (回補)', paramsSchema: macdSchema, loader: loaders.macd },
    { id: 'macd_cross', label: 'MACD黃金交叉 (DI版)', paramsSchema: macdSchema, loader: loaders.macd },
    { id: 'macd_cross_exit', label: 'MACD死亡交叉 (DI版)', paramsSchema: macdSchema, loader: loaders.macd },
    { id: 'short_macd_cross', label: 'MACD死亡交叉 (DI版) (做空)', paramsSchema: macdSchema, loader: loaders.macd },
    { id: 'cover_williams_oversold', label: '威廉指標超賣 (回補)', paramsSchema: williamsSchema(-80), loader: loaders.williams },
    { id: 'williams_oversold', label: '威廉指標超賣', paramsSchema: williamsSchema(-80), loader: loaders.williams },
    { id: 'williams_overbought', label: '威廉指標超買', paramsSchema: williamsSchema(-20), loader: loaders.williams },
    { id: 'short_williams_overbought', label: '威廉指標超買 (做空)', paramsSchema: williamsSchema(-20), loader: loaders.williams },
    { id: 'volume_spike', label: '成交量暴增', paramsSchema: volumeSchema, loader: loaders.volume },
  ];

  definitions.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));

  definitions.forEach((definition) => {
    try {
      if (typeof registry.hasStrategy === 'function' && registry.hasStrategy(definition.id)) {
        return;
      }
      registry.registerLazyStrategy(
        {
          id: definition.id,
          label: definition.label,
          paramsSchema: definition.paramsSchema,
        },
        definition.loader,
      );
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[StrategyPluginManifest] 無法註冊 ${definition.id}`, error);
      }
    }
  });
})(typeof self !== 'undefined' ? self : this);
