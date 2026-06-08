import { Router } from 'express';
import { getTopSearchesController, getSearchTrendsController } from '../controllers/documentController';

const router = Router();

// GET /api/analytics/top?limit=10      → all-time top searches
router.get('/top', getTopSearchesController);

// GET /api/analytics/trends?days=7     → trending this week
router.get('/trends', getSearchTrendsController);

export default router;