const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, registerSchema, loginSchema, verify2FASchema } = require('../middleware/validate.middleware');
const { authLimiter, twoFactorLimiter } = require('../middleware/rateLimiter.middleware');

// Public registration & login endpoints
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/verify-2fa', twoFactorLimiter, validate(verify2FASchema), authController.verify2FA);
router.post('/refresh-token', authController.refreshToken);

// Authenticated session endpoints
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.post('/mock-aadhaar-ekyc', verifyToken, authController.mockAadhaarEkyc);

module.exports = router;
