import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesSource = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

test('firestore.rules enforces global deny-all and rules_version 2', () => {
  assert.match(rulesSource, /rules_version = '2';/);
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test('firestore.rules enforces email_verified == true and admin isolation on PII and lists', () => {
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /match \/userMetrics\/\{userId\}[\s\S]*allow list: if isAdmin\(\);/);
  assert.match(rulesSource, /match \/dailyActivity\/\{dateId\}\/users\/\{userId\}[\s\S]*allow list: if isValidDateId\(dateId\) && isAdmin\(\);/);
  assert.match(rulesSource, /match \/admins\/\{adminId\}[\s\S]*allow create:[\s\S]*isAdmin\(\)/);
});

test('firestore.rules enforces strict key allowlists, ID regexes, and server request.time', () => {
  assert.match(rulesSource, /function isValidId\(id\)/);
  assert.match(rulesSource, /function isValidDateId\(id\)/);
  assert.match(rulesSource, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesSource, /incoming\(\)\.registeredAt == request\.time/);
  assert.match(rulesSource, /incoming\(\)\.lastActiveAt == request\.time/);
  assert.match(rulesSource, /incoming\(\)\.lastSeenAt == request\.time/);
});
