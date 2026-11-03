import React from 'react';

export function ContactContextPanel({ message }) {
    if (!message) return null;
    const initial = (message.senderName || message.senderAddress || 'U').charAt(0).toUpperCase();

    return (
        <div className="zm-context-panel">
            <div className="zm-contact-hero">
                <div className="zm-avatar-lg">{initial}</div>
                <div className="zm-contact-name">{message.senderName || 'Unknown'}</div>
                <div className="zm-contact-email">{message.senderAddress}</div>
            </div>
            
            <div className="zm-context-section">
                <div className="zm-context-label">Conversation</div>
                <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>
                    Started {new Date(message.createdAt).toLocaleDateString()}
                </div>
            </div>

            {message.attachments && message.attachments.length > 0 && (
                <div className="zm-context-section">
                    <div className="zm-context-label">Files</div>
                    <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>
                        {message.attachments.length} attachments
                    </div>
                </div>
            )}
        </div>
    );
}
