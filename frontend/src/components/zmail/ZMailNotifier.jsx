import React, { useEffect } from 'react';
import { useZMail } from '../../hooks/useZMail.jsx';
import { useToast } from '../Toast.jsx';

export function ZMailNotifier() {
    const { registerToastCallback } = useZMail();
    const toast = useToast();

    useEffect(() => {
        registerToastCallback((notification) => {
            toast.info(`New ZeroleakMail: ${notification.subject || 'No subject'}`);
        });
    }, [registerToastCallback, toast]);

    return null;
}
