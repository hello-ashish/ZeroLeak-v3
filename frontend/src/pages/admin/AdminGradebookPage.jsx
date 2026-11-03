import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { Modal } from '../../components/Modal.jsx'
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx'
import { ScorePill } from '../../components/StatusBadge.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Download, BarChart3, TrendingUp, Trophy, Search, ChevronRight, GraduationCap, Trash2, CheckSquare } from 'lucide-react'
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const CHART_COLORS = {
    primary: 'var(--brand-primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
}

function getGrade(pct) {
    if (pct >= 90) return 'A+'
    if (pct >= 80) return 'A'
    if (pct >= 70) return 'B'
    if (pct >= 60) return 'C'
    if (pct >= 50) return 'D'
    return 'F'
}

const generateCSVData = (data) => {
    const headers = ['Rank', 'Student', 'Student ID', 'Exam', 'Score', 'Total', 'Percentage', 'Grade', 'Date']
    const rows = data.map((r, i) => {
        const total = Math.max(1, r.totalQuestions || 0)
        const validScore = Math.max(0, Math.min(r.score || 0, total))
        const pct = Math.min(100, Math.max(0, Math.round((validScore / total) * 100)))
        return [i + 1, r.student?.name || 'Unknown', r.student?.studentId || '', r.exam?.title || '', r.score, r.totalQuestions, `${pct}%`, getGrade(pct), new Date(r.createdAt).toLocaleDateString()]
    })
    const content = [headers, ...rows].map(r => r.join(',')).join('\n')
    return { headers, rows, content }
}

