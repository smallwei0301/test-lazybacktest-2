// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (globalScope && globalScope.StrategyPluginRegistry) {
    return;
  }

  const STRATEGY_STATES = {
    PENDING: 'pending',
    READY: 'ready',
    ERROR: 'error',
  };

  /**
   * @param {unknown} value
   * @returns {unknown}
   */
  function clonePlain(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) {
      return value.map((item) => clonePlain(item));
    }
    const result = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = clonePlain(value[key]);
      }
    }
    return result;
  }

  /**
   * @param {unknown} value
   * @returns {unknown}
   */
  function deepFreeze(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    Object.freeze(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && typeof item === 'object' && !Object.isFrozen(item)) {
          deepFreeze(item);
        }
      });
    } else {
      Object.keys(value).forEach((key) => {
        const prop = value[key];
        if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
          deepFreeze(prop);
        }
      });
    }
    return value;
  }

  /**
   * @param {unknown} schema
   * @param {string} id
   */
  function sanitizeParamsSchema(schema, id) {
    if (schema === undefined || schema === null) {
      return undefined;
    }
    if (typeof schema !== 'object' || Array.isArray(schema)) {
      throw new TypeError(`[${id}] StrategyPlugin paramsSchema 必須為物件`);
    }
    const cloned = /** @type {Record<string, unknown>} */ (clonePlain(schema));
    if (cloned.type !== undefined && cloned.type !== 'object') {
      throw new TypeError(`[${id}] paramsSchema.type 需為 'object' 或省略`);
    }
    if (cloned.properties !== undefined) {
      if (typeof cloned.properties !== 'object' || Array.isArray(cloned.properties)) {
        throw new TypeError(`[${id}] paramsSchema.properties 必須為物件`);
      }
      const props = /** @type {Record<string, unknown>} */ (cloned.properties);
      Object.keys(props).forEach((propKey) => {
        const prop = props[propKey];
        if (prop === null || typeof prop !== 'object' || Array.isArray(prop)) {
          throw new TypeError(`[${id}] paramsSchema.properties.${propKey} 必須為物件`);
        }
      });
    }
    return /** @type {Record<string, unknown>} */ (deepFreeze(cloned));
  }

  /**
   * @param {unknown} meta
   */
  function sanitiseMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      throw new TypeError('StrategyPlugin 需要提供 meta 描述');
    }
    const raw = /** @type {Record<string, unknown>} */ (meta);
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) {
      throw new TypeError('StrategyPlugin meta.id 必須為非空字串');
    }
    const label = typeof raw.label === 'string' ? raw.label : '';
    if (!label) {
      throw new TypeError(`[${id}] StrategyPlugin meta.label 必須為非空字串`);
    }
    const cloned = /** @type {Record<string, unknown>} */ (clonePlain(raw));
    cloned.id = id;
    cloned.label = label;
    if (raw.paramsSchema !== undefined) {
      cloned.paramsSchema = sanitizeParamsSchema(raw.paramsSchema, id);
    }
    return /** @type {{ id: string; label: string; paramsSchema?: Record<string, unknown> }} */ (
      deepFreeze(cloned)
    );
  }

  /**
   * @param {unknown} value
   */
  function stableStringify(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    const segments = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${segments.join(',')}}`;
  }

  /**
   * @param {{ meta: Record<string, unknown> }} current
   * @param {{ meta: Record<string, unknown> }} candidate
   * @returns {boolean}
   */
  function metaEquals(current, candidate) {
    if (!current || !candidate) return false;
    if (current.meta === candidate.meta) return true;
    return stableStringify(current.meta) === stableStringify(candidate.meta);
  }

  /**
   * @param {() => void | Promise<void>} loader
   */
  function wrapLoader(loader) {
    let loaded = false;
    let loadingPromise = null;
    return function ensureLoaded() {
      if (loaded) return null;
      if (loadingPromise) return loadingPromise;
      try {
        const maybePromise = loader();
        if (maybePromise && typeof maybePromise.then === 'function') {
          loadingPromise = maybePromise.then(() => {
            loaded = true;
            loadingPromise = null;
          });
          return loadingPromise;
        }
        loaded = true;
        return null;
      } catch (error) {
        loadingPromise = null;
        throw error;
      }
    };
  }

  const registryState = new Map();

  function createSnapshot(entry) {
    const loaded = entry.state === STRATEGY_STATES.READY && typeof entry.run === 'function';
    return Object.freeze({
      meta: entry.meta,
      loader: entry.loader || null,
      loaded,
      run: loaded ? entry.run : null,
    });
  }

  function ensureLoaded(entry, reason) {
    if (!entry || entry.state === STRATEGY_STATES.READY) {
      return entry;
    }
    if (entry.state === STRATEGY_STATES.ERROR) {
      throw entry.lastError || new Error(`[${entry.meta.id}] 策略載入失敗`);
    }
    if (typeof entry.loader !== 'function') {
      return entry;
    }
    try {
      const result = entry.loader();
      if (result && typeof result.then === 'function') {
        throw new Error(
          `[${entry.meta.id}] 策略載入程序 (${reason || 'unknown'}) 回傳 Promise，請改為同步載入`,
        );
      }
    } catch (error) {
      entry.state = STRATEGY_STATES.ERROR;
      entry.lastError = error instanceof Error ? error : new Error(String(error));
      throw entry.lastError;
    }
    return entry;
  }

  function sanitiseRegistration(definition) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('StrategyPluginRegistry.registerStrategy 需要傳入物件定義');
    }
    const raw = /** @type {{ meta: unknown; run?: unknown; loader?: unknown }} */ (definition);
    const meta = sanitiseMeta(raw.meta);
    const run = typeof raw.run === 'function' ? raw.run : null;
    const loader =
      typeof raw.loader === 'function'
        ? wrapLoader(raw.loader)
        : null;
    if (!run && !loader) {
      throw new TypeError(`[${meta.id}] 需要提供 run 函式或 loader`);
    }
    return { meta, run, loader };
  }

  const registry = {
    registerStrategy(definition) {
      const { meta, run, loader } = sanitiseRegistration(definition);
      const id = meta.id;
      const existing = registryState.get(id);
      if (existing) {
        if (!metaEquals({ meta: existing.meta }, { meta })) {
          throw new Error(`[${id}] StrategyPlugin 已存在且 meta 不相符`);
        }
        if (loader) {
          existing.loader = loader;
        }
        if (run) {
          existing.run = run;
          existing.state = STRATEGY_STATES.READY;
        }
        registryState.set(id, existing);
        return createSnapshot(existing);
      }
      const entry = {
        meta,
        run,
        loader,
        state: run ? STRATEGY_STATES.READY : STRATEGY_STATES.PENDING,
        lastError: null,
      };
      registryState.set(id, entry);
      return createSnapshot(entry);
    },
    register(definition) {
      return this.registerStrategy(definition);
    },
    hasStrategy(id) {
      return registryState.has(id);
    },
    has(id) {
      return this.hasStrategy(id);
    },
    ensureStrategyLoaded(id) {
      const entry = registryState.get(id);
      if (!entry) return false;
      ensureLoaded(entry, 'ensureStrategyLoaded');
      return entry.state === STRATEGY_STATES.READY && typeof entry.run === 'function';
    },
    getStrategyById(id) {
      const entry = registryState.get(id);
      if (!entry) {
        return null;
      }
      ensureLoaded(entry, 'getStrategyById');
      if (entry.state !== STRATEGY_STATES.READY || typeof entry.run !== 'function') {
        return null;
      }
      return Object.freeze({ meta: entry.meta, run: entry.run });
    },
    get(id) {
      return this.getStrategyById(id);
    },
    listStrategies(options) {
      const ensureAll = options && options.ensureLoaded === true;
      const summaries = [];
      registryState.forEach((entry) => {
        if (ensureAll) {
          ensureLoaded(entry, 'listStrategies');
        }
        summaries.push(
          Object.freeze({
            meta: entry.meta,
            loaded: entry.state === STRATEGY_STATES.READY && typeof entry.run === 'function',
          }),
        );
      });
      return summaries;
    },
    list(options) {
      return this.listStrategies(options);
    },
  };

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: registry,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
