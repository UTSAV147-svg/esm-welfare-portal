const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkRole, enforceDistrictScope } = require('../middleware/rbac.middleware');
const { validate, statusUpdateSchema } = require('../middleware/validate.middleware');

// All admin routes strictly require JWT and ZSB_OFFICER or ADMIN role
router.use(verifyToken, checkRole('ZSB_OFFICER', 'ADMIN'), enforceDistrictScope);

// Application verification workflow
router.get('/applications', adminController.listApplications);
router.patch('/applications/:id/status', validate(statusUpdateSchema), adminController.updateApplicationStatus);

// Dashboard stats & aggregation
router.get('/stats', adminController.getStats);

// CSV Export
router.get('/export', adminController.exportApplicationsCSV);

// Scraper management
router.get('/scraper-status', adminController.getScrapers);
router.post('/refresh-scrapers', adminController.triggerScraperRefresh);

// Super-Admin only routes
router.get('/users', checkRole('ADMIN'), adminController.getUsers);
router.get('/audit-logs', checkRole('ADMIN'), adminController.getAuditTrail);

// Milestone 1 & 2 Viewers
router.get('/schema-info', checkRole('ADMIN'), adminController.getSchemaInfo);
router.get('/rbac-matrix', checkRole('ADMIN'), adminController.getRbacMatrix);

module.exports = router;
