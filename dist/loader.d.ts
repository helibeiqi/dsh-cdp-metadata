/**
 * 源加载（DESIGN §9 loader.ts）。
 *
 * 从 config.sources 指定的目录加载 .cdp.json：
 * 读文件 → JSON.parse → L1 语法校验 → 返回 LoadedCapability。
 * 整合 fs-utils 的安全白名单与限额。
 *
 * 安全错误（CdpSecurityError）永远上抛，不受 onInvalid 控制。
 * JSON 解析错误 / L1 错误作为 per-file parseError 返回（不静默丢弃）。
 */
import type { CdpCapability } from './types.js';
export interface LoadedCapability {
    /** 原始文本内容 */
    raw: string;
    /** 来源文件绝对路径 */
    path: string;
    /** L1 通过后解析出的能力对象 */
    capability?: CdpCapability;
    /** 解析 / L1 失败时的错误（不阻断其它文件加载） */
    parseError?: Error;
    /** 该文件是否因逃逸被跳过 */
    skipped?: boolean;
}
export interface LoadSourcesConfig {
    root: string;
    /** 相对 root 的目录或文件条目 */
    paths: string[];
}
export interface LoadResult {
    capabilities: LoadedCapability[];
    /** 被跳过（逃逸 / 超限）的文件数 */
    skipped: number;
    /** 是否触及 maxFiles 上限 */
    truncated: boolean;
}
/**
 * 入口：按 config 加载所有 sources。
 * 安全错误（CdpSecurityError）向上抛出。其它 per-file 错误留在 LoadedCapability.parseError。
 */
export declare function loadSources(cfg: LoadSourcesConfig): Promise<LoadResult>;
