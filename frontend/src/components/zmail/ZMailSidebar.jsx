/**
 * ZMailSidebar — Navigation sidebar for ZMail folders
 */
import React, { useRef } from 'react';
import { Inbox, Send, Star, AlertCircle, FileText, Archive, Trash2, Mail, Plus, BookOpen } from 'lucide-react';
import { useZMail } from '../../hooks/useZMail.jsx';

const FOLDERS = [
    { key: 'inbox',     label: 'Inbox',     icon: Inbox,       countKey: 'unread' },
    { key: 'starred',   label: 'Starred',   icon: Star },
    { key: 'important', label: 'Important', icon: AlertCircle },
    { key: 'sent',      label: 'Sent',      icon: Send },
    { key: 'drafts',    label: 'Drafts',    icon: FileText,    countKey: 'drafts' },
    { key: 'all',       label: 'All Mail',  icon: BookOpen },
    { key: 'archive',   label: 'Archive',   icon: Archive },
    { key: 'trash',     label: 'Trash',     icon: Trash2 },
];

export function ZMailSidebar({ currentFolder, onFolderChange, onCompose, account, collapsed = false }) {
    const { unreadCount, draftCount } = useZMail();

    const getCount = (countKey) => {
        if (countKey === 'unread') return unreadCount;
        if (countKey === 'drafts') return draftCount;
        return 0;
    };

    const sidebarRef = useRef(null);

    const handleMouseDown = (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = sidebarRef.current.offsetWidth;

        const onMouseMove = (moveEvent) => {
            const newWidth = startWidth + (moveEvent.pageX - startX);
            const clamped = Math.min(Math.max(newWidth, 180), 400);
            sidebarRef.current.style.width = `${clamped}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div className="zmail-sidebar" aria-label="ZeroleakMail navigation" ref={sidebarRef}>
            <div className="zmail-resizer" onMouseDown={handleMouseDown} />
            <button
                className="zmail-compose-btn"
                onClick={onCompose}
                aria-label="Compose new email"
                id="zmail-compose-btn"
            >
                <Plus size={18} />
                {!collapsed && <span>Compose</span>}
            </button>

            <nav className="zmail-folder-list" role="navigation">
                {FOLDERS.map(({ key, label, icon: Icon, countKey }) => {
                    const count = countKey ? getCount(countKey) : 0;
                    return (
                        <button
                            key={key}
                            className={`zmail-folder-item ${currentFolder === key ? 'active' : ''}`}
                            onClick={() => onFolderChange(key)}
                            aria-current={currentFolder === key ? 'page' : undefined}
                            id={`zmail-folder-${key}`}
                        >
                            <Icon size={18} className="zmail-folder-icon" />
                            {!collapsed && <span className="zmail-folder-label">{label}</span>}
                            {!collapsed && count > 0 && (
                                <span className="zmail-folder-badge" aria-label={`${count} unread`}>
                                    {count > 99 ? '99+' : count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {account && !collapsed && (
                <div className="zmail-account-bar">
                    <span className="zmail-account-address">{account.zmailAddress}</span>
                </div>
            )}
        </div>
    );
}
