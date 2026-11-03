import axios from 'axios';

const ROLE_CONFIG = {
    admin: {
        tokenKey: 'adminToken',
        dataKey: 'adminData',
        logoutEndpoint: '/api/admin/logout',
        redirectPath: '/portal',
    },
    professor: {
        tokenKey: 'profToken',
        dataKey: 'profData',
        logoutEndpoint: '/api/professor/logout',
        redirectPath: '/portal',
    },
    student: {
        tokenKey: 'studentToken',
        dataKey: 'studentData',
        logoutEndpoint: '/api/students/logout',
        redirectPath: '/portal',
    },
    auditor: {
        tokenKey: 'auditorToken',
        dataKey: 'auditorData',
        logoutEndpoint: '/api/auditor/logout',
        redirectPath: '/portal',
    },
    support: {
        tokenKey: 'supportToken',
        dataKey: 'supportData',
        logoutEndpoint: '/api/support/logout',
        redirectPath: '/support/login',
    },
};

/**
 * Terminate the user's active session both on the server (invalidating token,
 * setting isLoggedIn=false, and bumping sessionVersion in MongoDB) and on the client
 * (clearing localStorage credentials).
 *
 * @param {'admin' | 'professor' | 'student' | 'auditor' | 'support'} role
 * @param {Function} [navigate] - React Router navigate function
 */
export async function performLogout(role, navigate) {
    const config = ROLE_CONFIG[role];

    if (config) {
        const token = localStorage.getItem(config.tokenKey);
        if (token) {
            try {
                await axios.post(config.logoutEndpoint, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (_) {
                // Ignore network errors or expired token errors to ensure clean client-side exit
            }
        }

        localStorage.removeItem(config.tokenKey);
        if (config.dataKey) localStorage.removeItem(config.dataKey);

        if (navigate) {
            navigate(config.redirectPath);
        } else {
            window.location.href = config.redirectPath;
        }
    } else {
        // Fallback: clear all known tokens
        const allRoles = ['admin', 'prof', 'student', 'auditor', 'support'];
        const promises = [];
        
        allRoles.forEach(r => {
            const token = localStorage.getItem(`${r}Token`);
            if (token) {
                const endpoint = r === 'student' ? '/api/students/logout' : `/api/${r}/logout`;
                promises.push(axios.post(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {}));
            }
            localStorage.removeItem(`${r}Token`);
            localStorage.removeItem(`${r}Data`);
        });

        await Promise.allSettled(promises);

        if (navigate) navigate('/portal');
        else window.location.href = '/portal';
    }
}
