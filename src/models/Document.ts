// ============================================================
// MONGODB MODEL - src/models/Document.ts
//
// WHY MONGODB?
// We use MongoDB to store the FULL document data (title, content,
// all metadata). Pinecone only stores vectors + small metadata.
// MongoDB is the "source of truth" for the actual content.
//
// RELATIONSHIP: MongoDB <---> Pinecone
// - MongoDB stores: full content, all fields, timestamps
// - Pinecone stores: vector (384 numbers) + mongoId reference
// - When user searches → Pinecone finds similar vectors →
//   returns mongoIds → we fetch full docs from MongoDB
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';
import { IDocument } from '../types';

// Extend Mongoose's Document type with our IDocument interface.
// This gives us full TypeScript support on mongoose documents.
export interface IDocumentModel extends IDocument, Document {}

const DocumentSchema = new Schema<IDocumentModel>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true,
      // Index this field — speeds up filtering by category in MongoDB
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
  },
  {
    // timestamps: true automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// Text index for basic MongoDB text search (keyword-based backup).
// Pinecone does semantic search; this is traditional keyword search.
DocumentSchema.index({ title: 'text', content: 'text', tags: 'text' });

export const DocumentModel = mongoose.model<IDocumentModel>(
  'Document',
  DocumentSchema
);
