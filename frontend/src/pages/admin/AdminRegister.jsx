import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  UserPlus, 
  Loader2, 
  BadgeCheck, 
  Key, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';

const AdminRegister = () => {
  const navigate = useNavigate();
  const [adminId, setAdminId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationSecret, setRegistrationSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecretHelp, setShowSecretHelp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!adminId.trim()) {
      setError('Admin ID is required.');
      return;
    }

    if (!email.trim()) {
      setError('Admin email is required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        adminId: adminId.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      };

      if (registrationSecret.trim()) {
        payload.registrationSecret = registrationSecret.trim();
      }

      const response = await axios.post('/api/admin/register', payload);

      setSuccessData(response.data);
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Service is not responding. Please verify server connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Register Root Admin"
      subtitle="Provision the master administrator account for the ZeroLeak platform."
      badge="ROOT PROVISIONING"
    >
      {successData ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '24px',
          background: 'var(--success-subtle, rgba(16, 185, 129, 0.08))',
          border: '1px solid var(--success-border, rgba(16, 185, 129, 0.3))',
          borderRadius: '16px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--success, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                Admin Provisioned Successfully
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Your master account has been created and registered.
              </p>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.9rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Admin ID:</span>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{successData.adminId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Admin Email:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{successData.email}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            className="auth-submit-btn"
            style={{ marginTop: '8px' }}
          >
            <span>Proceed to Admin Sign In</span>
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleRegister}>
          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Admin ID */}
          <div className="auth-input-group">
            <label htmlFor="admin-id">Admin ID</label>
            <div className="auth-input-wrapper">
              <BadgeCheck className="auth-input-icon" size={18} />
              <input
                id="admin-id"
                type="text"
                className="auth-input"
                placeholder="e.g. ADM-001 or admin_master"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Email */}
          <div className="auth-input-group">
            <label htmlFor="admin-email">Admin Email</label>
            <div className="auth-input-wrapper">
              <Mail className="auth-input-icon" size={18} />
              <input
                id="admin-email"
                type="email"
                className="auth-input"
                placeholder="master@zeroleak.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="auth-input-group">
            <label htmlFor="admin-password">Master Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={18} />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter master password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div className="auth-input-group">
            <label htmlFor="admin-confirm-password">Confirm Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={18} />
              <input
                id="admin-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Re-enter master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Optional Registration Secret */}
          <div className="auth-input-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="admin-secret" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Registration Secret
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '400' }}>(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSecretHelp((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                <HelpCircle size={14} />
                <span>{showSecretHelp ? 'Hide info' : 'What is this?'}</span>
              </button>
            </div>

            {showSecretHelp && (
              <p style={{
                margin: '4px 0 6px 0',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem',
                lineHeight: '1.4'
              }}>
                Only required if <code>ADMIN_REGISTRATION_SECRET</code> is configured in your server's <code>.env</code> file. Leave empty if no registration secret was set.
              </p>
            )}

            <div className="auth-input-wrapper">
              <Key className="auth-input-icon" size={18} />
              <input
                id="admin-secret"
                type="password"
                className="auth-input"
                placeholder="Enter server secret if configured"
                value={registrationSecret}
                onChange={(e) => setRegistrationSecret(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Provisioning Account...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Register Root Admin</span>
              </>
            )}
          </button>

          {/* Links */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '8px',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)'
          }}>
            <span>Already have an admin account?</span>
            <Link
              to="/admin/login"
              style={{
                color: 'var(--brand-primary)',
                fontWeight: '600',
                marginLeft: '6px',
                textDecoration: 'none'
              }}
            >
              Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default AdminRegister;
