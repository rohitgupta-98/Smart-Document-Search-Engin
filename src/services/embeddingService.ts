// ============================================================
// EMBEDDING SERVICE - src/services/embeddingService.ts
//
// WHAT IS AN EMBEDDING?
// An embedding is a list of numbers (a "vector") that represents
// the "meaning" of a piece of text. Texts with similar meaning
// will have vectors that are close together in mathematical space.
//
// Example:
//   "I love cats"       → [0.12, -0.45, 0.87, ...] (384 numbers)
//   "I adore kittens"   → [0.11, -0.43, 0.89, ...] (very similar!)
//   "Stock market crash" → [-0.23, 0.67, -0.12, ...] (very different)
//
// WHY FREE?
// We use @xenova/transformers which runs the AI model LOCALLY
// in Node.js — no API calls, no cost, works offline!
// Model: "Xenova/all-MiniLM-L6-v2"
//   - 384 dimensions output
//   - ~22MB download (happens once, cached locally)
//   - Trained on 1 billion sentence pairs
//   - Very fast, great for semantic similarity
//
// This is the KEY difference from keyword search:
//   Keyword: "dog food" does NOT match "puppy meal"
//   Semantic: "dog food" DOES match "puppy meal" (same meaning!)
// ============================================================

// Singleton pattern: load model once, reuse forever
// Loading the model takes ~5-30 seconds, so we do it once
let pipeline: any = null;
let pipelineLoading = false;
let pipelineReady = false;

// Lazy-load the pipeline only when first needed
const getPipeline = async () => {
  if (pipelineReady && pipeline) return pipeline;

  // Prevent multiple simultaneous loads (race condition protection)
  if (pipelineLoading) {
    while (pipelineLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return pipeline;
  }

  pipelineLoading = true;
  console.log('🤖 Loading embedding model (first time ~30 seconds, downloads ~22MB)...');

  try {
    // Dynamic import — @xenova/transformers uses ES modules
    const { pipeline: createPipeline } = await import('@xenova/transformers');

    // 'feature-extraction' = convert text to a vector
    // 'Xenova/all-MiniLM-L6-v2' = the model we're using
    pipeline = await createPipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );

    pipelineReady = true;
    pipelineLoading = false;
    console.log('✅ Embedding model loaded successfully!');
    return pipeline;
  } catch (error) {
    pipelineLoading = false;
    throw new Error(`Failed to load embedding model: ${error}`);
  }
};

// ============================================================
// generateEmbedding()
// Converts a text string into a 384-dimensional vector.
// This vector is what gets stored in Pinecone.
// ============================================================
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const pipe = await getPipeline();
console.log("pipe", pipe);
  // Clean up the text — remove extra whitespace/newlines
  const cleanText = text.replace(/\s+/g, ' ').trim();
console.log("cleanText", cleanText);
  // Run the model:
  // pooling: 'mean' = average all token embeddings into one vector
  // normalize: true = make vector length = 1 (required for cosine similarity)
  const output = await pipe(cleanText, {
    pooling: 'mean',
    normalize: true,
  });
console.log("output", output);
  // Convert from Float32Array to regular number array
  return Array.from(output.data as Float32Array);
};

// ============================================================
// generateDocumentEmbedding()
// For documents, combine title + content for richer embeddings.
// Title often has the most important keywords, so we repeat it
// to give it more "weight" in the final vector.
// ============================================================
export const generateDocumentEmbedding = async (
  title: string,
  content: string
): Promise<number[]> => {
  // Repeat title twice → the model sees it as more important
  // Limit content to 512 chars — model has a token limit
  const combinedText = `${title}. ${title}. ${content.substring(0, 512)}`;
  console.log("combinedText", combinedText);
  return generateEmbedding(combinedText);
};
