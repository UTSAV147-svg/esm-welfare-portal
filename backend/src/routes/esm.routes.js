const express = require('express');
const router = express.Router();
const esmController = require('../controllers/esm.controller');
const { verifyToken, requireTaskAuth } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { validate, profileUpdateSchema, dependentSchema } = require('../middleware/validate.middleware');

// All routes require authenticated ESM role
router.use(verifyToken, checkRole('ESM'));

// Profile
router.get('/profile', esmController.getProfile);
router.put('/profile', requireTaskAuth('PROFILE_UPDATE'), validate(profileUpdateSchema), esmController.updateProfile);

// Dependents
router.get('/dependents', esmController.getDependents);
router.post('/dependents', validate(dependentSchema), esmController.addDependent);
router.delete('/dependents/:id', esmController.deleteDependent);

module.exports = router;
