// Confidence thresholds
export const CONFIDENCE = {
    HIGH: 0.85,
    MEDIUM: 0.60,
}

export const RATE_LIMITS = {
    BATCH_GENERATE: parseInt(process.env.AI_BATCH_RATE_LIMIT) || 10,
    QUESTION_GENERATE: parseInt(process.env.AI_QUESTION_RATE_LIMIT) || 30,
    CSV_REPAIR: parseInt(process.env.AI_CSV_RATE_LIMIT) || 100,
}

export const AI_MODEL = process.env.AI_MODEL || "openai/gpt-oss-20b"

export const PROMPT_VERSIONS = {
    BATCH: "batch-generator-v1",
    QUESTION: "question-generator-v1",
    CSV_REPAIR: "csv-repair-v1",
}

export function getConfidenceLabel(confidence) {
    if (confidence >= CONFIDENCE.HIGH) return "high"
    if (confidence >= CONFIDENCE.MEDIUM) return "medium"
    return "low"
}
