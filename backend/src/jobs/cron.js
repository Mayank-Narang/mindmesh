const cron = require('node-cron');
const Note = require('../models/Note');
const NoteChunk = require('../models/NoteChunk');
const Brain = require('../models/Brain');
const { generateBrainMemoryState } = require('../services/brainMemory');

function startCronJobs() {
  // 1. Brain Summarisation Job (Runs every day at midnight)
  // Replaces count-only brain descriptions with compact generated JSON memory state
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily brain summarisation job...');
    try {
      const brains = await Brain.find({});
      for (const brain of brains) {
        await generateBrainMemoryState(brain);
      }
      console.log(`[CRON] Generated compact JSON memory state for ${brains.length} brain(s).`);
    } catch (err) {
      console.error('[CRON] Error in brain summarisation:', err);
    }
  });

  // 2. Orphaned Data Cleanup Job (Runs every Sunday at 3 AM)
  cron.schedule('0 3 * * 0', async () => {
    console.log('[CRON] Starting orphaned data cleanup job...');
    try {
      // Find notes that reference a brain that no longer exists
      const notes = await Note.find({ brain: { $ne: null } });
      let orphanedCount = 0;
      for (const note of notes) {
        const brainExists = await Brain.findById(note.brain);
        if (!brainExists) {
          note.brain = null; // Unlink orphaned note
          await note.save();
          await NoteChunk.updateMany({ note: note._id }, { $set: { brain: null } });
          orphanedCount++;
        }
      }
      // Also clean up any chunks whose parent note no longer exists
      const validNoteIds = await Note.find({}).distinct('_id');
      const deletedChunks = await NoteChunk.deleteMany({ note: { $nin: validNoteIds } });
      console.log(`[CRON] Cleaned up ${orphanedCount} orphaned notes and ${deletedChunks.deletedCount || 0} orphaned chunks.`);
    } catch (err) {
      console.error('[CRON] Error in orphaned data cleanup:', err);
    }
  });

  // 3. Expire idle note-editing locks every minute. Drafts are retained for recovery.
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const result = await Note.updateMany(
        { lockExpiresAt: { $ne: null, $lte: now } },
        { $set: { lockedBy: null, lockedAt: null, lockExpiresAt: null } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Expired ${result.modifiedCount} idle note lock(s).`);
      }
    } catch (err) {
      console.error('[CRON] Error expiring idle note locks:', err);
    }
  });

  console.log('✅ Background jobs registered.');
}

module.exports = { startCronJobs };
