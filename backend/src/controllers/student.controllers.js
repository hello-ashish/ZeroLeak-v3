import { Student } from "../models/student.models.js"
import { Exam } from "../models/exam.models.js"
import { Result } from "../models/result.models.js";
import { CheatingIncident } from "../models/cheatingIncident.models.js";
import { AuditLog } from "../models/auditlog.models.js";
import { Question } from "../models/question.models.js";
import {
    decryptQuestionContent,
    verifyQuestionIntegrity,
} from "../Services/crypto.service.js"

import { buildMerkleRoot } from "../Services/merkle.service.js"

import crypto from "crypto";
import { selectQuestionsByDifficultyRatio } from "../Services/question.service.js";
import { ensureZMailAccount } from "../Services/zmail/zmailIdentity.service.js";
import { enqueueResultCommitment } from "../Services/integrityOutbox.service.js";

// 1. Register Student
export const registerStudent = async (req, res) => {
    try {
        const { studentId, name, email, password, department, batch, contact, dateOfBirth, address, gender, program } = req.body;
        if (!studentId || !name || !email || !password) return res.status(400).json({ message: "All fields required" });
        const existingStudent = await Student.findOne({ $or: [{ studentId }, { email }] });
        if (existingStudent) return res.status(400).json({ message: "Student already exists" });

        const studentData = { studentId, name, email, password, department, batch, contact, address, gender, program };
        if (dateOfBirth) studentData.dateOfBirth = dateOfBirth;

        const student = await Student.create(studentData);
        const createdStudent = student.toObject();
        delete createdStudent.password;

        // Provision ZMail account for the new student (non-blocking)
        ensureZMailAccount({ userId: student._id, userType: "Student", displayName: name, loginEmail: email })
            .catch(err => console.warn("[ZMAIL] Failed to provision account for student", student._id, err.message));

        return res.status(201).json({ message: "Student registered", student: createdStudent });
    } catch (error) {
        return res.status(500).json({ message: "Error registering student", error: error.message });
    }
}

// 2. Login Student
export const loginStudent = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password required" });
        const student = await Student.findOne({ email });
        if (!student) return res.status(404).json({ message: "Student not found" });
        if (student.isBlocked) return res.status(403).json({ message: "Your account has been restricted by an administrator." });

        const isPasswordValid = await student.isPasswordCorrect(password);
        if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials" });

        // Parse forceLogout safely — some clients send the string "true" instead of boolean true
        const forceLogout = req.body.forceLogout === true || req.body.forceLogout === "true";
        if (student.isLoggedIn && !forceLogout) {
            return res.status(409).json({ message: "You're logged in at some other place too. Wish to continue?", code: "ALREADY_LOGGED_IN" });
        }

        student.isLoggedIn = true;
        student.lastActiveAt = new Date();
        student.sessionVersion = (student.sessionVersion || 0) + 1;
        await student.save({ validateBeforeSave: false });

        const token = student.generateAccessToken();
        const loggedInStudent = student.toObject();
        delete loggedInStudent.password;

        // Audit Log
        try {
            await AuditLog.create({
                actor: student.email,
                actorRole: "Student",
                action: "STUDENT_LOGIN",
                targetType: "Student",
                targetId: String(student._id),
                targetLabel: student.name,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[STUDENT] AuditLog error:", auditErr.message);
        }

        return res.status(200).json({ message: "Login successful", token, student: loggedInStudent });
    } catch (error) {
        return res.status(500).json({ message: "Error logging in", error: error.message });
    }
}

// 2a. Logout Student
export const logoutStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.student._id);
        if (student) {
            student.isLoggedIn = false;
            student.sessionVersion = (student.sessionVersion || 0) + 1;
            await student.save({ validateBeforeSave: false });

            try {
                await AuditLog.create({
                    actor: student.email,
                    actorRole: "Student",
                    action: "STUDENT_LOGOUT",
                    targetType: "Student",
                    targetId: String(student._id),
                    targetLabel: student.name,
                    status: "success"
                });
            } catch (auditErr) {
                console.error("[STUDENT] AuditLog error on logout:", auditErr.message);
            }
        }
        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        return res.status(500).json({ message: "Error logging out", error: error.message });
    }
}

