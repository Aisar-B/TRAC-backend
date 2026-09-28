import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    
    // decoded contains { userId, role, type? }
    req.user = decoded;
    next();
  });
};

// NEW: Role-based authorization middleware
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.user.role?.toLowerCase();
    const userType = req.user.type?.toLowerCase();

    // Check if user's role is in allowed roles
    // For admins: role might be 'admin', 'super_admin', etc.
    // For students: role might be 'student', 'alumni', etc.
    if (allowedRoles.includes(userRole) || allowedRoles.includes(userType)) {
      next();
    } else {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
  };
};

export const authorizeAdminRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.toLowerCase();
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied. This profile action is not available for your role.' });
  };
};

// NEW: Admin-only middleware (convenience wrapper)
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userRole = req.user.role?.toLowerCase();
  const userType = req.user.type?.toLowerCase();
  
  // Check if user is admin (role includes 'admin' or type is 'admin')
  if (userRole?.includes('admin') || userType === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }
};