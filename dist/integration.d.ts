/**
 * 插件入口与 attachToTools 双轨（DESIGN §6、§9 index.ts）。
 *
 * apply(ctx, config):
 * - 读 config（仅 sources / validation / expose 三段）
 * - 遍历 sources 加载 → L1 / L2 校验（按 onInvalid 分级）
 * - 注册到 registry
 * - ctx.provide('cdpRegistry', registry)
 * - 若 expose.attachToTools 为 true，经 ctx.tools.get(name, scope) 活引用改 description
 *   （不是 schemas() 新建对象），WeakMap 幂等守卫，effect 返回 disposer 还原
 * - 用 expose.bindings: Record<capabilityId, toolName> 显式映射
 */
import { z } from 'zod';
import { CdpRegistry } from './registry.js';
import type { CdpCapability } from './types.js';
export declare const configSchema: z.ZodObject<{
    sources: z.ZodObject<{
        root: z.ZodString;
        paths: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        root: string;
        paths: string[];
    }, {
        root: string;
        paths: string[];
    }>;
    validation: z.ZodDefault<z.ZodObject<{
        onInvalid: z.ZodDefault<z.ZodEnum<["warn", "error"]>>;
        conflictStrategy: z.ZodDefault<z.ZodEnum<["prefix", "error"]>>;
    }, "strict", z.ZodTypeAny, {
        onInvalid: "error" | "warn";
        conflictStrategy: "prefix" | "error";
    }, {
        onInvalid?: "error" | "warn" | undefined;
        conflictStrategy?: "prefix" | "error" | undefined;
    }>>;
    expose: z.ZodDefault<z.ZodObject<{
        attachToTools: z.ZodDefault<z.ZodBoolean>;
        bindings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        attachToTools: boolean;
        bindings: Record<string, string>;
    }, {
        attachToTools?: boolean | undefined;
        bindings?: Record<string, string> | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    validation: {
        onInvalid: "error" | "warn";
        conflictStrategy: "prefix" | "error";
    };
    sources: {
        root: string;
        paths: string[];
    };
    expose: {
        attachToTools: boolean;
        bindings: Record<string, string>;
    };
}, {
    sources: {
        root: string;
        paths: string[];
    };
    validation?: {
        onInvalid?: "error" | "warn" | undefined;
        conflictStrategy?: "prefix" | "error" | undefined;
    } | undefined;
    expose?: {
        attachToTools?: boolean | undefined;
        bindings?: Record<string, string> | undefined;
    } | undefined;
}>;
export interface CdpPluginConfig {
    sources: {
        root: string;
        paths: string[];
    };
    validation: {
        onInvalid: 'warn' | 'error';
        conflictStrategy: 'prefix' | 'error';
    };
    expose: {
        attachToTools: boolean;
        bindings: Record<string, string>;
    };
}
interface ToolDefinitionLike {
    description: string;
    [key: string]: unknown;
}
interface ToolsServiceLike {
    get?: (name: string, scope?: unknown) => ToolDefinitionLike | undefined;
}
interface ContextLike {
    provide: (name: string, value: unknown) => void;
    effect?: (fn: () => unknown | (() => void)) => unknown;
    logger?: {
        warn: (msg: string) => void;
    };
    tools?: ToolsServiceLike;
}
/**
 * 纯函数：在已有 description 后追加 CDP marker，零副作用、可单测。
 */
export declare function decorateSchemas(cap: CdpCapability, existingDescription: string): string;
/**
 * attachToTools 双轨之"活引用改写"实现。
 * 经 ctx.tools.get(name) 取活 definition，仅改 description（绝不碰 parameters/execute）。
 * 幂等守卫：若已记录原始值或 description 已含哨兵则跳过。
 * 返回 disposer：cordis fiber 卸载时还原 description 为原始值。
 */
export declare function attachToTools(ctx: ContextLike, registry: CdpRegistry, bindings: Record<string, string>): () => void;
export declare const name = "dsh-cdp-metadata";
export declare const inject: never[];
export declare function apply(ctx: ContextLike, rawConfig: unknown): Promise<void>;
declare const _default: {
    name: string;
    apply: typeof apply;
};
export default _default;