export default function AdminGradebookPage() {
    const [results, setResults] = useState([])
    const [exams, setExams] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedExam, setSelectedExam] = useState('all')
    const [searchParams] = useSearchParams()
    const [search, setSearch] = useState(searchParams.get('student') || '')
    const [sortDir, setSortDir] = useState('desc')
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 10
    const [previewModal, setPreviewModal] = useState({ isOpen: false, title: '', content: '', headers: [], rows: [], filename: '' })
    const [selectedRows, setSelectedRows] = useState(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [selectionMode, setSelectionMode] = useState(false)
    const [expandedStudents, setExpandedStudents] = useState(new Set())
    const [selectedProfile, setSelectedProfile] = useState(null)
    const navigate = useNavigate()
    const toast = useToast()

    const toggleStudentExpand = (studentId) => {
        const newSet = new Set(expandedStudents);
        if (newSet.has(studentId)) newSet.delete(studentId);
        else newSet.add(studentId);
        setExpandedStudents(newSet);
    };

    const handleDownload = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setPreviewModal({ ...previewModal, isOpen: false });
    };

    const handleDeleteSelected = async () => {
        if (selectedRows.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedRows.size} result(s)?`)) return;

        const token = getToken();
        if (!token) return;

        setIsDeleting(true);
        try {
            await axios.post(`${API}/exams/results/bulk-delete`, {
                resultIds: Array.from(selectedRows)
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(`Successfully deleted ${selectedRows.size} results`);
            setSelectedRows(new Set());
            setSelectionMode(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to delete results');
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(new Set(filtered.map(r => r._id)));
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleSelectRow = (id) => {
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRows(newSet);
    };

    const fetchData = React.useCallback(async () => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }

        try {
            setLoading(true)
            const [resRes, examRes] = await Promise.all([
                axios.get(`${API}/exams/results`, { headers: { Authorization: `Bearer ${token}` }, params: { limit: 10000 } }),
                axios.get(`${API}/exams`, { headers: { Authorization: `Bearer ${token}` } }),
            ])
            setResults(resRes.data.results || [])
            setExams(examRes.data.exams || [])
        } catch {
            toast.error('Failed to load gradebook')
        } finally {
            setLoading(false)
        }
    }, [navigate, toast])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const [aiCohortResult, setAiCohortResult] = useState(null)
    const [aiCohortGenerating, setAiCohortGenerating] = useState(false)

    const doAiCohortReport = async () => {
        if (!results.length) return;
        setAiCohortGenerating(true);
        setAiCohortResult(null);
        try {
            const token = getToken();
            const simplifiedData = results.slice(0, 100).map(r => ({
                studentName: r.student?.name || 'Unknown',
                examTitle: r.exam?.title || 'Unknown Exam',
                score: r.score,
                totalQuestions: r.totalQuestions,
                status: r.status
            }));
            const res = await axios.post(`${API}/ai/admin/cohort-report`, { gradebookData: simplifiedData }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAiCohortResult(res.data);
            toast.success("AI Cohort Report generated");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to generate AI report");
        } finally {
            setAiCohortGenerating(false);
        }
    }

    const handleDownloadPDF = async () => {
        const element = document.getElementById('ai-cohort-report')
        if (!element) return
        
        try {
            const canvas = await html2canvas(element, { scale: 2 })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save('AI_Cohort_Report.pdf')
            toast.success('PDF downloaded successfully')
        } catch (error) {
            toast.error('Failed to generate PDF')
        }
    }

    const filtered = useMemo(() => {
        let data = results
        if (selectedExam === 'deleted') {
            data = data.filter(r => !r.exam)
        } else if (selectedExam !== 'all') {
            data = data.filter(r => r.exam?._id === selectedExam || r.exam === selectedExam)
        }
        
        if (search) {
            const s = search.toLowerCase()
            data = data.filter(r => r.student?.name?.toLowerCase().includes(s) || r.student?.studentId?.toLowerCase().includes(s))
        }
        
        return [...data].sort((a, b) => {
            const titleA = a.exam?.title || 'Deleted Exam'
            const titleB = b.exam?.title || 'Deleted Exam'
            
            if (titleA < titleB) return -1
            if (titleA > titleB) return 1
            
            const pa = a.totalQuestions > 0 ? Math.min(1, Math.max(0, a.score / a.totalQuestions)) : 0
            const pb = b.totalQuestions > 0 ? Math.min(1, Math.max(0, b.score / b.totalQuestions)) : 0
            return sortDir === 'desc' ? pb - pa : pa - pb
        })
    }, [results, selectedExam, search, sortDir])

    const groupedStudents = useMemo(() => {
        const groups = {};
        filtered.forEach(r => {
            const sid = r.student?._id || 'unknown';
            if (!groups[sid]) {
                groups[sid] = {
                    student: r.student,
                    results: [],
                    totalScore: 0,
                    totalQuestions: 0
                }
            }
            groups[sid].results.push(r);
            groups[sid].totalScore += r.score;
            groups[sid].totalQuestions += r.totalQuestions;
        });

        return Object.values(groups).sort((a, b) => {
            const pa = a.totalQuestions > 0 ? Math.min(1, Math.max(0, a.totalScore / a.totalQuestions)) : 0;
            const pb = b.totalQuestions > 0 ? Math.min(1, Math.max(0, b.totalScore / b.totalQuestions)) : 0;
            return sortDir === 'desc' ? pb - pa : pa - pb;
        });
    }, [filtered, sortDir])

    useEffect(() => {
        setPage(1)
    }, [selectedExam, search, sortDir])

    const totalPages = Math.max(1, Math.ceil(groupedStudents.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return groupedStudents.slice(start, start + ITEMS_PER_PAGE)
    }, [groupedStudents, currentPage])

    const hasOrphaned = useMemo(() => results.some(r => !r.exam), [results])

    const classSummary = useMemo(() => {
        if (filtered.length === 0) return null
        const pcts = filtered.map(r => {
            const total = Math.max(1, r.totalQuestions || 0)
            const score = Math.max(0, Math.min(r.score || 0, total))
            return Math.min(100, Math.max(0, (score / total) * 100))
        })
        
        // Distribution buckets
        const dist = [
            { range: '<50', count: pcts.filter(p => p < 50).length },
            { range: '50-69', count: pcts.filter(p => p >= 50 && p < 70).length },
            { range: '70-89', count: pcts.filter(p => p >= 70 && p < 90).length },
            { range: '90-100', count: pcts.filter(p => p >= 90).length },
        ]

        return {
            avg: Math.min(100, Math.max(0, Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length))),
            highest: Math.min(100, Math.max(0, Math.round(Math.max(...pcts)))),
            lowest: Math.min(100, Math.max(0, Math.round(Math.min(...pcts)))),
            passRate: Math.min(100, Math.max(0, Math.round((pcts.filter(p => p >= 50).length / pcts.length) * 100))),
            total: pcts.length,
            dist
        }
    }, [filtered])

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Gradebook</h1>
                        <p className="page-subtitle">Academic performance records and aggregate analytics</p>
                    </div>
                    <div className="page-actions" style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary flex items-center gap-2" onClick={doAiCohortReport} disabled={aiCohortGenerating} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none' }}>
                            {aiCohortGenerating ? 'Generating...' : 'AI Cohort Report'}
                        </button>
                        <button className="btn btn-secondary flex items-center gap-2" onClick={() => {
                            const { headers, rows, content } = generateCSVData(filtered);
                            setPreviewModal({ isOpen: true, title: 'Gradebook Export Preview', content, headers, rows, filename: 'gradebook.csv' });
                        }} disabled={!results.length}>
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {aiCohortResult && (
                <div id="ai-cohort-report" style={{ marginBottom: 32, padding: '24px 32px', background: 'var(--bg-card)', border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>AI Cohort Report</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Automated insights into class performance</p>
                        </div>
                        <div style={{ marginLeft: 'auto' }} data-html2canvas-ignore="true">
                            <button className="btn btn-secondary flex items-center gap-2" onClick={handleDownloadPDF} style={{ padding: '6px 12px', fontSize: 13 }}>
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 20 }}>
                        {aiCohortResult.cohortAnalysis}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {aiCohortResult.atRiskStudents?.length > 0 && (
                            <div style={{ background: 'var(--danger-subtle)', padding: '16px', borderRadius: 8, border: '1px solid var(--danger-border)' }}>
                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 8 }}>At-Risk Students</h4>
                                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--danger)', fontSize: 13 }}>
                                    {aiCohortResult.atRiskStudents.map((student, idx) => (
                                        <li key={idx} style={{ marginBottom: 4 }}>{student}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        {aiCohortResult.recommendedActions?.length > 0 && (
                            <div style={{ background: 'var(--success-subtle)', padding: '16px', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 8 }}>Recommended Actions</h4>
                                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--success)', fontSize: 13 }}>
                                    {aiCohortResult.recommendedActions.map((action, idx) => (
                                        <li key={idx} style={{ marginBottom: 4 }}>{action}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Class Summary & Distribution */}
            {classSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                    {/* Performance KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="kpi-module" style={{ padding: 20 }}>
                            <p className="kpi-module-title">Class Average</p>
                            <p className="kpi-module-value">{classSummary.avg}%</p>
                            <p className="kpi-module-sub" style={{ color: classSummary.avg >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                                {classSummary.avg >= 70 ? 'Above benchmark' : 'Below benchmark'}
                            </p>
                        </div>
                        <div className="kpi-module" style={{ padding: 20 }}>
                            <p className="kpi-module-title">Pass Rate</p>
                            <p className="kpi-module-value">{classSummary.passRate}%</p>
                            <p className="kpi-module-sub" style={{ color: classSummary.passRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                                {classSummary.total} total submissions
                            </p>
                        </div>
                        <div className="kpi-module" style={{ padding: 20, gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p className="kpi-module-title">Highest Score</p>
                                <p className="kpi-module-value" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {classSummary.highest}% <Trophy size={24} color="var(--brand-accent)" />
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p className="kpi-module-title">Lowest Score</p>
                                <p className="kpi-module-value" style={{ fontSize: 24 }}>{classSummary.lowest}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Distribution Chart */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Score Distribution</h3>
                        </div>
                        <div className="card-body" style={{ height: 260, paddingBottom: 24 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={classSummary.dist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip 
                                        cursor={{ fill: 'var(--bg-body)' }}
                                        contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-md)' }}
                                        itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    />
                                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                                        {classSummary.dist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 3 ? CHART_COLORS.success : index === 0 ? CHART_COLORS.danger : CHART_COLORS.primary} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap" style={{ alignItems: 'center' }}>
                <select className="form-select" style={{ width: 240 }} value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                    <option value="all">All Exams</option>
                    {exams.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
                    {hasOrphaned && <option value="deleted">Deleted Exams</option>}
                </select>
                <div className="search-input-wrap" style={{ flex: 1, maxWidth: 300 }}>
                    <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <input className="search-input" placeholder="Search by student or ID..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                    {sortDir === 'desc' ? '↓ Highest first' : '↑ Lowest first'}
                </button>
                <button 
                    className="btn btn-secondary flex items-center gap-2" 
                    style={{ padding: '6px 12px', fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                    onClick={() => {
                        setSelectionMode(!selectionMode)
                        if (selectionMode) setSelectedRows(new Set())
                    }}
                >
                    <CheckSquare size={14} /> {selectionMode ? 'Cancel' : 'Select'}
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedRows.size > 0 && (
                        <button 
                            className="btn btn-danger btn-sm flex items-center gap-2" 
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                        >
                            <Trash2 size={14} /> Delete Selected ({selectedRows.size})
                        </button>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} submissions</span>
                </div>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            {selectionMode && (
                                <th style={{ width: 40, paddingLeft: 16 }}>
                                    <input 
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={filtered.length > 0 && selectedRows.size === filtered.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                            )}
                            <th style={{ width: 40 }}></th>
                            <th>Student</th>
                            <th>Exams Taken</th>
                            <th>Average Score</th>
                            <th>Average Percentage</th>
                            <th>Average Grade</th>
                            <th style={{ textAlign: 'right' }}>Profile</th>
                        </tr>
                    </thead>
                    {loading ? (
                        <tbody>
                            {[...Array(7)].map((_, i) => (
                                <tr key={i}><td colSpan={selectionMode ? 8 : 7} style={{ padding: 12 }}><div className="skeleton" style={{ height: 14 }} /></td></tr>
                            ))}
                        </tbody>
                    ) : (
                        <tbody>
                            {groupedStudents.length === 0 ? (
                                <tr><td colSpan={selectionMode ? 8 : 7}>
                                    <EmptyState
                                        icon={<BarChart3 size={32} color="var(--text-tertiary)" />}
                                        title="No results found"
                                        description={search || selectedExam !== 'all' ? 'Try a different search or filter.' : 'No exam submissions yet. Results will appear here as students complete exams.'}
                                    />
                                </td></tr>
                            ) : paginatedStudents.map((group, i) => {
                                const avgPct = Math.min(100, Math.max(0, Math.round((group.totalScore / Math.max(1, group.totalQuestions)) * 100)))
                                const avgGrade = getGrade(avgPct)
                                const isExpanded = expandedStudents.has(group.student?._id || 'unknown')

                                return (
                                    <React.Fragment key={group.student?._id || `unknown-${i}`}>
                                        <tr style={{ background: isExpanded ? 'var(--bg-active)' : 'transparent', cursor: 'pointer' }} onClick={() => toggleStudentExpand(group.student?._id || 'unknown')}>
                                            {selectionMode && <td onClick={e => e.stopPropagation()}></td>}
                                            <td style={{ color: 'var(--text-tertiary)' }}>
                                                <ChevronRight size={16} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="avatar avatar-sm" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                                        <GraduationCap size={16} />
                                                    </div>
                                                    <div>
                                                        <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{group.student?.name || 'Unknown'}</p>
                                                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{group.student?.studentId || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                {group.results.length} exam(s)
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                                                {group.totalScore} / {group.totalQuestions}
                                            </td>
                                            <td><ScorePill score={group.totalScore} total={group.totalQuestions} /></td>
                                            <td>
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                                                    color: avgPct >= 70 ? 'var(--success)' : avgPct >= 50 ? 'var(--warning)' : 'var(--danger)'
                                                }}>{avgGrade}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                <button className="btn btn-sm btn-ghost" onClick={() => setSelectedProfile(group)}>
                                                    Profile <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                        {isExpanded && group.results.map(r => {
                                            const total = Math.max(1, r.totalQuestions || 0)
                                            const validScore = Math.max(0, Math.min(r.score || 0, total))
                                            const pct = Math.min(100, Math.max(0, Math.round((validScore / total) * 100)))
                                            return (
                                                <tr key={r._id} style={{ background: 'var(--bg-elevated)' }}>
                                                    {selectionMode && (
                                                        <td style={{ paddingLeft: 16 }}>
                                                            <input type="checkbox" className="form-checkbox" checked={selectedRows.has(r._id)} onChange={() => handleSelectRow(r._id)} />
                                                        </td>
                                                    )}
                                                    <td></td>
                                                    <td style={{ paddingLeft: 32, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        ↳ {r.exam?.title || 'Deleted Exam'}
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                        {new Date(r.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                                        {r.score} / {r.totalQuestions}
                                                    </td>
                                                    <td><ScorePill score={r.score} total={r.totalQuestions} /></td>
                                                    <td>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                            {getGrade(pct)}
                                                        </span>
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            )
                                        })}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    )}
                </table>

                <Pagination
                    currentPage={currentPage}
                    totalItems={groupedStudents.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setPage}
                    itemLabel="students"
                />
            </div>
            <Modal open={previewModal.isOpen} onClose={() => setPreviewModal({ ...previewModal, isOpen: false })} title={previewModal.title} size="full">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{
                        background: 'var(--bg-body)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        maxHeight: '400px',
                        overflow: 'auto',
                    }}>
                        <table className="table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {previewModal.headers?.map((h, i) => (
                                        <th key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewModal.rows?.length > 0 ? previewModal.rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => (
                                            <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>{cell}</td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={previewModal.headers?.length || 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No data</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                        <button className="btn btn-ghost" onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}>Cancel</button>
                        <button className="btn btn-primary flex items-center gap-2" onClick={() => handleDownload(previewModal.content, previewModal.filename)}>
                            <Download size={16} /> Download CSV
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={!!selectedProfile} onClose={() => setSelectedProfile(null)} title="Student Profile" size="md">
                {selectedProfile && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className="avatar avatar-lg" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <GraduationCap size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedProfile.student?.name || 'Unknown'}</h3>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>ID: {selectedProfile.student?.studentId || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Exams</p>
                                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedProfile.results.length}</p>
                            </div>
                            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Avg Score</p>
                                <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-primary)', margin: 0 }}>
                                    {Math.min(100, Math.max(0, Math.round((selectedProfile.totalScore / Math.max(1, selectedProfile.totalQuestions)) * 100)))}%
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Exam History</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                                {selectedProfile.results.map(r => {
                                    const total = Math.max(1, r.totalQuestions || 0);
                                    const validScore = Math.max(0, Math.min(r.score || 0, total));
                                    const pct = Math.min(100, Math.max(0, Math.round((validScore / total) * 100)));
                                    return (
                                        <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
                                            <div>
                                                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{r.exam?.title || 'Deleted Exam'}</p>
                                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>{new Date(r.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{r.score} / {r.totalQuestions}</span>
                                                <span style={{
                                                    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                                                    color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
                                                }}>{getGrade(pct)}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </AdminLayout>
    )
}
