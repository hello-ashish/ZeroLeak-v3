import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { useToast } from '../../components/Toast.jsx'
import { User, Palette, Lock, Info, Moon, Sun, AlertTriangle, Cpu, Globe, Database, Building2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

export default function AdminSettingsPage() {
    const [activeSection, setActiveSection] = useState('profile')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [saving, setSaving] = useState(false)
    const { themeMode, themeProgress, isDark, setTheme } = useTheme()
    const navigate = useNavigate()
    const toast = useToast()

    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}')

    useEffect(() => {
        setEmail(adminData.email || '')
    }, [])

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        if (password && password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (password && password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        setSaving(true)
        try {
            const body = {}
            if (email && email !== adminData.email) body.email = email
            if (password) body.password = password
            if (Object.keys(body).length === 0) {
                toast.info('No changes to save')
                return
            }
            await axios.put(`${API}/admin/profile`, body, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Profile updated successfully')
            setPassword('')
            setConfirmPassword('')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const SECTIONS = [
        { id: 'profile', label: 'Admin Profile', icon: <User size={18} /> },
        { id: 'appearance', label: 'Appearance & Theme', icon: <Palette size={18} /> },
        { id: 'communications', label: 'Communications', icon: <Info size={18} /> },
        { id: 'security', label: 'Security', icon: <Lock size={18} /> },
        { id: 'about', label: 'Platform Info', icon: <Info size={18} /> },
    ]

    return (
        <AdminLayout>
            <div className="page-header" style={{ marginBottom: 32 }}>
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Platform Settings</h1>
                        <p className="page-subtitle">Configure your administrative preferences and environment</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, alignItems: 'start' }}>
                {/* Sidebar Nav */}
                <div style={{ position: 'sticky', top: 'var(--topbar-height)', paddingTop: 24, marginTop: -24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {SECTIONS.map(s => (
                            <button
                                key={s.id}
                                className={`nav-item w-full ${activeSection === s.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(s.id)}
                                style={{
                                    justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                    fontSize: 14, fontWeight: activeSection === s.id ? 600 : 500,
                                    background: activeSection === s.id ? 'var(--bg-active)' : 'transparent',
                                    color: activeSection === s.id ? 'var(--brand-primary)' : 'var(--text-secondary)'
                                }}
                            >
                                {s.icon}
                                <span>{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ minWidth: 0, paddingBottom: 60 }}>
                    {activeSection === 'profile' && (
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px 32px' }}>
                                <h2 className="card-title" style={{ fontSize: 18 }}>Profile Information</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Manage your contact details and administrative identity.</p>
                            </div>
                            <form className="card-body" style={{ padding: '0 32px 32px' }} onSubmit={handleSaveProfile}>
                                <div className="flex items-center gap-6" style={{ padding: '24px 0', borderBottom: '1px solid var(--border-default)', marginBottom: 24 }}>
                                    <div className="avatar avatar-xl" style={{ width: 80, height: 80, fontSize: 32, background: 'var(--brand-primary)', color: '#fff' }}>
                                        {adminData.email?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>{adminData.email?.split('@')[0]}</p>
                                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>{adminData.email}</p>
                                        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <ShieldCheck size={14} /> System Administrator
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group" style={{ maxWidth: 480 }}>
                                    <label className="form-label">Admin ID</label>
                                    <input className="form-input" value={adminData.adminId || '—'} disabled style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--bg-surface)' }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>Admin ID is immutable and serves as your permanent system identifier.</span>
                                </div>
                                <div className="form-group" style={{ maxWidth: 480 }}>
                                    <label className="form-label">Email Address</label>
                                    <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>
                                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-default)' }}>
                                    <button className="btn btn-primary" type="submit" disabled={saving || email === adminData.email}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeSection === 'appearance' && (
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px 32px' }}>
                                <h2 className="card-title" style={{ fontSize: 18 }}>Appearance & Color Theme</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Customize your command center theme and continuous brightness level.</p>
                            </div>
                            <div className="card-body" style={{ padding: '28px 32px 36px' }}>
                                {/* Theme Presets */}
                                <div style={{ marginBottom: 32 }}>
                                    <label className="form-label" style={{ display: 'block', marginBottom: 16 }}>Theme Mode</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                        {[
                                            { id: 'dark', label: 'Dark Mode', desc: 'Cyberpunk black & high contrast', icon: <Moon size={20} color="#8b5cf6" />, bg: '#09090b', border: '#27272a', text: '#f4f4f5' },
                                            { id: 'mid', label: 'Midnight Slate', desc: '50% charcoal & slate contrast', icon: <Palette size={20} color="#3b82f6" />, bg: '#1f2229', border: '#334155', text: '#f8fafc' },
                                            { id: 'light', label: 'Light Mode', desc: 'Crisp academic paper white', icon: <Sun size={20} color="#f59e0b" />, bg: '#ffffff', border: '#e4e4e7', text: '#09090b' },
                                            { id: 'system', label: 'System Default', desc: 'Follows operating system schedule', icon: <Globe size={20} color="#10b981" />, bg: 'var(--bg-elevated)', border: 'var(--border-default)', text: 'var(--text-primary)' },
                                        ].map(preset => {
                                            const isSelected = themeMode === preset.id || (preset.id === 'dark' && themeProgress === 0 && themeMode !== 'system') || (preset.id === 'light' && themeProgress === 100 && themeMode !== 'system') || (preset.id === 'mid' && themeProgress === 50 && themeMode !== 'system');
                                            return (
                                                <div
                                                    key={preset.id}
                                                    onClick={() => setTheme(preset.id)}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: 'var(--radius-lg)',
                                                        background: preset.bg,
                                                        color: preset.text,
                                                        border: isSelected ? '2px solid var(--brand-primary)' : `1px solid ${preset.border}`,
                                                        boxShadow: isSelected ? '0 0 0 3px var(--brand-primary-subtle), var(--shadow-md)' : 'var(--shadow-sm)',
                                                        cursor: 'pointer',
                                                        transition: 'all var(--transition-fast)',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                        <div style={{ padding: 8, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-md)', display: 'inline-flex' }}>
                                                            {preset.icon}
                                                        </div>
                                                        {isSelected && (
                                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'var(--brand-primary)', color: '#fff' }}>
                                                                ACTIVE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{preset.label}</div>
                                                    <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>{preset.desc}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Precision Brightness Slider */}
                                <div style={{ paddingTop: 28, borderTop: '1px solid var(--border-default)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Continuous Theme Brightness</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Smoothly blend from 0% pure dark to 100% light</div>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
                                            {themeProgress}% ({isDark ? 'Dark Mode' : 'Light Mode'})
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <Moon size={16} style={{ color: 'var(--text-tertiary)' }} />
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={themeProgress}
                                            onChange={(e) => setTheme(Number(e.target.value))}
                                            style={{ flex: 1, accentColor: 'var(--brand-primary)', height: 6, cursor: 'pointer' }}
                                        />
                                        <Sun size={16} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'communications' && (
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px 32px' }}>
                                <h2 className="card-title" style={{ fontSize: 18 }}>Global Communications</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Draft and send platform-wide announcements.</p>
                            </div>
                            <div className="card-body" style={{ padding: '0 32px 32px' }}>
                                <div style={{ background: 'var(--brand-primary-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--brand-primary-border)', marginBottom: 24 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>AI Policy Writer</h4>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Jot down a rough idea and let the AI rewrite it into a professional, policy-compliant announcement.</p>

                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: 80, background: 'var(--bg-surface)', marginBottom: 12 }}
                                        placeholder="e.g. tell students no cheating allowed or we block them"
                                        id="draft-text"
                                    />

                                    <button
                                        className="btn btn-secondary"
                                        style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none' }}
                                        onClick={async () => {
                                            const draft = document.getElementById('draft-text')?.value;
                                            if (!draft?.trim()) return;
                                            const outputEl = document.getElementById('ai-rewrite-result');
                                            try {
                                                if (outputEl) outputEl.value = 'Generating...';
                                                const res = await axios.post(`${API}/ai/admin/policy-rewrite`, { draft }, { headers: { Authorization: `Bearer ${getToken()}` } });
                                                if (outputEl) outputEl.value = res.data.rewrittenText;
                                            } catch (err) {
                                                if (outputEl) outputEl.value = '';
                                                toast.error(err.response?.data?.message || 'AI Rewrite failed');
                                            }
                                        }}
                                    >
                                        Auto-Rewrite
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Final Announcement Text</label>
                                    <textarea
                                        id="ai-rewrite-result"
                                        className="form-textarea"
                                        style={{ minHeight: 160 }}
                                        placeholder="The professional announcement will appear here..."
                                    />
                                </div>

                                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={async () => {
                                            const message = document.getElementById('ai-rewrite-result').value;
                                            if (!message.trim()) {
                                                toast.error('Announcement text is empty');
                                                return;
                                            }
                                            try {
                                                await axios.post(`${API}/admin/broadcast`, { message }, { headers: { Authorization: `Bearer ${getToken()}` } });
                                                toast.success('Announcement broadcasted to all students!');
                                                document.getElementById('draft-text').value = '';
                                                document.getElementById('ai-rewrite-result').value = '';
                                            } catch (error) {
                                                toast.error('Failed to broadcast announcement');
                                            }
                                        }}
                                    >
                                        Broadcast Announcement
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'security' && (
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px 32px' }}>
                                <h2 className="card-title" style={{ fontSize: 18 }}>Security Settings</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Update your password and secure your account.</p>
                            </div>
                            <form className="card-body" style={{ padding: '0 32px 32px' }} onSubmit={handleSaveProfile}>
                                <div className="form-group" style={{ maxWidth: 480 }}>
                                    <label className="form-label">New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 70 }} />
                                        <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>
                                            {showPass ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group" style={{ maxWidth: 480 }}>
                                    <label className="form-label">Confirm New Password</label>
                                    <input className="form-input" type="password" placeholder="Repeat the new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                    {confirmPassword && password !== confirmPassword && (
                                        <span className="form-error flex items-center gap-1 mt-1"><AlertTriangle size={14} /> Passwords do not match</span>
                                    )}
                                </div>
                                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-default)' }}>
                                    <button className="btn btn-primary" type="submit" disabled={saving || !password}>
                                        {saving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeSection === 'about' && (
                        <div className="card">
                            <div className="card-header" style={{ padding: '24px 32px' }}>
                                <h2 className="card-title" style={{ fontSize: 18 }}>About ZeroLeak</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>System information and infrastructure details.</p>
                            </div>
                            <div className="card-body" style={{ padding: '0 32px 32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border-default)' }}>
                                    <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'white', boxShadow: '0 10px 30px -10px var(--brand-primary)' }}>ZL</div>
                                    <div>
                                        <p style={{ fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>ZeroLeak</p>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Academic Command Center · Edition 2.0</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                    {[
                                        { icon: <Globe size={18} />, k: 'Platform', v: 'Zero Trust Academic System' },
                                        { icon: <Cpu size={18} />, k: 'Core Engine', v: 'Vite + React 19' },
                                        { icon: <Database size={18} />, k: 'Infrastructure', v: 'Node.js + MongoDB' },
                                        { icon: <Building2 size={18} />, k: 'Developed By', v: 'Team ZeroLeak' },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ color: 'var(--text-tertiary)' }}>{item.icon}</div>
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.k}</div>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>{item.v}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}

function ShieldCheck(props) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
}
