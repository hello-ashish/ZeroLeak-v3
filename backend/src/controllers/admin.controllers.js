import mongoose from "mongoose";
import { Professor } from "../models/professor.models.js";
import { Admin } from "../models/admin.models.js";
import { Auditor } from "../models/auditor.models.js";
import { Batch } from "../models/batch.models.js";
import { Question } from "../models/question.models.js";
import { Student } from "../models/student.models.js";
import { Exam } from "../models/exam.models.js";
import { Result } from "../models/result.models.js";
import { CheatingIncident } from "../models/cheatingIncident.models.js";
import { ProctoringSession } from "../models/proctoringSession.models.js";
import { ProctoringAIEvent } from "../models/proctoringAIEvent.models.js";
import { ProctoringIncident } from "../models/proctoringIncident.models.js";
import { AuditLog } from "../models/auditlog.models.js";
import { buildMerkleRoot } from "../Services/merkle.service.js";

import { ensureZMailAccount } from "../Services/zmail/zmailIdentity.service.js";
import {
    encryptQuestionContent,
    hashQuestionContent,
} from "../Services/crypto.service.js";
import { createNotification } from "./notification.controllers.js";
import { enqueueBatchCommitment, enqueueExamCommitment } from "../Services/integrityOutbox.service.js";
import { IntegrityOutbox } from "../models/integrityOutbox.models.js";

// ─── Audit Log Helper ────────────────────────────────────────────────────────
export const logAction = async ({ actor, actorRole = "Admin", action, targetType, targetId, targetLabel, details, status = "success" }) => {
    try {
        await AuditLog.create({ actor, actorRole, action, targetType, targetId: String(targetId || ""), targetLabel, details, status });
    } catch (err) {
        console.error("AuditLog Error:", err.message);
    }
};

