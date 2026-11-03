import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';

const ZMailContext = createContext(null);

function isTokenValid(token) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            return false;
        }
        return true;
    } catch {
        return Boolean(token);
    }
}

function getAuthToken(locationObj = window.location) {
    const params = new URLSearchParams(locationObj.search);
    const role = params.get('role');

    if (role === 'support') return localStorage.getItem('supportToken');
    if (role === 'admin') return localStorage.getItem('adminToken');
    if (role === 'student') return localStorage.getItem('studentToken');
    if (role === 'professor' || role === 'prof') return localStorage.getItem('profToken');
    if (role === 'auditor') return localStorage.getItem('auditorToken');

    const path = locationObj.pathname;
    if (path.startsWith('/support')) return localStorage.getItem('supportToken');
    if (path.startsWith('/admin')) return localStorage.getItem('adminToken');
    if (path.startsWith('/student')) return localStorage.getItem('studentToken');
    if (path.startsWith('/professor') || path.startsWith('/prof')) return localStorage.getItem('profToken');
    if (path.startsWith('/auditor')) return localStorage.getItem('auditorToken');

    // M-6 Fix: Verify candidate tokens are unexpired rather than returning first stale token found
    const candidateKeys = ['adminToken', 'profToken', 'studentToken', 'auditorToken', 'supportToken'];
    for (const key of candidateKeys) {
        const token = localStorage.getItem(key);
        if (token && isTokenValid(token)) {
            return token;
        }
    }

    return null;
}

function getAuthHeader() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const BACKEND_URL = import.meta.env.DEV ? "" : "https://zeroleak-v2.onrender.com";
const API = `${BACKEND_URL}/api/zmail`;

