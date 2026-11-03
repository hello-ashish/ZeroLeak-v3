import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, BrainCircuit, Users, BookOpen, GraduationCap, Settings, ShieldAlert, ChevronRight, Activity, AlertCircle, Sun, Moon } from 'lucide-react';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle.jsx';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'unauthorized') {
      setErrorMsg('Unauthorized access. Please log in with the correct credentials.');
    }
  }, [location]);

  const handleRoleSelect = (path, role) => {
    setErrorMsg('');
    setSelectedRole(role);
    setIsLoading(true);
    // Simulate a brief loading state for a premium transition
    setTimeout(() => {
      navigate(path);
    }, 600);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', minHeight: '100vh', overflow: 'hidden' }}>
      <div className="home-wrapper" style={{ width: '100%', height: '100%' }}>
        <div className="home-container">
          {/* Left Information Section */}
          <div className="home-info-section">
            <div className="brand-header">
              <img src="/logo.png" alt="ZeroLeak Logo" className="brand-logo" />
              <div>
                <h1 className="brand-title">ZeroLeak</h1>
                <span className="brand-subtitle">Academic Intelligence Platform</span>
              </div>
            </div>
            
            <h2 className="brand-statement">Secure every assessment.<br/>Understand every outcome.</h2>

            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <ShieldCheck size={20} />
                </div>
                <div className="feature-text">
                  <h3>Secure Assessment</h3>
                  <p>Integrity for every examination session.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <BrainCircuit size={20} />
                </div>
                <div className="feature-text">
                  <h3>Academic Intelligence</h3>
                  <p>Comprehensive reports and insights into student performance.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon-wrapper">
                  <Users size={20} />
                </div>
                <div className="feature-text">
                  <h3>Role-Based Access</h3>
                  <p>Dedicated portals for students, professors, and administration.</p>
                </div>
              </div>
            </div>

            <div className="system-status">
              <div className="status-indicator live"></div>
              <span className="status-text">All Systems Operational</span>
            </div>
          </div>

          {/* Right Role Selection Section */}
          <div className="home-login-section">
            <div className="login-panel">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <HeaderThemeToggle />
              </div>
              <div className="panel-header">
                <h2>Choose your workspace</h2>
                <p>Select your role to continue to the authentication gateway.</p>
              </div>

              {errorMsg && (
                <div className="gateway-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="role-groups" role="navigation" aria-label="Role selection">
                <div className="role-group">
                  <h3 className="group-title">ACADEMIC</h3>
                  <button 
                    className={`role-card ${selectedRole === 'student' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect('/student/login', 'student')}
                    disabled={isLoading}
                    aria-label="Login as Student"
                  >
                    <div className="role-card-icon student-icon">
                      <BookOpen size={20} />
                    </div>
                    <div className="role-card-content">
                      <h4>Student</h4>
                      <p>Take exams, view results, track progress</p>
                    </div>
                    <ChevronRight size={18} className="role-card-arrow" />
                  </button>

                  <button 
                    className={`role-card ${selectedRole === 'professor' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect('/professor/login', 'professor')}
                    disabled={isLoading}
                    aria-label="Login as Professor"
                  >
                    <div className="role-card-icon professor-icon">
                      <GraduationCap size={20} />
                    </div>
                    <div className="role-card-content">
                      <h4>Professor</h4>
                      <p>Create and manage academic content</p>
                    </div>
                    <ChevronRight size={18} className="role-card-arrow" />
                  </button>
                </div>

                <div className="role-group">
                  <h3 className="group-title">OPERATIONS</h3>
                  <button 
                    className={`role-card operations-card ${selectedRole === 'admin' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect('/admin/login', 'admin')}
                    disabled={isLoading}
                    aria-label="Login as Administrator"
                  >
                    <div className="role-card-icon admin-icon">
                      <Settings size={20} />
                    </div>
                    <div className="role-card-content">
                      <div className="role-card-header">
                        <h4>Administrator</h4>
                        <span className="auth-badge">Authorized Access</span>
                      </div>
                      <p>Manage the academic platform</p>
                    </div>
                    <ChevronRight size={18} className="role-card-arrow" />
                  </button>

                  <button 
                    className={`role-card operations-card ${selectedRole === 'auditor' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect('/auditor/login', 'auditor')}
                    disabled={isLoading}
                    aria-label="Login as Auditor"
                  >
                    <div className="role-card-icon auditor-icon">
                      <ShieldAlert size={20} />
                    </div>
                    <div className="role-card-content">
                      <div className="role-card-header">
                        <h4>Auditor</h4>
                        <span className="auth-badge">Authorized Access</span>
                      </div>
                      <p>Review activity, integrity, and evidence</p>
                    </div>
                    <ChevronRight size={18} className="role-card-arrow" />
                  </button>

                  <button 
                    className={`role-card operations-card ${selectedRole === 'support' ? 'selected' : ''}`}
                    onClick={() => handleRoleSelect('/support/login', 'support')}
                    disabled={isLoading}
                    aria-label="Login as Support Staff"
                  >
                    <div className="role-card-icon" style={{ color: 'var(--brand-primary)', background: 'rgba(99,102,241,0.1)' }}>
                      <AlertCircle size={20} />
                    </div>
                    <div className="role-card-content">
                      <div className="role-card-header">
                        <h4>Support Staff</h4>
                        <span className="auth-badge">System Access</span>
                      </div>
                      <p>Manage support tickets and user reports</p>
                    </div>
                    <ChevronRight size={18} className="role-card-arrow" />
                  </button>
                </div>
              </div>

              {isLoading && (
                <div className="loading-overlay">
                  <div className="spinner">
                    <Activity size={24} className="spin-icon" />
                  </div>
                  <span>Securing connection...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
