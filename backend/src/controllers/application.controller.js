/**
 * ==============================================================================
 * VeerSeva - Application & Schemes Controller
 * Milestone 3: Transactional Application Submission, Scheme Processing & Tracking
 * ==============================================================================
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { recordAudit } = require('../services/audit.service');

/**
 * GET /api/v1/schemes
 * Fetch active welfare schemes
 */
async function getSchemes(req, res) {
  try {
    const schemes = await db.query('SELECT * FROM schemes WHERE is_active = TRUE ORDER BY created_at DESC');
    return res.status(200).json({
      success: true,
      data: schemes
    });
  } catch (err) {
    console.error('[Application Controller] getSchemes error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/applications
 * Create a new welfare application binding scheme and dependent in an atomic transaction
 */
async function createApplication(req, res) {
  try {
    const userId = req.user.user_id;
    const { scheme_id, dependent_id, requested_amount, document_ids = [] } = req.sanitizedBody;

    // Get ESM profile
    const esmRows = await db.query('SELECT esm_id FROM esm_profiles WHERE user_id = ?', [userId]);
    if (!esmRows || esmRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ESM_PROFILE_REQUIRED',
        message: 'Must complete military profile or e-KYC before applying for schemes.'
      });
    }
    const esmId = esmRows[0].esm_id;

    // Verify Scheme exists and is active
    const schemeRows = await db.query('SELECT * FROM schemes WHERE scheme_id = ? AND is_active = TRUE', [scheme_id]);
    if (!schemeRows || schemeRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SCHEME_NOT_FOUND',
        message: 'Selected welfare scheme is invalid or inactive.'
      });
    }
    const scheme = schemeRows[0];

    // If dependent_id provided, verify dependent belongs to this ESM
    if (dependent_id) {
      const depRows = await db.query('SELECT * FROM dependents WHERE dependent_id = ? AND esm_id = ?', [dependent_id, esmId]);
      if (!depRows || depRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_DEPENDENT',
          message: 'Selected dependent does not belong to this veteran profile.'
        });
      }
    }

    const applicationId = `app-${uuidv4().slice(0, 8)}`;

    // Execute within database transaction
    await db.withTransaction(async (trx) => {
      // 1. Insert application record
      await trx.query(
        `INSERT INTO applications (application_id, esm_id, scheme_id, dependent_id, status, requested_amount)
         VALUES (?, ?, ?, ?, 'PENDING', ?)`,
        [applicationId, esmId, scheme_id, dependent_id || null, requested_amount || scheme.max_amount]
      );

      // 2. Link uploaded documents to this application
      if (Array.isArray(document_ids) && document_ids.length > 0) {
        for (const docId of document_ids) {
          await trx.query(
            'UPDATE documents SET application_id = ? WHERE doc_id = ? AND esm_id = ?',
            [applicationId, docId, esmId]
          );
        }
      }
    });

    await recordAudit({
      userId,
      action: 'APPLICATION_SUBMITTED',
      req,
      status: 'SUCCESS',
      details: {
        applicationId,
        schemeId: scheme_id,
        schemeTitle: scheme.title,
        amount: requested_amount
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Welfare benefit application submitted successfully for ZSB verification.',
      data: {
        applicationId,
        schemeTitle: scheme.title,
        status: 'PENDING',
        submittedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Application Controller] createApplication error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/applications/my-applications
 * Track status changes and reviewer feedback for an ESM user
 */
async function getMyApplications(req, res) {
  try {
    const userId = req.user.user_id;
    const esmRows = await db.query('SELECT esm_id FROM esm_profiles WHERE user_id = ?', [userId]);

    if (!esmRows || esmRows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const esmId = esmRows[0].esm_id;

    const sql = `
      SELECT 
        a.application_id, a.esm_id, a.scheme_id, a.dependent_id, a.status,
        a.requested_amount, a.disbursed_amount, a.submitted_at, a.reviewed_at,
        a.rejection_reason, a.review_notes,
        s.title AS scheme_title, s.category AS scheme_category,
        d.full_name AS dependent_name
      FROM applications a
      LEFT JOIN schemes s ON a.scheme_id = s.scheme_id
      LEFT JOIN dependents d ON a.dependent_id = d.dependent_id
      WHERE a.esm_id = ?
      ORDER BY a.submitted_at DESC
    `;

    const applications = await db.query(sql, [esmId]);

    return res.status(200).json({
      success: true,
      data: applications
    });
  } catch (err) {
    console.error('[Application Controller] getMyApplications error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/applications/:id
 * Retrieve specific application details including attached documents
 */
async function getApplicationById(req, res) {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM applications WHERE application_id = ?', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Application not found.' });
    }

    const application = rows[0];

    // Ownership check (unless Officer or Admin)
    if (req.user.role === 'ESM') {
      const esmRows = await db.query('SELECT esm_id FROM esm_profiles WHERE user_id = ?', [req.user.user_id]);
      if (!esmRows || esmRows[0].esm_id !== application.esm_id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Unauthorized access to this application.' });
      }
    }

    const documents = await db.query('SELECT * FROM documents WHERE application_id = ?', [id]);
    const scheme = await db.query('SELECT * FROM schemes WHERE scheme_id = ?', [application.scheme_id]);

    return res.status(200).json({
      success: true,
      data: {
        ...application,
        scheme: scheme[0] || null,
        documents
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  getSchemes,
  createApplication,
  getMyApplications,
  getApplicationById
};
