// Patch Tag: LB-PLUGIN-ATOMS-20250710A — Strategy plugin registry & alias resolution.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const registry = new Map();
  const aliasMap = new Map();

  function normalisePluginId(plugin) {
    if (!plugin || typeof plugin !== 'object') return null;
    const id = plugin?.meta?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }

  function freezePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError('[StrategyPluginRegistry] plugin 必須為物件');
    }
    const id = normalisePluginId(plugin);
    if (!id) {
      throw new TypeError('[StrategyPluginRegistry] plugin.meta.id 必須為非空字串');
    }
    if (typeof plugin.run !== 'function') {
      throw new TypeError(`[StrategyPluginRegistry] plugin ${id} 缺少 run(context, params)`);
    }
    return Object.freeze({
      meta: Object.freeze({
        id,
        label:
          typeof plugin.meta?.label === 'string' && plugin.meta.label.trim()
            ? plugin.meta.label.trim()
            : id,
        paramsSchema:
          plugin.meta?.paramsSchema && typeof plugin.meta.paramsSchema === 'object'
            ? Object.freeze({ ...plugin.meta.paramsSchema })
            : undefined,
      }),
      run: plugin.run.bind(plugin),
    });
  }

  function register(plugin) {
    const frozen = freezePlugin(plugin);
    if (registry.has(frozen.meta.id)) {
      console.warn(
        `[StrategyPluginRegistry] plugin ${frozen.meta.id} 已存在，將覆寫舊註冊。`,
      );
    }
    registry.set(frozen.meta.id, frozen);
    return frozen;
  }

  function resolveAliasKey(key) {
    if (typeof key !== 'string') return null;
    const trimmed = key.trim();
    return trimmed ? trimmed : null;
  }

  function registerAlias(aliasKey, config) {
    const key = resolveAliasKey(aliasKey);
    if (!key) {
      throw new TypeError('[StrategyPluginRegistry] aliasKey 必須為非空字串');
    }
    if (!config || typeof config !== 'object') {
      throw new TypeError(`[StrategyPluginRegistry] alias ${key} 的設定必須為物件`);
    }
    const pluginId = resolveAliasKey(config.pluginId);
    if (!pluginId) {
      throw new TypeError(`[StrategyPluginRegistry] alias ${key} 缺少 pluginId`);
    }
    const roles = Array.isArray(config.roles)
      ? config.roles.filter((role) => typeof role === 'string')
      : null;
    const mapParams = typeof config.mapParams === 'function' ? config.mapParams : null;
    const transformResult =
      typeof config.transformResult === 'function' ? config.transformResult : null;
    aliasMap.set(key, {
      pluginId,
      roles,
      mapParams,
      transformResult,
    });
  }

  function resolve(role, aliasKey) {
    const key = resolveAliasKey(aliasKey);
    if (!key) return null;
    const entry = aliasMap.get(key);
    if (!entry) return null;
    if (Array.isArray(entry.roles) && entry.roles.length > 0) {
      if (!entry.roles.includes(role)) {
        return null;
      }
    }
    const plugin = registry.get(entry.pluginId);
    if (!plugin) {
      console.warn(
        `[StrategyPluginRegistry] alias ${key} 指向的 plugin ${entry.pluginId} 尚未註冊`,
      );
      return null;
    }
    return {
      plugin,
      mapParams: entry.mapParams,
      transformResult: entry.transformResult,
    };
  }

  function list() {
    return Array.from(registry.values());
  }

  const api = Object.freeze({
    register,
    registerAlias,
    resolve,
    list,
  });

  Object.defineProperty(globalScope, 'StrategyPluginRegistry', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof self !== 'undefined' ? self : this);
