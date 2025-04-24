// // server.js
// const express = require("express");
// const cors    = require("cors");
// const fs      = require("fs");
// const path    = require("path");

// // ——— 1) Load your pre‑computed embeddings JSON ———
// const embeddingsPath = path.join(__dirname, "data", "studiesEmbeddings.json");
// const embeddingsData = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));

// // ——— 2) Globals for the two pipelines ———
// let featureExtractor;   // Xenova embedding pipeline
// let chatSession;        // node-llama-cpp chat session

// // ——— 3) Model identifiers / paths ———
// const embedModelName = "Xenova/all-MiniLM-L6-v2";
// const llamaModelPath = path.join(__dirname, "models", "llama-2-7b.Q5_K_M.gguf");

// // ——— 4) Initialize both pipelines at startup ———
// async function initPipelines() {
//   // — 4a) LLaMA chat session
//   const llamaModule = await import("node-llama-cpp");
//   const { getLlama, LlamaChatSession, GeneralChatWrapper } = llamaModule;

//   console.log("Loading LLaMA model from:", llamaModelPath);
//   const llama     = await getLlama();
//   const model     = await llama.loadModel({ modelPath: llamaModelPath });
//   const context   = await model.createContext();
//   chatSession = new LlamaChatSession({
//     contextSequence: context.getSequence(),
//     chatWrapper:     new GeneralChatWrapper(),
//     systemPrompt:
//       "You are a knowledgeable fitness assistant. Use *only* the studies provided below. " +
//       "Answer clearly, concisely, and cite exactly the study titles and URLs. " +
//       "If none of the provided studies answer, respond “I don’t know.”",
//   });
//   console.log("✨ LLaMA chat session initialized.");

//   // — 4b) Xenova embedding pipeline
//   const xenova = await import("@xenova/transformers");
//   featureExtractor = await xenova.pipeline("feature-extraction", embedModelName);
//   console.log("✨ Embedding pipeline initialized.");
// }

// // ——— 5) Helpers for embeddings ———

// // Normalize whatever Xenova returns into a single [dim] array
// function normalizeEmbeddings(raw) {
//   // raw could be [1][seqLen][dim], [seqLen][dim], or already [dim]
//   if (Array.isArray(raw[0]) && Array.isArray(raw[0][0])) {
//     raw = raw[0];  // drop batch
//   }
//   if (!Array.isArray(raw[0])) {
//     return raw;    // already pooled
//   }
//   // average across token vectors
//   const seqLen = raw.length;
//   const dim    = raw[0].length;
//   const avg    = new Array(dim).fill(0);
//   for (let i = 0; i < seqLen; i++) {
//     for (let j = 0; j < dim; j++) {
//       avg[j] += raw[i][j];
//     }
//   }
//   return avg.map(v => v / seqLen);
// }

// async function createEmbedding(text) {
//   const raw = await featureExtractor(text, {
//     truncation: true,
//     max_length: 512,
//   });
//   return normalizeEmbeddings(raw);
// }

// function cosineSimilarity(a, b) {
//   let dot = 0, na = 0, nb = 0;
//   for (let i = 0; i < a.length; i++) {
//     dot += a[i] * b[i];
//     na  += a[i] * a[i];
//     nb  += b[i] * b[i];
//   }
//   return dot / (Math.sqrt(na) * Math.sqrt(nb));
// }

// // ——— 6) Express setup ———
// const app = express();
// app.use(express.json());
// app.use(cors());

// app.get("/", (_, res) => res.send("API is running..."));

// app.post("/api/ask", async (req, res) => {
//   try {
//     const { question } = req.body;
//     if (!question) {
//       return res.status(400).json({ error: "No question provided" });
//     }

//     // 6.1) Embed the question
//     const userEmb = await createEmbedding(question);

//     // 6.2) Score every chunk
//     const scored = embeddingsData.flatMap(study =>
//       study.chunks.map(chunk => ({
//         id:    study.id,
//         title: study.title,
//         url:   study.url,
//         text:  chunk.text,
//         sim:   cosineSimilarity(userEmb, chunk.embedding),
//       }))
//     );

//     // 6.3) Pick top‑3
//     const topChunks = scored
//       .sort((a, b) => b.sim - a.sim)
//       .slice(0, 3);

//     console.log("Top sims:", topChunks.map(c => c.sim.toFixed(3)));

//     // 6.4) Build the user message with those 3 refs
//     const refsText = topChunks
//       .map((c, i) =>
//         `Reference ${i+1} (${c.title}, ${c.url}): ` +
//         c.text.slice(0, 300).replace(/\n/g, " ") +
//         "..."
//       )
//       .join("\n\n");

