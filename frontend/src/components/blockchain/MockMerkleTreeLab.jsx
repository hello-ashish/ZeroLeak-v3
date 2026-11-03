import React, { useState, useEffect } from 'react';
import { GitMerge, Play, ShieldCheck } from 'lucide-react';

export default function MockMerkleTreeLab({ block }) {
    const [step, setStep] = useState(0); // 0: Hidden, 1: Leaves, 2: Root
    const [isVerifying, setIsVerifying] = useState(false);
    const [verified, setVerified] = useState(null);

    // Reset when block changes
    useEffect(() => {
        setStep(0);
        setVerified(null);
        setIsVerifying(false);
    }, [block]);

    if (!block) return null;

    const root = block.canonicalHash.substring(0, 16);
    const leftBranch = block.canonicalHash.substring(16, 32);
    const rightBranch = block.canonicalHash.substring(32, 48) || '0x' + block.canonicalHash.substring(0, 14);

    const handleGenerate = () => {
        setStep(1); // Show leaves
        setTimeout(() => {
            setStep(2); // Show root
        }, 800);
    };

    const handleVerify = () => {
        setIsVerifying(true);
        setTimeout(() => {
            setIsVerifying(false);
            setVerified(block.valid !== false); // True unless explicitly tampered
        }, 1000);
    };

    return (
        <div className="card mock-merkle-lab">
            <div className="card-header" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GitMerge size={16} style={{ color: 'var(--brand-primary)' }}/>
                    <h3 className="card-title" style={{ fontSize: '15px' }}>MERKLE TREE LAB</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={handleGenerate}>
                        <Play size={12} style={{ marginRight: '4px' }} /> Generate Tree
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={handleVerify} disabled={step < 2}>
                        <ShieldCheck size={12} style={{ marginRight: '4px' }} /> Verify Proof
                    </button>
                </div>
            </div>
            
            <div className="card-body" style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '24px 16px', minHeight: '220px' }}>
                
                {step >= 2 ? (
                    <div className={`merkle-node root-node ${isVerifying ? 'verifying-pulse' : ''} ${verified === true ? 'verified' : verified === false ? 'invalid' : ''}`} style={{ transition: 'all 0.3s' }}>
                        <div className="node-label">MERKLE ROOT</div>
                        <div className="node-hash">{root}...</div>
                    </div>
                ) : (
                    <div style={{ height: '58px' }}></div>
                )}
                
                {step >= 2 ? (
                    <div className="merkle-branches">
                        <div className="branch-line left"></div>
                        <div className="branch-line right"></div>
                    </div>
                ) : (
                    <div style={{ height: '40px' }}></div>
                )}

                {step >= 1 ? (
                    <div className="merkle-leaves" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
                        <div className="merkle-node leaf-node">
                            <div className="node-label">Payload Data</div>
                            <div className="node-hash">{leftBranch}...</div>
                        </div>
                        <div className="merkle-node leaf-node">
                            <div className="node-label">Metadata Hash</div>
                            <div className="node-hash">{rightBranch}...</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                        Click "Generate Tree" to compute hashes
                    </div>
                )}
                
                {verified !== null && (
                    <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 600, color: verified ? 'var(--success)' : 'var(--danger)' }}>
                        {verified ? '✓ Merkle Proof Verified (Leaves match root)' : '✗ Merkle Proof Failed (Hash mismatch)'}
                    </div>
                )}

                {!verified && (
                    <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Visualizing how multiple payload events roll up into a single cryptographic root hash inside this block.
                    </div>
                )}
            </div>
        </div>
    );
}
