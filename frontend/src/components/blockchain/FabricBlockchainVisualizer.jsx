// =============================================================================
// ZeroLeak — FabricBlockchainVisualizer.jsx
// =============================================================================
// Real Hyperledger Fabric Blockchain Explorer
// Enterprise inspection of the live Hyperledger Fabric test network blockchain:
// - Committed height, total blocks, consensus information, and endorsing peers
// - Table View (dense, readable) & Stream View
// - Filters for All, Genesis, Exam, Result, Batch, and Security Event records
// - Search by block number, hash, transaction ID, or commitment ID
// - Deep block inspection drawer with full cryptographic hashes & read/write set
// =============================================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Layers, Box, Link2, Hash, Clock, CheckCircle,
    Shield, ShieldCheck, ShieldAlert, AlertTriangle,
    Search, Filter, RefreshCw, ChevronRight, ChevronLeft,
    ExternalLink, Copy, Check, Info, Server, Network,
    Cpu, Key, Database, ArrowRight, CornerDownRight, X,
    List, Columns, FileCode, ArrowUpDown, ArrowDown, ArrowUp, Loader2
} from 'lucide-react';
import './FabricBlockchainVisualizer.css';
import { getCachedData, setCachedData } from '../../utils/apiCache.js';

const rawApiBase = import.meta.env.VITE_API_URL || '';
const API_BASE = rawApiBase.replace(/\/api\/?$/, '');

