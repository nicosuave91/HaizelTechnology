import { describe, expect, it } from 'vitest';
import {
  RuleDefinition,
  RuleGraphError,
  canonicalizeInputs,
  computeSnapshotHash,
  evaluateRuleGraph,
  sortRules,
} from './index';

describe('canonicalizeInputs', () => {
  it('sorts object keys deterministically', () => {
    const canonical = canonicalizeInputs({
      b: 1,
      a: { z: 2, y: 3 },
    });

    expect(Object.keys(canonical as Record<string, unknown>)).toEqual(['a', 'b']);
    expect(Object.keys((canonical as Record<string, unknown>).a as Record<string, unknown>)).toEqual(['y', 'z']);
  });

  it('produces stable hash for equivalent structures', () => {
    const snapshotA = computeSnapshotHash({ a: 1, b: { c: 2 } });
    const snapshotB = computeSnapshotHash({ b: { c: 2 }, a: 1 });
    expect(snapshotA).toEqual(snapshotB);
  });
});

describe('sortRules', () => {
  const definitions: RuleDefinition[] = [
    {
      id: '1',
      code: 'A',
      title: 'Rule A',
      versionId: 'rv-1',
      expression: 'inputs.value > 0',
      severityOnFail: 'fail',
      citations: [],
      failMessage: 'fail',
      failExplain: 'fail',
    },
    {
      id: '2',
      code: 'B',
      title: 'Rule B',
      versionId: 'rv-2',
      expression: "dependencies.A == 'fail'",
      severityOnFail: 'warn',
      citations: [],
      failMessage: 'fail',
      failExplain: 'fail',
      dependencies: ['A'],
    },
  ];

  it('orders dependencies before dependents', () => {
    const ordered = sortRules(definitions);
    expect(ordered.map((rule) => rule.code)).toEqual(['A', 'B']);
  });

  it('throws on cycles', () => {
    expect(() =>
      sortRules([
        { ...definitions[0], dependencies: ['B'] },
        { ...definitions[1], dependencies: ['A'] },
      ]),
    ).toThrow(RuleGraphError);
  });
});

describe('evaluateRuleGraph', () => {
  const ficoRule: RuleDefinition = {
    id: 'fico-1',
    code: 'FICO_MIN',
    title: 'Minimum FICO',
    versionId: 'rv-fico-1',
    expression: 'inputs.borrower.fico < 620',
    severityOnFail: 'fail',
    citations: ['12 CFR §1026.43'],
    failMessage: 'FICO {{inputs.borrower.fico}} below 620 threshold.',
    failExplain: 'Borrower FICO {{inputs.borrower.fico}} triggers failure.',
    passMessage: 'FICO {{inputs.borrower.fico}} meets requirement.',
    passExplain: 'Borrower FICO {{inputs.borrower.fico}} meets policy.',
  };

  const manualReviewRule: RuleDefinition = {
    id: 'fico-2',
    code: 'MANUAL_REVIEW',
    title: 'Manual Review',
    versionId: 'rv-review-1',
    expression: "dependencies.FICO_MIN == 'fail'",
    severityOnFail: 'warn',
    citations: ['HUD ML 2023-12'],
    failMessage: 'Manual review required for borrower.',
    failExplain: 'Triggered due to downstream dependency.',
    dependencies: ['FICO_MIN'],
    actionsOnFail: { type: 'QUEUE_MANUAL', queue: 'compliance' },
  };

  it('evaluates rules deterministically and produces explainable findings', () => {
    const result = evaluateRuleGraph(
      [ficoRule, manualReviewRule],
      { borrower: { fico: 610 } },
      { asOf: '2024-05-01T00:00:00Z', includePassFindings: true },
    );

    expect(result.result).toBe('fail');
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]).toMatchObject({
      code: 'FICO_MIN',
      severity: 'fail',
      ruleVersionId: 'rv-fico-1',
      explain: expect.stringContaining('Borrower FICO 610 triggers failure'),
    });
    expect(result.findings[1]).toMatchObject({
      code: 'MANUAL_REVIEW',
      severity: 'warn',
      actions: { type: 'QUEUE_MANUAL', queue: 'compliance' },
    });
    expect(result.actions).toHaveLength(1);
    expect(result.inputsSnapshotHash).toEqual(
      computeSnapshotHash({ borrower: { fico: 610 } }),
    );
  });

  it('supports passing outcomes without recording pass findings', () => {
    const outcome = evaluateRuleGraph([ficoRule], { borrower: { fico: 720 } }, { asOf: '2024-05-01T00:00:00Z' });
    expect(outcome.result).toBe('pass');
    expect(outcome.findings).toHaveLength(0);
  });
});
