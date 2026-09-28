import express from 'express';
import { 
  signup, 
  login, 
  requestPasswordReset, 
  verifyResetOTP, 
  resetPassword,
  verifyEmail,
  resendVerificationCode,
  getProfile,        // ✅ ADDED
  updateProfile,     // ✅ ADDED
  changePassword,    // ✅ ADDED
  uploadProfileAvatar,
  deleteProfileAvatar
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { avatarUploadSingle } from '../middleware/avatarUpload.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);

// Protected routes (require authentication)
router.get('/profile', authenticateToken, getProfile);           // ✅ ADDED
router.put('/profile', authenticateToken, updateProfile);        // ✅ ADDED
router.post('/profile/avatar', authenticateToken, avatarUploadSingle, uploadProfileAvatar);
router.delete('/profile/avatar', authenticateToken, deleteProfileAvatar);
router.put('/change-password', authenticateToken, changePassword); // ✅ ADDED

export default router;