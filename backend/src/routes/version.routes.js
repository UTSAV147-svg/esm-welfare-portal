const express = require('express');
const router = express.Router();

const APP_VERSION = process.env.APP_VERSION || '1.2.0';
const BUILD_TIMESTAMP = new Date('2026-10-25T12:00:00Z').toISOString();

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    name: 'VeerSeva - Smart Orchestrator Platform for Indian Ex-Servicemen',
    version: APP_VERSION,
    build: '20261025.1',
    releaseDate: BUILD_TIMESTAMP,
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    features: [
      'Two-Step Verification with 5-min OTP & TOTP',
      '15-min Session Timebox & Task Sessions',
      'SPARSH / PCDA Pension & OROP-2 Live Tracker',
      'ECHS Healthcare Directory & Empaneled Hospitals',
      'CSD AFD Portal Canteen Catalog with Savings Calculator',
      'KSB PMSS & DGR Resettlement Board',
      'ZSB District-Scoped Workflow Review Engine',
      'CERT-In 180-Day Encrypted Audit Trail'
    ]
  });
});

module.exports = router;