//     const userMessage = `
// ${refsText}

// Question: ${question}
// `;

//     console.log("User →\n", userMessage);

//     // 6.5) Ask LLaMA to generate the answer
//     const response = await chatSession.prompt(userMessage, {
//       temperature:          0.8,
//       topP:                 0.95,
//       topK:                 40,
//       maxTokens:            256,
//       trimWhitespaceSuffix: true,
//     });

//     console.log("Assistant ←", response.trim());
//     res.json({
//       question,
//       answer:     response.trim(),
//       references: topChunks
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Something went wrong." });
//   }
// });

// initPipelines()
//   .then(() => {
//     app.listen(8000, () => console.log("🚀 Listening on port 8000"));
//   })
//   .catch(err => console.error("❌ Failed to start pipelines:", err));


// In which LLM CALL IS IN API/ASK
// const express = require("express");
// const cors = require("cors");
// const fs = require("fs");
// const path = require("path");

// // Load your embeddings data
// const embeddingsPath = path.join(__dirname, "data", "studiesEmbeddings.json");
// const embeddingsData = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));

// // Globals for pipelines and model context
// let pipeline;
// let featureExtractor;
// let model, context;  // LLaMA model and context

// const embedModelName = 'Xenova/all-MiniLM-L6-v2';
// const llamaModelPath = path.join(__dirname, "models", "vicuna-7b-v1.5.Q5_K_M.gguf");

// // Initialize both the embedding pipeline and the LLaMA model + context
// async function initPipeline() {
//   // Load LLaMA
//   const llamaModule = await import("node-llama-cpp");
//   const { getLlama } = llamaModule;
//   const llama = await getLlama();
//   model = await llama.loadModel({ modelPath: llamaModelPath });
//   context = await model.createContext();
//   console.log("✨ LLaMA model & context ready.");

//   // Load Xenova embedding pipeline
//   const xenova = await import('@xenova/transformers');
//   pipeline = xenova.pipeline;
//   featureExtractor = await pipeline('feature-extraction', embedModelName);
//   console.log("✨ Embedding pipeline initialized.");
// }

// function tensorToArray(tensor) {
//   const dims = tensor.dims;
//   if (!dims || dims.length !== 3) throw new Error("Unexpected tensor dimensions");
//   const [batch, seqLen, hiddenSize] = dims;
//   const flat = tensor.data;
//   const nested = [];
//   for (let i = 0; i < seqLen; i++) {
//     const start = i * hiddenSize;
//     nested.push(Array.from(flat.slice(start, start + hiddenSize)));
//   }
//   return nested;
// }

// async function createEmbedding(text) {
//   const tokenEmb = await featureExtractor(text, { max_length: 512, truncation: true });
//   const embeddings2D = tensorToArray(tokenEmb);
//   const dim = embeddings2D[0].length;
//   const avg = Array(dim).fill(0);
//   embeddings2D.forEach(vec => {
//     vec.forEach((v, i) => { avg[i] += v; });
//   });
//   return avg.map(v => v / embeddings2D.length);
// }

// function cosineSimilarity(a, b) {
//   let dot = 0, na = 0, nb = 0;
//   for (let i = 0; i < a.length; i++) {
//     dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
//   }
//   return dot / (Math.sqrt(na) * Math.sqrt(nb));
// }

// const app = express();
// app.use(express.json());
// app.use(cors());

// app.get("/", (_, res) => res.send("API is running..."));

// app.post("/api/ask", async (req, res) => {
//   try {
//     const { question } = req.body;
//     if (!question) return res.status(400).json({ error: "No question provided" });

//     // 1) Embed the question
//     const userEmb = await createEmbedding(question);
    
//     // 2) Score and pick top chunks
//     const scored = embeddingsData.flatMap(study =>
//       study.chunks.map(chunk => ({
//         title: study.title,
//         url: study.url,
//         text: chunk.text,
//         sim: cosineSimilarity(userEmb, chunk.embedding)
//       }))
//     );
//     scored.sort((a, b) => b.sim - a.sim);
//     const topChunks = scored.slice(0, 3);

//     const refsText = topChunks.map((c, i) =>
//       `Reference ${i+1} (${c.title}, ${c.url}): ` + c.text.replace(/\n/g, ' ')
//     ).join("\n\n");

//     const userMessage = `${refsText}\n\nQuestion: ${question}`;
//     console.log("User →\n", userMessage);