export function ZMailProvider({ children }) {
    const location = useLocation();
    const token = getAuthToken(location);

    const [account, setAccount] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [draftCount, setDraftCount] = useState(0);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    const toastCallbackRef = useRef(null);

    // Fetch account and counts
    const fetchCountsReqRef = useRef(0);
    const fetchCounts = useCallback(async () => {
        const reqId = ++fetchCountsReqRef.current;
        const headers = getAuthHeader();
        if (!headers.Authorization) return;
        try {
            const { data } = await axios.get(`${API}/counts`, { headers });
            if (reqId === fetchCountsReqRef.current && data.success) {
                setUnreadCount(data.unread || 0);
                setDraftCount(data.drafts || 0);
            }
        } catch { /* non-fatal */ }
    }, []);

    const fetchAccount = useCallback(async () => {
        const headers = getAuthHeader();
        if (!headers.Authorization) return;
        try {
            const { data } = await axios.get(`${API}/account`, { headers });
            if (data.success) setAccount(data.account);
        } catch (e) {
            console.error('[ZMail] fetchAccount failed:', e);
        }
    }, []);

    // Socket.IO connection
    useEffect(() => {
        if (!token) return;

        // L-6 Fix: BACKEND_URL is already defined at module scope (line 51) — use it directly
        const socket = socketIO(`${BACKEND_URL}/zmail`, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 10,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            // Reconcile on reconnect
            fetchCounts();
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('connect_error', (err) => {
            console.error('[ZMail Socket] Connect Error:', err.message, err);
        });

        socket.on('zmail:unread-count', ({ count }) => {
            setUnreadCount(count || 0);
        });

        socket.on('zmail:new-message', (notification) => {
            setUnreadCount(prev => prev + 1);
            // Trigger toast if callback registered
            if (toastCallbackRef.current) {
                toastCallbackRef.current(notification);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [token, fetchCounts]);

    // Bootstrap
    useEffect(() => {
        if (!token) {
            setAccount(null);
            setUnreadCount(0);
            return;
        }
        fetchAccount();
        fetchCounts();
        const interval = setInterval(fetchCounts, 60000);
        return () => clearInterval(interval);
    }, [token, fetchAccount, fetchCounts]);

    const registerToastCallback = useCallback((cb) => {
        toastCallbackRef.current = cb;
    }, []);

    const refreshCounts = fetchCounts;

    return (
        <ZMailContext.Provider value={{
            account,
            unreadCount,
            setUnreadCount,
            draftCount,
            connected,
            fetchCounts,
            fetchAccount,
            refreshCounts,
            registerToastCallback,
            getAuthHeader,
        }}>
            {children}
        </ZMailContext.Provider>
    );
}

export function useZMail() {
    const ctx = useContext(ZMailContext);
    if (!ctx) throw new Error('useZMail must be used within ZMailProvider');
    return ctx;
}

// ─── Folder API helpers ───────────────────────────────────────────────────────

export async function fetchFolder(folder, page = 1, limit = 25) {
    const headers = getAuthHeader();
    const folderMap = {
        inbox: 'inbox', sent: 'sent', drafts: 'drafts',
        starred: 'starred', important: 'important',
        archive: 'archive', trash: 'trash', all: 'all',
    };
    const endpoint = folderMap[folder] || 'inbox';
    const { data } = await axios.get(`${API}/${endpoint}`, {
        headers,
        params: { page, limit },
    });
    return data;
}

export async function fetchMessage(messageId) {
    const headers = getAuthHeader();
    const { data } = await axios.get(`${API}/messages/${messageId}`, { headers });
    return data;
}

export async function fetchThread(threadId) {
    const headers = getAuthHeader();
    const { data } = await axios.get(`${API}/threads/${threadId}`, { headers });
    return data;
}

export async function sendMessage(payload) {
    const headers = getAuthHeader();
    const { data } = await axios.post(`${API}/messages`, payload, { headers });
    return data;
}

export async function sendReply(messageId, payload) {
    const headers = getAuthHeader();
    const { data } = await axios.post(`${API}/messages/${messageId}/reply`, payload, { headers });
    return data;
}

export async function sendForward(messageId, payload) {
    const headers = getAuthHeader();
    const { data } = await axios.post(`${API}/messages/${messageId}/forward`, payload, { headers });
    return data;
}

export async function patchMessage(messageId, action) {
    const headers = getAuthHeader();
    const { data } = await axios.patch(`${API}/messages/${messageId}/${action}`, {}, { headers });
    return data;
}

export async function patchMessageWithBody(messageId, action, body) {
    const headers = getAuthHeader();
    const { data } = await axios.patch(`${API}/messages/${messageId}/${action}`, body, { headers });
    return data;
}

export async function deleteMessage(messageId) {
    const headers = getAuthHeader();
    const { data } = await axios.delete(`${API}/messages/${messageId}`, { headers });
    return data;
}

export async function bulkAction(messageIds, action) {
    const headers = getAuthHeader();
    const { data } = await axios.patch(`${API}/messages/bulk/action`, { messageIds, action }, { headers });
    return data;
}

export async function emptyTrash() {
    const headers = getAuthHeader();
    const { data } = await axios.delete(`${API}/trash/empty`, { headers });
    return data;
}

export async function searchMail(query, page = 1) {
    const headers = getAuthHeader();
    const { data } = await axios.get(`${API}/search`, {
        headers,
        params: { q: query, page },
    });
    return data;
}

export async function searchUsers(q) {
    const headers = getAuthHeader();
    const { data } = await axios.get(`${API}/users/search`, {
        headers,
        params: { q },
    });
    return data;
}

export async function createDraft(payload) {
    const headers = getAuthHeader();
    const { data } = await axios.post(`${API}/drafts`, payload, { headers });
    return data;
}

export async function updateDraft(draftId, payload) {
    const headers = getAuthHeader();
    const { data } = await axios.patch(`${API}/drafts/${draftId}`, payload, { headers });
    return data;
}

export async function sendDraft(draftId) {
    const headers = getAuthHeader();
    const { data } = await axios.post(`${API}/drafts/${draftId}/send`, {}, { headers });
    return data;
}

export async function deleteDraft(draftId) {
    const headers = getAuthHeader();
    const { data } = await axios.delete(`${API}/drafts/${draftId}`, { headers });
    return data;
}

export async function uploadAttachment(file) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary credentials missing in .env");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

    return {
        originalName: file.name,
        storageName: file.name,
        storageKey: data.secure_url,
        mimeType: file.type || data.format,
        sizeBytes: data.bytes,
        uploadedAt: new Date()
    };
}
