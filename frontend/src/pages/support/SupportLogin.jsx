import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import AuthShell from '../../components/auth/AuthShell';
import '../Login.css'; // Make sure styles are loaded if AuthShell doesn't import them

export default function SupportLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForceLogin, setShowForceLogin] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e, forceLogout = false) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/support/login', { email, password, forceLogout });
            if (res.data.success) {
                localStorage.setItem('supportToken', res.data.token);
                navigate('/support');
            }
        } catch (err) {
            if (err.response?.status === 409 && err.response?.data?.code === "ALREADY_LOGGED_IN") {
                setShowForceLogin(true);
                return;
            }
            setError(err.response?.data?.message || 'Invalid credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            title="Support Portal"
            subtitle="Sign in to the ZeroLeak Support Dashboard to manage tickets."
            badge="SYSTEM ACCESS"
        >
            <form className="auth-form" onSubmit={handleLogin}>
                {error && <div className="auth-error" role="alert">{error}</div>}

                {showForceLogin && (
                    <div style={{
                        padding: '16px',
                        marginBottom: '24px',
                        background: 'var(--warning-subtle, rgba(245, 158, 11, 0.1))',
                        border: '1px solid var(--warning)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <AlertTriangle size={20} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                            <div>
                                <h4 style={{ color: 'var(--warning)', fontSize: '15px', fontWeight: '600', marginBottom: '6px', margin: 0 }}>Active Session Detected</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                                    You are currently logged in on another device. Logging in here will terminate your other session. Do you want to proceed?
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <button 
                                type="button" 
                                onClick={(e) => handleLogin(e, true)} 
                                style={{ flex: 1, padding: '10px', background: 'var(--warning)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                onMouseOver={e => e.target.style.opacity = 0.9}
                                onMouseOut={e => e.target.style.opacity = 1}
                            >
                                End Other Session
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setShowForceLogin(false)} 
                                style={{ flex: 1, padding: '10px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseOver={e => e.target.style.background = 'var(--bg-hover)'}
                                onMouseOut={e => e.target.style.background = 'var(--bg-elevated)'}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="auth-input-group">
                    <label htmlFor="support-email">Support Email</label>
                    <div className="auth-input-wrapper">
                        <Mail className="auth-input-icon" size={18} />
                        <input
                            id="support-email"
                            type="email"
                            className="auth-input"
                            placeholder="Enter support email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            autoComplete="email"
                        />
                    </div>
                </div>

                <div className="auth-input-group">
                    <label htmlFor="support-password">Password</label>
                    <div className="auth-input-wrapper">
                        <Lock className="auth-input-icon" size={18} />
                        <input
                            id="support-password"
                            type={showPassword ? 'text' : 'password'}
                            className="auth-input"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            disabled={loading}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 size={18} className="spin" />
                            Authenticating...
                        </>
                    ) : (
                        'Login'
                    )}
                </button>
            </form>
        </AuthShell>
    );
}
