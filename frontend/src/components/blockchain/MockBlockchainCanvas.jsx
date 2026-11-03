import React, { useEffect, useRef } from 'react';
import MockBlockCard from './MockBlockCard';

export default function MockBlockchainCanvas({ ledger, selectedBlockIndex, onSelectBlock }) {
    const containerRef = useRef(null);

    // Auto-scroll to the newest block
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
    }, [ledger.length]);

    return (
        <div className="mock-blockchain-canvas" ref={containerRef}>
            <div className="blockchain-flow">
                {ledger.map((block, index) => (
                    <React.Fragment key={block.eventId}>
                        {index > 0 && (
                            <div className={`chain-link ${block.valid === false ? 'broken' : ''}`}>
                                <div className="flow-arrow"></div>
                            </div>
                        )}
                        <MockBlockCard 
                            block={block} 
                            isSelected={selectedBlockIndex === index}
                            onSelect={() => onSelectBlock(index)}
                        />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
