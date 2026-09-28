import express from 'express';
import { authenticateToken as auth, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getEmailLogs,
  getEmailLogById,
  getEmailLogsSummary,
  retryFailedEmail
} from '../controllers/emailLogsController.js';

const router = express.Router();

// All email log routes require authentication and admin privileges
router.use(auth);
router.use(requireAdmin);

// =============================================
// EMAIL LOGS ROUTES
// =============================================

// Get all email logs (with filters)
router.get('/email-logs', getEmailLogs);

// Get email logs summary for dashboard
router.get('/email-logs/summary', getEmailLogsSummary);

// Get specific email log by ID
router.get('/email-logs/:id', getEmailLogById);

// Retry a failed email
router.post('/email-logs/:id/retry', retryFailedEmail);

export default router;