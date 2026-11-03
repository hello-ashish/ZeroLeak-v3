import React, { useState, useEffect } from 'react'
import "./ProfessorCreateBatchPage.css";
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Plus, Send, Edit2, Trash2, Download, Upload, Loader2, ArrowLeft, Eye, EyeOff, Sparkles, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import Papa from 'papaparse'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Modal } from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'

// ── AI Confidence thresholds (mirrors backend ai.policy.js) ──────────
const CONFIDENCE = { HIGH: 0.85, MEDIUM: 0.60 }

function getConfidenceStyle(confidence) {
    if (confidence >= CONFIDENCE.HIGH) return { color: 'var(--success)', label: 'High confidence' }
    if (confidence >= CONFIDENCE.MEDIUM) return { color: 'var(--warning, #f59e0b)', label: 'Review recommended' }
    return { color: 'var(--danger)', label: 'Manual review required' }
}

// ── CSV row validation helper ────────────────────────────────────────
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard']

function validateCsvRow(q) {
    const issues = []
    if (!q.title || !q.title.trim()) issues.push('Question text')
    if (!q.topic || !q.topic.trim()) issues.push('Topic')
    if (!q.difficultyLevel || !VALID_DIFFICULTIES.includes(q.difficultyLevel)) issues.push('Difficulty')
    if (!Array.isArray(q.options) || q.options.length !== 4) {
        issues.push('Options (need exactly 4)')
    } else {
        q.options.forEach((opt, i) => {
            if (!opt || !opt.trim()) issues.push(`Option ${i + 1}`)
        })
    }
    const idx = parseInt(q.correctAnswerIndex)
    if (isNaN(idx) || idx < 0 || idx > 3) issues.push('Correct Answer')
    return issues
}

function getRowStatus(issues) {
    if (issues.length === 0) return 'valid'
    // If the question text itself is missing, it's invalid (can't repair without context)
    if (issues.includes('Question text')) return 'invalid'
    return 'incomplete'
}

function getMissingFields(issues) {
    const fieldMap = {
        'Topic': 'topic',
        'Difficulty': 'difficultyLevel',
        'Correct Answer': 'correctAnswerIndex',
        'Option 1': 'option0',
        'Option 2': 'option1',
        'Option 3': 'option2',
        'Option 4': 'option3',
        'Options (need exactly 4)': 'options',
    }
    return issues.map(i => fieldMap[i]).filter(Boolean)
}

const ProfessorCreateBatchPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()

    const isEditMode = !!id

    const [batch, setBatch] = useState(null)
    const [loading, setLoading] = useState(isEditMode)

    // Batch Shell Form
    const [batchTitle, setBatchTitle] = useState('')
    const [batchSubject, setBatchSubject] = useState('')
    const [batchDescription, setBatchDescription] = useState('')
    const [isCreatingBatch, setIsCreatingBatch] = useState(false)

    // Question Management
    const [title, setTitle] = useState('')
    const [options, setOptions] = useState(['', '', '', ''])
    const [correctAnswer, setCorrectAnswer] = useState('')
    const [difficultyLevel, setDifficultyLevel] = useState('easy')
    const [topic, setTopic] = useState('')
    const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0)
    const [editingQuestionId, setEditingQuestionId] = useState(null)
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)

    // Preview / Import States
    const [previewQuestions, setPreviewQuestions] = useState(null)
    const [showTemplatePreview, setShowTemplatePreview] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [submittingBatchId, setSubmittingBatchId] = useState(null)

    // ── AI States ────────────────────────────────────────────────────
    const [aiBatchLoading, setAiBatchLoading] = useState(false)
    const [aiBatchResult, setAiBatchResult] = useState(null) // { subject, description, confidence, ... }
    const [aiQuestionLoading, setAiQuestionLoading] = useState(false)
    const [aiQuestionResult, setAiQuestionResult] = useState(null)
    const [csvRowAiLoading, setCsvRowAiLoading] = useState({}) // { [rowIndex]: true }
    const [csvRowAiResults, setCsvRowAiResults] = useState({}) // { [rowIndex]: { data, ... } }
    const [aiClarification, setAiClarification] = useState('')
    const [editingCsvRow, setEditingCsvRow] = useState(null)
    const [csvEditForm, setCsvEditForm] = useState(null)

    const fetchBatchData = async () => {
        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.get('/api/professor/batches', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const batches = response.data.batches
            const currentBatch = batches.find(b => b._id === id)
            if (currentBatch) {
                if (currentBatch.status !== 'Draft' && currentBatch.status !== 'MarkForReview') {
                    toast.error(`Cannot edit batch with status "${currentBatch.status}".`);
                    navigate('/professor/batches');
                    return;
                }
                setBatch(currentBatch)
                setBatchTitle(currentBatch.title)
                setBatchSubject(currentBatch.subject)
                setBatchDescription(currentBatch.description || '')
            } else {
                toast.error("Batch not found")
                navigate('/professor/batches')
            }
        } catch (error) {
            console.error("Error fetching batch:", error)
            toast.error("Failed to load batch")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isEditMode) {
            fetchBatchData()
        } else {
            setBatchTitle('')
            setBatchSubject('')
            setBatchDescription('')
            setBatch(null)
        }
    }, [id])

    const handleCreateBatch = async (e) => {
        e.preventDefault()
        if (isEditMode) {
            toast.success("Batch details updated (mock)")
            return
        }

        setIsCreatingBatch(true)
        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.post('/api/professor/batches', {
                title: batchTitle,
                subject: batchSubject,
                description: batchDescription
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            toast.success("Batch created successfully")
            const createdId = response.data.batch?._id
            if (createdId) {
                navigate(`/professor/batches/${createdId}/edit`)
            } else {
                navigate('/professor/batches')
            }
        } catch (error) {
            toast.error("Error creating batch: " + (error.response?.data?.message || "Server Error"))
        } finally {
            setIsCreatingBatch(false)
        }
    }

    // ── AI: Generate Batch Details ────────────────────────────────────
    const handleAiGenerateBatch = async (forceRegenerate = false) => {
        if (!batchTitle || batchTitle.trim().length < 3) {
            toast.error("Enter a batch title (at least 3 characters) before generating.")
            return
        }

        // Safety: don't overwrite if fields are filled (unless regenerating)
        if (!forceRegenerate && (batchSubject.trim() || batchDescription.trim())) {
            // Fields already have content — show regenerate mode
            setAiBatchResult({ showOverwriteWarning: true })
            return
        }

        setAiBatchLoading(true)
        setAiBatchResult(null)
        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.post('/api/professor/ai/generate-batch', {
                name: batchTitle.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data.success) {
                const data = response.data.data
                setAiBatchResult(data)

                if (!data.needsReview) {
                    // Only fill empty fields (safer behavior)
                    if (!batchSubject.trim() || forceRegenerate) setBatchSubject(data.subject)
                    if (!batchDescription.trim() || forceRegenerate) setBatchDescription(data.description)
                    toast.success("✨ AI generated batch details")
                } else {
                    toast.error(data.reason || "AI needs more context to generate details.")
                }
            } else {
                toast.error(response.data.message || "AI generation failed.")
            }
        } catch (error) {
            if (error.response?.status === 429) {
                toast.error("Rate limit reached. Please wait a moment.")
            } else {
                toast.error("Unable to generate AI content. Please try again.")
            }
        } finally {
            setAiBatchLoading(false)
        }
    }

    // ── AI: Generate Question Details ─────────────────────────────────
    const handleAiGenerateQuestion = async () => {
        if (!title || title.trim().length < 10) {
            toast.error("Enter a question (at least 10 characters) before generating.")
            return
        }

        setAiQuestionLoading(true)
        setAiQuestionResult(null)
        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.post('/api/professor/ai/generate-question', {
                question: title.trim(),
                subject: batchSubject,
                topic: topic || undefined,
                clarification: aiClarification.trim() || undefined,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data.success) {
                const data = response.data.data
                setAiQuestionResult(data)

                if (!data.needsReview) {
                    // Fill the form fields
                    if (data.topic && !topic.trim()) setTopic(data.topic)
                    if (data.difficultyLevel) setDifficultyLevel(data.difficultyLevel)
                    if (data.options && data.options.length === 4) {
                        setOptions(data.options)
                        setCorrectAnswerIndex(data.correctAnswerIndex)
                        setCorrectAnswer(data.correctAnswer || data.options[data.correctAnswerIndex])
                    }
                    toast.success("✨ AI generated question details")
                    setAiClarification('') // Clear clarification on success
                } else {
                    toast.error(data.reason || "AI needs more information to generate reliable options.")
                }
            } else {
                toast.error(response.data.message || "AI generation failed.")
            }
        } catch (error) {
            if (error.response?.status === 429) {
                toast.error("Rate limit reached. Please wait a moment.")
            } else {
                toast.error("Unable to generate AI content. Please try again.")
            }
        } finally {
            setAiQuestionLoading(false)
        }
    }

    // -- Question Handlers --
    const handleOptionChange = (idx, value) => {
        const newOptions = [...options];
        newOptions[idx] = value;
        setOptions(newOptions);
    };

    const handleAddQuestionToBatch = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('profToken');
            const payload = { title, options, correctAnswer, difficultyLevel, subject: batchSubject, topic, correctAnswerIndex: Number(correctAnswerIndex) };

            if (editingQuestionId) {
                await axios.put(`/api/professor/batches/${id}/questions/${editingQuestionId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`/api/professor/batches/${id}/questions`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setTitle(''); setOptions(['', '', '', '']); setCorrectAnswer(''); setCorrectAnswerIndex(0); setTopic('');
            setEditingQuestionId(null);
            setIsQuestionModalOpen(false);
            setAiQuestionResult(null);
            setAiClarification('');
            fetchBatchData();
            toast.success(editingQuestionId ? "Question updated" : "Question added");
        } catch (error) {
            toast.error("Error: " + (error.response?.data?.message || "Server Error"));
        }
    };

    const handleEditQuestion = (q) => {
        setEditingQuestionId(q._id);
        setTitle(q.title || '');
        setOptions(q.options && q.options.length === 4 ? q.options : ['', '', '', '']);
        setCorrectAnswer(q.correctAnswer || '');
        setCorrectAnswerIndex(q.correctAnswerIndex || 0);
        setDifficultyLevel(q.difficultyLevel || 'easy');
        setTopic(q.topic || '');
        setAiQuestionResult(null);
        setAiClarification('');
        setIsQuestionModalOpen(true);
    };

    const handleDeleteQuestion = async (questionId) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        try {
            const token = localStorage.getItem('profToken');
            await axios.delete(`/api/professor/batches/${id}/questions/${questionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchBatchData();
            toast.success("Question deleted");
        } catch (error) {
            toast.error("Error: " + (error.response?.data?.message || "Server Error"));
        }
    };

    const submitBatch = async () => {
        setSubmittingBatchId(id);
        try {
            const token = localStorage.getItem('profToken');
            await axios.post(`/api/professor/batches/${id}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Batch submitted successfully");
            navigate('/professor/batches');
        } catch (error) {
            toast.error("Error submitting batch");
        } finally {
            setSubmittingBatchId(null);
        }
    };

    const handleDeleteBatch = async () => {
        if (!window.confirm("Are you sure you want to delete this entire batch?")) return;
        try {
            const token = localStorage.getItem('profToken');
            await axios.delete(`/api/professor/batches/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Batch deleted");
            navigate('/professor/batches');
        } catch (error) {
            toast.error("Error: " + (error.response?.data?.message || "Server Error"));
        }
    };

    const downloadTemplate = () => {
        const headers = ["Title", "Option 1", "Option 2", "Option 3", "Option 4", "Correct Option Index (0-3)", "Difficulty (easy/medium/hard)", "Topic"];
        const sampleRow = ["What is the capital of France?", "London", "Berlin", "Paris", "Madrid", "2", "easy", "Geography"];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + sampleRow.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Question_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                if (rows.length < 2) {
                    toast.error("CSV is empty or missing data rows.");
                    return;
                }

                const questions = [];
                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i];
                    if (cols.length < 8) continue;

                    const correctIdx = parseInt(cols[5]);
                    let exactCorrectText = cols[1 + correctIdx];
                    if (!exactCorrectText) exactCorrectText = cols[1]; // fallback

                    questions.push({
                        title: cols[0],
                        options: [cols[1], cols[2], cols[3], cols[4]],
                        correctAnswer: exactCorrectText,
                        correctAnswerIndex: isNaN(correctIdx) ? 0 : correctIdx,
                        difficultyLevel: (cols[6] || '').toLowerCase().trim(),
                        topic: (cols[7] || '').trim()
                    });
                }

                if (questions.length === 0) {
                    toast.error("No valid questions found in CSV.");
                    return;
                }

                setPreviewQuestions(questions);
                setCsvRowAiResults({});
                setCsvRowAiLoading({});
            }
        });
        e.target.value = null;
    };

    // ── AI: Fix single CSV row ───────────────────────────────────────
    const handleAiFixRow = async (rowIndex) => {
        const q = previewQuestions[rowIndex]
        const issues = validateCsvRow(q)
        const missing = getMissingFields(issues)

        if (missing.length === 0) return

        setCsvRowAiLoading(prev => ({ ...prev, [rowIndex]: true }))
        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.post('/api/professor/ai/fix-question-import', {
                row: q,
                missingFields: missing,
                context: { subject: batchSubject }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data.success) {
                const repaired = response.data.data
                setCsvRowAiResults(prev => ({ ...prev, [rowIndex]: repaired }))

                if (!repaired.needsReview) {
                    // Apply the fix to the preview
                    const updated = [...previewQuestions]
                    updated[rowIndex] = {
                        title: repaired.title || q.title,
                        options: repaired.options || q.options,
                        correctAnswer: repaired.correctAnswer || q.correctAnswer,
                        correctAnswerIndex: repaired.correctAnswerIndex ?? q.correctAnswerIndex,
                        difficultyLevel: repaired.difficultyLevel || q.difficultyLevel,
                        topic: repaired.topic || q.topic,
                    }
                    setPreviewQuestions(updated)
                    toast.success(`✨ Row ${rowIndex + 1} repaired by AI`)
                } else {
                    toast.error(repaired.reason || `Row ${rowIndex + 1} needs manual review.`)
                }
            }
        } catch (error) {
            if (error.response?.status === 429) {
                toast.error("Rate limit reached. Please wait a moment.")
            } else {
                toast.error("AI repair failed. Please fix manually.")
            }
        } finally {
            setCsvRowAiLoading(prev => ({ ...prev, [rowIndex]: false }))
        }
    }

    // ── AI: Fix all incomplete CSV rows in batch ─────────────────────
    const handleAiFixAll = async () => {
        if (!previewQuestions) return
        const incompleteRows = []
        previewQuestions.forEach((q, idx) => {
            const issues = validateCsvRow(q)
            const status = getRowStatus(issues)
            if (status === 'incomplete') {
                incompleteRows.push({
                    rowIndex: idx,
                    row: q,
                    missingFields: getMissingFields(issues),
                })
            }
        })

        if (incompleteRows.length === 0) {
            toast.success("All rows are valid!")
            return
        }

        // Set loading for all incomplete rows
        const loadingState = {}
        incompleteRows.forEach(r => { loadingState[r.rowIndex] = true })
        setCsvRowAiLoading(prev => ({ ...prev, ...loadingState }))

        try {
            const token = localStorage.getItem('profToken')
            const response = await axios.post('/api/professor/ai/fix-question-import', {
                rows: incompleteRows,
                context: { subject: batchSubject }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data.success) {
                const results = response.data.data
                const updated = [...previewQuestions]
                const newAiResults = { ...csvRowAiResults }
                let fixedCount = 0

                for (const item of results) {
                    newAiResults[item.rowIndex] = item.data
                    if (!item.data.needsReview) {
                        updated[item.rowIndex] = {
                            title: item.data.title || updated[item.rowIndex].title,
                            options: item.data.options || updated[item.rowIndex].options,
                            correctAnswer: item.data.correctAnswer || updated[item.rowIndex].correctAnswer,
                            correctAnswerIndex: item.data.correctAnswerIndex ?? updated[item.rowIndex].correctAnswerIndex,
                            difficultyLevel: item.data.difficultyLevel || updated[item.rowIndex].difficultyLevel,
                            topic: item.data.topic || updated[item.rowIndex].topic,
                        }
                        fixedCount++
                    }
                }

                setPreviewQuestions(updated)
                setCsvRowAiResults(newAiResults)
                toast.success(`✨ ${fixedCount}/${incompleteRows.length} rows repaired by AI`)
            }
        } catch (error) {
            if (error.response?.status === 429) {
                toast.error("Rate limit reached. Please wait a moment.")
            } else {
                toast.error("Batch AI repair failed. Try fixing rows individually.")
            }
        } finally {
            const resetLoading = {}
            incompleteRows.forEach(r => { resetLoading[r.rowIndex] = false })
            setCsvRowAiLoading(prev => ({ ...prev, ...resetLoading }))
        }
    }

    const handleEditCsvRow = (idx, q) => {
        setEditingCsvRow(idx)
        setCsvEditForm({ ...q, options: [...q.options], correctAnswerIndex: q.correctAnswerIndex ?? 0 })
    }

    const handleSaveCsvRow = () => {
        const updated = [...previewQuestions]
        updated[editingCsvRow] = {
            ...csvEditForm,
            correctAnswerIndex: parseInt(csvEditForm.correctAnswerIndex),
            correctAnswer: csvEditForm.options[parseInt(csvEditForm.correctAnswerIndex)] || ''
        }
        setPreviewQuestions(updated)
        
        // Clear AI error since we edited manually
        const newAiResults = { ...csvRowAiResults }
        delete newAiResults[editingCsvRow]
        setCsvRowAiResults(newAiResults)
        
        setEditingCsvRow(null)
        setCsvEditForm(null)
    }

    const confirmImport = async () => {
        // Only import valid rows
        const validQuestions = previewQuestions.filter(q => {
            const issues = validateCsvRow(q)
            return issues.length === 0
        })

        if (validQuestions.length === 0) {
            toast.error("No valid questions to import. Please fix all issues first.")
            return
        }

        setIsImporting(true);
        try {
            const token = localStorage.getItem('profToken');
            await axios.post(`/api/professor/batches/${id}/questions/bulk`, { questions: validQuestions }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchBatchData();
            toast.success(`${validQuestions.length} questions imported successfully!`);
            setPreviewQuestions(null);
            setCsvRowAiResults({});
        } catch (error) {
            toast.error("Error importing questions: " + (error.response?.data?.message || error.message));
        } finally {
            setIsImporting(false);
        }
    };

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin" size={32} /></div>
    }

    // ── Count valid/incomplete/invalid rows for CSV preview ──────────
    const csvStats = previewQuestions ? (() => {
        let valid = 0, incomplete = 0, invalid = 0
        previewQuestions.forEach(q => {
            const issues = validateCsvRow(q)
            const status = getRowStatus(issues)
            if (status === 'valid') valid++
            else if (status === 'incomplete') incomplete++
            else invalid++
        })
        return { valid, incomplete, invalid }
    })() : null

    return (
        <>
            {/* Template Preview Modal */}
            <Modal open={showTemplatePreview} onClose={() => setShowTemplatePreview(false)} title="CSV Template Preview" size="full">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                        This is how your CSV file should be structured. The first row must contain these exact headers.
                    </p>
                    <div style={{ background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-subtle)', maxHeight: '400px', overflow: 'auto' }}>
                        <table className="table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Title</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Option 1</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Option 2</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Option 3</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Option 4</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Correct Option Index (0-3)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Difficulty (easy/medium/hard)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>Topic</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>What is the capital of France?</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>London</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Berlin</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Paris</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Madrid</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>2</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>easy</td>
                                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Geography</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                        <button className="btn btn-ghost" onClick={() => setShowTemplatePreview(false)}>Close</button>
                        <button className="btn btn-primary flex items-center gap-2" onClick={() => { downloadTemplate(); setShowTemplatePreview(false); }}>
                            <Download size={16} /> Download CSV
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Enhanced Import Preview Modal with AI Repair ────────── */}
            <Modal
                open={!!previewQuestions}
                onClose={() => { setPreviewQuestions(null); setCsvRowAiResults({}); setEditingCsvRow(null); setCsvEditForm(null); }}
                title={`Preview Imported Questions (${previewQuestions?.length || 0})`}
                size="full"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => { setPreviewQuestions(null); setCsvRowAiResults({}); setEditingCsvRow(null); setCsvEditForm(null); }} disabled={isImporting}>Cancel</button>
                        <button className="btn btn-primary" onClick={confirmImport} disabled={isImporting || (csvStats && csvStats.valid === 0)}>
                            {isImporting ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : <Upload size={16} style={{ marginRight: 6 }} />}
                            {isImporting ? 'Importing...' : `Import ${csvStats?.valid || 0} Valid Questions`}
                        </button>
                    </>
                }
            >
                <div style={{ padding: '0px 0', overflowY: 'auto' }}>
                    {/* Stats bar */}
                    {csvStats && (
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{csvStats.valid} Valid</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} style={{ color: 'var(--warning, #f59e0b)' }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{csvStats.incomplete} Incomplete</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <XCircle size={14} style={{ color: 'var(--danger)' }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{csvStats.invalid} Invalid</span>
                            </div>
                            {csvStats.incomplete > 0 && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ marginLeft: 'auto', color: 'var(--brand-primary)', gap: 6 }}
                                    onClick={handleAiFixAll}
                                    disabled={Object.values(csvRowAiLoading).some(Boolean)}
                                >
                                    <Sparkles size={14} /> Fix All with AI
                                </button>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: 16 }}>
                        {previewQuestions?.map((q, idx) => {
                            const issues = validateCsvRow(q)
                            const status = getRowStatus(issues)
                            const aiResult = csvRowAiResults[idx]
                            const isAiLoading = csvRowAiLoading[idx]

                            return (
                                <div key={idx} style={{
                                    padding: 16,
                                    border: `1px solid ${status === 'valid' ? 'var(--border-subtle)' : status === 'incomplete' ? 'var(--warning, #f59e0b)' : 'var(--danger)'}`,
                                    borderRadius: 8,
                                    background: 'var(--bg-surface)',
                                    borderLeft: `4px solid ${status === 'valid' ? 'var(--success)' : status === 'incomplete' ? 'var(--warning, #f59e0b)' : 'var(--danger)'}`,
                                }}>
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: 4, flexShrink: 0 }}>Q{idx + 1}</span>
                                            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>{q.title || <em style={{ color: 'var(--text-tertiary)' }}>No question text</em>}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            {/* Status badge */}
                                            {status === 'valid' && (
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', background: 'var(--success-subtle)', padding: '3px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <CheckCircle size={12} /> Valid
                                                </span>
                                            )}
                                            {status === 'incomplete' && (
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning, #f59e0b)', background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <AlertTriangle size={12} /> Incomplete
                                                </span>
                                            )}
                                            {status === 'invalid' && (
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'var(--danger-subtle)', padding: '3px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <XCircle size={12} /> Invalid
                                                </span>
                                            )}

                                            {/* AI Fix button for incomplete rows */}
                                            {status === 'incomplete' && !aiResult && (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--brand-primary)', gap: 4, fontSize: 12 }}
                                                    onClick={() => handleAiFixRow(idx)}
                                                    disabled={isAiLoading}
                                                >
                                                    {isAiLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                                                    {isAiLoading ? 'Fixing...' : 'Fix with AI'}
                                                </button>
                                            )}
                                            
                                            {/* Edit button */}
                                            <button
                                                className="btn btn-ghost btn-sm btn-icon"
                                                onClick={() => handleEditCsvRow(idx, q)}
                                                title="Edit Row Manually"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Edit Form */}
                                    {editingCsvRow === idx && csvEditForm ? (
                                        <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-default)', marginBottom: 16 }}>
                                            <div style={{ display: 'grid', gap: 12 }}>
                                                <div>
                                                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Question Title</label>
                                                    <input className="form-input" style={{ background: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13, marginTop: 4 }} value={csvEditForm.title} onChange={e => setCsvEditForm({...csvEditForm, title: e.target.value})} />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                    {[0,1,2,3].map(i => (
                                                        <div key={i}>
                                                            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Option {String.fromCharCode(65 + i)}</label>
                                                            <input className="form-input" style={{ background: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13, marginTop: 4 }} value={csvEditForm.options[i]} onChange={e => { const newOpts = [...csvEditForm.options]; newOpts[i] = e.target.value; setCsvEditForm({...csvEditForm, options: newOpts}) }} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                                    <div>
                                                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Correct Option</label>
                                                        <select className="form-input" style={{ background: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13, marginTop: 4 }} value={csvEditForm.correctAnswerIndex} onChange={e => setCsvEditForm({...csvEditForm, correctAnswerIndex: parseInt(e.target.value)})}>
                                                            <option value={0}>A</option><option value={1}>B</option><option value={2}>C</option><option value={3}>D</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Difficulty</label>
                                                        <select className="form-input" style={{ background: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13, marginTop: 4 }} value={csvEditForm.difficultyLevel} onChange={e => setCsvEditForm({...csvEditForm, difficultyLevel: e.target.value})}>
                                                            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Topic</label>
                                                        <input className="form-input" style={{ background: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13, marginTop: 4 }} value={csvEditForm.topic} onChange={e => setCsvEditForm({...csvEditForm, topic: e.target.value})} />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCsvRow(null); setCsvEditForm(null); }}>Cancel</button>
                                                    <button className="btn btn-primary btn-sm" onClick={handleSaveCsvRow}>Save Row</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Show missing fields for incomplete rows */}
                                    {status !== 'valid' && issues.length > 0 && !aiResult && (
                                        <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, marginBottom: 12, marginLeft: 40 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>Missing: </span>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{issues.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* AI fix result */}
                                    {aiResult && !aiResult.needsReview && (
                                        <div style={{ padding: '8px 12px', background: 'var(--success-subtle)', borderRadius: 6, marginBottom: 12, marginLeft: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                                            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>AI Fixed</span>
                                            {aiResult.fixedFields?.length > 0 && (
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({aiResult.fixedFields.join(', ')})</span>
                                            )}
                                            {aiResult.confidence && (
                                                <span style={{ fontSize: 11, color: getConfidenceStyle(aiResult.confidence).color, marginLeft: 'auto' }}>
                                                    {Math.round(aiResult.confidence * 100)}% confidence
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {aiResult && aiResult.needsReview && (
                                        <div style={{ padding: '8px 12px', background: 'var(--danger-subtle)', borderRadius: 6, marginBottom: 12, marginLeft: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                                            <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>Manual review required</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{aiResult.reason}</span>
                                        </div>
                                    )}

                                    {/* Options grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 40, marginBottom: 16 }}>
                                        {q.options.map((opt, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, border: i === q.correctAnswerIndex ? '1px solid var(--success-border)' : '1px solid var(--border-subtle)', background: i === q.correctAnswerIndex ? 'var(--success-subtle)' : 'var(--bg-elevated)' }}>
                                                <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: i === q.correctAnswerIndex ? 'var(--success)' : 'var(--bg-surface)', color: i === q.correctAnswerIndex ? 'white' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{String.fromCharCode(65 + i)}</span>
                                                <span style={{ fontSize: 14, color: opt ? (i === q.correctAnswerIndex ? 'var(--text-primary)' : 'var(--text-secondary)') : 'var(--danger)' }}>
                                                    {opt || <em>Empty</em>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, paddingLeft: 40 }}>
                                        <StatusBadge status={q.difficultyLevel || 'unknown'} />
                                        {q.topic && <span style={{ fontSize: 12, color: 'var(--brand-primary)', background: 'var(--brand-primary-subtle)', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>{q.topic}</span>}
                                    </div>
                                    </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </Modal>

            <div className="page-header" style={{ marginBottom: 32 }}>
                <div className="page-header-top">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/professor/batches')} style={{ padding: 4 }}>
                                <ArrowLeft size={16} />
                            </button>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Manage Content
                            </p>
                        </div>
                        <h1 className="page-title" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                            {isEditMode ? 'Edit Batch' : 'Create New Batch'}
                        </h1>
                        <p className="page-subtitle" style={{ fontSize: 14 }}>
                            {isEditMode ? 'Add or edit questions in this pool.' : 'Start building a new pool of questions for your exams.'}
                        </p>
                    </div>
                    {isEditMode && batch && (
                        <div className="page-actions">
                            <StatusBadge status={batch.status} />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                {isEditMode && batch ? (
                    <div className="card" style={{ padding: '24px', display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Batch Subject</div>
                            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{batch.subject}</div>
                        </div>
                        <div style={{ width: '1px', height: 40, background: 'var(--border-default)' }}></div>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Batch Title</div>
                            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{batch.title}</div>
                        </div>
                        {batch.description && (
                            <>
                                <div style={{ width: '1px', height: 40, background: 'var(--border-default)' }}></div>
                                <div style={{ flex: 2 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Description</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{batch.description}</div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header" style={{ padding: '20px 24px' }}>
                            <h2 className="card-title">Batch Details</h2>
                        </div>
                        <div className="card-body" style={{ padding: '24px' }}>
                            <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: '1rem' }}>
                                <div className="form-group batch-form-group">
                                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Batch Title *</label>
                                    <input className="form-input batch-form-input" type="text" placeholder="e.g. Physics Midterm Pool" value={batchTitle} onChange={(e) => setBatchTitle(e.target.value)} required />
                                </div>

                                {/* ── AI Generate Batch Button ───────────────── */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        style={{
                                            color: 'var(--brand-primary)',
                                            border: '1px solid var(--brand-primary)',
                                            borderStyle: 'dashed',
                                            gap: 6,
                                            borderRadius: 8,
                                            padding: '6px 14px',
                                        }}
                                        onClick={() => handleAiGenerateBatch(false)}
                                        disabled={aiBatchLoading || batchTitle.trim().length < 3}
                                    >
                                        {aiBatchLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                                        {aiBatchLoading ? 'Generating...' : 'Generate with AI'}
                                    </button>

                                    {/* Overwrite warning */}
                                    {aiBatchResult?.showOverwriteWarning && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            <span>Subject/Description already filled.</span>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                style={{ color: 'var(--brand-primary)', gap: 4, fontSize: 12, padding: '2px 8px' }}
                                                onClick={() => { setAiBatchResult(null); handleAiGenerateBatch(true); }}
                                            >
                                                <RefreshCw size={12} /> Regenerate
                                            </button>
                                        </div>
                                    )}

                                    {/* Success indicator */}
                                    {aiBatchResult && !aiBatchResult.needsReview && !aiBatchResult.showOverwriteWarning && (
                                        <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <CheckCircle size={12} /> Generated with AI
                                        </span>
                                    )}
                                </div>

                                <div className="form-group batch-form-group">
                                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Subject *</label>
                                    <input className="form-input batch-form-input" type="text" placeholder="e.g. Physics" value={batchSubject} onChange={(e) => setBatchSubject(e.target.value)} required />
                                </div>
                                <div className="form-group batch-form-group">
                                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Description (Optional)</label>
                                    <textarea className="form-input" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 6, color: 'var(--text-primary)', minHeight: 80 }} placeholder="Brief description of the batch content" value={batchDescription} onChange={(e) => setBatchDescription(e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: 16 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/professor/batches')} disabled={isCreatingBatch}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={isCreatingBatch}>
                                        {isCreatingBatch ? <Loader2 size={16} className="spin" style={{ marginRight: 6 }} /> : <Plus size={16} style={{ marginRight: 6 }} />}
                                        {isCreatingBatch ? 'Creating...' : 'Create Batch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Question Modal with AI Generation ─────────────────── */}
                <Modal
                    open={isQuestionModalOpen}
                    onClose={() => { setIsQuestionModalOpen(false); setEditingQuestionId(null); setTitle(''); setOptions(['', '', '', '']); setCorrectAnswer(''); setTopic(''); setAiQuestionResult(null); setAiClarification(''); }}
                    title={editingQuestionId ? 'Edit Question' : 'Add Question'}
                    size="lg"
                >
                    <form onSubmit={handleAddQuestionToBatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="form-group batch-form-group">
                            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Question Text *</label>
                            <input className="form-input batch-form-input" type="text" placeholder="e.g. What is React?" value={title} onChange={(e) => setTitle(e.target.value)} required />
                        </div>

                        {/* ── AI Generate Question Button ──────────────── */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{
                                    color: 'var(--brand-primary)',
                                    border: '1px solid var(--brand-primary)',
                                    borderStyle: 'dashed',
                                    gap: 6,
                                    borderRadius: 8,
                                    padding: '6px 14px',
                                }}
                                onClick={handleAiGenerateQuestion}
                                disabled={aiQuestionLoading || title.trim().length < 10}
                            >
                                {aiQuestionLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                                {aiQuestionLoading ? 'Generating...' : 'Generate with AI'}
                            </button>

                            {aiQuestionResult && !aiQuestionResult.needsReview && (
                                <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={12} /> AI generated — review below
                                </span>
                            )}
                            {aiQuestionResult && aiQuestionResult.needsReview && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 'auto', padding: '12px', background: 'var(--danger-subtle)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)', width: '100%' }}>
                                    <span style={{ fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                                        <AlertTriangle size={14} /> {aiQuestionResult.reason || 'Needs more context'}
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input 
                                            className="form-input" 
                                            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '6px 12px', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13 }} 
                                            type="text" 
                                            placeholder="Clarify context or provide intended option..." 
                                            value={aiClarification} 
                                            onChange={(e) => setAiClarification(e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiGenerateQuestion(); } }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            style={{ padding: '6px 14px', borderRadius: 6 }}
                                            onClick={handleAiGenerateQuestion}
                                            disabled={aiQuestionLoading || !aiClarification.trim()}
                                        >
                                            {aiQuestionLoading ? <Loader2 size={14} className="spin" /> : 'Re-generate'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div className="form-group batch-form-group">
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Subject (Inherited) *</label>
                                <input className="form-input" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '8px 12px', borderRadius: 6, color: 'var(--text-secondary)', opacity: 0.7 }} type="text" placeholder="Subject" value={batchSubject} readOnly disabled />
                            </div>
                            <div className="form-group batch-form-group">
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Topic *</label>
                                <input className="form-input batch-form-input" type="text" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} required />
                            </div>
                            <div className="form-group batch-form-group">
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Difficulty *</label>
                                <select className="form-input batch-form-input" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)}>
                                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group batch-form-group">
                            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Options *</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {[0, 1, 2, 3].map(index => (
                                    <input key={index} className="form-input batch-form-input" type="text" placeholder={`Option ${index + 1}`} value={options[index]} onChange={(e) => handleOptionChange(index, e.target.value)} required />
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group batch-form-group">
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Exact Correct Answer Text (optional)</label>
                                <input className="form-input batch-form-input" type="text" placeholder="Exact Correct Answer Text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
                            </div>
                            <div className="form-group batch-form-group">
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Correct Option *</label>
                                <select className="form-input batch-form-input" value={correctAnswerIndex} onChange={(e) => setCorrectAnswerIndex(e.target.value)}>
                                    <option value={0}>Option 1 is correct</option><option value={1}>Option 2 is correct</option><option value={2}>Option 3 is correct</option><option value={3}>Option 4 is correct</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <button type="submit" className="btn btn-primary">{editingQuestionId ? 'Update Question' : 'Save Question'}</button>
                        </div>
                    </form>
                </Modal>

                {isEditMode && batch && (
                    <div className="card" style={{ overflow: 'visible' }}>
                        <div className="card-header" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="card-title">Questions in Batch ({batch.questions?.length || 0})</h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => setIsQuestionModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: 4 }} /> Add Question
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplatePreview(true)}>
                                    <Download size={14} style={{ marginRight: 4 }} /> CSV Template
                                </button>
                                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', margin: 0 }}>
                                    <Upload size={14} style={{ marginRight: 4 }} /> Import CSV
                                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>
                        <div className="card-body" style={{ padding: '24px' }}>
                            {batch.questions && batch.questions.length > 0 ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {batch.questions.map((q, idx) => (
                                        <div key={q._id} style={{ padding: 16, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {idx + 1}. {q.title}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditQuestion(q)} title="Edit Question">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteQuestion(q._id)} title="Delete Question">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                {q.options && q.options.map((opt, oIdx) => (
                                                    <div key={oIdx} style={{ padding: '4px 8px', background: oIdx === q.correctAnswerIndex ? 'var(--success-subtle)' : 'var(--bg-base)', color: oIdx === q.correctAnswerIndex ? 'var(--success)' : 'var(--text-secondary)', borderRadius: 4, border: oIdx === q.correctAnswerIndex ? '1px solid var(--success)' : '1px solid var(--border-default)' }}>
                                                        {String.fromCharCode(65 + oIdx)}. {opt}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 16 }}>
                                                <span>Topic: {q.topic}</span>
                                                <span style={{ textTransform: 'capitalize' }}>Difficulty: {q.difficultyLevel}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
                                    No questions added yet.
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 24, borderTop: '1px solid var(--border-default)', paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24, margin: '24px -24px -24px -24px', justifyContent: 'space-between', position: 'sticky', bottom: 0, background: 'var(--bg-card)', zIndex: 10, boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}>
                                <button className="btn btn-danger btn-sm" style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={handleDeleteBatch}>
                                    <Trash2 size={14} style={{ marginRight: 4 }} /> Delete Batch
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={submitBatch} disabled={!batch.questions || batch.questions.length === 0 || submittingBatchId === batch._id}>
                                    {submittingBatchId === batch._id ? <Loader2 size={14} className="spin" style={{ marginRight: 4 }} /> : <Send size={14} style={{ marginRight: 4 }} />}
                                    {submittingBatchId === batch._id ? 'Submitting...' : 'Submit to Admin'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export default ProfessorCreateBatchPage
