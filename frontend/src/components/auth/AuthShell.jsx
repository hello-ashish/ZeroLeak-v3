import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, BrainCircuit, Users, ArrowLeft } from 'lucide-react';
import './Auth.css';

import { HeaderThemeToggle } from '../HeaderThemeToggle.jsx';

const AuthShell = ({ title, subtitle, badge, children }) => {
  return (
    <div className="auth-wrapper">
      <div className="auth-container auth-slomo-panel">
        {/* Left Information Section */}
        <div className="auth-info-section">
          <div className="auth-brand-header">
            <img src="/logo.png" alt="ZeroLeak Logo" className="auth-brand-logo" />
            <div>
              <h1 className="auth-brand-title">ZeroLeak</h1>
              <span className="auth-brand-subtitle">Academic Intelligence Platform</span>
            </div>
          </div>

          <h2 className="auth-statement">Secure every assessment.<br />Understand every outcome.</h2>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrapper">
                <ShieldCheck size={20} />
              </div>
              <div className="auth-feature-text">
                <h3>Secure Assessment</h3>
                <p>Integrity for every examination session.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrapper">
                <BrainCircuit size={20} />
              </div>
              <div className="auth-feature-text">
                <h3>Academic Intelligence</h3>
                <p>Comprehensive reports and insights into student performance.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-wrapper">
                <Users size={20} />
              </div>
              <div className="auth-feature-text">
                <h3>Role-Based Access</h3>
                <p>Dedicated portals for students, professors, and administration.</p>
              </div>
            </div>
          </div>

          <div className="auth-system-status">
            <div className="auth-status-indicator live"></div>
            <span className="auth-status-text">All Systems Operational</span>
          </div>
        </div>

        {/* Right Login Section */}
        <div className="auth-form-section">
          <div className="auth-form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <Link to="/" className="auth-back-link" style={{ marginBottom: 0 }}>
                  <ArrowLeft size={16} />
                  Back to Workspace Selection
                </Link>
                <HeaderThemeToggle />
            </div>

            <div className="auth-form-header">
              <span className="auth-welcome">Welcome Back</span>
              <div className="auth-role-header">
                <h2 className="auth-role-title">{title}</h2>
                {badge && <span className="auth-role-badge">{badge}</span>}
              </div>
              <p className="auth-role-subtitle">{subtitle}</p>
            </div>

            <div className="auth-form-content">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
