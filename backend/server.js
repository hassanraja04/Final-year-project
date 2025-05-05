//Kinda working
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const CHATS_FILE = path.join(__dirname, "data", "chats.json");

// loading/initialising the chat-store
let chats = {};
try {
  chats = JSON.parse(fs.readFileSync(CHATS_FILE, "utf8"));
} catch {
  chats = {};
}
function saveChats() {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
}

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
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: llamaModelPath });
  const context = await model.createContext();
  
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
  console.log("LLaMA chat session initialized");

  const xenova = await import('@xenova/transformers');
  pipeline = xenova.pipeline;
  console.log("Initializing local embedding pipeline...");
  featureExtractor = await pipeline('feature-extraction', modelName);
}
// Takes the complex tensor structure and simplifies it into an array
function tensorToArray(tensor) {
  const dims = tensor.dims;
  // Making sure the data format is correct
  if (!dims || dims.length !== 3) {
    throw new Error("Unexpected tensor dimensions");
  }
  const [batch, seqLen, hiddenSize] = dims;
  const flat = tensor.data; // this is a Float32Array
  // Nested array for convinience
  const nested = [];
  for (let i = 0; i < seqLen; i++) {
    const start = i * hiddenSize;
    const end = start + hiddenSize;
    nested.push(Array.from(flat.slice(start, end)));
  }
  return nested;
}

// Creates a document embedding by tokenizing text, generating token embeddings 
async function createEmbedding(text) {
  // Get embeddings from the model
  const tokenEmbeddingsTensor = await featureExtractor(text, {
    max_length: 512,
    truncation: true,
  });
  // Makes the data easier to work with
  const embeddings2D = tensorToArray(tokenEmbeddingsTensor); 

  const embeddingSize = embeddings2D[0].length;
  // Creates an average of all token embeddings
  let avgEmbedding = new Array(embeddingSize).fill(0);

  // Adding up all the vectors
  for (const tokenVec of embeddings2D) {
    for (let i = 0; i < embeddingSize; i++) {
      avgEmbedding[i] += tokenVec[i];
    }
  }
  // Averaging over the token vectors
  for (let i = 0; i < embeddingSize; i++) {
    avgEmbedding[i] /= embeddings2D.length;
  }
  return avgEmbedding;
}

// Measures how similar two text embeddings are
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  // Calculates dot product and vector magnitudes in one pass for efficiency
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];       // Dot product calculation
    normA += a[i] * a[i];     // Size of first vector
    normB += b[i] * b[i];     // Size of second vector
  }
  // Cosine similarity formula
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

    // Embeding the user's question
    const userEmbedding = await createEmbedding(question);

    // looping over all chunks and calculating similarity
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

    // Ranking chunks from most similar to least similar 
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // Picking the top N chunks
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

    // Asking LLaMa to generate the response
    const response = await chatSession.prompt(userMessage, {
      temperature:          0.0,
      topP:                 1.0,
      topK:                 40,
      maxTokens:            1024,
      trimWhitespaceSuffix: true,
      responsePrefix:       "",
    });

    // Clearing the chat history to prevent the model from learning from bad responses 
    chatSession.resetChatHistory();

    console.log(" Uncleaned AI response →\n", response);

    // Post‑processing with regex to remove [INST] and "Reference X" tags
    const cleaned_response = response
      .replace(/\[\/?INST\]/g, "")
      .replace(/Reference\s*\d+\s*/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/[\(\),:]+\s*(https?:\/\/[^\s]+)/g, "$1")
      .replace(/(https?:\/\/[^\s]+):/g, "$1")
      .trim();

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

// List all chats
app.get("/api/chats", (req, res) => {
  // Transforming chat objects into a clean list format for the frontend
  const list = Object.entries(chats).map(([id, chat]) => ({
    id,
    title: chat.title || "New chat"
  }));
  res.json(list);
});

// Create a brand-new chat
app.post("/api/chats", (req, res) => {
  // Generating a new identifier for this chat
  const id = uuidv4();
  // Setting up a new chat with default title and no message history 
  chats[id] = {
    title: "New chat", 
    messages: [] 
  };
  // Persisting chats to storage 
  saveChats();
  // Returning ID so user can navigate to the new chat
  res.json({ id });
});

// Update a chat's title
app.patch("/api/chats/:id", (req, res) => {
  const chat = chats[req.params.id];
  if (!chat) return res.status(404).json({ error: "not found" });
  // Gets new title from request body
  const { title } = req.body;

  // Updates the chat title
  chat.title = title;

  // Saves changes to storage
  saveChats();
  res.json({ ok: true, title });
});

// Fetch a specific chat’s history
app.get("/api/chats/:id", (req, res) => {
  // Looking up the requested chat by ID from data store
  const chat = chats[req.params.id];

  // If chat doesn't exist then return a 404 error
  if (!chat) return res.status(404).json({ error: "not found" });

  // Returning the chat ID and its full message history
  res.json({ id: req.params.id, messages: chat.messages });
});

//  Append a message to a chat
app.post("/api/chats/:id/messages", (req, res) => {
  // Finds the chat by ID
  const chat = chats[req.params.id];

  // Returns error if chat doesn't exist
  if (!chat) return res.status(404).json({ error: "not found" });

  // Getting message details from request body
  const { sender, text } = req.body;

  // Adding new message with current timestamp
  chat.messages.push({ sender, text, timestamp: Date.now() });

  // Saving changes to storage
  saveChats();
  
  // Confirming successful operation
  res.json({ ok: true });
});

// 5) Delete a chat
app.delete("/api/chats/:id", (req, res) => {
  // Gets chat ID from the parameter
  const { id } = req.params;
  if (!chats[id]) {
    return res.status(404).json({ error: "not found" });
  }
  // Removes the chat from data storage
  delete chats[id];
  saveChats();
  res.json({ ok: true });
});

// Start server after pipeline is ready
const PORT = process.env.PORT || 8000;
initPipeline().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error("Failed to init pipeline:", err);
});

