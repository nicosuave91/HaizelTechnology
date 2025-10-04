import { createHash } from 'node:crypto';
import Decimal from 'decimal.js-light';
import { Parser } from 'expr-eval';

export type RuleResult = 'pass' | 'warn' | 'fail';

export interface RuleDependencyOutcome {
  code: string;
  result: RuleResult;
  triggered: boolean;
}

export interface RuleDefinition {
  id: string;
  code: string;
  title: string;
  versionId: string;
  expression: string;
  severityOnFail: Exclude<RuleResult, 'pass'>;
  citations: string[];
  failMessage: string;
  failExplain: string;
  passMessage?: string;
  passExplain?: string;
  actionsOnFail?: unknown;
  dependencies?: string[];
}

export interface EvaluationFinding {
  code: string;
  severity: RuleResult;
  message: string;
  explain: string;
  ruleVersionId: string;
  title: string;
  citations: string[];
  actions?: unknown;
}

export interface EvaluationSummary {
  result: RuleResult;
  findings: EvaluationFinding[];
  actions: unknown[];
  inputsSnapshotHash: string;
  inputsCanonical: unknown;
  latencyMs: number;
}

export interface EvaluateRuleGraphOptions {
  asOf: string;
  shadow?: boolean;
  includePassFindings?: boolean;
}

export class RuleGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleGraphError';
  }
}

const parser = new Parser({ allowMemberAccess: true });

export function canonicalizeInputs<T>(value: T): T {
  return canonicalizeValue(value) as T;
}

function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'number') {
      return new Decimal(val).toString();
    }

    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (val instanceof Date) {
      return val.toISOString();
    }

    if (typeof val === 'undefined') {
      return null;
    }

    return val;
  });
}

export function computeSnapshotHash(inputs: unknown): string {
  const canonical = canonicalizeInputs(inputs);
  const json = stableStringify(canonical);
  return createHash('sha256').update(json).digest('hex');
}

export function sortRules(definitions: RuleDefinition[]): RuleDefinition[] {
  const definitionMap = new Map(definitions.map((def) => [def.code, def]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: RuleDefinition[] = [];

  const visit = (code: string, stack: string[]): void => {
    if (visited.has(code)) {
      return;
    }

    if (visiting.has(code)) {
      throw new RuleGraphError(`Cycle detected in rule dependencies: ${[...stack, code].join(' -> ')}`);
    }

    const node = definitionMap.get(code);
    if (!node) {
      throw new RuleGraphError(`Missing rule definition for dependency: ${code}`);
    }

    visiting.add(code);
    const deps = node.dependencies ?? [];
    for (const dep of deps) {
      visit(dep, [...stack, code]);
    }
    visiting.delete(code);
    visited.add(code);
    ordered.push(node);
  };

  for (const definition of definitions) {
    visit(definition.code, []);
  }

  return ordered;
}

function renderTemplate(template: string | undefined, context: Record<string, unknown>): string {
  if (!template) {
    return '';
  }

  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (_, path: string) => {
    const segments = path.split('.');
    let current: unknown = context;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        current = undefined;
        break;
      }
    }

    if (current === null || typeof current === 'undefined') {
      return '';
    }

    if (typeof current === 'number') {
      return new Decimal(current).toString();
    }

    return String(current);
  });
}

function normalizeResult(current: RuleResult, next: RuleResult): RuleResult {
  const precedence: RuleResult[] = ['pass', 'warn', 'fail'];
  return precedence.indexOf(next) > precedence.indexOf(current) ? next : current;
}

export function evaluateRuleGraph(
  definitions: RuleDefinition[],
  inputs: Record<string, unknown>,
  options: EvaluateRuleGraphOptions,
): EvaluationSummary {
  const startedAt = process.hrtime.bigint();
  const canonicalInputs = canonicalizeInputs(inputs);
  const snapshotHash = computeSnapshotHash(inputs);
  const ordered = sortRules(definitions);

  const findings: EvaluationFinding[] = [];
  const actions: unknown[] = [];
  const outcomes = new Map<string, RuleDependencyOutcome>();
  let aggregate: RuleResult = 'pass';

  for (const definition of ordered) {
    const dependencyOutcomes = definition.dependencies?.map((code) => outcomes.get(code)) ?? [];
    const environment = buildEvaluationEnvironment(canonicalInputs, dependencyOutcomes, options);
    const expressionResult = parser.parse(definition.expression).evaluate(environment);
    const triggered = Boolean(expressionResult);
    const severity: RuleResult = triggered ? definition.severityOnFail : 'pass';
    aggregate = normalizeResult(aggregate, severity);

    const context = {
      inputs: canonicalInputs,
      triggered,
      severity,
      asOf: options.asOf,
      dependencies: dependencyOutcomes,
    } satisfies Record<string, unknown>;

    const message = triggered
      ? renderTemplate(definition.failMessage, context) || definition.failMessage
      : renderTemplate(definition.passMessage, context) || definition.passMessage || `${definition.title} passed.`;

    const explainTemplate = triggered ? definition.failExplain : definition.passExplain ?? definition.failExplain;
    const explain = renderTemplate(explainTemplate, context) || explainTemplate;

    const finding: EvaluationFinding = {
      code: definition.code,
      severity,
      message,
      explain,
      ruleVersionId: definition.versionId,
      title: definition.title,
      citations: [...definition.citations],
      actions: triggered ? definition.actionsOnFail : undefined,
    };

    if (options.includePassFindings || severity !== 'pass') {
      findings.push(finding);
    }

    if (triggered && definition.actionsOnFail) {
      actions.push(definition.actionsOnFail);
    }

    outcomes.set(definition.code, {
      code: definition.code,
      result: severity,
      triggered,
    });
  }

  const latencyMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);

  return {
    result: aggregate,
    findings,
    actions,
    inputsSnapshotHash: snapshotHash,
    inputsCanonical: canonicalInputs,
    latencyMs,
  };
}

function buildEvaluationEnvironment(
  canonicalInputs: Record<string, unknown>,
  dependencyOutcomes: (RuleDependencyOutcome | undefined)[],
  options: EvaluateRuleGraphOptions,
): Record<string, unknown> {
  const env: Record<string, unknown> = {
    inputs: canonicalInputs,
    asOf: options.asOf,
  };

  const dependencyResults: Record<string, RuleResult> = {};
  for (const outcome of dependencyOutcomes) {
    if (!outcome) continue;
    dependencyResults[outcome.code] = outcome.result;
  }
  env.dependencies = dependencyResults;
  return env;
}
