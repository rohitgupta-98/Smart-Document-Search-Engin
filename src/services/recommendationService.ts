// ============================================================
// RECOMMENDATION SERVICE - src/services/recommendationService.ts
//
// THREE recommendation strategies:
//
// 1. getSimilarDocuments()
//    Input:  a document ID
//    How:    fetch that doc's vector from Pinecone → search for
//            similar vectors → return those docs
//    Use:    "More like this" on a document page
//
// 2. getPersonalizedRecommendations()
//    Input:  a userId
//    How:    fetch user's recent activity vectors → average them
//            into one "taste vector" → search Pinecone with it
//    Use:    "Recommended for you" based on history
//
// 3. getTrendingRecommendations()
//    Input:  nothing (global)
//    How:    fetch top searched queries from analytics →
//            run each as a Pinecone search → deduplicate results
//    Use:    "Trending now" section
//
// KEY INSIGHT:
// All three strategies reduce to the same Pinecone operation:
//   given a vector → find similar vectors
// The difference is just WHERE the vector comes from.
// ============================================================

import { Pinecone } from '@pinecone-database/pinecone';
import { DocumentModel } from '../models/Document';
import { UserActivityModel } from '../models/UserActivity';
import { SearchAnalyticsModel } from '../models/SearchAnalytics';
import { generateEmbedding } from './embeddingService';

let pineconeClient: Pinecone | null = null;
const getClient = () => {
  if (pineconeClient) return pineconeClient;
  const apiKey = process.env.PINECONE_API_KEY!;
  pineconeClient = new Pinecone({ apiKey });
  return pineconeClient;
};

const getIndex = () => {
  return getClient().index(process.env.PINECONE_INDEX_NAME || 'smart-doc-search');
};

