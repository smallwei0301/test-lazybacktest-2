// Patch Tag: LB-STRATEGY-DSL-LOADER-20260919A
(function (root) {
  function resolveUiInstance(explicit) {
    if (explicit && typeof explicit.applyDsl === 'function') {
      return explicit;
    }
    if (root && root.lazybacktestStrategyUiInstance && typeof root.lazybacktestStrategyUiInstance.applyDsl === 'function') {
      return root.lazybacktestStrategyUiInstance;
    }
    return null;
  }

  function applyStrategyDsl(settings, uiInstance) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    const definition = settings.strategyDsl;
    if (!definition || typeof definition !== 'object') {
      return false;
    }
    const target = resolveUiInstance(uiInstance);
    if (!target) {
      return false;
    }
    target.applyDsl(definition);
    return true;
  }

  const api = Object.freeze({
    applyStrategyDsl,
  });

  if (root && typeof root === 'object') {
    root.lazybacktestStrategyDslLoader = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
