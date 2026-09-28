import express from 'express';
import { getQueueStatus } from '../controllers/queue.controller.js';
import { authenticateToken as auth } from '../middleware/auth.middleware.js';

const router = express.Router();

// ✅ Tanging auth lang, walang requireAdmin
router.get('/status', auth, getQueueStatus);

export default router;