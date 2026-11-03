import React, { useState, useEffect } from 'react';

/**
 * Reusable, responsive pagination component with direct page jumping.
 *
 * @param {number} currentPage - 1-based active page
 * @param {number} totalItems - Total count of items
 * @param {number} itemsPerPage - Number of items per page (default: 10)
 * @param {function} onPageChange - Callback invoked with next page number
 * @param {string} itemLabel - Label for items (e.g. "students", "professors")
 * @param {boolean} showQuickJump - Whether to render the direct "Go to page" jump input
 * @param {object} style - Optional container inline styles
 */
export function Pagination({
    currentPage = 1,
    totalItems = 0,
    itemsPerPage = 10,
    onPageChange,
    itemLabel = 'items',
    showQuickJump = true,
    style = {}
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const [jumpInput, setJumpInput] = useState(String(currentPage));

    useEffect(() => {
        setJumpInput(String(currentPage));
    }, [currentPage]);

    if (!totalItems || totalItems <= 0) return null;

    const handleJump = () => {
        const parsed = parseInt(jumpInput, 10);
        if (!isNaN(parsed)) {
            const clamped = Math.max(1, Math.min(totalPages, parsed));
            onPageChange(clamped);
            setJumpInput(String(clamped));
        } else {
            setJumpInput(String(currentPage));
        }
    };

    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (currentPage <= 4) {
            return [1, 2, 3, 4, 5, '...', totalPages];
        }
        if (currentPage >= totalPages - 3) {
            return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const pageNumbers = getPageNumbers();
    const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            ...style
        }}>
            {/* Showing Range */}
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Showing <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{startItem}</strong> to <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{endItem}</strong> of <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalItems}</strong> {itemLabel}
            </span>

            {/* Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Previous */}
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                >
                    Previous
                </button>

                {/* Page Number Pills */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {pageNumbers.map((p, idx) => {
                            if (p === '...') {
                                return (
                                    <span key={`dots-${idx}`} style={{ color: 'var(--text-tertiary)', padding: '0 4px', fontSize: 13, userSelect: 'none' }}>
                                        …
                                    </span>
                                );
                            }
                            const isActive = p === currentPage;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => onPageChange(p)}
                                    style={{
                                        minWidth: 32,
                                        height: 32,
                                        padding: '0 6px',
                                        fontSize: 12,
                                        fontFamily: 'var(--font-mono, monospace)',
                                        borderRadius: 6,
                                        background: isActive ? 'var(--brand-primary)' : 'transparent',
                                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                        border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                                        fontWeight: isActive ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'var(--bg-elevated)';
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                        }
                                    }}
                                    title={`Go to page ${p}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Next */}
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    style={{
                        height: 32,
                        padding: '0 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'var(--brand-primary)',
                        color: '#ffffff',
                        border: '1px solid var(--brand-primary)',
                        borderRadius: 6
                    }}
                >
                    Next
                </button>

                {/* Quick Page Jump Input */}
                {totalPages > 1 && showQuickJump && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 8,
                        paddingLeft: 8,
                        borderLeft: '1px solid var(--border-subtle)',
                        fontSize: 12,
                        color: 'var(--text-secondary)'
                    }}>
                        <span>Go to</span>
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={jumpInput}
                            onChange={e => setJumpInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleJump();
                            }}
                            onBlur={handleJump}
                            style={{
                                width: 44,
                                height: 30,
                                textAlign: 'center',
                                borderRadius: 6,
                                border: '1px solid var(--border-default)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                fontSize: 12,
                                fontFamily: 'var(--font-mono, monospace)',
                                padding: '0 2px',
                                outline: 'none'
                            }}
                            title={`Jump to page (1 - ${totalPages})`}
                        />
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleJump}
                            style={{
                                height: 30,
                                padding: '0 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                background: 'var(--brand-primary)',
                                color: '#ffffff',
                                border: '1px solid var(--brand-primary)',
                                borderRadius: 6
                            }}
                        >
                            Go
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Pagination;
