import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeterministicScan } from './engine';
import { getCoveredCategories, reconcileRepositoryFindings } from './reconcile';
import { buildUnifiedDiff, parseStructuredDiff } from '../diff';

test('deterministic scanner detects SQL injection, hardcoded secrets, and redacts secret excerpt', async () => {
  const files = [
    {
      path: 'src/db.ts',
      content: [
        'const awsKey = "AKIAIOSFODNN7EXAMPLE";',
        'export async function findUser(db: any, id: string) {',
        '  return db.query(`SELECT * FROM users WHERE id = ${id}`);',
        '}',
      ].join('\n'),
    },
    {
      path: 'README.md',
      content: '# Sample Repo',
    },
  ];

  const result = await runDeterministicScan(files, { scanType: 'full' });

  const awsFinding = result.findings.find((f) => f.ruleId === 'SEC-AWS-KEY');
  const sqlFinding = result.findings.find((f) => f.ruleId === 'SEC-SQL-INJECTION');
  const anyFinding = result.findings.find((f) => f.ruleId === 'QUAL-TS-ANY');

  assert.ok(awsFinding, 'Expected AWS key finding');
  assert.ok(sqlFinding, 'Expected SQL injection finding');
  assert.ok(anyFinding, 'Expected TypeScript any finding');
  assert.ok(!awsFinding.codeExcerpt.includes('AKIAIOSFODNN7EXAMPLE'), 'Secret value must be redacted');
  assert.ok(result.scoreBreakdown.overallScore < 90);
});

test('deterministic scanner detects circular dependencies in architecture graph', async () => {
  const files = [
    {
      path: 'src/a.ts',
      content: "import { b } from './b';\nexport const a = () => b();\n",
    },
    {
      path: 'src/b.ts',
      content: "import { a } from './a';\nexport const b = () => a();\n",
    },
  ];

  const result = await runDeterministicScan(files, { scanType: 'architecture' });
  assert.equal(result.architecture.circularDependencies.length > 0, true);
  assert.ok(result.findings.some((f) => f.ruleId === 'ARCH-CIRCULAR'));
});

test('diff utility generates valid unified diff and structured hunks', () => {
  const original = 'return db.query(`SELECT * FROM users WHERE id = ${id}`);\n';
  const proposed = 'return db.query("SELECT * FROM users WHERE id = $1", [id]);\n';

  const unified = buildUnifiedDiff('src/db.ts', original, proposed);
  assert.ok(unified.includes('-return db.query(`SELECT'));
  assert.ok(unified.includes('+return db.query("SELECT'));

  const lines = parseStructuredDiff('src/db.ts', original, proposed);
  assert.ok(lines.some((l) => l.type === 'removed'));
  assert.ok(lines.some((l) => l.type === 'added'));
});

test('rescan reconciliation deduplicates fingerprints, preserves workflow status, and respects covered categories', async () => {
  const result = await runDeterministicScan(
    [{ path: 'src/db.ts', content: 'db.query(`SELECT * FROM t WHERE id = ${id}`);' }],
    { scanType: 'security' }
  );
  const detected = result.findings;
  assert.equal(detected.length, 1);

  const plan = reconcileRepositoryFindings(
    [
      { id: 1, fingerprint: detected[0].fingerprint, category: 'security', status: 'open' },
      { id: 2, fingerprint: detected[0].fingerprint, category: 'security', status: 'diagnosed' },
      { id: 3, fingerprint: 'fixed-sec-fp', category: 'security', status: 'open' },
      { id: 4, fingerprint: 'unscanned-qual-fp', category: 'quality', status: 'open' },
      { id: 5, fingerprint: 'dismissed-sec-fp', category: 'security', status: 'dismissed' },
    ],
    detected,
    getCoveredCategories('security')
  );

  assert.deepEqual(plan.duplicateIdsToDelete, [1]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, 2);
  assert.equal(plan.updates[0].nextStatus, 'diagnosed');
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.resolveIds, [3]);
});
