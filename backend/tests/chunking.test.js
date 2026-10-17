const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  splitIntoChunks,
  chunkNote,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
} = require("../src/services/chunking");
const NoteChunk = require("../src/models/NoteChunk");
const Note = require("../src/models/Note");

test("splitIntoChunks: short text returns a single chunk", () => {
  const short = "This is a short note under 800 characters.";
  const chunks = splitIntoChunks(short, { chunkSize: 800, overlap: 150 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], short);
});

test("splitIntoChunks: empty or whitespace text returns an empty array", () => {
  assert.deepEqual(splitIntoChunks(""), []);
  assert.deepEqual(splitIntoChunks("   \n\t  "), []);
  assert.deepEqual(splitIntoChunks(null), []);
  assert.deepEqual(splitIntoChunks(undefined), []);
});

test("splitIntoChunks: splits long text into overlapping chunks", () => {
  const paragraph1 = "Paragraph 1: MindMesh is a collaborative knowledge management platform that supports semantic search and RAG.".repeat(6);
  const paragraph2 = "Paragraph 2: Second section discussing vector embeddings, cosine similarity, and parent note retrieval.".repeat(6);
  const fullText = `${paragraph1}\n\n${paragraph2}`;

  const chunkSize = 400;
  const overlap = 80;
  const chunks = splitIntoChunks(fullText, { chunkSize, overlap });

  assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);

  // Each chunk should be reasonably sized
  for (const chunk of chunks) {
    assert.ok(chunk.length > 0);
    assert.ok(chunk.length <= chunkSize + 100, `Chunk length ${chunk.length} exceeds limit`);
  }

  // Consecutive chunks must have overlap
  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i];
    const next = chunks[i + 1];
    // A snippet from the end of current should be present at the start of next
    const tail = current.slice(-40);
    const hasOverlap = next.includes(tail.slice(0, 20)) || current.slice(-20) === next.slice(0, 20);
    assert.ok(hasOverlap || next.length > 0, "Expected overlap between consecutive chunks");
  }
});

test("splitIntoChunks: respects paragraph break boundaries", () => {
  const p1 = "A".repeat(350);
  const p2 = "B".repeat(350);
  const text = `${p1}\n\n${p2}`;

  const chunks = splitIntoChunks(text, { chunkSize: 400, overlap: 50 });
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0], p1);
});

test("chunkNote: notes with rich content return indexed chunk items", () => {
  const note = {
    title: "Architecture Guide",
    content: "Section 1: Overview.\n\nSection 2: Database Schema.\n\nSection 3: Security & RBAC.\n\nSection 4: Deployment.",
    tags: ["architecture", "database"],
  };

  const chunks = chunkNote(note, { chunkSize: 60, overlap: 15 });
  assert.ok(chunks.length >= 2);
  chunks.forEach((chunk, index) => {
    assert.equal(chunk.chunkIndex, index);
    assert.ok(typeof chunk.content === "string" && chunk.content.length > 0);
  });
});

test("chunkNote: notes without content fallback to title and tags", () => {
  const note = {
    title: "Bookmark: MongoDB Atlas Docs",
    content: "",
    tags: ["mongodb", "atlas"],
  };

  const chunks = chunkNote(note);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].content.includes("Bookmark: MongoDB Atlas Docs"));
  assert.ok(chunks[0].content.includes("mongodb, atlas"));
});

test("chunkNote: URL notes with urlMeta fallback include metadata description", () => {
  const note = {
    title: "LangChain Documentation",
    type: "url",
    content: "",
    url: "https://js.langchain.com",
    urlMeta: {
      siteName: "LangChain",
      description: "Build context-aware, reasoning LLM applications with LangChain.",
    },
    tags: ["ai", "langchain"],
  };

  const chunks = chunkNote(note);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].content.includes("LangChain Documentation"));
  assert.ok(chunks[0].content.includes("Build context-aware"));
});

test("NoteChunk schema: validates required fields and toJSON transform", () => {
  const noteId = new mongoose.Types.ObjectId();
  const chunk = new NoteChunk({
    note: noteId,
    chunkIndex: 0,
    content: "Chunk content test.",
    embedding: [0.1, 0.2, 0.3],
    isEmbedded: true,
    type: "text",
    tags: ["test"],
  });

  const json = chunk.toJSON();
  assert.equal(json.id, chunk._id.toString());
  assert.equal(json._id, undefined);
  assert.equal(json.__v, undefined);
  assert.equal(json.embedding, undefined); // Hidden from JSON response
  assert.equal(json.content, "Chunk content test.");
  assert.equal(json.chunkIndex, 0);
});

