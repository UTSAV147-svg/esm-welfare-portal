/**
 * ==============================================================================
 * VeerSeva - Benefits Orchestrator Controller
 * Modules: Pension (SPARSH/PCDA), Healthcare (ECHS), CSD AFD Canteen, Resettlement (DGR/KSB)
 * ==============================================================================
 */

const { getPensionData, getEchsData, getCsdCatalog, getDgrResettlementData } = require('../services/scrapers.service');
const { recordAudit } = require('../services/audit.service');

/**
 * GET /api/v1/benefits/pension
 * Fetch SPARSH / PCDA pension status, OROP-2 arrears, and pension slips
 */
async function getPensionTracker(req, res) {
  try {
    const serviceNumber = (req.user && req.user.service_number) || 'JC-765432W';
    const pension = getPensionData(serviceNumber);

    if (req.user && req.user.user_id) {
      await recordAudit({
        userId: req.user.user_id,
        action: 'PENSION_DATA_ACCESSED',
        req,
        status: 'SUCCESS',
        details: { serviceNumber, ppo: pension.legacy_ppo }
      });
    }

    return res.status(200).json({
      success: true,
      data: pension
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/benefits/echs
 * ECHS Polyclinics and Empaneled Hospitals directory with live filters
 */
async function getHealthcareHub(req, res) {
  try {
    const { state, city, speciality, search } = req.query;
    const healthcare = getEchsData({ state, city, speciality, search });

    return res.status(200).json({
      success: true,
      data: healthcare
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/benefits/csd
 * CSD AFD Online Portal Catalog & Quota Calculator
 */
async function getCsdCatalogModule(req, res) {
  try {
    const { category, rankRole, search } = req.query;
    const catalog = getCsdCatalog({ category, rankRole, search });

    return res.status(200).json({
      success: true,
      data: catalog
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

/**
 * GET /api/v1/benefits/resettlement
 * DGR Corporate Jobs & PMSS Scholarship Stage Tracking
 */
async function getResettlementBoard(req, res) {
  try {
    const resettlement = getDgrResettlementData();

    return res.status(200).json({
      success: true,
      data: resettlement
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
}

module.exports = {
  getPensionTracker,
  getHealthcareHub,
  getCsdCatalogModule,
  getResettlementBoard
};
