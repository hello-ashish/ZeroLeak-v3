import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuditorLayout } from './AuditorLayout.jsx'
import { SkeletonRow } from '../../components/SkeletonLoader.jsx'
import axios from 'axios'
import { format } from 'date-fns'
import { Search, Download } from 'lucide-react'

const API = '/api'
const getToken = () => localStorage.getItem('auditorToken')

export default function AuditorAuditExplorerPage() {
    const [searchParams] = useSearchParams()
    const initialAction = searchParams.get('action') || ''
    
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [actionFilter, setActionFilter] = useState(initialAction)
    const [actorFilter, setActorFilter] = useState('')
    const navigate = useNavigate()
    const limit = 30

    const fetchLogs = async () => {
        const token = getToken()
        if (!token) { navigate('/auditor/login'); return }
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({ page, limit })
            if (actionFilter) params.set('action', actionFilter)
            if (actorFilter) params.set('actor', actorFilter)
            const res = await axios.get(`${API}/auditor/logs?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setLogs(res.data.logs)
            setTotal(res.data.total)
        } catch (err) {
            if (err.response?.status === 401) navigate('/auditor/login')
            else setError('Failed to load audit logs.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchLogs() }, [page])

    const handleSearch = (e) => {
        e.preventDefault()
        setPage(1)
        fetchLogs()
    }

    const exportToCSV = () => {
        if (logs.length === 0) return;
        
        const headers = ['Timestamp', 'Event ID', 'Action', 'Role', 'Actor', 'Target', 'Status'];
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
            const row = [
                format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss'),
                log._id,
                log.action,
                log.actorRole || '',
                log.actor || '',
                log.targetLabel ? `"${log.targetLabel.replace(/"/g, '""')}"` : '',
                log.status
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `audit_logs_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = Math.ceil(total / limit)

    return (
        <AuditorLayout>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Audit & Compliance
                    </p>
                    <h1 className="page-title">Audit Explorer</h1>
                    <p className="page-subtitle">Read-only, paginated log of all platform events.</p>
                </div>
            </div>

            {/* Search / Filter Bar */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Filter by action (e.g. EXAM_PUBLISHED)"
                            value={actionFilter}
                            onChange={e => setActionFilter(e.target.value)}
                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                        <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Filter by actor email"
                            value={actorFilter}
                            onChange={e => setActorFilter(e.target.value)}
                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Apply Filters</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setActionFilter(''); setActorFilter(''); setPage(1); fetchLogs() }}>Clear</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={exportToCSV} disabled={logs.length === 0} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Download size={14} /> Export CSV
                    </button>
                </form>
            </div>

            <div className="card">
                {error && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
                        {error} <button className="btn btn-ghost btn-sm" onClick={fetchLogs} style={{ marginLeft: 8 }}>Retry</button>
                    </div>
                )}
                <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Event ID</th>
                                <th>Action</th>
                                <th>Role</th>
                                <th>Actor</th>
                                <th>Target</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        {loading ? (
                            <tbody>
                                {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
                            </tbody>
                        ) : (
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                                            No audit events found. Adjust your filters.
                                        </td>
                                    </tr>
                                ) : logs.map(log => (
                                    <tr key={log._id}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                            {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                                title={log._id}
                                                onClick={() => navigator.clipboard?.writeText(log._id)}
                                            >
                                                {log._id.slice(-8)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{log.actorRole || '-'}</td>
                                        <td style={{ fontSize: 13 }}>{log.actor}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{log.targetLabel || '-'}</td>
                                        <td>
                                            <span className="badge" style={{
                                                background: log.status === 'success' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                                                color: log.status === 'success' ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        )}
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                            {total.toLocaleString()} total events · Page {page} of {totalPages}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                            <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </AuditorLayout>
    )
}
