import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuditorLayout } from './AuditorLayout.jsx'
import { SkeletonRow } from '../../components/SkeletonLoader.jsx'
import axios from 'axios'
import { format } from 'date-fns'

const API = '/api'
const getToken = () => localStorage.getItem('auditorToken')

export default function AuditorPeoplePage() {
    const [students, setStudents] = useState([])
    const [professors, setProfessors] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const location = useLocation()

    // Determine tab from current route
    const tab = location.pathname === '/auditor/professors' ? 'professors' : 'students'

    useEffect(() => {
        const fetchData = async () => {
            const token = getToken()
            if (!token) { navigate('/auditor/login'); return }
            setLoading(true)
            try {
                if (tab === 'students') {
                    const res = await axios.get(`${API}/auditor/students`, { headers: { Authorization: `Bearer ${token}` } })
                    setStudents(res.data.students)
                } else {
                    const res = await axios.get(`${API}/auditor/professors`, { headers: { Authorization: `Bearer ${token}` } })
                    setProfessors(res.data.professors)
                }
            } catch (err) {
                if (err.response?.status === 401) navigate('/auditor/login')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [tab, navigate])

    return (
        <AuditorLayout>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Identity Records
                    </p>
                    <h1 className="page-title">{tab === 'professors' ? 'Professors Directory' : 'Students Directory'}</h1>
                    <p className="page-subtitle">Read-only view of registered {tab === 'professors' ? 'professors' : 'students'}.</p>
                </div>
                <div className="page-actions">
                    <span className="badge" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', fontWeight: 600, padding: '6px 12px' }}>
                        VIEW ONLY
                    </span>
                </div>
            </div>

            <div className="card">
                <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    {tab === 'students' && (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Student ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            {loading ? (
                                <tbody>{[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
                            ) : (
                                <tbody>
                                    {students.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No students registered.</td></tr>
                                    ) : students.map(s => (
                                        <tr key={s._id}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{s.studentId}</td>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{format(new Date(s.createdAt), 'MMM d, yyyy')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}
                        </table>
                    )}
                    {tab === 'professors' && (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Professor ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                </tr>
                            </thead>
                            {loading ? (
                                <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
                            ) : (
                                <tbody>
                                    {professors.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No professors registered.</td></tr>
                                    ) : professors.map(p => (
                                        <tr key={p._id}>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{p.id}</td>
                                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{p.email}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{p.contact || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            )}
                        </table>
                    )}
                </div>
            </div>
        </AuditorLayout>
    )
}
