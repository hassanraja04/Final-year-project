# Steps to run the code in your machine

## Prerequisites

- **llama.cpp**

Install and build [llama.cpp](https://github.com/ggerganov/llama.cpp) on your machine.
This is required to run the local Vicuna model

- **Vicuna model**

Download [vicuna-7b-v1.5.Q5_K_M.gguf](https://huggingface.co/TheBloke/vicuna-7B-v1.5-GGUF/blob/main/vicuna-7b-v1.5.Q5_K_M.gguf) from the Hugging Face release page and place it in a `models/` directory at the project root.

- **Node.js & npm**

Ensure you have Node.js v16+ and npm installed.

---

## Getting Started

### 1. Clone the repo 
```bash
git clone https://github.com/hassanraja04/Final-year-project.git
```

```bash
cd fyp
```

### 2. Install Backend dependencies
```bash
cd backend
```

```bash
npm install @xenova/transformers@^2.17.2 cheerio@^1.0.0 cors@^2.8.5 dotenv@^16.4.7 express@^4.21.2 mongoose@^8.9.6 node-llama-cpp@^3.7.0 nodemon@^3.1.9 pdf-parse@^1.1.1 uuid@^11.1.0
```

### 3. Generate Study embeddings
```bash
node scripts/scrapeAndEmbed.js
```

### 4. Start the backend server
```bash
npm start 
```

The backend will now be running on http://localhost:8000

---

### 2. Install Frontend dependencies
```bash
cd ../frontend
```

```bash
npm install @fortawesome/fontawesome-svg-core@^6.7.2 @fortawesome/free-solid-svg-icons@^6.7.2 @fortawesome/react-fontawesome@^0.2.2 cra-template@1.2.0 react@^19.0.0 react-dom@^19.0.0 react-scripts@5.0.1
```

### 3. Start the frontend server
```bash
npm start
```

The frontend will now be running on http://localhost:3000

---