// ============================================================
// STRATEGY 1: getSimilarDocuments()
// "More like this" — given a doc ID, find similar docs.
//
// HOW IT WORKS:
//   1. Fetch the document's vector FROM Pinecone (using fetch by ID)
//   2. Use that vector as the query vector
//   3. Search Pinecone for similar vectors
//   4. Exclude the original document from results
// ============================================================
export const getSimilarDocuments = async (
  documentId: string,
  limit: number = 5
) => {
  const index = getIndex();

  // Step 1: Fetch the document's own vector from Pinecone
  // We stored it when the document was added — no need to regenerate!
  const fetchResponse = await index.fetch([documentId]);
  const record = fetchResponse.records[documentId];

  if (!record || !record.values?.length) {
    throw new Error(`No vector found in Pinecone for document: ${documentId}`);
  }

  // Step 2: Use the document's own vector to find similar ones
  // topK + 1 because Pinecone will return the doc itself as #1 match
  const queryResponse = await index.query({
    vector: record.values,
    topK: limit + 1,
    includeMetadata: true,
  });

  const matches = queryResponse.matches || [];

  // Step 3: Remove the original document from results
  const filtered = matches.filter(m => m.id !== documentId);

  // Step 4: Fetch full content from MongoDB
  const ids = filtered.map(m => m.id);
  const documents = await DocumentModel.find({ _id: { $in: ids } });
  const docMap = new Map(documents.map(d => [d._id.toString(), d]));

  return filtered
    .map(match => {
      const doc = docMap.get(match.id);
      if (!doc) return null;
      return {
        mongoId:  match.id,
        title:    doc.title,
        category: doc.category,
        author:   doc.author,
        tags:     doc.tags,
        preview:  doc.content.substring(0, 150) + '...',
        score:    Math.round((match.score || 0) * 100) / 100,
        reason:   'Similar content',   // shown in UI
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};


// ============================================================
// STRATEGY 2: getPersonalizedRecommendations()
// "Recommended for you" — based on user's search/view history.
//
// HOW IT WORKS:
//   1. Load user's recent activity (last 10 actions)
//   2. Collect all the vectors from those activities
//   3. Average all vectors into one "taste vector"
//      → this represents the user's combined interests
//   4. Search Pinecone with the taste vector
//   5. Exclude docs the user already saw
//
// AVERAGE VECTOR EXAMPLE:
//   User searched "machine learning" → vector A
//   User viewed "Neural Networks doc" → vector B
//   Taste vector = (A + B) / 2
//   → recommendations will be in the "AI/tech" space
// ============================================================
export const getPersonalizedRecommendations = async (
  userId: string,
  limit: number = 5
) => {
  // Step 1: Load user's recent activity
  const userActivity = await UserActivityModel.findOne({ userId });

  if (!userActivity || userActivity.activities.length === 0) {
    // New user with no history → fall back to trending
    return getTrendingRecommendations(limit);
  }

  // Take only last 10 activities (recent history matters more)
  const recentActivities = userActivity.activities
    .slice(-10)
    .filter(a => a.vector && a.vector.length > 0);

  if (recentActivities.length === 0) {
    return getTrendingRecommendations(limit);
  }

  // Step 2: Average all activity vectors into one "taste vector"
  // This is called "mean pooling" across user history
  const vectorLength = recentActivities[0].vector!.length; // 384
  const tasteVector = new Array(vectorLength).fill(0);

  recentActivities.forEach(activity => {
    activity.vector!.forEach((val, i) => {
      tasteVector[i] += val;  // sum all vectors
    });
  });

  // Divide by count to get the average
  const avgVector = tasteVector.map(v => v / recentActivities.length);

  // Step 3: Search Pinecone with the taste vector
  const index = getIndex();
  const queryResponse = await index.query({
    vector: avgVector,
    topK: limit + 5,        // fetch extra, some may be excluded
    includeMetadata: true,
  });

  const matches = queryResponse.matches || [];

  // Step 4: Exclude documents the user already viewed
  const viewedIds = new Set(
    userActivity.activities
      .filter(a => a.type === 'view' && a.documentId)
      .map(a => a.documentId!)
  );

  const filtered = matches.filter(m => !viewedIds.has(m.id));

  // Step 5: Fetch full content from MongoDB
  const ids = filtered.map(m => m.id);
  const documents = await DocumentModel.find({ _id: { $in: ids } });
  const docMap = new Map(documents.map(d => [d._id.toString(), d]));

  return filtered
    .map(match => {
      const doc = docMap.get(match.id);
      if (!doc) return null;
      return {
        mongoId:  match.id,
        title:    doc.title,
        category: doc.category,
        author:   doc.author,
        tags:     doc.tags,
        preview:  doc.content.substring(0, 150) + '...',
        score:    Math.round((match.score || 0) * 100) / 100,
        reason:   'Based on your activity',
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};


// ============================================================
// STRATEGY 3: getTrendingRecommendations()
// "Trending now" — based on most searched queries globally.
//
// HOW IT WORKS:
//   1. Fetch top 5 most searched queries from SearchAnalytics
//   2. For each query, run a Pinecone search
//   3. Collect all results, deduplicate by document ID
//   4. Sort by a combined score (similarity × search popularity)
// ============================================================
export const getTrendingRecommendations = async (limit: number = 5) => {
  // Step 1: Get top searched queries from analytics
  const topQueries = await SearchAnalyticsModel
    .find()
    .sort({ count: -1 })
    .limit(5)
    .select('query count');

  if (topQueries.length === 0) {
    // No analytics yet → return newest documents
    const docs = await DocumentModel.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(doc => ({
      mongoId:  doc._id.toString(),
      title:    doc.title,
      category: doc.category,
      author:   doc.author,
      tags:     doc.tags,
      preview:  doc.content.substring(0, 150) + '...',
      score:    1,
      reason:   'Recently added',
    }));
  }

  const index = getIndex();
  const seenIds = new Set<string>();
  const allResults: any[] = [];

  // Step 2: Search Pinecone for each trending query
  for (const { query, count } of topQueries) {
    const queryVector = await generateEmbedding(query);
    const response = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    for (const match of response.matches || []) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        allResults.push({
          id:           match.id,
          pineconeScore: match.score || 0,
          searchCount:  count,           // how popular the query is
          query,
        });
      }
    }
  }

  // Step 3: Fetch full content from MongoDB
  const ids = allResults.map(r => r.id);
  const documents = await DocumentModel.find({ _id: { $in: ids } });
  const docMap = new Map(documents.map(d => [d._id.toString(), d]));

  return allResults
    .map(r => {
      const doc = docMap.get(r.id);
      if (!doc) return null;
      return {
        mongoId:  r.id,
        title:    doc.title,
        category: doc.category,
        author:   doc.author,
        tags:     doc.tags,
        preview:  doc.content.substring(0, 150) + '...',
        score:    Math.round(r.pineconeScore * 100) / 100,
        reason:   `Trending — people searched "${r.query}"`,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};


// ============================================================
// trackActivity()
// Called whenever a user searches or views a document.
// Saves the activity + vector to UserActivity collection.
//
// WHY STORE THE VECTOR?
// So we don't have to re-generate it when computing recommendations.
// Vectors are expensive to generate — cache them on first use.
// ============================================================
export const trackActivity = async (
  userId: string,
  type: 'search' | 'view',
  data: { query?: string; documentId?: string; documentTitle?: string; vector?: number[] }
) => {
  try {
    await UserActivityModel.findOneAndUpdate(
      { userId },
      {
        $push: {
          activities: {
            $each: [{ type, ...data, timestamp: new Date() }],
            $slice: -20,   // keep only last 20 activities
            $position: -1,
          },
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Failed to track activity:', error);
    // Non-critical — don't crash the request
  }
};