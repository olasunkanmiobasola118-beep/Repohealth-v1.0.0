import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './session-tokens';

test('normalizeEmail and isValidEmail handle casing and whitespace', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM  '), 'ada@example.com');
  assert.equal(isValidEmail('ada@example.com'), true);
  assert.equal(isValidEmail('bad-email'), false);
  assert.equal(isValidEmail('missing@tld'), false);
});

test('hashPassword and verifyPassword validate matching passwords with per-user salts', () => {
  const hashA = hashPassword('correct-horse-battery');
  const hashB = hashPassword('correct-horse-battery');
  assert.notEqual(hashA, hashB);
  assert.equal(verifyPassword('correct-horse-battery', hashA), true);
  assert.equal(verifyPassword('wrong-password', hashA), false);
  assert.equal(verifyPassword('anything', null), false);
  assert.equal(verifyPassword('anything', 'invalid-format'), false);
});

test('signSessionToken and verifySessionToken issue, verify, and reject tampered or expired tokens', () => {
  const token = signSessionToken({
    uid: 'local:ada@example.com',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
  });
  assert.equal(token.startsWith('rh_sess.'), true);

  const decoded = verifySessionToken(token);
  assert.ok(decoded);
  assert.equal(decoded.uid, 'local:ada@example.com');
  assert.equal(decoded.email, 'ada@example.com');
  assert.equal(decoded.name, 'Ada Lovelace');

  // Tamper signature
  const tampered = `${token.slice(0, -4)}XXXX`;
  assert.equal(verifySessionToken(tampered), null);

  // Expired token
  const expired = signSessionToken(
    { uid: 'local:ada@example.com', email: 'ada@example.com', name: 'Ada' },
    -1000
  );
  assert.equal(verifySessionToken(expired), null);
});
