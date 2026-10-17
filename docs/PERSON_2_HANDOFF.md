# MindMesh Person 2 Handoff

You own the frontend integration, collaboration experience, automated UI tests, and frontend deployment. Work on a separate branch named `codex/frontend-qa-completion`. Do not edit backend models, routes, services, cron jobs, or deployment code; Person 1 owns those files.

## Current project context

MindMesh is a React/Vite frontend and Express/MongoDB backend for text, Markdown, and URL notes; semantic retrieval; sharing; and streamed RAG answers. The frontend currently has real-API and mock adapters. Person 1 is actively repairing backend authorization and data contracts before building locks, retrieval modes, chunking, and background processing.

This file is the source of truth for any new chat working as Person 2. Start by reading it, inspect the current `git status`, then read the API contract/Person 1 changes before editing frontend files.

## First action

Rebase onto the branch that contains Person 1's API-contract commit before replacing any mock behavior. Use the real API for release builds. Keep `apiMock.js` only for explicit demo or isolated UI-test mode.

## API contract

Treat `id` as the only identifier exposed to UI code. Do not rely on MongoDB `_id`. Every entity returned by the API must use this shape:

```js
{
  id: string,
  // entity fields
}
```

For errors, render `error` when present. Permission failures return 403, lock/version conflicts return 409, and unavailable embedding/AI services return 503.

Roles are:

| Role | Read | Edit | Delete | Share |
|---|---:|---:|---:|---:|
| owner | yes | yes | yes | yes |
| collaborator | yes | yes | no | no |
| read | yes | no | no | no |

Person 1 will provide lock endpoints and will expose the lock holder, expiry, current version, and recoverable draft on note responses. Do not invent a second locking mechanism in the browser.

### Editing-lock API delivered by Person 1

These endpoints are now available for frontend integration. Do not start lock UI until Person 1 confirms the backend milestone is ready for merge.

- `POST /api/notes/:id/lock` acquires the caller's five-minute lock and returns `{ locked, holder, expiresAt, version, draft? }`.
- `POST /api/notes/:id/lock/renew` renews the caller's active lock and returns `{ locked, expiresAt, version }`.
- `PUT /api/notes/:id/draft` accepts `{ content, expectedVersion? }`, soft-saves a recoverable draft, and renews the caller's lock.
- `DELETE /api/notes/:id/lock` releases the caller's lock; an owner may release another user's lock.
- `PUT /api/notes/:id` accepts `{ expectedVersion?, releaseLock? }`. Supply the loaded `version`; set `releaseLock: true` only after a successful hard save.

Lock-related success responses include `locked`, `holder`, `expiresAt`, and `version`. A lock or version conflict returns HTTP 409 with `{ error, code, version, lock, serverNote, draft }`. `serverNote` is the latest saved note, including `id`, `title`, `content`, `version`, and `updatedAt`; `draft` is the recoverable draft-content string or `null`. Important codes are `NOTE_LOCKED`, `LOCK_REQUIRED`, `LOCK_OWNERSHIP_REQUIRED`, and `VERSION_CONFLICT`.

Search modes supplied by the API will be `semantic`, `keyword`, `recency`, and `hybrid`. Preserve active filters for brain, type, tags, date range, and mode in browser state/URL where practical.

### Search and Chunked Retrieval API delivered by Person 1

`POST /api/notes/search` accepts `{ query?, mode, brain?, type?, author?, tags?, limit? }`.
- Valid modes: `semantic`, `keyword`, `recency`, and `hybrid`.
- `query`: required for `semantic`, `keyword`, and `hybrid` modes; optional for `recency` mode.
- `limit`: integer between 1 and 50 (default: 10).
- Response shape: `{ query, mode, results }`.

#### Chunking and Parent-Note Aggregation

Long notes are automatically segmented into overlapping semantic chunks (target ~800 characters with ~150-character overlap) upon creation and update.
- Semantic vector search searches over individual chunks, ranks matching parent notes by their best-matching chunk similarity score, and returns that specific best-matching chunk text in `snippet`.
- When multiple chunks of the same note match, the note is returned once (deduplicated by parent note), scored by the highest-matching chunk score.
- For `keyword` and `recency` modes, `snippet` displays the contextual keyword match or content preview.
- For `hybrid` mode (Reciprocal Rank Fusion across semantic, keyword, and recency), the best chunk snippet is preserved, and scores represent fused rankings rather than percentages.

#### Result Object Contract

Each item in `results` has the following shape:

