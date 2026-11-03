import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockchainCenter from '../../components/blockchain/BlockchainCenter';
import { AdminLayout } from './AdminLayout';

export default function AdminBlockchainCenter() {
    const navigate = useNavigate();
    const token = localStorage.getItem('adminToken');

    useEffect(() => {
        if (!token) {
            navigate('/admin/login');
        }
    }, [token, navigate]);

    if (!token) {
        return null;
    }

    return (
        <AdminLayout>
            <BlockchainCenter token={token} />
        </AdminLayout>
    );
}

