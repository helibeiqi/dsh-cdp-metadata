import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { apply, attachToTools, decorateSchemas, name } from '../src/integration.js';
import { CdpRegistry } from '../src/registry.js';
import { CdpValidationError, CdpValidationAggregateError } from '../src/errors.js';
import type { CdpCapability } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => join(__dirname, 'fixtures', n);

// 直接读取 fixture 文件构造能力对象
async function loadValidCap(): Promise<CdpCapability> {
  const raw = await fs.readFile(fx('valid-stock-analyzer.cdp.json'), 'utf8');
  const doc = JSON.parse(raw) as { capability: CdpCapability };
  return doc.capability;
}

interface MockCtx {
  provided: Record<string, unknown>;
  effects: unknown[];
  logger: { warn: ReturnType<typeof vi.fn> };
  tools?: { get: (name: string) => { description: string } | undefined };
  provide: (n: string, v: unknown) => void;
  effect?: (fn: () => unknown) => unknown;
}

function makeCtx(): MockCtx {
  const ctx: MockCtx = {
    provided: {},
    effects: [],
    logger: { warn: vi.fn() },
    provide: (n, v) => {
      ctx.provided[n] = v;
    },
    effect: (fn) => {
      // 模拟 cordis：立即执行 effect 回调，并捕获其返回的 disposer
      const disposer = fn();
      ctx.effects.push(disposer);
      return disposer;
    }
  };
  return ctx;
}

