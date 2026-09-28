import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { authenticateToken as auth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Dashboard stats - requires admin authentication
router.get('/dashboard-stats', auth, requireAdmin, getDashboardStats);

export default router;