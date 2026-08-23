#!/usr/bin/env node
/**
 * cdp-annotate — CDP v0.1 注解校验 CLI。
 *
 * 用法：
 *   cdp-annotate --file <path> [--level L1|L2] [--json]
 *   cdp-annotate --dir  <dir>  [--level L1|L2] [--json]
 *
 * - --level L1：仅做 L1 语法校验
 * - --level L2：L1 + L2 语义校验（默认）
 * - --json：以 JSON 输出校验结果 / 注解摘要
 *
 * 退出码：0 = 全部通过；1 = 存在校验错误；2 = 参数 / IO 错误。
 *
 * 依赖 node:fs/promises。本脚本复用 src 的 schema / validator / loader，
 * 运行方式（由 README 说明）：`node --loader tsx scripts/cdp-annotate.ts` 或编译后 `node dist/...`。
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { validateSyntax } from '../src/schema.js';
import { validateSemantics } from '../src/validator.js';
import { CdpSecurityError } from '../src/errors.js';
import { CdpRegistry } from '../src/registry.js';
import type { CdpCapability } from '../src/types.js';

interface CliOptions {
  file?: string;
  dir?: string;
  level: 'L1' | 'L2';
  json: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { level: 'L2', json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '-f') {
      opts.file = argv[++i];
    } else if (a === '--dir' || a === '-d') {
      opts.dir = argv[++i];
    } else if (a === '--level' || a === '-l') {
      const v = argv[++i];
      if (v !== 'L1' && v !== 'L2') {
        throw new Error(`--level 必须是 L1 或 L2，收到: ${v}`);
      }
      opts.level = v;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--help' || a === '-h') {
      throw new Error('USAGE: cdp-annotate --file <path> | --dir <dir> [--level L1|L2] [--json]');
    } else {
      throw new Error(`未知参数: ${a}`);
    }
  }
  if (!opts.file && !opts.dir) {
    throw new Error('必须指定 --file <path> 或 --dir <dir>');
  }
  if (opts.file && opts.dir) {
    throw new Error('--file 与 --dir 不能同时使用');
  }
  return opts;
}

interface FileReport {
  path: string;
  ok: boolean;
  l1Errors: string[];
  l2Errors: string[];
  summary?: {
    id: string;
    name: string;
    archetype: string;
    marker: string;
  };
}

async function checkFile(filePath: string, level: 'L1' | 'L2'): Promise<FileReport> {
  const report: FileReport = { path: filePath, ok: true, l1Errors: [], l2Errors: [] };
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    report.ok = false;
    report.l1Errors.push(`读取失败: ${err instanceof Error ? err.message : String(err)}`);
    return report;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    report.ok = false;
    report.l1Errors.push(`JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`);
    return report;
  }

  const syntax = validateSyntax(parsed);
  if (!syntax.ok) {
    report.ok = false;
    report.l1Errors = syntax.errors.map((e) => `${e.path}: ${e.reason}`);
    return report; // L1 失败则不做 L2
  }

  const cap: CdpCapability = syntax.value;
  if (level === 'L2') {
    const l2 = validateSemantics(cap);
    if (l2.length > 0) {
      report.ok = false;
      report.l2Errors = l2.map((e) => `${e.path}: ${e.reason}`);
    }
  }

  const registry = new CdpRegistry();
  report.summary = {
    id: cap.id,
    name: cap.identity.name,
    archetype: cap.identity.archetype,
    marker: registry.formatMarker(cap)
  };
  return report;
}

async function collectFiles(opts: CliOptions): Promise<string[]> {
  if (opts.file) return [path.resolve(opts.file)];
  const dir = path.resolve(opts.dir as string);
  const out: string[] = [];
  async function recurse(d: string, depth: number): Promise<void> {
    if (depth > 8) return;
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) await recurse(abs, depth + 1);
      else if (e.isFile() && e.name.endsWith('.cdp.json')) out.push(abs);
    }
  }
  await recurse(dir, 0);
  return out;
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  let files: string[];
  try {
    files = await collectFiles(opts);
  } catch (err) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: String(err) }) + '\n');
    } else {
      process.stderr.write(`[cdp] ${err instanceof Error ? err.message : String(err)}\n`);
    }
    return 2;
  }

  const reports: FileReport[] = [];
  let anyFail = false;
  for (const f of files) {
    try {
      const r = await checkFile(f, opts.level);
      reports.push(r);
      if (!r.ok) anyFail = true;
    } catch (err) {
      if (err instanceof CdpSecurityError) {
        reports.push({
          path: f,
          ok: false,
          l1Errors: [`安全错误: ${err.message}`],
          l2Errors: []
        });
        anyFail = true;
      } else {
        throw err;
      }
    }
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({ reports, anyFail }, null, 2) + '\n');
  } else {
    for (const r of reports) {
      if (r.ok) {
        process.stdout.write(`[OK] ${r.path} ${r.summary ? r.summary.marker : ''}\n`);
      } else {
        process.stdout.write(`[FAIL] ${r.path}\n`);
        for (const e of r.l1Errors) process.stdout.write(`  L1 ${e}\n`);
        for (const e of r.l2Errors) process.stdout.write(`  L2 ${e}\n`);
      }
    }
    process.stdout.write(`\n总计 ${reports.length} 文件，失败 ${anyFail ? '有' : '无'}\n`);
  }
  return anyFail ? 1 : 0;
}

// 仅当以脚本方式直接运行（而非被 import）时执行 main。
// 通过对比 import.meta.url 与进程入口判断。
function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    const entryUrl = entry.startsWith('file://') ? entry : `file://${entry}`;
    return import.meta.url === entryUrl || import.meta.url.endsWith(entry.replace(/\\/g, '/'));
  } catch {
    return false;
  }
}

export { parseArgs, checkFile, collectFiles, main };
export type { CliOptions, FileReport };

if (isMain()) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`[cdp] 致命错误: ${err instanceof Error ? err.stack : String(err)}\n`);
      process.exit(2);
    });
}
