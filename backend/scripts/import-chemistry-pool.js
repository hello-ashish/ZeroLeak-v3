import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { encryptQuestionContent, hashQuestionContent } from '../src/Services/crypto.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CSV_PATH = process.env.CSV_PATH || path.resolve(__dirname, '../../JEE_NEET_Chemistry_100001_UNIQUE.csv');
const MONGO_URI = process.env.MONGODB_URI;
const PROFESSOR_EMAIL = process.env.PROFESSOR_EMAIL;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '2500', 10);
const SUBJECT_NAME = 'Chemistry';

function parseCSVLine(line) {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            let field = line.substring(start, i);
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.slice(1, -1).replace(/""/g, '"');
            }
            result.push(field);
            start = i + 1;
        }
    }
    let lastField = line.substring(start);
    if (lastField.startsWith('"') && lastField.endsWith('"')) {
        lastField = lastField.slice(1, -1).replace(/""/g, '"');
    }
    result.push(lastField);
    return result;
}

async function runImport() {
    console.log('================================================================');
    console.log(` ZeroLeak High-Speed Question Ingestion Engine`);
    console.log(` Target Pool: ${SUBJECT_NAME} (JEE / NEET)`);
    console.log(` Professor:   ${PROFESSOR_EMAIL}`);
    console.log(` Source File: ${CSV_PATH}`);
    console.log('================================================================');

    if (!MONGO_URI) {
        console.error('[ERROR] MONGODB_URI not found in environment.');
        process.exit(1);
    }

    if (!PROFESSOR_EMAIL) {
        console.error('[ERROR] PROFESSOR_EMAIL not found in environment.');
        process.exit(1);
    }

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`[ERROR] CSV file not found at: ${CSV_PATH}`);
        process.exit(1);
    }

    if (!process.env.QUESTION_ENCRYPTION_KEY) {
        console.error('[ERROR] QUESTION_ENCRYPTION_KEY not set.');
        process.exit(1);
    }

    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10000,
    });
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

    const db = mongoose.connection.db;
    const professorsCollection = db.collection('professors');
    const questionsCollection = db.collection('questions');
    const auditLogsCollection = db.collection('auditlogs');

    const professor = await professorsCollection.findOne({ email: PROFESSOR_EMAIL });
    if (!professor) {
        console.error(`[ERROR] Professor ${PROFESSOR_EMAIL} not found in database!`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Authenticated Professor: ${professor.name} (ID: ${professor.id || professor._id})`);
    const profObjectId = professor._id;

    const initialTotal = await questionsCollection.countDocuments();
    const initialSubjectCount = await questionsCollection.countDocuments({ subject: SUBJECT_NAME });
    console.log(`Current DB Questions: ${initialTotal} total (${initialSubjectCount} ${SUBJECT_NAME})`);

    const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let lineIndex = 0;
    let validCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let batchBuffer = [];
    const topicStats = {};
    const difficultyStats = { easy: 0, medium: 0, hard: 0 };

    const startTime = Date.now();
    let lastLogTime = startTime;
    let lastLogCount = 0;

    console.log(`\nStreaming and ingesting ${SUBJECT_NAME} questions...`);

    for await (const rawLine of rl) {
        lineIndex++;

        // Handle BOM and header
        let line = rawLine;
        if (lineIndex === 1) {
            if (line.charCodeAt(0) === 0xfeff) {
                line = line.slice(1);
            }
            if (line.toLowerCase().startsWith('title,option')) {
                continue; // Skip header
            }
        }

        if (!line.trim()) continue;

        const row = parseCSVLine(line);
        if (row.length < 8) {
            skippedCount++;
            continue;
        }

        const title = row[0].trim();
        const options = [row[1].trim(), row[2].trim(), row[3].trim(), row[4].trim()];
        const correctIndex = parseInt(row[5], 10);
        let difficulty = (row[6] || '').trim().toLowerCase();
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            difficulty = 'medium';
        }
        const topic = row[7].trim();

        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
            skippedCount++;
            continue;
        }

        const correctAnswer = options[correctIndex];

        const sensitiveContent = {
            title,
            options,
            correctAnswer,
            correctAnswerIndex: correctIndex,
            subject: SUBJECT_NAME,
            topic,
            difficultyLevel: difficulty,
        };

        const contentHash = hashQuestionContent(sensitiveContent);
        const encrypted = encryptQuestionContent(sensitiveContent);

        const now = new Date();
        const questionDoc = {
            encryptedContent: {
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
            },
            contentHash,
            difficultyLevel: difficulty,
            subject: SUBJECT_NAME,
            topic,
            createdBy: profObjectId,
            createdAt: now,
            updatedAt: now,
            __v: 0,
        };

        batchBuffer.push(questionDoc);
        validCount++;
        topicStats[topic] = (topicStats[topic] || 0) + 1;
        difficultyStats[difficulty] = (difficultyStats[difficulty] || 0) + 1;

        if (batchBuffer.length >= BATCH_SIZE) {
            const toInsert = batchBuffer;
            batchBuffer = [];
            const res = await questionsCollection.insertMany(toInsert, { ordered: false });
            insertedCount += res.insertedCount;

            const nowMs = Date.now();
            if (validCount % 10000 === 0 || validCount >= 100000) {
                const elapsedSec = ((nowMs - startTime) / 1000).toFixed(1);
                const intervalSec = ((nowMs - lastLogTime) / 1000);
                const currentSpeed = intervalSec > 0 ? Math.round((validCount - lastLogCount) / intervalSec) : 0;
                const overallSpeed = Math.round(validCount / (elapsedSec || 1));
                const remaining = 100001 - validCount;
                const etaSec = overallSpeed > 0 ? (remaining / overallSpeed).toFixed(1) : 0;
                const pct = ((validCount / 100001) * 100).toFixed(1);

                console.log(
                    `[PROGRESS] ${validCount.toLocaleString()} / 100,001 (${pct}%) | ` +
                    `Inserted: ${insertedCount.toLocaleString()} | ` +
                    `Speed: ${currentSpeed} q/s (Avg: ${overallSpeed}) | ` +
                    `Elapsed: ${elapsedSec}s | ETA: ${etaSec}s`
                );

                lastLogTime = nowMs;
                lastLogCount = validCount;
            }
        }
    }

    // Flush any remaining questions
    if (batchBuffer.length > 0) {
        const toInsert = batchBuffer;
        batchBuffer = [];
        const res = await questionsCollection.insertMany(toInsert, { ordered: false });
        insertedCount += res.insertedCount;
    }

    const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgRate = Math.round(insertedCount / (totalDurationSec || 1));

    console.log('\n================================================================');
    console.log(` Ingestion Complete for ${SUBJECT_NAME}!`);
    console.log('================================================================');
    console.log(`Total CSV lines read:     ${lineIndex.toLocaleString()}`);
    console.log(`Valid questions parsed:   ${validCount.toLocaleString()}`);
    console.log(`Inserted into MongoDB:    ${insertedCount.toLocaleString()}`);
    console.log(`Skipped / invalid lines:  ${skippedCount}`);
    console.log(`Total execution time:     ${totalDurationSec}s (~${(totalDurationSec / 60).toFixed(2)} min)`);
    console.log(`Average throughput:       ${avgRate.toLocaleString()} questions/second`);
    console.log(`\nDifficulty Breakdown:`);
    console.log(`  Easy:   ${difficultyStats.easy.toLocaleString()}`);
    console.log(`  Medium: ${difficultyStats.medium.toLocaleString()}`);
    console.log(`  Hard:   ${difficultyStats.hard.toLocaleString()}`);
    console.log(`\nTopics Breakdown (${Object.keys(topicStats).length} topics):`);
    Object.entries(topicStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([top, count]) => {
            console.log(`  - ${top}: ${count.toLocaleString()} questions`);
        });
    if (Object.keys(topicStats).length > 10) {
        console.log(`  ... and ${Object.keys(topicStats).length - 10} more topics.`);
    }

    // Record Audit Log
    try {
        await auditLogsCollection.insertOne({
            actor: PROFESSOR_EMAIL,
            actorRole: 'Professor',
            action: 'QUESTION_BATCH_IMPORT',
            targetType: 'QuestionPool',
            targetId: String(insertedCount),
            targetLabel: `${SUBJECT_NAME} Question Bank (${insertedCount.toLocaleString()} items)`,
            details: `Imported ${insertedCount.toLocaleString()} AES-256-GCM encrypted ${SUBJECT_NAME} questions with SHA-256 integrity hashes for JEE/NEET pool.`,
            status: 'success',
            createdAt: new Date(),
        });
        console.log(`\n[AuditLog] Recorded QUESTION_BATCH_IMPORT event for ${SUBJECT_NAME}.`);
    } catch (auditErr) {
        console.warn('[AuditLog] Warning: Could not log event:', auditErr.message);
    }

    const finalTotal = await questionsCollection.countDocuments();
    const finalSubjectCount = await questionsCollection.countDocuments({ subject: SUBJECT_NAME });
    console.log(`\nFinal MongoDB Counts:`);
    console.log(`  Total Questions in DB:     ${finalTotal.toLocaleString()}`);
    console.log(`  ${SUBJECT_NAME} Questions in DB: ${finalSubjectCount.toLocaleString()}`);

    await mongoose.disconnect();
    console.log('\nDisconnected cleanly from MongoDB. Done!');
}

runImport().catch((err) => {
    console.error('[FATAL ERROR]:', err);
    process.exit(1);
});
