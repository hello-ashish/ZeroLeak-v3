import React from 'react'

export const Skeleton = ({ width = '100%', height = 16, radius = 6, style = {} }) => (
    <span
        className="skeleton"
        style={{ display: 'block', width, height, borderRadius: radius, ...style }}
        aria-hidden="true"
    />
)

export const SkeletonCard = () => (
    <div className="card" style={{ padding: '20px' }}>
        <Skeleton height={12} width="40%" style={{ marginBottom: 12 }} />
        <Skeleton height={28} width="60%" style={{ marginBottom: 8 }} />
        <Skeleton height={12} width="30%" />
    </div>
)

export const SkeletonCardSimulator = () => (
    <div className="card" style={{ padding: '20px' }}>
        <Skeleton height={12} width="60%" style={{ marginBottom: 12 }} />
        <Skeleton height={28} width="80%" style={{ marginBottom: 8 }} />
        <Skeleton height={12} width="40%" />
    </div>
)

export const SkeletonRow = () => (
    <tr>
        {[...Array(5)].map((_, i) => (
            <td key={i} style={{ padding: '12px 16px' }}>
                <Skeleton height={14} width={i === 0 ? '80%' : '60%'} />
            </td>
        ))}
    </tr>
)

export const SkeletonTable = ({ rows = 5 }) => (
    <tbody>
        {[...Array(rows)].map((_, i) => <SkeletonRow key={i} />)}
    </tbody>
)

export const EmptyState = ({ icon, title, description, action }) => (
    <div className="empty-state">
        <div className="empty-state-icon">{icon}</div>
        <p className="empty-state-title">{title}</p>
        {description && <p className="empty-state-desc">{description}</p>}
        {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
)
