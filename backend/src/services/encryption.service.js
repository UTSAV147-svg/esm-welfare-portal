/**
 * ==============================================================================
 * VeerSeva - Encryption & PII Security Service
 * Implements AES-256-GCM encryption at rest and CERT-In compliant masking
 * ==============================================================================
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// 32-byte key derived from env or generated deterministically
const ENCRYPTION_KEY = Buffer.from(
  (process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').slice(0, 64),
  'hex'
);

/**
 * Encrypt sensitive plain text (e.g. Bank Account Number, IFSC)
 */
function encrypt(text) {
  if (!text) return null;
  const str = typeof text === 'object' ? JSON.stringify(text) : String(text);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(str, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Return iv:tag:ciphertext
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext encrypted with AES-256-GCM
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // If it is plain JSON string, return as parsed
      return JSON.parse(ciphertext);
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    console.error('[Encryption] Decryption error:', err.message);
    return null;
  }
}

/**
 * Mask Aadhaar number to show only the last 4 digits (e.g. XXXX-XXXX-4310)
 */
function maskAadhaar(aadhaarNumber) {
  if (!aadhaarNumber) return 'XXXX-XXXX-XXXX';
  const clean = String(aadhaarNumber).replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  const last4 = clean.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

/**
 * Mask Bank Account number (e.g. XXXXXXXXX4512)
 */
function maskBankAccount(accNumber) {
  if (!accNumber) return 'XXXXXXXXXX';
  const clean = String(accNumber).trim();
  if (clean.length <= 4) return 'XXXX';
  const last4 = clean.slice(-4);
  return 'X'.repeat(Math.max(6, clean.length - 4)) + last4;
}

/**
 * Redact sensitive PII from logs and audit records
 */
function redactPII(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  const sensitiveKeys = ['password', 'password_hash', 'totp_secret', 'token', 'refreshToken', 'aadhaar', 'account_number'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = redactPII(clone[key]);
    }
  }
  return clone;
}

module.exports = {
  encrypt,
  decrypt,
  maskAadhaar,
  maskBankAccount,
  redactPII
};