describe('integration 插件入口', () => {
  it('name 固定 dsh-cdp-metadata', () => {
    expect(name).toBe('dsh-cdp-metadata');
  });

  it('默认 attachToTools=false 时不改 tools，且注入 cdpRegistry', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      const cap = await loadValidCap();
      await fs.writeFile(path.join(root, 'a.cdp.json'), JSON.stringify({ capability: cap }));

      await apply(ctx as never, {
        sources: { root, paths: ['a.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        expose: { attachToTools: false, bindings: {} }
      });

      expect(ctx.provided['cdpRegistry']).toBeInstanceOf(CdpRegistry);
      const reg = ctx.provided['cdpRegistry'] as CdpRegistry;
      expect(reg.get('stock_analyzer@v1.0')).toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('开启 attachToTools 经 ctx.tools.get 活引用改 description 且幂等、disposer 还原', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      const cap = await loadValidCap();
      await fs.writeFile(path.join(root, 'a.cdp.json'), JSON.stringify({ capability: cap }));

      const toolDef = { description: '原始工具描述' };
      const getSpy = vi.fn(() => toolDef);
      ctx.tools = { get: getSpy };

      await apply(ctx as never, {
        sources: { root, paths: ['a.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        expose: { attachToTools: true, bindings: { 'stock_analyzer@v1.0': 'tool_a' } }
      });

      // 活引用被改写
      expect(toolDef.description).toContain('[CDP:');
      expect(toolDef.description).toContain('原始工具描述');
      // attachToTools 应被调用一次
      expect(getSpy).toHaveBeenCalled();

      // 幂等：再次 apply 同类不应重复改写（WeakMap 守卫由同一 attachToTools 调用完成，这里验证 marker 只出现一次）
      expect((toolDef.description.match(/\[CDP:/g) ?? []).length).toBe(1);

      // 还原：effect 注册的 disposer 应还原 description
      // 模拟 fiber 卸载：手动调用 effect 返回的 disposer
      // apply 内部 effect 返回的是占位；真正的还原在 attachToTools 的 disposer。
      // 为覆盖还原逻辑，单独测 attachToTools 的 disposer：
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('attachToTools 返回 disposer 还原原始 description', () => {
    const ctx = makeCtx();
    const reg = new CdpRegistry();
    reg.register({
      id: 'cap@v1.0',
      identity: { name: 'c', archetype: 'analyzer' },
      boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
      cognitive_style: { reasoning_type: 'deductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype: 'analyzer' },
      output: { semantic_tags: ['t'], downstream_hints: [{ if_tag: 't', suggest_to: 'x' }] },
      runtime: { side_effects: { level: 'none', scope: [] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } }
    });
    const def = { description: '原描述' } as { description: string };
    ctx.tools = { get: () => def };
    const disposer = attachToTools(ctx as never, reg, { 'cap@v1.0': 'tool_x' });
    expect(def.description).toContain('[CDP:');
    // 幂等：同一 def 对象再次 attach 不重复改写（WeakMap 守卫）
    attachToTools(ctx as never, reg, { 'cap@v1.0': 'tool_x' });
    expect((def.description.match(/\[CDP:/g) ?? []).length).toBe(1);
    // disposer 还原原始 description
    disposer();
    expect(def.description).toBe('原描述');
  });

  it('ctx.tools 不可用时安静跳过', () => {
    const ctx = makeCtx();
    const reg = new CdpRegistry();
    reg.register({
      id: 'cap@v1.0',
      identity: { name: 'c', archetype: 'analyzer' },
      boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
      cognitive_style: { reasoning_type: 'deductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype: 'analyzer' },
      output: { semantic_tags: ['t'], downstream_hints: [{ if_tag: 't', suggest_to: 'x' }] },
      runtime: { side_effects: { level: 'none', scope: [] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } }
    });
    const disposer = attachToTools(ctx as never, reg, {});
    expect(disposer()).toBeUndefined();
  });

  it('decorateSchemas 纯函数零副作用', () => {
    const cap = {
      id: 'cap@v1.0',
      identity: { name: 'c', archetype: 'analyzer' as const },
      boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
      cognitive_style: { reasoning_type: 'deductive' as const, uncertainty_expression: 'explicit' as const, failure_mode: 'fail_loud' as const, archetype: 'analyzer' as const },
      output: { semantic_tags: ['t'], downstream_hints: [{ if_tag: 't', suggest_to: 'x' }] },
      runtime: { side_effects: { level: 'none' as const, scope: [] }, cost: { compute: 'low' as const, latency: '<1s', monetary: 'free' as const } }
    };
    const out = decorateSchemas(cap, 'desc');
    expect(out).toContain('desc');
    expect(out).toContain('[CDP:');
  });

  it('L1 失败且 onInvalid=error 时上抛聚合错误', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      await fs.writeFile(
        path.join(root, 'bad.cdp.json'),
        JSON.stringify({ capability: { id: 'bad' } })
      );
      await expect(
        apply(ctx as never, {
          sources: { root, paths: ['bad.cdp.json'] },
          validation: { onInvalid: 'error', conflictStrategy: 'prefix' },
          expose: { attachToTools: false, bindings: {} }
        })
      ).rejects.toBeInstanceOf(CdpValidationAggregateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('L1 失败且 onInvalid=warn 时跳过并告警', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      await fs.writeFile(
        path.join(root, 'bad.cdp.json'),
        JSON.stringify({ capability: { id: 'bad' } })
      );
      await apply(ctx as never, {
        sources: { root, paths: ['bad.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        expose: { attachToTools: false, bindings: {} }
      });
      const reg = ctx.provided['cdpRegistry'] as CdpRegistry;
      expect(reg.list().length).toBe(0);
      expect(ctx.logger.warn).toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('L2 失败且 onInvalid=warn 时仍注册并告警', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      await fs.copyFile(
        join(__dirname, 'fixtures', 'invalid-l2.cdp.json'),
        join(root, 'conflict.cdp.json')
      );
      await apply(ctx as never, {
        sources: { root, paths: ['conflict.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        expose: { attachToTools: false, bindings: {} }
      });
      const reg = ctx.provided['cdpRegistry'] as CdpRegistry;
      // warn 模式：L2 失败仍注册（信任作者声明）
      expect(reg.list().length).toBe(1);
      expect(ctx.logger.warn).toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('重复 id 且 onInvalid=warn 时跳过该条并告警', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      // 两个相同 id 的合法能力 → 第二次注册抛 DuplicateIdError
      await fs.writeFile(
        join(root, 'a1.cdp.json'),
        JSON.stringify({ capability: capValid() })
      );
      await fs.writeFile(
        join(root, 'a2.cdp.json'),
        JSON.stringify({ capability: capValid() })
      );
      await apply(ctx as never, {
        sources: { root, paths: ['a1.cdp.json', 'a2.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'error' },
        expose: { attachToTools: false, bindings: {} }
      });
      const reg = ctx.provided['cdpRegistry'] as CdpRegistry;
      // warn + conflictStrategy=error 在 register 阶段抛错但被 apply 捕获跳过
      expect(reg.list().length).toBe(1);
      expect(ctx.logger.warn).toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('无 ctx.effect 时仍执行 run 并注入 registry', async () => {
    const ctx = makeCtx();
    delete ctx.effect; // 模拟无 effect 的环境
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      await fs.writeFile(path.join(root, 'a.cdp.json'), JSON.stringify({ capability: capValid() }));
      await apply(ctx as never, {
        sources: { root, paths: ['a.cdp.json'] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        expose: { attachToTools: false, bindings: {} }
      });
      expect(ctx.provided['cdpRegistry']).toBeInstanceOf(CdpRegistry);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('配置非法时直接抛错', async () => {
    const ctx = makeCtx();
    await expect(
      apply(ctx as never, {
        // 缺少 expose 段 + 多余未知字段 → 非法（strict schema 拒绝）
        sources: { root: '/x', paths: [] },
        validation: { onInvalid: 'warn', conflictStrategy: 'prefix' },
        exposeMissing: true
      } as never)
    ).rejects.toThrow();
  });

  it('L2 失败且 onInvalid=error 时上抛聚合错误', async () => {
    const ctx = makeCtx();
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-it-'));
    try {
      // invalid-l2 含 can/cannot 直接冲突 → L2 失败
      await fs.copyFile(
        join(__dirname, 'fixtures', 'invalid-l2.cdp.json'),
        join(root, 'conflict.cdp.json')
      );
      await expect(
        apply(ctx as never, {
          sources: { root, paths: ['conflict.cdp.json'] },
          validation: { onInvalid: 'error', conflictStrategy: 'prefix' },
          expose: { attachToTools: false, bindings: {} }
        })
      ).rejects.toBeInstanceOf(CdpValidationAggregateError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('attachToTools 开启但绑定缺失工具时安静跳过', async () => {
    const ctx = makeCtx();
    const reg = new CdpRegistry();
    reg.register(capValid());
    ctx.tools = { get: () => undefined }; // 返回 undefined（工具不存在）
    const disposer = attachToTools(ctx as never, reg, { 'stock_analyzer@v1.0': 'missing_tool' });
    expect(disposer()).toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('attachToTools 当 ctx.tools 不存在时安静返回 no-op', () => {
    const ctx = makeCtx();
    const reg = new CdpRegistry();
    reg.register(capValid());
    delete ctx.tools; // 无 tools 服务
    const disposer = attachToTools(ctx as never, reg, { 'stock_analyzer@v1.0': 'tool_x' });
    expect(disposer()).toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('attachToTools 绑定指向不存在的 capability 时告警跳过', () => {
    const ctx = makeCtx();
    const reg = new CdpRegistry();
    ctx.tools = { get: () => ({ description: 'd' }) };
    const disposer = attachToTools(ctx as never, reg, { 'ghost@v9.9': 'tool_x' });
    expect(disposer()).toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalled();
  });
});

function capValid(): CdpCapability {
  return {
    id: 'stock_analyzer@v1.0',
    identity: { name: '股票技术分析器', archetype: 'analyzer' },
    boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
    cognitive_style: { reasoning_type: 'inductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype: 'analyzer' },
    output: { semantic_tags: ['t'], downstream_hints: [{ if_tag: 't', suggest_to: 'x' }] },
    runtime: { side_effects: { level: 'read-only', scope: ['cache'] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } }
  };
}

void CdpValidationError;
