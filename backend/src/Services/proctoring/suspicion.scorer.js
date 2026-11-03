/**
 * Suspicion Scorer
 *
 * Manages per-session suspicion state in Redis and decides when to
 * emit admin alerts.  This is deliberately separated from the detection
 * service so each piece has a single responsibility.
 *
 * Redis key:  proctor:ai:<sessionId>
 * TTL:        30 minutes (refreshed on every signal so active sessions stay alive)
 *
 * State ownership:
 *   - process-local: deduplication Map (falls back gracefully if Redis is available)
 *   - Redis:  live suspicion JSON blob   (shared across replicas)
 *   - Mongo:  ProctoringAIEvent          (written by caller — not this module)
 */

import redisClient from "../../redis/index.js";
import {
    computeScoreContribution,
    scoreToLevel,
    ALERT_THRESHOLD_SCORE,
    ALERT_DEDUP_WINDOW_MS
} from "./detection.service.js";

const AI_STATE_PREFIX    = "proctor:ai:";
const AI_STATE_TTL_S     = 1800; // 30 minutes
const SCORE_DECAY_FACTOR = 0.8;  // Applied to old score on each new signal (keeps it fresh)

const redisAvailable = () => redisClient?.isOpen;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAIState(sessionId) {
    if (!redisAvailable()) return null;
    try {
        const raw = await redisClient.get(`${AI_STATE_PREFIX}${sessionId}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function setAIState(sessionId, state) {
    if (!redisAvailable()) return;
    try {
        await redisClient.set(
            `${AI_STATE_PREFIX}${sessionId}`,
            JSON.stringify(state),
            { EX: AI_STATE_TTL_S }
        );
    } catch { /* non-critical */ }
}

export async function clearAIState(sessionId) {
    if (!redisAvailable()) return;
    try {
        await redisClient.del(`${AI_STATE_PREFIX}${sessionId}`);
    } catch { /* non-critical */ }
}

// ─── Alert deduplication ──────────────────────────────────────────────────────
// In-memory fallback (per-process).  With the Redis adapter admins on any
// replica receive alerts; the dedup here prevents the same replica from
// emitting the same alert twice within the cooldown window.
const localDedupMap = new Map(); // key: `${sessionId}:${type}` → lastEmittedAt

function isDuplicate(sessionId, type) {
    const key    = `${sessionId}:${type}`;
    const lastAt = localDedupMap.get(key) || 0;
    return Date.now() - lastAt < ALERT_DEDUP_WINDOW_MS;
}

function markEmitted(sessionId, type) {
    localDedupMap.set(`${sessionId}:${type}`, Date.now());
}

// Cleanup old dedup entries every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - ALERT_DEDUP_WINDOW_MS;
    for (const [key, ts] of localDedupMap.entries()) {
        if (ts < cutoff) localDedupMap.delete(key);
    }
}, 300_000);

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Process a batch of DetectionSignals for a session, update the live Redis
 * suspicion state, and return alert descriptors for any signals that cross
 * the threshold and have not been recently deduped.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.studentId
 * @param {string} params.examId
 * @param {import('./detection.service.js').DetectionSignal[]} params.signals
 * @returns {Promise<{state: Object, alerts: Object[]}>}
 *   state  — the updated Redis suspicion state (for logging/testing)
 *   alerts — signals that should trigger real-time admin notifications
 */
export async function processSignals({ sessionId, studentId, examId, signals }) {
    if (!signals.length) return { state: null, alerts: [] };

    // Load existing state
    let state = await getAIState(sessionId) || {
        sessionId,
        studentId,
        examId,
        score:       0,
        level:       "NORMAL",
        signals:     [],   // last N contributing signals (for explanation)
        lastEvent:   null,
        lastEventAt: null,
        updatedAt:   null
    };

    const alerts = [];

    for (const signal of signals) {
        const contribution = computeScoreContribution(signal.type, signal.confidence);

        // Decay old score slightly so recency matters, then add contribution
        state.score = Math.min(100, Math.round(state.score * SCORE_DECAY_FACTOR + contribution));
        state.level = scoreToLevel(state.score);

        // Keep a rolling window of the last 10 contributing signals
        state.signals.push({
            type:         signal.type,
            confidence:   signal.confidence,
            contribution,
            modelVersion: signal.modelVersion,
            at:           signal.timestamp?.toISOString?.() || new Date().toISOString()
        });
        if (state.signals.length > 10) state.signals.shift();

        state.lastEvent   = signal.type;
        state.lastEventAt = signal.timestamp?.toISOString?.() || new Date().toISOString();
        state.updatedAt   = new Date().toISOString();

        // Decide whether to emit an alert
        if (state.score >= ALERT_THRESHOLD_SCORE && !isDuplicate(sessionId, signal.type)) {
            markEmitted(sessionId, signal.type);
            alerts.push({
                sessionId,
                studentId,
                examId,
                type:         signal.type,
                confidence:   signal.confidence,
                score:        state.score,
                level:        state.level,
                modelVersion: signal.modelVersion,
                metadata:     signal.metadata,
                timestamp:    signal.timestamp?.toISOString?.() || new Date().toISOString()
            });
        }
    }

    await setAIState(sessionId, state);
    return { state, alerts };
}

/**
 * Retrieve the current live suspicion state for a session.
 * Returns null when Redis is down or the key has expired.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getSessionSuspicion(sessionId) {
    return getAIState(sessionId);
}
