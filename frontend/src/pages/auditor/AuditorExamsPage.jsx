import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuditorLayout } from './AuditorLayout.jsx'
import { SkeletonRow } from '../../components/SkeletonLoader.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import axios from 'axios'
import { format } from 'date-fns'
import { ClipboardList } from 'lucide-react'

const API = '/api'
const getToken = () => localStorage.getItem('auditorToken')

export default function AuditorExamsPage() {
    const [exams, setExams] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        const fetchExams = async () => {
            const token = getToken()
            if (!token) { navigate('/auditor/login'); return }
            try {
                const res = await axios.get(`${API}/auditor/exams`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setExams(res.data.exams)
            } catch (err) {
                if (err.response?.status === 401) navigate('/auditor/login')
            } finally {
                setLoading(false)
            }
        }
        fetchExams()
    }, [])

    return (
        <AuditorLayout>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Academic Records
                    </p>
                    <h1 className="page-title">Exams Directory</h1>
                    <p className="page-subtitle">Read-only inspection of configured exams and their current status.</p>
                </div>
                <div className="page-actions">
                    <span className="badge" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', fontWeight: 600, padding: '6px 12px' }}>
                        VIEW ONLY
                    </span>
                </div>
            </div>

            <div className="card">
                <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Exam Title</th>
                                <th>Status</th>
                                <th>Created At</th>
                                <th>Scheduled For</th>
                                <th>Ends At</th>
                            </tr>
                        </thead>
                        {loading ? (
                            <tbody>
                                {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
                            </tbody>
                        ) : (
                            <tbody>
                                {exams.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                                            <ClipboardList size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                                            No exams available.
                                        </td>
                                    </tr>
                                ) : exams.map(exam => (
                                    <tr key={exam._id}>
                                        <td style={{ fontWeight: 600 }}>{exam.title}</td>
                                        <td><StatusBadge status={exam.status || 'Draft'} /></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{format(new Date(exam.createdAt), 'MMM d, yyyy')}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                            {exam.scheduledAt ? format(new Date(exam.scheduledAt), 'MMM d, yyyy HH:mm') : '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                            {exam.endsAt ? format(new Date(exam.endsAt), 'MMM d, yyyy HH:mm') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        )}
                    </table>
                </div>
            </div>
        </AuditorLayout>
    )
}
