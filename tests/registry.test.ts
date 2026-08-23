import { describe, it, expect } from 'vitest';
import { CdpRegistry, DuplicateIdError } from '../src/registry.js';
import type { CdpCapability } from '../src/types.js';

function cap(id: string, archetype: 'analyzer' | 'executor' = 'analyzer', tag = 't', se: 'none' | 'read-only' = 'none'): CdpCapability {
  return {
    id,
    identity: { name: id, archetype },
    boundaries: { can: ['a'], cannot: ['b'], requires: ['c'] },
    cognitive_style: { reasoning_type: 'deductive', uncertainty_expression: 'explicit', failure_mode: 'fail_loud', archetype },
    output: { semantic_tags: [tag], downstream_hints: [{ if_tag: tag, suggest_to: 'x' }] },
    runtime: { side_effects: { level: se, scope: [] }, cost: { compute: 'low', latency: '<1s', monetary: 'free' } }
  };
}

describe('CdpRegistry', () => {
  it('register / get / list', () => {
    const r = new CdpRegistry();
    r.register(cap('x@v1.0'));
    expect(r.get('x@v1.0')?.id).toBe('x@v1.0');
    expect(r.list().length).toBe(1);
  });

  it('conflictStrategy prefix', () => {
    const r = new CdpRegistry();
    r.register(cap('x@v1.0'), { conflictStrategy: 'prefix' });
    const finalId = r.register(cap('x@v1.0'), { conflictStrategy: 'prefix' });
    expect(finalId).toBe('x@v1.0#2');
    expect(r.get('x@v1.0#2')).toBeDefined();
    expect(r.list().length).toBe(2);
  });

  it('conflictStrategy error 抛 DuplicateIdError', () => {
    const r = new CdpRegistry();
    r.register(cap('x@v1.0'), { conflictStrategy: 'error' });
    expect(() => r.register(cap('x@v1.0'), { conflictStrategy: 'error' })).toThrow(DuplicateIdError);
  });

  it('queryByTag', () => {
    const r = new CdpRegistry();
    r.register(cap('a@v1.0', 'analyzer', 'alpha'));
    r.register(cap('b@v1.0', 'analyzer', 'beta'));
    expect(r.queryByTag('alpha').length).toBe(1);
    expect(r.queryByTag('beta').length).toBe(1);
    expect(r.queryByTag('nope').length).toBe(0);
  });

  it('queryByArchetype', () => {
    const r = new CdpRegistry();
    r.register(cap('a@v1.0', 'analyzer'));
    r.register(cap('b@v1.0', 'executor'));
    expect(r.queryByArchetype('analyzer').length).toBe(1);
    expect(r.queryByArchetype('executor').length).toBe(1);
  });

  it('queryBySideEffect', () => {
    const r = new CdpRegistry();
    r.register(cap('a@v1.0', 'analyzer', 't', 'none'));
    r.register(cap('b@v1.0', 'analyzer', 't', 'read-only'));
    expect(r.queryBySideEffect('none').length).toBe(1);
    expect(r.queryBySideEffect('read-only').length).toBe(1);
  });

  it('formatMarker 形态', () => {
    const r = new CdpRegistry();
    const m = r.formatMarker(cap('a@v1.0'));
    expect(m).toBe('[CDP: deductive/explicit/fail_loud | SE:none | $:free]');
  });

  it('decorateSchemas 追加 marker 且不改原串', () => {
    const r = new CdpRegistry();
    const out = r.decorateSchemas(cap('a@v1.0'), '原始描述');
    expect(out).toContain('原始描述');
    expect(out).toContain('[CDP:');
  });

  it('applyBindings 按 bindings 映射', () => {
    const r = new CdpRegistry();
    r.register(cap('a@v1.0', 'analyzer', 't'));
    const schemas = [
      { name: 'tool_a', description: 'desc a', parameters: {} },
      { name: 'tool_b', description: 'desc b', parameters: {} }
    ];
    const out = r.applyBindings(schemas, { 'a@v1.0': 'tool_a' });
    expect(out[0].description).toContain('[CDP:');
    expect(out[1].description).toBe('desc b'); // 未绑定不变
  });
});
