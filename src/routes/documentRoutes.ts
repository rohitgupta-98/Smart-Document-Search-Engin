// ============================================================
// ROUTES - src/routes/documentRoutes.ts
//
// Routes map HTTP method + URL path → controller function.
// Express Router lets us group related routes and mount them
// under a common prefix in app.ts (/api/documents).
//
// WHY SEPARATE ROUTES FROM CONTROLLERS?
// Single Responsibility Principle — routes only handle routing,
// controllers handle logic. Easier to test and maintain.
// ============================================================

import { Router } from 'express';
import {
  addDocument,
  searchDocuments,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  getCategories,
} from '../controllers/documentController';

const router = Router();

// ─────────────────────────────────────────────────────────
// CRITICAL: Specific routes MUST come BEFORE dynamic routes!
//
// BAD ORDER:  /:id first, then /search
//   → Express treats "search" as the :id value → wrong!
//
// GOOD ORDER: /search first, then /:id  ✅
// ─────────────────────────────────────────────────────────

// GET  /api/documents/search?q=machine+learning  → semantic search
router.get('/search', searchDocuments);

// GET  /api/documents/categories  → list all unique categories
router.get('/categories', getCategories);

// GET  /api/documents             → list all documents (paginated)
router.get('/', getAllDocuments);

// POST /api/documents             → add new document
router.post('/', addDocument);

// GET  /api/documents/:id         → get single document by ID
router.get('/:id', getDocumentById);

// DELETE /api/documents/:id       → delete document
router.delete('/:id', deleteDocument);

export default router;
