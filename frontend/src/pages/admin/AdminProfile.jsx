import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const AdminProfile = () => {
    const [formData, setFormData] = useState({ email: '', password: '' })
    const [message, setMessage] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const adminDataString = localStorage.getItem('adminData')
        if(!adminDataString){
            navigate('/admin/login')
        } else {
            const adminData = JSON.parse(adminDataString)
            setFormData({
                email: adminData.email || '',
                password: ''
            })
        }
    }, [navigate])

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value})

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const token = localStorage.getItem('adminToken')
            const payload = { email: formData.email }
            if (formData.password) payload.password = formData.password

            const response = await axios.put('/api/admin/profile', payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            localStorage.setItem('adminData', JSON.stringify(response.data.admin))
            setMessage('Profile updated successfully')
            setTimeout(() => {
                navigate('/admin/dashboard')
            }, 1500)
        } catch (error) {
            setMessage('Error updating profile')
        }
    }

    return (
    <div className="glass-container" style={{ maxWidth: '500px', marginTop: '3rem' }}>
      <h2 className="glass-title" style={{ color: 'var(--warning)' }}>Edit Profile</h2>
      {message && <p style={{ color: 'white', textAlign: 'center' }}>{message}</p>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="glass-input" required />
        <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="New Password (optional)" className="glass-input" />
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" className="glass-button" style={{ background: 'var(--warning)', flex: 1, color: 'black' }}>Save</button>
          <button type="button" className="glass-button" style={{ background: 'var(--danger)', flex: 1 }} onClick={() => navigate('/admin/dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

export default AdminProfile