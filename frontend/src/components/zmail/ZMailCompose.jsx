/**
 * ZMailCompose — Full compose window with draft autosave
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Save, ChevronDown, ChevronUp, Paperclip, Minimize2, Eye, Loader2 } from 'lucide-react';
import { ZMailRecipientInput } from './ZMailRecipientInput.jsx';
import {
    sendMessage, createDraft, updateDraft, sendDraft, uploadAttachment,
} from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';
import { useZMail } from '../../hooks/useZMail.jsx';

const AUTOSAVE_DELAY = 3000; // 3 seconds debounce

export function ZMailCompose({
    onClose,
    onSent,
    initialTo = [],
    initialSubject = '',
    initialBody = '',
    replyToMessageId = null,
    existingDraftId = null,
    existingDraftVersion = 0,
    minimizable = true,
}) {
    const [to, setTo] = useState(initialTo);
    const [cc, setCc] = useState([]);
    const [bcc, setBcc] = useState([]);
    const [subject, setSubject] = useState(initialSubject);
    const [body, setBody] = useState(initialBody);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [sending, setSending] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftId, setDraftId] = useState(existingDraftId);
    const [draftVersion, setDraftVersion] = useState(existingDraftVersion);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const autosaveRef = useRef(null);
    const fileInputRef = useRef(null);
    const toast = useToast();
    const { refreshCounts } = useZMail();

    // Autosave draft
    const saveDraft = useCallback(async () => {
        if (sending) return;
        setSaving(true);
        try {
            const payload = { to, cc, bcc, subject, body, attachments };
            if (draftId) {
                const res = await updateDraft(draftId, { ...payload, version: draftVersion });
                if (res.success) setDraftVersion(res.version);
            } else {
                const res = await createDraft(payload);
                if (res.success) {
                    setDraftId(res.draftId);
                    setDraftVersion(1);
                }
            }
            refreshCounts();
        } catch { /* silently ignore autosave errors */ }
        setSaving(false);
    }, [to, cc, bcc, subject, body, attachments, draftId, draftVersion, sending, refreshCounts]);

    // Debounce autosave whenever compose fields change (including attachments)
    useEffect(() => {
        clearTimeout(autosaveRef.current);
        autosaveRef.current = setTimeout(saveDraft, AUTOSAVE_DELAY);
        return () => clearTimeout(autosaveRef.current);
    }, [to, cc, bcc, subject, body, attachments]);

    const handleSend = async () => {
        if (!to || to.length === 0) {
            toast.error('Please add at least one recipient.');
            return;
        }
        if (!body.trim()) {
            toast.error('Message body cannot be empty.');
            return;
        }
        setSending(true);
        clearTimeout(autosaveRef.current);
        try {
            if (draftId) {
                // Flush latest edits to the server before sending
                await updateDraft(draftId, { to, cc, bcc, subject, body, attachments, version: draftVersion });
                await sendDraft(draftId);
            } else {
                await sendMessage({ to, cc, bcc, subject, body, attachments, replyToMessageId });
            }
            toast.success('Message sent!');
            refreshCounts();
            onSent && onSent();
            onClose();
        } catch (e) {
            console.error('[ZMail] Send failed:', e?.response?.status, e?.response?.data, e?.message);
            toast.error(e?.response?.data?.error || e?.message || 'Failed to send message. Please try again.');
        }
        setSending(false);
    };

    const handleDiscard = async () => {
        clearTimeout(autosaveRef.current);
        if (draftId) {
            try {
                const { deleteDraft } = await import('../../hooks/useZMail.jsx');
                await deleteDraft(draftId);
                refreshCounts();
            } catch { /* ignore */ }
        }
        onClose();
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (attachments.length + files.length > 10) {
            toast.warning('Maximum 10 attachments allowed.');
            e.target.value = '';
            return;
        }

        const oversized = files.filter(f => f.size > 25 * 1024 * 1024);
        if (oversized.length) {
            oversized.forEach(f => toast.warning(`"${f.name}" exceeds 25 MB limit.`));
        }
        const validFiles = files.filter(f => f.size <= 25 * 1024 * 1024);
        if (!validFiles.length) { e.target.value = ''; return; }

        setUploading(true);
        for (const file of validFiles) {
            try {
                const att = await uploadAttachment(file);
                setAttachments(prev => [...prev, att]);
            } catch (err) {
                toast.error(`Failed to upload "${file.name}": ${err.message}`);
            }
        }
        setUploading(false);
        e.target.value = '';
    };
    const [isMaximized, setIsMaximized] = useState(false);

    if (minimized) {
        return (
            <div className="zmail-compose-minimized" onClick={() => setMinimized(false)} role="button" tabIndex={0}>
                <span>New Message</span>
                {saving && <span className="zmail-saving-dot" title="Saving...">●</span>}
                <button type="button" onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Close">
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className={`zmail-compose-window ${isMaximized ? 'maximized' : ''}`} role="dialog" aria-label="Compose email" aria-modal="true">
            {/* Header */}
            <div className="zmail-compose-header">
                <span className="zmail-compose-title">New Message</span>
                <div className="zmail-compose-header-actions">
                    {saving && <span className="zmail-saving-text">Saving...</span>}
                    {minimizable && (
                        <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize" className="zmail-compose-action-btn">
                            <span style={{ fontSize: 18, lineHeight: 1 }}>−</span>
                        </button>
                    )}
                    <button type="button" onClick={() => setIsMaximized(!isMaximized)} aria-label={isMaximized ? "Restore" : "Maximize"} className="zmail-compose-action-btn">
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{isMaximized ? '🗗' : '🗖'}</span>
                    </button>
                    <button type="button" onClick={handleDiscard} aria-label="Discard draft" className="zmail-compose-action-btn">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Recipients */}
            <div className="zmail-compose-fields">
                <ZMailRecipientInput label="To" value={to} onChange={setTo} placeholder="recipient@zeroleak.com" />

                {showCc && (
                    <ZMailRecipientInput label="Cc" value={cc} onChange={setCc} placeholder="cc@zeroleak.com" />
                )}
                {showBcc && (
                    <ZMailRecipientInput label="Bcc" value={bcc} onChange={setBcc} placeholder="bcc@zeroleak.com" />
                )}

                <div className="zmail-compose-cc-toggle">
                    {!showCc && (
                        <button type="button" onClick={() => setShowCc(true)} className="zmail-toggle-link">
                            Cc
                        </button>
                    )}
                    {!showBcc && (
                        <button type="button" onClick={() => setShowBcc(true)} className="zmail-toggle-link">
                            Bcc
                        </button>
                    )}
                </div>

                <div className="zmail-compose-subject-row">
                    <input
                        className="zmail-compose-subject"
                        type="text"
                        placeholder="Subject"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        maxLength={998}
                        aria-label="Subject"
                    />
                </div>
            </div>

            {/* Body */}
            <textarea
                className="zmail-compose-body"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here..."
                aria-label="Message body"
            />

            {/* Attachments preview */}
            {attachments.length > 0 && (
                <div className="zmail-compose-attachments">
                    {attachments.map((att, i) => (
                        <div key={i} className="zmail-compose-attachment-chip">
                            <Paperclip size={12} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.originalName}</span>
                            
                            {att.storageKey && (
                                <button
                                    type="button"
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
                                    style={{ marginLeft: 'auto', padding: '0 4px' }}
                                >
                                    <Eye size={12} />
                                </button>
                            )}
                            
                            <button
                                type="button"
                                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                aria-label={`Remove ${att.originalName}`}
                                title="Remove attachment"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer actions */}
            <div className="zmail-compose-footer">
                <button
                    className="btn btn-primary zmail-send-btn"
                    onClick={handleSend}
                    disabled={sending}
                    aria-label="Send message"
                    id="zmail-send-btn"
                >
                    <Send size={16} />
                    {sending ? 'Sending...' : 'Send'}
                </button>

                <label
                    className="topbar-btn"
                    aria-label={uploading ? 'Uploading...' : 'Attach file'}
                    title={uploading ? 'Uploading...' : 'Attach file'}
                    style={{ cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, opacity: uploading ? 0.6 : 1 }}
                >
                    {uploading ? (
                        <Loader2 size={18} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                    ) : (
                        <Paperclip size={18} />
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        multiple
                        disabled={uploading}
                        onChange={handleFileSelect}
                        aria-label="Select file to attach"
                    />
                </label>

                <button
                    type="button"
                    className="topbar-btn"
                    onClick={() => { clearTimeout(autosaveRef.current); saveDraft(); }}
                    aria-label="Save draft"
                    title="Save draft"
                    disabled={saving}
                >
                    <Save size={18} />
                </button>
            </div>
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
                                <p>Preview is not available for this legacy draft attachment.</p>
                                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>It will be sent normally, but cannot be previewed here.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
