const VALID_DIFFICULTIES = ["easy", "medium", "hard"]

export function validateBatchResponse(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "AI returned invalid data structure" }
    }

    if (data.needsReview === true) {
        return {
            valid: true,
            data: {
                needsReview: true,
                reason: typeof data.reason === "string" ? data.reason : "The batch name is too vague to generate details.",
                subject: typeof data.subject === "string" ? data.subject.trim() : "",
                description: typeof data.description === "string" ? data.description.trim() : "",
                confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.3,
            }
        }
    }

    if (typeof data.subject !== "string" || data.subject.trim().length === 0) {
        return { valid: false, error: "AI did not generate a valid subject" }
    }

    if (typeof data.description !== "string" || data.description.trim().length === 0) {
        return { valid: false, error: "AI did not generate a valid description" }
    }

    return {
        valid: true,
        data: {
            subject: data.subject.trim(),
            description: data.description.trim(),
            needsReview: false,
            confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.9,
        }
    }
}

export function validateQuestionResponse(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "AI returned invalid data structure" }
    }

    if (data.needsReview === true) {
        return {
            valid: true,
            data: {
                needsReview: true,
                reason: typeof data.reason === "string" ? data.reason : "The question is too ambiguous to generate reliable options.",
                topic: typeof data.topic === "string" ? data.topic.trim() : "",
                difficultyLevel: VALID_DIFFICULTIES.includes(data.difficultyLevel) ? data.difficultyLevel : "",
                options: [],
                correctAnswerIndex: -1,
                correctAnswer: "",
                confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.3,
            }
        }
    }

    const errors = []

    if (typeof data.topic !== "string" || data.topic.trim().length === 0) {
        errors.push("Missing topic")
    }

    if (!VALID_DIFFICULTIES.includes(data.difficultyLevel)) {
        errors.push(`Invalid difficulty: ${data.difficultyLevel}`)
    }

    if (!Array.isArray(data.options) || data.options.length !== 4) {
        errors.push("Must have exactly 4 options")
    } else {
        for (let i = 0; i < 4; i++) {
            if (typeof data.options[i] !== "string" || data.options[i].trim().length === 0) {
                errors.push(`Option ${i + 1} is empty or invalid`)
            }
        }
    }

    const idx = parseInt(data.correctAnswerIndex)
    if (isNaN(idx) || idx < 0 || idx > 3) {
        errors.push("correctAnswerIndex must be 0-3")
    }

    if (errors.length > 0) {
        return { valid: false, error: errors.join("; ") }
    }

    const options = data.options.map(o => o.trim())
    const correctAnswerIndex = parseInt(data.correctAnswerIndex)

    return {
        valid: true,
        data: {
            topic: data.topic.trim(),
            difficultyLevel: data.difficultyLevel,
            options,
            correctAnswerIndex,
            correctAnswer: options[correctAnswerIndex],
            needsReview: false,
            confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.85,
        }
    }
}

export function validateCsvRepairResponse(data, originalRow, missingFields) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "AI returned invalid data structure" }
    }

    if (data.needsReview === true) {
        return {
            valid: true,
            data: {
                ...originalRow,
                needsReview: true,
                reason: typeof data.reason === "string" ? data.reason : "Could not confidently repair this row.",
                fixedFields: [],
                confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.3,
            }
        }
    }

    const result = { ...originalRow }
    const fixedFields = []

    for (const field of missingFields) {
        switch (field) {
            case "title":
                if (typeof data.title === "string" && data.title.trim()) {
                    result.title = data.title.trim()
                    fixedFields.push("title")
                }
                break
            case "topic":
                if (typeof data.topic === "string" && data.topic.trim()) {
                    result.topic = data.topic.trim()
                    fixedFields.push("topic")
                }
                break
            case "difficultyLevel":
                if (VALID_DIFFICULTIES.includes(data.difficultyLevel)) {
                    result.difficultyLevel = data.difficultyLevel
                    fixedFields.push("difficultyLevel")
                }
                break
            case "options":
                if (Array.isArray(data.options) && data.options.length === 4 && data.options.every(o => typeof o === "string" && o.trim())) {
                    result.options = data.options.map(o => o.trim())
                    fixedFields.push("options")
                }
                break
            case "correctAnswerIndex": {
                const idx = parseInt(data.correctAnswerIndex)
                if (!isNaN(idx) && idx >= 0 && idx <= 3) {
                    result.correctAnswerIndex = idx
                    const opts = Array.isArray(data.options) ? data.options : result.options
                    if (opts && opts[idx]) {
                        result.correctAnswer = opts[idx]
                    }
                    fixedFields.push("correctAnswerIndex")
                }
                break
            }
            case "correctAnswer": {
                if (typeof data.correctAnswer === "string" && data.correctAnswer.trim()) {
                    result.correctAnswer = data.correctAnswer.trim()
                    fixedFields.push("correctAnswer")
                }
                break
            }
            default:
                if (field.startsWith("option")) {
                    const optIdx = parseInt(field.replace("option", ""))
                    if (!isNaN(optIdx)) {
                        let newOpt = null

                        if (Array.isArray(data.options) && typeof data.options[optIdx] === "string" && data.options[optIdx].trim()) {
                            newOpt = data.options[optIdx].trim()
                        }
                        else if (typeof data[field] === "string" && data[field].trim()) {
                            newOpt = data[field].trim()
                        }

                        if (newOpt) {
                            if (!result.options || !Array.isArray(result.options)) {
                                result.options = Array.isArray(originalRow.options) ? [...originalRow.options] : ["", "", "", ""]
                            }
                            result.options[optIdx] = newOpt
                            fixedFields.push(field)
                        }
                    }
                }
                break
        }
    }

    // Ensure correctAnswer matches the option at correctAnswerIndex if both are known
    if (result.correctAnswerIndex !== undefined && result.correctAnswerIndex >= 0 && Array.isArray(result.options) && result.options[result.correctAnswerIndex]) {
        if (!result.correctAnswer || result.correctAnswer !== result.options[result.correctAnswerIndex]) {
            result.correctAnswer = result.options[result.correctAnswerIndex]
        }
    }

    return {
        valid: true,
        data: {
            ...result,
            fixedFields,
            needsReview: false,
            confidence: typeof data.confidence === "number" ? clampConfidence(data.confidence) : 0.85,
        }
    }
}

