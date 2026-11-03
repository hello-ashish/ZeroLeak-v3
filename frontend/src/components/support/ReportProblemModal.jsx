/**
 * ReportProblemModal — Polished modal for submitting support tickets.
 * Automatically captures page context. Accepts optional contextual props.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Send, Loader2, CheckCircle, MapPin, GraduationCap } from 'lucide-react';
import { createSupportTicket, fetchSupportConstants } from '../../hooks/useSupport.js';
import { useToast } from '../Toast.jsx';
import { useLocation } from 'react-router-dom';

const PRIORITY_LABELS = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
};

const CATEGORY_LABELS = {
    technical_issue:        'Technical Issue',
    login_authentication:   'Login / Authentication',
    exam_issue:             'Exam Issue',
    proctoring_issue:       'Proctoring Issue',
    question_content_issue: 'Question / Content Issue',
    submission_issue:       'Submission Issue',
    account_issue:          'Account Issue',
    performance_issue:      'Performance Issue',
    bug_report:             'Bug Report',
    security_concern:       'Security Concern',
    other:                  'Other',
};

export function ReportProblemModal({ onClose, examId, sessionId, context }) {
    const toast = useToast();
    const location = useLocation();

    // Auto-detect which role's token is in localStorage for this session
    const callerRole = localStorage.getItem('adminToken') ? 'admin'
        : localStorage.getItem('profToken') ? 'professor'
        : localStorage.getItem('studentToken') ? 'student'
        : localStorage.getItem('auditorToken') ? 'auditor'
        : undefined;

    const [categories, setCategories] = useState(Object.keys(CATEGORY_LABELS));
    const [form, setForm] = useState({
        title: '',
        category: 'technical_issue',
        priority: 'normal',
        description: '',
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [ticketNumber, setTicketNumber] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        fetchSupportConstants(callerRole)
            .then(data => setCategories(data.categories || Object.keys(CATEGORY_LABELS)))
            .catch(() => {});
    }, [callerRole]);

    const validate = () => {
        const errs = {};
        if (!form.title.trim()) errs.title = 'Title is required.';
        if (!form.description.trim()) errs.description = 'Description is required.';
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        try {
            const idempotencyKey = `report_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const result = await createSupportTicket({
                title: form.title.trim(),
                description: form.description.trim(),
                category: form.category,
                reportedPriority: form.priority,
                sourceRoute: location.pathname,
                metadata: {
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    ...(context || {}),
                },
                relatedExamId: examId || null,
                relatedSessionId: sessionId || null,
                idempotencyKey,
            }, callerRole);
            setTicketNumber(result.ticket?.ticketNumber || '');
            setSubmitted(true);
            window.dispatchEvent(new CustomEvent('support-ticket-created'));
        } catch (err) {
            toast.error(err.message || 'Failed to submit report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const set = (key) => (e) => {
        setForm(f => ({ ...f, [key]: e.target.value }));
        if (errors[key]) setErrors(err => ({ ...err, [key]: undefined }));
    };

    // Trap focus
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div className="support-modal-backdrop" role="dialog" aria-modal="true" aria-label="Report a Problem">
            <div className="support-modal">
                <div className="support-modal-header">
                    <div className="support-modal-title-row">
                        <AlertCircle size={20} className="support-modal-icon" />
                        <h2 className="support-modal-title">Report a Problem</h2>
                    </div>
                    <button type="button" className="support-modal-close" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {submitted ? (
                    <div className="support-modal-success">
                        <CheckCircle size={48} className="support-success-icon" />
                        <h3>Report submitted!</h3>
                        {ticketNumber && (
                            <p className="support-ticket-ref">
                                Your ticket number is <strong>{ticketNumber}</strong>
                            </p>
                        )}
                        <p className="support-success-msg">
                            The support team has been notified. You'll receive a response via ZeroleakMail.
                            You can track your request under <em>My Support Requests</em>.
                        </p>
                        <button type="button" className="btn btn-primary" onClick={onClose}>
                            Got it
                        </button>
                    </div>
                ) : (
                    <form className="support-modal-form" onSubmit={handleSubmit} noValidate>
                        <div className="support-form-row">
                            <label className="support-label" htmlFor="sp-title">Title *</label>
                            <input
                                id="sp-title"
                                className={`support-input ${errors.title ? 'support-input-error' : ''}`}
                                type="text"
                                placeholder="Brief summary of the problem"
                                value={form.title}
                                onChange={set('title')}
                                maxLength={255}
                                autoFocus
                            />
                            {errors.title && <span className="support-error-msg">{errors.title}</span>}
                        </div>

                        <div className="support-form-row support-form-row-2">
                            <div className="support-form-col">
                                <label className="support-label" htmlFor="sp-category">Category</label>
                                <select id="sp-category" className="support-select" value={form.category} onChange={set('category')}>
                                    {categories.map(c => (
                                        <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="support-form-col">
                                <label className="support-label" htmlFor="sp-priority">Priority</label>
                                <select id="sp-priority" className="support-select" value={form.priority} onChange={set('priority')}>
                                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="support-form-row">
                            <label className="support-label" htmlFor="sp-description">Description *</label>
                            <textarea
                                id="sp-description"
                                className={`support-textarea ${errors.description ? 'support-input-error' : ''}`}
                                placeholder="Please describe the problem in detail. What did you expect to happen? What actually happened?"
                                value={form.description}
                                onChange={set('description')}
                                maxLength={5000}
                                rows={6}
                            />
                            {errors.description && <span className="support-error-msg">{errors.description}</span>}
                        </div>

                        <div className="support-form-row support-context-row">
                            <span className="support-context-label">
                                <MapPin size={15} /> Page / Feature
                            </span>
                            <span className="support-context-value">{location.pathname}</span>
                        </div>

                        {(examId || sessionId) && (
                            <div className="support-form-row support-context-row">
                                <span className="support-context-label">
                                    <GraduationCap size={15} /> Related Exam
                                </span>
                                <span className="support-context-value">{examId || sessionId}</span>
                            </div>
                        )}

                        <div className="support-modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary support-submit-btn" disabled={loading}>
                                {loading ? (
                                    <><Loader2 size={16} className="spin" /> Sending…</>
                                ) : (
                                    <><Send size={16} /> Send Report</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