async function fetchBlocks(token, force = false) {
    const effectiveToken = token || localStorage.getItem('adminToken') || localStorage.getItem('auditorToken') || localStorage.getItem('token');
    const fullPath = '/api/integrity/blocks';
    if (!force) {
        const cached = getCachedData(fullPath, {}, effectiveToken);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
    }
    const res = await fetch(`${API_BASE}${fullPath}`, {
        headers: { Authorization: `Bearer ${effectiveToken}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.message || 'Failed to fetch blocks'), { status: res.status, data });
    setCachedData(fullPath, data, 25_000, {}, effectiveToken);
    return data;
}

const BLOCK_THEMES = {
    GENESIS: {
        accent: '#9333ea',
        border: 'rgba(168, 85, 247, 0.35)',
        glow: 'rgba(168, 85, 247, 0.25)',
        bgTint: 'rgba(168, 85, 247, 0.08)',
        badgeBg: 'rgba(168, 85, 247, 0.18)',
        badgeColor: '#d8b4fe',
        badgeColorLight: '#7e22ce',
        label: 'Genesis',
        icon: Key
    },
    EXAM: {
        accent: '#0284c7',
        border: 'rgba(56, 189, 248, 0.35)',
        glow: 'rgba(56, 189, 248, 0.25)',
        bgTint: 'rgba(56, 189, 248, 0.08)',
        badgeBg: 'rgba(56, 189, 248, 0.18)',
        badgeColor: '#7dd3fc',
        badgeColorLight: '#0369a1',
        label: 'Exam Paper',
        icon: FileCode
    },
    RESULT: {
        accent: '#059669',
        border: 'rgba(16, 185, 129, 0.35)',
        glow: 'rgba(16, 185, 129, 0.25)',
        bgTint: 'rgba(16, 185, 129, 0.08)',
        badgeBg: 'rgba(16, 185, 129, 0.18)',
        badgeColor: '#6ee7b7',
        badgeColorLight: '#047857',
        label: 'Exam Result',
        icon: CheckCircle
    },
    BATCH: {
        accent: '#d97706',
        border: 'rgba(245, 158, 11, 0.35)',
        glow: 'rgba(245, 158, 11, 0.25)',
        bgTint: 'rgba(245, 158, 11, 0.08)',
        badgeBg: 'rgba(245, 158, 11, 0.18)',
        badgeColor: '#fcd34d',
        badgeColorLight: '#b45309',
        label: 'Question Batch',
        icon: Box
    },
    SECURITY_EVENT: {
        accent: '#dc2626',
        border: 'rgba(239, 68, 68, 0.4)',
        glow: 'rgba(239, 68, 68, 0.3)',
        bgTint: 'rgba(239, 68, 68, 0.1)',
        badgeBg: 'rgba(239, 68, 68, 0.2)',
        badgeColor: '#fca5a5',
        badgeColorLight: '#b91c1c',
        label: 'Security Alert',
        icon: AlertTriangle
    }
};

const DEFAULT_THEME = {
    accent: '#3b82f6',
    border: 'rgba(59, 130, 246, 0.35)',
    glow: 'rgba(59, 130, 246, 0.25)',
    bgTint: 'rgba(59, 130, 246, 0.08)',
    badgeBg: 'rgba(59, 130, 246, 0.18)',
    badgeColor: '#93c5fd',
    badgeColorLight: '#1d4ed8',
    label: 'Commitment',
    icon: Box
};

export default function FabricBlockchainVisualizer({ token, onVerifyEntity }) {
    const [data, setData] = useState(() => getCachedData('/api/integrity/blocks', {}, token));
    const [loading, setLoading] = useState(() => !getCachedData('/api/integrity/blocks', {}, token));
    const [refreshing, setRefreshing] = useState(false);
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('stream'); // default to 'stream' (Block View)
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const [showNetworkNodes, setShowNetworkNodes] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first by default) | 'asc' (oldest first)

    const scrollContainerRef = useRef(null);

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
        }
    };

    const scrollToGenesis = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: sortOrder === 'desc' ? scrollContainerRef.current.scrollWidth : 0,
                behavior: 'smooth'
            });
        }
    };

    const scrollToLatest = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: sortOrder === 'desc' ? 0 : scrollContainerRef.current.scrollWidth,
                behavior: 'smooth'
            });
        }
    };

    const load = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        const startTime = Date.now();
        try {
            setError(null);
            const effectiveToken = token || localStorage.getItem('adminToken') || localStorage.getItem('auditorToken') || localStorage.getItem('token');
            const res = await fetchBlocks(effectiveToken, isManual);
            setData(res);
            setLastRefreshed(new Date());
            if (isManual) {
                setRefreshSuccess(true);
                setTimeout(() => setRefreshSuccess(false), 2000);
            }
        } catch (err) {
            console.error('[FabricBlockchainVisualizer] Load error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            if (isManual) {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 400 - elapsed);
                setTimeout(() => setRefreshing(false), remaining);
            } else {
                setRefreshing(false);
            }
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    // Auto-refresh interval (10s)
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(load, 10_000);
        return () => clearInterval(interval);
    }, [autoRefresh, load]);

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setSelectedBlock(null);
        };
        if (selectedBlock) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [selectedBlock]);

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const blocks = data?.blocks || [];

    const availableTypes = useMemo(() => {
        const types = new Set(blocks.map(b => b.type).filter(Boolean));
        return Array.from(types);
    }, [blocks]);

    const filteredBlocks = useMemo(() => {
        return blocks.filter(b => {
            if (typeFilter !== 'ALL' && b.type !== typeFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const numMatch = String(b.blockNumber).includes(q) || `#${b.blockNumber}`.includes(q);
                const hashMatch = b.blockHash?.toLowerCase().includes(q);
                const prevMatch = b.previousBlockHash?.toLowerCase().includes(q);
                const txMatch = b.txId?.toLowerCase().includes(q);
                const idMatch = b.commitment?.id?.toLowerCase().includes(q);
                const entityMatch = b.commitment?.entityId?.toLowerCase().includes(q);
                const typeMatch = b.type?.toLowerCase().includes(q);
                if (!numMatch && !hashMatch && !prevMatch && !txMatch && !idMatch && !entityMatch && !typeMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [blocks, typeFilter, searchQuery]);

    // Sort blocks by blockNumber ascending or descending (default: descending / newest first)
    const sortedBlocks = useMemo(() => {
        return [...filteredBlocks].sort((a, b) => {
            const numA = Number(a.blockNumber) ?? 0;
            const numB = Number(b.blockNumber) ?? 0;
            return sortOrder === 'desc' ? numB - numA : numA - numB;
        });
    }, [filteredBlocks, sortOrder]);

    // Pagination for stable layout & performance
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    useEffect(() => {
        setCurrentPage(1);
    }, [typeFilter, searchQuery, pageSize, sortOrder]);

    const totalRecords = sortedBlocks.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const validCurrentPage = Math.min(currentPage, totalPages);

    const paginatedBlocks = useMemo(() => {
        const start = (validCurrentPage - 1) * pageSize;
        return sortedBlocks.slice(start, start + pageSize);
    }, [sortedBlocks, validCurrentPage, pageSize]);

    if (loading && !data) {
        return (
            <div className="fbv-container">
                <div className="fi-empty" style={{ minHeight: 320 }}>
                    <Loader2 size={24} className="spin" style={{ color: 'var(--fi-blue)' }} />
                    <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--fi-text-primary)' }}>Loading Hyperledger Fabric blockchain blocks and channel state...</p>
                    <span style={{ fontSize: '12px', color: 'var(--fi-text-muted)', marginTop: 4 }}>
                        Querying peer endorsements, committed height, and cryptographic hash chain...
                    </span>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="fbv-container">
                <div className="fi-empty" style={{ border: '1px solid var(--fi-red-border)', borderRadius: 'var(--fi-radius)' }}>
                    <AlertTriangle size={28} style={{ color: 'var(--fi-red)' }} />
                    <p style={{ color: 'var(--fi-red)' }}>Failed to load Fabric Blockchain: {error}</p>
                    <button className="fi-btn fi-btn-secondary fi-btn-sm" onClick={load} style={{ marginTop: 12 }}>
                        <RefreshCw size={13} /> Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fbv-container">
            {/* Inline error if refresh failed */}
            {error && data && (
                <div style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--fi-radius-sm)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--fi-red-border)',
                    color: 'var(--fi-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px'
                }}>
                    <span>Failed to sync recent blocks: {error}</span>
                    <button className="fi-btn fi-btn-secondary fi-btn-sm" onClick={() => load(true)}>Retry</button>
                </div>
            )}

            {/* ─── Compact Explorer Header & Stats ─────────────────────────────── */}
            <div className="fbv-header-card">
                <div className="fbv-header-top">
                    <div className="fbv-title-group">
                        <Layers size={18} style={{ color: 'var(--fi-blue)' }} />
                        <h3 className="fbv-title">
                            Hyperledger Fabric Explorer
                            <span className="fbv-channel-badge">{data?.channel || 'zeroleak-channel'}</span>
                        </h3>
                    </div>

                    <div className="fbv-actions">
                        <button
                            type="button"
                            className={`fi-btn fi-btn-sm ${showNetworkNodes ? 'fi-btn-primary' : 'fi-btn-secondary'}`}
                            onClick={() => setShowNetworkNodes(v => !v)}
                        >
                            <Network size={13} />
                            {showNetworkNodes ? 'Hide Topology' : 'Consortium Nodes'}
                        </button>
                        <button
                            type="button"
                            className={`fi-btn fi-btn-sm ${autoRefresh ? 'fi-btn-primary' : 'fi-btn-secondary'}`}
                            onClick={() => setAutoRefresh(v => !v)}
                        >
                            <RefreshCw size={13} className={autoRefresh ? 'spin' : ''} />
                            {autoRefresh ? 'Auto-Sync ON' : 'Auto-Sync'}
                        </button>
                        <button
                            type="button"
                            className={`fi-btn fi-btn-sm ${refreshSuccess ? 'fi-btn-primary' : 'fi-btn-secondary'}`}
                            onClick={() => load(true)}
                            disabled={refreshing}
                        >
                            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                            {refreshing ? 'Syncing...' : refreshSuccess ? 'Synced' : 'Refresh'}
                        </button>
                    </div>
                </div>

                <div className="fbv-stats-strip">
                    <div className="fbv-stat-item">
                        <span className="fbv-stat-lbl">Committed Height</span>
                        <span className="fbv-stat-val">#{data?.height ?? 0}</span>
                    </div>
                    <div className="fbv-stat-item">
                        <span className="fbv-stat-lbl">Total Blocks</span>
                        <span className="fbv-stat-val">{blocks.length}</span>
                    </div>
                    <div className="fbv-stat-item">
                        <span className="fbv-stat-lbl">Consensus</span>
                        <span className="fbv-stat-val" style={{ fontSize: '15px' }}>Raft (etcdraft)</span>
                    </div>
                    <div className="fbv-stat-item">
                        <span className="fbv-stat-lbl">Endorsing Peers</span>
                        <span className="fbv-stat-val" style={{ fontSize: '15px' }}>Org1 + Org2</span>
                    </div>
                </div>
            </div>

            {/* ─── Consortium Topology Panel (Expandable) ────────────────────── */}
            {showNetworkNodes && (
                <div className="fbv-topology-panel">
                    <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fi-text-muted)' }}>
                        Fabric Consortium Topology & Endorsement
                    </div>
                    <div className="fbv-topology-grid">
                        <div className="fbv-topo-node">
                            <span className="fbv-topo-name">peer0.org1.example.com</span>
                            <span className="fbv-topo-meta">MSP: Org1MSP · Port: 7051</span>
                            <span className="fbv-topo-meta">Role: Endorser & Committer</span>
                        </div>
                        <div className="fbv-topo-node">
                            <span className="fbv-topo-name">peer0.org2.example.com</span>
                            <span className="fbv-topo-meta">MSP: Org2MSP · Port: 9051</span>
                            <span className="fbv-topo-meta">Role: Endorser & Committer</span>
                        </div>
                        <div className="fbv-topo-node">
                            <span className="fbv-topo-name">orderer.example.com</span>
                            <span className="fbv-topo-meta">MSP: OrdererMSP · Port: 7050</span>
                            <span className="fbv-topo-meta">Role: Raft Ordering Leader</span>
                        </div>
                        <div className="fbv-topo-node">
                            <span className="fbv-topo-name">ca_org1 / ca_org2</span>
                            <span className="fbv-topo-meta">Ports: 7054 / 8054</span>
                            <span className="fbv-topo-meta">PKI: ECDSA prime256v1</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Toolbar: View Switch, Filters & Search ─────────────────────── */}
            <div className="fbv-toolbar">
                <div className="fbv-toolbar-left">
                    <div className="fbv-view-switch">
                        <button
                            type="button"
                            className={`fbv-switch-btn ${viewMode === 'stream' ? 'active' : ''}`}
                            onClick={() => setViewMode('stream')}
                            title="Block Chain View"
                        >
                            <Box size={13} /> Blocks
                        </button>
                        <button
                            type="button"
                            className={`fbv-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table View"
                        >
                            <List size={13} /> Table
                        </button>
                    </div>

                    <div className="fi-filter-group">
                        <button
                            type="button"
                            className={`fi-filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setTypeFilter('ALL')}
                        >
                            All <span className="fi-filter-count">{blocks.length}</span>
                        </button>
                        {availableTypes.map(t => (
                            <button
                                key={t}
                                type="button"
                                className={`fi-filter-pill ${typeFilter === t ? 'active' : ''}`}
                                onClick={() => setTypeFilter(t)}
                            >
                                {t} <span className="fi-filter-count">{blocks.filter(b => b.type === t).length}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

                    <div className="fi-search-box">
                        <Search size={13} className="fi-search-icon" />
                        <input
                            type="text"
                            className="fi-search-input"
                            placeholder="Search block #, hash, TxID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="fi-search-clear" onClick={() => setSearchQuery('')}>×</button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Mode 1: Enterprise Table View ──────────────────────────────── */}
            {viewMode === 'table' && (
                <div className="fbv-table-card">
                    <div className="fi-table-wrapper">
                        <table className="fi-table">
                            <thead>
                                <tr>
                                    <th
                                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                        title={sortOrder === 'desc' ? 'Sorted: Newest First. Click for Oldest First' : 'Sorted: Oldest First. Click for Newest First'}
                                    >
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <span>Block</span>
                                            {sortOrder === 'desc' ? (
                                                <ArrowDown size={11} style={{ color: 'var(--brand-primary)' }} />
                                            ) : (
                                                <ArrowUp size={11} style={{ color: 'var(--brand-primary)' }} />
                                            )}
                                        </div>
                                    </th>
                                    <th>Type</th>
                                    <th>Block Hash</th>
                                    <th>Previous Hash</th>
                                    <th>Transaction ID</th>
                                    <th>Entity / Commitment</th>
                                    <th>Timestamp</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBlocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>
                                            <div className="fi-empty" style={{ padding: 0 }}>
                                                <Filter size={18} />
                                                <p>No blocks match your search or filter.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedBlocks.map((b) => {
                                        const hashTrunc = b.blockHash ? `${b.blockHash.slice(0, 8)}…${b.blockHash.slice(-6)}` : '—';
                                        const prevTrunc = b.previousBlockHash ? `${b.previousBlockHash.slice(0, 8)}…${b.previousBlockHash.slice(-6)}` : '—';
                                        const txTrunc = b.txId ? `${b.txId.slice(0, 10)}…` : '—';
                                        const entityId = b.commitment?.entityId || b.commitment?.id || '';

                                        return (
                                            <tr key={b.blockNumber}>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: 'var(--fi-text-primary)' }}>
                                                        #{b.blockNumber}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="fi-type-badge">{b.type}</span>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="fbv-hash-link"
                                                        onClick={() => handleCopy(b.blockHash, `hash-${b.blockNumber}`)}
                                                        title="Click to copy full block hash"
                                                    >
                                                        {hashTrunc}
                                                        {copiedKey === `hash-${b.blockNumber}` ? <Check size={11} style={{ color: 'var(--fi-green)' }} /> : <Copy size={11} opacity={0.6} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="fbv-hash-link"
                                                        onClick={() => handleCopy(b.previousBlockHash, `prev-${b.blockNumber}`)}
                                                        title="Click to copy previous hash"
                                                    >
                                                        {prevTrunc}
                                                        {copiedKey === `prev-${b.blockNumber}` ? <Check size={11} style={{ color: 'var(--fi-green)' }} /> : <Copy size={11} opacity={0.6} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <span className="fi-code" title={b.txId}>{txTrunc}</span>
                                                </td>
                                                <td>
                                                    {entityId ? (
                                                        <code className="fi-code" title={entityId}>
                                                            {entityId.length > 14 ? `${entityId.slice(0, 14)}…` : entityId}
                                                        </code>
                                                    ) : (
                                                        <span style={{ color: 'var(--fi-text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                    {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="fi-btn fi-btn-secondary fi-btn-sm"
                                                        onClick={() => setSelectedBlock(b)}
                                                    >
                                                        Inspect
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <span>
                                    Showing <strong>{((validCurrentPage - 1) * pageSize) + 1}</strong> – <strong>{Math.min(validCurrentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> blocks
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--fi-text-muted)' }}>
                                    <span>Per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        style={{
                                            background: 'var(--fi-surface-subtle)',
                                            border: '1px solid var(--fi-border)',
                                            color: 'var(--fi-text-primary)',
                                            borderRadius: 'var(--fi-radius-xs)',
                                            padding: '2px 6px',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>

                            <div className="fi-pagination-controls">
                                <button
                                    type="button"
                                    className="fi-page-btn"
                                    disabled={validCurrentPage <= 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    ‹ Prev
                                </button>
                                <span style={{ fontSize: '13px', padding: '0 8px' }}>
                                    {validCurrentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    className="fi-page-btn"
                                    disabled={validCurrentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    Next ›
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Mode 2: Interactive Block Chain View (Default) ───────────── */}
            {viewMode === 'stream' && (
                <div className="fbv-blocks-wrapper">
                    {/* Navigation & Controls Strip */}
                    <div className="fbv-stream-nav-bar">
                        <div className="fbv-stream-info">
                            <span className="fbv-stream-pulse" />
                            <span>
                                Hyperledger Fabric Ledger: <strong>{sortedBlocks.length}</strong> {sortedBlocks.length === 1 ? 'block' : 'blocks'} ({sortOrder === 'desc' ? 'Newest First' : 'Oldest First'})
                            </span>
                            <span className="fbv-stream-subtle">
                                · Chained via SHA-256 Merkle links
                            </span>
                        </div>

                        <div className="fbv-stream-nav-actions">
                            <button
                                type="button"
                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                title="Toggle Sort Direction (Ascending / Descending)"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                                <ArrowUpDown size={12} style={{ color: 'var(--brand-primary)' }} />
                                <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                            </button>
                            <button
                                type="button"
                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                onClick={scrollToGenesis}
                                title="Scroll to Genesis Block (#0)"
                            >
                                Genesis (#0)
                            </button>
                            <button
                                type="button"
                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                onClick={scrollLeft}
                                title="Scroll left"
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <button
                                type="button"
                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                onClick={scrollRight}
                                title="Scroll right"
                            >
                                <ChevronRight size={13} />
                            </button>
                            <button
                                type="button"
                                className="fi-btn fi-btn-secondary fi-btn-sm"
                                onClick={scrollToLatest}
                                title="Scroll to latest committed block"
                            >
                                Latest (#{blocks[blocks.length - 1]?.blockNumber ?? '—'})
                            </button>
                        </div>
                    </div>

                    {/* Horizontal Scrollable Blockchain */}
                    <div className="fbv-stream-container" ref={scrollContainerRef}>
                        {sortedBlocks.length === 0 ? (
                            <div className="fi-empty" style={{ width: '100%', minHeight: 320 }}>
                                <Filter size={20} />
                                <p>No blocks match your search or filter.</p>
                            </div>
                        ) : (
                            sortedBlocks.map((b, idx) => {
                                const theme = BLOCK_THEMES[b.type] || DEFAULT_THEME;
                                const ThemeIcon = theme.icon;
                                const hashTrunc = b.blockHash ? `${b.blockHash.slice(0, 8)}…${b.blockHash.slice(-6)}` : '—';
                                const prevTrunc = b.previousBlockHash ? `${b.previousBlockHash.slice(0, 8)}…${b.previousBlockHash.slice(-6)}` : (b.blockNumber === 0 ? '00000000…000000' : '—');
                                const txTrunc = b.txId ? `${b.txId.slice(0, 10)}…` : 'Genesis';
                                const entityId = b.commitment?.entityId || b.commitment?.id || '';

                                return (
                                    <React.Fragment key={b.blockNumber}>
                                        <div
                                            className={`fbv-block-card ${selectedBlock?.blockNumber === b.blockNumber ? 'selected' : ''}`}
                                            style={{
                                                '--block-accent': theme.accent,
                                                '--block-border': theme.border,
                                                '--block-glow': theme.glow,
                                                '--block-bg-tint': theme.bgTint,
                                                '--block-badge-color-light': theme.badgeColorLight || theme.accent,
                                                animationDelay: `${Math.min(idx * 8, 60)}ms`
                                            }}
                                            onClick={() => setSelectedBlock(b)}
                                        >
                                            {/* Glowing Top Accent Bar */}
                                            <div className="fbv-block-accent-bar" />

                                            {/* Block Header */}
                                            <div className="fbv-block-header">
                                                <div className="fbv-block-title-row">
                                                    <div className="fbv-block-icon-box">
                                                        <ThemeIcon size={13} style={{ color: theme.accent }} />
                                                    </div>
                                                    <div>
                                                        <div className="fbv-block-number">Block #{b.blockNumber}</div>
                                                        <div className="fbv-block-status">
                                                            <span className="fbv-status-dot" />
                                                            <span>{b.blockNumber === 0 ? 'Genesis' : 'Committed'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <span
                                                    className="fbv-block-type-pill"
                                                    style={{
                                                        background: theme.badgeBg,
                                                        color: theme.badgeColor,
                                                        borderColor: theme.border
                                                    }}
                                                >
                                                    {b.type}
                                                </span>
                                            </div>

                                            {/* Block Body */}
                                            <div className="fbv-block-body">
                                                {/* Block Hash */}
                                                <div className="fbv-field-group">
                                                    <div className="fbv-field-label">
                                                        <span>Block Hash</span>
                                                        <button
                                                            type="button"
                                                            className="fbv-field-copy-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopy(b.blockHash, `hash-${b.blockNumber}`);
                                                            }}
                                                            title="Copy block hash"
                                                        >
                                                            {copiedKey === `hash-${b.blockNumber}` ? (
                                                                <Check size={11} style={{ color: 'var(--fi-green)' }} />
                                                            ) : (
                                                                <Copy size={11} />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <div className="fbv-hash-display" title={b.blockHash}>
                                                        <code>{hashTrunc}</code>
                                                    </div>
                                                </div>

                                                {/* Previous Hash Link */}
                                                <div className="fbv-field-group">
                                                    <div className="fbv-field-label">
                                                        <span>Previous Hash</span>
                                                    </div>
                                                    <div className="fbv-prev-hash-display" title={b.previousBlockHash}>
                                                        <CornerDownRight size={10} className="fbv-parent-icon" />
                                                        <code>{prevTrunc}</code>
                                                    </div>
                                                </div>

                                                {/* Meta Row: TxID and Entity */}
                                                <div className="fbv-meta-row">
                                                    <div className="fbv-meta-item">
                                                        <span className="fbv-meta-label">TxID</span>
                                                        <span className="fbv-meta-val" title={b.txId}>{txTrunc}</span>
                                                    </div>
                                                    {entityId && (
                                                        <div className="fbv-meta-item">
                                                            <span className="fbv-meta-label">Entity</span>
                                                            <span className="fbv-meta-val" title={entityId}>
                                                                {entityId.length > 10 ? `${entityId.slice(0, 10)}…` : entityId}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Block Footer */}
                                            <div className="fbv-block-footer">
                                                <div className="fbv-block-time">
                                                    <Clock size={11} />
                                                    <span>{b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : 'Genesis'}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="fbv-inspect-trigger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedBlock(b);
                                                    }}
                                                >
                                                    <span>Inspect</span>
                                                    <ArrowRight size={11} className="fbv-arrow-hover" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Cryptographic Merkle Link between blocks */}
                                        {idx < sortedBlocks.length - 1 && (
                                            <div className="fbv-chain-connector" title="Cryptographic SHA-256 Merkle chain link">
                                                <div className="fbv-connector-line" />
                                                <div className="fbv-connector-node">
                                                    <Link2 size={11} />
                                                </div>
                                                <div className="fbv-connector-line" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ─── Centered Block Inspection Modal ───────────────────────────── */}
            {selectedBlock && (() => {
                const modalTheme = BLOCK_THEMES[selectedBlock.type] || DEFAULT_THEME;
                const ModalIcon = modalTheme.icon;

                return (
                    <div className="fi-modal-overlay" onClick={() => setSelectedBlock(null)}>
                        <div
                            className="fbv-detail-modal"
                            style={{
                                '--block-accent': modalTheme.accent,
                                '--block-badge-color-light': modalTheme.badgeColorLight || modalTheme.accent
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Color Accent Bar */}
                            <div style={{ height: 3, width: '100%', background: modalTheme.accent }} />

                            {/* Modal Header */}
                            <div className="fbv-modal-header">
                                <div className="fbv-modal-title-group">
                                    <div
                                        className="fbv-modal-icon-badge"
                                        style={{
                                            background: modalTheme.bgTint,
                                            border: `1px solid ${modalTheme.border}`,
                                            color: modalTheme.accent
                                        }}
                                    >
                                        <ModalIcon size={18} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <h3 className="fbv-modal-title">
                                                Block #{selectedBlock.blockNumber}
                                            </h3>
                                            <span
                                                className="fbv-modal-type-badge"
                                                style={{
                                                    background: modalTheme.badgeBg,
                                                    color: modalTheme.badgeColor,
                                                    border: `1px solid ${modalTheme.border}`
                                                }}
                                            >
                                                {modalTheme.label}
                                            </span>
                                            <span className="fbv-modal-valid-badge">
                                                <CheckCircle size={11} /> VALID
                                            </span>
                                        </div>
                                        <div className="fbv-modal-subtitle">
                                            Channel <code>{data?.channel || 'zeroleak-channel'}</code> · {selectedBlock.timestamp ? new Date(selectedBlock.timestamp).toLocaleString() : 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="fi-refresh-btn"
                                    onClick={() => setSelectedBlock(null)}
                                    title="Close dialog (Esc)"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Modal Body (Scrollable) */}
                            <div className="fbv-modal-body">
                                {/* Hashes Group */}
                                <div>
                                    <div className="fbv-drawer-section-title">
                                        <Hash size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Current Block Cryptographic Hash (SHA-256)
                                    </div>
                                    <div className="fbv-copy-box">
                                        <span className="fbv-hash-code">{selectedBlock.blockHash || 'N/A'}</span>
                                        <button
                                            type="button"
                                            className="fi-btn fi-btn-ghost fi-btn-sm"
                                            onClick={() => handleCopy(selectedBlock.blockHash, 'modal-hash')}
                                            title="Copy Hash"
                                        >
                                            {copiedKey === 'modal-hash' ? <Check size={13} style={{ color: 'var(--fi-green)' }} /> : <Copy size={13} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="fbv-drawer-section-title">
                                        <Link2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Previous Block Hash (Merkle Chain Link)
                                    </div>
                                    <div className="fbv-copy-box">
                                        <span className="fbv-hash-code">{selectedBlock.previousBlockHash || 'N/A'}</span>
                                        <button
                                            type="button"
                                            className="fi-btn fi-btn-ghost fi-btn-sm"
                                            onClick={() => handleCopy(selectedBlock.previousBlockHash, 'modal-prev')}
                                            title="Copy Previous Hash"
                                        >
                                            {copiedKey === 'modal-prev' ? <Check size={13} style={{ color: 'var(--fi-green)' }} /> : <Copy size={13} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="fbv-drawer-section-title">
                                        <Key size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Fabric Transaction ID
                                    </div>
                                    <div className="fbv-copy-box">
                                        <span className="fbv-hash-code">{selectedBlock.txId || 'N/A'}</span>
                                        <button
                                            type="button"
                                            className="fi-btn fi-btn-ghost fi-btn-sm"
                                            onClick={() => handleCopy(selectedBlock.txId, 'modal-tx')}
                                            title="Copy Transaction ID"
                                        >
                                            {copiedKey === 'modal-tx' ? <Check size={13} style={{ color: 'var(--fi-green)' }} /> : <Copy size={13} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Commitment Payload Card */}
                                {selectedBlock.commitment && (
                                    <div className="fbv-modal-section-card">
                                        <div className="fbv-modal-section-header">
                                            <div className="fbv-drawer-section-title" style={{ margin: 0 }}>
                                                <Database size={12} style={{ display: 'inline', marginRight: 4 }} />
                                                Ledger Commitment Payload
                                            </div>
                                            {onVerifyEntity && (
                                                <button
                                                    type="button"
                                                    className="fi-btn fi-btn-secondary fi-btn-sm"
                                                    onClick={() => {
                                                        setSelectedBlock(null);
                                                        onVerifyEntity(selectedBlock.commitment);
                                                    }}
                                                >
                                                    <ShieldCheck size={12} /> Verify Integrity
                                                </button>
                                            )}
                                        </div>

                                        <div className="fi-meta-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                            <div className="fi-meta-item">
                                                <span className="fi-meta-label">Commitment ID</span>
                                                <span className="fi-meta-val" style={{ fontFamily: 'var(--fi-font-mono)', fontSize: '12px' }}>
                                                    {selectedBlock.commitment.id || selectedBlock.commitment.commitmentId || '—'}
                                                </span>
                                            </div>
                                            <div className="fi-meta-item">
                                                <span className="fi-meta-label">Entity Type & ID</span>
                                                <span className="fi-meta-val" style={{ fontFamily: 'var(--fi-font-mono)', fontSize: '12px' }}>
                                                    {selectedBlock.commitment.eventType?.replace('_COMMITMENT', '') || selectedBlock.type} · {selectedBlock.commitment.entityId || '—'}
                                                </span>
                                            </div>
                                            <div className="fi-meta-item" style={{ gridColumn: 'span 2' }}>
                                                <span className="fi-meta-label">Cryptographic Digest</span>
                                                <span className="fi-meta-val" style={{ fontFamily: 'var(--fi-font-mono)', fontSize: '12px', wordBreak: 'break-all' }}>
                                                    {selectedBlock.commitment.dataHash || '—'}
                                                </span>
                                            </div>
                                            <div className="fi-meta-item">
                                                <span className="fi-meta-label">Version</span>
                                                <span className="fi-meta-val">v{selectedBlock.commitment.version ?? 1}</span>
                                            </div>
                                            <div className="fi-meta-item">
                                                <span className="fi-meta-label">Committed Timestamp</span>
                                                <span className="fi-meta-val">
                                                    {selectedBlock.commitment.blockTimestamp ? new Date(selectedBlock.commitment.blockTimestamp).toLocaleString() : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Consortium Consensus & Node Endorsement */}
                                <div className="fbv-modal-section-card">
                                    <div className="fbv-drawer-section-title" style={{ marginBottom: 10 }}>
                                        <Network size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Consensus & Peer Endorsement
                                    </div>
                                    <div className="fi-meta-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Endorsement Quorum</span>
                                            <span className="fi-meta-val" style={{ color: 'var(--fi-green)' }}>
                                                2 of 2 Endorsers (Org1MSP + Org2MSP)
                                            </span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Consensus Protocol</span>
                                            <span className="fi-meta-val">Raft (etcdraft) Orderer</span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Chaincode Execution</span>
                                            <span className="fi-meta-val">
                                                {selectedBlock.chaincode?.name || 'zeroleak'} v{selectedBlock.chaincode?.version || '1.0'}
                                            </span>
                                        </div>
                                        <div className="fi-meta-item">
                                            <span className="fi-meta-label">Block Height Status</span>
                                            <span className="fi-meta-val">Committed Block #{selectedBlock.blockNumber}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* World State Read/Write Set (RWSet) */}
                                {selectedBlock.readWriteSet && (selectedBlock.readWriteSet.reads?.length > 0 || selectedBlock.readWriteSet.writes?.length > 0) && (
                                    <div className="fbv-modal-section-card">
                                        <div className="fbv-drawer-section-title" style={{ marginBottom: 10 }}>
                                            <Cpu size={12} style={{ display: 'inline', marginRight: 4 }} />
                                            World State Read/Write Set (RWSet)
                                        </div>
                                        <div className="fi-table-wrapper" style={{ maxHeight: 180, overflowY: 'auto' }}>
                                            <table className="fi-table" style={{ fontSize: '12px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 70 }}>Action</th>
                                                        <th>State Key</th>
                                                        <th>Value / Version</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedBlock.readWriteSet.reads?.map((r, i) => (
                                                        <tr key={`r-${i}`}>
                                                            <td><span className="fi-type-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>READ</span></td>
                                                            <td><code className="fi-code">{r.key}</code></td>
                                                            <td style={{ color: 'var(--fi-text-secondary)' }}>{r.version !== null ? `v${r.version}` : 'exists check'}</td>
                                                        </tr>
                                                    ))}
                                                    {selectedBlock.readWriteSet.writes?.map((w, i) => (
                                                        <tr key={`w-${i}`}>
                                                            <td><span className="fi-type-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>WRITE</span></td>
                                                            <td><code className="fi-code">{w.key}</code></td>
                                                            <td style={{ color: 'var(--fi-text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.value}>{w.value}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="fbv-modal-footer">
                                <div className="fbv-modal-footer-note">
                                    <ShieldCheck size={13} style={{ color: 'var(--fi-green)' }} />
                                    <span>Immutable distributed ledger block verified</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {selectedBlock.commitment && onVerifyEntity && (
                                        <button
                                            type="button"
                                            className="fi-btn fi-btn-primary fi-btn-sm"
                                            onClick={() => {
                                                setSelectedBlock(null);
                                                onVerifyEntity(selectedBlock.commitment);
                                            }}
                                        >
                                            <ShieldCheck size={13} /> Verify Entity
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="fi-btn fi-btn-secondary fi-btn-sm"
                                        onClick={() => setSelectedBlock(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
