const cron = require('node-cron');
const Note = require('../models/Note');
const Brain = require('../models/Brain');

function startCronJobs() {
  // 1. Brain Summarisation Job (Runs every day at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting daily brain summarisation job...');
    try {
      const brains = await Brain.find({});
      for (const brain of brains) {
        const notesCount = await Note.countDocuments({ brain: brain._id });
        if (notesCount > 0 && (!brain.description || brain.description.trim() === '')) {
          brain.description = `A collection of ${notesCount} notes.`;
          await brain.save();
        }
      }
      console.log('[CRON] Brain summarisation completed.');
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
          orphanedCount++;
        }
      }
      console.log(`[CRON] Cleaned up ${orphanedCount} orphaned notes.`);
    } catch (err) {
      console.error('[CRON] Error in orphaned data cleanup:', err);
    }
  });

  console.log('✅ Background jobs registered.');
}

module.exports = { startCronJobs };
