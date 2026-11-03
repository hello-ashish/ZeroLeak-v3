import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const AuditorProfile = () => {
    const [formData, setFormData] = useState({ name: '', password: '', newPassword: '' })
    const [message, setMessage] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const token = localStorage.getItem('auditorToken')
        if (!token) {
            navigate('/auditor/login')
        }
    }, [navigate])

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value})

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const token = localStorage.getItem('auditorToken')
            const payload = {}
            if (formData.name) payload.name = formData.name
            if (formData.password && formData.newPassword) {
                payload.password = formData.password
                payload.newPassword = formData.newPassword
            }

            await axios.put('/api/auditor/profile', payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            setMessage('Profile updated successfully')
            setTimeout(() => {
                navigate('/auditor')
            }, 1500)
        } catch (error) {
            setMessage(error.response?.data?.message || 'Error updating profile')
        }
    }

    return (
    <div className="glass-container" style={{ maxWidth: '500px', margin: '3rem auto' }}>
      <h2 className="glass-title" style={{ color: 'var(--warning)' }}>Edit Profile</h2>
      {message && <p style={{ color: 'white', textAlign: 'center' }}>{message}</p>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="New Name (optional)" className="glass-input" />
        <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Current Password (required for password change)" className="glass-input" />
        <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} placeholder="New Password" className="glass-input" />
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" className="glass-button" style={{ background: 'var(--warning)', flex: 1, color: 'black' }}>Save</button>
          <button type="button" className="glass-button" style={{ background: 'var(--danger)', flex: 1 }} onClick={() => navigate('/auditor')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

export default AuditorProfile
