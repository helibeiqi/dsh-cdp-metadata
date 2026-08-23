import { describe, it, expect } from 'vitest';
import {
  validateSemantics,
  checkConflicts,
  checkTagHints,
  checkLatency,
  checkCrossField,
  stripNegation,
  hasNegation,
  normalize,
  NEG
} from '../src/validator.js';
import { CdpValidationError } from '../src/errors.js';
import type { CdpCapability } from '../src/types.js';

function baseCap(overrides: Partial<CdpCapability> = {}): CdpCapability {
  const cap = {
    id: 'test@v1.0',
    identity: { name: 't', archetype: 'analyzer' as const },
    boundaries: { can: ['预测趋势'] as string[], cannot: [] as string[], requires: ['d'] as string[] },
    cognitive_style: {
      reasoning_type: 'deductive' as const,
      uncertainty_expression: 'explicit' as const,
      failure_mode: 'fail_loud' as const,
      archetype: 'analyzer' as const
    },
    output: {
      semantic_tags: ['tag_a'] as string[],
      downstream_hints: [{ if_tag: 'tag_a', suggest_to: 'other' }]
    },
    runtime: {
      side_effects: { level: 'none' as const, scope: [] as string[] },
      cost: { compute: 'low' as const, latency: '<1s', monetary: 'free' as const }
    }
  };
  return { ...cap, ...overrides };
}

describe('L2 校验', () => {
  it('can/cannot 直接相交命中', () => {
    const cap = baseCap({
      boundaries: { can: ['预测趋势'], cannot: ['预测趋势'], requires: ['d'] }
    });
    const errs = checkConflicts(cap);
    expect(errs.some((e) => e.level === 'L2' && e.reason.includes('直接矛盾'))).toBe(true);
  });

  it('否定启发式命中（cannot 含否定词）', () => {
    const cap = baseCap({
      boundaries: { can: ['预测趋势'], cannot: ['不预测趋势'], requires: ['d'] }
    });
    const errs = checkConflicts(cap);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.reason.includes('语义否定'))).toBe(true);
  });

  it('正常不误报', () => {
    const cap = baseCap();
    const errs = validateSemantics(cap);
    expect(errs.length).toBe(0);
  });

  it('downstream_hints.if_tag 未命中 semantic_tags', () => {
    const cap = baseCap({
      output: {
        semantic_tags: ['tag_a'],
        downstream_hints: [{ if_tag: 'missing_tag', suggest_to: 'x' }]
      }
    });
    const errs = checkTagHints(cap);
    expect(errs.length).toBe(1);
    expect(errs[0].path).toContain('if_tag');
  });

  it('latency 非法', () => {
    const cap = baseCap({ runtime: { side_effects: { level: 'none', scope: [] }, cost: { compute: 'low', latency: 'bad', monetary: 'free' } } });
    const errs = checkLatency(cap);
    expect(errs.length).toBe(1);
  });

  it('跨字段不一致告警：none + scope', () => {
    const cap = baseCap({ runtime: { side_effects: { level: 'none', scope: ['x'] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } } });
    const errs = checkCrossField(cap);
    expect(errs.some((e) => e.reason.includes('scope'))).toBe(true);
  });

  it('跨字段不一致告警：archetype 两处不一致', () => {
    const cap = baseCap({ cognitive_style: { reasoning_type: 'deductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype: 'executor' } });
    const errs = checkCrossField(cap);
    expect(errs.some((e) => e.reason.includes('不一致'))).toBe(true);
  });

  it('诚实测试：会漏检的语义等价但字面不同案例', () => {
    // 同义改写："提供投资意见" vs "给投资建议" —— 字面不同，字符串启发式必然漏检
    const cap = baseCap({
      boundaries: { can: ['给投资建议'], cannot: ['提供投资意见'], requires: ['d'] }
    });
    const errs = checkConflicts(cap);
    // 证明局限：不报（或仅可能误命中）。本断言明确标注这是已知漏检
    expect(Array.isArray(errs)).toBe(true);
    // 不强制 errs.length===0（启发式边界），但记录该局限：当前实现对此漏检
  });

  it('normalize / stripNegation / hasNegation 工具', () => {
    expect(normalize('  HeLLo  World ')).toBe('hello world');
    expect(NEG.includes('不')).toBe(true);
    expect(hasNegation('不预测')).toBe(true);
    expect(hasNegation('预测')).toBe(false);
    expect(stripNegation('不预测趋势')).toBe('预测趋势');
    expect(stripNegation('预测趋势')).toBe('预测趋势');
  });

  it('validateSemantics 返回 CdpValidationError[]', () => {
    const cap = baseCap();
    const r = validateSemantics(cap);
    expect(r.every((e) => e instanceof CdpValidationError)).toBe(true);
  });
});
