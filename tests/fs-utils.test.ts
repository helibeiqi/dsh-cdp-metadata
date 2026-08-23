import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import {
  resolveSafe,
  readCdpFile,
  walkCdpFiles,
  MAX_FILE_BYTES,
  MAX_DEPTH,
  MAX_FILES
} from '../src/fs-utils.js';
import { CdpSecurityError } from '../src/errors.js';

describe('fs-utils 安全', () => {
  it('resolveSafe 拒绝 .. 逃逸', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      await expect(resolveSafe(root, '../escape')).rejects.toBeInstanceOf(CdpSecurityError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolveSafe 拒绝绝对路径逃逸', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      await expect(resolveSafe(root, '/etc/passwd')).rejects.toBeInstanceOf(CdpSecurityError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolveSafe 拒绝 root 自身', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      await expect(resolveSafe(root, '.')).rejects.toBeInstanceOf(CdpSecurityError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolveSafe 允许 root 内合法文件', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      const target = path.join(root, 'a.cdp.json');
      await fs.writeFile(target, '{}');
      const r = await resolveSafe(root, 'a.cdp.json');
      expect(r).toBe(target);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('readCdpFile 拒绝超大文件', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      const big = path.join(root, 'big.cdp.json');
      // 写入超过 MAX_FILE_BYTES 的内容
      await fs.writeFile(big, 'x'.repeat(MAX_FILE_BYTES + 10));
      await expect(readCdpFile(big)).rejects.toBeInstanceOf(CdpSecurityError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('walkCdpFiles 仅收集 .cdp.json 并受 maxDepth 限制', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      await fs.writeFile(path.join(root, 'a.cdp.json'), '{}');
      await fs.writeFile(path.join(root, 'b.txt'), '{}');
      const deep = path.join(root, 'd1', 'd2', 'd3');
      await fs.mkdir(deep, { recursive: true });
      await fs.writeFile(path.join(deep, 'deep.cdp.json'), '{}');
      // maxDepth=1 应排除 deep.cdp.json
      const r = await walkCdpFiles(root, 1, MAX_FILES);
      expect(r.files.length).toBe(1);
      expect(r.files[0].endsWith('a.cdp.json')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('walkCdpFiles 受 maxFiles 限制并标记 truncated', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cdp-root-'));
    try {
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(root, `f${i}.cdp.json`), '{}');
      }
      const r = await walkCdpFiles(root, MAX_DEPTH, 3);
      expect(r.files.length).toBe(3);
      expect(r.truncated).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
