import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { StatusBadge, DifficultyBadge } from '../../components/StatusBadge.jsx'
import { SkeletonCard, EmptyState } from '../../components/SkeletonLoader.jsx'
import { useToast } from '../../components/Toast.jsx'
import { AlertTriangle, PackageOpen, Check, X, Eye, Clock, MessageSquare, ChevronRight, Trash2, Sparkles, Copy, FileText } from 'lucide-react'
import { getCachedData } from '../../utils/apiCache.js'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const TABS = ['Pending', 'Accepted', 'Rejected', 'Marked', 'All']

export default function AdminBatchesPage() {
    const cachedBatches = getCachedData(`${API}/admin/batches`)
    const [batches, setBatches] = useState(() => cachedBatches?.batches || [])
    const [loading, setLoading] = useState(() => !cachedBatches)
    const [activeTab, setActiveTab] = useState('Pending')
    const [activeBatch, setActiveBatch] = useState(null)
    const [pendingCount, setPendingCount] = useState(() => (cachedBatches?.batches || []).filter(b => b.status === 'Submitted').length)
    const [reviewing, setReviewing] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [markReason, setMarkReason] = useState('')
    const [actionState, setActionState] = useState(null) // 'reject', 'mark', or 'delete'
    const [batchLoading, setBatchLoading] = useState(false)
    const [aiReviewResult, setAiReviewResult] = useState(null)
    const [aiReviewing, setAiReviewing] = useState(false)
    const batchCacheRef = useRef(new Map())

    const navigate = useNavigate()
    const toast = useToast()

    const fetchBatches = async () => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (!getCachedData(`${API}/admin/batches`)) setLoading(true)
            const res = await axios.get(`${API}/admin/batches`, { headers: { Authorization: `Bearer ${token}` } })
            const all = res.data.batches || []
            setBatches(all)
            setPendingCount(all.filter(b => b.status === 'Submitted').length)

            // Auto-select first pending batch if none selected
            if (!activeBatch && all.filter(b => b.status === 'Submitted').length > 0) {
                openBatch(all.filter(b => b.status === 'Submitted')[0])
            }
        } catch {
            toast.error('Failed to load batches')
        } finally {
            setLoading(false)
        }
    }

    const openBatch = async (batch) => {
        if (!batch?._id) return

        // Instant Fast-Path: Use in-memory cache if batch was already fetched
        if (batchCacheRef.current.has(batch._id)) {
            setActiveBatch(batchCacheRef.current.get(batch._id))
            setActionState(null)
            setRejectReason('')
            setMarkReason('')
            setAiReviewResult(null)
            return
        }

        const token = getToken()
        setBatchLoading(true)
        try {
            const res = await axios.get(`${API}/admin/batches/${batch._id}`, { headers: { Authorization: `Bearer ${token}` } })
            const fullBatch = res.data.batch
            batchCacheRef.current.set(batch._id, fullBatch)
            setActiveBatch(fullBatch)
            setActionState(null)
            setRejectReason('')
            setMarkReason('')
            setAiReviewResult(null)
        } catch {
            toast.error('Failed to open batch')
        } finally {
            setBatchLoading(false)
        }
    }

    useEffect(() => { fetchBatches() }, [])

    const filtered = useMemo(() => {
        if (activeTab === 'All') return batches
        if (activeTab === 'Pending') return batches.filter(b => b.status === 'Submitted')
        if (activeTab === 'Accepted') return batches.filter(b => b.status === 'Accepted')
        if (activeTab === 'Rejected') return batches.filter(b => b.status === 'Rejected')
        if (activeTab === 'Marked') return batches.filter(b => b.status === 'MarkForReview')
        return batches
    }, [batches, activeTab])

    const tabCounts = useMemo(() => ({
        Pending: batches.filter(b => b.status === 'Submitted').length,
        Accepted: batches.filter(b => b.status === 'Accepted').length,
        Rejected: batches.filter(b => b.status === 'Rejected').length,
        Marked: batches.filter(b => b.status === 'MarkForReview').length,
        All: batches.length,
    }), [batches])

    const doReview = async (action, adminMessage = '') => {
        setReviewing(true)
        try {
            await axios.post(`${API}/admin/batches/${activeBatch._id}/review`, { action, adminMessage }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            const labels = { Accept: 'approved', Reject: 'rejected', MarkForReview: 'marked for review' }
            toast.success(`Batch ${labels[action]} successfully`)
            batchCacheRef.current.delete(activeBatch._id)
            setActiveBatch(null)
            setActionState(null)
            fetchBatches()
        } catch {
            toast.error('Failed to process batch')
        } finally {
            setReviewing(false)
        }
    }

    const doAiReview = async () => {
        if (!activeBatch) return;
        setAiReviewing(true);
        setAiReviewResult(null);
        try {
            const token = getToken();
            const res = await axios.post(`${API}/ai/admin/review-batch`, { batchData: activeBatch }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data?.data || res.data;
            setAiReviewResult(data);
            toast.success("AI Preview & Audit complete");
        } catch (error) {
            const msg = error.response?.data?.message || error.message || "AI Review failed";
            toast.error(msg);
        } finally {
            setAiReviewing(false);
        }
    }

    const applyAiFeedback = (targetAction = 'mark') => {
        if (!aiReviewResult) return;
        const issuesText = aiReviewResult.issues && aiReviewResult.issues.length > 0
            ? aiReviewResult.issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')
            : 'No critical structural issues flagged.';
        const feedback = `[AI Quality Audit]\nSummary: ${aiReviewResult.summary}\nDifficulty Distribution: ${aiReviewResult.difficultySkew}\n\nIdentified Issues:\n${issuesText}`;

        if (targetAction === 'mark') {
            setMarkReason(feedback);
            setActionState('mark');
        } else if (targetAction === 'reject') {
            setRejectReason(feedback);
            setActionState('reject');
        }
    }

    const handleDeleteBatch = async () => {
        setReviewing(true)
        try {
            await axios.delete(`${API}/admin/batches/${activeBatch._id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Batch deleted successfully')
            batchCacheRef.current.delete(activeBatch._id)
            setActiveBatch(null)
            setActionState(null)
            fetchBatches()
        } catch {
            toast.error('Failed to delete batch')
        } finally {
            setReviewing(false)
        }
    }

    return (
        <AdminLayout pendingBatchCount={pendingCount}>
            <div className="page-header" style={{ marginBottom: 16 }}>
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Batch Review Queue</h1>
                        <p className="page-subtitle">Evaluate submitted question batches for the question bank</p>
                    </div>
                    {pendingCount > 0 && (
                        <div className="alert-box alert-box-warning" style={{ padding: '10px 16px', margin: 0 }}>
                            <AlertTriangle size={16} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{pendingCount} batch{pendingCount !== 1 ? 'es' : ''} awaiting review</span>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 180px)' }}>
                {/* Left Side: Queue List */}
                <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                        <div className="tabs" style={{ marginBottom: 0, width: '100%', display: 'flex' }}>
                            {TABS.map(t => (
                                <button key={t} className={`tab-item ${activeTab === t ? 'active' : ''}`} style={{ flex: 1, padding: '8px 2px', fontSize: 11, textAlign: 'center', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => { setActiveTab(t); setActiveBatch(null); }}>
                                    {t} <span className="tab-count">{tabCounts[t] ?? 0}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        ) : filtered.length === 0 ? (
                            <EmptyState
                                icon={<PackageOpen size={32} color="var(--text-tertiary)" />}
                                title="Queue is empty"
                                description={`No ${activeTab.toLowerCase()} batches.`}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {filtered.map(batch => {
                                    const isSelected = activeBatch?._id === batch._id
                                    return (
                                        <div
                                            key={batch._id}
                                            onClick={() => openBatch(batch)}
                                            style={{
                                                padding: 16,
                                                background: isSelected ? 'var(--bg-active)' : 'var(--bg-surface)',
                                                border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', flex: 1 }} className="truncate">
                                                    {batch.title}
                                                </p>
                                                <ChevronRight size={16} color={isSelected ? 'var(--brand-primary)' : 'var(--text-tertiary)'} />
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                by {batch.createdBy?.name || 'Unknown'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <StatusBadge status={batch.status === 'Submitted' ? 'Pending' : batch.status === 'Accepted' ? 'Live' : batch.status === 'Rejected' ? 'Rejected' : batch.status} />
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{batch.questions?.length || 0} Qs</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Review Interface */}
                <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {batchLoading ? (
                        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>
                    ) : activeBatch ? (
                        <>
                            {/* Header */}
                            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{activeBatch.title}</h2>
                                        <StatusBadge status={activeBatch.status === 'Submitted' ? 'Pending' : activeBatch.status === 'Accepted' ? 'Live' : activeBatch.status === 'Rejected' ? 'Rejected' : activeBatch.status} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <span><strong style={{ color: 'var(--text-primary)' }}>Professor:</strong> {activeBatch.createdBy?.name || 'Unknown'}</span>
                                        <span><strong style={{ color: 'var(--text-primary)' }}>Subject:</strong> {activeBatch.subject}</span>
                                        <span><strong style={{ color: 'var(--text-primary)' }}>Submitted:</strong> {new Date(activeBatch.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>

                                {!actionState && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {/* AI Preview Button available for any active batch with questions */}
                                        <button
                                            className="btn btn-secondary"
                                            onClick={doAiReview}
                                            disabled={aiReviewing}
                                            style={{
                                                background: 'linear-gradient(135deg, var(--brand-primary), #6366f1)',
                                                color: '#fff',
                                                border: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}
                                            title="Run AI Pre-Review to inspect question quality, difficulty skew, and batch integrity"
                                        >
                                            <Sparkles size={16} />
                                            {aiReviewing ? 'Analyzing Batch...' : 'AI Preview & Audit'}
                                        </button>

                                        {activeBatch.status === 'Submitted' && (
                                            <>
                                                <button className="btn btn-secondary" onClick={() => setActionState('mark')}>Mark for Review</button>
                                                <button className="btn btn-danger" onClick={() => setActionState('reject')}>Reject</button>
                                                <button className="btn btn-success" onClick={() => doReview('Accept')} disabled={reviewing}>
                                                    <Check size={16} /> Approve
                                                </button>
                                            </>
                                        )}
                                        <button className="btn btn-danger" onClick={() => setActionState('delete')}>
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* AI Review In Progress Banner */}
                            {aiReviewing && (
                                <div style={{ padding: '18px 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-primary-subtle, rgba(99, 102, 241, 0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                                        <Sparkles size={18} className="animate-spin" />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>AI Audit & Pre-Review in Progress</h4>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Analyzing question distribution, topics covered, difficulty balance, and integrity rules...</p>
                                    </div>
                                </div>
                            )}

                            {/* AI Review Results */}
                            {aiReviewResult && (
                                <div style={{ padding: '24px 32px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: aiReviewResult.isApproved ? 'var(--success-subtle)' : 'var(--danger-subtle)', color: aiReviewResult.isApproved ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {aiReviewResult.isApproved ? <Check size={20} /> : <AlertTriangle size={20} />}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AI Audit Report</h3>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: 4,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        background: aiReviewResult.isApproved ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                                                        color: aiReviewResult.isApproved ? 'var(--success)' : 'var(--danger)',
                                                        border: `1px solid ${aiReviewResult.isApproved ? 'var(--success-border)' : 'var(--danger-border)'}`
                                                    }}>
                                                        {aiReviewResult.isApproved ? 'Recommended: Approve' : 'Recommended: Revisions Needed'}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{aiReviewResult.summary}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setAiReviewResult(null)}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                                            title="Close AI Report"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                                        <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Difficulty Balance</div>
                                            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{aiReviewResult.difficultySkew}</div>
                                        </div>
                                        
                                        {aiReviewResult.issues && aiReviewResult.issues.length > 0 ? (
                                            <div style={{ background: 'var(--danger-subtle)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--danger-border)' }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <AlertTriangle size={14} /> Identified Issues ({aiReviewResult.issues.length})
                                                </div>
                                                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--danger)', fontSize: 13 }}>
                                                    {aiReviewResult.issues.map((issue, idx) => (
                                                        <li key={idx} style={{ marginBottom: 4 }}>{issue}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <div style={{ background: 'var(--success-subtle)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, fontWeight: 500 }}>
                                                <Check size={16} /> No structural or balance defects detected. Batch is ready for approval.
                                            </div>
                                        )}

                                        {/* Action helpers to apply AI feedback into review workflows */}
                                        {activeBatch.status === 'Submitted' && (
                                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                <button
                                                    className="btn btn-sm btn-secondary flex items-center gap-1"
                                                    onClick={() => applyAiFeedback('mark')}
                                                    style={{ fontSize: 12 }}
                                                >
                                                    <FileText size={14} /> Copy AI Report to 'Mark for Review'
                                                </button>
                                                {!aiReviewResult.isApproved && (
                                                    <button
                                                        className="btn btn-sm btn-ghost flex items-center gap-1"
                                                        onClick={() => applyAiFeedback('reject')}
                                                        style={{ fontSize: 12, color: 'var(--danger)' }}
                                                    >
                                                        <FileText size={14} /> Copy to 'Reject'
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Action Form Overlays */}
                            {actionState === 'reject' && (
                                <div style={{ padding: '16px 32px', background: 'var(--danger-subtle)', borderBottom: '1px solid var(--danger-border)' }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>Reject Batch</h4>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Provide a reason for rejection. This will be sent to the professor.</p>
                                    <textarea className="form-textarea" style={{ marginBottom: 12, background: 'var(--bg-surface)' }} placeholder="e.g. Questions are too ambiguous, please revise..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-sm btn-danger" onClick={() => doReview('Reject', rejectReason)} disabled={reviewing || !rejectReason.trim()}>Confirm Rejection</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setActionState(null)}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {actionState === 'mark' && (
                                <div style={{ padding: '16px 32px', background: 'var(--warning-subtle)', borderBottom: '1px solid var(--warning-border)' }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>Mark for Review</h4>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Provide feedback for the professor to revise before resubmitting.</p>
                                    <textarea className="form-textarea" style={{ marginBottom: 12, background: 'var(--bg-surface)' }} placeholder="e.g. Please check formatting on Q3..." value={markReason} onChange={e => setMarkReason(e.target.value)} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#fff', border: 'none' }} onClick={() => doReview('MarkForReview', markReason)} disabled={reviewing}>Send Feedback</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setActionState(null)}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {actionState === 'delete' && (
                                <div style={{ padding: '16px 32px', background: 'var(--danger-subtle)', borderBottom: '1px solid var(--danger-border)' }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>Delete Batch</h4>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Are you sure you want to permanently delete this batch and all its questions? This action cannot be undone.</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-sm btn-danger" onClick={handleDeleteBatch} disabled={reviewing}>Yes, Delete Batch</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setActionState(null)}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Question List */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: 'var(--bg-surface)' }}>
                                {activeBatch.adminMessage && (
                                    <div style={{ background: 'var(--info-subtle)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
                                        <MessageSquare size={20} color="var(--info)" style={{ flexShrink: 0 }} />
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--info)' }}>Feedback Provided</p>
                                            <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{activeBatch.adminMessage}</p>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Questions ({activeBatch.questions?.length})</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {activeBatch.questions?.map((q, i) => (
                                        <div key={i} style={{ padding: 20, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                    {i + 1}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                                        <DifficultyBadge level={q.difficultyLevel} />
                                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{q.topic || 'No topic'}</span>
                                                    </div>
                                                    {activeBatch.status === 'Accepted' ? (
                                                        <>
                                                            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Content Hash</div>
                                                                <code style={{ fontSize: 13, color: 'var(--brand-primary)', wordBreak: 'break-all' }}>
                                                                    {q.title}
                                                                </code>
                                                            </div>
                                                            <div style={{ padding: 12, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning-border)' }}>
                                                                <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>
                                                                    <strong>Content Protected:</strong> Question body and options are end-to-end encrypted. Admins can only view the full question content while reviewing pending batches.
                                                                </p>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 16 }}>{q.title}</p>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                                {q.options?.map((opt, j) => {
                                                                    const isCorrect = opt === q.correctAnswer
                                                                    return (
                                                                        <div key={j} style={{
                                                                            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                                                                            background: isCorrect ? 'var(--success-subtle)' : 'var(--bg-surface)',
                                                                            border: `1px solid ${isCorrect ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                                                                            display: 'flex', gap: 10, alignItems: 'center', fontSize: 13
                                                                        }}>
                                                                            <div style={{
                                                                                width: 20, height: 20, borderRadius: '50%',
                                                                                background: isCorrect ? 'var(--success)' : 'var(--bg-elevated)',
                                                                                color: isCorrect ? '#fff' : 'var(--text-tertiary)',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600
                                                                            }}>
                                                                                {String.fromCharCode(65 + j)}
                                                                            </div>
                                                                            <span style={{ color: isCorrect ? 'var(--success)' : 'var(--text-primary)', fontWeight: isCorrect ? 600 : 400 }}>{opt}</span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-tertiary)' }}>
                            <Eye size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <p style={{ fontSize: 16, fontWeight: 500 }}>Select a batch to review</p>
                            <p style={{ fontSize: 13, marginTop: 4 }}>Review questions and approve them for the library</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
