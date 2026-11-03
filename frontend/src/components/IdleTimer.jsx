import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const IdleTimer = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let timeoutId;

        const handleIdle = async () => {
            try {
                // Send backend logout requests for all active tokens
                const logoutPromises = [];
                
                if (localStorage.getItem('studentToken')) {
                    logoutPromises.push(axios.post('/api/students/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('studentToken')}` } }).catch(() => {}));
                }
                if (localStorage.getItem('profToken')) {
                    logoutPromises.push(axios.post('/api/professor/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('profToken')}` } }).catch(() => {}));
                }
                if (localStorage.getItem('adminToken')) {
                    logoutPromises.push(axios.post('/api/admin/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }).catch(() => {}));
                }
                if (localStorage.getItem('auditorToken')) {
                    logoutPromises.push(axios.post('/api/auditor/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('auditorToken')}` } }).catch(() => {}));
                }
                if (localStorage.getItem('supportToken')) {
                    logoutPromises.push(axios.post('/api/support/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('supportToken')}` } }).catch(() => {}));
                }

                await Promise.all(logoutPromises);

                // Clear all frontend storage
                ['student', 'prof', 'admin', 'auditor', 'support'].forEach(role => {
                    localStorage.removeItem(`${role}Token`);
                    localStorage.removeItem(`${role}Data`);
                });

                // Navigate based on current path if possible, or fallback to home
                const path = location.pathname;
                if (path.startsWith('/student')) navigate('/student/login');
                else if (path.startsWith('/professor')) navigate('/professor/login');
                else if (path.startsWith('/admin')) navigate('/admin/login');
                else if (path.startsWith('/auditor')) navigate('/auditor/login');
                else if (path.startsWith('/support')) navigate('/support/login');
                else navigate('/portal');

            } catch (err) {
                console.error("Logout error", err);
            }
        };

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(handleIdle, IDLE_TIMEOUT);
        };

        if (!location.pathname.includes('/login') && location.pathname !== '/') {
            window.addEventListener('mousemove', resetTimer);
            window.addEventListener('keydown', resetTimer);
            window.addEventListener('scroll', resetTimer);
            window.addEventListener('click', resetTimer);
            resetTimer();
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('scroll', resetTimer);
            window.removeEventListener('click', resetTimer);
        };
    }, [navigate, location.pathname]);

    return null;
};
