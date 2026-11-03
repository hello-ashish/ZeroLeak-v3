import React from 'react'

const PALETTE = [
    { bg: 'rgba(79,70,229,0.15)', color: '#818cf8' },    // indigo
    { bg: 'rgba(8,145,178,0.15)', color: '#22d3ee' },    // cyan
    { bg: 'rgba(5,150,105,0.15)', color: '#34d399' },    // emerald
    { bg: 'rgba(217,119,6,0.15)', color: '#fbbf24' },    // amber
    { bg: 'rgba(220,38,38,0.15)', color: '#f87171' },    // red
    { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa' },   // violet
    { bg: 'rgba(236,72,153,0.15)', color: '#f472b6' },   // pink
    { bg: 'rgba(37,99,235,0.15)', color: '#60a5fa' },    // blue
]

export const Avatar = ({ name = '', size = 'md', style = {} }) => {
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('')

    const palette = PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length]

    return (
        <span
            className={`avatar avatar-${size}`}
            aria-label={name}
            title={name}
            style={{
                background: palette.bg,
                color: palette.color,
                ...style,
            }}
        >
            {initials || '?'}
        </span>
    )
}
