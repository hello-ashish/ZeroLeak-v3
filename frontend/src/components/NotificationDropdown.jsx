import React from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getIcon = (type) => {
    switch(type) {
        case 'WARNING': return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />;
        case 'ERROR': return <XCircle size={16} style={{ color: 'var(--danger)' }} />;
        case 'SUCCESS': return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
        case 'INFO':
        default: return <Info size={16} style={{ color: 'var(--brand-primary)' }} />;
    }
};

const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

export const NotificationDropdown = ({ 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    showNotifications, 
    setShowNotifications,
    setShowProfile,
    setShowCreate = null,
    dropdownRef
}) => {
    const navigate = useNavigate();

    const handleToggle = () => {
        setShowNotifications(v => !v);
        if (setShowProfile) setShowProfile(false);
        if (setShowCreate) setShowCreate(false);
    };

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) {
            markAsRead(notification._id);
        }
        if (notification.relatedLink) {
            navigate(notification.relatedLink);
            setShowNotifications(false);
        }
    };

    return (
        <div className="dropdown" ref={dropdownRef}>
            <button
                className="topbar-btn"
                onClick={handleToggle}
                aria-expanded={showNotifications}
                aria-label="Notifications"
                style={{ position: 'relative' }}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span 
                        className="topbar-btn-badge" 
                        style={{ 
                            background: 'var(--danger)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: 'white',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            border: '2px solid var(--bg-surface)'
                        }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {showNotifications && (
                <div className="dropdown-menu" style={{ width: 320, right: 0, padding: 0 }}>
                    <div style={{ 
                        padding: '12px 14px', 
                        borderBottom: '1px solid var(--border-default)', 
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 600 }}>Notifications</span>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllAsRead}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--brand-primary)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                No new notifications
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n._id}
                                    onClick={() => handleNotificationClick(n)}
                                    style={{ 
                                        padding: '12px 14px', 
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: n.isRead ? 'transparent' : 'var(--bg-hover)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'flex-start',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{ marginTop: '2px' }}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontSize: '13px', 
                                            fontWeight: n.isRead ? 500 : 600,
                                            color: 'var(--text-primary)',
                                            marginBottom: '2px'
                                        }}>
                                            {n.title}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                            {n.message}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            {formatTimeAgo(n.createdAt)}
                                        </div>
                                    </div>
                                    {!n.isRead && (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-primary)', flexShrink: 0, marginTop: '4px' }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
