import Groq from "groq-sdk"
import crypto from "crypto"
import { AI_MODEL, PROMPT_VERSIONS } from "./ai.policy.js"
import { BATCH_GENERATE_PROMPT, QUESTION_GENERATE_PROMPT, CSV_REPAIR_PROMPT, CSV_BATCH_REPAIR_PROMPT } from "./ai.prompts.js"
import { validateBatchResponse, validateQuestionResponse, validateCsvRepairResponse, validateBatchCsvRepairResponse } from "./ai.validation.js"
import { AuditLog } from "../../models/auditlog.models.js"

let groqClient = null

function getClient() {
    if (!groqClient) {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            throw new Error("GROQ_API_KEY is not configured in environment variables.")
        }
        groqClient = new Groq({ apiKey })
    }
    return groqClient
}

async function callLLM(systemPrompt, userPrompt, jsonSchema) {
    const client = getClient()

    const params = {
        model: AI_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: jsonSchema
            ? { type: "json_schema", json_schema: jsonSchema }
            : { type: "json_object" },
    }

    const completion = await client.chat.completions.create(params)

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
        throw new Error("LLM returned empty response")
    }

    try {
        let jsonContent = content.trim()
        const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
            jsonContent = codeBlockMatch[1].trim()
        } else {
            const jsonObjectMatch = jsonContent.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
            if (jsonObjectMatch) {
                jsonContent = jsonObjectMatch[1].trim()
            }
        }
        return JSON.parse(jsonContent)
    } catch (e) {
        throw new Error("LLM returned non-JSON response: " + content.substring(0, 200))
    }
}

async function logAiAction({ professorId, actorId, actorRole = "Professor", action, promptVersion, requestData, responseData, status }) {
    try {
        const finalActorId = (actorId || professorId || "SYSTEM").toString();
        const finalRole = (actorId || professorId) ? actorRole : "System";
        const requestHash = crypto.createHash("sha256").update(JSON.stringify(requestData || {})).digest("hex")
        const responseHash = crypto.createHash("sha256").update(JSON.stringify(responseData || {})).digest("hex")

        await AuditLog.create({
            actor: finalActorId,
            actorRole: finalRole,
            action,
            targetType: "AI",
            details: JSON.stringify({
                promptVersion,
                modelVersion: AI_MODEL,
                requestHash,
                responseHash,
            }),
            status: status === "SUCCESS" ? "success" : "failure",
        })
    } catch (err) {
        console.error("[AI AUDIT] Failed to log AI action:", err.message)
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateBatchDetails(name, professorId) {
    const requestData = { name }

    try {
        const raw = await callLLM(
            BATCH_GENERATE_PROMPT.system,
            BATCH_GENERATE_PROMPT.user(name),
            {
                name: "batch_details",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        subject: { type: "string" },
                        description: { type: "string" },
                        needsReview: { type: "boolean" },
                        reason: { type: "string" },
                        confidence: { type: "number" },
                    },
                    required: ["subject", "description", "needsReview", "reason", "confidence"],
                    additionalProperties: false,
                }
            }
        )

        const validated = validateBatchResponse(raw)

        await logAiAction({
            professorId,
            action: "AI_GENERATE_BATCH",
            promptVersion: PROMPT_VERSIONS.BATCH,
            requestData,
            responseData: validated.valid ? validated.data : raw,
            status: validated.valid ? "SUCCESS" : "FAILURE",
        })

        if (!validated.valid) {
            return { success: false, error: validated.error }
        }

        return { success: true, data: validated.data }
    } catch (error) {
        await logAiAction({
            professorId,
            action: "AI_GENERATE_BATCH",
            promptVersion: PROMPT_VERSIONS.BATCH,
            requestData,
            responseData: { error: error.message },
            status: "FAILURE",
        })
        throw error
    }
}

/**
 * Generate question details (topic, difficulty, options, correct answer) from question text.
 */
