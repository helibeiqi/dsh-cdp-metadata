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
import type { Archetype, CdpCapability, SideEffectLevel, ToolSchema } from './types.js';
export type ConflictStrategy = 'prefix' | 'error';
export interface RegisterOptions {
    conflictStrategy?: ConflictStrategy;
}
export declare class DuplicateIdError extends Error {
    readonly id: string;
    constructor(id: string);
}
export declare class CdpRegistry {
    private readonly map;
    private readonly byIdPrefix;
    /**
     * 注册一个能力。
     * @param cap 能力对象
     * @param opts conflictStrategy: 'prefix'（默认，重复用 id + '#' + n）| 'error'（抛 DuplicateIdError）
     */
    register(cap: CdpCapability, opts?: RegisterOptions): string;
    get(id: string): CdpCapability | undefined;
    list(): CdpCapability[];
    queryByTag(tag: string): CdpCapability[];
    queryByArchetype(archetype: Archetype): CdpCapability[];
    queryBySideEffect(level: SideEffectLevel): CdpCapability[];
    /**
     * 紧凑模型可读 marker，形如：
     * [CDP: deductive/explicit/fail_loud | SE:none | $:free]
     */
    formatMarker(cap: CdpCapability): string;
    /**
     * 纯函数投影：在已有 description 后追加 CDP marker。
     * 零副作用、可单测。返回副本。
     * @param cap 能力
     * @param existingDescription 原 description
     */
    decorateSchemas(cap: CdpCapability, existingDescription: string): string;
    /**
     * 对一组 tool schema 应用 bindings 映射（纯函数）。
     * bindings: Record<capabilityId, toolName>
     * 仅当 registry 中存在该 capability 且 schema.name 命中 toolName 时，追加 marker。
     */
    applyBindings(schemas: ToolSchema[], bindings: Record<string, string>): ToolSchema[];
}
