import React from 'react';

export default function MockBlockCard({ block, isSelected, onSelect }) {
    const isGenesis = block.commitmentType === 'GENESIS';
    const isInvalid = block.valid === false;

    return (
        <div 
            className={`mock-block-card ${isSelected ? 'selected' : ''} ${isInvalid ? 'invalid' : ''} ${isGenesis ? 'genesis' : ''}`}
            onClick={onSelect}
        >
            <div className="mock-block-header">
                <div className="block-number">BLOCK #{block.height - 1}</div>
                {isInvalid ? (
                    <span className="badge badge-danger">✗ TAMPERED</span>
                ) : (
                    <span className="badge badge-success">✓ VALID</span>
                )}
            </div>
            
            <div className="mock-block-body">
                <div className="block-type">{block.commitmentType}</div>
                
                <div className="hash-row">
                    <span className="hash-label">TX</span>
                    <span className="hash-value">{block.txId}</span>
                </div>
                
                <div className="hash-row">
                    <span className="hash-label">HASH</span>
                    <span className="hash-value highlight">{block.canonicalHash.substring(0, 12)}...</span>
                </div>
                
                {!isGenesis && (
                    <div className="hash-row prev-hash">
                        <span className="hash-label">PREV</span>
                        <span className="hash-value">{block.prevHash.substring(0, 12)}...</span>
                    </div>
                )}
            </div>
            {isInvalid && <div className="tamper-overlay"></div>}
        </div>
    );
}
