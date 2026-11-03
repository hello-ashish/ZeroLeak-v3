import { Professor } from "../models/professor.models.js";
import { Batch } from "../models/batch.models.js";
import { notifyAdmins } from "./notification.controllers.js";
import { AuditLog } from "../models/auditlog.models.js";

export const loginProfessor = async (req, res) => {

    try {
        // get login credentials from the request body with a safe fallback
        const { id, email, password } = req.body || {}

        // validate that password and at least one identifier is provided
        if (!password) {
            return res.status(400).json({ message: "Password is required" })
        }
        if (!id && !email) {
            return res.status(400).json({ message: "ID or Email is required" })
        }

        // find the professor in the database using email or id
        const professor = await Professor.findOne({
            $or: [{ id }, { email }]
        })

        if (!professor) {
            return res.status(404).json({ message: "Professor not found" })
        }

        if (professor.isBlocked) {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }

        // check if password is correct using custom method
        const isPasswordCorrect = await professor.isPasswordCorrect(password)

        if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Invalid Password" })
        }

        const forceLogout = req.body.forceLogout === true || req.body.forceLogout === "true";
        if (professor.isLoggedIn && !forceLogout) {
            return res.status(409).json({ message: "You're logged in at some other place too. Wish to continue?", code: "ALREADY_LOGGED_IN" });
        }

        professor.isLoggedIn = true;
        professor.sessionVersion = (professor.sessionVersion || 0) + 1;
        professor.lastActiveAt = new Date();
        await professor.save({ validateBeforeSave: false });

        // generate JWT token for the professor
        const token = professor.generateAccessToken()

        // if login is successful, remove the password from the data
        const loggedInProfessor = professor.toObject();
        delete loggedInProfessor.password;

        // JWT for future

        // Audit Log
        try {
            await AuditLog.create({
                actor: professor.email,
                actorRole: "Professor",
                action: "PROFESSOR_LOGIN",
                targetType: "Professor",
                targetId: String(professor._id),
                targetLabel: professor.name || professor.email,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[PROFESSOR] AuditLog error:", auditErr.message);
        }

        return res.status(200).json({
            message: "Professor logged in successfully",
            token,
            professor: loggedInProfessor
        })
    } catch (error) {
        console.error("Error logging in professor: ", error)
        return res.status(500).json({
            message: "Internal server error while logging in professor"
        })
    }
}

export const logoutProfessor = async (req, res) => {
    try {
        const professor = await Professor.findById(req.professor._id);
        if (professor) {
            professor.isLoggedIn = false;
            professor.sessionVersion = (professor.sessionVersion || 0) + 1;
            await professor.save({ validateBeforeSave: false });

            try {
                await AuditLog.create({
                    actor: professor.email,
                    actorRole: "Professor",
                    action: "PROFESSOR_LOGOUT",
                    targetType: "Professor",
                    targetId: String(professor._id),
                    targetLabel: professor.name || professor.email,
                    status: "success"
                });
            } catch (auditErr) {
                console.error("[PROFESSOR] AuditLog error on logout:", auditErr.message);
            }
        }
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        return res.status(500).json({ message: "Error logging out", error: error.message });
    }
}

// 1. Create a new Batch
export const createBatch = async (req, res) => {
    try {
        const { title, description, subject } = req.body

        const batch = await Batch.create({
            title, description, subject, createdBy: req.professor._id
        })
        res.status(201).json({
            message: "Batch created successfully", batch
        })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

// 2. Add Question to a Draft Batch
export const addQuestionToBatch = async (req, res) => {
    try {
        const { batchId } = req.params
        const questionData = req.body

        const batch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id })
        if (!batch) {
            return res.status(404).json({ message: "Batch not found." })
        }
        if(batch.status !== 'Draft' && batch.status !== 'MarkForReview') {
            return res.status(400).json({ message: "Can only edit Draft or Review batches." })
        }
        
        questionData.subject = batch.subject;
        
        batch.questions.push(questionData)
        await batch.save()
        res.status(200).json({ message: "Question added", batch })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// Bulk Add Questions to a Draft Batch
export const bulkAddQuestionsToBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { questions } = req.body; // array of questions

        const batch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id });
        if (!batch) {
            return res.status(404).json({ message: "Batch not found." });
        }
        if (batch.status !== 'Draft' && batch.status !== 'MarkForReview') {
            return res.status(400).json({ message: "Can only edit Draft or Review batches." });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: "No questions provided." });
        }

        const validQuestions = questions.map(q => ({
            ...q,
            subject: batch.subject
        }));

        batch.questions.push(...validQuestions);
        await batch.save();

        res.status(200).json({ message: `${validQuestions.length} questions added successfully`, batch });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Edit Question in a Draft Batch
export const editQuestionInBatch = async (req, res) => {
    try {
        const { batchId, questionId } = req.params
        const questionData = req.body

        const batch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id })
        if (!batch) {
            return res.status(404).json({ message: "Batch not found." })
        }
        if(batch.status !== 'Draft' && batch.status !== 'MarkForReview') {
            return res.status(400).json({ message: "Can only edit Draft or Review batches." })
        }
        
        const question = batch.questions.id(questionId)
        if (!question) {
            return res.status(404).json({ message: "Question not found." })
        }

        questionData.subject = batch.subject;
        question.set(questionData)

        await batch.save()
        res.status(200).json({ message: "Question updated", batch })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// Delete Question from a Draft Batch
