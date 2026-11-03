/**
 * ZMailListItem — Single row in the message list
 */
import React from 'react';
import { Paperclip, Star } from 'lucide-react';

function formatTimestamp(sentAt) {
    if (!sentAt) return '';
    const d = new Date(sentAt);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ZMailListItem({ entry, isSelected, onClick, onStar }) {
    const { senderName, senderAddress, to, subject, snippet, sentAt, isRead, isStarred, hasAttachment, isDraft } = entry;

    const displaySender = senderName || senderAddress || 'Unknown';
    const displayRecipient = isDraft ? (to?.[0]?.name || to?.[0]?.address || 'No recipient') : null;

    return (
        <div
            className={`zmail-list-item ${isRead ? '' : 'unread'} ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onClick()}
            aria-selected={isSelected}
        >
            {!isRead && <span className="zmail-unread-dot" aria-label="Unread" />}

            <div className="zmail-list-item-sender">
                <span className="zmail-sender-name">{isDraft ? `To: ${displayRecipient}` : displaySender}</span>
                {isDraft && <span className="zmail-draft-tag">Draft</span>}
            </div>

            <div className="zmail-list-item-content">
                <span className="zmail-subject">{subject || '(no subject)'}</span>
                {snippet && (
                    <span className="zmail-snippet"> — {snippet}</span>
                )}
            </div>

            <div className="zmail-list-item-meta">
                {hasAttachment && <Paperclip size={13} className="zmail-attachment-icon" aria-label="Has attachment" />}
                <span className="zmail-timestamp">{formatTimestamp(sentAt)}</span>
                <button
                    type="button"
                    className={`zmail-star-btn ${isStarred ? 'starred' : ''}`}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onStar && onStar(); }}
                    aria-label={isStarred ? 'Unstar' : 'Star'}
                    title={isStarred ? 'Unstar' : 'Star'}
                >
                    <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                </button>
            </div>
        </div>
    );
}
