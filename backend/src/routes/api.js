import { Router } from 'express';
import usersRouter from './users.js';

const router = Router();

// Mount sub-routers
router.use('/users', usersRouter);

// Example base route
router.get('/', (_req, res) => {
  res.json({ message: 'API v1', version: '1.0.0' });
});

export default router;