```json
{
  "id": "67b0ef1234567890abcdef12",
  "title": "Authentication Architecture in Node.js",
  "type": "text",
  "content": "Full text of the note...",
  "url": null,
  "urlMeta": null,
  "tags": ["auth", "security", "jwt"],
  "brain": "67b0ee9876543210fedcba98",
  "author": "67b0ee111122223333444455",
  "score": 0.942,
  "retrievalMode": "semantic",
  "snippet": "JWT tokens are signed with HMAC SHA-256 and verified using middleware before granting route access...",
  "chunkIndex": 1,
  "createdAt": "2026-10-15T12:00:00.000Z",
  "updatedAt": "2026-10-17T18:30:00.000Z"
}
```

Fields specific to retrieval:
- `id`: parent note ID (always normalized `id`, never `_id`).
- `score`: vector similarity score (for `semantic`), text match score (for `keyword`), recency weight (for `recency`), or Reciprocal Rank Fusion rank (for `hybrid`).
- `retrievalMode`: `"semantic"` | `"keyword"` | `"recency"` | `"hybrid"`.
- `snippet`: string content of the highest-scoring chunk matching the query.
- `chunkIndex`: integer (0-indexed) indicating which chunk produced the match (present on chunked semantic matches).

> **Action required from Person 2**: Please review the above search result shape (especially `snippet` and `chunkIndex`) and confirm that it meets the frontend UI/card requirements before starting frontend search integration or merging.

## Your required implementation

1. Real API integration
   - Normalize all data use to `id`.
   - Fix edit-save behavior so an existing note sends its real identifier and updates instead of creating a duplicate.
   - Replace mock-only fields and error assumptions.
   - Add loading, retry, empty, 403, 409, and 503 states.

2. Notes and brains
   - Support text, Markdown, and URL notes through the real API.
   - Keep safe live Markdown preview.
   - Show URL metadata fetch/refresh failures clearly.
   - Build brain create, edit, delete, selection, and notes-in-brain flows.

3. Search and AI
   - Add semantic, keyword, recency, and hybrid mode selector.
   - Add brain/type/tag/date filters and matching snippets.
   - Display source brain, sharing state, score/rank, and result type.
   - Add brain selection to AI Q&A.
   - Safely render SSE `sources`, `message`, `done`, and `error` events; show clickable sources and citation labels.

4. Collaboration
   - Add both note-level and brain-level share management.
   - Clearly show owner/collaborator/read-only access.
   - Disable writes for read-only users.
   - Show active editor, lock expiry, renewal, and release controls.
   - On 409, offer reload latest, restore server draft, and copy local work for manual merge.
   - Make Shared with Me load and navigate to actual shared notes/brains.

5. Tests and release
   - Resolve lint warnings.
   - Add component tests for CRUD, roles, locks, search modes, and streamed AI events.
   - Add E2E coverage for the full two-user flow documented in `README.md` or the test plan supplied by Person 1.
   - Add Vercel configuration, production API URL configuration, and a frontend release checklist.

## Acceptance requirements before requesting merge

- `npm run lint` completes without warnings.
- Existing-note saves issue `PUT`, not `POST`.
- Read-only users have no functional edit/delete/share controls.
- All four search modes are selectable and results display mode-specific information.
- AI source cards open the correct real note.
- E2E tests exercise two users, sharing, collaborator edits, lock conflicts, search, and SSE answers.

## Merge discipline

- Keep commits small and feature-scoped.
- Do not reformat backend files.
- Rebase onto Person 1's latest branch before opening a pull request.
- Include test output and any environment variables needed for verification in the pull-request description.

## Stop here and ask Person 1 before committing or merging

Do not make assumptions across the backend/frontend boundary. Pause and ask Person 1 for a decision when any of the following occurs:

- The API response differs from this handoff, especially IDs, error codes, permission data, lock/version fields, search results, or SSE event payloads.
- The frontend needs a new endpoint, a new request field, a data-model change, a changed authorization rule, or a database migration.
- A backend authorization check prevents an intended UI flow.
- A backend failure, failing integration test, or missing environment variable blocks real-API verification.
- You must edit anything under `backend/`, change an Atlas index, alter cron behavior, alter CORS/JWT settings, or add a backend package.
- A merge would conflict with Person 1's files or requires a change to the shared contract.

Before committing a frontend-only feature, stop and request Person 1's review when the feature depends on a newly delivered backend capability. Include: commit summary, changed files, exact API assumptions, test output, and any unresolved issue. Person 1 will confirm whether the contract is ready to merge.

## Handoff back to Person 1

Stop after completing a coherent frontend milestone rather than continuing into backend work. The preferred checkpoints are:

1. Real API adapter and `id` normalization.
2. Notes/brains/URL capture UI.
3. Search and AI UI after Person 1 delivers search modes and SSE contract.
4. Sharing and lock UI after Person 1 delivers permissions/locks.
5. E2E and deployment verification.

At each checkpoint, send Person 1: branch/commit, changed files, commands run with results, APIs exercised, and a concise list of required backend follow-ups. Do not claim the application is complete until Person 1 confirms the backend integration and authorization tests pass.
