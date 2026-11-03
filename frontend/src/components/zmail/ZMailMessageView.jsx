/**
 * ZMailMessageView — Full single-message viewer with reply/forward
 */
import React, { useState } from 'react';
import {
    Reply, CornerUpRight, Forward, Star, AlertCircle, Archive,
    Trash2, RotateCcw, Paperclip, Download, ChevronDown, ChevronUp, X, Loader2, Eye
} from 'lucide-react';
import { ZMailCompose } from './ZMailCompose.jsx';
import {
    patchMessage, patchMessageWithBody,
} from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';

function getAuthToken() {
    return (
        localStorage.getItem('adminToken') ||
        localStorage.getItem('profToken') ||
        localStorage.getItem('studentToken') ||
        localStorage.getItem('auditorToken') ||
        localStorage.getItem('supportToken') ||
        null
    );
}

function getAuthHeader() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export function ZMailMessageView({ message, onBack, onRefresh, onUpdate, hideHeaderSubject = false, hideBackButton = false }) {
    const [replyOpen, setReplyOpen] = useState(false);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [replyAll, setReplyAll] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const toast = useToast();

    if (!message) return null;

    const { entry = {}, attachments = [], to = [], cc = [], senderAddress, senderName, subject, body, sentAt } = message;

    const handleStar = async (e) => {
        if (e) e.preventDefault();
        try {
            await patchMessageWithBody(message._id, 'star', { starred: !entry.isStarred });
            if (onUpdate) onUpdate({ isStarred: !entry.isStarred });
            else if (onRefresh) onRefresh();
        } catch { toast.error('Failed to star message'); }
    };

    const handleImportant = async (e) => {
        if (e) e.preventDefault();
        try {
            await patchMessageWithBody(message._id, 'important', { important: !entry.isImportant });
            if (onUpdate) onUpdate({ isImportant: !entry.isImportant });
            else if (onRefresh) onRefresh();
        } catch { toast.error('Failed to mark important'); }
    };

    const handleArchive = async () => {
        try {
            await patchMessage(message._id, 'archive');
            toast.success('Message archived');
            onRefresh && onRefresh();
            onBack && onBack();
        } catch { toast.error('Failed to archive message'); }
    };

    const handleTrash = async () => {
        try {
            await patchMessage(message._id, 'trash');
            toast.success('Moved to trash');
            onRefresh && onRefresh();
            onBack && onBack();
        } catch { toast.error('Failed to trash message'); }
    };

    const handleRestore = async () => {
        try {
            await patchMessage(message._id, 'restore');
            toast.success('Restored from trash');
            onRefresh && onRefresh();
        } catch { toast.error('Failed to restore message'); }
    };

    const handleDownload = async (att) => {
        try {
            setDownloadingId(att._id);
            if (att.storageKey?.startsWith('http')) {
                try {
                    const response = await fetch(att.storageKey);
                    if (!response.ok) throw new Error('Cloudinary fetch failed');
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = objectUrl;
                    a.download = att.originalName;
                    document.body.appendChild(a); // Firefox requires it to be in DOM
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
                } catch (fetchErr) {
                    console.warn('[ZMail] Blob download failed, falling back to new tab', fetchErr);
                    const a = document.createElement('a');
                    a.href = att.storageKey;
                    a.target = '_blank';
                    a.download = att.originalName;
                    a.click();
                }
                return;
            }

            const headers = getAuthHeader();
            const BACKEND_URL = import.meta.env.DEV ? '' : 'https://zeroleak-v2.onrender.com';
            const url = `${BACKEND_URL}/api/zmail/messages/${message._id}/attachments/${att._id}`;
            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = att.originalName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[ZMail] Download failed', e);
        } finally {
            setDownloadingId(null);
        }
    };

    const recipientList = [
        ...to.map(r => r.address || r),
        ...cc.map(r => r.address || r),
    ].join(', ');

    return (
        <div className="zmail-message-view">
            {/* Message Header */}
            <div className="zmail-msg-header">
                {!hideHeaderSubject && (
                    <div className="zmail-msg-title-row">
                        {!hideBackButton && (
                            <button type="button" className="zmail-back-btn" onClick={onBack} aria-label="Back to list">
                                ← Back
                            </button>
                        )}
                        <h2 className="zmail-msg-subject">{subject || '(no subject)'}</h2>
                        <div className="zmail-msg-toolbar">
                            <button
                                type="button"
                                className={`zmail-tool-btn ${entry.isStarred ? 'zmail-starred' : ''}`}
                                onClick={handleStar}
                                aria-label={entry.isStarred ? 'Unstar' : 'Star'}
                                title={entry.isStarred ? 'Unstar' : 'Star'}
                            >
                                <Star size={18} fill={entry.isStarred ? 'currentColor' : 'none'} />
                            </button>
                            <button
                                type="button"
                                className={`zmail-tool-btn ${entry.isImportant ? 'zmail-important' : ''}`}
                                onClick={handleImportant}
                                aria-label={entry.isImportant ? 'Mark not important' : 'Mark important'}
                                title="Important"
                            >
                                <AlertCircle size={18} />
                            </button>
                            {entry.isTrashed ? (
                                <button type="button" className="zmail-tool-btn" onClick={handleRestore} aria-label="Restore from trash" title="Restore">
                                    <RotateCcw size={18} />
                                </button>
                            ) : (
                                <>
                                    <button type="button" className="zmail-tool-btn" onClick={handleArchive} aria-label="Archive" title="Archive">
                                        <Archive size={18} />
                                    </button>
                                    <button type="button" className="zmail-tool-btn" onClick={handleTrash} aria-label="Move to trash" title="Trash">
                                        <Trash2 size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="zmail-sender-meta" style={{ marginTop: hideHeaderSubject ? 0 : undefined }}>
                    <div className="zmail-sender-avatar">{(senderName || 'U').slice(0, 1).toUpperCase()}</div>
                    <div className="zmail-sender-info">
                        <div className="zmail-sender-name-row">
                            <span className="zmail-sender-name">{senderName}</span>
                            <span className="zmail-sender-addr">&lt;{senderAddress}&gt;</span>
                        </div>
                        <div className="zmail-recipients-row">
                            To: {recipientList || '(undisclosed)'}
                        </div>
                    </div>
                    <div className="zmail-msg-date">{formatDate(sentAt)}</div>
                </div>
            </div>

            {/* Message Body */}
            <div className="zmail-msg-body">
                <pre className="zmail-body-text">{body}</pre>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
                <div className="zmail-attachments-section">
                    <div className="zmail-attachments-label">
                        <Paperclip size={14} /> Attachments ({attachments.length})
                    </div>
                    <div className="zmail-attachments-grid">
                        {attachments.map(att => (
                            <div key={att._id} className="zmail-attachment-card">
                                <Paperclip size={16} className="zmail-att-icon" />
                                <div className="zmail-att-info">
                                    <span className="zmail-att-name">{att.originalName}</span>
                                    <span className="zmail-att-size">{(att.sizeBytes / 1024).toFixed(1)} KB</span>
                                </div>
                                <button
                                    type="button"
                                    className="zmail-tool-btn"
                                    onClick={() => {
                                        setPreviewAttachment(att);
                                        if (att.storageKey?.startsWith('http') && (att.mimeType?.startsWith('image/') || att.mimeType?.includes('pdf'))) {
                                            setPreviewLoading(true);
                                        } else {
                                            setPreviewLoading(false);
                                        }
                                    }}
                                    aria-label={`Preview ${att.originalName}`}
                                    title="Preview attachment"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    className="zmail-tool-btn"
                                    onClick={() => handleDownload(att)}
                                    aria-label={`Download ${att.originalName}`}
                                    title="Download"
                                    disabled={downloadingId === att._id}
                                >
                                    {downloadingId === att._id ? <Loader2 size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} /> : <Download size={16} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply / Forward actions */}
            {!entry.isTrashed && (
                <div className="zmail-reply-bar">
                    <button
                        className="zmail-reply-btn primary"
                        onClick={() => { setReplyAll(false); setReplyOpen(true); setForwardOpen(false); }}
                        aria-label="Reply"
                        id="zmail-reply-btn"
                    >
                        <Reply size={16} /> Reply
                    </button>
                    <button
                        className="zmail-reply-btn"
                        onClick={() => { setReplyAll(true); setReplyOpen(true); setForwardOpen(false); }}
                        aria-label="Reply All"
                        id="zmail-reply-all-btn"
                    >
                        <CornerUpRight size={16} /> Reply All
                    </button>
                    <button
                        className="zmail-reply-btn"
                        onClick={() => { setForwardOpen(true); setReplyOpen(false); }}
                        aria-label="Forward"
                        id="zmail-forward-btn"
                    >
                        <Forward size={16} /> Forward
                    </button>
                </div>
            )}

            {/* Inline reply compose */}
            {replyOpen && (
                <div className="zmail-inline-compose">
                    <ZMailCompose
                        initialTo={replyAll
                            ? [senderAddress, ...to.map(r => r.address || r).filter(a => a !== message.senderAddress)]
                            : [senderAddress]}
                        initialSubject={subject?.startsWith('Re: ') ? subject : `Re: ${subject}`}
                        initialBody={`\n\n--- Original message from ${senderName} (${formatDate(sentAt)}) ---\n${body}`}
                        replyToMessageId={message._id}
                        minimizable={false}
                        onClose={() => setReplyOpen(false)}
                        onSent={() => { setReplyOpen(false); onRefresh && onRefresh(); }}
                    />
                </div>
            )}

            {/* Inline forward compose */}
            {forwardOpen && (
                <div className="zmail-inline-compose">
                    <ZMailCompose
                        initialSubject={subject?.startsWith('Fwd: ') ? subject : `Fwd: ${subject}`}
                        initialBody={`\n\n---------- Forwarded message ----------\nFrom: ${senderName} <${senderAddress}>\nDate: ${formatDate(sentAt)}\nSubject: ${subject}\n\n${body}`}
                        minimizable={false}
                        onClose={() => setForwardOpen(false)}
                        onSent={() => { setForwardOpen(false); onRefresh && onRefresh(); }}
                    />
                </div>
            )}

            {/* Attachment Preview Modal */}
            {previewAttachment && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '80%', height: '80%', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '40px 20px 20px', display: 'flex', flexDirection: 'column' }}>
                        <button 
                            type="button" 
                            onClick={() => setPreviewAttachment(null)}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                        
                        {previewAttachment.storageKey?.startsWith('http') ? (
                            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {previewLoading && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e1e1e', zIndex: 10 }}>
                                        <Loader2 size={48} className="spin" style={{ animation: 'spin 2s linear infinite', color: '#4a90e2' }} />
                                    </div>
                                )}
                                {previewAttachment.mimeType?.startsWith('image/') ? (
                                    <img 
                                        src={previewAttachment.storageKey} 
                                        alt={previewAttachment.originalName} 
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto', display: previewLoading ? 'none' : 'block' }} 
                                        onLoad={() => setPreviewLoading(false)}
                                        onError={() => setPreviewLoading(false)}
                                    />
                                ) : previewAttachment.mimeType?.includes('pdf') ? (
                                    <iframe 
                                        src={previewAttachment.storageKey} 
                                        title={previewAttachment.originalName} 
                                        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white', display: previewLoading ? 'none' : 'block' }} 
                                        onLoad={() => setPreviewLoading(false)}
                                        onError={() => setPreviewLoading(false)}
                                    />
                                ) : (
                                    <div style={{ color: 'white', margin: 'auto', textAlign: 'center' }}>
                                        <p>Preview not available for this file type.</p>
                                        <a href={previewAttachment.storageKey} target="_blank" rel="noreferrer" style={{ color: '#4a90e2', textDecoration: 'underline', marginTop: '10px', display: 'inline-block' }}>Download File</a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ color: 'white', margin: 'auto', textAlign: 'center' }}>
                                <p>Preview is not available for this legacy message attachment.</p>
                                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>You can still download it securely using the download button.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
