// Helper to convert hex or rgba to array: [r, g, b, a?]
const parseColor = (colorStr) => {
  // Hex
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(colorStr)) {
    c = colorStr.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  }
  
  // RGBA
  const rgbaMatch = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10), 
      parseInt(rgbaMatch[2], 10), 
      parseInt(rgbaMatch[3], 10), 
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    ];
  }
  
  console.warn(`Could not parse color: ${colorStr}`);
  return [0, 0, 0, 1];
};

// Helper to interpolate between two colors
const interpolateColor = (color1, color2, factor) => {
  const r = Math.round(color1[0] + factor * (color2[0] - color1[0]));
  const g = Math.round(color1[1] + factor * (color2[1] - color1[1]));
  const b = Math.round(color1[2] + factor * (color2[2] - color1[2]));
  
  const a1 = color1.length > 3 ? color1[3] : 1;
  const a2 = color2.length > 3 ? color2[3] : 1;
  const a = a1 + factor * (a2 - a1);
    
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

// 3-point Theme Definitions
const THEME_STOPS = {
  // 0% (Dark Navy/Black)
  dark: {
    '--bg-app': '#09090b',
    '--bg-surface': '#121214',
    '--bg-elevated': '#1a1a1d',
    '--bg-card': '#121214',
    '--bg-overlay': '#222225',
    '--bg-hover': 'rgba(255, 255, 255, 0.035)',
    '--bg-active': 'rgba(255, 255, 255, 0.06)',
    '--bg-input': '#121214',
    '--bg-base': '#09090b',
    '--bg-body': '#121214',
    '--border-subtle': 'rgba(255, 255, 255, 0.04)',
    '--border-default': 'rgba(255, 255, 255, 0.08)',
    '--border-strong': 'rgba(255, 255, 255, 0.15)',
    '--text-primary': '#f4f4f5',
    '--text-secondary': '#a1a1aa',
    '--text-tertiary': '#71717a',
    '--text-disabled': '#3f3f46',
    '--text-inverse': '#09090b',
  },
  // 50% (Charcoal/Dark Slate) - Ensures rich dark contrast mid-way
  mid: {
    '--bg-app': '#1f2229',        // Rich near-navy/charcoal
    '--bg-surface': '#262931',    // Slightly elevated charcoal
    '--bg-elevated': '#2c3039',   // Higher contrast slate
    '--bg-card': '#262931',       
    '--bg-overlay': '#313640',    
    '--bg-hover': 'rgba(255, 255, 255, 0.08)',
    '--bg-active': 'rgba(255, 255, 255, 0.12)',
    '--bg-input': '#262931',
    '--bg-base': '#1f2229',
    '--bg-body': '#262931',
    '--border-subtle': 'rgba(255, 255, 255, 0.10)',
    '--border-default': 'rgba(255, 255, 255, 0.15)',
    '--border-strong': 'rgba(255, 255, 255, 0.25)',
    '--text-primary': '#f8fafc',  // Very bright text for maximum contrast against slate
    '--text-secondary': '#cbd5e1', 
    '--text-tertiary': '#94a3b8',
    '--text-disabled': '#64748b',
    '--text-inverse': '#0f172a',
  },
  // 100% (Light)
  light: {
    '--bg-app': '#f4f4f5',
    '--bg-surface': '#ffffff',
    '--bg-elevated': '#fafafa',
    '--bg-card': '#ffffff',
    '--bg-overlay': '#ffffff',
    '--bg-hover': 'rgba(0, 0, 0, 0.04)',
    '--bg-active': 'rgba(0, 0, 0, 0.08)',
    '--bg-input': '#ffffff',
    '--bg-base': '#f4f4f5',
    '--bg-body': '#ffffff',
    '--border-subtle': 'rgba(0, 0, 0, 0.05)',
    '--border-default': 'rgba(0, 0, 0, 0.1)',
    '--border-strong': 'rgba(0, 0, 0, 0.18)',
    '--text-primary': '#09090b',
    '--text-secondary': '#52525b',
    '--text-tertiary': '#71717a',
    '--text-disabled': '#a1a1aa',
    '--text-inverse': '#ffffff',
  }
};

// Pre-parse the colors for performance
const PARSED_STOPS = {
  dark: {},
  mid: {},
  light: {}
};

Object.keys(THEME_STOPS.dark).forEach(key => {
  PARSED_STOPS.dark[key] = parseColor(THEME_STOPS.dark[key]);
  PARSED_STOPS.mid[key] = parseColor(THEME_STOPS.mid[key]);
  PARSED_STOPS.light[key] = parseColor(THEME_STOPS.light[key]);
});

export const applyThemeProgress = (progress) => {
  const root = document.documentElement;
  const p = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  
  // Pass the raw progress to CSS for anything that still needs it
  root.style.setProperty('--theme-progress', p);
  
  let startStop, endStop, factor;
  
  if (p <= 50) {
    startStop = PARSED_STOPS.dark;
    endStop = PARSED_STOPS.mid;
    factor = p / 50; // Normalize to 0-1
  } else {
    startStop = PARSED_STOPS.mid;
    endStop = PARSED_STOPS.light;
    factor = (p - 50) / 50; // Normalize to 0-1
  }
  
  Object.keys(startStop).forEach(key => {
    const colorStr = interpolateColor(startStop[key], endStop[key], factor);
    root.style.setProperty(key, colorStr);
  });
  
  // Set explicit theme and color-scheme
  const isLight = p > 50;
  root.setAttribute('data-theme', isLight ? 'light' : 'dark');
  root.style.colorScheme = isLight ? 'light' : 'dark';

  // Broadcast change for non-React listeners
  try {
    window.dispatchEvent(new CustomEvent('zl-theme-change', {
      detail: { progress: p, isDark: !isLight, theme: isLight ? 'light' : 'dark' }
    }));
  } catch (_) {}
};
