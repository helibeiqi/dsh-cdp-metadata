/**
 * 文件系统安全工具（DESIGN §8 安全模型）。
 *
 * - 路径白名单 + realpath 符号链接逃逸校验
 * - 单文件大小上限 / 扫描深度上限 / 文件总数上限（DoS 防护）
 * - 唯一 IO 依赖 node:fs/promises；禁用 child_process / eval / 动态 import 被注解代码
 *
 * 任何逃逸 / 越界均抛 CdpSecurityError（永远抛，不受 onInvalid 控制）。
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CdpSecurityError } from './errors.js';

export const MAX_FILE_BYTES = 1_048_576; // 1 MiB
export const MAX_DEPTH = 8;
export const MAX_FILES = 1000;

export const CDP_FILE_EXT = '.cdp.json';

/**
 * 在 root 内安全解析相对路径。
 * 拒绝 `..` 逃逸、绝对路径逃逸、root 自身（要求显式文件/目录）、符号链接逃逸。
 */
export async function resolveSafe(
  root: string,
  relPath: string
): Promise<string> {
  const resolvedRoot = await fs.realpath(root);
  const sep = path.sep;
  // 拒绝 root 自身
  const abs = path.resolve(resolvedRoot, relPath);
  if (abs === resolvedRoot) {
    throw new CdpSecurityError(abs, 'refusing to operate on the root itself');
  }
  if (abs !== resolvedRoot && !abs.startsWith(resolvedRoot + sep)) {
    throw new CdpSecurityError(
      abs,
      `path escapes root (${resolvedRoot})`
    );
  }
  // 符号链接逃逸：realpath 解析后仍需落在 root 内
  const realAbs = await fs.realpath(abs);
  if (realAbs !== resolvedRoot && !realAbs.startsWith(resolvedRoot + sep)) {
    throw new CdpSecurityError(
      realAbs,
      `symlink target escapes root (${resolvedRoot})`
    );
  }
  return abs;
}

/**
 * 读取单个 .cdp.json 文件，带 maxFileBytes 上限。
 * 超出上限抛 CdpSecurityError（DoS 防护，不可降级）。
 */
export async function readCdpFile(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_BYTES) {
    throw new CdpSecurityError(
      filePath,
      `file too large (${stat.size} > ${MAX_FILE_BYTES})`
    );
  }
  return fs.readFile(filePath, 'utf8');
}

/**
 * 递归遍历 root 下的 .cdp.json 文件，带 maxDepth / maxFiles 上限。
 * 返回命中文件绝对路径列表（已通过 resolveSafe 安全校验）。
 * 超出 maxFiles 时停止遍历并告警（通过返回值附带 truncated 标记）。
 */
export interface WalkResult {
  files: string[];
  truncated: boolean;
}

export async function walkCdpFiles(
  root: string,
  maxDepth: number = MAX_DEPTH,
  maxFiles: number = MAX_FILES
): Promise<WalkResult> {
  const files: string[] = [];
  let truncated = false;

  async function recurse(dir: string, depth: number): Promise<void> {
    if (truncated) return;
    if (depth > maxDepth) {
      truncated = true;
      return;
    }
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      // 不可读目录（如无权限）跳过
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(abs, depth + 1);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(CDP_FILE_EXT)
      ) {
        // 安全校验（符号链接逃逸等）在读取时由 resolveSafe 处理；
        // 此处先做一次越界检查，避免把逃逸路径纳入计数
        try {
          await resolveSafe(root, path.relative(root, abs));
        } catch (err) {
          if (err instanceof CdpSecurityError) {
            continue; // 跳过逃逸条目
          }
          throw err;
        }
        files.push(abs);
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }
      }
    }
  }

  await recurse(root, 0);
  return { files, truncated };
}
