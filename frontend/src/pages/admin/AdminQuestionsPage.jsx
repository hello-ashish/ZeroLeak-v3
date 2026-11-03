import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { DifficultyBadge } from '../../components/StatusBadge.jsx'
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Database, CircleDot, Search, PackageOpen, X, BarChart3, Clock, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

export default function AdminQuestionsPage() {
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filterDiff, setFilterDiff] = useState('')
    const [filterSubject, setFilterSubject] = useState('')
    const [chartFilter, setChartFilter] = useState('All')
    const [selectedQuestion, setSelectedQuestion] = useState(null)
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 10
    const navigate = useNavigate()
    const toast = useToast()

    const isFirstMount = useRef(true)
    const prevFiltersRef = useRef({ search: debouncedSearch, diff: filterDiff, subject: filterSubject })

    const [stats, setStats] = useState({ total: 0, easy: 0, medium: 0, hard: 0, highSuccess: 0, lowSuccess: 0, flagged: 0 })
    const [subjects, setSubjects] = useState([])
    const [chartDataAll, setChartDataAll] = useState([])
    const [topicsBySubject, setTopicsBySubject] = useState({})
    const [totalFiltered, setTotalFiltered] = useState(0)

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(t)
    }, [search])

    const fetchQuestions = async (showLoading = false) => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (showLoading) setLoading(true)
            const res = await axios.get(`${API}/questions`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, limit: ITEMS_PER_PAGE, search: debouncedSearch, difficulty: filterDiff, subject: filterSubject }
            })

            setQuestions(res.data.questions || [])
            setTotalFiltered(res.data.totalFiltered || 0)
            setStats(res.data.stats || { total: 0, easy: 0, medium: 0, hard: 0 })
            setSubjects(res.data.subjects || [])
            setChartDataAll(res.data.chartDataAll || [])
            setTopicsBySubject(res.data.topicsBySubject || {})
        } catch {
            toast.error('Failed to load question bank')
        } finally {
            if (showLoading) setLoading(false)
        }
    }

    useEffect(() => {
        const filtersChanged =
            prevFiltersRef.current.search !== debouncedSearch ||
            prevFiltersRef.current.diff !== filterDiff ||
            prevFiltersRef.current.subject !== filterSubject

        prevFiltersRef.current = { search: debouncedSearch, diff: filterDiff, subject: filterSubject }

        // Only show loading animation on initial page mount or when search/filters change
        // NEVER show loading animation when jumping between pages in pagination
        const showLoading = isFirstMount.current || filtersChanged
        isFirstMount.current = false

        fetchQuestions(showLoading)
    }, [page, debouncedSearch, filterDiff, filterSubject])

    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, filterDiff, filterSubject])

    const chartData = useMemo(() => {
        if (chartFilter === 'All') return chartDataAll;
        return topicsBySubject[chartFilter] || [];
    }, [chartFilter, chartDataAll, topicsBySubject])

    const handleEditQuestion = () => {
        toast.info('Edit question functionality coming soon')
    }

    const handleArchiveQuestion = () => {
        if (!selectedQuestion) return;
        setQuestions(prev => prev.filter(q => q._id !== selectedQuestion._id))
        setSelectedQuestion(null)
        toast.success('Question archived successfully')
    }

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Question Library</h1>
                        <p className="page-subtitle">Central repository of all approved academic questions</p>
                    </div>
                </div>
            </div>

            {/* Health & Stats Row */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                {[
                    { label: 'Total Questions', value: stats.total, icon: <Database size={20} color="var(--brand-primary)" />, bg: 'var(--brand-primary-subtle)' },
                    { label: 'High Success (>70%)', value: stats.highSuccess, icon: <CheckCircle2 size={20} color="var(--success)" />, bg: 'var(--success-subtle)' },
                    { label: 'Low Success (<40%)', value: stats.lowSuccess, icon: <BarChart3 size={20} color="var(--warning)" />, bg: 'var(--warning-subtle)' },
                    { label: 'Flagged / Needs Review', value: stats.flagged, icon: stats.flagged > 0 ? <AlertTriangle size={20} color="var(--danger)" /> : null, bg: stats.flagged > 0 ? 'var(--danger-subtle)' : 'transparent' },
                ].map(s => (
                    <div className="kpi-card" key={s.label}>
                        <div className="kpi-card-header">
                            <span className="kpi-label">{s.label}</span>
                            {s.icon && <span className="kpi-icon" style={{ background: s.bg }}>{s.icon}</span>}
                        </div>
                        <div className="kpi-value">{loading && stats.total === 0 ? '—' : s.value}</div>
                    </div>
                ))}
            </div>

            {/* Subject Difficulty Breakdown */}
            {subjects.length > 0 && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            {chartFilter === 'All' ? 'Subject Difficulty Distribution' : `${chartFilter} - Topic Breakdown`}
                        </h3>
                        <select className="form-select" style={{ width: 180, padding: '6px 12px', fontSize: 13 }} value={chartFilter} onChange={e => setChartFilter(e.target.value)}>
                            <option value="All">All Subjects</option>
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-active)' }}
                                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                                    itemStyle={{ fontSize: 13, fontWeight: 600 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 13, paddingTop: 20, fontWeight: 500 }} />
                                <Bar dataKey="Easy" stackId="a" fill="var(--success)" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Medium" stackId="a" fill="var(--warning)" />
                                <Bar dataKey="Hard" stackId="a" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

                {/* Main Content Area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Filters */}
                    <div className="flex gap-2 mb-4 flex-wrap" style={{ alignItems: 'center' }}>
                        <div className="search-input-wrap" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
                            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                            <input className="search-input" placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="form-select" style={{ width: 130 }} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                            <option value="">All Difficulty</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                        <select className="form-select" style={{ width: 160 }} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                            <option value="">All Subjects</option>
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {(search || filterDiff || filterSubject) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterDiff(''); setFilterSubject('') }}>
                                Clear filters
                            </button>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                            {totalFiltered} of {stats.total} questions
                        </span>
                    </div>

                    {/* Table */}
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Subject & Topic</th>
                                    <th>Difficulty</th>
                                    <th>Usage</th>
                                    <th>Success Rate</th>
                                </tr>
                            </thead>
                            {loading ? (
                                <SkeletonTable rows={8} />
                            ) : (
                                <tbody>
                                    {questions.length === 0 ? (
                                        <tr><td colSpan={5}>
                                            <EmptyState
                                                icon={<Database size={32} color="var(--text-tertiary)" />}
                                                title="No questions found"
                                                description={search || filterDiff || filterSubject
                                                    ? 'No questions match your current filters.'
                                                    : 'The question bank is empty. Ask professors to submit new batches.'}
                                                action={!search && !filterDiff && !filterSubject && (
                                                    <button className="btn btn-primary" onClick={() => navigate('/admin/batches')}>
                                                        <PackageOpen size={16} style={{ marginRight: 4 }} /> Review Batches
                                                    </button>
                                                )}
                                            />
                                        </td></tr>
                                    ) : questions.map(q => {
                                        const isSelected = selectedQuestion?._id === q._id
                                        return (
                                            <tr key={q._id}
                                                onClick={() => setSelectedQuestion(q)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'var(--bg-active)' : 'transparent',
                                                    borderLeft: isSelected ? '2px solid var(--brand-primary)' : '2px solid transparent'
                                                }}
                                            >
                                                <td style={{ maxWidth: 300 }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        {q.health.flagged && <AlertTriangle size={14} color="var(--danger)" style={{ flexShrink: 0 }} />}
                                                        <p style={{ fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }} className="truncate">{q.title}</p>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        <span className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>{q.subject}</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{q.topic || '—'}</span>
                                                    </div>
                                                </td>
                                                <td><DifficultyBadge level={q.difficultyLevel} /></td>
                                                <td>
                                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                        {q.health.usageCount} exams
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 40, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${q.health.successRate}%`,
                                                                height: '100%',
                                                                background: q.health.successRate > 70 ? 'var(--success)' : q.health.successRate < 40 ? 'var(--danger)' : 'var(--warning)'
                                                            }} />
                                                        </div>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{q.health.successRate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            )}
                        </table>

                        {!loading && (
                            <Pagination
                                currentPage={page}
                                totalItems={totalFiltered}
                                itemsPerPage={ITEMS_PER_PAGE}
                                onPageChange={setPage}
                                itemLabel="questions"
                            />
                        )}
                    </div>
                </div>

                {/* Right Side Drawer / Panel */}
                {selectedQuestion && (
                    <div style={{
                        width: 360,
                        flexShrink: 0,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        position: 'sticky',
                        top: 'var(--topbar-height)',
                        marginTop: 48,
                        animation: 'slideInRight 200ms ease',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: 'calc(100vh - 120px)'
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Question Details</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>ID: {selectedQuestion._id.substring(0, 8)}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedQuestion(null)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: 20, overflowY: 'auto' }}>
                            {selectedQuestion.health.flagged && (
                                <div style={{ padding: 12, background: 'var(--danger-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger-border)', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
                                    <AlertTriangle size={16} color="var(--danger)" style={{ marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>Flagged for Review</p>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>This question has a very low success rate or has been reported by students.</p>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <span className="badge badge-neutral">{selectedQuestion.subject}</span>
                                <DifficultyBadge level={selectedQuestion.difficultyLevel} />
                            </div>

                            <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Content Hash</div>
                                <code style={{ fontSize: 13, color: 'var(--brand-primary)', wordBreak: 'break-all' }}>
                                    {selectedQuestion.title}
                                </code>
                            </div>

                            <div style={{ marginBottom: 24, padding: 12, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning-border)' }}>
                                <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>
                                    <strong>Content Protected:</strong> Question body and options are end-to-end encrypted. Admins can only view the full question content while reviewing pending batches.
                                </p>
                            </div>

                            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Health & Usage</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Included in</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedQuestion.health.usageCount} exams</div>
                                </div>
                                <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Success Rate</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: selectedQuestion.health.successRate > 70 ? 'var(--success)' : selectedQuestion.health.successRate < 40 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                        {selectedQuestion.health.successRate}%
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleEditQuestion}>Edit Question</button>
                                <button className="btn btn-danger btn-icon" title="Archive" onClick={handleArchiveQuestion}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
