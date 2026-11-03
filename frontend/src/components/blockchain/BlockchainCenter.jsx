// =============================================================================
// ZeroLeak — BlockchainCenter.jsx
// =============================================================================
// Two clearly separated sections:
//   1. Fabric Integrity Center — REAL production operational view
//      Shows actual Fabric network status, real ledger commitments,
//      and real integrity verification.
//   2. Mock Blockchain Lab — SIMULATION / EDUCATIONAL only
//      Clearly labelled. Never presented as real Fabric state.
// =============================================================================

import React, { useState } from 'react';
import './BlockchainCenter.css';
import FabricIntegrityCenter from './FabricIntegrityCenter';
import MockBlockchainDashboard from './MockBlockchainDashboard';

export default function BlockchainCenter({ token }) {
    const [activeSection, setActiveSection] = useState('fabric');
    const [visitedSections, setVisitedSections] = useState(() => new Set(['fabric']));

    const handleSwitchSection = (section) => {
        setActiveSection(section);
        setVisitedSections(prev => {
            if (prev.has(section)) return prev;
            const next = new Set(prev);
            next.add(section);
            return next;
        });
    };

    return (
        <div className="blockchain-center">
            {/* ── Real Fabric Integrity Center ─────────────────────── */}
            <div
                className="bc-section-panel"
                style={{ display: activeSection === 'fabric' ? 'block' : 'none' }}
            >
                <FabricIntegrityCenter
                    token={token}
                    onOpenMockLab={() => handleSwitchSection('mock')}
                />
            </div>

            {/* ── Mock Lab (educational / demo only) ───────────────── */}
            {visitedSections.has('mock') && (
                <div
                    className="bc-section-panel bc-mock-container"
                    style={{ display: activeSection === 'mock' ? 'block' : 'none' }}
                >
                    <div className="bc-mock-header">
                        <div>
                            <div className="bc-mock-title-row">
                                <h1 className="bc-mock-title">Mock Blockchain Lab</h1>
                                <span className="bc-sim-pill">EDUCATIONAL SIMULATION</span>
                            </div>
                            <p className="bc-mock-subtitle">
                                Interactive consensus simulator — does not interact with the immutable Hyperledger Fabric ledger.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="fi-btn fi-btn-primary"
                            onClick={() => handleSwitchSection('fabric')}
                        >
                            ← Return to Fabric Integrity Center
                        </button>
                    </div>

                    <div className="bc-mock-warning">
                        <span className="bc-mock-warning-icon">⚠</span>
                        <span>
                            <strong>SIMULATION ACTIVE</strong> — This sandbox operates independently with local simulated blocks.
                            It does not reflect live blockchain commitments or change-stream tamper detection.
                        </span>
                    </div>

                    <MockBlockchainDashboard />
                </div>
            )}
        </div>
    );
}
