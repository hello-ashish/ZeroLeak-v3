import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { Modal } from '../../components/Modal.jsx'
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
    Key, UserPlus, UserMinus, CheckCircle2, XCircle, AlertTriangle,
    PlayCircle, Trash2, Edit3, MapPin, RefreshCw, ScrollText, Download,
    ShieldCheck, Sparkles, Hash, Copy, Check, Eye, ShieldAlert, Cpu
} from 'lucide-react'
import './AdminActivityPage.css'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

const getActionDetails = (action) => {
    if (!action) return { icon: <MapPin size={14} />, label: 'Unknown Event', color: 'var(--text-tertiary)' }

    const map = {
        ADMIN_LOGIN: { icon: <Key size={14} />, label: 'Admin Authentication', color: 'var(--info)' },
        PROFESSOR_CREATED: { icon: <UserPlus size={14} />, label: 'Professor Registered', color: 'var(--success)' },
        PROFESSOR_DELETED: { icon: <UserMinus size={14} />, label: 'Professor Removed', color: 'var(--danger)' },
        STUDENT_DELETED: { icon: <UserMinus size={14} />, label: 'Student Removed', color: 'var(--danger)' },
        BATCH_APPROVED: { icon: <CheckCircle2 size={14} />, label: 'Batch Approved', color: 'var(--success)' },
        BATCH_REJECTED: { icon: <XCircle size={14} />, label: 'Batch Rejected', color: 'var(--danger)' },
        BATCH_MARKED_FOR_REVIEW: { icon: <AlertTriangle size={14} />, label: 'Batch Marked for Review', color: 'var(--warning)' },
        EXAM_LIVE: { icon: <PlayCircle size={14} />, label: 'Exam Published', color: 'var(--success)' },
        EXAM_COMPLETED: { icon: <CheckCircle2 size={14} />, label: 'Exam Concluded', color: 'var(--info)' },
        EXAM_DELETED: { icon: <Trash2 size={14} />, label: 'Exam Deleted', color: 'var(--danger)' },
        ADMIN_PROFILE_UPDATED: { icon: <Edit3 size={14} />, label: 'Admin Profile Updated', color: 'var(--brand-primary)' },
        LEDGER_TAMPERING_DETECTED: { icon: <ShieldAlert size={14} />, label: 'Blockchain Tampering Detected', color: 'var(--danger)' },
        TAMPER_ALERTS_ACKNOWLEDGED: { icon: <ShieldCheck size={14} />, label: 'Tamper Alerts Acknowledged', color: 'var(--success)' },
        TAMPER_ALERTS_CLEARED: { icon: <Trash2 size={14} />, label: 'Tamper Alerts Cleared', color: 'var(--warning)' },
    }

    if (map[action]) return map[action]

    // AI actions
    if (action.startsWith('AI_')) {
        const friendlyName = action
            .replace(/^AI_/, '')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
        return {
            icon: <Sparkles size={14} />,
            label: `AI · ${friendlyName}`,
            color: '#8b5cf6'
        }
    }

    // Default friendly label for any other action
    const friendly = action
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')

    return { icon: <MapPin size={14} />, label: friendly, color: 'var(--text-tertiary)' }
}

function parseDetails(raw) {
    if (!raw) return null
    if (typeof raw === 'object') return raw
    if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsed = JSON.parse(trimmed)
                if (typeof parsed === 'string') {
                    const secondTrimmed = parsed.trim()
                    if ((secondTrimmed.startsWith('{') && secondTrimmed.endsWith('}')) || (secondTrimmed.startsWith('[') && secondTrimmed.endsWith(']'))) {
                        return JSON.parse(secondTrimmed)
                    }
                }
                return parsed
            } catch (_) {
                return raw
            }
        }
    }
    return raw
}

function CopyableHash({ hash }) {
    const [copied, setCopied] = useState(false)
    if (!hash) return null

    const handleCopy = (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(hash)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <span
            className="audit-chip audit-chip-hash"
            onClick={handleCopy}
            title={`${hash} (Click to copy)`}
        >
            <Hash size={10} />
            <span>{hash.slice(0, 8)}…{hash.slice(-4)}</span>
            {copied ? <Check size={10} style={{ color: 'var(--success)' }} /> : <Copy size={10} style={{ opacity: 0.5 }} />}
        </span>
    )
}

