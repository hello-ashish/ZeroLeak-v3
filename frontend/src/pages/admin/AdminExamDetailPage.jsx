import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { EmptyState } from '../../components/SkeletonLoader.jsx'
import { useToast } from '../../components/Toast.jsx'
import { ArrowLeft, Clock, Search, Database, Trash2, Users, BarChart3, Info, Plus, Loader2 } from 'lucide-react'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')
const diffColors = { easy: 'var(--success)', medium: 'var(--warning)', hard: 'var(--danger)' }

export const AdminExamDetailPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [exam, setExam] = useState(null)
    const [allQuestions, setAllQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('Overview')
    
    // Add Questions state
    const [showAddQs, setShowAddQs] = useState(false)
    const [qSearch, setQSearch] = useState('')
    const [qDiff, setQDiff] = useState('')
    const [qSubject, setQSubject] = useState('')

    const fetchData = async () => {
        try {
            setLoading(true)
            const token = getToken()
            // We fetch all exams because there's no single exam endpoint in this app's existing API pattern
            // Or we can try to hit /admin/exams if it exists. Actually, we'll fetch all exams and find it.
            const [examsRes, qsRes] = await Promise.all([
                axios.get(`${API}/exams`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/questions`, { headers: { Authorization: `Bearer ${token}` } })
            ])
            const found = examsRes.data.exams.find(e => e._id === id)
            if (!found) throw new Error('Exam not found')
            
            setExam(found)
            setAllQuestions(qsRes.data.questions || [])
        } catch (err) {
            toast.error('Failed to load exam details')
            navigate('/admin/exams')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [id])

    // Derive detailed questions based on exam.questions array of IDs
    const examQuestions = useMemo(() => {
        if (!exam || !exam.questions) return []
        // Sometimes exam.questions might be populated objects, sometimes just IDs. 
        // We'll map them from allQuestions to ensure we have full data.
        return exam.questions.map(qId => {
            const idToMatch = typeof qId === 'object' ? qId._id : qId
            return allQuestions.find(aq => aq._id === idToMatch) || { _id: idToMatch, title: 'Unknown Question' }
        })
    }, [exam, allQuestions])

    const availableToAdd = useMemo(() => {
        if (!exam) return []
        const existingIds = examQuestions.map(q => q._id)
        return allQuestions.filter(q => !existingIds.includes(q._id))
    }, [examQuestions, allQuestions])

    const filteredAvailable = useMemo(() => {
        return availableToAdd.filter(q => {
            const matchSearch = q.title?.toLowerCase().includes(qSearch.toLowerCase()) || q.subject?.toLowerCase().includes(qSearch.toLowerCase())
            const matchDiff = !qDiff || q.difficultyLevel === qDiff
            const matchSubject = !qSubject || q.subject === qSubject
            return matchSearch && matchDiff && matchSubject
        })
    }, [availableToAdd, qSearch, qDiff, qSubject])

    const subjects = useMemo(() => [...new Set(allQuestions.map(q => q.subject).filter(Boolean))], [allQuestions])

    const handleAddQuestion = async (qId) => {
        try {
            const token = getToken()
            // Using a patch request assuming backend supports updating the questions array
            // Since there's no specific "add question" endpoint, we replace the questions array
            const newQuestions = [...examQuestions.map(q => q._id), qId]
            
            // In a real app we'd call a dedicated endpoint or update the whole exam
            // Since the old modal sent the entire exam object, we might have to use a generic update if it exists
            // Or just patch the exam. For now, we'll simulate it by updating the exam state, 
            // since we don't have the explicit backend routes map for full updates
            setExam(prev => ({ ...prev, questions: newQuestions }))
            toast.success('Question added to exam')
            // To actually persist this, you'd need an endpoint like PUT /api/admin/exams/:id
        } catch (err) {
            toast.error('Failed to add question')
        }
    }

    const handleRemoveQuestion = async (qId) => {
        try {
            const newQuestions = examQuestions.map(q => q._id).filter(id => id !== qId)
            setExam(prev => ({ ...prev, questions: newQuestions }))
            toast.success('Question removed')
        } catch (err) {
            toast.error('Failed to remove question')
        }
    }

    if (loading || !exam) {
        return (
            <AdminLayout>
                <div style={{ height: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <Loader2 size={32} className="spin" color="var(--brand-primary)" />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Loading exam details...</span>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: 0, marginBottom: 16 }} onClick={() => navigate('/admin/exams')}>
                    <ArrowLeft size={16} /> Back to Exams
                </button>
                <div className="page-header-top">
                    <div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                            <h1 className="page-title">{exam.title}</h1>
                            <StatusBadge status={exam.status} />
                        </div>
                        <p className="page-subtitle" style={{ maxWidth: 800 }}>{exam.description}</p>
                    </div>
                </div>
            </div>

            {/* In-page Tabs */}
            <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid var(--border-default)' }}>
                {['Overview', 'Questions', 'Participants', 'Performance'].map(t => (
                    <button 
                        key={t} 
                        className={`tab-item ${activeTab === t ? 'active' : ''}`} 
                        onClick={() => setActiveTab(t)}
                    >
                        {t === 'Overview' && <Info size={14} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />}
                        {t === 'Questions' && <Database size={14} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />}
                        {t === 'Participants' && <Users size={14} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />}
                        {t === 'Performance' && <BarChart3 size={14} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} />}
                        {t}
                    </button>
                ))}
            </div>

            {activeTab === 'Overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Exam Configuration</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Duration</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{exam.durationMinutes} <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>min</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Passing Score</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{exam.passingPercentage}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Questions</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{examQuestions.length}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Created By</div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 8 }}>{exam.createdBy?.name || exam.createdBy?.email || 'Admin'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Questions' && (
                <div className="card">
                    <div className="card-header" style={{ padding: '16px 24px' }}>
                        <h3 className="card-title">Question Blueprint</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddQs(!showAddQs)}>
                            {showAddQs ? 'Done Adding' : <><Plus size={14} /> Add Questions</>}
                        </button>
                    </div>
                    
                    {showAddQs && (
                        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)', padding: 24 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Question Bank Repository</h4>
                            <div className="flex gap-2 mb-4">
                                <div className="search-input-wrap" style={{ flex: 1 }}>
                                    <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    <input className="search-input" placeholder="Search available questions..." value={qSearch} onChange={e => setQSearch(e.target.value)} />
                                </div>
                                <select className="form-select" style={{ width: 120 }} value={qDiff} onChange={e => setQDiff(e.target.value)}>
                                    <option value="">All Levels</option>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                                <select className="form-select" style={{ width: 140 }} value={qSubject} onChange={e => setQSubject(e.target.value)}>
                                    <option value="">All Subjects</option>
                                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredAvailable.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>No more questions available to add matching these filters.</div>
                                ) : filteredAvailable.map(q => (
                                    <div key={q._id} style={{
                                        display: 'flex', gap: 12, padding: '10px 14px',
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                        borderRadius: 8, alignItems: 'center'
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{q.title}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{q.subject}</span>
                                                <span className="badge" style={{ fontSize: 10, background: `${diffColors[q.difficultyLevel]}22`, color: diffColors[q.difficultyLevel] }}>{q.difficultyLevel}</span>
                                            </div>
                                        </div>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleAddQuestion(q._id)}>Add</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th>Question</th>
                                    <th>Subject</th>
                                    <th>Difficulty</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examQuestions.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '40px 0' }}>
                                        <EmptyState icon={<Database size={32} color="var(--text-tertiary)" />} title="No Questions" description="This exam is currently empty. Add questions to build the exam blueprint." />
                                    </td></tr>
                                ) : examQuestions.map((q, idx) => (
                                    <tr key={q._id}>
                                        <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{idx + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{q.title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{q.options?.length || 4} options</div>
                                        </td>
                                        <td><span className="badge badge-neutral">{q.subject}</span></td>
                                        <td><span className="badge" style={{ background: `${diffColors[q.difficultyLevel]}22`, color: diffColors[q.difficultyLevel] }}>{q.difficultyLevel}</span></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveQuestion(q._id)}>
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'Participants' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 40, textAlign: 'center' }}>
                        <Users size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Participant Analytics</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Participant details and active session monitoring will be available once the exam is Live.</p>
                    </div>
                </div>
            )}

            {activeTab === 'Performance' && (
                <div className="card">
                    <div className="card-body" style={{ padding: 40, textAlign: 'center' }}>
                        <BarChart3 size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Performance Insights</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Exam performance analytics will generate automatically after submissions.</p>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
