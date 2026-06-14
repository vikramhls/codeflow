# CodeFlow 🚀

A collaborative, gamified codebase intelligence and bug bounty platform.

CodeFlow allows you to import repositories and instantly get AI-powered insights, 3D codebase maps, and automated DevOps architectures. It also serves as a platform to post issues with bounties, and rewards developers for submitting verified solutions. With integrated AI code review, repository intelligence, and a unique issue bidding system, CodeFlow makes open-source collaboration fun, rewarding, and incredibly efficient.

## 📸 Screenshots

![Screenshot 1](screenshot/Screenshot%202026-06-13%20052356.png)

![Screenshot 2](screenshot/Screenshot%202026-06-13%20052419.png)

![Screenshot 3](screenshot/Screenshot%202026-06-13%20052441.png)

![Screenshot 4](screenshot/Screenshot%202026-06-13%20052457.png)

## ✨ Key Features

1. **🧠 Repository Intelligence Assistant (RAG)**
   Import any repository and instantly ask natural language questions about the codebase! The AI uses local ChromaDB vector embeddings to instantly fetch the right code snippets and answer complex architectural questions.

2. **🌌 3D Codebase Mapping**
   Visualize your entire repository structure as an interactive, beautiful 3D network graph. See how files and folders connect across your project.

3. **🏗️ AI DevOps Expert**
   Automatically generate System Architecture Blueprints for any codebase. The DevOps AI analyzes your stack and draws beautiful server/load-balancer diagrams automatically.

4. **🎤 Mock Technical Interviews ("Grill Me")**
   Get grilled by a tough Senior AI Engineer on your own architectural choices! The AI analyzes your codebase and asks hard questions about Big O complexity, technical debt, and scalability. (Includes a "Show Answer" button to learn!)

5. **🤖 Automated AI Code Review**
   As soon as a developer submits a code patch, an integrated AI immediately analyzes the code and posts a beautifully styled code review comment.

6. **💰 Issue Bidding System & Crowdfunding**
   Solvers can name their price for fixing bugs! Additionally, anyone can click the **Boost Bounty** button on an open issue to pledge their own reputation points into the issue's bounty pool.

7. **🔥 Streaks & Verified Portfolios**
   Maintain daily streaks to earn bonus reputation. Every user has a public profile page displaying their active streak and a verified portfolio of every bug they've successfully solved. 


## 📁 Project Structure

This is a monorepo setup containing:
- `backend/` - The FastAPI backend (MongoDB, Redis, ChromaDB, JWT auth).
- `frontend/` - The Vite + React + TypeScript frontend.
- `cli/` - The CodeBounty command-line tool.

## 🚀 Getting Started

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure your environment variables in `backend/.env`. Add your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=your-api-key-here
   REDIS_URL=redis://localhost:6379
   MONGODB_URL=mongodb://localhost:27017
   ```
4. Start the API server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

Go to **http://localhost:5173** to view the app!

## 🧪 Technologies Used

- **Frontend:** React, Vite, TypeScript, Lucide Icons, React Force Graph 3D
- **Backend:** FastAPI, Python, Beanie (MongoDB ODM)
- **AI & Vector DB:** OpenRouter (LLMs), ChromaDB
- **Database:** MongoDB
- **Caching & Tasks:** Redis, BackgroundTasks
