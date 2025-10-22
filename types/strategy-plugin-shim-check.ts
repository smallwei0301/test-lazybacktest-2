/// <reference path="./strategy-plugin.d.ts" />

import type {
  StrategyPlugin,
  StrategyContext,
  RuleResult,
  StrategyRole,
  StrategyPluginContractAPI,
  LegacyStrategyPluginShimAPI,
} from './strategy-plugin';

declare const StrategyPluginContract: StrategyPluginContractAPI;
declare const LegacyStrategyPluginShim: LegacyStrategyPluginShimAPI;

function ensurePlugin(plugin: StrategyPlugin): StrategyPlugin {
  return plugin;
}

const demoPlugin = LegacyStrategyPluginShim.createLegacyStrategyPlugin(
  { id: 'demo', label: '示範策略', paramsSchema: { type: 'object', properties: {} } },
  (context: StrategyContext, params: Record<string, unknown>): RuleResult => {
    StrategyPluginContract.ensureRuleResult({ enter: true }, {
      pluginId: 'demo',
      role: context.role,
      index: context.index,
    });
    if (context.role === 'shortEntry') {
      return { short: params['allowShort'] === true };
    }
    return { enter: context.role === 'longEntry' };
  },
);

const roles: StrategyRole[] = StrategyPluginContract.allowedRoles.slice();
roles.forEach((role, idx) => {
  StrategyPluginContract.normaliseByRole(role, { enter: idx % 2 === 0 }, {
    pluginId: `demo-${role}`,
    index: idx,
  });
});

ensurePlugin(demoPlugin);