export async function generateQuestionDetails(question, subject, topic, clarification, professorId) {
    const requestData = { question, subject, topic, clarification }

    try {
        const raw = await callLLM(
            QUESTION_GENERATE_PROMPT.system,
            QUESTION_GENERATE_PROMPT.user(question, subject, topic, clarification),
            {
                name: "question_details",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        topic: { type: "string" },
                        difficultyLevel: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctAnswerIndex: { type: "number" },
                        correctAnswer: { type: "string" },
                        needsReview: { type: "boolean" },
                        reason: { type: "string" },
                        confidence: { type: "number" },
                    },
                    required: ["topic", "difficultyLevel", "options", "correctAnswerIndex", "correctAnswer", "needsReview", "reason", "confidence"],
                    additionalProperties: false,
                }
            }
        )

        const validated = validateQuestionResponse(raw)

        await logAiAction({
            professorId,
            action: "AI_GENERATE_QUESTION",
            promptVersion: PROMPT_VERSIONS.QUESTION,
            requestData,
            responseData: validated.valid ? validated.data : raw,
            status: validated.valid ? "SUCCESS" : "FAILURE",
        })

        if (!validated.valid) {
            return { success: false, error: validated.error }
        }

        return { success: true, data: validated.data }
    } catch (error) {
        await logAiAction({
            professorId,
            action: "AI_GENERATE_QUESTION",
            promptVersion: PROMPT_VERSIONS.QUESTION,
            requestData,
            responseData: { error: error.message },
            status: "FAILURE",
        })
        throw error
    }
}

/**
 * Repair a single incomplete CSV row.
 */
export async function repairImportedQuestion(row, missingFields, subject, professorId) {
    const requestData = { row, missingFields, subject }

    try {
        const raw = await callLLM(
            CSV_REPAIR_PROMPT.system,
            CSV_REPAIR_PROMPT.user(row, missingFields, subject),
            {
                name: "csv_repair",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        topic: { type: "string" },
                        difficultyLevel: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctAnswerIndex: { type: "number" },
                        correctAnswer: { type: "string" },
                        needsReview: { type: "boolean" },
                        reason: { type: "string" },
                        confidence: { type: "number" },
                    },
                    required: ["title", "topic", "difficultyLevel", "options", "correctAnswerIndex", "correctAnswer", "needsReview", "reason", "confidence"],
                    additionalProperties: false,
                }
            }
        )

        const validated = validateCsvRepairResponse(raw, row, missingFields)

        await logAiAction({
            professorId,
            action: "AI_REPAIR_CSV",
            promptVersion: PROMPT_VERSIONS.CSV_REPAIR,
            requestData,
            responseData: validated.valid ? validated.data : raw,
            status: validated.valid ? "SUCCESS" : "FAILURE",
        })

        if (!validated.valid) {
            return { success: false, error: validated.error }
        }

        return { success: true, data: validated.data }
    } catch (error) {
        await logAiAction({
            professorId,
            action: "AI_REPAIR_CSV",
            promptVersion: PROMPT_VERSIONS.CSV_REPAIR,
            requestData,
            responseData: { error: error.message },
            status: "FAILURE",
        })
        throw error
    }
}

/**
 * Batch repair multiple incomplete CSV rows in a single LLM call.
 * Each row maintains a stable rowIndex to map back to the frontend.
 */
