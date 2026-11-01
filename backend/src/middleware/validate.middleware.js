/**
 * ==============================================================================
 * VeerSeva - Input Validation & Sanitization Middleware
 * Milestone 3: Joi Validation Schemas for Service Numbers, PPO, Phone, Dates
 * ==============================================================================
 */

const Joi = require('joi');

// Service Number regex: e.g. JC-765432W, 14589234X, IC-45210K, ADM-HQ-001
const serviceNumberRegex = /^[A-Za-z0-9\-\/]{5,20}$/;
// PPO number regex: e.g. PPO/ARM/2024/0987654
const ppoRegex = /^[A-Za-z0-9\-\/]{6,30}$/;
// Indian Phone number regex: 10 digits or with +91
const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

// Validation middleware generator
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, '')
      }));

      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Input validation rejected at API gateway.',
        errors: details
      });
    }

    req.sanitizedBody = value;
    next();
  };
}

// 1. User Registration Schema
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid official/personal email address.',
    'any.required': 'Email is required.'
  }),
  password: Joi.string()
    .min(8)
    .max(64)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (!@#$%^&*).',
      'string.min': 'Password must be at least 8 characters long.'
    }),
  service_number: Joi.string().pattern(serviceNumberRegex).required().messages({
    'string.pattern.base': 'Invalid Indian Armed Forces Service Number format.'
  }),
  phone: Joi.string().pattern(phoneRegex).required().messages({
    'string.pattern.base': 'Please enter a valid 10-digit Indian mobile number.'
  }),
  role: Joi.string().valid('ESM', 'ZSB_OFFICER', 'ADMIN').default('ESM'),
  assigned_district: Joi.string().max(100).allow('', null),
  assigned_state: Joi.string().max(100).allow('', null),
  captchaToken: Joi.string().allow('', null) // Mock CAPTCHA placeholder
});

// 2. User Login Schema (Step 1)
const loginSchema = Joi.object({
  identifier: Joi.string().required().messages({
    'any.required': 'Please provide your Service Number or registered Email.'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required.'
  }),
  captchaToken: Joi.string().allow('', null)
});

// 3. Two-Factor Verification Schema (Step 2)
const verify2FASchema = Joi.object({
  identifier: Joi.string().required(),
  method: Joi.string().valid('OTP', 'TOTP', 'BACKUP_CODE').default('OTP'),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).when('method', { is: 'OTP', then: Joi.required() }),
  totpToken: Joi.string().length(6).pattern(/^\d{6}$/).when('method', { is: 'TOTP', then: Joi.required() }),
  backupCode: Joi.string().when('method', { is: 'BACKUP_CODE', then: Joi.required() }),
  isTaskSession: Joi.boolean().default(false),
  taskName: Joi.string().default('GENERAL')
});

// 4. ESM Profile Update Schema
const profileUpdateSchema = Joi.object({
  full_name: Joi.string().max(150),
  rank: Joi.string().max(100),
  corps_arm: Joi.string().max(100),
  ppo_number: Joi.string().pattern(ppoRegex),
  district: Joi.string().max(100),
  state: Joi.string().max(100),
  pincode: Joi.string().pattern(/^\d{6}$/),
  bank_name: Joi.string().max(100),
  account_number: Joi.string().min(8).max(20),
  ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
});

// 5. Dependent Schema
const dependentSchema = Joi.object({
  full_name: Joi.string().max(150).required(),
  relation: Joi.string().valid('SPOUSE', 'SON', 'DAUGHTER', 'MOTHER', 'FATHER', 'OTHER').required(),
  dob: Joi.date().iso().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future.'
  }),
  disability_status: Joi.boolean().default(false),
  education_status: Joi.string().max(150).allow('', null)
});

// 6. Application Submission Schema
const applicationSchema = Joi.object({
  scheme_id: Joi.string().required(),
  dependent_id: Joi.string().allow(null, ''),
  requested_amount: Joi.number().min(0).max(500000).required(),
  document_ids: Joi.array().items(Joi.string()).default([])
});

// 7. Admin Status Transition Schema
const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED').required(),
  review_notes: Joi.string().max(500).allow('', null),
  rejection_reason: Joi.string().max(500).allow('', null),
  disbursed_amount: Joi.number().min(0).allow(null)
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  verify2FASchema,
  profileUpdateSchema,
  dependentSchema,
  applicationSchema,
  statusUpdateSchema
};
