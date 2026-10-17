# MindMesh Person 1 Worklog and Continuation Guide

You are Person 1. You own backend data models, authorization, API contracts, search/retrieval, RAG backend behavior, background jobs, backend tests, and backend deployment. Person 2 owns frontend pages/components/services, frontend tests, E2E flows, and frontend deployment configuration.

This document is intentionally written so a new chat can continue the work. Read it first, then inspect `git status` and the current diff before changing files.

## Project goal

Complete MindMesh according to the project synopsis, proposal, and IEEE paper: unified text/Markdown/URL notes; semantic, keyword, recency, and hybrid search; URL metadata enrichment; permissioned live sharing; conflict-safe collaborative editing; streaming note-grounded RAG; brain summaries; orphan cleanup; idle-lock expiry; evaluation; tests; and deployment.

## Current status

### Completed in this backend foundation milestone

- Added `backend/src/services/access.js` with shared owner/collaborator/read access helpers.
- Added JSON transforms to `Note` and `Brain` so API objects expose `id` and hide internal `_id`/`__v`; note JSON also hides embeddings.
- Repaired `backend/src/routes/notes.js` direct-note authorization:
  - `GET /api/notes/:id` now requires readable access.
  - `PUT /api/notes/:id` now requires editable access.
  - `DELETE /api/notes/:id` is owner only.
  - create/move operations require editable access to the target brain.
  - clients can no longer assign/change `author`.
- Updated brain access checks to use the shared helper.
- Added `backend/tests/access.test.js`; it passes with `node --test tests\\access.test.js`.
- Created `docs/PERSON_2_HANDOFF.md` for the frontend owner.

### Collaboration API implemented locally, pending Person 2 contract review

- Added note fields: `lockedBy`, `lockedAt`, `lockExpiresAt`, `draftContent`, `draftUpdatedAt`, and `version`.
- Added `POST /api/notes/:id/lock`, `PUT /api/notes/:id/draft`, and `DELETE /api/notes/:id/lock`.
- Enhanced `PUT /api/notes/:id` with optional `expectedVersion` optimistic concurrency and `releaseLock` hard-save completion.
- Added a one-minute cron task that clears expired locks while retaining drafts for recovery.
- Person 2 confirmed the frontend contract. The backend now returns named lock-holder data, supports `POST /api/notes/:id/lock/renew`, and returns `serverNote` plus draft content for HTTP 409 recovery. Lock UI integration is approved.

### Pre-existing repository state to preserve

The following untracked evaluation artifacts existed before this work. Do not delete, reset, or overwrite them unless the user explicitly asks:

- `backend/eval_results.json`
- `backend/run_eval.js`
- `backend/run_eval_fixed.js`
- `scripts/run_eval.js`

## File ownership

Person 1 owns:

- `backend/src/models/`
- `backend/src/routes/`
- `backend/src/services/`
- `backend/src/jobs/`
- `backend/src/middleware/`
- `backend/tests/`
- backend environment/deployment/migration/index documentation

Person 2 owns:

- `frontend/src/`
- frontend configuration and tests
- `tests/e2e/`, except when an E2E test requires a shared backend fixture or contract change

Do not edit Person 2-owned files without asking first. Read `docs/PERSON_2_HANDOFF.md` before altering a shared contract.

## API rules already promised to Person 2

- Use `id`, not `_id`, in JSON responses.
- Errors use `{ error, code? }`; 403 is permission denied, 409 is edit/lock conflict, 503 is unavailable embedding/AI service.
- Roles: owner can read/edit/delete/share; collaborator can read/edit; read can only read.
- Future lock responses must expose lock holder, expiry, version, and recoverable draft.
- Search modes will be `semantic`, `keyword`, `recency`, and `hybrid`.
- SSE events remain `sources`, `message`, `done`, and `error`.

Changing any of these requires Person 2's explicit agreement before committing.

## Next backend milestones, in order

### 1. Finish authorization coverage

- Apply the shared access helper to duplicate sharing code or consolidate note-sharing routes.
- Ensure brain listing/detail only returns accessible notes and does not leak a note that has been independently restricted.
- Add route-level integration tests for owner, collaborator, read-only user, and unrelated user.
- Verify a direct object ID cannot bypass access checks.

### 2. Implement conflict-safe collaboration

- Add note fields: `lockedBy`, `lockedAt`, `draftContent`, `version`.
- Add acquire/renew/release-lock endpoints.
- Add soft-save and hard-save endpoints.
- Return 409 for active-lock and stale-version conflicts.
- Add cron expiry and preserve the last recoverable draft.
- Publish final request/response shapes to Person 2 before they build lock UI.

### 3. Complete retrieval (Completed locally)