export async function batchRepairImportedQuestions(rows, subject, professorId) {
    const requestData = { rowCount: rows.length, subject }

    try {
        const raw = await callLLM(
            CSV_BATCH_REPAIR_PROMPT.system,
            CSV_BATCH_REPAIR_PROMPT.user(rows, subject),
            {
                name: "batch_csv_repair",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        rows: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    topic: { type: "string" },
                                    difficultyLevel: { type: "string" },
                                    options: { type: "array", items: { type: "string" } },
                                    correctAnswerIndex: { type: "number" },
                                    correctAnswer: { type: "string" },
                                    needsReview: { type: "boolean" },
                                    reason: { type: "string" },
                                    confidence: { type: "number" },
                                },
                                required: ["title", "topic", "difficultyLevel", "options", "correctAnswerIndex", "correctAnswer", "needsReview", "reason", "confidence"],
                                additionalProperties: false,
                            }
                        }
                    },
                    required: ["rows"],
                    additionalProperties: false
                }
            }
        )

        // The LLM might return { rows: [...] } or just [...] or another key containing the array
        let dataArray = null
        if (Array.isArray(raw)) {
            dataArray = raw
        } else if (raw && typeof raw === 'object') {
            if (Array.isArray(raw.rows)) {
                dataArray = raw.rows
            } else {
                // Find the first array value in the object (e.g. if they returned { "results": [...] })
                const firstArray = Object.values(raw).find(val => Array.isArray(val))
                if (firstArray) dataArray = firstArray
            }
        }

        if (!dataArray) {
            return { success: false, error: "AI returned unexpected batch repair format" }
        }

        const validated = validateBatchCsvRepairResponse(dataArray, rows)

        await logAiAction({
            professorId,
            action: "AI_BATCH_REPAIR_CSV",
            promptVersion: PROMPT_VERSIONS.CSV_REPAIR,
            requestData,
            responseData: { repairedCount: validated.valid ? validated.data.length : 0 },
            status: validated.valid ? "SUCCESS" : "FAILURE",
        })

        if (!validated.valid) {
            return { success: false, error: validated.error }
        }

        return { success: true, data: validated.data }
    } catch (error) {
        await logAiAction({
            professorId,
            action: "AI_BATCH_REPAIR_CSV",
            promptVersion: PROMPT_VERSIONS.CSV_REPAIR,
            requestData,
            responseData: { error: error.message },
            status: "FAILURE",
        })
        throw error
    }
}

export async function adminReviewBatch(batchData, adminId) {
    try {
        const { ADMIN_BATCH_REVIEW_PROMPT } = await import('./ai.prompts.js');

        // Sanitize and distill batchData to stay well within LLM context/token limits
        const questions = Array.isArray(batchData?.questions) ? batchData.questions : [];
        const difficultyCounts = {};
        const topicCounts = {};
        for (const q of questions) {
            const diff = (q.difficultyLevel || 'unspecified').toLowerCase();
            difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
            const topic = q.topic || 'General';
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }

        const sanitizedPayload = {
            title: batchData?.title || 'Untitled Batch',
            subject: batchData?.subject || 'General',
            description: batchData?.description || '',
            totalQuestions: questions.length,
            difficultyDistribution: difficultyCounts,
            topicsCovered: topicCounts,
            sampleQuestions: questions.slice(0, 15).map((q, idx) => ({
                index: idx + 1,
                topic: q.topic || 'General',
                difficulty: q.difficultyLevel || 'medium',
                title: q.title && !/^[a-f0-9]{64}$/i.test(q.title) ? q.title : undefined,
                options: Array.isArray(q.options) && q.options.length > 0 ? q.options : undefined,
                correctAnswer: q.correctAnswer || (Array.isArray(q.options) && q.correctAnswerIndex !== undefined ? q.options[q.correctAnswerIndex] : undefined),
            })),
        };

        const raw = await callLLM(
            ADMIN_BATCH_REVIEW_PROMPT.system,
            ADMIN_BATCH_REVIEW_PROMPT.user(sanitizedPayload),
            {
                name: "admin_batch_review",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        isApproved: { type: "boolean" },
                        issues: { type: "array", items: { type: "string" } },
                        summary: { type: "string" },
                        difficultySkew: { type: "string" }
                    },
                    required: ["isApproved", "issues", "summary", "difficultySkew"],
                    additionalProperties: false
                }
            }
        );
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_REVIEW_BATCH",
            promptVersion: "1.0",
            requestData: { batchData: sanitizedPayload },
            responseData: raw,
            status: "SUCCESS"
        });
        return { success: true, data: raw };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_REVIEW_BATCH",
            promptVersion: "1.0",
            requestData: { batchData },
            responseData: { error: error.message },
            status: "FAILURE"
        });
        return { success: false, error: error.message };
    }
}

export async function adminAuditSummary(logs, adminId) {
    try {
        const { ADMIN_AUDIT_SUMMARY_PROMPT } = await import('./ai.prompts.js');
        const raw = await callLLM(
            ADMIN_AUDIT_SUMMARY_PROMPT.system,
            ADMIN_AUDIT_SUMMARY_PROMPT.user(logs),
            {
                name: "admin_audit_summary",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                        summaryMarkdown: { type: "string" }
                    },
                    required: ["status", "summaryMarkdown"],
                    additionalProperties: false
                }
            }
        );
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_AUDIT_SUMMARY",
            promptVersion: "1.0",
            requestData: { logs },
            responseData: raw,
            status: "SUCCESS"
        });
        return { success: true, data: raw };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_AUDIT_SUMMARY",
            promptVersion: "1.0",
            requestData: { logs },
            responseData: { error: error.message },
            status: "FAILURE"
        });
        return { success: false, error: error.message };
    }
}

