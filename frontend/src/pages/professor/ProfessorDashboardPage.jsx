import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Activity, PackageOpen, CheckCircle, Clock, Plus, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Skeleton, SkeletonTable } from '../../components/SkeletonLoader.jsx'
import { getCachedData } from '../../utils/apiCache.js'

const ProfessorDashboardPage = () => {
    const [profName, setProfName] = useState('')
    const cached = getCachedData('/api/professor/batches')
    const [batches, setBatches] = useState(() => cached?.batches || [])
    const [loading, setLoading] = useState(() => !cached)
    const navigate = useNavigate()

    const fetchMyBatches = async (token) => {
        try {
            const response = await axios.get('/api/professor/batches', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setBatches(response.data.batches || [])
        } catch (error) {
            console.error("Error fetching batches: ", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const token = localStorage.getItem('profToken')
        const profDataString = localStorage.getItem('profData')

        if (!token || !profDataString) {
            navigate('/professor/login')
        } else {
            const profData = JSON.parse(profDataString)
            setProfName(profData.name || profData.email?.split('@')[0])
            fetchMyBatches(token)
        }
    }, [navigate])

    // Calculate metrics
    const totalBatches = batches.length
    const pendingBatches = batches.filter(b => b.status === 'Draft' || b.status === 'MarkForReview').length
    const submittedBatches = batches.filter(b => ['Submitted', 'Accepted', 'Rejected'].includes(b.status)).length
    const totalQuestions = batches.reduce((sum, b) => sum + (b.questions?.length || 0), 0)

    const recentBatches = [...batches].reverse().slice(0, 5)

    return (
        <>
            <div className="page-header" style={{ marginBottom: 32 }}>
                <div className="page-header-top">
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Professor Portal
                        </p>
                        <h1 className="page-title" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                            Good day, {profName}
                        </h1>
                        <p className="page-subtitle" style={{ fontSize: 14 }}>
                            Here's an overview of your academic contributions.
                        </p>
                    </div>
                </div>
            </div>

            <div className="kpi-showcase" style={{ marginBottom: 32 }}>
                <div className="kpi-module">
                    <p className="kpi-module-title">Total Batches</p>
                    {loading ? <Skeleton height={38} width={50} style={{ margin: '8px 0' }} /> : <p className="kpi-module-value">{totalBatches}</p>}
                    <p className="kpi-module-sub" style={{ color: 'var(--success)' }}>
                        <PackageOpen size={16} style={{ marginRight: 4 }} />
                        <span>Active</span>
                    </p>
                </div>
                <div className="kpi-module">
                    <p className="kpi-module-title">Pending Review</p>
                    {loading ? <Skeleton height={38} width={50} style={{ margin: '8px 0' }} /> : <p className="kpi-module-value">{pendingBatches}</p>}
                    <p className="kpi-module-sub" style={{ color: 'var(--warning)' }}>
                        <Clock size={16} style={{ marginRight: 4 }} />
                        <span>Awaiting Admin</span>
                    </p>
                </div>
                <div className="kpi-module">
                    <p className="kpi-module-title">Submitted</p>
                    {loading ? <Skeleton height={38} width={50} style={{ margin: '8px 0' }} /> : <p className="kpi-module-value">{submittedBatches}</p>}
                    <p className="kpi-module-sub" style={{ color: 'var(--success)' }}>
                        <CheckCircle size={16} style={{ marginRight: 4 }} />
                        <span>With Admin</span>
                    </p>
                </div>
                <div className="kpi-module">
                    <p className="kpi-module-title">Questions Created</p>
                    {loading ? <Skeleton height={38} width={50} style={{ margin: '8px 0' }} /> : <p className="kpi-module-value">{totalQuestions}</p>}
                    <p className="kpi-module-sub" style={{ color: 'var(--text-secondary)' }}>
                        <Activity size={16} style={{ marginRight: 4 }} />
                        <span>Across all batches</span>
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
                <div className="card">
                    <div className="card-header" style={{ padding: '20px 24px' }}>
                        <h3 className="card-title">Recent Batches</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/professor/batches')}>View All</button>
                    </div>
                    <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Subject</th>
                                    <th>Questions</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            {loading ? (
                                <SkeletonTable rows={3} />
                            ) : (
                                <tbody>
                                    {recentBatches.length > 0 ? (
                                        recentBatches.map(batch => (
                                            <tr key={batch._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/professor/batches')}>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{batch.title}</span>
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{batch.subject}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{batch.questions?.length || 0}</td>
                                                <td><StatusBadge status={['Accepted', 'Rejected'].includes(batch.status) ? 'Submitted' : (batch.status || 'Draft')} /></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                                            No batches created yet.
                                        </td></tr>
                                    )}
                                </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}

export default ProfessorDashboardPage
