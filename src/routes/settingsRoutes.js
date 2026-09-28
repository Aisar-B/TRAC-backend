// backend/src/routes/settingsRoutes.js
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { getSettings, updateSettings, getPublicSettings } from '../controllers/settingsController.js';

const router = express.Router();

// 🆕 PUBLIC ROUTE — no authentication required
// Used by student frontend to get fees, max copies, etc.
router.get('/settings/public', getPublicSettings);

// Admin routes — require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;