export async function adminCohortReport(gradebookData, adminId) {
    try {
        const { ADMIN_COHORT_REPORT_PROMPT } = await import('./ai.prompts.js');
        const raw = await callLLM(
            ADMIN_COHORT_REPORT_PROMPT.system,
            ADMIN_COHORT_REPORT_PROMPT.user(gradebookData),
            {
                name: "admin_cohort_report",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        atRiskStudents: { type: "array", items: { type: "string" } },
                        cohortAnalysis: { type: "string" },
                        recommendedActions: { type: "array", items: { type: "string" } }
                    },
                    required: ["atRiskStudents", "cohortAnalysis", "recommendedActions"],
                    additionalProperties: false
                }
            }
        );
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_COHORT_REPORT",
            promptVersion: "1.0",
            requestData: { gradebookData },
            responseData: raw,
            status: "SUCCESS"
        });
        return { success: true, data: raw };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_COHORT_REPORT",
            promptVersion: "1.0",
            requestData: { gradebookData },
            responseData: { error: error.message },
            status: "FAILURE"
        });
        return { success: false, error: error.message };
    }
}

export async function adminExamCopilot(prompt, adminId, availableSubjects = []) {
    try {
        const { ADMIN_EXAM_COPILOT_PROMPT } = await import('./ai.prompts.js');
        const raw = await callLLM(
            ADMIN_EXAM_COPILOT_PROMPT.system,
            ADMIN_EXAM_COPILOT_PROMPT.user(prompt, availableSubjects),
            {
                name: "admin_exam_copilot",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        mode: { type: "string", enum: ["Normal", "Zeroleak"] },
                        subjects: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    subject: { type: "string" },
                                    numQuestions: { type: "number" },
                                    durationMinutes: { type: "number" },
                                    passingPercentage: { type: "number" }
                                },
                                required: ["subject", "numQuestions", "durationMinutes", "passingPercentage"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["title", "description", "mode", "subjects"],
                    additionalProperties: false
                }
            }
        );
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_EXAM_COPILOT",
            promptVersion: "1.0",
            requestData: { prompt },
            responseData: raw,
            status: "SUCCESS"
        });
        return { success: true, data: raw };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_EXAM_COPILOT",
            promptVersion: "1.0",
            requestData: { prompt },
            responseData: { error: error.message },
            status: "FAILURE"
        });
        return { success: false, error: error.message };
    }
}

export async function adminPolicyRewrite(draft, adminId) {
    try {
        const { ADMIN_POLICY_REWRITE_PROMPT } = await import('./ai.prompts.js');
        const raw = await callLLM(
            ADMIN_POLICY_REWRITE_PROMPT.system,
            ADMIN_POLICY_REWRITE_PROMPT.user(draft),
            {
                name: "admin_policy_rewrite",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        rewrittenText: { type: "string" }
                    },
                    required: ["rewrittenText"],
                    additionalProperties: false
                }
            }
        );
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_POLICY_REWRITE",
            promptVersion: "1.0",
            requestData: { draft },
            responseData: raw,
            status: "SUCCESS"
        });
        return { success: true, data: raw };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_ADMIN_POLICY_REWRITE",
            promptVersion: "1.0",
            requestData: { draft },
            responseData: { error: error.message },
            status: "FAILURE"
        });
        return { success: false, error: error.message };
    }
}

