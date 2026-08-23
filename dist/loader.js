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
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CdpSecurityError } from './errors.js';
import { readCdpFile, resolveSafe, walkCdpFiles, MAX_FILES } from './fs-utils.js';
import { validateSyntax } from './schema.js';
/**
 * 加载单个文件：解析 + L1 校验。
 */
async function loadOneFile(filePath) {
    const raw = await readCdpFile(filePath);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        return { raw, path: filePath, parseError: e };
    }
    const syntax = validateSyntax(parsed);
    if (!syntax.ok) {
        // 聚合为单个报告错误，便于单文件定位
        const agg = new Error(`L1 syntax errors: ${syntax.errors.map((x) => x.message).join('; ')}`);
        return { raw, path: filePath, parseError: agg };
    }
    return { raw, path: filePath, capability: syntax.value };
}
/**
 * 加载一个目录下的所有 .cdp.json。
 */
async function loadDir(root, dirEntry) {
    const absDir = await resolveSafe(root, dirEntry);
    const stat = await fs.stat(absDir);
    // resolveSafe 已校验符号链接逃逸
    void stat;
    const walk = await walkCdpFiles(absDir);
    const out = [];
    for (const file of walk.files) {
        try {
            out.push(await loadOneFile(file));
        }
        catch (err) {
            if (err instanceof CdpSecurityError) {
                out.push({
                    raw: '',
                    path: file,
                    parseError: err,
                    skipped: true
                });
            }
            else {
                throw err;
            }
        }
    }
    if (walk.truncated) {
        // 超限信息记入最后一个占位（仅作提示，不阻断）
        out.push({
            raw: '',
            path: `${absDir} (TRUNCATED@${MAX_FILES})`,
            parseError: new Error('reached maxFiles limit'),
            skipped: true
        });
    }
    return { items: out, truncated: walk.truncated };
}
/**
 * 入口：按 config 加载所有 sources。
 * 安全错误（CdpSecurityError）向上抛出。其它 per-file 错误留在 LoadedCapability.parseError。
 */
export async function loadSources(cfg) {
    const root = path.resolve(cfg.root);
    const all = [];
    let truncated = false;
    for (const entry of cfg.paths) {
        // 先做 root 内越界校验；条目不存在（ENOENT）或越界均按 skipped 处理
        let abs;
        try {
            abs = await resolveSafe(root, entry);
        }
        catch (err) {
            if (err instanceof CdpSecurityError)
                throw err;
            // 越界校验阶段的其他错误（如条目不存在）视为 skipped
            all.push({
                raw: '',
                path: path.resolve(root, entry),
                parseError: err instanceof Error ? err : new Error(String(err)),
                skipped: true
            });
            continue;
        }
        let stat;
        try {
            stat = await fs.stat(abs);
        }
        catch (err) {
            if (err instanceof CdpSecurityError)
                throw err;
            // 文件/目录不存在 → 作为 skipped 处理
            all.push({
                raw: '',
                path: abs,
                parseError: err instanceof Error ? err : new Error(String(err)),
                skipped: true
            });
            continue;
        }
        if (stat.isDirectory()) {
            const dirResults = await loadDir(root, entry);
            all.push(...dirResults.items);
            if (dirResults.truncated)
                truncated = true;
        }
        else if (stat.isFile()) {
            try {
                all.push(await loadOneFile(abs));
            }
            catch (err) {
                if (err instanceof CdpSecurityError)
                    throw err;
                throw err;
            }
        }
    }
    const skipped = all.filter((c) => c.skipped).length;
    return { capabilities: all, skipped, truncated };
}
