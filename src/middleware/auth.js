import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// =============================================
// AUTHENTICATE TOKEN MIDDLEWARE
// =============================================
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user; // { userId, role, type? }
    next();
  });
};

// =============================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// =============================================
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.user.role?.toLowerCase();
    const userType = req.user.type?.toLowerCase();

    if (allowedRoles.includes(userRole) || allowedRoles.includes(userType)) {
      next();
    } else {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
  };
};

// =============================================
// ADMIN-ONLY MIDDLEWARE (convenience wrapper)
// =============================================
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userRole = req.user.role?.toLowerCase();
  const userType = req.user.type?.toLowerCase();
  
  if (userRole?.includes('admin') || userType === 'admin' || userRole === 'super_admin') {
    next();
  } else {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
};