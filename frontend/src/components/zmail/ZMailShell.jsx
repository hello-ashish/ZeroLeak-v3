import React, { useState, useEffect, useRef } from 'react';
import { ZMailRail } from './ZMailRail.jsx';
import { ConversationList } from './ConversationList.jsx';
import { ConversationView } from './ConversationView.jsx';
import { ComposeWorkspace } from './ComposeWorkspace.jsx';
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
    const searchTimeout = useRef(null);
    
    const { unreadCount, connected, account, refreshCounts } = useZMail();
    const toast = useToast();

    useEffect(() => {
        setSearchMode(false);
        setSearchQuery('');
        loadFolder(folder);
        setSelectedEntry(null);
    }, [folder]);

    // Refresh inbox silently when a new message arrives (socket triggers unreadCount bump)
    // We only do this if the user is already looking at the inbox folder
    const prevUnreadRef = React.useRef(unreadCount);
    useEffect(() => {
        if (prevUnreadRef.current !== unreadCount && folder === 'inbox') {
            loadFolder('inbox', true);
        }
        prevUnreadRef.current = unreadCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unreadCount]);

    const getCacheKey = (f) => `zmail_cache_${account?.zmailAddress || 'default'}_${f}`;

    const loadFolder = async (f, silent = false) => {
        const cacheKey = getCacheKey(f);
        const cachedData = localStorage.getItem(cacheKey);
        
        let isSilent = silent;
        if (cachedData && !searchMode) {
            try {
                const parsed = JSON.parse(cachedData);
                setEntries(parsed);
                isSilent = true; // Cached data exists, so load fresh data silently
            } catch (e) {
                // Ignore parse errors
            }
        }
        
        if (!isSilent) setLoading(true);
        try {
            const data = await fetchFolder(f, 1);
            setEntries(data.entries || []);
            localStorage.setItem(cacheKey, JSON.stringify(data.entries || []));
        } catch {
            if (!cachedData) toast.error('Failed to load messages.');
        }
        if (!isSilent) setLoading(false);
    };

    const handleSearch = (q) => {
        setSearchQuery(q);
        if (!q.trim()) { 
            setSearchMode(false); 
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            loadFolder(folder, true);
            return; 
        }
        setSearchMode(true);
        
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            try {
                const data = await searchMail(q);
                setEntries(data.results || []);
            } catch (err) { 
                console.error("Search error:", err);
                toast.error('Search failed'); 
            }
        }, 400);
    };

    return (
        <div className={`zmail-shell ${isFullScreen ? 'full-screen' : ''}`}>
            <ZMailRail folder={folder} setFolder={setFolder} onCompose={() => setShowCompose(true)} />
            
            <div className="zm-main" style={{ background: 'var(--zm-bg-base)' }}>
                <div className="zm-workspace-container">
                    <div className="zm-workspace">
                        {!selectedEntry ? (
                            <ConversationList 
                                entries={entries} 
                                loading={loading}
                                selectedEntry={selectedEntry} 
                                onSelect={setSelectedEntry} 
                                folder={folder}
                                onRefresh={() => {
                                    loadFolder(folder, true);
                                    refreshCounts();
                                }}
                            />
                        ) : (
                            <ConversationView 
                                entry={selectedEntry} 
                                onBack={() => setSelectedEntry(null)} 
                                onRefresh={() => {
                                    loadFolder(folder, true);
                                    refreshCounts();
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {showCompose && <ComposeWorkspace onClose={() => setShowCompose(false)} />}
        </div>
    );
}
