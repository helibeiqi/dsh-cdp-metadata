/**
 * 插件入口导出（DESIGN §9 index.ts）。
 *
 * - name = 'dsh-cdp-metadata'
 * - apply(ctx, config)
 * - 导出 CdpRegistry、类型、cdpCapabilitySchema
 * - 默认导出符合 cordis 插件形态 { name, apply }
 */
export { name, apply, inject, configSchema, decorateSchemas, attachToTools } from './integration.js';
export { CdpRegistry, DuplicateIdError } from './registry.js';
export { CdpValidationError, CdpValidationAggregateError, CdpSecurityError } from './errors.js';
export { cdpCapabilitySchema, cdpDocumentSchema, validateSyntax, isCdpDocument, ID_PATTERN, LATENCY_PATTERN } from './schema.js';
export { validateSemantics, checkConflicts, checkTagHints, checkLatency, checkCrossField, NEG, normalize, stripNegation, hasNegation } from './validator.js';
export { loadSources } from './loader.js';
export { resolveSafe, readCdpFile, walkCdpFiles, MAX_FILE_BYTES, MAX_DEPTH, MAX_FILES } from './fs-utils.js';
import { name, apply } from './integration.js';
/** 默认导出：cordis 插件形态 */
export default { name, apply };
