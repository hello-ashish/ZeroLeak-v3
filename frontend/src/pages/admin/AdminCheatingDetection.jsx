import React, { useEffect, useState, useCallback } from 'react';
import "./AdminCheatingDetection.css";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AdminLayout } from './AdminLayout.jsx';
import { Modal } from '../../components/Modal.jsx';
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx';
import { useToast } from '../../components/Toast.jsx';
import { 
    ShieldAlert, AlertTriangle, UserX, CheckCircle2, Search, 
    Filter, RefreshCw, Eye, Unlock, ShieldCheck, ChevronLeft, ChevronRight, FileText, UserCheck
} from 'lucide-react';

const API = '/api';
const getToken = () => localStorage.getItem('adminToken');

export default function AdminCheatingDetection() {
    const navigate = useNavigate();
    const toast = useToast();

    // Active View Tab: 'incidents' | 'blocked' | 'unblocked'
    const [activeTab, setActiveTab] = useState('incidents');

    // Metrics State
    const [metrics, setMetrics] = useState({
        totalIncidents: 0,
        blockedStudentsCount: 0,
        terminatedAttempts: 0
    });

    // Incidents Table State
    const [incidents, setIncidents] = useState([]);
    const [incidentsLoading, setIncidentsLoading] = useState(true);
    const [incidentsPage, setIncidentsPage] = useState(1);
    const [incidentsTotal, setIncidentsTotal] = useState(0);
    const [incidentsTotalPages, setIncidentsTotalPages] = useState(1);
    const [severityFilter, setSeverityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Blocked Students Table State
    const [blockedStudents, setBlockedStudents] = useState([]);
    const [blockedLoading, setBlockedLoading] = useState(true);
    const [blockedPage, setBlockedPage] = useState(1);
    const [blockedTotal, setBlockedTotal] = useState(0);
    const [blockedTotalPages, setBlockedTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Unblocked Students Table State
    const [unblockedStudents, setUnblockedStudents] = useState([]);
    const [unblockedLoading, setUnblockedLoading] = useState(true);
    const [unblockedPage, setUnblockedPage] = useState(1);
    const [unblockedTotal, setUnblockedTotal] = useState(0);
    const [unblockedTotalPages, setUnblockedTotalPages] = useState(1);
    const [unblockedSearchQuery, setUnblockedSearchQuery] = useState('');

    // Modal Details State
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [unblockingId, setUnblockingId] = useState(null);

    // Post-Unblock: Authorize New Attempt State
    const [terminatedExamsModal, setTerminatedExamsModal] = useState(null); // { studentId, studentName, exams: [] }
    const [authorizingAttemptId, setAuthorizingAttemptId] = useState(null); // examId being authorized
    const [fullyAuthorizedStudents, setFullyAuthorizedStudents] = useState(new Set()); // students with no pending exams

    const LIMIT = 10;

    // 1. Fetch Incidents
    const fetchIncidents = useCallback(async (p = 1, showLoading = false) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            if (showLoading) setIncidentsLoading(true);
            let url = `${API}/anti-cheating/incidents?page=${p}&limit=${LIMIT}`;
            if (severityFilter) url += `&severity=${severityFilter}`;
            if (statusFilter) url += `&reviewStatus=${statusFilter}`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setIncidents(res.data.incidents || []);
            setIncidentsTotal(res.data.pagination?.total || 0);
            setIncidentsTotalPages(res.data.pagination?.totalPages || 1);
            setIncidentsPage(p);

            setMetrics(prev => ({
                ...prev,
                totalIncidents: res.data.pagination?.total || 0,
                terminatedAttempts: res.data.terminatedCount || 0
            }));
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to fetch cheating incidents:", err);
        } finally {
            if (showLoading) setIncidentsLoading(false);
        }
    }, [navigate, severityFilter, statusFilter]);

    // 2. Fetch Blocked Students
    const fetchBlockedStudents = useCallback(async (p = 1, showLoading = false) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            if (showLoading) setBlockedLoading(true);
            let url = `${API}/anti-cheating/blocked-students?page=${p}&limit=${LIMIT}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setBlockedStudents(res.data.blockedStudents || []);
            setBlockedTotal(res.data.pagination?.total || 0);
            setBlockedTotalPages(res.data.pagination?.totalPages || 1);
            setBlockedPage(p);

            setMetrics(prev => ({
                ...prev,
                blockedStudentsCount: res.data.pagination?.total || 0
            }));
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to fetch blocked students:", err);
        } finally {
            if (showLoading) setBlockedLoading(false);
        }
    }, [navigate, searchQuery]);

    // 3. Fetch Unblocked Students
    const fetchUnblockedStudents = useCallback(async (p = 1, showLoading = false) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            if (showLoading) setUnblockedLoading(true);
            let url = `${API}/anti-cheating/unblocked-students?page=${p}&limit=${LIMIT}`;
            if (unblockedSearchQuery) url += `&search=${encodeURIComponent(unblockedSearchQuery)}`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setUnblockedStudents(res.data.unblockedStudents || []);
            setUnblockedTotal(res.data.pagination?.total || 0);
            setUnblockedTotalPages(res.data.pagination?.totalPages || 1);
            setUnblockedPage(p);
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to fetch unblocked students:", err);
        } finally {
            if (showLoading) setUnblockedLoading(false);
        }
    }, [navigate, unblockedSearchQuery]);

    // Initial Load & Filter Triggers
    useEffect(() => {
        fetchIncidents(1, true);
    }, [fetchIncidents]);

    useEffect(() => {
        fetchBlockedStudents(1, true);
    }, [fetchBlockedStudents]);

    useEffect(() => {
        fetchUnblockedStudents(1, true);
    }, [fetchUnblockedStudents]);

    const handleRefreshAll = () => {
        fetchIncidents(incidentsPage);
        fetchBlockedStudents(blockedPage);
        fetchUnblockedStudents(unblockedPage);
        toast.success("Telemetry re-synced");
    };

    // Unblock Student Handler
    const handleUnblockStudent = async (studentId) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            setUnblockingId(studentId);
            const res = await axios.post(`${API}/anti-cheating/unblock/${studentId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const unlockedStudentName = res.data?.student?.name || selectedStudent?.name || 'Student';
            toast.success(res.data?.message || "Student unblocked successfully");
            setSelectedStudent(null);
            fetchBlockedStudents(blockedPage);
            fetchUnblockedStudents(unblockedPage);
            fetchIncidents(incidentsPage);

            // If the student had terminated exam attempts, prompt admin to authorize new attempts
            const terminatedExams = res.data?.terminatedExams || [];
            if (terminatedExams.length > 0) {
                setTerminatedExamsModal({
                    studentId,
                    studentName: unlockedStudentName,
                    exams: terminatedExams
                });
            }
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to unblock student:", err);
            toast.error(err.response?.data?.message || "Failed to unblock student");
        } finally {
            setUnblockingId(null);
        }
    };

    // Authorize a fresh exam attempt for a previously blocked student
    const handleAuthorizeAttempt = async (studentId, examId) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            setAuthorizingAttemptId(examId);
            const res = await axios.post(`${API}/anti-cheating/authorize-attempt/${studentId}/${examId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(res.data?.message || "New attempt authorized successfully");

            // Remove the just-authorized exam from the modal list
            setTerminatedExamsModal(prev => {
                if (!prev) return null;
                const remaining = prev.exams.filter(e => String(e.examId) !== String(examId));
                if (remaining.length === 0) {
                    setFullyAuthorizedStudents(s => new Set(s).add(studentId));
                    return null; // close modal when all done
                }
                return { ...prev, exams: remaining };
            });
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to authorize new attempt:", err);
            toast.error(err.response?.data?.message || "Failed to authorize new attempt");
        } finally {
            setAuthorizingAttemptId(null);
        }
    };

    // Check for pending terminated exams for a previously unblocked student
    const handleCheckPendingExams = async (studentId, studentName) => {
        const token = getToken();
        if (!token) {
            navigate('/admin/login');
            return;
        }

        try {
            const res = await axios.get(`${API}/anti-cheating/terminated-exams/${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const terminatedExams = res.data?.terminatedExams || [];
            if (terminatedExams.length > 0) {
                setTerminatedExamsModal({
                    studentId,
                    studentName: res.data?.studentName || studentName,
                    exams: terminatedExams
                });
            } else {
                setFullyAuthorizedStudents(s => new Set(s).add(studentId));
                toast.success("No pending terminated exams for this student.");
            }
        } catch (err) {
            if (err.response?.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/admin/login');
                return;
            }
            console.error("Failed to fetch pending exams:", err);
            toast.error(err.response?.data?.message || "Failed to fetch pending exams.");
        }
    };

    // Severity Badge Helper
    const getSeverityBadge = (severity) => {
        switch (severity) {
            case 'Critical':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: 11, fontWeight: 600 }}>Critical</span>;
            case 'High':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: 11, fontWeight: 600 }}>High</span>;
            case 'Medium':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#eab308', fontSize: 11, fontWeight: 600 }}>Medium</span>;
            default:
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--bg-body)', color: 'var(--text-tertiary)', fontSize: 11 }}>Low</span>;
        }
    };

    // Status Badge Helper
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pending':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#eab308', fontSize: 11, fontWeight: 500 }}>Pending</span>;
            case 'Under Review':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: 'var(--brand-primary)', fontSize: 11, fontWeight: 500 }}>Under Review</span>;
            case 'Confirmed':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: 11, fontWeight: 500 }}>Confirmed</span>;
            case 'Dismissed':
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--bg-body)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>Dismissed</span>;
            default:
                return <span style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--bg-body)', color: 'var(--text-tertiary)', fontSize: 11 }}>{status}</span>;
        }
    };

    return (
        <AdminLayout>
            <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ShieldAlert size={26} style={{ color: 'var(--danger)' }} /> Security & Anti-Cheating Telemetry
                        </h1>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Monitor real-time security breaches, review evidence telemetry, and manage blocked students.
                        </p>
                    </div>

                    <button
                        onClick={handleRefreshAll}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontSize: 13 }}
                    >
                        <RefreshCw size={14} /> Refresh Data
                    </button>
                </div>

                {/* Metrics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
                    
                    <div className="metric-card">
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <div className="metric-value">{metrics.totalIncidents}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Total Security Incidents</div>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserX size={24} />
                        </div>
                        <div>
                            <div className="metric-value">{metrics.blockedStudentsCount}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Blocked Students</div>
                        </div>
                    </div>

                    <div className="metric-card">
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <div className="metric-value">{metrics.terminatedAttempts}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Terminated Exam Attempts</div>
                        </div>
                    </div>

                </div>

                {/* Tab Switcher */}
                <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-default)', marginBottom: 24 }}>
                    <button
                        onClick={() => setActiveTab('incidents')}
                        style={{
                            padding: '12px 20px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'incidents' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            color: activeTab === 'incidents' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'incidents' ? 500 : 400,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <AlertTriangle size={16} /> Incident Telemetry ({metrics.totalIncidents})
                    </button>
                    <button
                        onClick={() => setActiveTab('blocked')}
                        style={{
                            padding: '12px 20px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'blocked' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            color: activeTab === 'blocked' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'blocked' ? 500 : 400,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <UserX size={16} /> Blocked Students ({metrics.blockedStudentsCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('unblocked')}
                        style={{
                            padding: '12px 20px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'unblocked' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            color: activeTab === 'unblocked' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'unblocked' ? 500 : 400,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <UserCheck size={16} /> Unblocked History ({unblockedTotal})
                    </button>
                </div>

                {/* TAB 1: INCIDENTS TABLE */}
                {activeTab === 'incidents' && (
                    <div className="section-card">
                        
                        {/* Filters */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <Filter size={16} style={{ color: 'var(--text-tertiary)' }} />
                                
                                {/* Severity Filter */}
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13 }}
                                >
                                    <option value="">All Severities</option>
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>

                                {/* Status Filter */}
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13 }}
                                >
                                    <option value="">All Review Statuses</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="Confirmed">Confirmed</option>
                                    <option value="Dismissed">Dismissed</option>
                                </select>
                            </div>

                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                Showing {incidents.length} of {incidentsTotal} incidents
                            </span>
                        </div>

                        {/* Table */}
                        {incidentsLoading ? (<table style={{ width: "100%", borderCollapse: "collapse" }}><SkeletonTable rows={5} cols={7} /></table>) : incidents.length === 0 ? (
                            <EmptyState
                                icon={<ShieldCheck size={48} style={{ color: 'var(--success)' }} />}
                                title="No Cheating Incidents Detected"
                                description="All live student assessments are currently operating within security parameters."
                            />
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '12px 16px' }}>Student</th>
                                                <th style={{ padding: '12px 16px' }}>Exam</th>
                                                <th style={{ padding: '12px 16px' }}>Violation Type</th>
                                                <th style={{ padding: '12px 16px' }}>Severity</th>
                                                <th style={{ padding: '12px 16px' }}>Detected At</th>
                                                <th style={{ padding: '12px 16px' }}>Action Taken</th>
                                                <th style={{ padding: '12px 16px' }}>Status</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incidents.map(inc => (
                                                <tr key={inc._id} style={{ borderBottom: '1px solid var(--border-default)' }} className="table-row-hover">
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inc.studentId?.name || 'Unknown Student'}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{inc.studentId?.studentId || inc.studentId?.email || 'N/A'}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                                                        {inc.examId?.title || 'Assessment'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-primary)' }}>
                                                        {inc.violationType}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {getSeverityBadge(inc.severity)}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                                        {new Date(inc.detectedAt || inc.createdAt).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: inc.actionTaken === 'STUDENT_BLOCKED' || inc.actionTaken === 'EXAM_TERMINATED' ? 'var(--danger)' : inc.actionTaken === 'STUDENT_UNBLOCKED' ? 'var(--success)' : 'var(--text-secondary)' }}>
                                                            {inc.actionTaken}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {getStatusBadge(inc.reviewStatus)}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => setSelectedIncident(inc)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                        >
                                                            <Eye size={14} /> Evidence
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {incidentsTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            Page {incidentsPage} of {incidentsTotalPages}
                                        </span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                disabled={incidentsPage <= 1}
                                                onClick={() => fetchIncidents(incidentsPage - 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                <ChevronLeft size={14} /> Previous
                                            </button>
                                            <button
                                                disabled={incidentsPage >= incidentsTotalPages}
                                                onClick={() => fetchIncidents(incidentsPage + 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                Next <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* TAB 2: BLOCKED STUDENTS TABLE */}
                {activeTab === 'blocked' && (
                    <div className="section-card">
                        
                        {/* Search */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ position: 'relative', width: 320 }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                                <input
                                    type="text"
                                    placeholder="Search student by name, ID or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: 8,
                                        padding: '8px 12px 8px 36px',
                                        color: 'var(--text-primary)',
                                        fontSize: 13
                                    }}
                                />
                            </div>

                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                {blockedTotal} Blocked Student(s)
                            </span>
                        </div>

                        {/* Table */}
                        {blockedLoading ? (<table style={{ width: "100%", borderCollapse: "collapse" }}><SkeletonTable rows={5} cols={6} /></table>) : blockedStudents.length === 0 ? (
                            <EmptyState
                                icon={<CheckCircle2 size={48} style={{ color: 'var(--success)' }} />}
                                title="No Blocked Students"
                                description="There are currently no student accounts restricted due to cheating violations."
                            />
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '12px 16px' }}>Student ID</th>
                                                <th style={{ padding: '12px 16px' }}>Name & Email</th>
                                                <th style={{ padding: '12px 16px' }}>Department</th>
                                                <th style={{ padding: '12px 16px' }}>Blocked At</th>
                                                <th style={{ padding: '12px 16px' }}>Reason</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {blockedStudents.map(student => (
                                                <tr key={student._id} style={{ borderBottom: '1px solid var(--border-default)' }} className="table-row-hover">
                                                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {student.studentId || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{student.email}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                                        {student.department || '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                                        {student.blockedAt ? new Date(student.blockedAt).toLocaleString() : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--danger)', fontSize: 12 }}>
                                                        {student.blockedReason || 'Security policy violation'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => setSelectedStudent(student)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                        >
                                                            <Unlock size={14} /> Unblock
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {blockedTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            Page {blockedPage} of {blockedTotalPages}
                                        </span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                disabled={blockedPage <= 1}
                                                onClick={() => fetchBlockedStudents(blockedPage - 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                <ChevronLeft size={14} /> Previous
                                            </button>
                                            <button
                                                disabled={blockedPage >= blockedTotalPages}
                                                onClick={() => fetchBlockedStudents(blockedPage + 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                Next <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* TAB 3: UNBLOCKED STUDENTS TABLE */}
                {activeTab === 'unblocked' && (
                    <div className="section-card">
                        
                        {/* Search */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ position: 'relative', width: 320 }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                                <input
                                    type="text"
                                    placeholder="Search student by name, ID or email..."
                                    value={unblockedSearchQuery}
                                    onChange={(e) => setUnblockedSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-body)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: 8,
                                        padding: '8px 12px 8px 36px',
                                        color: 'var(--text-primary)',
                                        fontSize: 13
                                    }}
                                />
                            </div>

                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                {unblockedTotal} Unblocked Student(s)
                            </span>
                        </div>

                        {/* Table */}
                        {unblockedLoading ? (<table style={{ width: "100%", borderCollapse: "collapse" }}><SkeletonTable rows={5} cols={5} /></table>) : unblockedStudents.length === 0 ? (
                            <EmptyState
                                icon={<UserCheck size={48} style={{ color: 'var(--success)' }} />}
                                title="No Unblocked Students"
                                description="There are currently no students who have had their blocked status lifted."
                            />
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '12px 16px' }}>Student ID</th>
                                                <th style={{ padding: '12px 16px' }}>Name & Email</th>
                                                <th style={{ padding: '12px 16px' }}>Department</th>
                                                <th style={{ padding: '12px 16px' }}>Unblocked At</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unblockedStudents.map(student => (
                                                <tr key={student._id} style={{ borderBottom: '1px solid var(--border-default)' }} className="table-row-hover">
                                                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {student.studentId || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{student.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{student.email}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                                        {student.department || '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                                                        {student.unblockedAt ? new Date(student.unblockedAt).toLocaleString() : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                        {fullyAuthorizedStudents.has(student._id) ? (
                                                            <span style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, color: 'var(--success)', background: 'rgba(34,197,94,0.1)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                                                                <CheckCircle2 size={14} /> Authorized
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleCheckPendingExams(student._id, student.name)}
                                                                className="btn btn-secondary"
                                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, color: 'var(--brand-primary)', borderColor: 'rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                            >
                                                                <ShieldCheck size={14} /> Authorize Exams
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {unblockedTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            Page {unblockedPage} of {unblockedTotalPages}
                                        </span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                disabled={unblockedPage <= 1}
                                                onClick={() => fetchUnblockedStudents(unblockedPage - 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                <ChevronLeft size={14} /> Previous
                                            </button>
                                            <button
                                                disabled={unblockedPage >= unblockedTotalPages}
                                                onClick={() => fetchUnblockedStudents(unblockedPage + 1, false)}
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}
                                            >
                                                Next <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* MODAL 1: INCIDENT EVIDENCE DETAILS */}
                {selectedIncident && (
                    <Modal
                        open={Boolean(selectedIncident)}
                        onClose={() => setSelectedIncident(null)}
                        title={`Security Incident Evidence - ${selectedIncident.violationType}`}
                    >
                        <div style={{ padding: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                <div style={{ background: 'var(--bg-body)', padding: 14, borderRadius: 8 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Student</div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 4 }}>{selectedIncident.studentId?.name || 'Unknown'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedIncident.studentId?.email}</div>
                                </div>
                                <div style={{ background: 'var(--bg-body)', padding: 14, borderRadius: 8 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Exam</div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 4 }}>{selectedIncident.examId?.title || 'Assessment'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Detected: {new Date(selectedIncident.detectedAt || selectedIncident.createdAt).toLocaleString()}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Breach Description</div>
                                <div style={{ padding: 12, background: 'var(--bg-body)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    {selectedIncident.description}
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Raw Evidence Payload</div>
                                <pre style={{
                                    background: 'var(--bg-body)',
                                    padding: 16,
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: 'var(--brand-primary)',
                                    fontFamily: 'monospace',
                                    overflowX: 'auto',
                                    border: '1px solid var(--border-default)'
                                }}>
                                    {JSON.stringify(selectedIncident.evidenceData || {}, null, 2)}
                                </pre>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button
                                    onClick={() => setSelectedIncident(null)}
                                    className="btn btn-secondary"
                                    style={{ padding: '10px 20px', borderRadius: 8 }}
                                >
                                    Close
                                </button>
                                {selectedIncident.studentId?._id && selectedIncident.studentId?.isBlocked && (
                                    <button
                                        onClick={() => {
                                            const idToUnblock = selectedIncident.studentId._id;
                                            setSelectedIncident(null);
                                            handleUnblockStudent(idToUnblock);
                                        }}
                                        className="btn btn-primary"
                                        style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--success)', border: 'none' }}
                                    >
                                        Unblock Student Account
                                    </button>
                                )}
                            </div>
                        </div>
                    </Modal>
                )}

                {/* MODAL 2: CONFIRM UNBLOCK STUDENT */}
                {selectedStudent && (
                    <Modal
                        open={Boolean(selectedStudent)}
                        onClose={() => setSelectedStudent(null)}
                        title="Confirm Student Unblock"
                    >
                        <div style={{ padding: 16 }}>
                            <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                                Are you sure you want to unblock student <strong>{selectedStudent.name}</strong> ({selectedStudent.email})?
                            </p>
                            <div style={{ padding: 12, background: 'var(--bg-body)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                                <strong>Block Reason:</strong> {selectedStudent.blockedReason || 'Security policy violation'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button
                                    onClick={() => setSelectedStudent(null)}
                                    className="btn btn-secondary"
                                    style={{ padding: '10px 20px', borderRadius: 8 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={unblockingId === selectedStudent._id}
                                    onClick={() => handleUnblockStudent(selectedStudent._id)}
                                    className="btn btn-primary"
                                    style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--success)', border: 'none' }}
                                >
                                    {unblockingId === selectedStudent._id ? 'Unblocking...' : 'Confirm Unblock'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

            </div>

                {/* MODAL 3: AUTHORIZE NEW ATTEMPT (shown after unblock if terminated exams exist) */}
                {terminatedExamsModal && (
                    <Modal
                        open={Boolean(terminatedExamsModal)}
                        onClose={() => setTerminatedExamsModal(null)}
                        title={`Authorize New Exam Attempt — ${terminatedExamsModal.studentName}`}
                    >
                        <div style={{ padding: 16 }}>
                            <div style={{ padding: 14, background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', marginBottom: 20 }}>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                    <strong>{terminatedExamsModal.studentName}</strong> has been unblocked. The following exam attempts were terminated due to security violations.
                                    The old records are preserved for audit. Click <strong>"Authorize Attempt"</strong> to allow a fresh submission.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                                {terminatedExamsModal.exams.map(exam => (
                                    <div
                                        key={String(exam.examId)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-body)', borderRadius: 10, border: '1px solid var(--border-default)' }}
                                    >
                                        <div style={{ flex: 1, paddingRight: 16 }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                                                {exam.examTitle}
                                            </div>
                                            {exam.terminationReason && (
                                                <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.4 }}>
                                                    {exam.terminationReason}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            disabled={authorizingAttemptId === String(exam.examId)}
                                            onClick={() => handleAuthorizeAttempt(terminatedExamsModal.studentId, exam.examId)}
                                            className="btn btn-primary"
                                            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, whiteSpace: 'nowrap', background: 'var(--success)', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <ShieldCheck size={14} />
                                            {authorizingAttemptId === String(exam.examId) ? 'Authorizing...' : 'Authorize Attempt'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setTerminatedExamsModal(null)}
                                    className="btn btn-secondary"
                                    style={{ padding: '10px 20px', borderRadius: 8 }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

        </AdminLayout>
    );
}
