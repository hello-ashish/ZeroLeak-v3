import React, { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

export const Modal = ({ open, onClose, title, children, footer, size = '', }) => {
    const ref = useRef(null)

    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        if (!open) return
        const prev = document.activeElement
        ref.current?.focus()

        const handler = (e) => {
            if (e.key === 'Escape') onCloseRef.current?.()
        }
        document.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
            prev?.focus()
        }
    }, [open])

    if (!open) return null

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className={`modal ${size ? `modal-${size}` : ''}`} ref={ref} tabIndex={-1}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
                    <button
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? <><Loader2 size={16} className="spin" style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }}/> Processing...</> : confirmLabel}
                    </button>
                </>
            }
        >
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
        </Modal>
    )
}
