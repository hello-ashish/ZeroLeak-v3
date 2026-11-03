import React from 'react';
import BlockchainCenter from '../../components/blockchain/BlockchainCenter';
import { AuditorLayout } from './AuditorLayout';

export default function AuditorBlockchainCenter() {
    const token = localStorage.getItem('auditorToken');
    return (
        <AuditorLayout>
            <BlockchainCenter token={token} />
        </AuditorLayout>
    );
}
