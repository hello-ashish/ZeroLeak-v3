import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Ensure the token and endpoint are correct based on the current user context
export const useNotifications = (role) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const getAuthHeader = () => {
        let token = null;
        if (role === 'admin') token = localStorage.getItem('adminToken');
        else if (role === 'student') token = localStorage.getItem('studentToken');
        else if (role === 'professor') token = localStorage.getItem('profToken');
        else if (role === 'auditor') token = localStorage.getItem('auditorToken');

        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchNotifications = useCallback(async () => {
        try {
            const headers = getAuthHeader();
            if (!headers.Authorization) return;

            // Use the specific base path depending on the role
            let basePath = '';
            if (role === 'admin') basePath = '/api/admin';
            else if (role === 'student') basePath = '/api/students';
            else if (role === 'professor') basePath = '/api/professor';
            else if (role === 'auditor') basePath = '/api/auditor';

            const response = await axios.get(`${basePath}/notifications`, { headers });
            
            if (response.data) {
                setNotifications(response.data.notifications || []);
                setUnreadCount(response.data.unreadCount || 0);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }, [role]);

    const markAsRead = async (id) => {
        try {
            const headers = getAuthHeader();
            if (!headers.Authorization) return;

            let basePath = '';
            if (role === 'admin') basePath = '/api/admin';
            else if (role === 'student') basePath = '/api/students';
            else if (role === 'professor') basePath = '/api/professor';
            else if (role === 'auditor') basePath = '/api/auditor';

            await axios.patch(`${basePath}/notifications/${id}/read`, {}, { headers });
            
            // Optimistically update UI
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const headers = getAuthHeader();
            if (!headers.Authorization) return;

            let basePath = '';
            if (role === 'admin') basePath = '/api/admin';
            else if (role === 'student') basePath = '/api/students';
            else if (role === 'professor') basePath = '/api/professor';
            else if (role === 'auditor') basePath = '/api/auditor';

            await axios.patch(`${basePath}/notifications/read-all`, {}, { headers });
            
            // Optimistically update UI
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    // Auto-fetch on mount & listen to global refresh
    useEffect(() => {
        fetchNotifications();

        const onGlobalRefresh = () => {
            fetchNotifications();
        };
        window.addEventListener('zl-global-refresh', onGlobalRefresh);
        
        // Optional: poll every minute
        const intervalId = setInterval(fetchNotifications, 60000);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('zl-global-refresh', onGlobalRefresh);
        };
    }, [fetchNotifications]);

    return { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead };
};
