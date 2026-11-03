import React, { useEffect, useState, useRef, useCallback } from 'react';
import "./TakeExam.css";
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight,
    Flag, Maximize2, Minimize2, Edit3, Bookmark, HelpCircle,
    PanelRightClose, PanelRightOpen, X, Activity, LayoutDashboard,
    ShieldAlert, AlertTriangle, Lock
} from 'lucide-react';
import { useAntiCheating } from '../../utils/useAntiCheating';
import { useProctoring } from '../../hooks/useProctoring';
import { ProctoringStatusPanel } from '../../components/ProctoringStatusPanel';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_WARNINGS = 5;

const TakeExam = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);

    // Core State
    const [isStarted, setIsStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [confidenceLevels, setConfidenceLevels] = useState({});
    const [scratchpad, setScratchpad] = useState("");
    const [score, setScore] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [showPreSubmit, setShowPreSubmit] = useState(false);
    const [saveStatus, setSaveStatus] = useState("Saved");
    const [toolsOpen, setToolsOpen] = useState(false);
    const [isRestricted, setIsRestricted] = useState(false);

    // Anti-Cheating State
    const [warningCount, setWarningCount] = useState(0);
    const [warningModal, setWarningModal] = useState({ open: false, reason: '', count: 0 });
    const [isTerminated, setIsTerminated] = useState(false);
    const [terminationReason, setTerminationReason] = useState('');

    const timerRef = useRef(null);
    const warningCountRef = useRef(0);
    const isTerminatedRef = useRef(false);
    const sessionKey = `zl_exam_session_${id}`;
    const terminatedKey = `zl_terminated_${id}`;

    // Live Proctoring Setup
    const {
        stream,
        cameraStatus,
        microphoneStatus,
        reportIncident
    } = useProctoring(id, isStarted && score === null && !isTerminated && !isRestricted);

    // Load Exam Data & Check Status
    useEffect(() => {
        const fetchExam = async () => {
            try {
                const token = localStorage.getItem('studentToken');
                if (!token) return navigate('/student/login');

                // ── BACKEND-FIRST CHECK ─────────────────────────────────────────────
                // Always verify with the backend before trusting localStorage.
                // An admin may have unblocked the student and authorized a fresh attempt,
                // which means the stale localStorage terminated flag must be ignored.

                // Fetch the exam data
                const response = await axios.get(`/api/students/exams/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedExam = response.data.exam;

                // Fetch results from the backend to check attempt status
                const resultsRes = await axios.get(`/api/students/results`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const existingResult = resultsRes.data.results?.find(r => (r.exam?._id === id || r.exam === id));

                if (existingResult) {
                    if (existingResult.isTerminated && !existingResult.resetByAdmin) {
                        // Attempt was terminated and NOT yet authorized for a reset — block access
                        localStorage.setItem(terminatedKey, JSON.stringify({
                            terminated: true,
                            reason: existingResult.terminationReason || "Exam attempt was terminated by anti-cheating system."
                        }));
                        setIsTerminated(true);
                        setTerminationReason(existingResult.terminationReason || "Exam attempt was terminated by anti-cheating system.");
                        setLoading(false);
                        return;
                    } else if (existingResult.isTerminated && existingResult.resetByAdmin) {
                        // Admin authorized a fresh attempt — clear the stale localStorage flag
                        localStorage.removeItem(terminatedKey);
                        // Fall through to load the exam below
                    } else if (existingResult.status === "Completed") {
                        // Exam was completed normally — redirect
                        alert("You have already completed this exam.");
                        return navigate('/student/exams');
                    }
                } else {
                    // No result record at all — also clear any stale terminated flag
                    localStorage.removeItem(terminatedKey);
                }

                // ── SERVER-SIDE VIOLATION COUNT CHECK ───────────────────────────
                // Even if no Result record exists, check the cumulative incident count
                // from the backend. This closes the page-refresh bypass loophole where
                // the in-memory warningCountRef resets to 0 on every page reload.
                try {
                    const countRes = await axios.get(
                        `/api/anti-cheating/my-count/${id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (countRes.data?.isBlocked) {
                        const blockReason = "You have been blocked from this exam due to repeated security violations. Please contact your administrator.";
                        localStorage.setItem(terminatedKey, JSON.stringify({ terminated: true, reason: blockReason }));
                        setIsTerminated(true);
                        setTerminationReason(blockReason);
                        setLoading(false);
                        return;
                    }
                    // Seed the in-memory counter from the server count so warnings
                    // continue from where they left off (not from zero).
                    if (countRes.data?.incidentCount > 0) {
                        warningCountRef.current = countRes.data.incidentCount;
                        setWarningCount(countRes.data.incidentCount);
                    }
                } catch (countErr) {
                    // Non-fatal: proceed, the backend incident logging will enforce on next violation
                    console.warn("Could not fetch incident count from backend:", countErr.message);
                }
                // ────────────────────────────────────────────────────────────────

                setExam(fetchedExam);

                // Restore in-progress session from localStorage (only for resuming an active attempt)
                const savedSession = localStorage.getItem(sessionKey);
                if (savedSession) {
                    try {
                        const parsed = JSON.parse(savedSession);
                        setAnswers(parsed.answers || {});
                        setMarkedForReview(new Set(parsed.markedForReview || []));
                        setConfidenceLevels(parsed.confidenceLevels || {});
                        setScratchpad(parsed.scratchpad || "");
                        setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
                        if (parsed.isStarted) {
                            setIsStarted(true);
                        }
                    } catch (e) {
                        console.error("Failed to restore session", e);
                    }
                }

                if (response.data.examEndsAt && response.data.serverNow) {
                    const diffMs = new Date(response.data.examEndsAt).getTime() - new Date(response.data.serverNow).getTime();
                    setTimeLeft(Math.max(0, Math.floor(diffMs / 1000)));
                }
            } catch (error) {
                console.error("Failed to fetch exam", error);
                if (error.response && error.response.status === 403) {
                    const msg = error.response.data?.message;
                    if (msg === "BLOCKED") {
                        setIsRestricted(true);
                    } else {
                        alert(msg || "Access denied. You cannot take this exam.");
                        navigate('/student/exams');
                    }
                }
            } finally {
                setLoading(false);
            }
        };
        fetchExam();
    }, [id, navigate, sessionKey, terminatedKey]);

    // Force Termination Handler
    const handleForceTermination = useCallback(async (reason) => {
        if (isTerminatedRef.current) return;
        isTerminatedRef.current = true;
        setIsTerminated(true);
        setTerminationReason(reason || "Exceeded security policy violation threshold.");

        // Clear timer
        if (timerRef.current) clearInterval(timerRef.current);

        // Remove local active session cache to prevent resumption
        localStorage.removeItem(sessionKey);
        localStorage.setItem(terminatedKey, JSON.stringify({
            terminated: true,
            reason: reason || "Exceeded security policy violation limit."
        }));

        setWarningModal({ open: false, reason: '', count: 0 });

        // Call backend termination API
        try {
            const token = localStorage.getItem('studentToken');
            if (token) {
                const res = await axios.post('/api/anti-cheating/terminate', {
                    examId: id,
                    reason: reason || "Exceeded maximum allowed security violations (3 strikes)",
                    autoBlockStudent: true
                }, { headers: { Authorization: `Bearer ${token}` } });

                if (res.data?.isBlocked) {
                    setIsRestricted(true);
                }
            }
        } catch (err) {
            console.error("Failed to execute termination API:", err);
        }
    }, [id, sessionKey, terminatedKey]);

    // Handle Socket-Driven Admin Termination
    useEffect(() => {
        const handleForceEnd = (e) => {
            const reason = e.detail || "Terminated by admin.";
            handleForceTermination(reason);
        };
        window.addEventListener("proctoring-force-terminate", handleForceEnd);
        return () => window.removeEventListener("proctoring-force-terminate", handleForceEnd);
    }, [handleForceTermination]);

    // Violation Callback from Anti-Cheating Hook
    const handleViolation = useCallback(async (event) => {
        if (!isStarted || score !== null || isTerminatedRef.current || isRestricted) return;

        // Also report live to proctoring admin via socket
        reportIncident(event.type, event.severity, event.description, event.details);

        // --------------------------

        // If the counter is already at or beyond the limit (e.g. seeded from backend
        // on page load), terminate immediately without incrementing past MAX_WARNINGS.
        if (warningCountRef.current >= MAX_WARNINGS) {
            handleForceTermination(event.description);
            return;
        }

        const newCount = warningCountRef.current + 1;
        warningCountRef.current = newCount;
        // Clamp display to MAX_WARNINGS so badge never shows e.g. "4/3"
        setWarningCount(Math.min(newCount, MAX_WARNINGS));

        // Log incident to backend API asynchronously
        // The backend enforces the 3-strike rule server-side and returns shouldTerminate
        // if the cumulative count (including previous sessions) has reached the limit.
        try {
            const token = localStorage.getItem('studentToken');
            if (token) {
                const incidentRes = await axios.post('/api/anti-cheating/incident', {
                    examId: id,
                    violationType: event.type,
                    severity: event.severity,
                    description: event.description,
                    evidenceData: event.details || {}
                }, { headers: { Authorization: `Bearer ${token}` } });

                // Sync frontend counter with the server's authoritative count (clamped to MAX_WARNINGS for display)
                if (incidentRes.data?.incidentCount > warningCountRef.current) {
                    warningCountRef.current = incidentRes.data.incidentCount;
                    setWarningCount(Math.min(incidentRes.data.incidentCount, MAX_WARNINGS));
                }

                // Backend signals termination (may be triggered by a previous session's violations)
                if (incidentRes.data?.shouldTerminate && !isTerminatedRef.current) {
                    handleForceTermination(event.description);
                    return;
                }
            }
        } catch (err) {
            console.error("Failed to log cheating incident to backend:", err);
            // Queue offline incident to retry on next heartbeat
            const queueKey = `zl_incident_queue_${id}`;
            const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
            queue.push({
                examId: id,
                violationType: event.type,
                severity: event.severity,
                description: event.description,
                evidenceData: event.details || {}
            });
            localStorage.setItem(queueKey, JSON.stringify(queue));
        }

        // Check if threshold reached (frontend check as fallback)
        if (newCount >= MAX_WARNINGS) {
            handleForceTermination(event.description);
        } else {
            // Display Warning Modal
            setWarningModal({
                open: true,
                reason: event.description,
                count: newCount
            });
        }
    }, [isStarted, score, isRestricted, id, handleForceTermination, reportIncident]);

    // Initialize Anti-Cheating Hook
    const { isFullscreen, requestFullscreen } = useAntiCheating({
        enabled: isStarted && score === null && !isTerminated && !isRestricted,
        onViolation: handleViolation,
        blockCopyPaste: true,
        blockContextMenu: true
    });

    const handleAutoSubmit = useCallback(() => {
        submitExamData();
    }, [answers, exam]);

    // Timer Logic
    useEffect(() => {
        if (isStarted && score === null && !isTerminated && exam && timeLeft === null) {
            // Fallback if examEndsAt is not present
            setTimeLeft(exam.durationMinutes * 60);
        }
    }, [isStarted, exam, score, isTerminated, timeLeft]);

    // Timer Logic - Interval Management
    useEffect(() => {
        if (!isStarted || score !== null || isTerminated) return;

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev === null) return null;
                if (prev <= 0) return 0;
                return prev - 1;
            });
        }, 1000);

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isStarted, score, isTerminated]);

    // Timer Logic - Auto Submit Trigger
    useEffect(() => {
        if (timeLeft === 0 && score === null && !isTerminated && !isSubmitting) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
        }
    }, [timeLeft, score, isTerminated, isSubmitting, handleAutoSubmit]);

    // Live Tracking / Heartbeat Ping
    useEffect(() => {
        if (!isStarted || score !== null || isRestricted || isTerminated) return;

        const pingServer = async () => {
            try {
                const token = localStorage.getItem('studentToken');
                if (!token) return;

                // --- Background Sync for Final Submission ---
                const pendingSubmitKey = `zl_pending_submit_${id}`;
                const pendingSubmit = localStorage.getItem(pendingSubmitKey);
                if (pendingSubmit && score === null && !isSubmitting) {
                    setIsSubmitting(true);
                    try {
                        const payload = JSON.parse(pendingSubmit);
                        const response = await axios.post('/api/students/results', payload, { headers: { Authorization: `Bearer ${token}` } });
                        setScore(response.data.result.score !== null ? response.data.result.score : 'Hidden');
                        localStorage.removeItem(sessionKey);
                        localStorage.removeItem(pendingSubmitKey);
                        setShowPreSubmit(false);
                        return; // Auto-submit succeeded, stop this ping cycle
                    } catch (e) {
                        console.warn("Background auto-submit failed, will retry...", e);
                    } finally {
                        setIsSubmitting(false);
                    }
                }
                // --------------------------------------------

                const currentAnswers = Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
                    questionId,
                    selectedOptionIndex
                }));

                await axios.post('/api/students/ping', {
                    currentExamId: id,
                    warningCount: warningCountRef.current,
                    answers: currentAnswers
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const queueKey = `zl_incident_queue_${id}`;
                const queuedIncidents = JSON.parse(localStorage.getItem(queueKey) || '[]');

                // Flush offline incident queue if any exist
                if (queuedIncidents.length > 0) {
                    let allFlushed = true;
                    for (const incident of queuedIncidents) {
                        try {
                            const incidentRes = await axios.post('/api/anti-cheating/incident', incident, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (incidentRes.data?.incidentCount > warningCountRef.current) {
                                warningCountRef.current = incidentRes.data.incidentCount;
                                setWarningCount(Math.min(incidentRes.data.incidentCount, MAX_WARNINGS));
                            }

                            if (incidentRes.data?.shouldTerminate && !isTerminatedRef.current) {
                                handleForceTermination(incident.description);
                            }
                        } catch (e) {
                            allFlushed = false;
                            break; // Stop trying if we still have network issues
                        }
                    }
                    if (allFlushed) {
                        localStorage.removeItem(queueKey);
                    }
                }
            } catch (err) {
                if (err.response && (err.response.status === 403 || err.response.data?.message === "BLOCKED")) {
                    setIsRestricted(true);
                }
            }
        };

        pingServer(); // initial ping
        const intervalId = setInterval(pingServer, 5000);
        return () => clearInterval(intervalId);
    }, [isStarted, score, id, isRestricted, isTerminated]);

    // Auto-Save UI Logic
    useEffect(() => {
        if (!isStarted || score !== null || isTerminated) return;
        setSaveStatus("Saving...");
        const timeout = setTimeout(() => setSaveStatus("Saved"), 800);
        return () => clearTimeout(timeout);
    }, [answers, markedForReview, confidenceLevels, scratchpad, currentQuestionIndex, isStarted, score, isTerminated]);

    // Data Persistence Logic
    useEffect(() => {
        if (isStarted && score === null && !isTerminated) {
            const sessionData = {
                answers,
                markedForReview: Array.from(markedForReview),
                confidenceLevels,
                scratchpad,
                currentQuestionIndex,
                isStarted: true
            };
            localStorage.setItem(sessionKey, JSON.stringify(sessionData));
        }
    }, [answers, markedForReview, confidenceLevels, scratchpad, currentQuestionIndex, isStarted, score, isTerminated, sessionKey]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isStarted || score !== null || isTerminated || showPreSubmit || !exam || warningModal.open) return;

        const handleKeyDown = (e) => {
            if (e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'input') return;

            const key = e.key.toLowerCase();
            const currentQ = exam.questions[currentQuestionIndex];

            if (key === 'n' && currentQuestionIndex < exam.questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            }
            if (key === 'p' && currentQuestionIndex > 0) {
                setCurrentQuestionIndex(prev => prev - 1);
            }
            if (key === 'r') {
                toggleMarkForReview(currentQ._id);
            }
            const optionMap = { 'a': 0, '1': 0, 'b': 1, '2': 1, 'c': 2, '3': 2, 'd': 3, '4': 3, 'e': 4, '5': 4, 'f': 5, '6': 5 };
            if (optionMap[key] !== undefined && optionMap[key] < currentQ.options.length) {
                handleOptionSelect(currentQ._id, optionMap[key]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isStarted, score, isTerminated, showPreSubmit, warningModal.open, currentQuestionIndex, exam, markedForReview, answers]);

    const formatTime = (seconds) => {
        if (seconds === null) return "--:--";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleOptionSelect = (questionId, optionIndex) => {
        if (score !== null || isTerminated || isRestricted) return;
        setAnswers({ ...answers, [questionId]: optionIndex });
    };

    const clearAnswer = (questionId) => {
        if (score !== null || isTerminated || isRestricted) return;
        const newAnswers = { ...answers };
        delete newAnswers[questionId];
        setAnswers(newAnswers);
    };

    const toggleMarkForReview = (questionId) => {
        if (score !== null || isTerminated || isRestricted) return;
        const newSet = new Set(markedForReview);
        if (newSet.has(questionId)) newSet.delete(questionId);
        else newSet.add(questionId);
        setMarkedForReview(newSet);
    };

    const setConfidence = (questionId, level) => {
        if (score !== null || isTerminated || isRestricted) return;
        setConfidenceLevels({ ...confidenceLevels, [questionId]: level });
    };

    const submitExamData = async () => {
        if (isTerminated || isSubmitting) return;
        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const payload = {
            examId: exam._id,
            answers: Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
                questionId,
                selectedOptionIndex
            }))
        };

        try {
            const token = localStorage.getItem('studentToken');
            const response = await axios.post('/api/students/results', payload, { headers: { Authorization: `Bearer ${token}` } });

            setScore(response.data.result.score !== null ? response.data.result.score : 'Hidden');
            localStorage.removeItem(sessionKey);
            setShowPreSubmit(false);
        } catch (error) {
            console.error("Failed to submit exam result", error);

            if (error.response?.data?.message === "Exam session not found or already completed.") {
                try {
                    const token = localStorage.getItem('studentToken');
                    const resultsRes = await axios.get('/api/students/results', { headers: { Authorization: `Bearer ${token}` } });
                    const existingResult = resultsRes.data.results?.find(r => (r.exam?._id === id || r.exam === id));
                    if (existingResult && existingResult.status === "Completed") {
                        setScore(existingResult.score !== null ? existingResult.score : 'Hidden');
                        localStorage.removeItem(sessionKey);
                        setShowPreSubmit(false);
                        return; // Auto-submitted by backend successfully!
                    }
                } catch (fetchErr) {
                    console.error("Failed to fetch completed score", fetchErr);
                }
            }

            try {
                if (!error.response || error.code === 'ERR_NETWORK') {
                    localStorage.setItem(`zl_pending_submit_${id}`, JSON.stringify(payload));
                    alert("You are offline. Your exam has been saved locally and will auto-submit when your connection is restored. Please do not close this window.");
                } else {
                    alert("Failed to save results. " + (error.response?.data?.message || ""));
                }
            } catch (e) {
                console.error("Error saving pending submit", e);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmSubmission = () => {
        submitExamData();
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
                <div style={{ width: 40, height: 40, border: '3px solid var(--border-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    // --- SCREEN: RESTRICTED / BLOCKED ---
    if (isRestricted) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)', padding: 24 }}>
                <AlertCircle size={64} style={{ color: 'var(--danger)', marginBottom: 24 }} />
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: 8 }}>Exam Restricted</h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 440, textAlign: 'center', lineHeight: 1.6 }}>
                    Your account has been restricted from taking this exam due to security policy violations. Please contact your administrator for review and unblocking.
                </p>
                <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 400 }}>
                    Disclaimer: Browser anti-cheating monitors tab switches, window focus, clipboard, and full-screen state.
                </div>
                <button
                    onClick={() => navigate('/student/login')}
                    style={{ marginTop: 24, padding: '12px 28px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
                >
                    Return to Login
                </button>
            </div>
        );
    }

    // --- SCREEN: EXAM TERMINATED (Anti-Cheating Threshold Exceeded) ---
    if (isTerminated) {
        return (
            <div className="exam-screen">
                <div style={{ maxWidth: 520, width: '100%', textAlign: 'center', background: 'var(--bg-card)', padding: 48, borderRadius: 24, border: '1px solid var(--border-default)', animation: 'slideIn 0.3s ease-out' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <ShieldAlert size={36} />
                    </div>
                    <h2 style={{ fontSize: 26, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>Assessment Terminated</h2>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                        This examination attempt has been automatically terminated due to security policy violations.
                    </p>

                    <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg-body)', border: '1px solid var(--border-default)', marginBottom: 24, textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Termination Reason</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            {terminationReason || "Exceeded maximum allowed security violations (3 strikes)."}
                        </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 32, textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Next Steps</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Contact your administrator. Once unblocked, an admin can authorize a fresh exam attempt for you. Your previous terminated attempt is kept for records.
                        </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 32, lineHeight: 1.5 }}>
                        Disclaimer: Browser anti-cheating monitors tab switches, window focus, clipboard, and full-screen state.
                    </div>

                    <button onClick={() => navigate('/student/dashboard')} className="btn btn-secondary exam-action-btn">
                        Return to Command Center
                    </button>
                </div>
            </div>
        );
    }

    if (!exam) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Exam Not Found</div>;

    // --- SCREEN: RESULTS (Post-Submission) ---
    if (score !== null) {
        const pct = Math.round((score / exam.questions.length) * 100);
        return (
            <div className="exam-screen">
                <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', animation: 'slideIn 0.3s ease-out' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-subtle)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>Submission Successful</h2>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 40 }}>Exam Completed Successfully. Your result will be released soon.</p>

                    <button onClick={() => navigate('/student/dashboard')} className="btn btn-secondary exam-action-btn">
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    // --- SCREEN: BRIEFING ---
    if (!isStarted) {
        return (
            <div className="exam-container">
                <div style={{ maxWidth: 640, width: '100%', background: 'var(--bg-card)', padding: 48, borderRadius: 24, border: '1px solid var(--border-default)' }}>
                    <div style={{ marginBottom: 40 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>ZeroLeak Assessment</div>
                        <h1 style={{ fontSize: 32, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{exam.title}</h1>
                        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{exam.description}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                        <div className="exam-info-box">
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><Clock size={20} /></div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>{exam.durationMinutes}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Minutes</div>
                            </div>
                        </div>
                        <div className="exam-info-box">
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><LayoutDashboard size={20} /></div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>{exam.questions.length}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Questions</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', marginBottom: 32, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <ShieldAlert size={20} style={{ color: '#eab308', flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            <strong>Anti-Cheating Policy Active:</strong> Fullscreen mode is enforced. Tab switching, window defocusing, and clipboard operations are monitored. Exceeding {MAX_WARNINGS} security warnings will automatically terminate your attempt.
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <button onClick={() => navigate('/student/dashboard')} className="btn btn-secondary" style={{ flex: 1, padding: '16px', borderRadius: 12 }}>Cancel</button>
                        <button onClick={async () => {
                            setIsStarted(true);
                            setToolsOpen(true);
                            await requestFullscreen();
                        }} className="btn btn-primary" style={{ flex: 2, padding: '16px', fontSize: 16, borderRadius: 12 }}>Begin Assessment</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- SCREEN: PRE-SUBMISSION CONFIRMATION ---
    if (showPreSubmit) {
        const answeredCount = Object.keys(answers).length;
        const unansweredCount = exam.questions.length - answeredCount;
        const markedCount = markedForReview.size;

        return (
            <div className="exam-container">
                <div style={{ maxWidth: 540, width: '100%', background: 'var(--bg-card)', padding: 48, borderRadius: 24, border: '1px solid var(--border-default)', animation: 'slideIn 0.2s ease-out' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>Ready to Submit?</h2>
                        <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Please review your examination status before finalizing.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-body)', borderRadius: 12 }}>
                            <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Answered</span>
                            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{answeredCount} / {exam.questions.length}</span>
                        </div>
                        {unansweredCount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--warning-subtle)', borderRadius: 12 }}>
                                <span style={{ fontSize: 15, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={18} /> Unanswered</span>
                                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--warning)' }}>{unansweredCount}</span>
                            </div>
                        )}
                        {markedCount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-body)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
                                <span style={{ fontSize: 15, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Bookmark size={18} /> Marked for Review</span>
                                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--brand-primary)' }}>{markedCount}</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {unansweredCount > 0 && (
                            <button onClick={() => {
                                const firstUnanswered = exam.questions.findIndex(q => answers[q._id] === undefined);
                                if (firstUnanswered !== -1) {
                                    setCurrentQuestionIndex(firstUnanswered);
                                    setShowPreSubmit(false);
                                }
                            }} className="btn btn-secondary" style={{ width: '100%', padding: '16px', borderRadius: 12 }}>
                                Jump to First Unanswered
                            </button>
                        )}
                        <button onClick={() => setShowPreSubmit(false)} className="btn btn-secondary" style={{ width: '100%', padding: '16px', borderRadius: 12 }}>
                            Return to Assessment
                        </button>
                        <button onClick={confirmSubmission} disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, marginTop: 8, border: 'none', borderRadius: 12 }}>
                            Confirm Final Submission
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- SCREEN: IN-PROGRESS WORKSPACE ---
    const q = exam.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === exam.questions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;
    const isAnswered = answers[q._id] !== undefined;
    const isMarked = markedForReview.has(q._id);

    const answeredCount = Object.keys(answers).length;
    const remainingQuestions = exam.questions.length - answeredCount;

    // Exam Pulse Intelligence
    let pulseState = { text: "Optimal Pacing", color: 'var(--text-tertiary)', icon: <Activity size={14} /> };
    if (timeLeft < 300) {
        pulseState = { text: "Time Critical", color: 'var(--danger)', icon: <Clock size={14} /> };
    } else if (remainingQuestions > 0 && timeLeft > 0) {
        const secondsPerQuestion = timeLeft / remainingQuestions;
        const mins = Math.floor(secondsPerQuestion / 60);
        const secs = Math.floor(secondsPerQuestion % 60);
        pulseState = { text: `~${mins > 0 ? mins + 'm ' : ''}${secs}s / remaining`, color: 'var(--text-tertiary)', icon: <Activity size={14} /> };
    } else if (remainingQuestions === 0) {
        pulseState = { text: "All Answered", color: 'var(--success)', icon: <CheckCircle2 size={14} /> };
    }

    return (
        <div style={{ height: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* --- SECURITY WARNING OVERLAY MODAL --- */}
            {warningModal.open && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        maxWidth: 480,
                        width: '100%',
                        background: 'var(--bg-card)',
                        borderRadius: 20,
                        padding: 32,
                        border: '1px solid var(--danger)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <AlertTriangle size={32} />
                        </div>

                        <h3 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                            Security Policy Warning
                        </h3>

                        <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                            Warning {warningModal.count} of {MAX_WARNINGS}
                        </div>

                        <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-body)', border: '1px solid var(--border-default)', fontSize: 14, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'left', lineHeight: 1.5 }}>
                            <strong>Detected Violation:</strong> {warningModal.reason}
                        </div>

                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                            If you reach {MAX_WARNINGS} warnings, your examination attempt will be <strong>automatically terminated</strong> and your student access locked.
                        </p>

                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 24, lineHeight: 1.4 }}>
                            Disclaimer: Browser anti-cheating monitors tab switches, window focus, clipboard, and full-screen state.
                        </div>

                        <button
                            onClick={async () => {
                                setWarningModal({ open: false, reason: '', count: 0 });
                                await requestFullscreen();
                            }}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '14px', fontSize: 14, borderRadius: 10, background: 'var(--danger)', border: 'none' }}
                        >
                            I Understand & Resume Assessment
                        </button>
                    </div>
                </div>
            )}

            {/* Global Progress Line */}
            <div style={{ height: 2, background: 'var(--bg-body)', width: '100%', zIndex: 50 }}>
                <div style={{ height: '100%', background: 'var(--brand-primary)', width: `${(answeredCount / exam.questions.length) * 100}%`, transition: 'width 0.3s ease' }} />
            </div>

            {/* Topbar */}
            <header style={{ height: 64, background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 10 }}>
                {/* Left: Branding & Focus Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
                        <h1 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{exam.title}</h1>
                    </div>

                    <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />

                    <button onClick={() => setFocusMode(!focusMode)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {focusMode ? "Exit Focus" : "Focus Mode"}
                    </button>
                </div>

                {/* Right: Security Status, Timer & Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

                    {/* Security Warning Badge */}
                    {warningCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: 12 }}>
                            <AlertTriangle size={14} /> Warnings: {Math.min(warningCount, MAX_WARNINGS)}/{MAX_WARNINGS}
                        </div>
                    )}

                    {/* Exam Pulse */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: pulseState.color, background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 12 }}>
                        {pulseState.icon} {pulseState.text}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {saveStatus === "Saved" ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <Activity size={12} />} {saveStatus}
                    </div>

                    {/* Timer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: timeLeft < 300 ? 'var(--danger)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: 15 }}>
                        <Clock size={16} /> {formatTime(timeLeft)}
                    </div>

                    <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />

                    <button onClick={() => setToolsOpen(!toolsOpen)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: toolsOpen ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                        {toolsOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />} Tools
                    </button>

                    <button onClick={() => setShowPreSubmit(true)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8 }}>
                        Review & Submit
                    </button>
                </div>
            </header>

            {/* 3-Zone Workspace */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {/* ZONE 1: Navigation Map (Left) */}
                <aside style={{
                    width: 240,
                    background: 'var(--bg-card)',
                    borderRight: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    transition: 'margin-left 0.3s ease',
                    marginLeft: focusMode ? -240 : 0,
                    flexShrink: 0
                }}>
                    <div style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question Map</h3>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{answeredCount}/{exam.questions.length}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {exam.questions.map((question, i) => {
                                const answered = answers[question._id] !== undefined;
                                const marked = markedForReview.has(question._id);
                                const current = i === currentQuestionIndex;

                                return (
                                    <button
                                        key={question._id}
                                        onClick={() => setCurrentQuestionIndex(i)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            fontSize: 13,
                                            fontWeight: current ? 500 : 400,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            background: current ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                            color: current ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                            border: 'none',
                                            transition: 'all 0.1s ease'
                                        }}
                                        className={!current ? "table-row-hover" : ""}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 12, color: current ? 'var(--brand-primary)' : 'var(--text-tertiary)', width: 20 }}>{String(i + 1).padStart(2, '0')}</span>
                                            {answered ? (
                                                <CheckCircle2 size={14} style={{ color: current ? 'var(--brand-primary)' : 'var(--text-tertiary)' }} />
                                            ) : (
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-default)', marginLeft: 4 }} />
                                            )}
                                        </div>
                                        {marked && <Bookmark size={12} style={{ color: 'var(--warning)' }} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                {/* ZONE 2: Main Workspace (Center) */}
                <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-base)', paddingRight: toolsOpen ? 340 : 0, transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <div style={{ flex: 1, padding: '48px 40px', maxWidth: 840, margin: '0 auto', width: '100%', transition: 'max-width 0.3s ease' }}>

                        {/* Question Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                    Question {String(currentQuestionIndex + 1).padStart(2, '0')} of {exam.questions.length}
                                </div>
                                {isMarked && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--warning)', background: 'var(--warning-subtle)', padding: '4px 8px', borderRadius: 4 }}>
                                    <Bookmark size={12} fill="currentColor" /> Marked for Review
                                </div>}
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                {isAnswered && (
                                    <button onClick={() => clearAnswer(q._id)} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <X size={14} /> Clear Selection
                                    </button>
                                )}
                                <button
                                    onClick={() => toggleMarkForReview(q._id)}
                                    style={{ background: 'none', border: 'none', fontSize: 13, color: isMarked ? 'var(--warning)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <Bookmark size={16} /> {isMarked ? 'Unmark' : 'Mark for Review'}
                                </button>
                            </div>
                        </div>

                        {/* Question Text */}
                        <h2 style={{ fontSize: 28, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 48, lineHeight: 1.5, letterSpacing: '-0.01em' }}>
                            {q.title}
                        </h2>

                        {/* Answer Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 64 }}>
                            {q.options.map((opt, optIndex) => {
                                const isSelected = answers[q._id] === optIndex;
                                const letter = LETTERS[optIndex] || String(optIndex + 1);

                                return (
                                    <div
                                        key={optIndex}
                                        onClick={() => handleOptionSelect(q._id, optIndex)}
                                        style={{
                                            padding: '16px 24px',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-card)',
                                            border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 24,
                                            transition: 'all 0.15s ease',
                                            boxShadow: isSelected ? '0 0 0 1px var(--brand-primary)' : 'none'
                                        }}
                                        className="table-row-hover"
                                    >
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 6,
                                            background: isSelected ? 'var(--brand-primary)' : 'var(--bg-body)',
                                            border: isSelected ? 'none' : '1px solid var(--border-default)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isSelected ? 'white' : 'var(--text-secondary)',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            {letter}
                                        </div>
                                        <span style={{ fontSize: 16, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>{opt}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Confidence Marker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>CONFIDENCE (Private)</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['Low', 'Medium', 'High'].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setConfidence(q._id, level)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: 6,
                                            fontSize: 12,
                                            border: 'none',
                                            background: confidenceLevels[q._id] === level ? 'var(--bg-card)' : 'transparent',
                                            color: confidenceLevels[q._id] === level ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                            boxShadow: confidenceLevels[q._id] === level ? '0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px var(--border-default)' : 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.1s ease'
                                        }}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Navigation */}
                    <div style={{ padding: '24px 40px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            disabled={isFirstQuestion}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, visibility: isFirstQuestion ? 'hidden' : 'visible', padding: '12px 24px', borderRadius: 8, fontSize: 14 }}
                        >
                            <ChevronLeft size={16} /> Previous (P)
                        </button>

                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {String(currentQuestionIndex + 1).padStart(2, '0')} / {exam.questions.length}
                        </div>

                        {!isLastQuestion ? (
                            <button
                                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 8, fontSize: 14, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                            >
                                Next (N) <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowPreSubmit(true)}
                                className="btn btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 8, fontSize: 14, border: 'none' }}
                            >
                                Review & Submit <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </main>

                {/* ZONE 3: Tools Drawer (Right) */}
                <aside style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: '100%',
                    width: 340,
                    background: 'var(--bg-card)',
                    borderLeft: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    transform: toolsOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: toolsOpen ? '-10px 0 30px rgba(0,0,0,0.1)' : 'none',
                    zIndex: 20
                }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Contextual Tools</h3>
                        <button onClick={() => setToolsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    <div style={{ padding: 24, borderBottom: '1px solid var(--border-default)' }}>
                        <ProctoringStatusPanel
                            stream={stream}
                            cameraStatus={cameraStatus}
                            microphoneStatus={microphoneStatus}
                            isStarted={isStarted}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Personal Scratchpad
                            </h4>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(autosaves)</span>
                        </div>
                        <textarea
                            value={scratchpad}
                            onChange={(e) => setScratchpad(e.target.value)}
                            placeholder="Type temporary notes here..."
                            style={{
                                width: '100%',
                                height: 200,
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 8,
                                padding: 16,
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                resize: 'none',
                                fontFamily: 'monospace',
                                lineHeight: 1.5
                            }}
                        />
                    </div>

                    <div style={{ padding: 24 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                            Review Queue
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Unanswered</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: remainingQuestions > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>{remainingQuestions}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Marked</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: markedForReview.size > 0 ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}>{markedForReview.size}</span>
                            </div>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
};

export default TakeExam;
