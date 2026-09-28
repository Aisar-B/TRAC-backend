import express from 'express';
import { authenticateToken as auth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/protected-test', auth, (req, res) => {
  console.log('you reach here');
  res.json({ message: 'Protected route reached successfully' });
});

export default router;