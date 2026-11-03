import React, { useState } from 'react';
import { useMockBlockchain } from '../../hooks/useMockBlockchain';
import MockBlockchainCanvas from './MockBlockchainCanvas';
import MockSimulationLog from './MockSimulationLog';
import MockInspector from './MockInspector';
import MockMerkleTreeLab from './MockMerkleTreeLab';
import { Play, Pause, SkipForward, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function MockBlockchainDashboard() {
    const [activeTab, setActiveTab] = useState('inspector');

    const {
        ledger,
        simulationStatus,
        setSimulationStatus,
        simulationSpeed,
        setSimulationSpeed,
        scenario,
        setScenario,
        simulationLog,
        selectedBlockIndex,
        setSelectedBlockIndex,
        stepSimulation,
        resetSimulation,
        simulateTampering,
        verifyLedger,
        verifyResult
    } = useMockBlockchain();

    const selectedBlock = ledger[selectedBlockIndex] || null;

    const handleRunToggle = () => {
        if (simulationStatus === 'Running') {
            setSimulationStatus('Paused');
        } else {
            setSimulationStatus('Running');
        }
    };

    const handleTamper = () => {
        // Tamper the selected block if it's not genesis, else tamper random
        if (selectedBlockIndex > 0) {
            simulateTampering(selectedBlockIndex);
        } else {
            simulateTampering(null);
        }
    };

    const isFailed = simulationStatus === 'Failed' || (verifyResult && !verifyResult.valid);

    return (
        <div className="mock-lab-container">
            {/* Header Area */}
            <div className="mock-lab-header">
                <div>
                    <h2 className="page-title flex items-center gap-2">Mock Blockchain Lab <span className="badge badge-brand">DEMO / SIMULATED</span></h2>
                    <p className="page-subtitle">Explore how ZeroLeak records, links, verifies, and detects tampering in a safe, simulated environment.</p>
                </div>
            </div>

            {/* Control Bar */}
            <div className="mock-control-bar card">
                <div className="card-body">
                    <div className="control-section">
                        <select className="mock-select" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                            <option value="Exam Lifecycle">Scenario: Exam Lifecycle</option>
                            <option value="Integrity Incident">Scenario: Integrity Incident</option>
                            <option value="Random">Scenario: Random</option>
                        </select>
                        <select className="mock-select" value={simulationSpeed} onChange={(e) => setSimulationSpeed(e.target.value)}>
                            <option value="Slow">Speed: Slow</option>
                            <option value="Normal">Speed: Normal</option>
                            <option value="Fast">Speed: Fast</option>
                        </select>
                    </div>

                    <div className="control-section main-controls">
                        <button className={`btn ${simulationStatus === 'Running' ? 'btn-secondary' : 'btn-primary'}`} onClick={handleRunToggle}>
                            {simulationStatus === 'Running' ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Run Simulation</>}
                        </button>
                        <button className="btn btn-secondary" onClick={stepSimulation} disabled={simulationStatus === 'Running'}>
                            <SkipForward size={16} /> Step
                        </button>
                        <button className="btn btn-secondary" onClick={resetSimulation}>
                            <RotateCcw size={16} /> Reset
                        </button>
                    </div>

                    <div className="control-section">
                        <button className="btn btn-danger" onClick={handleTamper}>
                            <AlertTriangle size={16} /> Simulate Tampering
                        </button>
                        <button className="btn btn-success" onClick={verifyLedger}>
                            <ShieldCheck size={16} /> Verify Chain
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="mock-stats-bar">
                <div className="stat-item">
                    <div className="stat-label">STATUS</div>
                    <div className={`stat-value ${isFailed ? 'text-danger' : simulationStatus === 'Running' ? 'text-brand' : ''}`}>{simulationStatus}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">SIMULATED BLOCKS</div>
                    <div className="stat-value">{ledger.length}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">CHAIN HEIGHT</div>
                    <div className="stat-value">{ledger.length}</div>
                </div>
                {verifyResult && (
                    <div className="stat-item">
                        <div className="stat-label">VERIFICATION</div>
                        <div className={`stat-value ${verifyResult.valid ? 'text-success' : 'text-danger'}`}>{verifyResult.message}</div>
                    </div>
                )}
            </div>

            {/* Canvas */}
            <MockBlockchainCanvas
                ledger={ledger}
                selectedBlockIndex={selectedBlockIndex}
                onSelectBlock={setSelectedBlockIndex}
            />

            {/* Bottom Section - Tabbed Interface to reduce clutter */}
            <div className="mock-bottom-tabs">
                <div className="tabs-header" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-default)', marginBottom: '24px' }}>
                    <button
                        type="button"
                        className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inspector')}
                        style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'inspector' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'inspector' ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Block Inspector
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
                        onClick={() => setActiveTab('log')}
                        style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'log' ? '2px solid var(--brand-primary)' : '2px solid transparent', color: activeTab === 'log' ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Simulation Log
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'inspector' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                            <MockInspector block={selectedBlock} />
                            <MockMerkleTreeLab block={selectedBlock} />
                        </div>
                    )}

                    {activeTab === 'log' && (
                        <div>
                            <MockSimulationLog logs={simulationLog} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
