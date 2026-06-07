// ============================================================
// PINECONE SERVICE - src/services/pineconeService.ts
//
// WHAT IS PINECONE?
// Pinecone is a "vector database" — it stores vectors (arrays of
// numbers) and lets you find which ones are most similar to a
// query vector. It's optimized specifically for this use case.
//
// WHY NOT JUST USE MONGODB FOR VECTORS?
// MongoDB can store arrays, but searching for similar vectors
// in MongoDB would require comparing every single document —
// O(n) time, very slow at scale. Pinecone uses special
// algorithms (ANN - Approximate Nearest Neighbor) to find
// similar vectors in milliseconds, even with millions of them.
//
// FREE TIER (Pinecone Starter):
// - 1 index
// - 100,000 vectors (enough for thousands of documents)
// - No credit card required
// - Sign up at: https://www.pinecone.io
//
// HOW IT WORKS IN OUR APP:
// 1. User adds doc → generate vector → store in Pinecone + MongoDB
// 2. User searches → generate query vector → Pinecone finds
//    similar vectors → return matching doc IDs → fetch from MongoDB
// ============================================================

import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { PineconeMetadata, SearchResult } from '../types';
import { DocumentModel } from '../models/Document';

// Singleton Pinecone client — create once, reuse across requests
let pineconeClient: Pinecone | null = null;

// ============================================================
// getPineconeClient()
// Creates and returns the Pinecone client (singleton pattern).
// Reads API key from environment variables.
// ============================================================
const getPineconeClient = (): Pinecone => {
  if (pineconeClient) return pineconeClient;

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY is not defined in environment variables');
  }

  // Initialize Pinecone client with your API key
  pineconeClient = new Pinecone({ apiKey });
  return pineconeClient;
};

// ============================================================
// getIndex()
// Gets a reference to our Pinecone index.
// An "index" in Pinecone = a "collection" in MongoDB.
// It's where all our vectors live.
// ============================================================
const getIndex = () => {
  const client = getPineconeClient();
  console.log("client", client);
  const indexName = process.env.PINECONE_INDEX_NAME || 'smart-doc-search';
  // This does NOT make a network call — just creates a reference object
  console.log("indexName", indexName);
  return client.index(indexName);
};

// ============================================================
// upsertVector()
// Stores a vector in Pinecone.
// "Upsert" = INSERT if new, UPDATE if ID already exists.
//
// Each Pinecone record has three parts:
//   id:       unique string (we use the MongoDB _id)
//   values:   the actual vector [0.12, -0.45, ...] (384 numbers)
//   metadata: extra filterable data (title, category, author, etc.)
// ============================================================
export const upsertVector = async (
  mongoId: string,
  vector: number[],
  metadata: PineconeMetadata
): Promise<void> => {
  const index = getIndex();
console.log("index", index,mongoId,vector,metadata);
  await index.upsert([
    {
      id: mongoId,                          // Pinecone ID = MongoDB _id
      values: vector,                       // The 384-number embedding
      metadata: metadata as RecordMetadata, // Filterable metadata
    },
  ]);

  console.log(`📌 Vector upserted to Pinecone for doc: ${mongoId}`);
};

