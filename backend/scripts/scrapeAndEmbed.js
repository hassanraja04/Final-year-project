// scrapeAndEmbed.js (CommonJS)
const fs = require('fs');
const path = require('path');

// Importing list of studies 
const studiesList = require('../data/studiesList.json');
// Defining output path 
const outputPath = path.join(__dirname, '../data/studiesEmbeddings.json');

// Variable to hold embedding model 
let featureExtractor;
const modelName = 'Xenova/all-MiniLM-L6-v2';

// Processes all the studies and creates embeddings
async function main() {
  console.log("Dynamically importing @xenova/transformers...");
  const xenova = await import('@xenova/transformers');
  const pipeline = xenova.pipeline;

  console.log("Initializing local embedding pipeline...");
  // Initialising feature extraction pipeline
  featureExtractor = await pipeline('feature-extraction', modelName);

  // Running a test embedding to verify functionality 
  const debugOutTensor = await featureExtractor("Hello world", {
    max_length: 512,
    truncation: true,
  });
  console.log('Debug output dims for "Hello world":', debugOutTensor.dims);
  // Converting debugOutTensor to nested array manually:
  const debugArray = tensorToArray(debugOutTensor);
  console.log('Debug output (first token slice):', debugArray[0].slice(0,10));

  // Storing processed studies with their embeddings
  const results = [];
  for (const study of studiesList) {
    try {
      console.log(`\nProcessing [${study.id}] ${study.title}`);
      console.log(`URL: ${study.url}`);

      const rawText = study.text;
      // Skipping studies with no text
      if (!rawText || !rawText.trim()) {
        console.warn(`No text found for ${study.url}. Skipping...`);
        continue;
      }

      // Splitting text into chunks of 1000 characters 
      const chunks = chunkText(rawText, 1000);
      console.log(`Created ${chunks.length} chunk(s)`);

      const chunkObjs = [];
      let chunkIndex = 0;
      for (const chunk of chunks) {
        console.log(`- Embedding chunkIndex=${chunkIndex}, length=${chunk.length}`);
        console.log(`text snippet: "${chunk.slice(0,80)}..."`);

        // Generating embedding for this chunk
        const embedding = await createEmbedding(chunk);
        console.log(`embedding slice(0..10): ${embedding.slice(0,10)}`);

         // Storing chunk with its metadata and embedding
        chunkObjs.push({
          chunkIndex,
          text: chunk,
          embedding,
        });
        chunkIndex++;
      }

      // Adding complete study with all its chunks to results
      results.push({
        id: study.id,
        title: study.title,
        url: study.url,
        chunks: chunkObjs,
      });

    } catch (error) {
      console.error(`Failed to process [${study.id}] ${study.url}:`, error);
    }
  }

  // Log sample before writing to file
  console.log("\n=== About to write the final results ===");
  console.log("Writing to:", outputPath);
  console.log("First study sample:\n", JSON.stringify(results[0]?.chunks?.slice(0,1), null, 2));

  // writing all embeddings to JSON file
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nAll done! Embeddings saved to: ${outputPath}`);
}

// helper function to split text into chunks 
function chunkText(fullText, chunkSize) {
  const chunks = [];
  let startIndex = 0;
  while (startIndex < fullText.length) {
    const endIndex = Math.min(startIndex + chunkSize, fullText.length);
    chunks.push(fullText.slice(startIndex, endIndex));
    startIndex = endIndex;
  }
  return chunks;
}

// Helper function to convert a tensor output to regular Javascript array
function tensorToArray(tensor) {
  // Verifying its dimensions
  const dims = tensor.dims;
  if (!dims || dims.length !== 3) {
    throw new Error("Unexpected tensor dimensions");
  }
  const [batch, seqLen, hiddenSize] = dims;
  const flat = tensor.data; // This is a raw Float32Array from tensor

  // Restructuring the array into a nested array by sequence length
  const nested = [];
  for (let i = 0; i < seqLen; i++) {
    const start = i * hiddenSize;
    const end = start + hiddenSize;
    nested.push(Array.from(flat.slice(start, end)));
  }
  return nested;
}

// Creating a single embedding vector for a text chunk
async function createEmbedding(text) {
  console.log(`Embedding text of length: ${text.length}`);
  // Generating token embeddings from the model
  const tokenEmbeddingsTensor = await featureExtractor(text, {
    max_length: 512, // Limit input length
    truncation: true // Truncate if text is too long
  });
  console.log('Raw pipeline output dims:', tokenEmbeddingsTensor.dims);

  // Convert the tensor to array format
  const embeddings2D = tensorToArray(tokenEmbeddingsTensor); // shape: [seqLen, hiddenSize]
  const seqLen = embeddings2D.length;
  const embeddingSize = embeddings2D[0].length;

  // Calculating the mean embedding across all tokens
  let avgEmbedding = new Array(embeddingSize).fill(0);
  for (const tokenVec of embeddings2D) {
    for (let i = 0; i < embeddingSize; i++) {
      avgEmbedding[i] += tokenVec[i];
    }
  }
  // Dividing by sequence length to get average+
  for (let i = 0; i < embeddingSize; i++) {
    avgEmbedding[i] /= seqLen;
  }
  return Array.from(avgEmbedding);
}

main().catch(err => {
  console.error("Error in main():", err);
});
