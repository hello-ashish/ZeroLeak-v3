import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom'
import { LayoutDashboard, PackageOpen, Settings, Search, LogOut, ChevronDown, Bell, Plus, FileText, RefreshCw, Mail, AlertCircle, Headset, Ticket } from 'lucide-react'
import { CommandPalette } from '../../components/CommandPalette.jsx'
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
            { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/professor/dashboard' },
        ]
    },
    {
        section: 'Exams & Questions',
        items: [
            { label: 'Create Batch', icon: <Plus size={18} />, path: '/professor/batches/create' },
            { label: 'My Batches', icon: <PackageOpen size={18} />, path: '/professor/batches' },
        ]
    },
    {
        section: 'System',
        items: [
            { label: 'Profile', icon: <Settings size={18} />, path: '/professor/profile' },
        ]
    },
    {
        section: 'Messaging',
        items: [
            { label: 'ZeroleakMail', icon: <Mail size={18} />, path: '/zmail?role=professor', zmailBadge: true },
        ]
    },
    {
        section: 'Support',
        items: [
            { label: 'My Tickets', icon: <Ticket size={18} />, path: '/professor/support' },
        ]
    }
]

export const ProfessorLayout = ({ children, noPadding = false }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [showCommand, setShowCommand] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const { isRefreshing, triggerRefresh } = useRefresh()
    const [showReportModal, setShowReportModal] = useState(false)
    const notifRef = useRef(null)
    const profileRef = useRef(null)
    const navigate = useNavigate()
    const location = useLocation()
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications('professor');

    const profData = JSON.parse(localStorage.getItem('profData') || '{}')

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

    // Cmd+K
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setShowCommand(v => !v)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleLogout = () => {
        performLogout('professor', navigate)
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

    const initials = (profData.name || profData.email || 'P')
        .substring(0, 2)
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
                        <div className="brand-sub">Professor Portal</div>
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
                                    aria-current={isActive(item.path) ? 'page' : undefined}
                                >
                                    <span className="nav-icon" aria-hidden="true">
                                        {item.zmailBadge ? <ZMailUnreadBadge /> : item.icon}
                                    </span>
                                    <span className="nav-label">{item.label}</span>
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
                        aria-label="Toggle sidebar"
                    >
                        ☰
                    </button>

                    <div
                        className="topbar-search"
                        onClick={() => setShowCommand(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && setShowCommand(true)}
                        aria-label="Open command palette"
                    >
                        <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="topbar-search-text">Search {profData.name ? profData.name.split(' ')[0] + "'s" : "your"} batches, exams...</span>
                        <span className="topbar-search-kbd">⌘K</span>
                    </div>

                    <div className="topbar-actions">
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
                                aria-expanded={showProfile}
                                aria-label="Professor profile menu"
                            >
                                <span className="avatar avatar-sm" aria-hidden="true">{initials}</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {profData.name || profData.email?.split('@')[0] || 'Professor'}
                                </span>
                                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                            {showProfile && (
                                <div className="dropdown-menu">
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-default)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            {profData.name || profData.email?.split('@')[0] || 'Professor'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{profData.email}</div>
                                    </div>
                                    <button className="dropdown-item" onClick={() => { navigate('/professor/profile'); setShowProfile(false) }}><Settings size={14} style={{ marginRight: 4 }} /> Profile</button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item danger" onClick={handleLogout}><LogOut size={14} style={{ marginRight: 4 }} /> Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className={`page-content ${noPadding ? 'no-padding' : ''}`} id="main-content">
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
                        children || <Outlet />
                    )}
                </main>
            </div>

            <CommandPalette open={showCommand} onClose={() => setShowCommand(false)} />
        </div>
    )
}
