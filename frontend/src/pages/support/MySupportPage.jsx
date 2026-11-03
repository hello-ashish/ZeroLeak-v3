/**
 * MySupportPage — User-facing support history page: /support/my-tickets
 */
import React from 'react';
import { MySupportTickets } from '../../components/support/MySupportTickets.jsx';
import '../../components/support/support.css';

// The `role` prop is supplied by the router for each role's layout:
// admin -> role="admin", professor -> role="professor", student -> role="student"
export default function MySupportPage({ role }) {
    return <MySupportTickets role={role} />;
}
