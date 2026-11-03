/**
 * Proctoring REST Controllers
 *
 * Endpoint surface:
 *   GET  /api/admin/proctoring/live                      — lightweight live-student metadata
 *   GET  /api/admin/proctoring/alerts                    — current AI-alert / suspicious students
 *   GET  /api/admin/proctoring/sessions                  — paginated session list
 *   GET  /api/admin/proctoring/sessions/:sessionId       — single session detail
 *   GET  /api/admin/proctoring/sessions/:sessionId/incidents  — paginated incidents
 *   GET  /api/admin/proctoring/sessions/:sessionId/ai-events  — paginated AI events
 *   GET  /api/admin/proctoring/active-exams              — exams with live sessions
 *   POST /api/admin/proctoring/sessions/:sessionId/end   — admin manual end
 *
 * State ownership:
 *   - Redis:  proctor:hb:<sessionId>  (presence — read-only here)
 *             proctor:ai:<sessionId>  (suspicion — read-only here)
 *   - Mongo:  ProctoringSession, ProctoringIncident, ProctoringAIEvent
 */

import mongoose from "mongoose";
import { ProctoringSession }  from "../models/proctoringSession.models.js";
import { ProctoringIncident } from "../models/proctoringIncident.models.js";
import { ProctoringAIEvent }  from "../models/proctoringAIEvent.models.js";
import { Exam }               from "../models/exam.models.js";
import redisClient            from "../redis/index.js";
import { clearAIState }       from "../Services/proctoring/suspicion.scorer.js";
import { emitSessionTerminated } from "../sockets/proctoring.socket.js";
import { Result }             from "../models/result.models.js";
import { AuditLog }           from "../models/auditlog.models.js";

const isValidOId = (id) => mongoose.Types.ObjectId.isValid(id);
const redisOK    = ()   => redisClient?.isOpen;

// ─── Limits ──────────────────────────────────────────────────────────────────
const MAX_LIMIT           = 200;
const DEFAULT_LIMIT       = 50;
const MAX_INCIDENTS_LIMIT = 100;

const clamp = (v, min, max) => Math.max(min, Math.min(max, parseInt(v) || min));

