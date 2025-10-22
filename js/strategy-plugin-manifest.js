// Patch Tag: LB-PLUGIN-REGISTRY-20250720B
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope || !globalScope.StrategyPluginRegistry) {
    return;
  }

  const registry = globalScope.StrategyPluginRegistry;
  if (typeof registry.registerLazyStrategy !== 'function') {
    return;
  }

  const loadedPluginUrls = new Set();

  function computeManifestBaseUrl() {
    try {
      if (typeof document !== 'undefined') {
        const current = document.currentScript;
        if (current && current.src) {
          return new URL('.', current.src).toString();
        }
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i -= 1) {
          const candidate = scripts[i];
          if (candidate && candidate.src && candidate.src.indexOf('strategy-plugin-manifest.js') !== -1) {
            return new URL('.', candidate.src).toString();
          }
        }
      }
      if (typeof globalScope !== 'undefined' && globalScope.location && globalScope.location.href) {
        return new URL('.', globalScope.location.href).toString();
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[StrategyPluginManifest] 無法計算 base URL，改用相對路徑。', error);
      }
    }
    return '';
  }

  const manifestBaseUrl = computeManifestBaseUrl();

  function resolvePluginUrl(scriptPath) {
    if (typeof scriptPath !== 'string' || !scriptPath) {
      throw new TypeError('[StrategyPluginManifest] loader 需要有效的路徑字串');
    }
    if (/^(?:[a-z]+:)?\/\//i.test(scriptPath) || scriptPath.startsWith('data:')) {
      return scriptPath;
    }
    const base = manifestBaseUrl || (globalScope && globalScope.location ? globalScope.location.href : undefined);
    try {
      return base ? new URL(scriptPath, base).toString() : scriptPath;
    } catch (_error) {
      return scriptPath;
    }
  }

  function evaluateScriptContent(url, source) {
    const evaluator = (0, eval);
    evaluator(source + `\n//# sourceURL=${url}`);
  }

  function loadScriptInWindow(url) {
    if (typeof XMLHttpRequest === 'undefined') {
      throw new Error(`[StrategyPluginManifest] 此環境缺少 XMLHttpRequest，無法載入 ${url}`);
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      evaluateScriptContent(url, xhr.responseText || '');
      return;
    }
    throw new Error(`[StrategyPluginManifest] 載入 ${url} 失敗（HTTP ${xhr.status || '未知'}）`);
  }

  function createScriptLoader(scriptPath) {
    const resolvedUrl = resolvePluginUrl(scriptPath);
    let loaded = false;
    return function load() {
      if (loaded || loadedPluginUrls.has(resolvedUrl)) {
        loaded = true;
        return;
      }
      if (typeof importScripts === 'function') {
        importScripts(resolvedUrl);
        loaded = true;
        loadedPluginUrls.add(resolvedUrl);
        return;
      }
      loadScriptInWindow(resolvedUrl);
      loaded = true;
      loadedPluginUrls.add(resolvedUrl);
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
    bollinger: createScriptLoader('strategy-plugins/bollinger.js'),
    trailing: createScriptLoader('strategy-plugins/atr-stop.js'),
  };

  const definitions = [
    { id: 'rsi_oversold', label: 'RSI 超賣 (多頭進場)', paramsSchema: rsiSchema(30), loader: loaders.rsi },
    { id: 'rsi_overbought', label: 'RSI 超買 (多頭出場)', paramsSchema: rsiSchema(70), loader: loaders.rsi },
    { id: 'short_rsi_overbought', label: 'RSI 超買 (做空進場)', paramsSchema: rsiSchema(70), loader: loaders.rsi },
    { id: 'cover_rsi_oversold', label: 'RSI 超賣 (空單回補)', paramsSchema: rsiSchema(30), loader: loaders.rsi },
    { id: 'k_d_cross', label: 'KD 黃金交叉 (多頭)', paramsSchema: kdSchema('thresholdX', 30), loader: loaders.kd },
    { id: 'k_d_cross_exit', label: 'KD 死亡交叉 (多頭出場)', paramsSchema: kdSchema('thresholdY', 70), loader: loaders.kd },
    { id: 'short_k_d_cross', label: 'KD 死亡交叉 (做空)', paramsSchema: kdSchema('thresholdY', 70), loader: loaders.kd },
    { id: 'cover_k_d_cross', label: 'KD 黃金交叉 (空單回補)', paramsSchema: kdSchema('thresholdX', 30), loader: loaders.kd },
    { id: 'bollinger_breakout', label: '布林通道突破 (多頭進場)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'bollinger_reversal', label: '布林通道反轉 (多頭出場)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'short_bollinger_reversal', label: '布林通道反轉 (做空)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'cover_bollinger_breakout', label: '布林通道突破 (空單回補)', paramsSchema: bollingerSchema, loader: loaders.bollinger },
    { id: 'ma_cross', label: '均線交叉 (多頭)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'ema_cross', label: 'EMA 交叉 (多頭)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'short_ma_cross', label: '均線交叉 (做空)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'short_ema_cross', label: 'EMA 交叉 (做空)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'cover_ma_cross', label: '均線交叉 (空單回補)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'cover_ema_cross', label: 'EMA 交叉 (空單回補)', paramsSchema: maSchema, loader: loaders.ma },
    { id: 'trailing_stop', label: '移動停損 (%)', paramsSchema: trailingSchema, loader: loaders.trailing },
    { id: 'cover_trailing_stop', label: '移動停損 (%) (空單)', paramsSchema: trailingSchema, loader: loaders.trailing },
  ];

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