export async function generateStudentPerformanceAnalysis(studentData, examHistory, adminId) {
    try {
        const { STUDENT_PERFORMANCE_PROMPT } = await import('./ai.prompts.js');
        const { validateStudentPerformanceResponse } = await import('./ai.validation.js');
        
        const raw = await callLLM(
            STUDENT_PERFORMANCE_PROMPT.system,
            STUDENT_PERFORMANCE_PROMPT.user(studentData, examHistory),
            {
                name: "student_performance_analysis",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        summary: { type: "string" },
                        averagePerformance: { type: "string" },
                        performanceTrend: { type: "string", enum: ["Improving", "Declining", "Stable", "Inconsistent", "Insufficient Data"] },
                        strengths: { type: "array", items: { type: "string" } },
                        weakAreas: { type: "array", items: { type: "string" } },
                        observations: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "averagePerformance", "performanceTrend", "strengths", "weakAreas", "observations"],
                    additionalProperties: false
                }
            }
        );
        
        const validated = validateStudentPerformanceResponse(raw);
        if (!validated.valid) {
            return { success: false, error: validated.error };
        }
        
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_STUDENT_PERFORMANCE",
            promptVersion: "1.0",
            requestData: { studentId: studentData.studentId },
            responseData: validated.data,
            status: "SUCCESS",
        });

        return { success: true, data: validated.data };
    } catch (error) {
        await logAiAction({
            actorId: adminId,
            actorRole: "Admin",
            action: "AI_STUDENT_PERFORMANCE",
            promptVersion: "1.0",
            requestData: { studentId: studentData.studentId },
            responseData: { error: error.message },
            status: "FAILURE",
        });
        return { success: false, error: error.message };
    }
}


export async function generateStudentSelfPerformanceAnalysis(studentData, examHistory, studentId) {
    try {
        const { STUDENT_SELF_PERFORMANCE_PROMPT } = await import('./ai.prompts.js');
        const { validateStudentSelfPerformanceResponse } = await import('./ai.validation.js');
        
        const raw = await callLLM(
            STUDENT_SELF_PERFORMANCE_PROMPT.system,
            STUDENT_SELF_PERFORMANCE_PROMPT.user(studentData, examHistory),
            {
                name: "student_self_performance_analysis",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        summary: { type: "string" },
                        averagePerformance: { type: "string" },
                        performanceTrend: { type: "string", enum: ["Improving", "Declining", "Stable", "Inconsistent", "Insufficient Data"] },
                        strengths: { type: "array", items: { type: "string" } },
                        weakAreas: { type: "array", items: { type: "string" } },
                        observations: { type: "array", items: { type: "string" } },
                        improvementFocus: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "averagePerformance", "performanceTrend", "strengths", "weakAreas", "observations", "improvementFocus"],
                    additionalProperties: false
                }
            }
        );
        
        const validated = validateStudentSelfPerformanceResponse(raw);
        if (!validated.valid) {
            return { success: false, error: validated.error };
        }
        
        await logAiAction({
            actorId: studentId,
            actorRole: "Student",
            action: "AI_STUDENT_SELF_PERFORMANCE_ANALYSIS",
            promptVersion: "1.0",
            requestData: { studentId },
            responseData: validated.data,
            status: "SUCCESS",
        });

        return { success: true, data: validated.data };
    } catch (error) {
        await logAiAction({
            actorId: studentId,
            actorRole: "Student",
            action: "AI_STUDENT_SELF_PERFORMANCE_ANALYSIS",
            promptVersion: "1.0",
            requestData: { studentId },
            responseData: { error: error.message },
            status: "FAILURE",
        });
        return { success: false, error: error.message };
    }
}

export async function analyzeSupportTicket(title, description, role) {
    try {
        const { SUPPORT_TICKET_AI_PROMPT } = await import('./ai.prompts.js');
        
        const raw = await callLLM(
            SUPPORT_TICKET_AI_PROMPT.system,
            SUPPORT_TICKET_AI_PROMPT.user(title, description, role),
            {
                name: "support_ticket_analysis",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        category: { type: "string", enum: ["technical_issue", "login_authentication", "exam_issue", "proctoring_issue", "question_content_issue", "submission_issue", "account_issue", "performance_issue", "bug_report", "security_concern", "other"] },
                        supportPriority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                        suggestedReply: { type: "string" },
                        confidence: { type: "number" }
                    },
                    required: ["category", "supportPriority", "suggestedReply", "confidence"],
                    additionalProperties: false
                }
            }
        );
        
        return { success: true, data: raw };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
