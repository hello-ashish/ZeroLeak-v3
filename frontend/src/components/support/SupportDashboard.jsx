/**
 * SupportDashboard — Support team management interface
 * Route: /support (admin + isSupport only)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Ticket, RefreshCw, Loader2, ChevronLeft, Send, MessageSquare,
    StickyNote, History, User, Clock, AlertCircle, CheckCircle,
    XCircle, Search, Filter, BarChart2, UserCheck, Tag, ArrowRight, Sparkles, Brain
} from 'lucide-react';
import {
    fetchSupportTickets, fetchSupportTicket, changeSupportTicketStatus,
    changeSupportTicketPriority, assignSupportTicket, supportAgentReply,
    addSupportInternalNote, fetchSupportInternalNotes, fetchSupportTicketHistory,
    fetchSupportStats,
} from '../../hooks/useSupport.js';
import { useToast } from '../Toast.jsx';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'WAITING_FOR_USER', label: 'Waiting for User' },
    { value: 'WAITING_FOR_SUPPORT', label: 'Waiting for Support' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
];

const PRIORITIES = [
    { value: '', label: 'All Priorities' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
];

const STATUS_CONFIG = {
    OPEN:               { label: 'Open',                color: '#6366f1' },
    IN_PROGRESS:        { label: 'In Progress',         color: '#f59e0b' },
    WAITING_FOR_USER:   { label: 'Waiting for User',    color: '#8b5cf6' },
    WAITING_FOR_SUPPORT:{ label: 'Waiting for Support', color: '#3b82f6' },
    RESOLVED:           { label: 'Resolved',            color: '#22c55e' },
    CLOSED:             { label: 'Closed',              color: '#64748b' },
};

const PRIORITY_COLORS = {
    low: '#64748b', normal: '#94a3b8', high: '#f59e0b', urgent: '#ef4444',
};

const STATUS_TRANSITIONS = {
    OPEN:               ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS:        ['WAITING_FOR_USER', 'WAITING_FOR_SUPPORT', 'RESOLVED', 'CLOSED'],
    WAITING_FOR_USER:   ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    WAITING_FOR_SUPPORT:['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED:           ['OPEN', 'CLOSED'],
    CLOSED:             ['OPEN'],
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8' };
    return (
        <span className="support-status-badge" style={{ '--badge-color': cfg.color }}>
            {cfg.label}
        </span>
    );
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar() {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        fetchSupportStats().then(r => setStats(r.stats)).catch(() => {});
    }, []);

    if (!stats) return null;

    const items = [
        { label: 'Open',        value: stats.open,              color: '#6366f1' },
        { label: 'In Progress', value: stats.inProgress,        color: '#f59e0b' },
        { label: 'Waiting',     value: stats.waitingForSupport, color: '#3b82f6' },
        { label: 'Urgent',      value: stats.urgent,            color: '#ef4444' },
        { label: 'Unassigned',  value: stats.unassigned,        color: '#8b5cf6' },
        { label: 'Resolved',    value: stats.resolved,          color: '#22c55e' },
        { label: 'Closed',      value: stats.closed,            color: '#64748b' },
    ];

    return (
        <div className="support-stats-bar">
            {items.map(item => (
                <div key={item.label} className="support-stat-chip">
                    <span className="support-stat-dot" style={{ background: item.color }} />
                    <span className="support-stat-label">{item.label}</span>
                    <span className="support-stat-value" style={{ color: item.color }}>{item.value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Ticket List ───────────────────────────────────────────────────────────────

function TicketList({ onSelect, filters, search, sort }) {
    const toast = useToast();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    const load = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await fetchSupportTickets({ ...filters, search, sort, page });
            setTickets(res.tickets || []);
            setPagination({ page: res.page, pages: res.pages, total: res.total });
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [filters, search, sort]);

    useEffect(() => { load(1); }, [load]);

    return (
        <div className="support-list-panel">
            <div className="support-list-header">
                <span className="support-list-title">
                    Tickets
                    <span className="support-count-badge">{pagination.total}</span>
                </span>
                <button type="button" className="topbar-btn" onClick={() => load(pagination.page)} title="Refresh">
                    <RefreshCw size={14} />
                </button>
            </div>

            {loading ? (
                <div className="support-loading"><Loader2 size={24} className="spin" /></div>
            ) : tickets.length === 0 ? (
                <div className="support-empty small">
                    <Ticket size={32} strokeWidth={1.5} />
                    <p>No tickets found.</p>
                </div>
            ) : (
                <div className="support-ticket-list">
                    {tickets.map(ticket => (
                        <div
                            key={ticket._id}
                            className={`support-agent-ticket-row ${ticket.hasUnreadUserMessage ? 'unread' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelect(ticket._id)}
                            onKeyDown={e => e.key === 'Enter' && onSelect(ticket._id)}
                        >
                            {ticket.hasUnreadUserMessage && <span className="support-unread-dot" />}
                            <div className="support-ticket-row-main">
                                <span className="support-ticket-number-sm">{ticket.ticketNumber}</span>
                                <span className="support-ticket-row-title">{ticket.title}</span>
                            </div>
                            <div className="support-ticket-row-meta">
                                <StatusBadge status={ticket.status} />
                                <span className="support-priority-tag" style={{ color: PRIORITY_COLORS[ticket.supportPriority] }}>
                                    {ticket.supportPriority}
                                </span>
                                <span className="support-reporter-chip">{ticket.reporterRole}</span>
                                <span className="support-ticket-date">{formatDate(ticket.lastMessageAt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination.pages > 1 && (
                <div className="support-pagination">
                    <button type="button" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>
                        ‹ Prev
                    </button>
                    <span>{pagination.page} / {pagination.pages}</span>
                    <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>
                        Next ›
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Ticket Detail ─────────────────────────────────────────────────────────────

function TicketDetail({ ticketId, onBack }) {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [notes, setNotes] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('conversation');
    const [replyBody, setReplyBody] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [sending, setSending] = useState(false);
    const [savingNote, setSavingNote] = useState(false);

    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketRes, notesRes, histRes] = await Promise.all([
                fetchSupportTicket(ticketId),
                fetchSupportInternalNotes(ticketId),
                fetchSupportTicketHistory(ticketId),
            ]);
            setData(ticketRes);
            setNotes(notesRes.notes || []);
            setHistory(histRes.history || []);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyBody.trim()) return;
        setSending(true);
        try {
            await supportAgentReply(ticketId, replyBody.trim());
            setReplyBody('');
            await load();
            toast.success('Reply sent!');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSending(false);
        }
    };

    const handleNote = async (e) => {
        e.preventDefault();
        if (!noteContent.trim()) return;
        setSavingNote(true);
        try {
            await addSupportInternalNote(ticketId, noteContent.trim());
            setNoteContent('');
            const res = await fetchSupportInternalNotes(ticketId);
            setNotes(res.notes || []);
            toast.success('Note added.');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingNote(false);
        }
    };

    const handleStatusChange = async (e) => {
        try {
            await changeSupportTicketStatus(ticketId, e.target.value);
            await load();
            toast.success('Status updated.');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handlePriorityChange = async (e) => {
        try {
            await changeSupportTicketPriority(ticketId, e.target.value);
            await load();
            toast.success('Priority updated.');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleClaimTicket = async () => {
        try {
            const adminId = adminData?._id || adminData?.id;
            await assignSupportTicket(ticketId, adminId);
            await load();
            toast.success('Ticket assigned to you.');
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) return <div className="support-loading"><Loader2 size={28} className="spin" /></div>;
    if (!data) return null;

    const { ticket, messages } = data;
    const availableTransitions = STATUS_TRANSITIONS[ticket.status] || [];

    return (
        <div className="support-detail-view">
            <button type="button" className="support-back-btn" onClick={onBack}>
                <ChevronLeft size={16} /> All tickets
            </button>

            {/* Ticket header */}
            <div className="support-detail-header">
                <div className="support-detail-meta">
                    <span className="support-ticket-number">{ticket.ticketNumber}</span>
                    <StatusBadge status={ticket.status} />
                    <span className="support-priority-tag" style={{ color: PRIORITY_COLORS[ticket.supportPriority] }}>
                        ● {ticket.supportPriority}
                    </span>
                </div>
                <h2 className="support-detail-title">{ticket.title}</h2>

                <div className="support-detail-info-grid">
                    <div className="support-detail-info-item">
                        <User size={13} />
                        <span>{ticket.reporterName} &lt;{ticket.reporterEmail}&gt;</span>
                        <span className="support-reporter-chip">{ticket.reporterRole}</span>
                    </div>
                    <div className="support-detail-info-item">
                        <Tag size={13} />
                        <span>{ticket.category?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="support-detail-info-item">
                        <Clock size={13} />
                        <span>Opened {formatDate(ticket.createdAt)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="support-detail-controls">
                    <div className="support-control-group">
                        <label className="support-control-label">Status</label>
                        <select className="support-control-select" value={ticket.status} onChange={handleStatusChange}>
                            <option value={ticket.status} disabled>{STATUS_CONFIG[ticket.status]?.label}</option>
                            {availableTransitions.map(s => (
                                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="support-control-group">
                        <label className="support-control-label">Priority</label>
                        <select className="support-control-select" value={ticket.supportPriority} onChange={handlePriorityChange}>
                            {['low','normal','high','urgent'].map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    {!ticket.assignedTo && (
                        <button type="button" className="btn btn-ghost support-claim-btn" onClick={handleClaimTicket}>
                            <UserCheck size={14} /> Assign to me
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="support-detail-tabs">
                {[
                    { id: 'conversation', label: 'Conversation', icon: <MessageSquare size={14} /> },
                    { id: 'notes',        label: 'Internal Notes', icon: <StickyNote size={14} /> },
                    { id: 'history',      label: 'History', icon: <History size={14} /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`support-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon} {tab.label}
                        {tab.id === 'notes' && notes.length > 0 && (
                            <span className="support-tab-badge">{notes.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'conversation' && (
                <div className="support-conversation-panel">
                    <div className="support-messages-list">
                        {messages.map((msg, i) => {
                            const isSupport = msg.senderAddress === 'support@zeroleak.com';
                            return (
                                <div key={msg._id || i} className={`support-msg ${isSupport ? 'support-msg-from-support' : 'support-msg-from-user'}`}>
                                    <div className="support-msg-avatar">{isSupport ? '🛡️' : '👤'}</div>
                                    <div className="support-msg-bubble">
                                        <div className="support-msg-meta">
                                            <strong>{isSupport ? 'ZeroLeak Support' : msg.senderName}</strong>
                                            <span className="support-msg-time">{formatDateTime(msg.sentAt)}</span>
                                        </div>
                                        <pre className="support-msg-body">{msg.body}</pre>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {ticket.status !== 'CLOSED' && (
                        <form className="support-reply-form" onSubmit={handleReply}>
                            <div className="support-reply-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span><Send size={13} /> Reply as <strong>ZeroLeak Support</strong></span>
                                {ticket.aiRouted && ticket.aiSuggestedReply && (
                                    <span style={{ fontSize: 12, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Brain size={13} /> AI auto-routed this ticket
                                    </span>
                                )}
                            </div>
                            
                            {ticket.aiSuggestedReply && !replyBody && (
                                <div style={{ marginBottom: 12, padding: 12, background: 'var(--brand-primary-subtle)', borderRadius: 8, border: '1px solid var(--brand-primary)', position: 'relative' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Sparkles size={14} /> AI Suggested Draft (Confidence: {Math.round(ticket.aiConfidence * 100)}%)
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                        {ticket.aiSuggestedReply}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setReplyBody(ticket.aiSuggestedReply)}
                                        style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Use Draft
                                    </button>
                                </div>
                            )}

                            <textarea
                                className="support-reply-textarea"
                                placeholder="Type your reply to the user…"
                                value={replyBody}
                                onChange={e => setReplyBody(e.target.value)}
                                rows={5}
                                disabled={sending}
                            />
                            <div className="support-reply-actions">
                                <button type="submit" className="btn btn-primary" disabled={sending || !replyBody.trim()}>
                                    {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                    {sending ? ' Sending…' : ' Send Reply'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="support-notes-panel">
                    <div className="support-notes-warning">
                        🔒 Internal notes are private — never shown to the user.
                    </div>
                    {notes.length === 0 ? (
                        <div className="support-empty small"><StickyNote size={28} strokeWidth={1.5} /><p>No internal notes yet.</p></div>
                    ) : (
                        <div className="support-notes-list">
                            {notes.map(note => (
                                <div key={note._id} className="support-note-card">
                                    <div className="support-note-meta">
                                        <strong>{note.authorName}</strong>
                                        <span className="support-msg-time">{formatDateTime(note.createdAt)}</span>
                                    </div>
                                    <p className="support-note-content">{note.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <form className="support-reply-form" onSubmit={handleNote}>
                        <textarea
                            className="support-reply-textarea"
                            placeholder="Add an internal note (private, not sent to user)…"
                            value={noteContent}
                            onChange={e => setNoteContent(e.target.value)}
                            rows={3}
                            disabled={savingNote}
                        />
                        <div className="support-reply-actions">
                            <button type="submit" className="btn btn-ghost" disabled={savingNote || !noteContent.trim()}>
                                {savingNote ? <Loader2 size={14} className="spin" /> : <StickyNote size={14} />}
                                {savingNote ? ' Saving…' : ' Add Note'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="support-history-panel">
                    {history.length === 0 ? (
                        <div className="support-empty small"><History size={28} strokeWidth={1.5} /><p>No history yet.</p></div>
                    ) : (
                        <div className="support-history-list">
                            {history.map((h, i) => (
                                <div key={h._id || i} className="support-history-entry">
                                    <div className="support-history-dot" />
                                    <div className="support-history-content">
                                        <span className="support-history-event">{h.event.replace(/_/g, ' ')}</span>
                                        <span className="support-history-actor"> by {h.actorName} ({h.actorRole})</span>
                                        {h.metadata?.from && h.metadata?.to && (
                                            <span className="support-history-change">
                                                {' '}{h.metadata.from} → {h.metadata.to}
                                            </span>
                                        )}
                                        <span className="support-msg-time">{formatDateTime(h.createdAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export function SupportDashboard() {
    const [selectedId, setSelectedId] = useState(null);
    const [filters, setFilters] = useState({ status: 'OPEN', priority: '', category: '' });
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const debounceRef = useRef(null);

    const handleSearchInput = (e) => {
        const v = e.target.value;
        setSearchInput(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearch(v), 350);
    };

    if (selectedId) {
        return <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;
    }

    return (
        <div className="support-dashboard">
            {/* Header */}
            <div className="support-dashboard-header">
                <div className="support-dashboard-title">
                    <Ticket size={22} />
                    <h1>Support Dashboard</h1>
                </div>
                <StatsBar />
            </div>

            {/* Filters bar */}
            <div className="support-filters-bar">
                <div className="support-search-box">
                    <Search size={14} />
                    <input
                        type="search"
                        placeholder="Search ticket number, title, reporter…"
                        value={searchInput}
                        onChange={handleSearchInput}
                        className="support-search-input"
                    />
                </div>
                <select
                    className="support-filter-select"
                    value={filters.status}
                    onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select
                    className="support-filter-select"
                    value={filters.priority}
                    onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
                >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
            </div>

            {/* Ticket list */}
            <TicketList
                onSelect={setSelectedId}
                filters={filters}
                search={search}
                sort="lastMessageAt"
            />
        </div>
    );
}
