/**
 * ==============================================================================
 * VeerSeva - Authentication Middleware
 * Milestone 2: verifyToken & requireTaskAuth
 * Parses Authorization: Bearer <token> or HttpOnly Cookie and attaches req.user
 * ==============================================================================
 */

const { verifyAccessToken, hasValidTaskSession } = require('../services/session.service');
const { recordAudit } = require('../services/audit.service');

/**
 * Verify JWT Access Token from Header or HttpOnly Cookie
 */
function verifyToken(req, res, next) {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Fallback to HttpOnly cookie
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: 'Authentication token missing. Please sign in to access this portal resource.'
    });
  }

  const verification = verifyAccessToken(token);

  if (!verification.valid) {
    if (verification.idleTimeout) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_IDLE_TIMEOUT',
        message: 'Your session has timed out after 10 minutes of inactivity. Please log in again.'
      });
    }

    if (verification.expired) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Your 15-minute access session has expired. Please refresh your session.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: verification.message || 'Invalid or revoked token.'
    });
  }

  // Attach decoded user payload to request
  req.user = verification.payload;
  next();
}

/**
 * Enforce Step-Up Task Authentication for sensitive operations
 * (e.g. Viewing pension slips, uploading documents, submitting applications, editing bank profile)
 */
function requireTaskAuth(taskName = 'SENSITIVE_OPERATION') {
  return (req, res, next) => {
    if (!req.user || !req.user.session_id) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authentication required.'
      });
    }

    const isValid = hasValidTaskSession(req.user.session_id);
    if (!isValid) {
      recordAudit({
        userId: req.user.user_id,
        action: 'STEP_UP_CHALLENGE_TRIGGERED',
        req,
        status: 'WARNING',
        details: { taskName }
      });

      return res.status(403).json({
        success: false,
        error: 'TASK_SESSION_EXPIRED',
        stepUpRequired: true,
        taskName,
        message: `Task verification session expired or not verified. Please verify 2FA OTP to continue with ${taskName}.`
      });
    }

    next();
  };
}

/**
 * Optional token verification: if Bearer or cookie present, decodes user without rejecting guests
 */
function optionalVerifyToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token && req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }
  if (token) {
    const verification = verifyAccessToken(token);
    if (verification && verification.valid) {
      req.user = verification.payload;
    }
  }
  next();
}

module.exports = {
  verifyToken,
  optionalVerifyToken,
  requireTaskAuth
};
