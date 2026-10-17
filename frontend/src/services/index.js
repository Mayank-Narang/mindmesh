/**
 * MindMesh — API Service Router
 * Defaults to the real API (api.js) for release builds and standard runtime.
 * Switches to mock API (apiMock.js) ONLY when VITE_USE_MOCK === 'true'.
 */

const useMock = Boolean(import.meta.env && import.meta.env.VITE_USE_MOCK === 'true');

let api;

if (useMock) {
  api = await import('./apiMock.js');
} else {
  api = await import('./api.js');
}

export const getBrains = api.getBrains;
export const getNotes = api.getNotes;
export const getNoteById = api.getNoteById;
export const searchNotes = api.searchNotes;
export const saveDraft = api.saveDraft;
export const getUrlMetadata = api.getUrlMetadata;
export const deleteNote = api.deleteNote || (async () => ({ success: true }));

// Auth exports
export const login = api.login;
export const signup = api.signup;
export const getMe = api.getMe;
export const setAuthToken = api.setAuthToken || (() => {});
export const getAuthToken = api.getAuthToken || (() => null);
export const onUnauthorized = api.onUnauthorized || (() => {});

// Brain exports
export const createBrain = api.createBrain;
export const updateBrain = api.updateBrain;
export const deleteBrain = api.deleteBrain;
export const getBrainById = api.getBrainById;

// Sharing exports
export const shareBrain = api.shareBrain;
export const unshareBrain = api.unshareBrain;
export const shareNote = api.shareNote;
export const unshareNote = api.unshareNote;
export const getSharedWithMe = api.getSharedWithMe;

// Note locking exports
export const acquireNoteLock = api.acquireNoteLock || (async () => ({ locked: true }));
export const renewNoteLock = api.renewNoteLock || (async () => ({ locked: true }));
export const releaseNoteLock = api.releaseNoteLock || (async () => ({ locked: false }));

// AI exports
export const askAI = api.askAI;

// Profile exports
export const updateProfile = api.updateProfile;

// Utility exports
export const ApiError = api.ApiError || Error;
export const normalizeEntity = api.normalizeEntity || ((x) => x);
