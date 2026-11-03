import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, LogOut, ChevronDown, Search, RefreshCw, Mail, Headset } from 'lucide-react';
import { CommandPalette } from '../../components/CommandPalette.jsx';
import { HeaderThemeToggle } from '../../components/HeaderThemeToggle.jsx';
import { SkeletonCard, Skeleton, SkeletonTable } from '../../components/SkeletonLoader.jsx';
import { ZMailUnreadBadge } from '../../components/zmail/ZMailUnreadBadge.jsx';
import { History } from 'lucide-react';
import { useRefresh } from '../../context/RefreshContext.jsx';
import { performLogout } from '../../utils/auth.js';
import '../../components/support/support.css';

const NAV = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/support' },
            { label: 'Audit Log', icon: <History size={18} />, path: '/support/history' },
        ]
    },
    {
        section: 'Messaging',
        items: [
            { label: 'ZeroleakMail', icon: <Mail size={18} />, path: '/zmail?role=support', zmailBadge: true },
        ]
    }
];

export const SupportLayout = ({ children, noPadding = false }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showCommand, setShowCommand] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const { isRefreshing, triggerRefresh } = useRefresh();
    const profileRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

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

    const handleRefresh = () => {
        triggerRefresh();
    };

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cmd+K
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommand(v => !v);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleLogout = () => {
        performLogout('support', navigate);
    };

    const isActive = (path) => location.pathname === path;

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
                        <div className="brand-sub">Support Portal</div>
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

                {/* Sidebar footer: Logout */}
                <div className="sidebar-footer">

                </div>
                {!collapsed && <div className="sidebar-resizer" onMouseDown={handleSidebarResize} />}
            </nav>

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
                        <span className="topbar-search-text">Search your support workspace...</span>
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

                        {/* Profile */}
                        <div className="dropdown" ref={profileRef}>
                            <button
                                className="topbar-profile"
                                onClick={() => { setShowProfile(v => !v); }}
                                aria-expanded={showProfile}
                                aria-label="Support profile menu"
                            >
                                <span className="avatar avatar-sm" aria-hidden="true" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--brand-primary)' }}>
                                    <Headset size={14} />
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    System
                                </span>
                                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                            </button>
                            {showProfile && (
                                <div className="dropdown-menu">
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-default)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                            ZeroLeak Support
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>support@zeroleak.com</div>
                                    </div>
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
        </div>
    );
};
