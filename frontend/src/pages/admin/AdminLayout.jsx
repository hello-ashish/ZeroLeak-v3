import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Database, BarChart3, GraduationCap, Users, PackageOpen, ScrollText, Blocks, Settings, Search, LogOut, ChevronDown, Command, Bell, Plus, RefreshCw, ShieldAlert, Map, Beaker, Activity, Megaphone, AlertCircle, Headset, Ticket, Mail } from 'lucide-react'
import { CommandPalette } from '../../components/CommandPalette.jsx'
import { HeaderThemeToggle } from '../../components/HeaderThemeToggle.jsx'
import { NotificationDropdown } from '../../components/NotificationDropdown.jsx'
import { SkeletonCard, Skeleton, SkeletonTable } from '../../components/SkeletonLoader.jsx'
import { useNotifications } from '../../hooks/useNotifications.jsx'
import axios from 'axios'
import { Modal } from '../../components/Modal.jsx'
import { ZMailUnreadBadge } from '../../components/zmail/ZMailUnreadBadge.jsx'
import { ReportProblemModal } from '../../components/support/ReportProblemModal.jsx'
import { useRefresh } from '../../context/RefreshContext.jsx'
import { performLogout } from '../../utils/auth.js'
import '../../components/support/support.css'

const NAV = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/admin/dashboard' },
        ]
    },
    {
        section: 'Academic',
        items: [
            { label: 'Exams', icon: <ClipboardList size={18} />, path: '/admin/exams' },
            { label: 'Paper Simulator', icon: <Beaker size={18} />, path: '/admin/simulator' },
            { label: 'Question Bank', icon: <Database size={18} />, path: '/admin/questions' },
            { label: 'Gradebook', icon: <BarChart3 size={18} />, path: '/admin/gradebook' },
        ]
    },
    {
        section: 'People',
        items: [
            { label: 'Students', icon: <GraduationCap size={18} />, path: '/admin/students' },
            { label: 'Professors', icon: <Users size={18} />, path: '/admin/professors' },
            { label: 'Auditors', icon: <Users size={18} />, path: '/admin/auditors' },
            { label: 'Support Team', icon: <Headset size={18} />, path: '/admin/support-members' },
        ]
    },
    {
        section: 'Operations',
        items: [
            { label: 'Live Proctoring', icon: <Activity size={18} />, path: '/admin/proctoring' },
            { label: 'Cheating Detection', icon: <ShieldAlert size={18} />, path: '/admin/cheating' },
            { label: 'Batch Review', icon: <PackageOpen size={18} />, path: '/admin/batches', badgeKey: 'pendingBatches' },
            { label: 'Activity & Audit', icon: <ScrollText size={18} />, path: '/admin/activity' },
            { label: 'Blockchain Center', icon: <Blocks size={18} />, path: '/admin/blockchain' },
        ]
    },
    {
        section: 'System',
        items: [
            { label: 'Settings', icon: <Settings size={18} />, path: '/admin/settings' },
        ]
    },
    {
        section: 'Messaging',
        items: [
            { label: 'ZeroleakMail', icon: <Mail size={18} />, path: '/zmail?role=admin', zmailBadge: true },
        ]
    },
    {
        section: 'Support',
        items: [
            { label: 'My Tickets', icon: <Headset size={18} />, path: '/admin/support' },
        ]
    }
]

