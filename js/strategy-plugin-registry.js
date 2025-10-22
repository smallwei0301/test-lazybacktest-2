// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);

  const pluginMap = new Map();
  const loaderMap = new Map();
  const metaMap = new Map();

  function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function ensureNoFunctionInSchema(value, path) {
    if (value === null || value === undefined) {
      return;
    }
    const valueType = typeof value;
    if (valueType === 'function') {
      throw new TypeError(`${path} 不可包含函式`);
    }
    if (valueType === 'object') {
      if (!isPlainObject(value) && !Array.isArray(value)) {
        throw new TypeError(`${path} 僅接受一般物件或陣列`);
      }
      const entries = Array.isArray(value)
        ? value.map((item, index) => [index, item])
        : Object.entries(value);
      entries.forEach(([key, child]) => {
        ensureNoFunctionInSchema(child, `${path}.${key}`);
      });
    }
  }

  function deepFreeze(value) {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => deepFreeze(item)));
    }
    if (isPlainObject(value)) {
      const clone = {};
      Object.keys(value).forEach((key) => {
        clone[key] = deepFreeze(value[key]);
      });
      return Object.freeze(clone);
    }
    return value;
  }

  function stableStringify(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'number' && Number.isNaN(value)) {
      return 'NaN';
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (isPlainObject(value)) {
      const keys = Object.keys(value).sort();
      return `{${keys
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function schemasEqual(a, b) {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    return stableStringify(a) === stableStringify(b);
  }

  function prepareMeta(meta, source) {
    if (!meta || typeof meta !== 'object') {
      throw new TypeError(`${source} 需要傳入 meta 物件`);
    }
    const id = typeof meta.id === 'string' ? meta.id.trim() : '';
    if (!id) {
      throw new TypeError(`${source} 的 meta.id 必須為非空字串`);
    }
    const label = typeof meta.label === 'string' ? meta.label.trim() : '';
    if (!label) {
      throw new TypeError(`[${id}] meta.label 必須為非空字串`);
    }
    if (meta.paramsSchema !== undefined) {
      if (!isPlainObject(meta.paramsSchema)) {
        throw new TypeError(`[${id}] paramsSchema 必須為物件`);
      }
      ensureNoFunctionInSchema(meta.paramsSchema, `${id}.paramsSchema`);
    }

    const canonical = {
      id,
      label,
    };
    if (meta.paramsSchema !== undefined) {
      canonical.paramsSchema = deepFreeze(meta.paramsSchema);
    }

    const frozen = Object.freeze(canonical);
    const existing = metaMap.get(id);
    if (existing) {
      if (existing.label !== frozen.label) {
        throw new Error(`[${id}] 已註冊的 meta.label 與 ${source} 不一致`);
      }
      if (!schemasEqual(existing.paramsSchema, frozen.paramsSchema)) {
        throw new Error(`[${id}] paramsSchema 與 ${source} 提供的內容不一致`);
      }
      return existing;
    }
    metaMap.set(id, frozen);
    return frozen;
  }

  function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError('StrategyPlugin 必須為物件');
    }
    const meta = prepareMeta(plugin.meta, 'registerStrategy');
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[${meta.id}] StrategyPlugin 必須提供 run(context, params)`);
    }
    return meta;
  }

  function registerStrategy(plugin) {
    const meta = validatePlugin(plugin);
    const id = meta.id;
    if (pluginMap.has(id)) {
      throw new Error(`[${id}] StrategyPlugin 已註冊`);
    }
    const stored = Object.freeze({ meta, run: plugin.run });
    pluginMap.set(id, stored);
    const loaderEntry = loaderMap.get(id);
    if (loaderEntry) {
      loaderEntry.loaded = true;
    }
    return stored;
  }

  function validateLoaderEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      throw new TypeError('registerStrategyLoader 需要傳入物件參數');
    }
    if (typeof entry.loader !== 'function') {
      throw new TypeError('registerStrategyLoader 需要提供 loader 函式');
    }
    const meta = prepareMeta(entry.meta, 'registerStrategyLoader');
    if (pluginMap.has(meta.id)) {
      throw new Error(`[${meta.id}] 已載入策略，無法再次註冊 loader`);
    }
    const existingLoader = loaderMap.get(meta.id);
    if (existingLoader && existingLoader.loader !== entry.loader) {
      throw new Error(`[${meta.id}] 已存在其他 loader`);
    }
    return { meta, loader: entry.loader };
  }

  function registerStrategyLoader(entry) {
    const { meta, loader } = validateLoaderEntry(entry);
    loaderMap.set(meta.id, {
      loader,
      loaded: false,
      loading: false,
      lastError: null,
    });
    return meta;
  }

  function ensureStrategyLoaded(id) {
    if (typeof id !== 'string') return null;
    const trimmedId = id.trim();
    if (!trimmedId) return null;
    if (pluginMap.has(trimmedId)) {
      return pluginMap.get(trimmedId);
    }
    const loaderEntry = loaderMap.get(trimmedId);
    if (!loaderEntry) {
      return null;
    }
    if (loaderEntry.loading) {
      return pluginMap.get(trimmedId) || null;
    }
    loaderEntry.loading = true;
    loaderEntry.lastError = null;
    try {
      const maybePlugin = loaderEntry.loader();
      if (
        maybePlugin &&
        typeof maybePlugin === 'object' &&
        maybePlugin.meta &&
        typeof maybePlugin.run === 'function'
      ) {
        registerStrategy(maybePlugin);
      }
    } catch (error) {
      loaderEntry.lastError = error;
      throw error;
    } finally {
      loaderEntry.loading = false;
      loaderEntry.loaded = pluginMap.has(trimmedId);
    }
    return pluginMap.get(trimmedId) || null;
  }

  function getStrategyById(id) {
    return ensureStrategyLoaded(id);
  }

  function listStrategies(options = {}) {
    const includeStatus = options.includeStatus !== false;
    return Array.from(metaMap.values()).map((meta) => {
      if (!includeStatus) {
        return meta;
      }
      const loaderEntry = loaderMap.get(meta.id) || null;
      return {
        id: meta.id,
        label: meta.label,
        paramsSchema: meta.paramsSchema,
        loaded: pluginMap.has(meta.id),
        hasLoader: !!loaderEntry,
        lastError: loaderEntry ? loaderEntry.lastError : null,
      };
    });
  }

  function getStrategyMeta(id) {
    if (typeof id !== 'string') return null;
    const trimmedId = id.trim();
    if (!trimmedId) return null;
    return metaMap.get(trimmedId) || null;
  }

  function hasStrategy(id) {
    if (typeof id !== 'string') return false;
    const trimmedId = id.trim();
    if (!trimmedId) return false;
    return metaMap.has(trimmedId);
  }

  const registry = {
    registerStrategy,
    registerStrategyLoader,
    ensureStrategyLoaded,
    getStrategyById,
    getStrategyMeta,
    listStrategies,
    hasStrategy,
    // Backward compatibility with Stage 3 API
    register(plugin) {
      return registerStrategy(plugin);
    },
    get(id) {
      return getStrategyById(id);
    },
    has(id) {
      return hasStrategy(id);
    },
    list() {
      return Array.from(pluginMap.values());
    },
  };

  Object.defineProperty(registry, '__registryVersion', {
    value: 'LB-PLUGIN-REGISTRY-20250712A',
    enumerable: true,
    configurable: false,
    writable: false,
  });

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: Object.freeze(registry),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
