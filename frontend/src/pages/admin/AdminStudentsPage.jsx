import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Search, User, Trash2, AlertTriangle, GraduationCap, X, ChevronRight, CheckCircle2, TrendingDown, Upload, Download, UserX, CheckSquare, FileText, Loader2 } from 'lucide-react'
import Papa from 'papaparse'
import { AdminLayout } from './AdminLayout.jsx'
import { Modal, ConfirmDialog } from '../../components/Modal.jsx'
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx'
import { ScorePill } from '../../components/StatusBadge.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { useToast } from '../../components/Toast.jsx'
import { getCachedData } from '../../utils/apiCache.js'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

export default function AdminStudentsPage() {
    const cachedStu = getCachedData(`${API}/students`)
    const [students, setStudents] = useState(() => cachedStu?.students || [])
    const [results, setResults] = useState(() => getCachedData(`${API}/exams/results`)?.results || [])
    const [loading, setLoading] = useState(() => !cachedStu)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showAdd, setShowAdd] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [creating, setCreating] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [isSelectMode, setIsSelectMode] = useState(false)
    const [sortConfig, setSortConfig] = useState('default')
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 10
    const [isImporting, setIsImporting] = useState(false)
    const [liveStudents, setLiveStudents] = useState([])
    const [form, setForm] = useState({ studentId: '', name: '', email: '', password: '', department: '', batch: '', contact: '', dateOfBirth: '', address: '', gender: '', program: '' })
    const [formErrors, setFormErrors] = useState({})
    const [showPass, setShowPass] = useState(false)
    const [blockingId, setBlockingId] = useState(null)
    const [previewModal, setPreviewModal] = useState({ isOpen: false, title: '', content: '', headers: [], rows: [], filename: '' })
    const [importPreview, setImportPreview] = useState(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [aiAnalysis, setAiAnalysis] = useState(null)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const toast = useToast()

    const fetchData = async (showLoad = true) => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (showLoad && !getCachedData(`${API}/students`)) setLoading(true)
            const [stuRes, resRes, liveRes] = await Promise.all([
                axios.get(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/exams/results`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/admin/students/live`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { liveStudents: [] } }))
            ])
            setStudents(stuRes.data.students || [])
            setResults(resRes.data.results || [])
            setLiveStudents(liveRes.data.liveStudents || [])
        } catch {
            toast.error('Failed to load students')
        } finally {
            if (showLoad) setLoading(false)
        }
    }

    const fetchLiveStudents = async () => {
        const token = getToken()
        if (!token) return
        try {
            const liveRes = await axios.get(`${API}/admin/students/live`, { headers: { Authorization: `Bearer ${token}` } })
            setLiveStudents(liveRes.data.liveStudents || [])
        } catch (_) {}
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchLiveStudents, 10000);
        return () => clearInterval(interval);
    }, [])

    const processedStudentId = useRef(null)

    useEffect(() => {
        const studentId = searchParams.get('studentId')

        if (!studentId) {
            processedStudentId.current = null
            return
        }

        if (students.length > 0 && processedStudentId.current !== studentId) {
            const stu = students.find(s => s._id === studentId)
            if (stu) {
                setSelectedStudent(stu)
                processedStudentId.current = studentId
            }
        }
    }, [searchParams, students])

    const handleToggleBlock = async (id) => {
        const token = getToken();
        if (!token) return;
        try {
            setBlockingId(id);
            await axios.post(`${API}/admin/students/${id}/block`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Student access updated");
            fetchData(false);
            if (selectedStudent && selectedStudent._id === id) {
                setSelectedStudent(prev => ({ ...prev, isBlocked: !prev.isBlocked }));
            }
        } catch (err) {
            toast.error("Failed to update student access");
        } finally {
            setBlockingId(null);
        }
    }

    const handleGenerateInsight = async () => {
        if (!selectedStudent) return;
        setIsAnalyzing(true);
        setAiAnalysis(null);
        try {
            const res = await axios.get(`${API}/ai/admin/student/${selectedStudent._id}/performance`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setAiAnalysis(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate AI analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Compute per-student stats from results
    const studentStats = useMemo(() => {
        const map = {}
        results.forEach(r => {
            if (!r.student) return
            const id = r.student._id?.toString() || r.student
            if (!map[id]) map[id] = { scores: [], exams: [] }
            map[id].scores.push(r.score)
            map[id].totalQ = r.totalQuestions
            map[id].exams.push(r)
        })
        return map
    }, [results])

    const getAvg = (studentId) => {
        const data = studentStats[studentId]
        if (!data || data.scores.length === 0 || !data.totalQ) return null
        return Math.min(100, Math.max(0, Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length / data.totalQ) * 100)))
    }

    const filtered = useMemo(() => {
        const s = search.toLowerCase()
        let result = students.filter(stu => {
            const matchesSearch = stu.name?.toLowerCase().includes(s) ||
                stu.studentId?.toLowerCase().includes(s) ||
                stu.email?.toLowerCase().includes(s);
            if (!matchesSearch) return false;

            if (filterStatus === 'live') {
                return liveStudents.some(l => l._id === stu._id);
            }
            if (filterStatus === 'blocked') {
                return stu.isBlocked === true;
            }
            if (filterStatus === 'active') {
                return stu.isBlocked !== true;
            }
            return true;
        })

        result.sort((a, b) => {
            if (sortConfig === 'name-asc') {
                return (a.name || '').localeCompare(b.name || '');
            } else if (sortConfig === 'name-desc') {
                return (b.name || '').localeCompare(a.name || '');
            } else if (sortConfig === 'id-asc') {
                return (a.studentId || '').localeCompare(b.studentId || '');
            } else if (sortConfig === 'id-desc') {
                return (b.studentId || '').localeCompare(a.studentId || '');
            } else if (sortConfig === 'score-desc') {
                const avgA = getAvg(a._id) || 0;
                const avgB = getAvg(b._id) || 0;
                return avgB - avgA;
            } else if (sortConfig === 'score-asc') {
                const avgA = getAvg(a._id) || 0;
                const avgB = getAvg(b._id) || 0;
                return avgA - avgB;
            } else if (sortConfig === 'exams-desc') {
                const countA = studentStats[a._id]?.exams?.length || 0;
                const countB = studentStats[b._id]?.exams?.length || 0;
                return countB - countA;
            }
            return 0;
        });

        return result;
    }, [students, search, filterStatus, liveStudents, sortConfig, studentStats])

    useEffect(() => {
        setPage(1)
    }, [search, filterStatus, sortConfig])

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginated = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filtered.slice(start, start + ITEMS_PER_PAGE)
    }, [filtered, currentPage])

    const activeThisWeekCount = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return students.filter(s => s.lastActiveAt && new Date(s.lastActiveAt) > sevenDaysAgo).length;
    }, [students]);

    const atRiskCount = useMemo(() => {
        return students.filter(s => {
            const avg = getAvg(s._id)
            return avg !== null && avg < 50
        }).length
    }, [students, studentStats])

    const honorRollCount = useMemo(() => {
        return students.filter(s => {
            const avg = getAvg(s._id)
            return avg !== null && avg >= 90
        }).length
    }, [students, studentStats])

    const blockedCount = useMemo(() => {
        return students.filter(s => s.isBlocked).length
    }, [students])

    const validate = () => {
        const e = {}
        if (!form.studentId.trim()) e.studentId = 'Student ID is required'
        if (!form.name.trim()) e.name = 'Name is required'
        if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required'
        if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
        return e
    }

    const handleOpenAdd = () => {
        let nextNum = 1;
        if (students.length > 0) {
            const nums = students.map(s => {
                const match = s.studentId?.match(/STU-(\d+)/i);
                return match ? parseInt(match[1], 10) : 0;
            });
            nextNum = Math.max(...nums, 0) + 1;
        }
        const nextId = `STU-${nextNum.toString().padStart(3, '0')}`;
        setForm(f => ({ ...f, studentId: nextId }));
        setShowAdd(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
        setCreating(true)
        try {
            await axios.post(`${API}/students/register`, form, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Student registered successfully')
            setShowAdd(false)
            setForm({ studentId: '', name: '', email: '', password: '', department: '', batch: '', contact: '', dateOfBirth: '', address: '', gender: '', program: '' })
            setFormErrors({})
            fetchData()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create student')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await axios.delete(`${API}/admin/students/${deleteTarget._id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Student removed')
            if (selectedStudent?._id === deleteTarget._id) setSelectedStudent(null)
            setDeleteTarget(null)
            fetchData()
        } catch {
            toast.error('Failed to delete student')
        } finally {
            setDeleting(false)
        }
    }

    const examsForStudent = (id) => studentStats[id]?.exams?.length || 0

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filtered.map(s => s._id))
        }
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} students?`)) return;
        try {
            await axios.post(`${API}/admin/students/bulk-delete`, { ids: selectedIds }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success('Students deleted successfully');
            setSelectedIds([]);
            fetchData();
        } catch {
            toast.error('Failed to delete students');
        }
    }

    const handleBulkBlock = async (block) => {
        try {
            await axios.post(`${API}/admin/students/bulk-block`, { ids: selectedIds, block }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success(`Students ${block ? 'blocked' : 'unblocked'} successfully`);
            setSelectedIds([]);
            fetchData();
        } catch {
            toast.error(`Failed to ${block ? 'block' : 'unblock'} students`);
        }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                if (!data || data.length === 0) {
                    toast.error('CSV file is empty or invalid');
                    setIsImporting(false);
                    return;
                }

                setImportPreview(data);
                setIsImporting(false);
            },
            error: (error) => {
                toast.error('Failed to parse CSV file');
                console.error(error);
                setIsImporting(false);
            }
        });

        e.target.value = null; // reset input
    };

    const confirmImport = async () => {
        setIsImporting(true);
        try {
            const res = await axios.post(`${API}/admin/students/bulk-import`, { students: importPreview }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success(`Import complete: ${res.data.imported} imported, ${res.data.skipped} skipped.`);
            fetchData();
            setImportPreview(null);
        } catch (err) {
            toast.error('Error during bulk import');
            console.error(err);
        } finally {
            setIsImporting(false);
        }
    };

    const downloadTemplate = () => {
        const headers = ['studentId', 'name', 'email', 'password', 'department', 'program', 'batch', 'contact', 'dateOfBirth', 'gender', 'address'];
        const csv = headers.join(',') + '\n';
        setPreviewModal({
            isOpen: true,
            title: 'Student Import Template Preview',
            content: csv,
            headers: headers,
            rows: [],
            filename: 'student_import_template.csv'
        });
    };

    const handleDownload = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setPreviewModal({ ...previewModal, isOpen: false });
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Student Operations</h1>
                        <p className="page-subtitle">Manage student accounts and monitor academic standing</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={downloadTemplate}>
                            <FileText size={16} /> Template
                        </button>
                        <label className={`btn btn-secondary ${isImporting ? 'disabled' : ''}`} style={{ cursor: isImporting ? 'not-allowed' : 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: 8, opacity: isImporting ? 0.7 : 1 }}>
                            {isImporting ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                            {isImporting ? 'Importing...' : 'Import'}
                            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isImporting} />
                        </label>
                        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => {
                            const headers = ['Name', 'Student ID', 'Email', 'Department', 'Program', 'Batch', 'Contact', 'Date of Birth', 'Gender', 'Address', 'Status', 'Last Active', 'Created At', 'Updated At'];
                            const rows = students.map(s => [s.name || '', s.studentId || '', s.email || '', s.department || '', s.program || '', s.batch || '', s.contact || '', s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '', s.gender || '', s.address || '', s.isBlocked ? 'Blocked' : 'Active', s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '', s.createdAt ? new Date(s.createdAt).toLocaleString() : '', s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '']);
                            const csv = [
                                headers.join(','),
                                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                            ].join('\n');
                            setPreviewModal({
                                isOpen: true,
                                title: 'Students Export Preview',
                                content: csv,
                                headers: headers,
                                rows: rows,
                                filename: 'students.csv'
                            });
                        }}>
                            <Download size={16} /> Export
                        </button>
                        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Student</button>
                    </div>
                </div>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
                <div className="kpi-card" style={{ borderColor: 'var(--brand-primary-border)' }}>
                    <div className="kpi-card-header">
                        <span className="kpi-label">Live Exams</span>
                        <span className="kpi-icon" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)' }}>
                            <div style={{ width: 8, height: 8, background: 'var(--brand-primary)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                        </span>
                    </div>
                    <div className="kpi-value">{liveStudents.length}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Active This Week</span>
                        <span className="kpi-icon" style={{ background: 'var(--info-subtle)', color: 'var(--info)' }}><GraduationCap size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : activeThisWeekCount}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Honor Roll ({'>'}90%)</span>
                        <span className="kpi-icon" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}><CheckCircle2 size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : honorRollCount}</div>
                </div>
                <div className="kpi-card" style={{ borderColor: atRiskCount > 0 ? 'var(--warning-border)' : undefined }}>
                    <div className="kpi-card-header">
                        <span className="kpi-label">At Risk ({'<'}50%)</span>
                        <span className="kpi-icon" style={{ background: 'var(--warning-subtle)', color: 'var(--warning)' }}><TrendingDown size={20} /></span>
                    </div>
                    <div className="kpi-value" style={{ color: atRiskCount > 0 ? 'var(--warning)' : undefined }}>{loading ? '—' : atRiskCount}</div>
                </div>
                <div className="kpi-card" style={{ borderColor: blockedCount > 0 ? 'var(--danger-border)' : undefined }}>
                    <div className="kpi-card-header">
                        <span className="kpi-label">Blocked</span>
                        <span className="kpi-icon" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}><UserX size={20} /></span>
                    </div>
                    <div className="kpi-value" style={{ color: blockedCount > 0 ? 'var(--danger)' : undefined }}>{loading ? '—' : blockedCount}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex gap-2 mb-4" style={{ alignItems: 'center' }}>
                        <div className="search-input-wrap" style={{ width: 280 }}>
                            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
                            <input className="search-input" placeholder="Search by name, ID, email..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select
                            className="form-select"
                            style={{ width: 140, padding: '8px 12px', height: '100%' }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="live">Live Now</option>
                            <option value="active">Active</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <select
                            className="form-select"
                            style={{ width: 150, padding: '8px 12px', height: '100%' }}
                            value={sortConfig}
                            onChange={(e) => setSortConfig(e.target.value)}
                        >
                            <option value="default">Sort by</option>
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="id-asc">Student ID (A-Z)</option>
                            <option value="id-desc">Student ID (Z-A)</option>
                            <option value="score-desc">Highest Score</option>
                            <option value="score-asc">Lowest Score</option>
                            <option value="exams-desc">Most Exams</option>
                        </select>
                        <button
                            className={`btn ${isSelectMode ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '8px 12px', height: '100%' }}
                            onClick={() => {
                                setIsSelectMode(!isSelectMode);
                                if (isSelectMode) setSelectedIds([]);
                            }}
                        >
                            <CheckSquare size={16} style={{ marginRight: 6 }} />
                            {isSelectMode ? 'Cancel Selection' : 'Select'}
                        </button>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} students</span>
                    </div>

                    {selectedIds.length > 0 && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeIn 0.2s ease' }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{selectedIds.length} selected</span>
                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleBulkBlock(true)}>Block Selected</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleBulkBlock(false)}>Unblock Selected</button>
                                <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
                            </div>
                        </div>
                    )}

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {isSelectMode && (
                                        <th style={{ width: 40, paddingLeft: 16 }}>
                                            <input
                                                type="checkbox"
                                                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                    )}
                                    <th>Student</th>
                                    <th>ID & Email</th>
                                    <th>Exams Taken</th>
                                    <th>Avg Score</th>
                                </tr>
                            </thead>
                            {loading && students.length === 0 ? (
                                <SkeletonTable rows={7} />
                            ) : (
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={isSelectMode ? 5 : 4}>
                                            <EmptyState
                                                icon={<User size={32} color="var(--text-tertiary)" />}
                                                title="No students found"
                                                description={search ? 'No students match that search.' : 'Register your first student to get started.'}
                                                action={!search && <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Student</button>}
                                            />
                                        </td></tr>
                                    ) : paginated.map(stu => {
                                        const avg = getAvg(stu._id)
                                        const examsCount = examsForStudent(stu._id)
                                        const isSelected = selectedStudent?._id === stu._id
                                        return (
                                            <tr key={stu._id}
                                                onClick={() => {
                                                    setSelectedStudent(stu)
                                                    setAiAnalysis(null)
                                                    if (searchParams.has('studentId')) {
                                                        const p = new URLSearchParams(searchParams)
                                                        p.delete('studentId')
                                                        setSearchParams(p, { replace: true })
                                                    }
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'var(--bg-active)' : 'transparent',
                                                    borderLeft: isSelected ? '2px solid var(--brand-primary)' : '2px solid transparent'
                                                }}
                                            >
                                                {isSelectMode && (
                                                    <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 16 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(stu._id)}
                                                            onChange={() => toggleSelect(stu._id)}
                                                        />
                                                    </td>
                                                )}
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div className="avatar avatar-sm" style={{ background: stu.isBlocked ? 'var(--danger-subtle)' : 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: stu.isBlocked ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                                            <GraduationCap size={16} />
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: stu.isBlocked ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: stu.isBlocked ? 'line-through' : 'none' }}>{stu.name}</span>
                                                        {liveStudents.some(l => l._id === stu._id) && !stu.isBlocked && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--brand-primary)', background: 'var(--brand-primary-subtle)', padding: '2px 6px', borderRadius: 12 }}>
                                                                <div style={{ width: 6, height: 6, background: 'var(--brand-primary)', borderRadius: '50%', animation: 'pulse 2s infinite' }} /> LIVE
                                                            </span>
                                                        )}
                                                        {avg !== null && avg < 50 && <AlertTriangle size={14} color="var(--warning)" style={{ marginLeft: 4 }} title="At risk" />}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{stu.studentId}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{stu.email}</div>
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{examsCount}</td>
                                                <td>
                                                    {avg !== null ? <ScorePill score={avg} total={100} /> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No exams</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            )}
                        </table>

                        <Pagination
                            currentPage={currentPage}
                            totalItems={filtered.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setPage}
                            itemLabel="students"
                        />
                    </div>
                </div>

                {/* Right Side Drawer / Panel */}
                {selectedStudent && (
                    <div style={{
                        width: 380,
                        flexShrink: 0,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        position: 'sticky',
                        top: 'var(--topbar-height)',
                        marginTop: 48,
                        animation: 'slideInRight 200ms ease',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: 'calc(100vh - 120px)'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="flex items-center gap-3">
                                <div className="avatar" style={{ background: 'var(--brand-primary)', width: 40, height: 40, fontSize: 16 }}>
                                    {selectedStudent.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, color: selectedStudent.isBlocked ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: selectedStudent.isBlocked ? 'line-through' : 'none' }}>{selectedStudent.name}</h3>
                                        {selectedStudent.isBlocked && <span style={{ fontSize: 10, background: 'var(--danger-subtle)', color: 'var(--danger)', padding: '2px 6px', borderRadius: 12, fontWeight: 600 }}>BLOCKED</span>}
                                        {liveStudents.some(l => l._id === selectedStudent._id) && !selectedStudent.isBlocked && <span style={{ fontSize: 10, background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary)', padding: '2px 6px', borderRadius: 12, fontWeight: 600 }}>LIVE EXAM</span>}
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{selectedStudent.studentId}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className={`btn btn-sm ${selectedStudent.isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                                    onClick={() => handleToggleBlock(selectedStudent._id)}
                                    disabled={blockingId === selectedStudent._id}
                                >
                                    {blockingId === selectedStudent._id ? '...' : (selectedStudent.isBlocked ? 'Unblock' : 'Block Access')}
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => {
                                    setSelectedStudent(null)
                                    if (searchParams.has('studentId')) {
                                        const p = new URLSearchParams(searchParams)
                                        p.delete('studentId')
                                        setSearchParams(p, { replace: true })
                                    }
                                }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: 24, overflowY: 'auto' }}>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Details</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Email: {selectedStudent.email}</div>
                                {selectedStudent.contact && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Contact: {selectedStudent.contact}</div>}
                                {selectedStudent.department && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Dept: {selectedStudent.department} {selectedStudent.program ? `(${selectedStudent.program})` : ''}</div>}
                                {selectedStudent.batch && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Batch: {selectedStudent.batch}</div>}
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered {new Date(selectedStudent.createdAt).toLocaleDateString()}</div>
                            </div>

                            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Academic Snapshot</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Overall Average</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                                        {getAvg(selectedStudent._id) !== null ? `${getAvg(selectedStudent._id)}%` : '—'}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Exams Taken</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                                        {examsForStudent(selectedStudent._id)}
                                    </div>
                                </div>
                            </div>

                            {studentStats[selectedStudent._id]?.exams?.length > 0 && (
                                <>
                                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Recent Exams</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {studentStats[selectedStudent._id].exams.slice(0, 5).map(res => (
                                            <div key={res._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }} className="truncate">{res.exam?.title || 'Deleted Exam'}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{new Date(res.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <ScorePill score={res.score} total={res.totalQuestions} />
                                            </div>
                                        ))}
                                    </div>
                                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate(`/admin/gradebook?student=${selectedStudent.studentId}`)}>View Full History <ChevronRight size={14} /></button>
                                </>
                            )}

                            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand-primary-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aiAnalysis ? 16 : 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)' }}>✨ AI Performance Analysis</div>
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={handleGenerateInsight}
                                        disabled={isAnalyzing || examsForStudent(selectedStudent._id) === 0}
                                        title={examsForStudent(selectedStudent._id) === 0 ? "Student must complete at least one exam." : ""}
                                    >
                                        {isAnalyzing ? <Loader2 size={14} className="spin" /> : "Analyze"}
                                    </button>
                                </div>
                                {aiAnalysis && (
                                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                        <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.5 }}>
                                            {aiAnalysis.summary}
                                        </p>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <span style={{ fontSize: 11, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 12 }}>Avg: {aiAnalysis.averagePerformance}</span>
                                            <span style={{ fontSize: 11, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 12 }}>Trend: {aiAnalysis.performanceTrend}</span>
                                        </div>
                                        {aiAnalysis.strengths?.length > 0 && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>Strengths</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{aiAnalysis.strengths.join(', ')}</div>
                                            </div>
                                        )}
                                        {aiAnalysis.weakAreas?.length > 0 && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>Weak Areas</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{aiAnalysis.weakAreas.join(', ')}</div>
                                            </div>
                                        )}
                                        {aiAnalysis.observations?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Observations</div>
                                                <ul style={{ margin: 0, paddingLeft: 16, marginTop: 4 }}>
                                                    {aiAnalysis.observations.map((obs, idx) => (
                                                        <li key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{obs}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                                <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleteTarget(selectedStudent)}>
                                    <Trash2 size={16} /> Remove Student
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Student Modal */}
            <Modal
                open={showAdd}
                onClose={() => { setShowAdd(false); setFormErrors({}) }}
                title="Register New Student"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                            {creating ? 'Registering...' : 'Register Student'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleCreate}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Student ID *</label>
                            <input className="form-input" placeholder="e.g. STU-001" autoFocus value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} />
                            {formErrors.studentId && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.studentId}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input className="form-input" placeholder="e.g. John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            {formErrors.name && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.name}</span>}
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email Address *</label>
                            <input className="form-input" type="email" placeholder="student@zeroleak.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            {formErrors.email && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.email}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 80 }} />
                                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>
                                    {showPass ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {formErrors.password && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.password}</span>}
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <input className="form-input" placeholder="e.g. Computer Science" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Program</label>
                            <input className="form-input" placeholder="e.g. B.Tech" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Batch</label>
                            <input className="form-input" placeholder="e.g. 2024" value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contact</label>
                            <input className="form-input" placeholder="Phone Number" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date of Birth</label>
                            <input className="form-input" type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select className="form-input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address</label>
                        <input className="form-input" placeholder="Full Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Remove Student"
                message={`Are you sure you want to remove ${deleteTarget?.name} (${deleteTarget?.studentId})? Their exam history will be preserved but they will no longer be able to log in.`}
                confirmLabel="Remove Student"
                danger
                loading={deleting}
            />
            <Modal open={previewModal.isOpen} onClose={() => setPreviewModal({ ...previewModal, isOpen: false })} title={previewModal.title} size="full">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{
                        background: 'var(--bg-body)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        maxHeight: '400px',
                        overflow: 'auto',
                    }}>
                        <table className="table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {previewModal.headers?.map((h, i) => (
                                        <th key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewModal.rows?.length > 0 ? previewModal.rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => (
                                            <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>{cell}</td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={previewModal.headers?.length || 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No data</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                        <button className="btn btn-ghost" onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}>Cancel</button>
                        <button className="btn btn-primary flex items-center gap-2" onClick={() => handleDownload(previewModal.content, previewModal.filename)}>
                            <Download size={16} /> Download CSV
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!importPreview}
                onClose={() => setImportPreview(null)}
                title="Preview Students Import"
                size="full"
                footer={
                    <>
                        <button className="btn btn-ghost" onClick={() => setImportPreview(null)}>Cancel</button>
                        <button className="btn btn-primary flex items-center gap-2" onClick={confirmImport} disabled={isImporting}>
                            {isImporting ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                            {isImporting ? 'Importing...' : 'Confirm Import'}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-subtle)', maxHeight: '400px', overflow: 'auto' }}>
                        <table className="table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {importPreview && importPreview.length > 0 && Object.keys(importPreview[0]).map((h, i) => (
                                        <th key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-surface)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {importPreview?.map((row, i) => (
                                    <tr key={i}>
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>{val}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </AdminLayout>
    )
}
