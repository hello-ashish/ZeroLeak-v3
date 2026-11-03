import React, { useEffect, useState } from 'react';
import { fetchThread } from '../../hooks/useZMail.jsx';
import { ZMailMessageView } from './ZMailMessageView.jsx';
import { useToast } from '../Toast.jsx';
import axios from 'axios';
import { useZMail } from '../../hooks/useZMail.jsx';

/**
 * ConversationView — wraps ZMailMessageView to display an entire thread.
 */
export function ConversationView({ entry, onBack, onRefresh }) {
    const [threadData, setThreadData] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const toast = useToast();
    const { getAuthHeader, setUnreadCount } = useZMail();

    useEffect(() => {
        loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entry.threadId, entry.messageId]);

    const loadThread = async () => {
        try {
            const data = await fetchThread(entry.threadId);
            setThreadData(data);
            
            // Auto-expand unread or the last message
            const initialExpanded = new Set();
            data.messages.forEach((m, idx) => {
                const isLast = idx === data.messages.length - 1;
                const isUnread = m.entryState && !m.entryState.isRead;
                if (isLast || isUnread) {
                    initialExpanded.add(m._id);
                }
            });
            setExpandedIds(initialExpanded);
            
            // Mark all unread messages in the thread as read
            const hasUnread = data.messages.some(m => m.entryState && !m.entryState.isRead);
            if (hasUnread || !entry.isRead) {
                // Optimistically decrease unread count
                setUnreadCount(prev => Math.max(0, prev - 1));
                
                const BACKEND_URL = import.meta.env.DEV ? "" : "https://zeroleak-v2.onrender.com";
                await axios.patch(`${BACKEND_URL}/api/zmail/threads/${entry.threadId}/read`, {}, {
                    headers: getAuthHeader()
                });
                onRefresh && onRefresh();
            }
        } catch {
            toast.error('Failed to load conversation');
        }
    };

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (!threadData) {
        return (
            <div className="zm-detail-pane">
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--zm-text-muted)' }}>
                    Loading conversation...
                </div>
            </div>
        );
    }

    return (
        <div className="zm-detail-pane" style={{ flex: 1, overflow: 'auto', background: 'var(--zm-bg-surface)', display: 'flex', flexDirection: 'column' }}>
            <div className="zm-detail-toolbar" style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--zm-border)', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="zm-icon-btn" onClick={onBack} title="Back to inbox">&lt;</button>
                    <button className="zm-icon-btn">&gt;</button>
                    <button className="zm-icon-btn">+</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--zm-text-muted)', fontSize: '13px' }}>
                    <button className="zm-icon-btn" style={{ border: 'none' }}>&lt;</button>
                    <span>1 of {entry.totalCount || 5}</span>
                    <button className="zm-icon-btn" style={{ border: 'none' }}>&gt;</button>
                </div>
            </div>
            
            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--zm-text-primary)' }}>
                        {threadData.thread.subject || '(no subject)'}
                    </h2>
                    <span className="zm-badge" style={{ background: 'var(--zm-brand-dim)', color: 'var(--zm-brand)', border: 'none', padding: '4px 8px' }}>Inbox ×</span>
                </div>
                {threadData.messages.map((msg, idx) => {
                    const formattedMessage = {
                        ...msg,
                        entry: msg.entryState || {}
                    };
                    const isExpanded = expandedIds.has(msg._id);
                    
                    return (
                        <div 
                            key={msg._id} 
                            style={{
                                border: '1px solid var(--zm-border)', 
                                borderRadius: 'var(--zm-radius-md)', 
                                overflow: 'hidden', 
                                background: 'var(--zm-bg-surface)', 
                                boxShadow: isExpanded ? 'var(--zm-shadow-sm)' : 'none',
                                cursor: isExpanded ? 'default' : 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {isExpanded ? (
                                <div onClick={(e) => { 
                                    // Only collapse if clicking the header area
                                    const isHeaderClick = e.target.closest('.zmail-sender-meta');
                                    if (isHeaderClick) toggleExpand(msg._id);
                                }}>
                                    <ZMailMessageView
                                        message={formattedMessage}
                                        onRefresh={() => {
                                            loadThread();
                                            onRefresh && onRefresh();
                                        }}
                                        hideHeaderSubject={true}
                                        hideBackButton={true}
                                    />
                                </div>
                            ) : (
                                <div 
                                    onClick={() => toggleExpand(msg._id)}
                                    style={{ 
                                        padding: '16px 20px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                        <div className="zmail-sender-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                                            {(msg.senderName || 'U').slice(0, 1).toUpperCase()}
                                        </div>
                                        <div style={{ fontWeight: 600, color: 'var(--zm-text-primary)', whiteSpace: 'nowrap', width: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {msg.senderName}
                                        </div>
                                        <div style={{ color: 'var(--zm-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontSize: '13px' }}>
                                            {msg.body?.replace(/\s+/g, ' ').substring(0, 80)}...
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: 'var(--zm-text-muted)', flexShrink: 0, marginLeft: '16px' }}>
                                        {new Date(msg.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
