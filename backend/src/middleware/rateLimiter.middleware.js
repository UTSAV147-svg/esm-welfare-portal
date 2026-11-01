/**
 * ==============================================================================
 * VeerSeva - Rate Limiting Middleware
 * Protects against Brute-Force, Credential Stuffing, and Denial-of-Service attacks
 * ==============================================================================
 */

const rateLimit = require('express-rate-limit');

// General API rate limiter (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

// Strict login limiter (5 attempts per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.'
  }
});

// 2FA verification rate limiter (5 attempts per 5 minutes)
const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP verification attempts. Please wait 5 minutes before retrying.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  twoFactorLimiter
};
