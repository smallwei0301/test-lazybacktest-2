// Patch Tag: LB-PLUGIN-REGISTRY-20250715A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const REGISTRY_VERSION = 'LB-PLUGIN-REGISTRY-20250715A';

  if (
    globalScope.StrategyPluginRegistry &&
    typeof globalScope.StrategyPluginRegistry.__version__ === 'string' &&
    globalScope.StrategyPluginRegistry.__version__ >= REGISTRY_VERSION
  ) {
    return;
  }

  const pluginMap = new Map();
  const loaderMap = new Map();

  function isPromiseLike(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
  }

  function normaliseId(id) {
    if (typeof id !== 'string') {
      return '';
    }
    return id.trim();
  }

  function ensureNonFunction(value, contextLabel) {
    if (typeof value === 'function') {
      throw new TypeError(`${contextLabel} 不可為函式`);
    }
  }

  function cloneArray(value, contextLabel) {
    if (!Array.isArray(value)) {
      throw new TypeError(`${contextLabel} 必須為陣列`);
    }
    value.forEach((item, index) => {
      ensureNonFunction(item, `${contextLabel}[${index}]`);
    });
    return Object.freeze(value.slice());
  }

  function cloneParamDescriptor(descriptor, contextLabel) {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      throw new TypeError(`${contextLabel} 必須為物件`);
    }
    const clone = {};
    Object.keys(descriptor).forEach((key) => {
      const value = descriptor[key];
      ensureNonFunction(value, `${contextLabel}.${key}`);
      if (key === 'minimum' || key === 'maximum' || key === 'exclusiveMinimum' || key === 'exclusiveMaximum' || key === 'multipleOf') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          throw new TypeError(`${contextLabel}.${key} 必須為數值`);
        }
        clone[key] = numeric;
      } else if (key === 'default') {
        if (typeof descriptor.type === 'string' && (descriptor.type === 'integer' || descriptor.type === 'number')) {
          const numericDefault = Number(value);
          if (!Number.isFinite(numericDefault)) {
            throw new TypeError(`${contextLabel}.default 必須為數值`);
          }
          clone.default = descriptor.type === 'integer' ? Math.round(numericDefault) : numericDefault;
        } else {
          clone.default = value;
        }
      } else if (key === 'enum') {
        clone.enum = cloneArray(value, `${contextLabel}.enum`);
      } else {
        clone[key] = value;
      }
    });
    return Object.freeze(clone);
  }

  function cloneParamsSchema(schema, contextLabel) {
    if (schema === undefined) {
      return undefined;
    }
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new TypeError(`${contextLabel} 必須為物件`);
    }
    const clone = {};
    const type = typeof schema.type === 'string' ? schema.type : 'object';
    if (type !== 'object') {
      throw new TypeError(`${contextLabel}.type 目前僅支援 'object'`);
    }
    clone.type = 'object';
    if ('additionalProperties' in schema) {
      if (typeof schema.additionalProperties !== 'boolean') {
        throw new TypeError(`${contextLabel}.additionalProperties 必須為布林值`);
      }
      clone.additionalProperties = schema.additionalProperties;
    }
    if ('required' in schema) {
      clone.required = cloneArray(schema.required, `${contextLabel}.required`);
    }
    const properties = schema.properties === undefined ? {} : schema.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      throw new TypeError(`${contextLabel}.properties 必須為物件`);
    }
    const clonedProps = {};
    Object.keys(properties).forEach((propKey) => {
      clonedProps[propKey] = cloneParamDescriptor(properties[propKey], `${contextLabel}.properties.${propKey}`);
    });
    clone.properties = Object.freeze(clonedProps);
    return Object.freeze(clone);
  }

  function cloneMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      throw new TypeError('StrategyPlugin meta 必須為物件');
    }
    if (typeof meta.id !== 'string' || !meta.id.trim()) {
      throw new TypeError('StrategyPlugin meta.id 必須為非空字串');
    }
    if (typeof meta.label !== 'string' || !meta.label.trim()) {
      throw new TypeError(`[${meta.id}] StrategyPlugin meta.label 必須為非空字串`);
    }
    return Object.freeze({
      id: meta.id.trim(),
      label: meta.label,
      paramsSchema: cloneParamsSchema(meta.paramsSchema, `[${meta.id}] paramsSchema`),
    });
  }

  function storePlugin(plugin, meta) {
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[${meta.id}] StrategyPlugin 必須提供 run(context, params)`);
    }
    const stored = Object.freeze({ meta, run: plugin.run });
    pluginMap.set(meta.id, stored);
    return stored;
  }

  function registerStrategy(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError('StrategyPluginRegistry.registerStrategy 需要傳入插件物件');
    }
    const meta = cloneMeta(plugin.meta);
    const id = meta.id;
    if (pluginMap.has(id)) {
      throw new Error(`[${id}] StrategyPlugin 已註冊`);
    }
    const lazyEntry = loaderMap.get(id);
    if (lazyEntry) {
      loaderMap.delete(id);
      if (lazyEntry.meta && lazyEntry.meta.label !== meta.label) {
        console.warn(`[%s] 註冊的 label (%s) 與 manifest (%s) 不一致`, id, meta.label, lazyEntry.meta.label);
      }
    }
    return storePlugin(plugin, meta);
  }

  function registerLazyStrategy(meta, loader) {
    const clonedMeta = cloneMeta(meta);
    const id = clonedMeta.id;
    if (pluginMap.has(id)) {
      throw new Error(`[${id}] 已載入 StrategyPlugin，無法再註冊 lazy loader`);
    }
    if (loaderMap.has(id)) {
      throw new Error(`[${id}] Lazy loader 已存在`);
    }
    if (typeof loader !== 'function') {
      throw new TypeError(`[${id}] registerLazyStrategy 需要提供 loader 函式`);
    }
    loaderMap.set(id, { meta: clonedMeta, loader, loading: false, promise: null });
    return clonedMeta;
  }

  function ensureStrategyLoaded(id) {
    const normalisedId = normaliseId(id);
    if (!normalisedId) {
      return null;
    }
    if (pluginMap.has(normalisedId)) {
      return pluginMap.get(normalisedId);
    }
    const lazyEntry = loaderMap.get(normalisedId);
    if (!lazyEntry) {
      return null;
    }
    if (lazyEntry.loading) {
      if (lazyEntry.promise) {
        return null;
      }
      throw new Error(`[${normalisedId}] Lazy loader 正在載入，請避免循環呼叫`);
    }
    lazyEntry.loading = true;
    let loadResult;
    try {
      loadResult = lazyEntry.loader({ id: normalisedId, meta: lazyEntry.meta });
    } catch (error) {
      lazyEntry.loading = false;
      throw error;
    }
    if (isPromiseLike(loadResult)) {
      const promise = Promise.resolve(loadResult)
        .then(() => {
          lazyEntry.loading = false;
          return pluginMap.get(normalisedId) || null;
        })
        .catch((error) => {
          lazyEntry.loading = false;
          if (lazyEntry.promise === promise) {
            lazyEntry.promise = null;
          }
          throw error;
        });
      lazyEntry.promise = promise;
    } else {
      lazyEntry.loading = false;
    }
    if (pluginMap.has(normalisedId)) {
      return pluginMap.get(normalisedId);
    }
    return null;
  }

  function loadStrategyById(id, options) {
    const normalisedId = normaliseId(id);
    if (!normalisedId) {
      return Promise.reject(new Error('StrategyPlugin id 無效'));
    }
    if (pluginMap.has(normalisedId)) {
      return Promise.resolve(pluginMap.get(normalisedId));
    }
    const lazyEntry = loaderMap.get(normalisedId);
    if (!lazyEntry) {
      return Promise.resolve(null);
    }
    if (lazyEntry.promise) {
      return lazyEntry.promise;
    }
    if (lazyEntry.loading) {
      return new Promise((resolve, reject) => {
        const waitForCompletion = () => {
          if (pluginMap.has(normalisedId)) {
            resolve(pluginMap.get(normalisedId));
            return;
          }
          if (!lazyEntry.loading && !lazyEntry.promise) {
            resolve(null);
          } else {
            (lazyEntry.promise || Promise.resolve()).then(resolve, reject);
          }
        };
        if (lazyEntry.promise) {
          lazyEntry.promise.then(resolve, reject);
        } else {
          setTimeout(waitForCompletion, Number.isFinite(options?.pollIntervalMs) ? Math.max(0, options.pollIntervalMs) : 30);
        }
      });
    }
    lazyEntry.loading = true;
    let loadResult;
    try {
      loadResult = lazyEntry.loader({ id: normalisedId, meta: lazyEntry.meta });
    } catch (error) {
      lazyEntry.loading = false;
      return Promise.reject(error);
    }
    if (!isPromiseLike(loadResult)) {
      lazyEntry.loading = false;
      if (pluginMap.has(normalisedId)) {
        return Promise.resolve(pluginMap.get(normalisedId));
      }
      return Promise.reject(new Error(`[${normalisedId}] Lazy loader 未註冊策略`));
    }
    const promise = Promise.resolve(loadResult)
      .then(() => {
        lazyEntry.loading = false;
        if (pluginMap.has(normalisedId)) {
          return pluginMap.get(normalisedId);
        }
        throw new Error(`[${normalisedId}] Lazy loader 已完成但尚未註冊策略`);
      })
      .catch((error) => {
        lazyEntry.loading = false;
        if (lazyEntry.promise === promise) {
          lazyEntry.promise = null;
        }
        throw error;
      });
    lazyEntry.promise = promise;
    return promise;
  }

  function getStrategyMetaById(id) {
    const normalisedId = normaliseId(id);
    if (!normalisedId) {
      return null;
    }
    if (pluginMap.has(normalisedId)) {
      return pluginMap.get(normalisedId).meta;
    }
    const lazyEntry = loaderMap.get(normalisedId);
    return lazyEntry ? lazyEntry.meta : null;
  }

  function getStrategyById(id, options) {
    const normalisedId = normaliseId(id);
    if (!normalisedId) {
      return null;
    }
    if (pluginMap.has(normalisedId)) {
      return pluginMap.get(normalisedId);
    }
    if (options && options.loadIfNeeded === false) {
      return null;
    }
    return ensureStrategyLoaded(normalisedId);
  }

  function hasStrategy(id) {
    const normalisedId = normaliseId(id);
    if (!normalisedId) {
      return false;
    }
    return pluginMap.has(normalisedId) || loaderMap.has(normalisedId);
  }

  function listStrategies(options) {
    const includeLazy = !options || options.includeLazy !== false;
    const metas = [];
    pluginMap.forEach((entry) => {
      metas.push(entry.meta);
    });
    if (includeLazy) {
      loaderMap.forEach((entry) => {
        metas.push(entry.meta);
      });
    }
    return metas.slice().sort((a, b) => a.id.localeCompare(b.id));
  }

  const registry = {
    registerStrategy,
    register(plugin) {
      return registerStrategy(plugin);
    },
    registerLazyStrategy,
    getStrategyById,
    get(id, options) {
      return getStrategyById(id, options);
    },
    ensureStrategyLoaded,
    getStrategyMetaById,
    hasStrategy,
    has(id) {
      return hasStrategy(id);
    },
    listStrategies,
    list(options) {
      return listStrategies(options);
    },
    loadStrategyById,
    load(id, options) {
      return loadStrategyById(id, options);
    },
    __version__: REGISTRY_VERSION,
  };

  Object.freeze(registry);

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: registry,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
