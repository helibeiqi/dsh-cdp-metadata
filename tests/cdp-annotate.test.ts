import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs, checkFile, collectFiles } from '../scripts/cdp-annotate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => join(__dirname, 'fixtures', n);

describe('cdp-annotate CLI', () => {
  it('parseArgs: --file + 默认 L2', () => {
    const o = parseArgs(['--file', 'a.cdp.json']);
    expect(o.file).toBe('a.cdp.json');
    expect(o.level).toBe('L2');
    expect(o.json).toBe(false);
  });

  it('parseArgs: --level L1 + --json', () => {
    const o = parseArgs(['--dir', 'd', '--level', 'L1', '--json']);
    expect(o.dir).toBe('d');
    expect(o.level).toBe('L1');
    expect(o.json).toBe(true);
  });

  it('parseArgs: --level 非法抛错', () => {
    expect(() => parseArgs(['--file', 'a', '--level', 'X'])).toThrow();
  });

  it('parseArgs: 缺少 --file/--dir 抛错', () => {
    expect(() => parseArgs(['--json'])).toThrow();
  });

  it('parseArgs: --file 与 --dir 互斥', () => {
    expect(() => parseArgs(['--file', 'a', '--dir', 'd'])).toThrow();
  });

  it('checkFile L2 对 valid 通过', async () => {
    const r = await checkFile(fx('valid-stock-analyzer.cdp.json'), 'L2');
    expect(r.ok).toBe(true);
    expect(r.summary?.id).toBe('stock_analyzer@v1.0');
    expect(r.summary?.marker).toContain('[CDP:');
  });

  it('checkFile L1 对 invalid-l1 报错', async () => {
    const r = await checkFile(fx('invalid-l1.cdp.json'), 'L1');
    expect(r.ok).toBe(false);
    expect(r.l1Errors.length).toBeGreaterThan(0);
  });

  it('checkFile L2 对 invalid-l2 捕获 can/cannot 冲突', async () => {
    const r = await checkFile(fx('invalid-l2.cdp.json'), 'L2');
    expect(r.ok).toBe(false);
    expect(r.l2Errors.some((e) => e.includes('直接矛盾'))).toBe(true);
  });

  it('collectFiles 扫描 fixtures 目录', async () => {
    const files = await collectFiles({ dir: join(__dirname, 'fixtures'), level: 'L2', json: false });
    expect(files.length).toBe(3);
  });
});
