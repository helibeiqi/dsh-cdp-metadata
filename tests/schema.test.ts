import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateSyntax,
  cdpCapabilitySchema,
  isCdpDocument,
  ID_PATTERN,
  LATENCY_PATTERN
} from '../src/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => join(__dirname, 'fixtures', n);

function load(n: string): unknown {
  return JSON.parse(readFileSync(fx(n), 'utf8'));
}

describe('L1 语法校验', () => {
  it('valid 示例通过', () => {
    const r = validateSyntax(load('valid-stock-analyzer.cdp.json'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.id).toBe('stock_analyzer@v1.0');
      expect(r.value.identity.name).toBe('股票技术分析器');
    }
  });

  it('invalid-l1 报具体 path / level', () => {
    const r = validateSyntax(load('invalid-l1.cdp.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThan(0);
      // id 格式错误
      expect(r.errors.some((e) => e.path === 'capability.id' && e.level === 'L1')).toBe(true);
      // can 含空串 minLength
      expect(r.errors.some((e) => e.path.startsWith('capability.boundaries.can'))).toBe(true);
      // additionalProperties 违规（strict 拒绝未知字段）
      expect(r.errors.some((e) => e.reason.includes('extra_unknown_field'))).toBe(true);
    }
  });

  it('id pattern 与 latency pattern 常量正确', () => {
    expect(new RegExp(ID_PATTERN).test('stock_analyzer@v1.0')).toBe(true);
    expect(new RegExp(ID_PATTERN).test('bad_id')).toBe(false);
    expect(new RegExp(LATENCY_PATTERN).test('<1s')).toBe(true);
    expect(new RegExp(LATENCY_PATTERN).test('500ms')).toBe(true);
    expect(new RegExp(LATENCY_PATTERN).test('2m')).toBe(true);
    expect(new RegExp(LATENCY_PATTERN).test('bad')).toBe(false);
  });

  it('顶层 additionalProperties 拒绝多余键', () => {
    const doc = load('valid-stock-analyzer.cdp.json') as Record<string, unknown>;
    doc.extra = 1;
    const r = validateSyntax(doc);
    expect(r.ok).toBe(false);
  });

  it('cdpCapabilitySchema 拒绝未知字段', () => {
    const cap = { id: 'x@v1.0' } as never;
    expect(cdpCapabilitySchema.safeParse(cap).success).toBe(false);
  });

  it('isCdpDocument 类型守卫', () => {
    expect(isCdpDocument({ capability: { id: 'x@v1.0' } })).toBe(false); // 缺字段
    const valid = load('valid-stock-analyzer.cdp.json');
    expect(isCdpDocument(valid)).toBe(true);
  });
});
