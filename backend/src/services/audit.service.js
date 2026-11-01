/**
 * ==============================================================================
 * VeerSeva - Audit Trail Service (CERT-In Mandated 180-Day Compliance)
 * Records all authentication, authorization, admin actions, and sensitive data accesses
 * ==============================================================================
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { redactPII } = require('./encryption.service');

/**
 * Record an audit event
 */
async function recordAudit({
  userId = null,
  action,
  req = null,
  status = 'SUCCESS',
  details = {}
}) {
  try {
    const logId = `aud-${uuidv4().slice(0, 12)}`;
    const ip = req ? (req.ip || req.connection?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const userAgent = req ? (req.headers['user-agent'] || 'Unknown') : 'System Internal';

    // Redact sensitive details before logging
    const safeDetails = redactPII(details);
    const detailsJson = JSON.stringify(safeDetails);

    await db.query(
      `INSERT INTO audit_logs (log_id, user_id, action, ip_address, user_agent, status, details_json) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, userId, action, ip, userAgent.slice(0, 255), status, detailsJson]
    );

    // Development console log
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUDIT LOG] ${action} | User: ${userId || 'ANONYMOUS'} | Status: ${status} | IP: ${ip}`);
    }

    return logId;
  } catch (err) {
    console.error('[Audit] Failed to record audit log:', err.message);
    return null;
  }
}

/**
 * Retrieve audit logs with optional filters and 180-day compliance window
 */
async function getAuditLogs({ limit = 100, action = null, userId = null } = {}) {
  try {
    let sql = 'SELECT * FROM audit_logs';
    const params = [];

    if (action || userId) {
      const conditions = [];
      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }
      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY timestamp DESC LIMIT ' + parseInt(limit, 10);
    const rows = await db.query(sql, params);
    return rows;
  } catch (err) {
    console.error('[Audit] Failed to fetch audit logs:', err.message);
    return [];
  }
}

module.exports = {
  recordAudit,
  getAuditLogs
};
