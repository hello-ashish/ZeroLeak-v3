import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, FileText, Database, Users, LogOut, ChevronDown, Search, Activity, ShieldAlert, GraduationCap, ClipboardList, RefreshCw, Map, Bell, Mail, AlertCircle, Headset, Ticket } from 'lucide-react'
import { HeaderThemeToggle } from '../../components/HeaderThemeToggle.jsx'
import { NotificationDropdown } from '../../components/NotificationDropdown.jsx'
import { SkeletonCard, Skeleton, SkeletonTable } from '../../components/SkeletonLoader.jsx'
import { useNotifications } from '../../hooks/useNotifications.jsx'
import { ZMailUnreadBadge } from '../../components/zmail/ZMailUnreadBadge.jsx'
import { ReportProblemModal } from '../../components/support/ReportProblemModal.jsx'
import { useRefresh } from '../../context/RefreshContext.jsx'
import { performLogout } from '../../utils/auth.js'
import '../../components/support/support.css'

const NAV = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/auditor/dashboard' },
        ]
    },
    {
        section: 'Audit',
        items: [
            { label: 'Audit Explorer', icon: <FileText size={18} />, path: '/auditor/audit' },
            { label: 'Anomalies', icon: <ShieldAlert size={18} />, path: '/auditor/anomalies' },
            { label: 'Blockchain Center', icon: <Map size={18} />, path: '/auditor/blockchain' },
        ]
    },
    {
        section: 'Academic & People',
        items: [
            { label: 'Exams', icon: <ClipboardList size={18} />, path: '/auditor/exams' },
            { label: 'Students', icon: <GraduationCap size={18} />, path: '/auditor/students' },
            { label: 'Professors', icon: <Users size={18} />, path: '/auditor/professors' },
        ]
    },
    {
        section: 'Messaging',
        items: [
            { label: 'ZeroleakMail', icon: <Mail size={18} />, path: '/zmail?role=auditor', zmailBadge: true },
        ]
    },
    {
        section: 'Support',
        items: [
            { label: 'My Tickets', icon: <Ticket size={18} />, path: '/auditor/support' },
        ]
    }
]

export const AuditorLayout = ({ children, openAnomaliesCount = 0, noPadding = false }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const { isRefreshing, triggerRefresh } = useRefresh()
    const [showReportModal, setShowReportModal] = useState(false)
    const notifRef = useRef(null)
    const profileRef = useRef(null)
    const navigate = useNavigate()
    const location = useLocation()
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications('auditor');

    const auditorData = JSON.parse(localStorage.getItem('auditorData') || '{}')

    const handleRefresh = () => {
        if (typeof fetchNotifications === 'function') fetchNotifications();
        triggerRefresh();
    };

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false)
            }
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = () => {
        performLogout('auditor', navigate)
    }

    const handleSidebarDrag = (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 220;

        const onMouseMove = (moveEvent) => {
            const newWidth = currentWidth + (moveEvent.pageX - startX);
            const clamped = Math.min(Math.max(newWidth, 200), 450); // min 200px, max 450px
            document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.documentElement.classList.remove('sidebar-is-dragging');
        };

        document.body.style.cursor = 'col-resize';
        document.documentElement.classList.add('sidebar-is-dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const initials = (auditorData.email || 'A')
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase()

    const isActive = (path) => location.pathname === path

    return (
        <div className="app-shell">
            {/* Sidebar */}
            <nav
                className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
                aria-label="Main navigation"
            >
                {!collapsed && <div className="sidebar-resizer" onMouseDown={handleSidebarDrag} />}
                <div className="sidebar-brand">
                    <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(88, 101, 242, 0.3)' }} />
                    <div className="sidebar-brand-text">
                        <div className="brand-name">ZEROLEAK</div>
                        <div className="brand-sub">Auditor Console</div>
                    </div>
                </div>

                <div className="sidebar-nav">
                    {NAV.map(group => (
                        <div className="nav-section" key={group.section}>
                            <div className="nav-section-label">{group.section}</div>
                            {group.items.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={() => setMobileOpen(false)}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <span className="nav-icon" aria-hidden="true">
                                        {item.zmailBadge ? <ZMailUnreadBadge /> : item.icon}
                                    </span>
                                    <span className="nav-label">{item.label}</span>
                                    {item.path === '/auditor/anomalies' && openAnomaliesCount > 0 && (
                                        <span className="nav-badge" style={{ background: 'var(--warning)', color: 'var(--bg-surface)' }}>
                                            {openAnomaliesCount}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <button
                        type="button"
                        className="support-report-btn"
                        onClick={() => setShowReportModal(true)}
                        title="Report a Problem"
                    >
                        <AlertCircle size={16} className="support-btn-icon" />
                        <span>Report a Problem</span>
                    </button>

                </div>
            </nav>

            {showReportModal && (
                <ReportProblemModal onClose={() => setShowReportModal(false)} />
            )}

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 'calc(var(--z-sidebar) - 1)' }}
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Main */}
            <div className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
                {/* Topbar */}
                <header className="topbar" role="banner">
                    <button
                        className="topbar-toggle"
                        onClick={() => { setCollapsed(c => !c); setMobileOpen(c => !c) }}
                    >
                        ☰
                    </button>

                    <div className="topbar-search">
                        <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="topbar-search-text">Search {auditorData.name ? auditorData.name.split(' ')[0] + "'s" : "your"} audit logs...</span>
                    </div>

                    <div className="topbar-actions">
                        <div className="badge" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary-subtle)', fontWeight: 600, fontSize: 12 }}>
                            VIEW ONLY MODE
                        </div>
                        <HeaderThemeToggle />

                        {/* Refresh Button */}
                        <button
                            className="topbar-btn"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh Page"
                            aria-label="Refresh Page"
                        >
                            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
                        </button>

                        {/* Notifications Dropdown */}
                        <NotificationDropdown
                            notifications={notifications}
                            unreadCount={unreadCount}
                            markAsRead={markAsRead}
                            markAllAsRead={markAllAsRead}
                            showNotifications={showNotifications}
                            setShowNotifications={setShowNotifications}
                            setShowProfile={setShowProfile}
                            dropdownRef={notifRef}
                        />

                        {/* Profile */}
                        <div className="dropdown" ref={profileRef}>
                            <button
                                className="topbar-profile"
                                onClick={() => { setShowProfile(v => !v); setShowNotifications(false) }}
                            >
                                <span className="avatar avatar-sm">{initials}</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {auditorData.name || auditorData.email?.split('@')[0] || 'Auditor'}
                                </span>
                                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                            {showProfile && (
                                <div className="dropdown-menu">
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-default)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {auditorData.name || 'Auditor'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{auditorData.email}</div>
                                    </div>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item danger" onClick={handleLogout}><LogOut size={14} style={{ marginRight: 4 }} /> Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className={`page-content ${noPadding ? 'no-padding' : ''}`}>
                    {isRefreshing ? (
                        <div style={{ padding: '24px', display: 'grid', gap: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                            <div className="card">
                                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <Skeleton width="200px" height={20} />
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table">
                                        <SkeletonTable rows={5} />
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>{children}</>
                    )}
                </main>
            </div>
        </div>
    )
}
