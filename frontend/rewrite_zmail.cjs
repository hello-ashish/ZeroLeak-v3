const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = '/Users/helloashish/Desktop/ZeroLeak-v2/frontend/src';
const ZMAIL_COMPONENTS = path.join(FRONTEND_SRC, 'components', 'zmail');
const PAGES_DIR = path.join(FRONTEND_SRC, 'pages');

if (!fs.existsSync(ZMAIL_COMPONENTS)) fs.mkdirSync(ZMAIL_COMPONENTS, { recursive: true });

// --- CSS ---
const zmailCSS = `/* ═══════════════════════════════════════════════════════════
   ZMail — ZeroLeak Private Communication Workspace
   ═══════════════════════════════════════════════════════════ */

:root {
  --zm-bg-base: #0a0a0b;
  --zm-bg-surface: #121214;
  --zm-bg-surface-hover: #1c1c1f;
  --zm-bg-elevated: #1a1a1d;
  --zm-bg-compose: #161619;
  
  --zm-border-subtle: #27272a;
  --zm-border-focus: #3b82f6;
  
  --zm-brand-blue: #2563eb;
  --zm-brand-blue-hover: #1d4ed8;
  --zm-brand-glow: rgba(37, 99, 235, 0.15);
  --zm-support-accent: #8b5cf6;
  
  --zm-text-primary: #f4f4f5;
  --zm-text-secondary: #a1a1aa;
  --zm-text-muted: #71717a;
  
  --zm-radius-sm: 8px;
  --zm-radius-md: 12px;
  --zm-radius-lg: 16px;
  --zm-radius-xl: 24px;
  
  --zm-shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.2);
  --zm-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
  
  --zm-transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Shell Layout */
.zmail-shell {
  display: flex;
  height: calc(100vh - 64px);
  background: var(--zm-bg-base);
  color: var(--zm-text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
  position: relative;
}
.zmail-shell.full-screen { height: 100vh; }

/* Rail (Sidebar) */
.zm-rail {
  width: 240px;
  background: var(--zm-bg-surface);
  border-right: 1px solid var(--zm-border-subtle);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  flex-shrink: 0;
  transition: width var(--zm-transition);
}
.zm-rail.collapsed { width: 72px; padding: 16px 8px; }
.zm-rail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding: 0 8px; }
.zm-rail-brand { font-weight: 700; font-size: 16px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
.zm-rail-brand .icon { color: var(--zm-brand-blue); }
.zm-rail-brand .text { display: var(--rail-text-display, block); }

.zm-compose-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--zm-brand-blue); color: #fff;
  border: none; border-radius: var(--zm-radius-md);
  padding: 12px; font-size: 14px; font-weight: 600; cursor: pointer;
  margin-bottom: 24px; transition: all var(--zm-transition);
  box-shadow: 0 4px 12px var(--zm-brand-glow);
}
.zm-compose-btn:hover { background: var(--zm-brand-blue-hover); transform: translateY(-1px); }

.zm-nav-list { display: flex; flex-direction: column; gap: 4px; }
.zm-nav-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: var(--zm-radius-sm);
  color: var(--zm-text-secondary); cursor: pointer;
  transition: all var(--zm-transition); font-size: 14px; font-weight: 500;
}
.zm-nav-item:hover { background: var(--zm-bg-surface-hover); color: var(--zm-text-primary); }
.zm-nav-item.active { background: var(--zm-bg-elevated); color: var(--zm-brand-blue); }
.zm-nav-item .nav-left { display: flex; align-items: center; gap: 12px; }
.zm-nav-badge { background: var(--zm-brand-blue); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 12px; font-weight: 600; }

/* Main Area */
.zm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Header */
.zm-header {
  height: 64px; border-bottom: 1px solid var(--zm-border-subtle);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; background: var(--zm-bg-base); flex-shrink: 0;
}
.zm-search-capsule {
  display: flex; align-items: center; background: var(--zm-bg-surface);
  border: 1px solid var(--zm-border-subtle); border-radius: 24px;
  padding: 8px 16px; width: 400px; transition: all var(--zm-transition);
}
.zm-search-capsule:focus-within { border-color: var(--zm-border-focus); box-shadow: 0 0 0 3px var(--zm-brand-glow); }
.zm-search-capsule input {
  background: transparent; border: none; outline: none; color: var(--zm-text-primary);
  margin-left: 12px; width: 100%; font-size: 14px;
}
.zm-search-capsule .shortcut { color: var(--zm-text-muted); font-size: 12px; border: 1px solid var(--zm-border-subtle); padding: 2px 6px; border-radius: 4px; }
.zm-header-actions { display: flex; align-items: center; gap: 16px; color: var(--zm-text-secondary); }

/* Workspace Split */
.zm-workspace { display: flex; flex: 1; overflow: hidden; }

/* Conversation List */
.zm-conv-list {
  width: 340px; border-right: 1px solid var(--zm-border-subtle);
  display: flex; flex-direction: column; background: var(--zm-bg-base); flex-shrink: 0;
}
.zm-list-scroll { flex: 1; overflow-y: auto; padding: 12px; }
.zm-list-group { margin-bottom: 24px; }
.zm-list-group-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  color: var(--zm-text-muted); margin-bottom: 8px; padding-left: 8px; letter-spacing: 0.05em;
}

/* Conversation Card */
.zm-conv-card {
  padding: 14px; border-radius: var(--zm-radius-md); border: 1px solid transparent;
  cursor: pointer; transition: all var(--zm-transition); margin-bottom: 6px;
  position: relative; background: transparent;
}
.zm-conv-card:hover { background: var(--zm-bg-surface-hover); }
.zm-conv-card.selected { background: var(--zm-bg-surface); border-color: var(--zm-border-subtle); box-shadow: var(--zm-shadow-sm); }
.zm-conv-card.unread { background: rgba(37, 99, 235, 0.05); }
.zm-conv-card.unread:hover { background: rgba(37, 99, 235, 0.08); }
.zm-conv-card.unread.selected { background: var(--zm-bg-surface); border-color: var(--zm-brand-blue); }
.zm-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.zm-card-sender { font-size: 14px; font-weight: 600; color: var(--zm-text-primary); display: flex; align-items: center; gap: 6px; }
.zm-card-time { font-size: 11px; color: var(--zm-text-muted); }
.zm-card-subject { font-size: 13px; font-weight: 500; color: var(--zm-text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zm-card-preview { font-size: 13px; color: var(--zm-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zm-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: var(--zm-text-muted); }
.zm-unread-dot { width: 8px; height: 8px; background: var(--zm-brand-blue); border-radius: 50%; box-shadow: 0 0 8px var(--zm-brand-blue); }
.zm-support-badge { font-size: 10px; color: var(--zm-support-accent); border: 1px solid var(--zm-support-accent); padding: 2px 6px; border-radius: 10px; }

/* Conversation View */
.zm-conv-view { flex: 1; display: flex; flex-direction: column; background: var(--zm-bg-base); overflow: hidden; }
.zm-view-header {
  padding: 24px 32px; border-bottom: 1px solid var(--zm-border-subtle);
  display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0;
}
.zm-view-subject { font-size: 20px; font-weight: 700; color: var(--zm-text-primary); margin-bottom: 8px; }
.zm-view-tags { display: flex; gap: 8px; }
.zm-tag { padding: 4px 10px; font-size: 11px; border-radius: 12px; font-weight: 600; background: var(--zm-bg-elevated); color: var(--zm-text-secondary); }
.zm-view-actions { display: flex; gap: 8px; }
.zm-action-btn {
  background: transparent; border: 1px solid var(--zm-border-subtle); color: var(--zm-text-secondary);
  width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--zm-transition);
}
.zm-action-btn:hover { background: var(--zm-bg-surface-hover); color: var(--zm-text-primary); }

.zm-thread-scroll { flex: 1; overflow-y: auto; padding: 24px 32px; display: flex; flex-direction: column; gap: 24px; }

/* Message Bubble */
.zm-msg-bubble { display: flex; flex-direction: column; gap: 8px; max-width: 80%; }
.zm-msg-bubble.self { align-self: flex-end; }
.zm-msg-bubble.other { align-self: flex-start; }
.zm-msg-header { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--zm-text-secondary); }
.zm-msg-bubble.self .zm-msg-header { flex-direction: row-reverse; }
.zm-msg-content {
  background: var(--zm-bg-surface); padding: 16px; border-radius: var(--zm-radius-md);
  font-size: 14px; line-height: 1.6; color: var(--zm-text-primary); border: 1px solid var(--zm-border-subtle);
  white-space: pre-wrap; word-wrap: break-word;
}
.zm-msg-bubble.self .zm-msg-content { background: var(--zm-brand-blue); border-color: var(--zm-brand-blue); color: #fff; }
.zm-msg-bubble.support .zm-msg-content { background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); }
.zm-attachments { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.zm-attachment {
  display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2);
  padding: 8px 12px; border-radius: var(--zm-radius-sm); font-size: 12px; cursor: pointer;
  border: 1px solid var(--zm-border-subtle); transition: var(--zm-transition);
}
.zm-attachment:hover { border-color: var(--zm-text-secondary); }

/* Context Panel */
.zm-context-panel {
  width: 280px; border-left: 1px solid var(--zm-border-subtle); background: var(--zm-bg-surface);
  padding: 24px; flex-shrink: 0; overflow-y: auto;
}
.zm-contact-hero { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 32px; }
.zm-avatar-lg { width: 64px; height: 64px; border-radius: 50%; background: var(--zm-bg-elevated); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--zm-text-primary); margin-bottom: 16px; border: 1px solid var(--zm-border-subtle); }
.zm-contact-name { font-size: 16px; font-weight: 600; color: var(--zm-text-primary); margin-bottom: 4px; }
.zm-contact-email { font-size: 13px; color: var(--zm-text-secondary); }
.zm-context-section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--zm-border-subtle); }
.zm-context-label { font-size: 11px; font-weight: 700; color: var(--zm-text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; }

/* Compose Workspace (Floating) */
.zm-compose-workspace {
  position: absolute; bottom: 24px; right: 24px; width: 600px; max-height: 80vh;
  background: var(--zm-bg-compose); border: 1px solid var(--zm-border-subtle);
  border-radius: var(--zm-radius-lg); box-shadow: var(--zm-shadow-lg);
  display: flex; flex-direction: column; z-index: 100; overflow: hidden;
  transform-origin: bottom right; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.zm-compose-workspace.minimized { height: 48px; cursor: pointer; }
.zm-compose-header {
  padding: 12px 16px; background: var(--zm-bg-elevated); border-bottom: 1px solid var(--zm-border-subtle);
  display: flex; justify-content: space-between; align-items: center;
}
.zm-compose-title { font-size: 14px; font-weight: 600; }
.zm-compose-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.zm-compose-field { display: flex; border-bottom: 1px solid var(--zm-border-subtle); padding: 12px 16px; align-items: center; }
.zm-compose-label { width: 60px; font-size: 13px; color: var(--zm-text-muted); }
.zm-compose-input { flex: 1; background: transparent; border: none; outline: none; color: var(--zm-text-primary); font-size: 14px; }
.zm-compose-textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--zm-text-primary); font-size: 14px; padding: 16px; resize: none; min-height: 200px; font-family: inherit; line-height: 1.5; }
.zm-compose-footer { padding: 12px 16px; border-top: 1px solid var(--zm-border-subtle); display: flex; justify-content: space-between; align-items: center; }
.zm-send-btn { background: var(--zm-brand-blue); color: #fff; border: none; padding: 8px 24px; border-radius: var(--zm-radius-sm); font-weight: 600; cursor: pointer; transition: var(--zm-transition); }
.zm-send-btn:hover { background: var(--zm-brand-blue-hover); }

/* Empty State */
.zm-empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 48px; }
.zm-empty-circle { width: 80px; height: 80px; border-radius: 50%; border: 1px dashed var(--zm-border-subtle); display: flex; align-items: center; justify-content: center; color: var(--zm-text-muted); margin-bottom: 24px; }
.zm-empty-title { font-size: 18px; font-weight: 600; color: var(--zm-text-primary); margin-bottom: 8px; }
.zm-empty-desc { font-size: 14px; color: var(--zm-text-secondary); max-width: 250px; }

/* Overview */
.zm-overview { flex: 1; padding: 48px; overflow-y: auto; }
.zm-greeting { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
.zm-overview-stats { display: flex; gap: 24px; margin-bottom: 48px; }
.zm-stat-item { color: var(--zm-text-secondary); font-size: 14px; }
.zm-stat-item strong { color: var(--zm-text-primary); font-size: 16px; margin-right: 6px; }

@media (max-width: 1024px) {
  .zm-context-panel { display: none; }
}
@media (max-width: 768px) {
  .zm-rail { display: none; }
  .zm-conv-list { width: 100%; border-right: none; }
  .zm-conv-view { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 50; }
  .zm-compose-workspace { width: 100%; height: 100%; bottom: 0; right: 0; border-radius: 0; max-height: 100vh; }
}
`;

