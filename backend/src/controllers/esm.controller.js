/**
 * ==============================================================================
 * VeerSeva - ESM Veteran Profile & Dependents Controller
 * Milestone 3: ESM & Dependent Services (Profile retrieval, update, CRUD dependents)
 * ==============================================================================
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { decrypt, encrypt, maskAadhaar, maskBankAccount } = require('../services/encryption.service');
const { recordAudit } = require('../services/audit.service');

/**
 * Helper to retrieve ESM ID from authenticated user_id
 */
async function getEsmIdFromUser(userId) {
  const rows = await db.query('SELECT esm_id FROM esm_profiles WHERE user_id = ?', [userId]);
  if (!rows || rows.length === 0) return null;
  return rows[0].esm_id;
}

/**
 * GET /api/v1/esm/profile
 * Retrieve full service and personal details for authenticated ESM
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const profiles = await db.query('SELECT * FROM esm_profiles WHERE user_id = ?', [userId]);

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'PROFILE_NOT_FOUND',
        message: 'No military service profile linked to this account.'
      });
    }

    const profile = profiles[0];

    // Decrypt and mask bank details
    let bank = { bank_name: 'N/A', account_masked: 'N/A', ifsc: 'N/A' };
    if (profile.bank_details_json) {
      const decrypted = decrypt(profile.bank_details_json);
      if (decrypted) {
        bank = {
          bank_name: decrypted.bank_name || 'State Bank of India',
          account_masked: maskBankAccount(decrypted.account_number || decrypted.account_masked),
          ifsc: decrypted.ifsc || 'SBIN0001423'
        };
      }
    }

    // Mask Aadhaar
    const maskedAadhaar = profile.aadhaar_last4 
      ? `XXXX-XXXX-${profile.aadhaar_last4}` 
      : 'XXXX-XXXX-0000';

    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        bank_details: bank,
        aadhaar_masked: maskedAadhaar
      }
    });
  } catch (err) {
    console.error('[ESM Controller] getProfile error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * PUT /api/v1/esm/profile
 * Update personal, service, and contact details
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const esmId = await getEsmIdFromUser(userId);

    if (!esmId) {
      return res.status(404).json({ success: false, error: 'PROFILE_NOT_FOUND' });
    }

    const { full_name, rank, corps_arm, district, state, pincode, bank_name, account_number, ifsc } = req.sanitizedBody;

    let bankJson = null;
    if (bank_name && account_number && ifsc) {
      bankJson = encrypt({
        bank_name,
        account_number,
        ifsc
      });
    }

    await db.query(
      `UPDATE esm_profiles SET 
        full_name = COALESCE(?, full_name),
        rank = COALESCE(?, rank),
        corps_arm = COALESCE(?, corps_arm),
        district = COALESCE(?, district),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        bank_details_json = COALESCE(?, bank_details_json)
       WHERE esm_id = ?`,
      [full_name, rank, corps_arm, district, state, pincode, bankJson, esmId]
    );

    await recordAudit({
      userId,
      action: 'PROFILE_UPDATED',
      req,
      status: 'SUCCESS',
      details: { district, state, rank }
    });

    return res.status(200).json({
      success: true,
      message: 'Veteran profile updated successfully.'
    });
  } catch (err) {
    console.error('[ESM Controller] updateProfile error:', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/esm/dependents
 * Fetch list of dependents registered under logged-in ESM
 */
async function getDependents(req, res) {
  try {
    const userId = req.user.user_id;
    const esmId = await getEsmIdFromUser(userId);

    if (!esmId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const dependents = await db.query(
      'SELECT * FROM dependents WHERE esm_id = ? ORDER BY created_at DESC',
      [esmId]
    );

    return res.status(200).json({
      success: true,
      data: dependents
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * POST /api/v1/esm/dependents
 * Add family member eligible for grants/scholarships
 */
async function addDependent(req, res) {
  try {
    const userId = req.user.user_id;
    const esmId = await getEsmIdFromUser(userId);

    if (!esmId) {
      return res.status(404).json({ success: false, error: 'PROFILE_NOT_FOUND', message: 'ESM profile required before adding dependents.' });
    }

    const { full_name, relation, dob, disability_status, education_status } = req.sanitizedBody;
    const dependentId = `dep-${uuidv4().slice(0, 8)}`;

    await db.query(
      `INSERT INTO dependents (dependent_id, esm_id, full_name, relation, dob, disability_status, education_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dependentId, esmId, full_name, relation, dob, disability_status || false, education_status || null]
    );

    await recordAudit({
      userId,
      action: 'DEPENDENT_ADDED',
      req,
      status: 'SUCCESS',
      details: { dependentId, relation, full_name }
    });

    return res.status(201).json({
      success: true,
      message: 'Family dependent registered successfully.',
      data: {
        dependentId,
        full_name,
        relation,
        dob
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * DELETE /api/v1/esm/dependents/:id
 * Remove dependent
 */
async function deleteDependent(req, res) {
  try {
    const userId = req.user.user_id;
    const esmId = await getEsmIdFromUser(userId);
    const dependentId = req.params.id;

    const result = await db.query(
      'DELETE FROM dependents WHERE dependent_id = ? AND esm_id = ?',
      [dependentId, esmId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dependent not found or unauthorized.' });
    }

    await recordAudit({
      userId,
      action: 'DEPENDENT_DELETED',
      req,
      status: 'SUCCESS',
      details: { dependentId }
    });

    return res.status(200).json({
      success: true,
      message: 'Dependent successfully removed.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getDependents,
  addDependent,
  deleteDependent
};
