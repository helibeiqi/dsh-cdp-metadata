/**
 * L1 语法校验（DESIGN §4 L1、§9 schema.ts）。
 *
 * 使用 zod 实现，逐项镜像 docs/CDP-SCHEMA.v0.1.json：
 * - 必填字段存在
 * - 枚举合法
 * - id / latency 格式（regex）
 * - 数组项 minLength=1（非空字符串）
 * - additionalProperties:false（禁止未知字段）
 *
 * 导出：
 * - cdpCapabilitySchema：zod schema（capability 对象）
 * - cdpDocumentSchema：顶层 { capability }
 * - validateSyntax(doc): 返回 { value } 或 { errors }
 */
import { z } from 'zod';
import { CdpValidationError } from './errors.js';
import type { CdpCapability, CdpDocument } from './types.js';
export declare const ID_PATTERN = "^[A-Za-z0-9_.-]+@v?\\d+\\.\\d+$";
export declare const LATENCY_PATTERN = "^(<)?\\d+(\\.\\d+)?(ms|[smh])$";
export declare const cdpCapabilitySchema: z.ZodObject<{
    id: z.ZodString;
    identity: z.ZodObject<{
        name: z.ZodString;
        archetype: z.ZodEnum<["analyzer", "executor", "advisor", "orchestrator", "validator"]>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
    }, {
        name: string;
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
    }>;
    boundaries: z.ZodObject<{
        can: z.ZodArray<z.ZodString, "many">;
        cannot: z.ZodArray<z.ZodString, "many">;
        requires: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        can: string[];
        cannot: string[];
        requires: string[];
    }, {
        can: string[];
        cannot: string[];
        requires: string[];
    }>;
    cognitive_style: z.ZodObject<{
        reasoning_type: z.ZodEnum<["deductive", "inductive", "abductive"]>;
        uncertainty_expression: z.ZodEnum<["explicit", "implicit"]>;
        failure_mode: z.ZodEnum<["fail_loud", "fail_silent"]>;
        archetype: z.ZodEnum<["analyzer", "executor", "advisor", "orchestrator", "validator"]>;
    }, "strict", z.ZodTypeAny, {
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        reasoning_type: "deductive" | "inductive" | "abductive";
        uncertainty_expression: "explicit" | "implicit";
        failure_mode: "fail_loud" | "fail_silent";
    }, {
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        reasoning_type: "deductive" | "inductive" | "abductive";
        uncertainty_expression: "explicit" | "implicit";
        failure_mode: "fail_loud" | "fail_silent";
    }>;
    output: z.ZodObject<{
        semantic_tags: z.ZodArray<z.ZodString, "many">;
        downstream_hints: z.ZodArray<z.ZodObject<{
            if_tag: z.ZodString;
            suggest_to: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            if_tag: string;
            suggest_to: string;
        }, {
            if_tag: string;
            suggest_to: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        semantic_tags: string[];
        downstream_hints: {
            if_tag: string;
            suggest_to: string;
        }[];
    }, {
        semantic_tags: string[];
        downstream_hints: {
            if_tag: string;
            suggest_to: string;
        }[];
    }>;
    runtime: z.ZodObject<{
        side_effects: z.ZodObject<{
            level: z.ZodEnum<["none", "read-only", "state-changing", "irreversible"]>;
            scope: z.ZodArray<z.ZodString, "many">;
        }, "strict", z.ZodTypeAny, {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        }, {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        }>;
        cost: z.ZodObject<{
            compute: z.ZodEnum<["low", "mid", "high"]>;
            latency: z.ZodString;
            monetary: z.ZodEnum<["free", "per_call", "metered"]>;
        }, "strict", z.ZodTypeAny, {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        }, {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        }>;
    }, "strict", z.ZodTypeAny, {
        side_effects: {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        };
        cost: {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        };
    }, {
        side_effects: {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        };
        cost: {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        };
    }>;
}, "strict", z.ZodTypeAny, {
    id: string;
    identity: {
        name: string;
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
    };
    boundaries: {
        can: string[];
        cannot: string[];
        requires: string[];
    };
    cognitive_style: {
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        reasoning_type: "deductive" | "inductive" | "abductive";
        uncertainty_expression: "explicit" | "implicit";
        failure_mode: "fail_loud" | "fail_silent";
    };
    output: {
        semantic_tags: string[];
        downstream_hints: {
            if_tag: string;
            suggest_to: string;
        }[];
    };
    runtime: {
        side_effects: {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        };
        cost: {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        };
    };
}, {
    id: string;
    identity: {
        name: string;
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
    };
    boundaries: {
        can: string[];
        cannot: string[];
        requires: string[];
    };
    cognitive_style: {
        archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        reasoning_type: "deductive" | "inductive" | "abductive";
        uncertainty_expression: "explicit" | "implicit";
        failure_mode: "fail_loud" | "fail_silent";
    };
    output: {
        semantic_tags: string[];
        downstream_hints: {
            if_tag: string;
            suggest_to: string;
        }[];
    };
    runtime: {
        side_effects: {
            level: "none" | "read-only" | "state-changing" | "irreversible";
            scope: string[];
        };
        cost: {
            compute: "low" | "mid" | "high";
            latency: string;
            monetary: "free" | "per_call" | "metered";
        };
    };
}>;
export declare const cdpDocumentSchema: z.ZodObject<{
    capability: z.ZodObject<{
        id: z.ZodString;
        identity: z.ZodObject<{
            name: z.ZodString;
            archetype: z.ZodEnum<["analyzer", "executor", "advisor", "orchestrator", "validator"]>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        }, {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        }>;
        boundaries: z.ZodObject<{
            can: z.ZodArray<z.ZodString, "many">;
            cannot: z.ZodArray<z.ZodString, "many">;
            requires: z.ZodArray<z.ZodString, "many">;
        }, "strict", z.ZodTypeAny, {
            can: string[];
            cannot: string[];
            requires: string[];
        }, {
            can: string[];
            cannot: string[];
            requires: string[];
        }>;
        cognitive_style: z.ZodObject<{
            reasoning_type: z.ZodEnum<["deductive", "inductive", "abductive"]>;
            uncertainty_expression: z.ZodEnum<["explicit", "implicit"]>;
            failure_mode: z.ZodEnum<["fail_loud", "fail_silent"]>;
            archetype: z.ZodEnum<["analyzer", "executor", "advisor", "orchestrator", "validator"]>;
        }, "strict", z.ZodTypeAny, {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        }, {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        }>;
        output: z.ZodObject<{
            semantic_tags: z.ZodArray<z.ZodString, "many">;
            downstream_hints: z.ZodArray<z.ZodObject<{
                if_tag: z.ZodString;
                suggest_to: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                if_tag: string;
                suggest_to: string;
            }, {
                if_tag: string;
                suggest_to: string;
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        }, {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        }>;
        runtime: z.ZodObject<{
            side_effects: z.ZodObject<{
                level: z.ZodEnum<["none", "read-only", "state-changing", "irreversible"]>;
                scope: z.ZodArray<z.ZodString, "many">;
            }, "strict", z.ZodTypeAny, {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            }, {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            }>;
            cost: z.ZodObject<{
                compute: z.ZodEnum<["low", "mid", "high"]>;
                latency: z.ZodString;
                monetary: z.ZodEnum<["free", "per_call", "metered"]>;
            }, "strict", z.ZodTypeAny, {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            }, {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            }>;
        }, "strict", z.ZodTypeAny, {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        }, {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        }>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        identity: {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        };
        boundaries: {
            can: string[];
            cannot: string[];
            requires: string[];
        };
        cognitive_style: {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        };
        output: {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        };
        runtime: {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        };
    }, {
        id: string;
        identity: {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        };
        boundaries: {
            can: string[];
            cannot: string[];
            requires: string[];
        };
        cognitive_style: {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        };
        output: {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        };
        runtime: {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        };
    }>;
}, "strict", z.ZodTypeAny, {
    capability: {
        id: string;
        identity: {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        };
        boundaries: {
            can: string[];
            cannot: string[];
            requires: string[];
        };
        cognitive_style: {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        };
        output: {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        };
        runtime: {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        };
    };
}, {
    capability: {
        id: string;
        identity: {
            name: string;
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
        };
        boundaries: {
            can: string[];
            cannot: string[];
            requires: string[];
        };
        cognitive_style: {
            archetype: "analyzer" | "executor" | "advisor" | "orchestrator" | "validator";
            reasoning_type: "deductive" | "inductive" | "abductive";
            uncertainty_expression: "explicit" | "implicit";
            failure_mode: "fail_loud" | "fail_silent";
        };
        output: {
            semantic_tags: string[];
            downstream_hints: {
                if_tag: string;
                suggest_to: string;
            }[];
        };
        runtime: {
            side_effects: {
                level: "none" | "read-only" | "state-changing" | "irreversible";
                scope: string[];
            };
            cost: {
                compute: "low" | "mid" | "high";
                latency: string;
                monetary: "free" | "per_call" | "metered";
            };
        };
    };
}>;
/**
 * L1 语法校验函数。
 * 成功：返回 { ok: true, value }
 * 失败：返回 { ok: false, errors: CdpValidationError[] }（level='L1'）
 */
export interface SyntaxOk {
    ok: true;
    value: CdpCapability;
}
export interface SyntaxFail {
    ok: false;
    errors: CdpValidationError[];
}
export type SyntaxResult = SyntaxOk | SyntaxFail;
export declare function validateSyntax(doc: unknown): SyntaxResult;
/** 类型守卫：判断未知值是否为合法 CdpDocument（供 loader 使用） */
export declare function isCdpDocument(value: unknown): value is CdpDocument;
