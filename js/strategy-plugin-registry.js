// Patch Tag: LB-PLUGIN-ATOMS-20250709A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (globalScope && globalScope.StrategyPluginRegistry) {
    return;
  }

  const pluginMap = new Map();

  function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError('StrategyPluginRegistry.register 需要傳入插件物件');
    }
    const meta = plugin.meta;
    if (!meta || typeof meta !== 'object') {
      throw new TypeError('StrategyPlugin 插件需要 meta 描述');
    }
    if (typeof meta.id !== 'string' || !meta.id.trim()) {
      throw new TypeError('StrategyPlugin meta.id 必須為非空字串');
    }
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[${meta.id}] StrategyPlugin 必須提供 run(context, params)`);
    }
  }

  const registry = {
    register(plugin) {
      validatePlugin(plugin);
      const id = plugin.meta.id;
      const frozenMeta = Object.freeze({ ...plugin.meta });
      const stored = Object.freeze({ meta: frozenMeta, run: plugin.run });
      pluginMap.set(id, stored);
      return stored;
    },
    get(id) {
      return pluginMap.get(id) || null;
    },
    has(id) {
      return pluginMap.has(id);
    },
    list() {
      return Array.from(pluginMap.values());
    },
  };

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: registry,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
