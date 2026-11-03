import React from 'react';
import { Sun, Moon, Palette, Globe } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

const StudentSettingsPage = () => {
    const { themeMode, themeProgress, isDark, setTheme } = useTheme();

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 48 }}>
            <div className="page-header" style={{ marginBottom: 32 }}>
                <h1 className="page-title" style={{ fontSize: 26, letterSpacing: '-0.02em' }}>Settings & Preferences</h1>
                <p className="page-subtitle" style={{ fontSize: 14 }}>Personalize your academic workspace experience.</p>
            </div>

            <div className="card">
                <div className="card-header" style={{ padding: '24px 32px' }}>
                    <h2 className="card-title" style={{ fontSize: 18 }}>Appearance & Color Theme</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Select your preferred theme and continuous brightness level.</p>
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
        </div>
    );
};

export default StudentSettingsPage;
