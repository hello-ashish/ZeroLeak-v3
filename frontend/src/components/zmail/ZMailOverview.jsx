import React from 'react';

export function ZMailOverview({ account, unreadCount, entries, onCompose }) {
    const name = account?.displayName?.split(' ')[0] || account?.name?.split(' ')[0] || 'User';
    
    return (
        <div className="zm-overview">
            <div className="zm-greeting">Good morning, {name}.</div>
            
            <div className="zm-overview-stats">
                <div className="zm-stat-item"><strong>{unreadCount}</strong> unread</div>
                <div className="zm-stat-item"><strong>{entries.length}</strong> recent conversations</div>
            </div>
            
            <div className="zm-overview-recent">
                <div className="zm-context-label">Recent Activity</div>
                {entries.slice(0, 3).map(e => (
                    <div key={e.messageId} style={{marginBottom: 20}}>
                        <div style={{fontWeight: 600, color: 'var(--zm-text-primary)', marginBottom: 4}}>{e.senderName || e.senderAddress}</div>
                        <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>{e.subject}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
