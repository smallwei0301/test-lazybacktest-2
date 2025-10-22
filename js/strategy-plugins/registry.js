// Patch Tag: LB-PLUGIN-ATOMS-20250707A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const existing = globalScope.StrategyPluginRegistry;
  if (existing && typeof existing === 'object') {
    return;
  }

  const pluginMap = new Map();

  function assertValidPlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError('[StrategyPluginRegistry] plugin 必須為物件');
    }
    if (!plugin.meta || typeof plugin.meta !== 'object') {
      throw new TypeError('[StrategyPluginRegistry] plugin.meta 必須為物件');
    }
    if (typeof plugin.meta.id !== 'string' || !plugin.meta.id.trim()) {
      throw new TypeError('[StrategyPluginRegistry] plugin.meta.id 必須為非空字串');
    }
    if (typeof plugin.meta.label !== 'string' || !plugin.meta.label.trim()) {
      throw new TypeError('[StrategyPluginRegistry] plugin.meta.label 必須為非空字串');
    }
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[StrategyPluginRegistry] ${plugin.meta.id} 缺少 run(context, params) 實作`);
    }
  }

  function register(plugin) {
    assertValidPlugin(plugin);
    const key = plugin.meta.id;
    pluginMap.set(key, plugin);
    return plugin;
  }

  function get(id) {
    if (typeof id !== 'string') return null;
    return pluginMap.get(id) || null;
  }

  function has(id) {
    if (typeof id !== 'string') return false;
    return pluginMap.has(id);
  }

  function list() {
    return Array.from(pluginMap.values());
  }

  const api = Object.freeze({
    register,
    get,
    has,
    list,
  });

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof self !== 'undefined' ? self : this);
