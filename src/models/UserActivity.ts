// ============================================================
// USER ACTIVITY MODEL - src/models/UserActivity.ts
//
// Tracks what each user has searched and viewed.
// This is the data that powers personalized recommendations.
//
// We use a session-based userId (no auth needed for learning).
// In production you'd use a real user ID from your auth system.
//
// SCHEMA DESIGN:
// One document per user. Activities stored as an array inside.
// We cap the array at 20 items (only recent history matters).
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

interface IActivity {
  type: 'search' | 'view';     // searched a query OR viewed a document
  query?: string;              // if type=search: what they searched
  documentId?: string;         // if type=view: which doc they opened
  documentTitle?: string;      // store title so we don't need to re-fetch
  vector?: number[];           // store the vector for fast recommendation math
  timestamp: Date;
}

export interface IUserActivity extends Document {
  userId: string;              // session ID or real user ID
  activities: IActivity[];
  updatedAt: Date;
}

const ActivitySchema = new Schema<IActivity>({
  type:          { type: String, enum: ['search', 'view'], required: true },
  query:         { type: String },
  documentId:    { type: String },
  documentTitle: { type: String },
  vector:        { type: [Number] },   // cached embedding vector
  timestamp:     { type: Date, default: Date.now },
}, { _id: false });

const UserActivitySchema = new Schema<IUserActivity>(
  {
    userId:     { type: String, required: true, unique: true, index: true },
    activities: { type: [ActivitySchema], default: [] },
  },
  { timestamps: true }
);

export const UserActivityModel = mongoose.model<IUserActivity>(
  'UserActivity',
  UserActivitySchema
);