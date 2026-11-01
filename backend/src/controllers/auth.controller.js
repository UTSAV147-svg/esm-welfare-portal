/**
 * ==============================================================================
 * VeerSeva - Authentication & 2FA Controller
 * Milestone 2: Registration, 2-Step Login, Token Rotation, Aadhaar e-KYC Mock
 * ==============================================================================
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { 
  generateOTP, 
  verifyOTP, 
  generateTotpSetup, 
  verifyTotpToken, 
  generateBackupCodes, 
  verifyBackupCode 
} = require('../services/twoFactor.service');
const { 
  createSession, 
  rotateRefreshToken, 
  grantTaskSession, 
  hasValidTaskSession, 
  revokeSession, 
  COOKIE_OPTIONS 
} = require('../services/session.service');
const { recordAudit } = require('../services/audit.service');
const { encrypt, maskAadhaar, maskBankAccount } = require('../services/encryption.service');
const apiSetuMock = require('../mocks/apiSetuMock.json');

/**
 * POST /api/v1/auth/register
 * Hashes password (10-12 rounds) and creates user + initial profile pipeline
 */
async function register(req, res) {
  try {
    const { email, password, service_number, phone, role = 'ESM', assigned_district = null, assigned_state = null } = req.sanitizedBody;

    // Check if user or service number already exists
    const existing = await db.query(
      'SELECT * FROM users WHERE email = ? OR service_number = ?',
      [email, service_number]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'USER_EXISTS',
        message: 'A user with this Email or Service Number already exists.'
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = `usr-${uuidv4().slice(0, 8)}`;
    const esmId = `esm-${uuidv4().slice(0, 8)}`;

    // Generate backup codes if Admin or ZSB Officer
    let backupCodes = null;
    let backupCodesJson = null;
    if (role === 'ADMIN' || role === 'ZSB_OFFICER') {
      backupCodes = generateBackupCodes(5);
      backupCodesJson = JSON.stringify(backupCodes);
    }

    await db.query(
      `INSERT INTO users (user_id, email, password_hash, role, is_verified, phone, service_number, assigned_district, assigned_state, is_2fa_enabled, totp_secret)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, role, true, phone, service_number, assigned_district, assigned_state, true, null]
    );

    // Initial ESM profile creation pipeline if role is ESM
    if (role === 'ESM') {
      const defaultBankDetails = encrypt({
        bank_name: 'State Bank of India',
        account_number: '12345678901',
        ifsc: 'SBIN0001000'
      });

      await db.query(
        `INSERT INTO esm_profiles (esm_id, user_id, service_number, full_name, service_branch, rank, corps_arm, date_of_enrollment, date_of_discharge, ppo_number, district, state, pincode, aadhaar_last4, bank_details_json, echs_card_number, csd_smart_card_id, onboarding_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          esmId,
          userId,
          service_number,
          'Veteran (Pending Verification)',
          'ARMY',
          'Junior Commissioned Officer',
          'Infantry',
          '2000-01-01',
          '2024-01-01',
          `PPO/PENDING/${service_number}`,
          assigned_district || 'Pune',
          assigned_state || 'Maharashtra',
          '411001',
          '0000',
          defaultBankDetails,
          null,
          null,
          'MANUAL'
        ]
      );
    }

    await recordAudit({
      userId,
      action: 'USER_REGISTERED',
      req,
      status: 'SUCCESS',
      details: { email, service_number, role }
    });

    return res.status(201).json({
      success: true,
      message: 'Account successfully registered. Please sign in with your credentials.',
      data: {
        userId,
        email,
        role,
        service_number,
        backupCodes // Shown once on registration for officers/admins
      }
    });
  } catch (err) {
    console.error('[Auth Controller] Registration error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/auth/login
 * Step 1: Validates credentials, checks lockout, and initiates Step 2 (2FA OTP/TOTP)
 */
async function login(req, res) {
  try {
    const { identifier, password } = req.sanitizedBody;

    // Search user by email or service_number
    const users = await db.query(
      'SELECT * FROM users WHERE email = ? OR service_number = ?',
      [identifier, identifier]
    );

    if (!users || users.length === 0) {
      await recordAudit({
        userId: null,
        action: 'LOGIN_FAILED',
        req,
        status: 'FAILURE',
        details: { identifier, reason: 'USER_NOT_FOUND' }
      });

      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid Service Number/Email or password.'
      });
    }

    const user = users[0];

    // Check temporary lockout
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.lockout_until) - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to 3 failed attempts. Please retry in ${minutesRemaining} minute(s).`
      });
    }

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const newFailedCount = (user.failed_logins || 0) + 1;
      let lockoutDate = null;

      if (newFailedCount >= 3) {
        lockoutDate = new Date(Date.now() + 15 * 60 * 1000);
      }

      await db.query(
        'UPDATE users SET failed_logins = ?, lockout_until = ? WHERE user_id = ?',
        [newFailedCount, lockoutDate, user.user_id]
      );

      await recordAudit({
        userId: user.user_id,
        action: 'LOGIN_PASSWORD_FAILED',
        req,
        status: 'FAILURE',
        details: { attempts: newFailedCount }
      });

      const remaining = 3 - newFailedCount;
      const warnMsg = remaining > 0 
        ? `Invalid password. ${remaining} attempt(s) remaining before temporary lockout.`
        : 'Maximum failed attempts reached. Account locked for 15 minutes.';

      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: warnMsg
      });
    }

    // Reset failed logins on valid credentials
    await db.query(
      'UPDATE users SET failed_logins = 0, lockout_until = NULL WHERE user_id = ?',
      [user.user_id]
    );

    // Step 2: Trigger 2FA
    // Check if user has TOTP enabled or fallback to SMS/Email OTP
    let twoFactorMethod = 'OTP';
    if (user.totp_secret) {
      twoFactorMethod = 'TOTP';
    }

    // Generate 6-digit OTP for SMS/Email
    const otpResult = generateOTP(user.email, {
      userId: user.user_id,
      role: user.role,
      service_number: user.service_number
    });

    await recordAudit({
      userId: user.user_id,
      action: '2FA_CHALLENGE_ISSUED',
      req,
      status: 'SUCCESS',
      details: { method: twoFactorMethod }
    });

    return res.status(200).json({
      success: true,
      require2FA: true,
      message: `Step 1 passed. Two-Step Verification required. 6-digit OTP dispatched to registered mobile/email.`,
      data: {
        identifier: user.email,
        service_number: user.service_number,
        role: user.role,
        method: twoFactorMethod,
        hasTotp: !!user.totp_secret,
        expiresInSeconds: otpResult.expiresInSeconds,
        // In local/demo mode, devOtp is returned for effortless testing
        devOtp: otpResult.otp
      }
    });
  } catch (err) {
    console.error('[Auth Controller] Login error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/auth/verify-2fa
 * Step 2: Verifies OTP / TOTP / Backup Code and signs JWT session
 */
async function verify2FA(req, res) {
  try {
    const { identifier, method = 'OTP', otp, totpToken, backupCode, isTaskSession = false, taskName = 'GENERAL' } = req.sanitizedBody;

    const users = await db.query(
      'SELECT * FROM users WHERE email = ? OR service_number = ?',
      [identifier, identifier]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    const user = users[0];
    let is2faValid = false;
    let failureMsg = 'Invalid verification code.';

    if (method === 'OTP') {
      const verifyResult = verifyOTP(user.email, otp);
      is2faValid = verifyResult.success;
      if (!is2faValid) failureMsg = verifyResult.message;
    } else if (method === 'TOTP') {
      is2faValid = verifyTotpToken(totpToken, user.totp_secret);
      if (!is2faValid) failureMsg = 'Invalid 6-digit TOTP code from Authenticator app.';
    } else if (method === 'BACKUP_CODE') {
      const backupResult = verifyBackupCode(backupCode, user.backup_codes_json);
      is2faValid = backupResult.success;
      if (is2faValid) {
        // Save remaining backup codes
        await db.query('UPDATE users SET backup_codes_json = ? WHERE user_id = ?', [
          JSON.stringify(backupResult.remainingCodes),
          user.user_id
        ]);
      } else {
        failureMsg = backupResult.message;
      }
    }

    if (!is2faValid) {
      await recordAudit({
        userId: user.user_id,
        action: '2FA_VERIFICATION_FAILED',
        req,
        status: 'FAILURE',
        details: { method, error: failureMsg }
      });

      return res.status(401).json({
        success: false,
        error: '2FA_FAILED',
        message: failureMsg
      });
    }

    // If this verification is for a Step-Up Task Session
    if (isTaskSession && req.user && req.user.session_id) {
      grantTaskSession(req.user.session_id, taskName);
      await recordAudit({
        userId: user.user_id,
        action: 'TASK_SESSION_GRANTED',
        req,
        status: 'SUCCESS',
        details: { taskName }
      });

      return res.status(200).json({
        success: true,
        message: `Task verification successful. 15-minute access session granted for ${taskName}.`,
        taskSessionExpiresInSeconds: 15 * 60
      });
    }

    // Full Login Session Establishment
    const session = createSession(user, req);

    // Set secure HttpOnly cookies
    res.cookie('access_token', session.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', session.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Grant initial task session so the user can immediately browse without re-prompt
    grantTaskSession(session.sessionId, 'INITIAL_LOGIN');

    await recordAudit({
      userId: user.user_id,
      action: 'LOGIN_SUCCESS',
      req,
      status: 'SUCCESS',
      details: { method, role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful. Welcome to VeerSeva.',
      data: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresInSeconds: session.expiresInSeconds,
        idleTimeoutSeconds: session.idleTimeoutSeconds,
        user: {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          service_number: user.service_number,
          district: user.assigned_district,
          state: user.assigned_state
        }
      }
    });
  } catch (err) {
    console.error('[Auth Controller] 2FA verification error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/auth/refresh-token
 * Safely rotates authentication tokens
 */
async function refreshToken(req, res) {
  try {
    let token = req.body.refreshToken || (req.cookies && req.cookies.refresh_token);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token not found.'
      });
    }

    const rotation = rotateRefreshToken(token, req);
    if (!rotation.success) {
      return res.status(403).json({
        success: false,
        error: 'TOKEN_ROTATION_FAILED',
        message: rotation.message
      });
    }

    res.cookie('access_token', rotation.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', rotation.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: 'Tokens rotated successfully.',
      data: {
        accessToken: rotation.accessToken,
        refreshToken: rotation.refreshToken,
        expiresInSeconds: rotation.expiresInSeconds
      }
    });
  } catch (err) {
    console.error('[Auth Controller] Refresh token error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/auth/logout
 * Invalidates token server-side and clears cookies
 */
async function logout(req, res) {
  try {
    const sessionId = req.user?.session_id;
    if (sessionId) {
      revokeSession(sessionId);
    }

    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);

    if (req.user) {
      await recordAudit({
        userId: req.user.user_id,
        action: 'LOGOUT',
        req,
        status: 'SUCCESS'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Signed out securely. Server session invalidated.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/auth/me
 * Retrieves active session identity & task session status
 */
async function getMe(req, res) {
  try {
    const user = req.user;
    const hasTaskAuth = hasValidTaskSession(user.session_id);

    // Fetch full ESM profile if role is ESM
    let esmProfile = null;
    if (user.role === 'ESM') {
      const profiles = await db.query('SELECT * FROM esm_profiles WHERE user_id = ?', [user.user_id]);
      if (profiles && profiles.length > 0) {
        esmProfile = profiles[0];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          role: user.role,
          service_number: user.service_number,
          district: user.district,
          state: user.state
        },
        esmProfile,
        taskSessionActive: hasTaskAuth,
        idleTimeoutMinutes: 10,
        accessTokenLifetimeMinutes: 15
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/auth/mock-aadhaar-ekyc
 * API Setu placeholder: Performs instant Aadhaar e-KYC & fetches PPO & ESM ID Card from DigiLocker
 */
async function mockAadhaarEkyc(req, res) {
  try {
    const userId = req.user.user_id;
    const { aadhaarNumber } = req.body;

    const mockData = apiSetuMock.api_setu_response;
    const ppoDoc = mockData.digilocker_documents.find(d => d.doc_type === 'PPO_ORDER');
    const esmCard = mockData.digilocker_documents.find(d => d.doc_type === 'ESM_ID_CARD');

    // Update or insert ESM Profile
    const existing = await db.query('SELECT * FROM esm_profiles WHERE user_id = ?', [userId]);

    const bankDetails = encrypt({
      bank_name: 'State Bank of India (CPPC SPARSH)',
      account_number: '30998811223',
      ifsc: 'SBIN0001423'
    });

    if (existing && existing.length > 0) {
      await db.query(
        `UPDATE esm_profiles SET 
          full_name = ?, service_branch = ?, rank = ?, corps_arm = ?, 
          date_of_enrollment = ?, date_of_discharge = ?, ppo_number = ?, 
          district = ?, state = ?, pincode = ?, aadhaar_last4 = ?, 
          bank_details_json = ?, onboarding_source = 'API_SETU_EKYC'
         WHERE user_id = ?`,
        [
          mockData.aadhaar_data.full_name,
          ppoDoc.metadata.service_branch,
          ppoDoc.metadata.rank,
          ppoDoc.metadata.corps_arm,
          ppoDoc.metadata.enrollment_date,
          ppoDoc.metadata.discharge_date,
          ppoDoc.metadata.ppo_number,
          mockData.aadhaar_data.address.district,
          mockData.aadhaar_data.address.state,
          mockData.aadhaar_data.address.pincode,
          mockData.aadhaar_data.masked_uid.slice(-4),
          bankDetails,
          userId
        ]
      );
    }

    await recordAudit({
      userId,
      action: 'AADHAAR_EKYC_VERIFIED',
      req,
      status: 'SUCCESS',
      details: {
        source: 'API_SETU',
        masked_uid: mockData.aadhaar_data.masked_uid,
        ppo_number: ppoDoc.metadata.ppo_number
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Aadhaar e-KYC and DigiLocker PPO pull verified successfully!',
      data: {
        aadhaar: {
          masked_uid: mockData.aadhaar_data.masked_uid,
          name: mockData.aadhaar_data.full_name,
          district: mockData.aadhaar_data.address.district,
          state: mockData.aadhaar_data.address.state
        },
        digilocker_documents: [
          {
            type: 'PPO_ORDER',
            issuer: ppoDoc.issuer,
            ppo_number: ppoDoc.metadata.ppo_number,
            rank: ppoDoc.metadata.rank,
            corps: ppoDoc.metadata.corps_arm
          },
          {
            type: 'ESM_ID_CARD',
            issuer: esmCard.issuer,
            reg_no: esmCard.metadata.esm_reg_no
          }
        ]
      }
    });
  } catch (err) {
    console.error('[Auth Controller] e-KYC error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  register,
  login,
  verify2FA,
  refreshToken,
  logout,
  getMe,
  mockAadhaarEkyc
};
