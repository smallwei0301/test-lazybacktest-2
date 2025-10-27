// Patch Tag: LB-COMPOSER-PARAMS-20260301A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const VERSION = 'LB-COMPOSER-PARAMS-20260301A';
  const existing = globalScope.StrategyParamUtils;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= VERSION) {
    return;
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function clampNumeric(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let output = value;
    if (descriptor && descriptor.type === 'integer') {
      output = Math.round(output);
    }
    if (descriptor && Number.isFinite(descriptor.minimum)) {
      output = Math.max(descriptor.minimum, output);
    }
    if (descriptor && Number.isFinite(descriptor.maximum)) {
      output = Math.min(descriptor.maximum, output);
    }
    return output;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!schema || typeof schema !== 'object') {
      return rawParams && typeof rawParams === 'object' ? { ...rawParams } : {};
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (!descriptor || typeof descriptor !== 'object') {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    if (rawParams && typeof rawParams === 'object') {
      Object.keys(rawParams).forEach((key) => {
        const descriptor = properties[key];
        if (!descriptor || typeof descriptor !== 'object') {
          output[key] = rawParams[key];
          return;
        }
        if (descriptor.type === 'integer' || descriptor.type === 'number') {
          const numeric = toNumber(rawParams[key]);
          if (Number.isFinite(numeric)) {
            output[key] = clampNumeric(numeric, descriptor);
          }
        } else {
          output[key] = rawParams[key];
        }
      });
    }
    return output;
  }

  function resolveStrategyMeta(registry, strategyId) {
    if (!registry || typeof registry !== 'object') {
      return null;
    }
    if (typeof registry.getStrategyMetaById === 'function') {
      try {
        return registry.getStrategyMetaById(strategyId) || null;
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[StrategyParamUtils] 讀取 ${strategyId} meta 失敗`, error);
        }
      }
    }
    return null;
  }

  function buildParamsWithSchema(registry, strategyId, rawParams) {
    const meta = resolveStrategyMeta(registry, strategyId);
    if (!meta || !meta.paramsSchema) {
      return rawParams && typeof rawParams === 'object' ? { ...rawParams } : {};
    }
    return applySchemaDefaults(meta.paramsSchema, rawParams);
  }

  const api = Object.freeze({
    toNumber,
    applySchemaDefaults,
    buildParamsWithSchema,
    __version__: VERSION,
  });

  Object.defineProperty(globalScope, 'StrategyParamUtils', {
    value: api,
    writable: false,
    enumerable: true,
    configurable: false,
  });
})(typeof self !== 'undefined' ? self : this);