// ============================================================
// searchSimilarVectors()
// THE CORE OF SEMANTIC SEARCH!
//
// Takes a query vector and finds the most similar vectors
// in Pinecone using cosine similarity.
//
// Cosine similarity: measures the angle between two vectors
//   Score 1.0  = identical meaning (same vector direction)
//   Score 0.8+ = very similar meaning
//   Score 0.5  = somewhat related
//   Score 0.0  = completely unrelated (90° angle)
// ============================================================
export const searchSimilarVectors = async (
  queryVector: number[],
  topK: number = 5,         // Return top K most similar results
  categoryFilter?: string   // Optional: only return docs in this category
): Promise<SearchResult[]> => {
  const index = getIndex();

  // Build query options object
  const queryOptions: any = {
    vector: queryVector,
    topK,
    includeMetadata: true, // Return metadata alongside vectors
  };

  // If category filter is specified, add it as a Pinecone metadata filter.
  // This is like a WHERE clause in SQL — filters BEFORE similarity scoring.
  if (categoryFilter) {
    queryOptions.filter = {
      category: { $eq: categoryFilter },
    };
  }
console.log("queryOptions", queryOptions);
  // 🔥 Query Pinecone — this is where the magic happens!
  // Pinecone returns the topK most similar vectors in milliseconds
  const queryResponse = await index.query(queryOptions);
  console.log("queryResponse", queryResponse);
  const matches = queryResponse.matches || [];

  if (matches.length === 0) return [];

  // matches[].id = MongoDB document IDs
  // Pinecone tells us WHICH documents are similar,
  // MongoDB has the FULL content
  const mongoIds = matches.map((match) => match.id);

  // Fetch full document data from MongoDB using the IDs
  const documents = await DocumentModel.find({ _id: { $in: mongoIds } });

  // Create a Map for O(1) lookup by ID (faster than array.find())
  const docMap = new Map(
    documents.map((doc) => [doc._id.toString(), doc])
  );

  // Combine Pinecone similarity scores with MongoDB content
  const results: SearchResult[] = matches
    .map((match) => {
      const doc = docMap.get(match.id);
      if (!doc) return null;

      return {
        mongoId: match.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        author: doc.author,
        tags: doc.tags,
        score: Math.round((match.score || 0) * 100) / 100, // Round to 2 decimals
        preview: doc.content.substring(0, 200) + '...',
      };
    })
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score); // Highest score first

  return results;
};

// ============================================================
// deleteVector()
// Removes a vector from Pinecone when a document is deleted.
// ALWAYS keep MongoDB and Pinecone in sync!
// Orphaned vectors waste your free tier quota.
// ============================================================
export const deleteVector = async (mongoId: string): Promise<void> => {
  const index = getIndex();
  await index.deleteOne(mongoId);
  console.log(`🗑️  Vector deleted from Pinecone: ${mongoId}`);
};

// ============================================================
// initializePineconeIndex()
// Checks if our index exists; creates it if it doesn't.
// Called ONCE at server startup.
//
// INDEX SETTINGS (very important!):
//   dimension: 384 — MUST match our embedding model output!
//   metric: 'cosine' — best for text/NLP similarity tasks
//   serverless: uses Pinecone's free serverless tier on AWS
// ============================================================
export const initializePineconeIndex = async (): Promise<void> => {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME || 'smart-doc-search';

  try {
    // List existing indexes to check if ours already exists
    const indexList = await client.listIndexes();
    console.log("indexList",indexList);
    const indexes = indexList.indexes || [];
     console.log("indexes",indexes);
    const existingNames = indexes.map((idx: any) => idx.name);
 console.log("existingNames",existingNames);
    if (existingNames.includes(indexName)) {
      console.log(`✅ Pinecone index "${indexName}" already exists`);
      return;
    }

    // Create the index since it doesn't exist yet
    console.log(`🔨 Creating Pinecone index "${indexName}"...`);

   const newIndex = await client.createIndex({
      name: indexName,
      dimension: 384,    // MUST match all-MiniLM-L6-v2 output (384 dims)
      metric: 'cosine',  // cosine similarity — best for semantic text search
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1', // Free tier available in us-east-1
        },
      },
    });
    console.log("newIndex", newIndex);

    // Pinecone takes ~30-60 seconds to provision a new index
    console.log('⏳ Waiting for Pinecone index to be ready (~60 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 60000));
    console.log(`✅ Pinecone index "${indexName}" is ready!`);
  } catch (error: any) {
    // If index already exists (race condition), that's fine
    if (error?.message?.includes('already exists')) {
      console.log(`✅ Pinecone index "${indexName}" already exists`);
      return;
    }
    throw error;
  }
};