fs.writeFileSync(path.join(PAGES_DIR, 'zmail.css'), zmailCSS);

// --- Component: ZMailShell ---
const zmailShellJSX = `import React, { useState, useEffect, useRef } from 'react';
import { ZMailRail } from './ZMailRail.jsx';
import { ZMailHeader } from './ZMailHeader.jsx';
import { ConversationList } from './ConversationList.jsx';
import { ConversationView } from './ConversationView.jsx';
import { ComposeWorkspace } from './ComposeWorkspace.jsx';
import { ZMailOverview } from './ZMailOverview.jsx';
import { fetchFolder, searchMail, emptyTrash } from '../../hooks/useZMail.jsx';
import { useZMail } from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';

export function ZMailShell({ isFullScreen }) {
    const [folder, setFolder] = useState('inbox');
    const [entries, setEntries] = useState([]);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showCompose, setShowCompose] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const { unreadCount, connected, account } = useZMail();
    const toast = useToast();

    useEffect(() => {
        setSearchMode(false);
        setSearchQuery('');
        loadFolder(folder);
        setSelectedEntry(null);
    }, [folder]);

    useEffect(() => {
        if (folder === 'inbox') loadFolder('inbox');
    }, [unreadCount]);

    const loadFolder = async (f) => {
        setLoading(true);
        try {
            const data = await fetchFolder(f, 1);
            setEntries(data.entries || []);
        } catch {
            toast.error('Failed to load messages.');
        }
        setLoading(false);
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (!q.trim()) { setSearchMode(false); return; }
        setSearchMode(true);
        try {
            const data = await searchMail(q);
            setEntries(data.results || []);
        } catch { toast.error('Search failed'); }
    };

    return (
        <div className={\`zmail-shell \${isFullScreen ? 'full-screen' : ''}\`}>
            <ZMailRail folder={folder} setFolder={setFolder} onCompose={() => setShowCompose(true)} />
            
            <div className="zm-main">
                <ZMailHeader searchQuery={searchQuery} onSearch={handleSearch} connected={connected} />
                
                <div className="zm-workspace">
                    <ConversationList 
                        entries={entries} 
                        loading={loading}
                        selectedEntry={selectedEntry} 
                        onSelect={setSelectedEntry} 
                        folder={folder}
                    />
                    
                    {selectedEntry ? (
                        <ConversationView 
                            entry={selectedEntry} 
                            onBack={() => setSelectedEntry(null)} 
                            onRefresh={() => loadFolder(folder)}
                        />
                    ) : (
                        <ZMailOverview account={account} unreadCount={unreadCount} entries={entries} onCompose={() => setShowCompose(true)} />
                    )}
                </div>
            </div>

            {showCompose && <ComposeWorkspace onClose={() => setShowCompose(false)} />}
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ZMailShell.jsx'), zmailShellJSX);

// --- Component: ZMailRail ---
const zmailRailJSX = `import React from 'react';
import { Inbox, Send, File, Star, Archive, Trash2, Edit3, Shield } from 'lucide-react';
import { useZMail } from '../../hooks/useZMail.jsx';

