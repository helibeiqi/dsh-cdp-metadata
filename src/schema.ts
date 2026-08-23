/**
 * L1 语法校验（DESIGN §4 L1、§9 schema.ts）。
 *
 * 使用 zod 实现，逐项镜像 docs/CDP-SCHEMA.v0.1.json：
 * - 必填字段存在
 * - 枚举合法
 * - id / latency 格式（regex）
 * - 数组项 minLength=1（非空字符串）
 * - additionalProperties:false（禁止未知字段）
 *
 * 导出：
 * - cdpCapabilitySchema：zod schema（capability 对象）
 * - cdpDocumentSchema：顶层 { capability }
 * - validateSyntax(doc): 返回 { value } 或 { errors }
 */

import { z } from 'zod';
import { CdpValidationError } from './errors.js';
import type { CdpCapability, CdpDocument } from './types.js';

export const ID_PATTERN = '^[A-Za-z0-9_.-]+@v?\\d+\\.\\d+$';
export const LATENCY_PATTERN = '^(<)?\\d+(\\.\\d+)?(ms|[smh])$';

const idRegex = new RegExp(ID_PATTERN);
const latencyRegex = new RegExp(LATENCY_PATTERN);

const nonEmptyString = z.string().min(1, 'must be a non-empty string');

const archetypeEnum = z.enum([
  'analyzer',
  'executor',
  'advisor',
  'orchestrator',
  'validator'
]);

const identitySchema = z
  .object({
    name: nonEmptyString,
    archetype: archetypeEnum
  })
  .strict();

const boundariesSchema = z
  .object({
    can: z.array(nonEmptyString),
    cannot: z.array(nonEmptyString),
    requires: z.array(nonEmptyString)
  })
  .strict();

const cognitiveStyleSchema = z
  .object({
    reasoning_type: z.enum(['deductive', 'inductive', 'abductive']),
    uncertainty_expression: z.enum(['explicit', 'implicit']),
    failure_mode: z.enum(['fail_loud', 'fail_silent']),
    archetype: archetypeEnum
  })
  .strict();

const downstreamHintSchema = z
  .object({
    if_tag: nonEmptyString,
    suggest_to: nonEmptyString
  })
  .strict();

const outputSchema = z
  .object({
    semantic_tags: z.array(nonEmptyString),
    downstream_hints: z.array(downstreamHintSchema)
  })
  .strict();

const sideEffectsSchema = z
  .object({
    level: z.enum(['none', 'read-only', 'state-changing', 'irreversible']),
    scope: z.array(nonEmptyString)
  })
  .strict();

const costSchema = z
  .object({
    compute: z.enum(['low', 'mid', 'high']),
    latency: z
      .string()
      .regex(latencyRegex, 'invalid latency format (e.g. <1s, 500ms, 2m, 1h)'),
    monetary: z.enum(['free', 'per_call', 'metered'])
  })
  .strict();

const runtimeSchema = z
  .object({
    side_effects: sideEffectsSchema,
    cost: costSchema
  })
  .strict();

export const cdpCapabilitySchema = z
  .object({
    id: z.string().regex(idRegex, 'invalid capability id format (name@v1.0)'),
    identity: identitySchema,
    boundaries: boundariesSchema,
    cognitive_style: cognitiveStyleSchema,
    output: outputSchema,
    runtime: runtimeSchema
  })
  .strict();

export const cdpDocumentSchema = z
  .object({
    capability: cdpCapabilitySchema
  })
  .strict();

/**
 * L1 语法校验函数。
 * 成功：返回 { ok: true, value }
 * 失败：返回 { ok: false, errors: CdpValidationError[] }（level='L1'）
 */
export interface SyntaxOk {
  ok: true;
  value: CdpCapability;
}
export interface SyntaxFail {
  ok: false;
  errors: CdpValidationError[];
}
export type SyntaxResult = SyntaxOk | SyntaxFail;

export function validateSyntax(doc: unknown): SyntaxResult {
  const result = cdpDocumentSchema.safeParse(doc);
  if (result.success) {
    return { ok: true, value: result.data.capability as CdpCapability };
  }
  const errors: CdpValidationError[] = result.error.issues.map((issue) => {
    // issue.path 为 zod 给出的相对路径（如 ['id'] / ['boundaries','can',0] /
    // strict 额外键时为包含该键的对象路径）。直接 join，保持与 DESIGN §5 path 约定一致。
    const path = issue.path.join('.') || 'capability';
    return new CdpValidationError(path, issue.message, 'L1');
  });
  return { ok: false, errors };
}

/** 类型守卫：判断未知值是否为合法 CdpDocument（供 loader 使用） */
export function isCdpDocument(value: unknown): value is CdpDocument {
  return cdpDocumentSchema.safeParse(value).success;
}
