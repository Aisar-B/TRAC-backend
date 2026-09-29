import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVerificationCode, hashVerificationCode, isStrongPassword } from '../src/utils/emailVerification.js';

test('verification codes are six digits, including leading zeroes', () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.match(generateVerificationCode(), /^\d{6}$/);
  }
});

test('verification codes are stored as keyed hashes, not raw values', () => {
  process.env.JWT_SECRET = 'test-secret-for-verification';
  const codeHash = hashVerificationCode('012345');

  assert.match(codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(codeHash, '012345');
  assert.equal(hashVerificationCode('012345'), codeHash);
  assert.notEqual(hashVerificationCode('012346'), codeHash);
});

test('password policy matches the signup UI requirements', () => {
  assert.equal(isStrongPassword('GoodPass1!'), true);
  assert.equal(isStrongPassword('lowercase1!'), false);
  assert.equal(isStrongPassword('NoNumber!'), false);
  assert.equal(isStrongPassword('Short1!'), false);
});