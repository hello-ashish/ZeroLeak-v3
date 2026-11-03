/**
 * Proctoring Socket Handler
 *
 * State ownership — what lives where:
 *   process-local (this file):
 *     - socketBroadcastBuffer  Map<sessionId, {...}>   flushed every 5s
 *     - dbWriteBuffer          Map<sessionId, {...}>   flushed every 15s (bulkWrite)
 *     - incidentCounters       Map<sessionId, {...}>   in-memory rate-limit fallback
 *
 *   Redis (shared across replicas via Socket.IO Redis adapter):
 *     - proctor:hb:<sessionId>    presence + heartbeat state   TTL 30s
 *     - proctor:ai:<sessionId>    live suspicion score / level TTL 30m
 *     - proctor:rl:incident:<sid> incident rate-limit counter  TTL 10s
 *     - proctor:gen:<sessionId>   connection generation counter
 *
 *   MongoDB (durable):
 *     - ProctoringSession      session lifecycle + counters
 *     - ProctoringIncident     human/behavioural events
 *     - ProctoringAIEvent      AI detection signals
 */

import jwt from "jsonwebtoken";
import { Admin }              from "../models/admin.models.js";
import { Student }            from "../models/student.models.js";
import { authenticateWebSocket } from "../middlewares/auth.middleware.js";
import { ProctoringSession }  from "../models/proctoringSession.models.js";
import { ProctoringIncident } from "../models/proctoringIncident.models.js";
import { ProctoringAIEvent }  from "../models/proctoringAIEvent.models.js";
import redisClient            from "../redis/index.js";
import { detectionService, computeScoreContribution } from "../Services/proctoring/detection.service.js";
import { processSignals, clearAIState }               from "../Services/proctoring/suspicion.scorer.js";

// ─── Configuration ─────────────────────────────────────────────────────────
const IS_PROD                    = process.env.NODE_ENV === "production";
const BROADCAST_INTERVAL_MS      = 5_000;
const DB_FLUSH_INTERVAL_MS       = 15_000;
const REDIS_HEARTBEAT_TTL_S      = 30;
const INCIDENT_RATE_LIMIT_WINDOW = 10; // seconds
const INCIDENT_RATE_LIMIT_MAX    = 5;
const TERMINAL_STATUSES          = new Set(["ENDED", "DISCONNECTED"]);
const VALID_INCIDENT_TYPES       = new Set([
    "CAMERA_PERMISSION_DENIED", "CAMERA_DISCONNECTED", "CAMERA_RECONNECTED",
    "MICROPHONE_PERMISSION_DENIED", "MICROPHONE_DISCONNECTED", "MICROPHONE_RECONNECTED",
    "TAB_SWITCH", "WINDOW_BLUR", "WINDOW_FOCUS",
    "FULLSCREEN_EXIT", "FULLSCREEN_ENTER",
    "NETWORK_DISCONNECTED", "NETWORK_RECONNECTED",
    "PROCTORING_SOCKET_DISCONNECTED", "PROCTORING_SOCKET_RECONNECTED",
    "EXAM_STARTED", "EXAM_ENDED", "STREAM_STARTED", "STREAM_ENDED",
    "SCREEN_SHARE_STOPPED"
]);
const VALID_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

// ─── In-process buffers ──────────────────────────────────────────────────────
const socketBroadcastBuffer = new Map();
const dbWriteBuffer         = new Map();
const incidentCounters      = new Map(); // rate-limit fallback
let   intervalsStarted      = false;
let   proctoringNs          = null;

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
    info:  (...a) => console.log("[PROCTORING]",        ...a),
    warn:  (...a) => console.warn("[PROCTORING:WARN]",  ...a),
    error: (...a) => console.error("[PROCTORING:ERR]",  ...a),
    debug: (...a) => { if (!IS_PROD) console.log("[PROCTORING:DBG]", ...a); }
};

// ─── Redis helpers ────────────────────────────────────────────────────────────
const redisOK = () => redisClient?.isOpen;

const PRESENCE_KEY = (sid)   => `proctor:hb:${sid}`;
const GEN_KEY      = (sid)   => `proctor:gen:${sid}`;
const RL_KEY       = (sid)   => `proctor:rl:incident:${sid}`;

async function setPresence(sessionId, data) {
    if (!redisOK()) return;
    try {
        await redisClient.set(PRESENCE_KEY(sessionId), JSON.stringify(data), { EX: REDIS_HEARTBEAT_TTL_S });
    } catch(e) { log.debug("Redis presence set failed:", e.message); }
}

