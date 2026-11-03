import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyInbox({ folder }) {
    return (
        <div className="zm-empty">
            <div className="zm-empty-icon-wrap">
                <Inbox size={28} />
            </div>
            <div className="zm-empty-title">Your {folder} is clear</div>
            <div className="zm-empty-desc">No conversations need your attention right now.</div>
        </div>
    );
}
