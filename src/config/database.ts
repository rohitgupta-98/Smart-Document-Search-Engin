// ============================================================
// DATABASE CONNECTION - src/config/database.ts
//
// This file handles connecting to MongoDB using Mongoose.
// We connect ONCE when the server starts and reuse the connection.
//
// WHY MONGOOSE?
// Mongoose is an ODM (Object Data Modeling) library for MongoDB.
// It gives us: schemas, validation, TypeScript support, and
// a clean API instead of raw MongoDB driver calls.
// ============================================================

import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    // If env variable is missing, crash immediately with a clear error
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    // mongoose.connect() establishes the connection
    await mongoose.connect(mongoUri);

    console.log('✅ MongoDB connected successfully');

    // Listen for connection events for better debugging
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    // Exit the process if we can't connect to DB on startup
    process.exit(1);
  }
};
