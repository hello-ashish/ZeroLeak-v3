import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, BarChart3, Target, User, Settings, Search, LogOut, ChevronDown, Bell, RefreshCw, Mail, AlertCircle, Headset, Ticket } from 'lucide-react'
import { CommandPalette } from '../../components/CommandPalette.jsx'
import { Modal } from '../../components/Modal.jsx'
import { HeaderThemeToggle } from '../../components/HeaderThemeToggle.jsx'
import { NotificationDropdown } from '../../components/NotificationDropdown.jsx'
import { SkeletonCard, Skeleton, SkeletonTable } from '../../components/SkeletonLoader.jsx'
import { useNotifications } from '../../hooks/useNotifications.jsx'
import { ZMailUnreadBadge } from '../../components/zmail/ZMailUnreadBadge.jsx'
import { ReportProblemModal } from '../../components/support/ReportProblemModal.jsx'
import { useRefresh } from '../../context/RefreshContext.jsx'
import { performLogout } from '../../utils/auth.js'
import '../../components/support/support.css'

import axios from 'axios';

const NAV = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/student/dashboard' },
        ]
    },
    {
        section: 'Academic',
        items: [
            { label: 'My Exams', icon: <ClipboardList size={18} />, path: '/student/exams' },
            { label: 'Results', icon: <Target size={18} />, path: '/student/results' },
            { label: 'Performance', icon: <BarChart3 size={18} />, path: '/student/performance' },
        ]
    },
    {
        section: 'Identity',
        items: [
            { label: 'Profile', icon: <User size={18} />, path: '/student/profile' },]
    },
    {
        section: 'Messaging',
        items: [
            { label: 'ZeroleakMail', icon: <Mail size={18} />, path: '/zmail?role=student', zmailBadge: true },
        ]
    },
    {
        section: 'Support',
        items: [
            { label: 'My Tickets', icon: <Ticket size={18} />, path: '/student/support' },
        ]
    }
]

export const StudentLayout = ({ children, noPadding = false }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [showCommand, setShowCommand] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const { isRefreshing, triggerRefresh } = useRefresh()
    const [showReportModal, setShowReportModal] = useState(false)
    const notifRef = useRef(null)
    const profileRef = useRef(null)
    const [showRestrictedModal, setShowRestrictedModal] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications('student');

    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}')

    const handleLogout = () => {
        performLogout('student', navigate)
    }

    const handleRefresh = () => {
        if (typeof fetchNotifications === 'function') fetchNotifications();
        triggerRefresh();
    };

    // Global Axios Interceptor for Blocking
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && (error.response.status === 403 || error.response.data?.message === "BLOCKED")) {
                    setShowRestrictedModal(true);
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

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

    const initials = (studentData.name || studentData.email || 'S')
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
                    <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }} />
                    <div className="sidebar-brand-text">
                        <div className="brand-name">ZEROLEAK</div>
                        <div className="brand-sub">Student Portal</div>
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
                <header className="topbar" role="banner" style={{ borderBottom: '1px solid var(--border-default)', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(var(--bg-surface-rgb), 0.8)', backdropFilter: 'blur(12px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                        <button
                            className="topbar-toggle"
                            onClick={() => { setCollapsed(c => !c); setMobileOpen(c => !c) }}
                            aria-label="Toggle sidebar"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
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
                            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 24, padding: '0 16px', height: 40, width: '100%', maxWidth: 480, cursor: 'text', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        >
                            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                            <span className="topbar-search-text" style={{ flex: 1, fontSize: 14, color: 'var(--text-tertiary)', userSelect: 'none' }}>
                                Search {studentData.name ? studentData.name.split(' ')[0] + "'s" : "your"} exams and results...
                            </span>
                            <span className="topbar-search-kbd" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '2px 6px', letterSpacing: '1px' }}>⌘K</span>
                        </div>
                    </div>

                    <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <HeaderThemeToggle />

                        <button
                            className="topbar-btn"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh Page"
                            aria-label="Refresh Page"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-default)', cursor: isRefreshing ? 'not-allowed' : 'pointer', transition: 'all 0.2s', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { if (!isRefreshing) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                        </button>

                        <div style={{ position: 'relative' }}>
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
                        </div>

                        <div style={{ width: 1, height: 24, background: 'var(--border-strong)', margin: '0 4px' }} />

                        <div className="dropdown" ref={profileRef} style={{ position: 'relative' }}>
                            <button
                                className="topbar-profile"
                                onClick={() => { setShowProfile(v => !v); setShowNotifications(false) }}
                                aria-expanded={showProfile}
                                aria-label="Student profile menu"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                                        {studentData.name || studentData.email?.split('@')[0] || 'Student'}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1 }}>Student</span>
                                </div>
                                <div className="avatar avatar-sm" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, border: '2px solid var(--bg-surface)' }}>
                                    {initials}
                                </div>
                                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', marginLeft: 2 }} />
                            </button>

                            {showProfile && (
                                <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100 }}>
                                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {studentData.name || studentData.email?.split('@')[0] || 'Student'}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{studentData.email}</div>
                                    </div>
                                    <div style={{ padding: '8px' }}>
                                        <button className="dropdown-item" onClick={() => { navigate('/student/profile'); setShowProfile(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', transition: 'all 0.2s', textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                                            <User size={16} /> My Profile
                                        </button>
                                        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                                        <button className="dropdown-item danger" onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--danger)', transition: 'all 0.2s', textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                            <LogOut size={16} /> Sign out
                                        </button>
                                    </div>
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

            <Modal
                open={showRestrictedModal}
                onClose={() => { }} // Disallow closing without logging out
                title="Account Restricted"
                footer={
                    <button className="btn btn-danger w-full" onClick={handleLogout}>
                        Return to Login
                    </button>
                }
            >
                <div style={{ padding: '8px 0' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Your account has been restricted by an administrator. Please contact support if you believe this is an error.
                    </p>
                </div>
            </Modal>
        </div>
    )
}
