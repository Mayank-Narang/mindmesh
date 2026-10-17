function sameId(value, expected) {
  return Boolean(value && expected && value.toString() === expected.toString());
}

function sharePermission(sharedWith, userId, userEmail) {
  const normalizedEmail = (userEmail || "").toLowerCase();
  const share = (sharedWith || []).find((entry) =>
    sameId(entry.user, userId) ||
    Boolean(entry.email && normalizedEmail && entry.email.toLowerCase() === normalizedEmail)
  );
  return share ? share.permission : null;
}

function getBrainAccess(brain, userId, userEmail) {
  if (!brain) return null;
  if (sameId(brain.author, userId)) return "owner";
  return sharePermission(brain.sharedWith, userId, userEmail);
}

function getNoteAccess(note, brain, userId, userEmail) {
  if (!note) return null;
  if (sameId(note.author, userId)) return "owner";

  const directPermission = sharePermission(note.sharedWith, userId, userEmail);
  if (directPermission) return directPermission;

  return getBrainAccess(brain, userId, userEmail);
}

function canRead(access) {
  return access === "owner" || access === "collaborator" || access === "read";
}

function canEdit(access) {
  return access === "owner" || access === "collaborator";
}

function canManage(access) {
  return access === "owner";
}

module.exports = {
  getBrainAccess,
  getNoteAccess,
  canRead,
  canEdit,
  canManage,
};
