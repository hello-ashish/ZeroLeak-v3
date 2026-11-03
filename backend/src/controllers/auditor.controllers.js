import { Auditor } from "../models/auditor.models.js";
import { AuditLog } from "../models/auditlog.models.js";
import { Anomaly } from "../models/anomaly.models.js";
import { Exam } from "../models/exam.models.js";
import { Student } from "../models/student.models.js";
import { Professor } from "../models/professor.models.js";
import { Result } from "../models/result.models.js";
import { CheatingIncident } from "../models/cheatingIncident.models.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import mongoose from "mongoose";

// ─── Register Auditor (For setup) ─────────────────────────────────────────────
export const registerAuditor = async (req, res) => {
    try {
        const { auditorId, email, password, name } = req.body;
        if (!auditorId || !email || !password || !name) {
            return res.status(400).json({ message: "auditorId, name, email, and password are required" });
        }
        const existing = await Auditor.findOne({ $or: [{ auditorId }, { email }] });
        if (existing) {
            return res.status(400).json({ message: "Auditor already exists" });
        }
        const auditor = await Auditor.create({ auditorId, email, password, name });
        const created = await Auditor.findById(auditor._id).select("-password");
        return res.status(201).json({ message: "Auditor registered successfully", auditor: created });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Login Auditor ────────────────────────────────────────────────────────────
export const loginAuditor = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const auditor = await Auditor.findOne({ email });
        if (!auditor) return res.status(401).json({ message: "Invalid email or password" });

        const isPasswordCorrect = await auditor.isPasswordCorrect(password);
        if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid credentials" });

        const forceLogout = req.body.forceLogout === true || req.body.forceLogout === "true";
        if (auditor.isLoggedIn && !forceLogout) {
            return res.status(409).json({ message: "You're logged in at some other place too. Wish to continue?", code: "ALREADY_LOGGED_IN" });
        }

        auditor.isLoggedIn = true;
        auditor.lastActiveAt = new Date();
        auditor.sessionVersion = (auditor.sessionVersion || 0) + 1;
        await auditor.save({ validateBeforeSave: false });

        const token = auditor.generateAccessToken();
        const loggedIn = auditor.toObject();
        delete loggedIn.password;

        await AuditLog.create({
            actor: email,
            actorRole: "System",
            action: "AUDITOR_LOGIN",
            targetType: "Auditor",
            targetId: auditor._id,
            targetLabel: email
        });

        return res.status(200).json({ message: "Login successful", token, auditor: loggedIn });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const logoutAuditor = async (req, res) => {
    try {
        const auditor = await Auditor.findById(req.auditor._id);
        if (auditor) {
            auditor.isLoggedIn = false;
            auditor.sessionVersion = (auditor.sessionVersion || 0) + 1;
            await auditor.save({ validateBeforeSave: false });

            try {
                await AuditLog.create({
                    actor: auditor.email,
                    actorRole: "Auditor",
                    action: "AUDITOR_LOGOUT",
                    targetType: "Auditor",
                    targetId: String(auditor._id),
                    targetLabel: auditor.name || auditor.email,
                    status: "success"
                });
            } catch (auditErr) {
                console.error("[AUDITOR] AuditLog error on logout:", auditErr.message);
            }
        }
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        return res.status(500).json({ message: "Error logging out", error: error.message });
    }
};

export const updateAuditorProfile = async (req, res) => {
    try {
        const { name, password, newPassword } = req.body;
        const auditor = await Auditor.findById(req.auditor?._id || req.user?._id); // verifyAuditorJWT sets req.auditor; verifyAnyJWT sets req.user
        if (!auditor) return res.status(404).json({ message: "Auditor not found" });

        if (password && newPassword) {
            const isMatch = await auditor.isPasswordCorrect(password);
            if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });
            auditor.password = newPassword;
        }

        if (name) auditor.name = name;
        await auditor.save();
        
        const updated = auditor.toObject();
        delete updated.password;
        return res.status(200).json({ message: "Profile updated successfully", auditor: updated });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Get Dashboard Metrics ──────────────────────────────────────────────────
export const getDashboardMetrics = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [totalAuditLogs, totalCheatingIncidents, highRiskLogs, highRiskIncidents, openAnomalies, pendingIncidents, recentLogs, recentIncidents, auditTrend, cheatingTrend] = await Promise.all([
            AuditLog.countDocuments(),
            CheatingIncident.countDocuments(),
            AuditLog.countDocuments({ action: { $in: ["ADMIN_LOGIN", "BATCH_REJECTED", "EXAM_DELETED", "STUDENT_DELETED", "PROFESSOR_DELETED", "EXAM_ATTEMPT_TERMINATED"] } }),
            CheatingIncident.countDocuments({ severity: { $in: ["High", "Critical"] } }),
            Anomaly.countDocuments({ status: { $in: ["Open", "Under Review"] } }),
            CheatingIncident.countDocuments({ reviewStatus: "Pending" }),
            AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
            CheatingIncident.find().populate("studentId", "name email").populate("examId", "title").sort({ createdAt: -1 }).limit(10).lean(),
            // Aggregate daily counts instead of fetching full documents
            AuditLog.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }
            ]),
            CheatingIncident.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$detectedAt", "$createdAt"] } } }, count: { $sum: 1 } } }
            ])
        ]);

        const loggingStatus = mongoose.connection.readyState === 1 ? "Operational" : "Degraded";

        const totalEvents = totalAuditLogs + totalCheatingIncidents;
        const highRiskEvents = highRiskLogs + highRiskIncidents;
        const unresolvedAnomalies = openAnomalies + pendingIncidents;

        // Build trend map from aggregated counts
        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            trendMap[dateStr] = { date: dateStr, count: 0 };
        }

        auditTrend.forEach(t => {
            if (trendMap[t._id]) trendMap[t._id].count += t.count;
        });
        cheatingTrend.forEach(t => {
            if (trendMap[t._id]) trendMap[t._id].count += t.count;
        });

        const activityTrend = Object.values(trendMap);

        // Format recent combined logs
        const combinedLogs = [
            ...recentLogs.map(l => ({
                _id: l._id,
                action: l.action,
                actor: l.actor,
                createdAt: l.createdAt,
                type: "AuditLog"
            })),
            ...recentIncidents.map(i => ({
                _id: i._id,
                action: `CHEATING_${i.violationType}`,
                actor: i.studentId?.email || "Student",
                createdAt: i.detectedAt || i.createdAt,
                type: "CheatingIncident"
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

        return res.status(200).json({
            metrics: {
                totalEvents,
                highRiskEvents,
                openAnomalies: unresolvedAnomalies,
                loggingStatus,
                cheatingIncidentsCount: totalCheatingIncidents
            },
            recentLogs: combinedLogs,
            activityTrend
        });
    } catch (error) {
        console.error("Error fetching auditor metrics:", error);
        return res.status(500).json({ message: "Error fetching dashboard metrics" });
    }
};

// ─── Get Audit Logs (Explorer) ──────────────────────────────────────────────
export const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, action, actor, sort = "-createdAt" } = req.query;
        let query = {};
        if (action) query.action = { $regex: action, $options: "i" };
        if (actor) query.actor = { $regex: actor, $options: "i" };

        const logs = await AuditLog.find(query)
            .sort(sort)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await AuditLog.countDocuments(query);

        return res.status(200).json({ logs, total });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching logs" });
    }
};

