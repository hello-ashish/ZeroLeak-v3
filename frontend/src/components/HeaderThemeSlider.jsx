import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { applyThemeProgress } from '../utils/themeEngine.js';

export const HeaderThemeSlider = () => {
    const [themeProgress, setThemeProgress] = useState(() => {
        return localStorage.getItem('themeProgress') || 0;
    });

    useEffect(() => {
        applyThemeProgress(themeProgress);
        localStorage.setItem('themeProgress', themeProgress);
    }, [themeProgress]);

    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--bg-surface)', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            border: '1px solid var(--border-subtle)' 
        }}>
            <Sun size={14} style={{ color: 'var(--text-secondary)' }} />
            <input 
                type="range" 
                min="0" 
                max="100" 
                value={themeProgress}
                onChange={(e) => setThemeProgress(e.target.value)}
                style={{ 
                    width: '80px', 
                    height: '4px', 
                    cursor: 'pointer',
                    accentColor: 'var(--brand-primary)'
                }}
                aria-label="Adjust App Brightness"
            />
            <Moon size={14} style={{ color: 'var(--text-secondary)' }} />
        </div>
    );
};
