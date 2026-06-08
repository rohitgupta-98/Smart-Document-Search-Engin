// ============================================================
// EXPRESS APP SETUP - src/app.ts
//
// This file creates and configures the Express application.
// We SEPARATE app setup (app.ts) from server startup (server.ts)
// so we can import the app for testing without starting the server.
//
// MIDDLEWARE ORDER MATTERS in Express!
// Each request passes through middleware top to bottom.
// ============================================================

import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import documentRoutes from './routes/documentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

// ─────────────────────────────────────────────
// SECURITY MIDDLEWARE (applied first)
// ─────────────────────────────────────────────

// helmet adds ~15 security-related HTTP headers automatically
// (prevents XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({ contentSecurityPolicy: false }));

// cors allows your frontend (possibly on a different port/domain)
// to call this API. In production, replace '*' with your domain.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — each IP gets max 100 requests per 15 minutes.
// Prevents abuse, DoS attacks, and runaway scripts.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// ─────────────────────────────────────────────
// GENERAL MIDDLEWARE
// ─────────────────────────────────────────────

// morgan logs every HTTP request to the console.
// 'dev' format: "GET /api/documents 200 15ms - 512b"
// Very helpful for debugging!
app.use(morgan('dev'));

// Parse incoming JSON request bodies.
// After this, req.body contains the parsed JSON object.
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded form data (for HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from the 'public' folder.
// This is how our frontend UI gets served at http://localhost:3000
app.use(express.static(path.join(__dirname, '../public')));

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// All document API routes are prefixed with /api/documents
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes)
app.use('/api/recommendations', recommendationRoutes);
// Health check endpoint — useful for monitoring / deployment checks
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─────────────────────────────────────────────
// ERROR HANDLING (MUST be registered LAST)
// Express processes middleware in order — these catch
// anything that falls through the routes above.
// ─────────────────────────────────────────────

app.use(notFoundHandler); // 404 for unknown routes
app.use(errorHandler);    // 500 for any thrown errors

export default app;