// 2b. Ping Session (Live tracking)
export const pingSession = async (req, res) => {
    try {
        const { currentExamId, warningCount, answers } = req.body;
        // The verifyStudentJWT middleware will automatically reject this if the student is blocked.
        const student = req.student;

        // M-3 Fix: Derive the violation count from the DB, not from the client-supplied warningCount.
        // A malicious client could always send warningCount=0 to bypass enforcement.
        const MAX_VIOLATIONS = 5;
        const serverViolationCount = await CheatingIncident.countDocuments({
            studentId: student._id,
            examId: currentExamId || null,
        });

        // Happy Path Optimization: Atomic update, skip heavy logic and document saves
        if (serverViolationCount < MAX_VIOLATIONS) {
            const updateFields = { lastActiveAt: new Date() };
            if (currentExamId) updateFields.currentExamId = currentExamId;

            await Student.findByIdAndUpdate(student._id, { $set: updateFields });
            return res.status(200).json({ message: "Ping successful" });
        }

        // --- Slow Path: Security Enforcement ---
        student.lastActiveAt = new Date();
        if (currentExamId) {
            student.currentExamId = currentExamId;

            if (answers && Array.isArray(answers)) {
                await Result.updateOne(
                    { student: student._id, exam: currentExamId, status: "InProgress", resetByAdmin: { $ne: true } },
                    { $set: { latestAnswers: answers } }
                );
            }
        }

        // Network Interception Bypass Protection
        // Server-side violation count (from DB) is used — the client warningCount is advisory only.
        if (serverViolationCount >= MAX_VIOLATIONS && currentExamId) {
            const exam = await Exam.findById(currentExamId);

            if (exam) {
                // Terminate attempt if not already terminated
                let result = await Result.findOne({ student: student._id, exam: currentExamId, resetByAdmin: { $ne: true } });
                if (!result || !result.isTerminated) {
                    if (result) {
                        result.status = "Terminated";
                        result.isTerminated = true;
                        result.terminationReason = "Auto-terminated via telemetry ping: exceeded maximum security violations.";
                        await result.save();
                    } else {
                        try {
                            result = await Result.create({
                                student: student._id,
                                exam: currentExamId,
                                score: 0,
                                totalQuestions: exam.questions ? exam.questions.length : 0,
                                status: "Terminated",
                                isTerminated: true,
                                terminationReason: "Auto-terminated via telemetry ping: exceeded maximum security violations."
                            });
                        } catch (error) {
                            if (error.code === 11000) {
                                result = await Result.findOne({ student: student._id, exam: currentExamId, resetByAdmin: { $ne: true } });
                                if (result) {
                                    result.status = "Terminated";
                                    result.isTerminated = true;
                                    result.terminationReason = "Auto-terminated via telemetry ping: exceeded maximum security violations.";
                                    await result.save();
                                }
                            } else {
                                console.error("[Telemetry] Error creating terminated result:", error);
                            }
                        }
                    }

                    // Create an incident record for audit safely
                    try {
                        await CheatingIncident.create({
                            studentId: student._id,
                            examId: currentExamId,
                            attemptId: result?._id,
                            violationType: "EXAM_TERMINATION",
                            severity: "Critical",
                            description: `Exam attempt auto-terminated via telemetry ping: exceeded ${MAX_VIOLATIONS} security violations.`,
                            detectedAt: new Date(),
                            actionTaken: "STUDENT_BLOCKED",
                            reviewStatus: "Pending"
                        });
                    } catch (incErr) {
                        console.error("[Telemetry] Failed to create cheating incident record:", incErr);
                    }
                }

                // Block the student and invalidate active sessions
                if (!student.isBlocked) {
                    student.isBlocked = true;
                    student.sessionVersion = (student.sessionVersion || 1) + 1;
                    student.blockedAt = new Date();
                    student.blockedReason = `Exam "${exam.title}" — blocked via telemetry after ${MAX_VIOLATIONS} security violations.`;

                    try {
                        await AuditLog.create({
                            actor: student.email,
                            actorRole: "System",
                            action: "STUDENT_AUTO_BLOCKED",
                            targetType: "Student",
                            targetId: String(student._id),
                            targetLabel: student.name,
                            details: `Student ${student.email} auto-blocked via telemetry on exam "${exam.title}".`,
                            status: "success"
                        });
                    } catch (auditErr) { }
                }
            }
        }

        await student.save();

        if (student.isBlocked) {
            return res.status(403).json({ message: "BLOCKED" });
        }
        return res.status(200).json({ message: "Ping successful" });
    } catch (error) {
        return res.status(500).json({ message: "Error pinging session", error: error.message });
    }
}

