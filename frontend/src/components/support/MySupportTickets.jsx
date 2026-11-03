/**
 * MySupportTickets — User-facing support history page
 * Shows the current user's submitted tickets and allows viewing conversations.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Ticket, RefreshCw, Loader2, ChevronLeft, AlertCircle, Clock, CheckCircle, XCircle, ArrowRight, MessageSquare } from 'lucide-react';
import { fetchMyTickets, fetchMyTicket, replyToMyTicket } from '../../hooks/useSupport.js';
import { useToast } from '../Toast.jsx';

const STATUS_CONFIG = {
    OPEN:               { label: 'Open',              color: 'var(--brand-primary)', icon: <AlertCircle size={13} /> },
    IN_PROGRESS:        { label: 'In Progress',       color: '#f59e0b', icon: <Clock size={13} /> },
    WAITING_FOR_USER:   { label: 'Awaiting Your Reply', color: '#8b5cf6', icon: <MessageSquare size={13} /> },
    WAITING_FOR_SUPPORT:{ label: 'Waiting on Support', color: '#3b82f6', icon: <Clock size={13} /> },
    RESOLVED:           { label: 'Resolved',          color: '#22c55e', icon: <CheckCircle size={13} /> },
    CLOSED:             { label: 'Closed',            color: 'var(--text-tertiary)', icon: <XCircle size={13} /> },
};

const PRIORITY_COLORS = { low: '#94a3b8', normal: 'var(--text-secondary)', high: '#f59e0b', urgent: '#ef4444' };

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, color: 'var(--text-secondary)', icon: null };
    return (
        <span className="support-status-badge" style={{ '--badge-color': cfg.color }}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ConversationView({ ticketId, onBack, role }) {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetchMyTicket(ticketId, role);
            setData(res);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [ticketId, role]);

    useEffect(() => { load(); }, [load]);

    const handleReply = async (e) => {
        e.preventDefault();
        if (!reply.trim()) return;
        setSending(true);
        try {
            await replyToMyTicket(ticketId, reply.trim(), role);
            setReply('');
            await load();
            toast.success('Reply sent!');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="support-loading"><Loader2 size={28} className="spin" /></div>;
    if (!data) return null;

    const { ticket, messages } = data;

    return (
        <div className="support-conversation-view">
            <button type="button" className="support-back-btn" onClick={onBack}>
                <ChevronLeft size={16} /> Back to my requests
            </button>

            <div className="support-ticket-header-card">
                <div className="support-ticket-meta">
                    <span className="support-ticket-number">{ticket.ticketNumber}</span>
                    <StatusBadge status={ticket.status} />
                    <span className="support-priority-tag" style={{ color: PRIORITY_COLORS[ticket.reportedPriority] }}>
                        {ticket.reportedPriority}
                    </span>
                </div>
                <h2 className="support-ticket-title">{ticket.title}</h2>
                <div className="support-ticket-info-row">
                    <span>Category: {ticket.category?.replace(/_/g, ' ')}</span>
                    <span>Opened: {formatDate(ticket.createdAt)}</span>
                </div>
            </div>

            <div className="support-messages-list">
                {messages.map((msg, i) => {
                    const isSupport = msg.senderAddress === 'support@zeroleak.com';
                    return (
                        <div key={msg._id || i} className={`support-msg ${isSupport ? 'support-msg-from-support' : 'support-msg-from-user'}`}>
                            <div className="support-msg-avatar">
                                {isSupport ? '🛡️' : '👤'}
                            </div>
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
                    <textarea
                        className="support-reply-textarea"
                        placeholder="Type your reply to support…"
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        rows={4}
                        disabled={sending}
                    />
                    <div className="support-reply-actions">
                        <button type="submit" className="btn btn-primary" disabled={sending || !reply.trim()}>
                            {sending ? <Loader2 size={14} className="spin" /> : <MessageSquare size={14} />}
                            {sending ? ' Sending…' : ' Send Reply'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export function MySupportTickets({ role }) {
    const toast = useToast();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [selectedId, setSelectedId] = useState(null);

    const load = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await fetchMyTickets(page, role);
            setTickets(res.tickets || []);
            setPagination({ page: res.page, pages: res.pages, total: res.total });
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [role]);

    useEffect(() => { load(1); }, [load]);

    useEffect(() => {
        const handleTicketCreated = () => { load(1); };
        window.addEventListener('support-ticket-created', handleTicketCreated);
        return () => window.removeEventListener('support-ticket-created', handleTicketCreated);
    }, [load]);

    if (selectedId) {
        return <ConversationView ticketId={selectedId} onBack={() => setSelectedId(null)} role={role} />;
    }

    return (
        <div className="support-my-tickets">
            <div className="support-my-tickets-header">
                <div className="support-my-tickets-title">
                    <Ticket size={20} />
                    <h2>My Support Requests</h2>
                    <span className="support-count-badge">{pagination.total}</span>
                </div>
                <button type="button" className="topbar-btn" onClick={() => load(pagination.page)} title="Refresh">
                    <RefreshCw size={16} />
                </button>
            </div>

            {loading ? (
                <div className="support-loading"><Loader2 size={28} className="spin" /></div>
            ) : tickets.length === 0 ? (
                <div className="support-empty">
                    <Ticket size={48} strokeWidth={1.5} />
                    <p>You haven't submitted any support requests yet.</p>
                </div>
            ) : (
                <div className="support-ticket-list">
                    {tickets.map(ticket => (
                        <div
                            key={ticket._id}
                            className="support-ticket-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedId(ticket._id)}
                            onKeyDown={e => e.key === 'Enter' && setSelectedId(ticket._id)}
                        >
                            <div className="support-ticket-row-main">
                                <span className="support-ticket-number">{ticket.ticketNumber}</span>
                                <span className="support-ticket-row-title">{ticket.title}</span>
                                <ArrowRight size={14} className="support-ticket-arrow" />
                            </div>
                            <div className="support-ticket-row-meta">
                                <StatusBadge status={ticket.status} />
                                <span className="support-priority-tag" style={{ color: PRIORITY_COLORS[ticket.reportedPriority] }}>
                                    {ticket.reportedPriority}
                                </span>
                                <span className="support-ticket-date">{formatDate(ticket.createdAt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