function AuditDetailsCell({ details, onInspect }) {
    const parsed = parseDetails(details)

    if (!parsed) {
        return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
    }

    // AI Payload detection: { modelVersion, promptVersion, requestHash, responseHash }
    if (typeof parsed === 'object' && (parsed.modelVersion || parsed.promptVersion || parsed.requestHash)) {
        const cleanModel = parsed.modelVersion ? parsed.modelVersion.replace(/^openai\//, '') : null
        const formattedVersion = parsed.promptVersion
            ? (String(parsed.promptVersion).startsWith('v') ? parsed.promptVersion : `v${parsed.promptVersion}`)
            : null

        return (
            <div className="audit-details-cell">
                <div className="audit-chip-group">
                    {cleanModel && (
                        <span className="audit-chip audit-chip-ai" title={`Model: ${parsed.modelVersion}`}>
                            <Sparkles size={11} />
                            {cleanModel}
                        </span>
                    )}
                    {formattedVersion && (
                        <span className="audit-chip audit-chip-version" title={`Prompt Version: ${parsed.promptVersion}`}>
                            {formattedVersion}
                        </span>
                    )}
                    {parsed.requestHash && (
                        <CopyableHash hash={parsed.requestHash} />
                    )}
                    <button
                        type="button"
                        className="audit-inspect-btn"
                        onClick={(e) => { e.stopPropagation(); onInspect() }}
                        title="Inspect full AI payload JSON"
                    >
                        <Eye size={11} /> Payload
                    </button>
                </div>
            </div>
        )
    }

    // Generic Object detection
    if (typeof parsed === 'object') {
        const entries = Object.entries(parsed)
        if (entries.length === 0) {
            return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
        }
        const previewEntries = entries.slice(0, 2)
        return (
            <div className="audit-details-cell">
                <div className="audit-chip-group">
                    {previewEntries.map(([k, v]) => (
                        <span key={k} className="audit-chip audit-chip-kv">
                            <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v).slice(0, 16) + '…' : String(v).slice(0, 20)}
                        </span>
                    ))}
                    {entries.length > 2 && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{entries.length - 2} more</span>
                    )}
                    <button
                        type="button"
                        className="audit-inspect-btn"
                        onClick={(e) => { e.stopPropagation(); onInspect() }}
                        title="View details JSON"
                    >
                        <Eye size={11} /> Inspect
                    </button>
                </div>
            </div>
        )
    }

    // Plain text string
    const str = String(parsed).trim()
    if (!str || str === '—') {
        return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
    }
    const isLong = str.length > 70
    return (
        <div className="audit-details-cell">
            <span className="audit-text-details" title={str}>
                {str}
            </span>
            {isLong && (
                <button
                    type="button"
                    className="audit-inspect-btn"
                    onClick={(e) => { e.stopPropagation(); onInspect() }}
                    style={{ marginTop: 2 }}
                >
                    <Eye size={11} /> Full Text
                </button>
            )}
        </div>
    )
}

function AuditActorCell({ actor, role }) {
    const [copied, setCopied] = useState(false)
    const effectiveRole = role || (actor?.includes('@') ? 'Admin' : 'System')
    const isHexId = typeof actor === 'string' && /^[0-9a-fA-F]{24}$/.test(actor)

    const handleCopy = (e) => {
        if (!isHexId) return
        e.stopPropagation()
        navigator.clipboard.writeText(actor)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="audit-actor-cell">
            <span className={`audit-actor-role role-${effectiveRole.toLowerCase()}`}>
                {effectiveRole}
            </span>
            <span
                className="audit-actor-id"
                title={actor}
                onClick={handleCopy}
                style={{ cursor: isHexId ? 'pointer' : 'default', fontFamily: isHexId ? 'var(--font-mono)' : 'inherit' }}
            >
                {isHexId ? `${actor.slice(0, 8)}…${actor.slice(-4)}` : actor || '—'}
                {isHexId && (copied ? <Check size={10} style={{ color: 'var(--success)' }} /> : <Copy size={10} style={{ opacity: 0.4 }} />)}
            </span>
        </div>
    )
}

function AuditTargetCell({ targetLabel, targetType }) {
    if (targetLabel && targetLabel !== '—') {
        return <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{targetLabel}</span>
    }
    if (targetType) {
        return <span className="audit-target-badge">{targetType}</span>
    }
    return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
}

