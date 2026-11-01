/**
 * ==============================================================================
 * VeerSeva - Session & Token Management Service
 * Manages 15-min Access Tokens, 7-day Refresh Token Rotation,
 * 10-min Inactivity Idle Timeouts, and 15-min Step-Up Task Sessions
 * ==============================================================================
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const ACCESS_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_access_key_defense_portal_2026_xyz!';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_key_defense_portal_2026_abc!';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const IDLE_TIMEOUT_MS = (parseInt(process.env.IDLE_TIMEOUT_MINUTES || '10', 10)) * 60 * 1000;
const TASK_SESSION_MS = (parseInt(process.env.TASK_SESSION_TIMEOUT_MINUTES || '15', 10)) * 60 * 1000;

// Active Sessions Store (can synchronize with Redis or memory store)
const activeSessions = new Map(); // sessionId -> { userId, refreshTokenHash, lastActivity, taskSessionExpiry, revoked }
const userToActiveSession = new Map(); // userId -> sessionId (for single-active-session toggle)

/**
 * Generate Access and Refresh Token pair
 */
function createSession(user, req) {
  const sessionId = uuidv4();
  const now = Date.now();

  // Single active session check (if enabled in env or config)
  if (process.env.SINGLE_ACTIVE_SESSION === 'true') {
    const existingSessionId = userToActiveSession.get(user.user_id);
    if (existingSessionId && activeSessions.has(existingSessionId)) {
      const prevSession = activeSessions.get(existingSessionId);
      prevSession.revoked = true;
      console.log(`[Session] Revoked previous active session ${existingSessionId} for user ${user.user_id}`);
    }
  }

  const accessPayload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    service_number: user.service_number || null,
    district: user.assigned_district || null,
    state: user.assigned_state || null,
    session_id: sessionId
  };

  const accessToken = jwt.sign(accessPayload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

  const refreshPayload = {
    user_id: user.user_id,
    session_id: sessionId,
    jti: uuidv4()
  };

  const refreshToken = jwt.sign(refreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const sessionRecord = {
    sessionId,
    userId: user.user_id,
    refreshTokenHash,
    ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    lastActivity: now,
    taskSessionExpiry: null, // granted upon sensitive task step-up
    revoked: false,
    createdAt: now
  };

  activeSessions.set(sessionId, sessionRecord);
  userToActiveSession.set(user.user_id, sessionId);

  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresInSeconds: 15 * 60,
    idleTimeoutSeconds: 10 * 60
  };
}

/**
 * Verify Access Token
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    const session = activeSessions.get(decoded.session_id);

    // If session is explicitly tracked and revoked
    if (session && session.revoked) {
      return { valid: false, expired: false, message: 'Session has been revoked.' };
    }

    // Check idle timeout
    if (session) {
      const now = Date.now();
      if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
        session.revoked = true;
        return { valid: false, idleTimeout: true, message: 'Session expired due to 10 minutes of inactivity.' };
      }
      // Touch activity timestamp
      session.lastActivity = now;
    }

    return { valid: true, payload: decoded };
  } catch (err) {
    return {
      valid: false,
      expired: err.name === 'TokenExpiredError',
      message: err.message
    };
  }
}

/**
 * Rotate Refresh Token & Issue New Token Pair
 */
function rotateRefreshToken(oldRefreshToken, req) {
  try {
    const decoded = jwt.verify(oldRefreshToken, REFRESH_SECRET);
    const session = activeSessions.get(decoded.session_id);

    if (!session || session.revoked) {
      return { success: false, message: 'Refresh token revoked or session expired.' };
    }

    const tokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    if (session.refreshTokenHash !== tokenHash) {
      // Possible token reuse attack! Revoke all sessions for this user
      session.revoked = true;
      activeSessions.delete(decoded.session_id);
      return { success: false, message: 'Security anomaly detected: token reuse. Session invalidated.' };
    }

    // Re-verify user details and issue new pair
    const accessPayload = {
      user_id: decoded.user_id,
      session_id: decoded.session_id,
      role: session.role || 'ESM'
    };

    const newAccessToken = jwt.sign(accessPayload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    const newRefreshPayload = {
      user_id: decoded.user_id,
      session_id: decoded.session_id,
      jti: uuidv4()
    };
    const newRefreshToken = jwt.sign(newRefreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

    // Update rotated hash
    session.refreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    session.lastActivity = Date.now();

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresInSeconds: 15 * 60
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Grant a 15-minute Task Session for sensitive operations (step-up authentication)
 */
function grantTaskSession(sessionId, taskType) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;

  const now = Date.now();
  session.taskSessionExpiry = now + TASK_SESSION_MS;
  session.taskType = taskType;
  return {
    success: true,
    expiresAt: session.taskSessionExpiry,
    expiresInSeconds: 15 * 60
  };
}

/**
 * Check if the active session possesses an unexpired Task Session
 */
function hasValidTaskSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.taskSessionExpiry) return false;
  return Date.now() < session.taskSessionExpiry;
}

/**
 * Revoke Session (Logout)
 */
function revokeSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.revoked = true;
    activeSessions.delete(sessionId);
    userToActiveSession.delete(session.userId);
    return true;
  }
  return false;
}

/**
 * Standard cookie configuration (HttpOnly, Secure, SameSite=Strict)
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
};

module.exports = {
  createSession,
  verifyAccessToken,
  rotateRefreshToken,
  grantTaskSession,
  hasValidTaskSession,
  revokeSession,
  COOKIE_OPTIONS,
  activeSessions
};
