// Patch Tag: LB-PLUGIN-REGISTRY-20250712A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (globalScope && globalScope.StrategyPluginRegistry) {
    return;
  }

  const pluginMap = new Map();
  const pluginOrder = [];

  const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  function cloneAndFreeze(object) {
    if (!isPlainObject(object)) return undefined;
    const clone = { ...object };
    return Object.freeze(clone);
  }

  function cloneProperties(properties, pluginId) {
    if (!isPlainObject(properties)) {
      throw new TypeError(`[${pluginId}] paramsSchema.properties 必須為物件`);
    }
    const clone = {};
    for (const key of Object.keys(properties)) {
      const descriptor = properties[key];
      if (!isPlainObject(descriptor)) {
        throw new TypeError(
          `[${pluginId}] paramsSchema.properties.${key} 必須為物件`,
        );
      }
      clone[key] = Object.freeze({ ...descriptor });
    }
    return Object.freeze(clone);
  }

  function validateParamsSchema(schema, pluginId) {
    if (schema === undefined) {
      return undefined;
    }
    if (!isPlainObject(schema)) {
      throw new TypeError(`[${pluginId}] paramsSchema 必須為物件`);
    }
    const schemaClone = { ...schema };
    if ('type' in schemaClone && schemaClone.type !== 'object') {
      throw new TypeError(
        `[${pluginId}] paramsSchema.type 目前僅支援 \`object\``,
      );
    }
    schemaClone.type = 'object';
    if ('properties' in schemaClone) {
      schemaClone.properties = cloneProperties(schemaClone.properties, pluginId);
    }
    if ('required' in schemaClone) {
      if (!Array.isArray(schemaClone.required)) {
        throw new TypeError(`[${pluginId}] paramsSchema.required 必須為陣列`);
      }
      schemaClone.required = Object.freeze([...schemaClone.required]);
    }
    if ('additionalProperties' in schemaClone) {
      const additional = schemaClone.additionalProperties;
      if (
        additional !== undefined &&
        typeof additional !== 'boolean' &&
        !isPlainObject(additional)
      ) {
        throw new TypeError(
          `[${pluginId}] paramsSchema.additionalProperties 必須為布林值或物件`,
        );
      }
      if (isPlainObject(additional)) {
        schemaClone.additionalProperties = cloneAndFreeze(additional);
      }
    }
    return Object.freeze(schemaClone);
  }

  function normalisePlugin(plugin) {
    if (!isPlainObject(plugin)) {
      throw new TypeError('StrategyPluginRegistry.registerStrategy 需要傳入插件物件');
    }
    const meta = plugin.meta;
    if (!isPlainObject(meta)) {
      throw new TypeError('StrategyPlugin 插件需要 meta 描述');
    }
    if (typeof meta.id !== 'string' || !meta.id.trim()) {
      throw new TypeError('StrategyPlugin meta.id 必須為非空字串');
    }
    if (typeof meta.label !== 'string' || !meta.label.trim()) {
      throw new TypeError(`[${meta.id}] StrategyPlugin meta.label 必須為非空字串`);
    }
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[${meta.id}] StrategyPlugin 必須提供 run(context, params)`);
    }

    const frozenMeta = Object.freeze({
      id: meta.id,
      label: meta.label,
      paramsSchema: validateParamsSchema(meta.paramsSchema, meta.id),
    });

    return Object.freeze({
      meta: frozenMeta,
      run: plugin.run,
    });
  }

  function registerStrategy(plugin) {
    const stored = normalisePlugin(plugin);
    const id = stored.meta.id;
    if (pluginMap.has(id)) {
      throw new Error(`[${id}] StrategyPlugin 已被註冊`);
    }
    pluginMap.set(id, stored);
    pluginOrder.push(id);
    return stored;
  }

  function getStrategyById(id) {
    if (typeof id !== 'string' || !id) {
      return null;
    }
    return pluginMap.get(id) || null;
  }

  function listStrategies() {
    return pluginOrder.map((id) => pluginMap.get(id));
  }

  const registry = Object.freeze({
    registerStrategy,
    getStrategyById,
    listStrategies,
    has(id) {
      return pluginMap.has(id);
    },
    register(plugin) {
      return registerStrategy(plugin);
    },
    get(id) {
      return getStrategyById(id);
    },
    list() {
      return listStrategies();
    },
  });

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: registry,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
