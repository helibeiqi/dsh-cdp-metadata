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
import { CdpRegistry, DuplicateIdError } from './registry.js';
import { loadSources } from './loader.js';
import { validateSemantics } from './validator.js';
import { CdpValidationError, CdpValidationAggregateError } from './errors.js';
import type { CdpCapability } from './types.js';

/* ----------------------------- 配置 schema ----------------------------- */

const sourcesSchema = z
  .object({
    root: z.string(),
    paths: z.array(z.string())
  })
  .strict();

const validationSchema = z
  .object({
    onInvalid: z.enum(['warn', 'error']).default('warn'),
    conflictStrategy: z.enum(['prefix', 'error']).default('prefix')
  })
  .strict()
  .default({ onInvalid: 'warn', conflictStrategy: 'prefix' });

const exposeSchema = z
  .object({
    attachToTools: z.boolean().default(false),
    bindings: z.record(z.string(), z.string()).default({})
  })
  .strict()
  .default({ attachToTools: false, bindings: {} });

export const configSchema = z
  .object({
    sources: sourcesSchema,
    validation: validationSchema,
    expose: exposeSchema
  })
  .strict();

export interface CdpPluginConfig {
  sources: { root: string; paths: string[] };
  validation: { onInvalid: 'warn' | 'error'; conflictStrategy: 'prefix' | 'error' };
  expose: { attachToTools: boolean; bindings: Record<string, string> };
}

/* ----------------------------- 工具类型守卫 ----------------------------- */

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
  logger?: { warn: (msg: string) => void };
  tools?: ToolsServiceLike;
}

const logWarn = (ctx: ContextLike, msg: string): void => {
  if (ctx.logger?.warn) ctx.logger.warn(msg);
  else console.warn(`[cdp] ${msg}`);
};

/* ----------------------------- 纯函数投影 ----------------------------- */

/**
 * 纯函数：在已有 description 后追加 CDP marker，零副作用、可单测。
 */
export function decorateSchemas(cap: CdpCapability, existingDescription: string): string {
  const registry = new CdpRegistry();
  return registry.decorateSchemas(cap, existingDescription);
}

/* ----------------------------- attachToTools ----------------------------- */

const SENTINEL = '[CDP:';
// 活引用幂等守卫：记录原始 description，避免重复改写 / 支持还原
const originalDescriptions = new WeakMap<object, string>();

/**
 * attachToTools 双轨之"活引用改写"实现。
 * 经 ctx.tools.get(name) 取活 definition，仅改 description（绝不碰 parameters/execute）。
 * 幂等守卫：若已记录原始值或 description 已含哨兵则跳过。
 * 返回 disposer：cordis fiber 卸载时还原 description 为原始值。
 */
export function attachToTools(
  ctx: ContextLike,
  registry: CdpRegistry,
  bindings: Record<string, string>
): () => void {
  // ctx.tools 或 ctx.tools.get 不存在 → 安静跳过，不报错（DESIGN §6.3 点④）
  if (!ctx.tools || typeof ctx.tools.get !== 'function') {
    logWarn(ctx, 'ctx.tools.get 不可用，跳过 attachToTools');
    return () => undefined;
  }

  const restorers: Array<() => void> = [];

  for (const [capId, toolName] of Object.entries(bindings)) {
    const cap = registry.get(capId);
    if (!cap) {
      logWarn(ctx, `binding 指向不存在的 capability: ${capId}`);
      continue;
    }
    const def = ctx.tools.get(toolName);
    if (!def) {
      logWarn(ctx, `binding 指向不存在的工具: ${toolName}`);
      continue;
    }
    const defObj = def as object;
    // 幂等守卫
    if (originalDescriptions.has(defObj)) continue;
    if (def.description.includes(SENTINEL)) continue; // 已改写

    originalDescriptions.set(defObj, def.description);
    const newDesc = registry.decorateSchemas(cap, def.description);
    def.description = newDesc;

    restorers.push(() => {
      const orig = originalDescriptions.get(defObj);
      if (orig !== undefined) {
        def.description = orig;
        originalDescriptions.delete(defObj);
      }
    });
  }

  return () => {
    for (const r of restorers) r();
  };
}

/* ----------------------------- 插件入口 ----------------------------- */

export const name = 'dsh-cdp-metadata';
export const inject: never[] = [];

export async function apply(ctx: ContextLike, rawConfig: unknown): Promise<void> {
  const parsed = configSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(
      `dsh-cdp-metadata 配置非法: ${parsed.error.issues
        .map((i) => i.path.join('.') + ' ' + i.message)
        .join('; ')}`
    );
  }
  const config: CdpPluginConfig = parsed.data as CdpPluginConfig;

  const registry = new CdpRegistry();

  const run = async (): Promise<void> => {
    const loaded = await loadSources(config.sources);

    for (const item of loaded.capabilities) {
      if (!item.capability) {
        // 解析 / L1 失败：按 onInvalid 处理
        const reason = item.parseError?.message ?? 'unknown parse error';
        if (config.validation.onInvalid === 'error') {
          throw new CdpValidationAggregateError([
            new CdpValidationError(item.path, reason, 'L1')
          ]);
        }
        logWarn(ctx, `L1 跳过 ${item.path}: ${reason}`);
        continue;
      }

      const cap = item.capability;
      // L2 语义校验
      const l2 = validateSemantics(cap);
      if (l2.length > 0) {
        if (config.validation.onInvalid === 'error') {
          throw new CdpValidationAggregateError(l2);
        }
        for (const e of l2) {
          logWarn(ctx, `L2 告警 ${e.path}: ${e.reason}`);
        }
        // warn 模式下仍注册（信任作者声明）
      }

      try {
        registry.register(cap, {
          conflictStrategy: config.validation.conflictStrategy
        });
      } catch (err) {
        if (err instanceof DuplicateIdError && config.validation.onInvalid === 'error') {
          throw err;
        }
        logWarn(ctx, `注册跳过 ${cap.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 注入服务
    ctx.provide('cdpRegistry', registry);

    // attachToTools 双轨
    if (config.expose.attachToTools) {
      const disposer = attachToTools(ctx, registry, config.expose.bindings);
      if (ctx.effect) {
        ctx.effect(() => disposer);
      }
    }
  };

  // 使用 effect 包裹生命周期（真实 cordis 用 effect 管卸载还原）；
  // effect 回调返回 run() 的 Promise，cordis 会 await 并在卸载时执行其返回的 disposer。
  // 若无 effect（如测试 mock 未提供），apply 自身 await run() 完成。
  // apply 始终 await 该 Promise，使调用方（cordis 与测试）能确定性等待并捕获 run 内错误。
  if (ctx.effect) {
    const p = ctx.effect(() => run()) as Promise<void> | undefined;
    await p;
  } else {
    await run();
  }
}

export default { name, apply };
