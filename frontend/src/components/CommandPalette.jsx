import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Command } from 'cmdk'
import {
    LayoutDashboard, Users, GraduationCap, ClipboardList, Database,
    PackageOpen, BarChart3, Settings, Plus, UserPlus, Target, User,
    FileText, ShieldAlert, Search, X
} from 'lucide-react'
import axios from 'axios'

// ─── Role-based nav grid config ──────────────────────────────────────────────
const NAV_GRID = {
    admin: [
        { label: 'Dashboard',     icon: LayoutDashboard, path: '/admin/dashboard',  color: '#10b981' },
        { label: 'Exams',         icon: ClipboardList,   path: '/admin/exams',       color: '#6366f1' },
        { label: 'Question Bank', icon: Database,         path: '/admin/questions',   color: '#f59e0b' },
        { label: 'Students',      icon: GraduationCap,   path: '/admin/students',    color: '#3b82f6' },
        { label: 'Professors',    icon: Users,            path: '/admin/professors',  color: '#8b5cf6' },
        { label: 'Batches',       icon: PackageOpen,     path: '/admin/batches',     color: '#ec4899' },
        { label: 'Activity',      icon: BarChart3,       path: '/admin/activity',    color: '#14b8a6' },
        { label: 'Settings',      icon: Settings,         path: '/admin/settings',    color: '#64748b' },
        { label: 'Add Student',   icon: UserPlus,        path: '/admin/students',    color: '#22c55e' },
        { label: 'New Exam',      icon: Plus,             path: '/admin/exams',       color: '#f97316' },
    ],
    professor: [
        { label: 'Dashboard',     icon: LayoutDashboard, path: '/professor/dashboard',       color: '#10b981' },
        { label: 'Batches',       icon: PackageOpen,     path: '/professor/batches',         color: '#6366f1' },
        { label: 'New Batch',     icon: Plus,             path: '/professor/batches/create',  color: '#f59e0b' },
        { label: 'Profile',       icon: Settings,         path: '/professor/profile',         color: '#64748b' },
    ],
    student: [
        { label: 'Dashboard',    icon: LayoutDashboard, path: '/student/dashboard',    color: '#10b981' },
        { label: 'My Exams',     icon: ClipboardList,   path: '/student/exams',        color: '#6366f1' },
        { label: 'Results',      icon: Target,           path: '/student/results',      color: '#f59e0b' },
        { label: 'Performance',  icon: BarChart3,       path: '/student/performance',  color: '#3b82f6' },
        { label: 'Profile',      icon: User,             path: '/student/profile',      color: '#64748b' },
    ],
    auditor: [
        { label: 'Dashboard',       icon: LayoutDashboard, path: '/auditor/dashboard',  color: '#10b981' },
        { label: 'Audit Explorer',  icon: FileText,        path: '/auditor/audit',      color: '#6366f1' },
        { label: 'Anomalies',       icon: ShieldAlert,     path: '/auditor/anomalies',  color: '#ef4444' },
    ],
}

// ─── Shared icon-grid renderer ────────────────────────────────────────────────
const NavGrid = ({ role, onSelect }) => {
    const items = NAV_GRID[role] || []
    return (
        <div style={{ padding: '16px 18px 10px' }}>
            <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12
            }}>
                Quick Navigation
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 10,
            }}>
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <button
                            key={item.path + item.label}
                            onClick={() => onSelect(item.path)}
                            style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: 8, padding: '14px 8px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 12, cursor: 'pointer',
                                transition: 'all 0.18s ease',
                                color: 'var(--text-secondary)',
                                fontSize: 11, fontWeight: 600,
                                textAlign: 'center', lineHeight: 1.3,
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = `${item.color}18`
                                e.currentTarget.style.borderColor = `${item.color}60`
                                e.currentTarget.style.color = item.color
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = `0 4px 14px ${item.color}25`
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'var(--bg-surface)'
                                e.currentTarget.style.borderColor = 'var(--border-subtle)'
                                e.currentTarget.style.color = 'var(--text-secondary)'
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            <Icon size={22} style={{ color: item.color }} />
                            {item.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Filtered nav grid (accepts pre-filtered items array) ─────────────────────
const FilteredNavGrid = ({ items, onSelect }) => (
    <div style={{ padding: '16px 18px 10px' }}>
        <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12
        }}>
            Quick Navigation
        </div>
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 10,
        }}>
            {items.map((item) => {
                const Icon = item.icon
                return (
                    <button
                        key={item.path + item.label}
                        onClick={() => onSelect(item.path)}
                        style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '14px 8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 12, cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            color: 'var(--text-secondary)',
                            fontSize: 11, fontWeight: 600,
                            textAlign: 'center', lineHeight: 1.3,
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = `${item.color}18`
                            e.currentTarget.style.borderColor = `${item.color}60`
                            e.currentTarget.style.color = item.color
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = `0 4px 14px ${item.color}25`
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-surface)'
                            e.currentTarget.style.borderColor = 'var(--border-subtle)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                            e.currentTarget.style.transform = 'none'
                            e.currentTarget.style.boxShadow = 'none'
                        }}
                    >
                        <Icon size={22} style={{ color: item.color }} />
                        {item.label}
                    </button>
                )
            })}
        </div>
    </div>
)