export function ZMailRail({ folder, setFolder, onCompose }) {
    const { unreadCount, account } = useZMail();
    const isSupport = account?.userType === 'Support' || account?.isSupportMailbox;

    const navs = [
        { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
        { id: 'sent', label: 'Messages', icon: Send },
        { id: 'starred', label: 'Starred', icon: Star },
        { id: 'drafts', label: 'Drafts', icon: File },
        { id: 'archive', label: 'Archive', icon: Archive },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    return (
        <div className="zm-rail">
            <div className="zm-rail-header">
                <div className="zm-rail-brand">
                    <div className="icon">Z</div>
                    <div className="text">ZMAIL</div>
                </div>
            </div>

            <button className="zm-compose-btn" onClick={onCompose}>
                <Edit3 size={16} /> New
            </button>

            <div className="zm-nav-list">
                {navs.map(n => (
                    <div 
                        key={n.id} 
                        className={\`zm-nav-item \${folder === n.id ? 'active' : ''}\`}
                        onClick={() => setFolder(n.id)}
                    >
                        <div className="nav-left">
                            <n.icon size={16} /> {n.label}
                        </div>
                        {n.count > 0 && <span className="zm-nav-badge">{n.count}</span>}
                    </div>
                ))}
                
                {isSupport && (
                    <div className="zm-nav-item" style={{ marginTop: 24 }}>
                        <div className="nav-left"><Shield size={16} color="var(--zm-support-accent)" /> Support</div>
                    </div>
                )}
            </div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ZMailRail.jsx'), zmailRailJSX);

// --- Component: ZMailHeader ---
const zmailHeaderJSX = `import React from 'react';
import { Search, Wifi, WifiOff } from 'lucide-react';

export function ZMailHeader({ searchQuery, onSearch, connected }) {
    return (
        <div className="zm-header">
            <div className="zm-search-capsule">
                <Search size={16} color="var(--zm-text-muted)" />
                <input 
                    type="text" 
                    placeholder="Search ZMail" 
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                />
                <span className="shortcut">⌘ K</span>
            </div>
            
            <div className="zm-header-actions">
                {connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <Wifi size={14} color="var(--zm-brand-blue)" /> Connected
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <WifiOff size={14} color="var(--zm-text-muted)" /> Offline
                    </div>
                )}
            </div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ZMailHeader.jsx'), zmailHeaderJSX);

// --- Component: ConversationList ---
const conversationListJSX = `import React from 'react';
import { ConversationCard } from './ConversationCard.jsx';
import { EmptyInbox } from './EmptyInbox.jsx';

export function ConversationList({ entries, loading, selectedEntry, onSelect, folder }) {
    if (loading) return <div className="zm-conv-list"><div style={{padding: 24, color: 'var(--zm-text-muted)'}}>Loading...</div></div>;
    
    if (!entries || entries.length === 0) {
        return <div className="zm-conv-list"><EmptyInbox folder={folder} /></div>;
    }

    // Grouping logic (simplified)
    const today = [];
    const older = [];
    const now = new Date();
    
    entries.forEach(e => {
        const d = new Date(e.sentAt);
        if (d.toDateString() === now.toDateString()) today.push(e);
        else older.push(e);
    });

    return (
        <div className="zm-conv-list">
            <div className="zm-list-scroll">
                {today.length > 0 && (
                    <div className="zm-list-group">
                        <div className="zm-list-group-title">Today</div>
                        {today.map(e => (
                            <ConversationCard 
                                key={e.messageId} 
                                entry={e} 
                                isSelected={selectedEntry?.messageId === e.messageId}
                                onClick={() => onSelect(e)}
                            />
                        ))}
                    </div>
                )}
                {older.length > 0 && (
                    <div className="zm-list-group">
                        <div className="zm-list-group-title">Older</div>
                        {older.map(e => (
                            <ConversationCard 
                                key={e.messageId} 
                                entry={e} 
                                isSelected={selectedEntry?.messageId === e.messageId}
                                onClick={() => onSelect(e)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ConversationList.jsx'), conversationListJSX);

// --- Component: ConversationCard ---
const conversationCardJSX = `import React from 'react';
import { Paperclip, ShieldAlert } from 'lucide-react';

function formatTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationCard({ entry, isSelected, onClick }) {
    const isSupport = entry.senderAddress === 'support@zeroleak.com' || entry.subject?.includes('ZSUP');
    const sender = entry.isDraft ? \`To: \${entry.to?.[0]?.name || 'Unknown'}\` : (entry.senderName || entry.senderAddress);

    return (
        <div className={\`zm-conv-card \${!entry.isRead ? 'unread' : ''} \${isSelected ? 'selected' : ''}\`} onClick={onClick}>
            <div className="zm-card-header">
                <div className="zm-card-sender">
                    {!entry.isRead && <span className="zm-unread-dot" />}
                    {isSupport && <ShieldAlert size={12} color="var(--zm-support-accent)" />}
                    {sender}
                </div>
                <div className="zm-card-time">{formatTime(entry.sentAt)}</div>
            </div>
            <div className="zm-card-subject">{entry.subject || '(no subject)'}</div>
            <div className="zm-card-preview">{entry.snippet || '...'}</div>
            
            {(entry.hasAttachment || entry.isDraft) && (
                <div className="zm-card-meta">
                    {entry.hasAttachment && <><Paperclip size={12} /> Attachments</>}
                    {entry.isDraft && <span className="zm-tag">Draft</span>}
                </div>
            )}
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ConversationCard.jsx'), conversationCardJSX);

// --- Component: ConversationView ---
const conversationViewJSX = `import React, { useEffect, useState } from 'react';
import { fetchMessage, patchMessageWithBody, patchMessage } from '../../hooks/useZMail.jsx';
import { MessageBubble } from './MessageBubble.jsx';
import { ContactContextPanel } from './ContactContextPanel.jsx';
import { ArrowLeft, Star, Archive, Trash2 } from 'lucide-react';
import { useToast } from '../Toast.jsx';

export function ConversationView({ entry, onBack, onRefresh }) {
    const [message, setMessage] = useState(null);
    const toast = useToast();

    useEffect(() => {
        loadMessage();
    }, [entry.messageId]);

    const loadMessage = async () => {
        try {
            const data = await fetchMessage(entry.messageId);
            setMessage(data.message);
            if (!entry.isRead) {
                await patchMessage(entry.messageId, 'read');
                onRefresh();
            }
        } catch { toast.error('Failed to load conversation'); }
    };

    const doAction = async (action, body) => {
        try {
            if (body) await patchMessageWithBody(entry.messageId, action, body);
            else await patchMessage(entry.messageId, action);
            onRefresh();
            if (['archive', 'trash'].includes(action)) onBack();
        } catch { toast.error('Action failed'); }
    };

    if (!message) return <div className="zm-conv-view"><div style={{padding: 48, textAlign: 'center'}}>Loading conversation...</div></div>;

    return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="zm-conv-view">
                <div className="zm-view-header">
                    <div>
                        <div className="zm-view-subject">{message.subject || '(no subject)'}</div>
                        <div className="zm-view-tags">
                            <span className="zm-tag">Conversation</span>
                            {entry.isStarred && <span className="zm-tag" style={{color: '#eab308'}}>Starred</span>}
                        </div>
                    </div>
                    <div className="zm-view-actions">
                        <button className="zm-action-btn" onClick={() => doAction('star', { starred: !entry.isStarred })}><Star size={16} /></button>
                        <button className="zm-action-btn" onClick={() => doAction('archive')}><Archive size={16} /></button>
                        <button className="zm-action-btn" onClick={() => doAction('trash')}><Trash2 size={16} /></button>
                    </div>
                </div>
                
                <div className="zm-thread-scroll">
                    {/* Simplified thread rendering — in a real app this maps thread history */}
                    <MessageBubble msg={message} isSupport={message.senderAddress === 'support@zeroleak.com'} />
                </div>
            </div>
            
            <ContactContextPanel message={message} />
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ConversationView.jsx'), conversationViewJSX);

// --- Component: MessageBubble ---
const messageBubbleJSX = `import React from 'react';
import { Paperclip, Download } from 'lucide-react';

export function MessageBubble({ msg, isSupport }) {
    // Determine if it's "self" by checking if sender is current user... simplified here
    const isSelf = false; 

    return (
        <div className={\`zm-msg-bubble \${isSelf ? 'self' : 'other'} \${isSupport ? 'support' : ''}\`}>
            <div className="zm-msg-header">
                <strong>{msg.senderName || msg.senderAddress}</strong>
                <span>{new Date(msg.sentAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="zm-msg-content">
                {msg.body}
            </div>
            {msg.attachments && msg.attachments.length > 0 && (
                <div className="zm-attachments">
                    {msg.attachments.map(a => (
                        <div key={a._id} className="zm-attachment">
                            <Paperclip size={12} />
                            {a.originalName}
                            <Download size={12} style={{ marginLeft: 8 }} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'MessageBubble.jsx'), messageBubbleJSX);

// --- Component: ContactContextPanel ---
const contactContextPanelJSX = `import React from 'react';

export function ContactContextPanel({ message }) {
    if (!message) return null;
    const initial = (message.senderName || message.senderAddress || 'U').charAt(0).toUpperCase();

    return (
        <div className="zm-context-panel">
            <div className="zm-contact-hero">
                <div className="zm-avatar-lg">{initial}</div>
                <div className="zm-contact-name">{message.senderName || 'Unknown'}</div>
                <div className="zm-contact-email">{message.senderAddress}</div>
            </div>
            
            <div className="zm-context-section">
                <div className="zm-context-label">Conversation</div>
                <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>
                    Started {new Date(message.createdAt).toLocaleDateString()}
                </div>
            </div>

            {message.attachments && message.attachments.length > 0 && (
                <div className="zm-context-section">
                    <div className="zm-context-label">Files</div>
                    <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>
                        {message.attachments.length} attachments
                    </div>
                </div>
            )}
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ContactContextPanel.jsx'), contactContextPanelJSX);

// --- Component: ComposeWorkspace ---
const composeWorkspaceJSX = `import React, { useState } from 'react';
import { X, Send, Paperclip } from 'lucide-react';
import { sendMail } from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';

export function ComposeWorkspace({ onClose }) {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [minimized, setMinimized] = useState(false);
    const toast = useToast();

    const handleSend = async () => {
        try {
            await sendMail({
                to: [{ address: to }],
                subject,
                body,
                attachments: []
            });
            toast.success('Sent successfully');
            onClose();
        } catch { toast.error('Failed to send'); }
    };

    if (minimized) {
        return (
            <div className="zm-compose-workspace minimized" onClick={() => setMinimized(false)}>
                <div className="zm-compose-header">
                    <div className="zm-compose-title">Draft: {subject || 'New Message'}</div>
                    <X size={16} onClick={(e) => { e.stopPropagation(); onClose(); }} />
                </div>
            </div>
        );
    }

    return (
        <div className="zm-compose-workspace">
            <div className="zm-compose-header" onClick={() => setMinimized(true)}>
                <div className="zm-compose-title">New message</div>
                <X size={16} style={{cursor:'pointer'}} onClick={(e) => { e.stopPropagation(); onClose(); }} />
            </div>
            
            <div className="zm-compose-body">
                <div className="zm-compose-field">
                    <div className="zm-compose-label">To</div>
                    <input className="zm-compose-input" value={to} onChange={e => setTo(e.target.value)} placeholder="email@zeroleak.com" />
                </div>
                <div className="zm-compose-field">
                    <div className="zm-compose-label">Subject</div>
                    <input className="zm-compose-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="What's this about?" />
                </div>
                <textarea className="zm-compose-textarea" value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." />
            </div>
            
            <div className="zm-compose-footer">
                <button className="zm-action-btn"><Paperclip size={16} /></button>
                <button className="zm-send-btn" onClick={handleSend}>Send <Send size={14} style={{marginLeft: 8}} /></button>
            </div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ComposeWorkspace.jsx'), composeWorkspaceJSX);

// --- Component: EmptyInbox ---
const emptyInboxJSX = `import React from 'react';

export function EmptyInbox({ folder }) {
    return (
        <div className="zm-empty-state">
            <div className="zm-empty-circle">
                ◌
            </div>
            <div className="zm-empty-title">Your {folder} is clear</div>
            <div className="zm-empty-desc">No conversations need your attention right now.</div>
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'EmptyInbox.jsx'), emptyInboxJSX);

// --- Component: ZMailOverview ---
const zmailOverviewJSX = `import React from 'react';

export function ZMailOverview({ account, unreadCount, entries, onCompose }) {
    const name = account?.displayName?.split(' ')[0] || account?.name?.split(' ')[0] || 'User';
    
    return (
        <div className="zm-overview">
            <div className="zm-greeting">Good morning, {name}.</div>
            
            <div className="zm-overview-stats">
                <div className="zm-stat-item"><strong>{unreadCount}</strong> unread</div>
                <div className="zm-stat-item"><strong>{entries.length}</strong> recent conversations</div>
            </div>
            
            <div className="zm-context-label">Recent Activity</div>
            {entries.slice(0, 3).map(e => (
                <div key={e.messageId} style={{marginBottom: 16}}>
                    <div style={{fontWeight: 600, color: 'var(--zm-text-primary)'}}>{e.senderName || e.senderAddress}</div>
                    <div style={{fontSize: 13, color: 'var(--zm-text-secondary)'}}>{e.subject}</div>
                </div>
            ))}
        </div>
    );
}
`;
fs.writeFileSync(path.join(ZMAIL_COMPONENTS, 'ZMailOverview.jsx'), zmailOverviewJSX);

// Rewrite ZMailPage.jsx
const zmailPageJSX = `/**
 * ZMailPage — Main ZMail application page
 * Completely redesigned frontend structure.
 */
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminLayout } from './admin/AdminLayout.jsx';
import { StudentLayout } from './student/StudentLayout.jsx';
import { ProfessorLayout } from './professor/ProfessorLayout.jsx';
import { AuditorLayout } from './auditor/AuditorLayout.jsx';
import { SupportLayout } from './support/SupportLayout.jsx';
import { ZMailShell } from '../components/zmail/ZMailShell.jsx';
import './zmail.css';

export default function ZMailPage() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const roleParam = queryParams.get('role');
    const [isFullScreen, setIsFullScreen] = useState(false);

    const Wrapper = roleParam === 'support' ? SupportLayout
                   : roleParam === 'admin' ? AdminLayout
                   : roleParam === 'prof' ? ProfessorLayout
                   : roleParam === 'auditor' ? AuditorLayout
                   : roleParam === 'student' ? StudentLayout
                   : React.Fragment;

    return (
        <Wrapper>
            <ZMailShell isFullScreen={isFullScreen} />
        </Wrapper>
    );
}
`;
fs.writeFileSync(path.join(PAGES_DIR, 'ZMailPage.jsx'), zmailPageJSX);

console.log("Rewrite complete.");
