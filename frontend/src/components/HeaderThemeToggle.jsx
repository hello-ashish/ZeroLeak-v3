import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import './HeaderThemeToggle.css';

export const HeaderThemeToggle = ({ showLabel = false, className = '' }) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            className={`topbar-btn header-theme-toggle ${isDark ? 'is-dark' : 'is-light'} ${className}`}
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            <div className="theme-toggle-icon-wrap">
                <Sun size={18} className="theme-sun-icon" />
                <Moon size={18} className="theme-moon-icon" />
            </div>
            {showLabel && (
                <span className="theme-toggle-label">
                    {isDark ? 'Light' : 'Dark'}
                </span>
            )}
        </button>
    );
};
