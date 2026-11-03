import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Eye, EyeOff, ShieldCheck, CheckCircle2, User, Mail, KeyRound, Calendar, Hash } from 'lucide-react'
import { useToast } from '../../components/Toast.jsx'

const StudentProfile = () => {
    const [formData, setFormData] = useState({ name: '', email: '', oldPassword: '', password: '', confirmPassword: '' })
    const [studentData, setStudentData] = useState({})
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const navigate = useNavigate()
    const toast = useToast()

    useEffect(() => {
        const studentDataString = localStorage.getItem('studentData')
        if (!studentDataString) {
            navigate('/student/login')
        } else {
            const parsedData = JSON.parse(studentDataString)
            setStudentData(parsedData)
            setFormData({
                name: parsedData.name || '',
                email: parsedData.email || '',
                oldPassword: '',
                password: '',
                confirmPassword: ''
            })
        }
    }, [navigate])

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const token = localStorage.getItem('studentToken')
            const payload = {
                name: formData.name,
                email: formData.email
            }

            const response = await axios.put('/api/students/profile', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            localStorage.setItem('studentData', JSON.stringify(response.data.student))
            setStudentData(response.data.student)

            setIsEditingProfile(false)
            
            toast.success('Profile updated successfully')
        } catch (error) {
            console.error(error)
            toast.error(error.response?.data?.message || 'Failed to update profile')
        }
    }

    const handlePasswordChange = async () => {
        if (!formData.oldPassword) {
            toast.error('Current password is required')
            return
        }
        if (!formData.password) {
            toast.error('New password is required')
            return
        }
        if (formData.password !== formData.confirmPassword) {
            toast.error('New passwords do not match')
            return
        }

        try {
            const token = localStorage.getItem('studentToken')
            const payload = {
                oldPassword: formData.oldPassword,
                newPassword: formData.password
            }

            await axios.put('/api/students/change-password', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            // Clear password fields on success
            setFormData(prev => ({ ...prev, oldPassword: '', password: '', confirmPassword: '' }))
            setIsChangingPassword(false)
            
            toast.success('Password changed successfully')
        } catch (error) {
            console.error(error)
            toast.error(error.response?.data?.message || 'Failed to change password')
        }
    }

    // Calculations
    const initials = (studentData.name || studentData.email || 'S').substring(0, 2).toUpperCase()

    const getCompleteness = () => {
        let filled = 0
        const fields = ['name', 'email']
        fields.forEach(f => {
            if (formData[f] && formData[f].trim() !== '') filled++
        })
        return Math.round((filled / fields.length) * 100)
    }
    const completeness = getCompleteness()

    const getPasswordStrength = (pass) => {
        if (!pass) return { score: 0, label: '', color: 'transparent' }
        let score = 0
        if (pass.length >= 8) score++
        if (pass.length >= 12) score++
        if (/[A-Z]/.test(pass)) score++
        if (/[0-9]/.test(pass)) score++
        if (/[^A-Za-z0-9]/.test(pass)) score++

        if (score <= 2) return { score, label: 'Weak', color: 'var(--danger)' }
        if (score <= 4) return { score, label: 'Fair', color: 'var(--warning)' }
        return { score, label: 'Strong', color: 'var(--success)' }
    }
    const passwordStrength = getPasswordStrength(formData.password)

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 48 }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 32 }}>
                <div className="page-header-top">
                    <div>
                        <h1 className="page-title" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
                            Edit Profile
                        </h1>
                        <p className="page-subtitle" style={{ fontSize: 14 }}>
                            Manage your personal information, contact details, and account security.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Workspace */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>

                {/* Left Column: Summary */}
                <div style={{ flex: '1 1 320px', maxWidth: '380px', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ height: 80, background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' }}></div>
                        <div style={{ padding: '0 24px 24px', textAlign: 'center', marginTop: -40 }}>
                            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--bg-card)', padding: 4, margin: '0 auto 16px', border: '1px solid var(--border-default)' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>
                                    {initials}
                                </div>
                            </div>
                            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{studentData.name || 'Student'}</h2>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>{studentData.email}</p>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--success-subtle)', color: 'var(--success)', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}></div>
                                Account Active
                            </div>
                        </div>

                        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-default)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Profile Completeness</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{completeness}%</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${completeness}%`, background: completeness === 100 ? 'var(--success)' : 'var(--brand-primary)', transition: 'width 0.3s ease' }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldCheck size={18} style={{ color: 'var(--success)' }} /> Security Status
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Email Verification</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Verified</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Password Strength</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--success)' }}>Strong</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Editor */}
                <div style={{ flex: '2 1 500px', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Personal Information */}
                    <div className="card" style={{ padding: 32 }}>
                        <div style={{ marginBottom: isEditingProfile ? 28 : 0, paddingBottom: isEditingProfile ? 20 : 0, borderBottom: isEditingProfile ? '1px solid var(--border-default)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Personal Information</h2>
                                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>Update your contact details and academic identity.</p>
                            </div>
                            {!isEditingProfile && (
                                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingProfile(true)} style={{ padding: '8px 16px', fontSize: 13 }}>
                                    Edit Information
                                </button>
                            )}
                        </div>

                        {isEditingProfile && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input" style={{ paddingLeft: 42, background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '12px 14px 12px 42px', borderRadius: 8, color: 'var(--text-primary)', width: '100%', fontSize: 14 }} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input type="email" value={formData.email} className="form-input" style={{ paddingLeft: 42, background: 'var(--bg-body)', border: '1px solid var(--border-default)', padding: '12px 14px 12px 42px', borderRadius: 8, color: 'var(--text-tertiary)', width: '100%', cursor: 'not-allowed', fontSize: 14 }} readOnly disabled />
                                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, background: 'var(--success-subtle)', color: 'var(--success)', padding: '4px 8px', borderRadius: 6, fontWeight: 600 }}>Verified</span>
                                    </div>
                                </div>

                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
                                    <button type="button" className="btn btn-primary" onClick={handleSubmit} style={{ padding: '8px 16px', fontSize: 13 }}>
                                        Save Changes
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => {
                                        setIsEditingProfile(false);
                                        setFormData(prev => ({
                                            ...prev,
                                            name: studentData.name || '',
                                            email: studentData.email || ''
                                        }))
                                    }} style={{ padding: '8px 16px', fontSize: 13 }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Security */}
                    <div className="card" style={{ padding: 32 }}>
                        <div style={{ marginBottom: isChangingPassword ? 28 : 0, paddingBottom: isChangingPassword ? 20 : 0, borderBottom: isChangingPassword ? '1px solid var(--border-default)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Account Security</h2>
                                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>Keep your account secure with a strong password.</p>
                            </div>
                            {!isChangingPassword && (
                                <button type="button" className="btn btn-secondary" onClick={() => setIsChangingPassword(true)} style={{ padding: '8px 16px', fontSize: 13 }}>
                                    Change Password
                                </button>
                            )}
                        </div>

                        {isChangingPassword && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Current Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input type="password" name="oldPassword" value={formData.oldPassword} onChange={handleChange} placeholder="Enter your current password" className="form-input" style={{ paddingLeft: 42, background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '12px 14px 12px 42px', borderRadius: 8, color: 'var(--text-primary)', width: '100%', fontSize: 14 }} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="Enter your new password" className="form-input" style={{ paddingLeft: 42, paddingRight: 48, background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '12px 14px 12px 42px', borderRadius: 8, color: 'var(--text-primary)', width: '100%', fontSize: 14 }} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}>
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {formData.password && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                            <div style={{ flex: 1, height: 4, background: 'var(--bg-body)', borderRadius: 2, marginRight: 16, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${(passwordStrength.score / 5) * 100}%`, background: passwordStrength.color, transition: 'all 0.3s ease' }}></div>
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: passwordStrength.color }}>{passwordStrength.label}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <KeyRound size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm your new password" className="form-input" style={{ paddingLeft: 42, paddingRight: 48, background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '12px 14px 12px 42px', borderRadius: 8, color: 'var(--text-primary)', width: '100%', fontSize: 14 }} />
                                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}>
                                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
                                    <button type="button" className="btn btn-primary" onClick={handlePasswordChange} style={{ padding: '8px 16px', fontSize: 13 }}>
                                        Change Password
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => { setIsChangingPassword(false); setFormData(prev => ({ ...prev, oldPassword: '', password: '', confirmPassword: '' })) }} style={{ padding: '8px 16px', fontSize: 13 }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Account Metadata */}
                    <div className="card" style={{ padding: 32 }}>
                        <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border-default)' }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Account Information</h2>
                            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4 }}>System metadata for your identity.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                            <div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}><Hash size={16} /> Student ID</span>
                                <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{studentData.studentId || 'STU-XXXX'}</span>
                            </div>
                            <div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}><ShieldCheck size={16} /> Role</span>
                                <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>Student</span>
                            </div>
                            <div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}><Calendar size={16} /> Member Since</span>
                                <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>{studentData.createdAt ? new Date(studentData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StudentProfile