- Implemented `POST /api/notes/search` accepting `semantic`, `keyword`, `recency`, and `hybrid` modes; hybrid uses Reciprocal Rank Fusion.
- Created `NoteChunk` storage model (`backend/src/models/NoteChunk.js`) and Atlas index configuration (`backend/note-chunks-vector-index.json`).
- Built sliding-window chunking utility (`backend/src/services/chunking.js`) splitting long notes into overlapping chunks (~800 chars, 150 overlap) with boundary awareness (markdown headers, paragraphs, sentences).
- Integrated chunk lifecycle into note create (`POST /api/notes`), update (`PUT /api/notes/:id`), delete (`DELETE /api/notes/:id`), brain delete (`DELETE /api/brains/:id`), and orphaned cleanup cron (`cron.js`).
- Implemented chunked semantic retrieval with parent-note result aggregation, ranking parent notes by best chunk score and returning the matching chunk in `snippet` with `chunkIndex`.
- Added in-memory cosine fallback for seamless offline/local test execution.
- Preserved strict authorization: owner, note share, and brain share checks across all retrieval modes.
- Added migration/reindex script (`backend/src/scripts/reindexChunks.js`) and npm script `npm run reindex`.
- Added test suites (`backend/tests/chunking.test.js` and `backend/tests/retrieval.test.js`) verifying chunking, aggregation, snippets, and authorization (17/17 tests passing).
- Updated `docs/PERSON_2_HANDOFF.md` with chunk result fields (`snippet` and `chunkIndex`) and asked Person 2 to confirm before integration.

### 4. Complete RAG and background jobs (Completed locally)

- Upgraded `POST /api/ai/ask` with authorized chunked retrieval:
  - Enforces authorization for owner, direct note shares (`sharedWith.user` / `sharedWith.email`), and accessible brains.
  - Validates `brainId` readability with HTTP 403 for unauthorized brains.
  - Retrieves top matching chunks via `$vectorSearch` with parent-note aggregation and in-memory cosine fallback.
  - Emits SSE `sources` event with `{ id, title, snippet, score, chunkIndex }`.
  - Grounds prompts strictly in retrieved chunks and requires citations like `[1]`, `[2]`.
  - Streams Gemini response chunks via `message` events, finishing with `done`.
- Replaced count-only brain descriptions with compact generated JSON memory state:
  - Built `backend/src/services/brainMemory.js` and updated midnight cron in `backend/src/jobs/cron.js`.
  - Produces structured metadata `{ summary, noteCount, types, tags, topics, lastActivity }` in `brain.description` and `brain.memoryState`.
- Upgraded embedding service (`backend/src/services/vector.js`):
  - Added in-memory LRU cache to reduce latency and save API quota.
  - Added exponential backoff retry logic (up to 3 retries for 429 rate limits and 5xx transient errors).
- Hardened scraper service (`backend/src/services/scraper.js`):
  - Added SSRF protection blocking localhost, private subnets, cloud metadata (`169.254.169.254`), and non-HTTP schemes.
  - Configured safe timeouts (`SCRAPER_TIMEOUT_MS`).
- Added test suite `backend/tests/milestone4.test.js` (8 new tests; full backend suite passes 25/25).

### 5. Testing and production readiness

- Expand unit/integration tests; make `npm test` run the full backend suite.
- Add environment validation, production JWT secret policy, CORS allowlist, `.env.example`, deployment instructions, and health checks.
- Run retrieval evaluation: semantic, lexical, recency, hybrid, long-note chunking; record Hit@K, MRR, latency, fallback, RAG faithfulness, and refusal behavior.

## Stop here and ask Person 2 before committing or merging

Pause for Person 2 confirmation when:

- You change response fields, endpoints, request fields, error behavior, role names, SSE payloads, pagination, or search result shapes they consume.
- A backend feature requires a UI decision: lock conflict behavior, draft recovery interaction, sharing/permission presentation, hybrid-search controls, or AI citation display.
- You need Person 2 to update the frontend adapter, mocks, E2E tests, environment configuration, or deployment URL.
- A backend change will break their current branch or needs a coordinated schema/API migration.

Before merging a backend milestone that Person 2 consumes, send them: branch/commit, changed endpoints, full request/response examples, error/edge cases, test commands and results, migration steps, and required frontend follow-up. Wait for their confirmation that the integration contract is understood before continuing to a dependent UI-backed feature.

## Recommended handoff checkpoints

1. Authorization foundation — ready now after review of the current diff.
2. Locks/soft-save/hard-save API — wait for Person 2 before building lock UI.
3. Search modes/chunked retrieval API — wait for Person 2 before search UI work.
4. RAG and shared retrieval API — wait for Person 2 before AI UI/E2E work.
5. Deployment and release verification — both people approve only after full E2E testing.

## Verification commands

Run from `backend/`:

```powershell
node --check src\\services\\access.js
node --check src\\routes\\notes.js
node --test tests\\access.test.js
npm test
```

Run the full test command only after checking required environment variables and test-database behavior. Do not treat a hanging or partial TAP header as a passing test.
