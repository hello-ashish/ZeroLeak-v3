/**
 * Proctoring AI Detection Service
 *
 * Architecture boundary: This module is the ONLY place in the codebase
 * that knows about specific detectors/models.  The rest of the system
 * works with normalized DetectionSignal objects.
 *
 * State ownership:
 *   - process-local: none (stateless transform)
 *   - Redis:  proctor:ai:<sessionId>  (live suspicion state — managed by SuspicionScorer)
 *   - Mongo:  ProctoringAIEvent       (durable audit trail)
 *
 * To add a real detector (e.g. AWS Rekognition, TensorFlow.js server-side):
 *   1. Implement the DetectorInterface below
 *   2. Register it in DETECTOR_REGISTRY
 *   3. Replace MockDetector with the real one (or run both and merge)
 *
 * Heavy inference MUST NOT run inside this Node process in production.
 * This module should publish work to a queue (BullMQ, SQS, etc.) and
 * consume normalized results back.  The MockDetector simulates that
 * behaviour synchronously so the rest of the architecture can be tested.
 */

// ─── Signal type catalogue ────────────────────────────────────────────────────
export const AI_SIGNAL_TYPES = Object.freeze({
    FACE_MISSING:            "FACE_MISSING",
    MULTIPLE_FACES:          "MULTIPLE_FACES",
    UNUSUAL_FACE_POSITION:   "UNUSUAL_FACE_POSITION",
    PHONE_LIKE_OBJECT:       "PHONE_LIKE_OBJECT",
    SCREEN_ANOMALY:          "SCREEN_ANOMALY",
    UNEXPECTED_CONTENT:      "UNEXPECTED_CONTENT",
    UNUSUAL_AUDIO:           "UNUSUAL_AUDIO",
    MULTIPLE_VOICES:         "MULTIPLE_VOICES",
    TAB_SWITCH:              "TAB_SWITCH",
    WINDOW_BLUR:             "WINDOW_BLUR",
    FULLSCREEN_EXIT:         "FULLSCREEN_EXIT",
    SCREEN_SHARE_STOPPED:    "SCREEN_SHARE_STOPPED",
    RAPID_ANSWER_CHANGE:     "RAPID_ANSWER_CHANGE",
    COPY_PASTE_DETECTED:     "COPY_PASTE_DETECTED"
});

// ─── Scoring configuration ────────────────────────────────────────────────────
// Centralised weight table: the ONLY place weights are defined.
// score = confidence × weight  (capped at weight)
export const SIGNAL_WEIGHTS = Object.freeze({
    [AI_SIGNAL_TYPES.FACE_MISSING]:           25,
    [AI_SIGNAL_TYPES.MULTIPLE_FACES]:         30,
    [AI_SIGNAL_TYPES.UNUSUAL_FACE_POSITION]:  10,
    [AI_SIGNAL_TYPES.PHONE_LIKE_OBJECT]:      20,
    [AI_SIGNAL_TYPES.SCREEN_ANOMALY]:         15,
    [AI_SIGNAL_TYPES.UNEXPECTED_CONTENT]:     20,
    [AI_SIGNAL_TYPES.UNUSUAL_AUDIO]:          10,
    [AI_SIGNAL_TYPES.MULTIPLE_VOICES]:        20,
    [AI_SIGNAL_TYPES.TAB_SWITCH]:             15,
    [AI_SIGNAL_TYPES.WINDOW_BLUR]:             8,
    [AI_SIGNAL_TYPES.FULLSCREEN_EXIT]:        10,
    [AI_SIGNAL_TYPES.SCREEN_SHARE_STOPPED]:   18,
    [AI_SIGNAL_TYPES.RAPID_ANSWER_CHANGE]:    12,
    [AI_SIGNAL_TYPES.COPY_PASTE_DETECTED]:    15
});

export const SUSPICION_LEVELS = Object.freeze({
    NORMAL:     { label: "NORMAL",     min: 0  },
    MONITOR:    { label: "MONITOR",    min: 20 },
    SUSPICIOUS: { label: "SUSPICIOUS", min: 45 },
    HIGH:       { label: "HIGH",       min: 70 }
});

export const ALERT_THRESHOLD_SCORE  = 45;   // score >= this → emit admin alert
export const ALERT_DEDUP_WINDOW_MS  = 60_000; // min gap between repeated identical alerts

