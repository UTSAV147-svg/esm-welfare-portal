const express = require('express');
const router = express.Router();
const docController = require('../controllers/document.controller');
const { verifyToken, requireTaskAuth } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/rbac.middleware');
const { upload } = require('../middleware/upload.middleware');

// Upload document (requires ESM role + Step-Up Task Auth + Multer file filter)
router.post('/upload', verifyToken, checkRole('ESM'), requireTaskAuth('DOCUMENT_UPLOAD'), upload.single('file'), docController.uploadDocument);

// Authenticated download route with ownership check
router.get('/:id', verifyToken, docController.downloadDocument);

module.exports = router;
