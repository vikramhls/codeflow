# Implementation Plan: Repository Intelligence Assistant (RAG)

This plan outlines how we will build the highly token-efficient, AI-powered Repository Assistant you requested, acting like a ChatGPT for your codebase.

## Architectural Approach

We will build a **Retrieval-Augmented Generation (RAG)** pipeline. To ensure maximum token efficiency and compatibility with your Windows environment:

1. **Structured Knowledge in Redis:** We will use your existing Redis setup to store the high-level Knowledge Graph (Architecture Summary, Feature Maps, API routes) just like you requested.
2. **Vector Embeddings in ChromaDB:** Because standard local Redis on Windows often lacks the specialized `RediSearch` module required for mathematical vector search, we will introduce `chromadb`. ChromaDB is a lightweight, industry-standard vector database that runs seamlessly inside Python without needing a separate server. It will automatically generate fast, free, local embeddings for your code!
3. **Token-Smart LLM Generation:** When a user asks a question, we will retrieve the 3 most mathematically relevant code chunks from ChromaDB, combine them with the high-level architecture context from Redis, and send a tiny, highly-targeted prompt to OpenRouter to get the final answer.

## Proposed Changes

### 1. Backend: Dependencies & Setup
#### [MODIFY] `backend/requirements.txt`
- Add `chromadb` and `numpy`.

#### [NEW] `backend/app/services/rag_service.py`
- **Embedding Pipeline:** Functions to take a repository's files, split them into smaller chunks (e.g., 500 tokens each), and insert them into a persistent local ChromaDB collection.
- **Search Pipeline:** Function to take a user's natural language query, embed it, and retrieve the top-K most relevant code chunks from ChromaDB.

#### [NEW] `backend/app/services/knowledge_service.py`
- Logic to ask OpenRouter to generate the overarching "Feature Map" and "Architecture Summary" and cache them in Redis using keys like `repo:{repoId}:feature-map`.

### 2. Backend: API Routes
#### [NEW] `backend/app/routes/knowledge.py`
- `POST /repos/{repo_id}/index`: Kicks off the background job to build the embeddings and Redis caches.
- `POST /repos/{repo_id}/ask`: The core chat endpoint. It receives a query, runs the RAG search, and streams the AI's answer back.

#### [MODIFY] `backend/app/main.py`
- Register the new `knowledge` router.

### 3. Frontend: AI Chat UI
#### [NEW] `frontend/src/pages/RepoAskPage.tsx`
- A dedicated ChatGPT-like interface where users can type natural language questions. It will show the AI's response and explicitly list the file paths it used as references.
- Add an "Ask Codebase" navigation button to the Repository Detail page.

### 4. CLI Integration
#### [MODIFY] `cli/src/index.ts`
- Add a new command: `codeski ask <repo_id> "<question>"`
- It will hit the `/ask` endpoint and print the AI's response and file references directly in the terminal.

## Verification Plan
1. We will install the dependencies and restart the backend.
2. We will run an "Index" command on your repository to generate the embeddings.
3. We will use the Web UI or CLI to ask: *"Where are the React Router routes defined?"*
4. We will verify that it answers correctly while sending less than 1,000 tokens of context to the API!

## User Review Required
Does this hybrid architecture (Redis for structured metadata + ChromaDB for local vector embeddings) sound good to you? Once approved, I'll install the dependencies and start writing the backend pipelines!
