/**
 * L2 语义静态检查（DESIGN §4 L2、§9 semantic.ts）。
 *
 * 纯静态、字符串级，不执行任何代码。规则：
 * (a) can/cannot 冲突检测（核心算法，含否定词启发式）
 * (b) downstream_hints.if_tag 必须命中 semantic_tags
 * (c) cost.latency 格式（兜底，L1 已校验，此处再保一次）
 * (d) 跨字段一致性告警（none+scope、archetype 两处不一致）
 *
 * L3 仅留接口 `validateDeep?` 不实现（见文件末尾 TODO）。
 *
 * 诚实边界：本文件所有冲突检测都是**字符串级启发式**，不是语义推理。
 * 会漏检同义改写、抽象层级差异、多语言不一致（见 DESIGN §4 / §10）。
 */
import { CdpValidationError } from './errors.js';
import type { CdpCapability } from './types.js';
/** 否定词前缀表（中英文）。用于"否定启发式"。 */
export declare const NEG: readonly string[];
export declare function normalize(s: string): string;
/**
 * 去掉头部一个否定词前缀（若有），返回去否定后的归一化串。
 * 若本身无否定前缀，返回原归一化串。
 */
export declare function stripNegation(s: string): string;
export declare function hasNegation(s: string): boolean;
/**
 * (a) can/cannot 冲突检测。
 *
 * 1. 直接相交：can 与 cannot 字面归一化后相同 → 直接矛盾。
 * 2. 否定启发式：cannot 项去掉否定前缀后，与某 can 项（去否定或原样）互为等价；
 *    或 can 项带否定、cannot 项为肯定式，同样判定。
 *
 * 注意：首尾包含（token 边界内）也会命中，以避免 "不能预测涨跌" vs "预测涨跌" 漏检。
 */
export declare function checkConflicts(cap: CdpCapability): CdpValidationError[];
/**
 * (b) downstream_hints.if_tag 必须命中 semantic_tags。
 */
export declare function checkTagHints(cap: CdpCapability): CdpValidationError[];
/**
 * (c) cost.latency 格式（L1 已校验，此处再保一次）。
 */
export declare function checkLatency(cap: CdpCapability): CdpValidationError[];
/**
 * (d) 跨字段一致性（告警级，不阻断注册）。
 */
export declare function checkCrossField(cap: CdpCapability): CdpValidationError[];
/**
 * L2 总入口：运行全部规则，聚合返回 CdpValidationError[]。
 */
export declare function validateSemantics(cap: CdpCapability): CdpValidationError[];
/**
 * L3 — 行为验证接口占位（DESIGN §4 L3）。
 * 本插件是只读元数据层，无执行权限、无沙箱，L3 不可行，仅留签名。不实现。
 */
export type ValidateDeep = (cap: CdpCapability) => Promise<CdpValidationError[]>;