//     // 3) For each request, build a brand-new chat session
//     const { LlamaChatSession, resolveChatWrapper } = await import("node-llama-cpp");
//     const context = await model.createContext();
//     const session = new LlamaChatSession({
//       contextSequence: context.getSequence(),
//       chatWrapper: resolveChatWrapper(model, {}),
//       systemPrompt:
//         "You are a knowledgeable fitness assistant. " +
//     "I will give you three studies in the format “Reference X (Title, URL): text…”. " +
//     "You must respond in exactly two lines, no more, no less:\n" +
//     "1) “Conclusion: Yes (Study Title, URL)” or “Conclusion: No (Study Title, URL)”\n" +
//     "2) “Rationale: <one‑sentence explanation citing the same Study Title and URL>”\n" +
//     "Do NOT include any other text or headings"
//     });

//     const response = await session.prompt(userMessage, {
//       temperature: 0.0,
//       topP: 1.0,
//       topK: 40,
//       maxTokens: 1024,
//       trimWhitespaceSuffix: true,
//       responsePrefix: "",
//     });

//     console.log("AI →\n", response.trim());
//     res.json({ question, answer: response.trim(), topChunks });
//   } catch (err) {
//     console.error("Error in /api/ask:", err);
//     res.status(500).json({ error: "Something went wrong." });
//   }
// });

// const PORT = process.env.PORT || 8000;
// initPipeline()
//   .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
//   .catch(err => console.error("Failed to init pipelines:", err));

 
//Kinda working
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
let chatSession;        // node-llama-cpp chat session

const modelName = 'Xenova/all-MiniLM-L6-v2';
const llamaModelPath = path.join(__dirname, "models", "vicuna-7b-v1.5.Q5_K_M.gguf");

// We'll load the pipeline once, at server startup
async function initPipeline() {
  const llamaModule = await import("node-llama-cpp");
  const { getLlama, LlamaChatSession, resolveChatWrapper } = llamaModule;
  const llama     = await getLlama();
  const model     = await llama.loadModel({ modelPath: llamaModelPath });
  const context   = await model.createContext();
  
  chatSession = new LlamaChatSession({
    contextSequence: context.getSequence(),
    // let the library pick the right wrapper and honor systemPrompt
    chatWrapper: resolveChatWrapper(model, {}),
    systemPrompt:
      "You are a knowledgeable fitness assistant. " +
      "I will give you three studies in the format “Reference X (Title, URL): text…”. " +
      "You must respond in exactly two lines, no more, no less:\n" +
      "1) “Conclusion: Yes (Study Title, URL)” or “Conclusion: No (Study Title, URL)”\n" +
      "2) “Rationale: <one‑sentence explanation citing the same Study Title and URL>”\n" +
      "Do NOT include any other text or headings like [INST] or 'Reference' tags"
  });
  console.log("✨ LLaMA chat session initialized.");

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

    const refsText = topChunks
    .map((c, i) =>
      `Reference ${i+1} (${c.title}, ${c.url}): ` +
      c.text.replace(/\n/g, " ")
    )
    .join("\n\n");

    const userMessage = `
${refsText}

Question: ${question}`;


    console.log("User →\n", userMessage);

    // 6.5) Ask LLaMA to generate the answer
    const response = await chatSession.prompt(userMessage, {
      temperature:          0.0,
      topP:                 1.0,
      topK:                 40,
      maxTokens:            1024,
      trimWhitespaceSuffix: true,
      responsePrefix:       "",
    });

    // 2) immediately clear chat history (but keep systemPrompt)
    chatSession.resetChatHistory();

    console.log(" Uncleaned AI response →\n", response);

    // Post‑process with regex to strip out [INST] tags and "Reference X" prefixes
    const cleaned_response = response
      // … your previous clean-ups …
      .replace(/\[\/?INST\]/g, "")
      .replace(/Reference\s*\d+\s*/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      // **NEW**: remove *any* commas, parentheses or colons right before the URL
      .replace(/[\(\),:]+\s*(https?:\/\/[^\s]+)/g, "$1")
      // **OPTIONAL**: if you want to also strip a trailing colon *after* the URL
      .replace(/(https?:\/\/[^\s]+):/g, "$1")
      .trim();

    // OPTIONAL:
    // If you want a GPT-like answer, pass topChunks to an LLM prompt and return that.
    // For now, we'll just return the top chunks directly.
    console.log("AI →\n", cleaned_response);
    return res.json({
      question,
      answer: cleaned_response,
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

