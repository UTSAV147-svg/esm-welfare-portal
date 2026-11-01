const express = require('express');
const router = express.Router();
const appController = require('../controllers/application.controller');
const { verifyToken, requireTaskAuth } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { validate, applicationSchema } = require('../middleware/validate.middleware');

// Public or authenticated list of active welfare schemes
router.get('/schemes', appController.getSchemes);

// Apply for a scheme (requires ESM role + Step-Up Task Auth)
router.post('/', verifyToken, checkRole('ESM'), requireTaskAuth('APPLICATION_SUBMISSION'), validate(applicationSchema), appController.createApplication);

// Track my submitted applications
router.get('/my-applications', verifyToken, checkRole('ESM'), appController.getMyApplications);

// Application details
router.get('/:id', verifyToken, appController.getApplicationById);

module.exports = router;
