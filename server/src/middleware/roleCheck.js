/**
 * Middleware factory to enforce Role-Based Access Control (RBAC).
 * 
 * @param {string[]} allowedRoles - Array of roles permitted to access the route
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'User context not found' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Route requires one of: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'`
      });
    }

    next();
  };
}

