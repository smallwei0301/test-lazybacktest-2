export type StrategyRole = 'longEntry' | 'longExit' | 'shortEntry' | 'shortExit';

export interface StrategyPluginMeta {
  /** 唯一識別碼，作為快取與診斷鍵值。 */
  id: string;
  /** 對使用者顯示的名稱。 */
  label: string;
  /**
   * 以 JSON Schema 風格描述的參數限制。這裡採用寬鬆的物件型別，
   * 僅要求可序列化。
   */
  paramsSchema?: Record<string, unknown>;
}

export interface StrategyContextDataset {
  close: ReadonlyArray<number | null>;
  open: ReadonlyArray<number | null>;
  high: ReadonlyArray<number | null>;
  low: ReadonlyArray<number | null>;
  date: ReadonlyArray<string>;
}

export interface StrategyContextHelpers {
  getIndicator(indicatorKey: string): ReadonlyArray<number | null> | undefined;
  log(message: string, details?: Record<string, unknown>): void;
  setCache(key: string, value: unknown): void;
  getCache(key: string): unknown;
}

export interface StrategyContext {
  role: StrategyRole;
  index: number;
  series: StrategyContextDataset;
  helpers: StrategyContextHelpers;
  runtime: {
    warmupStartIndex: number;
    effectiveStartIndex: number;
    length: number;
  };
}

export interface RuleResult {
  enter?: boolean;
  exit?: boolean;
  short?: boolean;
  cover?: boolean;
  stopLossPercent?: number | null;
  takeProfitPercent?: number | null;
  meta?: Record<string, unknown>;
}

export interface StrategyPlugin {
  meta: StrategyPluginMeta;
  run(context: StrategyContext, params: Record<string, unknown>): RuleResult;
}

export interface StrategyPluginContractAPI {
  readonly version: string;
  readonly allowedRoles: ReadonlyArray<StrategyRole>;
  ensureRuleResult(
    rawResult: unknown,
    info?: { pluginId?: string; role?: StrategyRole; index?: number },
  ): RuleResult;
  normaliseByRole(
    role: StrategyRole,
    candidate: unknown,
    info?: { pluginId?: string; index?: number },
  ): RuleResult;
  createLegacyStrategyPlugin(
    meta: StrategyPluginMeta,
    evaluator: (context: StrategyContext, params: Record<string, unknown>) => unknown,
  ): StrategyPlugin;
}

export interface LegacyStrategyPluginShimAPI {
  readonly contractVersion: string;
  createLegacyStrategyPlugin: StrategyPluginContractAPI['createLegacyStrategyPlugin'];
  normaliseResult(
    pluginId: string | undefined,
    role: StrategyRole,
    candidate: unknown,
    info?: { index?: number },
  ): RuleResult;
}

declare global {
  const StrategyPluginContract: StrategyPluginContractAPI | undefined;
  const LegacyStrategyPluginShim: LegacyStrategyPluginShimAPI | undefined;
}

export {};
