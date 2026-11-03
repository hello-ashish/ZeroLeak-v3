import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { ConfirmDialog } from '../../components/Modal.jsx'
import { SkeletonCard, EmptyState } from '../../components/SkeletonLoader.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Search, ClipboardList, Play, Square, Trash2, Plus, ChevronDown, ChevronRight, Check, Calendar } from 'lucide-react'
import { getCachedData } from '../../utils/apiCache.js'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const TABS = ['All', 'Draft', 'Ongoing', 'Completed', 'Archived']

export default function AdminExamsPage() {
    const cached = getCachedData(`${API}/admin/examinations`)
    const [examinations, setExaminations] = useState(() => cached?.examinations || [])
    const [loading, setLoading] = useState(() => !cached)
    const [activeTab, setActiveTab] = useState('All')
    const [search, setSearch] = useState('')
    const [expandedExams, setExpandedExams] = useState({})
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [scheduleSubject, setScheduleSubject] = useState(null)
    const [scheduleData, setScheduleData] = useState({ scheduledAt: '', endsAt: '' })
    const toast = useToast()
    const navigate = useNavigate()

    const fetchData = async () => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (!getCachedData(`${API}/admin/examinations`)) {
                setLoading(true)
            }
            const res = await axios.get(`${API}/admin/examinations`, { headers: { Authorization: `Bearer ${token}` } })
            setExaminations(res.data.examinations || [])
        } catch {
            toast.error('Failed to load examinations')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const filtered = useMemo(() => {
        return examinations
            .filter(e => activeTab === 'All' ? true : (e.status || 'Draft') === activeTab)
            .filter(e => e.title?.toLowerCase().includes(search.toLowerCase()))
    }, [examinations, activeTab, search])

    const tabCounts = useMemo(() => {
        const c = {}
        TABS.forEach(t => {
            c[t] = t === 'All' ? examinations.length : examinations.filter(e => (e.status || 'Draft') === t).length
        })
        return c
    }, [examinations])

    const toggleExpand = (id) => {
        setExpandedExams(p => ({ ...p, [id]: !p[id] }))
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await axios.delete(`${API}/admin/examinations/${deleteTarget._id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Examination deleted')
            setDeleteTarget(null)
            fetchData()
        } catch {
            toast.error('Failed to delete examination')
        } finally {
            setDeleting(false)
        }
    }

    const handleExaminationStatus = async (examId, newStatus) => {
        try {
            await axios.patch(`${API}/admin/examinations/${examId}/status`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setExaminations(prev => prev.map(e => e._id === examId ? { 
                ...e, 
                status: newStatus,
                subjects: e.subjects ? e.subjects.map(subj => ({ ...subj, status: newStatus })) : []
            } : e))
            toast.success(`Examination marked as ${newStatus}`)
        } catch {
            toast.error('Failed to update examination status')
        }
    }

    const handleReleaseResults = async (examId, isReleased) => {
        try {
            await axios.patch(`${API}/admin/examinations/${examId}/release-results`, { isResultReleased: isReleased }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setExaminations(prev => prev.map(e => e._id === examId ? { ...e, isResultReleased: isReleased } : e))
            toast.success(isReleased ? 'Results Released' : 'Results Hidden')
        } catch {
            toast.error('Failed to toggle results')
        }
    }

    const handleSubjectStatus = async (examId, newStatus) => {
        try {
            await axios.patch(`${API}/admin/exams/${examId}/status`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setExaminations(prev => prev.map(e => ({
                ...e,
                subjects: e.subjects ? e.subjects.map(subj => subj._id === examId ? { ...subj, status: newStatus } : subj) : []
            })))
            toast.success(`Subject status updated`)
        } catch {
            toast.error('Failed to update subject status')
        }
    }

    const handleScheduleSubmit = async () => {
        if (!scheduleData.scheduledAt) return toast.error('Start time is required');
        
        try {
            await axios.patch(`${API}/admin/exams/${scheduleSubject._id}/status`, {
                status: 'Scheduled',
                scheduledAt: new Date(scheduleData.scheduledAt).toISOString(),
                endsAt: scheduleData.endsAt ? new Date(scheduleData.endsAt).toISOString() : null
            }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Subject scheduled successfully')
            setScheduleSubject(null)
            setScheduleData({ scheduledAt: '', endsAt: '' })
            fetchData()
        } catch (err) {
            toast.error('Failed to schedule subject')
        }
    }

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Exam Workspace</h1>
                        <p className="page-subtitle">Manage examination lifecycles and analyze outcomes</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => navigate('/admin/exams/create')}>
                        <Plus size={16} /> New Examination
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex gap-3 mb-4 flex-wrap" style={{ alignItems: 'center', borderBottom: '1px solid var(--border-default)' }}>
                        <div className="tabs" style={{ marginBottom: -1 }}>
                            {TABS.map(t => (
                                <button key={t} className={`tab-item ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                                    {t} <span className="tab-count">{tabCounts[t]}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ marginLeft: 'auto', marginBottom: 12 }}>
                            <div className="search-input-wrap" style={{ width: 260 }}>
                                <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                                <input className="search-input" placeholder="Search exams..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {loading ? (
                            <>
                                {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                            </>
                        ) : filtered.length === 0 ? (
                            <EmptyState
                                icon={<ClipboardList size={32} color="var(--text-tertiary)" />}
                                title={`No ${activeTab.toLowerCase()} exams`}
                                description={search ? 'No exams match that search.' : `You don't have any exams in ${activeTab} status.`}
                                action={!search && <button className="btn btn-primary" onClick={() => navigate('/admin/exams/create')}><Plus size={16} /> New Examination</button>}
                            />
                        ) : (
                            filtered.map(examination => {
                                const isExpanded = expandedExams[examination._id];
                                const totalSubjects = examination.subjects?.length || 0;
                                const isComplete = examination.status === 'Completed';

                                return (
                                    <div key={examination._id} className="card" style={{ overflow: 'hidden' }}>
                                        {/* Examination Header Bar */}
                                        <div 
                                            style={{ 
                                                padding: '20px 24px', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                background: isExpanded ? 'var(--bg-active)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                            onClick={() => toggleExpand(examination._id)}
                                        >
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                {isExpanded ? <ChevronDown size={20} color="var(--text-tertiary)" /> : <ChevronRight size={20} color="var(--text-tertiary)" />}
                                                <div>
                                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{examination.title}</h3>
                                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                                                        {totalSubjects} Subjects • Created {new Date(examination.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <StatusBadge status={examination.status} />
                                                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
                                                    {examination.status !== 'Completed' && examination.status !== 'Archived' && (
                                                        <button className="btn btn-sm btn-primary" onClick={() => handleExaminationStatus(examination._id, 'Completed')}>
                                                            <Check size={14} style={{ marginRight: 4 }} /> Complete Examination
                                                        </button>
                                                    )}
                                                    {isComplete && (
                                                        <button 
                                                            className={`btn btn-sm ${examination.isResultReleased ? 'btn-secondary' : 'btn-success'}`}
                                                            onClick={() => handleReleaseResults(examination._id, !examination.isResultReleased)}
                                                        >
                                                            {examination.isResultReleased ? 'Hide Results' : 'Release Results'}
                                                        </button>
                                                    )}
                                                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(examination)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Subjects View */}
                                        {isExpanded && (
                                            <div style={{ padding: '0 24px 24px 60px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                                                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '20px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subjects</h4>
                                                {totalSubjects === 0 ? (
                                                    <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No subjects configured for this examination.</p>
                                                ) : (
                                                    <div style={{ display: 'grid', gap: 12 }}>
                                                        {examination.subjects.map(subj => (
                                                            <div key={subj._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                                                                <div>
                                                                    <p style={{ fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{subj.subject}</p>
                                                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                                                                        {subj.questions?.length || 0} Questions • {subj.durationMinutes} mins
                                                                    </p>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                                    <StatusBadge status={subj.status || 'Draft'} />
                                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                                        {(subj.status === 'Draft' || !subj.status) && (
                                                                            <>
                                                                                <button className="btn btn-sm btn-primary" onClick={() => setScheduleSubject(subj)} title="Schedule Exam">
                                                                                    <Calendar size={14} /> Schedule
                                                                                </button>
                                                                                <button className="btn btn-sm btn-success" onClick={() => handleSubjectStatus(subj._id, 'Live')} title="Start Exam">
                                                                                    <Play size={14} /> Start
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {subj.status === 'Live' && (
                                                                            <button className="btn btn-sm btn-secondary" onClick={() => handleSubjectStatus(subj._id, 'Completed')} title="Complete">
                                                                                <Square size={14} /> Finish
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="Delete Examination"
                message={`Are you sure you want to delete "${deleteTarget?.title}"? This will also delete all its subjects.`}
                confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                danger
            />

            {/* Schedule Subject Modal */}
            {scheduleSubject && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: 400, padding: 24 }}>
                        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Schedule Exam: {scheduleSubject.subject}</h3>
                        
                        <div className="form-group mb-4">
                            <label className="form-label">Start Time *</label>
                            <input 
                                type="datetime-local" 
                                className="form-input" 
                                value={scheduleData.scheduledAt} 
                                onChange={e => setScheduleData({ ...scheduleData, scheduledAt: e.target.value })} 
                            />
                        </div>
                        <div className="form-group mb-4">
                            <label className="form-label">End Time (Optional)</label>
                            <input 
                                type="datetime-local" 
                                className="form-input" 
                                value={scheduleData.endsAt} 
                                onChange={e => setScheduleData({ ...scheduleData, endsAt: e.target.value })} 
                            />
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                If left blank, ends automatically after duration ({scheduleSubject.durationMinutes} mins).
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => { setScheduleSubject(null); setScheduleData({ scheduledAt: '', endsAt: '' }); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleScheduleSubmit}>Schedule</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
