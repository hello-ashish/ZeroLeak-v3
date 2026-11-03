import React, { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2, AlertTriangle } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';

const ProfessorLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showForceLogin, setShowForceLogin] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e, forceLogout = false) => {
        if (e) e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await axios.post('/api/professor/login', {
                email,
                password,
                forceLogout
            })

            const { token, professor } = response.data

            localStorage.setItem('profToken', token)
            localStorage.setItem('profData', JSON.stringify(professor))

            navigate('/professor/dashboard')
        } catch (err) {
            if (err.response?.status === 409 && err.response?.data?.code === "ALREADY_LOGGED_IN") {
                setShowForceLogin(true);
                return;
            }
            if (err.response) setError(err.response.data.message);
            else setError('Server is not responding.');
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthShell 
          title="Professor Workspace" 
          subtitle="Create assessments, manage academic content, and review outcomes."
        >
          <form className="auth-form" onSubmit={(e) => handleLogin(e, false)}>
            {error && <div className="auth-error" role="alert">{error}</div>}
            
            {showForceLogin && (
                <div style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.08)', 
                    border: '1px solid rgba(234, 179, 8, 0.3)', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={20} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <h4 style={{ color: 'var(--warning)', fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Active Session Detected</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
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
              <label htmlFor="prof-email">Professor Email</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={18} />
                <input
                  id="prof-email"
                  type="email"
                  className="auth-input"
                  placeholder="Enter professor email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>
            
            <div className="auth-input-group">
              <label htmlFor="prof-password">Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  id="prof-password"
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
                  Signing you in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </AuthShell>
    )
}

export default ProfessorLogin