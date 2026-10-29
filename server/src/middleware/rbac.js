import { ROLES } from '../config/constants.js';

/**
 * RBAC authorization middleware
 * @param {Array<string>} allowedRoles - Array of allowed roles (e.g. [ROLES.SUPER_ADMIN, ROLES.ADMIN])
 * @param {Function} [resourceCheck] - Optional async callback (req) => boolean | Promise<boolean>
 */
export const authorize = (allowedRoles = [], resourceCheck = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // super_admin has absolute full access to everything
      if (req.user.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      // Check role permission
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Access denied. Role '${req.user.role}' is not authorized for this action.`
        });
      }

      // If a resource check is provided, verify ownership/assignment
      if (resourceCheck) {
        const isAllowed = await resourceCheck(req);
        if (!isAllowed) {
          return res.status(403).json({
            message: 'Access denied. You do not have permission to access or modify this specific resource.'
          });
        }
      }

      next();
    } catch (error) {
      console.error('RBAC authorization error:', error);
      return res.status(500).json({ message: 'Authorization verification failed', error: error.message });
    }
  };
};
