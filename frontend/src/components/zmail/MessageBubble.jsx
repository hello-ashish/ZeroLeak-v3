import React from 'react';
import { Paperclip, Download } from 'lucide-react';

export function MessageBubble({ msg, isSupport }) {
    // Determine if it's "self" by checking if sender is current user... simplified here
    const isSelf = false; 

    return (
        <div className={`zm-msg-bubble ${isSelf ? 'self' : 'other'} ${isSupport ? 'support' : ''}`}>
            <div className="zm-msg-header">
                <strong>{msg.senderName || msg.senderAddress}</strong>
                <span>{new Date(msg.sentAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="zm-msg-content">
                {msg.body}
            </div>
            {msg.attachments && msg.attachments.length > 0 && (
                <div className="zm-attachments">
                    {msg.attachments.map(a => (
                        <div key={a._id} className="zm-attachment">
                            <Paperclip size={12} />
                            {a.originalName}
                            <Download size={12} style={{ marginLeft: 8 }} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
