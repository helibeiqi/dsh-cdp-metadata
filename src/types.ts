/**
 * CDP v0.1 类型定义（镜像 docs/CDP-SCHEMA.v0.1.json）
 *
 * 本文件仅包含类型与纯 union 常量，不依赖任何运行时校验库。
 * 所有运行期校验见 src/schema.ts (L1) 与 src/validator.ts (L2)。
 */

export type ValidationLevel = 'L1' | 'L2';

export type Archetype =
  | 'analyzer'
  | 'executor'
  | 'advisor'
  | 'orchestrator'
  | 'validator';

export type ReasoningType = 'deductive' | 'inductive' | 'abductive';

export type UncertaintyExpression = 'explicit' | 'implicit';

export type FailureMode = 'fail_loud' | 'fail_silent';

export type SideEffectLevel =
  | 'none'
  | 'read-only'
  | 'state-changing'
  | 'irreversible';

export type ComputeLevel = 'low' | 'mid' | 'high';

export type MonetaryModel = 'free' | 'per_call' | 'metered';

/** 顶层文档形态：{ "capability": { ... } } */
export interface CdpDocument {
  capability: CdpCapability;
  /** 允许被 L1 严格模式外的透传保留字段在此显式无；strict 模式下 additionalProperties 仍报错 */
  [key: string]: unknown;
}

export interface CdpCapability {
  /** 能力唯一标识，形如 name@v1.0；注册表主键 */
  id: string;
  identity: Identity;
  boundaries: Boundaries;
  cognitive_style: CognitiveStyle;
  output: Output;
  runtime: Runtime;
}

export interface Identity {
  /** 人类可读名（可中文） */
  name: string;
  archetype: Archetype;
}

export interface Boundaries {
  /** 能做到的事 */
  can: string[];
  /** 明确不做的事（L2 冲突检测对象） */
  cannot: string[];
  /** 前置条件 */
  requires: string[];
}

export interface CognitiveStyle {
  reasoning_type: ReasoningType;
  uncertainty_expression: UncertaintyExpression;
  failure_mode: FailureMode;
  /** 与 identity.archetype 对齐；不一致时 L2 告警 */
  archetype: Archetype;
}

export interface DownstreamHint {
  /** 必须命中本 capability 的 semantic_tags 之一 */
  if_tag: string;
  /** 建议路由到的目标能力 id 或 archetype */
  suggest_to: string;
}

export interface Output {
  /** 输出语义标签，跨插件路由与检索键 */
  semantic_tags: string[];
  /** 跨插件路由提示 */
  downstream_hints: DownstreamHint[];
}

export interface SideEffects {
  level: SideEffectLevel;
  /** 受影响范围；level=none 时应为空数组（L2 不一致告警） */
  scope: string[];
}

export interface Cost {
  compute: ComputeLevel;
  /** 时延上界，如 <1s / 500ms / 2m / 1h */
  latency: string;
  monetary: MonetaryModel;
}

export interface Runtime {
  side_effects: SideEffects;
  cost: Cost;
}

/** dsh-tools schemaOf 输出形态（与 DESIGN §9.4 对齐） */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: unknown;
}
