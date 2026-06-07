// ============================================================
// SERVER ENTRY POINT - src/server.ts
//
// This is the MAIN file that starts everything.
// Run: npm run dev
//
// STARTUP ORDER (matters!):
//   1. Load .env variables FIRST — everything else reads from them
//   2. Connect to MongoDB
//   3. Initialize Pinecone index (create if doesn't exist)
//   4. Start HTTP server
// ============================================================

import dotenv from 'dotenv';

// Load .env BEFORE importing anything that reads process.env
// (connectDB and initializePineconeIndex read env vars at import time)
dotenv.config();

import app from './app';
import { connectDB } from './config/database';
import { initializePineconeIndex } from './services/pineconeService';

const PORT = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────
// STARTUP FUNCTION
// Using async/await for clean sequential initialization
// ─────────────────────────────────────────────
const startServer = async (): Promise<void> => {
  try {
    console.log('🚀 Starting Smart Doc Search...\n');

    // Step 1: Connect to MongoDB
    console.log('1️⃣  Connecting to MongoDB...');
    await connectDB();

    // Step 2: Initialize Pinecone index
    // Creates the index on first run, skips if already exists
    console.log('\n2️⃣  Initializing Pinecone...');
    await initializePineconeIndex();

    // Step 3: Start Express HTTP server
    app.listen(PORT, () => {
      console.log(`\n✅ Server running at http://localhost:${PORT}`);
      console.log(`🌐 UI: http://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health\n`);
      console.log('─'.repeat(50));
      console.log('📋 Available Endpoints:');
      console.log(`  GET    /api/health`);
      console.log(`  POST   /api/documents          (add document)`);
      console.log(`  GET    /api/documents           (list all)`);
      console.log(`  GET    /api/documents/search?q= (semantic search)`);
      console.log(`  GET    /api/documents/categories`);
      console.log(`  GET    /api/documents/:id`);
      console.log(`  DELETE /api/documents/:id`);
      console.log('─'.repeat(50));
      console.log('\n💡 Run "npm run seed" to add sample documents\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections (e.g., DB query that throws)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown on Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  process.exit(0);
});

startServer();
