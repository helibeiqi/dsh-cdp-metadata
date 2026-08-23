import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { loadSources } from '../src/loader.js';
import { walkCdpFiles } from '../src/fs-utils.js';
import { CdpSecurityError } from '../src/errors.js';
import type { CdpCapability } from '../src/types.js';

function cap(id: string): CdpCapability {
  return {
    id,
    identity: { name: id, archetype: 'analyzer' },
    boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
    cognitive_style: { reasoning_type: 'deductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype: 'analyzer' },
    output: { semantic_tags: ['t'], downstream_hints: [{ if_tag: 't', suggest_to: 'x' }] },
    runtime: { side_effects: { level: 'none', scope: [] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } }
  };
}

describe('loader 加载', () => {
  it('加载目录下的 .cdp.json 并注册', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      await fs.mkdir(path.join(root, 'sub'));
      await fs.writeFile(path.join(root, 'sub', 'a.cdp.json'), JSON.stringify({ capability: cap('a@v1.0') }));
      await fs.writeFile(path.join(root, 'b.cdp.json'), JSON.stringify({ capability: cap('b@v1.0') }));
      const r = await loadSources({ root, paths: ['sub', 'b.cdp.json'] });
      expect(r.capabilities.length).toBe(2);
      expect(r.capabilities.every((c) => c.capability)).toBe(true);
      expect(r.skipped).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('加载单个文件', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      await fs.writeFile(path.join(root, 'a.cdp.json'), JSON.stringify({ capability: cap('a@v1.0') }));
      const r = await loadSources({ root, paths: ['a.cdp.json'] });
      expect(r.capabilities.length).toBe(1);
      expect(r.capabilities[0].capability?.id).toBe('a@v1.0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('不存在的文件计入 skipped（parseError）', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      const r = await loadSources({ root, paths: ['nope.cdp.json'] });
      expect(r.skipped).toBe(1);
      expect(r.capabilities[0].skipped).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('JSON 解析失败保留 parseError', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      await fs.writeFile(path.join(root, 'bad.cdp.json'), '{not json');
      const r = await loadSources({ root, paths: ['bad.cdp.json'] });
      expect(r.capabilities[0].parseError).toBeDefined();
      expect(r.capabilities[0].capability).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('CdpSecurityError 在目录扫描中上抛', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      // 目录条目指向越界路径触发 resolveSafe 抛错
      await expect(loadSources({ root, paths: ['../escape'] })).rejects.toBeInstanceOf(CdpSecurityError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('嵌套目录递归加载', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      await fs.mkdir(path.join(root, 'nested', 'deep'), { recursive: true });
      await fs.writeFile(path.join(root, 'nested', 'deep', 'c.cdp.json'), JSON.stringify({ capability: cap('c@v1.0') }));
      const r = await loadSources({ root, paths: ['nested'] });
      expect(r.capabilities.length).toBe(1);
      expect(r.capabilities[0].capability?.id).toBe('c@v1.0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('不存在的目录条目计入 skipped', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-load-'));
    try {
      // 目录形态条目不存在 → stat ENOENT → skipped（覆盖 loader.ts 141-149）
      const r = await loadSources({ root, paths: ['ghost-dir'] });
      expect(r.skipped).toBe(1);
      expect(r.capabilities[0].skipped).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('walkCdpFiles 忽略非 .cdp.json 文件', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-walk-'));
    try {
      await fs.writeFile(path.join(root, 'keep.cdp.json'), JSON.stringify({ capability: cap('k@v1.0') }));
      await fs.writeFile(path.join(root, 'ignore.txt'), 'noise');
      await fs.writeFile(path.join(root, 'ignore.json'), '{"x":1}');
      const w = await walkCdpFiles(root);
      expect(w.files.length).toBe(1);
      expect(w.files[0].endsWith('keep.cdp.json')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('walkCdpFiles 达到 maxFiles 上限时标记 truncated 并停止收集', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-walk-'));
    try {
      // 创建 25 个文件，传小 maxFiles=10 触发截断分支（避免千级文件 IO 超时）
      const count = 25;
      for (let i = 0; i < count; i++) {
        await fs.writeFile(
          path.join(root, `f${i}.cdp.json`),
          JSON.stringify({ capability: cap(`f${i}@v1.0`) })
        );
      }
      const small = 10;
      const w = await walkCdpFiles(root, undefined, small);
      expect(w.truncated).toBe(true);
      expect(w.files.length).toBe(small);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
