import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRepositoryHealthScore, deriveRepositoryStatus } from './scoring';

const healthySignals = {
  totalFiles: 25,
  hasTests: true,
  testFileCount: 6,
  hasReadme: true,
  hasSecurityPolicy: true,
  hasCiConfig: true,
  hasEnvExample: true,
  hasTypeConfig: true,
  circularDependencyCount: 0,
  vulnerableDependencyCount: 0,
  outdatedDependencyCount: 0,
};

test('clean repository with tests, docs, and CI scores 100', () => {
  const result = calculateRepositoryHealthScore([], healthySignals);
  assert.equal(result.overallScore, 100);
  assert.equal(result.categories.security, 100);
  assert.equal(result.categories.quality, 100);
  assert.equal(result.categories.dependency, 100);
  assert.equal(result.deductions.length, 0);
});

test('critical security finding reduces security category and overall score deterministically', () => {
  const result = calculateRepositoryHealthScore(
    [
      {
        title: 'SQL injection via template string',
        category: 'security',
        severity: 'critical',
        confidence: 'confirmed',
        status: 'open',
      },
    ],
    healthySignals
  );

  assert.equal(result.categories.security, 82);
  assert.equal(result.overallScore, 95);
  assert.equal(result.deductions[0].points, -18);
});

test('resolved findings are excluded from active score deductions', () => {
  const result = calculateRepositoryHealthScore(
    [
      {
        title: 'Fixed secret',
        category: 'security',
        severity: 'critical',
        confidence: 'confirmed',
        status: 'verified_resolved',
      },
    ],
    healthySignals
  );
  assert.equal(result.overallScore, 100);
});

test('deriveRepositoryStatus maps scores and critical counts accurately', () => {
  assert.equal(deriveRepositoryStatus(null, 0), 'unscanned');
  assert.equal(deriveRepositoryStatus(92, 1), 'critical');
  assert.equal(deriveRepositoryStatus(48, 0), 'critical');
  assert.equal(deriveRepositoryStatus(74, 0), 'needs_attention');
  assert.equal(deriveRepositoryStatus(88, 0), 'healthy');
});
