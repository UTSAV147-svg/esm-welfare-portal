/**
 * ==============================================================================
 * VeerSeva - Automated Test Suite
 * Tests Security, Encryption, 2FA, Session Management, and RBAC
 * Run: npm test
 * ==============================================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Import services
const { encrypt, decrypt, maskAadhaar, maskBankAccount } = require('../src/services/encryption.service');
const { generateOTP, verifyOTP, generateBackupCodes, verifyBackupCode } = require('../src/services/twoFactor.service');
const { createSession, verifyAccessToken, rotateRefreshToken, grantTaskSession, hasValidTaskSession } = require('../src/services/session.service');

test('1. Security & Encryption: AES-256-GCM and PII Masking', () => {
  const sensitiveBankData = {
    account_number: '123456789012',
    ifsc: 'SBIN0001423',
    bank_name: 'State Bank of India'
  };

  // Encrypt
  const encrypted = encrypt(sensitiveBankData);
  assert.ok(encrypted, 'Encrypted string must exist');
  assert.equal(encrypted.split(':').length, 3, 'Must be in iv:tag:ciphertext format');

  // Decrypt
  const decrypted = decrypt(encrypted);
  assert.deepEqual(decrypted, sensitiveBankData, 'Decrypted data must match original payload exactly');

  // Aadhaar Masking
  const maskedAadhaar = maskAadhaar('123456788921');
  assert.equal(maskedAadhaar, 'XXXX-XXXX-8921', 'Aadhaar must be masked to show only last 4 digits');

  // Bank Account Masking
  const maskedBank = maskBankAccount('123456789012');
  assert.equal(maskedBank, 'XXXXXXXX9012', 'Bank account must mask leading digits');
});

test('2. Two-Factor Authentication (2FA): OTP Expiry, Attempts & Backup Codes', () => {
  const testEmail = 'subedar.test@mod.gov.in';

  // 1. Generate 6-digit OTP
  const result = generateOTP(testEmail, { role: 'ESM' });
  assert.equal(typeof result.otp, 'string');
  assert.equal(result.otp.length, 6, 'OTP must be 6 digits');
  assert.ok(result.expiresInSeconds > 0, 'Expiry time must be positive');

  // 2. Failed attempt
  const badVerify = verifyOTP(testEmail, '000000');
  assert.equal(badVerify.success, false, 'Invalid OTP must fail');

  // 3. Successful verification
  const goodVerify = verifyOTP(testEmail, result.otp);
  assert.equal(goodVerify.success, true, 'Valid OTP must succeed');

  // 4. One-time use: re-submitting same OTP must fail
  const reuseVerify = verifyOTP(testEmail, result.otp);
  assert.equal(reuseVerify.success, false, 'Reusing consumed OTP must fail');

  // 5. Backup Codes
  const backupCodes = generateBackupCodes(5);
  assert.equal(backupCodes.length, 5);
  assert.ok(backupCodes[0].startsWith('BC-'));

  const backupVerify = verifyBackupCode(backupCodes[0], JSON.stringify(backupCodes));
  assert.equal(backupVerify.success, true);
  assert.equal(backupVerify.remainingCodes.length, 4, 'Consumed backup code must be removed');
});

test('3. Session Management: Token Rotation & 15-Minute Task Sessions', () => {
  const mockUser = {
    user_id: 'usr-test-01',
    email: 'veteran.test@gmail.com',
    role: 'ESM',
    service_number: 'JC-112233K',
    assigned_district: 'Pune',
    assigned_state: 'Maharashtra'
  };

  const mockReq = { ip: '127.0.0.1', headers: { 'user-agent': 'TestRunner/1.0' } };

  // Create session
  const session = createSession(mockUser, mockReq);
  assert.ok(session.accessToken, 'Access token must be generated');
  assert.ok(session.refreshToken, 'Refresh token must be generated');
  assert.equal(session.expiresInSeconds, 900, 'Access token must expire in 15 minutes');

  // Verify access token
  const verifyRes = verifyAccessToken(session.accessToken);
  assert.equal(verifyRes.valid, true);
  assert.equal(verifyRes.payload.user_id, mockUser.user_id);
  assert.equal(verifyRes.payload.role, 'ESM');

  // Task Session
  assert.equal(hasValidTaskSession(session.sessionId), false, 'Initial session should not have task session before grant');
  grantTaskSession(session.sessionId, 'PENSION_SLIP_DOWNLOAD');
  assert.equal(hasValidTaskSession(session.sessionId), true, 'Task session should be valid after grant');

  // Rotate Refresh Token
  const rotation = rotateRefreshToken(session.refreshToken, mockReq);
  assert.equal(rotation.success, true, 'Refresh token rotation must succeed');
  assert.ok(rotation.accessToken, 'New rotated access token must be issued');
  assert.ok(rotation.refreshToken, 'New rotated refresh token must be issued');
});
