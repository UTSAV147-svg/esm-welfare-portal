/**
 * ==============================================================================
 * VeerSeva - File Upload Middleware
 * Milestone 4: Multi-Part File Upload & Secure Document Pipeline
 * Strict MIME verification, 5MB ceiling, UUID-timestamp filename generation
 * ==============================================================================
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure destination storage directory exists outside web root
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate UUID-timestamp.ext to prevent path traversal & collisions
    const safeExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `DOC-${uuidv4()}-${Date.now()}${safeExt}`;
    cb(null, uniqueName);
  }
});

// Strict MIME type filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    const err = new Error('UNSUPPORTED_FILE_TYPE: Only standard PDF documents and JPEG/PNG images are accepted.');
    err.code = 'LIMIT_FILE_TYPE';
    cb(err, false);
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10);

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024 // 5 MB default
  }
});

module.exports = {
  upload,
  uploadDir
};