function AuditDetailModal({ log, onClose }) {
    const [copied, setCopied] = useState(false)
    if (!log) return null

    const parsedDetails = parseDetails(log.details)
    const { icon, label, color } = getActionDetails(log.action)
    const formattedJson = parsedDetails && typeof parsedDetails === 'object'
        ? JSON.stringify(parsedDetails, null, 2)
        : (log.details || 'No additional details provided.')

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedJson)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <Modal
            open={Boolean(log)}
            onClose={onClose}
            title="Audit Event Details"
            size="lg"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleCopy}>
                        {copied ? <><Check size={14} style={{ color: 'var(--success)' }} /> Copied JSON</> : <><Copy size={14} /> Copy JSON</>}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: `${color}18`,
                    color: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                }}>
                    {icon}
                </div>
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{log._id}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: log.status === 'failure' ? 'var(--danger-subtle)' : 'var(--success-subtle)',
                        color: log.status === 'failure' ? 'var(--danger)' : 'var(--success)',
                        border: `1px solid ${log.status === 'failure' ? 'var(--danger-border)' : 'var(--success-border)'}`
                    }}>
                        {log.status === 'failure' ? 'FAILED' : 'SUCCESS'}
                    </span>
                </div>
            </div>

            <div className="audit-modal-meta-grid">
                <div className="audit-modal-meta-item">
                    <span className="audit-modal-meta-lbl">Actor</span>
                    <span className="audit-modal-meta-val">
                        <span className={`audit-actor-role role-${log.actorRole?.toLowerCase() || 'admin'}`} style={{ marginRight: 6 }}>
                            {log.actorRole || 'Admin'}
                        </span>
                        {log.actor}
                    </span>
                </div>
                <div className="audit-modal-meta-item">
                    <span className="audit-modal-meta-lbl">Target Object</span>
                    <span className="audit-modal-meta-val">{log.targetLabel || log.targetType || '—'}</span>
                </div>
                <div className="audit-modal-meta-item">
                    <span className="audit-modal-meta-lbl">Timestamp</span>
                    <span className="audit-modal-meta-val">
                        {new Date(log.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })}
                    </span>
                </div>
                <div className="audit-modal-meta-item">
                    <span className="audit-modal-meta-lbl">Target Type</span>
                    <span className="audit-modal-meta-val">{log.targetType || 'Standard Event'}</span>
                </div>
            </div>

            <div className="audit-modal-json-container">
                <div className="audit-modal-json-header">
                    <span>Event Payload / Details</span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: copied ? 'var(--success)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12
                        }}
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
                <pre className="audit-modal-json-pre">
                    {formattedJson}
                </pre>
            </div>
        </Modal>
    )
}