async function clearPresence(sessionId) {
    if (!redisOK()) return;
    try { await redisClient.del(PRESENCE_KEY(sessionId)); }
    catch(e) { log.debug("Redis presence del failed:", e.message); }
}

/**
 * Connection generation — prevents stale sockets from updating a session.
 * Each new socket that joins a session atomically increments a Redis counter
 * and receives a "generation" number.  Heartbeats/events are ignored if the
 * socket's generation does not match the current counter.
 *
 * Falls back to 0/0 (matching, so no false rejections) when Redis is down.
 */
async function claimGeneration(sessionId) {
    if (!redisOK()) return 0;
    try {
        const gen = await redisClient.incr(GEN_KEY(sessionId));
        await redisClient.expire(GEN_KEY(sessionId), 3600); // 1h safety TTL
        return gen;
    } catch { return 0; }
}

async function getCurrentGeneration(sessionId) {
    if (!redisOK()) return 0;
    try {
        const v = await redisClient.get(GEN_KEY(sessionId));
        return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
}

// ─── Incident rate limiter ───────────────────────────────────────────────────
async function checkIncidentRL(sessionId) {
    const key = RL_KEY(sessionId);
    if (redisOK()) {
        try {
            const count = await redisClient.incr(key);
            if (count === 1) await redisClient.expire(key, INCIDENT_RATE_LIMIT_WINDOW);
            return count <= INCIDENT_RATE_LIMIT_MAX;
        } catch(e) { log.debug("Redis RL failed, falling back to memory"); }
    }
    const now = Date.now();
    let entry = incidentCounters.get(sessionId);
    if (!entry || now - entry.windowStart > INCIDENT_RATE_LIMIT_WINDOW * 1000) {
        entry = { count: 0, windowStart: now };
        incidentCounters.set(sessionId, entry);
    }
    entry.count++;
    return entry.count <= INCIDENT_RATE_LIMIT_MAX;
}

// ─── Input validation helpers ────────────────────────────────────────────────
function validateEventPayload(data) {
    if (!data || typeof data !== "object") return null;
    const type = data.type;
    if (!type || !VALID_INCIDENT_TYPES.has(type)) return null;

    const rawSeverity = (data.severity || "MEDIUM").toString().toUpperCase();
    const severity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : "MEDIUM";

    const description = typeof data.description === "string"
        ? data.description.slice(0, 500)
        : "";
    const details = data.details && typeof data.details === "object"
        ? data.details
        : {};

    return { type, severity, description, details };
}



// ─── Main export ──────────────────────────────────────────────────────────────
export const setupProctoringSockets = (io) => {
    const ns = io.of("/proctoring");
    proctoringNs = ns;

    // ── Background timers (once per process) ─────────────────────────────────
    if (!intervalsStarted) {
        intervalsStarted = true;

        // Broadcast heartbeat batch to admins every 5s
        setInterval(() => {
            if (socketBroadcastBuffer.size === 0) return;

            const byExam   = {};
            const allBatch = [];

            for (const [, entry] of socketBroadcastBuffer) {
                allBatch.push(entry.payload);
                const eid = entry.examId;
                if (!byExam[eid]) byExam[eid] = [];
                byExam[eid].push(entry.payload);
            }

            ns.to("admin_all").emit("proctoring:heartbeat-batch", allBatch);
            for (const [eid, batch] of Object.entries(byExam)) {
                ns.to(`admin_exam_${eid}`).emit("proctoring:heartbeat-batch", batch);
            }
            socketBroadcastBuffer.clear();
        }, BROADCAST_INTERVAL_MS);

        // Flush heartbeat state to Mongo every 15s (bulkWrite)
        setInterval(async () => {
            if (dbWriteBuffer.size === 0) return;
            const entries = [...dbWriteBuffer.entries()];
            dbWriteBuffer.clear();

            const ops = entries.map(([sessionId, fields]) => ({
                updateOne: {
                    filter: { _id: sessionId, status: { $nin: [...TERMINAL_STATUSES] } },
                    update: { $set: fields }
                }
            }));

            try {
                if (ops.length) {
                    const r = await ProctoringSession.bulkWrite(ops, { ordered: false });
                    log.debug(`bulkWrite ${r.modifiedCount}/${ops.length}`);
                }
            } catch(e) {
                log.error("bulkWrite error:", e.message);
                // Re-enqueue entries that are not yet superseded
                for (const [sid, fields] of entries) {
                    if (!dbWriteBuffer.has(sid)) dbWriteBuffer.set(sid, fields);
                }
            }
        }, DB_FLUSH_INTERVAL_MS);

        // Cleanup in-memory RL counters every 60s
        setInterval(() => {
            const cutoff = Date.now() - INCIDENT_RATE_LIMIT_WINDOW * 1000 * 2;
            for (const [k, e] of incidentCounters) {
                if (e.windowStart < cutoff) incidentCounters.delete(k);
            }
        }, 60_000);
    }

    ns.use(authenticateWebSocket);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const broadcastToAdmins = (event, examId, data) => {
        ns.to("admin_all").emit(event, data);
        if (examId) ns.to(`admin_exam_${examId}`).emit(event, data);
    };

    // Route into the session room (works across replicas via Redis adapter)
    const emitToSession = (sessionId, event, data) => {
        ns.to(sessionId.toString()).emit(event, data);
    };

    // ── Connection ────────────────────────────────────────────────────────────
    ns.on("connection", (socket) => {
        const { user } = socket;
        log.debug(`connect ${user.role} ${user.id}`);

        // ================================================================
        // ADMIN EVENTS
        // ================================================================
        if (user.role === "Admin") {

            socket.on("proctoring:admin-join", ({ examId } = {}) => {
                // Leave all admin rooms and join the correct one
                for (const room of socket.rooms) {
                    if (room.startsWith("admin_")) socket.leave(room);
                }
                const room = (!examId || examId === "ALL") ? "admin_all" : `admin_exam_${examId}`;
                socket.join(room);
                log.debug(`Admin ${user.id} → ${room}`);
            });

            // ── WebRTC signaling (admin → student via session room) ───────
            // All events use sessionId. The server resolves the room.
            // The client never picks a target socket ID.

            socket.on("proctoring:request-stream", async ({ sessionId }) => {
                if (!sessionId) return;
                // Verify this session exists and is not ENDED
                try {
                    const s = await ProctoringSession.findById(sessionId)
                        .select("status studentId examId").lean();
                    if (!s || TERMINAL_STATUSES.has(s.status)) return;
                    // Route request into the student's session room
                    emitToSession(sessionId, "proctoring:stream-requested", {
                        adminSocketId: socket.id
                    });
                } catch(e) { log.error("request-stream error:", e.message); }
            });

            socket.on("proctoring:stop-monitoring", ({ sessionId }) => {
                if (!sessionId) return;
                emitToSession(sessionId, "proctoring:monitoring-stopped", {
                    adminSocketId: socket.id
                });
            });

            // Admin sends signaling from its local RTCPeerConnection
            socket.on("proctoring:offer", ({ sessionId, offer }) => {
                if (!sessionId || !offer) return;
                emitToSession(sessionId, "proctoring:offer", {
                    fromAdminSocketId: socket.id,
                    offer
                });
            });

            socket.on("proctoring:answer", ({ sessionId, answer }) => {
                if (!sessionId || !answer) return;
                emitToSession(sessionId, "proctoring:answer", {
                    fromAdminSocketId: socket.id,
                    answer
                });
            });

            socket.on("proctoring:ice-candidate", ({ sessionId, candidate }) => {
                if (!sessionId || !candidate) return;
                emitToSession(sessionId, "proctoring:ice-candidate", {
                    fromAdminSocketId: socket.id,
                    candidate
                });
            });

            socket.on("disconnect", () => log.debug(`Admin ${user.id} disconnected`));
        }

        // ================================================================
        // STUDENT EVENTS
        // ================================================================
        else if (user.role === "Student") {
            let currentSessionId = null;
            let currentExamId    = null;
            let myGeneration     = 0;  // connection generation for staleness guard
            let mediaPending     = false; // pending stream request when media not ready
            let pendingAdminSocketId = null;

            // ── Helper: guard stale sockets ──────────────────────────────
            const isCurrentGeneration = async () => {
                if (!currentSessionId) return false;
                if (myGeneration === 0) return true; // Redis unavailable fallback
                const current = await getCurrentGeneration(currentSessionId.toString());
                return current === myGeneration;
            };

            // ── proctoring:join ──────────────────────────────────────────
            socket.on("proctoring:join", async ({ examId }) => {
                if (!examId) return socket.emit("proctoring:error", { message: "examId required" });
                try {
                    // Atomic upsert: prevents duplicate sessions for same student+exam
                    const session = await ProctoringSession.findOneAndUpdate(
                        {
                            studentId: user.id,
                            examId,
                            status: { $in: ["INITIALIZING", "ACTIVE", "PAUSED", "DISCONNECTED"] }
                        },
                        {
                            $set: {
                                socketId:         socket.id,
                                status:           "ACTIVE",
                                connectionStatus: "ONLINE",
                                lastHeartbeat:    new Date()
                            },
                            $setOnInsert: {
                                studentId: user.id,
                                examId,
                                startedAt: new Date()
                            }
                        },
                        { upsert: true, returnDocument: 'after' }
                    );

                    currentSessionId = session._id;
                    currentExamId    = examId;

                    // Claim this connection generation
                    myGeneration = await claimGeneration(session._id.toString());

                    // Join session room for WebRTC routing
                    socket.join(session._id.toString());

                    await setPresence(session._id.toString(), {
                        sessionId:        session._id.toString(),
                        studentId:        user.id.toString(),
                        examId:           examId.toString(),
                        connectionStatus: "ONLINE",
                        lastHeartbeat:    Date.now()
                    });

                    broadcastToAdmins("proctoring:student-joined", examId, {
                        sessionId: session._id,
                        studentId: user.id,
                        examId
                    });

                    socket.emit("proctoring:session-ready", { sessionId: session._id });
                } catch(e) {
                    // Handle partial-index duplicate key race
                    if (e.code === 11000) {
                        log.warn(`Duplicate session race for student ${user.id}`);
                        const existing = await ProctoringSession.findOneAndUpdate(
                            { studentId: user.id, examId, status: { $in: ["INITIALIZING","ACTIVE","PAUSED","DISCONNECTED"] } },
                            { $set: { socketId: socket.id, status: "ACTIVE", connectionStatus: "ONLINE", lastHeartbeat: new Date() } },
                            { returnDocument: 'after' }
                        );
                        if (existing) {
                            currentSessionId = existing._id;
                            currentExamId    = examId;
                            myGeneration     = await claimGeneration(existing._id.toString());
                            socket.join(existing._id.toString());
                            socket.emit("proctoring:session-ready", { sessionId: existing._id });
                            return;
                        }
                    }
                    log.error("Join error:", e.message);
                    socket.emit("proctoring:error", { message: "Failed to join proctoring session" });
                }
            });

            // ── proctoring:heartbeat ────────────────────────────────────
            socket.on("proctoring:heartbeat", async (data) => {
                if (!currentSessionId || !currentExamId) return;

                // Staleness guard: only the most recent socket may update this session
                if (!(await isCurrentGeneration())) {
                    log.debug(`Stale heartbeat ignored for session ${currentSessionId}`);
                    return;
                }

                const sid = currentSessionId.toString();
                const now = new Date();

                const fields = {
                    lastHeartbeat:    now,
                    lastSeenAt:       now,
                    connectionStatus: "ONLINE"
                };
                if (data?.cameraStatus)     fields.cameraStatus     = data.cameraStatus;
                if (data?.microphoneStatus) fields.microphoneStatus = data.microphoneStatus;
                if (data?.fullscreenStatus) fields.fullscreenStatus = data.fullscreenStatus;

                // Merge into DB buffer (latest wins)
                const prev = dbWriteBuffer.get(sid);
                dbWriteBuffer.set(sid, prev ? { ...prev, ...fields } : fields);

                // Merge into broadcast buffer
                socketBroadcastBuffer.set(sid, {
                    examId: currentExamId.toString(),
                    payload: {
                        sessionId:        currentSessionId,
                        lastHeartbeat:    now,
                        cameraStatus:     fields.cameraStatus     || "UNKNOWN",
                        microphoneStatus: fields.microphoneStatus || "UNKNOWN",
                        fullscreenStatus: fields.fullscreenStatus || "UNKNOWN",
                        connectionStatus: "ONLINE"
                    }
                });

                // Update Redis presence (non-blocking)
                setPresence(sid, {
                    sessionId:        sid,
                    studentId:        user.id.toString(),
                    examId:           currentExamId.toString(),
                    connectionStatus: "ONLINE",
                    cameraStatus:     fields.cameraStatus,
                    microphoneStatus: fields.microphoneStatus,
                    fullscreenStatus: fields.fullscreenStatus,
                    lastHeartbeat:    now.getTime()
                });
            });

            // ── proctoring:status ───────────────────────────────────────
            // Immediate status push (camera/mic permission changes)
            socket.on("proctoring:status", async (data) => {
                if (!currentSessionId || !currentExamId) return;
                if (!(await isCurrentGeneration())) return;

                const fields = {};
                if (data?.cameraStatus)     fields.cameraStatus     = data.cameraStatus;
                if (data?.microphoneStatus) fields.microphoneStatus = data.microphoneStatus;
                if (!Object.keys(fields).length) return;

                const sid  = currentSessionId.toString();
                const prev = dbWriteBuffer.get(sid);
                dbWriteBuffer.set(sid, prev ? { ...prev, ...fields } : fields);

                broadcastToAdmins("proctoring:student-updated", currentExamId, {
                    sessionId: currentSessionId,
                    ...fields
                });
            });

            // ── proctoring:media-ready ──────────────────────────────────
            // Student notifies when local media is captured and ready.
            // If an admin had already requested a stream while media was
            // unavailable, we fulfil the pending request now.
            socket.on("proctoring:media-ready", () => {
                if (mediaPending && pendingAdminSocketId) {
                    log.debug(`Fulfilling pending stream request for ${currentSessionId}`);
                    socket.emit("proctoring:stream-requested", { adminSocketId: pendingAdminSocketId });
                    mediaPending       = false;
                    pendingAdminSocketId = null;
                }
            });

            // ── proctoring:stream-requested (server re-routes here) ─────
            // The server emits this to the student room; we relay it to
            // the student socket directly.  If media isn't ready, queue it.
            socket.on("proctoring:stream-not-ready", ({ adminSocketId }) => {
                // Student tells server its media isn't ready yet
                mediaPending         = true;
                pendingAdminSocketId = adminSocketId;
            });

            // ── proctoring:event ────────────────────────────────────────
            // Validated behavioural incident from the student.
            // Also runs through the AI detection pipeline for scoring.
            socket.on("proctoring:event", async (rawData) => {
                if (!currentSessionId || !currentExamId) return;
                if (!(await isCurrentGeneration())) return;

                const validated = validateEventPayload(rawData);
                if (!validated) {
                    log.debug(`Rejected invalid event payload from ${user.id}`);
                    return;
                }

                // Rate limit
                const allowed = await checkIncidentRL(currentSessionId.toString());
                if (!allowed) {
                    log.debug(`Rate-limited incident for session ${currentSessionId}`);
                    return;
                }

                try {
                    const { type, severity, description, details } = validated;

                    // 1. Durable incident record
                    const incident = await ProctoringIncident.create({
                        examId:             currentExamId,
                        studentId:          user.id,
                        proctoringSessionId: currentSessionId,
                        type,
                        severity,
                        metadata: details,
                        notes:    description
                    });

                    // 2. Session counters
                    const incUpd = { $inc: { incidentCount: 1 } };
                    if (type === "TAB_SWITCH")   incUpd.$inc.tabSwitchCount  = 1;
                    if (type === "WINDOW_BLUR")  incUpd.$inc.windowBlurCount = 1;
                    await ProctoringSession.findByIdAndUpdate(currentSessionId, incUpd);

                    // 3. AI pipeline — behavioural event → detection signals → suspicion score
                    const signals = await detectionService.analyze({
                        sessionId: currentSessionId.toString(),
                        studentId: user.id.toString(),
                        examId:    currentExamId.toString(),
                        source:    "behaviour",
                        payload:   { type, severity, ...details }
                    });

                    // 4. Process signals, update Redis AI state, get alerts
                    const { state, alerts } = await processSignals({
                        sessionId: currentSessionId.toString(),
                        studentId: user.id.toString(),
                        examId:    currentExamId.toString(),
                        signals
                    });

                    // 5. Persist durable AI events
                    if (signals.length) {
                        const aiDocs = signals.map(s => ({
                            sessionId:        currentSessionId,
                            examId:           currentExamId,
                            studentId:        user.id,
                            type:             s.type,
                            confidence:       s.confidence,
                            scoreContribution: computeScoreContribution(s.type, s.confidence),
                            modelVersion:     s.modelVersion,
                            metadata:         s.metadata
                        }));
                        await ProctoringAIEvent.insertMany(aiDocs, { ordered: false });
                    }

                    // 6. Immediate admin notifications
                    broadcastToAdmins("proctoring:incident", currentExamId, {
                        sessionId:  currentSessionId,
                        studentId:  user.id,
                        examId:     currentExamId,
                        incident
                    });

                    // 7. AI alerts (only for signals above threshold, deduplicated)
                    for (const alert of alerts) {
                        broadcastToAdmins("proctoring:ai-alert", currentExamId, alert);
                    }

                    // 8. AI state update broadcast (so admin suspicion list refreshes)
                    if (state) {
                        broadcastToAdmins("proctoring:ai-state-updated", currentExamId, {
                            sessionId: currentSessionId,
                            studentId: user.id,
                            score:     state.score,
                            level:     state.level,
                            lastEvent: state.lastEvent,
                            lastEventAt: state.lastEventAt
                        });
                    }

                } catch(e) {
                    log.error("Event processing error:", e.message);
                }
            });

            // ── WebRTC signaling (student → admin via session room) ──────
            // Student never picks a target socket ID.  It echoes the
            // adminSocketId that was given to it in "stream-requested".

            socket.on("proctoring:offer", ({ adminSocketId, offer, streamIds }) => {
                if (!currentSessionId || !adminSocketId || !offer) return;
                // Route directly to the admin socket (within the Redis adapter scope)
                ns.to(adminSocketId).emit("proctoring:offer", {
                    sessionId: currentSessionId,
                    studentId: user.id,
                    offer,
                    streamIds: streamIds || {}
                });
            });

            socket.on("proctoring:answer", ({ adminSocketId, answer }) => {
                if (!currentSessionId || !adminSocketId || !answer) return;
                ns.to(adminSocketId).emit("proctoring:answer", {
                    sessionId: currentSessionId,
                    answer
                });
            });

            socket.on("proctoring:ice-candidate", ({ adminSocketId, candidate }) => {
                if (!currentSessionId || !adminSocketId || !candidate) return;
                ns.to(adminSocketId).emit("proctoring:ice-candidate", {
                    sessionId: currentSessionId,
                    candidate
                });
            });

            // ── proctoring:leave ─────────────────────────────────────────
            socket.on("proctoring:leave", async () => {
                if (!currentSessionId) return;
                const sid = currentSessionId.toString();
                try {
                    dbWriteBuffer.delete(sid);
                    socketBroadcastBuffer.delete(sid);
                    incidentCounters.delete(sid);

                    await ProctoringSession.findByIdAndUpdate(currentSessionId, {
                        $set: { status: "ENDED", endedAt: new Date(), connectionStatus: "OFFLINE" }
                    });
                    await clearPresence(sid);
                    await clearAIState(sid);

                    broadcastToAdmins("proctoring:student-left", currentExamId, {
                        sessionId: currentSessionId,
                        studentId: user.id
                    });
                } catch(e) {
                    log.error("Leave error:", e.message);
                } finally {
                    currentSessionId = null;
                    currentExamId    = null;
                }
            });

            // ── disconnect ───────────────────────────────────────────────
            socket.on("disconnect", async () => {
                log.debug(`Student ${user.id} disconnected`);
                if (!currentSessionId) return;

                const sid = currentSessionId.toString();
                dbWriteBuffer.delete(sid);
                socketBroadcastBuffer.delete(sid);

                try {
                    await ProctoringSession.findOneAndUpdate(
                        { _id: currentSessionId, status: "ACTIVE" },
                        { $set: { status: "DISCONNECTED", connectionStatus: "OFFLINE" } }
                    );
                    await clearPresence(sid);

                    broadcastToAdmins("proctoring:student-updated", currentExamId, {
                        sessionId:        currentSessionId,
                        status:           "DISCONNECTED",
                        connectionStatus: "OFFLINE"
                    });
                } catch(e) {
                    log.error("Disconnect error:", e.message);
                }
            });
        }
    });
};

// ── Exported Server Actions ──────────────────────────────────────────────────
export const emitSessionTerminated = (sessionId, examId) => {
    if (proctoringNs) {
        proctoringNs.to(sessionId.toString()).emit("proctoring:terminated", { reason: "Terminated by proctor." });
        proctoringNs.in(sessionId.toString()).disconnectSockets(true);
        if (examId) {
            proctoringNs.to(`admin_exam_${examId.toString()}`).emit("proctoring:student-left", { sessionId: sessionId.toString() });
            proctoringNs.to(`admin_all`).emit("proctoring:student-left", { sessionId: sessionId.toString() });
        }
    }
};
