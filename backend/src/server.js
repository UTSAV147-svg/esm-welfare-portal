/**
 * ==============================================================================
 * VeerSeva - Smart Orchestrator Platform for Indian Ex-Servicemen (ESM)
 * Master Express Server (REST API versioned at /api/v1)
 * Built to CERT-In Security Standards & High Concurrency Performance
 * ==============================================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cron = require('node-cron');

const { initDB } = require('./database/db');
const { refreshScrapers } = require('./services/scrapers.service');
const apiRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database connection (MySQL with resilient in-memory fallback)
initDB();

// 1. Security & Protection Headers (Helmet)
// Note: contentSecurityPolicy set to false in local dev/demo to allow smooth inline event handlers & UI transitions without CSP blocking
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. Strict CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
  })
);

// 3. Performance & Compression
app.use(compression());

// 4. Body & Cookie Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 5. HTTP Request Logging (excluding health checks to avoid noise)
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('dev', {
      skip: (req) => req.url === '/api/v1/health' || req.url.startsWith('/css') || req.url.startsWith('/js')
    })
  );
}

// Redirect sub-paths directly to the Single Unified Master Website
app.get(['/app', '/app/*'], (req, res) => res.redirect('/#veteran'));
app.get(['/admin', '/admin/*'], (req, res) => res.redirect('/#admin'));

// 6. Static File Serving for Frontend
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// 7. Mount REST API versioned at /api/v1
app.use('/api/v1', apiRoutes);

// Compatibility alias for Milestone 2 instructions (/api/auth/...)
app.use('/api', apiRoutes);

// 8. Cron Jobs: Periodic automated refreshing of scraped data
// Refresh every 6 hours: at minute 0 past every 6th hour (00:00, 06:00, 12:00, 18:00)
cron.schedule('0 */6 * * *', async () => {
  console.log('[Cron] Running scheduled auto-refresh for external defense portals data...');
  try {
    await refreshScrapers('ALL');
  } catch (err) {
    console.error('[Cron] Auto-refresh job failed:', err.message);
  }
});

// 9. Client SPA Route Fallbacks (Redirect sub-paths to the Single Unified Website)
app.get(['/app', '/app/*'], (req, res) => {
  res.redirect('/#veteran');
});

app.get(['/admin', '/admin/*'], (req, res) => {
  res.redirect('/#admin');
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 10. Global Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum 5 MB limit.'
    });
  }

  if (err.code === 'LIMIT_FILE_TYPE') {
    return res.status(415).json({
      success: false,
      error: 'UNSUPPORTED_FILE_TYPE',
      message: err.message
    });
  }

  console.error('[Global Error]', err);
  const status = err.status || 500;
  return res.status(status).json({
    success: false,
    error: err.name || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('============================================================');
    console.log(`🎖️  VeerSeva - ESM Benefits Orchestrator Server Running`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`🛡️  API Endpoints: http://localhost:${PORT}/api/v1`);
    console.log(`👤 Veteran Portal: http://localhost:${PORT}/app/`);
    console.log(`🏛️  Admin / ZSB Portal: http://localhost:${PORT}/admin/`);
    console.log('============================================================');
  });
}

module.exports = app;
