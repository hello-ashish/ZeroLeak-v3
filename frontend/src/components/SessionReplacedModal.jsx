import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Modal } from './Modal.jsx';
import { AlertTriangle } from 'lucide-react';

export const SessionReplacedModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                const code = error.response?.data?.code;
                if (error.response?.status === 401 && (code === 'SESSION_REPLACED' || code === 'SESSION_TERMINATED')) {
                    if (code === 'SESSION_REPLACED') {
                        setMessage('Your account has been accessed from another device or browser. To protect your security, this session has been automatically logged out.');
                    } else {
                        setMessage('Your session has ended or you have been logged out. Please sign in again to continue.');
                    }
                    setIsOpen(true);
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const handleLogout = () => {
        // Clear all possible tokens
        ['admin', 'prof', 'student', 'auditor', 'support'].forEach(r => {
            localStorage.removeItem(`${r}Token`);
            localStorage.removeItem(`${r}Data`);
        });
        
        setIsOpen(false);
        navigate('/portal');
    };

    return (
        <Modal 
            open={isOpen} 
            onClose={() => {}} // Force them to click the button
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                    <AlertTriangle size={20} />
                    Session Terminated
                </div>
            }
            footer={
                <button className="btn btn-primary w-full" onClick={handleLogout}>
                    Return to Login
                </button>
            }
        >
            <div style={{ padding: '8px 0' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {message}
                </p>
            </div>
        </Modal>
    );
};
