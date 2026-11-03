import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target, BookOpen, Activity, ChevronRight, Award, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';

const StudentPerformancePage = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [aiReport, setAiReport] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('studentToken');
        if (!token) return navigate('/student/login');

        const fetchData = async () => {
            try {
                const response = await axios.get('/api/students/results', { headers: { Authorization: `Bearer ${token}` } });
                setResults(response.data.results || []);
            } catch (error) {
                console.error("Failed to fetch results", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    if (loading) {

        return (
            <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid var(--border-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 48, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="page-header" style={{ marginBottom: 48 }}>
                    <h1 className="page-title" style={{ fontSize: 32, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 8 }}>Academic Performance</h1>
                    <p className="page-subtitle" style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Understand your progress, strengths, and areas for improvement.</p>
                </div>

                <div style={{ padding: 64, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--brand-primary)' }}>
                        <Activity size={32} />
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Your Performance Journey Starts Here</h3>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 32px', lineHeight: 1.5 }}>
                        Complete your first assessment to unlock intelligent performance analytics, mathematical trends, and subject intelligence.
                    </p>
                    <button onClick={() => navigate('/student/dashboard')} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 8, fontSize: 14 }}>
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // --- Core Data Arrays ---
    const sortedAllResults = [...results].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Oldest to newest
    const reverseAllResults = [...sortedAllResults].reverse(); // Newest to oldest

    const releasedResults = results.filter(r => r.exam?.examinationId ? r.exam.examinationId.isResultReleased === true : r.exam?.isResultReleased === true);
    const sortedResults = [...releasedResults].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Oldest to newest
    const reverseResults = [...sortedResults].reverse(); // Newest to oldest

    const handleGenerateAiAnalysis = async () => {
        setIsAnalyzing(true);
        setAiError(null);
        setAiReport(null);

        try {
            const token = localStorage.getItem('studentToken');
            const response = await axios.get('/api/ai/student/performance-analysis', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAiReport(response.data);
        } catch (error) {
            console.error("AI Analysis failed:", error);
            setAiError(error.response?.data?.message || "Failed to generate AI analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Helper: Grade Mapping ---
    const getGrade = (pct) => {
        if (pct >= 90) return { letter: 'A+', color: 'var(--success)' };
        if (pct >= 80) return { letter: 'A', color: 'var(--success)' };
        if (pct >= 70) return { letter: 'B', color: 'var(--success)' };
        if (pct >= 60) return { letter: 'C', color: 'var(--warning)' };
        if (pct >= 50) return { letter: 'D', color: 'var(--warning)' };
        return { letter: 'F', color: 'var(--danger)' };
    };

    // --- Basic Metrics ---
    const completedExams = results.length;
    let bestScore = 0;
    let totalScorePct = 0;

    sortedResults.forEach(r => {
        const pct = (r.score / r.totalQuestions) * 100;
        if (pct > bestScore) bestScore = pct;
        totalScorePct += pct;
    });

    const averageScore = Math.round(totalScorePct / completedExams);

    // --- Personal Benchmark & Trend ---
    let windowSize = 0;
    if (completedExams >= 6) windowSize = 3;
    else if (completedExams >= 4) windowSize = 2;
    else if (completedExams >= 2) windowSize = 1;

    let recentAvg = averageScore;
    let prevAvg = averageScore;
    let trendDiff = 0;
    let trendContext = "Not enough data for trend";

    if (windowSize > 0) {
        const recentWindow = reverseResults.slice(0, windowSize);
        const prevWindow = reverseResults.slice(windowSize, windowSize * 2);

        recentAvg = Math.round(recentWindow.reduce((acc, r) => acc + (r.score / r.totalQuestions) * 100, 0) / windowSize);
        prevAvg = Math.round(prevWindow.reduce((acc, r) => acc + (r.score / r.totalQuestions) * 100, 0) / windowSize);
        trendDiff = recentAvg - prevAvg;
        trendContext = `vs previous ${windowSize} exams`;
    }

    // --- Subject Intelligence ---
    const calculateSubjectAverages = (resultsArray) => {
        const subjects = {};
        resultsArray.forEach(r => {
            if (!r.exam) return;
            const subjectName = r.exam.title.split(' ')[0]; // Group by first word
            if (!subjects[subjectName]) subjects[subjectName] = { total: 0, count: 0 };
            subjects[subjectName].total += (r.score / r.totalQuestions) * 100;
            subjects[subjectName].count += 1;
        });
        return Object.entries(subjects).map(([name, data]) => ({
            name,
            avg: Math.round(data.total / data.count)
        }));
    };

    const lifetimeSubjects = calculateSubjectAverages(results).sort((a, b) => b.avg - a.avg);
    const strongestSubject = lifetimeSubjects.length > 0 ? lifetimeSubjects[0] : null;

    // --- "Why Did My Score Change?" ---
    let whyInsight = "Complete more exams to unlock performance insights.";
    let whyDetails = [];

    if (windowSize >= 2) {
        const recentSubjs = calculateSubjectAverages(reverseResults.slice(0, windowSize));
        const prevSubjs = calculateSubjectAverages(reverseResults.slice(windowSize, windowSize * 2));

        let biggestGain = { name: null, diff: 0 };
        let biggestDrop = { name: null, diff: 0 };

        recentSubjs.forEach(rs => {
            const ps = prevSubjs.find(p => p.name === rs.name);
            if (ps) {
                const diff = rs.avg - ps.avg;
                if (diff > biggestGain.diff) biggestGain = { name: rs.name, diff };
                if (diff < biggestDrop.diff) biggestDrop = { name: rs.name, diff };
            }
        });

        if (trendDiff > 0) {
            whyInsight = `Your average improved by ${Math.abs(trendDiff)}% across your last ${windowSize} exams.`;
            if (biggestGain.name) whyDetails.push(`Main contribution: ${biggestGain.name} improved by ${biggestGain.diff}%.`);
        } else if (trendDiff < 0) {
            whyInsight = `Your average declined by ${Math.abs(trendDiff)}% across your last ${windowSize} exams.`;
            if (biggestDrop.name) whyDetails.push(`Main factor: ${biggestDrop.name} declined by ${Math.abs(biggestDrop.diff)}%.`);
        } else {
            whyInsight = `Your performance has remained completely stable across your last ${windowSize * 2} exams.`;
        }
    }

    // --- Next Recommended Action ---
    let nextAction = { title: "Keep going", desc: "Your scores are stable or improving.", icon: <Activity size={20} color="var(--success)" /> };
    if (lifetimeSubjects.length > 0) {
        const weakest = lifetimeSubjects[lifetimeSubjects.length - 1];
        if (weakest.avg < 60) {
            nextAction = {
                title: `Review ${weakest.name}`,
                desc: `Your lifetime average in ${weakest.name} is ${weakest.avg}%. Focus your next study session here.`,
                icon: <AlertCircle size={20} color="var(--danger)" />
            };
        } else if (trendDiff < 0) {
            nextAction = {
                title: "Reassess recent topics",
                desc: "Your recent scores have dipped. Review your latest incorrect answers.",
                icon: <AlertCircle size={20} color="var(--warning)" />
            };
        }
    }

    // --- Recharts Calculations ---
    const chartData = sortedResults.slice(-15);
    const areaData = chartData.map(r => ({
        name: r.exam?.title || 'Assessment',
        date: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: Math.round((r.score / r.totalQuestions) * 100)
    }));

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Header */}
            <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>Academic Performance</h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Understand your progress, strengths, and areas for improvement.</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, opacity: isAnalyzing ? 0.7 : 1, cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}
                    onClick={handleGenerateAiAnalysis}
                    disabled={isAnalyzing}
                >
                    <Sparkles size={16} />
                    {isAnalyzing ? "Analyzing Performance..." : "AI Performance Analysis"}
                </button>
            </div>

            {/* AI Insight Card */}
            {aiError && (
                <div style={{ background: 'var(--danger-subtle)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: 16, borderRadius: 12, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle size={20} />
                    <span>{aiError}</span>
                </div>
            )}

            {aiReport && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '32px', marginBottom: 40, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>AI Performance Insight</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyzed from your authorized academic history</p>
                        </div>
                    </div>

                    <p style={{ fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 24 }}>
                        {aiReport.summary}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24, marginBottom: 24 }}>
                        <div style={{ padding: 20, background: 'var(--bg-body)', borderRadius: 12 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Strengths</h4>
                            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--success)' }}>
                                {aiReport.strengths.map((str, i) => (
                                    <li key={i} style={{ fontSize: 14, marginBottom: 4, fontWeight: 500 }}>{str}</li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ padding: 20, background: 'var(--bg-body)', borderRadius: 12 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Weak Areas</h4>
                            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--danger)' }}>
                                {aiReport.weakAreas.map((weak, i) => (
                                    <li key={i} style={{ fontSize: 14, marginBottom: 4, fontWeight: 500 }}>{weak}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
                        <div style={{ padding: 20, background: 'var(--bg-body)', borderRadius: 12 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Key Observations</h4>
                            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-primary)' }}>
                                {aiReport.observations.map((obs, i) => (
                                    <li key={i} style={{ fontSize: 14, marginBottom: 4, lineHeight: 1.5 }}>{obs}</li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ padding: 20, background: 'var(--bg-body)', borderRadius: 12 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Improvement Focus</h4>
                            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--brand-primary)' }}>
                                {aiReport.improvementFocus.map((focus, i) => (
                                    <li key={i} style={{ fontSize: 14, marginBottom: 4, lineHeight: 1.5, fontWeight: 500 }}>{focus}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* TOP TIER: Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 40 }}>
                <div style={{ padding: '24px 32px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Current Average</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{averageScore}%</div>
                    </div>
                </div>

                <div style={{ padding: '24px 32px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Recent Trend</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <div style={{ fontSize: 36, fontWeight: 300, color: trendDiff >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {trendDiff >= 0 ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                            {Math.abs(trendDiff)}%
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>{trendContext}</div>
                </div>

                <div style={{ padding: '24px 32px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Exams Completed</div>
                    <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>{completedExams}</div>
                </div>

                <div style={{ padding: '24px 32px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Personal Best</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <div style={{ fontSize: 36, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Award size={28} color="var(--brand-primary)" /> {Math.round(bestScore)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* MIDDLE TIER: Score Progression & Insights */}
            <div className="dashboard-grid-2-1" style={{ marginBottom: 24 }}>

                {/* RECHARTS AREA CHART */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Score Progression</h2>
                    <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '24px', position: 'relative' }}>
                        {areaData.length > 1 ? (
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorScoreStudent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} domain={['auto', 100]} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-md)' }}
                                            itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                            cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area type="monotone" dataKey="score" name="Score (%)" stroke="var(--brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorScoreStudent)" activeDot={{ r: 6, strokeWidth: 0, fill: "var(--brand-primary)" }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                Not enough data to map progression.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* LOWER TIER: Subject & Recent Lists */}
            <div className="dashboard-grid-1-2">

                {/* SUBJECT PERFORMANCE */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Subject Mastery</h2>
                    <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '24px 32px' }}>
                        {lifetimeSubjects.length > 0 ? (
                            <div style={{ width: '100%', height: Math.max(200, lifetimeSubjects.length * 45) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={lifetimeSubjects} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-primary)', fontWeight: 500 }} width={110} />
                                        <Tooltip
                                            cursor={{ fill: 'var(--bg-body)' }}
                                            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 13, boxShadow: 'var(--shadow-md)' }}
                                            itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                        />
                                        <Bar dataKey="avg" name="Average (%)" radius={[0, 4, 4, 0]} barSize={20}>
                                            {lifetimeSubjects.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.avg >= 80 ? 'var(--success)' : entry.avg >= 60 ? 'var(--warning)' : 'var(--danger)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No subject data available.</div>
                        )}
                    </div>
                </section>

                {/* RECENT PERFORMANCE LIST */}
                <section style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Assessments</h2>
                        <button onClick={() => navigate('/student/results')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            View Full History <ChevronRight size={14} />
                        </button>
                    </div>

                    <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, overflow: 'hidden' }}>
                        {reverseAllResults.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>No past assessments available.</div>
                        ) : (
                            reverseAllResults.slice(0, 6).map((r, i) => {
                                const pct = Math.round((r.score / r.totalQuestions) * 100);
                                const grade = getGrade(pct);
                                const isReleased = r.exam?.examinationId ? r.exam.examinationId.isResultReleased === true : r.exam?.isResultReleased === true;

                                return (
                                    <div key={r._id} style={{ display: 'flex', alignItems: 'center', padding: '20px 32px', borderBottom: i !== Math.min(reverseAllResults.length, 6) - 1 ? '1px solid var(--border-default)' : 'none', cursor: 'pointer', transition: 'background 0.2s' }} className="table-row-hover" onClick={() => navigate('/student/results')}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{r.exam?.title || 'Deleted Exam'}</div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
                                                <span>{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                <span>{r.totalQuestions} Questions</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                                            {isReleased ? (
                                                <>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 18, fontWeight: 400, color: 'var(--text-primary)' }}>{pct}%</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Score</div>
                                                    </div>
                                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: grade.color + '15', color: grade.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>
                                                        {grade.letter}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Pending Release</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </section>

            </div>

        </div>
    );
};

export default StudentPerformancePage;