export default function AdminActivityPage() {
    const [logs, setLogs] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [previewModal, setPreviewModal] = useState({ isOpen: false, title: '', content: '', headers: [], rows: [], filename: '' })
    const [inspectLog, setInspectLog] = useState(null)
    const [aiSummaryResult, setAiSummaryResult] = useState(null)
    const [aiSummarizing, setAiSummarizing] = useState(false)
    const LIMIT = 20
    const navigate = useNavigate()
    const toast = useToast()

    const fetchLogs = async (p = 1, showLoading = false) => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (showLoading) setLoading(true)
            const res = await axios.get(`${API}/admin/audit-logs?page=${p}&limit=${LIMIT}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setLogs(res.data.logs || [])
            setTotal(res.data.total || 0)
            setPage(p)
        } catch {
            toast.error('Failed to load activity log')
        } finally {
            if (showLoading) setLoading(false)
        }
    }

    const doAiSummary = async () => {
        if (!logs.length) return
        setAiSummarizing(true)
        setAiSummaryResult(null)
        try {
            const token = getToken()
            const res = await axios.post(`${API}/ai/admin/audit-summary`, { logs: logs.slice(0, 30) }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setAiSummaryResult(res.data)
            toast.success("AI Daily Summary complete")
        } catch (error) {
            toast.error(error.response?.data?.message || "AI Summary failed")
        } finally {
            setAiSummarizing(false)
        }
    }

    useEffect(() => { fetchLogs(1, true) }, [])

    const totalPages = Math.ceil(total / LIMIT)

    const handleExport = () => {
        if (!logs.length) {
            toast.info('No logs to export')
            return
        }
        const headers = ['Timestamp', 'Event Type', 'Actor', 'Target Object', 'Details']
        const rows = logs.map(l => {
            const date = new Date(l.createdAt).toLocaleString()
            const action = getActionDetails(l.action).label
            const actor = l.actor ? `${l.actorRole ? `[${l.actorRole}] ` : ''}${l.actor}` : 'System'
            const target = l.targetLabel || l.targetType || '—'
            const details = typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || '—')
            return [date, action, actor, target, details]
        })
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        
        setPreviewModal({
            isOpen: true,
            title: 'Audit Logs Export Preview',
            content: csvContent,
            headers: headers,
            rows: rows,
            filename: `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
        })
    }

    const handleDownload = (content, filename) => {
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + content)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Logs exported successfully')
        setPreviewModal({ ...previewModal, isOpen: false })
    }

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">System Audit Log</h1>
                        <p className="page-subtitle">Immutable record of administrative actions and platform events</p>
                    </div>
                    <div className="page-actions">
                        <button className="btn btn-secondary flex items-center gap-2" onClick={doAiSummary} disabled={aiSummarizing} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none' }}>
                            {aiSummarizing ? 'Summarizing...' : 'AI Daily Summary'}
                        </button>
                        <button className="btn btn-secondary flex items-center gap-2" onClick={() => fetchLogs(page)}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button className="btn btn-secondary flex items-center gap-2" onClick={handleExport}>
                            <Download size={14} /> Export Logs
                        </button>
                    </div>
                </div>
            </div>

            {aiSummaryResult && (
                <div style={{ marginBottom: 24, padding: '24px 32px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: aiSummaryResult.status === 'Normal' ? 'var(--success-subtle)' : aiSummaryResult.status === 'Warning' ? 'var(--warning-subtle)' : 'var(--danger-subtle)', color: aiSummaryResult.status === 'Normal' ? 'var(--success)' : aiSummaryResult.status === 'Warning' ? 'var(--warning)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {aiSummaryResult.status === 'Normal' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>AI Platform Health Summary</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status: <strong style={{ color: aiSummaryResult.status === 'Normal' ? 'var(--success)' : aiSummaryResult.status === 'Warning' ? 'var(--warning)' : 'var(--danger)' }}>{aiSummaryResult.status}</strong></p>
                        </div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {aiSummaryResult.summaryMarkdown}
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: '16px 20px', background: 'var(--success-subtle)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                <ShieldCheck size={20} color="var(--success)" style={{ flexShrink: 0 }} />
                <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>Audit Logging Active</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>All critical administrative actions are being securely logged with cryptographic timestamps.</p>
                </div>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '28%' }}>Event Type</th>
                            <th style={{ width: '16%' }}>Actor</th>
                            <th style={{ width: '14%' }}>Target Object</th>
                            <th style={{ width: '28%' }}>Details</th>
                            <th style={{ width: '14%' }}>Timestamp</th>
                        </tr>
                    </thead>
                    {loading ? (
                        <SkeletonTable rows={10} />
                    ) : (
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState
                                            icon={<ScrollText size={32} color="var(--text-tertiary)" />}
                                            title="No activity recorded"
                                            description="Admin actions will be tracked and displayed here."
                                        />
                                    </td>
                                </tr>
                            ) : logs.map((log) => {
                                const { icon, label, color } = getActionDetails(log.action)
                                return (
                                    <tr key={log._id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                                    background: `${color}18`,
                                                    color: color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{label}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{log._id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <AuditActorCell actor={log.actor} role={log.actorRole} />
                                        </td>
                                        <td>
                                            <AuditTargetCell targetLabel={log.targetLabel} targetType={log.targetType} />
                                        </td>
                                        <td>
                                            <AuditDetailsCell details={log.details} onInspect={() => setInspectLog(log)} />
                                        </td>
                                        <td>
                                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    )}
                </table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                            Page {page} of {totalPages} · {total} events
                        </span>
                        <div className="pagination">
                            <button className="pagination-btn" onClick={() => fetchLogs(page - 1, false)} disabled={page <= 1}>←</button>
                            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                                const p = i + 1
                                return (
                                    <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => fetchLogs(p, false)}>{p}</button>
                                )
                            })}
                            <button className="pagination-btn" onClick={() => fetchLogs(page + 1, false)} disabled={page >= totalPages}>→</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Event Detail Inspection Modal */}
            <AuditDetailModal log={inspectLog} onClose={() => setInspectLog(null)} />

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
        </AdminLayout>
    )
}
