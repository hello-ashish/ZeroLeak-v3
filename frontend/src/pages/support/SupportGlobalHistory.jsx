import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, RefreshCw, Loader2, CheckCircle, Ticket } from 'lucide-react';
import { fetchGlobalSupportHistory, fetchSupportTickets } from '../../hooks/useSupport.js';
import { useToast } from '../../components/Toast.jsx';
import { SupportLayout } from './SupportLayout.jsx';

function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PRIORITY_COLORS = {
    low: '#64748b', normal: '#94a3b8', high: '#f59e0b', urgent: '#ef4444',
};

export default function SupportGlobalHistory() {
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('fixed'); // 'fixed' or 'audit'
    
    // Fixed Tickets state
    const [tickets, setTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketsPagination, setTicketsPagination] = useState({ page: 1, pages: 1, total: 0 });

    // Audit Log state
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPagination, setHistoryPagination] = useState({ page: 1, pages: 1, total: 0 });

    useEffect(() => {
        if (!localStorage.getItem('supportToken')) {
            navigate('/support/login');
        }
    }, [navigate]);

    const loadTickets = useCallback(async (page = 1, showLoading = false) => {
        if (showLoading) setTicketsLoading(true);
        try {
            const res = await fetchSupportTickets({ status: 'RESOLVED,CLOSED', page });
            setTickets(res.tickets || []);
            setTicketsPagination({ page: res.page, pages: res.pages, total: res.total });
        } catch (e) {
            toast.error(e.message);
        } finally {
            if (showLoading) setTicketsLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async (page = 1, showLoading = false) => {
        if (showLoading) setHistoryLoading(true);
        try {
            const res = await fetchGlobalSupportHistory(page);
            setHistory(res.history || []);
            setHistoryPagination({ page: res.page, pages: res.pages, total: res.total });
        } catch (e) {
            toast.error(e.message);
        } finally {
            if (showLoading) setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'fixed') loadTickets(1, true);
        if (activeTab === 'audit') loadHistory(1, true);
    }, [activeTab, loadTickets, loadHistory]);

    return (
        <SupportLayout>
            <div className="support-dashboard">
                <div className="support-dashboard-header">
                    <div className="support-dashboard-title">
                        <History size={22} />
                        <h1>History</h1>
                    </div>
                    <button type="button" className="topbar-btn" onClick={() => activeTab === 'fixed' ? loadTickets(ticketsPagination.page) : loadHistory(historyPagination.page)} title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div className="support-detail-tabs" style={{ padding: '0 24px' }}>
                    <button
                        type="button"
                        className={`support-tab-btn ${activeTab === 'fixed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('fixed')}
                    >
                        <CheckCircle size={14} /> Fixed Issues
                    </button>
                    <button
                        type="button"
                        className={`support-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                        onClick={() => setActiveTab('audit')}
                    >
                        <History size={14} /> Audit Log
                    </button>
                </div>

                <div className="support-list-panel" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 0 }}>
                    {activeTab === 'fixed' && (
                        <>
                            {ticketsLoading ? (
                                <div className="support-loading"><Loader2 size={24} className="spin" /></div>
                            ) : tickets.length === 0 ? (
                                <div className="support-empty small">
                                    <CheckCircle size={32} strokeWidth={1.5} />
                                    <p>No fixed issues found.</p>
                                </div>
                            ) : (
                                <div className="support-ticket-list">
                                    {tickets.map(ticket => (
                                        <div
                                            key={ticket._id}
                                            className="support-agent-ticket-row"
                                        >
                                            <div className="support-ticket-row-main">
                                                <span className="support-ticket-number-sm">{ticket.ticketNumber}</span>
                                                <span className="support-ticket-row-title">{ticket.title}</span>
                                            </div>
                                            <div className="support-ticket-row-meta">
                                                <span className="support-status-badge" style={{ '--badge-color': ticket.status === 'RESOLVED' ? '#22c55e' : '#64748b' }}>
                                                    {ticket.status === 'RESOLVED' ? 'Resolved' : 'Closed'}
                                                </span>
                                                <span className="support-priority-tag" style={{ color: PRIORITY_COLORS[ticket.supportPriority] }}>
                                                    {ticket.supportPriority}
                                                </span>
                                                <span className="support-reporter-chip">{ticket.reporterRole}</span>
                                                <span className="support-ticket-date">{formatDate(ticket.updatedAt)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {ticketsPagination.pages > 1 && (
                                <div className="support-pagination">
                                    <button type="button" disabled={ticketsPagination.page <= 1} onClick={() => loadTickets(ticketsPagination.page - 1, false)}>
                                        ‹ Prev
                                    </button>
                                    <span>{ticketsPagination.page} / {ticketsPagination.pages}</span>
                                    <button type="button" disabled={ticketsPagination.page >= ticketsPagination.pages} onClick={() => loadTickets(ticketsPagination.page + 1, false)}>
                                        Next ›
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'audit' && (
                        <>
                            {historyLoading ? (
                                <div className="support-loading"><Loader2 size={24} className="spin" /></div>
                            ) : history.length === 0 ? (
                                <div className="support-empty small">
                                    <History size={32} strokeWidth={1.5} />
                                    <p>No history found.</p>
                                </div>
                            ) : (
                                <div className="support-history-list">
                                    {history.map((h, i) => (
                                        <div key={h._id || i} className="support-history-entry" style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div className="support-history-dot" />
                                            <div className="support-history-content">
                                                <div style={{ marginBottom: 4 }}>
                                                    <strong style={{ color: 'var(--text-primary)' }}>Ticket #{h.ticketNumber}</strong>
                                                    <span style={{ margin: '0 8px', color: 'var(--text-tertiary)' }}>•</span>
                                                    <span className="support-history-event" style={{ fontWeight: 600 }}>{h.event.replace(/_/g, ' ')}</span>
                                                </div>
                                                <div>
                                                    <span className="support-history-actor">by <strong>{h.actorName}</strong> ({h.actorRole})</span>
                                                    {h.metadata?.from && h.metadata?.to && (
                                                        <span className="support-history-change" style={{ marginLeft: 8, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, fontSize: '11px' }}>
                                                            {h.metadata.from} → {h.metadata.to}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="support-msg-time" style={{ marginTop: 8 }}>{formatDateTime(h.createdAt)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {historyPagination.pages > 1 && (
                                <div className="support-pagination">
                                    <button type="button" disabled={historyPagination.page <= 1} onClick={() => loadHistory(historyPagination.page - 1, false)}>
                                        ‹ Prev
                                    </button>
                                    <span>{historyPagination.page} / {historyPagination.pages}</span>
                                    <button type="button" disabled={historyPagination.page >= historyPagination.pages} onClick={() => loadHistory(historyPagination.page + 1, false)}>
                                        Next ›
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </SupportLayout>
    );
}
