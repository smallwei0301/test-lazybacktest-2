// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope || !globalScope.StrategyPluginRegistry) {
    return;
  }

  const registry = globalScope.StrategyPluginRegistry;
  if (typeof registry.registerLazyStrategy !== 'function') {
    return;
  }

  function createScriptLoader(scriptPath) {
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
      throw new Error(`[StrategyPluginManifest] 無法於此環境載入 ${scriptPath}`);
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
