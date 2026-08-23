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
import { LATENCY_PATTERN } from './schema.js';
/** 否定词前缀表（中英文）。用于"否定启发式"。 */
export const NEG = [
    '不',
    '不能',
    '无法',
    '禁止',
    '不可以',
    '不该',
    '不应',
    '无',
    '别',
    '勿',
    '没',
    '没有',
    'non-',
    'not ',
    'never ',
    'disallow',
    'forbid'
];
const latencyRegex = new RegExp(LATENCY_PATTERN);
export function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
/**
 * 去掉头部一个否定词前缀（若有），返回去否定后的归一化串。
 * 若本身无否定前缀，返回原归一化串。
 */
export function stripNegation(s) {
    const n = normalize(s);
    for (const neg of NEG) {
        const lowerNeg = neg.toLowerCase();
        if (n.startsWith(lowerNeg)) {
            return n.slice(lowerNeg.length).trim();
        }
    }
    return n;
}
export function hasNegation(s) {
    const n = normalize(s);
    return NEG.some((neg) => n.startsWith(neg.toLowerCase()));
}
/**
 * (a) can/cannot 冲突检测。
 *
 * 1. 直接相交：can 与 cannot 字面归一化后相同 → 直接矛盾。
 * 2. 否定启发式：cannot 项去掉否定前缀后，与某 can 项（去否定或原样）互为等价；
 *    或 can 项带否定、cannot 项为肯定式，同样判定。
 *
 * 注意：首尾包含（token 边界内）也会命中，以避免 "不能预测涨跌" vs "预测涨跌" 漏检。
 */
export function checkConflicts(cap) {
    const errors = [];
    const can = cap.boundaries.can;
    const cannot = cap.boundaries.cannot;
    const normalizeList = (xs) => xs.map(normalize);
    const canN = normalizeList(can);
    const cannotN = normalizeList(cannot);
    // 1. 直接相交
    for (let i = 0; i < canN.length; i++) {
        for (let j = 0; j < cannotN.length; j++) {
            if (canN[i] === cannotN[j]) {
                errors.push(new CdpValidationError(`capability.boundaries.cannot[${j}]`, `与 can[${i}]("${can[i]}") 直接矛盾`, 'L2'));
            }
        }
    }
    // 2. 否定启发式（对称）
    const checkPair = (posList, posN, negList, negN, negBasePath) => {
        for (let j = 0; j < negN.length; j++) {
            const stripped = stripNegation(negList[j]); // 去否定后的归一化串
            for (let i = 0; i < posN.length; i++) {
                const posStripped = stripNegation(posList[i]);
                // 等价（任一去否定后相同）或 首尾包含
                const equivalent = stripped === posN[i] || stripped === posStripped;
                const contained = stripped.length > 0 &&
                    (posN[i].includes(stripped) || stripped.includes(posN[i]));
                if (equivalent || contained) {
                    errors.push(new CdpValidationError(`${negBasePath}[${j}]`, `是 can[${i}]("${posList[i]}") 的语义否定`, 'L2'));
                }
            }
        }
    };
    // cannot(含否定) vs can(肯定)
    checkPair(can, canN, cannot, cannotN, 'capability.boundaries.cannot');
    // can(含否定) vs cannot(肯定) 对称处理
    checkPair(cannot, cannotN, can, canN, 'capability.boundaries.can');
    return errors;
}
/**
 * (b) downstream_hints.if_tag 必须命中 semantic_tags。
 */
export function checkTagHints(cap) {
    const errors = [];
    const tags = cap.output.semantic_tags;
    cap.output.downstream_hints.forEach((hint, idx) => {
        if (!tags.includes(hint.if_tag)) {
            errors.push(new CdpValidationError(`capability.output.downstream_hints[${idx}].if_tag`, `未出现在 semantic_tags 中 ("${hint.if_tag}")`, 'L2'));
        }
    });
    return errors;
}
/**
 * (c) cost.latency 格式（L1 已校验，此处再保一次）。
 */
export function checkLatency(cap) {
    const errors = [];
    if (!latencyRegex.test(cap.runtime.cost.latency)) {
        errors.push(new CdpValidationError('capability.runtime.cost.latency', `非法 latency 格式 "${cap.runtime.cost.latency}" (应为 <1s / 500ms / 2m / 1h)`, 'L2'));
    }
    return errors;
}
/**
 * (d) 跨字段一致性（告警级，不阻断注册）。
 */
export function checkCrossField(cap) {
    const errors = [];
    if (cap.runtime.side_effects.level === 'none' &&
        cap.runtime.side_effects.scope.length > 0) {
        errors.push(new CdpValidationError('capability.runtime.side_effects.scope', '声明 side_effects.level=none 却列出 scope', 'L2'));
    }
    if (cap.identity.archetype !== cap.cognitive_style.archetype) {
        errors.push(new CdpValidationError('capability.cognitive_style.archetype', `与 identity.archetype("${cap.identity.archetype}") 不一致`, 'L2'));
    }
    return errors;
}
/**
 * L2 总入口：运行全部规则，聚合返回 CdpValidationError[]。
 */
export function validateSemantics(cap) {
    return [
        ...checkConflicts(cap),
        ...checkTagHints(cap),
        ...checkLatency(cap),
        ...checkCrossField(cap)
    ];
}
// 显式不实现：export const validateDeep: ValidateDeep | undefined = undefined;