export function validateBatchCsvRepairResponse(dataArray, rows) {
    if (!Array.isArray(dataArray)) {
        return { valid: false, error: "AI returned non-array for batch repair" }
    }

    const results = []
    for (let i = 0; i < rows.length; i++) {
        const aiRow = dataArray[i]
        const original = rows[i]
        if (!aiRow) {
            results.push({
                rowIndex: original.rowIndex,
                data: { ...original.row, needsReview: true, reason: "AI did not return data for this row.", fixedFields: [], confidence: 0 }
            })
            continue
        }
        const validated = validateCsvRepairResponse(aiRow, original.row, original.missingFields)
        results.push({
            rowIndex: original.rowIndex,
            ...(validated.valid ? { data: validated.data } : { data: { ...original.row, needsReview: true, reason: validated.error, fixedFields: [], confidence: 0 } })
        })
    }

    return { valid: true, data: results }
}

function clampConfidence(val) {
    return Math.max(0, Math.min(1, val))
}

export function validateStudentPerformanceResponse(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "AI returned invalid data structure" }
    }
    
    const errors = []
    
    if (typeof data.summary !== "string") errors.push("Missing or invalid summary")
    if (typeof data.averagePerformance !== "string") errors.push("Missing or invalid averagePerformance")
    
    const validTrends = ["Improving", "Declining", "Stable", "Inconsistent", "Insufficient Data"]
    if (typeof data.performanceTrend === "string") {
        const matched = validTrends.find(t => t.toLowerCase() === data.performanceTrend.trim().toLowerCase())
        if (matched) data.performanceTrend = matched
    }
    if (!validTrends.includes(data.performanceTrend)) {
        errors.push("Invalid performanceTrend")
    }
    
    if (!Array.isArray(data.strengths)) errors.push("strengths must be an array")
    if (!Array.isArray(data.weakAreas)) errors.push("weakAreas must be an array")
    if (!Array.isArray(data.observations)) errors.push("observations must be an array")
    
    if (errors.length > 0) {
        return { valid: false, error: errors.join("; ") }
    }
    
    return { valid: true, data }
}


export function validateStudentSelfPerformanceResponse(data) {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "AI returned invalid data structure" }
    }
    
    const errors = []
    
    if (typeof data.summary !== "string") errors.push("Missing or invalid summary")
    if (typeof data.averagePerformance !== "string") errors.push("Missing or invalid averagePerformance")
    
    const validTrends = ["Improving", "Declining", "Stable", "Inconsistent", "Insufficient Data"]
    if (typeof data.performanceTrend === "string") {
        const matched = validTrends.find(t => t.toLowerCase() === data.performanceTrend.trim().toLowerCase())
        if (matched) data.performanceTrend = matched
    }
    if (!validTrends.includes(data.performanceTrend)) {
        errors.push("Invalid performanceTrend")
    }
    
    if (!Array.isArray(data.strengths)) errors.push("strengths must be an array")
    if (!Array.isArray(data.weakAreas)) errors.push("weakAreas must be an array")
    if (!Array.isArray(data.observations)) errors.push("observations must be an array")
    if (!Array.isArray(data.improvementFocus)) errors.push("improvementFocus must be an array")
    
    if (errors.length > 0) {
        return { valid: false, error: errors.join("; ") }
    }
    
    return { valid: true, data }
}
