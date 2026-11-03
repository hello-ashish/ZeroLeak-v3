import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Sliders } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import './GlobalThemeSlider.css';

const GlobalThemeSlider = () => {
  const { themeProgress, setTheme, isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);
  const location = useLocation();

  // Hide the global slider on landing and login pages where a clean viewport is desired
  const isAuthPage = location.pathname === '/' || location.pathname.endsWith('/login') || location.pathname.startsWith('/student/take-exam');

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 4500); // Hide after 4.5s of inactivity
  };

  const handleToggleClick = () => {
    setIsVisible(prev => {
      if (!prev) {
        resetTimeout();
        return true;
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return false;
      }
    });
  };

  useEffect(() => {
    window.addEventListener('zl-theme-slider-toggle', handleToggleClick);
    return () => window.removeEventListener('zl-theme-slider-toggle', handleToggleClick);
  }, []);

  const handleChange = (e) => {
    const val = Number(e.target.value);
    setTheme(val);
    resetTimeout();
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (isVisible) {
      resetTimeout();
    }
  };

  if (isAuthPage) return null;

  return (
    <div
      className={`global-theme-controller ${isVisible ? 'slider-visible' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={handleToggleClick}
        title="Precision Brightness Slider"
        aria-label="Precision Brightness Slider"
      >
        <Sliders size={18} className={isDark ? 'active-icon moon' : 'active-icon sun'} />
      </button>

      <div className="theme-slider-container">
        <Sun size={18} className="slider-icon sun-icon" />
        <div className="slider-track-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            value={themeProgress}
            onChange={handleChange}
            className="theme-vertical-slider"
            aria-label="Adjust App Brightness"
          />
        </div>
        <Moon size={18} className="slider-icon moon-icon" />
      </div>
    </div>
  );
};

export default GlobalThemeSlider;