// ─── Redis helpers (read-only) ────────────────────────────────────────────────
async function getPresence(sessionId) {
    if (!redisOK()) return null;
    try {
        const raw = await redisClient.get(`proctor:hb:${sessionId}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function getAISuspicion(sessionId) {
    if (!redisOK()) return null;
    try {
        const raw = await redisClient.get(`proctor:ai:${sessionId}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// Enrich a session document with live presence / suspicion data from Redis
async function enrichSession(session) {
    const sid = session._id.toString();
    const [presence, aiState] = await Promise.all([
        getPresence(sid),
        getAISuspicion(sid)
    ]);

    // Derive connection status from Redis (authoritative) or heartbeat age
    let connectionStatus = session.connectionStatus;
    if (presence?.lastHeartbeat) {
        const age = Date.now() - presence.lastHeartbeat;
        if (age < 15_000)       connectionStatus = "ONLINE";
        else if (age < 30_000)  connectionStatus = "UNSTABLE";
        else                    connectionStatus = "OFFLINE";
    } else if (session.status === "ACTIVE" && session.lastHeartbeat) {
        const age = Date.now() - new Date(session.lastHeartbeat).getTime();
        if (age < 15_000)       connectionStatus = "ONLINE";
        else if (age < 30_000)  connectionStatus = "UNSTABLE";
        else                    connectionStatus = "OFFLINE";
    }

    return {
        ...session,
        connectionStatus,
        aiSuspicion: aiState
            ? { score: aiState.score, level: aiState.level, lastEvent: aiState.lastEvent, lastEventAt: aiState.lastEventAt }
            : { score: 0, level: "NORMAL", lastEvent: null, lastEventAt: null }
    };
}

// ─── GET /api/admin/proctoring/live ──────────────────────────────────────────
/**
 * Lightweight metadata for all live students.
 * Returns NO MediaStream data.  Paginated.
 */
export const getLiveStudents = async (req, res) => {
    try {
        const { examId, page = 1, limit: rawLimit = DEFAULT_LIMIT } = req.query;
        const limit = clamp(rawLimit, 1, MAX_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = { status: { $in: ["ACTIVE", "PAUSED"] } };
        if (examId && isValidOId(examId)) filter.examId = examId;

        const [sessions, total] = await Promise.all([
            ProctoringSession.find(filter)
                .select("studentId examId status connectionStatus cameraStatus microphoneStatus fullscreenStatus lastHeartbeat incidentCount tabSwitchCount windowBlurCount startedAt socketId")
                .populate("studentId", "name email studentId department batch")
                .populate("examId",    "title subject")
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringSession.countDocuments(filter)
        ]);

        let enriched = await Promise.all(sessions.map(enrichSession));
        
        // Exclude sessions that are offline to avoid ghosting in the UI
        enriched = enriched.filter(s => s.connectionStatus !== "OFFLINE");

        res.json({
            sessions: enriched,
            pagination: { total, visibleCount: enriched.length, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) }
        });
    } catch(e) {
        console.error("[PROCTORING] getLiveStudents:", e.message);
        res.status(500).json({ message: "Failed to fetch live students" });
    }
};

// ─── GET /api/admin/proctoring/alerts ────────────────────────────────────────
/**
 * Students whose AI suspicion score is above the MONITOR threshold.
 * Primary source: Redis.  Falls back to a Mongo aggregate over ProctoringAIEvent.
 * Paginated.
 */
export const getSuspiciousAlerts = async (req, res) => {
    try {
        const { examId, level, page = 1, limit: rawLimit = 50 } = req.query;
        const limit = clamp(rawLimit, 1, 100);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const sessionFilter = { status: { $in: ["INITIALIZING", "ACTIVE", "PAUSED"] } };
        if (examId && isValidOId(examId)) sessionFilter.examId = examId;

        // Get recent AI events aggregated per session
        const aiFilter = { reviewStatus: "PENDING" };
        if (examId && isValidOId(examId)) aiFilter.examId = new mongoose.Types.ObjectId(examId);

        const recentCutoff = new Date(Date.now() - 30 * 60_000); // last 30 min

        const aggregated = await ProctoringAIEvent.aggregate([
            { $match: { ...aiFilter, createdAt: { $gte: recentCutoff } } },
            { $sort:  { createdAt: -1 } },
            {
                $group: {
                    _id:              "$sessionId",
                    studentId:        { $first: "$studentId" },
                    examId:           { $first: "$examId" },
                    latestType:       { $first: "$type" },
                    latestConfidence: { $first: "$confidence" },
                    totalScore:       { $sum: "$scoreContribution" },
                    eventCount:       { $sum: 1 },
                    latestAt:         { $first: "$createdAt" },
                    signals:          { $push: { type: "$type", confidence: "$confidence", at: "$createdAt" } }
                }
            },
            { $sort: { totalScore: -1 } },
            { $skip:  skip },
            { $limit: limit }
        ]);

        // Populate student and exam references
        const sessionIds = aggregated.map(a => a._id);
        const sessions   = await ProctoringSession.find({ _id: { $in: sessionIds }, status: { $ne: "ENDED" } })
            .select("status connectionStatus lastHeartbeat")
            .populate("studentId", "name email studentId")
            .populate("examId",    "title subject")
            .lean();

        const sessionMap = {};
        sessions.forEach(s => { sessionMap[s._id.toString()] = s; });

        const alerts = aggregated
            .filter(a => sessionMap[a._id.toString()])
            .map(a => {
            const session = sessionMap[a._id.toString()];
            return {
                sessionId:        a._id,
                studentId:        session.studentId || a.studentId,
                examId:           session.examId    || a.examId,
                score:            Math.min(a.totalScore, 100),
                level:            a.totalScore >= 70 ? "HIGH"
                                : a.totalScore >= 45 ? "SUSPICIOUS"
                                : a.totalScore >= 20 ? "MONITOR" : "NORMAL",
                latestSignal:     a.latestType,
                confidence:       a.latestConfidence,
                eventCount:       a.eventCount,
                latestAt:         a.latestAt,
                signals:          a.signals.slice(0, 5),
                connectionStatus: session.connectionStatus || "UNKNOWN",
                sessionStatus:    session.status            || "UNKNOWN"
            };
        });

        const filtered = level ? alerts.filter(a => a.level === level.toUpperCase()) : alerts;

        res.json({ alerts: filtered, pagination: { page: parseInt(page), limit } });
    } catch(e) {
        console.error("[PROCTORING] getSuspiciousAlerts:", e.message);
        res.status(500).json({ message: "Failed to fetch alerts" });
    }
};

// ─── GET /api/admin/proctoring/sessions ──────────────────────────────────────
export const getActiveSessions = async (req, res) => {
    try {
        const { examId, status, page = 1, limit: rawLimit = DEFAULT_LIMIT } = req.query;
        const limit = clamp(rawLimit, 1, MAX_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = {};
        if (examId && isValidOId(examId))  filter.examId = examId;
        if (status) {
            filter.status = status;
        } else {
            filter.status = { $in: ["INITIALIZING", "ACTIVE", "PAUSED", "DISCONNECTED"] };
        }

        const [sessions, total] = await Promise.all([
            ProctoringSession.find(filter)
                .populate("studentId", "name email studentId department batch")
                .populate("examId",    "title subject status")
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringSession.countDocuments(filter)
        ]);

        const enriched = await Promise.all(sessions.map(enrichSession));

        const summary = {
            total:           total,
            online:          enriched.filter(s => s.connectionStatus === "ONLINE").length,
            unstable:        enriched.filter(s => s.connectionStatus === "UNSTABLE").length,
            offline:         enriched.filter(s => s.connectionStatus === "OFFLINE").length,
            pendingIncidents: await ProctoringIncident.countDocuments({
                reviewStatus: "PENDING_REVIEW",
                ...(examId && isValidOId(examId) ? { examId } : {})
            })
        };

        res.json({ sessions: enriched, summary, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getActiveSessions:", e.message);
        res.status(500).json({ message: "Failed to fetch sessions" });
    }
};

// ─── GET /api/admin/proctoring/sessions/:sessionId ───────────────────────────
export const getSessionDetail = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!isValidOId(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

        const session = await ProctoringSession.findById(sessionId)
            .populate("studentId", "name email studentId department batch")
            .populate("examId",    "title subject status durationMinutes")
            .lean();

        if (!session) return res.status(404).json({ message: "Session not found" });

        const enriched  = await enrichSession(session);
        const aiSuspicion = await getAISuspicion(sessionId);

        res.json({ session: { ...enriched, aiSuspicion } });
    } catch(e) {
        console.error("[PROCTORING] getSessionDetail:", e.message);
        res.status(500).json({ message: "Failed to fetch session detail" });
    }
};

// ─── GET /api/admin/proctoring/sessions/:sessionId/incidents ─────────────────
export const getSessionIncidents = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!isValidOId(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

        const { page = 1, limit: rawLimit = 50, type, severity, reviewStatus } = req.query;
        const limit = clamp(rawLimit, 1, MAX_INCIDENTS_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = { proctoringSessionId: sessionId };
        if (type)         filter.type         = type;
        if (severity)     filter.severity     = severity.toUpperCase();
        if (reviewStatus) filter.reviewStatus = reviewStatus;

        const [incidents, total] = await Promise.all([
            ProctoringIncident.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringIncident.countDocuments(filter)
        ]);

        res.json({ incidents, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getSessionIncidents:", e.message);
        res.status(500).json({ message: "Failed to fetch incidents" });
    }
};

// ─── GET /api/admin/proctoring/sessions/:sessionId/ai-events ─────────────────
export const getSessionAIEvents = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!isValidOId(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

        const { page = 1, limit: rawLimit = 50, type, reviewStatus } = req.query;
        const limit = clamp(rawLimit, 1, MAX_INCIDENTS_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = { sessionId };
        if (type)         filter.type         = type;
        if (reviewStatus) filter.reviewStatus = reviewStatus;

        const [events, total] = await Promise.all([
            ProctoringAIEvent.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringAIEvent.countDocuments(filter)
        ]);

        res.json({ events, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getSessionAIEvents:", e.message);
        res.status(500).json({ message: "Failed to fetch AI events" });
    }
};

// ─── GET /api/admin/proctoring/active-exams ──────────────────────────────────
export const getActiveExams = async (req, res) => {
    try {
        const threshold = new Date(Date.now() - 30_000);
        const examCounts = await ProctoringSession.aggregate([
            { $match: { 
                status: { $in: ["INITIALIZING", "ACTIVE", "PAUSED"] },
                $or: [
                    { lastHeartbeat: { $gte: threshold } },
                    { lastHeartbeat: { $exists: false } },
                    { lastHeartbeat: null }
                ]
            } },
            { $group: { _id: "$examId", count: { $sum: 1 } } }
        ]);

        const activeExamIds = examCounts.map(e => e._id);
        const exams = await Exam.find({ _id: { $in: activeExamIds } })
            .select("title subject status scheduledAt")
            .lean();

        const countMap = {};
        examCounts.forEach(e => { countMap[e._id.toString()] = e.count; });

        res.json({
            exams: exams.map(ex => ({
                ...ex,
                activeStudentCount: countMap[ex._id.toString()] || 0
            }))
        });
    } catch(e) {
        console.error("[PROCTORING] getActiveExams:", e.message);
        res.status(500).json({ message: "Failed to fetch active exams" });
    }
};

// ─── GET /api/admin/proctoring/students/:studentId/incidents (legacy) ─────────
export const getStudentIncidents = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidOId(studentId)) return res.status(400).json({ message: "Invalid student ID" });

        const { examId, sessionId, page = 1, limit: rawLimit = 50 } = req.query;
        const limit = clamp(rawLimit, 1, MAX_INCIDENTS_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = { studentId };
        if (examId    && isValidOId(examId))    filter.examId             = examId;
        if (sessionId && isValidOId(sessionId)) filter.proctoringSessionId = sessionId;

        const [incidents, total] = await Promise.all([
            ProctoringIncident.find(filter)
                .populate("examId",               "title subject")
                .populate("proctoringSessionId",  "status startedAt endedAt")
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringIncident.countDocuments(filter)
        ]);

        res.json({ incidents, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getStudentIncidents:", e.message);
        res.status(500).json({ message: "Failed to fetch student incidents" });
    }
};

// ─── GET /api/admin/proctoring/incidents (global) ────────────────────────────
export const getAllIncidents = async (req, res) => {
    try {
        const { examId, reviewStatus, severity, type, page = 1, limit: rawLimit = DEFAULT_LIMIT } = req.query;
        const limit = clamp(rawLimit, 1, MAX_INCIDENTS_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const filter = {};
        if (examId        && isValidOId(examId)) filter.examId       = examId;
        if (reviewStatus) filter.reviewStatus = reviewStatus;
        if (severity)     filter.severity     = severity.toUpperCase();
        if (type)         filter.type         = type;

        const [incidents, total] = await Promise.all([
            ProctoringIncident.find(filter)
                .populate("studentId", "name email studentId")
                .populate("examId",    "title subject")
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringIncident.countDocuments(filter)
        ]);

        res.json({ incidents, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getAllIncidents:", e.message);
        res.status(500).json({ message: "Failed to fetch incidents" });
    }
};

// ─── POST /api/admin/proctoring/sessions/:sessionId/end ──────────────────────
export const endSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!isValidOId(sessionId)) return res.status(400).json({ message: "Invalid session ID" });

        const session = await ProctoringSession.findById(sessionId);
        if (!session)             return res.status(404).json({ message: "Session not found" });
        if (session.status === "ENDED") return res.status(409).json({ message: "Session already ended" });

        session.status           = "ENDED";
        session.endedAt          = new Date();
        session.connectionStatus = "OFFLINE";
        await session.save();

        // Terminate the exam Result so the student can't retake it
        try {
            const result = await Result.findOne({
                student: session.studentId,
                exam: session.examId,
                status: "InProgress"
            });
            if (result) {
                result.status = "Terminated";
                result.isTerminated = true;
                result.terminationReason = "Terminated by proctor.";
                await result.save();
            }
        } catch(e) {
            console.error("[PROCTORING] Failed to terminate result document:", e.message);
        }

        // Emit socket event to instantly lock out the student
        emitSessionTerminated(sessionId, session.examId);

        // Clear Redis presence and AI state
        try {
            if (redisOK()) {
                await Promise.all([
                    redisClient.del(`proctor:hb:${sessionId}`),
                    clearAIState(sessionId)
                ]);
            }
        } catch { /* non-critical */ }

        // Write AuditLog
        try {
            await AuditLog.create({
                actor: req.admin?.email || "Unknown Admin",
                actorRole: req.admin ? "Admin" : "System",
                action: "STUDENT_SESSION_TERMINATED",
                targetType: "Student",
                targetId: session.studentId.toString(),
                targetLabel: session.studentId.toString(),
                details: `Admin terminated proctoring session for student ID ${session.studentId} on exam ${session.examId}`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[PROCTORING] Failed to write AuditLog for termination:", auditErr.message);
        }

        res.json({ message: "Session ended successfully", session });
    } catch(e) {
        console.error("[PROCTORING] endSession:", e.message);
        res.status(500).json({ message: "Failed to end session" });
    }
};

// ─── Legacy: exam-scoped sessions ────────────────────────────────────────────
export const getExamSessions = async (req, res) => {
    try {
        const { examId } = req.params;
        if (!isValidOId(examId)) return res.status(400).json({ message: "Invalid exam ID" });

        const { page = 1, limit: rawLimit = DEFAULT_LIMIT } = req.query;
        const limit = clamp(rawLimit, 1, MAX_LIMIT);
        const skip  = (clamp(page, 1, 9999) - 1) * limit;

        const [sessions, total] = await Promise.all([
            ProctoringSession.find({ examId })
                .populate("studentId", "name email studentId department batch")
                .populate("examId",    "title subject status")
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ProctoringSession.countDocuments({ examId })
        ]);

        res.json({ sessions, pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) } });
    } catch(e) {
        console.error("[PROCTORING] getExamSessions:", e.message);
        res.status(500).json({ message: "Failed to fetch exam sessions" });
    }
};
