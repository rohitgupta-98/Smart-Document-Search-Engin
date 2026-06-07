// ============================================================
// SEED SCRIPT - src/scripts/seedData.ts
//
// Populates the database with sample documents for testing.
// Run with: npm run seed
//
// This is great for testing semantic search! The documents
// span different topics. Try searching for:
//   "artificial intelligence" → finds neural networks, ML docs
//   "staying healthy"         → finds health/mindfulness docs
//   "coding best practices"   → finds TypeScript, Docker docs
//   "money and investments"   → finds finance docs
//
// Notice: searching "staying healthy" matches "Mediterranean diet"
// even though "staying healthy" isn't in the document text.
// THAT'S semantic search working!
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { DocumentModel } from '../models/Document';
import { upsertVector } from '../services/pineconeService';
import { generateDocumentEmbedding } from '../services/embeddingService';
import { initializePineconeIndex } from '../services/pineconeService';

// Sample documents across different categories
const sampleDocuments = [
  {
    title: 'Introduction to Neural Networks',
    category: 'technology',
    author: 'Alice Chen',
    tags: ['AI', 'deep learning', 'neural networks'],
    content: `Neural networks are computing systems vaguely inspired by the biological neural networks that constitute animal brains. A neural network consists of layers of interconnected nodes or neurons that process information using connectionist approaches to computation. The network learns to perform tasks by considering examples, generally without being programmed with task-specific rules. Deep learning uses multiple layers in the network to progressively extract higher-level features from raw input data.`,
  },
  {
    title: 'Getting Started with Node.js',
    category: 'technology',
    author: 'Bob Smith',
    tags: ['nodejs', 'javascript', 'backend'],
    content: `Node.js is a cross-platform, open-source server environment that can run on Windows, Linux, Unix, and macOS. Node.js is a back-end JavaScript runtime environment, runs on the V8 JavaScript engine, and executes JavaScript code outside a web browser. Node.js lets developers use JavaScript to write command line tools and for server-side scripting to produce dynamic web page content before the page is sent to the user's web browser.`,
  },
  {
    title: 'Healthy Cooking: Mediterranean Diet Guide',
    category: 'health',
    author: 'Maria Garcia',
    tags: ['nutrition', 'cooking', 'diet', 'healthy living'],
    content: `The Mediterranean diet is a way of eating based on the traditional cuisine of countries bordering the Mediterranean Sea. It includes a high consumption of vegetables, legumes, fruits, nuts, cereals, fish, and olive oil. The diet is associated with a reduced risk of cardiovascular disease, certain cancers, and Alzheimer's disease. Olive oil, which is rich in monounsaturated fatty acids, is the primary source of added fat in the Mediterranean diet.`,
  },
  {
    title: 'Understanding Climate Change',
    category: 'science',
    author: 'Dr. James Wilson',
    tags: ['environment', 'climate', 'global warming'],
    content: `Climate change refers to long-term shifts in temperatures and weather patterns. Some shifts are natural, such as through variations in the solar cycle. But since the 1800s, human activities have been the main driver of climate change, primarily due to burning fossil fuels like coal, oil, and gas. Burning fossil fuels generates greenhouse gas emissions that act like a blanket wrapped around the Earth, trapping the sun's heat and raising temperatures.`,
  },
  {
    title: 'TypeScript Best Practices',
    category: 'technology',
    author: 'Emily Park',
    tags: ['typescript', 'javascript', 'programming'],
    content: `TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. Best practices include using strict mode for better type safety, avoiding the "any" type when possible, using interfaces for object shapes, leveraging union types and type guards, and making good use of generics for reusable code. TypeScript's type system helps catch errors at compile time rather than at runtime.`,
  },
  {
    title: 'Machine Learning in Healthcare',
    category: 'health',
    author: 'Dr. Sarah Johnson',
    tags: ['AI', 'healthcare', 'machine learning', 'medical'],
    content: `Artificial intelligence and machine learning are transforming healthcare by enabling more accurate diagnoses, personalized treatments, and drug discovery. ML algorithms can analyze medical images to detect diseases like cancer earlier than human doctors. Natural language processing helps extract insights from unstructured clinical notes. Predictive analytics can identify high-risk patients before their conditions worsen, enabling preventive care.`,
  },
  {
    title: 'Stock Market Investing Basics',
    category: 'finance',
    author: 'Michael Brown',
    tags: ['investing', 'stocks', 'finance', 'money'],
    content: `Investing in the stock market involves buying shares of publicly traded companies. When you buy stock, you become a partial owner of the company. Stock prices fluctuate based on company performance, economic conditions, and investor sentiment. Diversification — spreading investments across different sectors and asset classes — helps reduce risk. Long-term investing through index funds is often recommended for beginners due to lower fees and broad market exposure.`,
  },
  {
    title: 'The Art of Public Speaking',
    category: 'personal-development',
    author: 'Lisa Rodriguez',
    tags: ['communication', 'public speaking', 'skills'],
    content: `Public speaking is a skill that can be developed with practice and proper techniques. Effective speakers prepare thoroughly, know their audience, and structure their message clearly. Managing anxiety involves deep breathing, preparation, and reframing nervousness as excitement. Engaging the audience through stories, questions, and eye contact makes presentations memorable. Body language, including confident posture and appropriate gestures, reinforces your message.`,
  },
  {
    title: 'Introduction to Docker and Containers',
    category: 'technology',
    author: 'David Kim',
    tags: ['docker', 'containers', 'devops', 'deployment'],
    content: `Docker is a platform for developing, shipping, and running applications in containers. A container is a lightweight, standalone, executable package that includes everything needed to run an application: code, runtime, system tools, libraries, and settings. Containers isolate software from its environment and ensure it works uniformly despite differences in development and staging environments. Docker Compose allows you to define multi-container applications with a single YAML file.`,
  },
  {
    title: 'Mindfulness and Mental Health',
    category: 'health',
    author: 'Dr. Aisha Patel',
    tags: ['mental health', 'mindfulness', 'meditation', 'wellbeing'],
    content: `Mindfulness is the psychological process of purposely bringing one's attention to experiences occurring in the present moment without judgment. Research has shown that mindfulness meditation can reduce symptoms of anxiety, depression, and chronic pain. Regular practice involves techniques such as focused breathing, body scan meditation, and mindful observation. Mindfulness-based cognitive therapy (MBCT) has been shown to be as effective as antidepressants in preventing depression relapse.`,
  },
];

