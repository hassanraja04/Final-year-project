const express = require("express");
const cors = require("cors");
// require("dotenv").config();
const fs = require("fs");
const path = require("path");

// Load your embeddings data
const embeddingsPath = path.join(__dirname, "data", "studiesEmbeddings.json");
const embeddingsData = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));

// We'll dynamically import @xenova/transformers (ESM)
let pipeline;
let featureExtractor; 
const modelName = 'Xenova/all-MiniLM-L6-v2';

// We'll load the pipeline once, at server startup
async function initPipeline() {
  const xenova = await import('@xenova/transformers');
  pipeline = xenova.pipeline;
  console.log("Initializing local embedding pipeline...");
  featureExtractor = await pipeline('feature-extraction', modelName);
}

function tensorToArray(tensor) {
  const dims = tensor.dims;
  if (!dims || dims.length !== 3) {
    throw new Error("Unexpected tensor dimensions");
  }
  const [batch, seqLen, hiddenSize] = dims;
  const flat = tensor.data; // Assuming this is a Float32Array
  const nested = [];
  for (let i = 0; i < seqLen; i++) {
    const start = i * hiddenSize;
    const end = start + hiddenSize;
    nested.push(Array.from(flat.slice(start, end)));
  }
  return nested;
}

// Create an async function to embed text
async function createEmbedding(text) {
  const tokenEmbeddingsTensor = await featureExtractor(text, {
    max_length: 512,
    truncation: true,
  });
  const embeddings2D = tensorToArray(tokenEmbeddingsTensor); // Convert tensor to array

  const embeddingSize = embeddings2D[0].length;
  let avgEmbedding = new Array(embeddingSize).fill(0);

  for (const tokenVec of embeddings2D) {
    for (let i = 0; i < embeddingSize; i++) {
      avgEmbedding[i] += tokenVec[i];
    }
  }
  // Average over the token vectors
  for (let i = 0; i < embeddingSize; i++) {
    avgEmbedding[i] /= embeddings2D.length;
  }
  return avgEmbedding;
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const app = express();
app.use(express.json());
app.use(cors());

// Default route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// The /api/ask route
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "No question provided" });
    }

    // 1) Embed the user's question
    const userEmbedding = await createEmbedding(question);

    // 2) Loop over all studies + chunks to compute similarity
    let scoredChunks = [];
    for (const study of embeddingsData) {
      for (const chunkObj of study.chunks) {
        const sim = cosineSimilarity(userEmbedding, chunkObj.embedding);
        scoredChunks.push({
          id: study.id,
          title: study.title,
          url: study.url,
          chunkIndex: chunkObj.chunkIndex,
          text: chunkObj.text,
          similarity: sim
        });
      }
    }

    // 3) Sort by descending similarity
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // 4) Pick the top N chunks
    const topN = 3;
    const topChunks = scoredChunks.slice(0, topN);

    // OPTIONAL:
    // If you want a GPT-like answer, pass topChunks to an LLM prompt and return that.
    // For now, we'll just return the top chunks directly.
    return res.json({
      answer: "Here are your top 3 relevant chunks, from which we can craft an answer...",
      question,
      topChunks
    });
  } catch (error) {
    console.error("Error in /api/ask route:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
});

// Start server after pipeline is ready
const PORT = process.env.PORT || 8000;
initPipeline().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error("Failed to init pipeline:", err);
});
