/**
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
                   : (roleParam === 'prof' || roleParam === 'professor') ? ProfessorLayout
                   : roleParam === 'auditor' ? AuditorLayout
                   : roleParam === 'student' ? StudentLayout
                   : React.Fragment;

    return (
        <Wrapper noPadding={true}>
            <ZMailShell isFullScreen={isFullScreen} />
        </Wrapper>
    );
}
