// ============================================================
// DOCUMENT CONTROLLER - src/controllers/documentController.ts
//
// Controllers handle the BUSINESS LOGIC of each route.
// They receive the request, do the work, send the response.
//
// FLOW FOR ADDING A DOCUMENT:
//   Request → validate → save to MongoDB → generate embedding
//   → store vector in Pinecone → return success response
//
// FLOW FOR SEARCHING:
//   Query text → generate embedding → search Pinecone
//   → get MongoDB IDs → fetch full docs → return results
// ============================================================

import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { upsertVector, searchSimilarVectors, deleteVector } from '../services/pineconeService';
import { generateEmbedding, generateDocumentEmbedding } from '../services/embeddingService';
import { AddDocumentBody, SearchQuery } from '../types';

// ============================================================
// addDocument
// POST /api/documents
// Adds a document to MongoDB AND stores its vector in Pinecone
// ============================================================
export const addDocument = async (
  req: Request<{}, {}, AddDocumentBody>,
  res: Response
): Promise<void> => {
  try {
    const { title, content, category, tags, author } = req.body;

    // --- VALIDATION ---
    if (!title || !content || !category || !author) {
      res.status(400).json({
        success: false,
        message: 'title, content, category, and author are required',
      });
      return;
    }

    // --- STEP 1: Save to MongoDB ---
    // MongoDB stores the full document. We need its _id to link to Pinecone.
    const document = await DocumentModel.create({
      title,
      content,
      category: category.toLowerCase(),
      tags: tags || [],
      author,
    });
console.log("document", document);
    const mongoId = document._id.toString();
    console.log("mongoId", mongoId);
    console.log(`📄 Document saved to MongoDB: ${mongoId}`);

    // --- STEP 2: Generate Embedding ---
    // Convert title + content into a 384-number vector (the "meaning")
    const vector = await generateDocumentEmbedding(title, content);
    console.log("vector", vector);
    // --- STEP 3: Store Vector in Pinecone ---
    // Store the vector + small metadata for filtering/display
    await upsertVector(mongoId, vector, {
      mongoId,
      title,
      category: category.toLowerCase(),
      author,
      tags: tags || [],
      preview: content.substring(0, 200),
    });

    console.log(`✅ Document fully indexed: "${title}"`);

    res.status(201).json({
      success: true,
      message: 'Document added and indexed successfully',
      data: {
        id: mongoId,
        title: document.title,
        category: document.category,
        author: document.author,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add document',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============================================================
// searchDocuments
// GET /api/documents/search?q=your+query&category=tech&limit=5
//
// This is the MAIN feature — semantic search using Pinecone!
// Results are ranked by meaning similarity, not keyword matching.
// ============================================================
export const searchDocuments = async (
  req: Request<{}, {}, {}, SearchQuery>,
  res: Response
): Promise<void> => {
  try {
    const { q, category, limit = '5' } = req.query;

    if (!q || q.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Search query "q" is required' });
      return;
    }

    const topK = Math.min(parseInt(limit, 10) || 5, 20); // Cap at 20 results
    console.log(`Received search request with limit=${topK}`);
    const startTime = Date.now();

    console.log(`🔍 Searching: "${q}" (category: ${category || 'all'})`);

    // --- STEP 1: Convert search text to a vector ---
    // Same model as document indexing → comparable vectors
    const queryVector = await generateEmbedding(q.trim());
console.log("queryVector", queryVector);
    // --- STEP 2: Find similar vectors in Pinecone ---
    // Returns docs sorted by cosine similarity (most similar first)
    const results = await searchSimilarVectors(queryVector, topK, category);

    const searchTimeMs = Date.now() - startTime;
    console.log(`✅ Found ${results.length} results in ${searchTimeMs}ms`);

    res.json({
      success: true,
      query: q,
      category: category || 'all',
      totalResults: results.length,
      searchTimeMs,
      results,
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============================================================
// getAllDocuments
// GET /api/documents?page=1&pageSize=10
// Returns all documents from MongoDB with pagination
// ============================================================
export const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 10;
    const skip = (page - 1) * pageSize;

    // Run both queries in parallel with Promise.all for speed
    const [documents, total] = await Promise.all([
      DocumentModel.find()
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(pageSize)
        .select('-__v'),          // Exclude mongoose internal __v field
      DocumentModel.countDocuments(),
    ]);

    res.json({
      success: true,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

// ============================================================
// getDocumentById
// GET /api/documents/:id
// Returns a single document by its MongoDB ID
// ============================================================
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const document = await DocumentModel.findById(req.params.id).select('-__v');

    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch document' });
  }
};

// ============================================================
// deleteDocument
// DELETE /api/documents/:id
// Deletes from BOTH MongoDB AND Pinecone.
// IMPORTANT: Always delete from both to keep them in sync!
// If you only delete from MongoDB, Pinecone returns orphaned IDs.
// ============================================================
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const document = await DocumentModel.findById(id);
    if (!document) {
      res.status(404).json({ success: false, message: 'Document not found' });
      return;
    }

    // Delete from MongoDB first
    await DocumentModel.findByIdAndDelete(id);
    console.log(`🗑️  Deleted from MongoDB: ${id}`);

    // Then delete from Pinecone
    await deleteVector(id);
    console.log(`🗑️  Deleted from Pinecone: ${id}`);

    res.json({
      success: true,
      message: 'Document deleted from both MongoDB and Pinecone',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};

// ============================================================
// getCategories
// GET /api/documents/categories
// Returns all unique category values (for filter dropdown in UI)
// ============================================================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    // MongoDB's distinct() efficiently returns unique values for a field
    const categories = await DocumentModel.distinct('category');
    res.json({ success: true, categories: categories.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};
