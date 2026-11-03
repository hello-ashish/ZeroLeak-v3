import React from 'react';
import { Search, Wifi, WifiOff } from 'lucide-react';

export function ZMailHeader({ searchQuery, onSearch, connected }) {
    return (
        <div className="zm-header">
            <div className="zm-search-box">
                <Search size={15} color="var(--zm-text-muted)" />
                <input
                    type="text"
                    placeholder="Search mail, people, subjects…"
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    aria-label="Search ZeroleakMail"
                />
                <span className="zm-search-kbd">⌘K</span>
            </div>

            <div className="zm-header-right">
                <div className={`zm-connection-status ${connected ? 'online' : ''}`}>
                    {connected
                        ? <><Wifi size={13} /> Live</>
                        : <><WifiOff size={13} /> Offline</>
                    }
                </div>
            </div>
        </div>
    );
}