export const deleteQuestionFromBatch = async (req, res) => {
    try {
        const { batchId, questionId } = req.params

        const batch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id })
        if (!batch) {
            return res.status(404).json({ message: "Batch not found." })
        }
        if(batch.status !== 'Draft' && batch.status !== 'MarkForReview') {
            return res.status(400).json({ message: "Can only edit Draft or Review batches." })
        }
        
        batch.questions.pull(questionId)

        await batch.save()
        res.status(200).json({ message: "Question deleted", batch })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// 3. Submit Batch to Admin
export const submitBatch = async (req, res) => {
    try {
        const { batchId } = req.params

        // Fetch first to validate before updating
        const existingBatch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id })
        if (!existingBatch) {
            return res.status(404).json({ message: "Batch not found." })
        }
        if (existingBatch.status !== 'Draft' && existingBatch.status !== 'MarkForReview') {
            return res.status(400).json({ message: "Only Draft or Review batches can be submitted." })
        }
        // Bug #14: Prevent submitting empty batches
        if (!existingBatch.questions || existingBatch.questions.length === 0) {
            return res.status(400).json({ message: "Cannot submit an empty batch. Please add at least one question." })
        }

        const invalidQuestion = existingBatch.questions.find((q) => {
            return !q.title || !q.options || q.options.length < 2 || (q.correctAnswerIndex === undefined && !q.correctAnswer);
        });
        if (invalidQuestion) {
            return res.status(400).json({ message: "All questions must have a title, at least 2 options, and a correct answer before submission." });
        }

        existingBatch.status = "Submitted";
        const batch = await existingBatch.save();

        await notifyAdmins({
            title: "New Batch Submitted",
            message: `A new batch "${batch.title}" has been submitted for review.`,
            type: "INFO",
            relatedLink: "/admin/batches"
        });

        // Audit Log
        try {
            await AuditLog.create({
                actor: req.professor?.email || "Professor",
                actorRole: "Professor",
                action: "BATCH_SUBMITTED",
                targetType: "Batch",
                targetId: String(batch._id),
                targetLabel: batch.title,
                details: `Submitted batch with ${batch.questions?.length || 0} questions for review.`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[PROFESSOR] AuditLog error:", auditErr.message);
        }

        res.status(200).json({ message: "Batch submitted to Admin", batch })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// 4. Get Professor's Batches (For History and Active views)
export const getMyBatches = async (req, res) => {
    try {
        const batches = await Batch.find({ createdBy: req.professor._id, isDeletedByProfessor: { $ne: true } })
            .sort({ createdAt: -1 })
            .lean();

        const sanitizedBatches = batches.map(batch => {
            if (batch.status === 'Accepted' && Array.isArray(batch.questions)) {
                return {
                    ...batch,
                    questions: batch.questions.map(q => ({
                        _id: q._id,
                        title: q.contentHash || (q.title && /^[a-f0-9]{64}$/i.test(q.title) ? q.title : "[Encrypted Question Hash]"),
                        options: [],
                        difficultyLevel: q.difficultyLevel,
                        subject: q.subject,
                        topic: q.topic,
                        contentHash: q.contentHash,
                        questionId: q.questionId,
                        createdAt: q.createdAt,
                        updatedAt: q.updatedAt
                    }))
                };
            }
            return batch;
        });

        res.status(200).json({ batches: sanitizedBatches });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Delete Batch
export const deleteBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findOne({ _id: batchId, createdBy: req.professor._id });

        if (!batch) {
            return res.status(404).json({ message: "Batch not found" });
        }

        if (batch.status === "Submitted") {
            return res.status(400).json({ message: "Cannot delete a submitted batch" });
        }

        batch.isDeletedByProfessor = true;
        await batch.save();

        // Audit Log
        try {
            await AuditLog.create({
                actor: req.professor?.email || "Professor",
                actorRole: "Professor",
                action: "BATCH_DELETED",
                targetType: "Batch",
                targetId: String(batch._id),
                targetLabel: batch.title,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[PROFESSOR] AuditLog error:", auditErr.message);
        }

        res.status(200).json({ message: "Batch deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// 5. Update Professor Profile
export const updateProfessorProfile = async (req, res) => {
    try {
        const { name, email, contact, address, password } = req.body
        const professor = await Professor.findById(req.professor._id)

        if (name) professor.name = name
        if (email) professor.email = email
        if (contact) professor.contact = contact
        if (address) professor.address = address
        if (password) {
            professor.password = password;
            professor.sessionVersion = (professor.sessionVersion || 0) + 1;
        }

        await professor.save()

        const updatedProfessor = professor.toObject();
        delete updatedProfessor.password;
        return res.status(200).json({
            message: "Profile Updated Successfully", professor: updatedProfessor
        })
    } catch (error) {
         return res.status(500).json({ message: "Error updating profile", error: error.message })
    }
}

// 6. Change Professor Password
export const changeProfessorPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        const professor = await Professor.findById(req.professor._id)
        
        const isPasswordCorrect = await professor.isPasswordCorrect(oldPassword)
        if (!isPasswordCorrect) {
             return res.status(401).json({ message: "Incorrect current password" })
        }
        
        professor.password = newPassword
        professor.sessionVersion = (professor.sessionVersion || 0) + 1;
        await professor.save()
        
        return res.status(200).json({ message: "Password updated successfully" })
    } catch (error) {
         return res.status(500).json({ message: "Error changing password", error: error.message })
    }
}