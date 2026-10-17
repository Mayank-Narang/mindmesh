# MindMesh Frontend Release Checklist

This document is the release verification checklist for Person 2 before deploying or merging frontend releases into `main`.

---

## 1. Automated Verification Commands

Run the following commands locally before any release or PR submission:

- [ ] **Linter (Zero Warnings Required)**:
  ```bash
  cd frontend
  npm run lint
  ```
  *Expected Output: `oxlint` completes with 0 errors and 0 warnings.*

- [ ] **Frontend Component & Contract Tests**:
  ```bash
  cd frontend
  npm test
  ```
  *Expected Output: All 15 tests pass (ID normalization, PUT on existing note save, roles, search modes, SSE parser, 409 conflict).*

- [ ] **E2E Master Multi-User Suite**:
  ```bash
  node tests/e2e/run_all.js
  ```
  *Expected Output: Tier 4 collaboration flow passes 12/12 tests.*

- [ ] **Harness Self-Test**:
  ```bash
  node tests/e2e/run_all.js --self-test
  ```
  *Expected Output: 22/22 passed.*

- [ ] **Production Build**:
  ```bash
  cd frontend
  npm run build
  ```
  *Expected Output: Vite builds production bundle cleanly into `dist/`.*

---

## 2. Environment Variables Checklist

Ensure production environment variables are configured in the hosting environment (e.g. VITE environment settings in Vercel):

| Variable | Recommended Production Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.mindmesh.io/api` | Base URL pointing to the Express backend API |
| `VITE_USE_MOCK` | `false` | Must be `false` (or unset) to ensure real API connectivity |

---

## 3. API Contract & Data Normalization

- [ ] **Single Identifier Shape**: All note, brain, user, and citation entities expose `id: string`. No frontend UI components rely on or render MongoDB `_id`.
- [ ] **Existing Note Saves (`PUT`)**: Editing an existing note sends HTTP `PUT /api/notes/:id` with real note identifier, preventing duplicate note creation.
- [ ] **New Note Creation (`POST`)**: Creating a note without an `id` sends HTTP `POST /api/notes`.
- [ ] **Error Handling**:
  - `403 Forbidden`: Renders access denied state for unauthorized or read-only actions.
  - `409 Conflict`: Triggers the conflict resolution dialog ("Reload latest", "Restore server draft", "Copy local work").
  - `503 Service Unavailable`: Renders service unavailable banner with retry button.

---

## 4. Collaboration & Roles Verification

- [ ] **Owner Role**: Full read, edit, delete, and sharing permissions.
- [ ] **Collaborator Role**: Read and edit permissions via `PUT`. Delete and share controls are disabled/hidden.
- [ ] **Read-Only Role**: Read-only preview only. Title input, textarea, and save buttons are disabled with "Read Only" badge.
- [ ] **Active Locking**:
  - Displays lock banner when note is active.
  - Expiry countdown timer works.
  - "Renew Lock" and "Release Lock" buttons functional.
- [ ] **Shared with Me Page**: Loads shared brains and shared notes; clicking navigates directly to the real items with permission indicators.

---

## 5. Search Modes & AI Assistant

- [ ] **Search Mode Selector**: All 4 search modes are selectable:
  1. `semantic`: Vector similarity with percentage match score.
  2. `keyword`: Text matching with keyword frequency rank.
  3. `recency`: Chronological sort with relative edit timestamps.
  4. `hybrid`: Composite semantic & keyword ranking.
- [ ] **URL Filter Preservation**: Query `q`, `mode`, `brain`, `type`, `date` synchronize seamlessly in URL search parameters.
- [ ] **AI Q&A Brain Scope**: Dropdown allows filtering retrieval to "All Brains" or a specific brain.
- [ ] **SSE Streaming**: Smooth rendering of `sources`, `message` tokens, and `done` event.
- [ ] **Clickable Citations**: Citation cards labeled `[1]`, `[2]` link directly to the note editor.

---

## 6. Vercel Deployment Instructions

1. **Deploying via Vercel CLI**:
   ```bash
   cd frontend
   vercel --prod
   ```
2. **Deploying via Git Integration**:
   - Set Root Directory to `frontend`.
   - Build Command: `npm run build`.
   - Output Directory: `dist`.
   - Add Environment Variable: `VITE_API_BASE_URL` = `https://<your-backend-domain>/api`.
   - Ensure `vercel.json` rewrites handle client-side routing (`/(.*) -> /index.html`).
