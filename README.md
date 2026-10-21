<div align="center">

# 🧠 MindMesh

**Collaborative Semantic Knowledge Management & AI Research Platform**

*Unifying personal notes, technical documentation, and web resources into an intelligent, vector-indexed, RAG-grounded knowledge mesh.*

[🚀 Live Application](https://mindmesh-frontend-eta.vercel.app/) • [📡 Live API](https://mindmesh-be5u.onrender.com/) • [📖 API Health](https://mindmesh-be5u.onrender.com/api/health)

---

[![React](https://img.shields.io/badge/Frontend-React_19_+_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_+_Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas_Vector_Search-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini_(768d)-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![Tests](https://img.shields.io/badge/Tests-100%25_Passing_(62/62)-brightgreen)](file:///c:/Users/Hp/Downloads/Minor%20Project/mindmesh/backend/tests)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

</div>

---

## 📌 Overview

**MindMesh** bridges personal knowledge management and AI-assisted research. It organizes multi-format notes into focused workspaces called **Brains**, indexes knowledge chunks using high-dimensional vector embeddings, and enables conversational discovery grounded strictly in your notes with real-time SSE streaming and clickable citations.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| **📝 Multi-Format Notes** | Rich text, Markdown with live preview, and URL bookmarks with automated OpenGraph metadata enrichment via SSRF-safe scraping. |
| **🧩 Semantic Chunking** | Sliding-window text chunker (~800 chars, 150 overlap) with boundary awareness for markdown headers, paragraphs, and lists. |
| **🔍 4 Retrieval Modes** | **Semantic** (768-dim embeddings with Atlas Vector Search), **Keyword** (lexical BM25 text score), **Recency** (chronological), and **Hybrid** (Reciprocal Rank Fusion). |
| **🤖 Grounded RAG & SSE** | Real-time Server-Sent Events streaming via Gemini with bracketed citations (`[1]`, `[2]`) that highlight and smooth-scroll to cited source cards. |
| **🔒 Conflict-Safe Editing** | 5-minute renewable lease locks, background draft autosave, optimistic concurrency checks (`expectedVersion`), and a 409 conflict dialog (*Reload Latest*, *Restore Draft*, *Copy Work*). |
| **🧠 Brain Memory State** | Scheduled background worker compiles structured memory metadata (`summary`, `topics`, `tags`, `counts`) displayed on Brain cards. |
| **🛡️ Production Hardened** | Startup environment validation, in-memory LRU embedding cache, exponential backoff retries, configurable CORS, and comprehensive health monitoring. |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MindMesh Frontend                      │
│             React 19 • Vite • TailwindCSS • Vercel          │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTP / JSON API              │ Server-Sent Events (SSE)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MindMesh Backend                       │
│           Express API • JWT Auth • RBAC • Render            │
└──────┬──────────────────────┬──────────────────────┬────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌────────────────┐
│MongoDB Atlas │      │Google Gemini │      │Background Jobs │
│Vector Search │      │768-dim Embed │      │ Lock Expiry &  │
│(Note & Chunk)│      │ & Generation │      │ Brain Memory   │
└──────────────┘      └──────────────┘      └────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone & Configure
```bash
git clone https://github.com/Mayank-Narang/mindmesh.git
cd mindmesh
```

Create `backend/.env` (see [`backend/.env.example`](backend/.env.example)):
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mindmesh
JWT_SECRET=your-32-char-random-secret-key-here
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGIN=http://localhost:5173
```

### 2. Run Locally

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` • API runs at `http://localhost:5000`

---

## 🧪 Test Suite (62 / 62 Passing)

```bash
# Backend unit, integration & production tests (32 tests)
cd backend && npm test

# Frontend component & adapter tests (18 tests)
cd frontend && npm test

# Frontend linter (0 errors, 0 warnings)
cd frontend && npm run lint

# End-to-end collaboration flow tests (12 tests)
node tests/e2e/run_all.js
```

---

## 📡 API Reference

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `/api/health` | `GET` | System health, MongoDB status, uptime | No |
| `/api/auth/register` | `POST` | Register new user account | No |
| `/api/auth/login` | `POST` | Authenticate and obtain JWT | No |
| `/api/brains` | `GET`, `POST` | List or create knowledge Brains | Yes |
| `/api/brains/:id` | `GET`, `PUT`, `DELETE` | Read, update, or delete a Brain | Yes |
| `/api/notes` | `POST` | Create note and generate vector chunks | Yes |
| `/api/notes/:id` | `GET`, `PUT`, `DELETE` | Read, version-check update, or delete note | Yes |
| `/api/notes/:id/lock` | `POST`, `DELETE` | Acquire, renew, or release 5-min editing lock | Yes |
| `/api/notes/:id/draft` | `PUT` | Soft-save in-progress draft content | Yes |
| `/api/notes/search` | `POST` | Multi-mode search (`semantic`, `keyword`, `recency`, `hybrid`) | Yes |
| `/api/ai/ask` | `POST` | Streamed RAG response with bracket citations via SSE | Yes |

---

## 👥 Team

Developed by the **MindMesh Team**:
* **Devansh Sharma**
* **Shrey Garg**
* **Mayank Prince Narang**

---

## 📄 License

This project is licensed under the ISC License.
