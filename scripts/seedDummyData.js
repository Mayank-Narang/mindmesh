#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Parse CLI arguments
const args = process.argv.slice(2);
const clearFlag = args.includes('--clear');
const dryRunFlag = args.includes('--dry-run');

let filePath = path.join(__dirname, 'data', 'dummyNotes.json');
const fileFlagIndex = args.indexOf('--file');
if (fileFlagIndex !== -1 && args[fileFlagIndex + 1]) {
    filePath = path.resolve(process.cwd(), args[fileFlagIndex + 1]);
}

// Load environment variables from backend/.env
const envPath = path.resolve(__dirname, '..', 'backend', '.env');
dotenv.config({ path: envPath });

// Import embedding service
const { getEmbedding } = require('../backend/src/services/embedding');

// ANSI Escape Codes for Colors
const cGreen = '\x1b[32m';
const cRed = '\x1b[31m';
const cYellow = '\x1b[33m';
const cCyan = '\x1b[36m';
const cReset = '\x1b[0m';

// Dummy Brain ID (must be a valid ObjectId)
const DUMMY_BRAIN_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

// Minimal inline schema
const noteSchema = new mongoose.Schema({
    brainId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['text', 'markdown', 'link'], required: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    tags: [String],
    linkUrl: String,
    embedding: [Number],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Note = mongoose.model('Note', noteSchema);

async function main() {
    console.log(`${cCyan}MindMesh Dummy Data Seeder${cReset}`);
    console.log(`${cCyan}--------------------------${cReset}`);
    console.log(`File: ${filePath}`);
    console.log(`Mode: ${dryRunFlag ? cYellow + 'Dry Run' : cGreen + 'Live'} ${cReset}`);
    console.log(`Clear Existing: ${clearFlag ? cRed + 'Yes' : cGreen + 'No'} ${cReset}\n`);

    if (!fs.existsSync(filePath)) {
        console.error(`${cRed}✗ Error: JSON file not found at ${filePath}${cReset}`);
        process.exit(1);
    }

    let notesRaw;
    try {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        notesRaw = JSON.parse(fileData);
    } catch (err) {
        console.error(`${cRed}✗ Error reading or parsing JSON file:${cReset}`, err.message);
        process.exit(1);
    }

    if (!Array.isArray(notesRaw)) {
        console.error(`${cRed}✗ Error: JSON file must contain an array of objects.${cReset}`);
        process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error(`${cRed}✗ Error: GEMINI_API_KEY is not set in backend/.env${cReset}`);
        process.exit(1);
    }

    if (!dryRunFlag) {
        if (!process.env.MONGODB_URI) {
            console.error(`${cRed}✗ Error: MONGODB_URI is not set in backend/.env${cReset}`);
            process.exit(1);
        }

        try {
            console.log(`Connecting to MongoDB...`);
            await mongoose.connect(process.env.MONGODB_URI);
            console.log(`${cGreen}✓ Connected to MongoDB${cReset}`);
        } catch (err) {
            console.error(`${cRed}✗ MongoDB connection error:${cReset}`, err.message);
            process.exit(1);
        }

        if (clearFlag) {
            console.log(`${cYellow}Clearing existing notes...${cReset}`);
            await Note.deleteMany({});
            console.log(`${cGreen}✓ Notes collection cleared.${cReset}`);
        }
    }

    let successCount = 0;
    let failCount = 0;
    const totalNotes = notesRaw.length;

    console.log(`\nStarting processing of ${totalNotes} notes...`);

    for (let i = 0; i < totalNotes; i++) {
        const noteData = notesRaw[i];
        try {
            const textToEmbed = `${noteData.title} ${noteData.content || ''}`.trim();
            const embedding = await getEmbedding(textToEmbed, 'RETRIEVAL_DOCUMENT');
            
            if (!dryRunFlag) {
                const noteDoc = new Note({
                    ...noteData,
                    brainId: DUMMY_BRAIN_ID,
                    embedding: embedding
                });
                await noteDoc.save();
            }
            
            successCount++;
            console.log(`[${i + 1}/${totalNotes}] ${cGreen}✓ Embedded:${cReset} "${noteData.title}" (${embedding.length} dims)`);
            
            // Sleep slightly to prevent rate limiting between documents even for singular requests
            if (i < totalNotes - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (err) {
            failCount++;
            console.error(`[${i + 1}/${totalNotes}] ${cRed}✗ Error processing note "${noteData.title}":${cReset}`, err.message);
        }
    }

    console.log(`\n${cCyan}--- Summary ---${cReset}`);
    console.log(`Total:     ${totalNotes}`);
    console.log(`Succeeded: ${cGreen}${successCount}${cReset}`);
    console.log(`Failed:    ${failCount > 0 ? cRed + failCount + cReset : failCount}`);

    if (!dryRunFlag) {
        await mongoose.disconnect();
        console.log(`\n${cGreen}✓ Disconnected from MongoDB${cReset}`);
    }
}

main().catch(err => {
    console.error(`${cRed}Unhandled error:${cReset}`, err);
    process.exit(1);
});
