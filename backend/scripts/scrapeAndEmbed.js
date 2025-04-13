// scrapeAndEmbed.js (CommonJS)
const fs = require('fs');
const path = require('path');

const studiesList = require('../data/studiesList.json');
const outputPath = path.join(__dirname, '../data/studiesEmbeddings.json');

let featureExtractor;
const modelName = 'Xenova/all-MiniLM-L6-v2';

async function main() {
  console.log("Dynamically importing @xenova/transformers...");
  const xenova = await import('@xenova/transformers');
  const pipeline = xenova.pipeline;

  console.log("Initializing local embedding pipeline...");
  // Build the pipeline and store it in 'featureExtractor'
  featureExtractor = await pipeline('feature-extraction', modelName);

  // Test a quick call
  const debugOutTensor = await featureExtractor("Hello world", {
    max_length: 512,
    truncation: true,
  });
  console.log('Debug output dims for "Hello world":', debugOutTensor.dims);
  // Convert debugOutTensor to nested array manually:
  const debugArray = tensorToArray(debugOutTensor);
  console.log('Debug output (first token slice):', debugArray[0].slice(0,10));

  const results = [];
  for (const study of studiesList) {
    try {
      console.log(`\nProcessing [${study.id}] ${study.title}`);
      console.log(`URL: ${study.url}`);

      const rawText = study.text;
      if (!rawText || !rawText.trim()) {
        console.warn(`No text found for ${study.url}. Skipping...`);
        continue;
      }

      // Chunk the text
      const chunks = chunkText(rawText, 1000);
      console.log(`Created ${chunks.length} chunk(s)`);

      const chunkObjs = [];
      let chunkIndex = 0;
      for (const chunk of chunks) {
        console.log(`  - Embedding chunkIndex=${chunkIndex}, length=${chunk.length}`);
        console.log(`    text snippet: "${chunk.slice(0,80)}..."`);

        const embedding = await createEmbedding(chunk);
        console.log(`    embedding slice(0..10): ${embedding.slice(0,10)}`);

        chunkObjs.push({
          chunkIndex,
          text: chunk,
          embedding,
        });
        chunkIndex++;
      }

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

  console.log("\n=== About to write the final results ===");
  console.log("Writing to:", outputPath);
  console.log("First study sample:\n", JSON.stringify(results[0]?.chunks?.slice(0,1), null, 2));

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nAll done! Embeddings saved to: ${outputPath}`);
}

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

// Helper function to convert a tensor to a nested JS array using its dims and data.
function tensorToArray(tensor) {
  // Assume tensor.dims is [batch, seqLen, hiddenSize] and batch is 1.
  const dims = tensor.dims;
  if (!dims || dims.length !== 3) {
    throw new Error("Unexpected tensor dimensions");
  }
  const [batch, seqLen, hiddenSize] = dims;
  const flat = tensor.data; // This is a Float32Array
  const nested = [];
  for (let i = 0; i < seqLen; i++) {
    const start = i * hiddenSize;
    const end = start + hiddenSize;
    nested.push(Array.from(flat.slice(start, end)));
  }
  return nested;
}

async function createEmbedding(text) {
  console.log(`Embedding text of length: ${text.length}`);
  const tokenEmbeddingsTensor = await featureExtractor(text, {
    max_length: 512,
    truncation: true
  });
  console.log('Raw pipeline output dims:', tokenEmbeddingsTensor.dims);

  // Convert the tensor to a nested array manually.
  const embeddings2D = tensorToArray(tokenEmbeddingsTensor); // shape: [seqLen, hiddenSize]
  const seqLen = embeddings2D.length;
  const embeddingSize = embeddings2D[0].length;

  let avgEmbedding = new Array(embeddingSize).fill(0);
  for (const tokenVec of embeddings2D) {
    for (let i = 0; i < embeddingSize; i++) {
      avgEmbedding[i] += tokenVec[i];
    }
  }
  for (let i = 0; i < embeddingSize; i++) {
    avgEmbedding[i] /= seqLen;
  }
  return Array.from(avgEmbedding);
}

main().catch(err => {
  console.error("Error in main():", err);
});