// ─── Shared footer ────────────────────────────────────────────────────────────
const PaletteFooter = () => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 14, padding: '8px 18px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 11, color: 'var(--text-tertiary)'
    }}>
        {[['↵', 'select'], ['↑↓', 'navigate'], ['ESC', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{ padding: '2px 5px', borderRadius: 4, background: 'var(--bg-hover)',
                              border: '1px solid var(--border-subtle)', fontSize: 10 }}>{key}</kbd>
                {label}
            </span>
        ))}
    </div>
)

// ─── Nav-only palette (Student / Professor) — searchable nav ──────────────────
const NavOnlyPalette = ({ open, onClose, role }) => {
    const navigate = useNavigate()
    const overlayRef = useRef(null)
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')

    useEffect(() => {
        if (!open) return
        setQuery('')
        // auto-focus the input after the animation settles
        const t = setTimeout(() => inputRef.current?.focus(), 50)
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => { clearTimeout(t); window.removeEventListener('keydown', handler) }
    }, [open, onClose])

    if (!open) return null

    const handleSelect = (path) => { navigate(path); onClose() }

    // Filter nav items locally by label
    const allItems = NAV_GRID[role] || []
    const filtered = query.trim()
        ? allItems.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()))
        : allItems

    return (
        <>
            {/* Backdrop */}
            <div
                ref={overlayRef}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 'calc(var(--z-command) - 1)',
                    animation: 'overlayShow 200ms ease',
                }}
            />
            {/* Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                style={{
                    position: 'fixed', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%', maxWidth: 640,
                    background: 'var(--bg-overlay)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-float)',
                    zIndex: 'var(--z-command)',
                    overflow: 'hidden',
                    animation: 'dialogScale 200ms cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                {/* Real search header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <Search size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <Command.Input
                        ref={inputRef}
                        placeholder="Navigate to…"
                        value={query}
                        onValueChange={setQuery}
                        style={{
                            flex: 1, border: 'none', padding: 0,
                            background: 'transparent', fontSize: 15,
                            color: 'var(--text-primary)', outline: 'none',
                        }}
                    />
                    {query && (
                        <button
                            onClick={() => { setQuery(''); inputRef.current?.focus() }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                                     color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}
                            aria-label="Clear search">
                            <X size={15} />
                        </button>
                    )}
                    <kbd style={{
                        fontSize: 11, padding: '3px 7px', borderRadius: 6,
                        background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
                        border: '1px solid var(--border-subtle)', fontFamily: 'inherit',
                    }}>ESC</kbd>
                </div>

                {/* Filtered nav grid */}
                {filtered.length > 0 ? (
                    <FilteredNavGrid items={filtered} onSelect={handleSelect} />
                ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
                        <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <div style={{ fontSize: 14 }}>No results for "{query}"</div>
                    </div>
                )}
                <PaletteFooter />
            </div>
        </>
    )
}