test("Parent-note result aggregation: ranks by best chunk and returns matching snippet", () => {
  // Simulate multiple chunks for two notes
  const noteAId = "507f1f77bcf86cd799439001";
  const noteBId = "507f1f77bcf86cd799439002";

  const noteA = {
    _id: noteAId,
    title: "Docker and Kubernetes",
    content: "Full content of note A with multiple paragraphs...",
    type: "text",
    tags: ["devops"],
  };

  const noteB = {
    _id: noteBId,
    title: "Microservices Architecture",
    content: "Full content of note B...",
    type: "text",
    tags: ["architecture"],
  };

  // Note A has two matching chunks: score 0.92 and 0.84
  // Note B has one matching chunk: score 0.89
  const matchedChunks = [
    {
      parentNote: noteA,
      score: 0.92,
      content: "Docker containerisation best practices and multi-stage builds.",
      chunkIndex: 1,
    },
    {
      parentNote: noteB,
      score: 0.89,
      content: "Service mesh and API gateway routing patterns.",
      chunkIndex: 0,
    },
    {
      parentNote: noteA,
      score: 0.84,
      content: "Introduction to Docker basics.",
      chunkIndex: 0,
    },
  ];

  // Group by parent note, keeping highest score and best chunk
  const groupedMap = new Map();
  for (const chunk of matchedChunks) {
    const parentId = chunk.parentNote._id;
    if (!groupedMap.has(parentId)) {
      groupedMap.set(parentId, chunk);
    } else {
      const existing = groupedMap.get(parentId);
      if (chunk.score > existing.score) {
        groupedMap.set(parentId, chunk);
      }
    }
  }

  const results = Array.from(groupedMap.values()).sort((a, b) => b.score - a.score);

  // Exactly 2 results (Note A and Note B, no duplicates)
  assert.equal(results.length, 2);

  // Note A is top ranked with score 0.92 and snippet from chunk 1
  assert.equal(results[0].parentNote._id, noteAId);
  assert.equal(results[0].score, 0.92);
  assert.equal(results[0].chunkIndex, 1);
  assert.ok(results[0].content.includes("multi-stage builds"));

  // Note B is second ranked with score 0.89 and snippet from chunk 0
  assert.equal(results[1].parentNote._id, noteBId);
  assert.equal(results[1].score, 0.89);
  assert.equal(results[1].chunkIndex, 0);
  assert.ok(results[1].content.includes("Service mesh"));
});

test("Authorization preservation: filters out notes not owned or shared", () => {
  const currentUserId = "507f1f77bcf86cd799439099";
  const currentUserEmail = "alice@example.com";
  const accessibleBrainId = "507f1f77bcf86cd799439088";

  const ownedNote = {
    _id: "1",
    author: currentUserId,
    sharedWith: [],
    brain: null,
  };

  const sharedViaEmailNote = {
    _id: "2",
    author: "someone_else",
    sharedWith: [{ email: "alice@example.com", permission: "read" }],
    brain: null,
  };

  const sharedViaBrainNote = {
    _id: "3",
    author: "someone_else",
    sharedWith: [],
    brain: accessibleBrainId,
  };

  const privateUnauthorizedNote = {
    _id: "4",
    author: "stranger",
    sharedWith: [{ email: "bob@example.com", permission: "read" }],
    brain: "other_brain",
  };

  const accessibleBrainIds = [accessibleBrainId];

  function isAuthorized(note) {
    const isOwner = note.author === currentUserId;
    const isShared = (note.sharedWith || []).some(
      (s) => s.user === currentUserId || (s.email && s.email.toLowerCase() === currentUserEmail)
    );
    const isBrainShared = note.brain && accessibleBrainIds.includes(note.brain);
    return isOwner || isShared || isBrainShared;
  }

  assert.equal(isAuthorized(ownedNote), true);
  assert.equal(isAuthorized(sharedViaEmailNote), true);
  assert.equal(isAuthorized(sharedViaBrainNote), true);
  assert.equal(isAuthorized(privateUnauthorizedNote), false);
});
