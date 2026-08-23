import { describe, it, expect } from 'vitest';
import plugin, {
  name,
  apply,
  CdpRegistry,
  cdpCapabilitySchema,
  CdpValidationError,
  CdpSecurityError,
  validateSyntax,
  validateSemantics
} from '../src/index.js';

describe('index 入口导出', () => {
  it('默认导出为 cordis 插件形态 { name, apply }', () => {
    expect(plugin.name).toBe('dsh-cdp-metadata');
    expect(typeof plugin.apply).toBe('function');
  });

  it('具名导出齐备', () => {
    expect(name).toBe('dsh-cdp-metadata');
    expect(typeof apply).toBe('function');
    expect(typeof CdpRegistry).toBe('function');
    expect(cdpCapabilitySchema).toBeDefined();
    expect(CdpValidationError).toBeDefined();
    expect(CdpSecurityError).toBeDefined();
    expect(typeof validateSyntax).toBe('function');
    expect(typeof validateSemantics).toBe('function');
  });
});
