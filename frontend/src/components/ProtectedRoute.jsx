/**
 * ProtectedRoute — H-7 Fix
 *
 * Wraps a route element and checks that the corresponding auth token is present
 * in localStorage before rendering. If not, redirects to the role's login page.
 *
 * Usage:
 *   <ProtectedRoute role="admin">
 *     <AdminDashboardPage />
 *   </ProtectedRoute>
 */

import { Navigate, useLocation, Outlet } from 'react-router-dom';

const TOKEN_KEYS = {
    admin:     'adminToken',
    professor: 'profToken',
    student:   'studentToken',
    auditor:   'auditorToken',
    support:   'supportToken',
};

const LOGIN_ROUTES = {
    admin:     '/admin/login',
    professor: '/professor/login',
    student:   '/student/login',
    auditor:   '/auditor/login',
    support:   '/support/login',
};

/**
 * @param {{ role: string, children?: React.ReactNode }} props
 */
export function ProtectedRoute({ role, children }) {
    const location = useLocation();

    if (role === 'any') {
        const hasAnyToken = Object.values(TOKEN_KEYS).some((key) => Boolean(localStorage.getItem(key)));
        if (!hasAnyToken) {
            return <Navigate to="/portal" replace state={{ from: location }} />;
        }
        return children ? children : <Outlet />;
    }

    const tokenKey = TOKEN_KEYS[role];
    const loginRoute = LOGIN_ROUTES[role] || '/portal';

    if (!tokenKey) {
        console.warn(`[ProtectedRoute] Unknown role: "${role}"`);
        return <Navigate to="/portal" replace state={{ from: location }} />;
    }

    const token = localStorage.getItem(tokenKey);

    if (!token) {
        // Preserve the attempted URL so the login page can redirect back after auth
        return <Navigate to={loginRoute} replace state={{ from: location }} />;
    }

    return children ? children : <Outlet />;
}
