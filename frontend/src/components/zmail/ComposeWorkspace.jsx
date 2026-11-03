import React from 'react';
import { ZMailCompose } from './ZMailCompose.jsx';

/**
 * ComposeWorkspace — thin wrapper that opens the full ZMailCompose
 * instead of the old barebones plain-text form.
 *
 * Previously this was a separate simplified compose window that was missing:
 *   - Recipient autocomplete
 *   - Autosave / draft support
 *   - CC / BCC fields
 *   - Attachment upload
 *   - Proper input validation
 *
 * Now it delegates everything to ZMailCompose.
 */
export function ComposeWorkspace({ onClose, onSent, initialTo, initialSubject, initialBody, replyToMessageId, existingDraftId }) {
    return (
        <ZMailCompose
            onClose={onClose}
            onSent={onSent}
            initialTo={initialTo}
            initialSubject={initialSubject}
            initialBody={initialBody}
            replyToMessageId={replyToMessageId}
            existingDraftId={existingDraftId}
            minimizable={true}
        />
    );
}
