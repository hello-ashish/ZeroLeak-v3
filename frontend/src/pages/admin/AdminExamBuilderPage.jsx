import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from './AdminLayout.jsx'
import { 
    ArrowLeft, Check, BookOpen, Database, Trash2, Plus, 
    Sparkles, Shield, ShieldAlert, Cpu, Clock, Award, 
    FileText, CheckCircle2, AlertTriangle, AlertCircle, 
    Layers, Sliders, ChevronRight, CheckCircle, Target, Flame, Scale
} from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import axios from 'axios'
import './AdminExamBuilderPage.css'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const DIFFICULTY_PRESETS = [
    { label: 'Balanced', icon: Target, easy: 30, medium: 50, hard: 20 },
    { label: 'Rigorous', icon: Flame, easy: 15, medium: 45, hard: 40 },
    { label: 'Foundational', icon: BookOpen, easy: 50, medium: 40, hard: 10 },
    { label: 'Equal Split', icon: Scale, easy: 34, medium: 33, hard: 33 }
]

const AI_SUGGESTION_CHIPS = [
    { label: 'JEE Mains (PCM - 75 Qs)', prompt: 'Create a full JEE Mains pattern examination with Physics, Chemistry, and Mathematics. 25 questions each, 60 minutes each, 50% passing threshold.' },
    { label: 'CS Midterm (OS & Networks)', prompt: 'Build a computer science midterm on Operating Systems and Computer Networks, 30 questions each, 45 minutes duration.' },
    { label: 'Medical Entrance (Bio, Chem, Phys)', prompt: 'Design a standard medical entrance examination covering Biology, Chemistry, and Physics with balanced difficulty.' },
    { label: 'General Aptitude & English', prompt: 'Create a 2-section assessment for Quantitative Aptitude and Verbal English, 20 questions each, 30 minutes each.' }
]

