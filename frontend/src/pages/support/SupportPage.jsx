/**
 * SupportPage — Standalone Support System Dashboard: /support
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupportDashboard } from '../../components/support/SupportDashboard.jsx';
import { SupportLayout } from './SupportLayout.jsx';
import '../../components/support/support.css';

export default function SupportPage() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!localStorage.getItem('supportToken')) {
            navigate('/support/login');
        }
    }, [navigate]);

    return (
        <SupportLayout>
            <SupportDashboard />
        </SupportLayout>
    );
}
