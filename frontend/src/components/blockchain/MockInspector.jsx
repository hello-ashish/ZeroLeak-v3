import React from 'react';
import { Search } from 'lucide-react';

export default function MockInspector({ block }) {
    if (!block) return null;

    const isGenesis = block.commitmentType === 'GENESIS';
    const isInvalid = block.valid === false;

    return (
        <div className="card mock-inspector">
            <div className="card-header" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)' }}>
                <Search size={16} style={{ color: 'var(--brand-primary)' }}/>
                <h3 className="card-title" style={{ fontSize: '15px' }}>BLOCK INSPECTOR</h3>
            </div>
            <div className="card-body" style={{ paddingTop: '16px' }}>
                <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>BLOCK #{block.height - 1}</h4>
                    {isInvalid ? (
                        <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>⚠ VALIDATION FAILED</div>
                    ) : (
                        <div style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>✓ VERIFIED</div>
                    )}
                </div>

                <div className="data-row">
                    <span>Commitment Type</span>
                    <span style={{ fontWeight: 600 }}>{block.commitmentType}</span>
                </div>
                <div className="data-row">
                    <span>Transaction ID</span>
                    <span className="block-hash">{block.txId}</span>
                </div>
                <div className="data-row">
                    <span>Height</span>
                    <span>{block.height}</span>
                </div>
                <div className="data-row">
                    <span>Timestamp</span>
                    <span>{new Date(block.timestamp).toLocaleString()}</span>
                </div>
                {!isGenesis && (
                    <div className="data-row" style={{ flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span>Previous Hash</span>
                        <span className="block-hash highlight-prev">{block.prevHash}</span>
                    </div>
                )}
                <div className="data-row" style={{ flexDirection: 'column', gap: '4px', alignItems: 'flex-start', borderBottom: 'none' }}>
                    <span>Block Hash (Canonical)</span>
                    <span className={`block-hash ${isInvalid ? 'text-danger' : 'highlight'}`} style={{ wordBreak: 'break-all', display: 'block', width: '100%' }}>{block.canonicalHash}</span>
                </div>
                
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Simulated Payload:</div>
                    <code style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {block.payloadString}
                    </code>
                </div>
            </div>
        </div>
    );
}
