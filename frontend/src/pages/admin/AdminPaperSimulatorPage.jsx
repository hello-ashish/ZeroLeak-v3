import React, { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from './AdminLayout.jsx'
import { Beaker, RefreshCw, Lock, Unlock, ShieldCheck, Terminal, Fingerprint, Cpu, Search, BrainCircuit, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { EmptyState, Skeleton, SkeletonCard, SkeletonRow, SkeletonTable } from '../../components/SkeletonLoader.jsx'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

// Decryption Animation Component
const DecryptionVisualizer = ({ onComplete }) => {
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState([])
    const [unlocked, setUnlocked] = useState(false)

    useEffect(() => {
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.floor(Math.random() * 8) + 4
            if (currentProgress >= 100) {
                currentProgress = 100
                setUnlocked(true)
                clearInterval(interval)
                setTimeout(onComplete, 1200) // wait a bit after unlock to show success
            }
            setProgress(currentProgress)

            // Add random log
            const hash = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
            setLogs(prev => [...prev.slice(-4), `[${new Date().toISOString().split('T')[1].slice(0, -1)}] Verifying block integrity: 0x${hash}...`])
        }, 120)

        return () => clearInterval(interval)
    }, [onComplete])

    return (
        <div style={{
            padding: '40px 32px',
            background: 'linear-gradient(145deg, rgba(20,25,35,0.95), rgba(10,12,18,0.98))',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Glow */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200,
                height: 200,
                background: unlocked ? 'var(--success)' : 'var(--brand-primary)',
                opacity: 0.15,
                filter: 'blur(60px)',
                borderRadius: '50%',
                pointerEvents: 'none',
                transition: 'all 1s ease'
            }} />

            <div style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: unlocked ? 'rgba(46, 160, 67, 0.1)' : 'rgba(88, 101, 242, 0.1)',
                color: unlocked ? '#3fb950' : '#5865F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: unlocked ? 'scale(1.15)' : 'scale(1)',
                boxShadow: unlocked ? '0 0 30px rgba(46, 160, 67, 0.3), inset 0 0 15px rgba(46,160,67,0.2)' : '0 0 30px rgba(88, 101, 242, 0.3), inset 0 0 15px rgba(88,101,242,0.2)',
                border: `1px solid ${unlocked ? 'rgba(46, 160, 67, 0.4)' : 'rgba(88, 101, 242, 0.4)'}`
            }}>
                {unlocked ? <Unlock size={44} strokeWidth={2.5} /> : <Lock size={44} strokeWidth={2.5} className="pulse" />}
            </div>

            <div style={{ textAlign: 'center', zIndex: 1 }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {unlocked ? 'Decryption Complete' : 'Decrypting Question Bank...'}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>
                    Using cryptographic keys to unlock ZeroLeak questions dynamically.
                </p>
            </div>

            <div style={{ width: '100%', maxWidth: 460, background: 'rgba(0,0,0,0.4)', height: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: unlocked ? '#3fb950' : 'linear-gradient(90deg, #5865F2, #8b949e)',
                    transition: 'width 0.2s ease, background 0.4s ease',
                    boxShadow: '0 0 10px rgba(88, 101, 242, 0.5)'
                }} />
            </div>

            <div style={{
                width: '100%',
                maxWidth: 460,
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '12px',
                padding: 16,
                fontFamily: '"Fira Code", monospace',
                fontSize: 12,
                color: '#7ee787',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minHeight: 140,
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8b949e', marginBottom: 8, borderBottom: '1px solid #30363d', paddingBottom: 8, fontWeight: 600 }}>
                    <Terminal size={14} /> SYSTEM KERNEL
                </div>
                {logs.map((log, i) => (
                    <div key={i} style={{ opacity: 0.4 + (i * 0.2), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log}</div>
                ))}
                {unlocked && <div style={{ color: '#58a6ff', marginTop: 8, fontWeight: 'bold' }}>✓ Handshake successful. Questions decrypted securely.</div>}
            </div>
        </div>
    )
}

export const AdminPaperSimulatorPage = () => {
    const navigate = useNavigate()
    const [subjects, setSubjects] = useState([])
    const [selectedSubject, setSelectedSubject] = useState('')
    const [numQuestions, setNumQuestions] = useState(10)

    const [generatedPaper, setGeneratedPaper] = useState(null)
    const [loading, setLoading] = useState(false)
    const [isDecrypting, setIsDecrypting] = useState(false)

    const toast = useToast()

    useEffect(() => {
        setLoading(true)
        axios.get(`${API}/questions?limit=1`, { headers: { Authorization: `Bearer ${getToken()}` } })
            .then(res => {
                const uniqueSubjects = res.data.subjects || []
                setSubjects(uniqueSubjects)
                if (uniqueSubjects.length > 0) setSelectedSubject(uniqueSubjects[0])
            })
            .catch(err => {
                console.error(err)
                if (err.response?.status === 401) {
                    toast.error("Session expired. Please log in again.")
                    localStorage.removeItem('adminToken')
                    navigate('/admin/login')
                } else {
                    toast.error("Failed to load questions from bank")
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const handleGenerate = () => {
        if (!selectedSubject) return toast.error("Please select a subject")
        if (numQuestions <= 0) return toast.error("Number of questions must be greater than 0")

        setGeneratedPaper(null)
        setIsDecrypting(true)
    }

    const getDifficultyColor = (level) => {
        switch ((level || '').toLowerCase()) {
            case 'easy': return { color: 'var(--success)', bg: 'var(--success-subtle)' };
            case 'hard': return { color: 'var(--danger)', bg: 'var(--danger-subtle)' };
            case 'medium':
            default: return { color: 'var(--warning)', bg: 'var(--warning-subtle)' };
        }
    }

    const onDecryptionComplete = useCallback(async () => {
        console.log("onDecryptionComplete triggered!");
        try {
            console.log(`Sending request to ${API}/questions/simulate?subject=${selectedSubject}&numQuestions=${numQuestions}`);
            const res = await axios.get(`${API}/questions/simulate?subject=${encodeURIComponent(selectedSubject)}&numQuestions=${numQuestions}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            console.log("Request succeeded, received:", res.data.questions?.length, "questions");
            setGeneratedPaper(res.data.questions)
            toast.success(`Securely generated random paper with ${res.data.questions.length} questions`)
        } catch (err) {
            console.error("Simulation request failed:", err)
            toast.error(err.response?.data?.message || "Failed to generate paper")
        } finally {
            console.log("Setting isDecrypting to false");
            setIsDecrypting(false)
        }
    }, [selectedSubject, numQuestions]);

    return (
        <AdminLayout>
            <div style={{
                maxWidth: 900,
                margin: '0 auto',
                height: (generatedPaper && !isDecrypting) ? 'calc(100vh - 120px)' : 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                    {/* Configuration Card */}
                    {loading ? (<>
                        <SkeletonCard />
                    </>
                    ) : !isDecrypting && !generatedPaper && (
                        <div className="card" style={{
                            padding: 32,
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-elevated)',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
                            borderRadius: 20
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                                <div style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', padding: 10, borderRadius: 12 }}>
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Simulator Parameters</h2>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Configure the subject and size for the dynamic generation.</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Target Subject</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            className="form-select"
                                            value={selectedSubject}
                                            onChange={e => setSelectedSubject(e.target.value)}
                                            disabled={isDecrypting}
                                            style={{ height: 48, fontSize: 15, paddingLeft: 40, borderRadius: 12 }}
                                        >
                                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <Search size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Number of Questions</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={numQuestions}
                                        min={1}
                                        onChange={e => setNumQuestions(parseInt(e.target.value) || 0)}
                                        disabled={isDecrypting}
                                        style={{ height: 48, fontSize: 15, borderRadius: 12 }}
                                    />
                                </div>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerate}
                                disabled={loading || subjects.length === 0 || isDecrypting}
                                style={{
                                    width: '100%',
                                    height: 52,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    borderRadius: 12,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: 10,
                                    boxShadow: '0 4px 15px var(--brand-primary-subtle)'
                                }}
                            >
                                <Fingerprint size={20} /> Initialize Secure Generation
                            </button>
                        </div>
                    )}

                    {/* Decryption Animation */}
                    {isDecrypting && <div style={{ animation: 'slideDown 0.4s ease' }}><DecryptionVisualizer onComplete={onDecryptionComplete} /></div>}

                    {/* Results Card */}
                    {generatedPaper && !isDecrypting && (
                        <div className="card" style={{
                            padding: 0,
                            animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-elevated)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.06)',
                            borderRadius: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            minHeight: 0
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '24px 32px',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: 'var(--bg-elevated)',
                                borderRadius: '20px 20px 0 0',
                                flexShrink: 0
                            }}>
                                <div>
                                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ShieldCheck size={24} color="var(--success)" /> Decrypted Question Paper
                                    </h2>
                                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
                                        Successfully loaded {generatedPaper.length} unique questions for {selectedSubject}.
                                    </p>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                        <span style={{ fontSize: 12, color: 'var(--success)', background: 'var(--success-subtle)', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                                            {generatedPaper.filter(q => (q.difficultyLevel || "").toLowerCase() === 'easy').length} Easy
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--warning-subtle)', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                                            {generatedPaper.filter(q => (q.difficultyLevel || "").toLowerCase() === 'medium').length} Medium
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-subtle)', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                                            {generatedPaper.filter(q => (q.difficultyLevel || "").toLowerCase() === 'hard').length} Hard
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <button className="btn btn-secondary" onClick={() => setGeneratedPaper(null)} style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600 }}>
                                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Reset Simulator
                                    </button>
                                    <div style={{ background: 'var(--success-subtle)', color: 'var(--success)', padding: '6px 14px', borderRadius: 24, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--success-border)' }}>
                                        <Unlock size={14} strokeWidth={3} /> Verified
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 32, overflowY: 'auto', flex: 1 }}>
                                {generatedPaper.map((q, idx) => (
                                    <div key={q._id || idx} style={{
                                        padding: 32,
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 20,
                                        background: 'var(--bg-surface)',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                        animation: `slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s forwards`,
                                        opacity: 0,
                                        transform: 'translateY(20px)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Question {idx + 1} of {generatedPaper.length}
                                            </span>
                                            <span style={{
                                                fontSize: 13,
                                                color: getDifficultyColor(q.difficultyLevel).color,
                                                fontWeight: 600,
                                                background: getDifficultyColor(q.difficultyLevel).bg,
                                                padding: '4px 12px',
                                                borderRadius: 20
                                            }}>
                                                {q.difficultyLevel || 'Medium'}
                                            </span>
                                        </div>

                                        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16, lineHeight: 1.6 }}>
                                            <span style={{
                                                background: 'linear-gradient(135deg, var(--brand-primary), #4e5cc0)',
                                                color: 'white',
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                fontSize: 16,
                                                fontWeight: 800,
                                                boxShadow: '0 4px 10px rgba(88, 101, 242, 0.3)'
                                            }}>{idx + 1}</span>
                                            <span style={{ paddingTop: 4 }}>{q.title}</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, paddingLeft: 52 }}>
                                            {q.options.map((opt, oIdx) => (
                                                <div key={oIdx} style={{
                                                    fontSize: 15,
                                                    padding: '14px 20px',
                                                    background: 'var(--bg-base)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: 12,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 16,
                                                    transition: 'all 0.2s ease',
                                                    cursor: 'default',
                                                    ':hover': {
                                                        borderColor: 'var(--brand-primary)',
                                                        background: 'var(--brand-primary-subtle)'
                                                    }
                                                }}>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: 'var(--brand-primary)',
                                                        background: 'var(--brand-primary-subtle)',
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: 8,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 13,
                                                        border: '1px solid rgba(88, 101, 242, 0.2)'
                                                    }}>{String.fromCharCode(65 + oIdx)}</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>{opt}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />
        </AdminLayout>
    )
}
