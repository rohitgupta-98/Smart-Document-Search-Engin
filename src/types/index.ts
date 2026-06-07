// ============================================================
// TYPE DEFINITIONS - src/types/index.ts
//
// TypeScript interfaces keep our code type-safe and readable.
// These types describe the shape of data flowing through the app.
//
// WHY USE INTERFACES?
// - Catch bugs at compile time, not runtime
// - Your editor gives you autocomplete
// - Code is self-documenting
// ============================================================
import { RecordMetadata } from '@pinecone-database/pinecone';

// What a document looks like in our system
export interface IDocument {
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// What we store in Pinecone alongside the vector.
// Pinecone lets you attach metadata to each vector for filtering.
// Keep it small — large metadata slows down queries.
export interface PineconeMetadata extends RecordMetadata{
  mongoId: string;  // Reference back to MongoDB document
  title: string;
  category: string;
  author: string;
  tags: string[];
  preview: string;  // First 200 chars of content for quick display
}

// Search result returned to the user
export interface SearchResult {
  mongoId: string;
  title: string;
  content: string;
  category: string;
  author: string;
  tags: string[];
  score: number;    // Similarity score from Pinecone (0 to 1)
  preview: string;
}

// Request body when adding a document
export interface AddDocumentBody {
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
}

// Request query when searching
export interface SearchQuery {
  q: string;          // The search text
  category?: string;  // Optional filter by category
  limit?: string;     // Number of results (default 5)
}
