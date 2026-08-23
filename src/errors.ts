/**
 * CDP 错误模型（DESIGN §5）。
 *
 * - CdpValidationError：单条校验错误，携带 path / reason / level，可被聚合。
 * - CdpValidationAggregateError：聚合多条校验错误，对应 onInvalid='error' 时抛出。
 * - CdpSecurityError：路径逃逸等安全错误，**永远抛，不受 onInvalid 控制**。
 */

import type { ValidationLevel } from './types.js';

export class CdpValidationError extends Error {
  public readonly path: string;
  public readonly reason: string;
  public readonly level: ValidationLevel;

  constructor(path: string, reason: string, level: ValidationLevel) {
    super(`[${level}] ${path}: ${reason}`);
    this.name = 'CdpValidationError';
    this.path = path;
    this.reason = reason;
    this.level = level;
    // 还原原型链（ES2022 target 下 setPrototypeOf 非必须，但稳妥保留）
    Object.setPrototypeOf(this, CdpValidationError.prototype);
  }
}

export class CdpValidationAggregateError extends Error {
  public readonly errors: readonly CdpValidationError[];

  constructor(errors: readonly CdpValidationError[]) {
    const summary = errors
      .map((e) => e.message)
      .join('; ');
    super(`CDP 校验失败 (${errors.length}): ${summary}`);
    this.name = 'CdpValidationAggregateError';
    this.errors = errors;
    Object.setPrototypeOf(this, CdpValidationAggregateError.prototype);
  }
}

/**
 * 安全错误：路径逃逸 / 符号链接逃逸 / 越界等。
 * 永远抛出，不受 onInvalid='warn' 降级控制。
 */
export class CdpSecurityError extends Error {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`[SECURITY] ${path}: ${reason}`);
    this.name = 'CdpSecurityError';
    this.path = path;
    this.reason = reason;
    Object.setPrototypeOf(this, CdpSecurityError.prototype);
  }
}
