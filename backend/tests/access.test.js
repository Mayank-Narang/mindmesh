const test = require("node:test");
const assert = require("node:assert/strict");
const { getBrainAccess, getNoteAccess, canRead, canEdit, canManage } = require("../src/services/access");

const ownerId = "507f1f77bcf86cd799439011";
const collaboratorId = "507f1f77bcf86cd799439012";
const readerId = "507f1f77bcf86cd799439013";

const brain = {
  author: ownerId,
  sharedWith: [
    { user: collaboratorId, email: "collaborator@example.com", permission: "collaborator" },
    { email: "reader@example.com", permission: "read" },
  ],
};

test("brain access resolves owner, collaborator, and email-based reader roles", () => {
  assert.equal(getBrainAccess(brain, ownerId, "owner@example.com"), "owner");
  assert.equal(getBrainAccess(brain, collaboratorId, "collaborator@example.com"), "collaborator");
  assert.equal(getBrainAccess(brain, readerId, "READER@example.com"), "read");
  assert.equal(getBrainAccess(brain, readerId, "unknown@example.com"), null);
});

test("direct note share grants access when its brain does not", () => {
  const note = {
    author: ownerId,
    sharedWith: [{ email: "guest@example.com", permission: "read" }],
  };

  assert.equal(getNoteAccess(note, null, readerId, "guest@example.com"), "read");
  assert.equal(getNoteAccess(note, brain, collaboratorId, "collaborator@example.com"), "collaborator");
});

test("permission helpers preserve role boundaries", () => {
  assert.equal(canRead("read"), true);
  assert.equal(canEdit("read"), false);
  assert.equal(canManage("read"), false);
  assert.equal(canEdit("collaborator"), true);
  assert.equal(canManage("collaborator"), false);
  assert.equal(canManage("owner"), true);
});