// ─────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────
const seedDatabase = async (): Promise<void> => {
  console.log('🌱 Starting database seeding...\n');

  await connectDB();
  await initializePineconeIndex();

  // Skip if data already exists (prevents duplicates)
  const existingCount = await DocumentModel.countDocuments();
  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing documents. Skipping seed.`);
    console.log('   To re-seed, clear the MongoDB collection first.\n');
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log(`📝 Inserting ${sampleDocuments.length} sample documents...\n`);

  for (let i = 0; i < sampleDocuments.length; i++) {
    const doc = sampleDocuments[i];
    console.log(`[${i + 1}/${sampleDocuments.length}] Processing: "${doc.title}"`);

    try {
      // 1. Save to MongoDB
      const savedDoc = await DocumentModel.create(doc);
      const mongoId = savedDoc._id.toString();

      // 2. Generate embedding (text → 384-number vector)
      const vector = await generateDocumentEmbedding(doc.title, doc.content);
      console.log("vector", vector);
      // 3. Store vector in Pinecone with metadata
      await upsertVector(mongoId, vector, {
        mongoId,
        title: doc.title,
        category: doc.category,
        author: doc.author,
        tags: doc.tags,
        preview: doc.content.substring(0, 200),
      });

      console.log(`   ✅ ID: ${mongoId}`);
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }
  }

  console.log('\n🎉 Seeding complete!\n');
  console.log('Try these semantic searches to see Pinecone in action:');
  console.log('  • "artificial intelligence"  → finds AI/ML documents');
  console.log('  • "staying healthy"          → finds health documents');
  console.log('  • "money and investments"    → finds finance documents');
  console.log('  • "coding best practices"    → finds technology documents\n');

  await mongoose.connection.close();
  process.exit(0);
};

seedDatabase().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
