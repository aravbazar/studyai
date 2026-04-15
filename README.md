# StudyAI 🎓

An AI-powered study buddy for college students. Upload your notes, syllabi, or any study material — then chat with it, generate flashcards, and quiz yourself using a full RAG (Retrieval-Augmented Generation) pipeline.

## Tech Stack

**Backend**
- Node.js + Express
- PostgreSQL + pgvector (vector similarity search)
- Groq API (free LLM — `llama-3.1-8b-instant`)
- Local embeddings via `@xenova/transformers` (no API cost)
- PDF parsing, URL scraping, text ingestion

**Frontend**
- React + TypeScript
- Vite
- React Router

## Architecture

```
User uploads document (PDF / text / URL)
        ↓
Text extracted → chunked into ~500 word segments
        ↓
Each chunk embedded via local MiniLM model (free, runs on-device)
        ↓
Embeddings stored in pgvector (PostgreSQL)
        ↓
User asks question → query embedded → cosine similarity search
        ↓
Top-5 most relevant chunks passed as context to Groq LLM
        ↓
Answer returned with source attribution
```

## Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension (Supabase recommended — free, pgvector enabled by default)
- Groq API key (free at https://console.groq.com)

## Quick Setup

### 1. Database (Supabase — recommended, free)
1. Create a project at https://supabase.com
2. pgvector is enabled by default
3. Copy your connection string from Settings → Database

### 2. Groq API Key (free)
1. Sign up at https://console.groq.com
2. Create an API key
3. Uses `llama-3.1-8b-instant` model (very fast, free tier)

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your GROQ_API_KEY and DATABASE_URL
npm run dev
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### One-command start (after setup)

```bash
./start.sh
```

## Environment Variables

**Backend (.env)**
```
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql://...
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Features

- **Chat** — Ask questions about your document. RAG retrieves relevant chunks and answers with context.
- **Flashcards** — AI-generated flashcards (ephemeral, regenerate anytime). Star/favorite individual cards to save them locally.
- **Quiz** — Multiple-choice questions with explanations. Quiz history tracked locally.
- **Library** — View all quiz history and saved flashcards organized by document.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/documents | List all documents |
| POST | /api/documents/upload/pdf | Upload PDF |
| POST | /api/documents/upload/text | Upload text |
| POST | /api/documents/upload/url | Scrape URL |
| DELETE | /api/documents/:id | Delete document |
| GET | /api/chat/:docId/session | Get chat session |
| POST | /api/chat/:docId/message | Send message (RAG) |
| POST | /api/flashcards/:docId/generate | Generate flashcards (ephemeral) |
| POST | /api/quiz/:docId/generate | Generate quiz |
| POST | /api/quiz/:docId/:qId/answer | Submit answer |

## Deployment

**Backend → Railway**
```bash
# Push to GitHub, connect repo on Railway
# Set environment variables in Railway dashboard
```

**Frontend → Vercel**
```bash
npm i -g vercel
cd frontend
vercel
# Set VITE_API_URL to your Railway backend URL
```

## Resume Bullets

```
StudyAI | Node.js, PostgreSQL, pgvector, Groq API, React, TypeScript | GitHub
• Built a full-stack AI study assistant implementing a RAG pipeline with semantic chunking,
  local vector embeddings (@xenova/transformers MiniLM-L6), and cosine similarity search via pgvector
• Engineered document ingestion supporting PDF parsing, raw text, and URL scraping with
  cheerio, chunking content into overlapping segments for optimal context retrieval
• Designed RESTful API with chat history management, ephemeral flashcard generation,
  and multiple-choice quiz generation using Groq LLM with structured JSON prompting
• Reduced hallucination risk by injecting only top-5 semantically relevant chunks as
  context per query, maintaining conversation history across sessions in PostgreSQL
```
