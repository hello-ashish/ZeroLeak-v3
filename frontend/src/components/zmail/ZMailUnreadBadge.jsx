/**
 * ZMailUnreadBadge — Small badge showing ZMail unread count
 * Used in sidebar navigation of all layouts.
 */
import React from 'react';
import { Mail } from 'lucide-react';
import { useZMail } from '../../hooks/useZMail.jsx';

export function ZMailUnreadBadge({ showIcon = true, className = '' }) {
    const { unreadCount } = useZMail();

    return (
        <span className={`zmail-unread-badge-wrap ${className}`} aria-live="polite" aria-atomic="true">
            {showIcon && <Mail size={18} />}
            {unreadCount > 0 && (
                <span
                    className="zmail-nav-badge"
                    aria-label={`${unreadCount} unread ZeroleakMail messages`}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </span>
    );
}
