import * as api from './api.js';

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

// AI exports
export const askAI = api.askAI;

// Profile exports
export const updateProfile = api.updateProfile;