// ─── Full search palette (Admin / Auditor) ────────────────────────────────────
const SearchPalette = ({ open, onClose, role }) => {
    const navigate = useNavigate()
    const [query, setQuery]               = useState('')
    const [searchResults, setSearchResults] = useState({ students: [], professors: [], batches: [], exams: [] })
    const [isSearching, setIsSearching]   = useState(false)

    useEffect(() => {
        if (!query.trim()) { setSearchResults({ students: [], professors: [] }); return }
        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const token =
                    localStorage.getItem(`${role}Token`) ||
                    localStorage.getItem('adminToken') ||
                    localStorage.getItem('auditorToken') ||
                    localStorage.getItem('profToken') ||
                    localStorage.getItem('studentToken')
                const res = await axios.get(`/api/search?q=${encodeURIComponent(query)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setSearchResults(res.data)
            } catch (err) {
                console.error('Search error', err)
            } finally {
                setIsSearching(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    const handleClose = () => { onClose(); setQuery('') }
    const handleSelect = (path) => { navigate(path); handleClose() }
    const hasResults = searchResults.students?.length > 0 || searchResults.professors?.length > 0 || searchResults.batches?.length > 0 || searchResults.exams?.length > 0

    return (
        <Command.Dialog
            open={open}
            onOpenChange={(val) => { if (!val) handleClose() }}
            label="Global Command Menu"
            className="command-dialog"
            shouldFilter={false}
        >
            <div className="command-palette-content">
                {/* Input row */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <Search size={17} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <Command.Input
                        placeholder={
                            role === 'admin' ? "Search admin workspace or navigate…" :
                            role === 'professor' ? "Search your batches, exams, or navigate…" :
                            role === 'student' ? "Search your exams, results, or navigate…" :
                            role === 'auditor' ? "Search audit logs or navigate…" :
                            "Search or navigate…"
                        }
                        className="command-input"
                        autoFocus
                        value={query}
                        onValueChange={setQuery}
                        style={{ flex: 1, border: 'none', padding: 0, background: 'transparent',
                                 fontSize: 15, color: 'var(--text-primary)', outline: 'none' }}
                    />
                    {query && (
                        <button onClick={() => setQuery('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                                     color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}
                            aria-label="Clear search">
                            <X size={15} />
                        </button>
                    )}
                    <kbd style={{
                        fontSize: 11, padding: '3px 7px', borderRadius: 6,
                        background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
                        border: '1px solid var(--border-subtle)', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center'
                    }}>ESC</kbd>
                </div>

                {/* Icon grid when no query */}
                {!query && <NavGrid role={role} onSelect={handleSelect} />}

                {/* Live results */}
                {query && (
                    <Command.List style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 10px' }}>
                        {isSearching && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                                          padding: '16px 10px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                <div className="search-spinner" />
                                Searching…
                            </div>
                        )}
                        {!isSearching && !hasResults && (
                            <Command.Empty>
                                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
                                    <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                    <div style={{ fontSize: 14 }}>No results for "{query}"</div>
                                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>Try a different name or email</div>
                                </div>
                            </Command.Empty>
                        )}
                        {searchResults.students.length > 0 && (
                            <Command.Group heading="Students">
                                {searchResults.students.map(s => (
                                <Command.Item key={s._id} onSelect={() => handleSelect(`/admin/students?studentId=${s._id}`)}
                                        style={{ borderRadius: 10, margin: '2px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 700
                                            }}>
                                                {s.name?.substring(0, 2).toUpperCase() || 'ST'}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {s.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {s.email}{s.department ? ` • ${s.department}` : ''}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                                background: 'rgba(16,185,129,0.1)', color: '#10b981',
                                                border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap'
                                            }}>Student</span>
                                        </div>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                        {searchResults.professors.length > 0 && (
                            <Command.Group heading="Professors">
                                {searchResults.professors.map(p => (
                                <Command.Item key={p._id} onSelect={() => handleSelect(`/admin/professors?professorId=${p._id}`)}
                                        style={{ borderRadius: 10, margin: '2px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                background: 'rgba(99,102,241,0.12)', color: '#6366f1',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 700
                                            }}>
                                                {p.name?.substring(0, 2).toUpperCase() || 'PR'}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {p.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {p.email}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                                background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                                                border: '1px solid rgba(99,102,241,0.3)', whiteSpace: 'nowrap'
                                            }}>Professor</span>
                                        </div>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                        {searchResults.batches?.length > 0 && (
                            <Command.Group heading="Batches">
                                {searchResults.batches.map(b => (
                                <Command.Item key={b._id} onSelect={() => handleSelect(`/${role}/batches?batchId=${b._id}`)}
                                        style={{ borderRadius: 10, margin: '2px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 700
                                            }}>
                                                {b.name?.substring(0, 2).toUpperCase() || 'BA'}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {b.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {b.subject} {b.status ? `• ${b.status}` : ''}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                                                border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap'
                                            }}>Batch</span>
                                        </div>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                        {searchResults.exams?.length > 0 && (
                            <Command.Group heading="Exams">
                                {searchResults.exams.map(e => (
                                <Command.Item key={e._id} onSelect={() => handleSelect(`/${role}/exams?examId=${e._id}`)}
                                        style={{ borderRadius: 10, margin: '2px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                background: 'rgba(236,72,153,0.12)', color: '#ec4899',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 700
                                            }}>
                                                {e.title?.substring(0, 2).toUpperCase() || 'EX'}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {e.title}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)',
                                                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {e.status}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                                background: 'rgba(236,72,153,0.1)', color: '#ec4899',
                                                border: '1px solid rgba(236,72,153,0.3)', whiteSpace: 'nowrap'
                                            }}>Exam</span>
                                        </div>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                    </Command.List>
                )}

                <PaletteFooter />
            </div>
        </Command.Dialog>
    )
}

// ─── Public export ─────────────────────────────────────────────────────────────
export const CommandPalette = ({ open, onClose }) => {
    const location = useLocation()
    const role = location.pathname.split('/')[1] || 'student'

    return <SearchPalette open={open} onClose={onClose} role={role} />
}
