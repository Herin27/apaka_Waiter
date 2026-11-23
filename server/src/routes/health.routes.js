import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    success: true,
    data: {
      service: 'Aapka Waiter API',
      status: 'ok',
      database: dbState,
      timestamp: new Date().toISOString(),
      credit: 'Designed & Developed by HeryxStudio',
    },
  });
});

export default router;
