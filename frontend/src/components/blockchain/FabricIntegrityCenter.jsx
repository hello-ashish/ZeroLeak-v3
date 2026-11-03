import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Blocks, Shield, ShieldCheck, ShieldAlert, ShieldOff,
    Activity, Database, Hash, Clock, RefreshCw,
    CheckCircle, XCircle, AlertTriangle, Loader2,
    ChevronRight, ChevronLeft, Eye, Network, Layers, Box,
    AlertCircle, Info, BellRing, ScanLine, Play,
    ChevronDown, ChevronUp, Zap, Lock, Unlock,
    Filter, Search, Square, RotateCcw, ArrowRight,
    Trash2, Check, Copy, FlaskConical, ExternalLink, X
} from 'lucide-react';
import './FabricIntegrityCenter.css';
import FabricBlockchainVisualizer from './FabricBlockchainVisualizer';

const rawApiBase = import.meta.env.VITE_API_URL || '';
const API_BASE = rawApiBase.replace(/\/api\/?$/, '');

import { getCachedData, setCachedData, invalidateCache } from '../../utils/apiCache.js';

// ---------------------------------------------------------------------------
// API Helper (Cached)
// ---------------------------------------------------------------------------
async function apiFetch(path, token, options = {}) {
    const effectiveToken = token || localStorage.getItem('adminToken') || localStorage.getItem('auditorToken') || localStorage.getItem('token');
    const fullPath = `/api/integrity${path}`;
    const isGet = !options.method || options.method.toUpperCase() === 'GET';

    if (!isGet) {
        invalidateCache('/api/integrity');
    } else if (options.force !== true && options.skipCache !== true) {
        const cached = getCachedData(fullPath, options.params, effectiveToken);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
    }

    const headers = { 'Content-Type': 'application/json' };
    if (effectiveToken && effectiveToken !== 'undefined' && effectiveToken !== 'null') {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    const res = await fetch(`${API_BASE}${fullPath}`, {
        headers,
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status, data });

    if (isGet) {
        setCachedData(fullPath, data, 25_000, options.params, effectiveToken);
    }
    return data;
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
    const map = {
        LOADING: { class: 'status-loading', icon: <Loader2 size={11} className="spin" />, label: 'CONNECTING...' },
        CONNECTED: { class: 'status-connected', icon: <span className="fi-status-dot" />, label: 'CONNECTED' },
        DISCONNECTED: { class: 'status-disconnected', icon: <span className="fi-status-dot" />, label: 'DISCONNECTED' },
        FABRIC_DISABLED: { class: 'status-warning', icon: <ShieldOff size={11} />, label: 'DISABLED' },
        CONFIRMED: { class: 'status-connected', icon: <CheckCircle size={11} />, label: 'CONFIRMED' },
        PENDING: { class: 'status-warning', icon: <Clock size={11} />, label: 'PENDING' },
        PROCESSING: { class: 'status-loading', icon: <Loader2 size={11} className="spin" />, label: 'PROCESSING' },
        FAILED: { class: 'status-disconnected', icon: <XCircle size={11} />, label: 'FAILED' },
        INTEGRITY_VERIFIED: { class: 'status-connected', icon: <ShieldCheck size={11} />, label: 'VERIFIED' },
        HASH_MISMATCH: { class: 'status-disconnected', icon: <ShieldAlert size={11} />, label: 'HASH MISMATCH' },
        COMMITMENT_NOT_FOUND: { class: 'status-warning', icon: <AlertTriangle size={11} />, label: 'NOT COMMITTED' },
        ENTITY_NOT_FOUND: { class: 'status-warning', icon: <AlertCircle size={11} />, label: 'NOT FOUND' },
        FABRIC_ERROR: { class: 'status-disconnected', icon: <AlertTriangle size={11} />, label: 'FABRIC ERROR' },
        VERIFIED: { class: 'status-connected', icon: <ShieldCheck size={11} />, label: 'VERIFIED' },
        TAMPERED: { class: 'status-disconnected', icon: <ShieldAlert size={11} />, label: 'TAMPERED' },
        UNVERIFIABLE: { class: 'status-warning', icon: <AlertCircle size={11} />, label: 'UNVERIFIABLE' },
    };
    const config = map[status] || { class: 'status-warning', icon: <Info size={11} />, label: status };
    return (
        <span className={`fi-status-badge ${config.class}`}>
            {config.icon}
            {config.label}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Hash Display (with click-to-copy)
// ---------------------------------------------------------------------------
function HashDisplay({ hash }) {
    const [copied, setCopied] = useState(false);
    if (!hash) return <span style={{ color: 'var(--fi-text-muted)' }}>—</span>;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            className="fi-code"
            onClick={handleCopy}
            title={`${hash} (Click to copy)`}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--fi-surface-subtle)', border: '1px solid var(--fi-border-subtle)' }}
        >
            <span>{hash.slice(0, 8)}…{hash.slice(-8)}</span>
            {copied ? <Check size={10} style={{ color: 'var(--fi-green)' }} /> : <Copy size={10} opacity={0.6} />}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Tamper Alerts Panel
// ---------------------------------------------------------------------------
function TamperAlertsPanel({ token, onAlertsUpdated }) {
    const [alerts, setAlerts] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [viewMode, setViewMode] = useState('incidents'); // 'incidents' | 'deliveries'
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await apiFetch('/alerts', token);
            setAlerts(data.alerts || []);
            setDeliveries(data.deliveries || []);
        } catch (err) {
            console.error('[TamperAlertsPanel] Failed to load alerts:', err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 25_000);
        return () => clearInterval(interval);
    }, [load]);

    const handleAcknowledgeAll = async () => {
        try {
            setBusyId('ack-all');
            await apiFetch('/alerts/dismiss', token, {
                method: 'POST',
                body: JSON.stringify({ dismissAll: true })
            });
            await load();
            onAlertsUpdated?.();
        } catch (err) {
            console.error('Failed to acknowledge all alerts:', err);
        } finally {
            setBusyId(null);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm("Permanently clear all tamper breach alert records from the database?")) return;
        try {
            setBusyId('clear-all');
            await apiFetch('/alerts', token, {
                method: 'DELETE',
                body: JSON.stringify({ clearAll: true })
            });
            await load();
            onAlertsUpdated?.();
        } catch (err) {
            console.error('Failed to clear tamper alerts:', err);
        } finally {
            setBusyId(null);
        }
    };

    const handleAcknowledgeIncident = async (incident, idx) => {
        try {
            setBusyId(`ack-${idx}`);
            const deliveryIds = (incident.recipients || []).map(r => r._id);
            await apiFetch('/alerts/dismiss', token, {
                method: 'POST',
                body: JSON.stringify({ deliveryIds })
            });
            await load();
            onAlertsUpdated?.();
        } catch (err) {
            console.error('Failed to acknowledge incident:', err);
        } finally {
            setBusyId(null);
        }
    };

    const handleDeleteIncident = async (incident, idx) => {
        if (!window.confirm(`Delete Incident #${idx + 1} from tamper records?`)) return;
        try {
            setBusyId(`del-${idx}`);
            const deliveryIds = (incident.recipients || []).map(r => r._id);
            await apiFetch('/alerts', token, {
                method: 'DELETE',
                body: JSON.stringify({ deliveryIds })
            });
            await load();
            onAlertsUpdated?.();
        } catch (err) {
            console.error('Failed to delete incident:', err);
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <div className="fi-empty">
                <Loader2 size={16} className="spin" />
                <p>Loading security alert log...</p>
            </div>
        );
    }

    if (alerts.length === 0 && deliveries.length === 0) {
        return (
            <div className="fi-alerts-clean">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} />
                    <span>All automated integrity checks clear — zero database tampering incidents detected.</span>
                </div>
                <button className="fi-refresh-btn" onClick={load} title="Refresh alerts">
                    <RefreshCw size={13} />
                </button>
            </div>
        );
    }

    const activeIncidents = alerts.filter(a => !a.isAcknowledged);

    return (
        <div className="fi-tamper-panel">
            <div className="fi-card-header">
                <div className="fi-card-title-row">
                    <BellRing size={16} style={{ color: activeIncidents.length > 0 ? 'var(--fi-red)' : 'var(--fi-text-muted)' }} />
                    <h3>
                        Security Incident Log
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--fi-text-muted)', marginLeft: 8 }}>
                            {activeIncidents.length} Active · {alerts.length - activeIncidents.length} Acknowledged
                        </span>
                    </h3>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="fi-filter-group">
                        <button
                            type="button"
                            className={`fi-filter-pill ${viewMode === 'incidents' ? 'active' : ''}`}
                            onClick={() => setViewMode('incidents')}
                        >
                            Unique Incidents ({alerts.length})
                        </button>
                        <button
                            type="button"
                            className={`fi-filter-pill ${viewMode === 'deliveries' ? 'active' : ''}`}
                            onClick={() => setViewMode('deliveries')}
                        >
                            All Deliveries ({deliveries.length})
                        </button>
                    </div>

                    {activeIncidents.length > 0 && (
                        <button
                            type="button"
                            className="fi-btn fi-btn-secondary fi-btn-sm"
                            disabled={busyId === 'ack-all'}
                            onClick={handleAcknowledgeAll}
                        >
                            {busyId === 'ack-all' ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                            Acknowledge All
                        </button>
                    )}

                    <button
                        type="button"
                        className="fi-btn fi-btn-ghost fi-btn-sm"
                        disabled={busyId === 'clear-all'}
                        onClick={handleClearAll}
                        title="Permanently clear logs"
                    >
                        <Trash2 size={12} />
                        Clear Logs
                    </button>

                    <button className="fi-refresh-btn" onClick={load} title="Refresh">
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            <div>
                {viewMode === 'incidents' ? (
                    alerts.map((alert, i) => (
                        <div
                            key={i}
                            className={`fi-tamper-item ${alert.isAcknowledged ? 'fi-tamper-item-ack' : 'fi-tamper-item-active'}`}
                        >
                            <div style={{ marginTop: 2 }}>
                                {alert.isAcknowledged
                                    ? <ShieldCheck size={16} style={{ color: 'var(--fi-green)' }} />
                                    : <ShieldAlert size={16} style={{ color: 'var(--fi-red)' }} />}
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fi-text-primary)' }}>
                                        {alert.title}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        {alert.isAcknowledged ? (
                                            <span className="fi-status-badge status-connected" style={{ fontSize: '12px', padding: '2px 8px' }}>
                                                <CheckCircle size={10} /> Acknowledged
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="fi-btn fi-btn-primary fi-btn-sm"
                                                disabled={busyId === `ack-${i}`}
                                                onClick={() => handleAcknowledgeIncident(alert, i)}
                                            >
                                                {busyId === `ack-${i}` ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
                                                Acknowledge
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="fi-btn fi-btn-ghost fi-btn-sm"
                                            disabled={busyId === `del-${i}`}
                                            onClick={() => handleDeleteIncident(alert, i)}
                                            title="Delete incident"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--fi-text-secondary)', lineHeight: 1.45 }}>
                                    {alert.message}
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: '12px', color: 'var(--fi-text-muted)' }}>
                                    <span><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />{new Date(alert.createdAt).toLocaleString()}</span>
                                    <span>Recipients: {alert.recipients?.length || 0}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    deliveries.map((d, i) => (
                        <div key={d._id || i} className="fi-tamper-item">
                            <div style={{ marginTop: 2 }}>
                                {d.isRead
                                    ? <CheckCircle size={15} style={{ color: 'var(--fi-green)' }} />
                                    : <ShieldAlert size={15} style={{ color: 'var(--fi-red)' }} />}
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{d.title}</span>
                                    <span className="fi-type-badge">{d.recipientRole}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--fi-text-muted)', marginBottom: 4 }}>
                                    Recipient: <strong>{d.recipientName}</strong> ({d.recipientEmail})
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--fi-text-secondary)' }}>
                                    {d.message}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Recent Commitments Table Component
// ---------------------------------------------------------------------------
function RecentCommitmentsTable({ commitments, loading, onVerify }) {
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const allowedTypes = useMemo(() => new Set(['BATCH_COMMITMENT', 'RESULT_COMMITMENT', 'EXAM_COMMITMENT', 'SECURITY_EVENT']), []);

    const validCommitments = useMemo(() => {
        if (!commitments) return [];
        return commitments.filter(c => allowedTypes.has(c.eventType));
    }, [commitments, allowedTypes]);

    const availableTypes = useMemo(() => {
        if (!validCommitments) return [];
        return Array.from(new Set(validCommitments.map(c => c.eventType).filter(Boolean)));
    }, [validCommitments]);

    useEffect(() => {
        setCurrentPage(1);
    }, [typeFilter, searchQuery, pageSize]);

    const filtered = useMemo(() => {
        if (!validCommitments) return [];
        return validCommitments.filter(c => {
            if (typeFilter !== 'ALL' && c.eventType !== typeFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchId = c.id?.toLowerCase().includes(q);
                const matchEntityId = c.entityId?.toLowerCase().includes(q);
                const matchHash = c.dataHash?.toLowerCase().includes(q);
                const matchType = c.eventType?.toLowerCase().includes(q);
                if (!matchId && !matchEntityId && !matchHash && !matchType) return false;
            }
            return true;
        });
    }, [validCommitments, typeFilter, searchQuery]);

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const validCurrentPage = Math.min(currentPage, totalPages);

    const paginatedCommitments = useMemo(() => {
        const start = (validCurrentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, validCurrentPage, pageSize]);

    if (loading && (!validCommitments || validCommitments.length === 0)) {
        return (
            <div className="fi-commitments-skeleton-wrap">
                <div className="fi-commitments-skeleton-header">
                    <Loader2 size={16} className="spin" style={{ color: 'var(--fi-blue)' }} />
                    <span>Querying Hyperledger Fabric peer ledger for recent commitments...</span>
                </div>
                <div className="fi-commitments-skeleton-list">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="fi-commitments-skeleton-row">
                            <span className="skeleton" style={{ width: 120, height: 16 }} />
                            <span className="skeleton" style={{ width: 160, height: 16 }} />
                            <span className="skeleton" style={{ width: 220, height: 16 }} />
                            <span className="skeleton" style={{ width: 80, height: 16 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!validCommitments || validCommitments.length === 0) {
        return (
            <div className="fi-empty">
                <Database size={24} />
                <p>No commitments on ledger yet.</p>
            </div>
        );
    }

    return (
        <div className="fi-table-container">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--fi-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="fi-filter-group">
                    <button
                        type="button"
                        className={`fi-filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('ALL')}
                    >
                        All Types <span className="fi-filter-count">{validCommitments.length}</span>
                    </button>
                    {availableTypes.map(t => (
                        <button
                            key={t}
                            type="button"
                            className={`fi-filter-pill ${typeFilter === t ? 'active' : ''}`}
                            onClick={() => setTypeFilter(t)}
                        >
                            {t.replace('_COMMITMENT', '')} <span className="fi-filter-count">{validCommitments.filter(c => c.eventType === t).length}</span>
                        </button>
                    ))}
                </div>

                <div className="fi-search-box">
                    <Search size={13} className="fi-search-icon" />
                    <input
                        type="text"
                        className="fi-search-input"
                        placeholder="Search commitments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="fi-search-clear" onClick={() => setSearchQuery('')}>×</button>
                    )}
                </div>
            </div>

            <div className="fi-table-wrapper">
                <table className="fi-table">
                    <thead>
                        <tr>
                            <th>Commitment ID</th>
                            <th>Type</th>
                            <th>Entity ID</th>
                            <th>Cryptographic Hash</th>
                            <th>Block Timestamp</th>
                            <th>Version</th>
                            <th style={{ textAlign: 'right' }}>Verify</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedCommitments.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                                    <div className="fi-empty" style={{ padding: 0 }}>
                                        <Filter size={18} />
                                        <p>No commitments match this filter.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedCommitments.map((c, i) => {
                                const commitmentId = c.id || c.commitmentId || '';
                                const entityId = c.entityId || c.entity_id || '';
                                return (
                                    <tr key={commitmentId || i}>
                                        <td>
                                            <code className="fi-code" title={commitmentId}>
                                                {commitmentId ? (commitmentId.length > 20 ? `${commitmentId.slice(0, 20)}…` : commitmentId) : '—'}
                                            </code>
                                        </td>
                                        <td>
                                            <span className="fi-type-badge">
                                                {c.eventType?.replace('_COMMITMENT', '') || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <code className="fi-code" title={entityId}>
                                                {entityId ? (entityId.length > 14 ? `${entityId.slice(0, 14)}…` : entityId) : '—'}
                                            </code>
                                        </td>
                                        <td><HashDisplay hash={c.dataHash} /></td>
                                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            {c.blockTimestamp ? new Date(c.blockTimestamp).toLocaleString() : '—'}
                                        </td>
                                        <td>v{c.version ?? 1}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                                onClick={() => onVerify(c)}
                                                title="Verify Integrity"
                                            >
                                                <ShieldCheck size={12} /> Verify
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalRecords > 0 && (
                <div className="fi-pagination-bar">
                    <div>
                        Showing <strong>{((validCurrentPage - 1) * pageSize) + 1}</strong> – <strong>{Math.min(validCurrentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong>
                    </div>

                    <div className="fi-pagination-controls">
                        <button
                            type="button"
                            className="fi-page-btn"
                            disabled={validCurrentPage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            <ChevronLeft size={13} /> Prev
                        </button>
                        <span style={{ fontSize: '13px', padding: '0 8px' }}>
                            {validCurrentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            className="fi-page-btn"
                            disabled={validCurrentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            Next <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Verify Ledger Panel (Bulk Scan)
// ---------------------------------------------------------------------------
function VerifyLedgerPanel({ token }) {
    const [state, setState] = useState('idle'); // idle | running | done | error
    const [report, setReport] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [progress, setProgress] = useState(0);
    const [stageText, setStageText] = useState('');
    const [realStats, setRealStats] = useState({
        total: 0,
        processed: 0,
        percent: 0,
        entityType: '',
        entityId: '',
        verified: 0,
        tampered: 0,
        skipped: 0,
    });
    const abortControllerRef = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleVerify = async () => {
        if (state === 'running') return;
        setState('running');
        setReport(null);
        setErrorMsg(null);
        setProgress(0);
        setStageText('Connecting to Hyperledger Fabric and retrieving outbox commitments...');
        setRealStats({
            total: 0,
            processed: 0,
            percent: 0,
            entityType: '',
            entityId: '',
            verified: 0,
            tampered: 0,
            skipped: 0,
        });

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const effectiveToken = token || localStorage.getItem('adminToken') || localStorage.getItem('auditorToken') || localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            };
            if (effectiveToken && effectiveToken !== 'undefined' && effectiveToken !== 'null') {
                headers['Authorization'] = `Bearer ${effectiveToken}`;
            }

            const res = await fetch(`${API_BASE}/api/integrity/verify-ledger?stream=true`, {
                method: 'POST',
                headers,
                signal: abortControllerRef.current.signal,
            });

            if (!res.ok) {
                let errData;
                try { errData = await res.json(); } catch (_) { }
                throw new Error(errData?.message || `Verification failed with HTTP ${res.status}`);
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('text/event-stream') || !res.body) {
                // Fallback if not streaming
                const data = await res.json();
                if (!isMountedRef.current) return;
                setProgress(100);
                setReport(data);
                setState('done');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let receivedReport = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const jsonStr = trimmed.slice(5).trim();
                    if (!jsonStr) continue;

                    try {
                        const evt = JSON.parse(jsonStr);
                        if (!isMountedRef.current) return;

                        if (evt.type === 'init') {
                            setStageText(`Identified ${evt.total} unique commitments. Starting cryptographic audit...`);
                            setRealStats(prev => ({ ...prev, total: evt.total }));
                        } else if (evt.type === 'progress') {
                            const pct = evt.percent ?? Math.min(100, Math.round((evt.processed / (evt.total || 1)) * 100));
                            setProgress(pct);
                            setStageText(`Auditing ${evt.entityType} (${evt.entityId})...`);
                            setRealStats({
                                total: evt.total,
                                processed: evt.processed,
                                percent: pct,
                                entityType: evt.entityType,
                                entityId: evt.entityId,
                                verified: evt.summary?.verified || 0,
                                tampered: evt.summary?.tampered || 0,
                                skipped: evt.summary?.skipped || 0,
                            });
                        } else if (evt.type === 'done') {
                            receivedReport = {
                                fabricEnabled: evt.fabricEnabled,
                                summary: evt.summary,
                                results: evt.results,
                                verifiedAt: evt.verifiedAt,
                                message: evt.message,
                            };
                            setProgress(100);
                            setStageText('Audit complete');
                            setRealStats(prev => ({
                                ...prev,
                                processed: evt.summary?.total || prev.total,
                                total: evt.summary?.total || prev.total,
                                percent: 100,
                                verified: evt.summary?.verified || 0,
                                tampered: evt.summary?.tampered || 0,
                                skipped: evt.summary?.skipped || 0,
                            }));
                        } else if (evt.type === 'error') {
                            throw new Error(evt.message || 'Verification stream error');
                        }
                    } catch (parseErr) {
                        if (parseErr.message && !parseErr.message.includes('Unexpected token')) {
                            throw parseErr;
                        }
                    }
                }
            }

            if (!isMountedRef.current) return;

            if (receivedReport) {
                setReport(receivedReport);
                setState('done');
            } else {
                throw new Error('Connection closed before audit completion.');
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            if (!isMountedRef.current) return;
            setErrorMsg(err.message || 'Verification failed.');
            setState('error');
        }
    };

    const results = report?.results || [];
    const filteredResults = useMemo(() => {
        return results.filter(r => {
            if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const idMatch = r.entityId?.toLowerCase().includes(q);
                const typeMatch = r.entityType?.toLowerCase().includes(q);
                if (!idMatch && !typeMatch) return false;
            }
            return true;
        });
    }, [results, statusFilter, searchQuery]);

    return (
        <div className="fi-card">
            <div className="fi-card-header">
                <div className="fi-card-title-row">
                    <ScanLine size={16} style={{ color: 'var(--fi-blue)' }} />
                    <h3>Cryptographic Bulk Ledger Verification</h3>
                </div>
                <button
                    type="button"
                    className="fi-btn fi-btn-primary"
                    onClick={handleVerify}
                    disabled={state === 'running'}
                >
                    {state === 'running' ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
                    {state === 'running' ? (
                        realStats.total > 0
                            ? `Verifying... ${progress}% (${realStats.processed}/${realStats.total})`
                            : `Verifying... ${progress}%`
                    ) : 'Run Ledger Verification'}
                </button>
            </div>

            <div className="fi-card-body">
                <p style={{ fontSize: '13px', color: 'var(--fi-text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                    Recomputes the SHA-256 digest of every stored MongoDB entity and compares it against the immutable Hyperledger Fabric ledger block commitment.
                </p>

                {errorMsg && (
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--fi-radius-sm)', background: 'var(--fi-red-subtle)', border: '1px solid var(--fi-red-border)', color: 'var(--fi-red)', fontSize: '13px', marginBottom: 16 }}>
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {errorMsg}
                    </div>
                )}

                {(state === 'running' || (state === 'done' && report)) && (
                    <div className={`fi-verify-progress-card ${state === 'done' ? 'is-complete' : 'is-running'}`}>
                        <div className="fi-verify-progress-header">
                            <div className="fi-verify-progress-info">
                                <div className={`fi-verify-progress-icon ${state === 'done' ? 'completed' : ''}`}>
                                    {state === 'running' ? (
                                        <Loader2 size={16} className="spin" />
                                    ) : (
                                        <CheckCircle size={16} />
                                    )}
                                </div>
                                <div>
                                    <div className="fi-verify-progress-title">
                                        {state === 'running' ? 'Scanning Blockchain & Cross-Verifying SHA-256 Hashes...' : 'Ledger Verification Complete'}
                                    </div>
                                    <div className="fi-verify-progress-stage">
                                        {state === 'running' ? (
                                            <>
                                                <span className="fi-verify-pulse" />
                                                {realStats.entityType ? (
                                                    <span>
                                                        Auditing <strong>{realStats.entityType}</strong> <code className="fi-code">{realStats.entityId}</code>
                                                    </span>
                                                ) : (
                                                    <span>{stageText}</span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="fi-status-dot" style={{ background: 'var(--fi-green)' }} />
                                                <span>Audit complete — verified {report?.summary?.total || 0} entities ({report?.summary?.confirmedCommitmentsCount || totalCommitmentsCount || report?.summary?.total || 0} on-chain commitments) against Fabric blockchain</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={`fi-verify-progress-pct ${state === 'done' ? 'completed' : ''}`}>
                                {progress}<span>%</span>
                            </div>
                        </div>

                        <div className="fi-verify-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                            <div
                                className={`fi-verify-progress-bar ${state === 'done' ? 'completed' : ''}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="fi-verify-progress-footer">
                            <span>
                                {state === 'running' ? (
                                    realStats.total > 0 ? (
                                        <>
                                            <strong>{realStats.processed}</strong> of <strong>{realStats.total}</strong> commitments verified ({progress}%)
                                            <span style={{ marginLeft: 10, color: 'var(--fi-green)' }}>
                                                · {realStats.verified} Matches
                                            </span>
                                            {realStats.tampered > 0 && (
                                                <span style={{ marginLeft: 8, color: 'var(--fi-red)', fontWeight: 600 }}>
                                                    · {realStats.tampered} Tampered
                                                </span>
                                            )}
                                            {realStats.skipped > 0 && (
                                                <span style={{ marginLeft: 8, color: 'var(--fi-text-muted)' }}>
                                                    · {realStats.skipped} Skipped
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>Live SHA-256 cross-check · Channel: <code className="fi-code">zeroleak-channel</code></>
                                    )
                                ) : (
                                    <>
                                        <span style={{ color: 'var(--fi-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Check size={14} strokeWidth={2.5} /> {report?.summary?.verified || 0} Matches Verified
                                        </span>
                                        {(report?.summary?.tampered || 0) > 0 && (
                                            <span style={{ color: 'var(--fi-red)', fontWeight: 600, marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <AlertTriangle size={14} /> {report.summary.tampered} Tampered
                                            </span>
                                        )}
                                        {(report?.summary?.skipped || 0) > 0 && (
                                            <span style={{ color: 'var(--fi-text-muted)', marginLeft: 12 }}>
                                                · {report.summary.skipped} Skipped
                                            </span>
                                        )}
                                    </>
                                )}
                            </span>
                            <span className="fi-verify-progress-pct-label">
                                {realStats.processed || 0} / {realStats.total || 0} ({progress}%)
                            </span>
                        </div>
                    </div>
                )}

                {report && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                            <div className="fi-outbox-stat-card">
                                <span className="fi-outbox-stat-lbl">Total Audited</span>
                                <span className="fi-outbox-stat-val">{report.summary?.total || 0}</span>
                            </div>
                            <div className="fi-outbox-stat-card">
                                <span className="fi-outbox-stat-lbl">Verified Matches</span>
                                <span className="fi-outbox-stat-val" style={{ color: 'var(--fi-green)' }}>{report.summary?.verified || 0}</span>
                            </div>
                            <div className="fi-outbox-stat-card">
                                <span className="fi-outbox-stat-lbl">Tampered Mismatches</span>
                                <span className="fi-outbox-stat-val" style={{ color: (report.summary?.tampered || 0) > 0 ? 'var(--fi-red)' : 'var(--fi-text-muted)' }}>
                                    {report.summary?.tampered || 0}
                                </span>
                            </div>
                            <div className="fi-outbox-stat-card">
                                <span className="fi-outbox-stat-lbl">Skipped / Uncommitted</span>
                                <span className="fi-outbox-stat-val">{report.summary?.skipped || 0}</span>
                            </div>
                        </div>

                        <div className="fi-table-container">
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--fi-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div className="fi-filter-group">
                                    <button type="button" className={`fi-filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStatusFilter('ALL')}>
                                        All ({results.length})
                                    </button>
                                    <button type="button" className={`fi-filter-pill ${statusFilter === 'VERIFIED' ? 'active' : ''}`} onClick={() => setStatusFilter('VERIFIED')}>
                                        Verified ({report.summary?.verified || 0})
                                    </button>
                                    <button type="button" className={`fi-filter-pill ${statusFilter === 'TAMPERED' ? 'active' : ''}`} onClick={() => setStatusFilter('TAMPERED')}>
                                        Tampered ({report.summary?.tampered || 0})
                                    </button>
                                </div>
                                <div className="fi-search-box">
                                    <Search size={13} className="fi-search-icon" />
                                    <input
                                        type="text"
                                        className="fi-search-input"
                                        placeholder="Search entity..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="fi-table-wrapper">
                                <table className="fi-table">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Entity ID</th>
                                            <th>Live MongoDB Hash</th>
                                            <th>Ledger Commitment Hash</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResults.map((r, idx) => (
                                            <tr key={idx}>
                                                <td><span className="fi-type-badge">{r.entityType}</span></td>
                                                <td><code className="fi-code">{r.entityId}</code></td>
                                                <td><HashDisplay hash={r.computedHash} /></td>
                                                <td><HashDisplay hash={r.ledgerHash} /></td>
                                                <td><StatusBadge status={r.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Verify Entity Panel (Single Item)
// ---------------------------------------------------------------------------
function VerificationPanel({ token, entityType, setEntityType, entityId, setEntityId }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleVerify = async () => {
        if (!entityId?.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const data = await apiFetch(`/${entityType}/${entityId.trim()}`, token);
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getVerificationStatus = (res) => {
        if (!res) return null;
        if (res.reason === 'FABRIC_DISABLED') return 'FABRIC_DISABLED';
        if (res.valid === true) return 'INTEGRITY_VERIFIED';
        if (res.reason === 'HASH_MISMATCH') return 'HASH_MISMATCH';
        if (res.reason === 'COMMITMENT_NOT_FOUND') return 'COMMITMENT_NOT_FOUND';
        if (res.reason === 'ENTITY_NOT_FOUND') return 'ENTITY_NOT_FOUND';
        return 'FABRIC_ERROR';
    };

    const status = getVerificationStatus(result);

    return (
        <div className="fi-card">
            <div className="fi-card-header">
                <div className="fi-card-title-row">
                    <ShieldCheck size={16} style={{ color: 'var(--fi-blue)' }} />
                    <h3>Verify Single Entity Integrity</h3>
                </div>
            </div>

            <div className="fi-card-body">
                <p style={{ fontSize: '13px', color: 'var(--fi-text-secondary)', margin: '0 0 16px' }}>
                    Select an entity type and enter its 24-character hexadecimal MongoDB ObjectId to verify live hash against the Fabric commitment.
                </p>

                <div className="fi-verify-form">
                    <select
                        className="fi-select"
                        value={entityType}
                        onChange={e => setEntityType(e.target.value)}
                        style={{ minWidth: 140 }}
                    >
                        <option value="result">Student Result</option>
                        <option value="batch">Question Batch</option>
                        <option value="exam">Exam Paper</option>
                        <option value="event">Security Event</option>
                    </select>

                    <input
                        type="text"
                        className="fi-input"
                        placeholder="MongoDB ObjectId (e.g. 68fa910cd39...)"
                        value={entityId}
                        onChange={e => setEntityId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    />

                    <button
                        type="button"
                        className="fi-btn fi-btn-primary"
                        onClick={handleVerify}
                        disabled={loading || !entityId?.trim()}
                    >
                        {loading ? <Loader2 size={13} className="spin" /> : <Eye size={13} />}
                        Verify
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--fi-radius-sm)', background: 'var(--fi-red-subtle)', border: '1px solid var(--fi-red-border)', color: 'var(--fi-red)', fontSize: '13px' }}>
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {error}
                    </div>
                )}

                {result && (
                    <div className={`fi-verify-result ${status === 'INTEGRITY_VERIFIED' ? 'fi-verify-result-success' : status === 'HASH_MISMATCH' ? 'fi-verify-result-danger' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <StatusBadge status={status} />
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{result.entityType} · {result.entityId}</span>
                            </div>
                            {result.commitmentId && (
                                <span style={{ fontSize: '12px', color: 'var(--fi-text-muted)', fontFamily: 'var(--fi-font-mono)' }}>
                                    {result.commitmentId}
                                </span>
                            )}
                        </div>

                        <div className="fi-meta-grid">
                            <div className="fi-meta-item">
                                <span className="fi-meta-label">Live MongoDB Hash</span>
                                <span className="fi-meta-val"><HashDisplay hash={result.computedHash} /></span>
                            </div>
                            <div className="fi-meta-item">
                                <span className="fi-meta-label">Ledger Commitment Hash</span>
                                <span className="fi-meta-val"><HashDisplay hash={result.ledgerHash} /></span>
                            </div>
                            <div className="fi-meta-item">
                                <span className="fi-meta-label">Fabric Block Height</span>
                                <span className="fi-meta-val">
                                    {(result.blockHeight || result.fabricBlockHeight || result.height) != null ? (
                                        <span className="fi-code" style={{ fontWeight: 600 }}>
                                            #{result.blockHeight || result.fabricBlockHeight || result.height}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--fi-text-muted)' }}>—</span>
                                    )}
                                </span>
                            </div>
                            <div className="fi-meta-item">
                                <span className="fi-meta-label">Fabric Tx ID</span>
                                <span className="fi-meta-val">
                                    <HashDisplay hash={result.fabricTxId || result.txId} />
                                </span>
                            </div>
                            {(result.blockTimestamp || result.fabricBlockTimestamp) && (
                                <>
                                    <div className="fi-meta-item">
                                        <span className="fi-meta-label">Commitment Version</span>
                                        <span className="fi-meta-val">v{result.ledgerVersion || result.version || 1}</span>
                                    </div>
                                    <div className="fi-meta-item">
                                        <span className="fi-meta-label">Fabric Block Timestamp</span>
                                        <span className="fi-meta-val" style={{ fontSize: '12px' }}>
                                            {new Date(result.blockTimestamp || result.fabricBlockTimestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Outbox Re-commit & Synchronizer Panel
// ---------------------------------------------------------------------------
function OutboxRecommitPanel({ token, fabricStatus, ledgerHeight, onRefreshStatus, onNavigateTab }) {
    const [stats, setStats] = useState(null);
    const [job, setJob] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [reconnectLoading, setReconnectLoading] = useState(false);
    const [selectedMode, setSelectedMode] = useState('core');
    const [confirmModal, setConfirmModal] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            const data = await apiFetch('/outbox/stats', token);
            setStats(data);
            if (data.recommitJob) setJob(data.recommitJob);
        } catch (_) { }
    }, [token]);

    const pollJobStatus = useCallback(async () => {
        try {
            const data = await apiFetch('/outbox/recommit-status', token);
            setJob(data.job);
            if (data.job?.status !== 'running') {
                loadStats();
                onRefreshStatus?.();
            }
        } catch (_) { }
    }, [token, loadStats, onRefreshStatus]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        if (job?.status === 'running') {
            const timer = setInterval(pollJobStatus, 1500);
            return () => clearInterval(timer);
        }
    }, [job?.status, pollJobStatus]);

    const handleStart = async (mode) => {
        setActionLoading(true);
        setActionError(null);
        setConfirmModal(false);
        try {
            const res = await apiFetch('/outbox/recommit', token, {
                method: 'POST',
                body: JSON.stringify({ mode, resetDb: true }),
            });
            if (res.job) setJob(res.job);
            loadStats();
        } catch (err) {
            setActionError(err.message || 'Failed to start recommit.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStop = async () => {
        try {
            await apiFetch('/outbox/recommit-stop', token, { method: 'POST' });
            pollJobStatus();
        } catch (err) {
            setActionError(err.message);
        }
    };

    const handleReconnect = async () => {
        setReconnectLoading(true);
        setActionError(null);
        try {
            await apiFetch('/fabric/reconnect', token, { method: 'POST' });
            onRefreshStatus?.();
            loadStats();
        } catch (err) {
            setActionError(`Reconnection failed: ${err.message}`);
        } finally {
            setReconnectLoading(false);
        }
    };

    const isRunning = job?.status === 'running';
    const percent = job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
    const currentHeight = ledgerHeight?.height ?? stats?.ledgerHeight ?? 0;

    return (
        <div>
            {/* Outbox Status Metrics */}
            <div className="fi-recommit-overview">
                <div className="fi-outbox-stat-card">
                    <span className="fi-outbox-stat-lbl">Question Batches</span>
                    {!stats ? <span className="skeleton fi-outbox-skeleton" /> : <span className="fi-outbox-stat-val">{stats.byType?.Batch || 0}</span>}
                </div>
                <div className="fi-outbox-stat-card">
                    <span className="fi-outbox-stat-lbl">Exam Papers</span>
                    {!stats ? <span className="skeleton fi-outbox-skeleton" /> : <span className="fi-outbox-stat-val">{stats.byType?.Exam || 0}</span>}
                </div>
                <div className="fi-outbox-stat-card">
                    <span className="fi-outbox-stat-lbl">Student Results</span>
                    {!stats ? <span className="skeleton fi-outbox-skeleton" /> : <span className="fi-outbox-stat-val">{stats.byType?.Result || 0}</span>}
                </div>
                <div className="fi-outbox-stat-card">
                    <span className="fi-outbox-stat-lbl">Security Events</span>
                    {!stats ? <span className="skeleton fi-outbox-skeleton" /> : <span className="fi-outbox-stat-val">{stats.byType?.SecurityEvent || 0}</span>}
                </div>
            </div>

            {/* Active Job Progress */}
            {job && job.status !== 'idle' && (
                <div className="fi-card" style={{ padding: 18, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusBadge status={isRunning ? 'PROCESSING' : job.status === 'completed' ? 'CONFIRMED' : 'FAILED'} />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                {isRunning ? 'Anchor synchronization in progress...' : job.status === 'completed' ? 'Recommit completed' : 'Job stopped'}
                            </span>
                        </div>
                        {isRunning && (
                            <button type="button" className="fi-btn fi-btn-danger fi-btn-sm" onClick={handleStop}>
                                <Square size={11} /> Stop
                            </button>
                        )}
                    </div>

                    <div className="fi-progress-track">
                        <div className="fi-progress-bar" style={{ width: `${percent}%` }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--fi-text-muted)' }}>
                        <span>{job.processed} of {job.total} commitments processed ({percent}%)</span>
                        <span>Success: {job.succeeded} · Failures: {job.failed}</span>
                    </div>
                </div>
            )}

            {/* Three Clear Operations */}
            <div className="fi-operations-grid">
                {/* 1. Core State */}
                <div className="fi-op-card fi-op-card-highlight">
                    <div>
                        <h4 className="fi-op-title">Re-commit Core State</h4>
                        <p className="fi-op-desc">
                            Anchors question batches, exam papers, security events, and the 100 most recent results. Recommended for rapid recovery.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="fi-btn fi-btn-primary"
                        onClick={() => { setSelectedMode('core'); setConfirmModal(true); }}
                        disabled={isRunning || actionLoading || !fabricStatus?.connected}
                    >
                        {actionLoading && selectedMode === 'core' ? <Loader2 size={13} className="spin" /> : <Zap size={13} />}
                        Re-commit Core State
                    </button>
                </div>

                {/* 2. Full Ledger */}
                <div className="fi-op-card">
                    <div>
                        <h4 className="fi-op-title">Re-commit All Data</h4>
                        <p className="fi-op-desc">
                            Sequentially re-anchors every single document in MongoDB ({stats?.total || 0} total) to recreate the complete ledger history.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="fi-btn fi-btn-secondary"
                        onClick={() => { setSelectedMode('all'); setConfirmModal(true); }}
                        disabled={isRunning || actionLoading || !fabricStatus?.connected}
                    >
                        Re-commit All ({stats?.total || 0})
                    </button>
                </div>

                {/* 3. Sync Pending & Failed */}
                <div className="fi-op-card">
                    <div>
                        <h4 className="fi-op-title">Sync Pending & Failed</h4>
                        <p className="fi-op-desc">
                            Pushes records that are currently in PENDING or FAILED status without touching confirmed documents.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="fi-btn fi-btn-secondary"
                        onClick={() => handleStart('pending')}
                        disabled={isRunning || actionLoading || !fabricStatus?.connected || ((stats?.pending || 0) + (stats?.failed || 0) === 0)}
                    >
                        Sync Uncommitted ({(stats?.pending || 0) + (stats?.failed || 0)})
                    </button>
                </div>
            </div>

            {/* Reconnect Gateway Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: '13px', color: 'var(--fi-text-muted)' }}>Need fresh gRPC TLS credentials after network restart?</span>
                <button
                    type="button"
                    className="fi-btn fi-btn-secondary fi-btn-sm"
                    onClick={handleReconnect}
                    disabled={reconnectLoading || isRunning}
                >
                    <Network size={12} className={reconnectLoading ? 'spin' : ''} />
                    {reconnectLoading ? 'Reconnecting...' : 'Reconnect Gateway'}
                </button>
            </div>

            {/* Confirmation Dialog */}
            {confirmModal && (
                <div className="fi-modal-overlay" onClick={() => setConfirmModal(false)}>
                    <div className="fi-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="fi-modal-title">
                            <AlertTriangle size={18} style={{ color: 'var(--fi-amber)' }} />
                            Confirm Re-commit Operation
                        </div>
                        <div className="fi-modal-desc">
                            You are initiating a <strong>{selectedMode === 'core' ? 'Core State' : 'Full Ledger'}</strong> re-commit.
                            This resets the outbox tracking state and anchors document hashes onto the Fabric ledger.
                        </div>
                        <div className="fi-modal-actions">
                            <button type="button" className="fi-btn fi-btn-secondary" onClick={() => setConfirmModal(false)}>
                                Cancel
                            </button>
                            <button type="button" className="fi-btn fi-btn-primary" onClick={() => handleStart(selectedMode)}>
                                Start Re-commit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Main Fabric Integrity Center Dashboard
// =============================================================================
export default function FabricIntegrityCenter({ token, onOpenMockLab }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [visitedTabs, setVisitedTabs] = useState(() => new Set(['overview']));

    const switchTab = useCallback((tabId) => {
        setActiveTab(tabId);
        setVisitedTabs(prev => {
            if (prev.has(tabId)) return prev;
            const next = new Set(prev);
            next.add(tabId);
            return next;
        });
    }, []);

    // Initial States populated from cache for instant 0ms mount
    const [fabricStatus, setFabricStatus] = useState(() => getCachedData('/api/integrity/fabric-status', {}, token));
    const [ledgerHeight, setLedgerHeight] = useState(() => getCachedData('/api/integrity/ledger-height', {}, token));
    const [recentCommitments, setRecentCommitments] = useState(() => {
        const cached = getCachedData('/api/integrity/recent?limit=100', {}, token);
        return cached?.commitments || (Array.isArray(cached) ? cached : []);
    });
    const [totalCommitmentsCount, setTotalCommitmentsCount] = useState(() => {
        const heightData = getCachedData('/api/integrity/ledger-height', {}, token);
        const outbox = getCachedData('/api/integrity/outbox/stats', {}, token);
        return heightData?.totalCommitments || outbox?.total || null;
    });
    const [alertCount, setAlertCount] = useState(() => {
        const d = getCachedData('/api/integrity/alerts', {}, token);
        if (!d) return 0;
        return d.activeIncidents !== undefined ? d.activeIncidents : (d.alerts || []).filter(a => !a.isAcknowledged).length;
    });
    const [outboxStats, setOutboxStats] = useState(() => getCachedData('/api/integrity/outbox/stats', {}, token));
    const [loading, setLoading] = useState(() => !getCachedData('/api/integrity/fabric-status', {}, token));
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingCommitments, setLoadingCommitments] = useState(false);
    const [verifyEntityType, setVerifyEntityType] = useState('result');
    const [verifyEntityId, setVerifyEntityId] = useState('');
    const [dismissingBanner, setDismissingBanner] = useState(false);

    // Load Fabric status
    const loadStatus = useCallback(async (force = false) => {
        try {
            const [statusData, heightData] = await Promise.all([
                apiFetch('/fabric-status', token, { force }),
                apiFetch('/ledger-height', token, { force }),
            ]);
            setFabricStatus(statusData);
            setLedgerHeight(heightData);
            if (heightData?.totalCommitments !== undefined) {
                setTotalCommitmentsCount(heightData.totalCommitments);
            }
        } catch (_) { }
    }, [token]);

    // Load recent commitments
    const loadCommitments = useCallback(async (force = false) => {
        setLoadingCommitments(true);
        try {
            const data = await apiFetch('/recent?limit=100', token, { force });
            setRecentCommitments(data.commitments || []);
            if (data.totalCommitments !== undefined) {
                setTotalCommitmentsCount(data.totalCommitments);
            }
        } catch (_) {
            setRecentCommitments([]);
        } finally {
            setLoadingCommitments(false);
        }
    }, [token]);

    // Load alert count for badge & banner
    const loadAlertCount = useCallback(async (force = false) => {
        try {
            const data = await apiFetch('/alerts', token, { force });
            const active = data.activeIncidents !== undefined
                ? data.activeIncidents
                : (data.alerts || []).filter(a => !a.isAcknowledged).length;
            setAlertCount(active);
        } catch (_) { }
    }, [token]);

    // Load outbox stats
    const loadOutboxStats = useCallback(async (force = false) => {
        try {
            const data = await apiFetch('/outbox/stats', token, { force });
            setOutboxStats(data);
            if (data?.total !== undefined) {
                setTotalCommitmentsCount(prev => Math.max(prev || 0, data.total, data.confirmed || 0, data.ledgerHeight || 0));
            }
        } catch (_) { }
    }, [token]);

    const refreshAll = useCallback(async (isManual = false) => {
        if (isManual) setIsRefreshing(true);
        try {
            await Promise.allSettled([
                loadStatus(isManual),
                loadAlertCount(isManual),
                loadCommitments(isManual),
                loadOutboxStats(isManual),
            ]);
        } finally {
            setLoading(false);
            if (isManual) {
                setTimeout(() => setIsRefreshing(false), 400);
            }
        }
    }, [loadStatus, loadAlertCount, loadCommitments, loadOutboxStats]);

    const handleDismissBanner = async (e) => {
        if (e) e.stopPropagation();
        try {
            setDismissingBanner(true);
            await apiFetch('/alerts/dismiss', token, {
                method: 'POST',
                body: JSON.stringify({ dismissAll: true })
            });
            await loadAlertCount();
        } catch (err) {
            console.error('Failed to dismiss tamper alerts banner:', err);
        } finally {
            setDismissingBanner(false);
        }
    };

    useEffect(() => {
        refreshAll(false);
        const interval = setInterval(() => {
            loadStatus();
            loadAlertCount();
            loadOutboxStats();
        }, 15_000);
        return () => clearInterval(interval);
    }, [refreshAll, loadStatus, loadAlertCount, loadOutboxStats]);

    useEffect(() => {
        if (activeTab === 'commitments') {
            loadCommitments();
        }
    }, [activeTab, loadCommitments]);

    const handleQuickVerify = (commitment) => {
        if (!commitment) return;
        const typeMap = {
            RESULT_COMMITMENT: 'result',
            BATCH_COMMITMENT: 'batch',
            EXAM_COMMITMENT: 'exam',
            SECURITY_EVENT: 'event',
        };
        const mappedType = typeMap[commitment.eventType] || 'result';
        setVerifyEntityType(mappedType);
        setVerifyEntityId(commitment.entityId || commitment.id || '');
        switchTab('verify');
    };

    const isConnected = fabricStatus?.connected;
    const isEnabled = fabricStatus?.enabled;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
        { id: 'explorer', label: 'Blockchain Explorer', icon: <Layers size={14} /> },
        { id: 'recommit', label: 'Outbox & Re-commit', icon: <RefreshCw size={14} /> },
        { id: 'verify-ledger', label: 'Verify Ledger', icon: <ScanLine size={14} /> },
        { id: 'verify', label: 'Verify Entity', icon: <ShieldCheck size={14} /> },
        { id: 'commitments', label: 'Ledger', icon: <Database size={14} /> },
        {
            id: 'alerts',
            label: 'Tamper Alerts',
            icon: <BellRing size={14} />,
            badge: alertCount > 0 ? alertCount : null,
            badgeClass: alertCount > 0 ? 'fi-tab-badge-danger' : ''
        },
    ];

    return (
        <div className="fi-center">
            {/* ─── Compact Header ────────────────────────────────────────────── */}
            <div className="fi-page-header">
                <div className="fi-page-header-left">
                    <div className="fi-page-icon">
                        <Blocks size={20} />
                    </div>
                    <div>
                        <h1 className="fi-page-title">Fabric Integrity Center</h1>
                        <p className="fi-page-subtitle">Blockchain integrity and verification</p>
                    </div>
                </div>

                <div className="fi-page-header-right">
                    <div className="fi-env-badge">
                        <span className="fi-status-dot" style={{ background: 'var(--fi-amber)' }} />
                        DEV NETWORK
                    </div>

                    <button
                        type="button"
                        className="fi-btn fi-btn-secondary fi-btn-sm"
                        onClick={() => refreshAll(true)}
                        disabled={loading || isRefreshing}
                        title="Synchronize blockchain ledger status and metrics"
                    >
                        <RefreshCw size={12} className={(loading || isRefreshing) ? 'spin' : ''} />
                        {(loading || isRefreshing) ? 'Syncing...' : 'Sync Ledger'}
                    </button>

                    <StatusBadge status={
                        (loading || !fabricStatus) ? 'LOADING' :
                            !isEnabled ? 'FABRIC_DISABLED' :
                                isConnected ? 'CONNECTED' : 'DISCONNECTED'
                    } />

                    {onOpenMockLab && (
                        <button
                            type="button"
                            className="fi-btn fi-btn-secondary fi-btn-sm"
                            onClick={onOpenMockLab}
                            title="Open educational simulation sandbox"
                        >
                            <FlaskConical size={12} />
                            Mock Lab
                            <span className="fi-sim-badge">SIM</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Loading / Connecting Banner ────────────────────────────────── */}
            {loading}

            {/* ─── Live Tamper Incident Alert Banner ─────────────────────────── */}
            {alertCount > 0 && (
                <div
                    className="fi-critical-tamper-banner"
                    onClick={() => switchTab('alerts')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="fi-critical-tamper-left">
                        <span className="fi-tamper-pulse" />
                        <ShieldAlert size={18} style={{ color: 'var(--fi-red)' }} />
                        <div>
                            <div className="fi-critical-tamper-title">
                                {alertCount} Database Tampering Incident{alertCount !== 1 ? 's' : ''} Detected
                            </div>
                            <div className="fi-critical-tamper-desc">
                                Unauthorized MongoDB modifications caught by Change Stream — live hashes violate Fabric commitments.
                            </div>
                        </div>
                    </div>

                    <div className="fi-banner-actions" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            className="fi-btn fi-btn-danger fi-btn-sm"
                            onClick={() => switchTab('alerts')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            View Tamper Log <ArrowRight size={14} />
                        </button>
                        <button
                            type="button"
                            className="fi-btn fi-btn-ghost fi-btn-sm"
                            disabled={dismissingBanner}
                            onClick={handleDismissBanner}
                            title="Acknowledge alert and hide banner"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            {dismissingBanner ? 'Dismissing...' : <>Dismiss Alert <X size={14} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Navigation Tabs Bar ───────────────────────────────────────── */}
            <div className="fi-tabs-row">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`fi-tab ${activeTab === tab.id ? 'fi-tab-active' : ''}`}
                        onClick={() => switchTab(tab.id)}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge && (
                            <span className={`fi-tab-badge ${tab.badgeClass || ''}`}>{tab.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ─── Tab Content ───────────────────────────────────────────────── */}
            <div className="fi-tab-content">
                {/* 1. Overview Tab */}
                <div className={`fi-tab-panel ${activeTab === 'overview' ? 'active' : ''}`}>
                    <div>
                        {/* 4 Compact Summary Metrics */}
                        <div className="fi-metrics-strip">
                            <div className="fi-metric-item">
                                {loading ? (
                                    <span className="skeleton fi-metric-skeleton" />
                                ) : (
                                    <span className="fi-metric-value">{ledgerHeight?.height ?? '—'}</span>
                                )}
                                <span className="fi-metric-label">Ledger Height</span>
                            </div>
                            <div className="fi-metric-item">
                                {loading ? (
                                    <span className="skeleton fi-metric-skeleton" />
                                ) : (
                                    <span className="fi-metric-value">
                                        {totalCommitmentsCount ?? outboxStats?.total ?? outboxStats?.confirmed ?? ledgerHeight?.height ?? (recentCommitments?.length || '—')}
                                    </span>
                                )}
                                <span className="fi-metric-label">Total Commitments</span>
                            </div>
                            <div className="fi-metric-item">
                                {loading ? (
                                    <span className="skeleton fi-metric-skeleton" />
                                ) : (
                                    <span className="fi-metric-value">{outboxStats?.pending ?? 0}</span>
                                )}
                                <span className="fi-metric-label">Pending Outbox Events</span>
                            </div>
                            <div className={`fi-metric-item ${alertCount > 0 ? 'fi-metric-danger' : ''}`}>
                                {loading ? (
                                    <span className="skeleton fi-metric-skeleton" />
                                ) : (
                                    <span className="fi-metric-value">{alertCount}</span>
                                )}
                                <span className="fi-metric-label">Tamper Alerts</span>
                            </div>
                        </div>

                        {/* Fabric Network Status Definition List */}
                        <div className="fi-card">
                            <div className="fi-card-header">
                                <div className="fi-card-title-row">
                                    <Network size={16} style={{ color: (loading || !fabricStatus) ? 'var(--fi-blue)' : isConnected ? 'var(--fi-green)' : 'var(--fi-text-muted)' }} />
                                    <h3>Fabric Network Status</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <StatusBadge status={(loading || !fabricStatus) ? 'LOADING' : isConnected ? 'CONNECTED' : isEnabled ? 'DISCONNECTED' : 'FABRIC_DISABLED'} />
                                </div>
                            </div>

                            <div className="fi-card-body">
                                {loading ? (
                                    <div className="fi-meta-grid">
                                        {[
                                            { label: 'Connection', width: 130 },
                                            { label: 'Channel', width: 140 },
                                            { label: 'Chaincode', width: 110 },
                                            { label: 'MSP ID', width: 80 },
                                            { label: 'Endorsing Peer', width: 135 },
                                            { label: 'Consensus Protocol', width: 115 }
                                        ].map((item, idx) => (
                                            <div key={idx} className="fi-meta-item">
                                                <span className="fi-meta-label">{item.label}</span>
                                                <span className="skeleton fi-meta-skeleton" style={{ width: item.width }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="fi-meta-grid">
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Connection</span>
                                            <span className="fi-meta-val" style={{ color: isConnected ? 'var(--fi-green)' : 'var(--fi-red)' }}>
                                                {isConnected ? 'Connected to Peer' : 'Disconnected'}
                                            </span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Channel</span>
                                            <span className="fi-meta-val">{fabricStatus?.channel || 'zeroleak-channel'}</span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Chaincode</span>
                                            <span className="fi-meta-val">{fabricStatus?.chaincode || 'zeroleak'} v1.0</span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">MSP ID</span>
                                            <span className="fi-meta-val">{fabricStatus?.mspId || 'Org1MSP'}</span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Endorsing Peer</span>
                                            <span className="fi-meta-val">{fabricStatus?.peerEndpoint || 'localhost:7051'}</span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Consensus Protocol</span>
                                            <span className="fi-meta-val">Raft (etcdraft)</span>
                                        </div>
                                    </div>
                                )}

                                {/* Architecture Flow */}
                                <div className="fi-arch-section">
                                    <div className="fi-arch-title">Integrity Architecture Pipeline</div>
                                    <div className="fi-arch-flow">
                                        <div className="fi-arch-node">
                                            <span className="fi-arch-node-title"><Database size={13} /> MongoDB</span>
                                            <span className="fi-arch-node-desc">Source of truth for batches, exams & results</span>
                                        </div>
                                        <div className="fi-arch-node">
                                            <span className="fi-arch-node-title"><Hash size={13} /> SHA-256</span>
                                            <span className="fi-arch-node-desc">Cryptographic digest generated on mutation</span>
                                        </div>
                                        <div className="fi-arch-node">
                                            <span className="fi-arch-node-title"><RefreshCw size={13} /> Outbox</span>
                                            <span className="fi-arch-node-desc">Atomic queue guaranteeing delivery</span>
                                        </div>
                                        <div className="fi-arch-node">
                                            <span className="fi-arch-node-title"><Network size={13} /> Gateway</span>
                                            <span className="fi-arch-node-desc">gRPC client with mutual TLS credentials</span>
                                        </div>
                                        <div className="fi-arch-node">
                                            <span className="fi-arch-node-title"><Blocks size={13} /> Fabric Ledger</span>
                                            <span className="fi-arch-node-desc">Immutable distributed state and block history</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Blockchain Explorer Tab */}
                {visitedTabs.has('explorer') && (
                    <div className={`fi-tab-panel ${activeTab === 'explorer' ? 'active' : ''}`}>
                        <FabricBlockchainVisualizer token={token} onVerifyEntity={handleQuickVerify} />
                    </div>
                )}

                {/* 3. Outbox & Re-commit Tab */}
                {visitedTabs.has('recommit') && (
                    <div className={`fi-tab-panel ${activeTab === 'recommit' ? 'active' : ''}`}>
                        <OutboxRecommitPanel
                            token={token}
                            fabricStatus={fabricStatus}
                            ledgerHeight={ledgerHeight}
                            onRefreshStatus={() => {
                                loadStatus();
                                loadCommitments();
                                loadOutboxStats();
                            }}
                            onNavigateTab={switchTab}
                        />
                    </div>
                )}

                {/* 4. Verify Ledger Tab */}
                {visitedTabs.has('verify-ledger') && (
                    <div className={`fi-tab-panel ${activeTab === 'verify-ledger' ? 'active' : ''}`}>
                        <VerifyLedgerPanel token={token} />
                    </div>
                )}

                {/* 5. Verify Entity Tab */}
                {visitedTabs.has('verify') && (
                    <div className={`fi-tab-panel ${activeTab === 'verify' ? 'active' : ''}`}>
                        <VerificationPanel
                            token={token}
                            entityType={verifyEntityType}
                            setEntityType={setVerifyEntityType}
                            entityId={verifyEntityId}
                            setEntityId={setVerifyEntityId}
                        />
                    </div>
                )}

                {/* 6. Ledger Commitments Tab */}
                {visitedTabs.has('commitments') && (
                    <div className={`fi-tab-panel ${activeTab === 'commitments' ? 'active' : ''}`}>
                        <div className="fi-card">
                            <div className="fi-card-header">
                                <div className="fi-card-title-row">
                                    <Database size={16} style={{ color: 'var(--fi-blue)' }} />
                                    <h3>Fabric Ledger Commitments</h3>
                                </div>
                                <button className="fi-refresh-btn" onClick={loadCommitments} disabled={loadingCommitments}>
                                    <RefreshCw size={12} className={loadingCommitments ? 'spin' : ''} />
                                </button>
                            </div>
                            <div className="fi-card-body" style={{ padding: 0 }}>
                                <RecentCommitmentsTable
                                    commitments={recentCommitments}
                                    loading={loadingCommitments}
                                    onVerify={handleQuickVerify}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. Tamper Alerts Tab */}
                {visitedTabs.has('alerts') && (
                    <div className={`fi-tab-panel ${activeTab === 'alerts' ? 'active' : ''}`}>
                        <TamperAlertsPanel token={token} onAlertsUpdated={loadAlertCount} />
                    </div>
                )}
            </div>
        </div>
    );
}
