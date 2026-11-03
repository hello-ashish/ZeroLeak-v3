import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Target, ClipboardList, TrendingUp, TrendingDown, Clock, PlayCircle, CheckCircle2, User, ChevronRight, BookOpen, Award, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import { getCachedData } from '../../utils/apiCache.js';

const StudentDashboardPage = () => {
    const cachedExams = getCachedData('/api/students/exams');
    const cachedResults = getCachedData('/api/students/results');
    const [exams, setExams] = useState(() => cachedExams?.exams || []);
    const [results, setResults] = useState(() => cachedResults?.results ? [...cachedResults.results].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : []);
    const [loading, setLoading] = useState(() => !cachedExams && !cachedResults);
    const navigate = useNavigate();
    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');

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

                const sortedResults = (resultsRes.data.results || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setResults(sortedResults);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    const releasedResults = results.filter(r => r.exam?.examinationId ? r.exam.examinationId.isResultReleased === true : r.exam?.isResultReleased === true);
    const completedExams = releasedResults.length;

    const averageScore = completedExams > 0
        ? Math.round(releasedResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions) * 100, 0) / completedExams)
        : 0;

    let recentTrend = 0;
    if (completedExams >= 3) {
        const recent3 = releasedResults.slice(0, 3);
        const recentAvg = Math.round(recent3.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions) * 100, 0) / 3);
        recentTrend = recentAvg - averageScore;
    }

    const trendData = releasedResults.slice(0, 5).reverse().map((r, i) => ({
        name: `Exam ${i+1}`,
        score: Math.round((r.score / r.totalQuestions) * 100)
    }));

    const subjects = {};
    releasedResults.forEach(r => {
        if (!r.exam) return;
        const subjectName = r.exam.title.split(' ')[0];
        if (!subjects[subjectName]) subjects[subjectName] = { totalPct: 0, count: 0 };
        subjects[subjectName].totalPct += (r.score / r.totalQuestions) * 100;
        subjects[subjectName].count += 1;
    });

    const subjectAverages = Object.entries(subjects).map(([name, data]) => ({
        name,
        avg: Math.round(data.totalPct / data.count)
    })).sort((a, b) => b.avg - a.avg);

    const strongestSubject = subjectAverages.length > 0 ? subjectAverages[0] : null;
    const needsAttention = subjectAverages.length > 1 ? subjectAverages[subjectAverages.length - 1] : null;

    const takenExamIds = new Set(results.map(r => r.exam?._id));
    const availableExams = exams.filter(e => !takenExamIds.has(e._id) && e.status === 'Live');
    const upNext = availableExams.length > 0 ? availableExams[0] : null;

    const getGrade = (pct) => {
        if (pct >= 90) return { letter: 'A+', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
        if (pct >= 80) return { letter: 'A', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
        if (pct >= 70) return { letter: 'B', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' };
        if (pct >= 60) return { letter: 'C', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
        if (pct >= 50) return { letter: 'D', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
        return { letter: 'F', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
    };

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, border: '3px solid var(--border-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header & Identity Strip */}
            <div style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '24px 32px', borderRadius: 20, border: '1px solid var(--border-default)' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
                        Welcome back, <span style={{ color: 'var(--brand-primary)' }}>{studentData.name?.split(' ')[0] || 'Student'}</span> 👋
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={14} /> {studentData.email}
                        </div>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-strong)' }} />
                        <div>ID: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{studentData._id?.substring(0, 8).toUpperCase()}</span></div>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-strong)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 500, background: 'var(--success-subtle)', padding: '2px 8px', borderRadius: 12 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> Active
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid-2-1" style={{ marginBottom: 32, alignItems: 'stretch' }}>
                {/* YOUR NEXT MOVE */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Your Next Move</h2>
                        {availableExams.length > 1 && (
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--brand-primary)', background: 'var(--brand-primary-subtle)', padding: '4px 10px', borderRadius: 20 }}>
                                {availableExams.length - 1} more available
                            </span>
                        )}
                    </div>

                    {upNext ? (
                        <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--bg-card), var(--bg-surface))', border: '1px solid var(--border-default)', borderRadius: 20, padding: 32, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', right: -40, top: '50%', transform: 'translateY(-50%)', opacity: 0.03, color: 'var(--brand-primary)' }}>
                                <PlayCircle size={280} />
                            </div>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
                                    <span style={{ position: 'relative', display: 'flex', height: 8, width: 8 }}>
                                        <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.75 }}></span>
                                        <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: 8, width: 8, backgroundColor: 'currentColor' }}></span>
                                    </span>
                                    Live Examination
                                </div>
                                <h3 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>{upNext.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} /> {upNext.durationMinutes} Minutes</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Target size={16} /> {upNext.questions?.length || 0} Questions</span>
                                </div>
                                <button
                                    onClick={() => navigate(`/student/take-exam/${upNext._id}`)}
                                    style={{ background: 'var(--brand-primary)', color: 'white', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)'; }}
                                >
                                    Start Examination <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px dashed var(--border-strong)', borderRadius: 20, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-subtle)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>You're all caught up!</h3>
                                <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto 24px' }}>Great job. You have no pending examinations at the moment. Review your recent performance.</p>
                            </div>
                            <button
                                onClick={() => navigate('/student/exams')}
                                style={{ background: 'transparent', color: 'var(--brand-primary)', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, border: '1px solid var(--brand-primary)', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-primary-subtle)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                Browse Exam History
                            </button>
                        </div>
                    )}
                </section>

                {/* ACADEMIC PULSE */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px 0' }}>Academic Pulse</h2>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>Overall Average</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{averageScore}</span>
                                <span style={{ fontSize: 16, color: 'var(--text-tertiary)', fontWeight: 500 }}>%</span>
                            </div>
                            <div style={{ marginTop: 16, height: 4, background: 'var(--bg-body)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${averageScore}%`, height: '100%', background: averageScore >= 70 ? 'var(--success)' : averageScore >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2 }} />
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>Recent Trend</div>
                            {completedExams >= 3 ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600, color: recentTrend >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: 1 }}>
                                        {recentTrend >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                        {Math.abs(recentTrend)}%
                                    </div>
                                    <div style={{ height: 40, marginTop: 8, marginLeft: -10 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={trendData}>
                                                <Line type="monotone" dataKey="score" stroke={recentTrend >= 0 ? "var(--success)" : "var(--danger)"} strokeWidth={2} dot={{ r: 2, strokeWidth: 2 }} isAnimationActive={false} />
                                                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} cursor={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Need 3 exams</div>
                            )}
                        </div>

                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <Award size={16} color="var(--brand-primary)" /> Strongest
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{strongestSubject ? strongestSubject.name : '--'}</div>
                                {strongestSubject && <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--success)' }}>{strongestSubject.avg}% avg</div>}
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <AlertCircle size={16} color="var(--warning)" /> Focus Area
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{needsAttention ? needsAttention.name : '--'}</div>
                                {needsAttention && <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--danger)' }}>{needsAttention.avg}% avg</div>}
                            </div>
                        </div>

                    </div>
                </section>
            </div>

            <div className="dashboard-grid-2-1" style={{ alignItems: 'flex-start' }}>
                {/* RECENT RESULTS */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Recent Results</h2>
                        {releasedResults.length > 3 && (
                            <button onClick={() => navigate('/student/results')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                View All <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                    
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20, overflow: 'hidden' }}>
                        {releasedResults.length === 0 ? (
                            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                <BookOpen size={40} opacity={0.3} />
                                <p style={{ margin: 0 }}>No released results yet.<br/>Complete exams to see your grades here.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {releasedResults.slice(0, 4).map((r, i) => {
                                    const pct = Math.round((r.score / r.totalQuestions) * 100);
                                    const grade = getGrade(pct);
                                    return (
                                        <div 
                                            key={i} 
                                            onClick={() => navigate(`/student/results`)}
                                            style={{ 
                                                padding: '24px', 
                                                borderBottom: i < Math.min(releasedResults.length, 4) - 1 ? '1px solid var(--border-subtle)' : 'none', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                background: 'transparent'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                                <div style={{ width: 48, height: 48, borderRadius: 12, background: grade.bg, color: grade.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, border: `1px solid ${grade.color}30` }}>
                                                    {grade.letter}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{r.exam?.title || 'Unknown Exam'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                        <span style={{ fontWeight: 500 }}>{pct}% Score</span>
                                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-strong)' }} />
                                                        <span>{r.score} of {r.totalQuestions} correct</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', color: 'var(--text-secondary)' }}>
                                                    <ChevronRight size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* RECENT ACTIVITY TIMELINE */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px 0' }}>Recent Activity</h2>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 32 }}>
                        {results.length === 0 ? (
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No recent activity to display.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                                {results.slice(0, 5).map((r, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                                        {i !== Math.min(results.length, 5) - 1 && (
                                            <div style={{ position: 'absolute', left: 19, top: 40, bottom: -28, width: 2, background: 'var(--border-subtle)', borderRadius: 1 }} />
                                        )}
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-body)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', zIndex: 1, flexShrink: 0 }}>
                                            <ClipboardList size={18} />
                                        </div>
                                        <div style={{ paddingTop: 2, flex: 1 }}>
                                            <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                                                Submitted <strong>{r.exam?.title}</strong>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Clock size={12} />
                                                {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default StudentDashboardPage;
