// Patch Tag: LB-PLUGIN-VERIFIER-20260813A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const registry = globalScope?.StrategyPluginRegistry;
  const contract = globalScope?.StrategyPluginContract;
  if (!registry || !contract || typeof contract.createLegacyStrategyPlugin !== 'function') {
    return;
  }

  const { createLegacyStrategyPlugin } = contract;

  function registerRiskProxy(config) {
    const plugin = createLegacyStrategyPlugin(
      {
        id: config.id,
        label: config.label,
        paramsSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
      },
      () => ({
        enter: false,
        exit: false,
        short: false,
        cover: false,
        meta: {
          note: '由全局風險管理模組控制，插件僅提供註冊檢查。',
        },
      }),
    );
    registry.registerStrategy(plugin);
  }

  registerRiskProxy({
    id: 'fixed_stop_loss',
    label: '(由風險管理控制)',
  });

  registerRiskProxy({
    id: 'cover_fixed_stop_loss',
    label: '(由風險管理控制)',
  });
})(typeof self !== 'undefined' ? self : this);