// 3. Get all available Exams for Students to see!
export const getAvailableExams = async (req, res) => {
    try {
        // We fetch ALL exams that are Live, Scheduled, or Completed, and use .populate to inject the Admin's email into the "createdBy" field
        const exams = await Exam.find({ status: { $in: ["Live", "Scheduled", "Completed"] } })
            .populate("createdBy", "email")
            .populate("examinationId", "title description isResultReleased")
            .sort({ createdAt: -1 });
        return res.status(200).json({ exams });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching exams", error: error.message });
    }
}

// 4. Fetch all students (for Admins only)
export const getAllStudents = async (req, res) => {
    try {
        const students = await Student.find().select("-password").sort({ createdAt: -1 }).lean();
        return res.status(200).json({ students });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching students", error: error.message });
    }
}

// 5. Fetch a single exam by its id
export const getExamById = async (req, res) => {
    try {
        const { id } = req.params

        const exam = await Exam.findById(id)
            .populate("createdBy", "email")
            .populate("questions")

        if (!exam) {
            return res.status(404).json({
                message: "Exam not found"
            })
        }

        if (exam.status !== "Live" && exam.status !== "GracePeriod") {
            return res.status(403).json({
                message: "This exam is not currently active."
            });
        }

        // Protected exams must have a Merkle root
        if (!exam.questionMerkleRoot && exam.mode !== "Zeroleak") {
            return res.status(403).json({
                message:
                    "This exam is not protected and cannot be accessed."
            })
        }

        let existingResult = await Result.findOne({
            student: req.student._id,
            exam: exam._id,
            resetByAdmin: { $ne: true }
        }).populate("assignedQuestions");

        if (existingResult && existingResult.status !== "InProgress") {
            return res.status(403).json({
                message: "You have already completed or been terminated from this exam."
            });
        }

        let examQuestions = exam.questions;

        let needsNewResult = false;
        let questionsToAssign = [];

        if (exam.mode === "Zeroleak") {
            if (existingResult) {
                examQuestions = existingResult.assignedQuestions;
            } else {
                const allQuestions = await Question.find({ subject: exam.subject });
                const selectedQuestions = selectQuestionsByDifficultyRatio(allQuestions, Number(exam.zeroleakConfig?.numQuestions) || 10);

                if (selectedQuestions.length === 0) {
                    return res.status(400).json({ message: "No questions available for this subject." });
                }

                questionsToAssign = selectedQuestions.map(q => q._id);
                examQuestions = selectedQuestions;
                needsNewResult = true;
            }
        } else {
            if (!existingResult) {
                questionsToAssign = examQuestions.map(q => q._id);
                needsNewResult = true;
            }
        }

        if (examQuestions.length === 0) {
            return res.status(400).json({
                message: "Exam contains no questions."
            })
        }

        const questionHashes = []
        const safeQuestions = []

        for (const question of examQuestions) {

            // Every question must contain encrypted content
            if (
                !question.encryptedContent ||
                !question.contentHash
            ) {
                return res.status(403).json({
                    message:
                        "Exam integrity verification failed."
                })
            }

            // Verify individual question integrity
            const isValid = verifyQuestionIntegrity(
                question.encryptedContent,
                question.contentHash
            )

            if (!isValid) {
                console.error(
                    `Integrity check failed for question ${question._id}`
                )

                return res.status(403).json({
                    message:
                        "Question integrity verification failed."
                })
            }

            questionHashes.push(
                question.contentHash
            )

            // Decrypt only after integrity verification
            const decryptedContent =
                decryptQuestionContent(
                    question.encryptedContent
                )

            // Never send the correct answer to the student
            safeQuestions.push({
                _id: question._id,
                title: decryptedContent.title,
                options: decryptedContent.options,
                difficultyLevel:
                    question.difficultyLevel,
                subject: question.subject,
                topic: question.topic,
            })
        }

        // Rebuild the Merkle root
        const calculatedMerkleRoot =
            buildMerkleRoot(questionHashes)

        // Verify the complete exam
        // Note (M-2): Standard exams include all questions, so calculatedMerkleRoot matches exam.questionMerkleRoot.
        // Zeroleak mode assigns a randomized subset of pool questions to each student; individual question
        // cryptographic integrity was already verified above via verifyQuestionIntegrity().
        if (exam.mode !== "Zeroleak") {
            if (
                calculatedMerkleRoot !==
                exam.questionMerkleRoot
            ) {
                console.error(
                    "Exam Merkle root verification failed."
                )

                return res.status(403).json({
                    message:
                        "Exam integrity verification failed."
                })
            }
        }

        if (needsNewResult) {
            try {
                existingResult = await Result.create({
                    student: req.student._id,
                    exam: exam._id,
                    score: 0,
                    totalQuestions: questionsToAssign.length,
                    status: "InProgress",
                    assignedQuestions: questionsToAssign
                });
            } catch (error) {
                if (error.code === 11000) {
                    return res.status(409).json({ message: "Exam session already initialized. Please refresh the page to continue." });
                }
                throw error;
            }
        }

        // Convert mongoose document to plain object
        const safeExam = exam.toObject()

        // Replace protected questions with safe questions
        safeExam.questions = safeQuestions

        // Never expose the stored Merkle implementation details
        // to the student unnecessarily
        delete safeExam.questionMerkleRoot

        return res.status(200).json({
            exam: safeExam,
            serverNow: new Date(),
            examStartedAt: exam.scheduledAt,
            examEndsAt: exam.endsAt
        })

    } catch (error) {
        console.error(
            "Error fetching exam: ",
            error
        )

        return res.status(500).json({
            message:
                "Error fetching exam"
        })
    }
}

