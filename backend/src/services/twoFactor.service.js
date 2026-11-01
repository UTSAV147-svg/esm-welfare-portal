/**
 * ==============================================================================
 * VeerSeva - Two-Factor Authentication (2FA) Service
 * Implements SMS/Email 6-digit OTP + TOTP Authenticator + Backup Codes
 * Enforces 5-minute expiry, max 3 attempts, and 15-minute temporary lockout
 * ==============================================================================
 */

const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Configure otplib
authenticator.options = {
  step: 30,
  window: 1 // allows 1 step before/after for clock drift
};

// Store for active OTPs and lockout state (in-memory or Redis)
const otpStore = new Map(); // key: identifier -> { otp, expiresAt, attempts, failedCount, lockoutUntil }

const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10)) * 60 * 1000;
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3', 10);
const LOCKOUT_MS = (parseInt(process.env.LOCKOUT_TIME_MINUTES || '15', 10)) * 60 * 1000;

/**
 * Generate a 6-digit cryptographic OTP
 */
function generateOTP(identifier, userDetails = {}) {
  const now = Date.now();
  const existing = otpStore.get(identifier);

  // Check lockout
  if (existing && existing.lockoutUntil && existing.lockoutUntil > now) {
    const remainingMinutes = Math.ceil((existing.lockoutUntil - now) / 60000);
    throw new Error(`Account temporarily locked due to excessive failed attempts. Please retry after ${remainingMinutes} minute(s).`);
  }

  // Generate 6-digit OTP (100000 to 999999)
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = now + OTP_EXPIRY_MS;

  otpStore.set(identifier, {
    otp,
    expiresAt,
    attempts: 0,
    lockoutUntil: null,
    userDetails
  });

  // Mock SMS/Email Gateway Dispatcher
  console.log('------------------------------------------------------------');
  console.log(`[2FA GATEWAY] SMS / Email OTP Sent!`);
  console.log(`  Recipient: ${identifier} (${userDetails.role || 'USER'} - ${userDetails.service_number || 'Defense ID'})`);
  console.log(`  6-Digit OTP: >>> ${otp} <<<`);
  console.log(`  Validity: 5 Minutes (Expires at ${new Date(expiresAt).toLocaleTimeString()})`);
  console.log('------------------------------------------------------------');

  return {
    otp, // returned in development for automated testing / easy preview
    expiresAt,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000)
  };
}

/**
 * Verify 6-digit OTP
 */
function verifyOTP(identifier, submittedOtp) {
  const now = Date.now();
  const record = otpStore.get(identifier);

  if (!record) {
    return { success: false, message: 'OTP has expired or was not requested. Please request a new OTP.' };
  }

  if (record.lockoutUntil && record.lockoutUntil > now) {
    const mins = Math.ceil((record.lockoutUntil - now) / 60000);
    return { success: false, message: `Account locked due to multiple failed attempts. Retry in ${mins} minute(s).` };
  }

  if (record.expiresAt < now) {
    otpStore.delete(identifier);
    return { success: false, message: 'OTP expired. Please generate a new verification code.' };
  }

  // Check OTP match
  if (record.otp === String(submittedOtp).trim()) {
    otpStore.delete(identifier);
    return { success: true };
  }

  // Failed attempt
  record.attempts += 1;
  const attemptsRemaining = MAX_ATTEMPTS - record.attempts;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockoutUntil = now + LOCKOUT_MS;
    otpStore.set(identifier, record);
    return {
      success: false,
      message: `Invalid OTP. Maximum attempts reached (${MAX_ATTEMPTS}). Your account is locked for 15 minutes.`
    };
  }

  otpStore.set(identifier, record);
  return {
    success: false,
    message: `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`
  };
}

/**
 * Generate a new TOTP secret and QR code for Authenticator apps (Google Authenticator, Microsoft Authenticator)
 */
async function generateTotpSetup(email, appName = 'VeerSeva Defense Portal') {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, appName, secret);
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  return {
    secret,
    otpauth,
    qrCodeUrl
  };
}

/**
 * Verify a TOTP 6-digit token from Authenticator app
 */
function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  return authenticator.check(String(token).trim(), secret);
}

/**
 * Generate a set of 5 one-time backup recovery codes
 */
function generateBackupCodes(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`BC-${part1}-${part2}`);
  }
  return codes;
}

/**
 * Verify and consume a backup code
 */
function verifyBackupCode(submittedCode, storedCodesJson) {
  if (!storedCodesJson) return { success: false, message: 'No backup codes configured.' };
  let codes = [];
  try {
    codes = typeof storedCodesJson === 'string' ? JSON.parse(storedCodesJson) : storedCodesJson;
  } catch {
    return { success: false, message: 'Malformed backup codes.' };
  }

  const clean = String(submittedCode).trim().toUpperCase();
  const index = codes.indexOf(clean);
  if (index === -1) {
    return { success: false, message: 'Invalid backup recovery code.' };
  }

  // Consume code (single-use)
  codes.splice(index, 1);
  return {
    success: true,
    remainingCodes: codes
  };
}

module.exports = {
  generateOTP,
  verifyOTP,
  generateTotpSetup,
  verifyTotpToken,
  generateBackupCodes,
  verifyBackupCode
};
