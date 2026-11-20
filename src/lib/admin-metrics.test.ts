import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLastNDaysKeys,
  getUtcDateKey,
  isPrimaryAdminEmail,
  isValidFirestoreId,
  sanitizeDisplayName,
  summarizeUserMetrics,
  type UserMetricRecord,
} from './admin-metrics.ts';

test('getUtcDateKey and getLastNDaysKeys produce ordered UTC date buckets', () => {
  const ref = new Date('2026-11-20T14:30:00.000Z');
  assert.equal(getUtcDateKey(ref), '2026-11-20');
  assert.deepEqual(getLastNDaysKeys(3, ref), ['2026-11-18', '2026-11-19', '2026-11-20']);
});

test('validation and sanitization helpers enforce blueprint boundaries', () => {
  assert.equal(isValidFirestoreId('NfZ5CAr7BKfyiLhFKYQBjWJA9CY2'), true);
  assert.equal(isValidFirestoreId('bad/id/path'), false);
  assert.equal(isValidFirestoreId('a'.repeat(129)), false);
  assert.equal(sanitizeDisplayName('  A'.repeat(80)).length, 120);
  assert.equal(isPrimaryAdminEmail('  OLASUNKANMIOBASOLA118@GMAIL.COM '), true);
  assert.equal(isPrimaryAdminEmail('other@example.com'), false);
});

test('summarizeUserMetrics calculates DAU, WAU, MAU, recent active, and 7-day trends', () => {
  const ref = new Date('2026-11-20T12:00:00.000Z');
  const users: UserMetricRecord[] = [
    {
      uid: 'u1',
      email: 'alice@example.com',
      displayName: 'Alice',
      provider: 'google',
      lastActiveDate: '2026-11-20',
      registeredAtMs: new Date('2026-11-20T09:00:00.000Z').getTime(),
      lastActiveAtMs: new Date('2026-11-20T11:55:00.000Z').getTime(),
    },
    {
      uid: 'u2',
      email: 'bob@example.com',
      displayName: 'Bob',
      provider: 'google',
      lastActiveDate: '2026-11-18',
      registeredAtMs: new Date('2026-11-15T10:00:00.000Z').getTime(),
      lastActiveAtMs: new Date('2026-11-18T10:00:00.000Z').getTime(),
    },
    {
      uid: 'u3',
      email: 'carol@example.com',
      displayName: 'Carol',
      provider: 'email',
      lastActiveDate: '2026-10-01',
      registeredAtMs: new Date('2026-10-01T10:00:00.000Z').getTime(),
      lastActiveAtMs: new Date('2026-10-01T10:00:00.000Z').getTime(),
    },
  ];

  const summary = summarizeUserMetrics(
    users,
    {
      '2026-11-18': 2,
      '2026-11-19': 1,
      '2026-11-20': 1,
    },
    ref
  );

  assert.equal(summary.totalRegistrations, 3);
  assert.equal(summary.dailyActiveToday, 1);
  assert.equal(summary.weeklyActiveUsers, 2);
  assert.equal(summary.monthlyActiveUsers, 2);
  assert.equal(summary.activeLast15Min, 1);
  assert.equal(summary.newRegistrationsToday, 1);
  assert.equal(summary.newRegistrations7d, 2);
  assert.deepEqual(summary.providerBreakdown, { google: 2, email: 1 });
  assert.equal(summary.dailyTrend.length, 7);
  assert.deepEqual(summary.dailyTrend[4], {
    dateKey: '2026-11-18',
    label: '11/18',
    activeCount: 2,
    newRegistrations: 0,
  });
  assert.deepEqual(summary.dailyTrend[6], {
    dateKey: '2026-11-20',
    label: '11/20',
    activeCount: 1,
    newRegistrations: 1,
  });
});