// 6. Save exam score to the database
export const submitExamResult = async (req, res) => {
    try {
        const {
            examId,
            answers
        } = req.body

        if (
            !examId ||
            !Array.isArray(answers)
        ) {
            return res.status(400).json({
                message:
                    "Exam ID and answers are required."
            })
        }

        // Prevent duplicate submissions.
        // Skip results marked resetByAdmin=true — those are audit records for terminated/authorized attempts.
        let existingResult = await Result.findOne({
            student: req.student._id,
            exam: examId,
            resetByAdmin: { $ne: true }
        }).populate("assignedQuestions")

        if (!existingResult || existingResult.status !== "InProgress") {
            return res.status(400).json({
                message: "Exam session not found or already completed."
            })
        }

        // Load exam and its protected questions
        const exam = await Exam.findById(examId)
            .populate("questions")
            .populate("examinationId")

        if (!exam) {
            return res.status(404).json({
                message: "Exam not found."
            })
        }

        if (exam.status !== "Live" && exam.status !== "GracePeriod") {
            return res.status(403).json({
                message: "This exam is no longer active."
            });
        }

        // Protected exams must contain a Merkle root unless it is a Zeroleak exam
        if (exam.mode !== "Zeroleak" && !exam.questionMerkleRoot) {
            return res.status(403).json({
                message:
                    "This exam is not protected."
            })
        }

        if (exam.questions.length === 0 && exam.mode !== "Zeroleak") {
            return res.status(400).json({
                message: "Exam contains no questions."
            })
        }

        // --- ENFORCE EXAM TIMING ---
        const now = new Date();
        const gracePeriodMs = 5 * 60 * 1000; // 5 minutes grace period

        if (exam.endsAt && now.getTime() > exam.endsAt.getTime() + gracePeriodMs) {
            // Auto-terminate the exam for exceeding time
            existingResult.status = "Terminated";
            existingResult.isTerminated = true;
            existingResult.terminationReason = "Exam duration exceeded.";
            await existingResult.save();

            return res.status(400).json({
                message: "Exam duration exceeded."
            });
        }
        // ---------------------------

        let examQuestions = exam.questions;
        if (exam.mode === "Zeroleak") {
            examQuestions = existingResult.assignedQuestions;
        }

        if (examQuestions.length === 0) {
            return res.status(400).json({ message: "Exam contains no questions." });
        }

        const questionHashes = []
        const decryptedQuestions = []

        // Verify and decrypt every question
        for (const question of examQuestions) {

            if (
                !question.encryptedContent ||
                !question.contentHash
            ) {
                return res.status(403).json({
                    message:
                        "Exam integrity verification failed."
                })
            }

            const isValid =
                verifyQuestionIntegrity(
                    question.encryptedContent,
                    question.contentHash
                )

            if (!isValid) {
                console.error(
                    `Question integrity failed during submission: ${question._id}`
                )

                return res.status(403).json({
                    message:
                        "Question integrity verification failed."
                })
            }

            questionHashes.push(
                question.contentHash
            )

            const decryptedContent =
                decryptQuestionContent(
                    question.encryptedContent
                )

            decryptedQuestions.push({
                id: String(question._id),
                correctAnswerIndex:
                    decryptedContent.correctAnswerIndex,
                optionsLength: decryptedContent.options ? decryptedContent.options.length : 0
            })
        }

        // Rebuild and verify Merkle root
        const calculatedMerkleRoot =
            buildMerkleRoot(questionHashes)

        if (exam.mode !== "Zeroleak") {
            if (
                calculatedMerkleRoot !==
                exam.questionMerkleRoot
            ) {
                console.error(
                    "Exam Merkle root verification failed during submission."
                )

                return res.status(403).json({
                    message:
                        "Exam integrity verification failed."
                })
            }
        }

        // Create a lookup map for submitted answers with strict validation
        const validQuestionIds = new Map();
        for (const dq of decryptedQuestions) {
            validQuestionIds.set(dq.id, dq.optionsLength);
        }

        const answerMap = new Map();

        for (const answer of answers) {
            if (!answer || !answer.questionId) {
                continue;
            }

            const qId = String(answer.questionId);

            // 1. Validate that the question belongs to this exam attempt
            if (!validQuestionIds.has(qId)) {
                return res.status(400).json({
                    message: `Invalid question submitted: ${qId} does not belong to this exam attempt.`
                });
            }

            // 2. Treat absent or null values as unanswered (skip)
            if (answer.selectedOptionIndex === null || answer.selectedOptionIndex === undefined || answer.selectedOptionIndex === '') {
                continue;
            }

            // 3. Reject any selected answer that is not an integer within the valid option range
            const selected = Number(answer.selectedOptionIndex);
            const numOptions = validQuestionIds.get(qId);

            if (!Number.isInteger(selected) || selected < 0 || selected >= numOptions) {
                return res.status(400).json({
                    message: `Invalid option index provided for question ${qId}.`
                });
            }

            answerMap.set(qId, selected);
        }

        // Calculate score on the server
        let score = 0

        for (const question of decryptedQuestions) {
            const submittedAnswer =
                answerMap.get(question.id)

            if (
                submittedAnswer !== undefined &&
                Number(submittedAnswer) ===
                Number(question.correctAnswerIndex)
            ) {
                score++
            }
        }

        const totalQuestions =
            decryptedQuestions.length

        existingResult.score = score;
        existingResult.totalQuestions = totalQuestions;
        existingResult.status = "Completed";
        existingResult.latestAnswers = answers;
        const result = await existingResult.save();

        try {
            await enqueueResultCommitment(result);
        } catch (err) {
            console.error('[FABRIC] Failed to enqueue result commitment (reconciler will retry):', err.message);
        }

        // --- ENFORCE RESULT-RELEASE POLICY ON RETURN ---
        const isReleased = exam.examinationId
            ? exam.examinationId.isResultReleased === true
            : exam.isResultReleased === true;

        const returnedResult = result.toObject();
        if (!isReleased) {
            returnedResult.score = null;
        }
        // -----------------------------------------------

        // Audit Log
        try {
            await AuditLog.create({
                actor: req.student?.email || "Student",
                actorRole: "Student",
                action: "EXAM_SUBMITTED",
                targetType: "Exam",
                targetId: String(exam._id),
                targetLabel: exam.title,
                details: `Score: ${score}/${totalQuestions}`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[STUDENT] AuditLog error:", auditErr.message);
        }

        return res.status(201).json({
            message:
                "Exam submitted successfully.",
            result: returnedResult
        })

    } catch (error) {
        console.error(
            "Error submitting exam: ",
            error
        )

        return res.status(500).json({
            message:
                "Error submitting exam",
        })
    }
}

// 7. Fetch all results for the logged-in student
export const getStudentResults = async (req, res) => {
    try {
        const results = await Result.find({ student: req.student._id })
            .populate({
                path: "exam",
                select: "title isResultReleased examinationId",
                populate: {
                    path: "examinationId",
                    select: "isResultReleased title"
                }
            })
            .sort({ createdAt: -1 })
            .lean()

        // Scrub scores for unreleased exams
        const scrubbedResults = results.map(result => {
            if (result.exam) {
                const isReleased = result.exam.examinationId
                    ? result.exam.examinationId.isResultReleased === true
                    : result.exam.isResultReleased === true;

                if (!isReleased && result.status !== "InProgress") {
                    result.score = null;
                }
            }
            return result;
        });

        return res.status(200).json({ results: scrubbedResults })
    } catch (error) {
        return res.status(500).json({ message: "Error fetching results", error: error.message })
    }
}

// 8. Update Student Profile
export const updateStudentProfile = async (req, res) => {
    try {
        const { name, email, password } = req.body
        const student = await Student.findById(req.student._id)

        if (name) student.name = name
        // H-6 Fix: Check email uniqueness before updating to return a clean 409 instead of raw 500
        if (email && email !== student.email) {
            const emailTaken = await Student.findOne({ email, _id: { $ne: student._id } }).lean();
            if (emailTaken) {
                return res.status(409).json({ message: "Email is already in use by another account." });
            }
            student.email = email;
        }
        if (password) {
            student.password = password;
            student.sessionVersion = (student.sessionVersion || 0) + 1;
        }

        await student.save()

        const updatedStudent = student.toObject();
        delete updatedStudent.password;
        return res.status(200).json({
            message: "profile updated successfully", student: updatedStudent
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error updating profile", error: error.message
        })
    }
}

// 9. Change Student Password
export const changeStudentPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        const student = await Student.findById(req.student._id)

        const isPasswordCorrect = await student.isPasswordCorrect(oldPassword)
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Incorrect current password" })
        }

        student.password = newPassword
        student.sessionVersion = (student.sessionVersion || 0) + 1;
        await student.save()

        return res.status(200).json({ message: "Password updated successfully" })
    } catch (error) {
        return res.status(500).json({ message: "Error changing password", error: error.message })
    }
}