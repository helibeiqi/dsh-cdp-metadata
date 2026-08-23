/**
 * 文件系统安全工具（DESIGN §8 安全模型）。
 *
 * - 路径白名单 + realpath 符号链接逃逸校验
 * - 单文件大小上限 / 扫描深度上限 / 文件总数上限（DoS 防护）
 * - 唯一 IO 依赖 node:fs/promises；禁用 child_process / eval / 动态 import 被注解代码
 *
 * 任何逃逸 / 越界均抛 CdpSecurityError（永远抛，不受 onInvalid 控制）。
 */
export declare const MAX_FILE_BYTES = 1048576;
export declare const MAX_DEPTH = 8;
export declare const MAX_FILES = 1000;
export declare const CDP_FILE_EXT = ".cdp.json";
/**
 * 在 root 内安全解析相对路径。
 * 拒绝 `..` 逃逸、绝对路径逃逸、root 自身（要求显式文件/目录）、符号链接逃逸。
 */
export declare function resolveSafe(root: string, relPath: string): Promise<string>;
/**
 * 读取单个 .cdp.json 文件，带 maxFileBytes 上限。
 * 超出上限抛 CdpSecurityError（DoS 防护，不可降级）。
 */
export declare function readCdpFile(filePath: string): Promise<string>;
/**
 * 递归遍历 root 下的 .cdp.json 文件，带 maxDepth / maxFiles 上限。
 * 返回命中文件绝对路径列表（已通过 resolveSafe 安全校验）。
 * 超出 maxFiles 时停止遍历并告警（通过返回值附带 truncated 标记）。
 */
export interface WalkResult {
    files: string[];
    truncated: boolean;
}
export declare function walkCdpFiles(root: string, maxDepth?: number, maxFiles?: number): Promise<WalkResult>;
