import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { SkeletonCard, SkeletonTable } from '../../components/SkeletonLoader.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import {
    AlertTriangle, TrendingUp, TrendingDown, Users,
    BookOpen, CheckCircle2, AlertCircle, Activity,
    Clock, Plus, FileText, ChevronRight, Zap, BarChart3,
    PackageOpen
} from 'lucide-react'
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    Tooltip, CartesianGrid, BarChart, Bar, Cell
} from 'recharts'
import { format, subDays } from 'date-fns'
import { getCachedData } from '../../utils/apiCache.js'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const CHART_COLORS = {
    primary: 'var(--brand-primary)',
    secondary: 'var(--brand-accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    muted: 'var(--border-strong)'
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState(() => getCachedData(`${API}/admin/stats`))
    const [loading, setLoading] = useState(() => !getCachedData(`${API}/admin/stats`))
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        const fetchStats = async () => {
            const token = getToken()
            if (!token) {
                navigate('/admin/login')
                return
            }
            try {
                const res = await axios.get(`${API}/admin/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setStats(res.data)
                setLoading(false)
            } catch (err) {
                console.error(err)
                if (err.response?.status === 401) {
                    localStorage.removeItem('adminToken')
                    localStorage.removeItem('adminData')
                    navigate('/admin/login')
                } else {
                    setError('Failed to load command center analytics.')
                    setLoading(false)
                }
            }
        }
        fetchStats()
    }, [])

    const s = stats?.stats || {}
    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}')
    const adminName = adminData.name || (adminData.email || 'Admin').split('@')[0]

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 17) return 'Good afternoon'
        return 'Good evening'
    }

    const performanceData = (stats?.performanceData || []).map(d => ({
        ...d,
        date: format(new Date(d.date), 'MMM dd')
    }))

    const scoreDistData = [
        { range: '<50', count: s.scoreDistribution?.below50 || 0 },
        { range: '50-69', count: s.scoreDistribution?.fiftyToSixtyNine || 0 },
        { range: '70-89', count: s.scoreDistribution?.seventyToEightyNine || 0 },
        { range: '90-100', count: s.scoreDistribution?.above90 || 0 }
    ]

    return (
        <AdminLayout pendingBatchCount={s.pendingBatches || 0}>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 32 }}>
                <div className="page-header-top">
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Academic Intelligence
                        </p>
                        <h1 className="page-title" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                            {getGreeting()}, {adminName}
                        </h1>
                        <p className="page-subtitle" style={{ fontSize: 14 }}>
                            Here is what's happening across the ZeroLeak platform today.
                        </p>
                    </div>
                    <div className="page-actions">
                        <button className="btn btn-primary" onClick={() => navigate('/admin/exams')}>
                            <Plus size={16} /> New Exam
                        </button>
                    </div>
                </div>
            </div>

            {/* System Status Strip */}
            <div className="status-strip">
                <div className="status-strip-item" style={{ flex: 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 3px var(--success-subtle)' }} />
                    <span>All systems operational</span>
                </div>
                <div className="status-strip-item">
                    <Activity size={16} />
                    <span><strong>{s.exams || 0}</strong> active exams</span>
                </div>
                <div className="status-strip-item">
                    <Users size={16} />
                    <span><strong>{s.students?.toLocaleString() || 0}</strong> students</span>
                </div>
                <div className="status-strip-item">
                    <BookOpen size={16} />
                    <span><strong>{s.professors || 0}</strong> professors</span>
                </div>
            </div>

            {loading ? (
                <div className="kpi-showcase">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : (
                <>
                    {/* Attention Center (Only show if action needed) */}
                    {(s.pendingBatches > 0 || stats?.atRiskStudents?.length > 0) && (
                        <div className="attention-center" style={{ marginBottom: 32 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                <AlertTriangle size={24} color="var(--warning)" />
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Attention Required</h2>
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                                {s.pendingBatches > 0 && (
                                    <div className="insight-card" style={{ background: 'var(--bg-card)' }}>
                                        <div className="insight-icon" style={{ background: 'var(--warning-subtle)', color: 'var(--warning)' }}>
                                            <PackageOpen size={18} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Batch Reviews Pending</p>
                                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                                        {s.pendingBatches} question batch{s.pendingBatches !== 1 ? 'es' : ''} awaiting approval from faculty.
                                                    </p>
                                                </div>
                                                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/admin/batches')}>
                                                    Review Now <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {stats?.atRiskStudents?.length > 0 && (
                                    <div className="insight-card" style={{ background: 'var(--bg-card)' }}>
                                        <div className="insight-icon" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
                                            <AlertCircle size={18} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Students At Risk</p>
                                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                                        {stats.atRiskStudents.length} student{stats.atRiskStudents.length !== 1 ? 's' : ''} showing a performance average below 50%.
                                                    </p>
                                                </div>
                                                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/admin/students')}>
                                                    Investigate <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* KPI Modules */}
                    <div className="kpi-showcase">
                        <div className="kpi-module">
                            <p className="kpi-module-title">Students</p>
                            <p className="kpi-module-value">{s.students?.toLocaleString() || 0}</p>
                            <p className="kpi-module-sub" style={{ color: (s.students > 0 && s.studentsLastMonth > 0) ? 'var(--success)' : 'var(--text-secondary)' }}>
                                <TrendingUp size={16} /> <span>{s.studentsLastMonth ? `+${(((s.students - s.studentsLastMonth) / s.studentsLastMonth) * 100).toFixed(1)}%` : '+100%'} vs last month</span>
                            </p>
                        </div>
                        <div className="kpi-module">
                            <p className="kpi-module-title">Exam Activity</p>
                            <p className="kpi-module-value">{s.exams || 0}</p>
                            <p className="kpi-module-sub" style={{ color: 'var(--text-secondary)' }}>
                                <Clock size={16} /> <span>{s.liveExamsCount || 0} live today</span>
                            </p>
                        </div>
                        <div className="kpi-module">
                            <p className="kpi-module-title">Average Performance</p>
                            <p className="kpi-module-value">{s.avgScore || 0}%</p>
                            <p className="kpi-module-sub" style={{ color: s.scoreTrajectory >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {s.scoreTrajectory >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} <span>{s.scoreTrajectory > 0 ? '+' : ''}{s.scoreTrajectory || 0}% trajectory</span>
                            </p>
                        </div>
                        <div className="kpi-module">
                            <p className="kpi-module-title">Completion Rate</p>
                            <p className="kpi-module-value">{s.passRate || 0}%</p>
                            <p className="kpi-module-sub" style={{ color: 'var(--text-secondary)' }}>
                                <CheckCircle2 size={16} /> <span>Across all exams</span>
                            </p>
                        </div>
                    </div>

                    {/* Main Analytics Region */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
                        {/* Interactive Line Chart */}
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px' }}>
                                <div>
                                    <h3 className="card-title" style={{ fontSize: 16 }}>Learner Performance</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>7-day rolling average of exam scores</p>
                                </div>
                            </div>
                            <div className="card-body" style={{ padding: '0 24px 24px 10px', height: 320 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} domain={['auto', 100]} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-md)' }}
                                            itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                            cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area type="monotone" dataKey="score" name="Avg Score (%)" stroke={CHART_COLORS.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS.primary }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Distribution Chart */}
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px' }}>
                                <div>
                                    <h3 className="card-title" style={{ fontSize: 16 }}>Score Distribution</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>From {s.totalResults || 0} recent submissions</p>
                                </div>
                            </div>
                            <div className="card-body" style={{ padding: '0 24px 24px 10px', height: 320 }}>
                                {s.totalResults > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={scoreDistData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                            <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} dy={10} />
                                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--bg-body)' }}
                                                contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-md)' }}
                                                itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                            />
                                            <Bar dataKey="count" name="Submissions" radius={[4, 4, 0, 0]}>
                                                {scoreDistData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 3 ? CHART_COLORS.success : index === 0 ? CHART_COLORS.danger : CHART_COLORS.primary} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                        <BarChart3 size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
                                        <p style={{ fontSize: 14 }}>No submission data yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secondary Row (Recent Exams & Activity) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                        {/* Upcoming / Recent Exams */}
                        <div className="card">
                            <div className="card-header" style={{ padding: '20px 24px' }}>
                                <h3 className="card-title">Live & Upcoming Exams</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/exams')}>View All</button>
                            </div>
                            <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Exam</th>
                                            <th>Questions</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats?.recentExams?.length > 0 ? (
                                            stats.recentExams.slice(0, 5).map(exam => (
                                                <tr key={exam._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/exams')}>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exam.title}</span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{exam.questions?.length || 0}</td>
                                                    <td><StatusBadge status={exam.status || 'Draft'} /></td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px' }}>
                                                <p style={{ color: 'var(--text-tertiary)' }}>No exams configured</p>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Activity Audit */}
                        <div className="card">
                            <div className="card-header" style={{ padding: '20px 24px' }}>
                                <h3 className="card-title">System Audit Log</h3>
                                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/activity')}>View Audit</button>
                            </div>
                            <div style={{ padding: '16px 24px' }}>
                                {stats?.recentLogs?.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {stats.recentLogs.slice(0, 5).map(log => (
                                            <div key={log._id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', marginTop: 6, flexShrink: 0 }} />
                                                <div>
                                                    <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                                                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                                                        {' — '} {log.targetLabel}
                                                    </p>
                                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                        {log.actor} · {format(new Date(log.createdAt), 'h:mm a, MMM d')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '32px', textAlign: 'center' }}>
                                        <p style={{ color: 'var(--text-tertiary)' }}>No activity recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </>
            )}
        </AdminLayout>
    )
}
