// ============================================================
// ANALYTICS SERVICE - src/services/analyticsService.ts
//
// Two jobs:
//   1. recordSearch()   — called after every search
//   2. getTopSearches() — called to fetch trending queries
// ============================================================

import { SearchAnalyticsModel } from '../models/SearchAnalytics';

// ============================================================
// recordSearch()
// Called after every search completes.
// Uses MongoDB upsert — insert if new, increment if exists.
//
// WHY findOneAndUpdate instead of find + save?
// Atomic operation — safe even if two users search the same
// query at the exact same time (no race condition).
// ============================================================
export const recordSearch = async (
  query: string,
  resultsFound: number
): Promise<void> => {
  try {
    await SearchAnalyticsModel.findOneAndUpdate(
      { query: query.toLowerCase().trim() }, // find by query
      {
        $inc: { count: 1 },                  // increment count by 1
        $set: {
          lastSearchedAt: new Date(),         // update last searched time
          resultsFound,                       // update results count
        },
      },
      {
        upsert: true,    // create document if it doesn't exist
        new: true,       // return updated document
      }
    );
  } catch (error) {
    // Non-critical — don't crash the search if analytics fails
    console.error('Failed to record search analytics:', error);
  }
};

// ============================================================
// getTopSearches()
// Returns the most searched queries, sorted by count.
// Used for: trending searches UI, search suggestions, insights.
// ============================================================
export const getTopSearches = async (limit: number = 10) => {
  return SearchAnalyticsModel
    .find()
    .sort({ count: -1 })           // highest count first
    .limit(limit)
    .select('query count lastSearchedAt resultsFound -_id');
};

// ============================================================
// getSearchTrends()
// Returns searches from the last N days — useful for "trending
// this week" vs "all time popular" features.
// ============================================================
export const getSearchTrends = async (days: number = 7, limit: number = 10) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return SearchAnalyticsModel
    .find({ lastSearchedAt: { $gte: since } })
    .sort({ count: -1 })
    .limit(limit)
    .select('query count lastSearchedAt resultsFound -_id');
};