/**
 * Derive suspicion level from raw score.
 * @param {number} score  0–100
 * @returns {"NORMAL"|"MONITOR"|"SUSPICIOUS"|"HIGH"}
 */
export function scoreToLevel(score) {
    if (score >= SUSPICION_LEVELS.HIGH.min)       return "HIGH";
    if (score >= SUSPICION_LEVELS.SUSPICIOUS.min) return "SUSPICIOUS";
    if (score >= SUSPICION_LEVELS.MONITOR.min)    return "MONITOR";
    return "NORMAL";
}

/**
 * Compute score contribution for a single signal.
 * @param {string} type
 * @param {number} confidence 0–1
 * @returns {number} 0–100
 */
export function computeScoreContribution(type, confidence) {
    const weight = SIGNAL_WEIGHTS[type] ?? 0;
    return Math.round(Math.min(confidence * weight, weight));
}

// ─── Detector interface ───────────────────────────────────────────────────────
/**
 * @typedef {Object} DetectionInput
 * @property {string}  sessionId
 * @property {string}  studentId
 * @property {string}  examId
 * @property {"camera"|"screen"|"audio"|"behaviour"} source
 * @property {Object}  payload   — source-specific data (e.g. event type, metadata)
 */

/**
 * @typedef {Object} DetectionSignal
 * @property {string}  type             — from AI_SIGNAL_TYPES
 * @property {number}  confidence       — 0–1
 * @property {string}  modelVersion
 * @property {Object}  metadata
 * @property {Date}    timestamp
 */

// ─── Mock Detector ────────────────────────────────────────────────────────────
/**
 * Development/test detector.
 *
 * For behavioural events (tab_switch, window_blur, etc.) it maps the event
 * type to the appropriate AI signal deterministically.
 *
 * For camera/screen/audio it returns no signal (no model available yet).
 * Replace with a real detector to get actual vision/audio signals.
 *
 * This is clearly marked as MOCK so it is never confused for a real model.
 */
class MockDetector {
    get modelVersion() { return "mock-v0"; }

    /** Map behavioural client events → DetectionSignal */
    _behaviourMap = {
        "TAB_SWITCH":           AI_SIGNAL_TYPES.TAB_SWITCH,
        "WINDOW_BLUR":          AI_SIGNAL_TYPES.WINDOW_BLUR,
        "FULLSCREEN_EXIT":      AI_SIGNAL_TYPES.FULLSCREEN_EXIT,
        "SCREEN_SHARE_STOPPED": AI_SIGNAL_TYPES.SCREEN_SHARE_STOPPED,
        "COPY_PASTE_DETECTED":  AI_SIGNAL_TYPES.COPY_PASTE_DETECTED
    };

    /**
     * @param {DetectionInput} input
     * @returns {Promise<DetectionSignal[]>}
     */
    async analyze(input) {
        if (input.source === "behaviour") {
            const eventType = input.payload?.type;
            const mapped = this._behaviourMap[eventType];
            if (!mapped) return [];

            // Confidence is fixed for behavioural signals (deterministic facts)
            const confidence = eventType === "TAB_SWITCH" ? 1.0
                             : eventType === "FULLSCREEN_EXIT" ? 1.0
                             : 0.9;

            return [{
                type: mapped,
                confidence,
                modelVersion: this.modelVersion,
                metadata: { sourceEvent: eventType, ...input.payload },
                timestamp: new Date()
            }];
        }

        // Camera/screen/audio: no model available yet
        // Real implementation would send to inference queue here
        return [];
    }
}

// ─── Detector registry ────────────────────────────────────────────────────────
// Add real detectors here as they become available.
const DETECTOR_REGISTRY = [
    new MockDetector()
    // new AwsRekognitionDetector(),
    // new TensorFlowJSDetector(),
];

// ─── Main service ─────────────────────────────────────────────────────────────
export class ProctoringDetectionService {
    /**
     * Run all registered detectors on the given input and return merged,
     * deduplicated signals.
     *
     * @param {DetectionInput} input
     * @returns {Promise<DetectionSignal[]>}
     */
    async analyze(input) {
        const results = await Promise.allSettled(
            DETECTOR_REGISTRY.map(d => d.analyze(input))
        );

        const signals = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                signals.push(...result.value);
            }
            // Silently absorb detector failures so one bad detector
            // does not break the entire pipeline.
        }

        return signals;
    }
}

// Singleton — import this across the codebase
export const detectionService = new ProctoringDetectionService();
