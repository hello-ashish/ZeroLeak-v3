import React from 'react';
import { Paperclip, ShieldAlert, Star } from 'lucide-react';

function formatTime(d) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Within 7 days show day name
    const diffDays = Math.floor((now - date) / 86400000);
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ConversationCard({ entry, isSelected, onClick, isChecked, onCheck, isSelectMode }) {
    const isSupport = entry.senderAddress === 'support@zeroleak.com' || entry.subject?.includes('ZSUP');
    const sender = entry.isDraft
        ? `To: ${entry.to?.[0]?.name || entry.to?.[0]?.address || 'Unknown'}`
        : (entry.senderName || entry.senderAddress || 'Unknown');

    const cardClass = [
        'zm-msg-card',
        !entry.isRead ? 'unread' : '',
        isSelected ? 'selected' : '',
        isChecked ? 'checked' : '',
    ].filter(Boolean).join(' ');

    const initial = sender.charAt(0).toUpperCase();
    const isStarred = entry.isStarred || false;

    // Pick a deterministic background color for the avatar
    const colors = ['#818cf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa', '#60a5fa'];
    const colorIndex = sender.length % colors.length;
    const avatarBg = colors[colorIndex];

    return (
        <div className={cardClass} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
            <div className="zm-card-left">
                {isSelectMode && (
                    <input 
                        type="checkbox" 
                        checked={!!isChecked}
                        onChange={(e) => {
                            e.stopPropagation();
                            if (onCheck) onCheck(e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="zm-card-checkbox"
                    />
                )}
                <div className="zm-card-avatar" style={{ backgroundColor: avatarBg }}>{initial}</div>
                {isSupport && <ShieldAlert size={14} color="var(--zm-support-accent)" style={{ flexShrink: 0 }} />}
                <div className={`zm-card-sender ${entry.isRead ? 'read' : ''}`}>{sender}</div>
            </div>

            <div className="zm-card-middle">
                {entry.isDraft && <span className="zm-badge zm-badge-draft">Draft</span>}
                <span className="zm-card-subject">{entry.subject || '(no subject)'}</span>
                <span className="zm-card-snippet-sep">-</span>
                <span className="zm-card-preview">{entry.snippet || 'No preview available'}</span>
            </div>

            <div className="zm-card-right">
                {entry.hasAttachment && <Paperclip size={14} color="var(--zm-text-muted)" />}
                <div className="zm-card-time">{formatTime(entry.sentAt)}</div>
                <button className="zm-star-btn" onClick={(e) => { e.stopPropagation(); /* TODO: toggle star */ }}>
                    <Star size={16} fill={isStarred ? "#fbbf24" : "none"} color={isStarred ? "#fbbf24" : "var(--zm-text-muted)"} />
                </button>
            </div>
        </div>
    );
}
