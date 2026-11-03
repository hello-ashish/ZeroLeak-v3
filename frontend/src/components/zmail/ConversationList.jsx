import React, { useState } from 'react';
import { ConversationCard } from './ConversationCard.jsx';
import { EmptyInbox } from './EmptyInbox.jsx';
import { Trash, Archive, MailOpen, Mail, List, Grid, CheckSquare } from 'lucide-react';
import { bulkAction } from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';
import { useZMail } from '../../hooks/useZMail.jsx';

import { Skeleton } from '../SkeletonLoader.jsx';

export function ConversationList({ entries, loading, selectedEntry, onSelect, folder, onRefresh }) {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const toast = useToast();
    const { refreshCounts } = useZMail();

    if (loading && (!entries || entries.length === 0)) {
        return (
            <div className="zm-list-pane">
                <div style={{ padding: '24px' }}>
                    <Skeleton width="30%" height={32} style={{ marginBottom: 8 }} />
                    <Skeleton width="50%" height={20} style={{ marginBottom: 32 }} />
                    <Skeleton width="100%" height={56} style={{ marginBottom: 8, borderRadius: 8 }} />
                    <Skeleton width="100%" height={56} style={{ marginBottom: 8, borderRadius: 8 }} />
                    <Skeleton width="100%" height={56} style={{ marginBottom: 8, borderRadius: 8 }} />
                    <Skeleton width="100%" height={56} style={{ marginBottom: 8, borderRadius: 8 }} />
                    <Skeleton width="100%" height={56} style={{ borderRadius: 8 }} />
                </div>
            </div>
        );
    }
    
    if (!entries || entries.length === 0) {
        return <div className="zm-list-pane"><EmptyInbox folder={folder} /></div>;
    }

    const handleBulkAction = async (action) => {
        if (selectedIds.size === 0 || processing) return;
        setProcessing(true);
        try {
            const messageIds = Array.from(selectedIds);
            await bulkAction(messageIds, action);
            setSelectedIds(new Set());
            setIsSelectMode(false);
            if (onRefresh) onRefresh();
            refreshCounts();
        } catch (e) {
            toast.error('Bulk action failed');
        } finally {
            setProcessing(false);
        }
    };

    const toggleCheck = (id, checked) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleAll = (checked) => {
        if (checked) {
            setSelectedIds(new Set(entries.map(e => e.messageId)));
        } else {
            setSelectedIds(new Set());
        }
    };

    // Grouping logic (simplified)
    const today = [];
    const older = [];
    const now = new Date();
    
    entries.forEach(e => {
        const d = new Date(e.sentAt);
        if (d.toDateString() === now.toDateString()) today.push(e);
        else older.push(e);
    });

    const allSelected = selectedIds.size > 0 && selectedIds.size === entries.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < entries.length;

    const unreadCount = entries.filter(e => !e.isRead).length;

    return (
        <div className="zm-list-pane">
            <div className="zm-inbox-header">
                <div className="zm-inbox-title-area">
                    <h1>{folder === 'inbox' ? 'Inbox' : folder.charAt(0).toUpperCase() + folder.slice(1)}</h1>
                    <p>Your messages, organized in one place</p>
                </div>
                
                <div className="zm-inbox-tabs">
                    <div className="zm-tabs-group">
                        <button className="zm-tab active">All Mail ({entries.length})</button>
                        <button className="zm-tab">Unread ({unreadCount})</button>
                        <button className="zm-tab">Starred (0)</button>
                    </div>
                    
                    <div className="zm-inbox-actions">
                        <button 
                            className={`zm-icon-btn ${isSelectMode ? 'active' : ''}`} 
                            onClick={() => {
                                setIsSelectMode(!isSelectMode);
                                if (isSelectMode) setSelectedIds(new Set());
                            }}
                            title="Select messages"
                            style={isSelectMode ? { background: 'var(--zm-brand-dim)', color: 'var(--zm-brand)', borderColor: 'var(--zm-brand)' } : {}}
                        >
                            <CheckSquare size={16} />
                        </button>
                        <button className="zm-sort-btn">Newest First <span style={{ fontSize: '10px', marginLeft: 4 }}>▼</span></button>
                        <button className="zm-icon-btn"><List size={16} /></button>
                        <button className="zm-icon-btn"><Grid size={16} /></button>
                    </div>
                </div>
            </div>

            {isSelectMode && (
                <div className="zm-list-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--zm-border)', background: 'var(--zm-bg-surface-hover)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input 
                            type="checkbox"
                            checked={allSelected}
                            ref={input => { if (input) input.indeterminate = someSelected; }}
                            onChange={(e) => toggleAll(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--zm-text-primary)' }}>{selectedIds.size} selected</span>
                        {selectedIds.size > 0 && (
                            <>
                                <button className="topbar-btn" onClick={() => handleBulkAction('archive')} title="Archive"><Archive size={16} /></button>
                                <button className="topbar-btn" onClick={() => handleBulkAction('trash')} title="Trash"><Trash size={16} /></button>
                                <button className="topbar-btn" onClick={() => handleBulkAction('markRead')} title="Mark as read"><MailOpen size={16} /></button>
                                <button className="topbar-btn" onClick={() => handleBulkAction('markUnread')} title="Mark as unread"><Mail size={16} /></button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="zm-list-scroll">
                {today.length > 0 && (
                    <div className="zm-list-group">
                        {today.map(e => (
                            <ConversationCard 
                                key={e.messageId} 
                                entry={e} 
                                isSelected={selectedEntry?.messageId === e.messageId}
                                isChecked={selectedIds.has(e.messageId)}
                                isSelectMode={isSelectMode}
                                onCheck={(checked) => toggleCheck(e.messageId, checked)}
                                onClick={() => {
                                    if (isSelectMode) {
                                        toggleCheck(e.messageId, !selectedIds.has(e.messageId));
                                    } else {
                                        onSelect(e);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
                {older.length > 0 && (
                    <div className="zm-list-group">
                        {older.map(e => (
                            <ConversationCard 
                                key={e.messageId} 
                                entry={e} 
                                isSelected={selectedEntry?.messageId === e.messageId}
                                isChecked={selectedIds.has(e.messageId)}
                                isSelectMode={isSelectMode}
                                onCheck={(checked) => toggleCheck(e.messageId, checked)}
                                onClick={() => {
                                    if (isSelectMode) {
                                        toggleCheck(e.messageId, !selectedIds.has(e.messageId));
                                    } else {
                                        onSelect(e);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
