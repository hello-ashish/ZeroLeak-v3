import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, PlayCircle, CheckCircle2, Clock, Calendar, FileText, ShieldAlert, Lock, ChevronDown, ChevronRight, Timer, BookOpen } from 'lucide-react';

const StudentExamsPage = () => {
    const [exams, setExams] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Available');
    const [expandedExams, setExpandedExams] = useState({});
    const navigate = useNavigate();

    // Live timer
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('studentToken');
        if (!token) return navigate('/student/login');

        const fetchData = async () => {
            try {
                const [examsRes, resultsRes] = await Promise.all([
                    axios.get('/api/students/exams', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/students/results', { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setExams(examsRes.data.exams || []);
                setResults(resultsRes.data.results || []);
            } catch (error) {
                console.error("Failed to fetch exams", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    const toggleExpand = (id) => {
        setExpandedExams(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const completedExamIds = new Set(
        results.filter(r => !r.isTerminated).map(r => String(r.exam?._id || r.exam))
    );
    const terminatedExamIds = new Set(
        results.filter(r => r.isTerminated && !r.resetByAdmin).map(r => String(r.exam?._id || r.exam))
    );

    const getExamStatus = (exam) => {
        const id = String(exam._id);
        if (terminatedExamIds.has(id)) return 'blocked';
        if (completedExamIds.has(id)) return 'completed';

        if (exam.status === 'Completed') return 'closed';

        if ((exam.status === "Scheduled" || exam.status === "Live" || exam.status === "GracePeriod") && exam.scheduledAt && exam.endsAt) {
            const startTime = new Date(exam.scheduledAt);
            const endTime = new Date(exam.endsAt);
            const timeDiff = startTime.getTime() - now.getTime();

            if (now.getTime() > endTime.getTime()) {
                return 'closed'; // Past the end time
            } else if (now.getTime() >= startTime.getTime()) {
                return 'available'; // Currently running
            } else if (timeDiff <= 30 * 60 * 1000) {
                return 'upcoming'; // Within 30 mins
            } else {
                return 'hidden'; // Too far in future
            }
        }
        if (exam.status === 'Completed') return 'closed';
        return 'available';
    };

    const getFilteredExams = () => {
        let filtered = exams.filter(e => {
            const status = getExamStatus(e);
            if (status === 'hidden') return false;
            if (activeTab === 'Available') return status === 'available' || status === 'upcoming';
            if (activeTab === 'Completed') return status === 'completed';
            if (activeTab === 'Blocked') return status === 'blocked';
            if (activeTab === 'Missed') return status === 'closed';
            return true;
        });

        if (searchQuery) {
            filtered = filtered.filter(e =>
                e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.examinationId?.title?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    };

    const filteredExams = getFilteredExams();

    const tabCounts = {
        Available: exams.filter(e => { const s = getExamStatus(e); return s === 'available' || s === 'upcoming'; }).length,
        Completed: exams.filter(e => getExamStatus(e) === 'completed').length,
        Blocked: exams.filter(e => getExamStatus(e) === 'blocked').length,
        Missed: exams.filter(e => getExamStatus(e) === 'closed').length,
    };

    if (loading) {
        return (
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ height: 36, width: 200, background: 'var(--bg-card)', borderRadius: 8, marginBottom: 12, animation: 'pulse 2s infinite' }} />
                        <div style={{ height: 20, width: 300, background: 'var(--bg-card)', borderRadius: 6, animation: 'pulse 2s infinite' }} />
                    </div>
                    <div style={{ height: 44, width: 280, background: 'var(--bg-card)', borderRadius: 12, animation: 'pulse 2s infinite' }} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 36, width: 100, background: 'var(--bg-card)', borderRadius: 20, animation: 'pulse 2s infinite' }} />)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[1, 2, 3].map(i => <div key={i} style={{ height: 140, background: 'var(--bg-card)', borderRadius: 16, animation: 'pulse 2s infinite' }} />)}
                </div>
            </div>
        );
    }

    const groupedExams = {};
    const standaloneExams = [];

    filteredExams.forEach(exam => {
        if (exam.examinationId) {
            const pId = String(exam.examinationId._id);
            if (!groupedExams[pId]) {
                groupedExams[pId] = {
                    examination: exam.examinationId,
                    subjects: []
                };
            }
            groupedExams[pId].subjects.push(exam);
        } else {
            standaloneExams.push(exam);
        }
    });

    const groups = Object.values(groupedExams).sort((a, b) => new Date(b.examination.createdAt || 0) - new Date(a.examination.createdAt || 0));

    const formatTimeLeft = (ms) => {
        if (ms <= 0) return "0s";
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${m}m ${s}s`;
    };

    const renderExamCard = (exam, isChild = false) => {
        const status = getExamStatus(exam);
        const isBlocked = status === 'blocked';
        const isCompleted = status === 'completed';
        const isClosed = status === 'closed';
        const isUpcoming = status === 'upcoming';
        const isAvailable = status === 'available';

        let statusConfig = { color: 'var(--brand-primary)', bg: 'var(--brand-primary-subtle)', border: 'var(--border-default)', label: 'Available', icon: <PlayCircle size={14} /> };
        if (isBlocked) statusConfig = { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', label: 'Blocked', icon: <Lock size={14} /> };
        if (isCompleted) statusConfig = { color: 'var(--success)', bg: 'var(--success-subtle)', border: 'var(--success-border, rgba(16,185,129,0.2))', label: 'Completed', icon: <CheckCircle2 size={14} /> };
        if (isClosed) statusConfig = { color: 'var(--text-tertiary)', bg: 'var(--bg-body)', border: 'var(--border-default)', label: 'Closed', icon: <Lock size={14} /> };
        if (isUpcoming) statusConfig = { color: 'var(--warning)', bg: 'var(--warning-subtle)', border: 'var(--warning-border, rgba(245,158,11,0.2))', label: 'Upcoming', icon: <Clock size={14} /> };

        return (
            <div
                key={exam._id}
                style={{
                    padding: isChild ? '20px 24px' : 28,
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isChild ? 'transparent' : 'var(--bg-card)',
                    borderRadius: isChild ? 0 : 20,
                    border: isChild ? 'none' : '1px solid var(--border-default)',
                    borderBottom: isChild ? '1px solid var(--border-subtle)' : undefined,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: isBlocked ? 0.75 : 1,
                    marginBottom: isChild ? 0 : 16,
                    boxShadow: isChild ? 'none' : '0 2px 8px rgba(0,0,0,0.02)'
                }}
            >
                {!isChild && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: statusConfig.color }} />}
                
                <div style={{ flex: 1, paddingRight: 32, paddingLeft: isChild ? 0 : 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h3 style={{ fontSize: isChild ? 16 : 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {isChild ? exam.title.split(' - ').pop() : exam.title}
                        </h3>
                        <span style={{ 
                            fontSize: 12, fontWeight: 600, color: statusConfig.color, background: statusConfig.bg, border: `1px solid ${statusConfig.border}`,
                            padding: '4px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6
                        }}>
                            {statusConfig.icon} {statusConfig.label}
                        </span>
                    </div>

                    {!isChild && exam.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: isBlocked ? 12 : 16, lineHeight: 1.5 }}>{exam.description}</p>}

                    {isBlocked && (
                        <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                            <ShieldAlert size={14} />
                            Terminated due to anti-cheating violations.
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}><FileText size={14} /> {exam.questions?.length || 0} Questions</span>

                        {(exam.status === "Scheduled" || exam.status === "Live" || exam.status === "GracePeriod") && exam.scheduledAt && exam.endsAt ? (
                            <>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>
                                    <Calendar size={14} /> {new Date(exam.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isUpcoming && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)', background: 'var(--warning-subtle)', padding: '4px 10px', borderRadius: 8 }}>
                                        <Timer size={14} /> Starts in {formatTimeLeft(new Date(exam.scheduledAt).getTime() - now.getTime())}
                                    </span>
                                )}
                                {isAvailable && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: 8 }}>
                                        <Timer size={14} /> Ends in {formatTimeLeft(new Date(exam.endsAt).getTime() - now.getTime())}
                                    </span>
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>
                                    <Clock size={14} /> {exam.durationMinutes} mins
                                </span>
                            </>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>
                                <Timer size={14} /> {exam.durationMinutes} mins
                            </span>
                        )}
                    </div>
                </div>

                <div>
                    {isBlocked ? (
                        <button disabled style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Access Blocked
                        </button>
                    ) : isClosed ? (
                        <button disabled style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'var(--bg-body)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)', borderRadius: 10, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Exam Closed
                        </button>
                    ) : isCompleted ? (
                        <button onClick={() => navigate('/student/results')} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-primary)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}>
                            View Result
                        </button>
                    ) : isUpcoming ? (
                        <button disabled style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'var(--warning-subtle)', color: 'var(--warning)', border: '1px solid var(--warning-border)', borderRadius: 10, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            Starts Soon
                        </button>
                    ) : (
                        <button onClick={() => navigate(`/student/take-exam/${exam._id}`)} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)'; }}>
                            Start Exam <ChevronRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-default)', paddingBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>My Exams</h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>Browse, search, and take your assigned examinations.</p>
                </div>

                <div style={{ position: 'relative', width: 320 }}>
                    <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Search by title, subject..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px 12px 44px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, transition: 'border-color 0.2s', outline: 'none' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
                {['Available', 'Completed', 'Missed', 'Blocked', 'All'].map(tab => {
                    const isActive = activeTab === tab;
                    const count = tabCounts[tab];
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: isActive ? (tab === 'Blocked' ? 'var(--danger)' : 'var(--text-primary)') : 'var(--bg-card)',
                                border: `1px solid ${isActive ? 'transparent' : 'var(--border-default)'}`,
                                padding: '8px 16px',
                                borderRadius: 20,
                                fontSize: 14,
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? 'var(--bg-app)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-card)' }}
                        >
                            {tab}
                            {tab !== 'All' && count > 0 && (
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-body)',
                                    color: isActive ? 'var(--bg-app)' : 'var(--text-primary)',
                                    padding: '2px 8px',
                                    borderRadius: 12
                                }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Blocked Banner */}
            {activeTab === 'Blocked' && tabCounts.Blocked > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 24, borderRadius: 16, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 24 }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, color: 'var(--danger)' }}>
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Exam Access Blocked</h4>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            These exams were locked because your attempt was terminated after exceeding the maximum allowed security violations. Please contact your administrator to review your attempt and potentially restore access.
                        </p>
                    </div>
                </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredExams.length === 0 ? (
                    <div style={{ padding: 64, textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--border-strong)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' }}>
                            <BookOpen size={36} opacity={0.5} />
                        </div>
                        <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>No exams found</h3>
                        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                            {searchQuery ? `We couldn't find any exams matching "${searchQuery}". Try adjusting your search.` : `There are no ${activeTab.toLowerCase()} exams for you right now.`}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Grouped Examinations */}
                        {groups.map(group => {
                            const isExpanded = expandedExams[group.examination._id];
                            return (
                                <div key={group.examination._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20, overflow: 'hidden', marginBottom: 16, transition: 'all 0.2s', boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.05)' : 'none' }}>
                                    <div
                                        onClick={() => toggleExpand(group.examination._id)}
                                        style={{
                                            padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer',
                                            background: isExpanded ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.2s ease',
                                            borderBottom: isExpanded ? '1px solid var(--border-default)' : 'none'
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{group.examination.title}</h3>
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                                                <span style={{ background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>{group.subjects.length} Module{group.subjects.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: isExpanded ? 'var(--bg-card)' : 'var(--bg-body)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                            <ChevronDown size={20} color="var(--text-secondary)" />
                                        </div>
                                    </div>

                                    {/* Children */}
                                    {isExpanded && (
                                        <div style={{ background: 'var(--bg-body)' }}>
                                            <div style={{ padding: '24px 28px 12px 28px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                Modules inside this examination
                                            </div>
                                            {group.subjects.map((subj, idx) => {
                                                const isLast = idx === group.subjects.length - 1;
                                                return (
                                                    <div key={subj._id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                                                        {renderExamCard(subj, true)}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Standalone Exams */}
                        {standaloneExams.map(exam => renderExamCard(exam, false))}
                    </>
                )}
            </div>
        </div>
    );
};

export default StudentExamsPage;
