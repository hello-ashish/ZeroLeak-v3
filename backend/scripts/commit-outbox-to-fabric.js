import 'dotenv/config';
import mongoose from 'mongoose';
import { createCommitment } from '../src/Services/fabric.service.js';

let running = true;
process.on('SIGINT', () => {
    console.log('\n[GRACEFUL STOP] Received SIGINT. Finishing current transaction and exiting...');
    running = false;
});
process.on('SIGTERM', () => {
    console.log('\n[GRACEFUL STOP] Received SIGTERM. Finishing current transaction and exiting...');
    running = false;
});

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('[ERROR] MONGODB_URI not found in environment.');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected.');

    const col = mongoose.connection.collection('integrityoutboxes');

    const filter = {
        status: { $ne: 'CONFIRMED' },
        entityType: { $ne: 'Question' }
    };

    const totalRemaining = await col.countDocuments(filter);
    console.log(`\n======================================================`);
    console.log(`  ZeroLeak Outbox Backfill to Mock Blockchain Ledger`);
    console.log(`  Total commitments to commit: ${totalRemaining}`);
    console.log(`======================================================\n`);

    if (totalRemaining === 0) {
        console.log('No remaining commitments to process in outbox. All up to date!');
        await mongoose.disconnect();
        return;
    }

    const cursor = col.find(filter).sort({ createdAt: 1 });
    let count = 0;
    let successCount = 0;
    let failCount = 0;

    while (await cursor.hasNext()) {
        if (!running) {
            console.log('[STOP] Stopping loop as requested.');
            break;
        }

        const rec = await cursor.next();
        count++;
        const pct = ((count / totalRemaining) * 100).toFixed(1);

        console.log(`[${count}/${totalRemaining}] (${pct}%) Committing ${rec.commitmentId} (${rec.entityType})...`);

        try {
            const res = await createCommitment({
                id: rec.commitmentId,
                eventType: rec.eventType,
                entityType: rec.entityType,
                entityId: rec.entityId,
                dataHash: rec.dataHash,
                previousCommitmentHash: rec.previousCommitmentHash || '',
                version: rec.version || 1,
                timestamp: rec.eventTimestamp
            });

            await col.updateOne({ _id: rec._id }, {
                $set: {
                    status: 'CONFIRMED',
                    fabricTxId: res.txId || null,
                    fabricBlockTimestamp: res.blockTimestamp || null,
                    fabricHeight: res.height || null,
                    lastError: null,
                    lastErrorCode: null,
                    confirmedAt: new Date(),
                    processingWorker: null,
                    leaseExpiresAt: null
                }
            });

            successCount++;
            console.log(`   -> CONFIRMED height=${res.height} txId=${res.txId?.substring(0, 16)}...`);
        } catch (err) {
            failCount++;
            const errMsg = err?.message || String(err);
            console.error(`   -> FAILED: ${errMsg}`);

            await col.updateOne({ _id: rec._id }, {
                $set: {
                    lastError: errMsg.substring(0, 500),
                    processingWorker: null,
                    leaseExpiresAt: null
                }
            });
        }
    }

    console.log(`\n======================================================`);
    console.log(`  Summary:`);
    console.log(`  Processed: ${count}`);
    console.log(`  Confirmed: ${successCount}`);
    console.log(`  Failed:    ${failCount}`);
    console.log(`======================================================\n`);

    await mongoose.disconnect();
    console.log('MongoDB disconnected. Done.');
}

run().catch(err => {
    console.error('Fatal error in backfill:', err);
    process.exit(1);
});
