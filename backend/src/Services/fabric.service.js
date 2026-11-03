// =============================================================================
// ZeroLeak — Mock Blockchain Ledger Service
// =============================================================================
// Pure, self-contained, enterprise mock blockchain ledger.
// Zero Hyperledger Fabric dependencies or external gRPC peer requirements.
// Maintains cryptographic SHA-256 block hash chaining and supports full
// live verification against MongoDB entities.
// =============================================================================

import crypto from 'crypto';
import { cacheGet, cacheSet, cacheDelPattern } from '../redis/cache.service.js';

const CHANNEL_NAME = 'zeroleak-channel';
const CHAINCODE_NAME = 'zeroleak';
const MSP_ID = 'Org1MSP';

// ─── Canonicalize + Hash ─────────────────────────────────────────────────────

export function canonicalize(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value instanceof Date) return value.toISOString();
    if (value !== null && typeof value === 'object' && typeof value.toHexString === 'function') {
        return value.toHexString();
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((out, key) => {
                out[key] = canonicalize(value[key]);
                return out;
            }, {});
    }
    return value;
}

export function computeDataHash(entity) {
    const canonical = canonicalize(entity);
    const plaintext = JSON.stringify(canonical);
    return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

// ─── Commitment ID Helper ───────────────────────────────────────────────────

export function buildCommitmentId(entityType, entityId, version) {
    const valid = ['Batch', 'Result', 'Exam', 'SecurityEvent'];
    const match = valid.find(v => v.toLowerCase() === String(entityType).toLowerCase());
    const typeKey = match ? match.toLowerCase() : String(entityType).toLowerCase().replace(/[^a-z]/g, '');
    return `${typeKey}_${entityId}_v${version}`;
}

// ─── Blockchain Commitments ─────────────────────────────────────────────────

export async function createCommitment({
    id,
    eventType,
    entityType,
    entityId,
    dataHash,
    previousCommitmentHash = '',
    version = 1,
    timestamp,
}) {
    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');

    const ts = timestamp || new Date().toISOString();

    // Check if commitment was already confirmed
    const existing = await IntegrityOutbox.findOne({ commitmentId: id, status: 'CONFIRMED' }).lean();
    if (existing) {
        const fieldsMatch =
            existing.commitmentId === id &&
            existing.dataHash === dataHash &&
            String(existing.version) === String(version);

        if (!fieldsMatch) {
            console.error(`[MOCK-BLOCKCHAIN] COMMITMENT_CONFLICT id=${id}: immutable fields differ`);
            const err = new Error(`Existing commitment '${id}' conflicts with the requested commitment`);
            err.code = 'COMMITMENT_CONFLICT';
            throw err;
        }

        console.info(`[MOCK-BLOCKCHAIN] Existing commitment verified id=${id}; treating retry as confirmed`);
        return {
            status: 'CONFIRMED',
            duplicate: true,
            id,
            txId: existing.fabricTxId,
            height: existing.fabricHeight,
            blockTimestamp: existing.fabricBlockTimestamp || existing.eventTimestamp,
        };
    }

    // Determine the next block height
    const highestRecord = await IntegrityOutbox.findOne({
        status: 'CONFIRMED',
        fabricHeight: { $ne: null }
    })
        .sort({ fabricHeight: -1 })
        .select('fabricHeight')
        .lean();

    const confirmedCount = await IntegrityOutbox.countDocuments({ status: 'CONFIRMED' });
    const nextHeight = Math.max(highestRecord?.fabricHeight || 0, confirmedCount) + 1;

    // Deterministic transaction ID
    const txId = crypto
        .createHash('sha256')
        .update(`${id}:${dataHash}:${ts}:${nextHeight}`)
        .digest('hex');

    console.info(`[MOCK-BLOCKCHAIN] COMMITMENT_CONFIRMED id=${id} txId=${txId} height=${nextHeight}`);

    // Invalidate cached ledger metrics so fresh state is immediately available
    cacheDelPattern('fabric:*').catch(() => {});
    cacheDelPattern('zl:api:/api/integrity*').catch(() => {});

    return {
        status: 'CONFIRMED',
        duplicate: false,
        id,
        txId,
        height: nextHeight,
        blockTimestamp: ts,
    };
}

export async function getCommitment(id, force = false) {
    if (!force) {
        const cached = await cacheGet(`fabric:commitment:${id}`);
        if (cached) return cached;
    }

    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');
    const record = await IntegrityOutbox.findOne({
        commitmentId: id,
        status: 'CONFIRMED'
    }).lean();

    if (!record) {
        const notFound = new Error(`COMMITMENT_NOT_FOUND: ${id}`);
        notFound.code = 'COMMITMENT_NOT_FOUND';
        throw notFound;
    }

    const commitment = {
        id: record.commitmentId,
        eventType: record.eventType,
        entityType: record.entityType,
        entityId: record.entityId,
        dataHash: record.dataHash,
        previousCommitmentHash: record.previousCommitmentHash || '',
        version: String(record.version || 1),
        timestamp: record.eventTimestamp,
        txId: record.fabricTxId,
        height: record.fabricHeight,
        blockTimestamp: record.fabricBlockTimestamp || record.eventTimestamp,
    };

    await cacheSet(`fabric:commitment:${id}`, commitment, 3600);
    return commitment;
}

export async function verifyCommitment(id, expectedHash) {
    try {
        const commitment = await getCommitment(id);
        const valid = commitment.dataHash === expectedHash;
        return {
            valid,
            storedHash: commitment.dataHash,
            expectedHash,
            version: commitment.version,
            txId: commitment.txId,
            height: commitment.height,
            blockTimestamp: commitment.blockTimestamp,
            reason: valid ? 'VERIFIED' : 'HASH_MISMATCH',
        };
    } catch (err) {
        if (err.code === 'COMMITMENT_NOT_FOUND') {
            return {
                valid: false,
                storedHash: null,
                expectedHash,
                reason: 'COMMITMENT_NOT_FOUND',
            };
        }
        throw err;
    }
}

export async function getCommitmentHistory(id) {
    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');

    const record = await IntegrityOutbox.findOne({ commitmentId: id }).lean();
    let query = {};
    if (record) {
        query = { entityType: record.entityType, entityId: record.entityId, status: 'CONFIRMED' };
    } else {
        const parts = id.split('_');
        if (parts.length >= 3) {
            const entityType = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            const entityId = parts[1];
            query = { entityType, entityId, status: 'CONFIRMED' };
        } else {
            query = { commitmentId: id, status: 'CONFIRMED' };
        }
    }

    const records = await IntegrityOutbox.find(query)
        .sort({ version: 1, fabricHeight: 1 })
        .lean();

    return records.map(r => ({
        txId: r.fabricTxId || `tx_${r.commitmentId}`,
        value: {
            id: r.commitmentId,
            eventType: r.eventType,
            entityType: r.entityType,
            entityId: r.entityId,
            dataHash: r.dataHash,
            version: r.version,
            timestamp: r.eventTimestamp,
        },
        timestamp: r.fabricBlockTimestamp || r.eventTimestamp,
        isDelete: false,
        height: r.fabricHeight,
    }));
}

export async function getLedgerHeight(force = false) {
    if (!force) {
        const cached = await cacheGet('fabric:ledger_height');
        if (cached) return cached;
    }

    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');
    const highestRecord = await IntegrityOutbox.findOne({
        status: 'CONFIRMED',
        fabricHeight: { $ne: null }
    })
        .sort({ fabricHeight: -1 })
        .select('fabricHeight')
        .lean();

    const confirmedCount = await IntegrityOutbox.countDocuments({ status: 'CONFIRMED' });
    const height = Math.max(highestRecord?.fabricHeight || 0, confirmedCount);

    const heightData = {
        height,
        channel: CHANNEL_NAME,
        status: 'ONLINE',
        mode: 'mock',
    };

    await cacheSet('fabric:ledger_height', heightData, 15);
    return heightData;
}

export async function getRecentCommitments(limit = 20, force = false) {
    if (!force) {
        const cached = await cacheGet(`fabric:recent:${limit}`);
        if (cached) return cached;
    }

    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');
    const ALLOWED_ENTITIES = ['Batch', 'Result', 'Exam', 'SecurityEvent'];

    const records = await IntegrityOutbox.find({
        status: 'CONFIRMED',
        entityType: { $in: ALLOWED_ENTITIES }
    })
        .sort({ fabricHeight: -1, createdAt: -1 })
        .limit(limit)
        .lean();

    const commitments = records.map(r => ({
        id: r.commitmentId,
        eventType: r.eventType,
        entityType: r.entityType,
        entityId: r.entityId,
        dataHash: r.dataHash,
        previousCommitmentHash: r.previousCommitmentHash || '',
        version: r.version || 1,
        timestamp: r.eventTimestamp,
        txId: r.fabricTxId,
        blockTimestamp: r.fabricBlockTimestamp || r.eventTimestamp,
        height: r.fabricHeight,
    }));

    await cacheSet(`fabric:recent:${limit}`, commitments, 15);
    return commitments;
}

export async function getFabricBlocks(limit = 500, force = false) {
    if (!force) {
        const cached = await cacheGet(`fabric:blocks:${limit}`);
        if (cached) return cached;
    }

    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');
    const ALLOWED_ENTITIES = ['Batch', 'Result', 'Exam', 'SecurityEvent'];

    const records = await IntegrityOutbox.find({
        status: 'CONFIRMED',
        entityType: { $in: ALLOWED_ENTITIES }
    })
        .sort({ fabricHeight: 1, createdAt: 1 })
        .limit(limit)
        .lean();

    const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const genesisBlockHash = crypto
        .createHash('sha256')
        .update(`${CHANNEL_NAME}:genesis:${MSP_ID}:Raft:OrdererMSP`)
        .digest('hex');

    const blocks = [{
        blockNumber: 0,
        blockHash: genesisBlockHash,
        previousBlockHash: genesisHash,
        channelId: CHANNEL_NAME,
        txCount: 1,
        type: 'GENESIS',
        timestamp: '2026-10-14T18:00:00.000Z',
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        status: 'VALID',
        validationCode: 0,
        description: `Channel Genesis Config Block — initializes ${CHANNEL_NAME} with ${MSP_ID} consortium (Mock Blockchain Ledger)`,
        endorsers: ['peer0.org1.example.com (Org1MSP)', 'peer0.org2.example.com (Org2MSP)'],
        orderer: 'orderer.example.com (Raft Consensus Leader)',
        chaincode: { name: 'syscc/config', version: '1.0', function: 'CreateChannel' },
        readWriteSet: {
            reads: [],
            writes: [{ key: 'ChannelConfig', value: `${CHANNEL_NAME}:v1` }]
        }
    }];

    let prevHash = genesisBlockHash;
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const blockNumber = r.fabricHeight || (i + 1);
        const blockTimestamp = r.fabricBlockTimestamp || r.eventTimestamp || new Date().toISOString();
        const txId = r.fabricTxId || `tx_${crypto.createHash('sha256').update(r.commitmentId + blockNumber).digest('hex')}`;

        const blockHash = crypto
            .createHash('sha256')
            .update(`${prevHash}:${txId}:${r.dataHash}:${blockTimestamp}`)
            .digest('hex');

        const commitmentObj = {
            id: r.commitmentId,
            eventType: r.eventType,
            entityType: r.entityType,
            entityId: r.entityId,
            dataHash: r.dataHash,
            previousCommitmentHash: r.previousCommitmentHash || '',
            version: r.version || 1,
            timestamp: r.eventTimestamp,
            txId,
            blockTimestamp,
            height: blockNumber,
        };

        blocks.push({
            blockNumber,
            blockHash,
            previousBlockHash: prevHash,
            channelId: CHANNEL_NAME,
            txCount: 1,
            type: r.entityType?.toUpperCase() || 'TRANSACTION',
            timestamp: blockTimestamp,
            txId,
            status: 'VALID',
            validationCode: 0,
            commitment: commitmentObj,
            endorsers: [
                'peer0.org1.example.com (Org1MSP)',
                'peer0.org2.example.com (Org2MSP)'
            ],
            orderer: 'orderer.example.com (Raft Consensus)',
            chaincode: {
                name: CHAINCODE_NAME,
                version: '1.0',
                function: 'CreateCommitment'
            },
            readWriteSet: {
                reads: [
                    { key: 'LEDGER_HEIGHT', version: blockNumber - 1 },
                    { key: r.commitmentId, version: null }
                ],
                writes: [
                    { key: 'LEDGER_HEIGHT', value: String(blockNumber) },
                    { key: `HEIGHT_INDEX_${blockNumber}`, value: r.commitmentId },
                    { key: r.commitmentId, value: JSON.stringify(commitmentObj) }
                ]
            }
        });

        prevHash = blockHash;
    }

    const blocksResult = {
        height: Math.max(blocks.length - 1, 0),
        channel: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
        mspId: MSP_ID,
        blocks,
        network: {
            channel: CHANNEL_NAME,
            consensus: 'etcdraft (Raft)',
            peers: [
                { name: 'peer0.org1.example.com', msp: 'Org1MSP', endpoint: 'mock://peer0.org1:7051', role: 'Endorser & Committer', status: 'ONLINE' },
                { name: 'peer0.org2.example.com', msp: 'Org2MSP', endpoint: 'mock://peer0.org2:9051', role: 'Endorser & Committer', status: 'ONLINE' }
            ],
            orderers: [
                { name: 'orderer.example.com', msp: 'OrdererMSP', endpoint: 'mock://orderer:7050', role: 'Raft Leader', status: 'ONLINE' }
            ],
            cas: [
                { name: 'ca_org1', endpoint: 'mock://ca1:7054', role: 'Org1 CA', status: 'ONLINE' },
                { name: 'ca_org2', endpoint: 'mock://ca2:8054', role: 'Org2 CA', status: 'ONLINE' },
                { name: 'ca_orderer', endpoint: 'mock://caorderer:9054', role: 'Orderer CA', status: 'ONLINE' }
            ]
        }
    };

    await cacheSet(`fabric:blocks:${limit}`, blocksResult, 15);
    return blocksResult;
}

