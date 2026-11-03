import { Examination } from "../models/examination.models.js";
import { Exam } from "../models/exam.models.js";
import { Question } from "../models/question.models.js";
import { buildMerkleRoot } from "../Services/merkle.service.js";

import mongoose from "mongoose";
import crypto from "crypto";
import { selectQuestionsByDifficultyRatio } from "../Services/question.service.js";
import { enqueueExamCommitment } from "../Services/integrityOutbox.service.js";
import { AuditLog } from "../models/auditlog.models.js";

export const createExamination = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { title, description, subjects, mode } = req.body;

        if (!title || !description || !subjects || subjects.length === 0) {
            return res.status(400).json({ message: "Title, description, and at least one subject are required." });
        }
        
        const examMode = mode === "Zeroleak" ? "Zeroleak" : "Normal";

        // 1. Create Examination
        const examination = new Examination({
            title,
            description,
            createdBy: req.admin?._id || req.user?._id, // Depends on auth middleware
        });
        await examination.save({ session });

        const createdExams = [];

        // 2. Generate an Exam for each Subject
        for (const subj of subjects) {
            const { subject, numQuestions, durationMinutes, passingPercentage } = subj;

            let questionIds = [];
            let questionMerkleRoot = null;

            if (examMode === "Normal") {
                // Randomly select questions using difficulty ratio rules
                const allQuestions = await Question.find(
                    { subject: subject },
                    { _id: 1, contentHash: 1, difficultyLevel: 1 }
                ).lean().session(session);
                
                const selectedQuestions = selectQuestionsByDifficultyRatio(allQuestions, Number(numQuestions) || 10);

                if (selectedQuestions.length === 0) {
                    throw new Error(`No questions available in the question bank for subject: ${subject}`);
                }

                // Make sure questionIds match exactly the order of selectedQuestions
                questionIds = selectedQuestions.map(q => q._id);
                const questionHashes = selectedQuestions.map(q => q.contentHash);
                questionMerkleRoot = buildMerkleRoot(questionHashes);
            }

            const exam = new Exam({
                title: `${title} - ${subject}`,
                description: `${subject} section for ${title}`,
                durationMinutes: durationMinutes || 60,
                passingPercentage: passingPercentage || 50,
                status: "Draft",
                createdBy: req.admin?._id || req.user?._id,
                examinationId: examination._id,
                subject: subject,
                mode: examMode,
                zeroleakConfig: examMode === "Zeroleak" ? { numQuestions: Number(numQuestions) || 10 } : { numQuestions: 0 },
                questions: questionIds,
                questionMerkleRoot
            });

            await exam.save({ session });



            createdExams.push(exam);
        }

        await session.commitTransaction();
        session.endSession();

        // Enqueue Fabric commitments for each newly created exam
        for (const exam of createdExams) {
            try {
                await enqueueExamCommitment(exam, 1, '');
            } catch (err) {
                console.error('[FABRIC] Failed to enqueue exam commitment (reconciler will retry):', err.message);
            }
        }

        // Audit Log for examination creation
        try {
            await AuditLog.create({
                actor: req.admin?.email || req.user?.email || "Admin",
                actorRole: "Admin",
                action: "EXAMINATION_CREATED",
                targetType: "Examination",
                targetId: String(examination._id),
                targetLabel: examination.title,
                details: `Created examination with ${createdExams.length} subject exam(s).`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[EXAMINATION] AuditLog error:", auditErr.message);
        }

        return res.status(201).json({
            message: "Examination created successfully",
            examination,
            exams: createdExams
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating examination: ", error);
        return res.status(500).json({ message: error.message || "Internal server error while creating examination" });
    }
};

export const getExaminations = async (req, res) => {
    try {
        const examinations = await Examination.find({}).sort({ createdAt: -1 }).lean();
        
        // Populate child exams for each examination
        const examinationIds = examinations.map(e => e._id);
        const childExams = await Exam.find({ examinationId: { $in: examinationIds } }).lean();

        const examsByExamination = {};
        childExams.forEach(exam => {
            if (!examsByExamination[exam.examinationId]) {
                examsByExamination[exam.examinationId] = [];
            }
            examsByExamination[exam.examinationId].push(exam);
        });

        const enrichedExaminations = examinations.map(exam => ({
            ...exam,
            subjects: examsByExamination[exam._id] || []
        }));

        return res.status(200).json({
            message: "Examinations fetched successfully",
            examinations: enrichedExaminations
        });

    } catch (error) {
        console.error("Error fetching examinations: ", error);
        return res.status(500).json({ message: "Something went wrong while fetching examinations" });
    }
};

export const updateExaminationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const examination = await Examination.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
        if (!examination) return res.status(404).json({ message: "Examination not found" });

        // Update child exams to match the new status
        await Exam.updateMany({ examinationId: id }, { status });

        // Audit Log for examination status change
        try {
            await AuditLog.create({
                actor: req.admin?.email || req.user?.email || "Admin",
                actorRole: "Admin",
                action: `EXAMINATION_${status.toUpperCase()}`,
                targetType: "Examination",
                targetId: String(examination._id),
                targetLabel: examination.title,
                details: `Examination status updated to ${status}.`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[EXAMINATION] AuditLog error:", auditErr.message);
        }

        return res.status(200).json({ message: "Status updated successfully", examination });
    } catch (error) {
        console.error("Error updating examination status:", error);
        return res.status(500).json({ message: "Failed to update status" });
    }
};

export const toggleExaminationResults = async (req, res) => {
    try {
        const { id } = req.params;
        const { isResultReleased } = req.body;
        
        const examination = await Examination.findByIdAndUpdate(id, { isResultReleased }, { returnDocument: 'after' });
        if (!examination) return res.status(404).json({ message: "Examination not found" });

        // Audit Log for results release toggle
        try {
            await AuditLog.create({
                actor: req.admin?.email || req.user?.email || "Admin",
                actorRole: "Admin",
                action: `EXAMINATION_RESULTS_${isResultReleased ? 'RELEASED' : 'HIDDEN'}`,
                targetType: "Examination",
                targetId: String(examination._id),
                targetLabel: examination.title,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[EXAMINATION] AuditLog error:", auditErr.message);
        }

        return res.status(200).json({ message: "Results release toggled", examination });
    } catch (error) {
        console.error("Error toggling results:", error);
        return res.status(500).json({ message: "Failed to toggle results" });
    }
};

export const deleteExamination = async (req, res) => {
    try {
        const { id } = req.params;
        
        const examination = await Examination.findById(id);
        if (!examination) return res.status(404).json({ message: "Examination not found" });

        // Get all child exams
        const childExams = await Exam.find({ examinationId: id }).select("_id status").lean();
        
        // Guard: Prevent deletion if any child exam is currently Live or in GracePeriod
        const activeChildExam = childExams.find(e => e.status === "Live" || e.status === "GracePeriod");
        if (activeChildExam) {
            return res.status(400).json({
                message: `Cannot delete examination while child exam is active (status: ${activeChildExam.status}). End active exams first.`
            });
        }

        const childExamIds = childExams.map(e => e._id);

        // Cascade: delete Results, CheatingIncidents, and Proctoring telemetry linked to child exams
        if (childExamIds.length > 0) {
            const { Result } = await import("../models/result.models.js");
            const { CheatingIncident } = await import("../models/cheatingIncident.models.js");
            const { ProctoringSession } = await import("../models/proctoringSession.models.js");
            const { ProctoringAIEvent } = await import("../models/proctoringAIEvent.models.js");
            const { ProctoringIncident } = await import("../models/proctoringIncident.models.js");

            await Promise.allSettled([
                Result.deleteMany({ exam: { $in: childExamIds } }),
                CheatingIncident.deleteMany({ examId: { $in: childExamIds } }),
                ProctoringSession.deleteMany({ examId: { $in: childExamIds } }),
                ProctoringAIEvent.deleteMany({ examId: { $in: childExamIds } }),
                ProctoringIncident.deleteMany({ examId: { $in: childExamIds } })
            ]);
        }

        // Delete child exams
        await Exam.deleteMany({ examinationId: id });
        
        // Delete examination
        await Examination.findByIdAndDelete(id);

        // Audit Log for examination deletion
        try {
            await AuditLog.create({
                actor: req.admin?.email || req.user?.email || "Admin",
                actorRole: "Admin",
                action: "EXAMINATION_DELETED",
                targetType: "Examination",
                targetId: String(examination._id),
                targetLabel: examination.title,
                details: `Deleted examination and cascaded ${childExamIds.length} child exam(s).`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[EXAMINATION] AuditLog error:", auditErr.message);
        }

        return res.status(200).json({ message: "Examination deleted successfully" });
    } catch (error) {
        console.error("Error deleting examination:", error);
        return res.status(500).json({ message: "Failed to delete examination" });
    }
};
