// ============================================================
// SEARCH ANALYTICS MODEL - src/models/SearchAnalytics.ts
//
// Tracks every search query + how many times it was searched.
// Used to show trending searches, popular topics, etc.
//
// MongoDB operation used: findOneAndUpdate with upsert
//   - If query exists → increment count by 1
//   - If query doesn't exist → create it with count 1
// One document per unique query. No duplicates.
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

export interface ISearchAnalytics extends Document {
  query: string;           // the search text (normalized/lowercase)
  count: number;           // how many times this was searched
  lastSearchedAt: Date;    // when it was last searched
  resultsFound: number;    // how many results it returned (useful insight)
  createdAt: Date;
}

const SearchAnalyticsSchema = new Schema<ISearchAnalytics>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,   // "Machine Learning" = "machine learning" = same record
      unique: true,      // one document per unique query string
      index: true,
    },
    count: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastSearchedAt: {
      type: Date,
      default: Date.now,
    },
    resultsFound: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index by count descending — speeds up "get top searches" query
SearchAnalyticsSchema.index({ count: -1 });

export const SearchAnalyticsModel = mongoose.model<ISearchAnalytics>(
  'SearchAnalytics',
  SearchAnalyticsSchema
);