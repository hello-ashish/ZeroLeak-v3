import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AdminLayout } from './AdminLayout.jsx'
import { Modal, ConfirmDialog } from '../../components/Modal.jsx'
import { SkeletonTable, EmptyState } from '../../components/SkeletonLoader.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { useToast } from '../../components/Toast.jsx'
import { Search, Users, Trash2, AlertTriangle, BookOpen, Clock, Activity, X, Mail, Upload, Download, CheckSquare, Loader2 } from 'lucide-react'
import { getCachedData } from '../../utils/apiCache.js'

const API = '/api'
const getToken = () => localStorage.getItem('adminToken')

export default function AdminAuditorsPage() {
    const cachedAud = getCachedData(`${API}/admin/auditors`)
    const [auditors, setAuditors] = useState(() => cachedAud?.auditors || [])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(() => !cachedAud)
    const [search, setSearch] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [creating, setCreating] = useState(false)
    const [selectedAud, setSelectedProf] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [isSelectMode, setIsSelectMode] = useState(false)
    const [filterStatus, setFilterStatus] = useState('all')
    const [sortConfig, setSortConfig] = useState('default')
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 10
    const [isImporting, setIsImporting] = useState(false)
    const [form, setForm] = useState({ auditorId: '', name: '', email: '', contact: '', address: '', password: '' })
    const [formErrors, setFormErrors] = useState({})
    const [showPass, setShowPass] = useState(false)
    const [previewModal, setPreviewModal] = useState({ isOpen: false, title: '', content: '', headers: [], rows: [], filename: '' })
    const [importPreview, setImportPreview] = useState(null)
    const navigate = useNavigate()
    const toast = useToast()

    const fetchData = async () => {
        const token = getToken()
        if (!token) { navigate('/admin/login'); return }
        try {
            if (!getCachedData(`${API}/admin/auditors`)) setLoading(true)
            const audRes = await axios.get(`${API}/admin/auditors`, { headers: { Authorization: `Bearer ${token}` } });
            setAuditors(audRes.data.auditors || [])
        } catch {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const filtered = useMemo(() => {
        let result = auditors;

        if (filterStatus === 'active') {
            result = result.filter(p => !p.isBlocked);
        } else if (filterStatus === 'blocked') {
            result = result.filter(p => p.isBlocked);
        }

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(p =>
                p.name?.toLowerCase().includes(s) ||
                p.auditorId?.toLowerCase().includes(s) ||
                p.email?.toLowerCase().includes(s)
            );
        }

        if (sortConfig !== 'default') {
            result = [...result].sort((a, b) => {
                switch (sortConfig) {
                    case 'name-asc': return (a.name || '').localeCompare(b.name || '');
                    case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                    case 'auditorId-asc': return (a.id || '').localeCompare(b.id || '');
                    case 'auditorId-desc': return (b.id || '').localeCompare(a.id || '');
                    case 'date-asc': return new Date(a.createdAt) - new Date(b.createdAt);
                    case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
                    default: return 0;
                }
            });
        }
        return result;
    }, [auditors, search, filterStatus, sortConfig])

    useEffect(() => {
        setPage(1)
    }, [search, filterStatus, sortConfig])

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
    const currentPage = Math.min(page, totalPages)
    const paginated = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filtered.slice(start, start + ITEMS_PER_PAGE)
    }, [filtered, currentPage])

    const activeCreatorsCount = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return auditors.filter(p => p.lastActiveAt && new Date(p.lastActiveAt) > sevenDaysAgo).length;
    }, [auditors]);

    const validate = () => {
        const e = {}
        if (!form.auditorId.trim()) e.id = 'Auditor ID is required'
        if (!form.name.trim()) e.name = 'Name is required'
        if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required'
        if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
        return e
    }

    const handleOpenAdd = () => {
        let nextNum = 1;
        if (auditors.length > 0) {
            const nums = auditors.map(a => {
                const match = a.auditorId?.match(/AUD-(\d+)/i);
                return match ? parseInt(match[1], 10) : 0;
            });
            nextNum = Math.max(...nums, 0) + 1;
        }
        const nextId = `AUD-${nextNum.toString().padStart(3, '0')}`;
        setForm(f => ({ ...f, auditorId: nextId }));
        setShowAdd(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault()
        const errs = validate()
        if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
        setCreating(true)
        try {
            await axios.post(`${API}/admin/auditors`, form, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Auditor created successfully')
            setShowAdd(false)
            setForm({ auditorId: '', name: '', email: '', contact: '', address: '', password: '' })
            setFormErrors({})
            fetchData()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create auditor')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await axios.delete(`${API}/admin/auditors/${deleteTarget.id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            toast.success('Auditor removed')
            if (selectedAud?._id === deleteTarget._id) setSelectedProf(null)
            setDeleteTarget(null)
            fetchData()
        } catch {
            toast.error('Failed to delete auditor')
        } finally {
            setDeleting(false)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filtered.map(p => p._id))
        }
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} auditors?`)) return;
        try {
            await axios.post(`${API}/admin/auditors/bulk-delete`, { ids: selectedIds }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success('Auditors deleted successfully');
            setSelectedIds([]);
            fetchData();
        } catch {
            toast.error('Failed to delete auditors');
        }
    }
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

    const handleTemplateDownload = () => {
        setPreviewModal({
            isOpen: true,
            title: 'Download Template',
            content: 'Auditor ID,Name,Email,Contact,Address',
            headers: ['Auditor ID', 'Name', 'Email', 'Contact', 'Address'],
            filename: 'auditor_template.csv'
        });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        import('papaparse').then((Papa) => {
            Papa.default.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        toast.error('Error parsing CSV file');
                        setIsImporting(false);
                        return;
                    }
                    setImportPreview(results.data);
                    setIsImporting(false);
                }
            });
        });
        e.target.value = null;
    };

    const confirmImport = async () => {
        setIsImporting(true);
        try {
            const res = await axios.post(`${API}/admin/auditors/bulk-import`, {
                auditors: importPreview
            }, { headers: { Authorization: `Bearer ${getToken()}` } });
            toast.success(`Imported ${res.data.imported} auditors (${res.data.skipped} skipped)`);
            fetchData();
            setImportPreview(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to import auditors');
        } finally {
            setIsImporting(false);
        }
    };

    const handleToggleBlock = async (prof) => {
        try {
            const res = await axios.post(`${API}/admin/auditors/${prof._id}/block`, {}, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            toast.success(res.data.message);
            setSelectedProf(prev => ({ ...prev, isBlocked: res.data.isBlocked }));
            fetchData();
        } catch {
            toast.error('Failed to update block status');
        }
    };

    const handleBulkBlock = async (block) => {
        try {
            await axios.post(`${API}/admin/auditors/bulk-block`, { ids: selectedIds, block }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            toast.success(`Auditors ${block ? 'blocked' : 'unblocked'} successfully`);
            setSelectedIds([]);
            fetchData();
        } catch {
            toast.error('Failed to update auditors');
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title">Faculty Overview</h1>
                        <p className="page-subtitle">Manage institutional auditors and content contributors</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleTemplateDownload}>
                            <Download size={16} /> Template
                        </button>
                        <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isImporting ? (
                                <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Upload size={16} />
                            )}
                            {isImporting ? 'Importing...' : 'Import'}
                            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isImporting} />
                        </label>
                        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => {
                            const headers = ['Name', 'Auditor ID', 'Email', 'Contact', 'Address', 'Created At', 'Updated At'];
                            const rows = auditors.map(p => [p.name || '', p.auditorId || '', p.email || '', p.contact || '', p.address || '', p.createdAt ? new Date(p.createdAt).toLocaleString() : '', p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '']);
                            const csv = [
                                headers.join(','),
                                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                            ].join('\n');
                            setPreviewModal({
                                isOpen: true,
                                title: 'Auditors Export Preview',
                                content: csv,
                                headers: headers,
                                rows: rows,
                                filename: 'auditors.csv'
                            });
                        }}>
                            <Download size={16} /> Export
                        </button>
                        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Auditor</button>
                    </div>
                </div>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Total Auditors</span>
                        <span className="kpi-icon" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--brand-secondary)' }}><Users size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : auditors.length}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Active Auditors</span>
                        <span className="kpi-icon" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}><BookOpen size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : auditors.filter(a => !a.isBlocked).length}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Blocked Auditors</span>
                        <span className="kpi-icon" style={{ background: 'var(--danger-subtle)', color: 'var(--danger)' }}><AlertTriangle size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : auditors.filter(a => a.isBlocked).length}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card-header">
                        <span className="kpi-label">Recent Active (7d)</span>
                        <span className="kpi-icon" style={{ background: 'var(--info-subtle)', color: 'var(--info)' }}><Activity size={20} /></span>
                    </div>
                    <div className="kpi-value">{loading ? '—' : activeCreatorsCount}</div>
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
                            <option value="auditorId-asc">Auditor ID (A-Z)</option>
                            <option value="auditorId-desc">Auditor ID (Z-A)</option>
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
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
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>{filtered.length} faculty members</span>
                    </div>

                    {selectedIds.length > 0 && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeIn 0.2s ease' }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{selectedIds.length} selected</span>
                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleBulkBlock(false)}>Unblock</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleBulkBlock(true)}>Block</button>
                                <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete</button>
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
                                    <th>Auditor</th>
                                    <th>ID</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Batches</th>
                                    <th>Added</th>
                                </tr>
                            </thead>
                            {loading && auditors.length === 0 ? (
                                <SkeletonTable rows={5} />
                            ) : (
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={isSelectMode ? 7 : 6}>
                                            <EmptyState
                                                icon={<Users size={32} color="var(--text-tertiary)" />}
                                                title="No auditors found"
                                                description={search ? 'No auditors match that search.' : 'Add your first faculty member to get started.'}
                                                action={!search && <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Auditor</button>}
                                            />
                                        </td></tr>
                                    ) : paginated.map(prof => {
                                        const isSelected = selectedAud?._id === prof._id
                                        return (
                                            <tr key={prof._id}
                                                onClick={() => setSelectedProf(prof)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: isSelected ? 'var(--bg-active)' : 'transparent',
                                                    borderLeft: isSelected ? '2px solid var(--brand-secondary)' : '2px solid transparent'
                                                }}
                                            >
                                                {isSelectMode && (
                                                    <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 16 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(prof._id)}
                                                            onChange={() => toggleSelect(prof._id)}
                                                        />
                                                    </td>
                                                )}
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <span className="avatar avatar-sm" style={{ background: prof.isBlocked ? 'var(--danger-subtle)' : 'rgba(124,58,237,0.12)', color: prof.isBlocked ? 'var(--danger)' : 'var(--brand-secondary)' }}>
                                                            {prof.name?.charAt(0)?.toUpperCase()}
                                                        </span>
                                                        <span style={{ fontWeight: 600, color: prof.isBlocked ? 'var(--danger)' : 'var(--text-primary)', textDecoration: prof.isBlocked ? 'line-through' : 'none' }}>{prof.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{prof.id}</td>
                                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{prof.email}</td>
                                                <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{prof.contact || '—'}</td>
                                                <td>
                                                    <span className="badge" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                                                        {prof.submittedBatches || 0}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                    {new Date(prof.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                            itemLabel="auditors"
                        />
                    </div>
                </div>

                {/* Right Side Drawer / Panel */}
                {selectedAud && (
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
                                <div className="avatar" style={{ background: selectedAud.isBlocked ? 'var(--danger-subtle)' : 'var(--brand-secondary)', color: selectedAud.isBlocked ? 'var(--danger)' : 'var(--text-inverse)', width: 40, height: 40, fontSize: 16 }}>
                                    {selectedAud.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: selectedAud.isBlocked ? 'var(--danger)' : 'var(--text-primary)', textDecoration: selectedAud.isBlocked ? 'line-through' : 'none' }}>{selectedAud.name}</h3>
                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{selectedAud.id}</p>
                                    {selectedAud.isBlocked && <span className="badge badge-danger" style={{ marginTop: 4 }}>BLOCKED</span>}
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedProf(null)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: 24, overflowY: 'auto' }}>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Contact & Profile</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    <Mail size={14} /> {selectedAud.email}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Joined {new Date(selectedAud.createdAt).toLocaleDateString()}</div>
                            </div>

                            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Contributions Snapshot</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Batches Submitted</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                                        {selectedAud.batchesSubmitted || 0}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Questions Approved</div>
                                    <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                                        {selectedAud.questionsApproved || 0}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                                <button className={`btn ${selectedAud.isBlocked ? 'btn-secondary' : 'btn-danger-subtle'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleToggleBlock(selectedAud)}>
                                    {selectedAud.isBlocked ? 'Unblock Access' : 'Block Access'}
                                </button>
                                <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeleteTarget(selectedAud)}>
                                    <Trash2 size={16} /> Remove Auditor
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Auditor Modal */}
            <Modal
                open={showAdd}
                onClose={() => { setShowAdd(false); setFormErrors({}) }}
                title="Create New Auditor"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                            {creating ? 'Creating...' : 'Create Auditor'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleCreate}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Auditor ID *</label>
                            <input className="form-input" placeholder="e.g. AUD-001" value={form.auditorId} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
                            {formErrors.id && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.id}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input className="form-input" placeholder="e.g. Alice Walker" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            {formErrors.name && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.name}</span>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input className="form-input" type="email" placeholder="auditor@zeroleak.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                        {formErrors.email && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.email}</span>}
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Contact (optional)</label>
                            <input className="form-input" placeholder="+91 98765 43210" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 60 }} />
                                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>
                                    {showPass ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {formErrors.password && <span className="form-error flex items-center gap-1"><AlertTriangle size={14} /> {formErrors.password}</span>}
                        </div>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Remove Auditor"
                message={`Are you sure you want to remove Auditor ${deleteTarget?.name} (${deleteTarget?.id})? Their submitted question batches will remain in the system.`}
                confirmLabel="Remove Auditor"
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
                title="Preview Auditors Import"
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
