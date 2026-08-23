/**
 * CDP 错误模型（DESIGN §5）。
 *
 * - CdpValidationError：单条校验错误，携带 path / reason / level，可被聚合。
 * - CdpValidationAggregateError：聚合多条校验错误，对应 onInvalid='error' 时抛出。
 * - CdpSecurityError：路径逃逸等安全错误，**永远抛，不受 onInvalid 控制**。
 */
import type { ValidationLevel } from './types.js';
export declare class CdpValidationError extends Error {
    readonly path: string;
    readonly reason: string;
    readonly level: ValidationLevel;
    constructor(path: string, reason: string, level: ValidationLevel);
}
export declare class CdpValidationAggregateError extends Error {
    readonly errors: readonly CdpValidationError[];
    constructor(errors: readonly CdpValidationError[]);
}
/**
 * 安全错误：路径逃逸 / 符号链接逃逸 / 越界等。
 * 永远抛出，不受 onInvalid='warn' 降级控制。
 */
export declare class CdpSecurityError extends Error {
    readonly path: string;
    readonly reason: string;
    constructor(path: string, reason: string);
}