// ─── Register Admin ───────────────────────────────────────────────────────────
export const registerAdmin = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ message: "Admin registration is disabled in production" });
        }

        // L-1: Guard against unauthorized registration if ADMIN_REGISTRATION_SECRET is set
        if (process.env.ADMIN_REGISTRATION_SECRET && req.body.registrationSecret !== process.env.ADMIN_REGISTRATION_SECRET) {
            return res.status(403).json({ message: "Invalid or missing admin registration secret" });
        }

        const adminCount = await Admin.countDocuments();
        if (adminCount >= 1) {
            return res.status(403).json({ message: "Admin registration is disabled. An admin already exists." });
        }

        const { adminId, email, password } = req.body;
        if (!adminId || !email || !password) {
            return res.status(400).json({ message: "adminId, email, and password are required" });
        }
        const existingAdmin = await Admin.findOne({ $or: [{ adminId }, { email }] });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin with this adminId or email already exists" });
        }
        const admin = await Admin.create({ adminId, email, password });
        const createdAdmin = admin.toObject();
        delete createdAdmin.password;
        return res.status(201).json({ message: "Admin registered successfully", admin: createdAdmin });
    } catch (error) {
        console.error("Admin Registration Error:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Register Support Member ──────────────────────────────────────────────────
export const registerSupportMember = async (req, res) => {
    try {
        const { adminId, email, password, name } = req.body;
        if (!adminId || !email || !password || !name) {
            return res.status(400).json({ message: "adminId, email, name, and password are required" });
        }
        const existingAdmin = await Admin.findOne({ $or: [{ adminId }, { email }] });
        if (existingAdmin) {
            return res.status(400).json({ message: "User with this adminId or email already exists" });
        }
        const supportMember = await Admin.create({ adminId, email, password, name, isSupport: true });
        const createdSupport = supportMember.toObject();
        delete createdSupport.password;
        await logAction({ actor: req.admin?.email, action: "SUPPORT_MEMBER_CREATED", targetType: "Admin", targetId: supportMember._id, targetLabel: name });
        return res.status(201).json({ message: "Support member registered successfully", support: createdSupport });
    } catch (error) {
        console.error("Support Registration Error:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Login Admin ──────────────────────────────────────────────────────────────
export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(401).json({ message: "Invalid email or password" });
        if (admin.isSupport) return res.status(403).json({ message: "Support members must use the Support portal to log in" });
        const isPasswordCorrect = await admin.isPasswordCorrect(password);
        if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid credentials" });

        // Parse forceLogout safely — some clients may send the string "true" instead of boolean true
        const forceLogout = req.body.forceLogout === true || req.body.forceLogout === "true";
        if (admin.isLoggedIn && !forceLogout) {
            return res.status(409).json({ message: "You're logged in at some other place too. Wish to continue?", code: "ALREADY_LOGGED_IN" });
        }

        admin.isLoggedIn = true;
        admin.lastActiveAt = new Date();
        admin.sessionVersion = (admin.sessionVersion || 0) + 1;
        await admin.save({ validateBeforeSave: false });

        const token = admin.generateAccessToken();
        const loggedInAdmin = admin.toObject();
        delete loggedInAdmin.password;

        await logAction({ actor: email, action: "ADMIN_LOGIN", targetType: "Admin", targetId: admin._id, targetLabel: email });

        return res.status(200).json({ message: "Login successful", token, admin: loggedInAdmin });
    } catch (error) {
        console.error("Admin Login Error:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const logoutAdmin = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id);
        if (admin) {
            admin.isLoggedIn = false;
            admin.sessionVersion = (admin.sessionVersion || 0) + 1;
            await admin.save({ validateBeforeSave: false });
            await logAction({ actor: admin.email, action: "ADMIN_LOGOUT", targetType: "Admin", targetId: admin._id, targetLabel: admin.email });
        }
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        console.error("Admin Logout Error:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Create Professor ─────────────────────────────────────────────────────────
export const createProfessor = async (req, res) => {
    try {
        const { id, name, email, contact, address, password } = req.body || {};
        if (!id || !name || !email || !password) {
            return res.status(400).json({ message: "id, name, email, and password are required fields." });
        }
        const existingProfessor = await Professor.findOne({ $or: [{ id }, { email }] });
        if (existingProfessor) {
            return res.status(400).json({ message: "A professor with this id or email already exists" });
        }
        const professor = await Professor.create({ id, name, email, contact, address, password });
        const createdProfessor = professor.toObject();
        delete createdProfessor.password;

        await logAction({ actor: req.admin?.email, action: "PROFESSOR_CREATED", targetType: "Professor", targetId: professor._id, targetLabel: name });

        // Provision ZMail account for the new professor (non-blocking)
        ensureZMailAccount({ userId: professor._id, userType: "Professor", displayName: name, loginEmail: email })
            .catch(err => console.warn("[ZMAIL] Failed to provision account for professor", professor._id, err.message));

        return res.status(201).json({ message: "Professor created successfully", professor: createdProfessor });
    } catch (error) {
        console.error("Error creating professor: ", error);
        return res.status(500).json({ message: "Internal server error while creating professor" });
    }
};

// ─── Get All Professors ───────────────────────────────────────────────────────
export const getAllProfessors = async (req, res) => {
    try {
        // Single aggregation replaces N+1 countDocuments pattern
        const [professors, batchCounts, totalBatches, pendingBatches] = await Promise.all([
            Professor.find({}).select("-password").sort({ createdAt: -1 }).lean(),
            Batch.aggregate([
                { $match: { status: { $in: ["Submitted", "Accepted", "Rejected", "MarkForReview"] } } },
                { $group: { _id: "$createdBy", count: { $sum: 1 } } }
            ]),
            Batch.countDocuments({ isDeletedByAdmin: { $ne: true } }),
            Batch.countDocuments({ status: "Submitted", isDeletedByAdmin: { $ne: true } })
        ]);

        const countMap = {};
        batchCounts.forEach(bc => { countMap[bc._id.toString()] = bc.count; });

        const professorsWithCounts = professors.map(prof => ({
            ...prof,
            submittedBatches: countMap[prof._id.toString()] || 0
        }));
        return res.status(200).json({
            professors: professorsWithCounts,
            totalBatches,
            pendingBatches
        });
    } catch (error) {
        console.error("Error fetching professors: ", error);
        return res.status(500).json({ message: "Internal server error while fetching professors" });
    }
};

// ─── Delete Professor ─────────────────────────────────────────────────────────
export const deleteProfessor = async (req, res) => {
    try {
        const { id } = req.params;
        const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { id }] } : { id };
        const deletedProfessor = await Professor.findOneAndDelete(query);
        if (!deletedProfessor) {
            return res.status(404).json({ message: "Professor not found" });
        }
        await logAction({ actor: req.admin?.email, action: "PROFESSOR_DELETED", targetType: "Professor", targetId: deletedProfessor._id, targetLabel: deletedProfessor.name });
        return res.status(200).json({ message: "Professor deleted successfully" });
    } catch (error) {
        console.error("Error deleting professor: ", error);
        return res.status(500).json({ message: "Internal server error while deleting professor" });
    }
};

// ─── Delete Student ───────────────────────────────────────────────────────────
export const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedStudent = await Student.findByIdAndDelete(id);
        if (!deletedStudent) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Cascade delete student's results, cheating incidents, and proctoring telemetry
        await Promise.allSettled([
            Result.deleteMany({ student: id }),
            CheatingIncident.deleteMany({ studentId: id }),
            ProctoringSession.deleteMany({ studentId: id }),
            ProctoringAIEvent.deleteMany({ studentId: id }),
            ProctoringIncident.deleteMany({ studentId: id })
        ]);

        await logAction({ actor: req.admin?.email, action: "STUDENT_DELETED", targetType: "Student", targetId: deletedStudent._id, targetLabel: deletedStudent.name });
        return res.status(200).json({ message: "Student deleted successfully" });
    } catch (error) {
        console.error("Error deleting student: ", error);
        return res.status(500).json({ message: "Internal server error while deleting student" });
    }
};

// ─── Get Batches ──────────────────────────────────────────────────────────────
export const getBatches = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status, isDeletedByAdmin: { $ne: true } } : { isDeletedByAdmin: { $ne: true } };

        // Performance Optimization: Exclude heavy question bodies (options, answers, content) for the list view.
        // Selecting only questions._id and questions.difficultyLevel preserves batch.questions.length
        // while reducing MongoDB read time from >20s to <150ms and cutting payload size by >90%.
        const batches = await Batch.find(query)
            .select("title description subject createdBy status adminMessage openedByAdmin merkleRoot createdAt updatedAt questions._id questions.difficultyLevel")
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email')
            .lean();

        res.status(200).json({ batches });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── Open Batch Details ───────────────────────────────────────────────────────
export const openBatchDetails = async (req, res) => {
    try {
        // Fast read without blocking on MongoDB replica write locks
        const batch = await Batch.findById(req.params.batchId)
            .populate('createdBy', 'name email')
            .lean();

        if (!batch) return res.status(404).json({ message: "Batch not found" });

        // Non-blocking update of openedByAdmin flag
        if (!batch.openedByAdmin) {
            Batch.updateOne({ _id: batch._id }, { $set: { openedByAdmin: true } }).catch(err => {
                console.error("[openBatchDetails] Error updating openedByAdmin:", err.message);
            });
            batch.openedByAdmin = true;
        }

        if (batch.status === 'Accepted' && Array.isArray(batch.questions)) {
            batch.questions = batch.questions.map(q => {
                let contentHash = q.contentHash;
                if (!contentHash) {
                    if (q.title && /^[a-f0-9]{64}$/i.test(q.title)) {
                        contentHash = q.title;
                    } else if (q.title) {
                        contentHash = hashQuestionContent({
                            title: q.title,
                            options: q.options || [],
                            correctAnswer: q.correctAnswer,
                            correctAnswerIndex: q.correctAnswerIndex,
                            subject: q.subject,
                            topic: q.topic,
                            difficultyLevel: q.difficultyLevel,
                        });
                    }
                }
                return {
                    _id: q._id,
                    title: contentHash || "[Encrypted Question Hash]",
                    options: [],
                    difficultyLevel: q.difficultyLevel,
                    subject: q.subject,
                    topic: q.topic,
                    contentHash,
                    questionId: q.questionId,
                    createdAt: q.createdAt,
                    updatedAt: q.updatedAt
                };
            });
        }

        res.status(200).json({ batch });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── Review Batch ─────────────────────────────────────────────────────────────
export const reviewBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { action, adminMessage } = req.body;
        const batch = await Batch.findById(batchId);

        if (!batch) return res.status(404).json({ message: "Batch not found" });

        if (action === 'Accept') {
            if (batch.status === 'Accepted') {
                return res.status(400).json({ message: 'Batch is already accepted.' });
            }

            if (!batch.questions || batch.questions.length === 0) {
                return res.status(400).json({ message: 'Cannot approve an empty batch.' });
            }

            const questionsToInsert = batch.questions.map((q) => {

                const sensitiveContent = {
                    title: q.title,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    correctAnswerIndex: q.correctAnswerIndex,
                    subject: q.subject,
                    topic: q.topic,
                    difficultyLevel: q.difficultyLevel,
                };

                const contentHash =
                    hashQuestionContent(sensitiveContent);

                const encryptedContent =
                    encryptQuestionContent(sensitiveContent);

                return {
                    encryptedContent,
                    contentHash,
                    difficultyLevel: q.difficultyLevel,
                    subject: q.subject,
                    topic: q.topic,
                    createdBy: batch.createdBy,
                };
            });

            const insertedQuestions = await Question.insertMany(questionsToInsert);
            const questionHashes = insertedQuestions.map((question) => question.contentHash);
            const merkleRoot = buildMerkleRoot(questionHashes);

            // Redact plaintext content from draft questions upon acceptance
            // Keep contentHash, difficulty, subject, topic so question stats & hash verification remain intact.
            // Scrub title (set to contentHash), empty options, and remove correctAnswer & correctAnswerIndex.
            batch.questions = batch.questions.map((q, idx) => {
                const contentHash = questionHashes[idx];
                const insertedQ = insertedQuestions[idx];
                return {
                    _id: q._id,
                    title: contentHash,
                    options: [],
                    difficultyLevel: q.difficultyLevel,
                    subject: q.subject,
                    topic: q.topic,
                    contentHash: contentHash,
                    questionId: insertedQ?._id,
                    createdAt: q.createdAt,
                    updatedAt: q.updatedAt
                };
            });

            batch.merkleRoot = merkleRoot;
            batch.status = 'Accepted';
            batch.adminMessage = 'Batch Approved';

            await logAction({ actor: req.admin?.email, action: "BATCH_APPROVED", targetType: "Batch", targetId: batch._id, targetLabel: batch.title });
        } else if (action === 'Reject') {
            batch.status = 'Rejected';
            batch.adminMessage = adminMessage || 'Rejected without specific reason.';
            batch.questions = [];
            await logAction({ actor: req.admin?.email, action: "BATCH_REJECTED", targetType: "Batch", targetId: batch._id, targetLabel: batch.title, details: adminMessage });
        } else if (action === 'MarkForReview') {
            batch.status = 'MarkForReview';
            batch.adminMessage = adminMessage || 'Please revise these questions.';
            await logAction({ actor: req.admin?.email, action: "BATCH_MARKED_FOR_REVIEW", targetType: "Batch", targetId: batch._id, targetLabel: batch.title, details: adminMessage });
        }

        // Save the batch FIRST, then notify — avoids professor being notified if the DB write fails
        await batch.save();

        // Only notify Professor if the batch is marked for review
        if (action === 'MarkForReview') {
            await createNotification({
                userId: batch.createdBy,
                userRole: "Professor",
                title: "Batch Needs Revision",
                message: `Your batch "${batch.title}" needs revision. Reason: ${adminMessage || 'Please revise these questions.'}`,
                type: "WARNING",
                relatedLink: "/professor/batches"
            });
        }

        // Enqueue Fabric commitment AFTER saving — so blockchain references final state
        if (action === 'Accept') {
            try {
                await enqueueBatchCommitment(batch);
            } catch (err) {
                console.error('[FABRIC] Failed to enqueue batch commitment (reconciler will retry):', err.message);
            }
        }

        const actionMessages = { Accept: 'Accepted', Reject: 'Rejected', MarkForReview: 'Marked for Review' };
        res.status(200).json({ message: `Batch ${actionMessages[action] || action}`, batch });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── Delete Batch ─────────────────────────────────────────────────────────────
export const deleteBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findById(batchId);

        if (!batch) return res.status(404).json({ message: "Batch not found" });

        if (batch.status === 'Accepted' && batch.merkleRoot) {
            const questionIds = (batch.questions || [])
                .map(q => q.questionId)
                .filter(Boolean);

            const contentHashes = (batch.questions || [])
                .map(q => {
                    if (q.contentHash) return q.contentHash;
                    if (q.title && /^[a-f0-9]{64}$/i.test(q.title)) return q.title;
                    if (q.title && q.options && q.options.length > 0) {
                        return hashQuestionContent({
                            title: q.title,
                            options: q.options,
                            correctAnswer: q.correctAnswer,
                            correctAnswerIndex: q.correctAnswerIndex,
                            subject: q.subject,
                            topic: q.topic,
                            difficultyLevel: q.difficultyLevel,
                        });
                    }
                    return null;
                })
                .filter(Boolean);

            if (questionIds.length > 0) {
                await Question.deleteMany({ _id: { $in: questionIds } });
            } else if (contentHashes.length > 0) {
                await Question.deleteMany({ contentHash: { $in: contentHashes } });
            } else {
                console.warn(`[DELETE BATCH] Could not re-derive content hashes or question IDs for accepted batch ${batchId}. Skipping question deletion.`);
            }
        }

        batch.isDeletedByAdmin = true;
        await batch.save();

        await logAction({ actor: req.admin?.email, action: "BATCH_DELETED", targetType: "Batch", targetId: batch._id, targetLabel: batch.title });

        res.status(200).json({ message: "Batch deleted successfully" });
    } catch (error) {
        console.error("Error deleting batch:", error.message);
        res.status(500).json({ message: "Error deleting batch" });
    }

};

// ─── Update Admin Profile ─────────────────────────────────────────────────────
export const updateAdminProfile = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findById(req.admin._id);
        if (email) admin.email = email;
        if (password) {
            admin.password = password;
            admin.sessionVersion = (admin.sessionVersion || 0) + 1;
        }
        await admin.save();
        const updatedAdmin = admin.toObject();
        delete updatedAdmin.password;
        await logAction({ actor: admin.email, action: "ADMIN_PROFILE_UPDATED", targetType: "Admin", targetId: admin._id, targetLabel: admin.email });
        return res.status(200).json({ message: "Profile updated successfully", admin: updatedAdmin });
    } catch (error) {
        return res.status(500).json({ message: "Error updating profile", error: error.message });
    }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [
            studentCount,
            professorCount,
            examCount,
            questionCount,
            batchCount,
            pendingBatchCount,
            recentLogs,
            recentExams,
            liveExamsCount,
            studentsLastMonth,
            // Aggregated stats from Results (replaces loading all results into memory)
            resultStats,
            scoreDistributionAgg,
            performanceDataAgg,
            studentPerformanceAgg,
            questionsBySubject,
            totalResultCount
        ] = await Promise.all([
            Student.countDocuments(),
            Professor.countDocuments(),
            Exam.countDocuments(),
            Question.countDocuments(),
            Batch.countDocuments(),
            Batch.countDocuments({ status: "Submitted" }),
            AuditLog.find({}).sort({ createdAt: -1 }).limit(15).lean(),
            Exam.find({}).sort({ createdAt: -1 }).limit(5).populate("questions", "_id").lean(),
            Exam.countDocuments({ status: "Live" }),
            Student.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
            // Compute avgScore and passRate via aggregation
            Result.aggregate([
                {
                    $project: {
                        pct: { $multiply: [{ $divide: ["$score", "$totalQuestions"] }, 100] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgScore: { $avg: "$pct" },
                        totalPassed: { $sum: { $cond: [{ $gte: ["$pct", 50] }, 1, 0] } },
                        total: { $sum: 1 }
                    }
                }
            ]),
            // Score distribution via aggregation
            Result.aggregate([
                {
                    $project: {
                        pct: { $multiply: [{ $divide: ["$score", "$totalQuestions"] }, 100] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        below50: { $sum: { $cond: [{ $lt: ["$pct", 50] }, 1, 0] } },
                        fiftyToSixtyNine: { $sum: { $cond: [{ $and: [{ $gte: ["$pct", 50] }, { $lt: ["$pct", 70] }] }, 1, 0] } },
                        seventyToEightyNine: { $sum: { $cond: [{ $and: [{ $gte: ["$pct", 70] }, { $lt: ["$pct", 90] }] }, 1, 0] } },
                        above90: { $sum: { $cond: [{ $gte: ["$pct", 90] }, 1, 0] } }
                    }
                }
            ]),
            // Performance trend over the last 7 days via aggregation
            Result.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                {
                    $project: {
                        dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        pct: { $multiply: [{ $divide: ["$score", "$totalQuestions"] }, 100] }
                    }
                },
                {
                    $group: {
                        _id: "$dateStr",
                        totalScore: { $sum: "$pct" },
                        count: { $sum: 1 },
                        passed: { $sum: { $cond: [{ $gte: ["$pct", 50] }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            // Top and at-risk students via aggregation
            Result.aggregate([
                {
                    $group: {
                        _id: "$student",
                        avgPct: { $avg: { $multiply: [{ $divide: ["$score", "$totalQuestions"] }, 100] } },
                        examsCount: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: "students",
                        localField: "_id",
                        foreignField: "_id",
                        as: "studentDoc",
                        pipeline: [{ $project: { name: 1, studentId: 1 } }]
                    }
                },
                { $unwind: { path: "$studentDoc", preserveNullAndEmptyArrays: false } },
                {
                    $project: {
                        name: "$studentDoc.name",
                        studentId: "$studentDoc.studentId",
                        avgScore: { $round: ["$avgPct", 0] },
                        examsCount: 1
                    }
                }
            ]),
            // Questions by subject
            Question.aggregate([
                { $group: { _id: "$subject", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Result.countDocuments()
        ]);

        // Process aggregation results
        const stats_agg = resultStats[0] || { avgScore: 0, totalPassed: 0, total: 0 };
        const avgScore = Math.round(stats_agg.avgScore || 0);
        const passRate = stats_agg.total > 0 ? Math.round((stats_agg.totalPassed / stats_agg.total) * 100) : 0;

        const scoreDist = scoreDistributionAgg[0] || { below50: 0, fiftyToSixtyNine: 0, seventyToEightyNine: 0, above90: 0 };
        const scoreDistribution = {
            below50: scoreDist.below50,
            fiftyToSixtyNine: scoreDist.fiftyToSixtyNine,
            seventyToEightyNine: scoreDist.seventyToEightyNine,
            above90: scoreDist.above90
        };

        // Build 7-day performance data map
        const perfMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            perfMap[dateStr] = { date: dateStr, score: 0, passRate: 0 };
        }
        performanceDataAgg.forEach(day => {
            if (perfMap[day._id]) {
                perfMap[day._id].score = day.count > 0 ? Math.round(day.totalScore / day.count) : 0;
                perfMap[day._id].passRate = day.count > 0 ? Math.round((day.passed / day.count) * 100) : 0;
            }
        });
        const performanceData = Object.values(perfMap);

        let scoreTrajectory = 0;
        if (performanceData.length === 7) {
            const recentAvg = (performanceData[4].score + performanceData[5].score + performanceData[6].score) / 3;
            const pastAvg = (performanceData[1].score + performanceData[2].score + performanceData[3].score) / 3;
            if (pastAvg > 0) {
                scoreTrajectory = (((recentAvg - pastAvg) / pastAvg) * 100).toFixed(1);
            } else if (recentAvg > 0) {
                scoreTrajectory = 100;
            }
        }

        // Top and at-risk students from aggregated results
        const topStudents = [...studentPerformanceAgg].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
        const atRiskStudents = [...studentPerformanceAgg].filter(s => s.avgScore < 50).sort((a, b) => a.avgScore - b.avgScore).slice(0, 5);

        return res.status(200).json({
            stats: {
                students: studentCount,
                professors: professorCount,
                exams: examCount,
                questions: questionCount,
                batches: batchCount,
                pendingBatches: pendingBatchCount,
                totalResults: totalResultCount,
                avgScore,
                passRate,
                scoreDistribution,
                liveExamsCount,
                studentsLastMonth,
                scoreTrajectory
            },
            questionsBySubject,
            topStudents,
            atRiskStudents,
            recentLogs,
            recentExams,
            performanceData
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error.message);
        return res.status(500).json({ message: "Error fetching dashboard stats" });
    }
};

// ─── Get Audit Logs ───────────────────────────────────────────────────────────
export const getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const logs = await AuditLog.find({})
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await AuditLog.countDocuments();
        return res.status(200).json({ logs, total });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching audit logs" });
    }
};

// ─── Update Exam Status ───────────────────────────────────────────────────────
export const updateExamStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let { scheduledAt, endsAt } = req.body;

        const examObj = await Exam.findById(id);
        if (!examObj) return res.status(404).json({ message: "Exam not found" });

        if (status === "Live" && examObj.status !== "Live") {
            if (!scheduledAt) scheduledAt = new Date();
            else scheduledAt = new Date(scheduledAt);

            if (!endsAt) {
                endsAt = new Date(scheduledAt.getTime() + (examObj.durationMinutes || 60) * 60 * 1000);
            } else {
                endsAt = new Date(endsAt);
            }
        } else if (scheduledAt || endsAt) {
            if (scheduledAt) scheduledAt = new Date(scheduledAt);
            if (endsAt) endsAt = new Date(endsAt);
        }

        const updateData = { status };
        if (scheduledAt) updateData.scheduledAt = scheduledAt;
        if (endsAt) updateData.endsAt = endsAt;

        // Automatically update durationMinutes if both scheduledAt and endsAt are provided
        if (updateData.scheduledAt && updateData.endsAt) {
            const diffMinutes = Math.round((updateData.endsAt.getTime() - updateData.scheduledAt.getTime()) / 60000);
            if (diffMinutes > 0) {
                updateData.durationMinutes = diffMinutes;
            }
        }

        const exam = await Exam.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
        await logAction({ actor: req.admin?.email, action: `EXAM_${status.toUpperCase()}`, targetType: "Exam", targetId: exam._id, targetLabel: exam.title });

        // Auto-enqueue next version commitment on Fabric so ledger reflects scheduled/updated state
        try {
            const latestOutbox = await IntegrityOutbox.findOne({ entityType: 'Exam', entityId: exam._id.toString(), status: 'CONFIRMED' })
                .sort({ version: -1 })
                .lean();
            const nextVersion = (latestOutbox?.version || 1) + 1;
            const prevHash = latestOutbox?.dataHash || '';
            await enqueueExamCommitment(exam, nextVersion, prevHash);
        } catch (enqueueErr) {
            console.error('[FABRIC] Failed to enqueue exam update commitment:', enqueueErr.message);
        }

        return res.status(200).json({ message: "Exam status updated", exam });
    } catch (error) {
        return res.status(500).json({ message: "Error updating exam status" });
    }
};

// ─── Toggle Exam Results Release ──────────────────────────────────────────────
export const toggleExamResultsRelease = async (req, res) => {
    try {
        const { id } = req.params;
        const { isResultReleased } = req.body;
        const exam = await Exam.findByIdAndUpdate(id, { isResultReleased }, { returnDocument: 'after' });
        if (!exam) return res.status(404).json({ message: "Exam not found" });
        await logAction({ actor: req.admin?.email, action: `EXAM_RESULTS_${isResultReleased ? 'RELEASED' : 'HIDDEN'}`, targetType: "Exam", targetId: exam._id, targetLabel: exam.title });
        return res.status(200).json({ message: `Exam results ${isResultReleased ? 'released' : 'hidden'}`, exam });
    } catch (error) {
        return res.status(500).json({ message: "Error toggling exam result release status" });
    }
};

// ─── Delete Exam ──────────────────────────────────────────────────────────────
export const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent deletion of active exams to protect in-progress student attempts
        const examObj = await Exam.findById(id);
        if (!examObj) return res.status(404).json({ message: "Exam not found" });
        if (examObj.status === "Live" || examObj.status === "GracePeriod") {
            return res.status(400).json({ message: `Cannot delete an active exam (status: ${examObj.status}). End the exam first.` });
        }

        await Exam.findByIdAndDelete(id);

        // Cascade delete results associated with this exam
        await Result.deleteMany({ exam: id });

        await logAction({ actor: req.admin?.email, action: "EXAM_DELETED", targetType: "Exam", targetId: examObj._id, targetLabel: examObj.title });
        return res.status(200).json({ message: "Exam deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting exam" });
    }
};

// ─── Get Live Students ────────────────────────────────────────────────────────
export const getLiveStudents = async (req, res) => {
    try {
        // Find students who have pinged within the last 30 seconds
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
        const liveStudents = await Student.find({
            lastActiveAt: { $gte: thirtySecondsAgo },
            currentExamId: { $ne: null }
        }).select("-password").populate("currentExamId", "title").lean();

        return res.status(200).json({ liveStudents });
    } catch (error) {
        console.error("Error fetching live students: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Toggle Block Student ─────────────────────────────────────────────────────
export const toggleBlockStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        student.isBlocked = !student.isBlocked;
        if (student.isBlocked) {
            student.sessionVersion = (student.sessionVersion || 0) + 1;
        }
        await student.save();

        await logAction({
            actor: req.admin?.email,
            action: student.isBlocked ? "STUDENT_BLOCKED" : "STUDENT_UNBLOCKED",
            targetType: "Student",
            targetId: student._id,
            targetLabel: student.name
        });

        // Notify Student
        await createNotification({
            userId: student._id,
            userRole: "Student",
            title: student.isBlocked ? "Account Restricted" : "Account Restored",
            message: student.isBlocked ? "Your account has been restricted by an administrator." : "Your account access has been restored.",
            type: student.isBlocked ? "ERROR" : "SUCCESS"
        });

        return res.status(200).json({
            message: `Student successfully ${student.isBlocked ? 'blocked' : 'unblocked'}`,
            isBlocked: student.isBlocked
        });
    } catch (error) {
        console.error("Error toggling block for student: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Toggle Block Professor ─────────────────────────────────────────────────────
export const toggleBlockProfessor = async (req, res) => {
    try {
        const { id } = req.params;
        const professor = await Professor.findById(id);
        if (!professor) {
            return res.status(404).json({ message: "Professor not found" });
        }

        professor.isBlocked = !professor.isBlocked;
        if (professor.isBlocked) {
            professor.sessionVersion = (professor.sessionVersion || 0) + 1;
        }
        await professor.save();

        await logAction({
            actor: req.admin?.email,
            action: professor.isBlocked ? "PROFESSOR_BLOCKED" : "PROFESSOR_UNBLOCKED",
            targetType: "Professor",
            targetId: professor._id,
            targetLabel: professor.name
        });

        // Notify Professor
        await createNotification({
            userId: professor._id,
            userRole: "Professor",
            title: professor.isBlocked ? "Account Restricted" : "Account Restored",
            message: professor.isBlocked ? "Your account has been restricted by an administrator." : "Your account access has been restored.",
            type: professor.isBlocked ? "ERROR" : "SUCCESS"
        });

        return res.status(200).json({
            message: `Professor successfully ${professor.isBlocked ? 'blocked' : 'unblocked'}`,
            isBlocked: professor.isBlocked
        });
    } catch (error) {
        console.error("Error toggling block for professor: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Bulk Delete Professors ───────────────────────────────────────────────────
export const bulkDeleteProfessors = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No professor IDs provided" });
        }
        await Professor.deleteMany({ _id: { $in: ids } });
        await logAction({ actor: req.admin?.email, action: "PROFESSORS_BULK_DELETED", targetType: "Professor", targetLabel: `${ids.length} professors` });
        return res.status(200).json({ message: "Professors deleted successfully" });
    } catch (error) {
        console.error("Error bulk deleting professors: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Bulk Block Professors ─────────────────────────────────────────────────────
export const bulkBlockProfessors = async (req, res) => {
    try {
        const { ids, block } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No professor IDs provided" });
        }
        // When blocking, also increment sessionVersion to immediately invalidate active JWTs
        const updateQuery = { $set: { isBlocked: block } };
        if (block) updateQuery.$inc = { sessionVersion: 1 };
        await Professor.updateMany({ _id: { $in: ids } }, updateQuery);
        await logAction({ actor: req.admin?.email, action: "PROFESSORS_BULK_BLOCKED", targetType: "Professor", targetLabel: `${ids.length} professors blocked=${block}` });
        return res.status(200).json({ message: `Professors ${block ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        console.error("Error bulk blocking professors: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Bulk Import Professors ─────────────────────────────────────────────────────
export const bulkImportProfessors = async (req, res) => {
    try {
        const { professors } = req.body;
        if (!Array.isArray(professors) || professors.length === 0) {
            return res.status(400).json({ message: "No professor data provided" });
        }

        // 1. Validate and extract candidate data
        const candidates = [];
        let skippedCount = 0;
        for (const profData of professors) {
            const rawProfessorId = profData.id || profData.professorid || profData['professor id'];
            const { name, email, password, contact, address } = profData;
            if (!rawProfessorId || !name || !email) {
                skippedCount++;
                continue;
            }
            let finalPassword = password;
            if (!finalPassword) {
                const firstName = name.split(' ')[0];
                finalPassword = `hello${firstName}`;
            }
            candidates.push({ id: rawProfessorId, name, email, password: finalPassword, contact, address });
        }

        if (candidates.length === 0) {
            return res.status(200).json({ message: "Import complete", imported: 0, skipped: skippedCount });
        }

        // 2. Batch-fetch all existing professors by id or email in ONE query
        const candidateIds = candidates.map(c => c.id);
        const candidateEmails = candidates.map(c => c.email);
        const existing = await Professor.find({
            $or: [{ id: { $in: candidateIds } }, { email: { $in: candidateEmails } }]
        }).select("id email").lean();

        const existingIds = new Set(existing.map(e => e.id));
        const existingEmails = new Set(existing.map(e => e.email));

        // 3. Filter out duplicates
        const toInsert = candidates.filter(c => !existingIds.has(c.id) && !existingEmails.has(c.email));
        skippedCount += (candidates.length - toInsert.length);

        if (toInsert.length > 0) {
            // 4. Pre-hash passwords in parallel (bcrypt is CPU-intensive)
            const bcrypt = (await import('bcrypt')).default;
            await Promise.all(toInsert.map(async (prof) => {
                prof.password = await bcrypt.hash(prof.password, 10);
            }));

            // 5. Bulk insert (skips Mongoose pre-save hooks since passwords are already hashed)
            await Professor.insertMany(toInsert, { ordered: false });
        }

        await logAction({ actor: req.admin?.email, action: "PROFESSORS_BULK_IMPORTED", targetType: "Professor", targetLabel: `${toInsert.length} professors imported` });

        return res.status(200).json({
            message: "Import complete",
            imported: toInsert.length,
            skipped: skippedCount
        });
    } catch (error) {
        console.error("Error bulk importing professors: ", error);
        return res.status(500).json({ message: "Internal server error during import" });
    }
};

// ─── Bulk Delete Students ─────────────────────────────────────────────────────
export const bulkDeleteStudents = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No student IDs provided" });
        }
        await Student.deleteMany({ _id: { $in: ids } });

        // Cascade delete for all bulk-deleted students
        await Promise.allSettled([
            Result.deleteMany({ student: { $in: ids } }),
            CheatingIncident.deleteMany({ studentId: { $in: ids } }),
            ProctoringSession.deleteMany({ studentId: { $in: ids } }),
            ProctoringAIEvent.deleteMany({ studentId: { $in: ids } }),
            ProctoringIncident.deleteMany({ studentId: { $in: ids } })
        ]);

        await logAction({ actor: req.admin?.email, action: "STUDENTS_BULK_DELETED", targetType: "Student", targetLabel: `${ids.length} students` });
        return res.status(200).json({ message: "Students deleted successfully" });
    } catch (error) {
        console.error("Error bulk deleting students: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Bulk Block Students ─────────────────────────────────────────────────────
export const bulkBlockStudents = async (req, res) => {
    try {
        const { ids, block } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No student IDs provided" });
        }
        // When blocking, also increment sessionVersion to immediately invalidate active JWTs
        const updateQuery = { $set: { isBlocked: block } };
        if (block) updateQuery.$inc = { sessionVersion: 1 };
        await Student.updateMany({ _id: { $in: ids } }, updateQuery);
        await logAction({ actor: req.admin?.email, action: "STUDENTS_BULK_BLOCKED", targetType: "Student", targetLabel: `${ids.length} students blocked=${block}` });
        return res.status(200).json({ message: `Students ${block ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        console.error("Error bulk blocking students: ", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Bulk Import Students ─────────────────────────────────────────────────────
export const bulkImportStudents = async (req, res) => {
    try {
        const { students } = req.body;
        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: "No student data provided" });
        }

        // 1. Validate and extract candidate data
        const candidates = [];
        let skippedCount = 0;
        for (const stuData of students) {
            const rawStudentId = stuData.studentId || stuData.studentid;
            const { name, email, password, department, batch, contact, dateOfBirth, address, gender, program } = stuData;
            if (!rawStudentId || !name || !email) {
                skippedCount++;
                continue;
            }
            let finalPassword = password;
            if (!finalPassword) {
                const firstName = name.split(' ')[0];
                finalPassword = `hello${firstName}`;
            }
            const cleanData = { studentId: rawStudentId, name, email, password: finalPassword, department, batch, contact, address, gender, program };
            if (dateOfBirth) cleanData.dateOfBirth = dateOfBirth;
            candidates.push(cleanData);
        }

        if (candidates.length === 0) {
            return res.status(200).json({ message: "Import complete", imported: 0, skipped: skippedCount });
        }

        // 2. Batch-fetch all existing students by studentId or email in ONE query
        const candidateIds = candidates.map(c => c.studentId);
        const candidateEmails = candidates.map(c => c.email);
        const existing = await Student.find({
            $or: [{ studentId: { $in: candidateIds } }, { email: { $in: candidateEmails } }]
        }).select("studentId email").lean();

        const existingIds = new Set(existing.map(e => e.studentId));
        const existingEmails = new Set(existing.map(e => e.email));

        // 3. Filter out duplicates
        const toInsert = candidates.filter(c => !existingIds.has(c.studentId) && !existingEmails.has(c.email));
        skippedCount += (candidates.length - toInsert.length);

        if (toInsert.length > 0) {
            // 4. Pre-hash passwords in parallel
            const bcrypt = (await import('bcrypt')).default;
            await Promise.all(toInsert.map(async (stu) => {
                stu.password = await bcrypt.hash(stu.password, 10);
            }));

            // 5. Bulk insert
            await Student.insertMany(toInsert, { ordered: false });
        }

        await logAction({ actor: req.admin?.email, action: "STUDENTS_BULK_IMPORTED", targetType: "Student", targetLabel: `${toInsert.length} students imported` });

        return res.status(200).json({
            message: "Import complete",
            imported: toInsert.length,
            skipped: skippedCount
        });
    } catch (error) {
        console.error("Error bulk importing students: ", error);
        return res.status(500).json({ message: "Internal server error during import" });
    }
};
export const broadcastAnnouncement = async (req, res) => {
    try {
        const { message, title, targetRoles = ["Student"] } = req.body;
        if (!message) return res.status(400).json({ message: "Message is required" });

        const { Notification } = await import('../models/notification.models.js');
        // Note: Auditor is already imported at the top of this file

        // Fetch all role user-IDs in parallel instead of sequential awaits
        const [adminsResult, studentsResult, professorsResult, auditorsResult] = await Promise.all([
            targetRoles.includes("Admin") ? Admin.find({}).select("_id").lean() : Promise.resolve([]),
            targetRoles.includes("Student") ? Student.find({}).select("_id").lean() : Promise.resolve([]),
            targetRoles.includes("Professor") ? Professor.find({}).select("_id").lean() : Promise.resolve([]),
            targetRoles.includes("Auditor") ? Auditor.find({}).select("_id").lean() : Promise.resolve([]),
        ]);

        const targetUserIds = [
            ...adminsResult.map(u => ({ userId: u._id, userRole: "Admin" })),
            ...studentsResult.map(u => ({ userId: u._id, userRole: "Student" })),
            ...professorsResult.map(u => ({ userId: u._id, userRole: "Professor" })),
            ...auditorsResult.map(u => ({ userId: u._id, userRole: "Auditor" })),
        ];

        const notifications = targetUserIds.map(t => ({
            userId: t.userId,
            userRole: t.userRole,
            title: title || "Global Announcement",
            message,
            type: "INFO"
        }));

        const CHUNK_SIZE = 500;
        for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
            await Notification.insertMany(notifications.slice(i, i + CHUNK_SIZE));
        }

        res.status(200).json({ message: "Broadcast successful", count: notifications.length });
    } catch (error) {
        console.error("Error broadcasting:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Auditor Management ────────────────────────────────────────────────────────

export const getAllAuditors = async (req, res) => {
    try {
        const auditors = await Auditor.find({}).select("-password").lean();
        return res.status(200).json({ auditors });
    } catch (error) {
        console.error("Error fetching auditors:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteAuditor = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAuditor = await Auditor.findByIdAndDelete(id);
        if (!deletedAuditor) return res.status(404).json({ message: "Auditor not found" });
        await logAction({ actor: req.admin?.email, action: "AUDITOR_DELETED", targetType: "Auditor", targetId: deletedAuditor._id, targetLabel: deletedAuditor.name });
        return res.status(200).json({ message: "Auditor deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const toggleBlockAuditor = async (req, res) => {
    try {
        const { id } = req.params;
        const auditor = await Auditor.findById(id);
        if (!auditor) return res.status(404).json({ message: "Auditor not found" });
        auditor.isBlocked = !auditor.isBlocked;
        await auditor.save();
        await logAction({ actor: req.admin?.email, action: auditor.isBlocked ? "AUDITOR_BLOCKED" : "AUDITOR_UNBLOCKED", targetType: "Auditor", targetId: auditor._id, targetLabel: auditor.name });
        return res.status(200).json({ message: `Auditor successfully ${auditor.isBlocked ? 'blocked' : 'unblocked'}`, isBlocked: auditor.isBlocked });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const bulkDeleteAuditors = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No auditor IDs provided" });
        await Auditor.deleteMany({ _id: { $in: ids } });
        await logAction({ actor: req.admin?.email, action: "AUDITORS_BULK_DELETED", targetType: "Auditor", targetLabel: `${ids.length} auditors` });
        return res.status(200).json({ message: "Auditors deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const bulkBlockAuditors = async (req, res) => {
    try {
        const { ids, block } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No auditor IDs provided" });
        await Auditor.updateMany({ _id: { $in: ids } }, { $set: { isBlocked: block } });
        await logAction({ actor: req.admin?.email, action: block ? "AUDITORS_BULK_BLOCKED" : "AUDITORS_BULK_UNBLOCKED", targetType: "Auditor", targetLabel: `${ids.length} auditors` });
        return res.status(200).json({ message: `Auditors ${block ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Support Member Management ────────────────────────────────────────────────

export const getAllSupportMembers = async (req, res) => {
    try {
        const supportMembers = await Admin.find({ isSupport: true }).select("-password").lean();

        const { SupportTicket } = await import("../models/supportTicket.models.js");
        const supportIds = supportMembers.map(m => m._id);
        const stats = await SupportTicket.aggregate([
            { $match: { assignedTo: { $in: supportIds } } },
            {
                $group: {
                    _id: "$assignedTo",
                    totalAssigned: { $sum: 1 },
                    totalResolved: { $sum: { $cond: [{ $in: ["$status", ["RESOLVED", "CLOSED"]] }, 1, 0] } },
                    openTickets: { $sum: { $cond: [{ $in: ["$status", ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_SUPPORT"]] }, 1, 0] } }
                }
            }
        ]);

        const statsMap = {};
        stats.forEach(s => {
            statsMap[s._id.toString()] = s;
        });

        const membersWithStats = supportMembers.map(member => ({
            ...member,
            ticketStats: statsMap[member._id.toString()] || { totalAssigned: 0, totalResolved: 0, openTickets: 0 }
        }));

        return res.status(200).json({ supportMembers: membersWithStats });
    } catch (error) {
        console.error("Error fetching support members:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteSupportMember = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedSupport = await Admin.findOneAndDelete({ _id: id, isSupport: true });
        if (!deletedSupport) return res.status(404).json({ message: "Support member not found" });
        await logAction({ actor: req.admin?.email, action: "SUPPORT_MEMBER_DELETED", targetType: "Admin", targetId: deletedSupport._id, targetLabel: deletedSupport.name });
        return res.status(200).json({ message: "Support member deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const toggleBlockSupportMember = async (req, res) => {
    try {
        const { id } = req.params;
        const support = await Admin.findOne({ _id: id, isSupport: true });
        if (!support) return res.status(404).json({ message: "Support member not found" });
        support.isBlocked = !support.isBlocked;
        await support.save();
        await logAction({ actor: req.admin?.email, action: support.isBlocked ? "SUPPORT_MEMBER_BLOCKED" : "SUPPORT_MEMBER_UNBLOCKED", targetType: "Admin", targetId: support._id, targetLabel: support.name });
        return res.status(200).json({ message: `Support member successfully ${support.isBlocked ? 'blocked' : 'unblocked'}`, isBlocked: support.isBlocked });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const bulkDeleteSupportMembers = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No support member IDs provided" });
        await Admin.deleteMany({ _id: { $in: ids }, isSupport: true });
        await logAction({ actor: req.admin?.email, action: "SUPPORT_MEMBERS_BULK_DELETED", targetType: "Admin", targetLabel: `${ids.length} support members` });
        return res.status(200).json({ message: "Support members deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const bulkBlockSupportMembers = async (req, res) => {
    try {
        const { ids, block } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No support member IDs provided" });
        await Admin.updateMany({ _id: { $in: ids }, isSupport: true }, { $set: { isBlocked: block } });
        await logAction({ actor: req.admin?.email, action: block ? "SUPPORT_MEMBERS_BULK_BLOCKED" : "SUPPORT_MEMBERS_BULK_UNBLOCKED", targetType: "Admin", targetLabel: `${ids.length} support members` });
        return res.status(200).json({ message: `Support members ${block ? 'blocked' : 'unblocked'} successfully` });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
