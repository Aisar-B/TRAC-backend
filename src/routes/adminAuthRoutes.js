import express from 'express';
import { authenticateToken as auth, requireAdmin, authorizeRoles, authorizeAdminRoles } from '../middleware/auth.middleware.js';
import { avatarUploadSingle } from '../middleware/avatarUpload.js';
import {
  adminLogin,
  adminRegister,
  getCurrentAdmin,
  updateCurrentAdmin,
  uploadAdminAvatar,
  deleteAdminAvatar,
  changePassword,
  getAllAdmins,
  updateAdminStatus
} from '../controllers/adminAuthController.js';

const router = express.Router();

// ===========================================
// PUBLIC ROUTES
// ===========================================
router.post('/login', adminLogin);

// ===========================================
// PROTECTED ROUTES - All routes below require authentication AND admin role
// ===========================================
router.use(auth);
router.use(requireAdmin); // All routes below this require admin privileges

// ===========================================
// ADMIN ROUTES - Any admin can access
// ===========================================
router.get('/me', getCurrentAdmin);
router.patch('/me', authorizeAdminRoles('admin', 'staff'), updateCurrentAdmin);
router.post('/me/avatar', authorizeAdminRoles('admin', 'staff'), avatarUploadSingle, uploadAdminAvatar);
router.delete('/me/avatar', authorizeAdminRoles('admin', 'staff'), deleteAdminAvatar);
router.post('/change-password', changePassword);

// ===========================================
// SUPER ADMIN ONLY ROUTES
// ===========================================
router.post('/register', 
  authorizeRoles('super_admin'), 
  adminRegister
);

router.get('/admins', 
  authorizeRoles('super_admin'), 
  getAllAdmins
);

router.patch('/admins/:id/status', 
  authorizeRoles('super_admin'), 
  updateAdminStatus
);

export default router;