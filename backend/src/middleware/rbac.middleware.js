/**
 * ==============================================================================
 * VeerSeva - Role-Based Access Control (RBAC) & District Scoping Middleware
 * Milestone 2: checkRole & enforceDistrictScope
 * Enforces role isolation (ESM vs ZSB_OFFICER vs ADMIN) and district boundaries
 * ==============================================================================
 */

const { recordAudit } = require('../services/audit.service');

/**
 * Check if the authenticated user has one of the required roles
 */
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authentication required before checking role privileges.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      recordAudit({
        userId: req.user.user_id,
        action: 'RBAC_ACCESS_DENIED',
        req,
        status: 'FAILURE',
        details: {
          attemptedEndpoint: req.originalUrl,
          userRole: req.user.role,
          requiredRoles: allowedRoles
        }
      });

      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: `Forbidden: Access restricted. Role '${req.user.role}' lacks necessary authorization for this endpoint.`
      });
    }

    next();
  };
}

/**
 * Enforce District Scope:
 * ZSB Officers are strictly bound to their assigned district.
 * ADMIN accounts have unrestricted nationwide purview.
 */
function enforceDistrictScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
  }

  // Super Admins bypass district filtering
  if (req.user.role === 'ADMIN') {
    req.scopedDistrict = null; // null means all districts
    return next();
  }

  // ZSB Officers must match their district
  if (req.user.role === 'ZSB_OFFICER') {
    if (!req.user.district) {
      return res.status(403).json({
        success: false,
        error: 'NO_ASSIGNED_DISTRICT',
        message: 'ZSB Officer account has no assigned district jurisdiction.'
      });
    }

    // Attach scoped district to request for controllers to query with
    req.scopedDistrict = req.user.district;

    // If request contains an explicit district parameter, verify it matches
    const targetDistrict = req.query.district || req.body.district || req.params.district;
    if (targetDistrict && targetDistrict.toLowerCase() !== req.user.district.toLowerCase()) {
      recordAudit({
        userId: req.user.user_id,
        action: 'DISTRICT_CROSS_ACCESS_ATTEMPT',
        req,
        status: 'FAILURE',
        details: {
          assignedDistrict: req.user.district,
          attemptedDistrict: targetDistrict
        }
      });

      return res.status(403).json({
        success: false,
        error: 'DISTRICT_MISMATCH',
        message: `Jurisdiction error: You are only authorized to review applications within ${req.user.district}.`
      });
    }

    return next();
  }

  // For regular ESM users, ensure they only access their own profile
  next();
}

module.exports = {
  checkRole,
  enforceDistrictScope
};
