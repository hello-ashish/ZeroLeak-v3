import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastId
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const toast = useMemo(() => ({
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        warning: (msg) => addToast(msg, 'warning'),
        info: (msg) => addToast(msg, 'info'),
    }), [addToast])

    const icons = {
        success: <CheckCircle2 size={18} />,
        error: <XCircle size={18} />,
        warning: <AlertTriangle size={18} />,
        info: <Info size={18} />,
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`} role="alert" aria-live="polite">
                        <span style={{ fontWeight: 700, flexShrink: 0 }}>{icons[t.type]}</span>
                        <span>{t.message}</span>
                        <button className="toast-dismiss" onClick={() => removeToast(t.id)} aria-label="Dismiss">
                            <XCircle size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}
