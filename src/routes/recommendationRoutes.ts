import { Router } from 'express';
import {
  getSimilarDocuments,
  getPersonalizedRecommendations,
  getTrendingRecommendations,
} from '../services/recommendationService';

const router = Router();

// Similar to a specific document
// GET /api/recommendations/similar/:docId?limit=5
router.get('/similar/:docId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const results = await getSimilarDocuments(req.params.docId, limit);
    res.json({ success: true, type: 'similar', results });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Personalized for a user
// GET /api/recommendations/for/:userId?limit=5
router.get('/for/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const results = await getPersonalizedRecommendations(req.params.userId, limit);
    res.json({ success: true, type: 'personalized', results });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Trending globally
// GET /api/recommendations/trending?limit=5
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const results = await getTrendingRecommendations(limit);
    res.json({ success: true, type: 'trending', results });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;