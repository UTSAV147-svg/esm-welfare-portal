const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const esmRoutes = require('./esm.routes');
const applicationRoutes = require('./application.routes');
const documentRoutes = require('./document.routes');
const adminRoutes = require('./admin.routes');
const benefitsRoutes = require('./benefits.routes');
const versionRoutes = require('./version.routes');

router.use('/auth', authRoutes);
router.use('/esm', esmRoutes);
router.use('/applications', applicationRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);
router.use('/benefits', benefitsRoutes);
router.use('/version', versionRoutes);

// System Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    platform: 'VeerSeva Defense Benefits Orchestrator',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

module.exports = router;
