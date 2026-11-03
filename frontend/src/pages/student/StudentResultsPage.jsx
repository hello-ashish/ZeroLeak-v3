import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Target, Search, FileText, ChevronRight, X, Clock, Calendar, CheckCircle2, AlertCircle, XCircle, ChevronDown } from 'lucide-react';

const StudentResultsPage = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedResult, setSelectedResult] = useState(null);
    const [expandedResults, setExpandedResults] = useState({});
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

    const getGrade = (pct) => {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        if (pct >= 50) return 'D';
        return 'F';
    };

    const toggleExpand = (id) => {
        setExpandedResults(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getFilteredResults = () => {
        if (!searchQuery) return results;
        return results.filter(r => 
            r.exam?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.exam?.examinationId?.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const filteredResults = getFilteredResults();

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ height: 40, width: 200, background: 'var(--bg-card)', borderRadius: 8, marginBottom: 32, animation: 'pulse 2s infinite' }} />
                <div style={{ height: 400, background: 'var(--bg-card)', borderRadius: 12, animation: 'pulse 2s infinite' }} />
            </div>
        );
    }

    // Grouping
    const groupedResults = {};
    const standaloneResults = [];

    filteredResults.forEach(result => {
        if (result.exam?.examinationId) {
            const pId = String(result.exam.examinationId._id);
            if (!groupedResults[pId]) {
                groupedResults[pId] = {
                    examination: result.exam.examinationId,
                    results: []
                };
            }
            groupedResults[pId].results.push(result);
        } else {
            standaloneResults.push(result);
        }
    });

    const groups = Object.values(groupedResults);

    const renderResultRow = (result, isChild = false) => {
        const pct = Math.round((result.score / result.totalQuestions) * 100);
        const grade = getGrade(pct);
        const isReleased = result.exam?.examinationId 
            ? result.exam.examinationId.isResultReleased === true 
            : result.exam?.isResultReleased === true;
        
        return (
            <tr key={result._id} style={{ borderBottom: '1px solid var(--border-default)', transition: 'background 0.2s ease', background: isChild ? 'var(--bg-body)' : 'transparent' }} className={isChild ? "" : "table-row-hover"}>
                <td style={{ padding: isChild ? '16px 24px 16px 48px' : '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: isChild ? 'var(--bg-card)' : 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                            <FileText size={16} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {isChild ? (result.exam?.title?.split(' - ').pop() || 'Deleted Exam') : (result.exam?.title || 'Deleted Exam')}
                        </span>
                    </div>
                </td>
                <td style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
                    {new Date(result.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    {isReleased ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</span>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{result.score} / {result.totalQuestions} pts</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not Released</span>
                        </div>
                    )}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    {isReleased ? (
                        <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            fontSize: 13, 
                            fontWeight: 700, 
                            background: pct >= 70 ? 'var(--success-subtle)' : pct >= 50 ? 'var(--warning-subtle)' : 'var(--danger-subtle)',
                            color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
                        }}>
                            {grade}
                        </span>
                    ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>-</span>
                    )}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button 
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: isReleased ? 1 : 0.5, cursor: isReleased ? 'pointer' : 'not-allowed' }}
                        onClick={() => isReleased && setSelectedResult(result)}
                        disabled={!isReleased}
                    >
                        Details <ChevronRight size={14} />
                    </button>
                </td>
            </tr>
        );
    };

    const releasedResults = results.filter(r => (r.exam?.examinationId ? r.exam.examinationId.isResultReleased : r.exam?.isResultReleased));
    const avgScore = releasedResults.length > 0 ? Math.round((releasedResults.reduce((acc, r) => acc + (r.score / Math.max(1, r.totalQuestions)), 0) / releasedResults.length) * 100) : 0;
    const bestScore = releasedResults.length > 0 ? Math.round(Math.max(...releasedResults.map(r => r.score / Math.max(1, r.totalQuestions))) * 100) : 0;

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-default)', paddingBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>Results History</h1>
                    <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>Review your past examination performance.</p>
                </div>
                
                <div style={{ position: 'relative', width: 320 }}>
                    <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input 
                        type="text" 
                        placeholder="Search exams..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px 12px 44px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, transition: 'border-color 0.2s', outline: 'none' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                </div>
            </div>

            {/* Performance Summary */}
            {releasedResults.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>Completed Exams</p>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{results.length}</h3>
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--warning-subtle)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>Average Score</p>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{avgScore}%</h3>
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--success-subtle)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>Best Score</p>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{bestScore}%</h3>
                        </div>
                    </div>
                </div>
            )}

            <div>
                {filteredResults.length === 0 ? (
                    <div style={{ padding: 64, textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--border-strong)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' }}>
                            <Target size={36} opacity={0.5} />
                        </div>
                        <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>No results found</h3>
                        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                            {searchQuery ? `We couldn't find any results matching "${searchQuery}".` : "You haven't completed any exams yet."}
                        </p>
                        {!searchQuery && (
                            <button 
                                onClick={() => navigate('/student/exams')}
                                style={{ marginTop: 24, padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                Browse Exams
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Desktop Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 100px 120px', gap: 16, padding: '0 24px 12px 24px', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                            <div>Exam Name</div>
                            <div>Date Taken</div>
                            <div>Score</div>
                            <div style={{ textAlign: 'center' }}>Grade</div>
                            <div style={{ textAlign: 'right' }}>Action</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Render Hierarchical Results */}
                            {groups.map(group => {
                                const isExpanded = expandedResults[group.examination._id];
                                const isReleased = group.examination.isResultReleased;

                                let totalScore = 0;
                                let totalQuestions = 0;
                                group.results.forEach(r => {
                                    totalScore += r.score;
                                    totalQuestions += r.totalQuestions;
                                });
                                const overallPct = Math.round((totalScore / Math.max(1, totalQuestions)) * 100);
                                const overallGrade = getGrade(overallPct);

                                return (
                                    <div key={group.examination._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, overflow: 'hidden', transition: 'all 0.2s', boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.05)' : 'none' }}>
                                        <div 
                                            onClick={() => toggleExpand(group.examination._id)}
                                            style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 100px 120px', gap: 16, alignItems: 'center', padding: '20px 24px', cursor: 'pointer', background: isExpanded ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.2s ease' }} 
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isExpanded ? 'var(--bg-card)' : 'var(--bg-body)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                                                    <ChevronDown size={16} color="var(--text-secondary)" />
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>{group.examination.title}</span>
                                                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg-body)', padding: '2px 8px', borderRadius: 8 }}>{group.results.length} Module{group.results.length !== 1 ? 's' : ''} Taken</span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                                                -
                                            </div>
                                            <div>
                                                {isReleased ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: 14, fontWeight: 600, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{overallPct}%</span>
                                                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Overall</span>
                                                        </div>
                                                        <div style={{ height: 4, width: '100%', background: 'var(--bg-body)', borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${overallPct}%`, background: overallPct >= 80 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2 }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>Not Released</span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                {isReleased ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, fontSize: 14, fontWeight: 700, background: overallPct >= 70 ? 'var(--success-subtle)' : overallPct >= 50 ? 'var(--warning-subtle)' : 'var(--danger-subtle)', color: overallPct >= 70 ? 'var(--success)' : overallPct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                        {overallGrade}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>-</span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {/* Empty for parent row */}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ background: 'var(--bg-body)', padding: '8px 24px 24px 24px', borderTop: '1px solid var(--border-default)' }}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, paddingLeft: 48 }}>
                                                    Modules
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {group.results.map(result => {
                                                        const pct = Math.round((result.score / result.totalQuestions) * 100);
                                                        const grade = getGrade(pct);
                                                        
                                                        return (
                                                            <div key={result._id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 100px 120px', gap: 16, alignItems: 'center', padding: '12px 16px 12px 48px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isReleased ? (pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-tertiary)' }} />
                                                                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                        {result.exam?.title?.split(' - ').pop() || 'Deleted Exam'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                                    {new Date(result.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                                </div>
                                                                <div>
                                                                    {isReleased ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                <span style={{ fontSize: 13, fontWeight: 600, color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</span>
                                                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{result.score}/{result.totalQuestions} pts</span>
                                                                            </div>
                                                                            <div style={{ height: 3, width: '100%', background: 'var(--bg-body)', borderRadius: 2, overflow: 'hidden' }}>
                                                                                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2 }} />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>-</span>
                                                                    )}
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    {isReleased ? (
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 700, background: pct >= 70 ? 'var(--success-subtle)' : pct >= 50 ? 'var(--warning-subtle)' : 'var(--danger-subtle)', color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                                            {grade}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>-</span>
                                                                    )}
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <button 
                                                                        style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: isReleased ? 1 : 0.5, cursor: isReleased ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                                                                        onClick={() => isReleased && setSelectedResult(result)}
                                                                        disabled={!isReleased}
                                                                        onMouseEnter={e => { if(isReleased) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; } }}
                                                                        onMouseLeave={e => { if(isReleased) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
                                                                    >
                                                                        Details <ChevronRight size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Render Standalone Results */}
                            {standaloneResults.map(result => {
                                const pct = Math.round((result.score / result.totalQuestions) * 100);
                                const grade = getGrade(pct);
                                const isReleased = result.exam?.isResultReleased === true;
                                
                                return (
                                    <div key={result._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, overflow: 'hidden' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 100px 120px', gap: 16, alignItems: 'center', padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', flexShrink: 0 }}>
                                                    <FileText size={16} />
                                                </div>
                                                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {result.exam?.title || 'Deleted Exam'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                                {new Date(result.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div>
                                                {isReleased ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontSize: 14, fontWeight: 600, color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</span>
                                                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{result.score}/{result.totalQuestions} pts</span>
                                                        </div>
                                                        <div style={{ height: 4, width: '100%', background: 'var(--bg-body)', borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 2 }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-body)', padding: '4px 10px', borderRadius: 8 }}>Not Released</span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                {isReleased ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, fontSize: 14, fontWeight: 700, background: pct >= 70 ? 'var(--success-subtle)' : pct >= 50 ? 'var(--warning-subtle)' : 'var(--danger-subtle)', color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                                                        {grade}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>-</span>
                                                )}
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <button 
                                                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isReleased ? 1 : 0.5, cursor: isReleased ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                                                    onClick={() => isReleased && setSelectedResult(result)}
                                                    disabled={!isReleased}
                                                    onMouseEnter={e => { if(isReleased) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; } }}
                                                    onMouseLeave={e => { if(isReleased) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
                                                >
                                                    Details <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Result Detail Modal */}
            {selectedResult && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--border-default)', animation: 'slideIn 0.2s ease-out' }}>
                        <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Target size={18} />
                                </div>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Performance Report</h3>
                            </div>
                            <button onClick={() => setSelectedResult(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-body)', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-body)'}>
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '0 32px 32px 32px' }}>
                            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                                <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.01em' }}>{selectedResult.exam?.title || 'Deleted Exam'}</h2>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Calendar size={14} /> {new Date(selectedResult.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>

                            {(() => {
                                const pct = Math.round((selectedResult.score / selectedResult.totalQuestions) * 100);
                                const grade = getGrade(pct);
                                const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
                                const subtleColor = pct >= 80 ? 'var(--success-subtle)' : pct >= 50 ? 'var(--warning-subtle)' : 'var(--danger-subtle)';

                                return (
                                    <>
                                        <div style={{ background: 'var(--bg-body)', borderRadius: 16, padding: '24px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-default)' }}>
                                            <div>
                                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Final Score</p>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                                    <span style={{ fontSize: 40, fontWeight: 700, color: color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                                        {pct}%
                                                    </span>
                                                    <span style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>({selectedResult.score} / {selectedResult.totalQuestions})</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Grade</p>
                                                <span style={{ 
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 48, height: 48, borderRadius: 14, fontSize: 24, fontWeight: 700, 
                                                    background: subtleColor, color: color,
                                                    boxShadow: `0 4px 12px ${subtleColor}`
                                                }}>
                                                    {grade}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', padding: '16px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--success-subtle)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <CheckCircle2 size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>Correct</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedResult.score}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border-default)', padding: '16px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--danger-subtle)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <XCircle size={20} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>Incorrect</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedResult.totalQuestions - selectedResult.score}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )
                            })()}

                            <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--brand-primary-subtle)', borderRadius: 12, border: `1px solid rgba(59, 130, 246, 0.2)`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <AlertCircle size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 2 }} />
                                <p style={{ fontSize: 13, color: 'var(--brand-primary)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                    Detailed question-level review is currently disabled for this exam. Reach out to your instructor for specific feedback.
                                </p>
                            </div>
                        </div>
                        
                        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-body)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedResult(null)} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.9} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentResultsPage;