// ─── Get Anomalies ──────────────────────────────────────────────────────────
export const getAnomalies = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = status ? { status } : {};
        const skip = (Number(page) - 1) * Number(limit);

        const total = await Anomaly.countDocuments(query);
        const anomalies = await Anomaly.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("relatedEvents")
            .lean();

        return res.status(200).json({ 
            anomalies,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching anomalies" });
    }
};

// ─── Update Anomaly Status ──────────────────────────────────────────────────
export const updateAnomalyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;

        const anomaly = await Anomaly.findById(id);
        if (!anomaly) return res.status(404).json({ message: "Anomaly not found" });

        if (status) anomaly.status = status;
        if (note) {
            anomaly.notes.push({ text: note, addedBy: req.auditor.email });
        }

        await anomaly.save();

        await AuditLog.create({
            actor: req.auditor.email,
            actorRole: "System",
            action: "ANOMALY_UPDATED",
            targetType: "Anomaly",
            targetId: anomaly._id,
            targetLabel: anomaly.rule,
            details: `Status changed to ${status}`
        });

        return res.status(200).json({ message: "Anomaly updated", anomaly });
    } catch (error) {
        return res.status(500).json({ message: "Error updating anomaly" });
    }
};

// ─── Run Anomaly Scan (Triggered by Auditor manually or via cron) ───────────
export const scanAnomalies = async (req, res) => {
    try {
        // Detect rule 1: Detect if an exam was deleted.
        const deletedExamsLogs = await AuditLog.find({ action: "EXAM_DELETED" }).lean();
        if (deletedExamsLogs.length > 0) {
            const targetIds = deletedExamsLogs.map(log => log.targetId);
            const existing = await Anomaly.find({ targetId: { $in: targetIds }, rule: "Exam Deleted" }).select("targetId").lean();
            const existingIds = new Set(existing.map(e => e.targetId));
            
            const toInsert = deletedExamsLogs
                .filter(log => !existingIds.has(log.targetId))
                .map(log => ({
                    rule: "Exam Deleted",
                    description: `An exam (${log.targetLabel}) was deleted by ${log.actor}.`,
                    severity: "High",
                    category: "Content Changes",
                    targetType: "Exam",
                    targetId: log.targetId,
                    actor: log.actor,
                    relatedEvents: [log._id]
                }));
                
            if (toInsert.length > 0) await Anomaly.insertMany(toInsert);
        }

        // Another rule: Batch Rejected
        const rejectedBatchesLogs = await AuditLog.find({ action: "BATCH_REJECTED" }).lean();
        if (rejectedBatchesLogs.length > 0) {
            const targetIds = rejectedBatchesLogs.map(log => log.targetId);
            const existing = await Anomaly.find({ targetId: { $in: targetIds }, rule: "Batch Rejected" }).select("targetId").lean();
            const existingIds = new Set(existing.map(e => e.targetId));

            const toInsert = rejectedBatchesLogs
                .filter(log => !existingIds.has(log.targetId))
                .map(log => ({
                    rule: "Batch Rejected",
                    description: `A batch of questions (${log.targetLabel}) was rejected by ${log.actor}.`,
                    severity: "Medium",
                    category: "Batch Operations",
                    targetType: "Batch",
                    targetId: log.targetId,
                    actor: log.actor,
                    relatedEvents: [log._id]
                }));

            if (toInsert.length > 0) await Anomaly.insertMany(toInsert);
        }

        // Rule 3: Critical Identity Deletion
        const identityDeletionLogs = await AuditLog.find({ action: { $in: ["STUDENT_DELETED", "PROFESSOR_DELETED"] } }).lean();
        if (identityDeletionLogs.length > 0) {
            const targetIds = identityDeletionLogs.map(log => log.targetId);
            const existing = await Anomaly.find({ targetId: { $in: targetIds }, rule: "Critical Identity Deletion" }).select("targetId").lean();
            const existingIds = new Set(existing.map(e => e.targetId));

            const toInsert = identityDeletionLogs
                .filter(log => !existingIds.has(log.targetId))
                .map(log => {
                    const role = log.action === "STUDENT_DELETED" ? "Student" : "Professor";
                    return {
                        rule: "Critical Identity Deletion",
                        description: `A ${role} account (${log.targetLabel}) was deleted by ${log.actor}.`,
                        severity: "High",
                        category: "Access & Identity",
                        targetType: role,
                        targetId: log.targetId,
                        actor: log.actor,
                        relatedEvents: [log._id]
                    };
                });

            if (toInsert.length > 0) await Anomaly.insertMany(toInsert);
        }

        // Rule 4: Perfect Score Anomaly (Flagged for Review)
        const perfectResults = await Result.find({ $expr: { $eq: ["$score", "$totalQuestions"] } }).populate('student exam').lean();
        if (perfectResults.length > 0) {
            const resultIds = perfectResults.map(r => r._id);
            const existing = await Anomaly.find({ "relatedEvents.0": { $in: resultIds }, rule: "Perfect Score Anomaly" }).select("relatedEvents").lean();
            const existingResultIds = new Set(existing.map(e => String(e.relatedEvents[0])));

            const toInsert = perfectResults
                .filter(result => result.student && result.exam && !existingResultIds.has(String(result._id)))
                .map(result => ({
                    rule: "Perfect Score Anomaly",
                    description: `Student ${result.student.name} achieved a perfect score on ${result.exam.title}. Flagged for routine review.`,
                    severity: "Low",
                    category: "Academic Integrity",
                    targetType: "Student",
                    targetId: result.student._id,
                    actor: "System",
                    relatedEvents: [result._id]
                }));

            if (toInsert.length > 0) await Anomaly.insertMany(toInsert);
        }

        // Rules 5 & 6: Mass Failure and Probable Exam Leak
        const examStats = await Result.aggregate([
            {
                $group: {
                    _id: "$exam",
                    totalSubmissions: { $sum: 1 },
                    perfectScores: { $sum: { $cond: [{ $eq: ["$score", "$totalQuestions"] }, 1, 0] } },
                    passes: { $sum: { $cond: [{ $gte: [{ $divide: ["$score", "$totalQuestions"] }, 0.5] }, 1, 0] } }
                }
            }
        ]);

        for (const stat of examStats) {
            if (stat.totalSubmissions >= 5) {
                const passRate = stat.passes / stat.totalSubmissions;
                const perfectRate = stat.perfectScores / stat.totalSubmissions;
                const examObj = await Exam.findById(stat._id);
                if (!examObj) continue;

                if (passRate < 0.2) {
                    const exists = await Anomaly.findOne({ targetId: stat._id, rule: "Mass Failure Detected" });
                    if (!exists) {
                        await Anomaly.create({
                            rule: "Mass Failure Detected",
                            description: `Exam '${examObj.title}' has an unusually low pass rate (${Math.round(passRate * 100)}%). Indicates flawed or excessively difficult questions.`,
                            severity: "High",
                            category: "Academic Integrity",
                            targetType: "Exam",
                            targetId: stat._id,
                            actor: "System",
                            relatedEvents: []
                        });
                    }
                }

                if (perfectRate > 0.3) {
                    const exists = await Anomaly.findOne({ targetId: stat._id, rule: "Probable Exam Leak" });
                    if (!exists) {
                        await Anomaly.create({
                            rule: "Probable Exam Leak",
                            description: `Exam '${examObj.title}' has an unusually high perfect score rate (${Math.round(perfectRate * 100)}%). Strongly indicates a compromised exam.`,
                            severity: "Critical",
                            category: "Academic Integrity",
                            targetType: "Exam",
                            targetId: stat._id,
                            actor: "System",
                            relatedEvents: []
                        });
                    }
                }
            }
        }

        // Rule 7: Suspicious Admin Activity
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const suspiciousAdminActivity = await AuditLog.aggregate([
            { $match: { actorRole: "Admin", action: { $in: ["STUDENT_DELETED", "PROFESSOR_DELETED", "EXAM_DELETED", "BATCH_REJECTED"] }, createdAt: { $gte: oneDayAgo } } },
            { $group: { _id: "$actor", count: { $sum: 1 }, events: { $push: "$_id" } } }
        ]);

        for (const activity of suspiciousAdminActivity) {
            if (activity.count >= 3) {
                const exists = await Anomaly.findOne({ actor: activity._id, rule: "Suspicious Admin Activity" });
                if (!exists) {
                    await Anomaly.create({
                        rule: "Suspicious Admin Activity",
                        description: `Admin ${activity._id} performed ${activity.count} destructive actions in the last 24 hours. Investigate for potential account compromise.`,
                        severity: "High",
                        category: "Access & Identity",
                        targetType: "Admin",
                        targetId: activity._id,
                        actor: activity._id,
                        relatedEvents: activity.events
                    });
                }
            }
        }

        return res.status(200).json({ message: "Anomaly scan completed." });
    } catch (error) {
        return res.status(500).json({ message: "Error scanning for anomalies" });
    }
};

// ─── Get Read-Only Data ─────────────────────────────────────────────────────
export const getExams = async (req, res) => {
    try {
        const exams = await Exam.find().select("-questions").sort({ createdAt: -1 });
        return res.status(200).json({ exams });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching exams" });
    }
};

export const getStudents = async (req, res) => {
    try {
        const students = await Student.find().select("-password").sort({ createdAt: -1 });
        return res.status(200).json({ students });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching students" });
    }
};

export const getProfessors = async (req, res) => {
    try {
        const professors = await Professor.find().select("-password").sort({ createdAt: -1 });
        return res.status(200).json({ professors });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching professors" });
    }
};
