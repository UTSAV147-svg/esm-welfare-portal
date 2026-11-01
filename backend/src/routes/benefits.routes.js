const express = require('express');
const router = express.Router();
const benefitsController = require('../controllers/benefits.controller');
const { optionalVerifyToken } = require('../middleware/auth.middleware');

router.use(optionalVerifyToken);

router.get('/pension', benefitsController.getPensionTracker);
router.get('/echs', benefitsController.getHealthcareHub);
router.get('/csd', benefitsController.getCsdCatalogModule);
router.get('/resettlement', benefitsController.getResettlementBoard);

module.exports = router;