export const AdminLayout = ({ children, pendingBatchCount = 0, noPadding = false }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [showCommand, setShowCommand] = useState(false)
    const [showProfile, setShowProfile] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const { isRefreshing, triggerRefresh } = useRefresh()
    const [showReportModal, setShowReportModal] = useState(false)

    // Broadcast State
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastRoles, setBroadcastRoles] = useState(['Student', 'Professor']);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const notifRef = useRef(null)
    const profileRef = useRef(null)
    const createRef = useRef(null)
    const navigate = useNavigate()
    const location = useLocation()
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications('admin');

    const handleSidebarResize = (e) => {
        if (collapsed) return;
        e.preventDefault();
        const startX = e.pageX;
        const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 260;

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

    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}')

    const handleRefresh = () => {
        if (typeof fetchNotifications === 'function') fetchNotifications();
        triggerRefresh();
    };

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (broadcastRoles.length === 0) return alert("Please select at least one role to broadcast to.");
        setIsBroadcasting(true);
        try {
            const token = localStorage.getItem('adminToken');
            await axios.post('/api/admin/broadcast', {
                title: broadcastTitle,
                message: broadcastMessage,
                targetRoles: broadcastRoles
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Broadcast sent successfully!");
            setShowBroadcast(false);
            setBroadcastTitle('');
            setBroadcastMessage('');
        } catch (error) {
            console.error("Broadcast error:", error);
            alert("Failed to send broadcast");
        } finally {
            setIsBroadcasting(false);
        }
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
            if (createRef.current && !createRef.current.contains(e.target)) {
                setShowCreate(false)
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
        performLogout('admin', navigate)
    }

    const initials = (adminData.email || 'A')
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
                {!collapsed && <div className="sidebar-resizer" onMouseDown={handleSidebarResize} />}
                <div className="sidebar-brand">
                    <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(88, 101, 242, 0.3)' }} />
                    <div className="sidebar-brand-text">
                        <div className="brand-name">ZEROLEAK</div>
                        <div className="brand-sub">Admin Command Center</div>
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
                                    {item.badgeKey === 'pendingBatches' && pendingBatchCount > 0 && (
                                        <span className="nav-badge" aria-label={`${pendingBatchCount} pending`}>
                                            {pendingBatchCount}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Sidebar footer: Report a Problem + Logout */}
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
                {!collapsed && <div className="sidebar-resizer" onMouseDown={handleSidebarResize} />}
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
                        <span className="topbar-search-text">Search {adminData.name ? adminData.name.split(' ')[0] + "'s" : "your"} admin workspace...</span>
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
                            setShowCreate={setShowCreate}
                            dropdownRef={notifRef}
                        />

                        {/* Quick Create Dropdown */}
                        <div className="dropdown" ref={createRef}>
                            <button
                                className="topbar-create-btn"
                                onClick={() => { setShowCreate(v => !v); setShowNotifications(false); setShowProfile(false) }}
                                aria-expanded={showCreate}
                                aria-label="Quick create"
                            >
                                <Plus size={16} />
                                Create
                            </button>
                            {showCreate && (
                                <div className="dropdown-menu" style={{ minWidth: 200 }}>
                                    <button className="dropdown-item" onClick={() => { navigate('/admin/exams'); setShowCreate(false) }}><ClipboardList size={14} style={{ marginRight: 4 }} /> New Exam</button>
                                    <button className="dropdown-item" onClick={() => { navigate('/admin/students'); setShowCreate(false) }}><GraduationCap size={14} style={{ marginRight: 4 }} /> Add Student</button>
                                    <button className="dropdown-item" onClick={() => { navigate('/admin/professors'); setShowCreate(false) }}><Users size={14} style={{ marginRight: 4 }} /> Add Professor</button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" onClick={() => { navigate('/admin/batches'); setShowCreate(false) }}><PackageOpen size={14} style={{ marginRight: 4 }} /> Review Batches</button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" onClick={() => { setShowBroadcast(true); setShowCreate(false) }}><Megaphone size={14} style={{ marginRight: 4 }} /> Broadcast Message</button>
                                </div>
                            )}
                        </div>

                        {/* Profile */}
                        <div className="dropdown" ref={profileRef}>
                            <button
                                className="topbar-profile"
                                onClick={() => { setShowProfile(v => !v); setShowNotifications(false); setShowCreate(false) }}
                                aria-expanded={showProfile}
                                aria-label="Admin profile menu"
                            >
                                <span className="avatar avatar-sm" aria-hidden="true">{initials}</span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {adminData.email?.split('@')[0] || 'Admin'}
                                </span>
                                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                            {showProfile && (
                                <div className="dropdown-menu">
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-default)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            {adminData.email?.split('@')[0] || 'Admin'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{adminData.email}</div>
                                    </div>
                                    <button className="dropdown-item" onClick={() => { navigate('/admin/settings'); setShowProfile(false) }}><Settings size={14} style={{ marginRight: 4 }} /> Settings</button>
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
                        <>{children}</>
                    )}
                </main>
            </div>

            <CommandPalette open={showCommand} onClose={() => setShowCommand(false)} />

            <Modal
                open={showBroadcast}
                onClose={() => setShowBroadcast(false)}
                title="Broadcast Message"
                size="md"
            >
                <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label className="form-label">Recipients (Roles)</label>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                            {['Student', 'Professor', 'Admin', 'Auditor'].map(role => (
                                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={broadcastRoles.includes(role)}
                                        onChange={(e) => {
                                            if (e.target.checked) setBroadcastRoles([...broadcastRoles, role]);
                                            else setBroadcastRoles(broadcastRoles.filter(r => r !== role));
                                        }}
                                    />
                                    {role}s
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="form-label">Subject / Title</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. System Maintenance Notice"
                            value={broadcastTitle}
                            onChange={e => setBroadcastTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="form-label">Message</label>
                        <textarea
                            className="form-textarea"
                            rows={5}
                            placeholder="Type your message here..."
                            value={broadcastMessage}
                            onChange={e => setBroadcastMessage(e.target.value)}
                            required
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isBroadcasting || broadcastRoles.length === 0}
                        style={{ marginTop: 8 }}
                    >
                        {isBroadcasting ? 'Sending...' : 'Send Broadcast'}
                    </button>
                </form>
            </Modal>
        </div>
    )
}
