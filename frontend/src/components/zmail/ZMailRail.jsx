import React from 'react';
import { Inbox, Send, File, Star, Archive, Trash2, Edit3, Shield, AlertCircle } from 'lucide-react';
import { useZMail } from '../../hooks/useZMail.jsx';

export function ZMailRail({ folder, setFolder, onCompose }) {
    const { unreadCount, draftCount, account, connected } = useZMail();
    const isSupport = account?.userType === 'Support' || account?.isSupportMailbox;

    const handleSidebarDrag = (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const currentWidth = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--zmail-rail-width')
        ) || 240;

        const onMouseMove = (mv) => {
            const clamped = Math.min(Math.max(currentWidth + (mv.pageX - startX), 200), 360);
            document.documentElement.style.setProperty('--zmail-rail-width', `${clamped}px`);
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.documentElement.classList.remove('zmail-sidebar-is-dragging');
        };

        document.body.style.cursor = 'col-resize';
        document.documentElement.classList.add('zmail-sidebar-is-dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    };

    const navItems = [
        { id: 'inbox',     label: 'Inbox',     icon: Inbox,   count: unreadCount  },
        { id: 'sent',      label: 'Sent',      icon: Send                         },
        { id: 'starred',   label: 'Starred',   icon: Star                         },
        { id: 'drafts',    label: 'Drafts',    icon: File,    count: draftCount   },
        { id: 'archive',   label: 'Archive',   icon: Archive                      },
        { id: 'trash',     label: 'Trash',     icon: Trash2                       },
    ];

    const initial = (account?.displayName || account?.zmailAddress || 'U').charAt(0).toUpperCase();

    return (
        <div className="zm-rail">
            <div className="zm-rail-resizer" onMouseDown={handleSidebarDrag} />

            {/* Brand */}
            <div className="zm-rail-header">
                <div className="zm-rail-brand">
                    <div className="zm-rail-brand-icon">Z</div>
                    <div className="zm-rail-brand-text">ZeroleakMail</div>
                </div>
            </div>

            {/* Compose */}
            <button className="zm-compose-btn" onClick={onCompose} id="zmail-compose-btn">
                <Edit3 size={15} />
                <span>Compose</span>
            </button>

            {/* Navigation */}
            <div className="zm-nav-section">
                <div className="zm-nav-section-label">Folders</div>
                {navItems.map(n => (
                    <div
                        key={n.id}
                        className={`zm-nav-item ${folder === n.id ? 'active' : ''}`}
                        onClick={() => setFolder(n.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && setFolder(n.id)}
                        aria-current={folder === n.id ? 'page' : undefined}
                    >
                        <div className="nav-left">
                            <n.icon size={15} />
                            <span className="nav-label">{n.label}</span>
                        </div>
                        {n.count > 0 && <span className="zm-nav-badge">{n.count}</span>}
                    </div>
                ))}

                {isSupport && (
                    <>
                        <div className="zm-nav-section-label" style={{ marginTop: 16 }}>Support</div>
                        <div className="zm-nav-item" style={{ color: 'var(--zm-support-accent)' }}>
                            <div className="nav-left">
                                <Shield size={15} />
                                <span className="nav-label">Support Queue</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Account pill */}
            <div className="zm-rail-footer">
                <div className="zm-account-pill">
                    <div className="zm-account-avatar">{initial}</div>
                    <div className="zm-account-info">
                        <div className="zm-account-name">{account?.displayName || 'ZeroleakMail User'}</div>
                        <div className="zm-account-address">{account?.zmailAddress || '…'}</div>
                    </div>
                    <div className={`zm-connection-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Disconnected'} />
                </div>
            </div>
        </div>
    );
}
