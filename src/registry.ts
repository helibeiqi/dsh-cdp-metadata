/**
 * CDP 注册表（DESIGN §9 registry.ts）。
 *
 * 负责：注册 / 查重 / 查询 / 投影。
 * - register(cap, opts)：conflictStrategy 'prefix' | 'error'
 * - get(id) / list()
 * - queryByTag(tag) / queryByArchetype(a) / queryBySideEffect(level)
 * - formatMarker(cap)：紧凑模型可读 marker
 * - decorateSchemas(schemas, cap)：纯函数投影（推荐主路径，零副作用）
 *
 * 本类实例通过 ctx.provide('cdpRegistry', registry) 注入（见 integration.ts）。
 */

import type {
  Archetype,
  CdpCapability,
  SideEffectLevel,
  ToolSchema
} from './types.js';

export type ConflictStrategy = 'prefix' | 'error';

export interface RegisterOptions {
  conflictStrategy?: ConflictStrategy;
}

export class DuplicateIdError extends Error {
  constructor(public readonly id: string) {
    super(`duplicate capability id: ${id}`);
    this.name = 'DuplicateIdError';
    Object.setPrototypeOf(this, DuplicateIdError.prototype);
  }
}

export class CdpRegistry {
  private readonly map = new Map<string, CdpCapability>();
  private readonly byIdPrefix = new Map<string, number>();

  /**
   * 注册一个能力。
   * @param cap 能力对象
   * @param opts conflictStrategy: 'prefix'（默认，重复用 id + '#' + n）| 'error'（抛 DuplicateIdError）
   */
  register(cap: CdpCapability, opts: RegisterOptions = {}): string {
    const strategy: ConflictStrategy = opts.conflictStrategy ?? 'prefix';
    let finalId = cap.id;
    if (this.map.has(finalId)) {
      if (strategy === 'error') {
        throw new DuplicateIdError(finalId);
      }
      // prefix 策略
      const n = (this.byIdPrefix.get(finalId) ?? 1) + 1;
      this.byIdPrefix.set(finalId, n);
      finalId = `${finalId}#${n}`;
    }
    this.map.set(finalId, { ...cap, id: finalId });
    return finalId;
  }

  get(id: string): CdpCapability | undefined {
    return this.map.get(id);
  }

  list(): CdpCapability[] {
    return [...this.map.values()];
  }

  queryByTag(tag: string): CdpCapability[] {
    return this.list().filter((c) => c.output.semantic_tags.includes(tag));
  }

  queryByArchetype(archetype: Archetype): CdpCapability[] {
    return this.list().filter((c) => c.identity.archetype === archetype);
  }

  queryBySideEffect(level: SideEffectLevel): CdpCapability[] {
    return this.list().filter(
      (c) => c.runtime.side_effects.level === level
    );
  }

  /**
   * 紧凑模型可读 marker，形如：
   * [CDP: deductive/explicit/fail_loud | SE:none | $:free]
   */
  formatMarker(cap: CdpCapability): string {
    const cs = cap.cognitive_style;
    const se = cap.runtime.side_effects.level;
    const monetary = cap.runtime.cost.monetary;
    return `[CDP: ${cs.reasoning_type}/${cs.uncertainty_expression}/${cs.failure_mode} | SE:${se} | $:${monetary}]`;
  }

  /**
   * 纯函数投影：在已有 description 后追加 CDP marker。
   * 零副作用、可单测。返回副本。
   * @param cap 能力
   * @param existingDescription 原 description
   */
  decorateSchemas(cap: CdpCapability, existingDescription: string): string {
    const marker = this.formatMarker(cap);
    const trimmed = existingDescription.trimEnd();
    return `${trimmed} ${marker}`;
  }

  /**
   * 对一组 tool schema 应用 bindings 映射（纯函数）。
   * bindings: Record<capabilityId, toolName>
   * 仅当 registry 中存在该 capability 且 schema.name 命中 toolName 时，追加 marker。
   */
  applyBindings(
    schemas: ToolSchema[],
    bindings: Record<string, string>
  ): ToolSchema[] {
    const toolNameToCap = new Map<string, CdpCapability>();
    for (const [capId, toolName] of Object.entries(bindings)) {
      const cap = this.get(capId);
      if (cap) toolNameToCap.set(toolName, cap);
    }
    return schemas.map((s) => {
      const cap = toolNameToCap.get(s.name);
      if (!cap) return s;
      return { ...s, description: this.decorateSchemas(cap, s.description) };
    });
  }
}