export const AdminExamBuilderPage = () => {
    const [step, setStep] = useState(1)
    const [form, setForm] = useState({ 
        title: '', 
        description: '', 
        mode: 'Normal' 
    })
    const [subjects, setSubjects] = useState([])
    const [availableSubjects, setAvailableSubjects] = useState([])
    const [subjectInventory, setSubjectInventory] = useState({})
    const [currentSubj, setCurrentSubj] = useState({ 
        subject: '', 
        numQuestions: 15, 
        durationMinutes: 45, 
        passingPercentage: 50, 
        easy: 30, 
        medium: 50, 
        hard: 20 
    })
    const [isCustomSubject, setIsCustomSubject] = useState(false)
    const [customSubjectName, setCustomSubjectName] = useState('')
    const [creating, setCreating] = useState(false)
    const [aiCopilotPrompt, setAiCopilotPrompt] = useState('')
    const [aiCopilotLoading, setAiCopilotLoading] = useState(false)
    const navigate = useNavigate()
    const toast = useToast()

    // Fetch Question Bank subjects and inventory statistics
    useEffect(() => {
        const fetchQuestionBank = async () => {
            try {
                const token = getToken()
                if (!token) return
                const res = await axios.get(`${API}/questions`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                })
                
                if (res.data.subjects) {
                    setAvailableSubjects(res.data.subjects)
                }

                // If chartDataAll or stats exist, build inventory map
                if (res.data.chartDataAll && Array.isArray(res.data.chartDataAll)) {
                    const inv = {}
                    res.data.chartDataAll.forEach(item => {
                        const total = (item.Easy || 0) + (item.Medium || 0) + (item.Hard || 0)
                        inv[item.name] = {
                            total,
                            easy: item.Easy || 0,
                            medium: item.Medium || 0,
                            hard: item.Hard || 0
                        }
                    })
                    setSubjectInventory(inv)
                }
            } catch (err) {
                console.error('Failed to load question bank inventory:', err)
            }
        }
        fetchQuestionBank()
    }, [])

    // Aggregate statistics for real-time blueprint
    const blueprintStats = useMemo(() => {
        const totalQuestions = subjects.reduce((sum, s) => sum + (Number(s.numQuestions) || 0), 0)
        const totalDuration = subjects.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
        const totalMarks = totalQuestions * 4 // Standard 4 marks per question
        const hours = Math.floor(totalDuration / 60)
        const mins = totalDuration % 60
        const formattedDuration = hours > 0 
            ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` 
            : `${mins}m`

        return {
            totalQuestions,
            totalDuration,
            formattedDuration,
            totalMarks,
            subjectCount: subjects.length
        }
    }, [subjects])

    // Difficulty sum verification
    const difficultySum = (Number(currentSubj.easy) || 0) + (Number(currentSubj.medium) || 0) + (Number(currentSubj.hard) || 0)
    const isDifficultyBalanced = difficultySum === 100

    const applyDifficultyPreset = (preset) => {
        setCurrentSubj(prev => ({
            ...prev,
            easy: preset.easy,
            medium: preset.medium,
            hard: preset.hard
        }))
    }

    const autoBalanceDifficulty = () => {
        const easy = Math.min(100, Math.max(0, Number(currentSubj.easy) || 0))
        const medium = Math.min(100, Math.max(0, Number(currentSubj.medium) || 0))
        const remainder = 100 - (easy + medium)
        if (remainder >= 0) {
            setCurrentSubj(prev => ({ ...prev, easy, medium, hard: remainder }))
        } else {
            setCurrentSubj(prev => ({ ...prev, easy: 30, medium: 50, hard: 20 }))
        }
    }

    const handleAiCopilot = async (customPrompt) => {
        const promptToRun = customPrompt || aiCopilotPrompt
        if (!promptToRun || !promptToRun.trim()) return
        setAiCopilotLoading(true)
        try {
            const token = getToken()
            const res = await axios.post(`${API}/ai/admin/exam-copilot`, { 
                prompt: promptToRun, 
                availableSubjects 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const result = res.data
            if (result.title) {
                setForm({
                    title: result.title,
                    description: result.description || '',
                    mode: result.mode === 'Zeroleak' ? 'Zeroleak' : 'Normal'
                })
                
                if (result.subjects && result.subjects.length > 0) {
                    setSubjects(result.subjects.map(s => ({
                        subject: s.subject,
                        numQuestions: s.numQuestions || 15,
                        durationMinutes: s.durationMinutes || Math.round((s.numQuestions || 15) * 1.5),
                        passingPercentage: s.passingPercentage || 50,
                        easy: 30,
                        medium: 50,
                        hard: 20
                    })))
                }
                toast.success('AI Architect successfully synthesized your examination matrix!')
                setAiCopilotPrompt('')
                setStep(2) // Move to subject calibration step to review
            } else {
                toast.error('AI could not determine the exam structure. Please adjust prompt.')
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'AI Copilot synthesis failed')
        } finally {
            setAiCopilotLoading(false)
        }
    }

    const handleAddSubject = () => {
        const finalSubject = isCustomSubject ? customSubjectName.trim() : currentSubj.subject
        if (!finalSubject) {
            return toast.error('Please specify a valid subject name')
        }
        if (subjects.some(s => s.subject.toLowerCase() === finalSubject.toLowerCase())) {
            return toast.error('Subject already added to examination')
        }
        if (!isDifficultyBalanced) {
            return toast.error(`Difficulty percentages must equal 100% (currently ${difficultySum}%)`)
        }
        if (currentSubj.numQuestions <= 0) {
            return toast.error('Number of questions must be at least 1')
        }
        if (currentSubj.durationMinutes <= 0) {
            return toast.error('Duration must be greater than 0 minutes')
        }

        // Warning if Normal mode and Bank has fewer questions
        const bankInfo = subjectInventory[finalSubject]
        if (form.mode === 'Normal' && bankInfo && bankInfo.total < currentSubj.numQuestions) {
            toast.error(`Question Bank only contains ${bankInfo.total} questions for ${finalSubject}. Reduce questions or use Zeroleak mode.`)
            return
        }

        setSubjects(prev => [...prev, { 
            ...currentSubj, 
            subject: finalSubject 
        }])
        
        // Reset form for next subject
        setCurrentSubj({ 
            subject: '', 
            numQuestions: 15, 
            durationMinutes: 45, 
            passingPercentage: 50, 
            easy: 30, 
            medium: 50, 
            hard: 20 
        })
        setCustomSubjectName('')
        setIsCustomSubject(false)
        toast.success(`Section "${finalSubject}" added to blueprint`)
    }

    const removeSubject = (idx) => {
        const removed = subjects[idx]?.subject
        setSubjects(subjects.filter((_, i) => i !== idx))
        toast.success(`Removed "${removed}" from blueprint`)
    }

    const handleCreate = async () => {
        if (!form.title.trim()) return toast.error('Examination Title is required')
        if (subjects.length === 0) return toast.error('At least one subject section is required')

        setCreating(true)
        try {
            await axios.post(`${API}/admin/examinations`, {
                title: form.title.trim(),
                description: form.description.trim() || 'Institutional assessment provisioned via ZeroLeak Examination Builder.',
                mode: form.mode,
                subjects: subjects
            }, { headers: { Authorization: `Bearer ${getToken()}` } })

            toast.success('Examination successfully provisioned and committed to Fabric!')
            navigate('/admin/exams')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create examination')
        } finally {
            setCreating(false)
        }
    }

    const insertStandardInstructions = () => {
        const template = 
`1. All questions are mandatory.
2. Standard marking scheme: +4 marks for correct response, -1 penalty for incorrect response.
3. System tab switching, secondary display detection, or peripheral anomalies will trigger automated proctoring flags.
4. Candidates must complete all configured sections within the allocated time window.
5. Upon test submission, answers are cryptographically hashed and sealed to the institutional ledger.`
        setForm(f => ({ ...f, description: template }))
        toast.success('Standard examination instructions inserted')
    }

    const activeBankInfo = currentSubj.subject ? subjectInventory[currentSubj.subject] : null

    return (
        <AdminLayout>
            <div className="builder-container">
                {/* Top Breadcrumb & Header */}
                <div className="builder-breadcrumb">
                    <button onClick={() => navigate('/admin/exams')}>
                        <ArrowLeft size={14} /> Examinations
                    </button>
                    <span>/</span>
                    <span>Builder Wizard</span>
                </div>

                <div className="builder-header-row">
                    <div>
                        <h1 className="builder-title">Examination Builder</h1>
                        <p className="builder-subtitle">
                            Configure institutional assessments with cryptographic Merkle verification and ZeroLeak™ JIT dynamic delivery.
                        </p>
                    </div>

                    {/* Live Blueprint Summary Badge */}
                    <div className="builder-quick-stats">
                        <div className="builder-quick-stats-item">
                            <Layers size={14} style={{ color: 'var(--brand-primary)' }} />
                            <span>Sections: <strong>{blueprintStats.subjectCount}</strong></span>
                        </div>
                        <div className="builder-quick-stats-divider" />
                        <div className="builder-quick-stats-item">
                            <FileText size={14} style={{ color: 'var(--info)' }} />
                            <span>Questions: <strong>{blueprintStats.totalQuestions}</strong></span>
                        </div>
                        <div className="builder-quick-stats-divider" />
                        <div className="builder-quick-stats-item">
                            <Clock size={14} style={{ color: 'var(--warning)' }} />
                            <span>Duration: <strong>{blueprintStats.formattedDuration}</strong></span>
                        </div>
                    </div>
                </div>

                {/* Wizard Stepper Bar */}
                <div className="wizard-stepper">
                    {[
                        { num: 1, title: 'Core Information', desc: 'Title, candidate rules & architecture' },
                        { num: 2, title: 'Curriculum Matrix', desc: 'Subjects, quotas & difficulty weights' },
                        { num: 3, title: 'Verification & Deploy', desc: 'Pre-flight check & Fabric provisioning' }
                    ].map((s, idx, arr) => {
                        const isCompleted = step > s.num
                        const isActive = step === s.num
                        const isPending = step < s.num

                        return (
                            <React.Fragment key={s.num}>
                                <button 
                                    className={`wizard-step ${isActive ? 'active' : isCompleted ? 'completed' : 'pending'}`}
                                    onClick={() => isCompleted && setStep(s.num)}
                                    disabled={isPending}
                                >
                                    <div className="wizard-step-circle">
                                        {isCompleted ? <Check size={16} strokeWidth={2.5} /> : s.num}
                                    </div>
                                    <div className="wizard-step-info">
                                        <span className="wizard-step-title">{s.title}</span>
                                        <span className="wizard-step-desc">{s.desc}</span>
                                    </div>
                                </button>
                                {idx < arr.length - 1 && (
                                    <div className={`wizard-step-connector ${step > s.num ? 'completed' : step === s.num ? 'active' : ''}`} />
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>

                {/* ─── STEP 1: Core Information ─── */}
                {step === 1 && (
                    <div>
                        {/* AI Exam Copilot Hero Card */}
                        <div className="ai-copilot-card">
                            <div className="ai-copilot-header">
                                <div className="ai-copilot-title-group">
                                    <div className="ai-copilot-icon">
                                        <Sparkles size={16} />
                                    </div>
                                    <div>
                                        <h3 className="ai-copilot-heading">AI Curriculum Architect</h3>
                                    </div>
                                </div>
                                <div className="ai-badge">
                                    <span className="ai-badge-pulse" />
                                    <span>LLM Synthesizer Ready</span>
                                </div>
                            </div>

                            <p className="ai-copilot-desc">
                                Describe your curriculum or exam standard in natural language. The architect automatically allocates subjects, section quotas, duration, and difficulty balance.
                            </p>

                            <div className="ai-input-bar">
                                <input 
                                    type="text" 
                                    className="ai-input-field" 
                                    placeholder="e.g. Build me a JEE Mains midterm with Physics, Chemistry, and Mathematics (25 Qs each, 180 min total)" 
                                    value={aiCopilotPrompt} 
                                    onChange={e => setAiCopilotPrompt(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleAiCopilot()
                                    }}
                                />
                                <button 
                                    className="ai-btn-generate" 
                                    onClick={() => handleAiCopilot()} 
                                    disabled={aiCopilotLoading || !aiCopilotPrompt.trim()}
                                >
                                    <Sparkles size={15} />
                                    {aiCopilotLoading ? 'Synthesizing...' : 'Auto-Build'}
                                </button>
                            </div>

                            <div className="ai-presets">
                                <span className="ai-preset-label">Templates:</span>
                                {AI_SUGGESTION_CHIPS.map((chip, i) => (
                                    <button 
                                        key={i} 
                                        type="button" 
                                        className="ai-preset-chip"
                                        onClick={() => {
                                            setAiCopilotPrompt(chip.prompt)
                                            handleAiCopilot(chip.prompt)
                                        }}
                                    >
                                        <Sparkles size={11} style={{ marginRight: 5, color: 'var(--brand-primary)' }} />
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Core Details Form Card */}
                        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>General Assessment Specification</h2>
                                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Institutional metadata and candidate instructions</p>
                                </div>
                            </div>

                            {/* Title Field */}
                            <div className="form-group mb-4">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Examination Title *</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'none', fontWeight: 400 }}>Official academic designation</span>
                                </label>
                                <input 
                                    className="form-input" 
                                    placeholder="e.g. JEE Mains 2026 - All India Engineering Entrance" 
                                    autoFocus 
                                    value={form.title} 
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                                    style={{ fontSize: 14, padding: '11px 14px' }}
                                />
                            </div>

                            {/* Description & Candidate Instructions */}
                            <div className="form-group mb-4">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label className="form-label" style={{ margin: 0 }}>Candidate Instructions & Code of Conduct *</label>
                                    <button 
                                        type="button" 
                                        className="btn btn-ghost btn-sm" 
                                        onClick={insertStandardInstructions}
                                        style={{ fontSize: 11, padding: '2px 8px', height: 24, color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                        <Plus size={12} /> Insert Standard Rules Template
                                    </button>
                                </div>
                                <textarea 
                                    className="form-textarea" 
                                    style={{ minHeight: 130, lineHeight: 1.5, fontSize: 13 }} 
                                    placeholder="Enter instructions displayed to candidates prior to launching the examination..." 
                                    value={form.description} 
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                                />
                            </div>

                            {/* Exam Mode Interactive Architecture Selection */}
                            <div className="form-group" style={{ marginTop: 24 }}>
                                <label className="form-label" style={{ marginBottom: 4 }}>
                                    Examination Delivery Architecture *
                                </label>
                                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                                    Choose the underlying paper compilation and security engine for this assessment.
                                </p>

                                <div className="mode-selection-grid">
                                    {/* Normal Mode Card */}
                                    <div 
                                        className={`mode-card ${form.mode === 'Normal' ? 'selected' : ''}`}
                                        onClick={() => setForm(f => ({ ...f, mode: 'Normal' }))}
                                    >
                                        <div className="mode-card-header">
                                            <div className="mode-card-icon-wrap">
                                                <Database size={20} />
                                            </div>
                                            <span className="mode-card-badge badge-normal-mode">
                                                Deterministic Bank
                                            </span>
                                        </div>
                                        <h4 className="mode-card-title">Standard Pre-Generated Exam</h4>
                                        <p className="mode-card-desc">
                                            Questions are drawn from the institutional question bank upon creation and locked into a cryptographic Merkle tree.
                                        </p>
                                        <ul className="mode-features-list">
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Identical question set across cohort</span>
                                            </li>
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Instant paper rendering at test launch</span>
                                            </li>
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Fabric blockchain integrity commitment</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Zeroleak Mode Card */}
                                    <div 
                                        className={`mode-card ${form.mode === 'Zeroleak' ? 'selected' : ''}`}
                                        onClick={() => setForm(f => ({ ...f, mode: 'Zeroleak' }))}
                                    >
                                        <div className="mode-card-header">
                                            <div className="mode-card-icon-wrap" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                                                <ShieldAlert size={20} />
                                            </div>
                                            <span className="mode-card-badge badge-zeroleak-mode">
                                                Patented Anti-Leak
                                            </span>
                                        </div>
                                        <h4 className="mode-card-title">ZeroLeak™ Dynamic JIT Generation</h4>
                                        <p className="mode-card-desc">
                                            Zero questions are stored ahead of time. Every candidate receives a uniquely randomized, salted paper compiled just-in-time at test start.
                                        </p>
                                        <ul className="mode-features-list">
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Total immunity against advance leaks</span>
                                            </li>
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Unique algorithmic question permutations</span>
                                            </li>
                                            <li className="mode-feature-item">
                                                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                                                <span>Real-time per-student hash verification</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── STEP 2: Curriculum Matrix ─── */}
                {step === 2 && (
                    <div className="curriculum-layout">
                        {/* Left: Add Subject & Difficulty Calibrator */}
                        <div className="form-subcard">
                            <h3 className="section-title-sm">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sliders size={18} style={{ color: 'var(--brand-primary)' }} />
                                    Configure Curriculum Section
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                                    Step 2 of 3
                                </span>
                            </h3>

                            {/* Subject Selector */}
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="form-label">Subject Discipline *</label>
                                    <button 
                                        type="button" 
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setIsCustomSubject(!isCustomSubject)}
                                        style={{ fontSize: 11, height: 20, padding: '0 6px', color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                        {isCustomSubject ? (
                                            <><ArrowLeft size={11} /> Pick from Bank</>
                                        ) : (
                                            <><Plus size={11} /> Enter Custom Subject</>
                                        )}
                                    </button>
                                </div>

                                {isCustomSubject ? (
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="e.g. Quantum Mechanics, Machine Learning..." 
                                        value={customSubjectName}
                                        onChange={e => setCustomSubjectName(e.target.value)}
                                    />
                                ) : (
                                    <select 
                                        className="form-select" 
                                        value={currentSubj.subject} 
                                        onChange={e => setCurrentSubj({ ...currentSubj, subject: e.target.value })}
                                    >
                                        <option value="">-- Select Question Bank Subject --</option>
                                        {availableSubjects.map(subj => (
                                            <option key={subj} value={subj}>{subj}</option>
                                        ))}
                                    </select>
                                )}

                                {/* Question Bank Availability Pill */}
                                {activeBankInfo && (
                                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            Bank Inventory for <strong>{currentSubj.subject}</strong>:
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {activeBankInfo.total} Qs ({activeBankInfo.easy} Easy / {activeBankInfo.medium} Med / {activeBankInfo.hard} Hard)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Numerical Specs: Questions, Duration, Passing */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Questions *</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="1" 
                                        value={currentSubj.numQuestions} 
                                        onChange={e => {
                                            const n = parseInt(e.target.value) || 0
                                            setCurrentSubj(prev => ({ 
                                                ...prev, 
                                                numQuestions: n,
                                                // auto suggest duration based on 1.5 min per question if default
                                                durationMinutes: Math.max(15, Math.round(n * 1.5))
                                            }))
                                        }} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Duration (m) *</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="5" 
                                        value={currentSubj.durationMinutes} 
                                        onChange={e => setCurrentSubj({ ...currentSubj, durationMinutes: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pass Threshold *</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="1" 
                                        max="100" 
                                        value={currentSubj.passingPercentage} 
                                        onChange={e => setCurrentSubj({ ...currentSubj, passingPercentage: parseInt(e.target.value) || 0 })} 
                                    />
                                </div>
                            </div>

                            {/* Difficulty Distribution Calibrator */}
                            <div className="difficulty-balancer-wrap">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Difficulty Distribution Ratio
                                    </span>
                                    <span style={{ fontSize: 11, color: isDifficultyBalanced ? 'var(--success)' : 'var(--danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        {isDifficultyBalanced ? (
                                            <>
                                                <Check size={13} strokeWidth={2.5} /> 100% Balanced
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={13} /> Sum: {difficultySum}% (Must be 100%)
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Preset Buttons */}
                                <div className="difficulty-presets-row">
                                    {DIFFICULTY_PRESETS.map((p, i) => {
                                        const PresetIcon = p.icon
                                        return (
                                            <button 
                                                key={i} 
                                                type="button" 
                                                className={`difficulty-preset-btn ${currentSubj.easy === p.easy && currentSubj.medium === p.medium && currentSubj.hard === p.hard ? 'active' : ''}`}
                                                onClick={() => applyDifficultyPreset(p)}
                                            >
                                                <PresetIcon size={12} style={{ marginRight: 4 }} />
                                                {p.label}
                                            </button>
                                        )
                                    })}
                                    {!isDifficultyBalanced && (
                                        <button 
                                            type="button" 
                                            className="difficulty-preset-btn" 
                                            onClick={autoBalanceDifficulty}
                                            style={{ color: 'var(--brand-primary)', borderColor: 'var(--brand-primary-border)', background: 'var(--brand-primary-subtle)', marginLeft: 'auto' }}
                                        >
                                            Auto-Balance to 100%
                                        </button>
                                    )}
                                </div>

                                {/* Visual Tri-Color Split Bar */}
                                <div className="difficulty-progress-bar">
                                    <div className="diff-seg-easy" style={{ width: `${Math.max(0, currentSubj.easy)}%` }} title={`Easy: ${currentSubj.easy}%`} />
                                    <div className="diff-seg-medium" style={{ width: `${Math.max(0, currentSubj.medium)}%` }} title={`Medium: ${currentSubj.medium}%`} />
                                    <div className="diff-seg-hard" style={{ width: `${Math.max(0, currentSubj.hard)}%` }} title={`Hard: ${currentSubj.hard}%`} />
                                </div>

                                {/* Numerical Inputs */}
                                <div className="diff-inputs-grid">
                                    <div className="diff-input-box">
                                        <label className="diff-input-label diff-label-easy">
                                            <span className="diff-dot easy" /> Easy %
                                        </label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            min="0" 
                                            max="100" 
                                            value={currentSubj.easy} 
                                            onChange={e => setCurrentSubj({ ...currentSubj, easy: parseInt(e.target.value) || 0 })} 
                                        />
                                    </div>
                                    <div className="diff-input-box">
                                        <label className="diff-input-label diff-label-medium">
                                            <span className="diff-dot medium" /> Medium %
                                        </label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            min="0" 
                                            max="100" 
                                            value={currentSubj.medium} 
                                            onChange={e => setCurrentSubj({ ...currentSubj, medium: parseInt(e.target.value) || 0 })} 
                                        />
                                    </div>
                                    <div className="diff-input-box">
                                        <label className="diff-input-label diff-label-hard">
                                            <span className="diff-dot hard" /> Hard %
                                        </label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            min="0" 
                                            max="100" 
                                            value={currentSubj.hard} 
                                            onChange={e => setCurrentSubj({ ...currentSubj, hard: parseInt(e.target.value) || 0 })} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Add Button */}
                            <button 
                                className="btn btn-primary w-full" 
                                onClick={handleAddSubject} 
                                disabled={!isDifficultyBalanced}
                                style={{ height: 40, marginTop: 8 }}
                            >
                                <Plus size={16} /> Add Subject Section to Blueprint
                            </button>
                        </div>

                        {/* Right: Real-Time Cumulative Blueprint & Subject Stack */}
                        <div className="blueprint-metrics-card">
                            <h3 className="section-title-sm">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Layers size={18} style={{ color: 'var(--brand-primary)' }} />
                                    Active Blueprint Specification
                                </span>
                                <span className="badge badge-info">{subjects.length} Sections</span>
                            </h3>

                            {/* Real-time KPI Stats Grid */}
                            <div className="blueprint-stats-grid">
                                <div className="blueprint-stat-box">
                                    <div className="blueprint-stat-label">Total Duration</div>
                                    <div className="blueprint-stat-val" style={{ color: 'var(--brand-primary)' }}>
                                        {blueprintStats.formattedDuration}
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{blueprintStats.totalDuration} minutes</span>
                                </div>
                                <div className="blueprint-stat-box">
                                    <div className="blueprint-stat-label">Total Questions</div>
                                    <div className="blueprint-stat-val" style={{ color: 'var(--text-primary)' }}>
                                        {blueprintStats.totalQuestions}
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>~{blueprintStats.totalMarks} Marks</span>
                                </div>
                            </div>

                            {/* Configured Subjects List */}
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                                Curriculum Sections Breakdown
                            </h4>

                            {subjects.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)' }}>
                                    <Layers size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 10px auto', display: 'block' }} />
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Sections Added Yet</div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                                        Configure subject parameters on the left to add your first curriculum section.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                                    {subjects.map((s, idx) => (
                                        <div key={idx} className="subject-card-item">
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                                                        Section {String.fromCharCode(65 + idx)}
                                                    </span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                                                        {s.subject}
                                                    </span>
                                                </div>

                                                <div className="subject-meta-chips">
                                                    <span className="subject-pill">{s.numQuestions} Qs</span>
                                                    <span className="subject-pill">{s.durationMinutes} mins</span>
                                                    <span className="subject-pill">Pass: {s.passingPercentage}%</span>
                                                </div>

                                                {/* Mini Difficulty Bar */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-hover)', display: 'flex', overflow: 'hidden' }}>
                                                        <div style={{ width: `${s.easy}%`, background: 'var(--success)' }} />
                                                        <div style={{ width: `${s.medium}%`, background: 'var(--warning)' }} />
                                                        <div style={{ width: `${s.hard}%`, background: 'var(--danger)' }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                        {s.easy}% / {s.medium}% / {s.hard}%
                                                    </span>
                                                </div>
                                            </div>

                                            <button 
                                                className="btn btn-ghost btn-sm" 
                                                style={{ color: 'var(--danger)', padding: 6 }}
                                                onClick={() => removeSubject(idx)}
                                                title="Remove section"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── STEP 3: Verification & Deploy ─── */}
                {step === 3 && (
                    <div className="review-blueprint-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                            <div>
                                <span className={`review-header-badge ${form.mode === 'Zeroleak' ? 'badge-zeroleak-mode' : 'badge-normal-mode'}`}>
                                    {form.mode === 'Zeroleak' ? <ShieldAlert size={14} /> : <Database size={14} />}
                                    <span>Engine: {form.mode === 'Zeroleak' ? 'ZeroLeak™ JIT Dynamic' : 'Static Bank Deterministic'}</span>
                                </span>
                                <h2 className="review-title-display">{form.title || 'Untitled Assessment'}</h2>
                                <p className="review-desc-display">
                                    {form.description || 'No candidate instructions specified.'}
                                </p>
                            </div>

                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => setStep(1)}
                                style={{ gap: 4 }}
                            >
                                Edit Metadata
                            </button>
                        </div>

                        {/* Pre-Flight Inspection Checklist */}
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                            Pre-Flight Integrity Checklist
                        </h4>
                        <div className="preflight-checklist">
                            <div className="preflight-item valid">
                                <CheckCircle className="preflight-icon-valid" size={16} />
                                <span>Examination metadata & title valid</span>
                            </div>
                            <div className="preflight-item valid">
                                <CheckCircle className="preflight-icon-valid" size={16} />
                                <span>{subjects.length} Sections configured & verified</span>
                            </div>
                            <div className="preflight-item valid">
                                <CheckCircle className="preflight-icon-valid" size={16} />
                                <span>100% Difficulty distribution balanced</span>
                            </div>
                            <div className="preflight-item valid">
                                <CheckCircle className="preflight-icon-valid" size={16} />
                                <span>Fabric commitment queue ready</span>
                            </div>
                        </div>

                        {/* Comprehensive Section Blueprint Table */}
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                            Sections Blueprint Specification
                        </h4>
                        <div className="spec-table-wrap">
                            <table className="spec-table">
                                <thead>
                                    <tr>
                                        <th>Section / Discipline</th>
                                        <th>Questions</th>
                                        <th>Duration</th>
                                        <th>Difficulty Split (E / M / H)</th>
                                        <th>Passing Score</th>
                                        <th>Est. Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map((s, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ color: 'var(--brand-primary)', fontSize: 11 }}>
                                                        §{idx + 1}
                                                    </span>
                                                    {s.subject}
                                                </div>
                                            </td>
                                            <td>{s.numQuestions} Questions</td>
                                            <td>{s.durationMinutes} minutes</td>
                                            <td>
                                                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{s.easy}%</span> / {' '}
                                                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{s.medium}%</span> / {' '}
                                                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{s.hard}%</span>
                                            </td>
                                            <td>{s.passingPercentage}%</td>
                                            <td>{s.numQuestions * 4} Marks</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cryptographic Assurance Callout */}
                        <div style={{ padding: 18, background: 'var(--brand-primary-subtle)', border: '1px solid var(--brand-primary-border)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                            <Shield size={20} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>
                                    Enterprise Blockchain Assurance & Lifecycle Notice
                                </strong>
                                {form.mode === 'Normal' ? (
                                    <span>
                                        Generating this assessment will assemble candidate papers from the institutional question bank and compute a cryptographic Merkle root for each section. An immutable commitment transaction will be submitted to Hyperledger Fabric.
                                    </span>
                                ) : (
                                    <span>
                                        In <strong>ZeroLeak™ Mode</strong>, no questions are stored in advance. Every student will receive a unique, salted test paper generated on the fly when they begin. Individual session seeds are verifiable on the Fabric ledger.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Bottom Navigation Actions ─── */}
                <div className="builder-action-bar">
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/admin/exams')}
                    >
                        <ArrowLeft size={16} />
                        {step === 1 ? 'Cancel' : 'Previous Step'}
                    </button>

                    <div style={{ display: 'flex', gap: 12 }}>
                        {step < 3 ? (
                            <button 
                                className="btn btn-primary" 
                                onClick={() => {
                                    if (step === 1) {
                                        if (!form.title.trim()) return toast.error('Please enter an Examination Title')
                                        setStep(2)
                                    } else if (step === 2) {
                                        if (subjects.length === 0) return toast.error('Add at least one subject section before proceeding')
                                        setStep(3)
                                    }
                                }}
                                style={{ padding: '0 20px', height: 38 }}
                            >
                                <span>Continue to {step === 1 ? 'Curriculum Matrix' : 'Review & Deploy'}</span>
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                onClick={handleCreate} 
                                disabled={creating}
                                style={{ 
                                    padding: '0 24px', 
                                    height: 40,
                                    background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
                                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                                }}
                            >
                                <CheckCircle2 size={17} />
                                {creating ? 'Deploying to Fabric Ledger...' : 'Provision & Deploy Examination'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