export async function commitmentExists(id) {
    const { IntegrityOutbox } = await import('../models/integrityOutbox.models.js');
    const count = await IntegrityOutbox.countDocuments({ commitmentId: id, status: 'CONFIRMED' });
    return count > 0;
}

export async function getFabricStatus(force = false) {
    return {
        enabled: true,
        connected: true,
        mock: true,
        channel: CHANNEL_NAME,
        chaincode: CHAINCODE_NAME,
        mspId: MSP_ID,
        peerEndpoint: 'mock-blockchain-ledger',
        status: 'CONNECTED',
        reason: null,
        error: null,
        lastAttemptedAt: new Date().toISOString(),
    };
}

export async function closeFabricGateway() {
    console.info('[MOCK-BLOCKCHAIN] Mock blockchain ledger closed.');
}

export async function forceReconnect() {
    console.info('[MOCK-BLOCKCHAIN] Refreshing Mock Blockchain state...');
    await cacheDelPattern('fabric:*').catch(() => {});
    await cacheDelPattern('zl:api:/api/integrity*').catch(() => {});
    return getFabricStatus(true);
}

export async function initFabricGateway() {
    console.info('[MOCK-BLOCKCHAIN] Initialized Mock Blockchain Ledger (Zero Fabric dependencies, 100% operational).');
}
